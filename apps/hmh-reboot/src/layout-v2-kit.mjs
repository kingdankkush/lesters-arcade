import { createStaticBlocker } from './collision.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from './elevation.mjs';

// Layout v2 greybox terrain kit (design package 2026-09-25, slice S2.0).
//
// A layout is plain data: masses, water, chasms, flush or raised bridge decks,
// terraces with their ramps, gates and road polylines. This kit turns that data
// into the two contracts the runtime already consumes -- elevation surfaces
// (createAuthoredGroundQuery) and static collision blockers (the navgrid and
// the swept collision solver) -- plus the greybox pieces the pilot renderer
// draws: mass top and edge strips, chasm wall faces and rims, deck planks and
// rails, road tiles. Built dark: nothing on the default map imports this.

export const LAYOUT_V2_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 12_000, maxY: 4_800, visibleBoundaryId: 'forked-frontier-v2-perimeter' });

// Section 2.3: clear width is the blocker-free width; art width is the tile.
export const LAYOUT_V2_ROAD_TIERS = Object.freeze({
  highway: Object.freeze({ tier: 1, clear: 220, art: 260 }),
  road: Object.freeze({ tier: 2, clear: 200, art: 220 }),
  lane: Object.freeze({ tier: 3, clear: 160, art: 180 }),
  trail: Object.freeze({ tier: 4, clear: 160, art: 150 }),
});

// Mass heights: every mass is taller than a shot (z34) so it is hard cover.
export const LAYOUT_V2_MASS_MATERIALS = Object.freeze({
  forest: Object.freeze({ maxZ: 180, color: 0x2f5a35, edge: 0x1d3a22 }),
  rock: Object.freeze({ maxZ: 160, color: 0x7d5a44, edge: 0x4d3527 }),
  building: Object.freeze({ maxZ: 220, color: 0x6a6660, edge: 0x3e3b37 }),
  container: Object.freeze({ maxZ: 150, color: 0x5c4b63, edge: 0x362b3b }),
  hedge: Object.freeze({ maxZ: 90, color: 0x3f6b39, edge: 0x27451f }),
  cover: Object.freeze({ maxZ: 72, color: 0x8a8578, edge: 0x55524a }),
});

const GATE_ROLES = new Set(['arena-lock', 'reward', 'secret', 'vault']);
const TERRACE_Z = 24;

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
  }
  return value;
}

function rectArea([minX, minY, maxX, maxY]) {
  if (!(maxX > minX && maxY > minY)) throw new TypeError(`layout rect must have positive area: ${[minX, minY, maxX, maxY]}`);
  return { type: 'rect', minX, minY, maxX, maxY };
}

function signedArea(vertices) {
  let twice = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

// Convex vertices in the winding the navgrid's inside test expects (positive
// signed area with y down: top-left, top-right, bottom-right, bottom-left).
export function layoutV2Vertices(piece) {
  let vertices;
  if (Array.isArray(piece.rect)) {
    const [minX, minY, maxX, maxY] = piece.rect;
    rectArea(piece.rect);
    vertices = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
  } else if (Array.isArray(piece.poly)) {
    vertices = piece.poly.map(([x, y]) => ({ x, y }));
  } else {
    throw new TypeError(`layout piece ${piece.id} needs rect or poly`);
  }
  if (signedArea(vertices) < 0) vertices.reverse();
  let sign = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const c = vertices[(i + 2) % vertices.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) continue;
    if (sign && Math.sign(cross) !== sign) throw new TypeError(`layout mass ${piece.id} must be convex`);
    sign = Math.sign(cross);
  }
  return vertices;
}

function areaOf(piece) {
  return Array.isArray(piece.rect) ? rectArea(piece.rect) : { type: 'polygon', vertices: layoutV2Vertices(piece) };
}

export function layoutV2PieceBounds(piece) {
  const vertices = layoutV2Vertices(piece);
  return {
    minX: Math.min(...vertices.map((v) => v.x)), minY: Math.min(...vertices.map((v) => v.y)),
    maxX: Math.max(...vertices.map((v) => v.x)), maxY: Math.max(...vertices.map((v) => v.y)),
  };
}

// Distance from a point to a blocker shape (0 inside). Shared by the checker's
// road-clearance sweep and cover rule.
export function layoutV2ShapeDistance(shape, x, y) {
  const segment = (a, b) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const length = abx * abx + aby * aby;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / length));
    return Math.hypot(x - (a.x + t * abx), y - (a.y + t * aby));
  };
  if (shape.type === 'circle') return Math.max(0, Math.hypot(x - shape.x, y - shape.y) - shape.radius);
  if (shape.type === 'capsule') return Math.max(0, segment(shape.a, shape.b) - shape.radius);
  const vertices = shape.vertices;
  let inside = true;
  let best = Infinity;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) < 0) inside = false;
    best = Math.min(best, segment(a, b));
  }
  return inside ? 0 : best;
}

function massBlocker(piece) {
  const material = LAYOUT_V2_MASS_MATERIALS[piece.material];
  if (!material) throw new TypeError(`layout mass ${piece.id} has unknown material ${piece.material}`);
  return createStaticBlocker({
    id: piece.id,
    shape: { type: 'polygon', vertices: layoutV2Vertices(piece) },
    visibleAssetId: `layout-v2-greybox-${piece.material}-${piece.id}`,
    minZ: 0,
    maxZ: piece.maxZ ?? material.maxZ,
    combatCover: true,
  });
}

function capsuleBlocker(id, a, b, radius, maxZ, kind) {
  return createStaticBlocker({
    id,
    shape: { type: 'capsule', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, radius },
    visibleAssetId: `layout-v2-greybox-${kind}-${id}`,
    minZ: 0,
    maxZ,
    combatCover: true,
  });
}

// A deck spans water or a chasm along `span` ('x' or 'y'). Raised decks get a
// 100-unit ramp at each end; rails are r14 combat-cover capsules 30 outside the
// long edges (the shipped Proof-of-Work bridge convention), over the water.
function deckPieces(deck) {
  const [minX, minY, maxX, maxY] = deck.rect;
  const z = deck.z ?? 0;
  const span = deck.span ?? 'x';
  const ramp = z > 0 ? (deck.rampLength ?? 100) : 0;
  const surfaces = [createElevationSurface({
    id: deck.surfaceId ?? `layout-v2-deck-${deck.id}`,
    kind: 'bridge',
    area: rectArea(deck.rect),
    groundZ: z,
    visibleTerrainId: `layout-v2-deck-${deck.id}`,
    visibleStepId: `layout-v2-deck-seam-${deck.id}`,
    priority: 4,
  })];
  if (ramp > 0) {
    const near = span === 'x' ? [minX - ramp, minY, minX, maxY] : [minX, minY - ramp, maxX, minY];
    const far = span === 'x' ? [maxX, minY, maxX + ramp, maxY] : [minX, maxY, maxX, maxY + ramp];
    surfaces.push(createElevationSurface({ id: `layout-v2-deck-${deck.id}-near-ramp`, kind: 'ramp', area: rectArea(near), fromZ: 0, toZ: z, axis: span, visibleTerrainId: `layout-v2-deck-${deck.id}-near-ramp`, priority: 5 }));
    surfaces.push(createElevationSurface({ id: `layout-v2-deck-${deck.id}-far-ramp`, kind: 'ramp', area: rectArea(far), fromZ: z, toZ: 0, axis: span, visibleTerrainId: `layout-v2-deck-${deck.id}-far-ramp`, priority: 5 }));
  }
  const blockers = [];
  if (deck.rails !== false) {
    const inset = deck.railInset ?? 20;
    if (span === 'x') {
      blockers.push(capsuleBlocker(`${deck.id}-north-rail`, [minX + inset, minY - 30], [maxX - inset, minY - 30], 14, 72, 'bridge-rail'));
      blockers.push(capsuleBlocker(`${deck.id}-south-rail`, [minX + inset, maxY + 30], [maxX - inset, maxY + 30], 14, 72, 'bridge-rail'));
    } else {
      blockers.push(capsuleBlocker(`${deck.id}-west-rail`, [minX - 30, minY + inset], [minX - 30, maxY - inset], 14, 72, 'bridge-rail'));
      blockers.push(capsuleBlocker(`${deck.id}-east-rail`, [maxX + 30, minY + inset], [maxX + 30, maxY - inset], 14, 72, 'bridge-rail'));
    }
  }
  return { surfaces, blockers };
}

function terracePieces(terrace) {
  const surfaces = [createElevationSurface({
    id: `layout-v2-terrace-${terrace.id}`,
    kind: 'ledge',
    area: areaOf(terrace),
    groundZ: terrace.z ?? TERRACE_Z,
    oneWayDrop: { x: 0, y: 1 },
    visibleTerrainId: `layout-v2-terrace-${terrace.id}`,
    visibleStepId: `layout-v2-terrace-edge-${terrace.id}`,
    priority: 3,
  })];
  for (const ramp of terrace.ramps ?? []) {
    // `top` names the edge that meets the terrace; the far edge meets z0.
    const axis = ramp.top === 'north' || ramp.top === 'south' ? 'y' : 'x';
    const high = terrace.z ?? TERRACE_Z;
    const topAtMin = ramp.top === 'north' || ramp.top === 'west';
    surfaces.push(createElevationSurface({
      id: `layout-v2-ramp-${ramp.id}`,
      kind: ramp.stairs ? 'stairs' : 'ramp',
      area: rectArea(ramp.rect),
      fromZ: topAtMin ? high : 0,
      toZ: topAtMin ? 0 : high,
      axis,
      visibleTerrainId: `layout-v2-ramp-${ramp.id}`,
      priority: 5,
    }));
  }
  return surfaces;
}

// Gates are capsules across a mouth. `open` decides whether one is solid in
// this build: a predicate over the gate, or 'closed' / 'open' for all.
function gateIsOpen(gate, open) {
  if (open === 'open') return true;
  if (open === 'closed' || open == null) return false;
  if (typeof open === 'function') return Boolean(open(gate));
  if (open instanceof Set) return open.has(gate.id);
  throw new TypeError('gate state must be open, closed, a Set of ids or a predicate');
}

export function buildLayoutV2World(layout, { gates = 'closed' } = {}) {
  if (!layout || typeof layout !== 'object') throw new TypeError('layout is required');
  const bounds = layout.bounds ?? LAYOUT_V2_BOUNDS;
  const ids = new Set();
  const claim = (id) => {
    if (typeof id !== 'string' || !id) throw new TypeError('layout piece id must be a non-empty string');
    if (ids.has(id)) throw new TypeError(`duplicate layout piece id ${id}`);
    ids.add(id);
  };
  const surfaces = [];
  const collisionBlockers = [];
  const gateBlockers = [];
  for (const piece of layout.water ?? []) {
    claim(piece.id);
    const deep = piece.depth !== 'shallow';
    surfaces.push(createElevationSurface({
      id: piece.surfaceId ?? `layout-v2-water-${piece.id}`,
      kind: deep ? 'water' : 'shallow-water',
      area: areaOf(piece),
      groundZ: deep ? -24 : 0,
      waterLevel: 4,
      deepWater: deep,
      walkable: !deep,
      visibleTerrainId: `layout-v2-water-${piece.id}`,
      priority: deep ? 1 : 2,
    }));
  }
  for (const piece of layout.chasms ?? []) {
    claim(piece.id);
    // Chasms follow the deep-water rules (section 2.4): unwalkable, bridged.
    surfaces.push(createElevationSurface({ id: `layout-v2-chasm-${piece.id}`, kind: 'water', area: areaOf(piece), groundZ: -24, deepWater: true, walkable: false, visibleTerrainId: `layout-v2-chasm-${piece.id}`, priority: 1 }));
  }
  for (const piece of layout.grounds ?? []) {
    claim(piece.id);
    surfaces.push(createElevationSurface({ id: `layout-v2-ground-${piece.id}`, kind: 'ground', area: areaOf(piece), groundZ: 0, visibleTerrainId: `layout-v2-ground-${piece.id}`, priority: 3 }));
  }
  for (const terrace of layout.terraces ?? []) {
    claim(terrace.id);
    for (const ramp of terrace.ramps ?? []) claim(ramp.id);
    surfaces.push(...terracePieces(terrace));
  }
  for (const deck of layout.decks ?? []) {
    claim(deck.id);
    const built = deckPieces(deck);
    surfaces.push(...built.surfaces);
    collisionBlockers.push(...built.blockers);
  }
  for (const mass of layout.masses ?? []) {
    claim(mass.id);
    collisionBlockers.push(massBlocker(mass));
  }
  for (const gate of layout.gates ?? []) {
    claim(gate.id);
    if (!GATE_ROLES.has(gate.role)) throw new TypeError(`gate ${gate.id} has unknown role ${gate.role}`);
    const blocker = capsuleBlocker(gate.id, gate.a, gate.b, gate.radius ?? 24, gate.maxZ ?? 120, `gate-${gate.role}`);
    gateBlockers.push(blocker);
    if (!gateIsOpen(gate, gates)) collisionBlockers.push(blocker);
  }
  for (const road of layout.roads ?? []) {
    claim(road.id);
    if (!LAYOUT_V2_ROAD_TIERS[road.tier]) throw new TypeError(`road ${road.id} has unknown tier ${road.tier}`);
    if (!Array.isArray(road.points) || road.points.length < 2) throw new TypeError(`road ${road.id} needs two points`);
  }
  for (const surface of surfaces) {
    const top = Math.max(surface.groundZ, surface.fromZ, surface.toZ);
    if (top > TERRACE_Z) throw new TypeError(`surface ${surface.id} exceeds the z24 walkable cap`);
  }
  const baseSurface = createElevationSurface({ id: 'layout-v2-ground', kind: 'ground', area: rectArea([bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]), groundZ: 0, visibleTerrainId: 'layout-v2-ground', priority: 0 });
  const queryGround = createAuthoredGroundQuery({ baseSurface, surfaces });
  return freezeDeep({
    id: layout.id,
    bounds,
    districts: layout.districts,
    surfaces,
    collisionBlockers,
    gateBlockers,
    queryGround,
    layout,
  });
}

export function layoutV2RoadClearWidth(road) {
  return road.clear ?? LAYOUT_V2_ROAD_TIERS[road.tier].clear;
}

export function layoutV2RoadLength(road) {
  let length = 0;
  for (let i = 1; i < road.points.length; i += 1) length += Math.hypot(road.points[i][0] - road.points[i - 1][0], road.points[i][1] - road.points[i - 1][1]);
  return length;
}

// Evenly spaced samples along a road polyline, each with its unit normal.
export function layoutV2RoadSamples(road, step = 20) {
  const samples = [];
  for (let i = 1; i < road.points.length; i += 1) {
    const [ax, ay] = road.points[i - 1];
    const [bx, by] = road.points[i];
    const length = Math.hypot(bx - ax, by - ay);
    const count = Math.max(1, Math.ceil(length / step));
    const nx = -(by - ay) / length;
    const ny = (bx - ax) / length;
    for (let k = i === 1 ? 0 : 1; k <= count; k += 1) {
      const t = k / count;
      samples.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx, ny, segment: i - 1 });
    }
  }
  return samples;
}
