import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json', import.meta.url);
const outputRoot = new URL('../apps/portal/assets/generated/hmh-reboot-production-heroes/', import.meta.url);

const ACTION_CLIPS = Object.freeze({
  dash: { frames: 4, fps: 15, loop: false },
  melee: { frames: 5, fps: 15, loop: false },
  grenade: { frames: 5, fps: 12, loop: false },
  death: { frames: 6, fps: 8, loop: false },
});

async function loadJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

test('production hero manifest locks approved starter variants without changing gameplay-body parity', async () => {
  const manifest = await loadJson(manifestUrl);
  assert.equal(manifest.schema, 'hmh-reboot-production-heroes-v2');
  assert.equal(manifest.classification, 'production-art');
  assert.equal(manifest.gameplayBodyProfile, 'human-medium-collision-v1');
  assert.deepEqual(manifest.selection, {
    male: { actorId: 'lit-commando', variantId: 'reserve-vanguard' },
    female: { actorId: 'lit-valkyrie', variantId: 'plasma-striker' },
    approvalBasis: 'user-directed-continuation',
  });
  assert.equal(manifest.scene.armature, 'HMH_ProductionHeroRig');
  assert.equal(manifest.scene.weaponSocket, 'weapon_socket');
  assert.deepEqual(manifest.directions, [
    'south',
    'south-east',
    'east',
    'north-east',
    'north',
    'north-west',
    'west',
    'south-west',
  ]);
  assert.deepEqual(manifest.directionAngles, {
    south: 45,
    'south-east': 90,
    east: 135,
    'north-east': 180,
    north: 225,
    'north-west': 270,
    west: 315,
    'south-west': 0,
  });
});

test('male production pilot defines deterministic independent lower-body aim and weapon layers', async () => {
  const manifest = await loadJson(manifestUrl);
  const male = manifest.pilots.find((pilot) => pilot.actorId === 'lit-commando');
  assert.ok(male, 'lit-commando production pilot must exist');
  assert.equal(male.variantId, 'reserve-vanguard');
  assert.equal(male.status, 'production-pilot');
  assert.deepEqual(male.layers, ['shadow', 'lower-body', 'torso-head', 'weapon']);
  assert.deepEqual(male.clips, {
    shadow: { idle: { frames: 1, fps: 1 } },
    'lower-body': {
      idle: { frames: 2, fps: 2 },
      run: { frames: 6, fps: 12 },
      ...ACTION_CLIPS,
    },
    'torso-head': {
      aim: { frames: 2, fps: 2 },
      'pistol-fire': { frames: 3, fps: 15 },
      hurt: { frames: 2, fps: 10 },
      ...ACTION_CLIPS,
    },
    weapon: {
      aim: { frames: 2, fps: 2 },
      'pistol-fire': { frames: 3, fps: 15 },
      ...ACTION_CLIPS,
    },
  });
  const framesPerDirection = Object.values(male.clips)
    .flatMap((states) => Object.values(states))
    .reduce((total, clip) => total + clip.frames, 0);
  assert.equal(framesPerDirection, 81);
  assert.equal(framesPerDirection * manifest.directions.length, 648);
  assert.deepEqual(male.composition, ['shadow', 'lower-body', 'torso-head', 'weapon']);
  assert.equal(male.runtimeAuthority, 'projection-only');
});

test('male production pilot emits repository-owned reproducible atlas evidence', async () => {
  const manifest = await loadJson(manifestUrl);
  const male = manifest.pilots.find((pilot) => pilot.actorId === 'lit-commando');
  const packageJson = await loadJson(new URL('../package.json', import.meta.url));
  assert.equal(packageJson.scripts['assets:hmh:production-hero-pilot'], 'python scripts/run-hmh-production-hero-pilot.py');

  const paths = male.output;
  const blendUrl = new URL(`../${manifest.scene.sourceBlend}`, import.meta.url);
  const atlasUrl = new URL(paths.atlas, outputRoot);
  const metadataUrl = new URL(paths.metadata, outputRoot);
  const metricsUrl = new URL(paths.metrics, outputRoot);
  const sheetUrl = new URL(paths.contactSheet, outputRoot);
  await Promise.all([access(blendUrl), access(atlasUrl), access(metadataUrl), access(metricsUrl), access(sheetUrl)]);

  const metadata = await loadJson(metadataUrl);
  const metrics = await loadJson(metricsUrl);
  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.actorId, 'lit-commando');
  assert.equal(metadata.variantId, 'reserve-vanguard');
  assert.deepEqual(metadata.layers, male.layers);
  assert.equal(metadata.frames.length, 648);
  assert.equal(new Set(metadata.frames.map((frame) => frame.id)).size, 648);
  assert.equal(metrics.status, 'pass');
  assert.equal(metrics.frameCount, 648);
  assert.equal(metrics.uniqueFrameIdCount, 648);
  assert.equal(metrics.uniqueAnimatedFrameCount, 640);
  assert.ok(metrics.duplicateDecodedFrameGroups.every((group) => group.frameIds.every((id) => id.includes('__shadow__'))));
  assert.equal(metrics.emptyFrameCount, 0);
  assert.equal(metrics.transparentCornerFailureCount, 0);
  assert.equal(metrics.externalDependencyCount, 0);
  assert.equal(metrics.weaponSocket, true);
  assert.equal(metrics.reproducibility, 'pass');
  assert.equal(metrics.reproducibilityMode, 'bounded-premultiplied-rgba-v1');
  assert.ok(metrics.reproducibilityObserved.maxChangedVisiblePixels <= metrics.reproducibilityBudget.maxChangedVisiblePixels);
  assert.ok(metrics.reproducibilityObserved.maxChannelDelta <= metrics.reproducibilityBudget.maxChannelDelta);
  assert.ok(metrics.reproducibilityObserved.maxTotalChannelDelta <= metrics.reproducibilityBudget.maxTotalChannelDelta);
  assert.ok(metrics.atlasSize.width <= 2048);
  assert.equal(metrics.atlasSize.width, metrics.atlasSize.height);
  assert.match(metrics.sourceBlendSha256, /^[0-9a-f]{64}$/);
  assert.match(metrics.atlasSha256, /^[0-9a-f]{64}$/);
  assert.match(metrics.metadataSha256, /^[0-9a-f]{64}$/);
});

test('female production pilot preserves gameplay parity with a distinct Plasma Striker identity', async () => {
  const manifest = await loadJson(manifestUrl);
  const male = manifest.pilots.find((pilot) => pilot.actorId === 'lit-commando');
  const female = manifest.pilots.find((pilot) => pilot.actorId === 'lit-valkyrie');
  assert.ok(female, 'lit-valkyrie production pilot must exist');
  assert.equal(female.variantId, 'plasma-striker');
  assert.equal(female.status, 'production-pilot');
  assert.equal(female.gameplayBodyProfile, 'human-medium-collision-v1');
  assert.equal(female.gameplayBodyProfile, male.gameplayBodyProfile);
  assert.deepEqual(female.layers, male.layers);
  assert.deepEqual(female.composition, male.composition);
  assert.deepEqual(female.clips, male.clips);
  assert.equal(female.runtimeAuthority, 'projection-only');
  const framesPerDirection = Object.values(female.clips)
    .flatMap((states) => Object.values(states))
    .reduce((total, clip) => total + clip.frames, 0);
  assert.equal(framesPerDirection * manifest.directions.length, 648);
});

test('female production pilot emits separate repository-owned reproducible atlas evidence', async () => {
  const manifest = await loadJson(manifestUrl);
  const female = manifest.pilots.find((pilot) => pilot.actorId === 'lit-valkyrie');
  const paths = female.output;
  const atlasUrl = new URL(paths.atlas, outputRoot);
  const metadataUrl = new URL(paths.metadata, outputRoot);
  const metricsUrl = new URL(paths.metrics, outputRoot);
  const sheetUrl = new URL(paths.contactSheet, outputRoot);
  await Promise.all([access(atlasUrl), access(metadataUrl), access(metricsUrl), access(sheetUrl)]);
  const metadata = await loadJson(metadataUrl);
  const metrics = await loadJson(metricsUrl);
  assert.equal(metadata.actorId, 'lit-valkyrie');
  assert.equal(metadata.variantId, 'plasma-striker');
  assert.equal(metadata.gameplayBodyProfile, 'human-medium-collision-v1');
  assert.equal(metadata.runtimeAuthority, 'projection-only');
  assert.equal(metadata.frames.length, 648);
  assert.equal(new Set(metadata.frames.map((frame) => frame.id)).size, 648);
  assert.equal(metrics.status, 'pass');
  assert.equal(metrics.frameCount, 648);
  assert.equal(metrics.uniqueFrameIdCount, 648);
  assert.equal(metrics.uniqueAnimatedFrameCount, 640);
  assert.ok(metrics.duplicateDecodedFrameGroups.every((group) => group.frameIds.every((id) => id.includes('__shadow__'))));
  assert.equal(metrics.externalDependencyCount, 0);
  assert.equal(metrics.weaponSocket, true);
  assert.equal(metrics.reproducibility, 'pass');
  assert.equal(metrics.reproducibilityObserved.maxChangedVisiblePixels, 0);
  assert.equal(metrics.reproducibilityObserved.maxChannelDelta, 0);
  assert.equal(metrics.reproducibilityObserved.maxTotalChannelDelta, 0);
  assert.ok(metrics.atlasSize.width <= 2048);
  assert.match(metrics.atlasSha256, /^[0-9a-f]{64}$/);
});
