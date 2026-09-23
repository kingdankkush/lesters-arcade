// Background Ranked pre-flight (guide §3.2, §5.10; contract §7.6).
//
// Started when a signed-in player opens a game's mode select, so the Ranked
// modal already has the exact quote and balance when it opens. Live only: in
// preview it returns without touching the network. The reads (contract gate,
// quoteEntry, balance, fee) go over the public LiteForge RPC; the only wallet
// call is eth_chainId. Results are cached per game and wallet for `ttlMs`.
//
// Loaded with import() from main.js.

import { checkRankedReadiness } from './litvm-chain-client.mjs';

export const RANKED_PREFLIGHT_TTL_MS = 60_000;

const lower = (value) => String(value ?? '').toLowerCase();
const keyFor = (gameId, wallet) => `${gameId}|${lower(wallet)}`;

export function preflightFromReadiness(readiness, { gameId, now }) {
  const gate = readiness?.contractGate ?? null;
  const gateOk = gate?.ok === true;
  return Object.freeze({
    ok: readiness?.ok === true,
    gameId,
    wallet: readiness?.wallet ?? null,
    chainId: readiness?.chainId ?? null,
    onChain: readiness?.onChain === true,
    balanceWei: BigInt(readiness?.balanceWei ?? 0n),
    balanceEth: readiness?.balanceEth ?? '0',
    entryFeeWei: gateOk ? BigInt(gate.entryFeeWei ?? 0n) : null,
    settlementGasReserveWei: gateOk ? BigInt(gate.settlementGasReserveWei ?? 0n) : null,
    entryTotalWei: gateOk ? BigInt(gate.entryTotalWei ?? 0n) : null,
    gasWei: BigInt(readiness?.gasWei ?? 0n),
    needWei: BigInt(readiness?.needWei ?? 0n),
    hasFunds: readiness?.hasFunds === true,
    rankedEntryAddress: gateOk ? gate.rankedEntryAddress ?? null : null,
    contractGate: gate,
    error: readiness?.error ?? null,
    errorKind: readiness?.errorKind ?? null,
    checkedAt: now,
  });
}

export function createRankedPreflight({
  live = false,
  loadEthers = undefined,
  readProvider = null,     // public RPC (null: litvm-chain-client's own public provider)
  now = () => Date.now(),
  ttlMs = RANKED_PREFLIGHT_TTL_MS,
  checkReadiness = checkRankedReadiness,
} = {}) {
  const cache = new Map();     // key -> Preflight
  const inflight = new Map();  // key -> Promise<Preflight>

  function fresh(entry) {
    return entry && now() - entry.checkedAt < ttlMs;
  }

  function peek({ gameId, wallet } = {}) {
    if (!live || !gameId || !wallet) return null;
    const entry = cache.get(keyFor(gameId, wallet));
    return fresh(entry) ? entry : null;
  }

  function start({ gameId, wallet, walletProvider = null, force = false } = {}) {
    if (!live) return Promise.resolve(null);
    if (!gameId || !/^0x[0-9a-fA-F]{40}$/.test(String(wallet ?? ''))) return Promise.resolve(null);
    const key = keyFor(gameId, wallet);
    const cached = cache.get(key);
    if (!force && fresh(cached)) return Promise.resolve(cached);
    if (inflight.has(key)) return inflight.get(key);
    const options = { gameId, wallet, readProvider: typeof readProvider === 'function' ? readProvider() : readProvider };
    if (loadEthers) options.ethersLoader = loadEthers;
    // Without a wallet provider (a WalletConnect session whose provider is not
    // created yet) the chain cannot be asked, so nothing is cached.
    const run = walletProvider?.request
      ? checkReadiness(walletProvider, options)
      : Promise.resolve({ ok: false, onChain: false, chainId: null, error: null, errorKind: 'provider-pending', contractGate: null });
    const promise = Promise.resolve(run)
      .then((readiness) => {
        const preflight = preflightFromReadiness(readiness, { gameId, now: now() });
        if (walletProvider?.request) cache.set(key, preflight);
        return preflight;
      })
      .catch((error) => preflightFromReadiness({ error: String(error?.message ?? error), errorKind: 'wallet-error' }, { gameId, now: now() }))
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  function clear() {
    cache.clear();
  }

  return Object.freeze({ start, peek, clear });
}
