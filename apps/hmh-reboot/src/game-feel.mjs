// Cycle 074 game feel (V-4, V-5, V-6, K-6 projection half).
//
// Encounter framing and boss-phase zoom, dash landing dust and afterimages,
// the hero hit smear, and the level-up / pickup beats. Everything here is art:
// the resolvers are pure functions of the simulation tick and the event
// fields they are handed, seeded through the same FNV-1a form as the rest of
// the runtime, so a replay draws the identical frame. Nothing here can reach
// collision, damage, AI, spawning, RNG, progression or results. Render zoom is
// free to move because the encounter director frames its spawn bounds on a
// fixed logical view (K-1), and pointer aim is a normalised direction under
// one similarity transform, so zoom never changes which shots hit.
export const GAME_FEEL_ART_ID = 'projection-game-feel-v1';

const F = Object.freeze;
const EMPTY = F([]);
const TAU = Math.PI * 2;

export const ENCOUNTER_FRAMING = F({
  minEnemies: 4,
  // Hysteresis: the frame releases only when the crowd has thinned to this.
  releaseEnemies: 2,
  radius: 520,
  zoomOut: 0.9,
  easeInTicks: 24,
  easeOutTicks: 48,
  bossBeatZoom: 0.94,
  bossBeatTicks: 45,
  // Phase boundaries fall every 1,200 boss ticks; the pinned sprite beat stops
  // after the third phase opens, and so does the camera dip.
  bossPhaseTicks: 1_200,
  bossLastBeatTick: 2_445,
});

export const DASH_FEEL = F({
  landingLifeTicks: 10,
  landingRadiusPx: 18,
  landingSparks: 6,
  afterimageTicks: 8,
  afterimageSamples: 4,
  // One sample per previous dash tick: 192 units over 8 ticks is 24 per tick.
  afterimageSpacingPx: 24,
  trailColor: 0x8ff3ff,
  // Light cream reads on both dark grass and the brown roads; a wall stop
  // goes gold (the HUD warning token) and a boss stop goes danger red.
  dustColor: 0xe8d5a8,
  sparkColor: 0xfff1d6,
  stopColors: F({ 'hard-blocker': 0xffd166, boss: 0xff6b86 }),
});

export const HIT_SMEAR = F({ lifeTicks: 8, flashTicks: 3, maxOffsetPx: 10, color: 0xff9aa8, bodyTint: 0xffb3b3 });
export const LEVEL_UP_BURST = F({ lifeTicks: 20, color: 0xffd166, fullRays: 12, reducedRays: 7 });
export const PICKUP_SPARKLE = F({ lifeTicks: 12, fullCount: 6, reducedCount: 4 });

function unit(key) {
  let hash = 2166136261;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 0x1_0000_0000;
}

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (progress) => progress * progress * (3 - 2 * progress);
const tierCount = (particleScale, full, reduced) => (particleScale >= 10 ? full : particleScale > 0 ? reduced : 0);
const inLife = (age, life) => Number.isFinite(age) && age >= 0 && age < life;

export function createEncounterFramingState() {
  return { tick: -1, zoom: 1, target: 1, from: 1, startTick: 0 };
}

export function resolveEncounterFramingZoom({ state, tick, enemies, player, bossPhaseTick = null, reduceMotion = false }) {
  if (!Number.isInteger(tick)) throw new TypeError('framing tick must be an integer');
  if (!Array.isArray(enemies)) throw new TypeError('framing enemies must be an array');
  const table = ENCOUNTER_FRAMING;
  let nearby = 0;
  const px = player?.x ?? 0;
  const py = player?.y ?? 0;
  for (const enemy of enemies) {
    if (!enemy || enemy.active === false || (enemy.health !== undefined && !(enemy.health > 0))) continue;
    if (Math.hypot(enemy.x - px, enemy.y - py) <= table.radius) nearby += 1;
  }
  if (reduceMotion) {
    state.tick = tick;
    state.zoom = 1;
    state.target = 1;
    state.from = 1;
    state.startTick = tick;
    return F({ zoom: 1, framingZoom: 1, target: 1, nearbyEnemies: nearby, bossBeat: 0 });
  }
  if (state.tick !== tick) {
    if (tick < state.tick) Object.assign(state, createEncounterFramingState());
    const desired = nearby >= table.minEnemies ? table.zoomOut : nearby <= table.releaseEnemies ? 1 : state.target;
    if (desired !== state.target) {
      state.target = desired;
      state.from = state.zoom;
      state.startTick = tick;
    }
    const duration = state.target < state.from ? table.easeInTicks : table.easeOutTicks;
    const progress = duration > 0 ? clamp01((tick - state.startTick) / duration) : 1;
    state.zoom = state.from + (state.target - state.from) * smoothstep(progress);
    state.tick = tick;
  }
  // Boss phase beat: a brief dip at each phase boundary, returning on a
  // quadratic so the settle is soft. It never pulls a busy frame back in.
  const phaseTick = Number.isFinite(bossPhaseTick) && bossPhaseTick >= 0 && bossPhaseTick < table.bossLastBeatTick
    ? bossPhaseTick % table.bossPhaseTicks
    : table.bossBeatTicks;
  const beat = phaseTick < table.bossBeatTicks ? (1 - phaseTick / table.bossBeatTicks) ** 2 : 0;
  const beatZoom = 1 - (1 - table.bossBeatZoom) * beat;
  const zoom = Math.min(1, Math.max(table.zoomOut, Math.min(state.zoom, beatZoom)));
  return F({ zoom, framingZoom: state.zoom, target: state.target, nearbyEnemies: nearby, bossBeat: beat });
}

export function resolveDashLandingPuff({ age, zoom = 1, seed = '', stopReason = null, particleScale = 0, reduceMotion = false }) {
  const table = DASH_FEEL;
  if (reduceMotion || !inLife(age, table.landingLifeTicks)) return null;
  const life = 1 - age / table.landingLifeTicks;
  const sparks = [];
  const count = particleScale > 0 ? table.landingSparks : 0;
  for (let index = 0; index < count; index += 1) {
    const angle = unit(`${seed}:${index}`) * TAU;
    const reach = (10 + age * 3.6) * zoom;
    sparks.push(F({
      dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach * 0.6 - age * 0.8 * zoom,
      radius: (6 - age * 0.3) * zoom,
      alpha: 0.9 * life,
    }));
  }
  return F({
    radius: (table.landingRadiusPx + age * 3.2) * zoom,
    alpha: 0.6 * life,
    dx: (unit(`${seed}:dx`) - 0.5) * 8 * zoom,
    dy: (unit(`${seed}:dy`) - 0.5) * 4 * zoom,
    tint: table.stopColors[stopReason] ?? table.dustColor,
    sparks: F(sparks),
  });
}

export function resolveDashAfterimages({ direction, age, distance = DASH_FEEL.afterimageSpacingPx, zoom = 1, reduceMotion = false }) {
  const table = DASH_FEEL;
  if (reduceMotion || !inLife(age, table.afterimageTicks + 1)) return EMPTY;
  const magnitude = Math.hypot(direction?.x ?? 0, direction?.y ?? 0);
  if (!(magnitude > 0)) return EMPTY;
  const ux = direction.x / magnitude;
  const uy = direction.y / magnitude;
  const fade = 1 - age / (table.afterimageTicks + 1);
  const samples = [];
  for (let index = 1; index <= table.afterimageSamples; index += 1) {
    // `+ 0` folds a negative zero back to zero on a straight-axis dash.
    samples.push(F({
      dx: -ux * distance * index * zoom + 0,
      dy: -uy * distance * index * zoom + 0,
      radius: (16 - index * 2) * zoom,
      alpha: 0.78 * fade * (table.afterimageSamples + 1 - index) / table.afterimageSamples,
    }));
  }
  return F(samples);
}

export function resolveHeroHitSmear({ age, knockback, zoom = 1, reduceFlash = false, reduceMotion = false }) {
  const table = HIT_SMEAR;
  if (!inLife(age, table.lifeTicks)) return null;
  const kx = knockback?.x ?? 0;
  const ky = knockback?.y ?? 0;
  const magnitude = Math.hypot(kx, ky);
  const life = 1 - age / table.lifeTicks;
  const offset = magnitude > 0 && !reduceMotion ? Math.min(table.maxOffsetPx, magnitude * 0.35) * life * zoom : 0;
  return F({
    offsetX: magnitude > 0 ? -kx / magnitude * offset + 0 : 0,
    offsetY: magnitude > 0 ? -ky / magnitude * offset + 0 : 0,
    radius: (18 - age) * zoom,
    alpha: 0.55 * life * (reduceFlash ? 0.5 : 1),
    tint: reduceFlash ? 0xffffff : table.color,
    flash: age < table.flashTicks && !reduceFlash,
  });
}

export function resolveLevelUpBurst({ age, zoom = 1, particleScale = 0, reduceFlash = false, seed = '' }) {
  const table = LEVEL_UP_BURST;
  if (!inLife(age, table.lifeTicks)) return null;
  const life = 1 - age / table.lifeTicks;
  const ringRadius = (14 + age * 3.4) * zoom;
  const ringAlpha = life * (reduceFlash ? 0.5 : 0.9);
  const count = tierCount(particleScale, table.fullRays, table.reducedRays);
  const rays = [];
  for (let index = 0; index < count; index += 1) {
    rays.push(F({
      angle: (index / count) * TAU + (unit(`${seed}:${index}`) - 0.5) * 0.4,
      inner: ringRadius * 0.7,
      outer: ringRadius + (10 + age * 1.6) * zoom,
      alpha: ringAlpha * 0.85,
    }));
  }
  return F({
    ringRadius,
    ringAlpha,
    coreRadius: (22 - age * 1.2) * zoom,
    coreAlpha: (reduceFlash ? 0.3 : 0.7) * life,
    coreFlash: !reduceFlash && age < 4,
    color: table.color,
    rays: F(rays),
  });
}

export function resolvePickupSparkle({ age, zoom = 1, particleScale = 0, reduceFlash = false, seed = '' }) {
  const table = PICKUP_SPARKLE;
  if (!inLife(age, table.lifeTicks)) return EMPTY;
  const life = 1 - age / table.lifeTicks;
  const count = tierCount(particleScale, table.fullCount, table.reducedCount);
  const sparkles = [];
  for (let index = 0; index < count; index += 1) {
    const angle = unit(`${seed}:${index}`) * TAU;
    const reach = (6 + age * 2.2) * zoom;
    sparkles.push(F({
      dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach * 0.6 - age * 1.4 * zoom,
      radius: (3 + unit(`${seed}:${index}:r`) * 2) * zoom * (0.6 + 0.4 * life),
      alpha: 0.85 * life * (reduceFlash ? 0.5 : 1),
    }));
  }
  return F(sparkles);
}
