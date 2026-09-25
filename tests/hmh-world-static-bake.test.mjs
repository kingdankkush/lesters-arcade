// Static world bake (projection only).
//
// The ground plane (terrain, roads, surfaces, strips, blockers, decals) used
// to be re-projected, re-drawn and re-tessellated every frame. It is now drawn
// once into camera-anchored layers and translated while the camera stays
// inside a margin; only the animated pieces (water shimmer, landmarks,
// interactions, particles, lighting) draw per frame. These tests hold the
// split and the translation to exactly what the per-frame renderer produced.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createAuthoredGroundQuery } from '../apps/hmh-reboot/src/elevation.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';
import {
  WORLD_PRODUCTION_ART,
  createWorldProductionLayers,
  renderWorldProductionArt,
} from '../apps/hmh-reboot/src/world-production-art.mjs';
import {
  STATIC_WORLD_BAKE_MARGIN,
  createStaticWorldBake,
} from '../apps/hmh-reboot/src/world-static-bake.mjs';

const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Recording Pixi stand-ins: every draw command lands in an ordered log, so the
// comparisons below are about exact geometry and order, not counts.
// ---------------------------------------------------------------------------
const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
const DRAW = ['moveTo', 'lineTo', 'bezierCurveTo', 'closePath', 'rect', 'roundRect', 'circle', 'ellipse', 'arc', 'poly', 'fill', 'stroke'];

class RecContainer {
  constructor() { this.children = []; this.visible = true; this.parent = null; this.position = point(); this.label = ''; this.zIndex = 0; }
  addChild(...children) {
    for (const child of children) {
      child.parent?.removeChild(child);
      child.parent = this;
      this.children.push(child);
    }
    return children[0];
  }
  addChildAt(child, index) {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.splice(index, 0, child);
    return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parent = null;
    return child;
  }
  getChildIndex(child) { return this.children.indexOf(child); }
  destroy() {}
}

class RecGraphics extends RecContainer {
  constructor() { super(); this.log = []; this.clears = 0; }
  clear() { this.log.length = 0; this.clears += 1; return this; }
}
for (const name of DRAW) RecGraphics.prototype[name] = function record(...args) { this.log.push([name, ...args]); return this; };

class RecTilingSprite extends RecContainer {
  constructor({ texture, width, height } = {}) {
    super();
    this.texture = texture;
    this.width = width ?? 1;
    this.height = height ?? 1;
    this.alpha = 1;
    this.rotation = 0;
    this.tint = 0xffffff;
    this.mask = null;
    this.tileScale = point();
    this.tilePosition = point();
  }
}

const textures = new Map();
const texture = (id) => {
  if (!textures.has(id)) textures.set(id, { id, source: { style: {} } });
  return textures.get(id);
};
const fakeTerrainTiles = (overrides = {}) => ({
  ready: true,
  version: 1,
  tileSize: 512,
  fringeHeight: 128,
  overlayHeight: 128,
  textureFor: (id) => texture(`tile:${id}`),
  fringeTextureFor: (id) => texture(`fringe:${id}`),
  overlayTextureFor: (id) => texture(id),
  createSprite: (materialId, size) => new RecTilingSprite({ texture: texture(`tile:${materialId}`), ...size }),
  ...overrides,
});

const fakeDepthLayer = () => ({ attached: [], attach(node) { this.attached.push(node); }, detach(node) { this.attached = this.attached.filter((entry) => entry !== node); } });
const layersFor = () => createWorldProductionLayers({
  ContainerClass: RecContainer,
  GraphicsClass: RecGraphics,
  TilingSpriteClass: RecTilingSprite,
  depthLayer: fakeDepthLayer(),
});

// The former ford fixture exercises the shallow-water paths too.
const SHALLOWS_WORLD = { ...LEVEL_ONE_WORLD, surfaces: LEVEL_ONE_WORLD.surfaces.map((surface) => surface.id === 'crossing-shallows' ? {
  id: 'crossing-shallows', kind: 'shallow-water', area: { type: 'rect', minX: 4500, minY: 800, maxX: 5000, maxY: 1150 },
  groundZ: 0, waterLevel: 4, deepWater: false, visibleTerrainId: 'water-crossing-shallows', priority: 2,
} : surface) };
const groundFor = (world) => createAuthoredGroundQuery({ baseSurface: world.baseSurface, surfaces: world.surfaces });

const VIEW = { width: 1440, height: 900 };
const MOBILE_VIEW = { width: 414, height: 896 };
const PROFILE = { particlesPerHazard: 10, worldCullMargin: 192 };
const camera = (x, y, extra = {}) => ({ x, y, zoom: 1, shakeX: 0, shakeY: 0, groundZ: 0, ...extra });
const SCENES = [
  ['bridge', LEVEL_ONE_WORLD, camera(4_700, 2_400)],
  ['north crossing', LEVEL_ONE_WORLD, camera(4_750, 1_000, { groundZ: 16 })],
  ['reservoir', LEVEL_ONE_WORLD, camera(5_000, 3_900, { zoom: 0.72 })],
  ['ravine ramp', LEVEL_ONE_WORLD, camera(2_700, 1_500)],
  ['ravine cliff', LEVEL_ONE_WORLD, camera(2_800, 650, { zoom: 0.8 })],
  ['mining deck', LEVEL_ONE_WORLD, camera(9_200, 1_600, { groundZ: 48 })],
  ['spawn', LEVEL_ONE_WORLD, camera(900, 2_400)],
  ['fuel route', LEVEL_ONE_WORLD, camera(5_400, 3_000)],
  ['tanker row', LEVEL_ONE_WORLD, camera(10_450, 3_300, { zoom: 0.72 })],
  ['ford', SHALLOWS_WORLD, camera(4_900, 1_050)],
];

const TILES = fakeTerrainTiles();
const argsFor = (worldProduction, world, cam, extra = {}) => ({
  worldProduction,
  world,
  camera: cam,
  view: VIEW,
  queryGround: groundFor(world),
  worldToScreen,
  tick: 180,
  performanceProfile: PROFILE,
  terrainTiles: TILES,
  ...extra,
});

const waterCount = (world) => world.surfaces.filter((surface) => surface.kind.includes('water')).length;
const segmentsFor = (worldProduction, world) => {
  const cues = [worldProduction.surfaceCues];
  const shimmers = [];
  for (let index = 0; index < waterCount(world); index += 1) {
    shimmers.push(new RecGraphics());
    cues.push(new RecGraphics());
  }
  return { cues, shimmers };
};

const SPRITE_POOLS = ['terrainSprites', 'fringeSprites', 'stripSprites', 'surfaceSprites', 'surfaceFaceSprites', 'rampSprites', 'waterStripSprites', 'blockerFaceSprites', 'roadSprites', 'pathSprites'];
const spriteState = (sprite) => sprite.log ? { mask: true, visible: sprite.visible, log: sprite.log } : {
  visible: sprite.visible, texture: sprite.texture?.id, x: sprite.position.x, y: sprite.position.y, width: sprite.width, height: sprite.height,
  alpha: sprite.alpha, rotation: sprite.rotation, tint: sprite.tint, tileScale: [sprite.tileScale.x, sprite.tileScale.y],
  tilePosition: [sprite.tilePosition.x, sprite.tilePosition.y], mask: sprite.mask ? { visible: sprite.mask.visible, log: sprite.mask.log } : null,
};
const poolState = (worldProduction) => Object.fromEntries(SPRITE_POOLS.map((name) => [name, worldProduction[name].children.map(spriteState)]));
const depthState = (worldProduction) => [...worldProduction.depthFeatureState.nodes.values()].map((node) => ({
  label: node.label, visible: node.visible, zIndex: node.zIndex, body: node.body.log, faces: node.faces.children.map(spriteState),
}));

// ---------------------------------------------------------------------------
// 1. The pass split is exact: static + dynamic == the per-frame renderer.
// ---------------------------------------------------------------------------
for (const [name, world, cam] of SCENES) test(`static and dynamic passes reproduce the full render exactly: ${name}`, () => {
  const full = layersFor();
  const fullReport = renderWorldProductionArt(argsFor(full, world, cam));
  const split = layersFor();
  const { cues, shimmers } = segmentsFor(split, world);
  renderWorldProductionArt(argsFor(split, world, cam, { pass: 'static', cues }));
  const report = renderWorldProductionArt(argsFor(split, world, cam, { pass: 'dynamic', shimmers }));

  for (const layer of WORLD_PRODUCTION_ART.layers) {
    assert.deepEqual(split.layers[layer].log, full.layers[layer].log, `layer ${layer}`);
  }
  // Water shimmer is animated; every other cue is static. Interleaving the
  // segments in world order reproduces the single cue layer draw for draw.
  const interleaved = cues.flatMap((cue, index) => [...cue.log, ...(shimmers[index]?.log ?? [])]);
  assert.deepEqual(interleaved, full.surfaceCues.log, 'surface cues in the exact original order');
  assert.ok(shimmers.some((shimmer) => shimmer.log.length > 0) === full.surfaceCues.log.some(([, style]) => style?.color === 0xbaf5ff),
    'shimmer lands in the animated segments whenever the full render drew any');
  assert.deepEqual(poolState(split), poolState(full), 'pooled tiles, strips and masks');
  assert.deepEqual(split.roadMask.log, full.roadMask.log);
  assert.deepEqual(split.pathMask.log, full.pathMask.log);
  assert.equal(split.roadMask.visible, full.roadMask.visible);
  assert.deepEqual(split.rampMasks.children.map(spriteState), full.rampMasks.children.map(spriteState));
  assert.deepEqual(depthState(split), depthState(full), 'depth-sorted fallback features');
  assert.deepEqual(report, fullReport, 'the dynamic pass reports what the full render reported');
});

// Explosive drums, crates, hazards, landmarks and the river all in view.
const MIXED = [camera(4_700, 2_400), camera(5_400, 3_000), camera(8_600, 1_300), camera(3_450, 3_000)];
const animatedLogs = (production, shimmers) => JSON.stringify([shimmers.map((shimmer) => shimmer.log),
  ['landmarks', 'interactions', 'particles', 'lighting'].map((layer) => production.layers[layer].log)]);
for (const cam of MIXED) test(`each pass leaves the other pass's layers alone at ${cam.x},${cam.y}`, () => {
  const world = LEVEL_ONE_WORLD;
  const production = layersFor();
  const { cues, shimmers } = segmentsFor(production, world);
  renderWorldProductionArt(argsFor(production, world, cam, { pass: 'static', cues }));
  const staticLogs = () => JSON.stringify([
    ['terrain', 'groundDetails', 'routes', 'surfaces', 'details', 'blockers', 'townBlockers'].map((layer) => production.layers[layer].log),
    cues.map((cue) => cue.log), poolState(production), production.roadMask.log, depthState(production),
  ]);
  const before = staticLogs();
  assert.ok(production.layers.details.log.length > 0, 'the view has static details');
  const clears = production.layers.terrain.clears;
  renderWorldProductionArt(argsFor(production, world, cam, { pass: 'dynamic', shimmers, tick: 181 }));
  const at181 = animatedLogs(production, shimmers);
  renderWorldProductionArt(argsFor(production, world, { ...cam, x: cam.x + 30 }, { pass: 'dynamic', shimmers, tick: 240 }));
  assert.notEqual(animatedLogs(production, shimmers), at181, 'the animated pass animates');
  assert.equal(staticLogs(), before, 'a dynamic pass never touches baked layers');
  assert.equal(production.layers.terrain.clears, clears);
  renderWorldProductionArt(argsFor(production, world, cam, { pass: 'dynamic', shimmers, tick: 181 }));
  assert.equal(animatedLogs(production, shimmers), at181, 'the animated pass is a pure function of tick and camera');
  renderWorldProductionArt(argsFor(production, world, { ...cam, x: 0, y: 0 }, { pass: 'static', cues }));
  assert.equal(animatedLogs(production, shimmers), at181, 'a static pass never touches animated layers');
});

test('the screen-space vignette is drawn once per view size, not every frame', () => {
  const production = layersFor();
  const cam = camera(900, 2_400);
  renderWorldProductionArt(argsFor(production, LEVEL_ONE_WORLD, cam));
  const vignette = production.layers.vignette;
  const first = JSON.stringify(vignette.log);
  assert.ok(vignette.log.length > 0);
  const clears = vignette.clears;
  renderWorldProductionArt(argsFor(production, LEVEL_ONE_WORLD, { ...cam, x: 1_000 }, { tick: 400 }));
  assert.equal(vignette.clears, clears, 'an unchanged view keeps the drawn vignette');
  assert.equal(JSON.stringify(vignette.log), first);
  renderWorldProductionArt(argsFor(production, LEVEL_ONE_WORLD, cam, { view: MOBILE_VIEW }));
  assert.equal(vignette.clears, clears + 1, 'a resized view redraws it');
  const resized = layersFor();
  renderWorldProductionArt(argsFor(resized, LEVEL_ONE_WORLD, cam, { view: MOBILE_VIEW }));
  assert.deepEqual(vignette.log, resized.layers.vignette.log);
});

// ---------------------------------------------------------------------------
// 2. The bake: layer grouping, translation and rebake policy.
// ---------------------------------------------------------------------------
const flatten = (node, groups, out = []) => {
  for (const child of node.children) {
    if (groups.includes(child)) flatten(child, groups, out);
    else out.push(child);
  }
  return out;
};

test('baking groups the static layers without changing the draw order', () => {
  const production = layersFor();
  const before = [...production.root.children];
  const decals = new RecGraphics();
  const bake = createStaticWorldBake({ worldProduction: production, world: LEVEL_ONE_WORLD, render: renderWorldProductionArt, ContainerClass: RecContainer, GraphicsClass: RecGraphics, extraLayers: [decals] });
  const cueAt = before.indexOf(production.surfaceCues);
  const segments = bake.cues.slice(1).flatMap((cue, index) => [bake.shimmers[index], cue]);
  assert.equal(bake.cues.length, waterCount(LEVEL_ONE_WORLD) + 1);
  assert.equal(bake.cues[0], production.surfaceCues);
  assert.deepEqual(flatten(production.root, bake.groups), [...before.slice(0, cueAt + 1), ...segments, ...before.slice(cueAt + 1)],
    'the shimmer segments slot in after the surface cues; nothing else moves');
  for (const group of bake.groups) {
    assert.equal(group.isRenderGroup, true, 'baked layers render as their own GPU-transformed group');
    assert.equal(group.parent, production.root);
  }
  const grouped = new Set(bake.groups.flatMap((group) => group.children));
  for (const layer of ['terrain', 'routes', 'surfaces', 'details', 'blockers', 'townBlockers']) assert.ok(grouped.has(production.layers[layer]), layer);
  for (const layer of ['landmarks', 'interactions', 'particles', 'lighting', 'vignette']) {
    assert.equal(production.layers[layer].parent, production.root, `${layer} stays in screen space`);
  }
  assert.equal(production.depthFeatureRoot.parent, production.root, 'depth-sorted features stay beside the actors\' depth layer');
  for (const shimmer of bake.shimmers) assert.equal(shimmer.parent, production.root);
});

const bakeFor = (world = LEVEL_ONE_WORLD, options = {}) => {
  const production = layersFor();
  const calls = [];
  const render = (args) => { calls.push(args); return renderWorldProductionArt(args); };
  const decals = new RecGraphics();
  const bake = createStaticWorldBake({ worldProduction: production, world, render, ContainerClass: RecContainer, GraphicsClass: RecGraphics, extraLayers: [decals], ...options });
  return { production, bake, calls, decals, statics: () => calls.filter((args) => args.pass === 'static') };
};

const EPS = 1e-6;
const near = (a, b) => Math.abs(a - b) <= EPS;
// Segments and shapes a direct render put on screen must all be present, at
// the same screen coordinates, in the translated bake. The bake may carry
// more (its margin); a route broken at a culled segment starts a new subpath,
// so moveTo is not compared, only the segments themselves.
const shapeKeys = (log, dx = 0, dy = 0) => {
  const keys = [];
  let at = null;
  const r = (value) => Math.round(value * 1e4) / 1e4;
  const p = (x, y) => `${r(x + dx)},${r(y + dy)}`;
  for (const [name, ...args] of log) {
    if (name === 'moveTo') at = p(args[0], args[1]);
    else if (name === 'lineTo') { const next = p(args[0], args[1]); keys.push(`line ${at} ${next}`); at = next; }
    else if (name === 'bezierCurveTo') { keys.push(`bez ${at} ${p(args[0], args[1])} ${p(args[2], args[3])} ${p(args[4], args[5])}`); at = p(args[4], args[5]); }
    else if (['rect', 'roundRect', 'circle', 'ellipse', 'arc'].includes(name)) keys.push(`${name} ${p(args[0], args[1])} ${args.slice(2).map(r).join(',')}`);
  }
  return keys;
};
// The direct render's surface cues without the animated shimmer paths.
const SHIMMER_COLORS = new Set([0xbaf5ff, 0xe6ffff]);
const staticCueLog = (log) => {
  const kept = [];
  let path = [];
  for (const entry of log) {
    path.push(entry);
    if (entry[0] !== 'stroke' && entry[0] !== 'fill') continue;
    if (!SHIMMER_COLORS.has(entry[1]?.color)) kept.push(...path);
    path = [];
  }
  return kept;
};
const assertIncluded = (direct, baked, label) => {
  const available = new Map();
  for (const key of baked) available.set(key, (available.get(key) ?? 0) + 1);
  const missing = direct.filter((key) => {
    const count = available.get(key) ?? 0;
    if (!count) return true;
    available.set(key, count - 1);
    return false;
  });
  assert.deepEqual(missing.slice(0, 5), [], `${label}: ${missing.length} on-screen shapes missing from the translated bake`);
};
// Visible sprites of a direct render must exist in the bake at the same
// screen place with the same texture phase (position + tilePosition).
// Road and path tiles span the whole (bake) view rather than one surface, so
// for those only the texture phase and coverage of the view must agree.
const assertSpritesMatch = (direct, baked, offset, label, viewport = null) => {
  for (const sprite of direct.children.filter((child) => child.visible && child.tilePosition)) {
    const match = baked.children.find((candidate) => candidate.visible && candidate.texture === sprite.texture
      && near(candidate.rotation, sprite.rotation) && near(candidate.alpha, sprite.alpha) && (viewport ? true
        : near(candidate.position.x + offset.x, sprite.position.x) && near(candidate.position.y + offset.y, sprite.position.y)
        && near(candidate.width, sprite.width) && near(candidate.height, sprite.height)));
    assert.ok(match, `${label}: no baked sprite for ${sprite.texture?.id} at ${sprite.position.x},${sprite.position.y}`);
    if (viewport) {
      assert.ok(match.position.x + offset.x <= 0 && match.position.y + offset.y <= 0
        && match.position.x + offset.x + match.width >= viewport.width && match.position.y + offset.y + match.height >= viewport.height,
      `${label}: the baked ${sprite.texture?.id} tile must still cover the view`);
      assert.equal(match.mask, baked.children.find((child) => child.log));
    }
    assert.ok(near(match.tilePosition.x + match.position.x + offset.x, sprite.tilePosition.x + sprite.position.x)
      && near(match.tilePosition.y + match.position.y + offset.y, sprite.tilePosition.y + sprite.position.y),
    `${label}: ${sprite.texture?.id} texture phase drifted (${match.tilePosition.x},${match.tilePosition.y} vs ${sprite.tilePosition.x},${sprite.tilePosition.y})`);
    assert.ok(near(match.tileScale.x, sprite.tileScale.x) && near(match.tileScale.y, sprite.tileScale.y), `${label}: tile scale`);
  }
};

const PATHS = [
  ['bridge walk', LEVEL_ONE_WORLD, [camera(4_300, 2_400), camera(4_330, 2_380), camera(4_420, 2_430, { groundZ: 8 }), camera(4_600, 2_420, { groundZ: 16 }), camera(4_700, 2_300, { groundZ: 16 })]],
  ['ravine climb', LEVEL_ONE_WORLD, [camera(2_600, 1_500, { zoom: 0.8 }), camera(2_650, 1_480, { zoom: 0.8, groundZ: 18 }), camera(2_800, 1_470, { zoom: 0.8, groundZ: 51 }), camera(3_000, 1_400, { zoom: 0.8, groundZ: 64 })]],
  ['mobile river bank', LEVEL_ONE_WORLD, [camera(4_300, 3_700, { zoom: 0.72 }), camera(4_340, 3_760, { zoom: 0.72 }), camera(4_380, 3_840, { zoom: 0.72 })], MOBILE_VIEW],
];

for (const [name, world, cameras, view = VIEW] of PATHS) test(`a translated bake puts the static world where the per-frame renderer drew it: ${name}`, () => {
  const { production, bake, statics } = bakeFor(world);
  for (const [index, cam] of cameras.entries()) {
    const args = argsFor(production, world, cam, { view, tick: 180 + index });
    const report = bake.render(args);
    const direct = layersFor();
    const directReport = renderWorldProductionArt(argsFor(direct, world, cam, { view, tick: 180 + index }));
    assert.deepEqual(report, directReport);
    const offset = bake.offset;
    for (const moved of [...bake.groups, ...bake.cues.slice(1)]) assert.deepEqual([moved.position.x, moved.position.y], [offset.x, offset.y]);
    for (const shimmer of bake.shimmers) assert.deepEqual([shimmer.position.x, shimmer.position.y], [0, 0], 'animated cues stay in screen space');
    assert.deepEqual([production.depthFeatureRoot.position.x, production.depthFeatureRoot.position.y], [offset.x, offset.y]);
    for (const layer of ['terrain', 'groundDetails', 'routes', 'surfaces', 'details', 'blockers', 'townBlockers']) {
      assertIncluded(shapeKeys(direct.layers[layer].log), shapeKeys(production.layers[layer].log, offset.x, offset.y), `${name}#${index} ${layer}`);
    }
    assertIncluded(shapeKeys(direct.roadMask.log), shapeKeys(production.roadMask.log, offset.x, offset.y), `${name}#${index} road mask`);
    const bakedCues = bake.cues.flatMap((cue) => shapeKeys(cue.log, offset.x, offset.y));
    assertIncluded(shapeKeys(staticCueLog(direct.surfaceCues.log)), bakedCues, `${name}#${index} static cues`);
    const shimmerKeys = bake.shimmers.flatMap((shimmer) => shapeKeys(shimmer.log));
    const directShimmer = shapeKeys(direct.surfaceCues.log).filter((key) => !shapeKeys(staticCueLog(direct.surfaceCues.log)).includes(key));
    assert.deepEqual(shimmerKeys, directShimmer, `${name}#${index} the shimmer is drawn in screen space, exactly as before`);
    for (const pool of ['terrainSprites', 'fringeSprites', 'stripSprites', 'surfaceSprites', 'surfaceFaceSprites', 'rampSprites', 'waterStripSprites', 'blockerFaceSprites']) {
      assertSpritesMatch(direct[pool], production[pool], offset, `${name}#${index} ${pool}`);
    }
    // Road and path tiles cover the whole bake area rather than the view, so
    // only their placement and texture phase must agree.
    assertSpritesMatch(direct.roadSprites, production.roadSprites, offset, `${name}#${index} roadSprites`, view);
    assertSpritesMatch(direct.pathSprites, production.pathSprites, offset, `${name}#${index} pathSprites`, view);
    for (const layer of ['landmarks', 'interactions', 'particles', 'lighting', 'vignette']) {
      assert.deepEqual(production.layers[layer].log, direct.layers[layer].log, `${name}#${index} ${layer} is drawn in screen space`);
    }
  }
  assert.ok(statics().length < cameras.length, 'camera moves inside the margin reuse the bake');
});

test('rebake policy: only a real change or leaving the margin re-draws the static world', () => {
  const { production, bake, statics, calls, decals } = bakeFor();
  const baked = [];
  const onBake = (bakeCamera, bakeView) => { baked.push([bakeCamera, bakeView]); decals.clear().rect(0, 0, 1, 1); };
  const cam = camera(900, 2_400);
  const args = (overrides = {}) => argsFor(production, LEVEL_ONE_WORLD, cam, overrides);
  bake.render(args(), onBake);
  assert.equal(statics().length, 1);
  assert.deepEqual(baked[0][1], { width: VIEW.width + 2 * STATIC_WORLD_BAKE_MARGIN, height: VIEW.height + 2 * STATIC_WORLD_BAKE_MARGIN });
  assert.deepEqual({ ...baked[0][0] }, { ...cam });
  assert.notEqual(baked[0][0], cam, 'the bake keeps its own camera snapshot');
  assert.deepEqual([decals.position.x, decals.position.y], [-STATIC_WORLD_BAKE_MARGIN, -STATIC_WORLD_BAKE_MARGIN], 'extra layers move with the bake');
  const dynamics = () => calls.filter((entry) => entry.pass === 'dynamic').length;
  assert.equal(dynamics(), 1);
  const expectStatic = (count, message) => assert.equal(statics().length, count, message);

  bake.render(args({ tick: 181 }), onBake);
  expectStatic(1, 'an idle frame only animates');
  assert.equal(dynamics(), 2);
  cam.x += STATIC_WORLD_BAKE_MARGIN - 1; cam.y -= STATIC_WORLD_BAKE_MARGIN - 1;
  bake.render(args(), onBake);
  expectStatic(1, 'moves inside the margin translate');
  cam.x += 2;
  bake.render(args(), onBake);
  expectStatic(2, 'leaving the margin re-bakes around the camera');
  assert.equal(baked.length, 2);
  bake.render(args({ view: MOBILE_VIEW }), onBake);
  expectStatic(3, 'a resize re-bakes');
  bake.render(args({ view: MOBILE_VIEW, nativeBlockerIds: new Set(['relay-abandoned-farmhouse']) }), onBake);
  expectStatic(4, 'native art replacing a fallback blocker re-bakes');
  bake.render(args({ view: MOBILE_VIEW, nativeBlockerIds: new Set(['relay-abandoned-farmhouse']) }), onBake);
  expectStatic(4, 'an equal blocker set is not a change');
  production.layers.townBlockers.visible = false;
  bake.render(args({ view: MOBILE_VIEW, nativeBlockerIds: new Set(['relay-abandoned-farmhouse']) }), onBake);
  expectStatic(5, 'hiding the town fallback re-bakes');
  const later = fakeTerrainTiles({ overlayTextureFor: () => null });
  bake.render(args({ view: MOBILE_VIEW, nativeBlockerIds: new Set(['relay-abandoned-farmhouse']), terrainTiles: later }), onBake);
  expectStatic(6, 'another tile registry re-bakes');
  bake.render(args({ view: MOBILE_VIEW, nativeBlockerIds: new Set(['relay-abandoned-farmhouse']), terrainTiles: later }), onBake);
  expectStatic(6, 'an unchanged registry is not a change');
  later.version += 1;
  bake.render(args({ view: MOBILE_VIEW, nativeBlockerIds: new Set(['relay-abandoned-farmhouse']), terrainTiles: later }), onBake);
  expectStatic(7, 'a texture arriving in the registry re-bakes');
  bake.render(args({ view: MOBILE_VIEW, nativeBlockerIds: new Set(['relay-abandoned-farmhouse']), terrainTiles: later }), onBake, 'decals-v2');
  expectStatic(8, 'an extra key (late decals) re-bakes');
  // A zoom that is still animating bakes with no margin: exactly the old
  // per-frame cost, never a bigger one.
  const zoomArgs = () => args({ view: MOBILE_VIEW, nativeBlockerIds: new Set(['relay-abandoned-farmhouse']), terrainTiles: later });
  cam.zoom = 0.9;
  bake.render(zoomArgs(), onBake, 'decals-v2');
  expectStatic(9);
  assert.deepEqual(baked.at(-1)[1], MOBILE_VIEW, 'an animating zoom bakes the bare view');
  cam.zoom = 0.85;
  bake.render(zoomArgs(), onBake, 'decals-v2');
  expectStatic(10);
  assert.deepEqual(baked.at(-1)[1], MOBILE_VIEW);
  bake.render(zoomArgs(), onBake, 'decals-v2');
  expectStatic(10, 'a settled zoom with a still camera keeps the bare bake');
  cam.x += 1;
  bake.render(zoomArgs(), onBake, 'decals-v2');
  expectStatic(11, 'moving off a bare bake re-bakes');
  assert.deepEqual(baked.at(-1)[1], { width: MOBILE_VIEW.width + 2 * STATIC_WORLD_BAKE_MARGIN, height: MOBILE_VIEW.height + 2 * STATIC_WORLD_BAKE_MARGIN },
    'and a settled zoom gets the full margin back');
  assert.equal(baked.length, statics().length, 'onBake runs exactly once per static pass');
  assert.equal(dynamics(), calls.length - statics().length, 'every frame runs exactly one dynamic pass');
});

test('the terrain registry versions every change a baked ground depends on', async () => {
  const { createTerrainTileRegistry } = await import('../apps/hmh-reboot/src/terrain-tile-atlas.mjs');
  const registry = createTerrainTileRegistry({ TilingSpriteClass: RecTilingSprite });
  const source = () => ({ source: { style: { update() {} }, update() {} } });
  const seen = [registry.version];
  registry.register('road', source());
  seen.push(registry.version);
  registry.registerFringe('road', source());
  seen.push(registry.version);
  registry.registerOverlay('shore-band', source());
  seen.push(registry.version);
  registry.markFailed('water');
  seen.push(registry.version);
  assert.deepEqual(seen, [0, 1, 2, 3, 3], 'every texture arrival bumps the version; a failure changes nothing drawn');
});

test('the camera ground height shifts the baked world but not the tile pattern', () => {
  // worldToScreen lifts geometry by camera.groundZ; the terrain placer anchors
  // the tile pattern to the camera without it. The bake must keep both.
  const { production, bake } = bakeFor();
  const cam = camera(2_700, 1_500);
  bake.render(argsFor(production, LEVEL_ONE_WORLD, cam));
  const first = production.terrainSprites.children.find((sprite) => sprite.visible);
  const before = { x: first.tilePosition.x, y: first.tilePosition.y };
  cam.groundZ = 40;
  bake.render(argsFor(production, LEVEL_ONE_WORLD, cam));
  assert.equal(first.tilePosition.x, before.x);
  assert.ok(Math.abs(first.tilePosition.y - before.y) > 1, 'the tile phase is corrected against the lift');
  const direct = layersFor();
  renderWorldProductionArt(argsFor(direct, LEVEL_ONE_WORLD, cam));
  assertSpritesMatch(direct.terrainSprites, production.terrainSprites, bake.offset, 'lifted terrain');
});

test('the runtime renders the ground through the lazily loaded bake', () => {
  assert.match(mainSource, /import\('\.\/world-static-bake\.mjs'\)/, 'the bake stays out of the initial JS');
  assert.match(mainSource, /createStaticWorldBake\(\{[^}]*render: renderWorldProductionArt/s);
  const renderWorld = mainSource.slice(mainSource.indexOf('const renderWorld = '), mainSource.indexOf('renderAuthoredTerrain(view);'));
  assert.doesNotMatch(renderWorld, /worldDecalLayer\.clear\(\)/, 'decals are drawn once per bake, not cleared every frame');
  assert.match(renderWorld, /if \(backdrop\.drawnFor !== viewKey\) backdrop\.clear\(\)\.rect/, 'the backdrop only redraws when the view changes');
  assert.doesNotMatch(renderWorld.replace(/if \(backdrop\.drawnFor !== viewKey\) backdrop\.clear\(\)/, ''), /backdrop\.clear\(\)/);
});
