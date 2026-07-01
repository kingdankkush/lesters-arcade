# Hard Money Heroes AAA Roguelike Completion Handoff

> **Audience:** high-end programming/reasoning model such as Fable, Mythos, Sonnet 5, or equivalent.  
> **Purpose:** turn Hard Money Heroes from the current browser prototype into a fully fleshed, high-quality isometric roguelike / roguelite arcade game for Lester's Arcade, using MetaMask/Rabby EVM wallets on LitVM LiteForge testnet.  
> **Repo:** `kingdankkush/lesters-arcade`  
> **Primary local clone:** `C:/Users/just_/lesters-arcade`  
> **Production site:** `https://lestersarcade.io`  
> **Auto-deploy:** `git push origin main` deploys to Vercel and updates production.

---

## 0. How to use this document

This is a strategic and implementation handoff. It intentionally covers **everything left to do**, not just the next tiny patch.

The next model should:

1. Read this file end-to-end.
2. Read `AGENTS.md` before changing anything.
3. Read the current repo source before trusting any older doc, because this project has moved quickly and some docs are stale.
4. Prioritize Level 1 quality and the full HMH gameplay loop before expanding content.
5. Treat all smart-contract, wallet, payment, and deployment work as gated and security-sensitive.
6. Use tests, browser screenshots, and real local execution before claiming anything is fixed.
7. Commit incrementally.
8. **Do not push live without Justin's explicit approval.**

This document is intentionally blunt: the current Level 1 world and many enemy sprites/animations are not good enough. The playable hero characters are closer to the quality target than the enemies and environment. The game needs a real art direction, a coherent world-building pass, a gameplay systems pass, and a Web3/security audit pass.

---

## 1. Product goal

Build **Hard Money Heroes** into a fully playable browser-based isometric roguelike / roguelite arcade game inside **Lester's Arcade**.

### Target player experience

A user should be able to:

1. Open `https://lestersarcade.io`.
2. Connect MetaMask, Rabby, or another EVM wallet.
3. Add/switch to **LitVM LiteForge testnet** if needed.
4. Enter Lester's Arcade.
5. Select the Hard Money Heroes arcade cabinet.
6. Choose Free Mode or Ranked Mode.
7. Choose a playable hero.
8. Play a polished isometric roguelike run with clear controls, enemies, upgrades, bosses, level progression, effects, and rewards.
9. Level up during the run through XP and power-ups.
10. Unlock achievements and character/content progression.
11. In Ranked Mode, settle official score/achievements/session records to LitVM LiteForge testnet.
12. View profile, achievements, ranked history, and leaderboards.

### Design fantasy

**Hard Money Heroes** is a goofy-gritty crypto arcade action roguelike:

- Metal Slug-inspired arcade intensity.
- Hades/Bastion-like readable isometric combat spaces.
- Litecoin / sound-money / crypto-scam satire.
- Retro cabinet presentation inside Lester's Arcade.
- Fast browser play with Web3 rails in the background, not sluggish on-chain gameplay.

### Critical principle

**Gameplay stays off-chain.**  
Contracts handle identity, ranked receipts, score claims, achievements, game registry, tournaments, and revenue routing. The chain should not run real-time twitch gameplay.

---

## 2. Current repo facts that matter

### Active project identity

From `AGENTS.md` and repo docs:

- Lester's Arcade is the parent Web3 arcade portal.
- Hard Money Heroes is the first playable cabinet game.
- The portal uses EVM wallets for identity.
- LitVM LiteForge is the current testnet target.
- Free Mode is practice-only.
- Ranked Mode is the official on-chain/progress path.
- Production deploys happen from `main` through Vercel.

### Current live/deployment state

Recent production commits before this handoff:

- `378c77cb Use neutral Level 1 loading backdrop`
- `43456310 Author Level 1 opening runtime composition`
- `a987459a Use curated visible runtime for Level 1`

The current local repo may be ahead of production with planning docs. Check with:

```bash
git status -sb --untracked-files=normal
git log --oneline --decorate -5
```

### Verification commands

Use these gates before handoff or deployment:

```bash
npm run assets:verify
npm test
npm run check
npm run contracts:check
npm run smoke:portal:interactions
npm run contracts:compile
```

For Vercel deployment readiness:

```bash
npm run vercel:build
```

For broader repo-level verification, the project has:

```bash
npm run verify:full
```

Always inspect `package.json` for the latest script list before relying on this doc.

### Browser smoke rule

For local browser testing, serve `apps/portal` as the web root:

```bash
cd apps/portal
python -m http.server 8791
```

Then open:

```text
http://127.0.0.1:8791/
```

Do **not** serve the repo root and browse `/apps/portal/`; the app uses root-relative paths and that can create misleading failures.

---

## 3. Network and wallet configuration

Current LiteForge config from `apps/portal/src/arcade-core.mjs`:

```js
export const LITVM_LITEFORGE_NETWORK = Object.freeze({
  name: 'LitVM LiteForge',
  status: 'public-testnet',
  chainId: 4441,
  chainIdHex: '0x1159',
  nativeCurrency: {
    name: 'zkLTC',
    symbol: 'zkLTC',
    decimals: 18,
  },
  rpcUrls: {
    http: 'https://liteforge.rpc.caldera.xyz/http',
    websocket: 'wss://liteforge.rpc.caldera.xyz/ws',
  },
  explorerUrl: 'https://liteforge.explorer.caldera.xyz',
  faucetUrl: 'https://liteforge.hub.caldera.xyz',
  portalUrl: 'https://testnet.litvm.com',
});
```

Wallet targets:

- MetaMask
- Rabby
- EIP-6963 multi-wallet discovery
- Mock wallet only for offline QA, never official ranked boards

Wallet user-flow requirements:

1. Detect injected wallets robustly.
2. Handle multiple wallets.
3. Handle no wallet installed.
4. Handle declined connect request.
5. Handle wrong chain.
6. Offer add/switch LiteForge chain.
7. Require SIWE-style signature or equivalent for real identity binding.
8. Keep guest browsing possible.
9. Never ask for private keys in the web UI or in chat.

Known critical pitfall from previous work:

- The splash screen **Connect Wallet** button should call `connectOfficialWallet()`, not low-level `connectWallet()` directly. The wrapper changes app step after connection. If users report “wallet connects but nothing happens,” inspect that first.

---

## 4. Current smart-contract deployment info

Source: `contracts/deployment-record.json` and `apps/portal/src/settlement.mjs`.

### Network

```json
{
  "network": "LitVM LiteForge Testnet",
  "chainId": 4441,
  "deployedAt": "2026-06-22T21:54:23.846Z",
  "deployer": "0x24501ad94A9245DC88Fb9546929cDA10b91420d4"
}
```

### Deployed addresses

```json
{
  "playerProfileRegistry": "0x5ba410d2A0ccCc00D070d0C45Dc7102e0FfABe96",
  "gameRegistry": "0x09C6f94e73f6aA16177549952Dc47dB5AEb83406",
  "arcadePaymentRouter": "0x7c999E9570D44090b9279dbAbE33B361e94bf78B",
  "scoreSubmissionRegistry": "0x7C05C9596c6c77302ae0479B1Db550E9baD1acf0",
  "sessionLedger": "0x699c2313884A68B7dfCffC01337eB429b6609798",
  "achievementRegistry": "0xc7b8Efc844E66FB4E3eEb9dB2c1f436F4cF86c53",
  "tournamentPool": "0xbc88DFBaaA82D0F0Cce356924e619f9DCBD17c66",
  "lestersArcadeCore": "0x609CBED352699003dec2381a79EFe5090B56F1D2"
}
```

### Important wallets

Known from repo config / deployment memory:

- Deployer / trusted verifier: `0x24501ad94A9245DC88Fb9546929cDA10b91420d4`
- Justin revenue wallet: `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26`

Current revenue config from `arcade-core.mjs`:

```js
export const DEFAULT_REVENUE_SPLIT_BPS = Object.freeze({
  settlement: 1500,  // 15% reserved for settlement gas
  dev: 5500,         // 55% to dev wallet
  tournament: 1800,  // 18% tournament prize pools
  community: 1200,   // 12% community building
});
```

Current testnet ranked entry:

```js
export const DEFAULT_ENTRY_FEE_MICRO_USDC = 0;
```

Meaning: Ranked mode is free on testnet except for zkLTC gas.

### Current settlement flag

From `apps/portal/src/settlement.mjs`:

```js
export const SETTLEMENT_LIVE = true;
```

The comment says settlement is live on testnet. However, the live settlement path still requires a real `sendTransaction` function injected by the frontend. Audit the actual UI/runtime path before assuming ranked settlement is fully user-working.

### Settlement plan currently does

`buildSettlementPlan(...)` builds calls for:

- `playerProfileRegistry.updateProfile`
- `scoreSubmissionRegistry.submitScore`
- `achievementRegistry.unlockAchievement`
- `arcadePaymentRouter.routeRevenueSplit` when entry fees are positive

`settleRun(...)` supports:

- `live = true`: calls injected `sendTransaction(...)`
- `live = false`: deterministic simulated receipts

Audit whether the live path is correctly wired to wallet transactions and contract ABIs. A plan object is not the same as verified live settlement UX.

---

## 5. Contract source inventory

Source directory:

```text
contracts/src/
```

Current Solidity source files:

```text
contracts/src/interfaces/IERC20.sol
contracts/src/PlayerProfileRegistry.sol
contracts/src/GameRegistry.sol
contracts/src/ArcadePaymentRouter.sol
contracts/src/ScoreSubmissionRegistry.sol
contracts/src/SessionLedger.sol
contracts/src/AchievementRegistry.sol
contracts/src/PaymentRouter.sol
contracts/src/TournamentPool.sol
contracts/src/LestersArcadeCore.sol
```

Compiled artifacts:

```text
contracts/artifacts/*.json
```

Deployment record:

```text
contracts/deployment-record.json
```

### Contract summary extracted from current Solidity sources

#### `PlayerProfileRegistry.sol`

Functions:

- `registerProfile`
- `updateProfile`
- `setProfile`
- `_writeProfile`
- `getProfile`

Events:

- `ProfileCreated`
- `ProfileUpdated`
- `HandleReserved`

Audit focus:

- handle uniqueness
- profile overwrites
- string length bounds
- event coverage
- access control around `setProfile`
- privacy and indexing implications

#### `GameRegistry.sol`

Functions:

- `registerGame`
- `setPlayable`
- `updateFeeSplit`
- `getGame`
- `registeredGameCount`

Events:

- `GameRegistered`
- `GameStatusChanged`
- `FeeSplitUpdated`

Modifier:

- `onlyOperator`

Audit focus:

- operator centralization
- fee split bounds / total bps validation
- game IDs immutability
- dev wallet update rules
- third-party creator registration flow

#### `ArcadePaymentRouter.sol`

Functions:

- `startPaidSession`
- `_route`
- `_totalBps`

Events:

- `PaidSessionStarted`
- `RevenueRouted`

Also includes `IERC20Like` interface.

Audit focus:

- token transfer safety
- reentrancy
- ERC20 return-value handling
- split recipient validation
- zero-fee ranked testnet behavior
- whether this overlaps/conflicts with `PaymentRouter.sol`

#### `PaymentRouter.sol`

Functions:

- `setDefaultVaults`
- `splitAndDisburse`

Event:

- `Split`

Modifier:

- `onlyLedger`

Audit focus:

- whether this is still used or superseded by `ArcadePaymentRouter`
- stale architecture docs vs current deployment
- reentrancy guard
- safe transfer handling
- vault update authority

#### `SessionLedger.sol`

Functions:

- `openSession`
- `closeSession`
- `settle`
- `getSession`
- `sessionCount`

Events:

- `SessionOpened`
- `SessionClosed`
- `SessionSettled`

Audit focus:

- session replay protection
- one-close / one-settle invariant
- score attestation verification
- player identity binding
- session timeout / abandon handling
- fee escrow correctness
- connection to `ScoreSubmissionRegistry`

#### `ScoreSubmissionRegistry.sol`

Functions:

- `submitSession`
- `getSession`
- `getSessionAchievements`
- `playerSessionCount`
- `getPlayerSessions`
- `totalSessions`
- `getRecentSessions`

Events:

- `ScoreSubmitted`
- `AchievementUnlocked`

Audit focus:

- trusted verifier authority
- duplicate session IDs
- score replay
- achievement replay
- leaderboard indexability
- bounds on arrays and strings
- whether the frontend currently calls `submitScore` while the contract actually exposes `submitSession` or vice versa

#### `AchievementRegistry.sol`

Functions:

- `defineAchievement`
- `unlockFor`
- `hasUnlocked`
- `achievementCount`

Events:

- `AchievementDefined`
- `AchievementUnlocked`

Modifier:

- `onlyLedger`

Audit focus:

- who can define achievements
- who can unlock achievements
- duplicate unlock prevention
- soulbound NFT requirement vs actual implementation
- whether achievements are ERC721/ERC1155 or just registry events/state

#### `TournamentPool.sol`

Functions:

- `createTournament`
- `fundTournament`

Events:

- `TournamentCreated`
- `TournamentFunded`

Modifier:

- `onlyOwner`

Audit focus:

- currently likely skeletal
- prize custody
- payout rules
- tournament close/finalize
- dispute handling
- cancellation/refunds

#### `LestersArcadeCore.sol`

Event:

- `ArcadeCoreDeployed`

Audit focus:

- verify what it actually aggregates
- architecture docs may overstate facade functionality
- ensure frontend uses the simplest safe contract surface

---

## 6. Smart-contract audit and improvement brief

The higher-end model should audit contracts as if this will eventually handle real value, even though current target is LiteForge testnet.

### 6.1 Mandatory audit questions

1. **Do source files match deployed artifacts?**
   - Confirm `contracts/artifacts/*.json` were compiled from current `contracts/src/*.sol`.
   - Confirm deployment addresses correspond to those artifacts.
   - If no explorer verification exists, add verification instructions.

2. **Do frontend method names match contracts?**
   - `settlement.mjs` currently plans `scoreSubmissionRegistry.submitScore`.
   - Source summary indicates `ScoreSubmissionRegistry.sol` exposes `submitSession`.
   - This mismatch must be verified and fixed if real.

3. **Is score submission secure?**
   - Use EIP-712 typed data.
   - Include `chainId`, contract address, gameId, sessionId, player address, score, kills, survival time, gameVersion, timestamp/deadline, and nonce.
   - Prevent cross-chain replay, cross-game replay, session replay, and stale submissions.

4. **Who is the trusted verifier?**
   - Current deployer/trusted verifier appears to be `0x24501ad94A9245DC88Fb9546929cDA10b91420d4`.
   - Decide whether this is safe for testnet only.
   - For production, use role separation: deployer, operator/admin, verifier, revenue wallet, treasury.

5. **Are free/ranked semantics clean?**
   - Free mode: no official score, no chain writes, no achievements unless intentionally local-only.
   - Ranked mode on testnet: free entry fee but pays zkLTC gas to settle.
   - Future paid mode: clear fee token and split semantics.

6. **Are revenue splits coherent?**
   - Current runtime split: 15% settlement, 55% dev, 18% tournament, 12% community.
   - Older docs mention 60/20/10/10 dev/platform/liquidity/treasury.
   - Reconcile docs, contract structs, frontend copy, and actual deployed config.

7. **Are token transfers safe?**
   - Use OpenZeppelin `SafeERC20` or equivalent.
   - Add reentrancy protection where funds move.
   - Handle zero-fee testnet sessions correctly.

8. **Are admin controls acceptable?**
   - Replace single `onlyOperator` / `onlyOwner` with role-based access before real funds.
   - Add emergency pause.
   - Add upgrade/migration plan or explicitly choose non-upgradeable simplicity.

9. **Is upgradeability actually implemented?**
   - `contracts/ARCHITECTURE.md` mentions proxy pattern, but current source inventory does not obviously show proxies.
   - Do not claim proxy upgradeability unless it exists.

10. **Can leaderboards be read from chain efficiently?**
    - Need indexing strategy.
    - Events may be primary read path.
    - `getRecentSessions` may not be enough for daily/weekly/monthly/all-time leaderboards.

11. **Are achievements actually NFTs?**
    - Older docs say soulbound NFTs.
    - Current source summary looks like registry/state/events, not necessarily ERC721/ERC1155.
    - Decide desired direction and implement truthfully.

12. **Are gameVersion/siteVersion tracked?**
    - The repo uses `SITE_VERSION` and `GAME_VERSION` to filter leaderboards after deploys.
    - On-chain session records should include game version to avoid stale leaderboard pollution.

### 6.2 Contract improvement backlog

P0 before real user value:

- Fix ABI/method mismatches between frontend and Solidity.
- EIP-712 score/session attestation.
- Nonce/deadline/replay protection.
- Role separation.
- Pause controls.
- Safe token transfer / reentrancy protection.
- Explicit testnet vs production config.
- Contract integration tests beyond structure checks.
- Transaction receipt UX in frontend.
- Explorer links in user-visible ranked results.

P1:

- On-chain profile registry read path.
- Event/indexer-based leaderboards.
- Achievement metadata registry.
- Tournament pool finalize/refund/payout flow.
- Third-party game onboarding registry.
- Admin UI for game/cabinet registration.

P2:

- Soulbound achievement NFTs if still desired.
- Upgradeable contract system or explicit migration factory.
- Anti-cheat backend service.
- Replay upload / replay hash anchoring.
- ZK/proof-assisted validation, if practical.

---

## 7. Current game quality problem

The current HMH implementation has improved technically, but the visible game still does not meet the desired quality bar.

### What looks acceptable-ish

- Playable hero characters are closer to the desired quality bar than most other assets.
- Some cabinet / portal UI has a strong retro identity.
- Some runtime systems exist: combat loop, XP, upgrades, settlement planning, leaderboards, achievements, campaign metadata.

### What still looks bad or incomplete

- Level 1 world design still reads as weak/procedural in many places.
- Ground texture system is not coherent enough.
- World assets lack a unified isometric art grammar.
- Many enemy sprites look off-style or low quality.
- Enemy animations lack proper attack tells, hit reactions, and death readability.
- Bosses/minibosses are not at final quality.
- VFX and combat feedback are not yet arcade-quality.
- UI flow still needs full polish and wallet robustness.
- Game mechanics need a full fun/balance pass.
- Level progression, XP, achievements, power-ups, and run structure need deeper integration.
- Smart contracts need audit and frontend integration review.

---

## 8. Target Level 1 artistic direction

The previous Level 1 artistic plan is saved at:

```text
docs/plans/2026-07-01-level-1-artistic-world-and-asset-plan.md
```

Use that as the Level 1 art/world source brief.

### Working style ID

```text
level1-isometric-metal-slug-crypto-wasteland-v1
```

### Visual target

- Isometric 2:1 pixel art discipline.
- Metal Slug object density and charm.
- Hades/Bastion-like combat readability.
- Dusty crypto ghost town / desert highway / river bridge / busted farmstead / boss extraction yard.
- Chunky readable silhouettes.
- Clear roads and lanes.
- Limited prop density, not random scatter.
- Teal/Litecoin/cyan accents for helpful/readable objects.
- Orange/red/purple/green corruption accents for hazards and enemies.

### Level 1 route target

1. Spawn: Broken Highway / Litecoin Bus Stop.
2. Gas Station Forecourt Arena.
3. Ghost Town Main Street.
4. Farmstead Side Loop.
5. River Bridge / Wash Crossing.
6. Desert Boulder Road / Mesa Cut.
7. Extraction Yard / Boss Arena.

### Roguelike model

Use a hybrid authored/procedural model:

```text
fixed macro route
+ handcrafted chunk variants
+ deterministic per-run selection
+ authored spawn slots
+ authored reward slots
+ authored hazard/interactable slots
+ controlled dressing allowlists
```

Do not use global random scatter as the main art direction.

---

## 9. Asset production backlog

### 9.1 Ground textures and terrain

P0 ground kit:

- Dust flat tiles.
- Dust pebble variants.
- Dry grass.
- Dirt/grass transitions.
- Rocky shoulder tiles.
- Town dust / boardwalk underlay.
- Scorched boss-yard ground.
- Road-to-dirt transitions.
- Road-to-grass transitions.
- Road-to-town-plaza transitions.

Requirements:

- 2:1 isometric alignment.
- Seamless enough in 3x3 contact sheets.
- Low visual noise under sprites.
- Runtime selector chooses by authored zone role.
- No checkerboarding.

### 9.2 Roads and paths

P0 road kit:

- Straight asphalt in both iso orientations.
- Dirt road in both iso orientations.
- Curves.
- T-junctions.
- Crossroads.
- Cracked asphalt variants.
- Painted center-line variants.
- Broken lane paint.
- Road shoulders.
- Pothole/debris decals.
- Gas station concrete forecourt.
- Combat arena plaza tile.
- Boss-yard cracked blacktop.

### 9.3 Water and bridge kit

P0/P1:

- Animated river water.
- Animated lake water.
- Shallow ford.
- Muddy shoreline transitions.
- Sand/beach transitions.
- Water rocks.
- Current/foam highlight.
- Wooden bridge center/caps/rails.
- Broken bridge rail.
- Bridge shadow.
- Bridge barricade/destructible rail.

### 9.4 Boundaries and blockers

P0:

- Mesa cliff walls: straight/corner variants.
- Dirt embankments.
- Boulder walls.
- Cactus barrier lines.
- Broken fences.
- Guardrails.
- Junk/tire/wrecked-car barricades.
- Building-wall boundary rows.
- Riverbank cliff edge.
- Extraction-yard fence/gate.

### 9.5 Landmarks

P0:

- Gas station canopy.
- Gas pump cluster.
- Saloon front.
- Boarded bank.
- General store.
- Farmhouse.
- Barn.
- Silo.
- River bridge.
- Mesa cliff gate.
- Boss-yard gate.
- Extraction beacon.

Landmarks must have unique silhouettes and should guide the player.

### 9.6 Modular town/farm kit

P0/P1:

- Storefront wall segments.
- Boardwalk pieces.
- Saloon modules.
- Bank modules.
- General store modules.
- Boarded windows/doors.
- Alley wall pieces.
- Roof edge/shadow pieces.
- Farmhouse.
- Barn.
- Silo.
- Crop rows.
- Fence/gate/broken fence.
- Hay bales.
- Water tank/well/trough.
- Tractor/wrecked truck.

### 9.7 Props and set dressing

P1:

- Barrels.
- Crates.
- Road signs.
- Tires/cones.
- Trash piles, but controlled.
- Shrubs/cactus/tumbleweed.
- Benches.
- Bus stop sign.
- Mailbox.
- Wanted posters.
- Crypto scam signs.
- Litecoin caches.
- Upgrade shrine.
- Vending machine.
- Arcade cabinet, correctly scaled.

### 9.8 Interactives/destructibles

P1:

- Explosive barrel: idle/fuse/explode/debris.
- Gas pump: idle/damaged/leak/explosion.
- Road flare.
- Barricade states.
- Bridge rail states.
- Boss gate states.
- Loot cache states.
- Upgrade shrine states.
- Crypto terminal states.

### 9.9 VFX

P1:

- Hero muzzle flashes.
- Bullet tracers.
- Enemy hit sparks.
- Armor hit sparks.
- Blood/gore optional effects.
- Enemy death burst.
- Grenade explosion.
- Barrel explosion.
- Shockwave ring.
- Pickup glint.
- Boss telegraph markers.
- Extraction beam.

### 9.10 Ambient world animation

P1/P2:

- Water loops.
- Neon sign flicker.
- Wind-blown signs.
- Dust devils.
- Tumbleweed.
- Fire/smoke.
- Sparks from terminals.
- Coin glints.
- Extraction beacon pulse.

---

## 10. Enemy art and animation rebuild

The enemy art needs a decisive production pass.

### 10.1 Quality bar

Every core enemy should have:

- 8-direction idle.
- 8-direction walk/run.
- 8-direction attack-tell / wind-up.
- 8-direction attack.
- 8-direction hit/stagger.
- 8-direction death.
- Distinct silhouette.
- Distinct palette accent.
- Clear hitbox/hurtbox metadata.
- Attack tells that are visible before damage.
- Death state that reads cleanly at gameplay scale.

### 10.2 P0 Level 1 enemies

Rebuild or replace these first:

1. FUD Goblin / Scam Gremlin.
2. Crypto Bro Rusher.
3. Claim Jumper Bandit.
4. Evil Banker / Repo Shooter.
5. Coyote Pack Runner.
6. Wild Boar Tank.
7. Buzzard / Vulture.
8. Rattlesnake / Rugpull Serpent.
9. Gas Station Mini-Boss: Rugpull Pump Brute.
10. Level 1 Boss: Chain Reaper / Repo Baron or Rug Pull Baron.

### 10.3 Enemy rejection criteria

Reject enemy sprites if:

- wrong camera angle,
- muddy silhouette,
- no attack anticipation,
- colors disappear into ground,
- lower quality than playable heroes,
- one-direction only,
- old zombie/goblin placeholder look,
- off-style AI-generated artifacts,
- no consistent outline/shadow language.

### 10.4 Animation timing target

- Idle: 2-4 frames, 300-500ms/frame.
- Walk: 4-6 frames, 100-150ms/frame.
- Run: 6-8 frames, 60-100ms/frame.
- Attack tell: 1-2 frames, visibly held.
- Attack impact: 1-2 frames, 120-200ms hold.
- Recovery: 1-2 frames.
- Death: 4-8 frames or sprite + VFX burst.

---

## 11. Playable characters

Current playable canon:

- Lit Commando — starter.
- Lit Valkyrie — starter.
- Lester Original — unlock after Level 1 clear.
- Lilly — unlock after 10 ranked matches.
- Max Mempool is removed from active playable canon.

Important repo pitfall:

- Runtime character select uses `HERO_ROSTER_BASE` in `main.js`, not just `LESTER_BLASTER_CHARACTER_ROSTER` in `arcade-core.mjs`.
- Any playable roster change must update both data and visible runtime roster.

Hero work remaining:

1. Audit every hero state/direction in the actual runtime animated roster.
2. Ensure movement, shooting, melee, grenade throw, hurt, death, level-up, idle, and victory states are cohesive.
3. Ensure hero VFX attaches to barrels/hands/weapons correctly by direction.
4. Make locked/unlocked cards clear in UI.
5. Make character stats meaningful and connected to mechanics.

---

## 12. Core gameplay systems to complete

### 12.1 Movement and physics

Needs:

- Smooth isometric movement.
- Collision that matches visible blockers.
- No water/obstacle spawn bugs.
- Dash/dodge or equivalent if it improves feel.
- Knockback and hit stun tuning.
- Enemy/player speed caps.
- Controller/mobile equivalent controls.
- Deterministic simulation boundary for ranked validation.

Audit files:

```text
apps/portal/main.js
apps/portal/src/enemy-steering.mjs
apps/portal/src/combat-damage.mjs
apps/portal/src/world-obstacles.mjs
apps/portal/src/hmh-combat-balance.mjs
```

### 12.2 Combat

Needs:

- Clear player weapon identity.
- Better muzzle flashes.
- Better enemy hit feedback.
- Better grenade feel.
- Destructible props.
- Environmental kills.
- Boss telegraphs.
- Status effects if useful.
- Clean separation between player projectiles, enemy projectiles, hazards, pickups, and ambient particles.

### 12.3 Enemy AI

Needs:

- Chaser behavior.
- Ranged behavior.
- Charger behavior.
- Flyer behavior.
- Area-denial behavior.
- Tank behavior.
- Boss phase behavior.
- POI-aware spawn slots and approach angles.
- No enemies spawning on top of the player.
- Melee enemies should not outrun baseline players unfairly.
- Ranged enemies should telegraph before shooting.

### 12.4 XP, leveling, upgrades

Needs:

- XP gems or pickups with clear attraction behavior.
- A satisfying leveling cadence.
- Upgrade cards that meaningfully change mechanics.
- Card rarity and build identity.
- Character-specific upgrades.
- Level-gated upgrades.
- No runaway early chain-leveling.
- Clear UI for level-up choices.
- Pause/run state correctness during upgrade selection.

Potential upgrade families:

- Weapon fire rate.
- Bullet damage.
- Bullet pierce.
- Grenade count/recharge.
- Movement speed.
- Dash cooldown.
- Shield / armor.
- XP magnet radius.
- Crit chance.
- Companion/drone.
- Elemental bullet effects.
- Litecoin blade/melee improvements.

### 12.5 Power-ups

Needs:

- Health pickups.
- Shield pickups.
- Grenade pickups.
- Score multiplier.
- Temporary fire-rate boost.
- Temporary invulnerability.
- Litecoin cache.
- Rare weapon pickup.
- Power-up drop rules by enemy/zone/boss.
- Visual clarity and pickup sound.

### 12.6 Achievements

Needs:

- Local/free-mode preview achievements if desired.
- Ranked/on-chain achievements for official progress.
- Achievement definitions in code and contracts.
- Achievement unlock UI.
- Achievement profile display.
- Replay-safe on-chain unlock logic.

Example achievement ideas:

- First Ranked Run.
- Clear Level 1.
- Unlock Lester.
- Beat Rug Pull Baron.
- Kill 100 enemies in one run.
- Clear gas station without taking damage.
- Destroy 10 scam terminals.
- Survive 8 minutes.
- Collect 100 Litecoin caches.
- Beat Level 1 with Lit Valkyrie.

### 12.7 Bosses

Needs:

- Level 1 mini-boss.
- Level 1 boss.
- Level 2 bosses/minibosses later.
- Distinct phase patterns.
- Telegraphs.
- Arenas designed for boss mechanics.
- Health bars.
- Intro/stinger.
- Death sequence.
- Rewards/unlocks.
- Achievement hooks.

Level 1 boss should be a real final encounter, not a regular enemy with more HP.

---

## 13. World and level design systems

### 13.1 Replace random scatter with authored chunks

Implement:

```text
apps/portal/src/hmh-level-one-art-direction.mjs
apps/portal/src/hmh-level-one-final-asset-requirements.mjs
apps/portal/src/hmh-level-one-authored-chunks.mjs
```

Each chunk should declare:

- id,
- zone,
- entry anchors,
- exit anchors,
- ground role map,
- route tiles,
- landmarks,
- boundaries,
- props,
- interactives,
- enemy slots,
- reward slots,
- camera/readability safe zone,
- required asset keys.

### 13.2 Required Level 1 chunks

- Spawn Broken Highway.
- Gas Station Arena.
- Ghost Town Main Street.
- Farmstead Side Loop.
- River Bridge.
- Desert Boulder Road.
- Extraction Yard / Boss Arena.

### 13.3 Runtime integration rules

1. Ground from final ground selector.
2. Boundaries from authored chunk metadata.
3. Landmarks from authored chunk metadata.
4. Props only from chunk allowlists.
5. Enemy spawns only from chunk slots + pressure director.
6. Rewards from chunk reward slots.
7. Interactives from chunk interactive slots.
8. Ambient animation capped and non-solid unless specified.
9. Old procedural scatter allowed only as fallback outside authored zones, never as the visible Level 1 base.

---

## 14. UI / UX work left

### 14.1 Global navigation

Needs:

- Persistent top nav.
- Back navigation everywhere.
- Breadcrumb/title clarity.
- Guest-friendly Profile/Scores previews.
- Clear connected wallet/account state.
- Mobile-safe tap targets.
- Loading states for wallet and chain actions.
- No dead buttons.

### 14.2 Arcade flow

Needs polished flow:

```text
Splash
→ Enter Arcade / Connect Wallet
→ Cabinet Select
→ HMH Cabinet
→ Mode Select
→ Character Select
→ Level Intro
→ Gameplay Loading / READY
→ Gameplay
→ Level Up Cards
→ Boss Intro
→ Level Complete / Death / Ranked Settlement
→ Profile / Leaderboard / Replay
```

### 14.3 Gameplay HUD

Needs:

- Health.
- Shield/armor.
- XP bar.
- Level.
- Current weapon.
- Grenades.
- Score.
- Kill count.
- Timer.
- Boss health.
- Mini-map or route indicators only if useful.
- Objective text.
- Achievement popups.
- Power-up pickup notifications.
- Mobile controls.

### 14.4 Profile / leaderboards

Needs:

- Wallet address display.
- Display name.
- Avatar.
- Achievements.
- Ranked history.
- Best scores.
- Game-specific stats.
- Daily/weekly/monthly/yearly/all-time filters.
- Game filter: HMH / Chikun / future games.
- On-chain read path for ranked records.

---

## 15. Audio / music / feedback

Needs:

- Menu music.
- Cabinet select sounds.
- Button/coin slot sounds.
- Level 1 combat music.
- Boss music.
- Level clear sting.
- Death sting.
- Weapon fire sounds.
- Enemy hit/death sounds.
- Explosions.
- Pickup sounds.
- Achievement unlock sound.
- Wallet/settlement success sound.

Style:

- retro arcade,
- darksynth / arcade techno for combat,
- stronger boss arrangement,
- short Litecoin motif for menu/clear/final boss.

---

## 16. Performance and browser requirements

P0:

- Stable 60fps target on desktop.
- Mobile support good enough for browser play.
- Particle caps.
- Enemy caps.
- Asset prewarm.
- No first-frame image pop-in.
- Bundle size review.
- Canvas draw-order stability.
- Image decode and caching tests.
- Avoid per-frame expensive queries / repeated `getContext` calls.

P1:

- Reduced-motion option.
- Quality/performance setting.
- Touch controls.
- Controller support if feasible.

---

## 17. Determinism, anti-cheat, and ranked integrity

Ranked Mode cannot rely on trust-the-client forever.

P0 testnet approach:

- Wallet identity.
- SIWE-style auth.
- Ranked entry signature.
- Deterministic run seed.
- Session ID.
- Game version.
- Submit score with trusted verifier signature or transaction signer path.
- Prevent duplicate submissions.
- Store official score/achievements on-chain or in event-indexed records.

P1:

- Backend verifier service.
- Replay hash upload.
- Basic sanity checks: max score by time, kill count, XP curve, boss clear constraints.
- Indexed leaderboards.

P2:

- Replay verification.
- Stronger proof/attestation system.
- ZK/proof-of-run if practical.

---

## 18. Files and systems to inspect first

### Game/runtime

```text
apps/portal/main.js
apps/portal/src/arcade-core.mjs
apps/portal/src/hmh-campaign-levels.mjs
apps/portal/src/hmh-campaign-runtime.mjs
apps/portal/src/hmh-level-one-visible-runtime.mjs
apps/portal/src/hmh-ground-selection.mjs
apps/portal/src/hmh-combat-balance.mjs
apps/portal/src/enemy-steering.mjs
apps/portal/src/combat-damage.mjs
apps/portal/src/leaderboard-engine.mjs
apps/portal/src/settlement.mjs
apps/portal/src/version-tracking.mjs
```

### Art/manifests

```text
apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs
apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs
apps/portal/assets/generated/
docs/game-design/
docs/plans/
```

### Contracts

```text
contracts/src/*.sol
contracts/artifacts/*.json
contracts/deployment-record.json
scripts/compile-contracts.mjs
scripts/deploy-contracts.mjs
scripts/contract-structure-check.mjs
```

### Tests

```text
tests/*.test.mjs
```

Check `package.json` because the `check` script enumerates many files explicitly. When adding a new source/test module, add it to the check script or it will not be syntax-checked.

---

## 19. Recommended implementation sequence

### Phase 1 — Ground truth and safety audit

1. Run current tests.
2. Browser-smoke production and local.
3. Capture current visual screenshots.
4. Audit wallet connect flow.
5. Audit settlement method names vs Solidity.
6. Audit current Level 1 visible runtime paths.
7. Audit current enemy runtime art mapping.
8. Write a short `docs/game-design/current-hmh-ground-truth.md` if useful.

### Phase 2 — Level 1 art bible and contracts

1. Create Level 1 art-direction source contract.
2. Create final asset requirement source contract.
3. Add tests for required ground/road/landmark/enemy assets.
4. Add rejection criteria tests so old bad art cannot re-enter.

### Phase 3 — Final ground and road kit

1. Generate or import final Level 1 ground kit.
2. Generate contact sheets.
3. Wire selector.
4. Browser-smoke spawn and gas station.
5. Reject if screenshots still look noisy or procedural.

### Phase 4 — Authored chunks and landmarks

1. Implement authored chunk contracts.
2. Create landmark/boundary assets.
3. Wire runtime to chunks.
4. Browser-smoke route progression.

### Phase 5 — Enemy rebuild

1. Replace P0 Level 1 enemy roster.
2. Add animation coverage tests.
3. Wire runtime mapping.
4. Browser-smoke each enemy family.
5. Verify attack tells and death states.

### Phase 6 — Combat, XP, upgrades, bosses

1. Tune movement/combat feel.
2. Rebuild XP and level-up card loop.
3. Add better power-ups.
4. Build mini-boss and Level 1 boss.
5. Add boss arena.
6. Add achievements and unlocks.

### Phase 7 — Wallet/ranked/contracts

1. Fix wallet discovery/connect/chain switch.
2. SIWE/auth.
3. Ranked entry signature.
4. Contract ABI/method alignment.
5. On-chain testnet settlement.
6. Explorer links.
7. On-chain/event-indexed leaderboards.
8. Contract audit improvements.

### Phase 8 — Full game loop

1. Splash to Level 1 complete.
2. Level 1 complete to Level 2 or win/continue.
3. Free vs Ranked end states.
4. Profile/leaderboard/achievements update.
5. Mobile QA.
6. Performance QA.

---

## 20. Acceptance criteria for “AAA roguelike browser experience”

This phrase is aspirational, but it needs concrete gates.

### Visual gates

- Screenshots look intentional without explanation.
- No placeholder rectangles.
- No off-style enemy art.
- No zombie/goblin loading art unless deliberately part of the new style.
- Ground reads as cohesive world, not checkerboard noise.
- Roads/paths guide the player.
- Every arena has landmarks/boundaries/clear lanes.
- Enemies are readable at gameplay scale.
- Effects enhance readability instead of cluttering.

### Gameplay gates

- Level 1 is completable.
- Level 1 is fun for at least several repeated runs.
- XP cadence feels rewarding.
- Upgrade cards create distinct builds.
- Bosses have readable phases.
- Enemies never feel unfair due to spawn/telegraph bugs.
- Hit feedback is satisfying.
- Death/level complete/ranked settlement states are clear.

### Web3 gates

- Wallet connect works with MetaMask and Rabby.
- Wrong chain flow works.
- Ranked run can settle to LiteForge testnet.
- Score/achievement/profile records are queryable.
- Explorer links show txs.
- Free mode never writes official records.
- Mock wallet never appears on official leaderboards.

### Contract gates

- Contracts compile.
- Contract tests exist beyond structure checks.
- Source/artifacts/deployment records align.
- ABI methods match frontend calls.
- EIP-712/replay protection exists for ranked score settlement.
- Admin/roles are clear.
- Token transfers are safe.
- Security audit checklist is complete.

### Production gates

- `npm run vercel:build` passes.
- Local browser smoke passes.
- Production deployment is explicitly approved before push.
- Production custom domain is verified after push.
- Console errors are zero in the tested flow.

---

## 21. Strong warnings for the next model

1. **Do not claim visual quality from tests alone.** Use screenshots/browser vision/human review.
2. **Do not push live without approval.** `git push origin main` deploys production.
3. **Do not edit the stale clone.** Use `C:/Users/just_/lesters-arcade` unless Justin says otherwise.
4. **Do not assume docs are current.** Verify source.
5. **Do not say settlement is fully working just because `SETTLEMENT_LIVE = true`.** Test the full wallet tx path.
6. **Do not use random scatter as a level design substitute.**
7. **Do not ship bad enemy art just because it has a manifest entry.**
8. **Do not let PixelLab/generated assets bypass style review.**
9. **Do not ask Justin for private keys.** If deployment is needed, guide him to paste secrets directly into his terminal.
10. **Do not mix real funds into this until the contract/security pass is complete.** LiteForge testnet only.

---

## 22. Immediate prompt for the higher-end model

Use this exact starting instruction if helpful:

```text
You are working in the Lester's Arcade repo on Hard Money Heroes. Your job is to turn the current browser prototype into a polished isometric roguelike for LitVM LiteForge users with MetaMask/Rabby wallets.

Start by reading:
- AGENTS.md
- docs/plans/2026-07-01-hard-money-heroes-aaa-roguelike-high-end-llm-handoff.md
- docs/plans/2026-07-01-level-1-artistic-world-and-asset-plan.md
- apps/portal/src/arcade-core.mjs
- apps/portal/src/settlement.mjs
- contracts/deployment-record.json
- contracts/src/*.sol

Do not push live without explicit approval.

First task: perform a ground-truth audit of the current repo against this handoff. Produce a short implementation plan with P0/P1/P2 slices. Then begin with P0: Level 1 art-direction contract, final ground/road asset requirements, wallet/settlement ABI mismatch audit, and browser-smoke visual baselines.
```

---

## 23. Bottom line

Hard Money Heroes has enough systems and scaffolding to become a strong Web3 arcade roguelike, but it is not there yet.

The biggest remaining work is:

1. **Art direction** — cohesive isometric world, enemies, VFX, bosses.
2. **Level design** — authored chunks and readable routes instead of random scatter.
3. **Combat feel** — movement, shooting, enemies, bosses, hit feedback.
4. **Progression** — XP, upgrades, power-ups, unlocks, achievements.
5. **UI/UX** — polished wallet-to-cabinet-to-run-to-results flow.
6. **Web3 integration** — MetaMask/Rabby, LiteForge chain, ranked settlement, profile/leaderboard reads.
7. **Smart-contract security** — audit, ABI alignment, replay protection, role controls, safe payments.
8. **QA discipline** — tests plus real browser visual verification.

Treat this as a full game-production pass, not another patch.
