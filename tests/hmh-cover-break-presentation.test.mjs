import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoverBreakPresentation } from '../apps/hmh-reboot/src/cover-break-presentation.mjs';
import { createWorldDestructibleState, WORLD_DESTRUCTIBLES } from '../apps/hmh-reboot/src/world-destructibles.mjs';

test('break debris is deterministic, bounded and never changes cover or supply state',()=>{
  const state=createWorldDestructibleState();
  for(const d of WORLD_DESTRUCTIBLES){state.health.set(d.id,0);state.brokenTick.set(d.id,10);}
  const before=structuredClone(state),args={state,tick:15,project:(x,y,z)=>({x,y:y-z}),zoom:1,view:{width:12000,height:4800},particleBudget:12};
  const a=buildCoverBreakPresentation(args),b=buildCoverBreakPresentation(args);
  assert.deepEqual(a,b);assert.deepEqual(state,before);assert.equal(a.chips.length,12);assert.equal(a.supplies.length,8);
  assert.equal(buildCoverBreakPresentation({...args,reduceMotion:true}).chips.length,0);
  assert.equal(buildCoverBreakPresentation({...args,particleBudget:0}).chips.length,0);
  assert.equal(buildCoverBreakPresentation({...args,tick:50}).chips.length,0);
  assert.equal(buildCoverBreakPresentation({...args,tick:9}).chips.length,0);
  assert.equal(buildCoverBreakPresentation({...args,view:{width:100,height:100}}).supplies.length,0);
  state.collected.add(WORLD_DESTRUCTIBLES[0].id);
  assert.equal(buildCoverBreakPresentation(args).supplies.length,7);
  assert.equal(buildCoverBreakPresentation({...args,state:createWorldDestructibleState()}).supplies.length,0);
});
