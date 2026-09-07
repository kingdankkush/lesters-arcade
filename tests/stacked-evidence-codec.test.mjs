import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS, STACKED_MAX_EVIDENCE_BYTES, STACKED_MAX_INPUT_TRANSITIONS } from '../apps/portal/src/stacked-contracts.mjs';

function requireCodec() {
  assert.equal(typeof sim.encodeSic1, 'function', 'SIC1 encoder is required');
  assert.equal(typeof sim.decodeSic1, 'function', 'SIC1 decoder is required');
}
function checksum(bytes) {
  let hash = 2166136261;
  for (let i = 24; i < bytes.length; i += 1) hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(20, hash);
  return bytes;
}
function withBody(body, ticks, count) {
  const bytes = new Uint8Array(24 + body.length);
  bytes.set([83,73,67,49,1,1,0,60]);
  const v = new DataView(bytes.buffer);
  v.setUint32(8, 99); v.setUint32(12, ticks); v.setUint32(16, count);
  bytes.set(body, 24); return checksum(bytes);
}

test('SIC1 pinned header, short/general records, terminator and unsigned seed', () => {
  requireCodec();
  const transitions = [{tick:1,mask:1},{tick:17,mask:0},{tick:18,mask:3},{tick:147,mask:7}];
  const bytes = sim.encodeSic1({seed:0xffffffff,totalTicks:147,transitions});
  assert.deepEqual([...bytes.slice(0,12)], [83,73,67,49,1,1,0,60,255,255,255,255]);
  assert.deepEqual([...bytes.slice(24)], [0,120,128,0,3,128,128,1,7,255,147,1]);
  assert.deepEqual(sim.decodeSic1(bytes), {seed:0xffffffff,totalTicks:147,transitionCount:4,transitions});
  assert.ok(Object.isFrozen(sim.decodeSic1(bytes).transitions[0]));
});

test('SIC1 round-trips 10000 seeded legal streams without losing tick zero/last tick', () => {
  requireCodec();
  let state = 4321;
  const next = () => { state = (Math.imul(state,1664525)+1013904223)>>>0; return state; };
  for (let run = 0; run < 10000; run += 1) {
    const seed = next(), totalTicks = next()%600, transitions=[];
    let tick=0, mask=0;
    while ((tick += 1+next()%47) <= totalTicks) {
      let fresh = next()&255; if (fresh===mask) fresh ^= 1;
      mask=fresh; transitions.push({tick,mask});
    }
    assert.deepEqual(sim.decodeSic1(sim.encodeSic1({seed,totalTicks,transitions})), {seed,totalTicks,transitionCount:transitions.length,transitions});
  }
});

test('SIC1 encoder rejects malformed, sparse, nonmonotonic and over-limit records', () => {
  requireCodec();
  const good={seed:1,totalTicks:20,transitions:[{tick:1,mask:1}]};
  for (const patch of [
    {seed:-1},{seed:1.5},{seed:2**32},{totalTicks:-1},{totalTicks:STACKED_MAX_TICKS+1},
    {transitions:[{tick:0,mask:1}]},{transitions:[{tick:21,mask:1}]},
    {transitions:[{tick:1,mask:0}]},{transitions:[{tick:1,mask:256}]},
    {transitions:[{tick:2,mask:1},{tick:1,mask:2}]},
    {transitions:[{tick:1,mask:1},{tick:1,mask:2}]},
    {transitions:new Array(1)},{transitions:new Array(STACKED_MAX_INPUT_TRANSITIONS+1)},
  ]) assert.throws(()=>sim.encodeSic1({...good,...patch}));
});

test('SIC1 decoder fails closed on reserved tags, malformed varints, corrupt and trailing data', () => {
  requireCodec();
  for(let lead=0x81;lead<=0xfe;lead+=1) assert.throws(()=>sim.decodeSic1(withBody([lead,255,1],1,0)));
  for (const body of [[128],[128,128],[128,128,128,128,0,1,255,1],[128,128,0,1,255,1],
    [128,0,0,255,1],[0,255,0],[0,255,1,0],[0],[255,128,0],[8,255,1]]) {
    assert.throws(()=>sim.decodeSic1(withBody(body,1,1)), JSON.stringify(body));
  }
  const valid=sim.encodeSic1({seed:0,totalTicks:1,transitions:[{tick:1,mask:1}]});
  for(let length=0;length<valid.length;length+=1) assert.throws(()=>sim.decodeSic1(valid.slice(0,length)));
  for(const index of [0,4,5,6,16,20,24]) {const bad=valid.slice();bad[index]^=1;assert.throws(()=>sim.decodeSic1(bad));}
  const offset=new Uint8Array(valid.length+8);offset.set(valid,4);
  assert.equal(sim.decodeSic1(offset.subarray(4,-4)).seed,0);
  assert.throws(()=>sim.decodeSic1(new Uint8Array(STACKED_MAX_EVIDENCE_BYTES+1)));
  assert.throws(()=>sim.decodeSic1([...valid]));
});

test('max-density legal stream remains below evidence ceiling at the tick ceiling', () => {
  requireCodec();
  const transitions=Array.from({length:STACKED_MAX_TICKS},(_,i)=>({tick:i+1,mask:i%2===0?3:0}));
  const bytes=sim.encodeSic1({seed:1,totalTicks:STACKED_MAX_TICKS,transitions});
  assert.equal(bytes.length,24+STACKED_MAX_TICKS*3+4);
  assert.ok(bytes.length<STACKED_MAX_EVIDENCE_BYTES);
  assert.equal(sim.decodeSic1(bytes).transitionCount,STACKED_MAX_INPUT_TRANSITIONS);
});
