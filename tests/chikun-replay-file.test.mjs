import test from 'node:test';import assert from 'node:assert/strict';
import {simulateChikunRun} from '../apps/portal/src/chikun-cabinet.mjs';
import {exportChikunReplay,importChikunReplay} from '../apps/chikun/src/replay-file.mjs';
test('replay files contain no account/session identity and cannot supply a score',()=>{
 const r=simulateChikunRun({seed:1,taps:[12,25],maxTicks:140}),text=exportChikunReplay({...r,wallet:'secret',sessionId:'private'});assert.doesNotMatch(text,/secret|private|wallet|score/);assert.deepEqual(importChikunReplay(text),r);
 assert.throws(()=>importChikunReplay(text.replace('"game"','"score":900000,"game"')),/supported/);
});
test('malformed, oversized and invalid replay streams fail closed',()=>{
 for(const text of ['{','x'.repeat(65537),'{}'])assert.throws(()=>importChikunReplay(text));
 const d=JSON.parse(exportChikunReplay(simulateChikunRun({maxTicks:10})));d.evidence.flapSteps=[4,2];assert.throws(()=>importChikunReplay(JSON.stringify(d)),/increasing/);
});
