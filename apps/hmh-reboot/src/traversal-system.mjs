// Hard Money Heroes climb and drop slice, rules version traversal-v1 (2.0
// overhaul handoff §2.2 ledges and §2.4c). Pure deterministic integer-tick
// rules: no DOM, no Pixi, no wall clock, no random draws.
//
// A traversal marker is an authored one-way transition: a trigger zone on the
// low side of a climbable edge (kind 'climb') or the high side of a drop edge
// (kind 'drop'), the direction the hero travels across the edge, the ground
// heights on both sides and the horizontal travel. The greybox kit's
// climb-marker and drop-marker pieces supply the zone; the world authors
// supply the rest (see the metadata table in the slice document).
//
// Mantle: `mantleTicks` locked ticks along which the hero's x/y interpolate
// from the trigger point to the landing point; the ground height switches on
// the final tick. The hero is invulnerable to melee, not to projectiles.
// Drop: instant move to the landing point, then `landRecoveryTicks` locked
// ticks of land recovery with no invulnerability.
import { finite, freezeDeep, lexical, nonNegative, nonNegativeInteger, positive } from './value-guards.mjs';

const EPSILON = 1e-9;

export const TRAVERSAL_KINDS = Object.freeze(['climb', 'drop']);

export const TRAVERSAL_POSES = Object.freeze(['none', 'mantle', 'drop', 'land']);

export const TRAVERSAL_RULES_V1 = Object.freeze({
  rulesVersion: 'traversal-v1',
  mantleTicks: 18,
  landRecoveryTicks: 6,
  // Ticks the hero must push across the edge while inside the zone.
  triggerTicks: 1,
  pushThreshold: 0.5,
  baseTolerance: 8,
  climbMinRise: 24,
  climbMaxRise: 192,
  dropMinFall: 24,
  dropMaxFall: 480,
  defaultClimbTravel: 48,
  defaultDropTravel: 32,
  meleeInvulnerableWhileMantling: true,
  projectileInvulnerableWhileMantling: false,
});

function unitOrZero(vector) {
  const x = finite(vector?.x ?? 0, 'vector.x');
  const y = finite(vector?.y ?? 0, 'vector.y');
  const magnitude = Math.hypot(x, y);
  if (magnitude <= EPSILON) return { x: 0, y: 0 };
  const scale = 1 / Math.max(1, magnitude);
  return { x: x * scale, y: y * scale };
}

export function createTraversalMarker({
  id,
  kind,
  zone,
  direction,
  fromZ,
  toZ,
  travel,
  areaId = null,
  rules = TRAVERSAL_RULES_V1,
} = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('traversal marker id must be a non-empty string');
  if (!TRAVERSAL_KINDS.includes(kind)) throw new TypeError('traversal marker kind must be climb or drop');
  const box = {
    minX: finite(zone?.minX, 'zone.minX'), minY: finite(zone?.minY, 'zone.minY'),
    maxX: finite(zone?.maxX, 'zone.maxX'), maxY: finite(zone?.maxY, 'zone.maxY'),
  };
  if (box.maxX <= box.minX || box.maxY <= box.minY) throw new TypeError('traversal marker zone must have positive area');
  const dx = finite(direction?.x, 'direction.x');
  const dy = finite(direction?.y, 'direction.y');
  const magnitude = Math.hypot(dx, dy);
  if (magnitude <= EPSILON) throw new TypeError('traversal marker direction must be non-zero');
  const from = finite(fromZ, 'fromZ');
  const to = finite(toZ, 'toZ');
  const rise = to - from;
  if (kind === 'climb' && (rise < rules.climbMinRise || rise > rules.climbMaxRise)) throw new TypeError('climb marker rise must be within the climbable range');
  if (kind === 'drop' && (-rise < rules.dropMinFall || -rise > rules.dropMaxFall)) throw new TypeError('drop marker fall must be within the droppable range');
  if (areaId !== null && typeof areaId !== 'string') throw new TypeError('traversal marker areaId must be a string');
  return freezeDeep({
    id,
    kind,
    zone: box,
    direction: { x: dx / magnitude, y: dy / magnitude },
    fromZ: from,
    toZ: to,
    travel: positive(travel ?? (kind === 'climb' ? rules.defaultClimbTravel : rules.defaultDropTravel), 'travel'),
    areaId,
  });
}

// Adapts a greybox kit piece (kind 'climb-marker' or 'drop-marker') plus the
// metadata the kit does not carry yet.
export function traversalMarkerFromGreybox(piece, { direction, fromZ, toZ, travel, rules = TRAVERSAL_RULES_V1 } = {}) {
  const kind = piece?.kind === 'climb-marker' ? 'climb' : piece?.kind === 'drop-marker' ? 'drop' : null;
  if (!kind) throw new TypeError('greybox piece must be a climb-marker or drop-marker');
  return createTraversalMarker({ id: piece.id, kind, zone: piece.visible?.bounds, direction, fromZ, toZ, travel, areaId: piece.visible?.areaId ?? null, rules });
}

export function createTraversalState() {
  return {
    phase: 'free',
    markerId: null,
    kind: null,
    remainingTicks: 0,
    totalTicks: 0,
    from: { x: 0, y: 0, z: 0 },
    to: { x: 0, y: 0, z: 0 },
    position: null,
    pose: 'none',
    event: null,
    triggerCandidateId: null,
    triggerCounter: 0,
    startedTick: -1,
    mantles: 0,
    drops: 0,
    mantleTicks: 0,
    landTicks: 0,
  };
}

function result(state, rules) {
  const mantling = state.phase === 'mantling';
  return freezeDeep({
    phase: state.phase,
    position: state.position ? { x: state.position.x, y: state.position.y, z: state.position.z } : null,
    movementLocked: state.phase !== 'free',
    meleeInvulnerable: mantling && rules.meleeInvulnerableWhileMantling,
    projectileInvulnerable: mantling && rules.projectileInvulnerableWhileMantling,
    pose: state.pose,
    event: state.event,
    markerId: state.markerId,
    kind: state.kind,
    remainingTicks: state.remainingTicks,
  });
}

function clearTransition(state) {
  state.phase = 'free';
  state.markerId = null;
  state.kind = null;
  state.remainingTicks = 0;
  state.totalTicks = 0;
  state.position = null;
  state.triggerCandidateId = null;
  state.triggerCounter = 0;
}

function markerCandidate(marker, player, move, rules) {
  const { zone } = marker;
  if (player.x < zone.minX - EPSILON || player.x > zone.maxX + EPSILON || player.y < zone.minY - EPSILON || player.y > zone.maxY + EPSILON) return false;
  if (Math.abs(player.groundZ - marker.fromZ) > rules.baseTolerance) return false;
  return move.x * marker.direction.x + move.y * marker.direction.y >= rules.pushThreshold - EPSILON;
}

function beginMantle(state, marker, player, tick, rules) {
  state.phase = 'mantling';
  state.markerId = marker.id;
  state.kind = 'climb';
  state.totalTicks = rules.mantleTicks;
  state.remainingTicks = rules.mantleTicks;
  state.from = { x: player.x, y: player.y, z: player.groundZ };
  state.to = { x: player.x + marker.direction.x * marker.travel, y: player.y + marker.direction.y * marker.travel, z: marker.toZ };
  state.position = { x: player.x, y: player.y, z: player.groundZ };
  state.pose = 'mantle';
  state.event = 'mantle-start';
  state.startedTick = tick;
  state.mantles += 1;
  state.triggerCandidateId = null;
  state.triggerCounter = 0;
}

function beginDrop(state, marker, player, tick, rules) {
  state.phase = 'landing';
  state.markerId = marker.id;
  state.kind = 'drop';
  state.totalTicks = rules.landRecoveryTicks;
  state.remainingTicks = rules.landRecoveryTicks;
  state.from = { x: player.x, y: player.y, z: player.groundZ };
  state.to = { x: player.x + marker.direction.x * marker.travel, y: player.y + marker.direction.y * marker.travel, z: marker.toZ };
  state.position = { x: state.to.x, y: state.to.y, z: state.to.z };
  state.pose = 'drop';
  state.event = 'drop';
  state.startedTick = tick;
  state.drops += 1;
  state.triggerCandidateId = null;
  state.triggerCounter = 0;
}

// Land recovery for a drop the elevation layer resolved on its own (an
// authored one-way ledge drop in resolveSweptTraversalPath). No-op while a
// mantle or another landing is running.
export function beginLandRecovery(state, { tick, position, rules = TRAVERSAL_RULES_V1 } = {}) {
  nonNegativeInteger(tick, 'tick');
  if (state.phase !== 'free') return result(state, rules);
  state.phase = 'landing';
  state.markerId = null;
  state.kind = 'drop';
  state.totalTicks = rules.landRecoveryTicks;
  state.remainingTicks = rules.landRecoveryTicks;
  const at = { x: finite(position?.x, 'position.x'), y: finite(position?.y, 'position.y'), z: finite(position?.z ?? 0, 'position.z') };
  state.from = { ...at };
  state.to = { ...at };
  state.position = { ...at };
  state.pose = 'land';
  state.event = 'land-start';
  state.startedTick = tick;
  state.triggerCandidateId = null;
  state.triggerCounter = 0;
  return result(state, rules);
}

export function stepTraversal(state, { player, input = {}, markers = [], tick, rules = TRAVERSAL_RULES_V1 } = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('traversal state is required');
  nonNegativeInteger(tick, 'tick');
  if (!Array.isArray(markers)) throw new TypeError('markers must be an array');
  const hero = {
    x: finite(player?.x, 'player.x'),
    y: finite(player?.y, 'player.y'),
    groundZ: finite(player?.groundZ ?? 0, 'player.groundZ'),
  };
  nonNegative(player?.radius ?? 12, 'player.radius');
  state.event = null;

  if (state.phase === 'mantling') {
    state.mantleTicks += 1;
    state.remainingTicks -= 1;
    const elapsed = state.totalTicks - state.remainingTicks;
    const ratio = elapsed / state.totalTicks;
    const finished = state.remainingTicks <= 0;
    state.position = {
      x: state.from.x + (state.to.x - state.from.x) * ratio,
      y: state.from.y + (state.to.y - state.from.y) * ratio,
      z: finished ? state.to.z : state.from.z,
    };
    state.pose = 'mantle';
    if (finished) {
      state.event = 'mantle-complete';
      const outcome = result(state, rules);
      clearTransition(state);
      return outcome;
    }
    return result(state, rules);
  }

  if (state.phase === 'landing') {
    state.landTicks += 1;
    state.remainingTicks -= 1;
    state.position = { x: state.to.x, y: state.to.y, z: state.to.z };
    state.pose = 'land';
    if (state.remainingTicks <= 0) {
      state.event = 'land-complete';
      const outcome = result(state, rules);
      clearTransition(state);
      return outcome;
    }
    return result(state, rules);
  }

  state.pose = 'none';
  state.position = null;
  const move = unitOrZero(input.move);
  let chosen = null;
  for (const marker of markers) {
    if (!markerCandidate(marker, hero, move, rules)) continue;
    if (!chosen || lexical(marker.id, chosen.id) < 0) chosen = marker;
  }
  if (!chosen) {
    state.triggerCandidateId = null;
    state.triggerCounter = 0;
    return result(state, rules);
  }
  state.triggerCounter = chosen.id === state.triggerCandidateId ? state.triggerCounter + 1 : 1;
  state.triggerCandidateId = chosen.id;
  if (state.triggerCounter >= rules.triggerTicks) {
    if (chosen.kind === 'climb') beginMantle(state, chosen, hero, tick, rules);
    else beginDrop(state, chosen, hero, tick, rules);
  }
  return result(state, rules);
}

export function traversalInvulnerability(state, rules = TRAVERSAL_RULES_V1) {
  const mantling = state?.phase === 'mantling';
  return Object.freeze({
    melee: mantling && rules.meleeInvulnerableWhileMantling,
    projectile: mantling && rules.projectileInvulnerableWhileMantling,
  });
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort(lexical).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  if (typeof value === 'number') return Object.is(value, -0) ? '0' : String(value);
  return JSON.stringify(value);
}

export function canonicalTraversalJson(state) {
  return canonical(state);
}

// 32-bit FNV-1a of the canonical state, as eight hex digits.
export function hashTraversalState(state) {
  const text = canonical(state);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
