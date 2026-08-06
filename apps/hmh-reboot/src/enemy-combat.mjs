import { freezeDeep } from './value-guards.mjs';
import { getEnemyArchetype } from './enemy-archetypes.mjs';
import { allocateAttackTokens, DEFAULT_ATTACK_TOKEN_BUDGET } from './enemy-simulation.mjs';
import { traceHeightAwareLineOfSight } from './elevation.mjs';

const EPSILON = 1e-9;
export const MAX_ENEMY_ATTACK_EVENTS = 64;
// The strike pose is carved out of the front of recovery, so the total
// tell -> ready cycle length (and therefore encounter pacing) is unchanged.
export const ENEMY_STRIKE_TICKS = 6;
// Same-tick tells from several melee attackers resolve together and stack
// unavoidable damage. Each additional attacker starting a tell on one tick is
// pushed back by this many ticks so the player can read and react to them.
export const ENEMY_TELL_STAGGER_TICKS = 9;
export const ENEMY_SUPPORT_ARMOR_MULTIPLIER = 1.15;
export const ENEMY_SUPPORT_ARMOR_DURATION_TICKS = 180;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}


function point(value, name) {
  return {
    x: finite(value?.x, `${name}.x`),
    y: finite(value?.y, `${name}.y`),
    groundZ: finite(value?.groundZ ?? 0, `${name}.groundZ`),
  };
}

function pointSegmentDistance(position, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(position.x - from.x, position.y - from.y);
  const time = Math.max(0, Math.min(1, ((position.x - from.x) * dx + (position.y - from.y) * dy) / lengthSquared));
  return Math.hypot(position.x - (from.x + dx * time), position.y - (from.y + dy * time));
}

function createAttackGeometry(enemy, archetype, target) {
  const origin = point(enemy, 'enemy');
  if (archetype.attack.tokenFamily === 'support') {
    return freezeDeep({ type: 'support-ring', center: target, radius: 140 });
  }
  if (archetype.attack.tokenFamily === 'area') {
    return freezeDeep({ type: 'area-circle', center: target, radius: 96 });
  }
  if (archetype.attack.tokenFamily === 'ranged') {
    return freezeDeep({ type: 'lane', from: origin, to: target, halfWidth: 18 });
  }
  if (archetype.role === 'bruiser') {
    return freezeDeep({ type: 'shove-lane', from: origin, to: target, halfWidth: 46, reach: archetype.attack.range });
  }
  return freezeDeep({ type: 'melee-circle', center: origin, radius: archetype.attack.range });
}

function createAttackEvent(enemy, archetype, tick) {
  const target = point(enemy.telegraphTarget, 'telegraphTarget');
  return freezeDeep({
    type: 'enemy:attack',
    attackId: `${enemy.id}:${enemy.attackTellStartedTick}:${tick}`,
    enemyId: enemy.id,
    archetypeId: archetype.id,
    role: archetype.role,
    tokenFamily: archetype.attack.tokenFamily,
    tick,
    tellStartedTick: enemy.attackTellStartedTick,
    origin: point(enemy, 'enemy'),
    target,
    damage: archetype.attack.damage,
    geometry: createAttackGeometry(enemy, archetype, target),
  });
}

function clearTelegraph(enemy) {
  enemy.telegraphTarget = null;
  enemy.attackTellStartedTick = null;
}

function expireSupportArmor(enemy, tick) {
  const baseArmor = Number.isFinite(enemy.baseArmor) ? enemy.baseArmor : enemy.armor;
  enemy.baseArmor = baseArmor;
  if ((enemy.supportArmorUntilTick ?? 0) > tick) return;
  enemy.armor = baseArmor;
  enemy.supportArmorUntilTick = 0;
}

function supportTargetFor(enemy, enemies, fallback) {
  const ally = enemies
    .filter((candidate) => candidate.id !== enemy.id && getEnemyArchetype(candidate.archetypeId).role !== 'support')
    .map((candidate) => ({ candidate, distance: Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) }))
    .sort((a, b) => a.distance - b.distance || a.candidate.id.localeCompare(b.candidate.id))[0]?.candidate;
  return ally ? point(ally, 'supportTarget') : fallback;
}

function applySupportArmorPulse(event, enemies, tick) {
  const affected = enemies.filter((enemy) => Math.hypot(enemy.x - event.geometry.center.x, enemy.y - event.geometry.center.y) <= event.geometry.radius);
  for (const enemy of affected) {
    const baseArmor = Number.isFinite(enemy.baseArmor) ? enemy.baseArmor : enemy.armor;
    enemy.baseArmor = baseArmor;
    enemy.armor = baseArmor * ENEMY_SUPPORT_ARMOR_MULTIPLIER;
    enemy.supportArmorUntilTick = Math.max(enemy.supportArmorUntilTick ?? 0, tick + ENEMY_SUPPORT_ARMOR_DURATION_TICKS);
  }
  return freezeDeep({
    ...event,
    effect: {
      kind: 'formation-armor',
      multiplier: ENEMY_SUPPORT_ARMOR_MULTIPLIER,
      durationTicks: ENEMY_SUPPORT_ARMOR_DURATION_TICKS,
      affectedEnemyIds: affected.map((enemy) => enemy.id),
    },
  });
}

export function stepEnemyAttacks({
  enemies,
  player,
  tick,
  budgets = DEFAULT_ATTACK_TOKEN_BUDGET,
} = {}) {
  if (!Array.isArray(enemies)) throw new TypeError('enemies must be an array');
  nonNegativeInteger(tick, 'tick');
  const playerPoint = point(player, 'player');
  const ordered = enemies.filter((enemy) => enemy?.active && enemy.health > 0).sort((a, b) => a.id.localeCompare(b.id));
  for (const enemy of ordered) expireSupportArmor(enemy, tick);
  const tokenMap = allocateAttackTokens({ enemies: ordered, player: playerPoint, budgets });
  const events = [];
  let droppedEvents = 0;
  let tellsStartedThisTick = 0;

  for (const enemy of ordered) {
    const archetype = getEnemyArchetype(enemy.archetypeId);
    const hasToken = tokenMap.get(enemy.id) === archetype.attack.tokenFamily;
    const distance = Math.hypot(enemy.x - playerPoint.x, enemy.y - playerPoint.y);

    if (enemy.attackPhase === 'tell' && !hasToken) {
      enemy.attackPhase = 'ready';
      enemy.attackPhaseUntilTick = tick;
      clearTelegraph(enemy);
      continue;
    }

    // An enemy that has already committed its strike must still pay the
    // authored recovery even if it loses its token — dashing out of its
    // reserve range is exactly how the player earns that punish window.
    if (enemy.attackPhase === 'attack' && !hasToken) {
      enemy.attackPhase = 'recovery';
      enemy.attackPhaseUntilTick = enemy.attackRecoveryUntilTick ?? tick;
      clearTelegraph(enemy);
      continue;
    }

    if (enemy.attackPhase === 'tell') {
      if (tick < enemy.attackPhaseUntilTick) continue;
      const baseEvent = createAttackEvent(enemy, archetype, tick);
      const event = archetype.attack.tokenFamily === 'support'
        ? applySupportArmorPulse(baseEvent, ordered, tick)
        : baseEvent;
      if (events.length < MAX_ENEMY_ATTACK_EVENTS) events.push(event);
      else droppedEvents += 1;
      const strikeTicks = Math.min(ENEMY_STRIKE_TICKS, archetype.attack.recoveryTicks);
      enemy.attackPhase = 'attack';
      enemy.attackPhaseUntilTick = tick + strikeTicks;
      enemy.attackRecoveryUntilTick = tick + archetype.attack.recoveryTicks;
      clearTelegraph(enemy);
      continue;
    }

    if (enemy.attackPhase === 'attack') {
      if (tick < enemy.attackPhaseUntilTick) continue;
      enemy.attackPhase = 'recovery';
      enemy.attackPhaseUntilTick = enemy.attackRecoveryUntilTick ?? tick;
    }

    if (enemy.attackPhase === 'recovery') {
      if (tick < enemy.attackPhaseUntilTick) continue;
      enemy.attackPhase = 'ready';
      enemy.attackPhaseUntilTick = tick;
      clearTelegraph(enemy);
    }

    if (enemy.attackPhase !== 'ready' || !hasToken || distance > archetype.attack.range) continue;
    enemy.attackPhase = 'tell';
    enemy.attackTellStartedTick = tick;
    enemy.attackPhaseUntilTick = tick + archetype.attack.tellTicks + tellsStartedThisTick * ENEMY_TELL_STAGGER_TICKS;
    enemy.telegraphTarget = Object.freeze({ ...(archetype.attack.tokenFamily === 'support' ? supportTargetFor(enemy, ordered, playerPoint) : playerPoint) });
    tellsStartedThisTick += 1;
  }

  return freezeDeep({
    tick,
    tokens: [...tokenMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([enemyId, family]) => Object.freeze({ enemyId, family })),
    events,
    droppedEvents,
  });
}

export function resolveEnemyAttackAgainstPlayer(event, { player, invulnerable = false, blockers = [] } = {}) {
  if (!event || typeof event !== 'object') throw new TypeError('enemy attack event is required');
  if (!event.geometry || typeof event.geometry.type !== 'string') throw new TypeError('enemy attack event geometry is required');
  if (typeof invulnerable !== 'boolean') throw new TypeError('invulnerable must be boolean');
  if (!Array.isArray(blockers)) throw new TypeError('blockers must be an array');
  const position = point(player, 'player');
  const radius = finite(player?.radius ?? 0, 'player.radius');
  if (radius < 0) throw new TypeError('player.radius must be non-negative');
  const damage = finite(event.damage, 'event.damage');
  if (damage < 0) throw new TypeError('event.damage must be non-negative');
  if (invulnerable) return freezeDeep({ hit: false, damage: 0, reason: 'invulnerable', enemyId: event.enemyId ?? null, attackId: event.attackId ?? null });
  if (event.geometry.type === 'support-ring' || damage === 0) {
    return freezeDeep({ hit: false, damage: 0, reason: 'non-damaging', enemyId: event.enemyId ?? null, attackId: event.attackId ?? null });
  }
  if (event.geometry.type === 'lane' && blockers.length > 0) {
    const from = point(event.geometry.from, 'geometry.from');
    const to = point(event.geometry.to, 'geometry.to');
    const lineOfSight = traceHeightAwareLineOfSight({
      from: { x: from.x, y: from.y, z: from.groundZ + 24 },
      to: { x: to.x, y: to.y, z: to.groundZ + 24 },
      radius: 2,
      blockers,
    });
    if (!lineOfSight.clear) {
      return freezeDeep({ hit: false, damage: 0, reason: 'cover', blockerId: lineOfSight.blockerId, enemyId: event.enemyId ?? null, attackId: event.attackId ?? null });
    }
  }

  let hit = false;
  if (event.geometry.type === 'melee-circle' || event.geometry.type === 'area-circle') {
    const center = point(event.geometry.center, 'geometry.center');
    const reach = finite(event.geometry.radius, 'geometry.radius') + radius;
    hit = Math.hypot(position.x - center.x, position.y - center.y) <= reach + EPSILON;
  } else if (event.geometry.type === 'lane' || event.geometry.type === 'shove-lane') {
    const from = point(event.geometry.from, 'geometry.from');
    const to = point(event.geometry.to, 'geometry.to');
    const width = finite(event.geometry.halfWidth, 'geometry.halfWidth') + radius;
    hit = pointSegmentDistance(position, from, to) <= width + EPSILON;
  } else {
    throw new TypeError(`Unsupported enemy attack geometry: ${event.geometry.type}`);
  }
  return freezeDeep({
    hit,
    damage: hit ? damage : 0,
    reason: hit ? 'hit' : 'evaded',
    enemyId: event.enemyId ?? null,
    attackId: event.attackId ?? null,
  });
}
