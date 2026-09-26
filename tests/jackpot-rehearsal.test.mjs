import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import {
  DAY, HOUR, TOKEN, createChainClock, evidenceForSeed, parseTimeTarget, revertReasonOf, startJackpotStack,
} from '../scripts/lib/jackpot-rehearsal-driver.mjs';
import { FAST_SUBSET, REHEARSAL_RECEIPT_SCHEMA, REHEARSAL_SCRIPT_RELATIVE_PATH, SCENARIOS, runScenario } from '../scripts/rehearse-jackpot-week.mjs';
import { replayChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';

/**
 * jackpot-rehearsal AC1 and AC3: the driver (the local stack + the jackpot, the chain-bound server clock,
 * the cron with the jackpotSelect / keeperFault seams, the owner page's call encoding) and the fast subset
 * of the rehearsal scenarios, R1, R3a, R5, R10, R13, R15 and R17, on ONE stack in this file. Bot runs are
 * capped at 1.5 minutes as E2E_EVIDENCE does, and R13's decoys are 1-minute pilots. The full set, R1-R20,
 * runs from scripts/rehearse-jackpot-week.mjs; its committed receipt is checked at the end.
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
  const evasion = evidenceForSeed({ seed: 424242, pilot: 'humanisedSolver', maxMinutes: 0.2 });
  assert.deepEqual([evasion.source, evasion.flap.maxTicks, replayChikunRun(evasion.flap).score], ['pilot:humanisedSolver', 216_000, evasion.score], 'an evasion pilot is cut, not truncated');
});

let js;
const shared = { fast: true };
const results = new Map();

before(async () => {
  js = await startJackpotStack();
});

after(async () => {
  await js?.close();
});

async function scenario(id) {
  const spec = SCENARIOS.find((entry) => entry.id === id);
  const result = await runScenario(js, { ...spec, shared });
  results.set(id, result);
  const failed = result.checks.filter((check) => !check.ok);
  assert.equal(result.status, 'passed', `${id}: ${JSON.stringify(result.failure)} ${JSON.stringify(failed).slice(0, 1500)}`);
  assert.ok(result.invariant.every((entry) => entry.ok && BigInt(entry.balanceWei) >= BigInt(entry.liabilitiesWei)), 'balanceOf(jackpot) >= liabilities');
  return result;
}

const checkIds = (result) => result.checks.map((check) => check.id);

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

test('a funded week pays the top eligible wallet at the payout time', async () => {
  const result = await scenario('R1');
  for (const id of ['finalize-early-reverts', 'finalize-by-anyone-at-payout', 'board-top-is-winner', 'profile-win', 'share-champion-badge', 'seed-tickets-logged', 'api-open-leader']) {
    assert.ok(checkIds(result).includes(id), id);
  }
  assert.ok(result.transactions.keeper >= 6, 'the keeper cleared and submitted three runs');
  assert.ok(BigInt(result.keeperGasUsed) > 0n);
});

test('a flagged leader waits for the admin and a disqualification pays the next', async () => {
  const result = await scenario('R3a');
  for (const id of ['pilot-held-by-h4-h6', 'awaiting-admin', 'finalize-reverts-leader-not-cleared', 'status-page-warns', 'review-api', 'admin-disqualifies', 'api-shows-disqualified-reason']) {
    assert.ok(checkIds(result).includes(id), id);
  }
});

test('an unwon week rolls into the next week\'s pot', async () => {
  const result = await scenario('R5');
  assert.equal(result.weekKeys.length, 2);
  for (const id of ['keeper-finalized-empty-leader', 'rolled-on-chain', 'carried-into-next-week', 'api-next-week-pot', 'winner-balance']) assert.ok(checkIds(result).includes(id), id);
});

test('a crashed keeper resumes without duplicate transactions', async () => {
  const result = await scenario('R10');
  for (const id of ['killed-after-cas', 'killed-after-broadcast', 'killed-before-receipt', 'cas-without-broadcast', 'nonce-advances-by-distinct-actions', 'no-duplicate-transactions', 'no-nonce-gap', 'dropped-detected']) {
    assert.ok(checkIds(result).includes(id), id);
  }
});

test('five decoys cannot push the honest leader out of the prize', async () => {
  const result = await scenario('R13');
  for (const id of ['honest-hold-top-5', 'decoys-outscore-honest', 'honest-displaced', 'decoys-screened-first-and-flagged', 'keeper-relists-honest', 'relists-before-payout-minus-2h', 'winner-balance', 'decoys-cannot-return']) {
    assert.ok(checkIds(result).includes(id), id);
  }
});

test('a non-stock client is never submitted and is flagged if submitted', async () => {
  const result = await scenario('R15');
  for (const id of ['settled-through-verifier', 'never-submitted-by-keeper', 'flagged-integrity', 'no-keeper-submit', 'never-auto-paid']) assert.ok(checkIds(result).includes(id), id);
});

test('a stale keeper action never overrides the admin', async () => {
  const result = await scenario('R17');
  for (const id of ['flag-dropped', 'admin-clears', 'rescreen-applied-on-stale-mirror', 'dropped-flag-resigned-then-skipped', 'rescreen-created-no-review-action', 'rescreen-refused-once-mirrored', 'keeper-flag-reverts-review-locked', 'winner-balance']) {
    assert.ok(checkIds(result).includes(id), id);
  }
  assert.deepEqual([...results.keys()], [...FAST_SUBSET], 'the whole fast subset ran, in order');
});

test('the committed full rehearsal receipt passes R1-R20 with R16 as the expected miss, from this script', () => {
  const dir = new URL('../docs/qa/', import.meta.url);
  const names = readdirSync(dir).filter((name) => /^jackpot-rehearsal-\d{8}\.json$/.test(name)).sort();
  assert.ok(names.length > 0, 'docs/qa/jackpot-rehearsal-<date>.json is committed');
  const text = readFileSync(new URL(names.at(-1), dir), 'utf8');
  const receipt = JSON.parse(text);
  assert.equal(receipt.schema, REHEARSAL_RECEIPT_SCHEMA);
  assert.equal(receipt.ok, true);
  assert.deepEqual(receipt.scenarios.map((entry) => entry.id), SCENARIOS.map((entry) => entry.id), 'every scenario, in order');
  for (const id of ['R1', 'R2', 'R3a', 'R3b', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R13v', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20']) {
    assert.ok(receipt.scenarios.some((entry) => entry.id === id), id);
  }
  for (const entry of receipt.scenarios) {
    assert.equal(entry.status, 'passed', entry.id);
    assert.ok(entry.checks.length > 0 && entry.checks.every((check) => check.ok), entry.id);
    for (const key of ['weekKeys', 'transactions', 'keeperGasUsed', 'finalBalances', 'invariant', 'expectedMisses']) assert.ok(Object.hasOwn(entry, key), `${entry.id}.${key}`);
    assert.ok(entry.invariant.length > 0 && entry.invariant.every((row) => row.ok && BigInt(row.balanceWei) >= BigInt(row.liabilitiesWei)), `${entry.id}: balanceOf >= liabilities`);
    assert.ok(entry.checks.some((check) => /^api-/.test(check.id)), `${entry.id} reads /api/jackpot through parseJackpot`);
  }
  assert.deepEqual(receipt.expectedMisses.map((miss) => miss.scenario), ['R16'], 'R16 is the one expected miss, and it is not a failure');
  assert.ok(receipt.productBugs.every((bug) => bug.status === 'fixed'), 'every product bug the rehearsal found is fixed');
  assert.doesNotMatch(text, /(?<![A-Za-z])[A-Za-z]:(\\|\/)|AppData|\/home\/|\/Users\//, 'no local path in the committed receipt');
  const script = readFileSync(new URL(`../${REHEARSAL_SCRIPT_RELATIVE_PATH}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(receipt.scriptSha256, createHash('sha256').update(script, 'utf8').digest('hex'), 'the receipt was made by this script: re-run node scripts/rehearse-jackpot-week.mjs after editing it');
});
