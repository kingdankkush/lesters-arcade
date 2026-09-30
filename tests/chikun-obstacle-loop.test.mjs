import test from 'node:test';import assert from 'node:assert/strict';
import {validateChikunObstacleLoop,sampleChikunObstacleLoop,selectChikunObstacleTextureTier,createChikunObstacleLoopLoader} from '../apps/chikun/src/obstacle-loop.mjs';
const metadata=()=>({schema:'chikun-obstacle-loop-v1',actor:'eagle',frames:8,columns:4,fps:12,tiers:{low:{file:'eagle-low.webp',frameWidth:128,frameHeight:64,width:512,height:128},medium:{file:'eagle-medium.webp',frameWidth:192,frameHeight:96,width:768,height:192},high:{file:'eagle-high.webp',frameWidth:256,frameHeight:128,width:1024,height:256}}});
test('one fixed registered sheet per texture tier validates and freezes without mutating metadata',()=>{
 const input=metadata(),before=JSON.stringify(input),value=validateChikunObstacleLoop(input);assert.equal(JSON.stringify(input),before);assert.equal(value.frames,8);assert.equal(Object.isFrozen(value.tiers.high),true);assert.equal(Object.isFrozen(value),true);input.tiers.high.width=1;assert.equal(value.tiers.high.width,1024);
});
test('malformed sheets and external or traversing texture names fail before loading',()=>{
 for(const alter of [m=>m.frames=9,m=>m.fps=Infinity,m=>m.tiers.medium.height=191,m=>m.tiers.low.frameWidth=0,m=>m.tiers.high.file='../eagle.webp',m=>m.tiers.high.file='https://example.com/eagle.webp',m=>m.actor='unknown']){const m=metadata();alter(m);assert.throws(()=>validateChikunObstacleLoop(m),/invalid|unsupported/);}
});
test('loop sampling advances at fixed cosmetic cadence and wraps with registered crop coordinates',()=>{
 const m=validateChikunObstacleLoop(metadata());assert.deepEqual(sampleChikunObstacleLoop(m,0,'medium'),{frame:0,x:0,y:0,width:192,height:96});assert.deepEqual(sampleChikunObstacleLoop(m,4/12,'medium'),{frame:4,x:0,y:96,width:192,height:96});assert.equal(sampleChikunObstacleLoop(m,8/12,'high').frame,0);assert.equal(sampleChikunObstacleLoop(m,-1,'low').frame,0);assert.equal(sampleChikunObstacleLoop(m,NaN,'low').frame,0);assert.equal(sampleChikunObstacleLoop(m,10,'high',{reducedMotion:true}).frame,0);
});
test('explicit quality tiers override density and automatic choice loads a single bounded tier',()=>{
 for(const tier of ['low','medium','high'])assert.equal(selectChikunObstacleTextureTier({quality:tier,density:3}),tier);assert.equal(selectChikunObstacleTextureTier({quality:'auto',density:1}), 'low');assert.equal(selectChikunObstacleTextureTier({density:2}),'medium');assert.equal(selectChikunObstacleTextureTier({density:3}),'high');assert.equal(selectChikunObstacleTextureTier({density:NaN}),'low');
});
test('optional texture loader starts only requested tier, memoizes and releases image on dispose',async()=>{
 const calls=[],images=[];class Image {set src(v){calls.push(v);this.url=v;}async decode(){} naturalWidth=768;naturalHeight=192;}
 const loader=createChikunObstacleLoopLoader({metadata:metadata(),tier:'medium',ImageClass:Image,onImage:image=>images.push(image)});assert.equal(calls.length,0);const first=loader.load();assert.equal(first,loader.load());assert.equal(await first,true);assert.deepEqual(calls,['/assets/generated/chikun-obstacle-loop-v1/eagle-medium.webp']);assert.equal(loader.ready,true);loader.dispose();loader.dispose();assert.equal(calls.at(-1),'');assert.equal(loader.ready,false);assert.equal(loader.image,null);
});
test('late decode completion or failure cannot resurrect a disposed texture',async()=>{
 for(const rejectDecode of [false,true]){let release;class Image {naturalWidth=768;naturalHeight=192;decode(){return new Promise((resolve,reject)=>{release=()=>rejectDecode?reject(Error('late failure')):resolve();});}}
 const loader=createChikunObstacleLoopLoader({metadata:metadata(),tier:'medium',ImageClass:Image});const pending=loader.load();loader.dispose();release();assert.equal(await pending,false);assert.equal(loader.ready,false);assert.equal(loader.image,null);}
});
test('wrong decoded sheet dimensions fall back to static art and a closed loader starts no request',async()=>{
 let calls=0;class Image {naturalWidth=1;naturalHeight=1;decode(){calls++;return Promise.resolve();}}
 const loader=createChikunObstacleLoopLoader({metadata:metadata(),tier:'high',ImageClass:Image});assert.equal(await loader.load(),false);assert.equal(loader.ready,false);assert.equal(loader.image,null);const closed=createChikunObstacleLoopLoader({metadata:metadata(),tier:'high',ImageClass:Image});closed.dispose();assert.equal(await closed.load(),false);assert.equal(calls,1);
});
