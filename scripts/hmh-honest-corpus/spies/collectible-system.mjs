import * as real from '../../../apps/hmh-reboot/src/collectible-system.mjs';
export * from '../../../apps/hmh-reboot/src/collectible-system.mjs';
export function createCollectibleState(...args) { const state = real.createCollectibleState(...args); globalThis.__headless.spies.collectibles = state; return state; }
