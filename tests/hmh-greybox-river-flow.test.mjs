import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createGreyboxNavigator} from '../apps/hmh-reboot/src/dev/greybox-navigation.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {createAuthoredGroundQuery,resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
const local=(area,x,y)=>({x:area.center.x+x,y:area.center.y+y});
function authored(world){
  const area=world.areas.find(area=>area.id==='hashwood-river');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=7,'River needs two bank crossings, quiet regional trail, optional marquee, upper-bank return and physical objective/secret approaches');
  return area;
}
function routeClear(world,route){
  const body=createCollisionBody({id:'river-review-human',kind:'player',radius:24,minZ:0,maxZ:72});
  return route.points.slice(1).every((b,i)=>[[route.points[i],b],[b,route.points[i]]].every(([start,end])=>{
    const result=resolveSweptCircleMotion({body,start:{...start,z:world.queryGround(start.x,start.y).groundZ},delta:{x:end.x-start.x,y:end.y-start.y},blockers:world.collisionBlockers,bounds:{...world.bounds,visibleBoundaryId:'greybox-world-edge'},stopOnFirstContact:true});
    return result.contacts.length===0&&result.depenetrations.length===0&&close(result.position,end)&&resolveSweptTraversalPath({start,end,queryGround:world.queryGround}).allowed;
  }));
}
const routeNamed=(area,name)=>area.inspectionRoutes.find(route=>route.id===`${area.id}-${name}`);
function footprint(piece){
  const vertices=piece.visible.vertices;
  if(vertices)return Math.abs(vertices.reduce((sum,p,i)=>{const q=vertices[(i+1)%vertices.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
  const b=piece.visible.bounds;return(b.maxX-b.minX)*(b.maxY-b.minY);
}

test('River joins four neighbours with distinct upper crossings and a quiet lower-bank trail',()=>{
  const world=createGreyboxWorld(),area=authored(world);
  for(const name of ['city-bank-crossing','quiet-bank-trail','woods-bank-crossing','north-bank-return'])assert.ok(routeClear(world,routeNamed(area,name)),name);
  const city=routeNamed(area,'city-bank-crossing'),quiet=routeNamed(area,'quiet-bank-trail'),woods=routeNamed(area,'woods-bank-crossing');
  assert.equal(city.fromSiteId,`city-river-${area.id}-entrance`);assert.equal(city.toSiteId,`${area.id}-area`);
  assert.equal(quiet.fromSiteId,`bayou-river-${area.id}-entrance`);assert.equal(quiet.toSiteId,`river-pines-${area.id}-entrance`);
  assert.equal(woods.fromSiteId,`river-woods-${area.id}-entrance`);assert.equal(woods.toSiteId,quiet.toSiteId);
  const water=world.pieces.find(piece=>piece.id===`${area.id}-channel`),bridges=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='bridge');
  assert.ok(water?.visible.vertices?.length>=5);assert.ok(water.visible.bounds.maxX-water.visible.bounds.minX>4*(water.visible.bounds.maxY-water.visible.bounds.minY));
  assert.equal(bridges.length,2);assert.ok(Math.abs(bridges[0].visible.bounds.minX-bridges[1].visible.bounds.minX)>=1200);
});

test('closing the whole Baron clearing blocks its optional loop while all regional routes remain usable',()=>{
  const world=createGreyboxWorld(),area=authored(world),court=world.arenas.find(arena=>arena.areaId===area.id);
  const closure=createGreyboxPiece({id:'review-river-court-closure',kind:'mass',height:240,areaId:area.id,bounds:{minX:court.center.x-court.width/2,maxX:court.center.x+court.width/2,minY:court.center.y-court.depth/2,maxY:court.center.y+court.depth/2}});
  const closed={...world,collisionBlockers:[...world.collisionBlockers,closure.blocker]},optional=routeNamed(area,'marquee-clearing');
  assert.equal(optional.kind,'optional');assert.ok(routeClear(world,optional));assert.equal(routeClear(closed,optional),false);
  for(const name of ['city-bank-crossing','quiet-bank-trail','woods-bank-crossing','north-bank-return'])assert.ok(routeClear(closed,routeNamed(area,name)),name);
});

test('each River bridge is necessary and the intervening water does not hide a third crossing',()=>{
  const world=createGreyboxWorld(),area=authored(world),water=world.pieces.find(piece=>piece.id===`${area.id}-channel`);
  assert.ok(water?.surface?.deepWater);assert.equal(water.blocker,null);
  for(const[name,bridge]of [['city-bank-crossing','city-bridge'],['woods-bank-crossing','woods-bridge']]){
    const removed={...world,queryGround:createAuthoredGroundQuery({baseSurface:world.baseSurface,surfaces:world.surfaces.filter(surface=>surface.id!==`${area.id}-${bridge}`)})};
    assert.ok(routeClear(world,routeNamed(area,name)));assert.equal(routeClear(removed,routeNamed(area,name)),false);
  }
  assert.equal(world.queryGround(...Object.values(local(area,700,-450))).deepWater,true);
  assert.equal(routeClear(world,{points:[local(area,700,-1000),local(area,700,0)]}),false);
});

test('actual fixed-step navigation ascends and descends both y-axis bridges with dry return paths',()=>{
  const world=createGreyboxWorld(),area=authored(world),ramps=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='ramp');
  assert.equal(ramps.length,4);assert.ok(ramps.every(piece=>piece.surface.axis==='y'));
  for(const x of [0,1400])for(const offset of [-120,0,120])assert.ok(routeClear(world,{points:[local(area,x+offset,-950),local(area,x+offset,50)]}),'deck and both ramps retain three parallel body-safe paths');
  const navigator=createGreyboxNavigator(world);navigator.inspectArea(area.id);
  function walk(axis,target){let high=0,steps=0;while(Math.abs(navigator.view()[axis]-target)>4&&steps++<1000){const value=navigator.view();const next=navigator.step({x:axis==='x'?Math.sign(target-value.x):0,y:axis==='y'?Math.sign(target-value.y):0});high=Math.max(high,next.groundZ);assert.equal(next.contacts,0);assert.equal(world.queryGround(next.x,next.y).walkable,true);}assert.ok(steps<1000,'actual body reached its destination');return high;}
  for(const x of [area.center.x,area.center.x+1400]){walk('x',x);assert.equal(walk('y',area.center.y-1000),24);assert.equal(navigator.view().groundZ,0);assert.equal(walk('y',area.center.y+50),24);assert.equal(navigator.view().groundZ,0);}
  assert.equal(navigator.view().inspectionJumps,1);assert.equal(navigator.view().lastAction,'movement');assert.ok(navigator.view().tick>1000);
});

test('waterfall shelf and bridge equipment have usable inspection and return routes outside their solids',()=>{
  const world=createGreyboxWorld(),area=authored(world),secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret'),shelf=world.pieces.find(piece=>piece.id===`${area.id}-waterfall-shelf`),loop=routeNamed(area,'waterfall-nook');
  assert.ok(shelf?.blocker?.solid&&shelf.visible.vertices?.length>=5&&routeClear(world,loop));
  assert.ok(secret.y<shelf.visible.bounds.minY-48&&secret.x>shelf.visible.bounds.minX&&secret.x<shelf.visible.bounds.maxX);
  const index=loop.points.findIndex(point=>close(point,secret));assert.ok(index>0&&index<loop.points.length-1);assert.ok(!close(loop.points[index-1],loop.points[index+1]));
  assert.notEqual(loop.fromSiteId,loop.toSiteId);assert.ok(loop.points.some(point=>point.y<secret.y-200),'the nook has a separate upper return leg');
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective'),house=world.pieces.find(piece=>piece.id===`${area.id}-capstan-house`);
  assert.ok(house?.blocker?.solid&&routeClear(world,routeNamed(area,'river-equipment'))&&routeClear(world,{points:[objective.approach,objective]}));
  assert.ok(objective.y-house.visible.bounds.maxY>=48&&objective.y-house.visible.bounds.maxY<=180);assert.ok(objective.x>house.visible.bounds.minX&&objective.x<house.visible.bounds.maxX);
});

test('River replaces the generic footprint within the unchanged global layout budget and readable Baron court',()=>{
  const world=createGreyboxWorld(),area=authored(world),localPieces=world.pieces.filter(piece=>piece.visible.areaId===area.id);
  assert.ok(localPieces.filter(piece=>piece.blocker?.solid||piece.kind==='water').reduce((sum,piece)=>sum+footprint(piece),0)<=2060800,'gross water plus solid area must replace rather than accumulate template footprint');
  const report=checkGreyboxWorld(world);assert.equal(report.passed,true,JSON.stringify(report.issues));
  const court=world.arenas.find(arena=>arena.areaId===area.id),checked=report.arenas.find(arena=>arena.id===court.id);
  assert.equal(court.bossId,'rug-pull-baron');assert.equal(court.runtimeEffect,'none');assert.ok(checked.openFloorFraction>=.8&&checked.reachableExits);
  const height=world.sites.find(site=>site.areaId===area.id&&site.kind==='height-option');assert.equal(world.queryGround(height.x,height.y).kind,'bridge');assert.equal(world.queryGround(height.x,height.y).groundZ,24);
  for(const piece of localPieces.filter(piece=>piece.kind==='water')){assert.deepEqual(piece.surface.area.vertices,piece.visible.vertices);assert.equal(piece.surface.visibleTerrainId,piece.visible.id);}
});

test('River preserves four exact roads, fixed spawn and local-only authority without activating a Baron encounter',()=>{
  const world=createGreyboxWorld();assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  for(const[id,points]of [['city-river',[[7500,7600],[7500,10700]]],['bayou-river',[[3400,11600],[6600,11600]]],['river-pines',[[8400,11600],[11600,11600]]],['river-woods',[[9100,10650],[9700,10650],[10000,9200],[15000,9200],[15300,10650],[15900,10650]]]])assert.deepEqual(world.roads.find(road=>road.id===id).points,points.map(([x,y])=>({x,y})));
  assert.ok(world.sites.filter(site=>site.areaId==='hashwood-river').every(site=>site.runtimeEffect==='none'));
});
