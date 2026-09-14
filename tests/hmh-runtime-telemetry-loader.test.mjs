import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntimeTelemetry } from '../apps/hmh-reboot/src/runtime-telemetry-loader.mjs';

test('ordinary gameplay never requests the diagnostic writer',async()=>{
  const result=await loadRuntimeTelemetry({debugGridEnabled:false,releaseTelemetryEnabled:false},()=>{throw Error('unexpected download');});
  assert.equal(result,null);
});
test('both supported evidence modes load the actual writer once and retain failures',async()=>{
  for(const flags of [{debugGridEnabled:true},{releaseTelemetryEnabled:true}]){
    let calls=0;const writer=()=>{};
    assert.equal(await loadRuntimeTelemetry(flags,async()=>{calls++;return {writeRuntimeTelemetry:writer};}),writer);
    assert.equal(calls,1);
    await assert.rejects(loadRuntimeTelemetry(flags,async()=>{throw Error('missing evidence module');}),/missing evidence/);
  }
});
