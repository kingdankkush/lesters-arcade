// Bridge kit (Level 1 design package 2.4, slice S4.9): eight layout v2
// crossings in seven styles, rendered in Blender at the 35-degree hero camera
// with the shared light rig (scripts/hmh-blender/create-hmh-bridge-kit.py,
// scripts/run-hmh-bridge-kit-pipeline.py).
//
// BUILT DARK. Nothing imports this module on the shipped path: the layout v2
// lane places crossings by dynamic import behind `?evidenceSafe=1&bridgeKit=1`,
// and a Ranked session refuses it. It is projection-only: it never reads or
// writes collision, navigation, combat, spawning, RNG, evidence or results.
// Rails and gates stay the layout's capsules; the art only shows them.
//
// Projection. A part's `origin` is the world screen coordinate (x, y - z) of
// its top-left texel, so it draws at worldToScreen({ x, y, z: 0 }) with anchor
// (0, 0) and scale runtimeScale * zoom. world-space.mjs projects every actor
// the same way (heightToScreenY 1), which is why a deck corner lands on its
// collision rectangle lifted by the deck's z.
import { worldToScreen } from './world-space.mjs';

export const BRIDGE_KIT_FLAG = 'bridgeKit';
export const BRIDGE_KIT_SCHEMA = 'hmh-bridge-kit-atlas-v1';
export const BRIDGE_KIT_ATLAS_URL = '/assets/generated/hmh-bridge-kit/hmh-bridge-kit-atlas.json';
export const BRIDGE_KIT_ASSET_ROOT = '/assets/generated/hmh-bridge-kit';
export const BRIDGE_KIT_SIMULATION_HZ = 60;
const BAND_ORDER = Object.freeze({ ground: 0, actors: 1, overhead: 2 });

// Dark gate. The kit shows only in an evidence session that asks for it, and
// never in Ranked: callers pass the session mode they are about to start.
export function bridgeKitRequested(params) {
  if (!params || typeof params.get !== 'function') return false;
  return params.get('evidenceSafe') === '1' && params.get(BRIDGE_KIT_FLAG) === '1';
}

export function bridgeKitEnabled({ params = null, mode = 'free' } = {}) {
  return mode !== 'ranked' && bridgeKitRequested(params);
}

export function assertBridgeKitSessionMode(mode) {
  if (mode === 'ranked') throw new Error('The bridge kit is dark and never runs Ranked');
  return mode;
}

// Stop-motion sway for plank-and-rope decks: a pure function of the integer
// presentation tick (60 Hz), never of wall time, so a replay draws the same
// frame on the same tick. It moves pixels only.
export function bridgeSwayFrameIndex(presentationTick, { fps = 7, frames = 6 } = {}) {
  if (!Number.isInteger(presentationTick) || presentationTick < 0) return 0;
  if (!Number.isInteger(frames) || frames < 1) throw new RangeError('sway frames must be a positive integer');
  if (!(fps > 0 && fps <= BRIDGE_KIT_SIMULATION_HZ)) throw new RangeError('sway fps must be within (0, 60]');
  return Math.floor((presentationTick * fps) / BRIDGE_KIT_SIMULATION_HZ) % frames;
}

// The bascule leaf lowers through its authored poses one step per
// `sequenceTicks` after the lever event; before the event it holds pose 0.
export function bridgeSequenceState(crossing, ticksSinceTrigger) {
  const sequence = crossing?.movingParts?.sequence;
  if (!Array.isArray(sequence) || sequence.length === 0) return crossing?.defaultState ?? null;
  if (!Number.isInteger(ticksSinceTrigger) || ticksSinceTrigger < 0) return sequence[0];
  const step = crossing.movingParts.sequenceTicks ?? 12;
  return sequence[Math.min(sequence.length - 1, Math.floor(ticksSinceTrigger / step) + 1)];
}

// Deck plus its ramps, in world units, for the overhead / near-truss fade.
export function bridgeDeckContains(crossing, x, y) {
  if (!crossing || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const [x0, y0, x1, y1] = crossing.rect;
  const ramp = crossing.rampLength ?? 0;
  if (crossing.span === 'y') return x >= x0 && x <= x1 && y >= y0 - ramp && y <= y1 + ramp;
  return x >= x0 - ramp && x <= x1 + ramp && y >= y0 && y <= y1;
}

function fail(message) {
  throw new TypeError(`bridge kit atlas: ${message}`);
}

export function validateBridgeKitAtlas(atlas) {
  if (!atlas || atlas.schema !== BRIDGE_KIT_SCHEMA) fail('unexpected schema');
  if (atlas.runtimeAuthority !== 'projection-only') fail('must be projection-only');
  if (!(atlas.pixelDensity > 0) || Math.abs(atlas.runtimeScale * atlas.pixelDensity - 1) > 1e-9) fail('runtimeScale must invert pixelDensity');
  const pageById = new Map();
  for (const page of atlas.pages ?? []) {
    if (pageById.has(page.id)) fail(`duplicate page ${page.id}`);
    if (!(page.width > 0 && page.height > 0)) fail(`page ${page.id} has no size`);
    pageById.set(page.id, page);
  }
  const frameById = new Map();
  for (const [id, frame] of Object.entries(atlas.frames ?? {})) {
    if (frame.id !== id) fail(`frame key ${id} does not match its id`);
    if (!(frame.band in BAND_ORDER)) fail(`${id} has unknown band ${frame.band}`);
    if (frame.band === 'actors' && !Number.isFinite(frame.sortY)) fail(`${id} needs a sortY`);
    if (!Array.isArray(frame.parts) || frame.parts.length === 0) fail(`${id} has no parts`);
    for (const part of frame.parts) {
      const page = pageById.get(part.page);
      if (!page) fail(`${part.id} references missing page ${part.page}`);
      const { x, y, w, h } = part.frame;
      if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > page.width || y + h > page.height) fail(`${part.id} is outside its page`);
      if (!Number.isFinite(part.origin?.x) || !Number.isFinite(part.origin?.y)) fail(`${part.id} has no origin`);
    }
    frameById.set(id, frame);
  }
  const crossingById = new Map();
  for (const [id, crossing] of Object.entries(atlas.crossings ?? {})) {
    for (const frameId of crossing.staticFrames ?? []) if (!frameById.has(frameId)) fail(`${id} static frame ${frameId} missing`);
    if ((crossing.staticFrames ?? []).length === 0) fail(`${id} has no static frames`);
    for (const list of Object.values(crossing.swayFrames ?? {})) {
      if (list.length !== atlas.sway.frames) fail(`${id} sway loop has ${list.length} frames, expected ${atlas.sway.frames}`);
      for (const frameId of list) if (!frameById.has(frameId)) fail(`${id} sway frame ${frameId} missing`);
    }
    for (const [state, list] of Object.entries(crossing.movingParts?.states ?? {})) {
      if (list.length === 0) fail(`${id} moving state ${state} has no frames`);
      for (const frameId of list) if (!frameById.has(frameId)) fail(`${id} moving frame ${frameId} missing`);
    }
    crossingById.set(id, crossing);
  }
  return Object.freeze({ atlas, pageById, frameById, crossingById });
}

function activeMovingFrames(crossing, gateState) {
  const moving = crossing.movingParts;
  if (!moving) return [];
  const state = gateState ?? crossing.defaultState;
  const states = moving.stateSets?.[state] ?? [state];
  return states.flatMap((name) => moving.states[name] ?? []);
}

// Everything one crossing draws for a given gate state, sway tick and hero
// position, in draw order: ground band first (static, then sway, then moving),
// then actor-band parts with their depth keys, then overhead parts.
export function resolveBridgeCrossingDraws(index, crossingId, { gateState = null, presentationTick = 0, heroOnDeck = false } = {}) {
  const crossing = index.crossingById.get(crossingId);
  if (!crossing) throw new RangeError(`unknown crossing ${crossingId}`);
  const state = gateState ?? crossing.defaultState;
  const frameIds = [...crossing.staticFrames];
  const swaying = crossing.swayFrames && Object.keys(crossing.swayFrames).length > 0 && state !== 'raised';
  if (swaying) {
    const frame = bridgeSwayFrameIndex(presentationTick, index.atlas.sway);
    for (const layer of Object.keys(crossing.swayFrames).sort()) frameIds.push(crossing.swayFrames[layer][frame]);
  }
  frameIds.push(...activeMovingFrames(crossing, state));
  const draws = [];
  frameIds.forEach((frameId, order) => {
    const frame = index.frameById.get(frameId);
    const alpha = heroOnDeck ? frame.fadeWhenHeroOnDeck : 1;
    for (const part of frame.parts) {
      draws.push(Object.freeze({
        frameId,
        partId: part.id,
        page: part.page,
        frame: part.frame,
        x: part.origin.x,
        y: part.origin.y,
        scale: index.atlas.runtimeScale,
        band: frame.band,
        sortY: frame.sortY,
        alpha,
        order,
      }));
    }
  });
  draws.sort((a, b) => BAND_ORDER[a.band] - BAND_ORDER[b.band] || (a.band === 'actors' ? a.sortY - b.sortY : 0) || a.order - b.order);
  return draws;
}

export async function loadBridgeKitAtlas({ fetchJson, url = BRIDGE_KIT_ATLAS_URL } = {}) {
  if (typeof fetchJson !== 'function') throw new TypeError('fetchJson is required');
  return validateBridgeKitAtlas(await fetchJson(url));
}

export function bridgeKitPageUrls(index, { mobile = false } = {}) {
  const urls = {};
  for (const page of index.atlas.pages) {
    const image = mobile ? page.mobileImage : page.image;
    urls[page.id] = `${BRIDGE_KIT_ASSET_ROOT}/${image.replace(/^\.\//u, '')}`;
  }
  return urls;
}

// Pixi display for the layout lane. `ground` sits under actors (add it to the
// world ground layer); actor-band sprites join `depthLayer` with their sortY
// as zIndex; `overhead` sits above actors. Classes are injected like every
// other HMH display so the module carries no Pixi import of its own.
export function createBridgeKitDisplay({ index, pageTextures, crossingIds = null, depthLayer = null, ContainerClass, SpriteClass, TextureClass, RectangleClass } = {}) {
  if (!index?.crossingById) throw new TypeError('validated bridge kit index is required');
  for (const [value, name] of [[ContainerClass, 'ContainerClass'], [SpriteClass, 'SpriteClass'], [TextureClass, 'TextureClass'], [RectangleClass, 'RectangleClass']]) {
    if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  }
  const ground = new ContainerClass();
  ground.label = 'bridge-kit-ground';
  const overhead = new ContainerClass();
  overhead.label = 'bridge-kit-overhead';
  const actorsFallback = new ContainerClass();
  actorsFallback.label = 'bridge-kit-actors';
  actorsFallback.sortableChildren = true;
  const textures = new Map();
  const sprites = new Map();
  let destroyed = false;
  const textureFor = (part) => {
    let texture = textures.get(part.id);
    if (!texture) {
      const source = pageTextures?.[part.page]?.source;
      if (!source) throw new RangeError(`missing bridge kit page texture ${part.page}`);
      texture = new TextureClass({ source, frame: new RectangleClass(part.frame.x, part.frame.y, part.frame.w, part.frame.h) });
      textures.set(part.id, texture);
    }
    return texture;
  };
  const spriteFor = (draw) => {
    let sprite = sprites.get(draw.partId);
    if (!sprite) {
      sprite = new SpriteClass({ texture: textureFor({ id: draw.partId, page: draw.page, frame: draw.frame }) });
      sprite.label = `bridge-kit-${draw.partId}`;
      sprite.anchor?.set?.(0, 0);
      const parent = draw.band === 'ground' ? ground : draw.band === 'overhead' ? overhead : actorsFallback;
      parent.addChild(sprite);
      if (draw.band === 'actors') depthLayer?.attach?.(sprite);
      sprites.set(draw.partId, sprite);
    }
    return sprite;
  };
  const ids = crossingIds ?? [...index.crossingById.keys()].sort();
  const update = ({ camera, view, presentationTick = 0, gateStates = {}, hero = null } = {}) => {
    if (destroyed) return 0;
    for (const sprite of sprites.values()) sprite.visible = false;
    let drawn = 0;
    for (const crossingId of ids) {
      const crossing = index.crossingById.get(crossingId);
      const onDeck = hero ? bridgeDeckContains(crossing, hero.x, hero.y) : false;
      const draws = resolveBridgeCrossingDraws(index, crossingId, { gateState: gateStates[crossingId] ?? null, presentationTick, heroOnDeck: onDeck });
      draws.forEach((draw, order) => {
        const sprite = spriteFor(draw);
        const screen = worldToScreen({ x: draw.x, y: draw.y, z: 0 }, camera, view);
        const scale = draw.scale * camera.zoom;
        const right = screen.x + draw.frame.w * scale;
        const bottom = screen.y + draw.frame.h * scale;
        const visible = right >= 0 && screen.x <= view.width && bottom >= 0 && screen.y <= view.height;
        sprite.visible = visible;
        if (!visible) return;
        sprite.position.set(screen.x, screen.y);
        sprite.scale.set(scale);
        sprite.alpha = draw.alpha;
        sprite.zIndex = draw.band === 'actors' ? draw.sortY : order;
        drawn += 1;
      });
    }
    return drawn;
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    for (const sprite of sprites.values()) {
      depthLayer?.detach?.(sprite);
      sprite.parent?.removeChild?.(sprite);
      sprite.destroy?.();
    }
    sprites.clear();
    for (const texture of textures.values()) texture.destroy?.(false);
    textures.clear();
    ground.destroy?.({ children: true });
    overhead.destroy?.({ children: true });
    actorsFallback.destroy?.({ children: true });
  };
  return Object.freeze({ ground, overhead, actors: actorsFallback, update, destroy });
}
