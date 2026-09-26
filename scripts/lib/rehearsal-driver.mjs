// End-to-end Ranked driver (rehearsal slice; guide §5.14 item 6, §7 step 9; contract §13 step 9).
//
// runRankedE2E() plays ONE Ranked session per game through the real HTTP endpoints and the real
// contracts, and returns a JSON report. It is target-agnostic:
//   - `api(method, path, { headers, body })` → { status, headers, body } is either the local stack's
//     in-process client (scripts/lib/local-stack.mjs) or createFetchApi(origin) over real HTTP (the
//     local-http stand-in, or https://lestersarcade.io at runbook step 9);
//   - `chain` is { provider, deployment, relayer, advanceTime? }: an ethers provider (the in-process
//     chain, the local JSON-RPC proxy, or LiteForge) and the deployment addresses. `advanceTime` exists
//     only on a local chain; without it the driver waits real (wall-clock) time, as a live run must:
//     LiteForge is an Arbitrum Orbit chain that makes blocks only for transactions, so its latest block
//     time can stand still while the server compares its own clock with openedAt (A26);
//   - `wallets.player` is the paying player (an ethers signer). `wallets.second` (optional, on any
//     target) is a second funded wallet for the evidence-copy check, which is reported as skipped
//     without one. The driver itself creates an EPHEMERAL wallet, never funded, for the 403 check;
//   - `now` and `sleep` (default Date.now and setTimeout) are the driver's wall clock, injectable so
//     the real-time path is testable without waiting.
//
// A wallet may rehearse more than once (a retry of runbook step 9, or several runs in one week). E5
// shows only each wallet's best confirmed run of the period (D1), and first-run achievements unlock
// once. A run that is not the wallet's best, or that earns nothing new, is therefore recorded as such
// (with the wallet's best row and its prior achievements) instead of failing; the run itself is still
// proven confirmed on E4, E9 and the chain.
//
// Per game it asserts every item of guide §7 step 9 as amended (rehearsal brief, acceptance 1):
// startPlaySession → SIWE (E1, E2) → seed ticket (E15, applySeedTicket, rankedIdentityFor,
// rankedSessionKey) → quoteEntry + openSession + isPaid → evidence played at the ticket seed with the
// verify slice's generators → chain time past the run length → E3 then E4 until confirmed → getSession
// and sessionEnvelopeHash → E5 weekly row → E6 stats and achievements → E9 cardRev, E10 tags → E11 PNG
// → setProfile + E8 → E12 twice. The negative checks follow; the local-only ones (fees off, pause)
// run only with `target: 'local'` and the stack's operator levers.
//
// Secrets: the driver never logs or reports a token, a key, a seed-ticket MAC or the cron secret.

import { ethers } from 'ethers';

import { startPlaySession } from '../../apps/portal/src/arcade-core.mjs';
import { buildSiweChallenge } from '../../apps/portal/src/wallet-auth.mjs';
import { RANKED_GAMES, RANKED_SETTLE_VERSION, applySeedTicket, rankedIdentityFor, rankedSessionKey, shareIdFor } from '../../apps/portal/src/ranked-identity.mjs';
import { buildChikunSettleRequest, buildHmhSettleRequest, buildStackedSettleRequest } from '../../apps/portal/src/ranked-requests.mjs';
import { normalizeHandle } from '../../apps/portal/src/profile-chain.mjs';
import { moderateName } from '../../apps/portal/src/name-moderation.mjs';
import { buildChikunEvidence, buildHmhEvidence, buildStackedEvidence } from '../../tests/fixtures/ranked/build-fixtures.mjs';
import { loadArtifact } from './local-chain.mjs';
import { DEFAULT_MIN_PAID_WEI } from '../../server/config.mjs';

export const REHEARSAL_REPORT_SCHEMA = 'lesters-ranked-e2e-report-v1';
export const DEFAULT_GAMES = Object.freeze(['lester-blaster', 'chikun', 'stacked']);
export const SHARE_ORIGIN = 'https://lestersarcade.io';
// The server's settle floor (fee + reserve): an entry quote below it would be refused at settle.
export const MIN_PAID_WEI = BigInt(DEFAULT_MIN_PAID_WEI);
// The brief's runs: Chikun 1-2 minutes of bot play (v6), STACKED a short terminal SIC1 run topping
// out at tick 3600, HMH the verify slice's "valid" reboot summary (about 3 minutes).
export const E2E_EVIDENCE = Object.freeze({
  chikun: Object.freeze({ profile: 'expert', maxMinutes: 1.5 }),
  stacked: Object.freeze({ topOutAtTick: 3600 }),
  'lester-blaster': Object.freeze({ plan: 'valid' }),
});
// On-chain names: one per game, so each run renames, plus a 4-character tag derived from the wallet
// over the digits 2, 6, 8 and 9 (which name moderation never folds into letters), so two wallets
// rehearsing on one chain do not collide on a handle ("Handle taken"). At most 16 bytes.
export const PROFILE_NAME_PREFIXES = Object.freeze({ 'lester-blaster': 'E2E HMH', chikun: 'E2E Chikun', stacked: 'E2E Stacked' });
export function profileNameFor(gameId, wallet) {
  const hex = lower(wallet).replace(/^0x/, '');
  const tag = [...hex.slice(0, 4)].map((nibble) => '2689'[parseInt(nibble, 16) % 4]).join('');
  return `${PROFILE_NAME_PREFIXES[gameId]} ${tag}`;
}
export const PROFILE_AVATARS = Object.freeze({ 'lester-blaster': 'lit-commando', chikun: 'chikun', stacked: 'gold-emblem' });
export const DEFAULT_TIMEOUTS = Object.freeze({ settleMs: 120_000, readMs: 60_000, maxRunWaitMs: 15 * 60_000 });
export const CRON_PATH = '/api/cron/index-chain';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEX32 = /^0x[0-9a-f]{64}$/;

class CheckFailure extends Error {
  constructor(id, detail) {
    super(`${id} failed${detail ? `: ${detail}` : ''}`);
    this.name = 'CheckFailure';
    this.checkId = id;
  }
}

const lower = (value) => String(value ?? '').toLowerCase();
const brief = (value) => {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text && text.length > 240 ? `${text.slice(0, 240)}…` : text;
  } catch {
    return String(value);
  }
};
const errorCode = (response) => (response?.body && typeof response.body === 'object' ? response.body.error ?? null : null);

// ---------------------------------------------------------------------------
// HTTP client for a real origin (the local-http stand-in or the live site).

export function createFetchApi(origin, { fetchImpl = globalThis.fetch, timeoutMs = 60_000 } = {}) {
  const base = new URL(String(origin));
  if (base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('the API origin must be a bare origin such as https://lestersarcade.io');
  return async function api(method, path, { headers = {}, body } = {}) {
    const init = { method: String(method).toUpperCase(), headers: { accept: 'application/json, text/html, image/png;q=0.9, */*;q=0.1', ...headers }, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) };
    if (body !== undefined && body !== null) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
      init.headers['content-type'] = 'application/json';
    }
    const response = await fetchImpl(new URL(path, base), init);
    const responseHeaders = {};
    response.headers.forEach((value, key) => { responseHeaders[key.toLowerCase()] = value; });
    const buffer = Buffer.from(await response.arrayBuffer());
    const type = String(responseHeaders['content-type'] ?? '').toLowerCase();
    let parsed = null;
    if (buffer.length > 0) {
      if (type.includes('application/json')) {
        try { parsed = JSON.parse(buffer.toString('utf8')); } catch { parsed = buffer.toString('utf8'); }
      } else if (type.startsWith('text/')) parsed = buffer.toString('utf8');
      else parsed = buffer;
    }
    return { status: response.status, headers: responseHeaders, body: parsed };
  };
}

// ---------------------------------------------------------------------------
// Contracts.

export function rankedContracts(deployment, runner) {
  const at = (address, name) => new ethers.Contract(address, loadArtifact(name).abi, runner);
  const addresses = deployment.addresses;
  return {
    entry: at(addresses.arcadeRankedEntry, 'ArcadeRankedEntry'),
    scores: at(addresses.scoreSubmissionRegistry, 'ScoreSubmissionRegistry'),
    profiles: at(addresses.playerProfileRegistry, 'PlayerProfileRegistry'),
    collection: (gameId) => at(addresses.achievementRegistries[gameId], 'AchievementRegistry'),
  };
}

// ---------------------------------------------------------------------------
// Steps shared by the positive runs and the negative checks.

// E1 + E2: a real SIWE login on a server nonce. Returns the Bearer token (never logged).
export async function signIn({ api, wallet, domain, chainId = 4441 }) {
  const nonce = await api('GET', '/api/session/nonce');
  if (nonce.status !== 200 || !nonce.body?.nonce) throw new CheckFailure('siwe-nonce', `E1 answered ${nonce.status} ${brief(errorCode(nonce))}`);
  const address = await wallet.getAddress();
  const challenge = buildSiweChallenge({ domain, address, chainId, nonce: nonce.body.nonce, issuedAt: nonce.body.issuedAt });
  const signature = await wallet.signMessage(challenge.message);
  const session = await api('POST', '/api/session', { body: { challenge, signature } });
  if (session.status !== 200 || typeof session.body?.token !== 'string') throw new CheckFailure('siwe-login', `E2 answered ${session.status} ${brief(errorCode(session))}`);
  if (session.body.wallet !== lower(address)) throw new CheckFailure('siwe-login', 'E2 signed in another wallet');
  return session.body.token;
}

const bearer = (token) => ({ authorization: `Bearer ${token}` });

// A paid (Ranked) session with the E15 ticket applied, and its identity and session key.
export async function ticketedSession({ api, token, wallet, gameId, scoreRegistryAddress }) {
  const session = startPlaySession({ wallet: lower(await wallet.getAddress()), gameId, mode: 'paid' });
  const request = { gameId, sessionId: session.sessionId, seasonId: session.seasonId, buildHash: session.buildHash };
  const ticket = await api('POST', '/api/ranked/seed', { headers: bearer(token), body: request });
  if (ticket.status !== 200) return { session, ticket, identity: null, sessionId32: null };
  applySeedTicket(session, { seed: ticket.body.seed, seedTicket: ticket.body.seedTicket });
  const identity = rankedIdentityFor(session, { scoreRegistryAddress });
  const sessionId32 = await rankedSessionKey(identity);
  return { session, ticket, identity, sessionId32 };
}

// quoteEntry, then openSession for exactly the quoted total (or `value`), then the paid facts.
export async function payEntry({ contracts, player, gameId, sessionId32, value = null }) {
  const gameId32 = ethers.id(gameId);
  const quote = await contracts.entry.quoteEntry(gameId32);
  const amount = value === null ? quote.totalWei : BigInt(value);
  const tx = await contracts.entry.connect(player).openSession(sessionId32, gameId32, { value: amount });
  const receipt = await tx.wait();
  const paid = await contracts.entry.getPaidSession(sessionId32);
  const isPaid = await contracts.entry.isPaid(sessionId32, await player.getAddress(), gameId32);
  return {
    quote: { entryFeeWei: quote.entryFeeWei.toString(), settlementGasReserveWei: quote[1].toString(), totalWei: quote.totalWei.toString() },
    txHash: lower(tx.hash),
    status: receipt?.status ?? null,
    blockNumber: receipt?.blockNumber ?? null,
    amountWei: amount.toString(),
    openedAt: Number(paid.openedAt),
    paidAmountWei: paid.amountWei.toString(),
    isPaid,
  };
}

// The game's evidence at the session's (ticket) seed, and the §5.1 body from the ranked-client
// builders (identity = rankedIdentityFor, sessionId32 = rankedSessionKey, entryTxHash from the receipt).
export async function playAndBuildBody({ gameId, session, identity, scoreRegistryAddress, evidence = E2E_EVIDENCE[gameId], claimScore = undefined }) {
  if (gameId === 'chikun') {
    const built = buildChikunEvidence({ seed: session.seed, ...evidence });
    const body = await buildChikunSettleRequest({ session, scoreRegistryAddress, evidence: built.flap, claimScore: claimScore ?? built.score });
    return { body, expectedScore: built.score, survivalSeconds: Math.floor(built.survivalTicks / 60), evidenceSummary: { flaps: built.flap.flapDeltas.length, survivalTicks: built.survivalTicks } };
  }
  if (gameId === 'stacked') {
    const built = buildStackedEvidence({ seed: session.seed, buildHash: session.buildHash, seasonId: session.seasonId, ...evidence });
    const body = await buildStackedSettleRequest({ session, scoreRegistryAddress, sic1Bytes: built.bytes, claimScore: claimScore ?? built.score });
    return { body, expectedScore: built.score, survivalSeconds: Math.floor(built.ticks / 60), evidenceSummary: { sic1Bytes: built.bytes.length, ticks: built.ticks } };
  }
  if (gameId === 'lester-blaster') {
    const built = await buildHmhEvidence({ seed: session.seed, buildHash: session.buildHash, identity, ...evidence });
    const body = await buildHmhSettleRequest({ session, scoreRegistryAddress, runSummary: built.runSummary, sessionEnvelope: built.sessionEnvelope, claimScore: claimScore ?? built.score });
    return { body, expectedScore: built.score, survivalSeconds: Math.floor(built.runSummary.totals.elapsedMs / 1000), evidenceSummary: { kills: built.runSummary.kills?.total ?? null, elapsedMs: built.runSummary.totals.elapsedMs } };
  }
  throw new Error(`unknown ranked game ${gameId}`);
}

function createContext({ target, api, chain, wallets, cronSecret, log, site, domain, local, timeouts, sleep, now }) {
  const provider = chain.provider;
  const deployment = chain.deployment;
  const relayer = lower(chain.relayer ?? deployment.relayer);
  if (!provider || !deployment?.addresses) throw new Error('runRankedE2E needs chain.provider and chain.deployment');
  if (!/^0x[0-9a-f]{40}$/.test(relayer)) throw new Error('runRankedE2E needs the relayer address (chain.relayer or deployment.relayer)');
  if (!wallets?.player) throw new Error('runRankedE2E needs wallets.player');
  const derivedDomain = domain ?? (site ? new URL(site).host : null);
  if (!derivedDomain) throw new Error('runRankedE2E needs a sign-in domain (site or domain)');
  return {
    target,
    api,
    chain,
    provider,
    deployment,
    relayer,
    player: wallets.player,
    second: wallets.second ?? null,
    contracts: rankedContracts(deployment, provider),
    registry: lower(deployment.addresses.scoreSubmissionRegistry),
    cronSecret,
    log,
    domain: derivedDomain,
    local: target === 'local' ? local : null,
    timeouts: { ...DEFAULT_TIMEOUTS, ...timeouts },
    sleep,
    now,
    tokens: new Map(),
  };
}

async function tokenFor(ctx, wallet, { fresh = false } = {}) {
  const key = lower(await wallet.getAddress());
  if (fresh || !ctx.tokens.has(key)) ctx.tokens.set(key, await signIn({ api: ctx.api, wallet, domain: ctx.domain }));
  return ctx.tokens.get(key);
}

const relayerNonce = (ctx) => ctx.provider.getTransactionCount(ctx.relayer, 'latest');

// Waits until the run length has passed since openedAt (the entry block's time).
//   - Local chain (`chain.advanceTime`): evm_increaseTime past it, never sleeping.
//   - Live: WALL-CLOCK time. LiteForge (Arbitrum Orbit) makes no empty blocks, so the latest block time
//     stays at openedAt while nobody transacts, and polling it would only wait out maxRunWaitMs. The
//     server compares its OWN clock with openedAt + survivalSeconds (A26, less RUN_EARLY_SLACK_SECONDS),
//     and if the clocks still disagree E3 answers a retryable 409 run-timing-early with retryAfterMs,
//     which settleUntilConfirmed() honours.
// Exported for the tests.
export async function waitRunLength(ctx, { openedAt, runSeconds }) {
  const target = openedAt + runSeconds + 1;
  if (typeof ctx.chain.advanceTime === 'function') {
    const latest = Number((await ctx.provider.getBlock('latest')).timestamp);
    if (latest >= target) return { waitedSeconds: 0, mode: 'none' };
    await ctx.chain.advanceTime(target - latest);
    return { waitedSeconds: target - latest, mode: 'increaseTime' };
  }
  const nowSeconds = () => ctx.now() / 1000;
  const blockBefore = Number((await ctx.provider.getBlock('latest')).timestamp);
  const remaining = target - nowSeconds();
  if (remaining <= 0) return { waitedSeconds: 0, mode: 'none', latestBlockTimestamp: { before: blockBefore, after: blockBefore } };
  if (remaining * 1000 > ctx.timeouts.maxRunWaitMs) throw new CheckFailure('run-length-wait', `the run length ends ${Math.ceil(remaining)} s from now, beyond maxRunWaitMs`);
  const started = ctx.now();
  ctx.log(`waiting ${Math.ceil(remaining)} s of real time for the run length (${runSeconds} s) to pass since the entry`);
  while (nowSeconds() < target) await ctx.sleep(Math.min(5000, Math.max(250, Math.ceil((target - nowSeconds()) * 1000))));
  const blockAfter = Number((await ctx.provider.getBlock('latest')).timestamp);
  return { waitedSeconds: Math.round((ctx.now() - started) / 1000), mode: 'real-time', latestBlockTimestamp: { before: blockBefore, after: blockAfter } };
}

// Polls a read until `accept(response)` holds (CDN caching on the live site lags up to s-maxage).
async function readUntil(ctx, read, accept, { timeoutMs = ctx.timeouts.readMs, intervalMs = 3000 } = {}) {
  const started = ctx.now();
  let last = await read();
  while (!accept(last)) {
    if (ctx.target === 'local' || ctx.now() - started > timeoutMs) return { response: last, ok: false };
    await ctx.sleep(intervalMs);
    last = await read();
  }
  return { response: last, ok: true };
}

// E3 with the retryable answers handled (§7.2), then E4 until confirmed (timeout 120 s from the first
// accepted POST). A retryable 409 (run-timing-early, a busy relayer lease) is retried after its
// retryAfterMs for up to maxRunWaitMs, which covers the longest run (HMH, about 3 minutes) should the
// server's clock lag the driver's. Exported for the tests.
export async function settleUntilConfirmed(ctx, { body, token }) {
  const retryStarted = ctx.now();
  const attempts = [];
  let response;
  for (;;) {
    response = await ctx.api('POST', '/api/settle', { headers: bearer(token), body });
    attempts.push({ status: response.status, error: errorCode(response), state: response.body?.status ?? null });
    if (response.status === 409 && response.body?.retryable && ctx.now() - retryStarted < ctx.timeouts.maxRunWaitMs) {
      const waitMs = Math.max(1000, Number(response.body.retryAfterMs ?? 5000));
      if (response.body.error === 'run-timing-early' && typeof ctx.chain.advanceTime === 'function') await ctx.chain.advanceTime(Math.ceil(waitMs / 1000));
      else await ctx.sleep(waitMs);
      continue;
    }
    break;
  }
  if (response.status !== 200) throw new CheckFailure('settle', `E3 answered ${response.status} ${brief(errorCode(response))}`);
  const started = ctx.now();
  let view = response.body;
  const first = view;
  while (view.status !== 'confirmed') {
    if (view.status === 'failed' && view.retryable === false) throw new CheckFailure('settle', `dead-lettered: ${brief(view.lastError)}`);
    if (ctx.now() - started > ctx.timeouts.settleMs) throw new CheckFailure('settle', `not confirmed after ${ctx.timeouts.settleMs} ms (status ${view.status})`);
    await ctx.sleep(Math.max(500, Number(view.pollAfterMs ?? 2500)));
    const queued = view.status === 'pending' || view.status === 'signed' || (view.status === 'failed' && view.retryable);
    const next = queued
      ? await ctx.api('POST', '/api/settle', { headers: bearer(token), body: { v: RANKED_SETTLE_VERSION, sessionId32: body.sessionId32, retry: true } })
      : await ctx.api('GET', `/api/settle/status?sessionId32=${body.sessionId32}`, { headers: bearer(token) });
    attempts.push({ status: next.status, error: errorCode(next), state: next.body?.status ?? null, retry: queued });
    if (next.status !== 200) continue;
    view = next.body;
  }
  return { first, view, attempts, ms: ctx.now() - retryStarted };
}

function checker(checks) {
  const record = (id, ok, detail = null) => {
    checks.push({ id, ok: Boolean(ok), ...(detail === null || detail === undefined ? {} : { detail }) });
    return Boolean(ok);
  };
  const expect = (id, condition, detail = null) => {
    if (!record(id, condition, detail)) throw new CheckFailure(id, typeof detail === 'string' ? detail : brief(detail));
  };
  return { record, expect };
}

// E6 before a run: the wallet's confirmed runs, best score and achievement ids for the game (null when
// E6 cannot answer, which the checks treat as a first run).
async function priorForGame(ctx, wallet, gameId) {
  const response = await ctx.api('GET', `/api/profile?wallet=${wallet}`);
  if (response.status !== 200 || !response.body?.games) return null;
  const game = response.body.games[gameId] ?? {};
  return {
    confirmedRuns: Number(game.confirmedRuns ?? 0),
    bestScore: game.bestScore ?? null,
    achievements: (response.body.achievements ?? []).filter((item) => item.gameId === gameId).map((item) => item.id),
  };
}

// ---------------------------------------------------------------------------
// One Ranked session for one game (acceptance 1, items 1-13).

async function runGame(ctx, gameId, { evidence }) {
  const checks = [];
  const { record, expect } = checker(checks);
  const out = { gameId, ok: false, checks };
  const player = ctx.player;
  const wallet = lower(await player.getAddress());
  const log = (message) => ctx.log(`[${gameId}] ${message}`);
  try {
    // 1-2. A real Ranked session and a real SIWE login.
    const token = await tokenFor(ctx, player, { fresh: true });
    record('siwe', true, 'E1 nonce, signed challenge, E2 token');
    // What the wallet already had for this game (a retry, or an earlier rehearsal this period), so
    // the board and achievement checks can tell "not the best" and "nothing new" from a failure.
    out.prior = await priorForGame(ctx, wallet, gameId);

    // 3. Seed ticket, identity, session key.
    const ticketed = await ticketedSession({ api: ctx.api, token, wallet: player, gameId, scoreRegistryAddress: ctx.registry });
    expect('seed-ticket', ticketed.ticket.status === 200, `E15 answered ${ticketed.ticket.status} ${brief(errorCode(ticketed.ticket))}`);
    const { session, identity, sessionId32 } = ticketed;
    expect('session-handle', /^game-session-[0-9a-f-]{36}$/.test(session.sessionId) && session.isPaid === true, session.sessionId);
    expect('ticket-seed-applied', session.seed === ticketed.ticket.body.seed && identity.seed === ticketed.ticket.body.seed, { seed: session.seed });
    expect('session-key', HEX32.test(sessionId32), sessionId32);
    Object.assign(out, { sessionHandle: session.sessionId, sessionId32, shareId: shareIdFor(sessionId32), seed: session.seed, buildHash: session.buildHash, seasonId: session.seasonId });
    log(`ticket seed ${session.seed}, session ${sessionId32}`);

    // 4. The paid entry.
    const entry = await payEntry({ contracts: ctx.contracts, player, gameId, sessionId32 });
    out.entry = { txHash: entry.txHash, totalWei: entry.quote.totalWei, amountWei: entry.paidAmountWei, openedAt: entry.openedAt, blockNumber: entry.blockNumber };
    expect('entry-quote', BigInt(entry.quote.totalWei) >= MIN_PAID_WEI && BigInt(entry.quote.totalWei) === BigInt(entry.quote.entryFeeWei) + BigInt(entry.quote.settlementGasReserveWei), entry.quote);
    expect('entry-paid', entry.status === 1 && entry.isPaid === true && entry.paidAmountWei === entry.quote.totalWei, { status: entry.status, isPaid: entry.isPaid });
    session.entryReceipt = { txHash: entry.txHash, sessionId32, amountWei: entry.amountWei, status: 'confirmed' };
    log(`entry ${entry.txHash} (${ethers.formatEther(entry.quote.totalWei)} zkLTC), openedAt ${entry.openedAt}`);

    // 5. Real evidence at the ticket seed. Chikun carries a tampered claim (A9).
    const played = await playAndBuildBody({ gameId, session, identity, scoreRegistryAddress: ctx.registry, evidence });
    let claimScore = played.expectedScore;
    if (gameId === 'chikun') {
      claimScore = played.expectedScore * 1000 + 7;
      played.body.claim = { score: claimScore };
    }
    expect('settle-body', played.body.sessionId32 === sessionId32 && played.body.entryTxHash === entry.txHash && played.body.identity.seed === session.seed, 'the ranked-client builder keyed the body to the paid session');
    out.run = { expectedScore: played.expectedScore, survivalSeconds: played.survivalSeconds, claimScore, ...played.evidenceSummary };
    log(`played ${played.survivalSeconds} s for ${played.expectedScore} points`);

    // 6. Chain time past the run length, then E3 and E4 until confirmed.
    out.runWait = await waitRunLength(ctx, { openedAt: entry.openedAt, runSeconds: played.survivalSeconds });
    const nonceBefore = await relayerNonce(ctx);
    const settled = await settleUntilConfirmed(ctx, { body: played.body, token });
    const view = settled.view;
    out.settle = { firstStatus: settled.first.status, status: view.status, txHash: view.txHash, blockNumber: view.blockNumber, envelopeHash: view.envelopeHash, score: view.score, achievements: view.achievements.map((item) => item.id), attempts: settled.attempts, ms: settled.ms };
    expect('settle-confirmed', view.status === 'confirmed' && view.view === 'owner' && view.sessionId32 === sessionId32 && view.wallet === wallet && view.gameId === gameId, { status: view.status });
    expect('server-score', view.score === played.expectedScore, { server: view.score, replayed: played.expectedScore });
    if (gameId === 'chikun') expect('tampered-claim-ignored', view.score !== claimScore, { server: view.score, claim: claimScore });
    expect('settle-tx', HEX32.test(view.txHash) && view.explorerUrl === `https://liteforge.explorer.caldera.xyz/tx/${view.txHash}` && HEX32.test(view.envelopeHash), view.txHash);
    const status = await ctx.api('GET', `/api/settle/status?sessionId32=${sessionId32}`, { headers: bearer(token) });
    expect('status-owner-view', status.status === 200 && status.body.status === 'confirmed' && status.body.view === 'owner' && status.body.txHash === view.txHash, { status: status.status });
    const publicStatus = await ctx.api('GET', `/api/settle/status?id=${shareIdFor(sessionId32)}`);
    expect('status-public-view', publicStatus.status === 200 && publicStatus.body.view === 'public' && !('wallet' in publicStatus.body) && publicStatus.body.score === view.score, { status: publicStatus.status });
    log(`published ${view.txHash} (${settled.attempts.length} E3 call(s), ${settled.ms} ms)`);

    // 7. On chain.
    const onChain = await ctx.contracts.scores.getSession(sessionId32);
    const envelope = lower(await ctx.contracts.scores.sessionEnvelopeHash(sessionId32));
    expect('chain-session', onChain.exists === true && lower(onChain.player) === wallet && onChain.gameId === ethers.id(gameId) && onChain.score === BigInt(view.score), { exists: onChain.exists });
    expect('chain-envelope', envelope === view.envelopeHash, { chain: envelope, response: view.envelopeHash });
    const relayed = await ctx.provider.getTransaction(view.txHash);
    expect('relayer-published', lower(relayed?.from) === ctx.relayer && lower(relayed?.to) === ctx.registry, { from: lower(relayed?.from) });

    // Duplicate POST: the same state, no new transaction.
    const again = await ctx.api('POST', '/api/settle', { headers: bearer(token), body: played.body });
    const nonceAfter = await relayerNonce(ctx);
    const sameState = again.status === 200 && again.body.status === 'confirmed' && again.body.txHash === view.txHash && JSON.stringify(again.body) === JSON.stringify(status.body);
    if (ctx.target === 'local') expect('duplicate-post', sameState && nonceAfter === nonceBefore + 1, { status: again.status, relayerTxs: nonceAfter - nonceBefore });
    else {
      const unchanged = await ctx.contracts.scores.getSession(sessionId32);
      expect('duplicate-post', sameState && unchanged.submittedAt === onChain.submittedAt, { status: again.status, relayerNonceDelta: nonceAfter - nonceBefore, note: 'live: other sessions may move the relayer nonce; the session record is unchanged' });
    }

    // 8. E5 weekly board. E5 shows each wallet's best confirmed run of the period (D1): this session's
    //    row (rank ≥ 1, with its transaction) when it is the wallet's best, otherwise the wallet's
    //    earlier row, which must score at least as much (this run's confirmation is proven on E4 and E9).
    const q = wallet.slice(2, 18);
    const walletRow = (response) => response.body?.rows?.find((entry) => entry.wallet === wallet) ?? null;
    const board = await readUntil(ctx, () => ctx.api('GET', `/api/leaderboard?game=${gameId}&period=weekly&wallet=${wallet}&q=${q}`), (response) => {
      const found = response.status === 200 ? walletRow(response) : null;
      return found !== null && (found.sessionId32 === sessionId32 || found.score >= view.score);
    });
    const row = walletRow(board.response);
    const you = board.response.body?.you ?? null;
    const isBest = row?.sessionId32 === sessionId32;
    if (isBest || row === null) {
      expect('leaderboard-row', row !== null && row.rank >= 1 && row.txHash === view.txHash && row.score === view.score && you?.sessionId32 === sessionId32, { status: board.response.status, rank: row?.rank ?? null });
    } else {
      expect('leaderboard-row', row.rank >= 1 && row.score >= view.score && HEX32.test(String(row.txHash)) && you?.sessionId32 === row.sessionId32, {
        status: board.response.status, rank: row.rank, walletBest: { sessionId32: row.sessionId32, score: row.score }, thisRun: view.score,
        note: 'not the wallet\'s best this period: E5 ranks each wallet\'s best confirmed run (D1)',
      });
    }
    out.leaderboard = { period: board.response.body?.period ?? null, periodKey: board.response.body?.periodKey ?? null, rank: row?.rank ?? null, walletBest: isBest };

    // 9. E6: runs, best score and this session's achievements. A first run of a game always unlocks
    //    something; a later run may earn nothing new when the wallet already holds what it would.
    const unlocks = view.achievements.map((item) => item.id);
    const profile = await readUntil(ctx, () => ctx.api('GET', `/api/profile?wallet=${wallet}`), (response) => response.status === 200
      && response.body.games?.[gameId]?.confirmedRuns >= 1
      && unlocks.every((id) => response.body.achievements?.some((item) => item.id === id && item.sessionId32 === sessionId32)));
    const games = profile.response.body?.games?.[gameId] ?? {};
    expect('profile-stats', profile.ok && games.confirmedRuns >= 1 && games.bestScore >= view.score, { confirmedRuns: games.confirmedRuns ?? null, bestScore: games.bestScore ?? null });
    const heldBefore = out.prior?.confirmedRuns > 0 && out.prior.achievements.length > 0;
    if (unlocks.length > 0 || !heldBefore) expect('profile-achievements', profile.ok && unlocks.length > 0, { unlocks });
    else expect('profile-achievements', profile.ok, { unlocks, heldBefore: out.prior.achievements.length, note: 'nothing new: the wallet already held this game\'s achievements from earlier runs' });
    out.profile = { confirmedRuns: games.confirmedRuns, bestScore: games.bestScore, achievements: unlocks };

    // 10. E9 and the E10 share page tags.
    const shareId = shareIdFor(sessionId32);
    const publicSession = await ctx.api('GET', `/api/session/${shareId}`);
    const cardRev = publicSession.body?.session?.cardRev ?? null;
    expect('share-session', publicSession.status === 200 && publicSession.body.session.sessionId32 === sessionId32 && publicSession.body.session.status === 'confirmed'
      && publicSession.body.session.txHash === view.txHash && /^[0-9a-f]{12}$/.test(String(cardRev)), { status: publicSession.status, cardRev });
    const page = await ctx.api('GET', `/s/${shareId}`);
    const image = `${SHARE_ORIGIN}/api/share-card/${shareId}.png?v=${cardRev}`;
    const html = typeof page.body === 'string' ? page.body : '';
    expect('share-page', page.status === 200 && html.includes(`<meta property="og:image" content="${image}">`) && html.includes('<meta name="twitter:site" content="@LestersArcade">'), { status: page.status, ogImage: image });
    out.share = { shareId, cardRev, url: `${SHARE_ORIGIN}/s/${shareId}`, ogImage: image };

    // 11. E11 card PNG (one render per game).
    const card = await ctx.api('GET', `/api/share-card/${shareId}.png?v=${cardRev}`);
    const png = Buffer.isBuffer(card.body) ? card.body : Buffer.alloc(0);
    expect('share-card', card.status === 200 && String(card.headers['content-type']).startsWith('image/png') && png.subarray(0, 8).equals(PNG_SIGNATURE) && png.length > 10_000, { status: card.status, bytes: png.length });
    out.share.cardBytes = png.length;

    // 12. An on-chain name change, E8 with the token, then E6 shows it.
    const handle = normalizeHandle(profileNameFor(gameId, wallet));
    expect('profile-name-valid', handle.ok && moderateName(handle.cleaned).ok, handle.cleaned);
    const avatarUri = `lestersarcade:avatar/${PROFILE_AVATARS[gameId]}`;
    const rename = await (await ctx.contracts.profiles.connect(player).setProfile(handle.cleaned, avatarUri)).wait();
    expect('profile-set', rename?.status === 1, rename?.hash);
    const refresh = await ctx.api('POST', `/api/profile/refresh?wallet=${wallet}`, { headers: bearer(token) });
    expect('profile-refresh', refresh.status === 200 && refresh.body.profile?.displayName === handle.cleaned && refresh.body.profile?.avatarUri === avatarUri, { status: refresh.status, error: errorCode(refresh) });
    const renamed = await readUntil(ctx, () => ctx.api('GET', `/api/profile?wallet=${wallet}`), (response) => response.status === 200 && response.body.profile?.displayName === handle.cleaned);
    expect('profile-name', renamed.ok && renamed.response.body.profile.avatarUri === avatarUri, { displayName: renamed.response.body?.profile?.displayName ?? null });
    out.profileName = { displayName: handle.cleaned, avatarUri, txHash: lower(rename.hash) };

    // 13. E12 with the cron secret: clean, migrated, idempotent.
    if (ctx.cronSecret) {
      const cron = { authorization: `Bearer ${ctx.cronSecret}` };
      const first = await ctx.api('GET', CRON_PATH, { headers: cron });
      expect('index-cron', first.status === 200 && first.body.ok === true && Number.isInteger(first.body.schemaVersion) && first.body.schemaVersion >= 1 && first.body.failed === 0 && first.body.mismatches === 0, { status: first.status, error: errorCode(first), schemaVersion: first.body?.schemaVersion ?? null });
      const second = await ctx.api('GET', CRON_PATH, { headers: cron });
      const quiet = ctx.target === 'local' ? second.body.scores === 0 && second.body.achievements === 0 && second.body.profiles === 0 : true;
      const reread = await ctx.api('GET', `/api/session/${shareId}`);
      expect('index-cron-idempotent', second.status === 200 && second.body.ok === true && second.body.schemaVersion === first.body.schemaVersion && second.body.failed === 0 && second.body.mismatches === 0 && quiet
        && reread.status === 200 && reread.body.session.txHash === view.txHash && reread.body.session.score === view.score && reread.body.session.status === 'confirmed',
      { first: { fromBlock: first.body.fromBlock, toBlock: first.body.toBlock, scores: first.body.scores, profiles: first.body.profiles }, second: { fromBlock: second.body.fromBlock, toBlock: second.body.toBlock, scores: second.body.scores, profiles: second.body.profiles } });
      out.indexCron = { schemaVersion: first.body.schemaVersion, first: { scores: first.body.scores, achievements: first.body.achievements, profiles: first.body.profiles }, second: { scores: second.body.scores, achievements: second.body.achievements, profiles: second.body.profiles } };
    } else {
      record('index-cron', false, 'no cron secret was given');
    }
    out.body = played.body;
    out.ok = checks.every((check) => check.ok);
  } catch (error) {
    if (error instanceof CheckFailure) {
      // A step that failed outside expect() (sign-in, the settle loop, the run-length wait) is recorded here.
      if (!checks.some((check) => check.id === error.checkId && !check.ok)) record(error.checkId, false, error.message);
    } else {
      record('unexpected-error', false, `${error?.name ?? 'Error'}: ${brief(error?.shortMessage ?? error?.message ?? error)}`);
    }
    out.ok = false;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Negative checks (acceptance 1, "Negative checks").

// What a rejected or paused request must leave untouched: on the local stack the CONTENT of every
// session, evidence, achievement, profile, lease and indexer row (a digest per table, so an UPDATE is
// caught, not only an INSERT or a DELETE), and on any target the relayer's nonce.
async function sideEffects(ctx) {
  const rows = ctx.local ? await ctx.local.snapshotRows() : null;
  return { rows, relayerNonce: await relayerNonce(ctx) };
}

async function runNegatives(ctx, source) {
  const results = [];
  const run = async (id, { localOnly = false } = {}, fn) => {
    if (localOnly && ctx.target !== 'local') {
      results.push({ id, ok: true, skipped: 'local-only' });
      return;
    }
    if (localOnly && !ctx.local) {
      results.push({ id, ok: false, detail: 'the local operator levers are missing' });
      return;
    }
    try {
      results.push({ id, ...(await fn()) });
    } catch (error) {
      results.push({ id, ok: false, detail: `${error?.name ?? 'Error'}: ${brief(error?.shortMessage ?? error?.message ?? error)}` });
    }
  };
  const player = ctx.player;
  const gameId = source.gameId;
  const copyEvidence = () => structuredClone(source.body.evidence);
  const bodyFor = (ticketed, entryTxHash = null) => ({
    v: RANKED_SETTLE_VERSION, gameId, sessionId32: ticketed.sessionId32, identity: { ...ticketed.identity },
    seedTicket: { ...ticketed.ticket.body.seedTicket }, entryTxHash, evidence: copyEvidence(),
  });
  const unchanged = (before, after) => JSON.stringify(before) === JSON.stringify(after);

  // A tampered Chikun claim does not change the server score (asserted inside the Chikun run).
  results.push(source.chikun
    ? { id: 'tampered-chikun-claim', ok: source.chikun.checks.some((check) => check.id === 'tampered-claim-ignored' && check.ok), claim: source.chikun.run?.claimScore ?? null, serverScore: source.chikun.settle?.score ?? null }
    : { id: 'tampered-chikun-claim', ok: false, detail: 'the Chikun run did not complete' });

  await run('unpaid-entry', {}, async () => {
    const token = await tokenFor(ctx, player);
    const ticketed = await ticketedSession({ api: ctx.api, token, wallet: player, gameId, scoreRegistryAddress: ctx.registry });
    const before = await sideEffects(ctx);
    const response = await ctx.api('POST', '/api/settle', { headers: bearer(token), body: bodyFor(ticketed) });
    const after = await sideEffects(ctx);
    const status = await ctx.api('GET', `/api/settle/status?sessionId32=${ticketed.sessionId32}`);
    return { ok: response.status === 402 && errorCode(response) === 'entry-not-paid' && status.status === 404 && unchanged(before, after), got: { status: response.status, error: errorCode(response), e4: status.status } };
  });

  await run('fees-disabled-entry', { localOnly: true }, async () => {
    const token = await tokenFor(ctx, player);
    const ticketed = await ticketedSession({ api: ctx.api, token, wallet: player, gameId, scoreRegistryAddress: ctx.registry });
    let entry;
    try {
      await ctx.local.setEntryFeeEnabled(false);
      entry = await payEntry({ contracts: ctx.contracts, player, gameId, sessionId32: ticketed.sessionId32 });
    } finally {
      await ctx.local.setEntryFeeEnabled(true);
    }
    const before = await sideEffects(ctx);
    const response = await ctx.api('POST', '/api/settle', { headers: bearer(token), body: bodyFor(ticketed, entry.txHash) });
    const after = await sideEffects(ctx);
    return { ok: entry.quote.totalWei === '0' && entry.paidAmountWei === '0' && entry.isPaid === true && response.status === 402 && errorCode(response) === 'entry-underpaid' && unchanged(before, after), got: { status: response.status, error: errorCode(response), paidAmountWei: entry.paidAmountWei } };
  });

  await run('evidence-copied-to-another-wallet', {}, async () => {
    // Only a PAID copy reaches evidence binding: an unpaid one stops at the paid-entry check, which
    // would just repeat unpaid-entry. Without a second funded wallet the check is skipped, not passed.
    if (!ctx.second) return { ok: true, skipped: 'needs a second funded wallet' };
    const copier = ctx.second;
    const token = await tokenFor(ctx, copier);
    const ticketed = await ticketedSession({ api: ctx.api, token, wallet: copier, gameId, scoreRegistryAddress: ctx.registry });
    const entry = await payEntry({ contracts: ctx.contracts, player: copier, gameId, sessionId32: ticketed.sessionId32 });
    const before = await sideEffects(ctx);
    const response = await ctx.api('POST', '/api/settle', { headers: bearer(token), body: bodyFor(ticketed, entry.txHash) });
    const after = await sideEffects(ctx);
    // The verifier rejects evidence played at another seed (Chikun: evidence-seed-mismatch; the
    // others fail their replay or binding with a 400 or 422).
    const accepted = gameId === 'chikun'
      ? response.status === 400 && errorCode(response) === 'evidence-seed-mismatch'
      : response.status === 400 || response.status === 422;
    return { ok: entry.isPaid === true && accepted && unchanged(before, after), copier: 'second funded wallet (paid)', got: { status: response.status, error: errorCode(response) } };
  });

  await run('ephemeral-wallet-token', {}, async () => {
    const ephemeral = ethers.Wallet.createRandom();
    const token = await tokenFor(ctx, ephemeral);
    const before = await sideEffects(ctx);
    const full = await ctx.api('POST', '/api/settle', { headers: bearer(token), body: source.body });
    const retry = await ctx.api('POST', '/api/settle', { headers: bearer(token), body: { v: RANKED_SETTLE_VERSION, sessionId32: source.body.sessionId32, retry: true } });
    const status = await ctx.api('GET', `/api/settle/status?sessionId32=${source.body.sessionId32}`, { headers: bearer(token) });
    const after = await sideEffects(ctx);
    const funded = await ctx.provider.getBalance(ephemeral.address);
    return {
      ok: full.status === 403 && errorCode(full) === 'wallet-mismatch' && retry.status === 403 && errorCode(retry) === 'wallet-mismatch'
        && status.status === 200 && status.body.view === 'public' && funded === 0n && unchanged(before, after),
      got: { full: [full.status, errorCode(full)], retry: [retry.status, errorCode(retry)], statusView: status.body?.view ?? null },
    };
  });

  await run('settlement-paused', { localOnly: true }, async () => {
    const token = await tokenFor(ctx, player);
    const session = startPlaySession({ wallet: lower(await player.getAddress()), gameId, mode: 'paid' });
    const seedBody = { gameId, sessionId: session.sessionId, seasonId: session.seasonId, buildHash: session.buildHash };
    const before = await sideEffects(ctx);
    let seed;
    let settle;
    let retry;
    try {
      await ctx.local.setPaused(true);
      seed = await ctx.api('POST', '/api/ranked/seed', { headers: bearer(token), body: seedBody });
      settle = await ctx.api('POST', '/api/settle', { headers: bearer(token), body: source.body });
      retry = ctx.cronSecret ? await ctx.api('GET', '/api/cron/settle-retry', { headers: { authorization: `Bearer ${ctx.cronSecret}` } }) : null;
    } finally {
      await ctx.local.setPaused(false);
    }
    const after = await sideEffects(ctx);
    const resumed = await ctx.api('POST', '/api/ranked/seed', { headers: bearer(token), body: seedBody });
    const paused = (response) => response.status === 503 && errorCode(response) === 'settlement-paused';
    return {
      ok: paused(seed) && paused(settle) && (retry === null || paused(retry)) && unchanged(before, after) && resumed.status === 200,
      got: { seed: [seed.status, errorCode(seed)], settle: [settle.status, errorCode(settle)], retryCron: retry ? [retry.status, errorCode(retry)] : null, resumed: resumed.status },
    };
  });

  return results;
}

// ---------------------------------------------------------------------------
// The run.

export async function runRankedE2E({
  target = 'local',
  api,
  chain,
  wallets,
  games = DEFAULT_GAMES,
  cronSecret = null,
  log = () => {},
  site = null,
  domain = null,
  local = null,
  transport = null,
  evidence = E2E_EVIDENCE,
  negatives = true,
  timeouts = {},
  sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  now = Date.now,
} = {}) {
  if (target !== 'local' && target !== 'live') throw new Error(`unknown target ${target}`);
  if (typeof api !== 'function') throw new Error('runRankedE2E needs an api client');
  for (const gameId of games) if (!RANKED_GAMES[gameId]) throw new Error(`unknown ranked game ${gameId}`);
  const ctx = createContext({ target, api, chain, wallets, cronSecret, log, site, domain, local, timeouts, sleep, now });
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const report = {
    schema: REHEARSAL_REPORT_SCHEMA,
    target,
    transport,
    site,
    signInDomain: ctx.domain,
    chainId: Number((await ctx.provider.getNetwork()).chainId),
    deployment: { status: ctx.deployment.status ?? null, addresses: ctx.deployment.addresses, relayer: ctx.relayer },
    player: lower(await ctx.player.getAddress()),
    games: {},
    negatives: [],
    startedAt,
  };
  const bodies = {};
  for (const gameId of games) {
    log(`[${gameId}] Ranked session`);
    // eslint-disable-next-line no-await-in-loop
    const result = await runGame(ctx, gameId, { evidence: evidence[gameId] ?? E2E_EVIDENCE[gameId] });
    bodies[gameId] = result.body ?? null;
    delete result.body;
    report.games[gameId] = result;
    log(`[${gameId}] ${result.ok ? 'PASS' : 'FAIL'} (${result.checks.filter((check) => check.ok).length}/${result.checks.length} checks)`);
  }
  if (negatives) {
    const sourceGame = ['chikun', ...games].find((gameId) => report.games[gameId]?.ok && bodies[gameId]);
    if (sourceGame) {
      log(`negative checks (on the ${sourceGame} run)`);
      report.negatives = await runNegatives(ctx, { gameId: sourceGame, body: bodies[sourceGame], chikun: report.games.chikun ?? null });
    } else {
      report.negatives = [{ id: 'negatives', ok: false, detail: 'no game settled, so no negative check could run' }];
    }
  }
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - started;
  const failures = [
    ...Object.values(report.games).flatMap((game) => game.checks.filter((check) => !check.ok).map((check) => `${game.gameId}:${check.id}`)),
    ...report.negatives.filter((check) => !check.ok).map((check) => `negative:${check.id}`),
  ];
  report.failures = failures;
  report.ok = failures.length === 0 && games.every((gameId) => report.games[gameId]?.ok);
  return report;
}
