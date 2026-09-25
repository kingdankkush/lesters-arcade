// WeeklyJackpot and TestChikunToken, function by function (Chikun Weekly Jackpot design §A, revision 2).
// Everything runs on the in-process chain (chainId 4441, offline) against the real 1.8.x Ranked contracts
// deployed by deployLocalSuite, with entry fees ON (0.1 zkLTC + the 0.002 reserve), and evm_snapshot /
// evm_revert between tests. Chain time only moves through evm_setNextBlockTimestamp (setChainTime).
import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { activateLocalGames, deployLocalSuite, loadArtifact, localContracts, localWalletKeys, startLocalChain } from '../scripts/lib/local-chain.mjs';
import {
  attestLocalRun,
  deployLocalJackpot,
  deployMockToken,
  derivedFixtureWallet,
  fastLocalProvider,
  launchRules,
  openLocalSession,
  reconnectWallets,
  setChainTime,
  settleLocalRun,
  weekIndexOf,
  weekKeyOf,
  weekStartOf,
} from '../scripts/lib/local-jackpot.mjs';
import { CHIKUN_SEASON_ID32, weekIndexOfKey } from '../scripts/generate-litvm-jackpot.mjs';
import { periodKeyFor } from '../apps/portal/src/leaderboard-engine.mjs';

const TOKEN = 10n ** 18n;
const HOUR = 3600;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MIN_FUND = 100n * TOKEN;
const b32 = ethers.encodeBytes32String;
const IFACE = new ethers.Interface(loadArtifact('WeeklyJackpot').abi);
const verifierKey = localWalletKeys().verifier;

let chain;
let provider; // the in-process chain without ethers' JSON-RPC batch stall
let wallets;
let suite;
let jackpot;
let token;
let record;
let W;
let chikunId;
let snapshotId;
let operator; let admin; let keeper; let relayer;
let p1; let p2; let p3; let p4;
let funder;
let extra; // derived fixture players (mnemonic indexes 10..19)

const start = (week) => weekStartOf(week);
const close = (week) => weekStartOf(week) + WEEK;
const payoutAt = (week, extension = 0) => close(week) + extension + 24 * HOUR;
const at = (seconds) => setChainTime(provider, seconds);
const nextAt = (seconds) => setChainTime(provider, seconds, { mine: false });
const mined = async (promise) => (await promise).wait();
const newId = () => ethers.hexlify(ethers.randomBytes(32));

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

// A settled Ranked Chikun run on the local suite (opened and settled at the given chain times).
async function playRun(player, fields = {}) {
  return (await settleLocalRun({ provider, record: suite, player, relayer, verifierKey, ...fields })).sessionId;
}

// Opens a paid session now (or at openAt); settleRun() settles it later.
async function openRun(player, { openAt = null, game = 'chikun', amountWei = null } = {}) {
  const sessionId = newId();
  await openLocalSession({ provider, record: suite, player, sessionId, game, openAt, amountWei });
  return sessionId;
}

async function settleRun(player, sessionId, { settleAt = null, ...fields } = {}) {
  const { run, signature } = await attestLocalRun({ provider, record: suite, player, verifierKey, sessionId, ...fields });
  if (settleAt !== null) await nextAt(settleAt);
  await mined(localContracts(suite, provider).scores.connect(relayer).submitVerifiedSession(run, [], signature));
  return sessionId;
}

async function eligibility(id, instance = jackpot) {
  const [ok, week, reason] = await instance.checkEligibility(id);
  return { ok, week: Number(week), reason };
}

// Asserts checkEligibility and submitCandidate agree on `reason` ('' = eligible, and then it is submitted).
async function expectSubmit(id, reason, { from = p4, instance = jackpot } = {}) {
  const check = await eligibility(id, instance);
  assert.equal(check.reason, reason, `checkEligibility(${id.slice(0, 10)}…)`);
  assert.equal(check.ok, reason === '');
  if (reason === '') return mined(instance.connect(from).submitCandidate(id));
  await expectRevert(instance.connect(from).submitCandidate(id), reason);
  return null;
}

const listOf = async (week, instance = jackpot) => (await instance.candidatesOf(week)).map((row) => row.sessionId);

async function fund(week, amount, from = funder) {
  await mined(token.connect(from).approve(await jackpot.getAddress(), amount));
  return mined(jackpot.connect(from).fund(week, amount));
}

const baseRules = () => ({ ...launchRules(suite), adminClearOnly: false });

before(async () => {
  chain = await startLocalChain();
  provider = fastLocalProvider(chain);
  wallets = reconnectWallets(chain.wallets, provider);
  // Move to a Tuesday so setup never straddles a Monday boundary; the jackpot starts the next week.
  await at(weekStartOf(weekIndexOf(await chain.latestTimestamp()) + 1) + DAY);
  suite = await deployLocalSuite({ provider, wallets: wallets });
  await activateLocalGames({ provider, record: suite, developer: wallets.developer, operator: wallets.operator });
  const deployed = await deployLocalJackpot({ provider, wallets: wallets, record: suite, rules: baseRules() });
  ({ jackpot, token, record } = deployed);
  W = record.instances.chikun.firstWeek;
  chikunId = suite.games.find((game) => game.slug === 'chikun').gameId;
  operator = wallets.operator;
  admin = wallets.developer;
  relayer = wallets.relayer;
  keeper = deployed.wallets.keeper;
  p1 = wallets.player1;
  p2 = wallets.player2;
  p3 = deployed.wallets.player3;
  p4 = wallets.attacker;
  funder = await derivedFixtureWallet(provider, 20);
  extra = [];
  for (let index = 10; index < 20; index += 1) extra.push(await derivedFixtureWallet(provider, index));
  await mined(token.connect(operator).mint(funder.address, 1_000_000n * TOKEN));
});

beforeEach(async () => {
  snapshotId = await chain.snapshot();
});

afterEach(async () => {
  await chain.request('evm_setAutomine', [true]);
  await chain.revert(snapshotId);
});

after(async () => {
  await chain?.close();
});

test('tCHIKUN has no-value metadata, a per-call mint cap and a two-step minter', async () => {
  assert.equal(await token.name(), "Lester's Arcade Test CHIKUN (no value)");
  assert.equal(await token.symbol(), 'tCHIKUN');
  assert.equal(await token.decimals(), 18n);
  assert.equal(await token.minter(), operator.address);
  assert.equal(await token.MAX_MINT_PER_CALL(), 10_000_000n * TOKEN);
  await expectRevert(token.connect(p1).mint(p1.address, 1n), 'ONLY_MINTER');
  await mined(token.connect(operator).mint(p1.address, 10_000_000n * TOKEN));
  await expectRevert(token.connect(operator).mint(p1.address, 10_000_000n * TOKEN + 1n), 'MINT_CAP');
  assert.equal(await token.balanceOf(p1.address), 10_000_000n * TOKEN);
  await expectRevert(token.connect(p1).transferMinter(p1.address), 'ONLY_MINTER');
  await expectRevert(token.connect(operator).transferMinter(ethers.ZeroAddress), 'ZERO_ADDRESS');
  await mined(token.connect(operator).transferMinter(p2.address));
  assert.equal(await token.minter(), operator.address, 'two-step: nothing changes before acceptMinter');
  assert.equal(await token.pendingMinter(), p2.address);
  await expectRevert(token.connect(p1).acceptMinter(), 'ONLY_PENDING_MINTER');
  await mined(token.connect(p2).acceptMinter());
  assert.equal(await token.minter(), p2.address);
  assert.equal(await token.pendingMinter(), ethers.ZeroAddress);
  await expectRevert(token.connect(operator).mint(p1.address, 1n), 'ONLY_MINTER');
  await mined(token.connect(p2).mint(p3.address, 5n));
  assert.equal(await token.balanceOf(p3.address), 5n);
});

test('week math matches ISO weekly keys at every Monday boundary', async () => {
  const named = [
    ['2026-09-21T00:00:00Z', 2960, '2026-W39'],
    ['2026-09-27T23:59:59Z', 2960, '2026-W39'],
    ['2026-09-28T00:00:00Z', 2961, '2026-W40'],
    ['2026-12-28T00:00:00Z', 2974, '2026-W53'],
    ['2027-01-01T00:00:00Z', 2974, '2026-W53'],
    ['2027-01-03T23:59:59Z', 2974, '2026-W53'],
    ['2027-01-04T00:00:00Z', 2975, '2027-W01'],
  ];
  for (const [iso, index, key] of named) {
    const ts = Date.parse(iso) / 1000;
    assert.equal(Number(await jackpot.weekOf(ts)), index, iso);
    assert.equal(weekIndexOf(ts), index, `${iso} (js)`);
    assert.equal(weekKeyOf(index), key);
    assert.equal(periodKeyFor('weekly', ts * 1000), key, `${iso} board key`);
    assert.equal(weekIndexOfKey(key), index);
  }
  // Every Monday from 2026-W01 to 2027-W10, at -1 s, 0 and +1 s.
  for (let index = weekIndexOfKey('2026-W01'); index <= weekIndexOfKey('2027-W10'); index += 1) {
    const monday = weekStartOf(index);
    assert.equal(new Date(monday * 1000).toISOString().slice(10), 'T00:00:00.000Z');
    assert.equal(new Date(monday * 1000).getUTCDay(), 1, 'weeks start on Monday 00:00 UTC');
    for (const [ts, expected] of [[monday - 1, index - 1], [monday, index], [monday + 1, index]]) {
      assert.equal(Number(await jackpot.weekOf(ts)), expected, `weekOf(${ts})`);
      assert.equal(weekKeyOf(expected), periodKeyFor('weekly', ts * 1000), `key at ${new Date(ts * 1000).toISOString()}`);
    }
    const bounds = await jackpot.weekBounds(index);
    assert.equal(Number(bounds.start), monday);
    assert.equal(Number(bounds.close), monday + WEEK);
    assert.equal(Number(bounds.settleCutoff), monday + WEEK + 6 * HOUR);
    assert.equal(Number(bounds.candidateUntil), monday + WEEK + 12 * HOUR);
    assert.equal(Number(bounds.payoutAt), monday + WEEK + 24 * HOUR);
  }
  // currentWeek() follows chain time across a live boundary.
  await at(start(W) - 1);
  assert.equal(Number(await jackpot.currentWeek()), W - 1);
  await at(start(W));
  assert.equal(Number(await jackpot.currentWeek()), W);
  const constants = ['WEEK', 'WEEK_SHIFT', 'SETTLE_GRACE', 'CANDIDATE_WINDOW', 'PAYOUT_DELAY', 'MAX_EXTENSION', 'MAX_CANDIDATES', 'RELIST_MARGIN', 'MAX_FUND_AHEAD_WEEKS', 'MAX_PENDING_EPOCHS', 'UNCLAIMED_AFTER', 'RESIDUAL_DELAY'];
  const values = await Promise.all(constants.map((name) => jackpot[name]()));
  assert.deepEqual(values.map(Number), [WEEK, 3 * DAY, 6 * HOUR, 12 * HOUR, 24 * HOUR, 72 * HOUR, 5, 2 * HOUR, 8, 8, 180 * DAY, 30 * DAY]);
});

test('rules can only be scheduled for weeks that have not started', async () => {
  // The constructor emitted RulesScheduled for the initial epoch (and its roles), so a mirror is complete.
  const deployReceipt = await provider.getTransactionReceipt(record.instances.chikun.deployTx);
  assert.deepEqual(eventsOf(deployReceipt).map((event) => event.name), ['OperatorTransferred', 'AdminTransferred', 'KeeperUpdated', 'RulesScheduled']);
  const [initial] = eventsOf(deployReceipt, 'RulesScheduled');
  assert.equal(Number(initial.args.fromWeek), W);
  assert.equal(initial.args.seasonId, CHIKUN_SEASON_ID32);
  assert.equal(initial.args.minFundWei, MIN_FUND);
  assert.equal(initial.args.minPaidWei, ethers.parseEther('0.1'));
  assert.equal(initial.args.maxSurvivalSeconds, 3599n);

  await at(start(W) + HOUR);
  const base = baseRules();
  await expectRevert(jackpot.connect(p1).scheduleRules({ ...base, fromWeek: W + 1 }), 'Only platform operator');
  await expectRevert(jackpot.connect(admin).scheduleRules({ ...base, fromWeek: W + 1 }), 'Only platform operator');
  await expectRevert(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W }), 'RULES_NOT_FUTURE');
  await expectRevert(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W - 1 }), 'RULES_NOT_FUTURE');
  await expectRevert(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 1, seasonId: ethers.ZeroHash }), 'BAD_RULES');
  await expectRevert(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 1, minFundWei: 0n }), 'BAD_RULES');
  const receipt = await mined(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 1, maxPrizeWei: 7n * TOKEN }));
  const [event] = eventsOf(receipt, 'RulesScheduled');
  assert.equal(Number(event.args.fromWeek), W + 1);
  assert.equal(event.args.maxPrizeWei, 7n * TOKEN);
  assert.equal(event.args.adminClearOnly, false);
  // Once W + 1 starts, its rules are fixed: a new epoch can only start later.
  await at(start(W + 1) + 1);
  await expectRevert(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 1 }), 'RULES_NOT_FUTURE');
  await mined(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 2, maxPrizeWei: 9n * TOKEN }));
  assert.equal((await jackpot.rulesFor(W + 1)).maxPrizeWei, 7n * TOKEN, 'the started week keeps its rules');
  assert.equal((await jackpot.rulesFor(W + 2)).maxPrizeWei, 9n * TOKEN);
  assert.equal((await jackpot.rulesFor(W)).maxPrizeWei, 0n);
  // No epoch may start before the instance's first week.
  const later = await deployLocalJackpot({ provider, wallets: wallets, record: suite, firstWeek: W + 5 });
  await expectRevert(later.jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 3 }), 'BAD_WEEK');
  await mined(later.jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 5, maxScore: 5n }));
  assert.equal(await later.jackpot.rulesCount(), 1n, 'the not-yet-started initial epoch was replaced');
  assert.equal((await later.jackpot.rulesFor(W + 5)).maxScore, 5n);
});

test('rulesFor returns the epoch in force for each week', async () => {
  const base = baseRules();
  await at(start(W) + HOUR);
  for (const [fromWeek, cap] of [[W + 2, 2n], [W + 4, 4n], [W + 5, 5n]]) {
    await mined(jackpot.connect(operator).scheduleRules({ ...base, fromWeek, maxPrizeWei: cap * TOKEN }));
  }
  assert.equal(await jackpot.rulesCount(), 4n);
  const expected = [[W - 3, 0n], [W, 0n], [W + 1, 0n], [W + 2, 2n], [W + 3, 2n], [W + 4, 4n], [W + 5, 5n], [W + 40, 5n]];
  for (const [week, cap] of expected) assert.equal((await jackpot.rulesFor(week)).maxPrizeWei, cap * TOKEN, `week ${week}`);
  assert.equal(Number((await jackpot.rulesAt(0)).fromWeek), W);
  assert.equal(Number((await jackpot.rulesAt(3)).fromWeek), W + 5);
  // Re-scheduling W + 4 replaces every pending epoch at or after it.
  await mined(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 4, maxPrizeWei: 44n * TOKEN }));
  assert.equal(await jackpot.rulesCount(), 3n);
  assert.equal((await jackpot.rulesFor(W + 9)).maxPrizeWei, 44n * TOKEN);
  assert.equal((await jackpot.rulesFor(W + 3)).maxPrizeWei, 2n * TOKEN);
});

test('fund credits the received amount to current or future weeks only', async () => {
  const address = await jackpot.getAddress();
  await mined(token.connect(funder).approve(address, 10_000n * TOKEN));
  // Before firstWeek starts, only firstWeek and later can be funded.
  await expectRevert(jackpot.connect(funder).fund(W - 1, MIN_FUND), 'BAD_WEEK');
  await expectRevert(jackpot.connect(funder).fundCurrent(MIN_FUND), 'BAD_WEEK');
  await mined(jackpot.connect(funder).fund(W, MIN_FUND));
  await at(start(W) + HOUR);
  const receipt = await mined(jackpot.connect(funder).fund(W + 8, 150n * TOKEN));
  const [funded] = eventsOf(receipt, 'Funded');
  assert.deepEqual([Number(funded.args.week), funded.args.funder, funded.args.amount], [W + 8, funder.address, 150n * TOKEN]);
  await expectRevert(jackpot.connect(funder).fund(W + 9, MIN_FUND), 'BAD_WEEK');
  await expectRevert(jackpot.connect(funder).fund(W, MIN_FUND - 1n), 'BELOW_MIN_FUND');
  await mined(jackpot.connect(funder).fundCurrent(200n * TOKEN));
  await at(start(W + 1) + 1);
  await expectRevert(jackpot.connect(funder).fund(W, MIN_FUND), 'BAD_WEEK');
  const pot = await jackpot.potOf(W);
  assert.deepEqual([pot.funded, pot.carriedIn, pot.total], [300n * TOKEN, 0n, 300n * TOKEN]);
  assert.equal(await jackpot.fundedBy(W, funder.address), 300n * TOKEN);
  assert.equal(await jackpot.fundedBy(W + 8, funder.address), 150n * TOKEN);
  assert.equal(await jackpot.liabilities(), 450n * TOKEN);
  assert.equal(await token.balanceOf(address), 450n * TOKEN);
  // Tokens sent with a plain transfer are stray: never attributed to a week.
  await mined(token.connect(funder).transfer(address, 5n * TOKEN));
  assert.equal(await jackpot.liabilities(), 450n * TOKEN);
  assert.equal((await jackpot.potOf(W + 1)).total, 0n);
});

test('fund with a fee-on-transfer token credits the balance delta', async () => {
  const feeToken = await deployMockToken('FeeOnTransferToken', [1_000n], operator); // 10% on the recipient side
  const instance = (await deployLocalJackpot({ provider, wallets: wallets, record: suite, token: await feeToken.getAddress() })).jackpot;
  const address = await instance.getAddress();
  await mined(feeToken.mint(funder.address, 10_000n * TOKEN));
  await mined(feeToken.connect(funder).approve(address, 10_000n * TOKEN));
  const receipt = await mined(instance.connect(funder).fund(W, 1_000n * TOKEN));
  const [event] = eventsOf(receipt, 'Funded');
  assert.equal(event.args.amount, 900n * TOKEN, 'the received amount, not the requested one');
  assert.equal((await instance.potOf(W)).funded, 900n * TOKEN);
  assert.equal(await instance.fundedBy(W, funder.address), 900n * TOKEN);
  assert.equal(await instance.liabilities(), 900n * TOKEN);
  assert.equal(await feeToken.balanceOf(address), 900n * TOKEN);
  // 110 requested arrives as 99, below the 100 minimum.
  await expectRevert(instance.connect(funder).fund(W, 110n * TOKEN), 'BELOW_MIN_FUND');
  await mined(feeToken.setFeeBps(10_000n));
  await expectRevert(instance.connect(funder).fund(W, 500n * TOKEN), 'NOTHING_RECEIVED');
  assert.equal(await instance.liabilities(), 900n * TOKEN);
});

test('submitCandidate enforces every eligibility check in order', async () => {
  const s = start(W);
  const base = baseRules();
  const { gameRegistry } = localContracts(suite, provider);
  const ids = {};
  // Phase A, still in W - 1: a pre-first-week run, the rules of W + 1 / W + 2, and an unpaid settle.
  ids.beforeFirstWeek = await playRun(p1, { score: 900n });
  ids.beforeFirstWeekWrongSeason = await playRun(p2, { score: 900n, seasonId: ethers.id('chikun-season-other') });
  await mined(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 1, minPaidWei: ethers.parseEther('0.2') }));
  await mined(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 2, maxScore: 10_000n }));
  // Two paid sessions that a zero Chikun fee lets another run ride: one paid by another wallet, one paid for
  // another game (design §A.7 step 2 checks the player and the game of the paid session, not only that it exists).
  ids.paidByOtherWallet = await openRun(p1);
  ids.paidForOtherGame = await openRun(p2, { game: 'lester-blaster' });
  // With a zero entry fee, settlement skips isPaid, so a run can settle without any paid session.
  await mined(gameRegistry.connect(operator).setEntryFee(chikunId, 0n));
  ids.notPaid = await playRun(p3, { score: 5_000n, open: false });
  await settleRun(p3, ids.paidByOtherWallet, { score: 5_000n });
  await settleRun(p2, ids.paidForOtherGame, { score: 5_000n });
  assert.equal((await localContracts(suite, provider).rankedEntry.getPaidSession(ids.paidByOtherWallet)).player, p1.address);
  await mined(gameRegistry.connect(operator).setEntryFee(chikunId, ethers.parseEther('0.1')));

  // Phase B, week W: every run is opened (and, except two, settled) inside the week.
  ids.ok = await playRun(p1, { score: 5_000n, openAt: s + HOUR });
  ids.wrongGame = await playRun(p2, { score: 5_000n, game: 'lester-blaster' });
  ids.wrongSeason = await playRun(p2, { score: 5_000n, seasonId: ethers.id('chikun-season-other') });
  ids.wrongSeasonAndSurvival = await playRun(p2, { score: 5_000n, seasonId: ethers.id('chikun-season-other'), survivalSeconds: 3_600n });
  ids.survival = await playRun(p2, { score: 5_000n, survivalSeconds: 3_600n });
  ids.survivalLimit = await playRun(p3, { score: 4_000n, survivalSeconds: 3_599n });
  ids.zero = await playRun(p2, { score: 0n });
  ids.staff = await playRun(keeper, { score: 5_000n });
  ids.admin = await playRun(admin, { score: 5_000n });
  ids.operator = await playRun(operator, { score: 5_000n });
  ids.blocked = await playRun(extra[9], { score: 5_000n });
  ids.blockedAndDisqualified = await playRun(extra[9], { score: 4_500n });
  ids.disqualified = await playRun(extra[0], { score: 5_000n });
  ids.walletDisqualified = await playRun(extra[1], { score: 5_000n });
  ids.walletDisqualifiedOther = await playRun(extra[1], { score: 6_000n });
  ids.notBetter = await playRun(p1, { score: 4_000n });
  for (let index = 2; index < 5; index += 1) ids[`fill${index}`] = await playRun(extra[index], { score: 10_000n + BigInt(index) });
  ids.notInTop = await playRun(extra[6], { score: 3_999n });
  ids.window = await playRun(extra[8], { score: 5_000n });
  ids.staffLate = await openRun(keeper);
  ids.late = await openRun(extra[7]);

  await mined(jackpot.connect(admin).setBlocked(extra[9].address, true, b32('cheating')));
  await mined(jackpot.connect(admin).disqualify(ids.blockedAndDisqualified, false, b32('automation')));
  await mined(jackpot.connect(admin).setBlocked(keeper.address, true, b32('staff')));
  await mined(jackpot.connect(admin).disqualify(ids.disqualified, false, b32('automation')));
  await mined(jackpot.connect(admin).disqualify(ids.walletDisqualifiedOther, true, b32('multi-wallet')));

  // NOT_FOUND on the real registry; NOT_VERIFIED needs a reader that returns verified == false, which the
  // real ScoreSubmissionRegistry never stores.
  assert.equal((await eligibility(ethers.id('no-such-session'))).reason, 'NOT_FOUND');
  await expectRevert(jackpot.connect(p4).submitCandidate(ethers.id('no-such-session')), 'NOT_FOUND');
  const reader = await deployMockToken('MockRankedReaders', [], operator);
  const readerAddress = await reader.getAddress();
  const mockInstance = (await deployLocalJackpot({ provider, wallets: wallets, record: { ...suite, addresses: { ...suite.addresses, scoreSubmissionRegistry: readerAddress, arcadeRankedEntry: readerAddress } }, firstWeek: W + 1 })).jackpot;
  const unverified = ethers.id('unverified-session');
  await mined(reader.setSession({ sessionId: unverified, player: p1.address, gameId: chikunId, score: 10n, kills: 0n, maxCombo: 0n, survivalSeconds: 10n, bossId: ethers.ZeroHash, runtimeId: ethers.ZeroHash, seasonId: CHIKUN_SEASON_ID32, submittedAt: s, verified: false, exists: true }));
  await expectSubmit(unverified, 'NOT_VERIFIED', { instance: mockInstance });

  // Phase C: the two late settles land one second after the settle cutoff.
  await settleRun(keeper, ids.staffLate, { score: 5_000n, settleAt: close(W) + 6 * HOUR + 1 });
  await settleRun(extra[7], ids.late, { score: 5_000n });

  // Steps 1-6, then step 7, in order. A run that fails two checks reports the earlier one.
  await expectSubmit(ids.wrongGame, 'WRONG_GAME');
  await expectSubmit(ids.notPaid, 'NOT_PAID');
  await expectSubmit(ids.paidByOtherWallet, 'NOT_PAID');
  await expectSubmit(ids.paidForOtherGame, 'NOT_PAID');
  await expectSubmit(ids.beforeFirstWeek, 'BEFORE_FIRST_WEEK');
  await expectSubmit(ids.beforeFirstWeekWrongSeason, 'BEFORE_FIRST_WEEK'); // the week before the rules
  await expectSubmit(ids.wrongSeason, 'WRONG_SEASON');
  await expectSubmit(ids.wrongSeasonAndSurvival, 'WRONG_SEASON'); // the earlier check wins
  await expectSubmit(ids.survival, 'SURVIVAL_CAP');
  await expectSubmit(ids.zero, 'ZERO_SCORE');
  await expectSubmit(ids.staffLate, 'SETTLED_LATE'); // timing is checked before the player
  await expectSubmit(ids.late, 'SETTLED_LATE');
  await expectSubmit(ids.staff, 'STAFF_WALLET'); // the keeper is also blocked: staff is checked first
  await expectSubmit(ids.admin, 'STAFF_WALLET');
  await expectSubmit(ids.operator, 'STAFF_WALLET');
  await expectSubmit(ids.blocked, 'WALLET_BLOCKED');
  await expectSubmit(ids.blockedAndDisqualified, 'WALLET_BLOCKED'); // the block is checked before the disqualification
  await expectSubmit(ids.disqualified, 'DISQUALIFIED');
  await expectSubmit(ids.walletDisqualified, 'DISQUALIFIED');
  await expectSubmit(ids.ok, '');
  await expectSubmit(ids.ok, 'ALREADY_CANDIDATE');
  await expectSubmit(ids.notBetter, 'NOT_BETTER');
  await expectSubmit(ids.survivalLimit, '');
  for (let index = 2; index < 5; index += 1) await expectSubmit(ids[`fill${index}`], '');
  assert.equal((await listOf(W)).length, 5);
  await expectSubmit(ids.notInTop, 'NOT_IN_TOP');
  await at(close(W) + 12 * HOUR);
  await expectSubmit(ids.window, 'WINDOW_CLOSED');
  // WEEK_SETTLED: once finalized nothing enters the week (the window has closed by then, so the admin path
  // shows it) and the week cannot finalize twice.
  await at(payoutAt(W));
  await mined(jackpot.connect(p4).finalize(W));
  await expectRevert(jackpot.connect(admin).adminSubmit(ids.window), 'WEEK_SETTLED');
  await expectRevert(jackpot.connect(p4).finalize(W), 'WEEK_SETTLED');

  // Week W + 1 (minPaidWei 0.2 zkLTC): a 0.102 zkLTC entry is below the minimum.
  const belowMinPaid = await playRun(p2, { score: 5_000n });
  assert.equal((await eligibility(belowMinPaid)).week, W + 1);
  await expectSubmit(belowMinPaid, 'BELOW_MIN_PAID');
  // Week W + 2 (maxScore 10,000); then an end after W + 2 makes W + 3 sessions ineligible.
  await mined(jackpot.connect(operator).scheduleEnd(W + 2));
  const scoreCap = await playRun(p2, { score: 10_001n, openAt: start(W + 2) + HOUR });
  const scoreAtCap = await playRun(p3, { score: 10_000n });
  await expectSubmit(scoreCap, 'SCORE_CAP');
  await expectSubmit(scoreAtCap, '');
  const afterEnd = await playRun(p2, { score: 5_000n, openAt: start(W + 3) + HOUR });
  await expectSubmit(afterEnd, 'AFTER_END');
  // AFTER_END is checked before the week's rules: a W + 3 run paid below minPaidWei (the reserve only, with a
  // zero flat fee) still reports AFTER_END.
  await mined(gameRegistry.connect(operator).setEntryFee(chikunId, 0n));
  const afterEndBelowMinPaid = await playRun(p3, { score: 5_000n });
  assert.equal((await localContracts(suite, provider).rankedEntry.getPaidSession(afterEndBelowMinPaid)).amountWei, ethers.parseEther('0.002'));
  await expectSubmit(afterEndBelowMinPaid, 'AFTER_END');
});

test('an alternate season counts only in weeks whose rules name it', async () => {
  const other = ethers.id('chikun-season-other');
  const third = ethers.id('chikun-season-third');
  await at(start(W) + HOUR);
  await mined(jackpot.connect(operator).scheduleRules({ ...baseRules(), fromWeek: W + 1, altSeasonId: other }));
  assert.equal((await jackpot.rulesFor(W + 1)).altSeasonId, other);
  assert.equal((await jackpot.rulesFor(W)).altSeasonId, ethers.ZeroHash);
  // Week W (no alternate season): only the main season counts, and a run with no season never matches the
  // unset alternate.
  const mainW = await playRun(p1, { score: 500n });
  const otherW = await playRun(p2, { score: 500n, seasonId: other });
  const noSeasonW = await playRun(p3, { score: 500n, seasonId: ethers.ZeroHash });
  await expectSubmit(otherW, 'WRONG_SEASON');
  await expectSubmit(noSeasonW, 'WRONG_SEASON');
  await expectSubmit(mainW, '');
  // Week W + 1 (a season change mid-week): the main and the alternate season count, nothing else does.
  const mainNext = await playRun(p1, { score: 600n, openAt: start(W + 1) + HOUR });
  const otherNext = await playRun(p2, { score: 700n, seasonId: other });
  const thirdNext = await playRun(p3, { score: 800n, seasonId: third });
  const noSeasonNext = await playRun(p4, { score: 800n, seasonId: ethers.ZeroHash });
  await expectSubmit(thirdNext, 'WRONG_SEASON');
  await expectSubmit(noSeasonNext, 'WRONG_SEASON');
  await expectSubmit(mainNext, '');
  await expectSubmit(otherNext, '');
  assert.deepEqual(await listOf(W + 1), [otherNext, mainNext]);
});

test('zero-fee and below-minimum sessions are ineligible', async () => {
  const { gameRegistry, rankedEntry } = localContracts(suite, provider);
  await at(start(W) + HOUR);
  // Fees off: openSession sends 0 and the session still exists (amountWei 0).
  await mined(rankedEntry.connect(operator).setEntryFeeEnabled(false));
  const free = await playRun(p1, { score: 9_000n });
  assert.equal((await rankedEntry.getPaidSession(free)).amountWei, 0n);
  assert.equal(await rankedEntry.isPaid(free, p1.address, chikunId), true, 'isPaid is true for a zero-fee session');
  await mined(rankedEntry.connect(operator).setEntryFeeEnabled(true));
  // A zero flat fee with fees on: only the 0.002 reserve is paid, and settlement needs no paid session.
  await mined(gameRegistry.connect(operator).setEntryFee(chikunId, 0n));
  const reserveOnly = await playRun(p2, { score: 9_000n });
  assert.equal((await rankedEntry.getPaidSession(reserveOnly)).amountWei, ethers.parseEther('0.002'));
  const unpaid = await playRun(p3, { score: 9_000n, open: false });
  await mined(gameRegistry.connect(operator).setEntryFee(chikunId, ethers.parseEther('0.1')));
  // J17: a reserve change never disqualifies runs, because minPaidWei is the flat fee alone.
  await mined(rankedEntry.connect(operator).setSettlementGasReserve(0n));
  const flatOnly = await playRun(p4, { score: 9_000n });
  assert.equal((await rankedEntry.getPaidSession(flatOnly)).amountWei, ethers.parseEther('0.1'));
  await expectSubmit(free, 'BELOW_MIN_PAID');
  await expectSubmit(reserveOnly, 'BELOW_MIN_PAID');
  await expectSubmit(unpaid, 'NOT_PAID');
  await expectSubmit(flatOnly, '');
});

test('a run settled after the cutoff is rejected and an extension moves the cutoff', async () => {
  const onTime = await openRun(p1, { openAt: start(W) + HOUR });
  const late = await openRun(p2);
  const later = await openRun(p3);
  await settleRun(p1, onTime, { score: 7_000n, settleAt: close(W) + 6 * HOUR });
  await settleRun(p2, late, { score: 8_000n, settleAt: close(W) + 6 * HOUR + 1 });
  await expectSubmit(late, 'SETTLED_LATE');
  await expectSubmit(onTime, '');
  await expectRevert(jackpot.connect(p1).extendWeek(W, HOUR), 'ONLY_ADMIN');
  const receipt = await mined(jackpot.connect(admin).extendWeek(W, HOUR));
  const [event] = eventsOf(receipt, 'WeekExtended');
  assert.deepEqual([Number(event.args.week), Number(event.args.totalExtensionSeconds)], [W, HOUR]);
  const bounds = await jackpot.weekBounds(W);
  assert.deepEqual([bounds.close, bounds.settleCutoff, bounds.candidateUntil, bounds.payoutAt].map(Number), [close(W), close(W) + 7 * HOUR, close(W) + 13 * HOUR, close(W) + 25 * HOUR]);
  assert.equal(Number((await jackpot.weekState(W)).extension), HOUR);
  await expectSubmit(late, '');
  assert.deepEqual(await listOf(W), [late, onTime]);
  // The cutoff moved by exactly the extension.
  await settleRun(p3, later, { score: 100n, settleAt: close(W) + 7 * HOUR + 1 });
  await expectSubmit(later, 'SETTLED_LATE');
  await mined(jackpot.connect(admin).extendWeek(W, 71 * HOUR));
  await expectRevert(jackpot.connect(admin).extendWeek(W, 1), 'EXTENSION_CAP');
  // Transactions land in the next block: nextAt() pins that block's timestamp.
  await nextAt(payoutAt(W, 72 * HOUR) - 1);
  await mined(jackpot.connect(admin).extendWeek(W, 0));
  await nextAt(payoutAt(W, 72 * HOUR));
  await expectRevert(jackpot.connect(admin).extendWeek(W, 0), 'TOO_LATE');
});

test('an extension moves the candidate window and the re-list deadline with the payout time', async () => {
  const players = [p1, p2, p3, p4, extra[0]];
  const listed = [];
  for (const [index, player] of players.entries()) {
    listed.push(await playRun(player, { score: BigInt(500 - index * 100), openAt: index === 0 ? start(W) + HOUR : null }));
  }
  const top = await playRun(extra[1], { score: 600n });
  const lateEntry = await playRun(extra[2], { score: 1_000n });
  const neverListed = await playRun(extra[3], { score: 2_000n });
  for (const id of [...listed, top]) await expectSubmit(id, '');
  assert.deepEqual(await listOf(W), [top, ...listed.slice(0, 4)], 'the fifth row was displaced');
  await at(close(W) + 11 * HOUR);
  await mined(jackpot.connect(admin).extendWeek(W, HOUR));
  // The window now closes at C + 13 h: a new run still enters at C + 12 h 30 min (and displaces listed[3]).
  await at(close(W) + 12 * HOUR + 30 * 60);
  await expectSubmit(lateEntry, '');
  assert.deepEqual(await listOf(W), [lateEntry, top, ...listed.slice(0, 3)]);
  await nextAt(close(W) + 13 * HOUR);
  await expectRevert(jackpot.connect(p4).submitCandidate(neverListed), 'WINDOW_CLOSED');
  // The re-list deadline moves with the payout time: payoutAt(W) + 1 h - 2 h = C + 23 h.
  await mined(jackpot.connect(admin).disqualify(top, false, b32('automation')));
  await mined(jackpot.connect(admin).disqualify(listed[0], false, b32('automation')));
  await nextAt(payoutAt(W, HOUR) - 2 * HOUR - 1);
  const relisted = await mined(jackpot.connect(p4).submitCandidate(listed[3]));
  assert.equal((await provider.getBlock(relisted.blockNumber)).timestamp, close(W) + 23 * HOUR - 1, 'after the unextended deadline C + 22 h');
  await nextAt(payoutAt(W, HOUR) - 2 * HOUR);
  await expectRevert(jackpot.connect(p4).submitCandidate(listed[4]), 'WINDOW_CLOSED');
  assert.deepEqual(await listOf(W), [lateEntry, listed[1], listed[2], listed[3]]);
});

test('candidates are ordered like the board and kept one per wallet', async () => {
  const { scores } = localContracts(suite, provider);
  const a = await playRun(p1, { score: 5_000n, openAt: start(W) + HOUR });
  const b = await playRun(p2, { score: 7_000n });
  const c = await playRun(p3, { score: 5_000n });
  // Two runs with the same score, settled in the same block (same submittedAt): the lower sessionId wins.
  const [low, high] = [ethers.id('tie-one'), ethers.id('tie-two')].sort((x, y) => (BigInt(x) < BigInt(y) ? -1 : 1));
  await openLocalSession({ provider, record: suite, player: p4, sessionId: high });
  await openLocalSession({ provider, record: suite, player: extra[0], sessionId: low });
  const first = await attestLocalRun({ provider, record: suite, player: p4, verifierKey, sessionId: high, score: 6_000n });
  const second = await attestLocalRun({ provider, record: suite, player: extra[0], verifierKey, sessionId: low, score: 6_000n });
  const nonce = await provider.getTransactionCount(relayer.address, 'latest');
  await chain.request('evm_setAutomine', [false]);
  const tx1 = await scores.connect(relayer).submitVerifiedSession(first.run, [], first.signature, { nonce, gasLimit: 1_000_000n });
  const tx2 = await scores.connect(relayer).submitVerifiedSession(second.run, [], second.signature, { nonce: nonce + 1, gasLimit: 1_000_000n });
  await chain.request('evm_mine', []);
  await chain.request('evm_setAutomine', [true]);
  const [r1, r2] = [await tx1.wait(), await tx2.wait()];
  assert.equal(r1.blockNumber, r2.blockNumber, 'same block, same submittedAt');

  const submitted = [];
  for (const id of [c, high, a, low, b]) {
    const receipt = await expectSubmit(id, '');
    submitted.push(...eventsOf(receipt));
  }
  const rows = await jackpot.candidatesOf(W);
  const board = [...rows].map((row) => ({ sessionId: row.sessionId.toLowerCase(), score: row.score, submittedAt: row.submittedAt }))
    .sort((x, y) => (x.score !== y.score ? (y.score > x.score ? 1 : -1) : x.submittedAt !== y.submittedAt ? (x.submittedAt < y.submittedAt ? -1 : 1) : x.sessionId.localeCompare(y.sessionId)));
  assert.deepEqual(rows.map((row) => row.sessionId.toLowerCase()), board.map((row) => row.sessionId), 'score DESC, submittedAt ASC, sessionId ASC');
  assert.deepEqual(await listOf(W), [b, low, high, a, c]);
  const ranks = submitted.filter((event) => event.name === 'CandidateSubmitted').map((event) => Number(event.args.rank));
  assert.deepEqual(ranks, [1, 1, 2, 1, 1], 'the rank each row took when it was inserted');
  const leaders = submitted.filter((event) => event.name === 'LeaderChanged').map((event) => event.args.sessionId);
  assert.deepEqual(leaders, [c, high, low, b], 'LeaderChanged only when rank 1 changes');
  const [leaderId, leaderPlayer, leaderScore] = await jackpot.leaderOf(W);
  assert.deepEqual([leaderId, leaderPlayer, leaderScore], [b, p2.address, 7_000n]);

  // One row per wallet: p1's better run replaces its own row, which keeps its review state.
  await mined(jackpot.connect(keeper).clear(a));
  const better = await playRun(p1, { score: 8_000n });
  const receipt = await expectSubmit(better, '');
  const removed = eventsOf(receipt, 'CandidateRemoved');
  assert.deepEqual(removed.map((event) => [event.args.sessionId, ethers.decodeBytes32String(event.args.reason)]), [[a, 'replaced']]);
  assert.deepEqual(await listOf(W), [better, b, low, high, c]);
  assert.equal(Number(await jackpot.reviewOf(a)), 1, 'the replaced row stays cleared');
  assert.equal(await jackpot.wasListed(a), true);
  assert.equal(eventsOf(receipt, 'LeaderChanged').length, 1);
});

test('a full list rejects a lower run and drops the last row for a higher one', async () => {
  const players = [p1, p2, p3, p4, extra[0]];
  const listed = [];
  for (const [index, player] of players.entries()) {
    listed.push(await playRun(player, { score: BigInt(500 - index * 100), openAt: index === 0 ? start(W) + HOUR : null }));
  }
  const lower = await playRun(extra[1], { score: 50n });
  const tied = await playRun(extra[2], { score: 100n });
  const higher = await playRun(extra[3], { score: 600n });
  for (const id of listed) await expectSubmit(id, '');
  await mined(jackpot.connect(keeper).clear(listed[4]));
  await expectSubmit(lower, 'NOT_IN_TOP');
  await expectSubmit(tied, 'NOT_IN_TOP'); // same score, settled later: it ranks below the last row
  const receipt = await expectSubmit(higher, '');
  const [removed] = eventsOf(receipt, 'CandidateRemoved');
  assert.deepEqual([removed.args.sessionId, ethers.decodeBytes32String(removed.args.reason)], [listed[4], 'displaced']);
  assert.deepEqual(await listOf(W), [higher, ...listed.slice(0, 4)]);
  const [submitted] = eventsOf(receipt, 'CandidateSubmitted');
  assert.equal(Number(submitted.args.rank), 1);
  assert.equal(eventsOf(receipt, 'LeaderChanged').length, 1);
  assert.equal(Number(await jackpot.reviewOf(listed[4])), 1, 'a displaced row keeps its review state');
  assert.equal(await jackpot.wasListed(listed[4]), true, 'and stays re-listable');
  assert.equal(Number((await jackpot.weekState(W)).count), 5);
});

test('staff wallets can never be candidates', async () => {
  const runs = {};
  runs.operator = await playRun(operator, { score: 900n, openAt: start(W) + HOUR });
  runs.admin = await playRun(admin, { score: 900n });
  runs.keeper = await playRun(keeper, { score: 900n });
  for (const [who, id] of Object.entries(runs)) {
    assert.equal((await eligibility(id)).reason, 'STAFF_WALLET', who);
    await expectRevert(jackpot.connect(p4).submitCandidate(id), 'STAFF_WALLET');
  }
  // Rotations: every address that takes a role joins staffEver, and the outgoing ones stay in it.
  const [newKeeper, newAdmin, newOperator] = [extra[3], extra[4], extra[5]];
  const keeperRun = await playRun(newKeeper, { score: 800n });
  const adminRun = await playRun(newAdmin, { score: 800n });
  const operatorRun = await playRun(newOperator, { score: 800n });
  for (const id of [keeperRun, adminRun, operatorRun]) assert.equal((await eligibility(id)).reason, '');
  await mined(jackpot.connect(operator).setKeeper(newKeeper.address));
  await mined(jackpot.connect(operator).forceAdmin(newAdmin.address));
  await mined(jackpot.connect(operator).transferOperator(newOperator.address));
  assert.equal(await jackpot.staffEver(newOperator.address), false, 'a pending operator is not staff yet');
  await mined(jackpot.connect(newOperator).acceptOperator());
  await mined(jackpot.connect(newOperator).setKeeper(ethers.ZeroAddress));
  assert.equal(await jackpot.keeper(), ethers.ZeroAddress);
  for (const id of [keeperRun, adminRun, operatorRun, ...Object.values(runs)]) {
    await expectSubmit(id, 'STAFF_WALLET');
  }
  for (const wallet of [operator, admin, keeper, newKeeper, newAdmin, newOperator]) {
    assert.equal(await jackpot.staffEver(wallet.address), true, wallet.address);
  }
  assert.equal(await jackpot.staffEver(ethers.ZeroAddress), false);
  assert.equal(await jackpot.staffEver(p1.address), false);
});

test('keeper clears and flags, but cannot undo a flag or clear under adminClearOnly', async () => {
  await at(start(W) + HOUR);
  await mined(jackpot.connect(operator).scheduleRules({ ...baseRules(), fromWeek: W + 1, adminClearOnly: true }));
  const a = await playRun(p1, { score: 900n });
  const b = await playRun(p2, { score: 800n });
  await expectRevert(jackpot.connect(p1).clear(a), 'ONLY_KEEPER');
  await expectRevert(jackpot.connect(operator).flag(a, b32('screen-hold')), 'ONLY_KEEPER');
  const cleared = await mined(jackpot.connect(keeper).clear(a));
  const [event] = eventsOf(cleared, 'Cleared');
  assert.deepEqual([event.args.sessionId, event.args.by], [a, keeper.address]);
  assert.equal(Number(await jackpot.reviewOf(a)), 1);
  assert.equal(await jackpot.adminReviewed(a), false);
  await mined(jackpot.connect(keeper).clear(a)); // idempotent from a keeper-set clear
  const flagged = await mined(jackpot.connect(keeper).flag(a, b32('screen-hold')));
  const [flagEvent] = eventsOf(flagged, 'Flagged');
  assert.deepEqual([Number(flagEvent.args.week), flagEvent.args.sessionId, ethers.decodeBytes32String(flagEvent.args.reason), flagEvent.args.by], [W, a, 'screen-hold', keeper.address]);
  assert.equal(Number(await jackpot.reviewOf(a)), 2);
  assert.equal(ethers.decodeBytes32String(await jackpot.reviewReason(a)), 'screen-hold');
  await expectRevert(jackpot.connect(keeper).clear(a), 'REVIEW_LOCKED');
  await expectRevert(jackpot.connect(keeper).flag(a, b32('integrity')), 'REVIEW_LOCKED');
  // A pause stops keeper clears only.
  await mined(jackpot.connect(admin).pause());
  await expectRevert(jackpot.connect(keeper).clear(b), 'PAUSED');
  await mined(jackpot.connect(admin).unpause());
  await mined(jackpot.connect(keeper).clear(b));
  // adminClearOnly (week W + 1): the keeper can flag but never clear; the admin can clear.
  const c = await playRun(p3, { score: 700n, openAt: start(W + 1) + HOUR });
  const d = await playRun(p4, { score: 600n });
  await expectRevert(jackpot.connect(keeper).clear(c), 'REVIEW_LOCKED');
  await mined(jackpot.connect(keeper).flag(d, b32('screen-hold')));
  await mined(jackpot.connect(admin).clear(c));
  assert.equal(Number(await jackpot.reviewOf(c)), 1);
  assert.equal(await jackpot.adminReviewed(c), true);
  await expectRevert(jackpot.connect(keeper).clear(ethers.id('unknown')), 'NOT_PAID');
});

test('keeper cannot clear or flag a session the admin reviewed, and nobody flags a disqualified one', async () => {
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  const b = await playRun(p2, { score: 800n });
  const c = await playRun(p3, { score: 700n });
  const d = await playRun(p4, { score: 600n });
  await mined(jackpot.connect(admin).clear(a));
  assert.equal(await jackpot.adminReviewed(a), true);
  await expectRevert(jackpot.connect(keeper).flag(a, b32('screen-hold')), 'REVIEW_LOCKED');
  await expectRevert(jackpot.connect(keeper).clear(a), 'REVIEW_LOCKED');
  await mined(jackpot.connect(admin).flag(b, b32('late-evidence')));
  await expectRevert(jackpot.connect(keeper).clear(b), 'REVIEW_LOCKED');
  await expectRevert(jackpot.connect(keeper).flag(b, b32('integrity')), 'REVIEW_LOCKED');
  // The lock is per session, not per week.
  await mined(jackpot.connect(keeper).clear(c));
  await mined(jackpot.connect(keeper).flag(c, b32('integrity')));
  // The admin can change its own decisions (clear after flag), but nobody flags a disqualified session.
  await mined(jackpot.connect(admin).clear(b));
  await mined(jackpot.connect(admin).disqualify(d, false, b32('integrity')));
  await expectRevert(jackpot.connect(admin).flag(d, b32('other')), 'DISQUALIFIED');
  await expectRevert(jackpot.connect(keeper).flag(d, b32('other')), 'DISQUALIFIED');
  await expectRevert(jackpot.connect(admin).clear(d), 'DISQUALIFIED');
  await expectRevert(jackpot.connect(keeper).clear(d), 'REVIEW_LOCKED');
  await mined(jackpot.connect(admin).reinstate(d));
  assert.equal(Number(await jackpot.reviewOf(d)), 0);
  assert.equal(await jackpot.adminReviewed(d), true, 'a reinstated session stays admin-reviewed');
  await expectRevert(jackpot.connect(keeper).clear(d), 'REVIEW_LOCKED');
  await mined(jackpot.connect(admin).clear(d));
});

test('admin disqualify removes the candidate and promotes the next', async () => {
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  const b = await playRun(p2, { score: 800n });
  const c = await playRun(p3, { score: 700n });
  const c2 = await playRun(p3, { score: 100n });
  const e = await playRun(p4, { score: 650n });
  for (const id of [a, b, c]) {
    await expectSubmit(id, '');
    await mined(jackpot.connect(keeper).clear(id));
  }
  assert.equal((await jackpot.leaderOf(W)).sessionId, a);
  await expectRevert(jackpot.connect(p1).disqualify(a, false, b32('automation')), 'ONLY_ADMIN');
  const receipt = await mined(jackpot.connect(admin).disqualify(a, false, b32('automation')));
  const events = eventsOf(receipt);
  assert.deepEqual(events.map((event) => event.name), ['CandidateRemoved', 'Disqualified']);
  assert.deepEqual([events[0].args.sessionId, ethers.decodeBytes32String(events[0].args.reason)], [a, 'disqualified']);
  assert.deepEqual([Number(events[1].args.week), events[1].args.sessionId, events[1].args.player, events[1].args.wholeWalletForWeek, ethers.decodeBytes32String(events[1].args.reason)], [W, a, p1.address, false, 'automation']);
  assert.deepEqual(await listOf(W), [b, c]);
  const leader = await jackpot.leaderOf(W);
  assert.deepEqual([leader.sessionId, leader.player, Number(leader.review)], [b, p2.address, 1]);
  assert.deepEqual([Number(await jackpot.reviewOf(a)), await jackpot.adminReviewed(a)], [3, true]);
  // wholeWalletForWeek on an unlisted session of p3 also removes p3's listed row.
  const whole = await mined(jackpot.connect(admin).disqualify(c2, true, b32('multi-wallet')));
  assert.deepEqual(eventsOf(whole, 'CandidateRemoved').map((event) => event.args.sessionId), [c]);
  assert.equal(await jackpot.walletDisqualified(W, p3.address), true);
  assert.deepEqual(await listOf(W), [b]);
  // A session can be disqualified before it is ever submitted.
  await mined(jackpot.connect(admin).disqualify(e, false, b32('rules')));
  await expectSubmit(e, 'DISQUALIFIED');
  await fund(W, 1_000n * TOKEN);
  await at(payoutAt(W));
  const finalized = await mined(jackpot.connect(p4).finalize(W));
  const [paid] = eventsOf(finalized, 'Finalized');
  assert.deepEqual([paid.args.winner, paid.args.sessionId, paid.args.prize], [p2.address, b, 1_000n * TOKEN]);
  await expectRevert(jackpot.connect(admin).disqualify(b, false, b32('other')), 'WEEK_SETTLED');
});

test('a displaced session can be re-listed after the window until two hours before payout', async () => {
  const honest = [];
  const players = [p1, p2, p3, p4, extra[0]];
  for (const [index, player] of players.entries()) {
    honest.push(await playRun(player, { score: BigInt(500 - index * 100), openAt: index === 0 ? start(W) + HOUR : null }));
  }
  const decoyA = await playRun(extra[1], { score: 1_000n });
  const decoyB = await playRun(extra[2], { score: 1_001n });
  const neverListed = await playRun(extra[3], { score: 60n });
  for (const id of honest) await expectSubmit(id, '');
  await mined(jackpot.connect(keeper).clear(honest[4]));
  await mined(jackpot.connect(keeper).clear(honest[3]));
  await at(close(W) + 11 * HOUR);
  await expectSubmit(decoyA, '');
  await expectSubmit(decoyB, '');
  assert.deepEqual(await listOf(W), [decoyB, decoyA, ...honest.slice(0, 3)]);
  await at(close(W) + 13 * HOUR);
  // While the list is full, a displaced row does not rank high enough to return.
  await expectSubmit(honest[3], 'NOT_IN_TOP');
  await mined(jackpot.connect(admin).disqualify(decoyA, true, b32('automation')));
  await mined(jackpot.connect(admin).disqualify(decoyB, true, b32('automation')));
  await expectSubmit(decoyA, 'DISQUALIFIED'); // listed once, but disqualified: it never returns
  // After the window only a session that was listed may return; a new one may not, even into a free slot.
  await expectSubmit(neverListed, 'WINDOW_CLOSED');
  await expectSubmit(honest[3], '');
  assert.equal(Number(await jackpot.reviewOf(honest[3])), 1, 'it returns with its clear');
  // The last re-list is possible until payoutAt - 2 h.
  await at(payoutAt(W) - 2 * HOUR - 1);
  assert.equal((await eligibility(honest[4])).reason, '');
  await nextAt(payoutAt(W) - 2 * HOUR);
  await expectRevert(jackpot.connect(p4).submitCandidate(honest[4]), 'WINDOW_CLOSED');
  await at(payoutAt(W) - 2 * HOUR);
  assert.equal((await eligibility(honest[4])).reason, 'WINDOW_CLOSED');
});

test('five decoys displace the honest list, the admin disqualifies them, and the honest leader is re-listed and paid', async () => {
  const honestPlayers = [p1, p2, p3, p4, extra[0]];
  const decoyPlayers = extra.slice(1, 6);
  const honest = [];
  for (const [index, player] of honestPlayers.entries()) {
    honest.push(await playRun(player, { score: BigInt(1_000 - index * 100), openAt: index === 0 ? start(W) + HOUR : null }));
  }
  await fund(W, 1_000n * TOKEN);
  // The decoy sessions are opened late in the week and settled just before the C + 6 h cutoff.
  const decoys = [];
  for (const [index, player] of decoyPlayers.entries()) decoys.push(await openRun(player, { openAt: index === 0 ? close(W) - HOUR : null }));
  await at(close(W) + 2 * HOUR);
  for (const id of honest) {
    await expectSubmit(id, '', { from: keeper });
    await mined(jackpot.connect(keeper).clear(id));
  }
  for (const [index, player] of decoyPlayers.entries()) {
    await settleRun(player, decoys[index], { score: BigInt(2_000 - index * 100), settleAt: index === 0 ? close(W) + 5 * HOUR : null });
  }
  // C + 11 h 59 min: the five decoys push every honest row out.
  await at(close(W) + 11 * HOUR + 59 * 60);
  for (const id of decoys) await expectSubmit(id, '', { from: extra[6] });
  assert.deepEqual(await listOf(W), decoys);
  await at(close(W) + 12 * HOUR + 5 * 60);
  for (const id of decoys) await mined(jackpot.connect(keeper).flag(id, b32('screen-hold')));
  for (const id of decoys) await mined(jackpot.connect(admin).disqualify(id, true, b32('automation')));
  assert.deepEqual(await listOf(W), []);
  // The keeper (or anyone) re-lists the displaced honest rows; the decoys cannot come back.
  for (const id of honest) await expectSubmit(id, '', { from: keeper });
  for (const id of decoys) await expectSubmit(id, 'DISQUALIFIED');
  assert.deepEqual(await listOf(W), honest);
  await at(payoutAt(W));
  const balanceBefore = await token.balanceOf(p1.address);
  const receipt = await mined(jackpot.connect(extra[7]).finalize(W));
  const [finalized] = eventsOf(receipt, 'Finalized');
  assert.deepEqual([finalized.args.winner, finalized.args.sessionId, finalized.args.prize], [p1.address, honest[0], 1_000n * TOKEN]);
  assert.equal(await token.balanceOf(p1.address), balanceBefore + 1_000n * TOKEN);
});

test('blocking listed wallets keeps their slots; disqualifying the whole wallet frees them for the honest run', async () => {
  // setBlocked never touches a list (finalize skips blocked rows, design §A.8). Against listed decoys the admin
  // disqualifies with wholeWalletForWeek, which removes the rows, and then blocks.
  const honest = await playRun(p1, { score: 100n, openAt: start(W) + HOUR });
  const decoyPlayers = [p2, p3, p4, extra[0], extra[1]];
  const decoys = [];
  for (const [index, player] of decoyPlayers.entries()) decoys.push(await playRun(player, { score: BigInt(1_000 + index) }));
  await fund(W, 500n * TOKEN);
  await expectSubmit(honest, '', { from: keeper });
  await mined(jackpot.connect(keeper).clear(honest));
  for (const id of decoys) await expectSubmit(id, '', { from: keeper });
  assert.equal((await listOf(W)).includes(honest), false, 'the decoys displaced the honest run');
  await at(close(W) + 13 * HOUR);
  for (const player of decoyPlayers) await mined(jackpot.connect(admin).setBlocked(player.address, true, b32('cheating')));
  // Blocked rows keep their slots: finalize would skip all five and roll the pot over, and nothing can enter.
  assert.equal((await listOf(W)).length, 5);
  assert.equal((await jackpot.leaderOf(W)).sessionId, ethers.ZeroHash, 'every listed row is skipped');
  await expectSubmit(honest, 'NOT_IN_TOP', { from: keeper });
  await expectRevert(jackpot.connect(admin).adminSubmit(honest), 'LIST_FULL');
  // wholeWalletForWeek disqualifications free the slots; the honest run is re-listed with its clear and paid.
  for (const id of decoys) await mined(jackpot.connect(admin).disqualify(id, true, b32('multi-wallet')));
  assert.deepEqual(await listOf(W), []);
  await expectSubmit(honest, '', { from: keeper });
  assert.equal(Number(await jackpot.reviewOf(honest)), 1, 'it returns with its clear');
  await at(payoutAt(W));
  const receipt = await mined(jackpot.connect(keeper).finalize(W));
  const [finalized] = eventsOf(receipt, 'Finalized');
  assert.deepEqual([finalized.args.winner, finalized.args.sessionId, finalized.args.prize], [p1.address, honest, 500n * TOKEN]);
});

test('adminSubmit fills a short list after the window and cannot displace anyone', async () => {
  const players = [p1, p2, p3, p4, extra[0], extra[1], extra[3]];
  const ids = [];
  for (const [index, player] of players.entries()) {
    ids.push(await playRun(player, { score: index < 6 ? BigInt(600 - index * 100) : 50n, openAt: index === 0 ? start(W) + HOUR : null }));
  }
  const late = await openRun(extra[2]);
  for (const id of ids.slice(0, 5)) await expectSubmit(id, '');
  await settleRun(extra[2], late, { score: 5_000n, settleAt: close(W) + 7 * HOUR });
  await at(close(W) + 13 * HOUR);
  await expectRevert(jackpot.connect(p1).adminSubmit(ids[5]), 'ONLY_ADMIN');
  await expectRevert(jackpot.connect(admin).adminSubmit(ids[5]), 'LIST_FULL');
  await mined(jackpot.connect(admin).disqualify(ids[0], false, b32('integrity')));
  await expectSubmit(ids[5], 'WINDOW_CLOSED');
  // SETTLED_LATE still applies at the week's cutoff.
  await expectRevert(jackpot.connect(admin).adminSubmit(late), 'SETTLED_LATE');
  const receipt = await mined(jackpot.connect(admin).adminSubmit(ids[5]));
  const [submitted] = eventsOf(receipt, 'CandidateSubmitted');
  assert.deepEqual([submitted.args.sessionId, submitted.args.submitter, Number(submitted.args.rank)], [ids[5], admin.address, 5]);
  assert.deepEqual(eventsOf(receipt, 'CandidateRemoved'), [], 'nobody was displaced');
  assert.deepEqual(await listOf(W), ids.slice(1, 6));
  await expectRevert(jackpot.connect(admin).adminSubmit(ids[0]), 'LIST_FULL');
  // After payoutAt only a held week still accepts adminSubmit.
  await mined(jackpot.connect(admin).disqualify(ids[1], false, b32('integrity')));
  await at(payoutAt(W));
  await expectRevert(jackpot.connect(admin).adminSubmit(ids[6]), 'TOO_LATE');
  await mined(jackpot.connect(admin).holdWeek(W, b32('investigation')));
  await mined(jackpot.connect(admin).adminSubmit(ids[6]));
  assert.deepEqual(await listOf(W), ids.slice(2, 7));
});

test('reinstate re-inserts only a session that was listed', async () => {
  const a = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  const b = await playRun(p2, { score: 800n });
  const b2 = await playRun(p2, { score: 10n });
  await expectSubmit(a, '');
  await mined(jackpot.connect(keeper).clear(a));
  await mined(jackpot.connect(admin).disqualify(a, true, b32('integrity')));
  assert.deepEqual(await listOf(W), []);
  await expectRevert(jackpot.connect(p1).reinstate(a), 'ONLY_ADMIN');
  const receipt = await mined(jackpot.connect(admin).reinstate(a));
  assert.deepEqual(eventsOf(receipt).map((event) => event.name), ['Reinstated', 'CandidateSubmitted', 'LeaderChanged']);
  const [submitted] = eventsOf(receipt, 'CandidateSubmitted');
  assert.equal(submitted.args.submitter, admin.address);
  assert.deepEqual(await listOf(W), [a]);
  assert.deepEqual([Number(await jackpot.reviewOf(a)), await jackpot.adminReviewed(a), await jackpot.walletDisqualified(W, p1.address)], [0, true, false]);
  // A session that was never listed is only reset, never inserted (nor is the wallet's other session).
  await mined(jackpot.connect(admin).disqualify(b2, true, b32('multi-wallet')));
  await expectSubmit(b, 'DISQUALIFIED');
  const reset = await mined(jackpot.connect(admin).reinstate(b2));
  assert.deepEqual(eventsOf(reset).map((event) => event.name), ['Reinstated']);
  assert.deepEqual(await listOf(W), [a]);
  assert.equal(await jackpot.walletDisqualified(W, p2.address), false);
  // After the window a never-listed session enters only through adminSubmit.
  await at(close(W) + 13 * HOUR);
  await expectSubmit(b, 'WINDOW_CLOSED');
  // A listed session disqualified after the window comes back with reinstate, which skips the window check.
  await mined(jackpot.connect(admin).disqualify(a, false, b32('integrity')));
  await mined(jackpot.connect(admin).reinstate(a));
  assert.deepEqual(await listOf(W), [a]);
  await at(payoutAt(W));
  await expectRevert(jackpot.connect(admin).reinstate(a), 'TOO_LATE');
  await mined(jackpot.connect(admin).holdWeek(W, b32('investigation')));
  await mined(jackpot.connect(admin).reinstate(a));
});

test('firstWeek must be after the deploy week', async () => {
  const artifact = loadArtifact('WeeklyJackpot');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, operator);
  const current = weekIndexOf(await chain.latestTimestamp());
  const tokenAddress = await token.getAddress();
  const make = (firstWeek, overrides = {}) => factory.deploy(
    overrides.gameId ?? chikunId,
    overrides.token ?? tokenAddress,
    suite.addresses.scoreSubmissionRegistry,
    suite.addresses.arcadeRankedEntry,
    firstWeek,
    operator.address,
    overrides.admin ?? admin.address,
    keeper.address,
    admin.address,
    overrides.rules ?? baseRules(),
  );
  await expectRevert(make(current), 'BAD_WEEK');
  await expectRevert(make(current - 1), 'BAD_WEEK');
  await expectRevert(make(current + 1, { gameId: ethers.ZeroHash }), 'EMPTY_GAME_ID');
  await expectRevert(make(current + 1, { token: ethers.ZeroAddress }), 'ZERO_ADDRESS');
  await expectRevert(make(current + 1, { admin: ethers.ZeroAddress }), 'ZERO_ADDRESS');
  await expectRevert(make(current + 1, { rules: { ...baseRules(), seasonId: ethers.ZeroHash } }), 'BAD_RULES');
  const deployed = await make(current + 1);
  await deployed.waitForDeployment();
  assert.equal(Number(await deployed.firstWeek()), current + 1);
  assert.equal(Number((await deployed.rulesAt(0)).fromWeek), current + 1, 'the initial epoch starts at firstWeek');
  // A run opened in the deploy week can never win on that instance.
  const early = await playRun(p1, { score: 5_000n });
  assert.equal((await eligibility(early, deployed)).reason, 'BEFORE_FIRST_WEEK');
});

test('any address that ever held a role is ineligible forever and finalize skips it publicly', async () => {
  const lead = await playRun(p1, { score: 900n, openAt: start(W) + HOUR });
  const second = await playRun(p2, { score: 800n });
  const third = await playRun(p3, { score: 700n });
  for (const id of [lead, second, third]) {
    await expectSubmit(id, '');
    await mined(jackpot.connect(keeper).clear(id));
  }
  // p1 becomes the keeper for a moment: it is staff forever, even after it is replaced.
  await mined(jackpot.connect(operator).setKeeper(p1.address));
  await mined(jackpot.connect(operator).setKeeper(keeper.address));
  assert.equal(await jackpot.staffEver(p1.address), true);
  const again = await playRun(p1, { score: 1_000n });
  await expectSubmit(again, 'STAFF_WALLET');
  await mined(jackpot.connect(admin).setBlocked(p2.address, true, b32('test-wallet')));
  const leader = await jackpot.leaderOf(W);
  assert.deepEqual([leader.sessionId, leader.player], [third, p3.address], 'leaderOf applies the finalize skip rules');
  await fund(W, 500n * TOKEN);
  await at(payoutAt(W));
  const receipt = await mined(jackpot.connect(p4).finalize(W));
  const events = eventsOf(receipt);
  assert.deepEqual(events.map((event) => event.name), ['CandidateSkipped', 'CandidateSkipped', 'Finalized']);
  assert.deepEqual(events.slice(0, 2).map((event) => [event.args.sessionId, ethers.decodeBytes32String(event.args.reason)]), [[lead, 'staff'], [second, 'blocked']]);
  assert.deepEqual([events[2].args.winner, events[2].args.sessionId, events[2].args.score, events[2].args.prize], [p3.address, third, 700n, 500n * TOKEN]);
  const state = await jackpot.weekState(W);
  assert.deepEqual([Number(state.status), state.winner, state.winningSession, state.prize, state.unclaimed], [1, p3.address, third, 500n * TOKEN, 0n]);
});

test('rule epochs are bounded in number and horizon', async () => {
  const base = baseRules();
  await at(start(W) + HOUR);
  await expectRevert(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: W + 9 }), 'RULES_TOO_FAR');
  const model = [{ fromWeek: W, cap: 0n }];
  const schedule = async (fromWeek, cap) => {
    await mined(jackpot.connect(operator).scheduleRules({ ...base, fromWeek, maxPrizeWei: cap }));
    while (model.length && model[model.length - 1].fromWeek >= fromWeek) model.pop();
    model.push({ fromWeek, cap });
  };
  for (let offset = 1; offset <= 8; offset += 1) await schedule(W + offset, BigInt(offset));
  assert.equal(await jackpot.rulesCount(), 9n, 'eight pending epochs are allowed');
  await schedule(W + 3, 33n);
  assert.equal(await jackpot.rulesCount(), 4n, 're-scheduling W + 3 popped W + 3 .. W + 8');
  // Weeks pass and epochs accumulate; rulesFor stays a binary search over all of them.
  for (let offset = 1; offset <= 12; offset += 1) {
    await at(start(W + offset) + HOUR);
    await schedule(W + offset + 8, 100n + BigInt(offset));
    const current = W + offset;
    const pending = model.filter((epoch) => epoch.fromWeek > current).length;
    assert.ok(pending <= 8, `at most MAX_PENDING_EPOCHS pending (${pending})`);
    await expectRevert(jackpot.connect(operator).scheduleRules({ ...base, fromWeek: current + 9 }), 'RULES_TOO_FAR');
  }
  assert.equal(Number(await jackpot.rulesCount()), model.length);
  for (let week = W - 1; week <= W + 22; week += 1) {
    const expected = [...model].reverse().find((epoch) => epoch.fromWeek <= week) ?? model[0];
    assert.equal((await jackpot.rulesFor(week)).maxPrizeWei, expected.cap, `rulesFor(${week})`);
  }
});

test('funding below minFundWei is refused and no funding can block scheduleEnd', async () => {
  await at(start(W) + HOUR);
  await mined(token.connect(funder).approve(await jackpot.getAddress(), 10_000n * TOKEN));
  await expectRevert(jackpot.connect(funder).fund(W, 99n * TOKEN), 'BELOW_MIN_FUND');
  await expectRevert(jackpot.connect(funder).fund(W + 8, 1n), 'BELOW_MIN_FUND');
  await mined(jackpot.connect(funder).fund(W + 8, MIN_FUND)); // exactly the minimum, as far ahead as allowed
  await expectRevert(jackpot.connect(p1).scheduleEnd(W + 1), 'Only platform operator');
  await expectRevert(jackpot.connect(operator).scheduleEnd(W), 'END_TOO_SOON');
  const receipt = await mined(jackpot.connect(operator).scheduleEnd(W + 1));
  assert.equal(Number(eventsOf(receipt, 'EndScheduled')[0].args.lastWeek), W + 1);
  assert.equal(Number(await jackpot.endAfterWeek()), W + 1);
  await expectRevert(jackpot.connect(funder).fund(W + 2, MIN_FUND), 'FUNDED_AFTER_END');
  await mined(jackpot.connect(funder).fund(W + 1, MIN_FUND));
  await expectRevert(jackpot.connect(p1).cancelEnd(), 'Only platform operator');
  assert.equal(eventsOf(await mined(jackpot.connect(operator).cancelEnd()), 'EndCancelled').length, 1);
  assert.equal(Number(await jackpot.endAfterWeek()), 0);
  await mined(jackpot.connect(funder).fund(W + 2, MIN_FUND));
  await mined(jackpot.connect(operator).scheduleEnd(W + 1));
  // Once the last week is over, the end is final.
  await at(start(W + 2) + 1);
  await expectRevert(jackpot.connect(operator).cancelEnd(), 'END_FINAL');
  await expectRevert(jackpot.connect(operator).scheduleEnd(W + 5), 'END_FINAL');
  await expectRevert(jackpot.connect(funder).fund(W + 2, MIN_FUND), 'FUNDED_AFTER_END');
});

test('a fund meets the minFundWei of the week it funds, not of the current week', async () => {
  await at(start(W) + HOUR);
  await mined(jackpot.connect(operator).scheduleRules({ ...baseRules(), fromWeek: W + 1, minFundWei: 150n * TOKEN }));
  await mined(token.connect(funder).approve(await jackpot.getAddress(), 10_000n * TOKEN));
  await expectRevert(jackpot.connect(funder).fund(W + 1, 120n * TOKEN), 'BELOW_MIN_FUND');
  await expectRevert(jackpot.connect(funder).fund(W + 8, 149n * TOKEN), 'BELOW_MIN_FUND');
  await mined(jackpot.connect(funder).fund(W, 120n * TOKEN)); // the current week keeps its 100 minimum
  await mined(jackpot.connect(funder).fund(W + 1, 150n * TOKEN));
  assert.deepEqual([(await jackpot.potOf(W)).funded, (await jackpot.potOf(W + 1)).funded], [120n * TOKEN, 150n * TOKEN]);
});

test('role checks use the house revert strings', async () => {
  await at(start(W) + HOUR);
  const id = await playRun(p1, { score: 10n });
  const rules = { ...baseRules(), fromWeek: W + 1 };
  const tokenAddress = await token.getAddress();
  const operatorOnly = [
    (c) => c.transferOperator(p1.address), (c) => c.setKeeper(p1.address), (c) => c.operatorPause(), (c) => c.operatorUnpause(),
    (c) => c.forceAdmin(p1.address), (c) => c.scheduleRules(rules), (c) => c.scheduleEnd(W + 2), (c) => c.cancelEnd(),
    (c) => c.recoverResidual(), (c) => c.sweepStray(tokenAddress),
  ];
  const adminOnly = [
    (c) => c.pause(), (c) => c.unpause(), (c) => c.transferAdmin(p1.address), (c) => c.disqualify(id, false, b32('other')),
    (c) => c.reinstate(id), (c) => c.adminSubmit(id), (c) => c.setBlocked(p1.address, true, b32('other')),
    (c) => c.holdWeek(W, b32('investigation')), (c) => c.releaseWeek(W), (c) => c.extendWeek(W, 1),
  ];
  for (const caller of [admin, keeper, p1]) {
    for (const call of operatorOnly) await expectRevert(call(jackpot.connect(caller)), 'Only platform operator');
  }
  for (const caller of [operator, keeper, p1]) {
    for (const call of adminOnly) await expectRevert(call(jackpot.connect(caller)), 'ONLY_ADMIN');
  }
  for (const caller of [operator, p1]) {
    await expectRevert(jackpot.connect(caller).clear(id), 'ONLY_KEEPER');
    await expectRevert(jackpot.connect(caller).flag(id, b32('other')), 'ONLY_KEEPER');
  }
  await expectRevert(jackpot.connect(p1).acceptOperator(), 'Only pending operator');
  await expectRevert(jackpot.connect(p1).acceptAdmin(), 'ONLY_PENDING_ADMIN');
  await expectRevert(jackpot.connect(p1).claim(W, p1.address), 'ONLY_WINNER');
  await expectRevert(jackpot.connect(operator).nominateResidualRecipient(p1.address), 'ONLY_RESIDUAL_RECIPIENT');
  await expectRevert(jackpot.connect(p1).acceptResidualRecipient(), 'ONLY_RESIDUAL_RECIPIENT');
});

test('operator and admin transfers are two-step', async () => {
  await expectRevert(jackpot.connect(operator).transferOperator(ethers.ZeroAddress), 'ZERO_ADDRESS');
  const started = await mined(jackpot.connect(operator).transferOperator(p1.address));
  const [startEvent] = eventsOf(started, 'OperatorTransferStarted');
  assert.deepEqual([startEvent.args.current, startEvent.args.pending], [operator.address, p1.address]);
  assert.equal(await jackpot.operator(), operator.address, 'nothing changes before acceptOperator');
  assert.equal(await jackpot.pendingOperator(), p1.address);
  await expectRevert(jackpot.connect(p2).acceptOperator(), 'Only pending operator');
  const accepted = await mined(jackpot.connect(p1).acceptOperator());
  const [doneEvent] = eventsOf(accepted, 'OperatorTransferred');
  assert.deepEqual([doneEvent.args.previous, doneEvent.args.current], [operator.address, p1.address]);
  assert.deepEqual([await jackpot.operator(), await jackpot.pendingOperator(), await jackpot.staffEver(p1.address)], [p1.address, ethers.ZeroAddress, true]);
  await expectRevert(jackpot.connect(operator).operatorPause(), 'Only platform operator');
  await mined(jackpot.connect(p1).operatorPause());
  await mined(jackpot.connect(p1).operatorUnpause());

  await expectRevert(jackpot.connect(admin).transferAdmin(ethers.ZeroAddress), 'ZERO_ADDRESS');
  await expectRevert(jackpot.connect(p1).forceAdmin(ethers.ZeroAddress), 'ZERO_ADDRESS');
  const adminStarted = await mined(jackpot.connect(admin).transferAdmin(p2.address));
  const [adminStart] = eventsOf(adminStarted, 'AdminTransferStarted');
  assert.deepEqual([adminStart.args.current, adminStart.args.pending], [admin.address, p2.address]);
  assert.equal(await jackpot.admin(), admin.address);
  await expectRevert(jackpot.connect(p3).acceptAdmin(), 'ONLY_PENDING_ADMIN');
  const adminAccepted = await mined(jackpot.connect(p2).acceptAdmin());
  const [adminDone] = eventsOf(adminAccepted, 'AdminTransferred');
  assert.deepEqual([adminDone.args.previous, adminDone.args.current], [admin.address, p2.address]);
  assert.deepEqual([await jackpot.admin(), await jackpot.pendingAdmin(), await jackpot.staffEver(p2.address)], [p2.address, ethers.ZeroAddress, true]);
  await expectRevert(jackpot.connect(admin).pause(), 'ONLY_ADMIN');
  await mined(jackpot.connect(p2).pause());
  assert.equal(await jackpot.staffEver(admin.address), true, 'the previous admin stays staff');
});

test('a compromised admin cannot lift an operator pause or resist forceAdmin', async () => {
  // The compromised admin starts moving the role to its own wallet; the operator stops it.
  await mined(jackpot.connect(admin).transferAdmin(p4.address));
  const paused = await mined(jackpot.connect(operator).operatorPause());
  const [pausedEvent] = eventsOf(paused, 'Paused');
  assert.deepEqual([pausedEvent.args.by, pausedEvent.args.isOperator], [operator.address, true]);
  assert.deepEqual([await jackpot.paused(), await jackpot.operatorPaused(), await jackpot.adminPaused()], [true, true, false]);
  const unpaused = await mined(jackpot.connect(admin).unpause());
  assert.deepEqual(eventsOf(unpaused, 'Unpaused').map((event) => [event.args.by, event.args.isOperator]), [[admin.address, false]]);
  assert.equal(await jackpot.paused(), true, "the admin's unpause cannot lift the operator's pause");
  await expectRevert(jackpot.connect(p4).acceptAdmin(), 'OPERATOR_LOCK');
  await expectRevert(jackpot.connect(admin).transferAdmin(p4.address), 'OPERATOR_LOCK');
  const forced = await mined(jackpot.connect(operator).forceAdmin(p1.address));
  const [forcedEvent] = eventsOf(forced, 'AdminTransferred');
  assert.deepEqual([forcedEvent.args.previous, forcedEvent.args.current], [admin.address, p1.address]);
  assert.deepEqual([await jackpot.admin(), await jackpot.pendingAdmin(), await jackpot.staffEver(p1.address)], [p1.address, ethers.ZeroAddress, true]);
  await expectRevert(jackpot.connect(admin).pause(), 'ONLY_ADMIN');
  await expectRevert(jackpot.connect(p4).acceptAdmin(), 'ONLY_PENDING_ADMIN');
  // The new admin reviews while payouts stay stopped; then the operator unpauses.
  await mined(jackpot.connect(p1).setBlocked(admin.address, true, b32('staff')));
  await fund(W, MIN_FUND);
  await at(payoutAt(W));
  await expectRevert(jackpot.connect(p2).finalize(W), 'PAUSED');
  await mined(jackpot.connect(operator).operatorUnpause());
  assert.equal(await jackpot.paused(), false);
  await mined(jackpot.connect(p2).finalize(W));
});
