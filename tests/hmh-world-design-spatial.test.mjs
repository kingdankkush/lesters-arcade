import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuthoredPropAtlasIndex, createAuthoredPropDisplay, buildAuthoredWorldPropPlacements, buildAuthoredDistrictLandmarkPlacements, buildAuthoredEncampmentPlacements, buildAuthoredTownPlacements } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';
class Point {set(x,y=x){this.x=x;this.y=y;}}
class Container {constructor(){this.children=[];this.position=new Point();this.scale=new Point();this.visible=true;}addChild(...c){this.children.push(...c);}removeChild(c){this.children=this.children.filter(x=>x!==c);}}
class Sprite {constructor(o){Object.assign(this,o);this.anchor=new Point();this.position=new Point();this.scale=new Point();this.skew=new Point();}destroy(){}}
class Graphics {clear(){return this;}circle(){return this;}fill(){return this;}stroke(){return this;}}
class Texture {constructor(o){Object.assign(this,o);}}
class Rectangle {constructor(x,y,w,h){Object.assign(this,{x,y,width:w,height:h});}}
const metadata=JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json',import.meta.url)));
const index=createAuthoredPropAtlasIndex(metadata);
export const placements=[...buildAuthoredWorldPropPlacements({worldId:world.id,seed:7}),...buildAuthoredDistrictLandmarkPlacements({worldId:world.id}),...buildAuthoredEncampmentPlacements({worldId:world.id}),...buildAuthoredTownPlacements({worldId:world.id,index})];
export function makeDisplay(staticWorld=false){return createAuthoredPropDisplay({index,placements,atlasTexture:{source:{}},ContainerClass:Container,SpriteClass:Sprite,GraphicsClass:Graphics,TextureClass:Texture,RectangleClass:Rectangle,staticWorld});}
const signature=display=>display.entries.filter(e=>e.sprite.visible).map(e=>({id:e.placement.id,x:e.sprite.position.x,y:e.sprite.position.y,sx:e.sprite.scale.x,sy:e.sprite.scale.y}));
test('spatial candidates preserve every visible prop across zoom, height, shake and camera jumps',()=>{
  const full=makeDisplay(),indexed=makeDisplay(true),queryGround=createLevelOneGroundQuery();
  for(const zoom of [.4,1,2.112]) for(let x=300;x<12000;x+=810) {
    const camera={x,y:700+(x*3%3400),zoom,groundZ:x>2000&&x<3600?64:0,shakeX:7,shakeY:-9};
    const view={width:x%2?390:1440,height:844};
    const args={camera,view,worldToScreen,queryGround,tick:97};
    full.render(args); indexed.render(args);
    assert.deepEqual(signature(indexed),signature(full));
  }
});
test('static-world culling avoids most prop work and ground queries after warm-up without fog',()=>{
  const display=makeDisplay(true);let calls=0;
  const query=createLevelOneGroundQuery(),queryGround=(x,y)=>{calls++;return query(x,y);};
  const args={camera:{x:800,y:2400,zoom:1,groundZ:0,shakeX:0,shakeY:0},view:{width:1440,height:900},worldToScreen,queryGround};
  display.render(args);calls=0;
  const report=display.render({...args,tick:1});
  assert.ok(report.candidateCount < placements.length/3,`${report.candidateCount}/${placements.length}`);
  assert.equal(calls,0);
});
test('adding, collecting and removing a runtime prop invalidate candidate membership safely',()=>{
  const display=makeDisplay(true),queryGround=createLevelOneGroundQuery();
  const args={camera:{x:800,y:2400,zoom:1,shakeX:0,shakeY:0},view:{width:1440,height:900},worldToScreen,queryGround};
  display.render(args);
  display.addPlacement({id:'dynamic-world-test',assetId:'salvage-crate',x:800,y:2400,category:'environment'});
  display.render(args);assert.ok(signature(display).some(p=>p.id==='dynamic-world-test'));
  display.render({...args,hiddenPlacementIds:new Set(['dynamic-world-test'])});assert.ok(!signature(display).some(p=>p.id==='dynamic-world-test'));
  display.removePlacement('dynamic-world-test');display.render(args);assert.ok(!signature(display).some(p=>p.id==='dynamic-world-test'));
});
test('measurement: static prop rendering before and after spatial candidate selection',t=>{
  const queryGround=createLevelOneGroundQuery(),view={width:1440,height:900};
  const samples={full:[],indexed:[]},counts={full:0,indexed:0};
  for(let repeat=0;repeat<5;repeat++) for(const mode of repeat%2?['indexed','full']:['full','indexed']) {
    const display=makeDisplay(mode==='indexed');
    const frame=i=>({camera:{x:800+(i%6)*2000,y:2400,zoom:1,groundZ:0,shakeX:0,shakeY:0},view,worldToScreen,queryGround,tick:i});
    for(let i=0;i<60;i++) display.render(frame(i));
    const start=performance.now();
    for(let i=0;i<1000;i++) counts[mode]+=display.render(frame(i)).candidateCount;
    samples[mode].push(performance.now()-start);
  }
  const median=a=>[...a].sort((a,b)=>a-b)[2];
  t.diagnostic(JSON.stringify({scope:'Node CPU prop projection; no GPU/frame-rate or physical-device claim',placements:placements.length,samples,medianMs:{full:median(samples.full),indexed:median(samples.indexed)},meanCandidates:{full:counts.full/5000,indexed:counts.indexed/5000},reduction:1-median(samples.indexed)/median(samples.full)}));
});
