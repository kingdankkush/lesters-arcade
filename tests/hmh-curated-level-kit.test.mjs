import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoPath = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
const manifestPath = repoPath('apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.json');
const summaryPath = repoPath('apps/portal/assets/generated/hmh-curated-level-kit/audit-summary.json');
const mjsManifestPath = repoPath('apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('curated HMH level kit is synced into the active repo with Level 1 and Universal assets', () => {
  const sourceRoot = repoPath('apps/portal/assets/hmh-curated-level-kit');
  assert.equal(existsSync(sourceRoot), true, 'curated kit root exists in active clone');
  assert.equal(existsSync(repoPath('apps/portal/assets/hmh-curated-level-kit/Universal/Enemies/paper-hand')), true);
  assert.equal(existsSync(repoPath('apps/portal/assets/hmh-curated-level-kit/Universal/Heroes-Playable-Characters/lit-commando')), true);
  assert.equal(existsSync(repoPath('apps/portal/assets/hmh-curated-level-kit/level-1-crypto-wasteland/Buildings/ghost-saloon-front.png')), true);
});

test('curated kit pipeline emits a manifest, audit summary, and browser-loadable module', () => {
  assert.equal(existsSync(manifestPath), true, 'JSON manifest exists');
  assert.equal(existsSync(summaryPath), true, 'audit summary exists');
  assert.equal(existsSync(mjsManifestPath), true, 'MJS manifest exists');
  const manifest = readJson(manifestPath);
  const summary = readJson(summaryPath);

  assert.equal(manifest.id, 'hmh-curated-level-kit-v1');
  assert.equal(manifest.sourceRoot, './assets/hmh-curated-level-kit');
  assert.ok(summary.rawImages >= 11833, `expected full curated image count, got ${summary.rawImages}`);
  assert.equal(summary.scopes.Universal.rawImages >= 11000, true);
  assert.equal(summary.scopes['level-1-crypto-wasteland'].rawImages >= 400, true);
  assert.equal(summary.scopes['level-2-litecoin-city'].rawImages, 0);
  assert.equal(summary.scopes['level-3-getaway'].rawImages, 0);
});

test('curated kit manifest classifies Level 1 and Universal art into design grammar buckets', () => {
  const manifest = readJson(manifestPath);
  const byKey = new Map(manifest.assets.map((asset) => [asset.key, asset]));
  const required = [
    ['level-1/building/ghost-saloon-front', 'landmark-building'],
    ['level-1/building/industrial-warehouse-facade', 'landmark-building'],
    ['level-1/water/water-00', 'water'],
    ['level-1/road/road1', 'road'],
    ['universal/enemy/paper-hand', 'enemy'],
    ['universal/hero/lit-commando', 'hero'],
    ['universal/sheet/Ground-textures/water-v01', 'source-sheet'],
  ];
  for (const [key, category] of required) {
    assert.equal(byKey.has(key), true, `${key} exists`);
    assert.equal(byKey.get(key).category, category, `${key} category`);
  }
  assert.equal(manifest.grammar.groundRoles.includes('road'), true);
  assert.equal(manifest.grammar.placementZones.includes('boss-arena'), true);
  assert.equal(manifest.grammar.placementZones.includes('hard-boundary'), true);
});

test('curated kit pipeline slices high-priority terrain sheets and trims oversized props for runtime use', () => {
  const manifest = readJson(manifestPath);
  assert.ok(manifest.slicedGround.assets.length >= 500, `expected sliced ground assets, got ${manifest.slicedGround.assets.length}`);
  assert.ok(manifest.trimmedProps.assets.length >= 100, `expected trimmed props, got ${manifest.trimmedProps.assets.length}`);

  const water = manifest.slicedGround.assets.find((asset) => asset.role === 'water' && asset.source.includes('water_v01'));
  assert.ok(water, 'water_v01 is sliced into water tiles');
  assert.equal(water.width, 128);
  assert.equal(water.height, 64);
  assert.equal(existsSync(repoPath(`apps/portal/${water.src.replace(/^\.\//, '')}`)), true, `${water.src} exists`);

  const tree = manifest.trimmedProps.assets.find((asset) => asset.source.includes('Universal/Trees'));
  assert.ok(tree, 'at least one Universal tree is trimmed');
  assert.equal(tree.category, 'tree');
  assert.equal(existsSync(repoPath(`apps/portal/${tree.src.replace(/^\.\//, '')}`)), true, `${tree.src} exists`);
});

test('curated kit pipeline is wired into package scripts and syntax checks', () => {
  const packageJson = readJson(repoPath('package.json'));
  assert.equal(packageJson.scripts['assets:hmh:curated-level-kit'], 'python scripts/build-hmh-curated-level-kit.py');
  const syntaxCheckRunner = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.equal(syntaxCheckRunner.includes('scripts/build-hmh-curated-level-kit.py'), true);
  assert.equal(syntaxCheckRunner.includes('apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs'), true);
  assert.equal(syntaxCheckRunner.includes('tests/hmh-curated-level-kit.test.mjs'), true);
});
