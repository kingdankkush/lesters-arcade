import { WORLD_DESTRUCTIBLES, WORLD_FUEL_DRUMS } from './world-destructibles.mjs';

// Read-only projection of fixed-step events. A single shared chip budget
// covers simultaneous breaks, including chain reactions.
export function buildCoverBreakPresentation({state,tick,project,zoom,view,particleBudget=0,reduceMotion=false}){
  const chips=[],supplies=[],dust=[],warnings=[],budget=reduceMotion?0:Math.min(12,Math.max(0,Math.floor(particleBudget)));
  if(!state)return {chips,supplies,dust,warnings};
  const visible=p=>p.x>=-90&&p.x<=view.width+90&&p.y>=-90&&p.y<=view.height+90;
  for(const d of WORLD_DESTRUCTIBLES){
    const broken=state.brokenTick.get(d.id);if(broken===undefined||tick<broken)continue;
    const age=tick-broken,p=project(d.anchor.x,d.anchor.y,0);
    if(visible(p)&&age<30&&budget){
      const life=age/30;
      dust.push({...p,radius:(20+life*28)*zoom,alpha:(1-life)*.16});
      for(let i=0;i<6&&chips.length<budget;i++){
        const angle=i*Math.PI/3+d.anchor.x*.013,travel=(8+life*43)*(1+i%2*.3);
        chips.push({x:p.x+Math.cos(angle)*travel*zoom,y:p.y+(Math.sin(angle)*travel*.6-Math.sin(life*Math.PI)*24)*zoom,
          size:(2+i%3)*zoom,rotation:angle+life*4,alpha:1-life,color:i%2?0xb89162:0x59696d});
      }
    }
    const s=project(d.supply.x,d.supply.y,0);
    if(!state.collected.has(d.id)&&visible(s))supplies.push({...s,id:d.id,color:d.supply.reward==='heal'?0x99e7a5:0x72ddeb,
      radius:(reduceMotion?22:22+Math.sin(tick/18+d.supply.x)*2)*zoom});
  }
  for(const d of WORLD_FUEL_DRUMS){
    const broken=state.brokenTick.get(d.id);if(broken===undefined||state.exploded.has(d.id)||tick<broken)continue;
    const p=project(d.anchor.x,d.anchor.y,0);
    if(p.x < -d.blastRadius*zoom || p.x > view.width+d.blastRadius*zoom || p.y < -d.blastRadius*zoom || p.y > view.height+d.blastRadius*zoom)continue;
    warnings.push({...p,radius:d.blastRadius*zoom,progress:Math.min(1,(tick-broken)/d.fuseTicks)});
  }
  return {chips,supplies,dust,warnings};
}
