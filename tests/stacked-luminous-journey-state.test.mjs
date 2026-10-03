import test from 'node:test';
import assert from 'node:assert/strict';
import {createLuminousJourneyState} from '../apps/stacked/src/render/luminous-journey-state.mjs';
import {defaultStackedSettings} from '../apps/portal/src/stacked-player-settings.mjs';

test('live audio is smoothed and stale audio decays without changing committed inputs',()=>{
  const view=createLuminousJourneyState(),settings=defaultStackedSettings();
  const snapshot=Object.freeze({now:1000,tick:90,lines:0,width:1440,height:900,settings,feedback:Object.freeze({combo:0,danger:0})});
  view.audio({available:true,bass:255,high:180,level:200,beat:255,bpm:1280},1000);
  view.update(snapshot);view.update({...snapshot,now:1100});
  assert.ok(view.frame.bass>0&&view.frame.bass<1);
  const first=view.frame.bass;
  view.update({...snapshot,now:2200});view.update({...snapshot,now:2300});
  assert.ok(view.frame.bass<first);assert.equal(snapshot.tick,90);assert.equal(settings.video.visualizer,'journey');
});
test('reduced motion freezes every shader clock and pulse after preference changes',()=>{
  const view=createLuminousJourneyState(),settings=defaultStackedSettings();
  view.update({now:0,lines:0,width:414,height:896,settings});view.update({now:100,lines:0,width:414,height:896,settings});
  settings.accessibility.reduceMotion=true;view.update({now:200,lines:0,width:414,height:896,settings});
  const time=view.frame.time,distance=view.frame.distance,phase=view.frame.phase;
  view.audio({available:true,bass:255,high:255,level:255,beat:255,bpm:1800},300);
  view.update({now:350,lines:4,width:414,height:896,settings});
  assert.equal(view.frame.time,time);assert.equal(view.frame.distance,distance);assert.equal(view.frame.phase,phase);
  assert.equal(view.frame.bass,0);assert.equal(view.frame.beat,0);
});
test('off disables scene work, malformed audio is finite and automatic portals cycle without playing',()=>{
  const view=createLuminousJourneyState(),settings=defaultStackedSettings();
  view.audio({available:true,bass:NaN,high:Infinity,level:-5,beat:Infinity,bpm:NaN},0);
  for(let i=0;i<480;i++)view.update({now:i*100,lines:0,width:1440,height:900,settings});
  assert.ok(view.frame.transitions>=1);
  for(const value of Object.values(view.frame))if(typeof value==='number')assert.ok(Number.isFinite(value));
  settings.video.effectsIntensity=0;view.update({now:48100,lines:0,width:1440,height:900,settings});
  assert.equal(view.frame.visible,false);
});
test('fixed worlds use the same new material renderer, bounded aspect and quiet flash policy',()=>{
  const view=createLuminousJourneyState(),settings=defaultStackedSettings();
  settings.video.visualizer='aurora';settings.accessibility.reduceFlash=true;
  view.audio({available:true,bass:255,beat:255,high:255,level:255,bpm:1200},0);
  view.update({now:0,lines:0,width:0,height:NaN,settings});view.update({now:100,lines:0,width:1440,height:900,settings});
  assert.equal(view.frame.from,1);assert.equal(view.frame.to,1);assert.equal(view.frame.mix,1);
  assert.equal(view.frame.beat,0);assert.ok(view.frame.energy<=.3);assert.equal(view.frame.aspect,1.6);
});
test('manual scene advance works before any clear and clock rollback creates no jump',()=>{
  const view=createLuminousJourneyState(),settings=defaultStackedSettings();
  view.update({now:1000,settings});view.nextScene();view.update({now:1100,settings});
  assert.equal(view.frame.transitions,1);assert.notEqual(view.frame.from,view.frame.to);
  const time=view.frame.time;view.update({now:500,settings});view.update({now:1100,settings});
  assert.equal(view.frame.time,time);
});
