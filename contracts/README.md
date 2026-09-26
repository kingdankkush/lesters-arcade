# Lester's Arcade smart contracts (2026-09-16 native-fee design)

Solidity contracts for Lester's Arcade Ranked Mode on **LitVM LiteForge testnet** (chainId 4441, native
token **zkLTC**, 18 decimals, Arbitrum Orbit/Nitro). This set replaces the June 2026 ERC-20/USDC design,
which is archived read-only under [`archive/2026-06-legacy/`](archive/2026-06-legacy/README.md).

Owner direction (2026-09-16): Ranked Mode charges a flat entry **in the native token at entry**; that fee funds
on-chain settlement of the run (score + session data); achievements are **soulbound NFTs** bound to the wallet;
the June contracts are outdated and must be replaced and redeployed. The entry launched at 0.1 zkLTC; the owner
lowered it to **0.01 zkLTC** on 2026-09-26 (0.012 per run with the 0.002 reserve). The operator applies it on
chain with `setEntryFee` after the release that carries it; players always pay `quoteEntry(gameId).totalWei`.

## What is deployed today vs. not

| Contract | Status on chain 4441 |
|----------|----------------------|
| June 2026 set (`deployment-record.json`) | Deployed 2026-06-22. **Outdated.** Archived read-only; scores there are never imported as verified. |
| 2026-09 set in `src/` (this README) | **Compiled, not deployed.** `deploy-config.testnet.json` and `scripts/deploy-contracts.mjs` describe the deployment; running it requires the owner's deployer key and explicit approval. |

## Contracts (`src/`)

| Contract | Role |
|----------|------|
| `GameRegistry.sol` | Cabinet registry. `gameId = keccak256(slug)`. Stores dev wallet, fee split (dev/platform/liquidity/treasury bps = 10 000) and **`entryFeeWei`** (native). Operator 2-step transfer, `registerGame`, `confirmDevWallet` (by the dev wallet), `setPlayable`, `updateFeeSplit`, **`setEntryFee`**, `setTrustedVerifier`. |
| `ArcadeRankedEntry.sol` | **Native-token entry desk.** `openSession(sessionId, gameId)` is `payable`; `msg.value` must equal `quoteEntry(gameId).totalWei = game.entryFeeWei + settlementGasReserveWei` exactly (or 0 when `entryFeeEnabled == false`). The operator-set `settlementGasReserveWei` (default 0) is forwarded whole to `relayerVault` (funds the settlement relayer); the flat fee is routed immediately by the game's bps to devWallet / platformVault / liquidityVault / treasuryVault; rounding dust and any share whose vault is unset go to the dev wallet. Nothing is escrowed. `isPaid(sessionId, player, gameId)` is what the score registry checks. |
| `ScoreSubmissionRegistry.sol` | **Verified-only ranked ledger.** `submitVerifiedSession(VerifiedRun run, bytes32[] achievements, bytes signature)` accepts an **EIP-712** attestation (domain `Lester's Arcade Ranked Settlement` v`2`) signed by `trustedVerifier`. Requires the paid session when the game's fee > 0, bounds-checks the run, stores the record, updates `bestScore` / `bestSeasonScore`, and mints attested achievements through the game's own collection (`achievementRegistryByGame[run.gameId]`, skipped when unset). Caller must be `run.player` or an operator-allowed relayer (`relayers(address)`); the function is non-payable so the relayer needs nothing but the attestation. No unverified path exists. |
| `AchievementRegistry.sol` | **Soulbound ERC-721** (OpenZeppelin 5) + ERC-5192 `locked()`, **one deployment per game** with its own `name`/`symbol`/`baseTokenUri` (constructor args). Operator defines achievements; allowed minters (the score registry) call `mintFor(player, achievementId, sessionId)`, which returns `false` instead of reverting when already held / undefined. `tokenId = uint256(keccak256(abi.encode(player, achievementId)))`. Transfers between wallets revert `Soulbound()`; owner `burn`, operator `revoke`. |
| `PlayerProfileRegistry.sol` | Unchanged. Wallet → handle/avatar profile. |
| `LestersArcadeCore.sol` | Optional immutable address book for a deployed set. Not part of the deployment. |
| `interfaces/` | `IGameRegistry` (Game struct + `getGame`), `IArcadeRankedEntry` (`isPaid`), `IAchievementMinter` (`mintFor`). |

## Ranked flow

```
GameRegistry.getGame(gameId)               -> entryFeeWei = 0.01 zkLTC, playable, devWalletConfirmed
ArcadeRankedEntry.quoteEntry(gameId)       -> (entryFeeWei, settlementGasReserveWei, totalWei)
ArcadeRankedEntry.openSession{value: total} -> RankedSessionOpened + SettlementReserveForwarded (reserve -> relayerVault)
                                              + RevenueRouted (flat fee split 85/15 instantly)
play (off chain) -> verifier service signs VerifiedRun (EIP-712)
ScoreSubmissionRegistry.submitVerifiedSession(run, achievements, signature)
    -> isPaid(sessionId, player, gameId) must be true (fee > 0)
    -> ECDSA.recover(attestationDigest(run), signature) == trustedVerifier
    -> ScoreSubmitted + SessionSubmitted; bestScore / bestSeasonScore updated
    -> achievementRegistryByGame[gameId].mintFor(player, id, sessionId) per attested achievement (soulbound token)
```

## Fee split (testnet config)

All three registered games (owner decision 2026-09-16): `devBps 8500 / platformBps 0 / liquidityBps 0 /
treasuryBps 1500` (85 % developer, 15 % treasury), `entryFeeWei 10000000000000000` (0.01 zkLTC, owner decision
2026-09-26; 0.1 zkLTC before) plus
`settlementGasReserveWei 2000000000000000` (0.002 zkLTC, owner decision 2026-09-23; the operator retunes it with `setSettlementGasReserve`) forwarded to
`relayerVault`. Developer wallet and treasury vault are the owner wallet; relayer vault defaults to the
operator. This is a **testnet epoch**: mainnet is a fresh deployment set.

| slug | title |
|------|-------|
| `lester-blaster` | Hard Money Heroes |
| `chikun` | Chikun's Escape |
| `stacked` | STACKED |

## Tooling

```bash
npm run contracts:compile   # solc-js 0.8.35 -> contracts/artifacts/*.json (OZ deps compiled, not emitted)
npm run contracts:check     # structure pins for the 2026-09 set; asserts legacy files are archived
npm run contracts:test      # forge test (foundry required; not available in the Vercel/CI image)
npm run contracts:deploy    # DRY RUN by default -> docs/web3/hardened-ranked-deployment-manifest.json
```

Node gates: `node --test tests/contracts-security-abi.test.mjs tests/deploy-contracts-security.test.mjs tests/contract-abi-alignment.test.mjs`.

## Security notes

- **No caller-controlled token, amount or split** (WO-118): `openSession` takes only `(sessionId, gameId)`; the
  fee and the split come from `GameRegistry`, vault addresses from the operator.
- **Exact-amount native fee**: over/under payment reverts `WRONG_ENTRY_FEE`; session ids are single-use.
- **Verified-only scores**: the unverified `submitSession` is gone. Attestations carry `player`, `deadline`,
  `envelopeHash`, `runtimeId`, `seasonId` and `achievementsHash`; OpenZeppelin `ECDSA.recover` rejects
  malleable signatures.
- **Reentrancy**: `openSession` and `submitVerifiedSession` are `nonReentrant`; achievement minting uses
  `_mint` (no `onERC721Received` callback).
- **Operator keys**: every admin surface is 2-step transferable; the verifier key can be rotated with
  `ScoreSubmissionRegistry.setTrustedVerifier`.

Full change record and portal call sequence: [`docs/web3/contract-overhaul-20260916.md`](../docs/web3/contract-overhaul-20260916.md).
