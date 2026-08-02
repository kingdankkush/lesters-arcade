import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ORDINARY_ENEMY_HURTBOX_POLICY,
  createOrdinaryEnemyHurtboxProfile,
} from '../apps/hmh-reboot/src/enemy-hurtboxes.mjs';
import {
  createHurtTarget,
  createProjectileState,
  resolveProjectilePath,
} from '../apps/hmh-reboot/src/projectile-physics.mjs';

const STANDARD_BODY_RADIUS = 18;
const AIM_ERROR_RADIUS = 30;
const SAMPLE_COUNT = 4_000;
const SAMPLE_SEED = 0x484d4833;

function targetFromProfile(id, profile) {
  return createHurtTarget({
    id,
    bodyShape: profile.bodyShape,
    hurtShape: profile.projectileShape,
    previousGround: { x: 0, y: 0, z: 0 },
    currentGround: { x: 0, y: 0, z: 0 },
    minZ: profile.minZ,
    maxZ: profile.maxZ,
    health: 100,
  });
}

function shot(id, y, previousX = -120, currentX = 120) {
  return createProjectileState({
    id,
    ownerId: 'hero',
    previous: { x: previousX, y, z: 34 },
    current: { x: currentX, y, z: 34 },
    radius: 2,
    damage: 1,
    policy: { type: 'stop' },
  });
}

function measureSeededHitRate(profile) {
  const enemy = targetFromProfile('measured-zombie', profile);
  let state = SAMPLE_SEED;
  let hits = 0;
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    const offset = ((state / 0x1_0000_0000) * 2 - 1) * AIM_ERROR_RADIUS;
    hits += resolveProjectilePath({ projectile: shot(`sample-${index}`, offset), targets: [enemy] }).hits.length;
  }
  return Object.freeze({ hits, samples: SAMPLE_COUNT, rate: hits / SAMPLE_COUNT });
}

function scheduleOutcome(stepsPerRenderFrame) {
  const profile = createOrdinaryEnemyHurtboxProfile(STANDARD_BODY_RADIUS);
  const enemy = targetFromProfile('schedule-zombie', profile);
  const offsets = [-29, -26, -22, -17, -8, 0, 8, 17, 22, 26, 29];
  const projectiles = offsets.map((y, index) => ({ id: `scheduled-${index}`, x: -96, y, active: true }));
  const events = [];
  let fixedTick = 0;
  while (fixedTick < 20) {
    const admitted = Math.min(stepsPerRenderFrame, 20 - fixedTick);
    for (let step = 0; step < admitted; step += 1) {
      fixedTick += 1;
      for (const projectile of projectiles) {
        if (!projectile.active) continue;
        const previousX = projectile.x;
        projectile.x += 12;
        const result = resolveProjectilePath({
          projectile: shot(`${projectile.id}:tick-${fixedTick}`, projectile.y, previousX, projectile.x),
          targets: [enemy],
        });
        if (result.hits.length === 0) continue;
        projectile.active = false;
        events.push(`${projectile.id}@${fixedTick}`);
      }
    }
  }
  return events;
}

test('ordinary enemy hurtboxes enlarge the vulnerable core without changing collision bodies', () => {
  const profile = createOrdinaryEnemyHurtboxProfile(STANDARD_BODY_RADIUS);
  // Cycle 045 (MAP-REDO slice 5, F1): swarm-forgiving growth — the vulnerable
  // radius reaches full body scale and the capsule lengthens, while the
  // 30-unit wide-miss guard below still bounds the policy.
  assert.equal(ORDINARY_ENEMY_HURTBOX_POLICY.id, 'cycle-045-swarm-forgiving-ordinary-enemy-hurtbox-v2');
  assert.equal(profile.bodyShape.radius, STANDARD_BODY_RADIUS);
  assert.equal(profile.projectileShape.type, 'capsule');
  assert.equal(profile.projectileShape.radius, 18);
  assert.equal(profile.meleeRadius, profile.projectileShape.radius);
  assert.deepEqual(profile.projectileShape.a, { x: 0, y: -9 });
  assert.deepEqual(profile.projectileShape.b, { x: 0, y: 9 });
  assert.equal(profile.minZ, 4);
  assert.equal(profile.maxZ, 60);
  assert.equal(Object.isFrozen(profile), true);
  assert.throws(() => createOrdinaryEnemyHurtboxProfile(0), /bodyRadius/);
});

test('seeded cross-track aim measurement improves ordinary-enemy hit rate without accepting broad misses', () => {
  const previousProfile = Object.freeze({
    bodyShape: Object.freeze({ type: 'circle', radius: STANDARD_BODY_RADIUS }),
    projectileShape: Object.freeze({
      type: 'capsule',
      a: Object.freeze({ x: 0, y: -8 }),
      b: Object.freeze({ x: 0, y: 8 }),
      radius: STANDARD_BODY_RADIUS * 0.72,
    }),
    minZ: 4,
    maxZ: 60,
  });
  const cycle033Profile = Object.freeze({
    bodyShape: Object.freeze({ type: 'circle', radius: STANDARD_BODY_RADIUS }),
    projectileShape: Object.freeze({
      type: 'capsule',
      a: Object.freeze({ x: 0, y: -8 }),
      b: Object.freeze({ x: 0, y: 8 }),
      radius: STANDARD_BODY_RADIUS * 0.9,
    }),
    minZ: 4,
    maxZ: 60,
  });
  const previous = measureSeededHitRate(previousProfile);
  const cycle033 = measureSeededHitRate(cycle033Profile);
  const candidateProfile = createOrdinaryEnemyHurtboxProfile(STANDARD_BODY_RADIUS);
  const candidate = measureSeededHitRate(candidateProfile);

  assert.ok(previous.rate >= 0.74 && previous.rate <= 0.79, `unexpected pre-033 baseline ${previous.rate}`);
  assert.ok(cycle033.rate >= 0.86 && cycle033.rate <= 0.89, `unexpected cycle-033 baseline ${cycle033.rate}`);
  assert.ok(candidate.rate - cycle033.rate >= 0.03, `expected >=3 percentage-point gain over cycle 033, got ${candidate.rate - cycle033.rate}`);
  assert.ok(candidate.rate < 0.97, `growth must stay bounded, got ${candidate.rate}`);
  assert.equal(resolveProjectilePath({
    projectile: shot('deliberate-wide-miss', 30),
    targets: [targetFromProfile('bounded-zombie', candidateProfile)],
  }).hits.length, 0, 'a 30-unit cross-track miss must remain a miss');
});

test('forgiving hurtbox contacts are identical across 60 30 and 20 fps render schedules', () => {
  const at60 = scheduleOutcome(1);
  const at30 = scheduleOutcome(2);
  const at20 = scheduleOutcome(3);
  assert.ok(at60.length > 0, 'schedule evidence must contain real hits');
  assert.deepEqual(at30, at60);
  assert.deepEqual(at20, at60);
});

test('the live runtime consumes the shared ordinary-enemy hurtbox profile for projectile and melee targeting', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /createOrdinaryEnemyHurtboxProfile\(enemy\.radius\)/);
  assert.doesNotMatch(source, /enemy\.radius \* 0\.72/);
  assert.match(source, /hurtShape:\s*profile\.projectileShape/);
  assert.match(source, /radius:\s*profile\.meleeRadius/);
});
