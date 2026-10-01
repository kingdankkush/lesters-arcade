// Fork Fortress dressing plan (brief 09): stilted guard towers on both
// gatehouses, stacked containers and jersey barriers as rampart fill on the
// curtain arms, a masonry keep with a sealed bunker door, the brick warehouse
// on the supply store, a satellite relay bunker on the court's tall cover,
// sandbag emplacements and scrap barricades at the gate and working edges, and
// server racks and transformers framing the Foreman's work court. Frozen data
// only; the plan never adds a blocker, surface, objective or rule.
//
// The quonset hut stands on the closed high ground north of the keep (not on
// the court's open floor), so every large building card still sits on real
// collision. The bunker door is a sealed card: it implies no interaction.
import { freezeDeep } from '../value-guards.mjs';
import { DISTRICT_TERRAIN } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext } from './plan-support.mjs';
import { placeLine, placeOnBank, placeEdgeWoodland, placeAlongPolygonEdges } from './plan-lines.mjs';

export const FORK_FORTRESS_PAGES = Object.freeze(['tripo-props-hd-structures-00.webp', 'tripo-props-hd-structures-01.webp', 'tripo-props-hd-props-00.webp']);
// Iron #424B4B and masonry #7B7C70 as pale multiplicative tints. The stacked
// containers' rust panel is pulled toward iron grey.
export const FORTRESS_IRON_TINT = 0x96a0a4;
export const FORTRESS_MASONRY_TINT = 0xc4c4bc;

export function createForkFortressArtPlan(world) {
  const context = createAreaPlanContext(world, 'fork-fortress', { pages: FORK_FORTRESS_PAGES, margin: 260, routeClearance: 70 });
  if (!context) return null;
  const { area, plan, point, prop, solid, guard, supportAt, insideWorld, routeSegments } = context;
  const { x: cx, y: cy } = area.center;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: 'gravel' };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] };
  // Masonry work court, a worn gate threshold, the loading track and drainage
  // along the curtain feet toward the lower service side.
  plan.ground.zones.push(
    { id: 'work-court', material: 'masonry', feather: 100, alpha: 0.55, vertices: [point(-760, -1150), point(980, -1150), point(980, 620), point(-760, 620)] },
    { id: 'gate-threshold', material: 'dirt', feather: 70, alpha: 0.55, vertices: [point(-1300, -300), point(-650, -300), point(-650, 300), point(-1300, 300)] },
    { id: 'loading-yard', material: 'dirt', feather: 90, alpha: 0.5, vertices: [point(-1500, 1250), point(-500, 1250), point(-500, 1850), point(-1500, 1850)] },
    { id: 'keep-apron', material: 'masonry', feather: 70, alpha: 0.6, vertices: [point(-560, -1220), point(760, -1220), point(760, -1120), point(-560, -1120)] },
  );
  for (const segment of routeSegments) plan.ground.trails.push({ id: `trail-${plan.ground.trails.length}`, material: 'gravel', points: [segment.a, segment.b], width: segment.kind === 'main' ? 52 : 40, halo: 14 });
  // Hierarchy on the authored solids.
  solid('keep', 'mass', { wall: 'masonry', roof: 'slate', tint: FORTRESS_MASONRY_TINT });
  solid('ridge-foot', 'bank', { roof: 'rock', tint: 0xc8cac4 });
  for (const name of ['north-gatehouse', 'south-gatehouse']) solid(name, 'card', { source: 'b1-15', fit: 'height', tint: 0xc0bcb4, massAlpha: 0.45 });
  for (const name of ['west-curtain', 'east-curtain']) solid(name, 'hedge', { source: 'b1-43', spacing: 175, tint: FORTRESS_IRON_TINT });
  solid('service-store', 'card', { source: 'b2-63', fit: 'width', tint: 0xc8c2b8 });
  solid('yard-low-barrier', 'hedge', { source: 'b2-49', spacing: 100, tint: 0xc8cac6 });
  solid('yard-tall-wall', 'card', { source: 'b1-46', fit: 'height', tint: FORTRESS_IRON_TINT, massAlpha: 0.3 });
  // The keep door: the sealed concrete bunker entrance against the keep's south face.
  const keep = context.piece('keep');
  prop('b2-66', cx - 260, keep.visible.bounds.maxY + 8, 210, { tint: 0xb8bab4, shadow: true, fade: true });
  // Compound buildings on the closed high ground beyond the keep.
  for (const [x, y, source, height, flip] of [[-160, -2150, 'b2-68', 200, false], [560, -2140, 'b2-63', 190, true], [1300, -2160, 'b2-68', 190, true]]) {
    const support = insideWorld(cx + x, cy + y) ? supportAt(cx + x, cy + y) : null;
    if (support && !support.visible.areaId) prop(source, cx + x, cy + y, height, { groundZ: support.visible.height, flip, tint: FORTRESS_MASONRY_TINT });
  }
  // Rampart fill: jersey barriers along the curtain feet, containers on the
  // keep's flanks, sandbag emplacements at the gate, scrap barricades at the
  // service edges. None stands across a route or the court centre.
  for (const name of ['west-curtain', 'east-curtain']) {
    placeAlongPolygonEdges(context, context.piece(name).blocker.shape.vertices, { key: `${name}-fill`, spacing: 130, offset: 44, radius: 16, place: (px, py, n, v) => {
      if (n % 4 === 3) prop('b1-18', px, py, 54, { flip: v > 0.5, tint: 0xc0bcb4 });
      else prop('b2-49', px, py, 32, { flip: v > 0.5, tint: 0xc8cac6, fade: false });
    } });
  }
  for (const [x, y, flip] of [[-1300, -260, false], [-1300, 260, true], [-1180, -700, false], [-1180, 700, true], [-760, -650, true], [-760, 650, false]]) {
    if (guard.clear(cx + x, cy + y, 26)) prop('b1-17', cx + x, cy + y, 52, { flip, tint: 0xc8c2b0 });
  }
  for (const [x, y, flip] of [[-760, -1300, false], [880, -1300, true], [-1550, -950, false], [1400, -1600, true], [1930, 400, false], [1400, 1500, true]]) {
    if (guard.clear(cx + x, cy + y, 30)) prop('b1-43', cx + x, cy + y, 170, { flip, tint: FORTRESS_IRON_TINT });
  }
  for (const [x, y, flip] of [[-1500, 600, false], [-200, 1300, true], [600, 1350, false], [1400, 600, true], [-1500, 1250, true], [1850, 1500, false]]) {
    if (guard.clear(cx + x, cy + y, 28)) prop('b1-18', cx + x, cy + y, 58, { flip, tint: 0xc0bcb4 });
  }
  // Foreman arena machinery at the court perimeter: racks and transformers in
  // short banks against the keep apron and the curtains; the centre stays clear.
  placeLine(context, { key: 'keep-racks-west', from: point(-520, -1170), to: point(-80, -1170), spacing: 64, radius: 14, place: (px, py, n, v) => prop(n % 3 === 1 ? 'b1-19' : 'b1-41', px, py, n % 3 === 1 ? 74 : 80, { flip: v > 0.5, tint: FORTRESS_IRON_TINT }) });
  placeLine(context, { key: 'keep-racks-east', from: point(260, -1170), to: point(720, -1170), spacing: 64, radius: 14, place: (px, py, n, v) => prop(n % 3 === 1 ? 'b1-19' : 'b1-41', px, py, n % 3 === 1 ? 74 : 80, { flip: v > 0.5, tint: FORTRESS_IRON_TINT }) });
  placeLine(context, { key: 'east-racks', from: point(930, -1080), to: point(930, -560), spacing: 90, radius: 14, place: (px, py, n, v) => prop(n % 2 ? 'b1-19' : 'b1-41', px, py, n % 2 ? 72 : 78, { flip: v > 0.5, tint: FORTRESS_IRON_TINT }) });
  placeLine(context, { key: 'west-racks', from: point(-820, -1100), to: point(-820, -760), spacing: 90, radius: 14, place: (px, py, n, v) => prop(n % 2 ? 'b1-41' : 'b1-19', px, py, n % 2 ? 78 : 72, { flip: v > 0.5, tint: FORTRESS_IRON_TINT }) });
  // Ridge rock carries the northwest support; masonry rubble and drainage
  // spoil gather at the keep and gatehouse feet; the high ground beyond the
  // area edge reads as broken rock rather than open ground.
  placeOnBank(context, context.piece('ridge-foot'), { key: 'ridge-foot-rock', stepX: 170, stepY: 160, inset: 80, sources: ['b1-42'], height: (source, n, v) => 100 + 80 * v, tint: 0xa8acb0 });
  for (const name of ['keep', 'north-gatehouse', 'south-gatehouse', 'service-store']) {
    placeAlongPolygonEdges(context, context.piece(name).blocker.shape.vertices, { key: `${name}-rubble`, spacing: 140, offset: 40, radius: 14, jitter: 10, place: (px, py, n, v) => prop(n % 3 === 2 ? 'b1-18' : 'b2-49', px, py, n % 3 === 2 ? 48 : 22 + n % 3 * 4, { flip: v > 0.5, tint: n % 3 === 2 ? 0xc0bcb4 : 0xc8cac6, fade: false }) });
  }
  placeEdgeWoodland(context, { key: 'fortress-edge', sources: ['b1-42', 'b1-42', 'b1-43', 'b1-42'], perSide: 20, height: (source, side, n, v) => source === 'b1-43' ? 160 : 110 + 80 * v, tint: FORTRESS_IRON_TINT });
  // Barricade line on the outer edge of the lower service loop.
  placeLine(context, { key: 'service-barricade', from: point(-1500, 300), to: point(-1500, 1000), spacing: 120, radius: 18, place: (px, py, n, v) => prop(n % 2 ? 'b1-18' : 'b2-49', px, py, n % 2 ? 56 : 32, { flip: v > 0.5, tint: 0xc0bcb4 }) });
  placeLine(context, { key: 'loading-barricade', from: point(-200, 1250), to: point(900, 1250), spacing: 140, radius: 18, place: (px, py, n, v) => prop(n % 3 === 1 ? 'b1-17' : 'b2-49', px, py, n % 3 === 1 ? 46 : 30, { flip: v > 0.5, tint: 0xc4c2bc }) });
  // Store stock along the loading side, clear of the secret nook.
  for (const [x, y, source, height, flip] of [[-1420, 1300, 'b1-17', 48, false], [-1380, 1820, 'b1-19', 70, true], [-700, 1300, 'b1-41', 76, false]]) {
    if (guard.clear(cx + x, cy + y, 20)) prop(source, cx + x, cy + y, height, { flip, tint: FORTRESS_IRON_TINT });
  }
  return freezeDeep(plan);
}
