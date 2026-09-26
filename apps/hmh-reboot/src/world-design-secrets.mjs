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
// The seal's health, discovery and rewards live in mission-objectives.mjs
// (design package S1.4): break the seal or pry it, then enter the volume.
