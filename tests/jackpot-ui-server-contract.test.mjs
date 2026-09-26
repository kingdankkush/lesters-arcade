import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { after, before } from 'node:test';

import * as jackpotApi from '../api/jackpot.mjs';
import * as reviewApi from '../api/jackpot-review.mjs';
import { buildChikunJackpotTease } from '../apps/chikun/src/presentation.mjs';
import { integrityText, normalizeReview, timelineGeometry } from '../apps/portal/owner/jackpot-review-model.mjs';
import { currentPrize, leaderScoreText, parseJackpot, phaseOf, weekRangeText } from '../apps/portal/src/jackpot/jackpot-client.mjs';
import { renderJackpotWins } from '../apps/portal/src/jackpot/jackpot-profile-wins.mjs';
import { issueSessionToken } from '../apps/portal/src/server-session.mjs';
import { analyzeChikunEvidence, reviewTimeline, unexplainedDescents } from '../server/jackpot/plausibility.mjs';
import { clearAdminCache } from '../server/jackpot/review-model.mjs';
import { weekKeyOfIndex } from '../server/jackpot/weeks.mjs';
import { readPublicProfile } from '../server/neon/queries.mjs';
import { DAY, TOKEN, bootJackpotChain } from './fixtures/jackpot-server/chain-harness.mjs';
import { createCronDriver } from './fixtures/jackpot-server/cron-driver.mjs';
import { invoke } from './helpers/fake-http.mjs';
import { fakeDocument, visibleText } from './helpers/jackpot-fake-dom.mjs';
import { createPgliteClient, seedWalletProfile } from './helpers/pglite-client.mjs';
import { SETTLE_SESSION_VALUE } from './helpers/settle-fixtures.mjs';

/**
 * jackpot-ui against the real jackpot-server (review finding 3; brief "Produced": parseJackpot and
 * jackpot-review-model.mjs). The surfaces and the owner page were built from design §C.5-§C.7 and the
 * server branch's field names; this suite feeds them what the merged handlers really answer:
 *   - reviewTimeline() of real replays: the owner page marks exactly the server's look-ahead verdicts
 *     (S8 unexplained descents), never an honest run's early route commitment;
 *   - GET /api/jackpot (jackpotApiBody) on the in-process chain and PGlite, walked to a paid week by
 *     the real cron: parseJackpot accepts every answer and the surfaces read it;
 *   - readPublicProfile's jackpot.wins: the profile's Jackpot Champion section renders them;
 *   - GET /api/jackpot/review (jackpotReviewBody) for the admin: normalizeReview keeps every candidate
 *     and every field the owner page shows.
 */

const REPLAYS = JSON.parse(readFileSync(new URL('./fixtures/chikun-v6-replays.json', import.meta.url), 'utf8')).runs;
const WIDENED = JSON.parse(readFileSync(new URL('./fixtures/jackpot-server/widened-view-pilot.json', import.meta.url), 'utf8')).evidence;

test('the owner timeline marks exactly the server look-ahead verdicts on real replays', () => {
  const counts = {};
  for (const [label, evidence] of [...REPLAYS.map((run) => [run.profile, run.evidence]), ['widened-view pilot', WIDENED]]) {
    const analysis = analyzeChikunEvidence(evidence);
    // As the review API sends it (JSON), drawn as the owner page draws it.
    const served = JSON.parse(JSON.stringify(reviewTimeline(analysis)));
    const geometry = timelineGeometry(served);
    assert.ok(geometry, label);
    assert.equal(geometry.obstacles.length, served.obstacles.length, `${label}: every passed obstacle is drawn`);
    assert.equal(geometry.flaps.length, served.intervals.length + 1, `${label}: every flap is drawn`);
    const verdicts = unexplainedDescents(analysis).count;
    assert.equal(geometry.lookAheadCount, verdicts, `${label}: the page marks the server's verdicts only`);
    const early = served.obstacles.filter((row) => row.commitTick !== null && row.commitTick < row.visibleTick).length;
    counts[label] = { verdicts, early };
  }
  // The hardcore bot passes obstacles on its last flap before they came into view (under a ground-route
  // obstacle, gliding past a choice): 7 early commitments, 1 server verdict, 1 mark. The widened-view
  // pilot really looks ahead: every early commitment is a verdict, and the page marks all of them.
  assert.deepEqual(counts.hardcore, { verdicts: 1, early: 7 });
  assert.deepEqual([counts.intermediate.verdicts, counts.expert.verdicts], [0, 0]);
  assert.ok(counts['widened-view pilot'].verdicts >= 2);
  assert.equal(counts['widened-view pilot'].early, counts['widened-view pilot'].verdicts);
});

let h;
let db;
let d;
let W;
let runA;
let runB;
let runC;

before(async () => {
  h = await bootJackpotChain();
  db = createPgliteClient();
  d = createCronDriver(h, db);
  W = h.W;
  // Week W: two players and 1,000 tCHIKUN, walked to paid by the real cron.
  await d.advance(h.bounds(W).start + DAY);
  runA = await d.play(await h.player(0), { openAt: h.bounds(W).start + DAY + 600, untilTick: 4200, weekIndex: W });
  runB = await d.play(await h.player(1), { openAt: h.bounds(W).start + DAY + 1200, untilTick: 1800, weekIndex: W });
  await seedWalletProfile(db, { wallet: runB.wallet, displayName: 'Bee Pilot' });
  await h.fund(W, 1_000n * TOKEN);
  await d.walkToPaid(W);
  // Week W+1 (open): 150 tCHIKUN, above the 100 minimum, and a Ranked run that leads it.
  const at = Math.floor(d.clockMs / 1000);
  runC = await d.play(await h.player(2), { openAt: at + 600, untilTick: 3000, weekIndex: W + 1 });
  await h.fund(W + 1, 150n * TOKEN);
  await d.advance(at + 3600);
  const cron = await d.cron();
  assert.equal(cron.status, 200, JSON.stringify(cron.body));
});

after(async () => {
  await db?.close();
  await h?.close();
});

const call = (module, url, { env = {}, headers = {} } = {}) => invoke(module.createHandler(() => module.buildDeps(d.env(env), d.overrides())), { url, headers });

function bearer(wallet) {
  const { token } = issueSessionToken({ createHmac, timingSafeEqual }, { secret: SETTLE_SESSION_VALUE, wallet: wallet.toLowerCase(), nowMs: d.clockMs, audience: 'lestersarcade:development' });
  return { authorization: `Bearer ${token}` };
}

test('parseJackpot accepts what the real /api/jackpot answers and the surfaces read it', async () => {
  const response = await call(jackpotApi, '/api/jackpot');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const body = response.body;
  const api = parseJackpot(body);
  assert.ok(api, 'the real live answer parses');
  assert.deepEqual(api, body, 'nothing dropped or rewritten');

  // This week: funded, open on the server's clock, a provisional score-only leader.
  assert.equal(api.current.weekKey, weekKeyOfIndex(W + 1));
  assert.equal(phaseOf(api.current, Date.parse(api.serverTime)), 'open');
  const prize = currentPrize(api);
  assert.ok(prize, 'a funded week shows its prize');
  assert.equal(prize.text({ first: true }), '150 tCHIKUN (testnet token, no value)');
  assert.equal(prize.capNote, null, 'no cap, nothing rolls over');
  assert.equal(api.current.leader.score, runC.score);
  assert.equal(leaderScoreText(api.current.leader), `top score ${runC.score.toLocaleString('en-US')} (provisional)`);
  const tease = buildChikunJackpotTease(api, Date.parse(api.serverTime));
  assert.match(tease.rewards, /^Weekly Jackpot: 150 tCHIKUN \(testnet token, no value\) · closes in \d+d \d+h$/, 'the Chikun child reads it too');

  // The previous week: paid, its winner, and the public candidate rows.
  assert.deepEqual([api.previous.weekKey, api.previous.status, api.previous.prizeWei], [weekKeyOfIndex(W), 'paid', (1_000n * TOKEN).toString()]);
  assert.equal(api.previous.winner.wallet, runA.wallet);
  assert.deepEqual(api.previous.candidates.map((row) => [row.score, row.review]), [[runA.score, 'cleared'], [runB.score, 'cleared']]);

  // The other answers the server gives: not live (undeployed, unconfigured or hidden), and a live
  // instance with no rules epoch mirrored yet (`current: null`; api-model.mjs), which shows no prize.
  const hidden = await call(jackpotApi, '/api/jackpot', { env: { JACKPOT_UI_HIDDEN: 'true' } });
  assert.deepEqual(parseJackpot(hidden.body), { ok: true, live: false, game: 'chikun' });
  assert.equal(currentPrize(parseJackpot(hidden.body)), null);
  const noRules = parseJackpot({ ...body, current: null });
  assert.ok(noRules, 'a live answer before the first rules epoch still parses');
  assert.equal(currentPrize(noRules), null);
  assert.equal(buildChikunJackpotTease(noRules, Date.parse(body.serverTime)), null);
});

test('the profile renders the real jackpot.wins of a paid winner', async () => {
  const profile = await readPublicProfile(db, runA.wallet, { nowMs: d.clockMs, catalog: null });
  assert.equal(profile.jackpot.wins.length, 1);
  const win = profile.jackpot.wins[0];
  const documentRef = fakeDocument();
  const mount = documentRef.createElement('div');
  const card = renderJackpotWins({ mount, wins: profile.jackpot.wins, wallet: runA.wallet, documentRef, loadClaimForm: () => assert.fail('a paid win offers no claim') });
  assert.ok(card);
  const text = visibleText(mount);
  assert.ok(text.includes(weekRangeText(win.startsAt, win.closesAt, { year: true })), text);
  assert.ok(text.includes('1,000 tCHIKUN (testnet token, no value)'), text);
  assert.ok(text.includes(`${runA.score.toLocaleString('en-US')} pts`), text);
  assert.ok(text.includes('Transaction'), 'the finalize transaction links to the explorer');
  const none = await readPublicProfile(db, runB.wallet, { nowMs: d.clockMs, catalog: null });
  assert.equal(renderJackpotWins({ mount: documentRef.createElement('div'), wins: none.jackpot.wins, documentRef }), null, 'no wins, no section');
});

test('the owner review model keeps every field of the real review payload', async () => {
  clearAdminCache();
  for (const week of [W, W + 1]) {
    // eslint-disable-next-line no-await-in-loop
    const response = await call(reviewApi, `/api/jackpot/review?week=${weekKeyOfIndex(week)}`, { headers: bearer(h.wallets.developer.address) });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const raw = response.body;
    const model = normalizeReview(raw);
    assert.ok(model, `week ${week}`);
    assert.equal(model.weekKey, raw.weekKey);
    assert.equal(model.candidates.length, raw.candidates.length, 'no candidate dropped');
    assert.equal(model.nextEligible.length, raw.nextEligible.length, 'no next-eligible row dropped');
    raw.nextEligible.forEach((row, index) => assert.deepEqual([model.nextEligible[index].sessionId, model.nextEligible[index].wallet, model.nextEligible[index].score], [row.sessionId32, row.wallet, row.score]));
    raw.candidates.forEach((row, index) => {
      const candidate = model.candidates[index];
      assert.deepEqual(
        [candidate.sessionId, candidate.wallet, candidate.displayName, candidate.score, candidate.rank, candidate.listing, candidate.onChain, candidate.wasListed, candidate.review, candidate.adminReviewed, candidate.screen, candidate.source],
        [row.sessionId32, row.wallet, row.displayName, row.score, row.chainRank, row.listing, row.onChain, row.wasListed, row.review, row.adminReviewed, row.screen, row.source],
      );
      assert.deepEqual(candidate.holdCodes.map((code) => code.code), row.holdCodes.map((code) => code.code));
      assert.deepEqual(candidate.softSignals.map((signal) => signal.code), Object.keys(row.soft ?? {}).filter((code) => row.soft[code]?.on === true));
      assert.equal(candidate.seedProvenance, row.provenance?.status ?? null);
      assert.equal(candidate.evidenceDelaySeconds, row.features?.evidenceDelaySeconds ?? null);
      assert.equal(candidate.history.length, row.recentRuns.length);
      assert.equal(candidate.actions.length, row.actions.length);
      assert.equal(candidate.replay, `/api/jackpot/replay?session=${row.sessionId32}`);
      if (row.integrity) assert.match(integrityText(candidate.integrity), row.integrity.ok ? /^passed/ : /^FAILED \(H7\)/);
      if (row.timeline) {
        const geometry = timelineGeometry(row.timeline);
        assert.ok(geometry, 'the served timeline draws');
        assert.equal(geometry.obstacles.length, row.timeline.obstacles.length);
        assert.equal(geometry.lookAheadCount, row.timeline.obstacles.filter((obstacle) => obstacle.unexplained === true).length);
      }
    });
    if (week === W) {
      assert.deepEqual(model.candidates.map((row) => [row.sessionId, row.listing, row.review, row.screen]).sort(), [
        [runA.sessionId32, 'listed', 'cleared', 'pass'], [runB.sessionId32, 'listed', 'cleared', 'pass'],
      ].sort());
      assert.ok(model.candidates.every((row) => row.timeline && integrityText(row.integrity)?.startsWith('passed')), 'screened: timeline and integrity');
    } else {
      assert.ok(model.nextEligible.some((row) => row.sessionId === runC.sessionId32), 'the open week lists its run as next eligible');
    }
  }
});
