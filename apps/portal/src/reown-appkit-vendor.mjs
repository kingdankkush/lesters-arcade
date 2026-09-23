// Reown AppKit vendor entry (WalletConnect sign-in, guide §5.9).
//
// build.mjs bundles this file in a build of its own (with code splitting, so
// the modal loads only the views it opens) into dist/reown/appkit.js plus
// dist/reown/chunks/, and the portal build treats it as the external lazy
// import '../reown/appkit.js' of walletconnect-provider.mjs. Keeping AppKit
// out of the portal's split graph keeps its CommonJS runtime helpers out of
// the shared helper chunk that the HMH and STACKED children load, so their
// initial-JS budgets do not move. AppKit's own npm ethers copy lives only in
// that separate build.

export { createAppKit } from '@reown/appkit';
export { EthersAdapter } from '@reown/appkit-adapter-ethers';
