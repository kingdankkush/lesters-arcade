import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldDesignFieldMap } from '../apps/hmh-reboot/src/world-design-field-map.mjs';
import { LEVEL_ONE_WORLD, createLevelOneRevealState, revealLevelOneAt, getLevelOneRevealSnapshot } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
test('the pause field map shows explored places and completed machinery without exposing undiscovered rewards',()=>{
 const site=WORLD_DESIGN_SITES[0],reveal=createLevelOneRevealState();revealLevelOneAt(reveal,site);
 const snapshot=getLevelOneRevealSnapshot(reveal),before=JSON.stringify(snapshot);
 const model=buildWorldDesignFieldMap({world:LEVEL_ONE_WORLD,player:site,reveal:snapshot,completed:new Map([[site.id,3]])});
 assert.equal(model.sites.find(s=>s.id===site.id).complete,true);
 assert.equal(model.sites.some(s=>s.id==='yard-warehouse'),false);
 assert.ok(model.paths.length>5);assert.equal(model.cells.length,snapshot.revealedCellIds.length);
 assert.ok(model.player.x>=0&&model.player.x<=600);assert.ok(model.player.y>=0&&model.player.y<=240);
 assert.equal(JSON.stringify(snapshot),before,'map construction cannot mutate discovery');
 assert.deepEqual(model,buildWorldDesignFieldMap({world:LEVEL_ONE_WORLD,player:site,reveal:snapshot,completed:new Map([[site.id,3]])}));
});
