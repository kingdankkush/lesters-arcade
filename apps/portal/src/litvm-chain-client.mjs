// Lester's Arcade — LitVM chain client (browser-only, ethers v6).
//
// This is the ONE place that talks to the deployed LitVM LiteForge contracts.
// It is player-signed: the connected wallet (MetaMask/Rabby) sends its own
// score-submission transaction and pays the zkLTC gas. There is no backend and
// no trusted operator key in the browser.
//
//   WRITE  (needs the player's wallet provider, 1 confirmation popup):
//     sendRankedEntry(provider, { ... })      -> { txHash, wait() } right after broadcast
//     submitRankedSession(provider, { ... })  -> { txHash, receipt } (owner tooling only)
//
//   READ   (gas-free; always over the public LiteForge RPC, never the wallet provider):
//     fetchGlobalLeaderboard({ limit })       -> [{ player, score, ... }]
//     fetchPlayerSessions(wallet, { limit })   -> [{ ... }]
//     fetchProfile(wallet)                     -> { displayName, ... } | null
//
// Everything degrades gracefully: a read failure returns an empty result and a
// flag so the UI can fall back to local state instead of throwing.

import { LITVM_LITEFORGE_NETWORK } from './arcade-core.mjs';
import { LITVM_CONTRACT_ADDRESSES, SETTLEMENT_LIVE } from './settlement.mjs';
import { classifyWalletError } from './wallet-auth.mjs';
import { liteForgeFeeOverrides, liteForgeMaxFeePerGas } from './liteforge-fees.mjs';
import { attestationDomain, buildVerifiedRun, deserializeVerifiedRun, isAttestationValid } from './verifier-attestation.mjs';

// Lazy-load the vendored ethers ESM bundle so the heavy lib only loads when a
// chain call actually happens (keeps first paint fast). Cached after first use.
let _ethersPromise = null;
export function loadEthers() {
  if (!_ethersPromise) {
    _ethersPromise = import('../vendor/ethers.min.js');
  }
  return _ethersPromise;
}

// Minimal ABIs — only the methods the runtime calls. Must match the deployed
// contracts in contracts/src/ScoreSubmissionRegistry.sol + PlayerProfileRegistry.sol.
export const GAME_REGISTRY_ABI = [
  'function getGame(bytes32) view returns ((bytes32 gameId,string title,address devWallet,uint16 devBps,uint16 platformBps,uint16 liquidityBps,uint16 treasuryBps,uint256 entryFeeWei,bool devWalletConfirmed,bool playable,bool exists,uint256 registeredAt))',
];

// Native 0.01 zkLTC entry (ArcadeRankedEntry; the amount is read from GameRegistry,
// never from a client constant). `openSession` is payable; the
// contract derives the split from GameRegistry and records the paid session.
export const RANKED_ENTRY_ABI = [
  'function openSession(bytes32 sessionId, bytes32 gameId) external payable',
  'function quoteEntry(bytes32 gameId) external view returns (uint256 entryFeeWei, uint256 settlementGasReserveWei, uint256 totalWei)',
  'function settlementGasReserveWei() view returns (uint256)',
  'function isPaid(bytes32 sessionId, address player, bytes32 gameId) external view returns (bool)',
  'function getPaidSession(bytes32 sessionId) external view returns (tuple(address player, bytes32 gameId, uint256 amountWei, uint64 openedAt, bool exists))',
  'function entryFeeEnabled() view returns (bool)',
];

export const ACHIEVEMENT_REGISTRY_ABI = [
  'function hasUnlocked(address wallet, bytes32 achievementId) external view returns (bool)',
  'function unlockedAt(address wallet, bytes32 achievementId) external view returns (uint256)',
  'function tokenIdFor(address wallet, bytes32 achievementId) external pure returns (uint256)',
];

const SCORE_RECORD = 'tuple(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 runtimeId, bytes32 seasonId, uint64 submittedAt, bool verified, bool exists)';
const VERIFIED_RUN = '(bytes32 sessionId, bytes32 gameId, address player, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 envelopeHash, bytes32 runtimeId, bytes32 seasonId, uint64 deadline, bytes32 achievementsHash)';

// Hardened ScoreSubmissionRegistry (2026-09-16 overhaul): EIP-712 verifier
// attestation, no unverified submit path, soulbound achievement mints inside
// the same transaction.
export const SCORE_REGISTRY_ABI = [
  'function gameRegistry() view returns(address)',
  'function trustedVerifier() view returns(address)',
  'function rankedEntry() view returns(address)',
  `function submitVerifiedSession(${VERIFIED_RUN} run, bytes32[] achievements, bytes signature) external`,
  `function attestationDigest(${VERIFIED_RUN} run) view returns (bytes32)`,
  `function getSession(bytes32 sessionId) external view returns (${SCORE_RECORD})`,
  'function getSessionAchievements(bytes32 sessionId) external view returns (bytes32[])',
  'function playerSessionCount(address player) external view returns (uint256)',
  `function getPlayerSessions(address player, uint256 offset, uint256 limit) external view returns (${SCORE_RECORD}[])`,
  'function totalSessions() external view returns (uint256)',
  `function getRecentSessions(uint256 offset, uint256 limit) external view returns (${SCORE_RECORD}[])`,
  'function bestScore(bytes32 gameId, address player) view returns (uint256)',
];

export const PROFILE_REGISTRY_ABI = [
  'function setProfile(string displayName, string avatarUri) external',
  'function getProfile(address wallet) external view returns (tuple(bytes32 handle, string displayName, string avatarUri, uint256 createdAt, uint256 lastUpdated, bool exists))',
];

// --- id encoding -----------------------------------------------------------
// Contract ids are bytes32. Game/achievement ids are short strings, so we hash
// them deterministically; session ids are the public game-session-NNNNNNNNN
// handle. Hashing keeps everything within bytes32 and collision-safe.
export async function toBytes32Id(value) {
  const ethers = await loadEthers();
  const str = String(value ?? '');
  // keccak256 of the utf8 string -> stable bytes32 the contract can index by.
  return ethers.id(str);
}

export function isBytes32Hex(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(value ?? ''));
}

// Reads ALWAYS go over the public LiteForge RPC (guide §5.2 item 6), whatever wallet is connected:
// a wallet's RPC can sit on another chain, lag, or rate-limit, and a read must never prompt it.
// The wallet provider is ignored here; write paths keep using it. staticNetwork: without it an
// unreachable RPC leaves ethers retrying network detection every second, forever, in the background.
function pickReadProvider(ethers, _walletProvider = null) {
  return new ethers.JsonRpcProvider(LITVM_LITEFORGE_NETWORK.rpcUrls.http, 4441, { staticNetwork: true });
}

// One public read on a fresh provider. The node's own eth_chainId is checked alongside the read (the
// same JSON-RPC batch), so records never come from another chain, and the provider is destroyed
// afterwards, so a failed read leaves nothing running.
async function withPublicRead(ethers, walletProvider, read) {
  const provider = pickReadProvider(ethers, walletProvider);
  const checkChain = async () => {
    const chainId = Number(BigInt(await provider.send('eth_chainId', [])));
    if (chainId !== LITVM_LITEFORGE_NETWORK.chainId) throw new Error(`the public RPC is on chain ${chainId}, expected ${LITVM_LITEFORGE_NETWORK.chainId}`);
  };
  try {
    const [, value] = await Promise.all([checkChain(), read(provider)]);
    return value;
  } finally {
    provider.destroy();
  }
}

function scoreContractAddress() {
  return LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry;
}
function profileContractAddress() {
  return LITVM_CONTRACT_ADDRESSES.playerProfileRegistry;
}

// Read-only prerequisites, pinned to one block. This is not payment, verifier
// service, real-wallet or launch acceptance; the separate live flag remains off.
async function readRankedContractGate(ethers, provider, gameId) {
  let blockNumber = null;
  const deny = (reason, error) => ({ ok: false, reason, error, blockNumber });
  if (typeof gameId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameId)) {
    return deny('invalid-game-id', 'A canonical selected game ID is required for Ranked preflight.');
  }
  try {
    const registryAddress = LITVM_CONTRACT_ADDRESSES.gameRegistry;
    const scoreAddress = scoreContractAddress();
    blockNumber = await provider.getBlockNumber();
    for (const address of [registryAddress, scoreAddress]) {
      if (await provider.getCode(address, blockNumber) === '0x') {
        return deny('missing-contract-code', 'Ranked contracts are not deployed at the configured addresses.');
      }
    }
    const overrides = { blockTag: blockNumber };
    const gameRegistry = new ethers.Contract(registryAddress, GAME_REGISTRY_ABI, provider);
    const gameId32 = ethers.id(gameId);
    const game = await gameRegistry.getGame(gameId32, overrides);
    if (!game.exists) return deny('game-not-registered', 'This game is not registered for on-chain Ranked play.');
    if (game.gameId !== gameId32) return deny('game-identity-mismatch', 'The GameRegistry response does not match the selected game.');
    if (game.devWallet === ethers.ZeroAddress) return deny('invalid-developer', 'The game has no configured developer wallet.');
    if (!game.devWalletConfirmed) return deny('developer-unconfirmed', 'The game developer wallet is not confirmed.');
    if (!game.playable) return deny('game-not-playable', 'The GameRegistry has not approved this game for play.');
    const scores = new ethers.Contract(scoreAddress, SCORE_REGISTRY_ABI, provider);
    const wiredRegistry = await scores.gameRegistry(overrides);
    if (wiredRegistry.toLowerCase() !== registryAddress.toLowerCase()) {
      return deny('score-registry-mismatch', 'The score contract is bound to a different GameRegistry.');
    }
    const verifier = await scores.trustedVerifier(overrides);
    if (verifier === ethers.ZeroAddress) return deny('missing-verifier', 'The score contract has no configured verifier.');
    // A fixed-size tuple probe detects the legacy ten/eleven-field ABI even when
    // there are no score rows. Never decode a legacy row as verified or fall back to it.
    try {
      await scores.getSession(ethers.ZeroHash, overrides);
    } catch (error) {
      if (['BAD_DATA', 'BUFFER_OVERRUN'].includes(error?.code)) {
        return deny('incompatible-score-abi', 'The deployed score contract does not match the verified Ranked ABI.');
      }
      throw error;
    }
    // Native entry fee: a game with a fee needs the ArcadeRankedEntry contract
    // the score contract is wired to; without it nothing can be paid or settled.
    const entryFeeWei = BigInt(game.entryFeeWei ?? 0n);
    let rankedEntryAddress = null;
    if (entryFeeWei > 0n) {
      rankedEntryAddress = LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry;
      if (!rankedEntryAddress) return deny('missing-ranked-entry', 'The native entry-fee contract is not deployed at a configured address.');
      if (await provider.getCode(rankedEntryAddress, blockNumber) === '0x') return deny('missing-contract-code', 'Ranked contracts are not deployed at the configured addresses.');
      const wiredEntry = await scores.rankedEntry(overrides);
      if (wiredEntry.toLowerCase() !== rankedEntryAddress.toLowerCase()) return deny('ranked-entry-mismatch', 'The score contract is bound to a different entry-fee contract.');
    }
    // The contract quotes the exact msg.value: flat fee + settlement gas reserve.
    let entryTotalWei = entryFeeWei, settlementGasReserveWei = 0n;
    if (rankedEntryAddress) {
      const entry = new ethers.Contract(rankedEntryAddress, RANKED_ENTRY_ABI, provider);
      const quote = await entry.quoteEntry(gameId32, overrides);
      settlementGasReserveWei = BigInt(quote.settlementGasReserveWei);
      entryTotalWei = BigInt(quote.totalWei);
      if (BigInt(quote.entryFeeWei) !== entryFeeWei) return deny('entry-quote-mismatch', 'The entry contract quotes a different flat fee than the game registry.');
    }
    return { ok: true, reason: null, error: null, blockNumber, gameId32, entryFeeWei, settlementGasReserveWei, entryTotalWei, rankedEntryAddress, trustedVerifier: verifier };
  } catch {
    return deny('contract-read-failed', 'Ranked contract approval and compatibility could not be verified. Try again later.');
  }
}

// A read provider for tests and tools: an EIP-1193 object is wrapped, an
// ethers provider is used as is. Without one, reads go through withPublicRead.
async function withReadProvider(ethers, readProvider, read) {
  if (!readProvider) return withPublicRead(ethers, null, read);
  const provider = typeof readProvider.getBlockNumber === 'function' ? readProvider : new ethers.BrowserProvider(readProvider);
  return read(provider);
}

// Gas for openSession (three native transfers plus the paid-session record),
// padded. The fee per gas is the cap the entry is sent with (liteforge-fees.mjs);
// the fallback is that cap's 5 gwei floor, for balance checks without a block read.
export const RANKED_ENTRY_GAS_UNITS = 250_000n;
export const RANKED_ENTRY_FALLBACK_FEE_PER_GAS_WEI = 5_000_000_000n;
// The funds check budgets the same fee cap the entry is sent with (liteforge-fees.mjs: 10x the latest
// base fee, at least 5 gwei), because the wallet refuses a transaction it cannot cover at its cap.
async function estimateEntryGasWei(provider) {
  try {
    const block = await provider.getBlock('latest');
    return RANKED_ENTRY_GAS_UNITS * liteForgeMaxFeePerGas(block?.baseFeePerGas);
  } catch {
    return RANKED_ENTRY_GAS_UNITS * liteForgeMaxFeePerGas(null);
  }
}

// One bounded receipt wait (per RPC) inside wait().
export const RANKED_ENTRY_WAIT_TIMEOUT_MS = 180_000;
// A slow entry is never reported as failed while it can still count: an entry
// mined more than 30 minutes after its seed ticket can no longer settle (A26,
// seed-ticket-stale), so wait() gives up on a missing receipt only after that.
export const RANKED_ENTRY_CONFIRM_DEADLINE_MS = 30 * 60 * 1000;
export const RANKED_ENTRY_POLL_INTERVAL_MS = 5_000;
// A27: switching the fee off makes Ranked unusable, not free (E3 answers
// 402 entry-underpaid), so a zero quote is never sent.
export const RANKED_ENTRY_CLOSED_ERROR = 'The Ranked entry is closed right now: the entry contract quotes no fee.';
export const RANKED_ENTRY_ACCOUNT_CHANGED_ERROR = 'Your wallet switched accounts. The entry was not sent.';

// --- WRITE: pay the native Ranked entry (player-signed, 1 tx) ---------------
// Sends the contract's exact quote (entry fee + settlement reserve) to
// ArcadeRankedEntry.openSession against the canonical session key and returns
// right after the broadcast, so the run can start while the entry confirms
// (contract A17, §7.6). `wait()` never rejects: it resolves
// { status: 'confirmed'|'failed', blockNumber }. A missing receipt is looked
// for again (and isPaid read) until RANKED_ENTRY_CONFIRM_DEADLINE_MS; only a
// reverted receipt, or no payment by then, is 'failed'. `expectedWallet` is
// the account the session key is bound to: a signer on any other account is
// refused before openSession. The wallet sees the chain id request, the signer
// and the transaction itself; the quote comes from the background pre-flight
// or a public read.
export async function sendRankedEntry(walletProvider, {
  sessionKey, gameId, preflight = null, expectedWallet = null, readProvider = null,
  waitTimeoutMs = RANKED_ENTRY_WAIT_TIMEOUT_MS, confirmDeadlineMs = RANKED_ENTRY_CONFIRM_DEADLINE_MS,
  pollIntervalMs = RANKED_ENTRY_POLL_INTERVAL_MS, now = () => Date.now(),
} = {}) {
  if (!SETTLEMENT_LIVE) throw new Error('Ranked settlement is disabled. No entry fee was requested.');
  if (!walletProvider?.request) throw new Error('A connected wallet is required to pay the Ranked entry.');
  if (!isBytes32Hex(sessionKey)) throw new Error('A canonical session key is required.');
  if (typeof gameId !== 'string' || !gameId) throw new Error('gameId is required.');
  const ethers = await loadEthers();
  const sessionId32 = sessionKey.toLowerCase();
  const browserProvider = new ethers.BrowserProvider(walletProvider);
  const net = await browserProvider.getNetwork();
  if (Number(net.chainId) !== LITVM_LITEFORGE_NETWORK.chainId) {
    throw new Error(`Wrong network: wallet is on chain ${net.chainId}, expected ${LITVM_LITEFORGE_NETWORK.chainId} (${LITVM_LITEFORGE_NETWORK.name}).`);
  }
  const configuredEntry = String(LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry ?? '').toLowerCase();
  let quote = null;
  if (preflight?.ok === true && preflight.gameId === gameId && preflight.rankedEntryAddress
    && String(preflight.rankedEntryAddress).toLowerCase() === configuredEntry && typeof preflight.entryTotalWei === 'bigint') {
    quote = {
      rankedEntryAddress: preflight.rankedEntryAddress,
      entryTotalWei: preflight.entryTotalWei,
      entryFeeWei: preflight.entryFeeWei ?? 0n,
      settlementGasReserveWei: preflight.settlementGasReserveWei ?? 0n,
      gameId32: ethers.id(gameId),
    };
  } else {
    const gate = await withReadProvider(ethers, readProvider, (provider) => readRankedContractGate(ethers, provider, gameId));
    if (!gate.ok) throw new Error(gate.error);
    quote = gate;
  }
  if (!quote.rankedEntryAddress || BigInt(quote.entryTotalWei ?? 0n) === 0n) throw Object.assign(new Error(RANKED_ENTRY_CLOSED_ERROR), { code: 'RANKED_ENTRY_CLOSED' });
  const signer = await browserProvider.getSigner();
  const player = String(typeof signer.getAddress === 'function' ? await signer.getAddress() : signer.address ?? '').toLowerCase();
  if (expectedWallet && player !== String(expectedWallet).toLowerCase()) {
    throw Object.assign(new Error(RANKED_ENTRY_ACCOUNT_CHANGED_ERROR), { code: 'ACCOUNT_MISMATCH' });
  }
  const gameId32 = quote.gameId32 ?? ethers.id(gameId);
  const entry = new ethers.Contract(quote.rankedEntryAddress, RANKED_ENTRY_ABI, signer);
  // Priced from the latest block (public RPC, else the wallet's), never the wallet's own fee guess.
  const fees = await withReadProvider(ethers, readProvider, (provider) => liteForgeFeeOverrides(provider)).catch(() => liteForgeFeeOverrides(browserProvider));
  const tx = await entry.openSession(sessionId32, gameId32, { value: quote.entryTotalWei, ...fees });
  const broadcastAt = now();
  const receiptOnce = async () => {
    try {
      const receipt = await withReadProvider(ethers, readProvider, (provider) => provider.waitForTransaction(tx.hash, 1, waitTimeoutMs));
      if (receipt) return receipt;
    } catch { /* the public RPC failed or timed out; ask the wallet's own RPC */ }
    try { return await tx.wait(1, waitTimeoutMs); } catch (error) { return error?.receipt ?? null; }
  };
  // A replaced (sped-up) entry has another hash: the entry contract itself says
  // whether this session is paid.
  const paidOnChain = async () => {
    try {
      return Boolean(await withReadProvider(ethers, readProvider, (provider) => new ethers.Contract(quote.rankedEntryAddress, RANKED_ENTRY_ABI, provider).isPaid(sessionId32, player, gameId32)));
    } catch {
      return false;
    }
  };
  let waiting = null;
  const wait = () => {
    waiting ??= (async () => {
      for (;;) {
        const receipt = await receiptOnce();
        if (receipt) return { status: Number(receipt.status) === 1 ? 'confirmed' : 'failed', blockNumber: receipt.blockNumber ?? null };
        if (await paidOnChain()) return { status: 'confirmed', blockNumber: null };
        if (now() - broadcastAt >= confirmDeadlineMs) return { status: 'failed', blockNumber: null };
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    })().catch(() => ({ status: 'failed', blockNumber: null }));
    return waiting;
  };
  return {
    txHash: tx.hash, sessionId32, amountWei: quote.entryTotalWei,
    entryFeeWei: quote.entryFeeWei, settlementGasReserveWei: quote.settlementGasReserveWei, paid: true, wait,
  };
}

// Waits for the entry to confirm (existing callers and tests). New code uses
// sendRankedEntry and starts the run on broadcast. The other options (the
// pre-flight quote, the expected wallet, a read provider, timings) pass through.
export async function openRankedSession(walletProvider, { sessionId, sessionKey = null, gameId, ...entryOptions } = {}) {
  if (!SETTLEMENT_LIVE) throw new Error('Ranked settlement is disabled. No entry fee was requested.');
  if (!walletProvider?.request) throw new Error('A connected wallet is required to pay the Ranked entry.');
  if (!sessionId || !gameId) throw new Error('sessionId and gameId are required.');
  const key = isBytes32Hex(sessionKey) ? sessionKey.toLowerCase() : await toBytes32Id(sessionId);
  const sent = await sendRankedEntry(walletProvider, { ...entryOptions, sessionKey: key, gameId });
  const receipt = await sent.wait();
  if (receipt.status !== 'confirmed') throw new Error('The Ranked entry transaction did not confirm.');
  return {
    txHash: sent.txHash, receipt, paid: sent.paid, amountWei: sent.amountWei,
    entryFeeWei: sent.entryFeeWei, settlementGasReserveWei: sent.settlementGasReserveWei, sessionId32: sent.sessionId32,
  };
}

// --- attestation: ask the trusted verifier (/api/attest) to sign the run -----
// Same origin, JSON in, EIP-712 signature out. Fails closed on any non-200.
export async function requestVerifierAttestation(payload, { fetchImpl = globalThis.fetch, endpoint = '/api/attest' } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('The attestation service is unavailable in this environment.');
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok || !body?.ok) {
    const error = body?.error ?? `attestation-http-${response.status}`;
    throw new Error(error === 'verifier-not-configured'
      ? 'The trusted verifier is not configured yet, so this run cannot be published on-chain.'
      : `The trusted verifier declined this run (${error}).`);
  }
  return body;
}

// --- WRITE: submit a completed ranked run (player-signed, 1 tx) -------------
// The run struct is rebuilt locally from the same inputs the verifier signed and
// the signature is checked against the on-chain trustedVerifier BEFORE the
// wallet is asked to confirm, so a bad attestation never costs gas.
export async function submitRankedSession(walletProvider, {
  sessionId,
  sessionKey = null,
  envelopeHash = null,
  attestation = null,
  gameId,
  score,
  kills = 0,
  maxCombo = 0,
  survivalSeconds = 0,
  bossId = null,
  achievements = [],
  runtimeId = null,
  seasonId = null,
} = {}) {
  if (!SETTLEMENT_LIVE) throw new Error('Ranked settlement is disabled. No transaction was requested.');
  if (!walletProvider?.request) throw new Error('A connected wallet is required to submit on-chain.');
  if (!sessionId) throw new Error('sessionId is required.');
  if (!gameId) throw new Error('gameId is required.');
  if (!isBytes32Hex(envelopeHash)) throw new Error('A canonical envelopeHash is required.');
  if (!attestation?.signature || !attestation?.deadline) throw new Error('A trusted verifier attestation is required.');

  const ethers = await loadEthers();
  const browserProvider = new ethers.BrowserProvider(walletProvider);

  // Hard chain guard: never broadcast on the wrong network.
  const net = await browserProvider.getNetwork();
  if (Number(net.chainId) !== LITVM_LITEFORGE_NETWORK.chainId) {
    throw new Error(`Wrong network: wallet is on chain ${net.chainId}, expected ${LITVM_LITEFORGE_NETWORK.chainId} (${LITVM_LITEFORGE_NETWORK.name}).`);
  }

  const gate = await readRankedContractGate(ethers, browserProvider, gameId);
  if (!gate.ok) throw new Error(gate.error);
  const signer = await browserProvider.getSigner();
  const player = await signer.getAddress();
  const contract = new ethers.Contract(scoreContractAddress(), SCORE_REGISTRY_ABI, signer);

  const sessionId32 = isBytes32Hex(sessionKey) ? sessionKey.toLowerCase() : await toBytes32Id(sessionId);
  const built = attestation.run
    ? { run: deserializeVerifiedRun(attestation.run), achievements32: attestation.achievements32 ?? [] }
    : buildVerifiedRun(ethers, {
      sessionId32, gameId, player, score, kills, maxCombo, survivalSeconds, bossId,
      envelopeHash, runtimeId, seasonId, deadline: attestation.deadline, achievements,
    });
  if (built.run.sessionId !== sessionId32 || built.run.player.toLowerCase() !== player.toLowerCase()) {
    throw new Error('The verifier attestation does not match this session and wallet.');
  }
  const domain = attestationDomain({ chainId: LITVM_LITEFORGE_NETWORK.chainId, verifyingContract: scoreContractAddress() });
  if (!isAttestationValid(ethers, { domain, run: built.run, signature: attestation.signature, trustedVerifier: gate.trustedVerifier })) {
    throw new Error('The verifier attestation is invalid or expired; the run was not published.');
  }
  const tx = await contract.submitVerifiedSession(built.run, [...built.achievements32], attestation.signature, await liteForgeFeeOverrides(browserProvider));
  const receipt = await tx.wait();
  return { txHash: tx.hash, receipt, sessionId32 };
}

// --- WRITE: create/update profile (optional, player-signed) -----------------
export async function submitProfile(walletProvider, { displayName, avatarUri = '' } = {}) {
  if (!walletProvider?.request) throw new Error('A connected wallet is required.');
  if (!displayName) throw new Error('displayName is required.');
  const ethers = await loadEthers();
  const browserProvider = new ethers.BrowserProvider(walletProvider);
  const net = await browserProvider.getNetwork();
  if (Number(net.chainId) !== LITVM_LITEFORGE_NETWORK.chainId) {
    throw new Error(`Wrong network: wallet is on chain ${net.chainId}, expected ${LITVM_LITEFORGE_NETWORK.chainId} (${LITVM_LITEFORGE_NETWORK.name}).`);
  }
  const signer = await browserProvider.getSigner();
  const contract = new ethers.Contract(profileContractAddress(), PROFILE_REGISTRY_ABI, signer);
  const tx = await contract.setProfile(displayName, avatarUri, await liteForgeFeeOverrides(browserProvider));
  const receipt = await tx.wait();
  return { txHash: tx.hash, receipt };
}

// --- normalize a raw on-chain ScoreRecord tuple to a plain object -----------
function normalizeRecord(r) {
  if (!r || !r.exists) return null;
  return {
    sessionId32: r.sessionId,
    player: String(r.player).toLowerCase(),
    gameId32: r.gameId,
    score: Number(r.score),
    kills: Number(r.kills),
    maxCombo: Number(r.maxCombo),
    survivalSeconds: Number(r.survivalSeconds),
    bossId32: r.bossId,
    runtimeId32: r.runtimeId ?? null,
    seasonId32: r.seasonId ?? null,
    submittedAt: Number(r.submittedAt),
    verified: Boolean(r.verified),
    onChain: true,
  };
}

// --- READ: global leaderboard (top by score) --------------------------------
// Pulls the most recent `scan` sessions and sorts client-side by score. Returns
// { ok, records, error } so the UI can fall back to local state on failure.
export async function fetchGlobalLeaderboard({ walletProvider = null, scan = 200, top = 50 } = {}) {
  try {
    const ethers = await loadEthers();
    return await withPublicRead(ethers, walletProvider, async (provider) => {
      const contract = new ethers.Contract(scoreContractAddress(), SCORE_REGISTRY_ABI, provider);
      const total = Number(await contract.totalSessions());
      if (total === 0) return { ok: true, records: [], total: 0 };
      const offset = Math.max(0, total - scan);
      const raw = await contract.getRecentSessions(BigInt(offset), BigInt(scan));
      const records = raw.map(normalizeRecord).filter((record) => record?.verified);
      records.sort((a, b) => b.score - a.score || b.submittedAt - a.submittedAt);
      return { ok: true, records: records.slice(0, top), total };
    });
  } catch (err) {
    return { ok: false, records: [], error: err?.message || String(err) };
  }
}

// --- READ: a player's ranked-run history (profile page) ---------------------
export async function fetchPlayerSessions(wallet, { walletProvider = null, limit = 50 } = {}) {
  if (!wallet) return { ok: false, records: [], error: 'no wallet' };
  try {
    const ethers = await loadEthers();
    return await withPublicRead(ethers, walletProvider, async (provider) => {
      const contract = new ethers.Contract(scoreContractAddress(), SCORE_REGISTRY_ABI, provider);
      const count = Number(await contract.playerSessionCount(wallet));
      if (count === 0) return { ok: true, records: [], total: 0 };
      const offset = Math.max(0, count - limit);
      const raw = await contract.getPlayerSessions(wallet, BigInt(offset), BigInt(limit));
      const records = raw.map(normalizeRecord).filter((record) => record?.verified === true);
      records.sort((a, b) => b.submittedAt - a.submittedAt);
      return { ok: true, records, total: count };
    });
  } catch (err) {
    return { ok: false, records: [], error: err?.message || String(err) };
  }
}

// --- READ: a player's on-chain profile --------------------------------------
export async function fetchProfile(wallet, { walletProvider = null } = {}) {
  if (!wallet) return null;
  try {
    const ethers = await loadEthers();
    const p = await withPublicRead(ethers, walletProvider, (provider) => new ethers.Contract(profileContractAddress(), PROFILE_REGISTRY_ABI, provider).getProfile(wallet));
    if (!p || !p.exists) return null;
    return {
      displayName: p.displayName,
      avatarUri: p.avatarUri,
      createdAt: Number(p.createdAt),
      lastUpdated: Number(p.lastUpdated),
      onChain: true,
    };
  } catch {
    return null;
  }
}

// --- READ: which achievement tokens a wallet holds (soulbound, one per id) ---
export async function fetchPlayerAchievements(wallet, achievementIds = [], { walletProvider = null, gameId = null } = {}) {
  // One soulbound collection per game (owner decision 2026-09-16). There is no
  // cross-game fallback: without a known gameId there is nothing to read.
  const address = (gameId && Object.hasOwn(LITVM_CONTRACT_ADDRESSES.achievementRegistries, gameId)) ? LITVM_CONTRACT_ADDRESSES.achievementRegistries[gameId] : null;
  if (!wallet || !address || achievementIds.length === 0) return { ok: false, unlocked: [], error: 'achievement registry unavailable' };
  try {
    const ethers = await loadEthers();
    const unlocked = await withPublicRead(ethers, walletProvider, async (provider) => {
      const contract = new ethers.Contract(address, ACHIEVEMENT_REGISTRY_ABI, provider);
      const found = [];
      for (const id of achievementIds) {
        const id32 = isBytes32Hex(id) ? id : ethers.id(String(id));
        // eslint-disable-next-line no-await-in-loop
        if (await contract.hasUnlocked(wallet, id32)) found.push(String(id));
      }
      return found;
    });
    return { ok: true, unlocked };
  } catch (err) {
    return { ok: false, unlocked: [], error: err?.message || String(err) };
  }
}

export function explorerTxUrl(txHash) {
  if (!txHash) return null;
  return `${LITVM_LITEFORGE_NETWORK.explorerUrl}/tx/${txHash}`;
}

// --- PRE-FLIGHT: chain, contract approval/ABI, connected account and gas ------
// Gas-free reads only: never prompts for account access or creates a signer.
// The one wallet call is eth_chainId (plus eth_accounts, which never prompts,
// when the caller does not pass `wallet`). The contract gate, the quote, the
// balance and the fee all come over the public LiteForge RPC (`readProvider`
// only for tests and tools). `needWei` is the exact entry total plus a gas
// estimate for openSession (`minGasWei` overrides the estimate).
// `ok` proves these prerequisites, not entry collection, verifier-service
// acceptance, real-wallet compatibility, or settlement activation.
export async function checkRankedReadiness(walletProvider, { gameId, minGasWei = null, wallet = null, readProvider = null, ethersLoader = loadEthers } = {}) {
  const result = {
    ok: false, onChain: false, chainId: null, wallet: null,
    hasFunds: false, balanceWei: 0n, balanceEth: '0', needWei: 0n, gasWei: 0n, entryTotalWei: 0n,
    error: null, errorKind: null, contractGate: null,
  };
  if (minGasWei !== null && (typeof minGasWei !== 'bigint' || minGasWei <= 0n)) {
    result.error = 'The Ranked gas estimate must be a positive integer in wei.';
    result.errorKind = 'invalid-gas-estimate';
    return result;
  }
  if (!walletProvider?.request) {
    const classified = classifyWalletError(new Error('No wallet connected.'));
    result.error = classified.message;
    result.errorKind = classified.kind;
    return result;
  }
  try {
    const ethers = await ethersLoader();
    result.chainId = Number(BigInt(await walletProvider.request({ method: 'eth_chainId' })));
    result.onChain = result.chainId === LITVM_LITEFORGE_NETWORK.chainId;
    if (!result.onChain) return result;
    let account = typeof wallet === 'string' && ethers.isAddress(wallet) ? wallet : null;
    const reads = await withReadProvider(ethers, readProvider, async (provider) => {
      const gate = await readRankedContractGate(ethers, provider, gameId);
      if (!gate.ok) return { gate };
      if (!account) {
        const accounts = await walletProvider.request({ method: 'eth_accounts' });
        account = Array.isArray(accounts) && ethers.isAddress(accounts[0]) ? accounts[0] : null;
      }
      if (!account) return { gate };
      const [balanceWei, gasWei] = await Promise.all([provider.getBalance(account), minGasWei ?? estimateEntryGasWei(provider)]);
      return { gate, balanceWei, gasWei };
    });
    result.contractGate = reads.gate;
    if (!result.contractGate.ok) {
      result.error = result.contractGate.error;
      result.errorKind = 'contract-gate';
      return result;
    }
    if (!account) {
      result.error = 'Connect a wallet before checking Ranked readiness.';
      result.errorKind = 'no-account';
      return result;
    }
    result.wallet = account.toLowerCase();
    result.entryTotalWei = BigInt(result.contractGate.entryTotalWei ?? 0n);
    result.gasWei = BigInt(reads.gasWei);
    result.needWei = result.entryTotalWei + result.gasWei;
    result.balanceWei = BigInt(reads.balanceWei);
    result.balanceEth = ethers.formatEther(result.balanceWei);
    result.hasFunds = result.balanceWei >= result.needWei;
    if (!result.hasFunds) result.errorKind = 'insufficient-funds';
    result.ok = result.onChain && result.contractGate.ok && result.hasFunds;
    return result;
  } catch (err) {
    const classified = classifyWalletError(err);
    result.error = classified.message;
    result.errorKind = classified.kind;
    return result;
  }
}

// The wallet's zkLTC over the public RPC (the nav balance chip). Null when the
// read fails.
export async function fetchWalletBalance(wallet, { readProvider = null } = {}) {
  if (typeof wallet !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) return null;
  try {
    const ethers = await loadEthers();
    return BigInt(await withReadProvider(ethers, readProvider, (provider) => provider.getBalance(wallet)));
  } catch {
    return null;
  }
}
