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
  assert.equal(OBJECTIVE_REWARDS.length,8);
  assert.equal(new Set(OBJECTIVE_REWARDS.map(r=>r.id)).size,8);
  assert.deepEqual([...new Set(OBJECTIVE_REWARDS.map(r=>r.objectiveId))].sort(),[...WORLD_DESIGN_SITES.map(s=>s.id),'liquidator-defeated'].sort());
  for(const r of OBJECTIVE_REWARDS) assert.ok(!r.respawnTicks||[7200,10800].includes(r.respawnTicks),r.id);
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
    // S1.4: the machine's operate spot sits beside its footpath, so the walk
    // starts at the gate mouth, 80 units out from the opened gate.
    const court=WORLD_DESIGN_COURTS.find(c=>c.gateId===site.gateId);
    const mouth={south:{x:court.x,y:court.y+185},north:{x:court.x,y:court.y-185},east:{x:court.x+185,y:court.y},west:{x:court.x-185,y:court.y}}[court.gateSide];
    for(const [from,to] of [[mouth,r],[r,mouth]]) {
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

// Remaining destinations (HMH-R02): havens and the trap follow the shipped
// court pattern, so the same physical checks cover all six sites.
import { createEnemyNavGrid, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { WORLD_DESIGN_COURTS } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { worldDesignHazardPhase } from '../apps/hmh-reboot/src/world-design-interactions.mjs';
import { createMissionState, stepMissionObjectives, missionActiveBlockers } from '../apps/hmh-reboot/src/mission-objectives.mjs';

const gatedRewards = () => OBJECTIVE_REWARDS.map(r=>[r,WORLD_DESIGN_SITES.find(s=>s.id===r.objectiveId)]).filter(([,site])=>site?.gateId);

test('every machinery site owns a court gate and every gated reward sits inside that court',()=>{
  for(const site of WORLD_DESIGN_SITES) {
    const court=WORLD_DESIGN_COURTS.find(c=>c.gateId===site.gateId);
    assert.ok(court,`${site.id} has a court`);
    assert.ok(world.collisionBlockers.some(b=>b.id===site.gateId),`${site.gateId} is a real collider`);
    const rewards=OBJECTIVE_REWARDS.filter(r=>r.objectiveId===site.id);
    assert.ok(rewards.length>=1,`${site.id} pays off`);
    for(const r of rewards) assert.ok(Math.abs(r.x-court.x)<=69&&Math.abs(r.y-court.y)<=64,`${r.id} lies inside ${court.id}`);
  }
});

test('no reward is reachable through a closed gate, and opening only that gate connects it to its machinery',()=>{
  const queryGround=createLevelOneGroundQuery();
  for(const [r,site] of gatedRewards()) {
    const closed=createEnemyNavGrid({world,queryGround});
    assert.equal(closed.isWalkableAt(r.x,r.y),true,`${r.id} interior is walkable`);
    const closedField=computeEnemyFlowField({grid:closed,targetX:r.x,targetY:r.y});
    assert.ok(closedField.distance[closed.cellAt(site.x,site.y)]<0,`${r.id} must be sealed while ${site.gateId} stands`);
    const state=createMissionState(1);state.openGates.add(site.gateId);
    const open=createEnemyNavGrid({world:{...world,collisionBlockers:missionActiveBlockers(state,world.collisionBlockers)},queryGround});
    const openField=computeEnemyFlowField({grid:open,targetX:r.x,targetY:r.y});
    assert.ok(openField.distance[open.cellAt(site.x,site.y)]>0,`${r.id} opens from ${site.id}`);
  }
});

test('each objective cache stands clear of world obstacles with a walkable approach using the real player body',()=>{
  const ground=createLevelOneGroundQuery();
  const body=createCollisionBody({id:'cache-walker',kind:'player',radius:world.player.radius,minZ:0,maxZ:56});
  for(const [r,site] of gatedRewards()) {
    const blockers=world.collisionBlockers.filter(b=>b.id!==site.gateId);
    const sweep=(from,to)=>resolveSweptCircleMotion({body,start:{...from,z:ground(from.x,from.y).groundZ},delta:{x:to.x-from.x,y:to.y-from.y},blockers,bounds:world.bounds});
    const at=sweep(r,r);
    assert.equal(at.depenetrations.length+at.contacts.length,0,`${r.id} overlaps ${at.depenetrations[0]?.blockerId??at.contacts[0]?.blockerId}`);
    const approaches=[[84,0],[-84,0],[0,84],[0,-84]].map(([dx,dy])=>({x:r.x+dx,y:r.y+dy}));
    assert.ok(approaches.some(from=>Math.abs(ground(from.x,from.y).groundZ-ground(r.x,r.y).groundZ)<=8&&sweep(from,r).contacts.length+sweep(from,r).depenetrations.length===0),`${r.id} has no clear approach`);
    assert.ok(ground(r.x,r.y).groundZ>=0&&!ground(r.x,r.y).deepWater,`${r.id} is on dry ground`);
  }
});

test('the three new destinations restock on simulation ticks with one instance and never repeat XP',()=>{
  const s=make();
  const byId=id=>OBJECTIVE_REWARDS.find(r=>r.id===id);
  const pump=byId('reward:crossing-supply'),heal=byId('reward:hashwood-sanctuary'),scrypt=byId('reward:hashwood-scrypt'),trap=byId('reward:mining-trap');
  assert.deepEqual([pump.respawnTicks,heal.respawnTicks,scrypt.respawnTicks,trap.respawnTicks],[7200,7200,7200,10800]);
  assert.equal(step(s,1,pump).events.length,0,'pump haven is locked before the pump runs');
  s.unlockedObjectives.add('crossing-pump');s.unlockedObjectives.add('hashwood-shrine');s.unlockedObjectives.add('mining-valve');
  const first=step(s,2,pump).events;
  assert.deepEqual([first.length,first[0].kind,first[0].xpGain],[1,'ammo-refill',0]);
  assert.equal(objectiveRewardStatus(s,pump.id,3),'restocks in 120s');
  assert.equal(step(s,7201,pump).events.length,0);
  assert.equal(step(s,7202,pump).events[0].xpGain,0);
  assert.equal(s.collectionCounts.get(pump.id),2);
  // Both sanctuary caches share one owner but collect independently.
  const shrine=step(s,7203,{x:7150,y:3450}).events.map(e=>[e.placementId,e.kind]).sort();
  assert.deepEqual(shrine,[['reward:hashwood-sanctuary','heal'],['reward:hashwood-scrypt','grenade-supply']]);
  assert.equal(step(s,7204,{x:7150,y:3450},{canCollect:e=>e.kind!=='heal'}).events.length,0);
  const surge=step(s,7205,trap).events[0];
  assert.deepEqual([surge.kind,surge.effectId,surge.expiresTick,surge.xpGain],['timed','berserk-candle',7805,0]);
  assert.equal(objectiveRewardStatus(s,trap.id,7206),'restocks in 180s');
  const expired=step(s,18004,trap).events;
  assert.deepEqual(expired.map(e=>e.type),['collectible:expired'],'the surge lapses long before the trap restocks');
  assert.equal(step(s,18005,trap).events[0].refreshed,false,'a restocked power-up after expiry is a fresh activation');
  assert.equal(s.entries.filter(e=>e.placement.id===trap.id).length,1);
});

test('the liquidation trap vents across the court mouth after the gate opens, and never over the valve stand or the cache',()=>{
  const site=WORLD_DESIGN_SITES.find(s=>s.id==='mining-valve'),court=WORLD_DESIGN_COURTS.find(c=>c.gateId===site.gateId),h=site.hazard;
  const gate=world.collisionBlockers.find(b=>b.id===site.gateId),mouth={x:(gate.shape.a.x+gate.shape.b.x)/2,y:(gate.shape.a.y+gate.shape.b.y)/2};
  assert.ok(Math.hypot(h.x-mouth.x,h.y-mouth.y)<h.radius,'steam covers the gate opening');
  assert.ok(Math.hypot(h.x-site.x,h.y-site.y)>h.radius,'the valve stand is outside the steam');
  const cache=OBJECTIVE_REWARDS.find(r=>r.objectiveId===site.id);
  assert.ok(Math.hypot(h.x-cache.x,h.y-cache.y)>h.radius+world.player.radius,'the cache is outside the steam');
  assert.equal(court.gateSide,'south');
  const state=createMissionState(1);const events=[];
  for(let tick=0;tick<site.holdTicks;tick++) events.push(...stepMissionObjectives(state,{tick,player:{...site,groundZ:0},queryGround:()=>({groundZ:0})}).events);
  assert.deepEqual(events[0].effects[0],{type:'open-gate',gateId:site.gateId},'the gate opens when the valve completes');
  const done=site.holdTicks-1;
  assert.equal(worldDesignHazardPhase(state,site,done).phase,'warning');
  assert.equal(worldDesignHazardPhase(state,site,done+h.warningTicks+h.durationTicks).phase,'spent');
});
