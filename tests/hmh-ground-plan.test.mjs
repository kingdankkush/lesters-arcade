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

test('adjacent tiles inside the same authored zone keep the identical texture key', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  let checked = 0;
  for (const [x, y] of sampleTiles(140, 140)) {
    const here = plan.zoneAt(x, y);
    const east = plan.zoneAt(x + 1, y);
    if (here.zoneId === east.zoneId) {
      assert.equal(east.textureKey, here.textureKey, `texture changed inside ${here.zoneId} at ${x},${y}`);
      checked += 1;
    }
  }
  assert.ok(checked > 1000, 'expected many same-zone adjacency checks');
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

test('spawn road uses blended shoulders and keeps the player start clear', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  assert.equal(plan.zoneAt(0, 5).zoneId, 'spawn-clear-blacktop-centerline');
  assert.equal(plan.zoneAt(0, 5).role, 'road');
  assert.equal(plan.zoneAt(0, 3).zoneId, 'spawn-grass-road-north-shoulder');
  assert.equal(plan.zoneAt(0, 8).zoneId, 'spawn-sand-road-south-shoulder');
  assert.match(plan.zoneAt(0, 5).textureKey, /^chatgpt-terrain\/ground-cracked-asphalt-concrete/);
  assert.match(plan.zoneAt(0, 3).textureKey, /^chatgpt-terrain\/ground-asphalt-moss-grass/);
  assert.match(plan.zoneAt(0, 8).textureKey, /^chatgpt-terrain\/ground-sand-gravel-road/);
});

test('ground plan source and tests are covered by the explicit syntax gate', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /apps\/portal\/src\/hmh-ground-plan\.mjs/);
  assert.match(syntax, /tests\/hmh-ground-plan\.test\.mjs/);
});
