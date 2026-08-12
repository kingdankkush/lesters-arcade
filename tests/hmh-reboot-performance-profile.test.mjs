import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  RUNTIME_PERFORMANCE_PROFILES,
  compactExpiredEventsInPlace,
  isScreenPointVisible,
  selectAnimatedEnemyIds,
  selectRuntimePerformanceProfile,
} from '../apps/hmh-reboot/src/runtime-performance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('desktop and mobile performance profiles are immutable, bounded, and deterministic', () => {
  const desktop = selectRuntimePerformanceProfile({ width: 1440, devicePixelRatio: 2, coarsePointer: false, reduceMotion: false });
  const mobile = selectRuntimePerformanceProfile({ width: 390, devicePixelRatio: 3, coarsePointer: true, reduceMotion: false });
  assert.equal(desktop.id, 'desktop');
  assert.equal(desktop.resolution, 2);
  assert.equal(desktop.antialias, true);
  assert.equal(desktop.particlesPerHazard, 10);
  assert.equal(mobile.id, 'mobile');
  assert.equal(mobile.resolution, 1.25);
  assert.equal(mobile.antialias, false);
  assert.equal(mobile.particlesPerHazard, 6);
  assert.ok(mobile.worldCullMargin <= desktop.worldCullMargin);
  assert.ok(Object.values(RUNTIME_PERFORMANCE_PROFILES).every(Object.isFrozen));
});

test('reduced motion keeps authority untouched while lowering projection work', () => {
  const profile = selectRuntimePerformanceProfile({ width: 1440, devicePixelRatio: 1, coarsePointer: false, reduceMotion: true });
  assert.equal(profile.id, 'reduced-motion');
  assert.equal(profile.resolution, 1);
  assert.equal(profile.particlesPerHazard, 0);
  assert.ok(profile.maxAnimatedEnemies > 0);
});

test('screen culling uses inclusive margins and rejects malformed public inputs', () => {
  const view = { width: 390, height: 844 };
  assert.equal(isScreenPointVisible({ x: -96, y: 400 }, view, 96), true);
  assert.equal(isScreenPointVisible({ x: -96.01, y: 400 }, view, 96), false);
  assert.equal(isScreenPointVisible({ x: 486, y: 940 }, view, 96), true);
  assert.throws(() => isScreenPointVisible({ x: Number.NaN, y: 0 }, view, 0), /finite/);
  assert.throws(() => selectRuntimePerformanceProfile({ width: 0, devicePixelRatio: 1, coarsePointer: false, reduceMotion: false }), /width/);
});

test('effect compaction mutates one array in stable order without replacement allocation', () => {
  const events = [{ id: 'old', tick: 1 }, { id: 'keep-a', tick: 9 }, { id: 'keep-b', tick: 7 }];
  const identity = events;
  const result = compactExpiredEventsInPlace(events, 12, 5);
  assert.equal(result, identity);
  assert.deepEqual(events.map((event) => event.id), ['keep-a', 'keep-b']);
});

test('animation budget prioritizes visible combat readability before distance with stable ties', () => {
  const entries = [
    { id: 'idle-near', visible: true, distance: 5, state: 'idle' },
    { id: 'idle-tie-b', visible: true, distance: 20, state: 'idle' },
    { id: 'idle-tie-a', visible: true, distance: 20, state: 'idle' },
    { id: 'tell-far', visible: true, distance: 900, state: 'tell' },
    { id: 'hit-far', visible: true, distance: 800, state: 'hit' },
    { id: 'spawn-far', visible: true, distance: 700, state: 'idle', spawnCue: true },
    { id: 'elite-far', visible: true, distance: 600, state: 'idle', elite: true },
    { id: 'hidden-tell', visible: false, distance: 1, state: 'tell' },
  ];
  const selected = selectAnimatedEnemyIds(entries, 6);
  assert.deepEqual([...selected], ['tell-far', 'hit-far', 'spawn-far', 'elite-far', 'idle-near', 'idle-tie-a']);
  assert.deepEqual([...selectAnimatedEnemyIds([...entries].reverse(), 6)], [...selected]);
  assert.deepEqual([...selectAnimatedEnemyIds(entries, 0)], []);
  assert.throws(() => selectAnimatedEnemyIds(entries, -1), /cap/);
});

test('runtime routes profile into Pixi and world projection, and owns a browser performance gate', () => {
  const main = fs.readFileSync(path.join(root, 'apps/hmh-reboot/src/main.mjs'), 'utf8');
  const world = fs.readFileSync(path.join(root, 'apps/hmh-reboot/src/world-production-art.mjs'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(main, /selectRuntimePerformanceProfile/);
  assert.match(main, /antialias: performanceProfile\.antialias/);
  assert.match(main, /resolution: performanceProfile\.resolution/);
  assert.match(main, /performanceProfile,/);
  assert.match(main, /selectAnimatedEnemyIds/);
  assert.match(main, /Math\.min\(performanceProfile\.maxAnimatedEnemies, encounterAnimationCap\)/);
  assert.match(world, /isScreenPointVisible/);
  assert.match(world, /particlesPerHazard/);
  assert.equal(pkg.scripts['smoke:hmh:performance'], 'node scripts/hmh-reboot-performance-browser-smoke.mjs');
});
