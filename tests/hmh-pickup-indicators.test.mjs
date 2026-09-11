import test from 'node:test';
import assert from 'node:assert/strict';
import {pickupIndicators} from '../apps/hmh-reboot/src/pickup-indicators.mjs';
const entry=(id,kind,availableTick=0,x=100)=>({placement:{id,x,y:100,availableTick},effect:{kind}});
const make=(entries,collectedIds=new Set())=>({state:{entries,collectedIds},tick:30,camera:{zoom:1},view:{width:800,height:600},worldToScreen:p=>p,queryGround:()=>({groundZ:0})});
test('markers distinguish weapons, health and power-ups and suppress unavailable items',()=>{
  const args=make([entry('weapon','weapon-cache'),entry('health','heal'),entry('buff','timed'),entry('future','timed',60),entry('taken','heal'),entry('offscreen','heal',0,1000)],new Set(['taken']));
  const before=JSON.stringify(args.state.entries);
  const markers=pickupIndicators(args);
  assert.deepEqual(markers.map(m=>m.id),['weapon','health','buff']);
  assert.equal(new Set(markers.map(m=>m.color)).size,3);
  assert.equal(JSON.stringify(args.state.entries),before);
  assert.equal(args.state.collectedIds.size,1);
});
test('reduced motion keeps recognizable rings and arrows without animated sparks',()=>{
  const args={...make([entry('weapon','weapon-cache')]),reduceMotion:true};
  assert.deepEqual(pickupIndicators(args),pickupIndicators({...args,tick:179}));
  assert.equal(pickupIndicators(args)[0].sparks.length,0);
});
