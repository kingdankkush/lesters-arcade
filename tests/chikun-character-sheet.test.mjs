// 2026-09-16 character-sheet pass: clip inventory, steep / hit selection thresholds and atlas budgets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CHIKUN_CLIPS, GROUND_CLIPS, CHIKUN_HIT_CLIPS, CHIKUN_HIT_FAMILIES, CHIKUN_STEEP_CLIMB_VELOCITY, CHIKUN_STEEP_DIVE_VELOCITY, chikunHitClip, chikunBlendSeconds, selectChikunAnimation, sampleChikunFrame, createChikunCharacter } from '../apps/chikun/src/character.mjs';
import { GROUND_SKY_KINDS } from '../apps/portal/src/chikun-ground-course.mjs';

const generated=new URL('../apps/portal/assets/generated/',import.meta.url);
const manifest=dir=>JSON.parse(readFileSync(new URL(`${dir}/character.json`,generated),'utf8'));
const ground=(chikun,extra={})=>({tick:600,difficulty:{speedMultiplier:1},forks:[],...extra,chikun:{x:280,radius:30,motionTick:0,jumpVariant:0,landingVariant:0,...chikun}});

test('the owner pose list is covered by 39 native clips at 24 frames / 30 fps, loops and one-shots as authored', () => {
  const expected={
    idle:true,walk:true,run:true,jump:false,hurdle_jump:false,high_jump:false,jump_flight:false,land:false,land_roll:false,land_slide:false,ground_impact:false,
    ready:true,takeoff:false,cruise:true,accelerate:false,climb:true,crest:false,descend:true,dive:true,brake:false,recover:false,squeeze:true,
    dodge_high:false,dodge_low:false,collect:false,barrel_roll:false,impact:false,tumble:false,fall:false,reverse_roll:false,corkscrew:false,victory_twirl:false,
    steep_climb:true,steep_dive:true,hit_tree:false,hit_storm:false,hit_drone:false,hit_bird:false,hit_wall:false,
  };
  assert.deepEqual(Object.keys(CHIKUN_CLIPS).filter(n=>n!=='flare').sort(),Object.keys(expected).sort());
  for(const [name,loop] of Object.entries(expected)) {
    const clip=CHIKUN_CLIPS[name];
    assert.equal(clip.frames,24,name);assert.equal(clip.fps,30,name);assert.equal(clip.loop,loop,`${name} loop`);assert.equal(clip.sheet,name);
  }
  assert.deepEqual(CHIKUN_CLIPS.flare,{name:'flare',frames:24,fps:30,loop:false,sheet:'jump_flight',reverse:true});
  assert.ok(GROUND_CLIPS.includes('idle'));
  assert.deepEqual([...CHIKUN_HIT_CLIPS],['hit_tree','hit_storm','hit_drone','hit_bird','hit_wall']);
});

test('steep climb and steep dive bands sit inside the flap / free-fall envelope', () => {
  assert.equal(CHIKUN_STEEP_CLIMB_VELOCITY,-2.4);
  assert.equal(CHIKUN_STEEP_DIVE_VELOCITY,5.6);
  const air=v=>ground({y:360,velocityY:v,locomotion:'flight',motionTick:400});
  assert.equal(selectChikunAnimation(air(-4.8),{flapAge:.05}),'accelerate','the flap edge still owns the first beat');
  assert.equal(selectChikunAnimation(air(-3.0)),'steep_climb');
  assert.equal(selectChikunAnimation(air(-2.4)),'climb');
  assert.equal(selectChikunAnimation(air(-1.0)),'crest');
  assert.equal(selectChikunAnimation(air(4.5)),'dive');
  assert.equal(selectChikunAnimation(air(5.6)),'steep_dive');
  assert.equal(selectChikunAnimation(air(7)),'steep_dive');
  assert.equal(selectChikunAnimation(ground({y:610,velocityY:7,locomotion:'flight',motionTick:400})),'flare','near the floor the flare wins over the plunge');
  assert.equal(selectChikunAnimation(ground({y:650,velocityY:7,locomotion:'flight',motionTick:400},{forks:[{index:3,family:'gap',kind:'pit',x:260,width:420,height:36}]})),'dive','over a pit the plunge stays a dive so the drop reads as a fall');
});

test('every course obstacle family maps to a hit clip, grounded hits stagger, pits tumble', () => {
  const families={tree:'hit_tree',forest:'hit_tree',canopy:'hit_tree',storm:'hit_storm',drone:'hit_drone',plane:'hit_drone',hawk:'hit_bird',eagle:'hit_bird',pelican:'hit_bird',pipe:'hit_wall',town:'hit_wall',crate:'hit_wall',hurdle:'hit_wall'};
  for(const [kind,clip] of Object.entries(families)) assert.equal(CHIKUN_HIT_FAMILIES[kind],clip,kind);
  for(const kind of GROUND_SKY_KINDS) {
    const airborne={terminal:true,terminalReason:kind,impact:{kind,index:1,x:280,y:300},chikun:{y:300,locomotion:'flight'}};
    assert.ok(CHIKUN_CLIPS[chikunHitClip(airborne)],kind);
    if(['rock','log','thorn','shiba','pit','waterfall'].includes(kind)) assert.equal(chikunHitClip(airborne),'impact',kind);
    else assert.ok(CHIKUN_HIT_CLIPS.includes(chikunHitClip(airborne)),kind);
    const standing={...airborne,chikun:{y:660,locomotion:'run'}};
    assert.equal(chikunHitClip(standing),'ground_impact',kind);
  }
  assert.equal(chikunHitClip({terminalReason:'ceiling',chikun:{y:62,locomotion:'flight'}}),'impact','legacy sky reasons keep the prone impact');
  const storm=ground({y:300,velocityY:2,locomotion:'flight'},{terminal:true,terminalReason:'storm',impact:{kind:'storm',index:2,x:280,y:300}});
  assert.equal(selectChikunAnimation(storm,{terminalAge:.05}),'hit_storm');
  assert.equal(selectChikunAnimation(storm,{terminalAge:.79}),'hit_storm','a family hit plays its full 0.8 s one-shot');
  assert.equal(selectChikunAnimation(storm,{terminalAge:.81}),'fall');
  assert.equal(selectChikunAnimation(ground({y:780,velocityY:7,locomotion:'fall'},{terminal:true,terminalReason:'pit',impact:null}),{terminalAge:.1}),'tumble');
  for(const clip of CHIKUN_HIT_CLIPS) assert.equal(chikunBlendSeconds('cruise',clip),0,`${clip} lands on the frame it happens`);
  assert.equal(chikunBlendSeconds('walk','idle'),.2);
});

test('the pre-run hero waits hands-in-pockets on the ground and hovers in the legacy sky mode', () => {
  assert.equal(selectChikunAnimation(ground({y:660,velocityY:0,locomotion:'run'}),{phase:'ready'}),'idle');
  assert.equal(selectChikunAnimation(ground({y:660,velocityY:0,locomotion:'run'}),{phase:'waiting'}),'idle');
  assert.equal(selectChikunAnimation({tick:0,chikun:{x:280,y:360,velocityY:0}},{phase:'ready'}),'ready');
  assert.equal(sampleChikunFrame('idle',.8).frame,0,'idle loops every 24 frames');
});

test('hit clips run on the terminal clock, recoil, and keep the ragdoll handoff timing', async () => {
  const originals={Image:globalThis.Image,document:globalThis.document};
  globalThis.Image=class {naturalWidth=768;complete=true;async decode(){}};
  const record=list=>new Proxy({},{get:(t,key)=>(...args)=>{list.push([key,...args]);},set:(t,key,value)=>{t[key]=value;return true;}});
  // Sprite frames are painted into the offscreen composite canvas; the game context only receives the blended result.
  const paints=[];
  globalThis.document={createElement:()=>({getContext:()=>record(paints)})};
  try {
    const character=createChikunCharacter();await character.ready;const calls=[],ctx=record(calls);
    character.draw(ctx,ground({y:300,velocityY:0,locomotion:'flight',motionTick:500},{tick:599}),1/60,{phase:'running'});
    assert.equal(character.clip,'cruise');
    const hit=ground({y:300,velocityY:1,locomotion:'flight',motionTick:500},{tick:600,terminal:true,terminalReason:'drone',impact:{kind:'drone',index:1,x:280,y:300,speed:2.4,velocityY:1}});
    character.draw(ctx,hit,1/60,{phase:'game-over',terminalAge:0});
    assert.equal(character.clip,'hit_drone');
    const translate=calls.filter(c=>c[0]==='translate').at(-3);
    assert.ok(translate[1]<280-8,'the hit recoils the sprite backwards');
    // Atlas frame index of the last sprite paint: (sx/192)+4*(sy/192).
    const frameOf=()=>{const paint=paints.filter(c=>c[0]==='drawImage'&&c.length===10).at(-1);return paint[2]/192+4*(paint[3]/192);};
    character.draw(ctx,hit,1/60,{phase:'game-over',terminalAge:.5});
    assert.ok(frameOf()>=14,'the hit clip advances with terminal age rather than wall time');
    character.dispose();
  } finally {Object.assign(globalThis,originals);}
});

test('flight and ground atlases are genuine native frames inside their payload budgets', () => {
  const flight=manifest('chikun-flight-v3'),groundAtlas=manifest('chikun-ground-motion-v1');
  assert.equal(flight.schema,'chikun-native-character-v4');
  assert.equal(flight.characterSheet,'owner attachment 2026-09-16');
  assert.deepEqual(flight.expressionBones,['brow.L','brow.R','beak']);
  assert.deepEqual(flight.expressions,['gritted','shouting','side_eye','smug','stern','surprised']);
  assert.equal(flight.palette.crest,'#c8102e');assert.equal(flight.palette.eye,'#6ff5b0');assert.equal(flight.palette.beak,'#f28c28');
  assert.equal(flight.triangles,62830,'the owner surface topology is untouched');
  assert.equal(flight.clips.length,28);
  assert.equal(groundAtlas.clips.length,11);
  assert.ok(flight.runtimeBytes<4*1024*1024,`flight atlases ${flight.runtimeBytes} B`);
  assert.ok(groundAtlas.runtimeBytes<1.5*1024*1024,`ground atlases ${groundAtlas.runtimeBytes} B`);
  const names=new Set();
  for(const [dir,atlas] of [['chikun-flight-v3',flight],['chikun-ground-motion-v1',groundAtlas]]) {
    for(const clip of atlas.clips) {
      names.add(clip.name);
      assert.ok(CHIKUN_CLIPS[clip.name],clip.name);
      assert.equal(CHIKUN_CLIPS[clip.name].loop,clip.loop,clip.name);
      assert.equal(GROUND_CLIPS.includes(clip.name),dir==='chikun-ground-motion-v1',`${clip.name} is loaded from ${dir}`);
      assert.ok(clip.uniqueFrames>=12,clip.name);
      assert.ok(clip.bytes<140*1024,`${clip.name} ${clip.bytes} B`);
      assert.equal(createHash('sha256').update(readFileSync(new URL(`${dir}/${clip.sheet}`,generated))).digest('hex'),clip.sha256,clip.name);
    }
  }
  assert.equal(names.size,39);
  const ragdoll=JSON.parse(readFileSync(new URL('chikun-ragdoll-v1/manifest.json',generated),'utf8'));
  assert.deepEqual(ragdoll.assets.map(a=>a.name),['armL','armR','head','legL','legR','torso']);
  assert.ok(ragdoll.runtimeBytes<64*1024);
  const provenance=JSON.parse(readFileSync(new URL('../apps/chikun/assets/source/native-provenance.json',import.meta.url),'utf8'));
  assert.equal(provenance.clips.length,39);assert.equal(provenance.bones.length,18);assert.equal(provenance.frameSize,256);
});
