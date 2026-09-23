// Wallet sign-in configuration (contract §7.6, guide §1.1 and §5.9).
//
// Pure constants shared by the sign-in modules. The Reown project id is a
// public identifier that ships in every page (it is not a secret), so it lives
// here rather than in a Vercel secret. Name it *_PROJECT_ID, never *_API_KEY:
// the security sweep reads that pattern as a credential.

export const REOWN_PROJECT_ID = 'eedf4ae26a379df793b7f4eef223a0c9';

// WalletConnect (Reown AppKit) is offered only on the hosts the Reown project
// allows. Anywhere else (localhost, preview deployments) the relay refuses the
// origin, so the picker never shows it there.
export const REOWN_ALLOWED_HOSTS = Object.freeze(['lestersarcade.io', 'www.lestersarcade.io']);

// Featured first in the wallet picker, in this order (EIP-6963 rdns).
export const FEATURED_WALLET_RDNS = Object.freeze(['io.metamask', 'io.rabby']);

export const WALLET_INSTALL_LINKS = Object.freeze({
  'io.metamask': 'https://metamask.io/download/',
  'io.rabby': 'https://rabby.io/',
});

// Mobile deep links open the arcade inside the wallet app's own browser. Rabby
// has no documented universal dapp link for its mobile app, so it is omitted.
export const WALLET_DEEP_LINKS = Object.freeze({
  metamask: 'https://metamask.app.link/dapp/lestersarcade.io',
  trust: 'https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Flestersarcade.io',
});

export const LITEFORGE_FAUCET_URL = 'https://liteforge.hub.caldera.xyz';

// Display names for the featured wallets and deep links.
export const WALLET_NAMES = Object.freeze({
  'io.metamask': 'MetaMask',
  'io.rabby': 'Rabby',
  metamask: 'MetaMask',
  trust: 'Trust Wallet',
});

export function isReownAllowedHost(host) {
  return REOWN_ALLOWED_HOSTS.includes(String(host ?? '').toLowerCase());
}
