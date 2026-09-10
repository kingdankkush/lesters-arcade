import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { evaluateDeclaredSourcePayload } from '../scripts/hmh-source-model-lfs-check.mjs';

const manifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json', import.meta.url);
const outputRoot = new URL('../apps/portal/assets/generated/hmh-reboot-production-heroes/', import.meta.url);

const ACTION_CLIPS = Object.freeze({
  dash: { frames: 4, fps: 15, loop: false },
  melee: { frames: 5, fps: 15, loop: false },
  grenade: { frames: 5, fps: 12, loop: false },
  death: { frames: 6, fps: 8, loop: false },
});

const NATIVE_RASTER_SIZE = Object.freeze({ 'lit-commando': 256, 'lit-valkyrie': 256, lilly: 216, 'lester-original': 224 });

async function loadJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

for (const actorId of ['lit-commando', 'lit-valkyrie', 'lilly', 'lester-original']) {
  test(`${actorId} ships exact native source, inspection, render and atlas provenance`, async () => {
    const manifest = await loadJson(manifestUrl);
    const pilot = manifest.pilots.find((entry) => entry.actorId === actorId);
    assert.equal(pilot.sourceModel?.kind, 'packed-textured-blend', actorId);
    assert.deepEqual(pilot.frameSize, [NATIVE_RASTER_SIZE[actorId], NATIVE_RASTER_SIZE[actorId]]);
    const source = pilot.sourceModel;
    assert.ok(source.path.startsWith('apps/hmh-reboot/assets/source/models/tripo-gameplay/'));
    assert.deepEqual(evaluateDeclaredSourcePayload(await readFile(new URL(`../${source.path}`, import.meta.url)), source).problems, []);
    for (const evidence of [source.inspection, source.reproducibility]) {
      assert.ok(evidence?.path.startsWith('apps/hmh-reboot/assets/source/blender/'));
      assert.equal(createHash('sha256').update(await readFile(new URL(`../${evidence.path}`, import.meta.url))).digest('hex'), evidence.sha256);
    }
    const inspection = await loadJson(new URL(`../${source.inspection.path}`, import.meta.url));
    assert.deepEqual(Object.keys(inspection.actors), [actorId]);
    assert.equal(inspection.externalDependencyCount, 0);
    assert.equal(inspection.weaponSocket, true);
    assert.equal(inspection.bones.length, actorId === 'lilly' ? 24 : 22);
    assert.deepEqual(inspection.bones.filter((name) => name.startsWith('coat_tail.')), actorId === 'lilly' ? ['coat_tail.L', 'coat_tail.R'] : []);
    assert.equal(Object.keys(inspection.packedImageHashes).length, source.packedTextureCount);
    assert.deepEqual(inspection.actors[actorId].actions, Object.values(pilot.clipActions));
    const metrics = await loadJson(new URL(pilot.output.metrics, outputRoot));
    assert.equal(metrics.sourceBlendSha256, source.sourceSha256);
    assert.equal(metrics.sourceBlendBytes, source.sourceBytes);
    assert.equal(metrics.frameCount, 648);
    assert.equal(metrics.uniqueFrameIdCount, 648);
    assert.equal(metrics.status, 'pass');
    assert.deepEqual(metrics.reproducibilityBudget, manifest.reproducibilityBudget);
    assert.deepEqual(metrics.reproducibilityObserved, await loadJson(new URL(`../${source.reproducibility.path}`, import.meta.url)));
    for (const [key, bound] of Object.entries(manifest.reproducibilityBudget)) assert.ok(metrics.reproducibilityObserved[key] <= bound, key);
    for (const [output, hash] of [['atlas', 'atlasSha256'], ['metadata', 'metadataSha256'], ['contactSheet', 'contactSheetSha256']]) {
      assert.equal(createHash('sha256').update(await readFile(new URL(pilot.output[output], outputRoot))).digest('hex'), metrics[hash], `${actorId} ${output}`);
    }
    const atlas = await readFile(new URL(pilot.output.atlas, outputRoot));
    assert.equal(atlas.length, metrics.atlasBytes);
    assert.ok(atlas.length <= manifest.atlas.maxTextureBytesPerHero);
    assert.deepEqual(metrics.logicalFrameReconstruction, { frames: 648, pixelDifferences: 0 });
  });
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
  assert.equal(male.status, 'production-textured-gameplay');
  assert.deepEqual(male.frameSize, [256, 256]);
  assert.deepEqual(male.nativeWeaponIds, ['coin-blaster']);
  assert.deepEqual(male.nativeActionIds, ['melee', 'grenade']);
  assert.deepEqual(Object.keys(male.clipActions), ['idle', 'run', 'aim', 'pistol-fire', 'hurt', 'dash', 'melee', 'grenade', 'death']);
  assert.equal(male.sourceModel.format, 'blend');
  assert.equal(male.sourceModel.sourceSha256, '0c930374daccb2b9458a8600fdf3150dc51f6b5d8b4a47edcd05d92905fc6284');
  assert.equal(male.sourceModel.sourceBytes, 90056914);
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
  const blendUrl = new URL(`../${male.sourceModel.path}`, import.meta.url);
  const atlasUrl = new URL(paths.atlas, outputRoot);
  const metadataUrl = new URL(paths.metadata, outputRoot);
  const metricsUrl = new URL(paths.metrics, outputRoot);
  const sheetUrl = new URL(paths.contactSheet, outputRoot);
  await Promise.all([access(blendUrl), access(atlasUrl), access(metadataUrl), access(metricsUrl), access(sheetUrl)]);

  const metadata = await loadJson(metadataUrl);
  const metrics = await loadJson(metricsUrl);
  assert.equal(metadata.schemaVersion, 2);
  assert.equal(metadata.image, './lit-commando-production-pilot-atlas.webp');
  assert.deepEqual(metadata.nativeWeaponIds, ['coin-blaster']);
  assert.deepEqual(metadata.nativeActionIds, ['melee', 'grenade']);
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
  assert.equal(metrics.sourceBlendSha256, male.sourceModel.sourceSha256);
  assert.equal(metrics.sourceBlendBytes, male.sourceModel.sourceBytes);
  assert.equal(metrics.sourceKind, 'packed-textured-blend');
  assert.equal(metrics.decodedRgbaBytes, 2048 * 2048 * 4);
  assert.equal(metrics.atlasBytes, 3919100);
  assert.match(metrics.atlasSha256, /^[0-9a-f]{64}$/);
  assert.match(metrics.metadataSha256, /^[0-9a-f]{64}$/);
});

test('female production pilot preserves gameplay parity with a distinct Plasma Striker identity', async () => {
  const manifest = await loadJson(manifestUrl);
  const male = manifest.pilots.find((pilot) => pilot.actorId === 'lit-commando');
  const female = manifest.pilots.find((pilot) => pilot.actorId === 'lit-valkyrie');
  assert.ok(female, 'lit-valkyrie production pilot must exist');
  assert.equal(female.variantId, 'plasma-striker');
  assert.equal(female.status, 'production-textured-gameplay');
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
  assert.equal(metrics.uniqueAnimatedFrameCount, 624);
  assert.equal(metrics.intentionalHiddenFrameCount, 16);
  const frames = new Map(metadata.frames.map((frame) => [frame.id, frame]));
  assert.ok(metrics.duplicateDecodedFrameGroups.every((group) => group.frameIds.every((id) => frames.get(id)?.layer === 'shadow')
    || group.frameIds.every((id) => frames.get(id)?.visibility === 'source-prop-released')));
  assert.equal(metrics.externalDependencyCount, 0);
  assert.equal(metrics.weaponSocket, true);
  assert.equal(metrics.reproducibility, 'pass');
  assert.deepEqual(metrics.reproducibilityBudget, { maxChangedVisiblePixels: 8, maxChannelDelta: 2, maxTotalChannelDelta: 32 });
  for (const [key, bound] of Object.entries(metrics.reproducibilityBudget)) assert.ok(metrics.reproducibilityObserved[key] <= bound, key);
  assert.deepEqual(metrics.logicalFrameReconstruction, { frames: 648, pixelDifferences: 0 });
  assert.ok(metrics.atlasSize.width <= 2048);
  assert.match(metrics.atlasSha256, /^[0-9a-f]{64}$/);
});
