import { traceHeightAwareLineOfSight } from '../elevation.mjs';

const plans = new WeakSet();
const finite = value => Number.isFinite(value);

// Exactly one temporary objective. This module never imports the legacy mission
// catalogue and cannot award progress, alter blockers or publish run evidence.
export function createLocalMeadowsRelayPlan(world) {
  const piece = world?.pieces?.find(row => row.id === 'mweb-meadows-relay-equipment');
  const site = world?.sites?.find(row => row.id === 'mweb-meadows-objective');
  const bounds = piece?.visible?.bounds;
  if (world?.officialRun !== false || world?.rankedEligible !== false || world.rulesVersion !== null
    || !piece?.blocker || !bounds || ![bounds.minX,bounds.maxX,bounds.maxY].every(finite)
    || !site || site.runtimeEffect !== 'none') throw new TypeError('local Meadows relay staging is required');
  const operate = Object.freeze({ x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY + 64 });
  if (site.x !== operate.x || site.y !== operate.y) throw new TypeError('local relay marker must meet its equipment');
  const plan = Object.freeze({ id: 'local-meadows-relay', siteId: site.id, blockerId: piece.blocker.id, operate,
    lamp: Object.freeze({ x: operate.x, y: bounds.maxY, z: piece.visible.height * .6 }),
    ringRadius: 72, heightBand: 8, commitTicks: 12, fillTicks: 30, stillMoveMagnitude: .2, sightHeight: 24,
    officialRun: false, rankedEligible: false, rewards: Object.freeze([]) });
  plans.add(plan); return plan;
}

export function createLocalRelay({ plan, geometry } = {}) {
  if (!plans.has(plan) || !Object.isFrozen(geometry) || geometry.officialRun !== false || geometry.rankedEligible !== false
    || geometry.rulesVersion !== null || typeof geometry.queryGround !== 'function' || !Object.isFrozen(geometry.collisionBlockers)) {
    throw new TypeError('an owned local relay plan and unofficial geometry are required');
  }
  let lastTick = -1, insideTicks = 0, committed = false, commitTick = -1, progressTicks = 0;
  let completionTick = null, operating = false, eligible = false, disposed = false, commitStill = false;
  const snapshot = () => Object.freeze({ id: plan.id, insideTicks, committed, commitTick, progressTicks, completionTick, operating, eligible, disposed });
  return Object.freeze({
    snapshot,
    step({ tick, player, move = { x: 0, y: 0 } } = {}) {
      if (disposed) return snapshot();
      if (!Number.isInteger(tick) || tick < 0 || tick <= lastTick) throw new TypeError('local relay ticks must be monotonic');
      const z = player?.groundZ ?? 0;
      if (![player?.x,player?.y,z,move?.x,move?.y].every(finite)) throw new TypeError('finite local relay player and movement required');
      lastTick = tick;
      if (completionTick !== null) return snapshot();
      const groundZ = geometry.queryGround(plan.operate.x, plan.operate.y).groundZ;
      eligible = Math.hypot(player.x - plan.operate.x, player.y - plan.operate.y) <= plan.ringRadius
        && Math.abs(z - groundZ) <= plan.heightBand
        && traceHeightAwareLineOfSight({ from: { x: player.x, y: player.y, z: z + plan.sightHeight },
          to: { ...plan.operate, z: groundZ + plan.sightHeight }, blockers: geometry.collisionBlockers }).clear;
      const still = Math.hypot(move.x, move.y) < plan.stillMoveMagnitude;
      if (!committed) {
        insideTicks = eligible ? insideTicks + 1 : 0;
        if (insideTicks >= plan.commitTicks) { committed = true; commitTick = tick; commitStill = eligible && still; }
      }
      if (committed) {
        // Same quick-switch semantics as the existing game: the commit tick
        // fills once, and a committed switch finishes after the hero leaves.
        progressTicks++;
        if (!(eligible && still)) commitStill = false;
        operating = commitStill;
        if (progressTicks >= plan.fillTicks) { completionTick = tick; operating = false; eligible = false; }
      }
      return snapshot();
    },
    dispose() { disposed = true; operating = false; eligible = false; },
  });
}
