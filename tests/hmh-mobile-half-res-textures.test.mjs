// Perf step 6: phones load half-resolution texture pages.
//
// The variants are Pixi `@0.5x` files, so the half page decodes with
// source.resolution 0.5 and keeps the full page's logical size. These tests pin
// that contract end to end: which URLs switch on which profile, that every
// switched URL has a fresh variant on disk, that Pixi reads the suffix as a
// resolution, and that a display cut from the half page draws exactly the
// size and anchor of the full one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Container, Rectangle, Sprite, Texture, TextureSource, TilingSprite, getResolutionOfUrl } from 'pixi.js';
import { readImageDimensions } from '../scripts/lib/hmh-perf-analysis.mjs';
import {
  RUNTIME_PERFORMANCE_PROFILES,
  createProfileTextureLoader,
  profileTextureUrl,
  selectRuntimePerformanceProfile,
} from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { PRODUCTION_HERO_ASSETS } from '../apps/hmh-reboot/src/production-hero-assets.mjs';
import { createProductionHeroAtlasIndex, createProductionHeroDisplay } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';
import { createHeroMotionIndex } from '../apps/hmh-reboot/src/hero-motion-atlas.mjs';
import { HELD_WEAPON_IDS, createHeldWeaponIndex, heldWeaponMetadataUrl } from '../apps/hmh-reboot/src/held-weapon-atlas.mjs';
import { ENEMY_ROSTER_ACTORS, createEnemyRosterAtlasIndex, createEnemyRosterDisplay, enemyRosterAsset } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';
import { AUTHORED_PROP_ATLAS_IMAGE_URL } from '../apps/hmh-reboot/src/authored-prop-layout.mjs';
import { TRIPO_PROP_METADATA_URL, createTripoPropAppearance } from '../apps/hmh-reboot/src/tripo-prop-appearance.mjs';
import { createAuthoredPropAtlasIndex } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import {
  TERRAIN_MATERIAL_IDS, TERRAIN_OVERLAY_IDS, createTerrainTileRegistry, terrainFringeAsset, terrainManifestUrl, terrainOverlayAsset, terrainTileAsset,
} from '../apps/hmh-reboot/src/terrain-tile-atlas.mjs';

const PORTAL = new URL('../apps/portal/', import.meta.url);
const GENERATED = new URL('../apps/portal/assets/generated/', import.meta.url);
const MANIFEST = JSON.parse(readFileSync(new URL('hmh-mobile-half-res.json', GENERATED), 'utf8'));
const mobile = RUNTIME_PERFORMANCE_PROFILES.mobile;
const desktop = RUNTIME_PERFORMANCE_PROFILES.desktop;
const reducedMotion = RUNTIME_PERFORMANCE_PROFILES.reducedMotion;
const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
// Runtime URLs are either site-absolute (/assets/...) or relative to the
// child page (../assets/...); both resolve under apps/portal.
const fileFor = (url) => new URL(`.${url.replace(/^\.\./u, '').replace(/\?.*$/u, '')}`, PORTAL);
const generatedPath = (url) => fileFor(url).href.slice(GENERATED.href.length);

// Every texture page the child can pass through the profile loader, built from
// the same modules and metadata the runtime uses.
function runtimePageUrls() {
  const urls = [];
  for (const hero of Object.values(PRODUCTION_HERO_ASSETS)) {
    urls.push(hero.imageUrl);
    urls.push(`/assets/generated/hmh-hero-motion/${hero.actorId}/${hero.actorId}-motion.webp`);
    const held = readJson(fileFor(heldWeaponMetadataUrl(hero.actorId)));
    for (const weapon of Object.values(held.weapons)) {
      for (const page of weapon.pages) urls.push(`/assets/generated/hmh-held-weapons/${hero.actorId}/${page.image.replace(/^\.\//u, '')}`);
    }
  }
  for (const actor of ENEMY_ROSTER_ACTORS) urls.push(enemyRosterAsset(actor).imageUrl);
  urls.push(AUTHORED_PROP_ATLAS_IMAGE_URL);
  for (const page of readJson(fileFor(TRIPO_PROP_METADATA_URL)).pages) urls.push(`/assets/generated/hmh-reboot-tripo-props/${page.image}`);
  for (const id of TERRAIN_MATERIAL_IDS) urls.push(terrainTileAsset(id).imageUrl, terrainFringeAsset(id).imageUrl);
  for (const id of TERRAIN_OVERLAY_IDS) urls.push(terrainOverlayAsset(id).imageUrl);
  return urls;
}

test('the mobile profile swaps every runtime page for its @0.5x variant; desktop and reduced motion keep full pages', () => {
  const urls = runtimePageUrls();
  assert.equal(urls.length, 75);
  for (const url of urls) {
    const variant = profileTextureUrl(url, mobile);
    assert.notEqual(variant, url, url);
    assert.match(variant, /@0\.5x\.webp(\?|$)/u, url);
    assert.equal(variant.replace(/@0\.5x\.webp/u, ''), url.replace(/\.(png|webp)/u, ''), 'only the file name changes');
    assert.ok(existsSync(fileFor(variant)), `${variant} is on disk`);
    assert.equal(profileTextureUrl(url, desktop), url);
    assert.equal(profileTextureUrl(url, reducedMotion), url);
  }
  // The profile selector itself: a phone viewport or a coarse pointer is the
  // mobile profile; reduced motion wins over both and stays full size.
  assert.equal(selectRuntimePerformanceProfile({ width: 414, devicePixelRatio: 3, coarsePointer: true, reduceMotion: false }).id, 'mobile');
  assert.equal(selectRuntimePerformanceProfile({ width: 1440, devicePixelRatio: 1, coarsePointer: false, reduceMotion: false }).id, 'desktop');
});

test('pages that already carry their own tiers, and anything that is not a runtime page, are never rewritten', () => {
  for (const url of [
    '/assets/generated/hmh-world-design/world-design-mobile.webp',
    '/assets/generated/hmh-world-design/world-design-desktop.webp',
    '/assets/generated/hmh-barriers/barriers-mobile.webp',
    '/assets/generated/hmh-silver-coin/silver-coin.png',
    '/assets/generated/hmh-reboot-mannequin/hmh-reboot-mannequin-atlas.png',
    '/assets/generated/hmh-reboot-enemy-roster/forkrunner/forkrunner-roster-atlas.png',
    '/assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.json',
    '/assets/generated/hmh-reboot-tripo-props/hmh-tripo-props.json',
    'https://example.com/assets/generated/hmh-native-roster/forkrunner/forkrunner-native-roster.webp',
  ]) assert.equal(profileTextureUrl(url, mobile), url, url);
});

test('Pixi reads the variant suffix as resolution 0.5, query strings included', () => {
  for (const url of runtimePageUrls()) {
    assert.equal(getResolutionOfUrl(profileTextureUrl(url, mobile)), 0.5, url);
    assert.equal(getResolutionOfUrl(url), 1, url);
  }
});

test('the manifest lists exactly the runtime pages, each variant fresh, half size and byte-exact', () => {
  assert.equal(MANIFEST.pipelineId, 'hmh-mobile-half-res/v1');
  assert.equal(MANIFEST.runtimeAuthority, 'projection-only');
  assert.equal(MANIFEST.resolution, 0.5);
  assert.equal(MANIFEST.suffix, '@0.5x.webp');
  const expected = runtimePageUrls().map(generatedPath).sort();
  assert.deepEqual(MANIFEST.pages.map((page) => page.source).sort(), expected);
  let sourceRgba = 0;
  let outputRgba = 0;
  for (const page of MANIFEST.pages) {
    const source = readFileSync(new URL(page.source, GENERATED));
    // A regenerated source page without a rebuilt variant must fail here.
    assert.equal(sha256(source), page.sourceSha256, `${page.source} changed; run python scripts/build-hmh-mobile-half-res.py`);
    const sourceSize = readImageDimensions(source);
    assert.deepEqual([sourceSize.width, sourceSize.height], [page.sourceWidth, page.sourceHeight], page.source);
    assert.equal(page.output, page.source.replace(/\.(png|webp)$/u, '@0.5x.webp'));
    const output = readFileSync(new URL(page.output, GENERATED));
    assert.equal(output.length, page.outputBytes, page.output);
    assert.equal(sha256(output), page.outputSha256, page.output);
    const size = readImageDimensions(output);
    assert.equal(size.format, 'webp');
    assert.deepEqual([size.width * 2, size.height * 2], [page.sourceWidth, page.sourceHeight], page.output);
    sourceRgba += page.sourceWidth * page.sourceHeight * 4;
    outputRgba += size.width * size.height * 4;
  }
  assert.equal(outputRgba * 4, sourceRgba, 'decoded pages are exactly a quarter of the full pages');
  assert.equal(MANIFEST.totals.outputRgbaBytes, outputRgba);
});

test('the mobile loader requests the variant, falls back to the full page if the variant fails, and desktop is untouched', async () => {
  const calls = [];
  const Assets = { load: async (url) => { calls.push(url); if (url.includes('missing') && url.includes('@0.5x')) throw new Error('404'); return { url }; } };
  assert.equal(createProfileTextureLoader(Assets, desktop), Assets);
  assert.equal(createProfileTextureLoader(Assets, reducedMotion), Assets);
  const loader = createProfileTextureLoader(Assets, mobile);
  const pilot = PRODUCTION_HERO_ASSETS.lilly.imageUrl;
  assert.deepEqual(await loader.load(pilot), { url: profileTextureUrl(pilot, mobile) });
  assert.deepEqual(await loader.load('/assets/generated/hmh-silver-coin/silver-coin.png'), { url: '/assets/generated/hmh-silver-coin/silver-coin.png' });
  const missing = '/assets/generated/hmh-native-roster/missing/missing-native-roster.webp';
  assert.deepEqual(await loader.load(missing), { url: missing });
  assert.deepEqual(calls.slice(-2), ['/assets/generated/hmh-native-roster/missing/missing-native-roster@0.5x.webp', missing]);
});

function rosterDisplay(actorId, source) {
  const metadata = readJson(fileFor(enemyRosterAsset(actorId).metadataUrl));
  const index = createEnemyRosterAtlasIndex(metadata, actorId);
  return createEnemyRosterDisplay({
    index, atlasTexture: new Texture({ source }), ContainerClass: Container, SpriteClass: Sprite,
    TextureClass: Texture, RectangleClass: Rectangle, scale: 1,
  });
}

test('a roster display cut from the half page draws every pose at the full page size, anchor and UVs', () => {
  for (const actorId of ['forkrunner', 'bagholder-rusher']) {
    const page = MANIFEST.pages.find((entry) => entry.source.includes(`/${actorId}/`));
    const full = new TextureSource({ width: page.sourceWidth, height: page.sourceHeight, resolution: 1 });
    const half = new TextureSource({ width: page.sourceWidth, height: page.sourceHeight, resolution: 0.5 });
    assert.deepEqual([half.pixelWidth * 2, half.pixelHeight * 2], [page.sourceWidth, page.sourceHeight]);
    const a = rosterDisplay(actorId, full);
    const b = rosterDisplay(actorId, half);
    const body = (display) => display.children.find((child) => child.label?.startsWith('roster-body-'));
    for (const state of ['idle', 'run', 'attack', 'death']) {
      for (let direction = 0; direction < 8; direction += 1) {
        for (const tick of [0, 7, 19]) {
          a.applyPose({ state, direction, tick });
          b.applyPose({ state, direction, tick });
          const [sa, sb] = [body(a), body(b)];
          assert.deepEqual([sb.width, sb.height, sb.anchor.x, sb.anchor.y], [sa.width, sa.height, sa.anchor.x, sa.anchor.y]);
          const [ua, ub] = [sa.texture.uvs, sb.texture.uvs];
          assert.deepEqual([ub.x0, ub.y0, ub.x2, ub.y2], [ua.x0, ua.y0, ua.x2, ua.y2]);
        }
      }
    }
  }
});

test('native Tripo prop pages validate against their logical size, so the half pages are accepted', () => {
  const metadata = readJson(fileFor(TRIPO_PROP_METADATA_URL));
  const index = createAuthoredPropAtlasIndex(readJson(fileFor(AUTHORED_PROP_ATLAS_IMAGE_URL.replace(/\.png$/u, '.json'))));
  const half = metadata.pages.map((page) => ({ source: new TextureSource({ width: page.width, height: page.height, resolution: 0.5 }) }));
  const appearance = createTripoPropAppearance(metadata, half, index);
  assert.ok(appearance.size > 40);
  // A page whose logical size disagrees with its metadata is still refused.
  const wrong = [{ source: new TextureSource({ width: 1024, height: 1024, resolution: 1 }) }, half[1]];
  assert.throws(() => createTripoPropAppearance(metadata, wrong, index), /decoded texture dimensions/u);
});

test('the child loads every scalable page through the profile texture loader', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const textureAssets = createProfileTextureLoader\(Assets, performanceProfile\)/u);
  for (const call of [
    'textureAssets.load(selection.imageUrl)',
    'textureAssets.load(AUTHORED_PROP_ATLAS_IMAGE_URL)',
    'loadTripoPropAppearance(propIndex, (url) => textureAssets.load(url))',
    'textureAssets.load(asset.imageUrl)',
    'textureAssets\n            .load(terrainTileAsset(materialId).imageUrl)',
    'textureAssets\n            .load(terrainFringeAsset(materialId).imageUrl)',
    '.load(terrainOverlayAsset(overlayId).imageUrl)',
    'loadHeroMotionPage({ selection, baseIndex, Assets: textureAssets })',
    'createHeldWeaponLoader({ selection, display, Assets: textureAssets })',
  ]) assert.ok(main.includes(call), call);
  // Only the pages with their own mobile tiers and the pilot-only mannequin
  // still load straight through Pixi.
  const direct = [...main.matchAll(/\bAssets\.load\(([^)]*)\)/gu)].map((match) => match[1]);
  assert.deepEqual(direct, ['MANNEQUIN_ATLAS_IMAGE_URL', 'url', 'url']);
});

// A TextureSource of the page's logical size at the given resolution: what
// Pixi builds for `<page>.webp` (1) and for `<page>@0.5x.webp` (0.5).
const sourceFor = (url, resolution) => {
  const size = readImageDimensions(readFileSync(fileFor(url)));
  return new TextureSource({ width: size.width, height: size.height, resolution });
};
const spriteGeometry = (sprite) => [
  sprite.width, sprite.height, sprite.anchor.x, sprite.anchor.y, sprite.scale.x, sprite.scale.y,
  sprite.texture.frame.x, sprite.texture.frame.y, sprite.texture.frame.width, sprite.texture.frame.height,
  sprite.texture.uvs.x0, sprite.texture.uvs.y0, sprite.texture.uvs.x2, sprite.texture.uvs.y2,
];

test('a hero built from half pilot, motion and held-weapon pages validates and draws every layer at the full page geometry', () => {
  for (const hero of Object.values(PRODUCTION_HERO_ASSETS)) {
    const pilotMetadata = readJson(fileFor(hero.metadataUrl));
    const motionMetadata = readJson(fileFor(`/assets/generated/hmh-hero-motion/${hero.actorId}/${hero.actorId}-motion.json`));
    const heldMetadata = readJson(fileFor(heldWeaponMetadataUrl(hero.actorId)));
    const build = (resolution) => {
      const index = createProductionHeroAtlasIndex(pilotMetadata, hero);
      const display = createProductionHeroDisplay({
        index, atlasTexture: new Texture({ source: sourceFor(hero.imageUrl, resolution) }),
        ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle,
      });
      // The same validators main.mjs runs after Assets.load: logical sizes.
      const motionIndex = createHeroMotionIndex(index, motionMetadata);
      display.attachMotionPage({ index: motionIndex, motionTexture: new Texture({ source: sourceFor(`/assets/generated/hmh-hero-motion/${hero.actorId}/${hero.actorId}-motion.webp`, resolution) }) });
      const heldIndex = createHeldWeaponIndex(heldMetadata, { actorId: hero.actorId });
      for (const weaponId of HELD_WEAPON_IDS) {
        const page = heldIndex.pageFor(weaponId);
        display.attachHeldWeaponPage({ weaponId, index: heldIndex, textures: page.pages.map((image) => new Texture({ source: sourceFor(`/assets/generated/hmh-held-weapons/${hero.actorId}/${image.image.replace(/^\.\//u, '')}`, resolution) })) });
      }
      return display;
    };
    const full = build(1);
    const half = build(0.5);
    assert.equal(half.container.motionStatus, 'ready');
    const layer = (display, name) => display.container.children.find((child) => child.label === `production-hero-${name}`);
    let poses = 0;
    for (const weaponId of ['coin-blaster', ...HELD_WEAPON_IDS]) {
      for (const action of ['aim', 'pistol-fire', 'melee']) {
        for (let direction = 0; direction < 8; direction += 1) {
          for (const [simulationTick, actionTick, reloadProgress] of [[0, 0, undefined], [23, 5, undefined], [40, 0, 0.5]]) {
            const state = { weaponId, simulationTick, actionTick, locomotion: direction % 2 ? 'run' : 'idle', legDirection: direction, torsoDirection: (direction + 3) % 8, action, ...(reloadProgress === undefined ? {} : { reloadProgress }) };
            const shownFull = full.applyPose(state);
            const shownHalf = half.applyPose(state);
            assert.deepEqual(shownHalf.map((frame) => frame.id), shownFull.map((frame) => frame.id));
            assert.equal(half.container.frameIds, full.container.frameIds);
            assert.deepEqual(half.container.heldWeaponMuzzle, full.container.heldWeaponMuzzle);
            for (const name of full.layerOrder) {
              const [a, b] = [layer(full, name), layer(half, name)];
              assert.deepEqual(spriteGeometry(b), spriteGeometry(a), `${hero.actorId} ${name} ${JSON.stringify(state)}`);
              // The half page really is half: same logical size, half the texels.
              assert.equal(b.texture.source.width, a.texture.source.width);
              assert.equal(b.texture.source.pixelWidth * 2, a.texture.source.pixelWidth);
            }
            poses += 1;
          }
        }
      }
    }
    assert.equal(poses, 8 * 3 * 8 * 3);
  }
});

test('terrain tiles, fringes and overlays from half pages tile with the same texture matrix, repeat modes and manifest tile size', () => {
  const manifest = readJson(fileFor(terrainManifestUrl()));
  const build = (resolution) => {
    const registry = createTerrainTileRegistry({ TilingSpriteClass: TilingSprite });
    registry.setManifest(manifest);
    for (const id of TERRAIN_MATERIAL_IDS) {
      registry.register(id, new Texture({ source: sourceFor(terrainTileAsset(id).imageUrl, resolution) }));
      registry.registerFringe(id, new Texture({ source: sourceFor(terrainFringeAsset(id).imageUrl, resolution) }));
    }
    for (const id of TERRAIN_OVERLAY_IDS) registry.registerOverlay(id, new Texture({ source: sourceFor(terrainOverlayAsset(id).imageUrl, resolution) }));
    return registry;
  };
  const full = build(1);
  const half = build(0.5);
  assert.deepEqual([half.tileSize, half.fringeHeight, half.overlayHeight], [full.tileSize, full.fringeHeight, full.overlayHeight]);
  assert.equal(half.tileSize, 512, 'the world scale formula reads the manifest, never the decoded page');
  const matrix = (texture) => {
    const tm = texture.textureMatrix;
    tm.update();
    const { a, b, c, d, tx, ty } = tm.mapCoord;
    const texels = texture.source.pixelWidth;
    // The clamp frame is inset half a texel from each edge whatever the
    // resolution (Pixi divides its 0.5 px margin by the resolution), so compare
    // the four insets in texels rather than the raw coordinates.
    const [x0, y0, x1, y1] = tm.uClampFrame;
    return { map: [a, b, c, d, tx, ty], clampInsetTexels: [x0 * texels, y0 * texels, texels - x1 * texels, texels - y1 * texels], isSimple: tm.isSimple,
      address: [texture.source.style.addressModeU, texture.source.style.addressModeV], mipmaps: texture.source.autoGenerateMipmaps };
  };
  for (const id of TERRAIN_MATERIAL_IDS) {
    const [a, b] = [full.createSprite(id, { width: 300, height: 200 }), half.createSprite(id, { width: 300, height: 200 })];
    assert.ok(b instanceof TilingSprite);
    assert.deepEqual([b.width, b.height, b.tileScale.x, b.tileScale.y], [a.width, a.height, a.tileScale.x, a.tileScale.y]);
    assert.deepEqual(matrix(b.texture), matrix(a.texture), id);
    assert.equal(matrix(b.texture).isSimple, true, 'a whole-page tile keeps the simple (batchable) tiling path');
    assert.deepEqual(matrix(b.texture).clampInsetTexels, [0.5, 0.5, 0.5, 0.5]);
    assert.deepEqual(matrix(b.texture).address, ['repeat', 'repeat']);
    assert.equal(b.texture.source.isPowerOfTwo, true, 'a 256 half tile still wraps as a power-of-two texture');
    assert.deepEqual(matrix(half.fringeTextureFor(id)), matrix(full.fringeTextureFor(id)), `${id} fringe`);
    assert.deepEqual(matrix(half.fringeTextureFor(id)).address, ['repeat', 'clamp-to-edge']);
  }
  for (const id of TERRAIN_OVERLAY_IDS) assert.deepEqual(matrix(half.overlayTextureFor(id)), matrix(full.overlayTextureFor(id)), `${id} overlay`);
});
