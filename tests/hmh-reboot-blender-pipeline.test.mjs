import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const MANIFEST_URL = new URL('apps/hmh-reboot/assets/source/blender/hmh-character-pipeline.json', ROOT);
const BLEND_URL = new URL('apps/hmh-reboot/assets/source/blender/hmh-character-template.blend', ROOT);
const CREATE_SCRIPT_URL = new URL('scripts/hmh-blender/create-hmh-character-template.py', ROOT);
const EXPORT_SCRIPT_URL = new URL('scripts/hmh-blender/export-hmh-mannequin.py', ROOT);
const PACK_SCRIPT_URL = new URL('scripts/build-hmh-blender-atlas.py', ROOT);
const RUN_SCRIPT_URL = new URL('scripts/run-hmh-blender-pipeline.py', ROOT);
const PACKAGE_URL = new URL('package.json', ROOT);
const PIPELINE_DOC_URL = new URL('docs/hmh-reboot/BLENDER-ATLAS-PIPELINE.md', ROOT);
const OUTPUT_ROOT = new URL('apps/portal/assets/generated/hmh-reboot-mannequin/', ROOT);
const ATLAS_URL = new URL('hmh-reboot-mannequin-atlas.png', OUTPUT_ROOT);
const METADATA_URL = new URL('hmh-reboot-mannequin-atlas.json', OUTPUT_ROOT);
const METRICS_URL = new URL('hmh-reboot-mannequin-metrics.json', OUTPUT_ROOT);
const CONTACT_URL = new URL('hmh-reboot-mannequin-contact-sheet.png', OUTPUT_ROOT);

const DIRECTIONS = Object.freeze([
  'south',
  'south-east',
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
]);

const REQUIRED_LAYERS = Object.freeze(['shadow', 'lower-body', 'torso-head', 'weapon']);

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function pngDimensions(url) {
  const png = readFileSync(url);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  return Object.freeze({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
}

function powerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function sha256(url) {
  return createHash('sha256').update(readFileSync(url)).digest('hex');
}

test('Blender pipeline manifest fixes deterministic scene, layer, direction, and pivot contracts', () => {
  const manifest = readJson(MANIFEST_URL);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, 'hmh-reboot-character-pipeline-v1');
  assert.equal(manifest.tool.name, 'Blender');
  assert.equal(manifest.tool.version, '5.1.2');
  assert.equal(manifest.scene.renderEngine, 'BLENDER_EEVEE');
  assert.equal(manifest.scene.camera.type, 'ORTHO');
  assert.deepEqual(manifest.scene.camera.rotationDegrees, [55, 0, 45]);
  assert.equal(manifest.scene.transparent, true);
  assert.equal(manifest.scene.samples, 1);
  assert.equal(manifest.scene.threads, 1);
  assert.equal(manifest.scene.randomSeed, 484848);
  assert.deepEqual(manifest.directions, DIRECTIONS);
  assert.deepEqual(manifest.directionAnglesDegrees, {
    south: 135,
    'south-east': 180,
    east: 225,
    'north-east': 270,
    north: 315,
    'north-west': 0,
    west: 45,
    'south-west': 90,
  });
  assert.deepEqual(manifest.layers.map((layer) => layer.id), REQUIRED_LAYERS);
  assert.ok(manifest.optionalLayers.includes('coat-hair'));
  assert.deepEqual(manifest.pivot.sourcePixels, [64, 104]);
  assert.equal(manifest.pivot.anchor, 'bottom-center-ground-contact');
  assert.ok(manifest.pivot.maxVariancePx <= 0.5);
  assert.deepEqual(manifest.scripts, {
    createScene: 'scripts/hmh-blender/create-hmh-character-template.py',
    export: 'scripts/hmh-blender/export-hmh-mannequin.py',
    pack: 'scripts/build-hmh-blender-atlas.py',
    run: 'scripts/run-hmh-blender-pipeline.py',
  });
  assert.deepEqual(manifest.render.frameSize, [128, 128]);
  assert.equal(manifest.render.fileFormat, 'PNG');
  assert.equal(manifest.render.colorMode, 'RGBA');
  assert.equal(manifest.atlas.padding, 2);
  assert.equal(manifest.atlas.powerOfTwo, true);
  assert.ok(manifest.atlas.maxSize <= 2048);
});

test('neutral mannequin pilot budgets independent leg run and torso aim layers', () => {
  const manifest = readJson(MANIFEST_URL);
  assert.equal(manifest.actor.id, 'neutral-mannequin');
  assert.equal(manifest.actor.classification, 'pipeline-pilot-not-production-art');
  assert.deepEqual(manifest.actor.anatomy, ['head', 'torso', 'arm-left', 'arm-right', 'leg-left', 'leg-right']);
  assert.deepEqual(manifest.clips, {
    shadow: { idle: { frames: 1, fps: 1 } },
    'lower-body': { idle: { frames: 1, fps: 1 }, run: { frames: 4, fps: 12 } },
    'torso-head': { aim: { frames: 1, fps: 1 } },
    weapon: { aim: { frames: 1, fps: 1 } },
  });
  assert.equal(manifest.composition.lowerBodyState, 'run');
  assert.equal(manifest.composition.upperBodyState, 'aim');
  assert.equal(manifest.composition.independentDirections, true);
  assert.equal(manifest.composition.weaponSocket, 'weapon_socket');
});

test('repo owns deterministic Blender source and export scripts', () => {
  assert.equal(existsSync(BLEND_URL), true, 'missing committed Blender scene source');
  const blendHeader = readFileSync(BLEND_URL).subarray(0, 7);
  const isLegacyBlend = blendHeader.toString('ascii') === 'BLENDER';
  const isZstdBlend = blendHeader.subarray(0, 4).toString('hex') === '28b52ffd';
  assert.equal(isLegacyBlend || isZstdBlend, true, 'invalid Blender source signature');
  for (const scriptUrl of [CREATE_SCRIPT_URL, EXPORT_SCRIPT_URL, PACK_SCRIPT_URL]) {
    assert.equal(existsSync(scriptUrl), true, `missing ${scriptUrl.pathname}`);
  }
  const createSource = readFileSync(CREATE_SCRIPT_URL, 'utf8');
  const exportSource = readFileSync(EXPORT_SCRIPT_URL, 'utf8');
  assert.match(createSource, /hmh_character_template/i);
  assert.match(createSource, /weapon_socket/);
  assert.match(createSource, /HMH_LowerBody/);
  assert.match(createSource, /HMH_TorsoHead/);
  assert.match(createSource, /HMH_Weapon/);
  assert.match(createSource, /HMH_Shadow/);
  assert.match(exportSource, /random\.seed\(manifest\["scene"\]\["randomSeed"\]\)/);
  assert.match(exportSource, /scene\.render\.film_transparent\s*=\s*True/);
  assert.match(exportSource, /scene\.render\.threads_mode\s*=\s*['"]FIXED['"]/);
});

test('one command owns Blender version checks, traceback detection, and reproducibility proof', () => {
  assert.equal(existsSync(RUN_SCRIPT_URL), true);
  const runner = readFileSync(RUN_SCRIPT_URL, 'utf8');
  const packageJson = readJson(PACKAGE_URL);
  assert.match(runner, /Blender 5\.1\.2/);
  assert.match(runner, /Traceback \(most recent call last\)/);
  assert.match(runner, /verify_reproducible/);
  assert.equal(packageJson.scripts['assets:hmh:blender-pipeline'], 'python scripts/run-hmh-blender-pipeline.py');
  assert.equal(packageJson.scripts['assets:hmh:blender-pipeline:verify'], 'python scripts/run-hmh-blender-pipeline.py --verify-reproducible');
  assert.equal(packageJson.scripts['smoke:hmh:blender-pilot'], 'node scripts/hmh-reboot-blender-pilot-browser-smoke.mjs');
});

test('pipeline runbook documents reproducible source, QA, runtime pilot, and authority boundaries', () => {
  const document = readFileSync(PIPELINE_DOC_URL, 'utf8');
  assert.match(document, /Blender 5\.1\.2/);
  assert.match(document, /npm run assets:hmh:blender-pipeline:verify/);
  assert.match(document, /npm run smoke:hmh:blender-pilot/);
  assert.match(document, /pipelinePilot=1/);
  assert.match(document, /64/);
  assert.match(document, /shadow.*lower-body.*torso-head.*weapon/s);
  assert.match(document, /ignored intermediate/i);
  assert.match(document, /render-only/i);
  assert.match(document, /no gameplay authority/i);
});

test('generated atlas has complete direction-layer-frame coverage and invariant ground pivots', () => {
  const manifest = readJson(MANIFEST_URL);
  const atlas = readJson(METADATA_URL);
  assert.equal(atlas.schemaVersion, 1);
  assert.equal(atlas.pipelineId, manifest.id);
  assert.equal(atlas.actorId, manifest.actor.id);
  assert.equal(atlas.image, './hmh-reboot-mannequin-atlas.png');
  assert.equal(atlas.frames.length, 64);
  assert.deepEqual(atlas.directions, DIRECTIONS);
  assert.deepEqual(atlas.layers, REQUIRED_LAYERS);
  assert.equal(new Set(atlas.frames.map((frame) => frame.id)).size, atlas.frames.length);

  const expected = new Set();
  for (const [layer, states] of Object.entries(manifest.clips)) {
    for (const [state, budget] of Object.entries(states)) {
      for (const direction of DIRECTIONS) {
        for (let frame = 0; frame < budget.frames; frame += 1) {
          expected.add(`${manifest.actor.id}__${layer}__${state}__${direction}__${String(frame).padStart(3, '0')}`);
        }
      }
    }
  }
  assert.deepEqual(new Set(atlas.frames.map((frame) => frame.id)), expected);

  for (const frame of atlas.frames) {
    assert.deepEqual(frame.sourceSize, { w: 128, h: 128 });
    assert.deepEqual(frame.sourcePivot, { x: 64, y: 104 });
    assert.ok(frame.frame.w > 0 && frame.frame.h > 0);
    assert.ok(frame.spriteSourceSize.x >= 0 && frame.spriteSourceSize.y >= 0);
    assert.ok(frame.pivot.x >= 0 && frame.pivot.x <= frame.frame.w);
    assert.ok(frame.pivot.y >= 0 && frame.pivot.y <= frame.frame.h);
    assert.ok(frame.opaquePixels > 0);
  }
});

test('atlas, metrics, and contact sheet satisfy deterministic QA budgets', () => {
  const manifest = readJson(MANIFEST_URL);
  const atlas = readJson(METADATA_URL);
  const metrics = readJson(METRICS_URL);
  const dimensions = pngDimensions(ATLAS_URL);
  const contact = pngDimensions(CONTACT_URL);
  assert.equal(powerOfTwo(dimensions.width), true);
  assert.equal(powerOfTwo(dimensions.height), true);
  assert.ok(dimensions.width <= manifest.atlas.maxSize && dimensions.height <= manifest.atlas.maxSize);
  assert.deepEqual(atlas.meta.size, dimensions);
  assert.equal(atlas.meta.padding, 2);
  assert.equal(metrics.status, 'pass');
  assert.equal(metrics.frameCount, 64);
  assert.equal(metrics.missingFrames.length, 0);
  assert.equal(metrics.unexpectedFrames.length, 0);
  assert.ok(metrics.maxPivotVariancePx <= manifest.pivot.maxVariancePx);
  assert.equal(metrics.transparentCornerFailures, 0);
  assert.equal(metrics.emptyFrameFailures, 0);
  assert.ok(metrics.maxOffPaletteRatio <= manifest.qa.maxOffPaletteRatio);
  assert.ok(metrics.minOpaquePixelsByLayer.shadow > 0);
  assert.ok(metrics.minOpaquePixelsByLayer['lower-body'] > 0);
  assert.ok(metrics.minOpaquePixelsByLayer['torso-head'] > 0);
  assert.ok(metrics.minOpaquePixelsByLayer.weapon > 0);
  assert.ok(metrics.meanAlphaByLayer.shadow <= manifest.qa.shadowMeanAlphaMax);
  assert.ok(metrics.meanAlphaByLayer.shadow >= manifest.qa.shadowMeanAlphaMin);
  assert.ok(metrics.meanAlphaByLayer['torso-head'] > 200);
  assert.deepEqual(metrics.reproducibility, {
    status: 'pass',
    runs: 2,
    rawFrameSetSha256: metrics.rawFrameSetSha256,
    atlasSha256: metrics.atlasSha256,
    metadataSha256: metrics.metadataSha256,
  });
  assert.ok(metrics.maxFrameWidth <= 128 && metrics.maxFrameHeight <= 128);
  assert.match(metrics.sourceBlendSha256, /^[a-f0-9]{64}$/);
  assert.match(metrics.atlasSha256, /^[a-f0-9]{64}$/);
  assert.equal(sha256(ATLAS_URL), metrics.atlasSha256);
  assert.equal(sha256(METADATA_URL), metrics.metadataSha256);
  assert.equal(readFileSync(METADATA_URL).includes(Buffer.from('\r\n')), false);
  assert.equal(readFileSync(METRICS_URL).includes(Buffer.from('\r\n')), false);
  assert.ok(contact.width >= 1024 && contact.height >= 512);
});
