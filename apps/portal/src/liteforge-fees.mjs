// Fee fields for every player-signed LiteForge transaction (Ranked entry, on-chain name change).
//
// LiteForge's base fee moves fast: about 0.01 gwei on 2026-09-22, 1.7 gwei at the 2026-09-23 peak, and
// on 2026-09-24 it climbed from 0.07 to 0.26 gwei within minutes. A wallet's own estimate lags behind it,
// and even a fresh read goes stale while the wallet popup waits for the player's click, so transactions
// were refused with "max fee per gas less than block base fee". So the arcade prices each transaction
// itself from the latest block: a cap of ten times the base fee, never below 5 gwei (above every LiteForge
// base fee seen so far), and no priority tip. An Arbitrum Orbit chain charges only the base fee, so the
// cap costs nothing; it only means the wallet must hold gas limit x cap on top of the value it sends.
// Pure: the caller passes a provider with getBlock (ethers) and gets bigint fields for ethers overrides.

export const LITEFORGE_FEE_HEADROOM = 10n;
export const LITEFORGE_MIN_MAX_FEE_PER_GAS_WEI = 5_000_000_000n; // 5 gwei

export function liteForgeMaxFeePerGas(baseFeePerGas) {
  let base = 0n;
  try { base = BigInt(baseFeePerGas ?? 0); } catch { base = 0n; }
  const capped = base * LITEFORGE_FEE_HEADROOM;
  return capped > LITEFORGE_MIN_MAX_FEE_PER_GAS_WEI ? capped : LITEFORGE_MIN_MAX_FEE_PER_GAS_WEI;
}

// ethers overrides for a player transaction. A failed block read still returns the 5 gwei floor.
export async function liteForgeFeeOverrides(provider) {
  let baseFeePerGas = null;
  try {
    const block = await provider?.getBlock?.('latest');
    baseFeePerGas = block?.baseFeePerGas ?? null;
  } catch { baseFeePerGas = null; }
  return { maxFeePerGas: liteForgeMaxFeePerGas(baseFeePerGas), maxPriorityFeePerGas: 0n };
}
