// Scene-template placement layer for Hard Money Heroes (iso roguelike).
//
// PROBLEM THIS SOLVES: the old renderer picked `pool[propIndex % pool.length]`
// — a RANDOM prop from the whole biome pool — so a TV could land in a field,
// soda machines outdoors, street lamps mid-grass. Incoherent "littering".
//
// FIX: each world cell instantiates a coherent SCENE TEMPLATE chosen by biome.
// A template lists SLOTS with placement RULES so objects group sensibly:
//   - anchor   : the defining structure near cell center (building / big rock).
//   - pathEdge : lines a path/curb at FIXED spacing, alternating sides
//                (street lamps, fences — these ONLY appear via pathEdge).
//   - scatter  : small fill with min-distance rejection (litter, tufts, bushes).
//   - onHost   : sits ON a previously-placed host slot (TV -> table); inherits
//                the host's position + a small offset and renders just after it.
//
// Pure + DOM-free so it is unit-testable. Deterministic from (seed, cell) so a
// given patch of world ALWAYS assembles the same way (stable, memory-free).
//
// Output: an array of placed objects:
//   { id, role, assetKey, worldX, worldY, solid, radius, place, hostId?, drawOrderBias? }
// The renderer maps assetKey -> a coherent-world PNG; collision uses solid/radius;
// onHost objects carry drawOrderBias so they paint just above their host.

export const SCENE_CELL = 7; // world tiles per scene cell (matches OBSTACLE_CELL)

function hashU32(a, b) {
  let h = (a | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (b | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
function rand01(seed, a, b) { return hashU32((a * 73856093) ^ seed, (b * 19349663)) / 4294967296; }

// Asset keys map 1:1 to apps/portal/assets/generated/hmh-coherent-world/<set>/<key>.png
// Roles drive sizing + collision in the renderer (building tall+solid, lamp
// thin+solid, decor small+non-solid, etc.).
const A = (assetKey, role, { solid = true, radius = 0.7 } = {}) => ({ assetKey, role, solid, radius });

// Coherent template library. One template per biome "scene"; the picker chooses
// among a biome's templates deterministically so districts read as designed.
export const SCENE_TEMPLATES = Object.freeze({
  // --- TOWN / ROAD: a street block. Buildings anchor the corners; lamps line
  //     the curb at fixed spacing; a bench / hydrant / trash can sit near the
  //     sidewalk; the floor theme is pavement. ---
  street_block: Object.freeze({
    weight: 0.5,
    archetypeTags: ['city_core', 'suburban'],
    id: 'street_block', biomes: ['town', 'road', 'pavement'], groundTheme: 'pavement',
    slots: [
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('street/street-lamp', 'lamp', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 4 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'scatter', count: 1 },
      { ...A('street/fire-hydrant', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
      { ...A('street/trash-can', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
    ],
  }),
  // --- INTERIOR (arcade room): cabinets in a row, soda machine, a TV that MUST
  //     sit on a table (onHost), stacked boxes. Carpet floor theme. ---
  arcade_interior: Object.freeze({
    archetypeTags: ['city_core'],
    id: 'arcade_interior', biomes: ['town'], groundTheme: 'carpet', weight: 0.35,
    slots: [
      { ...A('interior/arcade-cabinet', 'cabinet', { radius: 0.45 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('interior/soda-machine', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('interior/table-plain', 'table', { radius: 0.4 }), place: 'scatter', count: 1, hostFor: 'tv' },
      { ...A('interior/tv-on-table', 'decor', { solid: false, radius: 0 }), place: 'onHost', hostRole: 'table' },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 1 },
      { ...A('interior/wooden-crate', 'crate', { radius: 0.35 }), place: 'scatter', count: 1 },
    ],
  }),
  // --- FOREST: tree groves + bushes + logs, no man-made props. ---
  tree_grove: Object.freeze({
    archetypeTags: ['wilderness', 'park'],
    id: 'tree_grove', biomes: ['forest'], groundTheme: 'grass',
    slots: [
      { ...A('nature/oak-tree', 'tree', { radius: 0.6 }), place: 'anchor', count: 1 },
      { ...A('nature/pine-tree', 'tree', { radius: 0.55 }), place: 'scatter', count: 2 },
      { ...A('nature/bush', 'smallprop', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
      { ...A('nature/fallen-log', 'smallprop', { radius: 0.45 }), place: 'scatter', count: 1 },
    ],
  }),
  // --- DESERT / ROCKY: boulders + scrub, no lamps/TVs. ---
  rock_field: Object.freeze({
    archetypeTags: ['wilderness'],
    id: 'rock_field', biomes: ['desert', 'rocky'], groundTheme: 'sand',
    slots: [
      { ...A('nature/boulder', 'rock', { radius: 0.6 }), place: 'anchor', count: 1 },
      { ...A('nature/boulder', 'rock', { radius: 0.5 }), place: 'scatter', count: 2 },
      { ...A('nature/bush', 'smallprop', { solid: false, radius: 0 }), place: 'scatter', count: 1 },
    ],
  }),
  // --- PARK: grass theme, benches along the path, trees, a fountain anchor. ---
  green_park: Object.freeze({
    archetypeTags: ['park'],
    id: 'green_park', biomes: ['town'], groundTheme: 'grass', weight: 0.25,
    slots: [
      { ...A('nature/fountain', 'bigprop', { radius: 0.7 }), place: 'anchor', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('nature/oak-tree', 'tree', { radius: 0.6 }), place: 'scatter', count: 2 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
    ],
  }),
  // --- FENCED YARD: a wooden fence runs along the path (pathEdge) with a gate
  //     break; a tree or two inside. Constructive pieces = solid wall detection. ---
  fenced_yard: Object.freeze({
    archetypeTags: ['suburban'],
    id: 'fenced_yard', biomes: ['town', 'road'], groundTheme: 'grass', weight: 0.2,
    slots: [
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 6 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('nature/oak-tree', 'tree', { radius: 0.6 }), place: 'scatter', count: 1 },
      { ...A('nature/bush', 'smallprop', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
    ],
  }),
  // --- WALLED COMPOUND: a brick wall perimeter (pathEdge) with corner pieces;
  //     a building-ish anchor inside. Walls are solid (wall detection). ---
  walled_compound: Object.freeze({
    archetypeTags: ['industrial', 'city_core'],
    id: 'walled_compound', biomes: ['town', 'rocky'], groundTheme: 'pavement', weight: 0.18,
    slots: [
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'pathEdge', spacing: 1, count: 6 },
      { ...A('construct/brick-wall-corner', 'wall', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/low-stone-wall', 'wall', { radius: 0.35 }), place: 'scatter', count: 2 },
    ],
  }),
  // --- RIVER CROSSING: a river runs through with a single bridge (the only
  //     passable crossing); banks scatter. Water pieces are non-solid visual; the
  //     bridge is the safe path. ---
  river_crossing: Object.freeze({
    archetypeTags: ['park', 'wilderness'],
    id: 'river_crossing', biomes: ['forest', 'water'], groundTheme: 'grass', weight: 0.3,
    slots: [
      { ...A('construct/river-straight', 'water-strip', { solid: false, radius: 0 }), place: 'pathEdge', spacing: 1, count: 5 },
      { ...A('construct/wood-bridge', 'bridge', { solid: false, radius: 0 }), place: 'anchor', count: 1 },
      { ...A('nature/fallen-log', 'smallprop', { radius: 0.45 }), place: 'scatter', count: 1 },
      { ...A('nature/bush', 'smallprop', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
    ],
  }),

  // --- NEW DISTRICT: Downtown Business District ---
  downtown_district: Object.freeze({
    archetypeTags: ['city_core'],
    id: 'downtown_district', biomes: ['town', 'pavement'], groundTheme: 'pavement', weight: 0.4,
    slots: [
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('street/mailbox', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
      { ...A('street/street-lamp', 'lamp', { radius: 0.35 }), place: 'pathEdge', spacing: 2, count: 2 },
      { ...A('street/fire-hydrant', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
      { ...A('interior/shop-counter', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('construct/low-stone-wall', 'wall', { radius: 0.35 }), place: 'scatter', count: 1 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('street/trash-can', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
      { ...A('interior/soda-machine', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'scatter', count: 1 },
      { ...A('street/street-lamp', 'lamp', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 4 },
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
    ],
  }),

  suburban_residential: Object.freeze({
    archetypeTags: ['suburban'],
    id: 'suburban_residential', biomes: ['town'], groundTheme: 'grass', weight: 0.35,
    slots: [
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/brick-wall-corner', 'wall', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 5 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('nature/oak-tree', 'tree', { radius: 0.6 }), place: 'scatter', count: 1 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
      { ...A('nature/bush', 'smallprop', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
      { ...A('street/mailbox', 'smallprop', { radius: 0.3 }), place: 'pathEdge', spacing: 4, count: 1 },
    ],
  }),

  industrial_zone: Object.freeze({
    archetypeTags: ['industrial'],
    id: 'industrial_zone', biomes: ['pavement', 'road'], groundTheme: 'pavement', weight: 0.3,
    slots: [
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/brick-wall-corner', 'wall', { radius: 0.4 }), place: 'scatter', count: 3 },
      { ...A('interior/wooden-crate', 'crate', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 4 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 6 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('street/street-lamp', 'lamp', { radius: 0.35 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
    ],
  }),

  city_park: Object.freeze({
    archetypeTags: ['park'],
    id: 'city_park', biomes: ['town', 'forest'], groundTheme: 'grass', weight: 0.3,
    slots: [
      { ...A('nature/fountain', 'bigprop', { radius: 0.7 }), place: 'anchor', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'pathEdge', spacing: 3, count: 4 },
      { ...A('nature/oak-tree', 'tree', { radius: 0.6 }), place: 'scatter', count: 3 },
      { ...A('nature/pine-tree', 'tree', { radius: 0.55 }), place: 'scatter', count: 2 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 4 },
      { ...A('nature/bush', 'smallprop', { solid: false, radius: 0 }), place: 'scatter', count: 3 },
      { ...A('street/street-lamp', 'lamp', { radius: 0.35 }), place: 'pathEdge', spacing: 4, count: 4 },
      { ...A('nature/fallen-log', 'smallprop', { radius: 0.45 }), place: 'scatter', count: 1 },
    ],
  }),

  beach_boardwalk: Object.freeze({
    archetypeTags: ['park', 'wilderness'],
    id: 'beach_boardwalk', biomes: ['sand', 'water'], groundTheme: 'sand', weight: 0.25,
    slots: [
      { ...A('construct/wood-bridge', 'bridge', { solid: false, radius: 0 }), place: 'pathEdge', spacing: 1, count: 6 },
      { ...A('nature/pine-tree', 'tree', { radius: 0.6 }), place: 'scatter', count: 2 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'scatter', count: 2 },
      { ...A('interior/soda-machine', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('street/street-lamp', 'lamp', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 3 },
      { ...A('nature/fallen-log', 'smallprop', { radius: 0.45 }), place: 'scatter', count: 2 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_desert_outpost: Object.freeze({
    archetypeTags: ['wilderness', 'industrial'],
    id: 'crypto_desert_outpost', biomes: ['desert', 'rocky', 'road'], groundTheme: 'sand', weight: 0.3,
    slots: [
      { ...A('crypto/landmark-gas-station', 'building', { radius: 0.75 }), place: 'anchor', count: 1 },
      { ...A('crypto/desert-boulder', 'boulder', { radius: 0.6 }), place: 'scatter', count: 2 },
      { ...A('crypto/desert-cactus', 'tree', { radius: 0.55 }), place: 'scatter', count: 2 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
    ],
  }),

  crypto_ghost_town_block: Object.freeze({
    archetypeTags: ['city_core', 'suburban'],
    id: 'crypto_ghost_town_block', biomes: ['town', 'road'], groundTheme: 'pavement', weight: 0.32,
    slots: [
      { ...A('crypto/ghost-saloon-front', 'building', { radius: 0.75 }), place: 'anchor', count: 1 },
      { ...A('crypto/ghost-boarded-storefront', 'building', { radius: 0.72 }), place: 'anchor', count: 1 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
    ],
  }),

  crypto_industrial_edge: Object.freeze({
    archetypeTags: ['industrial', 'city_core'],
    id: 'crypto_industrial_edge', biomes: ['pavement', 'road', 'town'], groundTheme: 'pavement', weight: 0.26,
    slots: [
      { ...A('crypto/industrial-warehouse-facade', 'building', { radius: 0.8 }), place: 'anchor', count: 1 },
      { ...A('crypto/innercity-billboard-frame', 'sign', { radius: 0.45 }), place: 'scatter', count: 1 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
    ],
  }),

  crypto_residential_edge: Object.freeze({
    archetypeTags: ['suburban', 'park'],
    id: 'crypto_residential_edge', biomes: ['town', 'grass'], groundTheme: 'grass', weight: 0.28,
    slots: [
      { ...A('crypto/residential-hedge-run', 'fence', { radius: 0.38 }), place: 'anchor', count: 1 },
      { ...A('crypto/forest-tree-line', 'tree', { radius: 0.7 }), place: 'scatter', count: 1 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 4, count: 1 },
    ],
  }),

  crypto_canyon_pass: Object.freeze({
    archetypeTags: ['wilderness'],
    id: 'crypto_canyon_pass', biomes: ['desert', 'rocky'], groundTheme: 'sand', weight: 0.24,
    slots: [
      { ...A('crypto/canyon-cliff-edge', 'wall', { radius: 0.8 }), place: 'anchor', count: 1 },
      { ...A('crypto/desert-boulder', 'boulder', { radius: 0.6 }), place: 'scatter', count: 2 },
      { ...A('crypto/desert-cactus', 'tree', { radius: 0.55 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_forest_greenbelt: Object.freeze({
    archetypeTags: ['wilderness', 'park'],
    id: 'crypto_forest_greenbelt', biomes: ['forest', 'town'], groundTheme: 'grass', weight: 0.24,
    slots: [
      { ...A('crypto/forest-tree-line', 'tree', { radius: 0.72 }), place: 'anchor', count: 1 },
      { ...A('crypto/residential-hedge-run', 'fence', { radius: 0.38 }), place: 'scatter', count: 1 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 4, count: 1 },
    ],
  }),

  crypto_desert_outpost_yard: Object.freeze({
    archetypeTags: ['wilderness', 'industrial'],
    id: 'crypto_desert_outpost_yard', biomes: ['desert', 'rocky', 'road'], groundTheme: 'sand', weight: 0.34,
    slots: [
      { ...A('crypto/landmark-gas-station', 'building', { radius: 0.78 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 2, count: 4 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 3 },
      { ...A('crypto/desert-boulder', 'boulder', { radius: 0.6 }), place: 'scatter', count: 2 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_canyon_gate: Object.freeze({
    archetypeTags: ['wilderness'],
    id: 'crypto_canyon_gate', biomes: ['desert', 'rocky'], groundTheme: 'sand', weight: 0.28,
    slots: [
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('crypto/canyon-cliff-edge', 'wall', { radius: 0.8 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('crypto/desert-boulder', 'boulder', { radius: 0.6 }), place: 'scatter', count: 2 },
      { ...A('crypto/desert-cactus', 'tree', { radius: 0.55 }), place: 'scatter', count: 1 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_ghost_mainstreet_front: Object.freeze({
    archetypeTags: ['city_core', 'suburban'],
    id: 'crypto_ghost_mainstreet_front', biomes: ['town', 'road'], groundTheme: 'pavement', weight: 0.34,
    slots: [
      { ...A('crypto/ghost-saloon-front', 'building', { radius: 0.78 }), place: 'anchor', count: 1 },
      { ...A('crypto/ghost-boarded-storefront', 'building', { radius: 0.72 }), place: 'scatter', count: 1 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('street/trash-can', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_ghost_false_front: Object.freeze({
    archetypeTags: ['city_core', 'suburban'],
    id: 'crypto_ghost_false_front', biomes: ['town', 'road'], groundTheme: 'pavement', weight: 0.26,
    slots: [
      { ...A('crypto/ghost-boarded-storefront', 'building', { radius: 0.72 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'scatter', count: 1 },
      { ...A('interior/wooden-crate', 'crate', { radius: 0.35 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_country_rest_stop: Object.freeze({
    archetypeTags: ['suburban', 'wilderness'],
    id: 'crypto_country_rest_stop', biomes: ['road', 'town', 'desert'], groundTheme: 'sand', weight: 0.3,
    slots: [
      { ...A('crypto/landmark-gas-station', 'building', { radius: 0.76 }), place: 'anchor', count: 1 },
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('crypto/desert-boulder', 'boulder', { radius: 0.6 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_country_pull_off: Object.freeze({
    archetypeTags: ['suburban', 'wilderness'],
    id: 'crypto_country_pull_off', biomes: ['road', 'desert', 'town'], groundTheme: 'sand', weight: 0.24,
    slots: [
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 5 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('crypto/desert-boulder', 'boulder', { radius: 0.6 }), place: 'scatter', count: 1 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_residential_square: Object.freeze({
    archetypeTags: ['suburban', 'park'],
    id: 'crypto_residential_square', biomes: ['town', 'grass'], groundTheme: 'grass', weight: 0.3,
    slots: [
      { ...A('crypto/residential-hedge-run', 'fence', { radius: 0.38 }), place: 'anchor', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('street/mailbox', 'smallprop', { radius: 0.3 }), place: 'pathEdge', spacing: 4, count: 1 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 3 },
      { ...A('crypto/forest-tree-line', 'tree', { radius: 0.7 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_residential_greenbelt_pocket: Object.freeze({
    archetypeTags: ['park', 'wilderness'],
    id: 'crypto_residential_greenbelt_pocket', biomes: ['town', 'forest', 'grass'], groundTheme: 'grass', weight: 0.28,
    slots: [
      { ...A('crypto/residential-hedge-run', 'fence', { radius: 0.38 }), place: 'anchor', count: 1 },
      { ...A('crypto/forest-tree-line', 'tree', { radius: 0.72 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'scatter', count: 1 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_innercity_industrial_gate: Object.freeze({
    archetypeTags: ['industrial', 'city_core'],
    id: 'crypto_innercity_industrial_gate', biomes: ['pavement', 'road', 'town'], groundTheme: 'pavement', weight: 0.3,
    slots: [
      { ...A('crypto/industrial-warehouse-facade', 'building', { radius: 0.8 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('crypto/innercity-billboard-frame', 'sign', { radius: 0.45 }), place: 'scatter', count: 1 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_innercity_checkpoint_block: Object.freeze({
    archetypeTags: ['industrial', 'city_core'],
    id: 'crypto_innercity_checkpoint_block', biomes: ['pavement', 'road', 'town'], groundTheme: 'pavement', weight: 0.24,
    slots: [
      { ...A('construct/brick-wall-corner', 'wall', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 5 },
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'scatter', count: 1 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_desert_ghost_checkpoint: Object.freeze({
    archetypeTags: ['wilderness', 'city_core'],
    id: 'crypto_desert_ghost_checkpoint', biomes: ['desert', 'rocky', 'town', 'road'], groundTheme: 'sand', weight: 0.22,
    slots: [
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('crypto/canyon-cliff-edge', 'wall', { radius: 0.8 }), place: 'pathEdge', spacing: 2, count: 2 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('interior/wooden-crate', 'crate', { radius: 0.35 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_ghost_country_checkpoint: Object.freeze({
    archetypeTags: ['city_core', 'suburban'],
    id: 'crypto_ghost_country_checkpoint', biomes: ['town', 'road'], groundTheme: 'pavement', weight: 0.24,
    slots: [
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_country_residential_checkpoint: Object.freeze({
    archetypeTags: ['suburban', 'park'],
    id: 'crypto_country_residential_checkpoint', biomes: ['road', 'town', 'grass'], groundTheme: 'grass', weight: 0.22,
    slots: [
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('street/mailbox', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_residential_innercity_checkpoint: Object.freeze({
    archetypeTags: ['suburban', 'industrial'],
    id: 'crypto_residential_innercity_checkpoint', biomes: ['town', 'road', 'pavement'], groundTheme: 'pavement', weight: 0.24,
    slots: [
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/brick-wall-corner', 'wall', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
      { ...A('crypto/innercity-billboard-frame', 'sign', { radius: 0.45 }), place: 'scatter', count: 1 },
    ],
  }),


  crypto_desert_salvage_basin: Object.freeze({
    archetypeTags: ['wilderness', 'industrial'],
    id: 'crypto_desert_salvage_basin', biomes: ['desert', 'rocky', 'road'], groundTheme: 'sand', weight: 0.26,
    slots: [
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('crypto/canyon-cliff-edge', 'wall', { radius: 0.8 }), place: 'pathEdge', spacing: 1, count: 3 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('crypto/desert-boulder', 'boulder', { radius: 0.6 }), place: 'scatter', count: 1 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_ghost_saloon_square: Object.freeze({
    archetypeTags: ['city_core', 'suburban'],
    id: 'crypto_ghost_saloon_square', biomes: ['town', 'road'], groundTheme: 'pavement', weight: 0.28,
    slots: [
      { ...A('crypto/ghost-saloon-front', 'building', { radius: 0.78 }), place: 'anchor', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('crypto/ghost-boarded-storefront', 'building', { radius: 0.72 }), place: 'scatter', count: 1 },
      { ...A('street/trash-can', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
    ],
  }),

  crypto_country_bus_turnout: Object.freeze({
    archetypeTags: ['suburban', 'wilderness'],
    id: 'crypto_country_bus_turnout', biomes: ['road', 'town', 'grass'], groundTheme: 'grass', weight: 0.24,
    slots: [
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('street/mailbox', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'scatter', count: 1 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
    ],
  }),

  crypto_residential_culdesac: Object.freeze({
    archetypeTags: ['suburban', 'park'],
    id: 'crypto_residential_culdesac', biomes: ['town', 'grass'], groundTheme: 'grass', weight: 0.26,
    slots: [
      { ...A('crypto/residential-hedge-run', 'fence', { radius: 0.38 }), place: 'anchor', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'pathEdge', spacing: 3, count: 2 },
      { ...A('street/mailbox', 'smallprop', { radius: 0.3 }), place: 'pathEdge', spacing: 4, count: 2 },
      { ...A('crypto/forest-tree-line', 'tree', { radius: 0.72 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 3 },
    ],
  }),

  crypto_innercity_barricade_crossing: Object.freeze({
    archetypeTags: ['industrial', 'city_core'],
    id: 'crypto_innercity_barricade_crossing', biomes: ['pavement', 'road', 'town'], groundTheme: 'pavement', weight: 0.26,
    slots: [
      { ...A('construct/brick-wall-corner', 'wall', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 5 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('crypto/innercity-billboard-frame', 'sign', { radius: 0.45 }), place: 'scatter', count: 1 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 3 },
    ],
  }),

  // --- ACT I / SLUMS + FOUNDRY authored anchors -----------------------------
  // These templates keep the currently available coherent-world assets but
  // arrange them around the accepted Level 1 canon: Underchain alleys,
  // scam-market storefronts, fenced backlots, and the Foundry perimeter.

  slums_billboard_corner: Object.freeze({
    archetypeTags: ['city_core'],
    id: 'slums_billboard_corner', biomes: ['town', 'road', 'pavement'], groundTheme: 'pavement', weight: 0.34,
    slots: [
      { ...A('crypto/innercity-billboard-frame', 'sign', { radius: 0.48 }), place: 'anchor', count: 1 },
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('street/trash-can', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 2 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'scatter', count: 1 },
    ],
  }),

  slums_boarded_market: Object.freeze({
    archetypeTags: ['city_core', 'suburban'],
    id: 'slums_boarded_market', biomes: ['town', 'road', 'pavement'], groundTheme: 'pavement', weight: 0.32,
    slots: [
      { ...A('crypto/ghost-boarded-storefront', 'building', { radius: 0.74 }), place: 'anchor', count: 1 },
      { ...A('crypto/ghost-saloon-front', 'building', { radius: 0.76 }), place: 'scatter', count: 1 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'scatter', count: 1 },
      { ...A('street/trash-can', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
      { ...A('street/park-bench', 'bench', { radius: 0.5 }), place: 'scatter', count: 1 },
    ],
  }),

  slums_backlot_fence: Object.freeze({
    archetypeTags: ['suburban', 'industrial'],
    id: 'slums_backlot_fence', biomes: ['town', 'road', 'pavement'], groundTheme: 'pavement', weight: 0.28,
    slots: [
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 5 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
      { ...A('street/trash-can', 'smallprop', { radius: 0.3 }), place: 'scatter', count: 1 },
    ],
  }),

  foundry_loading_gate: Object.freeze({
    archetypeTags: ['industrial', 'city_core'],
    id: 'foundry_loading_gate', biomes: ['town', 'road', 'pavement'], groundTheme: 'pavement', weight: 0.3,
    slots: [
      { ...A('crypto/industrial-warehouse-facade', 'building', { radius: 0.8 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
    ],
  }),

  foundry_press_checkpoint: Object.freeze({
    archetypeTags: ['industrial', 'city_core'],
    id: 'foundry_press_checkpoint', biomes: ['town', 'road', 'pavement'], groundTheme: 'pavement', weight: 0.28,
    slots: [
      { ...A('construct/brick-wall-corner', 'wall', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-segment', 'fence', { radius: 0.32 }), place: 'pathEdge', spacing: 1, count: 5 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('crypto/innercity-billboard-frame', 'sign', { radius: 0.45 }), place: 'scatter', count: 1 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
    ],
  }),

  slums_foundry_checkpoint: Object.freeze({
    archetypeTags: ['city_core', 'industrial'],
    id: 'slums_foundry_checkpoint', biomes: ['town', 'road', 'pavement'], groundTheme: 'pavement', weight: 0.24,
    slots: [
      { ...A('street/bus-stop-sign', 'sign', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('construct/fence-gate', 'fence', { radius: 0.32 }), place: 'anchor', count: 1 },
      { ...A('construct/brick-wall-segment', 'wall', { radius: 0.4 }), place: 'pathEdge', spacing: 1, count: 4 },
      { ...A('crypto/utility-pole', 'sign', { radius: 0.35 }), place: 'pathEdge', spacing: 2, count: 2 },
      { ...A('street/traffic-cone', 'smallprop', { radius: 0.25 }), place: 'scatter', count: 2 },
      { ...A('interior/wooden-crate', 'crate', { radius: 0.35 }), place: 'scatter', count: 1 },
    ],
  }),

  office_interior: Object.freeze({
    archetypeTags: ['city_core'],
    id: 'office_interior', biomes: ['town'], groundTheme: 'carpet', weight: 0.25,
    slots: [
      { ...A('interior/table-plain', 'table', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('interior/wooden-crate', 'crate', { radius: 0.35 }), place: 'scatter', count: 4 },
      { ...A('interior/soda-machine', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'scatter', count: 2 },
      { ...A('interior/tv-on-table', 'decor', { solid: false, radius: 0 }), place: 'onHost', hostRole: 'table', count: 1 },
    ],
  }),

  diner_interior: Object.freeze({
    archetypeTags: ['city_core', 'suburban'],
    id: 'diner_interior', biomes: ['town'], groundTheme: 'carpet', weight: 0.2,
    slots: [
      { ...A('interior/table-plain', 'table', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('interior/shop-counter', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('interior/soda-machine', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('street/street-lamp', 'lamp', { radius: 0.35 }), place: 'pathEdge', spacing: 3, count: 2 },
    ],
  }),

  grocery_interior: Object.freeze({
    archetypeTags: ['suburban', 'city_core'],
    id: 'grocery_interior', biomes: ['town'], groundTheme: 'carpet', weight: 0.2,
    slots: [
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 4 },
      { ...A('interior/shop-counter', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'anchor', count: 1 },
      { ...A('nature/flower-patch', 'decor', { solid: false, radius: 0 }), place: 'onHost', hostRole: 'crate', count: 1 },
      { ...A('interior/soda-machine', 'cabinet', { radius: 0.45 }), place: 'scatter', count: 1 },
      { ...A('interior/wooden-crate', 'crate', { radius: 0.35 }), place: 'scatter', count: 2 },
    ],
  }),

  gym_interior: Object.freeze({
    archetypeTags: ['city_core', 'suburban'],
    id: 'gym_interior', biomes: ['town'], groundTheme: 'carpet', weight: 0.15,
    slots: [
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('interior/wooden-crate', 'crate', { radius: 0.35 }), place: 'scatter', count: 3 },
      { ...A('interior/soda-machine', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('interior/tv-on-table', 'decor', { solid: false, radius: 0 }), place: 'onHost', hostRole: 'crate', count: 1 },
    ],
  }),

});

// Templates available for a biome (with relative weights; default weight 1).
function templatesForBiome(biome) {
  const out = [];
  for (const t of Object.values(SCENE_TEMPLATES)) {
    if (t.biomes.includes(biome)) out.push(t);
  }
  return out;
}

function templatesForContext(biome, context = {}) {
  const templatePoolIds = Array.isArray(context.templatePoolIds) ? context.templatePoolIds : [];
  if (!templatePoolIds.length) return templatesForBiome(biome);
  const pool = templatePoolIds.map((id) => SCENE_TEMPLATES[id]).filter(Boolean);
  if (!pool.length) return templatesForBiome(biome);
  const biomeMatchedPool = pool.filter((template) => template.biomes.includes(biome));
  return biomeMatchedPool.length ? biomeMatchedPool : pool;
}

// Bias: how heavily the district archetype pulls template selection.
// 1.0 = only pick archetype-matching templates; 0.0 = fully random.
const DISTRICT_ARCHETYPE_BIAS = 0.78;

  // === PATH VARIETY: main critical paths + side streets + plazas at landmarks ===
  // Districts have a "main axis" (horizontal or vertical) that defines the
  // critical path. Side streets branch off at intervals. Landmark entrances
  // get plaza templates (open grass/concrete, benches, flower patches).
  function districtMainAxis(seed, districtX, districtY) {
    const h = hashU32(seed, districtX * 73856093 ^ districtY * 19349663);
    return (h % 2) === 0 ? 'horizontal' : 'vertical';
  }

  function isSideStreet(seed, cellX, cellY, mainAxis) {
    const dx = Math.floor(cellX / DISTRICT_SIZE_CELLS);
    const dy = Math.floor(cellY / DISTRICT_SIZE_CELLS);
    const localX = cellX % DISTRICT_SIZE_CELLS;
    const localY = cellY % DISTRICT_SIZE_CELLS;
    // Side streets branch every 2 cells along the perpendicular axis
    if (mainAxis === 'horizontal') {
      // horizontal main path: side streets are vertical columns at x=0, x=2, x=4
      return (localX % 2 === 0) && localY > 0 && localY < 4;
    } else {
      // vertical main path: side streets are horizontal rows at y=0, y=2, y=4
      return (localY % 2 === 0) && localX > 0 && localX < 4;
    }
  }

  function isLandmarkPlaza(seed, cellX, cellY, landmarkHit) {
    if (!landmarkHit) return false;
    // Cells adjacent to landmark entrance (within 1 cell) get plaza treatment
    const dx = Math.abs(cellX - landmarkHit.cellX);
    const dy = Math.abs(cellY - landmarkHit.cellY);
    return (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0); // adjacent, not the landmark itself
  }

  // === DENSITY ZONING: dense core, sparse edges, landmark-centered gradients ===
  // Core cells (2x2 center of each district) get higher density; edge cells
  // (outer 1-cell border) get lower density. Landmark cells get highest density.
  function densityZoneForCell(seed, cellX, cellY) {
    const localX = cellX % DISTRICT_SIZE_CELLS;
    const localY = cellY % DISTRICT_SIZE_CELLS;
    const centerX = Math.floor((DISTRICT_SIZE_CELLS - 1) / 2);
    const centerY = Math.floor((DISTRICT_SIZE_CELLS - 1) / 2);
    const dx = Math.abs(localX - centerX);
    const dy = Math.abs(localY - centerY);
    // Core: 0 cells from center (the actual center cell)
    if (dx === 0 && dy === 0) return 'core';
    // Edge: 2 cells from center (outer border)
    if (dx >= 2 || dy >= 2) return 'edge';
    // Transition: 1 cell from center
    return 'transition';
  }

  // Density multipliers: core=1.0, transition=0.75, edge=0.5
  function densityMultiplierForZone(zone, landmarkBoost = 1.0) {
    const base = { core: 1.0, transition: 0.75, edge: 0.5 }[zone];
    return base * landmarkBoost;
  }

  // Pick one template for a cell, deterministically + biome-coherent.
  // District zoning: divide the world into NxN-cell "districts". Each district
  // picks ONE archetype (city_core, suburban, industrial, park, wilderness) via
  // stable hash. Cells inside a district heavily bias template choices toward
  // templates tagged with that archetype, creating cohesive areas instead of
  // random scatter. Adjacent districts with the same archetype merge visually
  // into larger neighborhoods.
const DISTRICT_SIZE_CELLS = 5;
const DISTRICT_ARCHETYPES = Object.freeze(['city_core', 'suburban', 'industrial', 'park', 'wilderness']);
function districtArchetypeAt(seed, cellX, cellY) {
  const dx = Math.floor(cellX / DISTRICT_SIZE_CELLS);
  const dy = Math.floor(cellY / DISTRICT_SIZE_CELLS);
  const h = hashU32((dx * 73856093) ^ seed, dy * 19349663);
  return DISTRICT_ARCHETYPES[(h >>> 0) % DISTRICT_ARCHETYPES.length];
}

// ============================================================================
// LANDMARK ANCHOR SYSTEM (additive macro-layer on top of district zoning)
// ============================================================================
//
// Each district gets ONE unique landmark placed at a deterministic cell offset
// from its centroid. Landmarks are large iconic buildings (marketplace, fountain,
// refinery, observatory, arcade, beachbar, library, watchtower) that serve as
// player-facing "places of interest" and give districts a readable identity.
//
// Landmarks influence surrounding cells via a `influenceRadius` (in cells).
// When `buildScene()` is about to pick a template for a cell that's inside
// a landmark's influence radius AND in the landmark's "complement archetype"
// lane, the selection is heavily biased toward complementary templates
// (e.g., market stalls near marketplace, benches near fountain, crates near
// refinery). This creates themed plazas around each landmark.
//
// The landmark system is ADDITIVE: the existing cell-by-cell district-
// archetype zoning continues to work. Landmarks only kick in when a cell is
// within their influence radius; everything else proceeds as before.
// ============================================================================

export const LANDMARK_REGISTRY = Object.freeze([
  { id: 'marketplace',  affinity: ['city_core', 'suburban'],  influenceRadius: 3, complementArchetype: 'city_core',  description: 'open-air bazaar with holo-signs and vending stalls' },
  { id: 'fountain',     affinity: ['park', 'city_core'],      influenceRadius: 3, complementArchetype: 'park',       description: 'grand silver fountain plaza' },
  { id: 'refinery',     affinity: ['industrial'],              influenceRadius: 3, complementArchetype: 'industrial', description: 'industrial smokestack with orange glow' },
  { id: 'observatory',  affinity: ['wilderness', 'park'],      influenceRadius: 3, complementArchetype: 'wilderness', description: 'domed science building with cyan beacon' },
  { id: 'arcade',       affinity: ['city_core', 'suburban'],  influenceRadius: 3, complementArchetype: 'city_core',  description: "Lester's Arcade neon storefront" },
  { id: 'beachbar',     affinity: ['park', 'wilderness'],      influenceRadius: 3, complementArchetype: 'park',       description: 'tropical tiki-style bar over water' },
  { id: 'library',      affinity: ['city_core', 'suburban'],  influenceRadius: 3, complementArchetype: 'suburban',   description: 'brutalist stone archive library' },
  { id: 'watchtower',   affinity: ['wilderness', 'industrial'],influenceRadius: 4, complementArchetype: 'wilderness', description: 'tall sentinel tower with red beacon' },
]);

// Deterministic per-district landmark selection. Each district picks ONE
// landmark whose `affinity` includes the district's archetype (so an industrial
// district never gets the fountain). Returns null for districts at origin cell
// (0,0) to keep the player spawn open.
function landmarkForDistrict(seed, districtX, districtY) {
  // Keep player spawn clean of any landmark footprint.
  if (districtX === 0 && districtY === 0) return null;
  const archetype = districtArchetypeAt(seed, districtX, districtY);
  const compatible = LANDMARK_REGISTRY.filter((lm) => lm.affinity.includes(archetype));
  if (!compatible.length) return null;
  const h = hashU32((districtX * 73856093) ^ seed, districtY * 19349663 + 11);
  return compatible[Math.abs(h) % compatible.length];
}

// Each district's landmark is anchored at a stable OFFSET from the district
// centroid (so landmarks don't cluster on grid seams). The offset is chosen
// via hash to spread landmarks around within the district.
function landmarkAnchorCell(seed, districtX, districtY) {
  const baseX = districtX * DISTRICT_SIZE_CELLS;
  const baseY = districtY * DISTRICT_SIZE_CELLS;
  // Deterministic offset within the district, biased toward the middle so
  // the landmark + influence radius fits inside the district bounds.
  const ox = 1 + ((hashU32(seed ^ districtX, districtY * 37) >>> 0) % Math.max(1, DISTRICT_SIZE_CELLS - 2));
  const oy = 1 + ((hashU32(seed ^ districtY, districtX * 41) >>> 0) % Math.max(1, DISTRICT_SIZE_CELLS - 2));
  return { cellX: baseX + ox, cellY: baseY + oy };
}

// Find the landmark (if any) anchored at this exact cell. Returns the landmark
// registry entry, or null. Used by buildScene() to detect the "landmark center"
// cell and pick the dedicated landmark_center_* template.
export function landmarkAtCell(seed, cellX, cellY) {
  const dx = Math.floor(cellX / DISTRICT_SIZE_CELLS);
  const dy = Math.floor(cellY / DISTRICT_SIZE_CELLS);
  const lm = landmarkForDistrict(seed, dx, dy);
  if (!lm) return null;
  const anchor = landmarkAnchorCell(seed, dx, dy);
  if (anchor.cellX === cellX && anchor.cellY === cellY) return lm;
  return null;
}

// Find the landmark (if any) whose influence radius includes this cell.
// Returns { landmark, distance } or null. distance lets callers attenuate
// the bias (closer = stronger pull).
export function landmarkInfluenceAt(seed, cellX, cellY) {
  // Check the 9 surrounding districts (the current one + its neighbors).
  // A landmark's influence can bleed into adjacent districts for softer
  // transitions between themed areas.
  const dx0 = Math.floor(cellX / DISTRICT_SIZE_CELLS);
  const dy0 = Math.floor(cellY / DISTRICT_SIZE_CELLS);
  let best = null;
  for (let ddx = -1; ddx <= 1; ddx += 1) {
    for (let ddy = -1; ddy <= 1; ddy += 1) {
      const dx = dx0 + ddx;
      const dy = dy0 + ddy;
      const lm = landmarkForDistrict(seed, dx, dy);
      if (!lm) continue;
      const anchor = landmarkAnchorCell(seed, dx, dy);
      const dist = Math.max(Math.abs(anchor.cellX - cellX), Math.abs(anchor.cellY - cellY)); // chebyshev
      if (dist <= lm.influenceRadius) {
        if (!best || dist < best.distance) best = { landmark: lm, distance: dist, anchorX: anchor.cellX, anchorY: anchor.cellY };
      }
    }
  }
  return best;
}

export function pickTemplate(seed, cellX, cellY, biome, context = {}) {
  const choices = templatesForContext(biome, context);
  if (!choices.length) return null;

  if (context.forceTemplateId) {
    const forced = choices.find((template) => template.id === context.forceTemplateId);
    if (forced) return forced;
  }

  if (choices.length === 1) return choices[0];

  const archetype = context.archetype ?? districtArchetypeAt(seed, cellX, cellY);
  // Determine if this cell should respect the district archetype (biased coin).
  const rollWithArchetype = rand01(seed, cellX * 31 + 7, cellY * 17 + 91) < DISTRICT_ARCHETYPE_BIAS;

  // Layer landmark influence on top of district zoning. If this cell sits inside
  // a landmark's influence radius, boost weights of templates tagged with the
  // landmark's `complementArchetype` (e.g., benches near fountain, crates near
  // refinery). The boost tapers from 4x at the anchor cell down to 1.3x at the
  // edge of the influence radius, giving each landmark a "pull" gradient.
  const landmarkHit = context.landmarkInfluence ?? (typeof landmarkInfluenceAt === 'function'
    ? landmarkInfluenceAt(seed, cellX, cellY)
    : null);
  const landmarkComplementArchetype = landmarkHit?.complementArchetype ?? landmarkHit?.landmark?.complementArchetype ?? null;
  const landmarkRadius = landmarkHit?.influenceRadius ?? landmarkHit?.landmark?.influenceRadius ?? 1;
  const landmarkBoost = landmarkHit
    ? 1.3 + (2.7 * (1 - (landmarkHit.distance / Math.max(1, landmarkRadius))))
    : 1;
  const transitionTemplateIds = Array.isArray(context.transitionBand?.seamTemplateIds) ? context.transitionBand.seamTemplateIds : [];

  // Compute effective weight for each candidate template.
  let total = 0;
  const scored = [];
  for (const t of choices) {
    const tags = t.archetypeTags ?? [];
    const matchesArchetype = tags.includes(archetype);
    const matchesLandmark = landmarkComplementArchetype && tags.includes(landmarkComplementArchetype);
    let w = t.weight ?? 1;
    // District-archetype bias: non-matching templates with explicit tags lose most weight.
    if (rollWithArchetype && !matchesArchetype && tags.length > 0) w *= 0.12;
    // Landmark complement bias: templates matching the landmark's archetype get
    // a boost that tapers with distance.
    if (matchesLandmark) w *= landmarkBoost;
    if (transitionTemplateIds.includes(t.id)) w *= 3.2;
    scored.push({ template: t, weight: w });
    total += w;
  }
  if (total <= 0) return choices[0];

  let r = rand01(seed, cellX * 31 + 7, cellY * 17 + 3) * total;
  for (const s of scored) {
    r -= s.weight;
    if (r <= 0) return s.template;
  }
  return choices[0];
}

// Build the coherent placement for one cell. Returns [] for "open ground" cells
// so the map breathes. `reserveRadius` keeps the player spawn (origin) clear.
export function buildScene(seed, cellX, cellY, biome, { reserveRadius = 6, density = 0.62, templateContext = null } = {}) {
  if (biome === 'water') return []; // water stays open + impassable (handled elsewhere)
  const forceLandmarkTemplate = Boolean(templateContext?.forceTemplateId);
  const cellHash = hashU32((cellX * 73856093) ^ seed, cellY * 19349663);
  if (!forceLandmarkTemplate && (cellHash % 100) >= Math.round(density * 100)) return [];
  const template = pickTemplate(seed, cellX, cellY, biome, templateContext ?? {});
  if (!template) return [];

  const baseX = cellX * SCENE_CELL + Math.floor(SCENE_CELL / 2);
  const baseY = cellY * SCENE_CELL + Math.floor(SCENE_CELL / 2);
  const placed = [];
  const occupied = []; // {x,y,r} for min-distance rejection
  const tooClose = (x, y, minGap) => occupied.some((o) => Math.hypot(o.x - x, o.y - y) < minGap + o.r);
  const inSpawn = (x, y) => Math.hypot(x, y) < reserveRadius;

  // Deterministic path: a straight line through the cell (horizontal or vertical)
  // that pathEdge slots line. Direction is per-cell stable.
  const forcedOrientation = templateContext?.pathOrientation;
  const horizontal = forcedOrientation === 'horizontal'
    ? true
    : forcedOrientation === 'vertical'
      ? false
      : rand01(seed, cellX, cellY * 5 + 1) < 0.5;

  let slotIndex = 0;
  const hostsByRole = {};
  for (const slot of template.slots) {
    slotIndex += 1;
    const count = slot.count ?? 1;

    if (slot.place === 'anchor') {
      const x = baseX, y = baseY;
      if (inSpawn(x, y)) continue;
      const obj = mkObj(template, slot, cellX, cellY, slotIndex, 0, x, y);
      placed.push(obj); occupied.push({ x, y, r: slot.radius });
      if (slot.hostFor) hostsByRole.anchor = obj;
    } else if (slot.place === 'pathEdge') {
      // Drop one every `spacing` tiles along the path, alternating sides so they
      // line a curb/aisle realistically (lamps/fences/cabinets in a row).
      const spacing = slot.spacing ?? 3;
      const half = Math.floor((count * spacing) / 2);
      for (let i = 0; i < count; i += 1) {
        const along = -half + i * spacing;
        const side = (i % 2 === 0 ? 1 : -1) * 1; // 1 tile off the path centerline
        const x = horizontal ? baseX + along : baseX + side;
        const y = horizontal ? baseY + side : baseY + along;
        if (inSpawn(x, y) || tooClose(x, y, 0.8)) continue;
        placed.push(mkObj(template, slot, cellX, cellY, slotIndex, i, x, y));
        occupied.push({ x, y, r: slot.radius });
      }
    } else if (slot.place === 'scatter') {
      for (let i = 0; i < count; i += 1) {
        let placedThis = false;
        for (let attempt = 0; attempt < 6 && !placedThis; attempt += 1) {
          const ox = Math.round((rand01(seed, cellX * 97 + slotIndex, cellY * 41 + i * 7 + attempt) - 0.5) * (SCENE_CELL - 1));
          const oy = Math.round((rand01(seed, cellX * 53 + i + attempt, cellY * 89 + slotIndex) - 0.5) * (SCENE_CELL - 1));
          const x = baseX + ox, y = baseY + oy;
          if (inSpawn(x, y) || tooClose(x, y, 1.0)) continue;
          const obj = mkObj(template, slot, cellX, cellY, slotIndex, i, x, y);
          placed.push(obj); occupied.push({ x, y, r: slot.radius || 0.5 });
          if (slot.hostFor) hostsByRole[slot.hostFor] = obj;
          placedThis = true;
        }
      }
    } else if (slot.place === 'onHost') {
      // Sits on a previously-placed host (e.g. TV on a table). Find the host by
      // role; inherit its position + a small upward offset; render just above.
      const host = placed.find((p) => p.role === slot.hostRole);
      if (!host) continue;
      const obj = mkObj(template, slot, cellX, cellY, slotIndex, 0, host.worldX, host.worldY);
      obj.hostId = host.id;
      obj.drawOrderBias = 0.5; // paint just after the host at the same depth
      placed.push(obj);
    }
  }
  return placed;
}

function mkObj(template, slot, cellX, cellY, slotIndex, i, x, y) {
  return {
    id: `scn-${cellX}-${cellY}-${slotIndex}-${i}`,
    role: slot.role,
    assetKey: slot.assetKey,
    worldX: x,
    worldY: y,
    solid: slot.solid !== false,
    radius: slot.radius ?? 0.6,
    place: slot.place,
    groundTheme: template.groundTheme,
    drawOrderBias: 0,
  };
}

// All scene objects whose cells overlap a world window centered on (cx, cy).
// Mirrors obstaclesNear so the renderer + collision consume one stable set.
export function sceneObjectsNear(seed, centerX, centerY, halfExtent, biomeAt, opts = {}) {
  const minCellX = Math.floor((centerX - halfExtent) / SCENE_CELL);
  const maxCellX = Math.floor((centerX + halfExtent) / SCENE_CELL);
  const minCellY = Math.floor((centerY - halfExtent) / SCENE_CELL);
  const maxCellY = Math.floor((centerY + halfExtent) / SCENE_CELL);
  const out = [];
  for (let cx = minCellX; cx <= maxCellX; cx += 1) {
    for (let cy = minCellY; cy <= maxCellY; cy += 1) {
      const anchorX = cx * SCENE_CELL + Math.floor(SCENE_CELL / 2);
      const anchorY = cy * SCENE_CELL + Math.floor(SCENE_CELL / 2);
      const biome = biomeAt(seed, anchorX, anchorY);
      const templateContext = typeof opts.templateContextForCell === 'function'
        ? opts.templateContextForCell(cx, cy, biome)
        : opts.templateContext;
      for (const o of buildScene(seed, cx, cy, biome, { ...opts, templateContext })) out.push(o);
    }
  }
  return out;
}

// The ground theme a cell wants (so floor tiles match the object arrangement).
export function groundThemeForCell(seed, cellX, cellY, biome, context = {}) {
  const t = pickTemplate(seed, cellX, cellY, biome, context);
  return t?.groundTheme ?? null;
}

