import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVEL_ONE_WORLD as world,createLevelOneGroundQuery} from '../apps/hmh-reboot/src/level-one-world.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {resolveSweptTraversalPath} from '../apps/hmh-reboot/src/elevation.mjs';
const ground=createLevelOneGroundQuery();
const actor=createCollisionBody({id:'water-rule-actor',kind:'player',radius:24,minZ:0,maxZ:42});

test('the northern ford is now a raised bridge with approach ramps and preserved crossing ID',()=>{
 const crossing=world.crossings.find(c=>c.id==='crossing-shallows');
 assert.ok(crossing);assert.equal(ground(4750,975).kind,'bridge');assert.equal(ground(4750,975).groundZ,16);
 assert.equal(ground(4440,975).kind,'ramp');assert.equal(ground(5060,975).kind,'ramp');
 assert.equal(crossing.surfaceIds.length,3);
 for(const [start,end] of [[crossing.entry,crossing.exit],[crossing.exit,crossing.entry]]){
  const r=resolveSweptTraversalPath({start,end,queryGround:ground,maxSampleDistance:4});assert.ok(r.allowed,r.reason);
 }
});
test('water blocks all sampled river crossings outside the two physical bridge decks',()=>{
 assert.equal(world.surfaces.some(s=>s.kind==='shallow-water'),false);
 for(const y of [200,780,820,1150,1250,1700,2200,2580,2900,3400,3750,4100,4700]){
  const r=resolveSweptTraversalPath({start:{x:4350,y},end:{x:5150,y},queryGround:ground,maxSampleDistance:4});
  assert.equal(r.allowed,false,'unbridged river y='+y);assert.equal(r.reason,'deep-water');
 }
 for(let x=4510;x<5000;x+=70)for(let y=20;y<4800;y+=37){
  const s=ground(x,y);if(s.walkable)assert.equal(s.kind,'bridge',`walkable river at ${x},${y}`);
 }
});
test('physical northern bridge rails prevent sideways departure over deep water',()=>{
 for(const [id,dy] of [['crossing-footbridge-north-rail',-240],['crossing-footbridge-south-rail',240]]){
  const rail=world.collisionBlockers.find(b=>b.id===id);assert.ok(rail,id);
  const r=resolveSweptCircleMotion({body:actor,start:{x:4750,y:975,z:16},delta:{x:0,y:dy},blockers:world.collisionBlockers,bounds:world.bounds});
  assert.ok(r.contacts.some(c=>c.blockerId===id));assert.equal(ground(r.position.x,r.position.y).kind,'bridge');
 }
});
test('reservoir blocks walking and preserves every existing spawn and objective on dry ground',()=>{
 assert.equal(ground(5300,4100).deepWater,true);assert.equal(ground(5800,4100).walkable,true);
 const r=resolveSweptTraversalPath({start:{x:5700,y:4100},end:{x:5300,y:4100},queryGround:ground,maxSampleDistance:4});assert.equal(r.reason,'deep-water');
 for(const p of [...world.spawnPoints,...world.pointsOfInterest.map(p=>p.anchor)])assert.ok(ground(p.x,p.y).walkable,JSON.stringify(p));
});
test('reservoir exploration route is connected, wide enough for movement and traversable in both directions',()=>{
 const route=world.routes.find(r=>r.id==='crossing-reservoir-loop');assert.ok(route);
 assert.ok(route.width>=144);assert.equal(route.nodeIds[0],'bridge-east');assert.equal(route.nodeIds.at(-1),'bridge-east');
 const nodes=new Map(world.routeGraph.nodes.map(n=>[n.id,n]));
 const ribbon=createCollisionBody({id:'promenade-ribbon',kind:'player',radius:route.width/2+24,minZ:0,maxZ:42});
 for(let i=1;i<route.nodeIds.length;i++){
  const start=nodes.get(route.nodeIds[i-1]),end=nodes.get(route.nodeIds[i]);
  for(const [from,to] of [[start,end],[end,start]]){
   const collision=resolveSweptCircleMotion({body:ribbon,start:{...from,z:0},delta:{x:to.x-from.x,y:to.y-from.y},blockers:world.collisionBlockers,bounds:world.bounds});
   assert.equal(collision.contacts.length+collision.depenetrations.length,0,route.nodeIds[i]);
   const r=resolveSweptTraversalPath({start:from,end:to,queryGround:ground,maxSampleDistance:4});assert.ok(r.allowed,r.reason);
  }
  // Check the whole walkable ribbon against water, not only its center line.
  const ticks=Math.ceil(Math.hypot(end.x-start.x,end.y-start.y)/4);
  for(let j=0;j<=ticks;j++)for(let a=0;a<8;a++){
   const x=start.x+(end.x-start.x)*j/ticks+Math.cos(a*Math.PI/4)*ribbon.radius;
   const y=start.y+(end.y-start.y)*j/ticks+Math.sin(a*Math.PI/4)*ribbon.radius;
   assert.ok(ground(x,y).walkable,`promenade ribbon reaches water at ${x},${y}`);
  }
 }
});
test('new terrain and architecture bodies retain clear encounter circles and radius-24 spawn margins',()=>{
 for(const id of ['ravine-south-escarpment-outcrop','yard-residential-duplex-south','crossing-lakeside-pumphouse']){
  const b=world.blockers.find(b=>b.id===id);assert.ok(b,id);
  for(const arena of world.encounterArenas){
   const body=createCollisionBody({id:'combat-floor',kind:'player',radius:arena.radius+24,minZ:0,maxZ:42});
   const r=resolveSweptCircleMotion({body,start:{...arena.anchor,z:0},delta:{x:0,y:0},blockers:[world.collisionBlockers.find(c=>c.id===id)]});
   assert.equal(r.depenetrations.length,0,`${id} crowds ${arena.id}`);
  }
 }
});
test('the widened compound passage provides a complete second route with a 144-unit dry corridor',()=>{
 const route=world.routes.find(r=>r.id==='crossing-reservoir-cut-through');assert.ok(route);assert.equal(route.width,144);
 const nodes=new Map(world.routeGraph.nodes.map(n=>[n.id,n]));
 const ribbon=createCollisionBody({id:'close-quarters-corridor',kind:'player',radius:72,minZ:0,maxZ:42});
 assert.ok(route.nodeIds.includes('crossing-exit'));assert.ok(route.nodeIds.includes('bridge-east'));assert.ok(route.nodeIds.includes('reservoir-east-shore'));
 for(let i=1;i<route.nodeIds.length;i++){
  const a=nodes.get(route.nodeIds[i-1]),b=nodes.get(route.nodeIds[i]);
  for(const [start,end] of [[a,b],[b,a]]){
   const collision=resolveSweptCircleMotion({body:ribbon,start:{...start,z:0},delta:{x:end.x-start.x,y:end.y-start.y},blockers:world.collisionBlockers,bounds:world.bounds});
   assert.equal(collision.contacts.length+collision.depenetrations.length,0,route.nodeIds[i]);
   const traversal=resolveSweptTraversalPath({start,end,queryGround:ground,maxSampleDistance:4});assert.ok(traversal.allowed,traversal.reason);
  }
  const ticks=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4);
  for(let j=0;j<=ticks;j++)for(let k=0;k<8;k++){
   const x=a.x+(b.x-a.x)*j/ticks+Math.cos(k*Math.PI/4)*ribbon.radius;
   const y=a.y+(b.y-a.y)*j/ticks+Math.sin(k*Math.PI/4)*ribbon.radius;
   assert.ok(ground(x,y).walkable,`compound corridor reaches water at ${x},${y}`);
  }
 }
});
