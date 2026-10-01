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
import { createWorldV2NavGrid } from './world-v2-navgrid.mjs';
import { createWorldV2Combat } from './world-v2-combat.mjs';

export function createWorldV2RuntimeContext({ selection } = {}) {
  if (selection?.official !== false || selection?.rankedEligible !== false) throw new TypeError('the ten-area world context requires an unofficial, unranked selection');
  const authored = createWorldV2RuntimeWorld();
  const audit = auditWorldV2(authored);
  if (!audit.ok) throw new Error(`ten-area world audit failed: ${audit.errors.join('; ')}`);
  const gameplay = createWorldV2Gameplay(authored);
  // The enemy nav grid is built here, once, with the bucket-indexed walk; the
  // runtime's chunked builder adopts it instead of walking 78k cells in idle
  // slices. Same contract object plus `navGrid`.
  const navGrid = createWorldV2NavGrid({ world: authored, queryGround: createWorldV2GroundQuery(authored) });
  const world = Object.freeze({ ...authored, navGrid });
  // Slice HMH-TEN-AREA-GAMEPLAY-WIRING: district bosses, the 2.0 enemies and
  // cover + traversal for this world only (main.mjs reads `combat`).
  const combat = createWorldV2Combat({ world, gameplay, queryGround: createWorldV2GroundQuery(world) });
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
    combat,
    pointOfInterestPlacements: buildWorldV2PointOfInterestPlacements(world),
    audit: freezeDeep({ ok: audit.ok, detachedRouteIds: audit.detachedRouteIds }),
  });
}
