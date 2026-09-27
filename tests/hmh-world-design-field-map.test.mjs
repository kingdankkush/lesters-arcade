import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldDesignFieldMap } from '../apps/hmh-reboot/src/world-design-field-map.mjs';
import { LEVEL_ONE_WORLD, createLevelOneRevealState, revealLevelOneAt, getLevelOneRevealSnapshot } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { OBJECTIVE_REWARDS, objectiveRewardPlacements } from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { createCollectibleState, stepCollectibles } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { createMissionState, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';
test('the pause field map shows discovered and completed machinery by state without exposing undiscovered places',()=>{
 // S1.4: nodes come from the mission's discovery (the simulated actor's
 // logical view), not from the explored cells.
 const site=WORLD_DESIGN_SITES[0],reveal=createLevelOneRevealState();revealLevelOneAt(reveal,site);
 const snapshot=getLevelOneRevealSnapshot(reveal),before=JSON.stringify(snapshot);
 const mission=createMissionState(1);
 stepMissionObjectives(mission,{tick:0,player:{x:site.x+500,y:site.y,groundZ:0},move:{x:1,y:0},queryGround:()=>({groundZ:0}),logicalView:{minX:site.x-220,maxX:site.x+1220,minY:site.y-450,maxY:site.y+450}});
 const discovered=buildWorldDesignFieldMap({world:LEVEL_ONE_WORLD,player:site,reveal:snapshot,mission});
 const seen=discovered.sites.find(s=>s.id===site.id);
 assert.deepEqual([seen.name,seen.objectiveClass,seen.state,seen.complete,seen.status],[site.name,'switch','ready',false,'task available']);
 mission.completed.set(site.id,3);
 const model=buildWorldDesignFieldMap({world:LEVEL_ONE_WORLD,player:site,reveal:snapshot,mission});
 assert.equal(model.sites.find(s=>s.id===site.id).complete,true);
 assert.equal(model.sites.some(s=>s.id==='yard-warehouse'),false);
 assert.equal(model.sites.some(s=>s.objectiveClass==='secret'),false);
 assert.ok(model.paths.length>5);assert.equal(model.cells.length,snapshot.revealedCellIds.length);
 assert.ok(model.player.x>=0&&model.player.x<=600);assert.ok(model.player.y>=0&&model.player.y<=240);
 assert.equal(JSON.stringify(snapshot),before,'map construction cannot mutate discovery');
 assert.deepEqual(model,buildWorldDesignFieldMap({world:LEVEL_ONE_WORLD,player:site,reveal:snapshot,mission}));
});

const supplies=()=>createCollectibleState({placements:Array.from({length:10},(_,i)=>({id:`base:${i}`,assetId:'bonus-life',x:100+i*50,y:100})),objectivePlacements:objectiveRewardPlacements()});
test('the field map lists every discovered haven and trap with its task, reward and live state',()=>{
 const reveal=createLevelOneRevealState();
 for(const r of OBJECTIVE_REWARDS) revealLevelOneAt(reveal,r);
 const snapshot=getLevelOneRevealSnapshot(reveal),collectibles=supplies();
 const model=at=>buildWorldDesignFieldMap({world:LEVEL_ONE_WORLD,player:{x:6000,y:2400},reveal:snapshot,mission:createMissionState(1),collectibles,tick:at});
 const names=model(1).objectives.map(o=>o.name);
 for(const name of ['Liquidity Haven','Litecoin Sanctuary','Scrypt Cache','Liquidation Trap']) assert.ok(names.includes(name),name);
 const trap=model(1).objectives.find(o=>o.id==='reward:mining-trap');
 assert.deepEqual([trap.reward,trap.state,trap.status],['Double Damage','discovered','locked']);
 assert.match(trap.task,/wait out the steam/);
 collectibles.unlockedObjectives.add('mining-valve');
 assert.equal(model(2).objectives.find(o=>o.id===trap.id).status,'reward available');
 stepCollectibles(collectibles,{tick:3,player:OBJECTIVE_REWARDS.find(r=>r.id===trap.id)});
 const cooling=model(4).objectives.find(o=>o.id===trap.id);
 assert.deepEqual([cooling.state,cooling.status],['cooldown','restocks in 180s']);
 assert.deepEqual(model(4),model(4),'construction is deterministic');
 const hidden=buildWorldDesignFieldMap({world:LEVEL_ONE_WORLD,player:{x:6000,y:2400},reveal:getLevelOneRevealSnapshot(createLevelOneRevealState()),mission:createMissionState(1),collectibles:supplies(),tick:1});
 assert.equal(hidden.objectives.length,0,'unexplored destinations stay off the map');
});
