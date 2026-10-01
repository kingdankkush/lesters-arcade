// Course-two art pack (chikun-course-two-v1): manifest identity, projection-only
// boundaries, exact collision-geometry drawing and lazy/fallback behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCourseTwoArt,courseTwoArtTier,courseTwoSheetFile,courseTwoLoopFrame,validateCourseTwoArt} from '../apps/chikun/src/course-v2-art.mjs';
import {drawCourseV2,drawCourseV2Obstacle,trackCourseV2Cues,COURSE_V2_TELL} from '../apps/chikun/src/course-v2-view.mjs';
import {createCourseV2Runtime} from '../apps/portal/src/chikun-course-v2-runtime.mjs';
import {courseV2Chase,courseV2Obstacles,courseV2Pickups} from '../apps/portal/src/chikun-course-v2.mjs';

const root=new URL('../',import.meta.url);
const packDir=new URL('apps/portal/assets/generated/chikun-course-two-v1/',root);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',packDir),'utf8'));
const sha256=file=>createHash('sha256').update(readFileSync(file)).digest('hex');

test('the pack manifest names every sheet with exact bytes and hashes',()=>{
 assert.equal(manifest.schema,'chikun-course-two-art-v1');assert.equal(manifest.projectionOnly,true);
 assert.deepEqual(manifest.assets.map(a=>a.name),['tractor','trellis','pickups']);
 for(const a of manifest.assets)for(const t of [a,a.half]){const file=new URL(t.file,packDir);assert.equal(statSync(file).size,t.bytes,t.file);assert.equal(sha256(file),t.sha256,t.file);assert.equal(t.decodedBytes,t.width*t.height*4);}
 const tractor=manifest.assets[0];assert.equal(tractor.frames,8);assert.equal(tractor.columns,4);assert.deepEqual(tractor.logical,[138,94]);assert.equal(tractor.width,138*2*4);assert.equal(tractor.height,94*2*2);
 assert.deepEqual(manifest.assets[1].logical,[300,150]);assert.equal(manifest.assets[1].width,600);assert.equal(manifest.assets[1].height,300);
 assert.equal(manifest.assets[2].frames,3);assert.equal(manifest.assets[2].width,288);assert.equal(manifest.assets[2].height,96);
 assert.equal(manifest.hawk.addedBytes,0);
 const eagle=JSON.parse(readFileSync(new URL('apps/portal/assets/generated/chikun-obstacle-loop-v1/manifest.json',root),'utf8'));
 for(const [tier,v] of Object.entries(manifest.hawk.tiers))assert.equal(v.sha256,eagle.tiers[tier].sha256,'hawk reuses the committed eagle sheet '+tier);
 assert.equal(manifest.totals.encodedBytes,manifest.assets.reduce((n,a)=>n+a.bytes,0));
 assert.equal(manifest.totals.halfEncodedBytes,manifest.assets.reduce((n,a)=>n+a.half.bytes,0));
 assert.ok(manifest.totals.encodedBytes<260000&&manifest.totals.halfEncodedBytes<110000,'budget: '+manifest.totals.encodedBytes);
 assert.doesNotThrow(()=>validateCourseTwoArt(manifest));
 assert.throws(()=>validateCourseTwoArt({...manifest,schema:'x'}),/unsupported/);
 assert.throws(()=>validateCourseTwoArt({...manifest,assets:manifest.assets.slice(1)}),/missing/);
});

test('no simulation or rules module imports the art, and the art imports no simulation',()=>{
 for(const file of ['apps/portal/src/chikun-course-v2-runtime.mjs','apps/portal/src/chikun-course-v2.mjs','apps/portal/src/chikun-cabinet.mjs','apps/portal/src/chikun-ground-runtime.mjs','server/verify/chikun.mjs']){
  const text=readFileSync(new URL(file,root),'utf8');
  assert.doesNotMatch(text,/course-v2-art|course-v2-view|chikun-course-two-v1/,file+' must not reference course-two art');
 }
 const art=readFileSync(new URL('apps/chikun/src/course-v2-art.mjs',root),'utf8');
 assert.doesNotMatch(art,/^\s*import\s/m,'the art module has no imports');
 const main=readFileSync(new URL('apps/chikun/src/main.mjs',root),'utf8');
 assert.match(main,/import\('\.\/course-v2-art\.mjs'\)/,'main loads the art lazily');
 assert.doesNotMatch(main,/^import .*course-v2-art/m,'main never imports the art statically');
 assert.match(main,/if \(disposed \|\| courseTwoArt \|\| !courseTwoActive\(\)\) return;/,'art loads only while course two is active');
});

test('tier selection: desktop 1x and phones take half-res; dense desktop takes 2x',()=>{
 assert.equal(courseTwoArtTier({density:1,phone:false}),'half');
 assert.equal(courseTwoArtTier({density:3,phone:true}),'half');
 assert.equal(courseTwoArtTier({density:2,phone:false}),'full');
 assert.equal(courseTwoSheetFile(manifest.assets[0],'full'),'tractor.webp');
 assert.equal(courseTwoSheetFile(manifest.assets[0],'half'),'tractor@0.5x.webp');
 assert.deepEqual([0,4,5,39,40].map(t=>courseTwoLoopFrame(t)),[0,0,1,7,0]);
 assert.equal(courseTwoLoopFrame(37,true),0);
});

function recordingContext(){
 const calls=[];const g={addColorStop(){}};
 const ctx=new Proxy({},{get(_,name){
  if(name==='measureText')return text=>({width:text.length*7});
  if(name==='createLinearGradient'||name==='createRadialGradient')return()=>g;
  return(...args)=>{calls.push([name,...args]);};
 },set(){return true;}});
 return {calls,ctx};
}
const SIZES={tractor:[1104,376],'tractor@0.5x':[552,188],trellis:[600,300],'trellis@0.5x':[300,150],pickups:[288,96],'pickups@0.5x':[144,48],'eagle-low':[512,128],'eagle-medium':[768,192],'eagle-high':[1024,256]};
class FakeImage{
 constructor(){this.naturalWidth=0;this.naturalHeight=0;this._src='';}
 set src(v){this._src=v;const name=String(v).split('/').pop().replace(/\.webp$/,'');const size=SIZES[name];if(size){this.naturalWidth=size[0];this.naturalHeight=size[1];}}
 get src(){return this._src;}
 decode(){return this.naturalWidth?Promise.resolve():Promise.reject(new Error('missing'));}
}
const fakeFetch=async()=>({ok:true,text:async()=>JSON.stringify(manifest)});
const fakeCanvas=(w,h)=>({width:w,height:h,getContext(){return {drawImage(){},fillRect(){},set globalCompositeOperation(v){},set fillStyle(v){}};}});
function findChase(kind,telegraph){
 for(let seed=1;seed<80;seed++)for(let t=1700;t<4200;t+=5){const c=courseV2Chase(seed,t);if(c&&c.telegraph===telegraph&&(!kind||c.kind===kind))return c;}
 throw new Error('no chase found');
}
function findTrellis(){
 for(let t=0;t<20000;t+=30){const o=courseV2Obstacles(1,t).find(o=>o.family==='fork-route');if(o)return o;}
 throw new Error('no trellis found');
}

test('loaded art draws the chase, trellis and pickups at the exact runtime geometry',async()=>{
 const art=createCourseTwoArt({tier:'half',eagleTier:'low',ImageClass:FakeImage,fetchRef:fakeFetch,makeCanvas:fakeCanvas});
 assert.equal(await art.load(),true);assert.equal(art.ready,true);assert.equal(art.hawkReady,true);
 const chase=findChase('tractor',false);
 const {ctx,calls}=recordingContext();
 assert.equal(art.drawChase(ctx,chase,300,false),true);
 const draw=calls.find(c=>c[0]==='drawImage');
 assert.deepEqual(draw.slice(-4),[chase.x,chase.y,chase.width,chase.height],'tractor sprite fills the runtime body box');
 assert.deepEqual(draw.slice(2,6),[0,94,138,94],'frame 4 of 8 at tick 300 on the half sheet');
 const hawk={...chase,kind:'hawk',y:310};calls.length=0;
 assert.equal(art.drawChase(ctx,hawk,0,true),true);
 assert.deepEqual(calls[0].slice(-4),[hawk.x,hawk.y+4,138,69],'hawk covers the 328..368 solid band inside the body box');
 assert.equal(art.drawChase(ctx,{...chase,telegraph:true},0,false),false,'telegraph draws no actor');
 const trellis=findTrellis();
 calls.length=0;assert.equal(art.drawTrellis(ctx,trellis),true);
 assert.deepEqual(calls[0].slice(-4),[trellis.x,390,300,150],'trellis sheet maps onto the collision rect');
 const pickup=courseV2Pickups(1,0)[0];calls.length=0;assert.equal(art.drawPickup(ctx,pickup,0),true);
 assert.deepEqual(calls[0].slice(2,6),[0,0,48,48]);assert.deepEqual(calls[0].slice(-4),[pickup.x-24,pickup.y-24,48,48]);
 art.dispose();assert.equal(art.ready,false);assert.equal(art.drawPickup(ctx,pickup,0),false);
});

test('a failed download keeps the vector fallback and the view keeps drawing',async()=>{
 const art=createCourseTwoArt({tier:'full',ImageClass:FakeImage,fetchRef:async()=>({ok:false}),makeCanvas:fakeCanvas});
 assert.equal(await art.load(),false);assert.equal(art.ready,false);
 const run=createCourseV2Runtime({seed:1,maxTicks:400});const s=run.snapshot();
 assert.ok(s.powerups.length>0,'the first shield pickup is in view at tick 0');
 for(const a of [art,null]){
  const {ctx,calls}=recordingContext();drawCourseV2(ctx,s,{reduced:false,left:0,art:a});assert.ok(calls.some(c=>c[0]==='arc'),'vector pickup drawn');
  const trellis=findTrellis();assert.equal(drawCourseV2Obstacle(ctx,trellis,a),true);
 }
 assert.equal(COURSE_V2_TELL,'#ff5a2e');
 // The warning cue text appears only while the chase telegraphs.
 const tele=findChase(null,true);
 const {ctx,calls}=recordingContext();
 drawCourseV2(ctx,{...s,tick:tele.remainingTicks,chase:tele},{reduced:false,left:0,art});
 assert.ok(calls.some(c=>c[0]==='fillText'&&/BEHIND/.test(c[1])));
});

test('cue tracker reports pickup, shield pop and magnet expiry from snapshots only',()=>{
 const base={courseVersion:2,powers:{shield:false,magnetTicks:0,pickups:0,feather:false,gliding:false}};
 trackCourseV2Cues({...base,tick:0});
 assert.deepEqual(trackCourseV2Cues({...base,tick:1,powers:{...base.powers,pickups:1,shield:true}}).map(c=>c.kind),['pickup']);
 assert.deepEqual(trackCourseV2Cues({...base,tick:2,powers:{...base.powers,pickups:1,shield:false}}).map(c=>c.kind),['pickup','shield-pop']);
 trackCourseV2Cues({...base,tick:3,powers:{...base.powers,pickups:1,magnetTicks:5}});
 assert.deepEqual(trackCourseV2Cues({...base,tick:8,powers:{...base.powers,pickups:1,magnetTicks:0}}).map(c=>c.kind),['pickup','shield-pop','magnet-end']);
 assert.deepEqual(trackCourseV2Cues({...base,tick:0}),[],'a new run resets the cues');
});
