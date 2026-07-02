import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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

test('ground plan source and tests are covered by the explicit syntax gate', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /apps\/portal\/src\/hmh-ground-plan\.mjs/);
  assert.match(syntax, /tests\/hmh-ground-plan\.test\.mjs/);
});
