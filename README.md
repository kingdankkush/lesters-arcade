# 🎮 Lester's Arcade

**A Web3-native arcade portal built for the LitVM (Litecoin) ecosystem.**

Lester's Arcade is the *parent* dapp — a wallet-connected portal that hosts multiple arcade cabinets as "child" games. Players link a single wallet, get one identity, and share progress, achievements, leaderboards, and ranked sessions across every cabinet they play.

🔗 **Live:** [lestersarcade.io](https://lestersarcade.io)
📦 **First cabinet:** [Hard Money Heroes](#hard-money-heroes)

![Hero](https://lestersarcade.io/assets/generated/hmh-key-art/hmh-loading-keyart-1.jpg)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  Lester's Arcade (parent portal)            │
│  • Connect wallet (mock + LitVM-ready)      │
│  • Profile, avatar, achievements            │
│  • Leaderboards (daily/weekly/all-time)     │
│  • Arcade music + ambient sound             │
│  • Cabinet grid UI                          │
└─────────────────────────────────────────────┘
             │ select cabinet
             ▼
┌─────────────────────────────────────────────┐
│  Per-game loader (lazy import per cabinet)  │
│  games/<id>/loader.mjs                      │
└─────────────────────────────────────────────┘
```

The portal loads only its own shell at startup (~530 KB). Each cabinet's art/code is loaded lazily when the player selects it — so adding 10 more cabinets doesn't bloat the homepage.

### Third-party onboarding

Any LitVM dev team can onboard a cabinet by:

1. Creating `apps/portal/src/games/<game-id>/loader.mjs`
2. Registering the cabinet in `ARCADE_GAMES` (`apps/portal/src/arcade-core.mjs`)
3. Returning a `{ manifest, entryPoint, adapter }` object from their loader

See [`docs/THIRD_PARTY_GAME_ONBOARDING.md`](docs/THIRD_PARTY_GAME_ONBOARDING.md) for the full contract.

**Currently onboarded cabinets:**

| Cabinet | ID | Status |
|---|---|---|
| Hard Money Heroes | `hard-money-heroes` | 🟢 Live |
| Chikun: The Flying Coin | `chikun` | 🟡 Coming soon |
| Lilly's Lightning Pinball | `lilly-pinball` | 🔒 Coming soon |

---

## 🔫 Hard Money Heroes

A Metal-Slug-style crypto-satire side-scroller set in **Litecoin City After Dark**. 60fps Canvas, procedurally generated districts, full boss roster, roguelike upgrade trees.

### Gameplay systems

- **Twin-stick-lite controls** — WASD movement + mouse aim (desktop), touch-drag movement with auto-fire locked on nearest enemy (mobile)
- **8-directional sprite blending** — heroes and enemies render from direction-keyed frame sets and smoothly transition between run/shoot/melee/throw/hurt/death states without snapping to the camera-facing sprite
- **Procedural districts** — Downtown, Industrial, City Park, Suburban, and Wilderness biomes with theme-colored tile washes, landmark templates (observatories, lighthouses, data hubs, ruins) and gameplay hooks (toxic_cloud, reveal_minimap, disable_cameras, hidden_loot)
- **Thematic enemy spawn bias** — per-district enemy role weighting (e.g. Industrial: armoredPressure 30%, coverShooter 60%, turret 10%)
- **Weapon system** — 5 weapons × 3 branches × 3 tiers (rateOfFire, damage, reloadSpeed), with tier-3 specials (armor-piercing, extended-mag, drum-mag, homing coins, rail-piercing, etc.)
- **Boss battles** — 10 canonical bosses across phase 1 → phase 2 → phase 3 progression, pattern-dispatched AI (lane-charge, summon-minions, floor-shockwave, lobbed-projectiles, homing-orb, safe-lane-sweep, ranged-burst) + super moves at phase 2+
- **Combat physics** — Swept AABB bullet collision (no tunneling through enemies), circle-vs-circle contact melee, gravity-affected projectiles (grenades bounce, lobbed shots arc), per-hit knockback scaled by damage type
- **Roguelike upgrade menu** — 60+ skill library across offensive/defensive/mobility/utility/economy/control/throwable/status categories, plus 3 weapon-tree branch cards per upgrade

### Art pipeline

- 4 handcrafted loading keyarts (randomly selected per session)
- Animated Litecoin XP coins (canvas-drawn, 360° rotation with shimmer + Ł symbol)
- Directional hero sprites for Lit Commando + Lit Valkyrie roster
- 10 canonical bosses + 5 PixelLab bonus enemies
- Pixellab 2,500-image generation plan is prepped (`scripts/pixellab-hmh-2500-queue.json`) — budget-ready for character 8-dir animations, animated tilesets, animated props, buildings, and weapon VFX

---

## 💎 Smart Contract Foundation

Solidity contracts for LitVM deployment live in [`contracts/src/`](contracts/src/):

| Contract | Purpose |
|---|---|
| `PlayerProfileRegistry.sol` | Wallet → profile (handle, displayName, avatarUri, timestamps). Handle collision resolution via keccak256 mapping. |
| `GameRegistry.sol` | Operator-only cabinet registry with per-game fee splits (dev/platform/liquidity/treasury bps enforced to 10,000). |
| `SessionLedger.sol` | EIP-712 signed ranked sessions. `openSession()` escrows entry fee in USDC. `closeSession()` validates cabinet adapter signature. `settle()` forwards fees to PaymentRouter. |
| `AchievementRegistry.sol` | Parent-defined milestone tracking with on-chain unlock. Soulbound NFT model. |
| `PaymentRouter.sol` | Splits entry fee per-game into dev / platform / liquidity / treasury vaults. |
| `interfaces/IERC20.sol` | Standard ERC20 interface for USDC on LitVM. |

See [`contracts/ARCHITECTURE.md`](contracts/ARCHITECTURE.md) for the full data flow, deployment sequence, security model, fee split (60/20/10/10), gas reserve model, and upgrade strategy.

### Fee split model

Every ranked session pays a $0.25 entry fee (`250_000 microUSDC`). SessionLedger escrows the fee; PaymentRouter splits it per the game's registered fee split:

| Share | BPS | % | Recipient |
|---|---|---|---|
| dev | 6000 | 60% | Cabinet developer wallet |
| platform | 2000 | 20% | Lester's Arcade operator |
| liquidity | 1000 | 10% | DEX liquidity pool |
| treasury | 1000 | 10% | Community DAO treasury |

---

## 🏃 Run locally

```bash
git clone https://github.com/kingdankkush/lesters-arcade.git
cd lesters-arcade
npm install
npm test              # 208 tests across 2 suites (all pass)
npm run check         # Syntax sweep of every .mjs/.js/.py
npm run contracts:check
npm run serve         # opens http://127.0.0.1:8791/apps/portal/
```

### Test suite

| Test file | Coverage |
|---|---|
| `tests/arcade-core.test.mjs` | Core game balance + score + director |
| `tests/combat-physics.test.mjs` | Swept AABB, circles, projectile gravity, knockback |
| `tests/weapon-upgrades.test.mjs` | 5-weapon × 3-branch × 3-tier upgrade tree |
| `tests/hero-sprite-lock.test.mjs` | Hero sprite consistency |
| `tests/world-obstacles.test.mjs` | Player collision + obstacle detection |
| `tests/leaderboard-engine.test.mjs` | Multi-cadence leaderboard storage |
| `tests/username-registry.test.mjs` | Display name reservation |
| `tests/settlement.test.mjs` | Revenue split math (60/20/10/10) |
| `tests/sprite-pipeline.test.mjs` | Sprite animation + direction fallback |
| `tests/device-model.test.mjs` | Desktop/touch device detection |
| `tests/combat-damage.test.mjs` | Damage types + crit math |
| `tests/biome-model.test.mjs` | Procedural biome selection |
| `tests/scene-templates.test.mjs` | Scene object placement |
| `tests/arcade-router.test.mjs` | URL routing |
| `tests/session-id.test.mjs` | Session identity generation |

### Deploy

```bash
npm run vercel:build          # static build gate (runs full test suite first)
npx vercel --prod --yes --force   # push to Vercel production
```

---

## 📦 Repo layout

```
apps/portal/                  ← Main arcade portal
├── main.js                   ← ~8,200 lines, the parent app
├── index.html                ← Portal shell
├── styles.css                ← Base styles
├── styles-arcade-polish.css  ← HMH cabinet polish
├── src/
│   ├── arcade-core.mjs       ← Game data, roster, balance, leaderboards
│   ├── arcade-router.mjs     ← URL routing
│   ├── biome-model.mjs       ← Procedural biome selection
│   ├── canonical-actors.mjs  ← Hero/enemy actor registry
│   ├── combat-damage.mjs     ← Damage types, crit math
│   ├── combat-physics.mjs    ← Swept AABB, knockback, projectile gravity
│   ├── combat-sprite-bridge.mjs        ← Sprites ↔ combat state
│   ├── device-model.mjs      ← Desktop/touch detection
│   ├── game-registry.mjs     ← Cabinet registration (HMH + Chikun)
│   ├── leaderboard-engine.mjs
│   ├── leaderboard-seed.mjs
│   ├── scene-templates.mjs   ← Landmark templates w/ gameplay hooks
│   ├── session-id.mjs
│   ├── settlement.mjs        ← Revenue split math
│   ├── sprite-pipeline.mjs   ← Sprite animation + direction fallback
│   ├── username-registry.mjs
│   ├── weapon-upgrades.mjs   ← 5-weapon × 3-branch × 3-tier tree
│   ├── world-obstacles.mjs
│   └── games/
│       ├── hmh/loader.mjs    ← Hard Money Heroes lazy loader
│       └── chikun/loader.mjs ← Chikun lazy loader
└── assets/                   ← ~75 MB of hand-made + generated art

contracts/src/                ← Solidity (pragma 0.8.24)
├── PlayerProfileRegistry.sol
├── GameRegistry.sol
├── SessionLedger.sol         ← EIP-712 signed ranked sessions
├── AchievementRegistry.sol
├── PaymentRouter.sol
└── interfaces/IERC20.sol

tests/                        ← 208 tests, 100% passing
scripts/                      ← Build + audit + pipeline scripts
docs/
├── THIRD_PARTY_GAME_ONBOARDING.md
└── PIXELLAB_2500_IMAGE_PLAN.md
```

---

## 🎯 Safety boundaries

- No real funds, no private keys, no seed phrases
- No contract deployment unless explicitly approved
- No external posting or account changes
- Paid mode is simulated locally until real LitVM testnet integration is approved
- Commercial Litecoin-logo/name-heavy/Ł-heavy usage needs explicit written brand/legal sign-off before launch

---

## 📝 License

MIT — see `LICENSE` (when added). All contract code is SPDX-License-Identifier: MIT.

---

## 🙏 Built with

- Pure JavaScript (ES modules) + HTML Canvas
- Node 22 test runner
- Vercel (deployment)
- Solidity 0.8.24 (contracts, LitVM-ready)
- Python (asset-pipeline scripts)
- Pixellab (procedural sprite art, budget-ready)

*Built for the LitVM / Litecoin ecosystem.* ✨
