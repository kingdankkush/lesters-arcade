import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
const inside=(box,p)=>p.x>box.minX&&p.x<box.maxX&&p.y>box.minY&&p.y<box.maxY;
const entrance=(world,roadId)=>world.sites.find(site=>site.areaId==='silver-coast'&&site.kind==='entrance'&&site.roadId===roadId);
function authored(world){
  const area=world.areas.find(area=>area.id==='silver-coast');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=5,'Coast needs distinct landward, shoreline, mansion, utility and overlook approaches');
  return area;
}
function routeClear(world,route){
  const body=createCollisionBody({id:'coast-review-human',kind:'player',radius:24,minZ:0,maxZ:72});
  return route.points.slice(1).every((b,i)=>[[route.points[i],b],[b,route.points[i]]].every(([start,end])=>{
    const result=resolveSweptCircleMotion({body,start:{...start,z:world.queryGround(start.x,start.y).groundZ},delta:{x:end.x-start.x,y:end.y-start.y},blockers:world.collisionBlockers,bounds:{...world.bounds,visibleBoundaryId:'greybox-world-edge'},stopOnFirstContact:true});
    return result.contacts.length===0&&result.depenetrations.length===0&&close(result.position,end)&&resolveSweptTraversalPath({start,end,queryGround:world.queryGround}).allowed;
  }));
}
function through(world,area,kind){
  const east=entrance(world,'coast-city'),south=entrance(world,'coast-bayou');
  return area.inspectionRoutes.find(route=>route.kind===kind&&route.fromSiteId===east.id&&route.toSiteId===south.id&&route.id.includes(kind==='main'?'landward':'shoreline'));
}

test('Coast connects City to Bayou by a landward route and a distinct cliff-led shoreline route',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=through(world,area,'main'),shore=through(world,area,'optional');
  assert.ok(main&&shore&&routeClear(world,main)&&routeClear(world,shore));
  assert.ok(Math.min(...shore.points.map(point=>point.x))+500<Math.min(...main.points.map(point=>point.x)),'shoreline route genuinely leaves the landward corridor');
  const cliffs=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='cliff');
  assert.ok(cliffs.length>=2,'separate headland and lower shore masses shape the coast');
  for(const cliff of cliffs){
    const vertices=cliff.visible.vertices;
    assert.ok(vertices?.some((p,i)=>p.x!==vertices[(i+1)%vertices.length].x&&p.y!==vertices[(i+1)%vertices.length].y),'coastal rock silhouettes have oblique edges');
    assert.equal(cliff.blocker.visibleAssetId,cliff.visible.id);
    assert.deepEqual(cliff.blocker.shape.vertices,vertices,'visible rock and collision use the same coast polygon');
  }
  const report=checkGreyboxWorld(world);
  assert.equal(report.passed,true,JSON.stringify(report.issues));
});

test('obstructing the scenic shore leaves the landward through-route usable',()=>{
  const world=createGreyboxWorld(),area=authored(world),main=through(world,area,'main'),shore=through(world,area,'optional');
  assert.ok(main&&shore&&routeClear(world,main)&&routeClear(world,shore));
  const point=shore.points.reduce((best,p)=>p.x<best.x?p:best);
  const rock=createGreyboxPiece({id:'review-coast-shore-closure',kind:'cliff',areaId:area.id,height:180,bounds:{minX:point.x-180,minY:point.y-180,maxX:point.x+180,maxY:point.y+180}});
  const closed={...world,collisionBlockers:[...world.collisionBlockers,rock.blocker]};
  assert.equal(routeClear(closed,shore),false,'the closure physically blocks the scenic route');
  assert.equal(routeClear(closed,main),true,'City-to-Bayou travel does not depend on the scenic detour');
});

test('the mansion secret is inside a real wall shell entered and exited through different faces',()=>{
  const world=createGreyboxWorld(),area=authored(world),secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret');
  const walls=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.id.includes('-mansion-')&&piece.blocker?.solid);
  assert.ok(walls.length>=4,'the mansion needs an actual wall shell rather than a point in an open field');
  const bounds={minX:Math.min(...walls.map(piece=>piece.visible.bounds.minX)),maxX:Math.max(...walls.map(piece=>piece.visible.bounds.maxX)),minY:Math.min(...walls.map(piece=>piece.visible.bounds.minY)),maxY:Math.max(...walls.map(piece=>piece.visible.bounds.maxY))};
  assert.ok(inside(bounds,secret));
  const route=area.inspectionRoutes.find(route=>route.kind==='optional'&&route.points.some(point=>close(point,secret)));
  assert.ok(route&&routeClear(world,route),'the interior secret belongs to a returnable path');
  const index=route.points.findIndex(point=>close(point,secret)),before=route.points[index-1],after=route.points[index+1];
  assert.ok(before&&after&&!inside(bounds,before)&&!inside(bounds,after));
  assert.ok(before.y>bounds.maxY&&after.x<bounds.minX,'enter via the roadside south face, exit through the sea-facing west face');
  assert.notEqual(route.fromSiteId,route.toSiteId);
});

test('the coastal utility objective sits just outside its real service face on dry ground',()=>{
  const world=createGreyboxWorld(),area=authored(world),utility=world.pieces.find(piece=>piece.id==='silver-coast-utility-house');
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective');
  assert.ok(utility?.blocker?.solid);
  const box=utility.visible.bounds;
  assert.ok(objective.y>box.minY+world.playerRadius&&objective.y<box.maxY-world.playerRadius);
  assert.ok(box.minX-objective.x>=48&&box.minX-objective.x<=160);
  assert.ok(objective.approach.x<objective.x&&Math.abs(objective.approach.y-objective.y)<1e-7);
  assert.equal(world.queryGround(objective.x,objective.y).groundZ,0);
  assert.ok(routeClear(world,{points:[objective.approach,objective]}));
  assert.ok(area.inspectionRoutes.some(route=>route.toSiteId===objective.id&&routeClear(world,route)));
});

test('the dry overlook has a returnable ramp and the lighthouse has a distinct solid silhouette',()=>{
  const world=createGreyboxWorld(),area=authored(world),height=world.sites.find(site=>site.areaId===area.id&&site.kind==='height-option');
  const route=area.inspectionRoutes.find(route=>route.toSiteId===height.id);
  assert.ok(route&&routeClear(world,route));
  assert.equal(world.queryGround(route.points[0].x,route.points[0].y).groundZ,0);
  assert.equal(world.queryGround(height.x,height.y).groundZ,24);
  assert.ok(world.pieces.some(piece=>piece.visible.areaId===area.id&&piece.kind==='deck'&&inside(piece.visible.bounds,height)));
  assert.ok(world.pieces.some(piece=>piece.visible.areaId===area.id&&piece.kind==='ramp'&&route.points.some(point=>point.x>=piece.visible.bounds.minX&&point.x<=piece.visible.bounds.maxX&&point.y>=piece.visible.bounds.minY&&point.y<=piece.visible.bounds.maxY)));
  const lighthouse=world.pieces.find(piece=>piece.id==='silver-coast-lighthouse');
  assert.ok(lighthouse?.blocker?.solid&&lighthouse.visible.vertices?.length>=6,'a faceted lighthouse distinguishes the headland from house walls');
  const view=world.sites.find(site=>site.areaId===area.id&&site.kind==='landmark-view');
  assert.ok(area.inspectionRoutes.some(route=>route.toSiteId===view.id&&routeClear(world,route)));
});

test('Coast authoring preserves local-only authority and the City/Bayou road endpoints',()=>{
  const world=createGreyboxWorld();
  assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
  assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  assert.deepEqual(world.roads.find(road=>road.id==='coast-city').points,[{x:3400,y:6700},{x:6600,y:6700}]);
  assert.deepEqual(world.roads.find(road=>road.id==='coast-bayou').points,[{x:2500,y:7600},{x:2500,y:10700}]);
  assert.ok(world.sites.filter(site=>site.areaId==='silver-coast').every(site=>site.runtimeEffect==='none'));
});
