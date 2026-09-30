// 2.0 preference migration. The store applies this plan to exact retired picks.
// It removes selections only, never earned records, ownership or hero gates.
// Keep the inventory explicit: future catalog additions must not be retired.
const group=(gameId,slot,ids)=>ids.map(id=>Object.freeze({gameId,slot,id}));
export const RETIRED_COSMETICS_2_0=Object.freeze([
 ...group('lester-blaster','hero-skin',['hmh-hero-silver','hmh-hero-neon','hmh-hero-gold','hmh-hero-crimson']),
 ...group('lester-blaster','weapon-skin',['hmh-weapon-hashstorm','hmh-weapon-amber','hmh-weapon-seafoam','hmh-weapon-veteran']),
 ...group('chikun','coat',['chikun-coat-golden','chikun-coat-glacier','chikun-coat-emerald','chikun-coat-royal']),
 ...group('chikun','trail',['chikun-trail-gold','chikun-trail-neon','chikun-trail-ember']),
 ...group('chikun','hat',['chikun-hat-cap','chikun-hat-top','chikun-hat-crown']),
 ...group('stacked','piece-skin',['stacked-pieces-silver','stacked-pieces-sunset','stacked-pieces-seafoam','stacked-pieces-gold']),
 ...group('stacked','scene',['stacked-scene-noir','stacked-scene-sunset','stacked-scene-forge']),
]);
const record=value=>Boolean(value)&&typeof value==='object'
 &&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);

// Input: an already-read JSON preferences object, not a whole profile. Return a
// detached copy and an ordered change list; the caller decides whether to save.
// This is deliberately not a sanitizer/ownership check. Unknown fields survive.
// A later integration must merge the freshest wallet copy and concurrent picks.
export function planCosmeticRetirement(input) {
 if(!record(input))throw new TypeError('Expected JSON preferences object');
 const preferences=structuredClone(input),removed=[];
 if(record(preferences.cosmetics)){
  const cosmetics=preferences.cosmetics;
  for(const item of RETIRED_COSMETICS_2_0){
   if(!Object.hasOwn(cosmetics,item.gameId))continue;
   const slots=cosmetics[item.gameId];
   if(!record(slots)||!Object.hasOwn(slots,item.slot)||slots[item.slot]!==item.id)continue;
   delete slots[item.slot];removed.push(item);
   if(Object.keys(slots).length===0)delete cosmetics[item.gameId];
  }
  // Retain cosmetics:{} after clearing the final slot. Omitting the key would
  // leave stale picks in the server's top-level JSON preferences merge.
 }
 return {preferences,changed:removed.length>0,removed:Object.freeze(removed)};
}
