import { DeterministicSimulation, FIXED_STEP_MS } from '../simulation.mjs';
import { createLocalRelay } from './world-v2-local-relay.mjs';
import { createPlayerMotionState, stepPlayerMovement } from '../movement.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../collision.mjs';
import { movementSpeedMultiplierForTransition, resolveSweptTraversalPath } from '../elevation.mjs';
import { createEnemyNavGridChunked, createNavGridAuthority, computeEnemyFlowField } from '../enemy-navgrid.mjs';

const yieldToHost = () => new Promise(resolve => setTimeout(resolve, 0));
const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
};

// A local movement lifetime with one optional no-reward relay. No sessions,
// seed entry or encounters.
// The unchanged runtime primitives remain authoritative; nav is diagnostic and
// never substitutes its coarse cells for swept player collision/traversal.
export function createWorldV2LocalRuntime(options = {}) {
  if (!options || typeof options !== 'object' || Reflect.ownKeys(options).some(key => key !== 'geometry' && key !== 'scheduleYield' && key !== 'relayPlan')) {
    throw new TypeError('only local geometry, a relay plan and an optional construction scheduler are accepted');
  }
  const { geometry, scheduleYield = yieldToHost, relayPlan = null } = options;
  if (!geometry || !Object.isFrozen(geometry) || geometry.officialRun !== false || geometry.rankedEligible !== false
    || geometry.rulesVersion !== null || !Object.isFrozen(geometry.bounds) || !Object.isFrozen(geometry.collisionBlockers)
    || typeof geometry.queryGround !== 'function' || typeof scheduleYield !== 'function') {
    throw new TypeError('immutable unofficial world geometry and a construction scheduler are required');
  }
  const motion = createPlayerMotionState({ x: finite(geometry.inspectionStart?.x, 'inspection x'), y: finite(geometry.inspectionStart?.y, 'inspection y') });
  const body = createCollisionBody({ id: 'local-inspection-human', radius: 24, minZ: 0, maxZ: 56 });
  const bounds = Object.freeze({ ...geometry.bounds, visibleBoundaryId: 'local-world-edge' });
  let ground = geometry.queryGround(motion.x, motion.y);
  const initial = resolveSweptCircleMotion({ body, start: { x: motion.x, y: motion.y, z: ground.groundZ },
    delta: { x: 0, y: 0 }, blockers: geometry.collisionBlockers, bounds });
  if (!ground.walkable || initial.depenetrations.length || initial.position.x !== motion.x || initial.position.y !== motion.y) {
    throw new TypeError('inspection start must be walkable and clear for the current human body');
  }

  const relay = relayPlan === null ? null : createLocalRelay({ plan: relayPlan, geometry });

  // Fixed diagnostic seed only; this lifetime never consumes a random stream.
  const simulation = new DeterministicSimulation({ seed: 0 });
  let phase = 'preparing', failure = null, authority = createNavGridAuthority(), flow = null, nav = null;
  let zeroDisplacementFrames = 0, lastStep = Object.freeze({ contacts: 0, traversalAllowed: true });
  const actorView = () => Object.freeze({ x: motion.x, y: motion.y, vx: motion.vx, vy: motion.vy, groundZ: ground.groundZ,
    legDirection: motion.legDirection, torsoDirection: motion.torsoDirection, locomotion: motion.locomotion,
    heading: Math.atan2(motion.aimDirection.y, motion.aimDirection.x) });
  let previousActor = actorView();
  const unsubscribe = simulation.onStep(({ tick, dtSeconds, input }) => {
    previousActor = actorView(); // Presentation-only last admitted tick, including catch-up.
    const start = { x: motion.x, y: motion.y, z: ground.groundZ };
    const magnitude = Math.hypot(input.move.x, input.move.y);
    let speedMultiplier = 1;
    if (magnitude > 0.001) {
      const probeDistance = Math.max(8, motion.maxSpeed * dtSeconds);
      const probe = geometry.queryGround(motion.x + input.move.x / magnitude * probeDistance, motion.y + input.move.y / magnitude * probeDistance);
      speedMultiplier = movementSpeedMultiplierForTransition(ground, probe, probeDistance);
    }
    stepPlayerMovement(motion, input, { dtSeconds, speedMultiplier });
    const collision = resolveSweptCircleMotion({ body, start, delta: { x: motion.x - start.x, y: motion.y - start.y },
      blockers: geometry.collisionBlockers, bounds, priorZeroDisplacementFrames: zeroDisplacementFrames });
    const traversal = resolveSweptTraversalPath({ start, end: collision.position, queryGround: geometry.queryGround,
      maxSampleDistance: Math.max(4, body.radius * 0.5) });
    motion.x = traversal.position.x; motion.y = traversal.position.y; ground = traversal.ground;
    if (!traversal.allowed) motion.vx = motion.vy = motion.recoilVx = motion.recoilVy = 0;
    for (const contact of collision.contacts) {
      const velocity = motion.vx * contact.normal.x + motion.vy * contact.normal.y;
      if (velocity < 0) { motion.vx -= contact.normal.x * velocity; motion.vy -= contact.normal.y * velocity; }
      const recoil = motion.recoilVx * contact.normal.x + motion.recoilVy * contact.normal.y;
      if (recoil < 0) { motion.recoilVx -= contact.normal.x * recoil; motion.recoilVy -= contact.normal.y * recoil; }
    }
    relay?.step({ tick, player: { x: motion.x, y: motion.y, groundZ: ground.groundZ }, move: input.move });
    zeroDisplacementFrames = collision.telemetry.zeroDisplacementFrames;
    lastStep = Object.freeze({ contacts: collision.contacts.length, traversalAllowed: traversal.allowed });
  });

  const ready = (async () => {
    try {
      // Do not use authority.build(): it adopts unconditionally after its await.
      const grid = await createEnemyNavGridChunked({ world: geometry, queryGround: geometry.queryGround, cellsPerSlice: 512,
        scheduleYield: async () => {
          if (phase === 'disposed') throw new Error('local world disposed during navigation build');
          const budget = await scheduleYield();
          if (phase === 'disposed') throw new Error('local world disposed during navigation build');
          return budget;
        } });
      if (phase === 'disposed') return;
      const completedFlow = computeEnemyFlowField({ grid, targetX: geometry.inspectionStart.x, targetY: geometry.inspectionStart.y });
      authority.adopt(grid); flow = completedFlow;
      nav = Object.freeze({ columns: grid.columns, rows: grid.rows, cellSize: grid.cellSize,
        walkableCells: grid.walkable.reduce((sum, value) => sum + value, 0), gridBytes: grid.walkable.byteLength + grid.edges.byteLength,
        flowBytes: flow.distance.byteLength + flow.directions.byteLength });
      phase = 'ready';
    } catch (error) {
      if (phase === 'disposed') return;
      phase = 'failed'; failure = String(error?.message ?? error); authority = null; flow = null; nav = null;
      simulation.exit(); unsubscribe(); relay?.dispose(); throw error;
    }
  })();

  return Object.freeze({
    ready,
    start() {
      if (phase !== 'ready' || !authority?.ready) throw new Error('local navigation must be ready before start');
      simulation.start(); phase = 'active';
    },
    advance(rawDeltaMs, input) {
      if (phase !== 'active') return simulation.update(rawDeltaMs);
      const move = { x: finite(input?.move?.x ?? 0, 'move.x'), y: finite(input?.move?.y ?? 0, 'move.y') };
      const aim = input?.aim ? { x: finite(input.aim.x ?? 0, 'aim.x'), y: finite(input.aim.y ?? 0, 'aim.y'), active: input.aim.active === true }
        : { ...move, active: move.x !== 0 || move.y !== 0 };
      return simulation.update(rawDeltaMs, { move, aim });
    },
    pause() { if (phase === 'active') { simulation.pause(); phase = 'paused'; } },
    resume() { if (phase === 'paused') { simulation.resume(); phase = 'active'; } },
    dispose() {
      if (phase === 'disposed') return;
      phase = 'disposed'; simulation.exit(); unsubscribe(); relay?.dispose(); authority = null; flow = null; nav = null;
    },
    snapshot() {
      return Object.freeze({ phase, mode: 'local-free-test', officialRun: false, rankedEligible: false, tick: simulation.tick, fixedStepMs: FIXED_STEP_MS,
        actor: actorView(), previousActor, nav, lastStep, failure, relay: relay?.snapshot() ?? null });
    },
    navigationAt(x, y) {
      finite(x, 'navigation x'); finite(y, 'navigation y');
      if (!authority?.ready) return null;
      const grid = authority.require(), cell = grid.cellAt(x, y);
      return cell < 0 ? null : Object.freeze({ cell, walkable: Boolean(grid.walkable[cell]), edges: grid.edges[cell],
        returnDistance: flow.distance[cell], direction: flow.directions[cell] });
    },
  });
}
