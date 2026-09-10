import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_DESIGN_SECRETS,createWorldDesignSecretState,stepWorldDesignSecrets,worldDesignHiddenSecretProps,worldDesignSecretTargets } from '../apps/hmh-reboot/src/world-design-secrets.mjs';
import { LEVEL_ONE_WORLD as world,createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { createEnemyNavGrid,computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import {readFileSync} from 'node:fs';
const queryGround=createLevelOneGroundQuery();
test('the real runtime wires secret targets, damage resolution, collection, reset and hidden native props',()=>{
 const source=readFileSync(new URL('../apps/hmh-reboot/src/main.mjs',import.meta.url),'utf8');
 for(const fragment of ['...worldDesignSecretTargets(worldSecretState)','lastCombatResolution.targets[WORLD_DESIGN_SECRET_SEAL.id]','stepWorldDesignSecrets(worldSecretState','worldSecretState=createWorldDesignSecretState()','worldDesignHiddenSecretProps(worldSecretState)'])assert.ok(source.includes(fragment),fragment);
 assert.ok(world.collisionBlockers.some(b=>b.id==='farmstead-cache-seal'));
});
test('hidden supplies require destruction, reachable same-height contact and line of sight; each reward is once per run',()=>{
 const state=createWorldDesignSecretState(),s=WORLD_DESIGN_SECRETS[0],player={...s};
 assert.equal(stepWorldDesignSecrets(state,{tick:1,player,queryGround,lineClear:()=>true}).length,0);
 assert.ok(worldDesignHiddenSecretProps(state).has(`secret-prop:${s.id}`));
 const [target]=worldDesignSecretTargets(state);
 const result=resolveCombatHits({sessionSeed:1337,targets:[target],hits:[{id:'break',tick:2,targetId:target.id,sourceId:'player',weaponId:'satoshi-frag',damage:60,direction:{x:1,y:0}}]});
 state.sealHealth=result.targets[target.id].health;assert.equal(state.sealHealth,0);
 assert.equal(stepWorldDesignSecrets(state,{tick:3,player:{...player,groundZ:64},queryGround,lineClear:()=>true}).length,0);
 assert.equal(stepWorldDesignSecrets(state,{tick:4,player,queryGround,lineClear:()=>false}).length,0);
 assert.equal(stepWorldDesignSecrets(state,{tick:5,player,queryGround,lineClear:()=>true})[0].reward,'ammo');
 assert.equal(stepWorldDesignSecrets(state,{tick:6,player,queryGround,lineClear:()=>true}).length,0);
 assert.equal(createWorldDesignSecretState().collected.size,0);
});
test('all secrets sit on dry authored ground and have legal navigation from the main route after their gates open',()=>{
 const blockers=world.collisionBlockers.filter(b=>!['relay-supply-gate','yard-service-gate','farmstead-cache-seal'].includes(b.id));
 const grid=createEnemyNavGrid({world:{...world,collisionBlockers:blockers},queryGround});
 for(const s of WORLD_DESIGN_SECRETS){assert.equal(queryGround(s.x,s.y).walkable,true,s.id);assert.equal(queryGround(s.x,s.y).groundZ,s.groundZ,s.id);
  const field=computeEnemyFlowField({grid,targetX:s.x,targetY:s.y});assert.ok(field.distance[grid.cellAt(world.player.spawn.x,world.player.spawn.y)]>0,s.id);
 }
});
