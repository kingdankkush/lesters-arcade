import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { COLLECTIBLE_EFFECTS } from '../apps/hmh-reboot/src/collectible-system.mjs';
import {
  RUN_UPGRADE_CATALOG,
  comboMilestoneXp,
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunXp,
} from '../apps/hmh-reboot/src/run-progression.mjs';

function awardSchedule(ticks) {
  const state = createRunProgression({ seed: 21 });
  state.ranks['validator-training'] = 1;
  grantRunXp(state, COLLECTIBLE_EFFECTS['hash-rail-core'].xpGain, ticks[0]);
  grantRunXp(state, comboMilestoneXp(5), ticks[1]);
  return getRunProgressionSnapshot(state);
}

test('S2 Litecoin pickup and combo milestones award bounded authored XP', () => {
  assert.match(RUN_UPGRADE_CATALOG['validator-training'].description, /every source/i);
  assert.doesNotMatch(RUN_UPGRADE_CATALOG['validator-training'].description, /enemy defeats/i);
  assert.equal(COLLECTIBLE_EFFECTS['hash-rail-core'].effectId, 'litecoin-token');
  assert.equal(COLLECTIBLE_EFFECTS['hash-rail-core'].xpGain, 160);
  assert.deepEqual([0, 4, 5, 10, 20, 30, 31].map(comboMilestoneXp), [0, 0, 120, 240, 480, 900, 0]);
  const snapshot = awardSchedule([1, 2]);
  assert.equal(snapshot.xp, 350);
  assert.equal(snapshot.level, 2);
  assert.equal(snapshot.lastEvent.tick, 2);
});

test('S2 source XP depends on event order and fixed ticks, never render cadence or wall clock', () => {
  const early = awardSchedule([1, 2]);
  const late = awardSchedule([120, 12_000]);
  assert.equal(early.xp, late.xp);
  assert.equal(early.level, late.level);
  assert.deepEqual(early.ranks, late.ranks);
});

test('S2 runtime wires collectible XP, combo milestones, and damage resets through progression authority', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /grantRunXp\(runProgression/);
  assert.match(source, /comboMilestoneXp\(feedback\.current\)/);
  assert.match(source, /event\.xpGain/);
  assert.match(source, /updateRunCombo\(0\)/);
  assert.match(source, /resolveComboFeedback/);
});
