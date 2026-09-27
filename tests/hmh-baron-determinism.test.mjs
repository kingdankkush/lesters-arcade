// Rug Pull Baron (design package 4.4, slice S3.1, dark behind bossesV2)
// same-seed evidence check. A headless run of the real kernel, the real Level
// 1 collision and ground, the mission step with the bossesV2 zones (the
// Welcome Mat and his retreat ring), the boss slots with the Baron registered
// (the mat trigger, locks and crates, retreat, rewards, the add allowance),
// his module, and his yank's drift folded into the hero's swept move exactly
// as main.mjs folds it (a slide stopped by a wall or crate is his rug burn).
// Knock-downs land on the adds in a real enemy population.
//
// Two scripts: `phases` (stand on the mat after 2:00, fight through both
// phase changes, win) and `retreat` (start him, fight into The Pull and his
// first adds, retreat through the ring, come back to the mat after the
// cooldown, win). One seed gives one digest for every render partition, the
// recorded input stream replays the run one tick per frame, and another seed
// changes the fight. The rows each script produces are v7 bosses rows that
// pass the schema and the verifier's plausibility rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FIXED_STEP_MS, DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';
import { directorViewBounds } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import { createMissionState, missionActiveBlockers, missionDockStep, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { BOSS_LOCK_BLOCKERS, RUG_PULL_BARON_QUARRY } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import {
  activeBoss,
  applyBossDamage,
  bossClosedWallIds,
  bossDriftAt,
  bossRunRows,
  bossZoneArming,
  createBossSlots,
  defeatBossSlot,
  insertBossAdds,
  isBossTargetable,
  resolveBossAttack,
  stepBoss,
  stepBossSlots,
} from '../apps/hmh-reboot/src/boss-slots.mjs';
import { baronKnockDownTargets, knockDownEnemy } from '../apps/hmh-reboot/src/rug-pull-baron-boss.mjs';
import { createEnemyPopulation } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { referenceDps } from '../apps/hmh-reboot/src/boss-reference-dps.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES, hmhV7BossHp } from '../sdk/hmh-run-contract-v7.mjs';
import { validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { validateV7RunPlausibility } from '../server/verify/hmh-plausibility.mjs';

const queryGround = createLevelOneGroundQuery();
const body = createCollisionBody({ id: 'player', kind: 'player', radius: 24, minZ: 0, maxZ: 56 });
const ARENA = RUG_PULL_BARON_QUARRY;
const LEVEL = 8;
const mat = ARENA.mat;

// Legs: from `tick`, walk to `target`, or circle the carpet (`orbit`), with a
// damage stream of `dps` a tick while he can be hit.
const SCRIPTS = Object.freeze({
  phases: {
    start: { x: 3_200, y: 900 },
    legs: [
      { tick: 7_240, target: mat, dps: 0 },
      { tick: 7_400, orbit: true, dps: 0.7 },
    ],
    end: 9_000,
  },
  retreat: {
    start: { x: 3_200, y: 900 },
    legs: [
      { tick: 7_240, target: mat, dps: 0 },
      // Slowly into The Pull, with time for his first Exit Liquidity.
      { tick: 7_400, orbit: true, dps: 0.6 },
      // The ring is armed from 600 engaged ticks: stand in it for 120.
      { tick: 8_700, target: ARENA.retreat, dps: 0 },
      // Wait on the mat's edge for the cooldown, then take the mat again.
      { tick: 9_100, target: { x: mat.x + 90, y: mat.y + 30 }, dps: 0 },
      { tick: 10_600, target: mat, dps: 0 },
      { tick: 10_900, orbit: true, dps: 2.5 },
    ],
    end: 13_000,
  },
});

function headlessRun({ seed, script, partition = 1, replay = null }) {
  const plan = SCRIPTS[script];
  const simulation = new DeterministicSimulation({ seed, maxFrameDeltaMs: 100 });
  const mission = createMissionState(seed, { bossesV2: true });
  const slots = createBossSlots({ seed, bossesV2: true });
  const population = createEnemyPopulation();
  const actor = { ...plan.start, groundZ: 0, vx: 0, vy: 0 };
  const worldBlockers = missionActiveBlockers(mission, LEVEL_ONE_WORLD.collisionBlockers);
  const evidence = { lines: [], inputs: [], health: 100, hits: 0, burns: 0, adds: [], knockedDown: [], rewards: null, slides: 0 };
  let leg = -1;
  let lastHitTick = -1;
  simulation.onStep(({ tick, input: kernelInput }) => {
    while (leg + 1 < plan.legs.length && plan.legs[leg + 1].tick <= tick) leg += 1;
    const current = plan.legs[leg];
    let move = { x: 0, y: 0 };
    if (replay) move = kernelInput.move;
    else if (current?.orbit) {
      const angle = tick / 140;
      const spot = { x: ARENA.centre.x + 60 + Math.cos(angle) * 170, y: ARENA.centre.y + Math.sin(angle) * 100 };
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
    const closed = bossClosedWallIds(slots);
    const locks = closed.length ? BOSS_LOCK_BLOCKERS.filter((wall) => closed.includes(wall.id)) : [];
    const blockers = locks.length ? [...worldBlockers, ...locks] : worldBlockers;
    const glide = missionDockStep(mission, { player: actor, move });
    const delta = glide ? { x: glide.x, y: glide.y } : { x: move.x * 4, y: move.y * 4 };
    // main.mjs: the boss drift folds into the swept delta; a slide the sweep
    // stops is the rug burn his step reads this tick.
    const drift = bossDriftAt(activeBoss(slots), actor, tick);
    if (drift) {
      delta.x += drift.x;
      delta.y += drift.y;
      evidence.slides += 1;
    }
    const swept = resolveSweptCircleMotion({ body, start: { x: actor.x, y: actor.y, z: 0 }, delta, blockers, bounds: LEVEL_ONE_WORLD.bounds });
    const driftBlocked = Boolean(drift) && Math.hypot(swept.position.x - (actor.x + delta.x), swept.position.y - (actor.y + delta.y)) > 1;
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
    const alive = population.active.filter((enemy) => enemy.active && enemy.health > 0);
    const frame = stepBossSlots(slots, { tick, player: { ...actor, radius: 24 }, missionEvents: missionFrame.events, mission, level: LEVEL, enemies: alive });
    for (const event of frame.events) evidence.lines.push(`${tick}:slot:${event.type}:${event.trigger ?? event.reason ?? event.wallId ?? ''}`);
    const boss = activeBoss(slots);
    if (boss?.active) {
      const report = stepBoss({ boss, tick, player: actor, blockers: locks, addsAlive: alive.length, playerDriftBlocked: driftBlocked });
      for (const event of report.events) {
        evidence.lines.push(`${tick}:boss:${event.type}:${event.attackId ?? event.face ?? event.phaseId ?? event.markId ?? ''}`);
        if (event.type === 'knockdown') {
          for (const enemy of baronKnockDownTargets(event, population.active)) {
            knockDownEnemy(enemy, { tick, ticks: event.untilTick - tick });
            evidence.knockedDown.push(`${tick}:${enemy.id}`);
          }
        }
        if (event.type === 'add-wave') {
          const result = insertBossAdds(slots, {
            bossId: 'rug-pull-baron', event, tick, population, alive: alive.length, directorInserted: 0,
            place: (candidate) => queryGround(candidate.x, candidate.y).groundZ,
          });
          for (const add of result.inserted) evidence.adds.push(`${add.id}:${add.allowance}`);
          for (const refused of result.rejected) evidence.lines.push(`${tick}:add-refused:${refused.id}:${refused.reason}`);
        }
        if (event.type !== 'attack') continue;
        const resolved = resolveBossAttack({ boss, event, player: actor });
        if (!resolved.hit) continue;
        evidence.hits += 1;
        if (event.attackId === 'rug-burn') evidence.burns += 1;
        lastHitTick = tick;
        evidence.health = Math.max(1, evidence.health - resolved.damage);
      }
      const dps = current?.dps ?? 0;
      if (dps > 0 && isBossTargetable(boss, tick)) {
        const result = applyBossDamage({ boss, amount: dps * (0.5 + seededUnit(seed, `dps:${tick}`)), tick });
        if (result.phaseCrossed) evidence.lines.push(`${tick}:cross:${result.phaseCrossed}`);
        if (result.runEvent) {
          evidence.rewards = defeatBossSlot(slots, { bossId: 'rug-pull-baron', tick });
          evidence.lines.push(`${tick}:defeated`);
        }
      }
    }
  });
  simulation.start();
  let frameIndex = 0;
  while (simulation.tick < plan.end) {
    const steps = replay ? 1 : typeof partition === 'number' ? partition : 1 + Math.floor(seededUnit(partition.seed, `frame:${frameIndex}`) * 4);
    const input = replay ? { move: replay[simulation.tick], aim: { x: 0, y: 0, active: false } } : null;
    frameIndex += 1;
    simulation.update(FIXED_STEP_MS * Math.min(steps, plan.end - simulation.tick), input);
  }
  const boss = activeBoss(slots);
  const digest = createHash('sha256').update(JSON.stringify({
    lines: evidence.lines, rows: bossRunRows(slots), health: evidence.health, hits: evidence.hits, adds: evidence.adds, knockedDown: evidence.knockedDown,
    rewards: evidence.rewards, perks: [...slots.perks], seals: slots.sealsFound, actor, slides: evidence.slides,
    boss: boss && { x: boss.x, y: boss.y, health: boss.health, phase: boss.phaseId },
  })).digest('hex');
  return { digest, evidence, slots };
}

const fourBossesSummary = () => JSON.parse(readFileSync(new URL('./fixtures/ranked/hmh-v7-four-bosses.json', import.meta.url), 'utf8')).body.evidence.runSummary;
// The committed four-bosses fixture with its Baron row replaced by the row a
// script produced (and its Baron-held prisoner freed after that defeat).
function verifyBaronRow(row) {
  const summary = fourBossesSummary();
  Object.assign(summary.bosses.find((entry) => entry.bossId === 'rug-pull-baron'), row);
  const held = summary.prisoners.find((entry) => entry.slotId === 'h1-baron-diggings');
  held.tick = Math.max(held.tick, row.defeatedTick + 60);
  return { schema: validateRunSummaryPayload(summary), rejects: validateV7RunPlausibility(summary).flags.filter((flag) => flag.severity === 'reject') };
}

const lineTick = (line) => Number(line.split(':')[0]);

test('the phases script: the mat after 2:00, both phase changes, a win and the Baron\'s rewards', () => {
  const { evidence, slots } = headlessRun({ seed: 0x5eed, script: 'phases' });
  const row = bossRunRows(slots).find((entry) => entry.bossId === 'rug-pull-baron');
  assert.equal(row.initiations, 1);
  assert.ok(row.firstInitiatedTick >= HMH_V7_BOSSES['rug-pull-baron'].readyTick);
  assert.ok(row.defeatedTick - row.lastInitiatedTick >= HMH_V7_BOSSES['rug-pull-baron'].minFightTicks);
  assert.ok(evidence.lines.some((line) => line.endsWith(':slot:boss-initiated:welcome-mat')));
  assert.ok(evidence.lines.some((line) => line.endsWith(':slot:boss-locked:')));
  assert.ok(evidence.lines.some((line) => line.endsWith(':slot:prop-placed:baron-crate-1')));
  assert.ok(evidence.lines.some((line) => line.endsWith(':cross:the-pull')) && evidence.lines.some((line) => line.endsWith(':cross:hard-rug')));
  assert.ok(evidence.lines.some((line) => line.includes(':boss:drift:')), 'he pulled the rug');
  assert.ok(evidence.slides > 0, 'the hero slid on it');
  assert.deepEqual({ ...evidence.rewards, opened: evidence.rewards.opened.length > 0 }, {
    bossId: 'rug-pull-baron', silverBurst: 15, unlockObjective: null, fullHeal: false, grenadesToMax: false, perk: 'barons-signet', genesisSeal: true,
    threat: 24, roleId: 'rug-pull-baron', goldenParachute: false, graceTicks: 1_800, opened: true,
  });
  assert.deepEqual([...slots.perks], ['barons-signet']);
  assert.equal(slots.sealsFound, 1);
  assert.deepEqual(bossClosedWallIds(slots), [], 'the boulders and the crates go on his defeat');
  // His HP was frozen at the trigger from the level.
  const initiated = row.firstInitiatedTick;
  assert.equal(slots.slots['rug-pull-baron'].boss.maxHealth, hmhV7BossHp('rug-pull-baron', referenceDps(LEVEL)));
  // Nothing before the mat, no tell during the intro.
  assert.ok(evidence.lines.filter((line) => line.includes(':boss:')).every((line) => lineTick(line) >= initiated + 120));
  // The Liquidator slot never moved.
  assert.deepEqual(bossRunRows(slots).find((entry) => entry.bossId === 'liquidator'), { bossId: 'liquidator', initiations: 0, firstInitiatedTick: 0, lastInitiatedTick: 0, defeatedTick: 0 });
  assert.deepEqual(verifyBaronRow(row), { schema: '', rejects: [] });
});

test('the retreat script: start, a retreat through the ring, a legal re-initiation on the mat, a win', () => {
  const { evidence, slots } = headlessRun({ seed: 0x5eed, script: 'retreat' });
  const row = bossRunRows(slots).find((entry) => entry.bossId === 'rug-pull-baron');
  assert.equal(row.initiations, 2);
  const retreat = evidence.lines.find((line) => line.endsWith(':slot:boss-withdrawn:retreat'));
  assert.ok(retreat);
  assert.ok(lineTick(retreat) - row.firstInitiatedTick >= HMH_V7_BOSS_RULES.BOSS_RETREAT_RING_TICKS + HMH_V7_BOSS_RULES.BOSS_RETREAT_CHANNEL_TICKS - 1);
  assert.ok(row.lastInitiatedTick - row.firstInitiatedTick >= HMH_V7_BOSS_RULES.BOSS_REINITIATION_MIN_TICKS);
  assert.ok(row.defeatedTick > row.lastInitiatedTick + HMH_V7_BOSSES['rug-pull-baron'].minFightTicks);
  assert.equal(evidence.lines.filter((line) => line.endsWith(':slot:boss-initiated:welcome-mat')).length, 2);
  // His first adds came before the retreat; the second Baron numbers on.
  const waves = evidence.lines.filter((line) => line.endsWith(':boss:add-wave:exit-liquidity')).map(lineTick);
  assert.ok(waves.some((tick) => tick < lineTick(retreat)));
  assert.ok(evidence.adds.length >= 2 && evidence.adds.every((id) => /^boss:rug-pull-baron:w\d+:\d+:(free|bank)$/.test(id)));
  assert.equal(new Set(evidence.adds.map((id) => id.split(':').slice(0, 4).join(':'))).size, evidence.adds.length, 'add ids never repeat across the retreat');
  assert.deepEqual(evidence.lines.filter((line) => line.includes(':add-refused:')), []);
  assert.ok(evidence.knockedDown.length > 0, 'a yank knocked his adds down');
  assert.equal(slots.sealsFound, 1, 'one Seal for one defeat');
  assert.deepEqual(verifyBaronRow(row), { schema: '', rejects: [] });
});

test('two runs of one seed give one digest for every render partition, catch-up included', () => {
  for (const script of ['phases', 'retreat']) {
    const reference = headlessRun({ seed: 4321, script }).digest;
    assert.equal(headlessRun({ seed: 4321, script }).digest, reference, script);
    for (const partition of [2, 3, 4, { seed: 7 }]) {
      assert.equal(headlessRun({ seed: 4321, script, partition }).digest, reference, `${script} partition ${JSON.stringify(partition)}`);
    }
  }
});

test('the per-tick input stream reproduces the run fed back one tick per frame, and another seed differs', () => {
  for (const script of ['phases', 'retreat']) {
    const recorded = headlessRun({ seed: 77, script, partition: { seed: 3 } });
    const replayed = headlessRun({ seed: 77, script, replay: recorded.evidence.inputs });
    assert.equal(replayed.digest, recorded.digest, script);
    assert.notEqual(headlessRun({ seed: 78, script, partition: { seed: 3 } }).digest, recorded.digest, `${script}: another seed chooses other attacks`);
  }
});
