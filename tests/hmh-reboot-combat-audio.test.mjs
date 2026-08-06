import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatAudio } from '../apps/hmh-reboot/src/combat-audio.mjs';

class FakeAudio {
  static instances = [];

  constructor(src) {
    this.src = src;
    this.loop = false;
    this.preload = '';
    this.volume = 1;
    this.currentTime = 0;
    this.ended = false;
    this.paused = true;
    this.playCalls = 0;
    this.pauseCalls = 0;
    FakeAudio.instances.push(this);
  }

  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
}

function fresh(options = {}) {
  FakeAudio.instances = [];
  return createCombatAudio({ AudioCtor: FakeAudio, ...options });
}

test('combat audio uses only local retained HMH samples and honors cue cooldowns', () => {
  const audio = fresh();
  const first = audio.play('weapon-fire', { now: 100, volume: 0.1 });
  const blocked = audio.play('weapon-fire', { now: 120, volume: 0.1 });
  assert.equal(first.played, true);
  assert.equal(blocked.played, false);
  assert.equal(blocked.reason, 'cooldown');
  assert.match(FakeAudio.instances[0].src, /^\.\.\/assets\/audio\/sfx\/weapon-fire\.ogg$/);
  assert.doesNotMatch(FakeAudio.instances[0].src, /^https?:/);
});

test('voice pool remains fixed and steals the oldest eligible voice by retained priority policy', () => {
  const audio = fresh({ maxVoices: 2 });
  audio.play('weapon-fire', { now: 100 });
  audio.play('melee', { now: 200 });
  const third = audio.play('grenade', { now: 400 });
  assert.equal(third.played, true);
  assert.equal(audio.status().activeVoices, 2);
  assert.equal(FakeAudio.instances[0].pauseCalls, 1);
  assert.equal(FakeAudio.instances.length, 3);
});

test('pause suppresses new cues and resume starts from a clean one-shot pool', () => {
  const audio = fresh();
  audio.play('enemy-hit', { now: 100 });
  audio.pause();
  assert.equal(FakeAudio.instances[0].pauseCalls, 1);
  assert.deepEqual(audio.play('grenade', { now: 500 }), { played: false, reason: 'paused' });
  audio.resume();
  assert.equal(audio.status().activeVoices, 0);
  assert.equal(audio.play('grenade', { now: 600 }).played, true);
});

test('HMH music is standalone-only, user-gated, looped, and obeys music settings', async () => {
  const embedded = fresh({ standalone: false, musicEnabled: true });
  await embedded.unlock();
  assert.equal(FakeAudio.instances.length, 0);

  const standalone = fresh({ standalone: true, musicEnabled: true });
  await standalone.unlock();
  assert.equal(FakeAudio.instances.length, 1);
  assert.match(FakeAudio.instances[0].src, /hard-money-heroes-16-bit-arcade-music\.mp3$/);
  assert.equal(FakeAudio.instances[0].loop, true);
  standalone.setMusicEnabled(false);
  assert.equal(FakeAudio.instances[0].pauseCalls, 1);
});

test('X2 music, SFX, and UI buses have independent bounded runtime consumers', async () => {
  const audio = fresh({ standalone: true, musicEnabled: true });
  audio.setBusLevels({ musicVolume: 0.5, sfxVolume: 0.25, uiVolume: 0.75, dynamicRange: 'night' });
  await audio.unlock();
  const music = FakeAudio.instances[0];
  assert.equal(music.volume, 0.2);
  audio.play('weapon-fire', { now: 100, volume: 0.4 });
  const sfx = FakeAudio.instances[1];
  audio.play('menu-click', { now: 200, volume: 0.4 });
  const ui = FakeAudio.instances[2];
  assert.ok(sfx.volume > 0 && sfx.volume < ui.volume);
  assert.deepEqual(audio.status().buses, { music: 0.5, sfx: 0.25, ui: 0.75, dynamicRange: 'night' });
});

test('unknown cues fail closed without allocating voices', () => {
  const audio = fresh();
  assert.deepEqual(audio.play('not-a-cue', { now: 1 }), { played: false, reason: 'unknown-cue' });
  assert.equal(FakeAudio.instances.length, 0);
});

test('boss phase uses the retained local warning sample through the boss-family cue policy', () => {
  const audio = fresh();
  const first = audio.play('boss-phase', { now: 1_200, volume: 0.14 });
  const blocked = audio.play('boss-phase', { now: 1_201, volume: 0.14 });
  assert.equal(first.played, true);
  assert.equal(blocked.reason, 'cooldown');
  assert.match(FakeAudio.instances[0].src, /^\.\.\/assets\/audio\/sfx\/boss-warning\.ogg$/);
  assert.equal(FakeAudio.instances[0].volume, 0.16);
});

class RejectingAudio extends FakeAudio {
  play() {
    this.playCalls += 1;
    // Codec-unsupported browsers (Ogg on WebKit) reject and never fire onended.
    return Promise.reject(new Error('NotSupportedError'));
  }
}

test('voices whose playback is rejected by the browser do not leak the voice pool', async () => {
  FakeAudio.instances = [];
  const audio = createCombatAudio({ AudioCtor: RejectingAudio });
  for (let index = 0; index < 20; index += 1) {
    audio.play('player-hit', { now: 1_000 + index * 400, volume: 0.1 });
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(audio.status().activeVoices, 0, 'rejected playback must release its voice slot');
  const recovered = audio.play('weapon-fire', { now: 20_000, volume: 0.1 });
  assert.equal(recovered.played, true, 'combat SFX must not be permanently locked out by rejected voices');
});

test('stale voices are reaped so a never-ending sample cannot hold a slot forever', () => {
  FakeAudio.instances = [];
  const audio = createCombatAudio({ AudioCtor: FakeAudio });
  for (let index = 0; index < 8; index += 1) {
    audio.play('grenade-boom', { now: 1_000 + index * 1_000, volume: 0.1 });
  }
  const before = audio.status().activeVoices;
  assert.ok(before > 0);
  audio.play('weapon-fire', { now: 1_000_000, volume: 0.1 });
  assert.ok(audio.status().activeVoices < before + 1, 'voices older than the max sample lifetime must be reaped');
});
