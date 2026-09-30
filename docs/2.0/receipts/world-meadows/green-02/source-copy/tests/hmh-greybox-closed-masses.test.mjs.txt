import assert from 'node:assert/strict';
import test from 'node:test';
import { createStaticBlocker, createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
const module=await import('../apps/hmh-reboot/src/dev/greybox-closed-masses.mjs').catch(()=>({}));
const bounds={minX:0,minY:0,maxX:10,maxY:10};
const rectangle=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const run=floors=>{assert.equal(typeof module.createClosedMassPolygons,'function');return module.createClosedMassPolygons({bounds,floors});};
const area=vertices=>Math.abs(vertices.reduce((sum,p,i)=>{const q=vertices[(i+1)%vertices.length];return sum+p.x*q.y-p.y*q.x;},0)/2);
function contains(vertices,x,y){let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const a=vertices[i],b=vertices[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
function occupancy(floors,closed){for(let iy=0;iy<53;iy++)for(let ix=0;ix<53;ix++){const x=(ix+.371)*10/53,y=(iy+.613)*10/53;const expected=floors.some(polygon=>contains(polygon,x,y));const count=closed.filter(polygon=>contains(polygon,x,y)).length;assert.equal(count,expected?0:1,`physical partition at${x},${y}`);}}

test('closed volumes partition a sloped footprint without filling its playable interior',()=>{
  const floors=[[{x:2,y:2},{x:8,y:2},{x:8,y:8}]],closed=run(floors);
  assert.ok(closed.length>1);assert.ok(Math.abs(closed.reduce((sum,p)=>sum+area(p),0)-82)<1e-8);
  occupancy(floors,closed);
  for(const [i,vertices]of closed.entries())assert.doesNotThrow(()=>createStaticBlocker({id:`partition-${i}`,visibleAssetId:`partition-${i}`,shape:{type:'polygon',vertices},minZ:0,maxZ:120}));
});

test('crossing diagonal floors and an interior island leave no invisible hole or overlapping closed mass',()=>{
  const floors=[[{x:1,y:1},{x:9,y:7},{x:9,y:9},{x:1,y:3}],[{x:1,y:7},{x:9,y:1},{x:9,y:3},{x:1,y:9}],rectangle(4.1,4.1,1.8,1.8)];
  occupancy(floors,run(floors));
});

test('partition output is owned/frozen and real player sweeps stop at the visible closed boundary',()=>{
  const floors=[rectangle(2,2,6,6)],closed=run(floors),before=JSON.stringify(closed);
  floors[0][0].x=-99;assert.equal(JSON.stringify(closed),before);assert.throws(()=>{closed[0][0].x=99;},TypeError);
  const blockers=closed.map((vertices,i)=>createStaticBlocker({id:`mass-${i}`,visibleAssetId:`mass-${i}`,shape:{type:'polygon',vertices},minZ:0,maxZ:120}));
  const body=createCollisionBody({id:'human',kind:'player',radius:.1,minZ:0,maxZ:72});
  const move=resolveSweptCircleMotion({body,start:{x:5,y:5,z:0},delta:{x:5,y:0},blockers,bounds:{...bounds,visibleBoundaryId:'world'},stopOnFirstContact:true});
  assert.ok(move.position.x<=7.900001&&move.contacts.length>0);
});

test('malformed and concave floor footprints cannot silently produce believable closed geometry',()=>{
  assert.equal(typeof module.createClosedMassPolygons,'function');
  assert.throws(()=>module.createClosedMassPolygons({bounds:{...bounds,maxX:0},floors:[]}),/bounds/);
  assert.throws(()=>run([[{x:1,y:1},{x:9,y:1},{x:5,y:5},{x:9,y:9},{x:1,y:9}]]),/convex/);
  assert.throws(()=>run([[{x:NaN,y:1},{x:9,y:1},{x:1,y:9}]]),/finite/);
  assert.throws(()=>run([rectangle(-1,2,3,3)]),/inside/);
});

test('a self-intersecting star is rejected even when every local turn has the same sign',()=>{
  const ring=Array.from({length:5},(_,i)=>({x:5+4*Math.cos(i*2*Math.PI/5),y:5+4*Math.sin(i*2*Math.PI/5)}));
  assert.throws(()=>run([[0,2,4,1,3].map(i=>ring[i])]),/simple/);
});

test('a zero-length edge cannot be hidden by otherwise valid convex turns',()=>{
  const p=rectangle(2,2,6,6);assert.throws(()=>run([[p[0],p[0],...p.slice(1)]]),/duplicate|zero/);
});

test('repeated nonadjacent vertices cannot double-wind a floor footprint',()=>{
  const p=rectangle(2,2,6,6);assert.throws(()=>run([[...p,...p]]),/duplicate/);
});
