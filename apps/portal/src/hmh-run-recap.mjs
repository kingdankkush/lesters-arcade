import { WEAPON_LABELS } from './hmh-run-history.mjs';

// Death-screen recap: a pure projection of the canonical run summary the
// lifecycle already hands the parent. It never reads the session or mode, so
// the same payload renders the same recap in Free and Ranked; mode stays with
// identity.mode and the record writers.

// Titles copied from RUN_UPGRADE_CATALOG. Importing the child module hoists
// run-progression into a shared chunk game.js loads statically; measured at
// +123 B against the HMH initial-JS cap (1,032,546 B vs 1,032,423 B), which
// this slice's byte allocation cannot absorb. The copy is hand-maintained, so
// tests/hmh-run-recap.test.mjs deepEquals it to the catalog on every run.
export const UPGRADE_LABELS = Object.freeze({
  'proof-of-work': 'Proof of Work',
  'diamond-hands': 'Diamond Hands',
  'gas-optimization': 'Gas Optimization',
  'cold-storage': 'Cold Storage',
  'block-reward': 'Block Reward',
  'validator-training': 'Validator Training',
  'compound-interest': 'Compound Interest',
  'precision-ledger': 'Precision Ledger',
  'hard-fork-rounds': 'Hard Fork Rounds',
  'hot-wallet': 'Hot Wallet',
  'layer-two': 'Layer Two',
  'hardened-wallet': 'Hardened Wallet',
  'ledger-conductivity': 'Conductivity',
  'ledger-voltage': 'Voltage',
  'ledger-reconciliation': 'Reconciliation',
  'proof-of-network': 'Proof of Network',
  'burner-liquidity': 'Liquidity',
  'burner-volatility': 'Volatility',
  'burner-contagion': 'Contagion',
  'total-selloff': 'Total Selloff',
  'standard-reach': 'Longer Tines',
  'standard-force': 'Hard Consensus',
  'standard-tempo': 'Fast Finality',
  'canonical-fork': 'Canonical Fork',
});

export const ENEMY_LABELS = Object.freeze({
  'bagholder-rusher': 'Bagholder Rusher',
  forkrunner: 'Forkrunner',
  'liquidator-agent': 'Liquidator Agent',
  'whale-enforcer': 'Whale Enforcer',
  'gas-bomber': 'Gas Bomber',
  'validator-cultist': 'Validator Cultist',
  liquidator: 'Liquidator',
});

// Ids from LIQUIDATOR_ATTACK_DEFINITIONS; the label is prefixed with the boss
// name because the cause id only carries the attack.
export const BOSS_ATTACK_LABELS = Object.freeze({
  'crash-lane': 'Crash Lane',
  'liquidation-zone': 'Liquidation Zone',
  'debt-collection': 'Debt Collection',
  'margin-call-dash': 'Margin Call Dash',
  'bad-debt-summon': 'Bad Debt Summon',
  'short-squeeze-burst': 'Short Squeeze Burst',
  'circuit-breaker': 'Circuit Breaker',
  'total-liquidation-super': 'Total Liquidation',
});

// Names from WORLD_DESIGN_SITES / WORLD_DESIGN_SECRETS. Copied rather than
// imported so the portal bundle does not pull authored world geometry.
export const SITE_LABELS = Object.freeze({
  'relay-power': 'Farmstead power station',
  'ravine-winch': 'Quarry winch',
  'crossing-pump': 'Reservoir pump',
  'hashwood-shrine': 'Woodland sanctuary',
  'mining-valve': 'Pressure relief valve',
  'yard-warehouse': 'Warehouse supplies',
});

export const SECRET_LABELS = Object.freeze({
  'farmstead-hidden-supplies': 'Boarded supply chest',
  'ravine-surveyor-cache': 'Surveyor’s ledge cache',
  'warehouse-logbook': 'Warehouse logbook',
});

export const HAZARD_LABELS = Object.freeze({
  'world-steam': 'Steam vent',
});

const BOSS_NAME = 'Liquidator';
const TICKS_PER_SECOND = 60;

const titleCase = (id) => String(id ?? '').split('-').filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
const labelFor = (labels, id) => labels[id] ?? titleCase(id);
const ratioPermille = (numerator, denominator) => denominator > 0 ? Math.round(numerator * 1000 / denominator) : 0;

export function formatRunClock(ticks) {
  const seconds = Math.max(0, Math.floor((Number(ticks) || 0) / TICKS_PER_SECOND));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function defeatLabel(defeat) {
  const { kind, causeId } = defeat;
  if (kind === 'enemy') return labelFor(ENEMY_LABELS, causeId.slice('enemy-'.length));
  if (kind === 'boss') return `${BOSS_NAME}: ${labelFor(BOSS_ATTACK_LABELS, causeId.slice('boss-'.length))}`;
  if (kind === 'hazard') return labelFor(HAZARD_LABELS, causeId);
  if (kind === 'self') return `Your own ${labelFor(WEAPON_LABELS, causeId)}`;
  if (kind === 'unknown') return 'Unknown cause';
  return null;
}

function buildDefeat(summary) {
  // Pre-schema-6 payloads carry no defeat block; report the terminal reason
  // honestly instead of inventing a killer.
  const defeat = summary.defeat ?? {
    kind: summary.identity.terminalReason === 'defeated' ? 'unknown' : 'none',
    causeId: 'none',
    tick: 0,
    damage: 0,
  };
  const label = defeatLabel(defeat);
  const clock = formatRunClock(defeat.tick);
  const damage = Math.round(defeat.damage);
  return Object.freeze({
    kind: defeat.kind,
    causeId: defeat.causeId,
    label,
    sentence: label ? `Killed by ${label}.` : 'No defeat recorded.',
    detail: label ? `${damage.toLocaleString()} damage at ${clock}` : '',
    tick: defeat.tick,
    damage: defeat.damage,
    clock,
  });
}

function buildBuild(summary) {
  const survivalTicks = summary.totals.survivalTicks;
  const weapons = summary.weapons
    .filter((weapon) => weapon.equippedTicks > 0 || weapon.kills > 0 || weapon.damage > 0 || weapon.pickups > 0)
    .map((weapon, order) => ({
      weaponId: weapon.weaponId,
      label: labelFor(WEAPON_LABELS, weapon.weaponId),
      kills: weapon.kills,
      damage: weapon.damage,
      equippedTicks: weapon.equippedTicks,
      equippedPermille: ratioPermille(weapon.equippedTicks, survivalTicks),
      order,
    }))
    .sort((a, b) => b.equippedTicks - a.equippedTicks || b.damage - a.damage || a.order - b.order)
    .map(({ order, ...weapon }) => Object.freeze(weapon));
  const upgrades = summary.upgrades
    .filter((upgrade) => upgrade.selected > 0)
    .map((upgrade) => Object.freeze({
      upgradeId: upgrade.upgradeId,
      label: labelFor(UPGRADE_LABELS, upgrade.upgradeId),
      rank: upgrade.selected,
    }));
  // The run's defining augment: highest rank, ties toward catalog order
  // (earlier = more foundational), matching the legacy in-portal recap.
  const top = upgrades.reduce((best, upgrade) => (upgrade.rank > (best?.rank ?? 0) ? upgrade : best), null);
  return Object.freeze({
    weapons: Object.freeze(weapons),
    upgrades: Object.freeze(upgrades),
    topUpgradeLabel: top ? `${top.label} (Rank ${top.rank})` : null,
  });
}

const cacheWeaponId = (effectId) => (effectId.endsWith('-cache') ? effectId.slice(0, -'-cache'.length) : effectId === 'hash-rail-core' ? 'hash-rail' : null);

function buildMilestones(summary) {
  const milestones = summary.milestones ?? { levelUps: 0, firstLevelUpTick: 0, lastLevelUpTick: 0, bossEngagedTick: 0, sites: [], secrets: [] };
  const timed = [];
  const untimed = [];
  const push = (id, label, tick) => (tick > 0 ? timed : untimed).push({ id, label, tick: tick > 0 ? tick : null });
  if (milestones.levelUps > 0) {
    push('level-up:first', 'Level 2', milestones.firstLevelUpTick);
    if (milestones.levelUps > 1) push('level-up:last', `Level ${summary.totals.level}`, milestones.lastLevelUpTick);
  }
  // Weapon caches carry counts only; they list after the tick-stamped events.
  for (const row of summary.collectibles) {
    const weaponId = cacheWeaponId(row.effectId);
    if (weaponId && row.collected > 0) push(`cache:${row.effectId}`, `${labelFor(WEAPON_LABELS, weaponId)} cache`, 0);
  }
  for (const row of milestones.sites) if (row.operated > 0) push(`site:${row.siteId}`, labelFor(SITE_LABELS, row.siteId), row.tick);
  for (const row of milestones.secrets) if (row.found > 0) push(`secret:${row.secretId}`, labelFor(SECRET_LABELS, row.secretId), row.tick);
  if (milestones.bossEngagedTick > 0) push('boss-engaged', `${BOSS_NAME} engaged`, milestones.bossEngagedTick);
  if (summary.kills.boss > 0) push('boss-defeated', `${BOSS_NAME} defeated`, 0);
  timed.sort((a, b) => a.tick - b.tick);
  return Object.freeze([...timed, ...untimed].map((entry) => Object.freeze({ ...entry, clock: entry.tick === null ? null : formatRunClock(entry.tick) })));
}

// Game-over metric sources: the canonical payload when the lifecycle finalized
// one for the run on screen, otherwise the legacy in-portal combat fields
// (which are stale for reboot runs: combat.bossDefeated is never set from the
// payload, which is why the Bosses metric used to read 0). Pure, so the
// selection is unit-tested without the DOM; main.js only forwards the result.
export function selectGameOverRecapFields(summary, { bossesDefeated = 0, killedBy = null, bestUpgrade = null, runSeed = null } = {}) {
  const recap = buildHmhRunRecapModel(summary);
  return Object.freeze(recap
    ? { bossesDefeated: summary.kills.boss, killedBy: recap.defeat.label, bestUpgrade: recap.build.topUpgradeLabel, runSeed: recap.seed }
    : { bossesDefeated, killedBy, bestUpgrade, runSeed });
}

export function buildHmhRunRecapModel(summary) {
  if (!summary || typeof summary !== 'object' || !summary.identity || !summary.totals || !Array.isArray(summary.weapons)) return null;
  return Object.freeze({
    defeat: buildDefeat(summary),
    build: buildBuild(summary),
    milestones: buildMilestones(summary),
    seed: summary.identity.seed,
    maxCombo: summary.totals.maxCombo,
    level: summary.totals.level,
    survivalClock: formatRunClock(summary.totals.survivalTicks),
  });
}
