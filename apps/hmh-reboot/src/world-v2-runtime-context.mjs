// W4a: the lazily loaded ten-area world context main.mjs adopts for an
// explicitly unranked Free `world=ten-area` selection. Never on the initial
// static path; world-context.mjs imports it on demand.
import { freezeDeep } from './value-guards.mjs';
import {
  auditWorldV2,
  buildWorldV2PointOfInterestPlacements,
  createWorldRevealState,
  createWorldV2GroundQuery,
  createWorldV2RuntimeWorld,
  getWorldRevealSnapshot,
  getWorldV2DistrictAt,
  revealWorldAt,
} from './world-v2-runtime-world.mjs';
import { createWorldV2Gameplay, selectWorldV2Entry } from './world-v2-gameplay.mjs';

export function createWorldV2RuntimeContext({ selection } = {}) {
  if (selection?.official !== false || selection?.rankedEligible !== false) throw new TypeError('the ten-area world context requires an unofficial, unranked selection');
  const world = createWorldV2RuntimeWorld();
  const audit = auditWorldV2(world);
  if (!audit.ok) throw new Error(`ten-area world audit failed: ${audit.errors.join('; ')}`);
  const gameplay = createWorldV2Gameplay(world);
  return Object.freeze({
    selection,
    world,
    official: false,
    rankedEligible: false,
    legacy: false,
    defaultDistrictId: gameplay.defaultDistrictId,
    createGroundQuery: () => createWorldV2GroundQuery(world),
    getDistrictAt: (x, y) => getWorldV2DistrictAt(world, x, y),
    reveal: Object.freeze({
      create: () => createWorldRevealState(world),
      at: (state, position, radius) => revealWorldAt(world, state, position, radius),
      snapshot: (state) => getWorldRevealSnapshot(world, state),
    }),
    selectEntry: () => selectWorldV2Entry(gameplay),
    briefing: gameplay.briefing,
    gameplay,
    pointOfInterestPlacements: buildWorldV2PointOfInterestPlacements(world),
    audit: freezeDeep({ ok: audit.ok, detachedRouteIds: audit.detachedRouteIds }),
  });
}
