import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindRankedIdentity, computeEvidenceDigest, reverifyStoredRun, verifyRankedRun } from '../server/verify/index.mjs';
import { ACHIEVEMENT_STATS_PATH, buildVerifiedRun, loadRunStatsMappers } from '../server/verify/verified-run.mjs';
import { deriveSessionSeed } from '../apps/portal/src/session-seed.mjs';
import { rankedSessionKey } from '../apps/portal/src/ranked-identity.mjs';
import { decodeFlapDeltas } from '../apps/portal/src/chikun-cabinet.mjs';
import { decodeSic1, encodeSic1 } from '../apps/portal/src/stacked-sim.mjs';
import { FIXTURE_ISSUED_AT, FIXTURE_VERIFY_AT_MS, fixtureVerifyOptions, readFixture } from './fixtures/ranked/build-fixtures.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const fixture = readFixture('chikun-valid');
const bodyWith = (mutate, source = fixture) => {
  const body = structuredClone(source.body);
  mutate(body);
  return body;
};
const bind = (body, overrides) => bindRankedIdentity(body, fixtureVerifyOptions(overrides));
const OTHER = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
const flipHex = (hex) => `${hex.slice(0, -1)}${hex.at(-1) === '0' ? '1' : '0'}`;

// §5.2, in the contract's order.
const CHECKS = [
  ['identity-invalid', 'object with exactly the 9 keys', (body) => { body.identity.version = 'lesters-canonical-session-v1'; }],
  ['identity-game-unknown', 'gameId ∈ RANKED_GAMES', (body) => { body.identity.gameId = 'pong'; }],
  ['identity-invalid', 'gameId === body.gameId', (body) => { body.gameId = 'stacked'; }],
  ['identity-chain-mismatch', 'chainId === the configured chain', (body) => { body.identity.chainId = 31337; }],
  ['identity-registry-mismatch', 'registry equals config', (body) => { body.identity.scoreRegistryAddress = `0x${'5'.repeat(40)}`; }],
  ['identity-wallet-mismatch', 'wallet equals the token wallet', (body) => { body.identity.wallet = OTHER; }],
  ['identity-season-mismatch', 'seasonId is the game season', (body) => { body.identity.seasonId = 'hmh-season-1-2026'; }],
  ['identity-buildhash-invalid', 'buildHash format (A11)', (body) => { body.identity.buildHash = 'site-1.7.0:game-1.7.0'; }],
  ['identity-session-invalid', 'handle regex (§2.3)', (body) => { body.identity.sessionId = 'game-session-000000001'; }],
  ['identity-nonce-mismatch', 'nonce is the uuid part', (body) => { body.identity.nonce = '22222222-2222-4222-8222-222222222222'; }],
  ['seed-ticket-invalid', 'seed ticket shape, time and MAC', (body) => { body.seedTicket.mac = flipHex(body.seedTicket.mac); }],
  ['identity-seed-mismatch', 'seed is the ticket seed', (body) => { body.identity.seed = (body.identity.seed ^ 1) >>> 0; }],
  ['session-key-mismatch', 'the recomputed session key', (body) => { body.sessionId32 = `0x${'9'.repeat(64)}`; }],
];

for (const [index, [error, label, mutate]] of CHECKS.entries()) {
  test(`§5.2 check ${index + 1}: ${error} (${label})`, async () => {
    assert.deepEqual(await bind(bodyWith(mutate)), { ok: false, status: 400, error });
    // Every later check failing as well does not change the answer: the order is the contract's.
    const all = await bind(bodyWith((body) => { for (const [, , later] of CHECKS.slice(index)) later(body); }));
    assert.deepEqual(all, { ok: false, status: 400, error });
  });
}

test('binding succeeds with the canonical identity and malformed identities are identity-invalid', async () => {
  const bound = await bind(fixture.body);
  assert.equal(bound.ok, true);
  assert.equal(bound.gameId, 'chikun');
  assert.equal(bound.identity.version, 'lesters-canonical-session-v1');
  assert.equal(bound.identity.sessionKey, fixture.body.sessionId32);
  assert.equal(Object.keys(bound.identity).length, 11);
  for (const mutate of [
    (body) => { body.identity = null; },
    (body) => { body.identity = [1]; },
    (body) => { delete body.identity.nonce; },
    (body) => { body.identity.seed = String(body.identity.seed); },
    (body) => { body.identity.seed = -1; },
    (body) => { body.identity.chainId = '4441'; },
    (body) => { body.identity.wallet = 7; },
  ]) {
    assert.equal((await bind(bodyWith(mutate))).error, 'identity-invalid');
  }
  assert.equal((await bind(null)).error, 'identity-invalid');
  // Ticket shape and time also answer seed-ticket-invalid.
  assert.equal((await bind(bodyWith((body) => { delete body.seedTicket; }))).error, 'seed-ticket-invalid');
  assert.equal((await bind(bodyWith((body) => { body.seedTicket.salt = body.seedTicket.salt.toUpperCase(); }))).error, 'seed-ticket-invalid');
  assert.equal((await bind(fixture.body, { nowMs: FIXTURE_ISSUED_AT * 1000 - 61_000 })).error, 'seed-ticket-invalid', 'a ticket issued more than 60 s in the future');
  assert.equal((await bind(fixture.body, { seedSecret: `${fixtureVerifyOptions().seedSecret}-other-environment` })).error, 'seed-ticket-invalid');
});

test('wallet must equal the token wallet', async () => {
  assert.equal((await bind(fixture.body, { wallet: fixture.wallet.toUpperCase().replace('0X', '0x') })).ok, true, 'compared lowercase');
  assert.equal((await bind(fixture.body, { wallet: OTHER })).error, 'identity-wallet-mismatch');
  assert.equal((await bind(fixture.body, { wallet: undefined })).error, 'identity-wallet-mismatch');
  assert.equal((await verifyRankedRun(fixture.body, fixtureVerifyOptions({ wallet: OTHER }))).error, 'identity-wallet-mismatch');
});

test('the FNV seed is refused for a live settle', async () => {
  const { identity } = fixture.body;
  const fnvSeed = deriveSessionSeed({ sessionId: identity.sessionId, gameId: identity.gameId, seasonId: identity.seasonId, buildHash: identity.buildHash });
  assert.notEqual(fnvSeed, identity.seed);
  const body = bodyWith((draft) => { draft.identity.seed = fnvSeed; });
  body.sessionId32 = await rankedSessionKey(body.identity);
  assert.deepEqual(await bind(body), { ok: false, status: 400, error: 'identity-seed-mismatch' });
});

test('evidence digest is computed without replay', async () => {
  for (const name of ['chikun-valid', 'stacked-valid', 'hmh-valid']) {
    const source = readFixture(name);
    const digest = await computeEvidenceDigest(source.body);
    const run = await verifyRankedRun(source.body, fixtureVerifyOptions());
    assert.deepEqual(digest, { ok: true, ...run.evidence }, name);
    assert.equal(digest.digest, source.expected.evidenceDigest);
    assert.equal(digest.bytes, source.expected.evidenceBytes);
  }
  // Evidence the replay would refuse still has a digest: nothing is replayed.
  const padded = bodyWith((body) => {
    const flap = body.evidence.flap;
    flap.flapDeltas.push(flap.maxTicks - 1 - decodeFlapDeltas(flap.flapDeltas).at(-1));
  });
  assert.equal((await verifyRankedRun(padded, fixtureVerifyOptions())).error, 'replay-rejected');
  assert.equal((await computeEvidenceDigest(padded)).ok, true);
  const stacked = readFixture('stacked-valid');
  const decoded = decodeSic1(Uint8Array.from(Buffer.from(stacked.body.evidence.sic1, 'base64')));
  const short = encodeSic1({ seed: decoded.seed, totalTicks: 120, transitions: decoded.transitions.filter(({ tick }) => tick <= 120).map(({ tick, mask }) => ({ tick, mask })) });
  const unfinished = bodyWith((body) => { body.evidence.sic1 = Buffer.from(short).toString('base64'); }, stacked);
  assert.equal((await verifyRankedRun(unfinished, fixtureVerifyOptions())).error, 'replay-rejected');
  assert.equal((await computeEvidenceDigest(unfinished)).ok, true);
  // Malformed evidence has no digest.
  for (const body of [
    bodyWith((draft) => { draft.evidence.encoding = 'stacked-sic1+base64'; }),
    bodyWith((draft) => { draft.evidence = null; }),
    bodyWith((draft) => { draft.gameId = 'pong'; }),
    bodyWith((draft) => { draft.evidence.sic1 = 'abc'; }, stacked),
    bodyWith((draft) => { delete draft.evidence.sessionEnvelope; }, readFixture('hmh-valid')),
  ]) {
    assert.deepEqual(await computeEvidenceDigest(body), { ok: false, status: 400, error: 'invalid-evidence' });
  }
});

test('binding does no replay', async () => {
  // A spy that throws if anything touches the evidence or the claim.
  const spy = { touched: [] };
  const trap = new Proxy({}, {
    get(_target, key) { spy.touched.push(String(key)); throw new Error('evidence was read during binding'); },
    ownKeys() { spy.touched.push('ownKeys'); throw new Error('evidence was enumerated during binding'); },
    getOwnPropertyDescriptor() { spy.touched.push('descriptor'); throw new Error('evidence was inspected during binding'); },
  });
  const body = { ...structuredClone(fixture.body), evidence: trap };
  Object.defineProperty(body, 'claim', { enumerable: true, get() { spy.touched.push('claim'); throw new Error('claim was read'); } });
  const bound = await bind(body);
  assert.equal(bound.ok, true);
  assert.deepEqual(spy.touched, []);
  // verifyRankedRun with `bound` skips the binding (a missing secret would throw inside it).
  const run = await verifyRankedRun(fixture.body, { nowMs: FIXTURE_VERIFY_AT_MS, bound: await bind(fixture.body) });
  assert.equal(run.ok, true);
  // A bound result for another body is refused.
  const otherBound = await bind(readFixture('chikun-10min').body);
  assert.deepEqual(await verifyRankedRun(fixture.body, { nowMs: FIXTURE_VERIFY_AT_MS, bound: otherBound }), { ok: false, status: 400, error: 'session-key-mismatch' });
  // A failed binding is returned as is.
  const failed = await bind(bodyWith((draft) => { draft.identity.chainId = 1; }));
  assert.deepEqual(await verifyRankedRun(fixture.body, { nowMs: FIXTURE_VERIFY_AT_MS, bound: failed }), failed);
});

test('stored runs re-verify to the same VerifiedRun', async () => {
  for (const name of ['chikun-valid', 'stacked-valid', 'hmh-valid', 'hmh-realistic']) {
    const source = readFixture(name);
    const run = await verifyRankedRun(source.body, fixtureVerifyOptions());
    // What settle stores: the canonical identity (JSONB round trip) and the evidence text.
    const stored = { gameId: run.gameId, identity: JSON.parse(JSON.stringify(run.identity)), evidence: { encoding: run.evidence.encoding, text: run.evidence.text } };
    const again = await reverifyStoredRun(stored, { nowMs: FIXTURE_VERIFY_AT_MS });
    assert.deepEqual(again, run, name);
  }
  const run = await verifyRankedRun(fixture.body, fixtureVerifyOptions());
  const stored = { gameId: 'chikun', identity: { ...run.identity }, evidence: { encoding: run.evidence.encoding, text: run.evidence.text } };
  // No ticket, no clock of the ticket: a re-sign a week later still re-verifies.
  assert.equal((await reverifyStoredRun(stored, { nowMs: FIXTURE_VERIFY_AT_MS + 7 * 86_400_000 })).ok, true);
  assert.deepEqual(await reverifyStoredRun({ ...stored, identity: { ...stored.identity, seed: stored.identity.seed + 1 } }), { ok: false, status: 400, error: 'session-key-mismatch' });
  assert.deepEqual(await reverifyStoredRun({ ...stored, gameId: 'stacked' }), { ok: false, status: 400, error: 'identity-invalid' });
  assert.deepEqual(await reverifyStoredRun({ ...stored, gameId: 'pong' }), { ok: false, status: 400, error: 'identity-game-unknown' });
  assert.deepEqual(await reverifyStoredRun({ ...stored, evidence: { ...stored.evidence, encoding: 'stacked-sic1+base64' } }), { ok: false, status: 400, error: 'invalid-evidence' });
  assert.equal((await reverifyStoredRun({ ...stored, evidence: { ...stored.evidence, text: JSON.stringify(JSON.parse(stored.evidence.text), null, 2) } })).error, 'invalid-evidence', 'stored text must be canonical');
  assert.equal((await reverifyStoredRun({ ...stored, evidence: { ...stored.evidence, text: '{not json' } })).error, 'invalid-evidence');
  const edited = JSON.parse(stored.evidence.text);
  edited.flapDeltas[0] = -1;
  assert.equal((await reverifyStoredRun({ ...stored, evidence: { ...stored.evidence, text: JSON.stringify(edited) } })).error, 'evidence-invalid');
});

test('scores above the contract MAX_SCORE are rejected for every game', async () => {
  const run = await verifyRankedRun(fixture.body, fixtureVerifyOptions());
  const build = (score) => buildVerifiedRun({
    identity: run.identity, nowMs: FIXTURE_VERIFY_AT_MS, score, stats: () => ({}),
    contract: run.contract, evidence: { encoding: run.evidence.encoding, text: run.evidence.text, digest: run.evidence.digest },
  });
  assert.deepEqual([(await build(10_000_000_001)).status, (await build(10_000_000_001)).error], [422, 'score-out-of-bounds']);
  assert.equal((await build(10_000_000_000)).ok, true);
  assert.equal((await build(1.5)).error, 'replay-rejected');
  assert.equal((await build(-1)).error, 'replay-rejected');
});

test('stats come from the achievements mappers when that module exists', async () => {
  const mappers = await loadRunStatsMappers();
  assert.equal(mappers.source, existsSync(ACHIEVEMENT_STATS_PATH) ? 'achievements' : 'verify-fallback');
  for (const key of ['statsFromChikunResult', 'statsFromStackedTuple', 'statsFromHmhRunSummary']) assert.equal(typeof mappers[key], 'function');
});

test('the server verifier loads in Node with no flags', () => {
  const script = "Promise.all(['./server/verify/index.mjs','./server/verify/chikun.mjs','./server/verify/stacked.mjs','./server/verify/hmh.mjs'].map((p)=>import(p))).then((m)=>{console.log(typeof m[0].verifyRankedRun, typeof m[1].verifyChikunRun)})";
  const result = spawnSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'function function');
});

// Static and literal dynamic imports, followed from every server/verify module.
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

test('server verification never loads arcade-core, hmh-run-integrity or rendering code', () => {
  const verifyDir = join(ROOT, 'server', 'verify');
  const entries = readdirSync(verifyDir).filter((file) => file.endsWith('.mjs')).map((file) => join(verifyDir, file));
  const graph = importGraph(entries);
  assert.ok(graph.includes('apps/portal/src/chikun-cabinet.mjs'));
  assert.ok(graph.includes('apps/portal/src/stacked-sim.mjs'));
  assert.ok(graph.includes('sdk/hmh-run-summary-schema.mjs'));
  for (const forbidden of ['apps/portal/src/arcade-core.mjs', 'apps/portal/src/hmh-run-integrity.mjs', 'apps/hmh-reboot/src/main.mjs', 'apps/portal/main.js']) {
    assert.equal(graph.includes(forbidden), false, forbidden);
  }
  assert.equal(graph.some((file) => /pixi/i.test(file)), false);
});
