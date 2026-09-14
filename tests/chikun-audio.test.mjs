import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createChikunAudio } from '../apps/chikun/src/audio.mjs';

test('Chikun flight audio excludes the repeating white-noise ambience cue', async () => {
  const source = await readFile(new URL('../apps/chikun/src/audio.mjs', import.meta.url), 'utf8');
  assert.match(source, /const CUES=\['flap','launch','coin','near','pass','streak','impact'\]/);
  assert.doesNotMatch(source, /\bwind\b/);
  assert.doesNotMatch(source, /buffers\.has\('air'\)/);
  assert.match(source, /ambience\(\)\s*\{/);
});

test('Chikun audio ambience seam stays silent while action cues remain playable', async () => {
  const previousFetch = globalThis.fetch;
  const previousAudioContext = globalThis.AudioContext;
  const fetched = [];
  let contextInstance;
  class FakeAudioContext {
    constructor() {
      contextInstance = this;
      this.destination = {};
      this.currentTime = 0;
      this.sources = [];
    }
    createGain() {
      return {
        gain: { value: 0, setTargetAtTime() {} },
        connect(target) { return target; },
        disconnect() {},
      };
    }
    createBufferSource() {
      const source = {
        buffer: null,
        playbackRate: { value: 1 },
        onended: null,
        connect(target) { return target; },
        start() { this.started = true; },
        stop() {},
        disconnect() {},
      };
      this.sources.push(source);
      return source;
    }
    async resume() {}
    async decodeAudioData() { return {}; }
    async close() {}
  }
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  globalThis.AudioContext = FakeAudioContext;
  try {
    const audio = createChikunAudio();
    await audio.unlock();
    assert.equal(fetched.length, 7);
    assert.ok(fetched.every((url) => !url.endsWith('/air.wav')));
    assert.equal(audio.play('flap'), true);
    const sourcesAfterActionCue = contextInstance.sources.length;
    audio.ambience(true);
    assert.equal(contextInstance.sources.length, sourcesAfterActionCue);
    audio.dispose();
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.AudioContext = previousAudioContext;
  }
});
