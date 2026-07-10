import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HMH_CURATED_LEVEL_ART } from '../apps/portal/assets/generated/hmh-curated-level-art/hmh-curated-level-art.mjs';
import { HMH_LEVEL_ONE_ID } from '../apps/portal/src/hmh-level-one-ground.mjs';
import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';

function sampleTiles(width = 200, height = 200) {
  const tiles = [];
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) tiles.push([x, y]);
  }
  return tiles;
}

test('ground plan assigns every sampled tile to exactly one zone with one texture', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  for (const [x, y] of sampleTiles()) {
    const zone = plan.zoneAt(x, y);
    assert.equal(typeof zone.zoneId, 'string', `missing zone id at ${x},${y}`);
    assert.equal(typeof zone.role, 'string', `missing role at ${x},${y}`);
    assert.equal(typeof zone.textureKey, 'string', `missing texture at ${x},${y}`);
    assert.ok(zone.textureKey.length > 0, `blank texture at ${x},${y}`);
    assert.ok(Array.isArray(zone.borderInfo), `borderInfo must be an array at ${x},${y}`);
  }
});

test('large authored terrain zones use deterministic tile variants instead of one repeated stamp', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  const sampledByZone = new Map();
  for (const [x, y] of sampleTiles(120, 40)) {
    const here = plan.zoneAt(x - 20, y - 8);
    if (!sampledByZone.has(here.zoneId)) sampledByZone.set(here.zoneId, new Set());
    sampledByZone.get(here.zoneId).add(here.textureKey);
  }

  assert.ok((sampledByZone.get('spawn-dirt-scrub-outfield')?.size ?? 0) >= 5, 'spawn outfield should vary terrain tile cells');
  assert.ok((sampledByZone.get('spawn-clear-blacktop-centerline')?.size ?? 0) >= 3, 'spawn road should vary cracked asphalt cells');
  assert.ok((sampledByZone.get('ghost-town-cracked-asphalt-core')?.size ?? 0) >= 5, 'ghost town street should use multiple asphalt variants');
});

test('borderInfo is present exactly on cardinal zone boundaries', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  let boundaryTiles = 0;
  let interiorTiles = 0;
  for (const [x, y] of sampleTiles(120, 120)) {
    const here = plan.zoneAt(x, y);
    const neighbors = [
      plan.zoneAt(x + 1, y),
      plan.zoneAt(x - 1, y),
      plan.zoneAt(x, y + 1),
      plan.zoneAt(x, y - 1),
    ];
    const expectedBoundaryCount = neighbors.filter((neighbor) => neighbor.zoneId !== here.zoneId).length;
    assert.equal(here.borderInfo.length, expectedBoundaryCount, `border mismatch at ${x},${y}`);
    if (expectedBoundaryCount > 0) {
      boundaryTiles += 1;
      for (const border of here.borderInfo) {
        assert.match(border.direction, /^(north|south|east|west)$/);
        assert.equal(typeof border.neighborZoneId, 'string');
        assert.equal(typeof border.neighborRole, 'string');
      }
    } else {
      interiorTiles += 1;
    }
  }
  assert.ok(boundaryTiles > 0, 'expected at least one zone boundary in the sample');
  assert.ok(interiorTiles > boundaryTiles, 'the plan should still have broad zone interiors');
});

test('ground plan references Justin-approved ChatGPT terrain tiles for the redesigned level layout', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  const textureKeys = new Set(plan.zones.map((zone) => zone.textureKey));
  assert.ok(textureKeys.size > 0, 'expected plan textures to be present');
  assert.ok([...textureKeys].some((key) => key.startsWith('chatgpt-terrain/')), 'expected ChatGPT terrain textures in the ground plan');
  for (const role of ['grass', 'water', 'shore', 'sand', 'road', 'rocky', 'grass-to-dirt', 'dirt-to-sand']) {
    assert.ok(HMH_CURATED_LEVEL_ART.terrainRoles?.[role]?.length > 0, `${role} terrain role should have sliced tile coverage`);
  }
  for (const textureKey of textureKeys) {
    assert.doesNotMatch(textureKey, /^pixellab-surface\//, `${textureKey} should not use transparent legacy slab candidates for broad ground fill`);
    const asset = plan.textureForKey(textureKey);
    assert.ok(asset, `${textureKey} should resolve through the plan texture lookup`);
    if (textureKey.startsWith('chatgpt-terrain/')) {
      assert.match(asset.src, /^\.\/assets\/generated\/hmh-curated-level-art\/terrain-textures\//);
      assert.doesNotMatch(asset.src, /\.\/apps\/portal\//, 'runtime texture URL must be portal-root relative for Vercel outputDirectory');
      assert.equal(asset.width, 160);
      assert.equal(asset.height, 160);
    }
  }
});

test('compact full-map plan exposes every approved terrain sheet including variable 4x4 and 6x4 grids', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  const keys = plan.textureKeys();
  for (const sheet of [
    'jul9-master-ground-terrain-a',
    'jul9-transition-ground-edges-a',
    'jul9-street-asphalt-parking-a',
    'jul9-water-shore-mud-a',
    'jul9-neighborhood-ground-a',
    'jul9-lakeside-pond-a',
    'jul9-park-path-plaza-a',
    'jul9-road-transition-a',
    'jul9-extraction-plaza-b',
    'jul9-riverbank-slabs-b',
    'jul9-rapid-water-b',
  ]) {
    assert.ok(keys.some((key) => key.includes(`/${sheet}-r`)), `${sheet} should be used by the live compact-map terrain plan`);
  }
  const approvedJul9Keys = HMH_CURATED_LEVEL_ART.groundTextures
    .filter((texture) => texture.sheet.startsWith('jul9-'))
    .map((texture) => texture.key);
  assert.equal(approvedJul9Keys.length, 264);
  assert.ok(approvedJul9Keys.every((key) => keys.includes(key)), 'every accepted Jul 9 map tile texture should participate in the compact world plan');
  assert.ok(plan.textureForKey('chatgpt-terrain/jul9-extraction-plaza-b-r4-c4'));
  assert.ok(plan.textureForKey('chatgpt-terrain/jul9-riverbank-slabs-b-r6-c4'));
  assert.ok(plan.textureForKey('chatgpt-terrain/jul9-rapid-water-b-r6-c4'));

  const nearby = plan.textureKeysNear(0, 5, 18);
  assert.ok(nearby.length > 0);
  assert.ok(nearby.length < keys.length, 'startup prewarm should decode nearby terrain instead of every full-map texture');
  assert.ok(nearby.every((key) => plan.textureForKey(key)), 'every nearby texture key should resolve');
});

test('spawn road uses blended shoulders and keeps the player start clear', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  assert.equal(plan.zoneAt(0, 5).zoneId, 'spawn-clear-blacktop-centerline');
  assert.equal(plan.zoneAt(0, 5).role, 'road');
  assert.equal(plan.zoneAt(0, 3).zoneId, 'spawn-grass-road-north-shoulder');
  assert.equal(plan.zoneAt(0, 8).zoneId, 'spawn-muddy-road-south-shoulder');
  assert.match(plan.zoneAt(0, 5).textureKey, /^chatgpt-terrain\//);
  assert.match(plan.zoneAt(0, 3).textureKey, /^chatgpt-terrain\//);
  assert.match(plan.zoneAt(0, 8).textureKey, /^chatgpt-terrain\//);
});

test('compact biome towns and exploration POIs are connected by authored roads, dirt paths, and bridge crossings', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  const expectedRoutes = [
    [-70, 4, 'road', 'west town to spawn road'],
    [70, 4, 'road', 'spawn to east extraction road'],
    [-106, -40, 'dirt', 'northwest desert path'],
    [-36, -40, 'dirt', 'north forest path'],
    [104, -30, 'road', 'northeast neighborhood road'],
    [-60, 79, 'dirt', 'southwest exploration trail'],
    [60, 79, 'dirt', 'southeast waterfront trail'],
    [29, -71, 'road', 'north river bridge'],
    [29, 79, 'road', 'south river bridge'],
  ];
  for (const [x, y, role, label] of expectedRoutes) {
    assert.equal(plan.zoneAt(x, y).role, role, `${label} should be authored into the rendered ground plan`);
  }
  assert.equal(plan.zoneAt(29, 20).role, 'water', 'deep rapid-water spine must remain visible between crossings');
});

test('ground plan source and tests are covered by the explicit syntax gate', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /apps\/portal\/src\/hmh-ground-plan\.mjs/);
  assert.match(syntax, /tests\/hmh-ground-plan\.test\.mjs/);
});
