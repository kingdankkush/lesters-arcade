import * as real from '../../../apps/hmh-reboot/src/liquidator-boss.mjs';
export * from '../../../apps/hmh-reboot/src/liquidator-boss.mjs';
export function createLiquidatorBoss(...args) { const state = real.createLiquidatorBoss(...args); globalThis.__headless.spies.boss = state; return state; }
