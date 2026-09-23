import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyRankedRun } from '../server/verify/index.mjs';
import { stackedHeaderSeed, verifiedRunFromStackedTuple, verifyStackedRun } from '../server/verify/stacked.mjs';
import { decodeSic1, encodeSic1, replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS } from '../apps/portal/src/stacked-contracts.mjs';
import { rankedEnvelopeHash } from '../apps/portal/src/ranked-identity.mjs';
import { FIXTURE_VERIFY_AT_MS, buildFixture, fastestVerifyCpuMs, fixtureVerifyOptions, readFixture } from './fixtures/ranked/build-fixtures.mjs';

const STACKED_STATS_KEYS = ['score', 'lines', 'level', 'quadClears', 'spins', 'perfectClears', 'maxCombo', 'maxBackToBack', 'garbageRowsReceived',
  'garbageRowsCleared', 'pieces', 'holdsUsed', 'ticks', 'survivalSeconds', 'zone', 'terminalReason', 'boardHash'];

const fixture = readFixture('stacked-valid');
const bytesOf = (sic1) => Uint8Array.from(Buffer.from(sic1, 'base64'));
const base64Of = (bytes) => Buffer.from(bytes).toString('base64');
const bodyWith = (mutate) => {
  const body = structuredClone(fixture.body);
  mutate(body);
  return body;
};
const verify = (body, overrides) => verifyRankedRun(body, fixtureVerifyOptions(overrides));
const replayConfig = (identity) => ({ expectedSeed: identity.seed, maxTicks: STACKED_MAX_TICKS, config: { startLevel: 1, buildHash: identity.buildHash, seasonId: identity.seasonId } });

test('valid SIC1 replays to the canonical tuple', async () => {
  const run = await verify(fixture.body);
  assert.equal(run.ok, true, JSON.stringify(run));
  const bytes = bytesOf(fixture.body.evidence.sic1);
  const tuple = replayStackedRun(bytes, replayConfig(fixture.body.identity));
  assert.equal(tuple.terminalReason === 'block-out' || tuple.terminalReason === 'lock-out', true, 'the fixture tops out');
  assert.equal(run.score, tuple.score);
  assert.equal(run.score, fixture.expected.score);
  assert.deepEqual(run.contract, { kills: tuple.lines, maxCombo: Math.min(tuple.maxCombo, 10_000), survivalSeconds: Math.floor(tuple.ticks / 60), bossId: null });
  assert.deepEqual(run.contract, fixture.expected.contract);
  assert.deepEqual(Object.keys(run.stats), STACKED_STATS_KEYS);
  for (const key of ['score', 'lines', 'level', 'quadClears', 'spins', 'perfectClears', 'maxCombo', 'pieces', 'ticks', 'terminalReason', 'boardHash']) assert.equal(run.stats[key], tuple[key], key);
  assert.equal(run.stats.survivalSeconds, Number((tuple.ticks / 60).toFixed(3)));
  assert.equal(run.evidence.encoding, 'stacked-sic1+base64');
  assert.equal(run.evidence.text, fixture.body.evidence.sic1);
  assert.equal(run.evidence.bytes, fixture.body.evidence.sic1.length);
  assert.equal(run.evidence.digest, `0x${createHash('sha256').update(bytes).digest('hex')}`, 'the digest is over the raw SIC1 bytes');
  assert.equal(run.envelopeHash, await rankedEnvelopeHash({ gameId: 'stacked', sessionId32: fixture.body.sessionId32, encoding: 'stacked-sic1+base64', evidenceDigest: run.evidence.digest }));
  assert.equal(run.runtimeId, 'stacked:stacked-result-v1');
  assert.equal(run.seasonId, 'stacked-season-preview-1');
  assert.equal(run.plausibility, null);
  assert.equal(stackedHeaderSeed(bytes), fixture.body.identity.seed);
  // Replay uses the client's maxTicks, never a shorter one.
  assert.throws(() => replayStackedRun(bytes, { ...replayConfig(fixture.body.identity), maxTicks: tuple.ticks - 1 }));
});

test('header seed mismatch is rejected', async () => {
  const decoded = decodeSic1(bytesOf(fixture.body.evidence.sic1));
  const otherSeed = (fixture.body.identity.seed + 1) >>> 0;
  const reencoded = encodeSic1({ seed: otherSeed, totalTicks: decoded.totalTicks, transitions: decoded.transitions.map(({ tick, mask }) => ({ tick, mask })) });
  const run = await verify(bodyWith((body) => { body.evidence.sic1 = base64Of(reencoded); }));
  assert.deepEqual(run, { ok: false, status: 400, error: 'evidence-seed-mismatch' });
});

test('truncated or non-canonical base64 is rejected', async () => {
  const sic1 = fixture.body.evidence.sic1;
  const bytes = bytesOf(sic1);
  const flipped = Uint8Array.from(bytes);
  flipped[40] ^= 0xff; // breaks the FNV checksum in the header
  // The fixture's SIC1 is 3,650 bytes, so its base64 ends in one '=' and the last
  // data character carries 2 unused bits. Setting one decodes to the same bytes
  // but is not the canonical encoding.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  assert.equal(bytes.length % 3, 2);
  const data = sic1.slice(0, -1);
  const nonCanonicalTail = `${data.slice(0, -1)}${alphabet[alphabet.indexOf(data.at(-1)) | 1]}=`;
  assert.deepEqual(Buffer.from(nonCanonicalTail, 'base64'), Buffer.from(bytes));
  assert.notEqual(nonCanonicalTail, sic1);
  for (const [label, text] of [
    ['truncated', sic1.slice(0, -8)],
    ['missing padding', sic1.replace(/=+$/, '') === sic1 ? sic1.slice(0, -1) : sic1.replace(/=+$/, '')],
    ['whitespace', `${sic1.slice(0, 20)}\n${sic1.slice(20)}`],
    ['url-safe alphabet', sic1.replace(/\+/g, '-').replace(/\//g, '_') === sic1 ? `-${sic1.slice(1)}` : sic1.replace(/\+/g, '-').replace(/\//g, '_')],
    ['short raw', base64Of(bytes.subarray(0, 20))],
    ['checksum', base64Of(flipped)],
    ['not base64', '!!!!'],
    ['empty', ''],
    ['non-canonical unused bits', nonCanonicalTail],
  ]) {
    const run = await verify(bodyWith((body) => { body.evidence.sic1 = text; }));
    assert.equal(run.status, 400, label);
    assert.equal(run.error, 'evidence-invalid', `${label}: ${JSON.stringify(run)}`);
  }
  assert.equal((await verify(bodyWith((body) => { body.evidence.sic1 = 42; }))).error, 'evidence-invalid');
  assert.equal((await verify(bodyWith((body) => { body.evidence.encoding = 'stacked-sic1+hex'; }))).error, 'invalid-evidence');
});

test('startLevel other than 1 is rejected', async () => {
  for (const startLevel of [2, 15, 0, '1', null]) {
    const run = await verify(bodyWith((body) => { body.evidence.startLevel = startLevel; }));
    assert.deepEqual([run.status, run.error], [400, 'evidence-invalid'], String(startLevel));
  }
  assert.equal((await verify(bodyWith((body) => { delete body.evidence.startLevel; }))).error, 'invalid-evidence');
});

test('a replay that ends before a terminal state is rejected', async () => {
  const decoded = decodeSic1(bytesOf(fixture.body.evidence.sic1));
  const cut = 600;
  const truncated = encodeSic1({ seed: decoded.seed, totalTicks: cut, transitions: decoded.transitions.filter(({ tick }) => tick <= cut).map(({ tick, mask }) => ({ tick, mask })) });
  const run = await verify(bodyWith((body) => { body.evidence.sic1 = base64Of(truncated); }));
  assert.equal(run.status, 422);
  assert.equal(run.error, 'replay-rejected');
});

async function realTuple() {
  return replayStackedRun(bytesOf(fixture.body.evidence.sic1), replayConfig(fixture.body.identity));
}

test('maxCombo is clamped to the contract bound while stats keep the full value', async () => {
  const identity = (await verify(fixture.body)).identity;
  const base = await realTuple();
  const run = await verifiedRunFromStackedTuple({
    identity,
    tuple: { ...base, maxCombo: 20_000, lines: 150_000, ticks: 6_000_000 },
    sic1: fixture.body.evidence.sic1,
    digest: fixture.expected.evidenceDigest,
    nowMs: FIXTURE_VERIFY_AT_MS,
  });
  assert.equal(run.ok, true);
  assert.deepEqual(run.contract, { kills: 100_000, maxCombo: 10_000, survivalSeconds: 86_400, bossId: null });
  assert.equal(run.stats.maxCombo, 20_000);
  assert.equal(run.stats.lines, 150_000);
  assert.equal(run.stats.ticks, 6_000_000);
});

test('score above 1e10 is rejected', async () => {
  const identity = (await verify(fixture.body)).identity;
  const base = await realTuple();
  const mapped = (score) => verifiedRunFromStackedTuple({ identity, tuple: { ...base, score }, sic1: fixture.body.evidence.sic1, digest: fixture.expected.evidenceDigest, nowMs: FIXTURE_VERIFY_AT_MS });
  const over = await mapped(10_000_000_001);
  assert.equal(over.ok, false);
  assert.equal(over.status, 422);
  assert.equal(over.error, 'score-out-of-bounds');
  const edge = await mapped(10_000_000_000);
  assert.equal(edge.ok, true, 'the contract MAX_SCORE itself is allowed');
  assert.equal(edge.score, 10_000_000_000);
});

test('15-minute replay stays within budget', async () => {
  const long = readFixture('stacked-15min');
  assert.equal(long.expected.contract.survivalSeconds >= 900, true, 'the timing fixture covers at least 15 minutes');
  await verify(fixture.body); // module load and JIT warm-up are not the budget
  const { fastestMs, results } = await fastestVerifyCpuMs(() => verify(long.body), { budgetMs: 500 });
  for (const run of results) {
    assert.equal(run.ok, true);
    assert.equal(run.score, long.expected.score);
  }
  assert.ok(fastestMs < 500, `15-minute STACKED verification took ${fastestMs.toFixed(0)} ms of CPU at best over ${results.length} runs (budget 500 ms)`);
});

test('the per-game verifier matches the dispatcher', async () => {
  const dispatched = await verify(fixture.body);
  assert.deepEqual(await verifyStackedRun({ identity: dispatched.identity, evidence: fixture.body.evidence, nowMs: FIXTURE_VERIFY_AT_MS }), dispatched);
});

test('the committed STACKED fixture rebuilds from build-fixtures.mjs', async () => {
  assert.deepEqual(await buildFixture('stacked-valid'), fixture);
});
