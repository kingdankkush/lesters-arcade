import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedRuntime,createStackedInputRecorder,replayStackedRun,cellsFor,collides } from '../apps/portal/src/stacked-sim.mjs';
const load=async()=>{const m=await import('../apps/stacked/src/dev/soak-pilot.mjs');assert.ok(m,'Free-only deterministic soak pilot is required');return m;};
test('soak pilot is refused in Ranked and cannot mutate runtime snapshots',async()=>{
 const {createStackedSoakPilot}=await load();assert.throws(()=>createStackedSoakPilot({mode:'ranked'}));assert.throws(()=>createStackedSoakPilot({}));
 const runtime=createStackedRuntime({seed:1}),state=runtime.snapshot(),before=JSON.stringify(state),pilot=createStackedSoakPilot({mode:'free'});
 const mask=pilot.sample(state);assert.ok(Number.isInteger(mask)&&mask>=0&&mask<=255);assert.equal(JSON.stringify(state),before);
});
test('Free pilot produces an uninterrupted 100000-tick terminal run and replay-identical tuple',async(t)=>{
 const {createStackedSoakPilot}=await load();const runtime=createStackedRuntime({seed:1,maxTicks:100000}),pilot=createStackedSoakPilot({mode:'free'}),recorder=createStackedInputRecorder({seed:1});
 while(!runtime.terminal){const state=runtime.snapshot(),mask=pilot.sample(state);assert.ok(Number.isInteger(mask)&&mask>=0&&mask<=255);if(mask&3){const dx=mask&1?-1:1;assert.equal(collides(state.board,cellsFor(state.active.kind,state.active.rotation,state.active.x+dx,state.active.y)),false,'pilot requested blocked movement at tick '+(state.tick+1));}recorder.sample(recorder.tick+1,mask);runtime.step(recorder.commit());}
 const result=runtime.result();t.diagnostic(JSON.stringify({ticks:result.ticks,lines:result.lines,pieces:result.pieces,terminal:result.terminalReason}));
 assert.ok(result.ticks>=100000,'pilot must meet the planned tick target without restarts');
 assert.deepEqual(replayStackedRun(recorder.encode(),{expectedSeed:1,maxTicks:100000}),result);
});
