import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ethers } from 'ethers';

import { createChikunRuntime } from '../apps/portal/src/chikun-cabinet.mjs';
import * as verify from '../server/verify/index.mjs';
import { issueSeedTicket } from '../server/verify/seed-ticket.mjs';
import { resignRow } from '../server/settle/attestation.mjs';
import {
  H11_CALIBRATED, HOLD_RULE_TEXT, SOFT_SIGNAL_TEXT, THRESHOLDS, analyzeChikunEvidence, computeFeatures, flagReasonFor, h11ActiveFor, holdCodes, reviewTimeline, screenRun, stockViewEdge,
} from '../server/jackpot/plausibility.mjs';
import { crossWalletFunding, sameRun, screenCandidate } from '../server/jackpot/screen.mjs';
import { upsertCandidate } from '../server/jackpot/store.mjs';
import { pilotFor } from '../scripts/chikun-difficulty-harness.mjs';
import { createPgliteClient, seedWalletProfile } from './helpers/pglite-client.mjs';
import { CHIKUN, FIXTURE_SESSION_SECRET, ensureMigrated, flapEvidence, humanLikeEvidence, launchRulesRow, seedJackpotRun, seedTicketRow } from './fixtures/jackpot-server/helpers.mjs';

/**
 * jackpot-server AC7 (design §B.3, §B.4, §C.4 "Screen"): the bot models pass
 * the screen and scripted pilots are held; late evidence, missing tickets and
 * non-stock clients are held or flagged; integrity failures flag and
 * infrastructure errors never do; S8 sees look-ahead; the jackpot-local
 * sameRun behaves exactly like settle's.
 */

const W40 = 2961;
const KEY = '2026-W40';
const RULES = launchRulesRow({ fromWeek: W40 });
const REPLAYS = JSON.parse(readFileSync(new URL('./fixtures/chikun-v6-replays.json', import.meta.url), 'utf8')).runs;
const SOLVER = JSON.parse(readFileSync(new URL('./fixtures/jackpot-server/run-complete-solver.json', import.meta.url), 'utf8')).evidence;
const WIDENED = JSON.parse(readFileSync(new URL('./fixtures/jackpot-server/widened-view-pilot.json', import.meta.url), 'utf8')).evidence;
const wallet = (n) => `0x${String(n).padStart(2, '0').repeat(20)}`;

// A chain double that agrees with the seeded row unless told otherwise.
function fakeChain(run, { record = {}, paid = {}, eligibility = { ok: true, week: W40, reason: '' }, fail = null } = {}) {
  const gate = (value) => (fail ? Promise.reject(fail) : Promise.resolve(value));
  return {
    getSession: () => gate({
      sessionId32: run.sessionId32, exists: true, verified: true, player: run.wallet, gameId32: CHIKUN.gameId32,
      seasonId32: ethers.id(run.seasonId), runtimeId32: CHIKUN.runtimeId32, score: BigInt(run.score), kills: run.kills,
      maxCombo: run.maxCombo, survivalSeconds: run.survivalSeconds, submittedAt: Date.parse(run.confirmedAt) / 1000, ...record,
    }),
    getPaidSession: () => gate({ exists: true, player: run.wallet, gameId32: CHIKUN.gameId32, amountWei: 102_000_000_000_000_000n, openedAt: Date.parse(run.openedAt) / 1000, ...paid }),
    checkEligibility: () => gate(eligibility),
  };
}

async function withDb(run) {
  const db = createPgliteClient();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

// A candidate seeded the way settle stores it (real evidence, identity and
// verifier fields), with its seed ticket logged unless `logTicket` is false.
async function honestRun(db, overrides = {}) {
  const run = await seedJackpotRun(db, { ticket: true, replay: true, evidenceFor: (seed) => humanLikeEvidence(seed), ...overrides });
  if (overrides.logTicket !== false) await seedTicketRow(db, { wallet: run.wallet, sessionHandle: run.sessionHandle, ticket: run.ticket, weekKey: KEY });
  return run;
}

function screen(db, run, extra = {}) {
  return screenCandidate({
    db, chain: fakeChain(run, extra.chainOptions), verify, secret: FIXTURE_SESSION_SECRET, candidate: { sessionId32: run.sessionId32 },
    weekIndex: W40, weekKey: KEY, rules: RULES, nowMs: Date.parse('2026-10-05T03:00:00Z'), ...extra,
  });
}

test('bot-model replays pass the screen and scripted pilots are held', async () => {
  for (const run of REPLAYS) {
    const { codes, features } = screenRun({ evidence: run.evidence });
    for (const code of ['H4', 'H5', 'H6']) assert.equal(codes.includes(code), false, `${run.profile} must pass ${code}`);
    assert.deepEqual(codes, [], `${run.profile}: no hold at all`);
    assert.equal(features.fastPairs, 0, 'a 6-tick minimum press gap: no fast pairs');
    assert.ok(features.flapsPerMinute < THRESHOLDS.H6.flapsPerMinute);
    assert.ok(features.entropyBits > THRESHOLDS.H5.entropyBits);
    assert.ok(features.unexplainedDescents <= 1, `${run.profile}: S8 ${features.unexplainedDescents}`);
  }

  // Scripted pilots with a 3-minute run budget: H4/H5/H6 (and H1, the truncated run-complete).
  for (const [name, seed] of [['routePilotLandscape', 1], ['routePilotLandscape', 2]]) {
    const pilot = pilotFor(name);
    const runtime = createChikunRuntime({ seed, maxTicks: 3 * 3600 });
    while (!runtime.terminal) runtime.step({ flap: pilot(runtime.snapshot()) });
    const { codes } = screenRun({ evidence: runtime.result().evidence });
    for (const code of ['H4', 'H5', 'H6']) assert.ok(codes.includes(code), `${name} ${seed} is held by ${code} (${codes})`);
  }

  // The same pilot through the whole screen: H7 for the non-stock maxTicks, plus H4-H6.
  await withDb(async (db) => {
    const run = await seedJackpotRun(db, { wallet: wallet(1), ticket: true, replay: true, evidenceFor: (seed) => {
      const pilot = pilotFor('routePilotLandscape');
      const runtime = createChikunRuntime({ seed, maxTicks: 3 * 3600 });
      while (!runtime.terminal) runtime.step({ flap: pilot(runtime.snapshot()) });
      return runtime.result().evidence;
    } });
    await seedTicketRow(db, { wallet: run.wallet, sessionHandle: run.sessionHandle, ticket: run.ticket, weekKey: KEY });
    const screened = await screen(db, run);
    assert.equal(screened.result, 'integrity-fail');
    assert.equal(screened.integrity.code, 'non-stock-client');
    for (const code of ['H7', 'H1', 'H4', 'H5', 'H6']) assert.ok(screened.codes.includes(code), `${code} in ${screened.codes}`);
    assert.equal(screened.flagReason, 'integrity');

    // An honest, stock run with its ticket passes the whole screen.
    const honest = await honestRun(db, { wallet: wallet(2) });
    const passed = await screen(db, honest);
    assert.equal(passed.result, 'pass', JSON.stringify({ codes: passed.codes, integrity: passed.integrity, code: passed.code }));
    assert.deepEqual([passed.codes, passed.flagReason, passed.provenance.status], [[], null, 'ok']);
    assert.equal(passed.provenance.ticketToPaySeconds, 60);
    assert.deepEqual(Object.keys(passed).sort(), ['code', 'codes', 'eligibility', 'features', 'flagReason', 'integrity', 'provenance', 'result', 'soft', 'timeline'].sort());
    for (const key of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11']) assert.ok(Object.hasOwn(passed.soft, key), key);
    assert.equal(passed.soft.S10, null, 'no funding lookup configured: S10 is null, never a verdict');
    assert.equal(passed.features.maxTicks, 216_000);
    assert.equal(typeof passed.features.evidenceDelaySeconds, 'number');
  });
});

test('late evidence, missing tickets and non-stock clients are held or flagged', async () => {
  // H1: the one 60-minute replay the tests allow (a precomputed run-complete).
  assert.ok(JSON.stringify(SOLVER).length <= 20_480, 'the H1 fixture is at most 20 KB');
  const solver = screenRun({ evidence: SOLVER });
  assert.equal(solver.features.terminalReason, 'run-complete');
  assert.ok(solver.codes.includes('H1') && solver.codes.includes('H2'));
  // H2 and H3 exactly at their thresholds.
  const base = { terminalReason: 'forest', survivalSeconds: 600, score: 40_000, fastPairs: 0, intervals: 500, topShare: 0.1, longestSameRun: 3, entropyBits: 5, flapsPerMinute: 55, minutes: 10, evidenceDelaySeconds: 30, unexplainedDescents: 0 };
  assert.deepEqual(holdCodes(base), []);
  assert.deepEqual(holdCodes({ ...base, survivalSeconds: 1080 }), []);
  assert.deepEqual(holdCodes({ ...base, survivalSeconds: 1081 }), ['H2']);
  assert.deepEqual(holdCodes({ ...base, score: 80_000 }), []);
  assert.deepEqual(holdCodes({ ...base, score: 80_001 }), ['H3']);
  assert.deepEqual(holdCodes({ ...base, terminalReason: 'flap-limit' }), ['H1']);
  assert.deepEqual(holdCodes({ ...base, fastPairs: 5, intervals: 500 }), ['H4'], '5 fast pairs and 1%');
  assert.deepEqual(holdCodes({ ...base, fastPairs: 5, intervals: 501 }), [], 'under 1% of intervals');
  assert.deepEqual(holdCodes({ ...base, fastPairs: 4, intervals: 100 }), []);
  assert.deepEqual(holdCodes({ ...base, topShare: 0.45 }), ['H5']);
  assert.deepEqual(holdCodes({ ...base, longestSameRun: 25 }), ['H5']);
  assert.deepEqual(holdCodes({ ...base, entropyBits: 2.99 }), ['H5']);
  assert.deepEqual(holdCodes({ ...base, flapsPerMinute: 85, minutes: 3 }), ['H6']);
  assert.deepEqual(holdCodes({ ...base, flapsPerMinute: 85, minutes: 2.99 }), []);
  assert.deepEqual(holdCodes({ ...base, evidenceDelaySeconds: 1200 }), []);
  assert.deepEqual(holdCodes({ ...base, evidenceDelaySeconds: 1201 }), ['H9']);
  assert.deepEqual(holdCodes(base, { boardExcluded: true, ticketMissing: true }), ['H8', 'H10']);
  assert.deepEqual(holdCodes({ ...base, unexplainedDescents: 2 }), [], 'H11 is off unless adminClearOnly or a real token');
  assert.deepEqual(holdCodes({ ...base, unexplainedDescents: 2 }, { h11Active: true }), ['H11']);
  assert.deepEqual(holdCodes({ ...base, unexplainedDescents: 1 }, { h11Active: true }), []);
  // H11 needs calibration first (OJ2): off everywhere until the constant flips in a reviewed commit.
  assert.equal(H11_CALIBRATED, false);
  assert.deepEqual([h11ActiveFor({ adminClearOnly: true }), h11ActiveFor({ testnetToken: false })], [false, false]);
  assert.deepEqual([h11ActiveFor({ adminClearOnly: true, calibrated: true }), h11ActiveFor({ testnetToken: false, calibrated: true }), h11ActiveFor({ calibrated: true })], [true, true, false]);
  assert.equal(flagReasonFor({ result: 'hold', codes: ['H2', 'H9'] }), 'late-evidence');
  assert.equal(flagReasonFor({ result: 'hold', codes: ['H9', 'H8'] }), 'excluded-wallet');
  assert.equal(flagReasonFor({ result: 'hold', codes: ['H4'] }), 'screen-hold');
  assert.equal(flagReasonFor({ result: 'integrity-fail', codes: ['H7', 'H8'] }), 'integrity');
  for (const code of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11']) assert.ok(HOLD_RULE_TEXT[code], code);
  for (const code of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11']) assert.ok(SOFT_SIGNAL_TEXT[code], code);

  await withDb(async (db) => {
    // H9: the evidence reached the server 21 minutes after the run could have ended.
    const late = await honestRun(db, { wallet: wallet(3), verifiedAt: Date.parse('2026-09-30T10:00:00Z') + 60_000 * 25 });
    const lateScreen = await screen(db, late);
    assert.equal(lateScreen.result, 'hold');
    assert.ok(lateScreen.codes.includes('H9'), lateScreen.codes);
    assert.ok(lateScreen.features.evidenceDelaySeconds > 1200);
    assert.deepEqual([lateScreen.flagReason, lateScreen.code], ['late-evidence', 'late-evidence']);
    // S9: between 5 and 20 minutes is a soft signal only.
    const slow = await honestRun(db, { wallet: wallet(4), verifiedAt: Date.parse('2026-09-30T10:00:00Z') + 60_000 * 10 });
    const slowScreen = await screen(db, slow);
    assert.deepEqual([slowScreen.result, slowScreen.soft.S9.on], ['pass', true]);

    // H10: no logged ticket.
    const unlogged = await honestRun(db, { wallet: wallet(5), logTicket: false });
    const unloggedScreen = await screen(db, unlogged);
    assert.deepEqual([unloggedScreen.result, unloggedScreen.codes, unloggedScreen.provenance.status, unloggedScreen.flagReason], ['hold', ['H10'], 'missing', 'screen-hold']);

    // H8: a board-excluded wallet.
    const excluded = await honestRun(db, { wallet: wallet(6) });
    await seedWalletProfile(db, { wallet: wallet(6), boardExcluded: true });
    const excludedScreen = await screen(db, excluded);
    assert.deepEqual([excludedScreen.result, excludedScreen.codes, excludedScreen.flagReason], ['hold', ['H8'], 'excluded-wallet']);

    // A non-stock client that ends in a crash before its short budget: H7 only.
    const truncated = await honestRun(db, { wallet: wallet(7), evidenceFor: (seed) => ({ ...humanLikeEvidence(seed), maxTicks: 30_000 }) });
    const truncatedScreen = await screen(db, truncated);
    assert.deepEqual([truncatedScreen.result, truncatedScreen.integrity.code, truncatedScreen.codes], ['integrity-fail', 'non-stock-client', ['H7']]);
  });
});

test('integrity failures flag and infrastructure errors never do', async () => withDb(async (db) => {
  const flags = async (run, extra, code) => {
    const result = await screen(db, run, extra);
    assert.equal(result.result, 'integrity-fail', `${code}: ${JSON.stringify(result.integrity)}`);
    assert.equal(result.integrity.code, code);
    assert.ok(result.codes.includes('H7'));
    assert.equal(result.flagReason, 'integrity');
    return result;
  };
  const errors = async (run, extra, code) => {
    const result = await screen(db, run, extra);
    assert.deepEqual([result.result, result.code, result.flagReason], ['error', code, null], `${code}: never a flag`);
    return result;
  };

  await ensureMigrated(db);
  // No row (a public candidate the server never settled), a chain-index row, no evidence, an index mismatch.
  const ghost = { sessionId32: `0x${'ee'.repeat(32)}`, wallet: wallet(9) };
  const noRow = await screenCandidate({ db, chain: fakeChain({ ...ghost, seasonId: CHIKUN.seasonId, score: 1, kills: 0, maxCombo: 0, survivalSeconds: 1, confirmedAt: '2026-10-01T00:00:00Z', openedAt: '2026-09-30T00:00:00Z' }), verify, secret: FIXTURE_SESSION_SECRET, candidate: ghost, weekIndex: W40, weekKey: KEY, rules: RULES });
  assert.deepEqual([noRow.result, noRow.integrity.code, noRow.codes], ['integrity-fail', 'evidence-missing', ['H7']]);
  await flags(await seedJackpotRun(db, { wallet: wallet(10), source: 'chain-index' }), {}, 'evidence-missing');
  await flags(await seedJackpotRun(db, { wallet: wallet(11), withEvidence: false }), {}, 'evidence-missing');
  await flags(await seedJackpotRun(db, { wallet: wallet(12), chainMismatch: true }), {}, 'chain-mismatch');

  // A replay that no longer matches the row (a tampered score).
  const tampered = await honestRun(db, { wallet: wallet(13) });
  await db.query('UPDATE verified_sessions SET score = score + 1 WHERE session_id32 = $1', [tampered.sessionId32]);
  await flags(tampered, {}, 'replay-mismatch');

  // The chain disagrees with Neon: score, season, player, underpaid entry, the wrong week.
  const honest = await honestRun(db, { wallet: wallet(14) });
  await flags(honest, { chainOptions: { record: { score: BigInt(honest.score) + 1n } } }, 'chain-mismatch');
  await flags(honest, { chainOptions: { record: { seasonId32: ethers.id('chikun-season-preview-0') } } }, 'chain-mismatch');
  await flags(honest, { chainOptions: { paid: { player: wallet(15) } } }, 'chain-mismatch');
  await flags(honest, { chainOptions: { paid: { amountWei: 99_999_999_999_999_999n } } }, 'chain-mismatch');
  await flags(honest, { chainOptions: { record: { verified: false } } }, 'chain-mismatch');
  await flags(honest, { weekIndex: W40 + 1 }, 'chain-mismatch');

  // Seed provenance: a bad MAC, a valid ticket for another salt (seed mismatch), a stale ticket.
  const badMac = await honestRun(db, { wallet: wallet(16), logTicket: false });
  await seedTicketRow(db, { wallet: badMac.wallet, sessionHandle: badMac.sessionHandle, ticket: { ...badMac.ticket, mac: '0'.repeat(64) }, weekKey: KEY });
  assert.equal((await flags(badMac, {}, 'ticket-invalid')).integrity.detail, 'mac');
  const otherSalt = await honestRun(db, { wallet: wallet(17), logTicket: false });
  const second = await issueSeedTicket({ secret: FIXTURE_SESSION_SECRET, nowMs: Date.parse('2026-09-30T09:59:00Z'), sessionId: otherSalt.sessionHandle, wallet: otherSalt.wallet, gameId: 'chikun', seasonId: CHIKUN.seasonId, buildHash: otherSalt.buildHash, randomBytes: () => Buffer.alloc(16, 1) });
  await seedTicketRow(db, { wallet: otherSalt.wallet, sessionHandle: otherSalt.sessionHandle, ticket: second.seedTicket, weekKey: KEY });
  assert.equal((await flags(otherSalt, {}, 'ticket-invalid')).integrity.detail, 'seed');
  const stale = await honestRun(db, { wallet: wallet(18), ticketIssuedAt: '2026-09-30T09:29:00Z' });
  assert.equal((await flags(stale, {}, 'ticket-invalid')).integrity.detail, 'issued-at');
  const early = await honestRun(db, { wallet: wallet(19), ticketIssuedAt: '2026-09-30T10:02:01Z' });
  assert.equal((await flags(early, {}, 'ticket-invalid')).integrity.detail, 'issued-at');

  // Infrastructure: the verifier, the RPC and the secret are errors, never flags.
  const fine = await honestRun(db, { wallet: wallet(20) });
  await errors(fine, { verify: null }, 'verify-unavailable');
  await errors(fine, { verify: { reverifyStoredRun: async () => { throw new Error('module fault'); } } }, 'verify-unavailable');
  await errors(fine, { chainOptions: { fail: Object.assign(new Error('fetch failed https://rpc.example/key'), { code: 'SERVER_ERROR' }) } }, 'chain-read-failed');
  await errors(fine, { chainOptions: { fail: Object.assign(new Error('timeout'), { code: 'TIMEOUT' }) } }, 'rpc-timeout');
  await errors(fine, { secret: () => '' }, 'verify-unavailable');
  const broken = { query: () => Promise.reject(Object.assign(new Error('neon down'), { code: '57P01' })) };
  const dbDown = await screenCandidate({ db: broken, chain: fakeChain(fine), verify, secret: FIXTURE_SESSION_SECRET, candidate: fine, weekIndex: W40, weekKey: KEY, rules: RULES });
  assert.deepEqual([dbDown.result, dbDown.flagReason], ['error', null]);
  assert.equal((await screen(db, fine)).result, 'pass', 'the same run passes once the infrastructure is back');
}));

test('S8 sees look-ahead: the widened-view pilot descends before obstacles are visible', () => {
  const widened = screenRun({ evidence: WIDENED, h11Active: true });
  assert.equal(widened.features.maxTicks, 216_000);
  for (const code of ['H4', 'H5', 'H6']) assert.equal(widened.codes.includes(code), false, `the humanised pilot evades ${code}`);
  assert.ok(widened.features.unexplainedDescents >= 2, `S8 = ${widened.features.unexplainedDescents}`);
  assert.deepEqual(widened.codes, ['H11'], 'only H11 (look-ahead) holds it, and only where H11 is on');
  assert.equal(widened.soft.S8.on, true);
  assert.deepEqual(screenRun({ evidence: WIDENED }).codes, [], 'with H11 off the screen misses it (known-evasion set b)');
  assert.equal(stockViewEdge('landscape'), 1280);
  assert.ok(stockViewEdge('portrait') < 1280);

  // The timeline the owner page draws: altitude every 6 ticks, visible and commit ticks, fast pairs.
  const analysis = analyzeChikunEvidence(WIDENED);
  const timeline = reviewTimeline(analysis);
  assert.equal(timeline.altitude.length, Math.floor(analysis.survivalTicks / 6) + 1);
  assert.equal(timeline.intervals.length, WIDENED.flapDeltas.length - 1);
  assert.deepEqual(timeline.intervals, WIDENED.flapDeltas.slice(1));
  const unexplained = timeline.obstacles.filter((entry) => entry.unexplained);
  assert.equal(unexplained.length, widened.features.unexplainedDescents);
  for (const entry of unexplained) {
    assert.equal(entry.route, 'ground');
    assert.ok(entry.commitTick < entry.visibleTick, 'committed before the obstacle was on screen');
  }
  assert.ok(timeline.obstacles.every((entry) => entry.visibleTick <= entry.passTick));
  // Fast pairs: a scripted pilot's are jump-to-flight take-offs (they change
  // the trajectory); a flight double-tap only re-sets the same upward speed.
  const pilot = pilotFor('routePilotLandscape');
  const runtime = createChikunRuntime({ seed: 1, maxTicks: 2 * 3600 });
  while (!runtime.terminal) runtime.step({ flap: pilot(runtime.snapshot()) });
  const pairs = reviewTimeline(analyzeChikunEvidence(runtime.result().evidence)).fastPairs;
  assert.ok(pairs.length > 0);
  assert.ok(pairs.every((pair) => pair.gap <= 2 && pair.changedTrajectory === true), 'take-offs change the trajectory');
  const doubleTap = reviewTimeline(analyzeChikunEvidence(flapEvidence({ seed: 5, flapDeltas: [20, 20, 1, 30, 2, 30] }))).fastPairs;
  assert.deepEqual(doubleTap.map(({ gap, changedTrajectory }) => [gap, changedTrajectory]), [[1, false], [2, false]]);
  const features = computeFeatures({ evidence: WIDENED, analysis, row: { openedAt: '2026-09-30T10:00:00Z', verifiedAt: '2026-09-30T10:13:00Z', survivalSeconds: Math.floor(analysis.survivalTicks / 60) } });
  assert.equal(features.evidenceDelaySeconds, 13 * 60 - Math.floor(analysis.survivalTicks / 60));
});

test('the jackpot sameRun copy behaves exactly like the settle re-sign rule', async () => {
  const row = {
    sessionId32: `0x${'ab'.repeat(32)}`, wallet: wallet(30), gameId: 'chikun', seasonId: CHIKUN.seasonId, runtimeId: CHIKUN.runtimeId,
    score: 1234, kills: 12, maxCombo: 3, survivalSeconds: 90, bossId: null, envelopeHash: `0x${'cd'.repeat(32)}`, status: 'failed', nftAchievements: [],
  };
  const freshFor = (patch = {}) => ({
    ok: true, sessionId32: row.sessionId32, wallet: row.wallet.toUpperCase().replace('0X', '0x'), gameId: 'chikun', seasonId: row.seasonId, runtimeId: row.runtimeId,
    score: 1234, contract: { kills: 12, maxCombo: 3, survivalSeconds: 90, bossId: null }, envelopeHash: row.envelopeHash.toUpperCase().replace('0X', '0x'),
    evidence: { digest: `0x${'11'.repeat(32)}` }, ...patch,
  });
  const cases = [
    freshFor(),
    freshFor({ score: 1235 }),
    freshFor({ sessionId32: `0x${'ac'.repeat(32)}` }),
    freshFor({ wallet: wallet(31) }),
    freshFor({ gameId: 'stacked' }),
    freshFor({ seasonId: 'chikun-season-preview-0' }),
    freshFor({ runtimeId: 'chikun:canvas-runtime-v6' }),
    freshFor({ contract: { kills: 13, maxCombo: 3, survivalSeconds: 90, bossId: null } }),
    freshFor({ contract: { kills: 12, maxCombo: 4, survivalSeconds: 90, bossId: null } }),
    freshFor({ contract: { kills: 12, maxCombo: 3, survivalSeconds: 91, bossId: null } }),
    freshFor({ contract: { kills: 12, maxCombo: 3, survivalSeconds: 90 } }),
    freshFor({ contract: { kills: 12, maxCombo: 3, survivalSeconds: 90, bossId: 'boss-liquidator' } }),
    freshFor({ envelopeHash: `0x${'ce'.repeat(32)}` }),
    freshFor({ score: '1234' }),
  ];
  const storedDb = { query: async () => [{ encoding: 'chikun-flap-evidence-v6+json', evidence: '{}', evidence_bytes: 2, evidence_digest: `0x${'11'.repeat(32)}`, identity: '{"sessionKey":"x"}' }] };
  const failingCatalog = { nftAchievementIds() { throw new Error('stop before signing'); } };
  for (const fresh of cases) {
    const settle = await resignRow({ db: storedDb, row, verify: { reverifyStoredRun: async () => fresh }, catalog: failingCatalog, nowMs: 0 });
    const settleSame = !(settle.ok === false && settle.code === 'stored-run-mismatch');
    assert.equal(sameRun(fresh, row), settleSame, JSON.stringify(fresh));
  }
});

test('S10 compares first funders across wallets within its call budget', async () => withDb(async (db) => {
  await seedJackpotRun(db, { wallet: wallet(40) });
  for (const [n, review] of [[41, 'none'], [42, 'flagged'], [43, 'none']]) {
    await upsertCandidate(db, { contract: `0x${'1a'.repeat(20)}`, weekKey: KEY, sessionId32: `0x${String(n).repeat(32)}`, wallet: wallet(n), score: 10, source: 'public' });
    if (review !== 'none') await db.query('UPDATE jackpot_candidates SET review = $1 WHERE wallet = $2', [review, wallet(n)]);
  }
  const funders = { [wallet(40)]: wallet(90), [wallet(90)]: wallet(99), [wallet(41)]: wallet(91), [wallet(91)]: wallet(99), [wallet(42)]: wallet(92), [wallet(43)]: null };
  let calls = 0;
  const firstFunder = async (address) => { calls += 1; return funders[address] ?? null; };
  const result = await crossWalletFunding(db, { wallet: wallet(40), weekKeys: [KEY], firstFunder });
  assert.deepEqual(result.matches, [wallet(41)], 'two hops to the same faucet');
  assert.equal(result.on, true);
  assert.ok(result.calls <= THRESHOLDS.S10.maxCalls && calls === result.calls);
  const capped = await crossWalletFunding(db, { wallet: wallet(40), weekKeys: [KEY], firstFunder, maxCalls: 1 });
  assert.equal(capped, null, 'over budget: null, never a verdict');
  assert.equal(await crossWalletFunding(db, { wallet: wallet(40), weekKeys: [KEY], firstFunder: async () => { throw new Error('explorer down'); } }), null);
  assert.equal(await crossWalletFunding(db, { wallet: wallet(40), weekKeys: [KEY], firstFunder: null }), null);
}));
