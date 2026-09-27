// Wave-1 evolution effects that run beside the weapon step (design package
// 8.5, build ledger slice 7). Lazy: main.mjs loads it with the boss modules,
// before any session starts, so the fixed step only ever calls resident code.
//
// - Crypto Bomb Orbit: the bomblet pool. Every blast of the player's grenades
//   leaves three bomblets orbiting the blast point; each detonates on its
//   first contact with an enemy body or at the end of its orbit, never on the
//   player. Contacts resolve bomblets by id, then enemies by id.
// - Hashstorm Overdrive: the vent ring's hits.
// - Crit Candle: the first-body crit that carries through a pierced lane.
// - The bomblet feedback budget (projection only).
//
// Everything here is a pure function of its arguments: no RNG but the seeded
// crit roll the combat resolver itself makes, no clock, no DOM.
import { seededUnit } from './deterministic-hash.mjs';
import { freezeDeep } from './value-guards.mjs';
import { HMH_EVOLUTION_TUNING } from './evolution-tuning.mjs';

const ORBIT = HMH_EVOLUTION_TUNING['crypto-bomb-orbit'];
const CANDLE = HMH_EVOLUTION_TUNING['crit-candle'];
// A bomblet's own body: it touches an enemy when their disks overlap.
export const BOMBLET_CONTACT_RADIUS = 6;
const BOMBLET_KNOCKBACK = 12;
const TAU = Math.PI * 2;

const byId = (left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

export function createBombletPool() {
  return { active: [], spawned: 0, overflow: 0, detonated: 0 };
}

// Three bomblets per blast, up to the pool cap; the rest are counted.
export function spawnBomblets(pool, { tick, parentId, centre, parentDamage }) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('bomblet tick must be a non-negative integer');
  if (typeof parentId !== 'string' || !parentId) throw new TypeError('bomblet parent id is required');
  if (!(parentDamage > 0)) throw new TypeError('bomblet parent damage must be positive');
  let spawned = 0;
  for (let k = 0; k < ORBIT.count; k += 1) {
    if (pool.active.length >= ORBIT.poolCap) {
      pool.overflow += 1;
      continue;
    }
    pool.active.push({ id: `${parentId}:b${k}`, k, spawnTick: tick, centre: { x: centre.x, y: centre.y, z: centre.z ?? 0 }, damage: Math.max(1, Math.round(parentDamage * ORBIT.damageScale)) });
    spawned += 1;
  }
  pool.spawned += spawned;
  pool.active.sort(byId);
  return { spawned, overflow: ORBIT.count - spawned };
}

// Angle 2πk/3 + 2π(t − t0)/45 on a circle of 100 around the blast point.
export function bombletPosition(bomblet, tick) {
  const angle = TAU * bomblet.k / ORBIT.count + TAU * (tick - bomblet.spawnTick) / ORBIT.lifeTicks;
  return { x: bomblet.centre.x + ORBIT.orbitRadius * Math.cos(angle), y: bomblet.centre.y + ORBIT.orbitRadius * Math.sin(angle), z: bomblet.centre.z };
}

// targets: [{id, x, y, radius}], the player included (it is skipped). A
// bomblet steps from the tick after its blast.
export function stepBomblets(pool, { tick, targets = [] }) {
  const enemies = targets.filter((target) => target.id !== 'player').sort(byId);
  const detonations = [];
  const survivors = [];
  for (const bomblet of pool.active) {
    if (tick <= bomblet.spawnTick) {
      survivors.push(bomblet);
      continue;
    }
    const point = bombletPosition(bomblet, tick);
    const contact = enemies.find((target) => Math.hypot(target.x - point.x, target.y - point.y) <= target.radius + BOMBLET_CONTACT_RADIUS);
    const expired = tick - bomblet.spawnTick >= ORBIT.lifeTicks;
    if (!contact && !expired) {
      survivors.push(bomblet);
      continue;
    }
    const hits = enemies
      .filter((target) => Math.hypot(target.x - point.x, target.y - point.y) <= ORBIT.blastRadius + target.radius)
      .map((target) => {
        const dx = target.x - point.x;
        const dy = target.y - point.y;
        const length = Math.hypot(dx, dy);
        return {
          id: `${bomblet.id}:${target.id}`, tick, time: 0, targetId: target.id, sourceId: 'player', weaponId: 'launcher-rig',
          damage: bomblet.damage, direction: length > 1e-9 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 },
          knockback: BOMBLET_KNOCKBACK, point: { ...point },
        };
      });
    detonations.push({ bombletId: bomblet.id, tick, reason: contact ? 'contact' : 'end', contactId: contact?.id ?? null, point, radius: ORBIT.blastRadius, hits });
  }
  pool.detonated += detonations.length;
  pool.active = survivors;
  return freezeDeep({ tick, detonations });
}

// Hashstorm Overdrive's vent: every enemy body within the ring, never the
// player. targets: [{id, x, y, radius}].
export function ventRingHits(vent, { origin, targets = [] }) {
  return targets
    .filter((target) => target.id !== 'player' && Math.hypot(target.x - origin.x, target.y - origin.y) <= vent.radius + (target.radius ?? 0))
    .sort(byId)
    .map((target) => {
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      const length = Math.hypot(dx, dy);
      return freezeDeep({
        id: `${vent.attackId}:${target.id}`, tick: vent.tick, time: 0, targetId: target.id, sourceId: 'player', weaponId: vent.weaponId,
        damage: vent.damage, criticalChance: 0, criticalMultiplier: 1, armorPiercing: false,
        direction: length > 1e-9 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 },
        knockback: vent.knockback, point: { x: target.x, y: target.y, z: (origin.z ?? 0) + 24 },
      });
    });
}

// Crit Candle's chance for one hit of a gold-crit slug: +15% under the cap. The
// slug's first body rolls exactly as the combat resolver will (the same key),
// and when it crits every later body of the slug crits (chance 1). The result
// is kept on the shot, which main.mjs carries across its flight segments.
export function critCandleHitChance({ chance, cap, shot, seed, hitId, targetId }) {
  const criticalChance = Math.min(cap, chance + CANDLE.chanceBonus);
  if (typeof hitId !== 'string') return { criticalChance };
  if (shot.candleCrit === undefined) {
    shot.candleCrit = seededUnit(seed, `critical:${hitId}:${targetId}`) < criticalChance;
    return { criticalChance };
  }
  return { criticalChance: shot.candleCrit ? 1 : criticalChance };
}

// Bomblet feedback (projection): its own class inside the grenade FX caps, at
// most 4 bursts drawn per tick and 2 detonation cues per 6 ticks.
export const BOMBLET_FEEDBACK_LIMITS = Object.freeze({ burstsPerTick: 4, cuesPerWindow: 2, cueWindowTicks: 6 });

export function createBombletFeedbackBudget() {
  return { tick: -1, bursts: 0, cueTicks: [] };
}

export function takeBombletFeedback(budget, { tick, count }) {
  if (budget.tick !== tick) {
    budget.tick = tick;
    budget.bursts = 0;
  }
  const bursts = Math.max(0, Math.min(count, BOMBLET_FEEDBACK_LIMITS.burstsPerTick - budget.bursts));
  budget.bursts += bursts;
  budget.cueTicks = budget.cueTicks.filter((cueTick) => cueTick > tick - BOMBLET_FEEDBACK_LIMITS.cueWindowTicks);
  const cues = bursts > 0 && budget.cueTicks.length < BOMBLET_FEEDBACK_LIMITS.cuesPerWindow && !budget.cueTicks.includes(tick) ? 1 : 0;
  if (cues) budget.cueTicks.push(tick);
  return { bursts, cues };
}
