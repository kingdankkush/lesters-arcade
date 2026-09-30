import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivingJourneyView } from '../apps/stacked/src/render/living-journey-view.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';
import {Container as Node,Graphics,Text} from './lib/stacked-pixi-test-fixture.mjs';
const setup=mobile=>{const layer=new Node();const view=createLivingJourneyView({layer,Container:Node,Graphics,Text,mobile});return{layer,view,settings:defaultStackedSettings()};};
const frame=(view,settings,now,extra={})=>view.draw({now,width:900,height:700,tick:0,lines:0,settings,feedback:{combo:0,danger:0},...extra});
test('fixed renderer pools hold bounded nodes through automatic scenes and portal events',()=>{
  for(const mobile of[false,true]){const{layer,view,settings}=setup(mobile);const count=view.resources.nodeCount;assert.ok(count>0&&count<6000);let result;for(let index=0;index<4000;index++)result=frame(view,settings,index*100,{lines:index%1500===0?4:0});assert.equal(view.resources.nodeCount,count);assert.equal(view.resources.actualNodeCount(),count);assert.equal(layer.children.length,1);assert.equal(result.journeyVersion,'living-v1');assert.ok(result.particles<=view.resources.pointCapacity);view.destroy();assert.equal(layer.children.length,0);}
});
test('Matrix glyphs use one fixed green/silver pool and projection remains finite',()=>{
  const{view,settings}=setup(true);let matrix=false;
  for(let index=0;index<4000;index++){const result=frame(view,settings,index*100);if(result.mode==='matrix'){matrix=true;assert.ok(view.resources.glyphs.some(glyph=>glyph.visible));for(const glyph of view.resources.glyphs){assert.ok(Number.isFinite(glyph.position.x)&&Number.isFinite(glyph.position.y));assert.ok(Number.isFinite(glyph.scale.x));}}}
  assert.equal(matrix,true);assert.equal(view.resources.glyphs.length,192);view.destroy();
});
test('portal shows the next scene through a growing clipped aperture behind the board',()=>{
  const{view,settings}=setup(false);for(let i=0;i<=180;i++)frame(view,settings,i*1000/60);
  const result=frame(view,settings,3017,{lines:4});assert.equal(result.phase,'portal');
  assert.equal(view.resources.incoming.mask,view.resources.aperture);assert.equal(view.resources.incoming.visible,true);
  const scale=view.resources.aperture.scale.x;for(let i=1;i<=60;i++)frame(view,settings,3017+i*1000/60,{lines:4});assert.ok(view.resources.aperture.scale.x>scale);view.destroy();
});
test('effects Off hides every visual and reduced motion freezes actual transforms',()=>{
  const{view,settings}=setup(true);frame(view,settings,0);frame(view,settings,17);settings.accessibility.reduceMotion=true;frame(view,settings,34);
  const take=()=>view.resources.points.map(point=>[point.position.x,point.position.y,point.scale.x,point.alpha]);const before=take();
  for(let i=1;i<180;i++)frame(view,settings,34+i*1000/60);assert.deepEqual(take(),before);
  settings.video.effectsIntensity=0;frame(view,settings,3100);assert.equal(view.resources.root.visible,false);view.destroy();
});
test('actual tenths-BPM audio is read without settings mutation or simulation data access',()=>{
  const{view,settings}=setup(false);const original=structuredClone(settings);
  for(let i=0;i<180;i++){const now=i*1000/60;view.audio({available:true,bpm:1800,onset:true},now);frame(view,settings,now);}
  assert.ok(view.state.bpm>170&&view.state.bpm<180);assert.deepEqual(settings,original);
  view.destroy();view.destroy();assert.throws(()=>frame(view,settings,4000),/disposed/);
});

test('portal completion retains the arriving scene instead of resetting its visible atmosphere',()=>{
  let nextId=0;const layer=new Node();
  const view=createLivingJourneyView({layer,Container:Node,Graphics,Text,createAtmosphere:()=>{const id=++nextId;return{audio(){},destroy(){},draw(){return{poolId:id,particles:0,signals:{},palette:{}};}}}});
  const settings=defaultStackedSettings();frame(view,settings,0);for(let i=1;i<=180;i++)frame(view,settings,i*1000/60);
  frame(view,settings,3017,{lines:4});let halfway;for(let i=1;i<=75;i++)halfway=frame(view,settings,3017+i*1000/60,{lines:4});
  assert.equal(halfway.poolId,2);const arrivingPoolId=halfway.poolId;let completed;for(let i=76;i<=130;i++)completed=frame(view,settings,3017+i*1000/60,{lines:4});
  assert.equal(completed.phase,'ambient');assert.equal(completed.poolId,arrivingPoolId,'arriving pool must remain visible');view.destroy();
});

test('a second atmosphere construction failure destroys completed and partial pools without touching existing stage children',()=>{
  const layer=new Node(),existing=new Node();layer.addChild(existing);let calls=0,destroyed=0;const owned=[];
  assert.throws(()=>createLivingJourneyView({layer,Container:Node,Graphics,Text,createAtmosphere:({layer:world})=>{const visual=new Graphics();owned.push(visual);world.addChild(visual);if(++calls===2)throw new Error('second pool failed');return{destroy(){destroyed++;visual.destroy();},audio(){},draw(){return{};}};}}),/second pool failed/);
  assert.deepEqual(layer.children,[existing]);assert.equal(existing.destroyed,undefined);assert.equal(destroyed,1);assert.ok(owned.every(node=>node.destroyed));
});
test('a glyph constructor failure rolls back the already constructed atmosphere and glyph pool',()=>{
  const layer=new Node();let calls=0,destroyed=0;const glyphs=[];class FailingText extends Text{constructor(args){if(++calls===12)throw new Error('glyph failed');super(args);glyphs.push(this);}}
  assert.throws(()=>createLivingJourneyView({layer,Container:Node,Graphics,Text:FailingText,createAtmosphere:()=>({destroy(){destroyed++;},audio(){},draw(){return{};}})}),/glyph failed/);
  assert.equal(layer.children.length,0);assert.equal(destroyed,1);assert.ok(glyphs.every(glyph=>glyph.destroyed));
});

test('a later mask drawing failure destroys earlier unattached mask Graphics and contexts',()=>{
  const layer=new Node(),masks=[];let circles=0;class FailingMask extends Graphics{constructor(){super();masks.push(this);}circle(...args){if(++circles===2)throw new Error('mask drawing failed');return super.circle(...args);}}
  assert.throws(()=>createLivingJourneyView({layer,Container:Node,Graphics:FailingMask,Text,createAtmosphere:()=>({audio(){},draw(){return{};},destroy(){}})}),/mask drawing failed/);
  assert.equal(layer.children.length,0);assert.ok(masks.every(mask=>mask.destroyed&&mask.context.destroyed));
});
