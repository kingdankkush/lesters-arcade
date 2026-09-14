import {createGroundRuntime} from '../apps/portal/src/chikun-ground-runtime.mjs';
import {courseObstacles,speedAtTick} from '../apps/portal/src/chikun-ground-course.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
test('five courses sustain repeated ground and air transitions with real fixed-step input',()=>{
const reports=[];
for(const seed of [1,45,928,12345,0xabcdef]){
 const runtime=createGroundRuntime({seed,maxTicks:9600});let lastTap=-100;
 while(!runtime.terminal){
  const s=runtime.snapshot(),c=s.chikun,nearest=courseObstacles(seed,s.tick).find(o=>o.x+o.width>=250);
  let target=660;
  if(nearest&&nearest.route!=='ground'&&nearest.family!=='sky'&&nearest.x-280<2.4*speedAtTick(s.tick)*135){
   target=nearest.family==='gap'?nearest.kind==='waterfall'?450:520:690-nearest.height-65;
  }
  const flap=target<660&&c.y>target&&(c.velocityY>-3.8||c.locomotion==='run')&&s.tick-lastTap>7;
  if(flap)lastTap=s.tick;runtime.step({flap});
 }
 reports.push({seed,...runtime.result().finalState});
}
assert.ok(reports.every(r=>r.terminalReason==='run-complete'),JSON.stringify(reports));assert.ok(reports.every(r=>r.forksPassed>=28));
});
