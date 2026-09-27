import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  HELD_WEAPON_CLIPS,
  HELD_WEAPON_HERO_MAX_BYTES,
  HELD_WEAPON_IDS,
  HELD_WEAPON_PAGE_MAX_BYTES,
  HELD_WEAPON_PIPELINE_ID,
  createHeldWeaponIndex,
  createHeldWeaponLoader,
  heldWeaponMetadataUrl,
  resolveHeldWeaponFrame,
} from '../apps/hmh-reboot/src/held-weapon-atlas.mjs';
import { PRODUCTION_HERO_ASSETS, PRODUCTION_HERO_RUNTIME_SCALE, createProductionHeroAtlasIndex, createProductionHeroDisplay, productionHeroAsset } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';
import { HERO_MOTION_CLIPS, createHeroMotionIndex } from '../apps/hmh-reboot/src/hero-motion-atlas.mjs';
import { AUTHORED_PROP_ASSETS } from '../apps/hmh-reboot/src/authored-prop-layout.mjs';

const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const ACTORS = Object.keys(PRODUCTION_HERO_ASSETS);
const repoUrl = (relative) => new URL(`../${relative}`, import.meta.url);
const readJson = (relative) => JSON.parse(readFileSync(repoUrl(relative), 'utf8'));
const heroMetadata = (actorId) => readJson(`apps/portal${productionHeroAsset(actorId).metadataUrl}`);
const heldMetadataPath = (actorId) => `apps/portal/assets/generated/hmh-held-weapons/${actorId}/${actorId}-held-weapons.json`;
const shippedActors = ACTORS.filter((actorId) => existsSync(repoUrl(heldMetadataPath(actorId))));
const sha256 = (relative) => createHash('sha256').update(readFileSync(repoUrl(relative))).digest('hex');

function fixture(actorId = 'lit-commando', { pageSize = 1024 } = {}) {
  const frameSize = { w: 768, h: 768 };
  const sourcePivot = { x: 384, y: 537 };
  const weapons = {};
  let totalImageBytes = 0;
  for (const weaponId of HELD_WEAPON_IDS) {
    const frames = [];
    for (const [state, clip] of Object.entries(HELD_WEAPON_CLIPS)) {
      for (const direction of DIRECTIONS) {
        for (let frameIndex = 0; frameIndex < clip.frames; frameIndex += 1) {
          const x0 = 420 + frameIndex;
          const y0 = 300 + DIRECTIONS.indexOf(direction);
          const page = weaponId === 'forked-standard' && state === 'reload' ? 1 : 0;
          frames.push({
            id: `${actorId}__${weaponId}__${state}__${direction}__${String(frameIndex).padStart(3, '0')}`,
            state, direction, frameIndex, page,
            frame: { x: (frames.length * 3) % (page ? 400 : 900), y: Math.floor(frames.length / 300) * 40, w: 60, h: 30 },
            orig: { w: x0 + 60 - 384, h: sourcePivot.y + 1 - y0 }, trim: { x: 0, y: 0, w: 60, h: 30 },
            spriteSourceSize: { x: 384, y: y0, w: x0 + 60 - 384, h: sourcePivot.y + 1 - y0 },
            pivot: { x: 0, y: sourcePivot.y - y0 },
            anchor: { x: 0, y: Number(((sourcePivot.y - y0) / (sourcePivot.y + 1 - y0)).toFixed(6)) },
            grip: { x: x0 + 8 - 384, y: y0 + 20 - 537 }, muzzle: { x: x0 + 58 - 384, y: y0 + 8 - 537 },
            opaquePixels: 900, sourcePixelSha256: 'a'.repeat(64),
          });
        }
      }
    }
    const imageBytes = 200_000;
    totalImageBytes += imageBytes;
    const pages = [{ image: `./${actorId}-${weaponId}.webp`, imageBytes, imageSha256: 'b'.repeat(64), dimensions: { width: pageSize, height: pageSize } }];
    if (weaponId === 'forked-standard') pages.push({ image: `./${actorId}-${weaponId}-1.webp`, imageBytes: 50_000, imageSha256: 'f'.repeat(64), dimensions: { width: 512, height: 512 } });
    if (weaponId === 'forked-standard') totalImageBytes += 50_000;
    weapons[weaponId] = { weaponId, shape: 'fixture', lengthMeters: 1, fireAction: weaponId === 'lightning-ledger' || weaponId === 'bear-market-burner' ? null : 'pistol-fire', pages, imageBytes: pages.reduce((sum, page) => sum + page.imageBytes, 0), frameCount: frames.length, frames };
  }
  return {
    schemaVersion: 1, pipelineId: HELD_WEAPON_PIPELINE_ID, classification: 'production-art', runtimeAuthority: 'projection-only',
    actorId, variantId: productionHeroAsset(actorId).variantId, heroPipelineId: 'hmh-reboot-production-hero-pilot-v1',
    heroFrameSize: 256, coverage: 1.5, pixelDensity: 2, frameSize, sourcePivot, directions: DIRECTIONS,
    clips: Object.fromEntries(Object.entries(HELD_WEAPON_CLIPS).map(([state, clip]) => [state, { ...clip, native: 'aim' }])),
    sourceSha256: 'c'.repeat(64), weaponSceneSha256: 'd'.repeat(64), exporterSha256: 'e'.repeat(64), totalImageBytes, weapons, calibration: [],
  };
}

function displayMocks() {
  class Container {
    constructor() { this.children = []; this.scale = { set() {} }; }
    addChild(child) { this.children.push(child); }
  }
  class Sprite {
    constructor({ texture }) {
      this.texture = texture;
      this.anchor = { set: (x, y) => Object.assign(this.anchor, { x, y }) };
      this.scale = { set: (x, y = x) => Object.assign(this.scale, { x, y }) };
    }
  }
  class Texture { constructor(options) { Object.assign(this, options); } }
  class Rectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  return { ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle };
}

const motionFixture = (actorId, base) => {
  const frames = [];
  for (const [layer, states] of Object.entries(HERO_MOTION_CLIPS)) {
    for (const [state, clip] of Object.entries(states)) for (const direction of DIRECTIONS) {
      for (let frameIndex = 0; frameIndex < clip.frames; frameIndex += 1) frames.push({
        id: `${actorId}__${layer}__${state}__${direction}__${String(frameIndex).padStart(3, '0')}`,
        layer, state, direction, frameIndex, fps: clip.fps, loop: clip.loop !== false,
        frame: { x: 0, y: 0, w: 10, h: 10 }, orig: { w: 10, h: 10 }, trim: { x: 0, y: 0, w: 10, h: 10 },
        sourceSize: { w: 256, h: 256 }, spriteSourceSize: { x: 123, y: 200, w: 10, h: 10 },
        sourcePivot: { x: 128, y: 205 }, pivot: { x: 5, y: 5 }, anchor: { x: .5, y: .5 }, opaquePixels: 80,
      });
    }
  }
  return { motionSchema: 1, actorId, variantId: base.variantId, runtimeAuthority: 'projection-only', image: `./${actorId}-motion.webp`, imageBytes: 100000, baseImageBytes: 3919100, sourceSha256: '1'.repeat(64), imageSha256: '2'.repeat(64), dimensions: { width: 1024, height: 1024 }, frames };
};

test('held-weapon roster is exactly the seven non-pistol carried weapons the authored overlay serves', () => {
  assert.deepEqual([...HELD_WEAPON_IDS], AUTHORED_PROP_ASSETS.weapons.filter((id) => id !== 'coin-blaster'));
  assert.equal(heldWeaponMetadataUrl('lilly'), '/assets/generated/hmh-held-weapons/lilly/lilly-held-weapons.json');
  assert.throws(() => heldWeaponMetadataUrl('../x'), /bad actor id/u);
  assert.equal(HELD_WEAPON_PAGE_MAX_BYTES, 1536 * 1024);
  assert.equal(HELD_WEAPON_HERO_MAX_BYTES, 8 * 1024 * 1024);
  const manifest = JSON.parse(readFileSync(repoUrl('apps/hmh-reboot/assets/source/blender/hmh-held-weapons.json'), 'utf8'));
  assert.equal(manifest.atlas.maxBytesPerPage, HELD_WEAPON_PAGE_MAX_BYTES, 'manifest and runtime page budget drifted');
  assert.equal(manifest.atlas.maxBytesPerHero, HELD_WEAPON_HERO_MAX_BYTES, 'manifest and runtime hero budget drifted');
});

test('the held-weapon index validates the page contract and exposes body-unit scale and lookups', () => {
  const index = createHeldWeaponIndex(fixture(), { actorId: 'lit-commando' });
  assert.equal(index.actorId, 'lit-commando');
  assert.equal(index.spriteScale, 160 / 512, 'a page pixel is half a hero atlas pixel at 160 body units per 256 px');
  assert.equal(index.totalImageBytes, 7 * 200_000 + 50_000);
  assert.equal(index.pageFor('forked-standard').pages.length, 2, 'a polearm spans two pages');
  assert.equal(index.frameFor('forked-standard', 'reload', 'east', 0).page, 1);
  assert.deepEqual([...index.weaponIds], [...HELD_WEAPON_IDS]);
  const frame = index.frameFor('hash-rail', 'reload', 'west', 7);
  assert.equal(frame.id, 'lit-commando__hash-rail__reload__west__007');
  assert.equal(frame.heldPage, true);
  assert.equal(Object.isFrozen(frame), true);
  // Page-level constants are expanded onto each frame so the hero display
  // consumes them exactly like its own weapon-layer frames.
  assert.deepEqual([frame.layer, frame.weaponId, frame.fps, frame.loop, frame.sourceSize, frame.sourcePivot], ['weapon', 'hash-rail', 16, false, { w: 768, h: 768 }, { x: 384, y: 537 }]);
  assert.equal(index.pageFor('bear-market-burner').fireAction, null);
  assert.equal(index.pageFor('scatter-shotgun').fireAction, 'pistol-fire');
  assert.equal(index.frameFor('coin-blaster', 'aim', 'east', 0), undefined);
});

test('the held-weapon index rejects identity, budget, coverage and geometry drift', () => {
  const reject = (mutate, pattern) => {
    const data = fixture();
    mutate(data);
    assert.throws(() => createHeldWeaponIndex(data, { actorId: 'lit-commando' }), pattern);
  };
  reject((d) => { d.pipelineId = 'other'; }, /invalid held weapon atlas/u);
  reject((d) => { d.runtimeAuthority = 'gameplay'; }, /authority drift/u);
  reject((d) => { d.actorId = 'lilly'; }, /identity mismatch/u);
  reject((d) => { d.frameSize.w = 512; }, /frame contract/u);
  reject((d) => { d.clips.reload.frames = 4; }, /clip table drift/u);
  reject((d) => { delete d.weapons['auto-miner']; }, /missing held weapon page auto-miner/u);
  reject((d) => { d.weapons['auto-miner'].pages[0].imageBytes = HELD_WEAPON_PAGE_MAX_BYTES + 1; d.weapons['auto-miner'].imageBytes = HELD_WEAPON_PAGE_MAX_BYTES + 1; }, /transfer budget/u);
  reject((d) => { d.weapons['auto-miner'].pages[0].dimensions = { width: 4096, height: 4096 }; }, /page dimensions/u);
  reject((d) => { d.weapons['auto-miner'].pages[0].imageBytes -= 1; }, /byte ledger/u);
  reject((d) => { d.weapons['auto-miner'].frames[0].page = 1; }, /page out of range/u);
  reject((d) => { d.weapons['forked-standard'].pages[1].image = './lit-commando-forked-standard-2.webp'; }, /page dimensions/u);
  reject((d) => { d.weapons['auto-miner'].fireAction = 'melee'; }, /fire action/u);
  reject((d) => { d.weapons['auto-miner'].frames.pop(); d.weapons['auto-miner'].frameCount -= 1; }, /incomplete held weapon coverage/u);
  reject((d) => { d.weapons['auto-miner'].frames[0].frame.x = 1020; }, /frame geometry/u);
  reject((d) => { d.weapons['auto-miner'].frames[0].pivot.x = 3; }, /frame geometry/u);
  reject((d) => { d.weapons['auto-miner'].frames[0].muzzle = { x: Number.NaN, y: 0 }; }, /frame geometry/u);
  reject((d) => { d.weapons['auto-miner'].frames[0].id = 'wrong'; }, /frame id mismatch/u);
  reject((d) => { d.totalImageBytes += 1; }, /hero transfer budget/u);
  reject((d) => { d.sourceSha256 = 'zz'; }, /provenance/u);
});

test('hero weapon-layer frames map onto page frames by state, direction and proportional index', () => {
  const index = createHeldWeaponIndex(fixture());
  // The two-frame base aim (before the motion page arrives) maps onto the
  // six-frame page aim; the six-frame motion aim maps one to one.
  assert.equal(resolveHeldWeaponFrame(index, { weaponId: 'scatter-shotgun', state: 'aim', direction: 'east', frameIndex: 1, frameCount: 2 }).frameIndex, 3);
  assert.equal(resolveHeldWeaponFrame(index, { weaponId: 'scatter-shotgun', state: 'aim', direction: 'east', frameIndex: 5, frameCount: 6 }).frameIndex, 5);
  assert.equal(resolveHeldWeaponFrame(index, { weaponId: 'auto-miner', state: 'reload', direction: 'north', frameIndex: 7, frameCount: 8 }).id, 'lit-commando__auto-miner__reload__north__007');
  assert.equal(resolveHeldWeaponFrame(index, { weaponId: 'auto-miner', state: 'pistol-fire', direction: 'south', frameIndex: 2, frameCount: 3 }).frameIndex, 2);
  // Native-only states and unknown weapons yield null so the hero's own
  // knife / grenade / pistol frame stays in charge.
  for (const state of ['melee', 'grenade', 'death', 'hurt', 'idle']) {
    assert.equal(resolveHeldWeaponFrame(index, { weaponId: 'auto-miner', state, direction: 'south', frameIndex: 0, frameCount: 5 }), null, state);
  }
  assert.equal(resolveHeldWeaponFrame(index, { weaponId: 'coin-blaster', state: 'aim', direction: 'south', frameIndex: 0, frameCount: 2 }), null);
  assert.equal(resolveHeldWeaponFrame(index, { weaponId: 'auto-miner', state: 'aim', direction: 'up', frameIndex: 0, frameCount: 2 }), null);
});

test('the hero display swaps the weapon layer to the held page, keeps native clips, and reports the muzzle', () => {
  const actorId = 'lit-commando';
  const base = createProductionHeroAtlasIndex(heroMetadata(actorId));
  const heroIndex = createHeroMotionIndex(base, motionFixture(actorId, base));
  const mocks = displayMocks();
  const display = createProductionHeroDisplay({ index: heroIndex, atlasTexture: { source: { width: 2048, height: 2048 } }, motionTexture: { source: { width: 1024, height: 1024 } }, ...mocks });
  const heldIndex = createHeldWeaponIndex(fixture(actorId));
  const weapon = display.container.children.find((sprite) => sprite.label === 'production-hero-weapon');
  assert.equal(display.hasNativeWeapon('scatter-shotgun'), false);
  assert.equal(display.fireAction('scatter-shotgun'), null);
  assert.equal(display.fireAction('coin-blaster'), 'pistol-fire');

  assert.throws(() => display.attachHeldWeaponPage({ weaponId: 'scatter-shotgun', index: createHeldWeaponIndex(fixture('lilly')), textures: [{ source: { width: 1024, height: 1024 } }] }), /belong to this hero/u);
  assert.throws(() => display.attachHeldWeaponPage({ weaponId: 'scatter-shotgun', index: heldIndex, textures: [{ source: { width: 512, height: 512 } }] }), /does not match/u);
  assert.throws(() => display.attachHeldWeaponPage({ weaponId: 'forked-standard', index: heldIndex, textures: [{ source: { width: 1024, height: 1024 } }] }), /does not match/u, 'every page of a multi-page weapon is required');
  const pageTexture = { source: { width: 1024, height: 1024, id: 'shotgun-page' } };
  display.attachHeldWeaponPage({ weaponId: 'scatter-shotgun', index: heldIndex, textures: [pageTexture] });
  display.attachHeldWeaponPage({ weaponId: 'lightning-ledger', index: heldIndex, textures: [pageTexture] });
  const forkPages = [{ source: { width: 1024, height: 1024, id: 'fork-0' } }, { source: { width: 512, height: 512, id: 'fork-1' } }];
  display.attachHeldWeaponPage({ weaponId: 'forked-standard', index: heldIndex, textures: forkPages });
  assert.equal(display.hasNativeWeapon('scatter-shotgun'), true, 'a page makes the weapon native to the hero scene');
  assert.equal(display.hasHeldWeapon('scatter-shotgun'), true);
  assert.equal(display.hasNativeWeapon('auto-miner'), false, 'unloaded pages keep the authored overlay');
  assert.equal(display.fireAction('scatter-shotgun'), 'pistol-fire');
  assert.equal(display.fireAction('lightning-ledger'), null, 'channel weapons never trigger the recoil clip');

  // Aim frame: the page texture stands in for the native pistol frame.
  const aim = display.applyPose({ weaponId: 'scatter-shotgun', simulationTick: 0, actionTick: 0, locomotion: 'idle', legDirection: 0, torsoDirection: 0, action: 'aim' });
  assert.equal(aim[3].id, 'lit-commando__scatter-shotgun__aim__east__000');
  assert.equal(weapon.texture.source, pageTexture.source);
  assert.equal(weapon.scale.x, 160 / 512);
  assert.deepEqual([weapon.anchor.x, weapon.anchor.y], [aim[3].anchor.x, aim[3].anchor.y]);
  assert.equal(display.container.frameIds.split(',')[3], aim[3].id);
  assert.equal(display.container.heldWeaponFrameId, aim[3].id);
  const scale = 160 / 512;
  assert.deepEqual(display.container.heldWeaponMuzzle, { x: aim[3].muzzle.x * scale, y: aim[3].muzzle.y * scale });
  assert.equal(Object.isFrozen(display.container.heldWeaponMuzzle), true);
  // Body-unit muzzle offsets stay a believable reach from the ground pivot.
  assert.ok(Math.abs(display.container.heldWeaponMuzzle.x * PRODUCTION_HERO_RUNTIME_SCALE) < 60 && display.container.heldWeaponMuzzle.y * PRODUCTION_HERO_RUNTIME_SCALE < 0);

  // Reload and firing follow the page's own gesture frames.
  const reload = display.applyPose({ weaponId: 'scatter-shotgun', simulationTick: 10, actionTick: 0, locomotion: 'idle', legDirection: 0, torsoDirection: 4, action: 'aim', reloadProgress: 0.5 });
  assert.equal(display.container.motionAction, 'reload');
  assert.match(reload[3].id, /^lit-commando__scatter-shotgun__reload__west__00\d$/u);
  const fire = display.applyPose({ weaponId: 'scatter-shotgun', simulationTick: 12, actionTick: 5, locomotion: 'idle', legDirection: 2, torsoDirection: 2, action: 'pistol-fire' });
  assert.equal(fire[3].id, 'lit-commando__scatter-shotgun__pistol-fire__south__001');

  // A frame on the second page of a multi-page weapon reads that page's texture.
  const forkReload = display.applyPose({ weaponId: 'forked-standard', simulationTick: 10, actionTick: 0, locomotion: 'idle', legDirection: 0, torsoDirection: 0, action: 'aim', reloadProgress: 0.5 });
  assert.equal(forkReload[3].page, 1);
  assert.equal(weapon.texture.source, forkPages[1].source);

  // Melee keeps the native knife frame and clears the held muzzle.
  const melee = display.applyPose({ weaponId: 'scatter-shotgun', simulationTick: 12, actionTick: 3, locomotion: 'idle', legDirection: 2, torsoDirection: 2, action: 'melee' });
  assert.match(melee[3].id, /^lit-commando__weapon__melee__south__/u);
  assert.equal(weapon.texture.source, undefined === weapon.texture.source ? undefined : weapon.texture.source);
  assert.notEqual(weapon.texture.source, pageTexture.source);
  assert.equal(display.container.heldWeaponFrameId, '');
  assert.equal(display.container.heldWeaponMuzzle, null);

  // The pistol and any weapon without a page render their native / overlay path untouched.
  const pistol = display.applyPose({ weaponId: 'coin-blaster', simulationTick: 0, actionTick: 0, locomotion: 'idle', legDirection: 0, torsoDirection: 0, action: 'aim' });
  assert.equal(pistol[3].id, 'lit-commando__weapon__aim__east__000');
  const miner = display.applyPose({ weaponId: 'auto-miner', simulationTick: 0, actionTick: 0, locomotion: 'idle', legDirection: 0, torsoDirection: 0, action: 'aim' });
  assert.equal(miner[3].id, 'lit-commando__weapon__aim__east__000');
  assert.equal(display.container.heldWeaponMuzzle, null);
});

test('the loader fetches metadata once per hero, a page once per weapon, and fails closed per session', async () => {
  const actorId = 'lit-commando';
  const metadata = fixture(actorId);
  const fetches = [];
  const loads = [];
  const attached = [];
  const display = { container: {}, attachHeldWeaponPage: (page) => attached.push(page.weaponId) };
  const loader = createHeldWeaponLoader({
    selection: { actorId },
    display,
    Assets: { load: async (url) => { loads.push(url); return { source: url.endsWith('-1.webp') ? { width: 512, height: 512 } : { width: 1024, height: 1024 } }; } },
    fetchImpl: async (url) => { fetches.push(url); return { ok: true, json: async () => metadata }; },
  });
  assert.equal(loader.request('coin-blaster'), null, 'the native pistol is never a page');
  await Promise.all([loader.request('scatter-shotgun'), loader.request('scatter-shotgun'), loader.request('hash-rail'), loader.request('forked-standard')]);
  assert.deepEqual(fetches, ['/assets/generated/hmh-held-weapons/lit-commando/lit-commando-held-weapons.json']);
  assert.deepEqual(loads, ['/assets/generated/hmh-held-weapons/lit-commando/lit-commando-scatter-shotgun.webp', '/assets/generated/hmh-held-weapons/lit-commando/lit-commando-hash-rail.webp', '/assets/generated/hmh-held-weapons/lit-commando/lit-commando-forked-standard.webp', '/assets/generated/hmh-held-weapons/lit-commando/lit-commando-forked-standard-1.webp']);
  assert.deepEqual(attached, ['scatter-shotgun', 'hash-rail', 'forked-standard']);
  assert.equal(display.container.heldWeaponStatus, 'ready');
  assert.deepEqual(loader.requested, ['scatter-shotgun', 'hash-rail', 'forked-standard']);

  const broken = { container: {}, attachHeldWeaponPage: () => { throw new Error('never'); } };
  let attempts = 0;
  const failing = createHeldWeaponLoader({ selection: { actorId }, display: broken, Assets: { load: async () => ({ source: { width: 1, height: 1 } }) }, fetchImpl: async () => { attempts += 1; return { ok: false, status: 404 }; } });
  assert.equal(await failing.request('auto-miner'), null);
  assert.equal(await failing.request('auto-miner'), null);
  assert.equal(attempts, 1, 'a failed page is not re-fetched within the session');
  assert.equal(broken.container.heldWeaponStatus, 'fallback');
  assert.match(broken.container.heldWeaponError, /404/u);
  assert.throws(() => createHeldWeaponLoader({ selection: { actorId }, display: {}, Assets: {} }), TypeError);
});

test('main.mjs routes the active weapon through the held pages and spawns muzzle flashes at the page muzzle', () => {
  const source = readFileSync(repoUrl('apps/hmh-reboot/src/main.mjs'), 'utf8');
  assert.match(source, /import\('\.\/held-weapon-atlas\.mjs'\)/u, 'held pages stay behind dynamic import');
  // Perf step 6: through the profile loader, so phones get the @0.5x pages.
  assert.match(source, /display\.container\.heldWeapons = createHeldWeaponLoader\(\{ selection, display, Assets: textureAssets \}\)/u);
  assert.match(source, /productionHeroDisplay\.container\.heldWeapons\?\.request\(activeWeaponId\)/u, 'a page is requested on equip');
  assert.match(source, /applyPose\(\{\s*weaponId: activeWeaponId,/u, 'the pose carries the active weapon');
  assert.match(source, /productionHeroDisplay\.fireAction\(lastWeaponFire\.weaponId\) === 'pistol-fire'/u, 'every page with a fire action plays the recoil clip');
  assert.match(source, /const heldMuzzle = productionHeroDisplay\?\.container\.heldWeaponMuzzle;/u);
  assert.match(source, /x: actor\.x \+ heldMuzzle\.x \* PRODUCTION_HERO_RUNTIME_SCALE,\s*y: actor\.y,\s*z: actor\.groundZ - heldMuzzle\.y \* PRODUCTION_HERO_RUNTIME_SCALE,/u);
  // Held pages own the layer through the same native-weapon gate the pistol uses.
  assert.match(source, /productionHeroDisplay\.hasNativeWeapon\(activeWeaponId\)/u);
  const telemetry = readFileSync(repoUrl('apps/hmh-reboot/src/runtime-telemetry-writer.mjs'), 'utf8');
  assert.match(telemetry, /dataset\.heldWeaponFrameId = productionHeroDisplay\?\.container\.heldWeaponFrameId/u);
  const held = readFileSync(repoUrl('apps/hmh-reboot/src/held-weapon-atlas.mjs'), 'utf8');
  assert.doesNotMatch(held, /from '\.\/(weapon-system|collision|combat|enemy|grenades|melee|bridge)/u, 'projection-only source imports nothing from the simulation');
});

test('shipped held-weapon pages exist for every production hero and validate against the runtime index', { skip: shippedActors.length === 0 ? 'held-weapon pages not generated' : false }, () => {
  assert.deepEqual(shippedActors, ACTORS, 'every production hero needs a held-weapon page set');
  const manifest = readJson('apps/hmh-reboot/assets/source/blender/hmh-held-weapons.json');
  assert.equal(manifest.pipelineId, HELD_WEAPON_PIPELINE_ID);
  const exporterSha = sha256('scripts/hmh-blender/export-hmh-held-weapons.py');
  const sceneSha = sha256('apps/hmh-reboot/assets/source/blender/hmh-held-weapons.blend');
  const heroManifest = readJson('apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json');
  for (const actorId of ACTORS) {
    const metadata = readJson(heldMetadataPath(actorId));
    const index = createHeldWeaponIndex(metadata, { actorId });
    assert.equal(metadata.exporterSha256, exporterSha, `${actorId} pages were rendered by a different exporter`);
    assert.equal(metadata.weaponSceneSha256, sceneSha, `${actorId} pages were rendered from a different weapon scene`);
    assert.equal(metadata.sourceSha256, heroManifest.pilots.find((p) => p.actorId === actorId).sourceModel.sourceSha256);
    assert.equal(index.pixelDensity, 2, 'pages render at twice the hero pixel density');
    assert.equal(index.coverage, 1.5);
    const dir = `apps/portal/assets/generated/hmh-held-weapons/${actorId}`;
    let total = 0;
    for (const weaponId of HELD_WEAPON_IDS) {
      const page = index.pageFor(weaponId);
      for (const image of page.pages) {
        const relative = `${dir}/${image.image.replace(/^\.\//u, '')}`;
        assert.equal(statSync(repoUrl(relative)).size, image.imageBytes, `${actorId}/${weaponId} page bytes drift`);
        assert.equal(sha256(relative), image.imageSha256, `${actorId}/${weaponId} page sha drift`);
        assert.ok(image.dimensions.width <= 2048);
      }
      total += page.imageBytes;
      assert.equal(page.fireAction, manifest.weapons.find((w) => w.weaponId === weaponId).fireAction);
    }
    assert.equal(total, index.totalImageBytes);
    const metrics = readJson(`${dir}/${actorId}-held-weapons-metrics.json`);
    assert.equal(metrics.status, 'pass');
    assert.equal(metrics.frameCount, HELD_WEAPON_IDS.length * DIRECTIONS.length * Object.values(HELD_WEAPON_CLIPS).reduce((sum, clip) => sum + clip.frames, 0));
    assert.equal(sha256(`${dir}/${actorId}-held-weapons.json`), metrics.metadataSha256);
    assert.ok(existsSync(repoUrl(`${dir}/${actorId}-held-weapons-contact-sheet.png`)));
  }
});

test('shipped held-weapon grips land inside the native pistol crop for every hero and direction', { skip: shippedActors.length === 0 ? 'held-weapon pages not generated' : false }, () => {
  for (const actorId of ACTORS) {
    const index = createHeldWeaponIndex(readJson(heldMetadataPath(actorId)), { actorId });
    const calibrationByDirection = new Map(index.calibration.map((entry) => [entry.direction, entry]));
    assert.equal(calibrationByDirection.size, 8, `${actorId} must record the native pistol box per direction`);
    for (const weaponId of HELD_WEAPON_IDS) {
      for (const direction of DIRECTIONS) {
        const frame = index.frameFor(weaponId, 'aim', direction, 0);
        const box = calibrationByDirection.get(direction).nativePistolBox;
        const grip = { x: frame.grip.x + index.sourcePivot.x, y: frame.grip.y + index.sourcePivot.y };
        // The palm point sits inside the pistol's own silhouette (plus the
        // page's half-pixel rounding): that is what "in the hero's hand" means.
        assert.ok(grip.x >= box[0] - 1 && grip.x <= box[2] + 1 && grip.y >= box[1] - 1 && grip.y <= box[3] + 1, `${actorId}/${weaponId}/${direction} grip ${JSON.stringify(grip)} outside pistol box ${JSON.stringify(box)}`);
        // The muzzle leads the grip along the facing: east-facing directions
        // end screen-right of the grip, west-facing ones screen-left.
        if (['east', 'north-east', 'south-east'].includes(direction)) assert.ok(frame.muzzle.x > frame.grip.x, `${actorId}/${weaponId}/${direction} muzzle must point right`);
        if (['west', 'north-west', 'south-west'].includes(direction)) assert.ok(frame.muzzle.x < frame.grip.x, `${actorId}/${weaponId}/${direction} muzzle must point left`);
        if (direction === 'north') assert.ok(frame.muzzle.y < frame.grip.y, `${actorId}/${weaponId}/north muzzle must point up`);
        if (direction === 'south') assert.ok(frame.muzzle.y > frame.grip.y, `${actorId}/${weaponId}/south muzzle must point down`);
      }
      // Every clip on the page moves: reload and idle-check carry distinct
      // poses, so the weapon follows the hands instead of freezing.
      for (const state of ['reload', 'idle-check', 'pistol-fire']) {
        const hashes = new Set(Array.from({ length: HELD_WEAPON_CLIPS[state].frames }, (_, i) => index.frameFor(weaponId, state, 'east', i).sourcePixelSha256));
        assert.ok(hashes.size >= 2, `${actorId}/${weaponId}/${state} must carry more than one pose`);
      }
    }
  }
});
