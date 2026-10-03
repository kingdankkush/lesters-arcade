// Hollow Pines dressing plan (brief 07): one giant dead tree over the broken
// north boundary, a walled cemetery with coherent burial rows behind the public
// walk, a mortuary chapel on the crypt, dead and bleached trees massed on the
// forest groves, burnt shrubs, hollow stumps and root balls off the routes.
// Frozen data only; the plan never adds a blocker, surface, objective or rule.
//
// Headstones are low jersey-barrier slabs (b2-49) and tombs are the stone well
// (b2-80); the kit has no headstone or lantern. Traffic masts (b2-52) are
// omitted as lanterns: a signal mast in a cemetery reads as a road prop.
import { freezeDeep } from '../value-guards.mjs';
import { appendCentrePockets } from './centre-pockets.mjs';
import { appendForestFloor } from './forest-floor.mjs';
import { DISTRICT_TERRAIN } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext, CANOPY_HEIGHTS } from './plan-support.mjs';
import { placeLine, placeOnBank, placeEdgeWoodland, placeAlongPolygonEdges } from './plan-lines.mjs';

export const HOLLOW_PINES_PAGES = Object.freeze(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-01.webp', 'tripo-props-hd-props-00.webp']);
// Pale blue-grey and violet-grey multiplicative tints for the brief's
// blue-grey #4C5664 / violet-grey #605D70 / ash #8B8D88 sub-palette.
export const PINES_ASH_TINT = 0xc4c4cc;
export const PINES_STONE_TINT = 0xb4b6c0;
export const GIANT_DEAD_TREE_HEIGHT = 560;
const GROVE_TREES = ['b2-72', 'b2-70', 'b2-72', 'b1-53', 'b2-72', 'b2-70'];
const TREE_TINT = Object.freeze({ 'b2-72': 0xa9b1b4, 'b2-70': PINES_ASH_TINT, 'b1-53': 0xc8c6cc });
const height = (source, n, v) => CANOPY_HEIGHTS[source] * (0.85 + 0.3 * v);

export function createHollowPinesArtPlan(world) {
  const context = createAreaPlanContext(world, 'hollow-pines', { pages: HOLLOW_PINES_PAGES, margin: 260, routeClearance: 70 });
  if (!context) return null;
  const { area, plan, point, prop, solid, scatter, guard, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'needles' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  // Settled gravel on the public walk, softer worn gravel on the service loop,
  // exposed stone around the dead tree and the crypt, scree along the walls.
  plan.ground.zones.push(
    { id: 'cemetery-court', material: 'scree', feather: 90, alpha: 0.35, vertices: [point(-760, -700), point(760, -700), point(760, 700), point(-760, 700)] },
    { id: 'dead-tree-ground', material: 'rock', feather: 110, alpha: 0.55, vertices: [point(-360, -1640), point(360, -1640), point(420, -1060), point(-420, -1060)] },
    { id: 'crypt-yard', material: 'rock', feather: 90, alpha: 0.45, vertices: [point(-1700, -1560), point(-1150, -1560), point(-1150, -1000), point(-1700, -1000)] },
    { id: 'maintenance-yard', material: 'gravel', feather: 70, alpha: 0.5, vertices: [point(880, 330), point(1420, 330), point(1420, 880), point(880, 880)] },
    { id: 'west-gate', material: 'gravel', feather: 60, alpha: 0.5, vertices: [point(-980, -150), point(-620, -150), point(-620, 150), point(-980, 150)] },
    { id: 'east-gate', material: 'gravel', feather: 60, alpha: 0.5, vertices: [point(620, -150), point(980, -150), point(980, 150), point(620, 150)] },
  );
  for (const segment of routeSegments) {
    const service = segment.routeId === `${area.id}-outer-service-path`;
    plan.ground.trails.push({ id: `trail-${plan.ground.trails.length}`, material: 'gravel', points: [segment.a, segment.b], width: segment.kind === 'main' ? 50 : 38, halo: service ? 24 : 16 });
  }
  // The giant dead tree: the dead oak scaled up on the faceted root volume,
  // which hides its own greybox box so only the trunk and roots read.
  solid('dead-tree-roots', 'card', { source: 'b2-70', fit: 'height', height: GIANT_DEAD_TREE_HEIGHT, massAlpha: 0, tint: 0xbcbac6 });
  solid('crypt', 'card', { source: 'b2-65', fit: 'width', tint: 0xb8b8c2 });
  solid('maintenance-house', 'card', { source: 'b2-68', fit: 'width', tint: 0xc0c0c4 });
  for (const name of ['north-west-wall', 'north-east-wall', 'west-upper-wall', 'west-lower-wall', 'east-upper-wall', 'east-lower-wall', 'south-wall']) solid(name, 'mass', { wall: 'masonry', roof: 'rock', tint: PINES_STONE_TINT });
  solid('low-boundary', 'hedge', { source: 'b2-49', spacing: 130, tint: PINES_STONE_TINT });
  solid('stone-monument', 'mass', { wall: 'masonry', roof: 'rock', tint: PINES_STONE_TINT });
  for (const name of ['southwest-grove', 'northeast-grove']) solid(name, 'bank', { roof: 'needles', tint: 0xc8c8cc });
  // Dark conifers behind, dead oaks and bleached relics at the grove edges.
  for (const name of ['southwest-grove', 'northeast-grove']) placeOnBank(context, context.piece(name), { key: name, stepX: 150, stepY: 140, sources: GROVE_TREES, height, tint: source => TREE_TINT[source] });
  placeEdgeWoodland(context, { key: 'pines-edge', sources: GROVE_TREES, perSide: 23, height: (source, side, n, v) => height(source, n, v), tint: 0xb4b6bc });
  // Burial rows: headstone slabs in the strips between the public walk and the
  // walls, tombs at the row ends. The clearing, both gates and the tree
  // approach stay open (the guard keeps 70 units off every route).
  const grave = (px, py, n, v) => prop('b2-49', px, py, 20 + (n % 3) * 3, { flip: v > 0.5, tint: PINES_STONE_TINT, shadow: true, fade: false });
  for (const row of [-650, -600]) placeLine(context, { key: `north-row-${row}`, from: point(-740, row), to: point(740, row), spacing: 72, radius: 14, jitter: 4, place: grave });
  for (const row of [470, 540, 610, 680]) placeLine(context, { key: `south-row-${row}`, from: point(-720, row), to: point(720, row), spacing: 76, radius: 14, jitter: 4, place: grave });
  for (const column of [-735, 735]) placeLine(context, { key: `side-row-${column}`, from: point(column, -440), to: point(column, -110), spacing: 70, radius: 12, place: grave });
  for (const [x, y, flip] of [[-700, 600, false], [700, 600, true], [-700, -640, true], [700, -640, false], [-180, 610, false], [180, 610, true]]) {
    if (guard.clear(cx + x, cy + y, 26)) prop('b2-80', cx + x, cy + y, 64, { flip, tint: PINES_STONE_TINT });
  }
  // Broken masonry at the crypt and the broken north boundary (secret cue),
  // without blocking the crypt trail.
  for (const [vertices, key] of [[context.piece('crypt').blocker.shape.vertices, 'crypt-rubble'], [context.piece('dead-tree-roots').blocker.shape.vertices, 'tree-rubble']]) {
    placeAlongPolygonEdges(context, vertices, { key, spacing: 110, offset: 46, radius: 16, jitter: 10, place: (px, py, n, v) => {
      if (n % 3 === 2) prop('b1-05', px, py, 44 + n % 3 * 6, { flip: v > 0.5, tint: PINES_ASH_TINT, shadow: false });
      else prop('b2-49', px, py, 18 + (n % 3) * 3, { flip: v > 0.5, tint: 0xa8aab4, fade: false });
    } });
  }
  for (const [x, y] of [[-120, -800], [120, -790], [-260, -810], [280, -800]]) if (guard.clear(cx + x, cy + y, 16)) prop('b2-49', cx + x, cy + y, 20, { tint: 0xa8aab4, flip: x > 0, fade: false });
  // Tighter tree lanes outside the walls: dead oaks, bleached relics and burnt
  // shrub skeletons in pockets, plus hollow stumps and root balls.
  const POCKETS = [[-1250, -500, 200, 260], [1250, -450, 220, 240], [-1150, 600, 150, 180], [-500, 1450, 340, 200], [600, 1500, 320, 180], [1650, 1600, 200, 220],
    [-700, -1250, 160, 160], [550, -1300, 200, 150], [1450, 300, 160, 200], [-1750, -1750, 150, 150], [-200, 1750, 200, 120], [1750, -500, 140, 200]];
  POCKETS.forEach(([x, y, rx, ry], p) => scatter({ key: `pocket-${p}`, x: cx + x, y: cy + y, rx, ry, count: 12, radius: 18, place: (px, py, n, v) => {
    if (n % 6 === 0) prop(n % 12 === 0 ? 'b2-70' : 'b1-53', px, py, (n % 12 === 0 ? 230 : 210) * (0.85 + 0.3 * v), { flip: v > 0.5, tint: n % 12 === 0 ? PINES_ASH_TINT : 0xc8c6cc });
    // Pocket debris stays knee-to-waist high (<= 48): walk-over clutter between the dead trees.
    else if (n % 6 === 3) prop(n % 4 === 1 ? 'b2-74' : 'b2-73', px, py, n % 4 === 1 ? 48 : 44, { flip: v > 0.5, tint: 0xbcb8b8 });
    else prop('b1-05', px, py, 42 + n % 3 * 7, { flip: v > 0.5, tint: PINES_ASH_TINT, shadow: n % 2 === 0 });
  } }));
  // Groundskeeper's stacked materials behind the house, clear of both ramps.
  for (const [x, y, source, height, flip] of [[1420, 470, 'b2-79', 56, false], [1430, 700, 'b2-79', 52, true], [880, 440, 'b2-73', 52, false]]) {
    if (guard.clear(cx + x, cy + y, 24)) prop(source, cx + x, cy + y, height, { flip, tint: 0xc4c0b8 });
  }
  appendCentrePockets({world,area,plan});
  appendForestFloor({world,area,plan});
  return freezeDeep(plan);
}
