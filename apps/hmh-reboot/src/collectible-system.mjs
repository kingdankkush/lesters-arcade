function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

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
  'hash-rail-core': { effectId: 'hash-rail-core', kind: 'ammo-refill' },
  'time-dilation': { effectId: 'time-dilation', kind: 'timed', durationTicks: 600, speedMultiplier: 1.2 },
  'berserk-candle': { effectId: 'berserk-candle', kind: 'timed', durationTicks: 600, damageMultiplier: 2 },
  'nuke-liquidation': { effectId: 'nuke-liquidation', kind: 'nuke', damage: 999 },
});

export function createCollectibleState({ placements, collectionRadius = 80 } = {}) {
  if (!Array.isArray(placements) || placements.length !== 9) throw new TypeError('nine authored collectible placements are required');
  if (!Number.isFinite(collectionRadius) || collectionRadius <= 0) throw new TypeError('collectionRadius must be positive');
  const ids = new Set();
  const entries = placements.map((placement) => {
    if (!placement?.id || ids.has(placement.id)) throw new TypeError(`invalid or duplicate collectible ${String(placement?.id)}`);
    ids.add(placement.id);
    finitePoint(placement, `collectible ${placement.id}`);
    const effect = COLLECTIBLE_EFFECTS[placement.assetId];
    if (!effect) throw new TypeError(`unsupported collectible asset ${String(placement.assetId)}`);
    return Object.freeze({ placement, effect });
  }).sort((left, right) => left.placement.id.localeCompare(right.placement.id));
  return {
    entries: Object.freeze(entries),
    collectionRadius,
    collectedIds: new Set(),
    activeEffects: new Map(),
    sequence: 0,
    lastTick: -1,
  };
}

export function getCollectibleSnapshot(state, { tick } = {}) {
  validTick(tick);
  const activeEffects = [...state.activeEffects.values()]
    .filter((effect) => tick < effect.expiresTick)
    .sort((left, right) => left.effectId.localeCompare(right.effectId))
    .map((effect) => freezeDeep({ ...effect }));
  return freezeDeep({
    tick,
    collectedCount: state.collectedIds.size,
    remainingCount: state.entries.length - state.collectedIds.size,
    collectedIds: [...state.collectedIds].sort(),
    activeEffects,
    damageMultiplier: activeEffects.some((effect) => effect.effectId === 'berserk-candle') ? 2 : 1,
    speedMultiplier: activeEffects.some((effect) => effect.effectId === 'time-dilation') ? 1.2 : 1,
  });
}

export function stepCollectibles(state, { tick, player } = {}) {
  validTick(tick);
  finitePoint(player, 'player');
  if (tick <= state.lastTick) throw new TypeError('collectible tick must be monotonic');
  state.lastTick = tick;
  const events = [];
  for (const [effectId, active] of [...state.activeEffects.entries()].sort(([left], [right]) => left.localeCompare(right))) {
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
    if (state.collectedIds.has(placement.id)) continue;
    if (Math.hypot(player.x - placement.x, player.y - placement.y) > state.collectionRadius) continue;
    state.collectedIds.add(placement.id);
    const effect = entry.effect;
    const event = {
      id: `collectible-event:${String(state.sequence).padStart(6, '0')}`,
      type: 'collectible:collected',
      tick,
      placementId: placement.id,
      pointOfInterestId: placement.pointOfInterestId,
      assetId: placement.assetId,
      effectId: effect.effectId,
      kind: effect.kind,
      ...effect,
    };
    state.sequence += 1;
    if (effect.kind === 'timed') {
      const active = freezeDeep({
        effectId: effect.effectId,
        collectedTick: tick,
        expiresTick: tick + effect.durationTicks,
        damageMultiplier: effect.damageMultiplier ?? 1,
        speedMultiplier: effect.speedMultiplier ?? 1,
      });
      state.activeEffects.set(effect.effectId, active);
      event.expiresTick = active.expiresTick;
    }
    events.push(freezeDeep(event));
  }
  return freezeDeep({ tick, events, snapshot: getCollectibleSnapshot(state, { tick }) });
}
