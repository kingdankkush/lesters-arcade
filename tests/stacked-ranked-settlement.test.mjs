import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeCrypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { applySeedTicket } from '../apps/portal/src/ranked-identity.mjs';
import { startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS } from '../apps/portal/src/stacked-contracts.mjs';
import { createStackedReplayStore } from '../apps/portal/src/stacked-replay-store.mjs';
import { persistStackedRankedRun, stackedReplayBase64Url, writeStackedRankedReplay } from '../apps/portal/src/stacked-persistence.mjs';
import { createStackedPortalLifecycle } from '../apps/portal/src/stacked-portal-lifecycle.mjs';
import { STACKED_RANKED_RESULT_COPY, stackedRankedResultCopy } from '../apps/portal/src/stacked-host.mjs';
import { RANKED_PENDING_KEY } from '../apps/portal/src/ranked-settlement.mjs';
import { verifyRankedRun } from '../server/verify/index.mjs';
import { FIXTURE_REGISTRY, FIXTURE_SEED_SECRET } from './fixtures/ranked/build-fixtures.mjs';
import { PORTAL_MAIN, portalCallback, rankedGlueContext, until } from './helpers/ranked-client-vm.mjs';

const STACKED = JSON.parse(readFileSync(new URL('./fixtures/ranked/stacked-valid.json', import.meta.url), 'utf8'));
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const BYTES = new Uint8Array(Buffer.from(STACKED.body.evidence.sic1, 'base64'));
const DIGEST = `0x${nodeCrypto.createHash('sha256').update(BYTES).digest('hex')}`;

function rankedSession() {
  const { identity, seedTicket } = STACKED.body;
  const session = startPlaySession({ wallet: identity.wallet, gameId: 'stacked', mode: 'paid', sessionNonce: identity.nonce });
  Object.assign(session, { buildHash: identity.buildHash, seasonId: identity.seasonId });
  session.canonicalContext = Object.freeze({ ...session.canonicalContext, buildHash: identity.buildHash, seasonId: identity.seasonId });
  applySeedTicket(session, { seed: identity.seed, seedTicket });
  session.entryReceipt = { txHash: `0x${'ef'.repeat(32)}`, sessionId32: STACKED.body.sessionId32, amountWei: '102000000000000000', status: 'confirmed' };
  return session;
}

function canonicalFor(session) {
  return replayStackedRun(BYTES, { expectedSeed: session.seed, maxTicks: STACKED_MAX_TICKS, config: { startLevel: 1, buildHash: session.buildHash, seasonId: session.seasonId } });
}

const pendingSettle = async (url, init) => {
  const body = JSON.parse(init.body);
  return { status: 200, headers: { get: () => null }, json: async () => ({ ok: true, view: 'owner', sessionId32: body.sessionId32, status: 'pending', retryable: true, pollAfterMs: 3000, txHash: null }) };
};

test('persistRanked writes the replay store with the evidence digest and builds the settle body', async () => {
  const session = rankedSession();
  const canonical = canonicalFor(session);
  const glue = rankedGlueContext({ session, live: true, clientFetch: pendingSettle });
  const { context, storage, events, calls } = glue;
  const result = await persistStackedRankedRun({
    state: context.state, storage, session, evidence: BYTES, canonical, metadata: { inputDevice: 'keyboard', evidenceDigest: DIGEST }, live: true,
    settle: () => context.settleStackedRankedRun(session, canonical, BYTES),
  });
  // 1. The local archive, through persistStackedScore.
  assert.equal(result.acceptedForLocalLeaderboard, true);
  assert.equal(context.state.profiles[session.wallet].progress.stacked.rankedArchive[session.sessionId].canonical.score, canonical.score);
  // 2. The replay store, with the host digest passed through (not recomputed).
  const replay = createStackedReplayStore(storage).read(session.sessionId);
  assert.deepEqual({ ...replay }, { sessionId: session.sessionId, score: canonical.score, encoded: stackedReplayBase64Url(BYTES), mode: 'ranked', resultHash: DIGEST });
  assert.equal(Buffer.from(replay.encoded, 'base64url').equals(Buffer.from(BYTES)), true);
  // 3. The settle body: standard padded base64 SIC1, accepted by the server verifier.
  await until(() => events.length === 1 && calls.clientFetch.length === 1);
  const [post] = calls.clientFetch;
  assert.equal(post.body.gameId, 'stacked');
  assert.equal(post.body.sessionId32, STACKED.body.sessionId32);
  assert.equal(post.body.evidence.sic1, STACKED.body.evidence.sic1);
  assert.equal(post.body.claim.score, canonical.score);
  const run = await verifyRankedRun(post.body, { chainId: STACKED.chainId, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: STACKED.wallet, nowMs: STACKED.verifyAtMs, seedSecret: FIXTURE_SEED_SECRET, crypto: nodeCrypto });
  assert.equal(run.ok, true, JSON.stringify(run));
  // 4. The results hand-off and the stored retry source.
  assert.equal(events[0].type, 'lesters:ranked-run');
  assert.equal(events[0].detail.context.gameId, 'stacked');
  assert.equal(events[0].detail.context.localStats.lines, canonical.lines);
  assert.equal(JSON.parse(storage.getItem(RANKED_PENDING_KEY))[0].sessionId32, STACKED.body.sessionId32);

  // main.js wires exactly this module function and this settle step.
  const persistRanked = PORTAL_MAIN.slice(PORTAL_MAIN.indexOf('async persistRanked('), PORTAL_MAIN.indexOf('onRestart() {'));
  assert.match(persistRanked, /persistStackedRankedRun\(\{/);
  assert.match(persistRanked, /settle: \(\) => settleStackedRankedRun\(boundSession, canonical, evidence\)/);
  assert.match(PORTAL_MAIN, /builders\.buildStackedSettleRequest\(\{ session, scoreRegistryAddress: LITVM_CONTRACT_ADDRESSES\.scoreSubmissionRegistry, sic1Bytes: evidence, claimScore: canonical\.score \}\)/);
});

test('preview keeps the archive and a replay copy, sends nothing, and builds no body', async () => {
  const session = rankedSession();
  const canonical = canonicalFor(session);
  const preview = rankedGlueContext({ session });
  const result = await persistStackedRankedRun({ state: preview.context.state, storage: preview.storage, session, evidence: BYTES, canonical, metadata: { evidenceDigest: DIGEST }, live: false, settle: () => preview.context.settleStackedRankedRun(session, canonical, BYTES) });
  assert.equal(result.acceptedForLocalLeaderboard, true);
  await until(() => preview.events.length === 1);
  assert.equal(preview.events[0].detail.handle.state, 'preview');
  // Brief acceptance 5: the replay store is written in both modes.
  assert.deepEqual({ ...createStackedReplayStore(preview.storage).read(session.sessionId) }, { sessionId: session.sessionId, score: canonical.score, encoded: stackedReplayBase64Url(BYTES), mode: 'ranked', resultHash: DIGEST });
  assert.equal(preview.storage.getItem(RANKED_PENDING_KEY), null, 'no pending settle body in preview');
  assert.equal(preview.calls.clientFetch.length + preview.calls.globalFetch.length, 0, 'zero /api requests in preview');
  assert.equal(preview.calls.loadRankedRequests ?? 0, 0, 'preview never loads the request builders');
  assert.deepEqual(preview.errors, []);
});

test('an unsaved preview is not handed off; a live paid run whose archive failed still settles and reports it', async () => {
  const session = rankedSession();
  const canonical = canonicalFor(session);
  const storage = { data: new Map(), getItem(key) { return this.data.get(key) ?? null; }, setItem(key, value) { this.data.set(key, value); }, removeItem(key) { this.data.delete(key); } };
  const settled = [];
  const failingState = { get profiles() { throw new Error('boom'); } };
  await assert.rejects(persistStackedRankedRun({ state: failingState, storage, session, evidence: BYTES, canonical, metadata: { evidenceDigest: DIGEST }, live: false, settle: async () => settled.push('preview') }), /boom/);
  assert.deepEqual(settled, [], 'an unsaved preview is not handed off');
  const live = await persistStackedRankedRun({ state: failingState, storage, session, evidence: BYTES, canonical, metadata: { evidenceDigest: DIGEST }, live: true, settle: async () => settled.push('live') });
  assert.deepEqual(settled, ['live'], 'the paid run still goes to the server');
  assert.deepEqual(live, { archived: false, archiveError: 'boom' }, 'publishing, with only the device copy missing: no throw');

  // Through the lifecycle: ok (finalized, so no second hand-off), with archived:false.
  const binding = { seed: 44, buildHash: 'stacked-local', seasonId: 'stacked-season-preview-1', leaderboardEligible: true };
  const claim = { score: 10, lines: 1 };
  let handedOff = 0;
  const lifecycle = createStackedPortalLifecycle({ session: binding, verify: async () => ({ ...claim }), persistRanked: async () => { handedOff += 1; return { archived: false, archiveError: 'boom' }; } });
  assert.deepEqual(await lifecycle.finish(BYTES, claim, { evidenceDigest: DIGEST }), { ok: true, canonical: claim, ranked: true, archived: false });
  assert.equal((await lifecycle.finish(BYTES, claim, { evidenceDigest: DIGEST })).reason, 'already-finalizing');
  assert.equal(handedOff, 1);
  const saved = createStackedPortalLifecycle({ session: binding, verify: async () => ({ ...claim }), persistRanked: async () => ({ acceptedForLocalLeaderboard: true }) });
  assert.deepEqual(await saved.finish(BYTES, claim, {}), { ok: true, canonical: claim, ranked: true });

  // The child and parent lines: publishing, not "Not saved".
  assert.equal(stackedRankedResultCopy({ ok: true, ranked: true, archived: false }, true), STACKED_RANKED_RESULT_COPY.liveUnarchived);
  assert.match(STACKED_RANKED_RESULT_COPY.liveUnarchived, /^Replay verified\. Publishing your run on LitVM/);
  assert.doesNotMatch(STACKED_RANKED_RESULT_COPY.liveUnarchived, /Not saved/);
  const dom = { officialGameStateCopy: { textContent: 'Publishing your run on LitVM…' } };
  portalCallback('createStackedHost', 'onResult', vm.createContext({ combat: {}, dom, SETTLEMENT_LIVE: true }))({ ok: true, ranked: true, archived: false });
  assert.equal(dom.officialGameStateCopy.textContent, 'Publishing your run on LitVM…', 'the settlement handle keeps the line');
});

test('replay copies over the stored-replay cap are refused, not truncated', () => {
  const storage = { data: new Map(), getItem(key) { return this.data.get(key) ?? null; }, setItem(key, value) { this.data.set(key, value); }, removeItem(key) { this.data.delete(key); } };
  const big = new Uint8Array(180_001).fill(7);
  assert.deepEqual(writeStackedRankedReplay(storage, { sessionId: 'game-session-big', score: 1, evidence: big, evidenceDigest: DIGEST }), { stored: false, reason: 'replay-too-large' });
  assert.deepEqual(writeStackedRankedReplay(storage, { sessionId: 'game-session-x', score: 1, evidence: BYTES, evidenceDigest: null }), { stored: false, reason: 'invalid-replay' });
});

test('the host digest reaches persistRanked through the lifecycle metadata', async () => {
  const session = { seed: 44, buildHash: 'stacked-local', seasonId: 'stacked-season-preview-1', leaderboardEligible: true };
  const claim = { score: 10, lines: 1 };
  const seen = [];
  const lifecycle = createStackedPortalLifecycle({ session, verify: async () => ({ ...claim }), persistRanked: async (canonical, evidence, metadata) => { seen.push(metadata); } });
  assert.equal((await lifecycle.finish(BYTES, claim, { inputDevice: 'touch', evidenceDigest: DIGEST })).ok, true);
  assert.deepEqual({ ...seen[0] }, { inputDevice: 'touch', evidenceDigest: DIGEST });
  const again = createStackedPortalLifecycle({ session, verify: async () => ({ ...claim }), persistRanked: async (canonical, evidence, metadata) => { seen.push(metadata); } });
  await again.finish(BYTES, claim, { inputDevice: 'nope', evidenceDigest: 'not-a-digest' });
  assert.deepEqual({ ...seen[1] }, { inputDevice: null, evidenceDigest: null });
  const host = read('../apps/portal/src/stacked-host.mjs');
  assert.match(host, /lifecycle\.finish\(evidence, data\.payload\.tuple, \{ inputDevice: data\.payload\.summary\.handling\.inputDevice, evidenceDigest: digest \}\)/);
});

test('ranked copy is truthful in preview and live', () => {
  assert.equal(STACKED_RANKED_RESULT_COPY.live, 'Replay verified. Publishing your run on LitVM — see the results panel.');
  assert.equal(STACKED_RANKED_RESULT_COPY.preview, 'Replay verified. Ranked preview: nothing is published while online settlement is off.');
  for (const copy of Object.values(STACKED_RANKED_RESULT_COPY)) assert.ok(copy.length <= 512);
  assert.equal(stackedRankedResultCopy({ ok: true, ranked: true }, true), STACKED_RANKED_RESULT_COPY.live);
  assert.equal(stackedRankedResultCopy({ ok: true, ranked: true }, false), STACKED_RANKED_RESULT_COPY.preview);
  assert.equal(stackedRankedResultCopy({ ok: true, ranked: true, archived: false }, false), STACKED_RANKED_RESULT_COPY.preview);
  const host = read('../apps/portal/src/stacked-host.mjs');
  assert.match(host, /settlementLive = false/);
  assert.match(host, /result\.ranked \? stackedRankedResultCopy\(result, settlementLive\)/);
  assert.doesNotMatch(host, /local Ranked preview, not an online or paid leaderboard/);
  assert.match(PORTAL_MAIN, /startLevel, settlementLive: SETTLEMENT_LIVE,/);

  // The parent line after a STACKED result.
  for (const live of [false, true]) {
    const dom = { officialGameStateCopy: { textContent: 'unchanged' } };
    const context = vm.createContext({ combat: {}, dom, SETTLEMENT_LIVE: live });
    const onResult = portalCallback('createStackedHost', 'onResult', context);
    onResult({ ok: true, ranked: true });
    assert.equal(dom.officialGameStateCopy.textContent, live ? 'unchanged' : 'Canonical Ranked preview saved locally. No transaction was sent; verified on-chain publishing remains disabled.', 'live: the settlement handle owns the line');
    onResult({ ok: true, ranked: false });
    assert.match(dom.officialGameStateCopy.textContent, /Free Mode did not write/);
    onResult({ ok: false, reason: 'cabinet-closed' });
    assert.equal(dom.officialGameStateCopy.textContent, 'STACKED run not saved: cabinet-closed');
  }
  assert.doesNotMatch(PORTAL_MAIN, /Online settlement is disabled/);
});

test('a finished Ranked STACKED run restarts through a paid entry', () => {
  for (const ranked of [true, false]) {
    const calls = [];
    const context = vm.createContext({
      boundSession: { leaderboardEligible: ranked },
      destroyStackedSession: () => calls.push('destroy'),
      startOfficialMode: (mode) => { calls.push(['startOfficialMode', mode]); return Promise.resolve(); },
      setOfficialView: () => { throw new Error('restart no longer drops to mode select'); },
    });
    portalCallback('createStackedHost', 'onRestart', context)();
    assert.deepEqual(calls, ranked ? [['startOfficialMode', 'ranked']] : ['destroy', ['startOfficialMode', 'free']]);
  }
});

test('child Ranked copy is true with settlement off and on', () => {
  const stacked = read('../apps/stacked/src/main.mjs');
  assert.match(stacked, /init\.mode === 'ranked' \? 'RANKED' : 'FREE MODE'/);
  assert.match(stacked, /'Ranked is active for this run\.'/);
  assert.match(stacked, /Ranked has a shared 15-minute pause allowance/, 'the pause allowance copy stays');
  assert.doesNotMatch(stacked, /RANKED PREVIEW|Ranked preview is active on this device/);
  const page = read('../apps/portal/stacked/index.html');
  assert.match(page, /<span class="tile-label">Ranked<\/span><span class="tile-hint">Verified runs<\/span>/);
  assert.doesNotMatch(page, /tile-hint">Local ledger/);
  const chikun = read('../apps/chikun/src/main.mjs');
  assert.match(chikun, /'Ranked run sent to Lester’s Arcade for verification\.'/);
  assert.doesNotMatch(chikun, /sent for parent replay|update this device’s profile and local Chikun score boards/);
});
