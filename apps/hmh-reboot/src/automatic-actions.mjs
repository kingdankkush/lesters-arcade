import { ENEMY_ARCHETYPES } from './enemy-archetypes.mjs';
import { resolveSweptCircleMotion } from './collision.mjs';
import { traceHeightAwareLineOfSight } from './elevation.mjs';

function distanceToSegment(point,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}

// The dodge footprint rule, shared by the automatic and the manual dodge:
// dodge movement may not introduce a drop, cross deep water or clip the edge
// of a narrow bridge. Samples every 4 units from the start to `distance`
// across the body's width; returns the first unsafe sample's distance, or
// null when the whole route is safe.
export function firstUnsafeDodgeSample({start,direction,distance,radius,groundZ,queryGround}) {
  for(let along=0;along<=distance;along+=4) {
    for(const offset of [-radius,0,radius]) {
      const ground=queryGround(start.x+direction.x*along-direction.y*offset,start.y+direction.y*along+direction.x*offset);
      if(!ground.walkable || ground.deepWater || Math.abs(ground.groundZ-groundZ)>6) return along;
    }
  }
  return null;
}

// Simulation only: no camera, wall clock, random draws or animation state.
export function automaticDodgeIntent({tick,actor,move,state,body,bounds,blockers,queryGround,enemies}) {
  if(state.active || tick<state.cooldownReadyTick || Math.hypot(move.x,move.y)<.5) return null;
  const magnitude=Math.hypot(move.x,move.y),direction={x:move.x/magnitude,y:move.y/magnitude};
  const start={x:actor.x,y:actor.y,z:actor.groundZ};
  const end={x:actor.x+direction.x*state.distance,y:actor.y+direction.y*state.distance};
  const danger=[];
  for(const enemy of enemies) {
    const attack=ENEMY_ARCHETYPES[enemy.archetypeId]?.attack;
    if(!attack || enemy.active===false || enemy.health<=0 || enemy.attackPhase!=='tell'
      || enemy.attackPhaseUntilTick<tick || enemy.attackPhaseUntilTick-tick>6
      || Math.abs((enemy.groundZ??0)-actor.groundZ)>8 || attack.tokenFamily==='support') continue;
    if(!traceHeightAwareLineOfSight({from:{...enemy,z:(enemy.groundZ??0)+32},to:{...actor,z:actor.groundZ+32},blockers}).clear) continue;
    const target=enemy.telegraphTarget??actor;
    const contains=attack.tokenFamily==='melee'
      ? p=>Math.hypot(p.x-enemy.x,p.y-enemy.y)<attack.range+body.radius
      : attack.tokenFamily==='area'
        ? p=>Math.hypot(p.x-target.x,p.y-target.y)<96+body.radius
        : p=>distanceToSegment(p,enemy,target)<18+body.radius;
    danger.push(contains);
    // An automatic dodge must never cut through the attacker.
    if(distanceToSegment(enemy,start,end)<body.radius+(enemy.radius??20)
      && (enemy.x-start.x)*direction.x+(enemy.y-start.y)*direction.y>0) return null;
  }
  if(!danger.some(contains=>contains(start)) || danger.some(contains=>contains(end))) return null;
  const sweep=resolveSweptCircleMotion({body,start,delta:{x:end.x-start.x,y:end.y-start.y},blockers,bounds,stopOnFirstContact:true});
  if(sweep.contacts.length || sweep.depenetrations.length || Math.hypot(sweep.position.x-end.x,sweep.position.y-end.y)>.1) return null;
  // Check the entire footprint: an automatic dodge needs the whole route safe.
  if(firstUnsafeDodgeSample({start,direction,distance:state.distance,radius:body.radius,groundZ:actor.groundZ,queryGround})!==null) return null;
  return direction;
}
