import { DISTRICT_TERRAIN_MATERIAL } from './terrain-tile-atlas.mjs';
import { deterministicUnit } from './deterministic-hash.mjs';

// V-1 / V-2. Per-weapon combat VFX identity and surface-typed impacts.
//
// On the Cycle 072 baseline every projectile weapon fired the same four-spoke
// white flash with a hue swap, every round flew the same two-stroke streak,
// and every hit threw the same orange ring regardless of what it struck. A
// shot that stopped on cover or ran out of range simply vanished.
//
// Everything here is art. The resolvers are pure functions of the simulation
// tick and the event fields they are handed; they read no engine state, no
// wall clock and no RNG, so a replay draws the identical frame. Nothing here
// can reach collision, damage, AI, spawning, RNG, progression or results.
//
// Bundle note: the tables are built through small expanders so each field
// name is emitted once; minified property names are the cost that matters.
export const WEAPON_VFX_ART_ID = 'projection-weapon-vfx-v1';

// Hard ceiling on pooled sprites per frame: 64 ring events x 3 sprites. Past
// it, placements are counted, not drawn.
export const MAX_WEAPON_VFX_SPRITES = 192;

export const IMPACT_SURFACES = Object.freeze(['flesh', 'dirt', 'rock', 'metal', 'water']);

// Photosensitivity envelope applied when the reduceFlash setting is on: no
// white core, capped alpha and size, no spokes, and a monotonic fade so two
// consecutive shots never alternate bright/dark.
export const FLASH_SAFE = Object.freeze({
  maxCoreAlpha: 0.30,
  maxHaloAlpha: 0.22,
  maxCoreRadiusPx: 12,
  whiteCoreForbidden: true,
});

const F = Object.freeze;
const HOT_WHITE = 0xffffff;
const FALLBACK_COLOR = 0x49ddff;

export const WEAPON_VFX_COLORS = F({
  'coin-blaster': 0xffd166,
  'scatter-shotgun': 0xff8c5a,
  'auto-miner': 0x83f28f,
  'launcher-rig': 0xc497ff,
  'hash-rail': 0x8ff3ff,
  'lightning-ledger': 0x7df9ff,
  'bear-market-burner': 0xff7a2f,
  'forked-standard': 0xd7fbff,
});

// Expanders. `extra` carries the shape-specific knobs (cone, ring growth,
// steady life under reduceFlash).
const muzzle = (shape, coreRadius, haloScale, lifeTicks, spokes = 0, spokeLength = 0, extra) => ({ shape, coreRadius, haloScale, lifeTicks, spokes, spokeLength, ...extra });
// The lingering rail after-image is a flash effect; reduceFlash removes it.
const tracer = (style, width, glowWidth, tailScale, hot, headRadius = 0, color = FALLBACK_COLOR) => ({
  style, width, glowWidth, tailScale, hot, headRadius, color,
  glowAlpha: style === 'lance' ? 0.22 : 0.24,
  coreAlpha: style === 'pellet' ? 0.9 : 0.98,
  afterImage: style === 'lance',
});
const burst = (sparkScale, ringWidth) => ({ sparkScale, ringWidth });
const NO_MUZZLE = muzzle('none', 0, 0, 0);
const NO_TRACER = tracer('none', 0, 0, 0, 0);
const NO_SHELL = { kind: 'none' };
const row = (id, m, t, b, s) => F({
  muzzle: F({ ...m, color: WEAPON_VFX_COLORS[id] }),
  tracer: F({ ...t, color: WEAPON_VFX_COLORS[id] }),
  impactBurst: F(b),
  shell: F(s),
});

// The identity table. Read it as "what tells this weapon apart at a glance":
//   pistol    small hot four-spoke star, brass casing, medium streak
//   shotgun   wide short cone, one red shotshell, eight thin short pellets
//   minigun   tiny two-spoke bar that clears before the next round, brass,
//             short bright bead
//   rail gun  expanding ring, no casing, long violet lance with an after-image
//   launcher  dim smoke puff, grey casing, no tracer (it flies a grenade)
// The channel, flame and melee weapons keep their own event renderers.
export const WEAPON_VFX = F({
  'coin-blaster': row('coin-blaster', muzzle('star', 9, 1.8, 5, 4, 22), tracer('streak', 3, 7, 1, 0xf4fdff), burst(1, 3), { kind: 'brass' }),
  'scatter-shotgun': row('scatter-shotgun', muzzle('cone', 13, 2.1, 6, 0, 0, { coneLength: 40, coneHalfAngle: 0.5 }), tracer('pellet', 1.8, 4, 0.6, 0xffe6c2), burst(0.6, 2), { kind: 'shotshell' }),
  'auto-miner': row('auto-miner', muzzle('star', 5.5, 1.5, 3, 2, 14, { steadyLifeTicks: 6 }), tracer('bead', 2.4, 5, 0.7, 0xeaffe6, 2.2), burst(0.7, 2), { kind: 'brass' }),
  'hash-rail': row('hash-rail', muzzle('ring', 7, 2.6, 8, 0, 0, { ringGrowth: 4.5 }), tracer('lance', 2.5, 10, 1.6, 0xf6ecff), burst(1.6, 5), NO_SHELL),
  'lightning-ledger': row('lightning-ledger', NO_MUZZLE, NO_TRACER, burst(0.5, 2), NO_SHELL),
  'bear-market-burner': row('bear-market-burner', NO_MUZZLE, NO_TRACER, burst(0.4, 2), NO_SHELL),
  'forked-standard': row('forked-standard', NO_MUZZLE, NO_TRACER, burst(1.2, 4), NO_SHELL),
  'launcher-rig': row('launcher-rig', muzzle('puff', 24, 1.3, 9), NO_TRACER, burst(1.4, 4), { kind: 'casing' }),
});

const NO_SPOKES = F([]);
const HIDDEN_FLASH = F({ visible: false, coreRadius: 0, coreAlpha: 0, haloRadius: 0, haloAlpha: 0, spokes: NO_SPOKES, cone: null, ring: null });

// Peak core/halo alphas per shape, unrestricted. The puff is deliberately
// dim: a launcher reads as weight, not as light.
const MUZZLE_PEAK = { star: [0.85, 0.5], cone: [0.7, 0.42], ring: [0.8, 0.55], puff: [0.72, 0.12] };

/**
 * Screen geometry for one muzzle flash at a given age. Pure and frozen.
 * Alpha never rises with age. Under reduceFlash the white core becomes the
 * weapon colour, alpha and radius clamp to FLASH_SAFE, spokes vanish, and the
 * minigun's flash flattens and stretches across its own fire cadence so
 * sustained fire reads as a steady lamp rather than a 12 Hz strobe.
 */
export function resolveMuzzleFlash({ weaponId, age = 0, zoom = 1, reduceFlash = false } = {}) {
  const known = WEAPON_VFX[weaponId];
  const shape = (known ?? WEAPON_VFX['coin-blaster']).muzzle;
  const color = known ? shape.color : FALLBACK_COLOR;
  const steady = reduceFlash && shape.steadyLifeTicks > 0;
  const lifeTicks = steady ? shape.steadyLifeTicks : shape.lifeTicks;
  if (shape.shape === 'none' || !(age >= 0) || age > lifeTicks) return HIDDEN_FLASH;
  const fade = steady ? 0.6 : 1 - age / (lifeTicks + 1);
  const [peakCore, peakHalo] = MUZZLE_PEAK[shape.shape];
  let coreRadius = shape.coreRadius * zoom;
  let haloRadius = coreRadius * shape.haloScale;
  if (shape.shape === 'star') coreRadius *= 1 - age / (lifeTicks + 1) * 0.5;
  else if (shape.shape === 'puff') { coreRadius *= 1 + age * 0.12; haloRadius *= 1 + age * 0.1; }
  else if (shape.shape === 'ring') haloRadius = (shape.coreRadius + age * shape.ringGrowth) * zoom;
  let coreAlpha = peakCore * fade;
  let haloAlpha = peakHalo * fade;
  let coreColor = shape.shape === 'puff' ? 0xb9b4c2 : HOT_WHITE;
  let spokes = NO_SPOKES;
  if (reduceFlash) {
    coreColor = color;
    coreAlpha = Math.min(coreAlpha, FLASH_SAFE.maxCoreAlpha);
    haloAlpha = Math.min(haloAlpha, FLASH_SAFE.maxHaloAlpha);
    coreRadius = Math.min(coreRadius, FLASH_SAFE.maxCoreRadiusPx * zoom);
  } else if (shape.spokes > 0 && age < 3) {
    // Two spokes make a bar across the aim; four make the classic star.
    spokes = F(Array.from({ length: shape.spokes }, (_, index) => F({
      angle: shape.spokes === 2 ? Math.PI / 2 + index * Math.PI : (index / shape.spokes) * Math.PI * 2 + 0.4,
      length: (shape.spokeLength - age * 4) * zoom,
      alpha: 0.7 * fade,
    })));
  }
  return F({
    visible: true,
    shape: shape.shape,
    lifeTicks,
    coreRadius,
    coreAlpha,
    coreColor,
    haloRadius,
    haloAlpha,
    haloColor: color,
    spokes,
    cone: shape.shape === 'cone' ? F({ length: (shape.coneLength - age * 3) * zoom, halfAngle: shape.coneHalfAngle }) : null,
    ring: shape.shape === 'ring' ? F({ radius: haloRadius, width: 3 * zoom }) : null,
  });
}

// The capstone tracer round and the pierce lance are upgrade identities; they
// override the weapon's own style so an upgraded gun reads as upgraded.
const TRACER_ROUND = F({ ...tracer('tracer', 4, 9, 1.85, 0xffd166, 3.2, 0xffb347), glowAlpha: 0.2, coreAlpha: 0.95 });
const PIERCE_LANCE = F({ ...tracer('lance', 2.5, 8, 1, 0xf6ecff, 0, 0xc497ff), glowAlpha: 0.26, coreAlpha: 1, afterImage: false });
const DEFAULT_TRACER = F(tracer('streak', 3, 7, 1, 0xf4fdff));
const RAIL_SAFE = F({ ...WEAPON_VFX['hash-rail'].tracer, afterImage: false });

/**
 * Tracer style for one live projectile. Shared frozen records, so the
 * per-projectile render loop allocates nothing; never throws.
 */
export function resolveTracer({ weaponId, policyType, projectileTag, reduceFlash = false } = {}) {
  if (projectileTag === 'tracer-round') return TRACER_ROUND;
  const own = WEAPON_VFX[weaponId]?.tracer;
  if (policyType === 'pierce' && own?.style !== 'lance') return PIERCE_LANCE;
  if (!own) return DEFAULT_TRACER;
  return own.style === 'lance' && reduceFlash ? RAIL_SAFE : own;
}

// Authored blocker visualKind -> impact class. Fences and thickets are wood
// and foliage: they splinter into the dirt class rather than sparking.
const COVER_SURFACE = { cliff: 'rock', containers: 'metal', machinery: 'metal', 'bridge-rail': 'metal', building: 'metal' };
const MATERIAL_SURFACE = { 'red-rock': 'rock', 'industrial-slab': 'metal' };

/**
 * Classify what an impact struck from render-side lookups only: the target
 * kind, the authored surface kind under the point, the district's terrain
 * material, or the cover blocker's visualKind. Unknown degrades to dirt so
 * the frame loop can never throw. Roads are not a class in Cycle 073.
 */
export function classifyImpactSurface({ hitKind, surfaceKind, deepWater, districtId, blockerVisualKind } = {}) {
  if (hitKind === 'target') return 'flesh';
  if (hitKind === 'cover') return COVER_SURFACE[blockerVisualKind] ?? 'dirt';
  if (deepWater === true || surfaceKind === 'water' || surfaceKind === 'shallow-water') return 'water';
  if (surfaceKind === 'ledge' || surfaceKind === 'ramp' || surfaceKind === 'stairs') return 'rock';
  if (surfaceKind === 'bridge') return 'metal';
  return MATERIAL_SURFACE[DISTRICT_TERRAIN_MATERIAL[districtId]] ?? 'dirt';
}

// What each surface throws: ring colour, spark colour, spark scale, screen
// fall applied to the fan (metal sparks fly straight, everything else comes
// back down), spark length and width, optional dust puff [colour, radius,
// alpha], splash ring.
const surface = (ring, spark, sparkScale, gravity, length, width, puff, splash = false) => F({
  ring, spark, sparkScale, gravity, length, width, splash,
  puff: puff ? F({ color: puff[0], radius: puff[1], alpha: puff[2] }) : null,
});
const SURFACE_BURSTS = {
  metal: surface(0xffe9a8, 0xfff3b0, 1.5, 0, 14, 2, null),
  rock: surface(0xc9bfae, 0xb8b0a4, 1.2, 0.9, 8, 2.5, [0xa89e90, 11, 0.5]),
  dirt: surface(0xc9a874, 0x4a3524, 0.8, 1.1, 8, 2.5, [0xd8c3a0, 14, 0.62]),
  water: surface(0xdff6ff, 0xffffff, 1.2, 1.4, 6, 2, [0xeaf8ff, 10, 0.5], true),
  flesh: surface(0xff8c5a, 0xd9c2a5, 1, 0.6, 7, 2, [0xb08a6a, 10, 0.46]),
  // Gore is a bridge-supplied setting (default off) and never in the pause set.
  gore: surface(0xff8c5a, 0xc41e2a, 1.2, 1, 10, 2.5, [0x7a1220, 8, 0.4]),
};

/**
 * Geometry and colour for one impact burst at a given age. `sparkBase` is the
 * profile-gated count the runtime already computes (0 under reduced motion);
 * the surface and weapon scale it, and particleScale scales the result so the
 * mobile profile draws 60% of the desktop fan. The ring survives every tier
 * so a hit always registers.
 */
export function resolveImpactBurst({
  surface: surfaceId, weaponId, critical = false, shielded = false, age = 0, sparkBase = 0, particleScale = 10,
  lifeTicks = 12, reduceMotion = false, reduceFlash = false, gore = false,
} = {}) {
  const known = SURFACE_BURSTS[surfaceId] ? surfaceId : 'dirt';
  const profile = known === 'flesh' && gore && !shielded ? SURFACE_BURSTS.gore : SURFACE_BURSTS[known];
  const weapon = (WEAPON_VFX[weaponId] ?? WEAPON_VFX['coin-blaster']).impactBurst;
  const fade = Math.max(0.08, 1 - age / Math.max(1, lifeTicks));
  const baseCount = Math.round(Math.max(0, sparkBase) * profile.sparkScale * weapon.sparkScale) + (critical ? 2 : 0);
  const hotCritical = critical && !reduceFlash;
  return F({
    surface: known,
    ringRadius: 7 + age * 1.4,
    ringWidth: critical ? weapon.ringWidth * 2 : weapon.ringWidth,
    ringColor: shielded ? 0x8bb8ff : hotCritical ? 0xfff06a : critical ? WEAPON_VFX_COLORS[weaponId] ?? profile.ring : profile.ring,
    ringAlpha: critical && reduceFlash ? fade * 0.85 : fade,
    sparkCount: reduceMotion || sparkBase <= 0 ? 0 : Math.round(baseCount * Math.max(0, particleScale) / 10),
    sparkColor: hotCritical ? 0xfff06a : profile.spark,
    sparkWidth: profile.width,
    sparkLength: profile.length,
    sparkGravity: profile.gravity,
    sparkAlpha: fade * 0.9,
    puff: profile.puff ? F({ color: profile.puff.color, radius: profile.puff.radius * (1 + age * 0.18), alpha: profile.puff.alpha * fade }) : null,
    splash: profile.splash,
  });
}

// Defeat feedback remains visible without motion or a hot white flash. Read
// the live settings, not just the profile selected when the run booted.
export function resolveKillBurst({ age = 0, color = FALLBACK_COLOR, particleScale = 10, reduceMotion = false, reduceFlash = false, gore = false } = {}) {
  if (!(age >= 0) || age > 12) return F({ visible: false });
  const fade = Math.max(0.08, 1 - age / 12);
  return F({
    visible: true,
    ringRadius: reduceMotion ? 16 : 10 + age * 3.4,
    ringWidth: Math.max(1, 5 - age * 0.4),
    ringColor: reduceFlash ? color : HOT_WHITE,
    ringAlpha: fade * (reduceFlash ? FLASH_SAFE.maxCoreAlpha : 0.9),
    innerAlpha: fade * (reduceFlash ? FLASH_SAFE.maxHaloAlpha : 0.8),
    shardCount: reduceMotion ? 0 : Math.round(8 * Math.min(10, Math.max(0, particleScale)) / 10),
    shardAlpha: fade * (reduceFlash ? FLASH_SAFE.maxCoreAlpha : 0.85),
    puff: reduceMotion ? null : F({ color: gore ? 0x7a1220 : 0xb08a6a, radius: 10 + age * 2.4, alpha: fade * (reduceFlash ? FLASH_SAFE.maxHaloAlpha : 0.38) }),
  });
}

// Casing kinds: tint, width, height.
const SHELL_KINDS = { brass: [0xd9a441, 2.4, 5.5], shotshell: [0xc8322b, 3.6, 7], casing: [0x8a8f99, 4, 9] };
const SHELL_LIFE_TICKS = 12;
// The casing leaves the gun at chest height (34 world units, 1:1 on screen)
// and lands on the ground when the event expires.
const SHELL_START_LIFT = 30;

/**
 * One ejected casing at a given age: screen offsets from the muzzle point,
 * lift above the ground, tumble and fade. Ejects to the shooter's right and
 * drifts slightly back. Null for weapons that eject nothing.
 */
export function resolveShellEject({ weaponId, age = 0, direction, zoom = 1, seed = '' } = {}) {
  const kind = WEAPON_VFX[weaponId]?.shell.kind;
  const spec = SHELL_KINDS[kind];
  if (!spec || !(age >= 0) || age > SHELL_LIFE_TICKS) return null;
  const length = Math.hypot(direction?.x ?? 0, direction?.y ?? 0) || 1;
  const ux = (direction?.x ?? 1) / length;
  const uy = (direction?.y ?? 0) / length;
  const tumble = deterministicUnit(`${seed}:shell`);
  const lateral = age * (2.6 + tumble * 1.2) * zoom;
  const back = age * 0.5 * zoom;
  const t = age / SHELL_LIFE_TICKS;
  return F({
    kind,
    tint: spec[0],
    width: spec[1] * zoom,
    height: spec[2] * zoom,
    dx: -uy * lateral - ux * back,
    dy: ux * lateral - uy * back,
    lift: Math.max(0, SHELL_START_LIFT * (1 - t) + 40 * t * (1 - t)) * zoom,
    rotation: tumble * Math.PI * 2 + age * (0.7 + tumble * 0.5),
    alpha: age <= 8 ? 1 : Math.max(0, 1 - (age - 8) / 5),
  });
}

// Texture geometry. Concentric fills only composite, so the per-ring alpha is
// solved for a smooth accumulated curve (see contact-shadows.mjs).
const TEXTURE_RADIUS = 32;
function falloff(peak, power, rings) {
  const out = [];
  let accumulated = 0;
  for (let index = 0; index < rings; index += 1) {
    const factor = 1 - index / rings;
    const target = peak * (1 - factor ** 2) ** power;
    const alpha = (target - accumulated) / Math.max(1e-6, 1 - accumulated);
    accumulated = target;
    if (alpha > 0.002) out.push([TEXTURE_RADIUS * factor, alpha]);
  }
  return out;
}

/**
 * Bake the three white textures once, after the renderer exists: a hot soft
 * core, a hazy puff and a casing. Per-sprite tint colours them. The vendor
 * export has no gradient fill, so concentric rings are the available way.
 */
export function createWeaponVfxTextures({ renderer, GraphicsClass } = {}) {
  if (typeof renderer?.generateTexture !== 'function') throw new TypeError('renderer.generateTexture required');
  if (typeof GraphicsClass !== 'function') throw new TypeError('GraphicsClass required');
  const bake = (draw) => {
    const graphic = draw(new GraphicsClass());
    const texture = renderer.generateTexture({ target: graphic, resolution: 2, antialias: true });
    graphic.destroy();
    return texture;
  };
  const rings = (peak, power) => (graphic) => {
    for (const [radius, alpha] of falloff(peak, power, 14)) graphic.circle(0, 0, radius).fill({ color: HOT_WHITE, alpha });
    return graphic;
  };
  return F({
    core: bake(rings(1, 1.4)),
    puff: bake(rings(0.95, 1.6)),
    // A casing: a rounded slug with a darker open end so it tumbles legibly.
    shell: bake((graphic) => graphic
      .roundRect(-3, -7, 6, 14, 2).fill({ color: HOT_WHITE, alpha: 1 })
      .rect(-3, 4, 6, 3).fill({ color: 0, alpha: 0.35 })),
  });
}

/**
 * A frame-scoped pool of tinted sprites in two banks: a normal-blend bank for
 * puffs and casings and an additive bank above it for glows. `begin()` opens
 * a frame, `place()` claims a sprite, `finish()` hides what this frame did not
 * claim. Sprites are reused forever, so a busy frame followed by a quiet one
 * costs no allocation.
 */
export function createWeaponVfxPool({ ContainerClass, SpriteClass, textures, max = MAX_WEAPON_VFX_SPRITES } = {}) {
  if (typeof ContainerClass !== 'function') throw new TypeError('ContainerClass required');
  if (typeof SpriteClass !== 'function') throw new TypeError('SpriteClass required');
  if (!textures?.core || !textures?.puff || !textures?.shell) throw new TypeError('weapon VFX textures required');
  const container = new ContainerClass();
  container.label = 'weapon-vfx';
  const bank = (label, blendMode) => {
    const layer = new ContainerClass();
    layer.label = label;
    layer.blendMode = blendMode;
    container.addChild(layer);
    return { layer, sprites: [], cursor: 0 };
  };
  const banks = [bank('weapon-vfx-solid', 'normal'), bank('weapon-vfx-glow', 'add')];
  let dropped = 0;

  const place = ({ texture, x, y, width, height, rotation = 0, tint = HOT_WHITE, alpha = 1, additive = false } = {}) => {
    const source = textures[texture];
    if (!source || !(width > 0) || !(height > 0) || !(alpha > 0)) return false;
    if (banks[0].cursor + banks[1].cursor >= max) {
      dropped += 1;
      return false;
    }
    const target = banks[additive ? 1 : 0];
    let sprite = target.sprites[target.cursor];
    if (!sprite) {
      // Transfer only an unclaimed tail from the other blend bank. Two
      // separate high-water marks otherwise retain up to twice the cap.
      const other = banks[additive ? 0 : 1];
      if (other.sprites.length > other.cursor) {
        sprite = other.sprites.pop();
        other.layer.removeChild(sprite);
      } else {
        sprite = new SpriteClass({ texture: source });
        sprite.anchor.set(0.5, 0.5);
      }
      target.sprites.push(sprite);
      target.layer.addChild(sprite);
    }
    target.cursor += 1;
    sprite.texture = source;
    sprite.visible = true;
    sprite.position.set(x, y);
    sprite.width = width;
    sprite.height = height;
    sprite.rotation = rotation;
    sprite.tint = tint;
    sprite.alpha = Math.min(1, alpha);
    return true;
  };

  return F({
    artId: WEAPON_VFX_ART_ID,
    runtimeAuthority: 'projection-only',
    container,
    begin: () => {
      for (const target of banks) target.cursor = 0;
      dropped = 0;
    },
    place,
    finish: () => {
      for (const target of banks) {
        for (let index = target.cursor; index < target.sprites.length; index += 1) target.sprites[index].visible = false;
      }
    },
    get placed() { return banks[0].cursor + banks[1].cursor; },
    get dropped() { return dropped; },
  });
}
