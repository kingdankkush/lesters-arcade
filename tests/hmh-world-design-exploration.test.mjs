import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_SITES, WORLD_DESIGN_EXPLORATION_PATHS } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';
import { createEnemyNavGrid, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';

const queryGround=createLevelOneGroundQuery();
const body=createCollisionBody({id:'explorer',kind:'player',radius:24,minZ:0,maxZ:56});
function walk(a,b,label) {
  const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4);
  let current=a;
  for(let i=1;i<=steps;i++) {
    const target={x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps};
    const result=resolveSweptCircleMotion({body,start:{...current,z:queryGround(current.x,current.y).groundZ},delta:{x:target.x-current.x,y:target.y-current.y},blockers:world.collisionBlockers,bounds:world.bounds});
    assert.equal(result.contacts.length+result.depenetrations.length,0,`${label} at ${target.x.toFixed(0)},${target.y.toFixed(0)}: ${result.contacts[0]?.blockerId??result.depenetrations[0]?.blockerId}`);
    const traversal=resolveSweptTraversalPath({start:current,end:result.position,queryGround,maxSampleDistance:4});
    assert.ok(traversal.allowed,`${label}: ${traversal.reason}`);
    current=traversal.position;
  }
}
for(const path of WORLD_DESIGN_EXPLORATION_PATHS) test(`${path.id}: full path width and reverse travel clear physical blockers`,()=>{
  for(let i=1;i<path.points.length;i++) {
    const a=path.points[i-1], b=path.points[i], length=Math.hypot(b.x-a.x,b.y-a.y), nx=-(b.y-a.y)/length, ny=(b.x-a.x)/length;
    for(const offset of [0,-(path.width/2-24),path.width/2-24]) {
      const from={x:a.x+nx*offset,y:a.y+ny*offset},to={x:b.x+nx*offset,y:b.y+ny*offset};
      walk(from,to,`${path.id} segment ${i} offset ${offset}`);
      walk(to,from,`${path.id} return ${i} offset ${offset}`);
    }
  }
});
test('all six controls sit on reachable ground outside the protected opening and can be approached',()=>{
  const grid=createEnemyNavGrid({world,queryGround});
  for(const site of WORLD_DESIGN_SITES) {
    assert.equal(grid.isWalkableAt(site.x,site.y),true,site.id);
    const arena=world.encounterArenas.find(a=>a.id===site.arenaId);
    const field=computeEnemyFlowField({grid,targetX:site.x,targetY:site.y});
    assert.ok(field.distance[grid.cellAt(arena.anchor.x,arena.anchor.y)]>=0,`${site.id}: arena connectivity`);
    assert.ok(Math.hypot(site.x-world.player.spawn.x,site.y-world.player.spawn.y)>560,site.id);
  }
});
