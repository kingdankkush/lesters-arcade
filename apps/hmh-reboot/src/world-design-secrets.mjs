import { freezeDeep } from './value-guards.mjs';

export const WORLD_DESIGN_SECRETS = freezeDeep([
  {id:'farmstead-hidden-supplies',name:'Boarded supply chest',x:370,y:3270,groundZ:0,sealId:'farmstead-cache-seal',reward:'ammo',assetId:'stacked-crates',lore:'The relay keepers left supplies behind the farmstead gate.'},
  {id:'ravine-surveyor-cache',name:'Surveyor’s ledge cache',x:3150,y:1460,groundZ:64,reward:'heal',assetId:'bonus-life',lore:'The surveyors marked the safe descent on the south edge of this overlook.'},
  {id:'warehouse-logbook',name:'Warehouse logbook',x:10530,y:3760,groundZ:0,assetId:'faction-banner',lore:'The river swallowed the old road. The pump crew kept the eastern passage open.'},
]);
export const WORLD_DESIGN_SECRET_SEAL = freezeDeep({id:'farmstead-cache-seal',districtId:'frontier-relay',anchor:{x:370,y:3270},visualKind:'containers',shape:{type:'capsule',a:{x:370,y:3270},b:{x:370,y:3270},radius:20},maxZ:40,combatCover:true});
export function worldDesignSecretCoverHit({resolution,shot,tick}) {
  const contact=resolution.coverHit;
  if(contact?.blockerId!==WORLD_DESIGN_SECRET_SEAL.id || resolution.hits.some(h=>h.targetId===WORLD_DESIGN_SECRET_SEAL.id))return null;
  return {id:`secret-cover:${shot.id}`,tick,time:contact.time,targetId:WORLD_DESIGN_SECRET_SEAL.id,sourceId:'player',weaponId:shot.weaponId,damage:shot.damage,criticalChance:0,criticalMultiplier:1,direction:{x:shot.vx,y:shot.vy},knockback:0,point:contact.point};
}
export const WORLD_DESIGN_SECRET_PROPS = freezeDeep([
  {id:'secret-seal-prop',assetId:'salvage-crate',collisionBlockerId:WORLD_DESIGN_SECRET_SEAL.id,category:'environment',x:370,y:3270,scale:.5},
  ...WORLD_DESIGN_SECRETS.map(s=>({id:`secret-prop:${s.id}`,assetId:s.assetId,category:s.reward?'pickup':'environment',x:s.x,y:s.y,scale:s.reward?.5:.4})),
]);
export function createWorldDesignSecretState(){return {sealHealth:60,collected:new Set(),lastTick:-1,lastNotice:null};}
export function worldDesignSecretTargets(state){
 if(state.sealHealth<=0)return [];
 return [{id:WORLD_DESIGN_SECRET_SEAL.id,x:370,y:3270,previousX:370,previousY:3270,groundZ:0,previousGroundZ:0,radius:20,health:state.sealHealth,maxHealth:60,active:true}];
}
export function worldDesignHiddenSecretProps(state){
 const hidden=new Set();
 if(state.sealHealth>0)hidden.add('secret-prop:farmstead-hidden-supplies');else hidden.add('secret-seal-prop');
 for(const id of state.collected)if(id!=='warehouse-logbook')hidden.add(`secret-prop:${id}`);
 return hidden;
}
export function stepWorldDesignSecrets(state,{tick,player,queryGround,lineClear}){
 if(!Number.isInteger(tick)||tick<=state.lastTick)throw new TypeError('secret ticks must be monotonic');
 state.lastTick=tick;const events=[];
 for(const s of WORLD_DESIGN_SECRETS){
  if(state.collected.has(s.id)||(s.sealId&&state.sealHealth>0))continue;
  if(Math.hypot(player.x-s.x,player.y-s.y)>45||Math.abs(player.groundZ-queryGround(s.x,s.y).groundZ)>8||!lineClear(player,s))continue;
  state.collected.add(s.id);state.lastNotice={text:s.lore,tick};events.push({id:s.id,name:s.name,reward:s.reward??null,lore:s.lore,tick});
 }
 return events;
}
