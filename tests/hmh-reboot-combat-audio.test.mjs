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

test('unknown cues fail closed without allocating voices', () => {
  const audio = fresh();
  assert.deepEqual(audio.play('not-a-cue', { now: 1 }), { played: false, reason: 'unknown-cue' });
  assert.equal(FakeAudio.instances.length, 0);
});
