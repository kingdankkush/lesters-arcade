export const MANNEQUIN_ATLAS_IMAGE_URL = '/assets/generated/hmh-reboot-mannequin/hmh-reboot-mannequin-atlas.png';
export const MANNEQUIN_ATLAS_METADATA_URL = '/assets/generated/hmh-reboot-mannequin/hmh-reboot-mannequin-atlas.json';
export const MANNEQUIN_RUNTIME_SCALE = 0.72;

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

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

export function directionNameForIndex(index) {
  if (!Number.isInteger(index)) throw new TypeError('direction index must be an integer');
  return DIRECTION_BY_SIMULATION_INDEX[((index % 8) + 8) % 8];
}

export function createMannequinAtlasIndex(metadata) {
  if (metadata?.schemaVersion !== 1) throw new TypeError('mannequin atlas schemaVersion 1 is required');
  if (metadata.pipelineId !== 'hmh-reboot-character-pipeline-v1') throw new TypeError('unexpected mannequin pipeline id');
  if (metadata.classification !== 'pipeline-pilot-not-production-art') throw new TypeError('pipeline pilot classification is required');
  if (!Array.isArray(metadata.frames) || metadata.frames.length !== 64) throw new TypeError('mannequin atlas requires exactly 64 frames');
  if (JSON.stringify(metadata.layers) !== JSON.stringify(REQUIRED_LAYER_ORDER)) throw new TypeError('mannequin layer order is invalid');

  const frameByKey = new Map();
  for (const source of metadata.frames) {
    const normalized = Object.freeze({
      ...source,
      frame: Object.freeze({ ...source.frame }),
      pivot: Object.freeze({ ...source.pivot }),
      anchor: Object.freeze({ ...source.anchor }),
      sourcePivot: Object.freeze({ ...source.sourcePivot }),
    });
    const key = frameKey(normalized.layer, normalized.state, normalized.direction, normalized.frameIndex);
    if (frameByKey.has(key)) throw new TypeError(`duplicate mannequin frame ${key}`);
    frameByKey.set(key, normalized);
  }
  return Object.freeze({
    pipelineId: metadata.pipelineId,
    classification: metadata.classification,
    image: metadata.image,
    layerOrder: REQUIRED_LAYER_ORDER,
    frameByKey,
  });
}

function requireFrame(index, layer, state, direction, frameIndex) {
  const key = frameKey(layer, state, direction, frameIndex);
  const frame = index.frameByKey.get(key);
  if (!frame) throw new RangeError(`missing mannequin frame ${key}`);
  return frame;
}

export function resolveMannequinPose(index, {
  simulationTick,
  locomotion,
  legDirection,
  torsoDirection,
}) {
  if (!index?.frameByKey || index.pipelineId !== 'hmh-reboot-character-pipeline-v1') throw new TypeError('mannequin atlas index is required');
  const tick = positiveInteger(simulationTick, 'simulationTick');
  const legName = directionNameForIndex(legDirection);
  const torsoName = directionNameForIndex(torsoDirection);
  const moving = locomotion === 'moving';
  const lowerState = moving ? 'run' : 'idle';
  const lowerFrame = moving ? Math.floor(tick * 12 / SIMULATION_HZ) % 4 : 0;
  return Object.freeze([
    requireFrame(index, 'shadow', 'idle', legName, 0),
    requireFrame(index, 'lower-body', lowerState, legName, lowerFrame),
    requireFrame(index, 'torso-head', 'aim', torsoName, 0),
    requireFrame(index, 'weapon', 'aim', torsoName, 0),
  ]);
}

export function createMannequinDisplay({
  index,
  atlasTexture,
  ContainerClass,
  SpriteClass,
  TextureClass,
  RectangleClass,
  scale = 1,
}) {
  if (!atlasTexture?.source) throw new TypeError('atlas texture source is required');
  for (const [value, name] of [[ContainerClass, 'ContainerClass'], [SpriteClass, 'SpriteClass'], [TextureClass, 'TextureClass'], [RectangleClass, 'RectangleClass']]) {
    if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  }
  if (!Number.isFinite(scale) || scale <= 0) throw new TypeError('display scale must be positive');

  const container = new ContainerClass();
  container.label = 'pipeline-pilot-human-atlas';
  container.scale.set(scale);
  const textureByFrameId = new Map();
  const spriteByLayer = new Map();
  for (const layer of index.layerOrder) {
    const initial = requireFrame(index, layer, layer === 'lower-body' || layer === 'shadow' ? 'idle' : 'aim', 'east', 0);
    const texture = textureFor(initial);
    const sprite = new SpriteClass({ texture });
    sprite.label = `pipeline-pilot-${layer}`;
    sprite.anchor.set(initial.anchor.x, initial.anchor.y);
    spriteByLayer.set(layer, sprite);
    container.addChild(sprite);
  }

  function textureFor(frame) {
    if (!textureByFrameId.has(frame.id)) {
      textureByFrameId.set(frame.id, new TextureClass({
        source: atlasTexture.source,
        frame: new RectangleClass(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h),
      }));
    }
    return textureByFrameId.get(frame.id);
  }

  const applyPose = (renderState) => {
    const frames = resolveMannequinPose(index, renderState);
    for (const frame of frames) {
      const sprite = spriteByLayer.get(frame.layer);
      sprite.texture = textureFor(frame);
      sprite.anchor.set(frame.anchor.x, frame.anchor.y);
    }
    container.frameIds = frames.map((frame) => frame.id).join(',');
    return frames;
  };

  return Object.freeze({
    container,
    layerOrder: index.layerOrder,
    applyPose,
  });
}
