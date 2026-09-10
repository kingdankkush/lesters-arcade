import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { createWorldDesignState, stepWorldDesign, worldDesignHazardPhase, worldDesignActiveBlockers, buildWorldDesignHazardHits } from '../apps/hmh-reboot/src/world-design-interactions.mjs';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createEnemyNavGrid } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { refreshWorldDesignGateNavigation } from '../apps/hmh-reboot/src/world-design-interactions.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';

const hold = (state, site, start = 0) => {
  const events = [];
  for(let tick=start; tick<start+site.holdTicks; tick++) events.push(...stepWorldDesign(state,{tick, player:{...site,vx:0,vy:0,groundZ:0}, queryGround:()=>({groundZ:0}), lineBlocked:()=>false}).events);
  return events;
};
test('each world interaction completes exactly once through fixed ticks with repeatable results', () => {
  for(const site of WORLD_DESIGN_SITES) {
    const a=createWorldDesignState(), b=createWorldDesignState();
    assert.deepEqual(hold(a,site),hold(b,site));
    assert.equal(a.completed.has(site.id),true);
    assert.equal(hold(a,site,site.holdTicks).length,0);
  }
});
test('walls, elevation and distance prevent activation; progress then belongs to machinery', () => {
  const site=WORLD_DESIGN_SITES[0];
  for(const [player,blocked] of [[site,true],[{...site,groundZ:64},false],[{x:site.x+300,y:site.y},false]]) {
    const state=createWorldDesignState();
    stepWorldDesign(state,{tick:0,player,queryGround:()=>({groundZ:0}),lineBlocked:()=>blocked});
    assert.equal(state.activating.size,0);
  }
  const state=createWorldDesignState();
  const step=tick=>stepWorldDesign(state,{tick,player:site,queryGround:()=>({groundZ:0}),lineBlocked:()=>false});
  step(0);assert.equal(state.progress,1);
  step(site.holdTicks-1);assert.ok(state.completed.has(site.id));
  assert.throws(()=>step(site.holdTicks-1),/monotonic/);
});
test('opened gates remove only their own blocker and reset with a new session', () => {
  const site=WORLD_DESIGN_SITES[0], state=createWorldDesignState();
  const blockers=[{id:site.gateId},{id:'other-wall'}];
  assert.equal(worldDesignActiveBlockers(state,blockers).length,2);
  hold(state,site);
  assert.deepEqual(worldDesignActiveBlockers(state,blockers),[blockers[1]]);
  assert.equal(worldDesignActiveBlockers(createWorldDesignState(),blockers).length,2);
});
test('steam warns before becoming dangerous, ends and cannot be farmed by repeating the valve', () => {
  const site=WORLD_DESIGN_SITES.find(s=>s.kind==='vent'), state=createWorldDesignState();
  hold(state,site);
  const complete=site.holdTicks-1;
  assert.equal(worldDesignHazardPhase(state,site,complete).phase,'warning');
  assert.equal(worldDesignHazardPhase(state,site,complete+site.hazard.warningTicks-1).phase,'warning');
  assert.equal(worldDesignHazardPhase(state,site,complete+site.hazard.warningTicks).phase,'active');
  assert.equal(worldDesignHazardPhase(state,site,complete+site.hazard.warningTicks+site.hazard.durationTicks).phase,'spent');
});
test('steam uses real combat resolution, respects walls and height, and retains environmental attribution',()=>{
  const site=WORLD_DESIGN_SITES.find(s=>s.kind==='vent'),state=createWorldDesignState();hold(state,site);
  const target={id:'enemy',x:site.hazard.x,y:site.hazard.y,groundZ:0};
  const args={tick:180,targets:[target],queryGround:()=>({groundZ:0})};
  const hits=buildWorldDesignHazardHits(state,args);
  const result=resolveCombatHits({sessionSeed:7,hits,targets:[{id:'enemy',health:4,maxHealth:20,armor:1,shieldCharges:0}]});
  assert.equal(result.targets.enemy.health,0);
  assert.equal(result.scoreEvents[0].weaponId,'world-steam');
  assert.notEqual(result.scoreEvents[0].sourceId,'player');
  assert.equal(buildWorldDesignHazardHits(state,{...args,lineClear:()=>false}).length,0);
  assert.equal(buildWorldDesignHazardHits(state,{...args,targets:[{...target,groundZ:64}]}).length,0);
  assert.equal(buildWorldDesignHazardHits(state,{...args,tick:181}).length,0);
});


test('the exact runtime restart loop recloses previously opened gate navigation', () => {
  const queryGround = createLevelOneGroundQuery();
  const navGrid = createEnemyNavGrid({world: LEVEL_ONE_WORLD, queryGround});
  const arrays = grid => Object.fromEntries(Object.entries(grid).filter(([,v]) => ArrayBuffer.isView(v)).map(([k,v]) => [k,Array.from(v)]));
  const closed = arrays(navGrid);
  const state = createWorldDesignState();
  for (const site of WORLD_DESIGN_SITES) hold(state,site,state.lastTick+1);
  assert.ok(state.openGates.size > 0);
  const active = worldDesignActiveBlockers(state,LEVEL_ONE_WORLD.collisionBlockers);
  for (const gateId of state.openGates) refreshWorldDesignGateNavigation(navGrid,LEVEL_ONE_WORLD,queryGround,gateId,active);
  assert.notDeepEqual(arrays(navGrid),closed,'opening actual gates must change navigation');
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs',import.meta.url),'utf8');
  const restart = source.match(/for\(const gateId of worldDesignState\.openGates\)[^\n]+\n\s*WORLD_BLOCKERS=[^\n]+\n\s*worldDesignState=[^\n]+;/)?.[0];
  assert.ok(restart,'inspect the actual runtime reset, not a copied implementation');
  const context = {worldDesignState:state,navGrid,LEVEL_ONE_WORLD,queryGround,refreshWorldDesignGateNavigation,createWorldDesignState};
  runInNewContext(restart,context);
  assert.deepEqual(arrays(navGrid),closed);
  assert.equal(context.worldDesignState.openGates.size,0);
  assert.equal(context.WORLD_BLOCKERS,LEVEL_ONE_WORLD.collisionBlockers);
});
