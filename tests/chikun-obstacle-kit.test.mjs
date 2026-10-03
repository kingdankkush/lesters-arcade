import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChikunObstacleKit,validateChikunObstacleKit,selectChikunObstacleKitTier,sampleChikunObstacleKit} from '../apps/chikun/src/obstacle-kit.mjs';
import {buildCourseObstacle} from '../apps/portal/src/chikun-ground-course.mjs';
import {drawGroundObstacle} from '../apps/chikun/src/ground-world.mjs';
const metadata=JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/chikun-obstacle-kit-v1/manifest.json',import.meta.url)));
test('native obstacle kit bounds decoded memory and uses a phone tier independent of DPR',()=>{
 const spec=validateChikunObstacleKit(metadata);
 assert.equal(selectChikunObstacleKitTier({phone:true,density:3}),'low');assert.equal(selectChikunObstacleKitTier({phone:false,density:2}),'medium');
 for(const tier of ['low','medium'])assert.ok(Object.values(spec.assets).reduce((sum,a)=>sum+a.tiers[tier].width*a.tiers[tier].height*4,0)<(tier==='low'?4:12)*1024*1024);
 assert.throws(()=>validateChikunObstacleKit({...metadata,assets:{...metadata.assets,pipe:{tiers:{low:{file:'../secret.webp',width:8,height:8},medium:{file:'pipe-medium.webp',width:8,height:8}}}}}));
 const oversized=structuredClone(metadata);for(const asset of Object.values(oversized.assets)){asset.frames=8;asset.columns=4;asset.fps=12;for(const sheet of Object.values(asset.tiers)){sheet.width=2048;sheet.height=1024;sheet.frameWidth=512;sheet.frameHeight=512;}}assert.throws(()=>validateChikunObstacleKit(oversized));
});
test('native obstacle loops sample twelve frames per second, wrap and freeze for reduced motion',()=>{
 const native=structuredClone(metadata);const actor=native.assets.drone;actor.frames=8;actor.columns=4;actor.fps=12;
 for(const sheet of Object.values(actor.tiers)){sheet.frameWidth=sheet.frameWidth??sheet.width;sheet.frameHeight=sheet.frameHeight??sheet.height;sheet.width=sheet.frameWidth*4;sheet.height=sheet.frameHeight*2;}
 const spec=validateChikunObstacleKit(native),asset=spec.assets.drone;
 assert.equal(sampleChikunObstacleKit(asset,'low',0,false).frame,0);assert.equal(sampleChikunObstacleKit(asset,'low',5,false).frame,1);assert.equal(sampleChikunObstacleKit(asset,'low',35,false).frame,7);assert.equal(sampleChikunObstacleKit(asset,'low',40,false).frame,0);assert.equal(sampleChikunObstacleKit(asset,'low',35,true).frame,0);
 const crop=sampleChikunObstacleKit(asset,'low',25,false);assert.equal(crop.x,asset.tiers.low.frameWidth);assert.equal(crop.y,asset.tiers.low.frameHeight);
});
test('kit draws six existing obstacle types without mutating canonical snapshots or labels',async()=>{
 const images=[];class FakeImage{constructor(){images.push(this);}async decode(){const a=this.src.match(/([^/]+)-(low|medium)\.webp$/);const t=metadata.assets[a[1]].tiers[a[2]];this.naturalWidth=t.width;this.naturalHeight=t.height;}}
 const view=createChikunObstacleKit({tier:'low',ImageClass:FakeImage,fetchRef:async()=>({ok:true,text:async()=>JSON.stringify(metadata)})});assert.equal(await view.ready,true);
 const calls=[],ctx=new Proxy({drawImage:(...a)=>calls.push(a),createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(t,k)=>t[k]??(()=>{})});
 for(const kind of ['pipe','drone','canopy','storm','waterfall','pit']){
  const o=buildCourseObstacle({kind,x:125,index:38});const before=JSON.stringify(o);const collected=Object.freeze({...o,coin:Object.freeze({...o.coin,collected:true})});
  assert.equal(view.draw(ctx,collected,72,true),true);assert.equal(JSON.stringify(o),before);
  drawGroundObstacle(ctx,collected,72,true,null,view);
 }
 assert.ok(calls.length>=12);view.dispose();assert.equal(view.draw(ctx,{kind:'pipe'},72,true),false);assert.ok(images.every(i=>i.src===''));
});
test('broken or late optional art falls back and releases its images',async()=>{
 const images=[];let finish;class LateImage{constructor(){images.push(this);}decode(){return new Promise(resolve=>finish=resolve);}}
 const view=createChikunObstacleKit({ImageClass:LateImage,fetchRef:async()=>({ok:true,text:async()=>JSON.stringify(metadata)})});await new Promise(resolve=>setImmediate(resolve));view.dispose();assert.equal(await view.ready,false);finish?.();assert.ok(images.every(i=>i.src===''));
 const broken=createChikunObstacleKit({fetchRef:async()=>({ok:false})});assert.equal(await broken.ready,false);
});
