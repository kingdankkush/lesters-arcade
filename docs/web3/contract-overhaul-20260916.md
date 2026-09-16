# Contract overhaul 2026-09-16: native 0.1 zkLTC Ranked entry, EIP-712 settlement, soulbound achievements

Status: **compiled and gated, NOT deployed.** Branch `fable/master-list-20260916`. Nothing in this
document authorises a deployment or a transaction; see "Owner decisions" below.

## Why

Owner direction (2026-09-16):

- Ranked Mode charges **0.1 zkLTC in the native token at entry**.
- That fee funds settlement of scores / session data on chain.
- Achievements are **soulbound NFTs** bound to the wallet.
- The June 2026 contracts (ERC-20/USDC routers, `SessionLedger`, `TournamentPool`) are outdated and must be
  replaced and redeployed.

## What changed

| Area | Before (June 2026) | After (this change) |
|------|--------------------|---------------------|
| Entry fee | ERC-20 `startPaidSession(sessionId, gameId, amount)` (USDC micro-units, disabled) | `ArcadeRankedEntry.openSession(sessionId, gameId)` **payable**, `msg.value == entryFeeWei` (0.1 zkLTC) |
| Fee field | `GameRegistry.entryFeeMicroUsdc` | `GameRegistry.entryFeeWei` + `setEntryFee` / `EntryFeeUpdated` |
| Score path | `submitSession` (unverified) + `submitVerifiedSession(run, achievements, v, r, s)` with an ad-hoc digest | **only** `submitVerifiedSession(run, achievements, bytes signature)` over an **EIP-712** `VerifiedRun` (13 fields) |
| Achievements | Event-only unlock in the score registry; `AchievementRegistry.unlockFor` gated to a `SessionLedger` | **Soulbound ERC-721** (`ERC721` + ERC-5192), minted by the score registry via `mintFor` |
| Escrow / settlement | `SessionLedger` escrow + `PaymentRouter` splits | No escrow: entry fee is routed instantly by bps to devWallet + vaults |
| Legacy | in `contracts/src` | `contracts/archive/2026-06-legacy/` (read-only, never imported as verified) |

Files:

- `contracts/src/GameRegistry.sol` (edited), `ArcadeRankedEntry.sol` (new), `AchievementRegistry.sol`
  (rewrite), `ScoreSubmissionRegistry.sol` (rewrite), `LestersArcadeCore.sol` (address book only),
  `interfaces/IGameRegistry.sol`, `interfaces/IArcadeRankedEntry.sol`, `interfaces/IAchievementMinter.sol`.
- `contracts/archive/2026-06-legacy/` + README; stale artifacts removed and regenerated.
- `contracts/deploy-config.testnet.json` (three games, `entryFeeWei`, vaults, `achievementBaseTokenUri`).
- `scripts/compile-contracts.mjs`, `scripts/contract-structure-check.mjs`, `scripts/deploy-contracts.mjs`.
- `contracts/test/SecurityBaseline.t.sol` (forge), `tests/contracts-security-abi.test.mjs`,
  `tests/deploy-contracts-security.test.mjs`, `tests/contract-abi-alignment.test.mjs`.

## Exact ABI the portal is coded against

### GameRegistry

```solidity
struct Game { bytes32 gameId; string title; address devWallet; uint16 devBps; uint16 platformBps;
              uint16 liquidityBps; uint16 treasuryBps; uint256 entryFeeWei; bool devWalletConfirmed;
              bool playable; bool exists; uint256 registeredAt; }
function getGame(bytes32 gameId) external view returns (Game memory);
function registerGame(string idString, string title, address devWallet, uint16 devBps, uint16 platformBps,
                      uint16 liquidityBps, uint16 treasuryBps, uint256 entryFeeWei) external onlyOperator;
function confirmDevWallet(bytes32 gameId) external;               // msg.sender == devWallet
function setPlayable(bytes32 gameId, bool playable) external onlyOperator;
function updateFeeSplit(bytes32 gameId, uint16, uint16, uint16, uint16) external onlyOperator;
function setEntryFee(bytes32 gameId, uint256 entryFeeWei) external onlyOperator;   // EntryFeeUpdated
function registeredGameCount() external view returns (uint256);
```

### ArcadeRankedEntry

```solidity
struct PaidSession { address player; bytes32 gameId; uint256 amountWei; uint64 openedAt; bool exists; }
function openSession(bytes32 sessionId, bytes32 gameId) external payable;   // msg.value == entryFeeWei
function isPaid(bytes32 sessionId, address player, bytes32 gameId) external view returns (bool);
function getPaidSession(bytes32 sessionId) external view returns (PaidSession memory);
function paidSessions(bytes32) external view returns (address, bytes32, uint256, uint64, bool);
function entryFeeEnabled() external view returns (bool);
event RankedSessionOpened(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 amountWei);
event RevenueRouted(bytes32 indexed sessionId, uint256 devAmount, uint256 platformAmount, uint256 liquidityAmount, uint256 treasuryAmount);
// operator: setPlatformVaults(address,address,address), setEntryFeeEnabled(bool), transferOperator/acceptOperator
```

### ScoreSubmissionRegistry

```solidity
// EIP-712 domain: name "Lester's Arcade Ranked Settlement", version "2", chainId 4441, verifyingContract
struct VerifiedRun { bytes32 sessionId; bytes32 gameId; address player; uint256 score; uint64 kills;
                     uint64 maxCombo; uint64 survivalSeconds; bytes32 bossId; bytes32 envelopeHash;
                     bytes32 runtimeId; bytes32 seasonId; uint64 deadline; bytes32 achievementsHash; }
bytes32 constant VERIFIED_RUN_TYPEHASH = keccak256(
  "VerifiedRun(bytes32 sessionId,bytes32 gameId,address player,uint256 score,uint64 kills,uint64 maxCombo,uint64 survivalSeconds,bytes32 bossId,bytes32 envelopeHash,bytes32 runtimeId,bytes32 seasonId,uint64 deadline,bytes32 achievementsHash)");
// = 0x0f060ef5500951c69e626a55e347e72592e4c1edb70b5bfd2c1767cc95876e11
function attestationDigest(VerifiedRun calldata run) external view returns (bytes32);
function achievementsHashOf(bytes32[] calldata achievements) external pure returns (bytes32); // keccak256(abi.encodePacked(achievements))
function submitVerifiedSession(VerifiedRun calldata run, bytes32[] calldata achievements, bytes calldata signature) external;

struct ScoreRecord { bytes32 sessionId; address player; bytes32 gameId; uint256 score; uint64 kills;
                     uint64 maxCombo; uint64 survivalSeconds; bytes32 bossId; bytes32 runtimeId;
                     bytes32 seasonId; uint64 submittedAt; bool verified; bool exists; }
function getSession(bytes32) external view returns (ScoreRecord memory);
function getSessionAchievements(bytes32) external view returns (bytes32[] memory);
function playerSessionCount(address) external view returns (uint256);
function getPlayerSessions(address, uint256 offset, uint256 limit) external view returns (ScoreRecord[] memory);
function totalSessions() external view returns (uint256);
function getRecentSessions(uint256 offset, uint256 limit) external view returns (ScoreRecord[] memory);
function bestScore(bytes32 gameId, address player) external view returns (uint256);
function bestSeasonScore(bytes32 gameId, bytes32 seasonId, address player) external view returns (uint256);
function sessionEnvelopeHash(bytes32) external view returns (bytes32);
function trustedVerifier() / rankedEntry() / achievementRegistry() / gameRegistry() external view returns (address);
function relayers(address) external view returns (bool);
event ScoreSubmitted(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 score,
                     uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 runtimeId, bytes32 seasonId);
event SessionSubmitted(bytes32 indexed sessionId, bool verified);
// operator: setTrustedVerifier, setRelayer(address,bool), setRankedEntry, setAchievementRegistry, transferOperator/acceptOperator
```

Revert strings the portal should map: `NOT_PLAYER_OR_RELAYER`, `ATTESTATION_EXPIRED`, `EMPTY_ENVELOPE_HASH`,
`EMPTY_SESSION_ID`, `SESSION_EXISTS`, `TOO_MANY_ACHIEVEMENTS`, `ACHIEVEMENTS_HASH_MISMATCH`,
`GAME_NOT_PLAYABLE`, `RANKED_ENTRY_UNSET`, `SESSION_NOT_PAID`, `SCORE_OUT_OF_BOUNDS`, `KILLS_OUT_OF_BOUNDS`,
`COMBO_OUT_OF_BOUNDS`, `SURVIVAL_OUT_OF_BOUNDS`, `INVALID_ATTESTATION`; and from entry: `WRONG_ENTRY_FEE`,
`ENTRY_FEE_DISABLED`, `SESSION_EXISTS`, `GAME_NOT_REGISTERED`, `GAME_NOT_PLAYABLE`, `DEV_WALLET_UNCONFIRMED`,
`PAYOUT_FAILED`.

### AchievementRegistry

```solidity
struct Achievement { bytes32 id; bytes32 gameId; string title; string category; string tokenUriPath; bool exists; }
function mintFor(address player, bytes32 achievementId, bytes32 sessionId) external onlyMinter returns (bool minted);
function hasUnlocked(address wallet, bytes32 id) external view returns (bool);
function tokenIdFor(address wallet, bytes32 id) external pure returns (uint256);   // uint256(keccak256(abi.encode(wallet, id)))
function unlockedAt(address, bytes32) external view returns (uint256);
function tokenAchievement(uint256 tokenId) external view returns (bytes32);
function locked(uint256 tokenId) external view returns (bool);                     // ERC-5192; reverts if nonexistent
function supportsInterface(bytes4) external view returns (bool);                   // 0xb45a3c0e => true
function tokenURI(uint256) external view returns (string memory);                  // baseTokenUri + tokenUriPath
function achievementIds() external view returns (bytes32[] memory); function achievementCount() external view returns (uint256);
function getAchievement(bytes32) external view returns (Achievement memory);
function burn(uint256 tokenId) external;                                           // token owner
function revoke(uint256 tokenId, string reason) external onlyOperator;             // AchievementRevoked
error Soulbound();   // any transferFrom / safeTransferFrom between two wallets
event AchievementUnlocked(address indexed wallet, bytes32 indexed achievementId, bytes32 indexed sessionId, uint256 tokenId);
event Locked(uint256 tokenId);
// operator: defineAchievement(id, gameId, title, category, tokenUriPath), setMinter(address,bool), setBaseTokenUri(string)
```

## How the portal must call it

1. **Gate**: `GameRegistry.getGame(ethers.id(slug))` → require `exists && playable && devWalletConfirmed`;
   read `entryFeeWei` (never hard-code 0.1). Check `ArcadeRankedEntry.entryFeeEnabled()`.
2. **Entry**: choose a fresh 32-byte `sessionId` (e.g. `keccak256(wallet, slug, nonce, timestamp)`), then
   `ArcadeRankedEntry.openSession(sessionId, gameId, { value: entryFeeWei })`. Wait for the receipt and
   confirm `isPaid(sessionId, wallet, gameId)`. The fee is gone from the wallet at this point (split to dev +
   vaults); there is no refund path.
3. **Play** off chain; capture the canonical envelope and its hash.
4. **Attest**: the verifier service builds `VerifiedRun` with `player = wallet`, `deadline = now + N minutes`,
   `achievementsHash = keccak256(abi.encodePacked(achievements))`
   (`ethers.solidityPackedKeccak256(['bytes32[]'], [achievements])`) and signs with
   `signer.signTypedData(domain, { VerifiedRun: [...] }, run)` where
   `domain = { name: "Lester's Arcade Ranked Settlement", version: "2", chainId: 4441, verifyingContract }`.
   The digest equals `attestationDigest(run)` on chain (verified in this change with ethers'
   `TypedDataEncoder`).
5. **Settle**: from the player's wallet (or an allowed relayer)
   `ScoreSubmissionRegistry.submitVerifiedSession(run, achievements, signature)`. Then read `getSession`,
   `bestScore`, and for each achievement `AchievementRegistry.hasUnlocked` / `tokenIdFor` to show the
   soulbound token.
6. **Achievement ids** must be defined on chain (`defineAchievement`) before they can mint; undefined ids are
   silently skipped by `mintFor` (the score still settles).

## Deployment order (dry-run manifest → owner approval → broadcast)

```
nonce+0 GameRegistry(operator)
nonce+1 PlayerProfileRegistry()
nonce+2 AchievementRegistry(operator, "https://lestersarcade.io/achievements/")
nonce+3 ArcadeRankedEntry(gameRegistry, operator)
nonce+4 ScoreSubmissionRegistry(gameRegistry, rankedEntry, achievementRegistry, verifier, operator)
nonce+5 AchievementRegistry.setMinter(scoreSubmissionRegistry, true)
nonce+6 ArcadeRankedEntry.setPlatformVaults(platformVault, liquidityVault, treasuryVault)
nonce+7.. for lester-blaster, chikun, stacked: registerGame(...) / confirmDevWallet / setPlayable(true)
```

`node scripts/deploy-contracts.mjs` (dry run) writes `docs/web3/hardened-ranked-deployment-manifest.json`
with predicted addresses, init-code hashes and calldata hashes. Broadcast additionally requires
`--broadcast`, `LITVM_DEPLOY_CONFIRM=DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441`, `DEPLOYER_PRIVATE_KEY` matching
`config.deployer`, the pending nonce unchanged since the manifest, and deployer == operator == developerWallet
(so `confirmDevWallet` can be sent atomically). Read-back verifies every address and wiring before
`contracts/deployment-record.hardened.json` is written.

## Owner decisions required before deployment

1. **Deployer key**: which wallet deploys (currently `0x24501ad9…20d4` in config) and who holds it.
2. **Verifier key custody**: the `trustedVerifier` address signs every score. It must live in the verifier
   service's secret store (not the browser). Decide the custody/rotation runbook
   (`ScoreSubmissionRegistry.setTrustedVerifier`).
3. **Vault addresses**: `platformVault`, `liquidityVault`, `treasuryVault` are all the operator address for
   testnet. Confirm, or provide dedicated addresses (a zero vault sends that share to the dev wallet).
4. **Fee approval**: 0.1 zkLTC (`100000000000000000` wei) per ranked session for all three games, split
   75 % dev / 25 % platform. Confirm the amount and whether `chikun` and `stacked` should be playable on
   day one.
5. **Relayer**: whether the platform backend should be allow-listed (`setRelayer`) to submit runs on behalf
   of players (players then pay no gas for settlement; entry fee still comes from their wallet).
6. **Achievement catalogue**: the list of `(id, gameId, title, category, tokenUriPath)` to define after
   deploy, and hosting of `https://lestersarcade.io/achievements/<path>` metadata.
7. **Testnet vs production**: this config targets chainId 4441 only.

## Verification performed in this change

- `node scripts/compile-contracts.mjs`: 0 errors (only OpenZeppelin `error`-identifier warnings). Runtime
  sizes: AchievementRegistry 8 774 B, ArcadeRankedEntry 4 552 B, GameRegistry 5 462 B,
  ScoreSubmissionRegistry 11 477 B, PlayerProfileRegistry 4 482 B, LestersArcadeCore 599 B.
- `npm run contracts:check`: pass.
- `node --test tests/contracts-security-abi.test.mjs tests/deploy-contracts-security.test.mjs tests/contract-abi-alignment.test.mjs`: 16/16 pass.
- EIP-712 type string equals `ethers.TypedDataEncoder.encodeType('VerifiedRun')` and its keccak is present
  in the compiled runtime bytecode.
- `contracts/test/SecurityBaseline.t.sol` rewritten for the new set; **not executed** (no foundry on the
  build machine).
