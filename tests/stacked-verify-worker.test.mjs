import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import * as sim from '../apps/portal/src/stacked-sim.mjs';
const load=async()=>{const module=await import('../apps/stacked/src/verify-worker.mjs');assert.ok(module,'rendering-free verifier worker is required');return module;};
test('real isolated worker and inline replay return identical canonical golden tuple',async()=>{
 await load();
 const fixture=JSON.parse(await readFile(new URL('./fixtures/stacked-golden-run.json',import.meta.url),'utf8'));
 const recorder=sim.createStackedInputRecorder({seed:fixture.seed});
 fixture.masks.forEach((mask,i)=>{recorder.sample(i+1,mask);recorder.commit();});
 const request={requestId:'verify-1',evidence:recorder.encode(),expectedSeed:fixture.seed,maxTicks:fixture.maxTicks,config:{startLevel:fixture.startLevel,buildHash:fixture.buildHash,seasonId:fixture.seasonId}};
 const expected=sim.replayStackedRun(request.evidence,request);
 const worker=new Worker(new URL('./fixtures/stacked-worker-runner.mjs',import.meta.url));
 try {
  const response=once(worker,'message');worker.postMessage(request);
  assert.deepEqual((await response)[0],{requestId:'verify-1',ok:true,tuple:expected});
  const invalid=once(worker,'message');worker.postMessage({...request,requestId:'verify-2',expectedSeed:123});
  assert.deepEqual((await invalid)[0],{requestId:'verify-2',ok:false,error:'invalid-evidence'});
 }finally{await worker.terminate();}
});
test('worker rejects malformed requests without issuing any verified stamp',async()=>{
 const {handleStackedVerificationRequest}=await load();
 for(const request of [null,{}, {requestId:'x',evidence:'bad'}, {requestId:'valid-1',evidence:new Uint8Array(1),expectedSeed:1,maxTicks:1,config:{},extra:1}]){
  const response=handleStackedVerificationRequest(request);assert.equal(response.ok,false);assert.equal(Object.hasOwn(response,'tuple'),false);
 }
});
