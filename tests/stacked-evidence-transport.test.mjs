import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS, STACKED_MAX_EVIDENCE_BYTES, STACKED_EVIDENCE_CHUNK_RAW_BYTES, STACKED_MAX_EVIDENCE_CHUNKS } from '../apps/portal/src/stacked-contracts.mjs';
const load=async()=>{const module=await import('../apps/portal/src/stacked-evidence-transport.mjs');assert.ok(module,'bounded evidence transport is required');return module;};
const sessionId='game-session-123';

test('chunk transport includes exact envelope and round-trips max-density bytes under bridge cap',async()=>{
 const transport=await load();
 const transitions=Array.from({length:STACKED_MAX_TICKS},(_,i)=>({tick:i+1,mask:i%2?0:3}));
 const bytes=sim.encodeSic1({seed:17,totalTicks:STACKED_MAX_TICKS,transitions});
 const chunks=transport.chunkStackedEvidence(bytes,{sessionId});
 const expectedChunks=Math.ceil(bytes.length/STACKED_EVIDENCE_CHUNK_RAW_BYTES);
 assert.equal(chunks.length,expectedChunks);assert.ok(expectedChunks<=STACKED_MAX_EVIDENCE_CHUNKS);
 for(const [index,msg] of chunks.entries()){
  assert.deepEqual(Object.keys(msg).sort(),['protocol','type','sessionId','messageId','payload'].sort());
  assert.deepEqual(Object.keys(msg.payload).sort(),['chunkIndex','chunkCount','totalRawBytes','payload'].sort());
  assert.equal(msg.payload.chunkIndex,index);
  assert.equal(msg.payload.chunkCount,expectedChunks);
  assert.ok(new TextEncoder().encode(JSON.stringify(msg)).byteLength<=65536);
 }
 assert.deepEqual(transport.reassembleStackedEvidence(chunks,{sessionId}),bytes);
});
test('chunk reassembly rejects missing, duplicate, reordered, changed totals and cross-session messages',async()=>{
 const transport=await load();
 const transitions=Array.from({length:20000},(_,i)=>({tick:i+1,mask:i%2?0:3}));
 const bytes=sim.encodeSic1({seed:3,totalTicks:20000,transitions});
 const good=transport.chunkStackedEvidence(bytes,{sessionId});assert.equal(good.length,2);
 for(const mutate of [a=>a.pop(),a=>a.push(a[0]),a=>a.reverse(),a=>{a[1].payload.chunkIndex=0;},
  a=>{a[1].payload.chunkCount+=1;},a=>{a[1].payload.totalRawBytes-=1;},a=>{a[1].sessionId='another-session';},
  a=>{a[1].messageId=a[0].messageId;},a=>{a[0].payload.payload='AAAA';},a=>{a[0].payload.extra=true;},
  a=>{delete a[0].messageId;},a=>{a[0].payload.payload='!'.repeat(56000);},
  a=>{a[0].payload.totalRawBytes=STACKED_MAX_EVIDENCE_BYTES+1;},
  a=>{a[0].payload.chunkCount=STACKED_MAX_EVIDENCE_CHUNKS+1;}]){
   const bad=structuredClone(good);mutate(bad);assert.throws(()=>transport.reassembleStackedEvidence(bad,{sessionId}));
 }
 assert.throws(()=>transport.reassembleStackedEvidence(good,{sessionId:'wrong-session'}));
 assert.throws(()=>transport.reassembleStackedEvidence(new Array(1),{sessionId}));
});
test('reassembly rejects bad magic/checksum before allocating a decoded transition stream',async()=>{
 const transport=await load();
 const bytes=sim.encodeSic1({seed:3,totalTicks:1,transitions:[{tick:1,mask:1}]});
 const messages=transport.chunkStackedEvidence(bytes,{sessionId});
 for(const offset of [0,20]){
  const raw=bytes.slice();raw[offset]^=1;
  const bad=structuredClone(messages);bad[0].payload.payload=Buffer.from(raw).toString('base64');
  assert.throws(()=>transport.reassembleStackedEvidence(bad,{sessionId}));
 }
 assert.throws(()=>transport.chunkStackedEvidence(new Uint8Array(STACKED_MAX_EVIDENCE_BYTES+1),{sessionId}));
 assert.throws(()=>transport.chunkStackedEvidence(bytes,{sessionId:'INVALID'}));
});
