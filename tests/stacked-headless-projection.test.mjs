import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedRuntime,createStackedInputRecorder,simulateStackedRun,replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';
import { BOARD_WIDTH,BOARD_ROWS } from '../apps/portal/src/stacked-contracts.mjs';
test('headless replay does not allocate or freeze a renderer board projection at each step',()=>{
 const inputs=Array(50).fill(0),recorder=createStackedInputRecorder({seed:1});for(let i=1;i<=50;i++){recorder.sample(i,0);recorder.commit();}
 const bytes=recorder.encode(),expectedRuntime=createStackedRuntime({seed:1,maxTicks:50});for(const mask of inputs)expectedRuntime.step(mask);
 const expected=expectedRuntime.result(),original=Object.freeze;let boards=0;
 try{
  Object.freeze=value=>{if(Array.isArray(value)&&value.length===BOARD_WIDTH*BOARD_ROWS)boards++;return original(value);};
  assert.deepEqual(simulateStackedRun({seed:1,inputs,maxTicks:50}),expected);
  assert.deepEqual(replayStackedRun(bytes,{expectedSeed:1,maxTicks:50}),expected);
 }finally{Object.freeze=original;}
 assert.equal(boards,2,'only one final result snapshot per run, never per-tick renderer projections');
});
test('public step continues to return isolated deep-frozen projections',()=>{
 const runtime=createStackedRuntime({seed:1,maxTicks:50}),first=runtime.step(0);assert.equal(first.tick,1);assert.equal(Object.isFrozen(first.board),true);
 const second=runtime.step(0);assert.equal(second.tick,2);assert.notEqual(first.board,second.board);assert.equal(first.tick,1);
});
