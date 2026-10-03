import test from 'node:test';
import assert from 'node:assert/strict';
import * as controller from '../apps/hmh-reboot/src/actor-3d-controller.mjs';
import * as clips from '../apps/hmh-reboot/src/actor-3d-clips.mjs';

test('default delivery policy enables bounded desktop/phone actors and respects fallback choices', () => {
  const resolve = controller.resolveActor3dDeliveryPolicy;
  assert.equal(typeof resolve, 'function');
  assert.deepEqual(resolve({ profileId:'desktop' }), { enabled:true, qualityTier:'medium', reason:'default' });
  assert.deepEqual(resolve({ profileId:'mobile', quality:'high' }), { enabled:true, qualityTier:'low', reason:'default' });
  assert.equal(resolve({ switchValue:'0' }).enabled, false);
  assert.equal(resolve({ quality:'sprites' }).enabled, false);
  assert.equal(resolve({ hardwareConcurrency:2 }).enabled, false);
  assert.equal(resolve({ saveData:true }).enabled, false);
  assert.equal(resolve({ switchValue:'1', saveData:true }).enabled, true);
  assert.equal(resolve({ profileId:'desktop', quality:'high' }).qualityTier, 'high');
});

test('real weapon events select existing authored fire/reload clips with their own clocks', () => {
  const pick = clips.selectHeroActor3dClip;
  assert.equal(typeof pick, 'function');
  for (const [weaponId, name] of [['scatter-shotgun','fire-shotgun'],['auto-miner','fire-rifle'],['hash-rail','fire-rifle'],['launcher-rig','fire-launcher'],['bear-market-burner','fire-heavy']]) {
    const input = Object.freeze({ action:'aim', actionTick:100, weaponId, shotAge:3 });
    assert.deepEqual(pick(input), { clip:name, clipTick:3 });
  }
  assert.deepEqual(pick({ action:'aim', weaponId:'auto-miner', reloadProgress:.5 }), { clip:'reload-long', clipTick:25 });
  assert.equal(pick({ action:'death', shotAge:3, weaponId:'auto-miner' }), null);
  assert.equal(pick({ action:'dash', reloadProgress:.5 }), null);
  assert.deepEqual(pick({ action:'interact', actionTick:9, missionTick:45, missionGesture:'crank' }), { clip:'interact-valve', clipTick:45 }, 'a channel keeps turning past the sprite reach hold');
});

test('movement, interactions and cover render authored poses without altering incoming state', () => {
  const base={actorId:'lilly',weaponId:'coin-blaster',x:0,y:0,z:0,heading:0,action:'aim',actionTick:120,moving:true,originals:[]};
  const sideways=Object.freeze({...base,velocity:Object.freeze({x:0,y:120})});
  const before=JSON.stringify(sideways), frame=controller.createActor3dPresentationEntries(sideways,[]);
  assert.equal(frame[0].descriptor.clip,'strafe-r'); assert.equal(JSON.stringify(sideways),before);
  assert.equal(controller.createActor3dPresentationEntries({...base,velocity:{x:-120,y:0}},[])[0].descriptor.clip,'back-pedal');
  assert.equal(controller.createActor3dPresentationEntries({...base,action:'interact',missionGesture:'lever'},[])[0].descriptor.clip,'interact-lever');
  assert.equal(controller.createActor3dPresentationEntries({...base,action:'interact'},[]).length,0);
  assert.equal(controller.createActor3dPresentationEntries({...base,clip:'cover-idle-short',clipTick:25},[])[0].descriptor.clip,'cover-idle-short');
  assert.equal(controller.createActor3dPresentationEntries({...base,action:'death',clip:'cover-idle-short',clipTick:25},[])[0].descriptor.clip,'death');
});

test('movement accents play once on observed start/stop, hold while paused and reset safely on rewind',()=>{
  assert.equal(typeof clips.createHeroMovementPicker,'function');
  const picker=clips.createHeroMovementPicker({actorId:'lilly'});
  const observe=(tick,moving)=>picker.observe({actorId:'lilly',action:moving?'aim':'idle',actionTick:tick,heading:0,moving,velocity:{x:moving?240:0,y:0}});
  assert.equal(observe(100,false),null);
  assert.deepEqual(observe(101,true),{clip:'run-start',tick:0});
  assert.deepEqual(observe(101,true),{clip:'run-start',tick:0});
  assert.deepEqual(observe(114,true),{clip:'run-start',tick:13});
  assert.equal(observe(115,true),null);assert.equal(observe(116,true),null);
  assert.deepEqual(observe(117,false),{clip:'run-stop',tick:0});
  assert.equal(observe(133,false),null);
  assert.equal(observe(5,true),null,'rewind establishes a fresh baseline');
  assert.deepEqual(observe(6,false),{clip:'run-stop',tick:0});
});

test('standing turns use wrapped cumulative heading, and combat/cover/strafe always interrupt accents',()=>{
  const picker=clips.createHeroMovementPicker({actorId:'lit-commando'});
  const base={actorId:'lit-commando',action:'idle',moving:false,heading:Math.PI-.1,velocity:{x:0,y:0},weaponId:'auto-miner'};
  const observe=(tick,fields={})=>picker.observe(Object.freeze({...base,actionTick:tick,...fields}));
  assert.equal(observe(100),null);
  assert.equal(observe(101,{heading:-Math.PI+.1}),null,'crossing ±pi is not a full turn');
  assert.deepEqual(observe(102,{heading:-Math.PI+1.2}),{clip:'turn-r',tick:0});
  assert.equal(observe(103,{action:'hurt',heading:-Math.PI+1.2}),null);
  assert.equal(observe(104,{heading:0,clip:'cover-idle-tall-l',clipTick:4}),null);
  assert.equal(observe(105,{action:'aim',moving:true,heading:0,velocity:{x:0,y:240}}),null);
  assert.equal(observe(106,{action:'aim',moving:true,heading:0,velocity:{x:240,y:0},reloadProgress:.5}),null);
  assert.equal(observe(107,{heading:0}),null);
  assert.deepEqual(observe(108,{heading:-1.2}),{clip:'turn-l',tick:0});
  assert.equal(observe(109,{action:'death'}),null);
  assert.equal(observe(110,{heading:0}),null);
  assert.deepEqual(observe(111,{heading:Math.PI}),{clip:'pivot',tick:0});
});

test('native enemy recoil reaches its full authored clip during the existing six-tick hit window',()=>{
  const enemy={id:'hit',actorId:'hodl-revenant',active:true,visible:true,alpha:1,x:0,y:0,z:0,originals:[]};
  for(const [tick,expected] of [[0,0],[3,.5],[6,1],[15,1]]) {
    const input=Object.freeze({...enemy,pose:Object.freeze({state:'hit',direction:2,tick})}),before=JSON.stringify(input);
    const pose=controller.createActor3dPresentationEntries(null,[input])[0].descriptor;
    assert.equal(pose.clipTimeSeconds,expected);assert.equal(JSON.stringify(input),before);
  }
  assert.equal(controller.createActor3dPresentationEntries(null,[{...enemy,pose:{state:'attack',direction:2,phaseTick:3}}])[0].descriptor.clipTimeSeconds,3/60);
});

test('opaque native corpses use only remaining slots after hero, bosses and living enemies',()=>{
  const live={id:'live',actorId:'bagholder-rusher',active:true,visible:true,alpha:1,x:200,y:0,z:0,pose:{state:'run',direction:2,tick:4},originals:[]};
  const corpse={id:'fallen',actorId:'hodl-revenant',visible:true,alpha:1,x:0,y:0,z:0,pose:{state:'death',direction:2,tick:30},originals:[]};
  const boss={actorId:'boss-lockkeeper',active:true,visible:true,alpha:1,x:10,y:0,z:0,pose:{state:'idle',direction:0,tick:4},originals:[]};
  const hero={actorId:'lilly',weaponId:'coin-blaster',x:0,y:0,z:0,heading:0,action:'idle',actionTick:0,originals:[]};
  const input=Object.freeze({...corpse,pose:Object.freeze(corpse.pose)}),before=JSON.stringify(input);
  const full=controller.createActor3dPresentationEntries(hero,[live],null,4,hero,[boss],[input]);
  assert.deepEqual(full.map(row=>row.descriptor.id),['hero','boss:boss-lockkeeper','enemy:live','corpse:fallen']);
  assert.equal(full.at(-1).descriptor.clip,'death');assert.equal(full.at(-1).descriptor.clipTimeSeconds,.5);
  assert.equal(JSON.stringify(input),before);
  assert.deepEqual(controller.createActor3dPresentationEntries(hero,[live],null,3,hero,[boss],[corpse]).map(row=>row.descriptor.id),['hero','boss:boss-lockkeeper','enemy:live']);
  const invalid=[{...corpse,alpha:.99},{...corpse,visible:false},{...corpse,actorId:'creature'},{...corpse,pose:{state:'run',direction:2,tick:1}}];
  assert.equal(controller.createActor3dPresentationEntries(null,[],null,8,null,null,invalid).length,0);
});
