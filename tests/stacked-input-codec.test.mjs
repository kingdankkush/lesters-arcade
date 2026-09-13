import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../apps/portal/src/stacked-sim.mjs';

function recorder(seed=77) {
  assert.equal(typeof sim.createStackedInputRecorder,'function','tick recorder is required');
  return sim.createStackedInputRecorder({seed});
}
test('tick recorder forces tick zero neutral and coalesces only the pending tick',()=>{
  const r=recorder();
  assert.equal(r.sample(0,255),0);
  r.sample(1,1);r.sample(1,3);r.sample(1,0);
  assert.equal(r.commit(),0);
  r.sample(2,1);r.sample(2,3);assert.equal(r.commit(),3);
  r.sample(3,3);assert.equal(r.commit(),3);
  assert.deepEqual(sim.decodeSic1(r.encode()).transitions,[{tick:2,mask:3}]);
  assert.throws(()=>r.sample(2,0));assert.throws(()=>r.sample(5,1));
});
test('every recorder commit is exactly the byte stepped and replayed',()=>{
  const r=recorder(), live=sim.createStackedRuntime({seed:77,maxTicks:20});
  for(let tick=1;tick<=20;tick+=1){r.sample(tick,tick%4===0?16:0);const mask=r.commit();live.step(mask);}
  assert.deepEqual(sim.replayStackedRun(r.encode(),{maxTicks:20}),live.result());
  const decoded=sim.decodeSic1(r.encode());
  assert.equal(decoded.transitionCount,live.snapshot().transitionCount);
});
test('pause, blur and hidden synthesize pending neutral without rewriting consumed evidence',()=>{
  for(const reason of ['pause','blur','visibility-hidden']){
    const r=recorder();r.sample(1,4);assert.equal(r.commit(),4);
    const before=r.encode();r.sample(2,8);r.stop(reason);
    assert.deepEqual(r.encode(),before,'stopping cannot modify an already simulated tick');
    assert.equal(r.commit(),0);
    assert.deepEqual(sim.decodeSic1(r.encode()).transitions,[{tick:1,mask:4},{tick:2,mask:0}]);
  }
});
test('recorder rejects invalid seed, mask, tick and unknown stop reason',()=>{
  const r=recorder();
  assert.throws(()=>recorder(-1));assert.throws(()=>r.sample(1,256));
  assert.throws(()=>r.sample(1,NaN));assert.throws(()=>r.sample(-1,0));
  assert.throws(()=>r.stop('made-up'));
});
test('replay and simulation reject incomplete runs, extra ticks and seed/config substitution',()=>{
  assert.equal(typeof sim.simulateStackedRun,'function');
  assert.equal(typeof sim.replayStackedRun,'function');
  const evidence=sim.encodeSic1({seed:99,totalTicks:10,transitions:[]});
  assert.throws(()=>sim.replayStackedRun(evidence));
  assert.throws(()=>sim.replayStackedRun(evidence,{maxTicks:10,expectedSeed:100}));
  assert.throws(()=>sim.simulateStackedRun({seed:99,inputs:[0],maxTicks:10}));
  assert.throws(()=>sim.simulateStackedRun({seed:99,inputs:[0,0],maxTicks:1}));
  assert.throws(()=>sim.simulateStackedRun({seed:99,inputs:new Array(2),maxTicks:2}));
  const live=sim.createStackedRuntime({seed:99,maxTicks:10});
  for(let i=0;i<10;i+=1)live.step(0);
  assert.deepEqual(sim.replayStackedRun(evidence,{maxTicks:10,expectedSeed:99}),live.result());
});
