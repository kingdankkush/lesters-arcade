// Local navigation inspection, not the full HMH simulation or canonical run.
import { createPlayerMotionState, stepPlayerMovement } from '../movement.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../collision.mjs';
import { resolveSweptTraversalPath, movementSpeedMultiplierForTransition } from '../elevation.mjs';
const stepSeconds=1/60;
export function createGreyboxNavigator(world){
  if(world?.mapId!=='visual-overhaul-greybox-v1'||world.officialRun!==false||world.rankedEligible!==false||world.rulesVersion!==null)throw new TypeError('local Free greybox world required');
  if(typeof world.queryGround!=='function'||!Array.isArray(world.collisionBlockers)||!Array.isArray(world.areas))throw new TypeError('authored ground/blockers/areas required');
  const body=createCollisionBody({id:'greybox-human',kind:'player',radius:world.playerRadius,minZ:0,maxZ:72});
  const bounds={...world.bounds,visibleBoundaryId:'greybox-world-edge'};
  let motion,tick=0,inspectionJumps=0,lastAction='start',zeroDisplacementFrames=0,contacts=0;
  function place(position){
    const ground=world.queryGround(position.x,position.y);
    const result=resolveSweptCircleMotion({body,start:{...position,z:ground.groundZ},delta:{x:0,y:0},blockers:world.collisionBlockers,bounds});
    if(!ground.walkable||result.contacts.length||result.depenetrations.length)throw new TypeError('inspection area centre must be actually clear and walkable');
    motion=createPlayerMotionState({...position,maxSpeed:240});zeroDisplacementFrames=0;contacts=0;
  }
  place(world.spawn);
  const view=()=>Object.freeze({tick,x:motion.x,y:motion.y,groundZ:world.queryGround(motion.x,motion.y).groundZ,vx:motion.vx,vy:motion.vy,locomotion:motion.locomotion,legDirection:motion.legDirection,torsoDirection:motion.torsoDirection,contacts,inspectionJumps,lastAction,officialRun:false,rankedEligible:false});
  return Object.freeze({
    view,
    step(move){
      if(arguments.length!==1)throw new TypeError('one input argument; timestep is fixed60Hz');
      if(!Number.isFinite(move?.x)||!Number.isFinite(move?.y))throw new TypeError('finite movement input required');
      const ground=world.queryGround(motion.x,motion.y),start={x:motion.x,y:motion.y,z:ground.groundZ},length=Math.hypot(move.x,move.y),probeDistance=Math.max(8,motion.maxSpeed*stepSeconds);
      const speedMultiplier=length>0.001?movementSpeedMultiplierForTransition(ground,world.queryGround(motion.x+move.x/length*probeDistance,motion.y+move.y/length*probeDistance),probeDistance):1;
      stepPlayerMovement(motion,{move,aim:{...move,active:length>0.001}},{dtSeconds:stepSeconds,speedMultiplier});
      const collision=resolveSweptCircleMotion({body,start,delta:{x:motion.x-start.x,y:motion.y-start.y},blockers:world.collisionBlockers,bounds,priorZeroDisplacementFrames:zeroDisplacementFrames});
      const traversal=resolveSweptTraversalPath({start,end:collision.position,queryGround:world.queryGround,maxSampleDistance:Math.max(4,body.radius*.5)});
      motion.x=traversal.position.x;motion.y=traversal.position.y;
      if(!traversal.allowed){motion.vx=0;motion.vy=0;motion.recoilVx=0;motion.recoilVy=0;}
      for(const contact of collision.contacts){const inward=motion.vx*contact.normal.x+motion.vy*contact.normal.y;if(inward<0){motion.vx-=contact.normal.x*inward;motion.vy-=contact.normal.y*inward;}}
      zeroDisplacementFrames=collision.telemetry.zeroDisplacementFrames;contacts=collision.contacts.length;tick++;lastAction='movement';return view();
    },
    inspectArea(id){
      if(arguments.length!==1)throw new TypeError('one authored area argument required');
      const area=world.areas.find(area=>area.id===id);if(!area)throw new TypeError('unknown inspection area');
      place(area.center);inspectionJumps++;lastAction='inspection-jump';return view();
    },
  });
}
export function createGreyboxStepClock(step){
  if(typeof step!=='function')throw new TypeError('fixed step callback required');
  let previous=null,accumulator=0;
  return Object.freeze({
    advance(now){
      if(!Number.isFinite(now))return{steps:0,droppedSeconds:0};
      if(previous===null){previous=now;return{steps:0,droppedSeconds:0};}
      const elapsed=Math.max(0,(now-previous)/1000);previous=Math.max(previous,now);const bounded=Math.min(.25,elapsed);accumulator+=bounded;
      let steps=0;while(accumulator+1e-12>=stepSeconds&&steps<4){step();accumulator=Math.max(0,accumulator-stepSeconds);steps++;}
      let droppedSeconds=elapsed-bounded;if(steps===4&&accumulator>=stepSeconds){droppedSeconds+=accumulator;accumulator=0;}
      return{steps,droppedSeconds};
    },
    pause(){previous=null;accumulator=0;},
  });
}
