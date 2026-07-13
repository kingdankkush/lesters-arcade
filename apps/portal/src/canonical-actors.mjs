// Single import point for all canonical Hard Money Heroes actor manifests.
// The renderer imports CANONICAL_ACTOR_MANIFESTS and builds SpriteActors via
// buildActorRegistry(). Adding a character = ingest art + add one import here.
//
// Source: Justin's hand-made art, ingested by scripts/ingest-hmh-canonical-art.py.
// Generation tools only ADD frames/tilesets/VFX; they never redesign characters.

import { HMH_ANIMATED_ROSTER } from '../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { HMH_CANON_TRENCH_DEGEN } from '../assets/generated/hmh-canonical-art/trench-degen/trench-degen.mjs';
import { HMH_CANON_EVIL_BANKER } from '../assets/generated/hmh-canonical-art/evil-banker/evil-banker.mjs';
import { HMH_CANON_CRYPTO_BRO } from '../assets/generated/hmh-canonical-art/crypto-bro/crypto-bro.mjs';
import { HMH_CANON_GAS_BEAST } from '../assets/generated/hmh-canonical-art/gas-beast/gas-beast.mjs';
import { HMH_CANON_EVIL_BOSS } from '../assets/generated/hmh-canonical-art/evil-boss/evil-boss.mjs';
import { HMH_CANON_WARREN_BOSS } from '../assets/generated/hmh-canonical-art/warren-boss/warren-boss.mjs';
export { canonicalActorIdForRuntimeEntity, manifestEnemyArtKeyForRuntimeEntity } from './canonical-actor-routing.mjs';

function cloneFramesMap(frames = {}) {
  return Object.fromEntries(
    Object.entries(frames ?? {}).map(([direction, frameList]) => [direction, [...(frameList ?? [])]]),
  );
}

function cloneStateDef(stateDef, overrides = {}) {
  const frames = overrides.frames ?? stateDef?.frames ?? {};
  return {
    ...(stateDef ?? {}),
    ...overrides,
    frames: cloneFramesMap(frames),
  };
}

function maxFrameCount(stateDef) {
  return Math.max(0, ...Object.values(stateDef?.frames ?? {}).map((frames) => frames?.length ?? 0));
}

function sliceFrames(stateDef, { start = 0, end = null, minFrames = 1 } = {}) {
  const next = {};
  for (const [direction, frameList] of Object.entries(stateDef?.frames ?? {})) {
    const frames = [...(frameList ?? [])];
    if (!frames.length) continue;
    const safeStart = Math.max(0, Math.min(frames.length - 1, Math.floor(start)));
    const safeEnd = end == null
      ? frames.length
      : Math.max(safeStart + 1, Math.min(frames.length, Math.floor(end)));
    let selection = frames.slice(safeStart, safeEnd);
    if (!selection.length) selection = [frames[safeStart] ?? frames[frames.length - 1]];
    if (selection.length < minFrames) {
      selection = frames.slice(Math.max(0, frames.length - minFrames));
    }
    next[direction] = selection.length ? selection : [frames[0]];
  }
  return Object.keys(next).length ? next : null;
}

function firstAvailableState(states, ids = []) {
  for (const id of ids) {
    const stateDef = states?.[id];
    if (stateDef && maxFrameCount(stateDef) > 0) return { id, stateDef };
  }
  return null;
}

function deriveAttackState(states) {
  if (states.attack) return cloneStateDef(states.attack);
  const source = firstAvailableState(states, ['health-75', 'health-50', 'jump', 'run', 'walk', 'idle']);
  if (!source) return null;
  return cloneStateDef(source.stateDef, {
    fps: Math.max(8, source.stateDef.fps ?? 8),
    loop: false,
  });
}

function deriveAttackTellState(states) {
  if (states['attack-tell']) return cloneStateDef(states['attack-tell']);
  const source = firstAvailableState(states, ['attack', 'jump', 'run', 'walk', 'idle']);
  if (!source) return null;
  const total = maxFrameCount(source.stateDef);
  const frames = sliceFrames(source.stateDef, {
    start: 0,
    end: total > 1 ? Math.max(1, Math.ceil(total * 0.45)) : 1,
    minFrames: 1,
  });
  if (!frames) return null;
  return {
    fps: Math.max(6, (source.stateDef.fps ?? 10) - 4),
    loop: false,
    frames,
  };
}

function deriveMeleeCounterState(states) {
  if (states['melee-counter']) return cloneStateDef(states['melee-counter']);
  const source = firstAvailableState(states, ['attack', 'run', 'walk', 'idle']);
  if (!source) return null;
  const total = maxFrameCount(source.stateDef);
  const frames = sliceFrames(source.stateDef, {
    start: total > 1 ? Math.max(0, total - Math.max(1, Math.ceil(total * 0.35))) : 0,
    end: total || 1,
    minFrames: 1,
  });
  if (!frames) return null;
  return {
    fps: Math.max(8, source.stateDef.fps ?? 10),
    loop: false,
    frames,
  };
}

function deriveHitState(states) {
  if (states.hit) return cloneStateDef(states.hit);
  const source = firstAvailableState(states, ['health-75', 'health-50', 'attack', 'health-25', 'jump', 'idle']);
  if (!source) return null;
  const total = maxFrameCount(source.stateDef);
  const frames = source.id === 'attack'
    ? sliceFrames(source.stateDef, { start: Math.max(0, total - 2), end: total || 1, minFrames: 1 })
    : sliceFrames(source.stateDef, { start: 0, end: 1, minFrames: 1 });
  if (!frames) return null;
  return {
    fps: Math.max(10, source.stateDef.fps ?? 10),
    loop: false,
    frames,
  };
}

function deriveLocomotionState(states, target = 'walk') {
  const source = firstAvailableState(states, ['run', 'walk', 'jump', 'idle', 'attack']);
  if (!source) return null;
  const baseFps = source.stateDef.fps ?? 10;
  return cloneStateDef(source.stateDef, {
    fps: target === 'run' ? Math.max(10, baseFps + 1) : Math.max(6, baseFps - 2),
    loop: true,
  });
}

function deriveDeathState(states) {
  if (states.death) return cloneStateDef(states.death);
  const source = firstAvailableState(states, ['health-25', 'health-50', 'health-75', 'attack', 'jump', 'run', 'idle']);
  if (!source) return null;
  const total = maxFrameCount(source.stateDef);
  const frames = source.id.startsWith('health-')
    ? cloneFramesMap(source.stateDef.frames)
    : sliceFrames(source.stateDef, { start: Math.max(0, total - 2), end: total || 1, minFrames: 1 });
  if (!frames) return null;
  return {
    fps: Math.max(6, Math.min(source.stateDef.fps ?? 8, 10)),
    loop: false,
    frames,
  };
}

function deriveOptionalGoreOverlayState(states) {
  if (states['optional-gore-overlay']) return cloneStateDef(states['optional-gore-overlay']);
  const source = firstAvailableState(states, ['death', 'hit', 'health-25', 'attack', 'idle']);
  if (!source) return null;
  const total = maxFrameCount(source.stateDef);
  const frames = source.id === 'death'
    ? cloneFramesMap(source.stateDef.frames)
    : source.id === 'attack'
      ? sliceFrames(source.stateDef, { start: Math.max(0, total - 2), end: total || 1, minFrames: 1 })
      : sliceFrames(source.stateDef, { start: 0, end: Math.min(total || 1, 2), minFrames: 1 });
  if (!frames) return null;
  return {
    fps: Math.max(8, Math.min(source.stateDef.fps ?? 10, 12)),
    loop: false,
    frames,
  };
}

function withDerivedCombatReadability(manifest) {
  const states = Object.fromEntries(
    Object.entries(manifest?.states ?? {}).map(([id, stateDef]) => [id, cloneStateDef(stateDef)]),
  );

  if (!states.walk && states.run) {
    states.walk = cloneStateDef(states.run, {
      fps: Math.max(8, (states.run.fps ?? 10) - 2),
      loop: true,
    });
  }
  if (!states.run && states.walk) {
    states.run = cloneStateDef(states.walk, {
      fps: Math.max(12, (states.walk.fps ?? 10) + 2),
      loop: true,
    });
  }
  if (!states.walk) states.walk = deriveLocomotionState(states, 'walk');
  if (!states.run) states.run = deriveLocomotionState(states, 'run');

  states.attack ??= deriveAttackState(states);
  states['attack-tell'] ??= deriveAttackTellState(states);
  states['melee-counter'] ??= deriveMeleeCounterState(states);
  states.hit ??= deriveHitState(states);
  states.death ??= deriveDeathState(states);
  states['optional-gore-overlay'] ??= deriveOptionalGoreOverlayState(states);

  return Object.freeze({
    ...manifest,
    stateAliases: {
      ...(manifest?.stateAliases ?? {}),
      telegraph: 'attack-tell',
      tell: 'attack-tell',
      hurt: 'hit',
      counter: 'melee-counter',
      gore: 'optional-gore-overlay',
      'gore-overlay': 'optional-gore-overlay',
    },
    states,
  });
}



const HERO_DIRECTIONS = Object.freeze(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);
const HERO_STATE_SOURCE = Object.freeze({
  idle: 'idle',
  walk: 'walk',
  run: 'run',
  'shoot-pistol': 'shoot',
  'shoot-shotgun': 'shoot',
  'shoot-mg': 'shoot',
  melee: 'melee',
  'throw-grenade': 'throw',
  hurt: 'hurt',
  death: 'death',
  dash: 'dash',
  victory: 'victory',
});

function heroManifestFromAnimatedRoster(id) {
  const actor = HMH_ANIMATED_ROSTER[id];
  if (!actor) throw new Error(`Animated roster hero missing: ${id}`);
  const states = Object.fromEntries(Object.entries(HERO_STATE_SOURCE).map(([stateId, sourceId]) => [
    stateId,
    Object.freeze({
      fps: actor.targetFps ?? 12,
      loop: ['idle', 'walk', 'run'].includes(stateId),
      frames: cloneFramesMap(actor.animations[sourceId]),
    }),
  ]));
  return Object.freeze({
    id: `${id}-animated-roster-compat`,
    role: 'hero',
    frameSize: Object.freeze([128, 128]),
    anchor: 'bottom-center',
    directions: HERO_DIRECTIONS,
    defaultDirection: 'south',
    targetFps: actor.targetFps ?? 12,
    source: 'Canonical HMH animated roster; shared with live gameplay',
    stateAliases: Object.freeze({ shoot: 'shoot-mg', attack: 'shoot-mg', grenade: 'throw-grenade' }),
    states: Object.freeze(states),
  });
}

export const HMH_ROSTER_LESTER_MATRIX = heroManifestFromAnimatedRoster('lester');
export const HMH_ROSTER_LILLY_MATRIX = heroManifestFromAnimatedRoster('lilly');

export const CANONICAL_ACTOR_MANIFESTS = Object.freeze({
  lester: HMH_ROSTER_LESTER_MATRIX,
  lilly: HMH_ROSTER_LILLY_MATRIX,
  'trench-degen': withDerivedCombatReadability(HMH_CANON_TRENCH_DEGEN),
  'evil-banker': withDerivedCombatReadability(HMH_CANON_EVIL_BANKER),
  'crypto-bro': withDerivedCombatReadability(HMH_CANON_CRYPTO_BRO),
  'gas-beast': withDerivedCombatReadability(HMH_CANON_GAS_BEAST),
  'evil-boss': withDerivedCombatReadability(HMH_CANON_EVIL_BOSS),
  'warren-boss': withDerivedCombatReadability(HMH_CANON_WARREN_BOSS),
});

// Roster classification so gameplay/balancing can iterate roles generically.
export const CANONICAL_ACTOR_ROLES = Object.freeze({
  heroes: Object.freeze(['lester', 'lilly']),
  enemies: Object.freeze(['trench-degen', 'evil-banker', 'crypto-bro', 'gas-beast']),
  bosses: Object.freeze(['evil-boss', 'warren-boss']),
});
