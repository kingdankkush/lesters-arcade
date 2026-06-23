import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_AUTHORED_LEVEL_GRAMMAR,
  HMH_AUTHORED_SETPIECE_PACKS,
  authoredLevelSetpieceManifestFor,
  authoredPreferredTemplateIdsForContext,
  authoredSetpiecePacksForContext,
  authoredTemplatePoolIdsForContext,
} from '../apps/portal/src/hmh-authored-setpieces.mjs';
import { SCENE_TEMPLATES } from '../apps/portal/src/scene-templates.mjs';
import {
  DISTRICT_CELL,
  districtTemplateContextForCell,
  generateDistrictGrid,
} from '../apps/portal/src/district-generator.mjs';

test('authored setpiece grammar codifies paths, blockers, landmarks, gameplay hooks, and reference policy', () => {
  assert.match(HMH_AUTHORED_LEVEL_GRAMMAR.referencePolicy, /do not ship/i);
  assert.deepEqual(
    Object.keys(HMH_AUTHORED_LEVEL_GRAMMAR.layers).sort(),
    ['gameplay', 'ground', 'hardBoundary', 'landmark', 'route', 'softDressing'].sort(),
  );
  assert.equal(HMH_AUTHORED_LEVEL_GRAMMAR.layers.route.minClearTiles >= 4, true);
  assert.equal(HMH_AUTHORED_LEVEL_GRAMMAR.layers.hardBoundary.collisionRequired, true);
  assert.equal(HMH_AUTHORED_LEVEL_GRAMMAR.layers.softDressing.clusterOnly, true);
  assert.ok(HMH_AUTHORED_LEVEL_GRAMMAR.buildOrder[0].includes('primary traversal lane'));
});

test('authored setpiece packs cover forest, water, desert, rocky, marsh, town, city, residential, and harbor language', () => {
  const packIds = new Set(HMH_AUTHORED_SETPIECE_PACKS.map((pack) => pack.id));
  for (const expected of [
    'forest-trail-boundary',
    'creek-ford-crossing',
    'oasis-lake-shore',
    'desert-wash-and-dunes',
    'rock-wall-canyon-corridor',
    'marsh-boardwalk-pocket',
    'town-mainstreet-lived-in',
    'city-civic-plaza-block',
    'residential-neighborhood-loop',
    'harbor-industrial-service-edge',
  ]) {
    assert.equal(packIds.has(expected), true, `${expected} exists`);
  }

  for (const pack of HMH_AUTHORED_SETPIECE_PACKS) {
    assert.equal(pack.traversal.minClearTiles >= 3, true, `${pack.id} keeps traversal clear`);
    assert.equal(pack.groundPalette.length >= 3, true, `${pack.id} ground palette`);
    assert.equal(pack.hardBoundaries.length >= 3, true, `${pack.id} hard boundaries`);
    assert.equal(pack.softDressing.length >= 3, true, `${pack.id} soft dressing`);
    assert.equal(pack.landmarks.length >= 2, true, `${pack.id} landmarks`);
    assert.equal(pack.gameplayHooks.length >= 2, true, `${pack.id} gameplay hooks`);
    assert.equal(pack.templateIds.length >= 3, true, `${pack.id} template ids`);
    assert.equal(pack.preferredTemplateIds.length >= 1, true, `${pack.id} preferred ids`);
  }
});

test('context helper selects biome-specific authored setpieces without treating reference images as assets', () => {
  const forest = authoredSetpiecePacksForContext({
    levelId: 'level-1-crypto-wasteland',
    districtFamily: 'country_road',
    macroRole: 'shoulder-loop',
  }).map((pack) => pack.id);
  assert.equal(forest.includes('forest-trail-boundary'), true);

  const creek = authoredSetpiecePacksForContext({
    levelId: 'level-1-crypto-wasteland',
    districtFamily: 'country_road',
    macroRole: 'shoulder-loop',
    waterFeature: 'culvert-drainage',
  }).map((pack) => pack.id);
  assert.equal(creek.includes('creek-ford-crossing'), true);

  const oasis = authoredSetpiecePacksForContext({
    levelId: 'level-1-crypto-wasteland',
    districtFamily: 'residential_edge',
    poiId: 'oasis_lakeside',
    macroRole: 'poi-spur',
    waterFeature: 'lake-shoreline',
  }).map((pack) => pack.id);
  assert.equal(oasis.includes('oasis-lake-shore'), true);

  const city = authoredTemplatePoolIdsForContext({
    levelId: 'level-2-litecoin-city',
    districtFamily: 'financial_core',
    macroRole: 'main-spine',
  });
  assert.equal(city.includes('authored_city_civic_block'), true);

  const preferred = authoredPreferredTemplateIdsForContext({
    levelId: 'level-1-crypto-wasteland',
    districtFamily: 'desert_approach',
    macroRole: 'main-spine',
  });
  assert.equal(preferred.includes('authored_desert_dune_wash'), true);
});

test('authored setpiece manifests are attached to level ids and expose runtime template contracts', () => {
  const levelOne = authoredLevelSetpieceManifestFor('level-1-crypto-wasteland');
  const levelTwo = authoredLevelSetpieceManifestFor('level-2-litecoin-city');
  assert.equal(levelOne.packIds.includes('forest-trail-boundary'), true);
  assert.equal(levelOne.packIds.includes('town-mainstreet-lived-in'), true);
  assert.equal(levelTwo.packIds.includes('city-civic-plaza-block'), true);
  assert.equal(levelTwo.packIds.includes('harbor-industrial-service-edge'), true);
  assert.equal(levelOne.templateIds.includes('authored_oasis_lake_shore'), true);
  assert.equal(levelTwo.designContract.some((line) => line.includes('paths remain open')), true);
});

test('every authored setpiece template id exists and references repo-owned coherent-world assets', () => {
  const templateIds = new Set(HMH_AUTHORED_SETPIECE_PACKS.flatMap((pack) => pack.templateIds));
  for (const templateId of templateIds) {
    const template = SCENE_TEMPLATES[templateId];
    assert.ok(template, `${templateId} exists in SCENE_TEMPLATES`);
    assert.equal(template.slots.length >= 3, true, `${templateId} has authored slot grammar`);
    for (const slot of template.slots) {
      const assetPath = fileURLToPath(new URL(`../apps/portal/assets/generated/hmh-coherent-world/${slot.assetKey}.png`, import.meta.url));
      assert.equal(existsSync(assetPath), true, `${templateId} asset ${slot.assetKey} exists`);
    }
  }
});

test('district generator exposes authored setpiece packs and preferred templates in Level 1/2 context', () => {
  const levelOne = generateDistrictGrid(12345, 700, 175, { layout: 'level1-authored' });
  const levelOneRow = Math.floor(levelOne.macroCellsY / 2);
  const desertCell = levelOne.grid.find((cell) => cell.districtFamily === 'desert_approach' && cell.dy === levelOneRow);
  assert.ok(desertCell);
  assert.equal(desertCell.authoredSetpiecePackIds.includes('desert-wash-and-dunes'), true);
  assert.equal(desertCell.templatePoolIds.includes('authored_desert_dune_wash'), true);

  const desertContext = districtTemplateContextForCell(
    desertCell.dx * DISTRICT_CELL + 2,
    desertCell.dy * DISTRICT_CELL + 2,
    levelOne.grid,
    levelOne.macroCellsX,
  );
  assert.equal(desertContext.authoredSetpiecePackIds.includes('desert-wash-and-dunes'), true);
  assert.equal(desertContext.preferredTemplateIds.includes('authored_desert_dune_wash'), true);

  const southPoiRow = levelOneRow + 2;
  const oasisCell = levelOne.grid.find((cell) => cell.poiId === 'oasis_lakeside' && cell.dy === southPoiRow);
  assert.ok(oasisCell);
  assert.equal(oasisCell.authoredSetpiecePackIds.includes('oasis-lake-shore'), true);
  assert.equal(oasisCell.templatePoolIds.includes('authored_oasis_lake_shore'), true);

  const levelTwo = generateDistrictGrid(6789, 700, 175, { layout: 'level2-authored' });
  const levelTwoRow = Math.floor(levelTwo.macroCellsY / 2);
  const financialCell = levelTwo.grid.find((cell) => cell.districtFamily === 'financial_core' && cell.dy === levelTwoRow);
  assert.ok(financialCell);
  assert.equal(financialCell.authoredSetpiecePackIds.includes('city-civic-plaza-block'), true);
  assert.equal(financialCell.templatePoolIds.includes('authored_city_civic_block'), true);
});
