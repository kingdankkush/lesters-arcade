import test from 'node:test';
import assert from 'node:assert/strict';
import * as cover from '../apps/hmh-reboot/src/world-destructibles.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createHurtTarget, createProjectileState, resolveProjectilePath } from '../apps/hmh-reboot/src/projectile-physics.mjs';
import { createMeleeTarget, stepMeleeState, createMeleeState } from '../apps/hmh-reboot/src/melee.mjs';
import { resolveGrenadeBlast, createGrenadeState } from '../apps/hmh-reboot/src/grenades.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { createEnemyNavGrid, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { refreshWorldDesignGateNavigation } from '../apps/hmh-reboot/src/world-design-interactions.mjs';
import { createMissionState, missionActiveBlockers } from '../apps/hmh-reboot/src/mission-objectives.mjs';
const queryGround = createLevelOneGroundQuery();
const point = d => ({...d.anchor,z:0});
const hurt = (d,id=d.id,p=point(d)) => createHurtTarget({id,bodyShape:{type:'circle',radius:d.radius},hurtShape:{type:'circle',radius:d.radius},previousGround:p,currentGround:p,minZ:0,maxZ:d.maxZ,health:d.hitPoints});

test('all eight caches have physical cover and reachable dry supplies',()=>{
  assert.equal(cover.WORLD_DESTRUCTIBLES.length,8);
  const grid=createEnemyNavGrid({world,queryGround});
  for(const d of cover.WORLD_DESTRUCTIBLES){
    const blocker=world.collisionBlockers.find(b=>b.id===d.id);
    assert.equal(blocker.shape.type,'capsule',d.id); assert.equal(blocker.combatCover,true);
    for(const p of [d.anchor,d.supply]){
      assert.equal(queryGround(p.x,p.y).walkable,true,d.id);assert.equal(queryGround(p.x,p.y).groundZ,0,d.id);
      assert.ok(Math.hypot(p.x-world.player.spawn.x,p.y-world.player.spawn.y)>584+d.radius,d.id);
    }
    const field=computeEnemyFlowField({grid,targetX:d.supply.x,targetY:d.supply.y});
    assert.ok(Number.isFinite(field.distance[grid.cellAt(world.player.spawn.x,world.player.spawn.y)]),d.id);
    assert.ok(field.distance[grid.cellAt(world.player.spawn.x,world.player.spawn.y)]>0,d.id);
  }
});

test('projectiles, melee and grenades damage each cover without hitting the enemy it shields',()=>{
  for(const d of cover.WORLD_DESTRUCTIBLES){
    const p=point(d), behind={x:p.x,y:p.y-70,z:0};
    // Isolate each authored blocker to verify its cover behavior independently
    // of nearby scenery; placement and navigation use the whole world above.
    const blockers=world.collisionBlockers.filter(b=>b.id===d.id);
    const shot=createProjectileState({id:'shot',ownerId:'player',previous:{x:p.x,y:p.y+90,z:30},current:{x:p.x,y:p.y-100,z:30},damage:12,radius:2});
    const resolution=resolveProjectilePath({projectile:shot,targets:[hurt(d),hurt(d,'behind',behind)],blockers});
    assert.equal(resolution.coverHit.blockerId,d.id);
    const hit=cover.worldDestructibleCoverHit({resolution,shot:{...shot,weaponId:'coin-blaster',vx:0,vy:-600},tick:1});
    assert.equal(hit.targetId,d.id);assert.equal(hit.damage,12);
    assert.equal(cover.worldDestructibleCoverHit({resolution:{...resolution,hits:[{targetId:d.id}]},shot,tick:1}),null);
    const meleeTarget=(id,p)=>createMeleeTarget({id,previousGround:p,currentGround:p,radius:d.radius,minZ:0,maxZ:d.maxZ});
    const melee=stepMeleeState(createMeleeState(),{tick:1,automatic:true,origin:{x:p.x,y:p.y+52,z:0},direction:{x:0,y:-1},blockers,targets:[meleeTarget(d.id,p),meleeTarget('behind',behind)]});
    assert.ok(melee.hits.some(h=>h.targetId===d.id),d.id);assert.ok(!melee.hits.some(h=>h.targetId==='behind'));
    const grenade=createGrenadeState({id:'grenade',spawnTick:0,detonateTick:90,mode:'hand',position:{x:p.x,y:p.y+70,z:0},velocity:{x:0,y:0,z:0}});
    const blast=resolveGrenadeBlast({grenade,targets:[hurt(d),hurt(d,'behind',behind)],blockers});
    assert.ok(blast.hits.some(h=>h.targetId===d.id),d.id);assert.ok(!blast.hits.some(h=>h.targetId==='behind'));
  }
});

test('same-seed damage breaks cover once, opens navigation and resets in a new run',()=>{
  function run(){
    const state=cover.createWorldDestructibleState(),events=[];
    for(let tick=1;tick<=8;tick++){
      const targets=cover.worldDestructibleTargets(state).filter(t=>cover.WORLD_DESTRUCTIBLES.some(d=>d.id===t.id));
      const resolution=resolveCombatHits({sessionSeed:1337,targets,hits:targets.map(t=>({id:`${t.id}:${tick}`,tick,targetId:t.id,sourceId:'player',weaponId:'coin-blaster',damage:12,criticalChance:0,direction:{x:1,y:0}}))});
      events.push(...cover.applyWorldDestructibleDamage(state,{targets:resolution.targets,tick}));
    }
    return {state,events};
  }
  const a=run(),b=run();assert.deepEqual(a,b);assert.equal(a.events.length,8);assert.ok(a.events.every(e=>e.tick===7));
  assert.deepEqual(a.events.map(e=>e.id),a.events.map(e=>e.id).sort());
  const gates=createMissionState(1),grid=createEnemyNavGrid({world,queryGround});
  for(const d of cover.WORLD_DESTRUCTIBLES){
    gates.openGates.add(d.id);const blockers=missionActiveBlockers(gates,world.collisionBlockers);
    refreshWorldDesignGateNavigation(grid,world,queryGround,d.id,blockers);
    assert.ok(!blockers.some(b=>b.id===d.id));
  }
  // Eight caches, the fuel drums and the Dark Pool's cracked container (S1.5).
  assert.equal(cover.worldDestructibleTargets(cover.createWorldDestructibleState()).length,8+cover.WORLD_FUEL_DRUMS.length+1);
  assert.equal(missionActiveBlockers(createMissionState(1),world.collisionBlockers).length,world.collisionBlockers.length);
});

test('supplies require destruction, nearby same-height contact and line of sight, then collect once',()=>{
  for(const d of cover.WORLD_DESTRUCTIBLES){
    const state=cover.createWorldDestructibleState(),player={...d.supply,groundZ:0};
    const step=(tick,overrides={})=>cover.stepWorldDestructibleSupplies(state,{tick,player,queryGround,lineClear:()=>true,...overrides});
    const supplyId=`destructible-supply:${d.id}`,coverId=`destructible-prop:${d.id}`;
    assert.ok(cover.worldDestructibleHiddenProps(state).has(supplyId));assert.deepEqual(step(1),[]);
    cover.applyWorldDestructibleDamage(state,{targets:{[d.id]:{health:0}},tick:2});
    assert.ok(cover.worldDestructibleHiddenProps(state).has(coverId));assert.ok(!cover.worldDestructibleHiddenProps(state).has(supplyId));
    assert.deepEqual(step(3,{player:{...player,groundZ:64}}),[]);assert.deepEqual(step(4,{lineClear:()=>false}),[]);
    assert.deepEqual(step(5,{player:{...player,x:player.x+100}}),[]);
    const [reward]=step(6);assert.equal(reward.id,d.id);assert.equal(reward.reward,d.supply.reward);
    assert.deepEqual(step(7),[]);assert.ok(cover.worldDestructibleHiddenProps(state).has(supplyId));
    assert.throws(()=>step(7),/monotonic/);
  }
});
