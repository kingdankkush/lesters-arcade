// Litecoin City dressing plan (brief 02): a civic and financial centre read
// through its streets. Asphalt High Street and River Street with kerb-side
// traffic masts, sign gantries, bus shelters and abandoned wrecks; a clean
// stone exchange plaza with kiosks and a market stall row at its edge; a
// rough gravel service lane with barriers and utilities; textured masonry
// blocks; and the skyline: a cluster of tall tenement/apartment cards on the
// north commercial roof plus building rows on the closed land beyond the west,
// east and north edges. Brand signs come from city-branding.mjs (names only).
// Frozen data only; no blocker, surface, objective or rule is added.
//
// Page budget: structures-00 + structures-01 (+ shared props-00). City has no
// foliage page, so it has no street trees (a known gap, see ART-AREAS-A.md).
import { freezeDeep } from '../value-guards.mjs';
import { appendCentrePockets } from './centre-pockets.mjs';
import { stableUnit, DISTRICT_TERRAIN, distanceToPolyline } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext } from './plan-support.mjs';
import { placeEdgeWoodland, placeLine } from './plan-lines.mjs';
import { CITY_BRAND_SLOTS, CITY_SIGN_PREFIX, CITY_SIGN_STYLE, signForProp, signForPiece } from './city-branding.mjs';

export const LITECOIN_CITY_PAGES = Object.freeze(['tripo-props-hd-structures-00.webp', 'tripo-props-hd-structures-01.webp', 'tripo-props-hd-props-00.webp']);
const EDGE_BUILDINGS = ['b1-52', 'b1-12', 'b2-63', 'b1-51', 'b1-56', 'b2-68', 'b1-12'];
const EDGE_HEIGHTS = Object.freeze({ 'b1-52': 470, 'b1-12': 520, 'b1-56': 540, 'b1-51': 380, 'b2-63': 260, 'b2-68': 250 });
const CONCRETE = 0xd2d6d4, STEEL = 0xd6d8d4;
// Camera-safe street rule: the hero walks the authored roads and the two City
// carriageways, so no tall card (taller than ~1.4 humans) stands within
// TALL_STREET_CLEARANCE of their centrelines, and mast cards stay at or below
// MAST_MAX_HEIGHT (72-unit human; matches the world-roads masts).
export const TALL_CARD_HEIGHT = 100, TALL_STREET_CLEARANCE = 120, MAST_MAX_HEIGHT = 160;
export const CITY_STREET_CENTRELINES = Object.freeze([Object.freeze([{ x: -2000, y: 0 }, { x: 1500, y: 0 }]), Object.freeze([{ x: 0, y: -2000 }, { x: 0, y: 1000 }])]);

export function createLitecoinCityArtPlan(world) {
  const context = createAreaPlanContext(world, 'litecoin-city', { pages: LITECOIN_CITY_PAGES, margin: 260, routeClearance: 64 });
  if (!context) return null;
  const { area, plan, point, prop, solid, guard, blockingGuard, supportAt, seatOnSupport, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'paving' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  const rect = (minX, minY, maxX, maxY) => [point(minX, minY), point(maxX, minY), point(maxX, maxY), point(minX, maxY)];
  // Street structure first: two asphalt carriageways crossing at the civic
  // junction, a clean stone plaza, and a gravel service lane.
  plan.ground.zones.push(
    { id: 'high-street', material: 'asphalt', feather: 40, alpha: 0.9, vertices: rect(-2000, -150, 1500, 150) },
    { id: 'river-street', material: 'asphalt', feather: 40, alpha: 0.9, vertices: rect(-150, -2000, 150, 1000) },
    { id: 'exchange-plaza', material: 'masonry', feather: 70, alpha: 0.75, vertices: [point(320, 330), point(1600, 330), point(1600, 1630), point(320, 1630)] },
    { id: 'service-lane', material: 'gravel', feather: 60, alpha: 0.75, vertices: [point(-1290, -1700), point(-1030, -1700), point(-1030, -200), point(-1290, -200)] },
    { id: 'service-yard', material: 'gravel', feather: 60, alpha: 0.6, vertices: rect(-1250, -1640, -100, -1360) },
  );
  // A strong approach axis to the bell and worn plaza entries; the river side is a quieter walk.
  for (const segment of routeSegments) {
    const route = segment.routeId.slice(area.id.length + 1);
    if (route === 'high-street' || route === 'river-street') continue; // carried by the asphalt zones
    const [material, width, halo] = route === 'exchange-approach' ? ['paving', 120, 24] : route === 'service-loop' ? ['gravel', 64, 20] : ['paving', 80, 18];
    plan.ground.trails.push({ id: `walk-${plan.ground.trails.length}`, material, points: [segment.a, segment.b], width, halo });
  }
  // Authored solids: the corner shop frontage, textured masonry blocks, the
  // quonset service shed and kerb barriers as plaza cover.
  solid('market-block', 'card', { source: 'b1-51', fit: 'width', tint: 0xd6d6cc, massAlpha: 0.5, wall: 'masonry', roof: 'slate' });
  solid('north-commercial-block', 'mass', { wall: 'masonry', roof: 'slate', tint: 0xcfd4d2 });
  solid('exchange', 'mass', { wall: 'masonry', roof: 'slate', tint: 0xe0e2dc });
  solid('river-housing', 'mass', { wall: 'masonry', roof: 'slate', tint: 0xc9c4b8 });
  solid('service-warehouse', 'card', { source: 'b2-63', fit: 'width', tint: 0xc8c0b4, massAlpha: 0.6, wall: 'masonry', roof: 'slate' });
  solid('river-service-shed', 'card', { source: 'b2-68', fit: 'width', tint: 0xc9c6bc, massAlpha: 0.4 });
  solid('plaza-wall', 'hedge', { source: 'b2-49', spacing: 80, tint: CONCRETE });
  solid('plaza-bench', 'card', { source: 'b2-49', fit: 'width', tint: CONCRETE, massAlpha: 0 });
  // Brand sign carriers. Towers root on the north commercial roof (the skyline
  // cluster); every street carrier passes the placement guard.
  const signRadius = { tower: 0, gantry: 24, shelter: 30, stall: 40, kiosk: 22 };
  for (const slot of CITY_BRAND_SLOTS) {
    if (slot.pieceId) continue;
    const x = cx + slot.x, y = cy + slot.y, id = `${CITY_SIGN_PREFIX}${slot.slot}`;
    if (slot.carrier === 'tower') {
      const roof = supportAt(x, y);
      const flip = slot.x % 500 === 220, at = roof?.id === `${area.id}-north-commercial-block` ? seatOnSupport(slot.source, x, y, slot.height, flip, roof.visible.height) : null;
      if (at) plan.props.push({ id, source: slot.source, x: at.x, y: at.y, height: slot.height, groundZ: roof.visible.height, tint: 0xd8dcdc, flip });
    } else if (guard.clear(x, y, signRadius[slot.carrier]) && blockingGuard.clear(slot.source, x, y, slot.height, slot.y > 0)) {
      plan.props.push({ id, source: slot.source, x, y, height: slot.height, tint: slot.carrier === 'stall' ? 0xd8d2c6 : STEEL, flip: slot.y > 0, fade: slot.carrier === 'gantry', ...(slot.carrier === 'gantry' ? { shadow: false } : {}) });
    }
  }
  // Kerb furniture: traffic masts at the four junction corners and the plaza mouth.
  // Masts stand on the pavement just outside the 150-unit carriageway half
  // width and fade when the hero walks behind them.
  for (const [x, y, flip] of [[-190, -190, false], [190, -190, true], [-190, 190, false], [190, 190, true], [1300, 190, true], [-190, 760, false]]) {
    if (guard.clear(cx + x, cy + y, 14)) prop('b2-52', cx + x, cy + y, 150, { flip, tint: 0xffffff, shadow: false, fade: true });
  }
  // Interrupted daily life: wrecks pulled onto the kerbs, never in a lane.
  for (const [x, y, source, height, flip] of [[-760, 175, 'b2-54', 74, false], [-300, -175, 'b2-58', 62, true], [620, 175, 'b2-56', 88, false], [175, -720, 'b1-45', 46, true], [-175, -700, 'b2-58', 60, false], [175, 330, 'b2-54', 72, true], [-200, 820, 'b1-45', 44, false], [820, -175, 'b2-61', 46, false], [1200, 175, 'b2-58', 60, true], [-1640, -180, 'b2-57', 60, false]]) {
    if (guard.clear(cx + x, cy + y, height * 0.6)) prop(source, cx + x, cy + y, height, { flip, tint: 0xd6d2c8, fade: false });
  }
  // Service lane: barrier chicane, server racks and a transformer by the rear shed.
  for (const [x, y, source, height, flip] of [[-1270, -300, 'b2-49', 34, false], [-1270, -650, 'b2-49', 34, true], [-1010, -1280, 'b2-49', 34, false], [-1250, -1620, 'b1-41', 70, false], [-1360, -1620, 'b1-41', 66, true], [-1280, 1700, 'b1-19', 84, false], [-1280, 1820, 'b1-19', 80, true], [-1700, 1450, 'b1-18', 56, false], [-560, -1600, 'b2-49', 34, false], [-200, -1620, 'b1-41', 68, false]]) {
    if (guard.clear(cx + x, cy + y, 22)) prop(source, cx + x, cy + y, height, { flip, tint: CONCRETE });
  }
  // Plaza edge: a second stall row and fuel-pump style kiosks at the west edge, the centre stays empty.
  for (const [x, y, source, height, flip] of [[440, 1580, 'b1-13', 110, false], [1700, 1480, 'b1-44', 64, true], [1720, 540, 'b2-53', 104, true], [360, 520, 'b1-20', 84, false]]) {
    if (guard.clear(cx + x, cy + y, 30)) prop(source, cx + x, cy + y, height, { flip, tint: 0xd8d4ca });
  }
  // Parked and abandoned cars along both kerbs of the side streets and the
  // plaza approach; each line keeps the lane and the route clearance open.
  const PARKED = [['b1-45', 44], ['b2-58', 58], ['b1-45', 46], ['b2-54', 70], ['b2-56', 84], ['b1-45', 42]];
  for (const [key, from, to] of [['kerb-river-north-w', [-250, -1900], [-250, -520]], ['kerb-river-north-e', [250, -1900], [250, -620]], ['kerb-high-w-n', [-880, -260], [-330, -260]],
    ['kerb-high-e-n', [330, -260], [1700, -260]], ['kerb-high-e-s', [330, 260], [1250, 260]], ['kerb-housing', [-1450, 420], [-1450, 1500]], ['kerb-exchange', [-300, 1300], [-300, 1950]], ['kerb-service-n', [-950, -1700], [-150, -1700]]]) {
    placeLine(context, { key, from: point(...from), to: point(...to), spacing: 210, radius: 46, jitter: 8, place: (x, y, n, v) => {
      if (v < 0.28) return; // gaps read as kerb space, not a parking lot
      const [source, height] = PARKED[(n + key.length) % PARKED.length];
      prop(source, x, y, height, { flip: v > 0.64, tint: 0xd6d2c8, fade: false });
    } });
  }
  // Street furniture rhythm: barrier pairs at the plaza mouths, utility cabinets on corners.
  for (const [key, from, to, source, height] of [['plaza-kerb-west', [330, 420], [330, 1240], 'b2-49', 32], ['plaza-kerb-north', [420, 340], [1250, 340], 'b2-49', 32], ['utility-row', [-1880, -1900], [-1880, -300], 'b1-19', 78], ['housing-utility', [-1880, 450], [-1880, 1450], 'b1-19', 76]]) {
    placeLine(context, { key, from: point(...from), to: point(...to), spacing: 170, radius: 22, place: (x, y, n) => prop(source, x, y, height, { flip: n % 2 === 1, tint: CONCRETE, shadow: source !== 'b2-49' }) });
  }
  // Skyline rows on the closed land beyond the west, east and north edges.
  placeEdgeWoodland(context, { key: 'city-edge', sources: EDGE_BUILDINGS, perSide: 11, drift: 110, sides: [0, 1, 2], height: (source, side, n, v) => EDGE_HEIGHTS[source] * (0.9 + 0.2 * v), tint: 0xc4c8c8 });
  // The north edge's shed and neighbouring apartment previously interpenetrated.
  // Use a modest apartment height where the narrow closed strip cannot seat
  // a larger footprint. This is scenery on closed land, with no prop collider.
  const cornerApartment = plan.props.find(p => p.source === 'b1-12' && p.y < area.bounds.minY && p.x < cx && p.x > cx - 600);
  if (cornerApartment) {
    cornerApartment.height = 240;
  }
  // A separate front rank leaves visible lanes between all nine roof footprints.
  for (const [x, y, source, height] of [[600, -780, 'b1-12', 520], [1100, -780, 'b1-52', 500], [1600, -780, 'b1-12', 540]]) {
    const roof = supportAt(cx + x, cy + y);
    if (roof?.id === `${area.id}-north-commercial-block`) prop(source, cx + x, cy + y, height * (0.95 + 0.1 * stableUnit('roof', x)), { groundZ: roof.visible.height, tint: 0xc8cccc });
  }
  // Enforce the camera-safe street rule on everything placed at ground level.
  const streets = [...world.roads.map(road => road.points), ...CITY_STREET_CENTRELINES.map(line => line.map(p => point(p.x, p.y)))];
  plan.props = plan.props.filter(p => p.height <= TALL_CARD_HEIGHT || (p.groundZ ?? 0) > 0 || streets.every(line => distanceToPolyline(p.x, p.y, line) >= TALL_STREET_CLEARANCE));
  for (const p of plan.props) if (p.source === 'b2-52') p.height = Math.min(p.height, MAST_MAX_HEIGHT);
  // Lettered panels for every placed carrier and decorated facade (renderer hook).
  const SIGN_FIT = { tower: [0.72, 34, 220], gantry: [0.84, 30, 260], shelter: [0.96, 22, 150], stall: [0.94, 22, 170], kiosk: [1.04, 20, 120], facade: [0.62, 34, 340] };
  for (const slot of CITY_BRAND_SLOTS) {
    const sign = slot.pieceId ? (plan.solids.some(s => s.pieceId === slot.pieceId) ? signForPiece(slot.pieceId) : null) : (plan.props.some(p => p.id === `${CITY_SIGN_PREFIX}${slot.slot}`) ? signForProp(`${CITY_SIGN_PREFIX}${slot.slot}`) : null);
    if (!sign) continue;
    const [anchor, height, maxWidth] = SIGN_FIT[slot.carrier];
    plan.signs.push({ id: `sign-${slot.slot}`, ...(slot.pieceId ? { pieceId: slot.pieceId } : { propId: `${CITY_SIGN_PREFIX}${slot.slot}` }), text: sign.text, anchor, height, maxWidth, panel: CITY_SIGN_STYLE.panel, ink: CITY_SIGN_STYLE.text });
  }
  appendCentrePockets({world,area,plan});
  return freezeDeep(plan);
}
