import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import * as achievements from '../apps/portal/src/achievements/index.mjs';
import { RANKED_GAME_IDS } from '../apps/portal/src/ranked-identity.mjs';
import * as verify from '../server/verify/index.mjs';
import * as settleApi from '../api/settle.mjs';
import * as retryApi from '../api/cron/settle-retry.mjs';
import { invoke } from './helpers/fake-http.mjs';
import { SETTLE_CRON_VALUE } from './helpers/settle-fixtures.mjs';
import { createSettleHarness, QUICK_EVIDENCE } from './helpers/settle-handler-harness.mjs';
import { readFixture } from './fixtures/ranked/build-fixtures.mjs';

/**
 * Contract §10.4 rule 6, the settle-wiring proof, part two, through the same
 * production mount as tests/api-settle-handler.test.mjs (the real verify,
 * achievements and seed-ticket modules, an unmigrated PGlite and the
 * in-process chain): a wallet's second run per game on its stored history,
 * the real E3 handler's rejections (one per class: wrong wallet token 403,
 * unpaid 402, tampered evidence 422 or 400) and the real E13 retry cron.
 * Every test plays its own runs. player2 settles runs only in the history
 * test (elsewhere it only signs in, for the 403), so its first runs there
 * are first runs whatever order the tests run in.
 *
 * Evidence that must NOT verify at the ticket seed is the committed
 * stacked-valid fixture's (played at the fixture seed), so no STACKED run is
 * generated just to be rejected.
 */

const h = createSettleHarness({ ip: '203.0.113.42' });
before(() => h.start());
after(() => h.close());

const FOREIGN_STACKED_EVIDENCE = readFixture('stacked-valid').body.evidence;
const numberAt = (stats, path) => {
  const value = path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), stats);
  return typeof value === 'number' ? value : 0;
};

test('a second run per game is settled on the stored history: no achievement twice, cumulative counts carried', async () => {
  // player2 settles runs only in this test (see the header).
  const wallet = h.local.chain.wallets.player2;
  for (const gameId of RANKED_GAME_IDS) {
    // eslint-disable-next-line no-await-in-loop
    const first = await h.settleAndAssert(gameId, { wallet, evidence: QUICK_EVIDENCE[gameId] });
    // eslint-disable-next-line no-await-in-loop
    const second = await h.settleAndAssert(gameId, { wallet, evidence: QUICK_EVIDENCE[gameId] });
    assert.equal(first.history.runs, 0, `${gameId}: player2's first run`);
    assert.ok(first.unlocks.length > 0, `${gameId}: the first run earns achievements`);
    // The real readAchievementHistory carries the first run into the second.
    assert.equal(second.history.runs, 1, `${gameId}: the first run is in the history`);
    assert.deepEqual(second.history.unlockedIds, [...first.unlocks].sort(), `${gameId}: the first run's unlocks are in the history`);
    for (const [path, total] of Object.entries(second.history.sums)) {
      assert.ok(Math.abs(total - numberAt(first.expected.stats, path)) < 1e-6, `${gameId}: sum of ${path}`);
    }
    for (const [path, best] of Object.entries(second.history.maxima)) {
      assert.ok(Math.abs(best - numberAt(first.expected.stats, path)) < 1e-6, `${gameId}: max of ${path}`);
    }
    // A history-blind derivation would hand out the first run's ids again;
    // the server's (on the stored history) did not.
    const blind = achievements.deriveEarnedAchievements(gameId, second.expected, achievements.emptyHistory(wallet.address.toLowerCase(), gameId)).map((entry) => entry.id);
    assert.ok(blind.some((id) => first.unlocks.includes(id)), `${gameId}: an empty history would repeat first-run ids`);
    assert.deepEqual(second.unlocks.filter((id) => first.unlocks.includes(id)), [], `${gameId}: no first-run id is earned again`);
    const recorded = await h.db.query('SELECT achievement_id FROM achievement_unlocks WHERE wallet = $1 AND game_id = $2 ORDER BY achievement_id', [wallet.address.toLowerCase(), gameId]);
    assert.deepEqual(recorded.map((unlock) => unlock.achievement_id), [...first.unlocks, ...second.unlocks].sort(), `${gameId}: each achievement recorded once`);
  }
});


test('a token for another wallet is 403 and writes nothing', async () => {
  const player = h.local.chain.wallets.player1;
  const body = await h.playRun(player, 'chikun', { evidence: QUICK_EVIDENCE.chikun });
  const expected = await h.verifiedPreview(body, player);
  await h.payAndWait(body, player, { survivalSeconds: expected.contract.survivalSeconds });
  const before = await h.snapshotSideEffects();
  const response = await h.postSettle(body, await h.authHeaders(h.local.chain.wallets.player2));
  assert.deepEqual([response.status, response.body.error], [403, 'wallet-mismatch']);
  assert.deepEqual(await h.snapshotSideEffects(), before);
  // The owner can still settle it.
  const owned = await h.postSettle(body, await h.authHeaders(player));
  assert.deepEqual([owned.status, owned.body.status], [200, 'confirmed'], JSON.stringify(owned.body));
});

test('an unpaid session is 402 before the replay, and writes nothing', async () => {
  const player = h.local.chain.wallets.player1;
  // Evidence the replay would reject (it was played at another seed): a 402
  // proves the paid-entry check (§4.3.3 step 9) runs before verification
  // (step 12).
  const body = await h.ticketBody(player, 'stacked', FOREIGN_STACKED_EVIDENCE);
  const wouldFail = await verify.verifyRankedRun(body, h.verifyOptions(player));
  assert.deepEqual([wouldFail.ok, wouldFail.error], [false, 'evidence-seed-mismatch']);
  await h.advanceChain(120);
  const before = await h.snapshotSideEffects();
  const response = await h.postSettle(body, await h.authHeaders(player));
  assert.deepEqual([response.status, response.body.error], [402, 'entry-not-paid'], JSON.stringify(response.body));
  assert.deepEqual(await h.snapshotSideEffects(), before);
  assert.equal((await h.onChainSession(body.sessionId32)).exists, false);
  const status = await h.getStatus(body.sessionId32);
  assert.equal(status.status, 404, 'E4 knows no such session');
});

test('tampered evidence is rejected by the real verifiers and writes nothing', async () => {
  const player = h.local.chain.wallets.player1;
  // Chikun: a flap listed after the run's final tick fails the canonical replay.
  const chikun = await h.playRun(player, 'chikun', { evidence: QUICK_EVIDENCE.chikun });
  const run = await h.verifiedPreview(chikun, player);
  chikun.evidence.flap.flapDeltas = [...chikun.evidence.flap.flapDeltas, 60_000];
  await h.payAndWait(chikun, player, { survivalSeconds: run.contract.survivalSeconds });
  let before = await h.snapshotSideEffects();
  const replay = await h.postSettle(chikun, await h.authHeaders(player));
  assert.deepEqual([replay.status, replay.body.error], [422, 'replay-rejected'], JSON.stringify(replay.body));
  assert.deepEqual(await h.snapshotSideEffects(), before);

  // HMH: an inflated score is above the reboot ceiling (the envelope does not
  // bind the summary totals, the plausibility validator does).
  const hmh = await h.playRun(player, 'lester-blaster');
  const hmhRun = await h.verifiedPreview(hmh, player);
  hmh.evidence.runSummary.totals.score *= 1000;
  await h.payAndWait(hmh, player, { survivalSeconds: hmhRun.contract.survivalSeconds });
  before = await h.snapshotSideEffects();
  const implausible = await h.postSettle(hmh, await h.authHeaders(player));
  assert.deepEqual([implausible.status, implausible.body.error], [422, 'implausible-run'], JSON.stringify(implausible.body));
  assert.ok(implausible.body.flags.length > 0 && implausible.body.flags.every((flag) => Object.keys(flag).sort().join(',') === 'id,severity'), 'flag ids and severities only');
  assert.deepEqual(await h.snapshotSideEffects(), before);

  // STACKED: evidence played at another seed does not bind to this ticket.
  const stacked = await h.ticketBody(player, 'stacked', FOREIGN_STACKED_EVIDENCE);
  await h.payAndWait(stacked, player, { survivalSeconds: 0 });
  before = await h.snapshotSideEffects();
  const foreign = await h.postSettle(stacked, await h.authHeaders(player));
  assert.deepEqual([foreign.status, foreign.body.error], [400, 'evidence-seed-mismatch'], JSON.stringify(foreign.body));
  assert.deepEqual(await h.snapshotSideEffects(), before);
});

test('the retry cron re-signs each waiting run from its re-verified stored evidence, and refuses one whose stored evidence changed', async () => {
  // E3 records and signs the runs, but the relayer's RPC is down: every row
  // waits as failed with rpc-unavailable and no attempt spent (§3.3).
  const player = h.local.chain.wallets.player1;
  const outage = h.wrapProvider({ estimateGas: async () => { throw Object.assign(new Error('rpc down'), { code: 'NETWORK_ERROR' }); } });
  const settleDuringOutage = h.mount(settleApi, { provider: outage });
  const waiting = [];
  for (const gameId of ['chikun', 'stacked', 'lester-blaster', 'chikun']) {
    // eslint-disable-next-line no-await-in-loop
    const body = await h.playRun(player, gameId, { evidence: QUICK_EVIDENCE[gameId] });
    // eslint-disable-next-line no-await-in-loop
    const expected = await h.verifiedPreview(body, player);
    // eslint-disable-next-line no-await-in-loop
    await h.payAndWait(body, player, { survivalSeconds: expected.contract.survivalSeconds });
    // eslint-disable-next-line no-await-in-loop
    const response = await invoke(settleDuringOutage, { method: 'POST', url: '/api/settle', headers: await h.authHeaders(player), body });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual([response.body.status, response.body.lastError, response.body.attempts, response.body.retryable, response.body.pollAfterMs], ['failed', 'rpc-unavailable', 0, true, 3000]);
    // eslint-disable-next-line no-await-in-loop
    const row = await h.rowFor(body.sessionId32);
    waiting.push({ body, expected, deadline: Number(JSON.parse(row.attestation).deadline) });
  }
  // The last Chikun run's stored evidence is edited in the database (one
  // flap fewer): re-verifying it gives another run than the row records.
  const edited = waiting.pop();
  const flap = JSON.parse((await h.evidenceFor(edited.body.sessionId32)).evidence);
  const shorter = JSON.stringify({ ...flap, flapDeltas: flap.flapDeltas.slice(0, -1) });
  await h.db.query('UPDATE session_evidence SET evidence = $2 WHERE session_id32 = $1', [edited.body.sessionId32, shorter]);
  const storedIdentity = JSON.parse((await h.evidenceFor(edited.body.sessionId32)).identity);
  const reverified = await verify.reverifyStoredRun({ gameId: 'chikun', identity: storedIdentity, evidence: { encoding: edited.expected.evidence.encoding, text: shorter } }, { nowMs: h.clockMs });
  assert.ok(reverified.ok === false || reverified.score !== edited.expected.score || reverified.envelopeHash !== edited.expected.envelopeHash, 'the edited evidence is another run');

  // Past the 900 s attestation lifetime: the cron must re-sign each row from
  // its stored evidence through the real reverifyStoredRun before submitting.
  await h.advanceChain(1_000);
  const nonceBefore = await h.relayerNonce();
  const unauthorized = await invoke(h.mount(retryApi), { url: '/api/cron/settle-retry', headers: { authorization: 'Bearer wrong' } });
  assert.equal(unauthorized.status, 401);
  const cron = await invoke(h.mount(retryApi), { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
  assert.equal(cron.status, 200, JSON.stringify(cron.body));
  const processed = new Map(cron.body.processed.map((item) => [item.sessionId32, item]));
  assert.equal(await h.relayerNonce(), nonceBefore + waiting.length, 'one transaction per intact waiting run, none for the edited one');
  for (const { body, expected, deadline } of waiting) {
    assert.deepEqual(processed.get(body.sessionId32), { sessionId32: body.sessionId32, from: 'failed', to: 'confirmed', code: null }, body.gameId);
    // eslint-disable-next-line no-await-in-loop
    const row = await h.rowFor(body.sessionId32);
    assert.deepEqual([row.status, row.attempts, Number(row.score), row.envelope_hash], ['confirmed', 0, expected.score, expected.envelopeHash]);
    assert.ok(Number(JSON.parse(row.attestation).deadline) >= deadline + 1_000, `${body.gameId} was re-signed with a fresh deadline`);
    // eslint-disable-next-line no-await-in-loop
    const session = await h.onChainSession(body.sessionId32);
    assert.deepEqual([session.exists, session.player.toLowerCase(), session.score], [true, player.address.toLowerCase(), BigInt(expected.score)]);
    // eslint-disable-next-line no-await-in-loop
    const status = await h.getStatus(body.sessionId32);
    assert.deepEqual([status.body.view, status.body.status, status.body.txHash], ['public', 'confirmed', row.tx_hash]);
  }
  // The edited row: the re-sign rule (§3.3, S16) refused it for good.
  assert.deepEqual(processed.get(edited.body.sessionId32), { sessionId32: edited.body.sessionId32, from: 'failed', to: 'failed', code: 'stored-run-mismatch' });
  const refused = await h.rowFor(edited.body.sessionId32);
  assert.deepEqual([refused.status, refused.last_error, refused.attempts, refused.tx_hash], ['failed', 'stored-run-mismatch', 1, null]);
  assert.equal(Number(JSON.parse(refused.attestation).deadline), edited.deadline, 'never re-signed');
  assert.equal((await h.onChainSession(edited.body.sessionId32)).exists, false, 'never published');
  const owner = await h.getStatus(edited.body.sessionId32, await h.authHeaders(player));
  assert.deepEqual([owner.body.status, owner.body.lastError, owner.body.txHash], ['failed', 'stored-run-mismatch', null]);
});
