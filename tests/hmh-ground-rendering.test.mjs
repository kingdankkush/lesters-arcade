import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  GROUND_PLANE_Y_OFFSET,
  groundPatternAnchorForOrigin,
  groundTileLatticePointForProjection,
} from '../apps/portal/src/hmh-ground-plane-rendering.mjs';

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
  assert.doesNotMatch(mainSource, /from '\.\/src\/hmh-terrain-blob-map\.mjs';/);
  assert.match(mainSource, /hmh-ground-plane-rendering\.mjs/);
  assert.match(mainSource, /combat\.groundPlan/);
  assert.match(mainSource, /buildGroundPlan\(\{\s*levelId: combat\.currentCampaignLevelId/);
});

test('WO-60 ground pattern anchor matches rounded tile lattice origin for fractional cameras', () => {
  assert.equal(GROUND_PLANE_Y_OFFSET, 64);
  const positions = [
    [0, 0], [0.1, 0.2], [0.25, 0.75], [0.5, 0.5], [0.9, 0.1],
    [1.125, -0.375], [-2.333, 4.667], [7.49, 8.51], [12.01, -13.99],
    [19.75, 3.125], [-25.625, -9.875], [31.333, 44.667], [-48.2, 12.8],
    [63.99, -64.01], [80.125, 20.875], [-91.5, 37.25], [105.25, 79.75],
    [-128.875, -96.125], [144.49, -32.51], [0.499, -0.501],
  ];

  for (const [playerX, playerY] of positions) {
    const origin = {
      x: 640 + ((0 - playerX) - (0 - playerY)) * 64,
      y: 360 + ((0 - playerX) + (0 - playerY)) * 32,
    };
    const anchor = groundPatternAnchorForOrigin(origin);
    const latticeOrigin = groundTileLatticePointForProjection(origin);
    assert.deepEqual(anchor, latticeOrigin, `anchor should equal tile lattice at player ${playerX},${playerY}`);
  }
});

test('roguelike ground pass batches diamonds by texture key and fills world-anchored patterns', () => {
  assert.match(mainSource, /function drawGroundPlanPatternTiles\(/);
  const body = functionBody('drawGroundPlanPatternTiles');
  assert.match(body, /plan\.cellAt\(tile\.worldX, tile\.worldY\)/);
  assert.doesNotMatch(body, /buildTerrainBlobCell\(/);
  assert.match(body, /buildTerrainPresentationForCell\(terrainCell, \{ frame: combat\.frame \}\)/);
  assert.match(body, /overlay\.id === 'bridge-deck-light'/);
  assert.match(body, /overlay\.id === 'water-flow'/);
  assert.match(body, /overlay\.id === 'terrain-shadow' \|\| overlay\.id === 'bridge-contact-shadow'/);
  assert.match(body, /new Path2D\(/);
  assert.match(mainSource, /function groundPlanPatternForGroup\(/);
  assert.match(mainSource, /ctx\.createPattern\(source, 'repeat'\)/);
  assert.match(body, /pattern\.setTransform\(new DOMMatrix\(\)\.translate\(/);
  assert.match(body, /groundPatternAnchorForOrigin\(/);
  assert.doesNotMatch(body, /translate\(-cameraWorldOffsetX, -cameraWorldOffsetY\)/);
  assert.match(body, /const groupKey = `\$\{terrainCell\.textureKey\}\|\$\{terrainPresentation\.elevationPx\}`/);
  assert.doesNotMatch(body, /blob-\$\{terrainCell\.blob\.variantIndex\}/);
  assert.doesNotMatch(body, /elev-\$\{terrainCell\.elevation\.band\}/);
  assert.match(body, /groundPlanPatternForGroup\(/);
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

test('WO-60 all ground-plane tile and road positions use the shared rounded lattice helper', () => {
  const sceneBody = functionBody('drawRoguelikeScene');
  const roadBody = functionBody('drawRoadsAndTransitions');
  assert.match(sceneBody, /groundTileLatticePointForProjection\(projected\)/);
  assert.match(roadBody, /groundTileLatticePointForProjection\(projected\)/);
  assert.doesNotMatch(sceneBody, /projected\.y \+ 64/);
  assert.doesNotMatch(roadBody, /projected\.y \+ 64/);
});

test('WO-62 loading screen prewarms deterministic Level 1 ground and prop image sets before reveal', () => {
  assert.match(mainSource, /async function decodeImageAsset\(/);
  const decodeBody = functionBody('decodeImageAsset');
  assert.match(decodeBody, /Promise\.race\(\[/);
  assert.match(decodeBody, /decode-timeout/);
  assert.match(mainSource, /async function prewarmHmhLevelAssets\(/);
  const prewarmBody = functionBody('prewarmHmhLevelAssets');
  assert.match(prewarmBody, /plan\.textureKeysNear\(playerX, playerY, 22\)/);
  assert.doesNotMatch(prewarmBody, /plan\.textureKeys\(\)/);
  assert.match(prewarmBody, /sbsGroundTileImage\(asset\)/);
  assert.match(prewarmBody, /buildLevelOneCuratedVisibleSceneObjects\(/);
  assert.match(prewarmBody, /curatedLevelOneImage\(object\.assetKey\)/);
  assert.match(prewarmBody, /decodeImageAsset\(/);
  const loadingBody = functionBody('showHMHLoadingScreen');
  assert.match(loadingBody, /await onComplete\(\)/);
  assert.match(loadingBody, /Promise\.race\(\[/);
  assert.match(loadingBody, /prewarm-timeout/);
  assert.match(loadingBody, /prewarmHmhLevelAssets\(level/);
});

test('ground rendering source test is covered by the explicit syntax gate', () => {
  assert.match(syntaxSource, /tests\/hmh-ground-rendering\.test\.mjs/);
  assert.match(syntaxSource, /apps\/portal\/src\/hmh-ground-plane-rendering\.mjs/);
});
