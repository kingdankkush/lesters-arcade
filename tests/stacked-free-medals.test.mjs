import test from 'node:test';
import assert from 'node:assert/strict';
import { completeFreeMedals, FREE_MEDALS } from '../apps/stacked/src/free-medals.mjs';
import { STACKED_FREE_MEDALS_KEY } from '../apps/portal/src/stacked-contracts.mjs';
import { describeFreeMedal } from '../apps/stacked/src/free-medals.mjs';

test('practice records retain real bests, milestone progress and truthful unlock dates', () => {
  let saved=JSON.stringify({version:1,medals:['stacked-first-seal'],runs:1,sessions:['old']});
  const storage={getItem:()=>saved,setItem:(k,v)=>{saved=v;}};
  const run={mode:'free',sessionId:'new',snapshot:{score:1234,lines:40,level:5,tick:1000,maxCombo:3},recordedAt:1789380000000};
  const first=completeFreeMedals(storage,run);
  assert.equal(first.previousBest,null);assert.equal(first.bestScore,1234);
  assert.equal(first.progress['stacked-lines-150'],40);
  assert.equal(first.earnedAt['stacked-first-seal'],null,'older unknown unlock dates stay unknown');
  assert.equal(first.earnedAt['stacked-lines-40'],1789380000000);
  const next=completeFreeMedals(storage,{...run,sessionId:'newer',snapshot:{...run.snapshot,score:1000,lines:5},recordedAt:1789380001000});
  assert.equal(next.previousBest,1234);assert.equal(next.bestScore,1234);assert.equal(next.progress['stacked-lines-150'],40,'single-run progress is not cumulative');
  assert.match(describeFreeMedal(FREE_MEDALS.find(m=>m.id==='stacked-lines-150')),/150.*one run/);
});
test('Ranked and assisted runs never touch the Free shelf', () => {
  const storage = new Proxy({}, {get(){throw Error('storage access forbidden');}});
  assert.deepEqual(completeFreeMedals(storage, {mode:'ranked'}).newMedals, []);
  assert.deepEqual(completeFreeMedals(storage, {mode:'free',assisted:true}).newMedals, []);
});

test('all sixteen thresholds unlock at their own boundaries and never from unrelated totals', () => {
  for (const medal of FREE_MEDALS) {
    let saved = null;
    const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
    const run = { mode: 'free', sessionId: medal.id, snapshot: { tick: 0 }, spinClears: 0 };
    if (medal.field === 'runs') saved = JSON.stringify({ version: 1, runs: 24, sessions: [], medals: [] });
    else if (medal.field === 'zone') run.snapshot.tick = medal.threshold === 3 ? 25200 : 90000;
    else if (medal.field === 'spinClears') run.spinClears = medal.threshold;
    else run.snapshot[medal.field] = medal.threshold;
    assert.ok(completeFreeMedals(storage, run).newMedals.some(item => item.id === medal.id), medal.id);
  }
});

test('a storage failure or future schema never reports a saved medal or overwrites future data', () => {
  const run = { mode: 'free', sessionId: 'run', snapshot: { tick: 60, lines: 1 } };
  for (const storage of [
    { getItem: () => null, setItem() { throw Error('quota'); } },
    { getItem: () => null, setItem() {} },
    { getItem: () => '{"version":2}', setItem() { assert.fail('future data overwritten'); } },
  ]) assert.deepEqual(completeFreeMedals(storage, run).newMedals, []);
});
test('Free medals are single-run milestones, idempotent, device-only and quota safe', () => {
  const values=new Map(),writes=[];
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{writes.push(k);values.set(k,v);}};
  const run={mode:'free',sessionId:'free-run-one',snapshot:{lines:1,tick:60,quadClears:0,maxCombo:0,perfectClears:0,maxBackToBack:0},spinClears:0};
  const first=completeFreeMedals(storage,run);
  assert.equal(first.newMedals[0].id,'stacked-first-seal');
  assert.equal(first.total,1); assert.deepEqual(new Set(writes),new Set([STACKED_FREE_MEDALS_KEY]));
  assert.equal(completeFreeMedals(storage,run).runs,1);
  const next=completeFreeMedals(storage,{...run,sessionId:'free-run-two',snapshot:{...run.snapshot,lines:39}});
  assert.equal(next.total,1,'cumulative 40 rows must not unlock a single-run 40-row medal');
  assert.equal(completeFreeMedals({getItem(){throw Error('blocked');}},run).saved,false);
});
