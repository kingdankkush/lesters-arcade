import test from 'node:test';
import assert from 'node:assert/strict';
import { createStackedAudioSampler, spectrumFrame } from '../apps/portal/src/stacked-audio.mjs';
test('audio bands are bounded and reflect low/high frequency energy', () => {
  const bytes = new Uint8Array(1024); bytes.fill(255, 0, 10);
  const frame = spectrumFrame(bytes, 48000, 2048, 500);
  assert.equal(frame.sub, 1000); assert.equal(frame.high, 0);
  assert.ok(Object.values(frame).every(v => typeof v !== 'number' || Number.isFinite(v)));
});
test('one permanent audio source serves repeated sampler mounts without disconnecting music', async () => {
  let sources = 0, connected = 0, resumed = 0;
  const media = { paused: false, addEventListener() {} };
  const contextFactory = () => ({
    sampleRate: 48000, state: 'running', destination: {},
    resume() { resumed++; return Promise.resolve(); },
    createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData(bytes) { bytes.fill(128); } }; },
    createMediaElementSource() { sources++; return { connect() { connected++; } }; },
  });
  const first = createStackedAudioSampler(media, { contextFactory });
  const second = createStackedAudioSampler(media, { contextFactory });
  await Promise.all([first.resume(), second.resume()]);
  assert.equal(sources, 1); assert.equal(connected, 2);
  assert.equal(first.sample(1).available, true); assert.equal(second.sample(2).available, true);
});
test('blocked audio activation never reroutes already audible music into a suspended context', async () => {
  let sources = 0;
  const context = {
    state: 'suspended', destination: {}, sampleRate: 48000,
    resume: async () => {},
    createAnalyser: () => ({ frequencyBinCount: 1024 }),
    createMediaElementSource: () => { sources++; return { connect() {} }; },
  };
  const sampler = createStackedAudioSampler({ paused: false, addEventListener() {} }, { contextFactory: () => context });
  await sampler.resume();
  assert.equal(sources, 0); assert.equal(sampler.sample(1), null);
  context.state = 'running'; await sampler.resume();
  assert.equal(sources, 1);
});
