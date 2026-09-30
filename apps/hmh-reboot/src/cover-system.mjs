// Hard Money Heroes cover slice, rules version cover-v1 (2.0 overhaul
// handoff §2.4b). Pure deterministic integer-tick rules: no DOM, no Pixi, no
// wall clock, no random draws. Presentation reads `state.pose`; the simulation
// reads the position, the damage multiplier and the enemy signal.
//
// A cover face is an outward edge of a solid blocker flagged `combatCover`
// whose declared or height-derived kind is 'tall' or 'short'. The hero stands
// on the outward side of the face, one integer standoff beyond its own radius,
// at an integer distance `along` from the face's first endpoint.
//
// Tick order for a caller (see docs/2.0/slices/HMH-COVER-TRAVERSAL-V1.md):
//   1. stepCover(state, { player, input, faces, tick }) before free movement;
//   2. while result.inCover, the hero position is result.position and the
//      free movement, collision sweep and traversal sweep are skipped;
//   3. enemy hits on the player pass through coverDamageMultiplier.
import { clamp, finite, freezeDeep, lexical, nonNegative, nonNegativeInteger } from './value-guards.mjs';

const EPSILON = 1e-9;

export const COVER_KINDS = Object.freeze(['tall', 'short']);

export const COVER_POSES = Object.freeze([
  'none',
  'cover-enter',
  'cover-idle-l',
  'cover-idle-r',
  'cover-shuffle',
  'cover-peek-fire',
  'cover-blind-fire',
  'cover-reload',
  'cover-hit',
  'cover-leave-step',
  'cover-leave-run',
  'cover-leave-roll',
]);

export const COVER_RULES_V1 = Object.freeze({
  rulesVersion: 'cover-v1',
  // Enter: the hero's edge within this many units of a face, pushing toward
  // it (move input within 60 degrees of the face's inward direction) for this
  // many consecutive ticks.
  enterDistance: 24,
  enterTicks: 6,
  pushThreshold: 0.5,
  // Leave: pushing away from the face for this many consecutive ticks.
  leaveTicks: 4,
  // Shuffle along the face: tangent input beyond this threshold moves the hero
  // this many integer units per tick (2 units a tick is 120 units a second,
  // half the 240 run speed).
  shuffleThreshold: 0.25,
  shuffleUnitsPerTick: 2,
  // Integer gap between the hero circle and the face, so the collision solver
  // never depenetrates a hero in cover.
  standoff: 1,
  // Faces shorter than this cannot hold a hero (two 12-unit radii plus room).
  minFaceLength: 32,
  // Kind derivation from blocker height when level data declares none.
  tallMinHeight: 96,
  shortMinHeight: 24,
  shortMaxHeight: 72,
  // The hero must stand within this height of the blocker's base.
  baseTolerance: 8,
  // Tall cover: a peek is a lean at a corner when the hero is within this
  // distance of a face end; further in, firing is blind fire.
  peekReach: 40,
  // Damage: an attack origin within 60 degrees of the face's inward direction
  // (measured from the hero) is from the covered side.
  coveredCos: 0.5,
  tallDamageMultiplier: 0.4,
  shortDamageMultiplier: 0.6,
});

function unitOrZero(vector) {
  const x = finite(vector?.x ?? 0, 'vector.x');
  const y = finite(vector?.y ?? 0, 'vector.y');
  const magnitude = Math.hypot(x, y);
  if (magnitude <= EPSILON) return { x: 0, y: 0 };
  // Analogue sticks inside the unit circle keep their length, like movement.mjs.
  const scale = 1 / Math.max(1, magnitude);
  return { x: x * scale, y: y * scale };
}

function unit(vector) {
  const magnitude = Math.hypot(vector.x, vector.y);
  return magnitude <= EPSILON ? null : { x: vector.x / magnitude, y: vector.y / magnitude };
}

export function coverKindForBlocker(blocker, rules = COVER_RULES_V1) {
  if (!blocker || blocker.solid === false || blocker.combatCover !== true) return 'none';
  if (blocker.coverKind === 'tall' || blocker.coverKind === 'short' || blocker.coverKind === 'none') return blocker.coverKind;
  const top = typeof blocker.maxZ === 'number' ? blocker.maxZ : Number.POSITIVE_INFINITY;
  if (top === Number.POSITIVE_INFINITY) return 'tall';
  const base = Number.isFinite(blocker.minZ) ? blocker.minZ : 0;
  const height = top - base;
  if (height >= rules.tallMinHeight) return 'tall';
  if (height >= rules.shortMinHeight && height <= rules.shortMaxHeight) return 'short';
  return 'none';
}

function makeFace({ id, blocker, kind, a, b, normal }) {
  const tangentRaw = { x: b.x - a.x, y: b.y - a.y };
  const length = Math.hypot(tangentRaw.x, tangentRaw.y);
  if (length <= EPSILON) return null;
  // `|| 0` folds a negative zero from a negated axis-aligned normal into 0.
  const tangent = { x: tangentRaw.x / length || 0, y: tangentRaw.y / length || 0 };
  return freezeDeep({
    id,
    blockerId: blocker.id,
    kind,
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    tangent,
    normal: { x: normal.x || 0, y: normal.y || 0 },
    length,
    baseZ: Number.isFinite(blocker.minZ) ? blocker.minZ : null,
    topZ: typeof blocker.maxZ === 'number' ? blocker.maxZ : Number.POSITIVE_INFINITY,
  });
}

function polygonFaces(blocker, kind) {
  const vertices = blocker.shape.vertices;
  let centroidX = 0;
  let centroidY = 0;
  for (const vertex of vertices) { centroidX += vertex.x; centroidY += vertex.y; }
  centroidX /= vertices.length;
  centroidY /= vertices.length;
  const faces = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    const edge = unit({ x: b.x - a.x, y: b.y - a.y });
    if (!edge) continue;
    let normal = { x: -edge.y, y: edge.x };
    const midX = (a.x + b.x) / 2 - centroidX;
    const midY = (a.y + b.y) / 2 - centroidY;
    if (normal.x * midX + normal.y * midY < 0) normal = { x: edge.y, y: -edge.x };
    const face = makeFace({ id: `${blocker.id}:${index}`, blocker, kind, a, b, normal });
    if (face) faces.push(face);
  }
  return faces;
}

function capsuleFaces(blocker, kind) {
  const { a, b, radius } = blocker.shape;
  const axis = unit({ x: b.x - a.x, y: b.y - a.y });
  if (!axis) return [];
  const side = { x: -axis.y, y: axis.x };
  const faces = [];
  const plus = makeFace({
    id: `${blocker.id}:0`, blocker, kind,
    a: { x: a.x + side.x * radius, y: a.y + side.y * radius },
    b: { x: b.x + side.x * radius, y: b.y + side.y * radius },
    normal: side,
  });
  const minus = makeFace({
    id: `${blocker.id}:1`, blocker, kind,
    a: { x: a.x - side.x * radius, y: a.y - side.y * radius },
    b: { x: b.x - side.x * radius, y: b.y - side.y * radius },
    normal: { x: -side.x, y: -side.y },
  });
  if (plus) faces.push(plus);
  if (minus) faces.push(minus);
  return faces;
}

const faceIndexCache = new WeakMap();

// Precomputed immutable faces for a blocker list, sorted by face id. Circles
// have no straight face and contribute none. Cached per frozen blocker array
// under the default rules.
export function coverFaceIndex(blockers, rules = COVER_RULES_V1) {
  if (!Array.isArray(blockers)) throw new TypeError('blockers must be an array');
  const cacheable = Object.isFrozen(blockers) && rules === COVER_RULES_V1;
  if (cacheable && faceIndexCache.has(blockers)) return faceIndexCache.get(blockers);
  const faces = [];
  for (const blocker of blockers) {
    const kind = coverKindForBlocker(blocker, rules);
    if (kind === 'none' || !blocker.shape) continue;
    const candidates = blocker.shape.type === 'polygon'
      ? polygonFaces(blocker, kind)
      : blocker.shape.type === 'capsule' ? capsuleFaces(blocker, kind) : [];
    for (const face of candidates) if (face.length >= rules.minFaceLength) faces.push(face);
  }
  faces.sort((left, right) => lexical(left.id, right.id));
  const index = Object.freeze(faces);
  if (cacheable) faceIndexCache.set(blockers, index);
  return index;
}

export function createCoverState() {
  return {
    phase: 'free',
    faceId: null,
    blockerId: null,
    kind: null,
    along: 0,
    restAlong: 0,
    length: 0,
    normal: { x: 0, y: 0 },
    tangent: { x: 0, y: 0 },
    facing: { x: 0, y: 0 },
    anchor: { x: 0, y: 0 },
    topZ: null,
    position: null,
    peeking: false,
    peekMode: null,
    enterCandidateId: null,
    enterCounter: 0,
    leaveCounter: 0,
    pose: 'none',
    event: null,
    enteredTick: -1,
    coverTicks: 0,
    enters: 0,
  };
}

function facePosition(state, radius, rules) {
  const distance = radius + rules.standoff;
  return {
    x: state.anchor.x + state.tangent.x * state.along + state.normal.x * distance,
    y: state.anchor.y + state.tangent.y * state.along + state.normal.y * distance,
  };
}

// Screen-space right-hand vector of a facing (y grows downward).
function rightOf(facing) {
  return { x: -facing.y, y: facing.x };
}

function endSide(state, endSign) {
  const right = rightOf(state.facing);
  const endVector = { x: state.tangent.x * endSign, y: state.tangent.y * endSign };
  return endVector.x * right.x + endVector.y * right.y > 0 ? 'r' : 'l';
}

function nearestEndSign(state) {
  return state.along <= state.length - state.along ? -1 : 1;
}

function enterableFace(face, player, radius, move, rules) {
  if (face.baseZ !== null && Math.abs(player.groundZ - face.baseZ) > rules.baseTolerance) return null;
  const relativeX = player.x - face.a.x;
  const relativeY = player.y - face.a.y;
  const outward = relativeX * face.normal.x + relativeY * face.normal.y;
  if (outward < -EPSILON) return null;
  const gap = outward - radius;
  if (gap > rules.enterDistance + EPSILON) return null;
  const along = relativeX * face.tangent.x + relativeY * face.tangent.y;
  if (along < -EPSILON || along > face.length + EPSILON) return null;
  const inwardPush = -(move.x * face.normal.x + move.y * face.normal.y);
  if (inwardPush < rules.pushThreshold - EPSILON) return null;
  const radiusCeil = Math.ceil(radius);
  if (face.length - radiusCeil * 2 < 0) return null;
  return { face, gap, along };
}

function chooseCandidate(faces, player, radius, move, rules) {
  let best = null;
  for (const face of faces) {
    const candidate = enterableFace(face, player, radius, move, rules);
    if (!candidate) continue;
    if (!best || candidate.gap < best.gap - EPSILON || (Math.abs(candidate.gap - best.gap) <= EPSILON && lexical(face.id, best.face.id) < 0)) best = candidate;
  }
  return best;
}

function enterCover(state, candidate, radius, tick, rules) {
  const { face } = candidate;
  const radiusCeil = Math.ceil(radius);
  state.phase = 'cover';
  state.faceId = face.id;
  state.blockerId = face.blockerId;
  state.kind = face.kind;
  state.length = face.length;
  state.normal = { x: face.normal.x, y: face.normal.y };
  state.tangent = { x: face.tangent.x, y: face.tangent.y };
  state.anchor = { x: face.a.x, y: face.a.y };
  state.topZ = face.topZ;
  state.facing = face.kind === 'tall' ? { x: face.normal.x, y: face.normal.y } : { x: -face.normal.x || 0, y: -face.normal.y || 0 };
  state.along = clamp(Math.round(candidate.along), radiusCeil, face.length - radiusCeil);
  state.restAlong = state.along;
  state.position = facePosition(state, radius, rules);
  state.peeking = false;
  state.peekMode = null;
  state.enterCandidateId = null;
  state.enterCounter = 0;
  state.leaveCounter = 0;
  state.pose = 'cover-enter';
  state.event = 'enter';
  state.enteredTick = tick;
  state.coverTicks += 1;
  state.enters += 1;
}

function leaveCover(state, pose, event) {
  state.phase = 'free';
  state.faceId = null;
  state.blockerId = null;
  state.kind = null;
  state.along = 0;
  state.restAlong = 0;
  state.length = 0;
  state.normal = { x: 0, y: 0 };
  state.tangent = { x: 0, y: 0 };
  state.facing = { x: 0, y: 0 };
  state.anchor = { x: 0, y: 0 };
  state.topZ = null;
  state.position = null;
  state.peeking = false;
  state.peekMode = null;
  state.enterCandidateId = null;
  state.enterCounter = 0;
  state.leaveCounter = 0;
  state.pose = pose;
  state.event = event;
}

function result(state, extra = {}) {
  return freezeDeep({
    inCover: state.phase === 'cover',
    position: state.position ? { x: state.position.x, y: state.position.y } : null,
    pose: state.pose,
    event: state.event,
    faceId: state.faceId,
    blockerId: state.blockerId,
    kind: state.kind,
    peeking: state.peeking,
    peekMode: state.peekMode,
    facing: { x: state.facing.x, y: state.facing.y },
    movementLocked: state.phase === 'cover',
    ...extra,
  });
}

function stepFree(state, { player, radius, move, dodge, faces, tick, rules }) {
  state.pose = 'none';
  if (dodge) {
    state.enterCandidateId = null;
    state.enterCounter = 0;
    return result(state);
  }
  const candidate = chooseCandidate(faces, player, radius, move, rules);
  if (!candidate) {
    state.enterCandidateId = null;
    state.enterCounter = 0;
    return result(state);
  }
  state.enterCounter = candidate.face.id === state.enterCandidateId ? state.enterCounter + 1 : 1;
  state.enterCandidateId = candidate.face.id;
  if (state.enterCounter >= rules.enterTicks) enterCover(state, candidate, radius, tick, rules);
  return result(state);
}

function stepInCover(state, { radius, move, input, dodge, rules }) {
  state.coverTicks += 1;
  if (dodge) {
    leaveCover(state, 'cover-leave-roll', 'leave-roll');
    return result(state);
  }
  const away = move.x * state.normal.x + move.y * state.normal.y;
  state.leaveCounter = away >= rules.pushThreshold - EPSILON ? state.leaveCounter + 1 : 0;
  if (state.leaveCounter >= rules.leaveTicks) {
    leaveCover(state, 'cover-leave-step', 'leave-step');
    return result(state);
  }
  const alongInput = move.x * state.tangent.x + move.y * state.tangent.y;
  const peekRequested = input.fire === true || input.aimHeld === true;
  const radiusCeil = Math.ceil(radius);
  const minAlong = radiusCeil;
  const maxAlong = state.length - radiusCeil;
  let pose;
  if (!peekRequested && Math.abs(alongInput) >= rules.shuffleThreshold - EPSILON) {
    const direction = alongInput > 0 ? 1 : -1;
    if ((direction < 0 && state.along <= minAlong) || (direction > 0 && state.along >= maxAlong)) {
      leaveCover(state, 'cover-leave-run', 'leave-run');
      return result(state);
    }
    state.peeking = false;
    state.peekMode = null;
    state.along = clamp(state.along + direction * rules.shuffleUnitsPerTick, minAlong, maxAlong);
    state.restAlong = state.along;
    pose = 'cover-shuffle';
  } else if (peekRequested) {
    if (state.kind === 'short') {
      state.peeking = true;
      state.peekMode = 'pop';
      state.along = state.restAlong;
      pose = 'cover-peek-fire';
    } else {
      const endSign = nearestEndSign(state);
      const endDistance = endSign < 0 ? state.restAlong : state.length - state.restAlong;
      if (endDistance <= rules.peekReach + EPSILON) {
        state.peeking = true;
        state.peekMode = `lean-${endSide(state, endSign)}`;
        state.along = endSign < 0 ? 0 : state.length;
        pose = 'cover-peek-fire';
      } else {
        state.along = state.restAlong;
        if (input.fire === true) {
          state.peeking = true;
          state.peekMode = 'blind';
          pose = 'cover-blind-fire';
        } else {
          state.peeking = false;
          state.peekMode = null;
          pose = `cover-idle-${endSide(state, endSign)}`;
        }
      }
    }
  } else {
    state.peeking = false;
    state.peekMode = null;
    state.along = state.restAlong;
    pose = input.reload === true ? 'cover-reload' : `cover-idle-${endSide(state, nearestEndSign(state))}`;
  }
  if (input.hit === true) pose = 'cover-hit';
  state.pose = pose;
  state.event = null;
  state.position = facePosition(state, radius, rules);
  return result(state);
}

export function stepCover(state, { player, input = {}, faces = null, blockers = null, tick, rules = COVER_RULES_V1 } = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('cover state is required');
  nonNegativeInteger(tick, 'tick');
  const hero = {
    x: finite(player?.x, 'player.x'),
    y: finite(player?.y, 'player.y'),
    groundZ: finite(player?.groundZ ?? 0, 'player.groundZ'),
  };
  const radius = nonNegative(player?.radius ?? 12, 'player.radius');
  const faceList = faces ?? coverFaceIndex(blockers ?? [], rules);
  if (!Array.isArray(faceList)) throw new TypeError('faces must be an array');
  const move = unitOrZero(input.move);
  const dodge = input.dodge === true;
  state.event = null;
  if (state.phase === 'cover') return stepInCover(state, { radius, move, input, dodge, rules });
  return stepFree(state, { player: hero, radius, move, dodge, faces: faceList, tick, rules });
}

// 1 outside cover, from the open side, from along the face, or from a shooter
// standing above the cover's top. Otherwise the kind's multiplier.
export function coverDamageMultiplier(state, attackOrigin, rules = COVER_RULES_V1) {
  if (!state || state.phase !== 'cover' || !state.position) return 1;
  const originX = finite(attackOrigin?.x, 'attackOrigin.x');
  const originY = finite(attackOrigin?.y, 'attackOrigin.y');
  const originZ = attackOrigin?.z;
  if (typeof originZ === 'number' && Number.isFinite(originZ) && originZ >= state.topZ - EPSILON) return 1;
  const direction = unit({ x: originX - state.position.x, y: originY - state.position.y });
  if (!direction) return 1;
  const inward = -(direction.x * state.normal.x + direction.y * state.normal.y);
  if (inward < rules.coveredCos - EPSILON) return 1;
  return state.kind === 'tall' ? rules.tallDamageMultiplier : rules.shortDamageMultiplier;
}

export function applyCoverToDamage(state, attackOrigin, damage, rules = COVER_RULES_V1) {
  nonNegative(damage, 'damage');
  const multiplier = coverDamageMultiplier(state, attackOrigin, rules);
  return multiplier === 1 ? damage : Math.round(damage * multiplier);
}

// The enemy-facing signal. Reading it changes no state; the AI slice that
// flanks, lobs grenades or rushes a covered hero consumes it later.
export function coverSignal(state, tick) {
  nonNegativeInteger(tick, 'tick');
  const inCover = state?.phase === 'cover';
  return freezeDeep({
    playerInCover: inCover,
    kind: inCover ? state.kind : null,
    faceId: inCover ? state.faceId : null,
    blockerId: inCover ? state.blockerId : null,
    normal: inCover ? { x: state.normal.x, y: state.normal.y } : null,
    position: inCover ? { x: state.position.x, y: state.position.y } : null,
    peeking: inCover ? state.peeking : false,
    ticksInCover: inCover ? tick - state.enteredTick + 1 : 0,
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

export function canonicalCoverJson(state) {
  return canonical(state);
}

// 32-bit FNV-1a of the canonical state, as eight hex digits.
export function hashCoverState(state) {
  const text = canonical(state);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
