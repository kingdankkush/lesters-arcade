import assert from 'node:assert/strict';
import test from 'node:test';

import {
  UniformHurtboxGrid,
  correctMuzzleAim,
  createHurtTarget,
  createProjectileState,
  queryProjectileCandidates,
  resolveProjectileBatch,
  resolveProjectilePath,
} from '../apps/hmh-reboot/src/projectile-physics.mjs';

function target(id, x, y, options = {}) {
  return createHurtTarget({
    id,
    bodyShape: { type: 'circle', radius: options.bodyRadius ?? 18 },
    hurtShape: options.hurtShape ?? { type: 'circle', radius: options.hurtRadius ?? 14 },
    previousGround: options.previousGround ?? { x, y, z: options.z ?? 0 },
    currentGround: options.currentGround ?? { x, y, z: options.z ?? 0 },
    minZ: options.minZ ?? 4,
    maxZ: options.maxZ ?? 58,
    health: options.health ?? 20,
    active: options.active ?? true,
  });
}

function projectile(id, from, to, options = {}) {
  return createProjectileState({
    id,
    ownerId: options.ownerId ?? 'hero',
    previous: { ...from, z: from.z ?? 28 },
    current: { ...to, z: to.z ?? 28 },
    radius: options.radius ?? 2,
    damage: options.damage ?? 5,
    policy: options.policy ?? { type: 'stop' },
  });
}

test('hurt targets validate independent gameplay body and hurt shapes at a ground contact', () => {
  const enemy = createHurtTarget({
    id: 'enemy-a',
    bodyShape: { type: 'circle', radius: 18 },
    hurtShape: { type: 'capsule', a: { x: 0, y: -8 }, b: { x: 0, y: 8 }, radius: 11 },
    previousGround: { x: 20, y: 30, z: 4 },
    currentGround: { x: 24, y: 30, z: 4 },
    minZ: 3,
    maxZ: 61,
    health: 10,
  });
  assert.equal(enemy.bodyShape.radius, 18);
  assert.equal(enemy.hurtShape.type, 'capsule');
  assert.notEqual(enemy.bodyShape, enemy.hurtShape);
  assert.deepEqual(enemy.currentGround, { x: 24, y: 30, z: 4 });
  assert.equal(Object.isFrozen(enemy), true);
  assert.throws(() => createHurtTarget({ id: '', bodyShape: { type: 'circle', radius: 2 }, hurtShape: { type: 'circle', radius: 2 }, previousGround: { x: 0, y: 0, z: 0 }, currentGround: { x: 0, y: 0, z: 0 }, minZ: 5, maxZ: 4, health: 1 }), /id|height/);
});

test('projectiles preserve previous and current positions for swept collision and tracer rendering', () => {
  const shot = projectile('bullet-a', { x: 0, y: 0, z: 32 }, { x: 800, y: 0, z: 32 });
  assert.deepEqual(shot.previous, { x: 0, y: 0, z: 32 });
  assert.deepEqual(shot.current, { x: 800, y: 0, z: 32 });
  assert.equal(Object.isFrozen(shot.previous), true);
});

test('simple scan and uniform grid return the same deterministic broadphase candidates', () => {
  const targets = [target('c', 70, 70), target('a', 30, 0), target('b', 65, 3), target('far', 600, 600)];
  const shot = projectile('query', { x: 0, y: 0 }, { x: 100, y: 0 });
  const scan = queryProjectileCandidates({ projectile: shot, targets });
  const grid = new UniformHurtboxGrid({ targets, cellSize: 48 });
  assert.deepEqual(scan.map(({ id }) => id), ['a', 'b']);
  assert.deepEqual(grid.query(shot).map(({ id }) => id), scan.map(({ id }) => id));
  assert.deepEqual(grid.query(shot).map(({ id }) => id), ['a', 'b'], 'query order must not depend on insertion order');
});

test('projectile resolution consumes the selected uniform-grid broadphase', () => {
  const near = target('near-but-excluded', 30, 0);
  const far = target('far-grid-target', 80, 0);
  const broadphase = new UniformHurtboxGrid({ targets: [far], cellSize: 32 });
  const result = resolveProjectilePath({
    projectile: projectile('grid-shot', { x: 0, y: 0, z: 30 }, { x: 120, y: 0, z: 30 }),
    targets: [near, far],
    broadphase,
  });
  assert.deepEqual(result.hits.map((hit) => hit.targetId), ['far-grid-target']);
});

test('batch resolution maps grid candidates onto current health state', () => {
  const near = target('batch-near-excluded', 30, 0);
  const far = target('batch-far', 80, 0, { health: 5 });
  const broadphase = new UniformHurtboxGrid({ targets: [far], cellSize: 32 });
  const result = resolveProjectileBatch({
    projectiles: [projectile('batch-grid-shot', { x: 0, y: 0 }, { x: 120, y: 0 }, { damage: 5 })],
    targets: [near, far],
    broadphase,
  });
  assert.deepEqual(result.damageEvents.map((event) => event.targetId), ['batch-far']);
  assert.equal(result.remainingHealth['batch-far'], 0);
});

test('swept collision hits a fast bullet crossing a target in one fixed step', () => {
  const result = resolveProjectilePath({
    projectile: projectile('fast', { x: -1000, y: 0 }, { x: 1000, y: 0 }),
    targets: [target('enemy', 0, 0)],
  });
  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].targetId, 'enemy');
  assert.ok(result.hits[0].time > 0 && result.hits[0].time < 1);
});

test('relative sweep catches a fast target crossing a stationary projectile path during a frame stall', () => {
  const crossing = target('crossing', 50, -100, {
    previousGround: { x: 50, y: -100, z: 0 },
    currentGround: { x: 50, y: 100, z: 0 },
  });
  const result = resolveProjectilePath({ projectile: projectile('stall', { x: 0, y: 0 }, { x: 100, y: 0 }), targets: [crossing] });
  assert.equal(result.hits[0]?.targetId, 'crossing');
});

test('overlapping targets resolve earliest time then stable target id', () => {
  const result = resolveProjectilePath({
    projectile: projectile('tie', { x: 0, y: 0 }, { x: 100, y: 0 }),
    targets: [target('z-target', 50, 0), target('a-target', 50, 0)],
  });
  assert.deepEqual(result.hits.map(({ targetId }) => targetId), ['a-target']);
});

test('projectiles reject the wrong elevation layer and hit the matching bridge layer', () => {
  const low = target('under-bridge', 50, 0, { z: 0, minZ: 0, maxZ: 20 });
  const bridge = target('on-bridge', 50, 0, { z: 48, minZ: 0, maxZ: 32 });
  const result = resolveProjectilePath({ projectile: projectile('bridge-shot', { x: 0, y: 0, z: 64 }, { x: 100, y: 0, z: 64 }), targets: [low, bridge] });
  assert.deepEqual(result.hits.map(({ targetId }) => targetId), ['on-bridge']);
});

test('low decoration is ignored while high cover blocks the same bullet', () => {
  const base = {
    shape: { type: 'circle', x: 40, y: 0, radius: 6 },
    visibleAssetId: 'cover-art',
    solid: true,
  };
  const low = { ...base, id: 'low-prop', minZ: 0, maxZ: 12, combatCover: false };
  const high = { ...base, id: 'high-cover', minZ: 0, maxZ: 72, combatCover: true };
  const shot = projectile('cover-shot', { x: 0, y: 0, z: 32 }, { x: 100, y: 0, z: 32 });
  assert.equal(resolveProjectilePath({ projectile: shot, targets: [target('enemy', 70, 0)], blockers: [low] }).hits[0].targetId, 'enemy');
  const blocked = resolveProjectilePath({ projectile: shot, targets: [target('enemy', 70, 0)], blockers: [high] });
  assert.equal(blocked.hits.length, 0);
  assert.equal(blocked.coverHit.blockerId, 'high-cover');
});

test('pierce hits unique targets in path order without duplicate damage', () => {
  const result = resolveProjectilePath({
    projectile: projectile('pierce', { x: 0, y: 0 }, { x: 140, y: 0 }, { policy: { type: 'pierce', maxTargets: 2 } }),
    targets: [target('second', 90, 0), target('first', 40, 0)],
  });
  assert.deepEqual(result.hits.map(({ targetId }) => targetId), ['first', 'second']);
});

test('pellet and hitscan policies still resolve a straight earliest-hit path', () => {
  for (const type of ['pellet', 'hitscan']) {
    const result = resolveProjectilePath({ projectile: projectile(type, { x: 0, y: 0 }, { x: 100, y: 0 }, { policy: { type } }), targets: [target('near', 30, 0), target('far', 70, 0)] });
    assert.deepEqual(result.hits.map(({ targetId }) => targetId), ['near']);
    assert.equal(result.policyType, type);
  }
});

test('splash applies at most one damage event per target including the direct target', () => {
  const result = resolveProjectilePath({
    projectile: projectile('splash', { x: 0, y: 0 }, { x: 60, y: 0 }, { policy: { type: 'splash', radius: 45 } }),
    targets: [target('direct', 50, 0), target('nearby', 70, 0), target('outside', 150, 0)],
  });
  assert.deepEqual(result.hits.map(({ targetId }) => targetId).sort(), ['direct', 'nearby']);
  assert.equal(result.hits.filter(({ targetId }) => targetId === 'direct').length, 1);
});

test('splash broadphase includes targets inside the blast but outside the direct path bounds', () => {
  const result = resolveProjectilePath({
    projectile: projectile('offset-splash', { x: 0, y: 0 }, { x: 60, y: 0 }, { policy: { type: 'splash', radius: 45 } }),
    targets: [target('direct', 50, 0), target('offset-nearby', 50, 38, { hurtRadius: 4 })],
  });
  assert.deepEqual(result.hits.map(({ targetId }) => targetId).sort(), ['direct', 'offset-nearby']);
});

test('ricochet broadphase includes targets reached only by the reflected segment', () => {
  const angledWall = {
    id: 'angled-wall', visibleAssetId: 'angled-wall-art', solid: true, combatCover: true,
    minZ: 0, maxZ: 80,
    shape: { type: 'capsule', a: { x: 50, y: -30 }, b: { x: 110, y: 30 }, radius: 2 },
  };
  const result = resolveProjectilePath({
    projectile: projectile('angled-ricochet', { x: 0, y: 0 }, { x: 120, y: 0 }, { policy: { type: 'ricochet', maxBounces: 1 } }),
    targets: [target('reflected-only', 76, 22, { hurtRadius: 5 })],
    blockers: [angledWall],
  });
  assert.equal(result.ricochets, 1);
  assert.deepEqual(result.hits.map(({ targetId }) => targetId), ['reflected-only']);
  assert.ok(result.hits[0].point.y > 8, 'reflected hit point must lie on the reflected segment');
});

test('ricochet reflects from combat cover and never damages the same target twice', () => {
  const wall = {
    id: 'wall', visibleAssetId: 'wall-art', solid: true, combatCover: true,
    minZ: 0, maxZ: 80,
    shape: { type: 'capsule', a: { x: 70, y: -40 }, b: { x: 70, y: 40 }, radius: 2 },
  };
  const result = resolveProjectilePath({
    projectile: projectile('ricochet', { x: 0, y: 0 }, { x: 100, y: 0 }, { policy: { type: 'ricochet', maxBounces: 1 } }),
    targets: [target('before-wall', 35, 0)],
    blockers: [wall],
  });
  assert.equal(result.ricochets, 1);
  assert.equal(result.hits.filter(({ targetId }) => targetId === 'before-wall').length, 1);
});

test('batch resolution stops targeting an enemy after an earlier projectile kills it', () => {
  const result = resolveProjectileBatch({
    projectiles: [
      projectile('b-shot', { x: 0, y: 0 }, { x: 100, y: 0 }, { damage: 5 }),
      projectile('a-shot', { x: 0, y: 0 }, { x: 100, y: 0 }, { damage: 5 }),
    ],
    targets: [target('fragile', 50, 0, { health: 5 })],
  });
  assert.equal(result.damageEvents.length, 1);
  assert.equal(result.damageEvents[0].projectileId, 'a-shot', 'projectiles resolve in stable id order');
  assert.equal(result.remainingHealth.fragile, 0);
});

test('straight muzzle correction points once toward the target without curved trajectory state', () => {
  const correction = correctMuzzleAim({
    muzzle: { x: 10, y: 10, z: 30 },
    target: { x: 110, y: 30, z: 34 },
    requestedDirection: { x: 1, y: 0 },
    maxCorrectionRadians: Math.PI / 4,
  });
  assert.ok(correction.direction.y > 0);
  assert.deepEqual(Object.keys(correction).sort(), ['direction', 'end', 'origin']);
  assert.deepEqual(correction.origin, { x: 10, y: 10, z: 30 });
});

test('invalid projectile policy grid and duplicate target identifiers fail closed', () => {
  assert.throws(() => projectile('bad', { x: 0, y: 0 }, { x: 1, y: 1 }, { policy: { type: 'teleport' } }), /policy/);
  assert.throws(() => new UniformHurtboxGrid({ targets: [], cellSize: 0 }), /cellSize/);
  assert.throws(() => resolveProjectilePath({ projectile: projectile('duplicate', { x: 0, y: 0 }, { x: 1, y: 1 }), targets: [target('same', 0, 0), target('same', 2, 0)] }), /duplicate target id/);
});

test('projectile flight settles downward only: ledge shots connect, uphill shots do not', () => {
  const FLIGHT_HEIGHT = 34;
  const DESCENT_RATE = 1_200;
  const SPEED = 900;
  const dt = 1 / 60;

  // Mirrors the main.mjs settle rule across a terrain step at x = 100.
  function fire({ shooterGround, targetGround, targetX }) {
    const groundAt = (x) => (x < 100 ? shooterGround : targetGround);
    const enemy = target('step-enemy', targetX, 0, { z: targetGround, maxZ: 60 });
    let x = 0;
    let z = shooterGround + FLIGHT_HEIGHT;
    for (let tick = 0; tick < 40 && x < 400; tick += 1) {
      const previous = { x, y: 0, z };
      x += SPEED * dt;
      const restZ = groundAt(x) + FLIGHT_HEIGHT;
      z = z <= restZ ? z : Math.max(restZ, z - DESCENT_RATE * dt);
      const shot = createProjectileState({
        id: 'p', ownerId: 'hero', previous, current: { x, y: 0, z },
        radius: 2, damage: 5, policy: { type: 'stop' },
      });
      if (resolveProjectilePath({ projectile: shot, targets: [enemy], blockers: [] }).hits.length > 0) return true;
    }
    return false;
  }

  // Firing down off authored high ground must connect with the level below.
  assert.equal(fire({ shooterGround: 64, targetGround: 0, targetX: 250 }), true, 'ravine-overlook ledge shot');
  assert.equal(fire({ shooterGround: 48, targetGround: 0, targetX: 250 }), true, 'mining-loader-deck shot');
  assert.equal(fire({ shooterGround: 16, targetGround: 0, targetX: 250 }), true, 'small step down');
  assert.equal(fire({ shooterGround: 0, targetGround: 0, targetX: 250 }), true, 'flat ground');
  // The elevation contract still holds: high ground cannot be shot from below.
  assert.equal(fire({ shooterGround: 0, targetGround: 64, targetX: 250 }), false, 'must not shoot up onto a ledge');
  assert.equal(fire({ shooterGround: 0, targetGround: 48, targetX: 250 }), false, 'must not shoot up onto a deck');
});

test('main spawns and advances projectiles at flight height over the ground beneath them', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /const restZ = queryGround\(nextX, nextY\)\.groundZ \+ PROJECTILE_FLIGHT_HEIGHT/, 'projectile flight must settle toward ground height');
  assert.match(source, /shot\.z <= restZ\s*\?\s*shot\.z/, 'projectiles must never rise toward a higher ground band');
  assert.match(source, /PROJECTILE_DESCENT_RATE/, 'the descent must be rate-bounded rather than a vertical teleport');
});
