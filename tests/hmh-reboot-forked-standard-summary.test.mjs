import assert from 'node:assert/strict';
import test from 'node:test';

import * as summary from '../sdk/hmh-run-summary.mjs';
import { validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';

test('W9B schema stores bounded aggregate Standard attacks without target history and catalogs every upgrade', () => {
  const state = summary.createRunSummaryAccumulator({ seed: 91, buildHash: 'wave9b-test', mode: 'free', heroId: 'hero-hodler', startTick: 0, startPosition: { x: 0, y: 0 } });
  const upgrades = ['standard-reach', 'standard-force', 'standard-tempo', 'canonical-fork'];
  summary.recordRunUpgradeOffer(state, upgrades);
  for (const upgradeId of upgrades) summary.recordRunUpgradeSelection(state, upgradeId);
  summary.recordRunForkedStandardEvent(state, {
    type: 'weapon:melee-strike', tick: 1, form: 'thrust', capstone: false, whiff: false, droppedContacts: 0,
    hits: [{ targetId: 'enemy-a' }, { targetId: 'enemy-b' }],
  });
  summary.recordRunForkedStandardEvent(state, {
    type: 'weapon:melee-strike', tick: 25, form: 'sweep', capstone: true, whiff: true, droppedContacts: 4, hits: [],
  });
  const result = summary.finalizeRunSummary(state, {
    endTick: 30, elapsedMs: 500, terminalReason: 'completed', score: 0, level: 1, xp: 0,
    currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1,
  });
  assert.equal(result.schemaVersion, 5);
  assert.deepEqual(result.forkedStandard, {
    attacks: 2, contacts: 2, whiffs: 1, thrusts: 1, sweeps: 1, capstoneAttacks: 1, droppedContacts: 4,
  });
  assert.equal(validateRunSummaryPayload(result), '');
  assert.equal(JSON.stringify(result.forkedStandard).includes('targetId'), false);
  assert.ok(result.weapons.some((row) => row.weaponId === 'forked-standard'));
  assert.ok(result.collectibles.some((row) => row.effectId === 'forked-standard-cache'));
  for (const upgradeId of upgrades) assert.deepEqual(result.upgrades.find((row) => row.upgradeId === upgradeId), { upgradeId, offered: 1, selected: 1 });
});

test('W9B Standard telemetry rejects unbounded or contradictory attack aggregates', () => {
  const state = summary.createRunSummaryAccumulator({ seed: 91, buildHash: 'wave9b-bounds', mode: 'free', heroId: 'hero-hodler', startTick: 0, startPosition: { x: 0, y: 0 } });
  assert.throws(() => summary.recordRunForkedStandardEvent(state, {
    type: 'weapon:melee-strike', tick: 1, form: 'sweep', capstone: false, whiff: false, droppedContacts: 0,
    hits: Array.from({ length: 7 }, (_, index) => ({ targetId: `enemy-${index}` })),
  }), /bounded to six/i);
  assert.throws(() => summary.recordRunForkedStandardEvent(state, {
    type: 'weapon:melee-strike', tick: 2, form: 'thrust', capstone: false, whiff: true, droppedContacts: 0,
    hits: [{ targetId: 'enemy' }],
  }), /whiff cannot contain hits/i);
});
