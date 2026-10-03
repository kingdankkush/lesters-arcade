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

test('retained fallback voices use the same mute and volume master as sampled cues',async()=>{
 const previousFetch=globalThis.fetch,previousContext=globalThis.AudioContext;let context;
 class Context{
  constructor(){context=this;this.currentTime=0;this.destination={};this.gains=[];this.oscillators=[];}
  createGain(){const n={gain:{value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},exponentialRampToValueAtTime(){},cancelScheduledValues(){}},connect(target){this.target=target;return target;},disconnect(){}};this.gains.push(n);return n;}
  createOscillator(){const n={frequency:{value:0},addEventListener(){},connect(target){this.target=target;return target;},start(){this.started=true;},stop(){},disconnect(){}};this.oscillators.push(n);return n;}
  async resume(){}async close(){}
 }
 globalThis.fetch=async()=>({ok:false});globalThis.AudioContext=Context;
 try{
  const audio=createChikunAudio();audio.setVolume(.4);await audio.unlock();assert.equal(audio.playLegacyTone(560,.08,.035,'triangle',1),true);
  const master=context.gains[0];assert.ok(Math.abs(master.gain.value-.26)<1e-9);assert.equal(context.gains[1].target,master);
  audio.setEnabled(false);assert.equal(master.gain.value,0);assert.equal(audio.playLegacyTone(560),false);assert.equal(context.oscillators.length,1);
  audio.setEnabled(true);audio.setVolume(0);assert.equal(master.gain.value,0);assert.equal(audio.playLegacyTone(560),false);
  audio.setVolume(1);assert.equal(master.gain.value,.65);assert.equal(audio.playLegacyTone(560),true);audio.dispose();assert.equal(audio.playLegacyTone(560),false);
 }finally{globalThis.fetch=previousFetch;globalThis.AudioContext=previousContext;}
});
