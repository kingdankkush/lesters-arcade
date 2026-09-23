import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyRankedRun } from '../server/verify/index.mjs';
import { verifyChikunRun } from '../server/verify/chikun.mjs';
import { replayChikunRun, decodeFlapDeltas, CHIKUN_RUNTIME_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { canonicalSessionJson } from '../apps/portal/src/session-integrity.mjs';
import { rankedEnvelopeHash } from '../apps/portal/src/ranked-identity.mjs';
import {
  FIXTURE_VERIFY_AT_MS,
  buildFixture,
  buildFixtureBody,
  fastestVerifyCpuMs,
  fixtureSalt,
  fixtureVerifyOptions,
  readFixture,
} from './fixtures/ranked/build-fixtures.mjs';

const CHIKUN_STATS_KEYS = ['score', 'survivalTicks', 'survivalSeconds', 'coinsCollected', 'forksPassed', 'nearMisses', 'bestCombo',
  'nearMissStreakBest', 'flawlessRegions', 'flapCount', 'distanceMeters', 'regionIndexReached', 'regionReached', 'laps',
  'speedMultiplierReached', 'terminalReason', 'evidenceVersion'];

const fixture = readFixture('chikun-valid');
const bodyWith = (mutate) => {
  const body = structuredClone(fixture.body);
  mutate(body);
  return body;
};
const verify = (body, overrides) => verifyRankedRun(body, fixtureVerifyOptions(overrides));

test('valid v6 run verifies with server-derived stats and envelope', async () => {
  const run = await verify(fixture.body);
  assert.equal(run.ok, true, JSON.stringify(run));
  const flap = fixture.body.evidence.flap;
  const replayed = replayChikunRun(flap);
  assert.equal(run.score, replayed.score);
  assert.equal(run.score, fixture.expected.score);
  assert.deepEqual(run.contract, { kills: replayed.forksPassed, maxCombo: Math.min(replayed.bestCombo, 10_000), survivalSeconds: Math.floor(replayed.survivalTicks / 60), bossId: null });
  assert.deepEqual(run.contract, fixture.expected.contract);
  assert.deepEqual(Object.keys(run.stats), CHIKUN_STATS_KEYS);
  assert.equal(run.stats.score, run.score);
  assert.equal(run.stats.forksPassed, replayed.forksPassed);
  assert.equal(run.stats.flapCount, decodeFlapDeltas(flap.flapDeltas).length);
  assert.equal(run.stats.evidenceVersion, 'chikun-flap-evidence-v6');
  assert.equal(run.stats.terminalReason, replayed.finalState.terminalReason);
  // Stored evidence is the canonical JSON of the v6 flap object; the digest and the envelope commit to it.
  assert.equal(run.evidence.encoding, 'chikun-flap-evidence-v6+json');
  assert.equal(run.evidence.text, canonicalSessionJson(flap));
  assert.equal(run.evidence.bytes, Buffer.byteLength(run.evidence.text));
  assert.equal(run.evidence.digest, `0x${createHash('sha256').update(run.evidence.text).digest('hex')}`);
  assert.equal(run.envelopeHash, await rankedEnvelopeHash({ gameId: 'chikun', sessionId32: fixture.body.sessionId32, encoding: run.evidence.encoding, evidenceDigest: run.evidence.digest }));
  assert.equal(run.envelopeHash, fixture.expected.envelopeHash);
  // Identity fields.
  assert.equal(run.gameId, 'chikun');
  assert.equal(run.sessionId32, fixture.body.sessionId32);
  assert.equal(run.sessionHandle, fixture.body.identity.sessionId);
  assert.equal(run.wallet, fixture.wallet);
  assert.equal(run.seasonId, 'chikun-season-preview-1');
  assert.equal(run.runtimeId, `chikun:${CHIKUN_RUNTIME_VERSION}`);
  assert.equal(run.buildHash, fixture.body.identity.buildHash);
  assert.equal(run.seed, fixture.body.identity.seed);
  assert.equal(run.identity.version, 'lesters-canonical-session-v1');
  assert.equal(run.identity.sessionKey, fixture.body.sessionId32);
  assert.equal(run.plausibility, null);
  assert.equal(run.verifiedAt, new Date(FIXTURE_VERIFY_AT_MS).toISOString());
  assert.equal(Object.isFrozen(run) && Object.isFrozen(run.contract) && Object.isFrozen(run.stats) && Object.isFrozen(run.evidence), true);
});

test('tampered claim score is ignored, not trusted', async () => {
  const honest = await verify(fixture.body);
  for (const claim of [{ score: 999_999_999 }, { score: 0 }, undefined]) {
    const run = await verify(bodyWith((body) => { if (claim) body.claim = claim; else delete body.claim; }));
    assert.deepEqual(run, honest, 'the claim never changes the verified run');
  }
  // The claim is never even read.
  const trap = bodyWith(() => {});
  Object.defineProperty(trap, 'claim', { enumerable: true, get() { throw new Error('claim was read'); } });
  assert.deepEqual(await verify(trap), honest);
  assert.doesNotMatch(JSON.stringify(honest), /claim/);
});

test('wrong seed in evidence is rejected', async () => {
  const run = await verify(bodyWith((body) => { body.evidence.flap.seed = (body.evidence.flap.seed ^ 1) >>> 0; }));
  assert.deepEqual(run, { ok: false, status: 400, error: 'evidence-seed-mismatch' });
  const identitySeed = await verify(bodyWith((body) => { body.identity.seed = (body.identity.seed ^ 1) >>> 0; }));
  assert.equal(identitySeed.error, 'identity-seed-mismatch', 'a seed other than the ticket seed fails the binding');
});

test("evidence copied from another wallet's ticket does not verify", async () => {
  const otherWallet = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
  const other = await buildFixtureBody({ gameId: 'chikun', wallet: otherWallet, salt: fixtureSalt('another wallet'), evidence: { profile: 'expert', maxMinutes: 0.5 } });
  assert.equal((await verify(other.body, { wallet: otherWallet })).ok, true, 'the other wallet verifies its own run');
  // The copier settles the other run's evidence under its own identity and ticket.
  const copied = await verify(bodyWith((body) => { body.evidence = structuredClone(other.body.evidence); }));
  assert.deepEqual(copied, { ok: false, status: 400, error: 'evidence-seed-mismatch' });
  // Or rewrites the flap seed to its own ticket seed: the run no longer matches its settle-time replay.
  const reseeded = await verify(bodyWith((body) => {
    body.evidence = structuredClone(other.body.evidence);
    body.evidence.flap.seed = body.identity.seed;
  }));
  const { detail, ...outcome } = reseeded;
  assert.deepEqual(outcome, { ok: false, status: 422, error: 'replay-rejected' });
  assert.match(detail, /flaps at or after the final tick/, 'under the copier seed the run ends early and the copied flaps overrun it');
  // Or submits the other body wholesale: its identity is bound to the other wallet.
  assert.equal((await verify(other.body)).error, 'identity-wallet-mismatch');
  const stolenIdentity = structuredClone(other.body);
  stolenIdentity.identity.wallet = fixture.wallet;
  assert.equal((await verify(stolenIdentity)).error, 'seed-ticket-invalid', 'the ticket MAC binds the other wallet');
});

test('v5 evidence is rejected for Ranked', async () => {
  const v5 = await verify(bodyWith((body) => {
    const { seed, maxTicks, flapDeltas } = body.evidence.flap;
    body.evidence.flap = { version: 'chikun-flap-evidence-v5', seed, fixedStepHz: 60, maxTicks, flapSteps: decodeFlapDeltas(flapDeltas) };
  }));
  assert.equal(v5.status, 400);
  assert.equal(v5.error, 'evidence-version-unsupported');
  for (const version of ['chikun-flap-evidence-v1', 'chikun-flap-evidence-v7', undefined]) {
    assert.equal((await verify(bodyWith((body) => { body.evidence.flap.version = version; }))).error, 'evidence-version-unsupported');
  }
  assert.equal((await verify(bodyWith((body) => { body.evidence.encoding = 'chikun-flap-evidence-v5+json'; }))).error, 'invalid-evidence');
  assert.equal((await verify(bodyWith((body) => { body.evidence.extra = true; }))).error, 'invalid-evidence');
});

test('malformed deltas are rejected', async () => {
  const cases = [
    (flap) => { flap.flapDeltas[0] = -1; },
    (flap) => { flap.flapDeltas[3] = 0; },
    (flap) => { flap.flapDeltas[2] = 1.5; },
    (flap) => { flap.flapDeltas[1] = '6'; },
    (flap) => { flap.flapDeltas.push(flap.maxTicks); },
    (flap) => { flap.flapDeltas = Array.from({ length: 12_001 }, () => 1); },
    (flap) => { flap.flapDeltas = 'not-an-array'; },
    (flap) => { delete flap.flapDeltas; },
    (flap) => { flap.maxTicks = 216_001; },
    (flap) => { flap.maxTicks = 0; },
    (flap) => { flap.fixedStepHz = 30; },
    (flap) => { flap.flapSteps = [1]; },
  ];
  for (const [index, mutate] of cases.entries()) {
    const run = await verify(bodyWith((body) => mutate(body.evidence.flap)));
    assert.equal(run.status, 400, `case ${index}`);
    assert.equal(run.error, 'evidence-invalid', `case ${index}: ${JSON.stringify(run)}`);
  }
  // A flap padded after the run's final tick decodes, but the canonical v6 replay refuses it.
  const padded = await verify(bodyWith((body) => { body.evidence.flap.flapDeltas.push(Math.max(1, body.evidence.flap.maxTicks - 1 - decodeFlapDeltas(body.evidence.flap.flapDeltas).at(-1))); }));
  assert.equal(padded.status, 422);
  assert.equal(padded.error, 'replay-rejected');
});

test('10-minute replay stays within budget', async () => {
  const long = readFixture('chikun-10min');
  assert.equal(long.expected.contract.survivalSeconds >= 600, true, 'the timing fixture covers at least 10 minutes');
  await verify(readFixture('chikun-valid').body); // module load and JIT warm-up are not the budget
  const { fastestMs, results } = await fastestVerifyCpuMs(() => verify(long.body), { budgetMs: 1_500 });
  for (const run of results) {
    assert.equal(run.ok, true);
    assert.equal(run.score, long.expected.score);
  }
  assert.ok(fastestMs < 1_500, `10-minute Chikun verification took ${fastestMs.toFixed(0)} ms of CPU at best over ${results.length} runs (budget 1,500 ms)`);
});

test('the per-game verifier binds nothing itself and replays the canonical copy', async () => {
  const identity = (await verify(fixture.body)).identity;
  const direct = await verifyChikunRun({ identity, evidence: fixture.body.evidence, nowMs: FIXTURE_VERIFY_AT_MS });
  assert.deepEqual(direct, await verify(fixture.body));
});

test('the committed Chikun fixture rebuilds from build-fixtures.mjs', async () => {
  assert.deepEqual(await buildFixture('chikun-valid'), fixture);
});
