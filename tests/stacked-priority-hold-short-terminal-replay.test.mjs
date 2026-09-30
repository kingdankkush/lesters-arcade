import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { decodeSic1, replayStackedRun, createStackedRuntime, stackedRuntimeStateBytes } from '../apps/portal/src/stacked-sim.mjs';
import { decodeStackedBase64 } from '../apps/portal/src/stacked-evidence-transport.mjs';
import { verifyStackedRun } from '../server/verify/stacked.mjs';

test('old genuine Hold short terminal retains canonical checkpoints, exact replay and full VerifiedRun', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/stacked-priority-hold-short-terminal-run.json', import.meta.url), 'utf8'));
  assert.equal(fixture.v, 'stacked-distinct-input-short-terminal-fixture-v1');
  assert.equal(fixture.provenance.maximalDurationAccepted, false);
  const gzip = readFileSync(new URL('./fixtures/stacked-priority-hold-short-terminal-run.sic1.gz', import.meta.url));
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(hash(gzip), fixture.evidence.compressedSha256);
  const bytes = gunzipSync(gzip, { maxOutputLength: 193_743 });
  assert.equal(bytes.length, 193_743);
  assert.equal(hash(bytes), '8665731c9716e09c8c1c180b880f0fb6e5f1ab861ae583d0a5fba2d5e4aec91a');
  const text = bytes.toString('base64');
  assert.deepEqual(Buffer.from(decodeStackedBase64(text, bytes.length)), bytes);
  const decoded = decodeSic1(bytes);
  assert.equal(decoded.totalTicks, 72_520);
  const runtime = createStackedRuntime({ seed: decoded.seed, maxTicks: 432_000, config: fixture.replayOptions.config });
  let checkpoint = 0, cursor = 0, mask = 0;
  function check() {
    const expected = fixture.checkpoints[checkpoint++];
    assert.deepEqual(runtime.snapshot(), expected.snapshot, `complete old snapshot at ${expected.tick}`);
    assert.equal(runtime.stateHash(), expected.stateHash, `old hash at ${expected.tick}`);
    assert.equal(Buffer.from(stackedRuntimeStateBytes(runtime)).toString('base64'), expected.stateBytesBase64, `old canonical state/RNG bytes at ${expected.tick}`);
  }
  assert.equal(fixture.checkpoints.length, 8);
  assert.equal(fixture.checkpoints[0].tick, 0);
  assert.equal(fixture.checkpoints.at(-1).tick, decoded.totalTicks);
  check();
  for (let tick = 1; tick <= decoded.totalTicks; tick += 1) {
    assert.equal(runtime.terminal, false, `uninterrupted before actual terminal at ${tick}`);
    if (decoded.transitions[cursor]?.tick === tick) mask = decoded.transitions[cursor++].mask;
    runtime.step(mask);
    if (fixture.checkpoints[checkpoint]?.tick === tick) check();
  }
  assert.equal(checkpoint, 8); assert.equal(runtime.terminal, true);
  assert.deepEqual(runtime.result(), fixture.expectedTuple);
  assert.equal(fixture.expectedTuple.terminalReason, 'block-out');
  assert.deepEqual(replayStackedRun(bytes, fixture.replayOptions), fixture.expectedTuple);
  const actual = await verifyStackedRun({ identity: fixture.identity, evidence: { encoding: 'stacked-sic1+base64', sic1: text, startLevel: 1 }, nowMs: fixture.verifyAtMs });
  assert.equal(actual.ok, true);
  const { text: verifiedText, ...metadata } = actual.evidence;
  assert.equal(verifiedText, text);
  assert.deepEqual({ ...actual, evidence: metadata }, fixture.expectedVerified);
});
