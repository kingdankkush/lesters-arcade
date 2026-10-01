// The three district bosses of the ten-area world (slice HMH-BOSSES-2-4): the
// Rug Pull Baron, the 51% Foreman and the Lockkeeper on the shared district
// engine. Same-seed timeline hashes, tell windows against the walk-escape rule,
// phase transitions with halts and openers, death with the run event and the
// Genesis Seal at the court pedestal, the pure arena hook events, and the
// registry boundary: the shipped Level 1 map and its verifier never see them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { rugPullBaron, RUG_PULL_BARON_ARENA_HOOK } from '../apps/hmh-reboot/src/rug-pull-baron-boss.mjs';
import { fiftyOneForeman, FIFTY_ONE_FOREMAN_ARENA_HOOK } from '../apps/hmh-reboot/src/fifty-one-foreman-boss.mjs';
import { lockkeeper, LOCKKEEPER_ARENA_HOOK } from '../apps/hmh-reboot/src/lockkeeper-boss.mjs';
import { DISTRICT_BOSS_PHASE_HALT_TICKS, DISTRICT_BOSS_STAGGER_TICKS } from '../apps/hmh-reboot/src/district-boss-kit.mjs';
import { bossShapeClearDistance, bossWalkBudgetTicks } from '../apps/hmh-reboot/src/boss-geometry.mjs';
import { bossArenaInterior } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import { WORLD_V1_DISTRICT_COURTS, dropCourtGenesisSeal, pastCourtThreshold } from '../apps/hmh-reboot/src/boss-courts-world-v1.mjs';
import { BOSS_DEFINITIONS, WORLD_V1_BOSS_DEFINITIONS, bossRunRows, bossZoneArming, createBossSlots, defeatBossSlot, stepBossSlots } from '../apps/hmh-reboot/src/boss-slots.mjs';
import { createBossDrops, dropGenesisSeal } from '../apps/hmh-reboot/src/boss-drops.mjs';
import { HMH_V7_BOSSES } from '../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';

const KITS = [
  { kit: rugPullBaron, hook: RUG_PULL_BARON_ARENA_HOOK, targetId: 'boss-rug-pull-baron' },
  { kit: fiftyOneForeman, hook: FIFTY_ONE_FOREMAN_ARENA_HOOK, targetId: 'boss-51-foreman' },
  { kit: lockkeeper, hook: LOCKKEEPER_ARENA_HOOK, targetId: 'boss-lockkeeper' },
];
const DISTRICT_IDS = ['rug-pull-baron', 'lockkeeper', 'fifty-one-percent-foreman'];

// A scripted fight: the hero orbits the floor centre at 3 units a tick, the
// damage stream lands every 12 ticks, every due strike is resolved on the disk.
function fight(kit, { seed, ticks = 7_200, damage = 9, maxHealth = 4_000 }) {
  const boss = kit.create({ x: 0, y: 0, maxHealth, seed, startTick: 60 });
  const timeline = [];
  let hits = 0;
  let angle = 0;
  const phases = [];
  for (let tick = 60; tick < 60 + ticks; tick += 1) {
    angle += 3 / 320;
    const player = { x: Math.cos(angle) * 320, y: Math.sin(angle) * 320, vx: -Math.sin(angle) * 180, vy: Math.cos(angle) * 180, groundZ: 0 };
    const frame = kit.step({ boss, tick, player });
    if (phases.at(-1) !== frame.phaseId) phases.push(frame.phaseId);
    for (const event of frame.events) {
      timeline.push([tick, event.type, event.attackId ?? '', event.telegraphId ?? '', event.geometry?.type ?? '']);
      if (event.type === 'attack' && kit.resolveAttack({ event, player }).hit) hits += 1;
    }
    if (tick % 12 === 0) {
      const result = kit.applyDamage({ boss, amount: damage, tick });
      if (result.phaseCrossed) timeline.push([tick, 'phase', result.phaseCrossed]);
      if (result.defeated) {
        timeline.push([tick, 'defeated', result.runEvent?.name ?? '']);
        break;
      }
    }
  }
  return { boss, timeline, hits, phases, hash: createHash('sha256').update(JSON.stringify(timeline)).digest('hex') };
}

for (const { kit, hook, targetId } of KITS) {
  const { definition } = kit;
  const contract = HMH_V7_BOSSES[definition.bossId];

  test(`${definition.bossId}: same seed and inputs give one phase timeline hash; another seed changes it`, () => {
    const first = fight(kit, { seed: 11 });
    const second = fight(kit, { seed: 11 });
    assert.equal(first.hash, second.hash);
    assert.deepEqual(first.phases, definition.phases.map((phase) => phase.id));
    assert.ok(first.timeline.some(([, type]) => type === 'defeated'), 'the scripted fight ends in a defeat');
    assert.ok(first.hits > 0, 'some strikes land on the orbiting disk');
    assert.notEqual(first.hash, fight(kit, { seed: 12 }).hash);
    assert.equal(definition.targetId, targetId);
  });

  test(`${definition.bossId}: every tell is a fair walk-escape window and resolves exactly tellTicks later`, () => {
    const boss = kit.create({ x: 0, y: 0, maxHealth: 4_000, seed: 3, startTick: 0 });
    const interior = bossArenaInterior(boss.arena);
    for (const [attackId, attack] of Object.entries(definition.attacks)) {
      for (const player of [{ x: 250, y: 90, vx: 120, vy: 0 }, { x: -600, y: 400, vx: 0, vy: -200 }, { x: 40, y: -700, vx: 0, vy: 0 }]) {
        boss.phaseIndex = attack.minPhase ?? 0;
        boss.phaseId = definition.phases[boss.phaseIndex].id;
        const strikes = kit.strikes(attackId, { boss, player });
        assert.ok(strikes.length >= 1);
        for (const entry of strikes) {
          assert.ok(entry.offset >= attack.tellTicks, `${attackId} offset`);
          if (entry.damage <= 0) continue;
          const clear = bossShapeClearDistance(entry.shape, { x: Math.max(interior.minX, Math.min(interior.maxX, player.x)), y: Math.max(interior.minY, Math.min(interior.maxY, player.y)) }, { interior, maxDistance: (entry.offset - 12) * 4, step: 4, angles: 96 });
          assert.ok(Number.isFinite(clear) && bossWalkBudgetTicks(clear) <= entry.offset, `${attackId} walk budget from (${player.x}, ${player.y})`);
        }
      }
    }
    // Tell then strike: the first issued group resolves tellTicks after its tell.
    const fresh = kit.create({ x: 0, y: 0, maxHealth: 4_000, seed: 3, startTick: 0 });
    const player = { x: 300, y: 100, vx: 0, vy: 0, groundZ: 0 };
    const tells = new Map();
    let checked = 0;
    for (let tick = 0; tick < 1_500; tick += 1) {
      for (const event of kit.step({ boss: fresh, tick, player }).events) {
        if (event.type === 'tell') tells.set(event.groupId, { tick, tellTicks: event.tellTicks });
        if (event.type === 'attack' && event.telegraphId === event.groupId) {
          assert.equal(tick - tells.get(event.groupId).tick, tells.get(event.groupId).tellTicks);
          checked += 1;
        }
      }
    }
    assert.ok(checked >= 3);
  });

  test(`${definition.bossId}: phases change at the v7 thresholds with a halt, a cleared tell set and the super as opener`, () => {
    const boss = kit.create({ x: 0, y: 0, maxHealth: 1_000, seed: 5, startTick: 0 });
    const player = { x: 260, y: 60, vx: 0, vy: 0, groundZ: 0 };
    assert.deepEqual(boss.thresholds, contract.phaseThresholds.map((ratio) => Math.round(1_000 * ratio)));
    let tick = 0;
    for (; tick < boss.introTicks; tick += 1) assert.equal(kit.step({ boss, tick, player }).mode, 'intro');
    assert.equal(kit.applyDamage({ boss, amount: 50, tick: 1 }).reason, 'intro');
    while (boss.pendingAttacks.length === 0) kit.step({ boss, tick: tick += 1, player });
    const crossing = kit.applyDamage({ boss, amount: 5_000, tick });
    assert.equal(crossing.phaseCrossed, definition.phases[1].id);
    assert.equal(boss.health, boss.thresholds[0], 'the overshoot is clamped to the threshold');
    assert.deepEqual(boss.pendingAttacks, []);
    assert.equal(boss.opener, definition.superId);
    const halt = kit.step({ boss, tick: tick + 1, player });
    assert.equal(halt.mode, 'halt');
    assert.ok(halt.events.some((event) => event.type === 'halt' && event.phaseId === definition.phases[1].id));
    assert.equal(kit.applyDamage({ boss, amount: 5, tick: tick + DISTRICT_BOSS_PHASE_HALT_TICKS }).reason, 'halt');
    let opener = null;
    for (let t = tick + 2; t < tick + DISTRICT_BOSS_PHASE_HALT_TICKS + 200 && !opener; t += 1) {
      opener = kit.step({ boss, tick: t, player }).events.find((event) => event.type === 'tell') ?? null;
    }
    assert.equal(opener?.attackId, definition.superId, 'the super opens the new phase');
    assert.equal(opener.tier, 'super');
  });

  test(`${definition.bossId}: the super fires the pure arena hook and leaves the boss staggered at x1.25`, () => {
    const boss = kit.create({ x: 0, y: 0, maxHealth: 4_000, seed: 9, startTick: 0 });
    const player = { x: 280, y: 40, vx: 0, vy: 0, groundZ: 0 };
    let hookEvent = null;
    let stagger = null;
    for (let tick = 0; tick < 4_000 && !stagger; tick += 1) {
      for (const event of kit.step({ boss, tick, player }).events) {
        if (event.type === hook) hookEvent = { ...event, tick };
        if (event.type === 'stagger') stagger = { ...event, tick };
      }
    }
    assert.ok(hookEvent, 'the hook event fired');
    assert.equal(hookEvent.bossId, definition.bossId);
    assert.equal(hookEvent.attackId, definition.superId);
    assert.ok(['circle', 'panels'].includes(hookEvent.geometry.type));
    assert.ok(stagger.untilTick === stagger.tick + DISTRICT_BOSS_STAGGER_TICKS);
    assert.deepEqual(kit.vulnerability(boss, stagger.tick + 10), { active: true, multiplier: 1.25, windowId: 'stagger' });
    assert.equal(kit.applyDamage({ boss, amount: 100, tick: stagger.tick + 10 }).damageApplied, 125);
  });

  test(`${definition.bossId}: death emits one boss-defeated run event; the court drops its Seal at the pedestal`, () => {
    const boss = kit.create({ x: 0, y: 0, maxHealth: 300, seed: 2, startTick: 0 });
    const player = { x: 200, y: 0, vx: 0, vy: 0, groundZ: 0 };
    for (let tick = 0; tick <= boss.introTicks; tick += 1) kit.step({ boss, tick, player });
    let tick = boss.introTicks + 1;
    let result;
    while (!(result = kit.applyDamage({ boss, amount: 90, tick })).defeated) tick += DISTRICT_BOSS_PHASE_HALT_TICKS + 1;
    assert.deepEqual(result.runEvent, { type: 'game:run-event', name: 'boss-defeated', data: { bossId: targetId, tick, elapsedTicks: tick } });
    assert.equal(kit.applyDamage({ boss, amount: 1, tick: tick + 1 }).reason, 'inactive');
    assert.equal(kit.step({ boss, tick: tick + 1, player }).mode, 'defeated');
    const court = WORLD_V1_DISTRICT_COURTS[definition.bossId];
    const drops = createBossDrops();
    const seal = dropCourtGenesisSeal(drops, { bossId: definition.bossId, tick, arena: court });
    assert.deepEqual({ x: seal.x, y: seal.y, arenaId: seal.arenaId }, { ...court.pedestal, arenaId: court.id });
    assert.equal(dropCourtGenesisSeal(drops, { bossId: definition.bossId, tick, arena: court }), null);
    // The shipped table knows nothing about the court: no pedestal, no drop.
    assert.equal(dropGenesisSeal(createBossDrops(), { bossId: definition.bossId, tick, arenaId: court.id }), null);
  });
}

test('the ten-area registry holds all four bosses on their courts; the shipped registry still holds only the Liquidator', () => {
  assert.deepEqual(Object.keys(BOSS_DEFINITIONS), ['liquidator']);
  assert.deepEqual(Object.keys(WORLD_V1_BOSS_DEFINITIONS).sort(), [...HMH_RUN_SUMMARY_CATALOGS_V7.bosses].sort());
  for (const bossId of DISTRICT_IDS) {
    const definition = WORLD_V1_BOSS_DEFINITIONS[bossId];
    assert.equal(definition.readyTick, HMH_V7_BOSSES[bossId].readyTick);
    assert.equal(definition.silverBurst, HMH_V7_BOSSES[bossId].silverBurst);
    assert.deepEqual(definition.markers, HMH_V7_BOSSES[bossId].phaseThresholds);
    assert.equal(definition.arenas.threshold, WORLD_V1_DISTRICT_COURTS[bossId]);
    assert.equal(WORLD_V1_DISTRICT_COURTS[bossId].walls.length, 2);
  }
  assert.deepEqual(Object.keys(createBossSlots({ seed: 1 }).slots), ['liquidator']);
  assert.deepEqual(Object.keys(createBossSlots({ seed: 1, definitions: WORLD_V1_BOSS_DEFINITIONS }).slots).sort(), [...HMH_RUN_SUMMARY_CATALOGS_V7.bosses].sort());
  assert.equal(createBossSlots({ seed: 1 }).definitions, BOSS_DEFINITIONS);
});

test('crossing a court threshold after its ready tick starts the district boss at contract HP and records its v7 row', () => {
  const court = WORLD_V1_DISTRICT_COURTS['rug-pull-baron'];
  const slots = createBossSlots({ seed: 7, definitions: WORLD_V1_BOSS_DEFINITIONS });
  const at = { x: court.threshold.x, y: court.threshold.y, groundZ: 0, radius: 24 };
  assert.ok(pastCourtThreshold(court, at));
  const early = stepBossSlots(slots, { tick: HMH_V7_BOSSES['rug-pull-baron'].readyTick - 1, player: at, missionEvents: [], mission: { completed: new Map() }, level: 9, enemies: [] });
  assert.deepEqual(early.events, []);
  assert.deepEqual(bossZoneArming(slots, HMH_V7_BOSSES['rug-pull-baron'].readyTick - 1).status.get('rug-pull-baron-threshold'), { status: 'waiting', readyAt: HMH_V7_BOSSES['rug-pull-baron'].readyTick });
  const tick = HMH_V7_BOSSES['rug-pull-baron'].readyTick;
  const frame = stepBossSlots(slots, { tick, player: at, missionEvents: [], mission: { completed: new Map() }, level: 9, enemies: [] });
  const initiated = frame.events.find((event) => event.type === 'boss-initiated');
  assert.deepEqual(initiated, { type: 'boss-initiated', bossId: 'rug-pull-baron', trigger: 'threshold', tick, arenaId: court.id, maxHealth: initiated.maxHealth });
  assert.equal(slots.slots['rug-pull-baron'].boss.bossId, 'rug-pull-baron');
  assert.equal(slots.slots['rug-pull-baron'].boss.maxHealth, Math.round(HMH_V7_BOSSES['rug-pull-baron'].targetSeconds * 9.4));
  assert.equal(bossRunRows(slots).find((row) => row.bossId === 'rug-pull-baron').initiations, 1);
  // Only one boss lives at a time: the Lockkeeper's threshold is refused meanwhile.
  const lock = WORLD_V1_DISTRICT_COURTS.lockkeeper;
  const later = stepBossSlots(slots, { tick: tick + 1, player: { x: lock.threshold.x, y: lock.threshold.y, groundZ: 0, radius: 24 }, missionEvents: [], mission: { completed: new Map() }, level: 9, enemies: [] });
  assert.ok(!later.events.some((event) => event.type === 'boss-initiated'));
  // Both exit locks close once the floor clears (here on the trigger tick
  // itself: nothing stands in either footprint); the defeat pays the burst.
  assert.ok(frame.events.some((event) => event.type === 'boss-locked' && event.bossId === 'rug-pull-baron'));
  assert.deepEqual(slots.slots['rug-pull-baron'].closedWalls, court.walls.map((wall) => wall.id));
  for (let t = tick + 2; t < tick + 400; t += 1) stepBossSlots(slots, { tick: t, player: { x: court.centre.x, y: court.centre.y, groundZ: 0, radius: 24 }, missionEvents: [], mission: { completed: new Map() }, level: 9, enemies: [] });
  assert.equal(slots.slots['rug-pull-baron'].locked, true);
  const reward = defeatBossSlot(slots, { bossId: 'rug-pull-baron', tick: tick + 500 });
  assert.equal(reward.silverBurst, HMH_V7_BOSSES['rug-pull-baron'].silverBurst);
  assert.equal(reward.unlockObjective, 'rug-pull-baron-defeated');
  assert.equal(reward.goldenParachute, false);
  assert.equal(bossRunRows(slots).find((row) => row.bossId === 'rug-pull-baron').defeatedTick, tick + 500);
});

test('the shipped Level 1 map never spawns a district boss and its verifier still maps only the Liquidator', () => {
  const slots = createBossSlots({ seed: 3 });
  const mission = { completed: new Map() };
  for (const bossId of DISTRICT_IDS) {
    const court = WORLD_V1_DISTRICT_COURTS[bossId];
    const player = { x: court.threshold.x, y: court.threshold.y, groundZ: 0, radius: 24 };
    const forged = [{ type: 'boss-zone', zoneId: `${bossId}-threshold`, bossId, zoneKind: 'trigger', trigger: 'threshold', tick: 90_000 }];
    const frame = stepBossSlots(slots, { tick: 90_000 + DISTRICT_IDS.indexOf(bossId), player, missionEvents: forged, mission, level: 30, enemies: [] });
    assert.deepEqual(frame.events, []);
    assert.equal(slots.slots[bossId], undefined);
  }
  assert.deepEqual(bossRunRows(slots).filter((row) => row.bossId !== 'liquidator'), DISTRICT_IDS.map((bossId) => ({ bossId, initiations: 0, firstInitiatedTick: 0, lastInitiatedTick: 0, defeatedTick: 0 })).sort((a, b) => HMH_RUN_SUMMARY_CATALOGS_V7.bosses.indexOf(a.bossId) - HMH_RUN_SUMMARY_CATALOGS_V7.bosses.indexOf(b.bossId)));
  const missionSource = readFileSync(new URL('../apps/hmh-reboot/src/mission-objectives.mjs', import.meta.url), 'utf8');
  const levelOne = readFileSync(new URL('../apps/hmh-reboot/src/level-one-world.mjs', import.meta.url), 'utf8');
  const verifier = readFileSync(new URL('../server/verify/hmh.mjs', import.meta.url), 'utf8');
  const arenas = readFileSync(new URL('../apps/hmh-reboot/src/boss-arenas.mjs', import.meta.url), 'utf8');
  const drops = readFileSync(new URL('../apps/hmh-reboot/src/boss-drops.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /export const HMH_BOSS_ID = 'boss-liquidator';/);
  for (const source of [missionSource, levelOne, verifier, arenas, drops]) {
    for (const token of ['rug-pull-baron', 'boss-51-foreman', 'boss-lockkeeper', 'fifty-one-percent-foreman', 'WORLD_V1_', 'district-boss', 'boss-courts-world-v1']) assert.ok(!source.includes(token), token);
  }
});
