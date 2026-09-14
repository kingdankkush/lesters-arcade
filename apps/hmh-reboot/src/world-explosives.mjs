import { WORLD_FUEL_DRUMS } from './world-destructibles.mjs';
import { traceHeightAwareLineOfSight } from './elevation.mjs';
const ordered=[...WORLD_FUEL_DRUMS].sort((a,b)=>a.id.localeCompare(b.id));

export function stepWorldExplosions(state,{tick,targets,queryGround,blockers}){
  if(!Number.isInteger(tick)||tick<=state.lastExplosionTick)throw new TypeError('explosion ticks must be monotonic');
  state.lastExplosionTick=tick;const hits=[],events=[];
  for(const d of ordered){
    const broken=state.brokenTick.get(d.id);
    if(broken===undefined||state.exploded.has(d.id)||tick<broken+d.fuseTicks)continue;
    state.exploded.set(d.id,tick);
    const z=queryGround(d.anchor.x,d.anchor.y).groundZ,from={...d.anchor,z:z+20};
    events.push({id:d.id,zoneId:d.zoneId,tick,point:{...d.anchor,z},radius:d.blastRadius});
    for(const target of targets){
      const distance=Math.hypot(target.x-d.anchor.x,target.y-d.anchor.y),groundZ=target.groundZ??0;
      if(target.active===false||distance>d.blastRadius||Math.abs(groundZ-z)>8)continue;
      const point={x:target.x,y:target.y,z:groundZ+20};
      const ray=traceHeightAwareLineOfSight({from,to:point,blockers});
      if(!ray.clear&&ray.blockerId!==target.id)continue;
      hits.push({id:`fuel:${d.id}:${tick}:${target.id}`,tick,time:0,targetId:target.id,sourceId:d.id,weaponId:'world-fuel',
        damage:Math.max(1,Math.round((target.id==='player'?24:80)*(1-.55*distance/d.blastRadius))),criticalChance:0,criticalMultiplier:1,
        direction:{x:target.x-d.anchor.x,y:target.y-d.anchor.y||.001},knockback:0,point});
    }
    if(events.length===4)break;
  }
  return {hits,events};
}
