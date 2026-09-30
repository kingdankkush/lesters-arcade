// The shared deterministic engine for the three district bosses of the ten-area
// world (slice HMH-BOSSES-2-4): the Rug Pull Baron, the 51% Foreman and the
// Lockkeeper. It follows liquidator-boss.mjs beat for beat so the run contract
// stays one shape: a boss is dormant until its slot starts it, sits through an
// untargetable intro, changes phase at its v7 HP thresholds (clamped overshoot,
// pending tells cleared, a 90-tick invulnerable halt), walks between its
// arena marks, and after a stall budget loops its final set.
//
// Every choice is fnv(runSeed, '<bossId>', phase, ordinal) (seededUnit): no RNG
// stream, no clock, no DOM. Every tell locks one boss-geometry-kit shape at its
// start and resolves on that frozen shape; the liquidator's resolver is reused
// for the hero's disk. Arena machinery (the marquee, the quarry presses, the
// lock winch) is never simulated here: a super resolving emits a pure
// `arena:*` event carrying its geometry so the world can bind it later without
// changing this timeline. Loaded lazily with the boss modules.
import { finite, freezeDeep } from './value-guards.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from './collision.mjs';
import { seededUnit } from './deterministic-hash.mjs';
import { createBossShape } from './boss-geometry.mjs';
import { bossArenaInterior } from './boss-arenas.mjs';
import { liquidatorStrikesAreFair, resolveLiquidatorAttack } from './liquidator-boss.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES } from '../../../sdk/hmh-run-contract-v7.mjs';

export const DISTRICT_BOSS_PHASE_HALT_TICKS = HMH_V7_BOSS_RULES.BOSS_PHASE_HALT_TICKS;
export const DISTRICT_BOSS_MAX_EVENTS_PER_TICK = 8;
export const DISTRICT_BOSS_MAX_TELEGRAPH_GROUPS = 4;
export const DISTRICT_BOSS_STAGGER_TICKS = 90;
export const DISTRICT_BOSS_VULNERABLE_MULTIPLIER = 1.25;
export const DISTRICT_BOSS_ROLE_CHECK_MULTIPLIER = 1.15;
export const DISTRICT_BOSS_MAX_DAMAGE_MULTIPLIER = 1.25;
export const DISTRICT_BOSS_WALK_MAX_TICKS = 180;
export const DISTRICT_BOSS_STEER_STOP_DISTANCE = 220;

const nonNegativeInteger = (value, name) => {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
};

function unit(x, y, fallback = { x: 0, y: 1 }) {
  const length = Math.hypot(x, y);
  return length > 1e-9 ? { x: x / length, y: y / length } : fallback;
}

export function rotateDirection(direction, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: direction.x * c - direction.y * s, y: direction.x * s + direction.y * c };
}

// Distance from p along direction d to the edge of bounds.
export function rayExit(p, d, bounds) {
  let best = Infinity;
  if (d.x > 1e-9) best = Math.min(best, (bounds.maxX - p.x) / d.x);
  if (d.x < -1e-9) best = Math.min(best, (bounds.minX - p.x) / d.x);
  if (d.y > 1e-9) best = Math.min(best, (bounds.maxY - p.y) / d.y);
  if (d.y < -1e-9) best = Math.min(best, (bounds.minY - p.y) / d.y);
  return Math.max(0, Number.isFinite(best) ? best : 0);
}

export const clampInto = (p, box) => ({ x: Math.max(box.minX, Math.min(box.maxX, p.x)), y: Math.max(box.minY, Math.min(box.maxY, p.y)) });

// A definition is frozen data plus one pure `strikes` function:
//   strikes(attackId, context) -> [{ shape, offset, damage, knockback, dash?, hook?, sectorId? }]
// where context = { boss, player, arena, phaseIndex, ordinal, toPlayer, origin, interior, definition }.
export function defineDistrictBoss(definition) {
  const contract = HMH_V7_BOSSES[definition.bossId];
  if (!contract) throw new TypeError(`unknown v7 boss ${String(definition.bossId)}`);
  if (typeof definition.strikes !== 'function') throw new TypeError('a district boss needs a strikes function');
  if (!Array.isArray(definition.phases) || definition.phases.length !== contract.phaseThresholds.length + 1) throw new TypeError('phases must match the v7 thresholds');
  const attacks = freezeDeep(definition.attacks);
  return Object.freeze({
    ...definition,
    contract,
    targetSeconds: contract.targetSeconds,
    phaseThresholds: contract.phaseThresholds,
    phases: freezeDeep(definition.phases),
    attacks,
    body: freezeDeep(definition.body),
    stallTicks: definition.stallTicks ?? 4_800,
    endlessCycle: freezeDeep(definition.endlessCycle),
    phaseOpeners: Object.freeze(definition.phaseOpeners ?? [null, definition.superId, definition.superId]),
  });
}

export function districtBossThresholdHealth(definition, maxHealth) {
  return definition.phaseThresholds.map((ratio) => Math.round(maxHealth * ratio));
}

// An open floor centred on a point, for tests and benchmarks away from the map.
export function districtBossOpenArena(definition, centre = { x: 0, y: 0 }) {
  const x = finite(centre.x, 'centre.x');
  const y = finite(centre.y, 'centre.y');
  const half = definition.arenaSize / 2;
  return freezeDeep({
    id: 'open-floor',
    trigger: definition.triggerId,
    bounds: { minX: x - half, minY: y - half, maxX: x + half, maxY: y + half },
    centre: { x, y },
    spawn: { x, y: y - half * 0.6 },
    marks: definition.markOffsets.map((offset, index) => ({ id: `mark-${index + 1}`, x: x + offset.x, y: y + offset.y })),
    hookSites: definition.hookOffsets.map((offset, index) => ({ id: `hook-${index + 1}`, x: x + offset.x, y: y + offset.y })),
    walls: [],
  });
}

export function createDistrictBoss(definition, {
  id = definition.targetId,
  x,
  y,
  groundZ = 0,
  startTick = 0,
  maxHealth,
  arena = null,
  seed = 0,
} = {}) {
  if (typeof id !== 'string' || id.trim().length === 0) throw new TypeError('boss id is required');
  if (!Number.isInteger(maxHealth) || maxHealth <= 0) throw new TypeError('maxHealth must be a positive integer (package 4.1 HP formula)');
  nonNegativeInteger(startTick, 'startTick');
  const floor = arena ?? districtBossOpenArena(definition, { x: finite(x, 'boss.x'), y: finite(y, 'boss.y') });
  const body = definition.body;
  return {
    id,
    bossId: definition.bossId,
    kind: 'boss',
    radius: body.radius,
    hurtRadius: body.hurtRadius,
    minZ: body.minZ,
    maxZ: body.maxZ,
    armor: body.armor,
    knockbackResistance: body.knockbackResistance,
    body: freezeDeep({ radius: body.radius, playerSeparationRadius: body.playerSeparationRadius, maxPressureStep: body.maxPressureStep, pinEscapeClearance: body.pinEscapeClearance }),
    x: finite(x ?? floor.spawn.x, 'boss.x'),
    y: finite(y ?? floor.spawn.y, 'boss.y'),
    groundZ: finite(groundZ, 'boss.groundZ'),
    facing: { x: 0, y: 1 },
    seed: Number(seed) >>> 0,
    arena: floor,
    motionBounds: Object.freeze({ ...floor.bounds, visibleBoundaryId: `boss-floor-${floor.id}` }),
    startTick,
    introTicks: definition.introTicks,
    elapsedTick: 0,
    engaged: false,
    maxHealth,
    health: maxHealth,
    thresholds: districtBossThresholdHealth(definition, maxHealth),
    phaseIndex: 0,
    phaseId: definition.phases[0].id,
    haltFrom: -1,
    haltUntil: -1,
    opener: null,
    superNextTick: startTick + definition.introTicks + definition.firstSuperDelayTicks,
    staggerUntil: -1,
    active: true,
    defeated: false,
    defeatEventEmitted: false,
    defeatedTick: -1,
    pendingAttacks: [],
    pendingEvents: [],
    droppedEvents: 0,
    ordinal: 0,
    hooksFired: 0,
    attacksSinceWalk: 0,
    lastAttackId: null,
    cooldownUntil: {},
    nextActionTick: startTick + definition.introTicks + definition.firstActionDelayTicks,
    motion: null,
    lastResolved: null,
  };
}

export function isDistrictBossTargetable(boss, tick) {
  return Boolean(boss?.active) && boss.health > 0 && Number.isInteger(tick) && tick >= boss.startTick + boss.introTicks;
}

export function getDistrictBossVulnerability(boss, tick) {
  if (!boss?.active) return freezeDeep({ active: false, multiplier: 1, windowId: null });
  const windowId = tick <= boss.staggerUntil ? 'stagger' : null;
  return freezeDeep({ active: windowId !== null, multiplier: windowId ? DISTRICT_BOSS_VULNERABLE_MULTIPLIER : 1, windowId });
}

function pushBounded(boss, events, event) {
  if (events.length >= DISTRICT_BOSS_MAX_EVENTS_PER_TICK) {
    boss.droppedEvents += 1;
    return;
  }
  events.push(freezeDeep(event));
}

export function districtBossStrikes(definition, attackId, { boss, player, arena = boss.arena, phaseIndex = boss.phaseIndex, ordinal = boss.ordinal } = {}) {
  const attack = definition.attacks[attackId];
  if (!attack) throw new TypeError(`unknown ${definition.bossId} attack ${String(attackId)}`);
  const origin = { x: boss.x, y: boss.y };
  const toPlayer = unit(player.x - boss.x, player.y - boss.y, boss.facing ?? { x: 0, y: 1 });
  const interior = bossArenaInterior(arena);
  const strike = (shape, offset, extra = {}) => ({ attackId, offset, shape: createBossShape(shape), damage: attack.damage, knockback: attack.knockback, ...extra });
  return definition.strikes(attackId, { boss, player, arena, phaseIndex, ordinal, toPlayer, origin, interior, attack, strike, seed: boss.seed });
}

function liveGroups(boss) {
  return new Set(boss.pendingAttacks.map((pending) => pending.groupId)).size;
}

function issueTell(definition, boss, attackId, { tick, player, events }) {
  if (liveGroups(boss) >= DISTRICT_BOSS_MAX_TELEGRAPH_GROUPS) return false;
  const strikes = districtBossStrikes(definition, attackId, { boss, player });
  if (!liquidatorStrikesAreFair(strikes, player, boss.arena)) return false;
  const attack = definition.attacks[attackId];
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
      hook: entry.hook ?? null,
      dash: entry.dash ?? null,
      groundZ: boss.groundZ,
      damage: entry.damage,
      knockback: entry.knockback,
    });
  });
  boss.pendingAttacks.sort((a, b) => a.resolveTick - b.resolveTick || (a.telegraphId < b.telegraphId ? -1 : a.telegraphId > b.telegraphId ? 1 : 0));
  if (attack.tier === 'super') boss.superNextTick = tick + attack.repeatTicks;
  boss.cooldownUntil[attackId] = tick + (attack.cooldownTicks ?? 0);
  boss.lastAttackId = attackId;
  boss.ordinal += 1;
  boss.attacksSinceWalk += 1;
  boss.motion = null;
  const lastOffset = Math.max(...strikes.map((entry) => entry.offset));
  boss.nextActionTick = tick + lastOffset + attack.recoveryTicks + 1;
  pushBounded(boss, events, { type: 'tell', bossId: boss.bossId, attackId, groupId, telegraphId: groupId, tick, elapsedTick: tick - boss.startTick, tellTicks: attack.tellTicks, strikeCount: strikes.length, damage: attack.damage, tier: attack.tier });
  return true;
}

function chooseAttack(definition, boss, { tick, player, events }) {
  const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
  if (boss.opener) {
    const opener = boss.opener;
    boss.opener = null;
    if (issueTell(definition, boss, opener, { tick, player, events })) return true;
  }
  if (tick >= boss.superNextTick && issueTell(definition, boss, definition.superId, { tick, player, events })) return true;
  const candidates = definition.candidateAttacks({ phaseIndex: boss.phaseIndex, distance }).filter((attackId) => attackId !== boss.lastAttackId);
  const ready = candidates.filter((attackId) => tick >= (boss.cooldownUntil[attackId] ?? 0));
  const list = ready.length ? ready : candidates;
  const pick = list.length ? Math.floor(seededUnit(boss.seed, `${definition.bossId}:${boss.phaseId}:${boss.ordinal}`) * list.length) : 0;
  const order = [...list.slice(pick), ...list.slice(0, pick), ...definition.fallbackAttacks].filter((attackId, index, all) => attackId !== boss.lastAttackId && all.indexOf(attackId) === index);
  for (const attackId of order) if (issueTell(definition, boss, attackId, { tick, player, events })) return true;
  return false;
}

const collisionBodies = new Map();
function collisionBody(definition) {
  if (!collisionBodies.has(definition.bossId)) {
    collisionBodies.set(definition.bossId, createCollisionBody({ id: definition.targetId, kind: 'boss', radius: definition.body.radius, minZ: definition.body.minZ, maxZ: definition.body.maxZ }));
  }
  return collisionBodies.get(definition.bossId);
}

function stepMotion(definition, boss, { tick, player, blockers }) {
  const motion = boss.motion;
  if (!motion) return;
  const body = definition.body;
  let delta;
  if (motion.kind === 'dash') {
    const step = Math.min(body.dashUnitsPerTick, motion.remaining);
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
    const step = Math.min(body.walkUnitsPerTick, distance);
    delta = { x: (dx / distance) * step, y: (dy / distance) * step };
  } else {
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= DISTRICT_BOSS_STEER_STOP_DISTANCE) {
      boss.motion = null;
      return;
    }
    const step = Math.min(body.steerUnitsPerTick, distance - DISTRICT_BOSS_STEER_STOP_DISTANCE);
    delta = { x: (dx / distance) * step, y: (dy / distance) * step };
  }
  const sweep = resolveSweptCircleMotion({ body: collisionBody(definition), start: { x: boss.x, y: boss.y, z: boss.groundZ }, delta, blockers, bounds: boss.motionBounds });
  const moved = Math.hypot(sweep.position.x - boss.x, sweep.position.y - boss.y);
  const requested = Math.hypot(delta.x, delta.y);
  boss.x = sweep.position.x;
  boss.y = sweep.position.y;
  if (requested > 1e-9) boss.facing = unit(delta.x, delta.y, boss.facing);
  if (motion.kind === 'dash') {
    if (moved + 1e-6 < requested) {
      boss.motion = null;
      boss.staggerUntil = tick + DISTRICT_BOSS_STAGGER_TICKS;
      boss.nextActionTick = Math.max(boss.nextActionTick, tick + DISTRICT_BOSS_STAGGER_TICKS + 1);
    } else if (motion.remaining <= 1e-9) boss.motion = null;
  }
}

function farthestMark(boss, player) {
  let best = null;
  for (const mark of boss.arena.marks) {
    const distance = Math.hypot(mark.x - player.x, mark.y - player.y);
    if (!best || distance > best.distance + 1e-9 || (Math.abs(distance - best.distance) <= 1e-9 && mark.id < best.mark.id)) best = { mark, distance };
  }
  return best?.mark ?? null;
}

export function stepDistrictBoss(definition, { boss, tick, player, blockers = [] } = {}) {
  if (!boss || !Array.isArray(boss.pendingAttacks) || boss.bossId !== definition.bossId) throw new TypeError('matching boss state is required');
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
    pushBounded(boss, events, { type: 'engage', bossId: boss.bossId, tick, elapsedTick });
  }
  if (tick >= boss.haltFrom && tick <= boss.haltUntil) return report('halt');

  const remaining = [];
  for (const pending of boss.pendingAttacks) {
    if (pending.resolveTick > tick) {
      remaining.push(pending);
      continue;
    }
    pushBounded(boss, events, {
      type: 'attack', bossId: boss.bossId, attackId: pending.attackId, telegraphId: pending.telegraphId, groupId: pending.groupId, tick, elapsedTick,
      origin: pending.origin, target: pending.target, geometry: pending.geometry, groundZ: pending.groundZ,
      damage: pending.damage, knockback: pending.knockback, leash: boss.arena.bounds,
    });
    boss.lastResolved = { attackId: pending.attackId, tick };
    if (pending.dash) boss.motion = { kind: 'dash', direction: pending.dash.direction, remaining: pending.dash.distance };
    if (pending.hook) {
      // The arena machinery fires as a pure event: geometry only, no state.
      boss.hooksFired += 1;
      pushBounded(boss, events, { type: pending.hook.type, bossId: boss.bossId, attackId: pending.attackId, telegraphId: pending.telegraphId, tick, elapsedTick, phaseId: boss.phaseId, ordinal: boss.hooksFired, geometry: pending.geometry, ...pending.hook.payload });
    }
    if (definition.attacks[pending.attackId].tier === 'super' && pending.strikeIndex === pending.strikeCount - 1) {
      boss.staggerUntil = tick + DISTRICT_BOSS_STAGGER_TICKS;
      boss.nextActionTick = Math.max(boss.nextActionTick, tick + DISTRICT_BOSS_STAGGER_TICKS + 1);
      pushBounded(boss, events, { type: 'stagger', bossId: boss.bossId, tick, elapsedTick, untilTick: boss.staggerUntil });
    }
  }
  boss.pendingAttacks = remaining;

  const staggered = tick <= boss.staggerUntil;
  const idle = boss.pendingAttacks.length === 0 && boss.motion?.kind !== 'dash' && !staggered;
  const stalled = elapsedTick >= definition.stallTicks;
  if (idle && stalled) {
    const loopTick = (elapsedTick - definition.stallTicks) % definition.endlessCycleTicks;
    const entry = definition.endlessCycle.find((candidate) => candidate.offset === loopTick);
    if (entry) issueTell(definition, boss, entry.attackId, { tick, player, events });
  } else if (idle && tick >= boss.nextActionTick && boss.motion?.kind !== 'walk') {
    const superDue = boss.opener || tick >= boss.superNextTick;
    const mark = !superDue && boss.attacksSinceWalk >= 3 && boss.phaseIndex < definition.phases.length - 1 ? farthestMark(boss, player) : null;
    if (mark) {
      boss.attacksSinceWalk = 0;
      boss.motion = { kind: 'walk', target: { x: mark.x, y: mark.y }, untilTick: tick + DISTRICT_BOSS_WALK_MAX_TICKS };
    } else if (!chooseAttack(definition, boss, { tick, player, events })) boss.nextActionTick = tick + 30;
  } else if (idle && boss.phaseIndex === definition.phases.length - 1 && !boss.motion) {
    boss.motion = { kind: 'steer' };
  }
  if (!staggered && (boss.pendingAttacks.length === 0 || boss.motion?.kind === 'dash')) stepMotion(definition, boss, { tick, player, blockers });
  else if (boss.motion?.kind !== 'dash') boss.motion = null;
  return report(staggered ? 'stagger' : 'combat');
}

// The liquidator resolver is shape-generic: the hero's disk against the frozen
// geometry, the leash and cover line of sight for lanes.
export function resolveDistrictBossAttack(options) {
  return resolveLiquidatorAttack(options);
}

export function applyDistrictBossDamage(definition, { boss, amount, tick, roleMultiplier = 1, environmental = false } = {}) {
  if (!boss || boss.bossId !== definition.bossId) throw new TypeError('matching boss state is required');
  finite(amount, 'damage amount');
  finite(roleMultiplier, 'damage multiplier');
  if (amount < 0) throw new TypeError('damage amount must be non-negative');
  if (roleMultiplier < 1 || roleMultiplier > DISTRICT_BOSS_ROLE_CHECK_MULTIPLIER) throw new TypeError('damage multiplier exceeds the role-check bound');
  nonNegativeInteger(tick, 'tick');
  const refused = (reason) => freezeDeep({ defeated: boss.defeated, damageApplied: 0, remainingHealth: boss.health, runEvent: null, reason, phaseCrossed: null });
  if (boss.defeated || !boss.active) return refused('inactive');
  if (tick < boss.startTick + boss.introTicks) return refused('intro');
  if (tick >= boss.haltFrom && tick <= boss.haltUntil) return refused('halt');
  const multiplier = Math.min(roleMultiplier * getDistrictBossVulnerability(boss, tick).multiplier, DISTRICT_BOSS_MAX_DAMAGE_MULTIPLIER);
  const scaled = Math.round(amount * multiplier * 1_000_000) / 1_000_000;
  const threshold = boss.thresholds[boss.phaseIndex];
  const floor = Math.max(threshold ?? 0, environmental ? 1 : 0);
  const applied = Math.max(0, Math.min(scaled, boss.health - floor));
  boss.health -= applied;
  let phaseCrossed = null;
  if (threshold !== undefined && boss.health <= threshold) {
    boss.phaseIndex += 1;
    boss.phaseId = definition.phases[boss.phaseIndex].id;
    boss.haltFrom = tick;
    boss.haltUntil = tick + DISTRICT_BOSS_PHASE_HALT_TICKS;
    boss.pendingAttacks = [];
    boss.motion = null;
    boss.staggerUntil = -1;
    boss.opener = definition.phaseOpeners[boss.phaseIndex];
    boss.superNextTick = Infinity;
    boss.nextActionTick = boss.haltUntil + 1;
    phaseCrossed = boss.phaseId;
    boss.pendingEvents.push({ type: 'halt', bossId: boss.bossId, phaseId: boss.phaseId, tick, untilTick: boss.haltUntil, elapsedTick: tick - boss.startTick });
  }
  if (boss.health > 0) return freezeDeep({ defeated: false, damageApplied: applied, remainingHealth: boss.health, runEvent: null, reason: null, phaseCrossed });
  boss.active = false;
  boss.defeated = true;
  boss.defeatedTick = tick;
  boss.pendingAttacks = [];
  boss.motion = null;
  let runEvent = null;
  if (!boss.defeatEventEmitted) {
    boss.defeatEventEmitted = true;
    runEvent = freezeDeep({ type: 'game:run-event', name: 'boss-defeated', data: { bossId: boss.id, tick, elapsedTicks: tick - boss.startTick } });
  }
  return freezeDeep({ defeated: true, damageApplied: applied, remainingHealth: 0, runEvent, reason: null, phaseCrossed });
}

// Binds one definition into the liquidator-shaped API a slot expects.
export function bindDistrictBoss(definition) {
  return Object.freeze({
    definition,
    create: (options) => createDistrictBoss(definition, options),
    step: (options) => stepDistrictBoss(definition, options),
    applyDamage: (options) => applyDistrictBossDamage(definition, options),
    resolveAttack: resolveDistrictBossAttack,
    isTargetable: isDistrictBossTargetable,
    vulnerability: getDistrictBossVulnerability,
    strikes: (attackId, context) => districtBossStrikes(definition, attackId, context),
    openArena: (centre) => districtBossOpenArena(definition, centre),
  });
}
