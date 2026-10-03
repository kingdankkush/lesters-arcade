import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChikunGroundLoopKit,validateChikunGroundLoopKit} from '../apps/chikun/src/ground-loop-kit.mjs';
import {drawGroundObstacle} from '../apps/chikun/src/ground-world.mjs';
import {buildCourseObstacle} from '../apps/portal/src/chikun-ground-course.mjs';
const metadata={schema:'chikun-ground-loop-kit-v1',names:['shiba','hurdle'],frames:8,fps:12,tiers:{medium:{file:'loops-medium.webp',width:2048,height:256,frameWidth:256,frameHeight:128},low:{file:'loops-low.webp',width:1024,height:128,frameWidth:128,frameHeight:64}}};
const fetchRef=async()=>({ok:true,text:async()=>JSON.stringify(metadata)});
class Image {async decode(){const s=this.src.includes('-low')?metadata.tiers.low:metadata.tiers.medium;this.naturalWidth=s.width;this.naturalHeight=s.height;}}
test('two native loops use canonical old bounds, bounce and label, without mutating course inputs',async()=>{
 const kit=createChikunGroundLoopKit({ImageClass:Image,fetchRef});assert.equal(await kit.ready,true);
 const calls=[],labels=[],ctx=new Proxy({drawImage:(...a)=>calls.push(a),fillText:(...a)=>labels.push(a)},{get:(o,k)=>o[k]??(()=>{})});
 for(const [row,kind]of metadata.names.entries())for(let frame=0;frame<8;frame++){
  const original=buildCourseObstacle({kind,x:213,index:17}),o={...original,coin:{...original.coin,collected:true}},before=JSON.stringify(o),tick=frame*5;
  calls.length=0;labels.length=0;drawGroundObstacle(ctx,o,tick,false,null,null,null,null,kit);assert.equal(calls.length,1);
  assert.deepEqual(calls[0].slice(1,5),[frame*128,row*64,128,64]);assert.deepEqual(calls[0].slice(-4),[213,690-o.height-(kind==='shiba'?Math.abs(Math.sin(tick*.19))*3:0),o.width,o.height]);
  assert.deepEqual(labels,kind==='shiba'?[['SHIBA!',268,614]]:[]);assert.equal(JSON.stringify(o),before);
  calls.length=0;kit.draw(ctx,o,99999,true);assert.deepEqual(calls[0].slice(1,5),[0,row*64,128,64]);assert.equal(calls[0].at(-3),690-o.height);
 }
 assert.equal(kit.draw(ctx,buildCourseObstacle({kind:'rock'})),false);kit.dispose();assert.equal(kit.draw(ctx,buildCourseObstacle({kind:'shiba'})),false);
});
test('loop metadata rejects unexpected frame identities and dimensions',()=>{
 validateChikunGroundLoopKit(metadata);for(const mutate of [m=>m.names.reverse(),m=>m.frames=16,m=>m.fps=60,m=>m.tiers.low.file='../loops-low.webp',m=>m.tiers.medium.width=4096]){const m=structuredClone(metadata);mutate(m);assert.throws(()=>validateChikunGroundLoopKit(m));}
});
test('failed/cancelled loops clean image ownership and allow legacy fallback',async()=>{
 const statuses=[],bad=createChikunGroundLoopKit({fetchRef:async()=>({ok:false}),onStatus:s=>statuses.push(s)});assert.equal(await bad.ready,false);assert.deepEqual(statuses,['loading','fallback']);
 let finish;const images=[];class Late{constructor(){images.push(this);}decode(){return new Promise(r=>finish=r);}}
 const late=createChikunGroundLoopKit({fetchRef,ImageClass:Late});await new Promise(r=>setImmediate(r));late.dispose();assert.equal(await late.ready,false);finish?.();assert.ok(images.every(i=>i.src===''));
});
test('native sheets contain eight distinct compressed poses each and source/hash receipts',()=>{
 const base=new URL('../apps/portal/assets/generated/chikun-ground-loop-kit-v1/',import.meta.url),m=JSON.parse(readFileSync(new URL('manifest.json',base)));validateChikunGroundLoopKit(m);
 for(const s of Object.values(m.tiers)){const bytes=readFileSync(new URL(s.file,base));assert.equal(bytes.length,s.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);assert.equal(s.decodedBytes,s.width*s.height*4);for(const hashes of s.poseHashes){assert.equal(hashes.length,8);assert.equal(new Set(hashes).size,8);}}
 for(const a of m.native.assets){assert.equal(a.sourceUnchanged,true);assert.match(a.sourceSha256,/^[0-9a-f]{64}$/);}
});
test('shell lazily owns one extra page, skips both old copies, and restores only those on failure',()=>{
 const main=readFileSync(new URL('../apps/chikun/src/main.mjs',import.meta.url),'utf8');
 assert.match(main,/nativeLoopNames=\['shiba','hurdle'\]/);assert.match(main,/exclude:\[\.\.\.nativeSkyNames,\.\.\.nativeGroundNames,\.\.\.nativeLoopNames\]/);
 assert.match(main,/import\('\.\/ground-loop-kit\.mjs'\)/);assert.match(main,/status==='fallback'\)loadGroundArt\(\{only:nativeLoopNames\}\)/);assert.match(main,/groundLoopKit\?\.dispose\(\)/);
 assert.match(main,/paintObstacle[\s\S]*groundObstacleKit,groundLoopKit\)/);
});
