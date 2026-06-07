# Hard Money Heroes — Design Bible v2.0

> **2026-06-07 v2.1 update:** The v2 Design Bible remains the accepted content/design canon, but `docs/game-design/hard-money-heroes-build-risk-review-v2-1.md` is now the active implementation/QA/UX risk addendum. Follow v2.1 for sequencing, P0/P1 scope, board separation, exploit mitigations, tests, guest-free UX, and LitVM/EVM setup matrix.

Status: **active canon update** for Hard Money Heroes and Lester's Arcade integration.
Source: `C:/Users/just_/Downloads/Hard_Money_Heroes_Design_Bible_v2.pdf`, extracted locally with `pdftotext -layout` on 2026-06-07T20:40:57Z.
Author pass: Claude Opus 4.8.
Hermes application pass: this markdown normalizes the PDF into repo-usable canon and avoids binary/PDF extraction issues for future agents.

## Authority order

1. Persisted keys are immutable unless there is an explicit migration: `gameId="lester-blaster"`, leaderboard keys, profile schema keys, achievement IDs, score receipt IDs.
2. This Design Bible v2.0 is the active design authority for genre, loop, balance, AI, UX, wallet semantics, and implementation priorities.
3. `apps/portal/src/arcade-core.mjs` is the implemented data model that must be migrated carefully.
4. Older side-scroller docs/constants are **theme pools and migration references only**.

Biggest risk: the repo still contains a coherent side-scroller model. Until constants are renamed, tested, and guarded, future work can accidentally keep extending the wrong game.

## Active identity

- Parent portal: **Lester's Arcade**.
- First cabinet / child dapp game: **Hard Money Heroes**.
- Active genre: **isometric run-and-gun roguelike / roguelite survival**.
- Active world: **Litecoin City After Dark**.
- Main hero: **Lester**.
- Lilly: future unlockable alternate hero/skin inside HMH with same stats/hitbox/moveset, different art/personality.
- Lilly's Lightning / Mempool Mayhem: roadmap-flavor future cabinets until greenlit.
- Max Mempool: parked/non-canon; do not generate final assets unless Justin approves.
- Target network for prototype: **LitVM LiteForge public testnet**, Chain ID `4441` / `0x1159`, native gas token `zkLTC`.
- Prototype credit: `$0.25` simulated entry fee only; no real funds without explicit Justin approval.

## One-paragraph pitch

Hard Money Heroes is a 20-minute isometric roguelite survival shooter set in Litecoin City After Dark: a neon, rain-slicked metropolis built on the wreckage of a failed financial system. You drop in as Lester, a Litecoin commando walking into the panic, and fight escalating waves of crypto-culture villains: rug pullers, gas fiends, shill bots, MEV reapers, and financial bosses farming the chaos. Every kill feeds XP; every level-up pauses the run for a fast two-pick-with-reroll upgrade draft; every run becomes a different build. Survive to the 20-minute Mainnet Express extraction and you win, then optionally push Overtime for leaderboard score. Free play is casual and untracked; ranked play is wallet-bound, paid, verified, and never pay-to-win.

## Design pillars

| Pillar | Meaning |
| --- | --- |
| Readable Chaos | The screen may contain many threats, but it must parse. Enforce via threat budgets, mandatory telegraphs, silhouette-first art, and attack-token caps. If a feature reduces readability, it loses. |
| A New Build Every Run | Drafts must offer branching identity, not only flat +5% stacks. Use rarity, synergy tags, capstones, and evolved upgrades. |
| The Hard-Money Fantasy | The player is sound money; enemies are the rot: fees, scams, hype, manipulation. Lester feels heavy, decisive, and a little goofy. |
| Fair Web3 | Wallet equals identity and stakes, never power. No purchasable gameplay advantage. Ranked uses same mechanics and RNG as free practice. |
| The 20-Minute Arc | A run is a crescendo with a real extraction ending, not an endless treadmill. Overtime is opt-in score-chaser mode. |

## Contradictions resolved by v2

| ID | Conflict | Resolution |
| --- | --- | --- |
| A1 | Code/copy still labels HMH as tactical/side-scrolling run-and-gun. | Introduce active genre/display fields while keeping `gameId="lester-blaster"`. Deprecate old side-scroll constants into a legacy theme pool. |
| A2 | Jump/crouch controls are side-scroll verbs. | Adopt twin-stick/8-way controls. Space becomes dash/dodge; crouch becomes removed or optional focus-fire/slow-walk accessibility. |
| A3 | Enemy names differ between code, canon, and PixelLab actors. | Promote finished PixelLab actors into canonical archetypes or map them as elite/mini-boss variants. |
| A4 | Boss kits are placeholder/copy-pasted and use side-scroll verbs. | Replace with per-boss isometric kits; scroll lock becomes a bounded arena ring. |
| A5 | Score uses side-scroll distance. | Drop distance. Reward time, kills, elite kills, bosses, build depth, biome reached, pickups, and capped no-damage. |
| A6 | Achievements use linear stage indices. | Keep achievement IDs but remap predicates to time/biome/boss/extraction milestones. |
| A7 | Conflicting density models: 112 enemies vs 0-4 on screen. | Replace with one threat-budget director: visible cap + attack-token cap. |
| A8 | Legacy health/lives model says free has infinite lives. | Roguelike uses one life per run; free has unlimited restarts, not infinite lives in-run. Ranked revive only via in-run skill. |
| A9 | The Whale appears as duplicate boss/mini-boss variants. | Consolidate into **The Whale / Bit Whale**, using PixelLab Bit Whale boss art. |
| A10 | The Maximalist conflicts with Bitcoin Maxi laser-eyes concept. | Keep **The Maximalist** as mirror duel. Rename laser-eye summoner to **Orange-Pilled Zealot**. |
| A11 | Lilly appears as cabinet, roster hero, and unlock. | Lilly is an HMH alt hero/skin; Lilly's Lightning remains future cabinet flavor until approved. |
| A12 | Max Mempool vs Mempool Mayhem confusion. | Keep Max Mempool parked/non-canon; Mempool Mayhem is menu flavor only. |
| A13 | Ranked mechanics/RNG unclear. | Ranked/free mechanics and RNG are identical; ranked differs only in entry/receipt/submission/verification semantics. |

## 20-minute run arc

| Act | Window | Biome/theme pool | Boss beat | Purpose |
| --- | --- | --- | --- | --- |
| I — The Slums | 0:00-6:30 | Underchain District + Industrial Foundry: alleys, broken billboards, mint furnaces, conveyors. | ~3:30 Warren the Spear Rider mini-boss; ~6:30 Rug Pull Baron. | Tutorial pressure: movement, aim, first draft choices, arena ring. |
| II — The Tower | 6:30-13:30 | Financial District + Penthouse Rain: chrome/glass, server racks, ring-light glow, rooftop edges. | ~10:00 mini-boss; ~13:30 Mr. NGMI. | Ranged pressure, verticality cues, knockback edges, target-priority fights. |
| III — The Getaway | 13:30-20:00 | Mainnet Express: train cars, vault cars, rooftop rain, wind knockback, rails. | ~17:00 mini-boss; ~20:00 Quantum Hacker final. | Survival wall; elites dominate; extraction tension. |
| Win — Extraction | 20:00 | Board the train. | Win screen and ranked submit prompt. | A real ending. |
| Overtime | 20:00+ | Same run continues. | No new content gates. | Optional high-score mode with steep multiplier/scaling. |

Boss "scroll lock" is now an **arena ring**: when a boss spawns, freeze procedural streaming, draw a bounded circular collision ring around the player, cap ambient spawns to boss add budget, and dissolve the ring on defeat.

## Core loop

1. Drop into a procedural isometric zone; spawn-safe radius clears around spawn.
2. Enemies spawn outside the camera-safe radius and pressure inward.
3. Kills drop XP gems separate from score/LTC pickups.
4. XP fills the bar; level-up pauses simulation.
5. Draft: exactly two upgrade options plus one reroll by default; maxed skills excluded.
6. Pick applies instantly and unpauses.
7. Difficulty ramps on the 0-20 minute curve.
8. Boss beats inject arena rings.
9. Extraction at 20:00 ends the run; Overtime is optional.
10. Free result stays local/practice; ranked result requires explicit signed/off-chain verified submission.

## Controls contract

| Action | Keyboard / mouse | Gamepad | Notes |
| --- | --- | --- | --- |
| Move | WASD | Left stick | 8-way world-space movement rendered through isometric projection. |
| Aim | Mouse | Right stick | Manual aim by default; accessibility auto-aim-nearest and aim-assist cone allowed. |
| Fire | Left mouse / hold | RT | Hold-to-fire; auto reload on empty; manual reload optional. |
| Dash / dodge | Space | A / RB | Replaces jump. Short i-frame window; MVP-in because it defines isometric movement. |
| Throwable | F / Q | LT | Crypto Bomb / Hard Fork cycle. |
| Reload | R | X | Scales with reload skills. |
| Reroll | Tab / right mouse | Y | Only active in level-up modal. |
| Pause | Esc | Start | Esc also interacts with fullscreen; pause first, then prompt fullscreen exit when already paused. |

Ranked receipts should record accessibility assists used during the run for transparency, not exclusion.

## Free vs ranked / paid

| Aspect | Free practice | Ranked / paid |
| --- | --- | --- |
| Cost | $0 | `$0.25` simulated credit in prototype; real asset gated. |
| Mechanics/RNG | Identical director, drops, seed handling, enemy stats. | Identical to free. |
| Run lives | One life; unlimited restarts. | One life; revive only via in-run skill. |
| Writes | Nothing official. | Profile progress, achievements, official score, receipt/session history. |
| Leaderboard | Local `PRACTICE` label only. | Official per-cadence board. |
| Submit | Not applicable. | Explicit opt-in player action at game-over; idempotent by `sessionId`. |

## Procedural chunk schema

Generator assembles 16x16 isometric chunks with 64x32 tiles around the camera.

| Field | Type | Purpose / rule |
| --- | --- | --- |
| `floor` | tileId | Walkable surface art: asphalt, sidewalk, foundry metal, rooftop tar, plaza, grate, puddle. |
| `collision` | 0/1 + footprint | Blocks movement/projectiles unless low-cover. |
| `wallFootprint` | polygon | Building/large-prop base for depth sorting and occlusion fade. |
| `propFootprint` | polygon + zHeight | Dumpster, kiosk, car, sign, tree; zHeight drives occlusion/sort key. |
| `hazard` | enum | steam-grate, smelt-pit, conveyor-vector, press-gate, edge-knockback, sparking-car, gas-vent. |
| `spawnLane` | bool | Valid enemy spawn cell; must be outside camera-safe radius. |
| `pickupLane` | bool | Valid drop cell; never inside collision/hazard/wall. |
| `streamEdge` | bool | Chunk boundary trigger for recycle/streaming. |

Recommended radii:

| Constant | Value | Rule |
| --- | --- | --- |
| `spawnSafeR` | 3.5 tiles | No enemy spawns within this distance of player. |
| `cameraSafeR` | visible bounds + 1.5 tiles | Spawn just off-screen; never pop into view. |
| `despawnR` | 2.0x cameraSafeR | Recycle stragglers to respect budget. |
| `pickupClearR` | 0.75 tile | Minimum drop spacing so pickups do not stack under death clutter. |

Biome transitions: hold the current theme pool for an act window, then use a roughly 10-second seam corridor to blend tileset, props, hazards, enemy pool, music bed, and light color. Bosses sit on seams.

## Biome theme pools

| Biome | Tileset | Hazards | Signature enemies | Mood |
| --- | --- | --- | --- | --- |
| Underchain Slums | asphalt, alley, grate, neon puddle, curb | steam grates, scam-sign flicker, yanked/unstable platforms | Trench Degen, Paper Hands, Rug Rat, FUD Goblin, Gas Fee Wisp | magenta/cyan neon, heavy rain |
| Industrial Foundry | foundry metal, conveyor, smelt rim | conveyor vectors, smelt pits, press gates | Gas Beast, Honeypot Turret, Rugpull Summoner elite | orange molten glow |
| Financial District | chrome plaza, server-rack corridors, glass | atrium drops, elevator edges, rack flanks | Evil Banker, Crypto Bro, Bot Swarm, MEV Reaper | cold blue, sterile white |
| Penthouse Rain | rooftop tar, glass parapet | open-air knockback edges, sponsored-post bombs | Bot Swarm shields, Phishing Angler, Slippage Skater | ring-light gold, storm |
| Mainnet Express | train car, vault car, engine | wind knockback, sparking car, pylon flicker, camera shake | MEV Reaper, Liquidation Cascade Golem, mixed elites | strobing night, speed lines |

## UI / menu state requirements

| State | Must show / behavior |
| --- | --- |
| HUD | Health bar, XP bar/level, timer, weapon/ammo, throwable count, score, combo, active power-ups, minimap blip, biome/act tag. XP at top, health bottom-left, timer top-center. |
| Level-up modal | Two upgrade cards with icon, name, rank dots, effect, rarity frame, synergy tags; simulation paused; keyboard 1/2; reroll button. |
| Reroll feedback | Card flip animation and bank counter decrement; default one reroll per level, reroll-bank skill can carry over. |
| Boss warning | Full-width warning: telegraph ring, siren, boss name plate, `INCOMING`; ambient spawns suppressed for ~2 seconds. |
| Game over | Score breakdown, run stats, biome reached, retry; ranked shows explicit `SUBMIT OFFICIAL SCORE`. |
| Win/extraction | Distinct `EXTRACTED` stamp, final score, Overtime option, submit/retry. |
| Wallet/chain guard | Connect, mock fallback, wrong-chain switch/add, submitting, submitted, submit-failed-retry. |
| Profile | Wallet is primary key; handle, avatar, rank, XP, per-game records, achievements, paid/free counts; sign-out to switch wallet. |
| Scores | Daily/weekly/monthly/yearly/all-time cadence tabs; practice rows greyed/watermarked and not co-mingled with official rows. |
| Settings | Controls, audio, accessibility, network status, gore toggle pre-run only, sign-out. |

## Fullscreen and scaling

- Use browser Fullscreen API only on explicit user gesture.
- Render canvas at device-pixel-ratio with a fixed logical resolution such as 1920x1080 and letterbox as needed.
- Keep pixel art crisp with `image-rendering: pixelated` and `imageSmoothingEnabled = false`.
- Put HUD/menus in a separate scaled layer anchored to safe-area insets.
- Esc first opens pause; if already paused, prompt exit fullscreen.
- Listen for `fullscreenchange` to relayout and auto-pause on involuntary exit.
- Mobile needs on-screen twin-stick, fire, dash, throw buttons.

## Balance decisions

| Question | V2 answer |
| --- | --- |
| Median survival after 3 runs | About 4-6 minutes. New players should reach the first full boss around 6:30 by run 3 but rarely clear Act I. |
| 20-minute wall | Soft win plus optional endless. 20:00 is extraction/win; Overtime scales steeply. |
| Level-up frequency | ~3-4 picks by 1:00, ~12 by 5:00, ~20 by 10:00, ~26 by 15:00, ~30 by 20:00. |
| Strong 20-min upgrades | ~30 picks: six near-max skills or 10-12 broad skills with 2-3 evolutions. |
| Flat +5% vs bespoke | Hybrid: flat common ranks, rank-5 capstones, evolved upgrades, non-linear build-definers. |
| Enemy density ceiling | ~60 visible hard cap; pressure shifts to elites, not raw counts. Attack-token cap controls simultaneous threats. |
| Boss rewards | Score burst, guaranteed rare draft, achievement; no unique permanent powers. Perfect clears add score/achievement only. |
| Ranked RNG | No difference. Ranked changes tracking, receipt, entry, lives policy, and verification only. |
| Anti-cheat data | Seed, deterministic input log, periodic checksums, final summary, verifier signature. |
| Practice vs official visual split | Persistent PRACTICE watermark, greyed rows, not eligible copy; never co-mingle with official rows. |

### XP curve

Replace `100 + 25/level` with a gentle exponential aligned to rising kill income:

`cost(L) = round(45 * 1.12^(L - 1))`

XP income targets:

- Normal kill gem: 6 XP times `xpGain`.
- Elite kill: 30 XP.
- Mini-boss: 120 XP.
- Boss: 400 XP.

### Difficulty ramp

| Time | Tier | AI lvl | Spawn mult | Projectile mult | Enemy HP mult | Elite share | Power-up scarcity | Boss freq mult |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0:00 | 1 | 1 | 1.00 | 1.00 | 1.00 | 0.01 | 0.00 | 1.00 |
| 2:00 | 1 | 2 | 1.30 | 1.10 | 1.25 | 0.04 | 0.08 | 1.25 |
| 5:00 | 3 | 3 | 1.75 | 1.25 | 1.55 | 0.10 | 0.20 | 1.60 |
| 10:00 | 5 | 6 | 2.50 | 1.55 | 2.05 | 0.18 | 0.38 | 2.25 |
| 15:00 | 7 | 8 | 3.30 | 1.95 | 2.55 | 0.25 | 0.55 | 2.85 |
| 20:00 | 9 | 10 | 4.20 | 2.40 | 3.10 | 0.33 | 0.70 | 3.50 |

### Threat-budget spawn director

| Time | Visible cap | Attack tokens | Spawn interval | Chase | Ranged | Flyer | Elite |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0:00 | 18 | 2 | 3.2s | 0.60 | 0.22 | 0.17 | 0.01 |
| 5:00 | 32 | 3 | 2.4s | 0.52 | 0.28 | 0.10 | 0.10 |
| 10:00 | 44 | 4 | 1.7s | 0.45 | 0.32 | 0.05 | 0.18 |
| 15:00 | 54 | 4 | 1.1s | 0.40 | 0.32 | 0.03 | 0.25 |
| 20:00 | 60 | 5 | 0.6s | 0.35 | 0.30 | 0.02 | 0.33 |

Anti-farming: because enemies spawn indefinitely, cap score/XP-per-enemy-type per minute with diminishing returns after thresholds. Corner farming must be worse than progressing.

### Elite modifiers

| Modifier | Effect | Tell | Score multiplier | XP multiplier |
| --- | --- | --- | ---: | ---: |
| Shielded | Front arc absorbs until flanked/broken. | hex shield shimmer | 1.6 | 1.5 |
| Swift | +45% move/attack speed. | cyan motion streaks | 1.5 | 1.4 |
| Volatile | Explodes on death with telegraphed ring. | pulsing red core | 1.7 | 1.6 |
| Splitter | Spawns 2 minions on death. | cracked seams | 1.7 | 1.6 |
| Summoner | Periodic add spawns. | ground glyph | 2.0 | 1.8 |
| Burning Trail | Leaves damaging path. | ember wake | 1.6 | 1.5 |
| Projectile Fan | Ranged spread burst. | charge glow | 1.6 | 1.5 |

## Scoring rebalance

Drop distance. Reward time, kills, elite kills, bosses, build depth, biome reached, power-ups, weapon upgrades, coins, capped no-damage, and Overtime.

| Component | Formula | Why |
| --- | --- | --- |
| Survival | `seconds * 6` | Time matters but should not dominate. |
| Kills | `kills * 80` | Core engagement. |
| Elite kills | `eliteKills * 400` | Rewards engaging true threats. |
| Boss kills | `bosses * 2000` | Milestone payoff. |
| Perfect boss | `+1500 each` | Skill expression. |
| Combo | `maxCombo * 70 + maxDamageCombo * 3` | Aggressive play. |
| Build depth | `playerLevel * 120` | Rewards drafting/leveling. |
| Biome reached | `biomeIndex * 1500` | Rewards arc progress. |
| Power-ups | `powerUps * 150` | Routing decisions. |
| Upgrades | `uniqueWeaponUpgrades * 300 + 700 rare bonus` | Build investment. |
| Coins / LTC | `coins * 12` | Pickup routing. |
| No-damage | `min(noDamageSeconds, 180) * 5` | Rewards clean play without turtling. |
| Overtime | `*(1 + 0.05 per overtime minute)` | Endless score path. |

V2 goal: a clean 8-minute elite-killer can outscore a passive 14-minute turtle.

## Skills, rarity, synergies, evolutions

Current model treats all 40 skills equally and only adds +5%. V2 adds:

- Rarity draw weights: Common 100, Uncommon 55, Rare 22, Epic/Capstone 7, Evolved only when prerequisites are met.
- Synergy tags: fire, chain, summon, crit, aoe, defense.
- Luck and loot-quality can shift draft odds.
- `reroll-bank` can carry unused rerolls.
- Rank-5 capstones on important skills.

| Evolved upgrade | Prerequisite | Effect |
| --- | --- | --- |
| Lightning Ledger | Chain Lightning R5 + Tracer Velocity R3 | Shots arc to 3 enemies; chains briefly slow enemies. |
| Cold Storage Aegis | Cold Wallet Armor R5 + Shield Capacity R3 | Shield regenerates out of combat; first hit each wave fully negated. |
| Satoshi Swarm | Satellite Wallets R5 + Drone Damage R3 | Orbitals become autonomous drones that seek elites. |
| Hard Fork Storm | Frag Yield R5 + Blast Radius R3 | Throwables split into two on impact; bosses take bonus. |
| Diamond Protocol | Diamond Hands HP R5 + Self Custody Regen R3 | Below 30% HP, gain strong regen and damage reduction. |
| Mint Condition | Hard Money Score R5 + Green Candle Luck R3 | Kill streaks bank a temporary score multiplier that pops on level-up. |

## Canon enemy/boss reconciliation

PixelLab actors with finished sprites should become canonical art for the closest archetype. Orphan names become elites/mini-bosses or retire.

| Canon | Role | Art/source disposition |
| --- | --- | --- |
| Trench Degen | Chaser grunt / panic melee | Promote to canon; PixelLab done. |
| Paper Hands | Panic-charge-flee | Keep; zombie/paper-hand sprites. |
| Rug Rat | Dash-knockback disruptor | Keep; reinterpret side-scroll platform yank as iso knockback dash. |
| FUD Goblin | Swarm shambler | Keep as early grunt flavor. |
| Gas Fee Wisp | Hover-taxer / resource tax | Keep. |
| Gas Beast | Armored tank / area-denial gas | Keep; PixelLab Gas Beast Tank art. |
| Honeypot Turret | Stationary bait trap | Keep. |
| Evil Banker | Ranged cover-shooter | Use PixelLab Evil Banker sheets. |
| Crypto Bro | KOL taunt-strafe shooter | Promote to canon; PixelLab Crypto Bro Rusher. |
| Shill Bot | Ranged hype-drone | Promote/keep; separate from human KOL. |
| Bot Swarm / Sybil Drones | Formation flyers | Keep. |
| Phishing Angler | Fake-wallet lure / hook zoner | Keep. |
| Slippage Skater | Overshoot rusher | Keep. |
| MEV Reaper | Elite sandwich-pincer flanker | Keep; Chain Reaper art can map to boss/elite. |
| Liquidation Cascade Golem | Armored elite shockwave | Keep. |
| Rugpull Summoner | Elite/mini-boss summoner | Keep; PixelLab done. |
| Orange-Pilled Zealot | Laser-eye elite summoner | Rename from Bitcoin Maxi concept. |
| Warren the Spear Rider | Mini-boss mounted charger | Promote; PixelLab art ready; first boss-system wiring target. |
| The Rug Pull Baron | Act I boss | First full boss sheet. |
| Mr. NGMI / The Influencer | Act II boss | Sybil drone shield + shill beams. |
| The Quantum Hacker | Act III final | Fork phases, illusions, vault race. |
| The Whale / Bit Whale | Rotating boss-pool | Consolidated boss; PixelLab Bit Whale art. |
| The Maximalist | Mirror duel boss | Keep distinct from Zealot. |
| Chain Reaper | Wave-management boss | PixelLab Chain Reaper art. |
| Sir FUD / Mt. Goxzilla / 51% Hydra / Tetherra / Gas Titan | Later boss-pool entries | Retain as P2; sheets later. |

## Enemy roster target stats

The PDF extraction table was visually compressed; these are the readable V2 rebased stat targets and design roles.

| Enemy | HP | DMG | SPD | Pattern | Tell | Counter | First appearance |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| FUD Goblin | 7 | 7 | 1.8 | Shamble toward player; body-block lanes; slow SELL-arc lob. | `SELL` bubble / mouth tell | Blade one-shot; kite. | 0:00 |
| Trench Degen | 10 | 8 | 2.3 | Erratic chase, lunge bites, staggers between dashes. | twitch crouch | Dodge lunge; shotgun. | 0:00 |
| Paper Hands | 12 | 9 | 2.0 | Panic-charge then flee; collides allies into chaos. | shaking hands | Let it whiff, punish flee. | 0:00 |
| Rug Rat | 8 | 7 | 3.3 | Fast circle, dash-knockback through player. | rug lifts | Knockback shot; blade. | 1:10 |
| Gas Fee Wisp | 10 | 8 | 2.2 | Hover at mid; resource-tax pulse; sticky tar puddle. | pump/body glow | Anti-air; leave puddle. | 0:35 |
| Crypto Bro | 18 | 12 | 1.9 | Taunt-strafe, phone-shot, jump-back flex, panic knife close. | phone flash | Close gap; use cover. | 0:55 |
| Shill Bot | 12 | 10 | 2.1 | Backline drone; hype bursts of 3; FOMO pulse aggro. | ring-light charge | Priority kill; anti-air. | 1:20 |
| Bot Swarm | 9 | 10 | 2.4 | Parent-drone formation, laser ping, scatter on parent death. | red target dot | Kill parent; AoE. | 1:20 |
| Honeypot Turret | 18 | 13 | 0.0 | Disguised as loot; clamp-burst and short spread. | too-perfect glow x2 | Shoot from range. | 1:30 |
| Gas Beast | 32 | 16 | 0.95 | Area-denial gas-tax pulse; slow claw; body check. | chest vents orange | Hash Rail, flank, avoid gas. | 2:00 |
| Phishing Angler | 24 | 16 | 1.2 | Fake wallet lure; hook-reel toward hazard. | glowing lure | Destroy lure, dodge hook. | 3:00 |
| Slippage Skater | 20 | 14 | 3.6 | Slide rush, overshoot, U-turn return. | skate sparks | Sidestep, punish overshoot. | 2:10 |
| MEV Reaper | 34 | 19 | 3.0 | Two-shadow pincer blade strike. | two shadows split | Dash out; i-frames. | 4:00 |
| Liquidation Golem | 54 | 24 | 0.9 | Armored stomp; death-cascade shockwave. | margin-call red flash | Explosives, reposition. | 6:00 |
| Rugpull Summoner | 40 | 14 | 1.3 | Summon aura spawns Rug Rats; teleport relocate. | ground glyph | Burst it fast. | 5:30 |
| Orange-Pilled Zealot | 46 | 18 | 1.1 | Laser-eye beam; HFSP FUD AoE; cultist summons. | eyes charge red | Dash beam; kill during cooldown. | 8:00 |

## Boss sheets

### Mini-boss: Warren the Spear Rider

- Role: mounted charger / Slums mini-boss around 3:30.
- Why first: art appears ready; lowest-risk boss/arena-system proving target.
- Phase 1: telegraphed line charge across arena; spear sweep on pass. Tell: horse rears, dust kick. Counter: sidestep perpendicular, punish recovery.
- Phase 2 under 50%: cross-pattern charge; throws feathered spears in 3-fan between charges. Tell: spear raised + glint. Counter: dash the fan, DPS between charges.
- Adds: none. Reward: ~900 score + uncommon draft. Achievement: mini-boss-specific bronze or generic boss hook.

### Boss 1: The Rug Pull Baron

- Role: Act I / Slums seam boss; vertical-slice full boss.
- Silhouette: con-artist tycoon on ornate rug platform over foundry press pit.
- Arena: circular foundry platform; rug segments pull away to reveal grinding press; safe floor shrinks.
- Adds: Rug Rats only, capped at 3.
- Phase 1: lobbed coin bombs with shadow markers, ranged burst, summon Rug Rats.
- Phase 2: rug-pull floor drops, homing liquidity orb, radial floor shockwave.
- Phase 3: desperation dash-chain, siren + ring blast, one safe wedge.
- Super: Liquidity Drain; survive warning blast, then vulnerable window.
- Reward: ~2,000 score + guaranteed rare draft + beat-level-1-boss unlock. Perfect clear adds no-damage-boss bonus.
- Counterplay identity: spatial discipline; floor itself is the threat.

### Boss 2: Mr. NGMI — The Influencer

- Role: Act II / Penthouse seam boss.
- Silhouette: ring-light haloed mega-KOL with rotating Sybil Drone shield.
- Phase 1: rotating drone shield with gap, shill-beam sweep, sponsored-post bombs.
- Phase 2 under 50%: shield drones become aggressive; engagement bullet-hell with readable safe lanes; homing like-orbs.
- Super: Going Viral; multi-lane bullet-hell with siren and clearly lit safe lanes.
- Reward: ~2,000 + guaranteed rare draft; unlocks Mainnet Express jukebox track on first clear.
- Counterplay: target priority and lane-reading.

### Boss 3: The Quantum Hacker

- Role: Act III final / extraction gate.
- Silhouette: glitching hooded figure with holographic vault; reality forks between phases.
- Fork 1: ranged burst grids, floor-shockwave rings, Bot Swarm summons.
- Fork 2: two decoys; real one has faint seed-phrase shimmer; homing orbs; arena data shards.
- Fork 3: vault DPS race against draining timer; bullet-hell and dash-chain; failing the race heals boss.
- Super: Seed Phrase Reveal; warning plus bullet-hell; weak point exposed once the real seed appears.
- Reward: run-completion/extraction; `getaway-clear` remaps to defeating Quantum Hacker.
- Counterplay: synthesis of reads, target ID, burst timing, hazard movement.

## Heroes and barks

| Hero | Identity | Sample barks |
| --- | --- | --- |
| Lester | Starter. Stoic, dry, heavy. Litecoin City commando walking into panic. Blue/silver accents, readable blade arc. | “Hard money never blinks.” “Settled.” “Stay liquid.” “That's a rug.” “MISSION COMPLETE.” |
| Lilly | Unlockable alt hero/skin. Same stats/hitbox/moveset; teal palette; faster-talking, sardonic. | “Cheap, fast, done.” “Two confirmations and you're gone.” “Lightning fast.” |
| Max Mempool | Parked / non-canon. | No final assets until greenlit. |

## Wallet, platform, and anti-cheat

Hard guardrail: this is design guidance only. Do not deploy contracts, move real funds, enable recurring automation, or change public launch settings without explicit Justin approval. Prototype stays testnet/simulated.

### Identity/data

- Keep `gameId="lester-blaster"` and all leaderboard/achievement IDs immutable.
- Wallet is the primary key.
- Handles: globally unique, reserved, 3-18 chars, profanity-filtered, rate-limited changes.
- Optional on-chain handle commitment later; off-chain index first.
- Score submit is explicit at game-over, idempotent by `sessionId`, with inline chain-guard status.

### Anti-cheat/verifier

| Layer | Capture | Verifier action |
| --- | --- | --- |
| Determinism | Fixed timestep sim, single seeded RNG stream, version tag, no wall-clock randomness. | Re-sim must reproduce score bit-for-bit. |
| Input log | Per-tick input deltas + seed + build hash. | Replay input log and recompute outcome. |
| Checksums | Periodic state hash: position, HP, score, RNG cursor. | Any mismatch rejects. |
| Summary | Final stats packet. | Verifier signs; only signed summaries become official leaderboard-eligible. |

MVP path: trusted client plus server re-simulation from input log. Store input logs off-chain; put only signed summary + receipt on-chain.

### Economy/modules

- First prototype paid asset recommendation: **testnet zkLTC**, because it is native gas and simplest UX. Real asset choice remains Justin-gated.
- Router should be asset-agnostic for later USDC/LTC/multi-asset support.
- Revenue split stays simulated until approved: 40% infrastructure, 35% developer, 15% tournament, 10% community.
- Achievements: off-chain first; optional ERC-1155 claim later; never auto-mint by default.
- Disconnect/abandon: wrong chain blocks submit with guidance; disconnect mid-paid-run marks session abandoned with no double-charge/no score; duplicate submit idempotent no-op.
- Confirm current LiteForge RPC, chain ID, faucet, and token addresses against official docs before any deploy.
- Brand/legal gate: heavy Litecoin/LTC logo/name/pay-to-play usage needs written brand/legal sign-off before commercial or real-funds launch.

## LitVM / EVM compatibility baseline

Verified against project constants and LitVM docs fetched on 2026-06-07:

| Field | Value |
| --- | --- |
| Network name | LitVM LiteForge |
| Chain ID | `4441` (`0x1159`) |
| Native currency | `zkLTC`, 18 decimals |
| HTTP RPC | `https://liteforge.rpc.caldera.xyz/http` |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Repo faucet/hub URL | `https://liteforge.hub.caldera.xyz` |
| Portal | `https://testnet.litvm.com` |
| EVM version in docs | Shanghai |

Wallet connector expectations:

- Use EIP-1193 injected wallets first: MetaMask, Rabby, compatible EVM wallets.
- Normalize decimal and hex chain IDs.
- Provide `wallet_switchEthereumChain` for `0x1159`.
- Provide `wallet_addEthereumChain` fallback with RPC/explorer/native currency params.
- Mock wallet remains local/offline QA fallback only.
- Never request private keys or seed phrases.

## Implementation backlog

### P0 — vertical slice

- Isometric camera, 8-way movement, mouse aim, fire, dash with i-frames.
- Deterministic sim foundation: fixed timestep, seeded RNG, input log.
- One Slums biome using B6 chunk schema.
- Five enemies: Trench Degen, Paper Hands, Rug Rat, Evil Banker, Gas Beast.
- XP / level-up / two-pick + one reroll with around 12 core skills.
- The Settler + one pickup weapon + blade + one throwable.
- Warren mini-boss + arena ring.
- HUD, game-over, free-mode loop end-to-end.
- Constant rename and side-scroll deprecation shims.

### P1 — full first cabinet

- Full enemy roster + elite modifiers and time/biome spawn weights.
- Three biomes and seam transitions.
- Bosses 1-3 plus three mini-bosses.
- Full 40 skills, rarity, six evolutions.
- Ranked mode wallet rails, explicit signed submit, verifier re-sim.
- Missing VFX/UI assets: XP shard, health pack, ammo pack, crypto bomb, muzzle flash, impact sparks, projectile trail, level-up burst, boss telegraph ring, card/modal frames, XP bar frame, mobile controls, 8-dir loot crate/cabinet.
- Fullscreen + mobile twin-stick.
- Scoring rebalance + golden tests.

### P2 — depth / meta / platform

- Bosses 4-10 full sheets.
- Achievement remap + optional ERC-1155 badge claims.
- Overtime/endless + leaderboard cadence polish.
- Cosmetic-only unlocks: Lilly, skins, jukebox, cabinet art.
- Tournaments, multi-asset payment, third-party cabinet registration after approvals.

## Tests and verification targets

| Test | Assert |
| --- | --- |
| genre-guard | Active genre is `isometric-run-and-gun-roguelike`; cabinet camera is isometric. |
| controls-contract | No active side-scroll jump/crouch outside `legacyInput`. |
| levelup-draft | Exactly two options + one reroll; maxed skills excluded; pick applies/unpauses. |
| xp-curve | Cost curve matches v2; sim hits ~30 level-ups at 20 min within tolerance. |
| free-writes-nothing | Free run writes zero profile/score/achievement/tx. |
| ranked-packet | Ranked submit builds parent-sync packet; duplicate `sessionId` idempotent. |
| determinism-golden | Same seed + input log gives identical score/checksums. |
| verifier-reject | Tampered log/checksum is rejected and not leaderboard-eligible. |
| threat-budget | Visible cap and attack-token cap never exceeded over 20 min. |
| anti-farm | Corner farming underperforms active progression. |
| score-golden | V2 formula reproduces example totals. |
| boss-scheduler | Boss windows and arena ring spawn/dissolve behave correctly. |

Recommended local gates after code changes: `npm test`, `npm run check`, `npm run contracts:check`, `npm run assets:verify`, `npm run smoke:portal`, `npm run smoke:portal:interactions`.

## Asset acceptance checklist

- Dimensions documented; consistent actor sizes; atlas-friendly.
- Direction coverage: 8 directions for heroes/directional enemies; fewer acceptable only for small flyers.
- Anchors: foot/origin anchor identical across frames/directions.
- Collision footprint: iso-space ellipse/poly, not full sprite rectangle.
- Hitbox separate from collision and documented per state.
- Animation set: idle, move, attack/aim, hurt, death; boss specials where direction matters.
- QA status in asset manifests; failing assets are not runtime-wired.
- No pseudo-text, fake logos, watermarks, or heavy official Litecoin marks without approval.

## Resolved / carried open questions

| Question | V2 recommendation | Status |
| --- | --- | --- |
| First real paid asset | Testnet zkLTC for prototype; asset-agnostic router; real choice gated. | Needs Justin sign-off before real funds. |
| Handle uniqueness | Globally unique, reserved, filtered, rate-limited. | Recommended. |
| Achievements on/off-chain | Off-chain first; optional ERC-1155 claim later. | Recommended. |
| Anti-cheat MVP | Deterministic input log + server re-sim + signed summary. | Recommended. |
| Future cabinets real/flavor | HMH real; Lilly's Lightning and Mempool Mayhem roadmap flavor until greenlit. | Recommended. |
| Portal branding | Lead Litecoin/LitVM identity; architect rails for third-party cabinets later. | Recommended. |
| Third-party cabinet registration | GameRegistry with dev/economy settings and official records. | Decide spec in P2. |
| Lester/Lilly/LTC logo licensing | Written sign-off before commercial/real-funds launch. | Legal gate. |
| LitVM RPC/faucet/token addresses | Verify official docs before deploy. | Verify before deploy. |
