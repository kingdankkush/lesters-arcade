import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditCollisionWorld,
  createCollisionBody,
  createStaticBlocker,
  resolveSweptCircleMotion,
} from '../apps/hmh-reboot/src/collision.mjs';

const player = createCollisionBody({ id: 'player', kind: 'player', radius: 12, minZ: 0, maxZ: 42 });

function move(start, delta, blockers = [], options = {}) {
  return resolveSweptCircleMotion({ body: player, start, delta, blockers, ...options });
}

test('authored collision rejects invisible solids and audits visible geometry in both directions', () => {
  const wall = createStaticBlocker({
    id: 'wall-a',
    shape: { type: 'polygon', vertices: [{ x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 100 }, { x: 40, y: 100 }] },
    visibleAssetId: 'concrete-wall-a',
    minZ: 0,
    maxZ: 80,
  });
  assert.equal(wall.id, 'wall-a');
  assert.throws(() => createStaticBlocker({ id: 'ghost', shape: { type: 'circle', x: 0, y: 0, radius: 5 } }), /visible/i);

  const unbackedAudit = auditCollisionWorld({
    blockers: [wall],
    visibleBarriers: [
      { id: 'concrete-wall-a', hard: true, collisionBlockerIds: ['wall-a'] },
      { id: 'unbacked-fence', hard: true, collisionBlockerIds: [] },
    ],
  });
  assert.deepEqual(unbackedAudit.errors, ['visible hard barrier unbacked-fence has no collision geometry']);

  const orphan = createStaticBlocker({
    id: 'orphan',
    shape: { type: 'circle', x: 120, y: 20, radius: 8 },
    visibleAssetId: 'orphan-art',
  });
  const reverseAudit = auditCollisionWorld({
    blockers: [wall, orphan],
    visibleBarriers: [
      { id: 'concrete-wall-a', hard: true, collisionBlockerIds: ['wall-a'] },
      { id: 'phantom-art', hard: true, collisionBlockerIds: ['missing'] },
    ],
  });
  assert.deepEqual(reverseAudit.errors, [
    'solid blocker orphan has no matching visible barrier orphan-art',
    'visible hard barrier phantom-art references missing blocker missing',
  ]);
});

test('high-speed circle sweep cannot tunnel through an authored circle', () => {
  const blocker = createStaticBlocker({
    id: 'tank',
    shape: { type: 'circle', x: 100, y: 0, radius: 20 },
    visibleAssetId: 'tank-prop',
  });
  const result = move({ x: 0, y: 0, z: 0 }, { x: 300, y: 0 }, [blocker]);
  assert.ok(result.position.x <= 68.001 && result.position.x >= 67.99);
  assert.equal(result.position.y, 0);
  assert.equal(result.contacts[0].blockerId, 'tank');
  assert.deepEqual(result.contacts[0].normal, { x: -1, y: 0 });
});

test('capsule sweeps and deterministic tie breaking choose the stable blocker id', () => {
  const make = (id) => createStaticBlocker({
    id,
    shape: { type: 'capsule', a: { x: 80, y: -30 }, b: { x: 80, y: 30 }, radius: 4 },
    visibleAssetId: `rail-${id}`,
  });
  const result = move({ x: 0, y: 0, z: 0 }, { x: 200, y: 0 }, [make('z-rail'), make('a-rail')]);
  assert.equal(result.contacts[0].blockerId, 'a-rail');
  assert.ok(result.position.x <= 64.001);
});

test('convex polygon collision preserves tangential motion for corner sliding', () => {
  const wall = createStaticBlocker({
    id: 'long-wall',
    shape: { type: 'polygon', vertices: [{ x: 50, y: -100 }, { x: 70, y: -100 }, { x: 70, y: 100 }, { x: 50, y: 100 }] },
    visibleAssetId: 'long-wall-prop',
  });
  const result = move({ x: 0, y: 0, z: 0 }, { x: 100, y: 80 }, [wall]);
  assert.ok(result.position.x <= 38.001, `x=${result.position.x}`);
  assert.ok(result.position.y > 60, `y=${result.position.y}`);
  assert.equal(result.contacts[0].blockerId, 'long-wall');
});

test('deterministic depenetration moves an overlapping body out before applying movement', () => {
  const blocker = createStaticBlocker({
    id: 'boulder',
    shape: { type: 'circle', x: 0, y: 0, radius: 20 },
    visibleAssetId: 'boulder-prop',
  });
  const first = move({ x: 0, y: 0, z: 0 }, { x: 0, y: 0 }, [blocker]);
  const second = move({ x: 0, y: 0, z: 0 }, { x: 0, y: 0 }, [blocker]);
  assert.deepEqual(first.position, second.position);
  assert.ok(Math.hypot(first.position.x, first.position.y) >= 31.999);
  assert.equal(first.depenetrations[0].blockerId, 'boulder');
});

test('world boundaries use the same radius-aware sweep and slide contract', () => {
  const result = move(
    { x: 50, y: 50, z: 0 },
    { x: 100, y: 60 },
    [],
    { bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, visibleBoundaryId: 'cliff-ring' } },
  );
  assert.ok(result.position.x <= 88.001);
  assert.ok(result.position.y <= 88.001);
  assert.ok(result.contacts.some((contact) => contact.blockerId === 'cliff-ring:right'));
  assert.ok(result.contacts.some((contact) => contact.blockerId === 'cliff-ring:bottom'));
});

test('height-disjoint blockers do not collide while overlapping height bands do', () => {
  const bridgeRail = createStaticBlocker({
    id: 'bridge-rail',
    shape: { type: 'circle', x: 50, y: 0, radius: 8 },
    visibleAssetId: 'bridge-rail-prop',
    minZ: 64,
    maxZ: 90,
  });
  const below = move({ x: 0, y: 0, z: 0 }, { x: 100, y: 0 }, [bridgeRail]);
  const onDeck = move({ x: 0, y: 0, z: 64 }, { x: 100, y: 0 }, [bridgeRail]);
  assert.equal(below.contacts.length, 0);
  assert.equal(below.position.x, 100);
  assert.equal(onDeck.contacts[0].blockerId, 'bridge-rail');
});

test('narrow routes remain passable at exact body clearance and obstacle chains do not tunnel', () => {
  const blockers = [
    createStaticBlocker({ id: 'top', shape: { type: 'capsule', a: { x: 0, y: -13 }, b: { x: 200, y: -13 }, radius: 1 }, visibleAssetId: 'top-fence' }),
    createStaticBlocker({ id: 'bottom', shape: { type: 'capsule', a: { x: 0, y: 13 }, b: { x: 200, y: 13 }, radius: 1 }, visibleAssetId: 'bottom-fence' }),
    createStaticBlocker({ id: 'end', shape: { type: 'capsule', a: { x: 180, y: -13 }, b: { x: 180, y: 13 }, radius: 1 }, visibleAssetId: 'end-fence' }),
  ];
  const result = move({ x: 10, y: 0, z: 0 }, { x: 400, y: 0 }, blockers);
  assert.ok(result.position.x <= 167.001);
  assert.ok(Math.abs(result.position.y) < 1e-6);
  assert.equal(result.contacts[0].blockerId, 'end');
});

test('collision telemetry records stalls and repeated zero-displacement frames without mutating inputs', () => {
  const wall = createStaticBlocker({
    id: 'wall',
    shape: { type: 'capsule', a: { x: 20, y: -100 }, b: { x: 20, y: 100 }, radius: 1 },
    visibleAssetId: 'wall',
  });
  const start = Object.freeze({ x: 7, y: 0, z: 0 });
  const delta = Object.freeze({ x: 10, y: 0 });
  const result = move(start, delta, [wall], { priorZeroDisplacementFrames: 2 });
  assert.equal(result.telemetry.stalled, true);
  assert.equal(result.telemetry.zeroDisplacementFrames, 3);
  assert.equal(result.telemetry.requestedDistance, 10);
  assert.equal(start.x, 7);
  assert.equal(delta.x, 10);
});
