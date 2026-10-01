// W4a: one place that decides which world main.mjs runs.
//
// Before game 2.1.0 (the 2.0.x child): LEVEL_ONE_WORLD (forked-frontier v1)
// is the default for everything. The ten-area world is selected only when the
// page URL carries exactly one `world=ten-area` and explicitly `mode=free`;
// every other combination, including any Ranked hint, resolves to the legacy
// world. That selection is unofficial: it records no run summary, and the
// session payload is re-checked in main.mjs (a Ranked or rankedEligible
// payload is refused).
//
// From game 2.1.0 (docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md): the ten-area
// world is Level 1 for Free and Ranked. It is the default and official
// (schema-8 run summaries, Ranked-eligible). The legacy world stays reachable
// for Free only, by exactly one `world=legacy` with exactly one `mode=free`:
// official (its schema-7 summary feeds the Free result screen) but never
// Ranked-eligible, so a new Ranked session can never run on it. Every other
// combination resolves to the ten-area world.
//
// The legacy branch hands back the legacy modules' own functions unchanged, so
// the legacy runtime path is the same code it was before this seam existed.
// The ten-area branch is a dynamic import: nothing of it is on the initial
// static bundle path.
import { GAME_VERSION } from '../../portal/src/version-tracking.mjs';
import { isHmhV8Build, isHmhV8GameVersion } from '../../../sdk/hmh-run-v8-build.mjs';
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
export const LEGACY_WORLD_VALUE = 'legacy';
export const TEN_AREA_WORLD_ID = 'ten-area-frontier';
// The version gate: this child runs the ten-area world as Level 1.
export const HMH_TEN_AREA_LEVEL_ONE = isHmhV8GameVersion(GAME_VERSION);

const legacySelection = (reason) => Object.freeze({ worldId: LEVEL_ONE_WORLD.id, official: true, rankedEligible: true, legacy: true, reason });
const tenAreaLevelOne = (reason) => Object.freeze({ worldId: TEN_AREA_WORLD_ID, official: true, rankedEligible: true, legacy: false, reason });

export function resolveHmhWorldSelection({ params, tenAreaLevelOne: levelOne = HMH_TEN_AREA_LEVEL_ONE } = {}) {
  const search = params instanceof URLSearchParams ? params : new URLSearchParams(typeof params === 'string' ? params : '');
  const worlds = search.getAll(HMH_WORLD_PARAM);
  if (levelOne) {
    if (worlds.length !== 1 || worlds[0] !== LEGACY_WORLD_VALUE) return tenAreaLevelOne(worlds.length === 0 ? 'default' : worlds.length === 1 && worlds[0] === TEN_AREA_WORLD_VALUE ? 'explicit-ten-area' : 'unknown-world');
    const modes = search.getAll('mode');
    if (modes.length !== 1 || modes[0] !== 'free') return tenAreaLevelOne('explicit-free-mode-required');
    return Object.freeze({ worldId: LEVEL_ONE_WORLD.id, official: true, rankedEligible: false, legacy: true, reason: 'explicit-free-legacy' });
  }
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
    // False only for the 2.1.0 Free-only selection (world=legacy).
    rankedEligible: selection.rankedEligible !== false,
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

// A session payload may use a world that is not Ranked-eligible (the 2.0.x
// unofficial ten-area preview, the 2.1.0 Free-only legacy world) only when it
// is explicitly unranked Free. A Ranked-eligible ten-area Level 1 takes a
// Ranked session only under a 2.1.0+ session build (the schema-8 gate the
// verifier applies), so a mismatched portal is refused before play, never
// after. Anything else is refused before a session exists.
export function sessionAllowedForWorld(context, payload) {
  if (context?.official === true && context.rankedEligible === true) {
    return context.legacy === true || payload?.mode !== 'ranked' || isHmhV8Build(payload?.session?.buildHash);
  }
  return payload?.mode === 'free' && payload?.session?.rankedEligible === false;
}

export async function resolveHmhWorldContext({ params, tenAreaLevelOne: levelOne = HMH_TEN_AREA_LEVEL_ONE, loadTenArea = () => import('./world-v2-runtime-context.mjs') } = {}) {
  const selection = resolveHmhWorldSelection({ params, tenAreaLevelOne: levelOne });
  if (selection.legacy) return createLegacyWorldContext(selection);
  const module = await loadTenArea();
  const context = module.createWorldV2RuntimeContext({ selection });
  if (context.official !== selection.official || context.rankedEligible !== selection.rankedEligible || context.world?.id !== TEN_AREA_WORLD_ID) {
    throw new TypeError(selection.official ? 'ten-area world context must be the official Level 1' : 'ten-area world context must be unofficial and unranked');
  }
  return context;
}
