import assert from 'node:assert/strict';
import test from 'node:test';
import { assertStackedJsBudget, deriveStackedJsBudgetCaps } from '../scripts/hmh-reboot-bundle-budget.mjs';

test('STACKED CSP-compatible renderer baseline derives 8-percent caps rounded up to 4096 bytes', () => {
  const measured = Object.freeze({ entryBytes: 14322, sharedChunkBytes: 2001, vendorBytes: 496615 });
  assert.deepEqual(deriveStackedJsBudgetCaps(measured), {
    entryCap: 16384,
    initialBytes: 512938,
    initialCap: 557056,
  });
  const result = assertStackedJsBudget(measured);
  assert.equal(result.entryCap, 16384);
  assert.equal(result.initialCap, 557056);
  assert.equal(result.initialBytes, 512938);
});

test('STACKED budgets enforce entry and complete initial graph independently', () => {
  assert.throws(
    () => assertStackedJsBudget({ entryBytes: 101, sharedChunkBytes: 0, vendorBytes: 1, entryCap: 100, initialCap: 200 }),
    /STACKED entry JS exceeds raw cap/u,
  );
  assert.throws(
    () => assertStackedJsBudget({ entryBytes: 80, sharedChunkBytes: 30, vendorBytes: 100, entryCap: 100, initialCap: 200 }),
    /STACKED initial JS including static graph exceeds raw cap/u,
  );
  const result = assertStackedJsBudget({ entryBytes: 80, sharedChunkBytes: 10, vendorBytes: 100, entryCap: 100, initialCap: 200 });
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result, {
    entryBytes: 80,
    entryCap: 100,
    initialBytes: 190,
    initialCap: 200,
    remainingEntry: 20,
    remainingInitial: 10,
    sharedChunkBytes: 10,
    vendorBytes: 100,
  });
});
