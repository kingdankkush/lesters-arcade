import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STACKED_SFX_COMPRESSOR, createStackedSoundEffects, stackedSfxPitch, stackedSfxTimbre } from '../apps/stacked/src/sound-effects.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

// A Web Audio double that records the graph: every node, its type, its
// parameter automation and its connections.
function audioDouble() {
  const nodes = [];
  const param = () => { const events = []; return { events, setValueAtTime(value, time) { events.push(['set', value, time]); }, exponentialRampToValueAtTime(value, time) { events.push(['ramp', value, time]); } }; };
  const node = (kind, extra = {}) => {
    const n = { kind, out: [], disconnected: false, connect(target) { this.out.push(target); return target; }, disconnect() { this.disconnected = true; }, start() {}, stop() {}, ...extra };
    nodes.push(n); return n;
  };
  const context = {
    currentTime: 0, sampleRate: 8000, state: 'running', destination: { kind: 'destination' },
    resume: async () => {}, close: async () => {},
    createOscillator: () => node('osc', { frequency: param(), type: '' }),
    createGain: () => node('gain', { gain: param() }),
    createBiquadFilter: () => node('filter', { frequency: param(), Q: param(), type: '' }),
    createBufferSource: () => node('noise', { buffer: null }),
    createBuffer: (channels, length) => { const data = new Float32Array(length); return { getChannelData: () => data }; },
    createDynamicsCompressor: () => node('compressor', Object.fromEntries(Object.keys(STACKED_SFX_COMPRESSOR).map(key => [key, param()]))),
  };
  return { context, nodes };
}
const on = (volume = .8) => { const settings = defaultStackedSettings(); settings.audio.sfxEnabled = true; settings.audio.sfxVolume = volume; return settings; };

test('every voice runs through one master compressor with the tuned settings', () => {
  const { context, nodes } = audioDouble();
  const sfx = createStackedSoundEffects({ contextFactory: () => context });
  sfx.play('lock', on()); context.currentTime += 1; sfx.play('halving', on());
  const compressors = nodes.filter(n => n.kind === 'compressor');
  assert.equal(compressors.length, 1, 'one shared master bus');
  const [master] = compressors;
  assert.deepEqual(Object.fromEntries(Object.keys(STACKED_SFX_COMPRESSOR).map(key => [key, master[key].events[0][1]])), { threshold: -16, knee: 10, ratio: 3.5, attack: .003, release: .22 });
  assert.deepEqual(master.out, [context.destination]);
  const gains = nodes.filter(n => n.kind === 'gain');
  assert.ok(gains.length >= 6 && gains.every(g => g.out.length === 1 && g.out[0] === master), 'nothing bypasses the compressor');
  sfx.destroy();
  assert.ok(nodes.every(n => n.disconnected), 'teardown disconnects every voice and the master');
});

test('lock, clear, combo and HALVING get distinct two-primitive timbres; combos climb in pitch', () => {
  const timbres = ['lock', 'single', 'combo', 'halving'].map(cue => stackedSfxTimbre(cue));
  assert.equal(new Set(timbres.map(t => `${t.wave}:${t.noise}:${t.noiseHz}`)).size, 4);
  assert.ok(timbres.every(t => t.noise), 'each pairs a tone with filtered noise');
  assert.equal(stackedSfxPitch('lock', 5), 1, 'only clears climb');
  assert.equal(stackedSfxPitch('single', 0), 1);
  assert.ok(Math.abs(stackedSfxPitch('combo', 3) - 2 ** (3 / 12)) < 1e-12);
  assert.equal(stackedSfxPitch('combo', 40), 2 ** (10 / 12), 'the climb is capped');
  const { context, nodes } = audioDouble();
  const sfx = createStackedSoundEffects({ contextFactory: () => context });
  sfx.play('combo', on(), 0); const low = nodes.filter(n => n.kind === 'osc')[0].frequency.events[0][1];
  context.currentTime += 1; sfx.play('combo', on(), 4);
  const high = nodes.filter(n => n.kind === 'osc').at(-2).frequency.events[0][1];
  assert.ok(Math.abs(high / low - 2 ** (4 / 12)) < 1e-9);
  assert.deepEqual(nodes.filter(n => n.kind === 'filter').map(f => f.type), ['bandpass', 'bandpass']);
});

test('the one Game sounds slider scales and silences every primitive', () => {
  const peaks = volume => {
    const { context, nodes } = audioDouble();
    createStackedSoundEffects({ contextFactory: () => context }).play('halving', on(volume));
    return nodes.filter(n => n.kind === 'gain').map(g => g.gain.events.find(event => event[0] === 'ramp')[1]);
  };
  const loud = peaks(1), quiet = peaks(.5);
  assert.equal(loud.length, 5, 'four tones and one noise burst');
  loud.forEach((peak, index) => assert.ok(Math.abs(quiet[index] - peak / 2) < 1e-12));
  const { context, nodes } = audioDouble();
  createStackedSoundEffects({ contextFactory: () => context }).play('halving', on(0));
  assert.equal(nodes.length, 0);
});

test('game sounds load lazily and read the combo from the committed step', () => {
  const main = readFileSync(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /^import .*sound-effects/m);
  assert.match(main, /import\('\.\/sound-effects\.mjs'\)/);
  assert.match(main, /sfx\.play\(soundForStep\(before, s\), settings, s\.comboCount\)/);
});
