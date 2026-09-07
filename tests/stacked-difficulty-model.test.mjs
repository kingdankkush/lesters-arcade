import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HASHPOWER_MAX,REORG_COST_PERIOD_TICKS } from '../apps/portal/src/stacked-contracts.mjs';
const load=async()=>{const m=await import('../scripts/write-stacked-difficulty-model.mjs');assert.ok(m,'numerically integrated difficulty model is required');return m;};
test('five numerically integrated predictions meet frozen target bands with assumptions labeled',async()=>{
 const {buildStackedDifficultyModel}=await load();const model=buildStackedDifficultyModel();
 assert.equal(model.tiers.length,5);assert.equal(model.assumptions.humanTelemetryAvailable,false);
 for(const row of model.tiers){assert.ok(row.topOutMinutes>=row.targetMinutes[0]&&row.topOutMinutes<=row.targetMinutes[1],JSON.stringify({tier:row.id,predicted:row.topOutMinutes,band:row.targetMinutes}));assert.ok(row.trace.length>10);}
});
test('god trace cannot reject garbage after the affordability wall and integration converges',async()=>{
 const {buildStackedDifficultyModel}=await load();const coarse=buildStackedDifficultyModel(),fine=buildStackedDifficultyModel({stepTicks:30});
 const god=coarse.tiers.find(t=>t.id==='god'),after=god.trace.filter(step=>step.tick>=HASHPOWER_MAX*REORG_COST_PERIOD_TICKS);assert.ok(after.length>0);
 for(const step of after){assert.equal(step.rejectedRowsPerMinute,0);assert.equal(step.garbageRowsPerMinute,step.injectedRowsPerMinute);}
 for(let i=0;i<coarse.tiers.length;i++){assert.ok(Math.abs(coarse.tiers[i].topOutMinutes-fine.tiers[i].topOutMinutes)<0.02);assert.ok(fine.tiers[i].trace.length>coarse.tiers[i].trace.length);}
});
test('committed difficulty artifact is byte-identical to a fresh numerical derivation',async()=>{
 const {buildStackedDifficultyModel}=await load();assert.equal(readFileSync(new URL('../docs/stacked/difficulty-model.json',import.meta.url),'utf8'),JSON.stringify(buildStackedDifficultyModel(),null,2)+'\n');
});
