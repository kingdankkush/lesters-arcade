import { applyWeaponProgression, HMH_WEAPON_DEFINITIONS } from './weapon-system.mjs';

export function canAcceptCollectible(effect,{health,maxHealth,grenades,maxGrenades,loadout,progressionByWeapon={}}) {
  if (effect.kind==='heal') return health < maxHealth;
  if (effect.kind==='grenade-supply') return grenades < maxGrenades;
  const needsAmmo=id=>{
    const weapon=loadout?.weapons[id];
    if (!weapon?.owned) return false;
    const policy=applyWeaponProgression(id,progressionByWeapon[id]);
    const reserve=policy.reserveAmmoGrant ?? HMH_WEAPON_DEFINITIONS[id].pickupReserveAmmo;
    return weapon.ammoInClip < policy.clipSize || (reserve !== null && weapon.reserveAmmo < reserve*2)
      || (effect.kind==='ammo-refill' && weapon.heat > 0);
  };
  if (effect.kind==='weapon-cache') return !loadout?.weapons[effect.weaponId]?.owned || needsAmmo(effect.weaponId);
  if (effect.kind==='ammo-refill') return Object.keys(loadout?.weapons??{}).some(needsAmmo);
  return true;
}
