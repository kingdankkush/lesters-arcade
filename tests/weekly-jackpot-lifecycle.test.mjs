// WeeklyJackpot over whole weeks (design §A.6, §A.9, §A.10, §A.12, §A.16): payouts at C + 24 h, rollovers,
// the prize cap, claim-pending prizes (blacklist and max-transaction mocks), recycling, pauses and holds,
// end of life, stray tokens (sender-fee and double-entry mocks), re-entrancy, a randomized invariant run,
// and the Cancun opcode audit. In-process chain (chainId 4441, offline), real 1.8.x Ranked contracts with
// entry fees on, evm_snapshot / evm_revert between tests, chain time only via evm_setNextBlockTimestamp.
import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import { activateLocalGames, deployLocalSuite, loadArtifact, localWalletKeys, startLocalChain } from '../scripts/lib/local-chain.mjs';
import {
  deployLocalJackpot,
  deployMockToken,
  derivedFixtureWallet,
  fastLocalProvider,
  launchRules,
  reconnectWallets,
  setChainTime,
  settleLocalRun,
  weekIndexOf,
  weekStartOf,
} from '../scripts/lib/local-jackpot.mjs';
import { JACKPOT_NON_REENTRANT, jackpotReentrancyProblems } from '../scripts/contract-structure-check.mjs';

const TOKEN = 10n ** 18n;
const HOUR = 3600;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MIN_FUND = 100n * TOKEN;
const b32 = ethers.encodeBytes32String;
const IFACE = new ethers.Interface(loadArtifact('WeeklyJackpot').abi);
const REENTRANT_CALL = IFACE.getError('ReentrancyGuardReentrantCall').selector;
const verifierKey = localWalletKeys().verifier;

let chain;
let provider;
let wallets;
let suite;
let jackpot;
let token;
let W;
let snapshotId;
let operator; let admin; let keeper; let relayer;
let p1; let p2; let p3; let p4;
let funder; let funder2;
let extra;

const start = (week) => weekStartOf(week);
const close = (week) => weekStartOf(week) + WEEK;
const payoutAt = (week, extension = 0) => close(week) + extension + 24 * HOUR;
const at = (seconds) => setChainTime(provider, seconds);
const nextAt = (seconds) => setChainTime(provider, seconds, { mine: false });
const mined = async (promise) => (await promise).wait();
const chainNow = async () => (await provider.getBlock('latest')).timestamp;

function eventsOf(receipt, name = null) {
  return receipt.logs
    .map((log) => { try { return IFACE.parseLog(log); } catch { return null; } })
    .filter((event) => event && (!name || event.name === name));
}

async function expectRevert(action, reason) {
  let caught = null;
  try {
    await (typeof action === 'function' ? action() : action);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `expected a revert with "${reason}"`);
  assert.equal(caught.reason, reason, `revert reason: ${caught.shortMessage ?? caught.message}`);
  return caught;
}

async function playRun(player, fields = {}) {
  return (await settleLocalRun({ provider, record: suite, player, relayer, verifierKey, ...fields })).sessionId;
}

// A second instance on the same chain with a mock prize token (first week W, like the main instance).
async function mockInstance(name, args = []) {
  const mock = await deployMockToken(name, args, operator);
  const deployed = await deployLocalJackpot({ provider, wallets, record: suite, token: await mock.getAddress(), firstWeek: W, rules: { ...launchRules(suite), adminClearOnly: false } });
  await mined(mock.mint(funder.address, 1_000_000n * TOKEN));
  await mined(mock.mint(funder2.address, 1_000_000n * TOKEN));
  return { instance: deployed.jackpot, mock };
}

async function fund(week, amount, { from = funder, instance = jackpot, prize = token } = {}) {
  await mined(prize.connect(from).approve(await instance.getAddress(), amount));
  return mined(instance.connect(from).fund(week, amount));
}

// Submit and keeper-clear, as the keeper does for a run that passes its screens.
async function listAndClear(ids, instance = jackpot) {
  for (const id of ids) {
    await mined(instance.connect(keeper).submitCandidate(id));
    await mined(instance.connect(keeper).clear(id));
  }
}

// §A.12 / §A.16 #8: balance >= liabilities and liabilities == sum(open pots) + sum(unclaimed) + residual.
async function assertAccounting(instance, prize, lastWeek, label = '') {
  const weeks = [];
  for (let week = W; week <= lastWeek; week += 1) weeks.push(week);
  const rows = await Promise.all(weeks.map(async (week) => [await instance.potOf(week), await instance.weekState(week), week]));
  let open = 0n;
  let unclaimed = 0n;
  for (const [pot, state] of rows) {
    if (Number(state.status) === 0) open += pot.total;
    unclaimed += state.unclaimed;
  }
  const [liabilities, residual, balance] = await Promise.all([instance.liabilities(), instance.residual(), prize.balanceOf(instance.getAddress())]);
  assert.equal(liabilities, open + unclaimed + residual, `accounting identity ${label}`);
  assert.ok(balance >= liabilities, `balance ${balance} >= liabilities ${liabilities} ${label}`);
  return { liabilities, residual, balance, open, unclaimed, rows };
}

before(async () => {
  chain = await startLocalChain();
  provider = fastLocalProvider(chain);
  wallets = reconnectWallets(chain.wallets, provider);
  await at(weekStartOf(weekIndexOf(await chain.latestTimestamp()) + 1) + DAY);
  suite = await deployLocalSuite({ provider, wallets });
  await activateLocalGames({ provider, record: suite, developer: wallets.developer, operator: wallets.operator });
  const deployed = await deployLocalJackpot({ provider, wallets, record: suite, rules: { ...launchRules(suite), adminClearOnly: false } });
  ({ jackpot, token } = deployed);
  W = deployed.record.instances.chikun.firstWeek;
  operator = wallets.operator;
  admin = wallets.developer;
  relayer = wallets.relayer;
  keeper = deployed.wallets.keeper;
  p1 = wallets.player1;
  p2 = wallets.player2;
  p3 = deployed.wallets.player3;
  p4 = wallets.attacker;
  funder = await derivedFixtureWallet(provider, 20);
  funder2 = await derivedFixtureWallet(provider, 21);
  extra = [];
  for (let index = 10; index < 16; index += 1) extra.push(await derivedFixtureWallet(provider, index));
  await mined(token.connect(operator).mint(funder.address, 1_000_000n * TOKEN));
  await mined(token.connect(operator).mint(funder2.address, 1_000_000n * TOKEN));
});

beforeEach(async () => {
  snapshotId = await chain.snapshot();
});

afterEach(async () => {
  await chain.revert(snapshotId);
});

after(async () => {
  await chain?.close();
});

test('a funded week pays the cleared leader at the payout time and not before', async () => {
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  const b = await playRun(p2, { score: 800n });
  await fund(W, 1_000n * TOKEN);
  await at(close(W) + 2 * HOUR);
  await listAndClear([a, b]);
  assert.equal(Number((await jackpot.weekBounds(W)).payoutAt), payoutAt(W));
  await nextAt(payoutAt(W) - 1);
  await expectRevert(jackpot.connect(p4).finalize(W), 'PAYOUT_NOT_DUE');
  const before = await token.balanceOf(p1.address);
  await nextAt(payoutAt(W));
  const receipt = await mined(jackpot.connect(p4).finalize(W));
  const [finalized] = eventsOf(receipt, 'Finalized');
  assert.deepEqual([Number(finalized.args.week), finalized.args.winner, finalized.args.sessionId, finalized.args.score, finalized.args.prize], [W, p1.address, a, 900n, 1_000n * TOKEN]);
  assert.deepEqual(eventsOf(receipt, 'PrizeTransferFailed'), []);
  assert.equal(await token.balanceOf(p1.address), before + 1_000n * TOKEN);
  const state = await jackpot.weekState(W);
  assert.deepEqual([Number(state.status), state.winner, state.winningSession, state.prize, state.unclaimed, Number(state.finalizedAt)], [1, p1.address, a, 1_000n * TOKEN, 0n, payoutAt(W)]);
  assert.equal(await jackpot.liabilities(), 0n);
  await expectRevert(jackpot.connect(p4).finalize(W), 'WEEK_SETTLED');
  await expectRevert(jackpot.connect(p4).finalize(W - 1), 'BAD_WEEK');
  await assertAccounting(jackpot, token, W + 2);
});

test('finalize refuses an uncleared leader and never skips to a lower candidate', async () => {
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  const b = await playRun(p2, { score: 800n });
  await fund(W, 500n * TOKEN);
  await at(close(W) + 2 * HOUR);
  await mined(jackpot.connect(keeper).submitCandidate(a));
  await listAndClear([b]);
  await at(payoutAt(W));
  await expectRevert(jackpot.connect(p4).finalize(W), 'LEADER_NOT_CLEARED');
  await mined(jackpot.connect(keeper).flag(a, b32('screen-hold')));
  await expectRevert(jackpot.connect(p4).finalize(W), 'LEADER_NOT_CLEARED');
  await expectRevert(jackpot.connect(keeper).clear(a), 'REVIEW_LOCKED');
  assert.deepEqual([(await jackpot.leaderOf(W)).sessionId, Number((await jackpot.leaderOf(W)).review)], [a, 2]);
  await mined(jackpot.connect(admin).clear(a));
  const receipt = await mined(jackpot.connect(p4).finalize(W));
  const [finalized] = eventsOf(receipt, 'Finalized');
  assert.deepEqual([finalized.args.winner, finalized.args.sessionId], [p1.address, a], 'the higher run, never the cleared #2');
});

test('a week with no eligible candidate rolls into the current week', async () => {
  const blockedRun = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  await fund(W, 300n * TOKEN);
  await at(close(W) + 2 * HOUR);
  await listAndClear([blockedRun]);
  await mined(jackpot.connect(admin).setBlocked(p1.address, true, b32('cheating')));
  await at(payoutAt(W));
  const receipt = await mined(jackpot.connect(p4).finalize(W));
  assert.deepEqual(eventsOf(receipt).map((event) => event.name), ['CandidateSkipped', 'Finalized', 'RolledOver']);
  const [rolled] = eventsOf(receipt, 'RolledOver');
  assert.deepEqual([Number(rolled.args.fromWeek), Number(rolled.args.toWeek), rolled.args.amount], [W, W + 1, 300n * TOKEN]);
  const [finalized] = eventsOf(receipt, 'Finalized');
  assert.deepEqual([finalized.args.winner, finalized.args.prize], [ethers.ZeroAddress, 0n]);
  assert.equal(Number((await jackpot.weekState(W)).status), 2);
  const pot = await jackpot.potOf(W + 1);
  assert.deepEqual([pot.funded, pot.carriedIn, pot.total], [0n, 300n * TOKEN, 300n * TOKEN]);
  await assertAccounting(jackpot, token, W + 2, 'after rollover');
  // Next week pays its own funding plus the carried pot.
  const winner = await playRun(p2, { score: 100n });
  await fund(W + 1, 200n * TOKEN);
  await at(close(W + 1) + 2 * HOUR);
  await listAndClear([winner]);
  await at(payoutAt(W + 1));
  const paid = await mined(jackpot.connect(p4).finalize(W + 1));
  assert.equal(eventsOf(paid, 'Finalized')[0].args.prize, 500n * TOKEN);
  // A funded week with no candidate at all rolls too.
  await fund(W + 2, 100n * TOKEN);
  await at(payoutAt(W + 2));
  const empty = await mined(jackpot.connect(p4).finalize(W + 2));
  assert.deepEqual(eventsOf(empty).map((event) => event.name), ['Finalized', 'RolledOver']);
  await assertAccounting(jackpot, token, W + 4, 'at the end');
});

test('a zero pot records no winner', async () => {
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  const flaggedLeader = await playRun(p2, { score: 900n, openAt: start(W + 1) + HOUR });
  await at(close(W) + 2 * HOUR);
  await listAndClear([a]);
  await at(payoutAt(W));
  // leaderOf still names the cleared top row of an unfunded week: it is not the week's champion (design J13).
  const leader = await jackpot.leaderOf(W);
  assert.deepEqual([leader.sessionId, Number(leader.review), (await jackpot.potOf(W)).total], [a, 1, 0n]);
  const receipt = await mined(jackpot.connect(p4).finalize(W));
  assert.deepEqual(eventsOf(receipt).map((event) => event.name), ['Finalized']);
  const [finalized] = eventsOf(receipt, 'Finalized');
  assert.deepEqual([finalized.args.winner, finalized.args.sessionId, finalized.args.score, finalized.args.prize], [ethers.ZeroAddress, ethers.ZeroHash, 0n, 0n]);
  const state = await jackpot.weekState(W);
  assert.deepEqual([Number(state.status), state.winner, state.winningSession, state.prize], [2, ethers.ZeroAddress, ethers.ZeroHash, 0n]);
  // Even an uncleared leader cannot hold up an unfunded week, and it is never recorded as a champion.
  await at(close(W + 1) + 2 * HOUR);
  await mined(jackpot.connect(keeper).submitCandidate(flaggedLeader));
  await mined(jackpot.connect(keeper).flag(flaggedLeader, b32('screen-hold')));
  await at(payoutAt(W + 1));
  const second = await mined(jackpot.connect(p4).finalize(W + 1));
  assert.equal(eventsOf(second, 'Finalized')[0].args.winner, ethers.ZeroAddress);
  assert.equal((await jackpot.weekState(W + 1)).winner, ethers.ZeroAddress);
});

test('the prize cap pays the cap and carries the excess forward', async () => {
  await at(start(W) + HOUR);
  await mined(jackpot.connect(operator).scheduleRules({ ...launchRules(suite), adminClearOnly: false, fromWeek: W + 1, maxPrizeWei: 500n * TOKEN }));
  await fund(W + 1, 800n * TOKEN);
  const a = await playRun(p1, { score: 900n, openAt: start(W + 1) + HOUR });
  await at(close(W + 1) + 2 * HOUR);
  await listAndClear([a]);
  await at(payoutAt(W + 1));
  const before = await token.balanceOf(p1.address);
  const receipt = await mined(jackpot.connect(p4).finalize(W + 1));
  assert.deepEqual(eventsOf(receipt).map((event) => event.name), ['CapExcessCarried', 'Finalized']);
  const [excess] = eventsOf(receipt, 'CapExcessCarried');
  assert.deepEqual([Number(excess.args.fromWeek), Number(excess.args.toWeek), excess.args.amount], [W + 1, W + 2, 300n * TOKEN]);
  assert.equal(eventsOf(receipt, 'Finalized')[0].args.prize, 500n * TOKEN);
  assert.equal(await token.balanceOf(p1.address), before + 500n * TOKEN);
  assert.equal((await jackpot.weekState(W + 1)).prize, 500n * TOKEN);
  assert.equal((await jackpot.potOf(W + 2)).carriedIn, 300n * TOKEN);
  assert.equal(await jackpot.liabilities(), 300n * TOKEN);
  await assertAccounting(jackpot, token, W + 3);
});

test("a blacklisted winner's prize becomes claimable to another address", async () => {
  const { instance, mock } = await mockInstance('BlacklistToken');
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  await fund(W, 1_000n * TOKEN, { instance, prize: mock });
  await at(close(W) + 2 * HOUR);
  await listAndClear([a], instance);
  await mined(mock.setBlacklisted(p1.address, true));
  await at(payoutAt(W));
  const receipt = await mined(instance.connect(p4).finalize(W));
  assert.deepEqual(eventsOf(receipt).map((event) => event.name), ['Finalized', 'PrizeTransferFailed']);
  const [failed] = eventsOf(receipt, 'PrizeTransferFailed');
  assert.deepEqual([Number(failed.args.week), failed.args.winner, failed.args.amount], [W, p1.address, 1_000n * TOKEN]);
  const state = await instance.weekState(W);
  assert.deepEqual([Number(state.status), state.winner, state.prize, state.unclaimed], [1, p1.address, 1_000n * TOKEN, 1_000n * TOKEN]);
  assert.equal(await instance.liabilities(), 1_000n * TOKEN, 'a claim-pending prize stays owed');
  await assertAccounting(instance, mock, W + 1, 'claim-pending');
  await expectRevert(instance.connect(p2).claim(W, p2.address), 'ONLY_WINNER');
  await expectRevert(instance.connect(p1).claim(W, ethers.ZeroAddress), 'ZERO_ADDRESS');
  await expectRevert(instance.connect(p1).claim(W, p1.address), 'BLACKLISTED');
  const claimed = await mined(instance.connect(p1).claim(W, p3.address));
  const [event] = eventsOf(claimed, 'PrizeClaimed');
  assert.deepEqual([Number(event.args.week), event.args.winner, event.args.to, event.args.amount], [W, p1.address, p3.address, 1_000n * TOKEN]);
  assert.equal(await mock.balanceOf(p3.address), 1_000n * TOKEN);
  assert.equal((await instance.weekState(W)).unclaimed, 0n);
  assert.equal(await instance.liabilities(), 0n);
  await expectRevert(instance.connect(p1).claim(W, p3.address), 'NOTHING_TO_CLAIM');
});

test('a max-transaction token leaves the prize claim-pending until the transfer is allowed', async () => {
  const { instance, mock } = await mockInstance('MaxTxToken', [600n * TOKEN]);
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  await fund(W, 500n * TOKEN, { instance, prize: mock });
  await fund(W, 500n * TOKEN, { instance, prize: mock, from: funder2 });
  await mined(instance.connect(operator).scheduleRules({ ...launchRules(suite), adminClearOnly: false, fromWeek: W + 1, maxPrizeWei: 600n * TOKEN }));
  await fund(W + 1, 500n * TOKEN, { instance, prize: mock });
  await fund(W + 1, 500n * TOKEN, { instance, prize: mock, from: funder2 });
  await at(close(W) + 2 * HOUR);
  await listAndClear([a], instance);
  await at(payoutAt(W));
  const receipt = await mined(instance.connect(p4).finalize(W));
  assert.equal(eventsOf(receipt, 'PrizeTransferFailed').length, 1, 'a 1,000 prize is above the 600 max transaction');
  await expectRevert(instance.connect(p1).claim(W, p1.address), 'MAX_TX');
  await expectRevert(instance.connect(p1).claim(W, p2.address), 'MAX_TX');
  // The token owner exempts the jackpot (checklist item 5); the claim then goes through.
  await mined(mock.setExempt(await instance.getAddress(), true));
  await mined(instance.connect(p1).claim(W, p1.address));
  assert.equal(await mock.balanceOf(p1.address), 1_000n * TOKEN);
  await mined(mock.setExempt(await instance.getAddress(), false));
  // With a prize cap at the max-transaction amount the payout is direct: W + 1 holds 1,000, pays the 600
  // cap and carries 400 into W + 2.
  const b = await playRun(p2, { score: 800n });
  await at(close(W + 1) + 2 * HOUR);
  await listAndClear([b], instance);
  await at(payoutAt(W + 1));
  const capped = await mined(instance.connect(p4).finalize(W + 1));
  assert.deepEqual(eventsOf(capped, 'PrizeTransferFailed'), []);
  assert.equal(await mock.balanceOf(p2.address), 600n * TOKEN);
  assert.equal((await instance.potOf(W + 2)).carriedIn, 400n * TOKEN);
  await assertAccounting(instance, mock, W + 3);
});

test('unclaimed prizes recycle into the pool after 180 days', async () => {
  const { instance, mock } = await mockInstance('BlacklistToken');
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  await fund(W, 1_000n * TOKEN, { instance, prize: mock });
  await at(close(W) + 2 * HOUR);
  await listAndClear([a], instance);
  await mined(mock.setBlacklisted(p1.address, true));
  await at(payoutAt(W));
  await mined(instance.connect(p4).finalize(W));
  const finalizedAt = Number((await instance.weekState(W)).finalizedAt);
  await expectRevert(instance.connect(p4).recycleUnclaimed(W + 1), 'NOTHING_TO_CLAIM');
  await nextAt(finalizedAt + 180 * DAY - 1);
  await expectRevert(instance.connect(p4).recycleUnclaimed(W), 'TOO_EARLY');
  await nextAt(finalizedAt + 180 * DAY);
  const receipt = await mined(instance.connect(p4).recycleUnclaimed(W));
  const current = weekIndexOf(finalizedAt + 180 * DAY);
  const [event] = eventsOf(receipt, 'UnclaimedRecycled');
  assert.deepEqual([Number(event.args.week), Number(event.args.toWeek), event.args.amount], [W, current, 1_000n * TOKEN]);
  assert.equal((await instance.potOf(current)).carriedIn, 1_000n * TOKEN, 'back into the prize pool, never to staff');
  assert.equal((await instance.weekState(W)).unclaimed, 0n);
  assert.equal(await instance.liabilities(), 1_000n * TOKEN);
  await expectRevert(instance.connect(p1).claim(W, p2.address), 'NOTHING_TO_CLAIM');
  await expectRevert(instance.connect(p4).recycleUnclaimed(W), 'NOTHING_TO_CLAIM');
  await assertAccounting(instance, mock, current + 1);
});

test('pause stops payouts and keeper clears only', async () => {
  const { instance, mock } = await mockInstance('BlacklistToken');
  // Week W ends claim-pending (the winner is blacklisted), so a claim can be tried while paused.
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  await fund(W, 1_000n * TOKEN, { instance, prize: mock });
  await at(close(W) + 2 * HOUR);
  await listAndClear([a], instance);
  await mined(mock.setBlacklisted(p1.address, true));
  await at(payoutAt(W));
  await mined(instance.connect(p4).finalize(W));
  const b = await playRun(p2, { score: 800n });
  const c = await playRun(p3, { score: 700n });
  await mined(instance.connect(admin).pause());
  assert.equal(await instance.paused(), true);
  // Submissions, funding, flags and claims continue.
  await mined(instance.connect(p4).submitCandidate(b));
  await mined(instance.connect(p4).submitCandidate(c));
  await fund(W + 1, 200n * TOKEN, { instance, prize: mock });
  await mined(instance.connect(keeper).flag(c, b32('screen-hold')));
  await mined(instance.connect(p1).claim(W, p4.address));
  // Keeper clears and payouts stop.
  await expectRevert(instance.connect(keeper).clear(b), 'PAUSED');
  await at(payoutAt(W + 1));
  await expectRevert(instance.connect(p4).finalize(W + 1), 'PAUSED');
  await mined(instance.connect(operator).operatorPause());
  await mined(instance.connect(admin).unpause());
  await expectRevert(instance.connect(p4).finalize(W + 1), 'PAUSED');
  await expectRevert(instance.connect(keeper).clear(b), 'PAUSED');
  await mined(instance.connect(admin).clear(b)); // the admin's own clear is not stopped by a pause
  await mined(instance.connect(operator).operatorUnpause());
  const receipt = await mined(instance.connect(p4).finalize(W + 1));
  assert.equal(eventsOf(receipt, 'Finalized')[0].args.winner, p2.address);
});

test('a held week cannot finalize until released', async () => {
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  await fund(W, 300n * TOKEN);
  await at(close(W) + 2 * HOUR);
  await listAndClear([a]);
  const held = await mined(jackpot.connect(admin).holdWeek(W, b32('investigation')));
  const [event] = eventsOf(held, 'WeekHeld');
  assert.deepEqual([Number(event.args.week), ethers.decodeBytes32String(event.args.reason)], [W, 'investigation']);
  assert.equal((await jackpot.weekState(W)).held, true);
  await at(payoutAt(W) + DAY);
  await expectRevert(jackpot.connect(p4).finalize(W), 'WEEK_HELD');
  const released = await mined(jackpot.connect(admin).releaseWeek(W));
  assert.equal(eventsOf(released, 'WeekReleased').length, 1);
  await mined(jackpot.connect(p4).finalize(W));
  await expectRevert(jackpot.connect(admin).holdWeek(W, b32('investigation')), 'WEEK_SETTLED');
});

test('after a scheduled end, funders recover their own later-week funding and residue reaches only the residual recipient after 30 days', async () => {
  await at(start(W) + HOUR);
  await fund(W, 100n * TOKEN);
  await fund(W + 1, 400n * TOKEN);
  await fund(W + 2, 100n * TOKEN);
  await fund(W + 3, 300n * TOKEN);
  await fund(W + 3, 200n * TOKEN, { from: funder2 });
  await mined(jackpot.connect(operator).scheduleEnd(W + 1));
  // While the end can still be cancelled, nothing is refundable.
  await expectRevert(jackpot.connect(funder).refundAfterEnd(W + 3), 'NOT_AFTER_END');
  await at(payoutAt(W));
  await mined(jackpot.connect(p4).finalize(W)); // no candidate: rolls into W + 1 (not after the end)
  assert.equal((await jackpot.potOf(W + 1)).total, 500n * TOKEN);
  const late = await playRun(p1, { score: 900n, openAt: start(W + 2) + HOUR });
  await expectRevert(jackpot.connect(p4).submitCandidate(late), 'AFTER_END');
  await expectRevert(jackpot.connect(funder).fund(W + 2, MIN_FUND), 'FUNDED_AFTER_END');
  await assertAccounting(jackpot, token, W + 8, 'before the final payout');
  // The final week has no winner: its pot becomes residual, available 30 days after the deposit.
  await nextAt(payoutAt(W + 1));
  const receipt = await mined(jackpot.connect(p4).finalize(W + 1));
  const [rolled] = eventsOf(receipt, 'RolledOver');
  assert.deepEqual([Number(rolled.args.toWeek), rolled.args.amount], [0, 500n * TOKEN], 'toWeek 0 = residual');
  assert.equal(await jackpot.residual(), 500n * TOKEN);
  const available = Number(await jackpot.residualAvailableAt());
  assert.equal(available, payoutAt(W + 1) + 30 * DAY);
  await expectRevert(jackpot.connect(p4).finalize(W + 2), 'AFTER_END');
  // Funders take back exactly their own funding of the weeks after the end.
  const before = await token.balanceOf(funder.address);
  const refund = await mined(jackpot.connect(funder).refundAfterEnd(W + 3));
  const [refunded] = eventsOf(refund, 'RefundedAfterEnd');
  assert.deepEqual([Number(refunded.args.week), refunded.args.funder, refunded.args.amount], [W + 3, funder.address, 300n * TOKEN]);
  await mined(jackpot.connect(funder).refundAfterEnd(W + 2));
  await mined(jackpot.connect(funder2).refundAfterEnd(W + 3));
  assert.equal(await token.balanceOf(funder.address), before + 400n * TOKEN);
  await expectRevert(jackpot.connect(funder).refundAfterEnd(W + 3), 'NOTHING_TO_REFUND');
  await expectRevert(jackpot.connect(p4).refundAfterEnd(W + 3), 'NOTHING_TO_REFUND');
  await expectRevert(jackpot.connect(funder).refundAfterEnd(W + 1), 'NOT_AFTER_END');
  assert.equal((await jackpot.potOf(W + 3)).total, 0n);
  await assertAccounting(jackpot, token, W + 8, 'after refunds');
  // The residue goes only to the residual recipient, only after the delay.
  await expectRevert(jackpot.connect(p1).recoverResidual(), 'Only platform operator');
  await nextAt(available - 1);
  await expectRevert(jackpot.connect(operator).recoverResidual(), 'TOO_EARLY');
  const recipient = await jackpot.residualRecipient();
  assert.equal(recipient, admin.address, 'the tCHIKUN instance recipient is the owner wallet (design §H.1)');
  const recipientBefore = await token.balanceOf(recipient);
  await nextAt(available);
  const recovered = await mined(jackpot.connect(operator).recoverResidual());
  const [event] = eventsOf(recovered, 'ResidualRecovered');
  assert.deepEqual([event.args.to, event.args.amount], [recipient, 500n * TOKEN]);
  assert.equal(await token.balanceOf(recipient), recipientBefore + 500n * TOKEN);
  assert.equal(await jackpot.liabilities(), 0n);
  await expectRevert(jackpot.connect(operator).recoverResidual(), 'TOO_EARLY');
  await assertAccounting(jackpot, token, W + 8, 'at the end');
});

test('only the residual recipient can nominate its successor', async () => {
  assert.equal(await jackpot.residualRecipient(), admin.address);
  await expectRevert(jackpot.connect(operator).nominateResidualRecipient(p2.address), 'ONLY_RESIDUAL_RECIPIENT');
  await expectRevert(jackpot.connect(p1).nominateResidualRecipient(p2.address), 'ONLY_RESIDUAL_RECIPIENT');
  await expectRevert(jackpot.connect(admin).nominateResidualRecipient(ethers.ZeroAddress), 'ZERO_ADDRESS');
  const nominated = await mined(jackpot.connect(admin).nominateResidualRecipient(p2.address));
  const [nomination] = eventsOf(nominated, 'ResidualRecipientNominated');
  assert.deepEqual([nomination.args.current, nomination.args.nominee], [admin.address, p2.address]);
  assert.equal(await jackpot.pendingResidualRecipient(), p2.address);
  assert.equal(await jackpot.residualRecipient(), admin.address);
  await expectRevert(jackpot.connect(p3).acceptResidualRecipient(), 'ONLY_RESIDUAL_RECIPIENT');
  await expectRevert(jackpot.connect(operator).acceptResidualRecipient(), 'ONLY_RESIDUAL_RECIPIENT');
  const accepted = await mined(jackpot.connect(p2).acceptResidualRecipient());
  const [change] = eventsOf(accepted, 'ResidualRecipientChanged');
  assert.deepEqual([change.args.previous, change.args.current], [admin.address, p2.address]);
  assert.deepEqual([await jackpot.residualRecipient(), await jackpot.pendingResidualRecipient()], [p2.address, ethers.ZeroAddress]);
  await expectRevert(jackpot.connect(admin).nominateResidualRecipient(admin.address), 'ONLY_RESIDUAL_RECIPIENT');
  // Stray tokens now go to the new recipient.
  await mined(token.connect(funder).transfer(await jackpot.getAddress(), 7n * TOKEN));
  await mined(jackpot.connect(operator).sweepStray(await token.getAddress()));
  assert.equal(await token.balanceOf(p2.address), 7n * TOKEN);
});

test('sweepStray never touches liabilities, even for sender-fee and double-entry tokens', async () => {
  const address = await jackpot.getAddress();
  const tokenAddress = await token.getAddress();
  const senderFee = await mockInstance('SenderFeeToken', [100n]); // 1% charged to the sender
  const double = await mockInstance('DoubleEntryToken');
  await at(start(W) + HOUR);
  await fund(W, 1_000n * TOKEN);
  await mined(token.connect(funder).transfer(address, 50n * TOKEN));
  const recipient = await jackpot.residualRecipient();
  const before = await token.balanceOf(recipient);
  const swept = await mined(jackpot.connect(operator).sweepStray(tokenAddress));
  const [event] = eventsOf(swept, 'StraySwept');
  assert.deepEqual([event.args.token, event.args.amount], [tokenAddress, 50n * TOKEN]);
  assert.equal(await token.balanceOf(recipient), before + 50n * TOKEN);
  assert.equal(await token.balanceOf(address), 1_000n * TOKEN);
  assert.equal(await jackpot.liabilities(), 1_000n * TOKEN);
  const nothing = await mined(jackpot.connect(operator).sweepStray(tokenAddress));
  assert.equal(eventsOf(nothing, 'StraySwept')[0].args.amount, 0n, 'liabilities are never swept');
  // Any other token is stray in full.
  const other = await deployMockToken('BlacklistToken', [], operator);
  await mined(other.mint(address, 33n));
  await mined(jackpot.connect(operator).sweepStray(await other.getAddress()));
  assert.equal(await other.balanceOf(recipient), 33n);
  await expectRevert(jackpot.connect(operator).sweepStray(ethers.ZeroAddress), 'ZERO_ADDRESS');
  // A token that charges the sender extra: sweeping the excess would dip below liabilities.
  await fund(W, 1_000n * TOKEN, { instance: senderFee.instance, prize: senderFee.mock });
  await mined(senderFee.mock.connect(funder).transfer(await senderFee.instance.getAddress(), 50n * TOKEN));
  await expectRevert(senderFee.instance.connect(operator).sweepStray(await senderFee.mock.getAddress()), 'LIABILITIES_BREACHED');
  // A second entry point moves the same balance: sweeping it as "another token" would drain the prize.
  await fund(W, 1_000n * TOKEN, { instance: double.instance, prize: double.mock });
  const secondary = await double.mock.secondary();
  await expectRevert(double.instance.connect(operator).sweepStray(secondary), 'LIABILITIES_BREACHED');
  await mined(double.instance.connect(operator).sweepStray(await double.mock.getAddress()));
  assert.equal(await double.mock.balanceOf(await double.instance.getAddress()), 1_000n * TOKEN);
  await assertAccounting(double.instance, double.mock, W + 1);
});

test('a reentrant token cannot re-enter fund, finalize or claim', async () => {
  const { instance, mock } = await mockInstance('ReentrantToken');
  const address = await instance.getAddress();
  const expectBlocked = async (label) => {
    assert.equal(await mock.lastHookOk(), false, `${label}: the re-entry was refused`);
    assert.equal(await mock.lastHookReturn(), REENTRANT_CALL, `${label}: by ReentrancyGuardReentrantCall()`);
  };
  // fund -> token.transferFrom -> hook -> fund again.
  await mined(mock.connect(funder).approve(address, 10_000n * TOKEN));
  await mined(mock.arm(address, IFACE.encodeFunctionData('fund', [W, MIN_FUND])));
  await mined(instance.connect(funder).fund(W, 1_000n * TOKEN));
  assert.equal(await mock.hookCalls(), 1n);
  await expectBlocked('fund');
  assert.equal((await instance.potOf(W)).funded, 1_000n * TOKEN, 'funded once');
  // finalize -> prize transfer -> hook -> finalize again.
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  await at(close(W) + 2 * HOUR);
  await listAndClear([a], instance);
  await mined(mock.arm(address, IFACE.encodeFunctionData('finalize', [W])));
  await at(payoutAt(W));
  await mined(instance.connect(p4).finalize(W));
  await expectBlocked('finalize');
  assert.equal(await mock.balanceOf(p1.address), 1_000n * TOKEN, 'paid once');
  // claim -> transfer -> hook -> claim again (a claim-pending prize: transfers to p2 are refused).
  await fund(W + 1, 500n * TOKEN, { instance, prize: mock });
  const b = await playRun(p2, { score: 800n });
  await at(close(W + 1) + 2 * HOUR);
  await listAndClear([b], instance);
  await mined(mock.setFailTransfersTo(p2.address, true));
  await at(payoutAt(W + 1));
  const receipt = await mined(instance.connect(p4).finalize(W + 1));
  assert.equal(eventsOf(receipt, 'PrizeTransferFailed').length, 1);
  await mined(mock.arm(address, IFACE.encodeFunctionData('claim', [W + 1, p4.address])));
  await mined(instance.connect(p2).claim(W + 1, p3.address));
  await expectBlocked('claim');
  assert.equal(await mock.balanceOf(p3.address), 500n * TOKEN, 'claimed once');
  assert.equal(await mock.balanceOf(p4.address), 0n);
  await assertAccounting(instance, mock, W + 3);
});

test('recoverResidual keeps the balance at or above liabilities, even for a sender-fee token', async () => {
  const { instance, mock } = await mockInstance('SenderFeeToken', [100n]); // 1% charged to the sender
  const address = await instance.getAddress();
  await fund(W, 1_000n * TOKEN, { instance, prize: mock });
  await fund(W + 1, 200n * TOKEN, { instance, prize: mock, from: funder2 }); // after the end below: still owed to funder2
  await mined(instance.connect(operator).scheduleEnd(W));
  await at(payoutAt(W));
  const rolled = await mined(instance.connect(p4).finalize(W)); // no candidate: the final pot becomes the residue
  assert.equal(Number(eventsOf(rolled, 'RolledOver')[0].args.toWeek), 0);
  assert.deepEqual([await instance.residual(), await instance.liabilities(), await mock.balanceOf(address)], [1_000n * TOKEN, 1_200n * TOKEN, 1_200n * TOKEN]);
  await at(Number(await instance.residualAvailableAt()));
  // Sending the 1,000 residue costs the jackpot 1,010, which would leave 190 against the 200 funder2 is owed.
  await expectRevert(instance.connect(operator).recoverResidual(), 'LIABILITIES_BREACHED');
  assert.equal(await instance.residual(), 1_000n * TOKEN, 'nothing moved');
  await assertAccounting(instance, mock, W + 2, 'after the refused recovery');
  // Once stray tokens cover the fee, the residue goes out and the post-condition holds exactly.
  await mined(mock.connect(funder).transfer(address, 10n * TOKEN));
  await mined(instance.connect(operator).recoverResidual());
  assert.deepEqual([await instance.residual(), await instance.liabilities(), await mock.balanceOf(address)], [0n, 200n * TOKEN, 200n * TOKEN]);
  await assertAccounting(instance, mock, W + 2, 'after the recovery');
});

test('a reentrant token cannot re-enter refundAfterEnd, a prize-transfer callback sees the prize paid, and all nine guards are in place', async () => {
  const { instance, mock } = await mockInstance('ReentrantToken');
  const address = await instance.getAddress();
  await fund(W, 500n * TOKEN, { instance, prize: mock });
  await fund(W + 1, 300n * TOKEN, { instance, prize: mock });
  await mined(instance.connect(operator).scheduleEnd(W));
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  await at(close(W) + 2 * HOUR);
  await listAndClear([a], instance);
  // Checks-effects-interactions (design §A.12): during the prize transfer the prize is already booked as paid,
  // so a token callback reads liabilities that the balance covers (300 still owed for W + 1, not 800).
  await mined(mock.arm(address, IFACE.encodeFunctionData('liabilities')));
  await at(payoutAt(W));
  await mined(instance.connect(p4).finalize(W));
  assert.equal(await mock.lastHookOk(), true);
  const [during] = IFACE.decodeFunctionResult('liabilities', await mock.lastHookReturn());
  assert.equal(during, 300n * TOKEN);
  assert.equal(await mock.balanceOf(p1.address), 500n * TOKEN);
  // refundAfterEnd -> transfer -> hook -> refundAfterEnd again: refused by the guard.
  await mined(mock.arm(address, IFACE.encodeFunctionData('refundAfterEnd', [W + 1])));
  await mined(instance.connect(funder).refundAfterEnd(W + 1));
  assert.equal(await mock.hookCalls(), 2n);
  assert.equal(await mock.lastHookOk(), false);
  assert.equal(await mock.lastHookReturn(), REENTRANT_CALL);
  assert.equal(await instance.liabilities(), 0n);
  await assertAccounting(instance, mock, W + 2);
  // The operator-only and token-free guarded functions cannot be re-entered by a token at all, so the source
  // check (npm run contracts:check) pins nonReentrant on each of the nine functions of design §A.12.
  const source = readFileSync(new URL('../contracts/src/WeeklyJackpot.sol', import.meta.url), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(jackpotReentrancyProblems(source), []);
  assert.equal(JACKPOT_NON_REENTRANT.length, 9);
  for (const name of JACKPOT_NON_REENTRANT) {
    const dropped = source.replace(new RegExp(`(function ${name}\\([^)]*\\)[^{]*?)\\s+nonReentrant`), '$1');
    assert.notEqual(dropped, source, name);
    assert.deepEqual(jackpotReentrancyProblems(dropped), [`function ${name} must be external nonReentrant (design §A.12)`]);
  }
});

// JACKPOT_RANDOM_SEEDS=1,2,3 JACKPOT_RANDOM_VERBOSE=1 explores other seeds (and prints what each run reached).
const RANDOM_SEEDS = process.env.JACKPOT_RANDOM_SEEDS ? process.env.JACKPOT_RANDOM_SEEDS.split(',').map(Number) : [0x5eed1e5, 0x0c0ffee];
const RANDOM_STEPS = Number(process.env.JACKPOT_RANDOM_STEPS ?? 120);

test('randomized sequences keep balance at or above liabilities and the accounting identity exact', async () => {
  // Seeded runs from the same starting state. They are reproducible: the choices come from the seed, session ids
  // are derived from it, and chain time moves only through setChainTime plus one second per mined block. The
  // identity is checked after every step, and each run must pass through every accounting transition (below).
  for (const seed of RANDOM_SEEDS) {
    const runSnapshot = await chain.snapshot();
    await randomRun(seed, RANDOM_STEPS);
    await chain.revert(runSnapshot);
  }
});

async function randomRun(initialSeed, steps) {
  const { instance, mock } = await mockInstance('BlacklistToken');
  const address = await instance.getAddress();
  const players = [p1, p2, p3, p4, ...extra.slice(0, 4)];
  const funders = [funder, funder2];
  for (const wallet of funders) await mined(mock.connect(wallet).approve(address, 2n ** 255n));
  let seed = initialSeed;
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (items) => items[Math.floor(random() * items.length)];
  // Every accounting transition a receipt shows (design §A.6, §A.9, §A.10).
  const outcomes = { paid: 0, claimPending: 0, claimed: 0, rolledOver: 0, capExcess: 0, recycled: 0, refunded: 0, recovered: 0 };
  const note = (receipt) => {
    const events = eventsOf(receipt);
    const failed = events.some((event) => event.name === 'PrizeTransferFailed');
    for (const event of events) {
      if (event.name === 'Finalized' && event.args.winner !== ethers.ZeroAddress && !failed) outcomes.paid += 1;
      else if (event.name === 'PrizeTransferFailed') outcomes.claimPending += 1;
      else if (event.name === 'PrizeClaimed') outcomes.claimed += 1;
      else if (event.name === 'RolledOver' && event.args.amount > 0n) outcomes.rolledOver += 1;
      else if (event.name === 'CapExcessCarried') outcomes.capExcess += 1;
      else if (event.name === 'UnclaimedRecycled') outcomes.recycled += 1;
      else if (event.name === 'RefundedAfterEnd') outcomes.refunded += 1;
      else if (event.name === 'ResidualRecovered') outcomes.recovered += 1;
    }
    return receipt;
  };
  const tryTx = async (promise) => { try { return note(await mined(promise)); } catch { return null; } };
  const counts = {}; // successful actions only
  const done = (action, ok = true) => { if (ok) counts[action] = (counts[action] ?? 0) + 1; };
  const openDueWeeks = async (now) => {
    const due = [];
    for (let week = W; payoutAt(week) <= now; week += 1) {
      if (Number((await instance.weekState(week)).status) === 0) due.push(week);
    }
    return due;
  };
  await at(start(W) + HOUR);
  // A prize cap from W + 1 on: a pot above it pays the cap and carries the excess into the current week.
  await mined(instance.connect(operator).scheduleRules({ ...launchRules(suite), adminClearOnly: false, fromWeek: W + 1, maxPrizeWei: 400n * TOKEN }));
  const openPots = new Map(); // week -> last seen open total (an open week's pot never decreases)
  const finalizedWeeks = new Set();
  let lastWeek = W + 1;
  for (let step = 0; step < steps; step += 1) {
    const now = await chainNow();
    const current = weekIndexOf(now);
    lastWeek = Math.max(lastWeek, current + 4);
    const roll = random();
    let action;
    if (roll < 0.14) {
      action = 'fund';
      const week = current + Math.floor(random() * 3);
      done(action, await tryTx(instance.connect(pick(funders)).fund(week, MIN_FUND + BigInt(Math.floor(random() * 500)) * TOKEN)));
    } else if (roll < 0.17) {
      action = 'stray';
      await mined(mock.connect(pick(funders)).transfer(address, BigInt(1 + Math.floor(random() * 9)) * TOKEN));
      done(action);
    } else if (roll < 0.39) {
      action = 'play';
      const player = pick(players);
      if (!(await mock.blacklisted(player.address))) {
        const id = await playRun(player, { sessionId: ethers.id(`random-${initialSeed}-${step}`), score: BigInt(1 + Math.floor(random() * 10_000)) });
        done(action);
        const [ok] = await instance.checkEligibility(id);
        if (ok) done('submit', await tryTx(instance.connect(pick([keeper, p4, player])).submitCandidate(id)));
      }
    } else if (roll < 0.53) {
      action = 'review';
      const rows = await instance.candidatesOf(pick([current, current - 1]));
      if (rows.length) {
        const row = pick(rows);
        const choice = random();
        if (choice < 0.5) done(action, await tryTx(instance.connect(keeper).clear(row.sessionId)));
        else if (choice < 0.65) done(action, await tryTx(instance.connect(keeper).flag(row.sessionId, b32('screen-hold'))));
        else if (choice < 0.85) done(action, await tryTx(instance.connect(admin).clear(row.sessionId)));
        else done(action, await tryTx(instance.connect(admin).disqualify(row.sessionId, random() < 0.5, b32('other'))));
      }
    } else if (roll < 0.58) {
      // The token freezes the leader of a due week (its payout then fails), or toggles a random wallet.
      action = 'blacklist';
      const due = await openDueWeeks(now);
      const leader = due.length && random() < 0.6 ? (await instance.leaderOf(pick(due))).player : ethers.ZeroAddress;
      if (leader !== ethers.ZeroAddress) await mined(mock.setBlacklisted(leader, true));
      else {
        const player = pick(players);
        await mined(mock.setBlacklisted(player.address, !(await mock.blacklisted(player.address))));
      }
      done(action);
    } else if (roll < 0.78) {
      // Time: often straight past the next payout time, so weeks close and pay within the run.
      action = 'time';
      const nextPayout = payoutAt(current - 1) > now ? payoutAt(current - 1) : payoutAt(current);
      await at(random() < 0.35 ? nextPayout + Math.floor(random() * 6 * HOUR) : now + 3 * HOUR + Math.floor(random() * 33 * HOUR));
      done(action);
    } else if (roll < 0.9) {
      // Payouts: the admin decides an uncleared leader (clear, or disqualify so the next row leads); sometimes the
      // token freezes a cleared winner first, so the prize is left claim-pending.
      action = 'finalize';
      for (const week of await openDueWeeks(now)) {
        const leader = await instance.leaderOf(week);
        if (leader.sessionId !== ethers.ZeroHash && Number(leader.review) !== 1) {
          await tryTx(random() < 0.7 ? instance.connect(admin).clear(leader.sessionId) : instance.connect(admin).disqualify(leader.sessionId, false, b32('other')));
        }
        const payee = await instance.leaderOf(week);
        if (payee.sessionId !== ethers.ZeroHash && Number(payee.review) === 1 && random() < 0.35) await mined(mock.setBlacklisted(payee.player, true));
        if (await tryTx(instance.connect(p4).finalize(week))) {
          assert.equal(finalizedWeeks.has(week), false, 'a week finalizes once');
          finalizedWeeks.add(week);
          done(action);
        }
      }
    } else if (roll < 0.96) {
      action = 'claim';
      for (let week = W; week < current; week += 1) {
        const state = await instance.weekState(week);
        if (state.unclaimed === 0n) continue;
        const winner = players.find((player) => player.address === state.winner);
        const to = pick(players);
        if (winner && !(await mock.blacklisted(to.address))) done(action, await tryTx(instance.connect(winner).claim(week, to.address)));
      }
    } else {
      action = 'sweep';
      note(await mined(instance.connect(operator).sweepStray(await mock.getAddress())));
      done(action);
    }
    if (step === steps - 20) {
      // The end, announced while a funder has already paid into a week after it (design §A.10: refundable).
      const endWeek = weekIndexOf(await chainNow()) + 1;
      note(await mined(instance.connect(funder2).fund(endWeek + 1, MIN_FUND)));
      await mined(instance.connect(operator).scheduleEnd(endWeek));
      done('scheduleEnd');
    }
    const { rows } = await assertAccounting(instance, mock, lastWeek, `after step ${step} (${action}, seed ${initialSeed})`);
    const end = Number(await instance.endAfterWeek());
    for (const [pot, state, week] of rows) {
      if (Number(state.status) !== 0 || (end !== 0 && week > end)) continue;
      assert.ok(pot.total >= (openPots.get(week) ?? 0n), `open week ${week}'s pot never decreases`);
      openPots.set(week, pot.total);
    }
  }
  const randomPhase = { ...outcomes };
  // Wind-down, past the end: the admin clears every open week's leader so winners are paid (or left
  // claim-pending by a frozen wallet); every claim-pending prize is claimed except the last, which recycles into
  // the residue after 180 days; funders refund their later-week funding; the residue is recovered.
  const end = Number(await instance.endAfterWeek());
  const later = async (seconds) => at(Math.max(seconds, (await chainNow()) + 1));
  await later(payoutAt(end) + HOUR);
  for (let week = W; week <= end; week += 1) {
    if (Number((await instance.weekState(week)).status) !== 0) continue;
    const leader = await instance.leaderOf(week);
    if (leader.sessionId !== ethers.ZeroHash && Number(leader.review) !== 1) await mined(instance.connect(admin).clear(leader.sessionId));
    note(await mined(instance.connect(p4).finalize(week)));
    await assertAccounting(instance, mock, lastWeek, `wind-down finalize ${week}`);
  }
  const pending = [];
  for (let week = W; week <= end; week += 1) if ((await instance.weekState(week)).unclaimed > 0n) pending.push(week);
  // The last claim-pending prize recycles instead, unless no prize was claimed yet.
  const recycle = pending.length > 1 || (pending.length === 1 && outcomes.claimed > 0) ? pending.at(-1) : null;
  for (const week of pending.filter((entry) => entry !== recycle)) {
    const { winner: winnerAddress } = await instance.weekState(week);
    const winner = players.find((player) => player.address === winnerAddress);
    note(await mined(instance.connect(winner).claim(week, funder.address)));
    await assertAccounting(instance, mock, lastWeek, `wind-down claim ${week}`);
  }
  if (recycle !== null) {
    const week = recycle;
    await later(Number((await instance.weekState(week)).finalizedAt) + 180 * DAY);
    note(await mined(instance.connect(p4).recycleUnclaimed(week)));
    await assertAccounting(instance, mock, lastWeek, `wind-down recycle ${week}`);
  }
  for (let week = end + 1; week <= lastWeek; week += 1) {
    for (const wallet of funders) {
      if ((await instance.fundedBy(week, wallet.address)) > 0n) note(await mined(instance.connect(wallet).refundAfterEnd(week)));
    }
  }
  if ((await instance.residual()) > 0n) {
    const availableAt = Number(await instance.residualAvailableAt());
    if (availableAt > (await chainNow())) await nextAt(availableAt);
    note(await mined(instance.connect(operator).recoverResidual()));
  }
  const final = await assertAccounting(instance, mock, lastWeek, 'after the wind-down');
  assert.equal(final.open, 0n, 'every open pot was paid, rolled into the residue or refunded');
  assert.deepEqual([final.residual, final.unclaimed, final.liabilities], [0n, 0n, 0n], 'nothing is owed at the end');
  const label = `seed ${initialSeed}: random phase ${JSON.stringify(randomPhase)}, total ${JSON.stringify(outcomes)}, successful actions ${JSON.stringify(counts)}`;
  if (process.env.JACKPOT_RANDOM_VERBOSE) console.log(label);
  // The random phase itself pays a winner directly, leaves a prize claim-pending, carries cap excess and rolls a
  // pot over; over the whole run a claim-pending prize is claimed, later-week funding is refunded and the residue
  // is recovered. (Not every seed reaches all of them: a new seed must be checked with JACKPOT_RANDOM_VERBOSE=1.)
  assert.ok(randomPhase.paid >= 1 && randomPhase.claimPending >= 1 && randomPhase.capExcess >= 1 && randomPhase.rolledOver >= 1, label);
  assert.ok(outcomes.claimed >= 1 && outcomes.refunded >= 1 && outcomes.recovered >= 1, label);
  assert.ok(counts.finalize >= 3 && counts.fund >= 5 && counts.submit >= 5, label);
}

test('native zkLTC is refused', async () => {
  const address = await jackpot.getAddress();
  let plainTransfer = null;
  try { await operator.sendTransaction({ to: address, value: 1n }); } catch (error) { plainTransfer = error; }
  assert.ok(plainTransfer, 'a plain zkLTC transfer reverts (no receive or fallback)');
  let payableCall = null;
  const data = IFACE.encodeFunctionData('fund', [W, MIN_FUND]);
  try { await funder.sendTransaction({ to: address, data, value: 1n }); } catch (error) { payableCall = error; }
  assert.ok(payableCall, 'no function is payable');
  assert.equal(await provider.getBalance(address), 0n);
  const abi = loadArtifact('WeeklyJackpot').abi;
  assert.equal(abi.some((entry) => entry.type === 'receive' || entry.type === 'fallback'), false);
  assert.equal(abi.some((entry) => entry.stateMutability === 'payable'), false);
});

// ---------------------------------------------------------------------------------------------------------
// Opcode audit (design §A.1): LitVM osaka support is UNVERIFIED, so the new bytecode must stay in Cancun.
// ---------------------------------------------------------------------------------------------------------

const CANCUN_OPCODES = new Set([
  ...range(0x00, 0x0b), ...range(0x10, 0x1d), 0x20, ...range(0x30, 0x3f), ...range(0x40, 0x4a),
  ...range(0x50, 0x5f), ...range(0x60, 0x7f), ...range(0x80, 0x8f), ...range(0x90, 0x9f), ...range(0xa0, 0xa4),
  ...range(0xf0, 0xf5), 0xfa, 0xfd, 0xfe, 0xff,
]);
const TERMINATORS = new Set([0x00, 0x56, 0xf3, 0xfd, 0xfe, 0xff]);

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

// Linear sweep over code positions: PUSH data is skipped, and after a terminating opcode the bytes up to
// the next JUMPDEST are unreachable (data) and not decoded. Returns every non-Cancun opcode found.
function auditCode(bytes) {
  const violations = [];
  let inCode = true;
  for (let pc = 0; pc < bytes.length; pc += 1) {
    const op = bytes[pc];
    if (!inCode) {
      if (op !== 0x5b) continue;
      inCode = true;
    }
    if (!CANCUN_OPCODES.has(op)) violations.push({ pc, op: `0x${op.toString(16).padStart(2, '0')}` });
    if (op >= 0x60 && op <= 0x7f) pc += op - 0x5f;
    else if (TERMINATORS.has(op)) inCode = false;
  }
  return violations;
}

// Splits an artifact into its constructor code (before the INVALID that precedes the embedded runtime) and
// its runtime code without the trailing CBOR metadata (the last two bytes give the metadata length).
function codeSections(name) {
  const artifact = JSON.parse(readFileSync(new URL(`../contracts/artifacts/${name}.json`, import.meta.url), 'utf8'));
  const creation = Buffer.from(artifact.evm.bytecode.object, 'hex');
  const runtime = Buffer.from(artifact.evm.deployedBytecode.object, 'hex');
  const metadataLength = runtime.readUInt16BE(runtime.length - 2) + 2;
  const runtimeAt = creation.indexOf(runtime.subarray(0, 64));
  assert.ok(runtimeAt > 0, `${name}: the runtime is embedded in the creation code`);
  assert.equal(creation[runtimeAt - 1], 0xfe, `${name}: INVALID separates constructor and runtime`);
  return { constructorCode: creation.subarray(0, runtimeAt), runtimeCode: runtime.subarray(0, runtime.length - metadataLength), runtimeBytes: runtime.length };
}

test('jackpot and test token bytecode use only Cancun opcodes', () => {
  for (const name of ['WeeklyJackpot', 'TestChikunToken']) {
    const { constructorCode, runtimeCode } = codeSections(name);
    assert.ok(runtimeCode.length > 1_000);
    assert.deepEqual(auditCode(constructorCode), [], `${name} creation code`);
    assert.deepEqual(auditCode(runtimeCode), [], `${name} runtime code`);
  }
  // The audit itself: PUSH data is skipped, and CLZ (0x1e) or an unassigned byte in code is caught.
  assert.deepEqual(auditCode(Buffer.from('601e1e00', 'hex')), [{ pc: 2, op: '0x1e' }]);
  assert.deepEqual(auditCode(Buffer.from(`7f${'1e'.repeat(32)}00`, 'hex')), []);
  assert.deepEqual(auditCode(Buffer.from('600c0c', 'hex')), [{ pc: 2, op: '0x0c' }]);
  assert.deepEqual(auditCode(Buffer.from('001e0c5b1e', 'hex')), [{ pc: 4, op: '0x1e' }], 'bytes after a terminator are data until a JUMPDEST');
  // WeeklyJackpot stays deployable: its runtime is under the 24,576-byte limit, so no lens is needed.
  assert.ok(codeSections('WeeklyJackpot').runtimeBytes < 24_576);
});
