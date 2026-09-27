// The reworked Liquidator (design package 4.3, slice S1.5). He is dormant until
// the player starts him: the Closing Bell (a 150-tick intro, untargetable and
// silent) or the secret Dark Pool (no intro; Insider Trading, x1.25 damage
// taken for 300 ticks). There is no timer. Phases change at HP thresholds
// (66% and 33%): crossing one clamps the overshoot, clears his pending tells
// and starts a 90-tick invulnerable Trading Halt. He walks between podium
// marks, dashes in phase 2, steers at the hero in phase 3, and after 5,400
// engaged ticks a stall guard loops the final set.
//
// Every choice is fnv(runSeed, 'liquidator', phase, ordinal) (seededUnit);
// there is no RNG stream and no hostile projectile. Every tell locks a shape
// from the boss geometry kit, resolved against the hero's disk (radius 24),
// and is issued only when walking out of it fits the tell (package 4.1). He
// moves with swept collision against his own floor's bounds and locks, never
// the map navgrid.
//
// Pure simulation: integer ticks, no clock, no DOM. Loaded lazily (main.mjs
// loadLazyRuntimeModules) before any session starts.
import { finite, freezeDeep } from './value-guards.mjs';
import { traceHeightAwareLineOfSight } from './elevation.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from './collision.mjs';
import { seededUnit } from './deterministic-hash.mjs';
import {
  BOSS_PLAYER_RADIUS,
  bossShapeClearDistance,
  bossShapeHits,
  bossWalkBudgetTicks,
  createBossShape,
} from './boss-geometry.mjs';
import { BOSS_LEASH_MARGIN, bossArenaInterior } from './boss-arenas.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES } from '../../../sdk/hmh-run-contract-v7.mjs';

const CONTRACT = HMH_V7_BOSSES.liquidator;
export const LIQUIDATOR_BOSS_ID = 'liquidator';
export const LIQUIDATOR_TARGET_ID = 'boss-liquidator';
export const LIQUIDATOR_TARGET_SECONDS = CONTRACT.targetSeconds;
export const LIQUIDATOR_BELL_INTRO_TICKS = 150;
export const LIQUIDATOR_DARK_POOL_FIRST_ACTION_TICKS = 60;
export const LIQUIDATOR_PHASE_HALT_TICKS = HMH_V7_BOSS_RULES.BOSS_PHASE_HALT_TICKS;
export const LIQUIDATOR_STALL_TICKS = 5_400;
export const LIQUIDATOR_ENDLESS_CYCLE_TICKS = 1_440;
export const LIQUIDATOR_ROLE_CHECK_MULTIPLIER = 1.15;
// Kneel, Insider Trading and a dash stagger each take x1.25 damage; the
// combined role x window multiplier is capped here, inside the boss (4.3).
export const LIQUIDATOR_VULNERABLE_MULTIPLIER = 1.25;
export const LIQUIDATOR_MAX_DAMAGE_MULTIPLIER = 1.25;
export const LIQUIDATOR_INSIDER_TRADING_TICKS = 300;
export const LIQUIDATOR_KNEEL_TICKS = 120;
export const LIQUIDATOR_STAGGER_TICKS = 60;
export const LIQUIDATOR_MAX_ADDS_ALIVE = 4;
export const LIQUIDATOR_MAX_TELEGRAPH_GROUPS = 4;
export const MAX_BOSS_EVENTS_PER_TICK = 8;
export const LIQUIDATOR_WALK_MAX_TICKS = 180;
// The 150-second target fight, and the boss the benchmarks fight in it
// (liquidator-build-matrix, liquidator-upgrade-benchmark,
// critical-liquidator-benchmark, the director-boss soak): a Dark Pool start
// at the HP the Level 21 reference DPS gives (hmhV7BossHp with
// referenceDps(21) = 30.9, the level a typical run reaches by 10:00).
export const LIQUIDATOR_TARGET_FIGHT_TICKS = LIQUIDATOR_TARGET_SECONDS * 60;
export const LIQUIDATOR_BENCHMARK_MAX_HEALTH = 4_635;
export const LIQUIDATOR_STEER_STOP_DISTANCE = 200;

export const LIQUIDATOR_READABILITY_BUDGET = freezeDeep({
  animationLayers: 4,
  simultaneousTelegraphs: LIQUIDATOR_MAX_TELEGRAPH_GROUPS,
  activeEffects: 24,
  audioVoices: 6,
  activeAdds: LIQUIDATOR_MAX_ADDS_ALIVE,
});

// Collision r56, hurt r48, z 4-96. Armour and knockback resistance live in
// boss state (they were literals in main.mjs). He pushes the hero out to 84
// between centres, at most 4 units a tick.
export const LIQUIDATOR_BODY = freezeDeep({
  radius: 56, hurtRadius: 48, minZ: 4, maxZ: 96, armor: 1, knockbackResistance: 0.92,
  playerSeparationRadius: 84, maxPressureStep: 4, pinEscapeClearance: 48,
  walkUnitsPerTick: 1.5, steerUnitsPerTick: 2, dashUnitsPerTick: 14,
});

// Phases by HP (package 4.3): 100-66 Market Open, 66-33 Margin Call, 33-0
// Total Liquidation. The accents are the phase dressing colours.
export const LIQUIDATOR_PHASES = freezeDeep([
  { id: 'market-open', index: 0, accent: 0xff496c },
  { id: 'margin-call', index: 1, accent: 0xffc857 },
  { id: 'total-liquidation', index: 2, accent: 0xe26dff },
]);
export const LIQUIDATOR_PHASE_THRESHOLDS = CONTRACT.phaseThresholds;

const defineAttack = (definition) => freezeDeep(definition);
export const LIQUIDATOR_ATTACK_DEFINITIONS = freezeDeep({
  'crash-lane': defineAttack({ id: 'crash-lane', tier: 'primitive', tellTicks: 45, recoveryTicks: 60, damage: 14, knockback: 20, width: 54, spreadRadians: (12 * Math.PI) / 180, cooldownTicks: 150 }),
  'gavel-stamp': defineAttack({ id: 'gavel-stamp', tier: 'primitive', tellTicks: 60, recoveryTicks: 60, damage: 18, knockback: 20, radius: 112, stepTicks: 20, cooldownTicks: 240 }),
  'debt-collection': defineAttack({ id: 'debt-collection', tier: 'primitive', tellTicks: 44, recoveryTicks: 45, damage: 12, knockback: 48, radius: 104, maxDistance: 200, cooldownTicks: 180 }),
  'margin-call-dash': defineAttack({ id: 'margin-call-dash', tier: 'primitive', tellTicks: 36, recoveryTicks: 60, damage: 16, knockback: 28, width: 76, maxDistance: 600, minPhase: 1, cooldownTicks: 360 }),
  'candle-chart': defineAttack({ id: 'candle-chart', tier: 'signature', tellTicks: 96, columnIntervalTicks: 18, recoveryTicks: 60, damage: 16, knockback: 20, cooldownTicks: 720 }),
  'enforcement-order': defineAttack({ id: 'enforcement-order', tier: 'primitive', tellTicks: 45, recoveryTicks: 60, damage: 0, knockback: 0, minPhase: 1, cooldownTicks: 1_200 }),
  'circuit-breaker': defineAttack({ id: 'circuit-breaker', tier: 'super', tellTicks: 130, recoveryTicks: 120, damage: 24, knockback: 36, radius: 76, offset: 150, repeatTicks: 1_500 }),
  'total-liquidation-super': defineAttack({ id: 'total-liquidation-super', tier: 'super', tellTicks: 150, recoveryTicks: 0, damage: 30, knockback: 36, radius: 68, repeatTicks: 1_200 }),
});
const PHASE_OPENERS = freezeDeep([null, 'circuit-breaker', 'total-liquidation-super']);
// Total Liquidation's three safe circles, anchored to the floor centre.
const TOTAL_LIQUIDATION_ZONES = freezeDeep([{ x: -170, y: -80 }, { x: 170, y: -80 }, { x: 0, y: 170 }]);
const ENFORCEMENT_TROOPS = freezeDeep([[], ['liquidator-agent', 'liquidator-agent'], ['liquidator-agent', 'gas-bomber']]);
// The stall guard's loop: the 1.8.1 endless 1,440-tick cycle, with its
// retired Short Squeeze replaced by the Candle Chart and its summon by the
// Enforcement Order.
export const LIQUIDATOR_ENDLESS_CYCLE = freezeDeep([
  { offset: 60, attackId: 'crash-lane' },
  { offset: 300, attackId: 'candle-chart' },
  { offset: 540, attackId: 'margin-call-dash' },
  { offset: 780, attackId: 'gavel-stamp' },
  { offset: 1_020, attackId: 'enforcement-order' },
  { offset: 1_200, attackId: 'total-liquidation-super' },
]);

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

// An open floor centred on a point, for benchmarks and tests that fight him
// away from the map. Same size as the Margin Floor fallback.
export function liquidatorOpenArena(centre = { x: 0, y: 0 }) {
  const x = finite(centre.x, 'centre.x');
  const y = finite(centre.y, 'centre.y');
  return freezeDeep({
    id: 'open-floor',
    trigger: 'bell',
    bounds: { minX: x - 525, minY: y - 230, maxX: x + 525, maxY: y + 230 },
    centre: { x, y },
    spawn: { x, y },
    podiums: [
      { id: 'podium-1', x: x - 300, y: y - 110 },
      { id: 'podium-2', x: x + 300, y: y - 110 },
      { id: 'podium-3', x: x - 300, y: y + 110 },
      { id: 'podium-4', x: x + 300, y: y + 110 },
    ],
    chart: { columns: 5, rows: 3, axis: 'x' },
    edgeSites: [{ x: x - 440, y: y - 160 }, { x: x + 440, y: y - 160 }, { x: x - 440, y: y + 160 }, { x: x + 440, y: y + 160 }],
    walls: [],
  });
}

export function liquidatorThresholdHealth(maxHealth) {
  return LIQUIDATOR_PHASE_THRESHOLDS.map((ratio) => Math.round(maxHealth * ratio));
}

export function createLiquidatorBoss({
  id = LIQUIDATOR_TARGET_ID,
  x,
  y,
  groundZ = 0,
  startTick = 0,
  maxHealth,
  entry = 'bell',
  arena = null,
  seed = 0,
  // Add waves his slot has already issued this run: his Enforcement Orders
  // number on from here (boss-slots.mjs addWaves).
  wave = 0,
} = {}) {
  if (typeof id !== 'string' || id.trim().length === 0) throw new TypeError('boss id is required');
  if (!Number.isInteger(maxHealth) || maxHealth <= 0) throw new TypeError('maxHealth must be a positive integer (package 4.1 HP formula)');
  if (!['bell', 'dark-pool'].includes(entry)) throw new TypeError('entry must be bell or dark-pool');
  nonNegativeInteger(startTick, 'startTick');
  nonNegativeInteger(wave, 'wave');
  const floor = arena ?? liquidatorOpenArena({ x: finite(x, 'boss.x'), y: finite(y, 'boss.y') });
  const introTicks = entry === 'bell' ? LIQUIDATOR_BELL_INTRO_TICKS : 0;
  return {
    id,
    bossId: LIQUIDATOR_BOSS_ID,
    kind: 'boss',
    radius: LIQUIDATOR_BODY.radius,
    hurtRadius: LIQUIDATOR_BODY.hurtRadius,
    minZ: LIQUIDATOR_BODY.minZ,
    maxZ: LIQUIDATOR_BODY.maxZ,
    armor: LIQUIDATOR_BODY.armor,
    knockbackResistance: LIQUIDATOR_BODY.knockbackResistance,
    body: freezeDeep({
      radius: LIQUIDATOR_BODY.radius,
      playerSeparationRadius: LIQUIDATOR_BODY.playerSeparationRadius,
      maxPressureStep: LIQUIDATOR_BODY.maxPressureStep,
      pinEscapeClearance: LIQUIDATOR_BODY.pinEscapeClearance,
    }),
    x: finite(x ?? floor.spawn.x, 'boss.x'),
    y: finite(y ?? floor.spawn.y, 'boss.y'),
    groundZ: finite(groundZ, 'boss.groundZ'),
    facing: { x: 0, y: 1 },
    seed: Number(seed) >>> 0,
    entry,
    arena: floor,
    // The swept-collision bounds of his floor (collision.mjs names every
    // boundary it clamps to).
    motionBounds: Object.freeze({ ...floor.bounds, visibleBoundaryId: `boss-floor-${floor.id}` }),
    startTick,
    introTicks,
    elapsedTick: 0,
    engaged: false,
    maxHealth,
    health: maxHealth,
    thresholds: liquidatorThresholdHealth(maxHealth),
    phaseIndex: 0,
    phaseId: LIQUIDATOR_PHASES[0].id,
    haltFrom: -1,
    haltUntil: -1,
    opener: null,
    superNextTick: Infinity,
    insiderUntil: entry === 'dark-pool' ? startTick + LIQUIDATOR_INSIDER_TRADING_TICKS - 1 : -1,
    kneelUntil: -1,
    staggerUntil: -1,
    active: true,
    defeated: false,
    defeatEventEmitted: false,
    defeatedTick: -1,
    pendingAttacks: [],
    pendingEvents: [],
    droppedEvents: 0,
    ordinal: 0,
    attacksSinceWalk: 0,
    lastAttackId: null,
    cooldownUntil: {},
    circuitCount: 0,
    wave,
    nextActionTick: startTick + introTicks + (entry === 'dark-pool' ? LIQUIDATOR_DARK_POOL_FIRST_ACTION_TICKS : 30),
    motion: null,
    lastResolved: null,
  };
}

export function createLiquidatorBenchmarkBoss({ id, startTick = 0, seed = 1337 } = {}) {
  return createLiquidatorBoss({ id, x: 0, y: 0, startTick, maxHealth: LIQUIDATOR_BENCHMARK_MAX_HEALTH, entry: 'dark-pool', seed });
}

// The intro makes him untargetable (package 4.1); a halt leaves him a target
// that takes no damage.
export function isLiquidatorTargetable(boss, tick) {
  return Boolean(boss?.active) && boss.health > 0 && Number.isInteger(tick) && tick >= boss.startTick + boss.introTicks;
}

export function getLiquidatorVulnerability(boss, tick) {
  if (!boss?.active) return freezeDeep({ active: false, multiplier: 1, windowId: null });
  const windowId = tick <= boss.kneelUntil ? 'kneel'
    : tick <= boss.staggerUntil ? 'stagger'
      : tick <= boss.insiderUntil ? 'insider-trading' : null;
  return freezeDeep({ active: windowId !== null, multiplier: windowId ? LIQUIDATOR_VULNERABLE_MULTIPLIER : 1, windowId });
}

function pushBounded(boss, events, event) {
  if (events.length >= MAX_BOSS_EVENTS_PER_TICK) {
    boss.droppedEvents += 1;
    return;
  }
  events.push(freezeDeep(event));
}

function unit(x, y, fallback = { x: 0, y: 1 }) {
  const length = Math.hypot(x, y);
  return length > 1e-9 ? { x: x / length, y: y / length } : fallback;
}

function rotate(direction, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: direction.x * c - direction.y * s, y: direction.x * s + direction.y * c };
}

// Distance from p along direction d to the edge of bounds.
function rayExit(p, d, bounds) {
  let best = Infinity;
  if (d.x > 1e-9) best = Math.min(best, (bounds.maxX - p.x) / d.x);
  if (d.x < -1e-9) best = Math.min(best, (bounds.minX - p.x) / d.x);
  if (d.y > 1e-9) best = Math.min(best, (bounds.maxY - p.y) / d.y);
  if (d.y < -1e-9) best = Math.min(best, (bounds.minY - p.y) / d.y);
  return Math.max(0, Number.isFinite(best) ? best : 0);
}

const clampInto = (p, box) => ({ x: Math.max(box.minX, Math.min(box.maxX, p.x)), y: Math.max(box.minY, Math.min(box.maxY, p.y)) });

// The Candle Chart's panels: the floor split into columns along the chart
// axis and three rows across it. Each column keeps one green row, chosen by
// fnv(runSeed, 'liq-chart', ordinal, column) and moving by at most one row
// between neighbouring columns.
export function liquidatorChartLayout(arena, seed, ordinal) {
  const { columns, rows, axis } = arena.chart;
  const b = arena.bounds;
  const along = axis === 'x' ? [b.minX, b.maxX] : [b.minY, b.maxY];
  const across = axis === 'x' ? [b.minY, b.maxY] : [b.minX, b.maxX];
  const columnSize = (along[1] - along[0]) / columns;
  const rowSize = (across[1] - across[0]) / rows;
  const safeRows = [];
  for (let column = 0; column < columns; column += 1) {
    let row = Math.floor(seededUnit(seed, `liq-chart:${ordinal}:${column}`) * rows);
    if (column > 0 && Math.abs(row - safeRows[column - 1]) > 1) row = safeRows[column - 1] + Math.sign(row - safeRows[column - 1]);
    safeRows.push(row);
  }
  const cell = (column, row) => {
    const a0 = along[0] + column * columnSize;
    const c0 = across[0] + row * rowSize;
    return axis === 'x'
      ? { minX: a0, maxX: a0 + columnSize, minY: c0, maxY: c0 + rowSize }
      : { minX: c0, maxX: c0 + rowSize, minY: a0, maxY: a0 + columnSize };
  };
  return freezeDeep({ columns, rows, axis, columnSize, rowSize, safeRows, cell });
}

// The strikes one tell locks, as offsets from the tell start. Exported so the
// walk-budget tests measure exactly what the simulation resolves.
export function liquidatorStrikes(attackId, { boss, player, arena = boss.arena, tick = 0, phaseIndex = boss.phaseIndex, ordinal = boss.ordinal, circuitCount = boss.circuitCount, wave = boss.wave } = {}) {
  const definition = LIQUIDATOR_ATTACK_DEFINITIONS[attackId];
  if (!definition) throw new TypeError(`unknown Liquidator attack ${String(attackId)}`);
  const origin = { x: boss.x, y: boss.y };
  const toPlayer = unit(player.x - boss.x, player.y - boss.y, boss.facing ?? { x: 0, y: 1 });
  const strike = (shape, offset, extra = {}) => ({ attackId, offset, shape: createBossShape(shape), damage: definition.damage, knockback: definition.knockback, ...extra });
  const interior = bossArenaInterior(arena);
  switch (attackId) {
    case 'crash-lane': {
      const lane = (side) => {
        const direction = rotate(toPlayer, side * definition.spreadRadians);
        const length = rayExit(origin, direction, arena.bounds);
        return { type: 'lane', origin, target: { x: origin.x + direction.x * length, y: origin.y + direction.y * length }, width: definition.width };
      };
      const vee = { type: 'union', shapes: [lane(-1), lane(1)] };
      if (phaseIndex === 0) return [strike(lane(0), definition.tellTicks)];
      if (phaseIndex === 1) return [strike(vee, definition.tellTicks)];
      // Total Liquidation fires 3: the centre lane, then the V 20 ticks later.
      // Three lanes at once would leave a band 220 wide at mid range that no
      // walk clears in 45 ticks (package 4.1 walk budget).
      return [strike(lane(0), definition.tellTicks), strike(vee, definition.tellTicks + 20)];
    }
    case 'gavel-stamp': {
      if (phaseIndex < 2) return [strike({ type: 'circle', center: clampInto(player, interior), radius: definition.radius }, definition.tellTicks)];
      // Phase 3: three seals along the hero's movement line, 20 ticks apart.
      const vx = (player.vx ?? 0) / 60;
      const vy = (player.vy ?? 0) / 60;
      return [0, 1, 2].map((k) => strike({
        type: 'circle',
        center: clampInto({ x: player.x + vx * definition.stepTicks * k, y: player.y + vy * definition.stepTicks * k }, interior),
        radius: definition.radius,
      }, definition.tellTicks + definition.stepTicks * k));
    }
    case 'debt-collection':
      return [strike({ type: 'circle', center: origin, radius: definition.radius }, definition.tellTicks)];
    case 'margin-call-dash': {
      const length = Math.min(definition.maxDistance, rayExit(origin, toPlayer, arena.bounds));
      return [strike({ type: 'charge-lane', origin, target: { x: origin.x + toPlayer.x * length, y: origin.y + toPlayer.y * length }, width: definition.width }, definition.tellTicks, {
        dash: { direction: toPlayer, distance: length },
      })];
    }
    case 'candle-chart': {
      const layout = liquidatorChartLayout(arena, boss.seed, ordinal);
      const bossColumn = Math.max(0, Math.min(layout.columns - 1, Math.floor(((arena.chart.axis === 'x' ? boss.x - arena.bounds.minX : boss.y - arena.bounds.minY)) / layout.columnSize)));
      const ascending = bossColumn <= (layout.columns - 1) / 2;
      const out = Array.from({ length: layout.columns }, (_, index) => (ascending ? index : layout.columns - 1 - index));
      // Phase 3 sweeps out and back.
      const order = phaseIndex >= 2 ? [...out, ...out.slice(0, -1).reverse()] : out;
      return order.map((column, index) => strike({
        type: 'panels',
        cells: Array.from({ length: layout.rows }, (_, row) => row).filter((row) => row !== layout.safeRows[column]).map((row) => layout.cell(column, row)),
      }, definition.tellTicks + definition.columnIntervalTicks * index, {
        chart: { column, safeRow: layout.safeRows[column], safeCell: layout.cell(column, layout.safeRows[column]) },
      }));
    }
    case 'enforcement-order': {
      const troops = ENFORCEMENT_TROOPS[Math.max(1, Math.min(2, phaseIndex))];
      const sites = arena.edgeSites
        .map((site, index) => ({ ...site, index, distance: Math.hypot(site.x - player.x, site.y - player.y) }))
        .sort((left, right) => right.distance - left.distance || left.index - right.index)
        .slice(0, troops.length);
      const nextWave = wave + 1;
      return [{
        attackId,
        offset: definition.tellTicks,
        shape: null,
        damage: 0,
        knockback: 0,
        summon: {
          wave: nextWave,
          adds: troops.map((archetypeId, k) => ({ id: `boss:${LIQUIDATOR_BOSS_ID}:w${nextWave}:${k}`, archetypeId, x: sites[k].x, y: sites[k].y })),
        },
      }];
    }
    case 'circuit-breaker': {
      const northSouth = circuitCount % 2 === 1;
      const c = arena.centre;
      const zones = northSouth
        ? [{ x: c.x, y: c.y - definition.offset }, { x: c.x, y: c.y + definition.offset }]
        : [{ x: c.x - definition.offset, y: c.y }, { x: c.x + definition.offset, y: c.y }];
      return [strike({ type: 'safe-zones', zones, radius: definition.radius }, definition.tellTicks, { sectorId: northSouth ? 'north-south' : 'east-west' })];
    }
    case 'total-liquidation-super': {
      const c = arena.centre;
      return [strike({ type: 'safe-zones', zones: TOTAL_LIQUIDATION_ZONES.map((offset) => ({ x: c.x + offset.x, y: c.y + offset.y })), radius: definition.radius }, definition.tellTicks, { sectorId: 'total-liquidation' })];
    }
    default:
      throw new TypeError(`unknown Liquidator attack ${attackId}`);
  }
}

// Package 4.1: walking out of every strike must fit its tell, from where the
// hero stands at the tell start, inside the floor.
export function liquidatorStrikesAreFair(strikes, player, arena) {
  const interior = bossArenaInterior(arena);
  const from = clampInto(player, interior);
  for (const entry of strikes) {
    if (!entry.shape || entry.damage <= 0) continue;
    const maxDistance = Math.max(0, (entry.offset - 12) * 4);
    const clear = bossShapeClearDistance(entry.shape, from, { interior, maxDistance, step: 4, angles: 96 });
    if (!Number.isFinite(clear) || bossWalkBudgetTicks(clear) > entry.offset) return false;
  }
  return true;
}

function candidateAttacks(boss, distance, addsAlive) {
  const phase = boss.phaseIndex;
  let list;
  if (distance < LIQUIDATOR_ATTACK_DEFINITIONS['debt-collection'].maxDistance) list = ['debt-collection', ...(phase >= 2 ? ['gavel-stamp'] : [])];
  else if (distance <= 520) list = ['crash-lane', 'gavel-stamp', 'candle-chart', ...(phase >= 1 ? ['margin-call-dash'] : [])];
  else list = phase >= 1 ? ['margin-call-dash', 'crash-lane'] : ['crash-lane'];
  const troops = ENFORCEMENT_TROOPS[Math.min(2, phase)].length;
  if (phase >= 1 && addsAlive + troops <= LIQUIDATOR_MAX_ADDS_ALIVE) list = ['enforcement-order', ...list];
  return list;
}

function liveGroups(boss) {
  return new Set(boss.pendingAttacks.map((pending) => pending.groupId)).size;
}

// Issues one tell: locks its strikes and records the choice. Returns false
// when the tell would not be fair or the group cap is full.
function issueTell(boss, attackId, { tick, player, events }) {
  if (liveGroups(boss) >= LIQUIDATOR_MAX_TELEGRAPH_GROUPS) return false;
  const strikes = liquidatorStrikes(attackId, { boss, player, tick });
  if (!liquidatorStrikesAreFair(strikes, player, boss.arena)) return false;
  const definition = LIQUIDATOR_ATTACK_DEFINITIONS[attackId];
  const groupId = `${boss.id}:${attackId}:${boss.ordinal}`;
  strikes.forEach((entry, index) => {
    boss.pendingAttacks.push({
      attackId,
      groupId,
      telegraphId: strikes.length === 1 ? groupId : `${groupId}:${index}`,
      strikeIndex: index,
      strikeCount: strikes.length,
      tellStartTick: tick,
      resolveTick: tick + entry.offset,
      origin: freezeDeep({ x: boss.x, y: boss.y }),
      target: freezeDeep({ x: player.x, y: player.y }),
      geometry: entry.shape,
      sectorId: entry.sectorId ?? null,
      chart: entry.chart ?? null,
      summon: entry.summon ?? null,
      dash: entry.dash ?? null,
      groundZ: boss.groundZ,
      damage: entry.damage,
      knockback: entry.knockback,
    });
  });
  boss.pendingAttacks.sort((a, b) => a.resolveTick - b.resolveTick || (a.telegraphId < b.telegraphId ? -1 : a.telegraphId > b.telegraphId ? 1 : 0));
  if (attackId === 'circuit-breaker') boss.circuitCount += 1;
  if (attackId === 'enforcement-order') boss.wave += 1;
  if (definition.tier === 'super') boss.superNextTick = tick + definition.repeatTicks;
  boss.cooldownUntil[attackId] = tick + (definition.cooldownTicks ?? 0);
  boss.lastAttackId = attackId;
  boss.ordinal += 1;
  boss.attacksSinceWalk += 1;
  boss.motion = null;
  // The next action waits for the last strike and its recovery.
  const lastOffset = Math.max(...strikes.map((entry) => entry.offset));
  boss.nextActionTick = tick + lastOffset + definition.recoveryTicks + 1;
  pushBounded(boss, events, { type: 'tell', attackId, groupId, telegraphId: groupId, tick, elapsedTick: tick - boss.startTick, tellTicks: definition.tellTicks, strikeCount: strikes.length, damage: definition.damage, tier: definition.tier });
  return true;
}

function chooseAttack(boss, { tick, player, addsAlive, events }) {
  const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
  if (boss.opener) {
    const opener = boss.opener;
    boss.opener = null;
    if (issueTell(boss, opener, { tick, player, events })) return true;
  }
  const superId = PHASE_OPENERS[boss.phaseIndex];
  if (superId && tick >= boss.superNextTick && issueTell(boss, superId, { tick, player, events })) return true;
  // Never the same attack twice in a row; cooled-down attacks first.
  const candidates = candidateAttacks(boss, distance, addsAlive).filter((attackId) => attackId !== boss.lastAttackId);
  const ready = candidates.filter((attackId) => tick >= (boss.cooldownUntil[attackId] ?? 0));
  const list = ready.length ? ready : candidates;
  const pick = list.length ? Math.floor(seededUnit(boss.seed, `liquidator:${boss.phaseId}:${boss.ordinal}`) * list.length) : 0;
  // The pick first, then the rest in table order, then the plain lane and seal.
  const order = [...list.slice(pick), ...list.slice(0, pick), 'crash-lane', 'gavel-stamp'].filter((attackId, index, all) => attackId !== boss.lastAttackId && all.indexOf(attackId) === index);
  for (const attackId of order) if (issueTell(boss, attackId, { tick, player, events })) return true;
  return false;
}

function stepMotion(boss, { tick, player, blockers }) {
  const motion = boss.motion;
  if (!motion) return;
  let delta;
  if (motion.kind === 'dash') {
    const step = Math.min(LIQUIDATOR_BODY.dashUnitsPerTick, motion.remaining);
    delta = { x: motion.direction.x * step, y: motion.direction.y * step };
    motion.remaining -= step;
  } else if (motion.kind === 'walk') {
    const dx = motion.target.x - boss.x;
    const dy = motion.target.y - boss.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 1 || tick >= motion.untilTick) {
      boss.motion = null;
      return;
    }
    const step = Math.min(LIQUIDATOR_BODY.walkUnitsPerTick, distance);
    delta = { x: (dx / distance) * step, y: (dy / distance) * step };
  } else {
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= LIQUIDATOR_STEER_STOP_DISTANCE) {
      boss.motion = null;
      return;
    }
    const step = Math.min(LIQUIDATOR_BODY.steerUnitsPerTick, distance - LIQUIDATOR_STEER_STOP_DISTANCE);
    delta = { x: (dx / distance) * step, y: (dy / distance) * step };
  }
  const sweep = resolveSweptCircleMotion({
    body: BOSS_COLLISION_BODY,
    start: { x: boss.x, y: boss.y, z: boss.groundZ },
    delta,
    blockers,
    bounds: boss.motionBounds,
  });
  const moved = Math.hypot(sweep.position.x - boss.x, sweep.position.y - boss.y);
  const requested = Math.hypot(delta.x, delta.y);
  boss.x = sweep.position.x;
  boss.y = sweep.position.y;
  if (requested > 1e-9) boss.facing = unit(delta.x, delta.y, boss.facing);
  if (motion.kind === 'dash') {
    // A dash into a wall or a lock staggers him for 60 ticks at x1.25.
    if (moved + 1e-6 < requested) {
      boss.motion = null;
      boss.staggerUntil = tick + LIQUIDATOR_STAGGER_TICKS;
      boss.nextActionTick = Math.max(boss.nextActionTick, tick + LIQUIDATOR_STAGGER_TICKS + 1);
    } else if (motion.remaining <= 1e-9) boss.motion = null;
  }
}

const BOSS_COLLISION_BODY = createCollisionBody({ id: LIQUIDATOR_TARGET_ID, kind: 'boss', radius: LIQUIDATOR_BODY.radius, minZ: LIQUIDATOR_BODY.minZ, maxZ: LIQUIDATOR_BODY.maxZ });

function farthestPodium(boss, player) {
  let best = null;
  for (const podium of boss.arena.podiums) {
    const distance = Math.hypot(podium.x - player.x, podium.y - player.y);
    if (!best || distance > best.distance + 1e-9 || (Math.abs(distance - best.distance) <= 1e-9 && podium.id < best.podium.id)) best = { podium, distance };
  }
  return best?.podium ?? null;
}

export function stepLiquidatorBoss({ boss, tick, player, blockers = [], addsAlive = 0 } = {}) {
  if (!boss || !Array.isArray(boss.pendingAttacks)) throw new TypeError('boss state is required');
  nonNegativeInteger(tick, 'tick');
  finite(player?.x, 'player.x');
  finite(player?.y, 'player.y');
  finite(player?.groundZ, 'player.groundZ');
  if (!Array.isArray(blockers)) throw new TypeError('blockers must be an array');
  if (tick < boss.startTick) throw new TypeError('tick cannot precede boss startTick');
  const events = [];
  const elapsedTick = tick - boss.startTick;
  boss.elapsedTick = elapsedTick;
  for (const event of boss.pendingEvents.splice(0)) pushBounded(boss, events, event);
  const report = (mode) => freezeDeep({ tick, elapsedTick, phaseId: boss.phaseId, mode, events, pendingCount: boss.pendingAttacks.length, droppedEvents: boss.droppedEvents });
  if (!boss.active) return report('defeated');
  if (tick < boss.startTick + boss.introTicks) return report('intro');
  if (!boss.engaged) {
    boss.engaged = true;
    pushBounded(boss, events, { type: 'engage', tick, elapsedTick, entry: boss.entry });
  }
  if (tick >= boss.haltFrom && tick <= boss.haltUntil) return report('halt');

  // Resolve every strike that is due (a skipped tick never strands one).
  const remaining = [];
  for (const pending of boss.pendingAttacks) {
    if (pending.resolveTick > tick) {
      remaining.push(pending);
      continue;
    }
    if (pending.summon) {
      pushBounded(boss, events, { type: 'add-wave', attackId: pending.attackId, telegraphId: pending.telegraphId, groupId: pending.groupId, tick, elapsedTick, wave: pending.summon.wave, adds: pending.summon.adds, groundZ: pending.groundZ, damage: 0 });
      continue;
    }
    pushBounded(boss, events, {
      type: 'attack', attackId: pending.attackId, telegraphId: pending.telegraphId, groupId: pending.groupId, tick, elapsedTick,
      origin: pending.origin, target: pending.target, geometry: pending.geometry, groundZ: pending.groundZ,
      damage: pending.damage, knockback: pending.knockback, leash: boss.arena.bounds,
    });
    boss.lastResolved = { attackId: pending.attackId, tick };
    if (pending.dash) boss.motion = { kind: 'dash', direction: pending.dash.direction, remaining: pending.dash.distance };
    if (pending.attackId === 'total-liquidation-super') {
      boss.kneelUntil = tick + LIQUIDATOR_KNEEL_TICKS;
      boss.nextActionTick = Math.max(boss.nextActionTick, tick + LIQUIDATOR_KNEEL_TICKS + 1);
      pushBounded(boss, events, { type: 'kneel', tick, elapsedTick, untilTick: boss.kneelUntil });
    }
  }
  boss.pendingAttacks = remaining;

  const kneeling = tick <= boss.kneelUntil;
  const staggered = tick <= boss.staggerUntil;
  const idle = boss.pendingAttacks.length === 0 && boss.motion?.kind !== 'dash' && !kneeling && !staggered;
  const stalled = elapsedTick >= LIQUIDATOR_STALL_TICKS;
  if (idle && stalled) {
    const loopTick = (elapsedTick - LIQUIDATOR_STALL_TICKS) % LIQUIDATOR_ENDLESS_CYCLE_TICKS;
    const entry = LIQUIDATOR_ENDLESS_CYCLE.find((candidate) => candidate.offset === loopTick);
    if (entry) issueTell(boss, entry.attackId, { tick, player, events });
  } else if (idle && tick >= boss.nextActionTick && boss.motion?.kind !== 'walk') {
    // A phase opener or a due super comes first. Otherwise, after every third
    // attack he walks to the podium farthest from the hero (Margin Call may
    // dash instead; Total Liquidation steers at the hero between tells).
    const superDue = boss.opener || (PHASE_OPENERS[boss.phaseIndex] && tick >= boss.superNextTick);
    const podium = !superDue && boss.attacksSinceWalk >= 3 && boss.phaseIndex < 2 ? farthestPodium(boss, player) : null;
    const dashInstead = podium && boss.phaseIndex === 1 && Math.hypot(player.x - boss.x, player.y - boss.y) > 520
      && tick >= (boss.cooldownUntil['margin-call-dash'] ?? 0);
    if (podium && !dashInstead) {
      boss.attacksSinceWalk = 0;
      boss.motion = { kind: 'walk', target: { x: podium.x, y: podium.y }, untilTick: tick + LIQUIDATOR_WALK_MAX_TICKS };
    } else if (dashInstead) {
      boss.attacksSinceWalk = 0;
      if (!issueTell(boss, 'margin-call-dash', { tick, player, events })) chooseAttack(boss, { tick, player, addsAlive, events });
    } else if (!chooseAttack(boss, { tick, player, addsAlive, events })) boss.nextActionTick = tick + 30;
  } else if (idle && boss.phaseIndex >= 2 && !boss.motion) {
    boss.motion = { kind: 'steer' };
  }
  if (!kneeling && !staggered && (boss.pendingAttacks.length === 0 || boss.motion?.kind === 'dash')) stepMotion(boss, { tick, player, blockers });
  else if (boss.motion?.kind !== 'dash') boss.motion = null;
  return report(kneeling ? 'kneel' : staggered ? 'stagger' : 'combat');
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-9) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

// Adds for a resolved Enforcement Order, capped so at most four adds (the
// ordinary enemies already inside his floor included) are alive at once.
export function createLiquidatorAddCandidates({ event, activeAddIds = [], alive = null } = {}) {
  if (event?.type !== 'add-wave' || event.attackId !== 'enforcement-order' || !Array.isArray(event.adds)) {
    throw new TypeError('resolved enforcement-order add-wave event is required');
  }
  if (!Array.isArray(activeAddIds) || activeAddIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new TypeError('active add IDs must be strings');
  }
  const aliveCount = alive ?? new Set(activeAddIds).size;
  if (!Number.isInteger(aliveCount) || aliveCount < 0) throw new TypeError('alive must be a non-negative integer');
  const slots = Math.max(0, LIQUIDATOR_MAX_ADDS_ALIVE - aliveCount);
  return freezeDeep(event.adds.slice(0, slots).map((add) => ({
    id: add.id,
    archetypeId: add.archetypeId,
    x: finite(add.x, 'add.x'),
    y: finite(add.y, 'add.y'),
    groundZ: finite(event.groundZ, 'groundZ'),
  })));
}

// Resolves one strike against the hero's disk. The leash (package 4.1) keeps
// every strike inside his floor; lanes stop at authored combat cover.
export function resolveLiquidatorAttack({ event, player, blockers = [], radius = BOSS_PLAYER_RADIUS } = {}) {
  if (!event?.geometry || event.type !== 'attack') throw new TypeError('resolved boss attack event is required');
  if (!Array.isArray(blockers)) throw new TypeError('blockers must be an array');
  const point = { x: finite(player?.x, 'player.x'), y: finite(player?.y, 'player.y') };
  const groundZ = finite(player?.groundZ, 'player.groundZ');
  if (event.damage <= 0) return freezeDeep({ hit: false, damage: 0, reason: 'non-damaging' });
  if (Math.abs(groundZ - event.groundZ) > 64) return freezeDeep({ hit: false, damage: 0, reason: 'elevation' });
  const leash = event.leash;
  if (leash && (point.x < leash.minX - BOSS_LEASH_MARGIN || point.x > leash.maxX + BOSS_LEASH_MARGIN
    || point.y < leash.minY - BOSS_LEASH_MARGIN || point.y > leash.maxY + BOSS_LEASH_MARGIN)) {
    return freezeDeep({ hit: false, damage: 0, reason: 'leash' });
  }
  const geometry = event.geometry;
  const lanes = geometry.type === 'lane' ? [geometry]
    : geometry.type === 'union' && geometry.shapes.every((shape) => shape.type === 'lane') ? geometry.shapes : null;
  if (lanes) {
    // Crash lanes keep their locked geometry, but tall authored combat cover
    // still protects a hero behind it, through the shared height-aware line of
    // sight (low props stay readable rather than full-height shields).
    const cover = blockers.filter((blocker) => blocker?.solid !== false && blocker?.combatCover === true);
    let blockedBy = null;
    for (const lane of lanes) {
      if (distanceToSegment(point, lane.origin, lane.target) > lane.width / 2 + radius) continue;
      const lineOfSight = traceHeightAwareLineOfSight({
        from: { x: lane.origin.x, y: lane.origin.y, z: event.groundZ + 24 },
        to: { x: point.x, y: point.y, z: groundZ + 24 },
        blockers: cover,
      });
      if (lineOfSight.clear) return freezeDeep({ hit: true, damage: event.damage, reason: null });
      blockedBy ??= lineOfSight.blockerId;
    }
    return freezeDeep(blockedBy ? { hit: false, damage: 0, reason: 'cover', blockerId: blockedBy } : { hit: false, damage: 0, reason: 'outside-hit-geometry' });
  }
  const hit = bossShapeHits(geometry, point, radius);
  return freezeDeep({ hit, damage: hit ? event.damage : 0, reason: hit ? null : 'outside-hit-geometry' });
}

export function getLiquidatorRoleCheck({
  weaponId,
  critical = false,
  distance = 0,
  chainTargets = 0,
  hazardOverlap = false,
  targetKind = 'boss',
} = {}) {
  if (typeof weaponId !== 'string' || weaponId.length === 0) throw new TypeError('weaponId is required');
  if (typeof critical !== 'boolean') throw new TypeError('critical must be boolean');
  finite(distance, 'distance');
  nonNegativeInteger(chainTargets, 'chainTargets');
  if (typeof hazardOverlap !== 'boolean') throw new TypeError('hazardOverlap must be boolean');
  if (!['boss', 'add'].includes(targetKind)) throw new TypeError('targetKind must be boss or add');
  let roleId = null;
  if (weaponId === 'hash-rail' && targetKind === 'boss' && distance >= 480) roleId = 'rail-punish';
  else if (weaponId === 'lightning-ledger' && targetKind === 'add' && chainTargets >= 2) roleId = 'ledger-add-clear';
  else if (weaponId === 'bear-market-burner' && targetKind === 'boss' && hazardOverlap) roleId = 'burner-zone-control';
  else if (weaponId === 'forked-standard' && targetKind === 'boss' && distance <= 120) roleId = 'standard-close-punish';
  return freezeDeep({
    roleId,
    multiplier: roleId ? LIQUIDATOR_ROLE_CHECK_MULTIPLIER : 1,
    applied: roleId !== null,
  });
}

// The only path that changes his health. The role multiplier (at most 1.15)
// and his vulnerability window (x1.25 while kneeling, staggered or under
// Insider Trading) combine up to LIQUIDATOR_MAX_DAMAGE_MULTIPLIER. The intro
// and every Trading Halt take no damage; a hit that reaches a threshold stops
// there and starts the halt on this tick (contract 5.3: no damage at t+1 ...
// t+90, and none after the crossing on t itself). Environmental damage never
// lands the killing blow.
export function applyLiquidatorDamage({ boss, amount, tick, roleMultiplier = 1, environmental = false } = {}) {
  if (!boss) throw new TypeError('boss state is required');
  finite(amount, 'damage amount');
  finite(roleMultiplier, 'damage multiplier');
  if (amount < 0) throw new TypeError('damage amount must be non-negative');
  if (roleMultiplier < 1 || roleMultiplier > LIQUIDATOR_ROLE_CHECK_MULTIPLIER) throw new TypeError('damage multiplier exceeds the role-check bound');
  nonNegativeInteger(tick, 'tick');
  const refused = (reason) => freezeDeep({ defeated: boss.defeated, damageApplied: 0, remainingHealth: boss.health, runEvent: null, reason, phaseCrossed: null });
  if (boss.defeated || !boss.active) return refused('inactive');
  if (tick < boss.startTick + boss.introTicks) return refused('intro');
  if (tick >= boss.haltFrom && tick <= boss.haltUntil) return refused('halt');
  const multiplier = Math.min(roleMultiplier * getLiquidatorVulnerability(boss, tick).multiplier, LIQUIDATOR_MAX_DAMAGE_MULTIPLIER);
  const scaled = Math.round(amount * multiplier * 1_000_000) / 1_000_000;
  const threshold = boss.thresholds[boss.phaseIndex];
  const floor = Math.max(threshold ?? 0, environmental ? 1 : 0);
  const applied = Math.max(0, Math.min(scaled, boss.health - floor));
  boss.health -= applied;
  let phaseCrossed = null;
  if (threshold !== undefined && boss.health <= threshold) {
    boss.phaseIndex += 1;
    boss.phaseId = LIQUIDATOR_PHASES[boss.phaseIndex].id;
    boss.haltFrom = tick;
    boss.haltUntil = tick + LIQUIDATOR_PHASE_HALT_TICKS;
    boss.pendingAttacks = [];
    boss.motion = null;
    boss.kneelUntil = -1;
    boss.staggerUntil = -1;
    boss.opener = PHASE_OPENERS[boss.phaseIndex];
    boss.superNextTick = Infinity;
    boss.nextActionTick = boss.haltUntil + 1;
    phaseCrossed = boss.phaseId;
    boss.pendingEvents.push({ type: 'halt', phaseId: boss.phaseId, tick, untilTick: boss.haltUntil, elapsedTick: tick - boss.startTick });
  }
  if (boss.health > 0) return freezeDeep({ defeated: false, damageApplied: applied, remainingHealth: boss.health, runEvent: null, reason: null, phaseCrossed });
  boss.active = false;
  boss.defeated = true;
  boss.defeatedTick = tick;
  // A fallen boss's tells stop at once (contract S17).
  boss.pendingAttacks = [];
  boss.motion = null;
  let runEvent = null;
  if (!boss.defeatEventEmitted) {
    boss.defeatEventEmitted = true;
    runEvent = freezeDeep({ type: 'game:run-event', name: 'boss-defeated', data: { bossId: boss.id, tick, elapsedTicks: tick - boss.startTick } });
  }
  return freezeDeep({ defeated: true, damageApplied: applied, remainingHealth: 0, runEvent, reason: null, phaseCrossed });
}

// A constant damage stream against a boss of maxHealth, halts included.
export function simulateLiquidatorDps({ damagePerTick, maxHealth = 12_000, entry = 'bell', durationTicks = 9_000 } = {}) {
  finite(damagePerTick, 'damagePerTick');
  if (damagePerTick < 0) throw new TypeError('damagePerTick must be non-negative');
  const boss = createLiquidatorBoss({ id: 'simulation-liquidator', x: 0, y: 0, startTick: 0, maxHealth, entry });
  for (let tick = 1; tick <= durationTicks; tick += 1) {
    const result = applyLiquidatorDamage({ boss, amount: damagePerTick, tick });
    if (result.defeated) return freezeDeep({ defeated: true, defeatTick: tick, remainingHealth: 0 });
  }
  return freezeDeep({ defeated: false, defeatTick: null, remainingHealth: boss.health });
}
