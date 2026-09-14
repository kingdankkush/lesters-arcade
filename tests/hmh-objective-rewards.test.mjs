import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollectibleState, stepCollectibles } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { OBJECTIVE_REWARDS, objectiveRewardPlacements, objectiveRewardStatus } from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';
import { canAcceptCollectible } from '../apps/hmh-reboot/src/collectible-capacity.mjs';
import { createWeaponLoadout, grantWeaponPickup } from '../apps/hmh-reboot/src/weapon-system.mjs';

const base = Array.from({length:10},(_,i)=>({id:`base:${i}`,assetId:'bonus-life',x:10000+i*200,y:0}));
const make = () => createCollectibleState({placements:base,objectivePlacements:objectiveRewardPlacements()});
const relay = () => OBJECTIVE_REWARDS.find(r=>r.objectiveId==='relay-power');
const step = (s,t,point,extra={}) => stepCollectibles(s,{tick:t,player:point,...extra});

test('all six machinery sites and the boss have distinct stable reward ownership',()=>{
  assert.equal(OBJECTIVE_REWARDS.length,7);
  assert.equal(new Set(OBJECTIVE_REWARDS.map(r=>r.id)).size,7);
  assert.equal(new Set(OBJECTIVE_REWARDS.map(r=>r.objectiveId)).size,7);
});
test('locked court cannot grant its reward even when the player is inside',()=>{
  const s=make(),r=relay();
  assert.equal(step(s,1,r).events.length,0);
  assert.equal(objectiveRewardStatus(s,r.id,1),'locked');
  s.unlockedObjectives.add(r.objectiveId);
  assert.equal(objectiveRewardStatus(s,r.id,2),'reward available');
  const f=step(s,2,r);
  assert.equal(f.events.length,1);
  assert.equal(f.events[0].xpGain,0);
  assert.equal(step(s,3,r).events.length,0);
  assert.equal(objectiveRewardStatus(s,r.id,3),'collected');
});
test('a repeat supply is available at its exact simulation tick with one instance and no repeat XP',()=>{
  const s=createCollectibleState({placements:base.map((p,i)=>i? p:{...p,assetId:'hash-rail-core',respawnTicks:7200})});
  const p=s.entries[0].placement;
  assert.equal(step(s,10,p).events[0].xpGain,160);
  assert.equal(step(s,7209,p).events.length,0);
  const ready=step(s,7210,p);
  assert.equal(ready.events.length,1);
  assert.equal(ready.events[0].xpGain,0);
  assert.equal(s.collectionCounts.get(p.id),2);
  assert.equal(s.entries.length,10);
  assert.throws(()=>step(s,7210,p),/monotonic/);
});
test('full inventory and blocked reach leave a ready reward unconsumed',()=>{
  const s=make(),r=relay();s.unlockedObjectives.add(r.objectiveId);
  assert.equal(step(s,1,r,{canCollect:()=>false}).events.length,0);
  assert.equal(step(s,2,r,{canReach:()=>false}).events.length,0);
  assert.equal(objectiveRewardStatus(s,r.id,2),'reward available');
  assert.equal(step(s,3,r).events.length,1);
});
test('the boss vault stays locked until the boss death objective is recorded and cannot grant twice',()=>{
  const s=make(),r=OBJECTIVE_REWARDS.find(r=>r.objectiveId==='liquidator-defeated');
  assert.equal(step(s,1,r).events.length,0);
  s.unlockedObjectives.add('yard-warehouse');
  assert.equal(step(s,2,r).events.length,0);
  s.unlockedObjectives.add(r.objectiveId);
  assert.equal(step(s,3,r).events.length,1);
  s.unlockedObjectives.add(r.objectiveId);
  assert.equal(step(s,4,r).events.length,0);
});
test('new run resets cooldowns, collections, and objective completion',()=>{
  const s=make(),r=relay();s.unlockedObjectives.add(r.objectiveId);step(s,1,r);
  const fresh=make();
  assert.equal(fresh.collectionCounts.size,0);
  assert.equal(fresh.unlockedObjectives.size,0);
  assert.equal(step(fresh,1,r).events.length,0);
});

test('each objective reward has a clear outward and return path through the opened gate',()=>{
  const ground=createLevelOneGroundQuery();
  const body=createCollisionBody({id:'reward-walker',kind:'player',radius:24,minZ:0,maxZ:56});
  for(const r of OBJECTIVE_REWARDS) {
    const site=WORLD_DESIGN_SITES.find(s=>s.id===r.objectiveId);
    if(!site)continue;
    const blockers=world.collisionBlockers.filter(b=>b.id!==site.gateId);
    for(const [from,to] of [[site,r],[r,site]]) {
      const count=Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/4);let p=from;
      for(let i=1;i<=count;i++) {
        const next={x:from.x+(to.x-from.x)*i/count,y:from.y+(to.y-from.y)*i/count};
        const c=resolveSweptCircleMotion({body,start:{...p,z:ground(p.x,p.y).groundZ},delta:{x:next.x-p.x,y:next.y-p.y},blockers,bounds:world.bounds});
        assert.equal(c.contacts.length+c.depenetrations.length,0,`${r.id}: ${c.contacts[0]?.blockerId??c.depenetrations[0]?.blockerId}`);
        const t=resolveSweptTraversalPath({start:p,end:c.position,queryGround:ground,maxSampleDistance:4});
        assert.ok(t.allowed,`${r.id}: ${t.reason}`);p=t.position;
      }
    }
  }
});

test('full ammunition, health and grenade inventory preserve pickups until capacity exists',()=>{
  const loadout=createWeaponLoadout({weaponIds:['coin-blaster','scatter-shotgun']});
  const args={health:100,maxHealth:100,grenades:5,maxGrenades:5,loadout};
  assert.equal(canAcceptCollectible({kind:'heal'},args),false);
  assert.equal(canAcceptCollectible({kind:'grenade-supply'},args),false);
  assert.equal(canAcceptCollectible({kind:'ammo-refill'},args),false);
  assert.equal(canAcceptCollectible({kind:'weapon-cache',weaponId:'scatter-shotgun'},args),true);
  grantWeaponPickup(loadout,{tick:1,weaponId:'scatter-shotgun'});
  grantWeaponPickup(loadout,{tick:1,weaponId:'scatter-shotgun'});
  assert.equal(canAcceptCollectible({kind:'weapon-cache',weaponId:'scatter-shotgun'},args),false);
  loadout.weapons['scatter-shotgun'].ammoInClip--;
  assert.equal(canAcceptCollectible({kind:'ammo-refill'},args),true);
});
