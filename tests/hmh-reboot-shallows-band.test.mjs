import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { TERRAIN_OVERLAY_IDS } from '../apps/hmh-reboot/src/terrain-tile-atlas.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';
import {
  createWorldProductionLayers,
  renderWorldProductionArt,
} from '../apps/hmh-reboot/src/world-production-art.mjs';

// W-4 shallows band (Cycle 074). The crossing shallows share the river's
// x-span, so their LONG edges (y 800 and 1,150) are deep-to-shallow
// transitions in the middle of the river, not shorelines. The renderer drew
// them as four hard lines: a 3 px base stroke, the whole-polygon foam outline,
// two lit "shorelines", and the tile boundary. A ford has no foam crest and no
// beach; it has a submerged slope. The band lies INSIDE the shallows rect on
// its two long edges, deep colour at the boundary dissolving into the shallow
// bed, in a container above the opaque water tiles (the W-4 shore strip
// container sits below `surfaces`, so a strip over water is impossible there).

const tileDir = new URL('../apps/portal/assets/generated/hmh-terrain-tiles/', import.meta.url);

class FakeGraphics {
  constructor() { this.children = []; this.strokes = []; this.fills = []; this.paths = []; this.current = null; this.visible = true; }
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
  constructor() { this.children = []; this.visible = true; }
  addChild(child) { this.children.push(child); return child; }
  addChildAt(child, index) { this.children.splice(index, 0, child); return child; }
  getChildIndex(child) { return this.children.indexOf(child); }
}
class FakeTilingSprite {
  constructor({ texture, width, height } = {}) {
    this.texture = texture; this.width = width ?? 1; this.height = height ?? 1; this.alpha = 1; this.rotation = 0; this.visible = true;
    this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
    this.tileScale = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } };
    this.tilePosition = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
  }
}
const TEXTURE = { source: { style: {} } };
const OVERLAY_TEXTURES = new Map();
const overlayTextureFor = (id) => {
  if (!OVERLAY_TEXTURES.has(id)) OVERLAY_TEXTURES.set(id, { id, source: { style: {} } });
  return OVERLAY_TEXTURES.get(id);
};
const fakeTerrainTiles = (overrides = {}) => ({
  ready: true, tileSize: 512, fringeHeight: 128, overlayHeight: 128,
  textureFor: () => TEXTURE, fringeTextureFor: () => TEXTURE, overlayTextureFor,
  createSprite: (materialId, size) => new FakeTilingSprite({ texture: TEXTURE, ...size }),
  ...overrides,
});
const VIEW = { width: 1440, height: 900 };
const PROFILE = { particlesPerHazard: 10, worldCullMargin: 220 };
const layersFor = () => createWorldProductionLayers({ ContainerClass: FakeContainer, GraphicsClass: FakeGraphics, TilingSpriteClass: FakeTilingSprite });
const render = (camera, worldProduction, terrainTiles = fakeTerrainTiles()) => renderWorldProductionArt({
  worldProduction, world: LEVEL_ONE_WORLD, camera, view: VIEW, queryGround: createLevelOneGroundQuery(), worldToScreen, tick: 180, performanceProfile: PROFILE, terrainTiles,
});
const camera = (x, y) => ({ x, y, zoom: 1, shakeX: 0, shakeY: 0 });
const FORD = camera(4_900, 1_050);
const BRIDGE = camera(4_700, 2_400);
const OPEN_GROUND = camera(900, 4_400);
const stripsOf = (container, id) => (container?.children ?? []).filter((sprite) => sprite.visible && sprite.texture?.id === id);
const strokesOf = (graphic, color) => graphic.strokes.filter((style) => style?.color === color).length;

test('W-4 the shallows band is a fifth authored overlay', () => {
  assert.ok(TERRAIN_OVERLAY_IDS.includes('shallows-band'), 'the ford needs its own strip; the shore band carries a foam crest');
});

test('W-4 two band strips lie inside the shallows on its long edges, deep side out, and nowhere else', () => {
  const worldProduction = layersFor();
  render(FORD, worldProduction);
  const container = worldProduction.waterStripSprites;
  assert.ok(container, 'a water-strip container must exist above the surface tiles');
  assert.equal(container.label, 'world-water-strips');
  const bands = stripsOf(container, 'shallows-band');
  assert.equal(bands.length, 2, `the ford has two long edges, saw ${bands.length} band strips`);
  const shallows = LEVEL_ONE_WORLD.surfaces.find((surface) => surface.id === 'crossing-shallows');
  const z = shallows.waterLevel;
  const north = worldToScreen({ x: 4_500, y: 800, z }, FORD, VIEW);
  const south = worldToScreen({ x: 5_000, y: 1_150, z }, FORD, VIEW);
  const top = bands.find((sprite) => sprite.position.y === north.y);
  const bottom = bands.find((sprite) => sprite.position.y === south.y);
  assert.ok(top, `one band must hang from the deep boundary at y=${north.y}`);
  assert.ok(bottom, `one band must rise from the deep boundary at y=${south.y}`);
  // No overlap past the corners (the river banks carry their own strips), and
  // the band's local +y points INTO the rect: the top strip runs unrotated so
  // its opaque row 0 sits on the boundary and fades southward; the bottom strip
  // is turned half a circle so it fades northward.
  for (const sprite of [top, bottom]) {
    assert.equal(sprite.width, 500, 'the band stops exactly at the bank corners');
    assert.equal(sprite.height, 56, 'the submerged slope reads 56 world units into the ford');
    assert.ok(sprite.alpha > 0.8 && sprite.alpha <= 1);
  }
  assert.equal(top.position.x, north.x);
  assert.equal(top.rotation, 0);
  assert.equal(bottom.position.x, south.x);
  assert.ok(Math.abs(bottom.rotation - Math.PI) < 1e-9);
  // Nothing in the deep channel, nothing at the bridge, nothing on open ground.
  assert.equal(stripsOf(container, 'shore-band').length, 0, 'the shore band belongs to the river banks, never to the ford');
  render(BRIDGE, worldProduction);
  assert.equal(stripsOf(container, 'shallows-band').length, 0);
  assert.ok(worldProduction.stripSprites.children.filter((sprite) => sprite.visible).length >= 4, 'the bridge view keeps its shoulders and bank strips');
  render(OPEN_GROUND, worldProduction);
  assert.equal(stripsOf(container, 'shallows-band').length, 0);
});

test('W-4 the water-strip container draws above the ramp masks and below the cues, and stays inert without a texture', () => {
  const worldProduction = layersFor();
  const index = (child) => worldProduction.root.getChildIndex(child);
  assert.ok(index(worldProduction.rampMasks) < index(worldProduction.waterStripSprites), 'a band over water must sit above the opaque water tile');
  assert.ok(index(worldProduction.waterStripSprites) < index(worldProduction.surfaceCues), 'cues stay above every strip');
  render(FORD, worldProduction, fakeTerrainTiles({ overlayTextureFor: () => null }));
  assert.equal(worldProduction.waterStripSprites.children.length, 0, 'no texture, no strip: a load failure changes nothing');
  render(FORD, worldProduction);
  const first = worldProduction.waterStripSprites.children.length;
  render(FORD, worldProduction);
  assert.equal(worldProduction.waterStripSprites.children.length, first, 'band strips are pooled');
});

test('W-4 the ford loses its mid-river foam outline and lit shorelines while the river keeps them', () => {
  const ford = layersFor();
  render(FORD, ford);
  const bridge = layersFor();
  render(BRIDGE, bridge);
  // At the bridge only the river is in view; at the ford the river AND the
  // shallows are. The foam outline (two strokes) and the two lit shoreline
  // lines must therefore count the same at both cameras: the ford adds none.
  for (const color of [0xcdf6ff, 0x7fdcf0, 0x9fe8ff]) {
    assert.ok(strokesOf(bridge.surfaceCues, color) >= 1, `the river must still draw ${color.toString(16)}`);
    assert.equal(strokesOf(ford.surfaceCues, color), strokesOf(bridge.surfaceCues, color), `the shallows must draw no ${color.toString(16)} foam or shoreline mid-river`);
  }
  // The shallows' hairline base outline drops to a hint under the band.
  const hint = ford.layers.surfaces.strokes.filter((style) => style?.color === 0x84e8ff && style.alpha <= 0.2);
  assert.equal(hint.length, 1, 'the shallows base stroke must fade to a hint once the band carries the edge');
  assert.equal(bridge.layers.surfaces.strokes.filter((style) => style?.color === 0x84e8ff && style.alpha <= 0.2).length, 0);
});

test('W-4 the baked shallows-band strip is a foam-free submerged slope', async () => {
  const manifest = JSON.parse(await readFile(new URL('hmh-terrain-tiles.json', tileDir), 'utf8'));
  const band = manifest.overlays.find((entry) => entry.id === 'shallows-band');
  assert.ok(band, 'shallows-band must be baked into the shipped manifest');
  assert.equal(band.addressV, 'clamp-to-edge');
  assert.equal(band.height, manifest.overlayHeight);
  assert.equal(band.width, manifest.tileSize);
  assert.equal(manifest.materials.length, 11, 'adding a band may not add a runtime material');
  const { decodePng } = await import('../scripts/hmh-reboot-visual-regression.mjs');
  const png = decodePng(await readFile(new URL(band.file.slice(2), tileDir)));
  assert.equal(png.channels, 4);
  let topLuma = 0;
  let bright = 0;
  for (let row = 0; row < png.height; row += 1) {
    for (let column = 0; column < png.width; column += 1) {
      const offset = (row * png.width + column) * 4;
      const [r, g, b, a] = [png.pixels[offset], png.pixels[offset + 1], png.pixels[offset + 2], png.pixels[offset + 3]];
      if (row === 0) assert.equal(a, 255, 'row 0 is the deep boundary and must be opaque');
      if (row >= png.height - 8) assert.equal(a, 0, 'the last rows must dissolve completely into the shallow bed');
      if (row < 4) topLuma += 0.299 * r + 0.587 * g + 0.114 * b;
      if (a > 0 && r > 220 && g > 220 && b > 220) bright += 1;
    }
  }
  assert.ok(topLuma / (4 * png.width) < 150, 'the boundary rows are deep water, not a lit crest');
  assert.equal(bright, 0, 'no foam: a ford has no crest mid-river');
});
