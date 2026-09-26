import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatAudio, MAX_VOICE_LIFETIME_MS } from '../apps/hmh-reboot/src/combat-audio.mjs';
import {
  FakeAudioContext,
  FakeMusic,
  effectiveGain,
  fakeSampleFetch,
  resetFakeAudio,
  startedSources,
} from './helpers/fake-web-audio.mjs';

// SFX play as Web Audio buffer sources (perf step 5/8). A source's buffer
// carries the sample path it was decoded from, and effectiveGain() is what
// the old element `volume` reported.
async function fresh(options = {}) {
  resetFakeAudio();
  const audio = createCombatAudio({
    AudioCtor: FakeMusic,
    AudioContextCtor: FakeAudioContext,
    fetchSample: fakeSampleFetch().fetchSample,
    ...options,
  });
  await audio.unlock();
  return audio;
}

const context = () => FakeAudioContext.instances.at(-1);
const cueSources = () => context().sources.filter((source) => !source.buffer?.priming);

test('combat audio uses only local retained HMH samples and honors cue cooldowns', async () => {
  const audio = await fresh();
  const first = audio.play('weapon-fire', { now: 100, volume: 0.1 });
  const blocked = audio.play('weapon-fire', { now: 120, volume: 0.1 });
  assert.equal(first.played, true);
  assert.equal(blocked.played, false);
  assert.equal(blocked.reason, 'cooldown');
  const [source] = startedSources();
  assert.match(source.buffer.src, /^\.\.\/assets\/audio\/sfx\/weapon-fire\.ogg$/);
  assert.doesNotMatch(source.buffer.src, /^https?:/);
  assert.equal(startedSources().length, 1);
});

test('voice pool remains fixed and steals the oldest eligible voice by retained priority policy', async () => {
  const audio = await fresh({ maxVoices: 2 });
  audio.play('weapon-fire', { now: 100 });
  audio.play('melee', { now: 200 });
  const third = audio.play('grenade', { now: 400 });
  assert.equal(third.played, true);
  assert.equal(audio.status().activeVoices, 2);
  assert.equal(startedSources()[0].stopCalls, 1);
  assert.equal(startedSources().length, 3);
});

test('pause suppresses new cues and resume starts from a clean one-shot pool', async () => {
  const audio = await fresh();
  audio.play('enemy-hit', { now: 100 });
  audio.pause();
  assert.equal(startedSources()[0].stopCalls, 1);
  assert.deepEqual(audio.play('grenade', { now: 500 }), { played: false, reason: 'paused' });
  audio.resume();
  assert.equal(audio.status().activeVoices, 0);
  assert.equal(audio.play('grenade', { now: 600 }).played, true);
});

test('HMH music is standalone-only, user-gated, looped, and obeys music settings', async () => {
  await fresh({ standalone: false, musicEnabled: true });
  assert.equal(FakeMusic.instances.length, 0);

  const standalone = await fresh({ standalone: true, musicEnabled: true });
  assert.equal(FakeMusic.instances.length, 1);
  assert.match(FakeMusic.instances[0].src, /hard-money-heroes-16-bit-arcade-music\.mp3$/);
  assert.equal(FakeMusic.instances[0].loop, true);
  standalone.setMusicEnabled(false);
  assert.equal(FakeMusic.instances[0].pauseCalls, 1);
});

test('X2 music, SFX, and UI buses have independent bounded runtime consumers', async () => {
  resetFakeAudio();
  const audio = createCombatAudio({
    AudioCtor: FakeMusic,
    AudioContextCtor: FakeAudioContext,
    fetchSample: fakeSampleFetch().fetchSample,
    standalone: true,
    musicEnabled: true,
  });
  audio.setBusLevels({ musicVolume: 0.5, sfxVolume: 0.25, uiVolume: 0.75, dynamicRange: 'night' });
  await audio.unlock();
  const music = FakeMusic.instances[0];
  assert.equal(music.volume, 0.2);
  audio.play('weapon-fire', { now: 100, volume: 0.4 });
  audio.play('menu-click', { now: 200, volume: 0.4 });
  const [sfx, ui] = startedSources();
  assert.ok(effectiveGain(sfx) > 0 && effectiveGain(sfx) < effectiveGain(ui));
  assert.deepEqual(audio.status().buses, { music: 0.5, sfx: 0.25, ui: 0.75, dynamicRange: 'night' });
});

test('unknown cues fail closed without allocating voices', async () => {
  const audio = await fresh();
  assert.deepEqual(audio.play('not-a-cue', { now: 1 }), { played: false, reason: 'unknown-cue' });
  assert.equal(cueSources().length, 0);
});

test('boss phase uses its original local PCM sample through the boss-family cue policy', async () => {
  const audio = await fresh();
  const first = audio.play('boss-phase', { now: 1_200, volume: 0.14 });
  const blocked = audio.play('boss-phase', { now: 1_201, volume: 0.14 });
  assert.equal(first.played, true);
  assert.equal(blocked.reason, 'cooldown');
  assert.equal(startedSources().length, 1, 'the cooldown must not allocate another voice');
  assert.match(startedSources()[0].buffer.src, /^\.\.\/assets\/audio\/sfx\/hmh-boss-phase\.wav$/);
  assert.equal(effectiveGain(startedSources()[0]), 0.16);
});

test('voices whose start is refused by the browser do not leak the voice pool', async () => {
  const audio = await fresh();
  context().failStart = true;
  for (let index = 0; index < 20; index += 1) {
    audio.play('player-hit', { now: 1_000 + index * 400, volume: 0.1 });
  }
  assert.equal(audio.status().activeVoices, 0, 'a refused start must release its voice slot');
  assert.ok(cueSources().every((source) => source.disconnected));
  context().failStart = false;
  const recovered = audio.play('weapon-fire', { now: 20_000, volume: 0.1 });
  assert.equal(recovered.played, true, 'combat SFX must not be permanently locked out by refused voices');
});

test('age-reaped voices stop actual playback before their pool slots are reused', async () => {
  const audio = await fresh({ maxVoices: 2 });
  audio.play('weapon-fire', { now: 100 });
  const [expired] = startedSources();
  audio.play('melee', { now: 101 + MAX_VOICE_LIFETIME_MS });
  assert.equal(audio.status().activeVoices, 1);
  assert.equal(expired.stopped, true, 'dropping a registry entry must also stop its source');
  assert.equal(expired.disconnected, true);
  assert.equal(expired.stopCalls, 1);
  audio.play('weapon-fire', { now: 102 + MAX_VOICE_LIFETIME_MS });
  assert.equal(expired.stopCalls, 1, 'retired voices must not be stopped repeatedly');
  assert.equal(startedSources().filter((source) => !source.stopped && !source.ended).length, 2);
});

test('voice lifetime boundary keeps nonexpired playback active', async () => {
  const audio = await fresh({ maxVoices: 2 });
  audio.play('weapon-fire', { now: 100 });
  const [active] = startedSources();
  audio.play('melee', { now: 100 + MAX_VOICE_LIFETIME_MS });
  assert.equal(active.stopped, false);
  assert.equal(active.stopCalls, 0);
  assert.equal(audio.status().activeVoices, 2);
});

test('stale voices are reaped so a never-ending sample cannot hold a slot forever', async () => {
  const audio = await fresh();
  for (let index = 0; index < 8; index += 1) {
    audio.play('grenade-boom', { now: 1_000 + index * 1_000, volume: 0.1 });
  }
  const before = audio.status().activeVoices;
  assert.ok(before > 0);
  audio.play('weapon-fire', { now: 1_000_000, volume: 0.1 });
  assert.ok(audio.status().activeVoices < before + 1, 'voices older than the max sample lifetime must be reaped');
});
