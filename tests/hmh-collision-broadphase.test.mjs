import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LEVEL_ONE_WORLD} from '../apps/hmh-reboot/src/level-one-world.mjs';
import {createCollisionBody,createStaticBlocker,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
import {traceHeightAwareLineOfSight} from '../apps/hmh-reboot/src/elevation.mjs';

// The digest is a witness of the authored world: re-pinned when Level 1 gains
// or moves colliders (three more supply courts on 2026-09-16; the six machine
// control props beside their operate spots for S1.4 on 2026-09-25), never for
// a broad-phase change alone.
test('movement and sight retain the full pre-optimization world collision digest',()=>{
  const hash=createHash('sha256'),blockers=LEVEL_ONE_WORLD.collisionBlockers;
  let seed=0x48130926;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const bodies=[12,22,42].map(radius=>createCollisionBody({id:`r${radius}`,radius,minZ:0,maxZ:58}));
  for(let i=0;i<4000;i++){
    const b=blockers[i%blockers.length],shape=b.shape;
    const anchor=shape.type==='circle'?shape:shape.type==='capsule'?shape.a:shape.vertices[0];
    const start=i%2?{x:random()*12000,y:random()*4800,z:0}:{x:anchor.x+(random()-.5)*90,y:anchor.y+(random()-.5)*90,z:0};
    start.z=i%7===0?64:0;
    const delta={x:(random()-.5)*(i%5===0?1200:25),y:(random()-.5)*(i%5===0?1200:25)};
    const motion=resolveSweptCircleMotion({body:bodies[i%3],start,delta,blockers,bounds:LEVEL_ONE_WORLD.bounds,stopOnFirstContact:i%11===0});
    const sight=traceHeightAwareLineOfSight({from:{...start,z:start.z+34},to:{x:start.x+delta.x*6,y:start.y+delta.y*6,z:start.z+34},radius:i%3,blockers});
    hash.update(JSON.stringify({motion,sight}));
  }
  assert.equal(hash.digest('hex'),'cfe7635d5f89d63aa40c8e29d6c7206d053205c21e16093055c5f7f708989244');
});

test('immutable scenery is indexed locally and a new gate list gets a fresh index',async()=>{
  const {immutableBlockerIndex}=await import('../apps/hmh-reboot/src/blocker-bounds.mjs');
  const blockers=Object.freeze(Array.from({length:1000},(_,i)=>createStaticBlocker({id:`wall-${i}`,shape:{type:'circle',x:i*500,y:0,radius:10},visibleAssetId:'wall'})));
  const index=immutableBlockerIndex(blockers);
  assert.equal(index,immutableBlockerIndex(blockers));
  assert.deepEqual(index.query(0,0,20,0,12),[blockers[0]]);
  assert.equal(immutableBlockerIndex([...blockers]),null,'mutable lists are never cached');
  const open=Object.freeze(blockers.slice(1));
  assert.deepEqual(immutableBlockerIndex(open).query(0,0,20,0,12),[]);
});

test('broad bounds reject distant shapes but retain tangency and mutable geometry',async()=>{
  const {blockerSweepMayOverlap}=await import('../apps/hmh-reboot/src/blocker-bounds.mjs');
  for(const shape of [
    {type:'circle',x:10,y:10,radius:2},
    {type:'capsule',a:{x:8,y:10},b:{x:12,y:10},radius:2},
    {type:'polygon',vertices:[{x:8,y:8},{x:12,y:8},{x:12,y:12},{x:8,y:12}]},
  ]){
    assert.equal(blockerSweepMayOverlap(shape,0,0,0,0,1),false);
    assert.equal(blockerSweepMayOverlap(shape,0,7,20,0,1),true);
    assert.equal(blockerSweepMayOverlap(shape,10,10,0,0,0),true);
  }
  const shape={type:'circle',x:100,y:100,radius:1};
  assert.equal(blockerSweepMayOverlap(shape,0,0,1,0,1),false);shape.x=0;shape.y=0;
  assert.equal(blockerSweepMayOverlap(shape,0,0,1,0,1),true);
});
