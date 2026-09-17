// Held-weapon pages (HMH-N03). The pistol is native to every production hero
// atlas; the other seven weapons ship as one lazy WebP page per hero and
// weapon, rendered in that hero's own Blender scene with the weapon skinned to
// the pistol bone. A page frame is therefore a drop-in replacement for the
// hero's weapon-layer frame: same directions, same clip states, same ground
// pivot, drawn at pixelDensity x the hero's pixel density.
//
// Loaded only through dynamic import() from main.mjs (not initial JS). Nothing
// here reads or writes simulation state; a page that fails to load leaves the
// existing authored overlay in charge of that weapon.
import { freezeDeep } from './value-guards.mjs';

export const HELD_WEAPON_PIPELINE_ID = 'hmh-reboot-held-weapons-v1';
export const HELD_WEAPON_IDS = Object.freeze(['scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard']);
export const HELD_WEAPON_CLIPS = freezeDeep({
  aim: { frames: 6, fps: 6, loop: true },
  'pistol-fire': { frames: 3, fps: 15, loop: true },
  dash: { frames: 4, fps: 15, loop: false },
  reload: { frames: 8, fps: 16, loop: false },
  'idle-check': { frames: 8, fps: 4, loop: false },
});
// Lossless exact WebP pages, fetched one weapon at a time on first equip.
// 1.5 MiB per page, 8 MiB across a hero's seven pages (a ceiling, never an
// initial transfer); the manifest carries the same numbers.
export const HELD_WEAPON_PAGE_MAX_BYTES = 1536 * 1024;
export const HELD_WEAPON_HERO_MAX_BYTES = 8 * 1024 * 1024;
const DIRECTIONS = Object.freeze(['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']);
const PAGE_SIZES = Object.freeze([512, 1024, 2048]);
const HERO_BODY_UNITS = 160;

const integer = (value) => Number.isInteger(value) && value >= 0;
const positive = (value) => integer(value) && value > 0;
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.000001;
const rect = (value) => value && integer(value.x) && integer(value.y) && positive(value.w) && positive(value.h);
const isWeaponId = (value) => HELD_WEAPON_IDS.includes(value);

export function heldWeaponMetadataUrl(actorId) {
  if (typeof actorId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(actorId)) throw new TypeError('bad actor id');
  return `/assets/generated/hmh-held-weapons/${actorId}/${actorId}-held-weapons.json`;
}

function validateFrame(source, weaponId, actorId, page, frameSize, sourcePivot) {
  const clip = HELD_WEAPON_CLIPS[source.state];
  if (!clip || !DIRECTIONS.includes(source.direction) || !integer(source.frameIndex) || source.frameIndex >= clip.frames) throw new TypeError('held weapon clip contract drift');
  const expectedId = `${actorId}__${weaponId}__${source.state}__${source.direction}__${String(source.frameIndex).padStart(3, '0')}`;
  if (source.id !== expectedId) throw new TypeError('held weapon frame id mismatch');
  const { frame, orig, trim, spriteSourceSize: crop, pivot, anchor, grip, muzzle } = source;
  if (!rect(frame) || frame.x + frame.w > page.width || frame.y + frame.h > page.height
    || !rect(trim) || !rect(crop) || !positive(orig?.w) || !positive(orig?.h)
    || crop.w !== orig.w || crop.h !== orig.h || trim.w !== frame.w || trim.h !== frame.h
    || trim.x + trim.w > orig.w || trim.y + trim.h > orig.h
    || crop.x + crop.w > frameSize.w || crop.y + crop.h > frameSize.h
    || !close(sourcePivot.x - crop.x, pivot?.x) || !close(sourcePivot.y - crop.y, pivot?.y)
    || pivot.x < 0 || pivot.y < 0 || pivot.x > orig.w || pivot.y > orig.h
    || !close(anchor?.x, pivot.x / orig.w) || !close(anchor?.y, pivot.y / orig.h)
    || !positive(source.opaquePixels) || source.opaquePixels > frame.w * frame.h
    || !/^[a-f0-9]{64}$/u.test(source.sourcePixelSha256)
    || ![grip?.x, grip?.y, muzzle?.x, muzzle?.y].every(Number.isFinite)) throw new TypeError('invalid held weapon frame geometry');
  // The grip and muzzle are reported relative to the ground pivot and must
  // stay inside the frame the weapon was rendered in.
  for (const point of [grip, muzzle]) {
    if (Math.abs(point.x) > frameSize.w || Math.abs(point.y) > frameSize.h) throw new TypeError('held weapon socket outside its frame');
  }
}

/**
 * Validate one hero's held-weapon metadata into a frozen lookup index.
 * `frameFor(weaponId, state, direction, frameIndex)` returns the page frame
 * or undefined; `pageFor(weaponId)` the page descriptor.
 */
export function createHeldWeaponIndex(metadata, { actorId } = {}) {
  if (metadata?.schemaVersion !== 1 || metadata.pipelineId !== HELD_WEAPON_PIPELINE_ID) throw new TypeError('invalid held weapon atlas');
  if (metadata.classification !== 'production-art' || metadata.runtimeAuthority !== 'projection-only') throw new TypeError('held weapon authority drift');
  if (typeof actorId === 'string' && metadata.actorId !== actorId) throw new TypeError('held weapon atlas identity mismatch');
  heldWeaponMetadataUrl(metadata.actorId);
  const { heroFrameSize, coverage, pixelDensity, frameSize, sourcePivot } = metadata;
  if (!positive(heroFrameSize) || !Number.isFinite(coverage) || coverage < 1 || !Number.isFinite(pixelDensity) || pixelDensity < 1
    || frameSize?.w !== Math.round(heroFrameSize * coverage * pixelDensity) || frameSize.h !== frameSize.w
    || !integer(sourcePivot?.x) || !integer(sourcePivot?.y) || sourcePivot.x >= frameSize.w || sourcePivot.y >= frameSize.h) throw new TypeError('invalid held weapon frame contract');
  if (!/^[a-f0-9]{64}$/u.test(metadata.sourceSha256) || !/^[a-f0-9]{64}$/u.test(metadata.weaponSceneSha256)) throw new TypeError('held weapon provenance is missing');
  for (const [state, clip] of Object.entries(HELD_WEAPON_CLIPS)) {
    const declared = metadata.clips?.[state];
    if (declared?.frames !== clip.frames || declared.fps !== clip.fps || (declared.loop ?? true) !== clip.loop) throw new TypeError('held weapon clip table drift');
  }
  if (!metadata.weapons || typeof metadata.weapons !== 'object') throw new TypeError('held weapon pages are required');
  const pages = new Map();
  const frameByKey = new Map();
  let totalBytes = 0;
  for (const weaponId of HELD_WEAPON_IDS) {
    const page = metadata.weapons[weaponId];
    if (!page || page.weaponId !== weaponId || !Array.isArray(page.pages) || page.pages.length === 0 || page.pages.length > 4) throw new TypeError(`missing held weapon page ${weaponId}`);
    let weaponBytes = 0;
    const images = page.pages.map((image, pageIndex) => {
      const expected = `./${metadata.actorId}-${weaponId}${pageIndex === 0 ? '' : `-${pageIndex}`}.webp`;
      const { width, height } = image?.dimensions ?? {};
      if (image?.image !== expected || !PAGE_SIZES.includes(width) || height !== width) throw new RangeError('invalid held weapon page dimensions');
      if (!positive(image.imageBytes) || image.imageBytes > HELD_WEAPON_PAGE_MAX_BYTES || !/^[a-f0-9]{64}$/u.test(image.imageSha256)) throw new RangeError('held weapon page transfer budget exceeded');
      weaponBytes += image.imageBytes;
      return Object.freeze({ image: image.image, imageBytes: image.imageBytes, imageSha256: image.imageSha256, dimensions: Object.freeze({ width, height }) });
    });
    if (page.imageBytes !== weaponBytes) throw new RangeError('held weapon page byte ledger drift');
    if (page.fireAction !== null && page.fireAction !== 'pistol-fire') throw new TypeError('unknown held weapon fire action');
    if (!Array.isArray(page.frames) || page.frameCount !== page.frames.length) throw new TypeError('held weapon page frames are required');
    totalBytes += weaponBytes;
    const seen = new Set();
    for (const source of page.frames) {
      if (!integer(source.page) || source.page >= images.length) throw new TypeError('held weapon frame page out of range');
      validateFrame(source, weaponId, metadata.actorId, images[source.page].dimensions, frameSize, sourcePivot);
      const key = `${weaponId}|${source.state}|${source.direction}|${source.frameIndex}`;
      if (seen.has(key)) throw new TypeError('duplicate held weapon frame');
      seen.add(key);
      // Expand to the hero frame shape the display already consumes.
      frameByKey.set(key, freezeDeep({
        ...structuredClone(source), weaponId, layer: 'weapon', fps: HELD_WEAPON_CLIPS[source.state].fps, loop: HELD_WEAPON_CLIPS[source.state].loop,
        sourceSize: { w: frameSize.w, h: frameSize.h }, sourcePivot: { x: sourcePivot.x, y: sourcePivot.y }, heldPage: true,
      }));
    }
    for (const [state, clip] of Object.entries(HELD_WEAPON_CLIPS)) {
      for (const direction of DIRECTIONS) {
        for (let frame = 0; frame < clip.frames; frame += 1) {
          if (!seen.has(`${weaponId}|${state}|${direction}|${frame}`)) throw new RangeError(`incomplete held weapon coverage for ${weaponId}`);
        }
      }
    }
    pages.set(weaponId, Object.freeze({ weaponId, pages: Object.freeze(images), imageBytes: weaponBytes, fireAction: page.fireAction, frameCount: page.frameCount }));
  }
  if (totalBytes !== metadata.totalImageBytes || totalBytes > HELD_WEAPON_HERO_MAX_BYTES) throw new RangeError('held weapon hero transfer budget exceeded');
  // Body units per page pixel: the hero sprite draws its 256 px frame at
  // 160 / 256 units per pixel, and a page pixel is 1 / pixelDensity of one.
  const spriteScale = HERO_BODY_UNITS / (heroFrameSize * pixelDensity);
  return Object.freeze({
    pipelineId: metadata.pipelineId,
    actorId: metadata.actorId,
    variantId: metadata.variantId,
    runtimeAuthority: metadata.runtimeAuthority,
    heroFrameSize,
    pixelDensity,
    coverage,
    frameSize: Object.freeze({ ...frameSize }),
    sourcePivot: Object.freeze({ ...sourcePivot }),
    spriteScale,
    totalImageBytes: totalBytes,
    weaponIds: HELD_WEAPON_IDS,
    pageFor: (weaponId) => pages.get(weaponId),
    frameFor: (weaponId, state, direction, frameIndex) => frameByKey.get(`${weaponId}|${state}|${direction}|${frameIndex}`),
    calibration: freezeDeep(Array.isArray(metadata.calibration) ? structuredClone(metadata.calibration) : []),
  });
}

/**
 * Map the hero's chosen weapon-layer frame onto the held page. States the
 * page does not carry (melee, grenade, death) return null so the native layer
 * keeps showing its own knife, grenade or pistol. A hero clip with a different
 * sample count (the two-frame base aim before the motion page arrives) maps
 * proportionally onto the page clip.
 */
export function resolveHeldWeaponFrame(index, { weaponId, state, direction, frameIndex, frameCount = HELD_WEAPON_CLIPS[state]?.frames } = {}) {
  const clip = HELD_WEAPON_CLIPS[state];
  if (!index?.frameFor || !clip || !isWeaponId(weaponId) || !DIRECTIONS.includes(direction) || !integer(frameIndex) || !positive(frameCount)) return null;
  const mapped = Math.min(clip.frames - 1, Math.floor(frameIndex * clip.frames / frameCount));
  return index.frameFor(weaponId, state, direction, mapped) ?? null;
}

/**
 * Creates a per-hero loader. `request(weaponId)` fetches the hero metadata
 * once and the weapon's page once, then attaches both to the display; every
 * later call for the same weapon is a no-op. Failures are recorded on the
 * display container (`heldWeaponStatus`/`heldWeaponError`) and never retried
 * within the session, so a broken page cannot loop the network.
 */
export function createHeldWeaponLoader({ selection, display, Assets, fetchImpl = globalThis.fetch } = {}) {
  if (!selection?.actorId || typeof display?.attachHeldWeaponPage !== 'function' || typeof Assets?.load !== 'function') throw new TypeError('held weapon loader needs a selection, display and Assets');
  let indexPromise = null;
  const requested = new Map();
  const loadIndex = () => indexPromise ??= fetchImpl(heldWeaponMetadataUrl(selection.actorId), { credentials: 'same-origin' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Held weapon metadata failed: ${response.status}`);
      return createHeldWeaponIndex(await response.json(), { actorId: selection.actorId });
    });
  const request = (weaponId) => {
    if (!isWeaponId(weaponId)) return null;
    if (!requested.has(weaponId)) {
      display.container.heldWeaponStatus ??= 'loading';
      requested.set(weaponId, loadIndex().then(async (index) => {
        const page = index.pageFor(weaponId);
        const textures = await Promise.all(page.pages.map(async (image) => {
          const texture = await Assets.load(`/assets/generated/hmh-held-weapons/${index.actorId}/${image.image.replace(/^\.\//u, '')}`);
          if (texture?.source?.width !== image.dimensions.width || texture.source.height !== image.dimensions.height) throw new RangeError('decoded held weapon page dimensions mismatch');
          return texture;
        }));
        if (display.container.destroyed) return null;
        display.attachHeldWeaponPage({ weaponId, index, textures });
        display.container.heldWeaponStatus = 'ready';
        return page;
      }).catch((error) => {
        display.container.heldWeaponStatus = 'fallback';
        display.container.heldWeaponError = String(error?.message ?? error);
        return null;
      }));
    }
    return requested.get(weaponId);
  };
  return Object.freeze({ request, get requested() { return [...requested.keys()]; } });
}
