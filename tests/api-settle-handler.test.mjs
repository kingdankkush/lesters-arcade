import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import { RANKED_GAME_IDS, RANKED_GAMES, RANKED_SESSION_HANDLE_PATTERN, rankedEnvelopeHash, validateRankedIdentity } from '../apps/portal/src/ranked-identity.mjs';
import { deriveRankedSeed } from '../apps/portal/src/session-seed.mjs';
import * as achievements from '../apps/portal/src/achievements/index.mjs';
import * as verify from '../server/verify/index.mjs';
import { HMH_FREE_HEROES, HMH_HERO_GATES } from '../server/verify/hmh.mjs';
import { issueSeedTicket } from '../server/verify/seed-ticket.mjs';
import { loadAchievementRegistry, loadHeroGates, loadVerifyModule } from '../server/settle/settle-core.mjs';
import { BUILD_HASH_PATTERNS, loadIssueSeedTicket, SESSION_HANDLE_PATTERN, validateSeedBody } from '../server/settle/seed.mjs';
import * as settleApi from '../api/settle.mjs';
import * as seedApi from '../api/ranked-seed.mjs';
import * as retryApi from '../api/cron/settle-retry.mjs';
import { invoke } from './helpers/fake-http.mjs';
import {
  buildSettleBody, createCatalogDouble, createVerifyDouble, HERO_GATES_DOUBLE, REAL_SETTLEMENT_GAS_RESERVE_WEI, SETTLE_CRON_VALUE, SETTLE_SESSION_VALUE,
} from './helpers/settle-fixtures.mjs';
import { createSettleHarness, QUICK_EVIDENCE } from './helpers/settle-handler-harness.mjs';
import {
  FIXTURE_BUILD_HASHES, FIXTURE_REGISTRY, FIXTURE_UUID, FIXTURE_VERIFY_AT_MS, FIXTURE_WALLET, fixtureVerifyOptions, readFixture,
} from './fixtures/ranked/build-fixtures.mjs';

/**
 * Contract §10.4 rule 6, the settle-wiring proof: the REAL handlers end to
 * end (tests/helpers/settle-handler-harness.mjs mounts them exactly as
 * production does, with the real verify, achievements and seed-ticket
 * modules, an unmigrated PGlite and the in-process chain). Second runs on the
 * stored history, the rejections and the retry cron are in
 * tests/api-settle-handler-lifecycle.test.mjs, so each file stays well inside
 * the 60 s budget (§11 rule 1). Every test here plays and settles its own
 * runs; none reads another test's results.
 */

const h = createSettleHarness({ ip: '203.0.113.41' });
before(() => h.start());
after(() => h.close());

const plain = (value) => JSON.parse(JSON.stringify(value));

test('the real handler seam loads the real verify, achievements and seed-ticket modules', async () => {
  const deps = await settleApi.buildDeps(h.env, { db: h.db, provider: h.local.chain.provider, deployment: h.local.deployment, nowMs: h.nowMs });
  for (const name of ['bindRankedIdentity', 'verifyRankedRun', 'computeEvidenceDigest', 'reverifyStoredRun']) assert.equal(deps.verify[name], verify[name], name);
  for (const name of ['deriveEarnedAchievements', 'historyFieldsFor', 'nftAchievementIds', 'achievementById', 'catalogFor']) assert.equal(deps.catalog[name], achievements[name], name);
  const heroes = await deps.heroGates();
  assert.equal(heroes.gates, HMH_HERO_GATES);
  assert.equal(heroes.free, HMH_FREE_HEROES);
  const seedDeps = await seedApi.buildDeps(h.env, { db: h.db, deployment: h.local.deployment, nowMs: h.nowMs });
  assert.equal(seedDeps.issueSeedTicket, issueSeedTicket);
  assert.equal(deps.config.settlementReady, true, JSON.stringify(deps.config));
  // The fee cap uses the deployment's own 0.002 zkLTC reserve, not a test override.
  assert.equal(deps.deployment.settlementGasReserveWei, h.local.record.settlementGasReserveWei);
  assert.equal(h.local.record.settlementGasReserveWei, REAL_SETTLEMENT_GAS_RESERVE_WEI);
  // The database is still unmigrated: the first request must migrate it (A34).
  const tables = await h.db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'verified_sessions'");
  assert.equal(tables[0].n, 0);
});

test('real handler settles a Chikun, a STACKED and an HMH run end to end on the local chain', async () => {
  const player = h.local.chain.wallets.player1;
  const chikun = await h.settleAndAssert('chikun', { wallet: player, claimScore: 999_999_999 });
  assert.notEqual(chikun.view.score, 999_999_999, 'a tampered claim score is ignored (A9)');
  await h.settleAndAssert('stacked', { wallet: player });
  await h.settleAndAssert('lester-blaster', { wallet: player });
});

test('a flagged HMH run confirms, stores its soft flags, and neither E4 view exposes them or the claim', async () => {
  const wallet = h.local.chain.wallets.player1;
  // The level-90 plan passes the reboot validator with soft flags only.
  const { expected, row, view, publicView } = await h.settleAndAssert('lester-blaster', { wallet, evidence: { plan: 'level-90' }, claimScore: 1 });
  assert.equal(expected.plausibility.verdict, 'flagged');
  assert.ok(expected.plausibility.flags.length > 0 && expected.plausibility.flags.every((flag) => flag.severity === 'flag'), JSON.stringify(expected.plausibility));
  assert.deepEqual(JSON.parse(row.plausibility), plain(expected.plausibility), 'the verdict and its flags are stored for review');
  assert.deepEqual(JSON.parse(row.client_claim), { score: 1 });
  const keysOf = (value) => (value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]) : []);
  for (const [name, shown] of [['owner', view], ['public', publicView]]) {
    assert.deepEqual(keysOf(shown).filter((key) => /plausib|claim|flag|verdict/i.test(key)), [], `no review field in the ${name} view`);
    const text = JSON.stringify(shown);
    for (const flag of expected.plausibility.flags) assert.equal(text.includes(flag.id), false, `${flag.id} is not in the ${name} view`);
  }
});

test('a duplicate settle returns the same confirmed state without a second transaction', async () => {
  const player = h.local.chain.wallets.player1;
  const { body, view } = await h.settleAndAssert('chikun', { wallet: player, evidence: QUICK_EVIDENCE.chikun });
  const before = await h.snapshotSideEffects();
  const again = await h.postSettle(body, await h.authHeaders(player));
  assert.equal(again.status, 200);
  assert.deepEqual(again.body, view, 'the same owner view');
  const retry = await h.postSettle({ v: body.v, sessionId32: body.sessionId32, retry: true }, await h.authHeaders(player));
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body, view, 'a retry body sees the same state');
  assert.deepEqual(await h.snapshotSideEffects(), before, 'no new row and no second transaction');
  // The same session with other evidence is a conflict, never a second record.
  const conflicting = structuredClone(body);
  conflicting.evidence.flap.flapDeltas = conflicting.evidence.flap.flapDeltas.slice(0, -1);
  const conflict = await h.postSettle(conflicting, await h.authHeaders(player));
  assert.deepEqual([conflict.status, conflict.body.error], [409, 'session-conflict']);
  assert.deepEqual(await h.snapshotSideEffects(), before);
});

test('a verify, achievements, hero-gate or seed-ticket module that cannot load is logged by code and fails closed at request time', async (t) => {
  const errors = t.mock.method(console, 'error', () => {});
  const missing = (file) => () => Promise.reject(Object.assign(new Error(`Cannot find module '/var/task/${file}'`), { code: 'ERR_MODULE_NOT_FOUND' }));
  const broken = () => Promise.reject(new SyntaxError('Unexpected token in /var/task/apps/portal/src/achievements/stats.mjs'));
  assert.equal(await loadVerifyModule(missing('server/verify/seed-ticket.mjs')), null);
  assert.equal(await loadAchievementRegistry(missing('apps/portal/src/achievements/index.mjs')), null);
  assert.equal(await loadHeroGates(missing('apps/portal/src/achievements/stats.mjs')), null);
  assert.equal(await loadIssueSeedTicket(missing('server/verify/seed-ticket.mjs')), null);
  assert.equal(await loadVerifyModule(broken), null);
  assert.deepEqual(errors.mock.calls.map((call) => call.arguments), [
    ['[settle:import:verify]', 'Error', 'ERR_MODULE_NOT_FOUND'],
    ['[settle:import:achievements]', 'Error', 'ERR_MODULE_NOT_FOUND'],
    ['[settle:import:hmh]', 'Error', 'ERR_MODULE_NOT_FOUND'],
    ['[settle:import:seed-ticket]', 'Error', 'ERR_MODULE_NOT_FOUND'],
    ['[settle:import:verify]', 'SyntaxError', 'none'],
  ], 'every failed import is logged, by label, error name and code only (never the message or path)');

  // What buildDeps hands E3, E15 and E13 when the verify module cannot load.
  const withoutVerify = (api, { provider = true } = {}) => api.createHandler(async () => {
    const overrides = { db: h.db, deployment: h.local.deployment, nowMs: h.nowMs };
    if (provider) overrides.provider = h.local.chain.provider;
    const deps = await api.buildDeps(h.env, overrides);
    deps.verify = await loadVerifyModule(missing('server/verify/index.mjs'));
    return deps;
  });
  const player = h.local.chain.wallets.player1;
  const settled = await invoke(withoutVerify(settleApi), { method: 'POST', url: '/api/settle', headers: await h.authHeaders(player), body: {} });
  const seeded = await invoke(withoutVerify(seedApi, { provider: false }), { method: 'POST', url: '/api/ranked-seed', headers: await h.authHeaders(player), body: {} });
  const cron = await invoke(withoutVerify(retryApi), { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
  for (const [name, response] of [['E3', settled], ['E15', seeded], ['E13', cron]]) {
    assert.deepEqual([response.status, response.body.error, response.body.detail], [503, 'settlement-not-configured', 'verify-unavailable'], name);
  }
});

test('E15 checks the session handle, season and build hash with the verifier\'s own rules', () => {
  // The same objects, not copies (review: a drifted copy would issue tickets
  // for sessions E3 refuses after payment).
  assert.equal(SESSION_HANDLE_PATTERN, RANKED_SESSION_HANDLE_PATTERN);
  assert.deepEqual(Object.keys(BUILD_HASH_PATTERNS), [...RANKED_GAME_IDS]);
  for (const gameId of RANKED_GAME_IDS) assert.equal(BUILD_HASH_PATTERNS[gameId], RANKED_GAMES[gameId].buildHashPattern, gameId);
  // And the same verdicts: E15 accepts exactly the combinations whose
  // identity passes the verifier's format checks.
  const sessionIds = [`game-session-${FIXTURE_UUID}`, 'game-session-000000001', 'game-session-AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE', `game-session-${FIXTURE_UUID.replace('-4111-', '-9111-')}`];
  const seasonIds = [...RANKED_GAME_IDS.map((gameId) => RANKED_GAMES[gameId].seasonId), 'chikun-season-preview-2'];
  const buildHashes = [...Object.values(FIXTURE_BUILD_HASHES), 'site-1.7:game-1.7.0', 'site-1.7.0:game-1.7.0:cabinet-0.9'];
  let accepted = 0;
  for (const gameId of RANKED_GAME_IDS) {
    for (const sessionId of sessionIds) {
      for (const seasonId of seasonIds) {
        for (const buildHash of buildHashes) {
          const identity = { sessionId, chainId: 4441, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, gameId, seasonId, buildHash, seed: 7, nonce: sessionId.slice('game-session-'.length) };
          const e3 = validateRankedIdentity(identity, { chainId: 4441, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, gameId });
          assert.equal(validateSeedBody({ gameId, sessionId, seasonId, buildHash }), e3.ok, `${gameId} ${sessionId} ${seasonId} ${buildHash}: ${e3.error ?? 'ok'}`);
          if (e3.ok) accepted += 1;
        }
      }
    }
  }
  // Both cabinet build hashes fit Chikun and STACKED; one fits HMH.
  assert.equal(accepted, 5);
});

// --- The settle test double against the real verify functions (DoD 2) --------
//
// tests/server-settle-core, -relayer and -retry keep one double
// (tests/helpers/settle-fixtures.mjs), whose toy replay lets a test choose a
// run's score and length. Its seed tickets, binding, evidence digests, error
// shapes and envelope hash are the real functions; these tests pin that, on
// valid and on malformed input.

const flipHex = (hex) => `${hex.slice(0, -1)}${hex.at(-1) === '0' ? '1' : '0'}`;
// §5.2, in the contract's order (as tests/server-verify-identity.test.mjs),
// for a body of `gameId`.
const bindingChecks = (gameId) => [
  ['identity-invalid', (body) => { body.identity.version = 'lesters-canonical-session-v1'; }],
  ['identity-game-unknown', (body) => { body.identity.gameId = 'pong'; }],
  ['identity-invalid', (body) => { body.gameId = gameId === 'chikun' ? 'stacked' : 'chikun'; }],
  ['identity-chain-mismatch', (body) => { body.identity.chainId = 31337; }],
  ['identity-registry-mismatch', (body) => { body.identity.scoreRegistryAddress = `0x${'5'.repeat(40)}`; }],
  ['identity-wallet-mismatch', (body) => { body.identity.wallet = `0x${'3c'.repeat(20)}`; }],
  ['identity-season-mismatch', (body) => { body.identity.seasonId = RANKED_GAMES[gameId === 'chikun' ? 'stacked' : 'chikun'].seasonId; }],
  ['identity-buildhash-invalid', (body) => { body.identity.buildHash = gameId === 'lester-blaster' ? FIXTURE_BUILD_HASHES.chikun : FIXTURE_BUILD_HASHES['lester-blaster']; }],
  ['identity-session-invalid', (body) => { body.identity.sessionId = 'game-session-000000001'; }],
  ['identity-nonce-mismatch', (body) => { body.identity.nonce = '22222222-2222-4222-8222-222222222222'; }],
  ['seed-ticket-invalid', (body) => { body.seedTicket.mac = flipHex(body.seedTicket.mac); }],
  ['seed-ticket-invalid', (body) => { body.seedTicket.extra = 1; }],
  ['seed-ticket-invalid', (body) => { body.seedTicket.issuedAt = -1; }],
  ['identity-seed-mismatch', (body) => { body.identity.seed = (body.identity.seed ^ 1) >>> 0; }],
  ['session-key-mismatch', (body) => { body.sessionId32 = `0x${'9'.repeat(64)}`; }],
];

// Malformed evidence per game: the real computeEvidenceDigest's failures.
const MALFORMED_EVIDENCE = Object.freeze({
  chikun: (evidence) => [
    { encoding: evidence.encoding },
    { ...evidence, flap: [1, 2] },
    { ...evidence, encoding: RANKED_GAMES.stacked.evidenceEncoding },
  ],
  stacked: (evidence) => [
    { ...evidence, sic1: `${evidence.sic1.slice(0, -2)}!!` },
    { ...evidence, sic1: Buffer.alloc(21, 0x5a).toString('base64') },
    { ...evidence, sic1: Buffer.alloc(40, 0x5a).toString('base64') },
    { ...evidence, startLevel: 2 },
    { ...evidence, extra: 1 },
  ],
  'lester-blaster': (evidence) => [
    { encoding: evidence.encoding, runSummary: evidence.runSummary },
    { encoding: evidence.encoding, sessionEnvelope: evidence.sessionEnvelope },
  ],
});

test('the settle fixtures issue real seed tickets, and their toy bodies bind and digest under the real verifier', async () => {
  const nowMs = FIXTURE_VERIFY_AT_MS;
  const options = { chainId: 4441, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, nowMs, seedSecret: SETTLE_SESSION_VALUE };
  const double = createVerifyDouble({ nowMs });
  for (const gameId of RANKED_GAME_IDS) {
    // eslint-disable-next-line no-await-in-loop
    const body = await buildSettleBody({ gameId, wallet: FIXTURE_WALLET, registry: FIXTURE_REGISTRY, nowMs });
    const { sessionId, seasonId, buildHash, seed } = body.identity;
    // eslint-disable-next-line no-await-in-loop
    assert.equal(seed, await deriveRankedSeed({ sessionId, wallet: FIXTURE_WALLET, gameId, seasonId, buildHash, salt: body.seedTicket.salt }), `${gameId} ticket seed`);
    // eslint-disable-next-line no-await-in-loop
    const bound = await verify.bindRankedIdentity(body, options);
    assert.equal(bound.ok, true, `${gameId}: ${JSON.stringify(bound)}`);
    assert.equal(bound.identity.sessionKey, body.sessionId32);
    // eslint-disable-next-line no-await-in-loop
    const digest = await verify.computeEvidenceDigest(body);
    assert.equal(digest.ok, true, `${gameId} toy evidence decodes: ${JSON.stringify(digest)}`);
    // eslint-disable-next-line no-await-in-loop
    const run = await double.verifyRankedRun(body, options);
    assert.equal(run.ok, true, JSON.stringify(run));
    assert.deepEqual(plain(run.evidence), { encoding: digest.encoding, text: digest.text, bytes: digest.bytes, digest: digest.digest });
    // eslint-disable-next-line no-await-in-loop
    assert.equal(run.envelopeHash, await rankedEnvelopeHash({ gameId, sessionId32: body.sessionId32, encoding: digest.encoding, evidenceDigest: digest.digest }));
  }
});

test('the verify double binds, digests and fails like the real verifier, and shapes the VerifiedRun the same way', async () => {
  const options = fixtureVerifyOptions();
  const double = createVerifyDouble({ nowMs: () => FIXTURE_VERIFY_AT_MS });
  for (const name of ['chikun-valid', 'stacked-valid', 'hmh-valid']) {
    const fixture = readFixture(name);
    const { body } = fixture;
    // §5.2: the same canonical identity, and every error code in the same order.
    const bound = await verify.bindRankedIdentity(body, options);
    assert.equal(bound.ok, true);
    assert.deepEqual(plain(await double.bindRankedIdentity(body, options)), plain(bound), `${name} binding`);
    const checks = bindingChecks(body.gameId);
    for (const [index, [error, mutate]] of checks.entries()) {
      const one = structuredClone(body);
      mutate(one);
      const all = structuredClone(body);
      for (const [, later] of checks.slice(index)) later(all);
      for (const mutated of [one, all]) {
        // eslint-disable-next-line no-await-in-loop
        const real = await verify.bindRankedIdentity(mutated, options);
        assert.deepEqual(plain(real), { ok: false, status: 400, error }, `${name}: real ${error}`);
        // eslint-disable-next-line no-await-in-loop
        assert.deepEqual(plain(await double.bindRankedIdentity(mutated, options)), plain(real), `${name}: double ${error}`);
      }
    }
    // §2.6: the stored evidence text, bytes and digest, without replay, and
    // the same failure for evidence that does not decode.
    const digest = await verify.computeEvidenceDigest(body);
    assert.deepEqual(plain(await double.computeEvidenceDigest(body)), plain(digest), `${name} digest`);
    assert.equal(digest.digest, fixture.expected.evidenceDigest);
    for (const evidence of MALFORMED_EVIDENCE[body.gameId](body.evidence)) {
      const bad = { ...body, evidence };
      // eslint-disable-next-line no-await-in-loop
      const real = await verify.computeEvidenceDigest(bad);
      assert.equal(real.ok, false, `${name}: ${JSON.stringify(evidence).slice(0, 80)}`);
      assert.equal(real.status, 400);
      // eslint-disable-next-line no-await-in-loop
      assert.deepEqual(plain(await double.computeEvidenceDigest(bad)), plain(real), `${name}: double digest failure ${real.error}`);
      if (body.gameId === 'stacked') {
        // The STACKED verifier decodes first, so the replay fails the same way.
        // eslint-disable-next-line no-await-in-loop
        assert.deepEqual(plain(await double.verifyRankedRun(bad, options)), plain(await verify.verifyRankedRun(bad, options)), `${name}: verify failure ${real.error}`);
      }
    }

    // §5.3: the same VerifiedRun shape; the binding fields, the evidence and
    // the v2 envelope hash are equal (score, contract and stats are the toy's).
    const real = await verify.verifyRankedRun(body, options);
    const toy = await double.verifyRankedRun(body, options);
    assert.equal(real.ok, true);
    assert.equal(toy.ok, true, JSON.stringify(toy));
    assert.deepEqual(Object.keys(toy), Object.keys(real), `${name} VerifiedRun keys`);
    assert.deepEqual(Object.keys(toy.contract), Object.keys(real.contract));
    assert.deepEqual(Object.keys(toy.evidence), Object.keys(real.evidence));
    assert.equal(Object.isFrozen(toy) && Object.isFrozen(toy.contract) && Object.isFrozen(toy.stats) && Object.isFrozen(toy.evidence), true);
    for (const key of ['ok', 'gameId', 'sessionId32', 'sessionHandle', 'wallet', 'seasonId', 'runtimeId', 'buildHash', 'seed', 'envelopeHash', 'verifiedAt']) {
      assert.deepEqual(toy[key], real[key], `${name} ${key}`);
    }
    assert.deepEqual(plain(toy.evidence), plain(real.evidence));
    assert.deepEqual(plain(toy.identity), plain(real.identity));
    const envelopeHash = await rankedEnvelopeHash({ gameId: body.gameId, sessionId32: body.sessionId32, encoding: digest.encoding, evidenceDigest: digest.digest });
    assert.deepEqual([toy.envelopeHash, real.envelopeHash, fixture.expected.envelopeHash], [envelopeHash, envelopeHash, envelopeHash], `${name} v2 envelope hash`);
    assert.equal(typeof toy.score, typeof real.score);
    for (const key of Object.keys(toy.contract)) assert.equal(typeof toy.contract[key], typeof real.contract[key], `${name} contract.${key}`);
    const realKeys = Object.keys(real.stats);
    if (body.gameId === 'lester-blaster') {
      // The toy HMH stats are a subset of the real keys, in the real order.
      const positions = Object.keys(toy.stats).map((key) => realKeys.indexOf(key));
      assert.equal(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), true, `${name} toy stats keys`);
      assert.deepEqual(Object.keys(toy.plausibility).sort(), Object.keys(real.plausibility).sort());
      assert.equal(toy.plausibility.verdict, real.plausibility.verdict);
    } else {
      assert.deepEqual(Object.keys(toy.stats), realKeys, `${name} stats keys`);
      assert.deepEqual([toy.plausibility, real.plausibility], [null, null]);
    }

    // The re-sign rule's reverifyStoredRun on the stored evidence, and on a
    // stored identity whose session key does not match.
    const stored = { gameId: body.gameId, identity: plain(real.identity), evidence: { encoding: real.evidence.encoding, text: real.evidence.text } };
    const again = await verify.reverifyStoredRun(stored, { nowMs: FIXTURE_VERIFY_AT_MS });
    const toyAgain = await double.reverifyStoredRun(stored, { nowMs: FIXTURE_VERIFY_AT_MS });
    assert.deepEqual(Object.keys(toyAgain), Object.keys(again));
    for (const key of ['sessionId32', 'envelopeHash', 'verifiedAt']) assert.equal(toyAgain[key], again[key], `${name} re-verified ${key}`);
    assert.deepEqual(plain(toyAgain.evidence), plain(again.evidence));
    assert.deepEqual([again.score, again.envelopeHash], [real.score, real.envelopeHash]);
    for (const tampered of [
      { ...stored, identity: { ...stored.identity, sessionKey: `0x${'9'.repeat(64)}` } },
      { ...stored, gameId: 'pong' },
      { ...stored, evidence: { ...stored.evidence, encoding: 'text/plain' } },
    ]) {
      // eslint-disable-next-line no-await-in-loop
      assert.deepEqual(plain(await double.reverifyStoredRun(tampered, { nowMs: FIXTURE_VERIFY_AT_MS })), plain(await verify.reverifyStoredRun(tampered, { nowMs: FIXTURE_VERIFY_AT_MS })), `${name} stored-run failure`);
    }
  }
});

test('the achievements and hero-gate doubles expose the real registry API and gates', () => {
  const catalog = createCatalogDouble();
  for (const [name, value] of Object.entries(catalog)) {
    if (name === 'calls') continue;
    assert.equal(Object.hasOwn(achievements, name), true, `the real registry exports ${name}`);
    assert.equal(typeof value, typeof achievements[name], name);
  }
  assert.deepEqual([...catalog.ACHIEVEMENT_GAME_IDS], [...achievements.ACHIEVEMENT_GAME_IDS]);
  assert.equal(catalog.achievementId32(ethers, 'first-blood'), achievements.achievementId32(ethers, 'first-blood'));
  for (const gameId of achievements.ACHIEVEMENT_GAME_IDS) {
    const fields = achievements.historyFieldsFor(gameId);
    assert.deepEqual(Object.keys(fields).sort(), Object.keys(catalog.historyFieldsFor(gameId)).sort());
    assert.equal(Array.isArray(fields.sum) && Array.isArray(fields.max), true);
  }
  assert.deepEqual(plain(HERO_GATES_DOUBLE), plain({ gates: HMH_HERO_GATES, free: HMH_FREE_HEROES }));
});
