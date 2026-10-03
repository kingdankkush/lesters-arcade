// Low forest-floor islands, authored around existing walks and centres.
// All trees and structures retain their exact collision-to-art identities.
import {createPlacementGuard} from '../world-v2-area-art-schema.mjs';

const DESIGNS={
  'hollow-pines':{sources:['needle-bed','moss-root','needle-bed','fern-bed'],beds:[[86,-145],[86,-245],[-86,-145],[-86,-245],[-160,170],[170,190],[-360,285],[380,-280],[440,330]],tint:0xc8cbd5},
  'rugpull-woods':{sources:['leaf-litter','fern-bed','moss-root','leaf-litter'],beds:[[-86,-150],[86,-150],[-86,-245],[86,-245],[-150,220],[155,240],[-360,-275],[380,295],[-420,335]],tint:0xe7dfc5},
};
const OFFSETS=[[0,0],[-12,-28],[14,30],[-8,54],[9,-55],[30,-9],[-29,10],[39,47],[-40,-48]];

export function appendForestFloor({world,area,plan}) {
  const design=DESIGNS[area.id];if(!design)return;
  const guard=createPlacementGuard({world:{...world,sites:world.sites.filter(s=>s.id!==`${area.id}-area`)},areaId:area.id,routeClearance:20,siteClearance:150,spawnClearance:60});
  let id=0;
  const patch=(x,y,name,scale,tint=design.tint)=>{
    const n=id++,half=256*.32*scale/2;
    if(![[-half,-half],[half,-half],[half,half],[-half,half]].every(([dx,dy])=>guard.clear(x+dx,y+dy)))return;
    plan.ground.decals.push({id:`${area.id}-forest-floor-${n}`,source:`detail:forest-${name}`,x,y,scale,rotation:0,alpha:.96,tint,flip:n%2===0});
  };
  // Replace walk-through thorn balls and tangled vine loops with low leaf,
  // moss and needle beds. Preserve every other prop's ID and order verbatim.
  plan.props=plan.props.filter(p=>{
    if(!['b1-01','b1-02'].includes(p.source)||(p.groundZ??0)!==0)return true;
    patch(p.x,p.y,design.sources[id%design.sources.length],.68+(id%3)*.06);
    return false;
  });
  for(const [x,y] of design.beds)for(const [dx,dy] of OFFSETS)patch(area.center.x+x+dx,area.center.y+y+dy,design.sources[id%design.sources.length],.86+(id%3)*.06);
}
