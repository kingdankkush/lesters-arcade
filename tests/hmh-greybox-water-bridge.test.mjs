// Proposed local authoring behavior tests only; not installed or executed yet.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxPiece} from '../apps/hmh-reboot/src/dev/greybox-kit.mjs';
import {createAuthoredGroundQuery,createElevationSurface,resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
import {createEnemyNavGrid} from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import {createGreyboxNavigator} from '../apps/hmh-reboot/src/dev/greybox-navigation.mjs';

const bounds={minX:0,minY:0,maxX:1000,maxY:1000};
const waterBounds={minX:400,minY:0,maxX:600,maxY:1000};
const wet=extra=>createGreyboxPiece({id:'review-channel',kind:'water',bounds:waterBounds,height:0,priority:30,...extra});
function fixture({crossing=true,reversed=false}={}){
  const water=wet(),pieces=[water];
  if(crossing)pieces.push(
    createGreyboxPiece({id:'review-west-ramp',kind:'ramp',bounds:{minX:200,minY:340,maxX:400,maxY:660},fromZ:0,toZ:24,priority:40}),
    createGreyboxPiece({id:'review-bridge',kind:'bridge',bounds:{minX:400,minY:340,maxX:600,maxY:660},height:24,priority:41,visibleStepId:true}),
    createGreyboxPiece({id:'review-east-ramp',kind:'ramp',bounds:{minX:600,minY:340,maxX:800,maxY:660},fromZ:24,toZ:0,priority:40})
  );
  const baseSurface=createElevationSurface({id:'review-dry-floor',area:{type:'rect',...bounds},visibleTerrainId:'review-dry-floor'});
  const surfaces=pieces.map(piece=>piece.surface);if(reversed)surfaces.reverse();
  return{mapId:'visual-overhaul-greybox-v1',officialRun:false,rankedEligible:false,rulesVersion:null,bounds,baseSurface,surfaces,pieces,collisionBlockers:[],playerRadius:24,spawn:{x:100,y:500},areas:[{id:'dry-bank',center:{x:100,y:500}},{id:'shore-test',center:{x:100,y:180}}],queryGround:createAuthoredGroundQuery({baseSurface,surfaces})};
}

test('local water overrides the dry floor with exactly matching visible blocked ground and no solid wall',()=>{
  const world=fixture({crossing:false}),piece=world.pieces[0],ground=world.queryGround(500,500);
  assert.equal(piece.blocker,null);assert.equal(piece.kind,'water');assert.equal(piece.visible.kind,'water');
  assert.deepEqual(piece.surface.area,{type:'rect',...piece.visible.bounds});assert.equal(piece.surface.visibleTerrainId,piece.visible.id);
  assert.equal(ground.kind,'water');assert.equal(ground.walkable,false);assert.equal(ground.deepWater,true);
  assert.equal(world.queryGround(300,500).walkable,true);
  assert.equal(resolveSweptTraversalPath({start:{x:300,y:500},end:{x:700,y:500},queryGround:world.queryGround}).allowed,false);
});

test('shaped water preserves its actual visible outline and detached source vertices',()=>{
  const vertices=[{x:400,y:0},{x:550,y:0},{x:600,y:300},{x:600,y:1000},{x:400,y:1000}],saved=structuredClone(vertices);
  const piece=wet({vertices});assert.deepEqual(vertices,saved);assert.equal(piece.surface.area.type,'polygon');
  assert.deepEqual(piece.surface.area.vertices,piece.visible.vertices);assert.equal(piece.blocker,null);
  vertices[0].x=999;assert.notEqual(piece.visible.vertices[0].x,999);assert.ok(Object.isFrozen(piece.surface.area.vertices));
  const baseSurface=createElevationSurface({id:'floor',area:{type:'rect',...bounds},visibleTerrainId:'floor'});
  const query=createAuthoredGroundQuery({baseSurface,surfaces:[piece.surface]});
  assert.equal(query(590,30).walkable,true,'the bounding box must not silently replace the angled water edge');
  assert.equal(query(500,500).deepWater,true);
});

test('water authoring rejects self-intersection, repeated vertices and contradictory dry flags',()=>{
  assert.throws(()=>wet({vertices:[{x:400,y:0},{x:600,y:1000},{x:600,y:0},{x:400,y:1000}]}),/polygon|intersect|simple/);
  assert.throws(()=>wet({vertices:[{x:400,y:0},{x:600,y:0},{x:600,y:1000},{x:400,y:1000},{x:400,y:0}]}),/polygon|duplicate|edge/);
  assert.throws(()=>wet({vertices:[{x:400,y:0},{x:500,y:500},{x:600,y:1000}]}),/polygon|area/);
  assert.throws(()=>wet({walkable:true}),/water|walkable/);
  assert.throws(()=>wet({deepWater:false}),/water|deepWater/);
});

test('bridge priority restores a dry two-way crossing regardless of source order while adjacent water stays blocked',()=>{
  for(const reversed of [false,true]){
    const world=fixture({reversed}),bridge=world.pieces.find(piece=>piece.kind==='bridge'),middle=world.queryGround(500,500);
    assert.equal(bridge.blocker,null);assert.equal(middle.kind,'bridge');assert.equal(middle.groundZ,24);assert.equal(middle.walkable,true);assert.equal(middle.deepWater,false);
    assert.equal(middle.visibleTerrainId,bridge.visible.id);assert.equal(world.queryGround(500,180).deepWater,true);
    for(const[start,end]of [[{x:100,y:500},{x:900,y:500}],[{x:900,y:500},{x:100,y:500}]])assert.equal(resolveSweptTraversalPath({start,end,queryGround:world.queryGround}).allowed,true);
  }
  const removed=fixture({crossing:false});assert.equal(resolveSweptTraversalPath({start:{x:100,y:500},end:{x:900,y:500},queryGround:removed.queryGround}).allowed,false);
});

test('actual local navigator steps stop at the shore rather than crossing an invisible walkable channel',()=>{
  const world=fixture(),actor=createGreyboxNavigator(world);actor.inspectArea('shore-test');
  for(let i=0;i<200;i++)actor.step({x:1,y:0});
  const view=actor.view();assert.ok(view.x>380&&view.x<400);assert.equal(view.y,180);assert.equal(view.vx,0);assert.equal(view.groundZ,0);
  assert.equal(view.tick,200);assert.equal(view.inspectionJumps,1);assert.equal(world.queryGround(view.x,view.y).walkable,true);
});

test('actual local navigator uses both ramp approaches and returns across the bridge with existing fixed steps',()=>{
  const actor=createGreyboxNavigator(fixture());let maximum=0;
  for(let i=0;i<250&&actor.view().x<850;i++){actor.step({x:1,y:0});maximum=Math.max(maximum,actor.view().groundZ);}
  assert.ok(actor.view().x>=850);assert.equal(maximum,24);assert.equal(actor.view().groundZ,0);
  for(let i=0;i<250&&actor.view().x>150;i++)actor.step({x:-1,y:0});
  assert.ok(actor.view().x<=150);assert.equal(actor.view().groundZ,0);assert.equal(actor.view().inspectionJumps,0);
  assert.equal(actor.view().officialRun,false);assert.equal(actor.view().rankedEligible,false);
});

test('the unchanged conservative grid sees water as closed and the broad bridge centre as connected',()=>{
  const world=fixture(),grid=createEnemyNavGrid({world,queryGround:world.queryGround});
  assert.equal(grid.walkable[grid.cellAt(500,180)],0);assert.equal(grid.walkable[grid.cellAt(500,500)],1);
  assert.equal(grid.walkable[grid.cellAt(300,500)],1);assert.equal(grid.walkable[grid.cellAt(700,500)],1);
  const removed=fixture({crossing:false}),without=createEnemyNavGrid({world:removed,queryGround:removed.queryGround});
  assert.equal(without.walkable[without.cellAt(500,500)],0);
});

test('existing authority already supplies blocked water and priority-based bridge ground without new movement rules',()=>{
  const floor=createElevationSurface({id:'baseline-floor',area:{type:'rect',...bounds},visibleTerrainId:'floor'});
  const water=createElevationSurface({id:'baseline-water',kind:'water',area:{type:'rect',...waterBounds},visibleTerrainId:'water',priority:30});
  const bridge=createElevationSurface({id:'baseline-bridge',kind:'bridge',area:{type:'rect',minX:400,minY:340,maxX:600,maxY:660},visibleTerrainId:'bridge',priority:41,groundZ:24});
  const query=createAuthoredGroundQuery({baseSurface:floor,surfaces:[bridge,water]});
  assert.equal(query(500,180).walkable,false);assert.equal(query(500,500).walkable,true);assert.equal(query(500,500).groundZ,24);
});
