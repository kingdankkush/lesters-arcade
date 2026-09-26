#!/usr/bin/env node
// The Chikun Weekly Jackpot live dry run: a READ-ONLY checklist of the deployed jackpot, the chain and the
// site (jackpot-rehearsal slice; design §E E7, E9, E11, J17; brief AC5).
//
//   node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io [--rpc <url>] [--expect-live true|false]
//        [--funder <address> ...] [--json]
//   (loopback --rpc only: --deployment <litvm-addresses module> --jackpot-module <litvm-jackpot module>
//    --record <deployment-record.jackpot.json>, for the local stack)
//
// It only reads: JSON-RPC eth_chainId, eth_blockNumber, eth_getBlockByNumber, eth_getBalance, eth_call,
// eth_getCode and eth_getLogs (any other method is refused inside the provider), and HTTP GETs of
// /api/jackpot, /api/health, /api/leaderboard, /src/jackpot-config.mjs and /jackpot/chikun. It prints a
// JSON checklist and exits 0 when every check passes, 1 when one fails (2 for a usage error):
//   - code at the module's jackpot and token addresses, and at every retired[] instance;
//   - the immutables (gameId, token, scoreRegistry, rankedEntry, firstWeek) and the roles (admin, keeper,
//     operator, residual recipient) equal contracts/deployment-record.jackpot.json;
//   - weekOf(now) equals the server's current week key;
//   - the rules in force, and rulesFor(currentWeek).minFundWei > 0;
//   - J17 coupling: ArcadeRankedEntry.quoteEntry(chikun).totalWei >= rulesFor(currentWeek).minPaidWei;
//     ScoreSubmissionRegistry.rankedEntry() == jackpot.rankedEntry() (and the jackpot reads the registry the
//     site uses); the Chikun game id is the jackpot's and the season the server uses is in
//     rulesFor(currentWeek); the Chikun game is registered and playable;
//   - the pot, prize and funded flag of the current and previous week from the chain equal /api/jackpot;
//   - paused() and operatorPaused() as /api/health reports them (and the env pause);
//   - the keeper holds at least 0.05 zkLTC;
//   - /api/health reports the weekly-jackpot cron fresh (20 minutes), no week awaiting the admin for more
//     than 24 h, none claim-pending and none failed;
//   - the E5 block list is blocked on chain (the test wallet 0x8841…ce824, the verifier, the relayer, each
//     --funder) and the residual recipient is blocked or staff; the admin, operator and keeper are staffEver,
//     and so is every address the role events ever named (a rotated-out keeper or admin);
//   - JACKPOT_LIVE in the served /src/jackpot-config.mjs matches --expect-live, and the rules page's
//     robots noindex agrees with it.
// The owner session runs it live at runbook E7, E9 and E11 (and before and after any J17 change). It never
// signs, sends or writes anything, never reads a key, and never prints the RPC URL (only its host).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ethers } from 'ethers';

import { LITVM_DEPLOYMENT } from '../apps/portal/src/generated/litvm-addresses.mjs';
import { loadContractArtifact, loadLitvmJackpot, normalizeJackpotRecord, readJackpotRecord, rulesFromChain, rulesToJson, weekKeyOf } from './generate-litvm-jackpot.mjs';
import { isLoopbackRpc } from './operator-actions.mjs';

export const LIVE_DRY_RUN_SCHEMA = 'lesters-jackpot-live-dry-run-v1';
export const DEFAULT_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
export const READ_ONLY_RPC_METHODS = Object.freeze(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBalance', 'eth_call', 'eth_getCode', 'eth_getLogs']);
export const LIVE_CHAIN_ID = 4441;
export const MIN_KEEPER_BALANCE_WEI = 5n * 10n ** 16n; // 0.05 zkLTC (design §E E11)
export const CRON_STALE_SECONDS = 20 * 60; // apps/portal/owner/status.mjs staleCronSeconds.weeklyJackpot
export const ADMIN_SLA_HOURS = 24; // design §E E11 review SLA
export const TEST_WALLET = '0x8841ae6244dba71f620de450e71b0ef7e0cce824';
export const LOG_CHUNK_BLOCKS = 10_000;
export const MAX_LOG_CHUNKS = 60;
export const HTTP_TIMEOUT_MS = 15_000;
export const ROLE_EVENTS = Object.freeze(['KeeperUpdated', 'AdminTransferred', 'OperatorTransferred']);
// The checklist ids, in order (tests pin that every one is reported).
export const LIVE_CHECK_IDS = Object.freeze([
  'rpc-chain', 'jackpot-deployed', 'code-jackpot', 'code-token', 'code-retired', 'immutables', 'roles', 'api-live', 'week-key', 'rules-in-force',
  'j17-quote', 'j17-ranked-entry', 'j17-season', 'j17-game-id', 'j17-game-registered', 'pot-current', 'pot-previous', 'pause', 'keeper-balance',
  'cron-fresh', 'admin-backlog', 'no-failed-weeks', 'block-list', 'residual-recipient', 'staff-ever', 'staff-history', 'jackpot-live-flag',
]);

const lower = (value) => String(value ?? '').toLowerCase();
const ZERO32 = ethers.ZeroHash;

// A JSON-RPC provider that refuses every method that is not a read.
export class ReadOnlyProvider extends ethers.JsonRpcProvider {
  constructor(url) {
    super(url, LIVE_CHAIN_ID, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
    this.methods = new Set();
  }

  async send(method, params) {
    if (!READ_ONLY_RPC_METHODS.includes(method)) throw Object.assign(new Error(`refused: ${method} is not a read-only JSON-RPC method`), { code: 'READ_ONLY' });
    this.methods.add(method);
    return super.send(method, params);
  }
}

function plain(value) {
  return JSON.parse(JSON.stringify(value ?? null, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)));
}

// An error as its code or name only: never a message, which can carry a URL.
function safeError(error) {
  return { error: String(error?.code ?? error?.name ?? 'error') };
}

// GET only, JSON or text, with a timeout. → { status, body }
function createGetter(site, fetchImpl) {
  const base = new URL(String(site));
  if (base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('--site must be a bare origin such as https://lestersarcade.io');
  const requests = [];
  const get = async (path, { json = true } = {}) => {
    requests.push({ method: 'GET', path });
    const response = await fetchImpl(new URL(path, base), { method: 'GET', headers: { accept: json ? 'application/json' : 'text/html, text/javascript, */*' }, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    const text = await response.text();
    if (!json) return { status: response.status, body: text };
    let body = null;
    try { body = JSON.parse(text); } catch { body = null; }
    return { status: response.status, body };
  };
  return { get, requests, origin: base.origin };
}

function contractAt(name, address, provider) {
  return new ethers.Contract(address, loadContractArtifact(name).abi, provider);
}

// The pot fields /api/jackpot serves (design §C.5 rev. 2), from the chain.
export function potFromChain({ funded, carriedIn, total }, rules) {
  const cap = BigInt(rules.maxPrizeWei) > 0n ? BigInt(rules.maxPrizeWei) : null;
  const prize = cap !== null && BigInt(total) > cap ? cap : BigInt(total);
  const minFund = BigInt(rules.minFundWei);
  return {
    fundedWei: BigInt(funded).toString(),
    carriedInWei: BigInt(carriedIn).toString(),
    totalWei: BigInt(total).toString(),
    prizeCapWei: cap === null ? null : cap.toString(),
    prizeWei: prize.toString(),
    carryOverWei: (BigInt(total) - prize).toString(),
    funded: minFund > 0n && BigInt(total) >= minFund,
  };
}

// Runs the checklist. `provider` may be injected (tests); otherwise a ReadOnlyProvider on `rpc`.
export async function runJackpotLiveDryRun({
  site,
  rpc = DEFAULT_RPC_URL,
  provider = null,
  fetchImpl = globalThis.fetch,
  deployment = LITVM_DEPLOYMENT,
  jackpotModule = null,
  record = undefined,
  expectLive = false,
  funders = [],
  log = () => {},
} = {}) {
  const chain = provider ?? new ReadOnlyProvider(rpc);
  const http = createGetter(site, fetchImpl);
  const module = jackpotModule ?? await loadLitvmJackpot();
  const jackpotRecord = record === undefined ? readJackpotRecord() : (record ? normalizeJackpotRecord(record) : null);
  const checks = [];
  const add = (id, ok, detail = null) => {
    checks.push({ id, ok: Boolean(ok), ...(detail === null ? {} : { detail: plain(detail) }) });
    log(`${ok ? 'ok  ' : 'FAIL'} ${id}`);
  };
  // Runs one check; an RPC or HTTP failure is a failed check, never a crash.
  const step = async (id, run) => {
    try {
      await run();
    } catch (error) {
      add(id, false, safeError(error));
    }
  };
  let rpcHost = null;
  try { rpcHost = provider ? 'injected' : new URL(rpc).host; } catch { rpcHost = 'invalid'; }
  const report = () => {
    const reported = new Set(checks.map((check) => check.id));
    for (const id of LIVE_CHECK_IDS) if (!reported.has(id)) checks.push({ id, ok: false, detail: { skipped: 'not reached' } });
    checks.sort((a, b) => LIVE_CHECK_IDS.indexOf(a.id) - LIVE_CHECK_IDS.indexOf(b.id));
    const failures = checks.filter((check) => !check.ok).map((check) => check.id);
    return {
      schema: LIVE_DRY_RUN_SCHEMA,
      generatedAt: new Date().toISOString(),
      site: http.origin,
      rpcHost,
      readOnly: { rpcMethods: [...(chain.methods ?? [])].sort(), httpMethods: [...new Set(http.requests.map((entry) => entry.method))] },
      ok: failures.length === 0,
      checks,
      failures,
    };
  };

  let chainId = null;
  await step('rpc-chain', async () => {
    chainId = Number(BigInt(await chain.send('eth_chainId', [])));
    add('rpc-chain', chainId === LIVE_CHAIN_ID, { chainId });
  });
  if (chainId !== LIVE_CHAIN_ID) return report();
  if (module?.status !== 'deployed' || !module.instances?.chikun?.address) {
    add('jackpot-deployed', false, { status: module?.status ?? null, note: 'the jackpot module is not deployed: runbook E4 comes first' });
    return report();
  }
  const instance = module.instances.chikun;
  add('jackpot-deployed', true, { address: instance.address, token: instance.token.symbol });
  const jackpot = contractAt('WeeklyJackpot', instance.address, chain);

  const hasCode = async (address) => {
    const code = await chain.getCode(address);
    return { address: lower(address), bytes: code && code !== '0x' ? (code.length - 2) / 2 : 0 };
  };
  await step('code-jackpot', async () => { const found = await hasCode(instance.address); add('code-jackpot', found.bytes > 0, found); });
  await step('code-token', async () => { const found = await hasCode(instance.token.address); add('code-token', found.bytes > 0, found); });
  await step('code-retired', async () => {
    const found = [];
    for (const retired of instance.retired ?? []) {
      // eslint-disable-next-line no-await-in-loop
      found.push(await hasCode(retired.address), await hasCode(retired.token.address));
    }
    add('code-retired', found.every((entry) => entry.bytes > 0), { instances: (instance.retired ?? []).length, code: found });
  });

  let onChain = null;
  await step('immutables', async () => {
    const [gameId, token, scoreRegistry, rankedEntry, firstWeek, admin, keeper, operator, residualRecipient] = await Promise.all([
      jackpot.gameId(), jackpot.token(), jackpot.scoreRegistry(), jackpot.rankedEntry(), jackpot.firstWeek(), jackpot.admin(), jackpot.keeper(), jackpot.operator(), jackpot.residualRecipient(),
    ]);
    onChain = {
      gameId: lower(gameId), token: lower(token), scoreRegistry: lower(scoreRegistry), rankedEntry: lower(rankedEntry), firstWeek: Number(firstWeek),
      admin: lower(admin), keeper: lower(keeper), operator: lower(operator), residualRecipient: lower(residualRecipient),
    };
    const expected = jackpotRecord?.instances?.chikun ?? null;
    if (!expected) {
      add('immutables', false, { chain: onChain, record: null, note: 'contracts/deployment-record.jackpot.json is missing' });
      add('roles', false, { note: 'no committed record to compare the roles with' });
      return;
    }
    const want = {
      gameId: lower(expected.gameId), token: lower(expected.token.address), scoreRegistry: lower(expected.scoreRegistry), rankedEntry: lower(expected.rankedEntry), firstWeek: Number(expected.firstWeek),
    };
    add('immutables', Object.entries(want).every(([key, value]) => onChain[key] === value) && lower(expected.address) === lower(instance.address), { chain: Object.fromEntries(Object.keys(want).map((key) => [key, onChain[key]])), record: want });
    const roles = { admin: lower(expected.admin), keeper: lower(expected.keeper ?? ethers.ZeroAddress), operator: lower(expected.operator), residualRecipient: lower(expected.residualRecipient) };
    add('roles', Object.entries(roles).every(([key, value]) => onChain[key] === value), { chain: { admin: onChain.admin, keeper: onChain.keeper, operator: onChain.operator, residualRecipient: onChain.residualRecipient }, record: roles });
  });

  let api = null;
  let health = null;
  let seasonId = null;
  await step('api-live', async () => {
    const [jackpotAnswer, healthAnswer, boardAnswer] = await Promise.all([http.get('/api/jackpot'), http.get('/api/health'), http.get('/api/leaderboard?game=chikun&period=weekly')]);
    api = jackpotAnswer.status === 200 ? jackpotAnswer.body : null;
    health = healthAnswer.status === 200 ? healthAnswer.body : null;
    seasonId = boardAnswer.status === 200 ? boardAnswer.body?.seasonId ?? null : null;
    add('api-live', api?.ok === true && api.live === true && lower(api.contract) === lower(instance.address), { status: jackpotAnswer.status, live: api?.live ?? null, contract: api?.contract ?? null, health: healthAnswer.status });
  });

  let currentWeek = null;
  let rules = null;
  await step('week-key', async () => {
    const block = await chain.getBlock('latest');
    currentWeek = Number(await jackpot.weekOf(block.timestamp));
    add('week-key', api?.current?.weekIndex === currentWeek && api.current.weekKey === weekKeyOf(currentWeek), { chain: { block: block.number, timestamp: block.timestamp, week: currentWeek, key: weekKeyOf(currentWeek) }, server: { week: api?.current?.weekIndex ?? null, key: api?.current?.weekKey ?? null } });
  });
  if (currentWeek === null) return report();
  await step('rules-in-force', async () => {
    rules = rulesToJson(rulesFromChain(await jackpot.rulesFor(currentWeek)));
    add('rules-in-force', BigInt(rules.minFundWei) > 0n, { week: weekKeyOf(currentWeek), rules });
  });

  // J17: the Ranked settings the jackpot's rules depend on.
  await step('j17-quote', async () => {
    const entry = contractAt('ArcadeRankedEntry', deployment.addresses.arcadeRankedEntry, chain);
    const quote = await entry.quoteEntry(onChain?.gameId ?? ethers.id('chikun'));
    add('j17-quote', rules !== null && BigInt(quote.totalWei) >= BigInt(rules.minPaidWei), { quoteTotalWei: BigInt(quote.totalWei).toString(), minPaidWei: rules?.minPaidWei ?? null });
  });
  await step('j17-ranked-entry', async () => {
    const registry = contractAt('ScoreSubmissionRegistry', deployment.addresses.scoreSubmissionRegistry, chain);
    const registryEntry = lower(await registry.rankedEntry());
    add('j17-ranked-entry', registryEntry === onChain?.rankedEntry && onChain?.scoreRegistry === lower(deployment.addresses.scoreSubmissionRegistry) && onChain?.rankedEntry === lower(deployment.addresses.arcadeRankedEntry), {
      registryRankedEntry: registryEntry, jackpotRankedEntry: onChain?.rankedEntry ?? null, jackpotScoreRegistry: onChain?.scoreRegistry ?? null, siteScoreRegistry: lower(deployment.addresses.scoreSubmissionRegistry),
    });
  });
  await step('j17-season', async () => {
    const hash = seasonId ? lower(ethers.id(seasonId)) : null;
    const inRules = hash !== null && rules !== null && (hash === lower(rules.seasonId) || (rules.altSeasonId && lower(rules.altSeasonId) !== ZERO32 && hash === lower(rules.altSeasonId)));
    add('j17-season', inRules, { serverSeason: seasonId, seasonId32: hash, rulesSeason: rules?.seasonId ?? null, rulesAltSeason: rules?.altSeasonId ?? null });
  });
  await step('j17-game-id', async () => {
    add('j17-game-id', onChain?.gameId === lower(ethers.id('chikun')), { jackpotGameId: onChain?.gameId ?? null, chikun: lower(ethers.id('chikun')) });
  });
  await step('j17-game-registered', async () => {
    const registry = contractAt('GameRegistry', deployment.addresses.gameRegistry, chain);
    const game = await registry.getGame(onChain?.gameId ?? ethers.id('chikun'));
    add('j17-game-registered', game.exists === true && game.playable === true, { exists: game.exists, playable: game.playable });
  });

  // The pots of the current and previous week, chain against /api/jackpot.
  for (const [id, week, served] of [['pot-current', currentWeek, api?.current?.pot ?? null], ['pot-previous', currentWeek - 1, api?.previous?.pot ?? null]]) {
    // eslint-disable-next-line no-await-in-loop
    await step(id, async () => {
      const [pot, weekRules] = await Promise.all([jackpot.potOf(week), jackpot.rulesFor(week)]);
      const expected = potFromChain(pot, rulesToJson(rulesFromChain(weekRules)));
      const beforeFirst = onChain && week < onChain.firstWeek;
      const same = served ? ['totalWei', 'prizeWei', 'funded'].every((key) => served[key] === expected[key]) : beforeFirst || (expected.totalWei === '0' && id === 'pot-previous');
      add(id, same, { week: weekKeyOf(week), chain: expected, api: served });
    });
  }

  await step('pause', async () => {
    const [paused, adminPaused, operatorPaused] = await Promise.all([jackpot.paused(), jackpot.adminPaused(), jackpot.operatorPaused()]);
    const reported = health?.jackpot?.paused ?? null;
    add('pause', reported !== null && reported.onChain === paused, { chain: { paused, adminPaused, operatorPaused }, health: reported });
  });
  await step('keeper-balance', async () => {
    const keeper = onChain?.keeper ?? null;
    const balance = keeper && keeper !== lower(ethers.ZeroAddress) ? BigInt(await chain.getBalance(keeper)) : 0n;
    add('keeper-balance', balance >= MIN_KEEPER_BALANCE_WEI, { keeper, balanceWei: balance.toString(), minimumWei: MIN_KEEPER_BALANCE_WEI.toString() });
  });
  await step('cron-fresh', async () => {
    const cron = health?.crons?.weeklyJackpot ?? null;
    const checkedAt = Date.parse(health?.checkedAt ?? '');
    const lastOk = Date.parse(cron?.lastOkAt ?? '');
    const age = Number.isFinite(checkedAt) && Number.isFinite(lastOk) ? Math.round((checkedAt - lastOk) / 1000) : null;
    add('cron-fresh', age !== null && age <= CRON_STALE_SECONDS, { lastOkAt: cron?.lastOkAt ?? null, lastErrorCode: cron?.lastErrorCode ?? null, ageSeconds: age });
  });
  await step('admin-backlog', async () => {
    const part = health?.jackpot ?? null;
    const awaiting = Number(part?.awaitingAdmin ?? NaN);
    const oldest = part?.awaitingAdminOldestHours ?? null;
    add('admin-backlog', part !== null && (awaiting === 0 || (Number.isFinite(Number(oldest)) && Number(oldest) <= ADMIN_SLA_HOURS)) && Number(part.claimPending) === 0, {
      awaitingAdmin: part?.awaitingAdmin ?? null, awaitingAdminOldestHours: oldest, claimPending: part?.claimPending ?? null,
    });
  });
  await step('no-failed-weeks', async () => {
    add('no-failed-weeks', health?.jackpot != null && Number(health.jackpot.failed) === 0, { failed: health?.jackpot?.failed ?? null });
  });

  // E5 and staff.
  await step('block-list', async () => {
    const list = [['test wallet', TEST_WALLET], ['verifier', deployment.trustedVerifier], ['relayer', deployment.relayer], ...funders.map((address, index) => [`funder ${index + 1}`, address])];
    const found = [];
    for (const [label, address] of list) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(String(address ?? ''))) {
        found.push({ label, address: address ?? null, blocked: false, note: 'no address' });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      found.push({ label, address: lower(address), blocked: await jackpot.blocked(address) });
    }
    add('block-list', found.every((entry) => entry.blocked === true), found);
  });
  await step('residual-recipient', async () => {
    const recipient = onChain?.residualRecipient;
    const [blocked, staff] = await Promise.all([jackpot.blocked(recipient), jackpot.staffEver(recipient)]);
    add('residual-recipient', blocked || staff, { address: recipient, blocked, staffEver: staff });
  });
  await step('staff-ever', async () => {
    const roles = { admin: onChain?.admin, operator: onChain?.operator, keeper: onChain?.keeper };
    const found = {};
    for (const [role, address] of Object.entries(roles)) {
      // eslint-disable-next-line no-await-in-loop
      found[role] = address && address !== lower(ethers.ZeroAddress) ? { address, staffEver: await jackpot.staffEver(address) } : { address, staffEver: role === 'keeper' };
    }
    add('staff-ever', Object.values(found).every((entry) => entry.staffEver === true), found);
  });
  await step('staff-history', async () => {
    const head = await chain.getBlockNumber();
    const from = Number(instance.startBlock ?? 0);
    const chunks = Math.ceil((head - from + 1) / LOG_CHUNK_BLOCKS);
    if (chunks > MAX_LOG_CHUNKS) {
      add('staff-history', true, { skipped: `the range ${from}-${head} needs ${chunks} getLogs calls (limit ${MAX_LOG_CHUNKS})` });
      return;
    }
    const iface = jackpot.interface;
    const topics = ROLE_EVENTS.map((name) => iface.getEvent(name).topicHash);
    const named = new Set();
    for (let start = from; start <= head; start += LOG_CHUNK_BLOCKS) {
      // eslint-disable-next-line no-await-in-loop
      const logs = await chain.getLogs({ address: instance.address, fromBlock: start, toBlock: Math.min(head, start + LOG_CHUNK_BLOCKS - 1), topics: [topics] });
      for (const entry of logs) {
        if (lower(entry.address) !== lower(instance.address)) continue;
        const parsed = iface.parseLog(entry);
        const address = lower(parsed.name === 'KeeperUpdated' ? parsed.args[0] : parsed.args[1]);
        if (address !== lower(ethers.ZeroAddress)) named.add(address);
      }
    }
    const found = [];
    for (const address of named) {
      // eslint-disable-next-line no-await-in-loop
      found.push({ address, staffEver: await jackpot.staffEver(address) });
    }
    add('staff-history', found.length > 0 && found.every((entry) => entry.staffEver === true), found);
  });

  // The client flag as served, against the expectation.
  await step('jackpot-live-flag', async () => {
    const [config, rulesPage] = await Promise.all([http.get('/src/jackpot-config.mjs', { json: false }), http.get('/jackpot/chikun', { json: false })]);
    const match = config.status === 200 ? /export const JACKPOT_LIVE = (true|false);/.exec(config.body) : null;
    const served = match ? match[1] === 'true' : null;
    const noindex = rulesPage.status === 200 ? /<meta name="robots" content="noindex/.test(rulesPage.body) : null;
    add('jackpot-live-flag', served === expectLive && noindex === !expectLive, { expected: expectLive, served, rulesPageNoindex: noindex, status: { config: config.status, rulesPage: rulesPage.status } });
  });
  return report();
}

// ---------------------------------------------------------------------------------------------------
// CLI.

const VALUE_FLAGS = new Set(['--site', '--rpc', '--expect-live', '--funder', '--deployment', '--jackpot-module', '--record']);

export function parseLiveDryRunArgs(argv = []) {
  const options = { site: null, rpc: DEFAULT_RPC_URL, expectLive: false, funders: [], deployment: null, jackpotModule: null, record: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (!VALUE_FLAGS.has(arg)) return { ok: false, error: `unknown argument ${arg}` };
    const value = argv[index + 1];
    index += 1;
    if (value === undefined) return { ok: false, error: `${arg} needs a value` };
    if (arg === '--site') options.site = value;
    else if (arg === '--rpc') options.rpc = value;
    else if (arg === '--expect-live') {
      if (value !== 'true' && value !== 'false') return { ok: false, error: '--expect-live is true or false' };
      options.expectLive = value === 'true';
    } else if (arg === '--funder') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return { ok: false, error: '--funder must be a 0x address' };
      options.funders.push(value);
    } else if (arg === '--deployment') options.deployment = value;
    else if (arg === '--jackpot-module') options.jackpotModule = value;
    else if (arg === '--record') options.record = value;
  }
  if (!options.site) return { ok: false, error: '--site <origin> is required' };
  const overrides = options.deployment || options.jackpotModule || options.record;
  if (overrides && !isLoopbackRpc(options.rpc)) return { ok: false, error: '--deployment, --jackpot-module and --record are honoured only with a loopback --rpc (the local chain)' };
  return { ok: true, ...options };
}

export const USAGE = 'usage: node scripts/jackpot-live-dry-run.mjs --site <origin> [--rpc <url>] [--expect-live true|false] [--funder <address> ...] [--json]';

export async function runLiveDryRunCli({ argv = process.argv.slice(2), out = console.log, fetchImpl = globalThis.fetch } = {}) {
  const args = parseLiveDryRunArgs(argv);
  if (!args.ok) {
    out(args.error);
    out(USAGE);
    return 2;
  }
  const deployment = args.deployment ? (await import(pathToFileURL(resolve(args.deployment)).href)).LITVM_DEPLOYMENT : LITVM_DEPLOYMENT;
  const jackpotModule = args.jackpotModule ? await loadLitvmJackpot(args.jackpotModule) : null;
  const record = args.record ? JSON.parse(readFileSync(resolve(args.record), 'utf8')) : undefined;
  const result = await runJackpotLiveDryRun({ site: args.site, rpc: args.rpc, fetchImpl, deployment, jackpotModule, record, expectLive: args.expectLive, funders: args.funders, log: args.json ? () => {} : out });
  out(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runLiveDryRunCli().then((code) => { process.exitCode = code; }, (error) => {
    console.error(`jackpot-live-dry-run failed (${error?.code ?? error?.name ?? 'error'})`);
    process.exitCode = 1;
  });
}
