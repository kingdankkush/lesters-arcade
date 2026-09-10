import test from 'node:test';
import assert from 'node:assert/strict';
import * as secrets from '../apps/hmh-reboot/src/world-design-secrets.mjs';
import { LEVEL_ONE_WORLD as world } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createMeleeTarget,stepMeleeState,createMeleeState } from '../apps/hmh-reboot/src/melee.mjs';
import { createHurtTarget,createProjectileState,resolveProjectilePath } from '../apps/hmh-reboot/src/projectile-physics.mjs';
import { resolveGrenadeBlast,createGrenadeState } from '../apps/hmh-reboot/src/grenades.mjs';
import { readFileSync } from 'node:fs';
const id=secrets.WORLD_DESIGN_SECRET_SEAL.id,point={x:370,y:3270,z:0};
const target=createHurtTarget({id,bodyShape:{type:'circle',radius:20},hurtShape:{type:'circle',radius:20},previousGround:point,currentGround:point,minZ:0,maxZ:40,health:60});
test('the physical secret crate takes automatic close-combat damage while its solid collider still protects targets behind it',()=>{
 const make=(targetId,p)=>createMeleeTarget({id:targetId,previousGround:p,currentGround:p,radius:20,minZ:0,maxZ:40});
 const args={tick:1,automatic:true,origin:{x:370,y:3318,z:0},direction:{x:0,y:-1},blockers:world.collisionBlockers};
 const result=stepMeleeState(createMeleeState(),{...args,targets:[make(id,point),make('enemy-behind',{x:370,y:3250,z:0})]});
 assert.ok(result.hits.some(h=>h.targetId===id));assert.ok(!result.hits.some(h=>h.targetId==='enemy-behind'));
});
test('a projectile stops at the real crate surface and converts that single cover contact into crate damage',()=>{
 assert.ok(readFileSync(new URL('../apps/hmh-reboot/src/main.mjs',import.meta.url),'utf8').includes('worldDesignSecretCoverHit({resolution,shot,tick})'));
 const projectile=createProjectileState({id:'shot-1',ownerId:'player',previous:{x:370,y:3330,z:30},current:{x:370,y:3240,z:30},damage:12,radius:2});
 const resolution=resolveProjectilePath({projectile,targets:[target],blockers:world.collisionBlockers});
 assert.equal(resolution.coverHit.blockerId,id);
 assert.equal(typeof secrets.worldDesignSecretCoverHit,'function');
 const hit=secrets.worldDesignSecretCoverHit({resolution,shot:{...projectile,weaponId:'coin-blaster',vx:0,vy:-600},tick:1});
 assert.equal(hit.targetId,id);assert.equal(hit.damage,12);assert.equal(hit.sourceId,'player');
 assert.equal(secrets.worldDesignSecretCoverHit({resolution:{...resolution,coverHit:{...resolution.coverHit,blockerId:'wall'}},shot:projectile,tick:1}),null);
 assert.equal(secrets.worldDesignSecretCoverHit({resolution:{...resolution,hits:[{targetId:id}]},shot:projectile,tick:1}),null,'no duplicate damage for an already resolved target contact');
});
test('a nearby grenade damages the destructible cover itself while the cover continues to shield a separate enemy',()=>{
 const grenade=createGrenadeState({id:'g1',spawnTick:0,detonateTick:90,mode:'hand',position:{x:370,y:3340,z:0},velocity:{x:0,y:0,z:0}});
 const behind=createHurtTarget({id:'behind',bodyShape:{type:'circle',radius:20},hurtShape:{type:'circle',radius:20},previousGround:{x:370,y:3240,z:0},currentGround:{x:370,y:3240,z:0},minZ:0,maxZ:40,health:60});
 const result=resolveGrenadeBlast({grenade,targets:[target,behind],blockers:world.collisionBlockers});
 assert.ok(result.hits.some(h=>h.targetId===id));assert.ok(!result.hits.some(h=>h.targetId==='behind'));
});
