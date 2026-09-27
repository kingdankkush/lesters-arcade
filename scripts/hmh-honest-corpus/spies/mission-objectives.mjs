import * as real from '../../../apps/hmh-reboot/src/mission-objectives.mjs';
export * from '../../../apps/hmh-reboot/src/mission-objectives.mjs';
export function createMissionState(...args) { const state = real.createMissionState(...args); globalThis.__headless.spies.mission = state; return state; }
