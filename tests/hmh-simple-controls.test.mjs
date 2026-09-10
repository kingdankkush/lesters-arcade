import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchControlState, TOUCH_CONTROL_SPEC, touchControlsHintText } from '../apps/hmh-reboot/src/touch-controls.mjs';
import { InputState, mapGamepadSnapshot } from '../apps/hmh-reboot/src/input.mjs';
import { actionHelpRows, keyboardActionRecord, DEFAULT_KEYBOARD_BINDINGS } from '../apps/hmh-reboot/src/action-map.mjs';
import { createAimState, resolveAimIntent } from '../apps/hmh-reboot/src/aim.mjs';
import { createWorldDesignState, stepWorldDesign } from '../apps/hmh-reboot/src/world-design-interactions.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';

test('only movement, aim, grenade and the menu are exposed; old gestures never emit extra actions',()=>{
  assert.deepEqual(TOUCH_CONTROL_SPEC.buttons.map(b=>b.action),['grenade','pause']);
  assert.deepEqual(actionHelpRows().map(r=>r.id),['moveUp','moveDown','moveLeft','moveRight','grenade','pause']);
  assert.doesNotMatch(touchControlsHintText(),/double.tap|swap|power|melee/i);
  let now=0;const touch=new TouchControlState({now:()=>now});
  for(const role of ['move','aim']) for(let i=0;i<4;i++) {
    touch.beginStick(1,role,{x:0,y:0});now+=30;touch.endPointer(1);now+=30;
    assert.equal(touch.snapshot().dash,false);assert.equal(touch.snapshot().melee,false);
  }
  const old=keyboardActionRecord(new Set(['Space','KeyE','ShiftLeft','KeyQ','Digit2']),DEFAULT_KEYBOARD_BINDINGS);
  for(const key of ['fire','melee','dash','weaponNext']) assert.equal(old[key],false);
  assert.equal(old.weaponSlot,0);
  const pad=mapGamepadSnapshot({buttons:Array.from({length:16},()=>({pressed:true})),axes:[0,0,0,0]});
  for(const key of ['fire','melee','dash','weaponNext']) assert.equal(pad.actions[key],false);
  assert.equal(pad.actions.grenade,true);
});

test('mobile aim stick overrides automatic targeting; release reacquires on the very next tick',()=>{
  const state=createAimState();const actor={x:0,y:0};const targets=[{id:'e',x:100,y:0}];
  let aim=resolveAimIntent(state,{tick:0,actor,targets,device:'touch',input:{aim:{x:-1,y:0,active:true}}});
  assert.equal(aim.source,'manual');assert.ok(aim.direction.x<-.99);
  aim=resolveAimIntent(state,{tick:1,actor,targets,device:'touch',input:{aim:{active:false}}});
  assert.equal(aim.source,'autofire');assert.equal(aim.targetId,'e');assert.equal(aim.fire,true);
  aim=resolveAimIntent(state,{tick:2,actor,targets:[],device:'touch',input:{aim:{x:0,y:1,active:true}}});
  assert.equal(aim.fire,true,'manual aiming fires without a separate trigger');
});

test('releasing a touch stick cannot resurrect a recent mouse aim',()=>{
  const input=new InputState();
  const context={actor:{x:0,y:0,z:0},camera:{x:0,y:0,zoom:1},viewport:{width:800,height:450},nowMs:30};
  input.setPointer({screenX:790,screenY:225},1);
  input.setTouch({aimX:-1},10);assert.equal(input.snapshot(context).actions.aim.x,-1);
  input.setTouch({aimX:0,aimY:0},20);assert.equal(input.snapshot(context).actions.aim.active,false);
});

test('walking past an accessible control activates it once and machinery finishes without waiting',()=>{
  const state=createWorldDesignState(),site=WORLD_DESIGN_SITES[0];
  const step=(tick,player,blocked=false)=>stepWorldDesign(state,{tick,player,queryGround:()=>({groundZ:0}),lineBlocked:()=>blocked});
  step(0,{...site,vx:240});
  assert.equal(state.activating.get(site.id),0);
  const events=[];
  for(let tick=1;tick<site.holdTicks;tick++) events.push(...step(tick,{x:site.x+500,y:site.y,vx:240}).events);
  assert.equal(events.length,1);assert.ok(state.openGates.has(site.gateId));
  step(site.holdTicks,{...site});assert.equal(state.activating.size,0);
  const blocked=createWorldDesignState();
  stepWorldDesign(blocked,{tick:0,player:site,queryGround:()=>({groundZ:0}),lineBlocked:()=>true});
  assert.equal(blocked.activating.size,0);
});
