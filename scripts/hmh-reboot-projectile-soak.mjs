import assert from 'node:assert/strict';
import {
  UniformHurtboxGrid,
  createHurtTarget,
  createProjectileState,
  resolveProjectileBatch,
} from '../apps/hmh-reboot/src/projectile-physics.mjs';
import { ensureExplicitGc } from './hmh-soak-explicit-gc.mjs';

ensureExplicitGc(import.meta.url);

const TICKS = 60 * 60;
const CAPACITY = 128;
const SPAWNS_PER_TICK = 4;

function targets() {
  return Array.from({ length: 150 }, (_, index) => createHurtTarget({
    id: `soak-target-${String(index).padStart(3, '0')}`,
    bodyShape: { type: 'circle', radius: 14 },
    hurtShape: { type: 'circle', radius: 10 },
    previousGround: { x: 5000 + (index % 15) * 48, y: 5000 + Math.floor(index / 15) * 48, z: 0 },
    currentGround: { x: 5000 + (index % 15) * 48, y: 5000 + Math.floor(index / 15) * 48, z: 0 },
    minZ: 0,
    maxZ: 60,
    health: 1_000_000,
  }));
}

function hashInt(hash, value) {
  return Math.imul(hash ^ (value >>> 0), 16777619) >>> 0;
}

function run() {
  const hurtTargets = targets();
  const broadphase = new UniformHurtboxGrid({ targets: hurtTargets, cellSize: 96 });
  let active = [];
  let sequence = 0;
  let drops = 0;
  let peakActive = 0;
  let resolutions = 0;
  let hash = 2166136261;
  for (let tick = 0; tick < TICKS; tick += 1) {
    const stepped = active.map((shot) => {
      const previous = { x: shot.x, y: shot.y, z: 32 };
      const current = { x: shot.x + shot.vx / 60, y: shot.y + shot.vy / 60, z: 32 };
      const state = createProjectileState({
        id: shot.id,
        ownerId: 'soak-player',
        previous,
        current,
        radius: 2,
        damage: 3,
        policy: { type: 'stop' },
      });
      return { ...shot, x: current.x, y: current.y, remaining: shot.remaining - 20, state };
    });
    const batch = resolveProjectileBatch({
      projectiles: stepped.map(({ state }) => state),
      targets: hurtTargets,
      broadphase,
    });
    resolutions += batch.resolutions.length;
    const terminated = new Set(batch.resolutions.filter((result) => result.hits.length > 0 || result.coverHit).map((result) => result.projectileId));
    active = stepped.filter((shot) => shot.remaining > 0 && !terminated.has(shot.id));
    for (let spawn = 0; spawn < SPAWNS_PER_TICK; spawn += 1) {
      if (active.length >= CAPACITY) {
        drops += 1;
        continue;
      }
      const angle = ((sequence * 137.50776405) % 360) * Math.PI / 180;
      active.push({
        id: `soak-shot-${String(sequence).padStart(6, '0')}`,
        x: 1024,
        y: 1024,
        vx: Math.cos(angle) * 1200,
        vy: Math.sin(angle) * 1200,
        remaining: 1200,
      });
      sequence += 1;
    }
    peakActive = Math.max(peakActive, active.length);
    hash = hashInt(hash, active.length);
    hash = hashInt(hash, drops);
  }
  return { hash: hash.toString(16).padStart(8, '0'), peakActive, drops, spawned: sequence, resolutions, activeAtEnd: active.length };
}

if (global.gc) global.gc();
const heapBefore = process.memoryUsage().heapUsed;
const first = run();
if (global.gc) global.gc();
const heapAfter = process.memoryUsage().heapUsed;
const second = run();
assert.deepEqual(second, first);
assert.ok(first.peakActive <= CAPACITY);
assert.ok(first.drops > 0, 'stress should exercise deterministic drop accounting');
const heapDeltaBytes = heapAfter - heapBefore;
assert.ok(heapDeltaBytes < 16 * 1024 * 1024, `heap grew by ${heapDeltaBytes} bytes`);
console.log(JSON.stringify({ status: 'PASS', ticks: TICKS, targets: 150, capacity: CAPACITY, ...first, heapDeltaBytes }));
