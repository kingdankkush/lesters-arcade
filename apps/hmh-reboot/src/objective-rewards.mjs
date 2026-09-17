import { freezeDeep } from './value-guards.mjs';

export const SUPPLY_NAMES=Object.freeze({'coin-blaster':'Pistol','scatter-shotgun':'Shotgun','auto-miner':'Machine Gun','launcher-rig':'Grenade Launcher','time-dilation':'Speed Boost','berserk-candle':'Double Damage'});

// First-clear weapons have no score/XP grant. Supply clocks use simulation
// ticks, so pausing never restocks a site and restarting creates a fresh run.
// Havens restock in 120 s; the trap's power-up in 180 s. A site may own more
// than one cache, but every cache has exactly one owning objective.
export const OBJECTIVE_REWARDS = freezeDeep([
  { id:'reward:relay-reserve', objectiveId:'relay-power', name:'Silver Reserve', task:'Start the farmstead generator, then enter the supply court.', rewardName:'Shotgun', assetId:'scatter-shotgun', x:340, y:3310 },
  { id:'reward:ravine-salvage', objectiveId:'ravine-winch', name:'Quarry Salvage', task:'Start the winch and enter the salvage court.', rewardName:'Railgun', assetId:'hash-rail-core', x:2990, y:2580 },
  { id:'reward:crossing-supply', objectiveId:'crossing-pump', name:'Liquidity Haven', task:'Start the reservoir pump, then enter the haven east of it.', rewardName:'Ammo refill', assetId:'coin-blaster', kind:'ammo-refill', x:6040, y:4285, respawnTicks:7200 },
  { id:'reward:hashwood-sanctuary', objectiveId:'hashwood-shrine', name:'Litecoin Sanctuary', task:'Activate the woodland sanctuary, then enter the haven west of it.', rewardName:'Health +30', assetId:'bonus-life', x:7120, y:3450, respawnTicks:7200 },
  { id:'reward:hashwood-scrypt', objectiveId:'hashwood-shrine', name:'Scrypt Cache', task:'Activate the woodland sanctuary, then enter the haven west of it.', rewardName:'Grenade +1', assetId:'nuke-liquidation', kind:'grenade-supply', x:7180, y:3450, respawnTicks:7200 },
  { id:'reward:mining-trap', objectiveId:'mining-valve', name:'Liquidation Trap', task:'Release the pressure valve, wait out the steam, then enter the court north of it.', rewardName:'Double Damage', assetId:'berserk-candle', x:9300, y:2790, respawnTicks:10800 },
  { id:'reward:warehouse-reserve', objectiveId:'yard-warehouse', name:'Warehouse Reserve', task:'Open the warehouse service court.', rewardName:'Flamethrower', assetId:'bear-market-burner-cache', x:10490, y:3680 },
  { id:'reward:liquidator-vault', objectiveId:'liquidator-defeated', name:'Liquidator Vault', task:'Defeat the Liquidator to release the vault.', rewardName:'Arc Rifle', assetId:'lightning-ledger-cache', x:11350, y:3400 },
]);

export function objectiveRewardPlacements() {
  return OBJECTIVE_REWARDS.map(r=>Object.freeze({...r,category:'point-of-interest',pointOfInterestId:r.objectiveId,requiredObjective:r.objectiveId,availableTick:0,scale:.7,xpGain:0}));
}

export function objectiveRewardStatus(state, id, tick) {
  const reward=objectiveRewardState(state,id,{tick,discovered:true});
  if (reward.state==='cooldown') return `restocks in ${Math.ceil(reward.remainingTicks/60)}s`;
  if (reward.state==='collected') return 'collected';
  return reward.complete ? 'reward available' : 'locked';
}

// Derive the presentation from canonical completion and collection records.
// Discovery never unlocks a reward, and a repeated completion event cannot
// reset a collection or shorten its cooldown.
export function objectiveRewardState(state,id,{tick,discovered=false,activating=new Map()}={}) {
  if (!Number.isSafeInteger(tick)||tick<0) throw new TypeError('bounded objective tick required');
  const entry=state?.entries.find(e=>e.placement.id===id);
  const complete=Boolean(entry&&state.unlockedObjectives.has(entry.placement.requiredObjective));
  const collections=state?.collectionCounts.get(id)??0;
  const readyTick=state?.readyTicks.get(id)??null;
  const remainingTicks=complete&&readyTick!==null?Math.max(0,readyTick-tick):0;
  let phase='undiscovered';
  if (complete) phase=remainingTicks>0?'cooldown':collections&&!entry.placement.respawnTicks?'collected':'reward-available';
  else if (entry&&activating.has(entry.placement.requiredObjective)) phase='active';
  else if (discovered&&entry) phase='discovered';
  return Object.freeze({state:phase,complete,readyTick,remainingTicks,collections});
}

export function collectibleIsAvailable(state, placement, tick) {
  return (!placement.requiredObjective || state.unlockedObjectives.has(placement.requiredObjective))
    && tick >= placement.availableTick
    && (!state.collectedIds.has(placement.id) || (placement.respawnTicks > 0 && tick >= state.readyTicks.get(placement.id)));
}

export function hiddenCollectibleIds(state,tick) {
  return new Set((state?.entries??[]).filter(e=>!collectibleIsAvailable(state,e.placement,tick)).map(e=>e.placement.id));
}
