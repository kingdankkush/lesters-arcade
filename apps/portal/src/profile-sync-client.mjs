// Browser side of the hosted profile (owner decisions 2026-09-16, contract §4.3.6,
// §7.6, guide §5.7): the wallet is the account, the server index owns every
// stat, and the browser syncs only preferences through /api/profile.
//
// Session tokens: this module stores the v2 Bearer token under
// SESSION_TOKEN_STORAGE_KEY and hands it out, but it never runs a sign-in of its
// own. The wallet session of §7.6 (signin-entry's wallet-session.mjs) asks
// /api/session/nonce for a server nonce, has the wallet sign that challenge and
// then calls login() here, so login() refuses any challenge whose nonce the
// server did not issue. A stored token that is not a v2 token for its wallet
// (for example one minted by the 1.7.0 site) is discarded on load, and any 401
// discards the token: v2 tokens are audience-bound and die when the server
// secret rotates.
//
// In the portal the Bearer token of pull() and push() comes from the wallet
// session (`getToken(wallet)`, which is walletSession.token), and a 401 also
// calls `onUnauthorized()` (walletSession.invalidate), so the whole page signs
// out together. Without `getToken` this store's own session is used.
//
// Pure module: fetch, storage and the clock are injected so the same code runs
// in the portal and in Node tests. Nothing here touches the wallet provider.

import { isServerNonce } from './wallet-auth.mjs';

export const SESSION_TOKEN_STORAGE_KEY = 'lesters-arcade-session-token';
export const PROFILE_PUSH_DEBOUNCE_MS = 1_500;
const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const CHARACTER_ID = /^[a-z0-9-]{1,32}$/;

const normalize = (wallet) => String(wallet ?? '').toLowerCase();

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

function unavailable(status, error) {
  return { ok: false, unavailable: status === 503, status, error: error ?? `http-${status}` };
}

function decodeBase64Url(text) {
  const normalized = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return typeof globalThis.atob === 'function' ? globalThis.atob(padded) : '';
}

// The wallet a v2 token names ('v2|<audience>|<wallet>|<expiresAt>' base64url,
// '.', MAC), or null for anything else. The MAC is the server's to check.
export function sessionTokenWallet(token) {
  if (typeof token !== 'string') return null;
  const [encoded, mac, extra] = token.split('.');
  if (!encoded || !mac || extra !== undefined) return null;
  try {
    const parts = decodeBase64Url(encoded).split('|');
    return parts.length === 4 && parts[0] === 'v2' && /^0x[a-f0-9]{40}$/.test(parts[2]) ? parts[2] : null;
  } catch {
    return null;
  }
}

// The E7 body: preferences only (§4.3.6). Names, avatars, xp, run counts,
// achievements and runs are never sent; the server derives them from verified
// sessions and PlayerProfileRegistry. Keys the player has not set are left out,
// and the server merges top-level keys, so this never erases cosmetics or the
// name-claim choice saved elsewhere.
export function buildProfileDocument(profile) {
  if (!profile || typeof profile !== 'object') throw new TypeError('profile is required');
  const preferences = {};
  const selected = profile.preferences?.selectedCharacterId;
  if (typeof selected === 'string' && CHARACTER_ID.test(selected)) preferences.selectedCharacterId = selected;
  return { preferences };
}

// Merge a GET /api/profile answer (E6 or the self view) into the local profile
// in place. Only the display name from PlayerProfileRegistry (as the index
// sanitized it; D3) and, from the self view, the saved hero preference come
// across. xp, rank, run counts, achievements and run history are never merged:
// the old document carried them from the browser, so anyone could forge them
// (guide §5.7), and they now live only in the server index.
export function mergeRemoteProfile(profile, remote) {
  if (!profile || typeof profile !== 'object') throw new TypeError('profile is required');
  if (!remote || typeof remote !== 'object') return { changed: false };
  let changed = false;
  const displayName = remote.profile?.displayName;
  if (typeof displayName === 'string' && displayName && (profile.handle !== displayName || profile.usernameSet !== true)) {
    profile.handle = displayName;
    profile.usernameSet = true;
    changed = true;
  }
  const selected = remote.preferences?.selectedCharacterId;
  if (typeof selected === 'string' && CHARACTER_ID.test(selected) && profile.preferences?.selectedCharacterId !== selected) {
    profile.preferences ??= {};
    profile.preferences.selectedCharacterId = selected;
    changed = true;
  }
  return { changed };
}

export function createProfileSync({
  fetchImpl = globalThis.fetch,
  storage = null,
  now = () => Date.now(),
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  endpoints = {},
  getToken = null,
  onUnauthorized = null,
} = {}) {
  const urls = { session: '/api/session', profile: '/api/profile', ...endpoints };
  let session = null;
  let pushTimer = null;
  let pendingDocument = null;
  const serviceState = { session: 'unknown', profile: 'unknown' };

  function store(value) {
    try {
      if (value) storage?.setItem?.(SESSION_TOKEN_STORAGE_KEY, JSON.stringify(value));
      else storage?.removeItem?.(SESSION_TOKEN_STORAGE_KEY);
    } catch { /* storage unavailable */ }
  }
  function readStored() {
    let raw = null;
    try { raw = storage?.getItem?.(SESSION_TOKEN_STORAGE_KEY) ?? null; } catch { return null; }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const wallet = normalize(parsed?.wallet);
      const live = parsed?.token && HEX_ADDRESS.test(wallet) && Number(parsed.expiresAt) > now();
      if (live && sessionTokenWallet(String(parsed.token)) === wallet) {
        return { wallet, token: String(parsed.token), expiresAt: Number(parsed.expiresAt) };
      }
    } catch { /* malformed: discarded below */ }
    store(null); // expired, malformed or pre-v2: never sent again
    return null;
  }
  session = readStored();

  const canFetch = () => typeof fetchImpl === 'function';

  function logout() {
    session = null;
    pendingDocument = null;
    if (pushTimer) { clearTimeoutImpl(pushTimer); pushTimer = null; }
    store(null);
  }

  // The last step of the §7.6 sign-in: exchange a signed, server-nonce SIWE
  // challenge for a session token. Called by the wallet session, never on its
  // own; a browser-made nonce is refused without a request.
  async function login({ challenge, signature } = {}) {
    if (!canFetch() || !challenge || !signature) return { ok: false, unavailable: true, error: 'no-fetch' };
    if (!isServerNonce(challenge.nonce)) return { ok: false, unavailable: false, error: 'nonce-not-server-issued' };
    let response;
    try {
      response = await fetchImpl(urls.session, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challenge, signature }),
        cache: 'no-store',
      });
    } catch (error) {
      return { ok: false, unavailable: true, error: 'network', detail: String(error?.message ?? error) };
    }
    const body = await readJson(response);
    // No Bearer token goes with this request, so a 401 here is about the new
    // signature or nonce (nonce-expired, nonce-used, signer-mismatch…), never
    // the stored token: a failed sign-in for one wallet keeps another's token.
    if (!response.ok || !body?.ok || !body.token) {
      serviceState.session = response.status === 503 ? 'unconfigured' : 'error';
      return unavailable(response.status, body?.error);
    }
    const wallet = normalize(body.wallet);
    if (sessionTokenWallet(String(body.token)) !== wallet) {
      serviceState.session = 'error';
      return { ok: false, unavailable: false, status: response.status, error: 'invalid-token' };
    }
    session = { wallet, token: String(body.token), expiresAt: Number(body.expiresAt) };
    store(session);
    serviceState.session = 'ready';
    return { ok: true, ...session };
  }

  function sessionFor(wallet) {
    if (!session || session.expiresAt <= now()) return null;
    if (wallet && normalize(wallet) !== session.wallet) return null;
    return session;
  }

  // The Bearer token for `wallet` (the stored session's wallet when null), or
  // null: from the injected wallet session when there is one, else this
  // store's session. Only a v2 token naming that wallet is ever sent.
  function bearerFor(wallet) {
    const who = wallet ? normalize(wallet) : session?.wallet ?? null;
    if (!who || !HEX_ADDRESS.test(who)) return null;
    let token = null;
    if (typeof getToken === 'function') {
      try { token = getToken(who); } catch { token = null; }
    } else {
      token = sessionFor(who)?.token ?? null;
    }
    return typeof token === 'string' && sessionTokenWallet(token) === who ? token : null;
  }

  // A 401 on a Bearer call: the token is dead everywhere, not just here.
  function unauthorized() {
    logout();
    try { onUnauthorized?.(); } catch { /* the caller's cleanup must not mask the answer */ }
  }

  // GET /api/profile in the E6 shape. With a live token for this wallet it
  // reads the private self view (preferences, blocked-name reason, every run
  // status); a 401 there discards the token and falls back to the public view.
  async function pull(wallet, { anonymous = false } = {}) {
    if (!canFetch() || !HEX_ADDRESS.test(String(wallet ?? ''))) return { ok: false, unavailable: true, error: 'invalid-wallet' };
    const who = normalize(wallet);
    const own = anonymous ? null : bearerFor(who);
    const init = own
      ? { method: 'GET', headers: { accept: 'application/json', authorization: `Bearer ${own}` }, cache: 'no-store' }
      : { method: 'GET', headers: { accept: 'application/json' } };
    let response;
    try {
      response = await fetchImpl(`${urls.profile}?wallet=${who}${own ? '&self=1' : ''}`, init);
    } catch (error) {
      return { ok: false, unavailable: true, error: 'network', detail: String(error?.message ?? error) };
    }
    const body = await readJson(response);
    if (own && response.status === 401) {
      unauthorized();
      return pull(who, { anonymous: true });
    }
    if (!response.ok || !body?.ok) {
      serviceState.profile = response.status === 503 ? 'unconfigured' : 'error';
      return unavailable(response.status, body?.error);
    }
    serviceState.profile = 'ready';
    return {
      ok: true,
      self: Boolean(own),
      wallet: normalize(body.wallet),
      profile: body.profile ?? null,
      games: body.games ?? null,
      recentSessions: Array.isArray(body.recentSessions) ? body.recentSessions : [],
      achievements: Array.isArray(body.achievements) ? body.achievements : [],
      preferences: own ? body.preferences ?? null : null,
      updatedAt: body.updatedAt ?? null,
    };
  }

  async function pushNow(document, { wallet = null } = {}) {
    if (pushTimer) { clearTimeoutImpl(pushTimer); pushTimer = null; }
    pendingDocument = null;
    const bearer = bearerFor(wallet);
    if (!canFetch() || !bearer) return { ok: false, unavailable: true, error: 'no-session' };
    let response;
    try {
      response = await fetchImpl(urls.profile, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
        body: JSON.stringify(document),
        cache: 'no-store',
      });
    } catch (error) {
      return { ok: false, unavailable: true, error: 'network', detail: String(error?.message ?? error) };
    }
    const body = await readJson(response);
    if (response.status === 401) { unauthorized(); return { ok: false, unavailable: false, status: 401, error: 'invalid-session' }; }
    if (!response.ok || !body?.ok) {
      serviceState.profile = response.status === 503 ? 'unconfigured' : 'error';
      return unavailable(response.status, body?.error);
    }
    serviceState.profile = 'ready';
    return { ok: true, wallet: normalize(body.wallet), preferences: body.preferences ?? null, updatedAt: body.updatedAt ?? null };
  }

  // Debounced write: the last document wins, one PUT per burst of edits.
  function push(document, { wallet = null, delayMs = PROFILE_PUSH_DEBOUNCE_MS } = {}) {
    if (!bearerFor(wallet) || serviceState.profile === 'unconfigured') return false;
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

  return Object.freeze({
    login, logout, pull, push, pushNow, flush,
    get session() { return sessionFor(null); },
    hasSession: (wallet) => Boolean(sessionFor(wallet)),
    tokenFor: (wallet) => sessionFor(wallet)?.token ?? null,
    serviceState: () => ({ ...serviceState }),
  });
}
