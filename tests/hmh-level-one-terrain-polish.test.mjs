import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { HMH_CURATED_LEVEL_ART } from '../apps/portal/assets/generated/hmh-curated-level-art/hmh-curated-level-art.mjs';
import { buildLevelOneOpeningComposition } from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_SOURCE = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

function runtimePath(src) {
  return path.resolve(ROOT, 'apps/portal', String(src).replace(/^\.\//, ''));
}

test('Justin map tile pack is sliced into opaque runtime texture tiles with material role coverage', () => {
  const textures = HMH_CURATED_LEVEL_ART.groundTextures ?? [];
  assert.ok(textures.length >= 300, `expected a broad sliced terrain pack, got ${textures.length} tiles`);

  for (const role of ['grass', 'water', 'shore', 'sand', 'road', 'rocky', 'grass-to-dirt', 'dirt-to-sand']) {
    const keys = HMH_CURATED_LEVEL_ART.terrainRoles?.[role] ?? [];
    assert.ok(keys.length >= 5, `${role} should have several tile options`);
  }

  for (const texture of textures.slice(0, 80)) {
    assert.match(texture.key, /^chatgpt-terrain\//);
    assert.match(texture.src, /^\.\/assets\/generated\/hmh-curated-level-art\/terrain-textures\//);
    assert.doesNotMatch(texture.src, /C:|Users|Downloads|\\|\.hermes/i);
    assert.equal(texture.width, 160);
    assert.equal(texture.height, 160);
    assert.equal(existsSync(runtimePath(texture.src)), true, `${texture.src} should exist`);
  }
});

test('spawn composition has no large landmark or solid prop overlapping the hero start', () => {
  const composition = buildLevelOneOpeningComposition();
  const objects = composition.objects ?? [];
  assert.equal(objects.some((object) => object.id === 'gas-station-landmark'), false, 'old gas station spawn-overlap landmark should be gone');
  const spawnOverlap = objects.filter((object) => {
    const x = Number(object.x);
    const y = Number(object.y);
    return x >= -8 && x <= 8 && y >= 3 && y <= 8 && (object.solid || object.role === 'landmark');
  });
  assert.deepEqual(spawnOverlap.map((object) => object.id), [], 'hero spawn should be free of solid props/landmarks');
});

test('curated trees render as static props and are not added to the ambient animation pool', () => {
  assert.match(MAIN_SOURCE, /Curated trees are intentionally static now/);
  assert.doesNotMatch(MAIN_SOURCE, /for \(const tree of hmh\('HMH_CURATED_LEVEL_ART'\)\?\.treeAnimations/);
  const biomeBlock = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('const BIOME_ANIM_PROPS'), MAIN_SOURCE.indexOf('const wave2AnimImages'));
  assert.doesNotMatch(biomeBlock, /juniper-tree-idle|cottonwood-tree-idle|dead-tree-idle/);
});

test('world prop preloader is bounded to opening-camera assets for faster gameplay boot', () => {
  const preloadBlock = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('function preloadWorldPropImages'), MAIN_SOURCE.indexOf('// --- Persistent collidable world obstacles'));
  assert.match(preloadBlock, /wp\.slice\(0, 24\)/);
  assert.match(preloadBlock, /buildLevelOneCuratedVisibleSceneObjects\(\{ playerX: 0, playerY: 5, window: 16, frame: 0 \}\)\.slice\(0, 32\)/);
  assert.doesNotMatch(preloadBlock, /Object\.values\(SCENE_TEMPLATES\)/);
  assert.doesNotMatch(preloadBlock, /LEVEL_2_AUTHORED_LAYOUT_KEYS|LEVEL_3_AUTHORED_LAYOUT_KEYS/);
});

test('Wasteland Debt Collector frame-polish report records neighbor-bleed cleanup', () => {
  const reportPath = path.resolve(ROOT, 'apps/portal/assets/generated/hmh-animated-roster/wasteland-debt-collector/frame-polish-report.json');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(report.checkedFrames, 336);
  assert.ok(report.changedFrames >= 100, 'expected cleanup to touch many sliced frames');
  assert.ok(report.removedComponents >= 100, 'expected disconnected islands to be removed');
  assert.ok(report.removedPixels >= 100000, 'expected significant neighboring-frame bleed cleanup');
});
