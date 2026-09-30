import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createStackedRuntime, decodeSic1, replayStackedRun, stackedRuntimeStateBytes } from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS, STACKED_MAX_EVIDENCE_BYTES } from '../apps/portal/src/stacked-contracts.mjs';
import { verifyStackedRun } from '../server/verify/stacked.mjs';

const RAW_HASH = '9ae11c4d47455bf92aed1424e9cd730ece503cf3f1f5fa2e00a18f9affb95ca4';
const hash = value => createHash('sha256').update(value).digest('hex');
function load() {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/stacked-maximal-priority-rotation-run.json', import.meta.url), 'utf8'));
  const compressed = readFileSync(new URL('./fixtures/stacked-maximal-priority-rotation-run.sic1.gz', import.meta.url));
  assert.equal(compressed.length, fixture.evidence.compressedBytes);
  assert.equal(hash(compressed), fixture.evidence.compressedSha256);
  const bytes = gunzipSync(compressed, { maxOutputLength: STACKED_MAX_EVIDENCE_BYTES });
  assert.equal(bytes.length, 757272);
  assert.equal(hash(bytes), RAW_HASH, 'raw bytes pinned independently of editable fixture metadata');
  assert.equal(fixture.evidence.sha256, RAW_HASH);
  return { fixture, bytes, evidence: { encoding: 'stacked-sic1+base64', sic1: bytes.toString('base64'), startLevel: 1 } };
}

test('S0c durable distinct multibit evidence is canonical and covers the unchanged maximal tick ceiling', () => {
  const { fixture, bytes } = load();
  assert.equal(fixture.v, 'stacked-maximal-priority-rotation-fixture-v1');
  assert.equal(fixture.provenance.humanRun, false);
  assert.equal(fixture.provenance.continuous, true);
  assert.equal(fixture.provenance.unchangedRuntimeMaxTicks, STACKED_MAX_TICKS);
  assert.equal(fixture.provenance.changedInputTicks, 81311);
  assert.equal(fixture.replayOptions.maxTicks, STACKED_MAX_TICKS);
  assert.equal(fixture.replayOptions.config.startLevel, 1);
  assert.equal(fixture.expectedTuple.ticks, 432_000);
  assert.equal(fixture.expectedTuple.terminalReason, 'tick-ceiling');
  const decoded = decodeSic1(bytes);
  assert.equal(decoded.totalTicks, STACKED_MAX_TICKS);
  assert.equal(decoded.seed, fixture.identity.seed);
  assert.equal(decoded.transitionCount, 432_000);
  let previousMask = 0, multiBitTransitions = 0, hardDropSoftDropTicks = 0, clockwisePriorityTicks = 0, counterclockwisePriorityTicks = 0;
  for (let index = 0; index < decoded.transitions.length; index += 1) {
    const { tick, mask } = decoded.transitions[index];
    assert.equal(tick, index + 1, 'every real tick has one distinct recorded transition');
    const changed = mask ^ previousMask;
    if ((changed & (changed - 1)) !== 0) multiBitTransitions += 1;
    if (mask === 12) hardDropSoftDropTicks += 1;
    if (mask === 80) clockwisePriorityTicks += 1;
    if (mask === 112) counterclockwisePriorityTicks += 1;
    previousMask = mask;
  }
  assert.equal(multiBitTransitions, 162622);
  assert.equal(hardDropSoftDropTicks, 52_899);
  assert.deepEqual(replayStackedRun(bytes, fixture.replayOptions), fixture.expectedTuple);
});

test('S0c public runtime stays alive continuously and matches full canonical checkpoints and the terminal tuple', () => {
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

test('S0c actual old-protocol per-game verifier preserves all canonical fields and exact distinct evidence', async () => {
  const { fixture, bytes, evidence } = load();
  const actual = await verifyStackedRun({ identity: fixture.identity, evidence, nowMs: fixture.verifyAtMs });
  assert.equal(actual.ok, true, JSON.stringify(actual));
  const { text, ...metadata } = actual.evidence;
  assert.equal(text, evidence.sic1);
  assert.equal(metadata.digest, `0x${hash(bytes)}`);
  assert.deepEqual({ ...actual, evidence: metadata }, fixture.expectedVerified);
  assert.equal(actual.score, 96_604_870);
  assert.equal(actual.stats.ticks, STACKED_MAX_TICKS);
  assert.equal(actual.stats.terminalReason, 'tick-ceiling');
});

test('S0c checksum corruption and seed mismatch reject without a trusted result', async () => {
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
