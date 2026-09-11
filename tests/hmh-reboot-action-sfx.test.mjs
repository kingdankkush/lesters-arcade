import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createCombatAudio } from '../apps/hmh-reboot/src/combat-audio.mjs';
import { weaponFireGain } from '../apps/hmh-reboot/src/weapon-audio.mjs';
import { createWeaponLoadout, stepWeaponLoadout } from '../apps/hmh-reboot/src/weapon-system.mjs';

const root = new URL('../apps/portal/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets/audio/sfx/hmh-weapon-sfx-manifest.json', root)));
class AudioProbe {
  static voices = [];
  constructor(src) { this.src = src; this.paused = true; this.ended = false; AudioProbe.voices.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
function pcm(src) {
  const bytes = readFileSync(new URL(src.replace('../assets/', 'assets/'), root));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.readUInt16LE(22), 1);
  const rate = bytes.readUInt32LE(24);
  const samples = Array.from({ length: bytes.readUInt32LE(40) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32768);
  return { bytes, samples, rate };
}
const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / Math.max(1, values.length));

test('pistol and automatic fire carry a sustained pressure body as well as an initial crack', () => {
  for (const id of ['coin-blaster', 'auto-miner']) {
    const cue = manifest.cues[`hmh-fire-${id}`];
    const { samples, rate } = pcm(cue.src.replace('./', '../'));
    const body = rms(samples.slice(Math.floor(rate * .015), Math.floor(rate * .075)));
    assert.ok(body >= .12, `${id}: 15–75ms pressure body RMS ${body} is too thin`);
    assert.ok(weaponFireGain(id) >= .18, `${id}: routed gain must remain audible over gameplay music`);
  }
});

test('hits, reloads, power-ups and reward choices reach distinct authored samples through the real player', () => {
  AudioProbe.voices = [];
  const player = createCombatAudio({ AudioCtor: AudioProbe });
  const cues = ['hmh-weapon-reload', 'reload-complete', 'enemy-hit', 'player-hit', 'grenade', 'grenade-boom',
    'health-pickup', 'ammo-pickup', 'time-dilation-activate', 'berserk-activate', 'pickup', 'upgrade-offer', 'upgrade-pick'];
  cues.forEach((cue, index) => assert.equal(player.play(cue, { now: index * 1000, volume: .14 }).played, true));
  const hashes = AudioProbe.voices.map(voice => {
    assert.match(voice.src, /\/hmh-[a-z-]+\.wav$/, voice.src);
    return createHash('sha256').update(pcm(voice.src).bytes).digest('hex');
  });
  assert.equal(new Set(hashes).size, cues.length, 'different combat/reward events must be distinguishable by sound');
  player.destroy();
});

test('reload release and final chamber cues correspond to separate authoritative ammo events', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /event\.type === 'weapon:reload-start'[\s\S]{0,160}play\('hmh-weapon-reload'/);
  assert.match(source, /event\.type === 'weapon:reload-complete'[\s\S]{0,160}play\('reload-complete'/);
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster'], seed: 17 });
  const events = [];
  for (let tick = 1; tick <= 232; tick++) {
    const frame = stepWeaponLoadout(state, { tick, fire: true, direction: { x: 1, y: 0 } });
    events.push(...frame.events.filter(event => event.type.startsWith('weapon:reload-')));
  }
  assert.deepEqual(events.map(event => event.type), ['weapon:reload-start', 'weapon:reload-complete']);
  assert.equal(events[1].tick, events[0].completeTick);
  assert.equal(events[1].tick - events[0].tick, 90);
  assert.ok(manifest.cues['hmh-weapon-reload'].durationMs < 1000 * (events[1].tick - events[0].tick) / 60);
  assert.notEqual(manifest.cues['hmh-weapon-reload'].sha256, manifest.cues['hmh-reload-complete'].sha256);
});

test('authored sample manifest binds shipped PCM and leaves clean attack/tail and peak headroom', () => {
  let totalBytes = 0;
  for (const [id, cue] of Object.entries(manifest.cues)) {
    const { bytes, samples, rate } = pcm(cue.src.replace('./', '../'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), cue.sha256, id);
    assert.equal(bytes.length, cue.bytes, id);
    assert.ok(Math.abs(samples[0]) <= 1 / 32768 && Math.abs(samples.at(-1)) <= 1 / 32768, `${id}: click at file boundary`);
    assert.ok(Math.max(...samples.map(Math.abs)) <= .781, `${id}: insufficient resampling headroom`);
    assert.ok(Math.abs(samples.reduce((sum, value) => sum + value, 0) / samples.length) < .008, `${id}: DC bias`);
    assert.ok(samples.length / rate < 1.6, `${id}: long tail would crowd the combat mix`);
    totalBytes += bytes.length;
  }
  assert.ok(totalBytes <= 1_750_000, `short mono sample budget exceeded: ${totalBytes}`);
});

test('rapid combat audio respects the voice cap, protects damage, and still obeys mute and pause', () => {
  AudioProbe.voices = [];
  const player = createCombatAudio({ AudioCtor: AudioProbe, maxVoices: 16 });
  for (let i = 0; i < 96; i++) {
    player.play(i % 2 ? 'enemy-hit' : 'hmh-fire-auto-miner', { now: i * 50, volume: .22 });
    assert.ok(player.status().activeVoices <= 16);
  }
  assert.equal(player.play('player-hit', { now: 4900, volume: .14 }).played, true);
  assert.ok(AudioProbe.voices.filter(voice => !voice.paused).length <= 16);
  player.setBusLevels({ sfxVolume: 0 });
  player.play('hmh-fire-coin-blaster', { now: 5000, volume: .22 });
  assert.equal(AudioProbe.voices.at(-1).volume, 0);
  player.pause();
  assert.ok(AudioProbe.voices.every(voice => voice.paused));
  assert.equal(player.play('hmh-fire-coin-blaster', { now: 6000 }).played, false);
  player.destroy();
});
