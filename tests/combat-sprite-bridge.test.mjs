import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildActorRegistry,
  enemyStateFromEntity,
  prewarmActorRegistry,
  prewarmSelectedHeroActorRegistry,
} from '../apps/portal/src/combat-sprite-bridge.mjs';

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

test('enemyStateFromEntity gives newly spawned enemies a visible spawn-in before movement or telegraphing', () => {
  assert.equal(enemyStateFromEntity({ spawnFrames: 12, moving: true }), 'spawn-in');
  assert.equal(enemyStateFromEntity({ spawning: true, telegraphing: true }), 'spawn-in');
  assert.equal(enemyStateFromEntity({ spawnFrames: 12, hitFrames: 1 }), 'hit');
});

test('prewarmActorRegistry caches requested actor frame sources only', () => {
  const loaded = [];
  const registry = buildActorRegistry({
    hero: {
      id: 'hero',
      frameSize: [16, 16],
      directions: ['south'],
      states: { idle: { frames: { south: ['a.png', 'b.png'] } } },
    },
    enemy: {
      id: 'enemy',
      frameSize: [16, 16],
      directions: ['south'],
      states: { idle: { frames: { south: ['c.png'] } } },
    },
  }, (src) => {
    loaded.push(src);
    return { src };
  });
  assert.equal(prewarmActorRegistry(registry, ['hero']), 2);
  assert.deepEqual(loaded, ['a.png', 'b.png']);
});

test('selected hero prewarm loads only the active canonical hero opening states', () => {
  const loaded = [];
  const actor = (prefix) => ({
    id: prefix,
    frameSize: [16, 16],
    directions: ['south'],
    states: {
      idle: { frames: { south: [`${prefix}-idle.png`] } },
      run: { frames: { south: [`${prefix}-run.png`] } },
      shoot: { frames: { south: [`${prefix}-shoot.png`] } },
      death: { frames: { south: [`${prefix}-death.png`] } },
    },
  });
  const registry = buildActorRegistry({ lester: actor('lester'), lilly: actor('lilly') }, (src) => {
    loaded.push(src);
    return { src };
  });

  assert.equal(prewarmSelectedHeroActorRegistry(registry, 'lester-original'), 3);
  assert.deepEqual(loaded, ['lester-idle.png', 'lester-run.png', 'lester-shoot.png']);
  assert.equal(prewarmSelectedHeroActorRegistry(registry, 'lit-commando'), 0);
});

test('portal does not prewarm every canonical hero during landing-module initialization', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(mainSource, /const HMH_PREWARMED_HERO_FRAME_COUNT = prewarmActorRegistry/);
  assert.match(mainSource, /prewarmSelectedHeroActorRegistry\(HMH_ACTOR_REGISTRY, combat\.characterId\)/);
});
