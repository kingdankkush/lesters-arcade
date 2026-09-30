import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
function authored(world){
  const area=world.areas.find(area=>area.id==='hollow-pines');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=5,'Pines needs cemetery, outside service, crypt, tree and maintenance paths');
  return area;
}
function routeClear(world,route,radius=24){
  const body=createCollisionBody({id:'pines-review-human',kind:'player',radius,minZ:0,maxZ:72});
  return route.points.slice(1).every((b,i)=>[[route.points[i],b],[b,route.points[i]]].every(([start,end])=>{
    const result=resolveSweptCircleMotion({body,start:{...start,z:world.queryGround(start.x,start.y).groundZ},delta:{x:end.x-start.x,y:end.y-start.y},blockers:world.collisionBlockers,bounds:{...world.bounds,visibleBoundaryId:'greybox-world-edge'},stopOnFirstContact:true});
    return result.contacts.length===0&&result.depenetrations.length===0&&close(result.position,end)&&resolveSweptTraversalPath({start,end,queryGround:world.queryGround}).allowed;
  }));
}
const routeNamed=(area,suffix)=>area.inspectionRoutes.find(route=>route.id===`${area.id}-${suffix}`);
function footprint(piece){
  const vertices=piece.visible.vertices;
  if(vertices)return Math.abs(vertices.reduce((sum,p,i)=>{const q=vertices[(i+1)%vertices.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
  const b=piece.visible.bounds;return(b.maxX-b.minX)*(b.maxY-b.minY);
}

test('Pines has a clear cemetery walk and a physically separate southern maintenance path',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=routeNamed(area,'cemetery-walk'),service=routeNamed(area,'outer-service-path');
  assert.ok(main&&service&&routeClear(world,main)&&routeClear(world,service));
  assert.equal(main.fromSiteId,service.fromSiteId);assert.equal(main.toSiteId,service.toSiteId);
  assert.ok(main.points.some(p=>p.y<area.center.y-400)&&main.points.every(p=>p.y<=area.center.y));
  assert.ok(service.points.some(p=>p.y>area.center.y+950)&&service.points.every(p=>p.y>=area.center.y));
  assert.ok(routeClear(world,main,120),'both cemetery gates and the main path have a 240-unit collision-clear moving band');
});

test('closing the cemetery walk leaves the outside River-to-Woods service connection usable',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=routeNamed(area,'cemetery-walk'),service=routeNamed(area,'outer-service-path');
  assert.ok(main&&service&&routeClear(world,main)&&routeClear(world,service));
  const x=area.center.x,y=area.center.y-500;
  const closure=createGreyboxPiece({id:'review-pines-cemetery-closure',kind:'mass',areaId:area.id,height:128,bounds:{minX:x-150,maxX:x+150,minY:y-180,maxY:y+180}});
  const closed={...world,collisionBlockers:[...world.collisionBlockers,closure.blocker]};
  assert.equal(routeClear(closed,main),false);assert.equal(routeClear(closed,service),true);
});

test('the crypt secret sits beside a solid crypt and a returnable trail rejoins the dead-tree approach',()=>{
  const world=createGreyboxWorld(),area=authored(world),secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret');
  const crypt=world.pieces.find(piece=>piece.id==='hollow-pines-crypt'),loop=routeNamed(area,'crypt-loop'),treePath=routeNamed(area,'dead-tree-approach');
  assert.ok(crypt?.blocker?.solid&&loop&&treePath&&routeClear(world,loop)&&routeClear(world,treePath));
  assert.ok(secret.x-crypt.visible.bounds.maxX>=48&&secret.x-crypt.visible.bounds.maxX<=180);
  assert.ok(secret.y>crypt.visible.bounds.minY&&secret.y<crypt.visible.bounds.maxY);
  assert.ok(secret.x<area.center.x-1100&&loop.points.some(point=>close(point,secret)));
  assert.equal(loop.toSiteId,treePath.toSiteId);assert.notEqual(loop.fromSiteId,loop.toSiteId);
  const tree=world.pieces.find(piece=>piece.id==='hollow-pines-dead-tree-roots');
  assert.ok(tree?.visible.vertices&&tree.blocker.solid&&tree.visible.bounds.maxY<area.center.y-1000);
});

test('the maintenance house faces a two-sided raised bank with a clear objective approach',()=>{
  const world=createGreyboxWorld(),area=authored(world),height=world.sites.find(site=>site.areaId===area.id&&site.kind==='height-option');
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective'),house=world.pieces.find(piece=>piece.id==='hollow-pines-maintenance-house');
  const service=routeNamed(area,'outer-service-path'),access=routeNamed(area,'maintenance-approach');
  assert.ok(service&&access&&house?.blocker?.solid&&routeClear(world,service)&&routeClear(world,access));
  assert.equal(world.queryGround(height.x,height.y).groundZ,24);assert.equal(world.queryGround(objective.x,objective.y).groundZ,24);
  assert.equal(world.queryGround(service.points[0].x,service.points[0].y).groundZ,0);assert.equal(world.queryGround(service.points.at(-1).x,service.points.at(-1).y).groundZ,0);
  assert.ok(service.points.some(p=>close(p,height)));
  const ramps=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='ramp');
  assert.equal(ramps.length,2);assert.ok(ramps.every(piece=>piece.visible.bounds.maxY-piece.visible.bounds.minY>=300));
  assert.ok(ramps.some(piece=>piece.visible.bounds.maxX<=height.x)&&ramps.some(piece=>piece.visible.bounds.minX>=height.x));
  assert.ok(objective.y-house.visible.bounds.maxY>=48&&objective.y-house.visible.bounds.maxY<=160);
  assert.ok(objective.x>house.visible.bounds.minX&&objective.x<house.visible.bounds.maxX&&objective.approach.y>objective.y);
  assert.ok(routeClear(world,{points:[objective.approach,objective]}));
});

test('shaped groves and gated cemetery walls fit the old blocked footprint and retain all global navigation gates',()=>{
  const world=createGreyboxWorld(),area=authored(world),local=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.blocker?.solid);
  const groves=local.filter(piece=>piece.id.endsWith('-grove'));
  assert.equal(groves.length,2);assert.ok(groves.every(piece=>piece.visible.vertices?.length>=5));
  for(const piece of local){assert.equal(piece.blocker.visibleAssetId,piece.visible.id);if(piece.visible.vertices)assert.deepEqual(piece.blocker.shape.vertices,piece.visible.vertices);}
  assert.ok(local.reduce((sum,piece)=>sum+footprint(piece),0)<=2060800,'replace the old four corner masses/landmark/covers instead of accumulating blocked area');
  assert.ok(local.some(piece=>piece.id.endsWith('west-upper-wall'))&&local.some(piece=>piece.id.endsWith('east-lower-wall')));
  assert.ok(routeClear(world,{points:[area.center,area.center]}));
  const report=checkGreyboxWorld(world);assert.equal(report.passed,true,JSON.stringify(report.issues));
  const court=world.arenas.find(arena=>arena.areaId===area.id),checked=report.arenas.find(arena=>arena.id===court.id);
  assert.equal(court.bossId,null);assert.ok(checked.openFloorFraction>=.8&&checked.reachableExits);
});

test('Pines authoring preserves local-only authority and both existing regional roads',()=>{
  const world=createGreyboxWorld();
  assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
  assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  assert.deepEqual(world.roads.find(road=>road.id==='river-pines').points,[{x:8400,y:11600},{x:11600,y:11600}]);
  assert.deepEqual(world.roads.find(road=>road.id==='pines-woods').points,[{x:13400,y:11600},{x:16600,y:11600}]);
  assert.ok(world.sites.filter(site=>site.areaId==='hollow-pines').every(site=>site.runtimeEffect==='none'));
});
