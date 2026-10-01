// Silver Coast dressing plan (brief 04): homes face the sea while a cliff
// road serves them from behind. Stratified chalk banks carry layered
// sandstone and bleached driftwood trees; the rock arch on the headland is the
// distance landmark beside the faceted lighthouse; rubble gathers at the cliff
// feet; a worn beach walk follows the shoreline detour past beached jetty
// sections; the mansion shell reads as pale masonry with a marble interior;
// restrained villas stand on the closed land beyond the north and east edges.
// Beach grass stays low so the lighthouse approach remains visible. Frozen
// data only; no blocker, surface, water, objective or rule is added.
//
// Page budget: plants-00 + structures-01 (+ shared props-00). The satellite
// bunker shell (b1-46) lives on structures-00, so villas use the canopy shell
// (b2-64) only.
import { freezeDeep } from '../value-guards.mjs';
import { DISTRICT_TERRAIN } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext } from './plan-support.mjs';
import { placeOnBank, placeEdgeWoodland, placeAlongPolygonEdges, placeLine } from './plan-lines.mjs';

export const SILVER_COAST_PAGES = Object.freeze(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-01.webp', 'tripo-props-hd-props-00.webp']);
// Cool chalk grey: the warm sandstone card otherwise reads close to the
// reserved orange cue band at gameplay zoom (first capture pass).
export const COAST_CHALK_TINT = 0x98aab4;
const BANK_SOURCES = ['b1-42', 'b1-53', 'b1-42', 'b1-42', 'b1-10', 'b1-53', 'b1-42'];
const BANK_HEIGHT = Object.freeze({ 'b1-42': 130, 'b1-53': 230, 'b1-10': 40 });
const GRASS = ['b1-09', 'b1-10', 'b1-09', 'b1-01', 'b1-10'];

export function createSilverCoastArtPlan(world) {
  const context = createAreaPlanContext(world, 'silver-coast', { pages: SILVER_COAST_PAGES, margin: 260, routeClearance: 64 });
  if (!context) return null;
  const { area, plan, point, prop, solid, scatter, guard, supportAt, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'sand' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  const rect = (minX, minY, maxX, maxY) => [point(minX, minY), point(maxX, minY), point(maxX, maxY), point(minX, maxY)];
  // Wet sand along the cliff feet, scree at the headland, a paved terrace
  // court and the mansion's pale floor; the road shoulder carries service wear.
  plan.ground.zones.push(
    { id: 'shore-wetsand', material: 'wetsand', feather: 110, alpha: 0.7, vertices: [point(-1500, -320), point(-1150, -260), point(-950, 380), point(-1120, 1300), point(-1500, 1900), point(-1880, 1900), point(-1450, 1300), point(-1200, 400)] },
    { id: 'headland-scree', material: 'scree', feather: 90, alpha: 0.55, vertices: [point(-1200, -1980), point(-760, -1980), point(-560, -1300), point(-1100, -700), point(-1360, -650), point(-850, -1300)] },
    { id: 'terrace-court', material: 'paving', feather: 80, alpha: 0.55, vertices: [point(-200, 0), point(700, 0), point(760, 420), point(560, 900), point(-150, 900), point(-260, 420)] },
    { id: 'mansion-floor', material: 'paving', feather: 30, alpha: 0.8, vertices: rect(540, -1360, 1660, -340) },
    { id: 'lighthouse-apron', material: 'scree', feather: 70, alpha: 0.5, vertices: rect(-820, -1820, -280, -1300) },
    { id: 'utility-shoulder', material: 'wetsand', feather: 60, alpha: 0.45, vertices: rect(560, 380, 1260, 820) },
  );
  for (const segment of routeSegments) {
    const route = segment.routeId.slice(area.id.length + 1);
    // The shoreline detour is a wet-sand beach walk (pier decking would add a
    // sixth ground tile); the landward route is a paved cliff road.
    const [material, width, halo] = route === 'shoreline-detour' ? ['wetsand', 72, 22] : route === 'landward-road' ? ['paving', 130, 26] : route === 'mansion-service-loop' ? ['paving', 56, 16] : ['wetsand', 46, 18];
    plan.ground.trails.push({ id: `walk-${plan.ground.trails.length}`, material, points: [segment.a, segment.b], width, halo });
  }
  // Authored solids: stratified chalk banks, the faceted lighthouse, pale
  // mansion walls, the utility shed and sandstone terrace cover.
  for (const name of ['headland-cliff', 'shore-cliff']) solid(name, 'bank', { roof: 'rock', tint: 0xe2ddd0 });
  solid('lighthouse', 'card', { source: 'b2-67', fit: 'height', tint: COAST_CHALK_TINT, massAlpha: 0.55, wall: 'masonry', roof: 'slate' });
  for (const name of ['mansion-north-wall', 'mansion-east-wall', 'mansion-south-west-wall', 'mansion-south-east-wall', 'mansion-west-north-wall', 'mansion-west-south-wall']) solid(name, 'mass', { wall: 'masonry', roof: 'slate', tint: 0xeae6da });
  solid('utility-house', 'card', { source: 'b2-68', fit: 'width', tint: 0xd8d4c8, massAlpha: 0.45 });
  solid('terrace-wall', 'hedge', { source: 'b1-42', spacing: 100, tint: COAST_CHALK_TINT });
  solid('terrace-bench', 'card', { source: 'b1-42', fit: 'width', tint: COAST_CHALK_TINT, massAlpha: 0 });
  // Landmark: the rock arch stands on the headland top, framing the lighthouse.
  const headland = context.piece('headland-cliff');
  const arch = point(-1000, -1400); // on the headland's inland lip, beside the lighthouse
  if (supportAt(arch.x, arch.y)?.id === headland.id) prop('b2-76', arch.x, arch.y, 430, { groundZ: headland.visible.height, tint: COAST_CHALK_TINT, fade: true });
  // Layered sandstone and bleached driftwood trees on both banks.
  for (const bank of [headland, context.piece('shore-cliff')]) placeOnBank(context, bank, { key: 'coast-bank', stepX: 190, stepY: 170, inset: 80, radius: 50, sources: BANK_SOURCES, height: (source, n, v) => BANK_HEIGHT[source] * (0.8 + 0.4 * v), tint: source => source === 'b1-53' ? 0xe0dccc : COAST_CHALK_TINT });
  // Rubble at the cliff feet and sheltered corners, never across the shelf.
  for (const bank of [headland, context.piece('shore-cliff')]) placeAlongPolygonEdges(context, bank.blocker.shape.vertices, { key: `foot-${bank.id}`, spacing: 120, offset: 46, radius: 18, jitter: 12, place: (x, y, n, v) => {
    const source = n % 3 === 2 ? 'b1-10' : 'b1-42';
    prop(source, x, y, source === 'b1-42' ? 48 + 34 * v : 36, { flip: v > 0.5, tint: COAST_CHALK_TINT, shadow: source === 'b1-42' });
  } });
  // Beached jetty sections and a pier stub on the lower beach.
  for (const [x, y, height, flip] of [[-1300, 1620, 110, false], [-1050, 1800, 96, true], [-700, 1820, 100, false]]) if (guard.clear(cx + x, cy + y, 60)) prop('b2-46', cx + x, cy + y, height, { flip, tint: 0xd8ccb8, fade: false });
  // Beach grass dunes and low scrub; planting stays low on the lighthouse approach.
  for (const [p, x, y, rx, ry, count] of [[0, -700, 600, 260, 420, 30], [1, 1400, 700, 360, 260, 26], [2, 1700, 1600, 300, 300, 26], [3, 400, 1600, 520, 260, 30], [4, -300, -1500, 200, 300, 16], [5, -1550, 1900, 260, 80, 10], [6, 1850, -100, 140, 220, 12], [7, -100, -700, 160, 200, 12], [8, 1100, 1300, 240, 160, 18]]) scatter({ key: `dune-${p}`, x: cx + x, y: cy + y, rx, ry, count, radius: 14, place: (px, py, n, v) => {
    const source = GRASS[(n + p) % GRASS.length];
    prop(source, px, py, source === 'b1-01' ? 44 + n % 3 * 5 : 34 + n % 3 * 5, { flip: v > 0.5, tint: source === 'b1-01' ? 0xd6d4b0 : 0xeae4cc, shadow: n % 3 === 0 });
  } });
  // Mansion garden edge: clipped hedges along the road-facing walls, a willow at the sea corner.
  placeLine(context, { key: 'mansion-garden', from: point(560, -200), to: point(1650, -200), spacing: 160, radius: 60, place: (x, y, n) => prop('b2-75', x, y, 60, { flip: n % 2 === 1, tint: 0xd8dcbc }) });
  for (const [x, y, source, height] of [[1850, -1600, 'b2-71', 320], [300, -1600, 'b2-71', 300], [1850, 600, 'b1-53', 220], [-150, 1850, 'b1-53', 210]]) if (guard.clear(cx + x, cy + y, 40)) prop(source, cx + x, cy + y, height, { tint: 0xe2e0cc, flip: x > 0 });
  // Road shoulder: bollard barriers and a cable transformer at the utility house.
  for (const [x, y, source, height, flip] of [[1260, 380, 'b1-19', 80, false], [1260, 820, 'b2-49', 32, true], [700, -150, 'b2-49', 32, false], [1550, 130, 'b2-49', 32, true]]) if (guard.clear(cx + x, cy + y, 22)) prop(source, cx + x, cy + y, height, { flip, tint: 0xdedcd4 });
  // Restrained villas on the closed land beyond the north and east edges.
  placeEdgeWoodland(context, { key: 'coast-villas', sources: ['b2-64', 'b2-71', 'b2-64', 'b1-53'], perSide: 9, drift: 120, sides: [1, 2], height: (source, side, n, v) => (source === 'b2-64' ? 300 : source === 'b2-71' ? 300 : 220) * (0.9 + 0.2 * v), tint: 0xe6e2d6 });
  return freezeDeep(plan);
}
