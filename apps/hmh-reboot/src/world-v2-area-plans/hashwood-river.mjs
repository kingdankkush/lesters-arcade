// Hashwood River dressing plan (brief 06): tall conifers on the enclosed banks,
// iris along the damp channel edges (the renderer draws both stone crossings
// over the water), exposed rock and a rock arch on the waterfall shelf, and a worn
// theatrical clearing for the Baron's marquee. Frozen data only; the plan never
// adds a blocker, surface, objective or rule.
//
// Page budget: plants-00 + structures-01 (+ shared props-00).
import { freezeDeep } from '../value-guards.mjs';
import { appendCentrePockets } from './centre-pockets.mjs';
import { pointInPolygon, stableUnit, DISTRICT_TERRAIN } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext, CANOPY_HEIGHTS } from './plan-support.mjs';

export const HASHWOOD_RIVER_PAGES = Object.freeze(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-01.webp', 'tripo-props-hd-props-00.webp']);
// Cool stone tint pulls the warm sandstone cards toward the brief's rock #77796D.
export const RIVER_STONE_TINT = 0x9cacb4;
const CONIFERS = ['b2-72', 'b1-50', 'b2-72', 'b2-72', 'b1-50', 'b2-72', 'b1-50'];
const CONIFER_TINT = Object.freeze({ 'b2-72': 0xd6dcc0, 'b1-50': 0xe6e2cc });
// Enclosed-bank groves off every route and crossing silhouette.
const GROVES = [[-620, -1500, 220, 160], [520, -1450, 300, 170], [950, -1560, 200, 140], [1760, -1420, 150, 200], [-250, -1650, 180, 120],
  [720, 520, 260, 200], [1520, 700, 220, 200], [1720, 1500, 220, 220], [420, 1500, 300, 200], [-120, 1800, 200, 150], [1120, 1200, 200, 160], [-1820, 600, 150, 200], [-1750, 1800, 150, 150]];
// Channel edge polylines (relative) used for the riverbank iris.
const NORTH_EDGE = [[-2000, -720], [-1400, -690], [-1000, -620], [1700, -620], [2000, -720]];
const SOUTH_EDGE = [[-2000, -390], [-1400, -340], [-1000, -280], [1700, -280], [2000, -360]];

export function createHashwoodRiverArtPlan(world) {
  const context = createAreaPlanContext(world, 'hashwood-river', { pages: HASHWOOD_RIVER_PAGES, margin: 260, routeClearance: 70 });
  if (!context) return null;
  const { area, plan, point, prop, solid, scatter, guard, supportAt, insideWorld, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'forest' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  // Damp bank edges either side of the channel, exposed stone at the shelf foot,
  // and the trodden marquee clearing. Bridge approaches and the capstan apron
  // are carried by the route trails (pass-1 rectangles read as hard patches).
  plan.ground.zones.push(
    { id: 'north-bank', material: 'marsh', feather: 70, alpha: 0.6, vertices: [point(-2000, -830), point(-1400, -800), point(-1000, -730), point(1700, -730), point(2000, -830), point(2000, -720), point(1700, -620), point(-1000, -620), point(-1400, -690), point(-2000, -720)] },
    { id: 'south-bank', material: 'marsh', feather: 70, alpha: 0.6, vertices: [point(-2000, -390), point(-1400, -340), point(-1000, -280), point(1700, -280), point(2000, -360), point(2000, -250), point(1700, -170), point(-1000, -170), point(-1400, -230), point(-2000, -280)] },
    { id: 'shelf-foot', material: 'rock', feather: 80, alpha: 0.7, vertices: [point(-2000, -1380), point(-1420, -1330), point(-1280, -960), point(-1560, -760), point(-2000, -880)] },
    { id: 'marquee-ground', material: 'dirt', feather: 120, alpha: 0.45, vertices: [point(-1500, 500), point(-300, 500), point(-250, 1500), point(-700, 1800), point(-1300, 1800), point(-1550, 1400)] },
  );
  for (const segment of routeSegments) plan.ground.trails.push({ id: `trail-${plan.ground.trails.length}`, material: 'earth', points: [segment.a, segment.b], width: segment.kind === 'main' ? 52 : 40, halo: 16 });
  // Authored solids: the shelf reads as stratified rock, the capstan house as a
  // winch house, the marquee as a worn covered stall row between timber posts.
  solid('waterfall-shelf', 'bank', { roof: 'rock', tint: 0xd6d8d2 });
  solid('capstan-house', 'card', { source: 'b2-67', fit: 'height', tint: 0xd2d4cc });
  solid('marquee-backing', 'card', { source: 'b1-13', fit: 'width', tint: 0xd6cfc4 });
  solid('marquee-west-post', 'stakes', { tint: 0xcdbfae, spacing: 30 });
  solid('marquee-east-post', 'stakes', { tint: 0xcdbfae, spacing: 30 });
  solid('court-low-stack', 'hedge', { source: 'b2-79', spacing: 80, tint: 0xd8cfbd });
  solid('court-tall-screen', 'stakes', { tint: 0xc9bfae, spacing: 28 });
  // The two authored crossings are drawn by the renderer from their surfaces
  // (stone deck, rails, shadow over the water; world-v2-area-surfaces.mjs), so
  // no standing arch card stands in for them any more.
  for (const name of ['city', 'woods']) if (!context.piece(`${name}-bridge`)) throw new Error(`hashwood-river plan requires the authored ${name} bridge`);
  // Tall conifers root on the shelf top and on the closed woodland beyond the
  // area edge; road mouths stay open because those cells are not closed land.
  const shelf = context.piece('waterfall-shelf');
  let n = 0;
  for (let y = shelf.visible.bounds.minY + 70; y < shelf.visible.bounds.maxY; y += 140) for (let x = shelf.visible.bounds.minX + 70; x < shelf.visible.bounds.maxX; x += 150) {
    const px = x + Math.sin(n * 2.7) * 34, py = y + Math.cos(n * 1.9) * 28; n++;
    if (!pointInPolygon(px, py, shelf.blocker.shape.vertices)) continue;
    const source = CONIFERS[n % CONIFERS.length];
    prop(source, px, py, CANOPY_HEIGHTS[source] * (0.8 + 0.3 * stableUnit('shelf', n)), { groundZ: shelf.visible.height, flip: n % 3 === 0, tint: CONIFER_TINT[source] });
  }
  for (let side = 0; side < 4; side++) for (let k = 0; k < 23; k++) {
    const t = (k + 0.5) / 23, drift = 70 + Math.sin(k * 2.3 + side) * 30, b = area.bounds;
    const x = side === 0 ? b.minX - drift : side === 1 ? b.maxX + drift : b.minX + t * (b.maxX - b.minX);
    const y = side === 2 ? b.minY - drift : side === 3 ? b.maxY + drift : b.minY + t * (b.maxY - b.minY);
    const support = insideWorld(x, y) ? supportAt(x, y) : null;
    if (!support || support.visible.areaId) continue;
    const source = CONIFERS[(k + side) % CONIFERS.length];
    prop(source, x, y, CANOPY_HEIGHTS[source] * (0.9 + 0.22 * stableUnit('edge', side, k)), { groundZ: support.visible.height, flip: k % 2 === 1, tint: CONIFER_TINT[source] });
  }
  // Waterfall shelf landmark: a rock arch and sandstone stacks on the shelf top,
  // plunge rocks along the western bank below it.
  prop('b2-76', cx - 1560, cy - 1060, 300, { groundZ: shelf.visible.height, tint: RIVER_STONE_TINT });
  prop('b1-42', cx - 1820, cy - 1210, 120, { groundZ: shelf.visible.height, tint: RIVER_STONE_TINT, flip: true });
  for (const [x, y, height, flip] of [[-1300, -745, 70, false], [-1620, -770, 84, true], [-1900, -800, 60, false], [-1180, -720, 44, true], [-1700, -450, 56, false], [-1250, -420, 48, true], [1800, -790, 66, false], [1900, -500, 52, true], [640, -230, 40, false], [-1950, -1520, 90, false]]) {
    if (guard.clear(cx + x, cy + y, 22)) prop('b1-42', cx + x, cy + y, height, { flip, tint: RIVER_STONE_TINT });
  }
  // Riverbank iris along both channel edges, offset onto the damp bank strip.
  for (const [edge, sign, key] of [[NORTH_EDGE, -1, 'north'], [SOUTH_EDGE, 1, 'south']]) {
    for (let i = 1; i < edge.length; i++) {
      const [ax, ay] = edge[i - 1], [bx, by] = edge[i], length = Math.hypot(bx - ax, by - ay);
      for (let along = 60, m = 0; along < length; along += 128 + (m % 3) * 26, m++) {
        const t = along / length, u = stableUnit(key, i, m);
        const x = ax + (bx - ax) * t + (u - 0.5) * 30, y = ay + (by - ay) * t + sign * (72 + u * 26);
        if (guard.clear(cx + x, cy + y, 12)) prop('b1-09', cx + x, cy + y, 34 + (m % 3) * 5, { flip: m % 2 === 1, tint: 0xe0dcd0, shadow: m % 2 === 0 });
      }
    }
  }
  // Conifer groves with fern and shrub understory on the enclosed banks.
  GROVES.forEach(([x, y, rx, ry], p) => {
    scatter({ key: `grove-${p}`, x: cx + x, y: cy + y, rx, ry, count: 6, radius: 36, place: (px, py, k, v) => {
      const source = CONIFERS[(k + p) % CONIFERS.length];
      prop(source, px, py, CANOPY_HEIGHTS[source] * (0.8 + 0.3 * v), { flip: v > 0.5, tint: CONIFER_TINT[source] });
    } });
    scatter({ key: `understory-${p}`, x: cx + x, y: cy + y, rx: rx * 1.1, ry: ry * 1.1, count: 10, radius: 16, place: (px, py, k, v) => {
      const source = k % 4 === 3 ? 'b1-01' : 'b1-04';
      prop(source, px, py, source === 'b1-04' ? 34 + k % 4 * 6 : 48 + k % 3 * 5, { flip: v > 0.5, tint: source === 'b1-04' ? 0xd4d4ae : 0xc6caa2, shadow: k % 2 === 0 });
    } });
  });
  // Theatrical clearing: log piles and brambles around the marquee edges, never
  // across the arena centre or its two exits.
  for (const [x, y, source, height, flip] of [[-1450, 700, 'b2-79', 60, false], [-360, 1460, 'b2-79', 58, true], [-1420, 1520, 'b2-79', 62, false], [-520, 1760, 'b2-79', 56, true], [-1360, 1300, 'b1-02', 46, false], [-640, 1780, 'b1-02', 44, true], [-1180, 1420, 'b1-02', 48, false], [-470, 560, 'b1-02', 42, true]]) {
    if (guard.clear(cx + x, cy + y, 26)) prop(source, cx + x, cy + y, height, { flip, tint: source === 'b1-02' ? 0xcfc9b2 : 0xd8cfbd });
  }
  // Stumps and root balls on the quiet bank corners.
  for (const [x, y, source, height, flip] of [[-1760, -1660, 'b2-73', 68, false], [1820, -930, 'b2-73', 64, true], [-1850, 1900, 'b2-73', 70, false], [1860, -1860, 'b2-74', 116, false], [-1900, 320, 'b2-74', 110, true], [1900, 1900, 'b2-74', 120, false], [300, -1300, 'b2-73', 62, true]]) {
    if (guard.clear(cx + x, cy + y, 30)) prop(source, cx + x, cy + y, height, { flip, tint: 0xd6c7a7 });
  }
  appendCentrePockets({world,area,plan});
  return freezeDeep(plan);
}
