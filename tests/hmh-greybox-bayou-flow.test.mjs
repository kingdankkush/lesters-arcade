import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {createAuthoredGroundQuery,resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
function authored(world){
  const area=world.areas.find(area=>area.id==='scrypt-bayou');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=5,'Bayou needs a lock-court crossing, independent northern crossing, returning stilt-store path and practical machinery approaches');
  return area;
}
function routeClear(world,route,radius=24){
  const body=createCollisionBody({id:'bayou-review-human',kind:'player',radius,minZ:0,maxZ:72});
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

test('Bayou joins Coast and River through two separate dry channel crossings',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=routeNamed(area,'lock-court-crossing'),bypass=routeNamed(area,'north-crossing');
  assert.ok(main&&bypass&&routeClear(world,main)&&routeClear(world,bypass));
  assert.equal(main.fromSiteId,`coast-bayou-${area.id}-entrance`);assert.equal(main.toSiteId,`bayou-river-${area.id}-entrance`);
  assert.equal(main.fromSiteId,bypass.fromSiteId);assert.equal(main.toSiteId,bypass.toSiteId);
  const bridges=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='bridge');assert.equal(bridges.length,2);
  assert.ok(Math.abs(bridges[0].visible.bounds.minY-bridges[1].visible.bounds.minY)>=1200);
  for(const bridge of bridges){
    const b=bridge.visible.bounds,y=(b.minY+b.maxY)/2;assert.ok(b.maxY-b.minY>=300&&b.maxY-b.minY<=600);
    for(const offset of [-120,0,120])assert.ok(routeClear(world,{points:[{x:b.minX-280,y:y+offset},{x:b.maxX+280,y:y+offset}]}),'each crossing has three real parallel dry paths across both ramps');
  }
});

test('closing the complete Lockkeeper court preserves the northern regional crossing',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=routeNamed(area,'lock-court-crossing'),bypass=routeNamed(area,'north-crossing');
  assert.ok(routeClear(world,main)&&routeClear(world,bypass));
  const court=world.arenas.find(arena=>arena.areaId===area.id);
  const closure=createGreyboxPiece({id:'review-bayou-court-closure',kind:'mass',areaId:area.id,height:240,bounds:{minX:court.center.x-court.width/2,maxX:court.center.x+court.width/2,minY:court.center.y-court.depth/2,maxY:court.center.y+court.depth/2}});
  const closed={...world,collisionBlockers:[...world.collisionBlockers,closure.blocker]};
  assert.equal(routeClear(closed,main),false);assert.equal(routeClear(closed,bypass),true);
});

test('both bridges are necessary to their paths and water between them cannot act as a hidden third crossing',()=>{
  const world=createGreyboxWorld(),area=authored(world),water=world.pieces.find(piece=>piece.id==='scrypt-bayou-channel');
  assert.ok(water?.surface?.deepWater&&water.visible.vertices?.length>=5);assert.equal(water.blocker,null);
  for(const[name,bridgeId]of [['lock-court-crossing','scrypt-bayou-lock-bridge'],['north-crossing','scrypt-bayou-north-bridge']]){
    const removed={...world,queryGround:createAuthoredGroundQuery({baseSurface:world.baseSurface,surfaces:world.surfaces.filter(surface=>surface.id!==bridgeId)})};
    assert.equal(routeClear(world,routeNamed(area,name)),true);assert.equal(routeClear(removed,routeNamed(area,name)),false);
  }
  const shore=area.center;assert.equal(world.queryGround(shore.x,shore.y).walkable,true);
  assert.equal(world.queryGround(shore.x+360,shore.y).deepWater,true);
  assert.equal(routeClear(world,{points:[shore,{x:shore.x+900,y:shore.y}]}),false);
});

test('the east-bank stilt-store nook returns to the lock bridge by a second dry route',()=>{
  const world=createGreyboxWorld(),area=authored(world),secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret');
  const store=world.pieces.find(piece=>piece.id==='scrypt-bayou-stilt-store'),loop=routeNamed(area,'stilt-store-return');
  assert.ok(store?.blocker?.solid&&loop&&routeClear(world,loop));assert.ok(secret.y>area.center.y+1200&&secret.x>area.center.x+800);
  assert.ok(store.visible.bounds.minX-secret.x>=48&&store.visible.bounds.minX-secret.x<=180);
  assert.ok(secret.y>store.visible.bounds.minY&&secret.y<store.visible.bounds.maxY);
  assert.ok(loop.points.some(point=>close(point,secret)));assert.notEqual(loop.fromSiteId,loop.toSiteId);assert.equal(loop.toSiteId,`${area.id}-height-option`);
});

test('lock machinery fronts the crossing and shaped channel replaces the template footprint within unchanged global gates',()=>{
  const world=createGreyboxWorld(),area=authored(world),local=world.pieces.filter(piece=>piece.visible.areaId===area.id);
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective'),house=local.find(piece=>piece.id==='scrypt-bayou-control-house'),height=world.sites.find(site=>site.areaId===area.id&&site.kind==='height-option');
  assert.ok(house?.blocker?.solid&&routeClear(world,routeNamed(area,'lock-controls'))&&routeClear(world,routeNamed(area,'wheel-view')));
  assert.ok(objective.y-house.visible.bounds.maxY>=48&&objective.y-house.visible.bounds.maxY<=180);
  assert.ok(objective.x>house.visible.bounds.minX&&objective.x<house.visible.bounds.maxX);assert.ok(routeClear(world,{points:[objective.approach,objective]}));
  assert.equal(world.queryGround(height.x,height.y).groundZ,24);assert.equal(world.queryGround(height.x,height.y).kind,'bridge');
  assert.equal(local.filter(piece=>piece.kind==='ramp').length,4);
  for(const piece of local.filter(piece=>piece.kind==='water')){assert.deepEqual(piece.surface.area.vertices,piece.visible.vertices);assert.equal(piece.surface.visibleTerrainId,piece.visible.id);}
  assert.ok(local.filter(piece=>piece.blocker?.solid||piece.kind==='water').reduce((sum,piece)=>sum+footprint(piece),0)<=2060800,'gross water plus solid area replaces the template; do not accumulate it');
  const report=checkGreyboxWorld(world);assert.equal(report.passed,true,JSON.stringify(report.issues));
  const court=world.arenas.find(arena=>arena.areaId===area.id),checked=report.arenas.find(arena=>arena.id===court.id);
  assert.equal(court.bossId,'lockkeeper');assert.equal(court.runtimeEffect,'none');assert.ok(checked.openFloorFraction>=.8&&checked.reachableExits);
});

test('Bayou water authoring preserves exact roads and local-only authority without activating the lock encounter',()=>{
  const world=createGreyboxWorld();assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
  assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  assert.deepEqual(world.roads.find(road=>road.id==='coast-bayou').points,[{x:2500,y:7600},{x:2500,y:10700}]);
  assert.deepEqual(world.roads.find(road=>road.id==='bayou-river').points,[{x:3400,y:11600},{x:6600,y:11600}]);
  assert.ok(world.sites.filter(site=>site.areaId==='scrypt-bayou').every(site=>site.runtimeEffect==='none'));
});
