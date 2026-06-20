import test from 'node:test';
import assert from 'node:assert/strict';

import { enemyStateFromEntity } from '../apps/portal/src/combat-sprite-bridge.mjs';

test('enemyStateFromEntity maps post-attack recovery into melee-counter readability state', () => {
  assert.equal(enemyStateFromEntity({ recovering: true }), 'melee-counter');
  assert.equal(enemyStateFromEntity({ countering: true }), 'melee-counter');
});

test('enemyStateFromEntity keeps attack and hit states ahead of recovery fallbacks', () => {
  assert.equal(enemyStateFromEntity({ recovering: true, attacking: true }), 'attack');
  assert.equal(enemyStateFromEntity({ recovering: true, hitFrames: 2 }), 'hit');
});

test('enemyStateFromEntity maps authored ambush verbs into readable telegraph, strike, and recovery states', () => {
  assert.equal(enemyStateFromEntity({ burrowing: true }), 'attack-tell');
  assert.equal(enemyStateFromEntity({ lunging: true }), 'attack');
  assert.equal(enemyStateFromEntity({ reloading: true }), 'melee-counter');
});
