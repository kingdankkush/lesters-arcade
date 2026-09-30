// Runtime-only admission checks. Native art provenance remains in the art worktree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
const target = () => import('../apps/hmh-reboot/src/meadows-art-target.mjs');
const hash = 'a'.repeat(64);
const metadata = () => ({
  schema: 'hmh-meadows-art-target/v1', runtimeAuthority: 'projection-only', ownerAccepted: false,
  projectionAdapter: { cameraPitchFromVerticalDegrees: 55, zPrewarp: 1 / Math.tan(55 * Math.PI / 180), spriteYScale: 1 / Math.cos(55 * Math.PI / 180), handedness: 'worldY=-BlenderY' },
  palette: 'muted-environment', sources: { oak: { method: 'local-blender-authored', sha256: hash }, house: { method: 'existing-owner-model', sha256: hash } },
  tiers: Object.fromEntries(['desktop', 'mobile'].map((tier, index) => [tier, { pages: [
    { image: `ground-north-${tier}.webp`, width: 2048 >> index, height: 1536 >> index, bytes: 100, sha256: hash },
    { image: `ground-south-${tier}.webp`, width: 2048 >> index, height: 1536 >> index, bytes: 100, sha256: hash },
    { image: `props-${tier}.webp`, width: 1024 >> index, height: 2048 >> index, bytes: 100, sha256: hash },
  ], frames: ['oak', 'house'].map((id, row) => ({ assetId: `art-target-meadows-${id === 'oak' ? 'tree-oak' : id}`, page: 2, frame: { x: 0, y: row * (1024 >> index), w: 1024 >> index, h: 1024 >> index }, anchor: { x: .5, y: .85 }, runtimeScale: .3 * (1 << index), projectionY: 1 / Math.cos(55 * Math.PI / 180) })) }]))
});
const texture = page => ({ source: { pixelWidth: page.width, pixelHeight: page.height } });

test('target is explicit default-off and does not import or fetch art for ordinary games', async () => {
  const { loadMeadowsArtTarget } = await target();
  assert.equal(await loadMeadowsArtTarget({ fetchImpl: () => assert.fail('disabled art fetched'), loadTexture: () => assert.fail('disabled texture loaded') }), null);
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /runtimeParams\.get\('artTarget'\) === 'meadows-v1'/);
  assert.match(main, /import\('\.\/meadows-art-target\.mjs'\)/);
  assert.doesNotMatch(main, /from ['"]\.\/meadows-art-target\.mjs['"]/);
});

test('target keeps legal collision footprints, heights and readable floor immutable', async () => {
  const { createMeadowsArtTargetPlan, replaceMeadowsArtPlacements } = await target();
  const before = structuredClone(LEVEL_ONE_WORLD);
  const plan = createMeadowsArtTargetPlan(LEVEL_ONE_WORLD);
  assert.deepEqual(LEVEL_ONE_WORLD, before);
  assert.equal(Object.isFrozen(plan), true);
  for (const binding of plan.bindings) {
    const source = LEVEL_ONE_WORLD.blockers.find(blocker => blocker.id === binding.collisionBlockerId);
    assert.deepEqual(binding.footprint, source.shape);
    assert.equal(binding.maxZ, source.maxZ);
    assert.deepEqual({ x: binding.x, y: binding.y }, source.anchor);
  }
  const oak = plan.bindings.find(binding => binding.assetId.endsWith('-oak'));
  assert.equal(oak.maxZ, 162);
  assert.equal(Math.max(...oak.footprint.vertices.map(p => p.x)) - Math.min(...oak.footprint.vertices.map(p => p.x)), 350);
  assert.equal(Math.max(...oak.footprint.vertices.map(p => p.y)) - Math.min(...oak.footprint.vertices.map(p => p.y)), 90);
  assert.ok(plan.quietLane.maxX - plan.quietLane.minX >= 160);
  assert.ok(plan.quietLane.minY >= 1500, 'lane lies south of the actual north fence');
  const original = Object.freeze([{ id: 'house', collisionBlockerId: 'relay-abandoned-farmhouse' }, { id: 'hedge', collisionBlockerId: 'relay-hedgerow' }, { id: 'other', collisionBlockerId: 'unchanged' }].map(Object.freeze));
  const replacement = replaceMeadowsArtPlacements(original, plan);
  assert.equal(original.length, 3);
  assert.equal(replacement.length, 3);
  assert.equal(replacement[0], original[2]);
  assert.deepEqual(replacement.slice(1).map(p => p.collisionBlockerId).sort(), ['relay-abandoned-farmhouse', 'relay-hedgerow']);
  assert.throws(() => createMeadowsArtTargetPlan({ ...LEVEL_ONE_WORLD, blockers: LEVEL_ONE_WORLD.blockers.filter(b => b.id !== 'relay-hedgerow') }), /blocker|geometry/i);
});

test('asset validation keeps environment palette, safe URLs and measured texture residency', async () => {
  const { validateMeadowsArtMetadata } = await target();
  const valid = metadata(), before = structuredClone(valid);
  assert.equal(validateMeadowsArtMetadata(valid, 'desktop').decodedBytes, 33_554_432);
  assert.equal(validateMeadowsArtMetadata(valid, 'mobile').decodedBytes, 8_388_608);
  assert.deepEqual(valid, before);
  const badUrl = metadata(); badUrl.tiers.desktop.pages[0].image = '../../private.webp';
  assert.throws(() => validateMeadowsArtMetadata(badUrl, 'desktop'), /page|URL/i);
  assert.throws(() => validateMeadowsArtMetadata({ ...valid, palette: 'danger-red-gold-cyan' }, 'desktop'), /palette/i);
  assert.throws(() => validateMeadowsArtMetadata({ ...valid, runtimeAuthority: 'simulation' }, 'desktop'), /authority|projection/i);
  const badFrame = metadata(); badFrame.tiers.desktop.frames[1].frame.y = 2048;
  assert.throws(() => validateMeadowsArtMetadata(badFrame, 'desktop'), /frame/i);
});

test('partial loading failure restores existing art and releases only target-owned pages', async () => {
  const { loadMeadowsArtTarget } = await target();
  const released = [], valid = metadata(); let calls = 0;
  await assert.rejects(loadMeadowsArtTarget({ enabled: true, world: LEVEL_ONE_WORLD, fetchImpl: async () => ({ ok: true, json: async () => valid }), loadTexture: async () => { if (++calls === 2) throw new Error('texture unavailable'); return texture(valid.tiers.desktop.pages[0]); }, unloadTexture: async url => released.push(url) }), /unavailable/);
  assert.deepEqual(released, ['/assets/generated/hmh-art-target/ground-north-desktop.webp']);
  assert.equal(calls, 2);
});

test('late completion after disposal cannot install art and normal disposal is idempotent', async () => {
  const { loadMeadowsArtTarget } = await target();
  const valid = metadata(), released = [];
  let disposed = false;
  const canceled = await loadMeadowsArtTarget({ enabled: true, world: LEVEL_ONE_WORLD, fetchImpl: async () => ({ ok: true, json: async () => valid }), loadTexture: async () => { disposed = true; return texture(valid.tiers.desktop.pages[0]); }, unloadTexture: async url => released.push(url), isDisposed: () => disposed });
  assert.equal(canceled, null);
  assert.equal(released.length, 1);
  const loaded = await loadMeadowsArtTarget({ enabled: true, world: LEVEL_ONE_WORLD, fetchImpl: async () => ({ ok: true, json: async () => valid }), loadTexture: async url => texture(valid.tiers.desktop.pages.find(page => url.endsWith(page.image))), unloadTexture: async url => released.push(url) });
  assert.equal(loaded.appearance.size, 2);
  await loaded.dispose(); await loaded.dispose();
  assert.equal(released.length, 4);
});

test('ground follows actual projection below decals and disposal detaches its owned displays', async () => {
  const { loadMeadowsArtTarget } = await target();
  class Container {
    children = [];
    addChild(child) { this.children.push(child); child.parent = this; }
    addChildAt(child, index) { this.children.splice(index, 0, child); child.parent = this; }
    getChildIndex(child) { const index = this.children.indexOf(child); if (index < 0) throw new Error('missing child'); return index; }
    removeChild(child) { this.children.splice(this.getChildIndex(child), 1); child.parent = null; }
    destroy() { this.destroyed = true; for (const child of this.children) child.destroy?.(); }
  }
  class Sprite {
    constructor({ texture }) { this.texture = texture; }
    anchor = { set: (x, y) => { this.anchorXY = [x, y]; } };
    position = { set: (x, y) => { this.positionXY = [x, y]; } };
    destroy() { this.destroyed = true; }
  }
  const valid = metadata(), loaded = await loadMeadowsArtTarget({ enabled: true, world: LEVEL_ONE_WORLD, fetchImpl: async () => ({ ok: true, json: async () => valid }), loadTexture: async url => texture(valid.tiers.desktop.pages.find(page => url.endsWith(page.image))) });
  const world = new Container(), before = { label: 'world-decals' }; world.addChild(before);
  const layer = loaded.createGround({ ContainerClass: Container, SpriteClass: Sprite, target: world, before });
  assert.equal(world.children[0], layer.container);
  assert.equal(world.children[1], before);
  const camera = Object.freeze({ zoom: .5 }), view = Object.freeze({ width: 1440, height: 900 });
  loaded.renderGround({ camera, view, worldToScreen: point => ({ x: point.x / 2, y: point.y / 2 }) });
  assert.deepEqual(layer.sprites.map(sprite => sprite.positionXY), [[60, 500], [60, 740]]);
  assert.deepEqual(layer.sprites.map(sprite => [sprite.width, sprite.height]), [[320, 240], [320, 240]]);
  assert.ok(layer.sprites.every(sprite => sprite.visible));
  await loaded.dispose();
  assert.deepEqual(world.children, [before]);
  assert.ok(layer.sprites.every(sprite => sprite.destroyed));
});


test('55 degree bake contract rejects the retired 45 degree sprite stretch', async () => {
  const { MEADOWS_PROJECTION_ADAPTER, validateMeadowsArtMetadata } = await target();
  assert.equal(MEADOWS_PROJECTION_ADAPTER.cameraPitchFromVerticalDegrees, 55);
  assert.ok(Math.abs(MEADOWS_PROJECTION_ADAPTER.zPrewarp - 1 / Math.tan(55 * Math.PI / 180)) < 1e-12);
  assert.ok(Math.abs(MEADOWS_PROJECTION_ADAPTER.spriteYScale - 1 / Math.cos(55 * Math.PI / 180)) < 1e-12);
  const retired = metadata();
  for (const frame of retired.tiers.desktop.frames) frame.projectionY = Math.SQRT2;
  assert.throws(() => validateMeadowsArtMetadata(retired, 'desktop'), /projection|camera/i);
});












test('cleanup reports rejected unloads, detaches ground first and retains only failed ownership for retry', async () => {
  const { loadMeadowsArtTarget } = await target();
  const valid = metadata(), events = [], attempts = new Map(), reports = [];
  class GroundContainer {
    children = [];
    addChild(child) { this.children.push(child); child.parent = this; }
    destroy() { events.push('destroy-ground'); }
  }
  class GroundSprite { anchor = { set() {} }; constructor({ texture }) { this.texture = texture; } }
  const parent = { children: [{}], getChildIndex: () => 0, addChildAt(child) { this.children.unshift(child); child.parent = this; }, removeChild(child) { events.push('detach-ground'); this.children.splice(this.children.indexOf(child), 1); child.parent = null; } };
  const failedUrl = '/assets/generated/hmh-art-target/props-desktop.webp';
  const loaded = await loadMeadowsArtTarget({ enabled: true, world: LEVEL_ONE_WORLD, fetchImpl: async () => ({ ok: true, json: async () => valid }), loadTexture: async url => texture(valid.tiers.desktop.pages.find(page => url.endsWith(page.image))), unloadTexture: async url => { events.push('unload:' + url); attempts.set(url, (attempts.get(url) ?? 0) + 1); if (url === failedUrl && attempts.get(url) === 1) throw new Error('GPU cleanup unavailable'); }, onCleanupReport: report => reports.push(report) });
  loaded.createGround({ ContainerClass: GroundContainer, SpriteClass: GroundSprite, target: parent, before: parent.children[0] });
  const report = await loaded.dispose();
  assert.equal(report.ok, false, 'a rejected unload must not look successful');
  assert.deepEqual(events.slice(0, 2), ['detach-ground', 'destroy-ground']);
  assert.equal(parent.children.length, 1);
  assert.equal(loaded.appearance.size, 0);
  assert.deepEqual(loaded.getCleanupStatus().ownedResourceUrls, [failedUrl]);
  assert.deepEqual(report.failedResources, [{ url: failedUrl, attempts: 1, error: 'GPU cleanup unavailable' }]);
  assert.equal(typeof reports[0].retry, 'function');
  const retried = await reports[0].retry();
  assert.equal(retried.ok, true);
  assert.deepEqual(retried.ownedResourceUrls, []);
  assert.deepEqual(reports.map(report => report.failedResources.length), [1, 0]);
  assert.equal(attempts.get(failedUrl), 2);
  assert.ok([...attempts].filter(([url]) => url !== failedUrl).every(([, count]) => count === 1));
  assert.equal(events.filter(event => event === 'destroy-ground').length, 1);
  assert.throws(() => loaded.createGround({}), /disposed/i);
  await loaded.dispose();
  assert.equal(attempts.get(failedUrl), 2);
});

test('failed-load cleanup retains rejected ownership on its surfaced error without hiding the original failure', async () => {
  const { loadMeadowsArtTarget } = await target();
  const valid = metadata(), reports = []; let loads = 0, unloads = 0;
  let surfaced;
  try { await loadMeadowsArtTarget({ enabled: true, world: LEVEL_ONE_WORLD, fetchImpl: async () => ({ ok: true, json: async () => valid }), loadTexture: async () => { if (++loads === 2) throw new Error('original load failure'); return texture(valid.tiers.desktop.pages[0]); }, unloadTexture: async () => { if (++unloads === 1) throw new Error('retained GPU page'); }, onCleanupReport: report => reports.push(report) }); }
  catch (error) { surfaced = error; }
  assert.match(surfaced.message, /original load failure/);
  assert.equal(typeof surfaced.artTargetCleanup?.retry, 'function');
  assert.equal(surfaced.artTargetCleanup.getStatus().failedResources.length, 1);
  assert.equal(reports[0].failedResources.length, 1);
  assert.equal((await surfaced.artTargetCleanup.retry()).ok, true);
  assert.equal(unloads, 2);
});


test('cleanup retains rejection ownership even when the rejected error has no message', async () => {
  const { loadMeadowsArtTarget } = await target();
  const valid = metadata(), failedUrl = '/assets/generated/hmh-art-target/props-desktop.webp';
  for (const reason of ['', undefined, new Error('')]) {
    let rejecting = true;
    const loaded = await loadMeadowsArtTarget({ enabled: true, world: LEVEL_ONE_WORLD, fetchImpl: async () => ({ ok: true, json: async () => valid }), loadTexture: async url => texture(valid.tiers.desktop.pages.find(page => url.endsWith(page.image))), unloadTexture: async url => { if (rejecting && url === failedUrl) throw reason; } });
    const report = await loaded.dispose();
    assert.equal(report.ok, false);
    assert.equal(report.failedResources.length, 1);
    assert.deepEqual(report.ownedResourceUrls, [failedUrl]);
    rejecting = false;
    assert.equal((await loaded.dispose()).ok, true);
  }
});






test('phone corner framing proposal changes only explicit candidate presentation zoom', async () => {
  const { resolveMeadowsTargetCameraZoom } = await target();
  assert.equal(resolveMeadowsTargetCameraZoom({ baseZoom: 1.495, mobile: true }), 1.495);
  assert.equal(resolveMeadowsTargetCameraZoom({ baseZoom: 1.495, mobile: true, enabled: true }), 1.495 * .35);
  assert.equal(resolveMeadowsTargetCameraZoom({ baseZoom: 1.877, mobile: false, enabled: true }), 1.877 * .5);
});

test('asset metadata rejects invalid measured painted-alpha rectangles before installation', async () => {
  const { validateMeadowsArtMetadata } = await target();
  const bad = metadata();
  bad.tiers.desktop.frames[0].alphaBounds = { x: -1, y: 0, w: 32, h: 32 };
  assert.throws(() => validateMeadowsArtMetadata(bad, 'desktop'), /alpha|painted/i);
  bad.tiers.desktop.frames[0].alphaBounds = { x: 0, y: 0, w: 1025, h: 32 };
  assert.throws(() => validateMeadowsArtMetadata(bad, 'desktop'), /alpha|painted/i);
  bad.tiers.desktop.frames[0].alphaBounds = { x: 0, y: 0, w: 32, h: NaN };
  assert.throws(() => validateMeadowsArtMetadata(bad, 'desktop'), /alpha|painted/i);
});


test('canvas guidance witness measures visible actual Pixi bounds without mutating displays', async () => {
  const { collectMeadowsCanvasHudRects } = await target();
  assert.equal(typeof collectMeadowsCanvasHudRects, 'function');
  const nodes = [{ visible: true, text: 'Press the generator switch', getBounds: () => ({ x: 80, y: 625, width: 250, height: 27 }) },
    { visible: false, getBounds: () => assert.fail('hidden overlay queried') },
    { visible: true, getBounds: () => ({ x: 10, y: 10, width: 0, height: 0 }) }];
  const original = nodes.map(node => ({ ...node }));
  const measured = collectMeadowsCanvasHudRects(nodes);
  assert.equal(measured.errors.length, 0);
  assert.deepEqual(measured.rectangles, [{ id: 'canvas-guidance-0', text: 'Press the generator switch', x: 80, y: 625, width: 250, height: 27 }]);
  assert.deepEqual(nodes, original);
  assert.equal(collectMeadowsCanvasHudRects([{ visible: true, getBounds() { throw new Error('bounds unavailable'); } }]).errors.length, 1);
});



test('optional ground details validate their allocation and use real Pixi shared-source cleanup', async () => {
  const { Container, Sprite, Texture, TextureSource } = await import('pixi.js');
  const { loadMeadowsArtTarget, validateMeadowsArtMetadata } = await target();
  const valid = metadata();
  valid.groundDetails = { runtimeAuthority: 'projection-only', sourcePixelsPreserved: true,
    page: { image: 'ground-details.webp', width: 256, height: 256, bytes: 38000, sha256: hash },
    frames: [
      { assetId: 'grass', frame: { x: 0, y: 0, w: 196, h: 120 }, anchor: { x: .48, y: .7 }, runtimeScale: 48 / 512, projectionY: 1 / Math.cos(55 * Math.PI / 180) },
      { assetId: 'aggregate', frame: { x: 0, y: 160, w: 224, h: 96 }, anchor: { x: .5, y: .5 }, runtimeScale: 40 / 128, projectionY: 1 }],
    placements: [{ assetId: 'grass', x: 200, y: 1600, rotation: .12, scale: 1.1, widthScale: 1.2, heightScale: .55, flip: true, alpha: .65, tint: 0xffffff },
      { assetId: 'aggregate', x: 600, y: 1800, rotation: .25, scale: .5, flip: false, alpha: .15, tint: 0xd7c199 }] };
  assert.equal(validateMeadowsArtMetadata(valid, 'desktop').decodedBytes,
    validateMeadowsArtMetadata(metadata(), 'desktop').decodedBytes + 262144);
  const invalid = structuredClone(valid); invalid.groundDetails.placements = Array(129).fill(invalid.groundDetails.placements[0]);
  assert.throws(() => validateMeadowsArtMetadata(invalid, 'desktop'), /bounded detail/);
  const tooTall = structuredClone(valid); tooTall.groundDetails.placements[0].heightScale = 2;
  assert.throws(() => validateMeadowsArtMetadata(tooTall, 'desktop'), /detail placement/);
  const pages = [...valid.tiers.desktop.pages, valid.groundDetails.page], held = new Map(), released = [];
  const loaded = await loadMeadowsArtTarget({ enabled: true, world: LEVEL_ONE_WORLD,
    fetchImpl: async () => ({ ok: true, json: async () => valid }),
    loadTexture: async url => { const p = pages.find(p => url.endsWith(p.image)); const t = new Texture({ source: new TextureSource({ width: p.width, height: p.height }) }); held.set(url, t); return t; },
    unloadTexture: async url => { released.push(url); held.get(url).destroy(true); } });
  const parent = new Container(), before = new Container(); parent.addChild(before);
  const layer = loaded.createGround({ ContainerClass: Container, SpriteClass: Sprite, target: parent, before });
  const detail = layer.details[0], source = held.get('/assets/generated/hmh-art-target/ground-details.webp').source;
  assert.equal(detail.sprite.texture.source, source);
  assert.equal(layer.details[1].sprite.texture.source, source);
  loaded.renderGround({ camera: { zoom: 2 }, view: { width: 800, height: 600 }, worldToScreen: p => ({ x: p.x, y: p.y - 1400 }) });
  assert.equal(detail.sprite.x, 200); assert.equal(detail.sprite.y, 200);
  assert.equal(detail.sprite.scale.x, -(48 / 512 * 1.1 * 2) * 1.2);
  assert.equal(detail.sprite.scale.y, 48 / 512 * 1.1 * 2 / Math.cos(55 * Math.PI / 180) * .55);
  assert.equal(detail.sprite.rotation, .12);
  assert.equal(detail.sprite.visible, true);
  loaded.renderGround({ camera: { zoom: 2 }, view: { width: 800, height: 600 }, worldToScreen: () => ({ x: 10000, y: 10000 }) });
  assert.equal(detail.sprite.visible, false);
  await loaded.dispose(); await loaded.dispose();
  assert.equal(released.length, 4); assert.equal(new Set(released).size, 4);
  assert.equal(source.destroyed, true); assert.equal(parent.children.length, 1);
  parent.destroy({ children: true });
});
