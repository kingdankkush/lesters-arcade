import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withReplayHeavyLock, assessReplaySamples } from '../scripts/lib/stacked-replay-benchmark.mjs';

test('performance lock refuses competing ownership and releases only its own empty folder', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'stacked-replay-lock-'));
  const lockPath = join(parent, 'heavy.lock');
  try {
    await withReplayHeavyLock(async () => {
      const owner = JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8'));
      assert.equal(owner.owner, 'stacked-replay-benchmark');
      await assert.rejects(withReplayHeavyLock(async () => assert.fail('competing job ran'), { lockPath }), /EEXIST/);
      assert.equal(JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8')).token, owner.token);
    }, { lockPath });
    assert.equal(existsSync(lockPath), false);
    await assert.rejects(withReplayHeavyLock(async () => { throw new Error('measurement failed'); }, { lockPath }), /measurement failed/);
    assert.equal(existsSync(lockPath), false, 'failed measurement must release its own lock');
  } finally { rmdirSync(parent); }
});

test('changed lock ownership is preserved even after the job exits', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'stacked-replay-lock-'));
  const lockPath = join(parent, 'heavy.lock'), ownerPath = join(lockPath, 'owner.json');
  try {
    await assert.rejects(withReplayHeavyLock(async () => writeFileSync(ownerPath, JSON.stringify({ token: 'other-owner' })), { lockPath }), /ownership changed/);
    assert.equal(JSON.parse(readFileSync(ownerPath, 'utf8')).token, 'other-owner');
  } finally { unlinkSync(ownerPath); rmdirSync(lockPath); rmdirSync(parent); }
});

test('slow first-use observations stay visible instead of being erased by faster samples', () => {
  const samples = completeSamples(7).map(sample => sample.phase === 'replay' ? { ...sample, wallMs: sample.index === 0 ? 300 : 90 } : sample);
  const result = assessReplaySamples(samples, 7);
  assert.equal(result.complete, true);
  assert.equal(result.passed, false);
  assert.equal(result.phases.replay.p50Ms, 90);
  assert.equal(result.phases.replay.p95Ms, 300);
  assert.equal(result.phases.replay.maxMs, 300);
  assert.equal(result.samples.length, 21);
});

const completeSamples = count => Array.from({ length: count }, (_, index) => ['decode', 'replay', 'verify'].map(phase => ({ index, phase, ok: true, wallMs: 20 + index }))).flat();

test('assessment requires the configured count and every unique index in all three phases', () => {
  const samples = completeSamples(7);
  assert.equal(assessReplaySamples(samples, 7).passed, true);
  const invalid = [
    ['missing decode phase', samples.filter(sample => sample.phase !== 'decode')],
    ['truncated equal batch', completeSamples(6)],
    ['uneven batch', samples.filter(sample => !(sample.phase === 'verify' && sample.index === 6))],
    ['duplicate index replacing a missing sample', samples.map(sample => sample.phase === 'decode' && sample.index === 6 ? { ...sample, index: 5 } : sample)],
    ['duplicate extra sample', [...samples, { ...samples[0] }]],
    ['out-of-range index', samples.map(sample => sample.phase === 'replay' && sample.index === 0 ? { ...sample, index: 7 } : sample)],
    ['negative index', samples.map(sample => sample.phase === 'replay' && sample.index === 0 ? { ...sample, index: -1 } : sample)],
    ['fractional index', samples.map(sample => sample.phase === 'verify' && sample.index === 0 ? { ...sample, index: .5 } : sample)],
    ['missing index', samples.map(({ index, ...sample }, position) => position === 0 ? sample : { index, ...sample })],
    ['unknown extra phase', [...samples, { index: 0, phase: 'other', ok: true, wallMs: 1 }]],
    ['empty batch', []],
  ];
  for (const [reason, batch] of invalid) assert.equal(assessReplaySamples(batch, 7).passed, false, reason);
  const before = structuredClone(samples);
  const result = assessReplaySamples(samples, 7);
  assert.deepEqual(samples, before, 'assessment never mutates observations');
  assert.deepEqual(result.samples, samples, 'all observations survive assessment');
  result.samples[0].wallMs = 500;
  assert.equal(samples[0].wallMs, 20, 'report observations are detached');
});

test('assessment refuses an absent or invalid configured sample count', () => {
  for (const count of [undefined, null, 0, 4, 31, 7.5, NaN, Infinity, '7']) {
    assert.throws(() => assessReplaySamples(completeSamples(7), count), /sample count/i);
  }
});

test('child output failures remain scheduled failed observations and cannot override host identity', async () => {
  const { parseReplaySample } = await import('../scripts/lib/stacked-replay-benchmark.mjs');
  const fixture = { expectedTuple: { ticks: 432_000 }, evidence: { bytes: 432_028, sha256: 'a'.repeat(64) } };
  const scheduled = { index: 3, phase: 'replay', fixture };
  const output = { phase: 'replay', ok: true, wallMs: 120, cpuMs: 100, cpuClock: 'thread', memoryDelta: { rss: 0, heapTotal: 0, heapUsed: -1, external: 0, arrayBuffers: 0 }, environment: { node: 'v24.17.0', platform: 'win32', arch: 'x64', cpu: 'test CPU', logicalCpus: 4, totalMemoryBytes: 1000 }, ticks: 432_000, evidenceBytes: 432_028, evidenceSha256: fixture.evidence.sha256, scope: 'headless replay', exclusions: ['module imports'] };
  const child = stdout => ({ status: 0, stdout, stderr: '' });
  const valid = parseReplaySample(child(JSON.stringify(output)), scheduled);
  assert.deepEqual(valid, { ...output, index: 3 });
  const invalid = [
    ['malformed JSON', child('not JSON')],
    ['empty stdout', child('')],
    ['null output', child('null')],
    ['array output', child('[]')],
    ['wrong child phase', child(JSON.stringify({ ...output, phase: 'verify' }))],
    ['forged child index', child(JSON.stringify({ ...output, index: 0 }))],
    ['wrong ticks', child(JSON.stringify({ ...output, ticks: 60 }))],
    ['wrong evidence bytes', child(JSON.stringify({ ...output, evidenceBytes: 100 }))],
    ['wrong evidence hash', child(JSON.stringify({ ...output, evidenceSha256: 'b'.repeat(64) }))],
    ['missing CPU diagnostics', child(JSON.stringify({ ...output, cpuMs: undefined }))],
    ['invalid wall time', child(JSON.stringify({ ...output, wallMs: -1 }))],
    ['missing environment', child(JSON.stringify({ ...output, environment: undefined }))],
    ['missing scope', child(JSON.stringify({ ...output, scope: undefined }))],
    ['missing exclusions', child(JSON.stringify({ ...output, exclusions: undefined }))],
    ['failed result', child(JSON.stringify({ ...output, ok: false }))],
    ['failed child process', { ...child(JSON.stringify(output)), status: 1, stderr: 'assertion failed' }],
    ['spawn failure', { ...child(''), error: new Error('spawn failed') }],
  ];
  for (const [reason, processResult] of invalid) {
    const observation = parseReplaySample(processResult, scheduled);
    assert.equal(observation.ok, false, reason);
    assert.equal(observation.index, 3, reason);
    assert.equal(observation.phase, 'replay', reason);
    assert.equal(observation.wallMs, null, reason);
    assert.equal(typeof observation.error, 'string', reason);
    assert.ok(observation.error.length > 0 && observation.error.length <= 1600, reason);
  }
  const sampleBatch = completeSamples(7);
  sampleBatch[10] = parseReplaySample(child('not JSON'), scheduled);
  const assessment = assessReplaySamples(sampleBatch, 7);
  assert.equal(assessment.complete, true, 'failed scheduled sample still fills its slot');
  assert.equal(assessment.passed, false);
  assert.equal(assessment.samples[10].error, sampleBatch[10].error, 'failed diagnostics survive report assessment');
});
