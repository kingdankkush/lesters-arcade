import { parentPort, workerData } from 'node:worker_threads';
import assert from 'node:assert/strict';

// All hooks live in this isolated worker. The transport and its dependencies
// finish importing before observations start. Native atob/btoa stay untouched.
const { decodeStackedBase64 } = await import(workerData.transportUrl);
const NativeBytes = globalThis.Uint8Array;
const nativeIteratorDescriptor = Object.getOwnPropertyDescriptor(String.prototype, Symbol.iterator);
const nativeBytesDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array');
const expected = new NativeBytes(32_768);
let binary = '';
for (let index = 0; index < expected.length; index += 1) {
  expected[index] = index & 255; binary += String.fromCharCode(expected[index]);
}
const text = btoa(binary);
let active = null;
function observe(operation) {
  const counters = { iteratorCalls: 0, iteratorYields: 0, typedByteAllocations: [] };
  active = counters;
  try { return { value: operation(), counters }; } finally { active = null; }
}
let outcome;
try {
  Object.defineProperty(String.prototype, Symbol.iterator, {
    ...nativeIteratorDescriptor,
    value: function () {
      if (active) active.iteratorCalls += 1;
      const iterator = Reflect.apply(nativeIteratorDescriptor.value, this, []);
      return {
        next(...args) {
          const item = Reflect.apply(iterator.next, iterator, args);
          if (active && !item.done) active.iteratorYields += 1;
          return item;
        },
        [Symbol.iterator]() { return this; },
      };
    },
  });
  Object.defineProperty(globalThis, 'Uint8Array', {
    ...nativeBytesDescriptor,
    value: new Proxy(NativeBytes, {
      construct(target, args) {
        const result = Reflect.construct(target, args, target);
        if (active) active.typedByteAllocations.push(result.byteLength);
        return result;
      },
    }),
  });
  const native = observe(() => btoa(atob(text)));
  assert.equal(native.value, text, 'unchanged native canonical round trip');
  const decoded = observe(() => decodeStackedBase64(text, expected.length));
  assert.deepEqual(decoded.value, expected, 'real transport preserves all Latin-1 bytes');
  const empty = observe(() => decodeStackedBase64('', 0));
  assert.equal(empty.value.byteLength, 0);
  const rejected = observe(() => {
    assert.throws(() => decodeStackedBase64('AB==', 1), /noncanonical base64 payload/);
    assert.throws(() => decodeStackedBase64('AAAA', 2), /noncanonical base64 payload/);
  });
  outcome = { native: native.counters, decoded: decoded.counters, empty: empty.counters, rejected: rejected.counters, rawBytes: expected.length };
} finally {
  Object.defineProperty(String.prototype, Symbol.iterator, nativeIteratorDescriptor);
  Object.defineProperty(globalThis, 'Uint8Array', nativeBytesDescriptor);
}
assert.deepEqual(Object.getOwnPropertyDescriptor(String.prototype, Symbol.iterator), nativeIteratorDescriptor);
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array'), nativeBytesDescriptor);
parentPort.postMessage({ ...outcome, restored: true });
