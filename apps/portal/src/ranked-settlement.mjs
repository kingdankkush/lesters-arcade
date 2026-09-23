// Ranked settlement client (contract §7.2, A17, A31). Lazy-loaded by main.js.
//
// One game-agnostic client for Hard Money Heroes, Chikun's Escape and STACKED:
// POST the §5.1 body to /api/settle with the player's Bearer token, follow the
// SettleResponse through queued → publishing → published, keep unpublished
// bodies on the device and re-drive them after a reload. The relayer publishes;
// the player never signs a score submission (A3).
//
// With `live: false` (SETTLEMENT_LIVE off) every handle is a terminal
// `preview`: no fetch, no storage write and no timer.
//
// Pure: no DOM, no window, no environment. fetch, storage, the clock and the
// timers are injected, so tests drive every transition with fakes.

export const RANKED_CLIENT_STATES = Object.freeze(['preview', 'waiting-entry', 'verifying', 'queued', 'publishing', 'published',
  'retrying', 'saved-locally', 'rejected', 'practice']);
export const RANKED_PENDING_KEY = 'lesters-arcade-ranked-pending-v1';
export const RANKED_PENDING_EVENT = 'lesters:ranked-pending';
export const RANKED_RETRY_REQUEST_EVENT = 'lesters:ranked-retry-request';
export const RANKED_SETTLE_URL = '/api/settle';
export const RANKED_STATUS_URL = '/api/settle/status';
export const RANKED_PROFILE_URL = '/api/profile';
export const RANKED_MAX_PENDING = 5;
// §7.2 and §12: STACKED bodies whose SIC1 text is above this are kept in
// memory only (localStorage cannot hold them next to the arcade state).
export const RANKED_MAX_PERSISTED_BASE64 = 240_000;
export const RANKED_TIMING = Object.freeze({
  entryWaitMs: 90_000, // A17: wait for the entry receipt at most 90 s after the run.
  queuedRetryLimit: 20, // retry POSTs while pending/signed, then status polling
  queuedPollMs: 15_000,
  publishingWindowMs: 180_000,
  defaultPollMs: 3_000,
  publishingPollMs: 2_500,
  retryableMinMs: 5_000,
  retryableMaxMs: 60_000,
  retryableGiveUpMs: 600_000, // entry-pending (and other retryable waits) end in saved-locally after 10 min
  savedLocallyBackoffMs: Object.freeze([5_000, 15_000, 45_000, 120_000]),
});

const SETTLE_VERSION = 'lesters-ranked-settle-v1';
const HEX32 = /^0x[0-9a-f]{64}$/;
const TERMINAL_STATES = new Set(['preview', 'published', 'rejected', 'practice']);
const IN_FLIGHT_STATES = new Set(['waiting-entry', 'verifying', 'queued', 'publishing', 'retrying']);
const ENTRY_STATUSES = new Set(['none', 'pending', 'confirmed', 'failed']);

// Plain words for every code the client can surface. Server codes not listed
// fall back to a generic sentence that still names the code.
export const RANKED_SETTLEMENT_MESSAGES = Object.freeze({
  'sign-in-required': 'Sign in with your wallet to publish this run. It is saved on this device.',
  'settlement-paused': 'Ranked publishing is paused; your run is saved and will publish when it resumes.',
  'network-error': 'Lester’s Arcade could not be reached. Your run is saved on this device and will retry.',
  'rate-limited': 'Publishing is busy right now. Your run is saved and will retry shortly.',
  'server-error': 'Publishing hit a server problem. Your run is saved on this device and will retry.',
  'entry-pending': 'Your entry is still confirming on LitVM. Your run is saved on this device and will retry.',
  'run-timing-early': 'Your run is verified and will be published in a moment.',
  'chain-read-failed': 'LitVM could not be read just now. Publishing will retry shortly.',
  'session-not-found': 'The publishing service lost track of this run. It is saved on this device; retry to send it again.',
  'entry-failed': 'Entry didn’t go through. This run is practice and won’t be ranked.',
  'entry-timeout': 'Entry didn’t confirm in time. This run is practice and won’t be ranked.',
  'entry-not-paid': 'LitVM shows no paid entry for this run, so it cannot be ranked.',
  'entry-underpaid': 'The entry paid for this run was below the Ranked minimum, so it cannot be ranked.',
  'replay-rejected': 'The run did not pass replay verification, so it was not published.',
  'implausible-run': 'The run did not pass the plausibility check, so it was not published.',
  'wallet-mismatch': 'This run belongs to a different wallet than the one signed in.',
  'session-conflict': 'A different run was already recorded for this Ranked entry.',
  'seed-ticket-stale': 'The Ranked seed for this run expired before the entry was paid.',
  'run-stale': 'This run is too old to publish.',
  'hero-locked': 'That hero is not unlocked for Ranked on this wallet yet.',
  'score-out-of-bounds': 'The score is outside the range the score registry accepts.',
  'request-unavailable': 'This run could not be prepared for publishing.',
  'dead-letter': 'This run could not be published. Testnet entries are not refunded.',
  'keep-tab-open': 'Keep this tab open until publishing finishes',
});

export function rankedSettlementMessage(code) {
  const key = typeof code === 'string' ? code : '';
  if (Object.hasOwn(RANKED_SETTLEMENT_MESSAGES, key)) return RANKED_SETTLEMENT_MESSAGES[key];
  return `This run could not be published (${key || 'unknown-error'}).`;
}

// One status line for the parent's game-state copy, true in every state.
export function rankedSettlementStatusCopy(snapshot) {
  const state = snapshot?.state;
  const error = snapshot?.error;
  switch (state) {
    case 'preview': return 'Canonical Ranked preview saved locally. No transaction was sent; verified on-chain publishing remains disabled.';
    case 'waiting-entry': return 'Run saved. Waiting for your Ranked entry to confirm on LitVM before publishing…';
    case 'verifying': return 'Verifying your run with Lester’s Arcade…';
    case 'queued': return 'Run verified. Queued for publishing on LitVM…';
    case 'publishing': return 'Publishing your run on LitVM…';
    case 'published': {
      const tx = snapshot?.server?.txHash;
      return typeof tx === 'string' && tx.length > 16 ? `Run published on LitVM. Tx ${tx.slice(0, 10)}…${tx.slice(-6)}.` : 'Run published on LitVM.';
    }
    case 'retrying': return error?.message ?? 'Publishing will retry shortly.';
    case 'saved-locally': return error?.message ?? 'Saved on this device. Publishing will retry automatically.';
    case 'rejected': return error?.message ?? rankedSettlementMessage(null);
    case 'practice': return error?.message ?? RANKED_SETTLEMENT_MESSAGES['entry-failed'];
    default: return '';
  }
}

// §7.2 result context. Hosted: one public GET /api/profile?wallet= (the
// server index is the only source, so a device-local best never produces a
// false "New personal best"); preview: the caller's device-local values.
export async function fetchRankedResultContext({ hosted = false, fetchImpl = null, wallet, gameId, local = null } = {}) {
  const empty = Object.freeze({ displayName: null, previousBest: null });
  if (!hosted) {
    const best = local?.previousBest;
    return Object.freeze({
      displayName: typeof local?.displayName === 'string' && local.displayName ? local.displayName : null,
      previousBest: Number.isSafeInteger(best) && best >= 0 ? best : null,
    });
  }
  const address = String(wallet ?? '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address) || typeof fetchImpl !== 'function') return empty;
  try {
    const response = await fetchImpl(`${RANKED_PROFILE_URL}?wallet=${address}`, { method: 'GET', cache: 'no-store', headers: { accept: 'application/json' } });
    const body = await response.json();
    if (!response.ok || body?.ok !== true) return empty;
    const best = body.games?.[gameId]?.bestScore;
    return Object.freeze({
      displayName: typeof body.profile?.displayName === 'string' && body.profile.displayName ? body.profile.displayName : null,
      previousBest: Number.isSafeInteger(best) && best >= 0 ? best : null,
    });
  } catch {
    return empty;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validRequest(request) {
  return isPlainObject(request) && request.v === SETTLE_VERSION && typeof request.gameId === 'string'
    && HEX32.test(String(request.sessionId32 ?? '')) && isPlainObject(request.identity) && isPlainObject(request.evidence);
}

function entryOf(value, fallbackTxHash = null) {
  const status = ENTRY_STATUSES.has(value?.status) ? value.status : 'none';
  const txHash = typeof value?.txHash === 'string' && value.txHash ? value.txHash : (fallbackTxHash ?? null);
  return { status, txHash };
}

function validStoredEntry(entry) {
  return isPlainObject(entry) && HEX32.test(String(entry.sessionId32 ?? '')) && validRequest(entry.body) && entry.body.sessionId32 === entry.sessionId32;
}

function stackedTextLength(request) {
  return request?.gameId === 'stacked' && typeof request.evidence?.sic1 === 'string' ? request.evidence.sic1.length : 0;
}

export function createRankedSettlementClient({
  live = false,
  fetchImpl = typeof globalThis.fetch === 'function' ? (...args) => globalThis.fetch(...args) : null,
  getToken = () => null,
  storage = null,
  now = Date.now,
  setTimeoutImpl = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeoutImpl = (id) => globalThis.clearTimeout(id),
  pendingKey = RANKED_PENDING_KEY,
  onPendingCount = null,
  onPublished = null,
  settleUrl = RANKED_SETTLE_URL,
  statusUrl = RANKED_STATUS_URL,
} = {}) {
  const handles = new Map();
  const persistFlags = new Map();
  let reportedCount = null;
  const isoNow = () => new Date(now()).toISOString();

  // --- Pending bodies (live only) -------------------------------------------
  function readPending() {
    if (!live || !storage) return [];
    try {
      const raw = storage.getItem(pendingKey);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter(validStoredEntry).slice(0, RANKED_MAX_PENDING) : [];
    } catch {
      return [];
    }
  }
  function writePending(list) {
    if (!live || !storage) return false;
    try {
      if (list.length) storage.setItem(pendingKey, JSON.stringify(list));
      else storage.removeItem(pendingKey);
      return true;
    } catch {
      return false;
    }
  }
  function reportCount(force = false) {
    const count = readPending().length;
    if (!force && count === reportedCount) return;
    reportedCount = count;
    try { onPendingCount?.(count); } catch { /* a listener error never stops settlement */ }
  }
  // Newest first, at most RANKED_MAX_PENDING; an evicted body's live handle
  // stops reporting itself as persisted.
  function persistEntry(entry) {
    const list = readPending().filter((row) => row.sessionId32 !== entry.sessionId32);
    list.unshift(entry);
    const stored = writePending(list.slice(0, RANKED_MAX_PENDING));
    if (stored) for (const evicted of list.slice(RANKED_MAX_PENDING)) persistFlags.get(evicted.sessionId32)?.(false);
    reportCount();
    return stored;
  }
  function dropEntry(sessionId32) {
    const list = readPending();
    const next = list.filter((row) => row.sessionId32 !== sessionId32);
    if (next.length !== list.length) writePending(next);
    reportCount();
  }
  function isPersisted(sessionId32) {
    return readPending().some((row) => row.sessionId32 === sessionId32);
  }

  // --- Handles ---------------------------------------------------------------
  function createHandle({ request = null, gameId = null, wallet = null, sessionId = null, localScore = null, entry = null, state = 'verifying', error = null, persisted = false }) {
    const sessionId32 = request?.sessionId32 ?? null;
    const subscribers = new Set();
    const h = {
      state,
      server: null,
      error,
      entry: entryOf(entry, request?.entryTxHash ?? null),
      persisted,
      updatedAt: isoNow(),
      timer: null,
      disposed: false,
      inFlight: null,
      queuedRetries: 0,
      publishingSince: null,
      retryableSince: null,
      retryableCount: 0,
      backoffIndex: 0,
      reposted: false,
    };
    const meta = Object.freeze({
      sessionId32,
      shareId: sessionId32 ? sessionId32.slice(2) : null,
      gameId: request?.gameId ?? gameId ?? null,
      wallet: String(request?.identity?.wallet ?? wallet ?? '').toLowerCase() || null,
      sessionId: request?.identity?.sessionId ?? sessionId ?? null,
      localScore: Number.isFinite(localScore) ? localScore : null,
    });

    const snapshot = () => Object.freeze({
      state: h.state,
      sessionId32: meta.sessionId32,
      shareId: meta.shareId,
      gameId: meta.gameId,
      wallet: meta.wallet,
      sessionId: meta.sessionId,
      localScore: meta.localScore,
      entry: Object.freeze({ ...h.entry }),
      server: h.server,
      error: h.error ? Object.freeze({ ...h.error }) : null,
      persisted: h.persisted,
      notice: live && !h.persisted && !TERMINAL_STATES.has(h.state) && request
        ? Object.freeze({ code: 'keep-tab-open', message: RANKED_SETTLEMENT_MESSAGES['keep-tab-open'] })
        : null,
      updatedAt: h.updatedAt,
    });

    function notify() {
      const value = snapshot();
      for (const fn of [...subscribers]) {
        try { fn(value); } catch { /* one subscriber never breaks another */ }
      }
    }
    function set(nextState, { error: nextError = null } = {}) {
      h.state = nextState;
      h.error = nextError;
      h.updatedAt = isoNow();
      notify();
    }
    function clearTimer() {
      if (h.timer !== null) {
        clearTimeoutImpl(h.timer);
        h.timer = null;
      }
    }
    function schedule(ms, step) {
      clearTimer();
      if (h.disposed) return;
      h.timer = setTimeoutImpl(() => {
        h.timer = null;
        void run(step);
      }, Math.max(0, Math.round(ms)));
    }
    function run(step) {
      if (h.disposed) return Promise.resolve();
      if (h.inFlight) return h.inFlight;
      h.inFlight = (async () => {
        try { await step(); } finally { h.inFlight = null; }
      })();
      return h.inFlight;
    }
    // Terminal: the stored body is no longer needed (§7.2: kept until
    // published, rejected or practice).
    function finish(nextState, nextError = null) {
      clearTimer();
      if (sessionId32 && live) dropEntry(sessionId32);
      h.persisted = false;
      set(nextState, { error: nextError });
    }
    const errorFor = (code, retryable) => ({ code, message: rankedSettlementMessage(code), retryable });

    // --- Network steps -------------------------------------------------------
    async function call(url, init) {
      try {
        const response = await fetchImpl(url, { ...init, cache: 'no-store' });
        let body = null;
        try { body = await response.json(); } catch { body = null; }
        const retryAfter = Number(response.headers?.get?.('retry-after'));
        return { status: response.status, body, retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0 };
      } catch {
        return { network: true };
      }
    }
    function tokenOrSignIn() {
      let token = null;
      try { token = getToken(meta.wallet); } catch { token = null; }
      if (typeof token === 'string' && token) return token;
      savedLocally('sign-in-required', { auto: false });
      return null;
    }
    async function postFull() {
      if (!request) return savedLocally('request-unavailable', { auto: false });
      const token = tokenOrSignIn();
      if (!token) return undefined;
      set('verifying');
      const res = await call(settleUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
      });
      return respond(res, 'full');
    }
    async function postRetry() {
      const token = tokenOrSignIn();
      if (!token) return undefined;
      const res = await call(settleUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ v: SETTLE_VERSION, sessionId32, retry: true }),
      });
      return respond(res, 'retry');
    }
    async function getStatus() {
      const token = tokenOrSignIn();
      if (!token) return undefined;
      const res = await call(`${statusUrl}?sessionId32=${sessionId32}`, {
        method: 'GET',
        headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      });
      return respond(res, 'status');
    }
    const redrive = () => (h.server ? postRetry() : postFull());

    function respond(res, kind) {
      if (h.disposed) return undefined;
      if (res.network) return savedLocally('network-error');
      const { status, body } = res;
      if (status >= 200 && status < 300 && body?.ok === true) {
        h.retryableSince = null;
        h.retryableCount = 0;
        h.backoffIndex = 0;
        return applyServer(body);
      }
      const code = typeof body?.error === 'string' && body.error ? body.error : null;
      if (body?.retryable === true) return retryable(code ?? 'server-error', body.retryAfterMs);
      if (status === 401) return savedLocally('sign-in-required', { auto: false });
      if (status === 404) {
        if (kind !== 'full' && !h.reposted && request) {
          h.reposted = true;
          return postFull();
        }
        return savedLocally(code ?? 'session-not-found', { auto: false });
      }
      if (status === 429) return savedLocally('rate-limited', { minDelayMs: res.retryAfterMs });
      if (status === 503 && code === 'settlement-paused') return savedLocally('settlement-paused');
      if (status >= 500 || status < 400) return savedLocally(code ?? 'server-error');
      return finish('rejected', errorFor(code ?? `http-${status}`, false));
    }

    function applyServer(body) {
      h.server = Object.freeze({ ...body });
      const poll = Number.isFinite(body.pollAfterMs) && body.pollAfterMs > 0 ? body.pollAfterMs : null;
      switch (body.status) {
        case 'confirmed': {
          finish('published');
          try { onPublished?.(snapshot()); } catch { /* the local ledger stamp is best effort */ }
          return undefined;
        }
        case 'pending':
        case 'signed': {
          set('queued');
          if (h.queuedRetries < RANKED_TIMING.queuedRetryLimit) {
            return schedule(poll ?? RANKED_TIMING.defaultPollMs, () => {
              h.queuedRetries += 1;
              return postRetry();
            });
          }
          return schedule(RANKED_TIMING.queuedPollMs, getStatus);
        }
        case 'submitted': {
          h.publishingSince ??= now();
          set('publishing');
          const within = now() - h.publishingSince < RANKED_TIMING.publishingWindowMs;
          return schedule(within ? (poll ?? RANKED_TIMING.publishingPollMs) : RANKED_TIMING.queuedPollMs, getStatus);
        }
        case 'failed': {
          if (body.retryable === true) {
            set('retrying', { error: errorFor(body.lastError ?? 'server-error', true) });
            const next = Date.parse(body.nextAttemptAt ?? '');
            const wait = Math.max(poll ?? RANKED_TIMING.defaultPollMs, Number.isFinite(next) ? next - now() : 0);
            return schedule(wait, postRetry);
          }
          return finish('rejected', { ...errorFor('dead-letter', false), serverCode: body.lastError ?? null });
        }
        default:
          return savedLocally('server-error');
      }
    }

    // A31: an error body with retryable:true keeps the request and re-POSTs it.
    function retryable(code, retryAfterMs) {
      const t = now();
      h.retryableSince ??= t;
      if (code !== 'run-timing-early' && t - h.retryableSince >= RANKED_TIMING.retryableGiveUpMs) return savedLocally(code);
      set('retrying', { error: errorFor(code, true) });
      const backoff = Math.min(RANKED_TIMING.retryableMinMs * 2 ** h.retryableCount, RANKED_TIMING.retryableMaxMs);
      h.retryableCount += 1;
      return schedule(Math.max(Number(retryAfterMs) || 0, backoff), postFull);
    }

    function savedLocally(code, { auto = true, minDelayMs = 0 } = {}) {
      clearTimer();
      set('saved-locally', { error: errorFor(code, true) });
      if (!auto || !live) return undefined;
      const backoff = RANKED_TIMING.savedLocallyBackoffMs;
      if (h.backoffIndex >= backoff.length) return undefined; // a manual retry() takes it from here
      const wait = Math.max(backoff[h.backoffIndex], Number(minDelayMs) || 0);
      h.backoffIndex += 1;
      return schedule(wait, redrive);
    }

    async function start(entryConfirmed) {
      if (entryConfirmed && typeof entryConfirmed.then === 'function' && h.entry.status !== 'confirmed') {
        set('waiting-entry');
        let timeoutId = null;
        const outcome = await Promise.race([
          Promise.resolve(entryConfirmed).then(
            (value) => (value === 'confirmed' || value === 'failed' ? value : 'unknown'),
            () => 'unknown',
          ),
          new Promise((resolve) => { timeoutId = setTimeoutImpl(() => resolve('timeout'), RANKED_TIMING.entryWaitMs); }),
        ]);
        if (timeoutId !== null) clearTimeoutImpl(timeoutId);
        if (h.disposed) return;
        if (outcome === 'failed') {
          h.entry = { ...h.entry, status: 'failed' };
          finish('practice', errorFor('entry-failed', false));
          return;
        }
        if (outcome === 'timeout') {
          finish('practice', errorFor('entry-timeout', false));
          return;
        }
        // An unknown outcome (the wallet's wait() threw) is left to the
        // server, which proves the entry over its own RPC (A17).
        if (outcome === 'confirmed') h.entry = { ...h.entry, status: 'confirmed' };
      }
      await run(postFull);
    }

    const handle = Object.freeze({
      sessionId32,
      gameId: meta.gameId,
      get state() { return h.state; },
      get snapshot() { return snapshot(); },
      subscribe(fn) {
        if (typeof fn !== 'function') return () => {};
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
      // Manual retry (the results screen's Retry, the combat menu, a
      // lesters:ranked-retry-request). No-op for terminal states and while the
      // entry is still being awaited.
      retry() {
        if (h.disposed || TERMINAL_STATES.has(h.state) || h.state === 'waiting-entry' || !live) return Promise.resolve();
        clearTimer();
        h.backoffIndex = 0;
        h.retryableCount = 0;
        h.reposted = false;
        if (h.state === 'saved-locally') h.retryableSince = null;
        return run(redrive);
      },
      dispose() {
        h.disposed = true;
        clearTimer();
        subscribers.clear();
        if (sessionId32 && handles.get(sessionId32) === handle) {
          handles.delete(sessionId32);
          persistFlags.delete(sessionId32);
        }
      },
    });
    return { handle, start, setPersisted(value) { h.persisted = Boolean(value); } };
  }

  function track(created) {
    handles.set(created.handle.sessionId32, created.handle);
    persistFlags.set(created.handle.sessionId32, created.setPersisted);
    return created;
  }

  function previewHandle({ gameId, wallet, sessionId, localScore, entry }) {
    return createHandle({ request: null, gameId, wallet, sessionId, localScore, entry, state: 'preview' }).handle;
  }

  function settle(request, {
    entryConfirmed = null, localScore = null, persistBody = true, entry = null, gameId = null, wallet = null, sessionId = null,
  } = {}) {
    if (!live) return previewHandle({ gameId: request?.gameId ?? gameId, wallet: request?.identity?.wallet ?? wallet, sessionId: request?.identity?.sessionId ?? sessionId, localScore, entry });
    if (!validRequest(request)) {
      return createHandle({ gameId, wallet, sessionId, localScore, entry, state: 'rejected', error: { code: 'request-unavailable', message: rankedSettlementMessage('request-unavailable'), retryable: false } }).handle;
    }
    const existing = handles.get(request.sessionId32);
    if (existing) return existing;
    const entryState = entryOf(entry, request.entryTxHash ?? null);
    if (entryState.status === 'none' && entryConfirmed) entryState.status = 'pending';
    const keepable = persistBody && stackedTextLength(request) <= RANKED_MAX_PERSISTED_BASE64;
    const persisted = keepable && persistEntry({
      sessionId32: request.sessionId32,
      gameId: request.gameId,
      wallet: String(request.identity.wallet ?? '').toLowerCase(),
      localScore: Number.isFinite(localScore) ? localScore : null,
      entry: entryState,
      savedAt: now(),
      body: request,
    });
    const created = track(createHandle({ request, localScore, entry: entryState, state: 'verifying', persisted }));
    void created.start(entryConfirmed);
    return created.handle;
  }

  // Re-drive every stored body after a reload (live only). Handles already
  // alive in this page are retried only when they stopped (saved-locally).
  function resume({ sessionId32 = null } = {}) {
    if (!live) return [];
    const out = [];
    for (const saved of readPending()) {
      if (sessionId32 && saved.sessionId32 !== sessionId32) continue;
      const alive = handles.get(saved.sessionId32);
      if (alive) {
        if (alive.state === 'saved-locally') void alive.retry();
        out.push(alive);
        continue;
      }
      const created = track(createHandle({ request: saved.body, localScore: saved.localScore, entry: saved.entry, state: 'verifying', persisted: true }));
      void created.start(null);
      out.push(created.handle);
    }
    reportCount();
    return out;
  }

  function get(sessionId32) {
    return handles.get(String(sessionId32 ?? '').toLowerCase()) ?? null;
  }

  // lesters:ranked-retry-request { sessionId32 | null } (§7.7): a specific id
  // retries that handle (or resumes its stored body after a reload); null
  // resumes everything stored.
  function handleRetryRequest(detail) {
    const id = detail?.sessionId32 ?? null;
    if (id === null || id === undefined) return resume();
    const key = String(id).toLowerCase();
    const handle = get(key);
    if (handle) {
      void handle.retry();
      return [handle];
    }
    return resume({ sessionId32: key });
  }

  if (live) reportCount(true);

  return Object.freeze({
    live: Boolean(live),
    settle,
    resume,
    get,
    handleRetryRequest,
    pendingCount: () => readPending().length,
    isPersisted,
  });
}
