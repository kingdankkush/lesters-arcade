import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { HMH_REBOOT_HERO_SELECTOR_ATLAS } from '../apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs';
import { parseAtlasFrameRef } from '../apps/portal/src/atlas-frame-ref.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RENDER_MANIFEST = join(ROOT, 'apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json');
const HERO_MANIFEST = join(ROOT, 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json');
const RUNNER = join(ROOT, 'scripts/run-hmh-hero-selector-render.py');
const EXPORTER = join(ROOT, 'scripts/hmh-blender/export-hmh-hero-selector.py');
const METADATA = join(ROOT, 'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json');
const MODULE = join(ROOT, 'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs');
const PORTAL_ROOT = join(ROOT, 'apps/portal');

const SPIN_ORDER = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
const HERO_ORDER = ['lit-commando', 'lit-valkyrie', 'lester', 'lilly'];
const HERO_ACTORS = { 'lit-commando': 'lit-commando', 'lit-valkyrie': 'lit-valkyrie', lester: 'lester-original', lilly: 'lilly' };
const MAX_BYTES_PER_ATLAS = 512 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function portalPath(url) {
  return join(PORTAL_ROOT, url.replace(/^\//u, ''));
}

test('selector render manifest inherits the hero scene read-only at 384 px with the hero reproducibility budget', () => {
  assert.ok(existsSync(RENDER_MANIFEST), 'missing hmh-hero-selector-render.json');
  const manifest = readJson(RENDER_MANIFEST);
  const heroManifest = readJson(HERO_MANIFEST);
  assert.equal(manifest.schema, 'hmh-reboot-hero-selector-render-v1');
  assert.equal(manifest.pipelineId, 'hmh-reboot-hero-selector-atlas-v3');
  assert.equal(manifest.classification, 'production-art');
  assert.equal(manifest.runtimeAuthority, 'projection-only');
  assert.equal(manifest.gameplayAuthority, 'none');
  assert.equal(manifest.scene.sourceBlend, heroManifest.scene.sourceBlend);
  assert.equal(manifest.scene.sourceManifest, 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json');
  assert.equal(manifest.scene.heroExporter, heroManifest.scene.exporter);
  assert.equal(manifest.scene.exporter, 'scripts/hmh-blender/export-hmh-hero-selector.py');
  assert.equal(manifest.scene.blenderVersion, '5.1.2');
  assert.equal(manifest.scene.readOnly, true);
  assert.deepEqual(manifest.render.frameSize, [384, 384]);
  assert.equal(manifest.render.engine, heroManifest.render.engine);
  assert.equal(manifest.render.cameraOrthoScale, heroManifest.render.cameraOrthoScale);
  assert.equal(manifest.render.exposure, heroManifest.render.exposure);
  assert.equal(manifest.render.cameraPitchDegrees, heroManifest.render.cameraPitchDegrees);
  assert.equal(manifest.render.alphaThreshold, heroManifest.render.alphaThreshold);
  assert.equal(manifest.render.rawOutputDirectory, '.tmp/hmh-reboot-hero-selector');
  assert.deepEqual(manifest.directions, SPIN_ORDER);
  assert.equal(manifest.restDirection, 'south');
  assert.deepEqual(manifest.reproducibilityBudget, heroManifest.reproducibilityBudget);
  assert.deepEqual(manifest.reproducibilityBudget, { maxChangedVisiblePixels: 8, maxChannelDelta: 2, maxTotalChannelDelta: 32 });
  assert.deepEqual(manifest.heroes.map((hero) => hero.portalHeroId), HERO_ORDER);
  for (const hero of manifest.heroes) {
    assert.equal(hero.actorId, HERO_ACTORS[hero.portalHeroId]);
    assert.ok(heroManifest.pilots.some((pilot) => pilot.actorId === hero.actorId), `${hero.actorId} is not a production pilot`);
  }
  // The v2 LAYERS contract: idle legs and shadow under an aiming torso and weapon, frame 0 of each.
  assert.deepEqual(manifest.pose, {
    shadow: { state: 'idle', frameIndex: 0 },
    'lower-body': { state: 'idle', frameIndex: 0 },
    'torso-head': { state: 'aim', frameIndex: 0 },
    weapon: { state: 'aim', frameIndex: 0 },
  });
  assert.equal(manifest.frameDurationMs, 260);
  assert.equal(manifest.atlas.perHero, true);
  assert.deepEqual(manifest.atlas.grid, [4, 2]);
  assert.equal(manifest.atlas.outputDirectory, 'apps/portal/assets/generated/hmh-reboot-hero-selector');
  assert.equal(manifest.atlas.publicUrlBase, '/assets/generated/hmh-reboot-hero-selector');
  assert.equal(manifest.atlas.metadata, 'hmh-reboot-hero-selector-atlas.json');
  assert.equal(manifest.atlas.module, 'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs');
  assert.equal(manifest.atlas.maxBytesPerAtlas, MAX_BYTES_PER_ATLAS);
  assert.equal(manifest.atlas.maxTotalBytes, MAX_TOTAL_BYTES);
  // Anti-jitter contract: the turntable pivot is the rig origin projected through
  // the committed camera, not a per-frame alpha-bbox recentre (the v2 defect).
  assert.equal(manifest.groundContact.contract, 'rig-origin-projection');
  assert.equal(manifest.groundContact.pivotTolerancePx, 0.5);
  assert.deepEqual(manifest.groundContact.footLineEnvelopePx, { minBelowPivot: 8, maxBelowPivot: 64 });
});

test('selector runner locks both pipelines, proves two cold renders, never rebuilds or saves the hero scene, and stays Vercel-safe', () => {
  assert.ok(existsSync(RUNNER), 'missing scripts/run-hmh-hero-selector-render.py');
  assert.ok(existsSync(EXPORTER), 'missing scripts/hmh-blender/export-hmh-hero-selector.py');
  const runner = readFileSync(RUNNER, 'utf8');
  const exporter = readFileSync(EXPORTER, 'utf8');
  assert.match(runner, /exclusive_pipeline_lock/u);
  assert.match(runner, /hmh-reboot-hero-selector\.lock/u);
  assert.match(runner, /hmh-production-hero-pipeline\.lock/u);
  assert.match(runner, /blenderVersion/u);
  assert.match(runner, /Traceback \(most recent call last\)/u);
  assert.match(runner, /def compare_premultiplied/u);
  assert.match(runner, /bounded-premultiplied-rgba-v1/u);
  assert.match(runner, /hmh-reboot-hero-selector-drift-report\.json/u);
  assert.match(runner, /--check/u);
  assert.doesNotMatch(runner, /get_flattened_data/u);
  assert.match(runner, /for value in alpha\.tobytes\(\)/u);
  assert.doesNotMatch(runner, /create-hmh-production-hero-pilot/u, 'the selector runner must never regenerate the hero .blend');
  assert.doesNotMatch(runner, /hmh-reboot-production-heroes\//u, 'the selector runner must never write the shipped hero atlases');
  assert.doesNotMatch(exporter, /save_as_mainfile|save_mainfile/u, 'the selector exporter must open the committed .blend read-only');
  assert.match(exporter, /bpy\.data\.filepath/u);
  assert.match(exporter, /apply_pose/u);
  assert.match(exporter, /export-hmh-production-hero-pilot\.py/u);
  assert.match(exporter, /rotation_euler\[2\]/u);

  const packageJson = readJson(join(ROOT, 'package.json'));
  assert.equal(packageJson.scripts['assets:hmh:hero-selector'], 'python scripts/run-hmh-hero-selector-render.py');
  assert.equal(packageJson.scripts['check:hmh:hero-selector'], 'python scripts/run-hmh-hero-selector-render.py --check');
  assert.equal(packageJson.scripts['build:hmh:hero-selector'], undefined, 'the v2 Pillow recomposer is retired');
  assert.equal(existsSync(join(ROOT, 'scripts/build-hmh-reboot-hero-selector-atlas.py')), false, 'the v2 Pillow recomposer is retired');
  assert.equal(existsSync(join(ROOT, 'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.png')), false, 'the v2 single 160 px atlas is retired');

  const runbook = readFileSync(join(ROOT, 'docs/hmh-reboot/BLENDER-ATLAS-PIPELINE.md'), 'utf8');
  assert.match(runbook, /^## Hero selector turntables$/mu, 'the pipeline runbook needs a hero-selector section');
  for (const pinned of ['npm run assets:hmh:hero-selector', 'npm run check:hmh:hero-selector', 'hmh-hero-selector-render.json', 'bounded-premultiplied-rgba-v1', '524,288', '2,097,152', 'read-only', 'hmh-reboot-hero-selector-drift-report.json']) {
    assert.ok(runbook.includes(pinned), `runbook must document ${pinned}`);
  }

  const syntaxCheck = readFileSync(join(ROOT, 'scripts/syntax-check.mjs'), 'utf8');
  for (const listed of [
    'scripts/run-hmh-hero-selector-render.py',
    'scripts/hmh-blender/export-hmh-hero-selector.py',
    'tests/hmh-reboot-hero-selector-render.test.mjs',
    'tests/hmh-hero-select-ui.test.mjs',
    'apps/portal/src/hmh-hero-select-ui.mjs',
  ]) {
    assert.ok(syntaxCheck.includes(`"${listed}"`), `syntax-check.mjs must list ${listed}`);
  }
});

test('selector module is a frozen projection-only four-hero eight-direction 384 px per-hero atlas set', () => {
  const module = HMH_REBOOT_HERO_SELECTOR_ATLAS;
  assert.equal(Object.isFrozen(module), true);
  assert.equal(module.schemaVersion, 3);
  assert.equal(module.pipelineId, 'hmh-reboot-hero-selector-atlas-v3');
  assert.equal(module.classification, 'production-art');
  assert.equal(module.runtimeAuthority, 'projection-only');
  assert.equal(module.gameplayAuthority, 'none');
  assert.equal(module.frameSize, 384);
  assert.equal(module.frameCount, 32);
  assert.deepEqual(module.directions, SPIN_ORDER);
  assert.equal(module.restDirection, 'south');
  assert.equal(module.restFrameIndex, SPIN_ORDER.indexOf('south'));
  assert.equal(module.restFrameIndex, 6);
  assert.deepEqual(Object.keys(module.heroes), HERO_ORDER);
  assert.equal(module.image, undefined, 'v3 has no single shared atlas');

  let totalBytes = 0;
  for (const heroId of HERO_ORDER) {
    const hero = module.heroes[heroId];
    assert.equal(Object.isFrozen(hero), true);
    assert.equal(hero.actorId, HERO_ACTORS[heroId]);
    assert.match(hero.image, /^\/assets\/generated\/hmh-reboot-hero-selector\/[a-z-]+-selector-atlas\.png$/u);
    assert.deepEqual(hero.atlasSize, { width: 1536, height: 768 });
    assert.equal(hero.frames.length, 8);
    assert.ok(hero.frameDurationMs >= 240);
    const file = readFileSync(portalPath(hero.image));
    assert.equal(hero.imageBytes, file.length, `${heroId}: imageBytes drift`);
    assert.equal(hero.imageSha256, sha256(file), `${heroId}: imageSha256 drift`);
    assert.ok(hero.imageBytes <= MAX_BYTES_PER_ATLAS, `${heroId}: ${hero.imageBytes} exceeds the 512 KiB per-atlas cap`);
    totalBytes += hero.imageBytes;
    const cells = new Set();
    hero.frames.forEach((frame, index) => {
      const region = parseAtlasFrameRef(frame);
      assert.ok(region, `${heroId}[${index}]: invalid frame ref`);
      assert.equal(region.src, hero.image, `${heroId}[${index}]: every frame of a hero lives in that hero's atlas`);
      assert.equal(region.width, 384);
      assert.equal(region.height, 384);
      assert.equal(region.atlasWidth, 1536);
      assert.equal(region.atlasHeight, 768);
      assert.equal(region.x % 384, 0);
      assert.equal(region.y % 384, 0);
      cells.add(`${region.x},${region.y}`);
    });
    assert.equal(cells.size, 8, `${heroId}: frames must occupy eight distinct cells`);
  }
  assert.ok(totalBytes <= MAX_TOTAL_BYTES, `selector payload ${totalBytes} exceeds the 2 MiB total cap`);
});

test('selector metadata records a passing two-run render with a constant foot line and provenance to the committed scene', () => {
  const metadata = readJson(METADATA);
  const renderManifest = readJson(RENDER_MANIFEST);
  assert.equal(metadata.pipelineId, 'hmh-reboot-hero-selector-atlas-v3');
  assert.equal(metadata.schemaVersion, 3);
  assert.equal(metadata.runtimeAuthority, 'projection-only');
  assert.equal(metadata.frameCount, 32);
  assert.equal(metadata.frames.length, 32);
  assert.deepEqual(metadata.render.frameSize, [384, 384]);
  assert.equal(metadata.render.cameraOrthoScale, 2.75);
  assert.equal(metadata.render.exposure, -0.45);
  assert.equal(metadata.render.blenderVersion, '5.1.2');
  assert.deepEqual(metadata.pose, renderManifest.pose);

  assert.equal(metadata.metrics.status, 'pass');
  assert.equal(metadata.metrics.reproducibility, 'pass');
  assert.equal(metadata.metrics.reproducibilityMode, 'bounded-premultiplied-rgba-v1');
  assert.deepEqual(metadata.metrics.reproducibilityBudget, renderManifest.reproducibilityBudget);
  const observed = metadata.metrics.reproducibilityObserved;
  for (const key of ['maxChangedVisiblePixels', 'maxChannelDelta', 'maxTotalChannelDelta']) {
    assert.ok(Number.isInteger(observed[key]) && observed[key] >= 0);
    assert.ok(observed[key] <= renderManifest.reproducibilityBudget[key], `${key} ${observed[key]} exceeds budget`);
  }
  assert.ok(Number.isInteger(observed.driftedFrameCount) && observed.driftedFrameCount >= 0 && observed.driftedFrameCount <= 32);
  assert.equal(metadata.metrics.renderPasses, 2);
  assert.equal(metadata.metrics.maxBytesPerAtlas, MAX_BYTES_PER_ATLAS);
  assert.equal(metadata.metrics.maxTotalBytes, MAX_TOTAL_BYTES);
  assert.equal(metadata.metrics.totalImageBytes, Object.values(metadata.metrics.perAtlasBytes).reduce((sum, bytes) => sum + bytes, 0));
  assert.deepEqual(Object.keys(metadata.metrics.perAtlasBytes), HERO_ORDER);
  for (const heroId of HERO_ORDER) {
    assert.equal(metadata.metrics.perAtlasBytes[heroId], metadata.heroes[heroId].imageBytes);
    assert.equal(statSync(portalPath(metadata.heroes[heroId].image)).size, metadata.heroes[heroId].imageBytes);
  }

  assert.equal(metadata.sources.sourceBlend, renderManifest.scene.sourceBlend);
  assert.equal(metadata.sources.sourceBlendSha256, sha256(readFileSync(join(ROOT, renderManifest.scene.sourceBlend))));
  assert.equal(metadata.sources.sourceManifestSha256, sha256(readFileSync(HERO_MANIFEST)));
  assert.equal(metadata.sources.renderManifestSha256, sha256(readFileSync(RENDER_MANIFEST)));
  assert.match(metadata.sources.exporterSha256, /^[0-9a-f]{64}$/u);
  assert.match(metadata.sources.heroExporterSha256, /^[0-9a-f]{64}$/u);

  // The pivot is one integer pixel for all 32 frames of both passes; the exporter
  // projects the rig origin per frame and the runner refuses any movement > 0.5 px.
  const pivot = metadata.render.pivotPixels;
  assert.ok(Array.isArray(pivot) && pivot.length === 2 && pivot.every(Number.isInteger), 'pivotPixels must be an integer pair');
  assert.equal(pivot[0], 192, 'the camera aims at the rig column, so the pivot sits on the frame centre');
  assert.ok(pivot[1] > 192 && pivot[1] < 384, `pivot row ${pivot[1]} must be in the lower half of the frame`);
  assert.ok(Math.abs(metadata.render.projectedPivot[0] - pivot[0]) <= 0.5 && Math.abs(metadata.render.projectedPivot[1] - pivot[1]) <= 0.5);
  assert.deepEqual(metadata.groundContact, renderManifest.groundContact);
  const envelope = renderManifest.groundContact.footLineEnvelopePx;

  const footLines = new Map();
  for (const frame of metadata.frames) {
    assert.ok(HERO_ORDER.includes(frame.portalHeroId));
    assert.equal(frame.actorId, HERO_ACTORS[frame.portalHeroId]);
    assert.ok(SPIN_ORDER.includes(frame.direction));
    assert.deepEqual([frame.frame.w, frame.frame.h], [384, 384]);
    assert.ok(frame.opaquePixels > 9000, `${frame.portalHeroId}/${frame.direction}: opaquePixels ${frame.opaquePixels}`);
    const bounds = frame.alphaBounds;
    assert.ok(bounds.x >= 4 && bounds.y >= 4, `${frame.portalHeroId}/${frame.direction}: unsafe top/left margin`);
    assert.ok(bounds.x + bounds.w <= 380 && bounds.y + bounds.h <= 380, `${frame.portalHeroId}/${frame.direction}: crop`);
    assert.ok(bounds.h >= 240 && bounds.h <= 340, `${frame.portalHeroId}/${frame.direction}: hero height ${bounds.h} outside the 384 px selector envelope`);
    assert.equal(frame.footLineY, bounds.y + bounds.h);
    assert.ok(frame.footLineY >= pivot[1] + envelope.minBelowPivot && frame.footLineY <= pivot[1] + envelope.maxBelowPivot, `${frame.portalHeroId}/${frame.direction}: foot line ${frame.footLineY} outside the ground-contact envelope around ${pivot[1]}`);
    assert.match(frame.pixelSha256, /^[0-9a-f]{64}$/u);
    footLines.set(frame.portalHeroId, [...(footLines.get(frame.portalHeroId) ?? []), frame.footLineY]);
  }
  for (const [heroId, lines] of footLines) {
    assert.equal(lines.length, 8);
    // The shadow ellipse turns with the hero, so the alpha bottom legitimately
    // moves; it is recorded per hero as information and must match the frames.
    assert.equal(metadata.metrics.footLineSpreadPx[heroId], Math.max(...lines) - Math.min(...lines));
    assert.ok(metadata.metrics.footLineSpreadPx[heroId] <= envelope.maxBelowPivot - envelope.minBelowPivot);
  }
});

test('selector --check is Blender-free and re-verifies tracked pixels, bytes, module and scene provenance', () => {
  const check = spawnSync('python', ['scripts/run-hmh-hero-selector-render.py', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /"status": "PASS"/u);
  assert.match(check.stdout, /"pipelineId": "hmh-reboot-hero-selector-atlas-v3"/u);
  assert.match(check.stdout, /"blender": false/u);
});

test('selector checker accepts a pixel-identical per-hero PNG re-encode with truthful provenance', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'hmh-selector-render-check-'));
  try {
    const metadata = readJson(METADATA);
    const renderManifest = readJson(RENDER_MANIFEST);
    const relativePaths = [
      'scripts/run-hmh-hero-selector-render.py',
      'scripts/hmh_pipeline_lock.py',
      'apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json',
      'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json',
      renderManifest.scene.sourceBlend,
      renderManifest.scene.exporter,
      renderManifest.scene.heroExporter,
      'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json',
      'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs',
      ...HERO_ORDER.map((heroId) => metadata.heroes[heroId].image.replace(/^\//u, 'apps/portal/')),
    ];
    for (const relativePath of relativePaths) {
      const destinationPath = join(tempRoot, relativePath);
      mkdirSync(dirname(destinationPath), { recursive: true });
      cpSync(join(ROOT, relativePath), destinationPath);
    }

    const heroId = 'lit-commando';
    const hero = metadata.heroes[heroId];
    const imagePath = join(tempRoot, hero.image.replace(/^\//u, 'apps/portal/'));
    const originalImage = readFileSync(imagePath);
    const reencode = spawnSync('python', [
      '-c',
      // Pillow's default deflate level: a different byte stream for the same
      // pixels that still respects the per-atlas cap (level 0 would be ~4.7 MB
      // and must fail --check on bytes, not on pixels).
      'from PIL import Image; import sys; p=sys.argv[1]; im=Image.open(p).convert("RGBA"); im.save(p, format="PNG", optimize=False, compress_level=6)',
      imagePath,
    ], { encoding: 'utf8' });
    assert.equal(reencode.status, 0, reencode.stderr || reencode.stdout);
    const reencodedImage = readFileSync(imagePath);
    assert.notEqual(sha256(reencodedImage), sha256(originalImage));
    assert.ok(reencodedImage.length <= MAX_BYTES_PER_ATLAS, `re-encode ${reencodedImage.length} must stay under the per-atlas cap for this tolerance test`);

    const patched = structuredClone(metadata);
    patched.heroes[heroId].imageBytes = reencodedImage.length;
    patched.heroes[heroId].imageSha256 = sha256(reencodedImage);
    patched.metrics.perAtlasBytes[heroId] = reencodedImage.length;
    patched.metrics.totalImageBytes += reencodedImage.length - originalImage.length;
    writeFileSync(join(tempRoot, 'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json'), `${JSON.stringify(patched, null, 2)}\n`);
    const modulePath = join(tempRoot, 'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs');
    const needle = `"imageBytes":${hero.imageBytes},"imageSha256":"${hero.imageSha256}"`;
    const moduleSource = readFileSync(modulePath, 'utf8');
    assert.ok(moduleSource.includes(needle), 'module must carry imageBytes and imageSha256 adjacently per hero');
    writeFileSync(modulePath, moduleSource.replace(needle, `"imageBytes":${reencodedImage.length},"imageSha256":"${sha256(reencodedImage)}"`));

    const check = spawnSync('python', ['scripts/run-hmh-hero-selector-render.py', '--check'], { cwd: tempRoot, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.match(check.stdout, /"status": "PASS"/u);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('selector checker rejects a pixel change even when provenance is patched to match', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'hmh-selector-render-tamper-'));
  try {
    const metadata = readJson(METADATA);
    const renderManifest = readJson(RENDER_MANIFEST);
    const relativePaths = [
      'scripts/run-hmh-hero-selector-render.py',
      'scripts/hmh_pipeline_lock.py',
      'apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json',
      'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json',
      renderManifest.scene.sourceBlend,
      renderManifest.scene.exporter,
      renderManifest.scene.heroExporter,
      'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json',
      'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs',
      ...HERO_ORDER.map((heroId) => metadata.heroes[heroId].image.replace(/^\//u, 'apps/portal/')),
    ];
    for (const relativePath of relativePaths) {
      const destinationPath = join(tempRoot, relativePath);
      mkdirSync(dirname(destinationPath), { recursive: true });
      cpSync(join(ROOT, relativePath), destinationPath);
    }
    const heroId = 'lilly';
    const hero = metadata.heroes[heroId];
    const imagePath = join(tempRoot, hero.image.replace(/^\//u, 'apps/portal/'));
    const tamper = spawnSync('python', [
      '-c',
      'from PIL import Image; import sys; p=sys.argv[1]; im=Image.open(p).convert("RGBA"); im.putpixel((200, 200), (255, 0, 255, 255)); im.save(p, format="PNG", optimize=False, compress_level=9)',
      imagePath,
    ], { encoding: 'utf8' });
    assert.equal(tamper.status, 0, tamper.stderr || tamper.stdout);
    const tampered = readFileSync(imagePath);
    const patched = structuredClone(metadata);
    patched.metrics.totalImageBytes += tampered.length - hero.imageBytes;
    patched.heroes[heroId].imageBytes = tampered.length;
    patched.heroes[heroId].imageSha256 = sha256(tampered);
    patched.metrics.perAtlasBytes[heroId] = tampered.length;
    writeFileSync(join(tempRoot, 'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json'), `${JSON.stringify(patched, null, 2)}\n`);
    const modulePath = join(tempRoot, 'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs');
    const needle = `"imageBytes":${hero.imageBytes},"imageSha256":"${hero.imageSha256}"`;
    writeFileSync(modulePath, readFileSync(modulePath, 'utf8').replace(needle, `"imageBytes":${tampered.length},"imageSha256":"${sha256(tampered)}"`));

    const check = spawnSync('python', ['scripts/run-hmh-hero-selector-render.py', '--check'], { cwd: tempRoot, encoding: 'utf8' });
    assert.notEqual(check.status, 0, 'a tampered pixel must fail --check');
    assert.match(check.stderr + check.stdout, /pixelSha256|drift/u);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
