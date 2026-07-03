import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const syntaxSource = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');

function functionBody(name) {
  const start = mainSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = mainSource.indexOf('\nfunction ', start + 1);
  return mainSource.slice(start, next === -1 ? mainSource.length : next);
}

test('roguelike renderer imports and caches the Level 1 ground plan plus terrain blob-map metadata', () => {
  assert.match(mainSource, /import \{ buildGroundPlan \} from '\.\/src\/hmh-ground-plan\.mjs';/);
  assert.match(mainSource, /import \{ buildTerrainBlobCell \} from '\.\/src\/hmh-terrain-blob-map\.mjs';/);
  assert.match(mainSource, /combat\.groundPlan/);
  assert.match(mainSource, /buildGroundPlan\(\{\s*levelId: combat\.currentCampaignLevelId/);
});

test('roguelike ground pass batches diamonds by texture key and fills world-anchored patterns', () => {
  assert.match(mainSource, /function drawGroundPlanPatternTiles\(/);
  const body = functionBody('drawGroundPlanPatternTiles');
  assert.match(body, /buildTerrainBlobCell\(plan, tile\.worldX, tile\.worldY\)/);
  assert.match(body, /terrainCell\.blob\.variantIndex/);
  assert.match(body, /terrainCell\.renderLayers\.includes\('bridge-deck'\)/);
  assert.match(body, /terrainCell\.renderLayers\.includes\('water-ripple'\)/);
  assert.match(body, /terrainCell\.vfx\.includes\('bridge-shadow'\)/);
  assert.match(body, /new Path2D\(/);
  assert.match(body, /createPattern\([^,]+, 'repeat'\)/);
  assert.match(body, /pattern\.setTransform\(new DOMMatrix\(\)\.translate\(/);
  assert.match(body, /isoToScreen\(0, 0\)/);
  assert.match(body, /textureGroups\.get\(groupKey\)/);
  assert.match(body, /ctx\.fill\(group\.path\)/);
});

test('drawProductionIsoTile no longer performs per-tile texture lookup or edge breakup for the roguelike path', () => {
  const body = functionBody('drawProductionIsoTile');
  assert.doesNotMatch(body, /sbsGroundTileForWorld\(/);
  assert.doesNotMatch(body, /wave2TileImage\(/);
  assert.doesNotMatch(body, /biomeGroundTileForWorld\(/);
  assert.doesNotMatch(body, /drawLevelOneGroundEdgeBreakup\(/);
  assert.match(body, /drawShadedIsoTile\(/);
});

test('ground rendering source test is covered by the explicit syntax gate', () => {
  assert.match(syntaxSource, /tests\/hmh-ground-rendering\.test\.mjs/);
});
