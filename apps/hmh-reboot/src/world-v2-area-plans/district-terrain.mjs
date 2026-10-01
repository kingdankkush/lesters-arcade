// Terrain-only plans for districts without an authored dressing plan, plus the
// world-wide closed-mass plan. Each undressed district gets its brief ground
// pair through the splat shader, worn trails along its inspection routes,
// rock treatment on its authored cliffs and roof/wall tints on its buildings.
// Frozen data only; no blocker, surface, objective or rule is added.
import { freezeDeep } from '../value-guards.mjs';
import { DISTRICT_TERRAIN, createAreaArtPlanShell } from '../world-v2-area-art-schema.mjs';
import { createAreaPlanContext } from './plan-support.mjs';

export const WORLD_MASSES_PLAN_ID = 'world-masses';
// Wall and roof materials by district palette (bible section 4).
export const DISTRICT_BUILDING_KIT = Object.freeze({
  'litecoin-city': { wall: 'masonry', roof: 'slate', tint: 0xcfd4d2 },
  'halving-farms': { wall: 'timber', roof: 'slate', tint: 0xd9ccb8 },
  'silver-coast': { wall: 'masonry', roof: 'slate', tint: 0xe2ddd0 },
  'scrypt-bayou': { wall: 'timber', roof: 'slate', tint: 0xc4bfae },
  'hashwood-river': { wall: 'timber', roof: 'slate', tint: 0xcdc9b8 },
  'hollow-pines': { wall: 'masonry', roof: 'slate', tint: 0xb9bcc2 },
  'ledger-ridge': { wall: 'timber', roof: 'slate', tint: 0xc9c6bb },
  'fork-fortress': { wall: 'masonry', roof: 'slate', tint: 0xb4b6b0 },
});

export function createDistrictTerrainArtPlan(world, areaId) {
  if (!DISTRICT_TERRAIN[areaId]) return null;
  const context = createAreaPlanContext(world, areaId, { pages: [] });
  if (!context) return null;
  const { area, plan, routeSegments, pieces } = context;
  plan.ground.base = { surfaceId: `${area.id}-floor`, material: DISTRICT_TERRAIN[areaId].materials[0] };
  plan.ground.terrain = { ...DISTRICT_TERRAIN[areaId] };
  for (const segment of routeSegments) plan.ground.trails.push({ id: `trail-${plan.ground.trails.length}`, material: DISTRICT_TERRAIN[areaId].materials[1], points: [segment.a, segment.b], width: segment.kind === 'main' ? 48 : 36, halo: 18 });
  const kit = DISTRICT_BUILDING_KIT[areaId] ?? { wall: 'masonry', roof: 'slate', tint: 0xcfccc0 };
  for (const piece of pieces) {
    if (!piece.blocker) continue;
    if (piece.kind === 'cliff') plan.solids.push({ pieceId: piece.id, style: 'bank', roof: 'rock', tint: 0xd6d3c8 });
    else if (piece.kind === 'mass') plan.solids.push({ pieceId: piece.id, style: 'mass', wall: kit.wall, roof: kit.roof, tint: kit.tint });
  }
  return freezeDeep(plan);
}

// Every closed mass and world guard between the districts as a rock bank.
export function createWorldMassesArtPlan(world) {
  if (!world?.pieces?.length) return null;
  const plan = createAreaArtPlanShell({ areaId: WORLD_MASSES_PLAN_ID, bounds: world.bounds, pages: [] });
  for (const piece of world.pieces) if (piece.blocker && piece.kind === 'cliff' && !piece.visible.areaId) plan.solids.push({ pieceId: piece.id, style: 'bank', roof: 'rock', tint: 0xcdcbc2 });
  return freezeDeep(plan);
}
