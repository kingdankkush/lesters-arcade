import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayFeedback } from '../apps/stacked/src/render/gameplay-feedback.mjs';
import { stackedSoundForStep, createStackedSoundEffects } from '../apps/stacked/src/sound-effects.mjs';
import { createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

test('gameplay feedback fires once per event, decays, and resets on practice rewind',()=>{
  const f=createGameplayFeedback(), s=createStackedRuntime({seed:1}).snapshot();
  f.update(s,0); const clear={...s,tick:2,lines:4,score:800,piecesLocked:1,combo:1};
  assert.equal(f.update(clear,16).label,'HALVING'); assert.equal(f.state.generation,1);
  for(let t=32;t<4000;t+=16) f.update(clear,t);
  assert(f.state.clear<.01); assert.equal(f.state.generation,1);
  f.update(s,4001); assert.equal(f.state.label,''); assert.equal(f.state.clear,0);
  f.update(clear,4016,true); assert.equal(f.state.clear,0); assert.equal(f.state.label,'HALVING');
});
test('sound uses successful canonical changes and gives clear cues priority',()=>{
  const s=createStackedRuntime({seed:1}).snapshot();
  assert.equal(stackedSoundForStep(s,s),null);
  assert.equal(stackedSoundForStep(s,{...s,active:{...s.active,rotation:1}}),'rotate');
  assert.equal(stackedSoundForStep(s,{...s,holdsUsed:1}),'hold');
  assert.equal(stackedSoundForStep(s,{...s,piecesLocked:1,hardDropCells:20}),'drop');
  assert.equal(stackedSoundForStep(s,{...s,piecesLocked:1,hardDropCells:20,lines:4}),'halving');
  assert.equal(stackedSoundForStep(s,{...s,terminal:true}),'terminal');
});
test('sound voices are capped, muted cues allocate nothing and teardown disconnects all nodes',()=>{
  const nodes=[]; let closes=0;
  const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>{const n={connect(){},disconnect(){this.disconnected=true;},stop(){},start(){},frequency:param(),gain:param()}; nodes.push(n); return n;};
  const context={currentTime:0,state:'running',destination:{},resume:async()=>{},close:async()=>{closes++;},createOscillator:node,createGain:node};
  const sfx=createStackedSoundEffects({contextFactory:()=>context}); const settings=defaultStackedSettings();
  settings.audio.sfxEnabled=false; sfx.play('halving',settings); assert.equal(nodes.length,0);
  settings.audio.sfxEnabled=true;
  for(let i=0;i<100;i++) {context.currentTime+=.01;sfx.play('halving',settings);assert(sfx.activeVoices<=8);}
  sfx.destroy(); assert.equal(sfx.activeVoices,0); assert(nodes.every(n=>n.disconnected)); assert.equal(closes,1);
  sfx.play('drop',settings); assert.equal(sfx.activeVoices,0);
});
