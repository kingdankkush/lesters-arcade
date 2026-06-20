import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_ACTOR_MANIFESTS,
  canonicalActorIdForRuntimeEntity,
  manifestEnemyArtKeyForRuntimeEntity,
} from '../apps/portal/src/canonical-actors.mjs';

test('canonicalActorIdForRuntimeEntity maps authored wasteland human variants onto real ingested actor manifests', () => {
  const claim = canonicalActorIdForRuntimeEntity({ id: 'claim-jumper' });
  const sheriff = canonicalActorIdForRuntimeEntity({ id: 'claim-jumper-sheriff' });
  const zealot = canonicalActorIdForRuntimeEntity({ id: 'scam-cult-zealot' });

  assert.equal(claim, 'evil-banker');
  assert.equal(sheriff, 'evil-banker');
  assert.equal(zealot, 'trench-degen');
  assert.ok(CANONICAL_ACTOR_MANIFESTS[claim]);
  assert.ok(CANONICAL_ACTOR_MANIFESTS[zealot]);
});


test('canonicalActorIdForRuntimeEntity and manifestEnemyArtKeyForRuntimeEntity map authored wasteland animal variants onto real runtime art families', () => {
  const coyote = { id: 'coyote-pack-runner', title: 'Coyote Pack Runner' };
  const scorpion = { id: 'scorpion-ambusher', title: 'Scorpion Ambusher' };
  const caveGoblin = { id: 'fud-goblin-cave', title: 'Cave FUD Goblin' };

  assert.equal(canonicalActorIdForRuntimeEntity(coyote), 'trench-degen');
  assert.equal(canonicalActorIdForRuntimeEntity(scorpion), 'gas-beast');
  assert.equal(canonicalActorIdForRuntimeEntity(caveGoblin), 'trench-degen');

  assert.equal(manifestEnemyArtKeyForRuntimeEntity(coyote), 'trenchDegen');
  assert.equal(manifestEnemyArtKeyForRuntimeEntity(scorpion), 'gasBeast');
  assert.equal(manifestEnemyArtKeyForRuntimeEntity(caveGoblin), 'trenchDegen');
});
