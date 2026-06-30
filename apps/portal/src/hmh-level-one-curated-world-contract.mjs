import {
  HMH_CURATED_LEVEL_KIT,
  curatedLevelKitAssetByKey,
} from '../assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';

const LEVEL_1_ID = 'level-1-crypto-wasteland';

const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
const uniq = (items) => Object.freeze(Array.from(new Set(items.filter(Boolean))));

function assetRef(assetKey, use, zoneIds, notes = '') {
  const record = curatedLevelKitAssetByKey(assetKey);
  return Object.freeze({
    assetKey,
    use,
    category: record?.category ?? null,
    family: record?.family ?? null,
    zoneIds: Object.freeze(Array.isArray(zoneIds) ? zoneIds : [zoneIds]),
    notes,
  });
}

function zone(id, title, beat, order, xPct, yPct, assetKeys, data = {}) {
  return Object.freeze({
    id,
    title,
    beat,
    order,
    xPct,
    yPct,
    assetRefs: freeze(assetKeys.map(([key, use, notes = '']) => assetRef(key, use, id, notes))),
    ...data,
  });
}

const GLOBAL_ASSET_REFS = freeze([
  assetRef('curated-ground/dirt-tiles/00-00', 'terrain', ['global', 'spawn-broken-road'], 'base dirt terrain for readable combat lanes'),
  assetRef('curated-ground/sand-tiles/00-00', 'terrain', ['global', 'desert-bone-camp'], 'sand field tiles for the desert basin'),
  assetRef('curated-ground/grass-tiles/00-00', 'terrain', ['global', 'dead-forest-mushroom-grove'], 'grass/forest floor support'),
  assetRef('curated-ground/water-v01/00-02', 'water', ['global', 'shoreline-ford'], 'runtime-ready water cell from curated sheet'),
  assetRef('level-1/road/road1', 'route', ['global', 'spawn-broken-road', 'ghost-saloon-mainstreet'], 'main road sheet/source for authored spine'),
  assetRef('level-1/road/road2-ground', 'route', ['global', 'warehouse-gas-station-yard'], 'road-to-ground transition source'),
  assetRef('level-1/road/road4-grass', 'route', ['global', 'dead-forest-mushroom-grove'], 'road-to-grass route transition'),
  assetRef('level-1/prop/bus-stop-sign', 'dressing', ['global', 'ltc-road-extraction'], 'readable road/extraction signage'),
  assetRef('universal/hero/lit-commando', 'hero', ['global'], 'starter hero coverage from curated kit'),
  assetRef('universal/hero/lit-valkyrie', 'hero', ['global'], 'starter hero coverage from curated kit'),
]);

export const HMH_LEVEL_ONE_CURATED_BOUNDARIES = freeze([
  {
    id: 'west-tree-water-wall',
    side: 'west',
    blocksTraversal: true,
    materials: Object.freeze(['dense tree line', 'lake water edge', 'mushroom understory', 'boulders']),
    gameplayRead: 'The west edge reads as forest and water, so players understand the map boundary without invisible walls.',
    assetRefs: freeze([
      assetRef('level-1/flora/forest-00', 'boundary', 'west-tree-water-wall'),
      assetRef('level-1/flora/oak-tree', 'boundary', 'west-tree-water-wall'),
      assetRef('level-1/water/water-00', 'water', 'west-tree-water-wall'),
      assetRef('level-1/prop/black-mushrooms1-grass-shadow', 'dressing', 'west-tree-water-wall'),
      assetRef('level-1/prop/oval-rock1-grass-shadow', 'boundary', 'west-tree-water-wall'),
    ]),
  },
  {
    id: 'north-rock-ruin-ridge',
    side: 'north',
    blocksTraversal: true,
    materials: Object.freeze(['rock ridge', 'ruin caps', 'dragon bones', 'dry cliff dirt']),
    gameplayRead: 'The north border becomes a broken ridge that also silhouettes the boss-yard destination.',
    assetRefs: freeze([
      assetRef('curated-ground/rock-cliffs/01-00', 'terrain', 'north-rock-ruin-ridge'),
      assetRef('level-1/prop/blue-gray-ruins1', 'boundary', 'north-rock-ruin-ridge'),
      assetRef('level-1/prop/brown-ruins1', 'boundary', 'north-rock-ruin-ridge'),
      assetRef('level-1/prop/dragon-bones-full-ground-shadow', 'boundary', 'north-rock-ruin-ridge'),
      assetRef('level-1/prop/oval-rock3-ground-shadow', 'boundary', 'north-rock-ruin-ridge'),
    ]),
  },
  {
    id: 'east-town-building-wall',
    side: 'east',
    blocksTraversal: true,
    materials: Object.freeze(['warehouse facades', 'billboard frame', 'storefront edges', 'road barricade props']),
    gameplayRead: 'The east side reads as the final town/warehouse edge that funnels toward extraction after the boss.',
    assetRefs: freeze([
      assetRef('level-1/building/industrial-warehouse-facade', 'boundary', 'east-town-building-wall'),
      assetRef('level-1/building/innercity-billboard-frame', 'boundary', 'east-town-building-wall'),
      assetRef('level-1/building/ghost-boarded-storefront', 'boundary', 'east-town-building-wall'),
      assetRef('level-1/building/wooden-crate', 'dressing', 'east-town-building-wall'),
      assetRef('level-1/prop/bus-stop-sign', 'dressing', 'east-town-building-wall'),
    ]),
  },
  {
    id: 'south-bone-desert-waterline',
    side: 'south',
    blocksTraversal: true,
    materials: Object.freeze(['desert bones', 'sand ruins', 'water debris', 'cactus and dry brush']),
    gameplayRead: 'The south edge feels like the badlands dropping into a dead shoreline, with bones and cactus as diegetic blockers.',
    assetRefs: freeze([
      assetRef('level-1/prop/dragon-bones-body-ground-shadow', 'boundary', 'south-bone-desert-waterline'),
      assetRef('level-1/prop/sand-ruins1', 'boundary', 'south-bone-desert-waterline'),
      assetRef('level-1/water-seabed/anchor-shadow1', 'dressing', 'south-bone-desert-waterline'),
      assetRef('curated-prop/cactus1-1', 'boundary', 'south-bone-desert-waterline'),
      assetRef('level-1/prop/desert-10', 'dressing', 'south-bone-desert-waterline'),
    ]),
  },
]);

export const HMH_LEVEL_ONE_CURATED_ROUTE = freeze([
  zone('spawn-broken-road', 'Broken Road Spawn', 'safe-spawn', 0, 8, 68, [
    ['level-1/road/road1-ground', 'route', 'clear road under player start'],
    ['curated-ground/dirt-tiles/00-01', 'terrain', 'quiet dirt for spawn readability'],
    ['level-1/prop/bus-stop-sign', 'dressing', 'first route signpost'],
    ['level-1/prop/desert-09', 'dressing', 'low-risk visual foreground'],
  ], {
    districtId: 'west-entry-road',
    objective: 'Orient player on a clear road with no enemies inside the first combat radius.',
    minClearRadiusTiles: 9,
  }),
  zone('ghost-saloon-mainstreet', 'Ghost Saloon Main Street', 'mini-boss-arena', 1, 22, 60, [
    ['level-1/building/ghost-saloon-front', 'landmark', 'primary town anchor'],
    ['level-1/building/ghost-boarded-storefront', 'landmark', 'false-front side pressure'],
    ['level-1/road/road2', 'route', 'main street route sheet'],
    ['level-1/building/wooden-crate', 'boundary', 'light cover clusters'],
    ['level-1/building/arcade-cabinet', 'dressing', 'Lester flavor inside saloon frontage'],
  ], {
    districtId: 'main-ghost-town',
    objective: 'First authored combat knot, teaching cover, street width, and optional mini-boss commitment.',
  }),
  zone('dead-forest-mushroom-grove', 'Dead Forest Mushroom Grove', 'mini-boss-arena', 2, 30, 32, [
    ['level-1/flora/broken-tree1', 'boundary', 'dead tree wall'],
    ['level-1/flora/burned-tree1', 'boundary', 'burned tree rhythm'],
    ['level-1/prop/black-mushrooms1-grass-shadow', 'dressing', 'mushroom grove identity'],
    ['level-1/prop/orange-mushrooms1-grass-shadow', 'dressing', 'color accent'],
    ['curated-ground/grass-tiles/00-01', 'terrain', 'forest floor'],
  ], {
    districtId: 'dead-forest-loop',
    objective: 'Optional loop with tighter lanes, readable tree boundaries, and ambush enemies.',
  }),
  zone('shoreline-ford', 'Shoreline Ford Crossing', 'chokepoint', 3, 42, 48, [
    ['level-1/water/water-00', 'water', 'main water tile'],
    ['level-1/water/water-01', 'water', 'water variation'],
    ['curated-ground/water-v01/00-03', 'water', 'runtime water cell'],
    ['level-1/water-seabed/anchor-shadow1', 'dressing', 'underwater debris'],
    ['level-1/water-seabed/crab-shadow1', 'dressing', 'small life/debris detail'],
    ['level-1/prop/water-ruins1', 'boundary', 'shoreline ruin blocker'],
  ], {
    districtId: 'central-water-crossing',
    objective: 'Narrow ford slows movement and creates a clear arena reset before the desert opens.',
  }),
  zone('desert-bone-camp', 'Desert Bone Camp', 'open-arena', 4, 56, 66, [
    ['curated-ground/sand-tiles/00-02', 'terrain', 'open sand arena floor'],
    ['level-1/prop/dragon-bones-full-ground-shadow', 'landmark', 'large bone landmark'],
    ['level-1/prop/desert-13', 'dressing', 'desert camp prop'],
    ['level-1/prop/desert-14', 'dressing', 'desert camp prop variation'],
    ['curated-prop/cactus2-1', 'boundary', 'cactus lane blocker'],
    ['level-1/prop/oval-rock2-ground-shadow', 'boundary', 'rock perimeter'],
  ], {
    districtId: 'desert-badlands',
    objective: 'Large negative-space arena where movement, shooting lines, and enemy silhouettes stay readable.',
  }),
  zone('warehouse-gas-station-yard', 'Warehouse / Gas Station Yard', 'mini-boss-arena', 5, 72, 55, [
    ['level-1/building/landmark-gas-station', 'landmark', 'gas station landmark'],
    ['level-1/building/industrial-warehouse-facade', 'landmark', 'warehouse wall anchor'],
    ['level-1/road/road3-ground', 'route', 'yard road strip'],
    ['level-1/building/soda-machine', 'dressing', 'small readable prop'],
    ['level-1/building/wooden-crate', 'boundary', 'breakable cover placeholder'],
    ['level-1/prop/bus-stop-sign', 'dressing', 'route sign'],
  ], {
    districtId: 'warehouse-yard',
    objective: 'Second major combat yard, wider than the saloon, staged for ranged enemies and tank pressure.',
  }),
  zone('rugpull-gulch-boss-yard', 'Rugpull Gulch Boss Yard', 'boss-arena', 6, 84, 42, [
    ['level-1/building/ghost-boarded-storefront', 'landmark', 'false-front boss backdrop'],
    ['level-1/building/innercity-billboard-frame', 'landmark', 'billboard readable from approach'],
    ['level-1/prop/brown-gray-ruins1', 'boundary', 'arena boundary ruin'],
    ['level-1/prop/blue-gray-ruins1', 'boundary', 'arena boundary ruin variation'],
    ['level-1/prop/dragon-bones-wing1-ground-shadow', 'boundary', 'bone boundary cap'],
    ['curated-ground/dirt-tiles-w-trans/00-00', 'terrain', 'boss yard dirt transition'],
  ], {
    districtId: 'rugpull-gulch',
    objective: 'Final Level 1 boss yard with clean read, hard perimeter, add lanes, and extraction reveal afterward.',
  }),
  zone('ltc-road-extraction', 'Litecoin Road Extraction', 'extraction', 7, 94, 62, [
    ['level-1/road/road5-ground', 'route', 'outbound extraction road'],
    ['level-1/building/innercity-billboard-frame', 'landmark', 'city-seam billboard'],
    ['level-1/prop/bus-stop-sign', 'dressing', 'explicit extraction sign'],
    ['curated-ground/dirt-tiles/00-03', 'terrain', 'clear extraction pad'],
    ['level-1/building/industrial-warehouse-facade', 'boundary', 'east wall behind extraction'],
  ], {
    districtId: 'east-extraction-road',
    objective: 'Readable exit zone after boss defeat, framed by the road and the Level 2 city seam without starting Level 2 work.',
  }),
]);

function poiFromRoute(routeZone, data) {
  return Object.freeze({
    id: routeZone.id,
    title: routeZone.title,
    districtId: routeZone.districtId,
    xPct: routeZone.xPct,
    yPct: routeZone.yPct,
    routeBeat: routeZone.beat,
    assetRefs: routeZone.assetRefs,
    ...data,
  });
}

export const HMH_LEVEL_ONE_CURATED_POIS = freeze([
  poiFromRoute(HMH_LEVEL_ONE_CURATED_ROUTE[1], {
    enemyFamilies: Object.freeze(['claim-jumper', 'scam-cult-zealot', 'paper-hand']),
    arena: Object.freeze({ kind: 'mini-boss-arena', shape: 'wide-mainstreet', minDiameterTiles: 20, negativeSpacePct: 34, cameraFraming: 'horizontal road spine with saloon/storefront silhouettes at top edge', boundaryAssetRoles: Object.freeze(['building-front', 'crate-cover', 'road-edge']) }),
    phasePlan: freeze([{ phase: 1, goal: 'clear side adds' }, { phase: 2, goal: 'punish sheriff reload tell' }]),
  }),
  poiFromRoute(HMH_LEVEL_ONE_CURATED_ROUTE[2], {
    enemyFamilies: Object.freeze(['wild-boar', 'coyote-pack-runner', 'scam-cult-zealot']),
    arena: Object.freeze({ kind: 'secondary-loop', shape: 'curved-forest-pocket', minDiameterTiles: 16, negativeSpacePct: 28, cameraFraming: 'tight mushroom grove with tree walls leaving a central dodge oval', boundaryAssetRoles: Object.freeze(['tree-wall', 'mushroom-dressing']) }),
    phasePlan: freeze([{ phase: 1, goal: 'bait boar charge through grove gap' }, { phase: 2, goal: 'survive ambush adds' }]),
  }),
  poiFromRoute(HMH_LEVEL_ONE_CURATED_ROUTE[3], {
    enemyFamilies: Object.freeze(['phishing-angler', 'gas-beast-tank', 'coyote-pack-runner']),
    arena: Object.freeze({ kind: 'chokepoint', shape: 'ford-crossing', minDiameterTiles: 18, negativeSpacePct: 31, cameraFraming: 'water ribbon and dry bank kept visible together', boundaryAssetRoles: Object.freeze(['water-edge', 'shoreline-ruin', 'seabed-dressing']) }),
    phasePlan: freeze([{ phase: 1, goal: 'cross ford under slow pressure' }, { phase: 2, goal: 'fight from dry bank' }]),
  }),
  poiFromRoute(HMH_LEVEL_ONE_CURATED_ROUTE[4], {
    enemyFamilies: Object.freeze(['coyote-pack-runner', 'wild-boar', 'evil-banker-ranged']),
    arena: Object.freeze({ kind: 'open-arena', shape: 'bone-camp-oval', minDiameterTiles: 24, negativeSpacePct: 48, cameraFraming: 'large sand oval with bone landmark on one edge and cactus blockers on two corners', boundaryAssetRoles: Object.freeze(['bone-wall', 'cactus', 'rock-perimeter']) }),
    phasePlan: freeze([{ phase: 1, goal: 'kite pack enemies across open sand' }, { phase: 2, goal: 'ranged enemy pressure enters from the camp edge' }]),
  }),
  poiFromRoute(HMH_LEVEL_ONE_CURATED_ROUTE[5], {
    enemyFamilies: Object.freeze(['gas-beast-tank', 'evil-banker-ranged', 'paper-hand']),
    arena: Object.freeze({ kind: 'mini-boss-arena', shape: 'yard-with-two-landmarks', minDiameterTiles: 22, negativeSpacePct: 36, cameraFraming: 'gas station left, warehouse top-right, road exit visible', boundaryAssetRoles: Object.freeze(['warehouse-wall', 'road-edge', 'crate-cover']) }),
    phasePlan: freeze([{ phase: 1, goal: 'clear ranged enemies from warehouse edge' }, { phase: 2, goal: 'tank pressure crosses yard' }]),
  }),
  poiFromRoute(HMH_LEVEL_ONE_CURATED_ROUTE[6], {
    enemyFamilies: Object.freeze(['claim-jumper', 'evil-banker-ranged', 'scam-cult-zealot', 'gas-beast-tank']),
    arena: Object.freeze({ kind: 'boss-arena', shape: 'ruined-town-yard', minDiameterTiles: 28, negativeSpacePct: 40, cameraFraming: 'boss centered with false-front backdrop, ruins/bones as perimeter not clutter', boundaryAssetRoles: Object.freeze(['ruin-cap', 'bone-cap', 'billboard-backdrop']) }),
    phasePlan: freeze([
      { phase: 1, goal: 'Claim-jumper sheriff tests cover and reload punish windows' },
      { phase: 2, goal: 'Scam cult adds enter from ruin side gates' },
      { phase: 3, goal: 'Gas-beast tank pressure forces the final loop before extraction unlocks' },
    ]),
  }),
  poiFromRoute(HMH_LEVEL_ONE_CURATED_ROUTE[7], {
    enemyFamilies: Object.freeze(['paper-hand']),
    arena: Object.freeze({ kind: 'extraction-zone', shape: 'road-pad', minDiameterTiles: 18, negativeSpacePct: 55, cameraFraming: 'empty road/pad after boss, city billboard and sign visible, no random clutter', boundaryAssetRoles: Object.freeze(['road-exit', 'building-wall', 'signpost']) }),
    phasePlan: freeze([{ phase: 1, goal: 'run to extraction after boss clear' }]),
  }),
]);

export const HMH_LEVEL_ONE_CURATED_MISSING_ASSET_REQUESTS = freeze([
  { id: 'road-to-town-transition-corners', priority: 'P0', title: 'Road-to-town transition corners', neededFor: ['spawn-broken-road', 'ghost-saloon-mainstreet', 'warehouse-gas-station-yard'], deliverables: Object.freeze(['4 road shoulder corners', '2 asphalt-to-dirt seams', '2 road-to-building curb caps']), generatedOnlyAfterLayoutLock: true },
  { id: 'shoreline-ford-edge-set', priority: 'P0', title: 'Shoreline ford edge set', neededFor: ['shoreline-ford'], deliverables: Object.freeze(['north bank', 'south bank', 'shallow ford center', 'dry stepping-stone edge', 'foam/ripple accent']), generatedOnlyAfterLayoutLock: true },
  { id: 'boss-yard-boundary-caps', priority: 'P0', title: 'Boss yard ruin/bone boundary caps', neededFor: ['rugpull-gulch-boss-yard'], deliverables: Object.freeze(['north ruin wall cap', 'east bone cap', 'west storefront edge', 'south road exit blocker']), generatedOnlyAfterLayoutLock: true },
  { id: 'saloon-cover-prop-set', priority: 'P1', title: 'Saloon cover prop set', neededFor: ['ghost-saloon-mainstreet'], deliverables: Object.freeze(['barrel cover', 'broken sign cover', 'porch posts', 'small dust decal']), generatedOnlyAfterLayoutLock: true },
  { id: 'desert-camp-connective-props', priority: 'P1', title: 'Desert camp connective props', neededFor: ['desert-bone-camp'], deliverables: Object.freeze(['campfire remains', 'mining tarp', 'loot crate silhouette', 'dust footprint decals']), generatedOnlyAfterLayoutLock: true },
  { id: 'extraction-pad-readability-kit', priority: 'P1', title: 'Extraction pad readability kit', neededFor: ['ltc-road-extraction'], deliverables: Object.freeze(['road flares', 'exit arrows', 'helicopter/car pad decal', 'post-boss clear banner prop']), generatedOnlyAfterLayoutLock: true },
]);

const combinedAssetRefs = uniq([
  ...GLOBAL_ASSET_REFS,
  ...HMH_LEVEL_ONE_CURATED_BOUNDARIES.flatMap((boundary) => boundary.assetRefs),
  ...HMH_LEVEL_ONE_CURATED_ROUTE.flatMap((route) => route.assetRefs),
].map((ref) => ref.assetKey)).map((key) => {
  const found = [
    ...GLOBAL_ASSET_REFS,
    ...HMH_LEVEL_ONE_CURATED_BOUNDARIES.flatMap((boundary) => boundary.assetRefs),
    ...HMH_LEVEL_ONE_CURATED_ROUTE.flatMap((route) => route.assetRefs),
  ].find((ref) => ref.assetKey === key);
  return found;
});

export const HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT = Object.freeze({
  id: 'level-1-curated-aaa-world-v1',
  levelId: LEVEL_1_ID,
  title: 'Level 1 - Crypto Wasteland Curated AAA World Contract',
  qualityBar: 'AAA-quality authored roguelike shooter world: readable route, diegetic boundaries, setpieces, arenas, boss yard, extraction, and negative-space combat composition.',
  assetSource: Object.freeze({
    manifestId: HMH_CURATED_LEVEL_KIT.id,
    sourceRoot: HMH_CURATED_LEVEL_KIT.sourceRoot,
    generatedRoot: HMH_CURATED_LEVEL_KIT.generatedRoot,
    policy: 'Use only Justin-curated Level 1 + Universal assets here; generate gap assets only after the layout is locked.',
  }),
  traversal: Object.freeze({
    boundaryPolicy: 'diegetic-blockers-only',
    mainRoute: Object.freeze({ minClearTiles: 5, targetClearTiles: 7, roadReadableFromCamera: true }),
    secondaryLoops: Object.freeze({ minClearTiles: 4, reconnectToMainRoute: true, optionalCommitTelegraphRequired: true }),
    arena: Object.freeze({ minDiameterTiles: 18, bossDiameterTiles: 28, negativeSpaceRequired: true }),
  }),
  boundaries: HMH_LEVEL_ONE_CURATED_BOUNDARIES,
  criticalPath: HMH_LEVEL_ONE_CURATED_ROUTE,
  pointsOfInterest: HMH_LEVEL_ONE_CURATED_POIS,
  assetRefs: Object.freeze(combinedAssetRefs),
  missingAssetRequests: HMH_LEVEL_ONE_CURATED_MISSING_ASSET_REQUESTS,
});

export function curatedLevelOneCriticalPath() {
  return HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.criticalPath;
}

export function curatedLevelOnePoiById(id) {
  return HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.pointsOfInterest.find((poi) => poi.id === id) ?? null;
}

export function curatedLevelOneAssetKeys() {
  return uniq(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.assetRefs.map((ref) => ref.assetKey));
}

export function curatedLevelOneMissingAssetRequests() {
  return HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.missingAssetRequests;
}

export function curatedLevelOneAssetRefsForZone(zoneId, { use = null, category = null } = {}) {
  const zoneRefs = [
    ...HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.assetRefs.filter((ref) => ref.zoneIds.includes(zoneId)),
    ...(curatedLevelOnePoiById(zoneId)?.assetRefs ?? []),
    ...(HMH_LEVEL_ONE_CURATED_BOUNDARIES.find((boundary) => boundary.id === zoneId)?.assetRefs ?? []),
  ];
  const unique = uniq(zoneRefs.map((ref) => ref.assetKey)).map((key) => zoneRefs.find((ref) => ref.assetKey === key));
  return Object.freeze(unique.filter((ref) => {
    if (use && ref.use !== use) return false;
    if (category && ref.category !== category && curatedLevelKitAssetByKey(ref.assetKey)?.category !== category) return false;
    return true;
  }));
}

export function validateCuratedLevelOneWorldContract() {
  const allRefs = [
    ...HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.assetRefs,
    ...HMH_LEVEL_ONE_CURATED_BOUNDARIES.flatMap((boundary) => boundary.assetRefs),
    ...HMH_LEVEL_ONE_CURATED_ROUTE.flatMap((route) => route.assetRefs),
  ];
  const missingAssetKeys = uniq(allRefs.filter((ref) => !curatedLevelKitAssetByKey(ref.assetKey)).map((ref) => ref.assetKey));
  return Object.freeze({
    valid: missingAssetKeys.length === 0,
    manifestId: HMH_CURATED_LEVEL_KIT.id,
    totalAssetRefs: allRefs.length,
    uniqueAssetKeys: curatedLevelOneAssetKeys().length,
    missingAssetKeys,
    missingFiles: Object.freeze([]),
  });
}
