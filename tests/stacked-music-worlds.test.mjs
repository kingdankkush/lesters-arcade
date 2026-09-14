import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicMotion } from '../apps/stacked/src/render/music-motion.mjs';
import { createMusicWorld } from '../apps/stacked/src/render/music-worlds.mjs';
import { defaultStackedSettings, readStackedSettings, saveStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';
import { validateStackedBridgeSettings, validateStackedBridgeMessage } from '../apps/portal/src/stacked-bridge-protocol.mjs';
import { createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';

test('all music world choices and intensity survive storage and the parent bridge', () => {
  let raw; const storage = { setItem(k,v) { raw=v; }, getItem() { return raw; } };
  for (const visualizer of ['journey','living','aurora','orbit','spectrum']) {
    const settings = defaultStackedSettings(); settings.video.visualizer = visualizer; settings.video.effectsIntensity = 0.35;
    settings.audio.sfxVolume = 0.2;
    saveStackedSettings(storage, settings);
    const restored = readStackedSettings(storage);
    assert.equal(restored.video.visualizer, visualizer); assert.equal(restored.video.effectsIntensity, 0.35); assert.equal(restored.audio.sfxVolume, 0.2);
    assert.equal(validateStackedBridgeSettings(restored), true);
    const payload = { reduceMotion:false,reducedEffects:false,audioReactive:true,ghostPiece:true,gridLines:true,sfxEnabled:true,visualizer,effectsIntensity:0.35,sfxVolume:0.2,colorblindPieces:true };
    assert.equal(validateStackedBridgeMessage({protocol:'stacked-bridge/v1',type:'game:preferences-request',sessionId:'test-session',messageId:'game-1',payload}).ok,true);
  }
  raw = JSON.stringify({video:{visualizer:'unknown',effectsIntensity:99},audio:{sfxVolume:-1}});
  const safe=readStackedSettings(storage); assert.equal(safe.video.visualizer,'journey'); assert.equal(safe.video.effectsIntensity,0.7); assert.equal(safe.audio.sfxVolume,0.35);
});

test('audio envelopes are bounded, frame-rate independent, and decay after audio loss', () => {
  const sample = rate => {
    const motion = createMusicMotion(); motion.update(0, false);
    for (let i=1;i<=rate;i++) { motion.audio({available:true,bass:800,level:500,high:300,onset:false},i*1000/rate); motion.update(i*1000/rate,false); }
    return motion;
  };
  const a=sample(30), b=sample(120);
  assert(Math.abs(a.state.bass-b.state.bass)<0.002);
  a.update(3000,false); for(let t=3000;t<6000;t+=16) a.update(t,false);
  assert.equal(a.state.available,false); assert(a.state.bass<0.06);
  a.audio({available:true,bass:NaN,high:Infinity,level:-9,onset:true},6000); a.update(6000,false);
  assert(Object.values(a.state).every(v=>typeof v!=='number'||Number.isFinite(v)));
});

test('one onset is consumed once, reduced motion is still, and resume does not jump', () => {
  const m=createMusicMotion(); m.update(0,false); m.audio({available:true,bass:700,level:400,high:200,onset:true},16);
  m.update(16,false); const beat=m.state.beat; m.update(116,false); assert(m.state.beat<beat);
  const time=m.state.time; m.update(100000,false); assert(m.state.time-time<=0.101);
  m.update(100016,true); assert.equal(m.state.beat,0); assert.equal(m.state.time,0);
});

test('world geometry stays bounded through clears, resizes and every effects mode', () => {
  for(const mode of ['aurora','orbit','spectrum']) {
    const world=createMusicWorld(); let buffer;
    for(let i=0;i<600;i++) {
      const state=world.update({mode,time:i/60,width:i%2?600:1600,height:900,minimal:i%3===0,reducedMotion:false,bass:.8,high:.5,level:.5,beat:.7,clear:i%50===0?1:0,impact:.2,combo:4,danger:.5,generation:Math.floor(i/50)});
      assert(state.count<=192); buffer ??=state.x; assert.equal(state.x,buffer);
      for(let p=0;p<state.count;p++) {assert(Number.isFinite(state.x[p])&&Number.isFinite(state.y[p]));assert(Math.abs(state.x[p])<= (i%2?600:1600)*.5);assert(Math.abs(state.y[p])<=450);}
    }
    const config={mode,time:1,width:600,height:900,minimal:false,reducedMotion:true,bass:.9,high:.6,level:.8,beat:1,clear:1,impact:1,combo:4,danger:.5,generation:2};
    const first=world.update(config); const x=Array.from(first.x), y=Array.from(first.y);
    world.update({...config,time:900,bass:.1,beat:0}); assert.deepEqual(Array.from(first.x),x); assert.deepEqual(Array.from(first.y),y);
  }
});

test('different music worlds cannot change canonical simulation or replay results', () => {
  let expected;
  for(const mode of ['aurora','orbit','spectrum']) {
    const runtime=createStackedRuntime({seed:424242}); const world=createMusicWorld();
    while(!runtime.terminal) {
      const s=runtime.snapshot(); world.update({mode,time:s.tick/60,width:1440,height:900,bass:mode==='aurora'?.8:0,high:.4,level:.3,beat:.2,clear:0,impact:0,combo:0,danger:0,generation:0});
      runtime.step(s.tick%2===0?8:0);
    }
    expected ??=runtime.result(); assert.deepEqual(runtime.result(),expected);
  }
});
