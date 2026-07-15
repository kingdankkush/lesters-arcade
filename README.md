# 🎮 Lester's Arcade

**A Web3-native arcade portal for the LitVM / Litecoin ecosystem, with Hard Money Heroes as the flagship cabinet.**

Lester's Arcade is the parent dapp: one wallet-connected arcade shell, one player identity, shared profiles, achievements, leaderboards, ranked sessions, and a growing cabinet model for games that can plug into the same platform layer.

🔗 **Live:** [lestersarcade.io](https://lestersarcade.io)  
🕹️ **Flagship cabinet:** [Hard Money Heroes](#hard-money-heroes)  
🧪 **Current local gate:** `npm run ship:gate` (automated code/art/security/browser gates plus a strict repo budget)

![Hero](https://lestersarcade.io/assets/generated/hmh-key-art/hmh-loading-keyart-1.jpg)

---

## Current status

| Area | Status | Notes |
| --- | --- | --- |
| Lester's Arcade portal | Live | Wallet-ready arcade shell with cabinet loader, profile surfaces, leaderboards, music, and responsive controls. |
| Hard Money Heroes | Live, actively polished | Isometric crypto-satire roguelite with a finite authored Level 1 world, compact upgrade UI, free play, and canonical local Ranked preview. |
| LitVM contracts | Fail-closed preview | Solidity contracts and verification tooling live in `contracts/src/`, but verified settlement is disabled. No deployment, transaction, or real-value economy is implied. |
| Generated art pipeline | Active | Repo-owned Python/Node pipelines generate hero, enemy, world, UI, VFX, achievement, and certification artifacts. |
| Level 1 art | Certified | The 23 runtime-spawnable Level 1 actor rows and four playable heroes have complete ship-scope animation coverage. Future-level city actors remain explicit debt. |
| Device QA | Desktop fallback verified | Device/input matrix passes locally. Real Android/iOS QA is blocked on this Windows host until `adb`/`scrcpy`/iOS bridge tools and devices are attached. |

---

## Architecture

```text
┌─────────────────────────────────────────────┐
│  Lester's Arcade parent portal              │
│  • Wallet/profile shell                     │
│  • Cabinet grid and lazy cabinet loader     │
│  • Shared achievements and leaderboards     │
│  • Ranked/free session model                │
│  • Audio, settings, responsive input        │
└─────────────────────────────────────────────┘
             │ select cabinet
             ▼
┌─────────────────────────────────────────────┐
│  Per-cabinet loader                         │
│  apps/portal/src/games/<id>/loader.mjs      │
│  returns manifest, entryPoint, adapter      │
└─────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  Cabinet runtime                            │
│  Hard Money Heroes ships first              │
└─────────────────────────────────────────────┘
```

The portal loads the shell first. Cabinet code, art, and manifests are lazy-loaded through each cabinet's loader so future cabinets do not bloat the homepage.

### Third-party cabinet onboarding

Any LitVM dev team can onboard a cabinet by:

1. Creating `apps/portal/src/games/<game-id>/loader.mjs`
2. Registering the cabinet in `ARCADE_GAMES` in `apps/portal/src/arcade-core.mjs`
3. Returning a `{ manifest, entryPoint, adapter }` object from the loader
4. Passing the sandbox/security and runtime integration checks

Start with [`sdk/README.md`](sdk/README.md), then use [`docs/THIRD_PARTY_GAME_ONBOARDING.md`](docs/THIRD_PARTY_GAME_ONBOARDING.md) for the full security contract.

### Current cabinets

| Cabinet | ID | Status |
| --- | --- | --- |
| Hard Money Heroes | `hard-money-heroes` | 🟢 Live flagship cabinet |
| Chikun's Escape | `chikun` | 🟡 Loader-ready / coming soon |
| Lilly's Lightning Pinball | `lilly-pinball` | 🔒 Planned |

---

## Hard Money Heroes

**Hard Money Heroes** is an isometric crypto-satire roguelite set in **Litecoin City After Dark**. It began life as a side-scroller and has pivoted into the current Canvas-based isometric survival/run-and-gun cabinet.

### What is playable now

- **Free mode and Ranked preview:** Free is wallet-free practice. Ranked preview records canonical local evidence but sends no transaction while verified settlement is disabled.
- **Character select:** Lit Commando and Lit Valkyrie are starter heroes. Lester/Lilly progression remains local-preview state until verified settlement is approved.
- **Finite authored Level 1:** a six-biome Crypto Wasteland/Litecoin City map assembled from deterministic macro-biome, road/trail/water connector, POI, micro-scene, and prefab systems.
- **Smaller runtime map footprint:** Level 1 runtime dimensions were reduced roughly in half for better loading/framerate while preserving finite bounds and spawn safety.
- **Compact level-up UI:** upgrade cards now fit inside the gameplay window with icon, title, gain, rank pips, and tooltip/ARIA details instead of visible paragraph/keyword clutter.
- **Twin-stick-lite controls:** keyboard/mouse on desktop; touch joystick and action controls on mobile/tablet layouts.
- **Upgrade system:** 60+ roguelike upgrade concepts across offense, defense, mobility, utility, economy, control, throwable, status, and weapon branches.
- **Combat feedback:** SFX, VFX, hit flash, damage text, screen shake, and central cue planning are wired through runtime certificates.

### World and level art

Recent world-building work moved Level 1 away from generic procedural scatter and toward authored, readable spaces:

- WO-96: finite six-biome macro map plan
- WO-97: six-biome ground, water, vegetation, building, vehicle, critter, and POI asset families
- WO-98: deterministic world assembly, road/trail/water network, authored micro-scenes, prefabs, and seed-1337 acceptance tour
- WO-90: pickup icons, VFX/UI chrome, authored stamp art, and achievement atlas certified runtime-ready

The current direction is **authored handcrafted areas first**, with deterministic systems supporting layout and replayability rather than random decoration.

### Heroes and animation

- Lit Commando and Lit Valkyrie have certified hero coverage through the Wave 3 matrix gates.
- Lester and Lilly canon references were ingested and turned into runtime-ready matrix artifacts.
- WO-81/82/79 now certifies animation-principles gates, Lit hero coverage, and ambient motion policy.
- Animation gates cover anticipation, smear, impact, follow-through, and loop-bob.
- Ambient motion rules are reduced-motion-safe, textless for signage, and keep critters out of boss locks.

### Enemies and bosses

WO-99 reran the enemy/boss roster against hero canon and current runtime assets.

Certified 8-direction runtime enemies:

- `coyote-pack-runner`
- `wild-boar`
- `rattlesnake`
- `buzzard`
- `fud-goblin`
- `paper-hand`
- `slippage-skater`

Important current distinction:

- The released Level 1 spawn/proxy table is complete: 23/23 rows have full required runtime coverage.
- Four future-level city actors remain partial and are not counted as Level 1 ship coverage. See `docs/game-design/SHIP_ART_CENSUS_LOCK.md`.

See [`docs/game-design/hmh-wo99-enemy-canon-uplift.md`](docs/game-design/hmh-wo99-enemy-canon-uplift.md).

### Audio and AV

WO-86/87/88/89 certifies the current audio/AV plan:

- Central `HMH_SFX_CUE_REGISTRY` covers runtime cues.
- WebAudio synth/sample fallback remains the safe runtime layer.
- AI/external audio candidates must beat fallback in A/B review before commit.
- Pressure-layered score plan uses five stem concepts: base rain pulse, combat arpeggio, boss brass hit layer, low-health filtered layer, victory release sting.
- 60-second showcase shot list is defined: spawn, pickup/first hit, pressure layer, boss warning, death burst, victory settle.

See [`docs/game-design/hmh-wo86-89-audio-av.md`](docs/game-design/hmh-wo86-89-audio-av.md).

---

## Smart contract foundation

Solidity contracts for LitVM deployment live in [`contracts/src/`](contracts/src/):

| Contract | Purpose |
| --- | --- |
| `PlayerProfileRegistry.sol` | Wallet to profile mapping: handle, display name, avatar URI, timestamps. |
| `GameRegistry.sol` | Operator-managed cabinet registry with per-game fee splits. |
| `SessionLedger.sol` | EIP-712 signed ranked sessions, entry-fee escrow, close/settle lifecycle. |
| `AchievementRegistry.sol` | Parent-defined milestone tracking and soulbound achievement model. |
| `PaymentRouter.sol` | Fee routing to developer, platform, liquidity, and treasury recipients. |
| `interfaces/IERC20.sol` | Standard ERC20 interface for USDC-style tokens on LitVM. |

See [`contracts/ARCHITECTURE.md`](contracts/ARCHITECTURE.md) for deployment sequence, data flow, security model, fee split, gas reserve model, and upgrade strategy.

### Economy status

The production portal does not send score or economy transactions. Contract fee-split code is dormant testnet infrastructure and remains subject to a separately approved deployment manifest, verifier posture, legal/license decision, and operator sign-off. See `contracts/ARCHITECTURE.md`; do not infer a live economy from repository constants.

---

## Verification and quality gates

Current verified local results:

```bash
npm test              # Full Node test suite
npm run check         # JavaScript/Python syntax check
npm run contracts:check
npm run ship:gate     # complete automated release gate; strict repo budget is last
```

Additional project gates used during Hard Money Heroes production:

```bash
npm run assets:qa
npm run smoke:portal:interactions
npm run visual:regression
npm run design:device-input
npm run design:wo99-enemy-canon
npm run design:wave3-art
```

Real-device QA is not claimed on this host. Current local evidence:

- `adb`: missing
- `scrcpy`: missing
- `xcrun`: missing
- iOS bridge: missing
- desktop/device-input fallback: passing

---

## Run locally

```bash
git clone https://github.com/kingdankkush/lesters-arcade.git
cd lesters-arcade
npm install
npm test
npm run check
npm run contracts:check
npm run serve
```

Then open:

```text
http://127.0.0.1:8791/apps/portal/
```

For a production-style static build:

```bash
npm run vercel:build
```

---

## Repo layout

```text
apps/portal/                         Main arcade portal
├── index.html                       Portal shell
├── main.js                          Main runtime and HMH cabinet integration
├── styles.css                       Base portal/gameplay styling
├── styles-arcade-polish.css         Additional arcade polish
├── src/
│   ├── arcade-core.mjs              Cabinet registry, score data, core game metadata
│   ├── canonical-actors.mjs         Hero/enemy actor registry and runtime mapping
│   ├── combat-damage.mjs            Damage types, crits, recovery, labels
│   ├── combat-physics.mjs           Swept collision, knockback, projectile math
│   ├── combat-sprite-bridge.mjs     Combat state to animation bridge
│   ├── device-model.mjs             Desktop/touch input and responsive layout model
│   ├── hmh-audio-system.mjs         Central SFX registry and mix planner
│   ├── hmh-wo81-82-79-animation-polish.mjs
│   ├── hmh-wo86-89-audio-av.mjs
│   ├── hmh-wo98-world-assembly.mjs
│   ├── hmh-upgrade-menu-ui.mjs
│   ├── leaderboard-engine.mjs
│   ├── settlement.mjs
│   ├── weapon-upgrades.mjs
│   └── games/
│       ├── hmh/loader.mjs           Hard Money Heroes lazy loader
│       └── chikun/loader.mjs        Chikun lazy loader
├── assets/
│   ├── audio/                       Music/SFX manifests and samples
│   └── generated/                   Generated/runtime art manifests and contact sheets

contracts/src/                       Solidity 0.8.24 LitVM-ready contracts
scripts/                             Build, audit, design, asset, and report pipelines
tests/                               Node test suite and runtime regression tests
docs/                                Design docs, QA reports, plans, onboarding, contracts docs
```

---

## Recent production milestones

| Work order | Status | Summary |
| --- | --- | --- |
| WO-90 | Complete | Placeholder redo certified for pickup icons, VFX/UI chrome, stamp art, and achievement atlas. |
| WO-81/82/79 | Complete | Animation-principles gates, Lit hero coverage, and ambient motion policy certified. |
| WO-86/87/88/89 | Complete | Audio/AV certification, SFX inventory, pressure-layered stems, AV sync, 60s showcase shot list. |
| WO-92/93/94 | Complete | Lester/Lilly canon ingestion, hero matrices, and canonical runtime wiring. |
| WO-95 | Complete | Ranked-match character unlock progression for Lester and Lilly. |
| WO-96/97/98 | Complete | Finite Level 1 macro plan, world assets, and deterministic world assembly. |
| WO-99 | Complete | Enemy canon uplift, real buzzard kit wiring, boss debt matrix. |
| Map scale fix | Complete | Level 1 dimensions reduced roughly half for better performance. |
| Level-up UI fix | Complete | Compact gameplay-safe upgrade overlay with tooltip/ARIA detail. |
| Real-device QA | Blocked | Desktop fallback passes; real Android/iOS matrix waits for attached devices and toolchain. |

---

## Roadmap

Near-term priorities:

1. **Boss completion:** generate and verify complete 8-direction PixelLab boss kits for Warren Spear Rider, Whale Dumper Boss, Chain Reaper Boss, and Bit Whale Boss.
2. **Runtime boss integration:** move boss spectacle from debt matrix into live isometric boss encounters with readable telegraphs, phase changes, and arena rules.
3. **Real-device QA:** attach Android/iOS devices or install the required bridge tools, then run the actual touch/performance matrix.
4. **Audio candidate bakeoff:** produce or source final SFX/music candidates only if they beat the current WebAudio/sample fallback in A/B review.
5. **60-second showcase capture:** record the defined WO-89 showcase route once boss/visual/audio polish is stable.
6. **Additional cabinets:** continue Chikun and Lilly's Lightning Pinball once the parent portal and HMH flagship baseline are stable.
7. **Approved LitVM deployment:** deploy contracts only after explicit approval, key handling review, and final testnet checklist.

---

## Safety boundaries

- No real funds, private keys, seed phrases, or secret material in the repo.
- No contract deployment unless explicitly approved.
- No paid mode activation without approved LitVM/testnet flow.
- No external posting, account changes, or production account mutations from automated scripts.
- Generated art and audio must keep provenance clear and avoid committing raw prompt logs or secret-bearing tool output.
- Commercial Litecoin-name/logo/Ł-heavy usage should receive explicit brand/legal sign-off before broader public launch.

---

## Built with

- JavaScript ES modules
- HTML Canvas 2D
- Node test runner
- Python asset-generation/reporting scripts
- Solidity 0.8.24
- ethers.js
- esbuild
- Vercel static deployment
- PixelLab-assisted generated-art pipeline, with repo-owned final artifacts

---

## License

This repository is currently marked `UNLICENSED` in `package.json`. Contract source files include SPDX headers where applicable. Add a formal project license before third-party reuse or public contribution workflows.

---

*Built for Lester's Arcade, Hard Money Heroes, and the LitVM / Litecoin ecosystem.* ✨
