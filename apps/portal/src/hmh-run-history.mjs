import { validateRunSummaryPayload } from '../../../sdk/hmh-run-summary-schema.mjs';
import { RUN_UPGRADE_CATALOG } from '../../hmh-reboot/src/run-progression.mjs';
import { resolveComboPresentation } from '../../hmh-reboot/src/combo-feedback.mjs';

export const HMH_RUN_HISTORY_FILTER_DEFAULTS = Object.freeze({
  heroId: 'all',
  weaponId: 'all',
  mode: 'all',
  date: 'all',
  result: 'all',
});

const HERO_LABELS = Object.freeze({
  'lit-commando': 'Lit Commando',
  'lit-valkyrie': 'Lit Valkyrie',
  'lester-original': 'Lester',
  lilly: 'Lilly',
});
const WEAPON_LABELS = Object.freeze({
  'coin-blaster': 'Coin Blaster',
  'scatter-shotgun': 'Scatter Shotgun',
  'auto-miner': 'Auto Miner',
  'launcher-rig': 'Launcher Rig',
  'litecoin-knife': 'Litecoin Knife',
  'satoshi-frag': 'Satoshi Frag',
  'nuke-liquidation': 'Nuke Liquidation',
  'hash-rail': 'Hash Rail',
  'lightning-ledger': 'Lightning Ledger',
  'bear-market-burner': 'Bear Market Burner',
  'forked-standard': 'Forked Standard',
});
const UPGRADE_WEAPON_TREES = Object.freeze({
  'proof-of-work': 'coin-blaster',
  'block-reward': 'coin-blaster',
  'hot-wallet': 'coin-blaster',
});
const DATE_WINDOWS_MS = Object.freeze({
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
});

const ratioPermille = (numerator, denominator) => denominator > 0
  ? Math.round(numerator * 1000 / denominator)
  : 0;
const labelFor = (labels, id) => labels[id] ?? String(id).split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');

function recordProvenance(record, summary, settlementsBySessionId) {
  const settlement = settlementsBySessionId.get(record.sessionId);
  const transactionHash = record.settlementTxHash
    ?? record.primaryTxHash
    ?? record.settlement?.primaryTxHash
    ?? settlement?.primaryTxHash
    ?? null;
  if (record.seed === true || String(record.wallet ?? '').startsWith('0xSEED')) {
    return Object.freeze({ id: 'house-demo', label: 'HOUSE DEMO', official: false, transactionHash: null });
  }
  if (summary.identity.mode === 'ranked' && transactionHash) {
    return Object.freeze({ id: 'verified-ranked', label: 'VERIFIED RANKED', official: true, transactionHash });
  }
  if (summary.identity.mode === 'ranked') {
    return Object.freeze({ id: 'local-ranked', label: 'LOCAL RANKED', official: false, transactionHash: null });
  }
  return Object.freeze({ id: 'local-free', label: 'LOCAL FREE', official: false, transactionHash: null });
}

function runBuild(summary) {
  const ranks = summary.upgrades
    .filter((upgrade) => upgrade.selected > 0)
    .map((upgrade) => ({ upgradeId: upgrade.upgradeId, rank: upgrade.selected }));
  const weaponTrees = {};
  for (const rank of ranks) {
    const weaponId = UPGRADE_WEAPON_TREES[rank.upgradeId];
    if (!weaponId) continue;
    (weaponTrees[weaponId] ??= []).push({ ...rank });
  }
  return Object.freeze({ ranks, weaponTrees });
}

function canonicalRows(records, { wallet, settlements = [] }) {
  const settlementsBySessionId = new Map(settlements.map((row) => [row.sessionId, row]));
  return records.flatMap((record) => {
    if (!record || record.wallet !== wallet || record.gameId !== 'lester-blaster') return [];
    const summary = record.runSummary;
    if (validateRunSummaryPayload(summary)) return [];
    const primaryWeapons = summary.weapons
      .filter((weapon) => weapon.triggers > 0 || weapon.projectilesEmitted > 0 || weapon.damage > 0 || weapon.kills > 0 || weapon.equippedTicks > 0)
      .map((weapon) => weapon.weaponId);
    const triggerTotals = summary.weapons.reduce((totals, weapon) => ({
      attempts: totals.attempts + weapon.triggers,
      contacts: totals.contacts + weapon.triggerContacts,
    }), { attempts: 0, contacts: 0 });
    const projectileTotals = summary.weapons.reduce((totals, weapon) => ({
      emitted: totals.emitted + weapon.projectilesEmitted,
      contacts: totals.contacts + weapon.projectileContacts,
    }), { emitted: 0, contacts: 0 });
    return [{
      sessionId: String(record.sessionId ?? ''),
      recordedAt: record.recordedAt ?? null,
      timestamp: Date.parse(record.recordedAt ?? ''),
      mode: summary.identity.mode,
      heroId: summary.identity.heroId,
      heroLabel: labelFor(HERO_LABELS, summary.identity.heroId),
      result: summary.identity.terminalReason,
      score: summary.totals.score,
      survivalTicks: summary.totals.survivalTicks,
      elapsedMs: summary.totals.elapsedMs,
      level: summary.totals.level,
      maxCombo: summary.totals.maxCombo,
      combo: resolveComboPresentation(summary.totals.maxCombo),
      damage: summary.totals.damageDealt,
      kills: summary.kills.total,
      bossKills: summary.kills.boss,
      triggerAccuracyPermille: ratioPermille(triggerTotals.contacts, triggerTotals.attempts),
      projectileAccuracyPermille: ratioPermille(projectileTotals.contacts, projectileTotals.emitted),
      primaryWeapons,
      primaryWeaponLabels: primaryWeapons.map((id) => labelFor(WEAPON_LABELS, id)),
      provenance: recordProvenance(record, summary, settlementsBySessionId),
      build: runBuild(summary),
      runSummary: summary,
    }];
  }).sort((a, b) => (Number.isFinite(b.timestamp) ? b.timestamp : 0) - (Number.isFinite(a.timestamp) ? a.timestamp : 0));
}

function normalizeFilters(filters = {}) {
  return Object.freeze({
    ...HMH_RUN_HISTORY_FILTER_DEFAULTS,
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => typeof value === 'string' && value)),
  });
}

function filterRows(rows, filters, now) {
  const dateWindow = DATE_WINDOWS_MS[filters.date] ?? null;
  const oldest = dateWindow ? now - dateWindow : null;
  return rows.filter((row) => (
    (filters.heroId === 'all' || row.heroId === filters.heroId)
    && (filters.weaponId === 'all' || row.primaryWeapons.includes(filters.weaponId))
    && (filters.mode === 'all' || row.mode === filters.mode)
    && (filters.result === 'all' || row.result === filters.result)
    && (oldest === null || Number.isFinite(row.timestamp) && row.timestamp >= oldest)
  ));
}

function personalBests(rows) {
  const max = (field) => rows.reduce((value, row) => Math.max(value, row[field] ?? 0), 0);
  return Object.freeze({
    score: max('score'),
    survivalTicks: max('survivalTicks'),
    level: max('level'),
    maxCombo: max('maxCombo'),
    bossClears: rows.filter((row) => row.bossKills > 0).length,
    damage: max('damage'),
    triggerAccuracyPermille: max('triggerAccuracyPermille'),
    projectileAccuracyPermille: max('projectileAccuracyPermille'),
  });
}

function weaponAggregate(rows) {
  const totals = new Map();
  for (const row of rows) {
    for (const weapon of row.runSummary.weapons) {
      const used = weapon.triggers > 0 || weapon.projectilesEmitted > 0 || weapon.damage > 0 || weapon.kills > 0 || weapon.equippedTicks > 0;
      if (!used) continue;
      const aggregate = totals.get(weapon.weaponId) ?? {
        weaponId: weapon.weaponId,
        label: labelFor(WEAPON_LABELS, weapon.weaponId),
        runs: 0, triggers: 0, triggerContacts: 0, projectilesEmitted: 0, projectileContacts: 0,
        reloadStarts: 0, reloadCompletes: 0, emptyAttempts: 0, equippedTicks: 0, damage: 0, kills: 0,
      };
      aggregate.runs += 1;
      for (const field of ['triggers', 'triggerContacts', 'projectilesEmitted', 'projectileContacts', 'reloadStarts', 'reloadCompletes', 'emptyAttempts', 'equippedTicks', 'damage', 'kills']) aggregate[field] += weapon[field];
      totals.set(weapon.weaponId, aggregate);
    }
  }
  return [...totals.values()].map((row) => Object.freeze({
    ...row,
    triggerAccuracyPermille: ratioPermille(row.triggerContacts, row.triggers),
    projectileAccuracyPermille: ratioPermille(row.projectileContacts, row.projectilesEmitted),
    reloadRatePermille: ratioPermille(row.reloadCompletes, row.reloadStarts),
    emptyRatePermille: ratioPermille(row.emptyAttempts, row.triggers),
  })).sort((a, b) => b.equippedTicks - a.equippedTicks || b.damage - a.damage || a.weaponId.localeCompare(b.weaponId));
}

function heroAggregate(rows) {
  const totals = new Map();
  for (const row of rows) {
    const aggregate = totals.get(row.heroId) ?? { heroId: row.heroId, label: row.heroLabel, runs: 0, completed: 0, damage: 0, kills: 0, weaponTicks: new Map() };
    aggregate.runs += 1;
    aggregate.completed += row.result === 'completed' ? 1 : 0;
    aggregate.damage += row.damage;
    aggregate.kills += row.kills;
    for (const weapon of row.runSummary.weapons) aggregate.weaponTicks.set(weapon.weaponId, (aggregate.weaponTicks.get(weapon.weaponId) ?? 0) + weapon.equippedTicks);
    totals.set(row.heroId, aggregate);
  }
  return [...totals.values()].map((row) => {
    const preferredWeaponId = [...row.weaponTicks].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    return Object.freeze({
      heroId: row.heroId,
      label: row.label,
      runs: row.runs,
      completionRatePermille: ratioPermille(row.completed, row.runs),
      averageDamage: Math.round(row.damage / row.runs),
      averageKills: Math.round(row.kills / row.runs),
      preferredWeaponId,
      preferredWeaponLabel: preferredWeaponId ? labelFor(WEAPON_LABELS, preferredWeaponId) : 'None',
    });
  }).sort((a, b) => b.runs - a.runs || a.heroId.localeCompare(b.heroId));
}

const optionRows = (ids, labels) => [{ id: 'all', label: 'All' }, ...ids.map((id) => ({ id, label: labelFor(labels, id) }))];

export function buildHmhRunHistoryModel(records = [], {
  wallet,
  filters,
  settlements = [],
  now = Date.now(),
} = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const allRows = canonicalRows(sourceRecords, { wallet, settlements });
  const normalizedFilters = normalizeFilters(filters);
  const rows = filterRows(allRows, normalizedFilters, now);
  const heroes = [...new Set(allRows.map((row) => row.heroId))].sort();
  const weapons = [...new Set(allRows.flatMap((row) => row.primaryWeapons))].sort();
  return Object.freeze({
    filters: normalizedFilters,
    options: Object.freeze({
      heroes: optionRows(heroes, HERO_LABELS),
      weapons: optionRows(weapons, WEAPON_LABELS),
      modes: [{ id: 'all', label: 'All' }, { id: 'ranked', label: 'Ranked' }, { id: 'free', label: 'Free' }],
      dates: [{ id: 'all', label: 'All time' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: '90d', label: '90 days' }],
      results: ['all', 'completed', 'defeated', 'abandoned', 'runtime-error'].map((id) => ({ id, label: labelFor({}, id) })),
    }),
    rows,
    totalCanonicalRuns: allRows.length,
    legacyRuns: sourceRecords.filter((record) => record?.wallet === wallet && record?.gameId === 'lester-blaster' && !record.runSummary).length,
    personalBests: personalBests(allRows),
    weapons: weaponAggregate(allRows),
    heroes: heroAggregate(allRows),
    emptyMessage: allRows.length === 0
      ? 'Complete a Hard Money Heroes run to create canonical history.'
      : 'No canonical runs match these filters.',
  });
}
