import * as real from '../../../apps/hmh-reboot/src/weapon-system.mjs';
export * from '../../../apps/hmh-reboot/src/weapon-system.mjs';
export function createWeaponLoadout(...args) { const state = real.createWeaponLoadout(...args); globalThis.__headless.spies.loadout = state; return state; }
