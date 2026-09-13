import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createProductionHeroAtlasIndex, createProductionHeroDisplay, resolveProductionHeroPose, productionHeroAsset, measureProductionHeroBodyHeight } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';
import { HERO_MOTION_CLIPS, createHeroMotionIndex, createHeroMotionAnimator } from '../apps/hmh-reboot/src/hero-motion-atlas.mjs';

const original = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json', import.meta.url)));
const directions = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
function fixture() {
  const frames = [];
  for (const [layer, states] of Object.entries(HERO_MOTION_CLIPS)) {
    for (const [state, clip] of Object.entries(states)) for (const direction of directions) {
      for (let frameIndex = 0; frameIndex < clip.frames; frameIndex += 1) frames.push({
        id: `lit-commando__${layer}__${state}__${direction}__${String(frameIndex).padStart(3, '0')}`,
        layer, state, direction, frameIndex, fps: clip.fps, loop: clip.loop !== false,
        frame: { x: 0, y: 0, w: 10, h: 10 }, orig: { w: 10, h: 10 }, trim: { x: 0, y: 0, w: 10, h: 10 },
        sourceSize: { w: 256, h: 256 }, spriteSourceSize: { x: 123, y: 200, w: 10, h: 10 },
        sourcePivot: { x: 128, y: 205 }, pivot: { x: 5, y: 5 }, anchor: { x: .5, y: .5 }, opaquePixels: 80,
      });
    }
  }
  return { motionSchema: 1, actorId: original.actorId, variantId: original.variantId, runtimeAuthority: 'projection-only',
    image: './lit-commando-motion.webp', imageBytes: 100000, baseImageBytes: 3919100,
    sourceSha256: '1'.repeat(64), imageSha256: '2'.repeat(64), dimensions: { width: 1024, height: 1024 }, frames };
}

test('native motion doubles running samples without changing the half-second gait period', () => {
  const base = createProductionHeroAtlasIndex(original);
  const index = createHeroMotionIndex(base, fixture());
  const poses = new Set();
  for (let tick = 0; tick < 30; tick += 1) {
    const frames = resolveProductionHeroPose(index, { simulationTick: tick, locomotion: 'moving', legDirection: 0, torsoDirection: 0 });
    poses.add(frames[1].frameIndex);
    assert.equal(frames[1].motionPage, true);
    assert.equal(frames[0].motionPage, undefined);
  }
  assert.equal(poses.size, 12);
  assert.equal(resolveProductionHeroPose(index, { simulationTick: 30, locomotion: 'moving', legDirection: 0, torsoDirection: 0 })[1].frameIndex, 0);
  assert.equal(base.frameByKey.size, 648, 'base source index stays unchanged');
  assert.throws(() => index.frameByKey.set('bad', {}));
});

test('motion metadata rejects missing poses, another hero, oversized textures and broken pivots', () => {
  for (const mutate of [m => m.frames.pop(), m => { m.actorId = 'lilly'; }, m => { m.dimensions.width = 4096; }, m => { m.frames[0].pivot.x = 9; }, m => { m.frames[0].frame.x = 1020; }, m => { m.imageBytes = 9 * 1024 * 1024; }]) {
    const data = fixture(); mutate(data);
    assert.throws(() => createHeroMotionIndex(createProductionHeroAtlasIndex(original), data));
  }
});

test('reload gesture follows authoritative progress and yields immediately to firing or damage', () => {
  const animate = createHeroMotionAnimator();
  const state = { action: 'aim', simulationTick: 10, actionTick: 0, locomotion: 'idle', reloadProgress: .5 };
  assert.equal(animate(state).action, 'reload');
  assert.equal(animate(state).actionTick, 13);
  assert.equal(animate({ ...state, action: 'hurt' }).action, 'hurt');
  assert.equal(animate({ ...state, action: 'pistol-fire' }).action, 'pistol-fire');
  assert.equal(animate({ ...state, reloadProgress: 1 }).action, 'aim');
  assert.deepEqual(state, { action: 'aim', simulationTick: 10, actionTick: 0, locomotion: 'idle', reloadProgress: .5 });
});

test('idle personality starts after a quiet pause, stops on movement and respects reduced motion', () => {
  const animate = createHeroMotionAnimator();
  const state = { action: 'aim', actionTick: 0, locomotion: 'idle', idleAllowed: true, reloadProgress: 0 };
  assert.equal(animate({ ...state, simulationTick: 0 }).action, 'aim');
  assert.equal(animate({ ...state, simulationTick: 180 }).action, 'idle-check');
  assert.equal(animate({ ...state, simulationTick: 185, locomotion: 'moving' }).action, 'aim');
  assert.equal(animate({ ...state, simulationTick: 400, reduceMotion: true }).action, 'aim');
  assert.equal(animate({ ...state, simulationTick: 1 }).action, 'aim', 'restart clears the old presentation clock');
});

test('a late motion page upgrades the hero and updates camera framing for the new living poses', () => {
  const point = () => ({ x: 0, y: 0, set(x, y=x) { this.x=x; this.y=y; } });
  class Container { children=[]; scale=point(); addChild(child) { this.children.push(child); } }
  class Sprite { anchor=point(); scale=point(); constructor({ texture }) { this.texture=texture; } }
  class Texture { constructor(options) { Object.assign(this, options); } }
  class Rectangle { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}); } }
  const index = createProductionHeroAtlasIndex(original);
  const baseSource = { width: 2048, height: 2048 };
  const motionSource = { width: 1024, height: 1024 };
  const display = createProductionHeroDisplay({ index, atlasTexture: { source: baseSource },
    ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle });
  const size = display.minimumBodyHeight;
  const state = { simulationTick: 18, actionTick: 18, locomotion: 'moving', legDirection: 0, torsoDirection: 0, action: 'aim' };
  assert.ok(display.applyPose(state).every(frame => !frame.motionPage));
  const enhanced = createHeroMotionIndex(index, fixture());
  assert.throws(() => display.attachMotionPage({ index: enhanced, motionTexture: { source: { width: 4096, height: 4096 } } }), /dimensions/);
  assert.ok(display.applyPose(state).every(frame => !frame.motionPage), 'invalid pages leave the base display usable');
  display.attachMotionPage({ index: enhanced, motionTexture: { source: motionSource } });
  assert.equal(display.applyPose(state)[1].frameIndex, 7);
  assert.ok(Math.abs(display.minimumBodyHeight - measureProductionHeroBodyHeight(enhanced)) < 1e-10);
  assert.notEqual(display.minimumBodyHeight, size, 'camera sizing includes the additional poses');
  assert.equal(display.container.children[0].texture.source, baseSource, 'shadow keeps the base page');
  assert.equal(display.container.children[1].texture.source, motionSource, 'running uses the new page');
  assert.throws(() => display.attachMotionPage({ index: enhanced, motionTexture: { source: motionSource } }), /base/);
});

for (const actor of ['lit-commando','lit-valkyrie','lester-original','lilly']) {
  test(`${actor} ships a complete verified motion page with unchanged base action coverage`, () => {
    const root=new URL(`../apps/portal/assets/generated/hmh-hero-motion/${actor}/`,import.meta.url);
    const metadata=JSON.parse(readFileSync(new URL(`${actor}-motion.json`,root)));
    const bytes=readFileSync(new URL(`${actor}-motion.webp`,root));
    assert.equal(bytes.length,metadata.imageBytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),metadata.imageSha256);
    const baseRoot=new URL(`../apps/portal/assets/generated/hmh-reboot-production-heroes/${actor}/`,import.meta.url);
    const baseMetadata=JSON.parse(readFileSync(new URL(`${actor}-production-pilot-atlas.json`,baseRoot)));
    assert.equal(readFileSync(new URL(`${actor}-production-pilot-atlas.webp`,baseRoot)).length,metadata.baseImageBytes);
    const base=createProductionHeroAtlasIndex(baseMetadata,productionHeroAsset(actor));
    const enhanced=createHeroMotionIndex(base,metadata);
    for (const direction of directions) {
      const run=enhanced.clipByKey.get(`lower-body|run|${direction}`);
      assert.equal(run.frameCount,12); assert.equal(run.fps,24);
    }
    for (const action of ['death','dash','melee','grenade','pistol-fire','hurt']) {
      for (let tick=0;tick<60;tick+=1) {
        const state={simulationTick:tick,actionTick:tick,action,locomotion:'moving',legDirection:2,torsoDirection:3};
        const before=resolveProductionHeroPose(base,state);
        const after=resolveProductionHeroPose(enhanced,state);
        for (const frame of before.filter(frame=>frame.layer==='torso-head'))
          assert.equal(after.find(value=>value.layer===frame.layer).id,frame.id,`${action} keeps its native action timing`);
      }
    }
  });
}
