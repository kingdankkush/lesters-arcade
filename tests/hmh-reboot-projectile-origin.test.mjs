import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createHurtTarget, createProjectileState, resolveProjectileBatch } from '../apps/hmh-reboot/src/projectile-physics.mjs';

test('first projectile sweep hits a point-blank enemy between actor and muzzle', () => {
  const projectile = createProjectileState({
    id: 'point-blank-shot',
    ownerId: 'player',
    previous: { x: 0, y: 0, z: 30 },
    current: { x: 40, y: 0, z: 30 },
    radius: 3,
    damage: 12,
    policy: { type: 'stop' },
  });
  const target = createHurtTarget({
    id: 'overlapping-enemy',
    bodyShape: { type: 'circle', radius: 18 },
    hurtShape: { type: 'circle', radius: 14 },
    previousGround: { x: 10, y: 0, z: 0 },
    currentGround: { x: 10, y: 0, z: 0 },
    minZ: 4,
    maxZ: 60,
    health: 40,
  });
  const result = resolveProjectileBatch({ projectiles: [projectile], targets: [target] });
  assert.equal(result.resolutions[0].hits[0]?.targetId, 'overlapping-enemy');
});

test('runtime preserves actor origin for the first authoritative projectile sweep', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /previousX: actor\.x/);
  assert.match(source, /shot\.previousX \?\? shot\.x/);
});
