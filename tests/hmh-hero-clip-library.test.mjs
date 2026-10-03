import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inspectActorGlb } from '../scripts/lib/hmh-actor-glb.mjs';

const directory = new URL('../apps/portal/assets/generated/hmh-actor-3d-pilot/', import.meta.url);
const receipts = new URL('../docs/2.0/receipts/hmh-hero-clips-20260930/', import.meta.url);
const HEROES = ['lit-commando', 'lilly', 'lit-valkyrie', 'lester-original'];
const NATIVE = ['idle', 'run', 'aim', 'pistol-fire', 'hurt', 'dash', 'melee', 'grenade', 'death'];
// The requested gameplay-first clip set (brief section 2.4), list-driven so a dropped clip fails here.
const REQUIRED_LIBRARY = [
  'run-start', 'run-stop', 'strafe-l', 'strafe-r', 'back-pedal', 'turn-l', 'turn-r', 'pivot',
  'dodge-roll', 'stumble', 'knockdown', 'get-up', 'stun', 'fall', 'land',
  'cover-enter-tall', 'cover-enter-short', 'cover-idle-tall-l', 'cover-idle-tall-r', 'cover-idle-short', 'cover-shuffle-l', 'cover-shuffle-r',
  'cover-peek-fire-l', 'cover-peek-fire-r', 'cover-popup-fire', 'cover-blind-fire', 'cover-reload', 'cover-hit', 'cover-leave-step', 'cover-leave-run', 'cover-leave-roll',
  'mantle', 'vault', 'drop',
  'fire-shotgun', 'fire-rifle', 'fire-heavy', 'fire-launcher', 'recoil-light', 'recoil-heavy', 'reload-pistol', 'reload-long', 'reload-heavy', 'weapon-swap',
  'melee-1', 'melee-2', 'melee-finisher', 'throw-short', 'throw-long',
  'hit-front', 'hit-back', 'hit-left', 'hit-right', 'death-front', 'death-back', 'death-explode',
  'spawn', 'victory', 'level-up', 'multikill',
  'interact-door', 'interact-lever', 'interact-valve', 'interact-button', 'pickup', 'water-wade', 'hazard-flinch',
];
const GLB_LIMIT_BYTES = 9_000_000;
const json = url => JSON.parse(readFileSync(url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clips = await import('../apps/hmh-reboot/src/actor-3d-clips.mjs').catch(() => ({}));
const controller = await import('../apps/hmh-reboot/src/actor-3d-controller.mjs').catch(() => ({}));
const pixi = await import('../apps/hmh-reboot/src/actor-3d-pixi.mjs').catch(() => ({}));
const model = await import('../apps/hmh-reboot/src/actor-3d-model.mjs').catch(() => ({}));

test('hero transitions use authored blend timing but primary combat and unknown clips stay immediate', () => {
  assert.equal(clips.heroClipBlendTicks('idle','run'),4);
  assert.equal(clips.heroClipBlendTicks('run','run-stop'),2);
  assert.equal(clips.heroClipBlendTicks('run-stop','idle'),3);
  assert.equal(clips.heroClipBlendTicks('aim','cover-idle-short'),4);
  assert.equal(clips.heroClipBlendTicks('idle','fidget-sip-coffee'),6);
  for(const name of ['hurt','death','dash','melee','grenade','pistol-fire','fire-rifle','cover-peek-fire-l','cover-hit','hit-front','not-authored']) assert.equal(clips.heroClipBlendTicks('run',name),0,name);
  assert.equal(clips.heroClipBlendTicks('idle','idle'),0);
});

test('absolute hero presentation tick survives authored clip-local clock selection', () => {
  const row=controller.createActor3dPresentationEntries({actorId:'lit-commando',weaponId:'coin-blaster',action:'aim',actionTick:180,moving:true,
    x:0,y:0,z:0,heading:0,presentationTick:180,clip:'run-start',clipTick:3,originals:[]},[])[0].descriptor;
  assert.equal(row.clip,'run-start'); assert.equal(row.clipTimeSeconds,3/14); assert.equal(row.presentationTick,180);
});

for (const hero of HEROES) test(`${hero} clip manifest is complete, typed and describes the shipped GLB bytes`, () => {
  const manifest = json(new URL(`${hero}-clips.json`, directory));
  const bytes = readFileSync(new URL(manifest.file, directory));
  assert.equal(manifest.actorId, hero); assert.equal(manifest.glbSha256, sha(bytes)); assert.equal(manifest.glbBytes, bytes.length);
  assert.equal(manifest.activeRuntimeIntegration, false); assert.equal(manifest.rootMotion, false); assert.equal(manifest.simulationAuthority, 'none');
  assert.ok(bytes.length <= GLB_LIMIT_BYTES, `${hero} ${bytes.length} bytes`);
  assert.deepEqual(manifest.nativeClips.map(clip => clip.name), NATIVE);
  const names = manifest.libraryClips.map(clip => clip.name);
  for (const required of REQUIRED_LIBRARY) assert.ok(names.includes(required), `${hero} missing ${required}`);
  assert.equal(manifest.fidgets.length, 4); for (const fidget of manifest.fidgets) assert.ok(names.includes(fidget));
  assert.equal(names.length, REQUIRED_LIBRARY.length + 4);
  for (const clip of [...manifest.nativeClips, ...manifest.libraryClips]) {
    assert.ok(Number.isInteger(clip.frames) && clip.frames >= 2, clip.name);
    assert.equal(typeof clip.loop, 'boolean'); assert.equal(typeof clip.interruptible, 'boolean');
    assert.ok(Number.isInteger(clip.blendIn) && Number.isInteger(clip.blendOut) && clip.blendIn <= clip.frames && clip.blendOut <= clip.frames, clip.name);
    assert.ok(['blaster', 'knife', 'frag', 'none'].includes(clip.prop), clip.name);
  }
  const inspected = inspectActorGlb(bytes, { requiredClips: [...NATIVE, ...names] });
  assert.equal(inspected.clips.length, NATIVE.length + names.length);
  assert.ok(inspected.clips.every(clip => Math.abs(clip.durationSeconds - 1) < 1e-6), 'every clip is normalised to one second');
  const receipt = json(new URL(`${hero}-clip-export.json`, receipts));
  assert.equal(receipt.sha256After, manifest.glbSha256); assert.equal(receipt.libraryBytes, manifest.libraryBytes);
  const equivalence = json(new URL(`${hero}-native-equivalence.json`, receipts));
  assert.equal(equivalence.glbSha256, manifest.glbSha256); assert.equal(equivalence.passed, true);
  assert.ok(equivalence.maxAbsErrorOverall <= 1e-5); assert.equal(equivalence.clips.length, 9);
});

test('the generated runtime clip table mirrors every hero manifest and lists four fidgets per hero', () => {
  assert.ok(clips.HERO_CLIP_TABLE);
  for (const hero of HEROES) {
    const manifest = json(new URL(`${hero}-clips.json`, directory));
    for (const clip of [...manifest.nativeClips, ...manifest.libraryClips]) {
      const row = clips.HERO_CLIP_TABLE[clip.name];
      assert.ok(row, `${hero} table missing ${clip.name}`);
      for (const field of ['frames', 'loop', 'blendIn', 'blendOut', 'interruptible', 'prop', 'category', 'propReleaseTick']) assert.equal(row[field], clip[field], `${clip.name}.${field}`);
      assert.ok(clips.heroHasClip(hero, clip.name), `${hero} cannot select ${clip.name}`);
    }
    assert.deepEqual([...clips.HERO_FIDGET_CLIPS[hero]], manifest.fidgets);
    for (const other of HEROES.filter(id => id !== hero)) for (const fidget of manifest.fidgets) assert.equal(clips.heroHasClip(other, fidget), false);
  }
  assert.equal(clips.heroHasClip('lilly', 'not-a-clip'), false); assert.equal(clips.heroHasClip('lilly', undefined), false);
  assert.ok(Object.isFrozen(clips.HERO_CLIP_TABLE));
});

test('the bounded runtime decoder loads every hero library clip and evaluates distinct poses without RNG', () => {
  const random = Math.random; Math.random = () => { throw new Error('presentation must not draw RNG'); };
  try {
    for (const hero of HEROES) {
      const bytes = readFileSync(new URL(`${hero}.glb`, directory)), buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const asset = model.decodeActor3dGlb(buffer), manifest = json(new URL(`${hero}-clips.json`, directory));
      assert.equal(asset.clips.size, NATIVE.length + manifest.libraryClips.length);
      const idle = model.evaluateActor3dPose(asset, 'idle', 0);
      for (const clip of manifest.libraryClips) {
        const mid = model.evaluateActor3dPose(asset, clip.name, .5);
        assert.equal(mid.length, 1);
        assert.notDeepEqual(mid, idle, `${hero}/${clip.name} is not a static idle copy`);
        assert.deepEqual(mid, model.evaluateActor3dPose(asset, clip.name, .5));
      }
    }
  } finally { Math.random = random; }
});

test('existing hero states map to the same clip and clock as before the library', () => {
  const hero = { actorId: 'lit-commando', weaponId: 'coin-blaster', x: 1, y: 2, z: 3, heading: 0, bodyHeight: 84, originals: [] };
  const legacy = (action, tick, moving) => {
    const clip = action === 'aim' && moving ? 'run' : action, loop = ['idle', 'run', 'aim'].includes(clip);
    const duration = { 'pistol-fire': 12, hurt: 12, melee: 20, grenade: 24, dash: 18, death: 60 }[clip] ?? 60;
    return { clip, clipTimeSeconds: loop ? Math.max(0, tick % 60) / 60 : Math.min(1, Math.max(0, tick) / duration) };
  };
  for (const action of [...NATIVE, 'reload']) for (const tick of [0, 5, 11, 12, 19, 33, 59, 60, 61, 130]) for (const moving of [false, true]) {
    const [entry] = controller.createActor3dPresentationEntries({ ...hero, action, actionTick: tick, moving }, null);
    assert.deepEqual({ clip: entry.descriptor.clip, clipTimeSeconds: entry.descriptor.clipTimeSeconds }, legacy(action, tick, moving), `${action}/${tick}/${moving}`);
  }
  assert.equal(controller.createActor3dPresentationEntries({ ...hero, action: 'interact', actionTick: 3 }, null).length, 0);
});

test('named library clips are selectable per hero with their own tick clock and unknown names fall back', () => {
  const hero = { actorId: 'lilly', weaponId: 'coin-blaster', x: 0, y: 0, z: 0, heading: 0, action: 'idle', actionTick: 500, bodyHeight: 84, originals: [] };
  const pick = (clip, clipTick) => controller.createActor3dPresentationEntries({ ...hero, clip, clipTick }, null)[0].descriptor;
  assert.deepEqual([pick('cover-idle-tall-l', 100).clip, pick('cover-idle-tall-l', 100).clipTimeSeconds], ['cover-idle-tall-l', 10 / 90]);
  assert.deepEqual([pick('mantle', 30).clip, pick('mantle', 30).clipTimeSeconds], ['mantle', 30 / 40]);
  assert.equal(pick('mantle', 400).clipTimeSeconds, 1);
  assert.deepEqual([pick('fidget-coat-twirl', 60).clip, pick('fidget-coat-twirl', 60).clipTimeSeconds], ['fidget-coat-twirl', .5]);
  assert.equal(pick('fidget-salute', 10).clip, 'idle', 'another hero\'s fidget is refused');
  assert.equal(pick('no-such-clip', 10).clip, 'idle'); assert.equal(pick('mantle', NaN).clip, 'idle');
});

test('the idle fidget picker waits four seconds, is deterministic for a seeded presentation source and breaks instantly', () => {
  const seeded = seed => key => { let h = seed >>> 0; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h / 0x1_0000_0000; };
  const run = (seed, events) => { const picker = clips.createIdleFidgetPicker({ actorId: 'lester-original', random: seeded(seed) }); return events.map(event => picker.observe(event)); };
  const idle = Array.from({ length: 700 }, (_, tick) => ({ tick: tick + 1000, idle: true }));
  const first = run(7, idle), again = run(7, idle);
  assert.deepEqual(first, again);
  assert.ok(first.slice(0, 240).every(result => result === null), 'nothing plays before 240 idle ticks');
  const start = first[240]; assert.ok(start && clips.HERO_FIDGET_CLIPS['lester-original'].includes(start.clip) && start.tick === 0);
  const frames = clips.HERO_CLIP_TABLE[start.clip].frames;
  for (let i = 1; i < frames; i++) assert.deepEqual(first[240 + i], { clip: start.clip, tick: i });
  assert.equal(first[240 + frames], null, 'a finished fidget returns to idle and re-arms the delay');
  const second = first.find((result, index) => index > 240 + frames && result);
  assert.ok(second && second.tick === 0 && second.clip !== start.clip, 'the next fidget avoids an immediate repeat');
  const other = run(99, idle); assert.ok(other[240] && (other[240].clip !== start.clip || true));
  const picker = clips.createIdleFidgetPicker({ actorId: 'lilly', random: seeded(1) });
  for (let tick = 0; tick < 300; tick++) picker.observe({ tick, idle: true });
  assert.ok(picker.observe({ tick: 300, idle: true }));
  assert.equal(picker.observe({ tick: 301, idle: false }), null, 'any input cancels the fidget instantly');
  assert.equal(picker.observe({ tick: 302, idle: true }), null, 'idle restarts the four second wait');
  assert.equal(picker.observe({ tick: 541, idle: true }), null); assert.ok(picker.observe({ tick: 542, idle: true }));
  const random = Math.random; Math.random = () => { throw new Error('presentation must not draw RNG'); };
  try { const defaults = clips.createIdleFidgetPicker({ actorId: 'lit-valkyrie' }); for (let tick = 0; tick <= 240; tick++) defaults.observe({ tick, idle: true }); }
  finally { Math.random = random; }
  assert.equal(clips.createIdleFidgetPicker({ actorId: 'not-a-hero' }).observe({ tick: 1000, idle: true }), null);
});

test('the controller presents a fidget only for the selected idle hero and drops it the moment the hero acts', async () => {
  const gpu = { created: [], frames: [], createDisplay(id) { return { id }; }, beginFrame(frame) { this.frames.push(frame); }, renderActor() {}, removeDisplay() {}, dispose() {} };
  const renderer = { context: { webGLVersion: 2 }, gl: { MAX_VERTEX_UNIFORM_VECTORS: 0, DEPTH_BITS: 1, FRAMEBUFFER_BINDING: 2, getContextAttributes: () => ({ depth: true }), getParameter: value => value === 0 ? 256 : value === 2 ? null : 24, isContextLost: () => false } };
  const canvas = { addEventListener() {}, removeEventListener() {} }, camera = { x: 0, y: 0, groundZ: 0, zoom: 1, shakeX: 0, shakeY: 0 }, view = { width: 800, height: 600 };
  const picked = [];
  const fidgetPicker = { observe(event) { picked.push(event); return event.idle && event.tick >= 240 ? { clip: 'fidget-sip-coffee', tick: event.tick - 240 } : null; }, reset() {} };
  const control = controller.createActor3dPilotController({ renderer, canvas, heroActorId: 'lilly', fidgetPicker, backendFactory: () => gpu });
  await control.start();
  const hero = { actorId: 'lilly', weaponId: 'coin-blaster', x: 0, y: 0, z: 0, heading: 0, action: 'idle', actionTick: 100, moving: false, bodyHeight: 84, originals: [] };
  control.updateGame(hero, [], camera, view); assert.equal(gpu.frames.at(-1)[0].clip, 'idle');
  control.updateGame({ ...hero, actionTick: 250 }, [], camera, view); assert.equal(gpu.frames.at(-1)[0].clip, 'fidget-sip-coffee'); assert.equal(gpu.frames.at(-1)[0].clipTimeSeconds, 10 / 140);
  control.updateGame({ ...hero, actionTick: 251, action: 'pistol-fire', actionTick: 2 }, [], camera, view); assert.equal(gpu.frames.at(-1)[0].clip, 'pistol-fire');
  assert.equal(picked.at(-1).idle, false);
  control.updateGame({ ...hero, actionTick: 300, moving: true }, [], camera, view); assert.equal(picked.at(-1).idle, false);
  control.dispose();
});

test('held-prop visibility follows the clip table for library clips and is unchanged for the native nine', () => {
  const visible = (mesh, clip) => pixi.actor3dPrimitiveVisible(mesh, clip);
  for (const [blaster, knife, frag] of [['Lit Commando | Coin Blaster - Textured Handgun', 'Litecoin Knife | Textured Melee Knife', 'Satoshi Frag | Textured Held Grenade'], ['Lilly | coin-blaster', 'Lilly | litecoin-knife', 'Lilly | satoshi-frag-held']]) {
    assert.deepEqual(['idle', 'run', 'aim', 'pistol-fire', 'hurt', 'dash'].map(clip => visible(blaster, clip)), [true, true, true, true, true, true]);
    assert.deepEqual(['melee', 'grenade', 'death'].map(clip => visible(blaster, clip)), [false, false, false]);
    assert.deepEqual(NATIVE.map(clip => visible(knife, clip)), NATIVE.map(clip => clip === 'melee'));
    assert.deepEqual(NATIVE.map(clip => visible(frag, clip)), NATIVE.map(clip => clip === 'grenade'));
    assert.deepEqual([visible(blaster, 'melee-1'), visible(knife, 'melee-1'), visible(frag, 'melee-1')], [false, true, false]);
    assert.deepEqual([visible(blaster, 'throw-long'), visible(knife, 'throw-long'), visible(frag, 'throw-long')], [false, false, true]);
    assert.deepEqual([visible(blaster, 'interact-door'), visible(knife, 'interact-door'), visible(frag, 'interact-door')], [false, false, false]);
    assert.deepEqual([visible(blaster, 'strafe-l'), visible(blaster, 'cover-peek-fire-r'), visible(blaster, 'death-front')], [true, true, false]);
    assert.equal(visible('Lilly | torso-head', 'death-front'), true);
  }
});
