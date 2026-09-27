// The Rug Pull Baron in the boss registry (slice S3.1): built dark behind
// bossesV2 and unreachable in Ranked; the Welcome Mat trigger through the
// real mission step; one boss live at a time; the boulders and crates; the
// call-off; his perk, Seal and rockfall; the progression row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  BOSS_DEFINITIONS,
  activeBoss,
  bossClosedWallIds,
  bossHudState,
  bossRunRows,
  bossZoneArming,
  createBossSlots,
  defeatBossSlot,
  stepBossSlots,
} from '../apps/hmh-reboot/src/boss-slots.mjs';
import { RUG_PULL_BARON_QUARRY, BOSS_LOCK_BLOCKERS } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import { applyRugPullBaronDamage } from '../apps/hmh-reboot/src/rug-pull-baron-boss.mjs';
import { MISSION_BOSS_ZONES, MISSION_BOSS_ZONES_V2, createMissionState, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { createLevelOneGroundQuery, LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { BARONS_SIGNET_SILVER, addSilverDrop, createSilverDropState, stepSilverDrops } from '../apps/hmh-reboot/src/silver-drops.mjs';
import { worldHazardPhase } from '../apps/hmh-reboot/src/world-hazards.mjs';
import { createRunProgression, runProgressionRow } from '../apps/hmh-reboot/src/run-progression.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES } from '../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';

const ARENA = RUG_PULL_BARON_QUARRY;
const MAT = 'rug-pull-baron-welcome-mat';
const queryGround = createLevelOneGroundQuery();
const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const onMat = { x: ARENA.mat.x, y: ARENA.mat.y, groundZ: 0, radius: 24 };

// The real mission step then the slots, as main orders them.
function tickOnce(mission, slots, tick, player, { move = { x: 0, y: 0 }, enemies = [] } = {}) {
  const arming = bossZoneArming(slots, tick);
  mission.bossZoneArmed = arming.armed;
  mission.bossZoneStatus = arming.status;
  const missionFrame = stepMissionObjectives(mission, { tick, player, move, queryGround });
  const frame = stepBossSlots(slots, { tick, player, missionEvents: missionFrame.events, mission, level: 8, enemies });
  return { missionFrame, frame, arming };
}

test('the Baron is dark: no slot, no zone and no row movement without bossesV2', () => {
  assert.equal(BOSS_DEFINITIONS['rug-pull-baron'].dark, true);
  const off = createBossSlots({ seed: 3 });
  assert.deepEqual(Object.keys(off.slots), ['liquidator']);
  assert.equal(off.bossesV2, false);
  assert.equal(createMissionState(3).zones.some((zone) => zone.id === MAT), false);
  assert.deepEqual(createMissionState(3).rowsById.has(MAT), false);
  // Standing on the mat at 2:00 does nothing on a normal run.
  const mission = createMissionState(3);
  for (let tick = 7_200; tick < 7_300; tick += 1) {
    const { frame } = tickOnce(mission, off, tick, onMat);
    assert.deepEqual(frame.events, []);
  }
  assert.deepEqual(bossRunRows(off).find((row) => row.bossId === 'rug-pull-baron'), { bossId: 'rug-pull-baron', initiations: 0, firstInitiatedTick: 0, lastInitiatedTick: 0, defeatedTick: 0 });
  // With the flag: both slots, the mat and his retreat ring.
  const on = createBossSlots({ seed: 3, bossesV2: true });
  assert.deepEqual(Object.keys(on.slots), ['liquidator', 'rug-pull-baron']);
  const zones = createMissionState(3, { bossesV2: true }).zones.map((zone) => zone.id);
  for (const row of [...MISSION_BOSS_ZONES, ...MISSION_BOSS_ZONES_V2]) assert.ok(zones.includes(row.id), row.id);
  assert.throws(() => createBossSlots({ seed: 3, bossesV2: 'yes' }), /boolean/);
});

test('bossesV2 is an evidenceSafe pilot that never reaches Ranked', () => {
  assert.match(mainSource, /const bossesV2Requested = evidenceSafeEnabled && runtimeParams\.get\('bossesV2'\) === '1';/);
  const enable = mainSource.match(/bossesV2Enabled = bossesV2Requested && payload\.mode !== 'ranked';/)?.[0];
  assert.ok(enable, 'the session gate');
  for (const [requested, mode, expected] of [[true, 'ranked', false], [true, 'free', true], [false, 'free', false], [false, 'ranked', false]]) {
    const context = { bossesV2Requested: requested, payload: { mode }, bossesV2Enabled: null };
    runInNewContext(enable, context);
    assert.equal(context.bossesV2Enabled, expected, `${requested} ${mode}`);
  }
  // Nothing else turns the Baron on: the slots and the mission read only the gate.
  assert.match(mainSource, /missionState=createMissionState\(payload\.session\.seed, \{ bossesV2: bossesV2Enabled \}\);/);
  assert.match(mainSource, /bossSlots=createBossSlots\(\{ seed: payload\.session\.seed, bossesV2: bossesV2Enabled \}\);/);
  assert.equal(mainSource.match(/bossesV2:/g).length, 2);
  assert.equal(mainSource.match(/^\s*bossesV2Enabled = /gm).length, 1);
});

test('the Welcome Mat: armed at 2:00, filled by 30 ticks on it, emptied by stepping off, never by walking across', () => {
  const mission = createMissionState(5, { bossesV2: true });
  const slots = createBossSlots({ seed: 5, bossesV2: true });
  // Before 2:00 it waits.
  const early = tickOnce(mission, slots, 7_000, onMat);
  assert.deepEqual(early.arming.status.get(MAT), { status: 'waiting', readyAt: HMH_V7_BOSSES['rug-pull-baron'].readyTick });
  // Walking straight across at full speed never fills it.
  let tick = 7_200;
  for (let x = ARENA.mat.x - 80; x <= ARENA.mat.x + 80; x += 4, tick += 1) {
    const { frame } = tickOnce(mission, slots, tick, { ...onMat, x }, { move: { x: 1, y: 0 } });
    assert.deepEqual(frame.events, [], `crossing at ${x}`);
  }
  // 29 ticks on it, a step off, and it starts over.
  for (let k = 0; k < 29; k += 1, tick += 1) tickOnce(mission, slots, tick, onMat, { move: { x: 0.3, y: 0 } });
  assert.equal(mission.zoneState.get(MAT).progress, 29);
  tickOnce(mission, slots, tick, { ...onMat, y: onMat.y + 60 });
  tick += 1;
  assert.equal(mission.zoneState.get(MAT).progress, 0);
  // No clip, no stow and no dock on the mat, moving or not.
  let initiated = null;
  for (let k = 0; k < 30; k += 1, tick += 1) {
    const { frame } = tickOnce(mission, slots, tick, onMat);
    assert.equal(mission.stowed, false);
    assert.equal(mission.dock, null);
    initiated ??= frame.events.find((event) => event.type === 'boss-initiated') ?? null;
  }
  assert.equal(initiated.bossId, 'rug-pull-baron');
  assert.equal(initiated.trigger, 'welcome-mat');
  assert.equal(activeBoss(slots).bossId, 'rug-pull-baron');
  assert.equal(bossHudState(slots, initiated.tick).name, 'The Rug Pull Baron');
  assert.deepEqual(bossHudState(slots, initiated.tick).markers, [0.6, 0.25]);
});

test('one boss at a time: the Closing Bell stays dark while the Baron lives and arms after his defeat', () => {
  const slots = createBossSlots({ seed: 9, bossesV2: true });
  const mission = createMissionState(9, { bossesV2: true });
  // Start him late (the mat is ready from 2:00) and keep him alive into 10:00.
  const matEvent = (tick) => ({ type: 'boss-zone', zoneId: MAT, bossId: 'rug-pull-baron', zoneKind: 'trigger', trigger: 'welcome-mat', tick });
  stepBossSlots(slots, { tick: 35_990, player: onMat, missionEvents: [matEvent(35_990)], mission, level: 20 });
  assert.equal(slots.slots['rug-pull-baron'].status, 'live');
  const armed = bossZoneArming(slots, 36_100);
  assert.equal(armed.armed.has('liquidator-closing-bell'), false);
  const bellEvent = { type: 'boss-zone', zoneId: 'liquidator-closing-bell', bossId: 'liquidator', zoneKind: 'trigger', trigger: 'bell', tick: 36_100 };
  stepBossSlots(slots, { tick: 36_100, player: onMat, missionEvents: [bellEvent], mission, level: 20 });
  assert.equal(slots.slots.liquidator.status, 'dormant', 'no second boss starts');
  const rewards = defeatBossSlot(slots, { bossId: 'rug-pull-baron', tick: 36_400 });
  assert.equal(rewards.perk, 'barons-signet');
  assert.ok(bossZoneArming(slots, 36_401).armed.has('liquidator-closing-bell'));
  assert.equal(bossZoneArming(slots, 36_401).armed.has(MAT), false, 'a fallen Baron stays fallen');
  assert.deepEqual(bossZoneArming(slots, 36_401).status.get(MAT), { status: 'defeated', readyAt: null });
  assert.throws(() => defeatBossSlot(slots, { bossId: 'rug-pull-baron', tick: 36_500 }), /not live/);
  assert.equal(slots.sealsFound, 1, 'one Seal per boss id per run');
});

test('the boulders close as their footprints clear; a crate never lands on a body; the hero walking out before the seal calls it off', () => {
  const slots = createBossSlots({ seed: 4, bossesV2: true });
  const mission = createMissionState(4, { bossesV2: true });
  const west = ARENA.walls.find((wall) => wall.id === 'baron-lock-w2');
  const crate = ARENA.props[0].shape.a;
  const blocker = { id: 'enemy-in-the-mouth', x: west.shape.a.x, y: (west.shape.a.y + west.shape.b.y) / 2, radius: 18, active: true, health: 10 };
  const matEvent = (tick) => ({ type: 'boss-zone', zoneId: MAT, bossId: 'rug-pull-baron', zoneKind: 'trigger', trigger: 'welcome-mat', tick });
  // The hero stands on the first crate's spot when he starts him.
  const onCrate = { x: crate.x, y: crate.y, groundZ: 0, radius: 24 };
  const first = stepBossSlots(slots, { tick: 8_000, player: onCrate, missionEvents: [matEvent(8_000)], mission, level: 8, enemies: [blocker] });
  assert.ok(first.closed.includes('baron-lock-w1'));
  assert.equal(first.closed.includes('baron-lock-w2'), false, 'a body in the mouth keeps it open');
  assert.equal(first.closed.includes('baron-crate-1'), false, 'no crate onto the hero');
  assert.ok(first.closed.includes('baron-crate-2'));
  // He steps off; the crate rolls in.
  const second = stepBossSlots(slots, { tick: 8_001, player: { ...onCrate, x: crate.x + 120 }, mission, level: 8, enemies: [blocker] });
  assert.deepEqual(second.closed, ['baron-crate-1']);
  // He walks out through the open mouth before the intro ends: called off.
  const outside = { x: ARENA.bounds.minX - 200, y: 1_000, groundZ: 0, radius: 24 };
  let withdrawn = null;
  for (let tick = 8_002; tick <= 8_000 + 120 && !withdrawn; tick += 1) {
    withdrawn = stepBossSlots(slots, { tick, player: outside, mission, level: 8, enemies: [blocker] }).events.find((event) => event.type === 'boss-withdrawn') ?? null;
  }
  assert.equal(withdrawn.reason, 'abandoned');
  assert.equal(withdrawn.readyAt, 8_000 + HMH_V7_BOSS_RULES.BOSS_REINITIATION_MIN_TICKS);
  assert.deepEqual(bossClosedWallIds(slots), [], 'every boulder and crate opens');
  assert.equal(activeBoss(slots), null);
  // Every closable Baron id is a known lock blocker (navgrid patches need it).
  for (const id of [...ARENA.walls, ...ARENA.props].map((wall) => wall.id)) assert.ok(BOSS_LOCK_BLOCKERS.some((wall) => wall.id === id), id);
});

test('the quarry pocket is flat z0 ground off the main route, sealed by the cliff to the north', () => {
  for (let x = ARENA.bounds.minX; x <= ARENA.bounds.maxX; x += 20) {
    for (let y = ARENA.bounds.minY + 24; y <= ARENA.bounds.maxY; y += 20) {
      const ground = queryGround(x, y);
      assert.deepEqual([ground.groundZ, ground.kind], [0, 'ground'], `(${x}, ${y})`);
    }
  }
  const cliff = LEVEL_ONE_WORLD.collisionBlockers.find((blocker) => blocker.id === 'ravine-north-cliff');
  assert.ok(cliff.shape.a.x <= ARENA.bounds.minX - 16 && cliff.shape.b.x >= ARENA.bounds.maxX + 16);
  assert.equal(cliff.shape.a.y + cliff.shape.radius, 698);
  assert.ok(ARENA.bounds.minY >= 698);
  // The main route stays at least its clearance from the locks.
  const main = LEVEL_ONE_WORLD.routes.find((route) => route.id === 'main-route');
  const nodes = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
  const points = main.nodeIds.map((id) => nodes.get(id));
  const segment = (p, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
  };
  for (const wall of ARENA.walls) {
    for (const end of [wall.shape.a, wall.shape.b]) {
      const nearest = Math.min(...points.slice(1).map((point, index) => segment(end, points[index], point)));
      assert.ok(nearest >= LEVEL_ONE_WORLD.routeClearance.main / 2, `${wall.id} is ${nearest.toFixed(0)} from the main route`);
    }
  }
});

test('Baron\'s Signet: silver pickup 62 -> 150 and coin life 1,800 -> 3,600; nothing changes without it', () => {
  assert.deepEqual(BARONS_SIGNET_SILVER, { pickupRadius: 150, lifetimeTicks: 3_600 });
  const plain = createSilverDropState();
  const signet = createSilverDropState();
  for (const state of [plain, signet]) addSilverDrop(state, { sequence: 1, tick: 0, x: 120, y: 0, value: 3 });
  assert.equal(stepSilverDrops(plain, { tick: 1, player: { x: 0, y: 0 } }), 0);
  assert.equal(stepSilverDrops(signet, { tick: 1, player: { x: 0, y: 0 }, ...BARONS_SIGNET_SILVER }), 3);
  const old = createSilverDropState();
  const kept = createSilverDropState();
  for (const state of [old, kept]) addSilverDrop(state, { sequence: 1, tick: 0, x: 500, y: 0 });
  assert.equal(stepSilverDrops(old, { tick: 2_000, player: { x: 0, y: 0 } }), 0);
  assert.equal(old.expired, 1);
  assert.equal(stepSilverDrops(kept, { tick: 2_000, player: { x: 0, y: 0 }, ...BARONS_SIGNET_SILVER }), 0);
  assert.equal(kept.expired, 0);
  assert.equal(stepSilverDrops(kept, { tick: 2_001, player: { x: 420, y: 0 }, ...BARONS_SIGNET_SILVER }), 1);
});

test('his rigged charges: the Ravine rockfall lands every 240 ticks while he lives, 300 otherwise', () => {
  const rockfall = LEVEL_ONE_WORLD.interactions.hazards.find((hazard) => hazard.id === 'ravine-rockfall');
  assert.equal(worldHazardPhase(rockfall, 300).phase, 'impact');
  assert.notEqual(worldHazardPhase(rockfall, 240).phase, 'impact');
  const rigged = { ...rockfall, periodTicks: 240 };
  assert.equal(worldHazardPhase(rigged, 240).phase, 'impact');
  assert.equal(worldHazardPhase(rigged, 300).phase, 'idle');
  assert.match(mainSource, /hazard\.id === 'ravine-rockfall' \? Object\.freeze\(\{ \.\.\.hazard, periodTicks: 240 \}\) : hazard/);
});

test('the v7 progression row banks one Seal per defeated Seal boss', () => {
  const progression = createRunProgression({ seed: 1 });
  assert.deepEqual(runProgressionRow(progression, { sealsFound: 1 }), { offersOpened: 0, evolutionOffersOpened: 0, rerolls: 0, sealsFound: 1, sealsBanked: 1, evolutionsApplied: 0, revivesUsed: 0 });
  assert.equal(runProgressionRow(progression).sealsFound, 0);
  assert.throws(() => runProgressionRow(progression, { sealsFound: 5 }), /sealsFound/);
  // The catalogue knows the Baron's role and his boss id: nothing invented.
  assert.ok(HMH_RUN_SUMMARY_CATALOGS_V7.enemyRoles.includes('rug-pull-baron'));
  assert.ok(HMH_RUN_SUMMARY_CATALOGS_V7.bosses.includes('rug-pull-baron'));
  assert.equal(BOSS_DEFINITIONS['rug-pull-baron'].roleId, 'rug-pull-baron');
});

test('a Baron defeat through his own damage authority opens everything and keeps the rows dense', () => {
  const slots = createBossSlots({ seed: 12, bossesV2: true });
  const matEvent = (tick) => ({ type: 'boss-zone', zoneId: MAT, bossId: 'rug-pull-baron', zoneKind: 'trigger', trigger: 'welcome-mat', tick });
  stepBossSlots(slots, { tick: 7_500, player: onMat, missionEvents: [matEvent(7_500)], mission: { completed: new Map() }, level: 8 });
  const boss = activeBoss(slots);
  let tick = 7_620;
  let result = null;
  while (!result?.runEvent) {
    result = applyRugPullBaronDamage({ boss, amount: 200, tick });
    tick += 91;
  }
  const rewards = defeatBossSlot(slots, { bossId: 'rug-pull-baron', tick: tick - 91 });
  assert.equal(rewards.silverBurst, HMH_V7_BOSSES['rug-pull-baron'].silverBurst);
  const rows = bossRunRows(slots);
  assert.deepEqual(rows.map((row) => row.bossId), HMH_RUN_SUMMARY_CATALOGS_V7.bosses);
  const row = rows.find((entry) => entry.bossId === 'rug-pull-baron');
  assert.equal(row.defeatedTick, tick - 91);
  assert.ok(row.defeatedTick - row.lastInitiatedTick >= HMH_V7_BOSSES['rug-pull-baron'].minFightTicks);
});
