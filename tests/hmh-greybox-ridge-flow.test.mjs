import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
function authored(world){
  const area=world.areas.find(area=>area.id==='ledger-ridge');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=4,'Ridge needs the quarry switchback, lower service bypass, store loop and uplink approach');
  return area;
}
function routeClear(world,route,radius=24){
  const body=createCollisionBody({id:'ridge-review-human',kind:'player',radius,minZ:0,maxZ:72});
  return route.points.slice(1).every((b,i)=>[[route.points[i],b],[b,route.points[i]]].every(([start,end])=>{
    const result=resolveSweptCircleMotion({body,start:{...start,z:world.queryGround(start.x,start.y).groundZ},delta:{x:end.x-start.x,y:end.y-start.y},blockers:world.collisionBlockers,bounds:{...world.bounds,visibleBoundaryId:'greybox-world-edge'},stopOnFirstContact:true});
    return result.contacts.length===0&&result.depenetrations.length===0&&close(result.position,end)&&resolveSweptTraversalPath({start,end,queryGround:world.queryGround}).allowed;
  }));
}
const routeNamed=(area,suffix)=>area.inspectionRoutes.find(route=>route.id===`${area.id}-${suffix}`);

test('Ridge offers a physically clear quarry switchback and a separate lower service route',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=routeNamed(area,'quarry-switchback'),bypass=routeNamed(area,'lower-service-bypass');
  assert.ok(main&&bypass&&routeClear(world,main)&&routeClear(world,bypass));
  assert.equal(main.fromSiteId,bypass.fromSiteId);assert.equal(main.toSiteId,bypass.toSiteId);
  assert.ok(Math.min(...main.points.map(p=>p.x))<area.center.x-850&&Math.min(...main.points.map(p=>p.y))<area.center.y-700);
  assert.ok(bypass.points.every(p=>p.x>=area.center.x&&p.y>=area.center.y),'lower service traffic stays out of the upper quarry cut');
  assert.ok(routeClear(world,main,150),'the declared main centre path has a 300-unit collision-clear moving band');
});

test('a blocked quarry switchback does not remove the lower City-to-Fortress connection',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=routeNamed(area,'quarry-switchback'),bypass=routeNamed(area,'lower-service-bypass');
  assert.ok(main&&bypass&&routeClear(world,main)&&routeClear(world,bypass));
  const x=area.center.x-950,y=area.center.y;
  const closure=createGreyboxPiece({id:'review-ridge-switchback-closure',kind:'cliff',areaId:area.id,height:180,bounds:{minX:x-320,maxX:x+320,minY:y-150,maxY:y+150}});
  const closed={...world,collisionBlockers:[...world.collisionBlockers,closure.blocker]};
  assert.equal(routeClear(closed,main),false);assert.equal(routeClear(closed,bypass),true);
});

test('the tucked quarry store has an actual building face and a returnable side loop',()=>{
  const world=createGreyboxWorld(),area=authored(world),secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret');
  const store=world.pieces.find(piece=>piece.id==='ledger-ridge-quarry-store'),loop=routeNamed(area,'store-loop');
  assert.ok(store?.blocker?.solid&&loop&&routeClear(world,loop));
  assert.ok(secret.x>store.visible.bounds.minX&&secret.x<store.visible.bounds.maxX);
  assert.ok(secret.y-store.visible.bounds.maxY>=48&&secret.y-store.visible.bounds.maxY<=180);
  assert.ok(secret.x<area.center.x-1200&&loop.points.some(point=>close(point,secret)));
  assert.notEqual(loop.fromSiteId,loop.toSiteId,'the store detour rejoins the upper route');
});

test('the uplink sits on a two-sided ramped shelf with a clear equipment-facing approach',()=>{
  const world=createGreyboxWorld(),area=authored(world),height=world.sites.find(site=>site.areaId===area.id&&site.kind==='height-option');
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective'),equipment=world.pieces.find(piece=>piece.id==='ledger-ridge-headframe');
  const main=routeNamed(area,'quarry-switchback'),access=routeNamed(area,'uplink-approach');
  assert.ok(main&&access&&equipment?.blocker?.solid&&routeClear(world,main)&&routeClear(world,access));
  assert.equal(world.queryGround(height.x,height.y).groundZ,24);
  assert.equal(world.queryGround(objective.x,objective.y).groundZ,24);
  assert.equal(world.queryGround(main.points[0].x,main.points[0].y).groundZ,0);
  assert.equal(world.queryGround(main.points.at(-1).x,main.points.at(-1).y).groundZ,0);
  assert.ok(main.points.some(p=>close(p,height)));
  const ramps=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='ramp');
  assert.equal(ramps.length,2);assert.ok(ramps.every(piece=>piece.visible.bounds.maxY-piece.visible.bounds.minY>=300));
  assert.ok(ramps.some(piece=>piece.visible.bounds.maxX<=height.x)&&ramps.some(piece=>piece.visible.bounds.minX>=height.x));
  assert.ok(objective.y-equipment.visible.bounds.maxY>=48&&objective.y-equipment.visible.bounds.maxY<=160);
  assert.ok(objective.x>equipment.visible.bounds.minX&&objective.x<equipment.visible.bounds.maxX&&objective.approach.y>objective.y);
  assert.ok(routeClear(world,{points:[objective.approach,objective]}));
});

test('quarry rock fingers visibly frame the clear inspection junction and an open working landing',()=>{
  const world=createGreyboxWorld(),area=authored(world),cliffs=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='cliff');
  assert.ok(cliffs.length>=4);
  for(const cliff of cliffs){assert.equal(cliff.blocker.visibleAssetId,cliff.visible.id);if(cliff.visible.vertices)assert.deepEqual(cliff.blocker.shape.vertices,cliff.visible.vertices);}
  assert.ok(cliffs.filter(cliff=>cliff.visible.vertices?.some((p,i)=>p.x!==cliff.visible.vertices[(i+1)%cliff.visible.vertices.length].x&&p.y!==cliff.visible.vertices[(i+1)%cliff.visible.vertices.length].y)).length>=3);
  assert.ok(routeClear(world,{points:[area.center,area.center]}));
  assert.ok(cliffs.filter(piece=>piece.visible.bounds.minX<area.center.x&&piece.visible.bounds.maxX>area.center.x&&Math.min(Math.abs(piece.visible.bounds.minY-area.center.y),Math.abs(piece.visible.bounds.maxY-area.center.y))<=220).length>=2,'nearby rock faces give the junction visible north and south edges');
  const report=checkGreyboxWorld(world);assert.equal(report.passed,true,JSON.stringify(report.issues));
  const court=world.arenas.find(arena=>arena.areaId===area.id),checked=report.arenas.find(arena=>arena.id===court.id);
  assert.equal(court.bossId,null);assert.ok(checked.openFloorFraction>=.8&&checked.reachableExits);
});

test('Ridge authoring preserves local-only authority and both existing regional roads',()=>{
  const world=createGreyboxWorld();
  assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
  assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  assert.deepEqual(world.roads.find(road=>road.id==='city-ridge').points,[{x:7500,y:5800},{x:7500,y:3400}]);
  assert.deepEqual(world.roads.find(road=>road.id==='ridge-fortress').points,[{x:8400,y:2500},{x:9600,y:1700},{x:10400,y:1700},{x:11600,y:2500}]);
  assert.ok(world.sites.filter(site=>site.areaId==='ledger-ridge').every(site=>site.runtimeEffect==='none'));
});
