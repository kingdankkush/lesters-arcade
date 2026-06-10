// Lester's Arcade - Game Registry & Third-Party Adapter System
// Allows easy onboarding of new games (e.g. Chikun flappy bird) while sharing
// wallet identity, parent profile, achievements, and ranked sessions.
//
// Design: the parent portal owns identity (wallet -> profile). Child games
// register here and submit run summaries back through submitGameRun(). In a
// later phase these calls route to the LitVM contracts (GameRegistry.sol,
// PlayerProfileRegistry.sol, ScoreSubmissionRegistry.sol).

// NOTE: intentionally NOT frozen — registerGame() mutates this map at runtime.
// The built-in entry is the canonical first-party cabinet.
const REGISTERED_GAMES = {
  'hard-money-heroes': Object.freeze({
    id: 'hard-money-heroes',
    name: 'Hard Money Heroes',
    devWallet: null, // set when LitVM contracts go live
    feeSplit: { dev: 60, platform: 20, liquidity: 10, treasury: 10 },
    adapter: null, // native cabinet — no adapter needed
    status: 'live',
  }),
};

// Register a third-party cabinet (e.g. Chikun). Validates the minimal shape a
// game needs to participate in shared identity + ranked sessions.
export function registerGame(gameConfig) {
  if (!gameConfig?.id || !gameConfig?.name) {
    throw new Error('[GameRegistry] registerGame requires { id, name }');
  }
  if (REGISTERED_GAMES[gameConfig.id]) {
    console.warn(`[GameRegistry] Game '${gameConfig.id}' already registered — updating entry.`);
  }
  REGISTERED_GAMES[gameConfig.id] = Object.freeze({
    feeSplit: { dev: 60, platform: 20, liquidity: 10, treasury: 10 },
    adapter: null,
    status: 'pending-review',
    ...gameConfig,
  });
  return REGISTERED_GAMES[gameConfig.id];
}

export function getRegisteredGame(gameId) {
  return REGISTERED_GAMES[gameId] ?? null;
}

export function listRegisteredGames() {
  return Object.values(REGISTERED_GAMES);
}

// Safe localStorage access (Node test runs have no DOM).
function storageGet(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

// Shared Profile Adapter (used by all cabinets). Parent account owns this.
export async function getSharedPlayerProfile(wallet) {
  // Later phase: read from PlayerProfileRegistry contract on LitVM.
  return {
    wallet: wallet ?? null,
    displayName: storageGet('displayName') || 'Anonymous Hero',
    avatar: storageGet('avatar') || 'default',
    totalStats: { runs: 0, totalScore: 0, totalKills: 0 },
    achievements: [],
  };
}

// Child game -> parent sync packet for a completed ranked run.
// stats = { score, kills, survivalTime, achievements, metadata }
export async function submitGameRun(gameId, stats, wallet) {
  const game = getRegisteredGame(gameId);
  if (!game) {
    return { success: false, error: `Unknown game '${gameId}' — register it first.` };
  }
  // Later phase: EIP-712 signature + SessionLedger contract settlement.
  console.log(`[GameRegistry] Run submitted for ${gameId} from ${wallet ?? 'unknown wallet'}`, stats);
  return { success: true, sessionId: Date.now(), gameId };
}
