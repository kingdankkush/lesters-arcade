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
import * as rankedSettlementModule from '../apps/portal/src/ranked-settlement.mjs';
import { HMH_PLAYER_SETTINGS_DEFAULTS } from '../apps/portal/src/hmh-player-settings.mjs';
import { DEFAULT_KEYBOARD_BINDINGS } from '../apps/hmh-reboot/src/action-map.mjs';
import { PORTAL_AST, PORTAL_MAIN, loadPortalFunctions, memoryStorage, portalCallback, portalFunctionSource, rankedGlueContext, until } from './helpers/ranked-client-vm.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/ranked/${name}.json`, import.meta.url), 'utf8'));
const HMH = fixture('hmh-valid');
const CHIKUN = fixture('chikun-valid');
const STACKED = fixture('stacked-valid');
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
  for (const source of [HMH, CHIKUN, STACKED]) {
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
  // Approved: the entry opens a new session and mounts a new cabinet.
  const approved = [];
  const approve = vm.createContext({
    currentSession: { sessionId: 'finished', leaderboardEligible: true }, officialSelectedMode: 'ranked', chikunHost: { id: 'finished-cabinet' },
    startOfficialMode: (mode) => { approved.push(['startOfficialMode', mode]); approve.currentSession = { sessionId: 'next', leaderboardEligible: true }; approve.chikunHost = { id: 'next-cabinet' }; return Promise.resolve(); },
    destroyChikunSession: () => approved.push(['destroy']), setOfficialView: (view) => approved.push(['view', view]), startMode: () => { throw new Error('no in-place Ranked restart'); },
  });
  await loadPortalFunctions(['restartChikunSession'], approve).restartChikunSession({ fromChild: true });
  assert.deepEqual(approved, [['startOfficialMode', 'ranked']], 'the finished cabinet stays until a new session mounts');
  assert.match(PORTAL_MAIN, /onRestartRequest: \(\) => \{ void restartChikunSession\(\{ fromChild: true \}\); \},/);
});

test('a declined Ranked Chikun restart from the child returns to mode select instead of a dead Run Again', async () => {
  // No wallet, a declined sign-in, a cancelled or failed entry: startOfficialMode
  // returns without a session, and the child's Run Again stays disabled.
  for (const outcome of ['cancelled', 'threw']) {
    const calls = [];
    const finished = { sessionId: 'finished', leaderboardEligible: true };
    const context = vm.createContext({
      currentSession: finished, officialSelectedMode: 'ranked', chikunHost: { id: 'finished-cabinet' },
      startOfficialMode: (mode) => { calls.push(['startOfficialMode', mode]); return outcome === 'threw' ? Promise.reject(new Error('wallet unavailable')) : Promise.resolve(); },
      destroyChikunSession: () => { calls.push(['destroy']); context.chikunHost = null; }, setOfficialView: (view) => calls.push(['view', view]),
      startMode: () => { throw new Error('no in-place Ranked restart'); },
    });
    const restart = loadPortalFunctions(['restartChikunSession'], context).restartChikunSession({ fromChild: true });
    if (outcome === 'threw') await assert.rejects(restart, /wallet unavailable/);
    else await restart;
    assert.deepEqual(calls, [['startOfficialMode', 'ranked'], ['destroy'], ['view', 'mode-select']], outcome);
  }

  // The combat menu's Restart disables nothing in the child: a declined entry
  // leaves the cabinet (and a paused run) as it was.
  const menu = [];
  const fromMenu = vm.createContext({
    currentSession: { sessionId: 'running', leaderboardEligible: true }, officialSelectedMode: 'ranked', chikunHost: { id: 'cabinet' },
    startOfficialMode: (mode) => { menu.push(['startOfficialMode', mode]); return Promise.resolve(); },
    destroyChikunSession: () => menu.push(['destroy']), setOfficialView: (view) => menu.push(['view', view]),
  });
  await loadPortalFunctions(['restartChikunSession'], fromMenu).restartChikunSession();
  assert.deepEqual(menu, [['startOfficialMode', 'ranked']]);

  const freeCalls = [];
  const free = vm.createContext({
    currentSession: { sessionId: 'practice', leaderboardEligible: false }, officialSelectedMode: 'free', chikunHost: { id: 'cabinet' },
    startOfficialMode: () => { throw new Error('Free restarts in place'); },
    destroyChikunSession: () => freeCalls.push('destroy'), startMode: (mode) => { freeCalls.push(['startMode', mode]); return Promise.resolve(); },
    setOfficialView: (view) => freeCalls.push(['view', view]), mountChikunSession: () => freeCalls.push('mount'),
  });
  await loadPortalFunctions(['restartChikunSession'], free).restartChikunSession({ fromChild: true });
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
  const startMode = PORTAL_MAIN.slice(PORTAL_MAIN.indexOf('async function startMode('), PORTAL_MAIN.indexOf('async function startCombat('));
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

test('Chikun preview runs the real settlement glue with no network and no request builders', async () => {
  const session = previewSession('chikun');
  const glue = rankedGlueContext({ session });
  const canonical = replayChikunRun(CHIKUN.body.evidence.flap);
  await glue.context.settleChikunRankedRun(session, { canonical, evidence: CHIKUN.body.evidence.flap, acceptedForGlobalLeaderboard: true });
  await until(() => glue.events.length === 1);
  const { handle, context } = glue.events[0].detail;
  assert.equal(glue.events[0].type, 'lesters:ranked-run');
  assert.equal(handle.state, 'preview');
  assert.equal(context.gameId, 'chikun');
  assert.deepEqual(plain(context.localStats), plain(statsFromChikunResult(canonical)));
  assert.equal(glue.calls.globalFetch.length + glue.calls.clientFetch.length, 0, 'zero /api requests and zero RPC calls in preview');
  assert.equal(glue.calls.loadRankedRequests, undefined, 'preview never loads the builders');
  assert.equal(glue.context.dom.officialGameStateCopy.textContent, PREVIEW_COPY);
  assert.deepEqual(glue.errors, []);
  // One hand-off per run, even if a finish is reported twice.
  await glue.context.settleChikunRankedRun(session, { canonical, evidence: CHIKUN.body.evidence.flap, acceptedForGlobalLeaderboard: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(glue.events.length, 1);
});

test('an entry that failed on chain makes the run practice and nothing is posted', async () => {
  const session = liveSession(CHIKUN, { entry: 'failed' });
  assert.equal(session.entryReceipt.status, 'pending', 'the receipt alone would still post');
  const glue = rankedGlueContext({ session, live: true, clientFetch: settleOk('pending') });
  const canonical = replayChikunRun(CHIKUN.body.evidence.flap);
  await glue.context.settleChikunRankedRun(session, { canonical, evidence: CHIKUN.body.evidence.flap, acceptedForGlobalLeaderboard: true });
  await until(() => glue.events.length === 1 && glue.events[0].detail.handle.state !== 'waiting-entry');
  const { handle } = glue.events[0].detail;
  assert.equal(handle.state, 'practice', 'session.entryConfirmed reached the client');
  assert.equal(handle.snapshot.entry.status, 'failed');
  assert.equal(glue.calls.clientFetch.filter((call) => call.url === '/api/settle').length, 0, 'zero /api/settle calls');
  assert.equal(glue.context.dom.officialGameStateCopy.textContent, 'Entry didn’t go through. This run is practice and won’t be ranked.');
});

test('a lazy chunk that fails at game over is fetched again, and a paid run is never dropped silently', async () => {
  const immediate = (fn) => { fn(); return 0; };
  const canonical = replayChikunRun(CHIKUN.body.evidence.flap);
  const result = { canonical, evidence: CHIKUN.body.evidence.flap, acceptedForGlobalLeaderboard: true };

  // The live Ranked run start preloads the builders; preview does not.
  const start = liveSession(CHIKUN);
  const preload = rankedGlueContext({ session: start, live: true });
  preload.context.captureRankedResultContext(start);
  assert.equal(preload.calls.loadRankedRequests, 1, 'loaded when the run starts, not at game over');
  const quiet = rankedGlueContext({ session: previewSession('chikun') });
  quiet.context.captureRankedResultContext(quiet.context.currentSession);
  assert.equal(quiet.calls.loadRankedRequests, undefined);

  // The client chunk fails twice, then loads: the run still settles.
  const flaky = rankedGlueContext({ session: liveSession(CHIKUN), live: true, clientFetch: settleOk('pending') });
  const realClient = flaky.context.rankedSettlementClient;
  let failures = 2;
  flaky.context.setTimeout = immediate;
  flaky.context.rankedSettlementClient = () => (failures-- > 0 ? Promise.reject(new Error('chunk load failed')) : realClient());
  await flaky.context.settleChikunRankedRun(flaky.context.currentSession, result);
  await until(() => flaky.events.length === 1 && flaky.calls.clientFetch.length === 1);
  assert.equal(failures, -1, 'two retries');

  // The builders never load: the run is shown as not prepared, not dropped.
  const noBuilders = rankedGlueContext({ session: liveSession(CHIKUN), live: true, clientFetch: settleOk('pending') });
  let builderLoads = 0;
  noBuilders.context.setTimeout = immediate;
  noBuilders.context.loadRankedRequests = () => { builderLoads += 1; return Promise.reject(new Error('chunk load failed')); };
  await noBuilders.context.settleChikunRankedRun(noBuilders.context.currentSession, result);
  await until(() => noBuilders.events.length === 1);
  assert.equal(builderLoads, 3, 'the first load and two retries');
  assert.equal(noBuilders.events[0].detail.handle.state, 'rejected');
  assert.equal(noBuilders.events[0].detail.handle.snapshot.error.code, 'request-unavailable');
  assert.equal(noBuilders.calls.clientFetch.length, 0);

  // The client never loads: the status line says so.
  const noClient = rankedGlueContext({ session: liveSession(CHIKUN), live: true });
  noClient.context.setTimeout = immediate;
  noClient.context.rankedSettlementClient = () => Promise.reject(new Error('chunk load failed'));
  assert.equal(await noClient.context.settleChikunRankedRun(noClient.context.currentSession, result), null);
  assert.equal(noClient.events.length, 0);
  assert.match(noClient.context.dom.officialGameStateCopy.textContent, /could not be sent for publishing: part of the page failed to load/);
});

test('a legacy sandbox run (no summary) records the live counters, with the boss only when beaten', () => {
  for (const bossDefeated of [false, true]) {
    const session = previewSession('lester-blaster');
    const { context } = rankedGlueContext({ session });
    Object.assign(context.combat, {
      score: 4200, kills: 17, elapsedGameSeconds: 95.4, maxCombo: 6, killsByType: { 'fiat-goon': 12, 'bear-bot': 5 },
      bossDefeated, weaponId: 'pistol', noDamageSeconds: 0, collectedPowerUpTypes: ['shield'], killedBy: 'fiat-goon',
    });
    context.lastBossId = 'boss-liquidator';
    context.submitCombatGameOver();
    const row = context.state.leaderboards['lester-blaster'].find((entry) => entry.sessionId === session.sessionId);
    assert.equal(row.score, 4200);
    assert.equal(row.runStats.bossId, bossDefeated ? 'boss-liquidator' : null, 'an encountered boss is not a beaten boss');
    assert.deepEqual(plain(row.runStats.enemyKillsByType), { 'fiat-goon': 12, 'bear-bot': 5 }, 'the key the resolver reads');
    assert.equal(row.runStats.killsByType, undefined);
    const run = context.state.runHistory.find((entry) => entry.sessionId === session.sessionId);
    assert.equal(run.kills, 17);
    assert.equal(run.killedBy, 'fiat-goon');
  }
});

test('the HMH run log, sync packet and recap read the summary, and an unmappable summary is not recorded', async () => {
  const summary = HMH.body.evidence.runSummary;
  const session = previewSession('lester-blaster');
  const glue = rankedGlueContext({ session });
  const packets = [];
  glue.context.submitGameRun = (game, packet) => packets.push({ game, ...packet });
  // Stale live counters that must not reach any record.
  Object.assign(glue.context.combat, { score: 1, kills: 2, elapsedGameSeconds: 3, killedBy: 'stale' });
  glue.context.submitCombatGameOver(summary);
  const run = glue.context.state.runHistory.find((entry) => entry.sessionId === session.sessionId);
  const elapsed = summary.totals.elapsedMs / 1000;
  assert.equal(run.score, summary.totals.score);
  assert.equal(run.kills, summary.kills.total);
  assert.equal(run.elapsedSeconds, Math.round(elapsed));
  assert.equal(run.killedBy, summary.defeat?.causeId ?? null);
  assert.equal(run.runSummary, summary);
  assert.deepEqual(packets, [{ game: 'hard-money-heroes', sessionId: session.sessionId, score: summary.totals.score, kills: summary.kills.total, survivalTime: Math.round(elapsed) }]);
  assert.equal(glue.context.lastRunScore, summary.totals.score);
  assert.equal(glue.context.lastRunResult.elapsedSeconds, statsFromHmhRunSummary(summary).survivalSeconds);

  const broken = structuredClone(summary);
  broken.totals.score = -1; // the §6.3 mapper refuses it, and so does the server
  const other = previewSession('lester-blaster');
  const bad = rankedGlueContext({ session: other });
  Object.assign(bad.context.combat, { score: 999, kills: 9, elapsedGameSeconds: 99 });
  bad.context.submitCombatGameOver(broken);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(bad.context.state.leaderboards['lester-blaster'].some((entry) => entry.sessionId === other.sessionId), false, 'no Ranked record from the stale counters');
  assert.equal(bad.context.state.profiles[other.wallet]?.progress?.['lester-blaster']?.paidRuns ?? 0, 0);
  assert.equal(bad.context.lastRunResult.acceptedForGlobalLeaderboard, false);
  assert.equal(bad.events.length, 0, 'nothing to settle');
  assert.equal(bad.context.combat.gameOverSubmitted, true);
  assert.equal(bad.context.dom.combatStatus.textContent, 'This run’s summary could not be read, so it was not recorded or ranked.');
});

// The shipped boot block of main.js (the retry-request, wallet-session and
// boot pending-count wiring) and rankedSettlementClient(), run in a VM with a
// fake window and profile sync. Only the dynamic import() is swapped.
function settlementBootHarness({ live, stored = [] }) {
  const listeners = new Map();
  const events = [];
  const timers = [];
  const spy = { imports: 0, resume: 0, retrySignedOut: 0, retryRequests: [], clients: [], invalidated: 0 };
  const storage = memoryStorage();
  if (stored.length) storage.setItem(rankedSettlementModule.RANKED_PENDING_KEY, JSON.stringify(stored));
  const wallet = CHIKUN.wallet.toLowerCase();
  const block = PORTAL_AST.body.find((node) => node.type === 'IfStatement' && PORTAL_MAIN.slice(node.start, node.end).includes("'lesters:ranked-retry-request'"));
  assert.ok(block, 'main.js registers the settlement listeners in one top-level block');
  const source = [portalFunctionSource('rankedSettlementClient'), portalFunctionSource('walletSessionToken'), portalFunctionSource('invalidateWalletSession'), PORTAL_MAIN.slice(block.start, block.end)].join('\n').replaceAll('import(', '__import(');
  assert.equal((source.match(/__import\(/g) ?? []).length, 1, 'the client is the only lazy import here');
  const context = vm.createContext({
    SETTLEMENT_LIVE: live,
    ARCADE_STORAGE: storage,
    rankedSettlementClientPromise: null,
    // Bearer tokens come only through the wallet session (contract §7.6).
    walletSession: { token: (address) => (address === wallet ? 'owner-token' : null), invalidate: () => { spy.invalidated += 1; } },
    walletAuthenticated: true,
    profileSync: { logout: () => { throw new Error('the wallet session drops the token, not profileSync directly'); } },
    applyRankedPublication: () => {},
    console: { error: (...args) => { throw new Error(`unexpected error ${args.join(' ')}`); } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    window: {
      addEventListener: (type, fn) => { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
      dispatchEvent: (event) => { events.push(event); for (const fn of listeners.get(event.type) ?? []) fn(event); return true; },
    },
    __import: async (path) => {
      assert.equal(path, './src/ranked-settlement.mjs');
      spy.imports += 1;
      return {
        ...rankedSettlementModule,
        createRankedSettlementClient: (options) => {
          spy.options = options;
          // The shipped options, with the network swapped for a refusal.
          const client = rankedSettlementModule.createRankedSettlementClient({ ...options, fetchImpl: () => { throw new Error('no network in this test'); }, setTimeoutImpl: () => 0, clearTimeoutImpl: () => {} });
          const wrapped = {
            ...client,
            resume: (...args) => { spy.resume += 1; return client.resume(...args); },
            retrySignedOut: (...args) => { spy.retrySignedOut += 1; return client.retrySignedOut(...args); },
            handleRetryRequest: (detail) => { spy.retryRequests.push(detail); return client.handleRetryRequest(detail); },
          };
          spy.clients.push(wrapped);
          return wrapped;
        },
      };
    },
  });
  vm.runInContext(source, context);
  const dispatch = (type, detail) => context.window.dispatchEvent(new context.CustomEvent(type, { detail }));
  const pendingCounts = () => events.filter((event) => event.type === 'lesters:ranked-pending').map((event) => event.detail.count);
  return { context, events, timers, spy, storage, wallet, dispatch, pendingCounts };
}

const storedBody = (index) => {
  const sessionId32 = `0x${String(index).padStart(2, '0').repeat(32)}`;
  return { sessionId32, gameId: 'chikun', wallet: CHIKUN.wallet.toLowerCase(), localScore: 5, entry: { status: 'confirmed', txHash: null }, savedAt: 0, body: { ...CHIKUN.body, sessionId32 } };
};

test('live: boot reports the stored count, the first sign-in resumes once, later sign-ins re-drive, retry requests reach the client', async () => {
  const boot = settlementBootHarness({ live: true, stored: [storedBody(1), storedBody(2)] });
  await until(() => boot.spy.clients.length === 1);
  await until(() => boot.pendingCounts().length === 1);
  assert.deepEqual(boot.pendingCounts(), [2], 'lesters:ranked-pending once after boot, with the stored count');
  assert.equal(boot.timers.length, 0);

  // getToken is bound to the run's wallet session.
  assert.equal(boot.spy.options.live, true);
  assert.equal(boot.spy.options.getToken(boot.wallet), 'owner-token');
  assert.equal(boot.spy.options.getToken(`0x${'9'.repeat(40)}`), null, 'no token for another wallet');
  // A 401 on a settle call drops the token through the wallet session.
  boot.spy.options.onUnauthorized(boot.wallet);
  assert.equal(boot.spy.invalidated, 1);
  assert.equal(boot.context.walletAuthenticated, false);

  boot.dispatch('lesters:wallet-session', { wallet: boot.wallet, authenticated: false });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(boot.spy.resume, 0, 'an unauthenticated session resumes nothing');
  boot.dispatch('lesters:wallet-session', { wallet: boot.wallet, authenticated: true });
  boot.dispatch('lesters:wallet-session', { wallet: boot.wallet, authenticated: true });
  await until(() => boot.spy.retrySignedOut === 1);
  assert.equal(boot.spy.resume, 1, 'resume() once per page load');
  assert.equal(boot.spy.imports, 1, 'one lazy client');

  const detail = { sessionId32: storedBody(1).sessionId32 };
  boot.dispatch('lesters:ranked-retry-request', detail);
  boot.dispatch('lesters:ranked-retry-request', { sessionId32: null });
  await until(() => boot.spy.retryRequests.length === 2);
  assert.deepEqual(plain(boot.spy.retryRequests), [detail, { sessionId32: null }]);

  // Each change of the stored count is dispatched.
  boot.spy.clients[0].settle({ ...CHIKUN.body, sessionId32: storedBody(3).sessionId32 });
  assert.deepEqual(boot.pendingCounts(), [2, 3]);
});

test('preview: boot reports zero once, and no event loads the client', async () => {
  const boot = settlementBootHarness({ live: false, stored: [storedBody(1)] });
  assert.equal(boot.timers.length, 1);
  boot.timers[0].fn();
  assert.deepEqual(boot.pendingCounts(), [0], 'lesters:ranked-pending { count: 0 } once after boot');
  boot.dispatch('lesters:wallet-session', { wallet: boot.wallet, authenticated: true });
  boot.dispatch('lesters:ranked-retry-request', { sessionId32: null });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(boot.spy.imports, 0, 'preview never loads the settlement client for these events');
  assert.equal(boot.spy.resume, 0);
  assert.deepEqual(boot.spy.retryRequests, []);
});

// Contract §11.5: the HMH child's initial JS counts the chunk it shares with
// the portal, export list included. The §6.4 mapper at the HMH game-over call
// site (achievements/stats.mjs) adds HMH_RUN_SUMMARY_CATALOGS to that list, so
// the portal takes DEFAULT_KEYBOARD_BINDINGS off it and builds the same
// defaults with normalizeKeyboardBindings(): the HMH total stays at the base.
test('the portal keyboard defaults equal the action map defaults without importing them from the HMH shared chunk', () => {
  const portalDefaults = HMH_PLAYER_SETTINGS_DEFAULTS.controls.keyboardBindings;
  assert.deepEqual({ ...portalDefaults }, { ...DEFAULT_KEYBOARD_BINDINGS });
  assert.deepEqual(Object.keys(portalDefaults), Object.keys(DEFAULT_KEYBOARD_BINDINGS), 'same action order');
  assert.equal(Object.isFrozen(portalDefaults), true);
  assert.notEqual(portalDefaults, DEFAULT_KEYBOARD_BINDINGS, 'the portal keeps its own copy');
  const source = readFileSync(new URL('../apps/portal/src/hmh-player-settings.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import\s*\{[^}]*\bDEFAULT_KEYBOARD_BINDINGS\b/);
});
