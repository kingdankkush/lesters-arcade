import test from 'node:test';
import assert from 'node:assert/strict';
import { CHIKUN_CLIPS, CHIKUN_FLOURISHES, CHIKUN_RUN_SPEED, milestoneFlourish, selectChikunAnimation, createChikunCharacter, chikunBlendSeconds, sampleChikunFrame } from '../apps/chikun/src/character.mjs';

test('milestones rotate through four full-turn flourishes without changing the flight state', () => {
  assert.deepEqual([5,10,15,20,25].map(milestoneFlourish), ['barrel_roll','reverse_roll','corkscrew','victory_twirl','barrel_roll']);
  const state={tick:300,chikun:{x:280,y:360,velocityY:-2}};
  const before=structuredClone(state);
  for(const event of CHIKUN_FLOURISHES) {
    assert.ok(CHIKUN_CLIPS[event]);
    assert.equal(selectChikunAnimation(state,{event,eventAge:.7,flapAge:.01}),event);
    assert.notEqual(selectChikunAnimation(state,{event,eventAge:.81}),event);
  }
  assert.deepEqual(state,before);
});

test('a completed run celebrates, while impact always interrupts a flourish', () => {
  assert.equal(selectChikunAnimation({terminal:true,terminalReason:'run-complete'},{terminalAge:.3}),'victory_twirl');
  for(const event of CHIKUN_FLOURISHES) {
    assert.equal(selectChikunAnimation({terminal:true,terminalReason:'fork'},{event,eventAge:.1,terminalAge:.1}),'impact');
  }
});

test('character downloads report complete failure and recover with an explicit retry', async () => {
  const originals={Image:globalThis.Image,document:globalThis.document};
  let fail=true;
  globalThis.Image=class {naturalWidth=0;async decode(){if(fail)throw new Error('offline');this.naturalWidth=768;}};
  globalThis.document={createElement:()=>({getContext:()=>({})})};
  try {
    const character=createChikunCharacter();
    assert.equal(await character.ready,false);
    assert.equal(character.renderable,false);
    assert.equal(character.complete,false);
    fail=false;
    assert.equal(await character.retry(),true);
    assert.equal(character.loaded,31);
    assert.equal(character.complete,true);
    character.dispose();
  } finally {Object.assign(globalThis,originals);}
});

const ground=(chikun,extra={})=>({tick:600,difficulty:{speedMultiplier:1},forks:[],...extra,chikun:{x:280,radius:30,motionTick:0,jumpVariant:0,landingVariant:0,...chikun}});

test('ground gait, jumps, falls and landings are chosen from the snapshot context', () => {
  assert.equal(selectChikunAnimation(ground({y:660,velocityY:0,locomotion:'run'})),'walk');
  assert.equal(selectChikunAnimation(ground({y:660,velocityY:0,locomotion:'run'},{difficulty:{speedMultiplier:CHIKUN_RUN_SPEED}})),'run');
  assert.equal(selectChikunAnimation(ground({y:660,velocityY:0,locomotion:'run',motionTick:590,landingVariant:2})),'land_slide','the landing clip owns the first beat of ground contact');
  assert.equal(selectChikunAnimation(ground({y:660,velocityY:0,locomotion:'run',motionTick:540})),'walk');
  const jump={y:600,velocityY:-5,locomotion:'jump',motionTick:595};
  assert.equal(selectChikunAnimation(ground(jump,{forks:[{index:1,family:'gap',kind:'pit',x:330,width:420,height:36}]})),'jump');
  assert.equal(selectChikunAnimation(ground(jump,{forks:[{index:1,family:'tree',kind:'tree',x:330,width:155,height:300}]})),'high_jump');
  assert.equal(selectChikunAnimation(ground(jump,{forks:[{index:1,family:'ground',kind:'rock',x:330,width:76,height:50}]})),'hurdle_jump');
  assert.equal(selectChikunAnimation(ground({...jump,jumpVariant:2})),'high_jump');
  assert.equal(selectChikunAnimation(ground({y:664,velocityY:1,locomotion:'fall',motionTick:595})),'walk','legs keep pumping for a beat after running off an edge');
  assert.equal(selectChikunAnimation(ground({y:700,velocityY:5,locomotion:'fall',motionTick:560})),'dive');
});

test('flight levels out into a flare before touchdown unless a gap is below or a flap intervenes', () => {
  const approach={y:600,velocityY:5,locomotion:'flight',motionTick:400};
  assert.equal(selectChikunAnimation(ground(approach)),'flare');
  assert.equal(selectChikunAnimation(ground(approach,{forks:[{index:3,family:'gap',kind:'pit',x:260,width:420,height:36}]})),'dive');
  assert.equal(selectChikunAnimation(ground({...approach,velocityY:-4.8}),{flapAge:.02}),'accelerate');
  assert.equal(selectChikunAnimation(ground({y:300,velocityY:5,locomotion:'flight',motionTick:400})),'dive','high above the floor there is nothing to flare for');
  assert.equal(selectChikunAnimation(ground({y:120,velocityY:4.2,locomotion:'flight',motionTick:400})),'descend','a high soar floats through a longer descend band');
  assert.equal(selectChikunAnimation(ground({y:560,velocityY:3,locomotion:'flight',motionTick:400})),'dive','skimming low commits to the dive sooner');
  assert.equal(selectChikunAnimation(ground({y:500,velocityY:0,locomotion:'flight',motionTick:400},{forks:[{index:4,family:'sky',kind:'hawk',x:300,width:110,height:38,y:430}]})),'squeeze','ducking under a sky obstacle tucks in');
  assert.equal(selectChikunAnimation(ground({y:600,velocityY:0,locomotion:'flight',motionTick:400},{forks:[{index:4,family:'sky',kind:'canopy',route:'ground',x:300,width:330,height:580,y:0}]})),'squeeze');
  const f0=sampleChikunFrame('flare',0),f1=sampleChikunFrame('flare',11/30);
  assert.equal(f0.frame,23);assert.equal(f1.frame,12);
  for(const t of [0,.1,.2,.36]){const f=sampleChikunFrame('flare',t);assert.ok(f.next<=f.frame&&f.mix>=0&&f.mix<=1);}
});

test('defeat picks a grounded stagger, a pit tumble or the prone impact', () => {
  const hit={kind:'rock',variant:'rock',index:2,x:280,y:660,speed:2.4,velocityY:0};
  assert.equal(selectChikunAnimation(ground({y:660,velocityY:0,locomotion:'run'},{terminal:true,terminalReason:'rock',impact:hit}),{terminalAge:.05}),'ground_impact');
  assert.equal(selectChikunAnimation(ground({y:300,velocityY:2,locomotion:'flight'},{terminal:true,terminalReason:'hawk',impact:{...hit,y:300}}),{terminalAge:.05}),'impact');
  assert.equal(selectChikunAnimation(ground({y:780,velocityY:7,locomotion:'fall'},{terminal:true,terminalReason:'pit',impact:null}),{terminalAge:.1}),'tumble');
  assert.equal(selectChikunAnimation(ground({y:780,velocityY:7,locomotion:'fall'},{terminal:true,terminalReason:'pit',impact:null}),{terminalAge:1}),'fall');
});

test('crossfades are per transition: instant on a hit, crisp on control edges, slow into ground contact', () => {
  assert.equal(chikunBlendSeconds('run','ground_impact'),0);
  assert.equal(chikunBlendSeconds('cruise','impact'),0);
  assert.equal(chikunBlendSeconds('cruise','accelerate'),.06);
  assert.equal(chikunBlendSeconds('walk','hurdle_jump'),.06);
  assert.equal(chikunBlendSeconds('flare','land_roll'),.18);
  assert.equal(chikunBlendSeconds('descend','flare'),.14);
  assert.equal(chikunBlendSeconds('walk','run'),.24);
  assert.equal(chikunBlendSeconds('cruise','dodge_low'),.09);
  assert.equal(chikunBlendSeconds('climb','crest'),.12);
});

test('procedural squash, lean and recoil run through the draw transform and stay off under reduced motion', async () => {
  const originals={Image:globalThis.Image,document:globalThis.document};
  globalThis.Image=class {naturalWidth=768;complete=true;async decode(){}};
  const record=list=>new Proxy({},{get:(t,key)=>(...args)=>{list.push([key,...args]);},set:(t,key,value)=>{t[key]=value;return true;}});
  globalThis.document={createElement:()=>({getContext:()=>record([])})};
  try {
    const character=createChikunCharacter();
    assert.equal(await character.ready,true);
    const calls=[],ctx=record(calls);
    const scaleOf=()=>calls.filter(c=>c[0]==='scale').at(-1).slice(1);
    character.draw(ctx,ground({y:655,velocityY:6,locomotion:'flight',motionTick:500},{tick:599}),1/60,{phase:'running'});
    assert.equal(character.clip,'flare');
    character.draw(ctx,ground({y:660,velocityY:0,locomotion:'run',motionTick:600},{tick:600}),1/60,{phase:'running'});
    assert.equal(character.clip,'land');
    const [sx,sy]=scaleOf();
    assert.ok(sx>1.05&&sy<.95,`landing squashes the sprite (${sx},${sy})`);
    for(let i=0;i<40;i++)character.draw(ctx,ground({y:660,velocityY:0,locomotion:'run',motionTick:600},{tick:601+i}),1/60,{phase:'running'});
    const [rx,ry]=scaleOf();
    assert.ok(Math.abs(rx-1)<.02&&Math.abs(ry-1)<.02,'the squash spring settles');
    character.draw(ctx,ground({y:660,velocityY:0,locomotion:'run',motionTick:600},{tick:650,terminal:true,terminalReason:'rock',impact:{kind:'rock',index:1,x:280,y:660,speed:2.4,velocityY:0}}),1/60,{phase:'game-over',terminalAge:0});
    assert.equal(character.clip,'ground_impact');
    const translate=calls.filter(c=>c[0]==='translate').at(-3);
    assert.ok(translate[1]<280-8,'a hit recoils the sprite backwards without moving the canonical position');
    const reduced=[],rctx=record(reduced),quiet=createChikunCharacter();
    await quiet.ready;
    quiet.draw(rctx,ground({y:655,velocityY:6,locomotion:'flight',motionTick:500},{tick:599}),1/60,{phase:'running',reduceMotion:true});
    quiet.draw(rctx,ground({y:660,velocityY:0,locomotion:'run',motionTick:600},{tick:600}),1/60,{phase:'running',reduceMotion:true});
    assert.deepEqual(reduced.filter(c=>c[0]==='scale').at(-1).slice(1),[1,1]);
    assert.equal(reduced.filter(c=>c[0]==='rotate').at(-1)[1],0);
    character.dispose();quiet.dispose();
  } finally {Object.assign(globalThis,originals);}
});

test('the jump-to-flight roll plays only for the flap that left a jump, never for a low mid-air flap', () => {
  const lowFlap={y:540,velocityY:-4.3,locomotion:'flight',motionTick:596};
  assert.equal(selectChikunAnimation(ground(lowFlap)),'jump_flight','without history the snapshot alone cannot tell the two flaps apart');
  assert.equal(selectChikunAnimation(ground(lowFlap),{launchTick:596}),'jump_flight');
  assert.notEqual(selectChikunAnimation(ground(lowFlap),{launchTick:330,flapAge:.07}),'jump_flight');
  assert.equal(selectChikunAnimation(ground(lowFlap),{launchTick:330,flapAge:.07}),'accelerate');
});

test('the character only rolls out of a jump it actually saw and forgets it on a seek', async () => {
  const originals={Image:globalThis.Image,document:globalThis.document};
  globalThis.Image=class {naturalWidth=768;complete=true;async decode(){}};
  const record=list=>new Proxy({},{get:(t,key)=>(...args)=>{list.push([key,...args]);},set:(t,key,value)=>{t[key]=value;return true;}});
  globalThis.document={createElement:()=>({getContext:()=>record([])})};
  try {
    const character=createChikunCharacter();await character.ready;const ctx=record([]);
    character.draw(ctx,ground({y:640,velocityY:-6,locomotion:'jump',motionTick:590},{tick:592}),1/60,{phase:'running'});
    character.draw(ctx,ground({y:600,velocityY:-4.8,locomotion:'flight',motionTick:596},{tick:596}),1/60,{phase:'running',flapAge:0});
    assert.equal(character.clip,'jump_flight');
    for(let t=597;t<680;t++)character.draw(ctx,ground({y:560,velocityY:2,locomotion:'flight',motionTick:596},{tick:t}),1/60,{phase:'running',flapAge:(t-596)/60});
    character.draw(ctx,ground({y:545,velocityY:-4.8,locomotion:'flight',motionTick:680},{tick:680}),1/60,{phase:'running',flapAge:0});
    assert.equal(character.clip,'accelerate','a low mid-air flap stays prone');
    character.draw(ctx,ground({y:600,velocityY:-4.8,locomotion:'flight',motionTick:596},{tick:596}),1/60,{phase:'running',flapAge:0,seek:true});
    assert.notEqual(character.clip,'jump_flight','a seek has no jump history to roll out of');
    character.dispose();
  } finally {Object.assign(globalThis,originals);}
});

test('a jump keeps the clip it took off with while the course scrolls underneath it', () => {
  // A tall tree stood ahead at take-off (tick 590); by tick 640 it has scrolled behind and a hurdle is next.
  const scrolled=t=>ground({y:600,velocityY:-2,locomotion:'jump',motionTick:590},{tick:t,forks:[
    {index:1,family:'tree',kind:'tree',x:330-2.4*(t-590),width:155,height:300},
    {index:2,family:'ground',kind:'hurdle',x:700-2.4*(t-590),width:90,height:76},
  ]});
  assert.equal(selectChikunAnimation(scrolled(591)),'high_jump');
  assert.equal(selectChikunAnimation(scrolled(640)),'high_jump','the tree has passed but the jump still reads as the high jump it started as');
});
