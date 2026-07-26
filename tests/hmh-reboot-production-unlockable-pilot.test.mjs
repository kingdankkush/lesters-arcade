import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PRODUCTION_HERO_ASSETS,
  productionHeroAsset,
} from '../apps/hmh-reboot/src/production-hero-atlas.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json');
const SOURCE_BLEND_PATH = path.join(ROOT, 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.blend');
const OUTPUT_ROOT = path.join(ROOT, 'apps/portal/assets/generated/hmh-reboot-production-heroes');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function actor(manifest, actorId) {
  return manifest.pilots.find((entry) => entry.actorId === actorId);
}

function outputPath(entry, key) {
  return path.join(OUTPUT_ROOT, entry.output[key]);
}

function assertActorArtifacts(manifest, entry) {
  const metadata = readJson(outputPath(entry, 'metadata'));
  const metrics = readJson(outputPath(entry, 'metrics'));
  assert.ok(fs.statSync(SOURCE_BLEND_PATH).size > 100_000);
  assert.ok(fs.statSync(outputPath(entry, 'atlas')).size > 100_000);
  assert.ok(fs.statSync(outputPath(entry, 'contactSheet')).size > 100_000);
  assert.equal(metadata.actorId, entry.actorId);
  assert.equal(metadata.variantId, entry.variantId);
  assert.equal(metadata.gameplayBodyProfile, manifest.gameplayBodyProfile);
  assert.equal(metadata.runtimeAuthority, 'projection-only');
  assert.equal(metadata.frames.length, 648);
  assert.equal(new Set(metadata.frames.map((frame) => frame.id)).size, 648);
  assert.equal(metrics.actorId, entry.actorId);
  assert.equal(metrics.status, 'pass');
  assert.equal(metrics.reproducibility, 'pass');
  assert.equal(metrics.frameCount, 648);
  assert.equal(metrics.uniqueAnimatedFrameCount, 640);
  assert.equal(metrics.emptyFrameCount, 0);
  assert.equal(metrics.transparentCornerFailureCount, 0);
  assert.equal(metrics.externalDependencyCount, 0);
  assert.equal(metrics.boneCount, 14);
  assert.equal(metrics.weaponSocket, true);
  assert.equal(metrics.reproducibilityObserved.maxChangedVisiblePixels, 0);
  assert.equal(metrics.reproducibilityObserved.maxChannelDelta, 0);
  assert.equal(metrics.reproducibilityObserved.maxTotalChannelDelta, 0);
}

test('production manifest locks canonical Lester and Lilly identities and ranked gates', () => {
  const manifest = readJson(MANIFEST_PATH);
  const lester = actor(manifest, 'lester-original');
  const lilly = actor(manifest, 'lilly');
  assert.ok(lester);
  assert.ok(lilly);
  assert.equal(lester.variantId, 'blue-mask-original');
  assert.equal(lilly.variantId, 'gold-teal-veteran');
  assert.equal(lester.gameplayBodyProfile, 'human-medium-collision-v1');
  assert.equal(lilly.gameplayBodyProfile, 'human-medium-collision-v1');
  assert.deepEqual(lester.unlockGate, {
    type: 'ranked-matches-played',
    count: 10,
    legacyMigrationAchievementId: 'getaway-clear',
  });
  assert.deepEqual(lilly.unlockGate, {
    type: 'ranked-matches-played',
    count: 20,
  });
  assert.deepEqual(lester.artDirection.mustReadAtRuntime, [
    'blue-mask-white-face-stripe',
    'large-readable-eyes',
    'blue-neck-scarf',
    'ammo-bandolier',
    'tan-cargo-pants',
  ]);
  assert.deepEqual(lilly.artDirection.mustReadAtRuntime, [
    'long-teal-hair',
    'round-glasses',
    'gold-teal-tactical-armor',
    'slim-agile-silhouette',
  ]);
  assert.equal(lester.animationClips.length, 9);
  assert.equal(lilly.animationClips.length, 9);
  assert.deepEqual(lester.animationClips, lilly.animationClips);
  assert.notDeepEqual(lester.materials, lilly.materials);
});

test('Lester and Lilly emit separate deterministic repository-owned production evidence', () => {
  const manifest = readJson(MANIFEST_PATH);
  assertActorArtifacts(manifest, actor(manifest, 'lester-original'));
  assertActorArtifacts(manifest, actor(manifest, 'lilly'));
});

test('runtime registry approves canonical unlockables but rejects arbitrary actor ids', () => {
  assert.deepEqual(Object.keys(PRODUCTION_HERO_ASSETS).sort(), [
    'lester-original',
    'lilly',
    'lit-commando',
    'lit-valkyrie',
  ]);
  assert.equal(productionHeroAsset('lester-original').variantId, 'blue-mask-original');
  assert.equal(productionHeroAsset('lilly').variantId, 'gold-teal-veteran');
  assert.throws(() => productionHeroAsset('max-mempool'), /unknown approved production hero/);
});

test('portal sends exact selected canonical actor id and reboot uses it only for projection selection', () => {
  const portalSource = fs.readFileSync(path.join(ROOT, 'apps/portal/main.js'), 'utf8');
  const rebootSource = fs.readFileSync(path.join(ROOT, 'apps/hmh-reboot/src/main.mjs'), 'utf8');
  assert.match(portalSource, /const HMH_REBOOT_HERO_IDS = Object\.freeze\(\['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly'\]\)/);
  assert.match(portalSource, /function hmhRebootHeroId\(\)[\s\S]*HMH_REBOOT_HERO_IDS\.includes\(combat\.characterId\)[\s\S]*combat\.characterId/);
  assert.match(portalSource, /heroId: hmhRebootHeroId\(\)/);
  assert.match(rebootSource, /const sessionHeroSelection = productionHeroAsset\(payload\.heroId\)/);
  // The reboot loads the atlas for whichever actor the session names. It used
  // to throw when the session hero differed from the URL default, which ran
  // inside the bridge onInit handler and would strand the parent by skipping
  // game:ready — so every hero except lit-commando broke the portal run.
  assert.match(rebootSource, /ensureProductionHeroAtlas\(sessionHeroSelection\.actorId\)/);
  assert.doesNotMatch(rebootSource, /Production projection actor mismatch/);
  // Hero identity stays projection-only: it selects art and nothing else.
  assert.doesNotMatch(rebootSource, /payload\.heroId\s*=|sessionPayload\.heroId\s*=/);
  const ensureStart = rebootSource.indexOf('const ensureProductionHeroAtlas');
  const ensureEnd = rebootSource.indexOf('};', rebootSource.indexOf('.catch(', ensureStart));
  const ensureBlock = rebootSource.slice(ensureStart, ensureEnd);
  assert.doesNotMatch(ensureBlock, /collision|damage|score|health|seed|wallet|settlement/i);
});
