import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourseV2Runtime, replayCourseV2, COURSE_V2_EVIDENCE} from '../apps/portal/src/chikun-course-v2-runtime.mjs';
import {courseV2Pickups, courseV2Chase, courseV2Obstacles} from '../apps/portal/src/chikun-course-v2.mjs';
import {createGroundRuntime} from '../apps/portal/src/chikun-ground-runtime.mjs';
import {routePilot} from '../scripts/chikun-course-pilot.mjs';
import {createChikunReplayPlayback} from '../apps/chikun/src/replay-viewer.mjs';
import {exportChikunReplay,importChikunReplay} from '../apps/chikun/src/replay-file.mjs';

test('course two records held input and replays the exact result',()=>{
 const run=createCourseV2Runtime({seed:19,maxTicks:180});
 while(!run.terminal){const tick=run.snapshot().tick;run.step({flap:tick%45===0,glide:tick>=40&&tick<130});}
 const result=run.result();
 assert.equal(result.evidence.version,COURSE_V2_EVIDENCE);
 assert.deepEqual(result.evidence.glideDeltas,[40,90]);
 assert.deepEqual(replayCourseV2(result.evidence),result);
 assert.throws(()=>replayCourseV2({...result.evidence,glideDeltas:[40,0]}),/increasing/);
 assert.throws(()=>replayCourseV2({...result.evidence,glideDeltas:[180]}),/maxTicks/);
 assert.throws(()=>replayCourseV2({...result.evidence,extra:true}),/keys/);
});
test('first shield prevents exactly one obstacle hit, without changing the old course',()=>{
 const modern=createCourseV2Runtime({seed:1,maxTicks:1200}),old=createGroundRuntime({seed:1,maxTicks:1200});
 while(!old.terminal)old.step();
 while(!modern.terminal)modern.step();
 assert.equal(modern.result().shieldsUsed,1);
 assert.ok(modern.result().survivalTicks>old.result().survivalTicks);
 assert.equal(old.result().evidence.version,'chikun-flap-evidence-v6');
 assert.deepEqual(replayCourseV2(modern.result().evidence),modern.result());
 assert.equal(modern.result().nearMisses,0,'absorbed hit must not award a near miss');
});
test('pickups, chase and route geometry are seed-stable and bounded',()=>{
 assert.deepEqual(courseV2Pickups(1,60),courseV2Pickups(1,60));
 assert.equal(courseV2Pickups(1,60)[0].kind,'shield');
 for(let tick=0;tick<216000;tick+=73){
  const chase=courseV2Chase(123,tick);
  assert.deepEqual(chase,courseV2Chase(123,tick));
  if(chase)assert.ok(chase.remainingTicks>0&&chase.remainingTicks<=720);
  assert.ok(courseV2Pickups(123,tick).length<=6);
  for(const o of courseV2Obstacles(123,tick).filter(o=>o.family==='fork-route')){
   assert.ok(o.shapes.every(s=>s.y>=390&&s.y+s.height<=540));
   assert.equal(o.routeCoins.length,5);
   assert.equal(new Set([o.id,...o.routeCoins.map(c=>c.id)]).size,5,'middle coin has one identity');
  }
 }
});
test('held-input replay files and backward seeks reproduce the live state',()=>{
 const run=createCourseV2Runtime({seed:19,maxTicks:180});
 while(!run.terminal){const t=run.snapshot().tick;run.step({flap:t%45===0,glide:t>=30&&t<100});}
 const result=importChikunReplay(exportChikunReplay(run.result())),play=createChikunReplayPlayback(result.evidence);
 play.seek(150);const first=play.snapshot();play.seek(0);play.seek(150);assert.deepEqual(play.snapshot(),first);
 play.seek(180);assert.deepEqual(play.snapshot(),run.snapshot());assert.deepEqual(play.result,run.result());
});
test('maximum combined input traffic ends with canonical replayable evidence',()=>{
 const run=createCourseV2Runtime({seed:7,maxTicks:30000});
 while(!run.terminal){const s=run.snapshot();run.step({flap:routePilot(s),glide:s.tick%2===0});}
 const result=run.result(),count=result.evidence.flapDeltas.length+result.evidence.glideDeltas.length;
 assert.equal(result.finalState.terminalReason,'flap-limit');assert.equal(count,12000);
 assert.deepEqual(replayCourseV2(result.evidence),result);
});
