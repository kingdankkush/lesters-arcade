import { freezeDeep } from './value-guards.mjs';

export const LIGHTNING_LEDGER_CONFIG = freezeDeep({
  maxJumps: 8,
  primaryRange: 900,
  jumpRange: 420,
  graceTicks: 6,
  breakCooldownTicks: 108,
  overheatTicks: 180,
  pulseIntervalTicks: 6,
  cellDrainTicks: 30,
  cellSegments: 6,
});

function ledgerTier(value, name) {
  const tier = value ?? 0;
  if (!Number.isInteger(tier) || tier < 0 || tier > 3) throw new TypeError(`${name} tier must be an integer from zero to three`);
  return tier;
}

export function resolveLightningLedgerUpgradePolicy({ branches = {}, capstoneId = null } = {}) {
  const conductivity = ledgerTier(branches.conductivity, 'conductivity');
  const voltage = ledgerTier(branches.voltage, 'voltage');
  const reconciliation = ledgerTier(branches.reconciliation, 'reconciliation');
  if (capstoneId !== null && capstoneId !== 'proof-of-network') throw new TypeError('unsupported Lightning Ledger capstone');
  if (capstoneId && [conductivity, voltage, reconciliation].some((tier) => tier < 3)) throw new TypeError('Proof of Network requires all three tier-three branches');
  return freezeDeep({
    conductivity,
    voltage,
    reconciliation,
    maxTargets: conductivity >= 3 ? 8 : conductivity >= 2 ? 7 : 6,
    jumpRange: LIGHTNING_LEDGER_CONFIG.jumpRange + conductivity * 40,
    lateChainRetentionPermille: conductivity >= 3 ? 940 : conductivity >= 2 ? 860 : 780,
    contactDamagePermille: voltage >= 1 ? 1150 : 1000,
    rampDurationTicks: voltage >= 2 ? 150 : LIGHTNING_LEDGER_CONFIG.overheatTicks,
    lastArcKnockbackMultiplier: voltage >= 3 ? 1.5 : 1,
    reserveAmmoGrant: 12 + reconciliation * 2,
    reloadMultiplier: reconciliation >= 2 ? 1.3 : 1,
    fullChainCellRefund: reconciliation >= 3,
    proofPulseOrdinal: capstoneId === 'proof-of-network' ? 5 : 0,
    proofDamagePermille: capstoneId === 'proof-of-network' ? 1250 : 1000,
  });
}

const DEFAULT_UPGRADE_POLICY = resolveLightningLedgerUpgradePolicy();

const point = (value, label) => {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError(`${label} must be finite`);
  return { x, y };
};
const distanceSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function selectLightningLedgerChain({ origin, targets, lineOfSight = () => true, policy = DEFAULT_UPGRADE_POLICY } = {}) {
  const start = point(origin, 'origin');
  if (!Array.isArray(targets) || typeof lineOfSight !== 'function') throw new TypeError('targets and lineOfSight are required');
  const remaining = [];
  const targetIds = new Set();
  for (const target of targets) {
    if (target?.active === false) continue;
    if (!target || typeof target.id !== 'string' || target.id.length === 0) throw new TypeError('active target must have a non-empty string id');
    if (targetIds.has(target.id)) throw new TypeError(`duplicate target id: ${target.id}`);
    targetIds.add(target.id);
    remaining.push({ ...target, ...point(target, `target ${target.id}`) });
  }
  const chain = [];
  let from = start;
  let range = LIGHTNING_LEDGER_CONFIG.primaryRange;
  while (remaining.length && chain.length < Math.min(LIGHTNING_LEDGER_CONFIG.maxJumps, policy.maxTargets)) {
    const rangeSq = range ** 2;
    const candidates = remaining.filter((target) => distanceSq(from, target) <= rangeSq && lineOfSight(from, target))
      .sort((a, b) => distanceSq(from, a) - distanceSq(from, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (!candidates.length) break;
    const selected = candidates[0];
    chain.push(selected);
    remaining.splice(remaining.findIndex((target) => target.id === selected.id), 1);
    from = selected;
    range = policy.jumpRange;
  }
  return freezeDeep(chain);
}

export function createLightningLedgerState({ cellsRemaining = LIGHTNING_LEDGER_CONFIG.cellSegments } = {}) {
  if (!Number.isInteger(cellsRemaining) || cellsRemaining < 0 || cellsRemaining > LIGHTNING_LEDGER_CONFIG.cellSegments) {
    throw new TypeError(`cellsRemaining must be an integer from zero to ${LIGHTNING_LEDGER_CONFIG.cellSegments}`);
  }
  return {
    active: false,
    channelStartTick: null,
    lastValidTick: null,
    lastCellDrainTick: null,
    cooldownUntilTick: 0,
    cellsRemaining,
    pulses: 0,
    maxRampPermille: 1000,
    fullChainRefunded: false,
  };
}

export function refillLightningLedgerCells(state, cells = LIGHTNING_LEDGER_CONFIG.cellSegments) {
  if (state?.active) throw new Error('cannot refill Lightning Ledger while channeling');
  if (!Number.isInteger(cells) || cells < 0 || cells > LIGHTNING_LEDGER_CONFIG.cellSegments) {
    throw new TypeError(`cells must be an integer from zero to ${LIGHTNING_LEDGER_CONFIG.cellSegments}`);
  }
  state.cellsRemaining = cells;
  return state.cellsRemaining;
}

export function resetLightningLedgerState(state) {
  if (!state || typeof state !== 'object') throw new TypeError('Lightning Ledger state is required');
  Object.assign(state, createLightningLedgerState());
  return freezeDeep({ ...state });
}

function stopChannel(state, tick, reason, cooldownTicks) {
  state.active = false;
  state.channelStartTick = null;
  state.lastValidTick = null;
  state.lastCellDrainTick = null;
  state.cooldownUntilTick = tick + cooldownTicks;
  return freezeDeep({ type: reason === 'overheat' ? 'ledger:overheat' : 'ledger:channel-break', tick, reason, cooldownUntilTick: state.cooldownUntilTick });
}

export function stepLightningLedger(state, {
  tick,
  fire = false,
  validPrimary = false,
  origin = { x: 0, y: 0 },
  targets = [],
  lineOfSight,
  stopReason = '',
  policy = DEFAULT_UPGRADE_POLICY,
} = {}) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  const events = [];
  const result = (payload) => freezeDeep({ ...payload, cellsRemaining: state.cellsRemaining });
  if (state.active && stopReason) events.push(stopChannel(state, tick, stopReason, LIGHTNING_LEDGER_CONFIG.breakCooldownTicks));
  if (state.active && !fire) events.push(stopChannel(state, tick, 'release', LIGHTNING_LEDGER_CONFIG.breakCooldownTicks));
  if (!state.active && (events.length || !fire || tick < state.cooldownUntilTick || state.cellsRemaining <= 0)) {
    const status = tick < state.cooldownUntilTick ? 'cooldown' : state.cellsRemaining <= 0 ? 'empty' : 'idle';
    return result({ tick, status, events });
  }

  const chain = validPrimary ? selectLightningLedgerChain({ origin, targets, lineOfSight, policy }) : [];
  if (!state.active) {
    if (!chain.length) return result({ tick, status: 'idle', events });
    state.active = true;
    state.channelStartTick = tick;
    state.lastValidTick = tick;
    state.lastCellDrainTick = tick;
    state.fullChainRefunded = false;
    events.push(freezeDeep({ type: 'ledger:channel-start', tick, targetId: chain[0].id }));
    return result({ tick, status: 'channel', chain, rampPermille: 1000, events });
  }

  const elapsedTicks = tick - state.channelStartTick;
  if (elapsedTicks >= LIGHTNING_LEDGER_CONFIG.overheatTicks) {
    events.push(stopChannel(state, tick, 'overheat', LIGHTNING_LEDGER_CONFIG.overheatTicks));
    return result({ tick, status: 'cooldown', events });
  }
  const drainedCells = Math.floor((tick - state.lastCellDrainTick) / LIGHTNING_LEDGER_CONFIG.cellDrainTicks);
  if (drainedCells > 0) {
    const consumed = Math.min(state.cellsRemaining, drainedCells);
    state.cellsRemaining -= consumed;
    state.lastCellDrainTick += drainedCells * LIGHTNING_LEDGER_CONFIG.cellDrainTicks;
    events.push(freezeDeep({ type: 'ledger:cell-drain', tick, consumed, cellsRemaining: state.cellsRemaining }));
    if (state.cellsRemaining <= 0) {
      events.push(stopChannel(state, tick, 'empty', LIGHTNING_LEDGER_CONFIG.breakCooldownTicks));
      return result({ tick, status: 'cooldown', events });
    }
  }
  if (!chain.length) {
    if (tick - state.lastValidTick <= LIGHTNING_LEDGER_CONFIG.graceTicks) return result({ tick, status: 'grace', events });
    events.push(stopChannel(state, tick, 'invalid-target', LIGHTNING_LEDGER_CONFIG.breakCooldownTicks));
    return result({ tick, status: 'cooldown', events });
  }
  state.lastValidTick = tick;
  const rampPermille = Math.min(3000, 1000 + Math.round(elapsedTicks * 2000 / policy.rampDurationTicks));
  state.maxRampPermille = Math.max(state.maxRampPermille, rampPermille);
  if (elapsedTicks > 0 && elapsedTicks % LIGHTNING_LEDGER_CONFIG.pulseIntervalTicks === 0) {
    state.pulses += 1;
    const proofDamagePermille = policy.proofPulseOrdinal > 0 && state.pulses % policy.proofPulseOrdinal === 0
      ? policy.proofDamagePermille
      : 1000;
    const retentionStep = chain.length > 1 ? (1000 - policy.lateChainRetentionPermille) / (chain.length - 1) : 0;
    const jumpDamagePermille = chain.map((_, index) => Math.round(1000 - retentionStep * index));
    let refundedCell = false;
    if (policy.fullChainCellRefund && chain.length === LIGHTNING_LEDGER_CONFIG.maxJumps && !state.fullChainRefunded && state.cellsRemaining < LIGHTNING_LEDGER_CONFIG.cellSegments) {
      state.cellsRemaining += 1;
      state.fullChainRefunded = true;
      refundedCell = true;
      events.push(freezeDeep({ type: 'ledger:cell-refund', tick, cellsRemaining: state.cellsRemaining }));
    }
    events.push(freezeDeep({
      type: 'ledger:pulse',
      tick,
      pulse: state.pulses,
      rampPermille,
      proofDamagePermille,
      contactDamagePermille: policy.contactDamagePermille,
      jumpDamagePermille,
      lastArcKnockbackMultiplier: policy.lastArcKnockbackMultiplier,
      refundedCell,
      chainIds: chain.map((target) => target.id),
    }));
  }
  return result({ tick, status: 'channel', chain, rampPermille, events });
}
