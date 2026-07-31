import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  TERRAIN_MATERIAL_IDS,
  createTerrainTileRegistry,
  terrainFringeAsset,
} from '../apps/hmh-reboot/src/terrain-tile-atlas.mjs';

/**
 * Cycle 038, Priority H2: ground materials met as hard flat rectangles at
 * district boundaries. Each material now bakes a horizontally-tileable fringe
 * strip with a ragged dithered alpha falloff, and the renderer bleeds the west
 * district's fringe across each shared edge.
 */

const manifestUrl = new URL('../apps/portal/assets/generated/hmh-terrain-tiles/hmh-terrain-tiles.json', import.meta.url);

test('every material bakes a fringe strip and the manifest records it', async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  assert.ok(Number.isInteger(manifest.fringeHeight) && manifest.fringeHeight > 0, 'manifest must record the fringe height');
  const fringeIds = new Set((manifest.fringes ?? []).map((entry) => entry.id));
  for (const materialId of TERRAIN_MATERIAL_IDS) {
    assert.ok(fringeIds.has(materialId), `${materialId} has no baked fringe`);
    const file = new URL(`../apps/portal/assets/generated/hmh-terrain-tiles/${materialId}-fringe.png`, import.meta.url);
    assert.ok(existsSync(file), `${materialId}-fringe.png missing — run npm run assets:hmh:terrain`);
  }
});

test('fringe assets resolve per material and reject unknown ids', () => {
  const asset = terrainFringeAsset('packed-earth');
  assert.match(asset.imageUrl, /packed-earth-fringe\.png$/);
  assert.throws(() => terrainFringeAsset('not-a-material'), /unknown terrain material/);
});

test('the registry clamps fringe V so the falloff stretches instead of repeating', () => {
  const style = { addressMode: 'x', addressModeU: 'x', addressModeV: 'x', update() { this.updated = true; } };
  const texture = { source: { style, update() {} } };
  const registry = createTerrainTileRegistry({ TilingSpriteClass: function Fake() {} });
  registry.registerFringe('water', texture);
  assert.equal(style.addressModeU, 'repeat', 'fringe must repeat along the boundary');
  assert.equal(style.addressModeV, 'clamp-to-edge', 'fringe must not repeat across its depth');
  assert.equal(registry.fringeTextureFor('water'), texture);
  assert.equal(registry.fringeTextureFor('road'), null, 'unloaded fringes must read null');
  assert.throws(() => registry.registerFringe('nope', texture), /unknown terrain material/);
});

test('the renderer bleeds fringes above the base tiles and stays projection-only', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url), 'utf8');
  // The fringe container must sit directly above the tile container, below
  // every detail and route layer.
  assert.match(source, /fringeSprites\.label = 'world-terrain-fringe'/);
  assert.match(source, /root\.addChildAt\(fringeSprites, root\.getChildIndex\(terrainSprites\) \+ 1\)/);
  // Nothing draws without a loaded fringe texture: flat-colour fallback, load
  // failure and ?flatTerrain=1 keep exactly the previous appearance.
  assert.match(source, /terrainTiles\?\.ready/);
  assert.match(source, /fringeTextureFor/);
  // Stale pool entries are hidden rather than left painted.
  assert.match(source, /for \(let index = fringeCursor; index < fringeContainer\.children\.length; index \+= 1\)/);
});

test('the fringe bakery stays deterministic: no RNG, no timestamps', async () => {
  const script = await readFile(new URL('../scripts/build-hmh-terrain-tiles.py', import.meta.url), 'utf8');
  const fringeBlock = script.slice(script.indexOf('def bake_fringe'), script.indexOf('def main'));
  assert.ok(fringeBlock.length > 0, 'bake_fringe must exist');
  assert.doesNotMatch(fringeBlock, /random\.|time\.|datetime/, 'fringe bake must be deterministic');
  assert.match(fringeBlock, /wrapped_value_noise/, 'the edge profile must reuse the deterministic tile noise');
});
