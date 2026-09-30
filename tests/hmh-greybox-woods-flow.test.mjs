import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
function authored(world){
  const area=world.areas.find(area=>area.id==='rugpull-woods');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=7,'Woods needs a quiet four-way junction, optional camp court, lookout circuit, returning abandoned-supply track and physical objective frontage');
  return area;
}
function routeClear(world,route,radius=24){
  const body=createCollisionBody({id:'woods-review-human',kind:'player',radius,minZ:0,maxZ:72});
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

test('Woods joins its four existing approaches through a quiet trail beside the occupied camp',()=>{
  const world=createGreyboxWorld(),area=authored(world),quiet=routeNamed(area,'quiet-through'),camp=routeNamed(area,'camp-approach');
  assert.ok(quiet&&camp&&routeClear(world,quiet)&&routeClear(world,camp));
  assert.equal(quiet.fromSiteId,camp.fromSiteId);assert.equal(quiet.toSiteId,camp.toSiteId);
  for(const name of ['river-meadows-link','meadows-junction'])assert.ok(routeClear(world,routeNamed(area,name)));
  const linked=new Set(area.inspectionRoutes.flatMap(route=>[route.fromSiteId,route.toSiteId]));
  for(const road of ['farms-woods','meadows-woods','river-woods','pines-woods'])assert.ok(linked.has(`${road}-${area.id}-entrance`));
  assert.ok(routeClear(world,quiet,120),'quiet through-trail has a 240-unit collision-clear moving band');
});

test('closing the entire eastern camp court preserves the western regional through-trail',()=>{
  const world=createGreyboxWorld(),area=authored(world),quiet=routeNamed(area,'quiet-through'),camp=routeNamed(area,'camp-approach');
  assert.ok(routeClear(world,quiet)&&routeClear(world,camp));
  const court=world.arenas.find(arena=>arena.areaId===area.id);
  assert.ok(court.center.x>area.center.x+500);
  const closure=createGreyboxPiece({id:'review-woods-camp-closure',kind:'mass',areaId:area.id,height:240,bounds:{minX:court.center.x-court.width/2,maxX:court.center.x+court.width/2,minY:court.center.y-court.depth/2,maxY:court.center.y+court.depth/2}});
  const closed={...world,collisionBlockers:[...world.collisionBlockers,closure.blocker]};
  assert.equal(routeClear(closed,camp),false);assert.equal(routeClear(closed,quiet),true);
  assert.ok(routeClear(closed,routeNamed(area,'meadows-junction'))&&routeClear(closed,routeNamed(area,'river-meadows-link')));
});

test('occupied supplies, northern lookout and abandoned southern nook are distinct places with a returning side track',()=>{
  const world=createGreyboxWorld(),area=authored(world),secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret');
  const store=world.pieces.find(piece=>piece.id==='rugpull-woods-abandoned-store'),tent=world.pieces.find(piece=>piece.id==='rugpull-woods-supply-tent'),tower=world.pieces.find(piece=>piece.id==='rugpull-woods-lookout-post');
  const loop=routeNamed(area,'supply-return');
  assert.ok(store?.blocker?.solid&&tent?.blocker?.solid&&tower?.blocker?.solid&&loop&&routeClear(world,loop));
  assert.ok(tower.visible.bounds.maxY<area.center.y-1400&&store.visible.bounds.minY>area.center.y+1300&&tent.visible.bounds.minX>area.center.x+600);
  assert.ok(store.visible.bounds.minY-secret.y>=48&&store.visible.bounds.minY-secret.y<=180);
  assert.ok(secret.x>store.visible.bounds.minX&&secret.x<store.visible.bounds.maxX);
  assert.ok(loop.points.some(point=>close(point,secret)));assert.notEqual(loop.fromSiteId,loop.toSiteId);
});

test('the lookout has two ramp approaches and supplies have a usable frontage clear of their shelter',()=>{
  const world=createGreyboxWorld(),area=authored(world),height=world.sites.find(site=>site.areaId===area.id&&site.kind==='height-option');
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective'),tent=world.pieces.find(piece=>piece.id==='rugpull-woods-supply-tent');
  const lookout=routeNamed(area,'lookout-circuit'),access=routeNamed(area,'supplies-frontage');
  assert.ok(lookout&&access&&tent?.blocker?.solid&&routeClear(world,lookout)&&routeClear(world,access));
  assert.equal(world.queryGround(height.x,height.y).groundZ,24);assert.equal(world.queryGround(objective.x,objective.y).groundZ,0);
  assert.equal(world.queryGround(lookout.points[0].x,lookout.points[0].y).groundZ,0);assert.equal(world.queryGround(lookout.points.at(-1).x,lookout.points.at(-1).y).groundZ,0);
  assert.ok(lookout.points.some(p=>close(p,height)));
  const ramps=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='ramp');
  assert.equal(ramps.length,2);assert.ok(ramps.every(piece=>piece.visible.bounds.maxY-piece.visible.bounds.minY>=300));
  assert.ok(ramps.some(piece=>piece.visible.bounds.maxX<=height.x)&&ramps.some(piece=>piece.visible.bounds.minX>=height.x));
  assert.ok(objective.y-tent.visible.bounds.maxY>=48&&objective.y-tent.visible.bounds.maxY<=180);
  assert.ok(objective.x>tent.visible.bounds.minX&&objective.x<tent.visible.bounds.maxX);
  assert.ok(routeClear(world,{points:[objective.approach,objective]}));
});

test('shaped woodland banks frame the camps within the old footprint and unchanged global navigation gates',()=>{
  const world=createGreyboxWorld(),area=authored(world),local=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.blocker?.solid);
  const terrain=local.filter(piece=>piece.kind==='cliff'&&piece.visible.vertices?.length>=5);
  assert.ok(terrain.length>=3,'separate northwest roots, western woodland edge and southeast bank need authored silhouettes');
  assert.ok(terrain.some(piece=>piece.visible.bounds.maxX<area.center.x-1300)&&terrain.some(piece=>piece.visible.bounds.minX>area.center.x+1000));
  for(const piece of local){assert.equal(piece.blocker.visibleAssetId,piece.visible.id);if(piece.visible.vertices)assert.deepEqual(piece.blocker.shape.vertices,piece.visible.vertices);}
  assert.ok(local.reduce((sum,piece)=>sum+footprint(piece),0)<=2060800,'rearrange the template footprint instead of accumulating blocked area');
  assert.ok(routeClear(world,{points:[area.center,area.center]}));
  const report=checkGreyboxWorld(world);assert.equal(report.passed,true,JSON.stringify(report.issues));
  const court=world.arenas.find(arena=>arena.areaId===area.id),checked=report.arenas.find(arena=>arena.id===court.id);
  assert.equal(court.bossId,null);assert.equal(court.runtimeEffect,'none');assert.ok(checked.openFloorFraction>=.8&&checked.reachableExits);
});

test('Woods authoring preserves local-only authority and exact four-way road endpoints',()=>{
  const world=createGreyboxWorld();
  assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
  assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  assert.deepEqual(world.roads.find(road=>road.id==='farms-woods').points,[{x:17500,y:7600},{x:17500,y:10700}]);
  assert.deepEqual(world.roads.find(road=>road.id==='meadows-woods').points,[{x:14000,y:7650},{x:14700,y:7650},{x:15000,y:9000},{x:15300,y:10650},{x:16600,y:10650}]);
  assert.deepEqual(world.roads.find(road=>road.id==='river-woods').points,[{x:9100,y:10650},{x:9700,y:10650},{x:10000,y:9200},{x:15000,y:9200},{x:15300,y:10650},{x:15900,y:10650}]);
  assert.deepEqual(world.roads.find(road=>road.id==='pines-woods').points,[{x:13400,y:11600},{x:16600,y:11600}]);
  assert.ok(world.sites.filter(site=>site.areaId==='rugpull-woods').every(site=>site.runtimeEffect==='none'));
});
