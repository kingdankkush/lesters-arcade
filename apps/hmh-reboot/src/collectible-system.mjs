import { freezeDeep } from './value-guards.mjs';
import { collectibleIsAvailable } from './objective-rewards.mjs';
const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function validTick(value) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError('tick must be a non-negative integer');
  return value;
}

function finitePoint(point, name) {
  if (![point?.x, point?.y].every(Number.isFinite)) throw new TypeError(`${name} must contain finite x and y`);
  return point;
}

export const COLLECTIBLE_EFFECTS = freezeDeep({
  'bonus-life': { effectId: 'bonus-life', kind: 'heal', amount: 30 },
  'coin-blaster': { effectId: 'coin-blaster-cache', kind: 'weapon-cache', weaponId: 'coin-blaster' },
  'scatter-shotgun': { effectId: 'scatter-shotgun-cache', kind: 'weapon-cache', weaponId: 'scatter-shotgun' },
  'auto-miner': { effectId: 'auto-miner-cache', kind: 'weapon-cache', weaponId: 'auto-miner' },
  'launcher-rig': { effectId: 'launcher-rig-cache', kind: 'weapon-cache', weaponId: 'launcher-rig' },
  'hash-rail-core': { effectId: 'hash-rail-core', kind: 'weapon-cache', weaponId: 'hash-rail', xpGain: 160 },
  'lightning-ledger-cache': { effectId: 'lightning-ledger-cache', kind: 'weapon-cache', weaponId: 'lightning-ledger', xpGain: 220 },
  'bear-market-burner-cache': { effectId: 'bear-market-burner-cache', kind: 'weapon-cache', weaponId: 'bear-market-burner', xpGain: 260 },
  'forked-standard-cache': { effectId: 'forked-standard-cache', kind: 'weapon-cache', weaponId: 'forked-standard', xpGain: 240 },
  'time-dilation': { effectId: 'time-dilation', kind: 'timed', durationTicks: 600, speedMultiplier: 1.2 },
  'berserk-candle': { effectId: 'berserk-candle', kind: 'timed', durationTicks: 600, damageMultiplier: 2 },
  'nuke-liquidation': { effectId: 'nuke-liquidation', kind: 'nuke', damage: 999 },
});

export function createCollectibleState({ placements, objectivePlacements = [], collectionRadius = 80 } = {}) {
  if (!Array.isArray(placements) || placements.length < 10 || placements.length > 13) throw new TypeError('ten authored placements and at most three scheduled rare placements are required');
  if (!Number.isFinite(collectionRadius) || collectionRadius <= 0) throw new TypeError('collectionRadius must be positive');
  if (!Array.isArray(objectivePlacements) || objectivePlacements.length > 7 || objectivePlacements.some(p=>!p.requiredObjective)) throw new TypeError('at most seven objective rewards are allowed');
  const ids = new Set();
  const entries = [...placements,...objectivePlacements].map((placement) => {
    if (!placement?.id || ids.has(placement.id)) throw new TypeError(`invalid or duplicate collectible ${String(placement?.id)}`);
    ids.add(placement.id);
    finitePoint(placement, `collectible ${placement.id}`);
    const baseEffect = COLLECTIBLE_EFFECTS[placement.assetId];
    const effect = baseEffect && Object.freeze({...baseEffect,...(placement.requiredObjective ? {xpGain:0,...(placement.kind ? {kind:placement.kind} : {})} : {})});
    if (!effect) throw new TypeError(`unsupported collectible asset ${String(placement.assetId)}`);
    const availableTick = placement.availableTick ?? 0;
    if (!Number.isInteger(availableTick) || availableTick < 0 || availableTick > 32_400) throw new TypeError('collectible availableTick must be within the first nine minutes');
    if (placement.respawnTicks !== undefined && ![7200,10800].includes(placement.respawnTicks)) throw new TypeError('respawn must be 120 or 180 simulation seconds');
    return Object.freeze({ placement: Object.freeze({ ...placement, availableTick }), effect });
  }).sort((left, right) => lexical(left.placement.id, right.placement.id));
  return {
    entries: Object.freeze(entries),
    collectionRadius,
    collectedIds: new Set(),
    unlockedObjectives: new Set(),
    collectionCounts: new Map(),
    readyTicks: new Map(),
    activeEffects: new Map(),
    sequence: 0,
    lastTick: -1,
  };
}

export function getCollectibleSnapshot(state, { tick } = {}) {
  validTick(tick);
  let readyCount=0,cooldownCount=0,lockedCount=0;
  for(const {placement} of state.entries){
    if(collectibleIsAvailable(state,placement,tick))readyCount++;
    if(state.readyTicks.has(placement.id)&&tick<state.readyTicks.get(placement.id))cooldownCount++;
    if(placement.requiredObjective&&!state.unlockedObjectives.has(placement.requiredObjective))lockedCount++;
  }
  const activeEffects = [...state.activeEffects.values()]
    .filter((effect) => tick < effect.expiresTick)
    .sort((left, right) => lexical(left.effectId, right.effectId))
    .map((effect) => freezeDeep({ ...effect }));
  return freezeDeep({
    tick,
    collectedCount: state.collectedIds.size,
    remainingCount: state.entries.length - state.collectedIds.size,
    readyCount,
    cooldownCount,
    lockedCount,
    collectedIds: [...state.collectedIds].sort(),
    activeEffects,
    damageMultiplier: activeEffects.some((effect) => effect.effectId === 'berserk-candle') ? 2 : 1,
    speedMultiplier: activeEffects.some((effect) => effect.effectId === 'time-dilation') ? 1.2 : 1,
  });
}

export function stepCollectibles(state, { tick, player, canCollect = () => true, canReach = () => true } = {}) {
  validTick(tick);
  finitePoint(player, 'player');
  if (tick <= state.lastTick) throw new TypeError('collectible tick must be monotonic');
  state.lastTick = tick;
  const events = [];
  for (const [effectId, active] of [...state.activeEffects.entries()].sort(([left], [right]) => lexical(left, right))) {
    if (tick < active.expiresTick) continue;
    state.activeEffects.delete(effectId);
    events.push(freezeDeep({
      id: `collectible-event:${String(state.sequence).padStart(6, '0')}`,
      type: 'collectible:expired',
      tick,
      effectId,
    }));
    state.sequence += 1;
  }
  for (const entry of state.entries) {
    const placement = entry.placement;
    if (!collectibleIsAvailable(state, placement, tick)) continue;
    if (Math.hypot(player.x - placement.x, player.y - placement.y) > state.collectionRadius) continue;
    if (!canCollect(entry.effect, placement) || !canReach(placement)) continue;
    state.collectedIds.add(placement.id);
    const collectionCount=(state.collectionCounts.get(placement.id)??0)+1;
    state.collectionCounts.set(placement.id,collectionCount);
    if (placement.respawnTicks) state.readyTicks.set(placement.id,tick+placement.respawnTicks);
    const effect = entry.effect;
    const event = {
      id: `collectible-event:${String(state.sequence).padStart(6, '0')}`,
      type: 'collectible:collected',
      tick,
      placementId: placement.id,
      pointOfInterestId: placement.pointOfInterestId,
      assetId: placement.assetId,
      availableTick: placement.availableTick,
      effectId: effect.effectId,
      kind: effect.kind,
      ...effect,
      ...(collectionCount > 1 ? {xpGain:0} : {}),
    };
    state.sequence += 1;
    if (effect.kind === 'timed') {
      // Timed effects never stack multiplicatively. A second authored pickup
      // restarts the same bounded 600-tick window and exposes that refresh in
      // deterministic telemetry so balance audits can distinguish first
      // activation from extension without reading presentation state.
      const previous = state.activeEffects.get(effect.effectId) ?? null;
      const active = freezeDeep({
        effectId: effect.effectId,
        collectedTick: tick,
        expiresTick: tick + effect.durationTicks,
        damageMultiplier: effect.damageMultiplier ?? 1,
        speedMultiplier: effect.speedMultiplier ?? 1,
        refreshCount: (previous?.refreshCount ?? 0) + Number(previous !== null),
      });
      state.activeEffects.set(effect.effectId, active);
      event.expiresTick = active.expiresTick;
      event.refreshed = previous !== null;
      event.previousExpiresTick = previous?.expiresTick ?? null;
      event.refreshCount = active.refreshCount;
    }
    events.push(freezeDeep(event));
  }
  return freezeDeep({ tick, events, snapshot: getCollectibleSnapshot(state, { tick }) });
}
