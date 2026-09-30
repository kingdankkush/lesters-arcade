// S0g: the worst *accepted* legal replay. Every one of the 432,000 legal ticks
// carries a multi-bit control change, so the evidence attains the canonical
// SIC1 byte bound while the game survives to the tick ceiling with a score.
// Tests read files directly, never regenerate the run and never call Git.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStackedRuntime, decodeSic1, replayStackedRun, stackedRuntimeStateBytes } from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS, STACKED_MAX_EVIDENCE_BYTES, STACKED_MAX_INPUT_TRANSITIONS } from '../apps/portal/src/stacked-contracts.mjs';
import { decodeStackedEvidence, verifyStackedRun } from '../server/verify/stacked.mjs';
import { canonicalSic1ByteBound } from '../scripts/lib/stacked-codec-boundary.mjs';

const RAW_HASH = 'c6f21edc20cd622705c2fede9b5643a84619db3ac37ed6aaa53ddf99ae2452d2';
const RAW_BYTES = 1_296_028;
// Generous CI bound for one complete first-use verification in a fresh process.
// It is not the 250 ms local headroom target; the opt-in benchmark measures that.
const CI_VERIFY_BUDGET_MS = 1_000;

const hash = value => createHash('sha256').update(value).digest('hex');
const popcount = value => { let count = 0; for (let bits = value; bits !== 0; bits &= bits - 1) count += 1; return count; };
function load() {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/stacked/stacked-longest-legal-run.json', import.meta.url), 'utf8'));
  const compressed = readFileSync(new URL('./fixtures/stacked/stacked-longest-legal-run.sic1.gz', import.meta.url));
  assert.equal(compressed.length, fixture.evidence.compressedBytes);
  assert.equal(hash(compressed), fixture.evidence.compressedSha256);
  const bytes = gunzipSync(compressed, { maxOutputLength: STACKED_MAX_EVIDENCE_BYTES });
  assert.equal(bytes.length, RAW_BYTES);
  assert.equal(hash(bytes), RAW_HASH, 'raw bytes pinned independently of editable fixture metadata');
  assert.equal(fixture.evidence.sha256, RAW_HASH);
  return { fixture, bytes, evidence: { encoding: 'stacked-sic1+base64', sic1: bytes.toString('base64'), startLevel: 1 } };
}

test('S0g longest legal evidence attains the canonical byte bound below the transport cap with a multi-bit change on every tick', () => {
  const { fixture, bytes, evidence } = load();
  assert.equal(fixture.v, 'stacked-longest-legal-fixture-v1');
  assert.equal(fixture.provenance.humanRun, false);
  assert.equal(fixture.provenance.continuous, true);
  assert.equal(fixture.provenance.unchangedRuntimeMaxTicks, STACKED_MAX_TICKS);
  assert.equal(fixture.replayOptions.maxTicks, STACKED_MAX_TICKS);
  assert.equal(fixture.replayOptions.config.startLevel, 1);
  assert.equal(fixture.expectedTuple.ticks, STACKED_MAX_TICKS);
  assert.equal(fixture.expectedTuple.terminalReason, 'tick-ceiling');
  assert.equal(bytes.length, canonicalSic1ByteBound(STACKED_MAX_TICKS), 'the run attains the proven canonical encoding bound');
  assert.ok(bytes.length < STACKED_MAX_EVIDENCE_BYTES, 'raw evidence stays under the 1,302,000-byte transport cap');
  assert.ok(evidence.sic1.length <= Math.ceil(STACKED_MAX_EVIDENCE_BYTES / 3) * 4, 'base64 text stays within the server decode bound');
  const decoded = decodeSic1(bytes);
  assert.equal(decoded.totalTicks, STACKED_MAX_TICKS);
  assert.equal(decoded.seed, fixture.identity.seed);
  assert.equal(decoded.transitionCount, STACKED_MAX_INPUT_TRANSITIONS);
  let previousMask = 0;
  for (let index = 0; index < decoded.transitions.length; index += 1) {
    const { tick, mask } = decoded.transitions[index];
    assert.equal(tick, index + 1, 'every legal tick carries one recorded transition');
    assert.ok(popcount(mask ^ previousMask) >= 2, `tick ${tick} must be a multi-bit escape`);
    previousMask = mask;
  }
  assert.deepEqual(replayStackedRun(bytes, fixture.replayOptions), fixture.expectedTuple);
});

test('S0g public runtime stays alive continuously and matches full canonical checkpoints and the terminal tuple', () => {
  const { fixture, bytes } = load();
  const decoded = decodeSic1(bytes);
  const runtime = createStackedRuntime({ seed: decoded.seed, maxTicks: STACKED_MAX_TICKS, config: fixture.replayOptions.config });
  let checkpoint = 0, cursor = 0, mask = 0;
  const check = () => {
    const expected = fixture.checkpoints[checkpoint++];
    assert.deepEqual(runtime.snapshot(), expected.snapshot, `full snapshot at ${expected.tick}`);
    assert.equal(runtime.stateHash(), expected.stateHash, `state hash at ${expected.tick}`);
    assert.equal(Buffer.from(stackedRuntimeStateBytes(runtime)).toString('base64'), expected.stateBytesBase64, `canonical bytes at ${expected.tick}`);
  };
  assert.equal(fixture.checkpoints[0].tick, 0);
  assert.equal(fixture.checkpoints.at(-1).tick, STACKED_MAX_TICKS);
  check();
  for (let tick = 1; tick <= decoded.totalTicks; tick += 1) {
    assert.equal(runtime.terminal, false, `no early terminal at ${tick}`);
    if (decoded.transitions[cursor]?.tick === tick) mask = decoded.transitions[cursor++].mask;
    runtime.step(mask);
    if (fixture.checkpoints[checkpoint]?.tick === tick) check();
  }
  assert.equal(checkpoint, fixture.checkpoints.length);
  assert.deepEqual(runtime.result(), fixture.expectedTuple);
});

test('S0g actual server decode and per-game verifier accept the run with its score and exact evidence', async () => {
  const { fixture, bytes, evidence } = load();
  const decoded = decodeStackedEvidence(evidence);
  assert.equal(decoded.ok, true);
  assert.deepEqual(Buffer.from(decoded.bytes), bytes);
  const actual = await verifyStackedRun({ identity: fixture.identity, evidence, nowMs: fixture.verifyAtMs });
  assert.equal(actual.ok, true, JSON.stringify(actual));
  const { text, ...metadata } = actual.evidence;
  assert.equal(text, evidence.sic1);
  assert.equal(metadata.bytes, evidence.sic1.length);
  assert.equal(metadata.digest, `0x${hash(bytes)}`);
  assert.deepEqual({ ...actual, evidence: metadata }, fixture.expectedVerified);
  assert.equal(actual.score, fixture.expectedTuple.score);
  assert.ok(actual.score > 0);
  assert.equal(actual.stats.ticks, STACKED_MAX_TICKS);
  assert.equal(actual.stats.terminalReason, 'tick-ceiling');
});

test('S0g one fresh-process first-use verification completes within the generous CI bound', () => {
  const { fixture } = load();
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/stacked-replay-benchmark-sample.mjs', import.meta.url)), 'verify', 'longest-legal'], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr);
  const sample = JSON.parse(child.stdout);
  assert.equal(sample.ok, true);
  assert.equal(sample.phase, 'verify');
  assert.equal(sample.fixture, 'longest-legal');
  assert.equal(sample.evidenceSha256, fixture.evidence.sha256);
  assert.equal(sample.evidenceBytes, RAW_BYTES);
  assert.equal(sample.ticks, STACKED_MAX_TICKS);
  assert.ok(Number.isFinite(sample.wallMs) && sample.wallMs >= 0);
  assert.ok(sample.wallMs < CI_VERIFY_BUDGET_MS, `complete first-use verification took ${sample.wallMs} ms`);
});

test('S0g checksum corruption and seed mismatch reject without a trusted result', async () => {
  const { fixture, bytes, evidence } = load();
  const corrupted = Buffer.from(bytes); corrupted[40] ^= 1;
  assert.throws(() => decodeSic1(corrupted), /checksum/i);
  const corruptRun = await verifyStackedRun({ identity: fixture.identity, evidence: { ...evidence, sic1: corrupted.toString('base64') }, nowMs: fixture.verifyAtMs });
  assert.equal(corruptRun.ok, false);
  assert.equal(corruptRun.error, 'evidence-invalid');
  const otherSeed = Buffer.from(bytes);
  otherSeed.writeUInt32BE((fixture.identity.seed + 1) >>> 0, 8);
  const seedRun = await verifyStackedRun({ identity: fixture.identity, evidence: { ...evidence, sic1: otherSeed.toString('base64') }, nowMs: fixture.verifyAtMs });
  assert.equal(seedRun.ok, false);
  assert.equal(seedRun.error, 'evidence-seed-mismatch');
});
