// Area-art plan schema, validator, material registry and pure placement
// helpers for the ten-area world. Plans are frozen data; this module never
// touches Pixi, the network or the simulation. Everything here is
// projection-only: a plan cannot add a blocker, surface, objective or rule.
import { freezeDeep } from './value-guards.mjs';

export const AREA_ART_SCHEMA = 'hmh-area-art-plan/v1';
export const AREA_ART_KIT_ROOT = '/assets/generated/hmh-reboot-tripo-props-hd/';
export const AREA_ART_KIT_MANIFEST = 'hmh-tripo-props-hd.json';
export const AREA_ART_KIT_PIPELINE = 'hmh-tripo-static-props-hd/v1';
export const AREA_ART_TILE_ROOT = '/assets/generated/hmh-terrain-tiles/';
export const AREA_ART_DETAIL_ROOT = '/assets/generated/hmh-art-target/';
export const AREA_ART_DETAIL_PAGE = 'ground-details.webp';
export const AREA_ART_KIT_PAGE_BUDGET = 2;
// The props page dresses every road, so it is resident world-wide and does not
// count against an area's exclusive page budget. Worst case per area is
// therefore three kit pages: two exclusive plus this shared one.
export const AREA_ART_SHARED_KIT_PAGES = Object.freeze(['tripo-props-hd-props-00.webp']);
export const WORLD_ROADS_PLAN_ID = 'world-roads';
export const ROAD_KINDS = Object.freeze(['paved', 'gravel', 'dirt']);
export const SOLID_STYLES = Object.freeze(['card', 'bank', 'stakes', 'crates', 'pickets', 'hedge', 'mass']);

// Every tileable ground material maps onto an existing 512 px terrain tile and
// its 512x128 fringe (opaque at v=0, transparent at v=128). `base` is a flat
// colour painted under the tile so a dark tile can still read lighter (tints
// only darken); `alpha` is the tile's alpha over that base.
export const AREA_ART_MATERIALS = freezeDeep({
  grass: { tile: 'forest-floor', base: 0x6c7a58, tint: 0xd2d1a4, alpha: 0.72, scale: 0.7 },
  meadow: { tile: 'forest-floor', base: 0x7a8464, tint: 0xd8d6ae, alpha: 0.6, scale: 0.7 },
  earth: { tile: 'packed-earth', base: 0x7a6a4f, tint: 0xd8cbb0, alpha: 0.88, scale: 0.5 },
  sand: { tile: 'packed-earth', base: 0xb2a887, tint: 0xf2ecd8, alpha: 0.55, scale: 0.55 },
  rock: { tile: 'ledge-top', base: 0x7c7a6f, tint: 0xd6d3c8, alpha: 0.9, scale: 0.5 },
  marsh: { tile: 'wet-bank', base: 0x4e5744, tint: 0xc4c8a8, alpha: 0.85, scale: 0.6 },
  paving: { tile: 'industrial-slab', base: 0x8d8f86, tint: 0xd6d6cc, alpha: 0.92, scale: 0.45 },
  boardwalk: { tile: 'bridge-deck', base: 0x7c6a4e, tint: 0xd4c6a4, alpha: 0.95, scale: 0.35 },
  asphalt: { tile: 'road', base: 0x494f4d, tint: 0xd6dad6, alpha: 0.95, scale: 0.5 },
  gravel: { tile: 'crushed-ore', base: 0x9a8f78, tint: 0xd6c6aa, alpha: 0.62, scale: 0.4 },
  dirt: { tile: 'packed-earth', base: 0x6b5b44, tint: 0xb9a888, alpha: 0.9, scale: 0.45 },
  forest: { tile: 'forest-floor', base: 0x5c6544, tint: 0xc6c1a0, alpha: 0.72, scale: 0.72 },
});
export const AREA_ART_MATERIAL_IDS = Object.freeze(Object.keys(AREA_ART_MATERIALS));

// Road material recipe by authored kind. `core` carries the tread, `shoulder`
// the verge, `halo` the worn edge feathered into the surrounding ground.
export const ROAD_RECIPES = freezeDeep({
  paved: { core: 'asphalt', shoulder: 'gravel', shoulderWidth: 56, haloWidth: 70, haloAlpha: 0.5, tracks: 0.16, ruts: false, cracks: true },
  gravel: { core: 'gravel', shoulder: 'earth', shoulderWidth: 44, haloWidth: 80, haloAlpha: 0.55, tracks: 0.1, ruts: false, cracks: false },
  dirt: { core: 'dirt', shoulder: 'earth', shoulderWidth: 24, haloWidth: 90, haloAlpha: 0.6, tracks: 0, ruts: true, cracks: false },
});

// The bible's restrained foliage green is 0x65735a. The three teal fantasy
// trees are pulled toward it; the stump's teal sprout is warmed. Tints are
// multiplicative, so these are applied on top of any plan tint.
export const FOLIAGE_TINT_RULES = freezeDeep({
  'b1-50': 0xbcc47a, 'b1-54': 0xb8c07c, 'b1-55': 0xbec67a, 'b1-49': 0xd6c7a7,
  'b2-52': 0x9fa4a0, 'b1-08': 0xd9d2c6, 'b1-07': 0xd2d4c2,
});

const CUE_HUES = [[0, 55, 'red/orange enemy tells'], [40, 68, 'gold pickups'], [165, 205, 'cyan pickups']];
// A decorative tint may not read as a cue swatch. Only saturated tints matter;
// pale multiplicative tints stay far below the guard.
export function assertDecorativeTint(tint, name) {
  if (!Number.isInteger(tint) || tint < 0 || tint > 0xffffff) throw new TypeError(`${name} must be an rgb integer`);
  const r = (tint >> 16 & 255) / 255, g = (tint >> 8 & 255) / 255, b = (tint & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;
  if (saturation < 0.42) return tint;
  let hue = delta === 0 ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  for (const [from, to, reserve] of CUE_HUES) if (hue >= from && hue <= to) throw new TypeError(`${name} uses a reserved cue colour (${reserve})`);
  return tint;
}

const fail = message => { throw new TypeError(`area art plan: ${message}`); };
const finite = (value, name) => { if (!Number.isFinite(value)) fail(`${name} must be finite`); return value; };
const positive = (value, name) => { finite(value, name); if (value <= 0) fail(`${name} must be positive`); return value; };
const label = (value, name) => { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9:_-]*$/i.test(value)) fail(`${name} must be a short id`); return value; };
const point = (value, name) => ({ x: finite(value?.x, `${name}.x`), y: finite(value?.y, `${name}.y`) });
const polyline = (value, name, min = 2) => {
  if (!Array.isArray(value) || value.length < min) fail(`${name} needs at least ${min} points`);
  const points = value.map((p, i) => point(p, `${name}[${i}]`));
  for (let i = 1; i < points.length; i++) if (points[i].x === points[i - 1].x && points[i].y === points[i - 1].y) fail(`${name} has a zero-length segment`);
  return points;
};
const boundsOf = (value, name) => {
  const bounds = Object.fromEntries(['minX', 'minY', 'maxX', 'maxY'].map(key => [key, finite(value?.[key], `${name}.${key}`)]));
  if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) fail(`${name} must be ordered`);
  return bounds;
};
const unique = (rows, name) => { const ids = new Set(); for (const row of rows) { label(row.id, `${name}.id`); if (ids.has(row.id)) fail(`${name} repeats id ${row.id}`); ids.add(row.id); } };
const optionalTint = (value, name) => value === undefined ? 0xffffff : assertDecorativeTint(value, name);
const material = (value, name) => { if (!AREA_ART_MATERIALS[value]) fail(`${name} must be a known material`); return value; };

export function resolveKitItem(kit, assetId) {
  const item = kit?.items?.find(entry => entry.assetId === assetId);
  if (!item) fail(`kit item ${assetId} does not exist`);
  return item;
}

function assertKit(kit) {
  if (kit?.pipelineId !== AREA_ART_KIT_PIPELINE || kit.runtimeAuthority !== 'projection-only' || !Array.isArray(kit.pages) || !Array.isArray(kit.items)) fail('HD prop kit manifest required');
  if (kit.artAccepted !== false || kit.canonicalAdoption !== false) fail('kit must remain an unaccepted projection-only candidate');
}

// Validate a plan against the HD kit manifest. Returns a frozen summary with
// the page set and byte budget; throws on any structural or authority error.
export function validateAreaArtPlan(plan, kit) {
  if (!plan || typeof plan !== 'object') fail('plan object required');
  if (plan.schema !== AREA_ART_SCHEMA) fail(`schema must be ${AREA_ART_SCHEMA}`);
  if (plan.runtimeAuthority !== 'projection-only' || plan.artAccepted !== false) fail('plan must declare projection-only authority and artAccepted false');
  label(plan.areaId, 'areaId');
  const roadsPlan = plan.areaId === WORLD_ROADS_PLAN_ID;
  const bounds = boundsOf(plan.bounds, 'bounds');
  assertKit(kit);
  if (!Array.isArray(plan.pages) || plan.pages.some(page => typeof page !== 'string')) fail('pages must list kit page images');
  const pageSet = new Set(plan.pages);
  if (pageSet.size !== plan.pages.length) fail('pages repeat');
  for (const page of plan.pages) if (!kit.pages.some(entry => entry.image === page)) fail(`unknown kit page ${page}`);
  const budget = roadsPlan ? 1 : AREA_ART_KIT_PAGE_BUDGET, exclusivePages = plan.pages.filter(page => roadsPlan || !AREA_ART_SHARED_KIT_PAGES.includes(page));
  if (exclusivePages.length > budget) fail(`plan uses ${exclusivePages.length} exclusive kit pages; budget is ${budget}`);
  if (roadsPlan && plan.pages.some(page => !AREA_ART_SHARED_KIT_PAGES.includes(page))) fail('the world roads plan may only load the shared props page');
  const inside = (p, name) => { if (p.x < bounds.minX || p.x > bounds.maxX || p.y < bounds.minY || p.y > bounds.maxY) fail(`${name} lies outside plan bounds`); };
  const usedPages = new Set(), materials = new Set(), sources = new Set();
  const source = (assetId, name) => {
    const item = resolveKitItem(kit, label(assetId, name));
    if (!pageSet.has(item.pageImage)) fail(`${name} ${assetId} lives on ${item.pageImage}, which the plan does not load`);
    usedPages.add(item.pageImage); sources.add(assetId);
    return item;
  };

  const ground = plan.ground ?? {};
  if (typeof ground !== 'object') fail('ground must be an object');
  let base = null;
  if (ground.base !== undefined && ground.base !== null) {
    base = { surfaceId: label(ground.base.surfaceId, 'ground.base.surfaceId'), material: material(ground.base.material, 'ground.base.material'), tint: optionalTint(ground.base.tint, 'ground.base.tint') };
    materials.add(base.material);
  }
  const zones = (ground.zones ?? []).map((zone, i) => {
    const name = `ground.zones[${i}]`;
    const vertices = polyline(zone.vertices, `${name}.vertices`, 3);
    vertices.forEach((v, j) => inside(v, `${name}.vertices[${j}]`));
    materials.add(material(zone.material, `${name}.material`));
    return { id: zone.id, material: zone.material, vertices, feather: zone.feather === undefined ? 48 : positive(zone.feather, `${name}.feather`), alpha: zone.alpha === undefined ? 1 : clampUnit(zone.alpha, `${name}.alpha`), tint: optionalTint(zone.tint, `${name}.tint`) };
  });
  unique(zones, 'ground.zones');
  const trails = (ground.trails ?? []).map((trail, i) => {
    const name = `ground.trails[${i}]`;
    const points = polyline(trail.points, `${name}.points`);
    points.forEach((p, j) => inside(p, `${name}.points[${j}]`));
    materials.add(material(trail.material, `${name}.material`));
    const width = positive(trail.width, `${name}.width`);
    if (width > 160) fail(`${name}.width exceeds a worn trail`);
    return { id: trail.id, material: trail.material, points, width, halo: trail.halo === undefined ? 18 : positive(trail.halo, `${name}.halo`) };
  });
  unique(trails, 'ground.trails');
  const decals = (ground.decals ?? []).map((decal, i) => {
    const name = `ground.decals[${i}]`;
    if (!['detail:grass', 'detail:aggregate'].includes(decal.source)) fail(`${name}.source must be a ground detail frame`);
    const at = point(decal, name); inside(at, name);
    return { id: decal.id, source: decal.source, ...at, scale: decal.scale === undefined ? 1 : positive(decal.scale, `${name}.scale`), rotation: decal.rotation === undefined ? 0 : finite(decal.rotation, `${name}.rotation`), alpha: decal.alpha === undefined ? 0.8 : clampUnit(decal.alpha, `${name}.alpha`), tint: optionalTint(decal.tint, `${name}.tint`), flip: decal.flip === true };
  });
  unique(decals, 'ground.decals');
  if (decals.length > 512) fail('ground.decals exceeds 512 instances');

  const roads = (plan.roads ?? []).map((road, i) => {
    const name = `roads[${i}]`;
    if (!roadsPlan) fail('only the world roads plan may author roads');
    if (!ROAD_KINDS.includes(road.kind)) fail(`${name}.kind must be paved, gravel or dirt`);
    const points = polyline(road.points, `${name}.points`);
    points.forEach((p, j) => inside(p, `${name}.points[${j}]`));
    const recipe = ROAD_RECIPES[road.kind];
    materials.add(recipe.core); materials.add(recipe.shoulder);
    return { id: road.id, roadId: label(road.roadId, `${name}.roadId`), kind: road.kind, points, width: positive(road.width, `${name}.width`), surfaceIds: Object.freeze([...(road.surfaceIds ?? [])].map(id => label(id, `${name}.surfaceIds`))), cracks: Object.freeze((road.cracks ?? []).map((crack, j) => { const at = point(crack, `${name}.cracks[${j}]`); inside(at, `${name}.cracks[${j}]`); return { ...at, scale: crack.scale === undefined ? 1 : positive(crack.scale, `${name}.cracks[${j}].scale`), flip: crack.flip === true }; })) };
  });
  unique(roads, 'roads');
  if (roads.some(road => road.cracks.length)) source('b2-47', 'roads.cracks');

  const props = (plan.props ?? []).map((prop, i) => {
    const name = `props[${i}]`;
    const item = source(prop.source, `${name}.source`);
    if (item.class === 'pickups') fail(`${name} may not decorate with a pickup card (${prop.source})`);
    const at = point(prop, name); inside(at, name);
    const height = positive(prop.height, `${name}.height`);
    if (height > 900) fail(`${name}.height exceeds the tallest structure`);
    return { id: prop.id, source: prop.source, ...at, height, groundZ: prop.groundZ === undefined ? 0 : finite(prop.groundZ, `${name}.groundZ`), tint: optionalTint(prop.tint, `${name}.tint`), flip: prop.flip === true, shadow: prop.shadow !== false, fade: prop.fade === undefined ? height > 150 : prop.fade === true };
  });
  unique(props, 'props');
  if (props.length > 2048) fail('props exceeds 2048 instances');

  const solids = (plan.solids ?? []).map((solid, i) => {
    const name = `solids[${i}]`;
    label(solid.pieceId, `${name}.pieceId`);
    const style = solid.style ?? 'card';
    if (!SOLID_STYLES.includes(style)) fail(`${name}.style must be one of ${SOLID_STYLES.join(', ')}`);
    let card = null;
    if (['card', 'hedge'].includes(style)) {
      const item = source(solid.source, `${name}.source`);
      if (item.class === 'pickups') fail(`${name} may not decorate with a pickup card`);
      card = { source: solid.source, fit: solid.fit === undefined ? 'width' : solid.fit, lift: solid.lift === undefined ? 0 : finite(solid.lift, `${name}.lift`) };
      if (!['width', 'height', 'depth'].includes(card.fit)) fail(`${name}.fit must be width, height or depth`);
    }
    const roof = solid.roof === undefined ? null : material(solid.roof, `${name}.roof`);
    if (roof) materials.add(roof);
    return { id: solid.pieceId, pieceId: solid.pieceId, style, card, roof, tint: optionalTint(solid.tint, `${name}.tint`), massAlpha: solid.massAlpha === undefined ? (style === 'card' ? 0.32 : ['bank', 'mass'].includes(style) ? 1 : 0) : clampUnit(solid.massAlpha, `${name}.massAlpha`), spacing: solid.spacing === undefined ? 0 : positive(solid.spacing, `${name}.spacing`), height: solid.height === undefined ? null : positive(solid.height, `${name}.height`) };
  });
  unique(solids, 'solids');

  for (const page of plan.pages) if (!usedPages.has(page)) fail(`plan loads unused kit page ${page}`);
  const pages = plan.pages.map(image => kit.pages.find(entry => entry.image === image));
  const encodedBytes = pages.reduce((n, page) => n + page.encodedBytes, 0), decodedBytes = pages.reduce((n, page) => n + page.decodedBytes, 0);
  const halfEncodedBytes = pages.reduce((n, page) => n + page.halfRes.encodedBytes, 0), halfDecodedBytes = pages.reduce((n, page) => n + page.halfRes.decodedBytes, 0);
  const tiles = [...new Set([...materials].map(id => AREA_ART_MATERIALS[id].tile))].sort();
  return freezeDeep({
    schema: AREA_ART_SCHEMA, areaId: plan.areaId, roadsPlan, bounds, pages: plan.pages.slice(), sources: [...sources].sort(), materials: [...materials].sort(), tiles,
    detailPage: decals.length > 0, base, zones, trails, decals, roads, props, solids,
    counts: { zones: zones.length, trails: trails.length, decals: decals.length, roads: roads.length, props: props.length, solids: solids.length },
    budget: { kitPages: plan.pages.length, exclusiveKitPages: exclusivePages.length, kitPageBudget: budget, encodedBytes, decodedBytes, halfEncodedBytes, halfDecodedBytes, tilePages: tiles.length * 2 + (decals.length ? 1 : 0), tileDecodedBytes: tiles.length * (512 * 512 * 4 + 512 * 128 * 4) + (decals.length ? 256 * 256 * 4 : 0) },
  });
}
function clampUnit(value, name) { finite(value, name); if (value < 0 || value > 1) fail(`${name} must be within 0..1`); return value; }

// ---- pure geometry used by plans, tests and the renderer ----
export const pointInPolygon = (x, y, vertices) => {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
export const distanceToSegment = (x, y, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy;
  const t = d ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / d)) : 0;
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
};
export const distanceToPolyline = (x, y, points) => { let best = Infinity; for (let i = 1; i < points.length; i++) best = Math.min(best, distanceToSegment(x, y, points[i - 1], points[i])); return best; };
export const polygonBounds = vertices => ({ minX: Math.min(...vertices.map(p => p.x)), minY: Math.min(...vertices.map(p => p.y)), maxX: Math.max(...vertices.map(p => p.x)), maxY: Math.max(...vertices.map(p => p.y)) });
export const rectVertices = b => [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }];

// A single mitered polygon around a polyline: no overlapping segment quads, so
// translucent fills never double up at joins. Ends are squared.
export function ribbonPolygon(points, width) {
  const half = width / 2, left = [], right = [];
  const normal = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1; return { x: -dy / len, y: dx / len }; };
  for (let i = 0; i < points.length; i++) {
    const p = points[i], before = i > 0 ? normal(points[i - 1], p) : null, after = i < points.length - 1 ? normal(p, points[i + 1]) : null;
    let nx, ny, scale = 1;
    if (before && after) {
      nx = before.x + after.x; ny = before.y + after.y;
      const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      const dot = nx * after.x + ny * after.y; scale = 1 / Math.max(0.35, dot);
    } else { const n = before ?? after; nx = n.x; ny = n.y; }
    left.push({ x: p.x + nx * half * scale, y: p.y + ny * half * scale });
    right.push({ x: p.x - nx * half * scale, y: p.y - ny * half * scale });
  }
  return [...left, ...right.reverse()];
}

// Offset a simple polygon outward along vertex bisectors (positive grows).
export function offsetPolygon(vertices, distance) {
  const n = vertices.length, signed = vertices.reduce((sum, p, i) => { const q = vertices[(i + 1) % n]; return sum + p.x * q.y - p.y * q.x; }, 0);
  const orientation = signed >= 0 ? 1 : -1;
  return vertices.map((p, i) => {
    const prev = vertices[(i + n - 1) % n], next = vertices[(i + 1) % n];
    const e1 = norm(p.x - prev.x, p.y - prev.y), e2 = norm(next.x - p.x, next.y - p.y);
    const n1 = { x: e1.y * orientation, y: -e1.x * orientation }, n2 = { x: e2.y * orientation, y: -e2.x * orientation };
    let bx = n1.x + n2.x, by = n1.y + n2.y; const len = Math.hypot(bx, by) || 1; bx /= len; by /= len;
    const scale = 1 / Math.max(0.35, bx * n1.x + by * n1.y);
    return { x: p.x + bx * distance * scale, y: p.y + by * distance * scale };
  });
}
const norm = (x, y) => { const len = Math.hypot(x, y) || 1; return { x: x / len, y: y / len }; };

// Deterministic 0..1 hash so plans place the same instances on every machine.
export function stableUnit(...keys) {
  let h = 2166136261;
  for (const key of keys) { const text = String(key); for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; }
  return ((h >>> 0) % 1000003) / 1000003;
}

// Placement guard over the authored world: a decoration may not stand inside a
// blocker, in water, in a road corridor, on an inspection route, or in spawn /
// objective / arena-exit clearance. Returns `clear(x, y, radius)`.
export function createPlacementGuard({ world, areaId = null, roadClearance = 1, routeClearance = 64, siteClearance = 140, spawnClearance = null } = {}) {
  if (!world?.pieces || !world.roads || !world.sites) throw new TypeError('authored world required');
  const blockers = world.pieces.filter(piece => piece.blocker).map(piece => ({ vertices: piece.blocker.shape.vertices, bounds: piece.visible.bounds }));
  const water = world.pieces.filter(piece => piece.kind === 'water').map(piece => piece.visible.vertices ?? rectVertices(piece.visible.bounds));
  const roads = world.roads.map(road => ({ points: road.points, half: road.width / 2 }));
  const routes = world.areas.filter(area => !areaId || area.id === areaId).flatMap(area => area.inspectionRoutes ?? []).map(route => route.points);
  const sites = world.sites.filter(site => (!areaId || site.areaId === areaId) && ['objective', 'arena-exit', 'entrance', 'secret', 'height-option', 'area'].includes(site.kind)).map(site => ({ x: site.x, y: site.y, kind: site.kind }));
  const spawn = world.spawn ? { x: world.spawn.x, y: world.spawn.y, radius: spawnClearance ?? world.protectedSpawnRadius ?? 560 } : null;
  const nearBounds = (b, x, y, r) => x >= b.minX - r && x <= b.maxX + r && y >= b.minY - r && y <= b.maxY + r;
  const inflated = (x, y, vertices, r) => pointInPolygon(x, y, vertices) || vertices.some((a, i) => distanceToSegment(x, y, a, vertices[(i + 1) % vertices.length]) < r);
  function clear(x, y, radius = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    for (const blocker of blockers) if (nearBounds(blocker.bounds, x, y, radius) && inflated(x, y, blocker.vertices, radius)) return false;
    for (const vertices of water) if (inflated(x, y, vertices, radius)) return false;
    for (const road of roads) if (distanceToPolyline(x, y, road.points) < road.half * roadClearance + radius) return false;
    for (const points of routes) if (distanceToPolyline(x, y, points) < routeClearance + radius) return false;
    for (const site of sites) if (Math.hypot(site.x - x, site.y - y) < siteClearance + radius) return false;
    if (spawn && Math.hypot(spawn.x - x, spawn.y - y) < spawn.radius) return false;
    return true;
  }
  const blockedAt = (x, y) => blockers.some(blocker => nearBounds(blocker.bounds, x, y, 0) && pointInPolygon(x, y, blocker.vertices));
  return Object.freeze({ clear, blockedAt, counts: Object.freeze({ blockers: blockers.length, water: water.length, roads: roads.length, routes: routes.length, sites: sites.length }) });
}

export function createAreaArtPlanShell({ areaId, bounds, pages }) {
  return { schema: AREA_ART_SCHEMA, areaId, runtimeAuthority: 'projection-only', artAccepted: false, bounds: { ...bounds }, pages: [...pages], ground: { base: null, zones: [], trails: [], decals: [] }, roads: [], props: [], solids: [] };
}
