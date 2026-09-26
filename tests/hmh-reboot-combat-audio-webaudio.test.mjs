// The child's SFX engine runs on Web Audio (perf step 5/8).
//
// The defect: every cue constructed a new HTMLAudioElement(url). Each one was
// a fresh media element, a cache revalidation (production assets are
// max-age=0) and a decoder spin-up on the main thread, 16 voices deep in a
// crowded fight. On iOS the element's `volume` is read-only, so the SFX and UI
// sliders did nothing on the owner's iPhone. The engine now decodes each
// sample once into an AudioBuffer after the first gesture and plays cues as
// buffer sources through per-category gain buses.
//
// Owner decision (2026-09-25): no footstep sounds and no voice lines.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { BOSS_DUCK_MUL, createCombatAudio } from '../apps/hmh-reboot/src/combat-audio.mjs';
import { HMH_WEAPON_SFX } from '../apps/hmh-reboot/src/weapon-audio.mjs';
import {
  FakeAudioContext,
  FakeEventTarget,
  FakeMusic,
  effectiveGain,
  fakeSampleFetch,
  resetFakeAudio,
  startedSources,
} from './helpers/fake-web-audio.mjs';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function engine(options = {}, fetchOptions = {}) {
  resetFakeAudio({ autoplay: options.autoplay ?? false });
  const loader = fakeSampleFetch(fetchOptions);
  const gestureTarget = new FakeEventTarget();
  const visibilityTarget = new FakeEventTarget({ visibilityState: 'visible' });
  const audio = createCombatAudio({
    AudioCtor: FakeMusic,
    AudioContextCtor: FakeAudioContext,
    fetchSample: loader.fetchSample,
    gestureTarget,
    visibilityTarget,
    ...options,
  });
  return { audio, loader, gestureTarget, visibilityTarget, context: () => FakeAudioContext.instances.at(-1) };
}

test('no SFX cue constructs an HTMLAudioElement; cues play as buffer sources', async () => {
  const { audio } = engine();
  await audio.unlock();
  let now = 0;
  for (const cue of ['hmh-fire-coin-blaster', 'enemy-hit', 'enemy-death', 'player-hit', 'grenade-boom', 'pickup']) {
    now += 1_000;
    assert.equal(audio.play(cue, { now, volume: 0.12 }).played, true, cue);
  }
  assert.equal(FakeMusic.instances.length, 0, 'an embedded child owns no media element at all');
  assert.equal(startedSources().length, 6);
  assert.equal(FakeAudioContext.instances.length, 1, 'one context for the whole run');
  const source = readFileSync(new URL('../apps/hmh-reboot/src/combat-audio.mjs', import.meta.url), 'utf8');
  assert.equal(source.match(/new AudioCtor\(/g)?.length, 1, 'the only media element left is standalone music');
  assert.match(source, /new AudioCtor\(MUSIC_PATH\)/);
});

test('nothing is fetched or decoded before the first gesture, then each sample exactly once', async () => {
  const { audio, loader, gestureTarget, context } = engine({ gameplayOnly: true });
  assert.equal(FakeAudioContext.instances.length, 0, 'no context before a gesture');
  assert.deepEqual(audio.play('enemy-hit', { now: 10 }), { played: false, reason: 'locked' });
  assert.equal(loader.requests.length, 0);

  gestureTarget.dispatch('pointerup');
  const ctx = context();
  assert.ok(ctx, 'the gesture creates the context');
  assert.equal(ctx.resumeCalls, 1, 'resume() is called synchronously inside the gesture (iOS)');
  assert.equal(ctx.primingBuffers, 1, 'a silent buffer is started inside the gesture to open iOS output');
  await audio.unlock();
  const unique = new Set(loader.requests);
  assert.equal(unique.size, loader.requests.length, 'no sample is fetched twice');
  assert.deepEqual([...unique].sort(), [...new Set(ctx.decoded)].sort());
  assert.ok(unique.has('../assets/audio/sfx/hmh-fire-coin-blaster.wav'));
  for (const retired of ['../assets/audio/sfx/hmh-dash.wav', '../assets/audio/sfx/land.ogg', '../assets/audio/sfx/hmh-upgrade-offer.wav']) {
    assert.equal(unique.has(retired), false, `${retired} can never play in gameplay mode and must not be fetched`);
  }

  for (let index = 0; index < 12; index += 1) audio.play('hmh-fire-auto-miner', { now: 1_000 + index * 100, volume: 0.21 });
  assert.equal(loader.requests.length, unique.size, 'repeat cues reuse the decoded buffer');
  assert.equal(startedSources().length, 12);
  const buffers = new Set(startedSources().map((source) => source.buffer));
  assert.equal(buffers.size, 1, 'every auto-miner shot shares one AudioBuffer');
});

test('owner decision: footsteps are retired in every mode and never fetched', async () => {
  for (const gameplayOnly of [true, false]) {
    const { audio, loader } = engine({ gameplayOnly });
    await audio.unlock();
    for (const cue of ['footstep-dirt', 'footstep-road']) {
      assert.deepEqual(audio.play(cue, { now: 5_000 }), { played: false, reason: 'cue-retired' }, `${cue} gameplayOnly=${gameplayOnly}`);
    }
    assert.equal(loader.requests.some((path) => /footstep/.test(path)), false);
    assert.equal(audio.status().unknownCues, 0, 'a retired cue is not a registry refusal');
    assert.equal(startedSources().length, 0);
  }
  const source = readFileSync(new URL('../apps/hmh-reboot/src/combat-audio.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /hmh-footstep-(dirt|road)\.wav/, 'no playback path references the footstep samples');
  const life = readFileSync(new URL('../apps/hmh-reboot/src/world-design-life.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(life, /footstep/, 'the unused surface-footstep selector is gone');
});

test('a cue whose sample is still decoding is dropped, not played late', async () => {
  resetFakeAudio();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const gestureTarget = new FakeEventTarget();
  const audio = createCombatAudio({
    AudioCtor: FakeMusic,
    AudioContextCtor: FakeAudioContext,
    fetchSample: async (path) => { await gate; return { src: path }; },
    gestureTarget,
  });
  gestureTarget.dispatch('keydown');
  assert.deepEqual(audio.play('grenade-boom', { now: 100 }), { played: false, reason: 'loading' });
  assert.equal(startedSources().length, 0);
  release();
  await audio.unlock();
  const played = audio.play('grenade-boom', { now: 101 });
  assert.equal(played.played, true, 'a dropped cue does not start its cooldown');
});

test('iOS: SFX and UI volume apply through gain nodes, including to a voice already playing', async () => {
  const { audio } = engine({ maxVoices: 16 });
  await audio.unlock();
  audio.play('hmh-fire-coin-blaster', { now: 1_000, volume: 0.22 });
  audio.play('menu-click', { now: 1_000, volume: 0.1 });
  const [gun, click] = startedSources();
  const gunFull = effectiveGain(gun);
  const clickFull = effectiveGain(click);
  assert.ok(gunFull > 0.1 && gunFull <= 0.16, `gun gain ${gunFull}`);
  audio.setBusLevels({ sfxVolume: 0.5, uiVolume: 0.25 });
  assert.ok(Math.abs(effectiveGain(gun) - gunFull * 0.5) < 1e-9, 'the SFX slider reaches a live voice');
  assert.ok(Math.abs(effectiveGain(click) - clickFull * 0.25) < 1e-9, 'the UI slider has its own bus');
  audio.setBusLevels({ sfxVolume: 0.5, uiVolume: 0.25, dynamicRange: 'night' });
  assert.ok(Math.abs(effectiveGain(gun) - gunFull * 0.5 * 0.75) < 1e-9, 'night range attenuates the buses');
  audio.setBusLevels({ sfxVolume: 0 });
  audio.play('hmh-fire-scatter-shotgun', { now: 2_000, volume: 0.22 });
  assert.equal(effectiveGain(startedSources().at(-1)), 0, 'muted SFX is silent on a device that ignores element volume');
  for (const source of startedSources()) assert.equal('volume' in source, false);
});

test('the 16-voice cap, priority stealing and damage protection hold on buffer sources', async () => {
  const { audio } = engine({ maxVoices: 16 });
  await audio.unlock();
  for (let index = 0; index < 96; index += 1) {
    audio.play(index % 2 ? 'enemy-hit' : 'hmh-fire-auto-miner', { now: index * 50, volume: 0.22 });
    assert.ok(audio.status().activeVoices <= 16);
    assert.ok(startedSources().filter((source) => !source.stopped && !source.ended).length <= 16);
  }
  assert.equal(audio.play('player-hit', { now: 4_900, volume: 0.14 }).played, true);
  assert.ok(startedSources().some((source) => source.stopCalls > 0), 'the pool steals by stopping a live source');
  assert.ok(startedSources().filter((source) => !source.stopped && !source.ended).length <= 16);
});

test('boss ducking multiplies later non-exempt voices for the bounded window only', async () => {
  const { audio } = engine();
  await audio.unlock();
  audio.play('hmh-fire-coin-blaster', { now: 500, volume: 0.22 });
  const reference = effectiveGain(startedSources()[0]);
  assert.ok(reference > 0.1, `reference gain ${reference}`);
  audio.play('boss-phase', { now: 1_000, volume: 0.14 });
  audio.play('hmh-fire-coin-blaster', { now: 1_100, volume: 0.22 });
  audio.play('player-hit', { now: 1_150, volume: 0.1 });
  assert.equal(startedSources().length, 4);
  const ducked = startedSources().at(-2);
  assert.equal(effectiveGain(startedSources().at(-1)) > 0, true, 'damage is never ducked');
  assert.ok(Math.abs(effectiveGain(ducked) - reference * BOSS_DUCK_MUL) < 1e-9);
  audio.play('hmh-fire-coin-blaster', { now: 1_700, volume: 0.22 });
  assert.ok(Math.abs(effectiveGain(startedSources().at(-1)) - reference) < 1e-9, 'the duck releases after the window');
});

test('a hidden page suspends the context and a visible page resumes it; hidden cues are not scheduled', async () => {
  const { audio, visibilityTarget, context } = engine();
  await audio.unlock();
  const ctx = context();
  visibilityTarget.visibilityState = 'hidden';
  visibilityTarget.dispatch('visibilitychange');
  assert.equal(ctx.state, 'suspended');
  assert.equal(ctx.suspendCalls, 1);
  assert.deepEqual(audio.play('enemy-hit', { now: 1_000 }), { played: false, reason: 'suspended' },
    'a cue queued into a suspended context would burst out on return');
  visibilityTarget.visibilityState = 'visible';
  visibilityTarget.dispatch('visibilitychange');
  assert.equal(ctx.state, 'running');
  assert.equal(audio.play('enemy-hit', { now: 2_000 }).played, true);
});

test('an iOS interruption (call, Siri, another app) is recovered by the next touch', async () => {
  const { audio, gestureTarget, context } = engine();
  await audio.unlock();
  const ctx = context();
  ctx.setState('interrupted');
  assert.deepEqual(audio.play('enemy-hit', { now: 1_000 }), { played: false, reason: 'suspended' });
  const before = ctx.resumeCalls;
  gestureTarget.dispatch('touchend');
  assert.equal(ctx.resumeCalls, before + 1);
  assert.equal(ctx.state, 'running');
  assert.equal(audio.play('enemy-hit', { now: 2_000 }).played, true);
  assert.equal(FakeAudioContext.instances.length, 1, 'recovery reuses the context and its decoded buffers');
});

test('touch pointerdown is not an activation on iOS, so pointerup, touchend and keydown also unlock', () => {
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
    const { gestureTarget, context } = engine();
    gestureTarget.dispatch(type);
    assert.ok(context(), `${type} unlocks`);
    assert.equal(context().resumeCalls, 1, `${type} resumes inside the gesture`);
  }
});

test('ended voices release their slot and disconnect from the graph', async () => {
  const { audio } = engine();
  await audio.unlock();
  audio.play('enemy-hit', { now: 1_000 });
  const [voice] = startedSources();
  assert.equal(audio.status().activeVoices, 1);
  voice.finish();
  assert.equal(audio.status().activeVoices, 0);
  assert.equal(voice.disconnected, true);
});

test('a sample that fails to fetch or decode is silent without leaking a voice or a console error', async () => {
  const { audio } = engine({}, {
    fail: new Set(['../assets/audio/sfx/hmh-grenade-boom.wav']),
    corrupt: new Set(['../assets/audio/sfx/weapon-fire.ogg']),
  });
  const result = await audio.unlock();
  assert.equal(result.unlocked, true);
  assert.deepEqual(audio.play('grenade-boom', { now: 1_000 }), { played: false, reason: 'sample-unavailable' });
  assert.deepEqual(audio.play('weapon-fire', { now: 1_000 }), { played: false, reason: 'sample-unavailable' });
  assert.equal(audio.status().activeVoices, 0);
  assert.equal(audio.play('enemy-hit', { now: 1_000 }).played, true);
  assert.equal(audio.status().samplesFailed, 2);
});

test('a browser without Web Audio degrades to silent SFX instead of throwing in the frame loop', async () => {
  const gestureTarget = new FakeEventTarget();
  const audio = createCombatAudio({ AudioCtor: FakeMusic, AudioContextCtor: null, gestureTarget, fetchSample: () => { throw new Error('unused'); } });
  gestureTarget.dispatch('pointerup');
  await audio.unlock();
  assert.deepEqual(audio.play('enemy-hit', { now: 1 }), { played: false, reason: 'unsupported' });
  assert.equal(audio.status().contextState, 'unsupported');
});

test('destroy closes the context and removes every gesture and visibility listener', async () => {
  const { audio, gestureTarget, visibilityTarget, context } = engine();
  assert.ok(gestureTarget.listenerCount() >= 4);
  assert.equal(visibilityTarget.listenerCount(), 1);
  await audio.unlock();
  audio.play('enemy-hit', { now: 1_000 });
  audio.destroy();
  assert.equal(context().closeCalls, 1);
  assert.equal(gestureTarget.listenerCount(), 0);
  assert.equal(visibilityTarget.listenerCount(), 0);
  assert.equal(startedSources()[0].stopCalls, 1);
});

test('pause keeps the context running so the pause-menu slider preview still sounds', async () => {
  const { audio, context } = engine();
  await audio.unlock();
  audio.play('enemy-hit', { now: 1_000 });
  audio.pause();
  assert.equal(context().state, 'running');
  assert.equal(startedSources()[0].stopCalls, 1);
  assert.deepEqual(audio.play('enemy-hit', { now: 2_000 }), { played: false, reason: 'paused' });
  assert.equal(audio.play('pickup', { now: 2_000, volume: 0.12 }).played, true);
});

test('every weapon cue decodes from its synthesised sample and reaches a source', async () => {
  const { audio } = engine({ gameplayOnly: true });
  await audio.unlock();
  let now = 0;
  for (const [cueId, cue] of Object.entries(HMH_WEAPON_SFX)) {
    now += 1_000;
    assert.equal(audio.play(cueId, { now, volume: cue.gain }).played, true, cueId);
    assert.equal(startedSources().at(-1).buffer.src, cue.src);
  }
});

test('main.mjs hands the engine its gesture and visibility targets and keeps no one-shot unlock', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const start = main.indexOf('const combatAudio = createCombatAudio');
  const call = main.slice(start, main.indexOf('handleBridgeProtocolError = (error)', start));
  assert.match(call, /gestureTarget: window/);
  assert.match(call, /visibilityTarget: document/);
  assert.doesNotMatch(main, /unlockCombatAudio/, 'the once-only pointerdown unlock never fired on an iOS touch');
});
