// Course two (chikun-input-evidence-v7) through the official dispatch. The
// gate (CHIKUN_OFFICIAL_COURSE_TWO_ENABLED) is closed; every acceptance case
// injects `courseTwoEnabled: true` through the verifier options.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { computeEvidenceDigest, reverifyStoredRun, verifyRankedRun } from '../server/verify/index.mjs';
import { CHIKUN_V6_STATS_KEYS, CHIKUN_V7_STATS_KEYS, parseChikunEvidenceText, verifyChikunRun } from '../server/verify/chikun.mjs';
import { CHIKUN_RUNTIME_VERSION, createChikunRuntime, replayChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';
import { replayCourseV2 } from '../apps/portal/src/chikun-course-v2-runtime.mjs';
import { exportChikunReplay, importChikunReplay } from '../apps/chikun/src/replay-file.mjs';
import { canonicalSessionJson } from '../apps/portal/src/session-integrity.mjs';
import { rankedEnvelopeHash } from '../apps/portal/src/ranked-identity.mjs';
import { statsFromChikunResult } from '../apps/portal/src/achievements/stats.mjs';
import {
  FIXTURE_VERIFY_AT_MS,
  buildFixture,
  buildFixtureBody,
  fixtureSalt,
  fixtureVerifyOptions,
  readFixture,
} from './fixtures/ranked/build-fixtures.mjs';

const V7 = 'chikun-input-evidence-v7';
const V7_ENCODING = 'chikun-input-evidence-v7+json';
const V6_ENCODING = 'chikun-flap-evidence-v6+json';
const OPEN = { courseTwoEnabled: true };

const fixture = readFixture('chikun-course-two');
const v6Fixture = readFixture('chikun-valid');
const bodyWith = (mutate, base = fixture.body) => {
  const body = structuredClone(base);
  mutate(body);
  return body;
};
const verifyClosed = (body, overrides) => verifyRankedRun(body, fixtureVerifyOptions(overrides));
const verifyOpen = (body, overrides) => verifyRankedRun(body, fixtureVerifyOptions({ ...OPEN, ...overrides }));
const lastTick = (deltas) => deltas.reduce((tick, delta) => tick + delta, 0);

test('the committed course-two fixture is a real course-two run with flaps and held glides', () => {
  const flap = fixture.body.evidence.flap;
  assert.equal(flap.version, V7);
  assert.equal(fixture.body.evidence.encoding, V7_ENCODING);
  assert.deepEqual(Object.keys(flap).sort(), ['fixedStepHz', 'flapDeltas', 'glideDeltas', 'maxTicks', 'seed', 'version']);
  assert.ok(flap.flapDeltas.length > 100 && flap.glideDeltas.length > 100, `${flap.flapDeltas.length} flaps, ${flap.glideDeltas.length} glide transitions`);
  const result = replayCourseV2(flap);
  assert.equal(result.score, fixture.expected.score);
  assert.ok(result.shieldsUsed >= 1 && result.powerupsCollected >= 2, 'the run took a Scrypt Shield and a Glide Feather');
  assert.ok(result.crashed, 'the run ends on the course, not at maxTicks');
  assert.equal(fixture.expected.runtimeId, `chikun:${CHIKUN_RUNTIME_VERSION}:course-2`);
});

test('gate closed (the default): every course-two body is refused exactly as before', async () => {
  const closed = await verifyClosed(fixture.body);
  assert.deepEqual(closed, { ok: false, status: 400, error: 'invalid-evidence' });
  assert.deepEqual(closed, fixture.expected.gateClosed);
  // v7 evidence smuggled under the v6 encoding keeps its old version error and detail.
  const smuggled = await verifyClosed(bodyWith((body) => { body.evidence.encoding = V6_ENCODING; }));
  assert.deepEqual(smuggled, { ok: false, status: 400, error: 'evidence-version-unsupported', detail: 'Ranked accepts only chikun-flap-evidence-v6' });
  // The per-game verifier, the digest and the re-sign path all default to the closed gate.
  const identity = (await verifyOpen(fixture.body)).identity;
  assert.deepEqual(await verifyChikunRun({ identity, evidence: fixture.body.evidence, nowMs: FIXTURE_VERIFY_AT_MS }), closed);
  assert.deepEqual(await computeEvidenceDigest(fixture.body), { ok: false, status: 400, error: 'invalid-evidence' });
  const open = await verifyOpen(fixture.body);
  assert.deepEqual(await reverifyStoredRun({ gameId: 'chikun', identity: open.identity, evidence: { encoding: open.evidence.encoding, text: open.evidence.text } }), { ok: false, status: 400, error: 'invalid-evidence' });
  // Only boolean true opens the gate.
  for (const value of [1, 'true', {}, [], 'yes']) {
    assert.deepEqual(await verifyClosed(fixture.body, { courseTwoEnabled: value }), closed, `courseTwoEnabled: ${JSON.stringify(value)}`);
  }
});

test('gate open: a course-two run verifies with server-derived stats equal to a local replay', async () => {
  const run = await verifyOpen(fixture.body);
  assert.equal(run.ok, true, JSON.stringify(run));
  const flap = fixture.body.evidence.flap;
  const replayed = replayChikunRun(flap);
  assert.deepEqual(replayed, replayCourseV2(flap), 'the cabinet dispatches v7 to the course-two runtime');
  assert.equal(run.score, replayed.score);
  assert.equal(run.score, fixture.expected.score);
  assert.deepEqual(run.contract, { kills: replayed.forksPassed, maxCombo: Math.min(replayed.bestCombo, 10_000), survivalSeconds: Math.floor(replayed.survivalTicks / 60), bossId: null });
  assert.deepEqual(run.contract, fixture.expected.contract);
  assert.deepEqual(Object.keys(run.stats), CHIKUN_V7_STATS_KEYS);
  assert.deepEqual(CHIKUN_V7_STATS_KEYS, [...CHIKUN_V6_STATS_KEYS, 'glideCount', 'shieldsUsed', 'powerupsCollected']);
  assert.deepEqual(run.stats, { ...statsFromChikunResult(replayed), glideCount: flap.glideDeltas.length, shieldsUsed: replayed.shieldsUsed, powerupsCollected: replayed.powerupsCollected });
  assert.deepEqual(run.stats, fixture.expected.stats);
  assert.equal(run.stats.evidenceVersion, V7);
  assert.equal(run.stats.flapCount, flap.flapDeltas.length);
  assert.equal(run.stats.glideCount, flap.glideDeltas.length);
  assert.equal(run.stats.terminalReason, replayed.finalState.terminalReason);
  // Stored evidence is the canonical JSON of the v7 object; digest and envelope commit to it under the v7 encoding.
  assert.equal(run.evidence.encoding, V7_ENCODING);
  assert.equal(run.evidence.text, canonicalSessionJson(flap));
  assert.equal(run.evidence.bytes, Buffer.byteLength(run.evidence.text));
  assert.equal(run.evidence.digest, `0x${createHash('sha256').update(run.evidence.text).digest('hex')}`);
  assert.equal(run.envelopeHash, await rankedEnvelopeHash({ gameId: 'chikun', sessionId32: fixture.body.sessionId32, encoding: V7_ENCODING, evidenceDigest: run.evidence.digest }));
  assert.equal(run.envelopeHash, fixture.expected.envelopeHash);
  assert.notEqual(run.envelopeHash, await rankedEnvelopeHash({ gameId: 'chikun', sessionId32: fixture.body.sessionId32, encoding: V6_ENCODING, evidenceDigest: run.evidence.digest }), 'a v7 run never carries a v6 envelope');
  // Identity fields; the runtimeId names the course.
  assert.equal(run.runtimeId, `chikun:${CHIKUN_RUNTIME_VERSION}:course-2`);
  assert.equal(run.runtimeId, fixture.expected.runtimeId);
  assert.equal(run.gameId, 'chikun');
  assert.equal(run.sessionId32, fixture.body.sessionId32);
  assert.equal(run.wallet, fixture.wallet);
  assert.equal(run.seed, fixture.body.identity.seed);
  assert.equal(run.plausibility, null);
  assert.equal(run.verifiedAt, new Date(FIXTURE_VERIFY_AT_MS).toISOString());
  assert.equal(Object.isFrozen(run) && Object.isFrozen(run.stats) && Object.isFrozen(run.evidence), true);
  // The per-game verifier, the digest and the re-sign path agree with the settle path.
  assert.deepEqual(await verifyChikunRun({ identity: run.identity, evidence: fixture.body.evidence, nowMs: FIXTURE_VERIFY_AT_MS, courseTwoEnabled: true }), run);
  assert.deepEqual(await computeEvidenceDigest(fixture.body, OPEN), { ok: true, encoding: V7_ENCODING, text: run.evidence.text, bytes: run.evidence.bytes, digest: run.evidence.digest });
  assert.deepEqual(parseChikunEvidenceText(run.evidence.text, V7_ENCODING), { encoding: V7_ENCODING, flap });
  assert.deepEqual(await reverifyStoredRun({ gameId: 'chikun', identity: run.identity, evidence: { encoding: run.evidence.encoding, text: run.evidence.text } }, { nowMs: FIXTURE_VERIFY_AT_MS, courseTwoEnabled: true }), run);
});

test('gate open: course one is untouched, v1-v5 stay refused and the encoding must match the version', async () => {
  const closed = await verifyClosed(v6Fixture.body);
  const open = await verifyOpen(v6Fixture.body);
  assert.deepEqual(open, closed, 'a v6 run verifies identically whatever the gate says');
  assert.equal(open.runtimeId, `chikun:${CHIKUN_RUNTIME_VERSION}`);
  assert.equal(open.evidence.encoding, V6_ENCODING);
  assert.deepEqual(Object.keys(open.stats), CHIKUN_V6_STATS_KEYS);
  assert.deepEqual(await computeEvidenceDigest(v6Fixture.body, OPEN), await computeEvidenceDigest(v6Fixture.body));
  for (const version of ['chikun-flap-evidence-v1', 'chikun-flap-evidence-v2', 'chikun-flap-evidence-v3', 'chikun-flap-evidence-v5', 'chikun-flap-evidence-v7', undefined]) {
    const run = await verifyOpen(bodyWith((body) => { body.evidence.flap.version = version; }, v6Fixture.body));
    assert.deepEqual(run, { ok: false, status: 400, error: 'evidence-version-unsupported', detail: 'Ranked accepts only chikun-flap-evidence-v6, chikun-input-evidence-v7' }, String(version));
  }
  // A v6 stream under the v7 encoding, or v7 under the v6 encoding, is not a course.
  assert.equal((await verifyOpen(bodyWith((body) => { body.evidence.encoding = V7_ENCODING; }, v6Fixture.body))).error, 'evidence-version-unsupported');
  assert.equal((await verifyOpen(bodyWith((body) => { body.evidence.encoding = V6_ENCODING; }))).error, 'evidence-version-unsupported');
  assert.equal((await verifyOpen(bodyWith((body) => { body.evidence.encoding = 'chikun-input-evidence-v7'; }))).error, 'invalid-evidence');
  // No URL, query or claim field can select a course.
  assert.equal((await verifyOpen(bodyWith((body) => { body.evidence.course = 2; }))).error, 'invalid-evidence');
});

test('gate open: the claim is ignored, not trusted', async () => {
  const honest = await verifyOpen(fixture.body);
  for (const claim of [{ score: 999_999_999 }, { score: 0 }, undefined]) {
    const run = await verifyOpen(bodyWith((body) => { if (claim) body.claim = claim; else delete body.claim; }));
    assert.deepEqual(run, honest, 'the claim never changes the verified run');
  }
  const trap = bodyWith(() => {});
  Object.defineProperty(trap, 'claim', { enumerable: true, get() { throw new Error('claim was read'); } });
  assert.deepEqual(await verifyOpen(trap), honest);
  assert.doesNotMatch(JSON.stringify(honest), /claim/);
});

test('gate open: a seed other than the bound ticket seed is rejected', async () => {
  const run = await verifyOpen(bodyWith((body) => { body.evidence.flap.seed = (body.evidence.flap.seed ^ 1) >>> 0; }));
  assert.deepEqual(run, { ok: false, status: 400, error: 'evidence-seed-mismatch' });
  const identitySeed = await verifyOpen(bodyWith((body) => { body.identity.seed = (body.identity.seed ^ 1) >>> 0; }));
  assert.equal(identitySeed.error, 'identity-seed-mismatch');
});

test("gate open: course-two evidence copied from another wallet's ticket does not verify", async () => {
  const otherWallet = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
  const other = await buildFixtureBody({ gameId: 'chikun', wallet: otherWallet, salt: fixtureSalt('another wallet, course two'), evidence: { course: 2, maxMinutes: 2 } });
  assert.equal(other.body.evidence.encoding, V7_ENCODING);
  assert.equal((await verifyOpen(other.body, { wallet: otherWallet })).ok, true, 'the other wallet verifies its own run');
  assert.equal((await verifyClosed(other.body, { wallet: otherWallet })).ok, false, 'and only through the gate');
  const copied = await verifyOpen(bodyWith((body) => { body.evidence = structuredClone(other.body.evidence); }));
  assert.deepEqual(copied, { ok: false, status: 400, error: 'evidence-seed-mismatch' });
  const reseeded = await verifyOpen(bodyWith((body) => {
    body.evidence = structuredClone(other.body.evidence);
    body.evidence.flap.seed = body.identity.seed;
  }));
  // Under the copier seed the inputs either fail the canonical replay or become
  // the copier's own run: scored by the server replay at the copier seed, never
  // by the copied claim or the other wallet's result.
  if (reseeded.ok) {
    const own = replayCourseV2({ ...other.body.evidence.flap, seed: fixture.body.identity.seed });
    assert.equal(reseeded.seed, fixture.body.identity.seed);
    assert.equal(reseeded.score, own.score);
    assert.equal(reseeded.wallet, fixture.wallet);
    assert.notEqual(reseeded.evidence.digest, (await verifyOpen(other.body, { wallet: otherWallet })).evidence.digest);
  } else {
    assert.deepEqual([reseeded.status, reseeded.error], [422, 'replay-rejected']);
  }
  assert.equal((await verifyOpen(other.body)).error, 'identity-wallet-mismatch');
  const stolenIdentity = structuredClone(other.body);
  stolenIdentity.identity.wallet = fixture.wallet;
  assert.equal((await verifyOpen(stolenIdentity)).error, 'seed-ticket-invalid');
});

test('gate open: transition budgets, stream shape and termination are enforced', async () => {
  const flapOf = (body) => body.evidence.flap;
  const invalidCases = [
    ['flaps over budget', (flap) => { flap.flapDeltas = Array.from({ length: 12_001 }, () => 1); }],
    ['glides over budget', (flap) => { flap.glideDeltas = Array.from({ length: 12_001 }, () => 1); }],
    ['combined over budget', (flap) => { flap.flapDeltas = Array.from({ length: 6_001 }, () => 1); flap.glideDeltas = Array.from({ length: 6_000 }, () => 1); }],
    ['glide delta zero', (flap) => { flap.glideDeltas[3] = 0; }],
    ['glide delta negative first', (flap) => { flap.glideDeltas[0] = -1; }],
    ['glide delta fraction', (flap) => { flap.glideDeltas[2] = 1.5; }],
    ['glide delta string', (flap) => { flap.glideDeltas[1] = '6'; }],
    ['glide at maxTicks', (flap) => { flap.glideDeltas.push(flap.maxTicks); }],
    ['glides not an array', (flap) => { flap.glideDeltas = 'held'; }],
    ['glides missing', (flap) => { delete flap.glideDeltas; }],
    ['flaps missing', (flap) => { delete flap.flapDeltas; }],
    ['flap delta zero', (flap) => { flap.flapDeltas[3] = 0; }],
    ['extra key', (flap) => { flap.flapSteps = [1]; }],
    ['course key', (flap) => { flap.course = 2; }],
    ['maxTicks over budget', (flap) => { flap.maxTicks = 216_001; }],
    ['maxTicks zero', (flap) => { flap.maxTicks = 0; }],
    ['fixedStepHz', (flap) => { flap.fixedStepHz = 30; }],
  ];
  for (const [label, mutate] of invalidCases) {
    const run = await verifyOpen(bodyWith((body) => mutate(flapOf(body))));
    assert.equal(run.status, 400, label);
    assert.equal(run.error, 'evidence-invalid', `${label}: ${JSON.stringify(run)}`);
  }
  // Exactly 12,000 combined transitions parse; the replay decides whether they ran.
  const full = await verifyOpen(bodyWith((body) => { flapOf(body).flapDeltas = Array.from({ length: 6_000 }, () => 1); flapOf(body).glideDeltas = Array.from({ length: 6_000 }, () => 1); }));
  assert.equal(full.status, 422, JSON.stringify(full));
  assert.equal(full.error, 'replay-rejected');
  // An input at or after the terminal tick decodes but the canonical replay refuses it.
  const terminal = replayCourseV2(flapOf(fixture.body)).survivalTicks;
  for (const stream of ['flapDeltas', 'glideDeltas']) {
    for (const offset of [0, 1, 25]) {
      const padded = await verifyOpen(bodyWith((body) => {
        const flap = flapOf(body);
        const target = terminal + offset;
        assert.ok(target < flap.maxTicks && target > lastTick(flap[stream]));
        flap[stream].push(target - lastTick(flap[stream]));
      }));
      assert.equal(padded.status, 422, `${stream} +${offset}`);
      assert.equal(padded.error, 'replay-rejected');
      assert.match(padded.detail, /terminal tick/, `${stream} +${offset}: ${padded.detail}`);
    }
  }
  // Removing one flap (later ticks unchanged) is another run with its own stored
  // evidence, digest and envelope, whatever its score: the input is the identity.
  const shortened = await verifyOpen(bodyWith((body) => { const deltas = flapOf(body).flapDeltas; const [removed] = deltas.splice(50, 1); deltas[50] += removed; }));
  if (shortened.ok) {
    assert.notEqual(shortened.evidence.digest, fixture.expected.evidenceDigest);
    assert.notEqual(shortened.envelopeHash, fixture.expected.envelopeHash);
    assert.equal(shortened.stats.flapCount, flapOf(fixture.body).flapDeltas.length - 1);
  } else {
    assert.deepEqual([shortened.status, shortened.error], [422, 'replay-rejected']);
  }
});

test('the course-two fixture round-trips through the replay file and rebuilds from build-fixtures.mjs', async () => {
  const flap = fixture.body.evidence.flap;
  const local = replayChikunRun(flap);
  const text = exportChikunReplay(local);
  assert.doesNotMatch(text, /wallet|session|score/);
  const imported = importChikunReplay(text);
  assert.deepEqual(imported, local);
  assert.deepEqual(JSON.parse(JSON.stringify(imported.evidence)), flap, 'the file carries exactly the verified evidence');
  assert.equal((await verifyOpen(bodyWith((body) => { body.evidence.flap = JSON.parse(JSON.stringify(imported.evidence)); }))).score, fixture.expected.score);
  assert.deepEqual(await buildFixture('chikun-course-two'), fixture);
});

test('the held glide is load-bearing: dropping or inverting it changes the run', async () => {
  const flap = fixture.body.evidence.flap;
  const honest = replayCourseV2(flap);
  // A Glide Feather was collected and its gap glide spent, so the same flap
  // ticks without the held transitions fall into the gap: the replay ends
  // early and the remaining flaps sit at or after its terminal tick.
  assert.throws(() => replayCourseV2({ ...flap, glideDeltas: [] }), /terminal tick/);
  const droppedRun = await verifyOpen(bodyWith((body) => { body.evidence.flap.glideDeltas = []; }));
  assert.equal(droppedRun.status, 422);
  assert.equal(droppedRun.error, 'replay-rejected');
  // Inverting the held state (a toggle at tick 0, or removing one that is there) is another run too.
  const inverted = flap.glideDeltas[0] === 0 ? [flap.glideDeltas[1], ...flap.glideDeltas.slice(2)] : [0, ...flap.glideDeltas];
  let invertedResult = null;
  try { invertedResult = replayCourseV2({ ...flap, glideDeltas: inverted }); } catch { invertedResult = null; }
  assert.ok(invertedResult === null || JSON.stringify(invertedResult.finalState) !== JSON.stringify(honest.finalState), 'an inverted hold never reproduces the honest run');
  const invertedRun = await verifyOpen(bodyWith((body) => { body.evidence.flap.glideDeltas = inverted; }));
  if (invertedRun.ok) {
    assert.notEqual(invertedRun.evidence.digest, fixture.expected.evidenceDigest);
    assert.ok(invertedRun.score !== honest.score || JSON.stringify(invertedRun.stats) !== JSON.stringify(fixture.expected.stats), 'an accepted inverted hold is scored as its own run');
  } else {
    assert.deepEqual([invertedRun.status, invertedRun.error], [422, 'replay-rejected']);
  }
  // The honest run really used the feather: a glide was active on the way through a gap.
  const ticksOf = (deltas) => deltas.reduce((ticks, delta, i) => { ticks.push(i === 0 ? delta : ticks[i - 1] + delta); return ticks; }, []);
  const flaps = new Set(ticksOf(flap.flapDeltas));
  const holds = new Set(ticksOf(flap.glideDeltas));
  const runtime = createChikunRuntime({ seed: flap.seed, maxTicks: flap.maxTicks, evidenceVersion: V7 });
  let held = false; let glided = false; let feather = false;
  while (!runtime.terminal) {
    const snapshot = runtime.snapshot();
    feather ||= snapshot.powers.feather;
    glided ||= snapshot.powers.gliding;
    if (holds.has(snapshot.tick)) held = !held;
    runtime.step({ flap: flaps.has(snapshot.tick), glide: held });
  }
  assert.equal(feather && glided, true, 'the fixture collected a Glide Feather and glided through a gap');
  assert.deepEqual(runtime.result(), honest);
});

test('reverifyStoredRun checks the stored encoding column against the text in both gate states', async () => {
  const open = await verifyOpen(fixture.body);
  const v6 = await verifyClosed(v6Fixture.body);
  const stored = (run, encoding = run.evidence.encoding) => ({ gameId: 'chikun', identity: run.identity, evidence: { encoding, text: run.evidence.text } });
  const at = { nowMs: FIXTURE_VERIFY_AT_MS };
  // Honest columns round-trip.
  assert.deepEqual(await reverifyStoredRun(stored(open), { ...at, courseTwoEnabled: true }), open);
  assert.deepEqual(await reverifyStoredRun(stored(v6), at), v6);
  assert.deepEqual(await reverifyStoredRun(stored(v6), { ...at, courseTwoEnabled: true }), v6);
  // A v7 text under the v6 column: gate closed answers exactly what the base did; gate open refuses it too.
  const v7TextUnderV6 = stored(open, V6_ENCODING);
  assert.deepEqual(await reverifyStoredRun(v7TextUnderV6, at), { ok: false, status: 400, error: 'evidence-version-unsupported', detail: 'Ranked accepts only chikun-flap-evidence-v6' });
  assert.deepEqual(await reverifyStoredRun(v7TextUnderV6, { ...at, courseTwoEnabled: true }), { ok: false, status: 400, error: 'evidence-version-unsupported', detail: 'Ranked accepts only chikun-flap-evidence-v6, chikun-input-evidence-v7' });
  // A v6 text under the v7 column: the closed gate never lists v7; the open gate refuses the mismatch.
  const v6TextUnderV7 = stored(v6, V7_ENCODING);
  assert.deepEqual(await reverifyStoredRun(v6TextUnderV7, at), { ok: false, status: 400, error: 'invalid-evidence' });
  assert.equal((await reverifyStoredRun(v6TextUnderV7, { ...at, courseTwoEnabled: true })).error, 'evidence-version-unsupported');
  // The parser keeps whatever column it is given; the verifier does the matching.
  assert.deepEqual(parseChikunEvidenceText(open.evidence.text, V7_ENCODING), { encoding: V7_ENCODING, flap: fixture.body.evidence.flap });
  assert.deepEqual(parseChikunEvidenceText(open.evidence.text), { encoding: V6_ENCODING, flap: fixture.body.evidence.flap });
});
