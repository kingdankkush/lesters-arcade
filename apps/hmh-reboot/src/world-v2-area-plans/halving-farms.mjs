// Halving Farms dressing plan (brief 03): a working farm read through its use.
// Crop fields with furrow rhythm, hedgerow and picket field boundaries, timber
// barns on the authored solids, the stone watermill as the windmill-yard
// landmark, a rutted track ending at the barn threshold and woodland beyond the
// field edges. Frozen data only; no blocker, surface, objective or rule is added.
import { freezeDeep } from '../value-guards.mjs';
import { stableUnit } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext, CANOPY_HEIGHTS } from './plan-support.mjs';
import { placeLine, placeEdgeWoodland } from './plan-lines.mjs';

// structures-01 carries the watermill, warehouse barn, quonset shed and timber
// tower; the clapboard farmhouse and ore silo live on structures-00, which would
// be a third exclusive page, so the barns are warehouse/quonset/tower cards.
export const HALVING_FARMS_PAGES = Object.freeze(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-01.webp', 'tripo-props-hd-props-00.webp']);
const EDGE_TREES = ['b1-03', 'b2-71', 'b1-50', 'b1-03', 'b2-70', 'b1-55'];
const FALLOW = ['b1-10', 'b1-06', 'b1-10', 'b1-08', 'b1-01'];
// Crop fields: [minX, minY, maxX, maxY, furrow axis]. Furrows run along the
// axis; crop rows stand in the lanes between furrows.
const FIELDS = [
  ['east', 1150, -520, 1660, 880, 'y'],
  ['north', -1150, -1650, -350, -720, 'y'],
  ['southeast', 560, 1010, 1660, 1290, 'x'],
  ['southwest', -1150, 1010, -380, 1280, 'x'],
];
const FURROW_SPACING = 115, CROP_SPACING = 95;

export function createHalvingFarmsArtPlan(world) {
  const context = createAreaPlanContext(world, 'halving-farms', { pages: HALVING_FARMS_PAGES, margin: 260, routeClearance: 64 });
  if (!context) return null;
  const { area, plan, point, prop, solid, scatter, guard, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'grass', tint: 0xe0dcbc };
  // Tilled fields, the trodden working yard and two fallow straw meadows.
  const rect = (minX, minY, maxX, maxY) => [point(minX, minY), point(maxX, minY), point(maxX, maxY), point(minX, maxY)];
  plan.ground.zones.push(
    { id: 'working-yard', material: 'earth', feather: 90, alpha: 0.55, vertices: [point(-550, -500), point(900, -500), point(1000, -100), point(950, 650), point(-450, 650), point(-600, 100)] },
    ...FIELDS.map(([name, minX, minY, maxX, maxY]) => ({ id: `field-${name}`, material: 'earth', feather: 60, alpha: 0.5, vertices: rect(minX, minY, maxX, maxY) })),
    { id: 'fallow-west', material: 'meadow', feather: 80, alpha: 0.5, tint: 0xe6dcae, vertices: rect(-1900, 150, -1420, 1000) },
    { id: 'fallow-northwest', material: 'meadow', feather: 80, alpha: 0.5, tint: 0xe6dcae, vertices: rect(-1900, -900, -1400, -150) },
  );
  // Furrows: parallel dirt lines through each field, spaced well above stripe
  // noise. The field bypass crosses the southwest field diagonally, so each
  // furrow keeps only its longest run clear of every inspection route.
  const routeDistance = (x, y) => Math.min(...routeSegments.map(s => context.distanceToPolyline(x, y, [s.a, s.b])));
  for (const [name, minX, minY, maxX, maxY, axis] of FIELDS) {
    const from = axis === 'y' ? minX + 50 : minY + 40, to = axis === 'y' ? maxX - 50 : maxY - 40;
    for (let at = from, n = 0; at <= to; at += FURROW_SPACING, n++) {
      const start = axis === 'y' ? point(at, minY + 20) : point(minX + 20, at), end = axis === 'y' ? point(at, maxY - 20) : point(maxX - 20, at);
      const length = Math.hypot(end.x - start.x, end.y - start.y), steps = Math.ceil(length / 25);
      let best = null, run = null;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = start.x + (end.x - start.x) * t, y = start.y + (end.y - start.y) * t;
        if (routeDistance(x, y) >= 68) { run = run ?? { a: { x, y }, b: { x, y } }; run.b = { x, y }; }
        else run = null;
        if (run && (!best || Math.hypot(run.b.x - run.a.x, run.b.y - run.a.y) > Math.hypot(best.b.x - best.a.x, best.b.y - best.a.y))) best = { a: run.a, b: run.b };
      }
      if (best && Math.hypot(best.b.x - best.a.x, best.b.y - best.a.y) >= 200) plan.ground.trails.push({ id: `furrow-${name}-${n}`, material: 'dirt', points: [best.a, best.b], width: 34, halo: 10 });
    }
  }
  // Access tracks: gravel from the farm road into the yard, a rutted dirt track
  // to the barn door, dirt to the Woods track, worn earth on the field loops.
  for (const segment of routeSegments) {
    const route = segment.routeId.slice(area.id.length + 1);
    const [material, width, halo] = route === 'west-yard' ? ['gravel', 150, 30] : route === 'yard-barn' ? ['dirt', 120, 40] : route === 'yard-south' ? ['dirt', 90, 30] : ['earth', 48, 16];
    plan.ground.trails.push({ id: `track-${plan.ground.trails.length}`, material, points: [segment.a, segment.b], width, halo });
  }
  // Barns, tower, sheds and boundaries on the authored solids.
  solid('barn', 'card', { source: 'b2-63', fit: 'width', tint: 0xcdb9a2, massAlpha: 0.5, roof: 'dirt' });
  solid('windmill-base', 'card', { source: 'b2-69', fit: 'height', tint: 0xe2dccc, massAlpha: 0.2 });
  solid('silo', 'card', { source: 'b2-67', fit: 'height', tint: 0xd4cbbd, massAlpha: 0.3 });
  solid('west-storage', 'card', { source: 'b2-68', fit: 'width', tint: 0xc9c2b2, massAlpha: 0.4 });
  solid('east-storage', 'card', { source: 'b2-63', fit: 'width', tint: 0xbfae98, massAlpha: 0.5, roof: 'dirt' });
  solid('north-hedge', 'hedge', { source: 'b2-75', spacing: 140, tint: 0xd8d6b8 });
  solid('east-field-edge', 'hedge', { source: 'b2-75', spacing: 150, tint: 0xd2d4b0 });
  solid('west-field-row', 'pickets', { tint: 0xc4b094, spacing: 18 });
  solid('east-field-row', 'pickets', { tint: 0xc4b094, spacing: 18 });
  solid('yard-timber', 'card', { source: 'b2-79', fit: 'width', tint: 0xe2d8c4, massAlpha: 0 });
  solid('yard-wall', 'stakes', { tint: 0xb9a58a, spacing: 24 });
  // Crop rows in the lanes between furrows: iris clumps read as standing crop,
  // thistle and bell flower break the repetition.
  for (const [name, minX, minY, maxX, maxY, axis] of FIELDS) {
    const lanes = [];
    for (let at = (axis === 'y' ? minX + 50 : minY + 40) + FURROW_SPACING / 2; at < (axis === 'y' ? maxX - 50 : maxY - 40); at += FURROW_SPACING) lanes.push(at);
    lanes.forEach((lane, l) => placeLine(context, { key: `crop-${name}-${l}`, from: point(axis === 'y' ? lane : minX + 30, axis === 'y' ? minY + 30 : lane), to: point(axis === 'y' ? lane : maxX - 30, axis === 'y' ? maxY - 30 : lane), spacing: CROP_SPACING, radius: 12, jitter: 10,
      place: (x, y, n, v) => { const source = (n + l) % 7 === 6 ? 'b1-07' : (n + l) % 11 === 5 ? 'b1-06' : 'b1-09'; prop(source, x, y, source === 'b1-09' ? 52 + n % 3 * 5 : 46 + n % 2 * 6, { flip: v > 0.5, tint: source === 'b1-09' ? 0xe4dcb0 : 0xe0dcc8, shadow: n % 2 === 0 }); } }));
  }
  // Hedgerow boundaries along the field margins that have no authored solid.
  for (const [key, from, to] of [['hedge-east-south', [1200, 930], [1650, 930]], ['hedge-west', [-1420, 160], [-1420, 990]], ['hedge-north-south', [-1150, -720], [-350, -720]], ['hedge-northwest', [-1900, -140], [-1420, -140]]]) {
    placeLine(context, { key, from: point(...from), to: point(...to), spacing: 150, radius: 70, place: (x, y, n) => prop('b2-75', x, y, 66, { flip: n % 2 === 1, tint: 0xd2d6b0 }) });
  }
  // Fallow meadows: straw flowers and a few shrubs.
  for (const [p, x, y, rx, ry] of [[0, -1660, 575, 200, 380], [1, -1650, -525, 220, 330], [2, 1400, 1700, 320, 180], [3, -1500, 1700, 300, 180]]) scatter({ key: `fallow-${p}`, x: cx + x, y: cy + y, rx, ry, count: 26, radius: 14, place: (px, py, n, v) => {
    const source = FALLOW[(n + p) % FALLOW.length];
    prop(source, px, py, source === 'b1-01' ? 48 + n % 3 * 6 : 36 + n % 3 * 5, { flip: v > 0.5, tint: source === 'b1-01' ? 0xccd0a6 : 0xe6e0cc, shadow: n % 2 === 0 });
  } });
  // Yard trees, the willow by the mill race, birches at the storage nooks.
  for (const [x, y, source, flip] of [[-1650, -1150, 'b2-71', false], [-1750, -1650, 'b2-71', true], [1750, -1750, 'b1-03', false], [-200, 1700, 'b1-03', true], [1850, 1150, 'b2-70', false], [-1800, 1250, 'b1-03', false], [600, 1700, 'b2-71', true], [1850, -550, 'b1-03', true]]) {
    if (guard.clear(cx + x, cy + y, 40)) prop(source, cx + x, cy + y, CANOPY_HEIGHTS[source] * (0.84 + 0.22 * stableUnit('farm-tree', x, y)), { flip, tint: source === 'b2-70' ? 0xcfc9bb : 0xe2e0cc });
  }
  // Yard clutter: the well, log piles at the sheds, a farm pickup and trailer.
  for (const [x, y, source, height, flip] of [[-100, -300, 'b2-80', 92, false], [-1150, 1560, 'b2-79', 62, false], [1150, 1700, 'b2-79', 60, true], [700, -1700, 'b2-79', 58, false], [-520, 1520, 'b2-79', 56, true], [-250, 420, 'b2-54', 74, true], [1250, -1680, 'b2-57', 60, false], [600, -300, 'b2-61', 46, false], [-900, -1700, 'b1-18', 60, false]]) {
    if (guard.clear(cx + x, cy + y, 30)) prop(source, cx + x, cy + y, height, { flip, tint: 0xd9d2c2 });
  }
  // Woodland beyond the field edges roots on the closed world masses only.
  placeEdgeWoodland(context, { key: 'farm-edge', sources: EDGE_TREES, perSide: 23, height: (source, side, n, v) => CANOPY_HEIGHTS[source] * (0.88 + 0.24 * v), tint: 0xdcdac4 });
  // Grass tufts along the field margins and the yard edges.
  for (const [p, x, y, rx, ry] of [[0, 0, 1650, 500, 200], [1, 1450, -1750, 420, 160], [2, -1700, 1550, 220, 300], [3, 1700, 500, 160, 300], [4, -400, -1700, 260, 120]]) scatter({ key: `tuft-${p}`, x: cx + x, y: cy + y, rx, ry, count: 18, radius: 8, place: (px, py, n, v) => {
    plan.ground.decals.push({ id: `tuft-${p}-${n}`, source: 'detail:grass', x: px, y: py, scale: 0.9 + v * 0.5, rotation: 0, alpha: 0.7, tint: 0xd2d0a0, flip: n % 2 === 1 });
  } });
  return freezeDeep(plan);
}
