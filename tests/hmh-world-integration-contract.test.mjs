import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { selectRuntimePerformanceProfile } from '../apps/hmh-reboot/src/runtime-performance.mjs';

const root = new URL('../', import.meta.url);
const read = relative => readFileSync(new URL(relative, root), 'utf8');
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
};

const requiredJs = [
  'apps/hmh-reboot/src/world-depth.mjs',
  'apps/hmh-reboot/src/world-design-layout.mjs',
  'apps/hmh-reboot/src/world-design-native-assets.mjs',
  'apps/hmh-reboot/src/world-design-water.mjs',
  'scripts/hmh-world-design-production-asset-qa.mjs',
  'scripts/reconcile-world-design-adoption.mjs',
  'tests/hmh-world-depth.test.mjs',
  'tests/hmh-world-design-native.test.mjs',
  'tests/hmh-world-design-opening-clearance.test.mjs',
  'tests/hmh-world-design-placements.test.mjs',
  'tests/hmh-world-design-routes.test.mjs',
  'tests/hmh-world-design-water-bridges.test.mjs',
  'tests/hmh-world-integration-contract.test.mjs',
  'tests/hmh-world-render-lifecycle.test.mjs',
  'tests/hmh-world-native-provenance.test.mjs',
];
const requiredPython = [
  'scripts/hmh-blender/export-hmh-world-design.py',
  'scripts/hmh-world-design-published-image-qa.py',
  'scripts/pack-hmh-world-design.py',
];

test('the complete native-world code and test namespace is explicitly syntax-registered', () => {
  const syntax = parse(read('scripts/syntax-check.mjs'), { sourceType: 'module', ecmaVersion: 'latest' });
  const arrays = new Map();
  walk(syntax, node => {
    if (node.type === 'VariableDeclarator' && node.init?.type === 'ArrayExpression') {
      arrays.set(node.id.name, new Set(node.init.elements.map(value => value.value)));
    }
  });
  for (const [registry, files] of [['NODE_CHECK_FILES', requiredJs], ['PY_COMPILE_FILES', requiredPython]]) {
    assert.ok(arrays.has(registry), registry);
    for (const relative of files) {
      assert.ok(statSync(new URL(relative, root)).isFile(), `${relative} must exist as a file`);
      assert.ok(arrays.get(registry).has(relative), `${relative} missing from ${registry}`);
    }
  }
});

const scenarios = [
  { name: 'portrait touch', width: 390, coarsePointer: true, reduceMotion: false, mobile: true },
  { name: 'fresh landscape touch', width: 844, coarsePointer: true, reduceMotion: false, mobile: true },
  { name: 'reduced-motion profile', width: 1440, coarsePointer: false, reduceMotion: true, mobile: true },
  { name: 'desktop profile', width: 1440, coarsePointer: false, reduceMotion: false, mobile: false },
];
for (const scenario of scenarios) test(`world atlas tier follows the canonical ${scenario.name}`, () => {
  const source = read('apps/hmh-reboot/src/main.mjs');
  const ast = parse(source, { sourceType: 'module', ecmaVersion: 'latest' });
  const calls = [];
  walk(ast, node => { if (node.type === 'CallExpression' && node.callee.name === 'loadWorldDesignAppearance') calls.push(node); });
  assert.equal(calls.length, 1);
  const mobile = calls[0].arguments[1].properties.find(property => property.key.name === 'mobile')?.value;
  assert.ok(mobile, 'real loader invocation must select a tier');
  const performanceProfile = selectRuntimePerformanceProfile({ ...scenario, devicePixelRatio: 2 });
  const selected = vm.runInNewContext(source.slice(mobile.start, mobile.end), {
    window: { innerWidth: scenario.width }, performanceProfile,
  });
  assert.equal(selected, scenario.mobile);
});
