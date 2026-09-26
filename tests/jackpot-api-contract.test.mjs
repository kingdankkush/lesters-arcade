import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, before } from 'node:test';

import { DAY, HOUR, MINUTE, TOKEN, jackpotContract, startJackpotStack } from '../scripts/lib/jackpot-rehearsal-driver.mjs';
import { createHandlerMounts, createInProcessApi, REPO_ROOT } from '../scripts/lib/local-stack.mjs';
import { deployLocalJackpot, deployMockToken, launchRules } from '../scripts/lib/local-jackpot.mjs';
import { jackpotModuleValue } from '../scripts/generate-litvm-jackpot.mjs';
import {
  currentPrize, explorerTxUrl, fetchJackpot, leaderScoreText, parseJackpot, phaseOf, resetJackpotMemo, watchReplayUrl, weekRangeText, weekStatusText,
} from '../apps/portal/src/jackpot/jackpot-client.mjs';
import { createJackpotBoardHeader } from '../apps/portal/src/jackpot/jackpot-board-header.mjs';
import { renderJackpotWins } from '../apps/portal/src/jackpot/jackpot-profile-wins.mjs';
import { integrityText, normalizeReview, timelineGeometry } from '../apps/portal/owner/jackpot-review-model.mjs';
import { buildChikunJackpotTease } from '../apps/chikun/src/presentation.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { fakeDocument, flush, visibleText } from './helpers/jackpot-fake-dom.mjs';

/**
 * jackpot-rehearsal AC4: the API contract between jackpot-server and jackpot-ui (design §C.5, §G). The REAL
 * GET /api/jackpot handler (in process, on the local jackpot stack, walked through real weeks by the real
 * cron) is fed to the UI's parseJackpot at every lifecycle stage: not live (undeployed and UI-hidden), live
 * before the first index, open unfunded, open below minFundWei, open funded, open capped, a closed week in
 * review, awaiting the admin, paid, rolled, unfunded, claim-pending, and a two-token history across an
 * instance migration (design §A.19). At each stage the parser keeps the answer whole (nothing dropped or
 * rewritten), every field of the jackpot-ui fixture for that stage (tests/fixtures/jackpot/*.json, the
 * shapes the surfaces were built on) is present in the real answer, and the surfaces that read it (the
 * Scores header, the Chikun child tease, the profile wins) render from it. The REAL GET /api/jackpot/review
 * carries every field of the owner page's fixture (tests/fixtures/jackpot/review-api-with-timeline.json)
 * the owner page reads, and renders through jackpot-review-model.mjs's timeline geometry.
 * Keys: the public Hardhat test mnemonic only; offline.
 */

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/jackpot/${name}.json`, import.meta.url), 'utf8'));
const REVIEW_MODEL_SOURCE = readFileSync(new URL('../apps/portal/owner/jackpot-review-model.mjs', import.meta.url), 'utf8');
const tokens = (count) => BigInt(count) * TOKEN;

let js;
const covered = new Map();

before(async () => {
  js = await startJackpotStack();
});

after(async () => {
  await js?.close();
});

// Every key path of a JSON value ('current.pot.prizeWei', 'history[].token.symbol'), arrays merged.
function keyPaths(value, prefix = '', out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) keyPaths(item, `${prefix}[]`, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.add(path);
      keyPaths(child, path, out);
    }
  }
  return out;
}

// The paths of `fixtureBody` the real body must also have. Optional keys the parser allows are skipped,
// and so are paths below a value the real answer leaves empty at this stage (an empty list, a null winner
// or leader): the fixture shows a later stage there.
const OPTIONAL = new Set(['previous.startsAt', 'previous.closesAt', 'previous.candidates[].reason']);
function emptyPaths(value, prefix = '', out = new Set()) {
  if (value === null || (Array.isArray(value) && value.length === 0)) {
    out.add(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) emptyPaths(item, `${prefix}[]`, out);
    return out;
  }
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) emptyPaths(child, prefix ? `${prefix}.${key}` : key, out);
  return out;
}
function missingFields(realBody, fixtureBody, optional = OPTIONAL) {
  const real = keyPaths(realBody);
  const empty = emptyPaths(realBody);
  const below = (path) => [...empty].some((prefix) => path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[]`));
  return [...keyPaths(fixtureBody)].filter((path) => !optional.has(path) && !real.has(path) && !below(path));
}

// Fields the owner page's review fixture carries that the server does not send. The server folds the
// replay and the stock-client (maxTicks) checks into integrity.ok and integrity.code ('replay-mismatch',
// 'non-stock-client'), and the owner page reads only ok, code and detail (integrityText); the guard in
// reviewGeometry fails the day the page starts reading one of them, so the server must then send it.
const REVIEW_FIXTURE_ONLY = new Map([
  ['candidates[].integrity.replay', /integrity\??\.replay\b/],
  ['candidates[].integrity.maxTicks', /integrity\??\.maxTicks\b/],
]);

function inProcessFetch(api) {
  return async (url) => {
    const target = String(url);
    const response = await api('GET', target);
    return { ok: response.status === 200, status: response.status, headers: { get: (key) => response.headers?.[String(key).toLowerCase()] ?? null }, json: async () => response.body };
  };
}

// The real answer at a stage: parsed whole, the stage fixture's fields present, the surfaces rendered.
async function stage(name, { fixtureName = null, api = js.api, check = () => {} } = {}) {
  const response = await api('GET', '/api/jackpot?game=chikun');
  assert.equal(response.status, 200, `${name}: ${JSON.stringify(response.body)}`);
  assert.equal(response.headers['cache-control'], 'public, s-maxage=30, stale-while-revalidate=120');
  const parsed = parseJackpot(response.body);
  assert.ok(parsed, `${name}: parseJackpot rejected the real answer ${JSON.stringify(response.body).slice(0, 800)}`);
  assert.deepEqual(parsed, response.body, `${name}: the parser keeps the whole answer`);
  if (fixtureName) assert.deepEqual(missingFields(response.body, fixture(fixtureName)), [], `${name}: fields of tests/fixtures/jackpot/${fixtureName}.json missing from the real answer`);
  // The client's own read (fetchJackpot: the Age/Date clock) accepts it too.
  resetJackpotMemo();
  const fetched = await fetchJackpot({ fetchImpl: inProcessFetch(api), now: () => js.nowMs() });
  const withoutTime = (value) => (value?.live ? { ...value, serverTime: null } : value);
  assert.deepEqual(withoutTime(fetched?.api), withoutTime(parsed), `${name}: fetchJackpot`);
  // The Scores header renders from it.
  resetJackpotMemo();
  const documentRef = fakeDocument();
  const header = createJackpotBoardHeader({ documentRef, fetchImpl: inProcessFetch(api), now: () => js.nowMs() });
  header.shown('chikun', 'weekly');
  await flush(20);
  const container = documentRef.createElement('div');
  const shown = header.shown('chikun', 'weekly');
  const text = shown ? visibleText(shown.render(container) ?? container) : '';
  await check(parsed, { text, body: response.body });
  covered.set(name, { live: parsed.live, headerText: text });
  return { parsed, text };
}

// Every candidate of a real review payload survives normalizeReview and draws through timelineGeometry,
// marking exactly the server's look-ahead verdicts; `held` names a candidate the screen held.
function reviewGeometry(body, { held = null } = {}) {
  // Every field of the owner page's fixture is in the real payload, except the fixture-only ones above,
  // which the owner model never reads.
  assert.deepEqual(missingFields(body, fixture('review-api-with-timeline'), new Set([...OPTIONAL, ...REVIEW_FIXTURE_ONLY.keys()])), [], 'fields of tests/fixtures/jackpot/review-api-with-timeline.json missing from the real review API');
  for (const [path, reader] of REVIEW_FIXTURE_ONLY) assert.doesNotMatch(REVIEW_MODEL_SOURCE, reader, `the owner model now reads ${path}: the review API must send it`);
  const model = normalizeReview(body);
  assert.ok(model && model.candidates.length === body.candidates.length && body.candidates.length > 0, 'no candidate dropped');
  for (const row of body.candidates) {
    const geometry = timelineGeometry(row.timeline);
    assert.ok(geometry, `a timeline for ${row.sessionId32}`);
    assert.equal(geometry.obstacles.length, row.timeline.obstacles.length);
    assert.equal(geometry.flaps.length, row.timeline.intervals.length + 1);
    assert.equal(geometry.lookAheadCount, row.timeline.obstacles.filter((obstacle) => obstacle.unexplained === true).length);
    assert.match(integrityText(row.integrity), /^passed/);
    const candidate = model.candidates.find((entry) => entry.sessionId === row.sessionId32);
    if (row.sessionId32 === held) assert.ok(candidate.holdCodes.length > 0 && candidate.screen === 'hold', 'the held run carries its hold codes');
  }
}

async function cronUntil(predicate, max = 6) {
  return js.cronUntil(predicate, { max });
}

// Walks `week` of the instance at `contract` from its close to one of `statuses`.
async function walk(week, statuses, contract = js.address) {
  const status = async () => (await js.weekRow(week, contract))?.status ?? null;
  await js.advanceTo(js.at(week, 'close', 2 * HOUR + MINUTE));
  await cronUntil(async () => !['closed', null].includes(await status()) && (await js.actionRows(week, contract)).every((action) => !['pending', 'signed', 'submitted'].includes(action.status)));
  await js.advanceTo(js.at(week, 'settleCutoff', 11 * MINUTE));
  await cronUntil(async () => ['review', 'unfunded'].includes(await status()));
  await js.advanceTo(js.at(week, 'payoutAt', MINUTE));
  const reached = await cronUntil(async () => statuses.includes(await status()));
  assert.ok(reached !== null, `week ${js.weekKey(week)} reached ${statuses} (${await status()})`);
}

test('not live: an undeployed jackpot, and JACKPOT_UI_HIDDEN, answer live:false and the UI shows nothing', async () => {
  const undeployed = createInProcessApi({
    router: js.stack.router,
    handlerFor: createHandlerMounts({ root: REPO_ROOT, env: js.env, overrides: () => ({ db: js.db, provider: js.provider, deployment: js.deployment, nowMs: js.clock.nowMs, jackpotDeployment: jackpotModuleValue(null) }) }),
  });
  await stage('undeployed', { api: undeployed, fixtureName: 'not-live', check: (api, { text }) => {
    assert.deepEqual(api, { ok: true, live: false, game: 'chikun' });
    assert.equal(currentPrize(api), null);
    assert.equal(text, '', 'no header while not live');
  } });
  js.env.JACKPOT_UI_HIDDEN = 'true';
  try {
    await stage('ui-hidden', { fixtureName: 'not-live', check: (api) => assert.deepEqual(api, { ok: true, live: false, game: 'chikun' }) });
  } finally {
    delete js.env.JACKPOT_UI_HIDDEN;
  }
});

test('live before the first index: current is null and nothing claims a prize', async () => {
  const fresh = createPgliteClient();
  try {
    const api = createInProcessApi({
      router: js.stack.router,
      handlerFor: createHandlerMounts({ root: REPO_ROOT, env: js.env, overrides: () => ({ db: fresh, provider: js.provider, deployment: js.deployment, nowMs: js.clock.nowMs, jackpotDeployment: js.module }) }),
    });
    await stage('live-before-index', { api, check: (parsed) => {
      assert.equal(parsed.live, true);
      assert.equal(parsed.current, null);
      assert.equal(currentPrize(parsed), null);
      assert.equal(buildChikunJackpotTease(parsed, js.nowMs()), null);
    } });
  } finally {
    await fresh.close();
  }
});

let W1;
let W2;
let W3;
let W4;
let W5;
let W6;

test('open weeks: unfunded, funded with a provisional score-only leader, then closed and in review', async () => {
  W1 = js.claimWeek(await js.beginWeek());
  await js.runJackpotCron(1);
  await stage('open-unfunded', { fixtureName: 'open-unfunded', check: (api, { text }) => {
    assert.equal(api.current.weekKey, js.weekKey(W1));
    assert.equal(api.current.pot.funded, false);
    assert.equal(currentPrize(api), null);
    assert.equal(buildChikunJackpotTease(api, Date.parse(api.serverTime)).rewards, 'Weekly Jackpot: no prize funded this week');
    assert.ok(text.includes('No jackpot funded this week'), text);
  } });
  assert.ok((await js.fund(W1, tokens(1_000))).ok);
  const [pilot, honest] = [await js.freshWallet('contract pilot'), await js.freshWallet('contract honest')];
  const flagged = await js.playRankedChikunRun({ player: pilot, openedAt: js.at(W1, 'start', DAY), pilot: 'route', maxMinutes: 1.5 });
  const cleared = await js.playRankedChikunRun({ player: honest, openedAt: js.at(W1, 'start', 2 * DAY), maxMinutes: 0.75 });
  await js.runJackpotCron(1);
  await stage('open-funded', { fixtureName: 'open-funded', check: (api, { text }) => {
    assert.equal(api.current.pot.funded, true);
    assert.equal(currentPrize(api).text({ first: true }), '1,000 tCHIKUN (testnet token, no value)');
    assert.equal(api.current.leader.score, flagged.score, 'the provisional leader is the top score, unscreened');
    assert.deepEqual(Object.keys(api.current.leader).sort(), ['provisional', 'score', 'screened'], 'a score only, never a wallet');
    assert.equal(api.current.leader.screened, false);
    assert.ok(text.includes(leaderScoreText(api.current.leader)), text);
    assert.equal(phaseOf(api.current, Date.parse(api.serverTime)), 'open');
  } });
  // Closed: selecting, then review (both public 'review'); the leader is held and flagged.
  await js.advanceTo(js.at(W1, 'close', 2 * HOUR + MINUTE));
  await js.runJackpotCron(3, {});
  await stage('closed-review', { fixtureName: 'review-with-candidates', check: (api) => {
    assert.equal(api.previous.weekKey, js.weekKey(W1));
    assert.equal(api.previous.status, 'review');
    assert.equal(api.previous.winner, null);
    assert.ok(api.previous.candidates.length >= 1 && api.previous.candidates.every((row) => watchReplayUrl(row.replay)), JSON.stringify(api.previous.candidates));
    assert.ok(api.previous.candidates.some((row) => row.review === 'in-review'), 'flagged reads in-review in public');
  } });
  W1 = { index: W1, flagged, cleared };
});

test('awaiting the admin, then paid with the winner, the prize and the transaction', async () => {
  const { index, flagged, cleared } = W1;
  await js.advanceTo(js.at(index, 'settleCutoff', 11 * MINUTE));
  await cronUntil(async () => (await js.weekRow(index)).status === 'review');
  await js.advanceTo(js.at(index, 'payoutAt', MINUTE));
  await cronUntil(async () => (await js.weekRow(index)).status === 'awaiting-admin');
  await stage('awaiting-admin', { check: (api, { text }) => {
    assert.equal(api.previous.status, 'awaiting-admin');
    assert.equal(weekStatusText(api.previous.status), 'Pending review');
    assert.ok(text.includes('pending review'), text);
  } });
  // The owner's review of that week (a held scripted pilot and a cleared run) draws from the real payload.
  const review = await js.reviewApi(index);
  assert.equal(review.status, 200, JSON.stringify(review.body));
  reviewGeometry(review.body, { held: flagged.sessionId32 });
  assert.ok((await js.admin('disqualify', { sessionId: flagged.sessionId32, wholeWalletForWeek: false, reason: 'automation' })).ok);
  await cronUntil(async () => (await js.weekRow(index)).status === 'paid');
  await stage('paid', { check: (api, { text }) => {
    assert.equal(api.previous.status, 'paid');
    assert.equal(api.previous.winner.wallet, cleared.wallet);
    assert.equal(api.previous.prizeWei, tokens(1_000).toString());
    assert.ok(explorerTxUrl(api.previous.finalizeTx));
    const disqualified = api.previous.candidates.find((row) => row.review === 'disqualified');
    assert.equal(disqualified?.reason, 'automation', 'the coarse reason, public only for disqualified rows');
    assert.ok(text.includes('Past winners') && text.includes('1,000 tCHIKUN'), text);
  } });
  W1 = index;
});

test('capped and below-minimum weeks: the cap and the carry-over, then a dust pot that is not funded', async () => {
  // The cap is in W2's rules, scheduled the week before; W3 has none.
  W2 = js.currentWeek() + 1;
  await js.operatorAction('schedule-rules', { argv: ['--from-week', String(W2), '--max-prize', '700'] });
  await js.operatorAction('schedule-rules', { argv: ['--from-week', String(W2 + 1), '--max-prize', '0'] });
  js.claimWeek(await js.beginWeek());
  assert.equal(js.currentWeek(), W2);
  assert.ok((await js.fund(W2, tokens(750))).ok);
  await js.runJackpotCron(1);
  await stage('open-funded-capped', { fixtureName: 'open-funded-capped', check: (api, { text }) => {
    assert.equal(api.current.pot.prizeCapWei, tokens(700).toString());
    assert.equal(api.current.pot.prizeWei, tokens(700).toString());
    assert.equal(api.current.pot.carryOverWei, tokens(50).toString());
    assert.equal(currentPrize(api).capNote, 'up to 700 tCHIKUN; the rest rolls over');
    assert.ok(text.includes('up to 700 tCHIKUN; the rest rolls over'), text);
  } });
  const winner = await js.freshWallet('contract capped winner');
  await js.playRankedChikunRun({ player: winner, openedAt: js.at(W2, 'start', DAY), maxMinutes: 0.5 });
  await walk(W2, ['paid']);
  // W3 holds only the 50 tCHIKUN excess: below the 100 minimum, so not funded and no amount shown.
  W3 = W2 + 1;
  js.claimWeek(W3);
  await stage('open-below-min-fund', { fixtureName: 'open-below-min-fund', check: (api, { text }) => {
    assert.equal(api.current.weekKey, js.weekKey(W3));
    assert.equal(api.current.pot.totalWei, tokens(50).toString());
    assert.equal(api.current.pot.funded, false);
    assert.equal(currentPrize(api), null, 'a dust pot is never shown as a prize');
    assert.ok(text.includes('No jackpot funded this week'), text);
  } });
  await walk(W3, ['unfunded']);
  await stage('unfunded', { check: (api) => {
    const row = api.previous?.weekKey === js.weekKey(W3) ? api.previous : api.history.find((entry) => entry.weekKey === js.weekKey(W3));
    assert.equal(row.status, 'unfunded');
    assert.equal(row.winner, null);
    assert.equal(weekStatusText(row.status), 'No prize funded');
  } });
});

test('rolled over, then a two-token history and claim-pending across an instance migration', async () => {
  // W4: funded, nobody plays: the keeper finalizes an empty leader and the pot rolls into W5. The
  // instance migration (design §A.19) starts now: the tCHIKUN instance ends after W5 (a full week's notice).
  W4 = js.claimWeek(await js.beginWeek());
  assert.ok((await js.fund(W4, tokens(200))).ok);
  const ended = await js.operatorAction('schedule-end', { args: [String(W4 + 1)] });
  assert.equal(ended.receipts.length, 1);
  await walk(W4, ['rolled']);
  W5 = W4 + 1;
  js.claimWeek(W5);
  await stage('rolled', { check: (api) => {
    assert.equal(api.previous.weekKey, js.weekKey(W4));
    assert.equal(api.previous.status, 'rolled');
    assert.equal(api.current.pot.carriedInWei, tokens(200).toString());
  } });
  // A new instance with another token starts at W6; W5 is still played and paid on the old one.
  const lastWinner = await js.freshWallet('contract last-week winner');
  const lastRun = await js.playRankedChikunRun({ player: lastWinner, openedAt: js.at(W5, 'start', 2 * DAY), maxMinutes: 0.5 });
  const blk = await deployMockToken('BlacklistToken', [], js.wallets.operator);
  const blkAddress = (await blk.getAddress()).toLowerCase();
  await (await blk.mint(js.wallets.funder.address, tokens(10_000))).wait();
  const migrated = await deployLocalJackpot({
    provider: js.provider, wallets: js.wallets, record: js.record, token: blkAddress, admin: js.adminWallet.address, keeper: js.keeperWallet.address,
    rules: { ...launchRules(js.record), adminClearOnly: false }, retirePrevious: js.jackpotRecord,
  });
  W6 = Number(migrated.record.instances.chikun.firstWeek);
  assert.equal(W6, W5 + 1);
  const oldAddress = js.address;
  await js.useInstance({ record: migrated.record });
  assert.deepEqual(js.module.instances.chikun.retired.map((entry) => entry.address), [oldAddress], 'the old instance is retired[]');
  await walk(W5, ['paid'], oldAddress);
  // W6 on the new instance: the winner is blacklisted by the token, so the prize waits for a claim.
  js.claimWeek(W6);
  assert.equal(js.currentWeek(), W6, 'W5 paid on the Tuesday of W6');
  assert.ok((await js.fund(W6, tokens(500), { jackpot: js.address, token: blkAddress })).ok);
  const frozen = await js.freshWallet('contract frozen winner');
  const frozenRun = await js.playRankedChikunRun({ player: frozen, openedAt: js.at(W6, 'start', 2 * DAY), maxMinutes: 0.5 });
  await (await blk.connect(js.wallets.operator).setBlacklisted(frozen.address, true)).wait();
  await walk(W6, ['claim-pending']);
  const { text } = await stage('claim-pending', { fixtureName: 'claim-pending', check: (api) => {
    assert.equal(api.contract, js.address);
    assert.equal(api.token.symbol, 'BLKMOCK');
    assert.equal(api.previous.weekKey, js.weekKey(W6));
    assert.equal(api.previous.status, 'claim-pending');
    assert.equal(api.previous.unclaimedWei, tokens(500).toString());
    assert.equal(api.previous.winner.wallet, frozenRun.wallet);
    assert.equal(weekStatusText(api.previous.status), 'Claim pending');
  } });
  assert.ok(text.includes('Claim pending'), text);
  await stage('two-token-history', { fixtureName: 'paid-history-two-tokens', check: (api, { text: header }) => {
    const rows = [api.previous, ...api.history];
    const byKey = new Map(rows.map((row) => [row.weekKey, row]));
    assert.equal(byKey.get(js.weekKey(W5)).token.symbol, 'tCHIKUN', 'the old instance\'s weeks keep their own token');
    assert.equal(byKey.get(js.weekKey(W5)).contract, oldAddress);
    assert.equal(byKey.get(js.weekKey(W5)).winner.wallet, lastRun.wallet);
    assert.equal(byKey.get(js.weekKey(W6)).token.symbol, 'BLKMOCK');
    assert.equal(new Set(rows.map((row) => row.token.symbol)).size, 2);
    for (const row of api.history) assert.equal(weekRangeText(row.startsAt, row.closesAt).includes(' – '), true);
    assert.ok(header.includes('tCHIKUN') && header.includes('BLKMOCK'), `the Past winners list shows each week's own token: ${header}`);
  } });
  // The winner's profile renders the claim-pending win in its own token.
  const profile = await js.profile(frozenRun.wallet);
  const documentRef = fakeDocument();
  const mount = documentRef.createElement('div');
  const card = renderJackpotWins({ mount, wins: profile.jackpot.wins, wallet: frozenRun.wallet, documentRef, loadClaimForm: () => null });
  assert.ok(card);
  assert.ok(visibleText(mount).includes('500 BLKMOCK'), visibleText(mount));
  const chain = await js.chainWeek(W6, jackpotContract(js.address, js.provider));
  assert.equal(chain.unclaimed, tokens(500));
});

test("the real review API carries the owner fixture's fields and renders through the timeline geometry", async () => {
  // The active instance's claim-pending week (the pilot week was checked while it awaited the admin).
  const review = await js.reviewApi(W6);
  assert.equal(review.status, 200, JSON.stringify(review.body));
  reviewGeometry(review.body);
  covered.set('review-api', { live: true });
});

test('the UI parser accepts the real API at every lifecycle stage', () => {
  assert.deepEqual([...covered.keys()], [
    'undeployed', 'ui-hidden', 'live-before-index', 'open-unfunded', 'open-funded', 'closed-review', 'awaiting-admin', 'paid', 'open-funded-capped',
    'open-below-min-fund', 'unfunded', 'rolled', 'claim-pending', 'two-token-history', 'review-api',
  ], 'every lifecycle stage was checked');
});
