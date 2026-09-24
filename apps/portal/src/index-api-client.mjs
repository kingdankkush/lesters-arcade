// Browser client for the verified-session index (contract §7.8): E5 leaderboards,
// E6 profiles (public and the Bearer self view), E7 preferences, E8 refresh,
// E9 sessions and the D10 retry of a stored settle.
//
// Pure module: fetch and the token are injected, so the same code runs in the
// portal and in Node tests. With `hosted` false (HOSTED_PROFILE_SYNC off) every
// method answers { ok:false, error:'offline-preview' } without a request, so a
// preview build makes no /api call at all (A22, §9.1).
//
// The Bearer token comes from the wallet session (§7.6): signin-entry signs in
// and profileSync stores the v2 token; this client only reads it through
// getToken() and never logs in. A 401 means the token is dead (v2 tokens are
// audience-bound and die at a secret rotation), so onUnauthorized(wallet,
// refusedToken) discards it, unless a newer sign-in has already replaced it.

export const INDEX_API_ENDPOINTS = Object.freeze({
  leaderboard: '/api/leaderboard',
  profile: '/api/profile',
  refresh: '/api/profile/refresh',
  session: '/api/session/',
  settle: '/api/settle',
});
export const INDEX_LEADERBOARD_PERIODS = Object.freeze(['weekly', 'monthly', 'all-time', 'daily']);
export const INDEX_LEADERBOARD_MAX_PAGE = 400;
export const INDEX_SEARCH_MAX_LENGTH = 32;
export const RANKED_SETTLE_RETRY_VERSION = 'lesters-ranked-settle-v1';

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SESSION_ID32 = /^0x[0-9a-fA-F]{64}$/;
const SHARE_ID = /^(?:0x)?[0-9a-fA-F]{64}$/;
const OFFLINE = Object.freeze({ ok: false, error: 'offline-preview' });

const walletOf = (value) => (HEX_ADDRESS.test(String(value ?? '')) ? String(value).toLowerCase() : null);

function decodeBase64Url(text) {
  const normalized = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof globalThis.atob === 'function') return globalThis.atob(padded);
  return null;
}

// The wallet a v2 session token was issued to ('v2|<audience>|<wallet>|<expiresAt>',
// base64url, then '.', then the MAC). The payload is not secret; the MAC is the
// server's to check. Anything else, including a 1.7.0 v1 token, gives null.
export function tokenWallet(token) {
  if (typeof token !== 'string') return null;
  const [encoded, mac, extra] = token.split('.');
  if (!encoded || !mac || extra !== undefined) return null;
  try {
    const parts = String(decodeBase64Url(encoded) ?? '').split('|');
    if (parts.length !== 4 || parts[0] !== 'v2') return null;
    return /^0x[a-f0-9]{40}$/.test(parts[2]) ? parts[2] : null;
  } catch {
    return null;
  }
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

// A Retry-After header (429 rate-limited) in milliseconds, or null. Seconds
// or an HTTP date.
function retryAfterHeaderMs(response, nowMs = Date.now()) {
  let value = null;
  try { value = response?.headers?.get?.('retry-after') ?? null; } catch { value = null; }
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  const at = Date.parse(text);
  return Number.isFinite(at) ? Math.max(0, at - nowMs) : null;
}

export function createIndexApiClient({
  hosted = false,
  fetchImpl = globalThis.fetch,
  getToken = () => null,
  onUnauthorized = null,
} = {}) {
  const live = hosted === true && typeof fetchImpl === 'function';
  const token = () => {
    try {
      const value = getToken?.();
      return typeof value === 'string' && value ? value : null;
    } catch {
      return null;
    }
  };

  async function send(url, init, { bearer = null } = {}) {
    let response;
    try {
      response = await fetchImpl(url, init);
    } catch {
      return { ok: false, error: 'network', retryable: true };
    }
    const body = await readJson(response);
    if (response.status === 401 && bearer) {
      try { onUnauthorized?.(tokenWallet(bearer), bearer); } catch { /* the caller's cleanup must not mask the answer */ }
    }
    if (!response.ok || !body || body.ok !== true) {
      const out = { ok: false, status: response.status, error: typeof body?.error === 'string' ? body.error : `http-${response.status}` };
      if (body?.retryable === true) out.retryable = true;
      const retryAfterMs = Number.isFinite(body?.retryAfterMs) ? body.retryAfterMs : retryAfterHeaderMs(response);
      if (Number.isFinite(retryAfterMs)) out.retryAfterMs = retryAfterMs;
      return out;
    }
    // A success body is returned as the server sent it: a SettleResponse
    // carries its own `status` field, which must not be overwritten.
    return { ...body, ok: true };
  }

  const json = { accept: 'application/json' };

  // E5. Only declared parameters are sent: the API answers 400 to anything else.
  async function leaderboard({ game, period = 'weekly', periodKey = null, page = 1, q = '', wallet = null } = {}) {
    if (!live) return OFFLINE;
    const params = new URLSearchParams();
    const gameText = String(game ?? '').trim();
    if (!gameText) return { ok: false, error: 'invalid-game' };
    if (!INDEX_LEADERBOARD_PERIODS.includes(period)) return { ok: false, error: 'invalid-period' };
    const pageNumber = Number(page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > INDEX_LEADERBOARD_MAX_PAGE) return { ok: false, error: 'invalid-page' };
    params.set('game', gameText);
    params.set('period', period);
    if (periodKey) params.set('periodKey', String(periodKey));
    if (pageNumber > 1) params.set('page', String(pageNumber));
    const search = String(q ?? '').trim().slice(0, INDEX_SEARCH_MAX_LENGTH);
    if (search) params.set('q', search);
    const viewer = walletOf(wallet);
    if (viewer) params.set('wallet', viewer);
    return send(`${INDEX_API_ENDPOINTS.leaderboard}?${params}`, { method: 'GET', headers: json });
  }

  // E6 and E6s. The self view is a distinct URL (never the CDN-cached public
  // body), sends the Bearer token and is never cached; the public URL never
  // carries a token or preferences.
  async function profile(wallet, { self = false } = {}) {
    if (!live) return OFFLINE;
    const who = walletOf(wallet);
    if (!who) return { ok: false, error: 'invalid-wallet' };
    if (!self) return send(`${INDEX_API_ENDPOINTS.profile}?wallet=${who}`, { method: 'GET', headers: json });
    const bearer = token();
    if (!bearer || tokenWallet(bearer) !== who) return { ok: false, error: 'sign-in-required' };
    return send(`${INDEX_API_ENDPOINTS.profile}?wallet=${who}&self=1`, {
      method: 'GET',
      headers: { ...json, authorization: `Bearer ${bearer}` },
      cache: 'no-store',
    }, { bearer });
  }

  // E8. The Bearer token goes only with the signed-in wallet's own refresh,
  // which spends that wallet's bucket instead of the shared IP bucket.
  async function refreshProfile(wallet) {
    if (!live) return OFFLINE;
    const who = walletOf(wallet);
    if (!who) return { ok: false, error: 'invalid-wallet' };
    const bearer = token();
    const own = Boolean(bearer) && tokenWallet(bearer) === who;
    return send(`${INDEX_API_ENDPOINTS.refresh}?wallet=${who}`, {
      method: 'POST',
      headers: own ? { ...json, authorization: `Bearer ${bearer}` } : json,
      cache: 'no-store',
    }, { bearer: own ? bearer : null });
  }

  // E7. Preferences only; the server merges top-level keys.
  async function savePreferences(preferences) {
    if (!live) return OFFLINE;
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return { ok: false, error: 'invalid-body' };
    const bearer = token();
    if (!bearer) return { ok: false, error: 'sign-in-required' };
    return send(INDEX_API_ENDPOINTS.profile, {
      method: 'PUT',
      headers: { ...json, 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ preferences }),
      cache: 'no-store',
    }, { bearer });
  }

  // E9.
  async function session(shareId) {
    if (!live) return OFFLINE;
    const id = String(shareId ?? '');
    if (!SHARE_ID.test(id)) return { ok: false, error: 'invalid-session-id' };
    return send(`${INDEX_API_ENDPOINTS.session}${id.replace(/^0x/, '').toLowerCase()}`, { method: 'GET', headers: json });
  }

  // D10 retry of a stored settle (E3 retry body): one submission attempt when
  // the row allows it, otherwise the current SettleResponse.
  async function retrySettle(sessionId32) {
    if (!live) return OFFLINE;
    const id = String(sessionId32 ?? '');
    if (!SESSION_ID32.test(id)) return { ok: false, error: 'invalid-session-id' };
    const bearer = token();
    if (!bearer) return { ok: false, error: 'sign-in-required' };
    return send(INDEX_API_ENDPOINTS.settle, {
      method: 'POST',
      headers: { ...json, 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ v: RANKED_SETTLE_RETRY_VERSION, sessionId32: id.toLowerCase(), retry: true }),
      cache: 'no-store',
    }, { bearer });
  }

  return Object.freeze({ hosted: live, leaderboard, profile, refreshProfile, savePreferences, session, retrySettle });
}

// ---------------------------------------------------------------------------
// D10 retry routing (§7.8): ranked-client or E3's retry body, never both.
// ---------------------------------------------------------------------------

// ranked-client (§7.2) keeps each unpublished settle body under this key until
// the run is published, rejected or practice.
export const RANKED_PENDING_STORAGE_KEY = 'lesters-arcade-ranked-pending-v1';
const RANKED_TERMINAL_STATES = new Set(['preview', 'published', 'rejected', 'practice']);
const MAX_TRACKED_HANDLES = 20;

// Which runs ranked-client holds. A profile Retry for a held run dispatches
// lesters:ranked-retry-request (ranked-client retries its handle, or resumes
// the stored body); any other run is retried through E3's retry body
// (retrySettle). Sending both would race two POSTs on the relayer lease.
//
// ranked-client answers the event only while settlement is live (its listener
// ignores it otherwise, and it never acknowledges it), so a run is held only
// when `live` and either its handle is alive in this page (every handle is
// announced by lesters:ranked-run, which track() records) or its body is
// stored on this device under RANKED_PENDING_STORAGE_KEY.
export function createRankedRunHoldings({ live = false, storage = null, pendingKey = RANKED_PENDING_STORAGE_KEY } = {}) {
  const handles = new Map();
  const idOf = (value) => (SESSION_ID32.test(String(value ?? '')) ? String(value).toLowerCase() : null);

  function storedIds() {
    try {
      const raw = storage?.getItem?.(pendingKey) ?? null;
      const list = raw ? JSON.parse(raw) : [];
      return new Set((Array.isArray(list) ? list : []).map((entry) => idOf(entry?.sessionId32)).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  // lesters:ranked-run detail ({ handle, context }).
  function track(detail) {
    const handle = detail?.handle ?? null;
    let id = null;
    try { id = idOf(handle?.sessionId32 ?? detail?.context?.sessionId32); } catch { id = null; }
    if (!id || !handle) return;
    handles.delete(id);
    handles.set(id, handle);
    while (handles.size > MAX_TRACKED_HANDLES) handles.delete(handles.keys().next().value);
  }

  function holds(sessionId32) {
    if (live !== true) return false;
    const id = idOf(sessionId32);
    if (!id) return false;
    const handle = handles.get(id);
    if (handle) {
      let state = null;
      try { state = handle.state ?? handle.snapshot?.state ?? null; } catch { state = null; }
      if (typeof state === 'string' && !RANKED_TERMINAL_STATES.has(state)) return true;
    }
    return storedIds().has(id);
  }

  return Object.freeze({ track, holds });
}
