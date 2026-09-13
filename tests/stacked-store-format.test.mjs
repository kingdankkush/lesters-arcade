import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedReplayStore } from '../apps/portal/src/stacked-replay-store.mjs';
test('replay storage rejects noncanonical base64url unused padding bits',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const store=createStackedReplayStore(storage);
 for(const encoded of ['AB','ABC'])assert.equal(store.write({mode:'ranked',sessionId:'run-canonical',encoded,score:1,resultHash:'0x'+'a'.repeat(64)}).stored,false);
 assert.equal(data.size,0);
 assert.equal(store.write({mode:'ranked',sessionId:'run-canonical',encoded:'AAA',score:1,resultHash:'0x'+'a'.repeat(64)}).stored,true);
});
