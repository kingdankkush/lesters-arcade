import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { decodeStackedBase64 } from '../apps/portal/src/stacked-evidence-transport.mjs';
import { STACKED_MAX_EVIDENCE_BYTES, STACKED_EVIDENCE_CHUNK_RAW_BYTES } from '../apps/portal/src/stacked-contracts.mjs';

// Fixed independent base64 golden for the ordered byte sequence 0..255.
const allByteGolden = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==';

function iterationWitness() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fixtures/stacked-transport-copy-iteration-worker.mjs', import.meta.url), {
      workerData: { transportUrl: new URL('../apps/portal/src/stacked-evidence-transport.mjs', import.meta.url).href },
      execArgv: [],
    });
    let result, failure, timedOut = false;
    // Hang protection only: never a microsecond performance acceptance budget.
    // Request termination once and settle after actual worker exit.
    const watchdog = setTimeout(() => {
      timedOut = true;
      worker.terminate().catch(error => { failure ??= error; });
    }, 15_000);
    worker.on('message', value => { result = value; });
    worker.on('error', error => { failure = error; });
    worker.on('exit', code => {
      clearTimeout(watchdog);
      if (timedOut) reject(new Error(`isolated transport observation exceeded its 15-second hang watchdog; actual worker exit ${code}${failure ? `: ${failure.message}` : ''}`));
      else if (failure || code !== 0 || !result) reject(failure ?? new Error(`isolated observation exited ${code} without result`));
      else resolve(result);
    });
  });
}

test('transport returns one owned bounded byte buffer without a per-byte string iterator detour', async () => {
  const seen = await iterationWitness();
  assert.equal(seen.restored, true);
  assert.deepEqual(seen.decoded.typedByteAllocations, [seen.rawBytes], 'one observed public typed-byte allocation at the decoded size');
  assert.deepEqual(seen.empty.typedByteAllocations, [0]);
  assert.deepEqual(seen.rejected.typedByteAllocations, [], 'canonical/length rejection precedes byte allocation');
  assert.equal(seen.decoded.iteratorYields, seen.native.iteratorYields, 'transport must not create per-byte string iterator results beyond the unchanged native canonical round trip');
  assert.equal(seen.decoded.iteratorCalls, seen.native.iteratorCalls);
  // This observes public allocation/iteration traffic, not total heap/peak or a timing threshold.
});

test('transport preserves every ordered byte value and returns detached fresh results', () => {
  const first = decodeStackedBase64(allByteGolden, 256);
  const second = decodeStackedBase64(allByteGolden, 256);
  assert.equal(first.length, 256);
  for (let index = 0; index < 256; index += 1) assert.equal(first[index], index);
  assert.notEqual(first.buffer, second.buffer);
  first.fill(0); assert.equal(second[255], 255);
  assert.equal(Buffer.from(second).toString('base64'), allByteGolden);
});

test('independent RFC vectors preserve empty, partial and complete triples', () => {
  for (const [text, expected] of [['', []], ['Zg==', [102]], ['Zm8=', [102, 111]], ['Zm9v', [102, 111, 111]], ['Zm9vYg==', [102, 111, 111, 98]], ['/w==', [255]], ['//8=', [255, 255]], ['////', [255, 255, 255]]]) {
    assert.deepEqual([...decodeStackedBase64(text, expected.length)], expected);
  }
});

test('raw/chunk caps preserve exact inclusive boundaries and zero-cap behavior', () => {
  assert.deepEqual(decodeStackedBase64('', 0), new Uint8Array());
  for (const cap of [1, 2, 3, STACKED_EVIDENCE_CHUNK_RAW_BYTES, STACKED_MAX_EVIDENCE_BYTES]) {
    const raw = Buffer.alloc(cap, 255); const text = raw.toString('base64');
    assert.deepEqual(Buffer.from(decodeStackedBase64(text, cap)), raw);
    assert.throws(() => decodeStackedBase64(text, cap - 1), /base64 payload invalid|noncanonical base64 payload/);
  }
  const chunk = Buffer.alloc(STACKED_EVIDENCE_CHUNK_RAW_BYTES, 0).toString('base64');
  assert.equal(decodeStackedBase64(chunk).length, STACKED_EVIDENCE_CHUNK_RAW_BYTES);
  assert.throws(() => decodeStackedBase64(Buffer.alloc(STACKED_EVIDENCE_CHUNK_RAW_BYTES + 1).toString('base64')), /base64 payload invalid|noncanonical base64 payload/);
  assert.throws(() => decodeStackedBase64('AA==', 0), /^Error: base64 payload invalid$/);
});

test('noncanonical padding bits retain native round-trip rejection semantics', () => {
  const oneByteUnusedBits = [...'BCDEFGHIJKLMNOP'].map(last => `A${last}==`);
  const twoByteUnusedBits = [...'BCD'].map(last => `AA${last}=`);
  for (const text of [...oneByteUnusedBits, ...twoByteUnusedBits, 'A/==', 'Zh==', '/x==', 'AA/=', 'Zm9=']) {
    assert.notEqual(btoa(atob(text)), text, 'native decoder accepts equivalent bytes but canonical text differs');
    assert.throws(() => decodeStackedBase64(text, 3), /^Error: noncanonical base64 payload$/);
  }
});

test('malformed text and cap types retain exact pre-decode rejection class/message', () => {
  for (const text of [null, undefined, 0, false, 1n, Symbol('text'), [], {}, new Uint8Array(), new String('AA=='), 'A', 'AA', 'AAA', 'A===', '=AAA', 'AAAA=', 'AA==AA==', ' AA==', 'AA==\n', 'AA==\r', 'AA==\t', 'AA-=', 'AA_=', 'éA==', '😀==', '\u0000AAA']) {
    assert.throws(() => decodeStackedBase64(text, 6), /^Error: base64 payload invalid$/);
  }
  for (const cap of [-1, 0.5, NaN, Infinity, '3', null, true, 3n, Symbol('cap'), {}, STACKED_MAX_EVIDENCE_BYTES + 1]) {
    assert.throws(() => decodeStackedBase64('AAAA', cap), /^Error: base64 payload invalid$/);
  }
});
