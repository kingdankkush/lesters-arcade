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
    this.visible = true;
  }
  clear() { this.strokes.length = 0; return this; }
  moveTo() { return this; }
  lineTo() { return this; }
  bezierCurveTo() { return this; }
  closePath() { return this; }
  rect() { return this; }
  roundRect() { return this; }
  circle() { return this; }
  ellipse() { return this; }
  poly() { return this; }
  fill() { return this; }
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

function fakeTerrainTiles() {
  return {
    ready: true,
    tileSize: 512,
    fringeHeight: 128,
    overlayHeight: 128,
    textureFor: () => TEXTURE,
    fringeTextureFor: () => TEXTURE,
    overlayTextureFor: () => TEXTURE,
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
