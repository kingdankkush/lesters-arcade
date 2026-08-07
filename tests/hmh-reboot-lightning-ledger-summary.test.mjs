import assert from 'node:assert/strict';
import test from 'node:test';

import * as summary from '../sdk/hmh-run-summary.mjs';

function createAccumulator() {
  return summary.createRunSummaryAccumulator({
    seed: 42,
    buildHash: 'wave8b-test',
    mode: 'free',
    heroId: 'hero-hodler',
    startTick: 0,
    startPosition: { x: 0, y: 0 },
  });
}

test('W8B run summary stores only bounded aggregate Lightning Ledger telemetry', () => {
  assert.equal(typeof summary.recordRunLightningLedgerEvent, 'function');
  const state = createAccumulator();
  summary.recordRunLightningLedgerEvent(state, { type: 'ledger:channel-start', tick: 10 });
  summary.recordRunLightningLedgerEvent(state, { type: 'ledger:pulse', tick: 16, chainIds: ['enemy-a', 'enemy-b'] });
  summary.recordRunLightningLedgerEvent(state, { type: 'ledger:cell-drain', tick: 40, consumed: 1 });
  summary.recordRunLightningLedgerEvent(state, {
    type: 'weapon:channel-pulse',
    tick: 42,
    rampPermille: 1460,
    proofDamagePermille: 1250,
    hits: Array.from({ length: 8 }, (_, index) => ({ targetId: `enemy-${index}` })),
  });
  summary.recordRunLightningLedgerEvent(state, { type: 'ledger:cell-refund', tick: 42, cellsRemaining: 6 });
  summary.recordRunLightningLedgerEvent(state, { type: 'ledger:channel-break', tick: 70, reason: 'dodge' });
  const result = summary.finalizeRunSummary(state, {
    endTick: 120,
    elapsedMs: 2000,
    terminalReason: 'completed',
    score: 0,
    level: 1,
    xp: 0,
    currentCombo: 0,
    maxCombo: 0,
    revealedCells: 0,
    totalCells: 1,
  });
  assert.deepEqual(result.lightningLedger, {
    pulses: 1,
    chainedHits: 8,
    longestChain: 8,
    maxRampPermille: 1460,
    heldTicks: 60,
    secondsHeld: 1,
    cellsSpent: 1,
    cellsRefunded: 1,
    fullChains: 1,
    overheats: 0,
    capstonePulses: 1,
    interruptions: { release: 0, switch: 0, dodge: 1, empty: 0, overheat: 0, invalidTarget: 0, other: 0 },
  });
  assert.ok(!Array.isArray(result.lightningLedger));
  assert.equal(JSON.stringify(result).includes('enemy-0'), false);
});

test('W8B summary closes an active channel at run end without storing per-tick history', () => {
  const state = createAccumulator();
  summary.recordRunLightningLedgerEvent(state, { type: 'ledger:channel-start', tick: 30 });
  const result = summary.finalizeRunSummary(state, {
    endTick: 90,
    elapsedMs: 1500,
    terminalReason: 'abandoned',
    score: 0,
    level: 1,
    xp: 0,
    currentCombo: 0,
    maxCombo: 0,
    revealedCells: 0,
    totalCells: 1,
  });
  assert.equal(result.lightningLedger.heldTicks, 60);
  assert.equal(result.lightningLedger.secondsHeld, 1);
});
