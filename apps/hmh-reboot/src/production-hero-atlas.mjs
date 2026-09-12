export const PRODUCTION_HERO_ASSETS = Object.freeze({
  'lit-commando': Object.freeze({
    actorId: 'lit-commando',
    variantId: 'reserve-vanguard',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.webp',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json',
    artSource: 'packed-textured-blend',
  }),
  'lit-valkyrie': Object.freeze({
    actorId: 'lit-valkyrie',
    variantId: 'plasma-striker',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.webp',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.json',
    artSource: 'packed-textured-blend',
  }),
  'lester-original': Object.freeze({
    actorId: 'lester-original',
    variantId: 'blue-mask-original',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lester-original/lester-original-production-pilot-atlas.webp',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lester-original/lester-original-production-pilot-atlas.json',
    artSource: 'packed-textured-blend',
  }),
  lilly: Object.freeze({
    actorId: 'lilly',
    variantId: 'gold-teal-veteran',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.webp',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.json',
    artSource: 'packed-textured-blend',
  }),
});
export const PRODUCTION_HERO_ATLAS_IMAGE_URL = PRODUCTION_HERO_ASSETS['lit-commando'].imageUrl;
export const PRODUCTION_HERO_ATLAS_METADATA_URL = PRODUCTION_HERO_ASSETS['lit-commando'].metadataUrl;
export const PRODUCTION_HERO_RUNTIME_SCALE = 0.58;
export const PRODUCTION_HERO_MAX_TEXTURE_BYTES = 4 * 1024 * 1024;
export const PRODUCTION_HERO_MAX_TEXTURE_TOTAL_BYTES = 16 * 1024 * 1024;

export function validateProductionHeroTextureTotalBytes(textureBytes) {
  if (!Array.isArray(textureBytes) || textureBytes.length !== 4) throw new TypeError('four hero texture byte counts are required');
  const total = textureBytes.reduce((sum, bytes) => sum + validateProductionHeroTextureBytes(bytes), 0);
  if (total > PRODUCTION_HERO_MAX_TEXTURE_TOTAL_BYTES) throw new RangeError('combined hero texture budget exceeded');
  return total;
}

const EXPECTED_PIPELINE_ID = 'hmh-reboot-production-hero-pilot-v1';
const EXPECTED_GAMEPLAY_BODY_PROFILE = 'human-medium-collision-v1';
const DIRECTION_BY_SIMULATION_INDEX = Object.freeze([
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
  'north',
  'north-east',
]);
const REQUIRED_LAYER_ORDER = Object.freeze(['shadow', 'lower-body', 'torso-head', 'weapon']);
const REQUIRED_CLIPS = Object.freeze({
  shadow: Object.freeze({ idle: Object.freeze({ frames: 1, fps: 1, loop: true }) }),
  'lower-body': Object.freeze({
    idle: Object.freeze({ frames: 2, fps: 2, loop: true }),
    run: Object.freeze({ frames: 6, fps: 12, loop: true }),
    dash: Object.freeze({ frames: 4, fps: 15, loop: false }),
    melee: Object.freeze({ frames: 5, fps: 15, loop: false }),
    grenade: Object.freeze({ frames: 5, fps: 12, loop: false }),
    death: Object.freeze({ frames: 6, fps: 8, loop: false }),
  }),
  'torso-head': Object.freeze({
    aim: Object.freeze({ frames: 2, fps: 2, loop: true }),
    'pistol-fire': Object.freeze({ frames: 3, fps: 15, loop: true }),
    hurt: Object.freeze({ frames: 2, fps: 10, loop: true }),
    dash: Object.freeze({ frames: 4, fps: 15, loop: false }),
    melee: Object.freeze({ frames: 5, fps: 15, loop: false }),
    grenade: Object.freeze({ frames: 5, fps: 12, loop: false }),
    death: Object.freeze({ frames: 6, fps: 8, loop: false }),
  }),
  weapon: Object.freeze({
    aim: Object.freeze({ frames: 2, fps: 2, loop: true }),
    'pistol-fire': Object.freeze({ frames: 3, fps: 15, loop: true }),
    dash: Object.freeze({ frames: 4, fps: 15, loop: false }),
    melee: Object.freeze({ frames: 5, fps: 15, loop: false }),
    grenade: Object.freeze({ frames: 5, fps: 12, loop: false }),
    death: Object.freeze({ frames: 6, fps: 8, loop: false }),
  }),
});
const REQUIRED_FRAME_COUNT = 648;
const APPROVED_NATIVE_ROUTES = Object.freeze({
  'lit-commando': Object.freeze({
    weapons: Object.freeze(['coin-blaster']),
    actions: Object.freeze(['melee', 'grenade']),
  }),
  'lit-valkyrie': Object.freeze({ weapons: Object.freeze(['coin-blaster']), actions: Object.freeze(['melee', 'grenade']) }),
  'lester-original': Object.freeze({ weapons: Object.freeze(['coin-blaster']), actions: Object.freeze(['melee', 'grenade']) }),
  lilly: Object.freeze({ weapons: Object.freeze(['coin-blaster']), actions: Object.freeze(['melee', 'grenade']) }),
});
const SIMULATION_HZ = 60;

function frameKey(layer, state, direction, frameIndex) {
  return `${layer}|${state}|${direction}|${frameIndex}`;
}

function clipKey(layer, state, direction) {
  return `${layer}|${state}|${direction}`;
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function logicalCoordinatesEqual(left, right, operandScale, authoredTolerance = 0) {
  // Subtraction error scales with its operands, not just the (possibly tiny)
  // result. This is comparison-only; raster validation and authored values stay exact.
  const tolerance = Math.max(authoredTolerance, 4 * Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right), Math.abs(operandScale)));
  return Math.abs(left - right) <= tolerance;
}

function arraysEqual(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function readOnlyMap(source, label) {
  const rejectMutation = () => {
    throw new TypeError(`${label} is immutable after production hero atlas validation`);
  };
  let view;
  view = Object.freeze({
    get size() { return source.size; },
    get(key) { return source.get(key); },
    has(key) { return source.has(key); },
    keys() { return source.keys(); },
    values() { return source.values(); },
    entries() { return source.entries(); },
    forEach(callback, thisArg) {
      if (typeof callback !== 'function') throw new TypeError('read-only map callback must be a function');
      for (const [key, value] of source) callback.call(thisArg, value, key, view);
    },
    [Symbol.iterator]() { return source[Symbol.iterator](); },
    set: rejectMutation,
    delete: rejectMutation,
    clear: rejectMutation,
  });
  return view;
}

export function directionNameForProductionIndex(index) {
  if (!Number.isInteger(index)) throw new TypeError('direction index must be an integer');
  return DIRECTION_BY_SIMULATION_INDEX[((index % 8) + 8) % 8];
}

export function productionHeroAsset(actorId) {
  const asset = PRODUCTION_HERO_ASSETS[actorId];
  if (!asset) throw new TypeError(`unknown approved production hero ${actorId}`);
  return asset;
}

export function validateProductionHeroTextureBytes(bytes) {
  if (!Number.isInteger(bytes) || bytes < 0) throw new TypeError('production hero texture bytes must be a non-negative integer');
  if (bytes > PRODUCTION_HERO_MAX_TEXTURE_BYTES) {
    throw new RangeError(`production hero texture ${bytes.toLocaleString('en-US')} bytes exceeds the ${PRODUCTION_HERO_MAX_TEXTURE_BYTES.toLocaleString('en-US')} byte limit`);
  }
  return bytes;
}

export function createProductionHeroAtlasIndex(metadata, expectedAsset = PRODUCTION_HERO_ASSETS['lit-commando']) {
  const approvedAsset = productionHeroAsset(expectedAsset?.actorId);
  if (metadata?.schemaVersion !== 2) throw new TypeError('production hero atlas schemaVersion 2 is required');
  if (metadata.pipelineId !== EXPECTED_PIPELINE_ID) throw new TypeError('unexpected production hero pipeline id');
  if (metadata.actorId !== approvedAsset.actorId || metadata.variantId !== approvedAsset.variantId) throw new TypeError('unexpected production hero identity');
  if (metadata.classification !== 'production-art') throw new TypeError('production-art classification is required');
  if (metadata.runtimeAuthority !== 'projection-only') throw new TypeError('production hero must remain projection-only');
  if (metadata.gameplayBodyProfile !== EXPECTED_GAMEPLAY_BODY_PROFILE) throw new TypeError('production hero gameplay body profile drifted');
  if (metadata.image?.split('/').pop() !== approvedAsset.imageUrl.split('/').pop()) throw new TypeError('production hero atlas image does not match the approved runtime asset');
  if (!arraysEqual(metadata.layers, REQUIRED_LAYER_ORDER)) throw new TypeError('production hero layer order is invalid');
  if (!arraysEqual(metadata.composition?.layerOrder, REQUIRED_LAYER_ORDER)) throw new TypeError('production hero composition order is invalid');
  if (metadata.composition?.weaponSocket !== 'weapon_socket' || metadata.composition?.independentDirections !== true) throw new TypeError('production hero composition contract is invalid');
  if (!Array.isArray(metadata.frames) || metadata.frames.length !== REQUIRED_FRAME_COUNT) throw new TypeError(`production hero atlas requires exactly ${REQUIRED_FRAME_COUNT} authored frames`);

  const frameByKey = new Map();
  const clipByKey = new Map();
  const frameIds = new Set();
  let releasedPropFrames = 0;
  for (const source of metadata.frames) {
    if (!REQUIRED_LAYER_ORDER.includes(source.layer)) throw new TypeError(`unknown production hero layer ${source.layer}`);
    if (!Object.hasOwn(REQUIRED_CLIPS[source.layer], source.state)) throw new TypeError(`unknown production hero state ${source.layer}|${source.state}`);
    if (!DIRECTION_BY_SIMULATION_INDEX.includes(source.direction)) throw new TypeError(`unknown production hero direction ${source.direction}`);
    if (!Number.isInteger(source.frameIndex) || source.frameIndex < 0) throw new TypeError('invalid production hero frame index');
    if (typeof source.id !== 'string' || !source.id || frameIds.has(source.id)) throw new TypeError(`duplicate or invalid production hero frame id ${source.id}`);
    frameIds.add(source.id);
    if (![source.frame?.x, source.frame?.y, source.frame?.w, source.frame?.h].every(Number.isInteger)
      || source.frame.x < 0 || source.frame.y < 0 || source.frame.w <= 0 || source.frame.h <= 0) throw new TypeError('invalid production hero atlas rectangle');
    if (!Number.isInteger(source.opaquePixels) || source.opaquePixels < 0
      || source.opaquePixels > source.frame.w * source.frame.h) {
      throw new TypeError('production hero opaquePixels must be a non-negative integer within the packed raster area');
    }
    if (![source.anchor?.x, source.anchor?.y].every(Number.isFinite)) throw new TypeError('invalid production hero anchor');
    if (source.sourceSize !== undefined && (!source.sourceSize
      || !Number.isInteger(source.sourceSize.w) || source.sourceSize.w <= 0
      || !Number.isInteger(source.sourceSize.h) || source.sourceSize.h <= 0)) {
      throw new TypeError('production hero source size must contain positive integer dimensions');
    }
    if (metadata.schemaVersion === 2) {
      const { orig, trim, sourceSize, spriteSourceSize, sourcePivot, pivot, anchor, frame } = source;
      const validPositiveRect = (rect) => rect
        && [rect.w, rect.h].every((n) => Number.isInteger(n) && n > 0)
        && [rect.x, rect.y].every((n) => Number.isInteger(n) && n >= 0);
      if (!orig || !sourceSize || !validPositiveRect(trim) || !validPositiveRect(spriteSourceSize)
        || ![orig.w, orig.h].every((n) => Number.isInteger(n) && n > 0)
        || spriteSourceSize.w !== orig.w || spriteSourceSize.h !== orig.h
        || spriteSourceSize.x + orig.w > sourceSize.w || spriteSourceSize.y + orig.h > sourceSize.h
        || trim.x + trim.w > orig.w || trim.y + trim.h > orig.h
        || trim.w !== frame.w || trim.h !== frame.h
        || ![sourcePivot?.x, sourcePivot?.y, pivot?.x, pivot?.y].every(Number.isFinite)
        || !logicalCoordinatesEqual(sourcePivot.x - spriteSourceSize.x, pivot.x, sourcePivot.x)
        || !logicalCoordinatesEqual(sourcePivot.y - spriteSourceSize.y, pivot.y, sourcePivot.y)
        || pivot.x < 0 || pivot.x > orig.w || pivot.y < 0 || pivot.y > orig.h
        // Preserve the existing six-decimal authored-anchor serialization budget.
        || !logicalCoordinatesEqual(anchor.x, pivot.x / orig.w, 1, 0.000001)
        || !logicalCoordinatesEqual(anchor.y, pivot.y / orig.h, 1, 0.000001)) {
        throw new TypeError('invalid trimmed production hero logical frame');
      }
    }
    if (source.visibility !== undefined) {
      const approvedGrenade = APPROVED_NATIVE_ROUTES[approvedAsset.actorId].actions.includes('grenade')
        && Array.isArray(metadata.nativeActionIds) && metadata.nativeActionIds.includes('grenade');
      if (source.visibility !== 'source-prop-released' || metadata.schemaVersion !== 2
        || source.layer !== 'weapon' || source.state !== 'grenade' || ![3, 4].includes(source.frameIndex)
        || !approvedGrenade || source.opaquePixels !== 0
        || source.frame.w !== 1 || source.frame.h !== 1 || source.orig.w !== 1 || source.orig.h !== 1
        || source.trim.x !== 0 || source.trim.y !== 0 || source.trim.w !== 1 || source.trim.h !== 1
        || source.pivot.x !== 0 || source.pivot.y !== 0) {
        throw new TypeError('invalid released native prop visibility or transparent cell');
      }
      releasedPropFrames += 1;
    } else if (source.opaquePixels === 0) {
      throw new TypeError('zero-opaque frame requires explicit released-prop visibility');
    }
    const normalized = Object.freeze({
      ...source,
      frame: Object.freeze({ ...source.frame }),
      pivot: Object.freeze({ ...source.pivot }),
      anchor: Object.freeze({ ...source.anchor }),
      sourcePivot: Object.freeze({ ...source.sourcePivot }),
      ...(source.sourceSize ? { sourceSize: Object.freeze({ ...source.sourceSize }) } : {}),
      ...(source.spriteSourceSize ? { spriteSourceSize: Object.freeze({ ...source.spriteSourceSize }) } : {}),
      ...(metadata.schemaVersion === 2 ? { orig: Object.freeze({ ...source.orig }), trim: Object.freeze({ ...source.trim }) } : {}),
    });
    const key = frameKey(normalized.layer, normalized.state, normalized.direction, normalized.frameIndex);
    if (frameByKey.has(key)) throw new TypeError(`duplicate production hero frame ${key}`);
    frameByKey.set(key, normalized);
    const keyForClip = clipKey(normalized.layer, normalized.state, normalized.direction);
    const normalizedLoop = normalized.loop !== false;
    const clip = clipByKey.get(keyForClip) ?? { fps: normalized.fps, loop: normalizedLoop, frameCount: 0 };
    if (!Number.isFinite(normalized.fps) || normalized.fps <= 0 || clip.fps !== normalized.fps || clip.loop !== normalizedLoop) throw new TypeError(`invalid production hero clip cadence ${keyForClip}`);
    clip.frameCount = Math.max(clip.frameCount, normalized.frameIndex + 1);
    clipByKey.set(keyForClip, clip);
  }

  for (const [layer, states] of Object.entries(REQUIRED_CLIPS)) {
    for (const [state, expectedClip] of Object.entries(states)) {
      for (const direction of DIRECTION_BY_SIMULATION_INDEX) {
        const keyForClip = clipKey(layer, state, direction);
        const actualClip = clipByKey.get(keyForClip);
        if (!actualClip || actualClip.frameCount !== expectedClip.frames || actualClip.fps !== expectedClip.fps || actualClip.loop !== expectedClip.loop) {
          throw new TypeError(`invalid production hero clip coverage ${keyForClip}`);
        }
        for (let frameIndex = 0; frameIndex < expectedClip.frames; frameIndex += 1) {
          if (!frameByKey.has(frameKey(layer, state, direction, frameIndex))) throw new TypeError(`missing or non-contiguous production hero frame ${frameKey(layer, state, direction, frameIndex)}`);
        }
      }
    }
  }
  if (frameByKey.size !== REQUIRED_FRAME_COUNT) throw new TypeError(`production hero atlas requires ${REQUIRED_FRAME_COUNT} unique frames`);
  const expectedReleasedPropFrames = approvedAsset.actorId === 'lit-commando' ? 0 : 16;
  if (releasedPropFrames !== expectedReleasedPropFrames) throw new TypeError(`${approvedAsset.actorId} requires exactly ${expectedReleasedPropFrames} released-prop visibility cells in the late grenade frames`);

  const nativeWeaponIds = Array.isArray(metadata.nativeWeaponIds) ? Object.freeze([...metadata.nativeWeaponIds]) : metadata.nativeWeaponIds;
  const nativeActionIds = Array.isArray(metadata.nativeActionIds) ? Object.freeze([...metadata.nativeActionIds]) : metadata.nativeActionIds;
  const approvedRoutes = APPROVED_NATIVE_ROUTES[approvedAsset.actorId];
  for (const [values, approvedIds, label] of [
    [nativeWeaponIds, approvedRoutes.weapons, 'native weapon IDs'],
    [nativeActionIds, approvedRoutes.actions, 'native action IDs'],
  ]) {
    if (!Array.isArray(values) || values.some((id) => typeof id !== 'string' || !id.trim()) || new Set(values).size !== values.length) {
      throw new TypeError(`invalid or duplicate ${label}`);
    }
    if (values.some((id) => !approvedIds.includes(id))) throw new TypeError(`unapproved ${label}`);
    if (values.length !== approvedIds.length || approvedIds.some((id) => !values.includes(id))) throw new TypeError(`incomplete ${label}: all approved IDs are required`);
  }
  return Object.freeze({
    pipelineId: metadata.pipelineId,
    schemaVersion: metadata.schemaVersion,
    nativeWeaponIds,
    nativeActionIds,
    hasNativeWeapon: (weaponId) => nativeWeaponIds.includes(weaponId),
    hasNativeAction: (actionId) => nativeActionIds.includes(actionId),
    actorId: metadata.actorId,
    variantId: metadata.variantId,
    classification: metadata.classification,
    runtimeAuthority: metadata.runtimeAuthority,
    gameplayBodyProfile: metadata.gameplayBodyProfile,
    image: metadata.image,
    layerOrder: REQUIRED_LAYER_ORDER,
    frameByKey: readOnlyMap(frameByKey, 'production hero frame lookup'),
    clipByKey: readOnlyMap(new Map([...clipByKey].map(([key, clip]) => [key, Object.freeze({ ...clip })])), 'production hero clip lookup'),
  });
}

function requireFrame(index, layer, state, direction, frameIndex) {
  const key = frameKey(layer, state, direction, frameIndex);
  const frame = index.frameByKey.get(key);
  if (!frame) throw new RangeError(`missing production hero frame ${key}`);
  return frame;
}

export function clipFor(index, layer, state, direction) {
  const clip = index.clipByKey.get(clipKey(layer, state, direction));
  if (!clip) throw new RangeError(`missing production hero clip ${layer}|${state}|${direction}`);
  return clip;
}

function animationFrame(tick, clip) {
  const frame = Math.floor(tick * clip.fps / SIMULATION_HZ);
  return clip.loop ? frame % clip.frameCount : Math.min(frame, clip.frameCount - 1);
}

function frameFor(index, layer, state, direction, tick) {
  return requireFrame(index, layer, state, direction, animationFrame(tick, clipFor(index, layer, state, direction)));
}

export function resolveProductionHeroPose(index, {
  simulationTick,
  actionTick = 0,
  locomotion,
  legDirection,
  torsoDirection,
  action = 'aim',
}) {
  if (!index?.frameByKey || index.pipelineId !== EXPECTED_PIPELINE_ID || index.runtimeAuthority !== 'projection-only') throw new TypeError('production hero atlas index is required');
  const tick = positiveInteger(simulationTick, 'simulationTick');
  const resolvedActionTick = positiveInteger(actionTick, 'actionTick');
  const torsoName = directionNameForProductionIndex(torsoDirection);
  const moving = locomotion === 'moving';
  const fullBodyActions = new Set(['dash', 'melee', 'grenade', 'death']);
  // Aim remains authoritative. Hips follow any turn beyond a modest waist
  // twist; authored full-body actions use a single facing at the waist seam.
  directionNameForProductionIndex(legDirection);
  const delta = ((torsoDirection - legDirection + 12) % 8) - 4;
  const bodyDirection = fullBodyActions.has(action) ? torsoDirection
    : Math.abs(delta) <= 1 ? legDirection
      : (torsoDirection - Math.sign(delta) + 8) % 8;
  const legName = directionNameForProductionIndex(bodyDirection);
  if (fullBodyActions.has(action)) {
    return Object.freeze([
      requireFrame(index, 'shadow', 'idle', legName, 0),
      frameFor(index, 'lower-body', action, legName, resolvedActionTick),
      frameFor(index, 'torso-head', action, torsoName, resolvedActionTick),
      frameFor(index, 'weapon', action, torsoName, resolvedActionTick),
    ]);
  }

  const lowerState = moving ? 'run' : 'idle';
  // Backpedalling plays the planted run cycle in reverse, without altering
  // simulation velocity or the timing of any combat action.
  const travelDelta = ((legDirection - bodyDirection + 12) % 8) - 4;
  const lowerClip = clipFor(index, 'lower-body', lowerState, legName);
  const lowerFrame = animationFrame(tick, lowerClip);
  const lower = requireFrame(index, 'lower-body', lowerState, legName,
    moving && Math.abs(travelDelta) > 2 ? (lowerClip.frameCount - lowerFrame) % lowerClip.frameCount : lowerFrame);
  let torsoState = 'aim';
  let weaponState = 'aim';
  let actionCadenceTick = tick;
  if (action === 'interact') {
    // Reuse only the opening arm reach of the authored human animation.
    // Legs retain locomotion; the caller hides equipment for this gesture.
    torsoState = 'grenade';
    actionCadenceTick = Math.max(0,Math.round(6*Math.sin(Math.min(1,resolvedActionTick/18)*Math.PI)));
  } else if (action === 'pistol-fire') {
    torsoState = 'pistol-fire';
    weaponState = 'pistol-fire';
    actionCadenceTick = resolvedActionTick;
  } else if (action === 'hurt') {
    torsoState = 'hurt';
    actionCadenceTick = resolvedActionTick;
  } else if (action !== 'aim') {
    throw new RangeError(`unsupported production hero action ${action}`);
  }

  return Object.freeze([
    requireFrame(index, 'shadow', 'idle', legName, 0),
    lower,
    frameFor(index, 'torso-head', torsoState, torsoName, actionCadenceTick),
    frameFor(index, 'weapon', weaponState, torsoName, weaponState === 'aim' ? tick : actionCadenceTick),
  ]);
}

export function measureProductionHeroBodyHeight(index) {
  const lower = [];
  const upper = [];
  if (!index?.frameByKey || typeof index.frameByKey.values !== 'function') throw new TypeError('production hero body frames are required');
  for (const frame of index.frameByKey.values()) {
    const livingBodyLayer = (frame.layer === 'lower-body' || frame.layer === 'torso-head') && frame.state !== 'death';
    if (!livingBodyLayer) continue;
    const density = PRODUCTION_HERO_RUNTIME_SCALE * 160 / (frame.sourceSize?.h ?? 160);
    const top = ((frame.trim?.y ?? 0) - frame.pivot.y) * density;
    const extent = { top, bottom: top + frame.frame.h * density };
    if (frame.layer === 'lower-body') lower.push(extent);
    else upper.push(extent);
  }
  if (!lower.length || !upper.length) throw new TypeError('living lower-body and torso-head frames are required');
  // Any independently directed living lower and upper pose can be composed.
  // Death is deliberately excluded: its flat corpse is not a playable body.
  let minimum = Infinity;
  for (const leg of lower) {
    for (const torso of upper) minimum = Math.min(minimum, Math.max(leg.bottom, torso.bottom) - Math.min(leg.top, torso.top));
  }
  return minimum;
}

export function createProductionHeroDisplay({
  index,
  atlasTexture,
  ContainerClass,
  SpriteClass,
  TextureClass,
  RectangleClass,
  scale = PRODUCTION_HERO_RUNTIME_SCALE,
}) {
  if (!atlasTexture?.source) throw new TypeError('production hero atlas texture source is required');
  for (const [value, name] of [[ContainerClass, 'ContainerClass'], [SpriteClass, 'SpriteClass'], [TextureClass, 'TextureClass'], [RectangleClass, 'RectangleClass']]) {
    if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  }
  if (!Number.isFinite(scale) || scale <= 0) throw new TypeError('production hero display scale must be positive');
  const atlasWidth = atlasTexture.source.width;
  const atlasHeight = atlasTexture.source.height;
  if (![atlasWidth, atlasHeight].every((value) => Number.isInteger(value) && value > 0 && value <= 2048)
    || atlasWidth !== atlasHeight) {
    throw new TypeError('production hero atlas dimensions must be positive integers, square and at most 2048x2048');
  }
  for (const frame of index.frameByKey.values()) {
    if (frame.frame.x < 0 || frame.frame.y < 0 || frame.frame.x + frame.frame.w > atlasWidth || frame.frame.y + frame.frame.h > atlasHeight) {
      throw new RangeError(`production hero frame ${frame.id} is outside atlas ${atlasWidth}x${atlasHeight}`);
    }
  }

  const container = new ContainerClass();
  container.label = 'production-hero-atlas';
  container.scale.set(scale);
  const textureByFrameId = new Map();
  const spriteByLayer = new Map();

  function textureFor(frame) {
    if (!textureByFrameId.has(frame.id)) {
      textureByFrameId.set(frame.id, new TextureClass({
        source: atlasTexture.source,
        frame: new RectangleClass(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h),
        ...(frame.orig ? {
          orig: new RectangleClass(0, 0, frame.orig.w, frame.orig.h),
          trim: new RectangleClass(frame.trim.x, frame.trim.y, frame.trim.w, frame.trim.h),
        } : {}),
      }));
    }
    return textureByFrameId.get(frame.id);
  }

  for (const layer of index.layerOrder) {
    const initialState = layer === 'shadow' || layer === 'lower-body' ? 'idle' : 'aim';
    const initial = requireFrame(index, layer, initialState, 'east', 0);
    const sprite = new SpriteClass({ texture: textureFor(initial) });
    sprite.label = `production-hero-${layer}`;
    sprite.anchor.set(initial.anchor.x, initial.anchor.y);
    sprite.scale.set(160 / (initial.sourceSize?.h ?? 160));
    spriteByLayer.set(layer, sprite);
    container.addChild(sprite);
  }

  const applyPose = (renderState) => {
    const frames = resolveProductionHeroPose(index, renderState);
    for (const frame of frames) {
      const sprite = spriteByLayer.get(frame.layer);
      sprite.texture = textureFor(frame);
      sprite.anchor.set(frame.anchor.x, frame.anchor.y);
      sprite.scale.set(160 / (frame.sourceSize?.h ?? 160));
    }
    container.frameIds = frames.map((frame) => frame.id).join(',');
    return frames;
  };

  const setLayerVisible = (layer, visible) => {
    const sprite = spriteByLayer.get(layer);
    if (!sprite) throw new RangeError(`unknown production hero layer ${layer}`);
    sprite.visible = Boolean(visible);
  };

  // Reload presentation: a projection-only position/rotation offset on one
  // named layer, used by the runtime to dip the weapon while a magazine
  // reloads. applyPose only rewrites texture, anchor and scale, so the offset
  // survives frame swaps; the shadow is ground-locked and refuses it. The
  // cached key makes a steady pose free of sprite writes.
  const layerOffsetKeys = new Map();
  const setLayerOffset = (layer, { x = 0, y = 0, rotation = 0 } = {}) => {
    const sprite = spriteByLayer.get(layer);
    if (!sprite || layer === 'shadow') throw new RangeError(`cannot offset production hero layer ${layer}`);
    const key = `${x}|${y}|${rotation}`;
    if (layerOffsetKeys.get(layer) === key) return;
    layerOffsetKeys.set(layer, key);
    sprite.position.set(x, y);
    sprite.rotation = rotation;
  };

  // Cycle 074 (V-5): an additive body tint over every non-shadow layer for
  // the hero hit flash. Idempotent per frame; white restores the atlas colour.
  let currentTint = 0xffffff;
  const setTint = (color) => {
    if (color === currentTint) return;
    currentTint = color;
    for (const [layer, sprite] of spriteByLayer) if (layer !== 'shadow') sprite.tint = color;
  };

  return Object.freeze({
    container,
    layerOrder: index.layerOrder,
    artSource: approvedArtSource(index.actorId),
    minimumBodyHeight: measureProductionHeroBodyHeight(index) * scale / PRODUCTION_HERO_RUNTIME_SCALE,
    applyPose,
    setLayerVisible,
    setTint,
    setLayerOffset,
    hasNativeWeapon: index.hasNativeWeapon,
    hasNativeAction: index.hasNativeAction,
  });
}

function approvedArtSource(actorId) {
  return PRODUCTION_HERO_ASSETS[actorId]?.artSource ?? 'production-blender-atlas-v1';
}
