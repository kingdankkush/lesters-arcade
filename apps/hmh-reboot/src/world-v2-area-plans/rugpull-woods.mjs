// Rugpull Woods dressing plan. Roots on the authored banks, low understory in
// pockets off the trails, HD camp cards on the existing solids. Frozen data
// only; the plan never adds a blocker, surface, objective or rule.
import { freezeDeep } from '../value-guards.mjs';
import { pointInPolygon, stableUnit, DISTRICT_TERRAIN } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext, CANOPY_HEIGHTS } from './plan-support.mjs';

export const RUGPULL_WOODS_PAGES = Object.freeze(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-01.webp', 'tripo-props-hd-props-00.webp']);
const BANK_TREES = ['b1-55', 'b1-50', 'b1-03', 'b1-55', 'b2-72', 'b1-50', 'b1-53'];
const EDGE_TREES = ['b1-55', 'b1-50', 'b2-72', 'b1-50', 'b1-55', 'b2-70'];
const POCKETS = [[-1050, -650, 260, 260], [-350, -500, 170, 200], [-200, 550, 180, 190], [1150, -700, 180, 130],
  [1250, 650, 230, 190], [-1150, 850, 200, 160], [-900, -1600, 160, 130], [450, 1200, 260, 190],
  [150, 1650, 230, 150], [-1550, -400, 160, 240], [-1400, 1700, 160, 130], [1400, -1500, 160, 180],
  [-330, -190, 135, 80], [-190, 190, 110, 90], [180, -190, 115, 95], [260, 190, 120, 90],
  [-470, 200, 115, 125], [-450, -320, 140, 90], [135, 380, 100, 125], [500, 280, 115, 140]];

export function createRugpullWoodsArtPlan(world) {
  const context = createAreaPlanContext(world, 'rugpull-woods', { pages: RUGPULL_WOODS_PAGES, margin: 260, routeClearance: 74 });
  if (!context) return null;
  const { area, plan, point, prop, solid, scatter, guard, supportAt, insideWorld, routeSegments } = context;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'forest' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  // Camp ground reads as trodden earth; the abandoned stores are overgrown.
  plan.ground.zones.push(
    { id: 'camp-court', material: 'campearth', feather: 120, alpha: 0.8, vertices: [point(380, -720), point(1180, -700), point(1420, -300), point(1360, 520), point(760, 640), point(300, 400), point(240, -300)] },
    { id: 'lookout-bank-top', material: 'dirt', feather: 60, alpha: 0.6, vertices: [point(430, -1420), point(870, -1420), point(870, -1100), point(430, -1100)] },
    { id: 'stores-yard', material: 'dirt', feather: 130, alpha: 0.6, vertices: [point(-1180, 1300), point(-280, 1330), point(-260, 1780), point(-1200, 1760)] },
  );
  const seen = new Set();
  for (const segment of routeSegments) {
    const key = `${segment.a.x},${segment.a.y}|${segment.b.x},${segment.b.y}`;
    if (seen.has(key)) continue; seen.add(key);
    plan.ground.trails.push({ id: `trail-${plan.ground.trails.length}`, material: 'campearth', points: [segment.a, segment.b], width: segment.kind === 'main' ? 52 : 42, halo: 24 });
  }
  // Camp structures on the authored solids (HD cards replace the soft 256 px ones).
  solid('supply-tent', 'card', { source: 'b1-13', fit: 'width', tint: 0xe6dcc8 });
  solid('lookout-post', 'card', { source: 'b2-67', fit: 'width', tint: 0xd9d4c4 });
  solid('abandoned-store', 'card', { source: 'b2-68', fit: 'width', tint: 0xc9c2b2 });
  solid('abandoned-lean-to', 'card', { source: 'b1-13', fit: 'width', tint: 0xbdb5a2 });
  solid('east-palisade', 'stakes', { tint: 0xd6cbb6, spacing: 26 });
  solid('south-windbreak', 'hedge', { source: 'b2-75', spacing: 140, tint: 0xd8d6b8 });
  solid('supply-stack', 'hedge', { source: 'b2-79', spacing: 62, tint: 0xe2d8c4 });
  for (const name of ['northwest-root-bank', 'western-woodland-edge', 'southeast-bank']) solid(name, 'bank', { roof: 'forest' });
  // Mixed ages/species root on the actual blocked banks, never across open paths.
  const banks = context.pieces.filter(piece => piece.kind === 'cliff');
  for (const bank of banks) {
    const b = bank.visible.bounds; let n = 0;
    for (let y = b.minY + 65; y < b.maxY; y += 150) for (let x = b.minX + 65; x < b.maxX; x += 165) {
      const px = x + Math.sin(n * 2.7) * 39, py = y + Math.cos(n * 1.9) * 30; n++;
      if (!pointInPolygon(px, py, bank.blocker.shape.vertices)) continue;
      const source = BANK_TREES[n % BANK_TREES.length], height = CANOPY_HEIGHTS[source] * (0.86 + 0.28 * stableUnit('bank', bank.id, n));
      prop(source, px, py, height, { groundZ: bank.visible.height, flip: n % 3 === 0, tint: source === 'b1-03' ? 0xe4e0cf : 0xe6e2cc });
    }
  }
  // Outer woodland roots stay in existing closed land beyond the area edge; road mouths remain open.
  for (let side = 0; side < 4; side++) for (let n = 0; n < 23; n++) {
    const t = (n + 0.5) / 23, drift = 70 + Math.sin(n * 2.3 + side) * 30, b = area.bounds;
    const x = side === 0 ? b.minX - drift : side === 1 ? b.maxX + drift : b.minX + t * (b.maxX - b.minX);
    const y = side === 2 ? b.minY - drift : side === 3 ? b.maxY + drift : b.minY + t * (b.maxY - b.minY);
    const support = insideWorld(x, y) ? supportAt(x, y) : null;
    if (!support || support.visible.areaId) continue;
    const source = EDGE_TREES[(n + side) % EDGE_TREES.length];
    prop(source, x, y, CANOPY_HEIGHTS[source] * (0.9 + 0.22 * stableUnit('edge', side, n)), { groundZ: support.visible.height, flip: n % 2 === 1, tint: 0xdcdac4 });
  }
  // Low, walk-through understory islands frame clear trail and camp sightlines.
  const { x: cx, y: cy } = area.center;
  POCKETS.forEach(([x, y, rx, ry], p) => scatter({ key: `pocket-${p}`, x: cx + x, y: cy + y, rx, ry, count: 13, radius: 18, place: (px, py, n, v) => {
    const source = n % 5 === 4 ? 'b1-02' : n % 3 ? 'b1-04' : 'b1-01';
    prop(source, px, py, source === 'b1-04' ? 34 + n % 4 * 6 : source === 'b1-02' ? 44 + n % 3 * 6 : 50 + n % 3 * 5, { flip: v > 0.5, tint: source === 'b1-04' ? 0xd8d2aa : 0xc8caa0, shadow: n % 2 === 0 });
  } }));
  // Stumps, fungus and root balls on firm bank ground near the camps and stores.
  for (const [x, y, source, height] of [[-1180, -1450, 'b1-49', 110], [-1570, 850, 'b2-73', 70], [1350, 1400, 'b1-49', 100], [-1100, 1700, 'b2-74', 120], [1700, 1500, 'b2-73', 64], [-1750, 1200, 'b2-74', 110]]) {
    const support = supportAt(cx + x, cy + y);
    if (support) prop(source, cx + x, cy + y, height, { groundZ: support.visible.height, tint: 0xd6c7a7 });
  }
  // Camp clutter: sandbags and scrap at the occupied camp only, clear of the objective frontage and exits.
  for (const [x, y, source, height, flip] of [[1220, -520, 'b1-17', 46, false], [1300, 420, 'b1-18', 62, true], [560, 560, 'b1-17', 44, true], [1260, -80, 'b1-18', 58, false]]) {
    if (guard.clear(cx + x, cy + y, 24)) prop(source, cx + x, cy + y, height, { flip, tint: 0xd9d2c2, shadow: true });
  }
  return freezeDeep(plan);
}
