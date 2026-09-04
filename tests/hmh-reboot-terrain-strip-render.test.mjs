import assert from 'node:assert/strict';
import test from 'node:test';

import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';
import {
  createWorldProductionLayers,
  renderWorldProductionArt,
} from '../apps/hmh-reboot/src/world-production-art.mjs';

// Chainable no-op Graphics that records every stroke colour, so "the road has
// no black outline any more" is a behavioural claim about draw calls rather
// than a regex over the source.
class FakeGraphics {
  constructor() {
    this.children = [];
    this.strokes = [];
    this.fills = [];
    // Closed polygon paths, so "the face spans lip to foot" is a claim about
    // the traced geometry rather than a regex over the source.
    this.paths = [];
    this.current = null;
    this.visible = true;
  }
  clear() { this.strokes.length = 0; this.fills.length = 0; this.paths.length = 0; this.current = null; return this; }
  moveTo(x, y) { this.current = [[x, y]]; return this; }
  lineTo(x, y) { this.current?.push([x, y]); return this; }
  bezierCurveTo() { return this; }
  closePath() { if (this.current) this.paths.push(this.current); this.current = null; return this; }
  rect() { return this; }
  roundRect() { return this; }
  circle() { return this; }
  ellipse() { return this; }
  arc() { return this; }
  poly() { return this; }
  fill(style) { this.fills.push(style); return this; }
  stroke(style) { this.strokes.push(style); return this; }
}

class FakeContainer {
  constructor() {
    this.children = [];
    this.visible = true;
  }
  addChild(child) { this.children.push(child); return child; }
  addChildAt(child, index) { this.children.splice(index, 0, child); return child; }
  getChildIndex(child) { return this.children.indexOf(child); }
}

class FakeTilingSprite {
  constructor({ texture, width, height } = {}) {
    this.texture = texture;
    this.width = width ?? 1;
    this.height = height ?? 1;
    this.alpha = 1;
    this.rotation = 0;
    this.visible = true;
    this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
    this.tileScale = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } };
    this.tilePosition = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
  }
}

const TEXTURE = { source: { style: {} } };
// One texture object per overlay id, so a strip can be identified by what it
// was placed with.
const OVERLAY_TEXTURES = new Map();
const overlayTextureFor = (id) => {
  if (!OVERLAY_TEXTURES.has(id)) OVERLAY_TEXTURES.set(id, { id, source: { style: {} } });
  return OVERLAY_TEXTURES.get(id);
};

function fakeTerrainTiles() {
  return {
    ready: true,
    tileSize: 512,
    fringeHeight: 128,
    overlayHeight: 128,
    textureFor: () => TEXTURE,
    fringeTextureFor: () => TEXTURE,
    overlayTextureFor,
    createSprite: (materialId, size) => new FakeTilingSprite({ texture: TEXTURE, ...size }),
  };
}

const VIEW = { width: 1440, height: 900 };
const PROFILE = { particlesPerHazard: 10, worldCullMargin: 220 };

function render(camera, worldProduction) {
  const queryGround = createLevelOneGroundQuery();
  return renderWorldProductionArt({
    worldProduction,
    world: LEVEL_ONE_WORLD,
    camera,
    view: VIEW,
    queryGround,
    worldToScreen,
    tick: 180,
    performanceProfile: PROFILE,
    terrainTiles: fakeTerrainTiles(),
  });
}

const layersFor = () => createWorldProductionLayers({
  ContainerClass: FakeContainer,
  GraphicsClass: FakeGraphics,
  TilingSpriteClass: FakeTilingSprite,
});

const visible = (container) => container.children.filter((child) => child.visible).length;

const BRIDGE = { x: 4_700, y: 2_400, zoom: 1, shakeX: 0, shakeY: 0 };
const SPAWN = { x: 900, y: 2_400, zoom: 1, shakeX: 0, shakeY: 0 };

test('W-3 draws no black outline stroke on any route, at the bridge or at spawn', () => {
  const worldProduction = layersFor();
  for (const camera of [BRIDGE, SPAWN]) {
    render(camera, worldProduction);
    const outlines = worldProduction.layers.routes.strokes.filter((style) => style?.color === 0x130f13);
    assert.equal(outlines.length, 0, 'the hard black road border must be gone');
    // With a tile loaded the flat slab fallback must not paint either.
    assert.equal(worldProduction.layers.routes.strokes.filter((style) => style?.width > 0 && style?.color !== 0xffffff).length, 0);
  }
});

test('W-3/W-4 place authored edge strips where the world actually has edges', () => {
  const worldProduction = layersFor();
  render(BRIDGE, worldProduction);
  const atBridge = visible(worldProduction.stripSprites);
  assert.ok(atBridge >= 4, `the bridge view needs road shoulders and both river banks, saw ${atBridge}`);
  const rotations = new Set(worldProduction.stripSprites.children
    .filter((sprite) => sprite.visible)
    .map((sprite) => Math.round(sprite.rotation * 100)));
  assert.ok(rotations.size >= 2, 'shore bands run along the banks, shoulders along the routes');
});

test('W-4 skirts the ravine ledge and its cliffs without touching flat ground', () => {
  const worldProduction = layersFor();
  render({ x: 3_050, y: 1_500, zoom: 1, shakeX: 0, shakeY: 0 }, worldProduction);
  const atRavine = visible(worldProduction.stripSprites);
  render({ x: 900, y: 4_400, zoom: 1, shakeX: 0, shakeY: 0 }, worldProduction);
  const atOpenGround = visible(worldProduction.stripSprites);
  assert.ok(atRavine > atOpenGround, `ravine ${atRavine} must place more strips than open ground ${atOpenGround}`);
});

test('edge strips are pooled: a second render reuses sprites instead of allocating', () => {
  const worldProduction = layersFor();
  render(BRIDGE, worldProduction);
  const firstPass = worldProduction.stripSprites.children.length;
  render(BRIDGE, worldProduction);
  assert.equal(worldProduction.stripSprites.children.length, firstPass, 'strip sprites must be pooled');
  assert.ok(firstPass > 0);
});

test('edge strips stay inert without an overlay texture, so a load failure changes nothing', () => {
  const worldProduction = layersFor();
  const queryGround = createLevelOneGroundQuery();
  renderWorldProductionArt({
    worldProduction,
    world: LEVEL_ONE_WORLD,
    camera: BRIDGE,
    view: VIEW,
    queryGround,
    worldToScreen,
    tick: 180,
    performanceProfile: PROFILE,
    terrainTiles: { ...fakeTerrainTiles(), overlayTextureFor: () => null },
  });
  assert.equal(worldProduction.stripSprites.children.length, 0);
  // And the flat slab comes back when no road tile is loaded at all.
  const fallback = layersFor();
  renderWorldProductionArt({
    worldProduction: fallback,
    world: LEVEL_ONE_WORLD,
    camera: BRIDGE,
    view: VIEW,
    queryGround,
    worldToScreen,
    tick: 180,
    performanceProfile: PROFILE,
    terrainTiles: null,
  });
  assert.ok(fallback.layers.routes.strokes.length > 0, 'no tile means the flat road slab must still draw');
});

// ---------------------------------------------------------------------------
// Cycle 073 W-11 (projection) + W-5 partial: height must read as height.
// worldToScreen maps z straight to screen rows (heightToScreenY = 1), so the
// front face of a raised surface is exactly (groundZ - baseZ) * zoom px tall
// and nothing drew in that band before this cycle.
// ---------------------------------------------------------------------------

const RAVINE = { x: 3_050, y: 1_500, zoom: 1, shakeX: 0, shakeY: 0 };
const MINING = { x: 9_200, y: 1_600, zoom: 1, shakeX: 0, shakeY: 0 };
const RAMP = { x: 2_700, y: 1_500, zoom: 1, shakeX: 0, shakeY: 0 };
const CLIFF = { x: 2_800, y: 650, zoom: 1, shakeX: 0, shakeY: 0 };
const TREE_LINE = { x: 7_000, y: 620, zoom: 1, shakeX: 0, shakeY: 0 };
const OPEN_GROUND = { x: 900, y: 4_400, zoom: 1, shakeX: 0, shakeY: 0 };

const stripsOf = (container, id) => (container?.children ?? []).filter((sprite) => sprite.visible && sprite.texture?.id === id);
const samePath = (paths, expected) => paths.some((path) => JSON.stringify(path) === JSON.stringify(expected));

test('W-11 the ledge front face is exactly as tall as the elevation delta and hangs from the lip', () => {
  const worldProduction = layersFor();
  render(RAVINE, worldProduction);
  const lip = worldToScreen({ x: 2_850, y: 1_650, z: 64 }, RAVINE, VIEW);
  const foot = worldToScreen({ x: 2_850, y: 1_650, z: 0 }, RAVINE, VIEW);
  const faces = stripsOf(worldProduction.surfaceFaceSprites, 'rock-face');
  const face = faces.find((sprite) => sprite.position.y === lip.y);
  assert.ok(face, `a rock-face strip must hang from the overlook lip at y=${lip.y}`);
  assert.equal(face.height, foot.y - lip.y, 'the face height IS the projected elevation delta (64 units at zoom 1)');
  assert.equal(face.position.x, lip.x, 'the face starts at the south-west corner');
  assert.equal(face.width, 600, 'an opaque face may not overshoot the ledge corners the way a fading skirt does');
  // Mining loader deck: 48 units.
  render(MINING, worldProduction);
  const deckLip = worldToScreen({ x: 9_000, y: 1_820, z: 48 }, MINING, VIEW);
  const deck = stripsOf(worldProduction.surfaceFaceSprites, 'rock-face').find((sprite) => sprite.position.y === deckLip.y);
  assert.ok(deck, 'the loader deck needs its own face');
  assert.equal(deck.height, 48);
  assert.equal(deck.width, 550);
});

test('W-11 the shaded face polygon spans lip to foot and is drawn even without a texture', () => {
  const queryGround = createLevelOneGroundQuery();
  const textured = layersFor();
  render(RAVINE, textured);
  const bare = layersFor();
  renderWorldProductionArt({
    worldProduction: bare,
    world: LEVEL_ONE_WORLD,
    camera: RAVINE,
    view: VIEW,
    queryGround,
    worldToScreen,
    tick: 180,
    performanceProfile: PROFILE,
    terrainTiles: { ...fakeTerrainTiles(), overlayTextureFor: (id) => (id === 'rock-face' ? null : overlayTextureFor(id)) },
  });
  assert.ok(stripsOf(textured.surfaceFaceSprites, 'rock-face').length > 0);
  assert.equal(stripsOf(bare.surfaceFaceSprites, 'rock-face').length, 0, 'no texture, no strip: the projection stays inert on a load failure');
  assert.equal(stripsOf(bare.blockerFaceSprites, 'rock-face').length, 0);
  // The Graphics face is the fallback, so the surfaces layer receives the
  // same draws whether or not the texture arrived.
  assert.deepEqual(bare.layers.surfaces.fills, textured.layers.surfaces.fills);
  const lipWest = worldToScreen({ x: 2_850, y: 1_650, z: 64 }, RAVINE, VIEW);
  const lipEast = worldToScreen({ x: 3_450, y: 1_650, z: 64 }, RAVINE, VIEW);
  const footEast = worldToScreen({ x: 3_450, y: 1_650, z: 0 }, RAVINE, VIEW);
  const footWest = worldToScreen({ x: 2_850, y: 1_650, z: 0 }, RAVINE, VIEW);
  const facePath = [[lipWest.x, lipWest.y], [lipEast.x, lipEast.y], [footEast.x, footEast.y], [footWest.x, footWest.y]];
  assert.ok(samePath(bare.layers.surfaces.paths, facePath), `the face trapezoid ${JSON.stringify(facePath)} must be traced into layers.surfaces`);
});

test('W-11 the scree skirt lies on the ground at the foot of the face, not on the wall', () => {
  const worldProduction = layersFor();
  render(RAVINE, worldProduction);
  const lip = worldToScreen({ x: 2_850, y: 1_650, z: 64 }, RAVINE, VIEW);
  const foot = worldToScreen({ x: 2_850, y: 1_650, z: 0 }, RAVINE, VIEW);
  const scree = stripsOf(worldProduction.stripSprites, 'scree-skirt');
  assert.ok(scree.length > 0, 'the overlook still sheds scree');
  assert.ok(scree.some((sprite) => sprite.position.y === foot.y), `scree must start at the foot line y=${foot.y}`);
  assert.equal(scree.filter((sprite) => sprite.position.y === lip.y).length, 0, 'no skirt may hang from the lip down the wall');
});

test('W-11 ramp tiles are clipped to the ramp polygon through a per-sprite mask that hides until assigned', () => {
  const worldProduction = layersFor();
  render(RAMP, worldProduction);
  const ramps = worldProduction.rampSprites.children.filter((sprite) => sprite.visible);
  assert.equal(ramps.length, 1, 'only the switchback ramp is in view');
  const [ramp] = ramps;
  assert.ok(ramp.mask, 'the ramp tile must be masked, or it overpaints two triangles outside its own polygon');
  assert.ok(worldProduction.rampMasks.children.includes(ramp.mask), 'the mask is a pooled ramp-mask graphic, never a pooled surface sprite');
  assert.equal(ramp.mask.visible, true, 'Pixi excludes an assigned mask from the colour buffer, so it may show only once assigned');
  const corners = [[2_500, 1_380, 0], [2_850, 1_380, 64], [2_850, 1_620, 64], [2_500, 1_620, 0]]
    .map(([x, y, z]) => worldToScreen({ x, y, z }, RAMP, VIEW))
    .map((point) => [point.x, point.y]);
  assert.ok(samePath(ramp.mask.paths, corners), 'the mask carries the projected parallelogram, not the bounding box');
  assert.ok(ramp.mask.fills.length > 0, 'a stencil mask needs a fill');
  // Ramps no longer go through the shared surface pool.
  assert.equal(worldProduction.surfaceSprites.children.filter((sprite) => sprite.visible).length, 1, 'the overlook is the only surface tile here');
  render(OPEN_GROUND, worldProduction);
  assert.equal(worldProduction.rampSprites.children.filter((sprite) => sprite.visible).length, 0);
  assert.ok(worldProduction.rampMasks.children.every((mask) => mask.visible === false), 'an unassigned mask is a white fill on screen');
});

test('W-11 a ramp is graded from its low end to its high end and shows a flank face', () => {
  const worldProduction = layersFor();
  render(RAMP, worldProduction);
  const cues = worldProduction.surfaceCues;
  // Five grade quads across the ramp, darkest at the low (west, z=0) end.
  const gradeFills = cues.fills.filter((style) => style?.color === 0x03070b);
  assert.ok(gradeFills.length >= 5, `expected at least five grade bands on the switchback ramp, saw ${gradeFills.length}`);
  assert.ok(gradeFills[0].alpha > gradeFills[4].alpha, 'the low end is darker than the high end');
  // Flank: the camera-facing side of the ramp is a triangle from the low
  // south-west corner up to the high south-east corner and down to its foot.
  const low = worldToScreen({ x: 2_500, y: 1_620, z: 0 }, RAMP, VIEW);
  const high = worldToScreen({ x: 2_850, y: 1_620, z: 64 }, RAMP, VIEW);
  const footEast = worldToScreen({ x: 2_850, y: 1_620, z: 0 }, RAMP, VIEW);
  const flank = [[low.x, low.y], [high.x, high.y], [footEast.x, footEast.y], [low.x, low.y]];
  assert.ok(samePath(worldProduction.layers.surfaces.paths, flank), `the ramp flank ${JSON.stringify(flank)} must be traced into layers.surfaces`);
  const flankStrip = stripsOf(worldProduction.surfaceFaceSprites, 'rock-face').find((sprite) => sprite.position.y === high.y);
  assert.ok(flankStrip, 'the flank carries the rock face too');
  assert.ok(flankStrip.mask && worldProduction.rampMasks.children.includes(flankStrip.mask), 'the flank strip is clipped to the flank triangle');
});

test('W-5 a cliff draws a grounded rock mass with a raised plate and a textured face, not a capsule with a stripe', () => {
  const worldProduction = layersFor();
  render(CLIFF, worldProduction);
  const stripes = worldProduction.layers.blockers.strokes.filter((style) => style?.color === 0xd98656 && style?.width >= 6);
  assert.equal(stripes.length, 0, 'the 12%-width orange stripe is the capsule tell');
  const faces = stripsOf(worldProduction.blockerFaceSprites, 'rock-face');
  assert.ok(faces.length >= 1, 'the north cliff needs a rock-face strip along its camera-facing side');
  // maxZ 140 -> clamp(140 * 0.45, 24, 64) = 63 px at zoom 1; the strip hangs
  // from the plate rim (ground rim minus that height) down to the ground rim.
  const rim = worldToScreen({ x: 1_850, y: 650 + 48, z: 0 }, CLIFF, VIEW);
  const face = faces.find((sprite) => sprite.position.y === rim.y - 63);
  assert.ok(face, `the face must hang from the plate rim at y=${rim.y - 63}`);
  assert.equal(face.height, 63);
  // The plate is the same capsule lifted by the face height; the body sits on
  // the ground. Both are full-width strokes.
  const bodyStrokes = worldProduction.layers.blockers.strokes.filter((style) => style?.width === 96);
  assert.ok(bodyStrokes.length >= 2, 'ground body and raised plate are both full-width capsule strokes');
  // Dense-trees keep their canopy path: no face strips at the hashwood tree line.
  render(TREE_LINE, worldProduction);
  assert.equal(stripsOf(worldProduction.blockerFaceSprites, 'rock-face').length, 0);
});

test('W-11 face and ramp containers live inside the world art root between the layers they dress', () => {
  const worldProduction = layersFor();
  const index = (child) => worldProduction.root.getChildIndex(child);
  const { layers } = worldProduction;
  assert.ok(index(layers.surfaces) < index(worldProduction.surfaceFaceSprites), 'faces draw above the flat surface base');
  assert.ok(index(worldProduction.surfaceFaceSprites) < index(worldProduction.surfaceSprites), 'the opaque top tile covers any face overshoot');
  assert.ok(index(worldProduction.surfaceSprites) < index(worldProduction.rampSprites));
  assert.ok(index(worldProduction.rampSprites) < index(worldProduction.rampMasks));
  assert.ok(index(worldProduction.rampMasks) < index(worldProduction.surfaceCues), 'cues stay above every surface tile');
  assert.ok(index(layers.blockers) < index(worldProduction.blockerFaceSprites), 'a cliff face paints over the body it belongs to');
  assert.ok(index(worldProduction.blockerFaceSprites) < index(layers.townBlockers));
  // Actors are added after worldProduction.root in main.mjs, so everything in
  // it, faces included, sits beneath a hero standing on the ledge.
  assert.equal(worldProduction.surfaceFaceSprites.label, 'world-surface-faces');
  assert.equal(worldProduction.blockerFaceSprites.label, 'world-blocker-faces');
  assert.equal(worldProduction.rampSprites.label, 'world-ramp-tiles');
  assert.equal(worldProduction.rampMasks.label, 'world-ramp-masks');
});
