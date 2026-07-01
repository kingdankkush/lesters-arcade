import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildLevelOneCuratedVisibleSceneObjects,
  levelOneCuratedRuntimeArtPolicy,
  levelOneCuratedAssetSrc,
} from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';
import { curatedLevelKitAssetByKey } from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

test('Level 1 visible runtime builds curated authored objects around the actual spawn camera', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 0, playerY: 5, window: 18 });
  assert.equal(objects.length >= 18, true, `expected a dense visible authored spawn slice, got ${objects.length}`);
  assert.equal(objects.some((object) => object.id.includes('spawn-broken-road')), true, 'spawn road beat should be visible immediately');
  assert.equal(objects.some((object) => object.assetKey === 'level-1/road/road1-ground'), true, 'spawn should use the curated broken-road art');
  assert.equal(objects.some((object) => object.assetKey === 'level-1/prop/bus-stop-sign'), true, 'spawn should include route signage from the curated folder');
  assert.equal(objects.every((object) => object.curated === true), true, 'all visible-runtime objects should be tagged as curated');
  assert.equal(objects.every((object) => curatedLevelKitAssetByKey(object.assetKey)), true, 'every object should resolve to Justin-curated manifest art');
});

test('Level 1 curated visible runtime maps approved asset keys to direct runtime image sources', () => {
  const saloon = levelOneCuratedAssetSrc('level-1/building/ghost-saloon-front');
  assert.equal(saloon, './assets/hmh-curated-level-kit/level-1-crypto-wasteland/Buildings/ghost-saloon-front.png');
  const road = levelOneCuratedAssetSrc('level-1/road/road1-ground');
  assert.match(road, /hmh-curated-level-kit\/level-1-crypto-wasteland\//);
});

test('Level 1 art policy disables old enemy-wave/combatArt fallbacks and generic procedural scatter', () => {
  const policy = levelOneCuratedRuntimeArtPolicy();
  assert.equal(policy.enemyFallbacksAllowed, false);
  assert.deepEqual(policy.disallowedEnemyFallbacks, ['HMH_ENEMIES_WAVE', 'combatArt.enemies', 'rectangle-fallback']);
  assert.equal(policy.sceneObjectsNearAllowed, false);
  assert.equal(policy.requiredWorldSource, 'hmh-level-one-curated-world-contract');
});

test('main runtime consumes the curated visible runtime before generic sceneObjectsNear and disables Level 1 old enemy art fallbacks', () => {
  const source = readFileSync(repoPath('apps/portal/main.js'), 'utf8');
  assert.equal(source.includes('buildLevelOneCuratedVisibleSceneObjects'), true);
  assert.equal(source.includes('levelOneCuratedRuntimeArtPolicy'), true);
  assert.equal(source.includes('curatedLevelOneImage'), true);

  const currentObstacles = source.slice(source.indexOf('function currentObstacles()'), source.indexOf('// Per-role art sizing'));
  assert.equal(currentObstacles.includes('buildLevelOneCuratedVisibleSceneObjects'), true, 'currentObstacles should inject curated visible Level 1 art');
  assert.equal(currentObstacles.includes('if (isLevelOneCuratedRuntime())'), true, 'Level 1 should have an explicit curated-runtime branch');
  assert.equal(currentObstacles.indexOf('buildLevelOneCuratedVisibleSceneObjects') < currentObstacles.indexOf('sceneObjectsNear('), true, 'curated authored objects must be chosen before procedural scatter');

  const enemyDraw = source.slice(source.indexOf('function drawSingleEnemy'), source.indexOf('function bossArtFor'));
  assert.equal(enemyDraw.includes('const waveFrame = isLevelOneCuratedRuntime() ? null :'), true, 'Level 1 should not use old HMH_ENEMIES_WAVE fallback art');
  assert.equal(enemyDraw.includes('const legacyEnemyFrame = isLevelOneCuratedRuntime() ? null : enemyArtFor(enemy)'), true, 'Level 1 should not fall back to old combatArt enemy sprites');
  assert.equal(enemyDraw.includes('if (isLevelOneCuratedRuntime()) return;'), true, 'Level 1 should suppress rectangle fallback enemies instead of showing bad placeholder art');
});

test('package check gate includes the visible runtime module and regression test', () => {
  const packageJson = readFileSync(repoPath('package.json'), 'utf8');
  assert.equal(packageJson.includes('apps/portal/src/hmh-level-one-visible-runtime.mjs'), true);
  assert.equal(packageJson.includes('tests/hmh-level-one-visible-runtime.test.mjs'), true);
});
