import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRODUCTION_HERO_ASSETS, createProductionHeroAtlasIndex } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';
import { readRgbaPng } from './sprite-qa.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portalRoot = path.join(repoRoot, 'apps', 'portal');
const evidencePath = path.join(repoRoot, '.hermes', 'evidence', 'hmh-reboot-18-release', 'active-asset-qa.json');
const requiredLayers = ['shadow', 'lower-body', 'torso-head', 'weapon'];
const maxAtlasBytes = 1024 * 1024;
const maxAtlasTotalBytes = 4 * 1024 * 1024;

function portalPath(url) {
  return path.join(portalRoot, url.replace(/^\//, ''));
}

function alphaCoverage(frame) {
  let transparentPixels = 0;
  let opaquePixels = 0;
  for (let offset = 3; offset < frame.pixels.length; offset += 4) {
    if (frame.pixels[offset] === 0) transparentPixels += 1;
    if (frame.pixels[offset] >= 200) opaquePixels += 1;
  }
  return { transparentPixels, opaquePixels };
}

const reports = [];
let atlasTotalBytes = 0;
for (const asset of Object.values(PRODUCTION_HERO_ASSETS)) {
  const imagePath = portalPath(asset.imageUrl);
  const metadataPath = portalPath(asset.metadataUrl);
  const imageBytes = statSync(imagePath).size;
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const png = readRgbaPng(imagePath);
  const coverage = alphaCoverage(png);

  assert.equal(metadata.schemaVersion, 1, `${asset.actorId} schemaVersion`);
  assert.equal(metadata.actorId, asset.actorId, `${asset.actorId} metadata identity`);
  assert.equal(metadata.variantId, asset.variantId, `${asset.actorId} metadata variant`);
  assert.equal(metadata.runtimeAuthority, 'projection-only', `${asset.actorId} runtimeAuthority`);
  assert.deepEqual(metadata.layers, requiredLayers, `${asset.actorId} layer order`);
  assert.equal(metadata.frames.length, 168, `${asset.actorId} frames.length`);
  assert.ok(imageBytes <= maxAtlasBytes, `${asset.actorId} atlas exceeds maxAtlasBytes`);
  assert.ok(coverage.transparentPixels > 0, `${asset.actorId} atlas lacks transparency`);
  assert.ok(coverage.opaquePixels > 0, `${asset.actorId} atlas is blank`);

  createProductionHeroAtlasIndex(metadata, asset);
  const ids = new Set();
  for (const source of metadata.frames) {
    assert.ok(!ids.has(source.id), `${asset.actorId} duplicate frame ${source.id}`);
    ids.add(source.id);
    const { x, y, w, h } = source.frame;
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0, `${asset.actorId} invalid frame rectangle`);
    assert.ok(x >= 0 && y >= 0 && x + w <= png.width && y + h <= png.height, `${asset.actorId} frame outside atlas`);
    assert.ok(Number.isFinite(source.anchor.x) && Number.isFinite(source.anchor.y), `${asset.actorId} invalid anchor`);
    assert.ok(source.anchor.x >= 0 && source.anchor.x <= 1 && source.anchor.y >= 0 && source.anchor.y <= 1, `${asset.actorId} anchor outside frame`);
    assert.ok(Number.isFinite(source.pivot.x) && Number.isFinite(source.pivot.y), `${asset.actorId} invalid pivot`);
    assert.ok(Number.isFinite(source.sourcePivot.x) && Number.isFinite(source.sourcePivot.y), `${asset.actorId} invalid sourcePivot`);
    assert.equal(source.rotated, false, `${asset.actorId} rotated frames unsupported`);
  }

  atlasTotalBytes += imageBytes;
  reports.push({
    actorId: asset.actorId,
    variantId: asset.variantId,
    imageBytes,
    width: png.width,
    height: png.height,
    frames: metadata.frames.length,
    transparentPixels: coverage.transparentPixels,
    opaquePixels: coverage.opaquePixels,
    runtimeAuthority: metadata.runtimeAuthority,
  });
}
assert.equal(reports.length, 4, 'four production hero atlases are required');
assert.ok(atlasTotalBytes <= maxAtlasTotalBytes, 'production atlasTotalBytes exceeds budget');

const summary = {
  status: 'pass',
  gate: 'hmh-reboot-production-assets-v1',
  atlasCount: reports.length,
  atlasTotalBytes,
  maxAtlasBytes,
  maxAtlasTotalBytes,
  reports,
};
mkdirSync(path.dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary));
