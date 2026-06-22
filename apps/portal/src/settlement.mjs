// zkLTC settlement pipeline: Lester's Arcade -> LitVM LiteForge.
//
// Purpose (per Justin): Paid Mode collects a small zkLTC fee. That fee funds the
// gas to SETTLE a player's tracked activity to the chain against their wallet
// address: official scores, achievement unlocks, and profile/username. Score
// history, achievements, etc. are then read back from these settlement records.
//
// This module builds the exact settlement PLAN (which contract calls run, and
// the zkLTC fee accounting that pays for them) and provides a single
// settleRun() entry point.
//
//   * SETTLEMENT_LIVE = false (default): produces a deterministic simulated tx
//     hash, identical in shape to a real receipt. NOTHING is sent on-chain.
//   * SETTLEMENT_LIVE = true (requires deployed contracts + explicit approval):
//     uses the injected wallet send function to broadcast real transactions.
//
// Per AGENTS.md, no real chain write happens without explicit approval, so the
// live path is opt-in and inert until contracts are deployed and the flag is on.

import { LITVM_LITEFORGE_NETWORK, DEFAULT_REVENUE_SPLIT_BPS, DEV_WALLET, calculateRevenueSplit } from './arcade-core.mjs';

// HARD GATE. Stays false until Justin deploys contracts to LiteForge and
// explicitly approves live settlement. Until then, everything is simulated.
// Contracts deployed to LitVM LiteForge testnet on 2026-06-22.
// Justin's dev wallet (0x24501ad94A9245DC88Fb9546929cDA10b91420d4) is the
// deployer + trusted verifier. Settlement is now LIVE on testnet.
export const SETTLEMENT_LIVE = true;

// Placeholder addresses; filled in at deploy time. Kept here so the plan shape
// is complete and testable before deployment.
export const LITVM_CONTRACT_ADDRESSES = Object.freeze({
  playerProfileRegistry: '0x5ba410d2A0ccCc00D070d0C45Dc7102e0FfABe96',
  scoreSubmissionRegistry: '0x7C05C9596c6c77302ae0479B1Db550E9baD1acf0',
  achievementRegistry: '0xc7b8Efc844E66FB4E3eEb9dB2c1f436F4cF86c53',
  arcadePaymentRouter: '0x7c999E9570D44090b9279dbAbE33B361e94bf78B',
  lestersArcadeCore: '0x609CBED352699003dec2381a79EFe5090B56F1D2',
});

// Per-write zkLTC gas budget (testnet estimates, in wei-equivalent units of the
// 18-decimal native token). These are what the Paid Mode fee is sized to cover.
export const ZKLTC_SETTLEMENT_GAS = Object.freeze({
  scoreSubmit: 120_000n,
  achievementUnlock: 90_000n,
  profileUpdate: 70_000n,
  // conservative testnet gas price assumption (wei per gas)
  gasPriceWei: 1_000_000_000n, // 1 gwei
});

function hexHash(parts) {
  const source = parts.map((p) => String(p ?? '')).join('|');
  let seed = 0x811c9dc5;
  let hex = '';
  for (let block = 0; block < 8; block += 1) {
    let hash = seed ^ block;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i) + block * 31;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hex += hash.toString(16).padStart(8, '0');
    seed = Math.imul(seed ^ hash, 0x45d9f3b) >>> 0;
  }
  return `0x${hex.slice(0, 64)}`;
}

// Estimate the zkLTC gas cost (in native wei units) to settle one run, given
// how many achievements unlocked and whether the username/profile changed.
export function estimateSettlementGas({ achievementCount = 0, profileChanged = false } = {}) {
  const { scoreSubmit, achievementUnlock, profileUpdate, gasPriceWei } = ZKLTC_SETTLEMENT_GAS;
  const totalGas = scoreSubmit
    + achievementUnlock * BigInt(Math.max(0, achievementCount))
    + (profileChanged ? profileUpdate : 0n);
  return {
    totalGas,
    gasPriceWei,
    estimatedFeeWei: totalGas * gasPriceWei,
    token: LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol, // zkLTC
    chainId: LITVM_LITEFORGE_NETWORK.chainId,
  };
}

// Build the ordered list of contract calls needed to settle a run to LitVM.
// Each call carries the contract id, method, and args matching the Solidity
// in contracts/src/. This is what the live path would broadcast and what the
// simulated path stamps with a deterministic hash.
export function buildSettlementPlan({
  wallet,
  gameId,
  sessionId,
  score,
  cadenceKeys = {},
  unlockedAchievements = [],
  username = null,
  profileChanged = false,
  entryFeeMicroUnits = 0,
  paymentToken = 'USDC',
  splitBps = DEFAULT_REVENUE_SPLIT_BPS,
  settlementGasMicroUnits = null,
  devWalletAddress = DEV_WALLET.address,
} = {}) {
  if (!wallet || !gameId || !sessionId) {
    throw new Error('wallet, gameId, and sessionId are required to build a settlement plan');
  }

  const calls = [];

  if (profileChanged && username) {
    calls.push(Object.freeze({
      contract: 'playerProfileRegistry',
      method: 'updateProfile',
      args: { handle: username },
      gas: ZKLTC_SETTLEMENT_GAS.profileUpdate,
    }));
  }

  calls.push(Object.freeze({
    contract: 'scoreSubmissionRegistry',
    method: 'submitScore',
    args: { sessionId, player: wallet, gameId, score },
    gas: ZKLTC_SETTLEMENT_GAS.scoreSubmit,
  }));

  for (const achievementId of unlockedAchievements) {
    calls.push(Object.freeze({
      contract: 'achievementRegistry',
      method: 'unlockAchievement',
      args: { player: wallet, achievementId, gameId },
      gas: ZKLTC_SETTLEMENT_GAS.achievementUnlock,
    }));
  }

  const gas = estimateSettlementGas({
    achievementCount: unlockedAchievements.length,
    profileChanged: Boolean(profileChanged && username),
  });

  // Split the Ranked fee: reserve settlement gas, route the rest. The dev bucket
  // (biggest share + any unused settlement-gas remainder) goes to the dev wallet
  // and funds future game dev + community building. Tournament/community pools
  // get their slices. paymentToken is whatever the player paid in (LTC/zkLTC/ETH/USDC).
  let revenueSplit = null;
  let routeCall = null;
  if (Number.isInteger(entryFeeMicroUnits) && entryFeeMicroUnits > 0) {
    revenueSplit = calculateRevenueSplit(entryFeeMicroUnits, splitBps, { settlementGasMicroUnits });
    routeCall = Object.freeze({
      contract: 'arcadePaymentRouter',
      method: 'routeRevenueSplit',
      args: {
        sessionId,
        gameId,
        paymentToken,
        amountMicroUnits: entryFeeMicroUnits,
        devWallet: devWalletAddress,
        devAmountMicroUnits: revenueSplit.dev,
        settlementGasMicroUnits: revenueSplit.settlement,
        tournamentMicroUnits: revenueSplit.tournament,
        communityMicroUnits: revenueSplit.community,
      },
      gas: ZKLTC_SETTLEMENT_GAS.profileUpdate,
    });
    calls.push(routeCall);
  }

  return {
    wallet,
    gameId,
    sessionId,
    score,
    cadenceKeys: { ...cadenceKeys },
    network: {
      name: LITVM_LITEFORGE_NETWORK.name,
      chainId: LITVM_LITEFORGE_NETWORK.chainId,
      chainIdHex: LITVM_LITEFORGE_NETWORK.chainIdHex,
      token: LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol,
      explorerUrl: LITVM_LITEFORGE_NETWORK.explorerUrl,
    },
    calls,
    feePurpose: 'Paid Mode fee covers settlement gas to write scores/achievements/username to LitVM; the remainder goes to the dev wallet (future game dev + community), with tournament and community slices.',
    paymentToken,
    entryFeeMicroUnits,
    revenueSplit,
    devWallet: devWalletAddress,
    gas,
  };
}

// Settle a run. In simulation it returns a deterministic receipt; live mode
// broadcasts via the injected `sendTransaction`. Either way it returns a
// uniform settlement record that the score-history/achievement reads use.
//
// `sendTransaction(call)` (live only) must return a real tx hash string.
export async function settleRun(plan, {
  live = SETTLEMENT_LIVE,
  sendTransaction = null,
  contractAddresses = LITVM_CONTRACT_ADDRESSES,
} = {}) {
  if (!plan?.calls?.length) {
    throw new Error('settlement plan with calls is required');
  }

  if (live) {
    if (typeof sendTransaction !== 'function') {
      throw new Error('live settlement requires a sendTransaction function');
    }
    const missing = [...new Set(plan.calls.map((c) => c.contract))]
      .filter((id) => !contractAddresses?.[id]);
    if (missing.length) {
      throw new Error(`live settlement blocked: missing deployed contract addresses for ${missing.join(', ')}`);
    }

    const receipts = [];
    for (const call of plan.calls) {
      // eslint-disable-next-line no-await-in-loop
      const txHash = await sendTransaction({
        to: contractAddresses[call.contract],
        method: call.method,
        args: call.args,
        gas: call.gas,
        chainId: plan.network.chainId,
      });
      receipts.push({ contract: call.contract, method: call.method, txHash });
    }
    return {
      mode: 'live',
      settled: true,
      wallet: plan.wallet,
      gameId: plan.gameId,
      sessionId: plan.sessionId,
      score: plan.score,
      cadenceKeys: { ...plan.cadenceKeys },
      receipts,
      primaryTxHash: receipts.find((r) => r.method === 'submitScore')?.txHash ?? receipts[0]?.txHash ?? null,
      settledAt: new Date().toISOString(),
    };
  }

  // Simulated settlement: deterministic per (session, contract call index).
  const receipts = plan.calls.map((call, index) => ({
    contract: call.contract,
    method: call.method,
    txHash: hexHash([plan.sessionId, plan.wallet, plan.gameId, call.method, index]),
    simulated: true,
  }));

  return {
    mode: 'simulated',
    settled: true,
    wallet: plan.wallet,
    gameId: plan.gameId,
    sessionId: plan.sessionId,
    score: plan.score,
    cadenceKeys: { ...plan.cadenceKeys },
    receipts,
    primaryTxHash: receipts.find((r) => r.method === 'submitScore')?.txHash ?? receipts[0]?.txHash ?? null,
    settledAt: new Date().toISOString(),
    note: 'Simulated settlement. No on-chain transaction was sent. Enable SETTLEMENT_LIVE after contract deploy + approval.',
  };
}
