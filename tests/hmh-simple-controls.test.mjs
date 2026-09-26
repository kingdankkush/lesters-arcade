import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchControlState, TOUCH_CONTROL_SPEC, touchControlsHintText } from '../apps/hmh-reboot/src/touch-controls.mjs';
import { InputState, mapGamepadSnapshot } from '../apps/hmh-reboot/src/input.mjs';
import { actionHelpRows, keyboardActionRecord, DEFAULT_KEYBOARD_BINDINGS } from '../apps/hmh-reboot/src/action-map.mjs';
import { createAimState, resolveAimIntent } from '../apps/hmh-reboot/src/aim.mjs';
import { MISSION_OBJECTIVES, MISSION_RULES, createMissionState, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';

test('only movement, aim, grenade, swap and the menu are exposed; old gestures never emit extra actions',()=>{
  assert.deepEqual(TOUCH_CONTROL_SPEC.buttons.map(b=>b.action),['grenade','weaponNext','pause']);
  assert.deepEqual(actionHelpRows().map(r=>r.id),['moveUp','moveDown','moveLeft','moveRight','grenade','weaponNext','pause','dodge']);
  assert.doesNotMatch(touchControlsHintText(),/double.tap|power|melee/i);
  assert.match(touchControlsHintText(),/SWAP/);
  let now=0;const touch=new TouchControlState({now:()=>now});
  for(const role of ['move','aim']) for(let i=0;i<4;i++) {
    touch.beginStick(1,role,{x:0,y:0});now+=30;touch.endPointer(1);now+=30;
    assert.equal(touch.snapshot().dash,false);assert.equal(touch.snapshot().melee,false);
  }
  const old=keyboardActionRecord(new Set(['Space','KeyE','KeyQ','Digit2']),DEFAULT_KEYBOARD_BINDINGS);
  for(const key of ['fire','melee','dash']) assert.equal(old[key],false);
  // S1.1 (owner decision 2026-09-25): Left Shift is the desktop keyboard's
  // manual dodge. Touch and gamepad still never emit a dash.
  assert.equal(keyboardActionRecord(new Set(['ShiftLeft']),DEFAULT_KEYBOARD_BINDINGS).dash,true,'Left Shift dodges on a keyboard');
  assert.equal(old.weaponNext,true,'Q is the keyboard swap');
  assert.equal(old.weaponSlot,0);
  const pad=mapGamepadSnapshot({buttons:Array.from({length:16},()=>({pressed:true})),axes:[0,0,0,0]});
  for(const key of ['fire','melee','dash']) assert.equal(pad.actions[key],false);
  assert.equal(pad.actions.weaponNext,true,'right bumper is the gamepad swap');
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

test('walking through a quick ring commits it and the machinery finishes without waiting; a channel never fills on the move',()=>{
  // Mission core v2 (S1.4): no button. A quick node commits after 12 ticks in
  // its ring and then finishes on its own; a channel fills only standing still.
  const quick=MISSION_OBJECTIVES.find(row=>row.mode==='quick'),channel=MISSION_OBJECTIVES.find(row=>row.mode==='channel'&&!row.requires);
  const walk=(state,node,{blocked=false}={})=>{
    const events=[],speed=4,start=node.operate.x-node.ringRadius-8;
    for(let tick=0;tick<220;tick++){
      const player={x:start+tick*speed,y:node.operate.y,groundZ:0};
      events.push(...stepMissionObjectives(state,{tick,player,move:{x:1,y:0},queryGround:()=>({groundZ:0}),lineClear:()=>!blocked}).events);
    }
    return events;
  };
  const state=createMissionState(1);
  const events=walk(state,quick);
  assert.deepEqual(events.filter(e=>e.type==='objective-completed').map(e=>e.objectiveId).slice(0,1),[quick.id]);
  assert.ok(state.openGates.has(quick.effects[0].gateId));
  assert.ok(Math.ceil(2*quick.ringRadius/4)>=MISSION_RULES.quick.commitTicks,'a run through the ring always commits');
  assert.equal(walk(createMissionState(1),quick,{blocked:true}).length,0,'a wall between the hero and the spot blocks it');
  const moving=createMissionState(1);
  walk(moving,channel);
  assert.equal(moving.completed.has(channel.id),false);
  assert.equal(moving.zoneState.get(channel.id).progress,0);
});
