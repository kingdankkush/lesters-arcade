import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
const witness = await import('../scripts/lib/hmh-actor-authority-snapshot.mjs').catch(() => ({}));
const injection = await import('../scripts/lib/hmh-actor-authority-injection.mjs').catch(() => ({}));
const hash = value => createHash('sha256').update(value).digest('hex');

test('the detached witness preserves Map/Set contents, order, aliases and exact float bits', () => {
  assert.equal(typeof witness.serializeAuthority, 'function');
  const shared = { x: -0 }, source = { population: new Map([['a', shared], ['b', 1]]), seen: new Set(['b', 'a']), alias: shared, infinity: Infinity, bytes: new Float32Array([1, -0]) };
  const first = witness.serializeAuthority(source);
  // Independent literal assertions: plain JSON would erase every Map/Set,
  // turn -0 into0 and Infinity into null, and cannot encode shared identity.
  assert.match(first, /"map"/); assert.match(first, /"set"/); assert.match(first, /8000000000000000/); assert.match(first, /7ff0000000000000/); assert.match(first, /"ref"/);
  assert.ok(first.indexOf('"b"') < first.lastIndexOf('"a"'), 'Set insertion order is retained');
  source.population.get('a').x = 2; source.seen.add('c'); source.bytes[0] = 3;
  assert.notEqual(hash(first), hash(witness.serializeAuthority(source)));
  assert.match(first, /8000000000000000/, 'the prior capture cannot follow a source mutation');
});

test('an independent structural witness changes for Map values, Set membership and numeric bit changes', () => {
  assert.equal(typeof witness.serializeAuthority, 'function');
  const structural = value => value instanceof Map ? ['entries', [...value].map(([k,v]) => [structural(k), structural(v)])]
    : value instanceof Set ? ['members', [...value].map(structural)] : Array.isArray(value) ? value.map(structural)
      : value && typeof value === 'object' ? Object.entries(value).map(([key,child]) => [key, structural(child)])
        : typeof value === 'number' ? [value, Object.is(value, -0)] : value;
  const samples = [{ a: new Map([['id', 1]]), b: new Set(['x']), c: -0 }, { a: new Map([['id', 2]]), b: new Set(['x']), c: -0 },
    { a: new Map([['id', 1]]), b: new Set(['y']), c: -0 }, { a: new Map([['id', 1]]), b: new Set(['x']), c: 0 }];
  assert.equal(new Set(samples.map(s => hash(witness.serializeAuthority(s)))).size, samples.length);
  assert.equal(new Set(samples.map(s => hash(JSON.stringify(structural(s))))).size, samples.length);
});

test('required authority coverage rejects absent fields and unclassified callable state', () => {
  assert.equal(typeof witness.requireAuthorityFields, 'function');
  const fields = ['simulation', 'input', 'enemyPopulation', 'runSummaryAccumulator'];
  const state = Object.fromEntries(fields.map(key => [key, null]));
  assert.doesNotThrow(() => witness.requireAuthorityFields(state, fields));
  delete state.input; assert.throws(() => witness.requireAuthorityFields(state, fields), /input/);
  assert.throws(() => witness.serializeAuthority({ hidden: () => 9 }), /callback/);
  assert.throws(() => witness.serializeAuthority({ get sneaky() { throw new Error('must never invoke'); } }), /accessor/);
});

test('AST inventory automatically captures newly added boot/module data and exposes scoped omissions', () => {
  assert.equal(typeof injection.inventoryAuthorityBindings, 'function');
  const source = 'let moduleData = new Map(); const immutable = 4; async function boot() { let simulation = null; const input = {}; let enemyPopulation = null; let runSummaryAccumulator = null; const freshState = new Set(); const callback = () => 1; const actor3dPilot = {}; }';
  const inventory = injection.inventoryAuthorityBindings(source);
  for (const name of ['moduleData','immutable','simulation','input','enemyPopulation','runSummaryAccumulator','freshState']) assert.ok(inventory.captured.includes(name), name);
  assert.equal(inventory.captured.includes('actor3dPilot'), false);
  assert.ok(inventory.omitted.some(row => row.name === 'actor3dPilot' && row.reason.includes('presentation')));
  assert.ok(inventory.omitted.some(row => row.name === 'callback' && row.reason.includes('callback')));
});

test('test-only injection registers detached read/evidence accessors without altering any existing statement', () => {
  assert.equal(typeof injection.injectAuthorityProbe, 'function');
  const source = 'async function boot() { let simulation = null; let input = null; let enemyPopulation = null; let runSummaryAccumulator = null; keepExistingStatement(); }';
  const result = injection.injectAuthorityProbe(source);
  assert.ok(result.source.includes('keepExistingStatement();'));
  assert.ok(result.source.includes('__actor3dAuthority'));
  assert.ok(result.source.includes('structuredClone(runSummaryAccumulator)'));
  assert.equal(result.inventory.captured.includes('simulation'), true);
  assert.throws(() => injection.injectAuthorityProbe('const boot = () => {};'), /boot/);
});

test('inventory refuses an entry missing a core state binding and captures an uninitialized new field', () => {
  const complete = 'async function boot(){let simulation=null;let input=null;let enemyPopulation=null;let runSummaryAccumulator=null;let newState;}';
  const inventory = injection.inventoryAuthorityBindings(complete); assert.ok(inventory.captured.includes('newState'));
  for (const name of ['simulation','input','enemyPopulation','runSummaryAccumulator']) {
    assert.throws(() => injection.injectAuthorityProbe(complete.replace(`let ${name}=null;`, '')), new RegExp(name));
  }
});
