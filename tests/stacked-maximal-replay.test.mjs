import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStackedRuntime, decodeSic1, replayStackedRun, stackedRuntimeStateBytes } from '../apps/portal/src/stacked-sim.mjs';

const fixtureUrl = new URL('./fixtures/stacked-maximal-run.json', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = () => JSON.parse(readFileSync(fixtureUrl, 'utf8'));
const evidence = () => gunzipSync(readFileSync(new URL('./fixtures/stacked-maximal-run.sic1.gz', import.meta.url)), { maxOutputLength: 1_302_000 });

test('durable legal maximal evidence has pinned bytes and a terminal result at 432,000 ticks', () => {
  const saved = fixture(), bytes = evidence(), decoded = decodeSic1(bytes);
  assert.equal(saved.v, 'stacked-maximal-fixture-v1');
  assert.equal(decoded.totalTicks, 432_000);
  assert.equal(decoded.seed, saved.identity.seed);
  assert.equal(bytes.length, saved.evidence.bytes);
  assert.equal(digest(bytes), saved.evidence.sha256);
  assert.equal(saved.evidence.sha256, '769d2425938c2eb2659eaa97e0868a4089c633592c262b69a587d078a3d8dab1', 'regenerated baseline evidence stays pinned independently of the manifest');
  assert.equal(saved.expectedTuple.ticks, 432_000);
  assert.equal(saved.expectedTuple.terminalReason, 'tick-ceiling');
  assert.deepEqual(replayStackedRun(bytes, saved.replayOptions), saved.expectedTuple);
});

test('public runtime preserves full canonical state, board, RNG counts and evidence at maximal checkpoints', () => {
  const saved = fixture(), decoded = decodeSic1(evidence());
  const runtime = createStackedRuntime({ seed: decoded.seed, ...saved.replayOptions });
  let mask = 0, cursor = 0, checkpoint = 0;
  const check = () => {
    const expected = saved.checkpoints[checkpoint++];
    assert.equal(runtime.snapshot().tick, expected.tick);
    assert.deepEqual(runtime.snapshot(), expected.snapshot, `snapshot tick ${expected.tick}`);
    assert.equal(Buffer.from(stackedRuntimeStateBytes(runtime)).toString('base64'), expected.stateBytesBase64, `canonical bytes tick ${expected.tick}`);
    assert.equal(runtime.stateHash(), expected.stateHash, `state hash tick ${expected.tick}`);
  };
  assert.equal(saved.checkpoints[0].tick, 0);
  assert.equal(saved.checkpoints.at(-1).tick, 432_000);
  check();
  for (let tick = 1; tick <= decoded.totalTicks; tick += 1) {
    if (decoded.transitions[cursor]?.tick === tick) mask = decoded.transitions[cursor++].mask;
    assert.equal(runtime.terminal, false, `no early terminal at ${tick}`);
    runtime.step(mask);
    if (saved.checkpoints[checkpoint]?.tick === tick) check();
  }
  assert.equal(checkpoint, saved.checkpoints.length);
  assert.deepEqual(runtime.result(), saved.expectedTuple);
});

test('benchmark retains every cold sample and rejects a single replay over the fixed 250 ms bar', async () => {
  const { assessReplaySamples, STACKED_REPLAY_BUDGET_MS } = await import('../scripts/lib/stacked-replay-benchmark.mjs');
  assert.equal(STACKED_REPLAY_BUDGET_MS, 250);
  const samples = Array.from({ length: 7 }, (_, index) => ['decode', 'replay', 'verify'].map(phase => ({ index, phase, wallMs: 20, ok: true }))).flat();
  const passing = assessReplaySamples(samples, 7);
  assert.equal(passing.passed, true);
  assert.deepEqual(passing.samples, samples);
  const replaceFirst = replacement => [{ ...samples[0], ...replacement }, ...samples.slice(1)];
  assert.equal(assessReplaySamples(replaceFirst({ wallMs: 250 }), 7).passed, false);
  assert.equal(assessReplaySamples(replaceFirst({ wallMs: 251 }), 7).passed, false);
  assert.equal(assessReplaySamples(replaceFirst({ ok: false }), 7).passed, false);
  assert.equal(assessReplaySamples([], 7).passed, false);
  for (const wallMs of [NaN, Infinity, -1, null]) assert.equal(assessReplaySamples(replaceFirst({ wallMs }), 7).passed, false);
  assert.equal(assessReplaySamples(samples.filter(sample => sample.phase === 'replay'), 7).passed, false, 'replay alone cannot certify complete per-game verification');
});

test('fixture loader rejects checksum and canonical-data corruption', async () => {
  const { validateMaximalFixture } = await import('../scripts/lib/stacked-replay-benchmark.mjs');
  const saved = fixture(), bytes = evidence();
  assert.doesNotThrow(() => validateMaximalFixture(saved, bytes));
  const corrupted = bytes.slice(); corrupted[40] ^= 1;
  assert.throws(() => validateMaximalFixture(saved, corrupted), /hash|checksum/i);
  assert.throws(() => validateMaximalFixture({ ...saved, expectedTuple: { ...saved.expectedTuple, ticks: 60 } }, bytes), /maximal|ticks/i);
});

test('full per-game verification matches every saved canonical result field and evidence digest', async () => {
  const { loadMaximalFixture, assertVerifiedFixture } = await import('../scripts/lib/stacked-replay-benchmark.mjs');
  const { verifyStackedRun } = await import('../server/verify/stacked.mjs');
  const { fixture: saved, evidence: wire } = loadMaximalFixture();
  const verified = await verifyStackedRun({ identity: saved.identity, evidence: wire, nowMs: saved.verifyAtMs });
  assertVerifiedFixture(verified, saved, wire);
  assert.equal(verified.evidence.digest, `0x${saved.evidence.sha256}`);
});

test('fresh sample processes validate all actual evidence decode, replay and verifier paths', () => {
  for (const phase of ['decode', 'replay', 'verify']) {
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/stacked-replay-benchmark-sample.mjs', import.meta.url)), phase], { encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(child.status, 0, `${phase}: ${child.stderr}`);
    const sample = JSON.parse(child.stdout);
    assert.equal(sample.phase, phase);
    assert.equal(sample.ok, true);
    assert.equal(sample.ticks, 432_000);
    assert.equal(Number.isFinite(sample.wallMs), true);
    assert.equal(sample.evidenceSha256, '769d2425938c2eb2659eaa97e0868a4089c633592c262b69a587d078a3d8dab1');
  }
});
