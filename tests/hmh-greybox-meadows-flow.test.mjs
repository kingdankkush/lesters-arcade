import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {checkGreyboxWorld} from '../scripts/lib/hmh-greybox-world-check.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';

const mutable=()=>{const world=createGreyboxWorld();return{...world,areas:structuredClone(world.areas),sites:structuredClone(world.sites),arenas:structuredClone(world.arenas),pieces:[...world.pieces],collisionBlockers:[...world.collisionBlockers]};};
function witnessRoute(world){
  const area=world.areas.find(area=>area.id==='mweb-meadows');
  const from=world.sites.find(site=>site.kind==='entrance'&&site.areaId===area.id&&site.roadId==='city-meadows');
  // This independent witness stays clear in both the bare and Meadows kits.
  // It is not inferred from the path checker being tested.
  const to={id:'review-meadows-route-end',kind:'review-site',areaId:area.id,x:from.x,y:from.y-400,runtimeEffect:'none'};
  world.sites.push(to);
  const route={id:'review-garden-approach',kind:'optional',fromSiteId:from.id,toSiteId:to.id,points:[{x:from.x,y:from.y},{x:to.x,y:to.y}],runtimeEffect:'none'};
  area.inspectionRoutes=[route];return{area,route};
}
function barrier(world,a,b){
  const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  const piece=createGreyboxPiece({id:'review-physical-fence',kind:'mass',height:180,bounds:{minX:x-70,minY:y-70,maxX:x+70,maxY:y+70},areaId:'mweb-meadows'});
  world.pieces.push(piece);world.collisionBlockers.push(piece.blocker);return piece;
}
const sweep=(world,a,b)=>resolveSweptCircleMotion({body:createCollisionBody({id:'review-human',kind:'player',radius:24,minZ:0,maxZ:72}),start:{...a,z:world.queryGround(a.x,a.y).groundZ},delta:{x:b.x-a.x,y:b.y-a.y},blockers:world.collisionBlockers,bounds:{...world.bounds,visibleBoundaryId:'greybox-world-edge'},stopOnFirstContact:true});

test('Meadows has an authored main approach and an optional loop that actually rejoins declared places',()=>{
  const world=createGreyboxWorld(),area=world.areas.find(area=>area.id==='mweb-meadows');
  assert.ok(Array.isArray(area.inspectionRoutes)&&area.inspectionRoutes.length>=3,'actual authored routes are required, rather than a repeated court label');
  assert.ok(area.inspectionRoutes.some(route=>route.kind==='main'));
  assert.ok(area.inspectionRoutes.some(route=>route.kind==='optional'));
  const report=checkGreyboxWorld(world);assert.equal(report.passed,true,JSON.stringify(report.issues));
  const routes=report.localJourneys.filter(route=>route.areaId===area.id);
  assert.equal(routes.length,area.inspectionRoutes.length);
  assert.ok(routes.every(route=>route.boundToSites&&route.actualSweepClear&&route.groundContinuous));
  assert.ok(area.inspectionRoutes.every(route=>route.runtimeEffect==='none'));
  assert.equal(world.officialRun,false);assert.equal(world.rankedEligible,false);assert.equal(world.rulesVersion,null);
});

test('a visible physical fence breaks a declared optional route even if the wider nav can go around it',()=>{
  const world=mutable(),{route}=witnessRoute(world),[a,b]=route.points;
  assert.equal(sweep(world,a,b).contacts.length,0,'the actual unmodified control route is clear before the new fence');
  barrier(world,a,b);assert.ok(sweep(world,a,b).contacts.length>0,'the actual radius24 witness hits this visible fence');
  const report=checkGreyboxWorld(world);
  assert.ok(report.issues.some(issue=>issue.code==='LOCAL_ROUTE_SWEEP_BLOCKED'&&issue.id===route.id),'route labels cannot substitute for the physical approach');
});

test('a local route cannot claim a different declared destination than its actual endpoint',()=>{
  const world=mutable(),{route}=witnessRoute(world);
  route.toSiteId=world.sites.find(site=>site.areaId==='mweb-meadows'&&site.kind==='objective').id;
  const report=checkGreyboxWorld(world);
  assert.ok(report.issues.some(issue=>issue.code==='LOCAL_ROUTE_SITE_MISMATCH'&&issue.id===route.id));
});

test('Meadows exit remains a physical sweep requirement when a staged exit label is unchanged',()=>{
  const world=mutable(),arena=world.arenas.find(arena=>arena.areaId==='mweb-meadows'),exit=arena.exits[0];
  assert.equal(sweep(world,arena.center,exit).contacts.length,0,'the control exit is reachable before the new physical wall');
  barrier(world,arena.center,exit);
  assert.ok(sweep(world,arena.center,exit).contacts.length>0);
  assert.ok(checkGreyboxWorld(world).issues.some(issue=>issue.code==='ARENA_EXITS'&&issue.id===arena.id));
});
