import * as real from '../../../apps/hmh-reboot/src/run-progression.mjs';
export * from '../../../apps/hmh-reboot/src/run-progression.mjs';
export function createRunProgression(...args) { const state = real.createRunProgression(...args); globalThis.__headless.spies.progression = state; return state; }
