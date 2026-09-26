// Lester's Arcade — wallet auth helpers (pure, DOM-free, testable).
//
// Covers the testable core of:
//   - EIP-6963 multi-wallet discovery (MetaMask, Rabby, etc. side by side)
//   - Sign-In-With-Ethereum (SIWE-style) message construction + nonce
//   - binding a recovered signature to the connecting address
//
// The actual `window.addEventListener('eip6963:announceProvider', ...)` wiring
// and `provider.request({ method: 'personal_sign' })` calls live in main.js;
// everything here is pure so it can be unit-tested in Node and reused by both
// the runtime and any future third-party adapter.

import { FAUCET_LINK_TEXT, RANKED_FACTS } from './ranked-facts.mjs';

// Shared by the browser and the server (contract A13): the server rebuilds the
// message byte for byte, so both sides must use this exact constant.
export const SIWE_STATEMENT =
  'Sign in to Lester\u2019s Arcade. This does not cost anything or send a transaction.';

// A nonce issued by GET /api/session/nonce (contract §4.3.1): 72 lowercase
// hex characters (random, expiry, MAC). Browser-generated nonces
// (generateNonce, 32 hex) are for the local preview only.
export function isServerNonce(nonce) {
  return typeof nonce === 'string' && /^[0-9a-f]{72}$/.test(nonce);
}

// Generate a random nonce for a SIWE challenge. Uses crypto when available
// (browser / modern Node) and falls back to Math.random so tests never throw.
export function generateNonce(byteLength = 16) {
  const cryptoObj = globalThis.crypto;
  const bytes = new Uint8Array(byteLength);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

// Build the human-readable SIWE message a wallet signs at login. Deterministic
// for given inputs (nonce + issuedAt are injected) so it is fully testable and
// the parent can reconstruct the exact message to verify a returned signature.
export function buildSiweMessage({
  domain,
  address,
  chainId,
  nonce,
  issuedAt,
  uri = null,
  statement = SIWE_STATEMENT,
  version = '1',
} = {}) {
  if (!domain || typeof domain !== 'string') throw new Error('buildSiweMessage: domain required');
  if (!HEX_ADDRESS.test(String(address))) throw new Error('buildSiweMessage: valid address required');
  if (!nonce || typeof nonce !== 'string') throw new Error('buildSiweMessage: nonce required');
  if (!issuedAt || typeof issuedAt !== 'string') throw new Error('buildSiweMessage: issuedAt (ISO) required');
  const resolvedUri = uri ?? `https://${domain}`;
  // EIP-4361-shaped message. We keep the canonical line order so a verifier can
  // re-derive it byte-for-byte from the stored fields.
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${resolvedUri}`,
    `Version: ${version}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

// Build the full challenge object the runtime hands to personal_sign + stores
// so the signature can later be verified/replayed. Pure given an injected
// nonce/clock (so tests are deterministic).
export function buildSiweChallenge({
  domain,
  address,
  chainId,
  nonce = generateNonce(),
  issuedAt = new Date().toISOString(),
  uri = null,
} = {}) {
  const message = buildSiweMessage({ domain, address, chainId, nonce, issuedAt, uri });
  return Object.freeze({ domain, address: String(address).toLowerCase(), chainId, nonce, issuedAt, uri, message });
}

// A login is valid when the signature is well-formed, the connecting address is
// the address we challenged, and (when a recoverer is supplied) the address
// recovered from the signature over our exact challenge message is that same
// address. `recoverAddress(message, signature)` is injected (ethers
// verifyMessage in the runtime) so this module stays pure.
export function isValidLogin({ challenge, signature, signingAddress, recoverAddress = null } = {}) {
  if (!challenge || typeof challenge.message !== 'string') return false;
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature) || signature.length < 132) return false;
  // The wallet that signed must be the wallet we challenged.
  if (String(signingAddress).toLowerCase() !== challenge.address) return false;
  if (typeof recoverAddress === 'function') {
    try {
      const recovered = recoverAddress(challenge.message, signature);
      if (String(recovered ?? '').toLowerCase() !== challenge.address) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// A challenge older than this is stale: the wallet must sign a fresh one.
export const SIWE_CHALLENGE_TTL_MS = 10 * 60 * 1000;
export function isChallengeFresh(challenge, nowMs = Date.now()) {
  const issued = Date.parse(challenge?.issuedAt ?? '');
  return Number.isFinite(issued) && nowMs - issued <= SIWE_CHALLENGE_TTL_MS && nowMs >= issued - 60_000;
}

// --- EIP-6963 multi-wallet discovery ---------------------------------------
// Wallets announce themselves with { info: { uuid, name, rdns, icon }, provider }.
// Collect them into a stable, de-duplicated list so the UI can let the player
// pick when several wallets (MetaMask + Rabby + ...) are installed. Relying on
// the legacy single `window.ethereum` breaks when multiple wallets race to own
// that property.

// Normalize + validate one announced detail. Returns null if malformed.
export function normalizeProviderDetail(detail) {
  const info = detail?.info;
  const provider = detail?.provider;
  if (!info || typeof info !== 'object') return null;
  if (!provider || typeof provider.request !== 'function') return null;
  if (typeof info.uuid !== 'string' || typeof info.name !== 'string') return null;
  return Object.freeze({
    uuid: info.uuid,
    name: info.name,
    rdns: typeof info.rdns === 'string' ? info.rdns : null,
    icon: typeof info.icon === 'string' ? info.icon : null,
    provider,
  });
}

// A small registry the runtime feeds announced providers into. De-dupes by uuid
// (and rdns as a secondary key) so the same wallet announcing twice is counted
// once. Pure data structure; the runtime attaches the event listener.
export function createProviderRegistry() {
  const byUuid = new Map();
  const seenRdns = new Set();
  return {
    add(detail) {
      const normalized = normalizeProviderDetail(detail);
      if (!normalized) return false;
      if (byUuid.has(normalized.uuid)) return false;
      if (normalized.rdns && seenRdns.has(normalized.rdns)) return false;
      byUuid.set(normalized.uuid, normalized);
      if (normalized.rdns) seenRdns.add(normalized.rdns);
      return true;
    },
    list() {
      return [...byUuid.values()];
    },
    // Pick a sensible default: prefer MetaMask, then Rabby, then first announced.
    preferred() {
      const all = this.list();
      if (all.length === 0) return null;
      const byName = (needle) => all.find((p) => p.name.toLowerCase().includes(needle)
        || (p.rdns ?? '').toLowerCase().includes(needle));
      return byName('metamask') ?? byName('rabby') ?? all[0];
    },
    size() {
      return byUuid.size;
    },
  };
}

// Normalize wallet/provider errors into UI states. In particular, EIP-1193
// user rejection (4001) is cancellation, not a security or system failure.
export function classifyWalletError(error) {
  const code = error?.code ?? error?.error?.code ?? null;
  const message = String(error?.shortMessage || error?.reason || error?.message || error || '').trim();
  const lower = message.toLowerCase();

  if (code === 4001 || code === 'ACTION_REJECTED' || /user (rejected|denied|cancelled|canceled)/i.test(message)) {
    return Object.freeze({ kind: 'user-cancelled', userCancelled: true, recoverable: true, severity: 'info', message });
  }
  if (code === 4901 || code === 4902 || lower.includes('wrong network') || lower.includes('expected') && lower.includes('chain')) {
    return Object.freeze({ kind: 'wrong-network', userCancelled: false, recoverable: true, severity: 'warning', message });
  }
  if (lower.includes('no wallet') || lower.includes('connected wallet is required')) {
    return Object.freeze({ kind: 'missing-wallet', userCancelled: false, recoverable: true, severity: 'warning', message });
  }
  if (code === 'INSUFFICIENT_FUNDS' || lower.includes('insufficient funds') || lower.includes('insufficient balance')) {
    return Object.freeze({ kind: 'insufficient-funds', userCancelled: false, recoverable: true, severity: 'warning', message });
  }
  return Object.freeze({ kind: 'wallet-error', userCancelled: false, recoverable: false, severity: 'error', message });
}

// --- One message and one action per error kind (guide §3.2) ----------------
// The Ranked modal and sign-in show exactly what this returns. Action ids are
// wired by the caller: 'retry' re-enables the same step, 'switch-network' asks
// the wallet for LiteForge, 'faucet' links to the zkLTC faucet, 'recheck'
// re-reads the balance, and 'pick-wallet' opens the wallet picker.
export const WALLET_ERROR_KINDS = Object.freeze(['user-cancelled', 'wrong-network', 'insufficient-funds', 'missing-wallet', 'wallet-error']);

// Wallet messages can embed an RPC URL or a long revert dump. Keep the first
// sentence-sized piece only.
export function shortWalletMessage(message, maxLength = 140) {
  const text = String(message ?? '').replace(/\s+/g, ' ').replace(/\s*\(\w+=.*$/, '').trim();
  if (!text) return 'Your wallet could not complete that request.';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

export function walletErrorAction(classified, { totalZkLtc = null, balanceZkLtc = null } = {}) {
  const kind = WALLET_ERROR_KINDS.includes(classified?.kind) ? classified.kind : 'wallet-error';
  switch (kind) {
    case 'user-cancelled':
      return Object.freeze({ kind, message: 'You cancelled in your wallet. Nothing was charged.', actions: Object.freeze([Object.freeze({ id: 'retry', label: 'Try again' })]) });
    case 'wrong-network':
      return Object.freeze({ kind, message: 'Your wallet is on another network.', actions: Object.freeze([Object.freeze({ id: 'switch-network', label: 'Switch to LiteForge' })]) });
    case 'insufficient-funds':
      return Object.freeze({
        kind,
        // The fallback is the static price (ranked-facts.mjs); the modal passes the quoted amount.
        // The faucet label names the amount per request (ranked-onboarding, 2026-09-26).
        message: `You need about ${totalZkLtc ?? RANKED_FACTS.totalZkLtc} zkLTC. Balance ${balanceZkLtc ?? 'unknown'}.`,
        actions: Object.freeze([Object.freeze({ id: 'faucet', label: FAUCET_LINK_TEXT }), Object.freeze({ id: 'recheck', label: 'Re-check' })]),
      });
    case 'missing-wallet':
      return Object.freeze({ kind, message: null, actions: Object.freeze([Object.freeze({ id: 'pick-wallet', label: 'Sign in' })]) });
    default:
      return Object.freeze({ kind: 'wallet-error', message: shortWalletMessage(classified?.message), actions: Object.freeze([Object.freeze({ id: 'retry', label: 'Try again' })]) });
  }
}
