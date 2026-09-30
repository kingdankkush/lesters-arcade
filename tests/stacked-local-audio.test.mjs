import test from 'node:test';
import assert from 'node:assert/strict';
import {createStackedMatch} from '../apps/portal/src/stacked-match.mjs';
const module=import('../apps/stacked/src/local-audio.mjs').catch(()=>null);
const makeMatch=()=>createStackedMatch({seed:77,playerConfigs:[{},{}]});
const state=(match,phase='running')=>({phase,match:match.snapshot()});
const double=()=>({calls:[],stops:0,closes:0,play(cue,settings,combo){this.calls.push({cue,settings:structuredClone(settings),combo});},stop(){this.stops++;},destroy(){this.closes++;}});
async function setup(options={}){const m=await module;assert.ok(m,'local presentation audio module exists');const sound=options.sound??double();return{sound,audio:m.createLocalStackedAudio({sound,...options})};}

test('first snapshot is silent; real successful drops from either board use the existing cue',async()=>{
 const {audio,sound}=await setup(),match=makeMatch();audio.present(state(match));assert.equal(sound.calls.length,0);
 match.stepAll(Uint8Array.of(8,0));const before=JSON.stringify(match.snapshot());audio.present(state(match));
 assert.equal(sound.calls[0].cue,'drop');assert.equal(sound.calls.length,1);assert.equal(JSON.stringify(match.snapshot()),before);
 match.stepAll(Uint8Array.of(0,8));audio.present(state(match));assert.equal(sound.calls[1].cue,'drop');assert.equal(sound.calls.length,2);
 assert.equal(sound.calls[1].settings.audio.sfxVolume,.35);
});
test('repeated renders, normal gravity and reset do not replay stale cues',async()=>{
 const {audio,sound}=await setup(),match=makeMatch();audio.present(state(match));match.stepAll(Uint8Array.of(8,0));audio.present(state(match));audio.present(state(match));
 assert.equal(sound.calls.length,1);match.stepAll(Uint8Array.of(0,0));audio.present(state(match));assert.equal(sound.calls.length,1);
 audio.reset();audio.present(state(makeMatch()));assert.equal(sound.calls.length,1);assert.equal(sound.stops,1);
});
test('both boards can contribute a different cue in one frame without mutating a frozen snapshot',async()=>{
 const {audio,sound}=await setup(),match=makeMatch();audio.present(state(match));match.stepAll(Uint8Array.of(8,128));
 const s=state(match),before=JSON.stringify(s);Object.freeze(s.match.boards[0]);Object.freeze(s.match.boards[1]);Object.freeze(s.match.boards);Object.freeze(s.match);Object.freeze(s);
 audio.present(s);assert.deepEqual(sound.calls.map(c=>c.cue),['drop','hold']);assert.equal(JSON.stringify(s),before);
});
test('paused and ready observations are silent; terminal transition can sound only once',async()=>{
 const {audio,sound}=await setup(),match=makeMatch();audio.present(state(match,'ready'));match.stepAll(Uint8Array.of(8,0));audio.present(state(match,'paused'));assert.equal(sound.calls.length,0);
 for(let i=0;i<100&&!match.terminal;i++){match.stepAll(Uint8Array.of(i%2?0:8,0));audio.present(state(match,match.terminal?'complete':'running'));}
 assert.equal(match.terminal,true);assert.equal(sound.calls.filter(c=>c.cue==='terminal').length,1);audio.present(state(match,'complete'));assert.equal(sound.calls.filter(c=>c.cue==='terminal').length,1);
});
test('muted events advance the baseline and cannot burst on unmute',async()=>{
 const {audio,sound}=await setup({volume:0}),match=makeMatch();audio.present(state(match));match.stepAll(Uint8Array.of(8,0));audio.present(state(match));audio.unlock();assert.equal(sound.calls.length,0);
 audio.setVolume(.6);audio.present(state(match));assert.equal(sound.calls.length,0);match.stepAll(Uint8Array.of(0,8));audio.present(state(match));assert.equal(sound.calls.length,1);assert.equal(sound.calls[0].settings.audio.sfxVolume,.6);
 audio.setVolume(0);assert.equal(sound.stops,1);
});
test('gesture unlock is explicit; volume clamps and invalid input silences safely',async()=>{
 const {audio,sound}=await setup();audio.unlock();assert.equal(sound.calls[0].cue,'menu');
 audio.setVolume(4);audio.unlock();assert.equal(sound.calls[1].settings.audio.sfxVolume,1);
 for(const volume of [NaN,Infinity,-1,'0.5']){audio.setVolume(volume);audio.unlock();}assert.equal(sound.calls.length,2);
});
test('pause/reset and repeated disposal stop audio, and disposed callbacks allocate nothing',async()=>{
 const {audio,sound}=await setup(),match=makeMatch();audio.present(state(match));audio.stop();assert.equal(sound.stops,1);audio.destroy();audio.destroy();assert.equal(sound.closes,1);
 audio.unlock();audio.setVolume(1);audio.reset();match.stepAll(Uint8Array.of(8,0));audio.present(state(match));assert.equal(sound.calls.length,0);assert.equal(sound.stops,1);
});
test('an unavailable audio device cannot interrupt presentation or alter the match',async()=>{
 const sound={play(){throw Error('unavailable');},stop(){throw Error('unavailable');},destroy(){throw Error('unavailable');}}, {audio}=await setup({sound}),match=makeMatch();
 audio.present(state(match));match.stepAll(Uint8Array.of(8,0));const before=JSON.stringify(match.snapshot());
 assert.doesNotThrow(()=>{audio.present(state(match));audio.unlock();audio.stop();audio.setVolume(0);audio.reset();audio.destroy();});assert.equal(JSON.stringify(match.snapshot()),before);
});
