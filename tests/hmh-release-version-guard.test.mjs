// Release guard (1.9.0 review, M2): the HMH child emits run summary schema 7,
// which the server accepts only from a portal build whose game version is at
// least 1.9.0, and E15 refuses an HMH seed ticket to an older portal build.
// This fails whenever a release ships the schema-7 child without the matching
// SITE_VERSION/GAME_VERSION bump, which would refuse every HMH Ranked run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITE_VERSION, GAME_VERSION } from '../apps/portal/src/version-tracking.mjs';
import { HMH_CABINET_VERSION } from '../apps/portal/src/hmh-cabinet-version.mjs';
import { RUN_SUMMARY_SCHEMA_VERSION } from '../apps/hmh-reboot/src/run-summary-v7.mjs';
import { isHmhV7Build } from '../sdk/hmh-run-contract-v7.mjs';
import { hmhSeedClientOutdated } from '../server/settle/seed.mjs';

const portalBuildHash = `site-${SITE_VERSION}:game-${GAME_VERSION}:cabinet-${HMH_CABINET_VERSION}`;

test('the portal build this release serves can carry the HMH child run summary', () => {
  if (RUN_SUMMARY_SCHEMA_VERSION >= 7) {
    assert.equal(isHmhV7Build(portalBuildHash), true, `${portalBuildHash} must be game 1.9.0 or later while the child emits schema ${RUN_SUMMARY_SCHEMA_VERSION}`);
  }
});

test('E15 issues HMH seed tickets to the portal build this release serves', () => {
  assert.equal(hmhSeedClientOutdated(portalBuildHash), false, `${portalBuildHash} would get 409 client-outdated`);
});
