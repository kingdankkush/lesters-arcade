// Scrypt Bayou dressing plan (brief 05): a channel-management settlement
// built around water, cypress roots and raised timber routes. Reeds line both
// channel banks, cypress and dead oaks root on the authored banks and on the
// closed land beyond every edge, boardwalk planking carries the crossings and
// the side plank route to the stilt store, the lock apron is a timber deck at
// the control house and water tower, and the stilted guard tower (the stilt
// store) is the landmark seen across the marsh. The court centre stays calm.
// Frozen data only; no blocker, surface, water, objective or rule is added.
//
// Page budget: plants-00 + structures-00 (+ shared props-00). The collapsed
// mine (b2-77) lives on structures-01, which would be a third exclusive page
// next to the guard tower on structures-00, so the lock house is the concrete
// box culvert (b2-45). Fog cards are not a schema primitive (decals accept
// only the ground detail frames); fog stays an open renderer hook.
import { freezeDeep } from '../value-guards.mjs';
import { DISTRICT_TERRAIN } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext, CANOPY_HEIGHTS } from './plan-support.mjs';
import { placeOnBank, placeEdgeWoodland, placeAlongPolygonEdges } from './plan-lines.mjs';

export const SCRYPT_BAYOU_PAGES = Object.freeze(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-00.webp', 'tripo-props-hd-props-00.webp']);
export const BAYOU_STILT_TOWER_HEIGHT = 420;
const CYPRESS = ['b2-71', 'b2-70', 'b1-53', 'b2-71', 'b2-70', 'b2-71'];
const CYPRESS_TINT = Object.freeze({ 'b2-71': 0xc8ccb0, 'b2-70': 0xbcb8a8, 'b1-53': 0xc6c2b0 });
const UNDERSTORY = ['b1-09', 'b1-04', 'b1-09', 'b1-02', 'b1-09', 'b1-04'];

export function createScryptBayouArtPlan(world) {
  const context = createAreaPlanContext(world, 'scrypt-bayou', { pages: SCRYPT_BAYOU_PAGES, margin: 260, routeClearance: 64 });
  if (!context) return null;
  const { area, plan, point, prop, solid, scatter, guard, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'marsh' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  const rect = (minX, minY, maxX, maxY) => [point(minX, minY), point(maxX, minY), point(maxX, maxY), point(minX, maxY)];
  // Moss on the channel shoulders, a timber lock apron, peat in the quiet court.
  plan.ground.zones.push(
    { id: 'west-shoulder', material: 'moss', feather: 70, alpha: 0.6, vertices: [point(60, -2000), point(200, -2000), point(200, 950), point(350, 1700), point(350, 2000), point(180, 2000), point(180, 1720), point(60, 980)] },
    { id: 'east-shoulder', material: 'moss', feather: 70, alpha: 0.6, vertices: [point(500, -2000), point(640, -2000), point(660, -700), point(660, 880), point(840, 1680), point(840, 2000), point(700, 2000), point(700, 1700), point(520, 900), point(520, -700)] },
    { id: 'lock-apron', material: 'boardwalk', feather: 30, alpha: 0.85, vertices: rect(-700, 440, -100, 600) },
    { id: 'court-peat', material: 'peat', feather: 140, alpha: 0.45, vertices: [point(-1500, 200), point(-500, 250), point(-400, 1100), point(-900, 1500), point(-1500, 1300)] },
    { id: 'store-landing', material: 'boardwalk', feather: 30, alpha: 0.8, vertices: rect(1000, 1600, 1600, 1720) },
  );
  for (const segment of routeSegments) {
    const route = segment.routeId.slice(area.id.length + 1);
    // Plank walks on the crossings and the side route; peat paths elsewhere.
    const [material, width, halo] = route === 'lock-court-crossing' || route === 'north-crossing' ? ['boardwalk', 84, 12] : route === 'stilt-store-return' ? ['boardwalk', 56, 10] : ['peat', 44, 18];
    plan.ground.trails.push({ id: `walk-${plan.ground.trails.length}`, material, points: [segment.a, segment.b], width, halo });
  }
  // Authored solids: root banks, the lock house, the riveted water tower as
  // the wheel tower, the stilted guard tower as the stilt store, a log stack
  // and a plank screen as court cover.
  for (const name of ['northwest-root-bank', 'southwest-root-foot']) solid(name, 'bank', { roof: 'moss', tint: 0xc8c6b4 });
  solid('control-house', 'card', { source: 'b2-45', fit: 'width', tint: 0xb8b8ac, massAlpha: 0.4 });
  solid('wheel-tower', 'card', { source: 'b1-47', fit: 'height', tint: 0xbcb6a8, massAlpha: 0.3 });
  solid('stilt-store', 'card', { source: 'b1-15', fit: 'height', height: BAYOU_STILT_TOWER_HEIGHT, tint: 0xc4bcaa, massAlpha: 0.25 });
  solid('court-low-stack', 'hedge', { source: 'b2-79', spacing: 80, tint: 0xc8bea8 });
  solid('court-tall-screen', 'stakes', { tint: 0x9d8f78, spacing: 24 });
  // Cypress and dead oak root on the authored banks.
  for (const bank of [context.piece('northwest-root-bank'), context.piece('southwest-root-foot')]) placeOnBank(context, bank, { key: 'bayou-bank', stepX: 130, stepY: 120, inset: 50, sources: CYPRESS, height: (source, n, v) => CANOPY_HEIGHTS[source] * (0.85 + 0.25 * v), tint: source => CYPRESS_TINT[source] });
  // Reeds and iris along both channel banks, kept off the crossing mouths by the guard.
  const channel = context.piece('channel');
  const channelVertices = channel.visible.vertices;
  placeAlongPolygonEdges(context, channelVertices, { key: 'reeds-near', spacing: 70, offset: 40, radius: 14, jitter: 10, place: (x, y, n, v) => prop(n % 4 === 3 ? 'b1-04' : 'b1-09', x, y, 44 + 14 * v, { flip: v > 0.5, tint: 0xd0d0b0, shadow: false }) });
  placeAlongPolygonEdges(context, channelVertices, { key: 'reeds-far', spacing: 110, offset: 95, radius: 14, jitter: 18, place: (x, y, n, v) => prop(n % 3 === 2 ? 'b1-02' : 'b1-09', x, y, 40 + 12 * v, { flip: v < 0.5, tint: 0xc8c8a8, shadow: n % 2 === 0 }) });
  // Cypress stands on the wet margins, off every route and the court centre.
  for (const [x, y, source, flip] of [[-1700, -800, 'b2-71', false], [-1150, -1650, 'b2-70', true], [-300, -1700, 'b2-71', false], [1100, -1650, 'b2-71', true], [1750, -1100, 'b2-70', false], [1500, -300, 'b2-71', true], [1800, 600, 'b2-71', false], [950, 1150, 'b1-53', true], [-1800, 600, 'b2-70', true], [-1200, 1800, 'b2-71', false], [-500, 1800, 'b2-71', true], [1800, 1850, 'b2-70', false], [-800, -1200, 'b1-53', false], [1000, -250, 'b2-70', false]]) {
    if (guard.clear(cx + x, cy + y, 40)) prop(source, cx + x, cy + y, CANOPY_HEIGHTS[source] * 0.95, { flip, tint: CYPRESS_TINT[source] });
  }
  // Marsh understory pockets: reeds, ferns and brambles, never on plank walks.
  for (const [p, x, y, rx, ry] of [[0, -1400, -900, 260, 300], [1, -400, -1300, 260, 200], [2, 1300, -1300, 330, 300], [3, 1500, 300, 280, 260], [4, 1600, 1100, 220, 240], [5, -1700, 1300, 180, 220], [6, -300, 1500, 300, 200], [7, -1600, -300, 160, 160], [8, 1000, -1000, 200, 200], [9, -1000, 1700, 260, 140]]) scatter({ key: `marsh-${p}`, x: cx + x, y: cy + y, rx, ry, count: 18, radius: 16, place: (px, py, n, v) => {
    const source = UNDERSTORY[(n + p) % UNDERSTORY.length];
    prop(source, px, py, source === 'b1-04' ? 36 + n % 4 * 5 : source === 'b1-02' ? 44 + n % 3 * 5 : 46 + n % 3 * 6, { flip: v > 0.5, tint: source === 'b1-09' ? 0xd0d0b0 : 0xc0c29c, shadow: n % 2 === 0 });
  } });
  // Stumps, root balls and the stilt store's land-side crates and logs.
  for (const [x, y, source, height, flip] of [[-1500, -1100, 'b2-73', 66, false], [-1000, 1300, 'b2-74', 110, true], [1650, -700, 'b2-73', 60, true], [1200, 700, 'b2-74', 100, false], [-200, -1100, 'b2-73', 58, false], [1380, 1250, 'b2-79', 58, false], [1550, 1280, 'b1-18', 52, true], [-750, 250, 'b2-79', 54, true], [100, 1300, 'b2-74', 96, false]]) {
    if (guard.clear(cx + x, cy + y, 26)) prop(source, cx + x, cy + y, height, { flip, tint: 0xc8bea8 });
  }
  // Cypress woodland beyond every edge, rooted on the closed world masses.
  placeEdgeWoodland(context, { key: 'bayou-edge', sources: CYPRESS, perSide: 24, height: (source, side, n, v) => CANOPY_HEIGHTS[source] * (0.9 + 0.22 * v), tint: 0xc4c6ae });
  return freezeDeep(plan);
}
