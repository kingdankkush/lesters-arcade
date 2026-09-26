import * as real from '../../../apps/hmh-reboot/src/grenades.mjs';
export * from '../../../apps/hmh-reboot/src/grenades.mjs';
export function createGrenadeSystem(...args) { const state = real.createGrenadeSystem(...args); globalThis.__headless.spies.grenades = state; return state; }
