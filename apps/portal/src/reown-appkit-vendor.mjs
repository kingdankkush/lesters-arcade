// Reown AppKit vendor entry (WalletConnect sign-in, guide §5.9).
//
// build.mjs bundles this file on its own, without code splitting, into
// dist/chunks/reown-appkit.js, and the portal build treats that file as an
// external lazy import of walletconnect-provider.mjs. Keeping AppKit out of the
// portal's split graph keeps its CommonJS runtime helpers out of the shared
// helper chunk that the HMH and STACKED children load, so their initial-JS
// budgets do not move. AppKit's own npm ethers copy lives only in this file.

export { createAppKit } from '@reown/appkit';
export { EthersAdapter } from '@reown/appkit-adapter-ethers';
