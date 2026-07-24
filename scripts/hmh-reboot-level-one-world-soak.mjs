import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';
import {
  LEVEL_ONE_WORLD,
  createLevelOneGroundQuery,
  createLevelOneRevealState,
  getLevelOneDistrictAt,
  getLevelOneRevealSnapshot,
  getLevelOneRouteLength,
  revealLevelOneAt,
} from '../apps/hmh-reboot/src/level-one-world.mjs';
import { DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { ensureExplicitGc } from './hmh-soak-explicit-gc.mjs';

ensureExplicitGc(import.meta.url);

const route = LEVEL_ONE_WORLD.routes.find((candidate) => candidate.id === 'main-route');
const nodes = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
const routeNodes = route.nodeIds.map((id) => nodes.get(id));
const speedPerTick = LEVEL_ONE_WORLD.player.maxSpeed / 60;
const targetTicks = Math.ceil(getLevelOneRouteLength(route.id) / speedPerTick) + routeNodes.length + 12;

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function round(value) {
  return Number(value.toFixed(6));
}

function runPartition(renderFps) {
  const queryGround = createLevelOneGroundQuery();
  const body = createCollisionBody({
    id: 'world-soak-player',
    kind: 'player',
    radius: LEVEL_ONE_WORLD.player.radius,
    minZ: 0,
    maxZ: 56,
  });
  const reveal = createLevelOneRevealState();
  const position = { ...LEVEL_ONE_WORLD.player.spawn };
  let ground = queryGround(position.x, position.y);
  let nodeIndex = 1;
  let processedTicks = 0;
  let collisionContacts = 0;
  let traversalBlocks = 0;
  let revealedAdditions = 0;
  const districtTransitions = [getLevelOneDistrictAt(position.x, position.y).id];
  const surfaceTransitions = [ground.surfaceId];
  revealLevelOneAt(reveal, position);

  const simulation = new DeterministicSimulation({ seed: 0x71e17 });
  simulation.onStep(({ tick }) => {
    if (processedTicks >= targetTicks) return;
    processedTicks += 1;
    if (nodeIndex >= routeNodes.length) return;
    let remaining = speedPerTick;
    while (remaining > 1e-9 && nodeIndex < routeNodes.length) {
      const target = routeNodes[nodeIndex];
      const dx = target.x - position.x;
      const dy = target.y - position.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 1e-9) {
        nodeIndex += 1;
        continue;
      }
      const step = Math.min(remaining, distance);
      const delta = { x: dx / distance * step, y: dy / distance * step };
      const collision = resolveSweptCircleMotion({
        body,
        start: { ...position, z: ground.groundZ },
        delta,
        blockers: LEVEL_ONE_WORLD.collisionBlockers,
        bounds: LEVEL_ONE_WORLD.bounds,
      });
      collisionContacts += collision.contacts.length;
      const traversal = resolveSweptTraversalPath({
        start: position,
        end: collision.position,
        queryGround,
        maxSampleDistance: 6,
      });
      if (!traversal.allowed) traversalBlocks += 1;
      assert.equal(collision.contacts.length, 0, `tick ${tick} hit ${collision.contacts[0]?.blockerId}`);
      assert.equal(traversal.allowed, true, `tick ${tick} blocked by ${traversal.reason}`);
      position.x = traversal.position.x;
      position.y = traversal.position.y;
      ground = traversal.ground;
      remaining -= step;
      if (step >= distance - 1e-9) nodeIndex += 1;
    }
    if (tick % 6 === 0) revealedAdditions += revealLevelOneAt(reveal, position);
    const districtId = getLevelOneDistrictAt(position.x, position.y)?.id ?? 'outside';
    if (districtTransitions.at(-1) !== districtId) districtTransitions.push(districtId);
    if (surfaceTransitions.at(-1) !== ground.surfaceId) surfaceTransitions.push(ground.surfaceId);
  });
  simulation.start();

  const before = performance.now();
  const frameMs = 1000 / renderFps;
  let renderFrames = 0;
  while (processedTicks < targetTicks) {
    simulation.update(frameMs);
    renderFrames += 1;
    assert.ok(renderFrames < targetTicks * 2, 'partition did not converge');
  }
  const elapsedMs = performance.now() - before;
  const revealSnapshot = getLevelOneRevealSnapshot(reveal);
  const result = {
    renderFps,
    renderFrames,
    processedTicks,
    routeCompleted: nodeIndex >= routeNodes.length,
    finalPosition: { x: round(position.x), y: round(position.y), groundZ: round(ground.groundZ) },
    districtTransitions,
    surfaceTransitions,
    revealedCells: revealSnapshot.revealedCellIds.length,
    revealedAdditions,
    collisionContacts,
    traversalBlocks,
    elapsedMs: round(elapsedMs),
    msPerTick: round(elapsedMs / processedTicks),
    timingLoss: simulation.getLossMetrics(),
  };
  result.hash = hash({
    processedTicks: result.processedTicks,
    routeCompleted: result.routeCompleted,
    finalPosition: result.finalPosition,
    districtTransitions: result.districtTransitions,
    surfaceTransitions: result.surfaceTransitions,
    revealedCellIds: revealSnapshot.revealedCellIds,
    collisionContacts,
    traversalBlocks,
  });
  return result;
}

if (global.gc) global.gc();
const heapBefore = process.memoryUsage().heapUsed;
const runs = [60, 30, 20].map(runPartition);
const repeat = runPartition(60);
if (global.gc) global.gc();
const heapAfter = process.memoryUsage().heapUsed;

for (const run of runs) {
  assert.equal(run.routeCompleted, true);
  assert.equal(run.collisionContacts, 0);
  assert.equal(run.traversalBlocks, 0);
  assert.deepEqual(run.districtTransitions, LEVEL_ONE_WORLD.districts.map((district) => district.id));
  assert.equal(run.hash, runs[0].hash);
  assert.equal(run.timingLoss.rawWallClockLossMs, 0);
  assert.equal(run.timingLoss.accumulatorOverflowMs, 0);
  assert.equal(run.timingLoss.totalDroppedMs, 0);
}
assert.equal(repeat.hash, runs[0].hash);

const report = {
  worldId: LEVEL_ONE_WORLD.id,
  routeId: route.id,
  routeLength: round(getLevelOneRouteLength(route.id)),
  targetTicks,
  deterministicHash: runs[0].hash,
  repeatHash: repeat.hash,
  heapDelta: heapAfter - heapBefore,
  runs,
};
console.log(JSON.stringify(report, null, 2));
