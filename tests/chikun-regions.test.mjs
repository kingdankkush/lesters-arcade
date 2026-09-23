import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {CHIKUN_REGIONS,REGION_SCHEDULE,REGION_LOOP_SLOTS,REGION_LOOP_TICKS,REGION_LEAD_TICKS,REGION_LEAD_PX,REGION_BLEND_TICKS,COURSE_CADENCE,courseRegionState,courseRegion,courseTerrain,regionForObstacle,regionSwitchTick,sceneryTick,passageRoute,isGapKind}from'../apps/portal/src/chikun-course-regions.mjs';
import {courseKind,buildCourseObstacle,courseObstacles,courseObstacleX,distanceAtTick}from'../apps/portal/src/chikun-ground-course.mjs';
import {courseRegion as v3Region}from'../apps/portal/src/chikun-ground-v3-course.mjs';
import {createChikunRuntime,replayChikunRun,buildChikunDifficulty}from'../apps/portal/src/chikun-cabinet.mjs';
import {buildChikunModeTease}from'../apps/chikun/src/presentation.mjs';
import {REGION_LAYERS,paintRegionLayer}from'../apps/chikun/src/world.mjs';
import {routePilot,pilotRun}from'../scripts/chikun-course-pilot.mjs';

const ORDER=['farmland','forest','town','city','industrial','suburbs','coast'];
const LAP_SWITCH=regionSwitchTick(REGION_LOOP_SLOTS);

test('the endless course is one loop: farmland → forest → town → city → industrial → suburbs → coast → farmland',()=>{
 assert.deepEqual(CHIKUN_REGIONS.map(r=>r.id),ORDER);
 assert.deepEqual(REGION_SCHEDULE.map(r=>[r.id,r.ticks]),[['farmland',2720],['forest',2720],['town',1360],['city',2720],['industrial',2040],['suburbs',2040],['coast',2720]]);
 assert.equal(REGION_LOOP_SLOTS,48);assert.equal(REGION_LOOP_TICKS,16320);assert.equal(COURSE_CADENCE,340);
 assert.equal(courseRegion(0),'Farmland');assert.equal(courseTerrain(0),'grass');
 const walk=[];let last='';
 for(let tick=0;tick<=regionSwitchTick(REGION_LOOP_SLOTS*2)+60;tick+=60){const name=courseRegion(tick);if(name!==last){walk.push(name);last=name;}}
 const names=CHIKUN_REGIONS.map(r=>r.name);
 assert.deepEqual(walk,[...names,...names,'Farmland'],'two full laps then straight back into farmland');
 assert.equal(courseRegion(LAP_SWITCH-1),'Coast');assert.equal(courseRegion(LAP_SWITCH),'Farmland');
 assert.equal(courseTerrain(LAP_SWITCH-1),'sand');
 assert.equal(v3Region(0),'Farmland','historical v3 replays read the same cosmetic labels');
 assert.deepEqual(CHIKUN_REGIONS.map(r=>r.terrain),['grass','loam','cobble','asphalt','concrete','pavement','sand']);
});

test('transitions blend over a short window, stay continuous and wrap seamlessly from coast to farmland',()=>{
 assert.equal(REGION_BLEND_TICKS,180);
 const state={};
 for(const lap of [0,1,2])REGION_SCHEDULE.forEach((seg,i)=>{
  const first=lap*REGION_LOOP_SLOTS+seg.startSlot,start=regionSwitchTick(first),end=regionSwitchTick(first+seg.slots);
  courseRegionState(Math.floor((start+end)/2),state);assert.equal(state.index,i);assert.equal(state.blend,0);assert.equal(state.loop,lap);
  let previous=-1;
  for(let tick=end-REGION_BLEND_TICKS;tick<end;tick++){courseRegionState(tick,state);assert.equal(state.index,i);assert.ok(state.blend>=previous&&state.blend>=0&&state.blend<1);previous=state.blend;}
  // At speed the scenery clock can step two slot ticks in one tick, so the last frame lands within a few ticks of a full blend.
  courseRegionState(end-1,state);assert.ok(state.blend>=1-3/REGION_BLEND_TICKS,`${seg.id} lap ${lap+1} blend ${state.blend}`);assert.equal(state.next.id,ORDER[(i+1)%7]);
  courseRegionState(end,state);assert.equal(state.index,(i+1)%7);assert.ok(state.blend<=2/REGION_BLEND_TICKS);
 });
 courseRegionState(LAP_SWITCH-1,state);
 assert.equal(state.region.id,'coast');assert.equal(state.next.id,'farmland');assert.ok(state.blend>.98);assert.equal(state.loop,0);
 courseRegionState(LAP_SWITCH,state);assert.equal(state.region.id,'farmland');assert.equal(state.loop,1);assert.ok(state.localTick<=1);
 assert.equal(courseRegionState(5,state),state,'the caller-owned object is reused: no per-frame allocation');
 for(const tick of [0,regionSwitchTick(1)-1]){courseRegionState(tick,state);assert.equal(state.region.id,'farmland');assert.equal(state.blend,0);}
});

test('the scenery of a region takes over as its first obstacle comes within 180 px of Chikun, at every speed',()=>{
 // The lead is a distance: REGION_LEAD_TICKS (300) of travel at 1x, fewer at speed.
 assert.equal(REGION_LEAD_PX,720);
 assert.equal(sceneryTick(0),0);assert.equal(sceneryTick(250),0,'the first 720 px show farmland');
 for(const tick of [400,5_000,40_000,120_000]){
  const t=sceneryTick(tick);
  assert.ok(distanceAtTick(t)<=distanceAtTick(tick)-REGION_LEAD_PX&&distanceAtTick(t+1)>distanceAtTick(tick)-REGION_LEAD_PX,`scenery tick at ${tick}`);
  assert.ok(tick-t<=REGION_LEAD_TICKS);
 }
 const state={};
 for(let lap=0;lap<4;lap++)for(const [i,seg] of REGION_SCHEDULE.entries()){
  const slot=lap*REGION_LOOP_SLOTS+seg.startSlot;if(slot===0)continue;
  const switchTick=regionSwitchTick(slot);
  const x=courseObstacleX(slot,switchTick);
  assert.ok(x<=460&&x>280,`${seg.id} lap ${lap+1}: scenery switches with its first obstacle at x ${x.toFixed(1)}`);
  assert.ok(courseObstacleX(slot,switchTick-1)>460,`${seg.id} lap ${lap+1}: not before it is within 180 px`);
  let arrival=switchTick;while(courseObstacleX(slot,arrival)>280)arrival++;
  courseRegionState(arrival,state);assert.equal(state.index,i,`${seg.id} lap ${lap+1}: its first obstacle arrives under its own scenery`);
  courseRegionState(switchTick-1,state);assert.equal(state.index,(i+6)%7);
 }
});

test('each region draws a region-appropriate obstacle mix and every low passage has a runway',()=>{
 const seen=new Map(ORDER.map(id=>[id,new Set()]));
 for(let seed=1;seed<=40;seed++)for(let index=0;index<REGION_LOOP_SLOTS*2;index++){
  const {region,local,loop}=regionForObstacle(index),kind=courseKind(seed,index);
  const allowed=[...region.passages[local],...(region.low.slots.includes(local)?region.low.kinds:[])];
  assert.ok(allowed.includes(kind),`${region.id}#${local} (lap ${loop+1}) rolled ${kind}`);
  seen.get(region.id).add(kind);
  const o=buildCourseObstacle({seed,index,x:0});
  assert.equal(o.route,passageRoute(kind));
  if(kind==='town')assert.equal(o.variant,{town:'town',city:'city',suburbs:'suburb'}[region.id]);
 }
 for(const r of CHIKUN_REGIONS){
  const routes=[...r.passages.flat(),...r.low.kinds].map(passageRoute);
  assert.ok(r.passages.flat().every(k=>passageRoute(k)!=='ground'),r.id+' slot lists hold no low passage; low.kinds do');
  assert.ok(r.low.kinds.every(k=>passageRoute(k)==='ground')&&r.low.count>=1&&r.low.slots.length>r.low.count,r.id+' seeds where its low passages fall');
  assert.ok(routes.includes('flight'),r.id+' needs a required flight passage');
  assert.ok(routes.includes('ground'),r.id+' needs a low passage');
  assert.ok(routes.includes('choice'),r.id+' needs optional routes');
  assert.ok(seen.get(r.id).size>=4,r.id+' rolls at least four obstacle kinds');
 }
 assert.ok(CHIKUN_REGIONS[0].passages[0].every(k=>passageRoute(k)==='choice'),'farmland opens on a simple ground hurdle');
 for(let slot=0;slot<REGION_LOOP_SLOTS;slot++){
  const {region,local}=regionForObstacle(slot),prev=regionForObstacle((slot-1+REGION_LOOP_SLOTS)%REGION_LOOP_SLOTS);
  if(!region.low.slots.includes(local))continue;
  assert.ok(local>0,`slot ${slot}: a low passage never opens a region`);
  assert.ok(!prev.region.passages[prev.local].some(isGapKind),`slot ${slot}: a low passage must not follow a gap`);
  assert.ok(!region.passages[local].includes('plane')&&!region.passages[local].some(k=>['forest','town'].includes(k)),`slot ${slot}: planes and signature flight passages stay`);
 }
 const kinds=id=>CHIKUN_REGIONS.find(r=>r.id===id).passages.flat();
 assert.ok(kinds('farmland').includes('hurdle')&&kinds('farmland').includes('oak'));
 assert.ok(kinds('forest').includes('waterfall')&&kinds('forest').includes('forest')&&kinds('forest').includes('willow'));
 assert.ok(kinds('town').includes('town')&&kinds('city').includes('town')&&kinds('suburbs').includes('town'));
 assert.ok(kinds('industrial').includes('pipe')&&kinds('coast').includes('pelican')&&kinds('coast').includes('waterfall'));
});

test('obstacle placement is deterministic across the loop boundary and a full-lap replay verifies exactly',()=>{
 const boundary=REGION_LOOP_SLOTS*COURSE_CADENCE;
 for(const tick of [boundary-400,boundary,boundary+400,boundary*2+50]){
  const a=courseObstacles(19,tick),b=courseObstacles(19,tick);
  assert.deepEqual(a,b);assert.ok(a.length>0);
  for(let i=1;i<a.length;i++)assert.ok(a[i].x-(a[i-1].x+a[i-1].width)>=220,'full recovery interval across the loop');
 }
 assert.ok(courseObstacles(19,boundary).some(o=>o.index>=REGION_LOOP_SLOTS),'indices keep counting; nothing resets at the loop');
 assert.equal(regionForObstacle(REGION_LOOP_SLOTS).region.id,'farmland');assert.equal(regionForObstacle(REGION_LOOP_SLOTS).loop,1);
 assert.equal(regionForObstacle(REGION_LOOP_SLOTS-1).region.id,'coast');
 const run=createChikunRuntime({seed:19,maxTicks:LAP_SWITCH+1500});
 const snapshot=pilotRun(run);
 assert.equal(snapshot.terminal,true);assert.equal(snapshot.terminalReason,'run-complete');
 assert.equal(snapshot.region,'Farmland','the lap ended back in farmland');
 const result=run.result();
 assert.equal(result.evidence.version,'chikun-flap-evidence-v6');
 assert.deepEqual(replayChikunRun(result.evidence),result);
 assert.ok(result.forksPassed>=REGION_LOOP_SLOTS&&result.score>10000);
});

test('speed, score and difficulty keep ramping through the loop instead of resetting',()=>{
 const loopTick=LAP_SWITCH;
 const before=buildChikunDifficulty(loopTick-1),after=buildChikunDifficulty(loopTick);
 assert.ok(after.speedMultiplier>before.speedMultiplier);assert.ok(after.level>=before.level);
 assert.ok(buildChikunDifficulty(loopTick*2).speedMultiplier>after.speedMultiplier);
 const run=createChikunRuntime({seed:7,maxTicks:loopTick+600});let scoreAtLoop=0,speedAtLoop=0;
 while(!run.terminal){const s=run.snapshot();if(s.tick===loopTick){scoreAtLoop=s.score;speedAtLoop=s.difficulty.speedMultiplier;}run.step({flap:routePilot(s)});}
 const end=run.snapshot();
 assert.ok(scoreAtLoop>0&&end.score>scoreAtLoop);assert.ok(end.difficulty.speedMultiplier>speedAtLoop);
 assert.equal(end.terminalReason,'run-complete');
});

test('every region layer paints day and night, and the mode screens tease the daily challenge and rewards',()=>{
 const calls=[];
 const ctx=new Proxy({},{get:(t,key)=>key in t?t[key]:(...args)=>{calls.push(key);return key.startsWith('create')?{addColorStop(){}}:undefined;},set:(t,key,value)=>{t[key]=value;return true;}});
 for(const r of CHIKUN_REGIONS)for(let depth=0;depth<3;depth++)for(const night of [false,true]){calls.length=0;assert.equal(paintRegionLayer(ctx,r.id,depth,night),true);assert.ok(calls.length>40,`${r.id} depth ${depth} draws`);}
 assert.equal(paintRegionLayer(ctx,'moon',0),false);
 assert.equal(REGION_LAYERS.length,3);assert.ok(REGION_LAYERS.every(l=>l.width>=1280&&l.top+l.height<=690));
 const free=buildChikunModeTease('free'),ranked=buildChikunModeTease('ranked');
 assert.match(free.daily,/Daily Challenge — coming soon/);assert.equal(free.rewards,'');
 assert.doesNotMatch(JSON.stringify(free),/wallet|web3|token|zkltc/i,'Free Mode stays free with no Web3 implications');
 assert.match(ranked.daily,/Daily Challenge — coming soon/);assert.match(ranked.rewards,/High-score rewards coming soon/);
 assert.match(ranked.rewardsDetail,/week, month and year/);
 const html=readFileSync(new URL('../apps/portal/chikun/index.html',import.meta.url),'utf8');
 const hud=html.slice(html.indexOf('<div class="hud">'),html.indexOf('class="route-readout"'));
 assert.doesNotMatch(hud,/modeTease/,'the tease stays out of the gameplay HUD');
 assert.ok(html.indexOf('id="modeTease"')>html.indexOf('id="startOverlay"')&&html.indexOf('id="modeTease"')<html.indexOf('id="startButton"'),'the tease sits on the start overlay');
 assert.match(html,/Farmland · RUNNING/);
 assert.match(readFileSync(new URL('../apps/chikun/src/main.mjs',import.meta.url),'utf8'),/renderModeTease\(\)/);
});
