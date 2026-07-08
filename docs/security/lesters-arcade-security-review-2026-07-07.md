# Code Review: Lester's Arcade

Repository: [kingdankkush/lesters-arcade](https://github.com/kingdankkush/lesters-arcade)  
Reviewed: 2026-07-07  
Reviewer notes collated by: Hermes, from OpenClaw review plus independent spot-review  
Commit reviewed locally: `1b111fe39ac2011c78373a9bb668df4a67108c90` (`Add WO-107 checkpoint two tour`)  
Scope: static review of `main`, focused on smart contracts, Web3 settlement paths, sandbox/SDK security, and leaderboard integrity.

---

## Executive Summary

Lester's Arcade has a coherent product/architecture direction: parent shell owns identity and settlement, games run as sandboxed cabinets, and the project has unusually strong design docs and automated tests for a prototype-stage Web3 arcade.

However, the current smart-contract and settlement layers are **not safe for real funds or production-ranked integrity**. The main blockers are:

- `SessionLedger.closeSession()` recovers a signer but does not verify that signer against the registered game/verifier.
- `PaymentRouter.setDefaultVaults()` is externally callable by anyone.
- `ArcadePaymentRouter.startPaidSession()` accepts caller-controlled split destinations and any token.
- `ScoreSubmissionRegistry.submitSession()` is permissionless and has no proof of real gameplay/session participation.
- There are two competing payment/settlement architectures, and deployment/runtime wiring does not consistently choose one.
- Several tests and scripts validate structure, but not the core security invariants.

**Verdict:** do not deploy with real value. Testnet-only is acceptable only if the team explicitly accepts leaderboard pollution and test-token routing risk.

---

## Verification Performed

Local clone and checks:

```text
git clone https://github.com/kingdankkush/lesters-arcade.git
commit: 1b111fe39ac2011c78373a9bb668df4a67108c90
npm ci
npm test
npm run check
npm run contracts:check
npm run contracts:compile
```

Results after installing dependencies:

```text
npm test: pass — 990/990 tests, 0 fail
npm run check: pass — 250 JS modules + 30 Python scripts
npm run contracts:check: pass
npm run contracts:compile: pass — 10 contract artifacts compiled
```

Note: running `npm test` before `npm ci` failed because `esbuild` was missing. After `npm ci`, the suite passed.

---

## Severity Key

- 🔴 Critical: fund drain, irreversible loss, or complete bypass of a core security invariant.
- 🟠 High: serious authorization/integrity issue, broken production path, or state corruption risk.
- 🟡 Medium: griefing, operational hazard, missing hardening, or design mismatch.
- 🟢 Low: code smell, documentation gap, UX ambiguity, or future hardening item.

---

# Part I — Smart Contracts

## 🔴 CRITICAL-1: `SessionLedger.closeSession()` signer verification is a dead stub

File: `contracts/src/SessionLedger.sol`, lines 103–117

```solidity
address signer = ecrecover(digest, v, r, s);
require(signer != address(0), "Invalid signature");
// TODO: lookup gameRegistry.games[sess.gameId].devWallet == signer
//       (GameRegistry.sol is not yet wired — stub for the integration phase).
```

### Impact

Any player can submit arbitrary final score/kills/survival time for any open session, as long as they provide any well-formed ECDSA signature from any private key. The code only checks that `ecrecover` did not return `address(0)`; it never checks that the recovered signer is authorized.

This collapses the ranked integrity model.

### Additional missing guard

`closeSession()` also does not enforce that the caller is the session owner. Anyone can close anyone else's open session if they know the `sessionId`.

### Remediation

Add an interface for `GameRegistry.getGame()` and verify the recovered signer:

```solidity
import {IGameRegistry} from "./interfaces/IGameRegistry.sol";

address signer = ecrecover(digest, v, r, s);
require(signer != address(0), "Invalid signature");

IGameRegistry registry = IGameRegistry(gameRegistry);
address expectedSigner = registry.getGame(sess.gameId).devWallet;
require(signer == expectedSigner, "Unauthorized signer");
require(msg.sender == sess.player, "Not the session owner");
```

Also consider using OpenZeppelin `ECDSA.recover` instead of raw `ecrecover` to reject malleable signatures and invalid `s` values.

---

## 🔴 CRITICAL-2: `PaymentRouter.setDefaultVaults()` has no access control

File: `contracts/src/PaymentRouter.sol`, lines 49–58

```solidity
function setDefaultVaults(
    address devVault,
    address platformVault,
    address liquidityVault,
    address treasuryVault
) external {
    // TODO: restrict to operator via owner modifier
    defaults = SplitDestinations(devVault, platformVault, liquidityVault, treasuryVault);
}
```

### Impact

Anyone can redirect the default vaults. If `PaymentRouter` is used with real USDC or another real token, an attacker can set all vaults to attacker-controlled addresses before settlement, redirecting dev/platform/liquidity/treasury revenue.

### Remediation

Use OpenZeppelin `Ownable`/`AccessControl`, or a minimal operator guard:

```solidity
address public operator;

modifier onlyOperator() {
    require(msg.sender == operator, "Only operator");
    _;
}

constructor(address _gameRegistry, address _sessionLedger, address _token, address _operator) {
    require(_operator != address(0), "BAD_OPERATOR");
    gameRegistry = _gameRegistry;
    sessionLedger = _sessionLedger;
    token = _token;
    operator = _operator;
}

function setDefaultVaults(...) external onlyOperator {
    require(devVault != address(0), "BAD_DEV_VAULT");
    require(platformVault != address(0), "BAD_PLATFORM_VAULT");
    require(liquidityVault != address(0), "BAD_LIQUIDITY_VAULT");
    require(treasuryVault != address(0), "BAD_TREASURY_VAULT");
    defaults = SplitDestinations(devVault, platformVault, liquidityVault, treasuryVault);
}
```

---

## 🔴 CRITICAL-3: `ArcadePaymentRouter.startPaidSession()` uses caller-controlled split config and token

File: `contracts/src/ArcadePaymentRouter.sol`, lines 49–86

The function accepts:

```solidity
IERC20Like paymentToken,
uint256 amount,
uint256 settlementGasUsed,
SplitConfig calldata split
```

and routes funds to `split.*` destinations provided by the transaction caller.

### Impact

The contract does not enforce:

- allowed caller/operator/session ledger,
- canonical payment token,
- registered game,
- canonical split destinations,
- canonical split basis points from `GameRegistry`.

This means the on-chain router does not encode the platform's revenue rules. A user or compromised UI can route payments to arbitrary recipients while still emitting plausible `PaidSessionStarted` / `RevenueRouted` events.

### Remediation

Choose one of two models:

1. **Operator/ledger-mediated routing:** only an authorized `SessionLedger` or settlement operator can call `startPaidSession()`.
2. **Player-signed direct routing:** player can call it, but the router must derive token, split bps, and destinations from trusted on-chain registry state, not calldata.

Recommended shape:

```solidity
address public operator;
address public gameRegistry;
address public allowedPaymentToken;

modifier onlyOperator() {
    require(msg.sender == operator, "Only operator");
    _;
}
```

Then remove `SplitConfig calldata split` from public calldata and read the split from `GameRegistry`.

---

## 🔴 CRITICAL-4: `SessionLedger.settle()` transfers funds but never calls `PaymentRouter.splitAndDisburse()`

File: `contracts/src/SessionLedger.sol`, lines 130–138

```solidity
IERC20(entryToken).transfer(paymentRouter, sess.entryFee);
sess.settled = true;
emit SessionSettled(sessionId);
```

### Impact

The function sends tokens to `paymentRouter` but never calls `PaymentRouter.splitAndDisburse(gameId, player, amount)`. If the configured `paymentRouter` is actually `PaymentRouter`, the funds land there and remain idle until something else calls a split function — but only `SessionLedger` can call `splitAndDisburse`, and `SessionLedger` already marked the session settled.

If the configured `paymentRouter` is `ArcadePaymentRouter` (as the deploy script currently does), the tokens are sent to a contract that has no pull/split callback for this path. Funds are effectively stranded in the router contract.

### Evidence

`SessionLedger.settle()` only transfers and marks settled. `PaymentRouter.splitAndDisburse()` has `onlyLedger`, but `SessionLedger` never invokes it.

### Remediation

Use one canonical path. If preserving `SessionLedger + PaymentRouter`, then:

```solidity
IERC20(entryToken).approve(paymentRouter, sess.entryFee); // or transfer then call if router uses balance
IPaymentRouter(paymentRouter).splitAndDisburse(sess.gameId, sess.player, sess.entryFee);
sess.settled = true;
```

Better: have `PaymentRouter.splitAndDisburse()` pull or receive within the same call and make the settlement atomic.

---

## 🟠 HIGH-1: Deployment script wires `SessionLedger` to the wrong router type

File: `scripts/deploy-contracts.mjs`, lines 183–194

```js
const sessionLedger = await sessionLedgerFactory.deploy(
  addresses.gameRegistry,
  addresses.arcadePaymentRouter,
  deployer.address, // placeholder entry token
);
```

### Problem

`SessionLedger` expects `paymentRouter` to be the router used by its settlement path. The only contract with `splitAndDisburse()` is `PaymentRouter`, but the deployment script deploys `ArcadePaymentRouter` and passes that address into `SessionLedger`.

This reinforces the architecture split:

- `PaymentRouter` exists but is not deployed by the script.
- `ArcadePaymentRouter` is deployed but is not compatible with `SessionLedger.settle()`.
- `SessionLedger.settle()` sends funds but does not call any routing function.

### Remediation

Pick one canonical settlement/payment architecture and remove or clearly deprecate the other. If deploying `SessionLedger`, deploy `PaymentRouter` with correct constructor args and call it atomically. If using `ScoreSubmissionRegistry + ArcadePaymentRouter`, remove `SessionLedger` from the live path until it is complete.

---

## 🟠 HIGH-2: `PaymentRouter` constructor creates a circular deployment problem

File: `contracts/src/PaymentRouter.sol`, lines 38–47

`PaymentRouter` requires `_sessionLedger` in its constructor, while `SessionLedger` requires `_paymentRouter` in its constructor. Without a post-deploy setter, CREATE2 precomputation, or a factory that can wire both safely, normal deployment cannot set both addresses correctly.

### Impact

This encourages placeholder/wrong wiring, which is already visible in `deploy-contracts.mjs`.

### Remediation

Options:

- Deploy via a factory that precomputes addresses.
- Add a one-time `setSessionLedger()` guarded by `onlyOperator`, with an immutable-style `require(sessionLedger == address(0))`.
- Collapse routing into `SessionLedger` if the MVP does not need a separate router.

---

## 🟠 HIGH-3: `SessionLedger.openSession()` collision guard is incorrect for active sessions

File: `contracts/src/SessionLedger.sol`, lines 70–72

```solidity
sessionId = keccak256(abi.encodePacked(msg.sender, gameId, block.timestamp, block.number));
require(!sessions[sessionId].closed, "Session collision");
```

### Problem

For a brand-new slot, `closed == false`. For an existing open session, `closed == false` too. Therefore this check does **not** reject collision with an already-open session. It only rejects collision with a closed session.

If the same player opens two sessions for the same game in the same block/timestamp, the derived `sessionId` can collide and the second write can overwrite the first active session while also pulling another entry fee.

### Remediation

Use a nonce or caller-supplied unique id, and check `openedAt == 0`:

```solidity
mapping(address => uint256) public nonces;

uint256 nonce = nonces[msg.sender]++;
sessionId = keccak256(abi.encodePacked(msg.sender, gameId, block.chainid, address(this), nonce));
require(sessions[sessionId].openedAt == 0, "Session collision");
```

---

## 🟠 HIGH-4: `ScoreSubmissionRegistry` has no proof of game participation or anti-cheat

File: `contracts/src/ScoreSubmissionRegistry.sol`, lines 12–14 and 63–111

The code acknowledges the gap:

```solidity
/// @dev Anti-cheat is a later layer (EIP-712 adapter signature);
///      for the testnet MVP any connected wallet can record
///      its own run against msg.sender.
```

### Impact

Anyone can call `submitSession()` with fabricated `sessionId`, `gameId`, score, kills, combo, survival time, boss id, and achievements. A bot can cheaply pollute the on-chain leaderboard.

The existing `scoresBySession[sessionId].exists` check prevents exact session id overwrites, but it does not prove that the session was real.

### Short-term remediation

Add an explicit replay mapping if preferred for clarity, but note the current `exists` flag already rejects duplicate `sessionId`:

```solidity
require(!scoresBySession[sessionId].exists, "SESSION_EXISTS");
```

More important short-term hardening:

- enforce registered/playable game via `GameRegistry`,
- cap `score`, `kills`, `maxCombo`, and `survivalSeconds` to plausible bounds,
- limit achievement count,
- optionally require a trusted verifier signature.

### Long-term remediation

Complete the `SessionLedger.closeSession()` EIP-712 path and have `ScoreSubmissionRegistry` accept only sessions proven by `SessionLedger`, or merge the score write into `SessionLedger.closeSession()`.

---

## 🟠 HIGH-5: `LestersArcadeCore` composition wrapper wiring is misleading/stale

File: `contracts/src/LestersArcadeCore.sol`, lines 30–36

```solidity
playerProfiles = new PlayerProfileRegistry();
gameRegistry = new GameRegistry(trustedVerifier);
paymentRouter = new ArcadePaymentRouter();
scoreSubmissions = new ScoreSubmissionRegistry();
achievements = new AchievementRegistry(trustedVerifier);
tournaments = new TournamentPool();
```

### Findings

- `ArcadePaymentRouter` has no operator/game registry/token configured.
- `ScoreSubmissionRegistry` currently has no constructor, so the earlier claim that the no-arg constructor makes it unreachable is stale for this commit. The real issue is that it is permissionless.
- `AchievementRegistry` expects a `sessionLedger` authorized caller, but receives `trustedVerifier`. That means only `trustedVerifier` can call `defineAchievement()` / `unlockFor()` through this wrapper deployment, not the actual ledger unless those are intentionally the same address.
- `TournamentPool.owner` becomes the `LestersArcadeCore` contract address, not the external deployer. Since `LestersArcadeCore` exposes no forwarding/admin methods, `createTournament()` is unreachable through the wrapper deployment.

### Remediation

Either:

- remove `LestersArcadeCore` from live deployment until it has real orchestration methods, or
- wire it as a proper factory/admin wrapper with forwarding functions and explicit ownership transfer.

If `TournamentPool` is deployed through the wrapper, add a constructor owner parameter to `TournamentPool` or have the core expose tournament admin methods.

---

## 🟠 HIGH-6: Two competing payment/settlement systems are both partially wired

Files:

- `contracts/src/SessionLedger.sol`
- `contracts/src/PaymentRouter.sol`
- `contracts/src/ScoreSubmissionRegistry.sol`
- `contracts/src/ArcadePaymentRouter.sol`
- `apps/portal/src/settlement.mjs`
- `apps/portal/src/litvm-chain-client.mjs`

### Path A: `SessionLedger + PaymentRouter`

Intended model:

1. `openSession()` pulls entry fee into escrow.
2. `closeSession()` verifies score signature.
3. `settle()` routes funds via `PaymentRouter`.

Current problems:

- signer verification is a stub,
- caller ownership not checked,
- `settle()` does not call `splitAndDisburse()`,
- deployment does not deploy/wire `PaymentRouter` correctly,
- `PaymentRouter` defaults are externally mutable.

### Path B: `ScoreSubmissionRegistry + ArcadePaymentRouter`

Current live/testnet runtime leans here:

- `settlement.mjs` has `SETTLEMENT_LIVE = true`, deployed addresses, and `submitSession` plan shape.
- `litvm-chain-client.mjs` submits directly to `ScoreSubmissionRegistry`.

Current problems:

- `ScoreSubmissionRegistry` is permissionless/no anti-cheat,
- `ArcadePaymentRouter` accepts caller-controlled split/token,
- settlement plan and live chain client are not equivalent.

### Remediation

Choose one canonical path for MVP:

- For **free testnet ranked**: use `ScoreSubmissionRegistry` but label it explicitly as testnet/trustless-beta and cap/flag suspicious submissions.
- For **paid ranked**: do not use either path with value until payment routing and score authorization are fixed.

---

## 🟡 MEDIUM-1: `GameRegistry` does not check `playable`/existence in settlement contracts

File: `contracts/src/GameRegistry.sol`; missing checks in `SessionLedger` / `ScoreSubmissionRegistry` / `ArcadePaymentRouter`

`GameRegistry` tracks `exists` and `playable`, but settlement and submission contracts do not enforce them.

### Impact

Scores and/or payments can reference unregistered or unplayable games. This can poison off-chain indexing and leaderboards.

### Remediation

Before accepting a session/payment/score:

```solidity
Game memory g = gameRegistry.getGame(gameId);
require(g.exists, "GAME_NOT_REGISTERED");
require(g.playable, "GAME_NOT_PLAYABLE");
```

---

## 🟡 MEDIUM-2: `GameRegistry.devWallet` is not proven/confirmed by the developer

File: `contracts/src/GameRegistry.sol`, line 59

```solidity
require(devWallet != address(0), "Invalid dev wallet");
```

### Impact

An operator typo or malicious registration can route future revenue/signature authority to the wrong wallet.

### Remediation

Require the dev wallet to confirm control before a game becomes playable:

```solidity
function confirmDevWallet(bytes32 gameId) external {
    require(msg.sender == games[gameId].devWallet, "NOT_DEV_WALLET");
    games[gameId].devWalletConfirmed = true;
}
```

Then require `devWalletConfirmed` in `setPlayable()`.

---

## 🟡 MEDIUM-3: `PlayerProfileRegistry` handle registration is front-runnable and not normalized

File: `contracts/src/PlayerProfileRegistry.sol`, lines 48–52

```solidity
bytes32 handle = keccak256(abi.encodePacked(displayName));
if (handleOwners[handle] != address(0) && handleOwners[handle] != msg.sender) {
    revert("Handle taken");
}
```

### Impact

- Valuable names can be sniped by mempool front-running.
- On-chain uniqueness is case/space sensitive, while frontend tests suggest case/space-insensitive uniqueness. For example, `Alice`, `alice`, and `Alice ` can become separate handles on-chain.
- Empty or very long names are accepted on-chain. The caller pays gas, but the UI/indexing layer can still be polluted.

### Remediation

For production:

- normalize handles before hashing,
- enforce length/charset bounds on-chain,
- optionally add commit-reveal for high-value handle registration.

---

## 🟡 MEDIUM-4: `TournamentPool` can receive funds but has no withdrawal/prize distribution path

File: `contracts/src/TournamentPool.sol`

`fundTournament()` accepts native token and increments `prizePool`, but there is no claim/withdraw/distribute/refund function.

### Impact

Any native token sent to tournaments is locked in the contract permanently unless future upgrade/migration mechanics exist.

### Remediation

Before real funds:

- add payout/claim/refund paths,
- define tournament finalization authority,
- add emergency rescue for accidental deposits, under a clearly documented trust model.

---

## 🟡 MEDIUM-5: Admin ownership lacks transfer/rotation paths

Files:

- `contracts/src/GameRegistry.sol`
- `contracts/src/TournamentPool.sol`

`GameRegistry.operator` and `TournamentPool.owner` are set once in constructors and cannot be transferred.

### Impact

Lost deployer key means permanent loss of admin ability. Compromised deployer key cannot be rotated away.

### Remediation

Use OpenZeppelin `Ownable2Step` / `AccessControl`, or add explicit two-step operator transfer.

---

## 🟢 LOW-1: `PaymentRouter` does not validate default vaults before routing

File: `contracts/src/PaymentRouter.sol`, lines 79–83

If defaults are unset, transfers to zero addresses may revert or burn depending on token behavior. This is likely to break settlement and complicate incident recovery.

### Remediation

Validate vaults at configuration time and/or before transfer.

---

## 🟢 LOW-2: `package.json` says `UNLICENSED`, but there is no `LICENSE` file

File: `package.json`, line 87

```json
"license": "UNLICENSED"
```

This is acceptable if intentionally closed/private. If the repo will be reused by third-party game developers or published as an SDK, add the intended license file before external reuse.

---

# Part II — JavaScript Runtime / Settlement

## 🟠 HIGH-7: `settlement.mjs` and `litvm-chain-client.mjs` are divergent live write paths

Files:

- `apps/portal/src/settlement.mjs`
- `apps/portal/src/litvm-chain-client.mjs`

### Evidence

`settlement.mjs` builds generic call plans with string `sessionId` / `gameId` values:

```js
args: Object.freeze({
  sessionId,
  gameId,
  score,
  ...
})
```

But `ScoreSubmissionRegistry.submitSession()` expects `bytes32` ids, and `litvm-chain-client.mjs` hashes ids before submission:

```js
const sessionId32 = await toBytes32Id(sessionId);
const gameId32 = await toBytes32Id(gameId);
```

### Impact

Depending on which live path is used, the same run may be encoded differently or fail ABI encoding. The generic `settleRun()` path also relies on an injected `sendTransaction` implementation, while `litvm-chain-client.mjs` directly instantiates contracts and enforces chain guard.

### Remediation

Make `litvm-chain-client.mjs` the only live chain-write layer, or make `settlement.mjs` produce ABI-ready typed arguments exactly as the chain client does. Tests should assert that the planned args are `bytes32` where contracts require `bytes32`.

---

## 🟠 HIGH-8: `SETTLEMENT_LIVE = true` while on-chain anti-cheat is absent

File: `apps/portal/src/settlement.mjs`, lines 22–27

```js
export const SETTLEMENT_LIVE = true;
```

### Impact

The repo explicitly treats settlement as live on LitVM testnet, but the deployed `ScoreSubmissionRegistry` accepts arbitrary scores. Even if entry fee is currently zero, this makes the public leaderboard trivially pollutable.

### Remediation

If this remains testnet-only, document the blast radius in UI/docs:

- score submissions are player-authored and not cheat-proof,
- testnet leaderboards may be reset,
- no real value should be attached.

For production, block live ranked submission until verifier/session proof is live.

---

## 🟡 MEDIUM-6: Leaderboard replay guard missing in `recordCadenceScore()`

File: `apps/portal/src/leaderboard-engine.mjs`, lines 96–102

```js
bucket.push({ ...baseRow });
bucket.sort((a, b) => b.score - a.score || a.recordedAt.localeCompare(b.recordedAt));
```

### Impact

If the same `sessionId` is processed twice due to retry, double-click, rehydration bug, or duplicate settlement callback, the same score can appear multiple times in cadence leaderboards.

### Remediation

```js
if (entry.sessionId && bucket.some((row) => row.sessionId === entry.sessionId)) {
  return keys;
}
```

Also dedupe `state.leaderboards[game.id]` and `state.settlements` in `arcade-core.mjs`.

---

## 🟡 MEDIUM-7: Flat leaderboard replay guard also missing

File: `apps/portal/src/arcade-core.mjs`, lines 4986–4989

```js
state.leaderboards[game.id].push(entry);
state.leaderboards[game.id].sort(...);
state.leaderboards[game.id] = state.leaderboards[game.id].slice(0, 10);
```

### Impact

Even if cadence boards are deduped, the legacy flat top-10 board can still duplicate a session.

### Remediation

Before pushing:

```js
if (!state.leaderboards[game.id].some((row) => row.sessionId === entry.sessionId)) {
  state.leaderboards[game.id].push(entry);
}
```

---

## 🟡 MEDIUM-8: Chain guard is present in `litvm-chain-client`, but not enforced by generic `settleRun()`

Files:

- `apps/portal/src/litvm-chain-client.mjs`, lines 93–97 and 130–133
- `apps/portal/src/settlement.mjs`, lines 239–248

### Finding

Good news: `submitRankedSession()` and `submitProfile()` do perform a live network check via `browserProvider.getNetwork()` before signing.

However, `settlement.mjs`'s generic `settleRun()` simply passes `chainId` into `sendTransaction()` and trusts the injected function to enforce it.

### Remediation

Either remove the generic live `settleRun()` path, or require the injected `sendTransaction` wrapper to perform a fresh `eth_chainId` / provider network check immediately before broadcasting.

---

## 🟡 MEDIUM-9: Cabinet postMessage transport uses wildcard target and limited source validation in harness/cabinet code

Files:

- `apps/portal/games/hard-money-heroes/main.mjs`, lines 6–8 and 21–27
- `apps/portal/dev/mock-parent-harness.html`, lines 57–82

### Findings

The cabinet posts to parent with `'*'`:

```js
window.parent?.postMessage(message, '*');
```

The cabinet accepts lifecycle commands from any message sender:

```js
window.addEventListener('message', (event) => {
  const command = event.data?.command ?? event.data?.type;
  ...
});
```

The mock parent harness logs incoming messages without checking `event.source === frame.contentWindow`.

The pure SDK parser validates message shape/source tag/game id, which is good, but the runtime/harness should also validate browser-level source/origin where possible.

### Remediation

- Parent side: reject unless `event.source === sandboxedIframe.contentWindow`.
- Cabinet side: accept commands only from the expected parent origin where feasible.
- Use a specific `targetOrigin` instead of `'*'` for same-origin cabinets.

---

## 🟢 LOW-3: `hexHash()` simulated tx hashes look like real transaction hashes

File: `apps/portal/src/settlement.mjs`, lines 49–63

The simulated hash is deterministic and 0x-prefixed, visually indistinguishable from an EVM tx hash.

### Remediation

Use a distinct field/prefix:

- `simulatedTxHash: "sim:..."`, or
- keep `txHash` null and store the simulated id separately.

---

## 🟢 LOW-4: Sandbox CSP permits inline styles

File: `apps/portal/src/arcade-sandbox.mjs`, line 52

```js
styleSrc: "'self' 'unsafe-inline'",
```

Not a launch blocker for first-party code, but before third-party cabinets, migrate toward nonce/hash-based styles or external stylesheets only.

---

## 🟢 LOW-5: `manifestChecksum()` is non-cryptographic and not anchored on-chain

File: `apps/portal/src/game-manifest.mjs`, lines 159–184

The function is a 32-bit FNV-1a checksum and is currently only an off-chain drift marker.

### Impact

It is useful for accidental drift detection, but not for adversarial tamper resistance.

### Remediation

Use `keccak256`/SHA-256 for a real manifest digest and add it to `GameRegistry` at registration time.

---

# Part III — Testing / CI Gaps

## 🟡 MEDIUM-10: `contracts:check` is structural, not security/invariant testing

File: `scripts/contract-structure-check.mjs`

The script checks for required strings and SPDX/pragma only. It does not catch:

- missing access control,
- stubbed signer verification,
- wrong router wiring,
- settlement funds not being split,
- wrapper ownership mistakes.

### Remediation

Add contract tests with Hardhat/Foundry or solc + an EVM test runner for at least:

- unauthorized `setDefaultVaults()` reverts,
- unauthorized/incorrect `closeSession()` signature reverts,
- non-player cannot close a session,
- session id collision cannot overwrite active session,
- settlement atomically routes funds to expected vaults,
- `ScoreSubmissionRegistry` rejects unregistered/unplayable games,
- wrapper deployment leaves admin functions callable by intended owner.

---

## 🟡 MEDIUM-11: Deploy script prints a private-key fragment

File: `scripts/deploy-contracts.mjs`, line 57

```js
console.log(`Deployer: ${DEPLOYER_PRIVATE_KEY.slice(0, 6)}...${DEPLOYER_PRIVATE_KEY.slice(-4)}`);
```

### Impact

This is not enough to recover a key, but logging any part of a private key is poor operational hygiene and can create unnecessary leakage in CI logs/screenshares.

### Remediation

Print the derived deployer address only:

```js
console.log(`Deployer address: ${deployer.address}`);
```

---

# Part IV — Prioritized Remediation Roadmap

## P0 — Before real funds or production-ranked launch

1. Complete `SessionLedger.closeSession()` signer authorization and player ownership checks.
2. Add access control to `PaymentRouter.setDefaultVaults()`.
3. Remove caller-controlled split/token from `ArcadePaymentRouter`, or restrict it to an authorized operator/ledger.
4. Choose one canonical payment/settlement path.
5. Fix `SessionLedger.settle()` so funds are atomically split, not merely transferred to a router.
6. Add proof-of-play / verifier signature / session-ledger gating for ranked scores.
7. Add contract tests for the above invariants.

## P1 — Before broader testnet campaign

1. Fix deployment wiring: deploy only the chosen path and wire constructor/admin addresses correctly.
2. Fix `LestersArcadeCore` ownership/wrapper issues or remove it from deployment.
3. Dedupe flat and cadence leaderboards by `sessionId`.
4. Make `settlement.mjs` and `litvm-chain-client.mjs` one coherent write path.
5. Enforce `GameRegistry.exists && playable` before accepting scores/payments.
6. Add score/stat/achievement bounds to stop obvious pollution.

## P2 — Before third-party cabinets

1. Add browser-level `postMessage` `event.source` / `origin` checks.
2. Replace wildcard `postMessage('*')` where same-origin target is known.
3. Move sandbox CSP away from `unsafe-inline` styles.
4. Anchor cryptographic manifest hashes on-chain.
5. Publish a clear third-party license if the SDK/repo is intended for reuse.

## P3 — Operational hardening

1. Add two-step ownership/operator transfer.
2. Add tournament prize distribution/refund paths.
3. Stop logging private-key fragments in deployment scripts.
4. Document testnet leaderboard reset policy and current anti-cheat limitations.

---

# Part V — What Is Working Well

- The parent-shell / child-cabinet split is directionally sound.
- `arcade-sdk.mjs` has good pure validation primitives and a clean capability model.
- `litvm-chain-client.mjs` does a real chain check before direct score/profile writes.
- The sandbox avoids `allow-same-origin`, which is the right default for untrusted cabinet code.
- The repo has broad automated tests, strong design docs, and a clear build/check culture.
- `AchievementRegistry.unlockFor()` is idempotent.
- Cadence-bucketed leaderboards are a sensible product mechanic.
- The manifest/checksum idea is good, even though it needs cryptographic/on-chain hardening.

---

# Appendix — Key Fix Snippets

## A. `SessionLedger.closeSession()` signer + owner check

```solidity
import {IGameRegistry} from "./interfaces/IGameRegistry.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

require(msg.sender == sess.player, "Not the session owner");

bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
address signer = ECDSA.recover(digest, v, r, s);

IGameRegistry registry = IGameRegistry(gameRegistry);
address expectedSigner = registry.getGame(sess.gameId).devWallet;
require(signer == expectedSigner, "Unauthorized signer");
```

## B. `PaymentRouter.setDefaultVaults()` access control

```solidity
address public operator;

modifier onlyOperator() {
    require(msg.sender == operator, "Only operator");
    _;
}

function setDefaultVaults(...) external onlyOperator {
    require(devVault != address(0), "BAD_DEV_VAULT");
    require(platformVault != address(0), "BAD_PLATFORM_VAULT");
    require(liquidityVault != address(0), "BAD_LIQUIDITY_VAULT");
    require(treasuryVault != address(0), "BAD_TREASURY_VAULT");
    defaults = SplitDestinations(devVault, platformVault, liquidityVault, treasuryVault);
}
```

## C. `SessionLedger.openSession()` collision-safe ids

```solidity
mapping(address => uint256) public nonces;

uint256 nonce = nonces[msg.sender]++;
sessionId = keccak256(abi.encodePacked(
    block.chainid,
    address(this),
    msg.sender,
    gameId,
    nonce
));
require(sessions[sessionId].openedAt == 0, "Session collision");
```

## D. JS leaderboard replay guard

```js
if (entry.sessionId && bucket.some((row) => row.sessionId === entry.sessionId)) {
  return keys;
}
```

## E. Browser-level postMessage source validation

```js
window.addEventListener('message', (event) => {
  if (event.source !== sandboxedIframe.contentWindow) return;
  const parsed = parseInboundMessage(event.data, { expectedGameId });
  if (!parsed.valid) return;
  // handle parsed.message
});
```
