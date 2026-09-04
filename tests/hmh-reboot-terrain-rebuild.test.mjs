import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  TERRAIN_TILE_PIPELINE_ID,
  TERRAIN_OVERLAY_IDS,
  createTerrainTileRegistry,
  terrainOverlayAsset,
  validateTerrainManifest,
} from '../apps/hmh-reboot/src/terrain-tile-atlas.mjs';
import { TERRAIN_TILE_REPEAT_WORLD } from '../apps/hmh-reboot/src/world-production-art.mjs';

const tileDir = new URL('../apps/portal/assets/generated/hmh-terrain-tiles/', import.meta.url);
const manifestUrl = new URL('hmh-terrain-tiles.json', tileDir);
const bakeryUrl = new URL('../scripts/build-hmh-terrain-tiles.py', import.meta.url);
const atlasUrl = new URL('../apps/hmh-reboot/src/terrain-tile-atlas.mjs', import.meta.url);
const rendererUrl = new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url);

const readManifest = async () => JSON.parse(await readFile(manifestUrl, 'utf8'));

test('W-1 ships a lit micro-terrain bake under a bumped pipeline id', async () => {
  const manifest = await readManifest();
  assert.equal(TERRAIN_TILE_PIPELINE_ID, 'hmh-terrain-tiles-v3');
  assert.equal(manifest.pipelineId, TERRAIN_TILE_PIPELINE_ID, 'bakery and runtime must bump in lockstep');
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.litMicroTerrain, true, 'height-field scatter, AO and cast shadow must be baked in');
  assert.equal(manifest.reproducibleVerified, true, 'the shipped bake must be byte-reproducible');
  // Existing contracts the runtime and the T1/T4 tests depend on.
  assert.equal(manifest.runtimeAuthority, 'projection-only');
  assert.equal(manifest.paintedLayering, true);
  assert.equal(manifest.intraDistrictPatches, true);
  assert.equal(manifest.seamlessVerified, true);
});

test('W-1 records a verifiable digest for every baked file', async () => {
  const manifest = await readManifest();
  const entries = [...manifest.materials, ...manifest.fringes, ...manifest.overlays];
  assert.ok(entries.length >= 23, 'materials, fringes and overlays must all carry digests');
  for (const entry of entries) {
    assert.match(entry.file, /^\.\/[a-z-]+\.png$/, `${entry.id} filename must stay lowercase and digit-free`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${entry.id} needs a sha256`);
    const bytes = await readFile(new URL(entry.file.slice(2), tileDir));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${entry.id} digest must match the shipped PNG`);
    assert.equal(bytes.byteLength, entry.bytes);
  }
});

test('W-3/W-4 bake authored edge strips as overlays, not base materials', async () => {
  const manifest = await readManifest();
  assert.deepEqual(TERRAIN_OVERLAY_IDS, ['road-shoulder', 'shore-band', 'scree-skirt', 'rock-face']);
  for (const id of TERRAIN_OVERLAY_IDS) {
    const strip = manifest.overlays.find((entry) => entry.id === id);
    assert.ok(strip, `${id} must be baked`);
    assert.equal(strip.width, manifest.tileSize);
    assert.ok(strip.height >= 64 && strip.height < manifest.tileSize, `${id} is a strip, not a tile`);
    assert.equal(strip.addressV, 'clamp-to-edge');
    // Overlays must never enter `materials`: that array is size-checked against
    // tileSize and drives one texture request per runtime material.
    assert.equal(manifest.materials.filter((entry) => entry.id === id).length, 0);
    assert.equal(terrainOverlayAsset(id).imageUrl.endsWith(`/${id}.png`), true);
  }
  assert.throws(() => terrainOverlayAsset('nope'), /unknown terrain overlay/);
});

test('W-1 registry exposes overlays with strip addressing and stays inert until loaded', () => {
  const registry = createTerrainTileRegistry({ TilingSpriteClass: class {} });
  assert.equal(registry.overlayTextureFor('road-shoulder'), null);
  const style = {};
  const texture = { source: { style, update() { this.updated = true; } } };
  registry.registerOverlay('road-shoulder', texture);
  assert.equal(style.addressModeU, 'repeat');
  assert.equal(style.addressModeV, 'clamp-to-edge');
  assert.equal(registry.overlayTextureFor('road-shoulder'), texture);
  assert.throws(() => registry.registerOverlay('nope', texture), /unknown terrain overlay/);
});

test('W-1 manifest validation carries the overlay contract to the runtime', async () => {
  const manifest = await readManifest();
  const validated = validateTerrainManifest(manifest);
  assert.deepEqual(validated.overlayIds, ['road-shoulder', 'rock-face', 'scree-skirt', 'shore-band']);
  assert.equal(validated.overlayHeight, manifest.overlayHeight);
  assert.ok(validated.overlayHeight >= 64);
  assert.throws(() => validateTerrainManifest({ ...manifest, overlays: [] }), /missing road-shoulder/);
});

test('W-11 bakes an opaque rock-face strip for ledge and cliff faces', async () => {
  // A ledge front or cliff face is a vertical wall: the strip is stretched
  // across exactly the elevation delta by the placer, so it must be opaque on
  // every row (a fading skirt would show ground through the wall), lit along
  // its cap, and darkest where it meets the ground.
  const bakery = await readFile(bakeryUrl, 'utf8');
  assert.match(bakery, /"rock-face"/, 'the face strip is an authored overlay, not a runtime material');
  assert.match(bakery, /kind == "face"/, 'faces need their own profile beside shoulder/shore/scree');
  const manifest = await readManifest();
  const face = manifest.overlays.find((entry) => entry.id === 'rock-face');
  assert.ok(face, 'rock-face must be baked into the shipped manifest');
  assert.equal(face.addressV, 'clamp-to-edge');
  assert.equal(face.height, manifest.overlayHeight);
  assert.equal(face.width, manifest.tileSize);
  assert.equal(manifest.materials.length, 11, 'adding a face may not add a runtime material');
  const { decodePng } = await import('../scripts/hmh-reboot-visual-regression.mjs');
  const png = decodePng(await readFile(new URL(face.file.slice(2), tileDir)));
  assert.equal(png.channels, 4);
  let minAlpha = 255;
  let topLuma = 0;
  let bottomLuma = 0;
  for (let row = 0; row < png.height; row += 1) {
    for (let column = 0; column < png.width; column += 1) {
      const offset = (row * png.width + column) * 4;
      minAlpha = Math.min(minAlpha, png.pixels[offset + 3]);
      const luma = 0.299 * png.pixels[offset] + 0.587 * png.pixels[offset + 1] + 0.114 * png.pixels[offset + 2];
      if (row < 8) topLuma += luma;
      if (row >= png.height - 8) bottomLuma += luma;
    }
  }
  assert.equal(minAlpha, 255, 'a wall strip must be opaque everywhere');
  assert.ok(topLuma > bottomLuma * 1.25, 'the cap must read lit and the foot shaded');
});

test('W-1 raises the tile repeat out of the aliasing band and mipmaps the samplers', async () => {
  // 512 texels across 66.56 world units point-sampled every 7.7th texel, which
  // is what collapsed the bake into salt-and-pepper grain with a 67px grid.
  assert.equal(TERRAIN_TILE_REPEAT_WORLD, 399.36);
  const atlas = await readFile(atlasUrl, 'utf8');
  assert.equal(atlas.match(/autoGenerateMipmaps = true/g)?.length, 3, 'tiles, fringes and overlays all need prefiltered levels');
});

test('W-4 lands shore and scree bands under the surfaces that shed them', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  assert.match(source, /'shore-band'/, 'waterlines need an authored wet-sand and foam band');
  assert.match(source, /'scree-skirt'/, 'ledges and cliffs need an authored debris skirt');
  assert.match(source, /SHORE_WORLD_DEPTH/);
  assert.match(source, /SCREE_WORLD_DEPTH/);
  // The strip container sits below `surfaces`, so a shore band is covered by
  // the water it borders and only shows on the land side.
  assert.match(source, /root\.addChildAt\(stripSprites, root\.getChildIndex\(fringeSprites\) \+ 1\)/);
  const bands = source.slice(source.indexOf('const stripSprites'), source.indexOf('const surfaceSprites'));
  assert.doesNotMatch(bands, /addChildAt\(stripSprites, root\.getChildIndex\(layers\.surfaces\)/);
});

test('W-1 bakery is vectorised, lit and deterministic', async () => {
  const bakery = await readFile(bakeryUrl, 'utf8');
  assert.match(bakery, /^import numpy as np$/m, 'the scalar per-pixel loops must be vectorised');
  assert.match(bakery, /def scatter_height\(/, 'pebbles and tufts must land in the height field');
  assert.match(bakery, /def ambient_occlusion\(/, 'multi-scale wrapped AO must shade the micro-terrain');
  assert.match(bakery, /def cast_shadow\(/, 'a directional pseudo-shadow must ground the scatter');
  assert.match(bakery, /--verify-reproducible/, 'the bake needs its own reproducibility gate');
  // No RNG, no clock, anywhere — including numpy's generator.
  assert.doesNotMatch(bakery, /\brandom\.|\btime\.|\bdatetime\b/);
  assert.doesNotMatch(bakery, /np\.random/);
});

test('W-3 roads read as a surface that meets the ground, not an outlined ribbon', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  assert.doesNotMatch(source, /0x130f13/, 'the hard black road outline is the owner complaint');
  assert.match(source, /placeStrip\(/, 'shoulders need the pooled strip placer');
  assert.match(source, /'road-shoulder'/, 'both sides of every route segment need an authored shoulder');
  assert.match(source, /stripSprites\.label = 'world-edge-strips'/);
  // The flat slab survives only as the no-tile fallback, mirroring the ground.
  assert.match(source, /if \(!roadTiled\)/);
  assert.match(source, /roadPlacer\.place\('road'/, 'the travelled surface stays one pooled tile');
});
