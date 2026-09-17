// Browser side of the hosted-profile and relayed-settlement services (owner
// decisions 2026-09-16): the wallet is the account, profiles follow it across
// devices through /api/profile behind a SIWE session token from /api/session,
// and Ranked runs are settled for the player by /api/settle. Every call is
// best-effort: a 503 means the service is not configured yet and the browser
// keeps working from local storage exactly as before.
//
// Pure module: fetch, storage and the clock are injected so the same code runs
// in the portal and in Node tests. Nothing here touches the wallet provider.

export const SESSION_TOKEN_STORAGE_KEY = 'lesters-arcade-session-token';
export const PROFILE_PUSH_DEBOUNCE_MS = 1_500;
const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const RUN_LIMIT = 50;

const normalize = (wallet) => String(wallet ?? '').toLowerCase();

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

function unavailable(status, error) {
  return { ok: false, unavailable: status === 503, status, error: error ?? `http-${status}` };
}

// Bounded, public document for /api/profile. Mirrors the server's
// sanitizeProfileDocument so a round trip is lossless for the fields that
// matter across devices. Runs are the wallet's own, newest first.
export function buildProfileDocument(profile, runHistory = []) {
  if (!profile || typeof profile !== 'object') throw new TypeError('profile is required');
  const wallet = normalize(profile.wallet);
  const runs = (Array.isArray(runHistory) ? runHistory : [])
    .filter((run) => run?.sessionId && run.gameId && normalize(run.wallet) === wallet)
    .slice(0, RUN_LIMIT)
    .map((run) => ({
      sessionId: String(run.sessionId), gameId: String(run.gameId), mode: String(run.mode ?? 'ranked'),
      score: Math.max(0, Math.round(Number(run.score) || 0)), recordedAt: String(run.recordedAt ?? ''),
      kills: Math.max(0, Math.round(Number(run.kills ?? run.runStats?.kills) || 0)),
      elapsedSeconds: Math.max(0, Math.round(Number(run.elapsedSeconds ?? run.survivalSeconds ?? run.runStats?.survivalSeconds) || 0)),
      envelopeHash: /^[0-9a-f]{64}$/i.test(String(run.envelopeHash ?? '')) ? String(run.envelopeHash).toLowerCase() : null,
    }));
  return {
    handle: String(profile.handle ?? ''),
    avatar: String(profile.avatar ?? ''),
    xp: Math.max(0, Math.round(Number(profile.xp) || 0)),
    rank: String(profile.rank ?? ''),
    totalPaidRuns: Math.max(0, Math.round(Number(profile.totalPaidRuns) || 0)),
    totalFreeRuns: Math.max(0, Math.round(Number(profile.totalFreeRuns) || 0)),
    achievements: [...new Set((profile.achievements ?? []).map(String))],
    runHistory: runs,
    preferences: { usernameSet: Boolean(profile.usernameSet), selectedCharacterId: profile.preferences?.selectedCharacterId ?? null },
  };
}

// Merge a remote document into the local profile in place. Progress only ever
// grows (max / union), so two devices can never erase each other's runs; the
// display identity follows whichever side the player actually customised.
// Returns the run records that were missing locally so the caller can append
// them to state.runHistory.
export function mergeRemoteProfile(profile, remote, localRuns = []) {
  if (!profile || typeof profile !== 'object') throw new TypeError('profile is required');
  if (!remote || typeof remote !== 'object') return { changed: false, missingRuns: [] };
  let changed = false;
  const set = (key, value) => { if (profile[key] !== value) { profile[key] = value; changed = true; } };
  const remoteCustomised = Boolean(remote.preferences?.usernameSet);
  const localCustomised = Boolean(profile.usernameSet);
  if (remote.handle && !localCustomised) {
    set('handle', remote.handle);
    if (remoteCustomised) set('usernameSet', true);
  }
  if (remote.avatar && !localCustomised) set('avatar', remote.avatar);
  const localXp = Number(profile.xp) || 0;
  for (const key of ['xp', 'totalPaidRuns', 'totalFreeRuns']) {
    const value = Math.max(Number(profile[key]) || 0, Math.round(Number(remote[key]) || 0));
    set(key, value);
  }
  if (remote.rank && (Number(remote.xp) || 0) > localXp) set('rank', remote.rank);
  const achievements = new Set(profile.achievements ?? []);
  const before = achievements.size;
  for (const id of remote.achievements ?? []) achievements.add(String(id));
  if (achievements.size !== before) { profile.achievements = [...achievements]; changed = true; }
  const known = new Set((Array.isArray(localRuns) ? localRuns : []).map((run) => String(run?.sessionId ?? '')));
  const missingRuns = (Array.isArray(remote.runHistory) ? remote.runHistory : [])
    .filter((run) => run?.sessionId && run.gameId && !known.has(String(run.sessionId)))
    .map((run) => ({ ...run, wallet: profile.wallet, status: run.status ?? 'synced-from-profile' }));
  if (missingRuns.length) changed = true;
  return { changed, missingRuns };
}

export function createProfileSync({
  fetchImpl = globalThis.fetch,
  storage = null,
  now = () => Date.now(),
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  endpoints = {},
} = {}) {
  const urls = { session: '/api/session', profile: '/api/profile', settle: '/api/settle', ...endpoints };
  let session = null;
  let pushTimer = null;
  let pendingDocument = null;
  let serviceState = { session: 'unknown', profile: 'unknown', settle: 'unknown' };

  function readStored() {
    try {
      const raw = storage?.getItem?.(SESSION_TOKEN_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.token || !HEX_ADDRESS.test(parsed.wallet ?? '') || Number(parsed.expiresAt) <= now()) return null;
      return { wallet: normalize(parsed.wallet), token: String(parsed.token), expiresAt: Number(parsed.expiresAt) };
    } catch { return null; }
  }
  function store(value) {
    try {
      if (value) storage?.setItem?.(SESSION_TOKEN_STORAGE_KEY, JSON.stringify(value));
      else storage?.removeItem?.(SESSION_TOKEN_STORAGE_KEY);
    } catch { /* storage unavailable */ }
  }
  session = readStored();

  const canFetch = () => typeof fetchImpl === 'function';

  async function login({ challenge, signature } = {}) {
    if (!canFetch() || !challenge || !signature) return { ok: false, unavailable: true, error: 'no-fetch' };
    let response;
    try {
      response = await fetchImpl(urls.session, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challenge, signature }) });
    } catch (error) {
      return { ok: false, unavailable: true, error: 'network', detail: String(error?.message ?? error) };
    }
    const body = await readJson(response);
    if (!response.ok || !body?.ok || !body.token) {
      serviceState.session = response.status === 503 ? 'unconfigured' : 'error';
      return unavailable(response.status, body?.error);
    }
    session = { wallet: normalize(body.wallet), token: String(body.token), expiresAt: Number(body.expiresAt) };
    store(session);
    serviceState.session = 'ready';
    return { ok: true, ...session };
  }

  function sessionFor(wallet) {
    if (!session || session.expiresAt <= now()) return null;
    if (wallet && normalize(wallet) !== session.wallet) return null;
    return session;
  }

  function logout() {
    session = null;
    pendingDocument = null;
    if (pushTimer) { clearTimeoutImpl(pushTimer); pushTimer = null; }
    store(null);
  }

  async function pull(wallet) {
    if (!canFetch() || !HEX_ADDRESS.test(String(wallet ?? ''))) return { ok: false, unavailable: true, error: 'invalid-wallet' };
    let response;
    try {
      response = await fetchImpl(`${urls.profile}?wallet=${normalize(wallet)}`, { method: 'GET', headers: { accept: 'application/json' } });
    } catch (error) {
      return { ok: false, unavailable: true, error: 'network', detail: String(error?.message ?? error) };
    }
    const body = await readJson(response);
    if (!response.ok || !body?.ok) {
      serviceState.profile = response.status === 503 ? 'unconfigured' : 'error';
      return unavailable(response.status, body?.error);
    }
    serviceState.profile = 'ready';
    return { ok: true, wallet: normalize(body.wallet), profile: body.profile ?? null, updatedAt: body.updatedAt ?? null };
  }

  async function pushNow(document, { wallet = null } = {}) {
    if (pushTimer) { clearTimeoutImpl(pushTimer); pushTimer = null; }
    pendingDocument = null;
    const active = sessionFor(wallet);
    if (!canFetch() || !active) return { ok: false, unavailable: true, error: 'no-session' };
    let response;
    try {
      response = await fetchImpl(urls.profile, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${active.token}` }, body: JSON.stringify(document) });
    } catch (error) {
      return { ok: false, unavailable: true, error: 'network', detail: String(error?.message ?? error) };
    }
    const body = await readJson(response);
    if (response.status === 401) { logout(); return { ok: false, unavailable: false, status: 401, error: 'invalid-session' }; }
    if (!response.ok || !body?.ok) {
      serviceState.profile = response.status === 503 ? 'unconfigured' : 'error';
      return unavailable(response.status, body?.error);
    }
    serviceState.profile = 'ready';
    return { ok: true, wallet: normalize(body.wallet), updatedAt: body.updatedAt ?? null };
  }

  // Debounced write: the last document wins, one PUT per burst of edits.
  function push(document, { wallet = null, delayMs = PROFILE_PUSH_DEBOUNCE_MS } = {}) {
    if (!sessionFor(wallet) || serviceState.profile === 'unconfigured') return false;
    pendingDocument = document;
    if (pushTimer) clearTimeoutImpl(pushTimer);
    pushTimer = setTimeoutImpl(() => {
      pushTimer = null;
      const next = pendingDocument;
      pendingDocument = null;
      if (next) pushNow(next, { wallet }).catch(() => {});
    }, delayMs);
    return true;
  }

  async function flush(wallet = null) {
    if (!pendingDocument) return { ok: true, skipped: true };
    return pushNow(pendingDocument, { wallet });
  }

  // Relayed settlement. Resolves with the service body when the relayer sent
  // the transaction ({relayed: true, txHash}) or when only an attestation came
  // back ({relayed: false, signature, ...}) so the caller can submit from the
  // player's wallet. Throws with a player-readable message otherwise.
  async function settle(payload) {
    if (!canFetch()) throw new Error('The settlement service is unavailable in this environment.');
    const response = await fetchImpl(urls.settle, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await readJson(response);
    if (response.ok && body?.ok) { serviceState.settle = 'ready'; return body; }
    const error = body?.error ?? `settle-http-${response.status}`;
    if (response.status === 409) throw Object.assign(new Error('This run was already settled on-chain.'), { code: 'session-already-settled' });
    if (response.status === 422) throw Object.assign(new Error('The trusted verifier declined this run as implausible, so it was not published.'), { code: error });
    if (error === 'verifier-not-configured') throw Object.assign(new Error('The trusted verifier is not configured yet, so this run cannot be published on-chain.'), { code: error });
    if (error === 'relayer-not-allowed') throw Object.assign(new Error('The settlement relayer is not authorised on the registry yet.'), { code: error });
    if (error === 'relay-failed' && body?.attestation) {
      // The verifier signed the run but the relay broke: hand the attestation
      // back so the player can still submit it themselves.
      return { ...body.attestation, ok: true, relayed: false, txHash: null, relayError: body.detail ?? null };
    }
    throw Object.assign(new Error(`The settlement service declined this run (${error}).`), { code: error });
  }

  return Object.freeze({
    login, logout, pull, push, pushNow, flush, settle,
    get session() { return sessionFor(null); },
    hasSession: (wallet) => Boolean(sessionFor(wallet)),
    serviceState: () => ({ ...serviceState }),
  });
}
