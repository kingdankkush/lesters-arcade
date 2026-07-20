import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCampaignExtractionPoint,
  buildCampaignPoiDirective,
  buildCampaignPoiEncounterProfile,
  buildCampaignWorldSetup,
  getHmhCampaignLayout,
  isCampaignExtractionReached,
} from '../apps/portal/src/hmh-campaign-runtime.mjs';
import { generateDistrictGrid } from '../apps/portal/src/district-generator.mjs';

test('getHmhCampaignLayout maps campaign levels to authored layouts', () => {
  assert.equal(getHmhCampaignLayout('level-1-crypto-wasteland'), 'level1-authored');
  assert.equal(getHmhCampaignLayout('level-2-litecoin-city'), 'level2-authored');
  assert.equal(getHmhCampaignLayout('level-3-the-getaway'), 'level3-authored');
  assert.equal(getHmhCampaignLayout('unknown-level'), 'level1-authored');
});

test('buildCampaignWorldSetup uses the level-specific authored layout', () => {
  const levelOne = buildCampaignWorldSetup({ levelId: 'level-1-crypto-wasteland', seed: 12345, worldWidth: 700, worldHeight: 175 });
  const levelTwo = buildCampaignWorldSetup({ levelId: 'level-2-litecoin-city', seed: 12345, worldWidth: 700, worldHeight: 175 });
  const rowOne = Math.floor(levelOne.macroCellsY / 2);
  const rowTwo = Math.floor(levelTwo.macroCellsY / 2);
  const levelOneCenter = levelOne.grid.find((cell) => cell.dx === 0 && cell.dy === rowOne);
  const levelTwoCenter = levelTwo.grid.find((cell) => cell.dx === 0 && cell.dy === rowTwo);
  assert.equal(levelOne.layout, 'level1-authored');
  assert.equal(levelTwo.layout, 'level2-authored');
  assert.equal(levelOneCenter?.districtFamily, 'desert_approach');
  assert.equal(levelTwoCenter?.districtFamily, 'outer_boulevard');
  assert.equal(levelTwo.roadNetwork.length > 0, true);
});

test('buildCampaignExtractionPoint prefers the authored late-run district for Level 1', () => {
  const districtGrid = [
    {
      dx: 0,
      dy: 0,
      districtFamily: 'country_road',
      landmarkTemplateId: 'crypto_country_rest_stop',
      setPieceAnchors: [{ id: 'country-rest-stop', templateId: 'crypto_country_rest_stop', localX: 2, localY: 2 }],
    },
    {
      dx: 1,
      dy: 0,
      districtFamily: 'inner_city',
      landmarkTemplateId: 'crypto_innercity_industrial_gate',
      setPieceAnchors: [{ id: 'innercity-safehouse', templateId: 'crypto_innercity_industrial_gate', localX: 4, localY: 2 }],
    },
  ];

  const point = buildCampaignExtractionPoint({ levelId: 'level-1-crypto-wasteland', districtGrid, worldWidth: 140, worldHeight: 35 });
  assert.equal(point.districtFamily, 'inner_city');
  assert.equal(point.templateId, 'crypto_innercity_industrial_gate');
  assert.equal(point.worldX, 66);
  assert.equal(point.worldY, 17);
  assert.equal(point.label, 'SAFEHOUSE');
});

test('buildCampaignExtractionPoint can project into the centered runtime coordinate space', () => {
  const districtGrid = [
    {
      dx: 1,
      dy: 0,
      districtFamily: 'inner_city',
      landmarkTemplateId: 'crypto_innercity_industrial_gate',
      setPieceAnchors: [{ id: 'innercity-safehouse', templateId: 'crypto_innercity_industrial_gate', localX: 4, localY: 2 }],
    },
  ];
  const point = buildCampaignExtractionPoint({
    levelId: 'level-1-crypto-wasteland',
    districtGrid,
    worldWidth: 140,
    worldHeight: 35,
    worldOffsetX: 70,
    worldOffsetY: 17,
  });
  assert.equal(point.worldX, -4);
  assert.equal(point.worldY, 0);
});

test('buildCampaignExtractionPoint prefers the authored late-run district for Level 2', () => {
  const districtGrid = [
    {
      dx: 0,
      dy: 0,
      districtFamily: 'financial_core',
      landmarkTemplateId: 'downtown_district',
      setPieceAnchors: [{ id: 'financial-core-plaza', templateId: 'city_park', localX: 2, localY: 2 }],
    },
    {
      dx: 2,
      dy: 0,
      districtFamily: 'penthouse_rim',
      landmarkTemplateId: 'walled_compound',
      setPieceAnchors: [{ id: 'penthouse-vip-exit', templateId: 'walled_compound', localX: 4, localY: 2 }],
    },
  ];

  const point = buildCampaignExtractionPoint({ levelId: 'level-2-litecoin-city', districtGrid, worldWidth: 175, worldHeight: 35 });
  assert.equal(point.districtFamily, 'penthouse_rim');
  assert.equal(point.templateId, 'walled_compound');
  assert.equal(point.worldX, 101);
  assert.equal(point.worldY, 17);
  assert.equal(point.label, 'VIP EXIT');
});

test('buildCampaignExtractionPoint gives Level 3 a finale-specific extraction label', () => {
  const districtGrid = [
    {
      dx: 2,
      dy: 0,
      districtFamily: 'penthouse_rim',
      landmarkTemplateId: 'walled_compound',
      setPieceAnchors: [{ id: 'penthouse-launch-exit', templateId: 'walled_compound', localX: 4, localY: 2 }],
    },
  ];

  const point = buildCampaignExtractionPoint({ levelId: 'level-3-the-getaway', districtGrid, worldWidth: 175, worldHeight: 35 });
  assert.equal(point.label, 'MAINNET EXIT');
  assert.match(point.detail, /Mainnet Express/i);
});

test('buildCampaignPoiDirective telegraphs Rugpull Gulch from the ghost-town spine', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const ghostTownCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === row && cell.macroRole === 'main-spine');
  assert.ok(ghostTownCell, 'found a ghost-town spine cell');
  const worldOffsetX = Math.floor(700 / 2);
  const worldOffsetY = Math.floor(175 / 2);
  const directive = buildCampaignPoiDirective({
    levelId: 'level-1-crypto-wasteland',
    districtGrid: grid,
    macroCellsX,
    macroCellsY,
    playerX: ghostTownCell.centerX - worldOffsetX,
    playerY: ghostTownCell.centerY - worldOffsetY,
    worldOffsetX,
    worldOffsetY,
  });
  assert.equal(directive?.id, 'rugpull-gulch');
  assert.equal(directive?.phaseHint, 'poi-telegraph');
  assert.match(directive?.telegraph ?? '', /water tower/i);
  assert.equal(directive?.rewardType, 'weapon-or-shield');
  assert.equal(typeof directive?.label, 'string');
});

test('buildCampaignPoiDirective ignores completed POIs', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const ghostTownCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === row && cell.macroRole === 'main-spine');
  const worldOffsetX = Math.floor(700 / 2);
  const worldOffsetY = Math.floor(175 / 2);
  const directive = buildCampaignPoiDirective({
    levelId: 'level-1-crypto-wasteland',
    districtGrid: grid,
    macroCellsX,
    macroCellsY,
    playerX: ghostTownCell.centerX - worldOffsetX,
    playerY: ghostTownCell.centerY - worldOffsetY,
    worldOffsetX,
    worldOffsetY,
    completedPoiIds: ['rugpull-gulch'],
  });
  assert.equal(directive, null);
});

test('isCampaignExtractionReached returns true only inside the extraction radius', () => {
  const extractionPoint = { worldX: 40, worldY: 22, radiusTiles: 1.25 };
  assert.equal(isCampaignExtractionReached({ playerX: 40.8, playerY: 22.6, extractionPoint }), true);
  assert.equal(isCampaignExtractionReached({ playerX: 42, playerY: 24, extractionPoint }), false);
});


test('buildCampaignPoiEncounterProfile turns Rugpull Gulch into a locked mini-boss arena with authored support packs', () => {
  const profile = buildCampaignPoiEncounterProfile({
    levelId: 'level-1-crypto-wasteland',
    activePoi: {
      id: 'rugpull-gulch',
      title: 'Rugpull Gulch',
      phaseHint: 'poi-arena',
      miniBossId: 'claim-jumper-sheriff',
      miniBossTitle: 'Claim-Jumper Sheriff',
      districtId: 'ghost-town',
    },
  });

  assert.equal(profile.spawnMode, 'arena-lock');
  assert.equal(profile.lockCamera, true);
  assert.equal(profile.miniBossEnemyId, 'claim-jumper-sheriff');
  assert.equal(profile.supportEnemyIds.includes('scam-cult-zealot'), true);
  assert.equal(profile.supportEnemyIds.includes('claim-jumper'), true);
});


test('buildCampaignPoiEncounterProfile gives Dry Forest Cave and Oasis Lakeside authored arena layouts plus animal-focused spawn slots', () => {
  const dryForest = buildCampaignPoiEncounterProfile({
    levelId: 'level-1-crypto-wasteland',
    activePoi: {
      id: 'dry-forest-cave',
      title: 'Dry Forest Cave',
      phaseHint: 'poi-arena',
      miniBossId: 'coyote-pack-runner',
      miniBossTitle: 'Cave Warren Alpha',
      districtId: 'country-road',
    },
  });
  const oasis = buildCampaignPoiEncounterProfile({
    levelId: 'level-1-crypto-wasteland',
    activePoi: {
      id: 'oasis-lakeside',
      title: 'Oasis Lakeside',
      phaseHint: 'poi-arena',
      miniBossId: 'rattlesnake',
      miniBossTitle: 'Sandbar Apex',
      districtId: 'residential-edge',
    },
  });

  assert.equal(dryForest.arenaLayout, 'cave-mouth-funnel');
  assert.equal(oasis.arenaLayout, 'sandbar-ring');
  assert.equal(dryForest.visualPlan.telegraphCue.includes('cave mouth'), true);
  assert.equal(dryForest.visualPlan.propClusters.some((cluster) => cluster.id === 'cave-mouth-rocks'), true);
  assert.equal(dryForest.spawnSlots.some((slot) => slot.enemyId === 'coyote-pack-runner' && slot.role === 'mini-boss'), true);
  assert.equal(dryForest.spawnSlots.some((slot) => slot.enemyId === 'fud-goblin-cave' && slot.role === 'support'), true);
  assert.equal(dryForest.spawnSlots.some((slot) => slot.enemyId === 'wild-boar' && slot.role === 'support'), true);
  assert.equal(dryForest.spawnSlots.every((slot) => slot.angleDeg >= 220 && slot.angleDeg <= 320), true, 'cave enemies should stage from the north-side funnel instead of surrounding the player');
  assert.equal(dryForest.spawnSlots.find((slot) => slot.role === 'mini-boss')?.angleDeg, 270, 'the Cave Warren Alpha should anchor the deep cave lane');
  assert.equal(oasis.visualPlan.telegraphCue.includes('waterline'), true);
  assert.equal(oasis.visualPlan.propClusters.some((cluster) => cluster.id === 'reed-bank-ring'), true);
  assert.equal(oasis.spawnSlots.some((slot) => slot.enemyId === 'rattlesnake' && slot.role === 'mini-boss'), true);
  assert.equal(oasis.spawnSlots.some((slot) => slot.enemyId === 'buzzard' && slot.role === 'support'), true);
  assert.equal(oasis.spawnSlots.some((slot) => slot.enemyId === 'gas-fee-wisp' && slot.role === 'support'), true);
});


test('POI encounter spawn slots are authored outside the player nearfield', () => {
  for (const poiId of ['rugpull-gulch', 'dry-forest-cave', 'oasis-lakeside']) {
    const profile = buildCampaignPoiEncounterProfile({
      levelId: 'level-1-crypto-wasteland',
      activePoi: { id: poiId, title: poiId, phaseHint: 'poi-arena', districtId: 'country-road' },
    });
    for (const slot of profile.spawnSlots) {
      const min = slot.role === 'mini-boss' ? 24 : 20;
      assert.ok(slot.radiusTiles >= min, `${poiId} ${slot.enemyId} should spawn at least ${min} tiles out, got ${slot.radiusTiles}`);
    }
  }
});
