// Ranked end-to-end rehearsal CLI (rehearsal slice; guide §5.14 item 6, §7 step 9; contract §13 step 9).
//
// Local (default; offline, public fixture keys only):
//   node scripts/rehearse-ranked-e2e.mjs [--target local] [--out <path>] [--no-write] [--skip-phase2]
// boots the local stack three times (scripts/lib/local-stack.mjs: in-process Hardhat chain 4441, unmigrated
// PGlite, every api/*.mjs handler behind the vercel.json rewrites) and plays one Ranked session per
// game through scripts/lib/rehearsal-driver.mjs: once in-process with every negative check, once over
// real HTTP and JSON-RPC (scripts/lib/local-http.mjs) exactly as the live run will go, then the NFT
// phase-2 rehearsal (scripts/rehearse-nft-phase2.mjs). The report is written to
// docs/qa/pre-deployment-rehearsal-20260923.json.
//
// Live (runbook step 9, OWNER APPROVAL REQUIRED; spends testnet zkLTC; never run by the slice):
//   node scripts/rehearse-ranked-e2e.mjs --target live --site https://lestersarcade.io \
//     --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path> [--player-key-field <field>] \
//     (--cron-secret-file <path> | --cron-secret-env <NAME>) --confirm-live SPEND_TESTNET_ZKLTC [--yes] \
//     [--games <id,id>] [--second-key-file <path> [--second-key-field <field>] | --second-key-env <NAME>]
// refuses to start without every flag; reads the player key, the optional second key and the cron
// secret INSIDE this process through scripts/lib/key-source.mjs and never prints or logs them; checks
// that the RPC node itself reports chain 4441 and that the committed address module is `deployed`;
// prints the plan (one entry per game at its quoteEntry total, plus the second wallet's copy entry
// when one is given) and stops unless --yes is given; warns when the player already has confirmed
// runs of these games; skips the local-only negative checks (fees off, pause) and, without a second
// funded wallet, the evidence-copy check; and reminds the operator of owner checkpoint O2 (keep the
// test wallet's rows on the launch boards, or exclude them). `--games` replays only those games (a
// retry). `--deployment <module.mjs>` is accepted only with a loopback --rpc (the local stand-in),
// where the chain clock can also be advanced instead of waited.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

import { flagValue, hasFlag, readSecret, SecretSourceError } from './lib/key-source.mjs';
import { startLocalStack, jsonRpcProvider } from './lib/local-stack.mjs';
import { startLocalHttp, startRpcProxy } from './lib/local-http.mjs';
import { createFetchApi, DEFAULT_GAMES, rankedContracts, runRankedE2E } from './lib/rehearsal-driver.mjs';
import { loadLitvmDeployment } from './generate-litvm-addresses.mjs';
import { rehearseNftPhase2 } from './rehearse-nft-phase2.mjs';
import { isLoopbackRpc, rpcChainId } from './operator-actions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export const LIVE_CONFIRM = 'SPEND_TESTNET_ZKLTC';
export const LOCAL_REPORT_RELATIVE_PATH = 'docs/qa/pre-deployment-rehearsal-20260923.json';
export const REHEARSAL_SUMMARY_SCHEMA = 'lesters-pre-deployment-rehearsal-v1';
export const LIVE_REQUIRED_FLAGS = Object.freeze(['--site', '--rpc', '--player-key-file', '--confirm-live']);
// Gas headroom on top of the entries: the setProfile calls on LiteForge (about 1.5 gwei).
export const LIVE_GAS_MARGIN_WEI = 10_000_000_000_000_000n;
// The optional second wallet sends one openSession only.
export const SECOND_WALLET_GAS_MARGIN_WEI = 2_000_000_000_000_000n;
export const O2_REMINDER = [
  'Owner checkpoint O2 (contract §10.1): decide whether this test wallet\'s rows stay on the launch boards.',
  'Recommended: a fresh test wallet, excluded afterwards with',
  '  node scripts/moderate-profile.mjs --wallet <player> --exclude            (dry run)',
  '  node scripts/moderate-profile.mjs --wallet <player> --exclude --apply --confirm EXCLUDE_WALLET',
  'A retry with the same wallet still passes (a run that is not the wallet\'s best, or earns nothing new, is',
  'reported as such), but it spends another entry per game: use --games <id,...> to replay only what failed.',
].join('\n');

export const USAGE = [
  'usage: node scripts/rehearse-ranked-e2e.mjs [--target local] [--out <path>] [--no-write] [--skip-phase2]',
  '       node scripts/rehearse-ranked-e2e.mjs --target live --site <https origin> --rpc <url> --player-key-file <path> [--player-key-field <field>]',
  '            (--cron-secret-file <path> | --cron-secret-env <NAME>) --confirm-live SPEND_TESTNET_ZKLTC [--yes] [--out <path>]',
  '            [--games <id,id>] [--second-key-file <path> [--second-key-field <field>] | --second-key-env <NAME>]',
].join('\n');

// --games a,b (live only): a subset of the three Ranked games, in the driver's order.
export function parseGames(value) {
  if (value === null || value === undefined) return [...DEFAULT_GAMES];
  const wanted = String(value).split(',').map((id) => id.trim()).filter(Boolean);
  const unknown = wanted.filter((id) => !DEFAULT_GAMES.includes(id));
  if (!wanted.length || unknown.length) throw new Error(`--games takes a comma list of ${DEFAULT_GAMES.join(', ')}${unknown.length ? ` (unknown: ${unknown.join(', ')})` : ''}`);
  return DEFAULT_GAMES.filter((id) => wanted.includes(id));
}

// The game whose settled run the negative checks reuse (the driver's choice: Chikun first).
export function negativeSourceGame(games) {
  return ['chikun', ...games].find((id) => games.includes(id));
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// https origins only; http is accepted for the loopback stand-in.
export function parseSite(site) {
  let url;
  try {
    url = new URL(String(site));
  } catch {
    throw new Error('--site must be an origin such as https://lestersarcade.io');
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('--site must be a bare origin (no path, query or credentials)');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) throw new Error('--site must use https (http only for 127.0.0.1 / localhost)');
  return url.origin;
}

function todayStamp(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10).replaceAll('-', '');
}

function summarize(report) {
  return Object.values(report.games).map((game) => `  ${game.gameId}: ${game.ok ? 'PASS' : 'FAIL'} ${game.checks.filter((check) => check.ok).length}/${game.checks.length} checks${game.settle?.txHash ? `, settled ${game.settle.txHash}` : ''}${game.leaderboard && game.leaderboard.walletBest === false ? ' (not the wallet\'s best this period)' : ''}`)
    .concat(report.negatives.map((check) => `  negative ${check.id}: ${check.skipped ? `SKIPPED (${check.skipped})` : check.ok ? 'PASS' : 'FAIL'}`));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// Local target.

// The in-process run: every check, the local-only negatives included.
export async function runLocalInProcess({ log = () => {}, games = DEFAULT_GAMES } = {}) {
  const stack = await startLocalStack({ log });
  try {
    return await runRankedE2E({
      target: 'local',
      transport: 'in-process',
      api: stack.api,
      chain: stack.driverChain(),
      wallets: { player: stack.wallets.player1, second: stack.wallets.player2 },
      cronSecret: stack.cronSecret(),
      domain: '127.0.0.1',
      local: stack.localControls,
      games,
      log,
    });
  } finally {
    await stack.close();
  }
}

// The live-shaped run: the same driver over real HTTP (local-http) and JSON-RPC (the proxy), with
// `target: 'live'` so exactly the live code path runs, and a second funded wallet as runbook step 9
// may pass with --second-key-file; the chain clock is advanced over the proxy.
export async function runLocalOverHttp({ log = () => {}, games = DEFAULT_GAMES, viaCli = null } = {}) {
  const stack = await startLocalStack({ log });
  const http = await startLocalHttp(stack);
  const rpc = await startRpcProxy(stack);
  try {
    if (viaCli) return await viaCli({ stack, http, rpc });
    const provider = jsonRpcProvider(rpc.url);
    try {
      return await runRankedE2E({
        target: 'live',
        transport: 'http',
        api: createFetchApi(http.origin),
        chain: { provider, deployment: stack.deployment, relayer: stack.record.relayer, advanceTime: rpcTimeTravel(provider) },
        wallets: { player: new ethers.Wallet(stack.chain.wallets.player1.privateKey, provider), second: new ethers.Wallet(stack.chain.wallets.player2.privateKey, provider) },
        cronSecret: stack.cronSecret(),
        site: http.origin,
        games,
        log,
      });
    } finally {
      provider.destroy();
    }
  } finally {
    await http.close();
    await rpc.close();
    await stack.close();
  }
}

// Chain time travel over a loopback JSON-RPC endpoint (the stand-in only; LiteForge has no cheats).
export function rpcTimeTravel(provider) {
  return async (seconds) => {
    const whole = Math.max(0, Math.ceil(Number(seconds)));
    if (whole > 0) await provider.send('evm_increaseTime', [whole]);
    await provider.send('evm_mine', []);
  };
}

// Phase 2 (soulbound NFT definitions, relayer minter, backfill, index) on its own fresh stack.
export async function runLocalPhase2({ log = () => {} } = {}) {
  const stack = await startLocalStack({ log });
  try {
    return await rehearseNftPhase2({ stack, log });
  } finally {
    await stack.close();
  }
}

export async function runLocalRehearsal({ log = () => {}, games = DEFAULT_GAMES, nowMs = Date.now(), phase2 = true } = {}) {
  log('== in-process run (local stack, every negative check) ==');
  const inProcess = await runLocalInProcess({ log, games });
  log('== HTTP run (local-http + JSON-RPC proxy, the live code path) ==');
  const http = await runLocalOverHttp({ log, games });
  let nft = null;
  if (phase2) {
    log('== phase 2: NFT definitions, relayer minter, backfill, index ==');
    nft = await runLocalPhase2({ log });
  }
  return {
    schema: REHEARSAL_SUMMARY_SCHEMA,
    generatedAt: new Date(nowMs).toISOString(),
    note: 'Local rehearsal only: Hardhat chain 4441 in process, PGlite for Neon, public fixture keys. Nothing touched LiteForge, Vercel or production Neon.',
    commands: {
      rehearsal: 'node scripts/rehearse-ranked-e2e.mjs --target local',
      phase2: 'node scripts/rehearse-nft-phase2.mjs',
      live: 'node scripts/rehearse-ranked-e2e.mjs --target live --site https://lestersarcade.io --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path> --cron-secret-file <vault cron-secret.txt> --confirm-live SPEND_TESTNET_ZKLTC --yes [--second-key-file <path>] [--games <id,id>]',
    },
    ok: inProcess.ok && http.ok && (nft === null || nft.ok),
    runs: [inProcess, http],
    phase2: nft,
  };
}

// ---------------------------------------------------------------------------
// Live target.

// Validates the live flags without reading any secret. → { ok, missing, problems }
export function checkLiveFlags(argv) {
  const missing = LIVE_REQUIRED_FLAGS.filter((flag) => flagValue(argv, flag) === null);
  const cronFile = flagValue(argv, '--cron-secret-file');
  const cronEnv = flagValue(argv, '--cron-secret-env');
  if (cronFile === null && cronEnv === null) missing.push('--cron-secret-file | --cron-secret-env');
  const problems = [];
  if (cronFile !== null && cronEnv !== null) problems.push('use either --cron-secret-file or --cron-secret-env, not both');
  const confirm = flagValue(argv, '--confirm-live');
  if (confirm !== null && confirm !== LIVE_CONFIRM) problems.push(`--confirm-live must be exactly ${LIVE_CONFIRM}`);
  return { ok: missing.length === 0 && problems.length === 0, missing, problems };
}

// E6 for the player before anything is spent: confirmed runs per game (null when E6 cannot answer).
export async function readPriorRuns(api, player, games) {
  try {
    const response = await api('GET', `/api/profile?wallet=${player.toLowerCase()}`);
    if (response.status !== 200 || !response.body?.games) return null;
    return Object.fromEntries(games.map((gameId) => [gameId, Number(response.body.games[gameId]?.confirmedRuns ?? 0)]));
  } catch {
    return null;
  }
}

export async function planLiveRun({ provider, deployment, player, games = DEFAULT_GAMES, second = null, api = null }) {
  const contracts = rankedContracts(deployment, provider);
  const entries = [];
  for (const gameId of games) {
    // eslint-disable-next-line no-await-in-loop
    const quote = await contracts.entry.quoteEntry(ethers.id(gameId));
    entries.push({ gameId, entryFeeWei: quote.entryFeeWei.toString(), settlementGasReserveWei: quote[1].toString(), totalWei: quote.totalWei.toString() });
  }
  const totalWei = entries.reduce((sum, entry) => sum + BigInt(entry.totalWei), 0n);
  const balanceWei = await provider.getBalance(player);
  const plan = { player: player.toLowerCase(), games: [...games], entries, totalWei: totalWei.toString(), neededWei: (totalWei + LIVE_GAS_MARGIN_WEI).toString(), balanceWei: balanceWei.toString() };
  if (second) {
    // The evidence-copy check: one paid entry of the negative checks' source game from the second wallet.
    const copied = entries.find((entry) => entry.gameId === negativeSourceGame(games));
    plan.second = {
      wallet: second.toLowerCase(),
      gameId: copied.gameId,
      totalWei: copied.totalWei,
      neededWei: (BigInt(copied.totalWei) + SECOND_WALLET_GAS_MARGIN_WEI).toString(),
      balanceWei: (await provider.getBalance(second)).toString(),
    };
  }
  plan.priorRuns = api ? await readPriorRuns(api, player, games) : null;
  return plan;
}

export async function runLiveCli({ argv, env, log, providerFactory, fetchImpl, readFile, nowMs = Date.now(), sleep }) {
  const flags = checkLiveFlags(argv);
  if (!flags.ok) {
    log('Live run refused: every live flag is required.');
    for (const flag of flags.missing) log(`  missing ${flag}`);
    for (const problem of flags.problems) log(`  ${problem}`);
    log(USAGE);
    return 2;
  }
  const site = parseSite(flagValue(argv, '--site'));
  const rpcUrl = flagValue(argv, '--rpc');
  const loopback = isLoopbackRpc(rpcUrl);
  const deploymentOverride = flagValue(argv, '--deployment');
  if (deploymentOverride !== null && !loopback) {
    log('Live run refused: --deployment is for the local stand-in only (a loopback --rpc). LiteForge always uses the committed address module.');
    return 2;
  }
  let games;
  try {
    games = parseGames(flagValue(argv, '--games'));
  } catch (error) {
    log(`Live run refused: ${error.message}.`);
    return 2;
  }
  const deployment = await loadLitvmDeployment(deploymentOverride);
  if (deployment.status !== 'deployed') {
    log(`Live run refused: the address module is '${deployment.status}', not 'deployed'. Runbook steps 3-8 come first.`);
    return 2;
  }
  // Secrets are read inside this process and never printed (contract §11 rule 13).
  const playerKey = readSecret({ env, argv, shape: 'private-key', envFlag: '--player-key-env', fileFlag: '--player-key-file', fieldFlag: '--player-key-field', label: 'player key', readFile });
  const secondGiven = flagValue(argv, '--second-key-file') !== null || flagValue(argv, '--second-key-env') !== null;
  const secondKey = secondGiven ? readSecret({ env, argv, shape: 'private-key', envFlag: '--second-key-env', fileFlag: '--second-key-file', fieldFlag: '--second-key-field', label: 'second key', readFile }) : null;
  const cronSecret = readSecret({ env, argv, shape: 'secret', envFlag: '--cron-secret-env', fileFlag: '--cron-secret-file', fieldFlag: null, label: 'cron secret', readFile });
  const provider = providerFactory(rpcUrl);
  try {
    const chainId = await rpcChainId(provider);
    if (chainId !== deployment.chainId) {
      log(`Live run refused: the RPC reports chain ${chainId}, expected ${deployment.chainId}.`);
      return 2;
    }
    const player = new ethers.Wallet(playerKey, provider);
    const second = secondKey ? new ethers.Wallet(secondKey, provider) : null;
    if (second && second.address === player.address) {
      log('Live run refused: the second wallet must differ from the player.');
      return 2;
    }
    const api = createFetchApi(site, { fetchImpl });
    const plan = await planLiveRun({ provider, deployment, player: player.address, games, second: second?.address ?? null, api });
    log(`Live Ranked end-to-end on ${site} (chain ${chainId}, RPC ${loopback ? 'loopback stand-in' : new URL(rpcUrl).host}).`);
    log(`Player ${plan.player}, balance ${ethers.formatEther(plan.balanceWei)} zkLTC.`);
    for (const entry of plan.entries) log(`  entry ${entry.gameId}: ${ethers.formatEther(entry.totalWei)} zkLTC (fee ${ethers.formatEther(entry.entryFeeWei)} + reserve ${ethers.formatEther(entry.settlementGasReserveWei)})`);
    log(`  total ${ethers.formatEther(plan.totalWei)} zkLTC in entries, plus gas for ${plan.entries.length} setProfile call(s) (needs about ${ethers.formatEther(plan.neededWei)}).`);
    if (plan.second) {
      log(`Second wallet ${plan.second.wallet}, balance ${ethers.formatEther(plan.second.balanceWei)} zkLTC: one ${plan.second.gameId} entry of ${ethers.formatEther(plan.second.totalWei)} zkLTC for the evidence-copy check (needs about ${ethers.formatEther(plan.second.neededWei)}).`);
    } else {
      log('No second wallet (--second-key-file): the evidence-copy check is skipped, as it needs a second funded wallet.');
    }
    const repeated = Object.entries(plan.priorRuns ?? {}).filter(([, runs]) => runs > 0);
    if (plan.priorRuns === null) log('WARNING: E6 did not answer for the player, so earlier runs could not be checked.');
    for (const [gameId, runs] of repeated) log(`WARNING: the player already has ${runs} confirmed ${gameId} run(s). This run still passes if it is not the wallet's best or earns nothing new, but O2 recommends a fresh wallet.`);
    log('The local-only negative checks (fees off, settlement paused) are skipped on a live target.');
    log(O2_REMINDER);
    if (!hasFlag(argv, '--yes')) {
      log('PLAN ONLY. Nothing was signed or sent. Re-run with --yes to spend testnet zkLTC.');
      return 0;
    }
    if (BigInt(plan.balanceWei) < BigInt(plan.neededWei)) {
      log(`Live run refused: the player balance does not cover the ${plan.entries.length} entr${plan.entries.length === 1 ? 'y' : 'ies'} and the gas margin.`);
      return 2;
    }
    if (plan.second && BigInt(plan.second.balanceWei) < BigInt(plan.second.neededWei)) {
      log('Live run refused: the second wallet\'s balance does not cover its entry and the gas margin.');
      return 2;
    }
    const report = await runRankedE2E({
      target: 'live',
      transport: 'http',
      api,
      chain: { provider, deployment, relayer: deployment.relayer, ...(loopback ? { advanceTime: rpcTimeTravel(provider) } : {}) },
      wallets: { player, ...(second ? { second } : {}) },
      games,
      cronSecret,
      site,
      log,
      sleep,
    });
    report.plan = plan;
    report.o2Reminder = O2_REMINDER;
    const out = resolve(root, flagValue(argv, '--out') ?? `docs/qa/ranked-live-e2e-${todayStamp(nowMs)}.json`);
    if (!hasFlag(argv, '--no-write')) writeJson(out, report);
    for (const line of summarize(report)) log(line);
    log(`${report.ok ? 'PASS' : 'FAIL'}: report ${hasFlag(argv, '--no-write') ? 'not written (--no-write)' : `written to ${out}`}.`);
    log(O2_REMINDER);
    return report.ok ? 0 : 1;
  } finally {
    provider.destroy?.();
  }
}

// ---------------------------------------------------------------------------
// CLI.

export async function runRehearsalCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
  providerFactory = (url) => new ethers.JsonRpcProvider(url, 4441, { staticNetwork: true, cacheTimeout: -1, pollingInterval: isLoopbackRpc(url) ? 100 : 1000 }),
  fetchImpl = globalThis.fetch,
  readFile = undefined,
  nowMs = Date.now(),
  sleep = undefined,
} = {}) {
  const target = flagValue(argv, '--target') ?? 'local';
  if (target === 'live') {
    try {
      return await runLiveCli({ argv, env, log, providerFactory, fetchImpl, readFile, nowMs, sleep });
    } catch (error) {
      // Key-source errors name the flag or file, never the value; nothing else here can carry one.
      if (error instanceof SecretSourceError) log(`Live run refused: ${error.message}`);
      else log(`Live run failed: ${error?.name ?? 'Error'}: ${error?.shortMessage ?? error?.message ?? error}`);
      return error instanceof SecretSourceError ? 2 : 1;
    }
  }
  if (target !== 'local') {
    log(USAGE);
    return 2;
  }
  for (const flag of ['--site', '--rpc', '--player-key-file', '--second-key-file', '--second-key-env', '--games', '--cron-secret-file', '--cron-secret-env', '--confirm-live', '--yes']) {
    if (argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`))) {
      log(`${flag} belongs to --target live; the local target uses fixture keys only.`);
      return 2;
    }
  }
  const summary = await runLocalRehearsal({ log, nowMs, phase2: !hasFlag(argv, '--skip-phase2') });
  for (const run of summary.runs) {
    log(`${run.transport} (${run.target}): ${run.ok ? 'PASS' : 'FAIL'} in ${run.durationMs} ms`);
    for (const line of summarize(run)) log(line);
  }
  if (summary.phase2) log(`phase 2: ${summary.phase2.ok ? 'PASS' : 'FAIL'} (${summary.phase2.steps.filter((step) => step.ok).length}/${summary.phase2.steps.length} steps)`);
  if (!hasFlag(argv, '--no-write')) {
    const out = resolve(root, flagValue(argv, '--out') ?? LOCAL_REPORT_RELATIVE_PATH);
    writeJson(out, summary);
    log(`report written to ${out}`);
  }
  return summary.ok ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  process.exitCode = await runRehearsalCli();
}
