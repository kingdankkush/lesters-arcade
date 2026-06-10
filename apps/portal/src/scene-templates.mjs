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
    id: 'rock_field', biomes: ['desert', 'rocky'], groundTheme: 'sand',
    slots: [
      { ...A('nature/boulder', 'rock', { radius: 0.6 }), place: 'anchor', count: 1 },
      { ...A('nature/boulder', 'rock', { radius: 0.5 }), place: 'scatter', count: 2 },
      { ...A('nature/bush', 'smallprop', { solid: false, radius: 0 }), place: 'scatter', count: 1 },
    ],
  }),
  // --- PARK: grass theme, benches along the path, trees, a fountain anchor. ---
  green_park: Object.freeze({
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

  office_interior: Object.freeze({
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
    id: 'diner_interior', biomes: ['town'], groundTheme: 'carpet', weight: 0.2,
    slots: [
      { ...A('interior/table-plain', 'table', { radius: 0.4 }), place: 'pathEdge', spacing: 2, count: 3 },
      { ...A('interior/shop-counter', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('interior/soda-machine', 'cabinet', { radius: 0.45 }), place: 'anchor', count: 1 },
      { ...A('interior/stacked-boxes', 'crate', { radius: 0.4 }), place: 'scatter', count: 2 },
      { ...A('street/street-lamp', 'lamp', { radius: 0.35 }), place: 'scatter', count: 2 },
    ],
  }),

  grocery_interior: Object.freeze({
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

// Pick one template for a cell, deterministically + biome-coherent.
export function pickTemplate(seed, cellX, cellY, biome) {
  const choices = templatesForBiome(biome);
  if (!choices.length) return null;
  if (choices.length === 1) return choices[0];
  const total = choices.reduce((s, t) => s + (t.weight ?? 1), 0);
  let r = rand01(seed, cellX * 31 + 7, cellY * 17 + 3) * total;
  for (const t of choices) {
    r -= (t.weight ?? 1);
    if (r <= 0) return t;
  }
  return choices[0];
}

// Build the coherent placement for one cell. Returns [] for "open ground" cells
// so the map breathes. `reserveRadius` keeps the player spawn (origin) clear.
export function buildScene(seed, cellX, cellY, biome, { reserveRadius = 6, density = 0.62 } = {}) {
  if (biome === 'water') return []; // water stays open + impassable (handled elsewhere)
  const cellHash = hashU32((cellX * 73856093) ^ seed, cellY * 19349663);
  if ((cellHash % 100) >= Math.round(density * 100)) return [];
  const template = pickTemplate(seed, cellX, cellY, biome);
  if (!template) return [];

  const baseX = cellX * SCENE_CELL + Math.floor(SCENE_CELL / 2);
  const baseY = cellY * SCENE_CELL + Math.floor(SCENE_CELL / 2);
  const placed = [];
  const occupied = []; // {x,y,r} for min-distance rejection
  const tooClose = (x, y, minGap) => occupied.some((o) => Math.hypot(o.x - x, o.y - y) < minGap + o.r);
  const inSpawn = (x, y) => Math.hypot(x, y) < reserveRadius;

  // Deterministic path: a straight line through the cell (horizontal or vertical)
  // that pathEdge slots line. Direction is per-cell stable.
  const horizontal = rand01(seed, cellX, cellY * 5 + 1) < 0.5;

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
      for (const o of buildScene(seed, cx, cy, biome, opts)) out.push(o);
    }
  }
  return out;
}

// The ground theme a cell wants (so floor tiles match the object arrangement).
export function groundThemeForCell(seed, cellX, cellY, biome) {
  const t = pickTemplate(seed, cellX, cellY, biome);
  return t?.groundTheme ?? null;
}

