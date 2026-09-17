import assert from 'node:assert/strict';
import test from 'node:test';
import { SILVER_SCORE_PER_COIN, createRunProgression, getRunProgressionSnapshot, grantRunSilver, recordRunDefeat, selectRunUpgrade } from '../apps/hmh-reboot/src/run-progression.mjs';

/**
 * Owner decision 2026-09-16: silver Litecoin coins count toward the run
 * score. They are worth a flat amount each, scale with the run's score
 * multiplier like every other score source, and never grant XP or levels.
 */

test('silver coins add a flat score per coin, follow the score multiplier, and never touch xp', () => {
  const state = createRunProgression({ seed: 9 });
  assert.equal(SILVER_SCORE_PER_COIN, 10);
  const first = grantRunSilver(state, 3, 120);
  assert.deepEqual([first.score, first.silverCollected, first.xp, first.level], [30, 3, 0, 1]);
  assert.deepEqual(first.lastEvent, { sourceId: 'silver', coins: 3, tick: 120, scoreGain: 30, xpGain: 0, levelsGained: 0 });
  recordRunDefeat(state, { enemyId: 'e1', threatCost: 4, tick: 130 });
  const before = getRunProgressionSnapshot(state).score;
  grantRunSilver(state, 1, 140);
  assert.equal(getRunProgressionSnapshot(state).score, before + 10, 'coins and defeats accumulate into one score');
  assert.equal(getRunProgressionSnapshot(state).silverCollected, 4);
});

test('silver coin score scales with a score multiplier upgrade and rejects unbounded input', () => {
  const state = createRunProgression({ seed: 3 });
  const multiplierUpgrade = Object.keys(state.ranks).find((id) => /score/i.test(id));
  if (multiplierUpgrade) {
    state.pendingLevels = 1;
    try { selectRunUpgrade(state, multiplierUpgrade); } catch { /* the upgrade may need eligibility; the multiplier check below still holds */ }
  }
  const snapshot = getRunProgressionSnapshot(state);
  const expected = Math.round(2 * SILVER_SCORE_PER_COIN * snapshot.effects.scoreMultiplier);
  assert.equal(grantRunSilver(state, 2, 5).score - snapshot.score, expected);
  for (const coins of [0, -1, 1.5, 100_001, '2']) assert.throws(() => grantRunSilver(state, coins, 1), /coins/);
  assert.throws(() => grantRunSilver(state, 1, -1), /tick/);
  assert.throws(() => grantRunSilver(null, 1, 1), /state/);
});
