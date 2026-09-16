# June 2026 legacy contracts (archived, read-only)

These files are the **June 2026 USDC / ERC-20 design** of the Lester's Arcade contract set:

| File | Role in the June design |
|------|-------------------------|
| `ArcadePaymentRouter.sol` | ERC-20 (USDC) paid-session router with `startPaidSession(sessionId, gameId, amount)` (inline `IArcadeRouterToken`, `IArcadeRouterGameRegistry`). |
| `PaymentRouter.sol` | ERC-20 fee splitter (`splitAndDisburse`) with operator-set default vaults (inline `IERC20Like`). |
| `SessionLedger.sol` | ERC-20 escrow session ledger with EIP-712 `closeSession` (inline `ISessionGameRegistry`, `IPaymentRouter`). |
| `TournamentPool.sol` | Native-token tournament prize pool. |
| `interfaces/IERC20.sol` | Minimal ERC-20 interface used by the above. |

They were deployed on LitVM LiteForge testnet (chainId 4441) on 2026-06-22 at the addresses recorded in
`contracts/deployment-record.json` (`arcadePaymentRouter`, `sessionLedger`, `tournamentPool`, plus the June
`gameRegistry`, `scoreSubmissionRegistry`, `achievementRegistry`, `lestersArcadeCore`).

## Disposition

- **Archived read-only.** Nothing here compiles as part of the current build (`scripts/compile-contracts.mjs`
  does not list this directory) and `npm run contracts:check` asserts these files are NOT under `contracts/src`.
- **Never import as verified.** Scores or sessions read from the June deployment must not be imported into the
  hardened registries as verified data. The June score export lives at
  `docs/web3/archives/litvm-score-registry-2026-06-22-legacy-13.json`.
- **Superseded by** the 2026-09-16 native-fee design: `ArcadeRankedEntry` (0.1 zkLTC native entry fee),
  the EIP-712 `ScoreSubmissionRegistry`, and the soulbound ERC-721 `AchievementRegistry`. See
  `docs/web3/contract-overhaul-20260916.md`.
