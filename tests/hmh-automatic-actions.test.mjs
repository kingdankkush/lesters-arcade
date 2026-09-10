import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticDodgeIntent } from '../apps/hmh-reboot/src/automatic-actions.mjs';
import { createDashState, beginDash, stepDash, resolveDashWorldStep } from '../apps/hmh-reboot/src/dash.mjs';
import { createCollisionBody, createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { createMeleeState, createMeleeTarget, stepMeleeState } from '../apps/hmh-reboot/src/melee.mjs';
const body=createCollisionBody({id:'player',kind:'player',radius:24,minZ:0,maxZ:48});
const bounds={minX:0,minY:0,maxX:1000,maxY:1000,visibleBoundaryId:'edge'};
const ground=()=>({groundZ:0,kind:'ground',walkable:true});
const actor={x:400,y:400,groundZ:0};
const enemy={id:'e',archetypeId:'bagholder-rusher',x:365,y:400,groundZ:0,active:true,health:20,attackPhase:'tell',attackPhaseUntilTick:15,telegraphTarget:{x:400,y:400,groundZ:0}};
const options=()=>({tick:10,actor,move:{x:1,y:0},state:createDashState(),body,bounds,blockers:[],queryGround:ground,enemies:[enemy]});
test('automatic dodge responds to an imminent visible attack and follows only the movement direction',()=>{
  const args=options();assert.deepEqual(automaticDodgeIntent(args),{x:1,y:0});
  assert.equal(automaticDodgeIntent({...args,move:{x:0,y:0}}),null);
  assert.equal(automaticDodgeIntent({...args,move:{x:-1,y:0}}),null,'cannot dash through the attacker');
  assert.equal(automaticDodgeIntent({...args,tick:1}),null,'do not consume dodge during early warning');
  assert.equal(automaticDodgeIntent({...args,enemies:[]}),null);
  assert.equal(automaticDodgeIntent({...args,state:{...args.state,cooldownReadyTick:100}}),null);
  const direction=automaticDodgeIntent(args);beginDash(args.state,{tick:10,direction});
  let position={...actor,z:0};
  for(let tick=10;tick<18;tick++) {
    const frame=stepDash(args.state,{tick});
    const result=resolveDashWorldStep({...args,start:position,delta:frame.delta,enemies:[]});position=result.position;
  }
  assert.equal(position.x,592);assert.equal(position.y,400);
});
test('automatic dodge rejects water, cliff drops, boundaries and blockers along the complete swept route',()=>{
  const args=options();
  const wall=createStaticBlocker({id:'wall',shape:{type:'capsule',a:{x:500,y:300},b:{x:500,y:500},radius:12},minZ:0,maxZ:80,visibleAssetId:'wall',combatCover:true});
  assert.equal(automaticDodgeIntent({...args,blockers:[wall]}),null);
  assert.equal(automaticDodgeIntent({...args,bounds:{...bounds,maxX:520}}),null);
  assert.equal(automaticDodgeIntent({...args,queryGround:x=>x>470?{groundZ:0,kind:'water',walkable:false}:ground()}),null);
  assert.equal(automaticDodgeIntent({...args,queryGround:x=>x>470?{groundZ:-64,kind:'ground',walkable:true}:ground()}),null);
  assert.equal(automaticDodgeIntent({...args,enemies:[{...enemy,groundZ:64}]}),null);
});
test('automatic close combat uses the real arc, walls, height and cooldown without a melee input',()=>{
  const state=createMeleeState();const at={x:40,y:0,z:0};
  const target=createMeleeTarget({id:'e',previousGround:at,currentGround:at,radius:20});
  const args={automatic:true,origin:{x:0,y:0,z:0},direction:{x:1,y:0},targets:[target]};
  assert.equal(stepMeleeState(state,{...args,tick:0,targets:[]}).attacked,false);
  assert.equal(stepMeleeState(state,{...args,tick:1,direction:{x:-1,y:0}}).attacked,false);
  const frame=stepMeleeState(state,{...args,tick:2});assert.equal(frame.attacked,true);assert.equal(frame.hits.length,1);
  assert.equal(stepMeleeState(state,{...args,tick:3}).attacked,false);
  const wall=createStaticBlocker({id:'wall',shape:{type:'capsule',a:{x:20,y:-40},b:{x:20,y:40},radius:4},minZ:0,maxZ:80,visibleAssetId:'wall',combatCover:true});
  assert.equal(stepMeleeState(state,{...args,tick:22,blockers:[wall]}).attacked,false);
  const upper=createMeleeTarget({id:'upper',previousGround:{...at,z:80},currentGround:{...at,z:80},radius:20});
  assert.equal(stepMeleeState(state,{...args,tick:23,targets:[upper]}).attacked,false);
});
