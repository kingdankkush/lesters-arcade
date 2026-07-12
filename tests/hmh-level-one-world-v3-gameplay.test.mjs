import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS,
  levelOneWorldV3BossPoint,
  levelOneWorldV3DistrictContextAt,
  levelOneWorldV3ExtractionPoint,
  levelOneWorldV3PoiDirectiveAt,
} from '../apps/portal/src/hmh-level-one-world-v3-gameplay.mjs';
import { authoredCellToWorld } from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';

test('World v3 maps all six campaign POIs onto approved authored anchors', () => {
  assert.equal(HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS.length, 6);
  for (const entry of HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS) {
    assert.deepEqual(entry.world, authoredCellToWorld(entry.blueprint.x, entry.blueprint.y));
    const directive = levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x, playerY: entry.world.y });
    assert.equal(directive.id, entry.campaign.id);
    assert.equal(directive.blueprintPoiId, entry.blueprint.id);
    assert.equal(directive.phaseHint, 'poi-arena');
    assert.equal(directive.worldX, entry.world.x);
    assert.equal(directive.worldY, entry.world.y);
    assert.equal(directive.source, 'hmh-level-one-world-v3');
  }
});

test('World v3 POI directives transition from telegraph to approach to arena and honor completion', () => {
  const entry = HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS.find((poi) => poi.campaign.id === 'rugpull-gulch');
  const telegraph = levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x - 20, playerY: entry.world.y });
  const approach = levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x - 12, playerY: entry.world.y });
  const arena = levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x - 2, playerY: entry.world.y });
  assert.equal(telegraph.phaseHint, 'poi-telegraph');
  assert.equal(approach.phaseHint, 'poi-approach');
  assert.equal(arena.phaseHint, 'poi-arena');
  assert.notEqual(levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x, playerY: entry.world.y, completedPoiIds: ['rugpull-gulch'] })?.id, 'rugpull-gulch');
});

test('World v3 district context follows authored biome, route, and POI cells', () => {
  assert.equal(levelOneWorldV3DistrictContextAt(0, 0).districtFamily, 'desert-approach');
  const ghost = authoredCellToWorld(24, 65);
  const context = levelOneWorldV3DistrictContextAt(ghost.x, ghost.y);
  assert.equal(context.districtFamily, 'ghost-town');
  assert.equal(context.poiId, 'rugpull-gulch');
  assert.equal(context.source, 'hmh-level-one-world-v3');
});

test('World v3 final boss and extraction use the approved boss yard and road-out anchors', () => {
  assert.deepEqual(levelOneWorldV3BossPoint(), authoredCellToWorld(87, 35));
  const extraction = levelOneWorldV3ExtractionPoint();
  assert.deepEqual({ x: extraction.worldX, y: extraction.worldY }, authoredCellToWorld(93, 39));
  assert.equal(extraction.source, 'hmh-level-one-world-v3');
  assert.ok(extraction.radiusTiles > 1);
});

test('World v3 gameplay geography is explicitly integrated and syntax-gated', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /levelOneWorldV3PoiDirectiveAt/);
  assert.match(main, /levelOneWorldV3DistrictContextAt/);
  assert.match(main, /levelOneWorldV3BossPoint/);
  assert.match(main, /levelOneWorldV3ExtractionPoint/);
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /hmh-level-one-world-v3-gameplay\.mjs/);
  assert.match(syntax, /hmh-level-one-world-v3-gameplay\.test\.mjs/);
});
