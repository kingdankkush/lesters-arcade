// Audit the files the real child audio player selects. The older audition
// rendered registry fallback tones; it did not measure these shipped samples.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCombatAudio } from '../apps/hmh-reboot/src/combat-audio.mjs';
import { HMH_WEAPON_SFX } from '../apps/hmh-reboot/src/weapon-audio.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const portal = path.join(root, 'apps/portal');
const manifest = JSON.parse(readFileSync(path.join(portal, 'assets/audio/sfx/hmh-weapon-sfx-manifest.json')));
const rate = manifest.sampleRate;
const output = path.resolve(process.argv[2] ?? path.join(root, '.tmp/hmh-action-audio'));
mkdirSync(output, { recursive: true });
const rms = data => Math.sqrt(data.reduce((sum, x) => sum + x*x, 0) / data.length);
const rounded = x => Number(x.toFixed(6));
const peakOf = data => data.reduce((peak, x) => Math.max(peak, Math.abs(x)), 0);

function decode(src) {
  const bytes = readFileSync(path.join(portal, src.replace(/^\.\.\//, '').replace(/^\.\//, '')));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.readUInt32LE(24), rate);
  const data = Float64Array.from({ length: bytes.readUInt32LE(40) / 2 }, (_, i) => bytes.readInt16LE(44 + i*2) / 32768);
  return { bytes, data };
}

// Four-times, windowed-sinc interpolation estimates reconstruction overshoot;
// this is a source-level metric, not a claim about every browser/audio device.
function reconstructedPeak(data) {
  let peak = peakOf(data);
  const sinc = x => Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI*x) / (Math.PI*x);
  const kernels = [.25, .5, .75].map(fraction => {
    const weights = Array.from({ length: 16 }, (_, index) => {
      const distance = fraction - (index - 7);
      return Math.abs(distance) < 8 ? sinc(distance) * sinc(distance / 8) : 0;
    });
    const sum = weights.reduce((a, x) => a + x, 0);
    return weights.map(x => x / sum);
  });
  for (let i = 0; i < data.length; i++) {
    for (const kernel of kernels) {
      let sample = 0;
      for (let j = 0; j < kernel.length; j++) sample += (data[i + j - 7] ?? 0) * kernel[j];
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  return peak;
}

class AudioProbe {
  static instances = [];
  static now = 0;
  constructor(src) {
    this.src = src;
    this.startedAt = AudioProbe.now;
    this.stoppedAt = Infinity;
    this.ended = false;
    this.paused = true;
    AudioProbe.instances.push(this);
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; this.stoppedAt = AudioProbe.now; }
}

const samples = new Map();
const rows = [];
for (const [id, spec] of Object.entries(manifest.cues)) {
  AudioProbe.instances = [];
  const audio = createCombatAudio({ AudioCtor: AudioProbe });
  const requestedVolume = HMH_WEAPON_SFX[id]?.gain ?? (spec.runtimeCue === 'reload-complete' ? .18 : .14);
  const played = audio.play(spec.runtimeCue, { now: 1000, volume: requestedVolume });
  assert.equal(played.played, true, `${spec.runtimeCue}: ${played.reason}`);
  const voice = AudioProbe.instances.at(-1);
  const { bytes, data } = decode(voice.src);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), spec.sha256, `${id}: runtime path does not match manifest`);
  const peak = peakOf(data);
  const oversampledPeak = reconstructedPeak(data);
  assert.ok(peak <= .781 && oversampledPeak < .9, `${id}: sample peak ${peak}, reconstructed peak ${oversampledPeak}`);
  assert.ok(rms(data) > .02, `${id}: nearly silent`);
  samples.set(voice.src, data);
  rows.push({ id, runtimeCue: spec.runtimeCue, sha256: spec.sha256, bytes: bytes.length,
    durationMs: spec.durationMs, peak: rounded(peak), reconstructedPeak4x: rounded(oversampledPeak),
    rms: rounded(rms(data)), routedVolume: voice.volume, routedRms: rounded(rms(data)*voice.volume) });
  audio.destroy();
}

function wav(data, target) {
  assert.ok(peakOf(data) < 1, 'audition must not hard clip');
  const bytes = Buffer.alloc(44 + data.length*2);
  bytes.write('RIFF'); bytes.writeUInt32LE(36 + data.length*2, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate*2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(data.length*2, 40);
  data.forEach((sample, index) => bytes.writeInt16LE(Math.round(sample*32767), 44 + index*2));
  writeFileSync(target, bytes);
}

// A deterministic dense combat mix, with real registry cooldowns, routing,
// gains, ended events and priority stealing. No gameplay state is changed.
const schedule = [];
for (let i = 0; i < 72; i++) {
  schedule.push({ at: i*83, cue: 'hmh-fire-auto-miner', volume: HMH_WEAPON_SFX['hmh-fire-auto-miner'].gain });
  schedule.push({ at: i*83+45, cue: 'enemy-hit', volume: .09 });
}
for (const at of [300, 1800, 3600, 5200]) schedule.push({ at, cue: 'player-hit', volume: .14 });
for (const at of [800, 2200, 4300]) schedule.push({ at, cue: 'grenade-boom', volume: .16 });
schedule.push({ at: 1200, cue: 'health-pickup', volume: .16 }, { at: 2500, cue: 'berserk-activate', volume: .16 },
  { at: 5500, cue: 'upgrade-pick', volume: .13 });
schedule.sort((a, b) => a.at - b.at);
AudioProbe.instances = [];
const audio = createCombatAudio({ AudioCtor: AudioProbe });
let maxVoices = 0;
for (const event of schedule) {
  AudioProbe.now = event.at;
  for (const voice of AudioProbe.instances) {
    if (!voice.ended && voice.startedAt + samples.get(voice.src).length / rate * 1000 <= event.at) {
      voice.ended = true;
      voice.onended?.();
    }
  }
  audio.play(event.cue, { now: event.at, volume: event.volume });
  maxVoices = Math.max(maxVoices, audio.status().activeVoices);
}
const mix = new Float64Array(rate * 8);
for (const voice of AudioProbe.instances) {
  const data = samples.get(voice.src);
  const start = Math.round(voice.startedAt / 1000 * rate);
  const count = Math.min(data.length, Math.round((voice.stoppedAt - voice.startedAt) / 1000 * rate));
  for (let i = 0; i < count && start + i < mix.length; i++) mix[start+i] += data[i] * voice.volume;
}
assert.ok(maxVoices <= 16);
assert.equal(audio.status().unknownCues, 0);
const mixPeak = peakOf(mix);
assert.ok(mixPeak < .8, `dense mix leaves insufficient headroom: ${mixPeak}`);
wav(mix, path.join(output, 'action-combat-mix.wav'));
audio.destroy();

const order = ['hmh-fire-coin-blaster', 'hmh-fire-scatter-shotgun', 'hmh-fire-auto-miner', 'hmh-fire-launcher-rig',
  'hmh-fire-hash-rail', 'hmh-fire-lightning-ledger', 'hmh-fire-bear-market-burner', 'hmh-fire-forked-standard',
  'hmh-weapon-reload', 'hmh-reload-complete', 'hmh-enemy-hit', 'hmh-player-hit', 'hmh-grenade-boom',
  'hmh-health-pickup', 'hmh-ammo-pickup', 'hmh-time-dilation', 'hmh-berserk', 'hmh-upgrade-pick'];
const audition = new Float64Array(Math.ceil(order.length * 1.4 * rate));
order.forEach((id, index) => {
  const spec = manifest.cues[id];
  const { data } = decode(spec.src);
  const volume = rows.find(row => row.id === id).routedVolume;
  const start = Math.round(index * 1.4 * rate);
  data.forEach((sample, offset) => { audition[start + offset] += sample * volume; });
});
wav(audition, path.join(output, 'action-sfx-audition.wav'));
const report = {
  schema: 'hmh-action-audio-audit-v1', pipelineId: manifest.pipelineId,
  scope: 'Actual routed mono PCM samples and synthetic overlapping combat mix; no music, device or human listening certification.',
  totalBytes: rows.reduce((sum, cue) => sum + cue.bytes, 0), sampleRate: rate, cues: rows,
  denseMix: { attemptedEvents: schedule.length, maxVoices, unknownCues: audio.status().unknownCues,
    peak: rounded(mixPeak), rms: rounded(rms(mix)), clippedSamples: 0, file: 'action-combat-mix.wav' },
  audition: { file: 'action-sfx-audition.wav', cueSpacingSeconds: 1.4, gain: 'actual routed volume; no normalization', order },
};
writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'pass', output, cues: rows.length, totalBytes: report.totalBytes,
  peak: Math.max(...rows.map(row => row.peak)), reconstructedPeak4x: Math.max(...rows.map(row => row.reconstructedPeak4x)), denseMix: report.denseMix }, null, 2));
