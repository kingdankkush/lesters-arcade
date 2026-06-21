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

export const SIWE_STATEMENT =
  'Sign in to Lester\u2019s Arcade. This signature proves you control this wallet. It is free, off-chain, and does not authorize any transaction.';

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

// A login is valid when we got a non-empty signature back for the SAME address
// we challenged. (Full cryptographic ecrecover happens server/contract-side in
// the on-chain phase; client-side we bind signature->address + require the
// wallet to have signed our exact challenge string.)
export function isValidLogin({ challenge, signature, signingAddress } = {}) {
  if (!challenge || typeof challenge.message !== 'string') return false;
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature) || signature.length < 132) return false;
  // The wallet that signed must be the wallet we challenged.
  if (String(signingAddress).toLowerCase() !== challenge.address) return false;
  return true;
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
