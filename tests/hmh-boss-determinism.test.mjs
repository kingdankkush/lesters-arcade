// Boss kit slice (design package S1.5) same-seed evidence check. A headless
// run of the real kernel, the real Level 1 collision and ground, the mission
// step (the Closing Bell and the retreat rings are its boss zones, the Dark
// Pool's logbook its secret), the boss slots (triggers, locks, retreat,
// rewards, the add allowance) and the reworked Liquidator, with the hero's
// damage stream and his strikes resolved every tick.
//
// Two scripts: the bell (ring it at 10:00, fight on the Margin Floor, win),
// and the Dark Pool (enter it, fight into Margin Call and his first adds,
// retreat through the ring, come back after the cooldown, win, keep the
// Golden Parachute). Adds go through the runtime's add path into a real
// enemy population. One seed gives one digest for
// every render partition, the recorded input stream replays the run one tick
// per frame, and another seed changes the fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FIXED_STEP_MS, DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';
import { directorViewBounds } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import { createMissionState, missionActiveBlockers, missionDockStep, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { BOSS_LOCK_BLOCKERS, LIQUIDATOR_DARK_POOL, LIQUIDATOR_MARGIN_FLOOR } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import {
  bossRunRows,
  bossZoneArming,
  consumeGoldenParachute,
  createBossSlots,
  defeatBossSlot,
  insertBossAdds,
  stepBossSlots,
} from '../apps/hmh-reboot/src/boss-slots.mjs';
import { createEnemyPopulation } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import {
  applyLiquidatorDamage,
  isLiquidatorTargetable,
  resolveLiquidatorAttack,
  stepLiquidatorBoss,
} from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES } from '../sdk/hmh-run-contract-v7.mjs';

const queryGround = createLevelOneGroundQuery();
const body = createCollisionBody({ id: 'player', kind: 'player', radius: 24, minZ: 0, maxZ: 56 });
const bell = LIQUIDATOR_MARGIN_FLOOR.bell;
const plazaRetreat = LIQUIDATOR_MARGIN_FLOOR.retreat;
const poolRetreat = LIQUIDATOR_DARK_POOL.retreat;

// The scripts: from `tick`, walk to `target` (or stand where the hero is when
// `target` is null) and, with `orbit`, circle the floor centre instead.
const SCRIPTS = Object.freeze({
  bell: {
    start: { x: bell.x - 200, y: bell.y },
    legs: [
      { tick: 35_900, target: bell },
      { tick: 36_300, orbit: LIQUIDATOR_MARGIN_FLOOR },
    ],
    end: 45_000,
  },
  'dark-pool': {
    // The cracked container is already broken in this script.
    start: { x: 11_790, y: 1_700 },
    legs: [
      { tick: 36_200, target: { x: 11_790, y: 2_020 } },
      { tick: 36_400, orbit: LIQUIDATOR_DARK_POOL },
      // Past Margin Call and his first Enforcement Order, the retreat ring:
      // stand in it for 120.
      { tick: 38_000, target: poolRetreat },
      // Wait out the 1,800-tick cooldown in the court, then fight to a win.
      { tick: 38_400, orbit: LIQUIDATOR_DARK_POOL },
    ],
    end: 47_000,
  },
});

function headlessRun({ seed, script, partition = 1, replay = null }) {
  const plan = SCRIPTS[script];
  const simulation = new DeterministicSimulation({ seed, maxFrameDeltaMs: 100 });
  const mission = createMissionState(seed);
  const slots = createBossSlots({ seed });
  const population = createEnemyPopulation();
  const actor = { ...plan.start, groundZ: 0, vx: 0, vy: 0 };
  const worldBlockers = missionActiveBlockers({ openGates: new Set(['dark-pool-container']) }, LEVEL_ONE_WORLD.collisionBlockers);
  const evidence = { lines: [], inputs: [], health: 100, hits: 0, adds: [], rewards: null, revives: 0 };
  let leg = -1;
  let lastHitTick = -1;
  let boss = null;
  simulation.onStep(({ tick, input: kernelInput }) => {
    while (leg + 1 < plan.legs.length && plan.legs[leg + 1].tick <= tick) leg += 1;
    const current = plan.legs[leg];
    let move = { x: 0, y: 0 };
    if (replay) move = kernelInput.move;
    else if (current?.orbit) {
      const floor = current.orbit;
      const angle = tick / 150;
      const spot = { x: floor.centre.x + Math.cos(angle) * 140, y: floor.centre.y + Math.sin(angle) * 110 };
      const dx = spot.x - actor.x;
      const dy = spot.y - actor.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 4) move = { x: dx / distance, y: dy / distance };
    } else if (current?.target) {
      const dx = current.target.x - actor.x;
      const dy = current.target.y - actor.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 6) move = { x: dx / distance, y: dy / distance };
    }
    evidence.inputs.push(move);
    const locks = slots.slots.liquidator.closedWalls.length ? BOSS_LOCK_BLOCKERS.filter((wall) => slots.slots.liquidator.closedWalls.includes(wall.id)) : [];
    const blockers = locks.length ? [...worldBlockers, ...locks] : worldBlockers;
    const glide = missionDockStep(mission, { player: actor, move });
    const delta = glide ? { x: glide.x, y: glide.y } : { x: move.x * 4, y: move.y * 4 };
    const swept = resolveSweptCircleMotion({ body, start: { x: actor.x, y: actor.y, z: 0 }, delta, blockers, bounds: LEVEL_ONE_WORLD.bounds });
    actor.vx = (swept.position.x - actor.x) * 60;
    actor.vy = (swept.position.y - actor.y) * 60;
    actor.x = swept.position.x;
    actor.y = swept.position.y;
    actor.groundZ = queryGround(actor.x, actor.y).groundZ;

    const arming = bossZoneArming(slots, tick);
    mission.bossZoneArmed = arming.armed;
    mission.bossZoneStatus = arming.status;
    const missionFrame = stepMissionObjectives(mission, {
      tick, player: actor, move, lastPlayerHitTick: lastHitTick, queryGround,
      lineClear: (from, to) => traceHeightAwareLineOfSight({ from: { x: from.x, y: from.y, z: from.groundZ + 24 }, to: { x: to.x, y: to.y, z: to.groundZ + 24 }, blockers }).clear,
      logicalView: directorViewBounds(actor),
    });
    for (const event of missionFrame.events) evidence.lines.push(`${tick}:mission:${event.type}:${event.objectiveId ?? event.zoneId}`);
    const frame = stepBossSlots(slots, { tick, player: { ...actor, radius: 24 }, missionEvents: missionFrame.events, mission, level: 21, enemies: [] });
    for (const event of frame.events) evidence.lines.push(`${tick}:slot:${event.type}:${event.trigger ?? event.reason ?? event.wallId ?? ''}`);
    boss = slots.slots.liquidator.boss;
    if (boss?.active) {
      const report = stepLiquidatorBoss({ boss, tick, player: actor, blockers: locks, addsAlive: evidence.adds.length });
      for (const event of report.events) {
        evidence.lines.push(`${tick}:boss:${event.type}:${event.attackId ?? event.phaseId ?? ''}`);
        if (event.type === 'add-wave') {
          // The runtime's add path into a real population (the troops never
          // die in these scripts, so they count as alive).
          const result = insertBossAdds(slots, {
            bossId: 'liquidator', event, tick, population, alive: evidence.adds.length, directorInserted: 400,
            place: (candidate) => queryGround(candidate.x, candidate.y).groundZ,
          });
          for (const add of result.inserted) evidence.adds.push(`${add.id}:${add.allowance}`);
          for (const refused of result.rejected) evidence.lines.push(`${tick}:add-refused:${refused.id}:${refused.reason}`);
        }
        if (event.type !== 'attack') continue;
        const resolved = resolveLiquidatorAttack({ event, player: actor, blockers });
        if (!resolved.hit) continue;
        evidence.hits += 1;
        lastHitTick = tick;
        evidence.health -= resolved.damage;
        if (evidence.health <= 0) {
          if (consumeGoldenParachute(slots, tick)) { evidence.health = 50; evidence.revives += 1; } else evidence.health = 1;
        }
      }
      // The hero's damage stream: a seeded amount each tick he can be hit.
      if (isLiquidatorTargetable(boss, tick)) {
        const result = applyLiquidatorDamage({ boss, amount: 1 + seededUnit(seed, `dps:${tick}`), tick, roleMultiplier: seededUnit(seed, `role:${tick}`) < 0.2 ? 1.15 : 1 });
        if (result.phaseCrossed) evidence.lines.push(`${tick}:cross:${result.phaseCrossed}`);
        if (result.runEvent) {
          evidence.rewards = defeatBossSlot(slots, { bossId: 'liquidator', tick });
          evidence.health = 100;
          evidence.lines.push(`${tick}:defeated`);
        }
      }
    }
    // The script's retreat: the hero leaves the fight, so the stream stops
    // (he stands in the ring) until the cooldown ends.
  });
  simulation.start();
  let frameIndex = 0;
  while (simulation.tick < plan.end) {
    const steps = replay ? 1 : typeof partition === 'number' ? partition : 1 + Math.floor(seededUnit(partition.seed, `frame:${frameIndex}`) * 4);
    const input = replay ? { move: replay[simulation.tick], aim: { x: 0, y: 0, active: false } } : null;
    frameIndex += 1;
    simulation.update(FIXED_STEP_MS * Math.min(steps, plan.end - simulation.tick), input);
  }
  const digest = createHash('sha256').update(JSON.stringify({
    lines: evidence.lines, rows: bossRunRows(slots), health: evidence.health, hits: evidence.hits, adds: evidence.adds,
    rewards: evidence.rewards, revives: slots.revivesUsed, actor, boss: boss && { x: boss.x, y: boss.y, health: boss.health, phase: boss.phaseId },
  })).digest('hex');
  return { digest, evidence, slots };
}

test('the Closing Bell script: rung at 10:00, locked, fought through both halts and won', () => {
  const { evidence, slots } = headlessRun({ seed: 0x5eed, script: 'bell' });
  const liquidator = bossRunRows(slots).find((row) => row.bossId === 'liquidator');
  assert.equal(liquidator.initiations, 1);
  assert.ok(liquidator.firstInitiatedTick >= HMH_V7_BOSSES.liquidator.readyTick);
  assert.ok(liquidator.defeatedTick - liquidator.lastInitiatedTick >= HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS);
  assert.ok(evidence.lines.some((line) => line.endsWith(':slot:boss-initiated:bell')));
  assert.ok(evidence.lines.some((line) => line.endsWith(':slot:boss-locked:')));
  assert.ok(evidence.lines.some((line) => line.endsWith(':cross:margin-call')) && evidence.lines.some((line) => line.endsWith(':cross:total-liquidation')));
  assert.equal(evidence.rewards.goldenParachute, false);
  assert.ok(evidence.hits > 0, 'his strikes landed on the hero');
  assert.ok(evidence.adds.length > 0 && evidence.adds.every((id) => /^boss:liquidator:w\d+:\d+:(free|bank)$/.test(id)));
  assert.deepEqual(evidence.lines.filter((line) => line.includes(':add-refused:')), [], 'every add the allowance paid for entered the population');
  assert.equal(slots.slots.liquidator.closedWalls.length, 0, 'the gates open on his defeat');
  // No strike before the bell, none during the intro.
  const initiated = liquidator.firstInitiatedTick;
  assert.ok(evidence.lines.filter((line) => line.includes(':boss:tell:')).every((line) => Number(line.split(':')[0]) >= initiated + 150));
});

test('the Dark Pool script: logbook then start, a retreat, a legal re-initiation, a win and the Golden Parachute', () => {
  const { evidence, slots } = headlessRun({ seed: 0x5eed, script: 'dark-pool' });
  const liquidator = bossRunRows(slots).find((row) => row.bossId === 'liquidator');
  const logbook = evidence.lines.find((line) => line.includes(':mission:objective-completed:warehouse-logbook'));
  assert.ok(logbook);
  assert.ok(Number(logbook.split(':')[0]) <= liquidator.firstInitiatedTick, 'the logbook is recorded before the pool starts him');
  assert.equal(liquidator.initiations, 2);
  assert.ok(evidence.lines.some((line) => line.endsWith(':slot:boss-withdrawn:retreat')));
  assert.ok(liquidator.lastInitiatedTick - liquidator.firstInitiatedTick >= HMH_V7_BOSS_RULES.BOSS_REINITIATION_MIN_TICKS);
  assert.ok(liquidator.defeatedTick - liquidator.lastInitiatedTick >= HMH_V7_BOSSES.liquidator.minFightTicks);
  assert.equal(evidence.rewards.goldenParachute, true);
  assert.equal(slots.parachute.held, true);
  assert.ok(evidence.lines.filter((line) => line.endsWith(':slot:boss-initiated:dark-pool')).length === 2);
  // His troops before the retreat and after the re-initiation both enter the
  // population: the second boss numbers his waves on from the first.
  const waves = evidence.lines.filter((line) => line.endsWith(':boss:add-wave:enforcement-order')).map((line) => Number(line.split(':')[0]));
  const retreat = Number(evidence.lines.find((line) => line.endsWith(':slot:boss-withdrawn:retreat')).split(':')[0]);
  assert.ok(waves.some((tick) => tick < retreat) && waves.some((tick) => tick > liquidator.lastInitiatedTick));
  assert.deepEqual(evidence.adds, ['boss:liquidator:w1:0:free', 'boss:liquidator:w1:1:free', 'boss:liquidator:w2:0:free', 'boss:liquidator:w2:1:free']);
  assert.deepEqual(evidence.lines.filter((line) => line.includes(':add-refused:')), []);
});

test('two runs of one seed give one digest for every render partition, catch-up included', () => {
  for (const script of ['bell', 'dark-pool']) {
    const reference = headlessRun({ seed: 1234, script }).digest;
    assert.equal(headlessRun({ seed: 1234, script }).digest, reference, script);
    for (const partition of [2, 3, 4, { seed: 7 }]) {
      assert.equal(headlessRun({ seed: 1234, script, partition }).digest, reference, `${script} partition ${JSON.stringify(partition)}`);
    }
  }
});

test('the per-tick input stream reproduces the run fed back one tick per frame, and another seed differs', () => {
  const recorded = headlessRun({ seed: 77, script: 'bell', partition: { seed: 3 } });
  const replayed = headlessRun({ seed: 77, script: 'bell', replay: recorded.evidence.inputs });
  assert.equal(replayed.digest, recorded.digest);
  assert.notEqual(headlessRun({ seed: 78, script: 'bell', partition: { seed: 3 } }).digest, recorded.digest, 'another seed chooses other attacks');
});
