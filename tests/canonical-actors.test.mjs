import test from 'node:test';
import assert from 'node:assert/strict';

import { CANONICAL_ACTOR_MANIFESTS, CANONICAL_ACTOR_ROLES } from '../apps/portal/src/canonical-actors.mjs';
import { validateSpriteManifest } from '../apps/portal/src/sprite-pipeline.mjs';
import { buildActorRegistry, resolveActorFrame } from '../apps/portal/src/combat-sprite-bridge.mjs';

const fakeLoader = (src) => (src ? { __src: src } : null);

test('canonical enemy manifests expose combat-readability states for runtime animation bridging', () => {
  const enemyIds = [...CANONICAL_ACTOR_ROLES.enemies, ...CANONICAL_ACTOR_ROLES.bosses];

  for (const actorId of enemyIds) {
    const manifest = CANONICAL_ACTOR_MANIFESTS[actorId];
    const validation = validateSpriteManifest(manifest);
    assert.equal(validation.ok, true, `${actorId} manifest validates`);
    assert.ok(manifest.states.attack, `${actorId} has an attack state`);
    assert.ok(manifest.states.walk || manifest.states.run, `${actorId} has locomotion coverage`);
    assert.ok(manifest.states['attack-tell'], `${actorId} has an attack-tell state`);
    assert.ok(manifest.states.hit, `${actorId} has a hit state`);
    assert.ok(manifest.states.death, `${actorId} has a death state`);
  }
});

test('combat sprite bridge can resolve derived readability frames for canonical enemies and bosses', () => {
  const registry = buildActorRegistry(CANONICAL_ACTOR_MANIFESTS, fakeLoader);

  const trenchTell = resolveActorFrame(registry, 'trench-degen', { state: 'attack-tell', direction: 'south', clock: 0 });
  assert.match(trenchTell.src, /trench-degen\/attack\/attack-\d+\.png$/);

  const bankerHit = resolveActorFrame(registry, 'evil-banker', { state: 'hit', direction: 'south', clock: 0 });
  assert.match(bankerHit.src, /evil-banker\/(health-75|health-50|attack|idle)\//);

  const cryptoDeath = resolveActorFrame(registry, 'crypto-bro', { state: 'death', direction: 'south', clock: 120 });
  assert.match(cryptoDeath.src, /crypto-bro\/(attack|jump|run|idle)\//);

  const warrenDeath = resolveActorFrame(registry, 'warren-boss', { state: 'death', direction: 'south', clock: 0 });
  assert.match(warrenDeath.src, /warren-boss\/(health-50|health-75|idle)\//);
});
