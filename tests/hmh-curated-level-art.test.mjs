import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENE_TEMPLATES } from '../apps/portal/src/scene-templates.mjs';
import { HMH_CURATED_LEVEL_ART } from '../apps/portal/assets/generated/hmh-curated-level-art/hmh-curated-level-art.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const portalRoot = join(repoRoot, 'apps', 'portal');

function portalPath(src) {
  assert.equal(typeof src, 'string');
  assert.match(src, /^\.\/assets\//, `${src} is a portal-relative asset path`);
  assert.doesNotMatch(src, /C:|Users|Downloads|\.hermes|\\/i, `${src} does not leak a local source path`);
  return join(portalRoot, src.replace(/^\.\//, ''));
}

function pngSize(filePath) {
  const png = readFileSync(filePath);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${filePath} is PNG`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test('curated level art manifest exposes all approved tree, forest, and ground sheets', () => {
  assert.equal(HMH_CURATED_LEVEL_ART.id, 'hmh-curated-level-art-chatgpt-2026-07-08');
  assert.equal(HMH_CURATED_LEVEL_ART.generatedFrom, 'Justin-approved ChatGPT Image tree, forest, and ground tile sheets; local source paths redacted');
  assert.equal(HMH_CURATED_LEVEL_ART.gridCounts.treeIdleFrames, 18);
  assert.equal(HMH_CURATED_LEVEL_ART.gridCounts.forestProps, 32);
  assert.equal(HMH_CURATED_LEVEL_ART.gridCounts.groundTiles, 425);
  assert.equal(HMH_CURATED_LEVEL_ART.gridCounts.groundTextures, 425);
  assert.equal(HMH_CURATED_LEVEL_ART.treeAnimations.length, 3);
  assert.equal(HMH_CURATED_LEVEL_ART.forestProps.length, 32);
  assert.equal(HMH_CURATED_LEVEL_ART.groundTiles.length, 425);
  assert.equal(HMH_CURATED_LEVEL_ART.groundTextures.length, 425);
});

test('curated runtime assets exist, use safe portal-relative paths, and have expected dimensions', () => {
  const tileSample = HMH_CURATED_LEVEL_ART.groundTiles.slice(0, 6);
  const propSample = [
    ...HMH_CURATED_LEVEL_ART.treeAnimations.flatMap((tree) => tree.frames.slice(0, 2)),
    ...HMH_CURATED_LEVEL_ART.forestProps.slice(0, 8),
  ];

  for (const tile of tileSample) {
    const filePath = portalPath(tile.src);
    assert.ok(existsSync(filePath), `exists: ${tile.src}`);
    assert.ok(statSync(filePath).size > 0, `non-empty: ${tile.src}`);
    assert.deepEqual(pngSize(filePath), [56, 56], `${tile.id} is normalized to the HMH isometric floor tile size`);
  }

  for (const prop of propSample) {
    const filePath = portalPath(prop.src);
    assert.ok(existsSync(filePath), `exists: ${prop.src}`);
    assert.ok(statSync(filePath).size > 0, `non-empty: ${prop.src}`);
    const [width, height] = pngSize(filePath);
    assert.ok(width >= 96 && height >= 96, `${prop.id} keeps enough transparent canvas for canopy/roots`);
  }
});

test('scene templates use the curated forest/tree sprites so the new assets appear in level design', () => {
  const requiredKeys = new Set([
    'curated/juniper-tree-idle-00',
    'curated/dead-tree-idle-00',
    'curated/cottonwood-tree-idle-00',
    'curated/forest-boundary-a-03',
    'curated/forest-boundary-b-09',
  ]);
  const usedKeys = new Set(Object.values(SCENE_TEMPLATES).flatMap((template) => template.slots.map((slot) => slot.assetKey)));
  for (const key of requiredKeys) assert.ok(usedKeys.has(key), `${key} is wired into a scene template`);

  const forestTemplates = ['tree_grove', 'authored_forest_trail_edge', 'crypto_dry_forest_cave', 'authored_residential_neighborhood'];
  for (const id of forestTemplates) {
    const template = SCENE_TEMPLATES[id];
    assert.ok(template, `${id} exists`);
    assert.ok(template.slots.some((slot) => slot.assetKey.startsWith('curated/')), `${id} uses curated tree/forest art`);
  }
});

test('main runtime is wired to load curated ground tiles through the HMH lazy payload', () => {
  const loader = readFileSync(join(repoRoot, 'apps', 'portal', 'src', 'games', 'hmh', 'loader.mjs'), 'utf8');
  const main = readFileSync(join(repoRoot, 'apps', 'portal', 'main.js'), 'utf8');
  assert.match(loader, /HMH_CURATED_LEVEL_ART/);
  assert.match(loader, /hmh-curated-level-art\/hmh-curated-level-art\.mjs/);
  assert.match(main, /curatedGroundTileImage/);
  assert.match(main, /HMH_CURATED_LEVEL_ART/);
});
