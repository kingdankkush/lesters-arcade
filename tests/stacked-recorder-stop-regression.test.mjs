import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedInputRecorder, decodeSic1 } from '../apps/portal/src/stacked-sim.mjs';
test('stop forces one neutral commit even when the physical input is resampled before resume',()=>{
 for(const reason of ['pause','blur','visibility-hidden'])for(let held=1;held<=255;held++){
  const recorder=createStackedInputRecorder({seed:1});recorder.sample(1,held);recorder.commit();
  const before=recorder.encode();recorder.stop(reason);recorder.sample(2,held);recorder.sample(2,255);
  assert.deepEqual(recorder.encode(),before,'stopping does not change consumed history');
  assert.equal(recorder.commit(),0,`${reason} held ${held}`);
  recorder.sample(3,held);assert.equal(recorder.commit(),held,'forced neutral is consumed once');
  assert.deepEqual(decodeSic1(recorder.encode()).transitions,[{tick:1,mask:held},{tick:2,mask:0},{tick:3,mask:held}]);
 }
});
