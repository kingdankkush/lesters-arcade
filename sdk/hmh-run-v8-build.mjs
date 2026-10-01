// The game-version gate of run summary schema 8 and the ten-area Level 1
// (docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md). Tiny on purpose: the child's
// world selection (apps/hmh-reboot/src/world-context.mjs) and the portal's
// mode select read it on their initial path, and the server verifier reads
// it through sdk/hmh-run-contract-v8.mjs. Pure: no DOM, no clock.
//
// A build from game 2.1.0 on runs the ten-area world as Level 1 for Free and
// Ranked and emits schema 8 there; an older build never does. The build hash
// is the session's (site-X.Y.Z:game-X.Y.Z[:cabinet-X.Y.Z], bound to the seed
// ticket), compared numerically, never as text.
export const HMH_RUN_SUMMARY_V8_SCHEMA_VERSION = 8;
export const HMH_RUN_SUMMARY_V8_MIN_GAME_VERSION = '2.1.0';
const SEMVER = /^(\d{1,9})\.(\d{1,9})\.(\d{1,9})$/;
const GAME_VERSION_IN_BUILD = /(?:^|:)game-(\d{1,9}\.\d{1,9}\.\d{1,9})(?=$|:)/;

// True when `version` (X.Y.Z) is at or after `minimum` (X.Y.Z).
export function hmhVersionAtLeast(version, minimum) {
  const have = SEMVER.exec(typeof version === 'string' ? version : '');
  const need = SEMVER.exec(minimum);
  if (!have || !need) return false;
  for (let index = 1; index <= 3; index += 1) if (Number(have[index]) !== Number(need[index])) return Number(have[index]) > Number(need[index]);
  return true;
}

// The child or portal of this game version runs the ten-area Level 1.
export const isHmhV8GameVersion = (version) => hmhVersionAtLeast(version, HMH_RUN_SUMMARY_V8_MIN_GAME_VERSION);

// The session build hash names a game at or after the first schema-8 child.
export function isHmhV8Build(buildHash) {
  const match = typeof buildHash === 'string' ? GAME_VERSION_IN_BUILD.exec(buildHash) : null;
  return Boolean(match) && isHmhV8GameVersion(match[1]);
}
