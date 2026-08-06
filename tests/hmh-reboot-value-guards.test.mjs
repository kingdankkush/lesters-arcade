import assert from 'node:assert/strict';
import test from 'node:test';

import { freezeDeep } from '../apps/hmh-reboot/src/value-guards.mjs';

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
