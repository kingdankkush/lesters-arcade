// Server-only map/rules dispatch for an already bound canonical HMH identity.
// A cached schema-6 child under a newer portal still means the legacy v6 map.
// No future map is registered here; visual flags and claimed map labels have
// no authority. Keep old catalogues and validators unchanged indefinitely.
import { RANKED_GAMES } from '../../apps/portal/src/ranked-identity.mjs';
import { isHmhV7Build } from '../../sdk/hmh-run-contract-v7.mjs';
import { validateV6RunPlausibility, validateV7RunPlausibility } from './hmh-plausibility.mjs';

const legacy = (schemaVersion, validatePlausibility) => Object.freeze({
  mapId: 'forked-frontier', mapVersion: 1, schemaVersion, validatePlausibility,
});
const V6 = legacy(6, validateV6RunPlausibility);
const V7 = legacy(7, validateV7RunPlausibility);

export function resolveHmhMapContext({ identity, schemaVersion } = {}) {
  if (identity?.gameId !== 'lester-blaster' || typeof identity.buildHash !== 'string'
    || !RANKED_GAMES['lester-blaster'].buildHashPattern.test(identity.buildHash)) return null;
  // Do not impose a new version parser/minimum on schema 6: its accepted build
  // shape is the existing canonical identity pattern, including cached children.
  if (schemaVersion === 6) return V6;
  if (schemaVersion === 7 && isHmhV7Build(identity.buildHash)) return V7;
  return null;
}
