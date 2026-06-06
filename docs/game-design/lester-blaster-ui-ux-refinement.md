# Hard Money Heroes — UI/UX and Gameplay Refinement Pass

Note: this file kept its original `lester-blaster` filename for continuity, but the player-facing first-game title is now **Hard Money Heroes**.

## Experience flow

1. **Lester's Arcade portal**
   - wallet login
   - parent account summary
   - account achievements/progress/transactions/high scores
   - LitVM/dappit build-stack explanation

2. **Cabinet selection**
   - arcade cabinet row
   - SNES-style cartridge shelf
   - locked coming-soon games establish the multi-cabinet platform

3. **Game menu**
   - Start Free Run
   - Insert Credit / Official Paid Run
   - Character Select
   - Loadout
   - Leaderboard
   - Achievements
   - Sound Options
   - Controls
   - Return to Arcade

4. **Hard Money Heroes gameplay**
   - 60fps target
   - fixed-timestep game logic with variable rendering
   - left-to-right side scrolling
   - parallax backgrounds
   - authored levels 1–2
   - level 3 infinite escalating survival run
   - mini-boss scroll locks
   - boss arenas with 2–3 stages

## Controls

Keyboard baseline:

- A/D: move
- Space: jump / double jump
- J: shoot
- K: Litecoin Blade
- L: Crypto Bomb / Hard Fork throwable
- R: reload
- P/Esc: pause/menu, future

Gamepad mapping should mirror arcade controls later:

- D-pad/left stick: move
- A: jump
- X/RT: shoot
- B: knife
- Y/LB: grenade
- RB: swap weapon, future

## Performance target

- Target framerate: **60fps**
- Frame budget: **16.67ms**
- Gameplay loop: fixed timestep logic, variable render
- Pixel art: character/enemy sprites should be pixel-snapped while camera/parallax movement can be float-smoothed

## Levels

### Level 1 — The Slums

- Introduces controls, jumps, shooting, knife, shotgun pickup.
- Parallax layers: moon/water, cranes, container stacks, foreground pier.
- Mini-boss lock: Dock Loader Mech.

### Level 2 — The Tower

- Adds more verticality, faster enemies, drones, train platform hazards.
- Parallax layers: tunnel glow, trains, platform signs, rails.
- Mini-boss lock: Turnstile Brute.

### Level 3 — The Getaway

- Infinite left-to-right survival escalation.
- More enemies, boss battles, less power-ups, higher projectile speed.
- Goal: survive as long as possible and rack up score.

## Score model

Score is earned from:

- survival time
- distance traveled
- enemies killed
- bosses defeated
- kill combos
- damage combos / no-hit streaks
- coins/caches
- power-ups collected
- weapon upgrades
- rare weapon usage
- difficulty tier survived

## Weapons

Starter and pickup/upgrade direction:

- The Settler — baseline infinite pistol/blaster
- The Block Breaker — short-range cone burst
- Auto Miner — automatic combo weapon
- Spread LTC — fan-shot upgrade
- Hash Rail — piercing rare upgrade
- Oracle Slayer — super-rare limited-ammo boss killer
- Litecoin Blade — fast close-range melee option
- Crypto Bomb / Hard Fork — throwable options

Weapon upgrades should improve:

- rate of fire
- damage
- reload speed

## Enemies

Each enemy should have:

- unique silhouette
- 2–3 attack types
- attack telegraph/tell
- class/archetype
- hit animation
- enemy-specific blood/death effect

Example enemy classes:

- FUD Bat — dive and spit
- Rug Goblin — knife lunge, net throw, roll
- Gas Grunt — mortar arc and flame burp
- Botnet Drone — ranged burst, mine drop, laser ping
- Fiat Knight — shield bash, ranged toss, ground stomp
- Oracle Eye — burst, sweep beam, prediction orb

## Bosses

Each boss should have:

- 2–3 phases/stages
- 6–8 attack patterns
- 2–3 super moves depending on difficulty
- readable wind-up animations
- boss music stinger
- scroll-lock arena
- phase-transition hazard or arena change

## Effects and animation

Art direction:

- detailed 16-bit/SNES/Neo Geo-inspired pixel art
- chunky silhouettes
- neon/Crypto arcade palette
- smooth animation at 60fps while preserving crisp pixel edges

Effects:

- stylized pixel blood
- enemy-specific death bursts
- shell casings
- muzzle flashes
- knife hit sparks
- shotgun smoke cones
- hash rail afterimages
- boss phase explosions

## Sound and music

Music direction:

- arcade attract-mode synth
- level-specific driving chiptune/synthwave
- boss tracks with faster BPM and heavier percussion
- level 3 infinite run music should intensify as difficulty rises

SFX direction:

- coin blaster pew
- shotgun pump
- auto-miner rattle
- hash rail charge/fire
- knife slash
- grenade pop
- enemy death splats/explosions
- pickup chimes
- boss sirens

## Current local prototype status

The local app now exposes the refined systems as:

- build-stack panel
- menu/login model
- expanded codex panels
- leaderboard panel
- 60fps Canvas target indicator
- parallax side-scrolling canvas
- bullets, knife, grenades, power-up drops, particles, blood/death effects, mini-boss/boss locks, and score HUD
