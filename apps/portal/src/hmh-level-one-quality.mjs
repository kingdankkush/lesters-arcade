export const HMH_LEVEL_ONE_QUALITY_STYLE = Object.freeze({
  id: 'level1-isometric-metal-slug-quality-v1',
  artDirection: 'Unified 2:1 isometric, Age of Empires II-inspired authored world density, Hades-inspired combat readability, Deep Rock Survivor-inspired swarm clarity, and Metal Slug-inspired chunky arcade impact with hand-painted materials, crisp outlines, and high-impact combat VFX.',
  camera: '2:1 isometric',
  referencePolicy: 'reference-only: Justin-provided Age of Empires II, Hades, Deep Rock Survivor, IMG_5849 macro map, and level.mp4 references guide composition, density, readability, palette discipline, and asset-production quality; do not ship or trace the reference files as runtime assets.',
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

export const HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS = Object.freeze([
  Object.freeze({
    id: 'aoe2-de-world-density',
    sourceFamily: 'Age of Empires II: Definitive Edition references',
    target: 'dense authored isometric worldbuilding with legible roads, bridge chokepoints, stone walls, farms, water edges, and repeated-but-varied town modules',
    translateIntoAssets: Object.freeze([
      'cobblestone and packed-dirt road sets with broken-edge variants',
      'farm rows, hay/wood clutter, fences, barn silhouettes, and yard props that form readable loops',
      'stone/brick walls, gates, towers, barricades, and bridge-side blockers with clear collision footprints',
      'water/shore/reed/rock transitions that make rivers and lake edges visible at gameplay zoom',
    ]),
    copyPolicy: 'reference-only: extract composition/material rules, never copy silhouettes, emblems, buildings, or map layouts',
  }),
  Object.freeze({
    id: 'hades-combat-readability',
    sourceFamily: 'Hades / Hades II references',
    target: 'hand-painted diorama contrast where the player, danger zones, pickups, and traversal lanes remain readable over ornate floor and wall detail',
    translateIntoAssets: Object.freeze([
      'telegraph-ready floor plates and decal masks that can glow without hiding bullets',
      'selective-outline props and actors with bright rim accents against darker terrain',
      'modular arena borders, gates, statues, and interactives that frame combat without filling the center lane',
      'color-keyed lighting pools: Litecoin cyan/gold for safe or reward cues, fiat green/magenta/orange for hazards',
    ]),
    copyPolicy: 'reference-only: use readability and lighting hierarchy, never copy iconography, characters, rooms, or VFX shapes',
  }),
  Object.freeze({
    id: 'deep-rock-survivor-swarm-readability',
    sourceFamily: 'Deep Rock Galactic: Survivor references',
    target: 'survival-game clarity under swarm pressure: large blockers, resource glows, enemy mass separation, and path pockets visible through dense action',
    translateIntoAssets: Object.freeze([
      'chunky crystal/ore/cactus/boulder blockers with strong silhouettes and collision-readable bases',
      'small resource/pickup glows that pop against muted terrain without becoming visual noise',
      'enemy-swarm negative-space rules that keep at least one readable escape lane around major blockers',
      'ground hue separation between safe lanes, hazard pools, collectible trails, and arena boundaries',
    ]),
    copyPolicy: 'reference-only: use survival readability lessons, never copy creatures, crystals, UI, or map layouts',
  }),
  Object.freeze({
    id: 'level-video-handpainted-town',
    sourceFamily: 'provided level.mp4 town/forest/water reference',
    target: 'hand-painted town density with soft grass-to-stone transitions, lived-in roofs, bridges, ruins, lamp posts, docks, and vertically stacked readable architecture',
    translateIntoAssets: Object.freeze([
      'warm timber/stone building kits with roof, stair, chimney, awning, barrel, and wagon variants',
      'soft grass, dirt, cobble, and moss transitions for paths that feel painted rather than tiled',
      'bridges, docks, lamp posts, stairs, ruins, and water-edge props that serve as route landmarks',
      'foreground/background layer hints so buildings frame lanes without hiding the hero',
    ]),
    copyPolicy: 'reference-only: use material density and layout grammar, never copy the source town assets or exact architecture',
  }),
]);

export const HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN = Object.freeze([
  Object.freeze({
    category: 'ground-textures',
    priority: 'P0',
    targetAssets: Object.freeze(['packed dirt', 'dusty sand', 'worn grass', 'mossy cobble', 'cracked asphalt', 'boss-yard scorched ground']),
    referenceTargets: Object.freeze(['aoe2-de-world-density', 'hades-combat-readability', 'level-video-handpainted-town']),
    toolchain: Object.freeze(['PixelLab', 'palette-quantize', 'selective-outline-normalize', 'alpha-clean', 'atlas-pack', 'contact-sheet-qc']),
    acceptance: Object.freeze(['original silhouettes only', '128x64 iso diamond or atlas-backed ground role', 'clear path-edge variants', 'low-noise center lanes', 'no baked reference emblems/text']),
  }),
  Object.freeze({
    category: 'roads-and-paths',
    priority: 'P0',
    targetAssets: Object.freeze(['broken highway lane', 'gas-station forecourt concrete', 'ghost-town main street cobble/dirt blend', 'farm road spur', 'bridge planks', 'extraction flare road']),
    referenceTargets: Object.freeze(['aoe2-de-world-density', 'level-video-handpainted-town', 'hades-combat-readability']),
    toolchain: Object.freeze(['PixelLab', 'palette-quantize', 'selective-outline-normalize', 'alpha-clean', 'atlas-pack', 'contact-sheet-qc']),
    acceptance: Object.freeze(['original silhouettes only', 'route direction readable in one screen', 'edge damage variants', 'combat center stays visually quiet', 'no baked reference emblems/text']),
  }),
  Object.freeze({
    category: 'water-and-shorelines',
    priority: 'P0',
    targetAssets: Object.freeze(['animated river strip', 'shore reeds', 'wash crossing water', 'lake/beach edge', 'rocky bank', 'dock/bridge support']),
    referenceTargets: Object.freeze(['aoe2-de-world-density', 'level-video-handpainted-town']),
    toolchain: Object.freeze(['PixelLab', 'palette-quantize', 'selective-outline-normalize', 'alpha-clean', 'atlas-pack', 'contact-sheet-qc']),
    acceptance: Object.freeze(['original silhouettes only', 'animated water has 4-8 loop frames', 'shore collision is visually obvious', 'water is non-solid unless metadata says bridge', 'no baked reference emblems/text']),
  }),
  Object.freeze({
    category: 'buildings-and-walls',
    priority: 'P1',
    targetAssets: Object.freeze(['gas-station canopy', 'saloon false front', 'farm barn/silo', 'stone/brick wall segments', 'boss-yard gate', 'Litecoin extraction arch']),
    referenceTargets: Object.freeze(['aoe2-de-world-density', 'hades-combat-readability', 'level-video-handpainted-town']),
    toolchain: Object.freeze(['PixelLab', 'palette-quantize', 'selective-outline-normalize', 'alpha-clean', 'atlas-pack', 'contact-sheet-qc']),
    acceptance: Object.freeze(['original silhouettes only', 'iso footprint and shadow metadata', 'readable collision base', 'top-left key light', 'no baked reference emblems/text']),
  }),
  Object.freeze({
    category: 'trees-rocks-and-natural-blockers',
    priority: 'P1',
    targetAssets: Object.freeze(['pine/oak clusters', 'dead trees', 'cactus walls', 'mesa boulders', 'river rocks', 'crystal/ore-like Litecoin blockers']),
    referenceTargets: Object.freeze(['aoe2-de-world-density', 'deep-rock-survivor-swarm-readability', 'level-video-handpainted-town']),
    toolchain: Object.freeze(['PixelLab', 'palette-quantize', 'selective-outline-normalize', 'alpha-clean', 'atlas-pack', 'contact-sheet-qc']),
    acceptance: Object.freeze(['original silhouettes only', 'strong silhouette at gameplay zoom', 'base footprint visible under foliage', 'variants form hard boundaries without prop soup', 'no baked reference emblems/text']),
  }),
  Object.freeze({
    category: 'combat-readable-props',
    priority: 'P1',
    targetAssets: Object.freeze(['destructible barrel', 'gas pump explosive', 'cache crate', 'warning sign', 'boss gate markers', 'pickup/resource glow decals']),
    referenceTargets: Object.freeze(['hades-combat-readability', 'deep-rock-survivor-swarm-readability']),
    toolchain: Object.freeze(['PixelLab', 'palette-quantize', 'selective-outline-normalize', 'alpha-clean', 'atlas-pack', 'contact-sheet-qc']),
    acceptance: Object.freeze(['original silhouettes only', 'interaction state variants', 'danger/reward color key', 'bullet-safe readability', 'no baked reference emblems/text']),
  }),
]);

export function buildLevelOneEnvironmentAssetPromptBrief({ category = 'ground-textures', districtFamily = 'desert_approach', assetRole = 'environment asset' } = {}) {
  const plan = HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN.find((item) => item.category === category) ?? HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN[0];
  const referenceNames = plan.referenceTargets
    .map((id) => HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS.find((target) => target.id === id)?.target)
    .filter(Boolean);
  return Object.freeze({
    styleId: HMH_LEVEL_ONE_QUALITY_STYLE.id,
    category: plan.category,
    districtFamily,
    assetRole,
    prompt: [
      'Hard Money Heroes / Lester\'s Arcade pixel art environment asset',
      'Age of Empires II-inspired authored world density',
      'Hades-inspired combat readability',
      'Deep Rock Survivor-inspired swarm readability',
      HMH_LEVEL_ONE_QUALITY_STYLE.id,
      `district family: ${districtFamily}`,
      `asset role: ${assetRole}`,
      `reference translation: ${referenceNames.join('; ')}`,
      '2:1 isometric game asset, top-left key light, selective dark navy outline, Litecoin cyan/gold hard-money accents vs toxic green/magenta fiat-corruption accents, transparent background, original silhouettes only, no copied reference buildings, no logos, no text, readable at gameplay zoom',
    ].join(', '),
    postProcess: Object.freeze(['palette-quantize', 'selective-outline-normalize', 'alpha-clean', 'atlas-pack', 'contact-sheet-qc']),
    acceptance: plan.acceptance,
  });
}

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
    referenceStyleTargets: Object.freeze(HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS.map((target) => target.id)),
    assetGenerationCategories: Object.freeze(HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN.map((item) => item.category)),
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
