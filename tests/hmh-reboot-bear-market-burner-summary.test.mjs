import assert from 'node:assert/strict';
import test from 'node:test';

import * as summary from '../sdk/hmh-run-summary.mjs';
import { validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';

test('W9A summary stores bounded Burner aggregates without target or tick histories', () => {
  const state = summary.createRunSummaryAccumulator({ seed: 9, buildHash: 'wave9a-test', mode: 'free', heroId: 'hero-hodler', startTick: 0, startPosition: { x: 0, y: 0 } });
  summary.recordRunBearMarketBurnerEvent(state, { type: 'burner:fuel', tick: 1, consumed: 5 });
  summary.recordRunBearMarketBurnerEvent(state, { type: 'burner:pulse', tick: 6, activeBurns: 3 });
  summary.recordRunBearMarketBurnerEvent(state, { type: 'weapon:flame-pulse', tick: 6, pressurePermille: 1000, hits: [{ targetId: 'a' }, { targetId: 'b' }] });
  summary.recordRunBearMarketBurnerEvent(state, { type: 'burner:burn-tick', tick: 30, targetId: 'a' });
  summary.recordRunBearMarketBurnerEvent(state, { type: 'burner:scorch-created', tick: 60, zone: { id: 'zone' } });
  summary.recordRunBearMarketBurnerEvent(state, { type: 'weapon:flame-pulse', tick: 66, pressurePermille: 1250, hits: [] });
  summary.recordRunBearMarketBurnerEvent(state, { type: 'burner:total-selloff', tick: 66 });
  summary.recordRunBearMarketBurnerEvent(state, { type: 'burner:emergency-refill', tick: 90, fuel: 300 });
  const result = summary.finalizeRunSummary(state, {
    endTick: 120, elapsedMs: 2000, terminalReason: 'completed', score: 0, level: 1, xp: 0,
    currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1,
  });
  assert.equal(result.schemaVersion, 5);
  assert.deepEqual(result.bearMarketBurner, {
    pulses: 2, contacts: 2, fuelSpent: 5, burnTicks: 1, scorchZonesCreated: 1,
    maxActiveBurns: 3, totalSelloffPulses: 1, emergencyRefills: 1,
  });
  assert.equal(validateRunSummaryPayload(result), '');
  assert.equal(JSON.stringify(result).includes('targetId'), false);
  assert.equal(JSON.stringify(result).includes('zone'), false);
});

test('W9A summary accepts every Burner upgrade offer and selection without stopping the fixed tick', () => {
  const state = summary.createRunSummaryAccumulator({ seed: 9, buildHash: 'wave9a-upgrades', mode: 'free', heroId: 'hero-hodler', startTick: 0, startPosition: { x: 0, y: 0 } });
  const upgradeIds = ['burner-liquidity', 'burner-volatility', 'burner-contagion', 'total-selloff'];
  summary.recordRunUpgradeOffer(state, upgradeIds);
  for (const upgradeId of upgradeIds) summary.recordRunUpgradeSelection(state, upgradeId);
  const result = summary.finalizeRunSummary(state, {
    endTick: 1, elapsedMs: 1000 / 60, terminalReason: 'completed', score: 0, level: 1, xp: 0,
    currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1,
  });
  for (const upgradeId of upgradeIds) {
    const row = result.upgrades.find((entry) => entry.upgradeId === upgradeId);
    assert.deepEqual(row, { upgradeId, offered: 1, selected: 1 });
  }
  assert.equal(validateRunSummaryPayload(result), '');
});
