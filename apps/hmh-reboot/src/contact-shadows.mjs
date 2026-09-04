import { clamp, finite } from './value-guards.mjs';

// Projection-only ground contact shadows. Actors and props were drawing with
// nothing between their feet and the terrain, so they read as stickers pasted
// onto the ground plane rather than as bodies standing on it.
//
// Everything here is art. It reads projected screen points and writes nothing
// back, so it can never reach the deterministic run.
export const CONTACT_SHADOW_ART_ID = 'projection-contact-shadows-v1';

// One shared layer, one shared texture, one pooled sprite per shadow. The cap
// is a hard ceiling on that pool so a dense arena cannot grow the scene graph
// without bound; anything past it is reported rather than silently skipped.
export const MAX_CONTACT_SHADOWS = 160;

// The dominant world cast-shadow colour (world-production-art structures and
// raised surfaces both use 0x03070b), so authored props and vector geometry
// agree instead of reading as two lighting models.
export const SHADOW_TINT = 0x03070b;

// Sits between the world's own vector cast shadows (0.40-0.48) and the vector
// enemy shadow (0.55), so one lighting model reads across the whole frame.
export const CONTACT_SHADOW_BASE_ALPHA = 0.48;
// A shadow spills past the body that casts it, or the only visible part of it
// is the sliver the sprite fails to cover.
const FOOTPRINT_SPILL = 1.25;
// The camera sits at 55 degrees. The baked hero shadow frame is 66x32, so the
// ground plane compresses to roughly 0.46-0.48 of its width.
const GROUND_ASPECT = 0.46;
// A lifted body's shadow shrinks by at most this much before it saturates.
const LIFT_SHRINK = 0.3;
// Lift is measured against the body's own size: a small pickup reads as
// airborne much sooner than a landmark does.
const LIFT_REACH = 2.5;
const MIN_ALPHA = 0.06;
// The occlusion pool reaches past the core blob to darken the ground a wide
// base sits in.
const AO_SPILL = 1.45;
const AO_ALPHA = 0.62;

// Texture geometry. The blob is baked once at this size and then stretched per
// sprite, so it has to carry enough rings that a landmark-sized shadow still
// reads as a gradient rather than as contour lines.
const TEXTURE_RADIUS = 64;
const TEXTURE_ASPECT = 0.5;
const RING_COUNT = 22;

/**
 * Concentric fills only composite; each ring can only add opacity. Solving for
 * the per-ring alpha that lands the accumulated coverage on a smooth curve is
 * what separates a soft blob from four visible contour bands.
 */
function falloffRings(peak, power) {
  const rings = [];
  let accumulated = 0;
  for (let index = 0; index < RING_COUNT; index += 1) {
    const factor = 1 - index / RING_COUNT;
    // Dense under the body, feathered to nothing at the rim. A linear ramp
    // reads as haze; this keeps a real core so the contact is legible.
    const target = peak * (1 - factor ** 2) ** power;
    const alpha = (target - accumulated) / Math.max(1e-6, 1 - accumulated);
    accumulated = target;
    if (alpha > 0.002) rings.push({ rx: TEXTURE_RADIUS * factor, ry: TEXTURE_RADIUS * TEXTURE_ASPECT * factor, alpha });
  }
  return rings;
}

// The core blob: dense under the body, feathered out to nothing at the rim.
const BLOB_RINGS = Object.freeze(falloffRings(1, 1.6).map((ring) => Object.freeze(ring)));
// Ambient occlusion: the same shape, far wider and far softer, so a big base
// sits in a pool of darkened ground instead of wearing a halo.
const AO_RINGS = Object.freeze(falloffRings(0.55, 2.6).map((ring) => Object.freeze(ring)));

/**
 * Resolve the screen geometry of one contact shadow. Pure: same input, same
 * frozen output, no engine and no run state.
 */
export function resolveContactShadow({ footprintPx, lift = 0, zoom = 1, baseAlpha = CONTACT_SHADOW_BASE_ALPHA } = {}) {
  finite(footprintPx, 'footprintPx');
  finite(lift, 'lift');
  finite(zoom, 'zoom');
  finite(baseAlpha, 'baseAlpha');
  const reach = Math.max(1, Math.abs(footprintPx) * LIFT_REACH);
  const liftRatio = clamp(Math.abs(lift) / reach, 0, 1);
  const width = footprintPx * 2 * FOOTPRINT_SPILL * zoom * (1 - liftRatio * LIFT_SHRINK);
  return Object.freeze({
    width,
    height: width * GROUND_ASPECT,
    alpha: clamp(baseAlpha * (1 - liftRatio), MIN_ALPHA, Math.max(MIN_ALPHA, baseAlpha)),
    runtimeAuthority: 'projection-only',
  });
}

const drawRings = (graphic, rings) => {
  for (const ring of rings) graphic.ellipse(0, 0, ring.rx, ring.ry).fill({ color: 0xffffff, alpha: ring.alpha });
  return graphic;
};

/**
 * Bake the two shadow textures once, after the renderer exists. Concentric
 * white ellipses give the soft falloff; the per-sprite tint colours them. The
 * child's engine chunk re-exports a fixed symbol list that has no gradient
 * fill in it, so this is the available way to get a soft blob.
 */
export function createContactShadowTextures({ renderer, GraphicsClass } = {}) {
  if (typeof renderer?.generateTexture !== 'function') throw new TypeError('renderer with generateTexture is required');
  if (typeof GraphicsClass !== 'function') throw new TypeError('GraphicsClass is required');
  const bake = (rings) => {
    const graphic = drawRings(new GraphicsClass(), rings);
    const texture = renderer.generateTexture({ target: graphic, resolution: 2, antialias: true });
    graphic.destroy();
    return texture;
  };
  return Object.freeze({ blob: bake(BLOB_RINGS), ao: bake(AO_RINGS) });
}

/**
 * A frame-scoped pool. `begin()` opens a frame, `place()` claims a sprite,
 * `finish()` hides whatever this frame did not claim. Sprites are reused
 * forever, so a busy frame followed by a quiet one costs no allocation.
 */
export function createContactShadowPool({ ContainerClass, SpriteClass, textures, max = MAX_CONTACT_SHADOWS } = {}) {
  if (typeof ContainerClass !== 'function') throw new TypeError('ContainerClass is required');
  if (typeof SpriteClass !== 'function') throw new TypeError('SpriteClass is required');
  if (!textures?.blob || !textures?.ao) throw new TypeError('contact shadow textures are required');
  const container = new ContainerClass();
  container.label = 'ground-contact-shadows';
  const blobs = [];
  const rings = [];
  let blobCursor = 0;
  let ringCursor = 0;
  let dropped = 0;

  const claim = (bank, cursor, texture) => {
    let sprite = bank[cursor];
    if (!sprite) {
      sprite = new SpriteClass({ texture });
      sprite.label = 'ground-contact-shadow';
      sprite.anchor.set(0.5, 0.5);
      sprite.tint = SHADOW_TINT;
      bank.push(sprite);
      container.addChild(sprite);
    }
    sprite.visible = true;
    return sprite;
  };

  const begin = () => {
    blobCursor = 0;
    ringCursor = 0;
    dropped = 0;
  };

  const place = ({ x, y, footprintPx, lift = 0, zoom = 1, alpha = CONTACT_SHADOW_BASE_ALPHA, ao = false } = {}) => {
    if (blobCursor >= max) {
      dropped += 1;
      return false;
    }
    const resolved = resolveContactShadow({ footprintPx, lift, zoom, baseAlpha: alpha });
    if (resolved.width <= 0) return false;
    if (ao && ringCursor < max) {
      const ring = claim(rings, ringCursor, textures.ao);
      ringCursor += 1;
      ring.position.set(x, y);
      ring.width = resolved.width * AO_SPILL;
      ring.height = resolved.height * AO_SPILL;
      ring.alpha = resolved.alpha * AO_ALPHA;
    }
    const sprite = claim(blobs, blobCursor, textures.blob);
    blobCursor += 1;
    sprite.position.set(x, y);
    sprite.width = resolved.width;
    sprite.height = resolved.height;
    sprite.alpha = resolved.alpha;
    return true;
  };

  const finish = () => {
    for (let index = blobCursor; index < blobs.length; index += 1) blobs[index].visible = false;
    for (let index = ringCursor; index < rings.length; index += 1) rings[index].visible = false;
  };

  return Object.freeze({
    artId: CONTACT_SHADOW_ART_ID,
    container,
    begin,
    place,
    finish,
    get count() { return blobCursor; },
    get dropped() { return dropped; },
  });
}
