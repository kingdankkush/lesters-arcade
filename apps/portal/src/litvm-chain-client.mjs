// Lester's Arcade — LitVM chain client (browser-only, ethers v6).
//
// This is the ONE place that talks to the deployed LitVM LiteForge contracts.
// It is player-signed: the connected wallet (MetaMask/Rabby) sends its own
// score-submission transaction and pays the zkLTC gas. There is no backend and
// no trusted operator key in the browser.
//
//   WRITE  (needs the player's wallet provider, 1 confirmation popup):
//     submitRankedSession(provider, { ... })  -> { txHash, receipt }
//
//   READ   (gas-free; uses the wallet provider if present, else public RPC):
//     fetchGlobalLeaderboard({ limit })       -> [{ player, score, ... }]
//     fetchPlayerSessions(wallet, { limit })   -> [{ ... }]
//     fetchProfile(wallet)                     -> { displayName, ... } | null
//
// Everything degrades gracefully: a read failure returns an empty result and a
// flag so the UI can fall back to local state instead of throwing.

import { LITVM_LITEFORGE_NETWORK } from './arcade-core.mjs';
import { LITVM_CONTRACT_ADDRESSES } from './settlement.mjs';

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
export const SCORE_REGISTRY_ABI = [
  'function submitSession(bytes32 sessionId, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32[] achievements) external',
  'function getSession(bytes32 sessionId) external view returns (tuple(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, uint64 submittedAt, bool exists))',
  'function getSessionAchievements(bytes32 sessionId) external view returns (bytes32[])',
  'function playerSessionCount(address player) external view returns (uint256)',
  'function getPlayerSessions(address player, uint256 offset, uint256 limit) external view returns (tuple(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, uint64 submittedAt, bool exists)[])',
  'function totalSessions() external view returns (uint256)',
  'function getRecentSessions(uint256 offset, uint256 limit) external view returns (tuple(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, uint64 submittedAt, bool exists)[])',
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

function pickReadProvider(ethers, walletProvider) {
  if (walletProvider?.request) {
    try { return new ethers.BrowserProvider(walletProvider); } catch { /* fall through */ }
  }
  // Public RPC read path (no wallet needed for the leaderboard/profile pages).
  return new ethers.JsonRpcProvider(LITVM_LITEFORGE_NETWORK.rpcUrls.http, LITVM_LITEFORGE_NETWORK.chainId);
}

function scoreContractAddress() {
  return LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry;
}
function profileContractAddress() {
  return LITVM_CONTRACT_ADDRESSES.playerProfileRegistry;
}

// --- WRITE: submit a completed ranked run (player-signed, 1 tx) -------------
export async function submitRankedSession(walletProvider, {
  sessionId,
  gameId,
  score,
  kills = 0,
  maxCombo = 0,
  survivalSeconds = 0,
  bossId = null,
  achievements = [],
} = {}) {
  if (!walletProvider?.request) throw new Error('A connected wallet is required to submit on-chain.');
  if (!sessionId) throw new Error('sessionId is required.');
  if (!gameId) throw new Error('gameId is required.');

  const ethers = await loadEthers();
  const browserProvider = new ethers.BrowserProvider(walletProvider);

  // Hard chain guard: never broadcast on the wrong network.
  const net = await browserProvider.getNetwork();
  if (Number(net.chainId) !== LITVM_LITEFORGE_NETWORK.chainId) {
    throw new Error(`Wrong network: wallet is on chain ${net.chainId}, expected ${LITVM_LITEFORGE_NETWORK.chainId} (${LITVM_LITEFORGE_NETWORK.name}).`);
  }

  const signer = await browserProvider.getSigner();
  const contract = new ethers.Contract(scoreContractAddress(), SCORE_REGISTRY_ABI, signer);

  const sessionId32 = await toBytes32Id(sessionId);
  const gameId32 = await toBytes32Id(gameId);
  const bossId32 = bossId ? await toBytes32Id(bossId) : ethers.ZeroHash;
  const achievements32 = [];
  for (const a of achievements) {
    if (a) achievements32.push(await toBytes32Id(a));
  }

  const tx = await contract.submitSession(
    sessionId32,
    gameId32,
    BigInt(Math.max(0, Math.round(Number(score) || 0))),
    BigInt(Math.max(0, Math.round(Number(kills) || 0))),
    BigInt(Math.max(0, Math.round(Number(maxCombo) || 0))),
    BigInt(Math.max(0, Math.round(Number(survivalSeconds) || 0))),
    bossId32,
    achievements32,
  );
  const receipt = await tx.wait();
  return { txHash: tx.hash, receipt, sessionId32 };
}

// --- WRITE: create/update profile (optional, player-signed) -----------------
export async function submitProfile(walletProvider, { displayName, avatarUri = '' } = {}) {
  if (!walletProvider?.request) throw new Error('A connected wallet is required.');
  if (!displayName) throw new Error('displayName is required.');
  const ethers = await loadEthers();
  const browserProvider = new ethers.BrowserProvider(walletProvider);
  const signer = await browserProvider.getSigner();
  const contract = new ethers.Contract(profileContractAddress(), PROFILE_REGISTRY_ABI, signer);
  const tx = await contract.setProfile(displayName, avatarUri);
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
    submittedAt: Number(r.submittedAt),
    onChain: true,
  };
}

// --- READ: global leaderboard (top by score) --------------------------------
// Pulls the most recent `scan` sessions and sorts client-side by score. Returns
// { ok, records, error } so the UI can fall back to local state on failure.
export async function fetchGlobalLeaderboard({ walletProvider = null, scan = 200, top = 50 } = {}) {
  try {
    const ethers = await loadEthers();
    const provider = pickReadProvider(ethers, walletProvider);
    const contract = new ethers.Contract(scoreContractAddress(), SCORE_REGISTRY_ABI, provider);
    const total = Number(await contract.totalSessions());
    if (total === 0) return { ok: true, records: [], total: 0 };
    const offset = Math.max(0, total - scan);
    const raw = await contract.getRecentSessions(BigInt(offset), BigInt(scan));
    const records = raw.map(normalizeRecord).filter(Boolean);
    records.sort((a, b) => b.score - a.score || b.submittedAt - a.submittedAt);
    return { ok: true, records: records.slice(0, top), total };
  } catch (err) {
    return { ok: false, records: [], error: err?.message || String(err) };
  }
}

// --- READ: a player's ranked-run history (profile page) ---------------------
export async function fetchPlayerSessions(wallet, { walletProvider = null, limit = 50 } = {}) {
  if (!wallet) return { ok: false, records: [], error: 'no wallet' };
  try {
    const ethers = await loadEthers();
    const provider = pickReadProvider(ethers, walletProvider);
    const contract = new ethers.Contract(scoreContractAddress(), SCORE_REGISTRY_ABI, provider);
    const count = Number(await contract.playerSessionCount(wallet));
    if (count === 0) return { ok: true, records: [], total: 0 };
    const offset = Math.max(0, count - limit);
    const raw = await contract.getPlayerSessions(wallet, BigInt(offset), BigInt(limit));
    const records = raw.map(normalizeRecord).filter(Boolean);
    records.sort((a, b) => b.submittedAt - a.submittedAt);
    return { ok: true, records, total: count };
  } catch (err) {
    return { ok: false, records: [], error: err?.message || String(err) };
  }
}

// --- READ: a player's on-chain profile --------------------------------------
export async function fetchProfile(wallet, { walletProvider = null } = {}) {
  if (!wallet) return null;
  try {
    const ethers = await loadEthers();
    const provider = pickReadProvider(ethers, walletProvider);
    const contract = new ethers.Contract(profileContractAddress(), PROFILE_REGISTRY_ABI, provider);
    const p = await contract.getProfile(wallet);
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

export function explorerTxUrl(txHash) {
  if (!txHash) return null;
  return `${LITVM_LITEFORGE_NETWORK.explorerUrl}/tx/${txHash}`;
}

// --- PRE-FLIGHT: chain + zkLTC balance check for Ranked entry ----------------
// Before a Ranked run starts we confirm the wallet is (a) on LitVM LiteForge and
// (b) holds enough zkLTC to pay the score-submission gas at game over. This
// front-loads the gas problem so a player never finishes a run and then finds
// they can't publish it. Returns a plain status object the UI renders.
//
//   { ok, onChain, chainId, hasFunds, balanceWei, balanceEth, needWei, error }
//
// `ok` is true only when on the right chain AND funded. Reads are cheap; this
// adds no transaction and no signature.
export async function checkRankedReadiness(walletProvider, { minGasWei = null } = {}) {
  const result = {
    ok: false, onChain: false, chainId: null,
    hasFunds: false, balanceWei: 0n, balanceEth: '0', needWei: 0n, error: null,
  };
  if (!walletProvider?.request) { result.error = 'No wallet connected.'; return result; }
  try {
    const ethers = await loadEthers();
    const browserProvider = new ethers.BrowserProvider(walletProvider);
    const net = await browserProvider.getNetwork();
    result.chainId = Number(net.chainId);
    result.onChain = result.chainId === LITVM_LITEFORGE_NETWORK.chainId;

    // Estimated worst-case gas for a single submitSession write. The actual
    // observed gas was ~300k; we pad to 400k * gasPrice for headroom.
    const gasUnits = 400_000n;
    let gasPriceWei = 1_000_000_000n; // 1 gwei fallback
    try {
      const fee = await browserProvider.getFeeData();
      if (fee?.gasPrice && fee.gasPrice > 0n) gasPriceWei = fee.gasPrice;
    } catch { /* use fallback */ }
    result.needWei = minGasWei ?? (gasUnits * gasPriceWei);

    const signer = await browserProvider.getSigner();
    const addr = await signer.getAddress();
    result.balanceWei = await browserProvider.getBalance(addr);
    result.balanceEth = ethers.formatEther(result.balanceWei);
    result.hasFunds = result.balanceWei >= result.needWei;
    result.ok = result.onChain && result.hasFunds;
    return result;
  } catch (err) {
    result.error = err?.message || String(err);
    return result;
  }
}
