# Contract overhaul 2026-09-16: native 0.1 zkLTC Ranked entry, EIP-712 settlement, soulbound achievements

Status: **compiled and gated, NOT deployed.** Branch `fable/master-list-20260916`. Nothing in this
document authorises a deployment or a transaction; see "Owner decisions" below.

**Epoch policy.** Everything this document deploys is a **testnet epoch** (LitVM LiteForge, chainId 4441).
It runs until mainnet. At mainnet every contract, score, session, paid entry and soulbound achievement from
this epoch is wiped: mainnet is a **fresh deployment set** (new addresses, empty registries, re-defined
achievements) and nothing is migrated or imported from testnet. Players, the portal and the relayer must
treat testnet state as disposable. The dry-run manifest and the deployment record carry `epoch: "testnet"`.

## Owner decisions applied (2026-09-16, second pass)

1. **Fee = flat fee + settlement gas reserve.** `GameRegistry.Game.entryFeeWei` stays the flat fee
   (0.1 zkLTC). `ArcadeRankedEntry` adds an operator-set `settlementGasReserveWei` (default 0) and a
   `relayerVault`. `openSession` now requires **exactly** `entryFeeWei + settlementGasReserveWei`; the
   reserve is forwarded whole to `relayerVault` (it funds the relayer that settles the score for the
   player) and the flat part is split by the game's bps as before. `quoteEntry(gameId)` returns the two
   parts and the total the portal must send.
2. **Split: 15 % treasury, 85 % developer, every game.** All three games are registered with
   `devBps 8500 / platformBps 0 / liquidityBps 0 / treasuryBps 1500`. `developerWallet` and
   `treasuryVault` are the owner wallet `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26` (the owner is the
   developer of all three live games; the Chikun creator wallet is not yet supplied). `platformVault` and
   `liquidityVault` are also the owner wallet (unused 0-bps shares). `GameRegistry` still enforces that the
   four shares total 10 000 bps.
3. **One achievement collection per game.** Three `AchievementRegistry` deployments, each with its own
   ERC-721 name/symbol (constructor args) and `baseTokenUri`:
   `Hard Money Heroes Achievements / HMHACH / https://lestersarcade.io/achievements/lester-blaster/`,
   `Chikun's Escape Achievements / CHKACH / https://lestersarcade.io/achievements/chikun/`,
   `STACKED Achievements / STKACH / https://lestersarcade.io/achievements/stacked/`.
   `ScoreSubmissionRegistry` replaces the single `achievementRegistry` with
   `achievementRegistryByGame(bytes32 gameId)` + `setAchievementRegistry(bytes32 gameId, address)`;
   `submitVerifiedSession` mints through the registry bound to `run.gameId` (skipped when unset). Each
   registry's minter is the score registry.
4. **Relayer-settled scores.** `submitVerifiedSession` stays callable by the player **or** an allowed
   relayer (`relayers(address)` public view, `setRelayer(address,bool)`). The relayer path needs nothing
   but the attestation: the function is non-payable and takes no fee. `ScoreSubmitted` (indexed
   sessionId / player / gameId) is the indexing event; entry emits `RankedSessionOpened`,
   `SettlementReserveForwarded` and `RevenueRouted`.
5. **Epoch:** see the policy above.

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
| Entry fee | ERC-20 `startPaidSession(sessionId, gameId, amount)` (USDC micro-units, disabled) | `ArcadeRankedEntry.openSession(sessionId, gameId)` **payable**, `msg.value == entryFeeWei + settlementGasReserveWei` exactly (0.1 zkLTC flat + operator-set reserve, read via `quoteEntry`) |
| Fee split | 75 % dev / 25 % platform | 85 % developer / 15 % treasury for every game; reserve part goes whole to `relayerVault` |
| Achievement collections | one registry for the arcade | one soulbound ERC-721 per game (`achievementRegistryByGame[gameId]`) |
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
// msg.value MUST equal quoteEntry(gameId).totalWei == game.entryFeeWei + settlementGasReserveWei (exact).
function openSession(bytes32 sessionId, bytes32 gameId) external payable;
function quoteEntry(bytes32 gameId) external view
    returns (uint256 entryFeeWei, uint256 settlementGasReserveWei, uint256 totalWei); // (0,0,0) when entryFeeEnabled == false; reverts GAME_NOT_REGISTERED
function settlementGasReserveWei() external view returns (uint256);   // operator-set, default 0
function relayerVault() external view returns (address);              // receives the reserve
function isPaid(bytes32 sessionId, address player, bytes32 gameId) external view returns (bool);
function getPaidSession(bytes32 sessionId) external view returns (PaidSession memory);   // amountWei = total paid (fee + reserve)
function paidSessions(bytes32) external view returns (address, bytes32, uint256, uint64, bool);
function entryFeeEnabled() external view returns (bool);
event RankedSessionOpened(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 amountWei); // amountWei = total
event SettlementReserveForwarded(bytes32 indexed sessionId, address indexed relayerVault, uint256 amountWei);
event RevenueRouted(bytes32 indexed sessionId, uint256 devAmount, uint256 platformAmount, uint256 liquidityAmount, uint256 treasuryAmount); // flat part only
event RelayerVaultUpdated(address indexed relayerVault);
event SettlementGasReserveUpdated(uint256 settlementGasReserveWei);
// operator: setPlatformVaults(address,address,address), setRelayerVault(address), setSettlementGasReserve(uint256),
//           setEntryFeeEnabled(bool), transferOperator/acceptOperator
// setSettlementGasReserve(>0) requires relayerVault != 0 (RELAYER_VAULT_UNSET); setRelayerVault(0) requires reserve == 0 (RELAYER_VAULT_REQUIRED)
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
function trustedVerifier() / rankedEntry() / gameRegistry() external view returns (address);
function achievementRegistryByGame(bytes32 gameId) external view returns (address);   // one soulbound collection per game; 0 = no minting
function relayers(address) external view returns (bool);                              // allowed settlement relayers
// constructor(address gameRegistry, address rankedEntry, address trustedVerifier, address operator)
event ScoreSubmitted(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 score,
                     uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 runtimeId, bytes32 seasonId);
event SessionSubmitted(bytes32 indexed sessionId, bool verified);
// operator: setTrustedVerifier, setRelayer(address,bool), setRankedEntry, setAchievementRegistry(bytes32 gameId, address), transferOperator/acceptOperator
event AchievementRegistryUpdated(bytes32 indexed gameId, address indexed achievementRegistry);
```

`submitVerifiedSession` is **non-payable**: whether the player or a relayer sends it, the only input is the
attested run + achievements + signature. Relayer gas is funded off chain from the settlement reserve that
`openSession` forwarded to `relayerVault`.

Revert strings the portal should map: `NOT_PLAYER_OR_RELAYER`, `ATTESTATION_EXPIRED`, `EMPTY_ENVELOPE_HASH`,
`EMPTY_SESSION_ID`, `SESSION_EXISTS`, `TOO_MANY_ACHIEVEMENTS`, `ACHIEVEMENTS_HASH_MISMATCH`,
`GAME_NOT_PLAYABLE`, `RANKED_ENTRY_UNSET`, `SESSION_NOT_PAID`, `SCORE_OUT_OF_BOUNDS`, `KILLS_OUT_OF_BOUNDS`,
`COMBO_OUT_OF_BOUNDS`, `SURVIVAL_OUT_OF_BOUNDS`, `INVALID_ATTESTATION`, `EMPTY_GAME_ID`, `EMPTY_PLAYER`; and from
entry: `WRONG_ENTRY_FEE` (msg.value != fee + reserve), `ENTRY_FEE_DISABLED`, `SESSION_EXISTS`,
`GAME_NOT_REGISTERED`, `GAME_NOT_PLAYABLE`, `DEV_WALLET_UNCONFIRMED`, `RELAYER_VAULT_UNSET`,
`RELAYER_VAULT_REQUIRED`, `PAYOUT_FAILED`.

### AchievementRegistry (one deployment per game)

```solidity
constructor(address operator, string name, string symbol, string baseTokenUri);   // e.g. ("Hard Money Heroes Achievements", "HMHACH", "https://lestersarcade.io/achievements/lester-blaster/")
function name() / symbol() / baseTokenUri() external view returns (string memory);
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

1. **Gate**: `GameRegistry.getGame(ethers.id(slug))` → require `exists && playable && devWalletConfirmed`.
   Then `ArcadeRankedEntry.quoteEntry(gameId)` → `{ entryFeeWei, settlementGasReserveWei, totalWei }`
   (never hard-code 0.1 or the reserve; `totalWei` is 0 when `entryFeeEnabled()` is false). Show the player
   both parts: "0.1 zkLTC entry + 0.0001 zkLTC settlement reserve".
2. **Entry**: choose a fresh 32-byte `sessionId` (e.g. `keccak256(wallet, slug, nonce, timestamp)`), then
   `ArcadeRankedEntry.openSession(sessionId, gameId, { value: totalWei })` with the quoted total, re-quoted
   immediately before sending (the operator can retune the reserve). Wait for the receipt and confirm
   `isPaid(sessionId, wallet, gameId)`. The money is gone from the wallet at this point (reserve to the
   relayer vault, flat fee split 85/15 to developer/treasury); there is no refund path.
3. **Play** off chain; capture the canonical envelope and its hash.
4. **Attest**: the verifier service builds `VerifiedRun` with `player = wallet`, `deadline = now + N minutes`,
   `achievementsHash = keccak256(abi.encodePacked(achievements))`
   (`ethers.solidityPackedKeccak256(['bytes32[]'], [achievements])`) and signs with
   `signer.signTypedData(domain, { VerifiedRun: [...] }, run)` where
   `domain = { name: "Lester's Arcade Ranked Settlement", version: "2", chainId: 4441, verifyingContract }`.
   The digest equals `attestationDigest(run)` on chain (verified in this change with ethers'
   `TypedDataEncoder`).
5. **Settle**: the relayer service (allow-listed via `setRelayer`, funded from `relayerVault`) sends
   `ScoreSubmissionRegistry.submitVerifiedSession(run, achievements, signature)` with **no value**; the
   player's wallet may also send it directly. Then read `getSession`, `bestScore`, and for each achievement
   `AchievementRegistry.hasUnlocked` / `tokenIdFor` on the **game's own** registry
   (`ScoreSubmissionRegistry.achievementRegistryByGame(gameId)`, or the per-game address from the
   deployment record) to show the soulbound token. The portal's single `achievementRegistry` address must
   become a per-game map.
6. **Achievement ids** must be defined on chain (`defineAchievement`) in the game's registry before they can
   mint; undefined ids are silently skipped by `mintFor` (the score still settles), and a game with no
   registry bound records the ids in the session without minting.

## Deployment order (dry-run manifest → owner approval → broadcast)

```
nonce+0  GameRegistry(operator)
nonce+1  PlayerProfileRegistry()
nonce+2  ArcadeRankedEntry(gameRegistry, operator)
nonce+3  ScoreSubmissionRegistry(gameRegistry, rankedEntry, verifier, operator)
nonce+4  AchievementRegistry(operator, "Hard Money Heroes Achievements", "HMHACH", ".../achievements/lester-blaster/")
nonce+5  AchievementRegistry(operator, "Chikun's Escape Achievements",   "CHKACH", ".../achievements/chikun/")
nonce+6  AchievementRegistry(operator, "STACKED Achievements",           "STKACH", ".../achievements/stacked/")
nonce+7  ArcadeRankedEntry.setPlatformVaults(platformVault, liquidityVault, treasuryVault)
nonce+8  ArcadeRankedEntry.setRelayerVault(relayerVault)                 // config.relayerVault, default relayer -> operator
nonce+9  ArcadeRankedEntry.setSettlementGasReserve(settlementGasReserveWei) // config: 0.0001 zkLTC (100000000000000 wei)
nonce+10 ScoreSubmissionRegistry.setRelayer(relayer, true)               // config.relayer, default operator
nonce+11.. per game (lester-blaster, chikun, stacked):
         AchievementRegistry[slug].setMinter(scoreSubmissionRegistry, true)
         ScoreSubmissionRegistry.setAchievementRegistry(gameId, achievementRegistry[slug])
         GameRegistry.registerGame(slug, title, developerWallet, 8500, 0, 0, 1500, entryFeeWei)
activation, per game:
         GameRegistry.confirmDevWallet(gameId)   // signed by developerWallet
         GameRegistry.setPlayable(gameId, true)  // signed by operator
```

`node scripts/deploy-contracts.mjs` (dry run) writes `docs/web3/hardened-ranked-deployment-manifest.json`
(schemaVersion 3, `epoch: "testnet"`) with predicted addresses for all seven contracts, init-code hashes,
calldata hashes for every post-deploy call, per-game `totalEntryWei = entryFeeWei + settlementGasReserveWei`,
and an `activation` block. Broadcast additionally requires `--broadcast`,
`LITVM_DEPLOY_CONFIRM=DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441`, `DEPLOYER_PRIVATE_KEY` matching
`config.deployer`, the pending nonce unchanged since the manifest, and deployer == operator (all wiring is
operator-only). Activation (`confirmDevWallet` + `setPlayable`) is sent atomically **only when the deployer is
also `developerWallet`**; otherwise the games are registered but left non-playable and the manifest's
`activation.transactions` lists the two calls the owner wallet / operator must send (the record then says
`activation: "deferred-dev-wallet-confirmation"`). Read-back verifies every address, name/symbol/baseTokenUri
of each collection, minter + per-game routing, vaults, relayer vault, reserve, relayer allow-list, the 85/15
split and `quoteEntry` before `contracts/deployment-record.hardened.json` (schemaVersion 4, per-game
`addresses.achievementRegistries`) is written.

## Owner decisions required before deployment

1. **Deployer key**: decided 2026-09-22: the operator service key `0x6Ac08Bed…6bfF` deploys and
   administers; its private key lives only in the vault and is read inside the deploy command.
2. **Verifier key custody**: the `trustedVerifier` address signs every score. It must live in the verifier
   service's secret store (not the browser). Decide the custody/rotation runbook
   (`ScoreSubmissionRegistry.setTrustedVerifier`).
3. **Vault addresses**: decided 2026-09-16: `treasuryVault` (15 %) = owner wallet; `platformVault` /
   `liquidityVault` (0 %) = owner wallet as placeholders. `relayerVault` (receives the settlement reserve)
   defaults to the relayer/operator key; supply a dedicated funding wallet if the relayer runs on its own
   key.
4. **Fee approval**: decided 2026-09-16: 0.1 zkLTC flat (`100000000000000000` wei) split 85 % developer /
   15 % treasury for all three games, **plus** `settlementGasReserveWei` = **0.0001 zkLTC**
   (`100000000000000` wei, decided 2026-09-22 from measured LiteForge gas; the deploy script's 0.02 zkLTC
   default is only a fallback when the config omits it). Players pay `quoteEntry(gameId).totalWei`
   (0.1001 zkLTC). Still open: whether `chikun` and
   `stacked` should be playable on day one, and the Chikun creator wallet (currently the owner wallet).
5. **Relayer**: decided 2026-09-16: scores are relayer-settled. `config.relayer` (default operator) is
   allow-listed at deploy; the relayer service's key must hold zkLTC (topped up from `relayerVault`) and
   the verifier's attestation is the only input it needs.
6. **Achievement catalogue**: the list of `(id, gameId, title, category, tokenUriPath)` to define after
   deploy, and hosting of `https://lestersarcade.io/achievements/<path>` metadata.
7. **Testnet vs production**: this config targets chainId 4441 only, and is a **testnet epoch**: mainnet
   is a fresh deployment set (see the epoch policy at the top). Do not plan any migration of testnet
   scores, sessions or achievements.
8. **Chikun creator wallet**: when supplied, `GameRegistry.updateFeeSplit` is not needed (split stays
   85/15); change the dev wallet by re-registering the game on the next epoch or by an explicit operator
   decision, since `devWallet` is immutable per registration.

## Verification performed in this change

- `node scripts/compile-contracts.mjs`: 0 errors (only OpenZeppelin `error`-identifier warnings). Runtime
  sizes after the owner-decision pass: AchievementRegistry 8 774 B, ArcadeRankedEntry 5 645 B,
  GameRegistry 5 462 B, ScoreSubmissionRegistry 11 589 B, PlayerProfileRegistry 4 482 B,
  LestersArcadeCore 599 B.
- `npm run contracts:check`: pass (new signals: `settlementGasReserveWei`, `relayerVault`, `quoteEntry`,
  `achievementRegistryByGame`, per-game ERC-721 name/symbol; retired: single `achievementRegistry`).
- `node --test tests/contracts-security-abi.test.mjs tests/deploy-contracts-security.test.mjs tests/contract-abi-alignment.test.mjs tests/score-registry-abi.test.mjs`: pass (see the change report for the count).
- EIP-712 type string equals `ethers.TypedDataEncoder.encodeType('VerifiedRun')` and its keccak is present
  in the compiled runtime bytecode.
- `contracts/test/SecurityBaseline.t.sol` (Foundry is not installed on the build machine) is ported case for
  case to Hardhat: `tests/contracts-security-baseline.test.mjs` runs all 34 cases, same names minus the
  `test` prefix, on the in-process chain inside `npm test` and the release gate (2026-09-23, below).

## Local chain and the security baseline (Hardhat, 2026-09-23)

- `hardhat.config.js` configures only Hardhat 3's in-process EDR network, with `chainId: 4441` (contract
  A21), so EIP-712 domains, session keys and `LITVM_LITEFORGE_NETWORK` work unchanged. Nothing is compiled
  and nothing is downloaded: tests deploy the committed `contracts/artifacts/*.json`. A test boots the
  network with every socket, DNS lookup, HTTP request and child process blocked and records none.
- `scripts/lib/local-chain.mjs`: `startLocalChain()` (ethers provider, named fixture wallets `operator`,
  `verifier`, `relayer`, `developer`, `platformVault`, `player1`, `player2`, `attacker` from the public
  Hardhat test mnemonic, `setBalance`, `impersonate`, `increaseTime`, `mine`, `snapshot`, `revert`, `close`),
  `deployLocalSuite()` (same order and wiring calls as `scripts/deploy-contracts.mjs`, parity-tested; the
  collections deploy empty) and `activateLocalGames()`. `serveJsonRpc()` exposes the chain over HTTP for
  CLI scripts that take `--rpc`.
- `npm run contracts:test:hardhat` runs the baseline port and the harness tests.

## Contract addresses: the generated module

Addresses are **never hand-edited**. `apps/portal/src/generated/litvm-addresses.mjs` exports
`LITVM_DEPLOYMENT` (contract A19, §8.1) and is written only by `npm run contracts:addresses`
(`scripts/generate-litvm-addresses.mjs`):

- **Before the broadcast** (committed now): `status: 'predicted'`, the CREATE addresses of the deployer
  `0x6Ac08Bed…6bfF` at nonces 0..6 in deploy order, `startBlock: null`. They hold only while the operator's
  nonce stays 0, so never use the operator key before step 3.
- **After the broadcast**: `scripts/deploy-contracts.mjs --broadcast` writes
  `contracts/deployment-record.hardened.json` (now with `blocks`, `startBlock` and `deployTxHashes`) and
  immediately regenerates the module with `status: 'deployed'`. Commit both files together.
  `npm run contracts:addresses` does the same from the record at any time; `-- --predicted` forces the
  predicted module and `-- --check` only compares.

`apps/portal/src/settlement.mjs` builds `LITVM_CONTRACT_ADDRESSES` from it with exactly the keys
`gameRegistry`, `playerProfileRegistry`, `arcadeRankedEntry`, `scoreSubmissionRegistry` and
`achievementRegistries` (`lester-blaster`, `chikun`, `stacked`). The June keys are gone;
`contracts/deployment-record.json` stays as the archive. The server reads the same module
(`server/deployment.mjs`), and `RANKED_SCORE_REGISTRY_ADDRESS` must equal it. A test pins the §9.1
invariant: `SETTLEMENT_LIVE` implies `HOSTED_PROFILE_SYNC` and a `deployed` module. Portal chain reads
(`litvm-chain-client.mjs`) always go over the public LiteForge RPC, never the wallet's provider.

## Keys and secrets

Keys live only in the vault file (`C:/Users/just_/lesters-arcade-vault/keys/…`) and in Vercel. Every tool
reads them **inside the command, without echo**, through `scripts/lib/key-source.mjs`:
`--key-env <NAME>` (an environment variable you set for that one command), or
`--key-file <vault path> --key-field <field>` (one field of a JSON file; a field holding
`{ address, privateKey }` uses `privateKey`). Errors name the flag, variable or field, never the value or
the file contents; a key pasted where a variable NAME, path or field belongs is refused without being
repeated. No tool prints a key, and nobody pastes one into a prompt, a commit or a log.

Every chain tool (`operator-actions.mjs`, `define-nft-achievements.mjs`) asks the RPC node for its own
`eth_chainId` before it reads or sends anything and stops (exit 2) unless it is 4441; `status` prints the
chain id the node reported. `--deployment <module.mjs>` is for dry runs and the local chain: a broadcast
accepts it only with a loopback `--rpc`, and `vercel-secrets.mjs --apply` never accepts it, so LiteForge
and Vercel always get the committed `LITVM_DEPLOYMENT`.

## Runbook: deploy the hardened set and enable settlement (owner key holder)

This follows guide §7 as amended by contract §13; ⚠ steps need the owner's approval in the moment. The
authoring sessions ran none of it: every command below was tested only against the in-process chain,
a fake Vercel CLI and a local HTTP server.

0. **Preconditions.** Owner checkpoint O1 is done; `npx vercel teams ls` still shows the Pro plan; the
   rehearsal's step-7 checklist exists.
1. **Config is final.** `contracts/deploy-config.testnet.json` names the operator service key
   `0x6Ac08Bed727A6951D755F0674f096E6A8AC06bfF` as deployer and operator, the verifier
   `0x4d637a6C…20C7`, the relayer and relayer vault `0x494aF36e…EAf6`, the owner wallet
   `0x07cec6Fc…8B26` as developer and treasury, and a settlement reserve of **0.0001 zkLTC**
   (`"100000000000000"` wei, sized from measured LiteForge gas: 0.01-0.02 gwei, about 5M gas per
   settlement). Players pay `quoteEntry(gameId).totalWei` = **0.1001 zkLTC**. Retune later without a
   redeploy: `node scripts/operator-actions.mjs reserve <wei>` (dry run first).
2. **Read the chain, then dry-run the deploy.** `node scripts/operator-actions.mjs status` (read-only:
   operator nonce, which must still be 0, balances, contract state), then `node scripts/deploy-contracts.mjs`
   (writes `docs/web3/hardened-ranked-deployment-manifest.json` with the seven predicted addresses; they must
   equal the committed address module).
3. ⚠ **Broadcast.** First check the key without starting anything:
   `node scripts/deploy-contracts-with-key.mjs --key-file <vault keys.json> --key-field operator`
   (it confirms the vault field holds the configured deployer's key). Then:
   `node scripts/deploy-contracts-with-key.mjs --key-file <vault keys.json> --key-field operator --broadcast --confirm DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441`.
   The launcher reads the key inside its own process and starts `node scripts/deploy-contracts.mjs --broadcast`
   with `DEPLOYER_PRIVATE_KEY` and `LITVM_DEPLOY_CONFIRM` set in that child's environment only: the key is
   never on a command line, in the shell's environment or in any output, and nothing is left set when the
   deploy exits. Never export `DEPLOYER_PRIVATE_KEY` by hand. Commit
   `contracts/deployment-record.hardened.json` and the regenerated
   `apps/portal/src/generated/litvm-addresses.mjs` (`status: 'deployed'`) together.
4. ⚠ **Owner confirms the developer wallet**, one transaction per game, on the owner page (next section).
5. ⚠ **Operator activates the games:**
   `node scripts/operator-actions.mjs activate --key-file <vault keys.json> --key-field operator --broadcast --confirm ACTIVATE_GAMES_4441`
   (dry run first without `--broadcast`; games whose developer wallet is not confirmed are skipped).
6. ⚠ **Vercel production secrets**: `node scripts/vercel-secrets.mjs --key-file <vault keys.json>
   --cron-secret-out C:/Users/just_/lesters-arcade-vault/keys/cron-secret.txt --rotate-session-secret`
   is the dry run (names only); add `--apply --confirm SET_PRODUCTION_SECRETS` to write. It refuses to run
   while any legacy name exists in any environment, pipes every value to `vercel env add` on stdin, writes
   the new `CRON_SECRET` to the new vault file, rotates `SESSION_SECRET`, and re-lists production. The
   listings use `vercel env ls <environment> --format json` (Vercel CLI 59.15 or newer); a listing it cannot
   read stops the run before anything is written. See the environment table below.
7. **Flip the flags** following the rehearsal's step-7 checklist (`HOSTED_PROFILE_SYNC` and
   `SETTLEMENT_LIVE` together, `node scripts/build-portal-pages.mjs`, the pinned tests). The §9.1 invariant
   test fails the build if the module is not `deployed`.
8. ⚠ **Release 1.8.0** (`npm run vercel:build`, deploy, promote). **8b.** Run the production migration and
   the first live Neon call:
   `node scripts/live-cron.mjs --site https://lestersarcade.io --path /api/cron/index-chain --secret-file C:/Users/just_/lesters-arcade-vault/keys/cron-secret.txt`,
   then the same with `--path /api/cron/settle-retry` (expect `processed=0`). It prints only the status,
   `ok`, `schemaVersion` and counts.
9. ⚠ **Live end-to-end** per contract §13 step 9, then **10** the live smokes, README and release receipt.
10. **Mainnet.** Do not migrate. Produce a new config for the mainnet chain, redeploy the whole set,
    re-define achievements and regenerate the address module.

## Owner page: confirm the developer wallet (runbook step 4)

`apps/portal/owner/confirm-dev-wallet.html` (noindex, module script only, inline styles, portal CSP-safe)
sends `GameRegistry.confirmDevWallet(gameId32)` (selector `0x33cf3157`) from the owner wallet
`0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26` for Hard Money Heroes, Chikun's Escape and STACKED.

**Where to open it.** Production still serves 1.7.0 at step 4, which has no owner page. From the step-3
commit, serve the portal locally and open the page in the browser that has MetaMask or Rabby:

```
python -m http.server 8791 --directory apps/portal
# then open http://127.0.0.1:8791/owner/confirm-dev-wallet.html
```

What it does: asks the wallet for the account; explains, then switches to (or adds) LiteForge, chain 4441;
refuses any account but the owner wallet; checks **on-chain facts over the public RPC**, not just the module
status (contract code at the GameRegistry address, every game registered with the owner as developer);
skips games already confirmed; sends one transaction per click with its explorer link; and ends with the
hand-off to step 5. Before the broadcast it shows "The Ranked contracts are not deployed yet" and sends
nothing. It never asks for a seed phrase or a key.

## Operator actions and emergency stops

`node scripts/operator-actions.mjs <action>` is a dry run unless `--broadcast --confirm <PHRASE>` and the
operator key are given; the address source is `LITVM_DEPLOYMENT`, which must be `deployed` to broadcast.
`status` (read-only), `activate` (`ACTIVATE_GAMES_4441`), `pause-games` (`PAUSE_GAMES_4441`),
`fees-on` / `fees-off` (`FEES_ON_4441` / `FEES_OFF_4441`), `reserve <wei>` (`SET_RESERVE_4441`),
`relayer-off` (`RELAYER_OFF_4441`), `rotate-verifier <address>` (`ROTATE_VERIFIER_4441`).

Emergency stops (contract §13, A27), in order of reach:

1. **Pause Ranked:** add `SETTLEMENT_PAUSED=true` to the production environment and redeploy **the current
   1.8.0 release**. `/api/ranked/seed`, `/api/settle` and the settle-retry cron answer
   `503 settlement-paused`; new entries stop at the modal before payment and queued rows wait.
2. **Stop on chain:**
   `node scripts/operator-actions.mjs pause-games --key-file <vault keys.json> --key-field operator --broadcast --confirm PAUSE_GAMES_4441`
   (`setPlayable(gameId, false)` for each game; blocks `openSession` and `submitVerifiedSession`).
3. **Leaked verifier key:**
   `node scripts/operator-actions.mjs rotate-verifier <new verifier address> --key-file <vault keys.json> --key-field operator --broadcast --confirm ROTATE_VERIFIER_4441`,
   then replace `RANKED_VERIFIER_PRIVATE_KEY`. **Leaked relayer key:**
   `node scripts/operator-actions.mjs relayer-off --key-file <vault keys.json> --key-field operator --broadcast --confirm RELAYER_OFF_4441`.
4. **Site rollback:** Vercel **Instant Rollback** to `dpl_2Q1MYFG9YQWypPjs84VLKdTkwdsu` (1.7.0) only. Never
   "Redeploy" or rebuild a pre-1.8.0 commit with production env; the renamed secrets make old code fail
   closed anyway.
5. **Never use `setEntryFeeEnabled(false)` (`fees-off`) as a stop.** With the minimum-paid check
   (`RANKED_MIN_PAID_WEI`) it makes Ranked unusable, and without it Ranked would become free while the
   relayer pays gas. The script prints this warning on every `fees-off`.
6. **Dead letters** after an incident: `node scripts/requeue-dead-letters.mjs` (dry run), then `--apply`.

## Phase 2: defining NFT achievements (written, not run)

The collections deploy empty (D15) and phase 1 defines nothing. After the owner approves the NFT subset
(checkpoint O3) and the catalog's `nft` flags match it:

```
node scripts/define-nft-achievements.mjs [--include-relayer-minter]        # dry run: the ordered calls
LITVM_DEFINE_CONFIRM=DEFINE_NFT_ACHIEVEMENTS_4441 \
  node scripts/define-nft-achievements.mjs --broadcast --key-env <NAME> [--include-relayer-minter]
```

It loads the catalog from `apps/portal/src/achievements/index.mjs` (`nftAchievementIds`, `catalogFor`) and
sends, per collection, `defineAchievement(ethers.id(id), gameId32, title, category, '<id>.json')`, plus
`setMinter(relayer, true)` with `--include-relayer-minter` (needed only for backfill minting). The key comes
from the environment variable **name** you pass (or `--key-file`/`--key-field`) and is never printed.
Broadcast also needs a `deployed` module and an RPC whose own `eth_chainId` is 4441 (a `--deployment`
override only with a loopback `--rpc`); definitions already on chain are skipped.
`planNftDefinitions()` is the pure planner the rehearsal reuses.

## Owner decisions 2026-09-16 (recorded)

- **Key custody.** Deployer and operator: the 2026-09-22 operator service key in the vault, used from a
  local machine through the scripts above; never stored in Vercel or the repo. Verifier and relayer keys:
  service keys in the vault, piped into Vercel production as `RANKED_VERIFIER_PRIVATE_KEY` and
  `RANKED_RELAYER_PRIVATE_KEY` by `scripts/vercel-secrets.mjs`; the settle core, the seed endpoint and the
  crons are the only readers. The relayer wallet is funded by the settlement reserve `ArcadeRankedEntry`
  forwards to `relayerVault` (the relayer address). Rotate with `operator-actions.mjs rotate-verifier` /
  `relayer-off` and replace the env var. Vercel functions are the service.
- **Fee.** Flat 0.1 zkLTC (`entryFeeWei`, adjustable per game via `setEntryFee`) split 15% treasury / 85%
  developer, plus a separate settlement gas reserve of 0.0001 zkLTC (`setSettlementGasReserve`) that funds
  the relayer. Both treasury and developer wallets are currently the owner wallet `0x07cec6Fc…8B26`; the
  Chikun creator wallet replaces the developer wallet for `chikun` once supplied (`GameRegistry` dev wallet
  + `confirmDevWallet`).
- **Settlement.** Relayer-settled: the player's only transaction is the entry; `/api/settle` verifies,
  signs and submits `submitVerifiedSession` from the relayer.
- **Epochs.** Testnet boards run until mainnet; mainnet is a fresh deployment set and a clean slate for
  scores and achievements. Per-game leaderboard wipes may happen as games evolve (announce in the UI first).
- **Profiles.** Hosted database (Neon) behind SIWE session tokens; `/api/session` and `/api/profile` fail
  closed without their secrets and the browser stays device-local.
- **Achievements.** One soulbound ERC-721 collection per game, per-game themed illustrations tiered
  bronze/silver/gold/platinum by unlock difficulty, revocable by the operator until mainnet, all wiped at
  mainnet.
- **Free Mode** never requires a wallet or any Web3 interaction.

### Vercel environment variables (production)

The secret names are **new** (contract A28): the live 1.7.0 `/api/attest` signs any posted score with a key
found under the old names, so the legacy names `VERIFIER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY` and
`SCORE_REGISTRY_ADDRESS` are **never set in any environment**. If any is present, the server fails closed
(`settlementReady = false`) and `scripts/vercel-secrets.mjs` refuses to run.

| Variable | Purpose | Set by |
| --- | --- | --- |
| `RANKED_VERIFIER_PRIVATE_KEY` | signs EIP-712 attestations (0x + 64 hex) | `vercel-secrets.mjs` (step 6) |
| `RANKED_RELAYER_PRIVATE_KEY` | submits verified scores; its address is allow-listed via `setRelayer` and funded by the reserve | `vercel-secrets.mjs` (step 6) |
| `RANKED_SCORE_REGISTRY_ADDRESS` | the deployed ScoreSubmissionRegistry; must equal the address module | `vercel-secrets.mjs` (step 6) |
| `CRON_SECRET` | Bearer secret of `/api/cron/index-chain` and `/api/cron/settle-retry` (32 random bytes, hex; also in the vault for `live-cron.mjs`) | `vercel-secrets.mjs` (step 6) |
| `SESSION_SECRET` | HMAC secret for session tokens, SIWE nonces, seed tickets and IP buckets; ≥ 32 characters, **rotated at step 6** and **different in every environment** | `vercel-secrets.mjs --rotate-session-secret` |
| `NEON_DATABASE_URL` | Neon connection string (already set by the marketplace integration) | Neon integration |
| `RPC_URL` | optional LiteForge RPC override; never echoed | optional |
| `SESSION_ALLOWED_DOMAINS` | optional comma list; default lestersarcade.io, www, localhost | optional |
| `SETTLEMENT_PAUSED` | `true` pauses Ranked (emergency stop 1); **never set at launch** | incident only |
| `RANKED_MIN_PAID_WEI` | minimum `getPaidSession().amountWei` the settle endpoint accepts; default `100100000000000000` (0.1 fee + 0.0001 reserve) | optional |

## Flipping hosted profile sync (2026-09-16)

The browser only calls `/api/session` and `/api/profile` when `HOSTED_PROFILE_SYNC` in `apps/portal/src/settlement.mjs` is `true`. It flips together with `SETTLEMENT_LIVE` at runbook step 7, after the step-6 secrets exist; until then an unconfigured deployment logs no failed requests and profiles stay device-local. `SETTLEMENT_LIVE` remains the separate gate for on-chain settlement and relayed `/api/settle`, and it may only be true with a `deployed` address module.
