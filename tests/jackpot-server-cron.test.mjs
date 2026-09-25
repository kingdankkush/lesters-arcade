import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import * as cronApi from '../api/cron/weekly-jackpot.mjs';
import { readCronRuns } from '../server/ops/cron-runs.mjs';
import {
  readAction, readCandidate, readCandidates, readEvents, readRules, readWalletFlags, readWeekActions, readWeekRow, requeueWeek, updateCandidate, upsertCandidate,
} from '../server/jackpot/store.mjs';
import { jackpotStream } from '../server/jackpot/store.mjs';
import { RPC_TIMEOUT_MS, createJackpotChain } from '../server/jackpot/chain.mjs';
import {
  RELIST_CHECKS_PER_WEEK, SCREEN_ERROR_LIMIT, SCREEN_RESERVE_MS, SCREENS_PER_WEEK, SENDS_PER_WEEK, relistCandidates, runJackpot,
} from '../server/jackpot/cron.mjs';
import { INDEX_BUDGET_MS, INDEX_CHUNK_BLOCKS, indexJackpotInstance, jackpotInstances } from '../server/jackpot/indexer.mjs';
import { weekKeyOfIndex } from '../server/jackpot/weeks.mjs';
import { deployLocalJackpot, deployMockToken, launchRules, setChainTime } from '../scripts/lib/local-jackpot.mjs';
import { jackpotModuleValue } from '../scripts/generate-litvm-jackpot.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import { fixtureEnv, SETTLE_CRON_VALUE, SETTLE_SESSION_VALUE } from './helpers/settle-fixtures.mjs';
import { DAY, HOUR, TOKEN, bootJackpotChain } from './fixtures/jackpot-server/chain-harness.mjs';
import { ensureMigrated, pilotCutEvidence, seedJackpotRun, seedTicketRow } from './fixtures/jackpot-server/helpers.mjs';

/**
 * jackpot-server AC5 and AC10 (design §C.3, §C.4): the weekly-jackpot cron
 * indexes the jackpot events per contract, reconciles the views and walks
 * each closed week through the state machine, end to end on PGlite and the
 * in-process chain, with the server clock (nowMs) and the chain clock moved
 * together.
 */

let h;
let base;
let db;
let clockMs;
let jackpotDeployment;
let contract;
let fault = null;
let select = null;
const AUTH = { authorization: `Bearer ${SETTLE_CRON_VALUE}` };

before(async () => {
  h = await bootJackpotChain();
  base = await h.chain.snapshot();
});

after(async () => {
  await db?.close();
  await h?.close();
});

async function fresh({ enterWeek = true } = {}) {
  await db?.close();
  await h.chain.revert(base);
  base = await h.chain.snapshot();
  db = createPgliteClient();
  jackpotDeployment = h.jackpotDeployment;
  contract = h.contract;
  fault = null;
  select = null;
  if (enterWeek) await advance(h.bounds().start + DAY);
}

async function advance(seconds) {
  const latest = await h.now();
  if (seconds > latest) await setChainTime(h.provider, seconds);
  clockMs = Math.max(seconds, latest) * 1000;
}

function env(extra = {}) {
  return fixtureEnv({ registry: h.deployment.addresses.scoreSubmissionRegistry, extra: { JACKPOT_KEEPER_PRIVATE_KEY: h.keeperKey, JACKPOT_CONTRACT_ADDRESS: contract, ...extra } });
}

async function cron(extraEnv = {}) {
  const handler = cronApi.createHandler(() => cronApi.buildDeps(env(extraEnv), {
    db, provider: h.provider, deployment: h.deployment, jackpotDeployment, nowMs: () => clockMs,
    fetchImpl: async () => { throw Object.assign(new Error('offline'), { code: 'ENOTFOUND' }); }, fundingLookup: null,
    keeperFault: fault ? (stage) => fault(stage) : undefined, jackpotSelect: select ?? undefined,
  }));
  return invoke(handler, { url: '/api/cron/weekly-jackpot', headers: AUTH });
}

const W = () => h.W;
const KEY = () => weekKeyOfIndex(h.W);
const week = (index = W()) => readWeekRow(db, { contract, weekKey: weekKeyOfIndex(index) });
const bounds = () => h.bounds();

// A Ranked run played by `player`, settled by the server (Neon row with
// evidence and its logged seed ticket) and on chain, opened at `openAt` and
// published at `settleAt` (both chain seconds).
// With `deferPublish`, the entry is paid now but the run is published later
// through run.publish(settleAt) (chain) and confirmed in Neon then.
async function play(player, { openAt, settleAt = null, untilTick = 3600, logTicket = true, verifiedLateBy = null, deferPublish = false }) {
  let fields = null;
  const run = await seedJackpotRun(db, {
    wallet: player.address, openedAt: openAt * 1000, ticket: true, replay: true, secret: SETTLE_SESSION_VALUE,
    registry: h.deployment.addresses.scoreSubmissionRegistry, evidenceFor: (seed) => pilotCutEvidence(seed, { untilTick }),
    ...(deferPublish ? { status: 'submitted' } : {}),
    beforeInsert: async ({ sessionId32, fields: replayed }) => {
      fields = replayed;
      if (deferPublish) {
        await h.open({ player, sessionId: sessionId32, openAt });
        return {};
      }
      const publishAt = settleAt ?? openAt + replayed.survivalSeconds + 60;
      const done = await h.settle({ player, sessionId: sessionId32, score: BigInt(replayed.score), survivalSeconds: BigInt(replayed.survivalSeconds), kills: BigInt(replayed.kills), maxCombo: BigInt(replayed.maxCombo), openAt, settleAt: publishAt });
      return { confirmedAt: done.submittedAt * 1000 };
    },
  });
  run.publish = async (publishAt) => {
    const done = await h.publish({ player, sessionId: run.sessionId32, score: BigInt(fields.score), survivalSeconds: BigInt(fields.survivalSeconds), kills: BigInt(fields.kills), maxCombo: BigInt(fields.maxCombo), settleAt: publishAt });
    await db.query("UPDATE verified_sessions SET status = 'confirmed', confirmed_at = to_timestamp($2::double precision), block_number = 200 WHERE session_id32 = $1", [run.sessionId32, String(done.submittedAt)]);
    clockMs = Math.max(clockMs, done.submittedAt * 1000);
    return done;
  };
  if (verifiedLateBy) await db.query("UPDATE verified_sessions SET verified_at = opened_at + make_interval(secs => survival_seconds + $2::double precision) WHERE session_id32 = $1", [run.sessionId32, String(verifiedLateBy)]);
  if (logTicket) await seedTicketRow(db, { wallet: run.wallet, sessionHandle: run.sessionHandle, ticket: run.ticket, weekKey: KEY() });
  return { ...run, player };
}

async function runsUntil(predicate, { max = 4, step = 300 } = {}) {
  for (let n = 0; n < max; n += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await cron();
    assert.equal(response.status, 200, JSON.stringify(response.body));
    // eslint-disable-next-line no-await-in-loop
    if (await predicate()) return n + 1;
    // eslint-disable-next-line no-await-in-loop
    await advance(Math.floor(clockMs / 1000) + step);
  }
  return null;
}

const review = async (sessionId) => Number(await h.jackpot.reviewOf(sessionId));
const reason = (text) => ethers.encodeBytes32String(text);
const randomSession = () => ethers.hexlify(ethers.randomBytes(32)).toLowerCase();
const offline = async () => { throw Object.assign(new Error('offline'), { code: 'ENOTFOUND' }); };

// The in-process provider with some methods replaced (hung or failing RPC calls).
function wrapProvider(overrides) {
  return new Proxy(h.provider, {
    get(target, prop) {
      if (Object.hasOwn(overrides, prop)) return overrides[prop];
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

test('cron walks a funded week from close to paid', async () => {
  await fresh();
  const [a, b] = [await h.player(0), await h.player(1)];
  const start = bounds().start;
  const runA = await play(a, { openAt: start + DAY + 600, untilTick: 4200 });
  const runB = await play(b, { openAt: start + DAY + 1800, untilTick: 1800 });
  await h.fund(W(), 1_000n * TOKEN);

  // Before the close only the open week's mirror exists.
  let response = await cron();
  assert.deepEqual([response.status, response.body.ok], [200, true], JSON.stringify(response.body));
  assert.equal((await week()).status, 'open');
  assert.equal((await week()).fundedWei, (1_000n * TOKEN).toString(), 'Funded is mirrored');

  await advance(bounds().close + 2 * HOUR + 60);
  response = await cron();
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const entry = response.body.weeks.find((item) => item.weekKey === KEY());
  assert.deepEqual([entry.contract, entry.from, entry.to], [contract, 'open', 'selecting']);
  const keeperRows = await readCandidates(db, { contract, weekKey: KEY() });
  assert.deepEqual(keeperRows.map((row) => row.sessionId32).sort(), [runA.sessionId32, runB.sessionId32].sort());
  assert.ok(keeperRows.every((row) => row.source === 'keeper' && row.screen === 'pass'), JSON.stringify(keeperRows.map((row) => [row.screen, row.screenCodes, row.features?.integrity])));

  const settledRuns = await runsUntil(async () => (await h.jackpot.candidatesOf(W())).length === 2 && await review(runA.sessionId32) === 1 && await review(runB.sessionId32) === 1);
  assert.ok(settledRuns !== null && settledRuns <= 3, 'both submitted and cleared within the selection runs');
  assert.equal((await week()).status, 'selecting');

  await advance(bounds().settleCutoff + 10 * 60 + 60);
  assert.equal((await cron()).status, 200);
  assert.equal((await week()).status, 'review');

  await advance(bounds().payoutAt + 60);
  const before = await h.token.balanceOf(a.address);
  const paidRuns = await runsUntil(async () => (await week()).status === 'paid', { max: 3 });
  assert.ok(paidRuns !== null, `paid: ${(await week()).status}`);
  const paid = await week();
  assert.deepEqual([paid.winner, paid.winningSession, paid.prizeWei, paid.unclaimedWei], [a.address.toLowerCase(), runA.sessionId32, (1_000n * TOKEN).toString(), '0']);
  assert.match(paid.finalizeTxHash, /^0x[0-9a-f]{64}$/);
  assert.equal(await h.token.balanceOf(a.address) - before, 1_000n * TOKEN);
  const finalize = (await readWeekActions(db, { contract, weekKey: KEY() })).find((action) => action.kind === 'finalize');
  assert.equal(finalize.status, 'confirmed');
  assert.equal(finalize.id, `chikun:${contract.slice(2, 10)}:${W()}:finalize:-`);
  // The mirrors: rules from the constructor's RulesScheduled, staff from the role events, the stream cursor.
  assert.equal((await readRules(db, { contract }))[0].fromWeek, W());
  const staff = (await readWalletFlags(db, { contract })).filter((flag) => flag.staffEver).map((flag) => flag.wallet).sort();
  assert.deepEqual(staff, [h.wallets.operator.address, h.wallets.developer.address, h.wallets.keeper.address].map((value) => value.toLowerCase()).sort());
  const cursor = await db.query('SELECT last_block::text AS last_block FROM indexer_state WHERE stream = $1', [jackpotStream(contract)]);
  assert.ok(Number(cursor[0].last_block) > 0);
  assert.equal((await readCronRuns(db))['weekly-jackpot'].failures, 0);
});

// Through the selection runs until the given sessions are listed and cleared.
async function untilListedAndCleared(sessions, { max = 4 } = {}) {
  const runs = await runsUntil(async () => {
    const listed = (await h.jackpot.candidatesOf(W())).map((row) => row.sessionId.toLowerCase());
    for (const id of sessions) if (!listed.includes(id) || await review(id) !== 1) return false;
    return true;
  }, { max });
  assert.ok(runs !== null, `listed and cleared: ${JSON.stringify(await readCandidates(db, { contract, weekKey: KEY() }).then((rows) => rows.map((row) => [row.sessionId32.slice(0, 10), row.onChain, row.review, row.screen])))}`);
  return runs;
}

test('cron marks an unfunded week and sends nothing', async () => {
  await fresh();
  const a = await h.player(0);
  await play(a, { openAt: bounds().start + DAY + 600 });
  const keeper = h.wallets.keeper.address;
  const nonce = await h.provider.getTransactionCount(keeper);
  await advance(bounds().close + 2 * HOUR + 60);
  const response = await cron();
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const row = await week();
  assert.deepEqual([row.status, row.fundedWei, row.carriedInWei, row.winner], ['unfunded', '0', '0', null]);
  assert.deepEqual(await readCandidates(db, { contract, weekKey: KEY() }), [], 'no selection for an unfunded week');
  assert.deepEqual(await readWeekActions(db, { contract, weekKey: KEY() }), []);
  await advance(bounds().payoutAt + HOUR);
  assert.equal((await cron()).status, 200);
  assert.equal((await week()).status, 'unfunded', 'terminal');
  assert.equal(await h.provider.getTransactionCount(keeper), nonce, 'the keeper sent nothing');

  // The gates, in order: 401, 503 without a database, not configured, paused.
  const denied = await invoke(cronApi.createHandler(() => cronApi.buildDeps(env(), { db, provider: h.provider, deployment: h.deployment, jackpotDeployment })), { url: '/api/cron/weekly-jackpot', headers: { authorization: 'Bearer wrong' } });
  assert.deepEqual([denied.status, denied.body.error], [401, 'unauthorized']);
  const noDb = await invoke(cronApi.createHandler(() => cronApi.buildDeps(env(), { db: null, provider: h.provider, deployment: h.deployment, jackpotDeployment })), { url: '/api/cron/weekly-jackpot', headers: AUTH });
  assert.deepEqual([noDb.status, noDb.body.error], [503, 'index-not-configured']);
  const undeployed = await invoke(cronApi.createHandler(() => cronApi.buildDeps(env(), { db, provider: h.provider, deployment: h.deployment })), { url: '/api/cron/weekly-jackpot', headers: AUTH });
  assert.deepEqual([undeployed.status, undeployed.body], [200, { ok: true, skipped: 'jackpot-not-configured' }], 'the committed undeployed module: a no-op');
  const noKey = await cron({ JACKPOT_KEEPER_PRIVATE_KEY: '' });
  assert.deepEqual(noKey.body, { ok: true, skipped: 'jackpot-not-configured' });
  const paused = await cron({ JACKPOT_PAUSED: 'true' });
  assert.deepEqual(paused.body, { ok: true, skipped: 'jackpot-paused' });
  assert.equal((await readCronRuns(db))['weekly-jackpot'].failures, 0, 'skips are successes');
  assert.deepEqual(cronApi.WEEKLY_JACKPOT_OVERRIDES, ['db', 'provider', 'deployment', 'nowMs', 'fetchImpl', 'crypto', 'jackpotDeployment', 'jackpotSelect', 'keeperFault', 'fundingLookup']);
});

test('cron screens and clears a public challenger within three runs', async () => {
  await fresh();
  const [a, c] = [await h.player(0), await h.player(1)];
  const runA = await play(a, { openAt: bounds().start + DAY + 600, untilTick: 1800 });
  // The challenger paid during the week and publishes after the keeper's first selection.
  const runC = await play(c, { openAt: bounds().start + DAY + 1200, untilTick: 4200, deferPublish: true });
  await h.fund(W(), 500n * TOKEN);
  await advance(bounds().close + 2 * HOUR + 60);
  await untilListedAndCleared([runA.sessionId32]);
  assert.equal((await readCandidates(db, { contract, weekKey: KEY() })).some((row) => row.sessionId32 === runC.sessionId32), false, 'not selected: not yet published');
  await runC.publish(bounds().close + 3 * HOUR);
  await (await h.jackpot.connect(c).submitCandidate(runC.sessionId32)).wait();
  await advance(bounds().close + 3 * HOUR + 60);
  const runs = await runsUntil(async () => await review(runC.sessionId32) === 1, { max: 3 });
  assert.ok(runs !== null && runs <= 3, `the challenger is cleared within three runs (${runs})`);
  await cron(); // the next run indexes the Cleared event
  const row = (await readCandidates(db, { contract, weekKey: KEY() })).find((candidate) => candidate.sessionId32 === runC.sessionId32);
  assert.deepEqual([row.source, row.onChain, row.chainRank, row.screen, row.review], ['public', true, 1, 'pass', 'cleared']);
  const events = await readEvents(db, { contract, weekKey: KEY(), events: ['CandidateSubmitted'] });
  assert.ok(events.some((event) => event.sessionId32 === runC.sessionId32 && event.wallet === c.address.toLowerCase()));
});

test('cron waits for the admin when the leader is flagged', async () => {
  await fresh();
  const [a, b] = [await h.player(0), await h.player(1)];
  // The leader's evidence reached the server 25 minutes after the run could have ended: H9.
  const runA = await play(a, { openAt: bounds().start + DAY + 600, untilTick: 4200, verifiedLateBy: 1_500 });
  const runB = await play(b, { openAt: bounds().start + DAY + 1800, untilTick: 1800 });
  await h.fund(W(), 500n * TOKEN);
  await advance(bounds().close + 2 * HOUR + 60);
  const listed = await runsUntil(async () => await review(runA.sessionId32) === 2 && await review(runB.sessionId32) === 1 && (await h.jackpot.candidatesOf(W())).length === 2);
  assert.ok(listed !== null, 'the late leader is listed and flagged, the other cleared');
  const flagged = (await readCandidates(db, { contract, weekKey: KEY() })).find((row) => row.sessionId32 === runA.sessionId32);
  assert.deepEqual([flagged.screen, flagged.screenCodes, flagged.review, flagged.reviewReason], ['hold', ['H9'], 'flagged', 'late-evidence']);
  await advance(bounds().settleCutoff + 11 * 60);
  await cron();
  await advance(bounds().payoutAt + 60);
  await cron();
  let row = await week();
  assert.equal(row.status, 'awaiting-admin');
  const waitingSince = row.adminWaitingSince;
  assert.ok(waitingSince);
  await advance(bounds().payoutAt + HOUR);
  await cron();
  row = await week();
  assert.deepEqual([row.status, row.adminWaitingSince], ['awaiting-admin', waitingSince], 'still waiting; the wait keeps its start');
  // The admin clears the leader; the next run finalizes.
  await (await h.jackpot.connect(h.wallets.developer).clear(runA.sessionId32)).wait();
  const paid = await runsUntil(async () => (await week()).status === 'paid', { max: 3 });
  assert.ok(paid !== null);
  row = await week();
  assert.deepEqual([row.winner, row.adminWaitingSince], [a.address.toLowerCase(), null]);
  const leader = (await readCandidates(db, { contract, weekKey: KEY() })).find((candidate) => candidate.sessionId32 === runA.sessionId32);
  assert.deepEqual([leader.review, leader.adminReviewed], ['cleared', true]);
});

test('cron rolls over a week with no eligible leader', async () => {
  await fresh();
  const [a, b] = [await h.player(0), await h.player(1)];
  // A clean run the keeper lists and clears; later a better run of the same wallet replaces it, and B lists
  // a run too (both on chain only). The admin then blocks both wallets: their rows keep their slots, so
  // leaderOf is empty while two rows are still listed (design §C.4: the pot rolls over).
  const runA1 = await play(a, { openAt: bounds().start + DAY + 600, untilTick: 1800 });
  const [a2, bRun] = [randomSession(), randomSession()];
  await h.settle({ player: a, sessionId: a2, score: 90_000n, openAt: bounds().start + 2 * DAY });
  await h.settle({ player: b, sessionId: bRun, score: 80_000n, openAt: bounds().start + 2 * DAY + 600 });
  await h.fund(W(), 300n * TOKEN);
  await advance(bounds().close + 2 * HOUR + 60);
  await untilListedAndCleared([runA1.sessionId32]);
  assert.equal((await week()).status, 'selecting');
  await (await h.jackpot.connect(a).submitCandidate(a2)).wait();
  await (await h.jackpot.connect(b).submitCandidate(bRun)).wait();
  const admin = h.jackpot.connect(h.wallets.developer);
  await (await admin.setBlocked(a.address, true, reason('cheating'))).wait();
  await (await admin.setBlocked(b.address, true, reason('cheating'))).wait();

  // A keeper row whose screen keeps failing on infrastructure holds the week in selecting until it has
  // errored SCREEN_ERROR_LIMIT times; then it is still retried, but it never pins the week.
  const stuck = `0x${'5e'.repeat(32)}`;
  await upsertCandidate(db, { contract, weekKey: KEY(), sessionId32: stuck, wallet: `0x${'5e'.repeat(20)}`, score: 10, source: 'keeper' });
  const gaveUp = (errors) => updateCandidate(db, { contract, sessionId32: stuck, set: { screen: 'error', features: { errors, retryAt: new Date(clockMs + DAY * 1000).toISOString(), code: 'verify-unavailable' } } });
  await gaveUp(SCREEN_ERROR_LIMIT - 1);
  await advance(bounds().settleCutoff + 11 * 60);
  await cron();
  assert.equal((await week()).status, 'selecting', 'an unscreened keeper row holds the review');
  await gaveUp(SCREEN_ERROR_LIMIT);
  await cron();
  assert.equal((await week()).status, 'review');
  assert.equal((await h.jackpot.candidatesOf(W())).length, 2, 'the blocked rows keep their slots');
  assert.equal((await readCandidate(db, { contract, sessionId32: runA1.sessionId32 })).onChain, false, 'the replaced clean row is not re-listed');

  await advance(bounds().payoutAt + 60);
  assert.equal((await h.jackpot.leaderOf(W()))[0], ethers.ZeroHash, 'every listed row is skipped');
  const runs = await runsUntil(async () => (await week()).status === 'rolled', { max: 3 });
  assert.ok(runs !== null, `rolled: ${(await week()).status}`);
  const row = await week();
  assert.deepEqual([row.winner, row.prizeWei, row.rolledToWeek, row.adminWaitingSince], [null, '0', weekKeyOfIndex(W() + 1), null], 'never parked for the admin');
  const next = await week(W() + 1);
  assert.equal(next.carriedInWei, (300n * TOKEN).toString(), 'the pot carried into the current week');
  assert.equal((await h.jackpot.potOf(W() + 1)).carriedIn, 300n * TOKEN);
  const skipped = await readEvents(db, { contract, weekKey: KEY(), events: ['CandidateSkipped'] });
  assert.deepEqual(skipped.map((event) => [event.sessionId32, event.reason]), [[a2, 'blocked'], [bRun, 'blocked']]);
});

test('cron re-lists displaced candidates after decoys are disqualified', async () => {
  await fresh();
  const honest = [await h.player(0), await h.player(1), await h.player(2)];
  const decoyPlayers = [];
  for (let index = 0; index < 5; index += 1) decoyPlayers.push(await h.player(3 + index));
  const runs = [];
  for (const [index, player] of honest.entries()) runs.push(await play(player, { openAt: bounds().start + DAY + 600 * (index + 1), untilTick: 1800 + 600 * index }));
  // The first decoy wallet also plays a real, clean run that outscores every honest row, so the keeper
  // lists and clears it; its own decoy later replaces it (a was_listed row of a flooding wallet).
  const cheat = await play(decoyPlayers[0], { openAt: bounds().start + DAY + 2400, untilTick: 4200 });
  // Five decoy wallets settle high scores on chain only (the server never saw them).
  const decoys = [];
  for (const [index, player] of decoyPlayers.entries()) {
    const sessionId = randomSession();
    await h.settle({ player, sessionId, score: 90_000n + BigInt(index), openAt: bounds().start + 2 * DAY + 600 * index });
    decoys.push({ player, sessionId });
  }
  await h.fund(W(), 500n * TOKEN);
  await advance(bounds().close + 2 * HOUR + 60);
  await untilListedAndCleared([...runs, cheat].map((run) => run.sessionId32), { max: 5 });
  await advance(bounds().settleCutoff + 11 * 60);
  await cron();
  assert.equal((await week()).status, 'review');

  // C + 11 h 59 min: the decoys flood the list and displace every honest row.
  await advance(bounds().close + 11 * HOUR + 59 * 60);
  for (const decoy of decoys) await (await h.jackpot.connect(decoy.player).submitCandidate(decoy.sessionId)).wait();
  assert.deepEqual((await h.jackpot.candidatesOf(W())).map((row) => row.sessionId.toLowerCase()).sort(), decoys.map((decoy) => decoy.sessionId).sort());
  await advance(bounds().close + 12 * HOUR + 60);
  const flagged = await runsUntil(async () => {
    for (const decoy of decoys) if (await review(decoy.sessionId) !== 2) return false;
    return true;
  }, { max: 3 });
  assert.ok(flagged !== null, 'the decoys are screened first (on chain) and flagged');
  await cron(); // the next run indexes the Flagged events
  const decoyRows = (await readCandidates(db, { contract, weekKey: KEY() })).filter((row) => decoys.some((decoy) => decoy.sessionId === row.sessionId32));
  assert.ok(decoyRows.every((row) => row.source === 'public' && row.screen === 'integrity-fail' && row.reviewReason === 'integrity'), 'no evidence: integrity');

  // The admin disqualifies the decoys (whole wallet, which also rules out the cheat's replaced clean row) and,
  // as the runbook says, then blocks the other decoy wallets. The cheat's clean row is the best displaced row,
  // but the chain would refuse it (DISQUALIFIED): the keeper never re-sends it and re-lists the honest rows.
  const adminJackpot = h.jackpot.connect(h.wallets.developer);
  for (const decoy of decoys) await (await adminJackpot.disqualify(decoy.sessionId, true, reason('multi-wallet'))).wait();
  for (const decoy of decoys.slice(1)) await (await adminJackpot.setBlocked(decoy.player.address, true, reason('multi-wallet'))).wait();
  assert.equal((await h.jackpot.checkEligibility(cheat.sessionId32)).reason, 'DISQUALIFIED');
  await advance(bounds().close + 13 * HOUR);
  const relisted = await runsUntil(async () => (await h.jackpot.candidatesOf(W())).length === 3, { max: 5 });
  assert.ok(relisted !== null, 'every displaced honest row is back');
  const onChain = (await h.jackpot.candidatesOf(W())).map((row) => row.sessionId.toLowerCase());
  assert.deepEqual(onChain, [...runs].reverse().map((run) => run.sessionId32), 'in board order');
  for (const run of runs) assert.equal(await review(run.sessionId32), 1, 'they kept their clears');
  const cheatRow = await readCandidate(db, { contract, sessionId32: cheat.sessionId32 });
  assert.deepEqual([cheatRow.onChain, cheatRow.wasListed, cheatRow.review, cheatRow.reviewReason, cheatRow.adminReviewed], [false, true, 'disqualified', 'multi-wallet', false],
    'wholeWalletForWeek is mirrored onto the wallet\'s other rows of the week');
  const cheatSubmit = (await readWeekActions(db, { contract, weekKey: KEY() })).find((action) => action.kind === 'submit' && action.sessionId32 === cheat.sessionId32);
  assert.deepEqual([cheatSubmit.status, cheatSubmit.lastError], ['confirmed', null], 'the doomed row was never requeued');
  await advance(bounds().payoutAt + 60);
  assert.ok(await runsUntil(async () => (await week()).status === 'paid', { max: 3 }) !== null);
  assert.equal((await week()).winner, honest[2].address.toLowerCase());
});

test('cron re-selects after the admin extends a week in review', async () => {
  await fresh();
  const [a, late] = [await h.player(0), await h.player(1)];
  const runA = await play(a, { openAt: bounds().start + DAY + 600, untilTick: 1800 });
  const runLate = await play(late, { openAt: bounds().start + DAY + 1200, untilTick: 3600, deferPublish: true });
  await h.fund(W(), 500n * TOKEN);
  await advance(bounds().close + 2 * HOUR + 60);
  await untilListedAndCleared([runA.sessionId32]);
  await advance(bounds().settleCutoff + 11 * 60);
  await cron();
  assert.equal((await week()).status, 'review');
  // A relayer outage near the close: the admin extends the week by 12 h.
  await (await h.jackpot.connect(h.wallets.developer).extendWeek(W(), 12 * HOUR)).wait();
  await advance(bounds().settleCutoff + 20 * 60);
  await cron();
  let row = await week();
  assert.deepEqual([row.status, row.extensionSeconds, row.settleCutoffAt], ['selecting', 12 * HOUR, new Date(h.bounds(W(), 12 * HOUR).settleCutoff * 1000).toISOString()]);
  // The late run publishes before the new cutoff; the re-select after it picks it up.
  await runLate.publish(bounds().close + 8 * HOUR);
  await advance(h.bounds(W(), 12 * HOUR).settleCutoff + 11 * 60);
  await cron();
  row = await week();
  assert.equal(row.status, 'review');
  assert.ok((await readCandidates(db, { contract, weekKey: KEY() })).some((candidate) => candidate.sessionId32 === runLate.sessionId32 && candidate.source === 'keeper'));
  await untilListedAndCleared([runLate.sessionId32]);
});

test('cron finishes a week someone else finalized', async () => {
  await fresh();
  const [a, b] = [await h.player(0), await h.player(1)];
  const runA = await play(a, { openAt: bounds().start + DAY + 600 });
  // B has the week's best run, but the keeper's selection goes through the deps.jackpotSelect seam (the
  // rehearsal's censoring keeper, R2): B is never selected, and nobody challenges.
  const runB = await play(b, { openAt: bounds().start + DAY + 1200, untilTick: 4200 });
  const offered = [];
  select = (rows) => {
    offered.push(rows.map((row) => row.sessionId32));
    return rows.filter((row) => row.sessionId32 !== runB.sessionId32);
  };
  await h.fund(W(), 500n * TOKEN);
  await advance(bounds().close + 2 * HOUR + 60);
  await untilListedAndCleared([runA.sessionId32]);
  assert.deepEqual(offered[0], [runB.sessionId32, runA.sessionId32], 'the seam sees the selection in board order');
  assert.equal((await readCandidates(db, { contract, weekKey: KEY() })).some((row) => row.sessionId32 === runB.sessionId32), false, 'the dropped row is never selected');
  await advance(bounds().settleCutoff + 11 * 60);
  await cron();
  await advance(bounds().payoutAt + 60);
  await (await h.jackpot.connect(h.wallets.attacker).finalize(W())).wait();
  await advance(bounds().payoutAt + 120);
  await cron();
  const row = await week();
  assert.deepEqual([row.status, row.winner, row.prizeWei], ['paid', a.address.toLowerCase(), (500n * TOKEN).toString()]);
  const finalize = (await readWeekActions(db, { contract, weekKey: KEY() })).find((action) => action.kind === 'finalize');
  assert.equal(finalize, undefined, 'the keeper never needed to send one');
});

test('cron tracks a failed prize transfer until it is claimed', async () => {
  await fresh({ enterWeek: false });
  // A second instance whose prize token can refuse a transfer (a blacklist).
  const mock = await deployMockToken('BlacklistToken', [], h.wallets.operator);
  const deployed = await deployLocalJackpot({ provider: h.provider, wallets: h.wallets, record: h.suite, token: mock, firstWeek: W(), rules: { ...launchRules(h.suite), adminClearOnly: false } });
  contract = (await deployed.jackpot.getAddress()).toLowerCase();
  jackpotDeployment = jackpotModuleValue(deployed.record);
  const jackpot = deployed.jackpot.connect(h.provider);
  await advance(bounds().start + DAY);
  const a = await h.player(0);
  const runA = await play(a, { openAt: bounds().start + DAY + 600 });
  await (await mock.connect(h.funder).mint(h.funder.address, 400n * TOKEN)).wait();
  await (await mock.connect(h.funder).approve(contract, 400n * TOKEN)).wait();
  await (await deployed.jackpot.connect(h.funder).fund(W(), 400n * TOKEN)).wait();
  await (await mock.connect(h.funder).setBlacklisted(a.address, true)).wait();
  await advance(bounds().close + 2 * HOUR + 60);
  const listed = await runsUntil(async () => Number(await jackpot.reviewOf(runA.sessionId32)) === 1 && (await jackpot.candidatesOf(W())).length === 1);
  assert.ok(listed !== null);
  await advance(bounds().settleCutoff + 11 * 60);
  await cron();
  await advance(bounds().payoutAt + 60);
  assert.ok(await runsUntil(async () => (await week()).status === 'claim-pending', { max: 3 }) !== null, (await week()).status);
  let row = await week();
  assert.deepEqual([row.winner, row.prizeWei, row.unclaimedWei, row.token.symbol], [a.address.toLowerCase(), (400n * TOKEN).toString(), (400n * TOKEN).toString(), 'BLKMOCK']);
  // The winner claims to another address.
  const other = await h.player(5);
  await (await deployed.jackpot.connect(a).claim(W(), other.address)).wait();
  await advance(bounds().payoutAt + 600);
  await cron();
  row = await week();
  assert.deepEqual([row.status, row.unclaimedWei], ['paid', '0']);
  assert.equal(await mock.balanceOf(other.address), 400n * TOKEN);
});

test('cron recovers from a crash after a broadcast', async () => {
  await fresh();
  const a = await h.player(0);
  const runA = await play(a, { openAt: bounds().start + DAY + 600 });
  await h.fund(W(), 500n * TOKEN);
  await advance(bounds().close + 2 * HOUR + 60);
  let crashes = 0;
  fault = (stage) => {
    if (stage === 'after-broadcast' && crashes === 0) {
      crashes += 1;
      throw Object.assign(new Error('killed'), { name: 'KeeperKilled' });
    }
  };
  const crashed = await cron();
  assert.deepEqual([crashed.status, crashed.body.error], [500, 'internal-error'], 'a killed run');
  assert.equal((await readCronRuns(db))['weekly-jackpot'].lastErrorCode, 'KeeperKilled');
  const submitted = (await readWeekActions(db, { contract, weekKey: KEY() })).find((action) => action.status === 'submitted');
  assert.ok(submitted?.txHash, 'the broadcast hash was recorded');
  fault = null;
  await advance(Math.floor(clockMs / 1000) + 300);
  await untilListedAndCleared([runA.sessionId32]);
  assert.equal((await readAction(db, submitted.id)).status, 'confirmed');
});

test('cron marks a week failed when an action dies, and a requeue resumes it', async () => {
  await fresh();
  const a = await h.player(0);
  const runA = await play(a, { openAt: bounds().start + DAY + 600 });
  await h.fund(W(), 500n * TOKEN);
  // The operator rotates the keeper away: every keeper clear now reverts ONLY_KEEPER.
  const stranger = ethers.Wallet.createRandom().address;
  await (await h.jackpot.connect(h.wallets.operator).setKeeper(stranger)).wait();
  await advance(bounds().close + 2 * HOUR + 60);
  const failed = await runsUntil(async () => (await week()).status === 'failed', { max: 6 });
  assert.ok(failed !== null, `failed: ${(await week()).status}`);
  const row = await week();
  assert.equal(row.lastError, 'keeper-not-authorized');
  const dead = (await readWeekActions(db, { contract, weekKey: KEY() })).find((action) => action.status === 'dead');
  assert.deepEqual([dead.kind, dead.attempts], ['clear', 3]);
  // The operator restores the keeper; the owner requeues the week.
  await (await h.jackpot.connect(h.wallets.operator).setKeeper(h.wallets.keeper.address)).wait();
  assert.deepEqual(await requeueWeek(db, { weekKey: KEY() }), { actions: [dead.id], weeks: [contract] });
  assert.equal((await week()).status, 'selecting');
  await untilListedAndCleared([runA.sessionId32]);
  assert.ok((await readWalletFlags(db, { contract })).some((flag) => flag.wallet === stranger.toLowerCase() && flag.staffEver), 'a keeper, even briefly, is staff for good');
});

test('indexer mirrors every jackpot event idempotently, per contract, and ignores other addresses', async () => {
  await fresh({ enterWeek: false });
  // A second instance on the same chain whose events must never reach this contract's mirrors.
  const other = await deployLocalJackpot({ provider: h.provider, wallets: h.wallets, record: h.suite, firstWeek: W(), rules: { ...launchRules(h.suite), adminClearOnly: false } });
  const otherAddress = (await other.jackpot.getAddress()).toLowerCase();
  await advance(bounds().start + DAY);
  const [a, b] = [await h.player(0), await h.player(1)];
  const runA = await play(a, { openAt: bounds().start + DAY + 600 });
  const runB = await play(b, { openAt: bounds().start + DAY + 1200 });
  await h.fund(W(), 250n * TOKEN);
  await (await other.token.connect(h.wallets.operator).mint(h.funder.address, 999n * TOKEN)).wait();
  await (await other.token.connect(h.funder).approve(otherAddress, 999n * TOKEN)).wait();
  await (await other.jackpot.connect(h.funder).fund(W(), 999n * TOKEN)).wait();
  await (await h.jackpot.connect(a).submitCandidate(runA.sessionId32)).wait();
  await (await other.jackpot.connect(a).submitCandidate(runA.sessionId32)).wait();
  const admin = h.jackpot.connect(h.wallets.developer);
  // A reason that fails the CHECK is stored as 'other', never dropped.
  await (await admin.flag(runA.sessionId32, ethers.encodeBytes32String('Bad Reason!'))).wait();
  await (await admin.disqualify(runB.sessionId32, false, ethers.encodeBytes32String('automation'))).wait();
  const blocked = await h.player(6);
  await (await admin.setBlocked(blocked.address, true, ethers.encodeBytes32String('cheating'))).wait();
  await (await admin.holdWeek(W(), ethers.encodeBytes32String('investigation'))).wait();
  await (await admin.releaseWeek(W())).wait();
  const newKeeper = ethers.Wallet.createRandom().address;
  await (await h.jackpot.connect(h.wallets.operator).setKeeper(newKeeper)).wait();
  const epoch = { ...(await h.jackpot.rulesAt(0)).toObject(), fromWeek: W() + 2, adminClearOnly: true };
  await (await h.jackpot.connect(h.wallets.operator).scheduleRules(epoch)).wait();
  await (await h.jackpot.connect(h.wallets.operator).scheduleRules({ ...epoch, adminClearOnly: false, maxPrizeWei: 50n * TOKEN })).wait();

  // A hostile node that ignores the address filter: the indexer re-filters.
  await ensureMigrated(db);
  const instance = jackpotInstances(h.jackpotDeployment)[0];
  const reader = createJackpotChain({ provider: h.provider, contract, deployment: h.deployment });
  const hostile = { ...reader, logs: ({ fromBlock, toBlock }) => h.provider.getLogs({ fromBlock, toBlock }) };
  const first = await indexJackpotInstance({ db, chain: hostile, instance });
  assert.ok(first.events > 10, `events ${first.events}`);
  assert.equal(first.lagBlocks, 0);
  const snapshot = async () => ({
    weeks: await db.query('SELECT contract, week_key, funded_wei, carried_in_wei, held, extension_s, status FROM jackpot_weeks ORDER BY contract, week_key'),
    candidates: await db.query('SELECT contract, session_id32, source, on_chain, was_listed, chain_rank, review, review_reason, admin_reviewed, screen FROM jackpot_candidates ORDER BY session_id32'),
    events: await db.query('SELECT tx_hash, log_index, contract, event, week_key, session_id32, wallet, amount_wei, reason FROM jackpot_events ORDER BY block_number, log_index'),
    flags: await db.query('SELECT contract, wallet, blocked, staff_ever, reason FROM jackpot_wallet_flags ORDER BY wallet'),
    rules: await db.query('SELECT contract, from_week, admin_clear_only, max_prize_wei FROM jackpot_rules ORDER BY from_week'),
  });
  const mirrored = await snapshot();
  assert.ok(mirrored.events.every((event) => event.contract === contract), 'only this contract');
  assert.ok(mirrored.weeks.every((row) => row.contract === contract));
  assert.equal(mirrored.weeks.find((row) => row.week_key === KEY()).funded_wei, (250n * TOKEN).toString(), 'the other instance\'s 999 never mix in');
  const rowA = mirrored.candidates.find((row) => row.session_id32 === runA.sessionId32);
  assert.deepEqual([rowA.source, rowA.on_chain, rowA.was_listed, rowA.chain_rank, rowA.review, rowA.review_reason, rowA.admin_reviewed, rowA.screen],
    ['public', true, true, 1, 'flagged', 'other', true, 'pending'], 'a public challenge, a non-conforming reason stored as other');
  assert.equal(mirrored.events.find((event) => event.event === 'Flagged').reason, 'other');
  const rowB = mirrored.candidates.find((row) => row.session_id32 === runB.sessionId32);
  assert.deepEqual([rowB.review, rowB.review_reason, rowB.on_chain], ['disqualified', 'automation', false], 'a never-listed disqualified session is mirrored');
  assert.deepEqual(mirrored.flags.filter((flag) => flag.blocked).map((flag) => [flag.wallet, flag.reason]), [[blocked.address.toLowerCase(), 'cheating']]);
  assert.ok(mirrored.flags.some((flag) => flag.wallet === newKeeper.toLowerCase() && flag.staff_ever), 'KeeperUpdated makes the new keeper staff');
  assert.equal(mirrored.weeks.find((row) => row.week_key === KEY()).held, false, 'held, then released');
  assert.deepEqual(mirrored.rules.map((row) => [row.from_week, row.admin_clear_only, row.max_prize_wei]), [[W(), false, '0'], [W() + 2, false, (50n * TOKEN).toString()]], 'a later epoch for the same week replaces the earlier one');
  const streams = (await db.query('SELECT stream FROM indexer_state ORDER BY stream')).map((row) => row.stream);
  assert.deepEqual(streams, [jackpotStream(contract)], 'one stream per contract');
  assert.equal(streams[0], `litvm-4441-jackpot-${contract.slice(2)}`);

  // Replaying the whole range yields the same rows.
  await db.query('DELETE FROM indexer_state');
  const again = await indexJackpotInstance({ db, chain: hostile, instance });
  assert.equal(again.fromBlock, first.fromBlock);
  assert.deepEqual(await snapshot(), mirrored, 'idempotent mirrors');

  // A chain failure moves no cursor and leaves the mirrors as they were.
  const cursorBefore = await db.query('SELECT last_block::text AS last_block FROM indexer_state');
  await h.chain.request('evm_mine', []);
  const failing = { ...reader, logs: () => Promise.reject(Object.assign(new Error('timeout https://rpc.example/key'), { code: 'TIMEOUT' })) };
  await assert.rejects(indexJackpotInstance({ db, chain: failing, instance }), (error) => error.chainIo === true && error.code === 'TIMEOUT' && !/rpc\.example/.test(error.message));
  assert.deepEqual(await db.query('SELECT last_block::text AS last_block FROM indexer_state'), cursorBefore);

  // A rotated keeper's review stays the keeper's in every later run: the keeper set is rebuilt from the
  // persisted KeeperUpdated events, not only from the committed module (which names the first keeper).
  const rotated = await h.player(9);
  await (await h.jackpot.connect(h.wallets.operator).setKeeper(rotated.address)).wait();
  await indexJackpotInstance({ db, chain: reader, instance });
  const [late, lateRun] = [await h.player(8), randomSession()];
  await h.settle({ player: late, sessionId: lateRun, score: 700n });
  await (await h.jackpot.connect(late).submitCandidate(lateRun)).wait();
  await (await h.jackpot.connect(rotated).flag(lateRun, reason('screen-hold'))).wait();
  const later = await indexJackpotInstance({ db, chain: reader, instance });
  assert.ok(later.keepers.includes(rotated.address.toLowerCase()) && later.admins.includes(h.wallets.developer.address.toLowerCase()));
  const lateRow = await readCandidate(db, { contract, sessionId32: lateRun });
  assert.deepEqual([lateRow.review, lateRow.reviewReason, lateRow.adminReviewed], ['flagged', 'screen-hold', false], 'a keeper flag, never an admin decision');

  // Chunks (5,000 blocks in production), the 15 s budget and the per-call timeout (8 s in production).
  assert.deepEqual([INDEX_CHUNK_BLOCKS, INDEX_BUDGET_MS, RPC_TIMEOUT_MS], [5_000, 15_000, 8_000]);
  const chunked = createPgliteClient();
  try {
    await ensureMigrated(chunked);
    const ranges = [];
    const counting = { ...reader, logs: (filter) => { ranges.push([filter.fromBlock, filter.toBlock]); return reader.logs(filter); } };
    let tick = 0;
    const partial = await indexJackpotInstance({ db: chunked, chain: counting, instance, chunk: 2, monotonicMs: () => { tick += 4_000; return tick; } });
    const start = instance.startBlock;
    assert.deepEqual(ranges, [[start, start + 1], [start + 2, start + 3], [start + 4, start + 5]], 'the budget runs out after three chunks');
    assert.deepEqual([partial.fromBlock, partial.toBlock], [start, start + 5]);
    assert.ok(partial.lagBlocks > 0);
    const cursorOf = async () => Number((await chunked.query('SELECT last_block::text AS last_block FROM indexer_state'))[0].last_block);
    assert.equal(await cursorOf(), start + 5, 'the cursor stops at the last whole chunk');
    // A getLogs that never answers is abandoned at its own deadline: no cursor move, no RPC text.
    const hung = createJackpotChain({ provider: wrapProvider({ getLogs: () => new Promise(() => {}) }), contract, deployment: h.deployment, timeoutMs: 1_000 });
    await assert.rejects(indexJackpotInstance({ db: chunked, chain: hung, instance }), (error) => error.chainIo === true && error.code === 'TIMEOUT');
    assert.equal(await cursorOf(), start + 5);
  } finally {
    await chunked.close();
  }
});

test('the relist never picks a row the chain would refuse', () => {
  const row = (session, wallet, score, extra = {}) => ({
    sessionId32: `0x${session.repeat(64)}`, wallet: `0x${wallet.repeat(40)}`, score, submittedAt: '2026-10-05T01:00:00.000Z',
    onChain: false, wasListed: true, review: 'cleared', screen: 'pass', ...extra,
  });
  const listed = row('1', 'a', 500, { onChain: true });
  const improved = row('2', 'a', 400); // the wallet's own older row: NOT_BETTER
  const tie = row('0', 'a', 500); // equal score and time, lower session id: it ranks above, so it could replace
  const blocked = row('3', 'b', 450);
  const staff = row('4', 'c', 440);
  const disqualified = row('5', 'd', 430, { review: 'disqualified' });
  const broken = row('6', 'e', 420, { screen: 'integrity-fail' });
  const neverListed = row('7', 'f', 410, { wasListed: false });
  const honest = row('8', '9', 300);
  const early = row('9', '8', 300, { submittedAt: '2026-10-05T00:00:00.000Z' });
  const picked = relistCandidates([listed, improved, tie, blocked, staff, disqualified, broken, neverListed, honest, early], { blocked: new Set([blocked.wallet]), staff: new Set([staff.wallet]) });
  assert.deepEqual(picked.map((candidate) => candidate.sessionId32), [tie, early, honest].map((candidate) => candidate.sessionId32), 'board order: score, then the earlier submission');
  const full = ['a', 'b', 'c', 'd', 'e'].map((wallet, index) => row(String(index + 1), wallet, 900 + index, { onChain: true }));
  assert.deepEqual(relistCandidates([...full, honest]), [], 'a full list re-lists nothing');
  assert.equal(RELIST_CHECKS_PER_WEEK, 5);
});

test('cron screens at most five and sends at most three per week per run, within its budget', async () => {
  await fresh();
  await h.fund(W(), 300n * TOKEN);
  await ensureMigrated(db);
  // Seven public rows of sessions the server never saw: each screens as integrity-fail and gets a flag,
  // whose estimate reverts (NOT_PAID); only the per-run caps matter here.
  const sessions = Array.from({ length: 7 }, (_, index) => `0x${String(index + 1).padStart(2, '0').repeat(32)}`);
  for (const [index, sessionId32] of sessions.entries()) {
    await upsertCandidate(db, { contract, weekKey: KEY(), sessionId32, wallet: `0x${String(index + 1).padStart(2, '0').repeat(20)}`, score: 100 + index, source: 'public' });
  }
  await advance(bounds().close + 2 * HOUR + 60);
  const screened = async () => (await readCandidates(db, { contract, weekKey: KEY() })).filter((row) => row.screen !== 'pending').map((row) => row.sessionId32);
  // A run without the room for one screen still moves the week, but screens and sends nothing.
  const deps = await cronApi.buildDeps(env(), { db, provider: h.provider, deployment: h.deployment, jackpotDeployment, nowMs: () => clockMs, fetchImpl: offline, fundingLookup: null });
  const tight = await runJackpot(deps, { budgetMs: SCREEN_RESERVE_MS - 1, logger: null });
  assert.deepEqual([tight.status, (await week()).status, (await screened()).length], [200, 'selecting', 0]);
  assert.deepEqual(await readWeekActions(db, { contract, weekKey: KEY() }), []);
  // A full run: five screens (the best rows first) and three of the five flags sent.
  assert.equal((await cron()).status, 200);
  assert.deepEqual((await screened()).sort(), sessions.slice(2).sort());
  const actions = await readWeekActions(db, { contract, weekKey: KEY() });
  assert.equal(actions.length, SCREENS_PER_WEEK);
  assert.equal(actions.filter((action) => action.status !== 'pending').length, SENDS_PER_WEEK);
  // The next run screens the last two.
  await advance(Math.floor(clockMs / 1000) + 300);
  assert.equal((await cron()).status, 200);
  assert.equal((await screened()).length, 7);
});

test('cron services a retired instance until its weeks are terminal', async () => {
  await fresh({ enterWeek: false });
  // The operator ends the first instance after week W; a new instance (its own tCHIKUN) takes over at W + 1.
  await (await h.jackpot.connect(h.wallets.operator).scheduleEnd(W())).wait();
  const next = await deployLocalJackpot({ provider: h.provider, wallets: h.wallets, record: h.suite, firstWeek: W() + 1, retirePrevious: h.record, rules: { ...launchRules(h.suite), adminClearOnly: false } });
  jackpotDeployment = jackpotModuleValue(next.record);
  contract = (await next.jackpot.getAddress()).toLowerCase();
  const retired = h.contract;
  assert.deepEqual(jackpotInstances(jackpotDeployment).map((instance) => [instance.contract, instance.active, instance.endAfterWeek]), [[contract, true, null], [retired, false, W()]]);
  await advance(bounds().start + DAY);
  await h.fund(W(), 300n * TOKEN);
  const retiredWeek = () => readWeekRow(db, { contract: retired, weekKey: KEY() });
  await advance(bounds().close + 2 * HOUR + 60);
  let response = await cron();
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.weeks.map((entry) => [entry.contract, entry.weekKey, entry.to]), [[retired, KEY(), 'selecting']], 'the retired week is serviced');
  await advance(bounds().settleCutoff + 11 * 60);
  await cron();
  assert.equal((await retiredWeek()).status, 'review');
  await advance(bounds().payoutAt + 60);
  const runs = await runsUntil(async () => (await retiredWeek()).status === 'rolled', { max: 3 });
  assert.ok(runs !== null, (await retiredWeek()).status);
  const row = await retiredWeek();
  assert.deepEqual([row.contract, row.token.symbol, row.winner, row.rolledToWeek], [retired, 'tCHIKUN', null, null], 'after the end, the pot is residue: no week gains it');
  // Every week of the retired instance is terminal: it is not serviced any more.
  await advance(Math.floor(clockMs / 1000) + 300);
  response = await cron();
  assert.equal(response.status, 200);
  assert.equal(response.body.weeks.some((entry) => entry.contract === retired), false);
});
