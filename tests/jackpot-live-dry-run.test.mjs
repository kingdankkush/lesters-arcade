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
 * healthy stack, and fails on Ranked-setting drift (J17: fees off, a repointed rankedEntry), a stale
 * deployment record, a missing block, an unexpected JACKPOT_LIVE and an undeployed module. It is never
 * pointed at LiteForge or production here. Keys: the public Hardhat test mnemonic only.
 */

const PORTAL = fileURLToPath(new URL('../apps/portal', import.meta.url));
let js;
let http;
let rpc;
const methods = [];
const requests = [];

before(async () => {
  js = await startJackpotStack();
  // A week paid by the real cron, and the next one funded (the pots the tool compares).
  const week = js.claimWeek(await js.beginWeek());
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

  // J17 drift 1: fees off makes the quote fall below minPaidWei.
  const entry = js.suite.rankedEntry.connect(js.wallets.operator);
  await (await entry.setEntryFeeEnabled(false)).wait();
  try {
    const feesOff = await dryRun();
    assert.deepEqual(failed(feesOff), ['j17-quote'], JSON.stringify(feesOff.checks.find((check) => check.id === 'j17-quote')));
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
  // The reserve at 0 keeps the quote at the flat fee, which is still >= minPaidWei (J17's launch floor).
  const reserve = await entry.settlementGasReserveWei();
  await (await entry.setSettlementGasReserve(0)).wait();
  try {
    assert.equal((await dryRun()).checks.find((check) => check.id === 'j17-quote').ok, true);
  } finally {
    await (await entry.setSettlementGasReserve(reserve)).wait();
  }
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
  const parsed = parseLiveDryRunArgs(['--site', 'https://lestersarcade.io', '--expect-live', 'true', '--funder', js.wallets.player2.address]);
  assert.deepEqual([parsed.ok, parsed.rpc, parsed.expectLive, parsed.funders.length], [true, 'https://liteforge.rpc.caldera.xyz/http', true, 1]);
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
      argv: ['--site', http.origin, '--rpc', rpc.url, '--deployment', rankedModule, '--jackpot-module', jackpotModulePath, '--record', recordPath, '--expect-live', String(JACKPOT_LIVE), '--json'],
      out: (line) => lines.push(line),
    });
    const printed = JSON.parse(lines.at(-1));
    assert.equal(code, 0, JSON.stringify(printed.checks.filter((check) => !check.ok)));
    assert.equal(printed.ok, true);
    assert.ok(!lines.join('\n').includes(rpc.url), 'the RPC URL is never printed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
