import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import * as jackpotApi from '../api/jackpot.mjs';
import * as replayApi from '../api/jackpot-replay.mjs';
import * as reviewApi from '../api/jackpot-review.mjs';
import { importChikunReplay } from '../apps/chikun/src/replay-file.mjs';
import { issueSessionToken } from '../apps/portal/src/server-session.mjs';
import { JACKPOT_CACHE_CONTROL, REPLAY_CACHE_CONTROL, potFields, publicReview, publicWeekStatus } from '../server/jackpot/api-model.mjs';
import { clearAdminCache } from '../server/jackpot/review-model.mjs';
import { casWeekStatus, ensureWeekRow, updateWeek } from '../server/jackpot/store.mjs';
import { boundsIsoOf, dateRangeLabel, weekKeyOfIndex } from '../server/jackpot/weeks.mjs';
import { cardRevision, readPublicProfile, readPublicSession } from '../server/neon/queries.mjs';
import { buildShareCardElement } from '../server/share/render-card.mjs';
import { renderSharePage } from '../server/share/render-page.mjs';
import { createPgliteClient, seedWalletProfile } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import { SETTLE_SESSION_VALUE } from './helpers/settle-fixtures.mjs';
import { DAY, HOUR, TOKEN, bootJackpotChain } from './fixtures/jackpot-server/chain-harness.mjs';
import { createCronDriver } from './fixtures/jackpot-server/cron-driver.mjs';

/**
 * jackpot-server AC11-AC13 (design §C.5, §C.6): GET /api/jackpot has the
 * exact shape the jackpot-ui slice builds against, from the Neon mirrors
 * only; the replay endpoint serves closed-week candidates only; the review
 * endpoint answers only the live on-chain admin. AC15 (design §C.7): the
 * profile's jackpot.wins and the share champion badge come from finished,
 * paid (or claim-pending) weeks with a prize above 0 only.
 */

let h;
let db;
let d;
let runA;
let runB;
let runC;
let W;

before(async () => {
  h = await bootJackpotChain();
  db = createPgliteClient();
  d = createCronDriver(h, db);
  W = h.W;
  // Week W: two players, 1,000 tCHIKUN, walked to paid by the cron.
  await d.advance(h.bounds(W).start + DAY);
  runA = await d.play(await h.player(0), { openAt: h.bounds(W).start + DAY + 600, untilTick: 4200, weekIndex: W });
  runB = await d.play(await h.player(1), { openAt: h.bounds(W).start + DAY + 1200, untilTick: 1800, weekIndex: W });
  await seedWalletProfile(db, { wallet: runA.wallet, displayName: 'Hidden Ace', hidden: true });
  await seedWalletProfile(db, { wallet: runB.wallet, displayName: 'Bee Pilot' });
  await h.fund(W, 1_000n * TOKEN);
  await d.walkToPaid(W);
});

after(async () => {
  await db?.close();
  await h?.close();
});

const call = (module, url, { env = {}, overrides = {}, headers = {} } = {}) => invoke(module.createHandler(() => module.buildDeps(d.env(env), d.overrides(overrides))), { url, headers });

function bearer(wallet) {
  const { token } = issueSessionToken({ createHmac, timingSafeEqual }, { secret: SETTLE_SESSION_VALUE, wallet: wallet.toLowerCase(), nowMs: d.clockMs, audience: 'lestersarcade:development' });
  return { authorization: `Bearer ${token}` };
}

test('jackpot API shape, cache header and allowlist', async () => {
  // Week W+1 is current; W is the previous week, paid.
  const response = await call(jackpotApi, '/api/jackpot');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.headers['cache-control'], JACKPOT_CACHE_CONTROL);
  assert.equal(JACKPOT_CACHE_CONTROL, 'public, s-maxage=30, stale-while-revalidate=120');
  const body = response.body;
  assert.deepEqual(Object.keys(body), ['ok', 'live', 'game', 'chainId', 'contract', 'explorer', 'token', 'serverTime', 'indexedBlock', 'current', 'previous', 'history', 'rulesUrl']);
  assert.deepEqual([body.ok, body.live, body.game, body.chainId, body.contract, body.explorer, body.rulesUrl], [true, true, 'chikun', 4441, h.contract, 'https://liteforge.explorer.caldera.xyz', '/jackpot/chikun']);
  assert.deepEqual(body.token, { address: h.jackpotDeployment.instances.chikun.token.address, symbol: 'tCHIKUN', decimals: 18, testnet: true });
  assert.equal(body.serverTime, new Date(d.clockMs).toISOString());
  assert.ok(Number.isSafeInteger(body.indexedBlock) && body.indexedBlock > 0);
  assert.deepEqual(Object.keys(body.current), ['weekKey', 'weekIndex', 'status', 'startsAt', 'closesAt', 'settleCutoffAt', 'candidateUntil', 'payoutAt', 'rules', 'pot', 'leader']);
  assert.deepEqual([body.current.weekKey, body.current.weekIndex, body.current.status], [weekKeyOfIndex(W + 1), W + 1, 'open']);
  assert.deepEqual(body.current.rules, { minPaidWei: '100000000000000000', maxSurvivalSeconds: 3599, minFundWei: (100n * TOKEN).toString(), adminClearOnly: false });
  assert.deepEqual(Object.keys(body.current.pot), ['fundedWei', 'carriedInWei', 'totalWei', 'prizeCapWei', 'prizeWei', 'carryOverWei', 'funded']);
  assert.deepEqual(body.current.pot, { fundedWei: '0', carriedInWei: '0', totalWei: '0', prizeCapWei: null, prizeWei: '0', carryOverWei: '0', funded: false });
  assert.equal(body.current.leader, null);
  // The previous week: paid, with its own token, candidates with public review values, a hidden winner's name withheld.
  const previous = body.previous;
  assert.deepEqual(Object.keys(previous), ['weekKey', 'status', 'payoutAt', 'token', 'pot', 'candidates', 'winner', 'prizeWei', 'unclaimedWei', 'finalizeTx']);
  assert.deepEqual([previous.weekKey, previous.status, previous.prizeWei, previous.unclaimedWei], [weekKeyOfIndex(W), 'paid', (1_000n * TOKEN).toString(), '0']);
  assert.deepEqual(previous.token, { symbol: 'tCHIKUN', decimals: 18, testnet: true });
  assert.deepEqual(previous.winner, { walletShort: `${runA.wallet.slice(0, 6)}…${runA.wallet.slice(-4)}`, wallet: runA.wallet, displayName: null }, 'a hidden wallet shows only its short form');
  assert.match(previous.finalizeTx, /^0x[0-9a-f]{64}$/);
  assert.deepEqual(previous.candidates.map((row) => [row.rank, row.displayName, row.score, row.review, row.replay]), [
    [1, null, runA.score, 'cleared', `/api/jackpot/replay?session=${runA.sessionId32}`],
    [2, 'Bee Pilot', runB.score, 'cleared', `/api/jackpot/replay?session=${runB.sessionId32}`],
  ]);
  assert.deepEqual(Object.keys(previous.candidates[0]), ['rank', 'walletShort', 'displayName', 'score', 'review', 'replay'], 'no wallet or features in public');
  assert.deepEqual(body.history, []);
  assert.doesNotMatch(JSON.stringify(body), /features|screen|H[0-9]|Hidden Ace/, 'owner-only data never leaves the review API');

  // The allowlist: only game=chikun and history 0-26.
  for (const url of ['/api/jackpot?cb=1', '/api/jackpot?game=stacked', '/api/jackpot?history=27', '/api/jackpot?history=-1', '/api/jackpot?history=abc']) {
    const bad = await call(jackpotApi, url);
    assert.deepEqual([bad.status, bad.body.error], [400, 'invalid-query'], url);
  }
  assert.equal((await call(jackpotApi, '/api/jackpot?game=chikun&history=0')).status, 200);

  // live:false: the committed undeployed module, a missing keeper key, and JACKPOT_UI_HIDDEN.
  for (const [label, options] of [
    ['undeployed', { overrides: { jackpotDeployment: undefined } }],
    ['unconfigured', { env: { JACKPOT_KEEPER_PRIVATE_KEY: '' } }],
    ['hidden', { env: { JACKPOT_UI_HIDDEN: 'true' } }],
  ]) {
    const hidden = await call(jackpotApi, '/api/jackpot', options);
    assert.deepEqual([hidden.status, hidden.body, hidden.headers['cache-control']], [200, { ok: true, live: false, game: 'chikun' }, JACKPOT_CACHE_CONTROL], label);
  }
  // The jackpot handlers accept jackpotDeployment next to the A30 overrides; the index deps keep theirs.
  const deps = await jackpotApi.buildDeps(d.env(), { db, jackpotDeployment: h.jackpotDeployment, deployment: h.deployment });
  assert.deepEqual(Object.keys(deps).sort(), ['config', 'crypto', 'db', 'deployment', 'fetchImpl', 'nowMs', 'provider']);
  assert.equal(deps.config.jackpot.ready, true);
  assert.deepEqual(['open', 'closed', 'selecting', 'review', 'awaiting-admin', 'finalizing', 'paid', 'claim-pending', 'rolled', 'unfunded', 'failed'].map((status) => publicWeekStatus(status)),
    ['review', 'review', 'review', 'review', 'awaiting-admin', 'review', 'paid', 'claim-pending', 'rolled', 'unfunded', 'review']);
  assert.deepEqual(['none', 'cleared', 'flagged', 'disqualified'].map(publicReview), ['in-review', 'cleared', 'in-review', 'disqualified']);
});

test('jackpot API never reports an amount that was not funded on chain, and reports the capped prize', async () => {
  // Tokens sent straight to the contract are stray: never reported.
  await (await h.token.connect(h.wallets.operator).mint(h.wallets.operator.address, 50n * TOKEN)).wait();
  await (await h.token.connect(h.wallets.operator).transfer(h.contract, 50n * TOKEN)).wait();
  // Week W+2 carries a 100 tCHIKUN prize cap and is pre-funded with 300.
  const epoch = { ...(await h.jackpot.rulesAt(0)).toObject(), fromWeek: W + 2, maxPrizeWei: 100n * TOKEN };
  await (await h.jackpot.connect(h.wallets.operator).scheduleRules(epoch)).wait();
  await h.fund(W + 2, 300n * TOKEN);
  let body = (await call(jackpotApi, '/api/jackpot')).body;
  assert.equal(body.current.pot.totalWei, '0', 'before the index runs, nothing: a lagging index only under-reports');
  await d.cron();
  body = (await call(jackpotApi, '/api/jackpot')).body;
  assert.deepEqual(body.current.pot, { fundedWei: '0', carriedInWei: '0', totalWei: '0', prizeCapWei: null, prizeWei: '0', carryOverWei: '0', funded: false }, 'the stray 50 is not a pot');

  await d.advance(h.bounds(W + 2).start + HOUR);
  const runner = await h.player(2);
  runC = await d.play(runner, { openAt: h.bounds(W + 2).start + 2 * HOUR, untilTick: 3000, weekIndex: W + 2 });
  await d.advance(h.bounds(W + 2).start + 3 * HOUR);
  await d.cron();
  body = (await call(jackpotApi, '/api/jackpot')).body;
  assert.equal(body.current.weekKey, weekKeyOfIndex(W + 2));
  assert.deepEqual(body.current.pot, {
    fundedWei: (300n * TOKEN).toString(), carriedInWei: '0', totalWei: (300n * TOKEN).toString(), prizeCapWei: (100n * TOKEN).toString(),
    prizeWei: (100n * TOKEN).toString(), carryOverWei: (200n * TOKEN).toString(), funded: true,
  }, 'what the winner can receive: min(pot, cap)');
  // The open week's leader: its score only, provisional, not screened.
  assert.deepEqual(body.current.leader, { score: runC.score, provisional: true, screened: false });
  assert.doesNotMatch(JSON.stringify(body.current), new RegExp(runC.wallet.slice(2, 12)), 'no wallet for the open week');
  // W+1 (never funded) is now the previous week; W is history with its own token and contract.
  assert.deepEqual([body.previous.weekKey, body.previous.status, body.previous.winner, body.previous.prizeWei], [weekKeyOfIndex(W + 1), 'unfunded', null, null]);
  assert.equal(body.history.length, 1);
  const paid = body.history[0];
  assert.deepEqual(Object.keys(paid), ['weekKey', 'startsAt', 'closesAt', 'status', 'token', 'contract', 'winner', 'score', 'prizeWei', 'unclaimedWei', 'finalizeTx', 'replay', 'rolledTo']);
  assert.deepEqual([paid.weekKey, paid.status, paid.contract, paid.token.symbol, paid.score, paid.prizeWei, paid.replay, paid.rolledTo],
    [weekKeyOfIndex(W), 'paid', h.contract, 'tCHIKUN', runA.score, (1_000n * TOKEN).toString(), `/api/jackpot/replay?session=${runA.sessionId32}`, null]);
  assert.deepEqual([paid.startsAt, paid.closesAt], [new Date(h.bounds(W).start * 1000).toISOString(), new Date(h.bounds(W).close * 1000).toISOString()]);
  assert.equal((await call(jackpotApi, '/api/jackpot?history=0')).body.history.length, 0);
  // potFields honesty on its own: under the week's minimum fund, not funded.
  assert.equal(potFields({ fundedWei: String(99n * TOKEN), rules: { minFundWei: String(100n * TOKEN), maxPrizeWei: '0' } }).funded, false);
  assert.equal(potFields({ fundedWei: '5', rules: null }).funded, false, 'no rules mirrored: never funded');
});

test('replay endpoint serves only closed-week candidates', async () => {
  const replay = await call(replayApi, `/api/jackpot/replay?session=${runA.sessionId32}`);
  assert.equal(replay.status, 200);
  assert.equal(replay.headers['cache-control'], REPLAY_CACHE_CONTROL);
  assert.equal(REPLAY_CACHE_CONTROL, 'public, s-maxage=3600, stale-while-revalidate=86400');
  assert.deepEqual(Object.keys(replay.body), ['format', 'game', 'evidence']);
  const imported = importChikunReplay(JSON.stringify(replay.body));
  assert.equal(imported.score, runA.score, 'importChikunReplay replays it to the same score');
  // The open week's leader is not a closed-week candidate; neither is an unknown session.
  for (const session of [runC.sessionId32, `0x${'ab'.repeat(32)}`, 'nope']) {
    const missing = await call(replayApi, `/api/jackpot/replay?session=${session}`);
    assert.deepEqual([missing.status, missing.body.error, missing.headers['cache-control']], [404, 'not-available', 'public, s-maxage=60'], session);
  }
  assert.equal((await call(replayApi, `/api/jackpot/replay?session=${runA.sessionId32}&cb=1`)).status, 400);
  assert.equal((await call(replayApi, `/api/jackpot/replay?session=${runA.sessionId32}`, { env: { JACKPOT_UI_HIDDEN: 'true' } })).status, 404);
});

test('review endpoint requires the current on-chain admin', async () => {
  clearAdminCache();
  const url = `/api/jackpot/review?week=${weekKeyOfIndex(W)}`;
  const admin = h.wallets.developer;
  const none = await call(reviewApi, url);
  assert.deepEqual([none.status, none.body.error, none.headers['cache-control']], [401, 'invalid-session', 'no-store']);
  const stranger = await call(reviewApi, url, { headers: bearer(runB.wallet) });
  assert.deepEqual([stranger.status, stranger.body.error], [403, 'not-admin']);
  const ok = await call(reviewApi, url, { headers: bearer(admin.address) });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.headers['cache-control'], 'no-store');
  const body = ok.body;
  assert.deepEqual([body.contract, body.weekKey, body.week.status, body.week.winner], [h.contract, weekKeyOfIndex(W), 'paid', runA.wallet]);
  assert.equal(body.candidates.length, 2);
  const a = body.candidates.find((row) => row.sessionId32 === runA.sessionId32);
  assert.deepEqual([a.listing, a.review, a.adminReviewed, a.wasListed, a.reviewSource, a.screen], ['listed', 'cleared', false, true, 'chain', 'pass']);
  assert.ok(a.features && typeof a.features.flapsPerMinute === 'number' && typeof a.features.evidenceDelaySeconds === 'number');
  assert.ok(a.soft && Object.hasOwn(a.soft, 'S10') && a.soft.S11);
  assert.deepEqual([a.integrity.ok, a.provenance.status], [true, 'ok']);
  assert.ok(a.timeline.altitude.length > 10 && Array.isArray(a.timeline.obstacles));
  assert.deepEqual(a.actions.map((action) => [action.kind, action.status]).sort(), [['clear', 'confirmed'], ['submit', 'confirmed']]);
  assert.ok(a.actions.every((action) => action.explorerUrl?.startsWith('https://liteforge.explorer.caldera.xyz/tx/')));
  assert.equal(a.explorer.wallet, `https://liteforge.explorer.caldera.xyz/address/${runA.wallet}`);
  assert.ok(a.recentRuns.length >= 1 && a.recentRuns.length <= 20);
  assert.deepEqual(Object.keys(a.recentRuns[0]).sort(), ['playedAt', 'score', 'sessionId32', 'source', 'status', 'survivalSeconds', 'weekKey']);
  assert.ok(body.holdRuleText.H9 && body.softSignalText.S8 && body.rubric.includes('admin-review-rubric'));
  assert.deepEqual(body.nextEligible, [], 'every eligible row is listed');
  assert.equal((await call(reviewApi, '/api/jackpot/review?week=2026-w40', { headers: bearer(admin.address) })).status, 400);

  // JACKPOT_ADMIN_WALLET is an extra constraint, never the only gate.
  const other = await call(reviewApi, url, { headers: bearer(admin.address), env: { JACKPOT_ADMIN_WALLET: runB.wallet } });
  assert.deepEqual([other.status, other.body.error], [403, 'not-admin']);
  const invalid = await call(reviewApi, url, { headers: bearer(admin.address), env: { JACKPOT_ADMIN_WALLET: 'garbage' } });
  assert.equal(invalid.status, 403);
  const envOnly = await call(reviewApi, url, { headers: bearer(runB.wallet), env: { JACKPOT_ADMIN_WALLET: runB.wallet } });
  assert.equal(envOnly.status, 403, 'the env wallet alone is not the admin');

  // An emergency forceAdmin: the old admin loses access once the 60 s cache expires.
  const newAdmin = await h.player(7);
  await (await h.jackpot.connect(h.wallets.operator).forceAdmin(newAdmin.address)).wait();
  assert.equal((await call(reviewApi, url, { headers: bearer(admin.address) })).status, 200, 'still cached');
  d.clockMs += 61_000;
  assert.equal((await call(reviewApi, url, { headers: bearer(admin.address) })).status, 403, 'the rotated-out admin');
  assert.equal((await call(reviewApi, url, { headers: bearer(newAdmin.address) })).status, 200, 'the new admin');
  assert.equal(ethers.getAddress(await h.jackpot.admin()), newAdmin.address);
});

// A week row of another (retired) instance, straight into the mirror: its
// own token, any status, prize and winner.
const OTHER_CONTRACT = `0x${'c3'.repeat(20)}`;
const OTHER_TOKEN = Object.freeze({ address: `0x${'d4'.repeat(20)}`, symbol: 'CHIKUN', decimals: 9, testnet: false });
async function otherWeek(index, { status, prizeWei = null, unclaimedWei = '0', winner = null, session = null, score = null }) {
  await ensureWeekRow(db, { contract: OTHER_CONTRACT, weekIndex: index, token: OTHER_TOKEN });
  const weekKey = weekKeyOfIndex(index);
  const current = (await db.query('SELECT status FROM jackpot_weeks WHERE contract = $1 AND week_key = $2', [OTHER_CONTRACT, weekKey]))[0].status;
  if (current !== status) assert.equal(await casWeekStatus(db, { contract: OTHER_CONTRACT, weekKey, from: current, to: status }), true);
  await updateWeek(db, { contract: OTHER_CONTRACT, weekKey, set: { prize_wei: prizeWei, unclaimed_wei: unclaimedWei, winner, winning_session: session, winning_score: score } });
}

test('profile lists jackpot wins with their own token and never zero-prize weeks', async () => {
  const paid = await d.week(W);
  assert.equal(paid.status, 'paid');
  // A zero-prize "paid" week, a rolled week and a still-open week of the same wallet never list.
  await otherWeek(W - 12, { status: 'paid', prizeWei: '0', winner: runA.wallet, session: `0x${'e1'.repeat(32)}`, score: '5' });
  await otherWeek(W - 11, { status: 'rolled', prizeWei: '0', winner: null });
  await otherWeek(W - 10, { status: 'review', winner: null });
  // A claim-pending win on the other instance lists with that instance's token.
  await otherWeek(W - 9, { status: 'claim-pending', prizeWei: '4200000000', unclaimedWei: '4200000000', winner: runA.wallet, session: `0x${'e2'.repeat(32)}`, score: '321' });
  try {
    const profile = await readPublicProfile(db, runA.wallet, { nowMs: d.clockMs, catalog: null });
    const bounds = boundsIsoOf(W);
    assert.deepEqual(profile.jackpot.wins, [
      {
        weekKey: weekKeyOfIndex(W), startsAt: bounds.startsAt, closesAt: bounds.closesAt, prizeWei: (1_000n * TOKEN).toString(), unclaimedWei: '0', status: 'paid',
        token: { symbol: 'tCHIKUN', decimals: 18, testnet: true }, contract: h.contract, score: runA.score, sessionId: runA.sessionId32, finalizeTx: paid.finalizeTxHash,
      },
      {
        weekKey: weekKeyOfIndex(W - 9), startsAt: boundsIsoOf(W - 9).startsAt, closesAt: boundsIsoOf(W - 9).closesAt, prizeWei: '4200000000', unclaimedWei: '4200000000', status: 'claim-pending',
        token: { symbol: 'CHIKUN', decimals: 9, testnet: false }, contract: OTHER_CONTRACT, score: 321, sessionId: `0x${'e2'.repeat(32)}`, finalizeTx: null,
      },
    ]);
    assert.match(paid.finalizeTxHash, /^0x[0-9a-f]{64}$/);
    // Every profile has the field, so the shape is stable.
    assert.deepEqual((await readPublicProfile(db, runB.wallet, { nowMs: d.clockMs, catalog: null })).jackpot, { wins: [] });
    assert.deepEqual((await readPublicProfile(db, `0x${'0f'.repeat(20)}`, { nowMs: d.clockMs, catalog: null })).jackpot, { wins: [] });
  } finally {
    await db.query('DELETE FROM jackpot_weeks WHERE contract = $1', [OTHER_CONTRACT]);
  }
});

test('share badge marks paid champions and busts the card cache', async () => {
  const champion = await readPublicSession(db, runA.sessionId32);
  const startsAt = boundsIsoOf(W).startsAt;
  const label = `Weekly Jackpot Champion · ${dateRangeLabel(startsAt)}`;
  assert.match(label, /^Weekly Jackpot Champion · [A-Z][a-z]{2} \d{1,2} – ([A-Z][a-z]{2} )?\d{1,2}, \d{4}$/, 'a date range, never an ISO week key');
  assert.deepEqual(champion.jackpotChampion, { weekKey: weekKeyOfIndex(W), startsAt, closesAt: boundsIsoOf(W).closesAt, label });
  const plain = { status: champion.status, displayName: champion.displayName, avatarUri: champion.avatarUri, hidden: true, verification: champion.verification };
  assert.equal(champion.cardRev, await cardRevision({ ...plain, champion: label }));
  assert.notEqual(champion.cardRev, await cardRevision(plain), 'the badge changes the card revision, so cached cards refresh');
  const page = renderSharePage({ session: champion });
  assert.ok(page.html.includes(`<p class="champion">${label}</p>`), 'the share page shows the badge');
  assert.ok(page.html.includes(`?v=${champion.cardRev}`), 'og:image carries the new revision');
  assert.ok(JSON.stringify(buildShareCardElement({ session: champion })).includes(label), 'the card shows the badge');
  assert.doesNotMatch(page.html, /\d{4}-W\d{2}/, 'no ISO week key on the page');

  // A non-winning run has no badge and keeps its revision.
  const other = await readPublicSession(db, runB.sessionId32);
  assert.equal(other.jackpotChampion, null);
  assert.equal(other.cardRev, await cardRevision({ status: other.status, displayName: other.displayName, avatarUri: other.avatarUri, hidden: false, verification: other.verification }));
  assert.equal(renderSharePage({ session: other }).html.includes('Jackpot'), false);

  // A leader, a zero-prize week or an unconfirmed run never shows the badge on a cached asset.
  const before = other.cardRev;
  try {
    await otherWeek(W - 8, { status: 'review', winner: runB.wallet, session: runB.sessionId32, score: String(runB.score) });
    assert.equal((await readPublicSession(db, runB.sessionId32)).jackpotChampion, null, 'a week under review has no champion');
    await otherWeek(W - 8, { status: 'paid', prizeWei: '0', winner: runB.wallet, session: runB.sessionId32, score: String(runB.score) });
    assert.equal((await readPublicSession(db, runB.sessionId32)).cardRev, before, 'a zero-prize week is not a win');
    await otherWeek(W - 8, { status: 'paid', prizeWei: '7', winner: `0x${'0f'.repeat(20)}`, session: runB.sessionId32, score: String(runB.score) });
    assert.equal((await readPublicSession(db, runB.sessionId32)).jackpotChampion, null, 'the badge belongs to the winning wallet only');
    await otherWeek(W - 8, { status: 'paid', prizeWei: '7', winner: runB.wallet, session: runB.sessionId32, score: String(runB.score) });
    const now = await readPublicSession(db, runB.sessionId32);
    assert.equal(now.jackpotChampion.label, `Weekly Jackpot Champion · ${dateRangeLabel(boundsIsoOf(W - 8).startsAt)}`);
    assert.notEqual(now.cardRev, before, 'a new win busts the card cache');
    const unconfirmed = { ...now, status: 'submitted' };
    assert.equal(renderSharePage({ session: unconfirmed }).html.includes('Jackpot Champion'), false, 'only a confirmed run carries the badge');
    assert.equal(JSON.stringify(buildShareCardElement({ session: unconfirmed })).includes('Jackpot'), false);
  } finally {
    await db.query('DELETE FROM jackpot_weeks WHERE contract = $1', [OTHER_CONTRACT]);
  }
});
