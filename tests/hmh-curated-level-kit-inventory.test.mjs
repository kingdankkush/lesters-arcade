import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HMH_CURATED_LEVEL_KIT } from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-runtime.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
function sourceInventory(root) {
  const files = [];
  const rootEntry = path.join(root, 'apps/portal/main.js');
  if (statSync(rootEntry, { throwIfNoEntry: false })?.isFile()) files.push('apps/portal/main.js');
  function walk(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.isFile() && /\.(mjs|js)$/.test(item.name)) files.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  walk(path.join(root, 'apps/portal/src'));
  return files.sort();
}
function assertInventory(root, declared) {
  assert.deepEqual([...declared].sort(), sourceInventory(root), 'curated runtime inventory is stale; run npm run assets:hmh:curated-level-kit-runtime');
}
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'hmh-inventory-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'apps/portal/src/nested'), { recursive: true });
  writeFileSync(path.join(root, 'apps/portal/main.js'), 'export {};');
  writeFileSync(path.join(root, 'apps/portal/src/first.mjs'), 'export {};');
  return root;
}

test('curated runtime inventory exactly matches the real recursive portal source directory', () => {
  assertInventory(repoRoot, HMH_CURATED_LEVEL_KIT.sourceFiles);
});
test('the exact guard rejects a new unregistered nested portal module', (t) => {
  const root = fixture(t);
  const declared = sourceInventory(root);
  writeFileSync(path.join(root, 'apps/portal/src/nested/new-feature.js'), 'export {};');
  assert.throws(() => assertInventory(root, declared), /curated runtime inventory is stale/);
  assertInventory(root, [...declared, 'apps/portal/src/nested/new-feature.js']);
});
test('the exact guard rejects a deleted module instead of preserving stale inventory metadata', (t) => {
  const root = fixture(t);
  const declared = sourceInventory(root);
  rmSync(path.join(root, 'apps/portal/src/first.mjs'));
  assert.throws(() => assertInventory(root, declared), /curated runtime inventory is stale/);
});
test('the exact guard rejects deletion of the root portal entry module', (t) => {
  const root = fixture(t);
  const declared = sourceInventory(root);
  rmSync(path.join(root, 'apps/portal/main.js'));
  assert.throws(() => assertInventory(root, declared), /curated runtime inventory is stale/);
});
test('the root portal entry must be a real file, not an extension-named directory', (t) => {
  const root = fixture(t);
  const declared = sourceInventory(root);
  rmSync(path.join(root, 'apps/portal/main.js'));
  mkdirSync(path.join(root, 'apps/portal/main.js'));
  assert.throws(() => assertInventory(root, declared), /curated runtime inventory is stale/);
});
test('non-code notes and empty extension-named directories are not runtime modules', (t) => {
  const root = fixture(t);
  const declared = sourceInventory(root);
  writeFileSync(path.join(root, 'apps/portal/src/nested/design.md'), '# notes');
  mkdirSync(path.join(root, 'apps/portal/src/not-a-module.js'));
  assertInventory(root, declared);
});
