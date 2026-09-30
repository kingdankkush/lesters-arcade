import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const farm=world=>world.areas.find(area=>area.id==='halving-farms');
const entrance=(world,roadId)=>world.sites.find(site=>site.areaId==='halving-farms'&&site.kind==='entrance'&&site.roadId===roadId);
const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
function routeClear(world,route){
  const body=createCollisionBody({id:'farm-review-human',kind:'player',radius:24,minZ:0,maxZ:72});
  return route.points.slice(1).every((b,i)=>{
    const a=route.points[i];
    return [[a,b],[b,a]].every(([start,end])=>{
      const result=resolveSweptCircleMotion({body,start:{...start,z:world.queryGround(start.x,start.y).groundZ},delta:{x:end.x-start.x,y:end.y-start.y},blockers:world.collisionBlockers,bounds:{...world.bounds,visibleBoundaryId:'greybox-world-edge'},stopOnFirstContact:true});
      return result.contacts.length===0&&result.depenetrations.length===0&&close(result.position,end)&&resolveSweptTraversalPath({start,end,queryGround:world.queryGround}).allowed;
    });
  });
}
function authored(world){
  const area=farm(world);
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=4,'Farms needs distinct authored yard, barn, field and height approaches');
  return area;
}

test('Farms has an entrance-to-entrance field route through its secret and an independent yard approach',()=>{
  const world=createGreyboxWorld(),area=authored(world),west=entrance(world,'meadows-farms'),south=entrance(world,'farms-woods');
  const secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret');
  const bypass=area.inspectionRoutes.find(route=>route.kind==='optional'&&route.fromSiteId===west.id&&route.toSiteId===south.id);
  assert.ok(bypass,'field route joins the existing two entrances');
  assert.ok(bypass.points.some(point=>close(point,secret)),'the storage nook lies on the returnable field route');
  const yard=area.inspectionRoutes.find(route=>route.kind==='main'&&route.fromSiteId===west.id);
  assert.ok(yard&&yard.toSiteId!==south.id,'main approach enters a different place from the field bypass');
  assert.ok(routeClear(world,bypass)&&routeClear(world,yard));
  const report=checkGreyboxWorld(world);
  assert.equal(report.passed,true,JSON.stringify(report.issues));
  assert.ok(report.localJourneys.filter(route=>route.areaId===area.id).every(route=>route.boundToSites&&route.actualSweepClear&&route.groundContinuous));
});

test('the barn objective is at an actual solid barn frontage with a clear approach and human stand-off',()=>{
  const world=createGreyboxWorld(),area=authored(world);
  const barn=world.pieces.find(piece=>piece.id==='halving-farms-barn');
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective');
  assert.ok(barn?.blocker?.solid,'the barn is a visible physical volume');
  assert.equal(barn.blocker.visibleAssetId,barn.visible.id);
  const bounds=barn.visible.bounds;
  assert.ok(objective.x>bounds.minX+world.playerRadius&&objective.x<bounds.maxX-world.playerRadius);
  assert.ok(objective.y-bounds.maxY>=48&&objective.y-bounds.maxY<=160,'objective is just outside the south wall, not floating in a field');
  assert.ok(objective.approach.y>objective.y&&Math.abs(objective.approach.x-objective.x)<1e-7);
  assert.ok(routeClear(world,{points:[objective.approach,objective]}));
  const route=area.inspectionRoutes.find(route=>route.toSiteId===objective.id);
  assert.ok(route&&routeClear(world,route));
});

test('closing the barn approach does not block the separate field route between the two entrances',()=>{
  const original=createGreyboxWorld(),area=authored(original),west=entrance(original,'meadows-farms'),south=entrance(original,'farms-woods');
  const objective=original.sites.find(site=>site.areaId===area.id&&site.kind==='objective');
  const barnRoute=area.inspectionRoutes.find(route=>route.toSiteId===objective.id);
  const bypass=area.inspectionRoutes.find(route=>route.kind==='optional'&&route.fromSiteId===west.id&&route.toSiteId===south.id);
  assert.ok(barnRoute&&bypass);
  assert.ok(routeClear(original,barnRoute)&&routeClear(original,bypass),'both control routes are physically clear');
  const gate=createGreyboxPiece({id:'review-closed-barn-apron',kind:'mass',areaId:area.id,height:180,bounds:{minX:objective.x-180,minY:objective.y-80,maxX:objective.x+180,maxY:objective.y+120}});
  const closed={...original,pieces:[...original.pieces,gate],collisionBlockers:[...original.collisionBlockers,gate.blocker]};
  assert.equal(routeClear(closed,barnRoute),false,'a real obstruction blocks the objective approach');
  assert.equal(routeClear(closed,bypass),true,'the through-route is independent of the blocked objective');
});

test('the Farms preview preserves official-run isolation and the existing road endpoints',()=>{
  const world=createGreyboxWorld();
  assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
  assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  assert.deepEqual(world.roads.find(road=>road.id==='meadows-farms').points,[{x:13400,y:6700},{x:16600,y:6700}]);
  assert.deepEqual(world.roads.find(road=>road.id==='farms-woods').points,[{x:17500,y:7600},{x:17500,y:10700}]);
  assert.ok(world.sites.filter(site=>site.areaId==='halving-farms').every(site=>site.runtimeEffect==='none'));
});
