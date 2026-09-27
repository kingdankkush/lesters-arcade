import { WORLD_DESIGN_SITES } from './world-design-encounters.mjs';
import { createEnemyNavGrid } from './enemy-navgrid.mjs';

// Mission core v2 (design package S1.4) moved the objective machinery into
// mission-objectives.mjs. What stays here reads its state: the valve's steam
// trap (`state.completed`) and the local navgrid patch for opened gates.

export function worldDesignHazardPhase(state, site, tick) {
  const completedTick=state.completed.get(site.id);
  if (!site.hazard || completedTick === undefined) return { phase:'idle', progress:0 };
  const elapsed=tick-completedTick, h=site.hazard;
  if(elapsed<h.warningTicks) return {phase:'warning',progress:Math.max(0,elapsed/h.warningTicks)};
  if(elapsed<h.warningTicks+h.durationTicks) return {phase:'active',progress:(elapsed-h.warningTicks)/h.durationTicks};
  return {phase:'spent',progress:1};
}

export function buildWorldDesignHazardHits(state,{tick,targets,queryGround,lineClear=()=>true}) {
  const hits=[];
  if(tick%30!==0) return hits;
  for(const site of WORLD_DESIGN_SITES) {
    if(worldDesignHazardPhase(state,site,tick).phase!=='active') continue;
    const h=site.hazard,z=queryGround(h.x,h.y).groundZ;
    for(const target of targets) {
      if(target.active===false || Math.hypot(target.x-h.x,target.y-h.y)>h.radius || Math.abs((target.groundZ??0)-z)>8 || !lineClear({...h,z:z+16},{...target,z:(target.groundZ??0)+16})) continue;
      hits.push({id:`steam:${tick}:${target.id}`,tick,time:0,targetId:target.id,sourceId:site.id,weaponId:'world-steam',damage:8,criticalChance:0,criticalMultiplier:1,armorPiercing:false,direction:{x:0,y:1},knockback:0,point:{x:target.x,y:target.y,z:(target.groundZ??0)+16}});
    }
  }
  return hits;
}

// Rebuild only the gate neighbourhood, retaining the base 60-unit lattice.
// A halo supplies all four neighbours when copying directed interior edges.
export function refreshWorldDesignGateNavigation(grid, world, queryGround, gateId, activeBlockers) {
  const gate=world.collisionBlockers.find(b=>b.id===gateId);
  if(!gate || gate.shape.type!=='capsule') throw new TypeError('authored capsule gate required');
  const {a,b,radius}=gate.shape, size=grid.cellSize;
  const left=Math.max(0,Math.floor((Math.min(a.x,b.x)-radius-grid.minX)/size)-3);
  const top=Math.max(0,Math.floor((Math.min(a.y,b.y)-radius-grid.minY)/size)-3);
  const right=Math.min(grid.columns,Math.ceil((Math.max(a.x,b.x)+radius-grid.minX)/size)+3);
  const bottom=Math.min(grid.rows,Math.ceil((Math.max(a.y,b.y)+radius-grid.minY)/size)+3);
  const local=createEnemyNavGrid({world:{bounds:{minX:grid.minX+left*size,minY:grid.minY+top*size,maxX:grid.minX+right*size,maxY:grid.minY+bottom*size},collisionBlockers:activeBlockers},queryGround,cellSize:size});
  for(let y=1;y<local.rows-1;y++) for(let x=1;x<local.columns-1;x++) {
    const to=(top+y)*grid.columns+left+x, from=y*local.columns+x;
    grid.walkable[to]=local.walkable[from]; grid.edges[to]=local.edges[from];
  }
  return (local.rows-2)*(local.columns-2);
}
