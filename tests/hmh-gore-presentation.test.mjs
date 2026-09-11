import test from 'node:test';
import assert from 'node:assert/strict';
import { createGorePresentation } from '../apps/hmh-reboot/src/gore-presentation.mjs';
test('blood marks are bounded, expire, use ground height and disappear immediately when disabled', () => {
  const fx=createGorePresentation();
  const event=Object.freeze({type:'kill',tick:100,point:Object.freeze({x:10,y:20,z:60})});
  for(let i=0;i<100;i++)fx.add({...event,tick:100+i},0);
  const frame=fx.frame(199,{enabled:true});
  assert.equal(frame.marks.length,48);
  assert.ok(frame.fragments.length<=12);
  assert.ok(frame.marks.every(mark=>mark.z===0));
  assert.equal(fx.frame(900,{enabled:true}).marks.length,0);
  fx.add(event,0); fx.frame(101,{enabled:false});
  assert.equal(fx.frame(102,{enabled:true}).marks.length,0);
  assert.deepEqual(event.point,{x:10,y:20,z:60});
});
test('shields and scenery do not bleed, reduced motion keeps static marks with no flying debris', () => {
  const fx=createGorePresentation();
  fx.add({type:'impact',surface:'metal',tick:1,point:{x:0,y:0,z:0}},0);
  fx.add({type:'impact',surface:'flesh',shielded:true,tick:1,point:{x:0,y:0,z:0}},0);
  assert.equal(fx.frame(2,{enabled:true}).marks.length,0);
  fx.add({type:'kill',tick:3,point:{x:0,y:0,z:30}},4);
  const a=fx.frame(4,{enabled:true,reduceMotion:true});
  assert.equal(a.marks.length,1); assert.equal(a.fragments.length,0);
  assert.deepEqual(a,fx.frame(4,{enabled:true,reduceMotion:true}));
  fx.clear(); assert.equal(fx.frame(5,{enabled:true}).marks.length,0);
});
