import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChikunRuntime, replayChikunRun, simulateChikunRun} from '../apps/portal/src/chikun-cabinet.mjs';
import {speedAtTick, distanceAtTick, buildCourseObstacle, GROUND_SKY_KINDS} from '../apps/portal/src/chikun-ground-course.mjs';
import {obstacleClearance} from '../apps/portal/src/chikun-obstacles.mjs';

test('starts grounded, jumps on one tap, takes flight on the next, and safely lands',()=>{
 const run=createChikunRuntime({seed:1,maxTicks:1000});
 assert.equal(run.snapshot().chikun.locomotion,'run');
 for(let i=0;i<10;i++)run.step();
 assert.equal(run.snapshot().chikun.y,660);
 const jump=run.step({flap:true});assert.equal(jump.chikun.locomotion,'jump');assert.ok(jump.chikun.y<660);
 const fly=run.step({flap:true});assert.equal(fly.chikun.locomotion,'flight');
 for(let i=0;i<110&&!run.terminal;i++)run.step();
 assert.equal(run.terminal,false);assert.equal(run.snapshot().chikun.locomotion,'run');
});
test('speed follows the requested continuous two-minute ramp with consistent distance',()=>{
 for(const [seconds,speed] of [[0,1],[120,1.25],[240,1.5],[360,1.75],[480,2],[600,2.25]])assert.equal(speedAtTick(seconds*60),speed);
 for(const t of [1,7200,14400,28800,60000])assert.ok(Math.abs(distanceAtTick(t)-distanceAtTick(t-1)-2.4*speedAtTick(t-1))<1e-8);
});
test('ground and sky obstacles have safe collectible paths and visible collision shapes',()=>{
 for(const kind of GROUND_SKY_KINDS)for(let seed=1;seed<=20;seed++){
  const o=buildCourseObstacle({seed,index:20,tick:500,x:600,kind});
  assert.ok(o.shapes.length>0,kind);assert.ok(o.width>0);
  assert.ok(obstacleClearance(o,o.coin.x,o.coin.y,30)>=0,kind+' collectible intersects hazard');
  assert.ok(o.coin.y>=70&&o.coin.y<=660,kind+' collectible outside lane');
 }
});
test('both historical recording versions retain exact scores and final states',()=>{
 for(const version of [1,2]){const old=JSON.parse(readFileSync(new URL(`./fixtures/chikun-v${version}-replay.json`,import.meta.url)));assert.deepEqual(replayChikunRun(old.evidence),old);}
});
test('new jump/flight evidence replays exact results',()=>{
 const run=simulateChikunRun({seed:22,taps:[42,54,88,125,167,202,245],maxTicks:1200});
 assert.equal(run.evidence.version,'chikun-flap-evidence-v3');assert.deepEqual(replayChikunRun(run.evidence),run);
});
