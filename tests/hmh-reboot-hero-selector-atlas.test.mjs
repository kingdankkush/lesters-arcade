import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
  assert.equal(manifest.pipelineId, 'hmh-reboot-hero-selector-atlas-v1');
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

test('selector atlas bytes match provenance metadata and deterministic builder output', () => {
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
