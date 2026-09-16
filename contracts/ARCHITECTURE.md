# Lester's Arcade Smart Contract Architecture (2026-09-16)

## Overview

Lester's Arcade runs on **LitVM LiteForge testnet** (chainId 4441, Arbitrum Orbit/Nitro, native token
**zkLTC**, 18 decimals). Free Mode never touches the chain. **Ranked Mode** is a paid, verified, on-chain
mode:

1. the player pays **0.1 zkLTC in the native token** when the ranked session opens,
2. that fee is split instantly to the cabinet developer and platform vaults (it funds the settlement
   of the run on chain),
3. after the run, a **trusted verifier** signs an EIP-712 attestation of the run,
4. the player (or an approved relayer) submits the attestation; the score is recorded and any attested
   achievements are minted as **soulbound ERC-721** tokens bound to the wallet.

The June 2026 ERC-20/USDC design (`ArcadePaymentRouter`, `PaymentRouter`, `SessionLedger`,
`TournamentPool`) is retired and archived under `contracts/archive/2026-06-legacy/`.

## Contracts

### GameRegistry

Registry of cabinets keyed by `gameId = keccak256(abi.encodePacked(slug))` (`ethers.id(slug)`).

- Operator-only `registerGame(slug, title, devWallet, devBps, platformBps, liquidityBps, treasuryBps, entryFeeWei)`;
  split must total 10 000 bps.
- The dev wallet must call `confirmDevWallet(gameId)` before the operator can `setPlayable(gameId, true)`.
- `setEntryFee(gameId, entryFeeWei)` and `updateFeeSplit(...)` adjust economics without redeploying.
- `getGame(gameId)` returns the `Game` struct that both `ArcadeRankedEntry` and `ScoreSubmissionRegistry` read.
- 2-step operator transfer (`transferOperator` / `acceptOperator`); `trustedVerifier` field kept for
  discovery.

### ArcadeRankedEntry (native fee)

- `openSession(bytes32 sessionId, bytes32 gameId) payable nonReentrant`
  - `sessionId` must be non-zero and unused.
  - game must exist, be playable and have a confirmed dev wallet.
  - `entryFeeEnabled` (default true): `msg.value == game.entryFeeWei` exactly; otherwise `msg.value == 0`.
  - records `PaidSession{player, gameId, amountWei, openedAt, exists}`.
  - routes `msg.value` by bps: platform/liquidity/treasury shares to the operator-set vaults, remainder
    (dev share + rounding dust + any share whose vault is `address(0)`) to the game's dev wallet. Payouts
    use `call{value:}` and revert `PAYOUT_FAILED` if any recipient rejects.
  - emits `RankedSessionOpened(sessionId, player, gameId, amountWei)` and
    `RevenueRouted(sessionId, devAmount, platformAmount, liquidityAmount, treasuryAmount)`.
- `isPaid(sessionId, player, gameId)`: the binding the score registry enforces.
- The contract never holds a balance; there is no escrow, refund or withdrawal surface.

### ScoreSubmissionRegistry (EIP-712, verified-only)

- Inherits OpenZeppelin `EIP712("Lester's Arcade Ranked Settlement", "2")` and `ReentrancyGuard`.
- `VerifiedRun` (13 fields): `sessionId, gameId, player, score, kills, maxCombo, survivalSeconds, bossId,
  envelopeHash, runtimeId, seasonId, deadline, achievementsHash`.
- `attestationDigest(run)` = `_hashTypedDataV4(keccak256(abi.encode(VERIFIED_RUN_TYPEHASH, ...fields)))`.
  The verifier signs this digest (ethers `signTypedData` with the same domain/types produces the same
  signature).
- `submitVerifiedSession(run, achievements, signature)`:
  1. `msg.sender == run.player || relayers[msg.sender]`
  2. `block.timestamp <= run.deadline`, `envelopeHash != 0`, `sessionId != 0` and unused
  3. `achievements.length <= 32` and `keccak256(abi.encodePacked(achievements)) == run.achievementsHash`
  4. game exists and playable; if `entryFeeWei > 0` then `ArcadeRankedEntry.isPaid(sessionId, player, gameId)`
  5. bounds: `MAX_SCORE 10 000 000 000`, `MAX_KILLS 100 000`, `MAX_COMBO 10 000`, `MAX_SURVIVAL_SECONDS 24h`
  6. `ECDSA.recover(attestationDigest(run), signature) == trustedVerifier`
  7. store `ScoreRecord` (verified = true), index by player and globally, bind `sessionEnvelopeHash`,
     update `bestScore[gameId][player]` and `bestSeasonScore[gameId][seasonId][player]`
  8. `AchievementRegistry.mintFor(player, id, sessionId)` for each attested id (false results ignored)
  9. emit `ScoreSubmitted(...)` and `SessionSubmitted(sessionId, true)`.
- Operator surface: `setTrustedVerifier`, `setRelayer`, `setRankedEntry`, `setAchievementRegistry`,
  2-step operator transfer.
- Views: `getSession`, `getSessionAchievements`, `playerSessionCount`, `getPlayerSessions(offset, limit)`,
  `totalSessions`, `getRecentSessions(offset, limit)`, `bestScore`, `bestSeasonScore`, `domainSeparator`.

### AchievementRegistry (soulbound ERC-721)

- OpenZeppelin 5 `ERC721("Lester's Arcade Achievements", "LAACH")`.
- `defineAchievement(id, gameId, title, category, tokenUriPath)` (operator, idempotent update).
- `setMinter(address, bool)` (operator). The score registry is the only minter after deploy.
- `mintFor(player, achievementId, sessionId) onlyMinter returns (bool)`: `false` when undefined or already
  held, else mints `tokenId = uint256(keccak256(abi.encode(player, achievementId)))`, records
  `unlockedAt`, `tokenAchievement`, emits `Locked(tokenId)` (ERC-5192) and
  `AchievementUnlocked(wallet, achievementId, sessionId, tokenId)`.
- `_update` override reverts `Soulbound()` for any transfer between two non-zero addresses; mint and burn
  pass. `burn(tokenId)` by the owner; `revoke(tokenId, reason)` by the operator (emits `AchievementRevoked`).
- ERC-5192: `locked(tokenId)` is `true` for existing tokens (reverts for nonexistent);
  `supportsInterface(0xb45a3c0e)` is true.
- `tokenURI = baseTokenUri + achievement.tokenUriPath`.

### PlayerProfileRegistry

Unchanged: wallet-owned display name / avatar with normalised, unique handles.

### LestersArcadeCore

Optional immutable address book (`playerProfiles, gameRegistry, rankedEntry, scoreSubmissions,
achievements`). Excluded from the hardened deployment.

## Trust model

| Key | Holder | Power |
|-----|--------|-------|
| Deployer | Owner | Creates the contracts; must equal operator and developerWallet for the atomic testnet deploy. |
| Operator | Owner (2-step transferable per contract) | Registers games, sets fees/splits/vaults, defines achievements, sets minters/relayers/verifier, revokes tokens. |
| Trusted verifier | Verifier service (custody: owner decision) | Signs `VerifiedRun` attestations. Compromise = ability to forge scores until `setTrustedVerifier` rotates it. |
| Dev wallet | Cabinet developer | Confirms itself; receives the dev share of every entry fee. |
| Relayer (optional) | Platform backend | May submit a player's attested run on their behalf (`run.player` still credited). |

## Deployment order

1. `GameRegistry(operator)`
2. `PlayerProfileRegistry()`
3. `AchievementRegistry(operator, achievementBaseTokenUri)`
4. `ArcadeRankedEntry(gameRegistry, operator)`
5. `ScoreSubmissionRegistry(gameRegistry, rankedEntry, achievementRegistry, verifier, operator)`
6. `AchievementRegistry.setMinter(scoreSubmissionRegistry, true)`
7. `ArcadeRankedEntry.setPlatformVaults(platformVault, liquidityVault, treasuryVault)`
8. per game: `registerGame(...)`, `confirmDevWallet(gameId)`, `setPlayable(gameId, true)`

`scripts/deploy-contracts.mjs` predicts all five addresses from the deployer's pending nonce
(`getCreateAddress`), writes an unsigned manifest in dry-run mode, and in broadcast mode requires
`--broadcast`, `LITVM_DEPLOY_CONFIRM=DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441`, a signer matching the
configured deployer and an unchanged pending nonce, then verifies every address and wiring by read-back
before writing `contracts/deployment-record.hardened.json`.

## Testing

- `npm run contracts:compile` (solc-js 0.8.35, optimizer 200 runs) must produce 0 errors.
- `npm run contracts:check` pins the file set, key signals, and that legacy files are archived.
- `contracts/test/SecurityBaseline.t.sol` is a foundry suite (`forge test`) covering exact-fee entry, wrong
  amounts, session reuse, unpaid submission, bad signer, expired deadline, achievements-hash mismatch, relayer
  submission, soulbound transfer, double mint, revoke/burn. Foundry is not installed in CI; run locally.
