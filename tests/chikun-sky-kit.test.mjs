import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChikunSkyKit,validateChikunSkyKit,selectChikunSkyTier} from '../apps/chikun/src/sky-kit.mjs';
import {buildCourseObstacle} from '../apps/portal/src/chikun-ground-course.mjs';
import {drawGroundObstacle,loadGroundArt} from '../apps/chikun/src/ground-world.mjs';
const metadata={schema:'chikun-sky-kit-v1',frames:8,columns:4,fps:12,assets:Object.fromEntries(['hawk','pelican','plane'].map(name=>[name,{tiers:Object.fromEntries(['low','medium'].map(tier=>{
 const width=tier==='low'?128:name==='plane'?256:192,height=tier==='low'?(name==='plane'?48:64):96;
 return [tier,{file:name+'-'+tier+'.webp',width:width*4,height:height*2,frameWidth:width,frameHeight:height}];
}))}]))};
test('sky kit renders existing capsule obstacles in their old draw bounds with frozen reduced-motion poses',async()=>{
 const images=[];class Image{constructor(){images.push(this);}async decode(){const [,name,tier]=this.src.match(/([^/]+)-(low|medium)\.webp$/);const s=metadata.assets[name].tiers[tier];this.naturalWidth=s.width;this.naturalHeight=s.height;}}
 const view=createChikunSkyKit({tier:'low',ImageClass:Image,fetchRef:async()=>({ok:true,text:async()=>JSON.stringify(metadata)})});assert.equal(await view.ready,true);
 const calls=[],ctx=new Proxy({drawImage:(...a)=>calls.push(a)},{get:(t,k)=>t[k]??(()=>{})});
 for(const kind of ['hawk','pelican','plane']){
  const original=buildCourseObstacle({kind,x:180,index:7}),o=Object.freeze({...original,coin:{...original.coin,collected:true}}),before=JSON.stringify(o),h=kind==='plane'?72:70;
  calls.length=0;assert.equal(view.draw(ctx,o,5,false),true);assert.deepEqual(calls[0].slice(-4),[o.x,o.y-h*.60,o.width,h]);assert.equal(calls[0][1],128);
  calls.length=0;drawGroundObstacle(ctx,o,35,true,null,null,view);assert.equal(calls.length,1);assert.equal(calls[0][1],0);assert.equal(calls[0][2],0);assert.equal(JSON.stringify(o),before);
 }
 assert.equal(view.draw(ctx,buildCourseObstacle({kind:'drone'})),false);view.dispose();assert.ok(images.every(img=>img.src===''));assert.equal(view.draw(ctx,{kind:'plane',family:'sky'}),false);
});
test('sky kit validates safe paths and aggregate decode bounds and uses phone tier regardless of DPR',()=>{
 validateChikunSkyKit(metadata);assert.equal(selectChikunSkyTier({phone:true,density:3}),'low');assert.equal(selectChikunSkyTier({phone:false,density:2}),'medium');
 const bad=structuredClone(metadata);bad.assets.plane.tiers.low.file='../plane-low.webp';assert.throws(()=>validateChikunSkyKit(bad));
 const big=structuredClone(metadata);for(const a of Object.values(big.assets))Object.assign(a.tiers.medium,{width:1024,height:256,frameWidth:256,frameHeight:128});assert.throws(()=>validateChikunSkyKit(big));
});
test('cancelled, failed and late sky downloads release images and leave legacy fallback available',async()=>{
 const images=[];let resolve;class LateImage{constructor(){images.push(this);}decode(){return new Promise(done=>resolve=done);}}
 const view=createChikunSkyKit({ImageClass:LateImage,fetchRef:async()=>({ok:true,text:async()=>JSON.stringify(metadata)})});await new Promise(done=>setImmediate(done));view.dispose();assert.equal(await view.ready,false);resolve?.();assert.ok(images.every(img=>img.src===''));
 assert.equal(await createChikunSkyKit({fetchRef:async()=>({ok:false})}).ready,false);
});
test('successful native sky startup avoids old static sky downloads; optional failure can load only those fallbacks',async()=>{
 const previous=globalThis.Image,calls=[];globalThis.Image=class{set src(value){calls.push(value);}async decode(){}};
 try{
  await loadGroundArt({exclude:['hawk','pelican','plane']});assert.ok(calls.every(url=>!/(hawk|pelican|plane)\.webp$/.test(url)));
  calls.length=0;await loadGroundArt({only:['hawk','pelican','plane']});assert.equal(calls.length,3);assert.ok(calls.every(url=>/(hawk|pelican|plane)\.webp$/.test(url)));
 }finally{globalThis.Image=previous;}
});
test('shipped sky sheets contain native unique poses at both tiers and match their receipts',()=>{
 const shipped=JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/chikun-sky-kit-v1/manifest.json',import.meta.url)));validateChikunSkyKit(shipped);
 for(const [name,a] of Object.entries(shipped.assets))for(const [tier,sheet] of Object.entries(a.tiers)){
  const bytes=readFileSync(new URL('../apps/portal/assets/generated/chikun-sky-kit-v1/'+sheet.file,import.meta.url));assert.equal(bytes.length,sheet.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),sheet.sha256);assert.equal(new Set(sheet.poseHashes).size,8,name+' '+tier+' has eight visible poses');
 }
});
