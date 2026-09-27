// The Rug Pull Baron (design package 4.4, slice S3.1). Built dark: the boss
// slots register him only when the bossesV2 flag is on (boss-slots.mjs), and
// the flag is never on in Ranked. He is dormant until the hero stands on his
// Welcome Mat for 30 ticks (ready at 2:00, the v7 readyTick), then climbs out
// of the carpet's trapdoor in a 120-tick intro (untargetable, silent and
// damage-proof). Phases change at 60% and 25% HP with the shared 90-tick halt,
// which clamps the overshoot and clears his tells:
//   1 The Pitch    Rug Yank every third action, Pump and Dump, Exit Scam as a
//                  close-range escape. He rolls up the west third after it.
//   2 The Pull     Yank every second action (or Double or Nothing), Exit Scam
//                  also repositions every fourth, Exit Liquidity adds (two
//                  bagholders a wave). He tears the carpet into three strips.
//   3 Hard Rug     The strips yank at once in alternating directions, like
//                  conveyor belts; the torn gaps are bare stone. Pump and Dump
//                  throws two sacks.
// After 4,800 engaged ticks a stall guard loops Hard Rug.
//
// The yank is a time-boxed drift field, never a hit: bodies on the carpet
// slide 200 units over 16 ticks (the package's worldHazardField drift, folded
// into the swept moves by main), and only a slam into a wall, a lock or a
// crate hurts (10, "rug burn"). Adds on the carpet when it is pulled are
// knocked down for 60 ticks (knockDownEnemy). Brass anchor-peg rings and the
// stone margin never slide.
//
// Every choice is seededUnit(runSeed, 'rug-pull-baron:<phase>:<ordinal>') or a
// named sub-key (the coin is 'baron-coin:<ordinal>'); there is no RNG stream
// and no hostile projectile. Every damaging tell locks a shape from the boss
// geometry kit, resolved against the hero's disk (radius 24), and is issued
// only when walking out of it fits the tell (package 4.1). He moves with swept
// collision against his floor's bounds and closed locks, never the navgrid.
//
// Pure simulation: integer ticks, no clock, no DOM. Loaded lazily with the
// boss modules (main.mjs loadLazyRuntimeModules).
import { finite, freezeDeep } from './value-guards.mjs';
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

const CONTRACT = HMH_V7_BOSSES['rug-pull-baron'];
export const BARON_BOSS_ID = 'rug-pull-baron';
export const BARON_TARGET_ID = 'boss-rug-pull-baron';
export const BARON_INTRO_TICKS = 120;
export const BARON_PHASE_HALT_TICKS = HMH_V7_BOSS_RULES.BOSS_PHASE_HALT_TICKS;
export const BARON_STALL_TICKS = 4_800;
export const BARON_STALL_CYCLE_TICKS = 240;
// Coin fumbles and Exit Scam landings leave him open at x1.15.
export const BARON_VULNERABLE_MULTIPLIER = 1.15;
export const BARON_MAX_DAMAGE_MULTIPLIER = 1.15;
export const BARON_FUMBLE_STAGGER_TICKS = 60;
export const BARON_ARRIVAL_STAGGER_TICKS = 45;
export const BARON_VANISH_TICKS = 60;
export const BARON_ARRIVAL_RING_TICKS = 45;
export const BARON_KNOCKDOWN_TICKS = 60;
export const BARON_MAX_ADDS_ALIVE = 4;
export const BARON_MAX_TELEGRAPH_GROUPS = 4;
export const MAX_BARON_EVENTS_PER_TICK = 8;
export const BARON_WALK_MAX_TICKS = 120;
// Exit Scam pre-empts whenever the hero comes within this.
export const BARON_ESCAPE_DISTANCE = 160;
// He keeps 300-500 from the hero (the middle of the band is his aim).
export const BARON_KEEP_DISTANCE = Object.freeze({ min: 300, max: 500, aim: 400 });
// The Welcome Mat: stand on it this long (stepping off cancels).
export const BARON_MAT_TICKS = 30;

// Collision r44, hurt r40, z 4-90, armour 1, speed 100 (units a second).
export const BARON_BODY = freezeDeep({
  radius: 44, hurtRadius: 40, minZ: 4, maxZ: 90, armor: 1, knockbackResistance: 0.9,
  playerSeparationRadius: 72, maxPressureStep: 4, pinEscapeClearance: 48,
  walkUnitsPerTick: 100 / 60,
});

export const BARON_PHASES = freezeDeep([
  { id: 'the-pitch', index: 0, accent: 0x8a2b2b },
  { id: 'the-pull', index: 1, accent: 0xc9a227 },
  { id: 'hard-rug', index: 2, accent: 0xe8d9b0 },
]);
export const BARON_PHASE_THRESHOLDS = CONTRACT.phaseThresholds;

// The yank: 200 units over 16 ticks, from the tick after it resolves.
export const BARON_YANK = freezeDeep({ distance: 200, ticks: 16, rugBurn: 10 });
export const BARON_ATTACK_DEFINITIONS = freezeDeep({
  'rug-yank': { id: 'rug-yank', tier: 'signature', tellTicks: 72, recoveryTicks: 60, damage: BARON_YANK.rugBurn, knockback: 0, cooldownTicks: 0 },
  // The sack's 40-tick arc lands at the end of the 54-tick tell (Pump); the
  // Dump's coins land 36 ticks later.
  'pump-and-dump': { id: 'pump-and-dump', tier: 'primitive', tellTicks: 54, recoveryTicks: 60, damage: 14, knockback: 20, radius: 100, dumpDelayTicks: 36, dumpDamage: 10, dumpRadius: 70, dumpOffset: 150, secondSackTicks: 30, cooldownTicks: 0 },
  // The flip's tell; its yank's 72-tick tell follows, and the reveal comes
  // 24 ticks into it. Red: a second, reversed yank 40 ticks after the first.
  'double-or-nothing': { id: 'double-or-nothing', tier: 'signature', tellTicks: 18, revealTicks: 24, secondYankTicks: 40, recoveryTicks: 60, damage: BARON_YANK.rugBurn, knockback: 0, minPhase: 1, cooldownTicks: 600 },
  'exit-scam': { id: 'exit-scam', tier: 'primitive', tellTicks: 42, recoveryTicks: 0, damage: 10, knockback: 24, radius: 90, cooldownTicks: 240 },
  'exit-liquidity': { id: 'exit-liquidity', tier: 'primitive', tellTicks: 45, recoveryTicks: 45, damage: 0, knockback: 0, minPhase: 1, cooldownTicks: 900 },
  // The slam the drift can cause; never a tell of its own.
  'rug-burn': { id: 'rug-burn', tier: 'primitive', tellTicks: 0, recoveryTicks: 0, damage: BARON_YANK.rugBurn, knockback: 0 },
});
const ADD_ARCHETYPE = 'bagholder-rusher';
const ADDS_PER_WAVE = 2;
const DIRECTIONS = freezeDeep([
  { id: 'east', x: 1, y: 0 }, { id: 'west', x: -1, y: 0 }, { id: 'south', x: 0, y: 1 }, { id: 'north', x: 0, y: -1 },
]);

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

export function baronThresholdHealth(maxHealth) {
  return BARON_PHASE_THRESHOLDS.map((ratio) => Math.round(maxHealth * ratio));
}

// An open floor for tests and benchmarks: the quarry pocket's shape, centred
// on a point.
export function baronOpenArena(centre = { x: 0, y: 0 }) {
  const x = finite(centre.x, 'centre.x');
  const y = finite(centre.y, 'centre.y');
  const carpet = { minX: x - 240, minY: y - 140, maxX: x + 240, maxY: y + 140 };
  return freezeDeep({
    id: 'open-quarry',
    trigger: 'welcome-mat',
    bounds: { minX: x - 320, minY: y - 230, maxX: x + 320, maxY: y + 230 },
    centre: { x, y },
    spawn: { x, y },
    carpet,
    stripGap: 30,
    pegs: [
      { id: 'peg-nw', x: carpet.minX, y: carpet.minY }, { id: 'peg-ne', x: carpet.maxX, y: carpet.minY },
      { id: 'peg-sw', x: carpet.minX, y: carpet.maxY }, { id: 'peg-se', x: carpet.maxX, y: carpet.maxY },
    ],
    pegRadius: 50,
    marks: [
      { id: 'mark-1', x: x - 210, y: y - 110 }, { id: 'mark-2', x, y: y - 110 }, { id: 'mark-3', x: x + 210, y: y - 110 },
      { id: 'mark-4', x: x + 210, y }, { id: 'mark-5', x: x + 210, y: y + 110 }, { id: 'mark-6', x, y: y + 110 },
      { id: 'mark-7', x: x - 210, y: y + 110 }, { id: 'mark-8', x: x - 210, y },
    ],
    scamMarks: [
      { id: 'scam-1', x: x - 190, y: y - 80 }, { id: 'scam-2', x: x + 190, y: y - 80 },
      { id: 'scam-3', x: x - 190, y: y + 80 }, { id: 'scam-4', x: x + 190, y: y + 80 },
    ],
    walls: [],
    props: [],
  });
}

// The carpet in each phase: whole; the west third rolled up; three strips.
export function baronCarpetRects(arena, phaseIndex) {
  const carpet = arena.carpet;
  if (phaseIndex <= 0) return freezeDeep([{ ...carpet }]);
  const rolled = { ...carpet, minX: carpet.minX + (carpet.maxX - carpet.minX) / 3 };
  if (phaseIndex === 1) return freezeDeep([rolled]);
  const gap = arena.stripGap;
  const height = (rolled.maxY - rolled.minY - 2 * gap) / 3;
  return freezeDeep([0, 1, 2].map((k) => ({
    minX: rolled.minX,
    maxX: rolled.maxX,
    minY: rolled.minY + k * (height + gap),
    maxY: rolled.minY + k * (height + gap) + height,
  })));
}

const insideRect = (p, r) => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
const inPegRing = (arena, p) => arena.pegs.some((peg) => Math.hypot(p.x - peg.x, p.y - peg.y) <= arena.pegRadius);

// True when a body at p is on the carpet as it stands in this phase and not
// held by a peg ring: what a yank would pull.
export function onBaronCarpet(arena, phaseIndex, p) {
  return !inPegRing(arena, p) && baronCarpetRects(arena, phaseIndex).some((r) => insideRect(p, r));
}

export function createRugPullBaronBoss({
  id = BARON_TARGET_ID,
  x,
  y,
  groundZ = 0,
  startTick = 0,
  maxHealth,
  entry = 'welcome-mat',
  arena = null,
  seed = 0,
  wave = 0,
} = {}) {
  if (typeof id !== 'string' || id.trim().length === 0) throw new TypeError('boss id is required');
  if (!Number.isInteger(maxHealth) || maxHealth <= 0) throw new TypeError('maxHealth must be a positive integer (package 4.1 HP formula)');
  if (entry !== 'welcome-mat') throw new TypeError('the Baron starts only from his Welcome Mat');
  nonNegativeInteger(startTick, 'startTick');
  nonNegativeInteger(wave, 'wave');
  const floor = arena ?? baronOpenArena({ x: finite(x, 'boss.x'), y: finite(y, 'boss.y') });
  return {
    id,
    bossId: BARON_BOSS_ID,
    kind: 'boss',
    radius: BARON_BODY.radius,
    hurtRadius: BARON_BODY.hurtRadius,
    minZ: BARON_BODY.minZ,
    maxZ: BARON_BODY.maxZ,
    armor: BARON_BODY.armor,
    knockbackResistance: BARON_BODY.knockbackResistance,
    body: freezeDeep({
      radius: BARON_BODY.radius,
      playerSeparationRadius: BARON_BODY.playerSeparationRadius,
      maxPressureStep: BARON_BODY.maxPressureStep,
      pinEscapeClearance: BARON_BODY.pinEscapeClearance,
    }),
    x: finite(x ?? floor.spawn.x, 'boss.x'),
    y: finite(y ?? floor.spawn.y, 'boss.y'),
    groundZ: finite(groundZ, 'boss.groundZ'),
    facing: { x: 0, y: 1 },
    seed: Number(seed) >>> 0,
    entry,
    arena: floor,
    motionBounds: Object.freeze({ ...floor.bounds, visibleBoundaryId: `boss-floor-${floor.id}` }),
    startTick,
    introTicks: BARON_INTRO_TICKS,
    elapsedTick: 0,
    engaged: false,
    maxHealth,
    health: maxHealth,
    thresholds: baronThresholdHealth(maxHealth),
    phaseIndex: 0,
    phaseId: BARON_PHASES[0].id,
    haltFrom: -1,
    haltUntil: -1,
    staggerUntil: -1,
    staggerWindow: null,
    // Exit Scam: gone from vanish.fromTick, back at vanish.target on untilTick.
    vanish: null,
    vanished: false,
    // Double or Nothing: the flip waiting for its reveal.
    coin: null,
    // Active drift fields (resolved yanks), oldest first.
    drifts: [],
    hardRugYanks: 0,
    active: true,
    defeated: false,
    defeatEventEmitted: false,
    defeatedTick: -1,
    pendingAttacks: [],
    pendingEvents: [],
    droppedEvents: 0,
    ordinal: 0,
    actionCount: 0,
    walked: false,
    lastAttackId: null,
    cooldownUntil: {},
    wave,
    nextActionTick: startTick + BARON_INTRO_TICKS + 30,
    motion: null,
    lastResolved: null,
  };
}

export function isRugPullBaronTargetable(boss, tick) {
  return Boolean(boss?.active) && boss.health > 0 && Number.isInteger(tick) && tick >= boss.startTick + boss.introTicks && !boss.vanished;
}

export function getRugPullBaronVulnerability(boss, tick) {
  if (!boss?.active || !(tick <= boss.staggerUntil)) return freezeDeep({ active: false, multiplier: 1, windowId: null });
  return freezeDeep({ active: true, multiplier: BARON_VULNERABLE_MULTIPLIER, windowId: boss.staggerWindow ?? 'stagger' });
}

function pushBounded(boss, events, event) {
  if (events.length >= MAX_BARON_EVENTS_PER_TICK) {
    boss.droppedEvents += 1;
    return;
  }
  events.push(freezeDeep(event));
}

const clampInto = (p, box) => ({ x: Math.max(box.minX, Math.min(box.maxX, p.x)), y: Math.max(box.minY, Math.min(box.maxY, p.y)) });

// Distance from p along a unit axis direction to the first thing a slide
// would slam into: a crate (inflated by the hero's disk) or the floor's edge.
function slamDistance(arena, p, direction) {
  const interior = bossArenaInterior(arena);
  let best = direction.x > 0 ? interior.maxX - p.x : direction.x < 0 ? p.x - interior.minX : direction.y > 0 ? interior.maxY - p.y : p.y - interior.minY;
  for (const prop of arena.props ?? []) {
    const c = prop.shape.a;
    const reach = prop.shape.radius + BOSS_PLAYER_RADIUS;
    const along = (c.x - p.x) * direction.x + (c.y - p.y) * direction.y;
    const across = Math.abs((c.x - p.x) * direction.y - (c.y - p.y) * direction.x);
    if (along <= 0 || across >= reach) continue;
    best = Math.min(best, along - Math.sqrt(reach * reach - across * across));
  }
  return Math.max(0, best);
}

// The yank's pull (package 4.4 AI): the side whose pull carries the hero
// toward the nearest wall or crate; ties keep east, west, south, north.
export function baronYankDirection(arena, player) {
  let best = null;
  for (const direction of DIRECTIONS) {
    const distance = slamDistance(arena, player, direction);
    if (!best || distance < best.distance - 1e-9) best = { direction, distance };
  }
  return best.direction;
}

// A yank's fields: the carpet's rects in this phase, each with its pull
// (units a tick). Hard Rug alternates the strips; `reverse` flips the lot.
export function baronYankFields(boss, { player, phaseIndex = boss.phaseIndex, flip = boss.hardRugYanks, reverse = false } = {}) {
  const rects = baronCarpetRects(boss.arena, phaseIndex);
  const speed = BARON_YANK.distance / BARON_YANK.ticks;
  const sign = reverse ? -1 : 1;
  if (phaseIndex >= 2) {
    return freezeDeep(rects.map((rect, k) => {
      const east = (k + flip) % 2 === 0;
      return { rect, pull: { x: (east ? speed : -speed) * sign, y: 0 } };
    }));
  }
  const direction = baronYankDirection(boss.arena, player);
  return freezeDeep(rects.map((rect) => ({ rect, pull: { x: direction.x * speed * sign, y: direction.y * speed * sign } })));
}

const yankShape = (fields) => (fields.length === 1
  ? { type: 'drift-rect', rect: fields[0].rect, drift: { x: 0, y: 0 } }
  : { type: 'union', shapes: fields.map((field) => ({ type: 'drift-rect', rect: field.rect, drift: { x: 0, y: 0 } })) });

// The strikes one tell locks, as offsets from the tell start. Exported so the
// walk-budget tests measure exactly what the simulation resolves. The yank's
// shape is the carpet it pulls (the danger is being on it); its damage is the
// slam it may cause.
export function rugPullBaronStrikes(attackId, { boss, player, phaseIndex = boss.phaseIndex, ordinal = boss.ordinal, wave = boss.wave, reverse = false } = {}) {
  const definition = BARON_ATTACK_DEFINITIONS[attackId];
  if (!definition) throw new TypeError(`unknown Baron attack ${String(attackId)}`);
  const arena = boss.arena;
  const interior = bossArenaInterior(arena);
  const strike = (shape, offset, extra = {}) => ({ attackId, offset, shape: shape && createBossShape(shape), damage: definition.damage, knockback: definition.knockback, ...extra });
  switch (attackId) {
    case 'rug-yank': {
      const fields = baronYankFields(boss, { player, phaseIndex, reverse });
      return [strike(yankShape(fields), definition.tellTicks, { yank: { fields, hardRug: phaseIndex >= 2 } })];
    }
    case 'double-or-nothing': {
      // The flip, then the yank's full tell; red adds a reversed yank.
      const fields = baronYankFields(boss, { player, phaseIndex });
      const reversed = baronYankFields(boss, { player, phaseIndex, reverse: true });
      const first = definition.tellTicks + BARON_ATTACK_DEFINITIONS['rug-yank'].tellTicks;
      return [
        strike(yankShape(fields), first, { yank: { fields, hardRug: phaseIndex >= 2 }, coinStake: 'first' }),
        strike(yankShape(reversed), first + definition.secondYankTicks, { yank: { fields: reversed, hardRug: phaseIndex >= 2 }, coinStake: 'second' }),
      ];
    }
    case 'pump-and-dump': {
      const sacks = [clampInto(player, interior)];
      if (phaseIndex >= 2) {
        // Hard Rug throws a second sack where the hero is heading.
        const vx = (player.vx ?? 0) / 60;
        const vy = (player.vy ?? 0) / 60;
        sacks.push(clampInto({ x: player.x + vx * definition.secondSackTicks, y: player.y + vy * definition.secondSackTicks }, interior));
      }
      const out = [];
      sacks.forEach((centre, index) => {
        const landing = definition.tellTicks + index * definition.secondSackTicks;
        out.push(strike({ type: 'circle', center: centre, radius: definition.radius }, landing, { sack: index }));
        // The Dump: three coin circles in a triangle 150 out, turned by the
        // run seed, 36 ticks after the Pump.
        const turn = seededUnit(boss.seed, `baron-dump:${ordinal}:${index}`) * Math.PI * 2;
        const coins = [0, 1, 2].map((k) => ({
          type: 'circle',
          center: { x: centre.x + Math.cos(turn + (k * 2 * Math.PI) / 3) * definition.dumpOffset, y: centre.y + Math.sin(turn + (k * 2 * Math.PI) / 3) * definition.dumpOffset },
          radius: definition.dumpRadius,
        }));
        out.push(strike({ type: 'union', shapes: coins }, landing + definition.dumpDelayTicks, { sack: index, dump: true, damage: definition.dumpDamage, knockback: 12 }));
      });
      return out;
    }
    case 'exit-scam':
      return [strike({ type: 'circle', center: { x: boss.x, y: boss.y }, radius: definition.radius }, definition.tellTicks, { scam: true })];
    case 'exit-liquidity': {
      // Two bagholders crawl from under the carpet edge, at the marks
      // farthest from the hero.
      const sites = arena.marks
        .map((mark, index) => ({ ...mark, index, distance: Math.hypot(mark.x - player.x, mark.y - player.y) }))
        .sort((left, right) => right.distance - left.distance || left.index - right.index)
        .slice(0, ADDS_PER_WAVE);
      const nextWave = wave + 1;
      return [{
        attackId,
        offset: definition.tellTicks,
        shape: null,
        damage: 0,
        knockback: 0,
        summon: {
          wave: nextWave,
          adds: sites.map((site, k) => ({ id: `boss:${BARON_BOSS_ID}:w${nextWave}:${k}`, archetypeId: ADD_ARCHETYPE, x: site.x, y: site.y })),
        },
      }];
    }
    default:
      throw new TypeError(`unknown Baron attack ${attackId}`);
  }
}

// Package 4.1: walking out of every damaging strike must fit its tell, from
// where the hero stands at the tell start, inside the floor.
export function rugPullBaronStrikesAreFair(strikes, player, arena) {
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

function liveGroups(boss) {
  return new Set(boss.pendingAttacks.map((pending) => pending.groupId)).size;
}

// The Exit Scam landing: one of the four authored marks, by hash, among those
// not within the escape distance of the hero.
export function baronScamTarget(boss, player, ordinal = boss.ordinal) {
  const marks = boss.arena.scamMarks;
  const clear = marks.filter((mark) => Math.hypot(mark.x - player.x, mark.y - player.y) > BARON_ESCAPE_DISTANCE);
  const pool = clear.length ? clear : marks;
  return pool[Math.floor(seededUnit(boss.seed, `baron-scam:${ordinal}`) * pool.length)];
}

// The coin's face: fnv(runSeed, 'baron-coin', ordinal) & 1; 1 is red.
export function baronCoinFace(seed, ordinal) {
  return (Math.floor(seededUnit(seed, `baron-coin:${ordinal}`) * 0x1_0000_0000) & 1) === 1 ? 'red' : 'green';
}

function issueTell(boss, attackId, { tick, player, events }) {
  if (liveGroups(boss) >= BARON_MAX_TELEGRAPH_GROUPS) return false;
  const strikes = rugPullBaronStrikes(attackId, { boss, player });
  if (!rugPullBaronStrikesAreFair(strikes, player, boss.arena)) return false;
  const definition = BARON_ATTACK_DEFINITIONS[attackId];
  const groupId = `${boss.id}:${attackId}:${boss.ordinal}`;
  strikes.forEach((entry, index) => {
    boss.pendingAttacks.push({
      attackId: entry.attackId,
      groupId,
      telegraphId: strikes.length === 1 ? groupId : `${groupId}:${index}`,
      strikeIndex: index,
      strikeCount: strikes.length,
      tellStartTick: tick,
      resolveTick: tick + entry.offset,
      origin: freezeDeep({ x: boss.x, y: boss.y }),
      target: freezeDeep({ x: player.x, y: player.y }),
      geometry: entry.shape,
      yank: entry.yank ?? null,
      coinStake: entry.coinStake ?? null,
      summon: entry.summon ?? null,
      scam: entry.scam ?? false,
      dump: entry.dump ?? false,
      groundZ: boss.groundZ,
      damage: entry.damage,
      knockback: entry.knockback,
    });
  });
  boss.pendingAttacks.sort((a, b) => a.resolveTick - b.resolveTick || (a.telegraphId < b.telegraphId ? -1 : a.telegraphId > b.telegraphId ? 1 : 0));
  if (attackId === 'double-or-nothing') {
    boss.coin = { ordinal: boss.ordinal, groupId, face: baronCoinFace(boss.seed, boss.ordinal), revealTick: tick + definition.tellTicks + definition.revealTicks };
  }
  if (attackId === 'exit-scam') {
    const target = baronScamTarget(boss, player);
    boss.vanish = { fromTick: tick + definition.tellTicks, untilTick: tick + definition.tellTicks + BARON_VANISH_TICKS, target: { id: target.id, x: target.x, y: target.y } };
  }
  if (attackId === 'exit-liquidity') boss.wave += 1;
  if (strikes.some((entry) => entry.yank?.hardRug)) boss.hardRugYanks += 1;
  boss.cooldownUntil[attackId] = tick + (definition.cooldownTicks ?? 0);
  boss.lastAttackId = attackId;
  boss.ordinal += 1;
  boss.actionCount += 1;
  boss.walked = false;
  boss.motion = null;
  const lastOffset = Math.max(...strikes.map((entry) => entry.offset));
  boss.nextActionTick = attackId === 'exit-scam'
    ? tick + definition.tellTicks + BARON_VANISH_TICKS + BARON_ARRIVAL_STAGGER_TICKS + 1
    : tick + lastOffset + definition.recoveryTicks + 1;
  pushBounded(boss, events, { type: 'tell', attackId, groupId, telegraphId: groupId, tick, elapsedTick: tick - boss.startTick, tellTicks: definition.tellTicks, strikeCount: strikes.length, damage: definition.damage, tier: definition.tier });
  return true;
}

// The action table (package 4.4 phases), by his action count.
function chooseAction(boss, { tick, player, addsAlive }) {
  const phase = boss.phaseIndex;
  const n = boss.actionCount;
  const ready = (attackId) => tick >= (boss.cooldownUntil[attackId] ?? 0);
  const addsFit = addsAlive + ADDS_PER_WAVE <= BARON_MAX_ADDS_ALIVE;
  const pick = seededUnit(boss.seed, `${BARON_BOSS_ID}:${boss.phaseId}:${boss.ordinal}`);
  if (phase === 0) return n % 3 === 2 ? ['rug-yank', 'pump-and-dump'] : ['pump-and-dump', 'rug-yank'];
  const yankTurn = n % 2 === 1;
  if (phase === 1) {
    if (yankTurn) return pick < 0.5 && ready('double-or-nothing') ? ['double-or-nothing', 'rug-yank'] : ['rug-yank', 'pump-and-dump'];
    const list = [];
    if (addsFit && ready('exit-liquidity')) list.push('exit-liquidity');
    if (n % 4 === 0 && ready('exit-scam')) list.push('exit-scam');
    return [...list, 'pump-and-dump', 'rug-yank'];
  }
  if (yankTurn) return ['rug-yank', 'pump-and-dump'];
  return [...(addsFit && ready('exit-liquidity') ? ['exit-liquidity'] : []), 'pump-and-dump', 'rug-yank'];
}

// The carpet-edge mark whose distance from the hero is closest to 400 (inside
// 300-500 where one is); ties by mark id.
export function baronStrutMark(arena, player) {
  let best = null;
  for (const mark of arena.marks) {
    const distance = Math.hypot(mark.x - player.x, mark.y - player.y);
    const score = Math.abs(distance - BARON_KEEP_DISTANCE.aim);
    if (!best || score < best.score - 1e-9 || (Math.abs(score - best.score) <= 1e-9 && mark.id < best.mark.id)) best = { mark, score };
  }
  return best.mark;
}

const BARON_COLLISION_BODY = createCollisionBody({ id: BARON_TARGET_ID, kind: 'boss', radius: BARON_BODY.radius, minZ: BARON_BODY.minZ, maxZ: BARON_BODY.maxZ });

function stepWalk(boss, { tick, blockers }) {
  const motion = boss.motion;
  const dx = motion.target.x - boss.x;
  const dy = motion.target.y - boss.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1 || tick >= motion.untilTick) {
    boss.motion = null;
    return;
  }
  const step = Math.min(BARON_BODY.walkUnitsPerTick, distance);
  const delta = { x: (dx / distance) * step, y: (dy / distance) * step };
  const sweep = resolveSweptCircleMotion({ body: BARON_COLLISION_BODY, start: { x: boss.x, y: boss.y, z: boss.groundZ }, delta, blockers, bounds: boss.motionBounds });
  boss.x = sweep.position.x;
  boss.y = sweep.position.y;
  boss.facing = { x: delta.x / step, y: delta.y / step };
  // A walk that cannot progress ends (a crate or a lock in the way).
  if (Math.hypot(sweep.position.x - (motion.lastX ?? Infinity), sweep.position.y - (motion.lastY ?? Infinity)) < 1e-6) boss.motion = null;
  else Object.assign(motion, { lastX: sweep.position.x, lastY: sweep.position.y });
}

// The drift at a point this tick (units a tick): the sum of the active yank
// fields whose rect holds the point, zero inside a peg ring. main folds it
// into the hero's and the enemies' swept moves.
export function rugPullBaronDriftAt(boss, point, tick) {
  if (!boss?.drifts?.length) return null;
  let x = 0;
  let y = 0;
  let groupId = null;
  if (inPegRing(boss.arena, point)) return null;
  for (const drift of boss.drifts) {
    if (tick < drift.fromTick || tick > drift.untilTick) continue;
    for (const field of drift.fields) {
      if (!insideRect(point, field.rect)) continue;
      x += field.pull.x;
      y += field.pull.y;
      groupId ??= drift.groupId;
    }
  }
  return x === 0 && y === 0 ? null : freezeDeep({ x, y, groupId });
}

function resolveYank(boss, pending, { tick, events }) {
  const fields = pending.yank.fields;
  boss.drifts.push({ groupId: pending.telegraphId, fields, fromTick: tick + 1, untilTick: tick + BARON_YANK.ticks, burned: false });
  pushBounded(boss, events, { type: 'drift', attackId: pending.attackId, telegraphId: pending.telegraphId, groupId: pending.groupId, tick, fromTick: tick + 1, untilTick: tick + BARON_YANK.ticks, fields, hardRug: pending.yank.hardRug });
  // Adds on the carpet when it is pulled go down for 60 ticks.
  pushBounded(boss, events, { type: 'knockdown', telegraphId: pending.telegraphId, tick, untilTick: tick + BARON_KNOCKDOWN_TICKS, rects: fields.map((field) => field.rect), pegs: boss.arena.pegs, pegRadius: boss.arena.pegRadius });
}

export function stepRugPullBaronBoss({ boss, tick, player, blockers = [], addsAlive = 0, playerDriftBlocked = false } = {}) {
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

  // Rug burn: the hero's slide this tick slammed into a wall, a lock or a
  // crate. Once per yank.
  if (playerDriftBlocked) {
    const drift = boss.drifts.find((entry) => !entry.burned && tick >= entry.fromTick && tick <= entry.untilTick
      && entry.fields.some((field) => insideRect(player, field.rect)));
    if (drift && !inPegRing(boss.arena, player)) {
      drift.burned = true;
      pushBounded(boss, events, {
        type: 'attack', attackId: 'rug-burn', telegraphId: `${drift.groupId}:burn`, groupId: drift.groupId, tick, elapsedTick,
        origin: { x: player.x, y: player.y }, target: { x: player.x, y: player.y },
        geometry: createBossShape({ type: 'circle', center: { x: player.x, y: player.y }, radius: 1 }), groundZ: boss.groundZ,
        damage: BARON_YANK.rugBurn, knockback: 0, leash: boss.arena.bounds,
      });
    }
  }
  boss.drifts = boss.drifts.filter((entry) => entry.untilTick >= tick);
  if (tick >= boss.haltFrom && tick <= boss.haltUntil) return report('halt');

  // The coin shows its face inside the yank's tell. Green: he fumbles.
  if (boss.coin && tick >= boss.coin.revealTick) {
    const coin = boss.coin;
    boss.coin = null;
    pushBounded(boss, events, { type: 'coin', tick, elapsedTick, face: coin.face, groupId: coin.groupId });
    if (coin.face === 'green') {
      boss.pendingAttacks = boss.pendingAttacks.filter((pending) => pending.groupId !== coin.groupId);
      boss.staggerUntil = tick + BARON_FUMBLE_STAGGER_TICKS;
      boss.staggerWindow = 'fumble';
      boss.nextActionTick = tick + BARON_FUMBLE_STAGGER_TICKS + 1;
    }
  }
  // Exit Scam: gone after the smoke, back at the gold ring 60 ticks later,
  // staggered for 45 at x1.15.
  if (boss.vanish && tick >= boss.vanish.fromTick && !boss.vanished && tick < boss.vanish.untilTick) boss.vanished = true;
  if (boss.vanish && tick >= boss.vanish.untilTick) {
    const { target } = boss.vanish;
    boss.vanish = null;
    boss.vanished = false;
    boss.x = target.x;
    boss.y = target.y;
    boss.staggerUntil = tick + BARON_ARRIVAL_STAGGER_TICKS;
    boss.staggerWindow = 'arrival';
    boss.nextActionTick = Math.max(boss.nextActionTick, tick + BARON_ARRIVAL_STAGGER_TICKS + 1);
    pushBounded(boss, events, { type: 'reappear', tick, elapsedTick, markId: target.id, x: target.x, y: target.y });
  }

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
    boss.lastResolved = { attackId: pending.attackId, tick };
    if (pending.yank) {
      resolveYank(boss, pending, { tick, events });
      continue;
    }
    pushBounded(boss, events, {
      type: 'attack', attackId: pending.attackId, telegraphId: pending.telegraphId, groupId: pending.groupId, tick, elapsedTick,
      origin: pending.origin, target: pending.target, geometry: pending.geometry, groundZ: pending.groundZ,
      damage: pending.damage, knockback: pending.knockback, leash: boss.arena.bounds,
    });
    if (pending.scam) pushBounded(boss, events, { type: 'vanish', tick, elapsedTick, markId: boss.vanish?.target.id ?? null, untilTick: boss.vanish?.untilTick ?? tick });
  }
  boss.pendingAttacks = remaining;

  const staggered = tick <= boss.staggerUntil;
  const busy = boss.pendingAttacks.length > 0 || boss.coin || boss.vanish || staggered;
  if (!busy) {
    const near = Math.hypot(player.x - boss.x, player.y - boss.y) < BARON_ESCAPE_DISTANCE;
    const engagedTicks = tick - boss.startTick - boss.introTicks;
    const stalled = engagedTicks >= BARON_STALL_TICKS;
    if (stalled) {
      // The stall guard loops Hard Rug: a yank, then a sack, every 240.
      const loopTick = (engagedTicks - BARON_STALL_TICKS) % BARON_STALL_CYCLE_TICKS;
      if (loopTick === 0) issueTell(boss, 'rug-yank', { tick, player, events });
      else if (loopTick === BARON_STALL_CYCLE_TICKS / 2) issueTell(boss, 'pump-and-dump', { tick, player, events });
    } else if (tick >= boss.nextActionTick && near && tick >= (boss.cooldownUntil['exit-scam'] ?? 0) && issueTell(boss, 'exit-scam', { tick, player, events })) {
      // Exit Scam pre-empts whenever the hero closes in.
    } else if (tick >= boss.nextActionTick && boss.motion?.kind !== 'walk') {
      const mark = boss.walked ? null : baronStrutMark(boss.arena, player);
      if (mark && Math.hypot(mark.x - boss.x, mark.y - boss.y) > 24) {
        boss.walked = true;
        boss.motion = { kind: 'walk', target: { x: mark.x, y: mark.y }, untilTick: tick + BARON_WALK_MAX_TICKS };
      } else {
        boss.walked = true;
        let issued = false;
        for (const attackId of chooseAction(boss, { tick, player, addsAlive })) {
          if (issueTell(boss, attackId, { tick, player, events })) {
            issued = true;
            break;
          }
        }
        if (!issued) boss.nextActionTick = tick + 30;
      }
    }
    if (boss.motion?.kind === 'walk' && boss.pendingAttacks.length === 0) stepWalk(boss, { tick, blockers });
  } else if (boss.motion) boss.motion = null;
  return report(boss.vanished ? 'vanished' : staggered ? 'stagger' : 'combat');
}

// Adds for a resolved Exit Liquidity, capped so at most four adds (the
// ordinary enemies already inside his floor included) are alive at once.
export function createRugPullBaronAddCandidates({ event, alive = 0 } = {}) {
  if (event?.type !== 'add-wave' || event.attackId !== 'exit-liquidity' || !Array.isArray(event.adds)) {
    throw new TypeError('resolved exit-liquidity add-wave event is required');
  }
  if (!Number.isInteger(alive) || alive < 0) throw new TypeError('alive must be a non-negative integer');
  const slots = Math.max(0, BARON_MAX_ADDS_ALIVE - alive);
  return freezeDeep(event.adds.slice(0, slots).map((add) => ({
    id: add.id,
    archetypeId: add.archetypeId,
    x: finite(add.x, 'add.x'),
    y: finite(add.y, 'add.y'),
    groundZ: finite(event.groundZ, 'groundZ'),
  })));
}

// Resolves one strike against the hero's disk. The leash (package 4.1) keeps
// every strike inside his floor.
export function resolveRugPullBaronAttack({ event, player, radius = BOSS_PLAYER_RADIUS } = {}) {
  if (!event?.geometry || event.type !== 'attack') throw new TypeError('resolved boss attack event is required');
  const point = { x: finite(player?.x, 'player.x'), y: finite(player?.y, 'player.y') };
  const groundZ = finite(player?.groundZ, 'player.groundZ');
  if (event.damage <= 0) return freezeDeep({ hit: false, damage: 0, reason: 'non-damaging' });
  if (Math.abs(groundZ - event.groundZ) > 64) return freezeDeep({ hit: false, damage: 0, reason: 'elevation' });
  const leash = event.leash;
  if (leash && (point.x < leash.minX - BOSS_LEASH_MARGIN || point.x > leash.maxX + BOSS_LEASH_MARGIN
    || point.y < leash.minY - BOSS_LEASH_MARGIN || point.y > leash.maxY + BOSS_LEASH_MARGIN)) {
    return freezeDeep({ hit: false, damage: 0, reason: 'leash' });
  }
  const hit = bossShapeHits(event.geometry, point, radius);
  return freezeDeep({ hit, damage: hit ? event.damage : 0, reason: hit ? null : 'outside-hit-geometry' });
}

// The only path that changes his health. The intro, every halt and his
// vanish take no damage; a stagger takes x1.15 (the role multiplier, if any,
// shares that cap); a hit that reaches a threshold stops there and starts the
// halt on this tick. Environmental damage never lands the killing blow.
export function applyRugPullBaronDamage({ boss, amount, tick, roleMultiplier = 1, environmental = false } = {}) {
  if (!boss) throw new TypeError('boss state is required');
  finite(amount, 'damage amount');
  finite(roleMultiplier, 'damage multiplier');
  if (amount < 0) throw new TypeError('damage amount must be non-negative');
  if (roleMultiplier < 1 || roleMultiplier > BARON_MAX_DAMAGE_MULTIPLIER) throw new TypeError('damage multiplier exceeds the Baron bound');
  nonNegativeInteger(tick, 'tick');
  const refused = (reason) => freezeDeep({ defeated: boss.defeated, damageApplied: 0, remainingHealth: boss.health, runEvent: null, reason, phaseCrossed: null });
  if (boss.defeated || !boss.active) return refused('inactive');
  if (tick < boss.startTick + boss.introTicks) return refused('intro');
  if (tick >= boss.haltFrom && tick <= boss.haltUntil) return refused('halt');
  if (boss.vanished) return refused('vanished');
  const multiplier = Math.min(roleMultiplier * getRugPullBaronVulnerability(boss, tick).multiplier, BARON_MAX_DAMAGE_MULTIPLIER);
  const scaled = Math.round(amount * multiplier * 1_000_000) / 1_000_000;
  const threshold = boss.thresholds[boss.phaseIndex];
  const floor = Math.max(threshold ?? 0, environmental ? 1 : 0);
  const applied = Math.max(0, Math.min(scaled, boss.health - floor));
  boss.health -= applied;
  let phaseCrossed = null;
  if (threshold !== undefined && boss.health <= threshold) {
    boss.phaseIndex += 1;
    boss.phaseId = BARON_PHASES[boss.phaseIndex].id;
    boss.haltFrom = tick;
    boss.haltUntil = tick + BARON_PHASE_HALT_TICKS;
    boss.pendingAttacks = [];
    boss.coin = null;
    boss.motion = null;
    boss.staggerUntil = -1;
    boss.staggerWindow = null;
    boss.walked = false;
    boss.nextActionTick = boss.haltUntil + 1;
    phaseCrossed = boss.phaseId;
    // The carpet changes with the phase: rolled up, then torn into strips.
    boss.pendingEvents.push({ type: 'halt', phaseId: boss.phaseId, tick, untilTick: boss.haltUntil, elapsedTick: tick - boss.startTick, carpet: baronCarpetRects(boss.arena, boss.phaseIndex) });
  }
  if (boss.health > 0) return freezeDeep({ defeated: false, damageApplied: applied, remainingHealth: boss.health, runEvent: null, reason: null, phaseCrossed });
  boss.active = false;
  boss.defeated = true;
  boss.defeatedTick = tick;
  boss.pendingAttacks = [];
  boss.drifts = [];
  boss.coin = null;
  boss.vanish = null;
  boss.motion = null;
  let runEvent = null;
  if (!boss.defeatEventEmitted) {
    boss.defeatEventEmitted = true;
    runEvent = freezeDeep({ type: 'game:run-event', name: 'boss-defeated', data: { bossId: boss.id, tick, elapsedTicks: tick - boss.startTick } });
  }
  return freezeDeep({ defeated: true, damageApplied: applied, remainingHealth: 0, runEvent, reason: null, phaseCrossed });
}

// The shared knock-down stagger (package 4.4 "Small sim addition"): a
// 60-tick stagger that resets the enemy's attack phase and locks its own
// movement (a drift still carries it). It uses the enemy's existing recovery
// phase and decision clock, so nothing else in the enemy step changes.
export function knockDownEnemy(enemy, { tick, ticks = BARON_KNOCKDOWN_TICKS } = {}) {
  nonNegativeInteger(tick, 'tick');
  nonNegativeInteger(ticks, 'ticks');
  if (!enemy?.active || !(enemy.health > 0)) return false;
  enemy.attackPhase = 'recovery';
  enemy.attackPhaseUntilTick = tick + ticks;
  enemy.attackRecoveryUntilTick = tick + ticks;
  enemy.telegraphTarget = null;
  enemy.attackTellStartedTick = null;
  enemy.intent = null;
  enemy.velocity = { x: 0, y: 0 };
  enemy.nextDecisionTick = tick + ticks;
  enemy.knockedDownUntilTick = tick + ticks;
  return true;
}

// Which enemies a resolved yank knocks down: those on its rects and not in a
// peg ring, sorted by id.
export function baronKnockDownTargets(event, enemies) {
  if (event?.type !== 'knockdown') throw new TypeError('knockdown event is required');
  return enemies
    .filter((enemy) => enemy.active && enemy.health > 0
      && event.rects.some((r) => insideRect(enemy, r))
      && !event.pegs.some((peg) => Math.hypot(enemy.x - peg.x, enemy.y - peg.y) <= event.pegRadius))
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}
