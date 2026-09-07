import { test } from 'node:test';
import assert from 'node:assert/strict';
const load=async()=>{const m=await import('../sdk/stacked-run-summary-schema.mjs');assert.ok(m,'bounded STACKED wire summary validator is required');return m;};
import { summaryFixture } from './fixtures/stacked-summary-fixture.mjs';
test('wire summary accepts exact schema and rejects missing/extra keys at every nesting level',async()=>{
 const {validateStackedRunSummary}=await load();const good=summaryFixture();assert.equal(validateStackedRunSummary(good),'');
 for(const group of [null,...Object.keys(good).filter(key=>typeof good[key]==='object')]){
  const target=group?good[group]:good;
  for(const key of Object.keys(target)){
   const bad=structuredClone(good);delete (group?bad[group]:bad)[key];assert.notEqual(validateStackedRunSummary(bad),'',`${group}.${key}`);
  }
  const bad=structuredClone(good);(group?bad[group]:bad).extra=0;assert.notEqual(validateStackedRunSummary(bad),'');
 }
});
test('wire summary rejects negative/fractional/nonfinite values for every integer field',async()=>{
 const {validateStackedRunSummary}=await load();const good=summaryFixture();
 for(const [group,obj]of Object.entries(good))if(typeof obj==='object')for(const [key,value]of Object.entries(obj))if(typeof value==='number')for(const invalid of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER]){
  const bad=structuredClone(good);bad[group][key]=invalid;assert.notEqual(validateStackedRunSummary(bad),'',`${group}.${key}`);
 }
});
test('wire summary enforces all eleven cross-field identities and reserved zero versus fields',async()=>{
 const {validateStackedRunSummary}=await load();
 const mutations=[s=>s.clears.singles=1,s=>s.technique.spinClears=5,s=>s.technique.spins=11,s=>{s.technique.holds=15;s.technique.hardDrops=15;},
 s=>s.pressure.garbageRowsCleared=1,s=>s.identity.endTick=61,s=>s.totals.pieces=1,s=>{s.identity.mode='ranked';s.totals.level=2;},
 s=>s.totals.elapsedMs=1002,s=>s.pressure.topOutTick=59,s=>s.identity.terminalReason='tick-ceiling',s=>s.versus.wins=1];
 for(const mutate of mutations){const bad=summaryFixture();mutate(bad);assert.notEqual(validateStackedRunSummary(bad),'');}
 const free=summaryFixture();free.totals.level=15;assert.equal(validateStackedRunSummary(free),'');
});
