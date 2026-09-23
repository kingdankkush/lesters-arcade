import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeCrypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { applySeedTicket, rankedIdentityFor, rankedSessionKey } from '../apps/portal/src/ranked-identity.mjs';
import { replayChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';
import { statsFromChikunResult, statsFromHmhRunSummary } from '../apps/portal/src/achievements/stats.mjs';
import { startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { recordSessionEvent } from '../apps/portal/src/session-integrity.mjs';
import { verifyRankedRun } from '../server/verify/index.mjs';
import { FIXTURE_REGISTRY, FIXTURE_SEED_SECRET } from './fixtures/ranked/build-fixtures.mjs';
import { PORTAL_MAIN, loadPortalFunctions, portalCallback, rankedGlueContext, until } from './helpers/ranked-client-vm.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/ranked/${name}.json`, import.meta.url), 'utf8'));
const HMH = fixture('hmh-valid');
const CHIKUN = fixture('chikun-valid');
const ENTRY_TX = `0x${'ab'.repeat(32)}`;
const PREVIEW_COPY = 'Canonical Ranked preview saved locally. No transaction was sent; verified on-chain publishing remains disabled.';
// VM-realm objects have another Object.prototype; compare their JSON shape.
const plain = (value) => JSON.parse(JSON.stringify(value));

// A live Ranked session as startPlaySession + signin-entry leave it: the
// verify slice's fixture identity, its seed ticket applied, the entry paid.
function liveSession({ body }, { entry = 'confirmed' } = {}) {
  const { identity, seedTicket } = body;
  const session = startPlaySession({ wallet: identity.wallet, gameId: identity.gameId, mode: 'paid', sessionNonce: identity.nonce });
  assert.equal(session.sessionId, identity.sessionId);
  Object.assign(session, { buildHash: identity.buildHash, seasonId: identity.seasonId });
  session.canonicalContext = Object.freeze({ ...session.canonicalContext, buildHash: identity.buildHash, seasonId: identity.seasonId });
  applySeedTicket(session, { seed: identity.seed, seedTicket });
  session.entryReceipt = { txHash: ENTRY_TX, sessionId32: body.sessionId32, amountWei: '102000000000000000', status: entry === 'confirmed' ? 'confirmed' : 'pending' };
  session.entryConfirmed = Promise.resolve(entry);
  return session;
}

function previewSession(gameId, wallet = HMH.wallet) {
  return startPlaySession({ wallet, gameId, mode: 'paid' });
}

const settleOk = (status = 'pending') => async (url, init) => {
  const body = JSON.parse(init.body);
  return { status: 200, headers: { get: () => null }, json: async () => ({ ok: true, view: 'owner', sessionId32: body.sessionId32, status, retryable: true, pollAfterMs: 3000, txHash: null }) };
};

async function serverAccepts(body, { wallet, chainId, verifyAtMs }) {
  return verifyRankedRun(body, { chainId, scoreRegistryAddress: FIXTURE_REGISTRY, wallet, nowMs: verifyAtMs, seedSecret: FIXTURE_SEED_SECRET, crypto: nodeCrypto });
}

test('settlement identity is rankedIdentityFor(session): the per-game key the entry paid', async () => {
  for (const source of [HMH, CHIKUN]) {
    const session = liveSession(source);
    const { context } = rankedGlueContext({ session });
    const identity = context.currentCanonicalSessionIdentity();
    assert.deepEqual(plain(identity), plain(rankedIdentityFor(session, { scoreRegistryAddress: FIXTURE_REGISTRY })));
    assert.equal(identity.seasonId, source.body.identity.seasonId);
    assert.equal(await rankedSessionKey(identity), source.body.sessionId32, 'the same key the entry was opened under');
  }
  assert.doesNotMatch(PORTAL_MAIN.slice(PORTAL_MAIN.indexOf('function currentCanonicalSessionIdentity'), PORTAL_MAIN.indexOf('function currentCanonicalFinalState')), /CURRENT_RANKED_SEASON_ID/, 'no HMH season override');
});

test('HMH game over records from the canonical summary and hands a preview to the results screen with no network', async () => {
  const summary = HMH.body.evidence.runSummary;
  const session = previewSession('lester-blaster');
  const glue = rankedGlueContext({ session });
  const { context, events, calls, errors } = glue;
  Object.assign(context.combat, { score: summary.totals.score, kills: summary.kills.total, elapsedGameSeconds: summary.totals.elapsedMs / 1000 });
  context.captureRankedResultContext(session);
  context.submitCombatGameOver(summary);
  await until(() => events.length === 1);

  assert.equal(context.combat.gameOverSubmitted, true);
  const progress = context.state.profiles[session.wallet].progress['lester-blaster'];
  assert.equal(progress.paidRuns, 1);
  assert.equal(progress.bestPaidScore, summary.totals.score, 'the summary total, not a legacy counter');
  const row = context.state.leaderboards['lester-blaster'].find((entry) => entry.sessionId === session.sessionId);
  assert.equal(row.runStats.stageIndexReached !== undefined && row.runStats.enemyKillsByType !== undefined, true, 'resolver inputs from hmhResolverInputsFromRunSummary');
  assert.equal(row.runStats.kills, summary.kills.total);
  assert.equal(context.dom.combatStatus.textContent, PREVIEW_COPY);
  assert.deepEqual(calls.clearCheckpoint, [{ sessionId: session.sessionId, submitted: false }]);
  const run = context.state.runHistory.find((entry) => entry.sessionId === session.sessionId);
  assert.match(run.envelopeHash, /^0x[0-9a-f]{64}$/, 'the envelope is still finalized locally');

  const [event] = events;
  assert.equal(event.type, 'lesters:ranked-run');
  const { handle, context: result, actions } = event.detail;
  assert.equal(handle.state, 'preview');
  assert.deepEqual(plain(result), {
    gameId: 'lester-blaster', gameTitle: 'Hard Money Heroes', sessionId: session.sessionId, sessionId32: null, wallet: session.wallet,
    displayName: null, localScore: summary.totals.score, localStats: statsFromHmhRunSummary(summary), previousBest: null,
    entry: { status: 'none', txHash: null }, mode: 'ranked',
  });
  assert.deepEqual(Object.keys(actions).sort(), ['backToArcade', 'playAgainRanked', 'practiceFree', 'viewProfile']);
  await actions.playAgainRanked();
  await actions.practiceFree();
  actions.viewProfile();
  actions.backToArcade();
  assert.deepEqual(calls.startOfficialMode, ['ranked', 'free']);
  assert.deepEqual(calls.setOfficialView, ['profile']);
  assert.equal(calls.exitToArcade, 1);

  assert.equal(calls.globalFetch.length + calls.clientFetch.length, 0, 'zero /api requests and zero RPC calls in preview');
  assert.equal(calls.loadRankedRequests ?? 0, 0, 'preview never builds a body');
  assert.deepEqual(errors, []);

  // A second game over notification (syncCombatOverlay re-entry) records nothing more.
  context.submitCombatGameOver();
  assert.equal(context.state.leaderboards['lester-blaster'].filter((entry) => entry.sessionId === session.sessionId).length, 1);
});

test('a preview previous best is the device best before this run; a hosted one comes only from the index', async () => {
  const summary = HMH.body.evidence.runSummary;
  const session = previewSession('lester-blaster');
  const first = rankedGlueContext({ session });
  first.context.state.profiles[session.wallet] = { wallet: session.wallet, handle: 'Pilot', progress: { 'lester-blaster': { paidRuns: 2, bestPaidScore: 4321 } } };
  first.context.captureRankedResultContext(session);
  const captured = await first.context.rankedResultContexts.get(session.sessionId);
  assert.equal(captured.previousBest, 4321);

  const hosted = rankedGlueContext({
    session, hosted: true,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, profile: { displayName: 'Lit Pilot' }, games: { 'lester-blaster': { bestScore: 777 } } }) }),
  });
  hosted.context.state.profiles[session.wallet] = { wallet: session.wallet, handle: 'Pilot', progress: { 'lester-blaster': { paidRuns: 2, bestPaidScore: 999_999 } } };
  hosted.context.captureRankedResultContext(session);
  await hosted.context.rankedResultContexts.get(session.sessionId);
  assert.equal(hosted.calls.globalFetch.length, 1, 'fetched once when the run starts');
  assert.equal(hosted.calls.globalFetch[0].url, `/api/profile?wallet=${session.wallet}`);
  const context = await hosted.context.rankedRunContext(session, { snapshot: { sessionId32: null, entry: { status: 'none', txHash: null } } }, summary.totals.score, null);
  assert.equal(context.previousBest, 777, 'never the device-local best in hosted mode');
  assert.equal(context.displayName, 'Lit Pilot');
});

test('live HMH settles through the relayed client with a body the server verifies', async () => {
  const session = liveSession(HMH);
  const summary = HMH.body.evidence.runSummary;
  const glue = rankedGlueContext({ session, live: true, clientFetch: settleOk('signed') });
  const { context, events, calls, errors } = glue;
  Object.assign(context.combat, { score: summary.totals.score, kills: summary.kills.total, elapsedGameSeconds: summary.totals.elapsedMs / 1000 });
  // A few reboot events, as the bridge records them.
  recordSessionEvent(session.evidence, { step: 10, type: 'hmh-reboot:score-candidate', payload: { score: summary.totals.score } });
  context.submitCombatGameOver(summary);
  await until(() => events.length === 1 && calls.clientFetch.length === 1);
  const [post] = calls.clientFetch;
  assert.equal(post.url, '/api/settle');
  assert.equal(post.method, 'POST');
  assert.equal(post.headers.authorization, 'Bearer fixture-token');
  assert.equal(post.body.sessionId32, HMH.body.sessionId32);
  assert.equal(post.body.entryTxHash, ENTRY_TX);
  assert.deepEqual(post.body.evidence.runSummary, summary);
  assert.equal(post.body.evidence.sessionEnvelope.sessionKey, HMH.body.sessionId32);
  const run = await serverAccepts(post.body, HMH);
  assert.equal(run.ok, true, JSON.stringify(run));
  assert.equal(run.score, summary.totals.score);
  // The envelope's final state is the summary's totals.
  const finalState = context.currentCanonicalFinalState(summary);
  assert.deepEqual(plain(finalState), {
    hp: 0, score: summary.totals.score, kills: summary.kills.total, maxCombo: summary.totals.maxCombo,
    survivalSeconds: Number((summary.totals.elapsedMs / 1000).toFixed(3)), level: summary.totals.level, bossKills: summary.kills.boss,
    characterId: summary.identity.heroId, killedBy: summary.defeat.causeId,
  });
  await until(() => events[0].detail.handle.state === 'queued');
  assert.equal(events[0].detail.context.entry.status, 'confirmed');
  assert.equal(context.lastSettlementQueued, true);
  assert.equal(context.dom.combatStatus.textContent, 'Run verified. Queued for publishing on LitVM…');
  assert.equal(calls.globalFetch.length, 0);
  assert.deepEqual(errors, []);
});

test('live Chikun settles the verified v6 evidence and publication stamps the local rows', async () => {
  const session = liveSession(CHIKUN);
  const flap = CHIKUN.body.evidence.flap;
  const canonical = replayChikunRun(flap);
  const confirmed = async (url, init) => {
    const body = JSON.parse(init.body);
    return { status: 200, headers: { get: () => null }, json: async () => ({ ok: true, view: 'owner', sessionId32: body.sessionId32, gameId: 'chikun', wallet: CHIKUN.wallet, status: 'confirmed', score: canonical.score, retryable: false, pollAfterMs: null, txHash: `0x${'cd'.repeat(32)}`, confirmedAt: '2026-09-23T01:00:00.000Z' }) };
  };
  const glue = rankedGlueContext({ session, live: true, clientFetch: confirmed });
  const { context, events, calls } = glue;
  // The local record the Chikun lifecycle writes before settlement.
  context.recordScore(context.state, session, canonical.score, {
    elapsedSeconds: canonical.survivalTime, survivalTime: canonical.survivalTime, survivalTicks: canonical.survivalTicks, coinsCollected: canonical.coinsCollected,
    forksPassed: canonical.forksPassed, nearMisses: canonical.nearMisses, bestCombo: canonical.bestCombo, achievements: canonical.achievements,
    replayClaim: { version: 'chikun-parent-replay-v1', seed: session.seed, buildHash: session.buildHash, seasonId: session.seasonId, evidence: flap, finalState: canonical.finalState },
  });
  await context.settleChikunRankedRun(session, { canonical, evidence: flap, acceptedForGlobalLeaderboard: true });
  await until(() => events.length === 1);
  const [post] = calls.clientFetch;
  assert.deepEqual(post.body.evidence, CHIKUN.body.evidence);
  const run = await serverAccepts(post.body, CHIKUN);
  assert.equal(run.ok, true, JSON.stringify(run));
  const { handle, context: result } = events[0].detail;
  assert.equal(handle.state, 'published');
  assert.deepEqual(plain(result.localStats), plain(statsFromChikunResult(canonical)));
  assert.equal(result.sessionId32, CHIKUN.body.sessionId32);
  assert.equal(context.lastSettlementSucceeded, true);
  const key = CHIKUN.body.sessionId32;
  const row = context.state.leaderboards.chikun.find((entry) => entry.sessionId === session.sessionId);
  assert.equal(row.onChainSessionId32, key);
  assert.equal(row.settlementTxHash, `0x${'cd'.repeat(32)}`);
  assert.equal(context.state.officialSessions.find((entry) => entry.sessionId === session.sessionId).onChainSessionId32, key);
});

test('a request that cannot be built never reaches the network and is shown as not published', async () => {
  const session = liveSession(CHIKUN);
  delete session.seedTicket; // e.g. a live session opened without a ticket
  const glue = rankedGlueContext({ session, live: true });
  await glue.context.settleChikunRankedRun(session, { canonical: replayChikunRun(CHIKUN.body.evidence.flap), evidence: CHIKUN.body.evidence.flap });
  await until(() => glue.events.length === 1);
  assert.equal(glue.events[0].detail.handle.state, 'rejected');
  assert.equal(glue.events[0].detail.handle.snapshot.error.code, 'request-unavailable');
  assert.equal(glue.calls.clientFetch.length, 0);
});

test('Chikun Ranked completion hands the run to settlement; Free completion does not', async () => {
  for (const live of [false, true]) {
    const session = live ? liveSession(CHIKUN) : previewSession('chikun');
    const glue = rankedGlueContext({ session, live, clientFetch: settleOk('pending') });
    const settled = [];
    glue.context.boundSession = session;
    glue.context.settleChikunRankedRun = (...args) => { settled.push(args); return Promise.resolve(null); };
    const onComplete = portalCallback('createChikunPortalLifecycle', 'onComplete', glue.context);
    const result = { canonical: { score: 12, survivalTime: 3 }, evidence: CHIKUN.body.evidence.flap, acceptedForGlobalLeaderboard: true };
    onComplete(result);
    assert.equal(settled.length, 1);
    assert.equal(settled[0][0], session);
    assert.equal(settled[0][1], result);
    assert.equal(glue.context.lastCompletedSession, session);
    assert.equal(glue.context.dom.officialGameStateCopy.textContent, live ? 'Ranked score 12 replay-verified. Publishing your run on LitVM — see the results panel.' : PREVIEW_COPY);
    assert.doesNotMatch(glue.context.dom.officialGameStateCopy.textContent, /accepted for your profile/);
  }
  const free = startPlaySession({ wallet: HMH.wallet, gameId: 'chikun', mode: 'free' });
  const glue = rankedGlueContext({ session: free });
  glue.context.boundSession = free;
  glue.context.settleChikunRankedRun = () => { throw new Error('Free never settles'); };
  portalCallback('createChikunPortalLifecycle', 'onComplete', glue.context)({ canonical: { score: 5, survivalTime: 1 }, acceptedForGlobalLeaderboard: false });
  assert.match(glue.context.dom.officialGameStateCopy.textContent, /^Free score 5 verified locally/);
});

test('a Ranked Hard Money Heroes restart goes back through the paid entry', async () => {
  for (const hmhRebootActive of [true, false]) {
    const calls = [];
    const context = vm.createContext({
      hmhRebootActive, currentSession: { sessionId: 'finished', isPaid: true }, officialSelectedMode: 'ranked',
      playSfxCue: () => {}, startOfficialMode: (mode) => { calls.push(['startOfficialMode', mode]); return Promise.resolve(); },
      beginTrackedSession: () => { throw new Error('a Ranked restart must not reuse or mint a session without the entry'); },
    });
    await loadPortalFunctions(['restartCombatRun'], context).restartCombatRun();
    assert.deepEqual(calls, [['startOfficialMode', 'ranked']], `reboot=${hmhRebootActive}`);
  }
});

test('a Ranked Chikun restart goes back through the paid entry; Free restarts in place', async () => {
  const chikunCalls = [];
  const chikun = vm.createContext({
    currentSession: { sessionId: 'finished', leaderboardEligible: true }, officialSelectedMode: 'ranked',
    startOfficialMode: (mode) => { chikunCalls.push(['startOfficialMode', mode]); return Promise.resolve(); },
    destroyChikunSession: () => chikunCalls.push(['destroy']), startMode: () => { throw new Error('no in-place Ranked restart'); },
  });
  await loadPortalFunctions(['restartChikunSession'], chikun).restartChikunSession();
  assert.deepEqual(chikunCalls, [['startOfficialMode', 'ranked']], 'the finished cabinet stays until a new session mounts');

  const freeCalls = [];
  const free = vm.createContext({
    currentSession: { sessionId: 'practice', leaderboardEligible: false }, officialSelectedMode: 'free',
    startOfficialMode: () => { throw new Error('Free restarts in place'); },
    destroyChikunSession: () => freeCalls.push('destroy'), startMode: (mode) => { freeCalls.push(['startMode', mode]); return Promise.resolve(); },
    setOfficialView: (view) => freeCalls.push(['view', view]), mountChikunSession: () => freeCalls.push('mount'),
  });
  await loadPortalFunctions(['restartChikunSession'], free).restartChikunSession();
  assert.deepEqual(freeCalls, ['destroy', ['startMode', 'free'], ['view', 'gameplay'], 'mount']);
});

test('the reboot bridge records boss defeats but not one event per enemy kill', () => {
  const session = previewSession('lester-blaster');
  const context = vm.createContext({ currentSession: session, recordSessionEvent });
  const onRunEvent = portalCallback('createHmhRebootHost', 'onRunEvent', context);
  for (let index = 0; index < 12_000; index += 1) onRunEvent({ payload: { tick: index, sequence: index, eventType: 'enemy-defeated', value: 1 } });
  onRunEvent({ payload: { tick: 99, sequence: 1, eventType: 'boss-defeated', value: 1 } });
  assert.deepEqual(session.evidence.events.map((event) => event.type), ['hmh-reboot:boss-defeated']);
  assert.equal(session.evidence.droppedEvents, 0, 'long runs no longer overflow the 10,000-event cap');
});

test('the combat menu offers Submit Official Score only when a retry can help', () => {
  const { context } = rankedGlueContext({ session: previewSession('lester-blaster') });
  for (const [state, expected] of [['saved-locally', true], ['retrying', true], ['queued', false], ['publishing', false], ['published', false], ['rejected', false], ['preview', false]]) {
    context.lastSettlementHandle = { state };
    assert.equal(context.rankedPublishRetryAvailable(), expected, state);
  }
  let retried = 0;
  context.lastSettlementHandle = { state: 'saved-locally', retry: () => { retried += 1; return Promise.resolve(); } };
  context.retryPublishGameOver();
  assert.equal(retried, 1, 'Retry Publish re-drives the settlement handle');
  assert.equal((PORTAL_MAIN.match(/officialSubmissionEnabled: SETTLEMENT_LIVE && \(lastSettlementSucceeded \|\| rankedPublishRetryAvailable\(\)\)/g) ?? []).length, 2);
});

test('lastSettlement state resets at the start of every run', () => {
  const { context } = rankedGlueContext({ session: previewSession('chikun') });
  let unsubscribed = 0;
  Object.assign(context, { lastSettlementHandle: { state: 'published' }, lastSettlementUnsubscribe: () => { unsubscribed += 1; }, lastSettlementSucceeded: true, lastSettlementQueued: true, lastSettlementError: 'x', lastSettlementInput: {}, lastRunStatsForSettlement: {}, lastHmhRunSummary: {} });
  Object.assign(context.combat, { gameOver: true, gameOverSubmitted: true });
  context.resetRankedRunState();
  assert.equal(unsubscribed, 1);
  for (const key of ['lastSettlementHandle', 'lastSettlementError', 'lastSettlementInput', 'lastRunStatsForSettlement', 'lastHmhRunSummary']) assert.equal(context[key], null, key);
  assert.equal(context.lastSettlementSucceeded, false);
  assert.equal(context.lastSettlementQueued, false);
  assert.equal(context.combat.gameOverSubmitted, false, 'a new Ranked run can be submitted after a restart through the entry modal');
  const startMode = PORTAL_MAIN.slice(PORTAL_MAIN.indexOf('async function startMode('), PORTAL_MAIN.indexOf('async function completePrototypeRun('));
  assert.match(startMode, /resetRankedRunState\(\);\s+captureRankedResultContext\(currentSession\);/);
});

test('no player-signed submit, attestation call or HMH season override remains in the settlement path', () => {
  const start = PORTAL_MAIN.indexOf('function recordCurrentSessionEvent(');
  const end = PORTAL_MAIN.indexOf('const activeLevelUpPointerIds');
  const range = PORTAL_MAIN.slice(start, end);
  for (const retired of ['submitRankedSession(', 'requestVerifierAttestation(', 'profileSync.settle(', 'validateRunPlausibility(', 'CURRENT_RANKED_SEASON_ID', '/user rejected|denied|4001/']) {
    assert.equal(range.includes(retired), false, retired);
  }
  assert.match(PORTAL_MAIN, /finalizeRanked: \(\{ runSummary \}\) => submitCombatGameOver\(runSummary\)/);
});
