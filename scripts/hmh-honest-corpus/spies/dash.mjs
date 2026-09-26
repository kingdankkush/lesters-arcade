import * as real from '../../../apps/hmh-reboot/src/dash.mjs';
export * from '../../../apps/hmh-reboot/src/dash.mjs';
export function createDashState(...args) { const state = real.createDashState(...args); globalThis.__headless.spies.dash = state; return state; }
