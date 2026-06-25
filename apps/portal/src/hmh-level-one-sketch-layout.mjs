// Justin sketch-derived Level 1 macro layout for Hard Money Heroes.
//
// The attached hand drawing is composition/reference only. Do not crop, ingest,
// manifest, or ship the drawing itself as runtime art. This module turns the
// sketch into repo-owned authored layout data: macro regions, roads, rivers,
// perimeter blockers, towns, farms, POIs, available asset keys, and new original
// pixel-art production requests.

const LEVEL_1_ID = 'level-1-crypto-wasteland';

const freezeArray = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
const uniq = (items) => Object.freeze(Array.from(new Set(items.filter(Boolean))));

const region = (id, title, x, y, w, h, data = {}) => Object.freeze({
  id,
  title,
  boundsPct: Object.freeze({ x, y, w, h }),
  ...data,
});

const node = (id, title, x, y, data = {}) => Object.freeze({ id, title, xPct: x, yPct: y, ...data });

const asset = (assetKey, role, layer, notes = '') => Object.freeze({ assetKey, role, layer, notes });

export const HMH_LEVEL_ONE_SKETCH_SOURCE = Object.freeze({
  levelId: LEVEL_1_ID,
  sourceKind: 'Justin hand-drawn layout sketch',
  sourceFileLabel: 'Desktop/IMG_5849.png',
  referencePolicy: 'Reference-only composition input; do not ship the drawing image as in-game art.',
  interpretation: 'Large bounded isometric map with forest/lake west, bridge-linked river spine, central hills/desert basin, north/northeast towns, and southeast farms/second town.',
});

export const HMH_LEVEL_ONE_SKETCH_REGIONS = freezeArray([
  region('west-forest-lake-belt', 'West Forest / Lake Boundary Belt', 0, 0, 26, 100, {
    biome: 'forest-water',
    districtFamily: 'country_road',
    macroRole: 'outer-boundary',
    boundaryLanguage: ['dense trees', 'lake beach', 'park/pond pocket', 'forest miniboss clearing'],
    gameplayRead: 'early green contrast and optional forest fight; tree wall keeps the map bounded.',
  }),
  region('north-rock-cliff-band', 'North Boulder / Rock / Cliff Boundary', 7, 0, 58, 11, {
    biome: 'rocky-hills',
    districtFamily: 'desert_approach',
    macroRole: 'hard-boundary',
    boundaryLanguage: ['boulders', 'rock shelves', 'cliff face', 'hills behind river'],
    gameplayRead: 'top edge is readable rock/cliff wall, not an invisible map edge.',
  }),
  region('central-river-bridge-spine', 'Central River + Bridge Spine', 31, 7, 44, 52, {
    biome: 'water-road',
    districtFamily: 'country_road',
    macroRole: 'hub-connector',
    boundaryLanguage: ['vertical river', 'horizontal river branch', 'three-plus bridges', 'banks/reeds'],
    gameplayRead: 'bridges are chokepoints and traversal anchors; river blocks direct cross-map wandering.',
  }),
  region('northeast-town-river-block', 'Town #3 / Northeast River Block', 64, 4, 35, 27, {
    biome: 'town-water',
    districtFamily: 'ghost_town',
    macroRole: 'town-hub',
    boundaryLanguage: ['town building fronts', 'asphalt roads', 'river bend', 'bridge exit'],
    gameplayRead: 'civilization appears before the desert opens; roads organize town edges and bridge approach.',
  }),
  region('main-town-west', 'Main Town / West Road Hub', 3, 50, 31, 28, {
    biome: 'town-road-water',
    districtFamily: 'ghost_town',
    macroRole: 'hub-spine',
    boundaryLanguage: ['main town blocks', 'road loop', 'animated water creek/lake outlet', 'beach seam'],
    gameplayRead: 'primary town hub with a miniboss fight, connected to lake/river and the long east road.',
  }),
  region('central-desert-hills', 'Central Desert and Hills Basin', 33, 29, 49, 55, {
    biome: 'desert-rocky',
    districtFamily: 'desert_approach',
    macroRole: 'main-spine',
    boundaryLanguage: ['sand basin', 'cactus clusters', 'hills', 'mesa/cliff elevation bands'],
    gameplayRead: 'wide combat readable desert with hills as soft/hard lane shapers, not random obstacle scatter.',
  }),
  region('southeast-farm-second-town', 'Southeast Farms and Second Town', 48, 61, 50, 35, {
    biome: 'farm-town-road',
    districtFamily: 'country_road',
    macroRole: 'shoulder-loop',
    boundaryLanguage: ['farm plots', 'farmhouse/barn zones', 'crop rows', 'second town road loop', 'town building edge'],
    gameplayRead: 'late Level 1 rural/town loop with farm assets, road bends, and second miniboss fight.',
  }),
  region('south-rock-tree-border', 'South Rock / Cliff / Tree Boundary', 24, 91, 50, 9, {
    biome: 'rocky-forest',
    districtFamily: 'desert_approach',
    macroRole: 'hard-boundary',
    boundaryLanguage: ['boulders', 'rock cliff', 'tree line'],
    gameplayRead: 'bottom map edge alternates cliff and tree blockers so the perimeter feels authored.',
  }),
  region('east-tree-town-building-wall', 'East Tree / Town Building Boundary', 86, 7, 12, 90, {
    biome: 'town-forest-edge',
    districtFamily: 'residential_edge',
    macroRole: 'hard-boundary',
    boundaryLanguage: ['trees', 'town building facades', 'road-adjacent building edge'],
    gameplayRead: 'right edge becomes a town/building wall with tree breaks instead of a rectangular invisible edge.',
  }),
]);

export const HMH_LEVEL_ONE_SKETCH_PERIMETER = freezeArray([
  { id: 'west-tree-wall', side: 'west', materials: ['dense tree wall', 'forest understory', 'lake beach seam'], existingAssets: ['crypto/forest-tree-line', 'nature/pine-tree', 'nature/oak-tree', 'crypto/shoreline-water-edge'], newAssetsNeeded: ['animated mixed tree wall variants', 'lake beach transition tiles'] },
  { id: 'north-boulder-rock-cliff', side: 'north', materials: ['boulder line', 'rock cliff', 'hill silhouettes'], existingAssets: ['nature/boulder', 'crypto/desert-boulder', 'crypto/canyon-cliff-edge'], newAssetsNeeded: ['multi-height cliff face set', 'hill/mountain parallax silhouettes'] },
  { id: 'east-town-tree-wall', side: 'east', materials: ['town building fronts', 'road edge buildings', 'tree breaks'], existingAssets: ['crypto/ghost-boarded-storefront', 'crypto/industrial-warehouse-facade', 'crypto/forest-tree-line'], newAssetsNeeded: ['modular town-building facade kit', 'corner storefronts', 'roofline edge pieces'] },
  { id: 'south-rock-tree-town-edge', side: 'south', materials: ['rock cliff', 'boulders', 'tree line', 'town-building edge'], existingAssets: ['crypto/canyon-cliff-edge', 'crypto/desert-boulder', 'crypto/forest-tree-line', 'crypto/ghost-saloon-front'], newAssetsNeeded: ['south-facing cliff caps', 'town-boundary facade row variants'] },
]);

export const HMH_LEVEL_ONE_SKETCH_WATERWAYS = freezeArray([
  {
    id: 'west-lake-beach-outlet',
    title: 'West Lake / Beach Outlet',
    waterType: 'lake-plus-beach',
    pathPct: Object.freeze([[0, 88], [8, 86], [18, 92], [25, 100]]),
    animationNeed: 'slow shoreline shimmer, lake ripple loop, beach foam at outlet',
    crossings: Object.freeze([]),
    existingAssets: Object.freeze(['crypto/shoreline-water-edge', 'construct/river-straight', 'construct/river-bend']),
  },
  {
    id: 'central-vertical-river',
    title: 'Central North-South River',
    waterType: 'running-river',
    pathPct: Object.freeze([[34, 0], [37, 18], [36, 36], [33, 56], [28, 74], [25, 100]]),
    animationNeed: 'directional river-flow frames plus bridge shadow overlays',
    crossings: Object.freeze(['north-forest-bridge', 'middle-road-bridge', 'south-main-town-bridge']),
    existingAssets: Object.freeze(['construct/river-straight', 'construct/river-bend', 'construct/wood-bridge']),
  },
  {
    id: 'east-west-river-branch',
    title: 'East-West River Branch',
    waterType: 'running-river',
    pathPct: Object.freeze([[36, 30], [50, 31], [63, 28], [76, 24], [90, 13]]),
    animationNeed: 'river bend/straight animation, shallow bank reeds, bridge wake',
    crossings: Object.freeze(['center-road-bridge', 'northeast-town-bridge']),
    existingAssets: Object.freeze(['construct/river-straight', 'construct/river-bend', 'construct/wood-bridge']),
  },
  {
    id: 'west-park-pond',
    title: 'West Park / Pond Pocket',
    waterType: 'pond',
    pathPct: Object.freeze([[12, 23], [18, 24], [21, 30], [14, 33]]),
    animationNeed: 'small pond idle ripple and reed edge variants',
    crossings: Object.freeze([]),
    existingAssets: Object.freeze(['construct/river-straight', 'crypto/shoreline-water-edge']),
  },
]);

export const HMH_LEVEL_ONE_SKETCH_ROAD_NETWORK = freezeArray([
  {
    id: 'west-main-town-to-central-bridge',
    roadType: 'asphalt-to-dirt-transition',
    nodes: Object.freeze(['main-town-square', 'lake-outlet-road-bend', 'south-main-town-bridge', 'central-desert-entry']),
    pathPct: Object.freeze([[3, 68], [14, 67], [24, 62], [31, 60], [38, 52]]),
    requiredGround: ['asphalt', 'road paint', 'dirt shoulder', 'bridge deck'],
  },
  {
    id: 'north-road-to-town-three',
    roadType: 'asphalt-town-road',
    nodes: Object.freeze(['center-road-bridge', 'north-river-road', 'town-three-square', 'northeast-town-bridge']),
    pathPct: Object.freeze([[42, 27], [54, 23], [65, 18], [78, 15], [88, 14]]),
    requiredGround: ['asphalt', 'lane paint', 'curbs', 'bridge deck'],
  },
  {
    id: 'southeast-farm-road-loop',
    roadType: 'farm-road-asphalt-spur',
    nodes: Object.freeze(['central-desert-entry', 'south-farm', 'farm-road-split', 'second-town-square', 'east-town-building-wall']),
    pathPct: Object.freeze([[38, 75], [52, 77], [66, 74], [78, 69], [90, 65], [96, 70]]),
    requiredGround: ['asphalt', 'dirt shoulder', 'painted road curve', 'farm driveway'],
  },
  {
    id: 'second-town-inner-loop',
    roadType: 'small-town-loop',
    nodes: Object.freeze(['second-town-square', 'second-town-miniboss-yard', 'farm-road-split']),
    pathPct: Object.freeze([[78, 69], [86, 72], [91, 78], [84, 82], [76, 79]]),
    requiredGround: ['asphalt loop', 'road paint', 'sidewalk/yard transition'],
  },
]);

export const HMH_LEVEL_ONE_SKETCH_TOWNS_AND_FARMS = freezeArray([
  { id: 'main-town-square', title: 'Main Town', type: 'town', xPct: 11, yPct: 64, role: 'west hub + miniboss fight', buildingLanguage: ['individual buildings', 'town edge fronts', 'road loop'], assetNeeds: ['town storefront set', 'modular building-front boundary', 'town road corners'] },
  { id: 'town-three-square', title: 'Town #3', type: 'town', xPct: 70, yPct: 11, role: 'northeast bridge town', buildingLanguage: ['small square buildings', 'road grid', 'river approach'], assetNeeds: ['small town house fronts', 'asphalt road paint', 'bridge approach pieces'] },
  { id: 'second-town-square', title: 'Second Town', type: 'town', xPct: 85, yPct: 74, role: 'southeast town + miniboss fight', buildingLanguage: ['town blocks', 'building wall boundary', 'farm road entry'], assetNeeds: ['second-town storefront variants', 'corner buildings', 'road loop/crossroad pieces'] },
  { id: 'south-farmstead', title: 'South Farm', type: 'farm', xPct: 58, yPct: 82, role: 'open rural combat lane', buildingLanguage: ['farm plot', 'barn/farmhouse', 'crop fields'], assetNeeds: ['barn', 'farmhouse', 'corn rows', 'fence lines', 'silo/well props'] },
  { id: 'east-farmstead', title: 'East Farm', type: 'farm', xPct: 88, yPct: 58, role: 'farm spur near second town', buildingLanguage: ['farm box', 'field edge', 'road driveway'], assetNeeds: ['crop rows', 'farm driveway', 'hay bales', 'tractor/irrigation prop'] },
]);

export const HMH_LEVEL_ONE_SKETCH_POIS = freezeArray([
  node('forest-miniboss-clearing', 'Forest Mini-Boss Fight', 11, 15, { biome: 'forest', encounterRole: 'optional-miniboss', setpiecePackIds: ['forest-trail-boundary'], telegraph: 'dense tree wall opens into a darker clearing with cave/old-tree silhouette' }),
  node('main-town-miniboss', 'Main Town Mini-Boss Fight', 12, 61, { biome: 'town', encounterRole: 'town-miniboss', setpiecePackIds: ['town-mainstreet-lived-in'], telegraph: 'town square/frontage and road loop before entering the fight' }),
  node('north-forest-bridge', 'North River Bridge', 38, 17, { biome: 'water', encounterRole: 'bridge-chokepoint', setpiecePackIds: ['creek-ford-crossing'], telegraph: 'river narrows and bridge shadow makes the crossing obvious' }),
  node('center-road-bridge', 'Center Road Bridge', 42, 31, { biome: 'water-road', encounterRole: 'bridge-chokepoint', setpiecePackIds: ['creek-ford-crossing'], telegraph: 'asphalt road visibly crosses the horizontal river branch' }),
  node('south-main-town-bridge', 'South Main Town Bridge', 34, 59, { biome: 'water-road', encounterRole: 'bridge-chokepoint', setpiecePackIds: ['creek-ford-crossing'], telegraph: 'town road bends into the river bridge before the desert basin' }),
  node('central-hills-overlook', 'Central Hills / Elevation Beat', 55, 50, { biome: 'desert-rocky', encounterRole: 'elevation-skirmish', setpiecePackIds: ['rock-wall-canyon-corridor', 'desert-wash-and-dunes'], telegraph: 'hill silhouettes and cliff shadows break the open desert' }),
  node('farm-ambush', 'Farmstead Ambush', 63, 80, { biome: 'farm', encounterRole: 'rural-ambush', setpiecePackIds: ['farmstead-crop-road'], telegraph: 'barn/crop/fence shapes show the farm before enemy aggro' }),
  node('second-town-miniboss', 'Second Town Mini-Boss Fight', 88, 80, { biome: 'town', encounterRole: 'town-miniboss', setpiecePackIds: ['town-mainstreet-lived-in', 'farmstead-crop-road'], telegraph: 'small-town buildings and road loop frame the arena' }),
]);

export const HMH_LEVEL_ONE_SKETCH_EXISTING_ASSET_COVERAGE = Object.freeze({
  boundary: freezeArray([
    asset('crypto/forest-tree-line', 'tree-wall', 'hard-boundary', 'best current tree-wall asset for west/east perimeter'),
    asset('nature/pine-tree', 'tree', 'soft-dressing', 'single trees inside forest/town edges'),
    asset('nature/oak-tree', 'tree', 'soft-dressing', 'single trees around towns/parks'),
    asset('nature/boulder', 'boulder', 'hard-boundary', 'generic boulder line'),
    asset('crypto/desert-boulder', 'boulder', 'hard-boundary', 'desert boulder boundary'),
    asset('crypto/canyon-cliff-edge', 'cliff', 'hard-boundary', 'current cliff proxy for north/south rock edges'),
    asset('crypto/shoreline-water-edge', 'shoreline', 'hard-boundary', 'lake/shore perimeter proxy'),
  ]),
  roads: freezeArray([
    asset('crypto/road-straight', 'road', 'route', 'current road segment'),
    asset('crypto/road-tjunction', 'road', 'route', 'current T junction'),
    asset('crypto/road-crossroad', 'road', 'route', 'current crossroad'),
    asset('crypto/road-cap-end', 'road', 'route', 'current dead-end cap'),
    asset('crypto/ground-dirt-asphalt-edge', 'transition', 'ground', 'dirt-to-asphalt transition'),
  ]),
  water: freezeArray([
    asset('construct/river-straight', 'water-strip', 'route-boundary', 'current river straight'),
    asset('construct/river-bend', 'water-strip', 'route-boundary', 'current river bend'),
    asset('construct/wood-bridge', 'bridge', 'route', 'current bridge crossing'),
    asset('crypto/shoreline-water-edge', 'shoreline', 'hard-boundary', 'current lake/river edge'),
  ]),
  town: freezeArray([
    asset('crypto/ghost-saloon-front', 'building', 'hard-boundary', 'town frontage proxy'),
    asset('crypto/ghost-boarded-storefront', 'building', 'hard-boundary', 'town frontage proxy'),
    asset('crypto/industrial-warehouse-facade', 'building', 'hard-boundary', 'larger town/warehouse frontage'),
    asset('crypto/utility-pole', 'pole', 'soft-dressing', 'road/town utility rhythm'),
    asset('street/street-lamp', 'lamp', 'soft-dressing', 'town road edge'),
    asset('street/trash-can', 'smallprop', 'soft-dressing', 'lived-in town detail'),
    asset('street/mailbox', 'smallprop', 'soft-dressing', 'residential/town road detail'),
  ]),
  farm: freezeArray([
    asset('construct/fence-segment', 'fence', 'hard-boundary', 'farm field/fence proxy'),
    asset('construct/fence-gate', 'fence', 'route', 'farm driveway gate proxy'),
    asset('construct/fence-post', 'fence', 'hard-boundary', 'field edge rhythm'),
    asset('interior/wooden-crate', 'crate', 'soft-dressing', 'farm crate proxy'),
    asset('interior/stacked-boxes', 'crate', 'soft-dressing', 'farm supply proxy'),
    asset('nature/bush', 'smallprop', 'soft-dressing', 'field/hedgerow proxy'),
  ]),
  desertFlora: freezeArray([
    asset('crypto/desert-cactus', 'cactus', 'soft-dressing', 'desert cactus clusters'),
    asset('nature/bush', 'dry-bush', 'soft-dressing', 'dry brush proxy'),
    asset('crypto/desert-boulder', 'rock', 'hard-boundary', 'desert rocks and hill bases'),
  ]),
});

export const HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS = freezeArray([
  {
    id: 'aaa-asphalt-road-kit',
    priority: 'P0',
    category: 'ground-route',
    title: 'AAA asphalt road kit with paint',
    neededFor: ['main-town roads', 'town #3', 'second town', 'farm loops'],
    deliverables: ['straight', 'curve', 'T-junction', 'crossroad', 'end cap', 'painted lane markers', 'shoulder cracks', 'dirt/asphalt transition'],
    animation: 'none; optional dust/wind overlay remains render-side',
  },
  {
    id: 'animated-water-system',
    priority: 'P0',
    category: 'water',
    title: 'Animated lake/river/pond water kit',
    neededFor: ['west lake', 'central river', 'east-west river branch', 'park pond'],
    deliverables: ['river straight flow loop', 'river bend flow loop', 'lake edge shimmer', 'pond idle ripple', 'shoreline/beach transitions', 'shallow water/fording variants'],
    animation: '4-8 frame seamless loops per water type',
  },
  {
    id: 'cliff-elevation-kit',
    priority: 'P0',
    category: 'terrain-boundary',
    title: 'Cliff, hill, and elevation kit',
    neededFor: ['north boundary', 'central hills', 'south rock cliff', 'desert elevation points'],
    deliverables: ['north/south/east/west cliff faces', 'inner/outer corners', 'mesa shelf', 'hill slope shadow', 'walkable high-ground plateau edge'],
    animation: 'none; dust/heat shimmer render-side only',
  },
  {
    id: 'modular-town-fronts',
    priority: 'P0',
    category: 'structures',
    title: 'Modular town building fronts and boundary rows',
    neededFor: ['main town', 'town #3', 'second town', 'east/south map edges'],
    deliverables: ['storefront fronts', 'side walls', 'corner facades', 'roofline caps', 'door/window variants', 'boundary-row facades designed to tile side-by-side'],
    animation: 'optional neon/window flicker variants only',
  },
  {
    id: 'farmstead-kit',
    priority: 'P0',
    category: 'structures-farm',
    title: 'Farmstead kit',
    neededFor: ['south farm', 'east farm', 'farm road loop'],
    deliverables: ['farmhouse', 'barn', 'silo/well', 'corn rows', 'wheat rows', 'hay bales', 'farm fence corners', 'farm driveway dirt/asphalt blend'],
    animation: '2-4 frame crop sway loop and optional windmill/flag loop',
  },
  {
    id: 'animated-tree-and-shrub-variants',
    priority: 'P1',
    category: 'flora',
    title: 'Animated tree/shrub/cactus variants',
    neededFor: ['west forest', 'single trees around map', 'desert cactus clusters', 'farm hedgerows'],
    deliverables: ['pine/oak/tree-wall variants', 'single tree variants', 'bush/shrub variants', 'cactus variants', 'fallen log/stump variants'],
    animation: 'subtle 4-frame foliage sway for trees/shrubs; cactus stays mostly static',
  },
  {
    id: 'bridge-kit',
    priority: 'P1',
    category: 'route-structures',
    title: 'Bridge kit with rail/shadow variants',
    neededFor: ['north river bridge', 'center road bridge', 'south main bridge', 'northeast town bridge'],
    deliverables: ['short bridge', 'long bridge', 'road bridge', 'wood bridge', 'rail edges', 'water shadow overlays'],
    animation: 'none on bridge; water underneath animates',
  },
  {
    id: 'town-and-farm-prop-dressing',
    priority: 'P2',
    category: 'small-props',
    title: 'Lived-in small prop kit',
    neededFor: ['town fronts', 'farms', 'road shoulders', 'parks'],
    deliverables: ['barrels', 'crates', 'mailboxes', 'signs', 'benches', 'trash cans', 'watering trough', 'fence repairs', 'crop baskets'],
    animation: 'optional small flag/sign sway',
  },
]);

export const HMH_LEVEL_ONE_SKETCH_LAYOUT = Object.freeze({
  levelId: LEVEL_1_ID,
  source: HMH_LEVEL_ONE_SKETCH_SOURCE,
  coordinateSystem: Object.freeze({ units: 'percent of sketch/map rectangle', origin: 'top-left', xRange: [0, 100], yRange: [0, 100] }),
  mapScale: Object.freeze({ feel: 'decent-size bounded open map', traversalModel: 'authored macro / procedural micro', mainClearanceTiles: 4, desertClearanceTiles: 5, bridgeClearanceTiles: 3 }),
  regions: HMH_LEVEL_ONE_SKETCH_REGIONS,
  perimeter: HMH_LEVEL_ONE_SKETCH_PERIMETER,
  waterways: HMH_LEVEL_ONE_SKETCH_WATERWAYS,
  roadNetwork: HMH_LEVEL_ONE_SKETCH_ROAD_NETWORK,
  townsAndFarms: HMH_LEVEL_ONE_SKETCH_TOWNS_AND_FARMS,
  pois: HMH_LEVEL_ONE_SKETCH_POIS,
  assetCoverage: HMH_LEVEL_ONE_SKETCH_EXISTING_ASSET_COVERAGE,
  newAssetRequests: HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS,
  designRules: Object.freeze([
    'Route first: roads, bridges, beach edges, and river crossings define readable movement before decoration.',
    'Perimeter boundaries must be visible diegetic blockers: trees, cliffs, boulders, town facades, water, and beaches.',
    'Roads in towns and farm loops use asphalt/paint; desert/wilderness routes can blend into dirt and sand shoulders.',
    'Forests use dense tree walls at boundaries and sparse single-tree clusters inside playable space.',
    'Desert interiors use cactus/rock clusters near edges and leave wide readable combat lanes open.',
    'Farms must read as farms through farmhouse/barn/crop-row/fence language, not generic town props.',
    'Animated environment assets are loops on water/trees/crops only; combat determinism stays in gameplay code.',
  ]),
});

const REGION_PICK_PRIORITY = Object.freeze({
  'hub-spine': 90,
  'town-hub': 85,
  'shoulder-loop': 80,
  'main-spine': 75,
  'hub-connector': 55,
  'outer-boundary': 30,
  'hard-boundary': 20,
});

export function levelOneSketchRegionForPoint(xPct, yPct) {
  const matches = HMH_LEVEL_ONE_SKETCH_REGIONS.filter((item) => (
    xPct >= item.boundsPct.x
    && xPct <= item.boundsPct.x + item.boundsPct.w
    && yPct >= item.boundsPct.y
    && yPct <= item.boundsPct.y + item.boundsPct.h
  ));
  return matches.sort((a, b) => (
    (REGION_PICK_PRIORITY[b.macroRole] ?? 0) - (REGION_PICK_PRIORITY[a.macroRole] ?? 0)
  ))[0] ?? null;
}

export function levelOneSketchExistingAssetsForLayer(layer) {
  return freezeArray(Object.values(HMH_LEVEL_ONE_SKETCH_EXISTING_ASSET_COVERAGE)
    .flat()
    .filter((item) => item.layer === layer));
}

export function levelOneSketchExistingAssetKeys() {
  return uniq(Object.values(HMH_LEVEL_ONE_SKETCH_EXISTING_ASSET_COVERAGE)
    .flat()
    .map((item) => item.assetKey));
}

export function levelOneSketchNewAssetRequestsByPriority(priority = 'P0') {
  return freezeArray(HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS.filter((request) => request.priority === priority));
}

export function levelOneSketchPoiById(id) {
  return HMH_LEVEL_ONE_SKETCH_POIS.find((poi) => poi.id === id) ?? null;
}
