import * as real from '../../../apps/hmh-reboot/src/movement.mjs';
export * from '../../../apps/hmh-reboot/src/movement.mjs';
export function createPlayerMotionState(...args) { const state = real.createPlayerMotionState(...args); globalThis.__headless.spies.motion = state; return state; }
