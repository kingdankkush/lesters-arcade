import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  HMH_OPENING_ATTACK_GRACE_TICKS,
  HMH_OPENING_ENEMY_ARCHETYPE_IDS,
  HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE,
  HMH_OPENING_MOVEMENT_HOLD_TICKS,
  openingEnemyAttacksEnabled,
  openingEnemyMovementEnabled,
} from '../apps/hmh-reboot/src/opening-balance.mjs';

test('default run gives the player a two-second movement read and eight-second attack grace', () => {
  assert.equal(HMH_OPENING_MOVEMENT_HOLD_TICKS, 120);
  assert.equal(HMH_OPENING_ATTACK_GRACE_TICKS, 480);
  assert.deepEqual(HMH_OPENING_ENEMY_ARCHETYPE_IDS, ['bagholder-rusher', 'forkrunner']);
  assert.deepEqual(HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE, { 'bagholder-rusher': 24, forkrunner: 20 });
  assert.equal(openingEnemyMovementEnabled(119), false);
  assert.equal(openingEnemyMovementEnabled(120), true);
  assert.equal(openingEnemyAttacksEnabled(479), false);
  assert.equal(openingEnemyAttacksEnabled(480), true);
});

test('reboot runtime gates enemy movement and attacks through opening balance policy', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /openingEnemyMovementEnabled\(tick\)/);
  assert.match(source, /openingEnemyAttacksEnabled\(tick\)/);
  assert.match(source, /HMH_OPENING_ENEMY_ARCHETYPE_IDS\.map/);
  assert.match(source, /HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE\[archetypeId\]/);
});
