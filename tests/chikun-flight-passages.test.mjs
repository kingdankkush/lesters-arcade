import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {courseKind,buildCourseObstacle,courseObstacles,groundPickups}from'../apps/portal/src/chikun-ground-course.mjs';
import {REGION_SCHEDULE,REGION_LOOP_SLOTS}from'../apps/portal/src/chikun-course-regions.mjs';
import {obstacleClearance}from'../apps/portal/src/chikun-obstacles.mjs';
import {replayChikunRun,simulateChikunRun}from'../apps/portal/src/chikun-cabinet.mjs';
test('the course opens on a farmland hurdle and every region mixes required flight, low and optional passages',()=>{
 assert.ok(['hurdle','log','crate'].includes(courseKind(1,0)));
 assert.ok(['oak','willow'].includes(courseKind(1,1)),'a first tree teaches sustained flight');
 for(let seed=1;seed<=30;seed++)for(const seg of REGION_SCHEDULE){
  const entries=Array.from({length:seg.slots},(_,i)=>buildCourseObstacle({seed,index:seg.startSlot+i,x:0}));
  assert.ok(entries.some(o=>o.route==='flight'),seg.id+' required flight');
  assert.ok(entries.some(o=>o.route==='ground'),seg.id+' required low passage');
  assert.ok(entries.some(o=>o.route==='choice'),seg.id+' optional routes');
 }
 // Across a loop at least a third of passages demand flight and low passages never stack.
 const loop=Array.from({length:REGION_LOOP_SLOTS},(_,i)=>buildCourseObstacle({seed:19,index:i,x:0}));
 assert.ok(loop.filter(o=>o.route==='flight').length>=REGION_LOOP_SLOTS/3);
 for(let i=0;i<loop.length;i++)if(loop[i].route==='ground')assert.notEqual(loop[(i+1)%loop.length].route,'ground');
});
test('broad gaps, forests and towns visibly block the ground and retain a safe upper route',()=>{
 for(const kind of ['pit','waterfall','forest','town'])for(let seed=1;seed<=20;seed++){
  const o=buildCourseObstacle({seed,index:20,x:600,kind});assert.ok(o.width>=360,kind+' is a sustained passage');
  assert.equal(o.route,'flight');assert.ok(obstacleClearance(o,o.coin.x,o.coin.y,30)>=0,kind+' safe reward');
  if(o.family!=='gap')assert.ok(obstacleClearance(o,o.x+o.width/2,660,30)<0,kind+' blocks running');
 }
 for(const kind of ['canopy','storm']){const o=buildCourseObstacle({kind,x:600});assert.equal(o.route,'ground');assert.ok(obstacleClearance(o,o.coin.x,660,30)>=0);assert.ok(obstacleClearance(o,o.coin.x,300,30)<0);}
});
test('passages keep a full transition interval and coins do not lure runners into solid hazards',()=>{
 for(const tick of [0,3600,7200,18000,36000,108000]){
  const obstacles=courseObstacles(19,tick);
  for(let i=1;i<obstacles.length;i++)assert.ok(obstacles[i].x-(obstacles[i-1].x+obstacles[i-1].width)>=220);
  for(const coin of groundPickups(19,tick,obstacles))for(const o of obstacles)assert.ok(obstacleClearance(o,coin.x,coin.y,30)>=0);
 }
});
test('v3 recordings remain exact while new course results use v4 evidence',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/chikun-v3-replays.json',import.meta.url)));for(const r of old)assert.deepEqual(replayChikunRun(r.evidence),r);
 const now=simulateChikunRun({seed:19,taps:[100,120,142,164,186,208,230,252,274,296],maxTicks:1300});assert.equal(now.evidence.version,'chikun-flap-evidence-v4');assert.deepEqual(replayChikunRun(now.evidence),now);
});
