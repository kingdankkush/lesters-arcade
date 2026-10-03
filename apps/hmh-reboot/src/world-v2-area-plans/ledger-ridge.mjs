// Ledger Ridge dressing plan (brief 08): layered rock cuts with sandstone
// strata stacks and sparse pines on the stable shelves, the mining headframe
// on its authored mass, a collapsed mine entrance and rail spur under the
// north cap, a quarry store, spoil and timber at the cut feet, rubble and dry
// scrub along the switchbacks, and heavy plant parked at the working landing's
// edges. Frozen data only; the plan never adds a blocker, surface, objective
// or rule. The rope crossing in the brief is not authored geometry, so no
// span card is placed.
import { freezeDeep } from '../value-guards.mjs';
import { appendCentrePockets } from './centre-pockets.mjs';
import { DISTRICT_TERRAIN } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext } from './plan-support.mjs';
import { placeLine, placeOnBank, placeEdgeWoodland, placeAlongPolygonEdges } from './plan-lines.mjs';

export const LEDGER_RIDGE_PAGES = Object.freeze(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-01.webp', 'tripo-props-hd-props-00.webp']);
// Cool stone tint pulls the warm sandstone toward stone #7E817A / shadow #515E66.
export const RIDGE_STONE_TINT = 0xa4acb0;
export const RIDGE_PINE_TINT = 0xb8c0b4;
const RIDGE_CLIFFS = ['west-buttress', 'lower-cut', 'upper-cut', 'north-cap', 'east-buttress'];

export function createLedgerRidgeArtPlan(world) {
  const context = createAreaPlanContext(world, 'ledger-ridge', { pages: LEDGER_RIDGE_PAGES, margin: 260, routeClearance: 70 });
  if (!context) return null;
  const { area, plan, point, prop, solid, scatter, guard, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'rock' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  // Compacted quarry road wear, spoil aprons at the cut feet, the store yard
  // and the worn working landing.
  plan.ground.zones.push(
    { id: 'working-landing', material: 'dirt', feather: 120, alpha: 0.5, vertices: [point(250, 750), point(1800, 750), point(1850, 1850), point(250, 1850)] },
    { id: 'store-yard', material: 'gravel', feather: 70, alpha: 0.55, vertices: [point(-1760, -1060), point(-1250, -1060), point(-1250, -820), point(-1760, -820)] },
    { id: 'shelf-apron', material: 'gravel', feather: 70, alpha: 0.5, vertices: [point(-720, -1060), point(560, -1060), point(560, -680), point(-720, -680)] },
    { id: 'west-scree', material: 'scree', feather: 90, alpha: 0.6, vertices: [point(-1220, -380), point(-1080, -380), point(-1080, 1560), point(-1220, 1580)] },
    { id: 'cut-scree', material: 'scree', feather: 80, alpha: 0.55, vertices: [point(-650, 650), point(550, 650), point(550, 760), point(-650, 760)] },
  );
  for (const segment of routeSegments) plan.ground.trails.push({ id: `trail-${plan.ground.trails.length}`, material: segment.kind === 'main' ? 'gravel' : 'dirt', points: [segment.a, segment.b], width: segment.kind === 'main' ? 56 : 40, halo: 18 });
  for (const name of [...RIDGE_CLIFFS, 'cap-foot']) solid(name, 'bank', { roof: 'rock', tint: 0xd0d2cc });
  solid('headframe', 'card', { source: 'b1-11', fit: 'height', tint: 0xc8c8c4 });
  solid('quarry-store', 'card', { source: 'b2-68', fit: 'width', tint: 0xc8c6be });
  solid('landing-barrier', 'hedge', { source: 'b2-49', spacing: 120, tint: 0xc8cac6 });
  solid('landing-wall', 'hedge', { source: 'b1-42', spacing: 120, tint: RIDGE_STONE_TINT });
  // Sparse pines and layered strata stacks on the stable shelves.
  for (const name of RIDGE_CLIFFS) {
    const cliff = context.piece(name);
    placeOnBank(context, cliff, { key: `${name}-pines`, stepX: 330, stepY: 300, inset: 110, sources: ['b2-72', 'b1-50', 'b2-72'], height: (source, n, v) => (source === 'b2-72' ? 330 : 280) * (0.8 + 0.3 * v), tint: RIDGE_PINE_TINT });
    placeOnBank(context, cliff, { key: `${name}-strata`, stepX: 260, stepY: 240, inset: 200, sources: ['b1-42'], height: (source, n, v) => 90 + 70 * v, tint: RIDGE_STONE_TINT });
  }
  const cap = context.piece('north-cap');
  prop('b2-76', cx + 900, cy - 1420, 320, { groundZ: cap.visible.height, tint: RIDGE_STONE_TINT, flip: true });
  placeEdgeWoodland(context, { key: 'ridge-edge', sources: ['b2-72', 'b1-42', 'b2-72', 'b1-50', 'b1-42'], perSide: 18, height: (source, side, n, v) => source === 'b1-42' ? 120 + 60 * v : 300 * (0.85 + 0.25 * v), tint: RIDGE_PINE_TINT });
  // Collapsed mine entrance under the north cap with its rail spur and carts.
  // Set back into the cap foot so the switchback keeps its 300-unit moving band past their colliders.
  for (const [x, y, flip] of [[-380, -1060, false], [700, -1060, true]]) if (guard.clear(cx + x, cy + y, 24)) prop('b2-77', cx + x, cy + y, 230, { flip, tint: 0xc4c4be });
  placeLine(context, { key: 'rail-spur', from: point(-840, -1040), to: point(-470, -1040), spacing: 80, radius: 10, place: (px, py) => prop('b2-78', px, py, 34, { tint: 0xc8c4bc, shadow: false, fade: false }) });
  placeLine(context, { key: 'rail-east', from: point(560, -1040), to: point(1150, -1040), spacing: 80, radius: 10, place: (px, py) => prop('b2-78', px, py, 34, { tint: 0xc8c4bc, shadow: false, fade: false }) });
  for (const [x, y, flip] of [[-640, -1060, false], [880, -1050, true], [1080, -1060, false]]) if (guard.clear(cx + x, cy + y, 18)) prop('b1-16', cx + x, cy + y, 56, { flip, tint: 0xc4beb4 });
  // Heavy plant parked at the working landing's edges; the centre stays quiet.
  for (const [x, y, source, height, flip] of [[1700, 1350, 'b2-59', 120, true], [1550, 1820, 'b2-60', 150, false], [450, 1820, 'b2-60', 140, true], [300, 1300, 'b2-59', 110, false], [-700, 1500, 'b2-60', 140, false]]) {
    if (guard.clear(cx + x, cy + y, 60)) prop(source, cx + x, cy + y, height, { flip, tint: 0xc4c4be });
  }
  // Spoil, timber and stumps at the cut feet; scrub and rubble line the switchbacks.
  for (const name of ['lower-cut', 'upper-cut', 'west-buttress']) {
    placeAlongPolygonEdges(context, context.piece(name).blocker.shape.vertices, { key: `${name}-foot`, spacing: 150, offset: 40, radius: 16, jitter: 12, place: (px, py, n, v) => {
      // Small sandstone cards read as rusty barrels at gameplay zoom (pass-1), so
      // spoil is timber, stumps and dry scrub, with full-height strata only.
      // Timber and stumps stay walk-over height (<= 48); the strata block.
      const source = n % 5 === 4 ? 'b2-79' : n % 5 === 2 ? 'b1-49' : n % 3 === 0 ? 'b1-42' : 'b1-05';
      prop(source, px, py, source === 'b2-79' ? 46 : source === 'b1-49' ? 46 : source === 'b1-05' ? 40 : 96 + n % 3 * 12, { flip: v > 0.5, tint: source === 'b1-42' ? RIDGE_STONE_TINT : 0xc8c2b4, shadow: source !== 'b1-05' });
    } });
  }
  for (const [x, y] of [[-1080, 900], [-830, 900], [-1080, 250], [-830, 300], [-1080, -400], [-830, -500], [-450, -700], [500, -700], [-150, 1000], [600, 1000]]) {
    // Root clumps stay knee-to-waist high (at most 48): walk-over rubble beside the switchback, not walls in its band.
    scatter({ key: `switchback-${x}-${y}`, x: cx + x, y: cy + y, rx: 70, ry: 90, count: 5, radius: 12, place: (px, py, n, v) => prop(n % 2 ? 'b1-05' : 'b2-74', px, py, n % 2 ? 38 : 40 + n * 2, { flip: v > 0.5, tint: n % 2 ? 0xc6c0b0 : 0xc4bcb0, shadow: false }) });
  }
  // Store stock along its back and side walls, leaving the loading face open.
  for (const [x, y, source, height, flip] of [[-1730, -1080, 'b2-79', 54, false], [-1290, -1080, 'b1-16', 52, true], [-1760, -900, 'b2-79', 50, true]]) {
    if (guard.clear(cx + x, cy + y, 20)) prop(source, cx + x, cy + y, height, { flip, tint: 0xc8c2b4 });
  }
  appendCentrePockets({world,area,plan});
  return freezeDeep(plan);
}
