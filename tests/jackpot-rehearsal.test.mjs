import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import {
  DAY, HOUR, TOKEN, createChainClock, evidenceForSeed, parseTimeTarget, revertReasonOf, startJackpotStack,
} from '../scripts/lib/jackpot-rehearsal-driver.mjs';
import { replayChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';

/**
 * jackpot-rehearsal AC1: the driver (the local stack + the jackpot, the chain-bound server clock, the cron
 * with the jackpotSelect / keeperFault seams, the owner page's call encoding) on ONE stack in this file.
 * Keys: the public Hardhat test mnemonic only. Offline: in-process chain, PGlite, in-process handlers.
 */

test('the driver helpers: time targets, revert reasons and the chain-bound clock', async () => {
  assert.equal(parseTimeTarget('+2h', 1_000), 1_000 + 2 * HOUR);
  assert.equal(parseTimeTarget('+90s', 1_000), 1_090);
  assert.equal(parseTimeTarget('+1d', 0), DAY);
  assert.equal(parseTimeTarget(1_790_000_000, 0), 1_790_000_000);
  assert.equal(parseTimeTarget('2026-10-05T00:00:00Z', 0), Date.parse('2026-10-05T00:00:00Z') / 1000);
  assert.throws(() => parseTimeTarget('soon', 0), /not a time/);

  const data = new ethers.Interface(['error Error(string)']).encodeErrorResult('Error', ['PAYOUT_NOT_DUE']);
  assert.equal(revertReasonOf({ code: 'CALL_EXCEPTION', info: { error: { data } } }), 'PAYOUT_NOT_DUE');
  assert.equal(revertReasonOf({ reason: 'LEADER_NOT_CLEARED' }), 'LEADER_NOT_CLEARED');
  assert.equal(revertReasonOf({ message: 'nothing here' }), null);

  // The server clock follows the latest block plus the wall time since it, and never lags an advanceTo.
  let latest = 2_000_000_000;
  const clock = createChainClock({ getBlock: async () => ({ timestamp: latest }) });
  await clock.sync();
  assert.ok(Math.abs(clock.nowMs() - latest * 1000) < 1_000, 'bound to the latest block, not the wall clock');
  clock.setOffset(latest + 3 * HOUR);
  assert.ok(clock.nowMs() >= (latest + 3 * HOUR) * 1000 - 50, 'a set next-block time moves the server clock with it');
  latest += 10 * DAY;
  await clock.sync();
  assert.ok(clock.nowMs() >= latest * 1000, 'a later block moves it forward');
  assert.equal(clock.latestSeconds(), latest);

  // Evidence is played for the seed it is given (the ticket's seed), and it replays to the same score.
  const run = evidenceForSeed({ seed: 424242, profile: 'expert', maxMinutes: 0.25 });
  assert.equal(run.flap.seed, 424242);
  assert.equal(replayChikunRun(run.flap).score, run.score);
  const pilot = evidenceForSeed({ seed: 424242, pilot: 'route', maxMinutes: 0.25 });
  assert.equal(pilot.source, 'pilot:route');
  const nonStock = evidenceForSeed({ seed: 99, maxMinutes: 0.2, maxTicks: 108_000 });
  assert.equal(nonStock.flap.maxTicks, 108_000);
});

let js;
before(async () => {
  js = await startJackpotStack();
});

after(async () => {
  await js?.close();
});

test('the stack: launch rules, the flip-week epoch from the operator CLI, E5 on chain and the chain-bound clock', async () => {
  const first = js.firstWeek;
  assert.equal((await js.jackpot.rulesFor(first)).adminClearOnly, true, 'the first (soft-launch) epoch needs the admin for every payout');
  assert.equal((await js.jackpot.rulesFor(first + 1)).adminClearOnly, false, 'the operator scheduled adminClearOnly = false from the next week');
  assert.equal(await js.jackpot.blocked('0x8841ae6244dba71f620de450e71b0ef7e0cce824'), true);
  assert.equal(await js.jackpot.blocked(js.wallets.verifier.address), true);
  assert.equal(await js.jackpot.blocked(js.wallets.relayer.address), true);
  assert.equal(await js.jackpot.blocked(js.wallets.funder.address), true);
  assert.equal(js.env.JACKPOT_KEEPER_PRIVATE_KEY, js.keeperWallet.privateKey, 'the keeper env is the fixture keeper');
  const latest = (await js.provider.getBlock('latest')).timestamp;
  assert.ok(Math.abs(js.nowMs() - latest * 1000) < 5_000, 'the server clock is chain time');
  const health = await js.health();
  assert.equal(health.jackpot.configured, true, 'the jackpotDeployment seam reaches the server config');
  assert.equal(BigInt(await js.token.balanceOf(js.wallets.funder.address)), 1_000_000n * TOKEN, 'the funder was minted tCHIKUN through jackpot-actions');
});

test('the driver walks one funded week with one Ranked player to paid on the real cron', async () => {
  const week = js.claimWeek(await js.beginWeek());
  assert.ok((await js.fund(week, 150n * TOKEN)).ok, "the owner page's fund plan: exact approve, then fund");
  const player = await js.freshWallet('driver smoke player');
  const run = await js.playRankedChikunRun({ player, openedAt: js.at(week, 'start', DAY), maxMinutes: 0.5 });
  assert.equal(run.openedAt, js.at(week, 'start', DAY), 'the entry was paid at exactly the chosen chain time');
  assert.ok(run.submittedAt >= run.openedAt + run.survivalSeconds - 30, 'settled after the run length (A26)');
  const [ticket] = await js.db.query('SELECT week_key FROM seed_ticket_log WHERE session_handle = $1', [run.sessionHandle]);
  assert.equal(ticket.week_key, js.weekKey(week), 'the seed ticket was logged in its week');
  const selected = [];
  await js.advanceTo(js.at(week, 'close', 2 * HOUR + 60));
  // The seams reach the cron: the select filter sees the keeper's selection rows.
  const runs = await js.runJackpotCron(2, { select: (rows) => { selected.push(...rows.map((row) => row.sessionId32)); return rows; } });
  assert.ok(runs.every((response) => response.status === 200));
  assert.deepEqual(selected, [run.sessionId32]);
  await js.advanceTo(js.at(week, 'settleCutoff', 11 * 60));
  await js.runJackpotCron(1);
  await js.advanceTo(js.at(week, 'payoutAt', 60));
  assert.ok((await js.cronUntil(async () => (await js.weekRow(week)).status === 'paid', { max: 4 })) !== null);
  assert.equal(await js.tokenBalance(run.wallet), 150n * TOKEN);
  assert.ok((await js.invariant()).ok);
});
