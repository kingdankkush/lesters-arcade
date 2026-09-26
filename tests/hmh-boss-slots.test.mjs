// The boss registry and shared lifecycle (design package 4.1 and 4.7 items
// 1-2, slice S1.5): readiness, the player's triggers, one instance per run,
// locks that close only on clear footprints, the retreat ring, the director
// overlay, the add allowance, rewards and the v7 bosses rows.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOSS_DEFINITIONS,
  bossAddAllowance,
  bossDirectorOverlay,
  bossHudState,
  bossRunRows,
  bossZoneArming,
  consumeGoldenParachute,
  createBossSlots,
  defeatBossSlot,
  directorSpawnCapacityV7,
  stepBossSlots,
} from '../apps/hmh-reboot/src/boss-slots.mjs';
import { LIQUIDATOR_DARK_POOL, LIQUIDATOR_MARGIN_FLOOR } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import { referenceDps } from '../apps/hmh-reboot/src/boss-reference-dps.mjs';
import { applyLiquidatorDamage } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { directorSpawnCapacity } from '../server/verify/hmh-plausibility.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES, HMH_V7_RUN_RULES, hmhV7BossHp } from '../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';

const BELL = 'liquidator-closing-bell';
const inPlaza = { x: 11_300, y: 2_400, groundZ: 0, radius: 24 };
const mission = (completed = []) => ({ completed: new Map(completed.map((id) => [id, 1])) });
const bellEvent = (tick) => ({ type: 'boss-zone', zoneId: BELL, bossId: 'liquidator', zoneKind: 'trigger', trigger: 'bell', tick });
const step = (slots, tick, extra = {}) => stepBossSlots(slots, { tick, player: inPlaza, missionEvents: [], mission: mission(), level: 21, enemies: [], ...extra });

test('the registry holds the Liquidator on the v7 contract; the three district bosses stay dark', () => {
  assert.deepEqual(Object.keys(BOSS_DEFINITIONS), ['liquidator']);
  const liquidator = BOSS_DEFINITIONS.liquidator;
  assert.equal(liquidator.targetId, 'boss-liquidator');
  assert.equal(liquidator.roleId, 'liquidator');
  assert.equal(liquidator.name, 'The Liquidator');
  assert.equal(liquidator.readyTick, HMH_V7_BOSSES.liquidator.readyTick);
  assert.equal(liquidator.silverBurst, 25);
  assert.deepEqual(liquidator.markers, [0.66, 0.33]);
  const slots = createBossSlots({ seed: 5 });
  assert.deepEqual(bossRunRows(slots), HMH_RUN_SUMMARY_CATALOGS_V7.bosses.map((bossId) => ({ bossId, initiations: 0, firstInitiatedTick: 0, lastInitiatedTick: 0, defeatedTick: 0 })));
});

test('the director capacity bank matches the verifier over the v7 schedule', () => {
  for (const tick of [0, 1, 149, 150, 3_599, 3_600, 17_999, 18_000, 36_000, 36_044, 36_045, 71_999, 72_000, 80_000, 123_456]) {
    assert.equal(directorSpawnCapacityV7(tick), directorSpawnCapacity(tick, HMH_V7_RUN_RULES.ENCOUNTER_BAND_SCHEDULE), `tick ${tick}`);
  }
});

test('nothing starts before 10:00; the bell shows "Opens at" and arms at its ready tick', () => {
  const slots = createBossSlots({ seed: 5 });
  const early = bossZoneArming(slots, 35_999);
  assert.equal(early.armed.has(BELL), false);
  assert.deepEqual(early.status.get(BELL), { status: 'waiting', readyAt: 36_000 });
  // A bell event before readiness (impossible from the mission, which only
  // fills an armed ring) is refused anyway.
  const refused = step(slots, 35_999, { missionEvents: [bellEvent(35_999)] });
  assert.deepEqual(refused.events, []);
  assert.equal(slots.slots.liquidator.status, 'dormant');
  const ready = bossZoneArming(slots, 36_000);
  assert.equal(ready.armed.has(BELL), true);
  assert.equal(ready.armed.has('liquidator-retreat-margin-floor'), false);
});

test('ringing the bell starts him at HP frozen from the level at the trigger, and records the initiation', () => {
  const slots = createBossSlots({ seed: 5 });
  const frame = step(slots, 36_500, { missionEvents: [bellEvent(36_500)], level: 21 });
  assert.deepEqual(frame.events.filter((event) => event.type === 'boss-initiated').map((event) => [event.bossId, event.trigger, event.tick]), [['liquidator', 'bell', 36_500]]);
  const boss = slots.slots.liquidator.boss;
  assert.equal(boss.maxHealth, hmhV7BossHp('liquidator', referenceDps(21)));
  assert.equal(boss.entry, 'bell');
  assert.equal(boss.arena.id, 'margin-floor');
  assert.deepEqual(bossRunRows(slots).find((row) => row.bossId === 'liquidator'), { bossId: 'liquidator', initiations: 1, firstInitiatedTick: 36_500, lastInitiatedTick: 36_500, defeatedTick: 0 });
  assert.equal(bossZoneArming(slots, 36_501).armed.has(BELL), false, 'no trigger while he is live');
  assert.equal(bossZoneArming(slots, 36_501).status.get(BELL).status, 'live');
  assert.deepEqual(bossHudState(slots, 36_501), { active: true, bossId: 'liquidator', name: 'The Liquidator', ratio: 1, phaseId: 'market-open', markers: [0.66, 0.33] });
});

test('locks close one by one only when their footprint is clear, and the rest are forced at the intro end', () => {
  const slots = createBossSlots({ seed: 5 });
  const blocker = { id: 'encounter-000001', x: 10_860, y: LIQUIDATOR_MARGIN_FLOOR.bounds.minY - 16, radius: 20 };
  const straddler = { id: 'encounter-000002', x: 10_600, y: LIQUIDATOR_MARGIN_FLOOR.bounds.maxY + 30, radius: 20 };
  const first = step(slots, 36_500, { missionEvents: [bellEvent(36_500)], enemies: [blocker, straddler] });
  const closed = first.events.filter((event) => event.type === 'lock-closed').map((event) => event.wallId);
  assert.equal(closed.length, LIQUIDATOR_MARGIN_FLOOR.walls.length - 2);
  assert.ok(!closed.includes('liquidator-lock-n2') && !closed.includes('liquidator-lock-s1'));
  // The straddler walks off: its shutter drops on the next tick.
  const next = step(slots, 36_501, { enemies: [blocker, { ...straddler, y: straddler.y + 200 }] });
  assert.deepEqual(next.events.filter((event) => event.type === 'lock-closed').map((event) => event.wallId), ['liquidator-lock-s1']);
  for (let tick = 36_502; tick < 36_650; tick += 1) assert.equal(step(slots, tick, { enemies: [blocker] }).events.some((event) => event.type === 'lock-closed'), false);
  // Intro end: the enemy stuck in the wall line is recycled and the lock forced.
  const forced = step(slots, 36_650, { enemies: [blocker, { id: 'encounter-000003', x: 12_000 - 100, y: 600, radius: 20 }] });
  assert.deepEqual(forced.events.filter((event) => event.type === 'lock-closed').map((event) => event.wallId), ['liquidator-lock-n2']);
  assert.deepEqual(forced.recycle, ['encounter-000001', 'encounter-000003'], 'the stuck enemy and the off-view outsider are recycled without credit');
  assert.equal(slots.slots.liquidator.locked, true);
  assert.deepEqual(new Set(slots.slots.liquidator.closedWalls), new Set(LIQUIDATOR_MARGIN_FLOOR.walls.map((wall) => wall.id)));
});

test('a hero who leaves the floor during the intro calls the fight off until a legal re-initiation', () => {
  const slots = createBossSlots({ seed: 5 });
  // An enemy on the south-west shutter keeps one gap open during the intro.
  const straddler = { id: 'encounter-000009', x: 10_600, y: LIQUIDATOR_MARGIN_FLOOR.bounds.maxY + 30, radius: 20 };
  step(slots, 36_500, { missionEvents: [bellEvent(36_500)], enemies: [straddler] });
  assert.equal(slots.slots.liquidator.locked, false);
  const outside = { x: 10_600, y: LIQUIDATOR_MARGIN_FLOOR.bounds.maxY + 120, groundZ: 0, radius: 24 };
  for (let tick = 36_501; tick < 36_650; tick += 1) step(slots, tick, { enemies: [straddler], player: outside });
  const frame = step(slots, 36_650, { player: outside, enemies: [straddler] });
  assert.ok(frame.events.some((event) => event.type === 'boss-withdrawn' && event.reason === 'abandoned'));
  assert.equal(slots.slots.liquidator.boss, null);
  assert.equal(slots.slots.liquidator.status, 'cooldown');
  assert.equal(slots.slots.liquidator.readyAt, 36_500 + HMH_V7_BOSS_RULES.BOSS_REINITIATION_MIN_TICKS);
  assert.equal(frame.opened.length, LIQUIDATOR_MARGIN_FLOOR.walls.length - 1, 'every closed shutter reopens');
  assert.equal(bossRunRows(slots).find((row) => row.bossId === 'liquidator').initiations, 1);
  assert.equal(bossZoneArming(slots, 36_500 + HMH_V7_BOSS_RULES.BOSS_REINITIATION_MIN_TICKS - 1).armed.has(BELL), false);
  assert.equal(bossZoneArming(slots, 36_500 + HMH_V7_BOSS_RULES.BOSS_REINITIATION_MIN_TICKS).armed.has(BELL), true);
  assert.equal(slots.slots.liquidator.closedWalls.length, 0);
});

test('after 600 engaged ticks a 120-tick retreat ring appears; retreating restores him and re-arms 1,800 ticks later', () => {
  const slots = createBossSlots({ seed: 5 });
  step(slots, 36_500, { missionEvents: [bellEvent(36_500)] });
  for (let tick = 36_501; tick < 37_100; tick += 1) step(slots, tick);
  assert.equal(bossZoneArming(slots, 37_099).armed.has('liquidator-retreat-margin-floor'), false);
  assert.equal(bossZoneArming(slots, 37_100).armed.has('liquidator-retreat-margin-floor'), true);
  assert.equal(bossZoneArming(slots, 37_100).armed.has('liquidator-retreat-dark-pool'), false);
  const retreat = step(slots, 37_220, { missionEvents: [{ type: 'boss-zone', zoneId: 'liquidator-retreat-margin-floor', bossId: 'liquidator', zoneKind: 'retreat', arena: 'margin-floor', tick: 37_220 }] });
  assert.ok(retreat.events.some((event) => event.type === 'boss-withdrawn' && event.reason === 'retreat'));
  assert.equal(slots.slots.liquidator.readyAt, 37_220 + HMH_V7_BOSS_RULES.BOSS_READY_AGAIN_TICKS);
  assert.equal(bossZoneArming(slots, 39_019).armed.has(BELL), false);
  assert.equal(bossZoneArming(slots, 39_020).armed.has(BELL), true);
  step(slots, 39_020, { missionEvents: [bellEvent(39_020)], level: 23 });
  const row = bossRunRows(slots).find((entry) => entry.bossId === 'liquidator');
  assert.deepEqual(row, { bossId: 'liquidator', initiations: 2, firstInitiatedTick: 36_500, lastInitiatedTick: 39_020, defeatedTick: 0 });
  assert.ok(row.lastInitiatedTick - row.firstInitiatedTick >= HMH_V7_BOSS_RULES.BOSS_REINITIATION_MIN_TICKS);
  assert.equal(slots.slots.liquidator.boss.health, slots.slots.liquidator.boss.maxHealth, 'HP restored, and frozen at the new trigger');
  assert.equal(slots.slots.liquidator.boss.maxHealth, hmhV7BossHp('liquidator', referenceDps(23)));
});

test('the Dark Pool starts him with no intro once the logbook is found and the hero is 48 past its threshold', () => {
  const slots = createBossSlots({ seed: 9 });
  const shallow = { x: 11_790, y: LIQUIDATOR_DARK_POOL.threshold.y + 47, groundZ: 0, radius: 24 };
  const deep = { ...shallow, y: LIQUIDATOR_DARK_POOL.threshold.y + 48 };
  assert.deepEqual(step(slots, 36_000, { player: deep, mission: mission() }).events, [], 'no logbook, no fight');
  assert.deepEqual(step(slots, 36_001, { player: shallow, mission: mission(['warehouse-logbook']) }).events, []);
  const frame = step(slots, 36_002, { player: deep, mission: mission(['warehouse-logbook']) });
  const started = frame.events.find((event) => event.type === 'boss-initiated');
  assert.deepEqual([started.trigger, started.tick], ['dark-pool', 36_002]);
  assert.equal(slots.slots.liquidator.boss.entry, 'dark-pool');
  assert.equal(slots.slots.liquidator.boss.introTicks, 0);
  assert.deepEqual(frame.events.filter((event) => event.type === 'lock-closed').map((event) => event.wallId), ['liquidator-lock-dark-pool']);
  assert.equal(slots.slots.liquidator.locked, true, 'the door seals at once');
  // The bell is settled for the rest of the run.
  assert.equal(bossZoneArming(slots, 40_000).status.get(BELL).status, 'settled');
  assert.equal(slots.slots.liquidator.owner, 'dark-pool');
});

test('before 10:00 the Dark Pool keeps only its secret; after a plaza win it keeps only its secret too', () => {
  const early = createBossSlots({ seed: 9 });
  const deep = { x: 11_790, y: 2_100, groundZ: 0, radius: 24 };
  assert.deepEqual(step(early, 30_000, { player: deep, mission: mission(['warehouse-logbook']) }).events, []);
  const slots = createBossSlots({ seed: 9 });
  step(slots, 36_500, { missionEvents: [bellEvent(36_500)] });
  const boss = slots.slots.liquidator.boss;
  for (const tick of [36_650, 36_741, 36_832]) applyLiquidatorDamage({ boss, amount: 1e9, tick });
  assert.equal(boss.defeated, true);
  const rewards = defeatBossSlot(slots, { bossId: 'liquidator', tick: 36_832 });
  const { opened, ...grants } = rewards;
  assert.deepEqual(grants, { bossId: 'liquidator', silverBurst: 25, unlockObjective: 'liquidator-defeated', fullHeal: true, grenadesToMax: true, goldenParachute: false, graceTicks: 1_800 });
  assert.deepEqual(new Set(opened), new Set(LIQUIDATOR_MARGIN_FLOOR.walls.map((wall) => wall.id)), 'the gates open');
  assert.deepEqual(step(slots, 40_000, { player: deep, mission: mission(['warehouse-logbook']) }).events.filter((event) => event.type === 'boss-initiated'), []);
  assert.equal(bossZoneArming(slots, 40_000).status.get(BELL).status, 'defeated');
  assert.deepEqual(bossRunRows(slots).find((row) => row.bossId === 'liquidator'), { bossId: 'liquidator', initiations: 1, firstInitiatedTick: 36_500, lastInitiatedTick: 36_500, defeatedTick: 36_832 });
  assert.ok(36_832 - 36_500 >= HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS);
});

test('a Dark Pool win grants the Golden Parachute, used once', () => {
  const slots = createBossSlots({ seed: 9 });
  step(slots, 40_000, { player: { x: 11_790, y: 2_100, groundZ: 0, radius: 24 }, mission: mission(['warehouse-logbook']) });
  const rewards = defeatBossSlot(slots, { bossId: 'liquidator', tick: 40_200 });
  assert.equal(rewards.goldenParachute, true);
  assert.equal(consumeGoldenParachute(slots, 41_000), true);
  assert.equal(consumeGoldenParachute(slots, 41_001), false);
  assert.equal(slots.revivesUsed, 1);
  assert.equal(bossZoneArming(slots, 40_300).status.get(BELL).status, 'settled');
});

test('the director is suppressed while he lives and for its grace after, and adds follow the capacity bank', () => {
  const slots = createBossSlots({ seed: 5 });
  assert.deepEqual(bossDirectorOverlay(slots, 36_000), { suppressed: false, leanRole: 'suppressor', pacified: false });
  step(slots, 36_500, { missionEvents: [bellEvent(36_500)] });
  assert.equal(bossDirectorOverlay(slots, 36_600).suppressed, true);
  // No add in an engagement's first 90 ticks; then the first four are free
  // once per run; every further add draws from the bank.
  assert.equal(bossAddAllowance(slots, { bossId: 'liquidator', tick: 36_589, directorInserted: 0 }), null);
  const taken = [];
  for (let index = 0; index < 6; index += 1) taken.push(bossAddAllowance(slots, { bossId: 'liquidator', tick: 36_600, directorInserted: directorSpawnCapacityV7(36_600) - 1 }));
  assert.deepEqual(taken, ['free', 'free', 'free', 'free', 'bank', null]);
  assert.equal(slots.bankedAdds, 1);
  defeatBossSlot(slots, { bossId: 'liquidator', tick: 37_000 });
  assert.deepEqual(bossDirectorOverlay(slots, 38_799), { suppressed: true, leanRole: null, pacified: true });
  assert.equal(bossDirectorOverlay(slots, 38_800).suppressed, false);
});
