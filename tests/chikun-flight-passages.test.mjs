import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {courseKind,buildCourseObstacle,courseObstacles,groundPickups}from'../apps/portal/src/chikun-ground-course.mjs';
import {obstacleClearance}from'../apps/portal/src/chikun-obstacles.mjs';
import {replayChikunRun,simulateChikunRun}from'../apps/portal/src/chikun-cabinet.mjs';
test('early course teaches sustained flight and every twelve passages mix high, low and optional routes',()=>{
 assert.ok(['pit','waterfall'].includes(courseKind(1,1)));
 for(let seed=1;seed<=30;seed++)for(let start=0;start<72;start+=12){
  const entries=Array.from({length:12},(_,i)=>buildCourseObstacle({seed,index:start+i,x:0}));
  assert.ok(entries.filter(o=>o.route==='flight').length>=5,'enough required flight');
  assert.ok(entries.filter(o=>o.route==='ground').length>=2,'required low passages');
  assert.ok(entries.filter(o=>o.route==='choice').length>=2,'optional routes');
 }
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
