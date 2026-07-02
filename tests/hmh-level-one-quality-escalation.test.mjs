import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN,
  HMH_LEVEL_ONE_QUALITY_STYLE,
  HMH_LEVEL_ONE_REFERENCE_MAP_ANCHORS,
  HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS,
  buildLevelOneEnvironmentAssetPromptBrief,
  levelOneQualityContextForDistrictCell,
} from '../apps/portal/src/hmh-level-one-quality.mjs';
import {
  districtTemplateContextForCell,
  generateDistrictGrid,
} from '../apps/portal/src/district-generator.mjs';
import { SCENE_TEMPLATES } from '../apps/portal/src/scene-templates.mjs';
import { buildCampaignPoiEncounterProfile } from '../apps/portal/src/hmh-campaign-runtime.mjs';

function oneCell(overrides = {}) {
  return [{
    dx: 0,
    dy: 0,
    districtFamily: 'ghost_town',
    districtId: 'ghost_town',
    districtType: 'ghost_town',
    archetype: 'city_core',
    templatePoolIds: ['crypto_ghost_mainstreet_front', 'crypto_ghost_town_block'],
    preferredTemplateIds: [],
    pathOrientation: 'horizontal',
    macroRole: 'main-spine',
    branchLane: 'main-spine',
    landmarkTemplateId: 'crypto_ghost_mainstreet_front',
    setPieceAnchors: [],
    transitionBands: [],
    ...overrides,
  }];
}

test('Level 1 quality style contract locks future work to unified isometric Metal Slug-inspired polish', () => {
  assert.equal(HMH_LEVEL_ONE_QUALITY_STYLE.id, 'level1-isometric-metal-slug-quality-v1');
  assert.match(HMH_LEVEL_ONE_QUALITY_STYLE.artDirection, /Metal Slug/i);
  assert.match(HMH_LEVEL_ONE_QUALITY_STYLE.artDirection, /Age of Empires II/i);
  assert.match(HMH_LEVEL_ONE_QUALITY_STYLE.artDirection, /Hades/i);
  assert.match(HMH_LEVEL_ONE_QUALITY_STYLE.artDirection, /Deep Rock/i);
  assert.equal(HMH_LEVEL_ONE_QUALITY_STYLE.camera, '2:1 isometric');
  assert.equal(HMH_LEVEL_ONE_QUALITY_STYLE.referencePolicy.includes('reference-only'), true);
  assert.deepEqual(HMH_LEVEL_ONE_QUALITY_STYLE.prioritySystems, [
    'map-design',
    'pathing',
    'encounter-pacing',
    'enemy-readability',
    'combat-feel',
    'xp-balance',
    'high-quality-sprites-and-vfx',
  ]);
});

test('Level 1 external references are codified as style targets, not source assets', () => {
  const ids = HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS.map((target) => target.id);
  for (const required of ['aoe2-de-world-density', 'hades-combat-readability', 'deep-rock-survivor-swarm-readability', 'level-video-handpainted-town']) {
    assert.equal(ids.includes(required), true, `${required} style target missing`);
  }

  const aoe = HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS.find((target) => target.id === 'aoe2-de-world-density');
  assert.match(aoe.translateIntoAssets.join(' '), /cobblestone|water|walls|farm/i);
  assert.equal(aoe.copyPolicy, 'reference-only: extract composition/material rules, never copy silhouettes, emblems, buildings, or map layouts');

  const hades = HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS.find((target) => target.id === 'hades-combat-readability');
  assert.match(hades.translateIntoAssets.join(' '), /telegraph|lighting|outline/i);

  const survivor = HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS.find((target) => target.id === 'deep-rock-survivor-swarm-readability');
  assert.match(survivor.translateIntoAssets.join(' '), /crystal|enemy|resource/i);
});

test('Level 1 environment asset generation plan prioritizes terrain/path/building/nature kits with PixelLab plus post-process', () => {
  const categories = HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN.map((item) => item.category);
  for (const required of ['ground-textures', 'roads-and-paths', 'water-and-shorelines', 'buildings-and-walls', 'trees-rocks-and-natural-blockers', 'combat-readable-props']) {
    assert.equal(categories.includes(required), true, `${required} generation category missing`);
  }
  assert.equal(HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN.every((item) => item.toolchain.includes('PixelLab')), true);
  assert.equal(HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN.every((item) => item.toolchain.includes('palette-quantize')), true);
  assert.equal(HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN.every((item) => item.acceptance.includes('original silhouettes only')), true);
});

test('Level 1 prompt brief turns reference style into asset-specific PixelLab guidance', () => {
  const brief = buildLevelOneEnvironmentAssetPromptBrief({ category: 'roads-and-paths', districtFamily: 'ghost_town', assetRole: 'main-street cobblestone lane' });
  assert.equal(brief.styleId, 'level1-isometric-metal-slug-quality-v1');
  assert.match(brief.prompt, /Age of Empires II-inspired authored world density/i);
  assert.match(brief.prompt, /Hades-inspired combat readability/i);
  assert.match(brief.prompt, /transparent background/i);
  assert.match(brief.prompt, /main-street cobblestone lane/i);
  assert.deepEqual(brief.postProcess, ['palette-quantize', 'selective-outline-normalize', 'alpha-clean', 'atlas-pack', 'contact-sheet-qc']);
});

test('Level 1 reference-map anchors preserve the forest/town/river/desert/waterfront quality targets', () => {
  const ids = HMH_LEVEL_ONE_REFERENCE_MAP_ANCHORS.map((anchor) => anchor.id);
  for (const required of ['forest-mini-boss-park', 'main-town-road-loop', 'animated-lake-beach', 'river-bridge-chain', 'desert-boulder-road', 'second-town-farm-spur']) {
    assert.equal(ids.includes(required), true, `${required} anchor missing`);
  }
  const river = HMH_LEVEL_ONE_REFERENCE_MAP_ANCHORS.find((anchor) => anchor.id === 'river-bridge-chain');
  assert.equal(river.pathingCue.includes('bridge'), true);
  assert.equal(river.materials.includes('animated water'), true);
});

test('Level 1 quality templates expose readable forest, ghost town, desert, river, and waterfront geometry', () => {
  const forest = SCENE_TEMPLATES.level1_quality_forest_clearing;
  const ghost = SCENE_TEMPLATES.level1_quality_ghost_mainstreet_duel;
  const desert = SCENE_TEMPLATES.level1_quality_desert_boulder_switchback;
  const river = SCENE_TEMPLATES.level1_quality_river_bridge_chain;
  const waterfront = SCENE_TEMPLATES.level1_quality_waterfront_beach_lake;

  assert.ok(forest?.slots.some((slot) => slot.assetKey === 'crypto/forest-tree-line' && slot.place === 'pathEdge'));
  assert.ok(forest?.slots.some((slot) => slot.assetKey === 'level-final-ambient/leaf-swirl' && slot.solid === false));
  assert.ok(ghost?.slots.some((slot) => slot.assetKey === 'crypto/ghost-saloon-front' && slot.place === 'anchor'));
  assert.ok(ghost?.slots.some((slot) => slot.assetKey === 'crypto/ghost-boarded-storefront'));
  assert.ok(desert?.slots.some((slot) => slot.assetKey === 'crypto/canyon-cliff-edge' && slot.place === 'pathEdge'));
  assert.ok(desert?.slots.some((slot) => slot.assetKey === 'level-final-ambient/desert-dust-devil'));
  assert.ok(river?.slots.some((slot) => slot.assetKey === 'construct/wood-bridge' && slot.place === 'anchor'));
  assert.ok(river?.slots.some((slot) => slot.assetKey === 'level-final-ambient/water-sparkle-line'));
  assert.ok(waterfront?.slots.some((slot) => slot.assetKey === 'sketch-level1/lake-water-loop-00' || slot.assetKey === 'level-final-ambient/water-sparkle-line'));
});

test('districtTemplateContextForCell injects Level 1 quality style and preferred handcrafted templates', () => {
  const context = districtTemplateContextForCell(2, 2, oneCell(), 1);
  assert.equal(context.qualityStyleId, 'level1-isometric-metal-slug-quality-v1');
  assert.equal(context.levelOneQuality.materialPalette.includes('weathered timber'), true);
  assert.equal(context.templatePoolIds.includes('level1_quality_ghost_mainstreet_duel'), true);
  assert.equal(context.preferredTemplateIds[0], 'level1_quality_ghost_mainstreet_duel');
  assert.equal(context.authoredComposition.materialReadability, 'bold silhouettes, clean lane edges, animated dust/smoke accents');
  assert.equal(context.levelOneQuality.referenceStyleTargets.includes('aoe2-de-world-density'), true);
  assert.equal(context.levelOneQuality.assetGenerationCategories.includes('roads-and-paths'), true);
});

test('generated Level 1 districts carry quality context across forest, ghost town, desert, and town/farm bands', () => {
  const setup = generateDistrictGrid(20260625, 700, 175, { layout: 'level1-authored' });
  const families = new Set(setup.grid.map((cell) => cell.districtFamily));
  for (const required of ['desert_approach', 'ghost_town', 'country_road', 'residential_edge', 'inner_city']) {
    assert.equal(families.has(required), true, `${required} family missing`);
  }
  const ghostCell = setup.grid.find((cell) => cell.districtFamily === 'ghost_town');
  const sceneX = ghostCell.dx * 5 + 2;
  const sceneY = ghostCell.dy * 5 + 2;
  const context = districtTemplateContextForCell(sceneX, sceneY, setup.grid, setup.macroCellsX, { macroCellsY: setup.macroCellsY });
  assert.equal(context.levelOneQuality.referenceAnchors.some((id) => id.includes('town') || id.includes('ghost')), true);
  assert.equal(context.templatePoolIds.some((id) => id.startsWith('level1_quality_')), true);
});

test('Level 1 POI encounter profiles expose quality choreography for mini-boss readability and combat feel', () => {
  const profile = buildCampaignPoiEncounterProfile({
    levelId: 'level-1-crypto-wasteland',
    activePoi: {
      id: 'rugpull-gulch',
      title: 'Rugpull Gulch',
      phaseHint: 'poi-arena',
      miniBossId: 'claim-jumper-sheriff',
      districtId: 'ghost-town',
    },
  });
  assert.equal(profile.qualityStyleId, 'level1-isometric-metal-slug-quality-v1');
  assert.equal(profile.encounterQuality.cameraReadability, 'lock arena around authored landmark, keep player lane clear');
  assert.equal(profile.encounterQuality.combatFeel.includes('grenade'), true);
  assert.equal(profile.encounterQuality.animationRequirements.includes('attack-tell'), true);
  assert.equal(profile.encounterQuality.goreVfx.includes('chunky'), true);
});

test('runtime source consumes Level 1 quality context in district-generator and campaign encounters', () => {
  const districtSource = readFileSync(fileURLToPath(new URL('../apps/portal/src/district-generator.mjs', import.meta.url)), 'utf8');
  const runtimeSource = readFileSync(fileURLToPath(new URL('../apps/portal/src/hmh-campaign-runtime.mjs', import.meta.url)), 'utf8');
  assert.equal(districtSource.includes('levelOneQualityContextForDistrictCell'), true);
  assert.equal(districtSource.includes('qualityStyleId'), true);
  assert.equal(runtimeSource.includes('buildLevelOneEncounterQualityProfile'), true);
});
