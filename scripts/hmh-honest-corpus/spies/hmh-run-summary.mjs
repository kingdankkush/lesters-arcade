import * as real from '../../../sdk/hmh-run-summary.mjs';
export * from '../../../sdk/hmh-run-summary.mjs';
export function createRunSummaryAccumulator(...args) { const state = real.createRunSummaryAccumulator(...args); globalThis.__headless.spies.accumulator = state; globalThis.__headless.spies.health = 100; return state; }
export function recordRunHealing(accumulator, amount, ...rest) {
  const spies = globalThis.__headless.spies;
  if (Number.isFinite(amount)) spies.health = Math.min(spies.maxHealth ?? 100, (spies.health ?? 100) + amount);
  return real.recordRunHealing(accumulator, amount, ...rest);
}
