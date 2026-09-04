import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRODUCTION_HERO_ASSETS, createProductionHeroAtlasIndex } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';
import { ENEMY_ROSTER_ACTORS, createEnemyRosterAtlasIndex, enemyRosterAsset } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';
import { AUTHORED_PROP_ATLAS_IMAGE_URL, AUTHORED_PROP_ATLAS_METADATA_URL, createAuthoredPropAtlasIndex } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { HMH_REBOOT_HERO_SELECTOR_ATLAS } from '../apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs';
import { readRgbaPng } from './sprite-qa.mjs';
import { AUTHORED_PROP_ASSET_IDS } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portalRoot = path.join(repoRoot, 'apps', 'portal');
const evidencePath = path.join(repoRoot, '.hermes', 'evidence', 'hmh-reboot-18-release', 'active-asset-qa.json');
const requiredLayers = ['shadow', 'lower-body', 'torso-head', 'weapon'];
// Detailed reference heroes may use more local atlas entropy, but the unchanged
// aggregate cap still bounds the four-hero download footprint.
const maxHeroAtlasBytes = 3.25 * 1024 * 1024;
const maxHeroAtlasTotalBytes = 12 * 1024 * 1024;
const maxRosterAtlasBytes = 2 * 1024 * 1024;
const maxRosterAtlasTotalBytes = 10 * 1024 * 1024;
const maxPropAtlasBytes = 512 * 1024;
const maxSelectorAtlasBytes = 512 * 1024;

function portalPath(url) {
  const normalized = url.replace(/^\//u, '').replace(/^(?:\.\.\/)+/u, '');
  return path.join(portalRoot, normalized);
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

function validatePng(imagePath, label) {
  const imageBytes = statSync(imagePath).size;
  const png = readRgbaPng(imagePath);
  const coverage = alphaCoverage(png);
  assert.ok(coverage.transparentPixels > 0, `${label} atlas lacks transparency`);
  assert.ok(coverage.opaquePixels > 0, `${label} atlas is blank`);
  return { imageBytes, png, coverage };
}

const heroReports = [];
let heroAtlasTotalBytes = 0;
for (const asset of Object.values(PRODUCTION_HERO_ASSETS)) {
  const imagePath = portalPath(asset.imageUrl);
  const metadata = JSON.parse(readFileSync(portalPath(asset.metadataUrl), 'utf8'));
  const { imageBytes, png, coverage } = validatePng(imagePath, asset.actorId);
  assert.equal(metadata.schemaVersion, 1, `${asset.actorId} schemaVersion`);
  assert.equal(metadata.actorId, asset.actorId, `${asset.actorId} metadata identity`);
  assert.equal(metadata.variantId, asset.variantId, `${asset.actorId} metadata variant`);
  assert.equal(metadata.runtimeAuthority, 'projection-only', `${asset.actorId} runtimeAuthority`);
  assert.deepEqual(metadata.layers, requiredLayers, `${asset.actorId} layer order`);
  assert.equal(metadata.frames.length, 648, `${asset.actorId} frames.length`);
  assert.ok(imageBytes <= maxHeroAtlasBytes, `${asset.actorId} atlas exceeds maxHeroAtlasBytes`);
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
    assert.ok(typeof source.sourcePixelSha256 === 'string' && /^[0-9a-f]{64}$/u.test(source.sourcePixelSha256), `${asset.actorId} sourcePixelSha256 missing`);
    assert.equal(source.rotated, false, `${asset.actorId} rotated frames unsupported`);
    assert.ok(Number.isFinite(source.fps) && source.fps > 0, `${asset.actorId} authored fps missing`);
  }
  heroAtlasTotalBytes += imageBytes;
  heroReports.push({ actorId: asset.actorId, variantId: asset.variantId, imageBytes, width: png.width, height: png.height, frames: metadata.frames.length, transparentPixels: coverage.transparentPixels, opaquePixels: coverage.opaquePixels, runtimeAuthority: metadata.runtimeAuthority });
}
assert.equal(heroReports.length, 4, 'four production hero atlases are required');
assert.ok(heroAtlasTotalBytes <= maxHeroAtlasTotalBytes, 'production hero atlas total exceeds budget');

const selectorMetadataPath = path.join(portalRoot, 'assets', 'generated', 'hmh-reboot-hero-selector', 'hmh-reboot-hero-selector-atlas.json');
const selectorMetadata = JSON.parse(readFileSync(selectorMetadataPath, 'utf8'));
const selectorImagePath = portalPath(HMH_REBOOT_HERO_SELECTOR_ATLAS.image);
const selectorPngReport = validatePng(selectorImagePath, 'hmh-reboot-hero-selector');
const selectorSha256 = createHash('sha256').update(readFileSync(selectorImagePath)).digest('hex');
assert.equal(selectorMetadata.pipelineId, 'hmh-reboot-hero-selector-atlas-v2');
assert.deepEqual(selectorMetadata.presentation, {
  scale: 1.15,
  bottomMargin: 10,
  resampling: 'lanczos',
  sourceFrameSize: 160,
});
assert.ok(selectorMetadata.frames.every((frame) => frame.presentationScale === 1.15));
assert.ok(selectorMetadata.frames.every((frame) => frame.alphaBounds.y + frame.alphaBounds.h === 150));
assert.equal(selectorMetadata.runtimeAuthority, 'projection-only');
assert.equal(selectorMetadata.frameCount, 32);
assert.equal(selectorMetadata.imageSha256, selectorSha256);
assert.equal(selectorMetadata.imageBytes, selectorPngReport.imageBytes);
assert.equal(selectorPngReport.png.width, HMH_REBOOT_HERO_SELECTOR_ATLAS.atlasSize.width);
assert.equal(selectorPngReport.png.height, HMH_REBOOT_HERO_SELECTOR_ATLAS.atlasSize.height);
assert.ok(selectorPngReport.imageBytes <= maxSelectorAtlasBytes, 'hero selector atlas exceeds maxSelectorAtlasBytes');
assert.equal(Object.keys(HMH_REBOOT_HERO_SELECTOR_ATLAS.heroes).length, 4);
assert.ok(Object.values(HMH_REBOOT_HERO_SELECTOR_ATLAS.heroes).every((hero) => hero.frames.length === 8));

const rosterReports = [];
let rosterAtlasTotalBytes = 0;
for (const actorId of ENEMY_ROSTER_ACTORS) {
  const asset = enemyRosterAsset(actorId);
  const imagePath = portalPath(asset.imageUrl);
  const metadata = JSON.parse(readFileSync(portalPath(asset.metadataUrl), 'utf8'));
  const { imageBytes, png, coverage } = validatePng(imagePath, actorId);
  const index = createEnemyRosterAtlasIndex(metadata, actorId);
  assert.equal(metadata.runtimeAuthority, 'projection-only', `${actorId} runtime authority`);
  assert.equal(index.frameCount, actorId === 'the-liquidator' ? 456 : 152, `${actorId} frame count`);
  assert.ok(imageBytes <= maxRosterAtlasBytes, `${actorId} atlas exceeds maxRosterAtlasBytes`);
  rosterAtlasTotalBytes += imageBytes;
  rosterReports.push({ actorId, imageBytes, width: png.width, height: png.height, frames: index.frameCount, phases: index.phases, transparentPixels: coverage.transparentPixels, opaquePixels: coverage.opaquePixels });
}
assert.equal(rosterReports.length, 7, 'seven enemy and boss atlases are required');
assert.ok(rosterAtlasTotalBytes <= maxRosterAtlasTotalBytes, 'enemy roster atlas total exceeds budget');
const rosterMetrics = JSON.parse(readFileSync(path.join(portalRoot, 'assets', 'generated', 'hmh-reboot-enemy-roster', 'hmh-enemy-roster-metrics.json'), 'utf8'));
assert.equal(rosterMetrics.status, 'pass', 'enemy roster metrics status');
assert.equal(rosterMetrics.actorCount, 7, 'enemy roster metrics actor count');
assert.equal(rosterMetrics.totalFrames, 1_368, 'enemy roster metrics frame count');
assert.equal(rosterMetrics.duplicateFrames, 0, 'enemy roster duplicate frames');
assert.equal(rosterMetrics.reproducibleVerified, true, 'enemy roster reproducibility');
// Cycle 073: the two cold passes are compared premultiplied and unquantised in
// the hero budget form (8 changed visible pixels / 2 per channel / 32 total per
// frame). Anything wider, and any metadata drift beyond the derived pixel SHA,
// fails the gate. The old nearest-8 quantiser is gone.
assert.equal(rosterMetrics.reproducibilityPolicy?.kind, 'bounded-premultiplied-rgba-v1', 'roster reproducibility policy');
assert.deepEqual(rosterMetrics.reproducibilityPolicy?.budget, { maxChangedVisiblePixels: 8, maxChannelDelta: 2, maxTotalChannelDelta: 32 }, 'roster budget');
assert.equal(rosterMetrics.reproducibilityPolicy?.coldSceneRebuild, true, 'roster gate rebuilds the scene cold');
assert.ok(rosterMetrics.reproducibilityPolicy?.observed?.maxChangedVisiblePixels <= 8, 'roster changed-pixel bound');
assert.ok(rosterMetrics.reproducibilityPolicy?.observed?.maxChannelDelta <= 2, 'roster channel bound');
assert.ok(rosterMetrics.reproducibilityPolicy?.observed?.maxTotalChannelDelta <= 32, 'roster total bound');
assert.equal('rgbCanonicalization' in (rosterMetrics.reproducibilityPolicy ?? {}), false, 'roster quantiser must be gone');
assert.equal(rosterMetrics.reproducibilityPolicy?.metadataExactExceptDerivedPixelSha, true, 'roster metadata exactness');
assert.equal(rosterMetrics.engine, 'BLENDER_EEVEE', 'roster engine');
assert.equal(rosterMetrics.totalAtlasBytes, rosterAtlasTotalBytes, 'enemy roster byte ledger drifted');

const propImagePath = portalPath(AUTHORED_PROP_ATLAS_IMAGE_URL);
const propMetadata = JSON.parse(readFileSync(portalPath(AUTHORED_PROP_ATLAS_METADATA_URL), 'utf8'));
const propPngReport = validatePng(propImagePath, 'hmh-authored-props');
const propIndex = createAuthoredPropAtlasIndex(propMetadata);
assert.equal(propMetadata.assetCount, propMetadata.frames.length, 'hmh-authored-props asset count');
assert.equal(propIndex.frameById.size, propMetadata.assetCount, 'hmh-authored-props index count');
for (const assetId of AUTHORED_PROP_ASSET_IDS) assert.ok(propIndex.frameById.has(assetId), `missing gameplay prop ${assetId}`);
assert.ok(propPngReport.imageBytes <= maxPropAtlasBytes, 'hmh-authored-props atlas exceeds maxPropAtlasBytes');
const propMetrics = JSON.parse(readFileSync(path.join(path.dirname(propImagePath), 'hmh-authored-props-metrics.json'), 'utf8'));
assert.equal(propMetrics.status, 'pass', 'hmh-authored-props metrics status');
assert.equal(propMetrics.assetCount, propMetadata.assetCount, 'hmh-authored-props metrics count');
assert.equal(propMetrics.duplicateFrames, 0, 'hmh-authored-props duplicate frames');
assert.equal(propMetrics.reproducibleVerified, true, 'hmh-authored-props reproducibility');

const summary = {
  status: 'pass',
  gate: 'hmh-reboot-production-assets-v2',
  heroAtlasCount: heroReports.length,
  selectorAtlasCount: 1,
  rosterAtlasCount: rosterReports.length,
  propAtlasCount: 1,
  propAssetCount: propIndex.frameById.size,
  heroAtlasTotalBytes,
  selectorAtlasBytes: selectorPngReport.imageBytes,
  rosterAtlasTotalBytes,
  propAtlasBytes: propPngReport.imageBytes,
  budgets: { maxHeroAtlasBytes, maxHeroAtlasTotalBytes, maxRosterAtlasBytes, maxRosterAtlasTotalBytes, maxPropAtlasBytes, maxSelectorAtlasBytes },
  heroReports,
  selectorReport: { imageBytes: selectorPngReport.imageBytes, width: selectorPngReport.png.width, height: selectorPngReport.png.height, frames: selectorMetadata.frameCount, sha256: selectorSha256 },
  rosterReports,
  propReport: { imageBytes: propPngReport.imageBytes, width: propPngReport.png.width, height: propPngReport.png.height, assets: propMetadata.assetCount },
};
mkdirSync(path.dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary));
