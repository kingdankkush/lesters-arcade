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
   both parts: "0.1 zkLTC entry + 0.002 zkLTC settlement reserve".
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
nonce+9  ArcadeRankedEntry.setSettlementGasReserve(settlementGasReserveWei) // config: 0.002 zkLTC (2000000000000000 wei)
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
   15 % treasury for all three games, **plus** `settlementGasReserveWei` = **0.002 zkLTC**
   (`2000000000000000` wei, decided 2026-09-23 after LiteForge base fees rose from about 0.01 to about
   1.5 gwei; it replaces the 0.0001 zkLTC sized on 2026-09-22. The deploy script's 0.02 zkLTC default is
   only a fallback when the config omits it). Players pay `quoteEntry(gameId).totalWei` (0.102 zkLTC). Still open: whether `chikun` and
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
`--key-file <vault path> --key-field <field>` (the 2026-09-22 vault file nests keys as `keys.operator`, `keys.verifier` and `keys.relayer`, so pass those dotted paths; one field of a JSON file; a field holding
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
   `0x07cec6Fc…8B26` as developer and treasury, and a settlement reserve of **0.002 zkLTC**
   (`"2000000000000000"` wei; owner decision 2026-09-23 after LiteForge base fees rose to about 1.5 gwei;
   a settlement uses about 475k gas). Players pay `quoteEntry(gameId).totalWei` = **0.102 zkLTC**. Retune later without a
   redeploy: `node scripts/operator-actions.mjs reserve <wei>` (dry run first).
2. **Read the chain, then dry-run the deploy.** `node scripts/operator-actions.mjs status` (read-only:
   operator nonce, which must still be 0, balances, contract state), then `node scripts/deploy-contracts.mjs`
   (writes `docs/web3/hardened-ranked-deployment-manifest.json` with the seven predicted addresses; they must
   equal the committed address module).
3. ⚠ **Broadcast.** First check the key without starting anything:
   `node scripts/deploy-contracts-with-key.mjs --key-file <vault keys.json> --key-field keys.operator`
   (it confirms the vault field holds the configured deployer's key). Then:
   `node scripts/deploy-contracts-with-key.mjs --key-file <vault keys.json> --key-field keys.operator --broadcast --confirm DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441`.
   The launcher reads the key inside its own process and starts `node scripts/deploy-contracts.mjs --broadcast`
   with `DEPLOYER_PRIVATE_KEY` and `LITVM_DEPLOY_CONFIRM` set in that child's environment only: the key is
   never on a command line, in the shell's environment or in any output, and nothing is left set when the
   deploy exits. Never export `DEPLOYER_PRIVATE_KEY` by hand. Commit
   `contracts/deployment-record.hardened.json` and the regenerated
   `apps/portal/src/generated/litvm-addresses.mjs` (`status: 'deployed'`) together.
4. ⚠ **Owner confirms the developer wallet**, one transaction per game, on the owner page (next section).
5. ⚠ **Operator activates the games:**
   `node scripts/operator-actions.mjs activate --key-file <vault keys.json> --key-field keys.operator --broadcast --confirm ACTIVATE_GAMES_4441`
   (dry run first without `--broadcast`; games whose developer wallet is not confirmed are skipped).
6. ⚠ **Vercel production secrets**: `node scripts/vercel-secrets.mjs --key-file <vault keys.json> --verifier-field keys.verifier --relayer-field keys.relayer
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
   `node scripts/operator-actions.mjs pause-games --key-file <vault keys.json> --key-field keys.operator --broadcast --confirm PAUSE_GAMES_4441`
   (`setPlayable(gameId, false)` for each game; blocks `openSession` and `submitVerifiedSession`).
3. **Leaked verifier key:**
   `node scripts/operator-actions.mjs rotate-verifier <new verifier address> --key-file <vault keys.json> --key-field keys.operator --broadcast --confirm ROTATE_VERIFIER_4441`,
   then replace `RANKED_VERIFIER_PRIVATE_KEY`. **Leaked relayer key:**
   `node scripts/operator-actions.mjs relayer-off --key-file <vault keys.json> --key-field keys.operator --broadcast --confirm RELAYER_OFF_4441`.
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

**Backfill** (after the definitions and `--include-relayer-minter`): `scripts/backfill-nft-mints.mjs`
mints, from the relayer key, every `achievement_unlocks` row whose `achievement_id` is in
`nftAchievementIds(gameId)` of the catalog **at run time** and whose `token_id` is null. The stored `nft`
column (the phase-1 proposal) is ignored (contract A20); `--resync` rewrites it from the catalog for
display. Each `mintFor` is simulated first, so duplicates and undefined ids are skipped without a
transaction and a re-run mints nothing. The E12 index cron then stamps `token_id`, `mint_tx_hash` and
`minted_at`.

```
node scripts/backfill-nft-mints.mjs [--resync]                                          # dry run (reads Neon only)
LITVM_BACKFILL_CONFIRM=BACKFILL_NFT_MINTS_4441 \
  node scripts/backfill-nft-mints.mjs --broadcast --resync --key-file <vault keys.json> --key-field keys.relayer
```

`NEON_DATABASE_URL` comes from the environment and is never printed; the script never migrates. The key
must be the deployment's relayer. Rehearsed end to end by `node scripts/rehearse-nft-phase2.mjs` (below).

## Rehearsal: local chain end to end, phase 2, step-7 dry run (2026-09-23)

Everything here runs offline on the in-process Hardhat chain (chain 4441) with PGlite standing in for
Neon and public fixture keys only. Nothing touches LiteForge, Vercel or production Neon.

- `scripts/lib/local-stack.mjs` `startLocalStack()`: deploys the suite (`scripts/lib/local-chain.mjs`),
  confirms the developer wallet, sets every game playable, checks fees are on, and builds an
  **unmigrated** PGlite, so the first requests prove the handlers' own `ensureSchema` (A34). Every
  `api/*.mjs` module is mounted as production mounts it, `createHandler(() => buildDeps(env, { db,
  provider, deployment, nowMs }))` (A30), behind the rewrites **read from `vercel.json`** (query strings
  carried, named params appended the way Vercel's router does), so routing drift fails the rehearsal.
  The server clock is the timestamp the chain would give its next block, so the A26 timing checks run
  on chain time and the driver advances time with `evm_increaseTime` instead of sleeping.
- `scripts/lib/local-http.mjs`: the same mounts over `node:http` (optionally with a static web root and
  the `vercel.json` headers, CSP included, for the browser-e2e slice), plus a JSON-RPC proxy to the chain.
- `scripts/lib/rehearsal-driver.mjs` `runRankedE2E()`: one Ranked session per game through the real
  endpoints and contracts, asserting every item of guide §7 step 9 (sign-in, seed ticket, entry,
  evidence at the ticket seed, settle until confirmed, `getSession` and `sessionEnvelopeHash`, the
  weekly board row, profile stats and achievements, share session, page tags and card PNG, an on-chain
  rename plus E8, the E12 cron twice) and the negative checks: duplicate settle (same state, no second
  transaction), unpaid entry (402 `entry-not-paid`), fees off (402 `entry-underpaid`, local only),
  a tampered Chikun claim (ignored), evidence copied to another wallet's paid ticket (rejected; needs
  a second funded wallet, skipped without one), an ephemeral wallet's token (403 `wallet-mismatch`),
  and `SETTLEMENT_PAUSED` (503 on E15, E3 and E13, local only). "No row changed" compares the content
  of every session, evidence, achievement, profile, lease and indexer row (an md5 per table), so an
  UPDATE by a rejected request fails the check, not only an INSERT or a DELETE.
- A wallet may rehearse more than once: E5 shows each wallet's best confirmed run of the period (D1)
  and first-run achievements unlock once, so a run that is not the wallet's best, or earns nothing new,
  is recorded as such (with the wallet's best row and prior achievements), while E4, E9 and the chain
  still prove the run itself confirmed.

Commands:

```
node scripts/rehearse-ranked-e2e.mjs --target local      # in process, then over HTTP + JSON-RPC, then phase 2
                                                         # → docs/qa/pre-deployment-rehearsal-20260923.json
node scripts/rehearse-nft-phase2.mjs [--out <path>]      # phase 2 only
node scripts/rehearse-step7-dry-run.mjs --confirm-throwaway   # about an hour; see the checklist below
node --test tests/local-chain-rehearsal.test.mjs tests/local-chain-rehearsal-http.test.mjs tests/nft-phase2-rehearsal.test.mjs
```

### Live end-to-end (runbook step 9, owner approval in the moment)

Owner checkpoint O2 first: decide whether the test wallet's rows stay on the launch boards
(recommended: a fresh test wallet, excluded afterwards with
`node scripts/moderate-profile.mjs --wallet <player> --exclude --apply --confirm EXCLUDE_WALLET`).
The player wallet needs about 0.32 zkLTC (three entries of 0.102 plus 0.01 of gas margin for three
renames). The optional second wallet (`--second-key-file`, for the evidence-copy check) needs about
0.104 zkLTC (one Chikun entry plus gas); without it that check is reported as skipped.

```
# 1. Plan only: prints the entries at their quoteEntry totals, the second wallet's entry, any earlier
#    runs of the player (a warning) and the O2 reminder; sends nothing.
node scripts/rehearse-ranked-e2e.mjs --target live --site https://lestersarcade.io \
  --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path to the funded test key> \
  --second-key-file <path to a second funded test key> \
  --cron-secret-file C:/Users/just_/lesters-arcade-vault/keys/cron-secret.txt --confirm-live SPEND_TESTNET_ZKLTC
# 2. The run: the same command with --yes (optionally --out <path>; default docs/qa/ranked-live-e2e-<date>.json).
node scripts/rehearse-ranked-e2e.mjs --target live --site https://lestersarcade.io \
  --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path to the funded test key> \
  --second-key-file <path to a second funded test key> \
  --cron-secret-file C:/Users/just_/lesters-arcade-vault/keys/cron-secret.txt --confirm-live SPEND_TESTNET_ZKLTC --yes
# A retry replays only what failed: add --games <id,id> (lester-blaster, chikun, stacked).
```

The CLI refuses to start without every flag (`--cron-secret-env <NAME>` may replace the file), refuses a
`predicted` address module and any RPC whose own `eth_chainId` is not 4441, reads the player key
(`--player-key-field <field>` for a JSON key file), the optional second key (`--second-key-field`,
`--second-key-env`) and the cron secret inside the process through `scripts/lib/key-source.mjs`, and
never prints any of them. It waits wall-clock time for each run's length since the entry block (about
3, 1.5 and 1 minutes): LiteForge is Arbitrum Orbit and makes no empty blocks, so the latest block time
stands still while nobody transacts, and the server checks the run length against its own clock (A26;
a retryable 409 `run-timing-early` is honoured for up to 15 minutes). It skips the local-only negative
checks (fees off, pause) and writes a report with no secret in it. The ephemeral 403 wallet is created
in memory and never funded. A retry with the same wallet still passes (see above), but spends another
entry per game, which is what `--games` is for.

### Step-7 checklist (with the step-3 commit)

`scripts/rehearse-step7-dry-run.mjs` rehearses both runbook commits that change what the committed build
does, in a throwaway git worktree under the OS temp directory (never committed, merged or pushed;
removed at the end). **Step 3** (contract §13): the deployment record from a local deploy of the real
deploy config and the address module regenerated with `--deployed`, flags off; it runs the whole release
gate and the offline audits, separates the failures the deployed module causes from those already
failing, and proves the step-3 edits. **Step 7**, on top of that step-3 commit: the flags, the public
copy, every step of `npm run vercel:build` and the audits; it separates the failures the flip causes
from those already failing at the step-3 commit (comparing the output too when a step fails on both
sides), proves the step-7 edits and re-runs the whole gate. Generated documents (the fact sheet, the
design audits, the public pages) are compared state by state by content, so one that records the module
or the flags is listed for regeneration even when its checker already fails at the base. The raw
evidence is `docs/qa/step7-dry-run-20260923.json`, written unedited by the script (local paths as
`<throwaway>`, `<repo>` and `~`); `tests/local-chain-rehearsal.test.mjs` fails when the script changes
without a new run.

<!-- step7-checklist:start (generated by scripts/rehearse-step7-dry-run.mjs; do not edit by hand) -->

Generated from `docs/qa/step7-dry-run-20260923.json` (dry run at `62705965`, 2026-09-24, script sha256 `225385c66c53`). Contract §13 step 0 needs this checklist current: re-run `node scripts/rehearse-step7-dry-run.mjs --confirm-throwaway` whenever main moves before the deployment (in particular after the integration-glue slice merges) and commit its two outputs unedited.

**Step 3 (the deploy commit).** Contract §13 step 3 commits these together, after the broadcast:

1. **Deployment record and address module.** Commit `contracts/deployment-record.hardened.json` from the broadcast and regenerate `apps/portal/src/generated/litvm-addresses.mjs` with `npm run contracts:addresses -- --deployed` (`status: 'deployed'`, `startBlock` from the record). `--deployed` fails when the record is missing, where the bare `npm run contracts:addresses` would quietly write the `predicted` module again.
2. **Pinned tests** (1 edit, each proven by the dry run; the flags stay off):
   - `tests/name-claim-prompt.test.mjs:174` (the default reads the generated module, which step 3 makes deployed):
     ```diff
     -  const byDefault = await promptNameClaim({ detail: runEvent(), hosted: true, wallet: WALLET, indexApi, documentRef, mount });
     -  assert.equal(byDefault.reason, 'not-deployed', 'the generated LITVM_DEPLOYMENT is not deployed at this commit');
     -  assert.equal(indexApi.calls.profile.length, 0, 'no request either');
     -  assert.equal(mount.children.length, 0);
     +  assert.equal(indexApi.calls.profile.length, 0, 'no request either');
     +  assert.equal(mount.children.length, 0);
     +  // Since runbook step 3 the generated LITVM_DEPLOYMENT is deployed, so the default is no longer skipped.
     +  const byDefault = await promptNameClaim({ detail: runEvent(), hosted: true, wallet: WALLET, indexApi, documentRef, mount: element('body') });
     +  assert.notEqual(byDefault.reason, 'not-deployed', 'the generated LITVM_DEPLOYMENT is deployed since runbook step 3');
     ```
3. **Generated documents the deployed module changes** (not gated; regenerate and commit them so they stay true):
   - `npm run design:web3-audit` rewrites `docs/qa/hard-money-heroes-web3-settlement-audit.json`, `docs/qa/hard-money-heroes-web3-settlement-audit.md`:
     ```diff
     -"detail": "address module predicted; hardened entry address 0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190; settlement live=false (live needs a deployed module wi…
     +"detail": "address module deployed; hardened entry address 0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190; settlement live=false (live needs a deployed module wit…
     -| safe-ranked-live-gate | PASS | address module predicted; hardened entry address 0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190; settlement live=false (live need…
     +| safe-ranked-live-gate | PASS | address module deployed; hardened entry address 0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190; settlement live=false (live needs…
     ```
   - `npm run design:web3-live` rewrites `docs/web3/hmh-web3-live-readiness.json`, `docs/web3/hmh-web3-live-readiness.md`:
     ```diff
     -"GameRegistry cabinet approval path is not live-gated.",
     -"SplitConfig/economy settings are not production-approved.",
     -| on-chain-registry-economy | BLOCKED | — | GameRegistry cabinet approval path is not live-gated.; SplitConfig/economy settings are not production-approved.; …
     +| on-chain-registry-economy | BLOCKED | — | Legal/brand/economy approval is required before real-value launch. |
     ```
4. **Gate.** The step-3 commit then shows exactly the 51 ledgered failures (the dry run's step-3 gate: FAIL, 1 unexpected = 1 caused by step 3 + 0 already failing, 0 missing).

**Step 7 (the flag flip).** Runbook step 7 (contract §13) makes exactly these changes in ONE commit, on top of the step-3 commit, after step 6 and before the 1.8.0 build:

1. **Flags** in `apps/portal/src/settlement.mjs`:
   - line 28: `export const SETTLEMENT_LIVE = false;` → `export const SETTLEMENT_LIVE = true;`
   - line 36: `export const HOSTED_PROFILE_SYNC = false;` → `export const HOSTED_PROFILE_SYNC = true;`
2. **Public copy.** Run `node scripts/build-portal-pages.mjs` (contract A33) and commit what it rewrites. In the dry run the regeneration changed:
   - `apps/portal/discover/chikun.html`
   - `apps/portal/discover/games.html`
   - `apps/portal/discover/hard-money-heroes.html`
   - `apps/portal/discover/stacked.html`
   - `apps/portal/index.html`
   - `apps/portal/llms.txt`
   - `apps/portal/manifest.webmanifest`
   - `apps/portal/trust.html`
3. **Pinned tests** (12 edits, each proven by the dry run):
   - `tests/settlement.test.mjs:16` (pins both flags):
     ```diff
     -  assert.equal(SETTLEMENT_LIVE, false);
     -  assert.equal(HOSTED_PROFILE_SYNC, false, 'hosted profile sync stays off until the Vercel secrets exist');
     +  assert.equal(SETTLEMENT_LIVE, true);
     +  assert.equal(HOSTED_PROFILE_SYNC, true, 'hosted profile sync is on since runbook step 7 (the Vercel secrets exist)');
     ```
   - `tests/hmh-release-facts.test.mjs:169` (the real-repository adapter reads the committed SETTLEMENT_LIVE):
     ```diff
     -  assert.equal(f.cabinets.length, 2);
     -  assert.equal(f.settlement.liveFlag, false);
     +  assert.equal(f.cabinets.length, 2);
     +  assert.equal(f.settlement.liveFlag, true);
     ```
   - `tests/litvm-ranked-contract-gate.test.mjs:67` (pins the flag; the module is deployed from step 3 on):
     ```diff
     -  assert.ok(['predicted', 'deployed'].includes(LITVM_DEPLOYMENT.status));
     -  assert.equal(SETTLEMENT_LIVE, false);
     +  assert.equal(LITVM_DEPLOYMENT.status, 'deployed');
     +  assert.equal(SETTLEMENT_LIVE, true);
     ```
   - `tests/litvm-ranked-contract-gate.test.mjs:100` (pins the flag): `assert.equal(SETTLEMENT_LIVE, false, 'fixture preflight does not enable real settlement');` → `assert.equal(SETTLEMENT_LIVE, true, 'the committed build is live since runbook step 7; this fixture preflight sends nothing');`
   - `tests/litvm-ranked-contract-gate.test.mjs:144` (the real writer is live after step 7; the disabled gate is kept on the isolated writer):
     ```diff
     -  const provider = { async request(request) { calls.push(request); throw new Error('provider must not be contacted'); } };
     -  await assert.rejects(submitRankedSession(provider, { sessionId: 'fixture-run', gameId, envelopeHash: `0x${'ab'.repeat(32)}`, attestation: { signature: 'fixture-not-a-real-signature', deadline: 1 } }), /settlement is disabled/i);
     +  const provider = { async request(request) { calls.push(request); throw new Error('provider must not be contacted'); } };
     +  // Since runbook step 7 the committed flag is true, so the disabled path is proven on the
     +  // source-isolated writer with SETTLEMENT_LIVE false.
     +  const source = readFileSync(new URL('../apps/portal/src/litvm-chain-client.mjs', import.meta.url), 'utf8');
     +  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
     +  const names = ['scoreContractAddress', 'readRankedContractGate', 'submitRankedSession', 'isBytes32Hex', 'toBytes32Id'];
     +  const code = ast.body.map(n => n.declaration ?? n).filter(n => n.type === 'FunctionDeclaration' && names.includes(n.id.name)).map(n => source.slice(n.start, n.end)).join('\n');
     +  const disabledWriter = runInNewContext(`${code}\nsubmitRankedSession`, {
     +    SETTLEMENT_LIVE: false, loadEthers, SCORE_REGISTRY_ABI,
     +    GAME_REGISTRY_ABI: gameAbi.fragments, LITVM_CONTRACT_ADDRESSES,
     +    LITVM_LITEFORGE_NETWORK: { chainId: 4441, name: 'Fixture LiteForge' },
     +  });
     +  await assert.rejects(disabledWriter(provider, { sessionId: 'fixture-run', gameId, envelopeHash: `0x${'ab'.repeat(32)}`, attestation: { signature: 'fixture-not-a-real-signature', deadline: 1 } }), /settlement is disabled/i);
     ```
   - `tests/litvm-ranked-contract-gate.test.mjs:163` (pins the flag): `assert.equal(SETTLEMENT_LIVE, false, 'the real exported gate is never toggled by this fixture');` → `assert.equal(SETTLEMENT_LIVE, true, 'the committed gate is live since runbook step 7; this fixture never toggles it');`
   - `tests/ranked-preflight.test.mjs:173` (pins the flag): `assert.equal(SETTLEMENT_LIVE, false, 'the preview build never runs these reads');` → `assert.equal(SETTLEMENT_LIVE, true, 'the live build runs these reads, always over the public RPC');`
   - `tests/ranked-preflight.test.mjs:181` (lets the disabled-entry check run on the isolated module): `function isolatedEntry({ receipt, publicReadFails = false, publicWait = null, walletWait = null, paid = () => false, signer = WALLET } = {}) {` → `function isolatedEntry({ receipt, publicReadFails = false, publicWait = null, walletWait = null, paid = () => false, signer = WALLET, live = true } = {}) {`
   - `tests/ranked-preflight.test.mjs:227` (lets the disabled-entry check run on the isolated module):
     ```diff
     -    SETTLEMENT_LIVE: true,
     -    loadEthers: async () => fakeEthers,
     +    SETTLEMENT_LIVE: live,
     +    loadEthers: async () => fakeEthers,
     ```
   - `tests/ranked-preflight.test.mjs:272` (the committed entry is live after step 7; the disabled refusal is kept on the isolated module):
     ```diff
     -  // The committed build refuses before touching the wallet.
     -  const untouched = { request() { throw new Error('must not be contacted'); } };
     -  await assert.rejects(sendRankedEntry(untouched, { sessionKey, gameId: GAME, preflight }), /settlement is disabled/i);
     -  await assert.rejects(openRankedSession(untouched, { sessionId: 'game-session-x', gameId: GAME }), /settlement is disabled/i);
     +  // A build with settlement off (every build before runbook step 7) refuses before touching the wallet.
     +  const untouched = { request() { throw new Error('must not be contacted'); } };
     +  const disabled = isolatedEntry({ live: false }).api;
     +  await assert.rejects(disabled.sendRankedEntry(untouched, { sessionKey, gameId: GAME, preflight }), /settlement is disabled/i);
     +  await assert.rejects(disabled.openRankedSession(untouched, { sessionId: 'game-session-x', gameId: GAME }), /settlement is disabled/i);
     ```
   - `tests/ship-readiness.test.mjs:50` (the committed index.html is the launch page after the flip):
     ```diff
     -  assert.match(html, /verified on-chain publishing remains disabled/i);
     +  // Since runbook step 7 the committed pages carry the launch copy (contract A33).
     +  assert.match(html, /the relayer publishes your score on LitVM/i);
     +  assert.doesNotMatch(html, /verified on-chain publishing remains disabled/i);
     ```
   - `tests/integration-glue-copy.test.mjs:198` (the prerendered entry modal follows the flags, so after the flip it is the launch copy):
     ```diff
     -  // Committed pages are the preview state (the ship-readiness phrase included).
     -  assert.equal(block(index, 'entry-copy'), preview.rankedEntryCopy.replace(/'/g, '&#39;'));
     -  assert.equal(block(index, 'entry-footnote'), preview.rankedEntryFootnote.replace(/'/g, '&#39;'));
     +  // Since runbook step 7 the committed pages are the launch state (the preview copy, checked below,
     +  // still carries the ship-readiness phrase for any build with the flags off).
     +  assert.equal(block(index, 'entry-copy'), launch.rankedEntryCopy.replace(/'/g, '&#39;'));
     +  assert.equal(block(index, 'entry-footnote'), launch.rankedEntryFootnote.replace(/'/g, '&#39;'));
     ```
4. **Generated documents that record the flags.** Regenerate and commit them with the flip (their content changes with it, even where a checker already fails at the base):
   - `npm run design:web3-audit` rewrites `docs/qa/hard-money-heroes-web3-settlement-audit.json`, `docs/qa/hard-money-heroes-web3-settlement-audit.md`:
     ```diff
     -"detail": "address module deployed; hardened entry address 0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190; settlement live=false (live needs a deployed module wit…
     +"detail": "address module deployed; hardened entry address 0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190; settlement live=true (live needs a deployed module with…
     -| safe-ranked-live-gate | PASS | address module deployed; hardened entry address 0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190; settlement live=false (live needs…
     +| safe-ranked-live-gate | PASS | address module deployed; hardened entry address 0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190; settlement live=true (live needs …
     ```
   - `node scripts/hmh-release-facts.mjs --write` rewrites `docs/releases/hmh-fact-sheet.json`, `docs/releases/hmh-fact-sheet.md`:
     ```diff
     -"state": "simulated",
     -"liveFlag": false,
     +"state": "gated",
     +"liveFlag": true,
     -- Settlement: **simulated**; SETTLEMENT_LIVE=false. This flag is not payment, gas, receipt, score, NFT or provider verification. Real-wallet/native entry, ABI…
     -Input snapshot SHA-256: `ad82548b8655b7303921708b990a60e8fbf7dc356b7ca35f3cac95b6364aabde`
     +- Settlement: **gated**; SETTLEMENT_LIVE=true. This flag is not payment, gas, receipt, score, NFT or provider verification. Real-wallet/native entry, ABI, dur…
     +Input snapshot SHA-256: `639ba0483a91a1818209add06f6cfffbf01929cba48b4582f2cd990defd30daa`
     ```
5. **Audits and build steps.** No step of `npm run vercel:build` and no offline audit fails because of the flip.
6. **Already failing before the flip** (they fail at the step-3 commit too; not step-7 work):
   - `node scripts/hmh-release-facts.mjs --check` exits 1 before the flip as well (Stale or missing fact sheet: hmh-fact-sheet.json); what it checks (`docs/releases/hmh-fact-sheet.json`, `docs/releases/hmh-fact-sheet.md`) changes with the flip and is regenerated in item 4
7. **Gate.** `npm run vercel:build` then shows exactly the 51 ledgered failures (the dry run's full re-run after both commits' edits: PASS, 0 unexpected, 0 missing). If it shows a different set, the base has moved: re-run the dry run first. Restore `docs/testing/hmh-reboot-test-retirement-gate.json` before committing unless the orchestrator is committing the integration's gate JSON.

<!-- step7-checklist:end -->

## Owner decisions 2026-09-16 (recorded)

- **Key custody.** Deployer and operator: the 2026-09-22 operator service key in the vault, used from a
  local machine through the scripts above; never stored in Vercel or the repo. Verifier and relayer keys:
  service keys in the vault, piped into Vercel production as `RANKED_VERIFIER_PRIVATE_KEY` and
  `RANKED_RELAYER_PRIVATE_KEY` by `scripts/vercel-secrets.mjs`; the settle core, the seed endpoint and the
  crons are the only readers. The relayer wallet is funded by the settlement reserve `ArcadeRankedEntry`
  forwards to `relayerVault` (the relayer address). Rotate with `operator-actions.mjs rotate-verifier` /
  `relayer-off` and replace the env var. Vercel functions are the service.
- **Fee.** Flat 0.1 zkLTC (`entryFeeWei`, adjustable per game via `setEntryFee`) split 15% treasury / 85%
  developer, plus a separate settlement gas reserve of 0.002 zkLTC (`setSettlementGasReserve`) that funds
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
| `RANKED_MIN_PAID_WEI` | minimum `getPaidSession().amountWei` the settle endpoint accepts; default `102000000000000000` (0.1 fee + 0.002 reserve) | optional |

## Flipping hosted profile sync (2026-09-16)

The browser only calls `/api/session` and `/api/profile` when `HOSTED_PROFILE_SYNC` in `apps/portal/src/settlement.mjs` is `true`. It flips together with `SETTLEMENT_LIVE` at runbook step 7, after the step-6 secrets exist; until then an unconfigured deployment logs no failed requests and profiles stay device-local. `SETTLEMENT_LIVE` remains the separate gate for on-chain settlement and relayed `/api/settle`, and it may only be true with a `deployed` address module.
