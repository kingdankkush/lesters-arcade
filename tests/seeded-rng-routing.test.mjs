import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createRoguelikeRunState,
  chooseEnemySpawn,
  chooseRoguelikeUpgradeOptions,
} from '../apps/portal/src/arcade-core.mjs';
import {
  createSeededSubstreams,
  SeededRng,
} from '../apps/portal/src/seeded-rng.mjs';

function sampleWaveTwoRun(seed, steps = 10_000) {
  const run = createRoguelikeRunState({ seed, mode: 'free' });
  const streams = run.rngStreams;
  const spawnLog = [];
  const dropLog = [];
  const offerLog = [];

  for (let step = 0; step < steps; step += 1) {
    if (step % 37 === 0) {
      const spawnSeed = streams.spawns.int(0, 1_000_000_000);
      const spawn = chooseEnemySpawn({ elapsedSeconds: step / 60, seed: spawnSeed });
      spawnLog.push(`${step}:${spawn.enemy.id}:${spawn.ai?.aggression ?? 0}`);
    }
    if (step % 53 === 0) {
      dropLog.push(`${step}:${streams.drops.float().toFixed(6)}`);
    }
    if (step % 211 === 0) {
      const offer = chooseRoguelikeUpgradeOptions({ ...run, level: 1 + Math.floor(step / 211) }, { rng: streams.draft });
      offerLog.push(`${step}:${offer.options.map((option) => option.id).join(',')}`);
    }
  }

  return { spawnLog, dropLog, offerLog };
}

test('createSeededSubstreams gives independent deterministic named streams', () => {
  const a = createSeededSubstreams(4242, ['spawns', 'drops', 'boss', 'draft']);
  const b = createSeededSubstreams(4242, ['spawns', 'drops', 'boss', 'draft']);
  const c = createSeededSubstreams(4243, ['spawns', 'drops', 'boss', 'draft']);

  const firstSpawn = a.spawns.float();
  for (let i = 0; i < 100; i += 1) a.drops.float();
  const secondSpawn = a.spawns.float();

  assert.equal(firstSpawn, b.spawns.float(), 'same seed/substream should start identically');
  assert.equal(secondSpawn, b.spawns.float(), 'drawing from drops must not shift spawns');
  assert.notEqual(firstSpawn, c.spawns.float(), 'different base seeds should produce different substreams');
  assert.ok(a.boss instanceof SeededRng);
});

test('roguelike run state exposes stable gameplay RNG substreams', () => {
  const run = createRoguelikeRunState({ seed: 777, mode: 'free' });
  assert.equal(run.seed, 777);
  for (const name of ['spawns', 'drops', 'boss', 'draft', 'crit']) {
    assert.ok(run.rngStreams?.[name] instanceof SeededRng, `${name} stream missing from roguelikeRun`);
  }
});

test('headless seeded routing yields identical spawn/drop/offer logs for identical seeds', () => {
  const a = sampleWaveTwoRun(10101);
  const b = sampleWaveTwoRun(10101);
  const c = sampleWaveTwoRun(20202);

  assert.deepEqual(a, b);
  assert.notDeepEqual(a.spawnLog, c.spawnLog);
  assert.notDeepEqual(a.dropLog, c.dropLog);
  assert.notDeepEqual(a.offerLog, c.offerLog);
});

test('main.js Math.random usage is explicitly limited to cosmetic paths', () => {
  const source = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const offenders = source
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.includes('Math.random') && !line.includes('cosmetic-rng-ok'));

  assert.deepEqual(offenders, [], `Unannotated Math.random lines:\n${offenders.map((hit) => `${hit.number}: ${hit.line}`).join('\n')}`);
});
