import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChikunGroundObstacleKit,validateChikunGroundObstacleKit,selectChikunGroundObstacleTier} from '../apps/chikun/src/ground-obstacle-kit.mjs';
import {drawGroundObstacle} from '../apps/chikun/src/ground-world.mjs';
import {buildCourseObstacle} from '../apps/portal/src/chikun-ground-course.mjs';

const metadata={schema:'chikun-ground-obstacle-kit-v1',names:['rock','log','thorn','crate'],tiers:{medium:{file:'ground-medium.webp',width:1024,height:512,frameWidth:512,frameHeight:256},low:{file:'ground-low.webp',width:512,height:256,frameWidth:256,frameHeight:128}}};
const fetchRef=async()=>({ok:true,text:async()=>JSON.stringify(metadata)});

test('ground kit replaces four old painters inside exact canonical draw bounds without changing course snapshots',async()=>{
  const images=[];class Image{constructor(){images.push(this);}async decode(){const s=this.src.includes('-low')?metadata.tiers.low:metadata.tiers.medium;this.naturalWidth=s.width;this.naturalHeight=s.height;}}
  const kit=createChikunGroundObstacleKit({tier:'low',ImageClass:Image,fetchRef});assert.equal(await kit.ready,true);
  const calls=[],ctx=new Proxy({drawImage:(...args)=>calls.push(args)},{get:(obj,k)=>obj[k]??(()=>{})});
  for(const [index,kind]of metadata.names.entries()){
    const original=buildCourseObstacle({kind,x:213,index:17}),o=Object.freeze({...original,coin:{...original.coin,collected:true}}),before=JSON.stringify(o);
    calls.length=0;drawGroundObstacle(ctx,o,0,false,null,null,null,kit);
    assert.equal(calls.length,1);assert.deepEqual(calls[0].slice(1,5),[(index%2)*256,Math.floor(index/2)*128,256,128]);
    assert.deepEqual(calls[0].slice(-4),[o.x,690-o.height,o.width,o.height]);
    const drawn=calls[0].slice(1);calls.length=0;drawGroundObstacle(ctx,o,99999,true,null,null,null,kit);assert.deepEqual(calls[0].slice(1),drawn,'static terrain does not morph with replay time');
    assert.equal(JSON.stringify(o),before);
  }
  assert.equal(kit.draw(ctx,buildCourseObstacle({kind:'shiba'})),false);kit.dispose();assert.ok(images.every(image=>image.src===''));
  assert.equal(kit.draw(ctx,buildCourseObstacle({kind:'rock'})),false);
});

test('ground tiers enforce safe atlas identities and aggregate phone/full decode caps',()=>{
  validateChikunGroundObstacleKit(metadata);
  assert.equal(selectChikunGroundObstacleTier({phone:true,density:3}),'low');assert.equal(selectChikunGroundObstacleTier({phone:false,density:2}),'medium');
  const bad=structuredClone(metadata);bad.tiers.low.file='../ground-low.webp';assert.throws(()=>validateChikunGroundObstacleKit(bad));
  const big=structuredClone(metadata);big.tiers.medium.width=2048;assert.throws(()=>validateChikunGroundObstacleKit(big));
  const unknown=structuredClone(metadata);unknown.names[0]='shiba';assert.throws(()=>validateChikunGroundObstacleKit(unknown));
});

test('failed and cancelled ground atlas downloads clear decoded ownership and retain fallback painting',async()=>{
  const images=[];let resolve;class LateImage{constructor(){images.push(this);}decode(){return new Promise(done=>resolve=done);}}
  const kit=createChikunGroundObstacleKit({ImageClass:LateImage,fetchRef});await new Promise(done=>setImmediate(done));kit.dispose();assert.equal(await kit.ready,false);resolve?.();assert.ok(images.every(i=>i.src===''));
  const statuses=[];const failed=createChikunGroundObstacleKit({fetchRef:async()=>({ok:false}),onStatus:s=>statuses.push(s)});assert.equal(await failed.ready,false);assert.deepEqual(statuses,['loading','fallback']);
});

test('native ground runtime bytes match recorded unchanged-source receipts and tier budgets',()=>{
  const root=new URL('../apps/portal/assets/generated/chikun-ground-obstacle-kit-v1/',import.meta.url);
  const shipped=JSON.parse(readFileSync(new URL('manifest.json',root)));validateChikunGroundObstacleKit(shipped);
  for(const s of Object.values(shipped.tiers)){
    const bytes=readFileSync(new URL(s.file,root));assert.equal(bytes.length,s.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);assert.equal(s.decodedBytes,s.width*s.height*4);
  }
  for(const native of shipped.native.assets){assert.equal(native.sourceUnchanged,true);assert.match(native.sourceSha256,/^[0-9a-f]{64}$/);assert.match(native.renderSha256,/^[0-9a-f]{64}$/);}
  assert.deepEqual(shipped.native.assets.map(a=>a.name),metadata.names);
});

test('real shell owns one lazy ground atlas and does not download its four legacy copies on success',()=>{
  const main=readFileSync(new URL('../apps/chikun/src/main.mjs',import.meta.url),'utf8');
  assert.match(main,/loadGroundArt\(\{exclude:\[\.\.\.nativeSkyNames,\.\.\.nativeGroundNames,\.\.\.nativeLoopNames\]\}\)/);
  assert.match(main,/import\('\.\/ground-obstacle-kit\.mjs'\)/);
  assert.match(main,/status==='fallback'\)loadGroundArt\(\{only:nativeGroundNames\}\)/);
  assert.match(main,/groundObstacleKit\?\.dispose\(\)/);
});
