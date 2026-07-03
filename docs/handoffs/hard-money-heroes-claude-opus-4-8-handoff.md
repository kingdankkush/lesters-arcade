# Hard Money Heroes / Lester's Arcade - Claude Opus 4.8 Design Handoff

Generated: 2026-06-07T20:05:59Z
Repository: `C:/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade`
Primary source files inspected:
- `AGENTS.md`
- `PROJECT.md`, `DECISIONS.md`, `OPEN_QUESTIONS.md`
- `docs/game-design/hard-money-heroes-canon.md`
- `docs/game-design/hard-money-heroes-isometric-roguelike-pivot.md`
- `docs/game-design/hard-money-heroes-pixellab-isometric-production-wave-1.md`
- `docs/design/login-parent-system-ux.md`
- `docs/architecture/build-stack-litvm-dappit.md`
- `docs/contracts/README.md`
- `apps/portal/src/arcade-core.mjs`

Audience: Claude Opus 4.8. Purpose: analyze the current game/platform canon, identify missing design detail, propose upgrades, and help turn the current playable/prototype direction into a stronger isometric roguelike Web3 arcade cabinet.

IMPORTANT CANON NOTE: The active direction as of 2026-06-07 is **isometric run-and-gun roguelike / roguelite survival**. Older side-scroller/tactical side-scroller constants still exist in code and should be treated as historical source material or biome/combat inspiration unless explicitly migrated into the isometric design.


## 1. Executive Summary

Lester's Arcade is the parent Web3 arcade portal. Hard Money Heroes is the first playable child cabinet/game. The portal uses an EVM wallet as the durable player account, then lets the player select cabinets, play free practice runs, or play ranked/paid runs that are eligible for official leaderboards, achievements, profile progress, and transaction receipts.

Hard Money Heroes began as a Metal Slug-style side-scrolling run-and-gun but is actively pivoting into an isometric roguelike survival shooter. The intended fantasy is: Lester drops into Litecoin City After Dark, moves freely across procedural isometric chunks, survives escalating enemies, earns XP from kills, pauses on level-up, chooses from a guided two-card draft (continue your build vs start a new tree) with one reroll, and builds toward a run that becomes overwhelming around the 20-minute mark.

Primary design identity:
- Parent portal: Lester's Arcade.
- First cabinet: Hard Money Heroes.
- Active genre: isometric-run-and-gun-roguelike.
- World: Litecoin City After Dark.
- Tone: goofy arcade mix with gritty Metal Slug-style satire.
- Main hero: Lester.
- Future unlockable/alternate hero: Lilly.
- Free play: practice-only / local-only.
- Ranked/paid play: official score, achievement, progress, and transaction path.
- Prototype entry fee: $0.25 simulated credit.
- Target network: LitVM LiteForge, chain ID 4441 (0x1159), gas token zkLTC.


## 2. Authority Map and How Opus Should Read This Handoff

Use this precedence order:
1. Active user direction and repo `AGENTS.md`: isometric roguelike pivot is active.
2. `docs/game-design/hard-money-heroes-isometric-roguelike-pivot.md` and `docs/game-design/hard-money-heroes-canon.md`.
3. `apps/portal/src/arcade-core.mjs` for implemented constants, score formulas, wallet/profile state, achievements, and current data model.
4. Older side-scroller docs/constants only as reusable theme, names, balance inspiration, not as final camera/level structure.

Potential conflict to resolve:
- Code still labels the playable cabinet genre as side-scrolling run-and-gun and keeps side-scroller level plans.
- The active design doc says those stages become procedural biome/theme material for the isometric roguelike.

OPUS TASK: Normalize the docs and code model so future agents cannot accidentally keep building the old side-scroller. Recommend exact renamed constants, compatibility shims, and migration notes.


## 3. Lester's Arcade Platform Model

### Platform purpose
# Lester's Arcade

## Purpose

Build a retro Litecoin-themed Web3 arcade portal where EVM-wallet players enter arcade cabinets that are synced dapp games. Free play is casual/untracked; paid play unlocks official leaderboards, achievements, tournaments, and revenue splits for infrastructure and game developers.

### Parent/child structure
- Lester's Arcade is the parent arcade/account portal.
- Each cabinet is a child dapp/cartridge.
- Hard Money Heroes is the first playable cabinet.
- Future cabinets currently listed: Lilly's Lightning Pinball, Block Brawler, Mega Lester / other placeholders.
- The parent account owns wallet identity, player profile, per-game progress, official high scores, achievements, paid sessions, and future tournament/community rails.

### Public player flow
- connect-wallet
- select-game
- watch-or-skip-intro
- choose-mode
- begin-level
- play

### Official app shell flow
- wallet-splash
- arcade-walk-in
- cabinet-select
- hard-money-heroes-intro
- mode-select
- level-one-intro
- begin-level

### Navigation surfaces
| Nav | Purpose |
| --- | --- |
| Play | Select Hard Money Heroes or future Lester arcade cabinets. |
| Profile | Edit username/avatar, view wallet-bound progress, achievements, and high scores. |
| Scores | Browse global boards plus the current wallet profile placement. |
| Settings | Controls, audio, accessibility, network status, and sign-out. |

### Cabinet roster in current shell
| Cabinet | Game ID | Status | Playable | Description |
| --- | --- | --- | --- | --- |
| Hard Money Heroes | lester-blaster | playable | True | The first playable Lester arcade cabinet: tactical run-and-gun score survival on LitVM LiteForge. |
| Lilly Lightning | lilly-lightning | coming-soon | False | Future Lilly cabinet using the teal sprite direction. |
| Mempool Mayhem | mempool-mayhem | coming-soon | False | Future score-attack cabinet for wallet-profile expansion. |

OPUS NOTES:
- Clarify whether future cabinets are real roadmap items or menu flavor.
- Define how a third-party cabinet registers with the parent system.
- Decide whether the portal should be branded primarily as Litecoin/LitVM or as a broader retro arcade with LitVM payment rails.


## 4. Wallet Login, Player Profile, and Web3 Rails

### Wallet network
- name: LitVM LiteForge
- status: public-testnet
- chainId: 4441
- chainIdHex: 0x1159
- explorerUrl: https://liteforge.explorer.caldera.xyz
- faucetUrl: https://liteforge.hub.caldera.xyz
- portalUrl: https://testnet.litvm.com
- Native gas token: zkLTC (18 decimals).
- RPC HTTP: https://liteforge.rpc.caldera.xyz/http
- RPC WebSocket: wss://liteforge.rpc.caldera.xyz/ws

### Wallet connectors
| Connector | Label | Role | Prototype-safe |
| --- | --- | --- | --- |
| injected-evm | Browser EVM wallet | preferred real-wallet connector for LitVM-compatible accounts | True |
| mock-wallet | Mock local wallet | offline QA fallback when MetaMask/Rabby/etc. are unavailable | True |

### Read/write permissions
Read scopes:
- wallet address
- chain id
- parent arcade profile
- child game progress

Write scopes for official paid/ranked play:
- paid sessions
- profile progress
- achievements
- official scores
- transaction receipts

Free mode rule: free practice never writes progress, achievements, scores, or transactions to the parent account

Paid mode rule: official paid runs create a parent-sync packet for progress, achievements, leaderboard, and receipt state

### Chain guard states observed from current model
| Scenario status | Chain guard | Wallet | Copy |
| --- | --- | --- | --- |
| mock-ready | mock-fallback | - | No injected EVM wallet detected. Mock fallback is available; real testnet play uses LitVM LiteForge and faucet zkLTC. |
| ready | needs-wallet-connection | - | Connect MetaMask/Rabby on LitVM LiteForge (Chain ID 4441) or use the mock fallback for offline QA. |
| connected-valid-chain | right-chain | 0x123456...345678 | LitVM LiteForge ready. Chain ID 4441 // gas token zkLTC // faucet available for free testnet gas. |
| connected-wrong-chain | wrong-chain | 0x123456...345678 | Switch or add LitVM LiteForge in MetaMask/Rabby. Expected Chain ID 4441 (0x1159); detected 0x1. |

### Profile model
A profile is created from the normalized wallet address. Current fields include:
- wallet, handle, avatar, rank, XP, joinedAt
- achievements array
- totalPaidRuns and totalFreeRuns
- per-game progress records: best paid score, best free score, paid/free run counts, longest run, best distance, kills, grenade kills, melee kills, boss kills, perfect boss kills, cumulative seconds, power-ups, max combo, max damage combo, enemy kills by type, weapons used, unique power-ups, bosses defeated, last session ID/time

### Profile settings rules
- walletIsPrimaryKey: True
- walletLockCopy: Progress, high scores, achievements, uploads, and official paid-run submissions are assigned to the connected wallet. Sign out to use a different wallet.
- Username: editable, 3-18 chars, appears on leaderboards.
- Avatar: editable/uploadable, square 150px target, appears on leaderboards.

### Revenue split
Entry fee: $0.25 in prototype micro-USDC units.
| Bucket | BPS | Percent |
| --- | --- | --- |
| infrastructure | 4000 | 40% |
| developer | 3500 | 35% |
| tournament | 1500 | 15% |
| community | 1000 | 10% |

### Intended contract modules
- PlayerProfileRegistry: identity/profile shell.
- GameRegistry: official cabinet records and developer/economy settings.
- ArcadePaymentRouter: paid sessions and revenue splits.
- ScoreSubmissionRegistry: official score records from trusted verifier.
- AchievementRegistry: achievement definitions and unlocks.
- TournamentPool: future competition windows and prize accounting.
- LestersArcadeCore: composition wrapper.

OPUS NOTES:
- Decide first real paid asset: USDC, zkLTC, ETH, LTC, or multi-asset routing.
- Decide if handles are globally unique and moderated.
- Decide if achievements remain off-chain, become ERC-1155 badges, or use a hybrid.
- Define anti-cheat/verifier trust model before real prizes or paid play.
- Confirm current LitVM RPC/chain/faucet/token addresses from official docs before deployment.


## 5. Free vs Ranked/Paid State Boundaries

Free practice:
- No cost.
- Local/practice score only.
- No official leaderboard entry.
- No achievement unlocks.
- No parent progress writes.
- No payment/transaction record.
- Useful for onboarding and QA.

Ranked/paid:
- Uses the wallet-bound profile.
- Requires the ranked/testnet flow.
- Creates a paid session with entry fee, lives, revenue split, and write scopes.
- At score submission, updates parent progress, achievements, official leaderboard, transaction/payment history, and official session history.
- Current verifier status: prototype-local-unverified.
- Next verifier step: replace simulated transaction hashes with LitVM receipts and verifier-signed score summaries.

Official leaderboard rules:
| Field | Value |
| --- | --- |
| Cadences | daily, weekly, monthly, yearly, all-time |
| Views | global-top, my-placement, friends-future |
| Submission trigger | game-over-score-submit |
| Official mode only | True |
| On-chain payload | gameId, score, username, wallet, avatarUri, cadence, chainId, runReceipt |

OPUS NOTES:
- Make the game-over official score submit an explicit player action, not an automatic hidden write.
- Define how the app handles disconnects, wrong-chain status, duplicate submits, and abandoned paid sessions.
- Define whether free-mode local scores should be visible only inside the current browser session or saved locally with a non-official label.


## 6. Game Theory / Player Motivation / Strategic Loop

Core player motivations:
- Mastery: survive longer as enemy pressure escalates.
- Buildcraft: choose upgrades that create a different run identity each session.
- Skill expression: movement, aim, kiting, melee risk, throwable timing, boss patterns, and pickup routing.
- Score attack: optimize kills, combos, boss clears, coins, power-ups, no-damage windows, and survival time.
- Social proof: official leaderboards and achievements tied to wallet identity.
- Low-friction onboarding: free play is safe and untracked; ranked play is opt-in.

Risk/reward surfaces:
- Close-range Litecoin Blade can one-shot weak enemies but exposes the player.
- Crypto Bombs and Hard Forks can solve crowds or elites but need scarcity/cooldown tuning.
- XP shards/coins force movement decisions: collect now under pressure or kite enemies first.
- Power-up routes create short-term opportunity vs long-term survival safety.
- Ranked mode adds official reputation/score stakes without changing core mechanics.

OPUS NOTES:
- Add an explicit scoring strategy guide: what should top players optimize?
- Decide whether the intended meta is survival time, score efficiency, boss kills, or build diversity.
- Add anti-addiction/ethical design guardrails: clear exit ramps, no dark-pattern spend loops, no pay-to-win stat upgrades.


## 7. Active Game Loop and Core Mechanics

### Isometric roguelike target
- Camera projection: isometric.
- Tile size: 64x32.
- Follow mode: free-roam-map-centered-on-player.
- Movement model: 8-way-directional-free-roam.
- Directions: N, NE, E, SE, S, SW, W, NW.
- Aim model: mouse-directional-run-and-gun.
- Projectile space: world-x-y converted through isometric projection at render time.

### Run loop
1. Player enters a procedural isometric combat zone.
2. Enemies spawn outside the safe radius and pressure the player.
3. Player kills enemies for XP and score.
4. XP shards/gems or direct XP fill the XP bar.
5. Level-up pauses gameplay.
6. Two random upgrade options appear.
7. Player may use one reroll per level-up event.
8. Choosing a skill immediately applies stats and resumes the run.
9. Difficulty ramps toward an intended 20-minute survival ceiling.
10. Free/ranked mode determines whether the final result remains local or can be submitted officially.

### Controls - active target for isometric design
- WASD / left stick: 8-way movement.
- Mouse / right stick: aim direction.
- Left click / right trigger: fire.
- Reload: automatic when empty, optional manual reload.
- Dash/evade: optional after core movement/combat works.

### Current legacy/tactical controls still in code
| Action | Keyboard |
| --- | --- |
| Move left/right | A/D or arrows |
| Crouch | Control / S / ArrowDown |
| Jump | Space |
| Shoot | Left Click |
| Melee | E / Right Click |
| Throwable | F |
| Reload | R |
| Swap weapon | Q |
| Pause | Enter |

OPUS NOTES:
- Replace side-scroll controls with the final isometric/twin-stick control contract.
- Decide if shooting is always manual aim, auto-fire toward nearest enemy, or hybrid accessibility mode.
- Decide whether dash is in the MVP or a later skill/unlock.


## 8. Procedural Level / World Design

Active world: Litecoin City After Dark

World pitch: A neon-drenched cyberpunk metropolis built on the bones of a failed financial system.

Atmosphere: perpetual night, rain-slicked streets, holographic ticker tape, glass towers pulsing with market data

The old authored levels are now best treated as biome/theme pools for procedural chunks:
| Biome/theme | Route/source | Boss/source | Design purpose |
| --- | --- | --- | --- |
| Level 1 - The Slums | Underchain District -> Industrial Foundry | The Rug Pull Baron | FUD Goblins, Paper Hands, Rug Rats, Honeypot Turrets, Gas Fee Wisps, Slippage Skaters |
| Level 2 - The Tower | Financial District -> Vertical Skyscraper Ascent | The Influencer (Mr. NGMI) | Bot Swarm (Sybil Drones), Phishing Anglers, MEV Reapers, Honeypot Turrets |
| Level 3 - The Getaway | Bullet Train Interior -> Rooftop Finale | The Quantum Hacker | Slippage Skaters, Paper Hands, Honeypot Turrets, MEV Reapers, Liquidation Cascade Golems, Gas Fee Wisps, Bot Swarms |

Current environment data in code:
| Environment | Window | Mood | Hazards |
| --- | --- | --- | --- |
| The Slums: Underchain District | 0-2 min | tight, claustrophobic neon alleys where rugged players survive under broken 1000x billboards | steam grates, flickering scam signs, cheap platforms yanked by Rug Rats |
| The Slums: Industrial Foundry | 2-5 min | counterfeit token factory of molten mint furnaces, hydraulic presses, and smelt-pits | moving conveyor floor, smelt-pits, hydraulic press timing gates |
| The Tower: Financial District Ascent | 5-10 min | chrome-and-black-glass extraction machine dressed as legitimacy | atrium drops, elevator edge hooks, server-rack flank corridors |
| The Tower: Penthouse Rain | 10-13 min | open-air rain, influencer ring-light glow, and the entire city below | bot shield swarms, sponsored-post bombs, open-air knockback edges |
| The Getaway: Mainnet Express | 13-20 min | bullet train chase through neon night, luxury cars, vault cars, engine machinery, and rooftop rain | wind knockback, sparking breached car, passing-pylon light flicker, train-bank camera shake |

Procedural generator direction:
- Pick a biome/stage theme.
- Assemble 16x16 isometric chunks around the player/camera area.
- Place navigable ground, collision footprints, props, hazards, and pickups.
- Maintain a spawn-safe radius around the player.
- Spawn enemies outside the immediate camera-safe radius.
- Stream/recycle chunks as the player moves.
- Handle depth sorting/occlusion for buildings, trees, signs, cars, crates, and props.

OPUS NOTES:
- Define tile/chunk schema: floor, collision, wall footprint, prop footprint, hazard, spawn lane, pickup lane, exit/streaming boundary.
- Define exact safe spawn radius and camera radius.
- Define how biomes transition during a single 20-minute run.
- Clarify whether bosses create temporary arenas inside the procedural map.


## 9. Characters

| Character | Role | Unlock/status | Tagline | Art direction |
| --- | --- | --- | --- | --- |
| Lester | main playable Hard Money Hero | starter | Rambo-like Litecoin City commando walking against the panic. | high-detail 16-bit/Neo-Geo chunky commando silhouette, clean Litecoin blue/silver hero accents, optional rain/cyberpunk grime, readable blade arc and muzzle flashes. |
| Lilly | future unlockable alternate art hero | future unlockable; setup after Lester production sprite pass | Same moveset as Lester, new sprite/personality pass later. | match Lester gameplay silhouette and hitbox while swapping the visible character art/sprites. |
| Max Mempool | parked future character concept | parked; not part of current Hard Money Heroes canon | Retained as a non-canon placeholder until Justin approves a third hero. | chunky arcade bruiser placeholder only; do not produce final assets until approved. |

Current canon details:
- Lester is the starter/main playable Hard Money Hero.
- Lilly is a future unlockable alternate hero with the same moveset, hitbox, and gameplay stats as Lester, but different art/personality.
- Max Mempool exists in current source as a parked placeholder concept and should not become active canon unless Justin approves.

Animation needs for isometric pivot:
- Idle, run/move, aim/shoot/attack in 8 directions.
- Reload/recover where relevant.
- Hurt/stagger front/back/side at minimum; ideally 8 directions.
- Death/defeat variants.
- Special/boss attacks where direction matters.

OPUS NOTES:
- Flesh out Lester and Lilly personality, barks, silhouette, and build identity.
- Decide if Lilly is a skin, same-stat character, or a different class after unlock.
- Do not expose Lilly as playable until unlock/design is approved.


## 10. Enemy Catalog, AI Behaviors, and Spawn Timing

Current source has 12 enemy entries.

| Enemy | Class | HP | DMG | SPD | Score | Spawns after | AI archetype | Attacks | Tell |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FUD Goblin | grunt | 7 | 7 | 1.8 | 80 | 0 | swarm-shambler | slow-sell-arc, swarm-body-block | mouth opens with SELL bubble wind-up |
| Gas Fee Wisp | hazard-flyer | 10 | 8 | 2.2 | 140 | 35 | hover-taxer | resource-tax, sticky-tar-puddle | gas-pump body glows before taxing |
| Paper Hands | panic-melee | 12 | 9 | 2 | 120 | 0 | panic-charge-flee | wild-melee, ally-collision-chaos | crumpled hands shake before charge |
| Crypto Bro | kol-ranged-grunt | 18 | 12 | 1.9 | 210 | 55 | taunt-strafe-shooter | phone-taunt-shot, jump-back-flex, close-knife-panic | phone screen flashes before the shot/taunt |
| Gas Beast | armored-bruiser | 32 | 16 | 0.95 | 340 | 115 | gas-cloud-area-denial | gas-tax-pulse, slow-claw-swipe, short-hop-body-check | chest vents glow orange before gas pulse |
| Bot Swarm (Sybil Drones) | formation-flyer | 9 | 10 | 2.4 | 150 | 80 | parent-drone-formation | formation-laser-ping, parent-drone-scatter | blank wallet face flashes red target dot |
| Rug Rat | disruptor | 8 | 7 | 3.3 | 130 | 70 | platform-yanker | platform-yank, low-dash-knockback | tiny rolled rug lifts before dash |
| Honeypot Turret | stationary-trap | 18 | 13 | 0 | 220 | 90 | loot-bait-trap | short-range-spread, clamp-burst | too-perfect loot glow pulses twice |
| Slippage Skater | mid-tier-rusher | 20 | 14 | 3.6 | 260 | 130 | overshoot-u-turn | slide-rush, overshoot-return | skates spark before line rush |
| Phishing Angler | zoning-hook | 24 | 16 | 1.2 | 300 | 180 | fake-wallet-lure | connect-wallet-lure, hook-reel | glowing Connect Wallet lure appears before hook is active |
| MEV Reaper | elite-flanker | 34 | 19 | 3 | 420 | 240 | sandwich-pincer | two-sided-pincer, same-frame-blade-strike | two shadows split to either side |
| Liquidation Cascade Golem | armored-elite | 54 | 24 | 0.9 | 560 | 360 | slow-armored-shockwave | armored-stomp, death-cascade-shockwave | block stack flashes margin-call red before collapse |

### AI role state machine
Required states: spawn, seek, telegraph, attack, recover, reposition, defeated.

Global fairness:
- maxActiveAttackers: 2
- minTelegraphFrames: 24
- recoveryFramesAfterAttack: 20
- readableTellRule: Every damaging action must spend telegraph frames on-screen before collision or projectile release.
- roleCapRule: Prefer fewer active attackers with stronger tells; staged rooms should not dogpile more than two simultaneous attacks.

Role summaries:
| Role | Preferred range / rule | Tells | Counters |
| --- | --- | --- | --- |
| Cover Shooter | mid | muzzle flash, attack-windup-bar, cover peek frame | crouch, jump lane, destroy cover, grenade |
| Melee Rusher | close | shake pose, lunge crouch, yellow attack bar | jump, blade timing, knockback shot |
| Flyer Harasser | upper-mid |  | jump timing, anti-air shots, safe-lane read |
| Armored Pressure | Armored enemies move slowly, telegraph heavily, and reward rare weapons or explosives instead of spam fire. |  | Hash Rail, grenade, cover bait, vertical reposition |

### Spawn director samples from current model
| Time | Pressure | Interval | Max enemies | Chase share | Ranged share | Elite share | Projectile mult | Health mult | Label |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0m | 0 | 3.2 | 12 | 0.68 | 0.22 | 0.01 | 1 | 1 | opening |
| 2m | 0.1 | 2.92 | 22 | 0.66 | 0.26 | 0.04 | 1.08 | 1.21 | opening |
| 5m | 0.25 | 2.51 | 37 | 0.64 | 0.31 | 0.09 | 1.21 | 1.52 | volatile |
| 10m | 0.5 | 1.81 | 62 | 0.59 | 0.4 | 0.17 | 1.43 | 2.05 | market-crash |
| 15m | 0.75 | 1.12 | 87 | 0.55 | 0.48 | 0.24 | 1.64 | 2.58 | panic |
| 20m | 1 | 0.42 | 112 | 0.5 | 0.57 | 0.32 | 1.85 | 3.1 | survival-wall |

### Enemy spawn sample outputs
| Time | Enemy | Role | Environment | Scaled HP | Scaled DMG | Tier | Tell frames |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0s | Paper Hands | meleeRusher | The Slums: Underchain District | 15 | 10 | 1 | 25 |
| 35s | Paper Hands | meleeRusher | The Slums: Underchain District | 15 | 10 | 1 | 25 |
| 70s | Gas Fee Wisp | flyerHarasser | The Slums: Underchain District | 12 | 9 | 1 | 25 |
| 115s | Rug Rat | coverShooter | The Slums: Underchain District | 10 | 8 | 1 | 25 |
| 180s | Phishing Angler | coverShooter | The Slums: Underchain District | 33 | 19 | 2 | 26 |
| 240s | Gas Beast | armoredPressure | The Slums: Industrial Foundry | 44 | 19 | 2 | 27 |
| 360s | Phishing Angler | coverShooter | The Slums: Industrial Foundry | 37 | 20 | 3 | 28 |
| 600s | Paper Hands | meleeRusher | The Tower: Financial District Ascent | 23 | 13 | 5 | 30 |
| 900s | Honeypot Turret | coverShooter | The Tower: Penthouse Rain | 41 | 21 | 7 | 32 |
| 1200s | FUD Goblin | coverShooter | The Getaway: Mainnet Express | 19 | 13 | 9 | 34 |

OPUS NOTES:
- Several enemy names in generated PixelLab assets differ from current canon (e.g. Trench Degen, Evil Banker, Warren Spear Rider, Bit Whale, Chain Reaper). Decide whether to add them as official enemies/bosses or map them to existing archetypes.
- Add one-paragraph lore/gameplay descriptions for every enemy.
- Define spawn weights by time, biome, and run pressure.
- Define elite modifiers: shielded, fast, burning trail, splitting, explosive death, projectile fan, summoner aura.
- Define power budget so max enemies on map does not become unreadable before the 20-minute wall.


## 11. Boss Roster and Boss Pressure

Target boss count: 10.

| Boss | Specialty | Unlock/source | Stages | Attack patterns | Super moves |
| --- | --- | --- | --- | --- | --- |
| The Rug Pull Baron | tilting rug arena reveals grinding foundry press | Level 1 boss | phase-1-pattern-learn, phase-2-arena-shift, phase-3-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep, homing-orb | screen-wide-warning-blast, desperation-dash-chain |
| Mt. Goxzilla | withdrawals-paused beam and offline weak point | exchange-ruin kaiju | phase-1-pattern-learn, phase-2-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep | screen-wide-warning-blast, desperation-dash-chain |
| The Whale | market-dump pressure waves and flooded platforming | wave-management boss | phase-1-pattern-learn, phase-2-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep, homing-orb | screen-wide-warning-blast, desperation-dash-chain |
| Sir FUD, the Bear King | red-candlestick warhammer, goblin summons, burning floor zones | bear-market knight | phase-1-pattern-learn, phase-2-arena-shift, phase-3-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep | screen-wide-warning-blast, desperation-dash-chain |
| The 51% Hydra | mining-rig heads and central consensus node puzzle | mechanic-puzzle boss | phase-1-pattern-learn, phase-2-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep, homing-orb | screen-wide-warning-blast, desperation-dash-chain |
| Tetherra, the Stable Queen | peg-pillar invulnerability and depeg panic fire | reserve-pillar boss | phase-1-pattern-learn, phase-2-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep | screen-wide-warning-blast, desperation-dash-chain |
| The Maximalist | corrupted Lester mirror duel using player-like moveset | skill-check duel | phase-1-pattern-learn, phase-2-arena-shift, phase-3-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep, homing-orb | screen-wide-warning-blast, desperation-dash-chain |
| Gas Titan (The Congestion) | fee spike floor hazards with low-fee damage windows | timing boss | phase-1-pattern-learn, phase-2-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep | screen-wide-warning-blast, multi-lane-bullet-hell, desperation-dash-chain |
| The Influencer (Mr. NGMI) | Sybil Swarm shield, shill beams, sponsored-post bombs | Level 2 penthouse boss | phase-1-pattern-learn, phase-2-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep, homing-orb | screen-wide-warning-blast, multi-lane-bullet-hell, desperation-dash-chain |
| The Quantum Hacker | three fork phases, illusions, vault damage race, leaked seed-phrase reveal | Level 3 final boss | phase-1-pattern-learn, phase-2-arena-shift, phase-3-enrage | lane-charge, lobbed-projectiles, ranged-burst, floor-shockwave, summon-minions, safe-lane-sweep | screen-wide-warning-blast, multi-lane-bullet-hell, desperation-dash-chain |

Current boss phase rules:
- mini-boss and boss doors pause side scrolling until defeated
- phase transition pauses side scroll and changes arena hazards
- boss super moves require unique wind-up, audio siren, and safe-lane readability

Boss cadence in current source:
- Boss interval target: every 3-5 minutes.
- Scheduler checks 4-minute windows and can spawn during the first 75 seconds of a boss window after the minimum time.
- Current side-scroll language says scroll locks; active isometric pivot should reinterpret this as temporary arena boundaries, boss hazard zones, or spatial pressure inside procedural chunks.

OPUS NOTES:
- Write a full boss design sheet for each boss: silhouette, arena effect, phases, telegraphs, adds, safe zones, counterplay, reward, achievement hooks.
- Decide first boss for vertical slice; probably The Rug Pull Baron or a new isometric-friendly mini-boss from PixelLab assets.
- Define whether normal enemies keep spawning during boss events and at what capped budget.


## 12. Weapons, Combat Moves, and Combat Effects

Weapon naming principle: hybrid arcade weapon names with crypto twist; function-first, not exhausting pun-first

### Primary weapons / upgrades
| Weapon | ID | Type | Rarity | DMG | Pellets | Fire rate | Reload | Range | Ammo | Best for |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The Settler | coin-blaster | starter | starter | 3 | - | 5.8 | 0.7 | mid | infinite | baseline enemy waves and always-has-a-way-out fallback combat |
| The Block Breaker | scatter-shotgun | weapon-pickup | uncommon | 2 | 7 | 2.3 | 1.1 | short cone | 30 | close-range swarms, room clears, and mini-boss armor chips |
| The Hashstorm | auto-miner | weapon-pickup | uncommon | 2 | - | 10.5 | 1.4 | mid-long stream | 90 | Bot Swarms, Liquidation cascades, and holding a line under pressure |
| Spread LTC | spread-ltc | upgrade | rare | 2 | 5 | 3.8 | 0.9 | short-mid cone | timed upgrade | crowd control and flying swarms |
| Hash Rail | hash-rail | upgrade | rare | 9 | - | 1.6 | 1.8 | long piercing beam | timed upgrade | armored enemies, bosses, and lane clears |
| Oracle Slayer | oracle-slayer | weapon-pickup | super-rare | 24 | - | 1.1 | 2.4 | full-screen charged shot | 6 | emergency boss phase deletes and master-run clutch moments |

### Melee
- Name: The Litecoin Blade.
- Damage: 8.
- Range: 58 px.
- Cooldown: 320 ms.
- One-shots: fud-goblin, paper-hand.
- Animation: three-frame clean silver arc-trail slash with LTC spark stamp on successful close-range kills; optional gore only if enabled pre-run

### Throwables
| Throwable | ID | Damage | Radius | Fuse | Role |
| --- | --- | --- | --- | --- | --- |
| Crypto Bombs | satoshi-frag | 14 | 92 | 650 | AOE throwable |
| Hard Forks | chain-cluster | 9 | 40 | 0 | precision straight-line throwable axe |

### Named combat moves to polish
- Settler Shot: default aimed sidearm fire.
- Block Breaker Blast: shotgun cone / close-range crowd clear.
- Hashstorm Spray: full-auto suppressive fire.
- Litecoin Blade Slash: close-range melee finisher.
- Crypto Bomb Toss: arcing AOE throwable.
- Hard Fork Throw: precision straight-line axe throw.
- Hash Rail Charge: long piercing beam pickup.
- Oracle Slayer Shot: rare full-screen charged shot.

### Effects and gore rules
Sparks/effects always enabled:
- alwaysEnabled: True
- style: silver LTC sparks, orange impact sparks, shell casings, muzzle flashes, electric drone shards
- readabilityRole: always-on feedback for hits, parries, pickups, and enemy deaths even when gore is disabled

Blood/gore:
- enabledByDefault: False
- toggleBeforeRun: True
- style: stylized pixel blood splatter and dismemberment chunks only after explicit pre-run toggle

Weapon effects:
| Effect | Description |
| --- | --- |
| Weapon muzzle flash | two-frame yellow/white/blue flash at barrel |
| Shell casings | small brass pixels ejected downward on gunfire |
| Litecoin Blade sparks | silver slash arc plus orange impact sparks; optional gore if enabled |
| Block Breaker smoke cone | short-lived grey/orange pixel cloud |
| Hash Rail afterimage | cyan beam trail and screen line persistence |

OPUS NOTES:
- Decide final move names, cooldowns, ammo/reload rules, and how each weapon scales with roguelike skills.
- Define hitboxes in world/isometric space rather than side-view pixels.
- Add damage typing: bullet, blade, explosive, electric, burn, chain, boss-specific.


## 13. Power-ups and Pickups

| Power-up | ID | Category | Effect | Amount/mult | Duration | Rarity | Sprite brief |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cold Storage | health-pack | health | heal | 35 | - | common | glowing blue hardware-wallet medkit with white LTC heartbeat glow |
| Crypto Bomb Cache | grenade-crate | ammo | grenades | 2 | - | common | matte-black bomb cache stamped with small blue LTC |
| Extra Hard Money Hero | bonus-life | life | life | 1 | - | rare | tiny Lester head icon with silver-blue halo |
| Spread LTC Chip | spread-ltc-chip | weapon | weapon | - | 18 | uncommon | cyan fan chip |
| Hash Rail Core | hash-rail-core | weapon | weapon | - | 14 | rare | glowing white/cyan core |
| 2x Hard Money Multiplier | score-multiplier | score | scoreMultiplier | 2 | 20 | uncommon | gold x2 token with subtle blue rim |
| Cold Wallet Shield | shield-cache | defense | shield | 1 | 12 | uncommon | hovering blue-and-silver hex barrier device |
| Ammo Cache | ammo-cache | ammo | ammo | 30 | - | common | silver magazine crate with orange hazard stripe |
| LTC Cache | ltc-cache | score | scoreBonus | 500 | - | common | sparkling silver coin pile used as pickup accent, not wallpaper |

Current pickup mechanics from code:
- Heal caps at max health.
- Grenade crates add grenades.
- Bonus lives add lives only if lives are finite.
- Weapon pickups temporarily replace the primary weapon and add activePowerUps with duration.
- Score multiplier raises the current score multiplier for its duration.
- Shield cache adds shield charges.
- Ammo cache adds reserve ammo.
- LTC Cache adds pending score bonus.

OPUS NOTES:
- Define actual drop rates by enemy, biome, elite, boss, and luck stat.
- Define XP shard pickup behavior separately from score/LTC pickup behavior.
- Add spawn safety rules so power-ups do not appear inside walls or under enemy death clutter.
- Decide if health/power-up scarcity should change in ranked mode or only by difficulty pressure.


## 14. XP, Level-Up, and Skill Unlock Mechanics

Confirmed rules:
- Kills grant XP or drop XP gems/shards.
- Base XP per kill in current model: 12.
- XP curve: level cost starts at 100 XP and rises by 25 XP per level.
- Level-up pauses gameplay.
- Each level-up offers exactly 2 upgrade options.
- Each level-up gives 1 reroll.
- Skills: 40 total.
- Levels per skill: 5.
- Default stat step: 5% per rank.

Current implementation details:
- Level 1 XP cost starts at 100.
- Cost rises by 25 per level.
- Upgrade choices are seeded, random-looking, and exclude maxed skills.
- Applying a skill increments the skill rank, adds +5% to that skill's stat, unpauses gameplay, and clears pending upgrade choices.

### Skill library (40 skills x 5 levels)
| Skill | ID | Category | Stat | Max | %/rank | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Damage Alpha | damage-alpha | offense | damage | 5 | 5 | +5% weapon damage per rank. |
| Rate of Fire | rate-of-fire | offense | rateOfFire | 5 | 5 | +5% fire-rate per rank. |
| Reload Hands | reload-hands | offense | reloadSpeed | 5 | 5 | +5% reload speed per rank. |
| Street Runner | move-speed | mobility | movementSpeed | 5 | 5 | +5% movement speed per rank. |
| Diamond Hands HP | max-health | defense | maxHealth | 5 | 5 | +5% max health per rank. |
| Cold Wallet Armor | armor | defense | armor | 5 | 5 | +5% damage reduction per rank. |
| Magnet Wallet | pickup-radius | utility | pickupRadius | 5 | 5 | +5% XP pickup radius per rank. |
| Wisdom Candles | xp-gain | economy | xpGain | 5 | 5 | +5% XP gained per rank. |
| Crit Candle | critical-chance | offense | criticalChance | 5 | 5 | +5% critical chance budget per rank. |
| Crit Multiplier | critical-damage | offense | criticalDamage | 5 | 5 | +5% critical damage per rank. |
| Tracer Velocity | bullet-speed | offense | bulletSpeed | 5 | 5 | +5% projectile speed per rank. |
| Fat Rounds | bullet-size | offense | bulletSize | 5 | 5 | +5% projectile size per rank. |
| Piercing Ledger | pierce | offense | pierce | 5 | 5 | +5% pierce budget per rank. |
| Multi-Sig Burst | multishot | offense | multishot | 5 | 5 | +5% multishot chance per rank. |
| Spread Control | spread-control | offense | spreadControl | 5 | 5 | +5% spread control per rank. |
| Hard Rejection | knockback | control | knockback | 5 | 5 | +5% knockback per rank. |
| Dash Settlement | dash-cooldown | mobility | dashCooldown | 5 | 5 | +5% dash cooldown recovery per rank. |
| Gap Runner | dash-distance | mobility | dashDistance | 5 | 5 | +5% dash distance per rank. |
| Self Custody Regen | health-regen | defense | healthRegen | 5 | 5 | +5% regeneration budget per rank. |
| Shield Capacity | shield-capacity | defense | shieldCapacity | 5 | 5 | +5% shield capacity per rank. |
| Frag Yield | grenade-damage | throwable | grenadeDamage | 5 | 5 | +5% grenade damage per rank. |
| Fast Fuse | grenade-cooldown | throwable | grenadeCooldown | 5 | 5 | +5% throwable cooldown recovery per rank. |
| Blast Radius | area-size | throwable | areaSize | 5 | 5 | +5% area size per rank. |
| Buff Duration | duration | utility | duration | 5 | 5 | +5% buff duration per rank. |
| Green Candle Luck | luck | economy | luck | 5 | 5 | +5% drop luck per rank. |
| Reroll Bank | reroll-bank | economy | rerollBank | 5 | 5 | +5% reroll economy per rank. |
| Hard Money Score | coin-score | economy | scoreMultiplier | 5 | 5 | +5% score multiplier per rank. |
| Mempool Tar | enemy-slow | control | enemySlow | 5 | 5 | +5% enemy slow power per rank. |
| Hot Wallet Burn | burn-damage | status | burnDamage | 5 | 5 | +5% burn damage per rank. |
| Chain Lightning | chain-lightning | status | chainLightning | 5 | 5 | +5% chain proc budget per rank. |
| Satellite Wallets | orbitals | summon | orbitals | 5 | 5 | +5% orbital uptime per rank. |
| Drone Damage | drone-damage | summon | droneDamage | 5 | 5 | +5% drone damage per rank. |
| Turret Speed | turret-speed | summon | turretSpeed | 5 | 5 | +5% turret fire-rate per rank. |
| Boss Breaker | boss-damage | offense | bossDamage | 5 | 5 | +5% boss damage per rank. |
| Elite Breaker | elite-damage | offense | eliteDamage | 5 | 5 | +5% elite damage per rank. |
| Contact Punish | contact-damage | defense | contactDamage | 5 | 5 | +5% contact retaliation per rank. |
| I-Frame Ledger | invulnerability | defense | invulnerability | 5 | 5 | +5% invulnerability duration per rank. |
| Second Wallet | revive | defense | revive | 5 | 5 | +5% revive budget per rank. |
| Loot Quality | loot-quality | economy | lootQuality | 5 | 5 | +5% upgrade rarity weight per rank. |
| Global Cooldown | cooldown-global | utility | globalCooldown | 5 | 5 | +5% global cooldown recovery per rank. |

OPUS NOTES:
- Add rarity/weight per skill; current model treats all skills equally.
- Add evolved/build-defining upgrades beyond flat +5% stats.
- Define mutually exclusive branches or synergies if desired.
- Define whether some skills require achievements, character selection, or weapon pickups.
- Add UI copy/icon prompts for every skill and rank indicator.


## 15. Scoring System

Current scoring formula from code:
- Survival: elapsed seconds x 8.
- Distance: inferred or provided meters x 2. If distance is absent, inferred as elapsed seconds x 2.7.
- Kills: kills x 95.
- Bosses: bosses defeated x 1,500.
- Combo: max kill combo x 85 + max damage combo x 3 + no-damage seconds x 4.
- Power-ups: power-ups collected x 175.
- Upgrades: unique weapon upgrades x 325 + 750 rare weapon bonus.
- Coins: coins collected x 15.
- Difficulty: difficulty tier x 120.

### Score examples from current formula
| Scenario | Total | Survival | Distance | Kills | Bosses | Combo | PowerUps | Upgrades | Coins | Difficulty |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3-minute learner run | 6062 | 1440 | 972 | 1710 | 0 | 755 | 350 | 325 | 270 | 240 |
| 8-minute strong run | 22962 | 3840 | 2592 | 8075 | 1500 | 2475 | 1225 | 1725 | 1050 | 480 |
| 18-minute master survival | 60207 | 8640 | 5832 | 24700 | 6000 | 5700 | 3150 | 2375 | 2850 | 960 |

Leaderboard model:
- Top 10 entries per game in current in-memory prototype.
- Sorting: highest score first, then earlier recordedAt.
- Official eligibility requires paid/ranked session and future verifier-signed score summary.
- Season cadences: daily, weekly, monthly, yearly, all-time.

OPUS NOTES:
- Rebalance score for roguelike survival: distance may be less meaningful than time, kills, elite kills, boss kills, build level, and risk modifiers.
- Add anti-farming constraints if enemies can spawn infinitely.
- Decide if no-damage scoring encourages fun or creates degenerate passive play.
- Add score normalization for different characters/loadouts if future characters diverge statistically.


## 16. Achievements and Unlockables

Total achievements in source: 50.

Tier counts:
| Tier | Count |
| --- | --- |
| bronze | 10 |
| silver | 10 |
| gold | 10 |
| platinum | 10 |
| diamond | 5 |
| mythic | 5 |

Unlockable rewards currently listed:
| Unlockable | Type | Unlock condition |
| --- | --- | --- |
| Classic Lester Jacket | skin | starter |
| Litecoin Silver Armor | skin | score 10,000+ in paid mode |
| Lilly Alternate Hero | character | future unlockable after Lester sprite pass |
| Max Mempool Placeholder | character | parked concept, not current canon |
| Hashstorm Permanent Loadout | weapon | Hashstorm Specialist achievement |
| Mainnet Express Rooftop Jukebox Track | music | survive 15 minutes |
| Boss Rush Marquee | cabinet-art | defeat five bosses |
| Untouchable Boss Badge | profile-badge | no-damage boss clear |
| Boss Concept Gallery | gallery | encounter all ten bosses |

### Full achievement list
| Achievement | ID | Tier | Difficulty | Type | Requirement |
| --- | --- | --- | --- | --- | --- |
| Cabinet Pioneer | cabinet-pioneer | bronze | easy | login | {"login":true} |
| First Paid Run | first-paid-run | bronze | easy | paid-run | {"paidRuns":1} |
| First 1,000 Points | first-1000-points | bronze | easy | score | {"score":1000} |
| First Blood | first-blood | bronze | easy | kill | {"kills":1} |
| Ten-Enemy Cleanup | ten-enemy-kills | bronze | easy | kill | {"kills":10} |
| Crypto Bomb Initiate | first-grenade-kill | bronze | easy | grenade | {"grenadeKills":1} |
| Pickup Ready | first-powerup | bronze | easy | collection | {"powerUpsCollected":1} |
| Beat Level 1 Boss | beat-level-1-boss | bronze | easy | boss | {"bossId":"any"} |
| Five-Minute Fighter | five-minute-run | bronze | easy | survival | {"elapsedSeconds":300} |
| Combo Starter | combo-starter | bronze | easy | combo | {"maxCombo":5} |
| Gas Beast Hunter | gas-beast-hunter | silver | medium | enemy-hunt | {"enemyId":"gas-beast","cumulativeKills":50} |
| Goblin Cleanup | goblin-cleanup | silver | medium | enemy-hunt | {"family":"goblin","cumulativeKills":75} |
| Drone Swatter | drone-swatter | silver | medium | enemy-hunt | {"family":"drone","cumulativeKills":60} |
| Grenade Century | grenade-century | silver | medium | grenade | {"cumulativeGrenadeKills":100} |
| Blade Master | blade-master | silver | medium | melee | {"cumulativeMeleeKills":100} |
| Hash Rail Specialist | hash-rail-specialist | silver | medium | weapon | {"weaponId":"hash-rail"} |
| Spread LTC Specialist | spread-ltc-specialist | silver | medium | weapon | {"weaponId":"spread-ltc"} |
| Power-Up Collector | powerup-collector | silver | medium | collection | {"uniquePowerUps":3} |
| 5K Scorecard | score-5000 | silver | medium | score | {"score":5000} |
| 10K Neon Run | score-10000 | silver | medium | score | {"score":10000} |
| Boss Breaker | boss-breaker | gold | hard | boss | {"bossId":"any"} |
| Untouchable Boss Clear | no-damage-boss | gold | hard | skill | {"bossId":"any","noDamage":true} |
| Slums Clear | slums-clear | gold | hard | level-clear | {"stageIndexReached":4} |
| Foundry Clear | foundry-clear | gold | hard | level-clear | {"stageIndexReached":8} |
| Getaway Clear | getaway-clear | gold | hard | level-clear | {"stageIndexReached":13,"bossId":"any"} |
| Big Combo | big-combo | gold | hard | combo | {"maxCombo":15} |
| Damage Chain | damage-chain | gold | hard | combo | {"maxDamageCombo":250} |
| Weapon Collector | weapon-collector | gold | hard | collection | {"uniqueWeapons":3} |
| Lucky Survivor | lucky-survivor | gold | hard | survival | {"elapsedSeconds":600,"lowHealthSurvival":true} |
| Ranked Regular | ten-paid-runs | gold | hard | volume | {"paidRuns":10} |
| Master Survivor | master-survivor | platinum | expert | survival | {"elapsedSeconds":900} |
| 25K Riot | score-25000 | platinum | expert | score | {"score":25000} |
| 50K Legend Run | score-50000 | platinum | expert | score | {"score":50000} |
| Glass Cannon Saint | no-damage-10-minutes | platinum | expert | skill | {"elapsedSeconds":600,"noDamage":true} |
| Full Boss Roster Scouted | all-bosses-scouted | platinum | expert | collection | {"bossesDefeatedCount":10} |
| Enemy Reaper 250 | enemy-reaper-250 | platinum | expert | kill | {"cumulativeKills":250} |
| Enemy Reaper 500 | enemy-reaper-500 | platinum | expert | kill | {"cumulativeKills":500} |
| Grenade Demolitionist | grenade-demolitionist | platinum | expert | grenade | {"cumulativeGrenadeKills":250} |
| Blade Samurai | blade-samurai | platinum | expert | melee | {"cumulativeMeleeKills":250} |
| Power-Up Hoarder | powerup-hoarder | platinum | expert | collection | {"cumulativePowerUps":250} |
| Ranked Regular+ | ranked-regular | diamond | long-haul | volume | {"paidRuns":50} |
| Boss Rush Ten | boss-rush-ten | diamond | long-haul | boss | {"cumulativeBossKills":10} |
| Speed Clear | speed-clear | diamond | long-haul | skill | {"bossId":"any","elapsedSecondsAtMost":480} |
| Hard Fork Hero | hard-fork-hero | diamond | long-haul | grenade | {"stageIndexReached":13,"grenadeKills":20} |
| 30-Combo Signal | max-combo-30 | diamond | long-haul | combo | {"maxCombo":30} |
| 200 Ranked Runs | two-hundred-ranked-runs | mythic | endgame | volume | {"paidRuns":200} |
| 250 Ranked Runs | two-fifty-ranked-runs | mythic | endgame | volume | {"paidRuns":250} |
| Marathon Wallet | marathon-wallet | mythic | endgame | volume | {"cumulativeSeconds":36000} |
| Perfect Boss Gauntlet | perfect-boss-gauntlet | mythic | endgame | skill | {"perfectBossKills":3} |
| Arcade Legend 500 | arcade-legend-500 | mythic | endgame | volume | {"paidRuns":500} |

OPUS NOTES:
- Re-map side-scroller achievements like Slums Clear / Foundry Clear / Getaway Clear to isometric biome milestones or timed boss/arena clears.
- Decide which achievements unlock cosmetics, characters, music, cabinet art, or profile badges.
- Decide if achievements are purely wallet/profile metadata or mintable badges.


## 17. Balancing Sheet

### Difficulty ramp samples from current model
| Time | Tier | AI level | Spawn mult | Projectile mult | Player health mult | Power-up scarcity | Bonus life chance | Boss freq mult |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0s | 1 | 1 | 1 | 1 | 1 | 0 | 0.18 | 1 |
| 120s | 1 | 2 | 1.3333333333333333 | 1.2 | 0.9299999999999999 | 0.08 | 0.16399999999999998 | 1.25 |
| 300s | 3 | 3 | 1.8333333333333335 | 1.5 | 0.825 | 0.2 | 0.13999999999999999 | 1.625 |
| 600s | 5 | 6 | 2.666666666666667 | 2 | 0.6499999999999999 | 0.4 | 0.09999999999999999 | 2.25 |
| 900s | 7 | 8 | 3.5 | 2.5 | 0.475 | 0.6 | 0.06 | 2.875 |
| 1200s | 9 | 10 | 4.333333333333334 | 3 | 0.35 | 0.8 | 0.02 | 3.5 |

### Current hard numbers
- Target FPS: see performance target.
- Target survival run: 20 minutes.
- Pressure curve minute marks: 0, 3, 5, 10, 15, 20.
- Skill stat step: +5% per rank.
- Skill count/ranks: 40 skills x 5 ranks = 200 possible ranks.
- Base XP per kill: 12.
- XP cost: 100 + 25 per level after level 1.
- Health model in legacy combat: paid lives 3, free lives Infinity, invulnerability 900ms.
- Current tactical side-scroll room guidance: 0-4 enemies on screen, 56-frame spawn delay, 132-frame ranged cooldown, 100% player HP with 5% normal hit damage.

### Balance questions for Opus
1. What should a new player's median survival time be after 3 runs?
2. Should the 20-minute wall be a hard win, soft overwhelm, or endless scaling breakpoint?
3. How often should level-ups occur at 1, 5, 10, 15, and 20 minutes?
4. How many upgrades should a strong 20-minute run earn?
5. Should flat +5% ranks remain, or should each skill have bespoke per-rank values?
6. What is the desired enemy density ceiling for readability?
7. Should bosses reward large score bursts, unique skills, or only achievements?
8. Should ranked mode alter spawn/drop RNG, or use identical mechanics with official tracking only?
9. What anti-cheat data must be captured for replay/verification?
10. How should free local scores be visually separated from official paid scores?


## 18. Art, Animation, Audio, and Asset Pipeline Status

### PixelLab isometric production wave 1
- Jobs manifest: `apps/portal/assets/generated/hmh-isometric-pixellab/pixellab-isometric-wave-1-jobs.json`
- Runtime manifest: `apps/portal/assets/generated/hmh-isometric-pixellab/hmh-isometric-pixellab-wave-1.mjs`
- Contact sheet: `apps/portal/assets/generated/hmh-isometric-pixellab/contact-sheets/hmh-isometric-pixellab-wave-1-contact-sheet.png`
- Job counts: `{"completed": 35, "failed": 16}`
- Local PNG count discovered: `105`

Current completed asset groups include:
- 8-direction Lester isometric hero.
- 8-direction Lilly isometric alt hero.
- 8-direction enemy/boss candidates: Trench Degen Chaser, Evil Banker Ranged Shooter, Crypto Bro Rusher, Gas Beast Tank, Rugpull Summoner, Warren Spear Rider Mini-boss, Bit Whale Boss, Chain Reaper Boss.
- Isometric floor/road tiles: asphalt, sidewalk, alley, foundry metal, rooftop tar, financial plaza, sewer grate, neon puddle, curb, chainlink footprint, stairs/ramp, road markings.
- Props: dumpster, garbage can, wood crate, streetlight, traffic barricade, blank neon sign, terminal kiosk, vending machine, dead urban tree, cyber palm tree, broken car.

Failed/missing from Wave 1 include several important gameplay/UI assets:
- Explosive barrel.
- XP shard.
- Health pack.
- Ammo pack.
- Crypto bomb.
- Muzzle flash.
- Impact sparks.
- Projectile trail.
- Level-up burst.
- Boss telegraph ring.
- Upgrade card frame.
- Level-up modal frame.
- Reroll button frame.
- Mobile controls.
- XP bar frame.
- 8-direction cabinet and loot crate objects.

Audio direction:
- Brand spine: synthwave.
- Combat: darksynth / arcade-techno.
- Bosses: heavier riffs, alarms, industrial percussion, phase stingers.
- Voice bark examples: THE SETTLER, BLOCK BREAKER, HASHSTORM, MISSION COMPLETE, HARD MONEY HERO.

OPUS NOTES:
- Decide which PixelLab actors become official canon names vs reference-only generation labels.
- Write a manifest-ready acceptance checklist for each asset: dimensions, directions, anchors, collision footprints, hitboxes, QA status.
- Define sound effects for XP pickup, level-up, reroll, elite spawn, boss warning, and official score submit.


## 19. Current Technical Implementation Surfaces

Current architecture:
- Portal: vanilla HTML/CSS/JavaScript.
- Gameplay: Canvas/Web Canvas prototype.
- State/tests: JavaScript modules + Node test runner.
- Contracts: Solidity MVP skeletons.
- Web3 network target: LitVM LiteForge public testnet.
- Smart-contract helper candidate: dappit.io.

Primary source module:
- `apps/portal/src/arcade-core.mjs`

Important exported constants/functions for future agents:
- Canon/constants: HARD_MONEY_HEROES_CANON, LESTER_BLASTER_ISOMETRIC_ROGUELIKE, LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY, LESTER_BLASTER_ENEMY_CATALOG, LESTER_BLASTER_BOSS_SYSTEM, LESTER_BLASTER_POWER_UPS, LESTER_BLASTER_WEAPON_SYSTEM.
- Platform: LESTER_ARCADE_WALLET_RAILS, LESTERS_ARCADE_V2_APP_SHELL, LITVM_LITEFORGE_NETWORK.
- State: createInitialArcadeState, createPlayerProfile, connectPlayerAccount, startPlaySession, recordScore, buildPlayerArcadeSnapshot.
- Roguelike: buildIsometricRoguelikeRunConfig, createRoguelikeRunState, grantRoguelikeXp, chooseRoguelikeUpgradeOptions, applyRoguelikeSkillUpgrade, getRoguelikeSpawnDirectorAt.
- Balance/scoring: getLesterBlasterDifficultyAt, chooseEnemySpawn, scheduleBossEncounter, calculateLesterBlasterScore, simulateLesterBlasterRun.

Recommended verification commands from repo docs:
- npm test
- npm run check
- npm run contracts:check
- npm run assets:verify
- npm run smoke:portal
- npm run smoke:portal:interactions

OPUS NOTES:
- Recommend a migration plan that moves isometric design from docs into tests, constants, runtime, and UI without breaking current portal flow.
- Add tests that assert active genre/camera/XP/level-up/free-vs-ranked behavior so old side-scroll assumptions do not reappear.


## 20. Claude Opus 4.8 Work Packet: Missing Areas to Fill

High-priority missing design details:
1. Final roguelike design pillars and one-paragraph pitch.
2. Full enemy descriptions, silhouette notes, AI patterns, spawn weights, elite variants, and biome-specific spawn pools.
3. First 3 bosses as complete sheets with phase-by-phase attacks and counterplay.
4. Skill rarity, weights, synergies, evolved upgrades, and non-flat effects.
5. Power-up drop tables and pickup spawn rules.
6. Procedural chunk schema with collision, props, hazards, safe spawn radius, and biome transitions.
7. Score rebalance for isometric survival.
8. Achievement remap from side-scroller stages to roguelike milestones.
9. Anti-cheat/verifier strategy for official ranked score submission.
10. UI states for level-up modal, reroll, XP bar, boss warning, game over, official score submit, and wallet/profile panels.
11. Fullscreen behavior: browser Fullscreen API, canvas resizing, HUD/menu scaling, Esc behavior.
12. Art acceptance checklist for 8-way sprites, VFX, props, and tiles.

Suggested Opus output format:
- Section A: contradictions and stale assumptions.
- Section B: upgraded game design spec.
- Section C: balancing recommendations with tables.
- Section D: enemy/boss design sheets.
- Section E: wallet/platform/anti-cheat recommendations.
- Section F: prioritized implementation backlog with P0/P1/P2 tasks.
- Section G: tests/verification needed before next handoff.

Do not recommend live funds, contract deployment, recurring automations, or public launch changes without explicit Justin approval.


## 21. Open Questions Already in Repo

# Open Questions

- [ ] Confirm LitVM current RPC URL, chain ID, faucet/testnet bridge, and supported stablecoin/token addresses before any contract deployment.
- [ ] Decide first real paid asset: USDC on LitVM, zkLTC, ETH, or multi-asset routing.
- [ ] Decide whether player handles are unique globally and whether they require moderation/reservation.
- [ ] Decide whether achievements start as off-chain records, ERC-1155 badges, or hybrid.
- [ ] Define anti-cheat tolerance for MVP: trusted verifier only, replay upload, deterministic input log, or server simulation.
- [x] Choose first cabinet name: **Hard Money Heroes**.
- [ ] Decide Lester/Lilly art ownership/licensing and get written brand/legal sign-off before any commercial Litecoin-logo/name-heavy/LTC-heavy or pay-to-play launch usage.
