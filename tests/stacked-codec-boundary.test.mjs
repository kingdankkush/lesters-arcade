import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalSic1ByteBound, makeMaximalCodecBoundary } from '../scripts/lib/stacked-codec-boundary.mjs';
import { decodeSic1, encodeSic1, replayStackedRun, sic1TransitionByteLength } from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS, STACKED_MAX_EVIDENCE_BYTES } from '../apps/portal/src/stacked-contracts.mjs';
import { decodeStackedEvidence, verifyStackedRun } from '../server/verify/stacked.mjs';

test('canonical byte bound includes the real header/terminator and rejects invalid tick counts', () => {
  for (const [ticks, bytes] of [[0,26],[1,29],[127,407],[128,411],[16383,49176],[16384,49180],[432000,1296028]]) {
    assert.equal(canonicalSic1ByteBound(ticks), bytes);
  }
  for (const ticks of [-1, .5, NaN, Infinity, STACKED_MAX_TICKS + 1, '1', null]) assert.throws(() => canonicalSic1ByteBound(ticks));
});

test('every possible legal gap fits a three-bytes-per-consumed-tick upper bound', () => {
  for (let gap = 1; gap <= STACKED_MAX_TICKS; gap += 1) {
    assert.ok(sic1TransitionByteLength(0, 1, gap) <= 3 * gap, `compact/single gap ${gap}`);
    assert.ok(sic1TransitionByteLength(0, 3, gap) <= 3 * gap, `escape/multibit gap ${gap}`);
  }
  // Partitioned gaps and unused trailing ticks can only decrease this total.
  assert.ok(canonicalSic1ByteBound(STACKED_MAX_TICKS) < STACKED_MAX_EVIDENCE_BYTES);
});

test('the public encoder/decoder attain the bound, including varint-width boundaries', () => {
  for (const totalTicks of [0,1,16,127,128,16383,16384]) {
    const transitions = Array.from({ length: totalTicks }, (_, index) => ({ tick:index+1, mask:index%2===0?3:0 }));
    const bytes = encodeSic1({ seed:7, totalTicks, transitions });
    assert.equal(bytes.length, canonicalSic1ByteBound(totalTicks));
    assert.deepEqual(decodeSic1(bytes).transitions, transitions);
  }
});

test('maximum codec sentinel is hash-stable canonical input, not a surviving game or an accepted score', async () => {
  const sentinel = makeMaximalCodecBoundary();
  assert.equal(sentinel.kind, 'canonical-codec-boundary-not-surviving-run');
  assert.equal(sentinel.bytes.length, 1296028);
  assert.equal(sentinel.sha256, createHash('sha256').update(sentinel.bytes).digest('hex'));
  assert.equal(sentinel.evidence.sic1, Buffer.from(sentinel.bytes).toString('base64'));
  const decoded = decodeStackedEvidence(sentinel.evidence);
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.bytes, sentinel.bytes);
  const parsed = decodeSic1(sentinel.bytes);
  assert.equal(parsed.totalTicks, 432000);
  assert.equal(parsed.transitionCount, 432000);
  assert.equal(parsed.transitions[0].mask, 3);
  assert.equal(parsed.transitions.at(-1).mask, 0);
  assert.throws(() => replayStackedRun(sentinel.bytes, { expectedSeed:sentinel.seed }), /cannot step terminal STACKED runtime/);
  const actual = await verifyStackedRun({ identity: { seed:sentinel.seed, buildHash:'boundary-test', seasonId:'boundary-test' }, evidence:sentinel.evidence, nowMs:0 });
  assert.equal(actual.ok, false);
  assert.equal(actual.error, 'replay-rejected');
  assert.equal(actual.status, 422);
  assert.equal(actual.detail, 'cannot step terminal STACKED runtime');
  assert.equal(Object.hasOwn(actual, 'score'), false);
});
