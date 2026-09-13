import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_FUEL_DRUMS, createWorldDestructibleState, applyWorldDestructibleDamage, worldDestructibleTargets } from '../apps/hmh-reboot/src/world-destructibles.mjs';
import { stepWorldExplosions } from '../apps/hmh-reboot/src/world-explosives.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { LEVEL_ONE_WORLD as world,createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';
import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
const queryGround=createLevelOneGroundQuery();
const fire=(state,id,tick)=>applyWorldDestructibleDamage(state,{targets:{[id]:{health:0}},tick});

test('fuel barrels wait through a visible fuse then chain once using the normal damage resolver',()=>{
  function run(){
    const state=createWorldDestructibleState(),first=WORLD_FUEL_DRUMS[0],events=[];
    fire(state,first.id,1);
    for(let tick=2;tick<120;tick++){
      const targets=worldDestructibleTargets(state);
      const blockers=world.collisionBlockers.filter(b=>!state.brokenTick.has(b.id));
      const result=stepWorldExplosions(state,{tick,targets,queryGround,blockers});
      if(tick<37)assert.equal(result.events.length,0);
      events.push(...result.events);
      const resolution=resolveCombatHits({sessionSeed:71,hits:result.hits,targets});
      applyWorldDestructibleDamage(state,{targets:resolution.targets,tick});
    }
    assert.equal(events.length,3);assert.ok(events.every(e=>e.zoneId===first.zoneId));
    assert.equal(new Set(events.map(e=>e.id)).size,3);return {state,events};
  }
  assert.deepEqual(run(),run());
});
test('fuel blasts respect walls, height and radius, and use capped environmental attribution',()=>{
  const state=createWorldDestructibleState(),d=WORLD_FUEL_DRUMS[0];fire(state,d.id,0);
  const {x,y}=d.anchor;
  const targets=[{id:'near',x:x-50,y,groundZ:0},{id:'player',x:x-50,y,groundZ:0},{id:'ledge',x:x-40,y,groundZ:64},
    {id:'far',x:x-600,y,groundZ:0},{id:'behind',x:x+60,y,groundZ:0}];
  const wall=createStaticBlocker({id:'wall',shape:{type:'capsule',a:{x:x+30,y:y-70},b:{x:x+30,y:y+70},radius:5},visibleAssetId:'wall',minZ:0,maxZ:60,combatCover:true});
  assert.equal(traceHeightAwareLineOfSight({from:{x,y,z:20},to:{x:x+60,y,z:20},blockers:[wall]}).clear,false);
  const result=stepWorldExplosions(state,{tick:36,targets,queryGround,blockers:[wall]});
  assert.deepEqual(result.hits.map(h=>h.targetId).sort(),['near','player']);
  assert.ok(result.hits.every(h=>h.weaponId==='world-fuel'&&h.criticalChance===0));
  assert.ok(result.hits.find(h=>h.targetId==='player').damage<=24);
  assert.equal(stepWorldExplosions(state,{tick:37,targets,queryGround,blockers:[]}).events.length,0);
});
test('simultaneous explosions use a stable four-event tick budget and reset with the run',()=>{
  const state=createWorldDestructibleState();for(const d of WORLD_FUEL_DRUMS)fire(state,d.id,0);
  const all=[];
  for(let tick=36;tick<=38;tick++){
    const result=stepWorldExplosions(state,{tick,targets:[],queryGround,blockers:[]});
    assert.ok(result.events.length<=4);all.push(...result.events.map(e=>e.id));
  }
  assert.equal(all.length,9);assert.equal(new Set(all).size,9);assert.deepEqual(all,[...all].sort());
  assert.throws(()=>stepWorldExplosions(state,{tick:38,targets:[],queryGround,blockers:[]}),/monotonic/);
  assert.equal(createWorldDestructibleState().exploded.size,0);
});
