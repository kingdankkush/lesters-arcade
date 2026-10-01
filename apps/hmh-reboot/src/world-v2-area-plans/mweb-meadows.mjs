// MWEB Meadows dressing plan (brief 01): a maintained road giving way to
// neglected suburb gardens. Clapboard homes, hedgerows, a picket lane, the old
// oak on the relay green, wildflower beds and meadow grass detail. Frozen data
// only; no blocker, surface, objective or rule is added.
import { freezeDeep } from '../value-guards.mjs';
import { stableUnit, DISTRICT_TERRAIN } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext, CANOPY_HEIGHTS } from './plan-support.mjs';

export const MWEB_MEADOWS_PAGES = Object.freeze(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-00.webp', 'tripo-props-hd-props-00.webp']);
const FLOWERS = ['b1-06', 'b1-10', 'b1-08', 'b1-06', 'b1-09'];

export function createMwebMeadowsArtPlan(world) {
  const context = createAreaPlanContext(world, 'mweb-meadows', { pages: MWEB_MEADOWS_PAGES, margin: 0, routeClearance: 60, siteClearance: 150 });
  if (!context) return null;
  const { area, plan, point, prop, solid, scatter, guard, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'meadow' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  // Garden beds and the worn relay court; a gravel apron carries the paved road
  // into the green and out toward the farm road.
  plan.ground.zones.push(
    { id: 'entry-apron', material: 'gravel', feather: 60, alpha: 0.75, vertices: [point(-900, -95), point(-120, -110), point(40, -60), point(40, 60), point(-120, 110), point(-900, 95)] },
    { id: 'farm-apron', material: 'gravel', feather: 60, alpha: 0.7, vertices: [point(200, -90), point(900, -100), point(900, 100), point(200, 90)] },
    { id: 'relay-court', material: 'earth', feather: 80, alpha: 0.7, vertices: [point(260, -760), point(880, -780), point(920, -420), point(700, -180), point(300, -220)] },
    { id: 'garden-bed-west', material: 'earth', feather: 60, alpha: 0.6, vertices: [point(-1480, -1180), point(-1000, -1200), point(-960, -900), point(-1460, -880)] },
    { id: 'garden-bed-south', material: 'earth', feather: 60, alpha: 0.55, vertices: [point(-1360, 760), point(-860, 740), point(-820, 900), point(-1340, 920)] },
    { id: 'east-lawn', material: 'meadow', feather: 120, alpha: 0.6, vertices: [point(1100, -1050), point(1800, -1080), point(1820, -500), point(1120, -480)] },
    { id: 'porch-yard', material: 'earth', feather: 50, alpha: 0.5, vertices: [point(-1400, 40), point(-560, 40), point(-560, 400), point(-1400, 400)] },
  );
  for (const segment of routeSegments) {
    if (segment.routeId === `${area.id}-city-green`) continue; // carried by the gravel apron
    plan.ground.trails.push({ id: `trail-${plan.ground.trails.length}`, material: 'earth', points: [segment.a, segment.b], width: segment.kind === 'main' ? 42 : 34, halo: 16 });
  }
  // Homes and garden walls on the authored solids.
  solid('garden-home', 'card', { source: 'b2-62', fit: 'width', tint: 0xe6e2d6 });
  solid('north-home', 'card', { source: 'b2-62', fit: 'width', tint: 0xd4cec0 });
  solid('relay-home', 'card', { source: 'b2-62', fit: 'width', tint: 0xdfdacd });
  solid('east-home', 'card', { source: 'b1-51', fit: 'width', tint: 0xd8d6cc });
  solid('south-home', 'card', { source: 'b2-62', fit: 'width', tint: 0xcdc7b8 });
  solid('garden-wall', 'hedge', { source: 'b2-75', spacing: 120, tint: 0xd6d8b4 });
  solid('garden-fence', 'pickets', { tint: 0xd4d0be, spacing: 16 });
  solid('old-oak-placeholder', 'card', { source: 'b1-55', fit: 'height', tint: 0xe8e4cf, massAlpha: 0 });
  solid('court-low-cover', 'card', { source: 'b2-49', fit: 'width', tint: 0xd2d0c8, massAlpha: 0 });
  solid('court-wall', 'stakes', { tint: 0x9a978c, spacing: 24 });
  // Willows shade the green edges; birches and hedges break up the gardens.
  for (const [x, y, source, flip] of [[-760, -720, 'b2-71', false], [1120, 620, 'b2-71', true], [-1500, 1620, 'b2-71', false], [1720, -200, 'b1-03', false], [-330, -1560, 'b1-03', true], [-1650, 300, 'b1-03', false], [1560, 1500, 'b2-71', false], [520, 1500, 'b1-03', true], [-1550, -1650, 'b2-70', false], [1780, -1750, 'b1-03', false]]) {
    if (guard.clear(cx + x, cy + y, 40)) prop(source, cx + x, cy + y, CANOPY_HEIGHTS[source] * (0.86 + 0.2 * stableUnit('tree', x, y)), { flip, tint: source === 'b2-70' ? 0xcfc9bb : 0xe2e0cc });
  }
  for (const [x, y, flip] of [[-1500, -380, false], [-820, -1260, true], [920, -1000, false], [1400, -950, true], [-640, 1180, false], [820, 980, true], [1320, 260, false]]) {
    if (guard.clear(cx + x, cy + y, 80)) prop('b2-75', cx + x, cy + y, 66, { flip, tint: 0xd2d6b0, shadow: true });
  }
  // Garden clutter: stone well by the garden home, log piles by the south home and porch.
  for (const [x, y, source, height, flip] of [[-1010, -1130, 'b2-80', 92, false], [-860, 940, 'b2-79', 62, false], [-1300, 560, 'b2-79', 58, true], [1560, -600, 'b2-80', 90, true]]) {
    if (guard.clear(cx + x, cy + y, 30)) prop(source, cx + x, cy + y, height, { flip, tint: 0xe0dacb });
  }
  // Wildflower beds and shrubs in the neglected gardens, never in the combat lane or on routes.
  const beds = [[-1240, -1040, 200, 110], [-1100, 830, 210, 70], [-1240, 1420, 160, 120], [1450, -780, 260, 150], [1620, 300, 180, 200], [-640, -1560, 200, 90], [-400, 1300, 220, 110], [1000, 1250, 200, 130], [-1720, 1000, 120, 220], [560, -1690, 220, 90]];
  beds.forEach(([x, y, rx, ry], p) => scatter({ key: `bed-${p}`, x: cx + x, y: cy + y, rx, ry, count: 9, radius: 16, place: (px, py, n, v) => {
    const source = n % 4 === 3 ? 'b1-01' : FLOWERS[(n + p) % FLOWERS.length];
    prop(source, px, py, source === 'b1-01' ? 46 + n % 3 * 6 : 36 + n % 3 * 5, { flip: v > 0.5, tint: source === 'b1-01' ? 0xccd0a6 : 0xe4e2d4, shadow: n % 2 === 0 });
  } }));
  // Broken fence clue: brambles crowd the secret gap without hiding it.
  for (const [x, y] of [[-1470, -560], [-1330, -850], [-1520, -880]]) if (guard.clear(cx + x, cy + y, 20)) prop('b1-02', cx + x, cy + y, 48, { tint: 0xd0cbb4, shadow: false });
  // Meadow grass detail: tufts across the green edges and gravel aprons carry the road into the green.
  const tufts = [[-1500, -1500, 420, 320], [1500, -1500, 400, 320], [-1400, 1300, 460, 420], [1400, 1300, 440, 420], [0, 1200, 700, 360], [0, -1500, 600, 260], [-900, 560, 360, 240], [1300, -300, 340, 260]];
  tufts.forEach(([x, y, rx, ry], p) => scatter({ key: `tuft-${p}`, x: cx + x, y: cy + y, rx, ry, count: 22, radius: 8, place: (px, py, n, v) => {
    plan.ground.decals.push({ id: `tuft-${p}-${n}`, source: 'detail:grass', x: px, y: py, scale: 0.9 + v * 0.5, rotation: 0, alpha: 0.72, tint: 0xc8d2a0, flip: n % 2 === 1 });
  } }));
  return freezeDeep(plan);
}
