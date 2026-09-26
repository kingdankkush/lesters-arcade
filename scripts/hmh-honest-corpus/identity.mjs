// The Ranked identity this checkout's portal would give a real HMH session:
// the build hash arcade-core.mjs sends (site-<SITE_VERSION>:game-<GAME_VERSION>
// :cabinet-<HMH_CABINET_VERSION>), the current season, and the public fixture
// wallet, registry and seed secret of tests/fixtures/ranked/build-fixtures.mjs.
// Nothing here is a production secret; the seed tickets the plan issues verify
// only against that public fixture secret.
import { GAME_VERSION, SITE_VERSION } from '../../apps/portal/src/version-tracking.mjs';
import { HMH_CABINET_VERSION } from '../../apps/portal/src/hmh-cabinet-version.mjs';
import { RANKED_GAMES } from '../../apps/portal/src/ranked-identity.mjs';

export { FIXTURE_CHAIN_ID, FIXTURE_ISSUED_AT, FIXTURE_REGISTRY, FIXTURE_SEED_SECRET, FIXTURE_WALLET } from '../../tests/fixtures/ranked/build-fixtures.mjs';
export const GAME_ID = 'lester-blaster';
export const HARNESS_BUILD_HASH = `site-${SITE_VERSION}:game-${GAME_VERSION}:cabinet-${HMH_CABINET_VERSION}`;
export const HARNESS_RELEASE = GAME_VERSION;
export const HARNESS_CABINET = HMH_CABINET_VERSION;
export const SEASON_ID = RANKED_GAMES[GAME_ID].seasonId;
