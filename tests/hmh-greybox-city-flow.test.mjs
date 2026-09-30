import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';

const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
const inside=(bounds,p)=>p.x>=bounds.minX&&p.x<=bounds.maxX&&p.y>=bounds.minY&&p.y<=bounds.maxY;
const entrance=(world,roadId)=>world.sites.find(site=>site.areaId==='litecoin-city'&&site.kind==='entrance'&&site.roadId===roadId);
function authored(world){
  const area=world.areas.find(area=>area.id==='litecoin-city');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=6,'City needs public streets, two plaza entrances, a returnable service alley and a gantry approach');
  return area;
}
function routeClear(world,route){
  const body=createCollisionBody({id:'city-review-human',kind:'player',radius:24,minZ:0,maxZ:72});
  return route.points.slice(1).every((b,i)=>[[route.points[i],b],[b,route.points[i]]].every(([start,end])=>{
    const result=resolveSweptCircleMotion({body,start:{...start,z:world.queryGround(start.x,start.y).groundZ},delta:{x:end.x-start.x,y:end.y-start.y},blockers:world.collisionBlockers,bounds:{...world.bounds,visibleBoundaryId:'greybox-world-edge'},stopOnFirstContact:true});
    return result.contacts.length===0&&result.depenetrations.length===0&&close(result.position,end)&&resolveSweptTraversalPath({start,end,queryGround:world.queryGround}).allowed;
  }));
}
const publicRoute=(world,area,from,to)=>area.inspectionRoutes.find(route=>route.kind==='main'&&route.fromSiteId===entrance(world,from).id&&route.toSiteId===entrance(world,to).id);
const serviceRoute=(world,area)=>area.inspectionRoutes.find(route=>route.kind==='optional'&&route.fromSiteId===entrance(world,'coast-city').id&&route.toSiteId===entrance(world,'city-ridge').id);

test('City public streets join all four existing approaches at a clear civic junction',()=>{
  const world=createGreyboxWorld(),area=authored(world);
  const streets=[publicRoute(world,area,'coast-city','city-meadows'),publicRoute(world,area,'city-ridge','city-river')];
  assert.ok(streets.every(Boolean),'both cross-city streets connect opposite road entrances');
  for(const route of streets){assert.ok(route.points.some(point=>close(point,area.center)));assert.ok(routeClear(world,route));}
  const report=checkGreyboxWorld(world);
  assert.equal(report.passed,true,JSON.stringify(report.issues));
  assert.ok(report.localJourneys.filter(route=>route.areaId===area.id).every(route=>route.boundToSites&&route.actualSweepClear&&route.groundContinuous));
});

test('City maintenance access lies on a physically framed alley returning to a different street',()=>{
  const world=createGreyboxWorld(),area=authored(world),alley=serviceRoute(world,area);
  const secret=world.sites.find(site=>site.areaId===area.id&&site.kind==='secret');
  assert.ok(alley&&alley.points.some(point=>close(point,secret)),'maintenance access is on the returnable Coast-to-Ridge alley');
  assert.ok(routeClear(world,alley));
  const walls=world.pieces.filter(piece=>piece.visible.areaId===area.id&&piece.kind==='mass').map(piece=>piece.visible.bounds).filter(box=>secret.y>box.minY&&secret.y<box.maxY);
  const left=walls.filter(box=>box.maxX<secret.x).sort((a,b)=>b.maxX-a.maxX)[0],right=walls.filter(box=>box.minX>secret.x).sort((a,b)=>a.minX-b.minX)[0];
  assert.ok(left&&right,'actual buildings frame both sides of the alley');
  assert.ok(right.minX-left.maxX>=150&&right.minX-left.maxX<=400,'service lane reads narrower than the public streets without pinching the human capsule');
  assert.ok(secret.x-left.maxX>world.playerRadius&&right.minX-secret.x>world.playerRadius);
});

test('Closing Bell is staged at the exchange frontage with a visible approach through its plaza',()=>{
  const world=createGreyboxWorld(),area=authored(world);
  const exchange=world.pieces.find(piece=>piece.id==='litecoin-city-exchange');
  const objective=world.sites.find(site=>site.areaId===area.id&&site.kind==='objective');
  assert.ok(exchange?.blocker?.solid,'exchange frontage is a visible solid building');
  assert.equal(exchange.blocker.visibleAssetId,exchange.visible.id);
  const box=exchange.visible.bounds;
  assert.ok(objective.x>box.minX+world.playerRadius&&objective.x<box.maxX-world.playerRadius);
  assert.ok(box.minY-objective.y>=48&&box.minY-objective.y<=160,'bell is just outside the north-facing exchange frontage');
  assert.ok(objective.approach.y<objective.y&&Math.abs(objective.approach.x-objective.x)<1e-7);
  assert.ok(routeClear(world,{points:[objective.approach,objective]}));
  const arena=world.arenas.find(arena=>arena.areaId===area.id);
  assert.equal(arena.bossId,'liquidator');
  assert.ok(inside({minX:arena.center.x-arena.width/2,maxX:arena.center.x+arena.width/2,minY:arena.center.y-arena.depth/2,maxY:arena.center.y+arena.depth/2},objective));
  assert.ok(area.inspectionRoutes.some(route=>route.toSiteId===objective.id&&routeClear(world,route)));
});

test('closing the entire Liquidator forecourt leaves both public streets and the service alley open',()=>{
  const world=createGreyboxWorld(),area=authored(world),arena=world.arenas.find(arena=>arena.areaId===area.id);
  const entrances=area.inspectionRoutes.filter(route=>arena.exits.some(exit=>exit.id===route.toSiteId)&&world.sites.some(site=>site.id===route.fromSiteId&&site.kind==='entrance'));
  assert.equal(entrances.length,2,'separate street approaches bind to the two plaza gates');
  assert.equal(new Set(entrances.map(route=>route.fromSiteId)).size,2);
  assert.ok(entrances.every(route=>routeClear(world,route)));
  const gate=createGreyboxPiece({id:'review-closed-city-forecourt',kind:'mass',areaId:area.id,height:180,bounds:{minX:arena.center.x-arena.width/2,minY:arena.center.y-arena.depth/2,maxX:arena.center.x+arena.width/2,maxY:arena.center.y+arena.depth/2}});
  const closed={...world,pieces:[...world.pieces,gate],collisionBlockers:[...world.collisionBlockers,gate.blocker]};
  assert.ok(entrances.every(route=>!routeClear(closed,route)),'the test closure physically blocks both plaza approaches');
  for(const route of [publicRoute(world,area,'coast-city','city-meadows'),publicRoute(world,area,'city-ridge','city-river'),serviceRoute(world,area)])assert.ok(route&&routeClear(closed,route),'through traffic never depends on the boss space');
});

test('the City gantry is reached by a continuous visible ramp and a returnable elevated deck',()=>{
  const world=createGreyboxWorld(),area=authored(world),height=world.sites.find(site=>site.areaId===area.id&&site.kind==='height-option');
  const route=area.inspectionRoutes.find(route=>route.toSiteId===height.id);
  assert.ok(route&&routeClear(world,route));
  const deck=world.pieces.find(piece=>piece.visible.areaId===area.id&&piece.kind==='deck'&&inside(piece.visible.bounds,height));
  const ramp=world.pieces.find(piece=>piece.visible.areaId===area.id&&piece.kind==='ramp'&&route.points.some(point=>inside(piece.visible.bounds,point)));
  assert.ok(deck&&ramp,'the height route uses authored visible ramp/deck pieces');
  assert.equal(world.queryGround(route.points[0].x,route.points[0].y).groundZ,0);
  assert.equal(world.queryGround(height.x,height.y).groundZ,24);
  assert.equal(deck.visible.height,24);assert.equal(ramp.surface.toZ,24);
});

test('City local authoring keeps the official-run boundary and every regional road endpoint',()=>{
  const world=createGreyboxWorld();
  assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
  assert.deepEqual(world.spawn,{x:12500,y:6700});assert.equal(world.playerRadius,24);
  for(const [id,points]of Object.entries({'coast-city':[{x:3400,y:6700},{x:6600,y:6700}],'city-meadows':[{x:8400,y:6700},{x:11600,y:6700}],'city-river':[{x:7500,y:7600},{x:7500,y:10700}],'city-ridge':[{x:7500,y:5800},{x:7500,y:3400}]}))assert.deepEqual(world.roads.find(road=>road.id===id).points,points);
  assert.ok(world.sites.filter(site=>site.areaId==='litecoin-city').every(site=>site.runtimeEffect==='none'));
});
