import { freezeDeep } from './value-guards.mjs';

export const BEAR_MARKET_BURNER_CONFIG = freezeDeep({
  pulseIntervalTicks: 6,
  tankCapacity: 1_200,
  reserveFuel: 2_400,
  fuelPerTick: 5,
  swapTicks: 120,
  emptyCooldownTicks: 30,
  range: 360,
  halfAngleDegrees: 25,
  directDamage: 4,
  burnDamage: 2,
  burnTickInterval: 30,
  burnDurationTicks: 180,
  bossBurnDurationTicks: 120,
  maxContactsPerPulse: 12,
  maxActiveBurns: 64,
  maxScorchZones: 8,
  maxSpreadIgnitionsPerTick: 4,
  scorchRadius: 84,
  scorchDurationTicks: 240,
  scorchHazardCost: 18,
});

const tier = (value, label) => {
  const resolved = value ?? 0;
  if (!Number.isInteger(resolved) || resolved < 0 || resolved > 3) throw new TypeError(`${label} tier must be an integer from zero to three`);
  return resolved;
};

export function resolveBearMarketBurnerPolicy({ branches = {}, capstoneId = null } = {}) {
  const liquidity = tier(branches.liquidity, 'liquidity');
  const volatility = tier(branches.volatility, 'volatility');
  const contagion = tier(branches.contagion, 'contagion');
  if (capstoneId !== null && capstoneId !== 'total-selloff') throw new TypeError('unsupported Bear Market Burner capstone');
  if (capstoneId && [liquidity, volatility, contagion].some((value) => value < 3)) throw new TypeError('Total Selloff requires all three tier-three branches');
  return freezeDeep({
    liquidity,
    volatility,
    contagion,
    tankCapacity: BEAR_MARKET_BURNER_CONFIG.tankCapacity + (liquidity >= 1 ? 300 : 0),
    reserveFuel: BEAR_MARKET_BURNER_CONFIG.reserveFuel + liquidity * 300,
    fuelPerTick: liquidity >= 2 ? 4 : BEAR_MARKET_BURNER_CONFIG.fuelPerTick,
    swapTicks: liquidity >= 2 ? 90 : BEAR_MARKET_BURNER_CONFIG.swapTicks,
    emergencyRefill: liquidity >= 3,
    emergencyRefillFuel: liquidity >= 3 ? 300 : 0,
    directDamage: BEAR_MARKET_BURNER_CONFIG.directDamage + (volatility >= 1 ? 1 : 0),
    burnDamage: BEAR_MARKET_BURNER_CONFIG.burnDamage,
    burnDurationTicks: BEAR_MARKET_BURNER_CONFIG.burnDurationTicks + (volatility >= 2 ? 90 : 0),
    bossBurnDurationTicks: BEAR_MARKET_BURNER_CONFIG.bossBurnDurationTicks,
    maxSpreadIgnitions: volatility >= 3 ? 2 : 0,
    halfAngleDegrees: BEAR_MARKET_BURNER_CONFIG.halfAngleDegrees + (contagion >= 1 ? 8 : 0),
    range: BEAR_MARKET_BURNER_CONFIG.range + (contagion >= 2 ? 90 : 0),
    edgeDamagePermille: contagion >= 2 ? 800 : 650,
    scorchEnabled: contagion >= 3,
    totalSelloffThresholdFuel: capstoneId ? 300 : 0,
    totalSelloffPressurePermille: capstoneId ? 1250 : 1000,
    totalSelloffCooldownTicks: capstoneId ? 90 : 0,
  });
}

const DEFAULT_POLICY = resolveBearMarketBurnerPolicy();
const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const finite = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
};
const point = (value, label) => ({ x: finite(value?.x, `${label}.x`), y: finite(value?.y, `${label}.y`) });
const normalizedDirection = (value) => {
  const direction = point(value, 'direction');
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude <= 0) throw new TypeError('direction must have magnitude');
  return { x: direction.x / magnitude, y: direction.y / magnitude };
};

export function createBearMarketBurnerState({ fuel = BEAR_MARKET_BURNER_CONFIG.tankCapacity, reserveFuel = BEAR_MARKET_BURNER_CONFIG.reserveFuel } = {}) {
  if (!Number.isInteger(fuel) || fuel < 0 || fuel > 100_000 || !Number.isInteger(reserveFuel) || reserveFuel < 0 || reserveFuel > 100_000) throw new TypeError('fuel values must be bounded integers');
  return {
    fuel,
    reserveFuel,
    burns: new Map(),
    contactTicks: new Map(),
    scorchZones: [],
    lastPulseTick: 0,
    lastTick: -1,
    cooldownReadyTick: 0,
    swapReadyTick: null,
    fuelSpent: 0,
    channelFuelSpent: 0,
    emergencyRefillUsed: false,
    emptySignaled: false,
    scorchSequence: 0,
    pulses: 0,
  };
}

const burnSnapshot = (burn) => freezeDeep({ ...burn, stacks: 1 });
export function getBearMarketBurnerSnapshot(state) {
  if (!state || !(state.burns instanceof Map) || !Array.isArray(state.scorchZones)) throw new TypeError('Bear Market Burner state is required');
  return freezeDeep({
    fuel: state.fuel,
    reserveFuel: state.reserveFuel,
    burns: [...state.burns.values()].sort((a, b) => lexical(a.targetId, b.targetId)).map(burnSnapshot),
    contactTicks: [...state.contactTicks.entries()].sort(([a], [b]) => lexical(a, b)).map(([targetId, ticks]) => ({ targetId, ticks })),
    scorchZones: [...state.scorchZones].sort((a, b) => a.createdTick - b.createdTick || lexical(a.id, b.id)).map((zone) => ({ ...zone })),
    lastPulseTick: state.lastPulseTick,
    lastTick: state.lastTick,
    cooldownReadyTick: state.cooldownReadyTick,
    swapReadyTick: state.swapReadyTick,
    fuelSpent: state.fuelSpent,
    channelFuelSpent: state.channelFuelSpent,
    emergencyRefillUsed: state.emergencyRefillUsed,
    emptySignaled: state.emptySignaled,
    scorchSequence: state.scorchSequence,
    pulses: state.pulses,
  });
}

export function resetBearMarketBurnerState(state) {
  if (!state || !(state.burns instanceof Map)) throw new TypeError('Bear Market Burner state is required');
  Object.assign(state, createBearMarketBurnerState());
  return getBearMarketBurnerSnapshot(state);
}

function pulseContacts({ origin, direction, targets, lineOfSight, policy }) {
  if (!Array.isArray(targets) || targets.length > 256 || typeof lineOfSight !== 'function') throw new TypeError('bounded targets and lineOfSight are required');
  const ids = new Set();
  const cosineLimit = Math.cos(policy.halfAngleDegrees * Math.PI / 180);
  const contacts = [];
  for (const target of targets) {
    if (target?.active === false) continue;
    if (!target || typeof target.id !== 'string' || target.id.length === 0 || ids.has(target.id)) throw new TypeError('active targets require unique IDs');
    ids.add(target.id);
    const targetPoint = point(target, `target ${target.id}`);
    const dx = targetPoint.x - origin.x;
    const dy = targetPoint.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0 || distance > policy.range) continue;
    const cosine = (dx * direction.x + dy * direction.y) / distance;
    if (cosine < cosineLimit || !lineOfSight(origin, target)) continue;
    const edge = Math.max(0, Math.min(1, (cosine - cosineLimit) / Math.max(1e-9, 1 - cosineLimit)));
    const damagePermille = Math.round(policy.edgeDamagePermille + (1000 - policy.edgeDamagePermille) * edge);
    contacts.push({ targetId: target.id, boss: target.boss === true, x: targetPoint.x, y: targetPoint.y, distance, damagePermille });
  }
  return contacts
    .sort((a, b) => a.distance - b.distance || lexical(a.targetId, b.targetId))
    .slice(0, BEAR_MARKET_BURNER_CONFIG.maxContactsPerPulse);
}

function refreshBurn(state, contact, tick, policy) {
  const duration = contact.boss ? policy.bossBurnDurationTicks : policy.burnDurationTicks;
  const existing = state.burns.get(contact.targetId);
  if (!existing && state.burns.size >= BEAR_MARKET_BURNER_CONFIG.maxActiveBurns) return false;
  state.burns.set(contact.targetId, {
    targetId: contact.targetId,
    boss: contact.boss,
    appliedTick: existing?.appliedTick ?? tick,
    refreshedTick: tick,
    expiresTick: tick + duration,
    nextDamageTick: existing?.nextDamageTick ?? tick + BEAR_MARKET_BURNER_CONFIG.burnTickInterval,
    damage: policy.burnDamage,
  });
  return true;
}

export function addBearMarketBurnerScorch(state, { tick, x, y, sourceTargetId = '' } = {}) {
  if (!state || !Array.isArray(state.scorchZones)) throw new TypeError('Bear Market Burner state is required');
  if (!Number.isInteger(tick) || tick < 0 || typeof sourceTargetId !== 'string') throw new TypeError('valid scorch identity is required');
  const zone = freezeDeep({
    id: `burner-scorch-${String(state.scorchSequence).padStart(4, '0')}`,
    createdTick: tick,
    expiresTick: tick + BEAR_MARKET_BURNER_CONFIG.scorchDurationTicks,
    x: finite(x, 'scorch x'),
    y: finite(y, 'scorch y'),
    radius: BEAR_MARKET_BURNER_CONFIG.scorchRadius,
    sourceTargetId,
  });
  state.scorchSequence += 1;
  state.scorchZones.push(zone);
  state.scorchZones.sort((a, b) => a.createdTick - b.createdTick || lexical(a.id, b.id));
  while (state.scorchZones.length > BEAR_MARKET_BURNER_CONFIG.maxScorchZones) state.scorchZones.shift();
  return zone;
}

export function bearMarketBurnerHazardCostAt(zones, location) {
  if (!Array.isArray(zones) || zones.length > BEAR_MARKET_BURNER_CONFIG.maxScorchZones) throw new TypeError('bounded scorch zones are required');
  const position = point(location, 'hazard location');
  return zones.some((zone) => Math.hypot(position.x - zone.x, position.y - zone.y) <= zone.radius)
    ? BEAR_MARKET_BURNER_CONFIG.scorchHazardCost
    : 0;
}

export function beginBearMarketBurnerCanisterSwap(state, { tick, policy = DEFAULT_POLICY } = {}) {
  if (!state || !(state.burns instanceof Map) || !Number.isInteger(tick) || tick < 0) throw new TypeError('state and tick are required');
  if (state.swapReadyTick !== null || state.reserveFuel <= 0 || state.fuel >= policy.tankCapacity) throw new Error('canister swap unavailable');
  state.swapReadyTick = tick + policy.swapTicks;
  return freezeDeep({ type: 'burner:swap-start', tick, readyTick: state.swapReadyTick });
}

export function completeBearMarketBurnerCanisterSwap(state, { tick, policy = DEFAULT_POLICY } = {}) {
  if (!state || !Number.isInteger(tick) || state.swapReadyTick === null || tick < state.swapReadyTick) throw new Error('canister swap is not ready');
  const transferred = Math.min(policy.tankCapacity - state.fuel, state.reserveFuel);
  state.fuel += transferred;
  state.reserveFuel -= transferred;
  state.swapReadyTick = null;
  state.emptySignaled = false;
  state.channelFuelSpent = 0;
  return freezeDeep({ type: 'burner:swap-complete', tick, transferred, fuel: state.fuel, reserveFuel: state.reserveFuel });
}

export function spreadBearMarketBurnerOnDefeat(state, {
  tick, source, nearbyTargets = [], lineOfSight = () => true, policy = DEFAULT_POLICY,
} = {}) {
  if (!state || !(state.burns instanceof Map) || !Number.isInteger(tick) || tick < 0) throw new TypeError('state and tick are required');
  const origin = point(source, 'defeated source');
  if (!Array.isArray(nearbyTargets) || nearbyTargets.length > 128 || typeof lineOfSight !== 'function') throw new TypeError('bounded spread targets and lineOfSight are required');
  if (policy.maxSpreadIgnitions <= 0 || !state.burns.has(String(source?.id))) return freezeDeep({ type: 'burner:defeat-spread', tick, sourceTargetId: String(source?.id ?? ''), targetIds: [] });
  const eligible = nearbyTargets.filter((target) => target?.active !== false && target?.id !== source?.id)
    .map((target) => ({ target, targetId: String(target.id), distance: Math.hypot(finite(target.x, 'target x') - origin.x, finite(target.y, 'target y') - origin.y) }))
    .filter((entry) => entry.distance <= 180 && lineOfSight(origin, entry.target))
    .sort((a, b) => a.distance - b.distance || lexical(a.targetId, b.targetId))
    .slice(0, Math.min(policy.maxSpreadIgnitions, BEAR_MARKET_BURNER_CONFIG.maxSpreadIgnitionsPerTick));
  for (const entry of eligible) refreshBurn(state, { targetId: entry.targetId, boss: entry.target.boss === true }, tick, policy);
  return freezeDeep({ type: 'burner:defeat-spread', tick, sourceTargetId: String(source.id), targetIds: eligible.map((entry) => entry.targetId) });
}

export function stepBearMarketBurner(state, {
  tick,
  fire = false,
  origin,
  direction,
  targets = [],
  lineOfSight = () => true,
  policy = DEFAULT_POLICY,
} = {}) {
  if (!state || !(state.burns instanceof Map) || !Number.isInteger(tick) || tick < 0 || tick <= state.lastTick) throw new TypeError('state requires a strictly increasing integer tick');
  state.lastTick = tick;
  const events = [];
  for (const [targetId, burn] of [...state.burns]) {
    if (tick >= burn.expiresTick) {
      state.burns.delete(targetId);
      events.push(freezeDeep({ type: 'burner:burn-expired', tick, targetId }));
    } else if (tick >= burn.nextDamageTick) {
      burn.nextDamageTick += BEAR_MARKET_BURNER_CONFIG.burnTickInterval;
      events.push(freezeDeep({ type: 'burner:burn-tick', tick, targetId, damage: burn.damage }));
    }
  }
  state.scorchZones = state.scorchZones.filter((zone) => tick < zone.expiresTick);
  if (!fire || state.swapReadyTick !== null || tick < state.cooldownReadyTick) {
    state.channelFuelSpent = 0;
    state.contactTicks.clear();
    return freezeDeep({ tick, events });
  }
  if (state.fuel <= 0) {
    if (policy.emergencyRefill && !state.emergencyRefillUsed) {
      state.fuel = Math.min(policy.tankCapacity, policy.emergencyRefillFuel);
      state.emergencyRefillUsed = true;
      state.emptySignaled = false;
      events.push(freezeDeep({ type: 'burner:emergency-refill', tick, fuel: state.fuel }));
    } else if (!state.emptySignaled) {
      state.emptySignaled = true;
      state.cooldownReadyTick = tick + BEAR_MARKET_BURNER_CONFIG.emptyCooldownTicks;
      events.push(freezeDeep({ type: 'burner:empty', tick, readyTick: state.cooldownReadyTick }));
      return freezeDeep({ tick, events });
    } else return freezeDeep({ tick, events });
  }
  const consumed = Math.min(state.fuel, policy.fuelPerTick);
  state.fuel -= consumed;
  state.fuelSpent += consumed;
  state.channelFuelSpent += consumed;
  events.push(freezeDeep({ type: 'burner:fuel', tick, consumed, fuel: state.fuel }));
  if (state.fuel === 0 && !state.emptySignaled) {
    state.emptySignaled = true;
    state.cooldownReadyTick = tick + BEAR_MARKET_BURNER_CONFIG.emptyCooldownTicks;
    events.push(freezeDeep({ type: 'burner:empty', tick, readyTick: state.cooldownReadyTick }));
  }
  if (tick - state.lastPulseTick >= BEAR_MARKET_BURNER_CONFIG.pulseIntervalTicks) {
    const start = point(origin, 'origin');
    const aim = normalizedDirection(direction);
    const contacts = pulseContacts({ origin: start, direction: aim, targets, lineOfSight, policy });
    state.lastPulseTick = tick;
    state.pulses += 1;
    const contactIds = new Set(contacts.map((contact) => contact.targetId));
    for (const targetId of [...state.contactTicks.keys()]) if (!contactIds.has(targetId)) state.contactTicks.delete(targetId);
    for (const contact of contacts) {
      refreshBurn(state, contact, tick, policy);
      const heldTicks = (state.contactTicks.get(contact.targetId) ?? 0) + BEAR_MARKET_BURNER_CONFIG.pulseIntervalTicks;
      if (policy.scorchEnabled && heldTicks >= 60) {
        const zone = addBearMarketBurnerScorch(state, { tick, x: contact.x, y: contact.y, sourceTargetId: contact.targetId });
        events.push(freezeDeep({ type: 'burner:scorch-created', tick, zone }));
        state.contactTicks.set(contact.targetId, 0);
      } else state.contactTicks.set(contact.targetId, heldTicks);
    }
    const pressurePermille = policy.totalSelloffThresholdFuel > 0 && state.channelFuelSpent >= policy.totalSelloffThresholdFuel
      ? policy.totalSelloffPressurePermille
      : 1000;
    events.push(freezeDeep({
      type: 'burner:pulse',
      tick,
      sequence: state.pulses,
      pressurePermille,
      activeBurns: state.burns.size,
      activeScorchZones: state.scorchZones.length,
      contacts: contacts.map((contact) => ({ ...contact, directDamage: Number((policy.directDamage * contact.damagePermille * pressurePermille / 1_000_000).toFixed(3)) })),
    }));
    if (pressurePermille > 1000) {
      state.cooldownReadyTick = tick + policy.totalSelloffCooldownTicks;
      state.channelFuelSpent = 0;
      events.push(freezeDeep({ type: 'burner:total-selloff', tick, readyTick: state.cooldownReadyTick }));
    }
  }
  return freezeDeep({ tick, events });
}
