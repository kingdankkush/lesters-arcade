import test from 'node:test';import assert from 'node:assert/strict';
import {computeEnemySeparation} from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import {computeEnemySeparation as reference} from './fixtures/hmh-separation-reference.mjs';
test('distance shortlist preserves exact deltas and broadphase counts',()=>{
 let seed=481;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let run=0;run<60;run++){
  const enemies=Array.from({length:run%3===0?192:17+run%70},(_,i)=>({id:'e-'+String(i).padStart(3,'0'),active:i%19!==0,x:Math.floor(rand()*700-350),y:Math.floor(rand()*700-350),radius:8+rand()*40}));
  if(run%4===0)for(const e of enemies){e.x=Math.round(e.x/90)*90;e.y=Math.round(e.y/90)*90;}
  const options={neighborRadius:run%2?96:180,maxNeighbors:1+run%12,cellSize:run%2?96:60};
  assert.deepEqual(computeEnemySeparation(enemies,options),reference(enemies,options));
  assert.deepEqual(computeEnemySeparation([...enemies].reverse(),options),reference(enemies,options));
 }
});
test('crowded separation skips exact distances for irrelevant neighbors',()=>{
 const enemies=Array.from({length:48},(_,i)=>({id:String(i),active:true,x:i%8,y:Math.floor(i/8),radius:18}));
 const hypot=Math.hypot;let calls=0;try{Math.hypot=(...v)=>{calls++;return hypot(...v)};computeEnemySeparation(enemies);}finally{Math.hypot=hypot;}
 assert.ok(calls<=48*47/2+48,'unnecessary exact distance calculations: '+calls);
});
