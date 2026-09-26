// The static Ranked facts every public surface states (owner request 2026-09-26,
// brief docs/handoffs/ranked-onboarding-20260926/ranked-onboarding.md).
//
// One place for the price parts, the faucet, the chain, the split, the board
// resets and the achievement count. The page builder (scripts/build-portal-pages.mjs)
// renders the static pages from it, and the SPA copy in portal-content.mjs reads
// it. The fee and the reserve are not restated here: they come from
// ranked-fee.mjs, the single source of the fee (re-exported by arcade-core.mjs;
// tests/ranked-fee-source-of-truth.test.mjs, fable/ranked-fee-001).
// tests/ranked-facts.test.mjs ties every value to the code that enforces it:
// contracts/deploy-config.testnet.json (entry fee, reserve, split), the server
// settle floor (server/config.mjs DEFAULT_MIN_PAID_WEI = the total), the faucet
// URL (wallet-config.mjs), the boards (leaderboard-view.mjs) and the achievement
// catalogs (available entries only).
//
// The live Ranked modal never shows these numbers as the price: it shows the
// entry contract's quote (quoteEntry). The static copy is the explanation and
// the fallback before the quote answers.
//
// No DOM, no environment and no import but the ranked-fee.mjs leaf: pages that
// load unbundled (owner/jackpot.mjs through wallet-auth.mjs) read it, so it
// must never reach arcade-core.mjs, whose graph imports JSON a browser cannot
// load that way (tests/owner-jackpot-page.test.mjs).
import {
  RANKED_ENTRY_FEE_WEI, RANKED_ENTRY_FEE_ZKLTC, RANKED_ENTRY_TOTAL_WEI, RANKED_ENTRY_TOTAL_ZKLTC,
  RANKED_SETTLEMENT_GAS_RESERVE_WEI, RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC,
} from './ranked-fee.mjs';

const FAUCET_WEI = '50000000000000000';

// Decimal strings are what the copy prints; the wei strings are what tests
// compare against the contracts and the server floor (1 zkLTC = 1e18 wei).
export const RANKED_FACTS = Object.freeze({
  // Price per run: the game's entry plus the publishing reserve (owner
  // decision 2026-09-26: entry 0.1 -> 0.01; reserve unchanged since 2026-09-23),
  // from ranked-fee.mjs.
  entryZkLtc: RANKED_ENTRY_FEE_ZKLTC,
  entryWei: RANKED_ENTRY_FEE_WEI,
  publishZkLtc: RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC,
  publishWei: RANKED_SETTLEMENT_GAS_RESERVE_WEI,
  totalZkLtc: RANKED_ENTRY_TOTAL_ZKLTC,
  totalWei: RANKED_ENTRY_TOTAL_WEI,
  // GameRegistry split of the entry (devBps 8500 / treasuryBps 1500; tied to
  // arcade-core's DEFAULT_REVENUE_SPLIT_BPS and the deploy config by the test).
  developerPercent: 85,
  arcadePercent: 15,
  // LiteForge hub faucet: 0.05 zkLTC per request (owner, 2026-09-26); the URL is
  // wallet-config's LITEFORGE_FAUCET_URL (tied by the test).
  faucetUrl: 'https://liteforge.hub.caldera.xyz',
  faucetName: 'LiteForge faucet',
  faucetZkLtc: '0.05',
  faucetWei: FAUCET_WEI,
  // Whole Ranked runs one request pays for: floor(0.05 / 0.012) = 4.
  faucetRuns: Number(BigInt(FAUCET_WEI) / BigInt(RANKED_ENTRY_TOTAL_WEI)),
  // The chain Ranked pays on and publishes to (arcade-core's
  // LITVM_LITEFORGE_NETWORK, tied by the test).
  networkName: 'LitVM LiteForge testnet',
  chainId: 4441,
  token: 'zkLTC',
  explorerUrl: 'https://liteforge.explorer.caldera.xyz',
  // Global boards per game, best verified score per wallet (owner decision D2).
  boards: Object.freeze(['Weekly', 'Monthly', 'All-time']),
  weeklyReset: 'Monday 00:00 UTC',
  monthlyReset: 'the 1st of each month, 00:00 UTC',
  // The settle-retry cron runs every minute (vercel.json).
  publishRetryMinutes: 1,
  // Achievements a verified Ranked run can earn (catalog entries not marked
  // available: false), per game and in all.
  achievements: Object.freeze({ 'lester-blaster': 44, chikun: 40, stacked: 40 }),
  achievementTotal: 124,
  // The public player guide (apps/portal/how-ranked-works.html, served at
  // this clean path by a vercel.json rewrite; the in-game menus link it too).
  guidePath: '/how-ranked-works',
  guideUrl: 'https://lestersarcade.io/how-ranked-works',
});

// Canonical sentences shared with the in-game menus (brief, "Canonical
// wording"). Use them verbatim where they fit.
export const RANKED_WORDING = Object.freeze({
  price: `Ranked costs ${RANKED_FACTS.totalZkLtc} testnet zkLTC per run: ${RANKED_FACTS.entryZkLtc} entry + ${RANKED_FACTS.publishZkLtc} to publish your score on chain.`,
  faucet: `Get free testnet zkLTC from the LiteForge faucet (${RANKED_FACTS.faucetZkLtc} per request, enough for ${RANKED_FACTS.faucetRuns} Ranked runs).`,
  free: 'Free play needs no wallet and never touches the chain.',
  proof: "Ranked runs are checked by the arcade's server and published on LitVM, then appear on the leaderboards, your profile and your achievements.",
  value: 'Testnet zkLTC has no monetary value.',
});

// Short labels for buttons and chips that name the faucet amount.
export const FAUCET_LINK_TEXT = `Get free zkLTC (${RANKED_FACTS.faucetZkLtc} per request)`;
export const FAUCET_CHIP_TEXT = `Get ${RANKED_FACTS.faucetZkLtc} free zkLTC`;
