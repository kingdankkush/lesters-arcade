import { HMH_LEVEL_ONE_WASTELAND_POIS } from './hmh-campaign-levels.mjs';
import {
  authoredCellToWorld,
  HMH_LEVEL_ONE_WORLD_V3,
  levelOneWorldV3CellAt,
} from './hmh-level-one-world-v3-runtime.mjs';

const CAMPAIGN_POI_BY_ID = new Map(HMH_LEVEL_ONE_WASTELAND_POIS.map((poi) => [poi.id, poi]));
const BLUEPRINT_POI_BY_ID = new Map(HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest.map((poi) => [poi.id, poi]));
const CAMPAIGN_TO_BLUEPRINT_POI = Object.freeze({
  'rugpull-gulch': 'ghost-saloon-square',
  'dry-forest-cave': 'dry-forest-cave',
  'old-hashrate-camp': 'old-hashrate-camp',
  'oasis-lakeside': 'oasis-lakeside',
  'mesa-overlook': 'mesa-overlook',
  'crossroads-trading-post': 'crossroads-trading-post',
});

const DISTRICT_BY_BIOME = Object.freeze({
  M: 'mesa-overlook',
  F: 'country-road',
  D: 'desert-approach',
  G: 'ghost-town',
  P: 'country-road',
  T: 'inner-city-threshold',
  A: 'residential-edge',
  L: 'oasis-lakeside',
  C: 'residential-edge',
  S: 'residential-edge',
});

function headingFor(dx, dy) {
  const horizontal = dx < -1 ? 'W' : dx > 1 ? 'E' : '';
  const vertical = dy < -1 ? 'N' : dy > 1 ? 'S' : '';
  return `${vertical}${horizontal}` || 'HERE';
}

function poiWorldRecord(campaignId) {
  const blueprintId = CAMPAIGN_TO_BLUEPRINT_POI[campaignId];
  const blueprint = BLUEPRINT_POI_BY_ID.get(blueprintId);
  const campaign = CAMPAIGN_POI_BY_ID.get(campaignId);
  if (!blueprint || !campaign) return null;
  const world = authoredCellToWorld(blueprint.x, blueprint.y);
  return Object.freeze({ campaign, blueprint, world });
}

export const HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS = Object.freeze(
  Object.keys(CAMPAIGN_TO_BLUEPRINT_POI).map(poiWorldRecord).filter(Boolean),
);

export function levelOneWorldV3DistrictContextAt(worldX = 0, worldY = 0) {
  const cell = levelOneWorldV3CellAt(worldX, worldY);
  const districtFamily = DISTRICT_BY_BIOME[cell.biome] ?? 'desert-approach';
  let poiId = null;
  let poiApproachId = null;
  let nearestDistance = Infinity;
  for (const entry of HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS) {
    const distance = Math.hypot(worldX - entry.world.x, worldY - entry.world.y);
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    if (distance <= entry.blueprint.arenaRadius + 1) {
      poiId = entry.campaign.id;
      poiApproachId = null;
    } else if (distance <= entry.blueprint.arenaRadius + 10) {
      poiId = null;
      poiApproachId = entry.campaign.id;
    } else {
      poiId = null;
      poiApproachId = null;
    }
  }
  return Object.freeze({
    districtFamily,
    biomeCode: cell.biome,
    terrainCode: cell.terrain,
    poiId,
    poiApproachId,
    macroRole: cell.route === 'M' ? 'critical-spine' : cell.route === '.' ? 'exploration' : 'authored-route',
    source: 'hmh-level-one-world-v3',
  });
}

export function levelOneWorldV3PoiDirectiveAt({ playerX = 0, playerY = 0, completedPoiIds = [] } = {}) {
  const completed = new Set(completedPoiIds);
  let chosen = null;
  for (const entry of HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS) {
    if (completed.has(entry.campaign.id)) continue;
    const dx = entry.world.x - playerX;
    const dy = entry.world.y - playerY;
    const distance = Math.hypot(dx, dy);
    if (distance > 24 || (chosen && distance >= chosen.distance)) continue;
    chosen = { ...entry, dx, dy, distance };
  }
  if (!chosen) return null;
  const arenaThreshold = chosen.blueprint.arenaRadius + 1;
  const approachThreshold = chosen.blueprint.arenaRadius + 10;
  const phaseHint = chosen.distance <= arenaThreshold
    ? 'poi-arena'
    : chosen.distance <= approachThreshold
      ? 'poi-approach'
      : 'poi-telegraph';
  const heading = headingFor(chosen.dx, chosen.dy);
  const distanceTiles = Number(chosen.distance.toFixed(1));
  return Object.freeze({
    id: chosen.campaign.id,
    blueprintPoiId: chosen.blueprint.id,
    title: chosen.campaign.title,
    districtId: chosen.campaign.districtId,
    lane: chosen.campaign.lane,
    phaseHint,
    telegraph: chosen.campaign.telegraph,
    riskRewardRead: chosen.campaign.riskRewardRead,
    rewardType: chosen.campaign.reward?.type ?? null,
    rewardExamples: chosen.campaign.reward?.examples ?? [],
    miniBossId: chosen.campaign.miniBoss?.id ?? null,
    miniBossTitle: chosen.campaign.miniBoss?.title ?? null,
    counterplay: chosen.campaign.miniBoss?.counterplay ?? null,
    worldX: chosen.world.x,
    worldY: chosen.world.y,
    heading,
    distanceTiles,
    label: `${chosen.campaign.title.toUpperCase()} · ${heading} ${Math.max(0, Math.round(distanceTiles))}T`,
    source: 'hmh-level-one-world-v3',
  });
}

export function levelOneWorldV3BossPoint() {
  return authoredCellToWorld(HMH_LEVEL_ONE_WORLD_V3.anchors.finalBoss.x, HMH_LEVEL_ONE_WORLD_V3.anchors.finalBoss.y);
}

export function levelOneWorldV3ExtractionPoint() {
  const world = authoredCellToWorld(HMH_LEVEL_ONE_WORLD_V3.anchors.extraction.x, HMH_LEVEL_ONE_WORLD_V3.anchors.extraction.y);
  return Object.freeze({
    levelId: HMH_LEVEL_ONE_WORLD_V3.levelId,
    districtFamily: 'inner-city-threshold',
    templateId: 'litecoin-extraction-beacon-pad',
    worldX: world.x,
    worldY: world.y,
    radiusTiles: 1.6,
    label: 'LITECOIN CITY ROAD OUT',
    detail: 'Reach the authored road-out beacon after clearing the Rugpull Gulch boss yard.',
    source: 'hmh-level-one-world-v3',
  });
}
