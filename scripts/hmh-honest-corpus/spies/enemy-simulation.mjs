import * as real from '../../../apps/hmh-reboot/src/enemy-simulation.mjs';
export * from '../../../apps/hmh-reboot/src/enemy-simulation.mjs';
export function createEnemyPopulation(...args) { const state = real.createEnemyPopulation(...args); globalThis.__headless.spies.population = state; return state; }
