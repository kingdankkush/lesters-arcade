# Hard Money Heroes — Canon Spec

Status: active first playable cabinet canon for Lester's Arcade.

## Identity

- Parent portal: **Lester's Arcade**.
- First playable cabinet title: **Hard Money Heroes**.
- Legacy/placeholder title: Lester Blaster. Keep only as file/API compatibility where already present; player-facing copy should use Hard Money Heroes.
- Main playable character: **Lester**.
- Future unlockable alternate character/skin: **Lilly** with the same moveset, hitbox, and gameplay stats as Lester, but different art/personality.

## Active gameplay direction

As of 2026-06-07, Hard Money Heroes is pivoting from a 2D side-scrolling run-and-gun into an **isometric run-and-gun roguelike / roguelite survival game**.

Confirmed mechanics:

- Free movement around an isometric procedural map, not constant side-scroll.
- 8-way movement and combat readability for heroes, enemies, and bosses.
- Enemies spawn over time, chase the player, or fire ranged attacks.
- Difficulty scales toward a target run length of about 20 minutes before overwhelming the player.
- Kills grant XP.
- Level-up pauses the game and presents two random upgrade options plus one reroll.
- Selecting an upgrade immediately improves stats and resumes gameplay.
- Target skill library: about 40 skills with 5 upgrade levels each.
- Windowed mode remains the embedded site game window; fullscreen mode must fill the entire monitor/device screen.

Detailed pivot and art-agent handoff: `docs/game-design/hard-money-heroes-isometric-roguelike-pivot.md`.

## Tone

Hard Money Heroes should feel like goofy coin-op action mixed with gritty Metal Slug-style crypto satire:

- Rambo-like Lester energy: stubborn, brave, slightly absurd, low-dialogue action hero.
- Crypto/Web3 satire should be broad and readable, not one-note Litecoin branding.
- Litecoin references should be subtle hero-side accents: blue/silver sparks, occasional Ł marks, settlement language, LitVM arcade/payment context.
- Avoid heavy official Litecoin logo/name dependence until brand/legal sign-off exists.

## World

Primary setting: **Litecoin City After Dark**.

The city should feel like a hostile late-night Web3 arcade metropolis: neon, rain, broken terminals, scam billboards, dark alleys, industrial foundries, financial towers, and runaway infrastructure.

## Procedural biome/theme plan

The old side-scrolling level plan is now treated as biome/theme material for procedural isometric chunks rather than fixed left-to-right stages.

1. **The Slums / Underchain District / Industrial Foundry**
   - Visual language: alleys, broken ticker signs, scam posters, pawnshop terminals, steam pipes, molten silver/blue metal.
   - Purpose: onboarding map chunks for movement, shooting, blade use, throwables, pickups, and early mini-boss pressure.

2. **The Tower / Financial District**
   - Visual language: glass towers, holo-tickers, trading desks, liquidation waterfalls, drones, security lasers.
   - Purpose: mid-run enemy escalation, stronger ranged pressure, elite enemies, and arena-like boss hazards.

3. **The Getaway / Mainnet Express**
   - Visual language: train platforms, rail sparks, tunnel lights, city skyline streaks, bridge finale motifs.
   - Purpose: late-run high enemy density, high-score pressure, and final survival escalation.

## Weapons and throwables

Use hybrid arcade names: functional first, crypto flavor second.

- **The Settler** — default infinite sidearm; reliable and readable.
- **The Block Breaker** — shotgun pickup for close-range crowd control.
- **The Hashstorm** — automatic weapon for suppressive fire against swarms.
- **The Litecoin Blade** — Lester's signature close-range melee; one-shots basic grunts, produces sparks by default.
- **Crypto Bombs** — AOE throwables.
- **Hard Forks** — precision thrown axes for high-skill ranged picks.
- Rare/special weapon placeholders retained for later tuning: Hash Rail and Oracle Slayer.

## Power-ups

- **Cold Storage** — health recovery.
- **Cold Wallet Shield** — temporary armor/shield.
- **Crypto Bomb Cache** — throwable refill.
- **Hard Money Multiplier** — score multiplier.
- **LTC Cache** — subtle silver/blue pickup burst; keep branding abstract.

## Enemy catalog

The current enemy canon includes:

- FUD Goblin
- Gas Fee Wisp
- Paper Hand
- Bot Swarm / Sybil Drone
- Rug Rat
- Honeypot Turret
- Slippage Skater
- Phishing Angler
- MEV Reaper
- Liquidation Cascade Golem

Enemies should use clear silhouettes and readable attack tells. Crypto references should be legible jokes/mechanics, not confusing lore.

## Boss roster

Target total: **10 bosses** across repeated/multi-run progression. Bosses should appear roughly every 3–5 minutes in the survival loop.

1. The Rug Pull Baron
2. Mt. Goxzilla
3. The Whale
4. Sir FUD, the Bear King
5. The 51% Hydra
6. Tetherra, the Stable Queen
7. The Maximalist
8. Gas Titan / The Congestion
9. The Influencer / Mr. NGMI
10. The Quantum Hacker

Each boss should support 2–3 stages, 6–8 attack patterns, and 2–3 super moves. Phase transitions should pause/lock the scroll and change hazards.

## Gore and combat effects

- Sparks, muzzle flashes, shell casings, smoke, explosions, and enemy-specific death particles are always allowed.
- Blood splatter and dismemberment are **off by default**.
- Blood/gore must be enabled before a run starts; do not surprise-toggle mid-run.
- The default prototype should communicate this clearly as sparks-first combat.

## Economy and leaderboards

- Free play: practice-only. No parent progress, achievements, high scores, payments, or transactions.
- Paid play: $0.25 simulated credit in prototype.
- Supported future payment rails to investigate: USDC, ETH, LTC.
- Official leaderboard cadences: daily, weekly, monthly, yearly, all-time.
- On-chain MVP scope: profile, score, achievement, payment, and tournament records.

## Audio direction

- Brand spine: synthwave.
- Combat layer: darksynth / arcade-techno.
- Bosses: heavier riffs, alarms, industrial percussion, phase-transition stingers.
- Voice bark examples: “THE SETTLER!”, “BLOCK BREAKER!”, “HASHSTORM!”, “MISSION COMPLETE!”, “HARD MONEY HERO!”.

## Brand/legal caution

Do not ship commercial Litecoin-logo, Ł-heavy, Litecoin-name-heavy, or pay-to-play branding without explicit written sign-off from the appropriate brand owner or legal review. For now, keep references subtle and functional.

## Sprite references already available locally

Verified Justin-provided reference filenames:

- `Lester-Sprites-01.png`
- `Lester-Sprites-02.png`

These should inform Lester's production sprite pass, but the current repo SVGs remain prototype placeholders.
