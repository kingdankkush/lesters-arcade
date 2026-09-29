// Deliberate fixture-authoring command, never imported by tests or release gates.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { createStackedRuntime, createStackedInputRecorder, replayStackedRun, stackedRuntimeStateBytes } from '../apps/portal/src/stacked-sim.mjs';
import { createStackedSoakPilot } from '../apps/stacked/src/dev/soak-pilot.mjs';
import { createCanonicalSessionIdentity } from '../apps/portal/src/session-integrity.mjs';
import { verifyStackedRun } from '../server/verify/stacked.mjs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const fixtureUrl = new URL('tests/fixtures/stacked-maximal-run.json', root);
const bytesUrl = new URL('tests/fixtures/stacked-maximal-run.sic1.gz', root);
if (existsSync(fixtureUrl) || existsSync(bytesUrl)) throw new Error('refusing to overwrite the durable maximal fixture');
const prior = JSON.parse(readFileSync(new URL('tests/fixtures/ranked/stacked-15min.json', root), 'utf8'));
const identity = await createCanonicalSessionIdentity(prior.body.identity);
const config = { startLevel: 1, buildHash: identity.buildHash, seasonId: identity.seasonId };
const replayOptions = { expectedSeed: identity.seed, maxTicks: 432_000, config };
const runtime = createStackedRuntime({ seed: identity.seed, maxTicks: replayOptions.maxTicks, config });
const recorder = createStackedInputRecorder({ seed: identity.seed });
const pilot = createStackedSoakPilot({ mode: 'free' });
const checkpointTicks = new Set([0, 10_800, 25_200, 43_200, 64_800, 90_000, 144_000, 216_000, 324_000, 432_000]);
const checkpoints = [];
const capture = () => checkpoints.push({ tick: runtime.snapshot().tick, snapshot: runtime.snapshot(), stateHash: runtime.stateHash(), stateBytesBase64: Buffer.from(stackedRuntimeStateBytes(runtime)).toString('base64') });
capture();
const start = performance.now();
while (!runtime.terminal) {
  const state = runtime.snapshot();
  const mask = pilot.sample(state);
  recorder.sample(recorder.tick + 1, mask);
  runtime.step(recorder.commit());
  const tick = recorder.tick;
  if (checkpointTicks.has(tick)) capture();
  if (tick % 10_800 === 0) process.stdout.write(JSON.stringify({ tick, targetTicks: 432_000, elapsedSeconds: (performance.now() - start) / 1000 }) + '\n');
}
const expectedTuple = runtime.result();
assert.equal(expectedTuple.ticks, 432_000, `pilot ended early: ${expectedTuple.terminalReason}`);
assert.equal(expectedTuple.terminalReason, 'tick-ceiling');
const bytes = recorder.encode();
assert.deepEqual(replayStackedRun(bytes, replayOptions), expectedTuple);
const verified = await verifyStackedRun({ identity, evidence: { encoding: 'stacked-sic1+base64', sic1: Buffer.from(bytes).toString('base64'), startLevel: 1 }, nowMs: prior.verifyAtMs });
assert.equal(verified.ok, true, JSON.stringify(verified));
const { text, ...evidenceMetadata } = verified.evidence;
const compressed = gzipSync(bytes, { level: 9 });
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceHashes = Object.fromEntries(['apps/portal/src/stacked-sim.mjs', 'apps/portal/src/stacked-contracts.mjs', 'apps/portal/src/seeded-rng.mjs', 'apps/stacked/src/dev/soak-pilot.mjs', 'scripts/generate-stacked-maximal-fixture.mjs'].map(path => [path, hash(readFileSync(new URL(path, root)))]));
const fixture = {
  v: 'stacked-maximal-fixture-v1',
  provenance: { generatedAt: new Date().toISOString(), node: process.version, method: 'Existing Free-only bounded-lookahead pilot sampled the actual runtime continuously to its unchanged tick ceiling; no reset, reseed, board edit, tick skipping or rule override.', humanRun: false, historicalEvidenceRecovered: false, historicalEvidenceSha256: '3e64933b39da1680fcae9568815109e4bc522be059bce4ab2fd14096d00707d5', sourceHashes },
  identity, verifyAtMs: prior.verifyAtMs, replayOptions,
  evidence: { file: 'stacked-maximal-run.sic1.gz', compression: 'gzip', bytes: bytes.length, sha256: hash(bytes), compressedBytes: compressed.length, compressedSha256: hash(compressed) },
  expectedTuple, checkpoints,
  expectedVerified: { ...verified, evidence: evidenceMetadata },
};
writeFileSync(bytesUrl, compressed, { flag: 'wx' });
writeFileSync(fixtureUrl, JSON.stringify(fixture, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ generated: true, ticks: expectedTuple.ticks, score: expectedTuple.score, evidenceBytes: bytes.length, compressedBytes: compressed.length, evidenceSha256: fixture.evidence.sha256, elapsedSeconds: (performance.now() - start) / 1000 }) + '\n');
