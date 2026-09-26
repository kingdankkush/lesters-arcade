import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import { DAY, HOUR, MINUTE, TOKEN, startJackpotStack } from '../scripts/lib/jackpot-rehearsal-driver.mjs';
import { startLocalHttp } from '../scripts/lib/local-http.mjs';
import { serveJsonRpc } from '../scripts/lib/local-chain.mjs';
import { deployLocalJackpot, launchRules } from '../scripts/lib/local-jackpot.mjs';
import { writeLocalAddressModule } from '../scripts/lib/local-stack.mjs';
import { jackpotModuleValue, renderLitvmJackpotModule } from '../scripts/generate-litvm-jackpot.mjs';
import { JACKPOT_LIVE } from '../apps/portal/src/jackpot-config.mjs';
import {
  LIVE_CHECK_IDS, LIVE_DRY_RUN_SCHEMA, READ_ONLY_RPC_METHODS, ReadOnlyProvider, parseLiveDryRunArgs, potFromChain, runJackpotLiveDryRun, runLiveDryRunCli,
} from '../scripts/jackpot-live-dry-run.mjs';

/**
 * jackpot-rehearsal AC5: scripts/jackpot-live-dry-run.mjs against a local HTTP server (every api/*.mjs
 * handler plus apps/portal as the web root, scripts/lib/local-http.mjs) and the in-process chain served over
 * JSON-RPC, with a funded week paid by the real cron. It proves the tool only reads (every JSON-RPC method
 * it sends is recorded at the server, every HTTP request at the fetch), reports every check, passes on a
 * healthy stack, and fails on Ranked-setting drift (J17: fees off, a repointed rankedEntry, a reserve cut
 * below the server's settle floor), a stale deployment record, a missing block, an unexpected
 * JACKPOT_LIVE, an undeployed module, any unexpected pause (admin, operator, the env pause that silently
 * stops the keeper), a stale cron, the admin backlog, a low keeper, an unverifiable role history and an
 * unfunded week when funding is required; and it reads the previous week from the retired instance after
 * a migration. It is never pointed at LiteForge or production here. Keys: the public Hardhat test mnemonic
 * only.
 */

const PORTAL = fileURLToPath(new URL('../apps/portal', import.meta.url));
let js;
let http;
let rpc;
const methods = [];
const requests = [];
let paidWeek;

before(async () => {
  js = await startJackpotStack();
  // A week paid by the real cron, and the next one funded (the pots the tool compares).
  const week = js.claimWeek(await js.beginWeek());
  paidWeek = week;
  assert.ok((await js.fund(week, 500n * TOKEN)).ok);
  const player = await js.freshWallet('live-check player');
  await js.playRankedChikunRun({ player, openedAt: js.at(week, 'start', DAY), maxMinutes: 0.5 });
  await js.advanceTo(js.at(week, 'close', 2 * HOUR + MINUTE));
  await js.runJackpotCron(3);
  await js.advanceTo(js.at(week, 'settleCutoff', 11 * MINUTE));
  await js.runJackpotCron(2);
  await js.advanceTo(js.at(week, 'payoutAt', MINUTE));
  assert.ok((await js.cronUntil(async () => (await js.weekRow(week)).status === 'paid', { max: 4 })) !== null);
  assert.ok((await js.fund(week + 1, 300n * TOKEN)).ok);
  await js.runJackpotCron(1);
  rpc = await serveJsonRpc({ request: async (args) => { methods.push(args.method); return js.stack.chain.eip1193.request(args); } });
  http = await startLocalHttp(js.httpStack, { staticRoot: PORTAL });
});

after(async () => {
  await http?.close();
  await rpc?.close();
  await js?.close();
});

const recordingFetch = async (url, init = {}) => {
  requests.push({ method: String(init.method ?? 'GET').toUpperCase(), path: new URL(url).pathname });
  return fetch(url, init);
};

function dryRun(overrides = {}) {
  return runJackpotLiveDryRun({ site: http.origin, rpc: rpc.url, fetchImpl: recordingFetch, deployment: js.deployment, jackpotModule: js.module, record: js.jackpotRecord, expectLive: JACKPOT_LIVE, ...overrides });
}

const failed = (report) => report.checks.filter((check) => !check.ok).map((check) => check.id);
const checkOf = (report, id) => report.checks.find((check) => check.id === id);

test('the live dry run reads only, reports every check and catches Ranked-setting drift', async () => {
  methods.length = 0;
  requests.length = 0;
  const report = await dryRun();
  assert.equal(report.schema, LIVE_DRY_RUN_SCHEMA);
  assert.deepEqual(report.checks.map((check) => check.id), [...LIVE_CHECK_IDS], 'every check, in order');
  assert.equal(report.ok, true, JSON.stringify(report.checks.filter((check) => !check.ok), null, 1));
  // Read-only: the JSON-RPC server saw only read methods, the site only GETs.
  assert.ok(methods.length > 0 && methods.every((method) => READ_ONLY_RPC_METHODS.includes(method)), [...new Set(methods)].join());
  assert.ok(!methods.some((method) => /send|sign|mine|evm_|hardhat_/.test(method)));
  assert.deepEqual([...new Set(requests.map((entry) => entry.method))], ['GET']);
  assert.deepEqual(report.readOnly.httpMethods, ['GET']);
  assert.ok(report.readOnly.rpcMethods.every((method) => READ_ONLY_RPC_METHODS.includes(method)));
  assert.equal(report.rpcHost, new URL(rpc.url).host, 'only the RPC host is reported, never the URL');
  const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
  assert.equal(byId['pot-previous'].detail.api.prizeWei, (500n * TOKEN).toString(), 'the paid week compared with the chain');
  assert.equal(byId['pot-current'].detail.chain.fundedWei, (300n * TOKEN).toString());
  // The served flag is the committed one (false until runbook E10), and the rules page agrees with it.
  assert.equal(byId['jackpot-live-flag'].detail.served, JACKPOT_LIVE);
  assert.equal(byId['jackpot-live-flag'].detail.rulesPageNoindex, !JACKPOT_LIVE);

  // J17 drift 1: fees off makes the quote fall below minPaidWei (and below the server's settle floor).
  const entry = js.suite.rankedEntry.connect(js.wallets.operator);
  await (await entry.setEntryFeeEnabled(false)).wait();
  try {
    const feesOff = await dryRun();
    assert.deepEqual(failed(feesOff), ['j17-quote', 'j17-settle-floor'], JSON.stringify(feesOff.checks.find((check) => check.id === 'j17-quote')));
  } finally {
    await (await entry.setEntryFeeEnabled(true)).wait();
  }
  // J17 drift 2: the registry's rankedEntry is repointed.
  const scores = js.suite.scores.connect(js.wallets.operator);
  const original = await scores.rankedEntry();
  await (await scores.setRankedEntry(js.wallets.attacker.address)).wait();
  try {
    const repointed = await dryRun();
    assert.deepEqual(failed(repointed), ['j17-ranked-entry']);
  } finally {
    await (await scores.setRankedEntry(original)).wait();
  }
  // J17 drift 3: the reserve at 0 keeps the quote at the flat fee, still >= the jackpot's minPaidWei, but
  // below the server's settle floor (RANKED_MIN_PAID_WEI, default 0.102): /api/settle would refuse every
  // run paid at the new quote with 402 entry-underpaid (rehearsal R20), and only j17-settle-floor sees it.
  const reserve = await entry.settlementGasReserveWei();
  await (await entry.setSettlementGasReserve(0)).wait();
  try {
    const reserveZero = await dryRun();
    assert.deepEqual(failed(reserveZero), ['j17-settle-floor'], JSON.stringify(checkOf(reserveZero, 'j17-settle-floor')));
    const floor = checkOf(reserveZero, 'j17-settle-floor').detail;
    assert.deepEqual([checkOf(reserveZero, 'j17-quote').ok, floor.quoteTotalWei, floor.settleMinPaidWei], [true, (10n ** 17n).toString(), '102000000000000000']);
    // The same Monday step lowers the floor: green again.
    js.env.RANKED_MIN_PAID_WEI = (10n ** 17n).toString();
    assert.deepEqual(failed(await dryRun()), []);
  } finally {
    delete js.env.RANKED_MIN_PAID_WEI;
    await (await entry.setSettlementGasReserve(reserve)).wait();
  }
  assert.equal((await dryRun()).ok, true, 'restored');
});

test('any unexpected pause, a stale cron, the admin backlog, a low keeper and an unverified role history fail', async () => {
  // The admin's pause on chain (emergency stop 1): a failure unless --expect-paused true.
  assert.ok((await js.admin('pause')).ok);
  try {
    const paused = await dryRun();
    assert.deepEqual(failed(paused), ['pause']);
    assert.deepEqual(checkOf(paused, 'pause').detail.chain, { paused: true, adminPaused: true, operatorPaused: false });
    assert.deepEqual(failed(await dryRun({ expectPaused: true })), [], 'an intended pause passes with --expect-paused true');
  } finally {
    assert.ok((await js.admin('unpause')).ok);
  }
  // The operator's pause (the admin cannot lift it).
  assert.equal((await js.operatorAction('operator-pause')).receipts.length, 1);
  try {
    const paused = await dryRun();
    assert.deepEqual(failed(paused), ['pause']);
    assert.equal(checkOf(paused, 'pause').detail.chain.operatorPaused, true);
  } finally {
    assert.equal((await js.operatorAction('operator-unpause')).receipts.length, 1);
  }
  // The env pause (emergency stop 3) stops the keeper, yet every cron run answers 200 skipped and counts
  // as a success, so the cron looks fresh: both pause and cron-fresh fail.
  js.env.JACKPOT_PAUSED = 'true';
  try {
    const [skipped] = await js.runJackpotCron(1);
    assert.deepEqual([skipped.status, skipped.body.skipped], [200, 'jackpot-paused']);
    const stopped = await dryRun();
    assert.deepEqual(failed(stopped), ['pause', 'cron-fresh']);
    assert.equal(checkOf(stopped, 'pause').detail.health.env, true);
    assert.deepEqual(failed(await dryRun({ expectPaused: true })), []);
  } finally {
    delete js.env.JACKPOT_PAUSED;
  }
  await js.runJackpotCron(1);
  assert.deepEqual(failed(await dryRun({ expectPaused: true })), ['pause'], 'an expected pause that is not there fails too');
  assert.equal((await dryRun()).ok, true);

  // A stale cron: 21 minutes of chain time without a run.
  await js.advanceBy(21 * MINUTE);
  assert.deepEqual(failed(await dryRun()), ['cron-fresh']);
  await js.runJackpotCron(1);

  // The admin backlog: a week awaiting the admin for more than 24 h, one of unknown age, one claim-pending.
  const key = js.weekKey(paidWeek);
  const setWeek = (status, since) => js.db.query('UPDATE jackpot_weeks SET status = $1, admin_waiting_since = $2 WHERE contract = $3 AND week_key = $4', [status, since, js.address, key]);
  const hoursAgo = (hours) => new Date(js.nowMs() - hours * HOUR * 1000).toISOString();
  try {
    await setWeek('awaiting-admin', hoursAgo(25));
    assert.deepEqual(failed(await dryRun()), ['admin-backlog']);
    await setWeek('awaiting-admin', hoursAgo(23));
    assert.deepEqual(failed(await dryRun()), [], 'within the 24 h SLA');
    await setWeek('awaiting-admin', null);
    const unknownAge = await dryRun();
    assert.deepEqual(failed(unknownAge), ['admin-backlog'], 'a waiting week of unknown age is not within the SLA');
    assert.equal(checkOf(unknownAge, 'admin-backlog').detail.awaitingAdminOldestHours, null);
    await setWeek('claim-pending', null);
    assert.deepEqual(failed(await dryRun()), ['admin-backlog']);
  } finally {
    await setWeek('paid', null);
  }

  // A keeper below 0.05 zkLTC.
  const keeper = js.keeperWallet.address;
  const balance = await js.provider.getBalance(keeper);
  await js.provider.send('hardhat_setBalance', [keeper, ethers.toQuantity(4n * 10n ** 16n)]);
  try {
    assert.deepEqual(failed(await dryRun()), ['keeper-balance']);
  } finally {
    await js.provider.send('hardhat_setBalance', [keeper, ethers.toQuantity(balance)]);
  }

  // The role history: a range beyond the getLogs budget is unverified (a failure, never a skipped pass);
  // the previous run's scannedTo + 1 is the cursor, and a range with no role change since then passes.
  const full = checkOf(await dryRun(), 'staff-history');
  assert.ok(full.ok && full.detail.named.length >= 3 && Number.isSafeInteger(full.detail.scannedTo), JSON.stringify(full));
  const tight = await dryRun({ logChunkBlocks: 10, maxLogChunks: 1 });
  assert.deepEqual(failed(tight), ['staff-history']);
  assert.match(checkOf(tight, 'staff-history').detail.unverified, /needs \d+ getLogs calls \(limit 1\)/);
  const cursor = await dryRun({ logChunkBlocks: 10, maxLogChunks: 1, logsFrom: full.detail.scannedTo + 1 });
  assert.deepEqual(failed(cursor), []);
  assert.deepEqual(checkOf(cursor, 'staff-history').detail.named, [], 'no role change since the last run');
  // A role change after the cursor is seen and checked: the keeper rotated away and back.
  const spare = await js.freshWallet('live-check spare keeper');
  const original = js.keeperWallet.address;
  assert.equal((await js.operatorAction('set-keeper', { args: [spare.address] })).receipts.length, 1);
  assert.equal((await js.operatorAction('set-keeper', { args: [original] })).receipts.length, 1);
  const rotated = checkOf(await dryRun({ logChunkBlocks: 10, maxLogChunks: 1, logsFrom: full.detail.scannedTo + 1 }), 'staff-history');
  assert.ok(rotated.ok, JSON.stringify(rotated));
  assert.deepEqual(rotated.detail.named.map((entry) => entry.address).sort(), [spare.address.toLowerCase(), original.toLowerCase()].sort());
  assert.equal((await dryRun()).ok, true, 'restored');
});

test('it fails on a stale record, a missing block, an unexpected JACKPOT_LIVE and an undeployed module', async () => {
  const stale = structuredClone(js.jackpotRecord);
  stale.instances.chikun.admin = ethers.getAddress(js.wallets.player1.address);
  assert.deepEqual(failed(await dryRun({ record: stale })), ['roles']);
  assert.deepEqual(failed(await dryRun({ record: null })), ['immutables', 'roles']);
  assert.deepEqual(failed(await dryRun({ expectLive: !JACKPOT_LIVE })), ['jackpot-live-flag']);
  // E5: the verifier unblocked (and a named funder never blocked).
  const unblocked = await js.admin('unblock', { wallet: js.wallets.verifier.address, reason: 'other' });
  assert.ok(unblocked.ok);
  try {
    const report = await dryRun({ funders: [js.wallets.player2.address] });
    assert.deepEqual(failed(report), ['block-list']);
    const detail = report.checks.find((check) => check.id === 'block-list').detail;
    assert.deepEqual(detail.filter((row) => !row.blocked).map((row) => row.label), ['verifier', 'funder 1']);
  } finally {
    assert.ok((await js.admin('block', { wallet: js.wallets.verifier.address, reason: 'staff' })).ok);
  }
  const undeployed = await dryRun({ jackpotModule: jackpotModuleValue(null) });
  assert.equal(undeployed.ok, false);
  assert.equal(undeployed.checks.find((check) => check.id === 'jackpot-deployed').ok, false);
  assert.deepEqual(undeployed.checks.map((check) => check.id), [...LIVE_CHECK_IDS], 'still reports every check (not reached ones fail)');
});

test('the provider refuses writes, the CLI keeps overrides to a loopback RPC, and the pot math matches the API', async () => {
  const provider = new ReadOnlyProvider(rpc.url);
  try {
    await assert.rejects(provider.send('eth_sendRawTransaction', ['0x00']), (error) => error.code === 'READ_ONLY');
    await assert.rejects(provider.send('evm_mine', []), (error) => error.code === 'READ_ONLY');
    assert.equal(Number(BigInt(await provider.send('eth_chainId', []))), 4441);
  } finally {
    provider.destroy();
  }
  assert.equal(parseLiveDryRunArgs([]).ok, false);
  assert.match(parseLiveDryRunArgs(['--site', 'https://lestersarcade.io', '--deployment', 'x.mjs']).error, /loopback/);
  assert.match(parseLiveDryRunArgs(['--site', 'https://lestersarcade.io', '--expect-live', 'maybe']).error, /true or false/);
  assert.match(parseLiveDryRunArgs(['--site', 'https://lestersarcade.io', '--funder', 'nope']).error, /0x address/);
  assert.match(parseLiveDryRunArgs(['--site', 'https://lestersarcade.io', '--expect-paused', 'yes']).error, /true or false/);
  assert.match(parseLiveDryRunArgs(['--site', 'https://lestersarcade.io', '--logs-from', '-1']).error, /block number/);
  const parsed = parseLiveDryRunArgs(['--site', 'https://lestersarcade.io', '--expect-live', 'true', '--funder', js.wallets.player2.address]);
  assert.deepEqual([parsed.ok, parsed.rpc, parsed.expectLive, parsed.requireFunded, parsed.expectPaused, parsed.logsFrom, parsed.funders.length], [true, 'https://liteforge.rpc.caldera.xyz/http', true, false, false, null, 1]);
  const strict = parseLiveDryRunArgs(['--site', 'https://lestersarcade.io', '--require-funded', '--expect-paused', 'true', '--logs-from', '54300000']);
  assert.deepEqual([strict.ok, strict.requireFunded, strict.expectPaused, strict.logsFrom], [true, true, true, 54_300_000]);
  assert.deepEqual(potFromChain({ funded: 900n, carriedIn: 100n, total: 1000n }, { maxPrizeWei: '700', minFundWei: '100' }), {
    fundedWei: '900', carriedInWei: '100', totalWei: '1000', prizeCapWei: '700', prizeWei: '700', carryOverWei: '300', funded: true,
  });

  // The CLI end to end on the local stack: module and record files, loopback RPC only, JSON out, exit 0.
  const dir = mkdtempSync(join(tmpdir(), 'jackpot-live-dry-run-'));
  try {
    const rankedModule = writeLocalAddressModule(js.record, dir);
    const jackpotModulePath = join(dir, 'litvm-jackpot-local.mjs');
    writeFileSync(jackpotModulePath, renderLitvmJackpotModule(js.jackpotRecord), 'utf8');
    const recordPath = join(dir, 'deployment-record.jackpot.json');
    writeFileSync(recordPath, JSON.stringify(js.jackpotRecord), 'utf8');
    const lines = [];
    const code = await runLiveDryRunCli({
      argv: ['--site', http.origin, '--rpc', rpc.url, '--deployment', rankedModule, '--jackpot-module', jackpotModulePath, '--record', recordPath, '--expect-live', String(JACKPOT_LIVE), '--require-funded', '--json'],
      out: (line) => lines.push(line),
    });
    const printed = JSON.parse(lines.at(-1));
    assert.equal(code, 0, JSON.stringify(printed.checks.filter((check) => !check.ok)));
    assert.equal(printed.ok, true);
    assert.deepEqual(printed.expectations, { live: JACKPOT_LIVE, requireFunded: true, paused: false, logsFrom: null });
    assert.ok(!lines.join('\n').includes(rpc.url), 'the RPC URL is never printed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('after an instance migration the previous week is read from the retired instance; --require-funded fails an unfunded week', async () => {
  // The current week (funded 300 in before()) is the old instance's second-last; the next one its last.
  const current = js.currentWeek();
  const last = current + 1;
  assert.ok((await js.fund(last, 200n * TOKEN)).ok);
  assert.equal((await js.operatorAction('schedule-end', { args: [String(last)] })).receipts.length, 1);
  const oldAddress = js.address;
  const migrated = await deployLocalJackpot({
    provider: js.provider, wallets: js.wallets, record: js.record, admin: js.adminWallet.address, keeper: js.keeperWallet.address,
    rules: { ...launchRules(js.record), adminClearOnly: false }, retirePrevious: js.jackpotRecord, firstWeek: last + 1,
  });
  const firstNew = Number(migrated.record.instances.chikun.firstWeek);
  assert.equal(firstNew, last + 1);
  await js.useInstance({ record: migrated.record });
  // E5 on the new instance.
  for (const [wallet, reason] of [['0x8841ae6244dba71f620de450e71b0ef7e0cce824', 'test-wallet'], [js.wallets.verifier.address, 'staff'], [js.wallets.relayer.address, 'staff'], [js.wallets.funder.address, 'funder']]) {
    assert.ok((await js.admin('block', { wallet, reason })).ok);
  }
  // Into the new instance's first week. The old instance's second-last week is finalized after the end, so
  // its pot goes to the residue (never into the last week): the last week keeps its own 200.
  await js.advanceTo(js.at(firstNew, 'start', HOUR));
  assert.ok((await js.cronUntil(async () => (await js.weekRow(current, oldAddress))?.status === 'rolled', { max: 8 })) !== null);
  await js.runJackpotCron(1);
  const answer = await js.jackpotApi();
  assert.deepEqual([answer.api.contract, answer.api.previous?.weekKey, answer.api.previous?.contract, answer.api.previous?.pot.totalWei], [js.address, js.weekKey(last), oldAddress, (200n * TOKEN).toString()]);
  const report = await dryRun();
  assert.deepEqual(failed(report), [], JSON.stringify(report.checks.filter((check) => !check.ok)));
  const previous = checkOf(report, 'pot-previous');
  assert.deepEqual([previous.detail.contract, previous.detail.retired, previous.detail.chain.totalWei], [oldAddress, true, (200n * TOKEN).toString()], 'compared with the retired instance, not the new one');
  assert.equal(checkOf(report, 'code-retired').detail.instances, 1);
  // The new instance's first week is unfunded: a reported fact, a failure with --require-funded.
  assert.deepEqual([checkOf(report, 'pot-funded').ok, checkOf(report, 'pot-funded').detail.funded], [true, false]);
  assert.deepEqual(failed(await dryRun({ requireFunded: true })), ['pot-funded']);
  // The new instance has its own tCHIKUN: the operator mints the funder some, and the funder funds.
  assert.equal((await js.operatorAction('mint-test', { argv: ['--to', js.wallets.funder.address, '--amount', '1000'] })).receipts.length, 1);
  const funded = await js.fund(firstNew, 150n * TOKEN);
  assert.ok(funded.ok, funded.reason);
  await js.runJackpotCron(1);
  assert.deepEqual(failed(await dryRun({ requireFunded: true })), []);
});
