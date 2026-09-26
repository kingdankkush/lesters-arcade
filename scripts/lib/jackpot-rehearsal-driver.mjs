// The Chikun Weekly Jackpot rehearsal driver (jackpot-rehearsal slice; design §E E1, §G; brief AC1).
//
// startJackpotStack() stands up the whole jackpot in this process, with only the database, the chain and
// the clock swapped, exactly as production wires it:
//   - startLocalStack(): the in-process Hardhat chain (4441) with the Ranked suite deployed, activated and
//     fees on, an UNMIGRATED PGlite, and every api/*.mjs module mounted through its A30 seam behind the
//     rewrites read from vercel.json;
//   - deployLocalJackpot(): tCHIKUN and a WeeklyJackpot reading the local suite, with the design §A.5 launch
//     rules (the first epoch adminClearOnly = true, as at runbook E4) and, through the operator CLI
//     (scripts/jackpot-actions.mjs schedule-rules), an epoch with adminClearOnly = false from the next week
//     (the E4 note: the flip-week epoch);
//   - the keeper env wired to the fixture keeper key (JACKPOT_KEEPER_PRIVATE_KEY, JACKPOT_CONTRACT_ADDRESS),
//     the jackpot deployment passed through the server's `jackpotDeployment` seam, and the other two J2 → J3
//     seams (`jackpotSelect`, `keeperFault`) switchable per cron run;
//   - the server clock (every handler's nowMs) bound to CHAIN time: the latest block's time plus the wall
//     time since it, and advanceTo() moves both together (evm_setNextBlockTimestamp, which Hardhat also
//     keeps as its own offset for later blocks). Two clocks that drift would fail A26 at settle and
//     PAYOUT_NOT_DUE at finalize;
//   - runbook E5 on chain: the admin blocks the test wallet, the verifier, the relayer and the prize funder
//     from the owner page's encoding (the residual recipient is the admin, staffEver from the constructor).
// The handlers get a production-shaped deployment (deployer, trustedVerifier and relayer included, as the
// committed LITVM_DEPLOYMENT has them), so the keeper's role-wallet filter sees what it sees in production.
//
// The actors call the contracts exactly as the product does:
//   - the admin, funders and winners through apps/portal/owner/jackpot-review-model.mjs encodeJackpotCall()
//     (the owner page's own call encoding, with the page's fund plan for approve + fund);
//   - the operator through scripts/jackpot-actions.mjs runJackpotAction() (the CLI's planner, role check and
//     confirm phrases), and the owner through scripts/jackpot-ops.mjs runJackpotOps() (Neon);
//   - players through the real Ranked endpoints (rehearsal-driver.mjs signIn, ticketedSession, payEntry,
//     settleUntilConfirmed), with the evidence played for the seed the ticket issued (a bot profile, a
//     scripted pilot, an evasion pilot, or any evidence function of the seed), and their public challenge
//     through submitCandidate on the WeeklyJackpot ABI (the page has no player challenge button).
//
// Keys: the public Hardhat test mnemonic only. Nothing reads the vault, touches LiteForge or Vercel, or
// prints a key or a secret. JACKPOT_LIVE is never touched.

import { ethers } from 'ethers';

import { createHandlerMounts, createInProcessApi, REPO_ROOT, startLocalStack } from './local-stack.mjs';
import { localContracts, loadArtifact } from './local-chain.mjs';
import {
  deployLocalJackpot, derivedFixtureWallet, fastLocalProvider, fixtureKeyAt, jackpotAt, jackpotFixtureWallets, launchRules, reconnectWallets, tokenAt,
} from './local-jackpot.mjs';
import { payEntry, rankedContracts, settleUntilConfirmed, signIn, ticketedSession } from './rehearsal-driver.mjs';
import { evasionPilotFor, humanise } from './chikun-evasion-pilots.mjs';
import { routePilot } from '../chikun-course-pilot.mjs';
import { jackpotModuleValue } from '../generate-litvm-jackpot.mjs';
import { JACKPOT_ACTIONS as CLI_ACTIONS, runJackpotAction } from '../jackpot-actions.mjs';
import { runJackpotOps } from '../jackpot-ops.mjs';
import { buildChikunEvidence } from '../../tests/fixtures/ranked/build-fixtures.mjs';
import { createChikunRuntime, replayChikunRun } from '../../apps/portal/src/chikun-cabinet.mjs';
import { buildChikunSettleRequest } from '../../apps/portal/src/ranked-requests.mjs';
import { parseJackpot } from '../../apps/portal/src/jackpot/jackpot-client.mjs';
import { encodeJackpotCall, fundPlan } from '../../apps/portal/owner/jackpot-review-model.mjs';
import { readCandidates, readWeekActions, readWeekRow } from '../../server/jackpot/store.mjs';
import { boundsOf, weekIndexOf, weekKeyOfIndex, weekStartOf } from '../../server/jackpot/weeks.mjs';

export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const TOKEN = 10n ** 18n;
export const CRON_PATH = '/api/cron/weekly-jackpot';
export const CRON_EVERY_SECONDS = 5 * MINUTE;
export const SIGN_IN_DOMAIN = '127.0.0.1';
export const CHIKUN_STOCK_MAX_TICKS = 216_000;
export const TICKS_PER_MINUTE = 3600;
// Runbook E5: the test wallet every Ranked rehearsal used (blocked on chain as 'test-wallet').
export const TEST_WALLET = '0x8841ae6244dba71f620de450e71b0ef7e0cce824';
// The prize funder of the rehearsal ("Louie"): a fixture wallet, blocked as 'funder' at E5.
export const FUNDER_FIXTURE_INDEX = 20;
// Fresh player wallets (honest players, decoys, snipers) derive from here upwards.
export const FRESH_WALLET_BASE_INDEX = 40;
export const FUNDER_MINT_TOKENS = '1000000';
// The keeper and every other fixture wallet start with this much zkLTC (hardhat_setBalance).
export const KEEPER_BALANCE_WEI = 10n ** 18n;
// A bot run "as E2E_EVIDENCE does": the expert profile, capped at 1.5 minutes.
export const DEFAULT_RUN = Object.freeze({ profile: 'expert', maxMinutes: 1.5 });
// The keeper's receipt window: a dropped transaction is re-read after this long (server/jackpot/keeper.mjs).
export const DROPPED_AFTER_SECONDS = 180;
export const READ_ONLY_TIMEOUTS = Object.freeze({ settleMs: 60_000, readMs: 10_000, maxRunWaitMs: 90 * MINUTE * 1000 });

const lower = (value) => String(value ?? '').toLowerCase();
const ERROR_IFACE = new ethers.Interface(['error Error(string)']);

// ---------------------------------------------------------------------------------------------------
// Revert reasons.

// The revert string of an error thrown by ethers (a call, an estimateGas or a mined revert), or null.
export function revertReasonOf(error) {
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    if (typeof value.reason === 'string' && value.reason) return value.reason;
    if (value.revert?.args?.length) return String(value.revert.args[0]);
    for (const key of ['data', 'error', 'info', 'cause']) {
      const inner = value[key];
      if (typeof inner === 'string' && inner.startsWith('0x08c379a0')) {
        try {
          return ERROR_IFACE.decodeErrorResult('Error', inner)[0];
        } catch {
          // fall through
        }
      }
      const found = visit(inner);
      if (found) return found;
    }
    if (typeof value.message === 'string') {
      const match = /reverted with reason string '([^']+)'/.exec(value.message) ?? /reason="([^"]+)"/.exec(value.message);
      if (match) return match[1];
    }
    return null;
  };
  return visit(error);
}

// eth_call of `tx` (the pending block by default, so a timestamp set with evm_setNextBlockTimestamp applies).
// → null when it would succeed, else the revert string ('reverted' when it has none).
export async function callRevert(provider, tx, { blockTag = 'pending' } = {}) {
  try {
    await provider.call({ ...tx, blockTag });
    return null;
  } catch (error) {
    return revertReasonOf(error) ?? 'reverted';
  }
}

// ---------------------------------------------------------------------------------------------------
// The clock.

// Chain time is the authority: nowMs() = the latest block's time plus the wall time since it was read,
// and never behind the offset the last advanceTo() gave Hardhat (its next blocks follow that offset).
export function createChainClock(provider) {
  let offsetMs = null;
  let latestMs = 0;
  let syncedAtWall = Date.now();
  const clock = {
    nowMs() {
      const wall = Date.now();
      const fromBlock = latestMs + (wall - syncedAtWall);
      return offsetMs === null ? fromBlock : Math.max(fromBlock, wall + offsetMs);
    },
    async sync() {
      const block = await provider.getBlock('latest');
      const ms = Number(block.timestamp) * 1000;
      if (ms >= latestMs) {
        latestMs = ms;
        syncedAtWall = Date.now();
      }
      return clock.nowMs();
    },
    latestSeconds: () => Math.floor(latestMs / 1000),
    setOffset(targetSeconds) {
      offsetMs = targetSeconds * 1000 - Date.now();
    },
  };
  return clock;
}

// '+2h', '+90s', '+1d', '+30m' → seconds; a number is unix seconds; a Date or an ISO string is absolute.
export function parseTimeTarget(value, nowSeconds) {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === 'number') return Math.floor(value);
  const text = String(value ?? '');
  const relative = /^\+(\d+(?:\.\d+)?)([smhd])$/.exec(text);
  if (relative) return nowSeconds + Math.round(Number(relative[1]) * { s: 1, m: MINUTE, h: HOUR, d: DAY }[relative[2]]);
  if (/^\d+$/.test(text)) return Number(text);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) throw new Error(`advanceTo: not a time: ${text}`);
  return Math.floor(parsed / 1000);
}

// ---------------------------------------------------------------------------------------------------
// Evidence for the seed the ticket issued.

function plainEvidence(evidence) {
  return { version: evidence.version, seed: evidence.seed, fixedStepHz: evidence.fixedStepHz, maxTicks: evidence.maxTicks, flapDeltas: [...evidence.flapDeltas] };
}

// A scripted pilot flown until `cutTicks`, then no more flaps (it crashes shortly after).
export function playPilotRun({ seed, pilot = routePilot, cutTicks, maxTicks = CHIKUN_STOCK_MAX_TICKS }) {
  const runtime = createChikunRuntime({ seed, maxTicks });
  while (!runtime.terminal) {
    const snapshot = runtime.snapshot();
    runtime.step({ flap: snapshot.tick < cutTicks ? pilot(snapshot) : false });
  }
  return runtime.result();
}

// The v6 evidence of one run at `seed`. Exactly one source:
//   profile: a chikun-bots.mjs player model ('novice' … 'exceptional'), capped at maxMinutes;
//   pilot:   'route' (the scripted routePilot on the visible course: design §B.4 set (a)), 'route-humanised'
//            (routePilot with the naive humanisation), or an evasion pilot name ('humanisedSolver',
//            'widenedViewPilot'), cut at maxMinutes;
//   evidence: a function (seed) → a v6 evidence object (or a runtime result).
// → { flap, score, survivalTicks, source }
export function evidenceForSeed({ seed, profile = null, pilot = null, evidence = null, maxMinutes = DEFAULT_RUN.maxMinutes, maxTicks = CHIKUN_STOCK_MAX_TICKS }) {
  const cutTicks = Math.round(maxMinutes * TICKS_PER_MINUTE);
  if (typeof evidence === 'function') {
    const produced = evidence(seed);
    const flap = produced?.evidence ?? produced?.flap ?? produced;
    const replayed = replayChikunRun(flap);
    return { flap: plainEvidence(flap), score: replayed.score, survivalTicks: replayed.survivalTicks, source: 'custom' };
  }
  if (pilot) {
    let result;
    if (pilot === 'route') result = playPilotRun({ seed, cutTicks, maxTicks });
    else if (pilot === 'route-humanised') result = playPilotRun({ seed, cutTicks, maxTicks, pilot: humanise(routePilot, { seed, label: 'rehearsal' }) });
    else result = playPilotRun({ seed, cutTicks, maxTicks, pilot: evasionPilotFor(pilot, { seed }) });
    return { flap: plainEvidence(result.evidence), score: result.score, survivalTicks: result.survivalTicks, source: `pilot:${pilot}` };
  }
  const built = buildChikunEvidence({ seed, profile: profile ?? DEFAULT_RUN.profile, maxMinutes, maxTicks });
  return { flap: plainEvidence(built.flap), score: built.score, survivalTicks: built.survivalTicks, source: `bot:${profile ?? DEFAULT_RUN.profile}` };
}

// ---------------------------------------------------------------------------------------------------
// The stack.

function productionShapedDeployment(stack) {
  const record = stack.record;
  return Object.freeze({
    ...stack.deployment,
    deployer: lower(record.deployer),
    trustedVerifier: lower(record.trustedVerifier),
    relayer: lower(record.relayer),
  });
}

// Starts the local jackpot stack. Options:
//   log                  progress lines
//   adminClearOnlyFirst  the first epoch's adminClearOnly (true, as the launch rules and runbook E4-E9)
//   scheduleOpenEpoch    schedule adminClearOnly = false from firstWeek + 1 through the operator CLI (true)
//   e5                   run the E5 block list from the admin wallet (true)
export async function startJackpotStack({ log = () => {}, adminClearOnlyFirst = true, scheduleOpenEpoch = true, e5 = true } = {}) {
  const stack = await startLocalStack({ log });
  const provider = fastLocalProvider(stack.chain);
  try {
    const base = reconnectWallets(stack.wallets, provider);
    const fixtures = await jackpotFixtureWallets(provider);
    const funder = await derivedFixtureWallet(provider, FUNDER_FIXTURE_INDEX);
    const wallets = { ...base, ...reconnectWallets(fixtures, provider), funder };
    const clock = createChainClock(provider);
    await clock.sync();

    // A Tuesday, so the setup never straddles a Monday; the jackpot's first week is the next one.
    const latest = clock.latestSeconds();
    const tuesday = weekStartOf(weekIndexOf(latest) + 1) + DAY + 12 * HOUR;
    await provider.send('evm_setNextBlockTimestamp', [tuesday]);
    await provider.send('evm_mine', []);
    clock.setOffset(tuesday);
    await clock.sync();

    const deployed = await deployLocalJackpot({
      provider, wallets, record: stack.record, rules: { ...launchRules(stack.record), adminClearOnly: adminClearOnlyFirst },
    });
    const js = createJackpotHarness({ stack, provider, wallets, clock, deployed, log });
    await js.syncInstanceEnv();
    // Keeper gas at runbook scale (the design asks for >= 0.05 zkLTC; the rehearsal gives it 1).
    await provider.send('hardhat_setBalance', [wallets.keeper.address, ethers.toQuantity(KEEPER_BALANCE_WEI)]);
    // E8: tCHIKUN for the funder ("Louie") and the admin, minted by the operator through the CLI.
    await js.operatorAction('mint-test', { argv: ['--to', funder.address, '--amount', FUNDER_MINT_TOKENS] });
    await js.operatorAction('mint-test', { argv: ['--to', wallets.developer.address, '--amount', FUNDER_MINT_TOKENS] });
    // E4 note: the flip-week epoch with adminClearOnly = false, scheduled by the operator.
    if (scheduleOpenEpoch) {
      await js.operatorAction('schedule-rules', { argv: ['--from-week', String(js.firstWeek + 1), '--admin-clear-only', 'false'] });
    }
    // E5 from the owner page (admin wallet): the test wallet, the verifier, the relayer and the funder.
    if (e5) {
      await js.admin('block', { wallet: TEST_WALLET, reason: 'test-wallet' });
      await js.admin('block', { wallet: wallets.verifier.address, reason: 'staff' });
      await js.admin('block', { wallet: wallets.relayer.address, reason: 'staff' });
      await js.admin('block', { wallet: funder.address, reason: 'funder' });
    }
    // The first cron run migrates nothing (the stack's handlers did) and indexes the rules and staff.
    const first = await js.runJackpotCron(1);
    if (first[0]?.status !== 200) throw new Error(`the first weekly-jackpot run answered ${first[0]?.status}: ${JSON.stringify(first[0]?.body)}`);
    log(`jackpot stack: WeeklyJackpot ${js.address}, tCHIKUN ${js.tokenAddress}, first week ${weekKeyOfIndex(js.firstWeek)} (index ${js.firstWeek})`);
    return js;
  } catch (error) {
    provider.destroy();
    await stack.close().catch(() => {});
    throw error;
  }
}

function createJackpotHarness({ stack, provider, wallets, clock, deployed, log }) {
  const env = stack.env;
  const db = stack.db;
  const deployment = productionShapedDeployment(stack);
  const registry = lower(deployment.addresses.scoreSubmissionRegistry);
  const seams = { select: null, fault: null };
  const instance = { record: deployed.record, keeperKey: fixtureKeyAt(8) };
  let walletIndex = FRESH_WALLET_BASE_INDEX;
  const labels = new Map();

  const js = {
    stack,
    provider,
    db,
    env,
    clock,
    deployment,
    record: stack.record,
    wallets,
    seams,
    labels,
    log,
    registry,
    domain: SIGN_IN_DOMAIN,
    adminWallet: wallets.developer,
    keeperWallet: wallets.keeper,
    // Every address that held the admin or keeper role in this rehearsal (the receipt's role counts).
    adminWallets: new Set([lower(wallets.developer.address)]),
    keeperAddresses: new Set([lower(wallets.keeper.address)]),
    get jackpotRecord() { return instance.record; },
    get module() { return jackpotModuleValue(instance.record); },
    get address() { return lower(instance.record.instances.chikun.address); },
    get tokenAddress() { return lower(instance.record.instances.chikun.token.address); },
    get firstWeek() { return Number(instance.record.instances.chikun.firstWeek); },
    get jackpot() { return jackpotAt(js.address, provider); },
    get token() { return tokenAt(js.tokenAddress, provider); },
    ranked: rankedContracts(deployment, provider),
    suite: localContracts(stack.record, provider),
  };

  // --- Handlers: every api/*.mjs module, with the jackpot seams, on the chain clock. ---------------
  const overrides = () => ({
    db, provider, deployment, nowMs: clock.nowMs,
    jackpotDeployment: js.module,
    jackpotSelect: seams.select ?? undefined,
    keeperFault: seams.fault ?? undefined,
    // S10 (cross-wallet funding) is a best-effort RPC read of an explorer; offline here.
    fundingLookup: null,
  });
  const handlerFor = createHandlerMounts({ root: REPO_ROOT, env, overrides });
  js.handlerFor = handlerFor;
  js.api = createInProcessApi({ router: stack.router, handlerFor, beforeRequest: () => clock.sync() });
  // What startLocalHttp() needs to serve this stack over real HTTP (the live dry run's tests).
  js.httpStack = { env, handlerFor, syncClock: () => clock.sync(), allowDomain: stack.allowDomain, db, deployment };

  js.syncInstanceEnv = async () => {
    env.JACKPOT_KEEPER_PRIVATE_KEY = instance.keeperKey;
    env.JACKPOT_CONTRACT_ADDRESS = js.address;
  };
  // Switches the server to another instance (R9's blacklist-token instance), and back.
  js.useInstance = async ({ record, keeperKey = instance.keeperKey } = {}) => {
    const previous = { record: instance.record, keeperKey: instance.keeperKey };
    instance.record = record;
    instance.keeperKey = keeperKey;
    await js.syncInstanceEnv();
    return previous;
  };
  js.setKeeperKey = async (key) => {
    instance.keeperKey = key;
    js.keeperWallet = new ethers.Wallet(key, provider);
    js.keeperAddresses.add(lower(js.keeperWallet.address));
    await js.syncInstanceEnv();
  };
  js.setAdminWallet = (wallet) => {
    js.adminWallet = wallet;
    js.adminWallets.add(lower(wallet.address));
  };
  // After a role change (set-keeper, force-admin) the owner commits the updated deployment record and
  // regenerates the module; the live dry run's `roles` check compares the chain with that record.
  js.recordRoles = ({ admin = null, keeper = null } = {}) => {
    const chikun = instance.record.instances.chikun;
    instance.record = {
      ...instance.record,
      instances: { ...instance.record.instances, chikun: { ...chikun, ...(admin ? { admin: ethers.getAddress(admin) } : {}), ...(keeper ? { keeper: ethers.getAddress(keeper) } : {}) } },
    };
  };

  // --- Time. --------------------------------------------------------------------------------------
  js.now = () => clock.latestSeconds();
  js.nowMs = () => clock.nowMs();
  // Moves the chain and the server clock together. `mine: false` leaves the next block at exactly the
  // target (the next transaction lands there). Time never moves back.
  js.advanceTo = async (target, { mine = true } = {}) => {
    await clock.sync();
    const latest = clock.latestSeconds();
    const seconds = parseTimeTarget(target, latest);
    if (seconds <= latest) return latest;
    await provider.send('evm_setNextBlockTimestamp', [seconds]);
    if (mine) await provider.send('evm_mine', []);
    clock.setOffset(seconds);
    await clock.sync();
    return seconds;
  };
  js.advanceBy = async (seconds, options) => js.advanceTo(clock.latestSeconds() + Math.max(1, Math.ceil(seconds)), options);
  js.bounds = (week, extension = 0) => boundsOf(week, extension);
  // A week's moment: 'start' | 'close' | 'settleCutoff' | 'candidateUntil' | 'payoutAt', plus seconds.
  js.at = (week, anchor = 'start', offset = 0, extension = 0) => {
    const bounds = boundsOf(week, extension);
    if (!Object.hasOwn(bounds, anchor)) throw new Error(`unknown anchor ${anchor}`);
    return bounds[anchor] + offset;
  };
  js.currentWeek = () => weekIndexOf(clock.latestSeconds());
  js.weekKey = (week) => weekKeyOfIndex(week);
  // The first week after the current one that no scenario has used, never the instance's first week (the
  // soft-launch epoch: beginFirstWeek plays that one): the chain moves to its Monday + `offset`.
  js.lastUsedWeek = null;
  js.beginWeek = async ({ offset = HOUR } = {}) => {
    const current = js.currentWeek();
    const next = Math.max(current + 1, (js.lastUsedWeek ?? 0) + 1, js.firstWeek + 1);
    js.lastUsedWeek = next;
    await js.advanceTo(weekStartOf(next) + offset);
    return next;
  };
  js.claimWeek = (week) => { js.lastUsedWeek = Math.max(js.lastUsedWeek ?? 0, week); return week; };
  // The instance's first week itself (the soft-launch epoch, adminClearOnly = true, runbook E9): the stack
  // starts on the Tuesday before it, so only a scenario that runs before any other week is used can play it.
  js.beginFirstWeek = async ({ offset = HOUR } = {}) => {
    const first = js.firstWeek;
    if (js.currentWeek() >= first || (js.lastUsedWeek ?? 0) >= first) throw new Error(`the first week ${weekKeyOfIndex(first)} has already started: play it before any other week`);
    js.lastUsedWeek = first;
    await js.advanceTo(weekStartOf(first) + offset);
    return first;
  };

  // --- Wallets. -------------------------------------------------------------------------------------
  js.freshWallet = async (label) => {
    const wallet = await derivedFixtureWallet(provider, walletIndex);
    walletIndex += 1;
    labels.set(lower(wallet.address), label);
    return wallet;
  };
  js.freshWallets = async (count, prefix) => {
    const out = [];
    for (let index = 0; index < count; index += 1) out.push(await js.freshWallet(`${prefix} ${index + 1}`));
    return out;
  };
  js.label = (address) => labels.get(lower(address)) ?? null;

  // --- Contract calls from the owner page's encoding. ---------------------------------------------
  // → { ok, reason, hash, receipt, blockTimestamp }. Like the page, it reads the call first (eth_call on the
  // pending block) and sends nothing when the chain would refuse it (the reason is returned).
  js.pageCall = async (wallet, action, params = {}, { token = js.tokenAddress, jackpot = js.address } = {}) => {
    const call = encodeJackpotCall(ethers, action, params, { jackpot, token });
    return js.sendCall(wallet, call);
  };
  js.sendCall = async (wallet, call) => {
    const reason = await callRevert(provider, { from: wallet.address, ...call });
    if (reason) return { ok: false, reason };
    const tx = await wallet.sendTransaction(call);
    const receipt = await tx.wait();
    const block = await provider.getBlock(receipt.blockNumber);
    return { ok: receipt.status === 1, reason: null, hash: lower(tx.hash), receipt, blockTimestamp: Number(block.timestamp) };
  };
  // Sends `call` ON CHAIN even though it reverts (a fixed gas limit skips the estimate), optionally at an
  // exact block time, and returns the revert string (from the same pending-block call) and the mined status.
  js.sendReverting = async (wallet, call, { at = null } = {}) => {
    if (at !== null) await js.advanceTo(at, { mine: false });
    const reason = await callRevert(provider, { from: wallet.address, ...call });
    const from = lower(await wallet.getAddress());
    const nonce = await provider.getTransactionCount(from, 'pending');
    let receipt = null;
    try {
      const tx = await wallet.sendTransaction({ ...call, gasLimit: 1_500_000n, nonce });
      receipt = await tx.wait();
    } catch (error) {
      // Hardhat mines a reverting transaction and still answers the send with an error: find it by nonce.
      receipt = error?.receipt ?? null;
      if (!receipt) {
        const block = await provider.getBlock('latest', true);
        const mined = (block?.prefetchedTransactions ?? []).find((tx) => lower(tx.from) === from && tx.nonce === nonce);
        if (mined) receipt = await provider.getTransactionReceipt(mined.hash);
      }
    }
    const blockTimestamp = receipt ? Number((await provider.getBlock(receipt.blockNumber)).timestamp) : null;
    await clock.sync();
    return { reason, minedStatus: receipt ? receipt.status : null, blockTimestamp, txHash: receipt ? lower(receipt.hash) : null };
  };
  js.admin = (action, params = {}, options = {}) => js.pageCall(options.from ?? js.adminWallet, action, params, options);
  js.jackpotCall = (method, args = [], { jackpot = js.address } = {}) => ({ to: jackpot, data: jackpotAt(jackpot, provider).interface.encodeFunctionData(method, args) });
  // A player's public challenge (design J2): submitCandidate from the player's own wallet.
  js.submitCandidate = (wallet, sessionId32, { jackpot = js.address } = {}) => js.sendCall(wallet, js.jackpotCall('submitCandidate', [sessionId32], { jackpot }));
  // Funding as the owner page does it: the fund plan (exact approve, never unlimited), then fund(week, amount).
  js.fund = async (week, amountWei, { from = wallets.funder, jackpot = js.address, token = js.tokenAddress } = {}) => {
    const contract = jackpotAt(jackpot, provider);
    const erc20 = tokenAt(token, provider);
    const [current, first, end, rules, balance, allowance] = await Promise.all([
      contract.currentWeek(), contract.firstWeek(), contract.endAfterWeek(), contract.rulesFor(week), erc20.balanceOf(from.address), erc20.allowance(from.address, jackpot),
    ]);
    const plan = fundPlan({ week, currentWeek: Number(current), firstWeek: Number(first), endAfterWeek: Number(end), amountWei, minFundWei: rules.minFundWei, balanceWei: balance, allowanceWei: allowance });
    if (!plan.ok) return { ok: false, reason: plan.problems.join(' '), plan };
    if (plan.needsApprove) {
      const approved = await js.pageCall(from, 'approve', { amountWei: plan.approveWei }, { token, jackpot });
      if (!approved.ok) return { ...approved, plan };
    }
    const funded = await js.pageCall(from, 'fund', { week, amountWei: plan.amountWei }, { token, jackpot });
    return { ...funded, plan };
  };
  js.claim = (winner, week, to, options = {}) => js.pageCall(winner, 'claim', { week, to }, options);

  // --- Operator (scripts/jackpot-actions.mjs) and owner (scripts/jackpot-ops.mjs). -----------------
  js.operatorAction = async (action, { args = [], argv = [], signer = wallets.operator, module = js.module, instanceAddress = null, broadcast = true } = {}) => {
    const spec = CLI_ACTIONS[action];
    if (!spec) throw new Error(`unknown jackpot action ${action}`);
    const lines = [];
    const result = await runJackpotAction({ action, args, argv, provider, module, signer, broadcast, confirm: spec.confirm, instanceAddress, log: (line) => lines.push(line) });
    await clock.sync();
    return { ...result, lines };
  };
  js.jackpotOps = async (argv) => {
    const out = [];
    const result = await runJackpotOps({ argv, db, out: (line) => out.push(line), nowMs: clock.nowMs() });
    return { ...result, out };
  };

  // --- Players (the real Ranked endpoints). -----------------------------------------------------------
  js.driverContext = () => ({
    api: js.api,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => { setTimeout(resolve, Math.min(ms, 15)); }),
    timeouts: READ_ONLY_TIMEOUTS,
    chain: { advanceTime: (seconds) => js.advanceBy(seconds) },
    log,
  });

  // AC1: sign in → seed ticket (logged by the server) → pay the entry at a chosen chain time → evidence for
  // the issued seed → chain time to settleAt (default just past openedAt + survival) → settle until confirmed.
  // `settle: false` stops after the entry and returns the body and a token for the caller to settle.
  js.playRankedChikunRun = async ({
    player, openedAt = null, profile = null, pilot = null, evidence = null, maxMinutes = DEFAULT_RUN.maxMinutes, maxTicks = CHIKUN_STOCK_MAX_TICKS,
    settleAt = null, settleAfterSeconds = 5, settle = true, label = null,
  }) => {
    if (label) labels.set(lower(player.address), label);
    if (openedAt !== null) {
      const latest = clock.latestSeconds();
      if (openedAt <= latest) throw new Error(`openedAt ${openedAt} is not after the chain's latest block ${latest}`);
      // The ticket is issued a little before the entry (A26 allows 120 s before and 1,800 s after).
      await js.advanceTo(Math.max(latest + 1, openedAt - 20));
    }
    const token = await signIn({ api: js.api, wallet: player, domain: js.domain });
    const ticketed = await ticketedSession({ api: js.api, token, wallet: player, gameId: 'chikun', scoreRegistryAddress: registry });
    if (ticketed.ticket.status !== 200) throw new Error(`E15 refused the seed ticket: ${ticketed.ticket.status} ${JSON.stringify(ticketed.ticket.body)}`);
    const { session, sessionId32 } = ticketed;
    if (openedAt !== null) await js.advanceTo(openedAt, { mine: false });
    const entry = await payEntry({ contracts: js.ranked, player, gameId: 'chikun', sessionId32 });
    await clock.sync();
    if (entry.status !== 1 || !entry.isPaid) throw new Error('the Ranked entry was not paid');
    session.entryReceipt = { txHash: entry.txHash, sessionId32, amountWei: entry.amountWei, status: 'confirmed' };
    const played = evidenceForSeed({ seed: session.seed, profile, pilot, evidence, maxMinutes, maxTicks });
    const body = await buildChikunSettleRequest({ session, scoreRegistryAddress: registry, evidence: played.flap, claimScore: played.score });
    const survivalSeconds = Math.floor(played.survivalTicks / 60);
    const run = {
      wallet: lower(player.address), label: labels.get(lower(player.address)) ?? null, sessionId32: lower(sessionId32), sessionHandle: session.sessionId, seed: session.seed,
      openedAt: entry.openedAt, entryTxHash: entry.txHash, paidWei: entry.paidAmountWei, expectedScore: played.score, survivalSeconds, maxTicks: played.flap.maxTicks,
      source: played.source, flaps: played.flap.flapDeltas.length, body, player, session,
    };
    if (!settle) return run;
    return js.settleRun(run, { settleAt: settleAt ?? entry.openedAt + survivalSeconds + settleAfterSeconds });
  };

  // Plays a paid-but-unsettled run again on the SAME issued seed (a banked session played later).
  js.replayRun = async (run, options) => {
    const played = evidenceForSeed({ seed: run.seed, ...options });
    const body = await buildChikunSettleRequest({ session: run.session, scoreRegistryAddress: registry, evidence: played.flap, claimScore: played.score });
    return { ...run, body, expectedScore: played.score, survivalSeconds: Math.floor(played.survivalTicks / 60), maxTicks: played.flap.maxTicks, source: played.source, flaps: played.flap.flapDeltas.length };
  };

  // Settles a played run at `settleAt` (the relayer's transaction lands at exactly that block time).
  js.settleRun = async (run, { settleAt = null } = {}) => {
    if (settleAt !== null) await js.advanceTo(settleAt, { mine: false });
    const token = await signIn({ api: js.api, wallet: run.player, domain: js.domain });
    const settled = await settleUntilConfirmed(js.driverContext(), { body: run.body, token });
    await clock.sync();
    const record = await js.ranked.scores.getSession(run.sessionId32);
    return {
      ...run,
      score: settled.view.score,
      settleTxHash: settled.view.txHash,
      submittedAt: Number(record.submittedAt),
      settleAttempts: settled.attempts.length,
    };
  };
  // POST /api/settle once and return the raw answer (for runs the server must refuse).
  js.postSettle = async (run) => {
    const token = await signIn({ api: js.api, wallet: run.player, domain: js.domain });
    return js.api('POST', '/api/settle', { headers: { authorization: `Bearer ${token}` }, body: run.body });
  };

  // --- The cron. -------------------------------------------------------------------------------------
  // Runs GET /api/cron/weekly-jackpot `times` times, `every` seconds of chain time apart (5 minutes, the
  // Vercel schedule), with the jackpotSelect / keeperFault seams for these runs when given.
  js.runJackpotCron = async (times = 1, { select, fault, every = CRON_EVERY_SECONDS } = {}) => {
    const results = [];
    for (let index = 0; index < times; index += 1) {
      if (index > 0) await js.advanceBy(every);
      const previous = { select: seams.select, fault: seams.fault };
      if (select !== undefined) seams.select = select;
      if (fault !== undefined) seams.fault = fault;
      try {
        results.push(await js.api('GET', CRON_PATH, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }));
      } finally {
        seams.select = previous.select;
        seams.fault = previous.fault;
      }
    }
    return results;
  };
  // Runs the cron (5 minutes apart) until `predicate()` holds. → the number of runs, or null.
  js.cronUntil = async (predicate, { max = 6, every = CRON_EVERY_SECONDS, select, fault } = {}) => {
    for (let run = 1; run <= max; run += 1) {
      if (run > 1) await js.advanceBy(every);
      // eslint-disable-next-line no-await-in-loop
      const [response] = await js.runJackpotCron(1, { select, fault });
      js.lastCron = response;
      // eslint-disable-next-line no-await-in-loop
      if (await predicate(response)) return run;
    }
    return null;
  };
  // A keeperFault that throws once, at `stage`, for the first action of `kind` (any kind when null) it sees.
  js.faultOnce = ({ stage, kind = null, sessionId32 = null }) => {
    const state = { fired: null };
    const fault = async (at) => {
      if (state.fired || at !== stage) return;
      const [row] = await db.query(
        "SELECT id, kind, session_id32, tx_hash, tx_nonce FROM jackpot_actions WHERE status = 'submitted' ORDER BY updated_at DESC, id DESC LIMIT 1",
      );
      if (!row) return;
      if (kind && row.kind !== kind) return;
      if (sessionId32 && row.session_id32 !== lower(sessionId32)) return;
      state.fired = { stage, id: row.id, kind: row.kind, txHash: row.tx_hash, nonce: row.tx_nonce === null ? null : Number(row.tx_nonce) };
      throw Object.assign(new Error(`rehearsal keeperFault at ${stage}`), { code: 'REHEARSAL_FAULT' });
    };
    fault.state = state;
    return fault;
  };

  // --- Reads. ----------------------------------------------------------------------------------------
  js.weekRow = (week, contract = js.address) => readWeekRow(db, { contract, weekKey: weekKeyOfIndex(week) });
  js.candidateRows = (week, contract = js.address) => readCandidates(db, { contract, weekKey: weekKeyOfIndex(week) });
  js.actionRows = (week, contract = js.address) => readWeekActions(db, { contract, weekKey: weekKeyOfIndex(week) });
  js.chainWeek = async (week, jackpot = js.jackpot) => {
    const [state, pot, list, leader, bounds] = await Promise.all([jackpot.weekState(week), jackpot.potOf(week), jackpot.candidatesOf(week), jackpot.leaderOf(week), jackpot.weekBounds(week)]);
    return {
      status: ['open', 'paid', 'rolled'][Number(state.status)] ?? String(state.status),
      held: state.held,
      count: Number(state.count),
      winner: lower(state.winner),
      winningSession: lower(state.winningSession),
      prize: BigInt(state.prize),
      unclaimed: BigInt(state.unclaimed),
      extension: Number(state.extension),
      pot: { funded: BigInt(pot.funded), carriedIn: BigInt(pot.carriedIn), total: BigInt(pot.total) },
      list: list.map((row) => ({ sessionId32: lower(row.sessionId), player: lower(row.player), score: Number(row.score), submittedAt: Number(row.submittedAt) })),
      leader: lower(leader.sessionId) === ethers.ZeroHash ? null : { sessionId32: lower(leader.sessionId), player: lower(leader.player), score: Number(leader.score), review: ['none', 'cleared', 'flagged', 'disqualified'][Number(leader.review)] },
      payoutAt: Number(bounds.payoutAt),
      settleCutoff: Number(bounds.settleCutoff),
    };
  };
  js.review = async (sessionId32, jackpot = js.jackpot) => ['none', 'cleared', 'flagged', 'disqualified'][Number(await jackpot.reviewOf(sessionId32))];
  js.checkEligibility = async (sessionId32, jackpot = js.jackpot) => {
    const [ok, week, reason] = await jackpot.checkEligibility(sessionId32);
    return { ok, week: Number(week), reason };
  };
  // GET /api/jackpot through the UI's parser. → { status, body, api (parseJackpot result or null) }
  js.jackpotApi = async (query = '') => {
    const response = await js.api('GET', `/api/jackpot${query}`);
    return { status: response.status, headers: response.headers, body: response.body, api: response.status === 200 ? parseJackpot(response.body) : null };
  };
  js.health = async () => (await js.api('GET', '/api/health')).body;
  js.profile = async (wallet) => (await js.api('GET', `/api/profile?wallet=${lower(wallet)}`)).body;
  // GET /api/jackpot/review as `wallet` (a real SIWE sign-in).
  js.reviewApi = async (week, wallet = js.adminWallet) => {
    const token = await signIn({ api: js.api, wallet, domain: js.domain });
    return js.api('GET', `/api/jackpot/review?week=${weekKeyOfIndex(week)}`, { headers: { authorization: `Bearer ${token}` } });
  };
  js.tokenBalance = async (address, token = js.tokenAddress) => BigInt(await tokenAt(token, provider).balanceOf(address));
  js.invariant = async (jackpot = js.jackpot, token = null) => {
    const tokenAddress = token ?? lower(await jackpot.token());
    const [balance, liabilities] = await Promise.all([tokenAt(tokenAddress, provider).balanceOf(await jackpot.getAddress()), jackpot.liabilities()]);
    return { balanceWei: BigInt(balance).toString(), liabilitiesWei: BigInt(liabilities).toString(), ok: BigInt(balance) >= BigInt(liabilities) };
  };
  js.nonceOf = async (address) => provider.getTransactionCount(address, 'latest');
  js.blockNumber = async () => provider.getBlockNumber();
  // Every transaction mined in blocks (from, to], by sender, with the gas used and the status.
  js.transactionsBetween = async (fromBlock, toBlock) => {
    const out = [];
    for (let number = fromBlock + 1; number <= toBlock; number += 1) {
      // eslint-disable-next-line no-await-in-loop
      const block = await provider.getBlock(number, true);
      for (const tx of block?.prefetchedTransactions ?? []) {
        // eslint-disable-next-line no-await-in-loop
        const receipt = await provider.getTransactionReceipt(tx.hash);
        out.push({ hash: lower(tx.hash), from: lower(tx.from), to: lower(tx.to), nonce: tx.nonce, gasUsed: BigInt(receipt.gasUsed), status: receipt.status, block: number, data: tx.data.slice(0, 10) });
      }
    }
    return out;
  };

  js.close = async () => {
    provider.destroy();
    await stack.close();
  };
  return js;
}

// The WeeklyJackpot ABI of another instance (R9, R19) connected to `runner`.
export function jackpotContract(address, runner) {
  return new ethers.Contract(address, loadArtifact('WeeklyJackpot').abi, runner);
}
