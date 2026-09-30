// Early Supporter: the parent-owned achievement (achievements/arcade.mjs). It is
// earned only through the server's verified-run derivation, from the server's
// own verifiedAt stamp, once per wallet across every cabinet, and it shows in
// the collection with the cross-cabinet cohort's rarity.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACHIEVEMENT_GAME_IDS, ACHIEVEMENT_PARENT_ID, achievementById, catalogFor, deriveEarnedAchievements, emptyHistory, historyFieldsFor, nftAchievementIds, parentCatalog,
} from '../apps/portal/src/achievements/index.mjs';
import { ARCADE_ACHIEVEMENTS, EARLY_SUPPORTER_CUTOFF_ISO, EARLY_SUPPORTER_ID } from '../apps/portal/src/achievements/arcade.mjs';
import { isoStampBefore, verifiedBefore } from '../apps/portal/src/achievements/entry.mjs';
import { buildAchievementCollection } from '../apps/portal/src/achievements/collection-model.mjs';
import { readAchievementHistory } from '../server/neon/queries.mjs';
import { readAchievementStats } from '../server/neon/achievement-stats.mjs';
import { createPgliteClient, seedAchievementUnlock, seedVerifiedSession, seedWalletProfile } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const WALLET = `0x${'ab'.repeat(20)}`;
const W = (n) => `0x${String(n).padStart(2, '0').repeat(20)}`;
const BEFORE = '2026-10-30T23:59:59.999Z';
const AT = '2026-10-31T00:00:00.000Z';
const AFTER = '2026-10-31T00:00:00.001Z';
const run = (gameId, verifiedAt) => ({ gameId, wallet: WALLET, score: 0, stats: {}, ...(verifiedAt === undefined ? {} : { verifiedAt }) });
const ids = (entries) => entries.map((entry) => entry.id);

test('the catalog owns one parent-owned Early Supporter entry, reserved across every cabinet', () => {
  assert.equal(EARLY_SUPPORTER_ID, 'early-supporter');
  assert.equal(EARLY_SUPPORTER_CUTOFF_ISO, '2026-10-31T00:00:00Z', 'placeholder cutoff: the release commit fixes the real one');
  assert.equal(ACHIEVEMENT_PARENT_ID, 'arcade');
  assert.deepEqual(ids(parentCatalog()), ['early-supporter']);
  assert.equal(catalogFor('arcade'), ARCADE_ACHIEVEMENTS);
  const entry = parentCatalog()[0];
  assert.deepEqual([entry.gameId, entry.tier, entry.category, entry.nft, entry.available, entry.progress, entry.order], ['arcade', 'gold', 'founder', false, true, null, 1]);
  assert.equal(entry.title, 'Early Supporter');
  assert.doesNotMatch(`${entry.title} ${entry.description}`, /\bnft|soulbound|mint/i);
  for (const image of [entry.image, entry.lockedImage]) assert.ok(existsSync(join(repoRoot, 'apps/portal', image)), image);
  assert.deepEqual(nftAchievementIds('arcade'), []);
  for (const gameId of ACHIEVEMENT_GAME_IDS) {
    assert.ok(!catalogFor(gameId).some((row) => row.id === 'early-supporter'), `${gameId} has no entry of its own`);
    assert.equal(achievementById(gameId, 'early-supporter'), entry, `${gameId} resolves the parent-owned entry (unlocks are recorded under the cabinet)`);
    assert.deepEqual(historyFieldsFor(gameId).shared, ['early-supporter']);
  }
  assert.equal(achievementById('arcade', 'early-supporter'), entry);
  assert.equal(achievementById('arcade', 'first-blood'), null);
  assert.throws(() => catalogFor('lesters-arcade'), /unknown achievement gameId/);
});

test('the criterion reads only the server verifiedAt stamp: before the cutoff earns, nothing else does', () => {
  const entry = parentCatalog()[0];
  const history = emptyHistory(WALLET, 'chikun');
  assert.equal(entry.criteria(run('chikun', BEFORE), history), true);
  assert.equal(entry.criteria(run('chikun', '2026-01-01T00:00:00.000Z'), history), true);
  assert.equal(entry.criteria(run('chikun', AT), history), false, 'the cutoff itself is excluded');
  assert.equal(entry.criteria(run('chikun', AFTER), history), false);
  // Not verified, or not the server's stamp shape: never earned. A client-shaped
  // run (no verifiedAt) is what a rejected or unverified submission looks like.
  for (const bad of [undefined, null, '', 'yesterday', '2026-10-01', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00.000', ' 2026-10-01T00:00:00.000Z', 1_700_000_000_000, new Date(BEFORE), { iso: BEFORE }, `${BEFORE}\n`]) {
    assert.equal(entry.criteria(run('chikun', bad), history), false, JSON.stringify(String(bad)));
  }
  // The stamp of a run with every claimed stat maxed still needs the date.
  assert.equal(entry.criteria({ ...run('chikun', AFTER), stats: { score: 1e9, laps: 99 } }, { ...history, runs: 500 }), false);
  // Rule builder guards and the string ordering it relies on.
  assert.throws(() => verifiedBefore('2026-10-31'), /invalid verification cutoff/);
  assert.throws(() => verifiedBefore(Date.parse(AT)), /invalid verification cutoff/);
  assert.equal(verifiedBefore('2026-10-31T00:00:00.000Z').criteria(run('stacked', BEFORE)), true);
  assert.equal(isoStampBefore(BEFORE, AT), true);
  assert.equal(isoStampBefore(AT, AT), false);
  assert.equal(isoStampBefore(BEFORE, '2026-10-31T00:00:00Z'), false, 'both sides must carry milliseconds');
});

test('derivation earns it from any cabinet, after that cabinet\'s own entries, once per wallet', () => {
  for (const gameId of ACHIEVEMENT_GAME_IDS) {
    const history = emptyHistory(WALLET, gameId);
    const earned = ids(deriveEarnedAchievements(gameId, run(gameId, BEFORE), history));
    assert.equal(earned.at(-1), 'early-supporter', gameId);
    assert.ok(earned.slice(0, -1).every((id) => achievementById(gameId, id).gameId === gameId), `${gameId} own entries come first`);
    assert.deepEqual(ids(deriveEarnedAchievements(gameId, run(gameId, BEFORE), history)), earned, 'derivation is pure');
    assert.ok(!ids(deriveEarnedAchievements(gameId, run(gameId, AFTER), history)).includes('early-supporter'), `${gameId} after the cutoff`);
    assert.ok(!ids(deriveEarnedAchievements(gameId, run(gameId), history)).includes('early-supporter'), `${gameId} without a server stamp`);
    // Held already, under any cabinet (the history lists shared ids from every cabinet): not earned again.
    const held = { ...history, unlockedIds: ['early-supporter'] };
    assert.ok(!ids(deriveEarnedAchievements(gameId, run(gameId, BEFORE), held)).includes('early-supporter'), `${gameId} idempotent`);
  }
  assert.throws(() => deriveEarnedAchievements('arcade', run('arcade', BEFORE), emptyHistory(WALLET, 'chikun')), /unknown achievement gameId/, 'the parent catalog is not a cabinet a run can belong to');
});

test('the wallet history lists a parent-owned unlock from another cabinet, and only validated shared ids reach SQL', async () => {
  const db = createPgliteClient();
  try {
    const chikun = await seedVerifiedSession(db, { wallet: WALLET, gameId: 'chikun' });
    await seedAchievementUnlock(db, { wallet: WALLET, gameId: 'chikun', achievementId: 'early-supporter', sessionId32: chikun.sessionId32, tier: 'gold' });
    await seedAchievementUnlock(db, { wallet: WALLET, gameId: 'chikun', achievementId: 'chikun-first-flight', sessionId32: chikun.sessionId32 });
    const other = await seedVerifiedSession(db, { wallet: W(2), gameId: 'stacked' });
    await seedAchievementUnlock(db, { wallet: W(2), gameId: 'stacked', achievementId: 'early-supporter', sessionId32: other.sessionId32, tier: 'gold' });
    const fields = historyFieldsFor('lester-blaster');
    const hmh = await readAchievementHistory(db, { wallet: WALLET, gameId: 'lester-blaster', fields });
    assert.deepEqual([hmh.runs, hmh.unlockedIds], [0, ['early-supporter']], 'the Chikun-recorded badge counts for an HMH run; Chikun\'s own ids do not');
    const legacy = await readAchievementHistory(db, { wallet: WALLET, gameId: 'lester-blaster', fields: { sum: fields.sum, max: fields.max } });
    assert.deepEqual(legacy.unlockedIds, [], 'without shared ids the history stays cabinet-bound');
    const own = await readAchievementHistory(db, { wallet: WALLET, gameId: 'chikun', fields: historyFieldsFor('chikun') });
    assert.deepEqual(own.unlockedIds, ['chikun-first-flight', 'early-supporter'], 'listed once, sorted');
    assert.deepEqual((await readAchievementHistory(db, { wallet: W(3), gameId: 'stacked', fields: historyFieldsFor('stacked') })).unlockedIds, []);
  } finally { await db.close(); }
  const calls = [];
  const spy = { async query(sql) { calls.push(sql); return [{ runs: 0 }]; } };
  for (const bad of ["x') OR 1=1 --", 'Early-Supporter', 'a', 42, '']) {
    await assert.rejects(readAchievementHistory(spy, { wallet: WALLET, gameId: 'chikun', fields: { sum: [], max: [], shared: [bad] } }), TypeError, JSON.stringify(bad));
  }
  assert.equal(calls.length, 0);
});

test('rarity for the parent-owned catalog counts every cabinet\'s eligible players and each wallet once', async () => {
  const db = createPgliteClient();
  try {
    const a = await seedVerifiedSession(db, { wallet: W(1), gameId: 'chikun' });
    const aHmh = await seedVerifiedSession(db, { wallet: W(1), gameId: 'lester-blaster' });
    const b = await seedVerifiedSession(db, { wallet: W(2), gameId: 'stacked', status: 'pending' });
    await seedVerifiedSession(db, { wallet: W(3), gameId: 'lester-blaster' });
    const excluded = await seedVerifiedSession(db, { wallet: W(4), gameId: 'chikun' });
    await seedWalletProfile(db, { wallet: W(4), boardExcluded: true });
    const mismatch = await seedVerifiedSession(db, { wallet: W(5), gameId: 'stacked', chainMismatch: true });
    for (const [wallet, session, gameId] of [[W(1), a, 'chikun'], [W(1), aHmh, 'lester-blaster'], [W(2), b, 'stacked'], [W(4), excluded, 'chikun'], [W(5), mismatch, 'stacked']]) {
      await seedAchievementUnlock(db, { wallet, gameId, sessionId32: session.sessionId32, achievementId: 'early-supporter', tier: 'gold' });
    }
    const snapshot = await readAchievementStats(db, { gameId: 'arcade' });
    assert.equal(snapshot.rankedPlayers, 3, 'W1 (two cabinets), W2 (pending publication) and W3; not the board-excluded or mismatched wallets');
    assert.deepEqual(snapshot.achievements, [{ id: 'early-supporter', unlockedPlayers: 2, rarity: 'early', label: 'Early', percentage: null }], 'W1 counts once across two cabinets; fewer than 20 players stays Early');
    const chikun = await readAchievementStats(db, { gameId: 'chikun' });
    assert.equal(chikun.achievements.length, 40, 'a cabinet snapshot never lists the parent-owned entry');
    assert.equal(chikun.rankedPlayers, 1);
    assert.equal(JSON.stringify(snapshot).includes('0x0'), false, 'no wallets in the public snapshot');
    // The public adapter accepts the parent id as a game value (case-insensitive), with the cabinet aliases unchanged.
    const api = await import('../api/achievements/stats.mjs');
    const handler = api.createHandler(() => api.buildDeps({ VERCEL_ENV: 'development' }, { db, nowMs: () => Date.parse('2026-09-30T12:00:00.000Z') }));
    for (const game of ['arcade', 'ARCADE', ' Arcade ']) {
      const response = await invoke(handler, { url: `/api/achievements/stats?game=${encodeURIComponent(game)}` });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.deepEqual([response.body.gameId, response.body.rankedPlayers, response.body.achievements[0].id, response.body.achievements[0].rarity, response.body.cohort], ['arcade', 3, 'early-supporter', 'early', 'verified-ranked-all-time']);
    }
    assert.equal((await invoke(handler, { url: '/api/achievements/stats?game=parent' })).status, 400);
  } finally { await db.close(); }
});

test('the collection shows it in its own section, owned whichever cabinet recorded it, with honest Early rarity', () => {
  const unlocks = [{ id: 'early-supporter', gameId: 'chikun', unlockedAt: '2026-09-29T12:00:00.000Z' }];
  const model = buildAchievementCollection({ unlocks });
  const arcade = model.games.find((game) => game.gameId === 'arcade');
  assert.deepEqual([arcade.title, arcade.total, arcade.unlocked, arcade.trophies.total], ['Lester’s Arcade', 1, 1, 0]);
  assert.equal(model.games.find((game) => game.gameId === 'chikun').unlocked, 0, 'the recording cabinet does not claim it');
  const row = model.rows.find((item) => item.id === 'early-supporter');
  assert.deepEqual([row.gameId, row.gameTitle, row.unlocked, row.unlockedAt, row.rarity, row.nft], ['arcade', 'Lester’s Arcade', true, '2026-09-29T12:00:00.000Z', null, false]);
  assert.equal(model.rarest, null, 'no population, no rarest badge');
  const early = { ok: true, gameId: 'arcade', cohort: 'verified-ranked-all-time', minimumPlayers: 20, rankedPlayers: 19, achievements: [{ id: 'early-supporter', unlockedPlayers: 7 }] };
  const withPopulation = buildAchievementCollection({ unlocks, statsByGame: { arcade: early }, gameId: 'arcade' });
  assert.equal(withPopulation.rows.length, 1);
  assert.deepEqual(withPopulation.rows[0].rarity, { rarity: 'early', label: 'Early', percentage: null, unlockedPlayers: 7, rankedPlayers: 19 });
  assert.equal(withPopulation.rarest, null, 'Early never invents a rarest badge');
  const common = buildAchievementCollection({ unlocks, statsByGame: { arcade: { ...early, rankedPlayers: 20, achievements: [{ id: 'early-supporter', unlockedPlayers: 20 }] } } });
  assert.deepEqual([common.rarest.id, common.rarest.rarity.label, common.rarest.rarity.percentage], ['early-supporter', 'Common', 100]);
  // A cabinet snapshot cannot stand in for the parent-owned population, and an unknown section is rejected.
  const wrong = buildAchievementCollection({ unlocks, statsByGame: { arcade: { ...early, gameId: 'chikun' } } });
  assert.equal(wrong.rows.find((item) => item.id === 'early-supporter').rarity, null);
  assert.throws(() => buildAchievementCollection({ gameId: 'parent' }), /unknown collection game/);
  assert.equal(buildAchievementCollection({ unlocks: [{ id: 'early-supporter', gameId: 'arcade', unlockedAt: null }] }).unlocked, 1, 'a row already labelled arcade is accepted too');
});
