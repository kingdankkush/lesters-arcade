import assert from 'node:assert/strict';
import test from 'node:test';

import { HMH_RUN_SUMMARY_CATALOGS as C } from '../sdk/hmh-run-summary-schema.mjs';
import {
  HMH_RUN_HISTORY_FILTER_DEFAULTS,
  buildHmhRunHistoryModel,
} from '../apps/portal/src/hmh-run-history.mjs';

function summary({
  mode = 'ranked',
  heroId = 'lit-commando',
  terminalReason = 'completed',
  score = 10_000,
  survivalTicks = 600,
  level = 4,
  maxCombo = 12,
  damage = 900,
  boss = 1,
  weaponId = 'coin-blaster',
  triggers = 10,
  triggerContacts = 7,
  projectilesEmitted = 12,
  projectileContacts = 8,
  reloadStarts = 2,
  reloadCompletes = 2,
  emptyAttempts = 1,
  kills = 4,
  upgradeId = 'proof-of-work',
  upgradeRank = 2,
} = {}) {
  const byWeapon = C.weapons.map((id) => ({ weaponId: id, count: id === weaponId ? kills : 0 }));
  return {
    schemaVersion: 1,
    identity: { seed: 7, buildHash: 'wave-6b', mode, heroId, terminalReason, startTick: 0, endTick: survivalTicks },
    totals: {
      survivalTicks,
      elapsedMs: survivalTicks * 1000 / 60,
      score,
      level,
      xp: 500,
      litecoin: 1,
      currentCombo: 0,
      maxCombo,
      damageDealt: damage,
      damageTaken: 20,
      healing: 10,
      distanceMilli: 5_000,
    },
    kills: {
      total: kills,
      byEnemyRole: C.enemyRoles.map((enemyRoleId, index) => ({ enemyRoleId, count: index === 0 ? kills : 0 })),
      byWeapon,
      elite: Math.min(1, kills),
      boss,
    },
    weapons: C.weapons.map((id) => ({
      weaponId: id,
      pickups: id === weaponId ? 1 : 0,
      swaps: id === weaponId ? 1 : 0,
      triggers: id === weaponId ? triggers : 0,
      triggerContacts: id === weaponId ? triggerContacts : 0,
      projectilesEmitted: id === weaponId ? projectilesEmitted : 0,
      projectileContacts: id === weaponId ? projectileContacts : 0,
      reloadStarts: id === weaponId ? reloadStarts : 0,
      reloadCompletes: id === weaponId ? reloadCompletes : 0,
      emptyAttempts: id === weaponId ? emptyAttempts : 0,
      equippedTicks: id === weaponId ? survivalTicks : 0,
      damage: id === weaponId ? damage : 0,
      kills: id === weaponId ? kills : 0,
      criticalHits: id === weaponId ? 2 : 0,
      overkill: id === weaponId ? 5 : 0,
    })),
    grenades: { thrown: 0, detonated: 0, contacts: 0, kills: 0, selfDamage: 0, overflows: 0 },
    collectibles: C.collectibles.map((effectId) => ({ effectId, collected: effectId === 'litecoin-token' ? 1 : 0, activeTicks: 0 })),
    upgrades: C.upgrades.map((id) => ({ upgradeId: id, offered: id === upgradeId ? upgradeRank : 0, selected: id === upgradeId ? upgradeRank : 0 })),
    exploration: { visitedDistrictMask: 1, discoveredPoiMask: 1, revealedCells: 1, totalCells: 10, revealedPermille: 100, distanceMilli: 5_000 },
  };
}

const WALLET = '0x1111111111111111111111111111111111111111';
const records = [
  {
    sessionId: 'ranked-1', wallet: WALLET, gameId: 'lester-blaster', recordedAt: '2026-08-05T12:00:00.000Z',
    settlementTxHash: '0xabc', runSummary: summary(),
  },
  {
    sessionId: 'free-1', wallet: WALLET, gameId: 'lester-blaster', recordedAt: '2026-08-01T12:00:00.000Z',
    runSummary: summary({ mode: 'free', heroId: 'lit-valkyrie', terminalReason: 'defeated', score: 7_000, survivalTicks: 900, level: 5, maxCombo: 20, damage: 1_200, boss: 0, weaponId: 'scatter-shotgun', triggers: 5, triggerContacts: 4, projectilesEmitted: 30, projectileContacts: 18, kills: 6, upgradeId: 'diamond-hands', upgradeRank: 3 }),
  },
  { sessionId: 'legacy', wallet: WALLET, gameId: 'lester-blaster', score: 2_000, recordedAt: '2026-07-01T12:00:00.000Z' },
];

test('canonical history model exposes truthful provenance, PBs, accuracy, builds, weapons, and heroes', () => {
  const model = buildHmhRunHistoryModel(records, {
    wallet: WALLET,
    now: Date.parse('2026-08-06T12:00:00.000Z'),
  });
  assert.deepEqual(model.filters, HMH_RUN_HISTORY_FILTER_DEFAULTS);
  assert.equal(model.totalCanonicalRuns, 2);
  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[0].provenance.id, 'verified-ranked');
  assert.equal(model.rows[1].provenance.id, 'local-free');
  assert.equal(model.personalBests.score, 10_000);
  assert.equal(model.personalBests.survivalTicks, 900);
  assert.equal(model.personalBests.level, 5);
  assert.equal(model.personalBests.maxCombo, 20);
  assert.equal(model.personalBests.bossClears, 1);
  assert.equal(model.personalBests.damage, 1_200);
  assert.equal(model.personalBests.triggerAccuracyPermille, 800);
  assert.equal(model.personalBests.projectileAccuracyPermille, 667);
  const shotgun = model.weapons.find((row) => row.weaponId === 'scatter-shotgun');
  assert.equal(shotgun.runs, 1);
  assert.equal(shotgun.damage, 1_200);
  assert.equal(shotgun.kills, 6);
  assert.equal(shotgun.triggerAccuracyPermille, 800);
  assert.equal(shotgun.projectileAccuracyPermille, 600);
  assert.equal(shotgun.reloadRatePermille, 1000);
  assert.equal(shotgun.emptyRatePermille, 200);
  const valkyrie = model.heroes.find((row) => row.heroId === 'lit-valkyrie');
  assert.equal(valkyrie.runs, 1);
  assert.equal(valkyrie.completionRatePermille, 0);
  assert.equal(valkyrie.preferredWeaponId, 'scatter-shotgun');
  assert.deepEqual(model.rows[0].build.ranks, [{ upgradeId: 'proof-of-work', rank: 2 }]);
  assert.deepEqual(model.rows[0].build.weaponTrees['coin-blaster'], [{ upgradeId: 'proof-of-work', rank: 2 }]);
  assert.equal(model.legacyRuns, 1);
});

test('history filters combine hero, weapon, mode, date, and result without changing source records', () => {
  const model = buildHmhRunHistoryModel(records, {
    wallet: WALLET,
    now: Date.parse('2026-08-06T12:00:00.000Z'),
    filters: { heroId: 'lit-valkyrie', weaponId: 'scatter-shotgun', mode: 'free', date: '7d', result: 'defeated' },
  });
  assert.deepEqual(model.rows.map((row) => row.sessionId), ['free-1']);
  assert.equal(records[1].runSummary.identity.heroId, 'lit-valkyrie');

  const empty = buildHmhRunHistoryModel(records, {
    wallet: WALLET,
    now: Date.parse('2026-08-06T12:00:00.000Z'),
    filters: { mode: 'ranked', result: 'defeated' },
  });
  assert.equal(empty.rows.length, 0);
  assert.match(empty.emptyMessage, /filters/i);
});

test('history ignores other wallets and malformed summaries and reports explicit filter options', () => {
  const model = buildHmhRunHistoryModel([
    ...records,
    { sessionId: 'other', wallet: '0x2222222222222222222222222222222222222222', runSummary: summary() },
    { sessionId: 'bad', wallet: WALLET, runSummary: { schemaVersion: 1 } },
  ], { wallet: WALLET, now: Date.parse('2026-08-06T12:00:00.000Z') });
  assert.equal(model.totalCanonicalRuns, 2);
  assert.deepEqual(model.options.modes.map((row) => row.id), ['all', 'ranked', 'free']);
  assert.ok(model.options.heroes.some((row) => row.id === 'lit-commando'));
  assert.ok(model.options.weapons.some((row) => row.id === 'coin-blaster'));
  assert.deepEqual(model.options.results.map((row) => row.id), ['all', 'completed', 'defeated', 'abandoned', 'runtime-error']);
});
