// Deliberate fixture-authoring command, never imported by tests or release gates.
//
// Records the worst *accepted* legal STACKED replay: every one of the 432,000
// legal ticks carries a distinct multi-bit control change, so every SIC1
// transition takes its three-byte escape form and the encoding attains the
// canonical byte bound (1,296,028 bytes) while the run still survives to the
// tick ceiling with a real score.
//
// Construction (all parameters are recorded in the manifest):
// - Route bits (moveLeft, moveRight, hardDrop, rotateCW/CCW/180) come from the
//   unchanged Free-only soak pilot sampling the actual runtime snapshot. The
//   pilot is shown the piece it will really play next (the held piece), because
//   under the swap protocol below every spawned piece is exchanged with hold.
// - The hold bit toggles on every tick. After each lock the first hold rising
//   edge swaps the fresh piece for the held one; from then until the next lock
//   holdUsed is true, so every later hold edge is inert.
// - When the tick after a lock cannot be the swap tick (the hold bit is falling,
//   or nothing else would change), softDrop and rotate180 are applied to the
//   piece that is about to be swapped away. Those controls act only on that
//   transient piece; the runtime still steps once per tick with real inputs.
// - Every consecutive mask pair therefore differs in at least two bits, so every
//   SIC1 transition takes its three-byte escape form.
// No reset, reseed, board edit, tick skipping, rule override or padding.
//
// Usage:
//   node scripts/generate-stacked-longest-legal-fixture.mjs --prefix=64800   # survival probe, writes nothing
//   node scripts/generate-stacked-longest-legal-fixture.mjs                  # full run, writes the durable fixture
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { createStackedRuntime, createStackedInputRecorder, decodeSic1, replayStackedRun, stackedRuntimeStateBytes } from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS, STACKED_MAX_EVIDENCE_BYTES, STACKED_ACTIONS } from '../apps/portal/src/stacked-contracts.mjs';
import { createStackedSoakPilot } from '../apps/stacked/src/dev/soak-pilot.mjs';
import { createCanonicalSessionIdentity } from '../apps/portal/src/session-integrity.mjs';
import { verifyStackedRun } from '../server/verify/stacked.mjs';
import { canonicalSic1ByteBound } from './lib/stacked-codec-boundary.mjs';

const args = process.argv.slice(2);
for (const arg of args) if (!/^--prefix=\d+$/.test(arg)) throw new Error(`unknown argument: ${arg}`);
const prefixArg = args.find(arg => arg.startsWith('--prefix='));
const prefixTicks = prefixArg ? Number(prefixArg.slice('--prefix='.length)) : null;
if (prefixTicks !== null && (!Number.isInteger(prefixTicks) || prefixTicks < 1 || prefixTicks > STACKED_MAX_TICKS)) throw new RangeError('prefix must be 1..432000');

const root = new URL('../', import.meta.url);
const fixtureDir = new URL('tests/fixtures/stacked/', root);
const fixtureUrl = new URL('stacked-longest-legal-run.json', fixtureDir);
const bytesUrl = new URL('stacked-longest-legal-run.sic1.gz', fixtureDir);
if (prefixTicks === null && (existsSync(fixtureUrl) || existsSync(bytesUrl))) throw new Error('refusing to overwrite the durable longest-legal fixture');

const ACTION = Object.fromEntries(STACKED_ACTIONS.map((name, index) => [name, 1 << index]));
export const LONGEST_LEGAL_GENERATOR = Object.freeze({
  v: 'stacked-longest-legal-generator-v2',
  routeBits: 255 & ~(ACTION.softDrop | ACTION.hold),      // 123: the pilot's real controls
  holdBit: ACTION.hold,                                   // 128: toggles every tick
  stallBits: ACTION.softDrop | ACTION.rotate180,          // 68: applied only to the piece about to be swapped away
  pilot: "createStackedSoakPilot({ mode: 'free' }) on the actual runtime snapshot; prevMask masked to routeBits, queue prefixed with the held piece",
  holdProtocol: 'after each lock, swap on the first tick where hold can rise with at least one other bit changing; otherwise stall one tick with softDrop|rotate180 on the doomed piece',
  minimumChangedBitsPerTick: 2,
});
const popcount = value => { let count = 0; for (let bits = value; bits !== 0; bits &= bits - 1) count += 1; return count; };

const prior = JSON.parse(readFileSync(new URL('tests/fixtures/ranked/stacked-15min.json', root), 'utf8'));
const identity = await createCanonicalSessionIdentity(prior.body.identity);
const config = { startLevel: 1, buildHash: identity.buildHash, seasonId: identity.seasonId };
const replayOptions = { expectedSeed: identity.seed, maxTicks: STACKED_MAX_TICKS, config };
const runtime = createStackedRuntime({ seed: identity.seed, maxTicks: replayOptions.maxTicks, config });
const recorder = createStackedInputRecorder({ seed: identity.seed });
const checkpointTicks = new Set([0, 10_800, 25_200, 43_200, 64_800, 90_000, 144_000, 216_000, 324_000, 432_000]);
const checkpoints = [];
const capture = () => checkpoints.push({ tick: runtime.snapshot().tick, snapshot: runtime.snapshot(), stateHash: runtime.stateHash(), stateBytesBase64: Buffer.from(stackedRuntimeStateBytes(runtime)).toString('base64') });
capture();

let pilot = null;          // null while a swap is pending; replaced after every swap
let previousMask = 0;
let holdSwaps = 0;
let routeTicks = 0;
let stallTicks = 0;
const maskHistogram = new Map();
const targetTicks = prefixTicks ?? STACKED_MAX_TICKS;
const { routeBits, holdBit, stallBits } = LONGEST_LEGAL_GENERATOR;
const start = performance.now();
while (!runtime.terminal && recorder.tick < targetTicks) {
  const state = runtime.snapshot();
  const tick = recorder.tick + 1;
  let mask;
  if (state.holdUsed) {
    // The active piece is the one being played; hold edges are inert until the next lock.
    if (pilot === null) pilot = createStackedSoakPilot({ mode: 'free' });
    const view = { ...state, prevMask: state.prevMask & routeBits, queue: state.hold === null ? state.queue : [state.hold, ...state.queue] };
    const route = pilot.sample(view);
    assert.equal(route & ~routeBits, 0, 'pilot route must not use carrier bits');
    if (route !== 0) routeTicks += 1;
    mask = route | ((previousMask & holdBit) ^ holdBit);
  } else {
    // A lock just happened (or this is tick 1): swap the fresh piece as soon as the
    // hold bit can rise together with at least one other changing bit.
    pilot = null;
    const swapMask = holdBit;
    if ((previousMask & holdBit) === 0 && popcount(swapMask ^ previousMask) >= 2) { mask = swapMask; holdSwaps += 1; }
    else if ((previousMask & holdBit) === 0) { mask = stallBits; stallTicks += 1; }
    else { mask = ACTION.rotate180; stallTicks += 1; }
  }
  assert.ok(popcount(mask ^ previousMask) >= LONGEST_LEGAL_GENERATOR.minimumChangedBitsPerTick, `tick ${tick}: ${previousMask} -> ${mask} is not a multi-bit change`);
  maskHistogram.set(mask, (maskHistogram.get(mask) ?? 0) + 1);
  recorder.sample(tick, mask);
  runtime.step(recorder.commit());
  previousMask = mask;
  if (checkpointTicks.has(recorder.tick)) capture();
  if (recorder.tick % 10_800 === 0) process.stdout.write(JSON.stringify({ tick: recorder.tick, targetTicks, level: runtime.snapshot().level, lines: runtime.snapshot().lines, score: runtime.snapshot().score, holdSwaps, stallTicks, elapsedSeconds: (performance.now() - start) / 1000 }) + '\n');
}
const snapshot = runtime.snapshot();
const bytes = recorder.encode();
const decoded = decodeSic1(bytes);
let decodedPrevious = 0, escapes = 0;
for (let index = 0; index < decoded.transitions.length; index += 1) {
  const { tick, mask } = decoded.transitions[index];
  if (tick === index + 1 && popcount(mask ^ decodedPrevious) >= 2) escapes += 1;
  decodedPrevious = mask;
}
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { ticks: recorder.tick, terminal: runtime.terminal, terminalReason: snapshot.terminalReason, level: snapshot.level, lines: snapshot.lines, score: snapshot.score, piecesLocked: snapshot.piecesLocked, holdSwaps, routeTicks, stallTicks, transitions: decoded.transitionCount, multiBitEscapesEveryTick: escapes, evidenceBytes: bytes.length, canonicalBound: canonicalSic1ByteBound(recorder.tick), evidenceSha256: hash(bytes), elapsedSeconds: (performance.now() - start) / 1000 };

if (prefixTicks !== null) {
  process.stdout.write(JSON.stringify({ prefix: true, survived: !runtime.terminal, ...report }) + '\n');
  if (runtime.terminal) process.exitCode = 1;
} else {
  const expectedTuple = runtime.result();
  assert.equal(expectedTuple?.ticks, STACKED_MAX_TICKS, `run ended early: ${snapshot.terminalReason}`);
  assert.equal(expectedTuple.terminalReason, 'tick-ceiling');
  assert.equal(decoded.transitionCount, STACKED_MAX_TICKS, 'one transition per tick');
  assert.equal(escapes, STACKED_MAX_TICKS, 'every tick must be a multi-bit escape');
  assert.equal(bytes.length, canonicalSic1ByteBound(STACKED_MAX_TICKS), 'evidence must attain the canonical byte bound');
  assert.ok(bytes.length < STACKED_MAX_EVIDENCE_BYTES);
  assert.deepEqual(replayStackedRun(bytes, replayOptions), expectedTuple);
  const evidence = { encoding: 'stacked-sic1+base64', sic1: Buffer.from(bytes).toString('base64'), startLevel: 1 };
  const verified = await verifyStackedRun({ identity, evidence, nowMs: prior.verifyAtMs });
  assert.equal(verified.ok, true, JSON.stringify(verified));
  assert.equal(verified.score, expectedTuple.score);
  const { text, ...evidenceMetadata } = verified.evidence;
  const compressed = gzipSync(bytes, { level: 9 });
  const sourceHashes = Object.fromEntries(['apps/portal/src/stacked-sim.mjs', 'apps/portal/src/stacked-contracts.mjs', 'apps/portal/src/seeded-rng.mjs', 'apps/stacked/src/dev/soak-pilot.mjs', 'server/verify/stacked.mjs', 'apps/portal/src/stacked-evidence-transport.mjs', 'scripts/lib/stacked-codec-boundary.mjs', 'scripts/generate-stacked-longest-legal-fixture.mjs'].map(path => [path, hash(readFileSync(new URL(path, root)))]));
  const fixture = {
    v: 'stacked-longest-legal-fixture-v1',
    provenance: {
      generatedAt: new Date().toISOString(), node: process.version,
      method: 'Unchanged Free-only pilot route bits OR a softDrop|hold carrier toggling every tick; the actual runtime was sampled and stepped once per tick to its unchanged ceiling. No reset, reseed, board edit, tick skipping, rule override or padded encoding.',
      generator: LONGEST_LEGAL_GENERATOR, humanRun: false, continuous: true, unchangedRuntimeMaxTicks: STACKED_MAX_TICKS,
      holdSwaps, routeTicks, stallTicks, multiBitEscapesEveryTick: escapes, maskHistogram: Object.fromEntries([...maskHistogram.entries()].sort((a, b) => a[0] - b[0])),
      sourceHashes,
    },
    identity, verifyAtMs: prior.verifyAtMs, replayOptions,
    evidence: { file: 'stacked-longest-legal-run.sic1.gz', compression: 'gzip', bytes: bytes.length, sha256: hash(bytes), compressedBytes: compressed.length, compressedSha256: hash(compressed), base64Chars: evidence.sic1.length, canonicalBound: canonicalSic1ByteBound(STACKED_MAX_TICKS), transportCap: STACKED_MAX_EVIDENCE_BYTES },
    expectedTuple, checkpoints,
    expectedVerified: { ...verified, evidence: evidenceMetadata },
  };
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(bytesUrl, compressed, { flag: 'wx' });
  writeFileSync(fixtureUrl, JSON.stringify(fixture, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ generated: true, ...report, compressedBytes: compressed.length, verifiedScore: verified.score }) + '\n');
}
