import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as gate from '../scripts/stacked-sim-purity-check.mjs';

const sources = {
  'stacked-sim.mjs': 'import { seed } from "./seeded-rng.mjs"; import { scale } from "./stacked-contracts.mjs"; export const tick = seed + scale;',
  'seeded-rng.mjs': 'export const seed = 1;',
  'stacked-contracts.mjs': 'export const scale = 65536;',
};
async function inspect(overrides = {}) {
  assert.equal(typeof gate.auditStackedPurity, 'function', 'gate must expose the testable AST/import-graph audit');
  const root = await mkdtemp(join(tmpdir(), 'stacked-purity-'));
  try {
    for (const [name, source] of Object.entries({ ...sources, ...overrides })) {
      const path = join(root, 'apps/portal/src', name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, source);
    }
    return await gate.auditStackedPurity(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('purity audit accepts current canonical graph and reports all three audited modules', async () => {
  assert.equal(typeof gate.auditStackedPurity, 'function');
  const result = await gate.auditStackedPurity();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.files.length, 3);
});
test('comments, JSDoc, strings and non-reference property keys do not create impurity', async () => {
  const result = await inspect({ 'stacked-sim.mjs': sources['stacked-sim.mjs'] + '\n/** performance documented Date **/\nconst words = "window document Math.random **"; const data = { document: 1 };' });
  assert.equal(result.ok, true, JSON.stringify(result));
});
test('deterministic Reflect.ownKeys validation remains allowed, unlike arbitrary reflection', async () => {
  const result = await inspect({ 'stacked-sim.mjs': sources['stacked-sim.mjs'] + '\nexport const ownCount = value => Reflect.ownKeys(value).length;' });
  assert.equal(result.ok, true, JSON.stringify(result));
});
for (const expression of [
  'Date.now()', 'performance.now()', 'Math.random()', "Math['ran' + 'dom']()",
  "globalThis['Da' + 'te'].now()", 'process.hrtime()', 'crypto.randomUUID()',
  'new Intl.Collator()', 'Reflect.apply(() => 1, null, [])', '[2, 1].sort()',
  '2 ** 10', '(1).toFixed(2)', '(1).toLocaleString()',
  'Function("return 1")()', '(() => {}).constructor("return 1")()',
]) {
  test(`AST audit rejects prohibited ambient/numeric operation: ${expression}`, async () => {
    const result = await inspect({ 'stacked-sim.mjs': `export const forbidden = ${expression};` });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.ok(result.errors.length > 0);
  });
}
for (const source of ['const M = Math; export const value = M.random();', 'const { random: r } = Math; export const value = r();', 'Math.floor = () => 1;']) {
  test(`AST audit rejects builtin alias or mutation: ${source}`, async () => {
    assert.equal((await inspect({ 'stacked-sim.mjs': source })).ok, false);
  });
}
for (const file of ['seeded-rng.mjs', 'stacked-contracts.mjs']) {
  test(`purity audit does not exempt the imported ${file}`, async () => {
    assert.equal((await inspect({ [file]: 'export const value = Date.now();' })).ok, false);
  });
}
for (const source of [
  'import "./nested/seeded-rng.mjs";', 'import "./%73eeded-rng.mjs";',
  'import "./seeded-rng.mjs?other-instance";', 'export * from "node:crypto";',
  'await import("./seeded-rng.mjs");', 'const target = "./seeded-rng.mjs"; await import(target);',
  'export const value = require("node:crypto");',
]) {
  test(`purity audit rejects an unapproved module edge: ${source}`, async () => {
    const result = await inspect({ 'stacked-sim.mjs': source, 'nested/seeded-rng.mjs': 'export const value = 1;' });
    assert.equal(result.ok, false, JSON.stringify(result));
  });
}
test('transitive imports cannot smuggle a new helper through the trusted RNG module', async () => {
  const result = await inspect({ 'seeded-rng.mjs': 'import "./clock.mjs"; export const seed = 1;', 'clock.mjs': 'export const value = Date.now();' });
  assert.equal(result.ok, false, JSON.stringify(result));
});
test('a parse failure fails closed rather than skipping the module', async () => {
  assert.equal((await inspect({ 'stacked-sim.mjs': 'export const broken = ;' })).ok, false);
});

for (const source of [
  'const { constructor: F } = (() => {}); export const value = F("return Date.now()")();',
  'const { ["con" + "structor"]: F } = (() => {}); export const value = F("return Date.now()")();',
  'const values = [2, 1]; const { sort: order } = values; order.call(values);',
  'const { toFixed: format } = 1; export const value = format.call(1, 2);',
  'const A = Array; A.prototype.auditBypass = 1;',
  'const O = Object; O.prototype.auditBypass = 1;',
  'const P = Object.prototype; P.auditBypass = 1;',
  'export const location = import.meta.url;',
]) {
  test(`review counterexample cannot escape purity policy: ${source}`, async () => {
    const result = await inspect({ 'stacked-sim.mjs': source });
    assert.equal(result.ok, false, JSON.stringify(result));
  });
}
