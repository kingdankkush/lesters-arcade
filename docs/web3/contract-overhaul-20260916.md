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
   both parts: "0.1 zkLTC entry + 0.02 zkLTC settlement reserve".
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
nonce+9  ArcadeRankedEntry.setSettlementGasReserve(settlementGasReserveWei) // config, default 0.02 zkLTC placeholder
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

1. **Deployer key**: which wallet deploys (currently `0x24501ad9…20d4` in config) and who holds it.
2. **Verifier key custody**: the `trustedVerifier` address signs every score. It must live in the verifier
   service's secret store (not the browser). Decide the custody/rotation runbook
   (`ScoreSubmissionRegistry.setTrustedVerifier`).
3. **Vault addresses**: decided 2026-09-16: `treasuryVault` (15 %) = owner wallet; `platformVault` /
   `liquidityVault` (0 %) = owner wallet as placeholders. `relayerVault` (receives the settlement reserve)
   defaults to the relayer/operator key; supply a dedicated funding wallet if the relayer runs on its own
   key.
4. **Fee approval**: decided 2026-09-16: 0.1 zkLTC flat (`100000000000000000` wei) split 85 % developer /
   15 % treasury for all three games, **plus** `settlementGasReserveWei`, a placeholder `0.02 zkLTC`
   (`20000000000000000` wei) the owner tunes to the observed settlement gas. Players pay
   `quoteEntry(gameId).totalWei` (0.12 zkLTC at the placeholder). Still open: whether `chikun` and
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
- `contracts/test/SecurityBaseline.t.sol` rewritten for the new set; **not executed** (no foundry on the
  build machine).

## Runbook: deploy the hardened set and enable settlement (owner key holder)

Nothing below was run by the authoring session: no deployer key exists on the build machine and Vercel secret writes are not permitted from it. Every step is a plain command the key holder runs once.

1. **Recipients are configured.** `contracts/deploy-config.testnet.json` routes the 85 % developer share and the 15 % treasury share to the owner wallet `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26` for all three games (`8500/0/0/1500` bps); platform/liquidity are 0-bps placeholders on the same wallet.
2. **Choose the key addresses.** Set `deployer`, `operator`, `verifier`, `relayer` and `relayerVault` in the same file. `verifier` is the address of a fresh key that will only ever sign attestations (generate it offline: `node -e "import('ethers').then(({ethers})=>{const w=ethers.Wallet.createRandom();console.log(w.address)})"` and keep the private key out of the repo). `relayer` is the key the settlement service sends `submitVerifiedSession` from; `relayerVault` is where the per-session settlement reserve lands (default: the relayer itself). If `deployer` is not the owner wallet, the owner wallet must send `confirmDevWallet` for each game after the deploy (the script prints the calls and lists them in the manifest).
3. **Set `settlementGasReserveWei`.** The config ships `"20000000000000000"` (0.02 zkLTC) as a **placeholder**. Measure one settlement on testnet (`submitVerifiedSession` with the largest expected achievement list, ~gas x gas price), add headroom, and set the value before deploying; later retune without redeploying via `ArcadeRankedEntry.setSettlementGasReserve(uint256)` (emits `SettlementGasReserveUpdated`; `setRelayerVault` must be non-zero first). Players are charged `quoteEntry(gameId).totalWei = 0.1 zkLTC + reserve`. Set it to `"0"` to charge the flat fee only (the relayer then runs on its own funds).
4. **Dry run** (no transaction): `node scripts/deploy-contracts.mjs` writes `docs/web3/hardened-ranked-deployment-manifest.json` with the seven predicted addresses (four shared contracts + three achievement collections), the full nonce plan, per-game `totalEntryWei`, and the activation block.
5. **Deploy** (LiteForge testnet, zkLTC gas only): `DEPLOYER_PRIVATE_KEY=0x... LITVM_DEPLOY_CONFIRM=DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441 node scripts/deploy-contracts.mjs --broadcast` deploys GameRegistry, PlayerProfileRegistry, ArcadeRankedEntry, ScoreSubmissionRegistry and the three AchievementRegistry collections, wires vaults + relayer vault + reserve + relayer allow-list + per-game minter/routing, registers the three games at 0.1 zkLTC (85/15), activates them when the deployer is the owner wallet, and writes `contracts/deployment-record.hardened.json` (`addresses.achievementRegistries[slug]`).
6. **Point the portal and the relayer at the new addresses.** Copy the hardened addresses into `LITVM_CONTRACT_ADDRESSES` in `apps/portal/src/settlement.mjs` (`arcadeRankedEntry` plus the per-game achievement registries) and into the relayer/verifier service, run `node --test tests/litvm-ranked-contract-gate.test.mjs tests/score-registry-abi.test.mjs`, commit.
7. **Verifier and relayer secrets on Vercel** (production): `npx vercel env add VERIFIER_PRIVATE_KEY production` (paste the verifier private key), `npx vercel env add RELAYER_PRIVATE_KEY production` (the allow-listed relayer key, funded with zkLTC from `relayerVault`) and `npx vercel env add SCORE_REGISTRY_ADDRESS production` (the deployed ScoreSubmissionRegistry). Redeploy; `POST /api/attest` should stop answering 503.
8. **Enable settlement.** Set `SETTLEMENT_LIVE = true` in `apps/portal/src/settlement.mjs`, update the tests that pin it (`tests/settlement.test.mjs`, `tests/litvm-ranked-contract-gate.test.mjs`), run `npm run vercel:build`, deploy and promote. From then on Ranked entry charges `quoteEntry(gameId).totalWei` via `ArcadeRankedEntry.openSession` and every result is settled by the relayer through `submitVerifiedSession` with the verifier's EIP-712 signature.
9. **Achievement art.** Define achievements on chain in each game's own collection (`AchievementRegistry[slug].defineAchievement`) once the badge set is approved; `tokenUriPath` resolves under `https://lestersarcade.io/achievements/<slug>/`.
10. **Mainnet.** Do not migrate. When mainnet arrives, produce a new deploy config for the mainnet chain, redeploy the whole set, re-define achievements and repoint the portal/relayer; the testnet epoch is retired.

## Owner decisions 2026-09-16 (recorded)

- **Key custody.** Deployer key: held by the owner only, used once from a local machine for the deploy script; never stored in Vercel or the repo. Verifier key and relayer key: generated by the owner offline and stored as Vercel production environment variables (`VERIFIER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`); the functions under `api/` are the only readers. The relayer wallet is funded by the settlement gas reserve that `ArcadeRankedEntry` forwards to `relayerVault` (set it to the relayer address). Rotate either key by replacing the env var and calling `setTrustedVerifier` / `setRelayer` as operator. No separate service is needed; Vercel functions are the service.
- **Fee.** Flat 0.1 zkLTC (`entryFeeWei`, adjustable per game via `setEntryFee`) split 15% treasury / 85% developer, plus a separate settlement gas reserve (`setSettlementGasReserve`, placeholder 0.02 zkLTC) that funds the relayer. Both treasury and developer wallets are currently the owner wallet `0x07cec6Fc…8B26`; the Chikun creator wallet replaces the developer wallet for `chikun` once supplied (`GameRegistry` dev wallet + `confirmDevWallet`).
- **Settlement.** Relayer-settled: the player's only transaction is the entry; `/api/settle` verifies, signs and submits `submitVerifiedSession` from the relayer. If the relayer is unfunded or unset the browser falls back to a player-signed submit with the same attestation.
- **Epochs.** Testnet boards run until mainnet; mainnet is a fresh deployment set and a clean slate for scores and achievements. Per-game leaderboard wipes may happen as games evolve (announce in the UI first).
- **Profiles.** Hosted database (Neon/Vercel Postgres) behind SIWE session tokens: `SESSION_SECRET` (32+ chars) and `NEON_DATABASE_URL` in Vercel; `/api/session` and `/api/profile` fail closed without them and the browser stays device-local.
- **Achievements.** One soulbound ERC-721 collection per game, per-game themed illustrations tiered bronze/silver/gold/platinum by unlock difficulty, revocable by the operator until mainnet, all wiped at mainnet.
- **Free Mode** never requires a wallet or any Web3 interaction.

### Vercel environment variables (production)

| Variable | Purpose |
| --- | --- |
| `VERIFIER_PRIVATE_KEY` | signs EIP-712 attestations (`/api/attest`, `/api/settle`) |
| `SCORE_REGISTRY_ADDRESS` | verifying contract for the attestation domain |
| `RELAYER_PRIVATE_KEY` | submits verified scores for players (`/api/settle`); its address must be allowed via `setRelayer` and funded |
| `RPC_URL` | optional override of the LiteForge RPC |
| `SESSION_SECRET` | HMAC secret for wallet session tokens (`/api/session`, `/api/profile`) |
| `SESSION_ALLOWED_DOMAINS` | optional comma list; default lestersarcade.io, www, localhost |
| `NEON_DATABASE_URL` | Neon/Vercel Postgres connection string for profile sync |


## Flipping hosted profile sync (2026-09-16)

The browser only calls `/api/session` and `/api/profile` when `HOSTED_PROFILE_SYNC` in `apps/portal/src/settlement.mjs` is `true`. Flip it in the same change that adds `SESSION_SECRET` (≥ 32 chars) and `NEON_DATABASE_URL` on Vercel; until then an unconfigured deployment logs no failed requests and profiles stay device-local. `SETTLEMENT_LIVE` remains the separate gate for on-chain settlement and relayed `/api/settle`.
