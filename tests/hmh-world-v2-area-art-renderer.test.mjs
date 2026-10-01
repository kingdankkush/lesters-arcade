import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Texture, TextureSource, Container } from 'pixi.js';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { createAreaArt, createAreaArtTextureCache, multiplyTint, AREA_ART_ID } from '../apps/hmh-reboot/src/world-v2-area-art.mjs';
import { createRugpullWoodsArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/rugpull-woods.mjs';
import { createMwebMeadowsArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs';
import { createWorldRoadsArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/world-roads.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url), 'utf8'));
const world = createGreyboxWorld();
// Headless textures sized like the real files: kit pages 2048 (1024 at half), tiles 512, fringes 512x128, detail page 256.
function sizeFor(url) {
  const file = url.split('/').at(-1);
  if (file.startsWith('tripo-props-hd-')) return file.includes('@0.5x') ? [1024, 1024] : [2048, 2048];
  if (file.endsWith('-fringe.png')) return [512, 128];
  if (file === 'ground-details.webp') return [256, 256];
  return [512, 512];
}
const loader = log => async url => { log.push(url); const [width, height] = sizeFor(url); return new Texture({ source: new TextureSource({ width, height }) }); };
const camera = { x: 17500, y: 11600, zoom: 0.9, groundZ: 0, shakeX: 0, shakeY: 0 }, view = { width: 1280, height: 700 };

test('multiplyTint composes plan and foliage tints channel-wise', () => {
  assert.equal(multiplyTint(0xffffff, 0x65735a), 0x65735a);
  assert.equal(multiplyTint(0x808080, 0xffffff), 0x808080);
  assert.equal(multiplyTint(0x000000, 0xabcdef), 0);
});

test('the renderer loads only the pages and tiles its plan needs, paints, mounts and releases everything on dispose', async () => {
  const urls = [], cache = createAreaArtTextureCache({ loadTexture: loader(urls) });
  const plan = createRugpullWoodsArtPlan(world);
  const art = createAreaArt({ world, areaId: 'rugpull-woods', plan, kit, textureCache: cache });
  assert.equal(art.artId, AREA_ART_ID);
  await art.ready;
  assert.deepEqual(urls.filter(u => u.includes('tripo-props-hd-')).sort(), plan.pages.map(p => `/assets/generated/hmh-reboot-tripo-props-hd/${p}`).sort());
  for (const tile of art.summary.tiles) { assert.ok(urls.includes(`/assets/generated/hmh-terrain-tiles/${tile}.png`)); assert.ok(urls.includes(`/assets/generated/hmh-terrain-tiles/${tile}-fringe.png`)); }
  assert.ok(!urls.some(u => u.includes('pickups') || u.includes('ground-details')), 'no pickup page or unused detail page');
  const ground = new Container(), depth = new Container();
  assert.equal(art.claimsSurface('rugpull-woods-floor'), true);
  assert.equal(art.claimsSurface('mweb-meadows-floor'), false);
  assert.equal(art.paintSurface({ target: ground, surface: { id: 'mweb-meadows-floor' } }), false);
  assert.equal(art.paintSurface({ target: ground, surface: { id: 'rugpull-woods-floor' } }), true);
  assert.ok(ground.children.length >= 1 + art.summary.zones.length + 3, 'base, zones, trail halo/mask/core painted');
  const tent = world.pieces.find(p => p.id === 'rugpull-woods-supply-tent'), untouched = world.pieces.find(p => p.id === 'mweb-meadows-garden-home');
  const node = art.createSolid(tent);
  assert.equal(node.areaArtDecorated, true);
  assert.ok(node.children.length >= 2, 'shadow, faint mass and HD card');
  assert.equal(art.createSolid(untouched), null);
  art.mount(depth, ground);
  const visible = art.update(camera, view, { x: camera.x, y: camera.y });
  assert.ok(visible > 20, `${visible} props visible at the Woods centre`);
  assert.equal(depth.children.length, art.snapshot().residency.liveCount);
  assert.ok(depth.children.every(child => Number.isFinite(child.zIndex)));
  const snapshot = art.snapshot();
  assert.equal(snapshot.runtimeAuthority, 'projection-only');
  assert.equal(snapshot.budget.exclusiveKitPages, 2);
  assert.ok(snapshot.ownedUrls.length === urls.length);
  art.dispose();
  assert.equal(art.snapshot().disposed, true);
  assert.equal(depth.children.length, 0);
  assert.equal(ground.children.length, 0);
  assert.equal(cache.snapshot().references, 0);
  assert.deepEqual(cache.snapshot().urls, []);
});

test('the shared cache reference-counts pages between Meadows, Woods and roads and the half tier loads the @0.5x pages', async () => {
  const urls = [], cache = createAreaArtTextureCache({ loadTexture: loader(urls) });
  const arts = [['rugpull-woods', createRugpullWoodsArtPlan], ['mweb-meadows', createMwebMeadowsArtPlan], ['world-roads', createWorldRoadsArtPlan]].map(([areaId, make]) => createAreaArt({ world, areaId, plan: make(world), kit, textureCache: cache, resolution: 'half' }));
  await Promise.all(arts.map(art => art.ready));
  const pages = urls.filter(u => u.includes('tripo-props-hd-'));
  assert.deepEqual([...new Set(pages)].sort(), ['/assets/generated/hmh-reboot-tripo-props-hd/tripo-props-hd-plants-00@0.5x.webp', '/assets/generated/hmh-reboot-tripo-props-hd/tripo-props-hd-props-00@0.5x.webp', '/assets/generated/hmh-reboot-tripo-props-hd/tripo-props-hd-structures-00@0.5x.webp', '/assets/generated/hmh-reboot-tripo-props-hd/tripo-props-hd-structures-01@0.5x.webp']);
  assert.equal(pages.length, 4, 'each page decoded once even though three plans reference the props page');
  const ground = new Container();
  const roads = arts[2];
  assert.equal(roads.claimsSurface('city-meadows-segment-1'), true);
  assert.equal(roads.claimsSurface('city-meadows-join-0'), false, 'straight roads have no joins');
  assert.equal(roads.claimsSurface('meadows-woods-join-1'), true);
  assert.equal(roads.paintSurface({ target: ground, surface: { id: 'meadows-woods-join-1' } }), true);
  assert.equal(ground.children.length, 0, 'claimed joins never paint twice');
  assert.equal(roads.paintSurface({ target: ground, surface: { id: 'meadows-woods-segment-1' } }), true);
  // One road mesh where a GL program can be built, else the Graphics ribbon + wear fallback.
  assert.ok(ground.children.length === 1 ? ground.children[0].label === 'area-road-meadows-woods' : ground.children.length >= 2, 'road painted once');
  arts[0].dispose();
  assert.ok(cache.snapshot().urls.some(u => u.includes('plants-00@0.5x')), 'Meadows still holds the plants page');
  arts[1].dispose(); arts[2].dispose();
  assert.deepEqual(cache.snapshot().urls, []);
});

test('a page that decodes at the wrong size or a plan that fails validation rejects ready and owns nothing', async () => {
  const urls = [], bad = createAreaArtTextureCache({ loadTexture: async url => { urls.push(url); return new Texture({ source: new TextureSource({ width: 64, height: 64 }) }); } });
  const art = createAreaArt({ world, areaId: 'rugpull-woods', plan: createRugpullWoodsArtPlan(world), kit, textureCache: bad });
  await assert.rejects(art.ready, /expected 2048x2048/);
  assert.equal(art.snapshot().disposed, true);
  assert.equal(bad.snapshot().references, 0);
  const wrong = createAreaArt({ world, areaId: 'rugpull-woods', plan: { ...createRugpullWoodsArtPlan(world), pages: ['tripo-props-hd-pickups-00.webp'] }, kit, textureCache: createAreaArtTextureCache({ loadTexture: loader([]) }) });
  await assert.rejects(wrong.ready, /does not load/);
  assert.throws(() => createAreaArt({ world, areaId: 'mweb-meadows', plan: createRugpullWoodsArtPlan(world), kit }), /does not dress/);
});
