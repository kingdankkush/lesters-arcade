// Wallet session and sign-in (contract §7.6, A13; guide §3.1, §5.9).
//
// One place decides whether the connected wallet is signed in:
//   - hosted (HOSTED_PROFILE_SYNC): a server nonce from GET /api/session/nonce,
//     a plain-language SIWE message using the server's issuedAt, one
//     personal_sign, then POST /api/session through profileSync.login. The
//     24 h Bearer token it returns is stored by profileSync under
//     'lesters-arcade-session-token'.
//   - preview (flag off): today's local challenge, checked with
//     ethers.verifyMessage, and no network at all. A local flag lets a reload
//     restore the preview sign-in without a new signature.
// A returning player is restored silently (restore): eth_accounts, never
// eth_requestAccounts, plus a live token for the same wallet.
//
// Pure module: fetch, storage, the clock, ethers, profileSync and the event
// target are injected, so the browser and Node tests run the same code.

import { buildSiweChallenge, classifyWalletError, isValidLogin, shortWalletMessage } from './wallet-auth.mjs';

export const WALLET_CONNECTOR_STORAGE_KEY = 'lesters-arcade-wallet-connector-v1';   // { kind:'eip6963'|'walletconnect'|'legacy', rdns|null, wallet }
export const LOCAL_WALLET_SESSION_STORAGE_KEY = 'lesters-arcade-local-wallet-session-v1'; // preview only: { wallet, expiresAt }
export const WALLET_SESSION_EVENT = 'lesters:wallet-session';
export const SESSION_NONCE_ENDPOINT = '/api/session/nonce';
export const LOCAL_WALLET_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const WALLET_CONNECTOR_KINDS = Object.freeze(['eip6963', 'walletconnect', 'legacy']);

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SERVER_NONCE = /^[0-9a-f]{72}$/;
const lower = (value) => String(value ?? '').toLowerCase();

function readJson(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(storage, key, value) {
  try {
    if (value === null) storage?.removeItem?.(key);
    else storage?.setItem?.(key, JSON.stringify(value));
  } catch { /* storage unavailable (private mode) */ }
}

function base64UrlDecode(text) {
  const normalized = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof globalThis.atob === 'function') return globalThis.atob(padded);
  return Buffer.from(padded, 'base64').toString('binary');
}

// Session tokens are `base64url(payload).mac` and v2 payloads start with 'v2|'
// (contract A13). A token minted by the 1.7.0 flow ('wallet|expiresAt') can
// never verify on a 1.8.0 server, so it is discarded instead of being sent.
export function isV2SessionToken(token) {
  if (typeof token !== 'string') return false;
  const [encoded, mac, extra] = token.split('.');
  if (!encoded || !mac || extra !== undefined) return false;
  try {
    return base64UrlDecode(encoded).startsWith('v2|');
  } catch {
    return false;
  }
}

function defaultEventTarget() {
  const target = globalThis.window ?? globalThis;
  return typeof target?.dispatchEvent === 'function' ? target : null;
}

function makeEvent(detail) {
  if (typeof globalThis.CustomEvent === 'function') return new globalThis.CustomEvent(WALLET_SESSION_EVENT, { detail });
  const event = new Event(WALLET_SESSION_EVENT);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

function failure(kind, message, wallet = null) {
  return Object.freeze({ ok: false, wallet, authenticated: false, token: null, expiresAt: null, error: Object.freeze({ kind, message }) });
}

export function createWalletSession({
  hosted = false,
  fetchImpl = globalThis.fetch,
  storage = null,
  now = () => Date.now(),
  profileSync = null,
  loadEthers = null,
  domain = globalThis.location?.hostname ?? 'lestersarcade.io',
  chainId = 4441,
  eventTarget = defaultEventTarget(),
  nonceEndpoint = SESSION_NONCE_ENDPOINT,
} = {}) {
  let lastAnnounced = null;

  function announce({ wallet = null, authenticated = false } = {}) {
    const detail = Object.freeze({ wallet: wallet ? lower(wallet) : null, authenticated: Boolean(authenticated) });
    lastAnnounced = detail;
    try { eventTarget?.dispatchEvent?.(makeEvent(detail)); } catch { /* no event target */ }
    return detail;
  }

  function localSession(wallet) {
    const stored = readJson(storage, LOCAL_WALLET_SESSION_STORAGE_KEY);
    if (!stored || !HEX_ADDRESS.test(String(stored.wallet ?? '')) || !(Number(stored.expiresAt) > now())) return null;
    if (wallet && lower(wallet) !== lower(stored.wallet)) return null;
    return { wallet: lower(stored.wallet), expiresAt: Number(stored.expiresAt) };
  }

  // The hosted token for `wallet`, or null, read from the token store with
  // profileSync.tokenFor(wallet) (contract §7.6): the store answers only for
  // the wallet its live token was issued to. A pre-v2 token is dropped here
  // too, so no caller ever sends one, whatever the store offers.
  function hostedSession(wallet) {
    if (!HEX_ADDRESS.test(String(wallet ?? ''))) return null;
    let token = null;
    try { token = profileSync?.tokenFor?.(lower(wallet)) ?? null; } catch { token = null; }
    if (typeof token !== 'string' || !token) return null;
    if (!isV2SessionToken(token)) {
      try { profileSync.logout?.(); } catch { /* ignore */ }
      return null;
    }
    return { wallet: lower(wallet), token };
  }

  function isAuthenticated(wallet) {
    if (!HEX_ADDRESS.test(String(wallet ?? ''))) return false;
    return hosted ? Boolean(hostedSession(wallet)) : Boolean(localSession(wallet));
  }

  function token(wallet) {
    if (!hosted || !HEX_ADDRESS.test(String(wallet ?? ''))) return null;
    return hostedSession(wallet)?.token ?? null;
  }

  function remember({ kind, rdns = null, wallet } = {}) {
    if (!WALLET_CONNECTOR_KINDS.includes(kind) || !HEX_ADDRESS.test(String(wallet ?? ''))) return;
    writeJson(storage, WALLET_CONNECTOR_STORAGE_KEY, { kind, rdns: typeof rdns === 'string' && rdns ? rdns : null, wallet: lower(wallet) });
  }

  function remembered() {
    const stored = readJson(storage, WALLET_CONNECTOR_STORAGE_KEY);
    if (!stored || !WALLET_CONNECTOR_KINDS.includes(stored.kind) || !HEX_ADDRESS.test(String(stored.wallet ?? ''))) return null;
    return Object.freeze({ kind: stored.kind, rdns: typeof stored.rdns === 'string' && stored.rdns ? stored.rdns : null, wallet: lower(stored.wallet) });
  }

  async function fetchServerNonce() {
    if (typeof fetchImpl !== 'function') return { ok: false, error: 'no-fetch' };
    let response;
    try {
      response = await fetchImpl(nonceEndpoint, { method: 'GET', cache: 'no-store', headers: { accept: 'application/json' } });
    } catch {
      return { ok: false, error: 'network' };
    }
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok || !body?.ok || !SERVER_NONCE.test(String(body.nonce ?? '')) || !Number.isFinite(Date.parse(body.issuedAt ?? ''))) {
      return { ok: false, error: body?.error ?? `http-${response.status}`, status: response.status };
    }
    return { ok: true, nonce: body.nonce, issuedAt: body.issuedAt };
  }

  async function requestSignature(provider, challenge, address) {
    try {
      const signature = await provider.request({ method: 'personal_sign', params: [challenge.message, address] });
      return { ok: true, signature };
    } catch (error) {
      const classified = classifyWalletError(error);
      return { ok: false, kind: classified.kind, message: classified.kind === 'user-cancelled' ? 'You cancelled the sign-in in your wallet.' : shortWalletMessage(classified.message) };
    }
  }

  // `address` is the account exactly as the wallet returned it (usually
  // checksummed): the signed message carries it verbatim and the server
  // rebuilds the message from that line.
  async function signIn({ provider, address } = {}) {
    if (!provider?.request) return failure('missing-wallet', 'No wallet is connected.');
    if (!HEX_ADDRESS.test(String(address ?? ''))) return failure('wallet-error', 'The wallet returned no account.');
    const wallet = lower(address);

    if (hosted) {
      const nonce = await fetchServerNonce();
      if (!nonce.ok) {
        announce({ wallet, authenticated: false });
        return failure('service-unavailable', 'Sign-in is unavailable right now. Free Mode still works.', wallet);
      }
      const challenge = buildSiweChallenge({ domain, address, chainId, nonce: nonce.nonce, issuedAt: nonce.issuedAt });
      const signed = await requestSignature(provider, challenge, address);
      if (!signed.ok) {
        announce({ wallet, authenticated: false });
        return failure(signed.kind, signed.message, wallet);
      }
      const login = await profileSync.login({ challenge, signature: signed.signature });
      if (!login?.ok || lower(login.wallet) !== wallet) {
        // A token issued for any other wallet is never kept.
        if (login?.ok) { try { profileSync.logout?.(); } catch { /* ignore */ } }
        announce({ wallet, authenticated: false });
        // The service being down is not the player's doing; a refused
        // signature (401, another wallet) is a wallet error they can retry.
        return login?.unavailable
          ? failure('service-unavailable', 'Sign-in is unavailable right now. Free Mode still works.', wallet)
          : failure('wallet-error', 'The arcade could not verify that signature. Try again.', wallet);
      }
      const result = Object.freeze({ ok: true, wallet, authenticated: true, token: login.token, expiresAt: login.expiresAt });
      announce({ wallet, authenticated: true });
      return result;
    }

    // Preview: no network. The signature must recover to the challenged address.
    const challenge = buildSiweChallenge({ domain, address, chainId, issuedAt: new Date(now()).toISOString() });
    const signed = await requestSignature(provider, challenge, address);
    if (!signed.ok) {
      announce({ wallet, authenticated: false });
      return failure(signed.kind, signed.message, wallet);
    }
    let ok = false;
    try {
      const ethers = await loadEthers();
      ok = isValidLogin({ challenge, signature: signed.signature, signingAddress: address, recoverAddress: (message, signature) => ethers.verifyMessage(message, signature) });
    } catch {
      ok = false;
    }
    if (!ok) {
      announce({ wallet, authenticated: false });
      return failure('wallet-error', 'That signature did not match your wallet.', wallet);
    }
    const expiresAt = now() + LOCAL_WALLET_SESSION_TTL_MS;
    writeJson(storage, LOCAL_WALLET_SESSION_STORAGE_KEY, { wallet, expiresAt });
    announce({ wallet, authenticated: true });
    return Object.freeze({ ok: true, wallet, authenticated: true, token: null, expiresAt });
  }

  // Silent re-auth on boot. Never prompts: eth_accounts only, and nothing at
  // all for WalletConnect (AppKit is created later, on the first action that
  // needs the wallet).
  async function restore({ provider = null } = {}) {
    const memory = remembered();
    const quiet = (walletValue = null) => {
      announce({ wallet: null, authenticated: false });
      return Object.freeze({ ok: false, wallet: walletValue, authenticated: false, providerPending: false });
    };
    if (!memory) return quiet();
    if (memory.kind === 'walletconnect') {
      if (!isAuthenticated(memory.wallet)) return quiet();
      announce({ wallet: memory.wallet, authenticated: true });
      return Object.freeze({ ok: true, wallet: memory.wallet, authenticated: true, providerPending: true });
    }
    if (!provider?.request) return quiet();
    let accounts = [];
    try {
      accounts = await provider.request({ method: 'eth_accounts' });
    } catch {
      accounts = [];
    }
    const account = Array.isArray(accounts) ? accounts.find((entry) => HEX_ADDRESS.test(String(entry ?? ''))) : null;
    if (!account || lower(account) !== memory.wallet || !isAuthenticated(memory.wallet)) return quiet();
    announce({ wallet: memory.wallet, authenticated: true });
    return Object.freeze({ ok: true, wallet: memory.wallet, address: String(account), authenticated: true, providerPending: false });
  }

  // Drop the token (a 401 from any Bearer call) without forgetting the wallet.
  function invalidate() {
    const wallet = lastAnnounced?.wallet ?? remembered()?.wallet ?? null;
    try { profileSync?.logout?.(); } catch { /* ignore */ }
    writeJson(storage, LOCAL_WALLET_SESSION_STORAGE_KEY, null);
    announce({ wallet, authenticated: false });
  }

  function signOut() {
    try { profileSync?.logout?.(); } catch { /* ignore */ }
    writeJson(storage, LOCAL_WALLET_SESSION_STORAGE_KEY, null);
    writeJson(storage, WALLET_CONNECTOR_STORAGE_KEY, null);
    announce({ wallet: null, authenticated: false });
  }

  return Object.freeze({
    signIn, restore, isAuthenticated, token, signOut, remember, remembered,
    invalidate, announce,
    get hosted() { return Boolean(hosted); },
  });
}
