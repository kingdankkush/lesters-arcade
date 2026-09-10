import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createEnemyNavGrid, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { buildWorldDesignPlacements, WORLD_DESIGN_ASSETS } from '../apps/hmh-reboot/src/world-design-layout.mjs';
import { refreshWorldDesignGateNavigation } from '../apps/hmh-reboot/src/world-design-interactions.mjs';
import { WORLD_DESIGN_COURTS } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';

const grid = createEnemyNavGrid({ world, queryGround: createLevelOneGroundQuery() });
const node = id => world.routeGraph.nodes.find(n => n.id === id);
test('reservoir shortcut admits enemies at every authored node and connects through the local passage in both directions', () => {
  const points = ['reservoir-gap-north', 'reservoir-compound-gap', 'reservoir-gap-south'].map(node);
  for (const p of points) assert.equal(grid.isWalkableAt(p.x, p.y), true, p.id);
  for (const [a, b] of [[points[0], points[2]], [points[2], points[0]]]) {
    const field = computeEnemyFlowField({ grid, targetX: b.x, targetY: b.y });
    const steps = field.distance[grid.cellAt(a.x, a.y)];
    assert.ok(steps > 0 && steps <= 14, `local pursuit should not detour around the compound: ${steps}`);
  }
  assert.ok(world.routes.find(r => r.id === 'crossing-reservoir-cut-through').width >= 144);
});
test('reservoir vegetation render anchors follow the moved collision capsule', () => {
  const feature = world.blockers.find(b => b.id === 'hashwood-gate-thicket');
  const assets = new Map(Object.values(WORLD_DESIGN_ASSETS).map(id => [id, {}]));
  const kit = buildWorldDesignPlacements(world, assets);
  const tree = kit.placements.find(p => p.id === 'world-design:hashwood-gate-thicket:tree:0');
  assert.equal(tree.x, feature.shape.a.x);
  assert.equal(tree.y, feature.shape.a.y);
});
test('opening and resetting each gate produces the same local directed navigation as a complete rebuild', () => {
  const queryGround=createLevelOneGroundQuery();
  for(const court of WORLD_DESIGN_COURTS) {
    const id=`${court.id}-gate`, blockers=world.collisionBlockers.filter(b=>b.id!==id);
    const count=refreshWorldDesignGateNavigation(grid,world,queryGround,id,blockers);
    assert.ok(count < 200,'gate changes must not rebuild the whole world');
    const full=createEnemyNavGrid({world:{...world,collisionBlockers:blockers},queryGround});
    assert.deepEqual(grid.walkable,full.walkable);
    assert.deepEqual(grid.edges,full.edges);
    const field=computeEnemyFlowField({grid,targetX:court.x,targetY:court.y});
    assert.ok(field.distance[grid.cellAt(court.x,court.y+230)]>0,'gate gives a route into court');
    refreshWorldDesignGateNavigation(grid,world,queryGround,id,world.collisionBlockers);
  }
});
test('all four world edges are explained by visible solid barriers before the abstract bounds clamp',()=>{
  const body=createCollisionBody({id:'edge-probe',kind:'player',radius:24,minZ:0,maxZ:56});
  for(const [side,start,delta] of [['west',{x:150,y:2400},{x:-300,y:0}],['east',{x:11850,y:2400},{x:300,y:0}],['north',{x:7000,y:150},{x:0,y:-300}],['south',{x:7000,y:4650},{x:0,y:300}]]) {
    const id=`world-perimeter-${side}`,barrier=world.collisionBlockers.find(b=>b.id===id);
    assert.ok(world.visibleBarriers.some(v=>v.id===barrier.visibleAssetId));
    const collision=resolveSweptCircleMotion({body,start:{...start,z:0},delta,blockers:world.collisionBlockers,bounds:world.bounds});
    assert.ok(collision.contacts.some(c=>c.blockerId===id),side);
  }
});
test('the elevated overlooks retain directed return paths through their ramps',()=>{
  for(const [x,y,targetX,targetY] of [[3550,2150,2500,1500],[9550,2100,8700,1600]]) {
    const field=computeEnemyFlowField({grid,targetX,targetY});
    assert.ok(field.distance[grid.cellAt(x,y)]>0,`${x},${y} must have a legal route back to the ascent`);
  }
});
