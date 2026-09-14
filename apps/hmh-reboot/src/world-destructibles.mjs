import { freezeDeep } from './value-guards.mjs';

// Authored solids and supply locations are simulation data. Rendered debris
// and prop animation never determine damage, blocking or reward collection.
export const WORLD_DESTRUCTIBLES = freezeDeep([
  ['relay-barricade-a','frontier-relay',1600,2950,'scrap-barricade','ammo'],
  ['ravine-barricade-a','rugpull-ravine',2240,2580,'salvage-crate','heal'],
  ['ravine-barricade-b','rugpull-ravine',3400,2750,'scrap-barricade','ammo'],
  ['crossing-crate-a','liquidity-crossing',5330,2780,'salvage-crate','ammo'],
  ['hashwood-deadfall-a','hashwood',6500,2850,'salvage-crate','heal'],
  ['hashwood-deadfall-b','hashwood',7550,2850,'scrap-barricade','ammo'],
  ['mining-pallet-a','mining-camp',8650,2800,'salvage-crate','heal'],
  ['yard-container-lock','liquidation-yard',10450,2950,'salvage-crate','ammo'],
].map(([id,districtId,x,y,assetId,reward])=>({
  id,districtId,anchor:{x,y},hitPoints:80,visualKind:'destructible-cover',radius:id==='ravine-barricade-b'?24:26,maxZ:48,assetId,
  supply:{x,y:y-55,reward,assetId:reward==='heal'?'bonus-life':'stacked-crates',
    name:reward==='heal'?'Medical supplies':'Ammunition cache',
    lore:reward==='heal'?'Medical supplies recovered.':'Ammunition recovered from the broken cover.'},
})));
export const WORLD_EXPLOSIVE_ZONES=freezeDeep([
  ['crossing-fuel-route','liquidity-crossing',5450,3100,180],
  ['mining-generator-bank','mining-camp',8500,1250,160],
  ['yard-tanker-row','liquidation-yard',10450,3550,200],
].map(([id,districtId,x,y,radius])=>({id,districtId,anchor:{x,y},radius,chainCap:4})));
export const WORLD_FUEL_DRUMS=freezeDeep(WORLD_EXPLOSIVE_ZONES.flatMap(zone=>[[-40,0],[0,-38],[40,0]].map(([dx,dy],i)=>({
  id:`${zone.id}:drum-${i}`,zoneId:zone.id,districtId:zone.districtId,anchor:{x:zone.anchor.x+dx,y:zone.anchor.y+dy},
  hitPoints:25,radius:16,maxZ:40,assetId:'fuel-drum',blastRadius:zone.radius,fuseTicks:36,
}))));
const ordered=[...WORLD_DESTRUCTIBLES,...WORLD_FUEL_DRUMS].sort((a,b)=>a.id.localeCompare(b.id));
const byId=new Map(ordered.map(d=>[d.id,d]));
export const WORLD_DESTRUCTIBLE_BLOCKERS=freezeDeep(ordered.map(d=>({
  id:d.id,districtId:d.districtId,anchor:d.anchor,visualKind:'containers',
  shape:{type:'capsule',a:d.anchor,b:d.anchor,radius:d.radius},maxZ:d.maxZ,combatCover:true,
})));
export const WORLD_DESTRUCTIBLE_PROPS=freezeDeep(ordered.flatMap(d=>[
  {id:`destructible-prop:${d.id}`,assetId:d.assetId,collisionBlockerId:d.id,category:'environment',...d.anchor,scale:.5},
  ...(d.supply?[{id:`destructible-supply:${d.id}`,assetId:d.supply.assetId,category:'pickup',x:d.supply.x,y:d.supply.y,scale:.5}]:[]),
]));
export function createWorldDestructibleState(){return {health:new Map(ordered.map(d=>[d.id,d.hitPoints])),brokenTick:new Map(),collected:new Set(),exploded:new Map(),lastExplosionTick:-1,lastTick:-1,lastNotice:null};}
export function worldDestructibleTargets(state){
  return ordered.filter(d=>state.health.get(d.id)>0).map(d=>({id:d.id,...d.anchor,previousX:d.anchor.x,previousY:d.anchor.y,
    groundZ:0,previousGroundZ:0,radius:d.radius,health:state.health.get(d.id),maxHealth:d.hitPoints,active:true}));
}
export function worldDestructibleHurtProfile(id){
  const d=byId.get(id);return d?{bodyShape:{type:'circle',radius:d.radius},projectileShape:{type:'circle',radius:d.radius},meleeRadius:d.radius,minZ:0,maxZ:d.maxZ}:null;
}
export function worldDestructibleCoverHit({resolution,shot,tick}){
  const contact=resolution.coverHit;
  if(!byId.has(contact?.blockerId)||resolution.hits.some(h=>h.targetId===contact.blockerId))return null;
  return {id:`destructible-cover:${shot.id}`,tick,time:contact.time,targetId:contact.blockerId,sourceId:'player',weaponId:shot.weaponId,
    damage:shot.damage,criticalChance:0,criticalMultiplier:1,direction:{x:shot.vx,y:shot.vy},knockback:0,point:contact.point};
}
export function applyWorldDestructibleDamage(state,{targets,tick}){
  const events=[];
  for(const d of ordered){
    if(state.health.get(d.id)<=0||!targets[d.id])continue;
    const health=Math.max(0,Math.min(state.health.get(d.id),targets[d.id].health));
    state.health.set(d.id,health);
    if(health===0){state.brokenTick.set(d.id,tick);events.push({id:d.id,tick,anchor:d.anchor,supply:d.supply,blastRadius:d.blastRadius});}
  }
  return events;
}
export function worldDestructibleHiddenProps(state){
  const hidden=new Set();
  for(const d of ordered){
    if(d.blastRadius){if(state.exploded.has(d.id))hidden.add(`destructible-prop:${d.id}`);continue;}
    if(state.health.get(d.id)>0)hidden.add(`destructible-supply:${d.id}`);
    else hidden.add(`destructible-prop:${d.id}`);
    if(state.collected.has(d.id))hidden.add(`destructible-supply:${d.id}`);
  }
  return hidden;
}
export function stepWorldDestructibleSupplies(state,{tick,player,queryGround,lineClear}){
  if(!Number.isInteger(tick)||tick<=state.lastTick)throw new TypeError('supply ticks must be monotonic');
  state.lastTick=tick;const events=[];
  for(const d of ordered){
    const s=d.supply;
    if(!s||state.health.get(d.id)>0||state.collected.has(d.id)||Math.hypot(player.x-s.x,player.y-s.y)>45
      ||Math.abs(player.groundZ-queryGround(s.x,s.y).groundZ)>8||!lineClear(player,{...s,groundZ:0}))continue;
    state.collected.add(d.id);state.lastNotice={text:s.lore,tick};events.push({id:d.id,...s,tick});
  }
  return events;
}
