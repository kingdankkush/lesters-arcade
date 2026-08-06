import { freezeDeep } from './value-guards.mjs';
const UINT32_MAX = 0xffff_ffff;
const EPSILON = 1e-12;


import { finite } from './value-guards.mjs';

function nonNegative(value, name) {
  finite(value, name);
  if (value < 0) throw new TypeError(`${name} must be non-negative`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

function validSeed(value) {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) throw new TypeError('seed must be an unsigned 32-bit integer');
  return value >>> 0;
}

function seededUnit(seed, key) {
  let hash = (validSeed(seed) ^ 0x811c9dc5) >>> 0;
  for (const character of String(key)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}

function normalize(direction, fallbackId) {
  const x = finite(direction?.x ?? 0, 'hit direction.x');
  const y = finite(direction?.y ?? 0, 'hit direction.y');
  const magnitude = Math.hypot(x, y);
  if (magnitude > EPSILON) return { x: x / magnitude, y: y / magnitude };
  let hash = 2166136261;
  for (const character of String(fallbackId)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const angle = hash / 0x1_0000_0000 * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function stableHitOrder(a, b) {
  return a.tick - b.tick || a.time - b.time || a.id.localeCompare(b.id) || a.targetId.localeCompare(b.targetId);
}

function cloneTarget(target) {
  if (typeof target?.id !== 'string' || !target.id) throw new TypeError('target id must be a non-empty string');
  const maxHealth = positive(target.maxHealth ?? target.health, `target ${target.id} maxHealth`);
  const health = nonNegative(target.health, `target ${target.id} health`);
  if (health > maxHealth) throw new TypeError(`target ${target.id} health exceeds maxHealth`);
  const armor = positive(target.armor ?? 1, `target ${target.id} armor`);
  const shieldCharges = nonNegative(target.shieldCharges ?? 0, `target ${target.id} shieldCharges`);
  if (!Number.isInteger(shieldCharges)) throw new TypeError(`target ${target.id} shieldCharges must be an integer`);
  // Resistance divides the applied impulse, so zero is not a meaningful
  // "immovable" value — it would launch the target instead. Like armor, it
  // must be strictly positive.
  const knockbackResistance = positive(target.knockbackResistance ?? 1, `target ${target.id} knockbackResistance`);
  return {
    id: target.id,
    health,
    maxHealth,
    armor,
    shieldCharges,
    knockbackResistance,
    active: target.active !== false && health > 0,
  };
}

function validateHit(hit) {
  if (typeof hit?.id !== 'string' || !hit.id) throw new TypeError('hit id must be a non-empty string');
  if (typeof hit.targetId !== 'string' || !hit.targetId) throw new TypeError(`hit ${hit.id} targetId is required`);
  if (typeof hit.sourceId !== 'string' || !hit.sourceId) throw new TypeError(`hit ${hit.id} sourceId is required`);
  if (typeof hit.weaponId !== 'string' || !hit.weaponId) throw new TypeError(`hit ${hit.id} weaponId is required`);
  if (!Number.isInteger(hit.tick ?? 0) || (hit.tick ?? 0) < 0) throw new TypeError(`hit ${hit.id} tick must be a non-negative integer`);
  const time = finite(hit.time ?? 0, `hit ${hit.id} time`);
  if (time < 0 || time > 1) throw new TypeError(`hit ${hit.id} time must be in [0, 1]`);
  positive(hit.damage, `hit ${hit.id} damage`);
  const criticalChance = nonNegative(hit.criticalChance ?? 0.08, `hit ${hit.id} criticalChance`);
  if (criticalChance > 1) throw new TypeError(`hit ${hit.id} criticalChance must not exceed one`);
  positive(hit.criticalMultiplier ?? 1.75, `hit ${hit.id} criticalMultiplier`);
  nonNegative(hit.knockback ?? 0, `hit ${hit.id} knockback`);
  return { ...hit, tick: hit.tick ?? 0, time, criticalChance };
}

export function expectedCombatHitDamage({
  damage,
  armor = 1,
  armorPiercing = false,
  criticalChance,
  criticalMultiplier,
  critChance,
  critMultiplier,
} = {}) {
  const baseDamage = positive(damage, 'damage');
  const armorDivisor = armorPiercing === true ? 1 : positive(armor, 'armor');
  const chance = Math.min(1, nonNegative(criticalChance ?? critChance ?? 0.08, 'criticalChance'));
  const multiplier = positive(criticalMultiplier ?? critMultiplier ?? 1.75, 'criticalMultiplier');
  const normalDamage = Math.max(1, Math.round(baseDamage / armorDivisor));
  const criticalDamage = Math.max(1, Math.round(baseDamage * multiplier / armorDivisor));
  return normalDamage * (1 - chance) + criticalDamage * chance;
}

export function resolveCombatHits({ sessionSeed, hits = [], targets = [] } = {}) {
  validSeed(sessionSeed);
  if (!Array.isArray(hits) || !Array.isArray(targets)) throw new TypeError('hits and targets must be arrays');
  const targetIds = new Set();
  const targetState = {};
  for (const target of [...targets].sort((a, b) => String(a?.id).localeCompare(String(b?.id)))) {
    const clone = cloneTarget(target);
    if (targetIds.has(clone.id)) throw new TypeError(`duplicate target ${clone.id}`);
    targetIds.add(clone.id);
    targetState[clone.id] = clone;
  }
  const hitIds = new Set();
  const orderedHits = hits.map(validateHit).sort(stableHitOrder);
  for (const hit of orderedHits) {
    if (hitIds.has(hit.id)) throw new TypeError(`duplicate hit ${hit.id}`);
    hitIds.add(hit.id);
    if (!targetState[hit.targetId]) throw new TypeError(`hit ${hit.id} references unknown target ${hit.targetId}`);
  }

  const damageEvents = [];
  const deathEvents = [];
  const scoreEvents = [];
  for (const hit of orderedHits) {
    const target = targetState[hit.targetId];
    if (!target.active || target.health <= 0) continue;
    const healthBefore = target.health;
    const shieldBefore = target.shieldCharges;
    const critical = seededUnit(sessionSeed, `critical:${hit.id}:${hit.targetId}`) < hit.criticalChance;
    const rawDamage = hit.damage * (critical ? (hit.criticalMultiplier ?? 1.75) : 1);
    let damageApplied = 0;
    let shielded = false;
    if (target.shieldCharges > 0) {
      target.shieldCharges -= 1;
      shielded = true;
    } else {
      const armorDivisor = hit.armorPiercing === true ? 1 : target.armor;
      damageApplied = Math.max(1, Math.round(rawDamage / armorDivisor));
      target.health = Math.max(0, target.health - damageApplied);
    }
    const killed = healthBefore > 0 && target.health <= 0;
    if (killed) target.active = false;
    const direction = normalize(hit.direction, hit.id);
    // Resistance divides: a heavier, more resistant target must be pushed less
    // by the same impulse, not more.
    const knockbackMagnitude = shielded || damageApplied <= 0
      ? 0
      : (hit.knockback ?? 0) / Math.max(EPSILON, target.knockbackResistance);
    const damageEvent = freezeDeep({
      type: 'combat:damage',
      hitId: hit.id,
      tick: hit.tick,
      targetId: target.id,
      sourceId: hit.sourceId,
      weaponId: hit.weaponId,
      critical,
      shielded,
      armorPiercing: hit.armorPiercing === true,
      rawDamage,
      damageApplied,
      healthBefore,
      healthAfter: target.health,
      shieldChargesBefore: shieldBefore,
      shieldChargesAfter: target.shieldCharges,
      killed,
      point: hit.point ? freezeDeep({ x: finite(hit.point.x, 'hit point.x'), y: finite(hit.point.y, 'hit point.y'), z: finite(hit.point.z ?? 0, 'hit point.z') }) : null,
      knockback: freezeDeep({ x: direction.x * knockbackMagnitude, y: direction.y * knockbackMagnitude }),
    });
    damageEvents.push(damageEvent);
    if (killed) {
      deathEvents.push(freezeDeep({
        type: 'combat:death',
        eventId: `death:${hit.id}:${target.id}`,
        tick: hit.tick,
        enemyId: target.id,
        sourceId: hit.sourceId,
        weaponId: hit.weaponId,
        critical,
      }));
      // This event is an authority request only. Numeric scoring stays in the parent.
      scoreEvents.push(freezeDeep({
        type: 'enemy:defeated',
        eventId: `defeat:${hit.id}:${target.id}`,
        enemyId: target.id,
        sourceId: hit.sourceId,
        weaponId: hit.weaponId,
        critical,
      }));
    }
  }

  return freezeDeep({
    targets: targetState,
    damageEvents,
    deathEvents,
    scoreEvents,
  });
}
