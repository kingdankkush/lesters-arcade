import test from 'node:test';
import assert from 'node:assert/strict';
import { createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';
import { createStackedMatch } from '../apps/portal/src/stacked-match.mjs';
import { STACKED_ATTACK_TABLE } from '../apps/portal/src/stacked-versus-table.mjs';
const routerModule = import('../apps/stacked/src/local-input.mjs').catch(() => null);
const snap = () => createStackedRuntime({ seed: 77 }).snapshot();
function pad(index = 0, id = 'pad-' + index) {
  return { index, id, connected: true, mapping: 'standard', buttons: Array.from({length:17}, () => ({pressed:false})), axes: [0,0,0,0] };
}
function target() {
  const listeners = new Map();
  return {
    addEventListener(t, f) { if (!listeners.has(t)) listeners.set(t,new Set()); listeners.get(t).add(f); },
    removeEventListener(t, f) { listeners.get(t)?.delete(f); },
    emit(t, props = {}) { const e = { code:'', repeat:false, target:{tagName:'CANVAS'}, prevented:false, preventDefault(){this.prevented=true;}, ...props }; for (const f of [...listeners.get(t) ?? []]) f(e); return e; },
    count() { return [...listeners.values()].reduce((n,s) => n+s.size,0); },
  };
}
async function setup(devices = [{kind:'keyboard-left'},{kind:'keyboard-right'}], pads = []) {
  const module = await routerModule; assert.ok(module, 'local input module exists');
  const dom=target(); let readings=0, pauses=0, losses=[];
  const state={pads, fail:false};
  const input=module.createStackedLocalInput({target:dom,devices,getGamepads(){readings++; if(state.fail)throw new Error('denied'); return state.pads;},onPause(){pauses++;},onDeviceLost:slots=>losses.push(slots)});
  return {input,dom,state,get readings(){return readings;},get pauses(){return pauses;},get losses(){return losses;}};
}

test('split keyboards route distinct controls to two real boards with the same piece bag', async () => {
  const {input,dom}=await setup(); const match=createStackedMatch({seed:77,playerConfigs:[{},{}],attackTable:STACKED_ATTACK_TABLE});
  input.activate(); dom.emit('keydown',{code:'KeyA'}); dom.emit('keydown',{code:'ArrowRight'});
  const before=match.snapshot(), bits=input.pollTick(before.boards); assert.deepEqual([...bits],[1,2]);
  match.stepAll(bits); const after=match.snapshot();
  assert.equal(after.boards[0].active.x,before.boards[0].active.x-1); assert.equal(after.boards[1].active.x,before.boards[1].active.x+1);
  assert.deepEqual(after.boards[0].queue,after.boards[1].queue); assert.equal(after.boards[0].active.kind,after.boards[1].active.kind); input.destroy();
});
test('quick drop taps survive release and repeated keydown cannot create another drop', async () => {
  const {input,dom}=await setup();input.activate(); const snapshots=[snap(),snap()];
  dom.emit('keydown',{code:'KeyW'});dom.emit('keyup',{code:'KeyW'});
  assert.deepEqual([...input.pollTick(snapshots)],[8,0]); assert.deepEqual([...input.pollTick(snapshots)],[0,0]);
  dom.emit('keydown',{code:'KeyW',repeat:true});assert.deepEqual([...input.pollTick(snapshots)],[0,0]);input.destroy();
});
test('per-player auto-shift is tick sampled and never shares held direction', async () => {
  const {input,dom}=await setup();input.activate();dom.emit('keydown',{code:'KeyD'});const samples=[];
  for(let i=0;i<14;i++) samples.push([...input.pollTick([snap(),snap()])]);
  assert.ok(samples.every(m=>m[1]===0));assert.equal(samples[0][0],2);assert.equal(samples[1][0],0);assert.ok(samples.slice(2).some(m=>m[0]===2));
  dom.emit('keyup',{code:'KeyD'});assert.deepEqual([...input.pollTick([snap(),snap()])],[0,0]);input.destroy();
});
test('standard pads bind by index with sparse arrays and translate versus actions', async () => {
  const p1=pad(1),p4=pad(4);const fixture=await setup([{kind:'gamepad',index:4},{kind:'gamepad',index:1}],[null,p1,null,null,p4]);
  fixture.input.activate();fixture.input.pollTick([snap(),snap()]);
  p4.buttons[0].pressed=true;p1.buttons[1].pressed=true;
  const reads=fixture.readings;assert.deepEqual([...fixture.input.pollTick([snap(),snap()])],[8,16]);assert.equal(fixture.readings,reads+1,'one shared pad snapshot per tick');
  fixture.input.clear();p4.buttons[0].pressed=false;p1.buttons[1].pressed=false;fixture.input.pollTick([snap(),snap()]);
  p4.buttons[4].pressed=true;p1.buttons[2].pressed=true;assert.deepEqual([...fixture.input.pollTick([snap(),snap()])],[128,32]);fixture.input.destroy();
});
test('solo default keyboard plus pad preserves keyboard actions without controlling the other board', async () => {
  const p=pad();const {input,dom}=await setup([{kind:'keyboard'},{kind:'gamepad',index:0}],[p]);input.activate();input.pollTick([snap(),snap()]);
  dom.emit('keydown',{code:'Space'});p.buttons[3].pressed=true;assert.deepEqual([...input.pollTick([snap(),snap()])],[8,64]);input.destroy();
});
test('invalid claims fail before listeners attach: duplicates, overlapping keyboard layouts and nonstandard pads', async () => {
  const module=await routerModule;assert.ok(module);const dom=target(),pads=[pad()];
  for(const devices of [[],[{kind:'keyboard'}],[{kind:'gamepad',index:0},{kind:'gamepad',index:0}],[{kind:'keyboard'},{kind:'keyboard-left'}],[{kind:'keyboard-right'},{kind:'keyboard-right'}],[{kind:'gamepad',index:-1},{kind:'keyboard'}],[{kind:'unknown'},{kind:'keyboard'}]]) assert.throws(()=>module.createStackedLocalInput({target:dom,devices,getGamepads:()=>pads}));
  pads[0].mapping='';assert.throws(()=>module.createStackedLocalInput({target:dom,devices:[{kind:'keyboard'},{kind:'gamepad',index:0}],getGamepads:()=>pads}));assert.equal(dom.count(),0);
});
test('disconnect pauses both streams before another match tick and reports loss once', async () => {
  const p=pad();const f=await setup([{kind:'keyboard'},{kind:'gamepad',index:0}],[p]);f.input.activate();f.input.pollTick([snap(),snap()]);
  f.dom.emit('keydown',{code:'Space'});f.state.pads=[];
  assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,0]);assert.equal(f.input.active,false);assert.deepEqual(f.input.releasedSlots(),[1]);assert.deepEqual(f.losses,[[1]]);
  f.input.pollTick([snap(),snap()]);assert.deepEqual(f.losses,[[1]]);assert.equal(f.input.activate(),false);f.input.destroy();
});
test('a new controller at a reused index cannot silently take over a paused slot', async () => {
  const f=await setup([{kind:'keyboard'},{kind:'gamepad',index:0}],[pad()]);f.input.activate();f.state.pads=[pad(0,'replacement')];
  assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,0]);assert.deepEqual(f.input.releasedSlots(),[1]);f.state.pads=[pad()];assert.equal(f.input.activate(),false);f.input.destroy();
});
test('unavailable polling and connected false are controller losses, not thrown frame errors', async () => {
  for(const unavailable of [true,false]) {const f=await setup([{kind:'keyboard'},{kind:'gamepad',index:0}],[pad()]);f.input.activate();if(unavailable)f.state.fail=true;else f.state.pads[0].connected=false;
    assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,0]);assert.deepEqual(f.input.releasedSlots(),[1]);f.input.destroy();}
});
test('pause button and Escape pause once, clear both boards and do not leak held menu actions', async () => {
  const p=pad();const f=await setup([{kind:'keyboard'},{kind:'gamepad',index:0}],[p]);f.input.activate();f.input.pollTick([snap(),snap()]);
  p.buttons[9].pressed=true;p.buttons[0].pressed=true;assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,0]);f.input.pollTick([snap(),snap()]);assert.equal(f.pauses,1);
  f.input.activate();assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,0]);p.buttons[9].pressed=false;p.buttons[0].pressed=false;f.input.pollTick([snap(),snap()]);
  p.buttons[0].pressed=true;assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,8]);f.dom.emit('keydown',{code:'Escape'});f.dom.emit('keydown',{code:'Escape',repeat:true});assert.equal(f.pauses,2);assert.equal(f.input.active,false);f.input.destroy();
});
test('blur and explicit deactivation release all input, while editable targets retain native keys', async () => {
  const {input,dom}=await setup();input.activate();dom.emit('keydown',{code:'KeyW'});dom.emit('blur');assert.equal(input.active,false);assert.deepEqual([...input.pollTick([snap(),snap()])],[0,0]);input.activate();
  for(const props of [{target:{tagName:'BUTTON'}},{target:{tagName:'INPUT'}},{target:{tagName:'SUMMARY'}},{target:{tagName:'DIV',isContentEditable:true}}]) assert.equal(dom.emit('keydown',{code:'KeyW',...props}).prevented,false);
  assert.deepEqual([...input.pollTick([snap(),snap()])],[0,0]);dom.emit('keydown',{code:'KeyW'});input.deactivate();input.activate();assert.deepEqual([...input.pollTick([snap(),snap()])],[0,0]);input.destroy();
});
test('destroy removes every listener and cannot be reactivated', async () => {
  const {input,dom}=await setup();assert.ok(dom.count()>0);input.activate();input.destroy();input.destroy();assert.equal(dom.count(),0);assert.equal(input.activate(),false);dom.emit('keydown',{code:'KeyW'});assert.deepEqual([...input.pollTick([snap(),snap()])],[0,0]);
});
test('device descriptions are copied and later caller edits cannot reroute either player', async () => {
  const devices=[{kind:'keyboard-left'},{kind:'keyboard-right'}];const {input,dom}=await setup(devices);devices[0].kind='keyboard-right';input.activate();dom.emit('keydown',{code:'KeyW'});assert.deepEqual([...input.pollTick([snap(),snap()])],[8,0]);input.destroy();
});
test('disconnect events latch even when the same model and index reconnect between ticks', async () => {
  const p=pad();const f=await setup([{kind:'keyboard'},{kind:'gamepad',index:0}],[p]);f.input.activate();f.input.pollTick([snap(),snap()]);
  f.dom.emit('gamepaddisconnected',{gamepad:pad(7)});assert.equal(f.input.active,true,'unclaimed controllers do not interrupt a match');
  f.dom.emit('keydown',{code:'Space'});f.dom.emit('gamepaddisconnected',{gamepad:p});assert.equal(f.input.active,false);
  f.state.pads=[pad()];assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,0]);assert.deepEqual(f.input.releasedSlots(),[1]);assert.equal(f.input.activate(),false);f.input.destroy();
});
test('moving focus into a control clears previously held and queued game actions', async () => {
  for(const tagName of ['INPUT','BUTTON','SUMMARY']) {const {input,dom}=await setup();input.activate();dom.emit('keydown',{code:'KeyD'});dom.emit('keydown',{code:'ArrowUp'});
    dom.emit('focusin',{target:{tagName}});assert.equal(input.active,false);input.activate();assert.deepEqual([...input.pollTick([snap(),snap()])],[0,0]);input.destroy();}
});
test('initial controller activation needs a neutral release before held start buttons can play', async () => {
  const p=pad();p.buttons[0].pressed=true;const f=await setup([{kind:'keyboard'},{kind:'gamepad',index:0}],[p]);f.input.activate();assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,0]);
  p.buttons[0].pressed=false;f.input.pollTick([snap(),snap()]);p.buttons[0].pressed=true;assert.deepEqual([...f.input.pollTick([snap(),snap()])],[0,8]);f.input.destroy();
});
test('same routed input stream produces byte-identical two-board deterministic state', async () => {
  const one=await setup(),two=await setup();one.input.activate();two.input.activate();
  const make=()=>createStackedMatch({seed:77,playerConfigs:[{},{}],attackTable:STACKED_ATTACK_TABLE}),a=make(),b=make();
  for(let i=0;i<150&&!a.terminal;i++) {for(const f of [one,two]) {if(i%19===0)f.dom.emit('keydown',{code:'KeyW'});if(i%19===1)f.dom.emit('keyup',{code:'KeyW'});if(i%23===0)f.dom.emit('keydown',{code:'ArrowUp'});if(i%23===1)f.dom.emit('keyup',{code:'ArrowUp'});}
    a.stepAll(one.input.pollTick(a.snapshot().boards));b.stepAll(two.input.pollTick(b.snapshot().boards));assert.equal(a.stateHash(),b.stateHash());assert.deepEqual(a.snapshot(),b.snapshot());}
  one.input.destroy();two.input.destroy();
});
