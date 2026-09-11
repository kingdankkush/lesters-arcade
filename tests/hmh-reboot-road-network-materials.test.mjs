import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../apps/portal/assets/generated/hmh-terrain-tiles/hmh-terrain-tiles.json', import.meta.url);
const bakeryUrl = new URL('../scripts/build-hmh-terrain-tiles.py', import.meta.url);
const rendererUrl = new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url);

test('roads, earth paths and gravel shoulders use distinct existing terrain assets', async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  assert.equal(manifest.runtimeAuthority, 'projection-only');
  assert.deepEqual(manifest.roadNetwork, { travelledMaterial: 'road', pathMaterial: 'packed-earth', shoulderOverlay: 'road-shoulder' });
  assert.equal(manifest.materials.find(({ id }) => id === 'road').source.kind, 'blender-cycles');
  assert.deepEqual(manifest.overlays.find(({ id }) => id === 'road-shoulder').source, { kind: 'profiled-blender-ground', material: 'packed-earth' });
  assert.equal(manifest.materials.filter(({ id }) => id === 'road').length, 1, 'T4 must not add texture requests');
});

test('road and path source recipes preserve distinct materials without mixed-asphalt path claims', async () => {
  const bakery = await readFile(bakeryUrl, 'utf8');
  assert.match(bakery, /def load_blender_ground\(/);
  assert.doesNotMatch(bakery, /\brandom\.|\btime\.|\bdatetime\b/);

  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  const road = manifest.materials.find(entry => entry.id === 'road');
  const earth = manifest.materials.find(entry => entry.id === 'packed-earth');
  assert.notEqual(road.source.sha256, earth.source.sha256, 'paved roads and dirt paths must preserve distinct source tiles');
  assert.equal(Object.hasOwn(manifest.roadNetwork, 'variants'), false);
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
  assert.match(source, /roadPlacer\.place\('road'/, 'paved roads retain the pooled asphalt tile');
  assert.match(source, /pathPlacer\.place\('packed-earth'/, 'exploration paths need the separate pooled earth tile');
  assert.match(source, /const DASH = 46/);
  assert.match(source, /const GAP = 40/);
  assert.match(source, /if \(route\.kind !== 'main' && route\.kind !== 'street'\) return;/, 'dirt tracks must not gain painted lane marks');
  assert.match(source, /color: 0xc7bb8b, width: Math\.max\(1, 2\.4 \* zoom\), alpha: 0\.14/, 'authored lane marks retain their quieter contrast');
  const cues = source.slice(source.indexOf('// Centre wear band:'), source.indexOf('function drawBlocker'));
  assert.doesNotMatch(cues, /layers\.routes\.(?:moveTo|stroke)/, 'road tile paints over route-layer cues');
  assert.match(source, /cues=layers\.details/, 'road cues need the above-road details layer');
  assert.match(cues, /cues\.moveTo/, 'centre and lane cues must draw above the tiled road');
});
