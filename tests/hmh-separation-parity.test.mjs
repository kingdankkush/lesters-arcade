import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {computeEnemySeparation} from '../apps/hmh-reboot/src/enemy-simulation.mjs';
test('dense and dispersed separation preserves the pre-optimization movement and neighbor counts',()=>{
  const hash=createHash('sha256');let seed=541;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let sample=0;sample<200;sample++){
    const spread=[1,30,90,400,2500][sample%5];
    const enemies=Array.from({length:128},(_,i)=>({id:`enemy-${i}`,active:i%17!==0,x:Math.floor(random()*spread),y:Math.floor(random()*spread),radius:[14,22,38][i%3]}));
    const result=computeEnemySeparation(enemies,{maxNeighbors:[1,4,8,16][sample%4]});
    hash.update(JSON.stringify({...result,deltas:[...result.deltas]}));
  }
  assert.equal(hash.digest('hex'),'060e076040975764303f9070dcd4db6d7a2999f154bfdcdcb9cfe050d68bbb8d');
});
