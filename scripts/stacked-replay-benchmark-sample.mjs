// One first-use operation in a fresh Node process. No warm-up or timing retries.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cpus, totalmem } from 'node:os';
import { replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';
import { decodeStackedEvidence, verifyStackedRun } from '../server/verify/stacked.mjs';
import { loadMaximalFixture, assertVerifiedFixture, STACKED_BENCHMARK_PHASES } from './lib/stacked-replay-benchmark.mjs';

const phase = process.argv[2];
if (!STACKED_BENCHMARK_PHASES.includes(phase)) throw new Error('invalid benchmark phase');
const { fixture, bytes, evidence } = loadMaximalFixture();
const beforeMemory = process.memoryUsage();
const cpuStart = typeof process.threadCpuUsage === 'function' ? process.threadCpuUsage() : process.cpuUsage();
const start = performance.now();
let result;
if (phase === 'decode') result = decodeStackedEvidence(evidence);
else if (phase === 'replay') result = replayStackedRun(bytes, fixture.replayOptions);
else result = await verifyStackedRun({ identity: fixture.identity, evidence, nowMs: fixture.verifyAtMs });
const wallMs = performance.now() - start;
const used = typeof process.threadCpuUsage === 'function' ? process.threadCpuUsage(cpuStart) : process.cpuUsage(cpuStart);
const afterMemory = process.memoryUsage();
if (phase === 'decode') { assert.equal(result.ok, true); assert.deepEqual(Buffer.from(result.bytes), bytes); }
else if (phase === 'replay') assert.deepEqual(result, fixture.expectedTuple);
else assertVerifiedFixture(result, fixture, evidence);
process.stdout.write(JSON.stringify({ phase, ok: true, wallMs, cpuMs: (used.user + used.system) / 1000, cpuClock: typeof process.threadCpuUsage === 'function' ? 'thread' : 'process', memoryDelta: Object.fromEntries(Object.keys(beforeMemory).map(key => [key, afterMemory[key] - beforeMemory[key]])), environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model ?? null, logicalCpus: cpus().length, totalMemoryBytes: totalmem() }, ticks: fixture.expectedTuple.ticks, evidenceBytes: bytes.length, evidenceSha256: fixture.evidence.sha256, scope: phase === 'decode' ? 'actual server base64/header decode; private SIC1 parse included in replay' : phase === 'verify' ? 'complete per-game verifier; authentication, paid-entry, API, network and settlement excluded' : 'SIC1 parse + headless replay + terminal tuple/hash', exclusions: ['process startup', 'module imports', 'fixture disk read/decompression', 'expected-result assertions'] }) + '\n');
