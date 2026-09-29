import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

export const STACKED_REPLAY_BUDGET_MS = 250;
export const STACKED_BENCHMARK_PHASES = Object.freeze(['decode', 'replay', 'verify']);
export const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateMaximalFixture(fixture, bytes) {
  if (fixture?.v !== 'stacked-maximal-fixture-v1' || fixture.expectedTuple?.ticks !== 432_000 || fixture.expectedTuple?.terminalReason !== 'tick-ceiling' || fixture.replayOptions?.maxTicks !== 432_000) throw new Error('fixture must cover the legal maximal ticks');
  if (!(bytes instanceof Uint8Array) || bytes.length !== fixture.evidence.bytes || hash(bytes) !== fixture.evidence.sha256) throw new Error('maximal fixture evidence hash mismatch');
  if (fixture.identity?.seed !== fixture.replayOptions.expectedSeed || fixture.expectedTuple.seed !== fixture.identity.seed) throw new Error('fixture seed mismatch');
  if (fixture.checkpoints?.[0]?.tick !== 0 || fixture.checkpoints?.at(-1)?.tick !== 432_000) throw new Error('fixture canonical checkpoints incomplete');
  return fixture;
}

export function loadMaximalFixture(root = sourceRoot) {
  const fixture = JSON.parse(readFileSync(join(root, 'tests/fixtures/stacked-maximal-run.json'), 'utf8'));
  // The filename is fixed, never read from untrusted fixture metadata.
  const compressed = readFileSync(join(root, 'tests/fixtures/stacked-maximal-run.sic1.gz'));
  if (compressed.length !== fixture.evidence.compressedBytes || hash(compressed) !== fixture.evidence.compressedSha256) throw new Error('maximal fixture compressed hash mismatch');
  const bytes = gunzipSync(compressed, { maxOutputLength: 1_302_000 });
  validateMaximalFixture(fixture, bytes);
  return { fixture, bytes, evidence: { encoding: 'stacked-sic1+base64', sic1: bytes.toString('base64'), startLevel: 1 } };
}

const quantile = (values, fraction) => values[Math.max(0, Math.ceil(values.length * fraction) - 1)];
export function assessReplaySamples(samples, expectedSamplesPerPhase) {
  if (!Number.isInteger(expectedSamplesPerPhase) || expectedSamplesPerPhase < 5 || expectedSamplesPerPhase > 30) throw new RangeError('expected sample count must be 5..30');
  if (!Array.isArray(samples)) throw new TypeError('samples must be an array');
  const phases = Object.fromEntries(STACKED_BENCHMARK_PHASES.map(phase => {
    const group = samples.filter(sample => sample?.phase === phase);
    const walls = group.map(sample => sample.wallMs).sort((a, b) => a - b);
    return [phase, { count: group.length, p50Ms: quantile(walls, .5) ?? null, p95Ms: quantile(walls, .95) ?? null, p99Ms: quantile(walls, .99) ?? null, maxMs: walls.at(-1) ?? null }];
  }));
  const valid = samples.length > 0 && samples.every(sample => sample && STACKED_BENCHMARK_PHASES.includes(sample.phase) && sample.ok === true && Number.isFinite(sample.wallMs) && sample.wallMs >= 0);
  // Keep every observation. A fast warmed result cannot hide a cold overrun.
  const complete = samples.length === STACKED_BENCHMARK_PHASES.length * expectedSamplesPerPhase && STACKED_BENCHMARK_PHASES.every(phase => {
    const group = samples.filter(sample => sample?.phase === phase);
    return group.length === expectedSamplesPerPhase && group.every(sample => Number.isInteger(sample.index) && sample.index >= 0 && sample.index < expectedSamplesPerPhase) && new Set(group.map(sample => sample.index)).size === expectedSamplesPerPhase;
  });
  const passed = valid && complete && samples.every(sample => sample.wallMs < STACKED_REPLAY_BUDGET_MS);
  return { budgetMs: STACKED_REPLAY_BUDGET_MS, expectedSamplesPerPhase, complete, passed, phases, samples: structuredClone(samples) };
}

// The host owns the scheduled slot. Broken child output is a failed observation,
// not an exception that prevents retaining the other samples and final report.
export function parseReplaySample(child, { index, phase, fixture }) {
  const fail = error => ({ index, phase, ok: false, wallMs: null, error: String(error?.message ?? error).slice(0, 1600) || 'invalid benchmark child output' });
  if (child.error || child.status !== 0) return fail(child.error ?? child.stderr ?? `child exited ${child.status}`);
  try {
    const sample = JSON.parse(child.stdout);
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const finiteTime = value => Number.isFinite(value) && value >= 0;
    const text = value => typeof value === 'string' && value.length > 0;
    if (!record(sample) || Object.hasOwn(sample, 'index') || sample.phase !== phase || sample.ok !== true) throw new Error('invalid benchmark child phase, identity or result');
    if (!finiteTime(sample.wallMs) || !finiteTime(sample.cpuMs) || !['thread', 'process'].includes(sample.cpuClock)) throw new Error('invalid benchmark child timing');
    if (sample.ticks !== fixture.expectedTuple.ticks || sample.evidenceBytes !== fixture.evidence.bytes || sample.evidenceSha256 !== fixture.evidence.sha256) throw new Error('benchmark child fixture identity mismatch');
    if (!record(sample.memoryDelta) || !['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers'].every(key => Number.isFinite(sample.memoryDelta[key]))) throw new Error('invalid benchmark child memory diagnostics');
    const environment = sample.environment;
    if (!record(environment) || !['node', 'platform', 'arch'].every(key => text(environment[key])) || !(environment.cpu === null || text(environment.cpu)) || !Number.isInteger(environment.logicalCpus) || environment.logicalCpus < 1 || !Number.isFinite(environment.totalMemoryBytes) || environment.totalMemoryBytes <= 0) throw new Error('invalid benchmark child environment');
    if (!text(sample.scope) || !Array.isArray(sample.exclusions) || sample.exclusions.length === 0 || !sample.exclusions.every(text)) throw new Error('invalid benchmark child measurement scope');
    return { ...sample, index, phase };
  } catch (error) { return fail(error); }
}

export function assertVerifiedFixture(actual, fixture, evidence) {
  assert.equal(actual.ok, true, 'per-game verifier rejected the legal maximal fixture');
  const { text, ...metadata } = actual.evidence;
  assert.equal(text, evidence.sic1, 'verifier must retain exact canonical evidence text');
  assert.deepEqual({ ...actual, evidence: metadata }, fixture.expectedVerified, 'complete per-game VerifiedRun must retain its canonical fields');
}

export function currentSourceHashes(root = sourceRoot) {
  return Object.fromEntries(['apps/portal/src/stacked-sim.mjs', 'apps/portal/src/stacked-contracts.mjs', 'apps/portal/src/seeded-rng.mjs', 'server/verify/stacked.mjs', 'server/verify/verified-run.mjs', 'apps/portal/src/stacked-evidence-transport.mjs'].map(path => [path, hash(readFileSync(join(root, path)))]));
}

export async function withReplayHeavyLock(job, { lockPath = resolve(sourceRoot, '../.locks/heavy.lock') } = {}) {
  const lock = resolve(lockPath), ownerPath = join(lock, 'owner.json'), token = randomUUID();
  mkdirSync(dirname(lock), { recursive: true });
  mkdirSync(lock); // Atomic, no recursive flag: fail instead of taking another job's lock.
  try {
    writeFileSync(ownerPath, JSON.stringify({ owner: 'stacked-replay-benchmark', token, pid: process.pid, startedAt: new Date().toISOString() }) + '\n', { flag: 'wx' });
    return await job();
  } finally {
    // Remove only this token's owner file and empty lock directory; never recurse.
    const owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
    if (owner.token !== token) throw new Error('heavy lock ownership changed; leaving it untouched');
    unlinkSync(ownerPath);
    rmdirSync(lock);
  }
}
