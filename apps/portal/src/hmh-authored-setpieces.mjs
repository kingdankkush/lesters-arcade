// Authored setpiece grammar for Hard Money Heroes levels.
//
// This file is deliberately data-first: Justin's reference images are used only
// as inspiration for composition (paths, blockers, landmarks, lived-in detail),
// not as source art. Runtime rendering still uses repo-owned/generated assets.

const LEVEL_1_ID = 'level-1-crypto-wasteland';
const LEVEL_2_ID = 'level-2-litecoin-city';
const LEVEL_3_ID = 'level-3-the-getaway';

const freezeArray = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
const unique = (...lists) => Object.freeze(Array.from(new Set(lists.flat().filter(Boolean))));

export const HMH_AUTHORED_LEVEL_GRAMMAR = Object.freeze({
  referencePolicy: 'Reference images guide composition only; do not ship the provided reference files as level art.',
  buildOrder: Object.freeze([
    'draw primary traversal lane first',
    'shape hard boundaries second',
    'place landmarks / POI reads third',
    'add combat spawn + reward hooks fourth',
    'add soft dressing last in clusters, never as even noise',
  ]),
  layers: Object.freeze({
    ground: Object.freeze({ purpose: 'base readable terrain: sand, grass, asphalt, stone, marsh, shallow/deep water', mustStayReadable: true }),
    route: Object.freeze({ purpose: 'main path, road, sidewalk, bridge, ford, alley, or trail that tells the player where traversal is safe', minClearTiles: 4 }),
    hardBoundary: Object.freeze({ purpose: 'solid cliffs, tree walls, fences, buildings, water edges, dense rocks, walls, and gates that carve the play space', collisionRequired: true }),
    softDressing: Object.freeze({ purpose: 'non-critical bushes, flowers, reeds, cacti, trash cans, benches, crates, small rocks, lily pads, and lived-in clutter', clusterOnly: true }),
    landmark: Object.freeze({ purpose: 'one memorable silhouette per area: oasis, cave mouth, plaza, civic building, harbor crane, bank, statue, rig camp', sightlineRequired: true }),
    gameplay: Object.freeze({ purpose: 'spawn slots, miniboss arenas, pickup pockets, chokepoints, safe lanes, exits, and hazard tells', deterministic: true }),
  }),
  placementRules: Object.freeze([
    'Every setpiece keeps a readable main lane with at least four tiles of traversal clearance.',
    'Trees/rocks/walls/water/buildings are boundary language first; sparse interior versions are soft dressing only.',
    'Water areas expose type: shallow, deep, running, pond/lake, or marsh, because each has different movement/readability rules.',
    'Town/city buildings align to streets/sidewalks; telephone/utility poles line roads and can imply wire runs to buildings.',
    'No setpiece may rely on random scatter to communicate its identity; it needs an anchor, boundaries, and a path role.',
  ]),
});

export const HMH_AUTHORED_SETPIECE_PACKS = freezeArray([
  {
    id: 'forest-trail-boundary',
    title: 'Forest Trail Boundary',
    levelIds: [LEVEL_1_ID],
    districtFamilies: ['country_road', 'residential_edge'],
    macroRoles: ['main-spine', 'shoulder-loop', 'poi-connector'],
    biomeTags: ['forest', 'grass'],
    traversal: Object.freeze({ route: 'curving dirt trail', minClearTiles: 4, boundaryStyle: 'tile-tree-wall with sparse soft trees inside the lane' }),
    groundPalette: ['grass', 'dirt path', 'leaf litter', 'rocky edge'],
    hardBoundaries: ['dense tree line', 'fallen logs', 'boulders', 'low cliff shelves'],
    softDressing: ['bush clusters', 'flowers', 'ferns', 'small rocks', 'stumps'],
    landmarks: ['old tree', 'cave-mouth read', 'signpost bend'],
    gameplayHooks: ['ambush pockets off the main trail', 'safe readable center lane', 'pickup nook behind soft foliage'],
    templateIds: ['authored_forest_trail_edge', 'crypto_forest_greenbelt', 'tree_grove'],
    preferredTemplateIds: ['authored_forest_trail_edge', 'crypto_forest_greenbelt'],
  },
  {
    id: 'creek-ford-crossing',
    title: 'Creek / River Ford Crossing',
    levelIds: [LEVEL_1_ID, LEVEL_2_ID],
    districtFamilies: ['country_road', 'residential_edge', 'luxury_neighborhood'],
    macroRoles: ['shoulder-loop', 'poi-spur', 'hub-connector'],
    waterFeatures: ['culvert-drainage', 'lake-shoreline', 'harbor-edge'],
    biomeTags: ['water', 'forest', 'grass'],
    traversal: Object.freeze({ route: 'ford or bridge across water', minClearTiles: 3, boundaryStyle: 'deep water and reeds define edges; shallow water is readable slow terrain' }),
    groundPalette: ['mud bank', 'sandbar', 'shallow water', 'deep water', 'stepping stones'],
    hardBoundaries: ['deep water', 'rock bank', 'dense reeds', 'bridge rails'],
    softDressing: ['reeds', 'lily pads', 'ripples', 'driftwood', 'small flowers'],
    landmarks: ['wood bridge', 'culvert mouth', 'oasis glint'],
    gameplayHooks: ['slow-zone shallow water', 'bridge chokepoint', 'bank-side reward pocket'],
    templateIds: ['authored_creek_shallow_ford', 'river_crossing', 'beach_boardwalk'],
    preferredTemplateIds: ['authored_creek_shallow_ford', 'river_crossing'],
  },
  {
    id: 'oasis-lake-shore',
    title: 'Oasis / Lake Shore Arena',
    levelIds: [LEVEL_1_ID],
    districtFamilies: ['residential_edge'],
    poiIds: ['oasis_lakeside'],
    macroRoles: ['poi-spur'],
    waterFeatures: ['lake-shoreline'],
    biomeTags: ['water', 'sand', 'grass'],
    traversal: Object.freeze({ route: 'dry-bank loop around water', minClearTiles: 4, boundaryStyle: 'deep water center with sandbar/choke reads' }),
    groundPalette: ['sand', 'wet sand', 'shallow water', 'deep water', 'grass fringe'],
    hardBoundaries: ['deep pool', 'cliff shelf', 'boulder ring'],
    softDressing: ['reeds', 'palms/cacti equivalent', 'small flowers', 'shoreline rocks'],
    landmarks: ['oasis pool', 'water shrine', 'sandbar arena'],
    gameplayHooks: ['miniboss ring', 'dry-bank kite lane', 'regen reward cache'],
    templateIds: ['authored_oasis_lake_shore', 'crypto_oasis_lakeside', 'river_crossing', 'beach_boardwalk'],
    preferredTemplateIds: ['authored_oasis_lake_shore', 'crypto_oasis_lakeside'],
  },
  {
    id: 'desert-wash-and-dunes',
    title: 'Desert Wash and Dune Path',
    levelIds: [LEVEL_1_ID],
    districtFamilies: ['desert_approach'],
    macroRoles: ['main-spine', 'outer-wilds', 'shoulder-loop'],
    biomeTags: ['desert', 'rocky'],
    traversal: Object.freeze({ route: 'wide sandy wash', minClearTiles: 5, boundaryStyle: 'cactus/rock clusters and canyon shelves frame the path' }),
    groundPalette: ['sand', 'cracked earth', 'dune shadow', 'gravel scatter'],
    hardBoundaries: ['canyon cliff', 'large boulders', 'dry creek lip'],
    softDressing: ['cacti', 'dead bushes', 'tumbleweed', 'small rocks', 'bones'],
    landmarks: ['salvage flare', 'gas-station ruin', 'dune fork'],
    gameplayHooks: ['long sightline ranged pressure', 'salvage side pocket', 'clear escape lane'],
    templateIds: ['authored_desert_dune_wash', 'crypto_desert_salvage_basin', 'crypto_desert_outpost_yard', 'crypto_canyon_pass'],
    preferredTemplateIds: ['authored_desert_dune_wash', 'crypto_desert_salvage_basin'],
  },
  {
    id: 'rock-wall-canyon-corridor',
    title: 'Rock Wall Canyon Corridor',
    levelIds: [LEVEL_1_ID],
    districtFamilies: ['desert_approach', 'residential_edge'],
    poiIds: ['mesa_overlook', 'old_hashrate_camp'],
    macroRoles: ['poi-spur', 'outer-wilds'],
    biomeTags: ['rocky', 'desert'],
    traversal: Object.freeze({ route: 'bent canyon corridor', minClearTiles: 4, boundaryStyle: 'solid cliff/wall pieces create deliberate corners' }),
    groundPalette: ['rocky ground', 'sand', 'gravel', 'cliff shadow'],
    hardBoundaries: ['rock wall', 'mesa shelf', 'boulder choke', 'cave mouth'],
    softDressing: ['pebbles', 'dry shrubs', 'small cactus', 'dust plumes'],
    landmarks: ['mesa overlook', 'canyon gate', 'sniper ridge'],
    gameplayHooks: ['chokepoint fight', 'ridge telegraph', 'side reward alcove'],
    templateIds: ['authored_rock_wall_corridor', 'crypto_canyon_pass', 'crypto_canyon_gate', 'crypto_mesa_overlook'],
    preferredTemplateIds: ['authored_rock_wall_corridor', 'crypto_canyon_gate'],
  },
  {
    id: 'marsh-boardwalk-pocket',
    title: 'Marsh Boardwalk Pocket',
    levelIds: [LEVEL_1_ID, LEVEL_2_ID],
    districtFamilies: ['residential_edge', 'luxury_neighborhood'],
    macroRoles: ['shoulder-loop', 'hub-connector'],
    biomeTags: ['marsh', 'water', 'grass'],
    traversal: Object.freeze({ route: 'raised boardwalk through wet ground', minClearTiles: 3, boundaryStyle: 'marsh water/reeds restrict movement without reading like random puddles' }),
    groundPalette: ['mud', 'shallow marsh', 'moss', 'wood planks'],
    hardBoundaries: ['deep marsh', 'fallen logs', 'reed wall'],
    softDressing: ['lily pads', 'reeds', 'moss clumps', 'flowers'],
    landmarks: ['boardwalk bend', 'sunken crate', 'glowing marsh pool'],
    gameplayHooks: ['slow mud patches', 'bridge lane', 'small cache on dry island'],
    templateIds: ['authored_marsh_boardwalk', 'authored_creek_shallow_ford', 'river_crossing'],
    preferredTemplateIds: ['authored_marsh_boardwalk'],
  },
  {
    id: 'town-mainstreet-lived-in',
    title: 'Lived-in Town Main Street',
    levelIds: [LEVEL_1_ID],
    districtFamilies: ['ghost_town', 'country_road'],
    macroRoles: ['main-spine', 'hub-spine', 'shoulder-loop'],
    biomeTags: ['town', 'road'],
    traversal: Object.freeze({ route: 'street and sidewalk corridor', minClearTiles: 4, boundaryStyle: 'buildings face the road; poles/fences align to sidewalks' }),
    groundPalette: ['dusty pavement', 'sidewalk', 'crosswalk', 'yard dirt'],
    hardBoundaries: ['storefronts', 'fences', 'parked wagons/cars equivalent', 'wall corners'],
    softDressing: ['trash cans', 'benches', 'mailboxes', 'crates', 'signs'],
    landmarks: ['bank/vault ruin', 'saloon/storefront', 'trading post sign'],
    gameplayHooks: ['street duel lane', 'alley cut-through', 'reward behind storefront pocket'],
    templateIds: ['authored_town_mainstreet_lived_in', 'crypto_ghost_mainstreet_front', 'crypto_ghost_saloon_square', 'crypto_country_rest_stop'],
    preferredTemplateIds: ['authored_town_mainstreet_lived_in', 'crypto_ghost_mainstreet_front'],
  },
  {
    id: 'city-civic-plaza-block',
    title: 'City Civic Plaza Block',
    levelIds: [LEVEL_2_ID],
    districtFamilies: ['outer_boulevard', 'financial_core'],
    macroRoles: ['main-spine', 'hub-spine'],
    biomeTags: ['pavement', 'town'],
    traversal: Object.freeze({ route: 'street grid around plaza', minClearTiles: 5, boundaryStyle: 'buildings and medians create predictable city blocks' }),
    groundPalette: ['asphalt', 'sidewalk', 'plaza tile', 'median grass'],
    hardBoundaries: ['civic building facade', 'concrete medians', 'statue/fountain base', 'street walls'],
    softDressing: ['benches', 'trash cans', 'hydrants', 'street lamps', 'mailboxes'],
    landmarks: ['LTC monument', 'city hall/bank facade', 'fountain plaza'],
    gameplayHooks: ['hub orientation', 'fountain cover', 'wide circular combat lane'],
    templateIds: ['authored_city_civic_block', 'downtown_district', 'street_block', 'city_park'],
    preferredTemplateIds: ['authored_city_civic_block', 'downtown_district'],
  },
  {
    id: 'residential-neighborhood-loop',
    title: 'Residential Neighborhood Loop',
    levelIds: [LEVEL_2_ID, LEVEL_1_ID],
    districtFamilies: ['luxury_neighborhood', 'residential_edge'],
    macroRoles: ['shoulder-loop', 'hub-connector'],
    biomeTags: ['town', 'grass'],
    traversal: Object.freeze({ route: 'driveway/sidewalk loop', minClearTiles: 4, boundaryStyle: 'hedges, fences, homes, and yards define safe loops' }),
    groundPalette: ['grass', 'sidewalk', 'driveway', 'yard dirt'],
    hardBoundaries: ['hedge wall', 'fence run', 'house frontage', 'gate'],
    softDressing: ['mailboxes', 'benches', 'flower beds', 'trash cans', 'small trees'],
    landmarks: ['cul-de-sac', 'park pocket', 'gated driveway'],
    gameplayHooks: ['looping kite path', 'yard-side pickup', 'low-pressure rest beat'],
    templateIds: ['authored_residential_neighborhood', 'suburban_residential', 'fenced_yard', 'green_park'],
    preferredTemplateIds: ['authored_residential_neighborhood', 'suburban_residential'],
  },
  {
    id: 'harbor-industrial-service-edge',
    title: 'Harbor / Industrial Service Edge',
    levelIds: [LEVEL_2_ID],
    districtFamilies: ['outer_boulevard', 'financial_core'],
    poiIds: ['defi_harbor', 'hashrate_district'],
    macroRoles: ['poi-spur', 'shoulder-loop'],
    waterFeatures: ['harbor-edge'],
    biomeTags: ['pavement', 'water', 'industrial'],
    traversal: Object.freeze({ route: 'dock/service road lane', minClearTiles: 4, boundaryStyle: 'water, container/crate rows, walls, and service fences form lanes' }),
    groundPalette: ['asphalt', 'dock planks', 'wet concrete', 'harbor water'],
    hardBoundaries: ['water edge', 'fence line', 'crate/container rows', 'warehouse wall'],
    softDressing: ['trash cans', 'cones', 'crates', 'cables', 'lamps'],
    landmarks: ['dock bridge', 'service gate', 'warehouse frontage'],
    gameplayHooks: ['knockback clamp edge', 'crate-cover fight', 'utility reward pocket'],
    templateIds: ['authored_harbor_service_edge', 'industrial_zone', 'walled_compound', 'beach_boardwalk'],
    preferredTemplateIds: ['authored_harbor_service_edge', 'industrial_zone'],
  },
]);

const PACKS_BY_ID = Object.freeze(Object.fromEntries(HMH_AUTHORED_SETPIECE_PACKS.map((pack) => [pack.id, pack])));

function listMatches(list, value) {
  return !list?.length || (value != null && list.includes(value));
}

function poiListMatches(list, value) {
  if (!list?.length) return true;
  if (value == null) return false;
  return list.includes(value) || list.includes(String(value).replace(/-/g, '_')) || list.includes(String(value).replace(/_/g, '-'));
}

export function authoredSetpiecePackById(id) {
  return PACKS_BY_ID[id] ?? null;
}

export function authoredSetpiecePacksForContext({
  levelId = LEVEL_1_ID,
  districtFamily = null,
  poiId = null,
  macroRole = null,
  waterFeature = null,
} = {}) {
  return Object.freeze(HMH_AUTHORED_SETPIECE_PACKS.filter((pack) => (
    listMatches(pack.levelIds, levelId)
    && listMatches(pack.districtFamilies, districtFamily)
    && listMatches(pack.macroRoles, macroRole)
    && listMatches(pack.waterFeatures, waterFeature)
    && poiListMatches(pack.poiIds, poiId)
  )));
}

export function authoredTemplatePoolIdsForContext(context = {}) {
  return unique(...authoredSetpiecePacksForContext(context).map((pack) => pack.templateIds));
}

export function authoredPreferredTemplateIdsForContext(context = {}) {
  return unique(...authoredSetpiecePacksForContext(context).map((pack) => pack.preferredTemplateIds));
}

export function authoredLevelSetpieceManifestFor(levelId = LEVEL_1_ID) {
  const packs = HMH_AUTHORED_SETPIECE_PACKS.filter((pack) => pack.levelIds.includes(levelId));
  return Object.freeze({
    levelId,
    referencePolicy: HMH_AUTHORED_LEVEL_GRAMMAR.referencePolicy,
    buildOrder: HMH_AUTHORED_LEVEL_GRAMMAR.buildOrder,
    packIds: Object.freeze(packs.map((pack) => pack.id)),
    templateIds: unique(...packs.map((pack) => pack.templateIds)),
    requiredLayerKeys: Object.freeze(Object.keys(HMH_AUTHORED_LEVEL_GRAMMAR.layers)),
    designContract: Object.freeze([
      'paths remain open before decoration',
      'hard boundaries shape traversal',
      'soft dressing clusters around landmarks and edges',
      'town/city props align to roads and sidewalks',
      'biome water/rock/forest/desert/marsh rules are explicit data, not random scatter',
    ]),
  });
}

export const HMH_AUTHORED_LEVEL_SETPIECE_MANIFESTS = Object.freeze({
  [LEVEL_1_ID]: authoredLevelSetpieceManifestFor(LEVEL_1_ID),
  [LEVEL_2_ID]: authoredLevelSetpieceManifestFor(LEVEL_2_ID),
  [LEVEL_3_ID]: authoredLevelSetpieceManifestFor(LEVEL_3_ID),
});
