// Enemy AI kit (Level 1 design package S1.2, sections 5.2 and 6, plus the
// 2026-09-26 survey additions E2, E3 and B4). Runtime authority: SIMULATION.
//
// Loaded lazily through main.mjs's loadLazyRuntimeModules, like the boss and
// mission modules: boot() awaits it before any session can start, so the
// fixed-step simulation only ever calls resident, synchronous code. The static
// enemy modules (enemy-simulation, enemy-combat, encounter-director and
// automatic-actions) take this module as an optional `kit` argument; without
// it they behave exactly as before, which keeps the pinned 1.8.x corpora and
// the progression model's 1.8.1 baseline reproducible.
//
// Nothing here reads a clock, the camera, quality or Math.random: every choice
// is a pure function of simulation state, the tick and the run seed.
import { freezeDeep } from './value-guards.mjs';
import { seededUnit } from './deterministic-hash.mjs';
import { resolveSweptCircleMotion } from './collision.mjs';
import { resolveSweptTraversalPath } from './elevation.mjs';
import { ENEMY_ARCHETYPES, getEnemyArchetype, hasBehaviourFlag } from './enemy-archetypes.mjs';

export const ENEMY_AI_KIT_VERSION = 'hmh-enemy-ai-kit/v1';
const EPSILON = 1e-9;
const TAU = Math.PI * 2;

const normalize = (x, y) => {
  const length = Math.hypot(x, y);
  return length <= EPSILON ? { x: 1, y: 0 } : { x: x / length, y: y / length };
};
const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared <= EPSILON ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};
const flat = (point) => ({ x: point.x, y: point.y, groundZ: point.groundZ ?? 0 });

// ---------------------------------------------------------------------------
// f. Attack geometries. Every telegraph is drawn from the same object the
// strike resolves against (the tell locks it), so a telegraph equals its
// hitbox, and the automatic dodge reads the same shape (inflated by the body).
// ---------------------------------------------------------------------------
export const ENEMY_LANE_GEOMETRIES = Object.freeze(['lane', 'shove-lane', 'rug-lane', 'tracking-lane', 'volley']);
export const ENEMY_CIRCLE_GEOMETRIES = Object.freeze(['melee-circle', 'area-circle', 'offset-circle', 'support-ring']);
export const ENEMY_KIT_GEOMETRIES = Object.freeze([...ENEMY_LANE_GEOMETRIES, ...ENEMY_CIRCLE_GEOMETRIES, 'cone']);
// Lanes a bullet travels (so cover blocks them); a rug and a shove are ground.
export const ENEMY_PROJECTILE_LANES = Object.freeze(['lane', 'tracking-lane', 'volley']);

// True when a disk of `radius` at `p` overlaps the geometry.
export function enemyGeometryContains(geometry, p, radius = 0) {
  const type = geometry?.type;
  if (ENEMY_LANE_GEOMETRIES.includes(type)) return segmentDistance(p, geometry.from, geometry.to) <= geometry.halfWidth + radius + EPSILON;
  if (ENEMY_CIRCLE_GEOMETRIES.includes(type)) return Math.hypot(p.x - geometry.center.x, p.y - geometry.center.y) <= geometry.radius + radius + EPSILON;
  if (type === 'cone') {
    const dx = p.x - geometry.origin.x;
    const dy = p.y - geometry.origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= radius) return true;
    if (distance > geometry.range + radius + EPSILON) return false;
    const cos = (dx * geometry.direction.x + dy * geometry.direction.y) / distance;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    return angle <= geometry.halfAngle + Math.asin(Math.min(1, radius / distance)) + EPSILON;
  }
  throw new TypeError(`Unsupported enemy attack geometry: ${String(type)}`);
}

// The automatic dodge's danger predicate for a locked tell (5.2f: the lane
// width is the geometry's own, no longer a fixed 18).
export function enemyTellDanger(geometry, bodyRadius) {
  if (!geometry || geometry.type === 'support-ring') return null;
  return (point) => enemyGeometryContains(geometry, point, bodyRadius);
}

// Builds one geometry from an archetype's authored `attack.geometry`
// descriptor (new enemies) or from the core-six rules below.
export function buildEnemyAttackGeometry(spec, origin, target) {
  const from = flat(origin);
  const aim = flat(target);
  const direction = normalize(aim.x - from.x, aim.y - from.y);
  const ahead = (distance) => ({ x: from.x + direction.x * distance, y: from.y + direction.y * distance, groundZ: from.groundZ });
  switch (spec.type) {
    case 'melee-circle': return freezeDeep({ type: 'melee-circle', center: from, radius: spec.radius });
    case 'area-circle': return freezeDeep({ type: 'area-circle', center: aim, radius: spec.radius });
    case 'support-ring': return freezeDeep({ type: 'support-ring', center: aim, radius: spec.radius });
    case 'offset-circle': return freezeDeep({ type: 'offset-circle', center: ahead(spec.offset), radius: spec.radius });
    case 'cone': return freezeDeep({ type: 'cone', origin: from, direction, halfAngle: spec.halfAngle, range: spec.range });
    case 'lane': return freezeDeep({ type: 'lane', from, to: spec.length ? ahead(spec.length) : aim, halfWidth: spec.halfWidth });
    case 'shove-lane': return freezeDeep({ type: 'shove-lane', from, to: ahead(spec.length), halfWidth: spec.halfWidth, ...(spec.rush ? { rush: spec.rush } : {}) });
    case 'rug-lane': return freezeDeep({ type: 'rug-lane', from, to: ahead(spec.length), halfWidth: spec.halfWidth, pull: spec.pull ?? 0 });
    case 'tracking-lane': return freezeDeep({ type: 'tracking-lane', from, to: ahead(spec.length), halfWidth: spec.halfWidth, direction, length: spec.length, trackTicks: spec.trackTicks ?? 0, turnRadiansPerTick: spec.turnRadiansPerTick ?? 0.05 });
    case 'volley': return freezeDeep({ type: 'volley', from, to: aim, halfWidth: spec.halfWidth, rounds: spec.damages.length, intervalTicks: spec.intervalTicks, damages: [...spec.damages] });
    default: throw new TypeError(`Unsupported enemy attack geometry: ${String(spec?.type)}`);
  }
}

// ---------------------------------------------------------------------------
// Core-six attack rules (section 6).
// ---------------------------------------------------------------------------
// The Agent: a three-round burst at mid range (each kick inside the 6-tick
// strike, 4 + 3 + 3 = the authored 10), otherwise one aimed shot.
export const AGENT_BURST_RANGE = 480;
export const AGENT_BURST = Object.freeze({ type: 'volley', halfWidth: 18, intervalTicks: 2, damages: Object.freeze([4, 3, 3]) });
// The Whale's Shoulder Rush: a locked lane 46 wide that rushes up to 220 and
// stops at the first blocker, where the Whale stumbles for 30 ticks.
export const WHALE_RUSH = Object.freeze({ length: 220, halfWidth: 23, stumbleTicks: 30 });
// The Validator buffs a HODL Revenant first, then the Foreman (B3), then the
// nearest ally; it no longer rings the player when it has no ally.
export const VALIDATOR_PRIORITY = Object.freeze(['hodl-revenant', 'boss-fifty-one-percent-foreman']);

function coreTellSpec(archetype, enemy, target, context) {
  const authored = archetype.attack.geometry;
  if (authored) return authored;
  const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
  if (archetype.id === 'liquidator-agent') return distance <= AGENT_BURST_RANGE ? AGENT_BURST : { type: 'lane', halfWidth: 18 };
  if (archetype.id === 'whale-enforcer') {
    const direction = normalize(target.x - enemy.x, target.y - enemy.y);
    const probe = context?.probeLane ? context.probeLane(enemy, direction, WHALE_RUSH.length) : WHALE_RUSH.length;
    const length = Math.max(0, Math.min(WHALE_RUSH.length, probe));
    return { type: 'shove-lane', length, halfWidth: WHALE_RUSH.halfWidth, rush: { length, blocked: length < WHALE_RUSH.length - EPSILON } };
  }
  const family = archetype.attack.tokenFamily;
  if (family === 'support') return { type: 'support-ring', radius: 140 };
  if (family === 'area') return { type: 'area-circle', radius: 96 };
  if (family === 'ranged') return { type: 'lane', halfWidth: 18 };
  return { type: 'melee-circle', radius: archetype.attack.range };
}

function supportTarget(enemy, allies) {
  let best = null;
  for (const ally of allies) {
    if (ally === enemy || ally.id === enemy.id || !ally.active || ally.health <= 0) continue;
    const archetype = ENEMY_ARCHETYPES[ally.archetypeId];
    if (archetype?.attack.tokenFamily === 'support') continue;
    const priority = VALIDATOR_PRIORITY.indexOf(ally.archetypeId);
    const rank = priority < 0 ? VALIDATOR_PRIORITY.length : priority;
    const distance = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
    if (!best || rank < best.rank || (rank === best.rank && (distance < best.distance || (distance === best.distance && ally.id < best.ally.id)))) best = { ally, rank, distance };
  }
  return best?.ally ?? null;
}

// Called by stepEnemyAttacks when a ready enemy holding a token is in range.
// Returns { target, geometry } to start the tell, or null to hold it (no line
// of sight for a ranged or area tell, no ally for a support tell, or the
// archetype's concurrent-tell cap).
export function planEnemyTell({ enemy, archetype, player, tick, allies, context = null, tellsByArchetype = null }) {
  const cap = archetype.behavior?.maxConcurrentTells;
  if (Number.isInteger(cap) && (tellsByArchetype?.get(archetype.id) ?? 0) >= cap) return null;
  let target = flat(player);
  if (archetype.attack.tokenFamily === 'support') {
    const ally = supportTarget(enemy, allies);
    if (!ally) return null;
    target = flat(ally);
  } else if ((archetype.attack.tokenFamily === 'ranged' || archetype.attack.tokenFamily === 'area' || archetype.behavior?.losGate === true)
    && context?.lineOfSight && !context.lineOfSight(enemy, target)) {
    // 5.2c: a height-aware line-of-sight gate before every ranged or area
    // tell. The enemy gives its token back for 15 ticks and repositions.
    enemy.losBlockedUntilTick = tick + 15;
    return null;
  }
  const geometry = buildEnemyAttackGeometry(coreTellSpec(archetype, enemy, target, context), enemy, target);
  return { target: Object.freeze(target), geometry };
}

// A tracking lane re-aims toward the hero during its tracking window.
export function trackEnemyTell(enemy, player, tick) {
  const geometry = enemy.tellGeometry;
  if (geometry?.type !== 'tracking-lane' || !Number.isInteger(enemy.attackTellStartedTick) || tick - enemy.attackTellStartedTick >= geometry.trackTicks) return;
  const wanted = Math.atan2(player.y - geometry.from.y, player.x - geometry.from.x);
  const current = Math.atan2(geometry.direction.y, geometry.direction.x);
  let delta = wanted - current;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  const angle = current + Math.max(-geometry.turnRadiansPerTick, Math.min(geometry.turnRadiansPerTick, delta));
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  enemy.tellGeometry = freezeDeep({ ...geometry, direction, to: { x: geometry.from.x + direction.x * geometry.length, y: geometry.from.y + direction.y * geometry.length, groundZ: geometry.from.groundZ } });
}

// The strike: the base event carries the locked geometry. A volley's first
// round takes the first damage and queues the rest; a rush sets the body's
// motion for the strike ticks and, when the lane met a blocker, a stumble.
export function strikeEnemyTell(enemy, archetype, event, tick, strikeTicks) {
  // Section 6: the Bagholder picks its lunge slam or satchel swing by
  // hash(id, tellStartTick) over the same geometry (a projection hint).
  const variants = archetype.behavior?.attackVariants ?? 0;
  if (variants > 1) event = freezeDeep({ ...event, variant: Math.floor(seededUnit(0, `${enemy.id}:${event.tellStartedTick}`) * variants) });
  const geometry = event.geometry;
  if (geometry.type === 'volley') {
    enemy.volley = { round: 1, nextTick: tick + geometry.intervalTicks };
    return [freezeDeep({ ...event, damage: geometry.damages[0], round: 0 })];
  }
  if (geometry.type === 'shove-lane' && geometry.rush) {
    const ticks = Math.max(1, strikeTicks);
    const direction = normalize(geometry.to.x - geometry.from.x, geometry.to.y - geometry.from.y);
    enemy.rush = { x: direction.x * geometry.rush.length / ticks, y: direction.y * geometry.rush.length / ticks, untilTick: tick + ticks };
    if (geometry.rush.blocked) enemy.attackRecoveryUntilTick += WHALE_RUSH.stumbleTicks;
  }
  return [event];
}

// Later volley rounds during the strike, along the same locked lane.
export function followUpEnemyStrike(enemy, event, tick) {
  const volley = enemy.volley;
  const geometry = event?.geometry;
  if (!volley || geometry?.type !== 'volley' || volley.round >= geometry.rounds || tick < volley.nextTick) return [];
  const round = volley.round;
  // Replaced, never mutated: observers may hold frozen copies of the body.
  enemy.volley = { round: round + 1, nextTick: tick + geometry.intervalTicks };
  return [freezeDeep({ ...event, attackId: `${event.attackId}:r${round}`, tick, damage: geometry.damages[round], round })];
}

// The hit test main runs for every enemy strike. Rug lanes also return the
// pull the forced-motion helper applies (toward the rug's owner).
export function resolveEnemyGeometryHit(geometry, player, radius) {
  const hit = enemyGeometryContains(geometry, player, radius);
  if (!hit || geometry.type !== 'rug-lane' || !(geometry.pull > 0)) return { hit, pull: null };
  const direction = normalize(geometry.from.x - player.x, geometry.from.y - player.y);
  return { hit, pull: { x: direction.x * geometry.pull, y: direction.y * geometry.pull } };
}

// ---------------------------------------------------------------------------
// b. Poise and interrupts. Damage taken during a tell accumulates; reaching
// the archetype's poise cancels the tell and staggers the enemy. The stagger
// is shown with the hit pose (no hit clip) and locks movement.
// ---------------------------------------------------------------------------
export function applyEnemyPoiseDamage(enemy, amount, tick) {
  if (enemy?.attackPhase !== 'tell' || !(amount > 0)) return null;
  const behavior = getEnemyArchetype(enemy.archetypeId).behavior;
  if (!(behavior?.poise > 0)) return null;
  enemy.poiseDamage = (enemy.poiseDamage ?? 0) + amount;
  if (enemy.poiseDamage < behavior.poise) return null;
  const staggerTicks = behavior.staggerTicks ?? 24;
  enemy.attackPhase = 'stagger';
  enemy.attackPhaseUntilTick = tick + staggerTicks;
  enemy.telegraphTarget = null;
  enemy.attackTellStartedTick = null;
  enemy.tellGeometry = null;
  enemy.poiseDamage = 0;
  enemy.hitUntilTick = Math.max(enemy.hitUntilTick ?? 0, tick + staggerTicks);
  return freezeDeep({ type: 'enemy:interrupted', enemyId: enemy.id, archetypeId: enemy.archetypeId, tick, untilTick: tick + staggerTicks });
}

// ---------------------------------------------------------------------------
// e. Forced motion: a swept, traversal-checked displacement for a body that is
// shoved (enemy pressure, the dash plough, a rug pull). A shove can slide
// along a wall but never tunnel through one, never drop a body off a ledge
// taller than its own drop limit and never carry it into deep water.
// ---------------------------------------------------------------------------
export function resolveForcedMotion({ body, start, delta, blockers, bounds = null, queryGround, transitionOptions = undefined }) {
  const collision = resolveSweptCircleMotion({ body, start: { x: start.x, y: start.y, z: start.groundZ ?? start.z ?? 0 }, delta, blockers, bounds });
  const traversal = resolveSweptTraversalPath({
    start: { x: start.x, y: start.y },
    end: collision.position,
    queryGround,
    maxSampleDistance: Math.max(4, body.radius * 0.5),
    ...(transitionOptions ? { transitionOptions } : {}),
  });
  return { x: traversal.position.x, y: traversal.position.y, groundZ: traversal.ground.groundZ, allowed: traversal.allowed, contacts: collision.contacts.length };
}

// Enemy body shoved by the hero or the dash: its own movement limits apply.
export function shoveEnemy(enemy, delta, { blockers, bounds, queryGround }) {
  if (!delta || Math.hypot(delta.x, delta.y) <= EPSILON) return;
  const movement = getEnemyArchetype(enemy.archetypeId).movement;
  const result = resolveForcedMotion({
    body: enemy.collisionBody,
    start: enemy,
    delta,
    blockers,
    bounds,
    queryGround,
    transitionOptions: { maxCurbHeight: movement.maxCurbHeight, maxDropHeight: movement.maxDropHeight, maxAuthoredAscent: movement.maxAuthoredAscent },
  });
  enemy.x = result.x;
  enemy.y = result.y;
  enemy.groundZ = result.groundZ;
}

// ---------------------------------------------------------------------------
// E3 persistent approach slots. Each melee body keeps a bearing round the
// hero, seeded from the run seed and its id, that drifts every 180 ticks. The
// slot biases pursuit so a pack arrives from several sides instead of one
// file. A slot that falls on a chokepoint is pushed outward past its mouth
// (the soft outward field), so bodies queue outside a bridge instead of
// jamming its deck.
// ---------------------------------------------------------------------------
export const APPROACH_SLOT_DRIFT_TICKS = 180;
export const APPROACH_SLOT_WEIGHT = 0.45;
export const APPROACH_SLOT_MAX_DISTANCE = 720;
export const CHOKE_OUTWARD_MARGIN = 60;

export function approachSlotAngle(seed, enemy, tick) {
  const base = seededUnit(seed, `slot:${enemy.id}`) * TAU;
  const epoch = Math.floor(Math.max(0, tick - (enemy.spawnedTick ?? 0)) / APPROACH_SLOT_DRIFT_TICKS);
  return base + (seededUnit(seed, `slot:${enemy.id}:${epoch}`) - 0.5) * (Math.PI / 2);
}

export function chokeZone(crossing, margin = 0) {
  const half = crossing.clearWidth / 2 + margin;
  if (crossing.axis === 'x') return { minX: Math.min(crossing.entry.x, crossing.exit.x) - margin, maxX: Math.max(crossing.entry.x, crossing.exit.x) + margin, minY: crossing.entry.y - half, maxY: crossing.entry.y + half };
  return { minX: crossing.entry.x - half, maxX: crossing.entry.x + half, minY: Math.min(crossing.entry.y, crossing.exit.y) - margin, maxY: Math.max(crossing.entry.y, crossing.exit.y) + margin };
}
const inside = (zone, point) => point.x >= zone.minX && point.x <= zone.maxX && point.y >= zone.minY && point.y <= zone.maxY;

export function approachSlotBias(enemy, archetype, player, tick, context) {
  if (archetype.attack.tokenFamily !== 'melee' || hasBehaviourFlag(archetype, 'flankLane') || !Number.isInteger(context?.seed)) return null;
  const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const slotRadius = Math.max(60, archetype.attack.range * 0.8);
  if (distance <= slotRadius + 40 || distance > APPROACH_SLOT_MAX_DISTANCE) return null;
  const angle = approachSlotAngle(context.seed, enemy, tick);
  let slot = { x: player.x + Math.cos(angle) * slotRadius, y: player.y + Math.sin(angle) * slotRadius };
  for (const crossing of context.crossings ?? []) {
    const zone = chokeZone(crossing);
    if (!inside(zone, slot)) continue;
    const centre = { x: (zone.minX + zone.maxX) / 2, y: (zone.minY + zone.maxY) / 2 };
    const out = normalize(slot.x - centre.x, slot.y - centre.y);
    const reach = Math.hypot((zone.maxX - zone.minX) / 2, (zone.maxY - zone.minY) / 2) + CHOKE_OUTWARD_MARGIN;
    slot = { x: centre.x + out.x * reach, y: centre.y + out.y * reach };
  }
  return normalize(slot.x - enemy.x, slot.y - enemy.y);
}

// ---------------------------------------------------------------------------
// g. Director: keyed role weights with district flavour weights (0 = never)
// and seeded shuffling of roles and spawn points (package 2.7 and 5.9).
// ---------------------------------------------------------------------------
export const DISTRICT_ORDER = Object.freeze(['frontier-relay', 'rugpull-ravine', 'liquidity-crossing', 'hashwood', 'mining-camp', 'liquidation-yard']);
export const NEW_ENEMY_ROLES = Object.freeze(['trapper', 'burster', 'warden', 'revenant', 'artillery', 'marksman']);
export const KIT_RANGED_ROLES = Object.freeze(['suppressor', 'demolition', 'support', 'trapper', 'artillery', 'marksman']);
const CORE_DISTRICT_ROLES = Object.freeze({
  'frontier-relay': ['rusher', 'flanker'],
  'rugpull-ravine': ['rusher', 'flanker', 'suppressor'],
  'liquidity-crossing': ['rusher', 'flanker', 'suppressor', 'demolition'],
  hashwood: ['rusher', 'flanker', 'demolition', 'support'],
  'mining-camp': ['rusher', 'flanker', 'suppressor', 'bruiser', 'demolition', 'support'],
  'liquidation-yard': ['rusher', 'flanker', 'suppressor', 'bruiser', 'demolition', 'support'],
});
// Package 5.9, by band: the districts where each new role may appear and its
// weight there (bands inherit the previous band's districts). `pairs` and
// maxAlive belong to the archetype.
const R = 'frontier-relay', V = 'rugpull-ravine', X = 'liquidity-crossing', H = 'hashwood', M = 'mining-camp', Y = 'liquidation-yard';
const ALL = [R, V, X, H, M, Y];
export const NEW_ROLE_DISTRICTS = freezeDeep({
  trapper: { build: [V], pressure: [V, X, H, M, Y], elite: ALL, endurance: ALL },
  burster: { build: [H, X], pressure: ALL, elite: ALL, endurance: ALL },
  warden: { pressure: [X], elite: [X, Y, M], endurance: [X, Y, M] },
  revenant: { pressure: [M, H], elite: [M, H, V, Y], endurance: [V, X, H, M, Y] },
  artillery: { elite: [Y], endurance: [V, X, H, M, Y] },
  marksman: { pressure: [M, V], elite: [M, V, X, Y, R], endurance: [M, V, X, Y, R] },
});
export const NEW_ROLE_WEIGHT = 2;
// Role -> archetype ids. New roles list their archetypes as each enemy slice
// lands (S3.4); until then they have none and can never be drawn.
export const KIT_ROLE_ARCHETYPES = freezeDeep({
  rusher: ['bagholder-rusher'], flanker: ['forkrunner'], suppressor: ['liquidator-agent'],
  bruiser: ['whale-enforcer'], demolition: ['gas-bomber'], support: ['validator-cultist'],
  trapper: [], burster: [], warden: [], revenant: [], artillery: [], marksman: [],
});

const bandKey = (bandId) => (bandId === 'boss' ? 'elite' : bandId);

export function directorRoleWeights({ districtId, band, enabledRoles = null }) {
  const weights = [];
  const core = CORE_DISTRICT_ROLES[districtId];
  if (!core) throw new TypeError('districtId must identify an authored district');
  for (const role of core) {
    if (!band.allowedRoles.includes(role)) continue;
    const weight = band.roleWeights[role] ?? 0;
    if (weight > 0 && KIT_ROLE_ARCHETYPES[role].length > 0) weights.push([role, weight]);
  }
  for (const role of NEW_ENEMY_ROLES) {
    if (!enabledRoles?.has(role) || KIT_ROLE_ARCHETYPES[role].length === 0) continue;
    if (NEW_ROLE_DISTRICTS[role][bandKey(band.id)]?.includes(districtId)) weights.push([role, NEW_ROLE_WEIGHT]);
  }
  return weights;
}

// A seeded weighted draw per spawn ordinal (replaces the round-robin index).
export function selectDirectorArchetype({ districtId, band, spawnOrdinal, seed, leanRole = null, enabledRoles = null }) {
  let weights = directorRoleWeights({ districtId, band, enabledRoles });
  if (weights.length === 0) weights = (CORE_DISTRICT_ROLES[districtId] ?? []).filter((role) => KIT_ROLE_ARCHETYPES[role]?.length).map((role) => [role, 1]);
  if (weights.length === 0) throw new Error(`district ${districtId} has no eligible enemy roles`);
  weights = weights.map(([role, weight]) => [role, role === leanRole ? weight * 2 : weight]);
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = seededUnit(seed, `director:role:${spawnOrdinal}`) * total;
  let role = weights.at(-1)[0];
  for (const [candidate, weight] of weights) {
    if (roll < weight) { role = candidate; break; }
    roll -= weight;
  }
  const candidates = KIT_ROLE_ARCHETYPES[role];
  const archetypeId = candidates[Math.floor(seededUnit(seed, `director:archetype:${spawnOrdinal}`) * candidates.length) % candidates.length];
  return freezeDeep({ archetypeId, requestedRole: role, roleApplied: true, fallbackReason: null });
}

export function atArchetypeCap(archetypeId, enemies) {
  const cap = ENEMY_ARCHETYPES[archetypeId]?.behavior?.maxAlive;
  if (!Number.isInteger(cap)) return false;
  let alive = 0;
  for (const enemy of enemies) if (enemy.archetypeId === archetypeId && enemy.active && enemy.health > 0) alive += 1;
  return alive >= cap;
}

// ---------------------------------------------------------------------------
// Seeded lairs and the one-front rule (package 2.7). A lair is valid when it
// passes the spawn safety checks, is off the logical view, at least 560 from
// the hero and within 2,600 enemy path units; lairs 900–2,400 away are
// preferred. Rotation among valid lairs is seeded; the current and the
// neighbouring districts are included. While the hero is on a chokepoint
// (+300) only lairs on the side the hero entered from are eligible.
// ---------------------------------------------------------------------------
export const LAIR_MIN_DISTANCE = 560;
export const LAIR_MAX_PATH = 2_600;
export const LAIR_PREFERRED = Object.freeze({ min: 900, max: 2_400 });
// The package's numbers are for layout v2's 24 lairs. The shipped map has 12
// perimeter spawn points whose breadth-first path from the route is 1,700 to
// 4,300, so it passes its own window (see LEVEL-1-BUILD-LEDGER.md, S1.2).
export const LAIR_RULES_LAYOUT_V2 = Object.freeze({ maxPath: LAIR_MAX_PATH, preferredMin: LAIR_PREFERRED.min, preferredMax: LAIR_PREFERRED.max });
export const LAIR_RULES_SHIPPED_MAP = Object.freeze({ maxPath: 4_400, preferredMin: 900, preferredMax: 3_400 });
export const ONE_FRONT_MARGIN = 300;

export function neighbouringDistricts(districtId) {
  const index = DISTRICT_ORDER.indexOf(districtId);
  return DISTRICT_ORDER.filter((_, other) => index >= 0 && Math.abs(other - index) <= 1);
}

function crossingSide(crossing, point) {
  const mid = crossing.axis === 'x' ? (crossing.entry.x + crossing.exit.x) / 2 : (crossing.entry.y + crossing.exit.y) / 2;
  const value = crossing.axis === 'x' ? point.x : point.y;
  return value < mid ? -1 : 1;
}

// Updates the director's front memory and returns the active front or null.
export function stepOneFront(state, player, crossings = []) {
  const current = state.front ? crossings.find((crossing) => crossing.id === state.front.crossingId) : null;
  if (current && inside(chokeZone(current, ONE_FRONT_MARGIN), player)) return state.front;
  state.front = null;
  for (const crossing of crossings) {
    const zone = chokeZone(crossing, ONE_FRONT_MARGIN);
    if (!inside(zone, player)) continue;
    // The side the hero entered from: where it stood relative to the deck's
    // midpoint on its first tick inside the zone.
    state.front = { crossingId: crossing.id, side: crossingSide(crossing, player) };
    break;
  }
  return state.front;
}

export function chooseDirectorLair({ points, districtId, player, camera, validate, pathDistanceAt = null, seed, spawnOrdinal, front = null, crossings = [], rules = LAIR_RULES_LAYOUT_V2 }) {
  const districts = neighbouringDistricts(districtId);
  const frontCrossing = front ? crossings.find((crossing) => crossing.id === front.crossingId) : null;
  const valid = [];
  for (const point of [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (!districts.includes(point.districtId)) continue;
    if (point.x >= camera.minX && point.x <= camera.maxX && point.y >= camera.minY && point.y <= camera.maxY) continue;
    const straight = Math.hypot(point.x - player.x, point.y - player.y);
    if (straight < LAIR_MIN_DISTANCE) continue;
    if (frontCrossing && crossingSide(frontCrossing, point) !== front.side) continue;
    const path = pathDistanceAt ? pathDistanceAt(point) : null;
    if (path !== null && (path < 0 || path > rules.maxPath)) continue;
    if (path === null && straight > rules.maxPath) continue;
    const validation = validate(point);
    if (!validation.allowed) continue;
    const distance = path ?? straight;
    valid.push({ point, groundZ: validation.groundZ, preferred: distance >= rules.preferredMin && distance <= rules.preferredMax });
  }
  const pool = valid.some((entry) => entry.preferred) ? valid.filter((entry) => entry.preferred) : valid;
  if (pool.length === 0) return null;
  return pool[Math.floor(seededUnit(seed, `director:lair:${spawnOrdinal}`) * pool.length) % pool.length];
}

// ---------------------------------------------------------------------------
// Leash and recycle (package 2.7). An ordinary enemy off the logical view is
// retired without kill credit when its flow-field cell has been unreachable
// for 180 consecutive ticks, or it has been more than 2,600 path units from
// the hero for 600 ticks. A body that is closing in (its path distance beat
// its best by two cells) restarts the far count, so a walker from a distant
// lair is never recycled on its way in. Boss adds are never recycled here.
// ---------------------------------------------------------------------------
export const LEASH_UNREACHABLE_TICKS = 180;
export const LEASH_FAR_TICKS = 600;
export const LEASH_MAX_PATH = 2_600;
export const LEASH_PROGRESS = 120;

export function stepEnemyLeash({ enemies, tick, view, pathDistanceAt }) {
  const recycle = [];
  for (const enemy of enemies) {
    if (!enemy.active || enemy.health <= 0 || String(enemy.id).startsWith('boss:')) continue;
    if (enemy.x >= view.minX && enemy.x <= view.maxX && enemy.y >= view.minY && enemy.y <= view.maxY) {
      enemy.leashUnreachableTicks = 0;
      enemy.leashFarTicks = 0;
      enemy.leashBestPath = -1;
      continue;
    }
    const path = pathDistanceAt(enemy);
    if (path === null) continue;
    enemy.leashUnreachableTicks = path < 0 ? (enemy.leashUnreachableTicks ?? 0) + 1 : 0;
    const closing = path >= 0 && (!(enemy.leashBestPath >= 0) || path <= enemy.leashBestPath - LEASH_PROGRESS);
    if (closing) enemy.leashBestPath = path;
    enemy.leashFarTicks = path > LEASH_MAX_PATH && !closing ? (enemy.leashFarTicks ?? 0) + 1 : 0;
    if (enemy.leashUnreachableTicks >= LEASH_UNREACHABLE_TICKS || enemy.leashFarTicks >= LEASH_FAR_TICKS) {
      recycle.push(freezeDeep({ type: 'enemy:recycled', enemyId: enemy.id, archetypeId: enemy.archetypeId, tick, reason: enemy.leashUnreachableTicks >= LEASH_UNREACHABLE_TICKS ? 'unreachable' : 'far' }));
    }
  }
  return recycle;
}

// Path distance from a flow field, in world units; -1 when unreachable. A
// body hugging a wall can stand in a cell the grid marks closed, so its open
// neighbours are read too.
export function flowPathDistance(grid, field, x, y) {
  if (!grid || !field) return null;
  const cell = grid.cellAt(x, y);
  if (cell < 0) return -1;
  const own = field.distance[cell];
  if (own >= 0) return own * grid.cellSize;
  const column = cell % grid.columns;
  const row = (cell - column) / grid.columns;
  let best = -1;
  for (const [dx, dy] of grid.neighbours) {
    const nc = column + dx;
    const nr = row + dy;
    if (nc < 0 || nr < 0 || nc >= grid.columns || nr >= grid.rows) continue;
    const value = field.distance[nr * grid.columns + nc];
    if (value >= 0 && (best < 0 || value + 1 < best)) best = value + 1;
  }
  return best < 0 ? -1 : best * grid.cellSize;
}

// ---------------------------------------------------------------------------
// B4 hit-stop as a simulation rule. Kills and crits set a freeze of 2–4 ticks
// in which ordinary enemies neither move nor advance their attack clocks; the
// hero, projectiles and the boss keep running. A cooldown keeps a stream of
// crits from freezing the horde. Everything is tick-counted, so a replay of
// the input stream reproduces every freeze.
// ---------------------------------------------------------------------------
export const HIT_STOP = Object.freeze({ kill: 2, crit: 2, critKill: 3, multiKill: 4, multiKillCount: 3, cooldownTicks: 24 });

export function createHitStopState() {
  return { remaining: 0, readyTick: 0, frozenTicks: 0 };
}

export function hitStopTicks({ kills = 0, crits = 0, critKills = 0 }) {
  if (kills >= HIT_STOP.multiKillCount) return HIT_STOP.multiKill;
  if (critKills > 0) return HIT_STOP.critKill;
  if (kills > 0) return HIT_STOP.kill;
  return crits > 0 ? HIT_STOP.crit : 0;
}

export function triggerHitStop(state, tick, ticks) {
  if (!(ticks > 0) || state.remaining > 0 || tick < state.readyTick) return false;
  state.remaining = ticks;
  state.readyTick = tick + ticks + HIT_STOP.cooldownTicks;
  return true;
}

// Called once per tick before the enemy steps: true when enemies are frozen
// this tick (their deadlines are pushed back by one tick).
const ENEMY_CLOCK_FIELDS = Object.freeze(['attackPhaseUntilTick', 'attackRecoveryUntilTick', 'attackTellStartedTick', 'nextDecisionTick', 'progressAnchorTick', 'supportArmorUntilTick', 'losBlockedUntilTick']);
export function consumeHitStop(state, enemies) {
  if (state.remaining <= 0) return false;
  state.remaining -= 1;
  state.frozenTicks += 1;
  for (const enemy of enemies) {
    if (!enemy.active || enemy.health <= 0) continue;
    for (const field of ENEMY_CLOCK_FIELDS) if (Number.isInteger(enemy[field])) enemy[field] += 1;
    // Replaced, never mutated: observers may hold frozen copies of the body.
    if (enemy.rush) enemy.rush = { ...enemy.rush, untilTick: enemy.rush.untilTick + 1 };
    if (enemy.volley) enemy.volley = { ...enemy.volley, nextTick: enemy.volley.nextTick + 1 };
  }
  return true;
}

// ---------------------------------------------------------------------------
// E2 perfect dodge. A dodge that starts in the last 8 ticks of a tell whose
// shape holds the hero (an enemy's, in sight and on the hero's height, or a
// boss strike) grants a short damage bonus. The keyboard dodge earns it on
// desktop; the automatic dodge (which fires 6 or fewer ticks before a strike)
// earns it on touch and gamepad.
// ---------------------------------------------------------------------------
export const PERFECT_DODGE = Object.freeze({ windowTicks: 8, bonusTicks: 90, damageMultiplier: 1.15 });

export function isPerfectDodge({ tick, actor, bodyRadius, enemies, bossDangers = [], lineOfSight = null }) {
  for (const enemy of enemies) {
    if (enemy.active === false || enemy.health <= 0 || enemy.attackPhase !== 'tell') continue;
    const remaining = enemy.attackPhaseUntilTick - tick;
    if (remaining < 0 || remaining > PERFECT_DODGE.windowTicks) continue;
    if (Math.abs((enemy.groundZ ?? 0) - (actor.groundZ ?? 0)) > 8) continue;
    const archetype = ENEMY_ARCHETYPES[enemy.archetypeId];
    if (!archetype || archetype.attack.damage <= 0) continue;
    const geometry = enemy.tellGeometry ?? buildEnemyAttackGeometry(coreTellSpec(archetype, enemy, enemy.telegraphTarget ?? actor, null), enemy, enemy.telegraphTarget ?? actor);
    if (!enemyGeometryContains(geometry, actor, bodyRadius)) continue;
    if (lineOfSight && !lineOfSight(enemy, actor)) continue;
    return true;
  }
  for (const strike of bossDangers) {
    const remaining = strike.resolveTick - tick;
    if (remaining >= 0 && remaining <= PERFECT_DODGE.windowTicks && strike.contains(actor)) return true;
  }
  return false;
}
