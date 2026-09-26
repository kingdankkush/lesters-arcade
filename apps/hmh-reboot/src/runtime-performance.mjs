function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be positive and finite`);
  return value;
}

function nonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be non-negative and finite`);
  return value;
}

// Shared runtime pressure limits. The browser runtime, deterministic endurance
// benchmark, and evidence contracts consume this one source so pool telemetry
// cannot silently certify a different cap than the player-visible build.
export const MAX_ACTIVE_PROJECTILES = 128;
export const MAX_COMBAT_VISUAL_EVENTS = 64;
export const COMBAT_VISUAL_EVENT_LIFETIME_TICKS = 12;
export const RUNTIME_PRESSURE_LIMITS = Object.freeze({
  projectiles: MAX_ACTIVE_PROJECTILES,
  combatVisualEvents: MAX_COMBAT_VISUAL_EVENTS,
  visualEventLifetimeTicks: COMBAT_VISUAL_EVENT_LIFETIME_TICKS,
});

const MOBILE_PROFILE = Object.freeze({
  id: 'mobile',
  resolutionCap: 1,
  antialias: false,
  particlesPerHazard: 4,
  worldCullMargin: 128,
  enemyCullMargin: 160,
  // Perf step 6: purely visual phone caps (1.8.1 had 32 animated bodies and
  // the full 48 blood marks).
  maxAnimatedEnemies: 24,
  maxGoreMarks: 16,
});

export const RUNTIME_PERFORMANCE_PROFILES = Object.freeze({
  desktop: Object.freeze({
    id: 'desktop',
    resolutionCap: 2,
    antialias: true,
    particlesPerHazard: 10,
    worldCullMargin: 192,
    enemyCullMargin: 224,
    maxAnimatedEnemies: 96,
    maxGoreMarks: 48,
  }),
  mobile: MOBILE_PROFILE,
  reducedMotion: Object.freeze({
    id: 'reduced-motion',
    resolutionCap: 1,
    antialias: false,
    particlesPerHazard: 0,
    worldCullMargin: 96,
    enemyCullMargin: 128,
    maxAnimatedEnemies: 48,
    maxGoreMarks: 48,
  }),
  // Perf step 7: the Low graphics tier. Never chosen by the device: only the
  // player's Graphics Quality setting selects it. The mobile caps, margins and
  // half pages with fewer particles and blood marks, no contact shadows, and a
  // resolution pinned at 1 (no adaptive step up).
  low: Object.freeze({
    ...MOBILE_PROFILE,
    id: 'low',
    particlesPerHazard: 2,
    maxGoreMarks: 8,
    contactShadows: false,
  }),
});

export function selectRuntimePerformanceProfile({ width, devicePixelRatio, coarsePointer, reduceMotion } = {}) {
  positiveFinite(width, 'width');
  positiveFinite(devicePixelRatio, 'devicePixelRatio');
  if (typeof coarsePointer !== 'boolean' || typeof reduceMotion !== 'boolean') throw new TypeError('coarsePointer and reduceMotion must be booleans');
  const base = reduceMotion
    ? RUNTIME_PERFORMANCE_PROFILES.reducedMotion
    : width <= 700 || coarsePointer
      ? RUNTIME_PERFORMANCE_PROFILES.mobile
      : RUNTIME_PERFORMANCE_PROFILES.desktop;
  return Object.freeze({
    ...base,
    resolution: Math.min(base.resolutionCap, devicePixelRatio),
  });
}

// Perf step 6: the mobile profile loads half-size texture pages. `@0.5x` is
// Pixi's own resolution suffix: the half page decodes with source.resolution
// 0.5, so its logical size is the full page size, and every frame, anchor and
// pivot in the full-size metadata (so every on-screen size) is unchanged.
// scripts/build-hmh-mobile-half-res.py writes the files and their manifest.
const HALF_RES_PAGE = /^((?:\.\.)?\/assets\/generated\/hmh-(?:native-roster|reboot-enemy-roster\/bagholder-rusher|reboot-production-heroes|hero-motion|held-weapons|reboot-authored-props|reboot-tripo-props|terrain-tiles)\/[\w/-]+)\.(?:png|webp)(\?[^#]*)?$/;

// Perf step 7: the Low tier shares the mobile pages.
const halfPages = (profile) => profile?.id === 'mobile' || profile?.id === 'low';

export function profileTextureUrl(url, profile) {
  return halfPages(profile) ? String(url).replace(HALF_RES_PAGE, '$1@0.5x.webp$2') : url;
}

// Desktop keeps Pixi's Assets. A variant that fails to load falls back to the
// full page, so a phone never loses art to a missing half page.
export function createProfileTextureLoader(Assets, profile) {
  if (!halfPages(profile)) return Assets;
  return Object.freeze({
    load(url) {
      const variant = profileTextureUrl(url, profile);
      return variant === url ? Assets.load(url) : Assets.load(variant).catch(() => Assets.load(url));
    },
  });
}

// Perf step 7: the player-facing Graphics Quality setting. Auto is the device
// selection above (with adaptive sharpness in main.mjs); Low, Medium and High
// pin the low, mobile and desktop profiles at the device's pixel ratio. An
// explicit tier keeps the OS reduced-motion stillness (particles stay at 0):
// that is an accessibility choice, not a quality one. Projection only: no
// value here is read by the simulation.
export const GRAPHICS_QUALITY_TIERS = Object.freeze(['auto', 'low', 'medium', 'high']);

export function normalizeGraphicsQuality(value) {
  return GRAPHICS_QUALITY_TIERS.includes(value) ? value : 'auto';
}

export function resolveGraphicsQualityProfile({ quality, autoProfile, devicePixelRatio } = {}) {
  if (typeof autoProfile?.id !== 'string') throw new TypeError('autoProfile is required');
  const tier = normalizeGraphicsQuality(quality);
  if (tier === 'auto') return autoProfile;
  positiveFinite(devicePixelRatio, 'devicePixelRatio');
  const base = RUNTIME_PERFORMANCE_PROFILES[{ low: 'low', medium: 'mobile', high: 'desktop' }[tier]];
  return Object.freeze({
    ...base,
    particlesPerHazard: autoProfile.id === 'reduced-motion' ? 0 : base.particlesPerHazard,
    resolution: Math.min(base.resolutionCap, devicePixelRatio),
  });
}

export function isScreenPointVisible(point, view, margin = 0) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const width = Number(view?.width);
  const height = Number(view?.height);
  // Called per body per frame: no array or closure for the finiteness check.
  if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height))) throw new TypeError('screen point and view must be finite');
  positiveFinite(width, 'view.width');
  positiveFinite(height, 'view.height');
  nonNegativeFinite(margin, 'margin');
  return x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
}

export function selectAnimatedEnemyIds(entries, cap) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  if (!Number.isInteger(cap) || cap < 0) throw new TypeError('animation cap must be a non-negative integer');
  const priority = (entry) => {
    if (entry.state === 'tell' || entry.state === 'attack') return 0;
    if (entry.state === 'hit' || entry.state === 'death') return 1;
    if (entry.spawnCue === true) return 2;
    if (entry.elite === true) return 3;
    return 4;
  };
  return new Set(entries
    .filter((entry) => entry?.visible === true && typeof entry.id === 'string' && entry.id.length > 0)
    .map((entry, sourceIndex) => ({
      entry,
      sourceIndex,
      distance: nonNegativeFinite(entry.distance, `${entry.id}.distance`),
    }))
    .sort((left, right) => priority(left.entry) - priority(right.entry)
      || left.distance - right.distance
      || (left.entry.id < right.entry.id ? -1 : left.entry.id > right.entry.id ? 1 : left.sourceIndex - right.sourceIndex))
    .slice(0, cap)
    .map(({ entry }) => entry.id));
}

export function compactExpiredEventsInPlace(events, currentTick, maxAgeTicks) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (!Number.isInteger(currentTick) || currentTick < 0) throw new TypeError('currentTick must be a non-negative integer');
  if (!Number.isInteger(maxAgeTicks) || maxAgeTicks < 0) throw new TypeError('maxAgeTicks must be a non-negative integer');
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < events.length; readIndex += 1) {
    const event = events[readIndex];
    if (!Number.isInteger(event?.tick) || event.tick < 0) throw new TypeError('event tick must be a non-negative integer');
    if (currentTick - event.tick > maxAgeTicks) continue;
    events[writeIndex] = event;
    writeIndex += 1;
  }
  events.length = writeIndex;
  return events;
}

// Adaptive canvas resolution (HMH-N02 / P02, 2026-09-16). Phones start at the
// profile's safe resolution (1) and step up to `max` only after a sustained
// window of fast frames; they step back down the moment frames slow. Pure:
// feed it frame deltas, act on the returned change. Hysteresis and a
// cooldown keep it from oscillating.
export const ADAPTIVE_RESOLUTION_DEFAULTS = Object.freeze({
  windowFrames: 240,        // ~4 s at 60 Hz before any decision
  raiseP95Ms: 19,           // step up only when p95 frame time is comfortably under 60 Hz
  lowerP95Ms: 30,           // step down when p95 drifts toward 30 Hz
  cooldownFrames: 600,      // ~10 s between changes
  maxRaises: 1,             // one step up per session; a step down is final
});

export function createAdaptiveResolution({ base, max, step = 0.5, options = {} } = {}) {
  const settings = { ...ADAPTIVE_RESOLUTION_DEFAULTS, ...options };
  if (!(base > 0) || !(max >= base)) throw new TypeError('adaptive resolution needs 0 < base <= max');
  const samples = new Float32Array(settings.windowFrames);
  let count = 0, cooldown = 0, current = base, raises = 0, lockedDown = false;
  const p95 = () => {
    const sorted = Array.from(samples.subarray(0, count)).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
  };
  return Object.freeze({
    get resolution() { return current; },
    get lockedDown() { return lockedDown; },
    // Returns the new resolution when it changes, otherwise null.
    sample(deltaMs) {
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) return null;
      if (cooldown > 0) { cooldown -= 1; return null; }
      samples[count % settings.windowFrames] = Math.min(250, deltaMs);
      count += 1;
      if (count < settings.windowFrames) return null;
      const frameP95 = p95();
      count = 0;
      if (current > base && frameP95 >= settings.lowerP95Ms) {
        current = base; lockedDown = true; cooldown = settings.cooldownFrames;
        return current;
      }
      if (!lockedDown && current < max && raises < settings.maxRaises && frameP95 <= settings.raiseP95Ms) {
        current = Math.min(max, current + step); raises += 1; cooldown = settings.cooldownFrames;
        return current;
      }
      return null;
    },
    reset() { count = 0; cooldown = 0; },
  });
}
