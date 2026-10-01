import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ARCADE_CABINETS_3D, ARCADE_CABINET_FRAME } from '../apps/portal/assets/generated/arcade-cabinets-3d/arcade-cabinets-3d-manifest.mjs';
import { LESTERS_ARCADE_V2_APP_SHELL, ARCADE_GAMES } from '../apps/portal/src/arcade-core.mjs';
import { PORTAL_GAMES } from '../apps/portal/src/portal-content.mjs';
import { CABINET_FRAMING } from '../apps/portal/src/cabinet-presentation.mjs';
import { parseAtlasFrameRef } from '../apps/portal/src/atlas-frame-ref.mjs';

const GAMES = ['hard-money-heroes', 'chikun', 'stacked'];
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const manifestOf = (game) => JSON.parse(read(`apps/portal/assets/generated/arcade-cabinets-3d/${game}/manifest.json`));

// VP8X header: canvas size and the alpha flag of an extended WebP.
function webpInfo(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
  assert.equal(buffer.toString('ascii', 12, 16), 'VP8X', 'an extended WebP (needed for alpha)');
  return {
    alpha: (buffer[20] & 0x10) !== 0,
    width: 1 + buffer.readUIntLE(24, 3),
    height: 1 + buffer.readUIntLE(27, 3),
  };
}

test('every playable cabinet ships a budgeted, hashed 16-frame turntable and poster', () => {
  assert.deepEqual(Object.keys(ARCADE_CABINETS_3D), GAMES);
  assert.deepEqual({ ...ARCADE_CABINET_FRAME }, { width: 384, height: 420, count: 16, durationMs: 250 });
  for (const game of GAMES) {
    const manifest = manifestOf(game);
    const dir = `apps/portal/assets/generated/arcade-cabinets-3d/${game}/`;
    assert.equal(manifest.frames, 16);
    assert.equal(manifest.degreesPerFrame, 22.5);
    assert.equal(manifest.rects.length, 16);
    manifest.rects.forEach((rect, index) => assert.deepEqual(rect, [index * 384, 0, 384, 420]));
    const strip = read(dir + manifest.strip.src);
    const poster = read(dir + manifest.poster.src);
    assert.equal(strip.length, manifest.strip.bytes);
    assert.equal(poster.length, manifest.poster.bytes);
    assert.equal(sha256(strip), manifest.strip.sha256, `${game} strip hash`);
    assert.equal(sha256(poster), manifest.poster.sha256, `${game} poster hash`);
    assert.ok(strip.length <= 350_000, `${game} turntable ${strip.length} B is within 350 KB`);
    assert.ok(poster.length <= 30_000, `${game} poster ${poster.length} B is within 30 KB`);
    assert.deepEqual(webpInfo(strip), { alpha: true, width: 384 * 16, height: 420 }, `${game} strip is true-alpha`);
    assert.deepEqual(webpInfo(poster), { alpha: true, width: 384, height: 420 }, `${game} poster is true-alpha`);
    // Provenance: the textures, the Blender kit and the runner are all hashed.
    assert.equal(manifest.render.engine, 'CYCLES');
    assert.equal(manifest.render.filmTransparent, true);
    assert.equal(manifest.render.posterFrame, manifest.restFrame);
    assert.deepEqual(Object.keys(manifest.panels).sort(), ['back', 'control-front', 'deck', 'kick', 'marquee', 'screen', 'side-left', 'side-right']);
    for (const [name, panel] of Object.entries(manifest.panels)) {
      assert.equal(sha256(read(panel.texture)), panel.sha256, `${game} ${name} texture hash`);
      assert.equal(manifest.render.textures[`panel-${name}.webp`], panel.sha256, `${game} ${name} rendered from this texture`);
    }
    assert.equal(sha256(read(manifest.recipe.kit)), manifest.recipe.kitSha256, `${game} kit hash`);
    assert.equal(manifest.render.kitSha256, manifest.recipe.kitSha256);
  }
});

test('the catalog, splash and game list use the 3D turntables through the rotating-sprite component', () => {
  for (const game of GAMES) {
    const sprite = ARCADE_CABINETS_3D[game];
    const manifest = manifestOf(game);
    assert.equal(sprite.className, 'arcade-cabinet-3d-rotator');
    assert.equal(sprite.frames.length, 16);
    const regions = sprite.frames.map((frame) => parseAtlasFrameRef(frame.src));
    assert.ok(regions.every(Boolean), `${game} frames are atlas regions`);
    assert.equal(new Set(regions.map((region) => region.src)).size, 1, `${game} is one image request`);
    assert.ok(regions[0].src.includes(`${manifest.strip.src}?v=${manifest.strip.sha256.slice(0, 12)}`), `${game} strip is cache-busted by hash`);
    regions.forEach((region, index) => assert.deepEqual([region.x, region.y, region.width, region.height, region.atlasWidth, region.atlasHeight], [index * 384, 0, 384, 420, 6144, 420]));
    assert.ok(sprite.poster.endsWith(`${manifest.poster.src}?v=${manifest.poster.sha256.slice(0, 12)}`));
    assert.equal(CABINET_FRAMING[sprite.id].length, 16);
  }
  const shell = Object.fromEntries(LESTERS_ARCADE_V2_APP_SHELL.cabinets.map((cabinet) => [cabinet.id, cabinet.desktopCabinetSprite]));
  assert.equal(shell['hard-money-heroes'], ARCADE_CABINETS_3D['hard-money-heroes'], 'the splash and catalog HMH cabinet');
  assert.equal(shell.chikun, ARCADE_CABINETS_3D.chikun);
  assert.equal(shell.stacked, ARCADE_CABINETS_3D.stacked);
  for (const id of ['chikun', 'stacked']) assert.equal(ARCADE_GAMES.find((game) => game.id === id).desktopCabinetSprite, ARCADE_CABINETS_3D[id]);
  for (const game of PORTAL_GAMES) {
    assert.equal(game.sprite, ARCADE_CABINETS_3D[game.slug].id, `${game.slug} discovery framing key`);
    assert.equal(game.cabinet, ARCADE_CABINETS_3D[game.slug].poster);
  }
  const discoveryCss = read('apps/portal/portal-discovery.css').toString();
  for (const game of GAMES) {
    const rule = discoveryCss.match(new RegExp(`\\.catalog-static-cabinet\\.${game} \\{[^}]*\\}`))?.[0] ?? '';
    assert.ok(rule.includes(`url('${ARCADE_CABINETS_3D[game].poster}')`), `${game} pre-JavaScript catalog shows the poster`);
  }
});

test('reduced motion keeps exactly one frame, and it is the poster angle', () => {
  for (const game of GAMES) {
    const sprite = ARCADE_CABINETS_3D[game];
    const rest = sprite.frames.map((frame, index) => frame.rest ? index : -1).filter((index) => index >= 0);
    assert.deepEqual(rest, [sprite.restFrame], `${game} has one rest frame`);
    assert.equal(manifestOf(game).render.posterFrame, sprite.restFrame, `${game} rest frame is the frame copied to the poster`);
  }
  const css = read('apps/portal/styles.css').toString();
  assert.match(css, /\.arcade-cabinet-3d-rotator \{\s*--cabinet-frame-animation: arcadeCabinet3dFrame;/);
  assert.match(css, /@keyframes arcadeCabinet3dFrame \{\s*0%, 6\.2% \{ opacity: 1; \}\s*6\.25%, 100% \{ opacity: 0; \}/, 'each of 16 frames owns 1/16 of the loop');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.hmh-cabinet-rotator \{ animation: none; \}[^@]*\.cabinet-rotation-frame\[data-rest-frame="true"\] \{ opacity: 1; \}/, 'reduced motion shows only the rest frame');
  assert.match(css, /\.official-cabinet-grid\[data-cabinet-motion="paused"\] \.cabinet-rotation-frame/, 'the pause control stills the turntable');
});
