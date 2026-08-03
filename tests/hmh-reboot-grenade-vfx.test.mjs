import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGrenadeDangerProjection } from '../apps/hmh-reboot/src/grenade-vfx.mjs';

const grenade = Object.freeze({
  id: 'satoshi-frag:00000001',
  mode: 'hand',
  position: Object.freeze({ x: 120, y: 240, z: 8 }),
  spawnTick: 10,
  detonateTick: 49,
  blastRadius: 150,
});

test('grenade danger projection samples the authoritative blast radius on the ground plane', () => {
  const warning = buildGrenadeDangerProjection({ grenade, tick: 20, groundZ: 4 });
  assert.equal(warning.grenadeId, grenade.id);
  assert.equal(warning.mode, 'hand');
  assert.equal(warning.blastRadius, grenade.blastRadius);
  assert.equal(warning.remainingTicks, 29);
  assert.equal(warning.boundary.length, 32);
  assert.deepEqual(warning.center, { x: 120, y: 240, z: 4 });
  for (const point of warning.boundary) {
    assert.equal(point.z, 4);
    assert.ok(Math.abs(Math.hypot(point.x - warning.center.x, point.y - warning.center.y) - grenade.blastRadius) < 1e-9);
  }
});

test('grenade warning urgency is fixed-tick deterministic and reduced flash removes pulsing without hiding danger', () => {
  const normal = buildGrenadeDangerProjection({ grenade, tick: 40, groundZ: 0, reduceFlash: false });
  const repeated = buildGrenadeDangerProjection({ grenade, tick: 40, groundZ: 0, reduceFlash: false });
  const reduced = buildGrenadeDangerProjection({ grenade, tick: 40, groundZ: 0, reduceFlash: true });
  assert.deepEqual(normal, repeated);
  assert.equal(normal.urgent, true);
  assert.ok(normal.strokeAlpha > 0);
  assert.ok(normal.fillAlpha > 0);
  assert.notEqual(normal.pulseOffset, 0);
  assert.equal(reduced.pulseOffset, 0);
  assert.ok(reduced.strokeAlpha > 0, 'reduced flash must retain the danger boundary');
  assert.deepEqual(reduced.boundary, normal.boundary, 'accessibility settings must not change authoritative geometry');
});

test('grenade danger projection fails closed on corrupt renderer inputs', () => {
  assert.throws(() => buildGrenadeDangerProjection({ grenade: { ...grenade, blastRadius: 0 }, tick: 20, groundZ: 0 }), /blastRadius/i);
  assert.throws(() => buildGrenadeDangerProjection({ grenade, tick: -1, groundZ: 0 }), /tick/i);
  assert.throws(() => buildGrenadeDangerProjection({ grenade, tick: 20, groundZ: Number.NaN }), /groundZ/i);
});
