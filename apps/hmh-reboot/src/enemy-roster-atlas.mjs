/**
 * Runtime index and display for the authored enemy/boss sprite roster produced
 * by `scripts/run-hmh-enemy-roster-pipeline.py`.
 *
 * Projection-only: this module selects and draws frames. Collision radius,
 * damage, AI, spawning and results come from `enemy-archetypes.mjs` and are
 * never derived from atlas metadata.
 */

export const ENEMY_ROSTER_PIPELINE_ID = 'hmh-reboot-enemy-roster-v1';
export const ENEMY_ROSTER_RUNTIME_SCALE = 0.42;
// Compass names present in the atlas metadata.
export const ENEMY_ROSTER_DIRECTIONS = Object.freeze([
  'south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west',
]);
// Simulation heading index -> compass name. This MUST match the certified hero
// mapping in production-hero-atlas.mjs: `quantizeDirection` yields index 0 for
// +x (east) and increases clockwise on screen. Reusing the manifest's own
// ordering here mirrored the roster about index 1 and left six of eight
// headings facing the wrong way.
export const ENEMY_DIRECTION_BY_SIMULATION_INDEX = Object.freeze([
  'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east',
]);
export const ENEMY_ROSTER_STATES = Object.freeze(['idle', 'run', 'tell', 'attack', 'hit', 'death']);

const ROSTER_ROOT = '../assets/generated/hmh-reboot-enemy-roster';

export const ENEMY_ROSTER_ACTORS = Object.freeze([
  'bagholder-rusher',
  'forkrunner',
  'liquidator-agent',
  'whale-enforcer',
  'gas-bomber',
  'validator-cultist',
  'the-liquidator',
]);

export function enemyRosterAsset(actorId) {
  if (!ENEMY_ROSTER_ACTORS.includes(actorId)) throw new TypeError(`unknown roster actor: ${String(actorId)}`);
  return Object.freeze({
    actorId,
    imageUrl: `${ROSTER_ROOT}/${actorId}/${actorId}-roster-atlas.png`,
    metadataUrl: `${ROSTER_ROOT}/${actorId}/${actorId}-roster-atlas.json`,
  });
}

export function directionNameForRosterIndex(index) {
  if (!Number.isInteger(index)) throw new TypeError('direction index must be an integer');
  return ENEMY_DIRECTION_BY_SIMULATION_INDEX[((index % 8) + 8) % 8];
}

export function createEnemyRosterAtlasIndex(metadata, expectedActorId) {
  if (!metadata || typeof metadata !== 'object') throw new TypeError('roster metadata is required');
  if (metadata.pipelineId !== ENEMY_ROSTER_PIPELINE_ID) {
    throw new TypeError(`unexpected roster pipeline: ${String(metadata.pipelineId)}`);
  }
  if (metadata.runtimeAuthority !== 'projection-only') {
    throw new TypeError('enemy roster art must remain projection-only');
  }
  if (expectedActorId && metadata.actorId !== expectedActorId) {
    throw new TypeError(`roster actor mismatch: expected ${expectedActorId}, received ${metadata.actorId}`);
  }
  if (!Array.isArray(metadata.frames) || metadata.frames.length === 0) {
    throw new TypeError('roster metadata contains no frames');
  }

  const byKey = new Map();
  const clipByKey = new Map();
  const phases = metadata.phases?.length ? metadata.phases : [null];
  for (const frame of metadata.frames) {
    const phase = frame.phase ?? null;
    const phaseToken = phase ?? 'default';
    const key = `${phaseToken}|${frame.state}|${frame.direction}|${frame.frameIndex}`;
    if (byKey.has(key)) throw new TypeError(`duplicate roster frame ${key}`);
    byKey.set(key, frame);
    const countKey = `${phaseToken}|${frame.state}|${frame.direction}`;
    const clip = clipByKey.get(countKey) ?? { frameCount: 0, fps: frame.fps };
    if (!Number.isFinite(frame.fps) || frame.fps <= 0 || clip.fps !== frame.fps) throw new TypeError(`invalid roster cadence ${countKey}`);
    clip.frameCount = Math.max(clip.frameCount, frame.frameIndex + 1);
    clipByKey.set(countKey, clip);
  }

  // Every state the runtime can select must exist for every direction and
  // every authored boss phase, or a pose lookup would fail in the render path.
  for (const phase of phases) {
    const phaseToken = phase ?? 'default';
    for (const state of ENEMY_ROSTER_STATES) {
      for (const direction of ENEMY_ROSTER_DIRECTIONS) {
        const clip = clipByKey.get(`${phaseToken}|${state}|${direction}`);
        if (!clip) throw new TypeError(`roster ${metadata.actorId} is missing ${phaseToken}/${state}/${direction}`);
        for (let frameIndex = 0; frameIndex < clip.frameCount; frameIndex += 1) {
          if (!byKey.has(`${phaseToken}|${state}|${direction}|${frameIndex}`)) {
            throw new TypeError(`roster ${metadata.actorId} has a frame gap at ${phaseToken}/${state}/${direction}/${frameIndex}`);
          }
        }
      }
    }
  }

  return Object.freeze({
    actorId: metadata.actorId,
    identityForm: metadata.identityForm,
    boss: Boolean(metadata.boss),
    states: Object.freeze([...ENEMY_ROSTER_STATES]),
    directions: Object.freeze([...ENEMY_ROSTER_DIRECTIONS]),
    phases: Object.freeze([...phases]),
    frameCount: metadata.frames.length,
    frameFor(state, direction, frameIndex, phase = phases[0]) {
      const phaseToken = phase ?? 'default';
      const clip = clipByKey.get(`${phaseToken}|${state}|${direction}`);
      if (!clip) return undefined;
      const wrapped = ((Math.trunc(frameIndex) % clip.frameCount) + clip.frameCount) % clip.frameCount;
      return byKey.get(`${phaseToken}|${state}|${direction}|${wrapped}`);
    },
    clipFor(state, direction, phase = phases[0]) {
      return clipByKey.get(`${phase ?? 'default'}|${state}|${direction}`);
    },
    frameCountFor(state, direction, phase = phases[0]) {
      return clipByKey.get(`${phase ?? 'default'}|${state}|${direction}`)?.frameCount ?? 1;
    },
    fpsFor(state, direction, phase = phases[0]) {
      return clipByKey.get(`${phase ?? 'default'}|${state}|${direction}`)?.fps ?? 1;
    },
  });
}

export function resolveEnemyVisualDirection(state, velocity, epsilon = 0.5) {
  if (!state || typeof state !== 'object') throw new TypeError('enemy visual facing state is required');
  const x = Number(velocity?.x ?? 0);
  const y = Number(velocity?.y ?? 0);
  if (Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) > epsilon) {
    const angle = Math.atan2(y, x);
    state.direction = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  } else if (!Number.isInteger(state.direction)) {
    state.direction = 0;
  }
  return state.direction;
}

export function resolveEnemyRosterPose(index, { state, tick, direction, phase = index?.phases?.[0] ?? null }) {
  if (!index || typeof index.frameFor !== 'function') throw new TypeError('roster index is required');
  const resolvedState = ENEMY_ROSTER_STATES.includes(state) ? state : 'idle';
  const directionName = directionNameForRosterIndex(Number.isInteger(direction) ? direction : 0);
  const simulationTick = Number.isFinite(tick) ? Math.max(0, Math.trunc(tick)) : 0;
  const count = index.frameCountFor(resolvedState, directionName, phase);
  const fps = index.fpsFor(resolvedState, directionName, phase);
  const authoredFrame = Math.floor(simulationTick * fps / 60);
  // Death holds its final frame instead of looping, so a corpse settles.
  const frameIndex = resolvedState === 'death' ? Math.min(count - 1, authoredFrame) : authoredFrame % count;
  return index.frameFor(resolvedState, directionName, frameIndex, phase);
}

export function createEnemyRosterDisplay({
  index,
  atlasTexture,
  ContainerClass,
  SpriteClass,
  TextureClass,
  RectangleClass,
  scale = ENEMY_ROSTER_RUNTIME_SCALE,
}) {
  if (!atlasTexture?.source) throw new TypeError('roster atlas texture source is required');
  for (const [value, name] of [[ContainerClass, 'ContainerClass'], [SpriteClass, 'SpriteClass'], [TextureClass, 'TextureClass'], [RectangleClass, 'RectangleClass']]) {
    if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  }
  if (!Number.isFinite(scale) || scale <= 0) throw new TypeError('roster display scale must be positive');

  const container = new ContainerClass();
  container.label = `production-roster-${index.actorId}`;
  container.productionActorId = index.actorId;
  container.productionAuthority = 'projection-only';
  container.scale.set(scale);

  const textureByFrameId = new Map();
  const textureFor = (frame) => {
    if (!textureByFrameId.has(frame.id)) {
      textureByFrameId.set(frame.id, new TextureClass({
        source: atlasTexture.source,
        frame: new RectangleClass(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h),
      }));
    }
    return textureByFrameId.get(frame.id);
  };

  const initialPhase = index.phases[0];
  const initial = index.frameFor('idle', 'south', 0, initialPhase);
  const sprite = new SpriteClass({ texture: textureFor(initial) });
  sprite.label = `roster-body-${index.actorId}`;
  sprite.anchor.set(initial.anchor.x, initial.anchor.y);
  container.addChild(sprite);

  container.visualState = 'idle';
  container.visualPhase = initialPhase;
  container.applyPose = ({ state = 'idle', tick = 0, direction = 0, elite = false, phase = initialPhase } = {}) => {
    const frame = resolveEnemyRosterPose(index, { state, tick, direction, phase });
    sprite.texture = textureFor(frame);
    sprite.anchor.set(frame.anchor.x, frame.anchor.y);
    // Elites read as a brighter tint rather than a different body, so the
    // silhouette contract is unchanged.
    sprite.tint = elite ? 0xfff0c0 : 0xffffff;
    container.visualState = frame.state;
    container.visualPhase = frame.phase ?? null;
    return frame;
  };
  container.applyPose({ state: 'idle', tick: 0, direction: 0 });
  return container;
}
