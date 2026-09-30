import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';
const policy=await import('../apps/hmh-reboot/src/dev/greybox-access.mjs').catch(()=>({}));
const navigation=await import('../apps/hmh-reboot/src/dev/greybox-navigation.mjs').catch(()=>({}));
const launcher=await import('../apps/hmh-reboot/src/dev/greybox-preview-launch.mjs').catch(()=>({}));
const url='http://127.0.0.1:8793/dist/hmh-greybox/index.html?mode=free&world=visual-overhaul-greybox-v1';
const access=(value=url,topLevel=true)=>{assert.equal(typeof policy.readGreyboxAccess,'function');return policy.readGreyboxAccess({url:value,topLevel});};
function fixture(){const bounds={minX:0,minY:0,maxX:1000,maxY:1000};const baseSurface=createElevationSurface({id:'floor',area:{type:'rect',...bounds},visibleTerrainId:'floor'});return Object.freeze({mapId:'visual-overhaul-greybox-v1',rankedEligible:false,officialRun:false,rulesVersion:null,bounds:Object.freeze(bounds),playerRadius:24,spawn:Object.freeze({x:100,y:500}),areas:Object.freeze([{id:'first',center:{x:100,y:500}},{id:'second',center:{x:700,y:500}}]),queryGround:createAuthoredGroundQuery({baseSurface}),collisionBlockers:Object.freeze([createStaticBlocker({id:'wall',visibleAssetId:'wall',minZ:0,maxZ:180,shape:{type:'polygon',vertices:[{x:200,y:0},{x:250,y:0},{x:250,y:1000},{x:200,y:1000}]}})])});}
const make=()=>{assert.equal(typeof navigation.createGreyboxNavigator,'function');return navigation.createGreyboxNavigator(fixture());};

test('only explicit local top-level Free greybox access is allowed',()=>{
  const result=access();assert.equal(result.allowed,true);assert.equal(result.rankedEligible,false);assert.equal(result.officialRun,false);assert.equal(Object.isFrozen(result),true);
  assert.equal(access(url.replace('127.0.0.1','localhost')).allowed,true);
  for(const value of [url.replace('mode=free','mode=ranked'),url.split('?')[0],url.replace('visual-overhaul-greybox-v1','old-map'),url.replace('127.0.0.1:8793','lestersarcade.io'),url+'&session=official',url+'&mode=free',url+'&world=visual-overhaul-greybox-v1','not-a-url'])assert.equal(access(value).allowed,false,value);
  assert.equal(access(url,false).allowed,false);
});

test('real player-radius collision prevents walking through a greybox wall',()=>{
  const actor=make(),input=Object.freeze({x:1,y:0});
  for(let tick=0;tick<120;tick++)actor.step(input);
  const view=actor.view();assert.ok(view.x>170&&view.x<=176.00001);assert.equal(view.vx,0);assert.equal(view.tick,120);assert.ok(view.contacts>0);assert.equal(view.officialRun,false);assert.equal(view.rankedEligible,false);
  assert.deepEqual(input,{x:1,y:0});
});

test('free navigation samples are detached and inspection jumps are explicit and bounded to authored areas',()=>{
  const actor=make(),first=actor.view();assert.equal(Object.isFrozen(first),true);
  actor.step({x:1,y:0});assert.equal(first.x,100);
  assert.throws(()=>actor.inspectArea('missing'),/area/);actor.inspectArea('second');
  const after=actor.view();assert.equal(after.x,700);assert.equal(after.y,500);assert.equal(after.vx,0);assert.equal(after.inspectionJumps,1);assert.equal(after.lastAction,'inspection-jump');assert.equal(after.tick,1);
  assert.throws(()=>actor.inspectArea('second', {x:0,y:0}),/argument/);
});

test('navigation cannot accept an official or Ranked world and has no alternate timestep',()=>{
  assert.equal(typeof navigation.createGreyboxNavigator,'function');
  assert.throws(()=>navigation.createGreyboxNavigator({...fixture(),officialRun:true}),/local|Free/);
  assert.throws(()=>navigation.createGreyboxNavigator({...fixture(),rankedEligible:true}),/local|Free/);
  const actor=make();assert.throws(()=>actor.step({x:1,y:0},1),/argument/);assert.throws(()=>actor.step({x:NaN,y:0}),/finite/);
});

test('fixed clock caps catch-up at four actual 60Hz steps and drops excess wall time',()=>{
  assert.equal(typeof navigation.createGreyboxStepClock,'function');let ticks=0;const clock=navigation.createGreyboxStepClock(()=>ticks++);
  clock.advance(1000);assert.equal(ticks,0);clock.advance(1017);assert.equal(ticks,1);
  const report=clock.advance(6017);assert.equal(ticks,5);assert.equal(report.steps,4);assert.ok(report.droppedSeconds>0);
  clock.pause();clock.advance(99999);assert.equal(ticks,5);clock.advance(100016);assert.equal(ticks,6);
});

test('invalid and rewound clocks cannot step or create a hidden catch-up burst',()=>{
  assert.equal(typeof navigation.createGreyboxStepClock,'function');let ticks=0;const clock=navigation.createGreyboxStepClock(()=>ticks++);
  clock.advance(1000);clock.advance(1017);assert.equal(ticks,1);clock.advance(900);clock.advance(NaN);assert.equal(ticks,1);
  clock.advance(1034);assert.equal(ticks,2);
});

test('an import that completes after disposal cannot mount a ghost preview',async()=>{
  assert.equal(typeof launcher.createGreyboxPreviewLaunch,'function');let finish,loads=0,mounts=0;
  const launch=launcher.createGreyboxPreviewLaunch({access:access(),root:{},load:()=>{loads++;return new Promise(resolve=>{finish=resolve;});}});
  launch.dispose();finish({mountGreyboxPlaytest(){mounts++;throw new Error('ghost mount');}});await launch.ready;
  assert.equal(loads,1);assert.equal(mounts,0);assert.equal(launch.snapshot().phase,'disposed');
  const denied=launcher.createGreyboxPreviewLaunch({access:access(url,false),root:{},load:()=>{throw new Error('denied import');}});await denied.ready;assert.equal(denied.snapshot().phase,'denied');
});

test('active preview disposal is once-only and cleanup failures stay observable',async()=>{
  assert.equal(typeof launcher.createGreyboxPreviewLaunch,'function');let calls=0;
  const launch=launcher.createGreyboxPreviewLaunch({access:access(),root:{},load:async()=>({mountGreyboxPlaytest:()=>({ready:Promise.resolve(),dispose(){calls++;throw new Error('cleanup witness');},snapshot:()=>({})})})});
  await launch.ready;assert.equal(launch.snapshot().phase,'ready');launch.dispose();launch.dispose();assert.equal(calls,1);assert.equal(launch.snapshot().phase,'disposed');assert.equal(launch.snapshot().cleanupFailure,'cleanup witness');
});

test('a failed download is retained as a failed preview and never becomes ready',async()=>{
  assert.equal(typeof launcher.createGreyboxPreviewLaunch,'function');
  const launch=launcher.createGreyboxPreviewLaunch({access:access(),root:{},load:async()=>{throw new Error('download witness');}});await launch.ready;
  assert.equal(launch.snapshot().phase,'failed');assert.equal(launch.snapshot().failure,'download witness');
});
