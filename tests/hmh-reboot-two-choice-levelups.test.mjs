import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RUN_UPGRADE_CATALOG,
  createRunProgression,
  getRunProgressionSnapshot,
  recordRunDefeat,
  selectRunUpgrade,
} from '../apps/hmh-reboot/src/run-progression.mjs';

/**
 * Cycle 036 handoff, Priority E: "Change every level-up offer from exactly
 * three options to exactly two deterministic options." The pair must be a
 * function of seed, level, ranks and selection sequence alone.
 */

const levelUp = (state) => {
  // Feed defeats until a level-up is pending.
  for (let index = 0; index < 200; index += 1) {
    recordRunDefeat(state, { enemyId: `enemy-${index}-${state.level}`, threatCost: 25, tick: index + 1 });
    if (getRunProgressionSnapshot(state).pendingChoices.length > 0) return;
  }
  throw new Error('no level-up reached');
};

test('every level-up offers exactly two distinct upgrade choices', () => {
  const state = createRunProgression({ seed: 11 });
  levelUp(state);
  const offered = getRunProgressionSnapshot(state).pendingChoices;
  assert.equal(offered.length, 2, 'Justin requires exactly two choices per level');
  assert.equal(new Set(offered.map((choice) => choice.id)).size, 2, 'the pair must be distinct');
  for (const choice of offered) {
    assert.ok(RUN_UPGRADE_CATALOG[choice.id], `${choice.id} must come from the catalog`);
    assert.ok(Object.isFrozen(choice));
  }
});

test('the offered pair is deterministic: same seed and state, same ordered pair', () => {
  const run = () => {
    const state = createRunProgression({ seed: 77 });
    levelUp(state);
    const first = getRunProgressionSnapshot(state).pendingChoices.map((choice) => choice.id);
    selectRunUpgrade(state, first[0]);
    levelUp(state);
    const second = getRunProgressionSnapshot(state).pendingChoices.map((choice) => choice.id);
    return [first, second];
  };
  assert.deepEqual(run(), run(), 'identical seeds and selections must reproduce identical ordered pairs');
});

test('different seeds may produce different pairs, so the offer is seed-driven', () => {
  const pairFor = (seed) => {
    const state = createRunProgression({ seed });
    levelUp(state);
    return getRunProgressionSnapshot(state).pendingChoices.map((choice) => choice.id).join('|');
  };
  const pairs = new Set(Array.from({ length: 24 }, (_, seed) => pairFor(seed + 1)));
  assert.ok(pairs.size > 1, 'every seed producing one identical pair would mean the seed is ignored');
});

test('only offered choices can be selected, and selection consumes the pending level', () => {
  const state = createRunProgression({ seed: 5 });
  levelUp(state);
  const offered = getRunProgressionSnapshot(state).pendingChoices;
  const unoffered = Object.keys(RUN_UPGRADE_CATALOG).find((id) => !offered.some((choice) => choice.id === id));
  assert.throws(() => selectRunUpgrade(state, unoffered), /offer|choice|pending/i);
  const before = getRunProgressionSnapshot(state).pendingLevels;
  selectRunUpgrade(state, offered[0].id);
  assert.equal(getRunProgressionSnapshot(state).pendingLevels, before - 1);
});

test('a maxed catalog cannot strand the offer below two while capacity remains', () => {
  const state = createRunProgression({ seed: 9 });
  // Max every non-repeatable upgrade; repeatable tails must keep the pair full.
  for (const upgrade of Object.values(RUN_UPGRADE_CATALOG)) {
    if (upgrade.repeatable !== true) state.ranks[upgrade.id] = upgrade.maxRank;
  }
  levelUp(state);
  const offered = getRunProgressionSnapshot(state).pendingChoices;
  assert.equal(offered.length, 2, 'repeatable mastery picks must keep the pair full');
  for (const choice of offered) {
    assert.equal(RUN_UPGRADE_CATALOG[choice.id].repeatable, true);
  }
});
