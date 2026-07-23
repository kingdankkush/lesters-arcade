import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import {
  DASH_COOLDOWN_TICKS_BY_TIER,
  DASH_DISTANCE,
  DASH_DURATION_TICKS,
  beginDash,
  createDashState,
  getDashStatus,
  isDashInvulnerable,
  stepDash,
} from '../apps/hmh-reboot/src/dash.mjs';
import { DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';

const SOAK_TICKS = 20 * 60 * 60;
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function dashReplay(frameMs, cooldownTier) {
  const dash = createDashState({ cooldownTier });
  const simulation = new DeterministicSimulation({ seed: 0x0da54a13 + cooldownTier });
  let starts = 0;
  let activeTicks = 0;
  let invulnerableTicks = 0;
  let distance = 0;
  let x = 0;
  let y = 0;
  simulation.onStep(({ tick }) => {
    if (getDashStatus(dash, tick).ready) {
      const cardinal = starts % 4;
      const direction = cardinal === 0 ? { x: 1, y: 0 }
        : cardinal === 1 ? { x: 0, y: 1 }
          : cardinal === 2 ? { x: -1, y: 0 }
            : { x: 0, y: -1 };
      const started = beginDash(dash, { tick, direction });
      assert.equal(started.started, true);
      starts += 1;
    }
    const frame = stepDash(dash, { tick });
    if (frame.active) {
      activeTicks += 1;
      distance += Math.hypot(frame.delta.x, frame.delta.y);
      x += frame.delta.x;
      y += frame.delta.y;
    }
    invulnerableTicks += Number(isDashInvulnerable(dash, tick));
  });
  simulation.start();
  while (simulation.tick < SOAK_TICKS) simulation.update(frameMs, {});
  const expectedStarts = Math.floor((SOAK_TICKS - 1) / DASH_COOLDOWN_TICKS_BY_TIER[cooldownTier]) + 1;
  assert.equal(starts, expectedStarts);
  assert.equal(activeTicks, expectedStarts * DASH_DURATION_TICKS);
  assert.equal(invulnerableTicks, expectedStarts * DASH_DURATION_TICKS);
  assert.ok(Math.abs(distance - expectedStarts * DASH_DISTANCE) < 1e-6);
  const remainder = expectedStarts % 4;
  const expectedX = remainder === 1 || remainder === 2 ? DASH_DISTANCE : 0;
  const expectedY = remainder === 2 || remainder === 3 ? DASH_DISTANCE : 0;
  assert.ok(Math.abs(x - expectedX) < 1e-6 && Math.abs(y - expectedY) < 1e-6, 'cardinal Dash loop endpoint must be exact');
  return Object.freeze({
    cooldownTier,
    cooldownTicks: DASH_COOLDOWN_TICKS_BY_TIER[cooldownTier],
    tick: simulation.tick,
    starts,
    activeTicks,
    invulnerableTicks,
    distance: Number(distance.toFixed(6)),
    x: Number(x.toFixed(6)),
    y: Number(y.toFixed(6)),
    droppedTimeMs: simulation.getLossMetrics().totalDroppedMs,
    stateHash: hash(dash),
  });
}

function scenario() {
  const tiers = DASH_COOLDOWN_TICKS_BY_TIER.map((_, cooldownTier) => {
    const fps60 = dashReplay(1000 / 60, cooldownTier);
    const fps30 = dashReplay(1000 / 30, cooldownTier);
    const fps20 = dashReplay(1000 / 20, cooldownTier);
    assert.deepEqual(fps30, fps60);
    assert.deepEqual(fps20, fps60);
    return Object.freeze({ fps60, fps30, fps20 });
  });
  return Object.freeze({ soakTicks: SOAK_TICKS, tiers });
}

if (global.gc) global.gc();
const heapBefore = process.memoryUsage().heapUsed;
const startedAt = performance.now();
const first = scenario();
const elapsedMs = performance.now() - startedAt;
if (global.gc) global.gc();
const heapAfter = process.memoryUsage().heapUsed;
const second = scenario();
assert.deepEqual(second, first);
console.log(JSON.stringify({
  ...first,
  repeatHash: hash(first),
  elapsedMs: Number(elapsedMs.toFixed(3)),
  heapBefore,
  heapAfter,
  heapDelta: heapAfter - heapBefore,
  gcExposed: Boolean(global.gc),
}, null, 2));
