import test from 'node:test';
import assert from 'node:assert/strict';
import * as rewards from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { createCollectibleState, getCollectibleSnapshot, stepCollectibles } from '../apps/hmh-reboot/src/collectible-system.mjs';

const make = () => createCollectibleState({
  placements: Array.from({length:10},(_,i)=>({id:`supply:${i}`,assetId:'bonus-life',x:1000+i*200,y:0,...(i===0?{respawnTicks:7200}:{})})),
  objectivePlacements: rewards.objectiveRewardPlacements(),
});

test('objective state distinguishes discovery, activation, readiness, collection and cooldown', () => {
  const state=make(), reward=rewards.OBJECTIVE_REWARDS.find(r=>r.objectiveId==='crossing-pump');
  const read=options=>rewards.objectiveRewardState(state,reward.id,{tick:1,...options});
  assert.equal(read({discovered:false}).state,'undiscovered');
  assert.equal(read({discovered:true}).state,'discovered');
  assert.equal(read({discovered:true,activating:new Map([['crossing-pump',1]])}).state,'active');
  state.unlockedObjectives.add('crossing-pump');
  assert.equal(read({discovered:true}).state,'reward-available');
  stepCollectibles(state,{tick:1,player:reward});
  assert.deepEqual(read({tick:7200}),{state:'cooldown',complete:true,readyTick:7201,remainingTicks:1,collections:1});
  assert.equal(read({tick:7201}).state,'reward-available');
  const firstClear=rewards.OBJECTIVE_REWARDS[0];
  state.unlockedObjectives.add(firstClear.objectiveId);
  stepCollectibles(state,{tick:7201,player:firstClear});
  assert.equal(rewards.objectiveRewardState(state,firstClear.id,{tick:7202}).state,'collected');
});

test('repeat supplies count as available at the ready tick without erasing first-collection history',()=>{
  const state=make(), supply=state.entries.find(e=>e.placement.id==='supply:0').placement;
  stepCollectibles(state,{tick:1,player:supply});
  const cooling=getCollectibleSnapshot(state,{tick:7200});
  const ready=getCollectibleSnapshot(state,{tick:7201});
  assert.equal(cooling.readyCount,9);
  assert.equal(ready.readyCount,10);
  assert.equal(ready.collectedCount,1);
  assert.equal(ready.cooldownCount,0);
  assert.equal(cooling.cooldownCount,1);
  assert.equal(ready.lockedCount,8);
});
