import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  HMH_CURATED_LEVEL_KIT,
  curatedLevelKitAssetByKey,
} from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-runtime.mjs';

const repoPath = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

test('curated HMH kit retains only the exact browser runtime set', () => {
  assert.equal(HMH_CURATED_LEVEL_KIT.id, 'hmh-curated-level-kit-v1');
  assert.equal(HMH_CURATED_LEVEL_KIT.runtimeFlavor, 'runtime-slim');
  assert.equal(HMH_CURATED_LEVEL_KIT.sourceRoot, './assets/generated/hmh-curated-level-kit/source');
  assert.match(HMH_CURATED_LEVEL_KIT.sourcePolicy, /curated approved.*vault-only/i);
  assert.ok(HMH_CURATED_LEVEL_KIT.assets.length >= 60, 'expected broad runtime key coverage');
  assert.deepEqual(HMH_CURATED_LEVEL_KIT.missing, []);

  const keys = new Set();
  for (const asset of HMH_CURATED_LEVEL_KIT.assets) {
    assert.equal(keys.has(asset.key), false, `duplicate runtime key ${asset.key}`);
    keys.add(asset.key);
    assert.equal(curatedLevelKitAssetByKey(asset.key), asset);
    const file = repoPath(`apps/portal/${asset.src.replace(/^\.\//, '')}`);
    assert.equal(existsSync(file), true, `${asset.src} exists`);
  }
});

test('curated kit exposes the Level 1 terrain and Universal prop grammar used by the world', () => {
  const keys = HMH_CURATED_LEVEL_KIT.assets.map((asset) => asset.key);
  assert.ok(keys.some((key) => /ground|terrain|water/.test(key)), 'ground family retained');
  assert.ok(keys.some((key) => /tree|prop|building|fence|barrier/.test(key)), 'prop family retained');
  assert.ok(HMH_CURATED_LEVEL_KIT.assets.some((asset) => asset.width > 0 && asset.height > 0));
});

test('curated kit source generation stays reproducible from the external vault', () => {
  const packageJson = JSON.parse(readFileSync(repoPath('package.json'), 'utf8'));
  assert.equal(packageJson.scripts['assets:hmh:curated-level-kit'], 'python scripts/build-hmh-curated-level-kit.py');
  const syntaxCheckRunner = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.equal(syntaxCheckRunner.includes('scripts/build-hmh-curated-level-kit.py'), true);
  assert.equal(syntaxCheckRunner.includes('hmh-curated-level-kit-runtime.mjs'), true);
});