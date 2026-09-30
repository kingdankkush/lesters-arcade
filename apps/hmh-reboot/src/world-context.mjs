// W4a: one place that decides which world main.mjs runs.
//
// LEVEL_ONE_WORLD (forked-frontier v1) is the default for everything. The
// ten-area world is selected only when the page URL carries exactly one
// `world=ten-area` and explicitly `mode=free`; every other combination,
// including any Ranked hint, resolves to the legacy world. The selection is
// re-checked against the actual session payload in main.mjs (a Ranked or
// rankedEligible payload is refused), and an unofficial world never creates a
// run summary or a score submission.
//
// The legacy branch hands back the legacy modules' own functions unchanged, so
// the default runtime path is the same code it was before this seam existed.
// The ten-area branch is a dynamic import: nothing of it is on the initial
// static bundle path.
import {
  LEVEL_ONE_WORLD,
  createLevelOneGroundQuery,
  createLevelOneRevealState,
  getLevelOneDistrictAt,
  getLevelOneRevealSnapshot,
  revealLevelOneAt,
} from './level-one-world.mjs';
import { selectLevelEntry } from './level-entry.mjs';

export const HMH_WORLD_PARAM = 'world';
export const TEN_AREA_WORLD_VALUE = 'ten-area';
export const TEN_AREA_WORLD_ID = 'ten-area-frontier';

const legacySelection = (reason) => Object.freeze({ worldId: LEVEL_ONE_WORLD.id, official: true, rankedEligible: true, legacy: true, reason });

export function resolveHmhWorldSelection({ params } = {}) {
  const search = params instanceof URLSearchParams ? params : new URLSearchParams(typeof params === 'string' ? params : '');
  const worlds = search.getAll(HMH_WORLD_PARAM);
  if (worlds.length === 0) return legacySelection('default');
  if (worlds.length !== 1 || worlds[0] !== TEN_AREA_WORLD_VALUE) return legacySelection('unknown-world');
  const modes = search.getAll('mode');
  if (modes.length !== 1 || modes[0] !== 'free') return legacySelection('explicit-free-mode-required');
  return Object.freeze({ worldId: TEN_AREA_WORLD_ID, official: false, rankedEligible: false, legacy: false, reason: 'explicit-unranked-free-ten-area' });
}

export function createLegacyWorldContext(selection = legacySelection('default')) {
  return Object.freeze({
    selection,
    world: LEVEL_ONE_WORLD,
    official: true,
    rankedEligible: true,
    legacy: true,
    defaultDistrictId: 'frontier-relay',
    createGroundQuery: createLevelOneGroundQuery,
    getDistrictAt: getLevelOneDistrictAt,
    reveal: Object.freeze({ create: createLevelOneRevealState, at: revealLevelOneAt, snapshot: getLevelOneRevealSnapshot }),
    selectEntry: selectLevelEntry,
    briefing: null,
    gameplay: null,
    pointOfInterestPlacements: null,
    audit: null,
  });
}

// A session payload may use an unofficial world only when it is explicitly
// unranked Free. Anything else is refused before a session exists.
export function sessionAllowedForWorld(context, payload) {
  if (context?.official === true) return true;
  return payload?.mode === 'free' && payload?.session?.rankedEligible === false;
}

export async function resolveHmhWorldContext({ params, loadTenArea = () => import('./world-v2-runtime-context.mjs') } = {}) {
  const selection = resolveHmhWorldSelection({ params });
  if (selection.legacy) return createLegacyWorldContext(selection);
  const module = await loadTenArea();
  const context = module.createWorldV2RuntimeContext({ selection });
  if (context.official !== false || context.rankedEligible !== false || context.world?.id !== TEN_AREA_WORLD_ID) throw new TypeError('ten-area world context must be unofficial and unranked');
  return context;
}
