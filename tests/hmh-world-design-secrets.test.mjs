import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_DESIGN_SECRETS } from '../apps/hmh-reboot/src/world-design-secrets.mjs';
import { createMissionState, stepMissionObjectives, missionHiddenSecretProps, missionSealTargets, applyMissionSealDamage } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { LEVEL_ONE_WORLD as world,createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { createEnemyNavGrid,computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import {readFileSync} from 'node:fs';
const queryGround=createLevelOneGroundQuery();
test('the real runtime wires secret targets, damage resolution, collection, reset and hidden native props',()=>{
 const source=readFileSync(new URL('../apps/hmh-reboot/src/main.mjs',import.meta.url),'utf8');
 for(const fragment of ['...missionSealTargets(missionState)','lastCombatResolution.targets[WORLD_DESIGN_SECRET_SEAL.id]','applyMissionSealDamage(missionState,','stepMissionObjectives(missionState,','missionState=createMissionState(payload.session.seed)','missionHiddenSecretProps(missionState)'])assert.ok(source.includes(fragment),fragment);
 assert.ok(world.collisionBlockers.some(b=>b.id==='farmstead-cache-seal'));
});
test('hidden supplies require destruction, reachable same-height contact and line of sight; each reward is once per run',()=>{
 const state=createMissionState(1),s=WORLD_DESIGN_SECRETS[0],player={...s};
 const step=(tick,who,lineClear=()=>true)=>stepMissionObjectives(state,{tick,player:who,move:{x:1,y:0},queryGround,lineClear}).events;
 assert.equal(step(1,player).length,0);
 assert.ok(missionHiddenSecretProps(state).has(`secret-prop:${s.id}`));
 const [target]=missionSealTargets(state);
 const result=resolveCombatHits({sessionSeed:1337,targets:[target],hits:[{id:'break',tick:2,targetId:target.id,sourceId:'player',weaponId:'satoshi-frag',damage:60,direction:{x:1,y:0}}]});
 assert.equal(result.targets[target.id].health,0);
 assert.equal(applyMissionSealDamage(state,{sealId:target.id,health:result.targets[target.id].health,tick:2}).length,1);
 assert.equal(step(3,{...player,groundZ:64}).length,0);
 assert.equal(step(4,player,()=>false).length,0);
 assert.deepEqual(step(5,player)[0].effects.find(effect=>effect.grant==='ammo'),{type:'grant',grant:'ammo'});
 assert.equal(step(6,player).length,0);
 assert.equal(createMissionState(1).completed.size,0);
});
test('all secrets sit on dry authored ground and have legal navigation from the main route after their gates open',()=>{
 // The logbook lies in the Dark Pool, behind its cracked container (S1.5).
 const blockers=world.collisionBlockers.filter(b=>!['relay-supply-gate','yard-service-gate','farmstead-cache-seal','dark-pool-container'].includes(b.id));
 const grid=createEnemyNavGrid({world:{...world,collisionBlockers:blockers},queryGround});
 for(const s of WORLD_DESIGN_SECRETS){assert.equal(queryGround(s.x,s.y).walkable,true,s.id);assert.equal(queryGround(s.x,s.y).groundZ,s.groundZ,s.id);
  const field=computeEnemyFlowField({grid,targetX:s.x,targetY:s.y});assert.ok(field.distance[grid.cellAt(world.player.spawn.x,world.player.spawn.y)]>0,s.id);
 }
});
