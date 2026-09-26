import * as real from '../../../apps/hmh-reboot/src/world-design-interactions.mjs';
export * from '../../../apps/hmh-reboot/src/world-design-interactions.mjs';
export function createWorldDesignState(...args) { const state = real.createWorldDesignState(...args); globalThis.__headless.spies.worldDesign = state; return state; }
