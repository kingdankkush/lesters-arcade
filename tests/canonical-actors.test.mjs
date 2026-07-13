import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_ACTOR_MANIFESTS,
  canonicalActorIdForRuntimeEntity,
  manifestEnemyArtKeyForRuntimeEntity,
} from '../apps/portal/src/canonical-actors.mjs';

const WO93_STATES = ['idle', 'walk', 'run', 'shoot-pistol', 'shoot-shotgun', 'shoot-mg', 'melee', 'throw-grenade', 'hurt', 'death', 'dash', 'victory'];
const WO93_DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

test('canonicalActorIdForRuntimeEntity returns null for enemies with their own PixelLab sprite kits', () => {
  // These enemies now have their own harvested animation kits on PixelLab,
  // so canonicalActorIdForRuntimeEntity returns null to let the renderer
  // fall through to the bespoke kit path (BESPOKE_ENEMY_VISUAL_KITS).
  const claim = canonicalActorIdForRuntimeEntity({ id: 'claim-jumper' });
  const sheriff = canonicalActorIdForRuntimeEntity({ id: 'claim-jumper-sheriff' });
  const zealot = canonicalActorIdForRuntimeEntity({ id: 'scam-cult-zealot' });
  const coyote = canonicalActorIdForRuntimeEntity({ id: 'coyote-pack-runner' });
  const scorpion = canonicalActorIdForRuntimeEntity({ id: 'scorpion-ambusher' });
  const sybil = canonicalActorIdForRuntimeEntity({ id: 'sybil-drone' });

  assert.equal(claim, null, 'claim-jumper should use its own kit, not proxy');
  assert.equal(sheriff, null, 'claim-jumper-sheriff should use its own kit');
  assert.equal(zealot, null, 'scam-cult-zealot should use its own kit');
  assert.equal(coyote, null, 'coyote-pack-runner should use its own kit');
  assert.equal(scorpion, null, 'scorpion-ambusher should use its own kit');
  assert.equal(sybil, null, 'sybil-drone should use its own kit');
});

test('canonicalActorIdForRuntimeEntity still proxies enemies without own kits', () => {
  // Bandit captain and ridge raider still proxy to evil-banker.
  const captain = canonicalActorIdForRuntimeEntity({ id: 'bandit-captain' });
  const ridge = canonicalActorIdForRuntimeEntity({ id: 'ridge-raider' });
  const salvage = canonicalActorIdForRuntimeEntity({ id: 'salvage-mercenary' });

  assert.equal(captain, 'evil-banker');
  assert.equal(ridge, 'evil-banker');
  assert.equal(salvage, 'evil-banker');
  assert.ok(CANONICAL_ACTOR_MANIFESTS['evil-banker'], 'evil-banker manifest exists');
});

test('manifestEnemyArtKeyForRuntimeEntity returns null for enemies with own kits', () => {
  const coyote = { id: 'coyote-pack-runner', title: 'Coyote Pack Runner' };
  const scorpion = { id: 'scorpion-ambusher', title: 'Scorpion Ambusher' };
  const claim = { id: 'claim-jumper', title: 'Claim Jumper' };

  // These now return null because they have their own kits
  assert.equal(manifestEnemyArtKeyForRuntimeEntity(coyote), null);
  assert.equal(manifestEnemyArtKeyForRuntimeEntity(scorpion), null);
  assert.equal(manifestEnemyArtKeyForRuntimeEntity(claim), null);
});

test('canonical hero actors share the complete live animated roster matrices', () => {
  for (const hero of ['lester', 'lilly']) {
    const manifest = CANONICAL_ACTOR_MANIFESTS[hero];
    assert.equal(manifest.id, `${hero}-animated-roster-compat`);
    assert.deepEqual(Object.keys(manifest.states), WO93_STATES);
    assert.deepEqual(manifest.directions, WO93_DIRECTIONS);
    assert.match(manifest.source, /shared with live gameplay/);
    assert.equal(manifest.states['shoot-mg'].frames.east.length > 0, true);
    assert.equal(manifest.states['throw-grenade'].frames['south-west'].length > 0, true);
    assert.equal(manifest.states.dash.frames.north.length > 0, true);
  }
});
