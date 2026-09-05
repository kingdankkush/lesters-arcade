export const PRODUCTION_HERO_ASSETS = Object.freeze({
  'lit-commando': Object.freeze({
    actorId: 'lit-commando',
    variantId: 'reserve-vanguard',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.png',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json',
  }),
  'lit-valkyrie': Object.freeze({
    actorId: 'lit-valkyrie',
    variantId: 'plasma-striker',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.png',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.json',
  }),
  'lester-original': Object.freeze({
    actorId: 'lester-original',
    variantId: 'blue-mask-original',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lester-original/lester-original-production-pilot-atlas.png',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lester-original/lester-original-production-pilot-atlas.json',
  }),
  lilly: Object.freeze({
    actorId: 'lilly',
    variantId: 'gold-teal-veteran',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.png',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.json',
  }),
});
export const PRODUCTION_HERO_ATLAS_IMAGE_URL = PRODUCTION_HERO_ASSETS['lit-commando'].imageUrl;
export const PRODUCTION_HERO_ATLAS_METADATA_URL = PRODUCTION_HERO_ASSETS['lit-commando'].metadataUrl;
export const PRODUCTION_HERO_RUNTIME_SCALE = 0.58;

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

function arraysEqual(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
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

export function createProductionHeroAtlasIndex(metadata, expectedAsset = PRODUCTION_HERO_ASSETS['lit-commando']) {
  const approvedAsset = productionHeroAsset(expectedAsset?.actorId);
  if (metadata?.schemaVersion !== 1) throw new TypeError('production hero atlas schemaVersion 1 is required');
  if (metadata.pipelineId !== EXPECTED_PIPELINE_ID) throw new TypeError('unexpected production hero pipeline id');
  if (metadata.actorId !== approvedAsset.actorId || metadata.variantId !== approvedAsset.variantId) throw new TypeError('unexpected production hero identity');
  if (metadata.classification !== 'production-art') throw new TypeError('production-art classification is required');
  if (metadata.runtimeAuthority !== 'projection-only') throw new TypeError('production hero must remain projection-only');
  if (metadata.gameplayBodyProfile !== EXPECTED_GAMEPLAY_BODY_PROFILE) throw new TypeError('production hero gameplay body profile drifted');
  if (!arraysEqual(metadata.layers, REQUIRED_LAYER_ORDER)) throw new TypeError('production hero layer order is invalid');
  if (!arraysEqual(metadata.composition?.layerOrder, REQUIRED_LAYER_ORDER)) throw new TypeError('production hero composition order is invalid');
  if (metadata.composition?.weaponSocket !== 'weapon_socket' || metadata.composition?.independentDirections !== true) throw new TypeError('production hero composition contract is invalid');
  if (!Array.isArray(metadata.frames) || metadata.frames.length < 168) throw new TypeError('production hero atlas requires complete authored frame coverage');

  const frameByKey = new Map();
  const clipByKey = new Map();
  for (const source of metadata.frames) {
    if (!REQUIRED_LAYER_ORDER.includes(source.layer)) throw new TypeError(`unknown production hero layer ${source.layer}`);
    if (!DIRECTION_BY_SIMULATION_INDEX.includes(source.direction)) throw new TypeError(`unknown production hero direction ${source.direction}`);
    if (!Number.isInteger(source.frameIndex) || source.frameIndex < 0) throw new TypeError('invalid production hero frame index');
    if (![source.frame?.x, source.frame?.y, source.frame?.w, source.frame?.h].every(Number.isFinite) || source.frame.w <= 0 || source.frame.h <= 0) throw new TypeError('invalid production hero atlas rectangle');
    if (![source.anchor?.x, source.anchor?.y].every(Number.isFinite)) throw new TypeError('invalid production hero anchor');
    const normalized = Object.freeze({
      ...source,
      frame: Object.freeze({ ...source.frame }),
      pivot: Object.freeze({ ...source.pivot }),
      anchor: Object.freeze({ ...source.anchor }),
      sourcePivot: Object.freeze({ ...source.sourcePivot }),
    });
    const key = frameKey(normalized.layer, normalized.state, normalized.direction, normalized.frameIndex);
    if (frameByKey.has(key)) throw new TypeError(`duplicate production hero frame ${key}`);
    frameByKey.set(key, normalized);
    const keyForClip = clipKey(normalized.layer, normalized.state, normalized.direction);
    const clip = clipByKey.get(keyForClip) ?? { fps: normalized.fps, loop: normalized.loop !== false, frameCount: 0 };
    if (!Number.isFinite(normalized.fps) || normalized.fps <= 0 || clip.fps !== normalized.fps) throw new TypeError(`invalid production hero clip cadence ${keyForClip}`);
    clip.frameCount = Math.max(clip.frameCount, normalized.frameIndex + 1);
    clipByKey.set(keyForClip, clip);
  }

  return Object.freeze({
    pipelineId: metadata.pipelineId,
    actorId: metadata.actorId,
    variantId: metadata.variantId,
    classification: metadata.classification,
    runtimeAuthority: metadata.runtimeAuthority,
    gameplayBodyProfile: metadata.gameplayBodyProfile,
    image: metadata.image,
    layerOrder: REQUIRED_LAYER_ORDER,
    frameByKey,
    clipByKey: new Map([...clipByKey].map(([key, clip]) => [key, Object.freeze({ ...clip })])),
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
  const legName = directionNameForProductionIndex(legDirection);
  const torsoName = directionNameForProductionIndex(torsoDirection);
  const moving = locomotion === 'moving';
  const fullBodyActions = new Set(['dash', 'melee', 'grenade', 'death']);
  if (fullBodyActions.has(action)) {
    return Object.freeze([
      requireFrame(index, 'shadow', 'idle', legName, 0),
      frameFor(index, 'lower-body', action, legName, resolvedActionTick),
      frameFor(index, 'torso-head', action, torsoName, resolvedActionTick),
      frameFor(index, 'weapon', action, torsoName, resolvedActionTick),
    ]);
  }

  const lowerState = moving ? 'run' : 'idle';
  const lower = frameFor(index, 'lower-body', lowerState, legName, tick);
  let torsoState = 'aim';
  let weaponState = 'aim';
  let actionCadenceTick = tick;
  if (action === 'pistol-fire') {
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
    spriteByLayer.set(layer, sprite);
    container.addChild(sprite);
  }

  const applyPose = (renderState) => {
    const frames = resolveProductionHeroPose(index, renderState);
    for (const frame of frames) {
      const sprite = spriteByLayer.get(frame.layer);
      sprite.texture = textureFor(frame);
      sprite.anchor.set(frame.anchor.x, frame.anchor.y);
    }
    container.frameIds = frames.map((frame) => frame.id).join(',');
    return frames;
  };

  const setLayerVisible = (layer, visible) => {
    const sprite = spriteByLayer.get(layer);
    if (!sprite) throw new RangeError(`unknown production hero layer ${layer}`);
    sprite.visible = Boolean(visible);
  };

  // Cycle 074 (V-5): an additive body tint over every non-shadow layer for
  // the hero hit flash. Idempotent per frame; white restores the atlas colour.
  let currentTint = 0xffffff;
  const setTint = (color) => {
    if (color === currentTint) return;
    currentTint = color;
    for (const [layer, sprite] of spriteByLayer) if (layer !== 'shadow') sprite.tint = color;
  };

  return Object.freeze({ container, layerOrder: index.layerOrder, applyPose, setLayerVisible, setTint });
}
