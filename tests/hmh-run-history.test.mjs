import assert from 'node:assert/strict';
import test from 'node:test';

import { HMH_RUN_SUMMARY_CATALOGS as C, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';
import * as history from '../apps/portal/src/hmh-run-history.mjs';
import { createRunSummaryAccumulator, finalizeRunSummary, recordRunDamage, recordRunMilestone } from '../sdk/hmh-run-summary.mjs';
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
  assert.equal(model.rows[0].provenance.id, 'local-ranked', 'a cached transaction string is not verified gameplay provenance');
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

// Every leaf is kept, including zeros and canonical identifiers. Missing old-version
// counters must remain absent rather than being invented as zero.
function leafEntries(value, path = '') {
  return value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, child]) => leafEntries(child, path ? `${path}.${key}` : key))
    : [[path, value]];
}

test('detailed history exposes every validated schema leaf without changing its value', () => {
  assert.equal(typeof history.buildHmhRunDetailsModel, 'function');
  const current = finalizeRunSummary(createRunSummaryAccumulator({
    seed: 7, buildHash: 'history-test', mode: 'ranked', heroId: 'lit-commando',
    startPosition: { x: 0, y: 0 },
  }), { endTick: 600, elapsedMs: 10000, score: 77, level: 1, xp: 0,
    currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 10, terminalReason: 'defeated' });
  for (const input of [summary(), current]) {
    assert.equal(validateRunSummaryPayload(input), '');
    const before = JSON.stringify(input);
    const details = history.buildHmhRunDetailsModel(input);
    const fields = details.sections.flatMap((section) => section.fields);
    assert.deepEqual(Object.fromEntries(fields.map(({ path, value }) => [path, value])), Object.fromEntries(leafEntries(input)));
    assert.equal(fields.length, leafEntries(input).length, 'no duplicate or silently omitted fields');
    assert.ok(fields.every((field) => field.label && field.path));
    assert.equal(JSON.stringify(input), before);
    assert.ok(Object.isFrozen(details.sections));
  }
  const oldFields = history.buildHmhRunDetailsModel(summary()).sections.flatMap((section) => section.fields);
  assert.ok(!oldFields.some((field) => field.path.startsWith('lightningLedger.')));
  assert.ok(!oldFields.some((field) => field.path.endsWith('.chargesStarted')));
});

test('detailed history rejects malformed or unsupported summaries instead of rendering raw payloads', () => {
  assert.equal(typeof history.buildHmhRunDetailsModel, 'function');
  for (const input of [null, {}, { ...summary(), schemaVersion: 99 }, { ...summary(), extra: '<script>untrusted</script>' }]) {
    assert.equal(history.buildHmhRunDetailsModel(input), null);
  }
});

test('cached receipts and flags cannot certify canonical run stats as on-chain', () => {
  for (const extra of [
    { settlementTxHash: '0xabc' },
    { settlementTxHash: `0x${'a'.repeat(64)}` },
    { primaryTxHash: `0x${'b'.repeat(64)}`, chainVerified: true },
    { settlement: { mode: 'live', settled: true, primaryTxHash: `0x${'c'.repeat(64)}` } },
    { settlement: { mode: 'simulated', settled: true, primaryTxHash: 'sim:fixture' } },
  ]) {
    const model = buildHmhRunHistoryModel([{ ...records[0], ...extra }], {
      wallet: WALLET, settlements: [{ sessionId: records[0].sessionId, mode: 'live', primaryTxHash: `0x${'d'.repeat(64)}` }],
    });
    assert.equal(model.rows[0].provenance.id, 'local-ranked');
    assert.equal(model.rows[0].provenance.official, false);
    assert.equal(model.rows[0].provenance.transactionHash, null);
  }
});

test('history reports rejected same-wallet summaries separately from pre-summary legacy runs', () => {
  const model = buildHmhRunHistoryModel([
    ...records,
    { ...records[0], sessionId: 'invalid', runSummary: { schemaVersion: 5 } },
    { ...records[0], wallet: 'other', runSummary: { schemaVersion: 5 } },
  ], { wallet: WALLET });
  assert.equal(model.invalidRuns, 1);
  assert.equal(model.legacyRuns, 1);
  assert.equal(model.totalCanonicalRuns, 2);
});

test('detailed history labels schema 6 site and secret rows and surfaces the defeat on history cards', () => {
  const state = createRunSummaryAccumulator({ seed: 9, buildHash: 'history-v6', mode: 'free', heroId: 'lilly', startPosition: { x: 0, y: 0 } });
  recordRunMilestone(state, { type: 'site-operated', id: 'crossing-pump', tick: 12 });
  recordRunMilestone(state, { type: 'secret-found', id: 'ravine-surveyor-cache', tick: 30 });
  recordRunDamage(state, { sourceId: 'boss-liquidator', targetId: 'player', weaponId: 'boss-circuit-breaker', damageApplied: 24, killed: true, tick: 40 });
  const current = finalizeRunSummary(state, { endTick: 40, elapsedMs: 666.667, score: 5, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 10, terminalReason: 'defeated' });
  assert.equal(current.schemaVersion, 6);
  const details = history.buildHmhRunDetailsModel(current);
  const fields = details.sections.flatMap((section) => section.fields);
  assert.ok(!fields.some((field) => /undefined/i.test(field.label)), 'every schema 6 row must resolve a label');
  assert.equal(fields.find((field) => field.path === 'milestones.sites.2.operated').label, 'Sites · Crossing Pump · Operated');
  assert.equal(fields.find((field) => field.path === 'milestones.secrets.1.tick').label, 'Secrets · Ravine Surveyor Cache · Tick');
  assert.equal(fields.find((field) => field.path === 'defeat.causeId').value, 'boss-circuit-breaker');
  assert.equal(fields.length, leafEntries(current).length);
  // Older records keep their exact leaf set and carry no invented defeat.
  const legacyFields = history.buildHmhRunDetailsModel(summary()).sections.flatMap((section) => section.fields);
  assert.ok(!legacyFields.some((field) => field.path.startsWith('defeat.') || field.path.startsWith('milestones.')));
  const model = buildHmhRunHistoryModel([
    ...records,
    { sessionId: 'v6', wallet: WALLET, gameId: 'lester-blaster', recordedAt: '2026-08-07T12:00:00.000Z', runSummary: current },
  ], { wallet: WALLET, now: Date.parse('2026-08-08T12:00:00.000Z') });
  assert.deepEqual(model.rows[0].defeat, { kind: 'boss', causeId: 'boss-circuit-breaker', tick: 40, damage: 24 });
  assert.equal(model.rows[1].defeat, null);
});
