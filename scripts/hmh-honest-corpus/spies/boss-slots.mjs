import * as real from '../../../apps/hmh-reboot/src/boss-slots.mjs';
export * from '../../../apps/hmh-reboot/src/boss-slots.mjs';
export function createBossSlots(...args) { const state = real.createBossSlots(...args); globalThis.__headless.spies.bossSlots = state; return state; }
