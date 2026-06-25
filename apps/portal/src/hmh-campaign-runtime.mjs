import {
  DISTRICT_CELL,
  generateDistrictGrid,
  generateRoadNetwork,
} from './district-generator.mjs';
import { SCENE_CELL } from './scene-templates.mjs';
import {
  buildHmhExtractionGuidance,
  getHmhCampaignLevel,
} from './hmh-campaign-levels.mjs';
import { buildEncounterVisualPlan } from './hmh-encounter-visuals.mjs';
import { buildLevelOneEncounterQualityProfile } from './hmh-level-one-quality.mjs';

const DEFAULT_LAYOUT = 'level1-authored';
const LEVEL_LAYOUTS = Object.freeze({
  'level-1-crypto-wasteland': 'level1-authored',
  'level-2-litecoin-city': 'level2-authored',
  'level-3-the-getaway': 'level3-authored',
});

const EXTRACTION_FAMILY_PRIORITY = Object.freeze({
  'level-1-crypto-wasteland': Object.freeze(['inner_city', 'residential_edge', 'country_road']),
  'level-2-litecoin-city': Object.freeze(['penthouse_rim', 'luxury_neighborhood', 'financial_core', 'outer_boulevard']),
  'level-3-the-getaway': Object.freeze(['finale_extraction', 'mainnet_express', 'skybridge_breakpoint', 'penthouse_launch_pad']),
});

const LEVEL_ONE_POI_ENCOUNTERS = Object.freeze({
  'rugpull-gulch': Object.freeze({
    arenaLayout: 'false-front-wagon-ring',
    miniBossEnemyId: 'claim-jumper-sheriff',
    supportEnemyIds: Object.freeze(['claim-jumper', 'scam-cult-zealot', 'rug-rat']),
    previewEnemyIds: Object.freeze(['claim-jumper', 'rug-rat']),
    spawnSlots: Object.freeze([
      Object.freeze({ enemyId: 'claim-jumper', role: 'support', angleDeg: 205, radiusTiles: 20.0, elite: true }),
      Object.freeze({ enemyId: 'scam-cult-zealot', role: 'support', angleDeg: 332, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'rug-rat', role: 'support', angleDeg: 98, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'claim-jumper-sheriff', role: 'mini-boss', angleDeg: 38, radiusTiles: 24.0, miniBoss: true, elite: true }),
    ]),
  }),
  'dry-forest-cave': Object.freeze({
    arenaLayout: 'cave-mouth-funnel',
    miniBossEnemyId: 'coyote-pack-runner',
    supportEnemyIds: Object.freeze(['fud-goblin-cave', 'wild-boar', 'coyote-pack-runner']),
    previewEnemyIds: Object.freeze(['fud-goblin-cave', 'wild-boar']),
    spawnSlots: Object.freeze([
      Object.freeze({ enemyId: 'fud-goblin-cave', role: 'support', angleDeg: 228, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'wild-boar', role: 'support', angleDeg: 308, radiusTiles: 20.0, elite: true }),
      Object.freeze({ enemyId: 'coyote-pack-runner', role: 'mini-boss', angleDeg: 28, radiusTiles: 24.0, miniBoss: true, elite: true }),
      Object.freeze({ enemyId: 'coyote-pack-runner', role: 'support', angleDeg: 140, radiusTiles: 20.0 }),
    ]),
  }),
  'litecoin-square-hub': Object.freeze({
    arenaLayout: 'urban-hub-ring',
    miniBossEnemyId: 'plaza-warden',
    supportEnemyIds: Object.freeze(['bitcoin-maximalist-riot-cop', 'dao-lobbyist', 'influencer-camera-drone']),
    previewEnemyIds: Object.freeze(['bitcoin-maximalist-riot-cop', 'dao-lobbyist']),
    spawnSlots: Object.freeze([
      Object.freeze({ enemyId: 'bitcoin-maximalist-riot-cop', role: 'support', angleDeg: 190, radiusTiles: 20.0, elite: true }),
      Object.freeze({ enemyId: 'dao-lobbyist', role: 'support', angleDeg: 320, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'influencer-camera-drone', role: 'support', angleDeg: 72, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'plaza-warden', role: 'mini-boss', angleDeg: 20, radiusTiles: 24.0, miniBoss: true, elite: true }),
    ]),
  }),
  'defi-harbor': Object.freeze({
    arenaLayout: 'waterfront-container-ring',
    miniBossEnemyId: 'bridge-exploiter',
    supportEnemyIds: Object.freeze(['nft-valet', 'stablecoin-socialite', 'chainlink-security-clerk']),
    previewEnemyIds: Object.freeze(['nft-valet', 'stablecoin-socialite']),
    spawnSlots: Object.freeze([
      Object.freeze({ enemyId: 'nft-valet', role: 'support', angleDeg: 214, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'stablecoin-socialite', role: 'support', angleDeg: 287, radiusTiles: 20.0, elite: true }),
      Object.freeze({ enemyId: 'chainlink-security-clerk', role: 'support', angleDeg: 48, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'bridge-exploiter', role: 'mini-boss', angleDeg: 352, radiusTiles: 24.0, miniBoss: true, elite: true }),
    ]),
  }),
  'financial-downtown': Object.freeze({
    arenaLayout: 'tower-plaza-pressure-ring',
    miniBossEnemyId: 'the-whale',
    supportEnemyIds: Object.freeze(['dao-lobbyist', 'bitcoin-maximalist-riot-cop', 'influencer-camera-drone']),
    previewEnemyIds: Object.freeze(['dao-lobbyist', 'bitcoin-maximalist-riot-cop']),
    spawnSlots: Object.freeze([
      Object.freeze({ enemyId: 'dao-lobbyist', role: 'support', angleDeg: 228, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'bitcoin-maximalist-riot-cop', role: 'support', angleDeg: 306, radiusTiles: 20.0, elite: true }),
      Object.freeze({ enemyId: 'influencer-camera-drone', role: 'support', angleDeg: 92, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'the-whale', role: 'mini-boss', angleDeg: 16, radiusTiles: 24.0, miniBoss: true, elite: true }),
    ]),
  }),
  'mimblewimble-grove': Object.freeze({
    arenaLayout: 'fog-maze-cloak-ring',
    miniBossEnemyId: 'the-obfuscator',
    supportEnemyIds: Object.freeze(['stablecoin-socialite', 'chainlink-security-clerk', 'nft-valet']),
    previewEnemyIds: Object.freeze(['stablecoin-socialite', 'chainlink-security-clerk']),
    spawnSlots: Object.freeze([
      Object.freeze({ enemyId: 'stablecoin-socialite', role: 'support', angleDeg: 196, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'chainlink-security-clerk', role: 'support', angleDeg: 286, radiusTiles: 20.0, elite: true }),
      Object.freeze({ enemyId: 'nft-valet', role: 'support', angleDeg: 56, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'the-obfuscator', role: 'mini-boss', angleDeg: 8, radiusTiles: 24.0, miniBoss: true, elite: true }),
    ]),
  }),
  'hashrate-district': Object.freeze({
    arenaLayout: 'rail-yard-overclock-ring',
    miniBossEnemyId: 'fifty-one-percent',
    supportEnemyIds: Object.freeze(['influencer-camera-drone', 'chainlink-security-clerk', 'bitcoin-maximalist-riot-cop']),
    previewEnemyIds: Object.freeze(['influencer-camera-drone', 'chainlink-security-clerk']),
    spawnSlots: Object.freeze([
      Object.freeze({ enemyId: 'influencer-camera-drone', role: 'support', angleDeg: 216, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'chainlink-security-clerk', role: 'support', angleDeg: 300, radiusTiles: 20.0, elite: true }),
      Object.freeze({ enemyId: 'bitcoin-maximalist-riot-cop', role: 'support', angleDeg: 72, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'fifty-one-percent', role: 'mini-boss', angleDeg: 24, radiusTiles: 24.0, miniBoss: true, elite: true }),
    ]),
  }),
  'old-hashrate-camp': Object.freeze({
    arenaLayout: 'salvage-laser-crossfire',
    miniBossEnemyId: 'sybil-drone',
    supportEnemyIds: Object.freeze(['sybil-drone', 'honeypot-turret', 'buzzard']),
    previewEnemyIds: Object.freeze(['sybil-drone', 'buzzard']),
  }),
  'oasis-lakeside': Object.freeze({
    arenaLayout: 'sandbar-ring',
    miniBossEnemyId: 'rattlesnake',
    supportEnemyIds: Object.freeze(['buzzard', 'gas-fee-wisp', 'rattlesnake']),
    previewEnemyIds: Object.freeze(['buzzard', 'gas-fee-wisp']),
    spawnSlots: Object.freeze([
      Object.freeze({ enemyId: 'buzzard', role: 'support', angleDeg: 208, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'gas-fee-wisp', role: 'support', angleDeg: 248, radiusTiles: 20.0 }),
      Object.freeze({ enemyId: 'gas-fee-wisp', role: 'support', angleDeg: 315, radiusTiles: 20.0, elite: true }),
      Object.freeze({ enemyId: 'rattlesnake', role: 'mini-boss', angleDeg: 58, radiusTiles: 24.0, miniBoss: true, elite: true }),
      Object.freeze({ enemyId: 'rattlesnake', role: 'support', angleDeg: 148, radiusTiles: 20.0 }),
    ]),
  }),
  'mesa-overlook': Object.freeze({
    arenaLayout: 'switchback-sniper-lane',
    miniBossEnemyId: 'ridge-raider',
    supportEnemyIds: Object.freeze(['claim-jumper', 'phishing-angler', 'rattlesnake']),
    previewEnemyIds: Object.freeze(['claim-jumper', 'rattlesnake']),
  }),
  'crossroads-trading-post': Object.freeze({
    arenaLayout: 'wagon-circle-crossfire',
    miniBossEnemyId: 'bandit-captain',
    supportEnemyIds: Object.freeze(['claim-jumper', 'honeypot-turret', 'wild-boar']),
    previewEnemyIds: Object.freeze(['claim-jumper', 'wild-boar']),
  }),
});

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fallbackPoiTitle(poiId) {
  return normalizeId(poiId)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getHmhCampaignLayout(levelId) {
  return LEVEL_LAYOUTS[levelId] ?? DEFAULT_LAYOUT;
}

export function buildCampaignWorldSetup({
  levelId,
  seed = 0,
  worldWidth = 2000,
  worldHeight = 2000,
} = {}) {
  const layout = getHmhCampaignLayout(levelId);
  const districtGrid = generateDistrictGrid(seed, worldWidth, worldHeight, { layout });
  const roadNetwork = generateRoadNetwork(districtGrid.grid, districtGrid.macroCellsX, districtGrid.macroCellsY, seed);
  return Object.freeze({
    levelId: getHmhCampaignLevel(levelId).id,
    layout,
    grid: districtGrid.grid,
    macroCellsX: districtGrid.macroCellsX,
    macroCellsY: districtGrid.macroCellsY,
    roadNetwork,
  });
}

function anchorWorldPoint(cell, anchor) {
  const baseX = cell.dx * DISTRICT_CELL * SCENE_CELL;
  const baseY = cell.dy * DISTRICT_CELL * SCENE_CELL;
  return {
    worldX: baseX + (anchor?.localX ?? 2) * SCENE_CELL + Math.floor(SCENE_CELL / 2),
    worldY: baseY + (anchor?.localY ?? 2) * SCENE_CELL + Math.floor(SCENE_CELL / 2),
  };
}

function clampPoint(point, worldWidth, worldHeight) {
  const maxX = Number.isFinite(worldWidth) && worldWidth > 0 ? worldWidth - 1 : point.worldX;
  const maxY = Number.isFinite(worldHeight) && worldHeight > 0 ? worldHeight - 1 : point.worldY;
  return {
    worldX: Math.max(0, Math.min(point.worldX, maxX)),
    worldY: Math.max(0, Math.min(point.worldY, maxY)),
  };
}

function projectPoint(point, { worldWidth = null, worldHeight = null, worldOffsetX = 0, worldOffsetY = 0 } = {}) {
  const clamped = clampPoint(point, worldWidth, worldHeight);
  return {
    worldX: clamped.worldX - worldOffsetX,
    worldY: clamped.worldY - worldOffsetY,
  };
}

function preferredExtractionAnchor(cell, levelId) {
  const anchors = Array.isArray(cell?.setPieceAnchors) ? cell.setPieceAnchors : [];
  const matcher = levelId === 'level-2-litecoin-city'
    ? /(vip|exit|gate|skybridge|plaza|penthouse)/i
    : levelId === 'level-3-the-getaway'
      ? /(vip|exit|gate|skybridge|roof|rail|penthouse|launch)/i
      : /(safehouse|checkpoint|gate|innercity|rest-stop|turnout)/i;
  return anchors.find((anchor) => matcher.test(`${anchor.id ?? ''} ${anchor.role ?? ''} ${anchor.templateId ?? ''}`))
    ?? anchors[0]
    ?? null;
}

function districtCellAtWorldPoint(worldX, worldY, districtGrid, macroCellsX, macroCellsY) {
  if (!Array.isArray(districtGrid) || !districtGrid.length || !macroCellsX) return null;
  const dx = Math.floor(worldX / (DISTRICT_CELL * SCENE_CELL));
  const dy = Math.floor(worldY / (DISTRICT_CELL * SCENE_CELL));
  if (dx < 0 || dy < 0 || dx >= macroCellsX || (macroCellsY != null && dy >= macroCellsY)) return null;
  return districtGrid[dy * macroCellsX + dx] ?? null;
}

function poiMetaIndex(level) {
  const pois = Array.isArray(level?.pois) ? level.pois : [];
  return new Map(pois.map((poi) => [normalizeId(poi.id), poi]));
}

function poiAnchorForCell(cell, poiMeta) {
  const anchors = Array.isArray(cell?.setPieceAnchors) ? cell.setPieceAnchors : [];
  const poiKey = normalizeId(poiMeta?.id ?? cell?.poiId ?? cell?.poiApproachId);
  return anchors.find((anchor) => normalizeId(`${anchor.id} ${anchor.role} ${anchor.templateId}`).includes(poiKey))
    ?? anchors[0]
    ?? {
      localX: cell?.landmarkAnchorCell?.localX ?? 2,
      localY: cell?.landmarkAnchorCell?.localY ?? 2,
      templateId: cell?.landmarkTemplateId ?? null,
    };
}

function buildPoiCandidates(level, districtGrid, completedPoiIds) {
  const metaById = poiMetaIndex(level);
  const completed = new Set((completedPoiIds ?? []).map((id) => normalizeId(id)));
  return districtGrid
    .filter((cell) => cell?.poiId)
    .map((cell) => {
      const poiMeta = metaById.get(normalizeId(cell.poiId));
      if (!poiMeta) return null;
      if (completed.has(normalizeId(poiMeta.id))) return null;
      return { cell, poiMeta };
    })
    .filter(Boolean);
}

function nearestCandidate(candidates, playerX, playerY, offsets) {
  if (!candidates.length) return null;
  return candidates
    .map((candidate) => {
      const point = projectPoint(anchorWorldPoint(candidate.cell, poiAnchorForCell(candidate.cell, candidate.poiMeta)), offsets);
      return {
        ...candidate,
        point,
        distance: Math.hypot(point.worldX - playerX, point.worldY - playerY),
      };
    })
    .sort((a, b) => a.distance - b.distance || a.point.worldX - b.point.worldX)[0] ?? null;
}

export function buildCampaignExtractionPoint({
  levelId,
  districtGrid = [],
  worldWidth = null,
  worldHeight = null,
  worldOffsetX = 0,
  worldOffsetY = 0,
} = {}) {
  const level = getHmhCampaignLevel(levelId);
  const priorities = EXTRACTION_FAMILY_PRIORITY[level.id] ?? [];
  const cell = priorities.map((familyId) => districtGrid.find((entry) => entry?.districtFamily === familyId)).find(Boolean)
    ?? districtGrid.reduce((best, entry) => {
      if (!entry) return best;
      if (!best) return entry;
      return entry.centerX > best.centerX ? entry : best;
    }, null);
  if (!cell) return null;

  const anchor = preferredExtractionAnchor(cell, level.id) ?? {
    localX: cell.landmarkAnchorCell?.localX ?? 2,
    localY: cell.landmarkAnchorCell?.localY ?? 2,
    templateId: cell.landmarkTemplateId ?? null,
  };
  const projected = projectPoint(anchorWorldPoint(cell, anchor), {
    worldWidth,
    worldHeight,
    worldOffsetX,
    worldOffsetY,
  });

  return Object.freeze({
    levelId: level.id,
    districtFamily: cell.districtFamily ?? null,
    templateId: anchor.templateId ?? cell.landmarkTemplateId ?? null,
    worldX: projected.worldX,
    worldY: projected.worldY,
    radiusTiles: level.id === 'level-2-litecoin-city' ? 1.35 : level.id === 'level-3-the-getaway' ? 1.4 : 1.15,
    label: level.id === 'level-2-litecoin-city' ? 'VIP EXIT' : level.id === 'level-3-the-getaway' ? 'MAINNET EXIT' : 'SAFEHOUSE',
    detail: level.id === 'level-2-litecoin-city'
      ? 'Reach the penthouse extraction lane.'
      : level.id === 'level-3-the-getaway'
        ? 'Reach the Mainnet Express escape route.'
        : 'Reach the safehouse and leave the wasteland alive.',
  });
}

export function buildCampaignPoiDirective({
  levelId,
  districtGrid = [],
  macroCellsX = null,
  macroCellsY = null,
  playerX = 0,
  playerY = 0,
  worldWidth = null,
  worldHeight = null,
  worldOffsetX = 0,
  worldOffsetY = 0,
  completedPoiIds = [],
} = {}) {
  const level = getHmhCampaignLevel(levelId);
  if (!Array.isArray(level?.pois) || !level.pois.length) return null;
  const candidates = buildPoiCandidates(level, districtGrid, completedPoiIds);
  if (!candidates.length) return null;

  const worldPlayerX = Number(playerX) + Number(worldOffsetX || 0);
  const worldPlayerY = Number(playerY) + Number(worldOffsetY || 0);
  const currentCell = districtCellAtWorldPoint(worldPlayerX, worldPlayerY, districtGrid, macroCellsX, macroCellsY);
  const currentFamily = normalizeId(currentCell?.districtFamily);
  const exactPoiId = normalizeId(currentCell?.poiId);
  const approachPoiId = normalizeId(currentCell?.poiApproachId);

  let chosen = null;
  let phaseHint = 'poi-telegraph';
  const offsets = { worldWidth, worldHeight, worldOffsetX, worldOffsetY };

  if (exactPoiId) {
    chosen = nearestCandidate(candidates.filter((candidate) => normalizeId(candidate.poiMeta.id) === exactPoiId), playerX, playerY, offsets);
    phaseHint = 'poi-arena';
  }
  if (!chosen && approachPoiId) {
    chosen = nearestCandidate(candidates.filter((candidate) => normalizeId(candidate.poiMeta.id) === approachPoiId), playerX, playerY, offsets);
    phaseHint = 'poi-approach';
  }
  if (!chosen && currentFamily) {
    chosen = nearestCandidate(candidates.filter((candidate) => normalizeId(candidate.poiMeta.districtId) === currentFamily), playerX, playerY, offsets);
    phaseHint = 'poi-telegraph';
  }
  if (!chosen) return null;

  const guidance = buildHmhExtractionGuidance({
    playerX,
    playerY,
    targetX: chosen.point.worldX,
    targetY: chosen.point.worldY,
  });

  return Object.freeze({
    id: chosen.poiMeta.id,
    title: chosen.poiMeta.title ?? fallbackPoiTitle(chosen.poiMeta.id),
    districtId: chosen.poiMeta.districtId,
    lane: chosen.poiMeta.lane,
    phaseHint,
    telegraph: chosen.poiMeta.telegraph,
    riskRewardRead: chosen.poiMeta.riskRewardRead,
    rewardType: chosen.poiMeta.reward?.type ?? null,
    rewardExamples: chosen.poiMeta.reward?.examples ?? [],
    miniBossId: chosen.poiMeta.miniBoss?.id ?? null,
    miniBossTitle: chosen.poiMeta.miniBoss?.title ?? null,
    counterplay: chosen.poiMeta.miniBoss?.counterplay ?? null,
    worldX: chosen.point.worldX,
    worldY: chosen.point.worldY,
    heading: guidance.heading,
    distanceTiles: guidance.distanceTiles,
    label: `${(chosen.poiMeta.title ?? fallbackPoiTitle(chosen.poiMeta.id)).toUpperCase()} · ${guidance.label}`,
  });
}

export function buildCampaignPoiEncounterProfile({ levelId, activePoi = null } = {}) {
  if (!activePoi) return null;
  const level = getHmhCampaignLevel(levelId);
  const poiKey = normalizeId(activePoi.id);
  const base = level.id === 'level-1-crypto-wasteland'
    ? LEVEL_ONE_POI_ENCOUNTERS[poiKey] ?? null
    : null;
  if (!base && !activePoi.miniBossId) return null;
  const spawnMode = activePoi.phaseHint === 'poi-arena'
    ? 'arena-lock'
    : activePoi.phaseHint === 'poi-approach'
      ? 'approach-skirmish'
      : 'telegraph-pack';
  const supportEnemyIds = [...(base?.supportEnemyIds ?? [])];
  const previewEnemyIds = [...(base?.previewEnemyIds ?? supportEnemyIds.slice(0, 2))];
  const arenaLayout = base?.arenaLayout ?? 'generic-poi-arena';
  const visualPlan = buildEncounterVisualPlan({ poiId: activePoi.id, arenaLayout });
  const encounterQuality = level.id === 'level-1-crypto-wasteland'
    ? buildLevelOneEncounterQualityProfile({ poiId: activePoi.id, arenaLayout, districtId: activePoi.districtId })
    : null;
  return Object.freeze({
    poiId: activePoi.id,
    title: activePoi.title ?? fallbackPoiTitle(activePoi.id),
    districtId: activePoi.districtId ?? null,
    phaseHint: activePoi.phaseHint ?? 'poi-telegraph',
    spawnMode,
    lockCamera: spawnMode === 'arena-lock',
    miniBossEnemyId: activePoi.miniBossId ?? base?.miniBossEnemyId ?? null,
    miniBossTitle: activePoi.miniBossTitle ?? activePoi.title ?? fallbackPoiTitle(activePoi.id),
    worldX: activePoi.worldX ?? null,
    worldY: activePoi.worldY ?? null,
    arenaLayout,
    visualPlan,
    qualityStyleId: encounterQuality?.styleId ?? null,
    encounterQuality,
    supportEnemyIds: Object.freeze(supportEnemyIds),
    previewEnemyIds: Object.freeze(previewEnemyIds),
    spawnSlots: Object.freeze([...(base?.spawnSlots ?? [])]),
    rewardType: activePoi.rewardType ?? null,
    counterplay: activePoi.counterplay ?? null,
  });
}

export function isCampaignExtractionReached({ playerX = 0, playerY = 0, extractionPoint = null } = {}) {
  if (!extractionPoint) return false;
  const dx = Number(playerX) - Number(extractionPoint.worldX ?? 0);
  const dy = Number(playerY) - Number(extractionPoint.worldY ?? 0);
  return Math.hypot(dx, dy) <= (extractionPoint.radiusTiles ?? 1.15);
}
