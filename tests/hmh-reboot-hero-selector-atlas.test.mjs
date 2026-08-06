import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { HMH_REBOOT_HERO_SELECTOR_ATLAS } from '../apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs';
import { parseAtlasFrameRef } from '../apps/portal/src/atlas-frame-ref.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IMAGE = fileURLToPath(new URL('../apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.png', import.meta.url));
const METADATA = fileURLToPath(new URL('../apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json', import.meta.url));

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

test('selector atlas is a frozen projection-only four-hero eight-direction manifest', () => {
  const manifest = HMH_REBOOT_HERO_SELECTOR_ATLAS;
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(manifest.pipelineId, 'hmh-reboot-hero-selector-atlas-v2');
  assert.equal(manifest.classification, 'production-art');
  assert.equal(manifest.runtimeAuthority, 'projection-only');
  assert.equal(manifest.gameplayAuthority, 'none');
  assert.deepEqual(Object.keys(manifest.heroes), ['lit-commando', 'lit-valkyrie', 'lester', 'lilly']);
  assert.deepEqual(manifest.atlasSize, { width: 1280, height: 640 });
  assert.equal(manifest.frameSize, 160);
  assert.equal(manifest.directions.length, 8);

  const expectedActors = {
    'lit-commando': 'lit-commando',
    'lit-valkyrie': 'lit-valkyrie',
    lester: 'lester-original',
    lilly: 'lilly',
  };
  for (const [heroId, actorId] of Object.entries(expectedActors)) {
    const hero = manifest.heroes[heroId];
    assert.equal(hero.actorId, actorId);
    assert.equal(hero.frames.length, 8);
    assert.ok(hero.frameDurationMs >= 240);
    for (const frame of hero.frames) {
      const region = parseAtlasFrameRef(frame);
      assert.ok(region, `${heroId}: invalid frame ref`);
      assert.equal(region.width, 160);
      assert.equal(region.height, 160);
      assert.ok(region.x >= 0 && region.x + region.width <= manifest.atlasSize.width);
      assert.ok(region.y >= 0 && region.y + region.height <= manifest.atlasSize.height);
    }
  }
});

test('selector atlas records bounded hero-card presentation framing without clipping', () => {
  const metadata = JSON.parse(readFileSync(METADATA, 'utf8'));
  assert.deepEqual(metadata.presentation, {
    scale: 1.15,
    bottomMargin: 10,
    resampling: 'lanczos',
    sourceFrameSize: 160,
  });
  for (const frame of metadata.frames) {
    assert.equal(frame.presentationScale, 1.15, `${frame.portalHeroId}/${frame.direction}: scale drift`);
    const bounds = frame.alphaBounds;
    assert.ok(bounds, `${frame.portalHeroId}/${frame.direction}: missing alpha bounds`);
    assert.ok(bounds.w >= 66 && bounds.w <= 82, `${frame.portalHeroId}/${frame.direction}: width ${bounds.w}`);
    assert.ok(bounds.h >= 126 && bounds.h <= 148, `${frame.portalHeroId}/${frame.direction}: height ${bounds.h}`);
    assert.ok(bounds.x >= 6 && bounds.y >= 4, `${frame.portalHeroId}/${frame.direction}: unsafe top/left margin`);
    assert.ok(bounds.x + bounds.w <= 154, `${frame.portalHeroId}/${frame.direction}: right crop`);
    assert.equal(bounds.y + bounds.h, 150, `${frame.portalHeroId}/${frame.direction}: grounding drift`);
  }
});

test('selector atlas tracked bytes match provenance and deterministic builder pixels', () => {
  const image = readFileSync(IMAGE);
  const metadata = JSON.parse(readFileSync(METADATA, 'utf8'));
  assert.equal(sha256(image), metadata.imageSha256);
  assert.equal(metadata.imageSha256, HMH_REBOOT_HERO_SELECTOR_ATLAS.imageSha256);
  assert.equal(metadata.frames.length, 32);
  assert.equal(metadata.sources.length, 4);
  assert.ok(metadata.frames.every((frame) => frame.opaquePixels > 3000));
  assert.ok(metadata.frames.every((frame) => frame.sourceFrames.length === 4));

  const check = spawnSync('python', ['scripts/build-hmh-reboot-hero-selector-atlas.py', '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /"status": "PASS"/);
});

test('selector atlas checker accepts pixel-identical PNG re-encoding with truthful provenance', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'hmh-selector-atlas-check-'));
  try {
    const metadata = JSON.parse(readFileSync(METADATA, 'utf8'));
    const relativePaths = [
      'scripts/build-hmh-reboot-hero-selector-atlas.py',
      'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.png',
      'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json',
      'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs',
      ...metadata.sources.flatMap((source) => [source.metadata, source.image]),
    ];
    for (const relativePath of relativePaths) {
      const sourcePath = join(ROOT, relativePath);
      const destinationPath = join(tempRoot, relativePath);
      mkdirSync(dirname(destinationPath), { recursive: true });
      cpSync(sourcePath, destinationPath);
    }

    const imagePath = join(tempRoot, 'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.png');
    const metadataPath = join(tempRoot, 'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json');
    const modulePath = join(tempRoot, 'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs');
    const originalImage = readFileSync(imagePath);
    const reencode = spawnSync('python', [
      '-c',
      'from PIL import Image; import sys; p=sys.argv[1]; im=Image.open(p).convert("RGBA"); im.save(p, format="PNG", optimize=False, compress_level=0)',
      imagePath,
    ], { encoding: 'utf8' });
    assert.equal(reencode.status, 0, reencode.stderr || reencode.stdout);

    const reencodedImage = readFileSync(imagePath);
    assert.notEqual(sha256(reencodedImage), sha256(originalImage));
    const reencodedSha256 = sha256(reencodedImage);
    const reencodedBytes = reencodedImage.length;

    metadata.imageSha256 = reencodedSha256;
    metadata.imageBytes = reencodedBytes;
    writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

    const moduleSource = readFileSync(modulePath, 'utf8')
      .replace(`"imageBytes":${originalImage.length}`, `"imageBytes":${reencodedBytes}`)
      .replace(HMH_REBOOT_HERO_SELECTOR_ATLAS.imageSha256, reencodedSha256);
    writeFileSync(modulePath, moduleSource);

    const check = spawnSync('python', ['scripts/build-hmh-reboot-hero-selector-atlas.py', '--check'], {
      cwd: tempRoot,
      encoding: 'utf8',
    });
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.match(check.stdout, /"status": "PASS"/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
