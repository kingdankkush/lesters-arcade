// The Ranked fee: the one place the entry and the settlement reserve live
// (owner directions 2026-09-16 fee model, 2026-09-23 reserve, 2026-09-26
// amount). arcade-core.mjs re-exports every name here, so its importers and
// tests/ranked-fee-source-of-truth.test.mjs read the same values; a fee change
// is this file plus the on-chain GameRegistry.setEntryFee.
//
// A leaf module with no imports, so pages that load their modules unbundled
// (owner/jackpot.mjs, through wallet-auth.mjs) can read the fee without
// arcade-core.mjs, whose graph imports JSON the browser cannot load that way
// (tests/owner-jackpot-page.test.mjs). ranked-facts.mjs reads the price from here.

// Ranked Mode charges a flat 0.01 zkLTC (the LitVM native token) at entry,
// lowered from 0.1 zkLTC because the LiteForge faucet gives 0.05 zkLTC per
// request. Stored as a decimal wei string so it survives JSON persistence. On
// chain the fee is GameRegistry.games[gameId].entryFeeWei (operator-only
// setEntryFee); this constant is the client's static fallback and the single
// source of every displayed fee string: contracts/deploy-config.testnet.json
// agrees with it, and the server's settle floor (server/config.mjs
// DEFAULT_MIN_PAID_WEI) equals fee plus reserve. The live quote from
// ArcadeRankedEntry.quoteEntry replaces the rows at runtime, so the price path
// stays quote-driven.
export const RANKED_ENTRY_FEE_WEI = '10000000000000000';
export const RANKED_PAYMENT_TOKEN = 'zkLTC';

// Settlement gas reserve paid with the entry and forwarded to the relayer
// vault so the relayer can submit the verified score for the player: 0.002
// zkLTC (owner decision 2026-09-23, about 475k gas at 1.5 gwei) that the
// operator tunes on chain; the live quote comes from
// ArcadeRankedEntry.quoteEntry, never from this constant.
export const RANKED_SETTLEMENT_GAS_RESERVE_WEI = '2000000000000000';

// Decimal zkLTC amount of a wei string ('0.012'), trailing zeros trimmed.
export function formatZkLtcAmount(wei) {
  const value = BigInt(String(wei ?? '0').replace(/[^0-9]/g, '') || '0');
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = (value % 1_000_000_000_000_000_000n).toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

export function rankedEntryTotalWei(entryFeeWei = RANKED_ENTRY_FEE_WEI, reserveWei = RANKED_SETTLEMENT_GAS_RESERVE_WEI) {
  return (BigInt(String(entryFeeWei)) + BigInt(String(reserveWei))).toString();
}

// Derived display strings: the one place the fee, the reserve and the total are
// spelled out as zkLTC ('0.01', '0.002', '0.012'). Every public surface reads
// these.
export const RANKED_ENTRY_TOTAL_WEI = rankedEntryTotalWei();
export const RANKED_ENTRY_FEE_ZKLTC = formatZkLtcAmount(RANKED_ENTRY_FEE_WEI);
export const RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC = formatZkLtcAmount(RANKED_SETTLEMENT_GAS_RESERVE_WEI);
export const RANKED_ENTRY_TOTAL_ZKLTC = formatZkLtcAmount(RANKED_ENTRY_TOTAL_WEI);
