import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND,
  calculateEnemyChaseSpeed,
  calculateEnemyMeleeDamage,
  calculateMeleeAttackResetFrames,
} from '../apps/portal/src/hmh-combat-balance.mjs';

test('melee chase speed stays below baseline player movement even for fast normal enemies', () => {
  const coyote = calculateEnemyChaseSpeed({
    catalogSpeed: 3.5,
    elite: false,
    pressure: 0.7,
    encounterSpeedMul: 1.12,
  });

  assert.equal(coyote < HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND, true);
  assert.equal(coyote <= HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND * 0.86, true);
});

test('elite melee chase speed cannot outrun a modestly upgraded player', () => {
  const upgradedPlayerSpeed = HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND * 1.15;
  const eliteRugRat = calculateEnemyChaseSpeed({
    catalogSpeed: 3.3,
    elite: true,
    pressure: 0.85,
    encounterSpeedMul: 1.18,
  });

  assert.equal(eliteRugRat < upgradedPlayerSpeed, true);
  assert.equal(eliteRugRat <= upgradedPlayerSpeed * 0.92, true);
});

test('very fast melee catalog entries are clamped instead of scaling into unavoidable rushes', () => {
  const slippageSkater = calculateEnemyChaseSpeed({
    catalogSpeed: 3.6,
    elite: true,
    pressure: 1,
    encounterSpeedMul: 1.2,
  });

  assert.equal(slippageSkater <= HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND * 1.02, true);
});

test('melee pack damage favors recovery windows over instant dogpiles', () => {
  assert.equal(calculateEnemyMeleeDamage({ normalHitDamage: 5, elite: false }), 4);
  assert.equal(calculateEnemyMeleeDamage({ normalHitDamage: 5, elite: true }), 6);
  assert.equal(calculateMeleeAttackResetFrames({ preferredResetFrames: 34 }), 72);
  assert.equal(calculateMeleeAttackResetFrames({ preferredResetFrames: 90 }), 90);
});
