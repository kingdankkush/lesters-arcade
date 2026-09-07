import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_FIXED_STEP_HZ, STACKED_MAX_TICKS, STACKED_MAX_EVIDENCE_BYTES } from '../apps/portal/src/stacked-contracts.mjs';
test('simulation constants expose frozen actual replay limits',()=>{
 assert.ok(sim.STACKED_SIM_CONSTANTS);
 assert.equal(Object.isFrozen(sim.STACKED_SIM_CONSTANTS),true);
 assert.equal(sim.STACKED_SIM_CONSTANTS.fixedStepHz,STACKED_FIXED_STEP_HZ);
 assert.equal(sim.STACKED_SIM_CONSTANTS.maxTicks,STACKED_MAX_TICKS);
 assert.equal(sim.STACKED_SIM_CONSTANTS.maxEvidenceBytes,STACKED_MAX_EVIDENCE_BYTES);
});
test('encoder and simulation do not execute caller-supplied array iterators',()=>{
 const transitions=[{tick:1,mask:1}];
 transitions[Symbol.iterator]=()=>{throw new Error('hostile iterator');};
 const bytes=sim.encodeSic1({seed:1,totalTicks:1,transitions});
 assert.deepEqual(sim.decodeSic1(bytes).transitions,[{tick:1,mask:1}]);
 const inputs=[0];inputs[Symbol.iterator]=()=>{throw new Error('hostile iterator');};
 assert.equal(sim.simulateStackedRun({seed:1,maxTicks:1,inputs}).ticks,1);
});
