export const HMH_LEVEL_ONE_QUALITY_STYLE = Object.freeze({
  id: 'level1-isometric-metal-slug-quality-v1',
  artDirection: 'Unified 2:1 isometric, Metal Slug-inspired arcade polish with chunky readable silhouettes, hand-painted materials, crisp outlines, and high-impact combat VFX.',
  camera: '2:1 isometric',
  referencePolicy: 'reference-only: IMG_5849 macro map and level.mp4 density/style guide future art, layout, and encounter quality; do not ship the reference files as runtime assets.',
  prioritySystems: Object.freeze([
    'map-design',
    'pathing',
    'encounter-pacing',
    'enemy-readability',
    'combat-feel',
    'xp-balance',
    'high-quality-sprites-and-vfx',
  ]),
  materialRules: Object.freeze([
    'Every biome needs a distinct ground material and edge language, not random prop scatter.',
    'Roads, bridges, town streets, and cave mouths must create visible combat lanes before dressing appears.',
    'Sprites, props, muzzle flashes, blood/gore, and ambient loops should share heavy arcade outlines and warm/cool shadow ramps.',
  ]),
});

export const HMH_LEVEL_ONE_REFERENCE_MAP_ANCHORS = Object.freeze([
  Object.freeze({
    id: 'forest-mini-boss-park',
    districtFamily: 'country_road',
    biomeTags: Object.freeze(['forest', 'park', 'mini-boss']),
    pathingCue: 'tree walls frame a readable clearing with one main trail and two flanking shoulder loops',
    materials: Object.freeze(['pine canopy', 'leaf litter', 'fallen logs', 'dust motes']),
    templateIds: Object.freeze(['level1_quality_forest_clearing', 'crypto_dry_forest_cave', 'crypto_forest_greenbelt']),
    preferredTemplateIds: Object.freeze(['level1_quality_forest_clearing']),
  }),
  Object.freeze({
    id: 'main-town-road-loop',
    districtFamily: 'ghost_town',
    biomeTags: Object.freeze(['town', 'ghost-town', 'main-road']),
    pathingCue: 'false-front buildings and wagon cover create a broad main-street duel lane with alley breaks',
    materials: Object.freeze(['weathered timber', 'dusty road', 'boarded storefronts', 'smoke wisps']),
    templateIds: Object.freeze(['level1_quality_ghost_mainstreet_duel', 'crypto_ghost_saloon_square', 'crypto_rugpull_gulch']),
    preferredTemplateIds: Object.freeze(['level1_quality_ghost_mainstreet_duel']),
  }),
  Object.freeze({
    id: 'animated-lake-beach',
    districtFamily: 'residential_edge',
    biomeTags: Object.freeze(['waterfront', 'lake', 'beach']),
    pathingCue: 'beach road bends around animated water with a safe shoreline loop and visible cover gaps',
    materials: Object.freeze(['animated water', 'sand edge', 'wet reeds', 'wood planks']),
    templateIds: Object.freeze(['level1_quality_waterfront_beach_lake', 'sketch_animated_lake_shore', 'beach_boardwalk']),
    preferredTemplateIds: Object.freeze(['level1_quality_waterfront_beach_lake']),
  }),
  Object.freeze({
    id: 'river-bridge-chain',
    districtFamily: 'country_road',
    biomeTags: Object.freeze(['river', 'bridge', 'waterfront']),
    pathingCue: 'bridge chain creates hard chokepoints with open banks for grenade arcs and flank pressure',
    materials: Object.freeze(['animated water', 'bridge planks', 'muddy banks', 'spray highlights']),
    templateIds: Object.freeze(['level1_quality_river_bridge_chain', 'sketch_animated_river_bridge', 'river_crossing']),
    preferredTemplateIds: Object.freeze(['level1_quality_river_bridge_chain']),
  }),
  Object.freeze({
    id: 'desert-boulder-road',
    districtFamily: 'desert_approach',
    biomeTags: Object.freeze(['desert', 'boulder', 'canyon']),
    pathingCue: 'boulder and cliff silhouettes form switchbacks while keeping the center road readable',
    materials: Object.freeze(['hot sand', 'cactus', 'rock cliff', 'dust devil']),
    templateIds: Object.freeze(['level1_quality_desert_boulder_switchback', 'crypto_desert_salvage_basin', 'crypto_canyon_pass']),
    preferredTemplateIds: Object.freeze(['level1_quality_desert_boulder_switchback']),
  }),
  Object.freeze({
    id: 'second-town-farm-spur',
    districtFamily: 'residential_edge',
    biomeTags: Object.freeze(['farm', 'town', 'road-spur']),
    pathingCue: 'farm road spur and second-town blocks create a calmer recovery lane before the inner-city threshold',
    materials: Object.freeze(['farm dirt', 'hedges', 'fence lines', 'warm window glow']),
    templateIds: Object.freeze(['level1_quality_farm_town_spur', 'crypto_residential_culdesac', 'crypto_country_bus_turnout']),
    preferredTemplateIds: Object.freeze(['level1_quality_farm_town_spur']),
  }),
]);

const FAMILY_FALLBACKS = Object.freeze({
  desert_approach: Object.freeze(['desert-boulder-road']),
  ghost_town: Object.freeze(['main-town-road-loop']),
  country_road: Object.freeze(['forest-mini-boss-park', 'river-bridge-chain']),
  residential_edge: Object.freeze(['animated-lake-beach', 'second-town-farm-spur']),
  inner_city: Object.freeze(['main-town-road-loop', 'second-town-farm-spur']),
});

function normalizeFamily(value) {
  return String(value ?? '').replace(/-/g, '_');
}

export function levelOneQualityContextForDistrictCell(districtCell = {}, localSceneCellX = 2, localSceneCellY = 2) {
  const districtFamily = normalizeFamily(districtCell.districtFamily ?? districtCell.districtId ?? districtCell.familyId);
  const anchorIds = FAMILY_FALLBACKS[districtFamily];
  if (!anchorIds) return null;

  const routeAligned = districtCell.pathOrientation === 'vertical'
    ? localSceneCellX === 2
    : localSceneCellY === 2;
  const anchors = HMH_LEVEL_ONE_REFERENCE_MAP_ANCHORS.filter((anchor) => anchorIds.includes(anchor.id));
  const templatePoolIds = [...new Set(anchors.flatMap((anchor) => [...anchor.templateIds]))];
  const preferredTemplateIds = [...new Set(anchors.flatMap((anchor) => [...anchor.preferredTemplateIds]))];
  const materials = [...new Set(anchors.flatMap((anchor) => [...anchor.materials]))];
  const pathingCues = anchors.map((anchor) => anchor.pathingCue);

  return Object.freeze({
    styleId: HMH_LEVEL_ONE_QUALITY_STYLE.id,
    artDirection: HMH_LEVEL_ONE_QUALITY_STYLE.artDirection,
    districtFamily,
    referenceAnchors: Object.freeze(anchors.map((anchor) => anchor.id)),
    biomeTags: Object.freeze([...new Set(anchors.flatMap((anchor) => [...anchor.biomeTags]))]),
    materialPalette: Object.freeze(materials),
    pathingCues: Object.freeze(pathingCues),
    templatePoolIds: Object.freeze(templatePoolIds),
    preferredTemplateIds: Object.freeze(preferredTemplateIds),
    routeReadability: routeAligned
      ? 'primary combat lane stays clear and high-contrast'
      : 'shoulder dressing frames optional flank loops without blocking traversal',
    compositionPatch: Object.freeze({
      materialReadability: 'bold silhouettes, clean lane edges, animated dust/smoke accents',
      stylePass: HMH_LEVEL_ONE_QUALITY_STYLE.id,
      combatLanePriority: routeAligned ? 'primary' : 'shoulder',
    }),
  });
}

export function buildLevelOneEncounterQualityProfile({ poiId = '', arenaLayout = '', districtId = '' } = {}) {
  const normalizedPoi = String(poiId).toLowerCase();
  const normalizedDistrict = normalizeFamily(districtId);
  const anchorFamily = normalizedPoi.includes('rugpull') || normalizedDistrict.includes('ghost')
    ? 'ghost_town'
    : normalizedPoi.includes('forest') || normalizedPoi.includes('cave')
      ? 'country_road'
      : normalizedPoi.includes('oasis') || normalizedPoi.includes('lake')
        ? 'residential_edge'
        : normalizedPoi.includes('mesa') || normalizedPoi.includes('hashrate')
          ? 'desert_approach'
          : normalizedDistrict || 'country_road';
  const anchorContext = levelOneQualityContextForDistrictCell({ districtFamily: anchorFamily, pathOrientation: 'horizontal' }, 2, 2);
  return Object.freeze({
    styleId: HMH_LEVEL_ONE_QUALITY_STYLE.id,
    poiId,
    arenaLayout,
    referenceAnchors: anchorContext?.referenceAnchors ?? Object.freeze([]),
    cameraReadability: 'lock arena around authored landmark, keep player lane clear',
    combatFeel: 'staged run-and-gun pressure with readable grenade arcs, recoil windows, and cover breaks',
    animationRequirements: Object.freeze(['idle', 'walk', 'attack-tell', 'attack', 'hit', 'death']),
    goreVfx: 'chunky arcade blood bursts, ground decals, and death pops that never hide bullets or player silhouettes',
    xpBalance: 'mini-boss and support packs should reward one deliberate level-up at most, not chain-level spikes',
    pathingReadability: anchorContext?.routeReadability ?? 'authored route remains visually readable',
  });
}
