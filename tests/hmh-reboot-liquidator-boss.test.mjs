// The reworked Liquidator (design package 4.3, slice S1.5): started by the
// player, phases at HP thresholds with Trading Halts, a table-driven kit on
// the boss geometry kit, and damage that only ever moves through
// applyLiquidatorDamage.
import { runtimeTelemetrySource } from './helpers/hmh-runtime-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  LIQUIDATOR_ATTACK_DEFINITIONS,
  LIQUIDATOR_BELL_INTRO_TICKS,
  LIQUIDATOR_BODY,
  LIQUIDATOR_ENDLESS_CYCLE,
  LIQUIDATOR_KNEEL_TICKS,
  LIQUIDATOR_MAX_DAMAGE_MULTIPLIER,
  LIQUIDATOR_PHASES,
  LIQUIDATOR_PHASE_HALT_TICKS,
  LIQUIDATOR_READABILITY_BUDGET,
  LIQUIDATOR_STALL_TICKS,
  MAX_BOSS_EVENTS_PER_TICK,
  applyLiquidatorDamage,
  createLiquidatorAddCandidates,
  createLiquidatorBoss,
  getLiquidatorRoleCheck,
  getLiquidatorVulnerability,
  isLiquidatorTargetable,
  liquidatorChartLayout,
  liquidatorOpenArena,
  liquidatorStrikes,
  resolveLiquidatorAttack,
  simulateLiquidatorDps,
  stepLiquidatorBoss,
} from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { LIQUIDATOR_DARK_POOL, LIQUIDATOR_MARGIN_FLOOR } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { renderLiquidatorTelegraph } from '../apps/hmh-reboot/src/liquidator-telegraph-renderer.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES } from '../sdk/hmh-run-contract-v7.mjs';

const ARENA = LIQUIDATOR_MARGIN_FLOOR;
const newBoss = (overrides = {}) => createLiquidatorBoss({ arena: ARENA, startTick: 1_000, maxHealth: 3_000, seed: 1337, ...overrides });
const hero = (x, y) => ({ x, y, groundZ: 0, vx: 0, vy: 0 });

class RecordingGraphics {
  constructor() { this.calls = []; }
  moveTo(...args) { this.#record('moveTo', args); return this; }
  lineTo(...args) { this.#record('lineTo', args); return this; }
  circle(...args) { this.#record('circle', args); return this; }
  rect(...args) { this.#record('rect', args); return this; }
  poly(...args) { this.calls.push(['poly', ...args]); return this; }
  closePath() { return this; }
  fill(...args) { this.calls.push(['fill', ...args]); return this; }
  stroke(...args) { this.calls.push(['stroke', ...args]); return this; }
  #record(operation, args) {
    assert.ok(args.every(Number.isFinite), `${operation} received a non-finite coordinate or radius`);
    this.calls.push([operation, ...args]);
  }
}
const project = (point) => ({ x: point.x * 0.5 + 12, y: point.y * 0.5 - point.z + 18 });

test('the kit is the package 4.3 attack table, and short-squeeze-burst is retired', () => {
  const table = Object.fromEntries(Object.values(LIQUIDATOR_ATTACK_DEFINITIONS).map((a) => [a.id, [a.tellTicks, a.damage]]));
  assert.deepEqual(table, {
    'crash-lane': [45, 14], 'gavel-stamp': [60, 18], 'debt-collection': [44, 12], 'margin-call-dash': [36, 16],
    'candle-chart': [96, 16], 'enforcement-order': [45, 0], 'circuit-breaker': [130, 24], 'total-liquidation-super': [150, 30],
  });
  assert.equal(LIQUIDATOR_ATTACK_DEFINITIONS['candle-chart'].columnIntervalTicks, 18);
  assert.equal(LIQUIDATOR_ATTACK_DEFINITIONS['margin-call-dash'].maxDistance, 600);
  assert.deepEqual(LIQUIDATOR_PHASES.map((phase) => phase.id), ['market-open', 'margin-call', 'total-liquidation']);
  assert.equal(LIQUIDATOR_PHASE_HALT_TICKS, HMH_V7_BOSS_RULES.BOSS_PHASE_HALT_TICKS);
  assert.ok(LIQUIDATOR_BELL_INTRO_TICKS >= HMH_V7_BOSS_RULES.BOSS_INTRO_MIN_TICKS);
  assert.equal(LIQUIDATOR_READABILITY_BUDGET.simultaneousTelegraphs, 4);
  assert.equal(LIQUIDATOR_READABILITY_BUDGET.activeAdds, 4);
  assert.deepEqual([LIQUIDATOR_BODY.radius, LIQUIDATOR_BODY.hurtRadius, LIQUIDATOR_BODY.minZ, LIQUIDATOR_BODY.maxZ, LIQUIDATOR_BODY.armor, LIQUIDATOR_BODY.knockbackResistance], [56, 48, 4, 96, 1, 0.92]);
  assert.equal(LIQUIDATOR_ATTACK_DEFINITIONS['short-squeeze-burst'], undefined);
  assert.throws(() => createLiquidatorBoss({ arena: ARENA }), /maxHealth/);
});

test('the Closing Bell start is untargetable, silent and damage-proof for its 150-tick intro', () => {
  const boss = newBoss();
  const player = hero(11_000, 2_500);
  for (let tick = 1_000; tick < 1_000 + LIQUIDATOR_BELL_INTRO_TICKS; tick += 1) {
    const report = stepLiquidatorBoss({ boss, tick, player });
    assert.equal(report.mode, 'intro');
    assert.deepEqual(report.events, []);
    assert.equal(isLiquidatorTargetable(boss, tick), false);
    assert.equal(applyLiquidatorDamage({ boss, amount: 500, tick }).reason, 'intro');
  }
  assert.equal(boss.health, 3_000);
  const engage = stepLiquidatorBoss({ boss, tick: 1_150, player });
  assert.deepEqual(engage.events.map((event) => event.type), ['engage']);
  assert.equal(isLiquidatorTargetable(boss, 1_150), true);
  assert.equal(applyLiquidatorDamage({ boss, amount: 10, tick: 1_150 }).damageApplied, 10);
});

test('the Dark Pool start has no intro and takes x1.25 damage for 300 ticks (Insider Trading)', () => {
  const boss = newBoss({ entry: 'dark-pool', arena: LIQUIDATOR_DARK_POOL });
  assert.deepEqual([boss.x, boss.y], [LIQUIDATOR_DARK_POOL.spawn.x, LIQUIDATOR_DARK_POOL.spawn.y]);
  assert.equal(isLiquidatorTargetable(boss, 1_000), true);
  assert.equal(applyLiquidatorDamage({ boss, amount: 100, tick: 1_000 }).damageApplied, 125);
  assert.equal(getLiquidatorVulnerability(boss, 1_299).windowId, 'insider-trading');
  assert.equal(applyLiquidatorDamage({ boss, amount: 100, tick: 1_299 }).damageApplied, 125);
  assert.equal(getLiquidatorVulnerability(boss, 1_300).active, false);
  assert.equal(applyLiquidatorDamage({ boss, amount: 100, tick: 1_300 }).damageApplied, 100);
});

test('each HP threshold clamps the overshoot and starts a 90-tick invulnerable Trading Halt', () => {
  const boss = newBoss();
  const player = hero(11_000, 2_500);
  for (let tick = 1_000; tick <= 1_200; tick += 1) stepLiquidatorBoss({ boss, tick, player });
  assert.ok(boss.pendingAttacks.length > 0 || boss.lastResolved, 'he is fighting before the threshold');
  const [firstThreshold, secondThreshold] = boss.thresholds;
  assert.deepEqual(boss.thresholds, [1_980, 990]);
  const crossing = applyLiquidatorDamage({ boss, amount: 2_500, tick: 1_201 });
  assert.equal(crossing.damageApplied, 3_000 - firstThreshold, 'the overshoot is clamped');
  assert.equal(crossing.phaseCrossed, 'margin-call');
  assert.equal(boss.health, firstThreshold);
  assert.equal(boss.pendingAttacks.length, 0, 'pending tells clear at the crossing');
  assert.equal(applyLiquidatorDamage({ boss, amount: 50, tick: 1_201 }).reason, 'halt', 'no more damage on the crossing tick');
  for (const tick of [1_202, 1_250, 1_201 + LIQUIDATOR_PHASE_HALT_TICKS]) assert.equal(applyLiquidatorDamage({ boss, amount: 50, tick }).reason, 'halt');
  const report = stepLiquidatorBoss({ boss, tick: 1_202, player });
  assert.equal(report.mode, 'halt');
  assert.deepEqual(report.events.map((event) => [event.type, event.phaseId]), [['halt', 'margin-call']]);
  for (let tick = 1_203; tick <= 1_291; tick += 1) assert.deepEqual(stepLiquidatorBoss({ boss, tick, player }).events, []);
  // The halt ends: Margin Call opens with the Circuit Breaker.
  const opener = stepLiquidatorBoss({ boss, tick: 1_292, player });
  assert.deepEqual(opener.events.map((event) => [event.type, event.attackId]), [['tell', 'circuit-breaker']]);
  assert.equal(applyLiquidatorDamage({ boss, amount: 50, tick: 1_292 }).damageApplied, 50);
  // Total Liquidation opens with its super, then a 120-tick kneel at x1.25.
  applyLiquidatorDamage({ boss, amount: 5_000, tick: 1_300 });
  assert.equal(boss.health, secondThreshold);
  assert.equal(boss.phaseId, 'total-liquidation');
  let tell = null;
  for (let tick = 1_301; tick <= 1_391 && !tell; tick += 1) tell = stepLiquidatorBoss({ boss, tick, player }).events.find((event) => event.type === 'tell') ?? null;
  assert.equal(tell.attackId, 'total-liquidation-super');
  assert.equal(tell.tick, 1_391);
  let kneel = null;
  for (let tick = 1_392; tick <= 1_541 && !kneel; tick += 1) kneel = stepLiquidatorBoss({ boss, tick, player }).events.find((event) => event.type === 'kneel') ?? null;
  assert.equal(kneel.tick, 1_391 + 150);
  assert.equal(kneel.untilTick, kneel.tick + LIQUIDATOR_KNEEL_TICKS);
  assert.equal(getLiquidatorVulnerability(boss, kneel.tick + 1).windowId, 'kneel');
  assert.equal(applyLiquidatorDamage({ boss, amount: 100, tick: kneel.tick + 1, roleMultiplier: 1.15 }).damageApplied, 100 * LIQUIDATOR_MAX_DAMAGE_MULTIPLIER, 'role x kneel is capped at 1.25');
  assert.throws(() => applyLiquidatorDamage({ boss, amount: 1, tick: kneel.tick + 2, roleMultiplier: 1.16 }), /role-check bound/);
});

test('the fastest possible defeats honour the contract minimum fights (302 bell, 182 Dark Pool)', () => {
  const bell = simulateLiquidatorDps({ damagePerTick: 1e9, maxHealth: 4_640 });
  assert.deepEqual(bell, { defeated: true, defeatTick: LIQUIDATOR_BELL_INTRO_TICKS + 2 * (LIQUIDATOR_PHASE_HALT_TICKS + 1), remainingHealth: 0 });
  assert.ok(bell.defeatTick >= HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS);
  const pool = simulateLiquidatorDps({ damagePerTick: 1e9, maxHealth: 4_640, entry: 'dark-pool' });
  // Damage starts on the initiation tick (tick 0 here); the loop starts at 1.
  assert.equal(pool.defeatTick, 1 + 2 * (LIQUIDATOR_PHASE_HALT_TICKS + 1));
  assert.ok(pool.defeatTick >= HMH_V7_BOSSES.liquidator.minFightTicks);
  assert.deepEqual(simulateLiquidatorDps({ damagePerTick: 0, maxHealth: 4_640 }), { defeated: false, defeatTick: null, remainingHealth: 4_640 });
});

test('environmental damage wears him down but never lands the killing blow', () => {
  const boss = newBoss({ entry: 'dark-pool', maxHealth: 100 });
  boss.thresholds = [];
  const hit = applyLiquidatorDamage({ boss, amount: 500, tick: 1_000, environmental: true });
  assert.equal(boss.health, 1);
  assert.equal(hit.defeated, false);
  const kill = applyLiquidatorDamage({ boss, amount: 5, tick: 1_001 });
  assert.equal(kill.defeated, true);
  assert.deepEqual(kill.runEvent, { type: 'game:run-event', name: 'boss-defeated', data: { bossId: 'boss-liquidator', tick: 1_001, elapsedTicks: 1 } });
  assert.equal(applyLiquidatorDamage({ boss, amount: 5, tick: 1_002 }).runEvent, null);
  assert.equal(boss.pendingAttacks.length, 0);
});

test('the attack table follows range and phase, and never repeats an attack back to back', () => {
  // Every tell is checked against the range and phase at its own start: under
  // 200 only Debt Collection (or the plain lane and seal when it would not be
  // fair); the Chart only at mid range; the Dash only from Margin Call on.
  const seen = { 0: new Set(), 1: new Set() };
  for (const [phaseIndex, distance] of [[0, 150], [0, 400], [0, 700], [1, 150], [1, 400], [1, 700]]) {
    for (let seed = 1; seed <= 30; seed += 1) {
      const boss = newBoss({ seed, entry: 'dark-pool', arena: liquidatorOpenArena({ x: 0, y: 0 }), x: -400, y: 0 });
      boss.phaseIndex = phaseIndex;
      boss.phaseId = LIQUIDATOR_PHASES[phaseIndex].id;
      const player = hero(-400 + distance, 0);
      for (let tick = 1_000; tick <= 1_400; tick += 1) {
        const at = Math.hypot(player.x - boss.x, player.y - boss.y);
        for (const event of stepLiquidatorBoss({ boss, tick, player }).events) {
          if (event.type !== 'tell') continue;
          seen[phaseIndex].add(event.attackId);
          if (event.attackId === 'debt-collection') assert.ok(at < 200, `debt at ${at}`);
          if (event.attackId === 'candle-chart') assert.ok(at >= 200 && at <= 520, `chart at ${at}`);
          if (at < 200) assert.ok(['debt-collection', 'crash-lane', 'gavel-stamp', 'enforcement-order'].includes(event.attackId), `${event.attackId} at ${at}`);
          if (at > 520 && phaseIndex === 0) assert.ok(['crash-lane', 'gavel-stamp'].includes(event.attackId), `${event.attackId} at ${at}`);
        }
      }
    }
  }
  assert.ok(!seen[0].has('margin-call-dash') && !seen[0].has('enforcement-order'), 'Market Open has no dash and no adds');
  for (const attackId of ['debt-collection', 'crash-lane', 'gavel-stamp', 'candle-chart']) assert.ok(seen[0].has(attackId), attackId);
  for (const attackId of ['margin-call-dash', 'enforcement-order']) assert.ok(seen[1].has(attackId), attackId);
  const boss = newBoss({ entry: 'dark-pool' });
  let last = null;
  const player = hero(11_000, 2_520);
  for (let tick = 1_000; tick <= 4_000; tick += 1) {
    for (const event of stepLiquidatorBoss({ boss, tick, player }).events) {
      if (event.type !== 'tell') continue;
      assert.notEqual(event.attackId, last, `tick ${tick} repeats ${last}`);
      last = event.attackId;
    }
  }
});

test('Crash Lane widens to a V of 2 in Margin Call and fires 3 in Total Liquidation; phase-3 seals walk the hero line', () => {
  const boss = newBoss();
  const player = { ...hero(11_300, 2_400), vx: 120, vy: 0 };
  assert.equal(liquidatorStrikes('crash-lane', { boss, player, phaseIndex: 0 })[0].shape.type, 'lane');
  assert.equal(liquidatorStrikes('crash-lane', { boss, player, phaseIndex: 1 })[0].shape.shapes.length, 2);
  const triple = liquidatorStrikes('crash-lane', { boss, player, phaseIndex: 2 });
  assert.deepEqual(triple.map((entry) => [entry.offset, entry.shape.type]), [[45, 'lane'], [65, 'union']], 'the centre lane, then the V');
  for (const lane of [triple[0].shape, ...triple[1].shape.shapes]) {
    const { target } = lane;
    const onEdge = [ARENA.bounds.minX, ARENA.bounds.maxX].some((x) => Math.abs(target.x - x) < 1e-6)
      || [ARENA.bounds.minY, ARENA.bounds.maxY].some((y) => Math.abs(target.y - y) < 1e-6);
    assert.ok(onEdge, 'a crash lane runs to the edge of the floor');
  }
  const stamps = liquidatorStrikes('gavel-stamp', { boss, player, phaseIndex: 2 });
  assert.deepEqual(stamps.map((entry) => entry.offset), [60, 80, 100]);
  assert.deepEqual(stamps.map((entry) => entry.shape.center.x), [11_300, 11_340, 11_380]);
});

test('the Candle Chart covers the floor with 2 red rows per column, the green row moving at most one row', () => {
  for (const arena of [ARENA, LIQUIDATOR_DARK_POOL]) {
    for (let ordinal = 0; ordinal < 200; ordinal += 1) {
      const layout = liquidatorChartLayout(arena, 1337, ordinal);
      for (let column = 1; column < layout.columns; column += 1) assert.ok(Math.abs(layout.safeRows[column] - layout.safeRows[column - 1]) <= 1);
      assert.ok(layout.safeRows.every((row) => row >= 0 && row < layout.rows));
    }
  }
  const boss = newBoss();
  const player = hero(11_000, 2_400);
  const sweep = liquidatorStrikes('candle-chart', { boss, player, phaseIndex: 0 });
  assert.equal(sweep.length, 5);
  assert.deepEqual(sweep.map((entry) => entry.offset), [96, 114, 132, 150, 168]);
  assert.ok(sweep.every((entry) => entry.shape.cells.length === 2));
  const area = (c) => (c.maxX - c.minX) * (c.maxY - c.minY);
  const covered = sweep.reduce((sum, entry) => sum + entry.shape.cells.reduce((total, c) => total + area(c), 0) + area(entry.chart.safeCell), 0);
  const floor = (ARENA.bounds.maxX - ARENA.bounds.minX) * (ARENA.bounds.maxY - ARENA.bounds.minY);
  assert.ok(Math.abs(covered - floor) < 1e-6, 'the columns tile the whole floor');
  const outAndBack = liquidatorStrikes('candle-chart', { boss, player, phaseIndex: 2 });
  assert.equal(outAndBack.length, 9);
  const expected = [0, 1, 2, 3, 4, 3, 2, 1, 0].map((c) => (outAndBack[0].chart.column === 0 ? c : 4 - c));
  assert.deepEqual(outAndBack.map((entry) => entry.chart.column), expected);
});

test('the supers anchor their safe circles to the floor centre; the Circuit Breaker alternates east-west and north-south', () => {
  const boss = newBoss({ x: 10_700, y: 2_290 });
  const player = hero(11_400, 2_600);
  const first = liquidatorStrikes('circuit-breaker', { boss, player, circuitCount: 0 })[0];
  const second = liquidatorStrikes('circuit-breaker', { boss, player, circuitCount: 1 })[0];
  assert.deepEqual([first.sectorId, first.shape.zones], ['east-west', [{ x: 10_850, y: 2_400 }, { x: 11_150, y: 2_400 }]]);
  assert.deepEqual([second.sectorId, second.shape.zones], ['north-south', [{ x: 11_000, y: 2_250 }, { x: 11_000, y: 2_550 }]]);
  assert.equal(first.shape.radius, 76);
  const final = liquidatorStrikes('total-liquidation-super', { boss, player })[0];
  assert.deepEqual(final.shape.zones, [{ x: 10_830, y: 2_320 }, { x: 11_170, y: 2_320 }, { x: 11_000, y: 2_570 }]);
  assert.equal(final.shape.radius, 68);
  const event = { type: 'attack', geometry: first.shape, groundZ: 0, damage: 24, leash: ARENA.bounds };
  assert.equal(resolveLiquidatorAttack({ event, player: hero(10_850 + 52, 2_400) }).hit, false);
  assert.equal(resolveLiquidatorAttack({ event, player: hero(10_850 + 53, 2_400) }).hit, true);
});

test('the Enforcement Order brings phase troops as boss:<id>:w<n>:<k> adds, never more than four alive', () => {
  const boss = newBoss();
  boss.phaseIndex = 1;
  const player = hero(10_600, 2_300);
  const [margin] = liquidatorStrikes('enforcement-order', { boss, player, phaseIndex: 1, wave: 0 });
  assert.deepEqual(margin.summon.adds.map((add) => [add.id, add.archetypeId]), [['boss:liquidator:w1:0', 'liquidator-agent'], ['boss:liquidator:w1:1', 'liquidator-agent']]);
  const [total] = liquidatorStrikes('enforcement-order', { boss, player, phaseIndex: 2, wave: 3 });
  assert.deepEqual(total.summon.adds.map((add) => [add.id, add.archetypeId]), [['boss:liquidator:w4:0', 'liquidator-agent'], ['boss:liquidator:w4:1', 'gas-bomber']]);
  // The seals light at the floor-edge sites farthest from the hero.
  assert.ok(margin.summon.adds.every((add) => Math.hypot(add.x - player.x, add.y - player.y) > 500));
  const event = { type: 'add-wave', attackId: 'enforcement-order', adds: total.summon.adds, groundZ: 0 };
  assert.equal(createLiquidatorAddCandidates({ event }).length, 2);
  assert.equal(createLiquidatorAddCandidates({ event, alive: 3 }).length, 1);
  assert.deepEqual(createLiquidatorAddCandidates({ event, alive: 4 }), []);
  assert.throws(() => createLiquidatorAddCandidates({ event: { type: 'add-wave', attackId: 'bad-debt-summon' } }), /enforcement-order/);
});

function scriptedFight({ seed = 1337, partition = 1, entry = 'bell', ticks = 6_000, dps = 1.1 } = {}) {
  const arena = entry === 'bell' ? ARENA : LIQUIDATOR_DARK_POOL;
  const boss = createLiquidatorBoss({ arena, startTick: 500, maxHealth: 4_640, seed, entry });
  const lines = [];
  let accumulator = 0;
  let tick = 500;
  const end = 500 + ticks;
  const inside = (x, y) => ({ x: Math.max(arena.bounds.minX + 30, Math.min(arena.bounds.maxX - 30, x)), y: Math.max(arena.bounds.minY + 30, Math.min(arena.bounds.maxY - 30, y)) });
  let maxGroups = 0;
  let maxEvents = 0;
  while (tick < end) {
    accumulator += partition;
    while (accumulator >= 1 && tick < end) {
      accumulator -= 1;
      // A hero circling the floor centre.
      const angle = tick / 190;
      const spot = inside(arena.centre.x + Math.cos(angle) * 360, arena.centre.y + Math.sin(angle) * 160);
      const player = { ...spot, groundZ: 0, vx: -Math.sin(angle) * 114, vy: Math.cos(angle) * 51 };
      const report = stepLiquidatorBoss({ boss, tick, player, addsAlive: 0 });
      maxEvents = Math.max(maxEvents, report.events.length);
      maxGroups = Math.max(maxGroups, new Set(boss.pendingAttacks.map((pending) => pending.groupId)).size);
      for (const event of report.events) lines.push(`${tick}:${event.type}:${event.attackId ?? event.phaseId ?? ''}`);
      if (isLiquidatorTargetable(boss, tick)) {
        const result = applyLiquidatorDamage({ boss, amount: dps, tick });
        if (result.phaseCrossed) lines.push(`${tick}:cross:${result.phaseCrossed}`);
        if (result.defeated) lines.push(`${tick}:defeated`);
      }
      assert.ok(boss.x >= arena.bounds.minX + 56 - 1e-6 && boss.x <= arena.bounds.maxX - 56 + 1e-6, `boss x ${boss.x} leaves the floor`);
      assert.ok(boss.y >= arena.bounds.minY + 56 - 1e-6 && boss.y <= arena.bounds.maxY - 56 + 1e-6, `boss y ${boss.y} leaves the floor`);
      tick += 1;
    }
  }
  return { boss, lines, digest: createHash('sha256').update(lines.join('\n')).update(`${boss.x},${boss.y},${boss.health}`).digest('hex'), maxGroups, maxEvents };
}

test('one seed gives one fight across render partitions, within the telegraph and event caps', () => {
  const a = scriptedFight({ partition: 1 });
  for (const partition of [2, 3, 4]) assert.equal(scriptedFight({ partition }).digest, a.digest, `partition ${partition}`);
  assert.equal(scriptedFight({ partition: 1 }).digest, a.digest);
  assert.notEqual(scriptedFight({ seed: 7 }).digest, a.digest, 'another seed chooses other attacks');
  assert.ok(a.maxGroups <= LIQUIDATOR_READABILITY_BUDGET.simultaneousTelegraphs);
  assert.ok(a.maxEvents <= MAX_BOSS_EVENTS_PER_TICK);
  assert.ok(a.lines.some((line) => line.endsWith(':cross:margin-call')));
  assert.ok(a.lines.some((line) => line.endsWith(':cross:total-liquidation')));
  assert.ok(a.lines.some((line) => line.endsWith(':defeated')));
  const tells = new Set(a.lines.filter((line) => line.includes(':tell:')).map((line) => line.split(':')[2]));
  for (const attackId of ['crash-lane', 'circuit-breaker', 'total-liquidation-super', 'candle-chart']) assert.ok(tells.has(attackId), `${attackId} is used`);
  const pool = scriptedFight({ entry: 'dark-pool' });
  assert.equal(scriptedFight({ entry: 'dark-pool', partition: 3 }).digest, pool.digest);
});

test('after 5,400 engaged ticks the stall guard loops the final set on the 1,440-tick cycle', () => {
  const { lines } = scriptedFight({ dps: 0, ticks: LIQUIDATOR_STALL_TICKS + 2 * 1_440 });
  const stallStart = 500 + LIQUIDATOR_STALL_TICKS;
  const late = lines.filter((line) => line.includes(':tell:') && Number(line.split(':')[0]) >= stallStart);
  assert.ok(late.length >= 6);
  const offsets = new Set(LIQUIDATOR_ENDLESS_CYCLE.map((entry) => entry.offset));
  for (const line of late) assert.ok(offsets.has((Number(line.split(':')[0]) - stallStart) % 1_440), line);
});

test('a dash into the floor edge staggers him for 60 ticks at x1.25', () => {
  const boss = newBoss({ entry: 'dark-pool', x: 10_700, y: 2_400 });
  boss.phaseIndex = 1;
  boss.phaseId = 'margin-call';
  boss.nextActionTick = Infinity;
  const [dash] = liquidatorStrikes('margin-call-dash', { boss, player: hero(10_560, 2_400) });
  assert.equal(dash.dash.distance, 10_700 - ARENA.bounds.minX, 'the wall is closer than 600');
  boss.motion = { kind: 'dash', direction: dash.dash.direction, remaining: dash.dash.distance };
  let tick = 1_000;
  while (boss.motion) stepLiquidatorBoss({ boss, tick: tick++, player: hero(11_400, 2_400) });
  assert.ok(Math.abs(boss.x - (ARENA.bounds.minX + 56)) < 1e-3, `${boss.x}`);
  assert.equal(getLiquidatorVulnerability(boss, tick).windowId, 'stagger');
  assert.equal(boss.staggerUntil, tick - 1 + 60);
});

test('strikes hit the hero disk inside the leash, and lanes stop at tall authored cover', () => {
  const lane = { type: 'lane', origin: { x: 0, y: 0 }, target: { x: 200, y: 0 }, width: 54 };
  const event = (geometry, leash = null) => ({ type: 'attack', attackId: 'crash-lane', geometry, groundZ: 0, damage: 14, leash });
  assert.deepEqual(resolveLiquidatorAttack({ event: event(lane), player: hero(160, 51) }), { hit: true, damage: 14, reason: null });
  assert.equal(resolveLiquidatorAttack({ event: event(lane), player: hero(160, 51.5) }).hit, false);
  const cover = { id: 'arena-cover', solid: true, combatCover: true, minZ: 0, maxZ: 96, shape: { type: 'circle', x: 80, y: 0, radius: 20 } };
  assert.deepEqual(resolveLiquidatorAttack({ event: event(lane), player: hero(160, 0), blockers: [cover] }), { hit: false, damage: 0, reason: 'cover', blockerId: 'arena-cover' });
  const low = { ...cover, id: 'ankle-high', maxZ: 12 };
  assert.equal(resolveLiquidatorAttack({ event: event(lane), player: hero(160, 0), blockers: [low] }).hit, true);
  assert.throws(() => resolveLiquidatorAttack({ event: event(lane), player: hero(160, 0), blockers: 'no' }), /blockers must be an array/);
  const town = resolveLiquidatorAttack({
    event: event({ type: 'lane', origin: { x: 11_000, y: 2_550 }, target: { x: 11_800, y: 3_400 }, width: 54 }),
    player: hero(11_800, 3_400),
    blockers: LEVEL_ONE_WORLD.collisionBlockers,
  });
  assert.deepEqual(town, { hit: false, damage: 0, reason: 'cover', blockerId: 'town-east-lean-to' });
  const leashed = event({ type: 'circle', center: { x: 11_000, y: 2_400 }, radius: 5_000 }, ARENA.bounds);
  assert.equal(resolveLiquidatorAttack({ event: leashed, player: hero(ARENA.bounds.maxX + 120, 2_400) }).hit, true);
  assert.deepEqual(resolveLiquidatorAttack({ event: leashed, player: hero(ARENA.bounds.maxX + 121, 2_400) }), { hit: false, damage: 0, reason: 'leash' });
  assert.equal(resolveLiquidatorAttack({ event: { ...event(lane), groundZ: 100 }, player: hero(160, 0) }).reason, 'elevation');
});

test('role checks still reward the authored weapon jobs and never exceed 1.15', () => {
  for (const [weaponId, context, roleId] of [
    ['hash-rail', { distance: 720, targetKind: 'boss' }, 'rail-punish'],
    ['lightning-ledger', { chainTargets: 3, targetKind: 'add' }, 'ledger-add-clear'],
    ['bear-market-burner', { hazardOverlap: true, targetKind: 'boss' }, 'burner-zone-control'],
    ['forked-standard', { distance: 84, targetKind: 'boss' }, 'standard-close-punish'],
  ]) assert.deepEqual(getLiquidatorRoleCheck({ weaponId, ...context }), { roleId, multiplier: 1.15, applied: true });
  assert.deepEqual(getLiquidatorRoleCheck({ weaponId: 'coin-blaster' }), { roleId: null, multiplier: 1, applied: false });
});

test('every tell renders visible primitives: filled danger, green safe circles, chart panels and margin seals', () => {
  const boss = newBoss();
  const player = hero(11_200, 2_450);
  for (const attackId of Object.keys(LIQUIDATOR_ATTACK_DEFINITIONS)) {
    for (const entry of liquidatorStrikes(attackId, { boss, player, phaseIndex: 2 })) {
      const graphics = new RecordingGraphics();
      const report = renderLiquidatorTelegraph({
        graphics,
        pending: { attackId, geometry: entry.shape, summon: entry.summon ?? null, groundZ: 0, resolveTick: 100, tellStartTick: 0 },
        groundZ: 0, cameraZoom: 1, worldToScreen: project, tick: 50, phaseIndex: 2,
      });
      assert.ok(report.primitiveCount > 0, `${attackId} renders nothing`);
      assert.ok(graphics.calls.some(([operation]) => operation === 'stroke'), `${attackId} has no edge`);
    }
  }
});

test('runtime routes boss starts, strikes and damage through the kit and canonical combat', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /createLiquidatorBoss/);
  assert.match(source, /stepLiquidatorBoss\(\{/);
  assert.match(source, /resolveLiquidatorAttack\(\{[\s\S]*?blockers:\s*WORLD_BLOCKERS/);
  assert.match(source, /applyLiquidatorDamage\(\{[\s\S]*?roleMultiplier/);
  assert.match(source, /getLiquidatorRoleCheck/);
  assert.match(source, /roleChecksByHitId/);
  // Boss hits reach his authority unscaled (he applies and caps role x window
  // himself); only an add takes the Arc Rifle's chain bonus in the intent.
  assert.match(source, /return targetKind === 'boss' \? hit : \{ \.\.\.hit, damage: hit\.damage \* roleCheck\.multiplier \};/);
  assert.doesNotMatch(source, /punishMultiplier/);
  assert.doesNotMatch(source, /72_000/, 'the 72,000-tick timer is gone');
  assert.ok(source.indexOf('lastCombatResolution = resolveCombatHits') < source.indexOf('bossDamage = applyLiquidatorDamage('));
  assert.ok(source.indexOf('stepMissionObjectives(missionState') < source.indexOf('stepBossSlots(bossSlots'), 'the mission step records the logbook before a boss starts');
  assert.ok(source.indexOf('stepBossSlots(bossSlots') < source.indexOf('lastBossStep = liquidatorBoss'));
  assert.match(source, /eventType:\s*'boss-defeated'/);
  assert.doesNotMatch(source, /combatAudio\.play\('boss-phase'/, 'tells and phase changes are silent');
  assert.match(runtimeTelemetrySource, /dataset\.bossSafeSector/);
  assert.match(runtimeTelemetrySource, /dataset\.bossPunishWindow/);
});
