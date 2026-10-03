import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMAdapter,Container} from 'pixi.js';
import {createLivingJourneyView} from '../apps/stacked/src/render/luminous-journey-view.mjs';
import {defaultStackedSettings} from '../apps/portal/src/stacked-player-settings.mjs';
import {boardPulseAmplitude} from '../apps/stacked/src/render/board-pulse.mjs';

// Exercise real Pixi program/shader/mesh disposal without a GPU or browser.
// The shader system seam records programs rather than compiling native GL.
DOMAdapter.set({...DOMAdapter.get(),createCanvas:()=>({getContext:()=>null})});
const setup=()=>{
  const layer=new Container(),programs=[];
  const renderer={gl:{LINK_STATUS:1,getProgramParameter:()=>true},shader:{
    bind(shader){programs.push(shader.glProgram);},
    _getProgramData:()=>({program:{}}),resetState(){},
  }};
  return {layer,renderer,programs};
};

test('repeated desktop/mobile rebuilds reuse one cached program and release owned visuals',()=>{
  const {layer,renderer,programs}=setup();
  for(let i=0;i<20;i++){
    const view=createLivingJourneyView({layer,renderer,mobile:i%2===1});
    const mesh=view.resources.root,shader=mesh.shader,geometry=mesh.geometry;
    assert.equal(layer.children.length,1);
    view.destroy();view.destroy();
    assert.equal(layer.children.length,0);
    assert.equal(mesh.destroyed,true);
    assert.equal(shader.glProgram,null);
    assert.equal(geometry.buffers,null);
  }
  assert.equal(new Set(programs).size,1);
  assert.ok(programs[0].vertex&&programs[0].fragment,'shared source remains valid for later views');
  layer.destroy();
});

test('new material passes live availability to the gentle board glow and expires it',()=>{
  const {layer,renderer}=setup(),view=createLivingJourneyView({layer,renderer});
  const settings=defaultStackedSettings();
  view.audio({available:true,bass:900,high:900,level:900,bpm:1200},0);
  view.draw({now:0,lines:0,width:414,height:896,settings});
  const live=view.draw({now:100,lines:0,width:414,height:896,settings});
  assert.equal(live.name,live.sceneName);
  assert.ok(typeof live.name==='string'&&live.name.length>0,'HUD receives a real scene label');
  assert.equal(live.signals.available,true);
  assert.equal(live.signals.beat,0,'default reduced flashes suppresses beat onset');
  assert.ok(boardPulseAmplitude(live.signals,settings).frame>0);
  const stale=view.draw({now:600,lines:0,width:414,height:896,settings});
  assert.equal(stale.signals.available,false);
  assert.equal(boardPulseAmplitude(stale.signals,settings).frame,0);
  settings.accessibility.reduceMotion=true;
  assert.equal(boardPulseAmplitude(view.draw({now:700,width:414,height:896,settings}).signals,settings).frame,0);
  view.destroy();layer.destroy();
});
