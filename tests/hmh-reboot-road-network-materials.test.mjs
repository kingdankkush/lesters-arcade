import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../apps/portal/assets/generated/hmh-terrain-tiles/hmh-terrain-tiles.json', import.meta.url);
const bakeryUrl = new URL('../scripts/build-hmh-terrain-tiles.py', import.meta.url);
const rendererUrl = new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url);

const ROAD_VARIANTS = Object.freeze(['gravel-shoulder', 'cracked-asphalt', 'dirt-track']);

test('T4 bakes three named road-network materials into the existing road tile', async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  assert.equal(manifest.runtimeAuthority, 'projection-only');
  assert.equal(manifest.roadNetwork?.bakedInto, 'road');
  assert.equal(manifest.roadNetwork?.mask?.source, 'wrapped-fbm');
  assert.deepEqual(manifest.roadNetwork?.mask?.periods, [4, 8, 16]);
  assert.deepEqual(manifest.roadNetwork?.variants?.map(({ id }) => id), ROAD_VARIANTS);
  assert.equal(manifest.materials.filter(({ id }) => id === 'road').length, 1, 'T4 must not add texture requests');
});

test('T4 road variants are deterministic source recipes with distinct palettes', async () => {
  const bakery = await readFile(bakeryUrl, 'utf8');
  for (const id of ROAD_VARIANTS) assert.match(bakery, new RegExp(`['\"]id['\"]:\\s*['\"]${id}['\"]`));
  assert.doesNotMatch(bakery, /\brandom\.|\btime\.|\bdatetime\b/);

  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  const palettes = manifest.roadNetwork.variants.map(({ base, shadow, highlight }) => `${base}:${shadow}:${highlight}`);
  assert.equal(new Set(palettes).size, ROAD_VARIANTS.length, 'road variants need visibly distinct palettes');
});

test('T4 renderer keeps pooled shoulders, travelled surface, and centre-line decals', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  // Cycle 072 W-3: the shoulder and verge used to be two 0x130f13 strokes at
  // route.width + 40 / + 22, which read as a hard black border around a flat
  // ribbon. They are now authored strip textures placed along both sides of
  // every segment, so a road meets the ground instead of being outlined.
  assert.doesNotMatch(source, /0x130f13/, 'roads must not be outlined in black');
  assert.doesNotMatch(source, /route\.width \+ 40/);
  assert.doesNotMatch(source, /route\.width \+ 22/);
  assert.match(source, /'road-shoulder'/, 'road needs an authored gravel shoulder strip');
  assert.match(source, /SHOULDER_WORLD_DEPTH/, 'the shoulder must have an authored world depth');
  assert.match(source, /roadPlacer\.place\('road'/, 'variants must remain in the one pooled road tile');
  assert.match(source, /const DASH = 46/);
  assert.match(source, /const GAP = 40/);
  assert.match(source, /route\.kind === 'main' \? 0\.32 : 0\.18/, 'main and dirt-track route marks must remain distinct');
  const cues = source.slice(source.indexOf('// Centre wear band:'), source.indexOf('function drawBlocker'));
  assert.doesNotMatch(cues, /layers\.routes\.(?:moveTo|stroke)/, 'road tile paints over route-layer cues');
  assert.match(source, /cues=layers\.details/, 'road cues need the above-road details layer');
  assert.match(cues, /cues\.moveTo/, 'centre and lane cues must draw above the tiled road');
});
