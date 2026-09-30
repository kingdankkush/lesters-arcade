import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
function authored(world){
  const area=world.areas.find(area=>area.id==='fork-fortress');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=5,'Fortress needs gate approach, independent service loop, storage return, keep view and control-post access');
  return area;
}
function routeClear(world,route,radius=24){
  const body=createCollisionBody({id:'fortress-review-human',kind:'player',radius,minZ:0,maxZ:72});
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

test('Fortress connects Ridge and Meadows through its gate court and an independent lower service loop',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=routeNamed(area,'gate-court-approach'),service=routeNamed(area,'lower-service-loop');
  assert.ok(main&&service&&routeClear(world,main)&&routeClear(world,service));
  assert.equal(main.fromSiteId,service.fromSiteId);assert.equal(main.toSiteId,service.toSiteId);
  assert.ok(main.points.some(p=>p.y<area.center.y-300)&&service.points.some(p=>p.y>area.center.y+1000));
  assert.ok(routeClear(world,main,120),'the gatehouse and main court approach have a 240-unit collision-clear moving band');
});

test('closing the entire Foreman court leaves the lower regional service connection usable',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=routeNamed(area,'gate-court-approach'),service=routeNamed(area,'lower-service-loop');
  assert.ok(main&&service&&routeClear(world,main)&&routeClear(world,service));
  const court=world.arenas.find(arena=>arena.areaId===area.id);
  const closure=createGreyboxPiece({id:'review-fortress-court-closure',kind:'mass',areaId:area.id,height:240,bounds:{minX:court.center.x-court.width/2,maxX:court.center.x+court.width/2,minY:court.center.y-court.depth/2,maxY:court.center.y+court.depth/2}});
  const closed={...world,collisionBlockers:[...world.collisionBlockers,closure.blocker]};
  assert.equal(routeClear(closed,main),false);assert.equal(routeClear(closed,service),true);
});

test('the storage-side secret is tied to an actual store and returns to a different place on the service loop',()=>{
  const world=createGreyboxWorld(),area=authored(world),secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret');
  const store=world.pieces.find(piece=>piece.id==='fork-fortress-service-store'),loop=routeNamed(area,'storage-return');
  assert.ok(store?.blocker?.solid&&loop&&routeClear(world,loop));
  assert.ok(secret.x-store.visible.bounds.maxX>=48&&secret.x-store.visible.bounds.maxX<=180);
  assert.ok(secret.y>store.visible.bounds.minY&&secret.y<store.visible.bounds.maxY);
  assert.ok(secret.y>area.center.y+1300&&loop.points.some(point=>close(point,secret)));
  assert.notEqual(loop.fromSiteId,loop.toSiteId);assert.equal(loop.toSiteId,`${area.id}-height-option`);
});

test('a two-ended maintenance platform and practical gate controls have clear physical approaches',()=>{
  const world=createGreyboxWorld(),area=authored(world),height=world.sites.find(site=>site.areaId===area.id&&site.kind==='height-option');
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective'),gate=world.pieces.find(piece=>piece.id==='fork-fortress-north-gatehouse');
  const service=routeNamed(area,'lower-service-loop'),access=routeNamed(area,'gate-controls');
  assert.ok(service&&access&&gate?.blocker?.solid&&routeClear(world,service)&&routeClear(world,access));
  assert.equal(world.queryGround(height.x,height.y).groundZ,24);assert.equal(world.queryGround(objective.x,objective.y).groundZ,0);
  assert.equal(world.queryGround(service.points[0].x,service.points[0].y).groundZ,0);assert.equal(world.queryGround(service.points.at(-1).x,service.points.at(-1).y).groundZ,0);
  assert.ok(service.points.some(p=>close(p,height)));
  const ramps=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='ramp');
  assert.equal(ramps.length,2);assert.ok(ramps.every(piece=>piece.visible.bounds.maxY-piece.visible.bounds.minY>=300));
  assert.ok(ramps.some(piece=>piece.visible.bounds.maxX<=height.x)&&ramps.some(piece=>piece.visible.bounds.minX>=height.x));
  assert.ok(objective.x-gate.visible.bounds.maxX>=48&&objective.x-gate.visible.bounds.maxX<=160);
  assert.ok(objective.y>gate.visible.bounds.minY&&objective.y<gate.visible.bounds.maxY&&objective.approach.x>objective.x);
  assert.ok(routeClear(world,{points:[objective.approach,objective]}));
});

test('keep and curtain walls form a real compound within the old footprint and unchanged global navigation gates',()=>{
  const world=createGreyboxWorld(),area=authored(world),local=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.blocker?.solid);
  const keep=local.find(piece=>piece.id==='fork-fortress-keep'),view=routeNamed(area,'keep-view');
  assert.ok(keep?.visible.vertices?.length>=6&&view&&routeClear(world,view));
  assert.ok(keep.visible.bounds.maxY<area.center.y-1150);
  assert.ok(local.some(piece=>piece.id==='fork-fortress-west-curtain')&&local.some(piece=>piece.id==='fork-fortress-east-curtain'));
  for(const piece of local){assert.equal(piece.blocker.visibleAssetId,piece.visible.id);if(piece.visible.vertices)assert.deepEqual(piece.blocker.shape.vertices,piece.visible.vertices);}
  assert.ok(local.reduce((sum,piece)=>sum+footprint(piece),0)<=2060800,'rearrange the template footprint instead of accumulating new blocked area');
  assert.ok(routeClear(world,{points:[area.center,area.center]}));
  const report=checkGreyboxWorld(world);assert.equal(report.passed,true,JSON.stringify(report.issues));
  const court=world.arenas.find(arena=>arena.areaId===area.id),checked=report.arenas.find(arena=>arena.id===court.id);
  assert.equal(court.bossId,'51-percent-foreman');assert.equal(court.runtimeEffect,'none');assert.ok(checked.openFloorFraction>=.8&&checked.reachableExits);
});

test('Fortress authoring preserves local-only authority and its exact Ridge/Meadows road endpoints',()=>{
  const world=createGreyboxWorld();
  assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
  assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  assert.deepEqual(world.roads.find(road=>road.id==='ridge-fortress').points,[{x:8400,y:2500},{x:9600,y:1700},{x:10400,y:1700},{x:11600,y:2500}]);
  assert.deepEqual(world.roads.find(road=>road.id==='fortress-service').points,[{x:14000,y:3300},{x:15000,y:3300},{x:15000,y:4600},{x:14600,y:5200},{x:14600,y:5750},{x:14000,y:5750}]);
  assert.ok(world.sites.filter(site=>site.areaId==='fork-fortress').every(site=>site.runtimeEffect==='none'));
});
