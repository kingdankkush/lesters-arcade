// HMH cabinet version (version-column brief, acceptance 1): new HMH build
// hashes read site-X:game-Y:cabinet-<HMH_CABINET_VERSION>, the browser
// (RANKED_GAMES) and the server (bindRankedIdentity, E15) accept the optional
// cabinet segment so 1.8.x runs without it stay valid, and the module stays
// out of the HMH child (it is portal-only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_CABINET_VERSION } from '../apps/portal/src/hmh-cabinet-version.mjs';
import { ARCADE_GAMES, getPlaySessionIdentity, startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { CHIKUN_CABINET_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { STACKED_CABINET_VERSION } from '../apps/portal/src/stacked-cabinet.mjs';
import { GAME_VERSION, SITE_VERSION } from '../apps/portal/src/version-tracking.mjs';
import { RANKED_GAMES, rankedIdentityFor, validateRankedIdentity } from '../apps/portal/src/ranked-identity.mjs';
import { versionLabelFor } from '../apps/portal/src/game-version-labels.mjs';
import { bindRankedIdentity, verifyRankedRun } from '../server/verify/index.mjs';
import { validateSeedBody } from '../server/settle/seed.mjs';
import { FIXTURE_BUILD_HASHES, FIXTURE_REGISTRY, FIXTURE_WALLET, buildFixtureBody, fixtureVerifyOptions } from './fixtures/ranked/build-fixtures.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LEGACY_HMH_BUILD = 'site-1.8.1:game-1.8.1';
const CABINET_HMH_BUILD = `site-${SITE_VERSION}:game-${GAME_VERSION}:cabinet-${HMH_CABINET_VERSION}`;
const SALT = '0123456789abcdef0123456789abcdef';
const UUID = '11111111-1111-4111-8111-111111111111';

test('the HMH cabinet version is a one-line portal module', () => {
  const source = readFileSync(new URL('../apps/portal/src/hmh-cabinet-version.mjs', import.meta.url), 'utf8');
  assert.equal(source.trim().split('\n').length, 1, 'one line');
  assert.equal(/\bimport\b/.test(source), false, 'no imports');
  assert.match(HMH_CABINET_VERSION, /^\d+\.\d+\.\d+$/);
  const [major, minor] = HMH_CABINET_VERSION.split('.').map(Number);
  assert.equal(versionLabelFor('lester-blaster', { buildHash: CABINET_HMH_BUILD }), `HMH v${major}.${minor}`);
});

test('new HMH sessions carry the cabinet segment; Chikun and STACKED are unchanged', () => {
  const hmh = ARCADE_GAMES.find((game) => game.id === 'lester-blaster');
  assert.equal(hmh.cabinetVersion, HMH_CABINET_VERSION);
  assert.equal(getPlaySessionIdentity('lester-blaster').buildHash, CABINET_HMH_BUILD);
  assert.equal(getPlaySessionIdentity('chikun').buildHash, `site-${SITE_VERSION}:game-${GAME_VERSION}:cabinet-${CHIKUN_CABINET_VERSION}`);
  assert.equal(getPlaySessionIdentity('stacked').buildHash, `site-${SITE_VERSION}:game-${GAME_VERSION}:cabinet-${STACKED_CABINET_VERSION}`);
  const session = startPlaySession({ wallet: FIXTURE_WALLET, gameId: 'lester-blaster', mode: 'paid', sessionNonce: UUID });
  assert.equal(session.buildHash, CABINET_HMH_BUILD);
  assert.equal(session.canonicalContext.buildHash, CABINET_HMH_BUILD);
  for (const gameId of ['lester-blaster', 'chikun', 'stacked']) {
    assert.equal(RANKED_GAMES[gameId].buildHashPattern.test(getPlaySessionIdentity(gameId).buildHash), true, gameId);
  }
});

test('the browser identity check accepts HMH builds with and without the cabinet segment', () => {
  const session = startPlaySession({ wallet: FIXTURE_WALLET, gameId: 'lester-blaster', mode: 'paid', sessionNonce: UUID });
  const identity = rankedIdentityFor(session, { scoreRegistryAddress: FIXTURE_REGISTRY });
  const check = (buildHash) => validateRankedIdentity({ ...identity, buildHash }, { scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, gameId: 'lester-blaster' });
  assert.equal(check(CABINET_HMH_BUILD).ok, true);
  assert.equal(check(LEGACY_HMH_BUILD).ok, true, '1.8.x runs saved before the deploy stay valid');
  assert.equal(check('site-1.9.0:game-1.9.0:cabinet-0.6.0').ok, true, 'a later cabinet bump needs no pattern change');
  for (const bad of ['site-1.8.1:game-1.8.1:cabinet-0.5', `${CABINET_HMH_BUILD}:cabinet-0.6.0`, `${LEGACY_HMH_BUILD}:`, 'site-1.8.1:game-1.8.1:stacked-0.2.0']) {
    assert.deepEqual(check(bad), { ok: false, error: 'identity-buildhash-invalid' }, bad);
  }
});

test('E15 issues seed tickets for HMH builds with and without the cabinet segment', () => {
  const body = (buildHash) => ({ gameId: 'lester-blaster', sessionId: `game-session-${UUID}`, seasonId: RANKED_GAMES['lester-blaster'].seasonId, buildHash });
  assert.equal(validateSeedBody(body(CABINET_HMH_BUILD)), true);
  assert.equal(validateSeedBody(body(LEGACY_HMH_BUILD)), true);
  assert.equal(validateSeedBody(body('site-1.8.1:game-1.8.1:cabinet-0.5')), false);
  assert.equal(validateSeedBody({ ...body(CABINET_HMH_BUILD), gameId: 'chikun', seasonId: RANKED_GAMES.chikun.seasonId, buildHash: LEGACY_HMH_BUILD }), false, 'Chikun still requires its cabinet');
});

test('the server binds and verifies HMH runs with and without the cabinet segment', async () => {
  for (const [buildHash, label] of [[CABINET_HMH_BUILD, versionLabelFor('lester-blaster', { buildHash: CABINET_HMH_BUILD })], [FIXTURE_BUILD_HASHES['lester-blaster'], 'HMH v0.5'], [LEGACY_HMH_BUILD, 'HMH v0.5'], ['site-1.9.0:game-1.9.0:cabinet-0.6.0', 'HMH v0.6']]) {
    const { body, sessionId32 } = await buildFixtureBody({ gameId: 'lester-blaster', salt: SALT, buildHash });
    const bound = await bindRankedIdentity(body, fixtureVerifyOptions());
    assert.equal(bound.ok, true, `${buildHash}: ${JSON.stringify(bound)}`);
    assert.equal(bound.identity.buildHash, buildHash);
    const run = await verifyRankedRun(body, fixtureVerifyOptions());
    assert.equal(run.ok, true, `${buildHash}: ${JSON.stringify(run)}`);
    assert.equal(run.sessionId32, sessionId32);
    assert.equal(run.buildHash, buildHash, 'the verified run (and so verified_sessions.build_hash) keeps the build');
    assert.equal(versionLabelFor(run.gameId, run), label);
  }
  const { body } = await buildFixtureBody({ gameId: 'lester-blaster', salt: SALT, buildHash: 'site-1.8.1:game-1.8.1:cabinet-0.5' });
  assert.deepEqual(await bindRankedIdentity(body, fixtureVerifyOptions()), { ok: false, status: 400, error: 'identity-buildhash-invalid' });
});

// Static and dynamic relative imports reachable from the entries.
function importGraph(entries) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const specifier = match[1] ?? match[2];
      if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier));
    }
  };
  entries.forEach(visit);
  return [...seen].map((file) => relative(ROOT, file).replaceAll('\\', '/'));
}

test('the cabinet version and the labels stay out of the HMH child', () => {
  const graph = importGraph(['apps/hmh-reboot/src/main.mjs', 'apps/hmh-reboot/src/world-production-art.mjs'].map((file) => resolve(ROOT, file)));
  assert.ok(graph.length > 20, 'the HMH child graph was walked');
  for (const portalOnly of ['apps/portal/src/hmh-cabinet-version.mjs', 'apps/portal/src/game-version-labels.mjs', 'apps/portal/src/arcade-core.mjs']) {
    assert.equal(graph.includes(portalOnly), false, portalOnly);
  }
});
