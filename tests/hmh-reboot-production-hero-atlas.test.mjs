import assert from 'node:assert/strict';
import test from 'node:test';
import * as heroPolicy from '../apps/hmh-reboot/src/production-hero-atlas.mjs';
import { readFileSync } from 'node:fs';

test('approved texture policy enforces the actual four-hero aggregate', () => {
  const perHero = 4 * 1024 * 1024;
  assert.equal(heroPolicy.PRODUCTION_HERO_MAX_TEXTURE_TOTAL_BYTES, 16 * 1024 * 1024);
  assert.equal(heroPolicy.validateProductionHeroTextureTotalBytes([perHero, perHero, perHero, perHero]), 16 * 1024 * 1024);
  assert.throws(() => heroPolicy.validateProductionHeroTextureTotalBytes([perHero + 1, perHero, perHero, perHero]), /budget|exceed/u);
  assert.throws(() => heroPolicy.validateProductionHeroTextureTotalBytes([1, 2, 3]), /four/u);
  assert.throws(() => heroPolicy.validateProductionHeroTextureTotalBytes([1, 2, 3, -1]), /positive|integer/u);
  const qa = readFileSync(new URL('../scripts/hmh-reboot-production-asset-qa.mjs', import.meta.url), 'utf8');
  assert.match(qa, /validateProductionHeroTextureTotalBytes\(heroReports\.map/u);
  assert.doesNotMatch(qa, /initialRequestBytes <= maxHeroAtlasTotalBytes/u);
});
import {
  PRODUCTION_HERO_ASSETS,
  PRODUCTION_HERO_ATLAS_METADATA_URL,
  PRODUCTION_HERO_MAX_TEXTURE_BYTES,
  PRODUCTION_HERO_RUNTIME_SCALE,
  createProductionHeroAtlasIndex,
  createProductionHeroDisplay,
  directionNameForProductionIndex,
  productionHeroAsset,
  resolveProductionHeroPose,
  validateProductionHeroTextureBytes,
} from '../apps/hmh-reboot/src/production-hero-atlas.mjs';

const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
test('automatic interaction uses the authored arm reach while preserving moving legs', () => {
  const index=createProductionHeroAtlasIndex(metadataFixture());
  const frames=resolveProductionHeroPose(index,{simulationTick:12,actionTick:6,locomotion:'moving',legDirection:2,torsoDirection:4,action:'interact'});
  assert.equal(frames.find(f=>f.layer==='lower-body').state,'run');
  assert.equal(frames.find(f=>f.layer==='torso-head').state,'grenade');
  assert.equal(frames.find(f=>f.layer==='torso-head').direction,'west');
});
const LAYERS = ['shadow', 'lower-body', 'torso-head', 'weapon'];
const clips = {
  shadow: { idle: { frames: 1, fps: 1 } },
  'lower-body': {
    idle: { frames: 2, fps: 2 }, run: { frames: 6, fps: 12 },
    dash: { frames: 4, fps: 15, loop: false }, melee: { frames: 5, fps: 15, loop: false },
    grenade: { frames: 5, fps: 12, loop: false }, death: { frames: 6, fps: 8, loop: false },
  },
  'torso-head': {
    aim: { frames: 2, fps: 2 }, 'pistol-fire': { frames: 3, fps: 15 }, hurt: { frames: 2, fps: 10 },
    dash: { frames: 4, fps: 15, loop: false }, melee: { frames: 5, fps: 15, loop: false },
    grenade: { frames: 5, fps: 12, loop: false }, death: { frames: 6, fps: 8, loop: false },
  },
  weapon: {
    aim: { frames: 2, fps: 2 }, 'pistol-fire': { frames: 3, fps: 15 },
    dash: { frames: 4, fps: 15, loop: false }, melee: { frames: 5, fps: 15, loop: false },
    grenade: { frames: 5, fps: 12, loop: false }, death: { frames: 6, fps: 8, loop: false },
  },
};

function metadataFixture(actorId = 'lit-commando') {
  const { variantId } = productionHeroAsset(actorId);
  const frames = [];
  for (const layer of LAYERS) {
    for (const [state, clip] of Object.entries(clips[layer])) {
      for (const direction of DIRECTIONS) {
        for (let frameIndex = 0; frameIndex < clip.frames; frameIndex += 1) {
          frames.push({
            id: `${actorId}__${layer}__${state}__${direction}__${String(frameIndex).padStart(3, '0')}`,
            layer,
            state,
            direction,
            frameIndex,
            fps: clip.fps,
            ...(clip.loop === false ? { loop: false } : {}),
            frame: { x: frames.length * 2, y: 0, w: 80, h: 120 },
            orig: { w: 80, h: 120 },
            trim: { x: 0, y: 0, w: 80, h: 120 },
            sourceSize: { w: 256, h: 256 },
            spriteSourceSize: { x: 40, y: 31, w: 80, h: 120 },
            sourcePivot: { x: 80, y: 146 },
            pivot: { x: 40, y: 115 },
            anchor: { x: 0.5, y: 0.958333 },
            opaquePixels: 100,
          });
        }
      }
    }
  }
  if (actorId !== 'lit-commando') {
    for (const frame of frames) {
      if (frame.layer !== 'weapon' || frame.state !== 'grenade' || frame.frameIndex < 3) continue;
      Object.assign(frame, {
        frame: { ...frame.frame, w: 1, h: 1 }, orig: { w: 1, h: 1 },
        trim: { x: 0, y: 0, w: 1, h: 1 }, pivot: { x: 0, y: 0 }, anchor: { x: 0, y: 0 },
        spriteSourceSize: { x: frame.sourcePivot.x, y: frame.sourcePivot.y, w: 1, h: 1 },
        opaquePixels: 0, visibility: 'source-prop-released',
      });
    }
  }
  return {
    schemaVersion: 2,
    nativeWeaponIds: ['coin-blaster'],
    nativeActionIds: ['melee', 'grenade'],
    pipelineId: 'hmh-reboot-production-hero-pilot-v1',
    actorId,
    variantId,
    classification: 'production-art',
    runtimeAuthority: 'projection-only',
    gameplayBodyProfile: 'human-medium-collision-v1',
    image: `./${actorId}-production-pilot-atlas.webp`,
    directions: DIRECTIONS,
    layers: LAYERS,
    composition: { independentDirections: true, weaponSocket: 'weapon_socket', layerOrder: LAYERS },
    frames,
  };
}

test('production hero atlas constants target selected repository-owned art', () => {
  assert.equal(PRODUCTION_HERO_ATLAS_METADATA_URL, '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json');
  assert.equal(PRODUCTION_HERO_ASSETS['lit-valkyrie'].metadataUrl, '/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.json');
  assert.equal(productionHeroAsset('lit-valkyrie').variantId, 'plasma-striker');
  assert.throws(() => productionHeroAsset('unknown-hero'));
  assert.ok(PRODUCTION_HERO_RUNTIME_SCALE > 0.5 && PRODUCTION_HERO_RUNTIME_SCALE < 0.7);
});

test('all four textured heroes use exact WebP within the centralized 4 MiB texture boundary', () => {
  assert.equal(PRODUCTION_HERO_MAX_TEXTURE_BYTES, 4 * 1024 * 1024);
  assert.equal(validateProductionHeroTextureBytes(PRODUCTION_HERO_MAX_TEXTURE_BYTES), PRODUCTION_HERO_MAX_TEXTURE_BYTES);
  assert.throws(() => validateProductionHeroTextureBytes(PRODUCTION_HERO_MAX_TEXTURE_BYTES + 1), /4,194,304/);
  assert.deepEqual(Object.keys(PRODUCTION_HERO_ASSETS).sort(), ['lester-original', 'lilly', 'lit-commando', 'lit-valkyrie']);
  for (const asset of Object.values(PRODUCTION_HERO_ASSETS)) {
    assert.match(asset.imageUrl, /\.webp$/, asset.actorId);
    assert.equal(asset.artSource, 'packed-textured-blend', asset.actorId);
  }
});

test('schema 2 reconstructs exact orig/trim geometry and preserves logical density', () => {
  const metadata = metadataFixture();
  metadata.schemaVersion = 2;
  metadata.image = './lit-commando-production-pilot-atlas.webp';
  metadata.nativeWeaponIds = ['coin-blaster'];
  metadata.nativeActionIds = ['melee', 'grenade'];
  metadata.frames = metadata.frames.map((frame) => ({
    ...frame,
    frame: { ...frame.frame, w: 40, h: 60 },
    orig: { w: 80, h: 120 },
    trim: { x: 20, y: 30, w: 40, h: 60 },
    sourceSize: { w: 256, h: 256 },
    spriteSourceSize: { x: 64, y: 80, w: 80, h: 120 },
    sourcePivot: { x: 104, y: 195 },
    pivot: { x: 40, y: 115 },
    anchor: { x: 0.5, y: 115 / 120 },
  }));
  const index = createProductionHeroAtlasIndex(metadata);
  assert.equal(index.hasNativeWeapon('coin-blaster'), true);
  assert.equal(index.hasNativeWeapon('scatter-gun'), false);
  assert.equal(index.hasNativeAction('melee'), true);
  assert.equal(index.hasNativeAction('grenade'), true);

  class Container { constructor() { this.scale = { set: (x, y = x) => { this.scale.x = x; this.scale.y = y; } }; this.children = []; } addChild(child) { this.children.push(child); } }
  class Sprite { constructor({ texture }) { this.texture = texture; this.anchor = { set: (x, y) => { this.anchor.x = x; this.anchor.y = y; } }; this.scale = { set: (x, y = x) => { this.scale.x = x; this.scale.y = y; } }; this.visible = true; } }
  class Texture { constructor(options) { Object.assign(this, options); } }
  class Rectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  const display = createProductionHeroDisplay({
    index,
    atlasTexture: { source: { width: 2048, height: 2048 } },
    ContainerClass: Container,
    SpriteClass: Sprite,
    TextureClass: Texture,
    RectangleClass: Rectangle,
  });
  const sprite = display.container.children[0];
  assert.deepEqual({ width: sprite.texture.orig.width, height: sprite.texture.orig.height }, { width: 80, height: 120 });
  assert.deepEqual({ x: sprite.texture.trim.x, y: sprite.texture.trim.y, width: sprite.texture.trim.width, height: sprite.texture.trim.height }, { x: 20, y: 30, width: 40, height: 60 });
  assert.equal(sprite.scale.x, 160 / 256);
  assert.equal(sprite.anchor.x * sprite.texture.orig.width, 40, 'logical ground x must remain exact');
  assert.equal(sprite.anchor.y * sprite.texture.orig.height, 115, 'logical ground y must remain exact');
});

test('decimal logical pivots preserve the actual 80.1 minus 40 versus 40.1 witness', () => {
  assert.notEqual(80.1 - 40, 40.1, 'must exercise real floating-point cancellation');
  for (const scale of [1, 2, 8]) {
    const metadata = metadataFixture();
    const source = metadata.frames[0];
    Object.assign(source, {
      orig: { w: 80 * scale, h: 120 * scale },
      sourceSize: { w: 256 * scale, h: 256 * scale },
      spriteSourceSize: { x: 40 * scale, y: 31 * scale, w: 80 * scale, h: 120 * scale },
      sourcePivot: { x: 80.1 * scale, y: 146.1 * scale },
      pivot: { x: 40.1 * scale, y: 115.1 * scale },
      anchor: { x: 40.1 / 80, y: 115.1 / 120 },
    });
    const before = structuredClone(source);
    const index = createProductionHeroAtlasIndex(metadata);
    const frame = index.frameByKey.get(`${source.layer}|${source.state}|${source.direction}|${source.frameIndex}`);
    assert.deepEqual(frame, before, 'authored decimals must never be rounded or rewritten');
    assert.deepEqual(source, before);
    for (const mutate of [
      f => { f.pivot.x += 1e-9 * scale; },
      f => { f.sourcePivot.y += 1e-9 * scale; },
      f => { f.anchor.x += 2e-6; },
      f => { f.frame.x = 0.1; },
      f => { f.spriteSourceSize.x = 40 * scale + 1e-12; },
      f => { f.trim.x = 1e-12; },
      f => { f.sourceSize.w += 0.1; },
      f => { f.orig.w += 0.1; },
      f => { f.pivot.x = NaN; },
      f => { f.sourcePivot.y = Infinity; },
      f => { f.anchor.x = '0.5'; },
      f => { delete f.sourcePivot; },
    ]) {
      const invalid = structuredClone(metadata);
      mutate(invalid.frames[0]);
      assert.throws(() => createProductionHeroAtlasIndex(invalid), /logical|rectangle|size|anchor/i);
    }
  }
});

test('readability measures trimmed body pixels at runtime density, not padding, shadow or weapon reach', () => {
  const metadata = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json', import.meta.url), 'utf8'));
  const index = createProductionHeroAtlasIndex(metadata);
  assert.equal(typeof heroPolicy.measureProductionHeroBodyHeight, 'function');
  const height = heroPolicy.measureProductionHeroBodyHeight(index);
  assert.ok(height >= 53 && height <= 54, `real Commando living-pose body height ${height} must exclude 256px canvas padding and the flat death pose`);
  const inflated = structuredClone(metadata);
  for (const frame of inflated.frames) {
    if (frame.layer === 'shadow' || frame.layer === 'weapon') frame.frame.h += 1000;
  }
  const ignoredDecor = { ...index, frameByKey: new Map(inflated.frames.map((frame) => [frame.id, frame])) };
  assert.equal(heroPolicy.measureProductionHeroBodyHeight(ignoredDecor), height);
  assert.throws(() => heroPolicy.measureProductionHeroBodyHeight({ frameByKey: new Map() }), /body|frame/i);
});

test('atlas loading rejects missing action frames before any pose can render', () => {
  const metadata = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json', import.meta.url), 'utf8'));
  metadata.frames = metadata.frames.filter((frame) => !(frame.layer === 'lower-body' && frame.state === 'dash' && frame.direction === 'north' && frame.frameIndex === 1));
  assert.equal(metadata.frames.length, 647);
  assert.throws(() => createProductionHeroAtlasIndex(metadata), /coverage|648|missing|contiguous/i);
});

test('native routes reject unknown and duplicate equipment or action declarations', () => {
  const original = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json', import.meta.url), 'utf8'));
  for (const [field, ids] of [['nativeWeaponIds', ['hash-rail']], ['nativeWeaponIds', ['coin-blaster', 'coin-blaster']], ['nativeActionIds', ['victory']], ['nativeActionIds', ['grenade', 'grenade']]]) {
    const metadata = structuredClone(original);
    metadata[field] = ids;
    assert.throws(() => createProductionHeroAtlasIndex(metadata), /native|approved|duplicate/i, `${field}: ${ids}`);
  }
});

test('readability minimum covers every living body pose without zooming into a flat corpse', () => {
  const metadata = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json', import.meta.url), 'utf8'));
  const index = createProductionHeroAtlasIndex(metadata);
  const actual = heroPolicy.measureProductionHeroBodyHeight(index);
  // Independent decoded-WebP reconstruction measures 147 source pixels,
  // not the earlier narrower single-state estimate.
  assert.ok(Math.abs(actual - 53.2875) < 0.000001, `all-living-pose minimum was ${actual}`);
});

test('released native grenade cells are explicit, complete, transparent-only weapon slots', () => {
  const asset = productionHeroAsset('lit-valkyrie');
  const metadata = JSON.parse(readFileSync(new URL(`../apps/portal${asset.metadataUrl}`, import.meta.url), 'utf8'));
  const hidden = metadata.frames.filter((frame) => frame.visibility === 'source-prop-released');
  assert.equal(hidden.length, 16);
  assert.equal(createProductionHeroAtlasIndex(metadata, asset).frameByKey.size, 648);
  for (const mutate of [
    (m) => { m.frames.find((f) => f.layer === 'lower-body').visibility = 'source-prop-released'; },
    (m) => { m.frames.find((f) => f.visibility).visibility = 'ignore-blank'; },
    (m) => { delete m.frames.find((f) => f.visibility).visibility; },
    (m) => { m.frames.find((f) => f.visibility).opaquePixels = 1; },
    (m) => { m.nativeActionIds = ['melee']; },
  ]) {
    const invalid = structuredClone(metadata);
    mutate(invalid);
    assert.throws(() => createProductionHeroAtlasIndex(invalid, asset), /visibility|released|transparent|opaque|native/i);
  }
});

test('schema 2 rejects corrupt trim geometry and atlas out-of-bounds before display', () => {
  const metadata = metadataFixture();
  metadata.schemaVersion = 2;
  metadata.image = './lit-commando-production-pilot-atlas.webp';
  metadata.nativeWeaponIds = ['coin-blaster'];
  metadata.nativeActionIds = ['melee', 'grenade'];
  metadata.frames = metadata.frames.map((frame) => ({ ...frame, orig: { w: 80, h: 120 }, trim: { x: 0, y: 0, w: 80, h: 120 }, sourceSize: { w: 256, h: 256 }, spriteSourceSize: { x: 40, y: 40, w: 80, h: 120 }, sourcePivot: { x: 80, y: 155 } }));
  const corrupt = structuredClone(metadata);
  corrupt.frames[0].trim.x = 79;
  assert.throws(() => createProductionHeroAtlasIndex(corrupt), /trim/i);

  const index = createProductionHeroAtlasIndex(metadata);
  class Container { constructor() { this.scale = { set() {} }; } addChild() {} }
  class Sprite { constructor() { this.anchor = { set() {} }; this.scale = { set() {} }; } }
  class Texture { constructor(options) { Object.assign(this, options); } }
  class Rectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  assert.throws(() => createProductionHeroDisplay({ index, atlasTexture: { source: { width: 64, height: 64 } }, ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle }), /outside atlas/i);
});

test('production hero atlas index rejects authority and identity drift', () => {
  const metadata = metadataFixture();
  const index = createProductionHeroAtlasIndex(metadata);
  assert.equal(index.actorId, 'lit-commando');
  assert.equal(index.variantId, 'reserve-vanguard');
  assert.equal(index.frameByKey.size, 648);
  assert.deepEqual(index.layerOrder, LAYERS);

  for (const [field, value] of [
    ['runtimeAuthority', 'gameplay-authority'],
    ['gameplayBodyProfile', 'human-heavy-collision-v1'],
    ['classification', 'concept-review-only'],
    ['actorId', 'lit-valkyrie'],
  ]) {
    const invalid = metadataFixture();
    invalid[field] = value;
    assert.throws(() => createProductionHeroAtlasIndex(invalid));
  }

  const femaleMetadata = metadataFixture('lit-valkyrie');
  const female = createProductionHeroAtlasIndex(femaleMetadata, productionHeroAsset('lit-valkyrie'));
  assert.equal(female.actorId, 'lit-valkyrie');
  assert.equal(female.variantId, 'plasma-striker');
  assert.equal(female.frameByKey.size, 648);
});

test('production direction mapping preserves simulation semantics', () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => directionNameForProductionIndex(index)), [
    'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east',
  ]);
  assert.equal(directionNameForProductionIndex(-1), 'north-east');
});

test('production pose resolver composes independent locomotion aim fire and hurt layers', () => {
  const index = createProductionHeroAtlasIndex(metadataFixture());
  const idle = resolveProductionHeroPose(index, {
    simulationTick: 30,
    actionTick: 0,
    locomotion: 'idle',
    legDirection: 0,
    torsoDirection: 6,
    action: 'aim',
  });
  assert.deepEqual(idle.map((frame) => [frame.layer, frame.state, frame.direction, frame.frameIndex]), [
    ['shadow', 'idle', 'east', 0],
    ['lower-body', 'idle', 'east', 1],
    ['torso-head', 'aim', 'north', 1],
    ['weapon', 'aim', 'north', 1],
  ]);

  const firing = resolveProductionHeroPose(index, {
    simulationTick: 5,
    actionTick: 5,
    locomotion: 'moving',
    legDirection: 1,
    torsoDirection: 7,
    action: 'pistol-fire',
  });
  assert.deepEqual(firing.map((frame) => [frame.layer, frame.state, frame.direction, frame.frameIndex]), [
    ['shadow', 'idle', 'south-east', 0],
    ['lower-body', 'run', 'south-east', 1],
    ['torso-head', 'pistol-fire', 'north-east', 1],
    ['weapon', 'pistol-fire', 'north-east', 1],
  ]);

  const hurt = resolveProductionHeroPose(index, {
    simulationTick: 7,
    actionTick: 7,
    locomotion: 'idle',
    legDirection: 4,
    torsoDirection: 4,
    action: 'hurt',
  });
  assert.deepEqual(hurt.map((frame) => [frame.layer, frame.state]), [
    ['shadow', 'idle'], ['lower-body', 'idle'], ['torso-head', 'hurt'], ['weapon', 'aim'],
  ]);
});

test('every shipped atlas action state is reachable from the runtime pose selector', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  // Every authored action now has a real simulation event selector. These
  // strings are only a reachability guard; the next test resolves real atlas
  // frames and verifies non-looping cadence.
  for (const action of ['aim', 'pistol-fire', 'hurt', 'dash', 'melee', 'grenade', 'death']) {
    assert.ok(source.includes(`'${action}'`), `runtime must be able to select the ${action} pose`);
  }
  assert.match(source, /lastPlayerHit = \{ tick/, 'player damage must record a tick for the hurt pose');
  assert.match(source, /PLAYER_HURT_POSE_TICKS/, 'the hurt pose needs a bounded duration');
});

test('generated hero actions resolve authored non-looping body clips and hold death', async () => {
  const { readFile } = await import('node:fs/promises');
  const selection = productionHeroAsset('lit-commando');
  const metadata = JSON.parse(await readFile(new URL('../apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json', import.meta.url), 'utf8'));
  const index = createProductionHeroAtlasIndex(metadata, selection);
  assert.equal(index.schemaVersion, 2);
  assert.equal(index.frameByKey.size, 648);
  assert.equal(index.hasNativeWeapon('coin-blaster'), true);
  assert.equal(index.hasNativeAction('melee'), true);
  assert.equal(index.hasNativeAction('grenade'), true);
  for (const frame of index.frameByKey.values()) {
    assert.equal(frame.spriteSourceSize.x + frame.pivot.x, frame.sourcePivot.x, `${frame.id} ground x drifted`);
    assert.equal(frame.spriteSourceSize.y + frame.pivot.y, frame.sourcePivot.y, `${frame.id} ground y drifted`);
  }
  for (const action of ['dash', 'melee', 'grenade']) {
    const pose = resolveProductionHeroPose(index, { simulationTick: 0, actionTick: 0, locomotion: 'idle', legDirection: 2, torsoDirection: 2, action });
    assert.deepEqual(pose.slice(1).map((frame) => frame.state), [action, action, action]);
  }
  const death = resolveProductionHeroPose(index, { simulationTick: 100_000, actionTick: 100_000, locomotion: 'idle', legDirection: 2, torsoDirection: 2, action: 'death' });
  for (const frame of death.slice(1)) {
    const clip = index.clipByKey.get(`${frame.layer}|death|east`);
    assert.equal(frame.frameIndex, clip.frameCount - 1, `${frame.layer} death must hold its final frame`);
    assert.equal(clip.loop, false);
  }
});

for (const actorId of ['lit-commando', 'lit-valkyrie', 'lilly', 'lester-original']) {
  test(`${actorId} binds its own textured atlas and only source-backed native equipment`, () => {
    const asset = productionHeroAsset(actorId);
    const metadata = JSON.parse(readFileSync(new URL(`../apps/portal${asset.metadataUrl}`, import.meta.url), 'utf8'));
    assert.equal(metadata.schemaVersion, 2);
    const index = createProductionHeroAtlasIndex(metadata, asset);
    assert.equal(index.actorId, actorId);
    assert.equal(index.frameByKey.size, 648);
    assert.deepEqual(index.nativeWeaponIds, ['coin-blaster']);
    assert.deepEqual(index.nativeActionIds, ['melee', 'grenade']);
    assert.equal(index.hasNativeWeapon('scatter-shotgun'), false);
    assert.equal(index.hasNativeAction('victory'), false);
    for (const direction of DIRECTIONS) {
      for (const clip of ['melee', 'grenade', 'death']) assert.ok(index.clipByKey.has(`torso-head|${clip}|${direction}`));
    }
    const unapproved = structuredClone(metadata);
    unapproved.nativeWeaponIds.push('hash-rail');
    assert.throws(() => createProductionHeroAtlasIndex(unapproved, asset), /unapproved native/);
    const missing = structuredClone(metadata);
    missing.frames.pop();
    assert.throws(() => createProductionHeroAtlasIndex(missing, asset), /648/);
  });
}

function emittedMetadata(actorId) {
  const asset = productionHeroAsset(actorId);
  return JSON.parse(readFileSync(new URL(`../apps/portal${asset.metadataUrl}`, import.meta.url), 'utf8'));
}

function displayMocks(constructed = []) {
  class Container {
    constructor() { constructed.push('container'); this.children = []; this.scale = { set() {} }; }
    addChild(child) { this.children.push(child); }
  }
  class Sprite {
    constructor({ texture }) {
      constructed.push('sprite'); this.texture = texture;
      this.anchor = { set: (x, y) => Object.assign(this.anchor, { x, y }) };
      this.scale = { set: (x, y = x) => Object.assign(this.scale, { x, y }) };
    }
  }
  class Texture { constructor(options) { constructed.push('texture'); Object.assign(this, options); } }
  class Rectangle { constructor(x, y, width, height) { constructed.push('rectangle'); Object.assign(this, { x, y, width, height }); } }
  return { ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle };
}

for (const [label, opaquePixels] of [
  ['negative', -1],
  ['fractional', 0.5],
  ['greater than its packed raster area', (80 * 120) + 1],
]) {
  test(`atlas indexing rejects ${label} opaquePixels evidence`, () => {
    const metadata = metadataFixture();
    metadata.frames.find((frame) => frame.layer === 'lower-body').opaquePixels = opaquePixels;
    assert.throws(() => createProductionHeroAtlasIndex(metadata), /opaque.*(?:integer|area)/i);
  });
}

test('validated frame lookup cannot be replaced before the display consumes a pose', () => {
  const metadata = emittedMetadata('lit-commando');
  const index = createProductionHeroAtlasIndex(metadata);
  const display = createProductionHeroDisplay({ index, atlasTexture: { source: { width: 2048, height: 2048 } }, ...displayMocks() });
  const key = 'weapon|grenade|east|0';
  const approved = index.frameByKey.get(key);
  const unchecked = Object.freeze({
    ...approved,
    id: `${approved.id}__unchecked`,
    frame: Object.freeze({ ...approved.frame, x: 2048 }),
  });
  let rejected = false;
  try {
    index.frameByKey.set(key, unchecked);
  } catch (error) {
    rejected = true;
    assert.match(error.message, /read.?only|immutable/i);
  }
  const pose = display.applyPose({ simulationTick: 0, actionTick: 0, locomotion: 'idle', legDirection: 0, torsoDirection: 0, action: 'grenade' });
  assert.equal(pose[3], approved, 'display must retain the frame accepted during indexing');
  assert.equal(rejected, true, 'the validated frame lookup must reject mutation');
});

test('validated clip lookup cannot be replaced before the display consumes animation cadence', () => {
  const metadata = emittedMetadata('lit-commando');
  const index = createProductionHeroAtlasIndex(metadata);
  const display = createProductionHeroDisplay({ index, atlasTexture: { source: { width: 2048, height: 2048 } }, ...displayMocks() });
  const key = 'weapon|grenade|east';
  const approved = index.clipByKey.get(key);
  let rejected = false;
  try {
    index.clipByKey.set(key, Object.freeze({ ...approved, fps: 60 }));
  } catch (error) {
    rejected = true;
    assert.match(error.message, /read.?only|immutable/i);
  }
  const pose = display.applyPose({ simulationTick: 0, actionTick: 4, locomotion: 'idle', legDirection: 0, torsoDirection: 0, action: 'grenade' });
  assert.equal(pose[3].frameIndex, 0, 'display must retain the cadence accepted during indexing');
  assert.equal(rejected, true, 'the validated clip lookup must reject mutation');
});

for (const actorId of ['lit-commando', 'lit-valkyrie', 'lilly', 'lester-original']) {
  const asset = productionHeroAsset(actorId);
  test(`${actorId} binds native authorization to immutable snapshots of canonical metadata`, () => {
    const metadata = emittedMetadata(actorId);
    const weapons = metadata.nativeWeaponIds;
    const actions = metadata.nativeActionIds;
    const index = createProductionHeroAtlasIndex(metadata, asset);
    const display = createProductionHeroDisplay({ index, atlasTexture: { source: { width: 2048, height: 2048 } }, ...displayMocks() });
    const assertRoutes = () => {
      assert.deepEqual(index.nativeWeaponIds, ['coin-blaster']);
      assert.deepEqual(index.nativeActionIds, ['melee', 'grenade']);
      for (const target of [index, display]) {
        assert.equal(target.hasNativeWeapon('coin-blaster'), true);
        assert.equal(target.hasNativeAction('melee'), true);
        assert.equal(target.hasNativeAction('grenade'), true);
        for (const weapon of ['scatter-shotgun', 'hash-rail', 'scatter-gun']) {
          assert.equal(target.hasNativeWeapon(weapon), false, `${weapon} must still require its external overlay`);
        }
        assert.equal(target.hasNativeAction('invented-action'), false);
      }
    };
    assertRoutes();
    weapons.push('scatter-shotgun');
    actions.push('invented-action');
    assertRoutes();
    weapons.splice(0, weapons.length, 'hash-rail');
    actions.splice(0, actions.length, 'invented-action');
    assertRoutes();
    metadata.nativeWeaponIds = ['scatter-shotgun'];
    metadata.nativeActionIds = ['invented-action'];
    assertRoutes();
    for (const field of ['nativeWeaponIds', 'nativeActionIds']) {
      assert.equal(Object.isFrozen(index[field]), true);
      assert.notEqual(index[field], field === 'nativeWeaponIds' ? weapons : actions);
      assert.throws(() => index[field].push('invented'), TypeError);
      assert.throws(() => { index[field][0] = 'invented'; }, TypeError);
      assert.throws(() => { index[field] = ['invented']; }, TypeError);
    }
    assertRoutes();
  });

  for (const coordinate of ['x', 'y']) {
    for (const value of [-1, -0.5, 0.5]) {
      test(`${actorId} rejects packed frame.${coordinate}=${value} before texture construction`, () => {
        const metadata = emittedMetadata(actorId);
        metadata.frames[0].frame[coordinate] = value;
        const constructed = [];
        assert.throws(() => {
          const index = createProductionHeroAtlasIndex(metadata, asset);
          createProductionHeroDisplay({ index, atlasTexture: { source: { width: 2048, height: 2048 } }, ...displayMocks(constructed) });
        }, /rectangle|non-negative integer/i);
        assert.deepEqual(constructed, []);
      });
    }
  }
  for (const [label, mutate] of [
    ['schema downgrade', (m) => { m.schemaVersion = 1; }],
    ['missing schema', (m) => { delete m.schemaVersion; }],
    ['unapproved image', (m) => { m.image = './unapproved.webp'; }],
    ...['nativeWeaponIds', 'nativeActionIds'].flatMap((field) => [
      [`missing ${field}`, (m) => { delete m[field]; }],
      [`null ${field}`, (m) => { m[field] = null; }],
      [`empty ${field}`, (m) => { m[field] = []; }],
      [`sparse ${field}`, (m) => { delete m[field][0]; }],
    ]),
    ['melee-only declaration', (m) => { m.nativeActionIds = ['melee']; }],
    ['grenade-only declaration', (m) => { m.nativeActionIds = ['grenade']; }],
  ]) {
    test(`${actorId} rejects ${label} in cloned emitted metadata`, () => {
      const metadata = structuredClone(emittedMetadata(actorId));
      mutate(metadata);
      assert.throws(() => createProductionHeroAtlasIndex(metadata, asset), /schemaVersion|native|image/i);
    });
  }

  test(`${actorId} accepts its actual release cells and 2048 atlas without changing reference density`, () => {
    const metadata = emittedMetadata(actorId);
    const released = metadata.frames.filter((frame) => frame.visibility === 'source-prop-released');
    assert.equal(released.length, actorId === 'lit-commando' ? 0 : 16);
    if (released.length) {
      assert.deepEqual(released.map((f) => `${f.direction}|${f.frameIndex}`).sort(), DIRECTIONS.flatMap((d) => [`${d}|3`, `${d}|4`]).sort());
    }
    const index = createProductionHeroAtlasIndex(metadata, asset);
    const display = createProductionHeroDisplay({ index, atlasTexture: { source: { width: 2048, height: 2048 } }, ...displayMocks() });
    const frames = display.applyPose({ simulationTick: 30, actionTick: 30, locomotion: 'idle', legDirection: 0, torsoDirection: 6, action: 'grenade' });
    for (const [i, sprite] of display.container.children.entries()) {
      const frame = frames[i];
      assert.equal(sprite.scale.x, 160 / frame.sourceSize.h);
      assert.equal(sprite.texture.orig.width, frame.orig.w);
      assert.equal(sprite.texture.orig.height, frame.orig.h);
      assert.equal(sprite.texture.trim.x, frame.trim.x);
      assert.equal(sprite.texture.trim.y, frame.trim.y);
      assert.equal(sprite.texture.frame.width, frame.frame.w);
      assert.equal(sprite.texture.frame.height, frame.frame.h);
    }
  });

  if (actorId !== 'lit-commando') {
    for (const removedCount of [1, 16]) {
      test(`${actorId} rejects ${removedCount} missing authored release exemptions`, () => {
        const metadata = structuredClone(emittedMetadata(actorId));
        const released = metadata.frames.filter((f) => f.visibility === 'source-prop-released');
        assert.equal(released.length, 16);
        // Replace with real visible earlier samples, preserving slot identity. Merely
        // deleting visibility would hit the existing zero-opaque guard, not the count gap.
        for (const frame of released.slice(0, removedCount)) {
          const visible = metadata.frames.find((f) => f.layer === 'weapon' && f.state === 'grenade' && f.direction === frame.direction && f.frameIndex === 2);
          const { id, frameIndex } = frame;
          delete frame.visibility;
          Object.assign(frame, structuredClone(visible), { id, frameIndex });
        }
        assert.throws(() => createProductionHeroAtlasIndex(metadata, asset), /released|visibility/i);
      });
    }
    test(`${actorId} rejects release exemptions moved to earlier grenade samples`, () => {
      const metadata = structuredClone(emittedMetadata(actorId));
      const late = metadata.frames.find((f) => f.visibility === 'source-prop-released');
      const early = metadata.frames.find((f) => f.layer === 'weapon' && f.state === 'grenade' && f.direction === late.direction && f.frameIndex === 2);
      [late.frameIndex, early.frameIndex] = [early.frameIndex, late.frameIndex];
      assert.throws(() => createProductionHeroAtlasIndex(metadata, asset), /released|visibility/i);
    });
  }

  for (const layer of ['lower-body', 'torso-head']) {
    test(`${actorId} rejects a blank ${layer} rather than granting a release exemption`, () => {
      const metadata = structuredClone(emittedMetadata(actorId));
      metadata.frames.find((f) => f.layer === layer).opaquePixels = 0;
      assert.throws(() => createProductionHeroAtlasIndex(metadata, asset), /opaque|visibility/i);
    });
  }
}

test('Commando rejects all sixteen real Valkyrie release exemptions assigned to its grenade cells', () => {
  const metadata = structuredClone(emittedMetadata('lit-commando'));
  const released = emittedMetadata('lit-valkyrie').frames.filter((f) => f.visibility === 'source-prop-released');
  assert.equal(released.length, 16);
  for (const source of released) {
    const target = metadata.frames.find((f) => f.layer === source.layer && f.state === source.state && f.direction === source.direction && f.frameIndex === source.frameIndex);
    Object.assign(target, structuredClone(source), { id: target.id });
  }
  assert.throws(() => createProductionHeroAtlasIndex(metadata), /released|visibility/i);
});

for (const [label, source] of [
  ['missing dimensions', {}],
  ['undefined width', { width: undefined, height: 2048 }],
  ['undefined height', { width: 2048, height: undefined }],
  ['NaN width', { width: NaN, height: 2048 }],
  ['NaN height', { width: 2048, height: NaN }],
  ['infinite width', { width: Infinity, height: 2048 }],
  ['infinite height', { width: 2048, height: Infinity }],
  ['zero square', { width: 0, height: 0 }],
  ['negative square', { width: -2048, height: -2048 }],
  ['fractional square', { width: 2047.5, height: 2047.5 }],
  ['numeric strings', { width: '2048', height: '2048' }],
  ['non-square width', { width: 2047, height: 2048 }],
  ['non-square height', { width: 2048, height: 2047 }],
  ['oversized width', { width: 4096, height: 2048 }],
  ['oversized height', { width: 2048, height: 4096 }],
  ['oversized square', { width: 2049, height: 2049 }],
]) {
  test(`base atlas rejects ${label} before constructing any display objects`, () => {
    const metadata = structuredClone(emittedMetadata('lit-commando'));
    // Keep real per-frame logical/physical geometry, but put crops at the origin
    // so the non-square/fractional cases cannot fail by accidental packing overflow.
    for (const frame of metadata.frames) Object.assign(frame.frame, { x: 0, y: 0 });
    const index = createProductionHeroAtlasIndex(metadata);
    const constructed = [];
    assert.throws(() => createProductionHeroDisplay({ index, atlasTexture: { source }, ...displayMocks(constructed) }), /atlas.*dimension/i);
    assert.deepEqual(constructed, [], 'invalid base atlas must not allocate containers, sprites or textures');
  });
}

test('runtime makes native hero equipment and the external overlay mutually exclusive', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /productionHeroDisplay\.hasNativeWeapon\(activeWeaponId\)/);
  assert.match(source, /productionHeroDisplay\.hasNativeAction\(productionAction\)/);
  assert.match(source, /setLayerVisible\('weapon', productionAction !== 'interact' && !externalWeaponAuthoritative\)/);
  assert.match(source, /authoredHeldWeaponDisplay\.container\.visible = externalWeaponAuthoritative/);
  assert.match(source, /ensureProductionHeroAtlas\(sessionHeroSelection\.actorId\)/, 'selected hero must remain session-lazy');
  assert.match(source, /\.catch\(\(error\) => \{[\s\S]*productionHeroLoadError/, 'corrupt or missing art must retain the gameplay fallback');
});

test('dash renders moving legs facing the dash direction rather than stale pre-dash facing', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /const dashing = actor\.locomotion === 'dash'/);
  assert.match(source, /locomotion: dashing \? 'moving' : motion\.locomotion/);
  assert.match(source, /legDirection: dashing && lastDashDirection \? quantizeDirection\(lastDashDirection, 8\)/);
});
