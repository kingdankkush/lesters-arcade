import { WORLD_DESIGN_SECRETS } from './world-design-secrets.mjs';
import { WORLD_DESIGN_SITES, WORLD_DESIGN_EXPLORATION_PATHS } from './world-design-encounters.mjs';

// Presentation of existing discovery state, read only and constructed on pause.
export function buildWorldDesignFieldMap({ world, player, reveal, completed = new Map(), secrets = [] }) {
  const b = world.bounds, sx = 600 / (b.maxX - b.minX), sy = 240 / (b.maxY - b.minY);
  const project = p => ({ x: (p.x - b.minX) * sx, y: (p.y - b.minY) * sy });
  const seen = new Set(reveal.revealedCellIds), size = reveal.cellSize;
  const discovered = p => seen.has(`${Math.floor((p.x-b.minX)/size)}:${Math.floor((p.y-b.minY)/size)}`);
  const nodes = new Map(world.routeGraph.nodes.map(n => [n.id, n]));
  return {
    player: project(player),
    lore: WORLD_DESIGN_SECRETS.filter(s=>secrets.includes(s.id)).map(s=>s.lore),
    cells: [...seen].map(id => { const [c,r]=id.split(':').map(Number); return {x:c*size*sx,y:r*size*sy,width:size*sx,height:size*sy}; }),
    paths: [...world.routes.map(r => ({id:r.id,points:r.nodeIds.map(id=>project(nodes.get(id)))})),
      ...WORLD_DESIGN_EXPLORATION_PATHS.map(p=>({id:p.id,points:p.points.map(project)}))],
    water: world.surfaces.filter(s=>s.kind==='water').map(s=>({id:s.id,points:(s.area.type==='polygon'?s.area.vertices:[{x:s.area.minX,y:s.area.minY},{x:s.area.maxX,y:s.area.minY},{x:s.area.maxX,y:s.area.maxY},{x:s.area.minX,y:s.area.maxY}]).map(project)})),
    sites: WORLD_DESIGN_SITES.filter(s=>discovered(s)||completed.has(s.id)).map(s=>({id:s.id,name:s.name,...project(s),complete:completed.has(s.id)})),
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
  for(const s of model.sites){const g=make('g',{},svg);make('circle',{cx:s.x,cy:s.y,r:3,fill:s.complete?'#a8eb9c':'#ffd27d'},g);const t=make('title',{},g);t.textContent=`${s.name}${s.complete?' · complete':''}`;}
  make('circle',{cx:model.player.x,cy:model.player.y,r:5,fill:'#fff',stroke:'#08181b','stroke-width':2},svg);
  const list=doc.createElement('p');list.className='hmh-field-map-key';list.textContent='White: you · Gold: discovered machinery · Green: complete. '+(model.sites.map(s=>`${s.name}${s.complete?' ✓':''}`).join(' · ')||'Follow the paths to discover places.');
  const lore=doc.createElement('p');lore.className='hmh-field-map-key';lore.textContent=(model.lore??[]).join(' ');
  mount.replaceChildren(svg,list,lore);
}
