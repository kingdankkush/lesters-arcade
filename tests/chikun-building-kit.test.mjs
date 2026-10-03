import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChikunObstacleKit,validateChikunObstacleKit} from '../apps/chikun/src/obstacle-kit.mjs';
import {buildCourseObstacle} from '../apps/portal/src/chikun-ground-course.mjs';
import {drawGroundObstacle} from '../apps/chikun/src/ground-world.mjs';
const metadata=JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/chikun-obstacle-kit-v1/manifest.json',import.meta.url)));
const townMetadata=structuredClone(metadata);
for(const name of ['town','city','suburb'])townMetadata.assets[name]={frames:3,columns:3,fps:12,variation:'static-designs',tiers:{
 low:{file:name+'-low.webp',width:288,height:192,frameWidth:96,frameHeight:192},
 medium:{file:name+'-medium.webp',width:576,height:384,frameWidth:192,frameHeight:384},
}};
test('native facade variants follow every committed building rectangle, freeze their appearance and keep course data intact',async()=>{
 class Image{async decode(){const [,name,tier]=this.src.match(/([^/]+)-(low|medium)\.webp$/);Object.assign(this,{naturalWidth:townMetadata.assets[name].tiers[tier].width,naturalHeight:townMetadata.assets[name].tiers[tier].height});}}
 const view=createChikunObstacleKit({tier:'low',ImageClass:Image,fetchRef:async()=>({ok:true,text:async()=>JSON.stringify(townMetadata)})});
 assert.equal(await view.ready,true);
 const calls=[],texts=[],ctx=new Proxy({drawImage:(...args)=>calls.push(args),fillText:value=>texts.push(value)},{get:(target,key)=>target[key]??(()=>{})});
 for(const variant of ['town','city','suburb']){
  const source=buildCourseObstacle({kind:'town',x:137,index:24});
  const obstacle=Object.freeze({...source,variant,coin:Object.freeze({...source.coin,collected:true})});
  const before=JSON.stringify(obstacle);calls.length=0;
  assert.equal(view.draw(ctx,obstacle,0,false),true);
  const first=calls.map(args=>args.slice(1));
  assert.equal(calls.length,obstacle.shapes.length);
  for(let i=0;i<calls.length;i++){
   const shape=obstacle.shapes[i],args=calls[i];
   assert.equal(args[0].src.endsWith(variant+'-low.webp'),true);
   assert.deepEqual(args.slice(-4),[shape.x,shape.y,shape.width,shape.height]);
  }
  assert.equal(new Set(calls.map(args=>args[1])).size,3,'three baked designs break up identical facades');
  calls.length=0;view.draw(ctx,obstacle,900,true);
  assert.deepEqual(calls.map(args=>args.slice(1)),first,'static variation never advances with tick or accessibility mode');
  calls.length=0;drawGroundObstacle(ctx,obstacle,900,true,null,view);
  assert.equal(calls.length,3);assert.equal(texts.length,0,'old procedural facade labels are bypassed');
  assert.equal(JSON.stringify(obstacle),before);
 }
 view.dispose();
});
test('shipped facade design atlases are bounded, static and match their runtime receipts',()=>{
 const spec=validateChikunObstacleKit(metadata);
 for(const name of ['town','city','suburb']){
  const asset=metadata.assets[name];assert.equal(asset.frames,3);assert.equal(asset.variation,'static-designs');
  for(const tier of ['low','medium']){
   const sheet=asset.tiers[tier];assert.ok(sheet.frameWidth<=(tier==='low'?96:192));assert.ok(sheet.frameHeight<=(tier==='low'?192:384));
   const file=readFileSync(new URL('../apps/portal/assets/generated/chikun-obstacle-kit-v1/'+sheet.file,import.meta.url));
   assert.equal(file.length,sheet.bytes);assert.equal(createHash('sha256').update(file).digest('hex'),sheet.sha256);
  }
 }
 for(const tier of ['low','medium'])assert.ok(Object.values(spec.assets).reduce((sum,a)=>sum+a.tiers[tier].width*a.tiers[tier].height*4,0)<=(tier==='low'?4:12)*1024*1024);
 const bad=structuredClone(metadata);bad.assets.town.variation='animated';assert.throws(()=>validateChikunObstacleKit(bad));
});
