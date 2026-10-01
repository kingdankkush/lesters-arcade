// 2.1 HMH-FEEL item 2 (upgrade guide §2.4.1, §2.4.4): master compressor on
// the HMH audio graph, a gentle SFX-bus compressor, and the 3 dB music duck
// under a boss (standalone: the child's own music gain; embedded: the parent's
// shared jukebox through its existing volume path).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_MASTER_COMPRESSOR,
  HMH_MUSIC_DUCK_GAIN,
  HMH_SFX_BUS_COMPRESSOR,
  createCombatAudio,
} from '../apps/hmh-reboot/src/combat-audio.mjs';
import { MASTER_BUS_COMPRESSOR, createBusCompressor, dbToGain } from '../apps/portal/src/feel/audio-bus.mjs';
import { STACKED_SFX_COMPRESSOR } from '../apps/stacked/src/sound-effects.mjs';
import { validateChildMessage, createBridgeEnvelope } from '../sdk/hmh-bridge-protocol.mjs';
import { createHmhRebootPortalLifecycle } from '../apps/portal/src/hmh-reboot-portal-lifecycle.mjs';
import {
  FakeAudioContext,
  FakeEventTarget,
  FakeMusic,
  effectiveGain,
  fakeSampleFetch,
  resetFakeAudio,
  startedSources,
} from './helpers/fake-web-audio.mjs';

class FakeParam {
  constructor(value) { this.value = value; this.calls = []; }
  setValueAtTime(value, when) { this.value = value; this.calls.push(['set', value, when]); }
}
class FakeCompressor {
  constructor(context) {
    this.context = context; this.kind = 'compressor'; this.outputs = []; this.disconnected = false;
    for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new FakeParam(0);
  }
  connect(node) { this.outputs.push(node); return node; }
  disconnect() { this.outputs = []; this.disconnected = true; }
}
class FakeMediaSource {
  constructor(context, element) { this.context = context; this.kind = 'media'; this.element = element; this.outputs = []; }
  connect(node) { this.outputs.push(node); return node; }
  disconnect() { this.outputs = []; }
}
// A context with dynamics and media-element sources, like every shipping browser.
class DynamicsContext extends FakeAudioContext {
  constructor() { super(); this.compressors = []; this.mediaSources = []; }
  createDynamicsCompressor() { const node = new FakeCompressor(this); this.compressors.push(node); return node; }
  createMediaElementSource(element) { const node = new FakeMediaSource(this, element); this.mediaSources.push(node); return node; }
}

function engine(options = {}) {
  resetFakeAudio({ autoplay: false });
  const loader = fakeSampleFetch();
  const audio = createCombatAudio({
    AudioCtor: FakeMusic,
    AudioContextCtor: DynamicsContext,
    fetchSample: loader.fetchSample,
    gestureTarget: new FakeEventTarget(),
    visibilityTarget: new FakeEventTarget({ visibilityState: 'visible' }),
    ...options,
  });
  return { audio, context: () => FakeAudioContext.instances.at(-1) };
}

const chain = (node) => {
  const kinds = [];
  for (let current = node; current; current = current.outputs?.[0]) {
    kinds.push(current.kind);
    if (current.kind === 'destination') break;
  }
  return kinds;
};

test('the master compressor uses STACKED values from the shared feel module', () => {
  assert.deepEqual({ ...HMH_MASTER_COMPRESSOR }, { ...STACKED_SFX_COMPRESSOR });
  assert.equal(HMH_MASTER_COMPRESSOR, MASTER_BUS_COMPRESSOR);
  assert.deepEqual({ ...HMH_MASTER_COMPRESSOR }, { threshold: -16, knee: 10, ratio: 3.5, attack: 0.003, release: 0.22 });
  // The SFX bus compressor is gentler than master on every axis that matters.
  assert.ok(HMH_SFX_BUS_COMPRESSOR.threshold > HMH_MASTER_COMPRESSOR.threshold);
  assert.ok(HMH_SFX_BUS_COMPRESSOR.ratio < HMH_MASTER_COMPRESSOR.ratio);
  const ctx = new DynamicsContext();
  const node = createBusCompressor(ctx, HMH_MASTER_COMPRESSOR);
  for (const [key, value] of Object.entries(HMH_MASTER_COMPRESSOR)) assert.equal(node[key].value, value, key);
  assert.equal(createBusCompressor({}, HMH_MASTER_COMPRESSOR), null, 'no compressor support -> null');
  assert.ok(Math.abs(dbToGain(-3) - 0.7079) < 1e-4);
});

test('SFX route bus -> SFX compressor -> master -> destination; UI skips the SFX compressor', async () => {
  const { audio, context } = engine();
  await audio.unlock();
  let now = 0;
  for (const cue of ['hmh-fire-coin-blaster', 'enemy-hit', 'menu-click']) {
    now += 1_000;
    assert.equal(audio.play(cue, { now, volume: 0.12 }).played, true, cue);
  }
  const ctx = context();
  assert.equal(ctx.compressors.length, 2);
  const [sfx, ui] = [startedSources()[0], startedSources()[2]];
  assert.deepEqual(chain(sfx), ['source', 'gain', 'gain', 'compressor', 'compressor', 'destination']);
  assert.deepEqual(chain(ui), ['source', 'gain', 'gain', 'compressor', 'destination']);
  // The master node carries the STACKED values; compressors do not change the
  // configured cue gain (bus x voice), so the existing mix levels still hold.
  const master = ctx.compressors.find((node) => node.outputs[0] === ctx.destination);
  for (const [key, value] of Object.entries(HMH_MASTER_COMPRESSOR)) assert.equal(master[key].value, value);
  assert.ok(effectiveGain(sfx) > 0);
  const status = audio.status();
  assert.equal(status.master, 'compressor');
  assert.equal(status.sfxCompressor, true);
});

test('a context without compressors still plays: the buses wire straight to the destination', async () => {
  resetFakeAudio({ autoplay: false });
  const loader = fakeSampleFetch();
  const audio = createCombatAudio({ AudioCtor: FakeMusic, AudioContextCtor: FakeAudioContext, fetchSample: loader.fetchSample, gestureTarget: new FakeEventTarget() });
  await audio.unlock();
  assert.equal(audio.play('enemy-hit', { now: 1_000 }).played, true);
  assert.deepEqual(chain(startedSources()[0]), ['source', 'gain', 'gain', 'destination']);
  assert.equal(audio.status().master, 'direct');
});

test('standalone music routes through a media element source and ducks 3 dB under a boss, then settles back', async () => {
  const { audio, context } = engine({ standalone: true, autoplay: true });
  await audio.unlock();
  const ctx = context();
  assert.equal(ctx.mediaSources.length, 1, 'the child owns its standalone element alone');
  const music = FakeMusic.instances.at(-1);
  assert.equal(ctx.mediaSources[0].element, music);
  const gain = ctx.mediaSources[0].outputs[0];
  assert.equal(gain.kind, 'gain');
  assert.equal(gain.outputs[0], ctx.destination, 'music is not mastered with the SFX');
  assert.equal(music.volume, 1, 'the gain node carries the level');
  const baseline = gain.gain.value;
  assert.ok(Math.abs(baseline - 0.4 * 0.7) < 1e-12);
  audio.setMusicDuck(true);
  assert.ok(Math.abs(gain.gain.value / baseline - HMH_MUSIC_DUCK_GAIN) < 1e-12);
  assert.ok(Math.abs(20 * Math.log10(gain.gain.value / baseline) + 3) < 1e-9, '-3 dB');
  assert.equal(audio.status().musicDuck, true);
  assert.equal(audio.status().musicRoute, 'graph');
  // A volume change while ducked keeps the duck.
  audio.setBusLevels({ musicVolume: 0.5 });
  assert.ok(Math.abs(gain.gain.value - 0.4 * 0.5 * HMH_MUSIC_DUCK_GAIN) < 1e-12);
  audio.setBusLevels({ musicVolume: 0.7 });
  audio.setMusicDuck(false);
  assert.equal(gain.gain.value, baseline, 'gain settles back to baseline after the boss beat');
  // Repeated beats never drift.
  for (let i = 0; i < 50; i += 1) { audio.setMusicDuck(true); audio.setMusicDuck(false); }
  assert.equal(gain.gain.value, baseline);
  audio.destroy();
});

test('without createMediaElementSource the duck lands on the element volume', async () => {
  resetFakeAudio({ autoplay: true });
  const loader = fakeSampleFetch();
  const audio = createCombatAudio({ AudioCtor: FakeMusic, AudioContextCtor: FakeAudioContext, fetchSample: loader.fetchSample, standalone: true });
  await audio.unlock();
  const music = FakeMusic.instances.at(-1);
  const baseline = music.volume;
  audio.setMusicDuck(true);
  assert.ok(Math.abs(music.volume - baseline * HMH_MUSIC_DUCK_GAIN) < 1e-12);
  audio.setMusicDuck(false);
  assert.equal(music.volume, baseline);
  assert.equal(audio.status().musicRoute, 'element');
});

test('embedded: game:state carries an optional musicDuck the parent applies to the shared jukebox', () => {
  const state = { status: 'running', score: 1, kills: 0, elapsedMs: 10, health: 50, maxHealth: 100, xp: 0, level: 1, paused: false };
  const envelope = (payload) => createBridgeEnvelope({ type: 'game:state', sessionId: 'game-session-duck', messageId: 'm-1', payload });
  assert.equal(validateChildMessage(envelope(state)).ok, true, 'absent: no duck, older shape valid');
  assert.equal(validateChildMessage(envelope({ ...state, musicDuck: true })).ok, true);
  assert.equal(validateChildMessage(envelope({ ...state, musicDuck: false })).ok, false, 'only ever true');
  assert.equal(validateChildMessage(envelope({ ...state, musicDuck: 1 })).ok, false);
  const ducks = [];
  const lifecycle = createHmhRebootPortalLifecycle({ combat: {}, onMusicDuck: (active) => ducks.push(active) });
  lifecycle.handleState({ type: 'game:state', payload: { ...state, musicDuck: true } });
  lifecycle.handleState({ type: 'game:state', payload: state });
  assert.deepEqual(ducks, [true, false]);

  const portal = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(portal, /const ARCADE_MUSIC_BOSS_DUCK_GAIN = 10 \*\* \(-3 \/ 20\);/);
  assert.match(portal, /onMusicDuck: \(active\) => setArcadeMusicDuck\(active\)/);
  assert.match(portal, /arcadeMusic\.duck && reason === 'gameplay' \? ARCADE_MUSIC_BOSS_DUCK_GAIN : 1/);
  // Only the gameplay context ducks; leaving the cabinet clears it.
  assert.match(portal, /setArcadeMusicDuck\(false\);\n  hmhRebootActive = false;\n  hmhFrontierPreviewActive = false;/);
  // The shared jukebox is never re-sourced by HMH (STACKED already owns its
  // one createMediaElementSource): the portal duck is a volume multiplier.
  assert.doesNotMatch(portal, /createMediaElementSource/);
});

test('the child reads the duck from the boss HUD state and reports changes once', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /bossMusicDuckWanted = bossEngaged;/);
  assert.match(main, /if \(active === musicDuckActive\) return;/);
  assert.match(main, /combatAudio\.setMusicDuck\(active\);/);
  assert.match(main, /\.\.\.\(musicDuckActive && status === 'running' \? \{ musicDuck: true \} : \{\}\)/);
  // The simulation never sees it.
  for (const file of ['simulation.mjs', 'enemy-simulation.mjs', 'combat-lifecycle.mjs', 'run-summary-v7.mjs']) {
    const source = readFileSync(new URL(`../apps/hmh-reboot/src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /musicDuck/, file);
  }
});
