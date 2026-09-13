import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STACKED_MAX_STORED_REPLAY_CHARS, STACKED_REPLAY_INDEX_KEY, STACKED_REPLAY_KEY_PREFIX } from '../apps/portal/src/stacked-contracts.mjs';
const load=async()=>{const module=await import('../apps/portal/src/stacked-replay-store.mjs');assert.ok(module,'bounded replay store is required');return module;};
function storage(){const data=new Map([['lesters-arcade-save-v1','untouched leaderboard']]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
const record=(sessionId,score=1,encoded='AAAA')=>({sessionId,score,encoded,mode:'ranked',resultHash:'0x'+'a'.repeat(64)});
test('replay store keeps recent and best at two, independent of main save',async()=>{
 const {createStackedReplayStore}=await load(), s=storage(), store=createStackedReplayStore(s);
 assert.equal(store.write(record('run-best',100)).stored,true);
 store.write(record('run-two',20));store.write(record('run-three',30));
 assert.equal(store.read('run-two'),null);
 assert.equal(store.read('run-best').score,100);assert.equal(store.read('run-three').score,30);
 assert.equal(s.data.get('lesters-arcade-save-v1'),'untouched leaderboard');
 assert.equal(JSON.parse(s.data.get(STACKED_REPLAY_INDEX_KEY)).length,2);
 assert.equal(s.data.has(STACKED_REPLAY_KEY_PREFIX+'run-two'),false);
 store.write(record('run-new-best',200));assert.equal(store.read('run-three').score,30);
 store.write(record('run-four',10));assert.equal(store.read('run-best'),null);assert.equal(store.read('run-new-best').score,200);
});
test('cap-sized replay storage is measured and over-budget refusal is nonfatal',async(t)=>{
 const {createStackedReplayStore}=await load(),s=storage(),store=createStackedReplayStore(s);
 const encoded='A'.repeat(STACKED_MAX_STORED_REPLAY_CHARS);
 assert.equal(store.write(record('cap-one',100,encoded)).stored,true);
 assert.equal(store.write(record('cap-two',99,encoded)).stored,true);
 const chars=[...s.data].filter(([key])=>key.startsWith(STACKED_REPLAY_KEY_PREFIX)).reduce((sum,[key,value])=>sum+key.length+value.length,0);
 t.diagnostic(JSON.stringify({storedCharsIncludingKeysAndMetadata:chars,assumedOriginChars:2500000,share:chars/2500000}));
 assert.ok(chars>=STACKED_MAX_STORED_REPLAY_CHARS*2&&chars<STACKED_MAX_STORED_REPLAY_CHARS*2+2048);
 assert.deepEqual(store.write(record('too-large',101,encoded+'A')),{stored:false,reason:'replay-too-large'});
 assert.equal(store.read('cap-one').score,100);
});
test('quota or index-write failures never remove existing replays or touch main save',async()=>{
 const {createStackedReplayStore}=await load(),s=storage(),store=createStackedReplayStore(s);
 store.write(record('run-one',100));store.write(record('run-two',99));
 const before=new Map(s.data), original=s.setItem;
 s.setItem=(k,v)=>{if(k===STACKED_REPLAY_INDEX_KEY)throw new Error('quota');original(k,v);};
 const failed=store.write(record('run-three',101));assert.equal(failed.stored,false);assert.deepEqual(s.data,before);
 s.setItem=()=>{throw new Error('quota');};
 assert.equal(store.write(record('run-four',103)).stored,false);assert.deepEqual(s.data,before);
});
test('Free, malformed records and reserved index session cannot affect Ranked replay storage',async()=>{
 const {createStackedReplayStore}=await load(),s=storage(),store=createStackedReplayStore(s),before=new Map(s.data);
 for(const value of [{...record('free-one'),mode:'free'},record('index'),record('BAD'),record('negative',-1),{...record('bad-hash'),resultHash:'0x00'},{...record('bad-b64'),encoded:'='},null]) assert.equal(store.write(value).stored,false);
 assert.deepEqual(s.data,before);
 s.data.set(STACKED_REPLAY_INDEX_KEY,'not json');assert.equal(store.write(record('new-run')).stored,false);
 assert.equal(s.data.get(STACKED_REPLAY_INDEX_KEY),'not json');
});
