import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedAutoShift } from '../apps/portal/src/stacked-autoshift.mjs';
import { encodeSic1 } from '../apps/portal/src/stacked-sim.mjs';
import { chunkStackedEvidence } from '../apps/portal/src/stacked-evidence-transport.mjs';
import { validateStackedBridgeMessage } from '../apps/portal/src/stacked-bridge-protocol.mjs';
test('wall blocking stays latched even when vertical movement opens the same direction',()=>{
 for(const event of ['spawned','rotated']){const s=createStackedAutoShift();s.sample(-1);s.sample(-1,{canMove:false});for(let i=0;i<100;i++)assert.equal(s.sample(-1,{canMove:true}),0);assert.equal(s.sample(-1,{[event]:true}),1);}
});
test('held direction reversal recharges for exactly min(DAS,DCD) ticks',()=>{
 for(let dasTicks=4;dasTicks<=18;dasTicks++)for(let dcdTicks=0;dcdTicks<=8;dcdTicks++){
  const s=createStackedAutoShift({dasTicks,dcdTicks});assert.equal(s.sample(1),2);
  for(let i=0;i<Math.min(dasTicks,dcdTicks);i++)assert.equal(s.sample(-1),0,`DAS${dasTicks} DCD${dcdTicks}`);
  assert.equal(s.sample(-1),1);
 }
});
test('bridge already rejects reviewer cross-session chunk counterexample at envelope validation',()=>{
 const c=chunkStackedEvidence(encodeSic1({seed:1,totalTicks:1,transitions:[]}),{sessionId:'session-a'})[0];
 assert.deepEqual(validateStackedBridgeMessage(c,{sessionId:'session-b'}),{ok:false,error:'invalid-envelope'});
});
