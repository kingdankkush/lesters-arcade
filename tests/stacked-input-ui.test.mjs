import test from 'node:test';
import assert from 'node:assert/strict';
import { createStackedInput } from '../apps/stacked/src/input.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';
import { createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';

test('canceled touches cannot leave a queued drop, while a completed quick tap still registers', () => {
  const listeners=new Map(),buttons=new Map();
  const button={dataset:{action:'hardDrop'},setPointerCapture(){},addEventListener:(type,fn)=>buttons.set(type,fn),removeEventListener(){}};
  let menu=false;
  const input=createStackedInput({target:{addEventListener:(t,fn)=>listeners.set(t,fn),removeEventListener(){}},controls:{querySelectorAll:()=>[button]},settings:defaultStackedSettings(),onPause(){},onUndo(){},isMenuOpen:()=>menu,getGamepads:()=>[]});
  const event={pointerId:1,preventDefault(){}},s=createStackedRuntime({seed:3}).snapshot();
  buttons.get('pointerdown')(event);buttons.get('pointercancel')(event);
  assert.equal(input.sample(s),0);
  buttons.get('pointerdown')(event);buttons.get('pointerup')(event);buttons.get('lostpointercapture')(event);
  assert.ok(input.sample(s)&8,'normal release keeps a between-ticks tap');
  input.clear();menu=true;
  buttons.get('pointerdown')(event);
  listeners.get('keydown')({code:'Space',target:{tagName:'CANVAS'},preventDefault(){}});
  assert.equal(input.sample(s),0,'menu focus cannot queue gameplay');input.destroy();
});

test('controller menu actions are edge-triggered and held menu buttons never leak into resumed play', () => {
  const listeners=new Map(), actions=[];let pauses=0,menu=true;
  const pad={buttons:Array.from({length:16},()=>({pressed:false})),axes:[0,0]};
  const input=createStackedInput({target:{addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener(){}},controls:{querySelectorAll:()=>[]},settings:defaultStackedSettings(),getGamepads:()=>[null,pad],isMenuOpen:()=>menu,onMenuAction:a=>actions.push(a),onPause:()=>pauses++,onUndo(){}});
  input.poll();pad.buttons[0].pressed=true;input.poll();input.poll();assert.deepEqual(actions,['activate']);
  input.clear();menu=false;const s=createStackedRuntime({seed:1}).snapshot();assert.equal(input.sample(s),0,'A used to start must not rotate');
  pad.buttons[0].pressed=false;input.poll();input.sample(s);pad.buttons[0].pressed=true;assert(input.sample(s)&16);
  pad.buttons[9].pressed=true;input.poll();input.poll();assert.equal(pauses,1);
  input.clear();pad.buttons[0].pressed=false;pad.buttons[9].pressed=false;input.poll();input.sample(s);
  pad.axes[0]=-1;assert(input.sample(s)&1);pad.axes[0]=0;assert.equal(input.sample(s)&3,0);input.destroy();
});

test('blur releases a held key and repeated hard-drop keydown cannot create another press', () => {
  const listeners=new Map(),input=createStackedInput({target:{addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener(){}},controls:{querySelectorAll:()=>[]},settings:defaultStackedSettings(),onPause(){},onUndo(){},getGamepads:()=>[]});
  const event={code:'Space',target:{tagName:'CANVAS'},preventDefault(){},repeat:false},s=createStackedRuntime({seed:1}).snapshot();
  listeners.get('keydown')(event);assert(input.sample(s)&8);listeners.get('blur')();assert.equal(input.sample(s),0);
  listeners.get('keydown')({...event,repeat:true});assert.equal(input.sample(s),0);input.destroy();
});

test('Space on a dialog button keeps native keyboard activation', () => {
  const listeners = new Map();
  const target = { addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener() {} };
  const input = createStackedInput({ target, controls: { querySelectorAll: () => [] }, settings: defaultStackedSettings(), onPause() {}, onUndo() {} });
  let prevented = false;
  listeners.get('keydown')({ code: 'Space', target: { tagName: 'BUTTON' }, preventDefault() { prevented = true; } });
  listeners.get('keyup')({ code: 'Space', target: { tagName: 'BUTTON' }, preventDefault() { prevented = true; } });
  listeners.get('keydown')({ code: 'Space', target: { tagName: 'SUMMARY' }, preventDefault() { prevented = true; } });
  listeners.get('keyup')({ code: 'Space', target: { tagName: 'SUMMARY' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
  input.destroy();
});
