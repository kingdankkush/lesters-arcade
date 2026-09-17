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

test('flesh impacts with a direction spray droplets that fly along the shot, land as splats, and stay bounded', () => {
  const fx=createGorePresentation();
  fx.add({type:'impact',surface:'flesh',tick:10,point:{x:100,y:50,z:22},direction:{x:1,y:0}},0);
  const early=fx.frame(12,{enabled:true});
  assert.equal(early.marks.length,1,'only the hit mark has landed so far');
  assert.equal(early.droplets.length,3);
  assert.ok(early.droplets.every(d=>d.x>100 && d.z>=0),'droplets travel with the shot and stay above ground');
  assert.deepEqual(early,fx.frame(12,{enabled:true}),'a frame is a pure function of tick');
  const late=fx.frame(200,{enabled:true});
  assert.equal(late.droplets.length,0);
  assert.equal(late.marks.length,4,'each droplet landed as its own splat');
  assert.ok(late.marks.slice(1).every(mark=>mark.x>100 && mark.z===0),'splats land downrange on the ground');
  for(let i=0;i<40;i++)fx.add({type:'impact',surface:'flesh',tick:300+i,point:{x:i,y:0,z:20},direction:{x:0,y:1}},0);
  const crowded=fx.frame(340,{enabled:true});
  assert.ok(crowded.droplets.length<=24 && crowded.marks.length<=48,'pools stay bounded');
  assert.equal(fx.frame(341,{enabled:true,reduceMotion:true}).droplets.length,0,'reduced motion shows no flying blood');
});

test('dismembering kills throw limbs that tumble, land, and rest on the ground; plain kills do not', () => {
  const fx=createGorePresentation();
  fx.add({type:'kill',tick:5,point:{x:0,y:0,z:24}},0);
  assert.equal(fx.frame(6,{enabled:true}).limbs.length,0);
  fx.add({type:'kill',tick:20,point:{x:300,y:300,z:24},dismember:true,direction:{x:0,y:-1}},0);
  const flying=fx.frame(24,{enabled:true});
  assert.ok(flying.limbs.length>=2 && flying.limbs.length<=4);
  assert.ok(flying.limbs.every(limb=>!limb.landed && limb.z>0));
  assert.equal(flying.droplets.length,5,'a dismembering kill also sprays');
  const rested=fx.frame(120,{enabled:true});
  assert.ok(rested.limbs.every(limb=>limb.landed && limb.z===0 && limb.alpha>0));
  assert.ok(fx.frame(21,{enabled:true,reduceMotion:true}).limbs.every(limb=>limb.landed),'reduced motion drops limbs straight onto the ground');
  assert.equal(fx.frame(20+48+480+1,{enabled:true}).limbs.length,0,'limbs expire 480 ticks after landing');
  for(let i=0;i<10;i++)fx.add({type:'kill',tick:1000+i,point:{x:i,y:i,z:24},dismember:true},0);
  assert.ok(fx.frame(1010,{enabled:true}).limbs.length<=8,'the limb pool is bounded');
  assert.equal(fx.frame(1011,{enabled:false}).limbs.length,0);
});

test('dismemberment follows explosive, lane and pellet weapons plus hazards, never plain rounds', async () => {
  const { shouldDismember, DISMEMBER_WEAPON_IDS } = await import('../apps/hmh-reboot/src/gore-presentation.mjs');
  assert.equal(shouldDismember({ weaponId: 'coin-blaster', policyType: 'stop' }), false);
  assert.equal(shouldDismember({ weaponId: 'hash-rail', policyType: 'pierce' }), true);
  assert.equal(shouldDismember({ policyType: 'splash' }), true);
  assert.equal(shouldDismember({ policyType: 'pellet' }), true);
  assert.equal(shouldDismember({ hazard: true }), true);
  assert.equal(shouldDismember({ weaponId: 'nuke-liquidation' }), true);
  assert.ok(DISMEMBER_WEAPON_IDS.has('hand-grenade'));
  assert.equal(shouldDismember(), false);
});
