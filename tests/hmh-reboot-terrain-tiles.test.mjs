import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  DISTRICT_TERRAIN_MATERIAL,
  SURFACE_TERRAIN_MATERIAL,
  TERRAIN_MATERIAL_IDS,
  TERRAIN_TILE_PIPELINE_ID,
  createTerrainTileRegistry,
  terrainTileAsset,
  validateTerrainManifest,
} from '../apps/hmh-reboot/src/terrain-tile-atlas.mjs';
import { DISTRICT_PRODUCTION_MATERIALS } from '../apps/hmh-reboot/src/world-production-art.mjs';

const manifestUrl = new URL('../apps/portal/assets/generated/hmh-terrain-tiles/hmh-terrain-tiles.json', import.meta.url);
const loadManifest = async () => JSON.parse(await readFile(manifestUrl, 'utf8'));

test('every district and every readable surface has an authored material', () => {
  for (const districtId of Object.keys(DISTRICT_PRODUCTION_MATERIALS)) {
    const material = DISTRICT_TERRAIN_MATERIAL[districtId];
    assert.ok(material, `${districtId} has no terrain material`);
    assert.ok(TERRAIN_MATERIAL_IDS.includes(material));
  }
  // These are the surfaces the playtest called out as unreadable.
  for (const kind of ['water', 'shallow-water', 'bridge', 'ledge']) {
    assert.ok(SURFACE_TERRAIN_MATERIAL[kind], `${kind} must have a distinct material`);
  }
});

test('the baked manifest is present, projection-only, and complete', async () => {
  assert.ok(existsSync(manifestUrl), 'terrain manifest missing — run npm run assets:hmh:terrain');
  const manifest = await loadManifest();
  assert.equal(manifest.pipelineId, TERRAIN_TILE_PIPELINE_ID);
  assert.equal(manifest.runtimeAuthority, 'projection-only');
  const validated = validateTerrainManifest(manifest);
  assert.equal(validated.materialIds.length, TERRAIN_MATERIAL_IDS.length);
  assert.ok(validated.seamlessVerified, 'tiles must be baked with --verify-seamless');
  for (const material of manifest.materials) {
    assert.ok(material.bytes > 0);
    assert.equal(material.size, manifest.tileSize);
  }
});

test('tiles are baked at 512px with painted layering and proportional fringes', async () => {
  // MAP-REDO slice 2: raise the bake to 512px with painted-style layering.
  // The world-unit repeat is fixed by the renderer, so a larger bake means
  // more texel density at gameplay zoom, not larger features.
  const manifest = await loadManifest();
  assert.ok(manifest.tileSize >= 512, `tileSize ${manifest.tileSize} is below the 512px fidelity bar`);
  assert.equal(manifest.paintedLayering, true, 'bakery must record the painted-layering pass');
  assert.ok(manifest.fringeHeight >= 128, `fringeHeight ${manifest.fringeHeight} must scale with the bake`);
});

test('each district tile bakes three named sub-materials through a deterministic wrapped patch mask', async () => {
  const manifest = await loadManifest();
  assert.equal(manifest.intraDistrictPatches, true, 'T1 patch baking must be explicit in the manifest');

  const districtMaterialIds = new Set(Object.values(DISTRICT_TERRAIN_MATERIAL));
  const patches = new Map((manifest.districtPatches ?? []).map((entry) => [entry.id, entry]));
  assert.equal(patches.size, districtMaterialIds.size, 'every district material needs one patch recipe');

  for (const materialId of districtMaterialIds) {
    const patch = patches.get(materialId);
    assert.ok(patch, `${materialId} has no intra-district patch recipe`);
    assert.equal(patch.bakedInto, materialId, `${materialId} patches must stay in the existing runtime tile`);
    assert.equal(patch.mask?.source, 'wrapped-fbm', `${materialId} mask must be deterministic and seamless`);
    assert.deepEqual(patch.mask?.periods, [2, 4, 8], `${materialId} mask periods must wrap the tile`);
    assert.ok(Number.isInteger(patch.mask?.seed), `${materialId} mask seed must be an integer`);
    assert.equal(patch.variants?.length, 3, `${materialId} must carry three sub-materials`);
    assert.equal(new Set(patch.variants.map((variant) => variant.id)).size, 3, `${materialId} variant ids must be unique`);
    for (const variant of patch.variants) {
      assert.match(variant.id, /^[a-z0-9-]+$/, `${materialId} has a non-semantic variant id`);
      for (const key of ['base', 'shadow', 'highlight']) {
        assert.match(variant[key] ?? '', /^#[0-9a-f]{6}$/i, `${materialId}/${variant.id} must record ${key}`);
      }
    }
    assert.ok(manifest.seamStatistics?.[materialId], `${materialId} needs measured wrap statistics`);
  }
});

test('every material file referenced by the manifest exists on disk', async () => {
  const manifest = await loadManifest();
  for (const material of manifest.materials) {
    const file = new URL(`../apps/portal/assets/generated/hmh-terrain-tiles/${material.id}.png`, import.meta.url);
    assert.ok(existsSync(file), `${material.id}.png missing`);
  }
});

test('manifest validation fails closed on a foreign or incomplete manifest', async () => {
  const manifest = await loadManifest();
  assert.throws(() => validateTerrainManifest({ ...manifest, pipelineId: 'other' }), /pipeline/);
  assert.throws(() => validateTerrainManifest({ ...manifest, runtimeAuthority: 'gameplay' }), /projection-only/);
  const missing = { ...manifest, materials: manifest.materials.filter((entry) => entry.id !== 'water') };
  assert.throws(() => validateTerrainManifest(missing), /missing water/);
});

test('the registry stays inert until a texture arrives, so terrain never blocks', () => {
  const registry = createTerrainTileRegistry({ TilingSpriteClass: function Fake() {} });
  assert.equal(registry.ready, false);
  assert.equal(registry.textureFor('water'), null);
  assert.equal(registry.createSprite('water', { width: 10, height: 10 }), null);
  assert.deepEqual(registry.loadedIds, []);
});

test('the registry enables repeat addressing, which is what makes a tile tile', () => {
  const style = { addressMode: 'clamp-to-edge', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', update() { this.updated = true; } };
  const texture = { source: { style, addressMode: 'clamp-to-edge', update() { this.updated = true; } } };
  class FakeTilingSprite {
    constructor(options) { Object.assign(this, options); }
  }
  const registry = createTerrainTileRegistry({ TilingSpriteClass: FakeTilingSprite });
  registry.register('water', texture);
  assert.equal(style.addressMode, 'repeat');
  assert.equal(style.addressModeU, 'repeat');
  assert.equal(style.addressModeV, 'repeat');
  assert.equal(texture.source.addressMode, 'repeat');
  assert.ok(registry.ready);
  const sprite = registry.createSprite('water', { width: 200, height: 100 });
  assert.ok(sprite instanceof FakeTilingSprite);
  assert.equal(sprite.width, 200);
});

test('registry rejects unknown materials and textures without a source', () => {
  const registry = createTerrainTileRegistry({ TilingSpriteClass: function Fake() {} });
  assert.throws(() => registry.register('not-a-material', { source: {} }), /unknown terrain material/);
  assert.throws(() => registry.register('water', {}), /texture source is required/);
  assert.throws(() => terrainTileAsset('not-a-material'), /unknown terrain material/);
});

test('terrain rendering keeps a flat-colour fallback and carries no gameplay authority', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url), 'utf8');
  // The flat fill must remain: a missing tile may never blank the world.
  assert.match(source, /layers\.terrain\.rect\([\s\S]{0,80}\.fill\(\{ color: kit\.groundColor/, 'flat ground fill must remain as fallback');
  assert.match(source, /if \(!groundTiled\)/, 'the procedural motif is the no-tile fallback');
  // Tiling must use TilingSprite: batched Graphics fills cannot repeat and
  // clamp into streaks instead.
  assert.match(source, /createTerrainSpritePlacer/);
  const atlas = await readFile(new URL('../apps/hmh-reboot/src/terrain-tile-atlas.mjs', import.meta.url), 'utf8');
  const code = atlas.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /collision|damage|health|walkable|elevation|spawn|seed|wallet|settlement/i);
});

test('readability cues draw ABOVE the opaque surface material, not under it', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url), 'utf8');
  // Surface tiles are opaque and sit above `layers.surfaces`. An earlier
  // version drew the foam, lit edge and water detail into `layers.surfaces`,
  // so the tile painted over exactly the cues this cycle exists to add — and
  // the test asserted the comment rather than the behaviour. Assert the layer
  // ordering and the draw target instead.
  assert.match(source, /const surfaceCues = new GraphicsClass\(\)/, 'cues need their own layer');
  assert.match(
    source,
    /root\.addChildAt\(surfaceCues, root\.getChildIndex\(surfaceSprites\) \+ 1\)/,
    'the cue layer must sit above the surface tile container',
  );
  // No readability cue may target layers.surfaces, which the tile covers.
  const cueDraws = [
    'Shoreline foam',
    'Lit top edge and shaded front lip',
  ];
  for (const marker of cueDraws) assert.ok(source.includes(marker), `${marker} cue missing`);
  const afterFoam = source.slice(source.indexOf('Shoreline foam'), source.indexOf('Shoreline foam') + 400);
  assert.ok(!/layers\.surfaces/.test(afterFoam), 'foam must not draw into the covered layer');
  // Water depth, shimmer and shoreline strokes likewise.
  const waterBlock = source.slice(source.indexOf('depth gradient'), source.indexOf('depth gradient') + 1800);
  assert.ok(!/layers\.surfaces\.(rect|moveTo)/.test(waterBlock), 'water detail must draw above the material');
  assert.ok(waterBlock.includes('cueLayer'), 'water detail must target the cue layer');
});

test('the road mask never renders as a visible stroke when no tile is present', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url), 'utf8');
  // The mask is a white stroke until Pixi excludes it on assignment. If a tile
  // is missing it is never assigned, so leaving it visible painted every road
  // solid white — on cold boot, on load failure, and under ?flatTerrain=1.
  assert.match(source, /if \(roadMaskGraphic\) roadMaskGraphic\.visible = false;/, 'mask must default to hidden');
  const clearIndex = source.indexOf('roadMaskGraphic.visible = false');
  const showIndex = source.indexOf('roadMaskGraphic.visible = true');
  assert.ok(clearIndex > 0 && showIndex > clearIndex, 'the mask may only be shown after it is assigned');
  const showBlock = source.slice(showIndex - 400, showIndex);
  assert.ok(showBlock.includes('roadSprite.mask = roadMaskGraphic'), 'visible=true must follow the mask assignment');
});

test('sprite pooling reuses sprites, excludes the mask, and hides stale ones', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url), 'utf8');
  // The road container holds its mask at child 0. Indexing raw children hid
  // the sprite that had just been placed.
  assert.match(source, /const poolable = \(\) => container\.children\.filter\(\(child\) => child\.label !== 'world-road-mask'\)/);
  assert.match(source, /let sprite = poolable\(\)\[cursor\]/, 'placement must index the filtered pool');
  const finishBlock = source.slice(source.indexOf('    finish() {'), source.indexOf('    finish() {') + 260);
  assert.ok(finishBlock.includes('poolable()'), 'finish must hide over the same filtered view');
  assert.ok(!/container\.children\[index\]\.visible = false/.test(finishBlock), 'raw index hiding is the bug that was fixed');
});

test('terrain load status is observable so a silent failure cannot hide', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /dataset\.terrainTiles = terrainTiles\.ready \? 'authored-tiles-v1' : 'flat-colour-fallback'/);
  assert.match(source, /dataset\.terrainTilesError = terrainTileLoadError/);
});
