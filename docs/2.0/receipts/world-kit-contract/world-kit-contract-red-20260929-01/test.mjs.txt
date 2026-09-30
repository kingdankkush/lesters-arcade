import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
const bounds=vertices=>({minX:Math.min(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxX:Math.max(...vertices.map(p=>p.x)),maxY:Math.max(...vertices.map(p=>p.y))});
const make=vertices=>createGreyboxPiece({id:'contract-polygon',kind:'mass',height:180,bounds:bounds(vertices),vertices});

test('a five-point star cannot enter the physical kit even when every local turn has the same sign',()=>{
  const ring=Array.from({length:5},(_,i)=>({x:100+90*Math.cos(i*2*Math.PI/5),y:100+90*Math.sin(i*2*Math.PI/5)}));
  const star=[ring[0],ring[2],ring[4],ring[1],ring[3]];
  assert.throws(()=>make(star),/polygon|simple|intersect/);
});

test('a twice-wound polygon is rejected rather than hidden by canonical winding',()=>{
  const ring=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  assert.throws(()=>make([...ring,...ring]),/polygon|duplicate|simple|edge/);
});

test('a zero-length repeated edge is rejected independently of the star/winding cases',()=>{
  const ring=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  assert.throws(()=>make([ring[0],ring[1],ring[1],ring[2],ring[3]]),/polygon|duplicate|simple|edge/);
});

test('a simple triangle in either winding preserves its exact visible and physical footprint',()=>{
  const triangle=[{x:0,y:0},{x:100,y:0},{x:100,y:100}];
  for(const source of [triangle,[...triangle].reverse()]){const piece=make(source);assert.deepEqual(piece.visible.vertices,piece.blocker.shape.vertices);assert.deepEqual(new Set(piece.visible.vertices.map(p=>`${p.x},${p.y}`)),new Set(triangle.map(p=>`${p.x},${p.y}`)));}
});
