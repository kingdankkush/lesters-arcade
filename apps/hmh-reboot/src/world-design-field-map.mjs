import { WORLD_DESIGN_EXPLORATION_PATHS } from './world-design-encounters.mjs';
import { OBJECTIVE_REWARDS, objectiveRewardStatus, objectiveRewardState, SUPPLY_NAMES } from './objective-rewards.mjs';
import { missionFieldMapNodes } from './mission-guidance.mjs';

const NODE_STATE_LABELS = Object.freeze({ done: 'complete', locked: 'locked', started: 'in progress', ready: 'task available' });

// Presentation of existing discovery state, read only and constructed on pause.
// Objective nodes come from the mission's discovery (the logical view of the
// simulated actor, design package §3.3), never from the camera.
export function buildWorldDesignFieldMap({ world, player, reveal, mission = null, collectibles = null, tick = 0 }) {
  const b = world.bounds, sx = 600 / (b.maxX - b.minX), sy = 240 / (b.maxY - b.minY);
  const project = p => ({ x: (p.x - b.minX) * sx, y: (p.y - b.minY) * sy });
  const seen = new Set(reveal.revealedCellIds), size = reveal.cellSize;
  const discovered = p => seen.has(`${Math.floor((p.x-b.minX)/size)}:${Math.floor((p.y-b.minY)/size)}`);
  const nodes = new Map(world.routeGraph.nodes.map(n => [n.id, n]));
  const missionNodes = mission ? missionFieldMapNodes(mission) : [];
  const machineSeen = id => missionNodes.some(node => node.id === id);
  return {
    player: project(player),
    lore: missionNodes.filter(node => node.objectiveClass === 'secret').map(node => node.lore),
    cells: [...seen].map(id => { const [c,r]=id.split(':').map(Number); return {x:c*size*sx,y:r*size*sy,width:size*sx,height:size*sy}; }),
    paths: [...world.routes.map(r => ({id:r.id,points:r.nodeIds.map(id=>project(nodes.get(id)))})),
      ...WORLD_DESIGN_EXPLORATION_PATHS.map(p=>({id:p.id,points:p.points.map(project)}))],
    water: world.surfaces.filter(s=>s.kind==='water').map(s=>({id:s.id,points:(s.area.type==='polygon'?s.area.vertices:[{x:s.area.minX,y:s.area.minY},{x:s.area.maxX,y:s.area.minY},{x:s.area.maxX,y:s.area.maxY},{x:s.area.minX,y:s.area.maxY}]).map(project)})),
    // Discovered objective nodes by state: machines, gates and items.
    sites: missionNodes.filter(node => node.objectiveClass !== 'secret').map(node => ({
      id: node.id, name: node.name, objectiveClass: node.objectiveClass, ...project(node),
      state: node.state, complete: node.state === 'done', status: NODE_STATE_LABELS[node.state], needs: node.needs, task: node.task,
    })),
    objectives: OBJECTIVE_REWARDS.filter(r=>discovered(r)||machineSeen(r.objectiveId)||collectibles?.unlockedObjectives.has(r.objectiveId)).map(r=>({
      id:r.id,name:r.name,reward:r.rewardName,task:r.task,...project(r),
      state:objectiveRewardState(collectibles,r.id,{tick,discovered:true}).state,
      status:objectiveRewardStatus(collectibles,r.id,tick),
    })),
    supplies: (collectibles?.entries??[]).filter(({placement:p})=>!p.requiredObjective&&p.respawnTicks&&discovered(p)).map(({placement:p})=>({id:p.id,name:SUPPLY_NAMES[p.assetId]??p.assetId,status:collectibles.readyTicks.has(p.id)&&tick<collectibles.readyTicks.get(p.id)?`restocks in ${Math.ceil((collectibles.readyTicks.get(p.id)-tick)/60)}s`:'ready'})),
  };
}

export function renderWorldDesignFieldMap(mount, model) {
  if (!mount) return;
  const doc=mount.ownerDocument, ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs,parent)=>{const el=doc.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));parent?.append(el);return el;};
  const svg=make('svg',{viewBox:'0 0 600 240',role:'img','aria-label':'Field map: explored routes, discovered places and your position'});
  const defs=make('defs',{},svg), clip=make('clipPath',{id:'hmh-field-explored'},defs);
  for(const cell of model.cells) make('rect',cell,clip);
  make('rect',{width:600,height:240,rx:5,fill:'#0d161b',stroke:'#699087'},svg);
  const explored=make('g',{'clip-path':'url(#hmh-field-explored)'},svg);
  make('rect',{width:600,height:240,fill:'#344b3e'},explored);
  for(const water of model.water)make('polygon',{points:water.points.map(p=>`${p.x},${p.y}`).join(' '),fill:'#327887'},explored);
  for(const path of model.paths)make('polyline',{points:path.points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:'#cbb581','stroke-width':1.5,'stroke-linejoin':'round'},explored);
  // Shape and colour together: circle done, square available, cross locked.
  for(const s of model.sites){
    const g=make('g',{},svg);
    if(s.state==='done')make('circle',{cx:s.x,cy:s.y,r:3.5,fill:'#3fc46f'},g);
    else if(s.state==='locked'){make('line',{x1:s.x-3,y1:s.y-3,x2:s.x+3,y2:s.y+3,stroke:'#d8433a','stroke-width':2},g);make('line',{x1:s.x+3,y1:s.y-3,x2:s.x-3,y2:s.y+3,stroke:'#d8433a','stroke-width':2},g);}
    else make('rect',{x:s.x-3,y:s.y-3,width:6,height:6,fill:'#fff4d6'},g);
    const t=make('title',{},g);t.textContent=`${s.name} · ${s.status}${s.needs?` · needs ${s.needs}`:''}`;
  }
  make('circle',{cx:model.player.x,cy:model.player.y,r:5,fill:'#fff',stroke:'#08181b','stroke-width':2},svg);
  const list=doc.createElement('p');list.className='hmh-field-map-key';list.textContent='White ring: you · Square: task available · Cross: locked · Circle: complete. '+(model.sites.map(s=>`${s.name}${s.complete?' ✓':s.needs?` (needs ${s.needs})`:''}`).join(' · ')||'Follow the paths to discover places.');
  const objectives=doc.createElement('ul');objectives.className='hmh-field-map-key';
  for(const r of model.objectives??[]){const row=doc.createElement('li');row.textContent=`${r.name} · ${r.reward} · ${r.status}. ${r.status==='locked'?r.task:''}`;objectives.append(row);}
  for(const s of model.supplies??[]){const row=doc.createElement('li');row.textContent=`${s.name} · ${s.status}`;objectives.append(row);}
  const lore=doc.createElement('p');lore.className='hmh-field-map-key';lore.textContent=(model.lore??[]).join(' ');
  mount.replaceChildren(svg,list,objectives,lore);
}
