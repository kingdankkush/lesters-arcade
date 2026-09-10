import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluateDeclaredSourcePayload } from '../scripts/hmh-source-model-lfs-check.mjs';

import {
  PRODUCTION_HERO_ASSETS,
  productionHeroAsset,
} from '../apps/hmh-reboot/src/production-hero-atlas.mjs';
import { HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG } from '../apps/portal/src/hmh-character-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json');
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

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function expectedFrameIds(manifest, entry) {
  return entry.layers.flatMap((layer) => Object.entries(entry.clips[layer]).flatMap(([state, clip]) => (
    manifest.directions.flatMap((direction) => Array.from({ length: clip.frames }, (_, frameIndex) => (
      `${entry.actorId}__${layer}__${state}__${direction}__${String(frameIndex).padStart(3, '0')}`
    )))
  )));
}

function assertActorArtifacts(manifest, entry, readSourceBytes = fs.readFileSync) {
  const metadata = readJson(outputPath(entry, 'metadata'));
  const metrics = readJson(outputPath(entry, 'metrics'));
  const sourcePath = path.join(ROOT, entry.sourceModel.path);
  const inspectionPath = path.join(ROOT, entry.sourceModel.inspection.path);
  const reproducibilityPath = path.join(ROOT, entry.sourceModel.reproducibility.path);
  const inspection = readJson(inspectionPath);
  const reproducibility = readJson(reproducibilityPath);
  const expectedIds = expectedFrameIds(manifest, entry);
  assert.equal(entry.sourceModel.format, 'blend');
  assert.equal(entry.sourceModel.kind, 'packed-textured-blend');
  assert.equal(entry.sourceModel.externalDependencyCount, 0);
  assert.deepEqual(evaluateDeclaredSourcePayload(readSourceBytes(sourcePath), entry.sourceModel).problems, [], `${entry.actorId} source identity`);
  assert.equal(sha256(inspectionPath), entry.sourceModel.inspection.sha256);
  assert.equal(sha256(reproducibilityPath), entry.sourceModel.reproducibility.sha256);
  assert.equal(fs.statSync(outputPath(entry, 'atlas')).size, metrics.atlasBytes);
  assert.ok(metrics.atlasBytes <= manifest.atlas.maxTextureBytesPerHero);
  assert.ok(fs.statSync(outputPath(entry, 'contactSheet')).size > 100_000);
  assert.equal(metadata.actorId, entry.actorId);
  assert.equal(metadata.variantId, entry.variantId);
  assert.equal(metadata.gameplayBodyProfile, manifest.gameplayBodyProfile);
  assert.equal(metadata.runtimeAuthority, 'projection-only');
  assert.deepEqual(metadata.nativeWeaponIds, entry.nativeWeaponIds);
  assert.deepEqual(metadata.nativeActionIds, entry.nativeActionIds);
  assert.deepEqual(new Set(metadata.frames.map((frame) => frame.id)), new Set(expectedIds));
  assert.equal(metrics.actorId, entry.actorId);
  assert.equal(metrics.variantId, entry.variantId);
  assert.equal(metrics.status, 'pass');
  assert.equal(metrics.reproducibility, 'pass');
  assert.equal(metrics.frameCount, expectedIds.length);
  assert.equal(metrics.uniqueFrameIdCount, expectedIds.length);
  const visibleAnimatedFrames = metadata.frames.filter((frame) => frame.layer !== 'shadow' && frame.visibility !== 'source-prop-released');
  const releasedFrames = metadata.frames.filter((frame) => frame.visibility === 'source-prop-released');
  assert.equal(metrics.uniqueAnimatedFrameCount, visibleAnimatedFrames.length);
  assert.equal(metrics.intentionalHiddenFrameCount, releasedFrames.length);
  assert.equal(metrics.emptyFrameCount, 0);
  assert.equal(metrics.transparentCornerFailureCount, 0);
  assert.equal(metrics.externalDependencyCount, inspection.externalDependencyCount);
  assert.equal(metrics.boneCount, inspection.bones.length);
  assert.equal(metrics.weaponSocket, inspection.weaponSocket);
  assert.deepEqual(metrics.frameSize, entry.frameSize);
  assert.equal(metrics.sourceKind, entry.sourceModel.kind);
  assert.equal(metrics.sourceModelSha256, entry.sourceModel.sourceSha256);
  assert.deepEqual(inspection.actors[entry.actorId].actions, Object.values(entry.clipActions));
  assert.deepEqual(Object.keys(inspection.actors[entry.actorId].objectsByLayer), entry.layers);
  assert.deepEqual(metrics.reproducibilityObserved, reproducibility);
  assert.deepEqual(metrics.reproducibilityBudget, manifest.reproducibilityBudget);
  for (const [metric, limit] of Object.entries(manifest.reproducibilityBudget)) {
    assert.ok(reproducibility[metric] <= limit, `${entry.actorId} ${metric} exceeds its unchanged source budget`);
  }
}

test('native art manifest locks Lester and Lilly identities while the parent owns ranked unlocks', () => {
  const manifest = readJson(MANIFEST_PATH);
  const lester = actor(manifest, 'lester-original');
  const lilly = actor(manifest, 'lilly');
  assert.deepEqual(manifest.unlockAuthority, {
    owner: 'parent',
    module: 'apps/portal/src/hmh-character-config.mjs',
    export: 'HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG',
  });
  assert.ok(lester);
  assert.ok(lilly);
  assert.equal(lester.variantId, 'blue-mask-original');
  assert.equal(lilly.variantId, 'gold-teal-veteran');
  assert.equal(lester.modelSpecId, 'lester-reference-combat-v1');
  assert.equal(lilly.modelSpecId, 'lilly-reference-combat-v1');
  assert.deepEqual(lester.frameSize, [224, 224]);
  assert.deepEqual(lilly.frameSize, [216, 216]);
  assert.equal(lester.gameplayBodyProfile, 'human-medium-collision-v1');
  assert.equal(lilly.gameplayBodyProfile, 'human-medium-collision-v1');
  assert.equal(Object.hasOwn(lester, 'unlockGate'), false, 'projection metadata must not duplicate parent unlock policy');
  assert.equal(Object.hasOwn(lilly, 'unlockGate'), false, 'projection metadata must not duplicate parent unlock policy');
  const unlocks = Object.fromEntries(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.unlockableCharacters.map((entry) => [entry.id, entry]));
  assert.deepEqual(unlocks['lester-original'].gate, { type: 'ranked-matches-played', count: 10 });
  assert.equal(unlocks['lester-original'].legacyMigrationAchievementId, 'getaway-clear');
  assert.deepEqual(unlocks.lilly.gate, { type: 'ranked-matches-played', count: 20 });
  assert.equal(Object.hasOwn(unlocks.lilly, 'legacyMigrationAchievementId'), false);
  assert.deepEqual(lester.animationClips, lilly.animationClips);
  assert.equal(new Set(lester.animationClips).size, 9);
  for (const entry of [lester, lilly]) {
    assert.deepEqual(new Set(Object.keys(entry.clipActions)), new Set(entry.animationClips));
    assert.deepEqual(new Set(entry.layers.flatMap((layer) => Object.keys(entry.clips[layer]))), new Set(entry.animationClips));
    assert.equal(entry.sourceModel.kind, 'packed-textured-blend');
  }
  assert.notEqual(lester.sourceModel.sourceSha256, lilly.sourceModel.sourceSha256);
});

test('Lester and Lilly evidence derives from each packed native source and authored clip graph', () => {
  const manifest = readJson(MANIFEST_PATH);
  assertActorArtifacts(manifest, actor(manifest, 'lester-original'));
  assertActorArtifacts(manifest, actor(manifest, 'lilly'));
});

test('unlockable native evidence accepts exact LFS payload identity and rejects forged pointers', () => {
  const manifest=readJson(MANIFEST_PATH);
  for (const actorId of ['lester-original','lilly']) {
    const entry=actor(manifest,actorId);
    const source=entry.sourceModel;
    const pointer=Buffer.from(`version https://git-lfs.github.com/spec/v1\noid sha256:${source.sourceSha256}\nsize ${source.sourceBytes}\n`);
    assert.doesNotThrow(()=>assertActorArtifacts(manifest,entry,()=>pointer));
    for (const forged of [
      Buffer.from(pointer.toString().replace(source.sourceSha256,'0'.repeat(64))),
      Buffer.from(pointer.toString().replace(`size ${source.sourceBytes}`,'size 1')),
      Buffer.concat([pointer,Buffer.from('extra\n')]),
    ]) assert.throws(()=>assertActorArtifacts(manifest,entry,()=>forged),/source identity/i);
  }
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
