// WalletConnect sign-in through Reown AppKit (guide §5.9, decision D9).
//
// Loaded with import() only when the player picks WalletConnect in the wallet
// picker, or when a remembered WalletConnect session first needs its provider
// (Sign in, the Ranked entry, a profile write). It is never created at boot:
// Free Mode opens no WalletConnect relay connection (guide rule 3).
//
// Every Reown import stays behind the dynamic import() below (the vendor entry
// reown-appkit-vendor.mjs, which build.mjs bundles in a build of its own, with
// code splitting, into dist/reown/appkit.js plus dist/reown/chunks/), so AppKit
// and its ethers copy never enter the portal's static graph or the children's
// shared chunks. AppKit is bundled locally (no CDN script), so the CSP
// script-src is unchanged; the relay, API, font and verify hosts are in
// vercel.json.

import { REOWN_PROJECT_ID, isReownAllowedHost } from './wallet-config.mjs';

const LITEFORGE_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
const LITEFORGE_EXPLORER_URL = 'https://liteforge.explorer.caldera.xyz';

// AppKit's network shape (viem-style chain plus CAIP fields). Written out here
// instead of importing @reown/appkit/networks, which re-exports all of viem's
// chain list.
export const LITEFORGE_APPKIT_NETWORK = Object.freeze({
  id: 4441,
  caipNetworkId: 'eip155:4441',
  chainNamespace: 'eip155',
  name: 'LitVM LiteForge',
  nativeCurrency: Object.freeze({ name: 'zkLTC', symbol: 'zkLTC', decimals: 18 }),
  rpcUrls: Object.freeze({ default: Object.freeze({ http: Object.freeze([LITEFORGE_RPC_URL]) }) }),
  blockExplorers: Object.freeze({ default: Object.freeze({ name: 'LiteForge Explorer', url: LITEFORGE_EXPLORER_URL }) }),
  testnet: true,
});

export const WALLETCONNECT_FEATURES = Object.freeze({ analytics: false, email: false, socials: false });

// Pure: the createAppKit options for this origin. `adapter` is the
// EthersAdapter instance (injected so tests never load AppKit).
export function buildAppKitOptions({ origin, adapter = null } = {}) {
  const url = String(origin ?? 'https://lestersarcade.io').replace(/\/+$/, '');
  return {
    adapters: adapter ? [adapter] : [],
    networks: [LITEFORGE_APPKIT_NETWORK],
    defaultNetwork: LITEFORGE_APPKIT_NETWORK,
    projectId: REOWN_PROJECT_ID,
    metadata: {
      name: 'Lester’s Arcade',
      description: 'Retro arcade games on LitVM. Free Mode is always free.',
      url,
      icons: [`${url}/assets/brand/lesters-arcade-logo-horizontal.png`],
    },
    features: { ...WALLETCONNECT_FEATURES },
    // Installed browser wallets are listed by the arcade's own picker; AppKit
    // is only the WalletConnect path (QR on desktop, wallet apps on mobile).
    enableEIP6963: false,
    enableInjected: false,
    enableCoinbase: false,
    allowUnsupportedChain: false,
    themeMode: 'dark',
  };
}

async function loadReownAppKit() {
  const { createAppKit, EthersAdapter } = await import('./reown-appkit-vendor.mjs');
  return { createAppKit, EthersAdapter };
}

let appKitInstance = null;

function eip155Provider(appKit) {
  try {
    const provider = appKit.getProvider?.('eip155') ?? appKit.getWalletProvider?.();
    return provider && typeof provider.request === 'function' ? provider : null;
  } catch {
    return null;
  }
}

function connected(appKit) {
  try { return Boolean(appKit.getIsConnectedState?.()) && Boolean(eip155Provider(appKit)); } catch { return false; }
}

// Resolves with an EIP-1193 provider once the player has connected a wallet
// through AppKit, or null when they close the modal. A remembered session is
// reconnected by AppKit itself (no modal) when `reconnectOnly` is true; if it
// cannot be, null is returned and the caller asks the player to sign in.
export async function createWalletConnectProvider({
  host = globalThis.location?.hostname,
  origin = globalThis.location?.origin,
  reconnectOnly = false,
  loadAppKit = loadReownAppKit,
  reconnectWaitMs = 2500,
} = {}) {
  if (!isReownAllowedHost(host)) throw new Error('WalletConnect is not available on this site.');
  if (!appKitInstance) {
    const { createAppKit, EthersAdapter } = await loadAppKit();
    appKitInstance = createAppKit(buildAppKitOptions({ origin, adapter: new EthersAdapter() }));
  }
  const appKit = appKitInstance;
  if (connected(appKit)) return eip155Provider(appKit);

  return new Promise((resolve) => {
    let settled = false;
    let opened = false;
    const unsubscribers = [];
    const finish = (value) => {
      if (settled) return;
      settled = true;
      for (const stop of unsubscribers) { try { stop?.(); } catch { /* already gone */ } }
      resolve(value);
    };
    const check = () => { if (connected(appKit)) finish(eip155Provider(appKit)); };
    unsubscribers.push(appKit.subscribeProviders?.(check));
    unsubscribers.push(appKit.subscribeAccount?.(check));
    unsubscribers.push(appKit.subscribeState?.((state) => {
      if (state?.open) opened = true;
      else if (opened) setTimeout(() => { check(); finish(null); }, 0);
    }));
    if (reconnectOnly) {
      setTimeout(() => { check(); finish(null); }, reconnectWaitMs);
      return;
    }
    Promise.resolve(appKit.open?.({ view: 'Connect' })).catch(() => finish(null));
  });
}

// Ends the WalletConnect session (sign-out). Without `restoreFirst` it never
// creates AppKit. With it (a session restored at boot whose provider was never
// created), AppKit is created on this sign-out click so it can reconnect the
// stored relay session and then disconnect it; otherwise AppKit's stored
// session would silently reconnect the old wallet on the next WalletConnect
// pick. Off the Reown-allowed hosts there is nothing to end.
export async function disconnectWalletConnect({ restoreFirst = false, ...options } = {}) {
  if (!appKitInstance && restoreFirst) {
    try { await createWalletConnectProvider({ ...options, reconnectOnly: true }); } catch { return; }
  }
  if (!appKitInstance) return;
  try { await appKitInstance.disconnect?.(); } catch { /* already disconnected */ }
}
