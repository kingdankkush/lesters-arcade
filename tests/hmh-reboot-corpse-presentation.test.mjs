import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('corpse source and test are registered with the host syntax gate', () => {
  const registry = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  for (const file of ['apps/hmh-reboot/src/corpse-presentation.mjs', 'tests/hmh-reboot-corpse-presentation.test.mjs']) assert.ok(registry.includes(JSON.stringify(file)), file);
});
const target = new URL('../apps/hmh-reboot/src/corpse-presentation.mjs', import.meta.url);
const policy = await import(target.href).catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('corpse-presentation.mjs')) return {};
  throw error;
});
test('corpse disappears at two seconds, including a stalled simulation', () => {
  assert.equal(typeof policy.createCorpseClock, 'function', 'the two-second corpse policy is not implemented');
  const corpse = policy.createCorpseClock(60, 1000);
  assert.equal(corpse.endTick, 180);
  assert.equal(policy.corpsePresentation(corpse, 179, 2999).expired, false);
  assert.equal(policy.corpsePresentation(corpse, 180, 2999).expired, true);
  assert.equal(policy.corpsePresentation(corpse, 61, 3000).expired, true);
  assert.equal(policy.corpsePresentation(corpse, 60, 1000).alpha, 1);
  assert.equal(policy.corpsePresentation(corpse, 60, 2900).alpha > 0, true);
  assert.equal(policy.corpsePresentation(corpse, 60, 2900).alpha < 1, true);
  assert.equal(policy.corpsePresentation(corpse, 60, 3000).alpha, 0);
});
test('corpse capacity disposes oldest graphics once and never exceeds its cap', () => {
  assert.equal(typeof policy.pruneCorpseCapacity, 'function', 'bounded corpse retention is not implemented');
  const map = new Map(); const removed = [];
  for (let id = 0; id < 100; id++) {
    policy.pruneCorpseCapacity(map, corpse => removed.push(corpse.id));
    map.set(id, { id });
    assert.ok(map.size <= policy.CORPSE_VISUAL_CAP);
  }
  assert.equal(map.size, policy.CORPSE_VISUAL_CAP);
  assert.equal(removed.length, 100 - policy.CORPSE_VISUAL_CAP);
  assert.equal(new Set(removed).size, removed.length);
  assert.deepEqual(removed, Array.from({length: removed.length}, (_, i) => i));
});
test('corpse clocks reject invalid time without changing simulation state', () => {
  assert.equal(typeof policy.createCorpseClock, 'function');
  assert.throws(() => policy.createCorpseClock(-1, 0), TypeError);
  assert.throws(() => policy.createCorpseClock(1.5, 0), TypeError);
  assert.throws(() => policy.createCorpseClock(0, NaN), TypeError);
  const corpse = policy.createCorpseClock(5, 100);
  const before = JSON.stringify(corpse);
  policy.corpsePresentation(corpse, 5, 110);
  assert.equal(JSON.stringify(corpse), before);
});
