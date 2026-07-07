// Hard Money Heroes — durable sprite animation pipeline.
//
// Purpose: one canonical, manifest-driven system for ALL actors (hero, enemies,
// bosses, props, VFX) so adding new animations/characters is a data change
// (drop a manifest) rather than new hardcoded render branches.
//
// A "sprite actor manifest" looks like:
// {
//   id: 'lester',
//   frameSize: [80, 80],          // px [w, h] of a single frame
//   anchor: 'bottom-center',      // draw anchor for footing on the ground
//   directions: ['east','south-east','south', ... ] // 1, 4, or 8-way (isometric => 8)
//   defaultDirection: 'south',
//   states: {
//     idle:  { fps: 10, loop: true,  frames: { east: ['a.png', ...], ... } },
//     run:   { fps: 16, loop: true,  frames: { ... } },
//     shoot: { fps: 18, loop: false, frames: { ... } },
//     hurt:  { fps: 14, loop: false, frames: { ... } },
//     death: { fps: 12, loop: false, frames: { ... } },
//   },
//   // Optional: state aliasing so gameplay states reuse art until dedicated art exists.
//   stateAliases: { walk: 'run', melee: 'shoot', throw: 'shoot' },
//   // Optional: per-actor still fallbacks keyed by direction for first-frame display.
//   stills: { east: 'east.png', ... },
// }
//
// The renderer never needs to know an actor's specific states — it asks the
// SpriteActor for a frame given (state, direction, animationClock).

export const ISO_8_DIRECTIONS = Object.freeze([
  'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east',
]);

const DIRECTION_ANGLE = Object.freeze({
  east: 0, 'south-east': 45, south: 90, 'south-west': 135,
  west: 180, 'north-west': 225, north: 270, 'north-east': 315,
});

// Map a movement/aim vector (dx, dy in screen space) to the nearest manifest
// direction the actor actually has art for. Works for 1/4/8-way actors.
export function directionFromVector(dx, dy, available = ISO_8_DIRECTIONS) {
  if (!available?.length) return null;
  if (available.length === 1) return available[0];
  if ((dx === 0 && dy === 0)) return null; // caller keeps last direction
  // Screen-space angle in degrees, 0 = east, growing clockwise (down = +y).
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  let best = available[0];
  let bestDelta = 360;
  for (const dir of available) {
    const target = DIRECTION_ANGLE[dir];
    if (target === undefined) continue;
    let delta = Math.abs(angle - target);
    if (delta > 180) delta = 360 - delta;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = dir;
    }
  }
  return best;
}

// Resolve a requested state to a concrete state the manifest has art for,
// following stateAliases and finally falling back to 'idle' or the first state.
export function resolveState(manifest, requestedState) {
  const states = manifest?.states ?? {};
  if (states[requestedState]) return requestedState;
  const aliased = manifest?.stateAliases?.[requestedState];
  if (aliased && states[aliased]) return aliased;
  if (states.idle) return 'idle';
  const first = Object.keys(states)[0];
  return first ?? null;
}

// Pick the frame index for a state given an animation clock (in ticks) and the
// global target fps. Deterministic and loop-aware.
export function frameIndexFor(stateDef, clock, targetFps = 60) {
  const fps = Math.max(1, stateDef?.fps ?? 10);
  const ticksPerFrame = Math.max(1, Math.round(targetFps / fps));
  const count = stateDef?.__frameCount ?? 0;
  if (count <= 0) return 0;
  const raw = Math.floor(clock / ticksPerFrame);
  return stateDef.loop === false ? Math.min(count - 1, raw) : raw % count;
}

// A SpriteActor wraps a manifest + an image loader and answers frame queries.
// imageLoader(src) -> an Image-like object (or null). Injected so this module
// stays testable in Node without a DOM.
export class SpriteActor {
  constructor(manifest, imageLoader) {
    this.manifest = manifest ?? {};
    this.loader = imageLoader ?? (() => null);
    this.directions = manifest?.directions ?? ISO_8_DIRECTIONS;
    this.defaultDirection = manifest?.defaultDirection ?? this.directions[0] ?? 'south';
    this.frameSize = manifest?.frameSize ?? [64, 64];
    this.anchor = manifest?.anchor ?? 'bottom-center';
    this._cache = new Map(); // src -> image
    this._frameCounts = new Map();
    // Precompute per-state frame counts (max across directions for stability)
    // without mutating imported manifests, which may be frozen generated modules.
    for (const [state, def] of Object.entries(manifest?.states ?? {})) {
      const counts = Object.values(def.frames ?? {}).map((arr) => arr?.length ?? 0);
      this._frameCounts.set(state, counts.length ? Math.max(...counts) : 0);
    }
  }

  _img(src) {
    if (!src) return null;
    if (this._cache.has(src)) return this._cache.get(src);
    const img = this.loader(src);
    this._cache.set(src, img);
    return img;
  }

  // Snap an arbitrary requested direction to one the actor has art for.
  resolveDirection(requestedDirection) {
    if (!requestedDirection) return this.defaultDirection;
    if (this.directions.includes(requestedDirection)) return requestedDirection;
    // Fall back via angle snap so e.g. an 8-way request maps onto a 4-way actor.
    const angle = DIRECTION_ANGLE[requestedDirection];
    if (angle === undefined) return this.defaultDirection;
    return directionFromVector(Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180), this.directions)
      ?? this.defaultDirection;
  }

  // Core query: return { image, src, state, direction, frameIndex, frameSize, anchor }.
  // Returns image=null (with a still/fallback src if available) when art is missing,
  // so the renderer can decide to draw a shape placeholder instead.
  frame({ state = 'idle', direction = null, clock = 0 } = {}) {
    const resolvedState = resolveState(this.manifest, state);
    const dir = this.resolveDirection(direction);
    const stateDef = this.manifest?.states?.[resolvedState];
    let src = null;
    let frameIndex = 0;
    if (stateDef) {
      const indexedDef = { ...stateDef, __frameCount: this._frameCounts.get(resolvedState) ?? 0 };
      frameIndex = frameIndexFor(indexedDef, clock, this.manifest.targetFps ?? 60);
      const dirFrames = stateDef.frames?.[dir]
        ?? stateDef.frames?.[this.defaultDirection]
        ?? Object.values(stateDef.frames ?? {})[0]
        ?? [];
      src = dirFrames[frameIndex] ?? dirFrames[0] ?? null;
    }
    // Still fallback (per-direction) if the state had no usable frame.
    if (!src) src = this.manifest?.stills?.[dir] ?? this.manifest?.stills?.[this.defaultDirection] ?? null;
    return {
      image: this._img(src),
      src,
      state: resolvedState,
      direction: dir,
      frameIndex,
      frameSize: this.frameSize,
      anchor: this.anchor,
    };
  }

  hasState(state) {
    return Boolean(resolveState(this.manifest, state));
  }

  frameSources({ states = null } = {}) {
    const wanted = states ? new Set(states) : null;
    const sources = [];
    for (const [state, def] of Object.entries(this.manifest?.states ?? {})) {
      if (wanted && !wanted.has(state)) continue;
      for (const frames of Object.values(def.frames ?? {})) {
        for (const src of frames ?? []) {
          if (src) sources.push(src);
        }
      }
    }
    return [...new Set(sources)];
  }

  prewarm(options = {}) {
    const sources = this.frameSources(options);
    for (const src of sources) this._img(src);
    return sources.length;
  }
}

export function collectSpriteManifestFrameSources(manifest, { states = null } = {}) {
  const wanted = states ? new Set(states) : null;
  const sources = [];
  for (const [state, def] of Object.entries(manifest?.states ?? {})) {
    if (wanted && !wanted.has(state)) continue;
    for (const frames of Object.values(def.frames ?? {})) {
      for (const src of frames ?? []) {
        if (src) sources.push(src);
      }
    }
  }
  return [...new Set(sources)];
}

// Validate a manifest shape early so bad art drops fail loudly in tests/CI
// instead of silently rendering nothing. Returns { ok, errors[] }.
export function validateSpriteManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest is not an object'] };
  if (!manifest.id) errors.push('missing id');
  if (!Array.isArray(manifest.frameSize) || manifest.frameSize.length !== 2) errors.push('frameSize must be [w,h]');
  if (!manifest.states || typeof manifest.states !== 'object' || !Object.keys(manifest.states).length) {
    errors.push('manifest must define at least one state');
  }
  const dirs = manifest.directions ?? ISO_8_DIRECTIONS;
  for (const [name, def] of Object.entries(manifest.states ?? {})) {
    if (!def.frames || typeof def.frames !== 'object') {
      errors.push(`state ${name} missing frames map`);
      continue;
    }
    const hasAny = Object.values(def.frames).some((arr) => Array.isArray(arr) && arr.length);
    if (!hasAny) errors.push(`state ${name} has no frames in any direction`);
    for (const d of Object.keys(def.frames)) {
      if (!dirs.includes(d)) errors.push(`state ${name} uses unknown direction ${d}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
