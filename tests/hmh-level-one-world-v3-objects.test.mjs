import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_WORLD_V3_OBJECTS,
  buildLevelOneWorldV3VisibleObjects,
  levelOneWorldV3ObjectReport,
} from '../apps/portal/src/hmh-level-one-world-v3-objects.mjs';
import {
  authoredCellToWorld,
  HMH_LEVEL_ONE_WORLD_V3,
  levelOneWorldV3CellAt,
  levelOneWorldV3WorldBounds,
} from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';
import { levelOneCuratedAssetSrc } from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';

test('World v3 builds a bounded deterministic authored object layer with explicit collision truth', () => {
  const objects = HMH_LEVEL_ONE_WORLD_V3_OBJECTS;
  const report = levelOneWorldV3ObjectReport();
  assert.ok(objects.length >= 150 && objects.length <= 260, `expected a dense but bounded object layer, got ${objects.length}`);
  assert.equal(report.total, objects.length);
  assert.ok(report.solid >= 120);
  assert.ok(report.interactiveOrLandmark >= 30);
  assert.equal(new Set(objects.map((object) => object.id)).size, objects.length);

  for (const object of objects) {
    assert.equal(levelOneWorldV3CellAt(object.gridX, object.gridY).inBounds, true, `${object.id} must stay inside the finite world`);
    assert.ok(levelOneCuratedAssetSrc(object.assetKey), `${object.assetKey} must resolve to shipped art`);
    if (!object.solid) continue;
    assert.ok(object.footprintTiles?.w > 0 && object.footprintTiles?.h > 0, `${object.id} needs a footprint`);
    assert.ok(object.collisionPolygons?.length > 0, `${object.id} needs collision polygons`);
    const cell = levelOneWorldV3CellAt(object.gridX, object.gridY);
    assert.equal(cell.blocked, false, `${object.id} should not duplicate blocked terrain collision`);
    assert.equal(cell.route, '.', `${object.id} must not obstruct authored roads or bridges`);
    assert.ok(Math.hypot(object.gridX, object.gridY) >= 5, `${object.id} must keep the spawn combat lane clear`);
  }
});

test('World v3 includes every POI, boss, extraction, bridge-bank, and natural terrain family', () => {
  const report = levelOneWorldV3ObjectReport();
  for (const stampId of [
    'desert-road-salvage-wall',
    'ghost-town-facade-row-pocket',
    'wo104-forest-canopy-cliff-checkpoint',
    'compact-northwest-desert-outcrop',
    'ruined-camp-bone-yard',
    'wo104-lakeside-firefly-bank-checkpoint',
    'shoreline-ford-bank',
    'wo105-second-town-road-checkpoint',
    'compact-southeast-glow-bank',
    'innercity-gate-barricade',
    'industrial-power-yard-extraction-pocket',
    'litecoin-extraction-beacon-pad',
  ]) assert.ok(report.byStamp[stampId] > 0, `missing authored stamp ${stampId}`);
  for (const terrain of ['terrain-F', 'terrain-G', 'terrain-R', 'terrain-S']) {
    assert.ok(report.byTerrain[terrain] > 0, `missing authored natural family ${terrain}`);
  }
  const lighthouse = HMH_LEVEL_ONE_WORLD_V3_OBJECTS.find((object) => object.id === 'world-v3-wrecked-lighthouse-landmark');
  assert.ok(lighthouse, 'wrecked lighthouse must use its own original runtime landmark');
  assert.equal(lighthouse.assetKey, 'world-v3-landmark/wrecked-litecoin-lighthouse');
  assert.equal(lighthouse.solid, true);
  assert.equal(lighthouse.interactive, true);
  assert.ok(levelOneCuratedAssetSrc(lighthouse.assetKey));

  for (const poi of HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest) {
    const center = authoredCellToWorld(poi.x, poi.y);
    const intruders = HMH_LEVEL_ONE_WORLD_V3_OBJECTS.filter((object) => (
      object.solid
      && object.sourceZoneId === poi.id
      && Math.hypot(object.gridX - center.x, object.gridY - center.y) < poi.arenaRadius
    ));
    assert.deepEqual(intruders.map((object) => object.id), [], `${poi.id} solid landmarks must stay on the arena perimeter`);
  }
});

test('solid World v3 object footprints preserve routes to all critical and optional anchors', () => {
  const bounds = levelOneWorldV3WorldBounds();
  const blocked = new Set();
  const key = (x, y) => `${x}|${y}`;
  for (const object of HMH_LEVEL_ONE_WORLD_V3_OBJECTS.filter((entry) => entry.solid)) {
    const halfW = Math.max(0, Math.floor((object.footprintTiles.w - 0.01) / 2));
    const halfH = Math.max(0, Math.floor((object.footprintTiles.h - 0.01) / 2));
    for (let y = Math.round(object.gridY) - halfH; y <= Math.round(object.gridY) + halfH; y += 1) {
      for (let x = Math.round(object.gridX) - halfW; x <= Math.round(object.gridX) + halfW; x += 1) blocked.add(key(x, y));
    }
  }
  const queue = [[0, 0]];
  const visited = new Set([key(0, 0)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor];
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const nextKey = key(nx, ny);
      if (nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY) continue;
      if (visited.has(nextKey) || blocked.has(nextKey) || levelOneWorldV3CellAt(nx, ny).blocked) continue;
      visited.add(nextKey);
      queue.push([nx, ny]);
    }
  }
  for (const anchor of [...HMH_LEVEL_ONE_WORLD_V3.criticalPath, ...HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest]) {
    const world = authoredCellToWorld(anchor.x, anchor.y);
    assert.ok(visited.has(key(world.x, world.y)), `${anchor.id} must remain reachable around object footprints`);
  }
  for (const bridge of HMH_LEVEL_ONE_WORLD_V3.bridges) {
    const world = authoredCellToWorld(bridge.x, bridge.y);
    assert.ok(visited.has(key(world.x, world.y)), `${bridge.id} must remain reachable`);
  }
});

test('World v3 visibility queries are deterministic, local, and runtime-gated', () => {
  const first = buildLevelOneWorldV3VisibleObjects({ playerX: 16, playerY: -13, window: 18 });
  const second = buildLevelOneWorldV3VisibleObjects({ playerX: 16, playerY: -13, window: 18 });
  assert.deepEqual(first, second);
  assert.ok(first.length > 0 && first.length < HMH_LEVEL_ONE_WORLD_V3_OBJECTS.length);
  assert.equal(first.every((object) => Math.abs(object.gridX - 16) <= 26 && Math.abs(object.gridY + 13) <= 26), true);

  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /hmh-level-one-world-v3-objects\.mjs/);
  assert.match(syntax, /hmh-level-one-world-v3-objects\.test\.mjs/);
});
