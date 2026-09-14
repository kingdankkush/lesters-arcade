import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVEL_ONE_WORLD as world, createLevelOneGroundQuery} from '../apps/hmh-reboot/src/level-one-world.mjs';
import {buildAuthoredPointOfInterestPlacements} from '../apps/hmh-reboot/src/authored-prop-layout.mjs';
import {createCollisionBody,resolveSweptCircleMotion} from '../apps/hmh-reboot/src/collision.mjs';
const ground=createLevelOneGroundQuery();
const body=createCollisionBody({id:'pickup-walker',kind:'player',radius:world.player.radius,minZ:0,maxZ:56});
const sweep=(from,to)=>resolveSweptCircleMotion({body,start:{...from,z:ground(from.x,from.y).groundZ},delta:{x:to.x-from.x,y:to.y-from.y},blockers:world.collisionBlockers,bounds:world.bounds});
for(const pickup of buildAuthoredPointOfInterestPlacements(world.pointsOfInterest)) {
 test(`${pickup.pointOfInterestId} reward is reachable on walkable ground`,()=>{
  const at=sweep(pickup,pickup);
  assert.equal(at.depenetrations.length+at.contacts.length,0,`pickup overlaps ${at.depenetrations[0]?.blockerId??at.contacts[0]?.blockerId}`);
  const approaches=[[84,0],[-84,0],[0,84],[0,-84]].map(([dx,dy])=>({x:pickup.x+dx,y:pickup.y+dy}));
  assert.ok(approaches.some(from=>{
   if(Math.abs(ground(from.x,from.y).groundZ-ground(pickup.x,pickup.y).groundZ)>8)return false;
   const path=sweep(from,pickup);return path.contacts.length+path.depenetrations.length===0;
  }),'pickup has no clear approach using the real player body');
 });
}
