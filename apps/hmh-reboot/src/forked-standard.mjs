import { resolveMeleeAttack } from './melee.mjs';
import { freezeDeep } from './value-guards.mjs';

const TICKS_PER_SECOND = 60;
const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export const FORKED_STANDARD_CONFIG = freezeDeep({
  id: 'forked-standard',
  eventMinTick: 10_800,
  eventMaxTick: 25_200,
  maxCandidates: 32,
  whiffPenaltyTicks: 8,
  capstoneEveryAttacks: 4,
  capstoneDamagePermille: 1250,
  thrust: {
    damage: 18,
    range: 100,
    cooldownTicks: 24,
    arcRadians: Math.PI * 32 / 180,
    sweepRadius: 12,
    minZ: 4,
    maxZ: 64,
    maxDownwardDrop: 64,
    knockback: 24,
    maxContacts: 3,
  },
  sweep: {
    damage: 12,
    range: 78,
    cooldownTicks: 28,
    arcRadians: Math.PI * 116 / 180,
    sweepRadius: 25,
    minZ: 4,
    maxZ: 62,
    maxDownwardDrop: 64,
    knockback: 16,
    maxContacts: 6,
  },
});

function tier(value, label) {
  const normalized = value ?? 0;
  if (!Number.isInteger(normalized) || normalized < 0 || normalized > 3) throw new TypeError(`${label} tier must be an integer from zero to three`);
  return normalized;
}

export function resolveForkedStandardPolicy({ branches = {}, capstoneId = null } = {}) {
  const reach = tier(branches.reach, 'reach');
  const force = tier(branches.force, 'force');
  const tempo = tier(branches.tempo, 'tempo');
  if (capstoneId !== null && capstoneId !== 'canonical-fork') throw new TypeError(`unknown Forked Standard capstone ${String(capstoneId)}`);
  if (capstoneId === 'canonical-fork' && [reach, force, tempo].some((rank) => rank < 3)) {
    throw new TypeError('Canonical Fork requires all three branches at rank three');
  }
  const buildForm = (base, form) => freezeDeep({
    ...base,
    damage: base.damage + force * (form === 'thrust' ? 3 : 2),
    range: base.range + reach * (form === 'thrust' ? 8 : 6),
    arcRadians: base.arcRadians + Math.PI * reach * (form === 'thrust' ? 4 : 10) / 180,
    cooldownTicks: Math.max(12, base.cooldownTicks - tempo * 2),
    knockback: base.knockback + force * 4,
  });
  return freezeDeep({
    reachTier: reach,
    forceTier: force,
    tempoTier: tempo,
    thrust: buildForm(FORKED_STANDARD_CONFIG.thrust, 'thrust'),
    sweep: buildForm(FORKED_STANDARD_CONFIG.sweep, 'sweep'),
    whiffPenaltyTicks: Math.max(2, FORKED_STANDARD_CONFIG.whiffPenaltyTicks - tempo * 2),
    capstoneId,
    capstoneEveryAttacks: FORKED_STANDARD_CONFIG.capstoneEveryAttacks,
    capstoneDamagePermille: FORKED_STANDARD_CONFIG.capstoneDamagePermille,
  });
}

export function createForkedStandardState() {
  return {
    lastTick: -1,
    nextAttackTick: 0,
    sequence: 0,
    attacks: 0,
    thrusts: 0,
    sweeps: 0,
    contacts: 0,
    whiffs: 0,
    capstoneAttacks: 0,
    droppedContacts: 0,
  };
}

export function getForkedStandardSnapshot(state) {
  if (!state || !Number.isInteger(state.sequence)) throw new TypeError('Forked Standard state is required');
  return freezeDeep({
    nextAttackTick: state.nextAttackTick,
    nextForm: state.sequence % 2 === 0 ? 'thrust' : 'sweep',
    attacks: state.attacks,
    thrusts: state.thrusts,
    sweeps: state.sweeps,
    contacts: state.contacts,
    whiffs: state.whiffs,
    capstoneAttacks: state.capstoneAttacks,
    droppedContacts: state.droppedContacts,
  });
}

function validateTick(state, tick) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  if (tick <= state.lastTick) throw new TypeError('tick must be monotonic');
  state.lastTick = tick;
}

function boundedTargets(targets, origin) {
  if (!Array.isArray(targets) || targets.length > 256) throw new TypeError('Forked Standard targets must be a bounded array');
  const seen = new Set();
  const ordered = targets.map((target) => {
    const id = String(target?.id ?? '');
    if (!id) throw new TypeError('Forked Standard target id is required');
    if (seen.has(id)) throw new TypeError(`duplicate Forked Standard target ${id}`);
    seen.add(id);
    const x = Number(target?.currentGround?.x);
    const y = Number(target?.currentGround?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Forked Standard target position must be finite');
    return { target, distanceSquared: (x - origin.x) ** 2 + (y - origin.y) ** 2, id };
  }).sort((left, right) => left.distanceSquared - right.distanceSquared || lexical(left.id, right.id));
  return ordered.slice(0, FORKED_STANDARD_CONFIG.maxCandidates).map((entry) => entry.target);
}

function meleeDefinition(form, policy, damagePermille) {
  const profile = policy[form];
  return freezeDeep({
    id: FORKED_STANDARD_CONFIG.id,
    title: 'Forked Standard',
    damage: Number((profile.damage * damagePermille / 1000).toFixed(6)),
    range: profile.range,
    cooldownTicks: profile.cooldownTicks,
    arcRadians: profile.arcRadians,
    sweepRadius: profile.sweepRadius,
    minZ: profile.minZ,
    maxZ: profile.maxZ,
    maxDownwardDrop: profile.maxDownwardDrop,
    knockback: profile.knockback,
  });
}

export function stepForkedStandard(state, {
  tick,
  fire = false,
  origin,
  direction,
  targets = [],
  blockers = [],
  downwardDropDirection = null,
  policy = resolveForkedStandardPolicy(),
} = {}) {
  if (!state || !Number.isInteger(state.sequence)) throw new TypeError('Forked Standard state is required');
  validateTick(state, tick);
  if (!fire || tick < state.nextAttackTick) {
    return freezeDeep({ tick, attacked: false, strike: null, hits: [], rejections: [], events: [], snapshot: getForkedStandardSnapshot(state) });
  }
  if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) throw new TypeError('Forked Standard origin must be finite');
  if (!Array.isArray(blockers) || blockers.length > 512) throw new TypeError('Forked Standard blockers must be a bounded array');
  const form = state.sequence % 2 === 0 ? 'thrust' : 'sweep';
  const profile = policy[form];
  if (!profile) throw new TypeError('Forked Standard policy is invalid');
  const sequence = state.sequence;
  const attackId = `${FORKED_STANDARD_CONFIG.id}:${String(sequence).padStart(8, '0')}`;
  const capstone = policy.capstoneId === 'canonical-fork' && (sequence + 1) % policy.capstoneEveryAttacks === 0;
  const damagePermille = capstone ? policy.capstoneDamagePermille : 1000;
  const candidates = boundedTargets(targets, origin);
  const resolved = resolveMeleeAttack({
    attackId,
    tick,
    origin,
    direction,
    targets: candidates,
    blockers,
    downwardDropDirection,
    definition: meleeDefinition(form, policy, damagePermille),
  });
  const hits = resolved.hits.slice(0, profile.maxContacts);
  const droppedContacts = Math.max(0, resolved.hits.length - hits.length);
  const whiff = hits.length === 0;
  state.sequence += 1;
  state.attacks += 1;
  state[form === 'thrust' ? 'thrusts' : 'sweeps'] += 1;
  state.contacts += hits.length;
  state.droppedContacts += droppedContacts;
  if (whiff) state.whiffs += 1;
  if (capstone) state.capstoneAttacks += 1;
  state.nextAttackTick = tick + profile.cooldownTicks + (whiff ? policy.whiffPenaltyTicks : 0);
  const strike = freezeDeep({
    type: 'standard:strike',
    tick,
    attackId,
    sequence,
    form,
    capstone,
    damagePermille,
    candidatesConsidered: candidates.length,
    hits,
    rejections: resolved.rejections,
    droppedContacts,
    whiff,
    nextAttackTick: state.nextAttackTick,
  });
  return freezeDeep({
    tick,
    attacked: true,
    strike,
    hits,
    rejections: resolved.rejections,
    events: [strike],
    snapshot: getForkedStandardSnapshot(state),
  });
}

export const FORKED_STANDARD_TICKS_PER_SECOND = TICKS_PER_SECOND;
