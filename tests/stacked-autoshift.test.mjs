import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedRuntime, cellsFor, collides } from '../apps/portal/src/stacked-sim.mjs';
const load=async()=>{const m=await import('../apps/portal/src/stacked-autoshift.mjs');assert.ok(m,'external bounded auto-shift is required');return m;};
test('auto-shift emits discrete DAS/ARR edges and never accumulates blocked movement',async()=>{
 const {createStackedAutoShift}=await load();const shift=createStackedAutoShift({dasTicks:8,arrTicks:2,dcdTicks:0});
 assert.deepEqual(Array.from({length:13},()=>shift.sample(-1)),[1,0,0,0,0,0,0,0,1,0,1,0,1]);
 for(let i=0;i<100;i++)assert.equal(shift.sample(-1,{canMove:false}),0);
 assert.equal(shift.sample(-1),0);assert.equal(shift.sample(-1,{rotated:true}),1);assert.equal(shift.sample(-1),0);
 assert.equal(shift.sample(1),2);assert.equal(shift.sample(0),0);
});
test('minimum ARR preserves rising-edge bytes and reversals apply DCD',async()=>{
 const {createStackedAutoShift}=await load();const shift=createStackedAutoShift({dasTicks:4,arrTicks:1,dcdTicks:2});
 const masks=Array.from({length:30},()=>shift.sample(1));for(let i=1;i<masks.length;i++)assert.ok(!(masks[i]&&masks[i-1]));
 assert.equal(shift.sample(-1),0);assert.equal(shift.sample(-1),0);assert.equal(shift.sample(-1),1);
 assert.equal(shift.sample(-1,{canMove:false}),0);assert.equal(shift.sample(-1,{rotated:true}),1);
 shift.reset();assert.equal(shift.sample(-1),1);
 for(const config of [{dasTicks:3},{arrTicks:0},{dcdTicks:9},{dasTicks:4.5}])assert.throws(()=>createStackedAutoShift(config));
});
test('auto-shift remains outside simulation and stops at a real live-runtime wall',async()=>{
 const {createStackedAutoShift}=await load();const shift=createStackedAutoShift();const runtime=createStackedRuntime({seed:1,maxTicks:100});
 let blocked=0;
 for(let tick=1;tick<=50;tick++){
  const state=runtime.snapshot(), canMove=!collides(state.board,cellsFor(state.active.kind,state.active.rotation,state.active.x-1,state.active.y));
  const mask=shift.sample(-1,{canMove});if(!canMove){blocked++;assert.equal(mask,0);}runtime.step(mask);
 }
 assert.ok(blocked>0);assert.equal(runtime.snapshot().tick,50);
});
