import assert from 'node:assert/strict';
import test from 'node:test';

import { clamp, finite, freezeDeep } from '../apps/hmh-reboot/src/value-guards.mjs';

test('freezeDeep recursively freezes nested arrays and objects while preserving identity', () => {
  const value = { nested: [{ count: 1 }], nullable: null, scalar: 3 };
  const result = freezeDeep(value);
  assert.equal(result, value);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.nested), true);
  assert.equal(Object.isFrozen(value.nested[0]), true);
  assert.equal(freezeDeep(value), value);
  assert.equal(freezeDeep(null), null);
  assert.equal(freezeDeep(3), 3);
});

test('finite preserves finite values and rejects non-finite input with the named field', () => {
  assert.equal(finite(-12.5, 'speed'), -12.5);
  assert.throws(() => finite(Number.POSITIVE_INFINITY, 'speed'), /speed must be finite/);
});

test('clamp preserves in-range values and bounds both sides', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(12, 0, 10), 10);
});
