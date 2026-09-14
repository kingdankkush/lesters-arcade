// Selected-hero animation data is lazy-loaded. This module has no simulation writes.
import { freezeDeep } from './value-guards.mjs';

export const HERO_MOTION_CLIPS = freezeDeep({
  'lower-body': { idle: { frames: 6, fps: 6 }, run: { frames: 12, fps: 24 } },
  'torso-head': { aim: { frames: 6, fps: 6 }, reload: { frames: 8, fps: 16, loop: false }, 'idle-check': { frames: 8, fps: 4, loop: false } },
  weapon: { aim: { frames: 6, fps: 6 }, reload: { frames: 8, fps: 16, loop: false }, 'idle-check': { frames: 8, fps: 4, loop: false } },
});
export const HERO_MOTION_PAGE_MAX_BYTES = 4 * 1024 * 1024;
export const HERO_WITH_MOTION_MAX_BYTES = 8 * 1024 * 1024;
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const integer = value => Number.isInteger(value) && value >= 0;
const positive = value => integer(value) && value > 0;
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= .000001;
function readonly(map) {
  return Object.freeze({ get size() { return map.size; }, get: key => map.get(key), has: key => map.has(key),
    values: () => map.values(), keys: () => map.keys(), entries: () => map.entries(),
    [Symbol.iterator]: () => map[Symbol.iterator]() });
}

export function createHeroMotionAnimator() {
  let idleSince = null;
  let lastTick = -1;
  return state => {
    const tick = state.simulationTick;
    if (!integer(tick)) return state;
    if (tick < lastTick) idleSince = null;
    lastTick = tick;
    if (state.action !== 'aim' || state.reduceMotion) { idleSince = null; return state; }
    const progress = state.reloadProgress;
    if (Number.isFinite(progress) && progress > 0 && progress < 1) {
      idleSince = null;
      return { ...state, action: 'reload', actionTick: Math.round(progress * 7 * 60 / 16) };
    }
    if (state.locomotion === 'moving' || !state.idleAllowed) { idleSince = null; return state; }
    if (idleSince === null) idleSince = tick;
    const age = tick - idleSince;
    if (age >= 300) { idleSince = tick; return state; }
    return age >= 180 ? { ...state, action: 'idle-check', actionTick: age - 180 } : state;
  };
}

export function createHeroMotionIndex(base, metadata) {
  if (!base?.frameByKey || metadata?.motionSchema !== 1 || metadata.runtimeAuthority !== 'projection-only'
    || metadata.actorId !== base.actorId || metadata.variantId !== base.variantId
    || metadata.image !== `./${base.actorId}-motion.webp`) throw new TypeError('motion atlas identity mismatch');
  const { width, height } = metadata.dimensions ?? {};
  if (![1024, 2048].includes(width) || height !== width) throw new RangeError('invalid motion atlas dimensions');
  if (!positive(metadata.imageBytes) || metadata.imageBytes > HERO_MOTION_PAGE_MAX_BYTES
    || !positive(metadata.baseImageBytes) || metadata.imageBytes + metadata.baseImageBytes > HERO_WITH_MOTION_MAX_BYTES) throw new RangeError('selected-hero motion transfer budget exceeded');
  if (![metadata.sourceSha256, metadata.imageSha256].every(value => /^[a-f0-9]{64}$/.test(value))) throw new TypeError('motion provenance is missing');
  if (!Array.isArray(metadata.frames)) throw new TypeError('motion frames are required');
  const frames = new Map(base.frameByKey);
  const clips = new Map(base.clipByKey);
  const seen = new Set();
  const original = base.frameByKey.get('lower-body|idle|east|0');
  for (const source of metadata.frames) {
    const clip = HERO_MOTION_CLIPS[source.layer]?.[source.state];
    if (!clip || !DIRECTIONS.includes(source.direction) || !integer(source.frameIndex) || source.frameIndex >= clip.frames
      || source.fps !== clip.fps || source.loop !== (clip.loop !== false)) throw new TypeError('motion clip contract drift');
    const key = `${source.layer}|${source.state}|${source.direction}|${source.frameIndex}`;
    const expectedId = `${base.actorId}__${source.layer}__${source.state}__${source.direction}__${String(source.frameIndex).padStart(3, '0')}`;
    if (seen.has(key) || source.id !== expectedId) throw new TypeError('duplicate or mismatched motion frame');
    seen.add(key);
    const { frame, orig, trim, sourceSize, spriteSourceSize: crop, sourcePivot, pivot, anchor } = source;
    const rect = value => value && integer(value.x) && integer(value.y) && positive(value.w) && positive(value.h);
    if (!rect(frame) || frame.x + frame.w > width || frame.y + frame.h > height
      || !rect(trim) || !rect(crop) || !positive(orig?.w) || !positive(orig?.h)
      || crop.w !== orig.w || crop.h !== orig.h || trim.w !== frame.w || trim.h !== frame.h
      || trim.x + trim.w > orig.w || trim.y + trim.h > orig.h
      || sourceSize?.w !== original.sourceSize.w || sourceSize?.h !== original.sourceSize.h
      || crop.x + crop.w > sourceSize.w || crop.y + crop.h > sourceSize.h
      || !close(sourcePivot?.x, original.sourcePivot.x) || !close(sourcePivot?.y, original.sourcePivot.y)
      || !close(sourcePivot.x - crop.x, pivot?.x) || !close(sourcePivot.y - crop.y, pivot?.y)
      || pivot.x < 0 || pivot.y < 0 || pivot.x > orig.w || pivot.y > orig.h
      || !close(anchor?.x, pivot.x / orig.w) || !close(anchor?.y, pivot.y / orig.h)
      || !positive(source.opaquePixels) || source.opaquePixels > frame.w * frame.h) throw new TypeError('invalid motion frame geometry');
    frames.set(key, freezeDeep({ ...structuredClone(source), motionPage: true }));
  }
  for (const [layer, states] of Object.entries(HERO_MOTION_CLIPS)) for (const [state, clip] of Object.entries(states)) {
    for (const direction of DIRECTIONS) {
      for (let frame = 0; frame < clip.frames; frame += 1) {
        if (!seen.has(`${layer}|${state}|${direction}|${frame}`)) throw new RangeError('incomplete native motion coverage');
      }
      clips.set(`${layer}|${state}|${direction}`, Object.freeze({ frameCount: clip.frames, fps: clip.fps, loop: clip.loop !== false }));
    }
  }
  return Object.freeze({ ...base, motionEnabled: true, motionBaseIndex: base,
    motionDimensions: Object.freeze({ width, height }), motionAnimator: createHeroMotionAnimator(),
    frameByKey: readonly(frames), clipByKey: readonly(clips) });
}

export async function loadHeroMotionPage({ selection, baseIndex, Assets }) {
  const root = `/assets/generated/hmh-hero-motion/${selection.actorId}/${selection.actorId}-motion`;
  const response = await fetch(`${root}.json`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Hero motion metadata failed: ${response.status}`);
  const index = createHeroMotionIndex(baseIndex, await response.json());
  const motionTexture = await Assets.load(`${root}.webp`);
  if (motionTexture.source.width !== index.motionDimensions.width || motionTexture.source.height !== index.motionDimensions.height) throw new RangeError('decoded hero motion dimensions mismatch');
  return { index, motionTexture };
}
