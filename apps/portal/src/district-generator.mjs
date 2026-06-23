// District Generator for Hard Money Heroes (iso roguelike).
//
// Extends the scene-template system with macro-scale structure:
// - Road/Path networks connecting district centers
// - District clustering (macro-cells group related scene templates)
// - Biome transition zones with blending tiles
// - Building interior room layouts with doorways/hallways
// - Dynamic bridge placement for water crossings

import { SCENE_CELL, SCENE_TEMPLATES, buildScene, groundThemeForCell } from './scene-templates.mjs';
import { biomeAt } from './biome-model.mjs';
import {
  authoredPreferredTemplateIdsForContext,
  authoredSetpiecePacksForContext,
  authoredTemplatePoolIdsForContext,
  authoredZonePlansForContext,
} from './hmh-authored-setpieces.mjs';

// Default biomeAt function - overridden by tests or main.js
let biomeAtImpl = biomeAt;

// Allow overriding biomeAt for testing
export function setBiomeAtImpl(fn) { biomeAtImpl = fn; }

export const DISTRICT_CELL = 5; // macro-cell size in scene cells (5 * 7 = 35 world tiles)
export const ROAD_WIDTH = 1; // world tiles
export const SIDEWALK_WIDTH = 1; // world tiles

// District types that can be clustered into neighborhoods
export const DISTRICT_TYPES = Object.freeze({
    // Add more structure to DISTRICT_TYPES.
    DOWNTOWN: { id: 'downtown', templates: ['downtown_district', 'street_block', 'named_building_skyscraper', 'named_building_city_hall'], weight: 3, biomeAffinities: ['town', 'pavement'], roadDensity: 0.8, pointsOfInterest: ['skyscraper', 'city_hall', 'police_station', 'central_park']},
    SUBURBAN: { id: 'suburban', templates: ['suburban_residential', 'green_park', 'fenced_yard', 'named_building_mansion', 'named_building_school'], weight: 4, biomeAffinities: ['town', 'grass'], roadDensity: 0.5, pointsOfInterest: ['mansion', 'school', 'local_shop', 'playground']},
    INDUSTRIAL: { id: 'industrial', templates: ['industrial_zone', 'walled_compound', 'street_block', 'named_building_factory', 'named_building_warehouse'], weight: 2, biomeAffinities: ['pavement', 'road'], roadDensity: 0.7, pointsOfInterest: ['factory', 'warehouse', 'scrapyard', 'power_plant']},
    COMMERCIAL: { id: 'commercial', templates: ['downtown_district', 'office_interior', 'diner_interior', 'grocery_interior', 'gym_interior', 'named_building_mall', 'named_building_theater'], weight: 2, biomeAffinities: ['town', 'pavement'], roadDensity: 0.6, pointsOfInterest: ['mall', 'theater', 'large_store', 'restaurant_row']},
    RESIDENTIAL: { id: 'residential', templates: ['suburban_residential', 'fenced_yard', 'green_park', 'named_building_house', 'named_building_apartment_block'], weight: 4, biomeAffinities: ['town', 'grass'], roadDensity: 0.4, pointsOfInterest: ['house', 'apartment_block', 'small_park', 'community_center']},
    CITY_PARK: { id: 'city_park', templates: ['city_park', 'green_park', 'river_crossing', 'named_building_observatory'], weight: 2, biomeAffinities: ['town', 'forest', 'grass'], roadDensity: 0.2, pointsOfInterest: ['observatory', 'botanical_garden', 'zoo', 'bandstand']},
    FOREST_WILDERNESS: { id: 'forest_wild', templates: ['tree_grove', 'rock_field', 'river_crossing', 'named_obstacle_hermit_hut'], weight: 2, biomeAffinities: ['forest', 'rocky'], roadDensity: 0.15, pointsOfInterest: ['hermit_hut', 'ruins', 'waterfall', 'ancient_tree']},
    BEACH_AREA: { id: 'beach', templates: ['beach_boardwalk', 'river_crossing', 'named_obstacle_lighthouse', 'named_obstacle_shipwreck'], weight: 1, biomeAffinities: ['sand', 'water'], roadDensity: 0.2, pointsOfInterest: ['lighthouse', 'shipwreck', 'pier', 'beach_bar']},
});

// Road types for network generation
export const ROAD_TYPES = Object.freeze({
  HIGHWAY: { id: 'highway', width: 3, sidewalkWidth: 1, template: 'street_block', spacing: 1, tileKey: 'pavement-main' },
  MAIN_STREET: { id: 'main_street', width: 2, sidewalkWidth: 1, template: 'street_block', spacing: 2, tileKey: 'pavement-crosswalk' },
  SIDE_STREET: { id: 'side_street', width: 1, sidewalkWidth: 1, template: 'street_block', spacing: 3, tileKey: 'pavement-sidewalk' },
  ALLEY: { id: 'alley', width: 1, sidewalkWidth: 0, template: 'street_block', spacing: 4, tileKey: 'pavement-alley' },
  BOARDWALK: { id: 'boardwalk', width: 2, sidewalkWidth: 0, template: 'beach_boardwalk', spacing: 1, tileKey: 'bridge-wood' },
  DIRT_PATH: { id: 'dirt_path', width: 1, sidewalkWidth: 0, template: 'suburban_residential', spacing: 3, tileKey: 'grass-path' },
  FOREST_TRAIL: { id: 'forest_trail', width: 1, sidewalkWidth: 0, template: 'tree_grove', spacing: 4, tileKey: 'grass-path' },
});

export const LEVEL_ONE_BELTS = Object.freeze([
  Object.freeze({
    id: 'desert_approach',
    familyId: 'desert_approach',
    districtId: 'desert_approach',
    archetype: 'wilderness',
    landmarkTemplateId: 'crypto_desert_outpost',
    landmarkComplementArchetype: 'wilderness',
    landmarkInfluenceRadius: 2,
    templatePoolIds: Object.freeze(['crypto_desert_outpost', 'crypto_desert_outpost_yard', 'crypto_canyon_pass', 'crypto_canyon_gate', 'crypto_desert_salvage_basin', 'crypto_desert_ghost_checkpoint']),
    roadDensity: 0.32,
    routeShape: 'central-road-spine-with-salvage-loops',
    landmarkRole: 'outpost-or-canyon-overlook',
    loopCount: 2,
    coverProfile: 'sparse-long-sightlines',
    roadTypeKey: 'DIRT_PATH',
    pathOrientation: 'horizontal',
    ratioMax: 0.154,
  }),
  Object.freeze({
    id: 'ghost_town',
    familyId: 'ghost_town',
    districtId: 'ghost_town',
    archetype: 'city_core',
    landmarkTemplateId: 'crypto_ghost_mainstreet_front',
    landmarkComplementArchetype: 'city_core',
    landmarkInfluenceRadius: 2,
    templatePoolIds: Object.freeze(['crypto_ghost_mainstreet_front', 'crypto_ghost_false_front', 'crypto_ghost_saloon_square', 'crypto_ghost_town_block', 'crypto_desert_ghost_checkpoint', 'crypto_ghost_country_checkpoint', 'street_block', 'downtown_district']),
    roadDensity: 0.58,
    routeShape: 'main-street-loop-with-alley-cuts',
    landmarkRole: 'saloon-front-or-boarded-mainstreet',
    loopCount: 2,
    coverProfile: 'cover-heavy-corners',
    roadTypeKey: 'MAIN_STREET',
    pathOrientation: 'horizontal',
    ratioMax: 0.385,
  }),
  Object.freeze({
    id: 'country_road',
    familyId: 'country_road',
    districtId: 'country_road',
    archetype: 'suburban',
    landmarkTemplateId: 'crypto_country_rest_stop',
    landmarkComplementArchetype: 'suburban',
    landmarkInfluenceRadius: 1,
    templatePoolIds: Object.freeze(['crypto_country_rest_stop', 'crypto_country_pull_off', 'crypto_country_bus_turnout', 'crypto_ghost_country_checkpoint', 'crypto_country_residential_checkpoint', 'street_block', 'fenced_yard']),
    roadDensity: 0.42,
    routeShape: 'main-road-with-pull-offs-and-roadside-loops',
    landmarkRole: 'rest-stop-or-roadside-pull-off',
    loopCount: 2,
    coverProfile: 'medium-cover-utility-clutter',
    roadTypeKey: 'DIRT_PATH',
    pathOrientation: 'horizontal',
    ratioMax: 0.615,
  }),
  Object.freeze({
    id: 'residential_edge',
    familyId: 'residential_edge',
    districtId: 'residential_edge',
    archetype: 'suburban',
    landmarkTemplateId: 'crypto_residential_square',
    landmarkComplementArchetype: 'park',
    landmarkInfluenceRadius: 2,
    templatePoolIds: Object.freeze(['crypto_residential_square', 'crypto_residential_greenbelt_pocket', 'crypto_residential_culdesac', 'crypto_country_residential_checkpoint', 'crypto_residential_innercity_checkpoint', 'suburban_residential', 'green_park', 'fenced_yard']),
    roadDensity: 0.46,
    routeShape: 'neighborhood-loops-with-driveway-connectors',
    landmarkRole: 'neighborhood-square-or-greenbelt',
    loopCount: 2,
    coverProfile: 'hedges-fences-and-sidewalk-cover',
    roadTypeKey: 'SIDE_STREET',
    pathOrientation: 'vertical',
    ratioMax: 0.769,
  }),
  Object.freeze({
    id: 'inner_city',
    familyId: 'inner_city',
    districtId: 'inner_city',
    archetype: 'industrial',
    landmarkTemplateId: 'crypto_innercity_industrial_gate',
    landmarkComplementArchetype: 'industrial',
    landmarkInfluenceRadius: 2,
    templatePoolIds: Object.freeze(['crypto_innercity_industrial_gate', 'crypto_innercity_checkpoint_block', 'crypto_innercity_barricade_crossing', 'crypto_residential_innercity_checkpoint', 'industrial_zone', 'walled_compound', 'street_block', 'downtown_district']),
    roadDensity: 0.68,
    routeShape: 'block-grid-with-alley-loops-and-checkpoints',
    landmarkRole: 'warehouse-gate-or-checkpoint-block',
    loopCount: 2,
    coverProfile: 'dense-urban-chokepoints',
    roadTypeKey: 'MAIN_STREET',
    pathOrientation: 'vertical',
    ratioMax: 1,
  }),
]);

export const LEVEL_TWO_BELTS = Object.freeze([
  Object.freeze({
    id: 'outer_boulevard',
    familyId: 'outer_boulevard',
    districtId: 'outer_boulevard',
    archetype: 'city_core',
    landmarkTemplateId: 'street_block',
    landmarkComplementArchetype: 'industrial',
    landmarkInfluenceRadius: 2,
    templatePoolIds: Object.freeze(['street_block', 'industrial_zone', 'walled_compound', 'downtown_district']),
    roadDensity: 0.74,
    routeShape: 'tram-boulevards-with-alley-cutthroughs',
    landmarkRole: 'boulevard-checkpoint-or-service-yard',
    loopCount: 2,
    coverProfile: 'parked-cars-barriers-and-service-walls',
    roadTypeKey: 'MAIN_STREET',
    pathOrientation: 'horizontal',
    ratioMax: 0.249,
  }),
  Object.freeze({
    id: 'financial_core',
    familyId: 'financial_core',
    districtId: 'financial_core',
    archetype: 'city_core',
    landmarkTemplateId: 'downtown_district',
    landmarkComplementArchetype: 'city_core',
    landmarkInfluenceRadius: 2,
    templatePoolIds: Object.freeze(['downtown_district', 'street_block', 'city_park', 'walled_compound']),
    roadDensity: 0.82,
    routeShape: 'plazas-with-cross-block-lanes-and-fountain-squares',
    landmarkRole: 'plaza-or-ticker-court',
    loopCount: 2,
    coverProfile: 'planters-statues-and-lobby-barriers',
    roadTypeKey: 'HIGHWAY',
    pathOrientation: 'vertical',
    ratioMax: 0.549,
  }),
  Object.freeze({
    id: 'luxury_neighborhood',
    familyId: 'luxury_neighborhood',
    districtId: 'luxury_neighborhood',
    archetype: 'suburban',
    landmarkTemplateId: 'city_park',
    landmarkComplementArchetype: 'park',
    landmarkInfluenceRadius: 2,
    templatePoolIds: Object.freeze(['city_park', 'green_park', 'suburban_residential', 'fenced_yard', 'walled_compound']),
    roadDensity: 0.52,
    routeShape: 'gated-drives-with-pool-courts-and-garden-loops',
    landmarkRole: 'garden-court-or-security-gate',
    loopCount: 2,
    coverProfile: 'hedges-fountains-and-gated-corners',
    roadTypeKey: 'SIDE_STREET',
    pathOrientation: 'vertical',
    ratioMax: 0.799,
  }),
  Object.freeze({
    id: 'penthouse_rim',
    familyId: 'penthouse_rim',
    districtId: 'penthouse_rim',
    archetype: 'industrial',
    landmarkTemplateId: 'walled_compound',
    landmarkComplementArchetype: 'city_core',
    landmarkInfluenceRadius: 2,
    templatePoolIds: Object.freeze(['walled_compound', 'downtown_district', 'street_block', 'industrial_zone']),
    roadDensity: 0.68,
    routeShape: 'roofline-corridors-with-vip-exit-lanes',
    landmarkRole: 'vip-exit-or-skybridge-gate',
    loopCount: 2,
    coverProfile: 'tight-checkpoints-and-rooftop-service-covers',
    roadTypeKey: 'MAIN_STREET',
    pathOrientation: 'horizontal',
    ratioMax: 1,
  }),
]);

const LEVEL_ONE_POI_BLUEPRINTS = Object.freeze({
  old_hashrate_camp: Object.freeze({
    id: 'old_hashrate_camp',
    role: 'mining-camp-salvage-yard',
    primaryTemplateId: 'crypto_hashrate_camp',
    templatePoolIds: Object.freeze(['crypto_hashrate_camp', 'crypto_desert_salvage_basin', 'crypto_desert_outpost_yard', 'crypto_canyon_pass']),
    complementArchetype: 'industrial',
    influenceRadius: 2,
    rewardCategory: 'drone-or-orbital',
    miniBossId: 'salvage-mercenary',
    sightlineCue: 'salvage flare + silver-blue dust plume',
  }),
  rugpull_gulch: Object.freeze({
    id: 'rugpull_gulch',
    role: 'ghost-town-vault-square',
    primaryTemplateId: 'crypto_rugpull_gulch',
    templatePoolIds: Object.freeze(['crypto_rugpull_gulch', 'crypto_ghost_saloon_square', 'crypto_ghost_mainstreet_front', 'crypto_ghost_false_front']),
    complementArchetype: 'city_core',
    influenceRadius: 2,
    rewardCategory: 'weapon-or-shield',
    miniBossId: 'claim-jumper-sheriff',
    sightlineCue: 'water tower + vault ruin',
  }),
  dry_forest_cave: Object.freeze({
    id: 'dry_forest_cave',
    role: 'forest-cave-ambush-pocket',
    primaryTemplateId: 'crypto_dry_forest_cave',
    templatePoolIds: Object.freeze(['crypto_dry_forest_cave', 'crypto_forest_greenbelt', 'tree_grove', 'river_crossing']),
    complementArchetype: 'wilderness',
    influenceRadius: 2,
    rewardCategory: 'xp-luck-or-summon',
    miniBossId: 'cave-warren-alpha',
    sightlineCue: 'dark cave mouth + pine wall',
  }),
  crossroads_trading_post: Object.freeze({
    id: 'crossroads_trading_post',
    role: 'branching-trading-post',
    primaryTemplateId: 'crypto_crossroads_trading_post',
    templatePoolIds: Object.freeze(['crypto_crossroads_trading_post', 'crypto_country_rest_stop', 'crypto_country_bus_turnout', 'crypto_country_pull_off']),
    complementArchetype: 'suburban',
    influenceRadius: 2,
    rewardCategory: 'reroll-economy',
    miniBossId: 'bandit-captain',
    sightlineCue: 'lantern line + signpost hub',
  }),
  oasis_lakeside: Object.freeze({
    id: 'oasis_lakeside',
    role: 'lake-shore-rest-beat',
    primaryTemplateId: 'crypto_oasis_lakeside',
    templatePoolIds: Object.freeze(['crypto_oasis_lakeside', 'river_crossing', 'beach_boardwalk', 'crypto_residential_greenbelt_pocket']),
    complementArchetype: 'park',
    influenceRadius: 2,
    rewardCategory: 'regen-health',
    miniBossId: 'sandbar-apex',
    sightlineCue: 'water glint + reed bank',
  }),
  mesa_overlook: Object.freeze({
    id: 'mesa_overlook',
    role: 'ridge-sniper-overlook',
    primaryTemplateId: 'crypto_mesa_overlook',
    templatePoolIds: Object.freeze(['crypto_mesa_overlook', 'crypto_canyon_pass', 'crypto_canyon_gate', 'crypto_residential_greenbelt_pocket']),
    complementArchetype: 'wilderness',
    influenceRadius: 2,
    rewardCategory: 'range-pierce',
    miniBossId: 'ridge-raider',
    sightlineCue: 'ridge glint + cliff silhouette',
  }),
});

function levelOneLaneOffset(dy, macroCellsY) {
  return dy - Math.floor(macroCellsY / 2);
}

function levelOnePoiIdForLane(offset, familyId) {
  if (offset === -2) {
    if (familyId === 'desert_approach') return 'old_hashrate_camp';
    if (familyId === 'country_road') return 'dry_forest_cave';
    if (familyId === 'residential_edge') return 'mesa_overlook';
  }
  if (offset === 2) {
    if (familyId === 'ghost_town') return 'rugpull_gulch';
    if (familyId === 'country_road') return 'crossroads_trading_post';
    if (familyId === 'residential_edge') return 'oasis_lakeside';
  }
  return null;
}

function levelOnePoiBlueprint(poiId) {
  return poiId ? LEVEL_ONE_POI_BLUEPRINTS[poiId] ?? null : null;
}

function levelOnePoiAnchorCell(laneOffset, dx) {
  return {
    localX: dx % 2 === 0 ? 2 : 3,
    localY: laneOffset < 0 ? 1 : 3,
  };
}

function levelOnePoiSetPieceAnchors(flowProfile, dx) {
  const blueprint = flowProfile?.poiBlueprint;
  if (!blueprint) return [];
  const anchor = levelOnePoiAnchorCell(flowProfile.laneOffset, dx);
  return [{
    id: `${blueprint.id}-anchor`,
    role: blueprint.role,
    templateId: blueprint.primaryTemplateId,
    localX: anchor.localX,
    localY: anchor.localY,
    influenceRadius: blueprint.influenceRadius,
    complementArchetype: blueprint.complementArchetype,
    templatePoolIds: mergeTemplatePools([blueprint.primaryTemplateId], blueprint.templatePoolIds),
  }];
}

function buildLevelOneFlowProfile(dx, dy, macroCellsX, macroCellsY, belt) {
  const laneOffset = levelOneLaneOffset(dy, macroCellsY);
  const branchLane = laneOffset < 0 ? 'north' : laneOffset > 0 ? 'south' : 'center';
  const poiId = belt ? levelOnePoiIdForLane(laneOffset, belt.familyId) : null;
  const poiBlueprint = levelOnePoiBlueprint(poiId);
  const poiApproachId = belt && Math.abs(laneOffset) === 1 ? levelOnePoiIdForLane(laneOffset < 0 ? -2 : 2, belt.familyId) : null;
  const ratio = macroCellsX <= 1 ? 1 : dx / (macroCellsX - 1);
  const isCrossroadsHub = belt?.familyId === 'country_road' && laneOffset === 0 && ratio >= 0.42 && ratio <= 0.58;
  const isCitySeam = belt?.familyId === 'inner_city' && laneOffset === 0;
  const restBeat = belt?.familyId === 'country_road' && Math.abs(laneOffset) === 1;

  let macroRole = 'outer-wilds';
  if (laneOffset === 0) macroRole = isCitySeam ? 'city-seam' : (isCrossroadsHub ? 'hub-spine' : 'main-spine');
  else if (Math.abs(laneOffset) === 1 && poiApproachId) macroRole = 'shoulder-loop';
  else if (Math.abs(laneOffset) === 2 && poiId) macroRole = 'poi-spur';

  return {
    laneOffset,
    branchLane,
    macroRole,
    poiId,
    poiApproachId,
    poiBlueprint,
    poiTemplatePoolIds: poiBlueprint?.templatePoolIds ?? [],
    poiRewardCategory: poiBlueprint?.rewardCategory ?? null,
    poiMiniBossId: poiBlueprint?.miniBossId ?? null,
    sightlineCue: poiBlueprint?.sightlineCue ?? (isCitySeam ? 'litecoin-city-horizon' : (belt?.familyId === 'ghost_town' ? 'water-tower-silhouette' : null)),
    waterFeature: poiId === 'oasis_lakeside' ? 'lake-shoreline' : (belt?.familyId === 'country_road' ? 'culvert-drainage' : null),
    restBeat,
    isCrossroadsHub,
    isCitySeam,
  };
}

function buildAuthoredMacroConnection(layout, fromCell, toCell, direction, targetIndex) {
  if (!fromCell || !toCell) return null;
  if (layout !== 'level1-authored') {
    return {
      target: targetIndex,
      dir: direction,
      routeKind: direction === 'east' ? 'belt-spine' : 'cross-belt-link',
    };
  }

  const fromRole = fromCell.macroRole;
  const toRole = toCell.macroRole;
  const fromLane = fromCell.laneOffset;
  const toLane = toCell.laneOffset;

  if (direction === 'east') {
    if (fromLane !== toLane) return null;
    const spineRoles = new Set(['main-spine', 'hub-spine', 'city-seam']);
    if (spineRoles.has(fromRole) && spineRoles.has(toRole)) {
      return { target: targetIndex, dir: direction, routeKind: fromCell.isCrossroadsHub || toCell.isCrossroadsHub ? 'hub-spine' : 'belt-spine' };
    }
    if (fromRole === 'shoulder-loop' && toRole === 'shoulder-loop') {
      return { target: targetIndex, dir: direction, routeKind: 'shoulder-loop' };
    }
    if (fromRole === 'poi-spur' && toRole === 'poi-spur' && fromCell.poiId && fromCell.poiId === toCell.poiId) {
      return { target: targetIndex, dir: direction, routeKind: 'poi-spur' };
    }
    return null;
  }

  if (direction === 'south') {
    if (Math.abs((fromLane ?? 99) - (toLane ?? 99)) !== 1) return null;
    const connectorRoles = new Set(['main-spine', 'hub-spine', 'city-seam', 'shoulder-loop']);
    if (connectorRoles.has(fromRole) && connectorRoles.has(toRole)) {
      return {
        target: targetIndex,
        dir: direction,
        routeKind: fromCell.isCrossroadsHub || toCell.isCrossroadsHub ? 'hub-connector' : 'cross-belt-link',
      };
    }
    const fromPoiConnector = Boolean(fromCell.poiApproachId && toCell.poiId && fromCell.poiApproachId === toCell.poiId);
    const toPoiConnector = Boolean(toCell.poiApproachId && fromCell.poiId && toCell.poiApproachId === fromCell.poiId);
    if (fromPoiConnector || toPoiConnector) {
      return { target: targetIndex, dir: direction, routeKind: 'poi-connector' };
    }
  }

  return null;
}

function roadTypeFromKey(key) {
  return ROAD_TYPES[key] ?? ROAD_TYPES.SIDE_STREET;
}

function beltByMacroRatio(belts, dx, macroCellsX) {
  const ratio = macroCellsX <= 1 ? 1 : dx / (macroCellsX - 1);
  return belts.find((belt) => ratio <= belt.ratioMax) ?? belts[belts.length - 1];
}

function levelIdForAuthoredLayout(layout) {
  if (layout === 'level2-authored') return 'level-2-litecoin-city';
  if (layout === 'level1-authored') return 'level-1-crypto-wasteland';
  return null;
}

function authoredBeltForMacroCell(layout, dx, macroCellsX) {
  if (layout === 'level2-authored') return beltByMacroRatio(LEVEL_TWO_BELTS, dx, macroCellsX);
  if (layout === 'level1-authored') return beltByMacroRatio(LEVEL_ONE_BELTS, dx, macroCellsX);
  return null;
}

function beltPathOrientation(belt, dx, dy) {
  if (belt.familyId === 'country_road') return (dy % 2 === 0) ? 'horizontal' : 'vertical';
  if (belt.familyId === 'residential_edge') return ((dx + dy) % 2 === 0) ? 'horizontal' : 'vertical';
  if (belt.familyId === 'inner_city') return ((dx + dy) % 2 === 0) ? 'horizontal' : 'vertical';
  if (belt.familyId === 'outer_boulevard') return ((dx + dy) % 2 === 0) ? 'horizontal' : 'vertical';
  if (belt.familyId === 'financial_core') return ((dx + dy) % 2 === 0) ? 'vertical' : 'horizontal';
  if (belt.familyId === 'luxury_neighborhood') return ((dx + dy) % 2 === 0) ? 'vertical' : 'horizontal';
  if (belt.familyId === 'penthouse_rim') return ((dx + dy) % 2 === 0) ? 'horizontal' : 'vertical';
  return belt.pathOrientation;
}

function beltLandmarkAnchorCell(belt, dx, dy) {
  if (belt.familyId === 'desert_approach') return { localX: 2, localY: dy % 2 === 0 ? 1 : 3 };
  if (belt.familyId === 'ghost_town') return { localX: 2, localY: 2 };
  if (belt.familyId === 'country_road') return { localX: 2, localY: dy % 2 === 0 ? 1 : 3 };
  if (belt.familyId === 'residential_edge') return { localX: (dx + dy) % 2 === 0 ? 1 : 3, localY: 2 };
  if (belt.familyId === 'inner_city') return { localX: 2, localY: (dx % 2 === 0) ? 1 : 3 };
  if (belt.familyId === 'outer_boulevard') return { localX: 2, localY: dy % 2 === 0 ? 1 : 3 };
  if (belt.familyId === 'financial_core') return { localX: 2, localY: 2 };
  if (belt.familyId === 'luxury_neighborhood') return { localX: (dx + dy) % 2 === 0 ? 3 : 1, localY: 2 };
  if (belt.familyId === 'penthouse_rim') return { localX: 2, localY: (dx % 2 === 0) ? 1 : 3 };
  return { localX: 2, localY: 2 };
}

function beltSetPieceAnchors(belt, dx, dy) {
  const primaryAnchor = beltLandmarkAnchorCell(belt, dx, dy);
  if (belt.familyId === 'desert_approach') {
    return [
      {
        id: 'desert-outpost-core',
        role: belt.landmarkRole,
        templateId: 'crypto_desert_outpost',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'wilderness',
        templatePoolIds: mergeTemplatePools(['crypto_desert_outpost', 'crypto_desert_outpost_yard', 'crypto_canyon_pass', 'crypto_canyon_gate', 'crypto_desert_salvage_basin']),
      },
      {
        id: 'desert-canyon-gate',
        role: 'canyon-gate-or-salvage-cut',
        templateId: 'crypto_canyon_gate',
        localX: dx % 2 === 0 ? 4 : 0,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'wilderness',
        templatePoolIds: mergeTemplatePools(['crypto_canyon_gate', 'crypto_canyon_pass', 'crypto_desert_outpost_yard', 'crypto_desert_salvage_basin', 'crypto_desert_ghost_checkpoint']),
      },
      {
        id: 'desert-outpost-yard',
        role: 'salvage-pocket-or-fuel-yard',
        templateId: 'crypto_desert_outpost_yard',
        localX: 2,
        localY: dy % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['crypto_desert_outpost_yard', 'crypto_desert_outpost', 'crypto_desert_salvage_basin', 'crypto_canyon_pass']),
      },
      {
        id: 'desert-salvage-basin',
        role: 'salvage-basin-or-side-loop',
        templateId: 'crypto_desert_salvage_basin',
        localX: dx % 2 === 0 ? 1 : 3,
        localY: dy % 2 === 0 ? 3 : 1,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['crypto_desert_salvage_basin', 'crypto_desert_outpost_yard', 'crypto_canyon_gate']),
      },
    ];
  }
  if (belt.familyId === 'ghost_town') {
    return [
      {
        id: 'ghost-mainstreet-front',
        role: belt.landmarkRole,
        templateId: 'crypto_ghost_mainstreet_front',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['crypto_ghost_mainstreet_front', 'crypto_ghost_false_front', 'crypto_ghost_saloon_square', 'crypto_ghost_town_block', 'street_block', 'downtown_district']),
      },
      {
        id: 'ghost-false-front',
        role: 'false-front-or-side-street-pocket',
        templateId: 'crypto_ghost_false_front',
        localX: dx % 2 === 0 ? 1 : 3,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'suburban',
        templatePoolIds: mergeTemplatePools(['crypto_ghost_false_front', 'crypto_ghost_saloon_square', 'crypto_ghost_town_block', 'street_block']),
      },
      {
        id: 'ghost-saloon-square',
        role: 'mainstreet-plaza-or-duel-pocket',
        templateId: 'crypto_ghost_saloon_square',
        localX: dx % 2 === 0 ? 4 : 0,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['crypto_ghost_saloon_square', 'crypto_ghost_mainstreet_front', 'crypto_ghost_false_front']),
      },
      {
        id: 'ghost-seam-checkpoint',
        role: 'ghost-town-gate-or-stage-threshold',
        templateId: dx % 2 === 0 ? 'crypto_desert_ghost_checkpoint' : 'crypto_ghost_country_checkpoint',
        localX: 2,
        localY: dy % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'city_core',
        templatePoolIds: dx % 2 === 0
          ? mergeTemplatePools(['crypto_desert_ghost_checkpoint', 'crypto_ghost_mainstreet_front', 'crypto_desert_outpost'])
          : mergeTemplatePools(['crypto_ghost_country_checkpoint', 'crypto_ghost_mainstreet_front', 'crypto_country_rest_stop']),
      },
    ];
  }
  if (belt.familyId === 'country_road') {
    return [
      {
        id: 'country-rest-stop',
        role: belt.landmarkRole,
        templateId: 'crypto_country_rest_stop',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'suburban',
        templatePoolIds: mergeTemplatePools(['crypto_country_rest_stop', 'crypto_country_pull_off', 'crypto_country_bus_turnout', 'street_block', 'fenced_yard']),
      },
      {
        id: 'country-pull-off',
        role: 'roadside-pull-off-or-culvert-choke',
        templateId: 'crypto_country_pull_off',
        localX: dx % 2 === 0 ? 4 : 0,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'wilderness',
        templatePoolIds: mergeTemplatePools(['crypto_country_pull_off', 'crypto_country_rest_stop', 'crypto_country_bus_turnout', 'crypto_ghost_country_checkpoint', 'crypto_country_residential_checkpoint']),
      },
      {
        id: 'country-bus-turnout',
        role: 'bus-turnout-or-roadside-ambush',
        templateId: 'crypto_country_bus_turnout',
        localX: dx % 2 === 0 ? 1 : 3,
        localY: dy % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'suburban',
        templatePoolIds: mergeTemplatePools(['crypto_country_bus_turnout', 'crypto_country_rest_stop', 'crypto_country_pull_off']),
      },
      {
        id: 'country-seam-threshold',
        role: 'stage-threshold-or-service-turnoff',
        templateId: dy % 2 === 0 ? 'crypto_ghost_country_checkpoint' : 'crypto_country_residential_checkpoint',
        localX: 2,
        localY: dy % 2 === 0 ? 0 : 4,
        influenceRadius: 1,
        complementArchetype: 'suburban',
        templatePoolIds: dy % 2 === 0
          ? mergeTemplatePools(['crypto_ghost_country_checkpoint', 'crypto_country_rest_stop', 'crypto_ghost_mainstreet_front'])
          : mergeTemplatePools(['crypto_country_residential_checkpoint', 'crypto_country_pull_off', 'crypto_residential_square']),
      },
    ];
  }
  if (belt.familyId === 'residential_edge') {
    return [
      {
        id: 'residential-square-core',
        role: belt.landmarkRole,
        templateId: 'crypto_residential_square',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'park',
        templatePoolIds: mergeTemplatePools(['crypto_residential_square', 'crypto_residential_greenbelt_pocket', 'crypto_residential_culdesac', 'suburban_residential', 'green_park']),
      },
      {
        id: 'residential-greenbelt-pocket',
        role: 'greenbelt-pocket-or-driveway-connector',
        templateId: 'crypto_residential_greenbelt_pocket',
        localX: dx % 2 === 0 ? 3 : 1,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'park',
        templatePoolIds: mergeTemplatePools(['crypto_residential_greenbelt_pocket', 'crypto_residential_culdesac', 'crypto_residential_square', 'green_park', 'fenced_yard']),
      },
      {
        id: 'residential-culdesac',
        role: 'culdesac-or-yard-pocket',
        templateId: 'crypto_residential_culdesac',
        localX: 2,
        localY: dy % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'suburban',
        templatePoolIds: mergeTemplatePools(['crypto_residential_culdesac', 'crypto_residential_square', 'crypto_residential_greenbelt_pocket', 'fenced_yard']),
      },
      {
        id: 'residential-seam-checkpoint',
        role: 'neighborhood-threshold-or-city-edge-checkpoint',
        templateId: dx % 2 === 0 ? 'crypto_country_residential_checkpoint' : 'crypto_residential_innercity_checkpoint',
        localX: 2,
        localY: dy % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'suburban',
        templatePoolIds: dx % 2 === 0
          ? mergeTemplatePools(['crypto_country_residential_checkpoint', 'crypto_residential_square', 'crypto_country_rest_stop'])
          : mergeTemplatePools(['crypto_residential_innercity_checkpoint', 'crypto_residential_square', 'crypto_innercity_industrial_gate']),
      },
    ];
  }
  if (belt.familyId === 'inner_city') {
    return [
      {
        id: 'innercity-industrial-gate',
        role: belt.landmarkRole,
        templateId: 'crypto_innercity_industrial_gate',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['crypto_innercity_industrial_gate', 'crypto_innercity_checkpoint_block', 'crypto_innercity_barricade_crossing', 'industrial_zone', 'walled_compound', 'street_block']),
      },
      {
        id: 'innercity-checkpoint-block',
        role: 'checkpoint-block-or-alley-service-yard',
        templateId: 'crypto_innercity_checkpoint_block',
        localX: (dx + dy) % 2 === 0 ? 1 : 3,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['crypto_innercity_checkpoint_block', 'crypto_innercity_barricade_crossing', 'crypto_innercity_industrial_gate', 'street_block', 'downtown_district']),
      },
      {
        id: 'innercity-barricade-crossing',
        role: 'barricade-crossing-or-killbox',
        templateId: 'crypto_innercity_barricade_crossing',
        localX: (dx + dy) % 2 === 0 ? 4 : 0,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['crypto_innercity_barricade_crossing', 'crypto_innercity_checkpoint_block', 'crypto_innercity_industrial_gate']),
      },
      {
        id: 'innercity-residential-threshold',
        role: 'city-edge-threshold-or-boss-push-gate',
        templateId: 'crypto_residential_innercity_checkpoint',
        localX: 2,
        localY: dx % 2 === 0 ? 0 : 4,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['crypto_residential_innercity_checkpoint', 'crypto_innercity_industrial_gate', 'crypto_residential_square']),
      },
    ];
  }
  if (belt.familyId === 'outer_boulevard') {
    return [
      {
        id: 'outer-boulevard-spine',
        role: belt.landmarkRole,
        templateId: 'street_block',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['street_block', 'industrial_zone', 'walled_compound', 'downtown_district']),
      },
      {
        id: 'outer-service-yard',
        role: 'service-yard-or-traffic-jam',
        templateId: 'industrial_zone',
        localX: dx % 2 === 0 ? 4 : 0,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['industrial_zone', 'street_block', 'walled_compound']),
      },
      {
        id: 'outer-hard-corner',
        role: 'underpass-corner-or-bus-stop-pocket',
        templateId: 'walled_compound',
        localX: 2,
        localY: dy % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['walled_compound', 'street_block', 'industrial_zone']),
      },
      {
        id: 'outer-plaza-cut',
        role: 'crosswalk-pocket-or-side-plaza',
        templateId: 'downtown_district',
        localX: dx % 2 === 0 ? 1 : 3,
        localY: dy % 2 === 0 ? 1 : 3,
        influenceRadius: 1,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['downtown_district', 'street_block', 'industrial_zone']),
      },
    ];
  }
  if (belt.familyId === 'financial_core') {
    return [
      {
        id: 'financial-core-plaza',
        role: belt.landmarkRole,
        templateId: 'downtown_district',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['downtown_district', 'street_block', 'city_park', 'walled_compound']),
      },
      {
        id: 'financial-fountain-court',
        role: 'fountain-court-or-hedge-maze',
        templateId: 'city_park',
        localX: dx % 2 === 0 ? 1 : 3,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'park',
        templatePoolIds: mergeTemplatePools(['city_park', 'downtown_district', 'street_block']),
      },
      {
        id: 'financial-lobby-choke',
        role: 'lobby-choke-or-security-court',
        templateId: 'walled_compound',
        localX: 2,
        localY: dx % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['walled_compound', 'downtown_district', 'street_block']),
      },
      {
        id: 'financial-side-block',
        role: 'trading-floor-side-block',
        templateId: 'street_block',
        localX: dx % 2 === 0 ? 4 : 0,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['street_block', 'downtown_district', 'city_park']),
      },
    ];
  }
  if (belt.familyId === 'luxury_neighborhood') {
    return [
      {
        id: 'luxury-garden-core',
        role: belt.landmarkRole,
        templateId: 'city_park',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'park',
        templatePoolIds: mergeTemplatePools(['city_park', 'green_park', 'suburban_residential', 'fenced_yard']),
      },
      {
        id: 'luxury-gated-drive',
        role: 'gated-drive-or-security-booth',
        templateId: 'fenced_yard',
        localX: 2,
        localY: dy % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'suburban',
        templatePoolIds: mergeTemplatePools(['fenced_yard', 'suburban_residential', 'green_park']),
      },
      {
        id: 'luxury-pool-court',
        role: 'pool-court-or-sculpture-lawn',
        templateId: 'green_park',
        localX: dx % 2 === 0 ? 4 : 0,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'park',
        templatePoolIds: mergeTemplatePools(['green_park', 'city_park', 'suburban_residential']),
      },
      {
        id: 'luxury-villa-block',
        role: 'villa-block-or-garden-lane',
        templateId: 'suburban_residential',
        localX: dx % 2 === 0 ? 1 : 3,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'suburban',
        templatePoolIds: mergeTemplatePools(['suburban_residential', 'fenced_yard', 'green_park']),
      },
    ];
  }
  if (belt.familyId === 'penthouse_rim') {
    return [
      {
        id: 'penthouse-vip-exit',
        role: belt.landmarkRole,
        templateId: 'walled_compound',
        localX: primaryAnchor.localX,
        localY: primaryAnchor.localY,
        influenceRadius: 2,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['walled_compound', 'downtown_district', 'street_block', 'industrial_zone']),
      },
      {
        id: 'penthouse-skybridge-gate',
        role: 'skybridge-gate-or-rooftop-barrier',
        templateId: 'downtown_district',
        localX: dx % 2 === 0 ? 1 : 3,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['downtown_district', 'walled_compound', 'street_block']),
      },
      {
        id: 'penthouse-service-lift',
        role: 'service-lift-or-rooftop-yard',
        templateId: 'industrial_zone',
        localX: 2,
        localY: dx % 2 === 0 ? 4 : 0,
        influenceRadius: 1,
        complementArchetype: 'industrial',
        templatePoolIds: mergeTemplatePools(['industrial_zone', 'walled_compound', 'street_block']),
      },
      {
        id: 'penthouse-lane-pocket',
        role: 'vip-lane-pocket-or-helipad-approach',
        templateId: 'street_block',
        localX: dx % 2 === 0 ? 4 : 0,
        localY: 2,
        influenceRadius: 1,
        complementArchetype: 'city_core',
        templatePoolIds: mergeTemplatePools(['street_block', 'downtown_district', 'walled_compound']),
      },
    ];
  }
  return [{
    id: `${belt.familyId}-primary-anchor`,
    role: belt.landmarkRole,
    templateId: belt.landmarkTemplateId,
    localX: primaryAnchor.localX,
    localY: primaryAnchor.localY,
    influenceRadius: belt.landmarkInfluenceRadius,
    complementArchetype: belt.landmarkComplementArchetype,
    templatePoolIds: [...belt.templatePoolIds],
  }];
}

function landmarkSceneCellForDistrictCell(districtCell, localX, localY) {
  return {
    cellX: districtCell.dx * DISTRICT_CELL + localX,
    cellY: districtCell.dy * DISTRICT_CELL + localY,
  };
}

function activeSetPieceForLocalCell(districtCell, localSceneCellX, localSceneCellY) {
  const anchors = Array.isArray(districtCell?.setPieceAnchors) ? districtCell.setPieceAnchors : [];
  let best = null;
  anchors.forEach((anchor, index) => {
    const distance = Math.max(Math.abs(localSceneCellX - anchor.localX), Math.abs(localSceneCellY - anchor.localY));
    if (distance > anchor.influenceRadius) return;
    const candidate = { ...anchor, distance, priority: index };
    if (
      !best
      || candidate.distance < best.distance
      || (candidate.distance === best.distance && candidate.influenceRadius < best.influenceRadius)
      || (candidate.distance === best.distance && candidate.influenceRadius === best.influenceRadius && candidate.priority < best.priority)
    ) {
      best = candidate;
    }
  });
  return best;
}

function mergeTemplatePools(...templatePools) {
  return Array.from(new Set(templatePools.flat().filter(Boolean)));
}

function buildTransitionEdge(fromCell, toCell, direction) {
  if (!fromCell || !toCell || fromCell.districtFamily === toCell.districtFamily) return null;
  const pairKey = [fromCell.districtFamily, toCell.districtFamily].sort().join('|');
  const seamTemplateIds = {
    'desert_approach|ghost_town': ['crypto_desert_ghost_checkpoint'],
    'country_road|ghost_town': ['crypto_ghost_country_checkpoint'],
    'country_road|residential_edge': ['crypto_country_residential_checkpoint'],
    'inner_city|residential_edge': ['crypto_residential_innercity_checkpoint'],
  }[pairKey] ?? [];
  return {
    direction,
    fromDistrictFamily: fromCell.districtFamily,
    toDistrictFamily: toCell.districtFamily,
    bandId: `${fromCell.districtFamily}-to-${toCell.districtFamily}`,
    widthCells: 1,
    seamTemplateIds,
    templatePoolIds: mergeTemplatePools(fromCell.templatePoolIds, toCell.templatePoolIds, seamTemplateIds),
  };
}

function transitionBandAtLocalCell(districtCell, localSceneCellX, localSceneCellY) {
  const edges = districtCell.transitionEdges ?? {};
  if (edges.west && localSceneCellX <= edges.west.widthCells - 1) return edges.west;
  if (edges.east && localSceneCellX >= DISTRICT_CELL - edges.east.widthCells) return edges.east;
  if (edges.north && localSceneCellY <= edges.north.widthCells - 1) return edges.north;
  if (edges.south && localSceneCellY >= DISTRICT_CELL - edges.south.widthCells) return edges.south;
  return null;
}

function seamTemplateIdsForLocalCell(districtCell, localSceneCellX, localSceneCellY) {
  const edges = districtCell.transitionEdges ?? {};
  const last = DISTRICT_CELL - 1;
  return mergeTemplatePools(
    localSceneCellX === 0 ? edges.west?.seamTemplateIds ?? [] : [],
    localSceneCellX === last ? edges.east?.seamTemplateIds ?? [] : [],
    localSceneCellY === 0 ? edges.north?.seamTemplateIds ?? [] : [],
    localSceneCellY === last ? edges.south?.seamTemplateIds ?? [] : [],
  );
}

function preferredTemplateIdsForLocalCell(districtCell, localSceneCellX, localSceneCellY) {
  const center = Math.floor(DISTRICT_CELL / 2);
  const last = DISTRICT_CELL - 1;
  const onCenterRow = localSceneCellY === center;
  const onCenterCol = localSceneCellX === center;
  const onCross = onCenterRow || onCenterCol;
  const onOuterRing = localSceneCellX === 0 || localSceneCellX === last || localSceneCellY === 0 || localSceneCellY === last;
  const corner = (localSceneCellX === 0 || localSceneCellX === last) && (localSceneCellY === 0 || localSceneCellY === last);
  const orientedSpine = districtCell.pathOrientation === 'vertical' ? onCenterCol : onCenterRow;
  const seamTemplateIds = seamTemplateIdsForLocalCell(districtCell, localSceneCellX, localSceneCellY);
  const poiPreferenceIds = districtCell.macroRole === 'poi-spur' ? (districtCell.poiTemplatePoolIds ?? []) : [];
  const authoredPreferenceIds = districtCell.authoredPreferredTemplateIds ?? [];

  let localPreferenceIds = [];
  switch (districtCell.districtFamily) {
    case 'desert_approach':
      localPreferenceIds = corner
        ? ['crypto_canyon_pass', 'crypto_canyon_gate']
        : orientedSpine
          ? ['crypto_desert_outpost_yard', 'crypto_desert_salvage_basin', 'crypto_desert_outpost']
          : onOuterRing
            ? ['crypto_canyon_pass', 'crypto_desert_ghost_checkpoint', 'crypto_desert_outpost_yard']
            : ['crypto_desert_salvage_basin', 'crypto_desert_outpost_yard', 'crypto_desert_outpost'];
      break;
    case 'ghost_town':
      localPreferenceIds = onCenterRow
        ? ['crypto_ghost_mainstreet_front', 'crypto_ghost_saloon_square', 'crypto_ghost_false_front']
        : onOuterRing
          ? ['crypto_ghost_town_block', 'street_block', 'downtown_district']
          : ['crypto_ghost_saloon_square', 'crypto_ghost_town_block', 'crypto_ghost_false_front'];
      break;
    case 'country_road':
      localPreferenceIds = orientedSpine
        ? ['crypto_country_rest_stop', 'crypto_country_bus_turnout', 'crypto_country_pull_off']
        : onOuterRing
          ? ['crypto_country_pull_off', 'fenced_yard', 'street_block']
          : ['crypto_country_bus_turnout', 'crypto_country_pull_off', 'street_block'];
      break;
    case 'residential_edge':
      localPreferenceIds = onCross
        ? ['crypto_residential_square', 'crypto_residential_greenbelt_pocket', 'crypto_residential_culdesac']
        : onOuterRing
          ? ['suburban_residential', 'green_park', 'fenced_yard']
          : ['crypto_residential_greenbelt_pocket', 'crypto_residential_culdesac', 'suburban_residential'];
      break;
    case 'inner_city':
      localPreferenceIds = onCross
        ? ['crypto_innercity_industrial_gate', 'crypto_innercity_checkpoint_block', 'crypto_innercity_barricade_crossing']
        : corner
          ? ['walled_compound', 'industrial_zone', 'street_block']
          : ['street_block', 'industrial_zone', 'downtown_district'];
      break;
    default:
      localPreferenceIds = [];
      break;
  }

  return mergeTemplatePools(poiPreferenceIds, localPreferenceIds, seamTemplateIds, authoredPreferenceIds);
}

function buildAuthoredDistrictProfile(belt, biome) {
  return {
    id: belt.districtId,
    templates: belt.templatePoolIds,
    weight: 1,
    biomeAffinities: [biome],
    roadDensity: belt.roadDensity,
    pointsOfInterest: [belt.landmarkRole],
    roadTypeKey: belt.roadTypeKey,
  };
}

function chooseDistrictTypeForBiome(seed, dx, dy, biome) {
  const availableTypes = Object.values(DISTRICT_TYPES).filter((t) => t.biomeAffinities.includes(biome));
  if (availableTypes.length === 0) {
    const fallbackTypes = Object.values(DISTRICT_TYPES).filter((t) => t.biomeAffinities.includes('town') || t.biomeAffinities.includes('road'));
    availableTypes.push(...fallbackTypes);
  }

  const weights = availableTypes.map((t) => t.weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = (hashU32(seed, dx * 1000 + dy) / 4294967296) * total;

  let chosen = availableTypes[0];
  for (let i = 0; i < availableTypes.length; i++) {
    r -= availableTypes[i].weight;
    if (r <= 0) { chosen = availableTypes[i]; break; }
  }
  return chosen;
}

export function districtCellAtSceneCell(cellX, cellY, districtGrid, macroCellsX, options = {}) {
  const worldOffsetX = options.worldOffsetX ?? 0;
  const worldOffsetY = options.worldOffsetY ?? 0;
  const macroCellsY = options.macroCellsY ?? null;
  const worldX = cellX * SCENE_CELL + Math.floor(SCENE_CELL / 2) + worldOffsetX;
  const worldY = cellY * SCENE_CELL + Math.floor(SCENE_CELL / 2) + worldOffsetY;
  const dx = Math.floor(worldX / (DISTRICT_CELL * SCENE_CELL));
  const dy = Math.floor(worldY / (DISTRICT_CELL * SCENE_CELL));
  if (dx < 0 || dy < 0 || dx >= macroCellsX || (macroCellsY != null && dy >= macroCellsY)) return null;
  return districtGrid[dy * macroCellsX + dx] ?? null;
}

function authoredCompositionForLocalCell(districtCell, localSceneCellX, localSceneCellY, activeSetPiece, transitionBand) {
  const role = districtCell?.macroRole ?? 'generic-grid';
  const routeAligned = districtCell?.pathOrientation === 'vertical'
    ? localSceneCellX === 2
    : localSceneCellY === 2;
  const nearRoute = districtCell?.pathOrientation === 'vertical'
    ? Math.abs(localSceneCellX - 2) <= 1
    : Math.abs(localSceneCellY - 2) <= 1;
  const authoredRouteRole = ['main-spine', 'hub-spine', 'city-seam', 'shoulder-loop', 'poi-spur'].includes(role);

  if (activeSetPiece?.distance === 0) {
    return Object.freeze({ role: 'landmark-anchor', sceneDensity: 1, skipAnchor: false, skipScatter: true, maxScatterCount: 0, maxPathEdgeCount: 3, ambientAllowed: true, ambientChancePct: 10 });
  }
  if (activeSetPiece) {
    return Object.freeze({ role: 'setpiece-ring', sceneDensity: activeSetPiece.distance <= 1 ? 0.18 : 0.04, skipAnchor: true, skipScatter: true, maxPathEdgeCount: 2, ambientAllowed: activeSetPiece.distance <= 1, ambientChancePct: activeSetPiece.distance <= 1 ? 5 : 0 });
  }
  if (transitionBand) {
    return Object.freeze({ role: 'transition-seam', sceneDensity: 0.12, skipAnchor: true, skipScatter: true, maxPathEdgeCount: 2, ambientAllowed: false, ambientChancePct: 0 });
  }
  if (authoredRouteRole && routeAligned) {
    return Object.freeze({ role: 'clear-route-corridor', sceneDensity: 0.08, skipAnchor: true, skipScatter: true, maxPathEdgeCount: 2, ambientAllowed: false, ambientChancePct: 0 });
  }
  if (authoredRouteRole && nearRoute) {
    return Object.freeze({ role: 'route-edge-dressing', sceneDensity: 0.04, skipAnchor: true, skipScatter: true, maxPathEdgeCount: 1, ambientAllowed: false, ambientChancePct: 0 });
  }
  if (role === 'outer-wilds') {
    return Object.freeze({ role: 'open-wilds-negative-space', sceneDensity: 0.02, skipAnchor: true, skipScatter: true, ambientAllowed: false, ambientChancePct: 0 });
  }
  return Object.freeze({ role: 'authored-negative-space', sceneDensity: 0.02, skipAnchor: true, skipScatter: true, ambientAllowed: false, ambientChancePct: 0 });
}

export function districtTemplateContextForCell(cellX, cellY, districtGrid, macroCellsX, options = {}) {
  const districtCell = districtCellAtSceneCell(cellX, cellY, districtGrid, macroCellsX, options);
  if (!districtCell) return null;
  const worldOffsetX = options.worldOffsetX ?? 0;
  const worldOffsetY = options.worldOffsetY ?? 0;
  const worldX = cellX * SCENE_CELL + Math.floor(SCENE_CELL / 2) + worldOffsetX;
  const worldY = cellY * SCENE_CELL + Math.floor(SCENE_CELL / 2) + worldOffsetY;
  const sceneWorldCellX = Math.floor(worldX / SCENE_CELL);
  const sceneWorldCellY = Math.floor(worldY / SCENE_CELL);
  const localSceneCellX = sceneWorldCellX - districtCell.dx * DISTRICT_CELL;
  const localSceneCellY = sceneWorldCellY - districtCell.dy * DISTRICT_CELL;
  const activeSetPiece = activeSetPieceForLocalCell(districtCell, localSceneCellX, localSceneCellY);
  const activeAnchorSceneCell = activeSetPiece
    ? landmarkSceneCellForDistrictCell(districtCell, activeSetPiece.localX, activeSetPiece.localY)
    : null;
  const transitionBand = transitionBandAtLocalCell(districtCell, localSceneCellX, localSceneCellY);
  const setPieceTemplatePoolIds = activeSetPiece?.templatePoolIds ?? districtCell.templatePoolIds;
  const preferredTemplateIds = preferredTemplateIdsForLocalCell(districtCell, localSceneCellX, localSceneCellY);
  const authoredComposition = authoredCompositionForLocalCell(districtCell, localSceneCellX, localSceneCellY, activeSetPiece, transitionBand);
  return {
    districtFamily: districtCell.districtFamily,
    templatePoolIds: transitionBand ? mergeTemplatePools(setPieceTemplatePoolIds, transitionBand.templatePoolIds) : setPieceTemplatePoolIds,
    preferredTemplateIds,
    archetype: districtCell.archetype,
    pathOrientation: districtCell.pathOrientation,
    localSceneCellX,
    localSceneCellY,
    authoredComposition,
    sceneDensity: authoredComposition.sceneDensity,
    branchLane: districtCell.branchLane,
    macroRole: districtCell.macroRole,
    poiId: districtCell.poiId,
    poiApproachId: districtCell.poiApproachId,
    poiRewardCategory: districtCell.poiRewardCategory,
    poiMiniBossId: districtCell.poiMiniBossId,
    sightlineCue: districtCell.sightlineCue,
    waterFeature: districtCell.waterFeature,
    restBeat: districtCell.restBeat,
    authoredSetpiecePackIds: districtCell.authoredSetpiecePackIds ?? [],
    authoredTemplatePoolIds: districtCell.authoredTemplatePoolIds ?? [],
    authoredPreferredTemplateIds: districtCell.authoredPreferredTemplateIds ?? [],
    authoredSetpieceZonePlans: districtCell.authoredSetpieceZonePlans ?? [],
    landmarkRole: districtCell.landmarkRole,
    landmarkTemplateId: districtCell.landmarkTemplateId,
    forceTemplateId: activeSetPiece?.distance === 0 ? activeSetPiece.templateId : null,
    transitionBand,
    activeSetPiece: activeSetPiece ? {
      id: activeSetPiece.id,
      role: activeSetPiece.role,
      templateId: activeSetPiece.templateId,
      localX: activeSetPiece.localX,
      localY: activeSetPiece.localY,
      distance: activeSetPiece.distance,
      influenceRadius: activeSetPiece.influenceRadius,
      complementArchetype: activeSetPiece.complementArchetype,
      templatePoolIds: activeSetPiece.templatePoolIds,
    } : null,
    landmarkInfluence: activeSetPiece ? {
      distance: activeSetPiece.distance,
      influenceRadius: activeSetPiece.influenceRadius,
      complementArchetype: activeSetPiece.complementArchetype,
      anchorCellX: activeAnchorSceneCell.cellX,
      anchorCellY: activeAnchorSceneCell.cellY,
      setPieceId: activeSetPiece.id,
      templatePoolIds: activeSetPiece.templatePoolIds,
    } : null,
  };
}

// District macro-grid: divides world into DISTRICT_CELL x DISTRICT_CELL macro-cells
// Each macro-cell gets a district type, and roads connect their centers
export function generateDistrictGrid(seed, worldWidth, worldHeight, options = {}) {
  const macroCellsX = Math.ceil(worldWidth / (DISTRICT_CELL * SCENE_CELL));
  const macroCellsY = Math.ceil(worldHeight / (DISTRICT_CELL * SCENE_CELL));
  const layout = options.layout ?? 'level1-authored';
  const grid = [];
  
  for (let dy = 0; dy < macroCellsY; dy++) {
    for (let dx = 0; dx < macroCellsX; dx++) {
      const centerX = dx * DISTRICT_CELL * SCENE_CELL + Math.floor(DISTRICT_CELL * SCENE_CELL / 2);
      const centerY = dy * DISTRICT_CELL * SCENE_CELL + Math.floor(DISTRICT_CELL * SCENE_CELL / 2);
      const biome = biomeAtImpl(seed, centerX, centerY);
      const belt = authoredBeltForMacroCell(layout, dx, macroCellsX);
      const chosen = belt ? buildAuthoredDistrictProfile(belt, biome) : chooseDistrictTypeForBiome(seed, dx, dy, biome);
      const flowProfile = belt ? buildLevelOneFlowProfile(dx, dy, macroCellsX, macroCellsY, belt) : {
        laneOffset: 0,
        branchLane: 'center',
        macroRole: 'generic-grid',
        poiId: null,
        poiApproachId: null,
        poiBlueprint: null,
        poiTemplatePoolIds: [],
        poiRewardCategory: null,
        poiMiniBossId: null,
        sightlineCue: null,
        waterFeature: null,
        restBeat: false,
        isCrossroadsHub: false,
        isCitySeam: false,
      };
      const authoredSetpieceContext = {
        levelId: levelIdForAuthoredLayout(layout),
        districtFamily: belt?.familyId ?? chosen.id,
        poiId: flowProfile.poiId,
        macroRole: flowProfile.macroRole,
        waterFeature: flowProfile.waterFeature,
      };
      const authoredSetpiecePacks = authoredSetpiecePacksForContext(authoredSetpieceContext);
      const authoredTemplatePoolIds = authoredTemplatePoolIdsForContext(authoredSetpieceContext);
      const authoredPreferredTemplateIds = authoredPreferredTemplateIdsForContext(authoredSetpieceContext);
      const authoredSetpieceZonePlans = authoredZonePlansForContext(authoredSetpieceContext);
      const poiAnchors = layout === 'level1-authored' ? levelOnePoiSetPieceAnchors(flowProfile, dx) : [];
      const setPieceAnchors = [...poiAnchors, ...(belt ? beltSetPieceAnchors(belt, dx, dy) : [])];
      const primarySetPiece = setPieceAnchors[0] ?? null;

      grid.push({
        dx, dy,
        centerX, centerY,
        biome,
        district: chosen,
        templates: chosen.templates,
        districtType: chosen.id,
        districtFamily: belt?.familyId ?? chosen.id,
        stageBelt: belt?.id ?? chosen.id,
        routeShape: belt?.routeShape ?? 'generic-grid',
        landmarkRole: primarySetPiece?.role ?? belt?.landmarkRole ?? 'district-poi',
        landmarkTemplateId: primarySetPiece?.templateId ?? belt?.landmarkTemplateId ?? chosen.templates?.[0] ?? null,
        landmarkComplementArchetype: primarySetPiece?.complementArchetype ?? belt?.landmarkComplementArchetype ?? (belt?.archetype ?? chosen.id),
        landmarkInfluenceRadius: primarySetPiece?.influenceRadius ?? belt?.landmarkInfluenceRadius ?? 1,
        landmarkAnchorCell: primarySetPiece ? { localX: primarySetPiece.localX, localY: primarySetPiece.localY } : (belt ? beltLandmarkAnchorCell(belt, dx, dy) : { localX: 2, localY: 2 }),
        setPieceAnchors,
        authoredSetpiecePackIds: Object.freeze(authoredSetpiecePacks.map((pack) => pack.id)),
        authoredSetpiecePacks,
        authoredTemplatePoolIds,
        authoredPreferredTemplateIds,
        authoredSetpieceZonePlans,
        loopCount: belt?.loopCount ?? 1,
        coverProfile: belt?.coverProfile ?? 'mixed',
        templatePoolIds: mergeTemplatePools(belt?.templatePoolIds ?? chosen.templates, flowProfile.poiTemplatePoolIds ?? [], authoredTemplatePoolIds),
        archetype: belt?.archetype ?? chosen.id,
        pathOrientation: belt ? beltPathOrientation(belt, dx, dy) : (((dx + dy) % 2 === 0) ? 'horizontal' : 'vertical'),
        laneOffset: flowProfile.laneOffset,
        branchLane: flowProfile.branchLane,
        macroRole: flowProfile.macroRole,
        poiId: flowProfile.poiId,
        poiApproachId: flowProfile.poiApproachId,
        poiTemplatePoolIds: flowProfile.poiTemplatePoolIds,
        poiRewardCategory: flowProfile.poiRewardCategory,
        poiMiniBossId: flowProfile.poiMiniBossId,
        sightlineCue: flowProfile.sightlineCue,
        waterFeature: flowProfile.waterFeature,
        restBeat: flowProfile.restBeat,
        isCrossroadsHub: flowProfile.isCrossroadsHub,
        isCitySeam: flowProfile.isCitySeam,
        transitionEdges: {},
        roads: [],
        connections: [],
      });
    }
  }
  
  // Build authored road connections between adjacent macro-cells.
  for (let dy = 0; dy < macroCellsY; dy++) {
    for (let dx = 0; dx < macroCellsX; dx++) {
      const idx = dy * macroCellsX + dx;
      const eastTarget = dx < macroCellsX - 1 ? idx + 1 : null;
      const southTarget = dy < macroCellsY - 1 ? idx + macroCellsX : null;
      const eastConn = eastTarget != null ? buildAuthoredMacroConnection(layout, grid[idx], grid[eastTarget], 'east', eastTarget) : null;
      const southConn = southTarget != null ? buildAuthoredMacroConnection(layout, grid[idx], grid[southTarget], 'south', southTarget) : null;
      if (eastConn) grid[idx].connections.push(eastConn);
      if (southConn) grid[idx].connections.push(southConn);
    }
  }

  for (let dy = 0; dy < macroCellsY; dy++) {
    for (let dx = 0; dx < macroCellsX; dx++) {
      const cell = grid[dy * macroCellsX + dx];
      const east = dx < macroCellsX - 1 ? grid[dy * macroCellsX + dx + 1] : null;
      const south = dy < macroCellsY - 1 ? grid[(dy + 1) * macroCellsX + dx] : null;
      const eastBand = buildTransitionEdge(cell, east, 'east');
      const southBand = buildTransitionEdge(cell, south, 'south');
      if (eastBand) {
        cell.transitionEdges.east = eastBand;
        east.transitionEdges.west = buildTransitionEdge(east, cell, 'west');
      }
      if (southBand) {
        cell.transitionEdges.south = southBand;
        south.transitionEdges.north = buildTransitionEdge(south, cell, 'north');
      }
    }
  }
  
  return { grid, macroCellsX, macroCellsY };
}

// Generate road network connecting district centers
export function generateRoadNetwork(districtGrid, macroCellsX, macroCellsY, seed) {
  const roads = [];
  
  for (let idx = 0; idx < districtGrid.length; idx++) {
    const cell = districtGrid[idx];
    
    for (const conn of cell.connections) {
      const target = districtGrid[conn.target];
      const roadType = chooseRoadType(cell.district, target.district, cell.biome, target.biome);
      const path = traceRoadPath(cell.centerX, cell.centerY, target.centerX, target.centerY, roadType, seed);
      
      roads.push({
        from: { x: cell.centerX, y: cell.centerY },
        to: { x: target.centerX, y: target.centerY },
        type: roadType,
        path, // array of { x, y, type: 'road'|'bridge'|'tunnel' }
        districtA: cell.district.id,
        districtB: target.district.id,
        districtFamilyA: cell.districtFamily,
        districtFamilyB: target.districtFamily,
        routeKind: conn.routeKind ?? (conn.dir === 'east' ? 'belt-spine' : 'cross-belt-link'),
      });
    }
  }
  
  // Add authored local loops and side streets within districts.
  for (const cell of districtGrid) {
    if (cell.district.roadDensity > 0.3) {
      const familyRoads = generateFamilyRoutes(cell, seed);
      roads.push(...familyRoads);
    }
  }
  
  return roads;
}

// Trace a road between two points with biome-appropriate routing
function traceRoadPath(x1, y1, x2, y2, roadType, seed) {
  const path = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  
  if (steps === 0) return [{ x: x1, y: y1, type: 'road' }];
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const tx = Math.round(x1 + (x2 - x1) * t);
    const ty = Math.round(y1 + (y2 - y1) * t);
    
    const biome = biomeAtImpl(seed, tx, ty);
    const isWater = biome === 'water';
    
    if (isWater) {
      path.push({ x: tx, y: ty, type: 'bridge', biome });
    } else {
      path.push({ x: tx, y: ty, type: 'road', biome });
    }
  }
  
  return path;
}

// Choose road type based on district importance and biome
function chooseRoadType(districtA, districtB, biomeA, biomeB) {
  if (biomeA === 'water' || biomeB === 'water') return ROAD_TYPES.BOARDWALK;
  if (biomeA === 'forest' || biomeB === 'forest') return ROAD_TYPES.FOREST_TRAIL;

  const authoredRoadTypeA = roadTypeFromKey(districtA?.roadTypeKey);
  const authoredRoadTypeB = roadTypeFromKey(districtB?.roadTypeKey);
  if (authoredRoadTypeA?.id === ROAD_TYPES.MAIN_STREET.id || authoredRoadTypeB?.id === ROAD_TYPES.MAIN_STREET.id) return ROAD_TYPES.MAIN_STREET;
  if (authoredRoadTypeA?.id === ROAD_TYPES.DIRT_PATH.id || authoredRoadTypeB?.id === ROAD_TYPES.DIRT_PATH.id || biomeA === 'sand' || biomeB === 'sand') return ROAD_TYPES.DIRT_PATH;
  if (authoredRoadTypeA?.id === ROAD_TYPES.ALLEY.id || authoredRoadTypeB?.id === ROAD_TYPES.ALLEY.id) return ROAD_TYPES.ALLEY;
  if (authoredRoadTypeA?.id === ROAD_TYPES.SIDE_STREET.id || authoredRoadTypeB?.id === ROAD_TYPES.SIDE_STREET.id) return ROAD_TYPES.SIDE_STREET;

  // districtA and districtB are the chosen district objects, compare by id
  const isDowntown = (districtA.id === 'downtown' || districtB.id === 'downtown');
  const isIndustrial = (districtA.id === 'industrial' || districtB.id === 'industrial');
  if (isDowntown || isIndustrial) return ROAD_TYPES.MAIN_STREET;
  return ROAD_TYPES.SIDE_STREET;
}

function localRoad(cell, from, to, type, seed, routeKind = 'local-route') {
  const start = { x: cell.centerX + from.x, y: cell.centerY + from.y };
  const end = { x: cell.centerX + to.x, y: cell.centerY + to.y };
  return {
    from: start,
    to: end,
    type,
    path: traceRoadPath(start.x, start.y, end.x, end.y, type, seed),
    districtA: cell.district.id,
    districtB: cell.district.id,
    districtFamilyA: cell.districtFamily,
    districtFamilyB: cell.districtFamily,
    routeKind,
  };
}

function rectangularLoop(cell, seed, type, insetX = SCENE_CELL, insetY = SCENE_CELL, routeKind = 'loop') {
  const half = Math.floor(DISTRICT_CELL * SCENE_CELL / 2);
  const left = -half + insetX;
  const right = half - insetX;
  const top = -half + insetY;
  const bottom = half - insetY;
  if (right <= left || bottom <= top) return [];
  return [
    localRoad(cell, { x: left, y: top }, { x: right, y: top }, type, seed, routeKind),
    localRoad(cell, { x: right, y: top }, { x: right, y: bottom }, type, seed, routeKind),
    localRoad(cell, { x: right, y: bottom }, { x: left, y: bottom }, type, seed, routeKind),
    localRoad(cell, { x: left, y: bottom }, { x: left, y: top }, type, seed, routeKind),
  ];
}

// Generate authored loops and side streets within a district macro-cell
function generateFamilyRoutes(cell, seed) {
  const half = Math.floor(DISTRICT_CELL * SCENE_CELL / 2);
  const mainType = roadTypeFromKey(cell.district.roadTypeKey);
  const horizontal = cell.pathOrientation !== 'vertical';

  if (cell.districtFamily === 'desert_approach') {
    return [
      localRoad(cell, { x: -half, y: 0 }, { x: half, y: 0 }, mainType, seed, 'desert-spine'),
      ...rectangularLoop(cell, seed, ROAD_TYPES.DIRT_PATH, SCENE_CELL + 3, SCENE_CELL + 5, 'salvage-loop'),
      localRoad(cell, { x: -Math.floor(half * 0.15), y: -half }, { x: -Math.floor(half * 0.15), y: Math.floor(half * 0.1) }, ROAD_TYPES.DIRT_PATH, seed, 'canyon-spoke'),
    ];
  }

  if (cell.districtFamily === 'ghost_town') {
    return [
      ...rectangularLoop(cell, seed, ROAD_TYPES.MAIN_STREET, SCENE_CELL, SCENE_CELL + 1, 'main-street-loop'),
      localRoad(cell, { x: -Math.floor(half * 0.25), y: -half }, { x: -Math.floor(half * 0.25), y: half }, ROAD_TYPES.ALLEY, seed, 'rear-alley'),
      localRoad(cell, { x: Math.floor(half * 0.25), y: -half }, { x: Math.floor(half * 0.25), y: half }, ROAD_TYPES.ALLEY, seed, 'rear-alley'),
    ];
  }

  if (cell.districtFamily === 'country_road') {
    const corridor = horizontal
      ? localRoad(cell, { x: -half, y: 0 }, { x: half, y: 0 }, mainType, seed, 'country-road-spine')
      : localRoad(cell, { x: 0, y: -half }, { x: 0, y: half }, mainType, seed, 'country-road-spine');
    const pullOffLoop = rectangularLoop(cell, seed, ROAD_TYPES.DIRT_PATH, SCENE_CELL + 3, SCENE_CELL + 5, 'pull-off-loop');
    const spur = horizontal
      ? localRoad(cell, { x: Math.floor(half * 0.35), y: 0 }, { x: Math.floor(half * 0.35), y: -half }, ROAD_TYPES.SIDE_STREET, seed, 'rest-stop-spur')
      : localRoad(cell, { x: 0, y: Math.floor(half * 0.35) }, { x: -half, y: Math.floor(half * 0.35) }, ROAD_TYPES.SIDE_STREET, seed, 'rest-stop-spur');
    return [corridor, ...pullOffLoop, spur];
  }

  if (cell.districtFamily === 'residential_edge') {
    return [
      ...rectangularLoop(cell, seed, ROAD_TYPES.SIDE_STREET, SCENE_CELL, SCENE_CELL + 1, 'neighborhood-loop'),
      ...rectangularLoop(cell, seed, ROAD_TYPES.DIRT_PATH, SCENE_CELL + 4, SCENE_CELL + 4, 'pocket-park-loop'),
      localRoad(cell, { x: -half, y: 0 }, { x: half, y: 0 }, ROAD_TYPES.SIDE_STREET, seed, 'sidewalk-spine'),
      localRoad(cell, { x: 0, y: -half }, { x: 0, y: half }, ROAD_TYPES.DIRT_PATH, seed, 'driveway-connector'),
    ];
  }

  if (cell.districtFamily === 'inner_city') {
    return [
      ...rectangularLoop(cell, seed, ROAD_TYPES.MAIN_STREET, SCENE_CELL, SCENE_CELL, 'block-ring'),
      ...rectangularLoop(cell, seed, ROAD_TYPES.ALLEY, SCENE_CELL + 4, SCENE_CELL + 4, 'service-ring'),
      localRoad(cell, { x: -half, y: 0 }, { x: half, y: 0 }, ROAD_TYPES.MAIN_STREET, seed, 'avenue-spine'),
      localRoad(cell, { x: 0, y: -half }, { x: 0, y: half }, ROAD_TYPES.MAIN_STREET, seed, 'avenue-spine'),
    ];
  }

  const roads = [];
  for (let i = -2; i <= 2; i += 2) {
    if (hashU32(seed, cell.dx * 10 + i, cell.dy) / 4294967296 < cell.district.roadDensity * 0.5) {
      roads.push(localRoad(cell, { x: -half, y: i * SCENE_CELL }, { x: half, y: i * SCENE_CELL }, ROAD_TYPES.SIDE_STREET, seed, 'side-street'));
    }
    if (hashU32(seed, cell.dy * 10 + i, cell.dx) / 4294967296 < cell.district.roadDensity * 0.5) {
      roads.push(localRoad(cell, { x: i * SCENE_CELL, y: -half }, { x: i * SCENE_CELL, y: half }, ROAD_TYPES.SIDE_STREET, seed, 'side-street'));
    }
  }
  return roads;
}

// Biome transition zones: generate blending tiles at biome boundaries
export function generateTransitionZones(roads, seed) {
  const transitions = [];
  for (const road of roads) {
    const path = Array.isArray(road.path) ? road.path : [];
    for (const pt of path) {
      const biome = pt && pt.biome;
      if (!biome || biome === 'water') continue;
      if (pt.type !== 'road' && pt.type !== 'bridge') continue;
      try {
        const neighbors = getNeighborBiomes(pt.x, pt.y, seed);
        if (neighbors.size > 1) {
          transitions.push({
            x: pt.x, y: pt.y,
            biomes: Array.from(neighbors),
            tileKey: getTransitionTileKey(neighbors),
          });
        }
      } catch (error) {
        // Skip transition lookup when biome sampling is unavailable for this point
      }
    }
  }
  return transitions;
}

function getNeighborBiomes(x, y, seed) {
  const biomes = new Set();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const b = biomeAtImpl(seed, x + dx, y + dy);
      biomes.add(b);
    }
  }
  return biomes;
}

function getTransitionTileKey(biomeSet) {
  const biomes = Array.from(biomeSet).sort();
  return `transition-${biomes.join('-')}`;
}

// Helper functions
function hashU32(a, b) {
  let h = (a | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (b | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Building interior room layout generator
export function generateInteriorLayout(buildingType, seed, options = {}) {
  const { width = 7, height = 5, entranceSide = 'south' } = options;
  const templateMap = {
    office_interior: { rooms: ['reception', 'cubicles', 'conference', 'breakroom'], corridor: 'central' },
    diner_interior: { rooms: ['dining', 'kitchen', 'counter', 'storage'], corridor: 'linear' },
    grocery_interior: { rooms: ['entrance', 'aisles', 'produce', 'checkout', 'stockroom'], corridor: 'grid' },
    gym_interior: { rooms: ['reception', 'weights', 'cardio', 'lockers'], corridor: 'perimeter' },
  };
  
  const layout = templateMap[buildingType] || { rooms: ['main'], corridor: 'none' };
  const grid = Array(height).fill(null).map(() => Array(width).fill('empty'));
  
  // Generate room placement based on building type
  const rooms = generateRooms(grid, layout, seed);
  const corridors = generateCorridors(grid, layout, seed);
  const doors = placeDoors(grid, rooms, layout, entranceSide);
  
  return { grid, rooms, corridors, doors, buildingType };
}

function generateRooms(grid, layout, seed) {
  const h = grid.length, w = grid[0].length;
  const rooms = [];
  
  layout.rooms.forEach((room, i) => {
    const attempts = 10;
    for (let a = 0; a < attempts; a++) {
      const rw = Math.max(2, Math.floor(w / layout.rooms.length));
      const rh = Math.max(2, Math.floor(h / 2));
      const rx = Math.floor((hashU32(seed, i * 100, 0) / 4294967296) * (w - rw));
      const ry = Math.floor((hashU32(seed, 0, i * 100) / 4294967296) * (h - rh));
      
      let fits = true;
      for (let dy = 0; dy < rh && fits; dy++) {
        for (let dx = 0; dx < rw && fits; dx++) {
          if (grid[ry + dy] && grid[ry + dy][rx + dx] !== 'empty') fits = false;
        }
      }
      if (fits) {
        for (let dy = 0; dy < rh; dy++) {
          for (let dx = 0; dx < rw; dx++) {
            grid[ry + dy][rx + dx] = `room-${i}`;
          }
        }
        rooms.push({ id: i, name: layout.rooms[i], x: rx, y: ry, w: rw, h: rh });
        break;
      }
    }
  });
  return rooms;
}

function generateCorridors(grid, layout, seed) {
  if (layout.corridor === 'none') return [];
  const corridors = [];
  const h = grid.length, w = grid[0].length;
  
  // Simple corridor generation connecting room centers
  // (in reality would use proper pathfinding)
  return corridors;
}

function placeDoors(grid, rooms, layout, entranceSide) {
  const doors = [];
  // Place entrance on specified side
  // Place interior doors between connected rooms
  return doors;
}

// Export utilities for use in main.js
export { hashU32 };

// Research-backed power-up placement: tie upgrades to district identity
export function getPowerupRulesForDistrict(districtType) {
  const rules = {
    DOWNTOWN: { economy: 0.6, offense: 0.3, utility: 0.1 },
    COMMERCIAL: { economy: 0.7, utility: 0.2, defense: 0.1 },
    INDUSTRIAL: { offense: 0.5, throwable: 0.3, mobility: 0.2 },
    SUBURBAN: { defense: 0.4, mobility: 0.4, utility: 0.2 },
    RESIDENTIAL: { defense: 0.5, utility: 0.3, economy: 0.2 },
    CITY_PARK: { mobility: 0.6, defense: 0.3, status: 0.1 },
    FOREST_WILDERNESS: { mobility: 0.5, throwable: 0.3, control: 0.2 },
    BEACH_AREA: { mobility: 0.4, utility: 0.4, economy: 0.2 }
  };
  return rules[districtType] || { utility: 0.4, offense: 0.3, defense: 0.3 };
}

// District theme colors for visual distinction overlay (simple tint layer in renderer)
export const DISTRICT_THEME_COLORS = Object.freeze({
  DOWNTOWN: '#4a6fa5',      // cool blue
  SUBURBAN: '#5a8a5a',      // green
  INDUSTRIAL: '#8a6a4a',    // warm brown/orange
  COMMERCIAL: '#a56a8a',    // purple/magenta
  RESIDENTIAL: '#6a8a7a',   // teal-green
  CITY_PARK: '#4a8a6a',     // forest green
  FOREST_WILDERNESS: '#3a5a3a', // dark forest
  BEACH_AREA: '#d4b48a'     // sand/gold
});

export function getDistrictThemeColor(districtId) {
  return DISTRICT_THEME_COLORS[districtId.toUpperCase()] || '#ffffff';
}
