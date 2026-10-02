# Lester's Arcade: master overhaul list (next update)

Compiled 2026-10-02 against live 2.1.1 (`98ee8071f`). One list that replaces the earlier ones. Inputs:
- the owner's 2026-10-02 requests (★)
- a 169-screenshot playtest of all ten areas
- a code audit of the HMH systems
- a three-game menu audit
- every still-open item from the 09-16 master list, the 09-27 roadmap, the 2.0 handoff register, the 2.1 roadmap and the upgrade guide

Items are ranked by player-visible impact. Sizes: S (about a day), M (a few days), L (one to two weeks), XL (multi-week).

Ranked impact:
- **Presentation** changes nothing a Ranked run can see.
- **Ruleset** changes simulation results. It must ship inside one versioned ruleset bump: map v3, run summary schema 9, verifier gate at the new game version. That way every 2.1.x Ranked run keeps verifying.

## The headline finding

The 2.0 3D hero, enemy and boss models do not render in production. They load only when the child URL carries `actor3dPilot=1` (`apps/hmh-reboot/src/main.mjs:1051`), and the portal never sends it.

Players therefore see the old sprite atlas, which has only idle (2 frames) and run (6 frames). The consequences:
- There is no walk, crouch or cover pose.
- The district bosses (Baron, Lockkeeper, 51% Foreman) draw as the Liquidator sprite, tinted and scaled (`main.mjs:2365`).
- The six new enemies are tinted legacy sprites.

This is why the overhaul "doesn't look much different", and why cover has no animation. Item 1 fixes it.

---

## Tier 1: make it look AAA (biggest visible lift)

| # | Item | What is wrong today (evidence) | What we build | Size | Ranked |
|---|---|---|---|---|---|
| 1 | **3D actors on by default** (heroes, enemies, bosses) | 80-clip 3D library exists but is gated off; heroes are 8–9 MB GLBs each | Blender LOD pass: decimate, texture atlas at 1K/512, meshopt-compressed GLB, target ≤1.5 MB per hero. Quality tiers: 3D high/med on desktop, 3D low on phones, sprite fallback on weak GPUs. Rim light/outline so the hero reads against enemies. Boss scale-up, aura and nameplate. | L | Presentation |
| 2 | **Ground material overhaul** | Every biome is one speckle-noise texture in a different tint ("TV static"); paths are airbrushed blobs | Per-biome layered materials: macro colour variation, mid-scale patches (moss, gravel, cracked stone, mud, sand), micro detail decals (tufts, pebbles, litter, leaves). Path/road kit with edge stones, ruts, curbs, wear. Authored transitions where ground meets walls, water and cliffs. Baked in Blender/Python into the existing splat terrain. | L | Presentation |
| 3 | ★ **Cliff and elevation kit** | Cliffs read as drawn lines or gradient bands. The Meadows–Woods seam has broken wedge geometry. Ramps and decks are flat plank sheets with skewed ends and crease lines. The perimeter fog veil ghosts the hero. One red rock pillar is repeated. | Modular Blender rock-face kit: strata, top lip, base rubble, cast shadow onto lower ground. Ramps get side walls and slope shading. Decks and overlooks get railings and edge trim. Fix the seam geometry and the veil. Replace the repeated pillar with 4–6 variants. | L | Presentation (collision unchanged) |
| 4 | **Lighting model** | Flat even light, no prop shadows, no AO at wall bases, hard-edged light/dark rectangles (Coast north, Meadows beacon) | Directional key light with baked contact shadows and AO for every building and prop. Local light pools (camp fires, lamps, relays). Distance fog and depth tint per area. Remove the rectangular masks. | M–L | Presentation |
| 5 | ★ **Realistic water** | Silver Coast has **no sea**. The river and bayou are flat grey-teal fills with no bank, foam or motion. The current shader has noise ripples and a sky-gradient fake reflection only. | Upgrade the Pixi GLSL water with techniques ported from three.js water and flow-map work: flow map, layered normal scrolling (Gerstner-style), depth tint from the shoreline distance field, wet-edge darkening, animated foam line, shallow caustics, specular glints. Banks get slope geometry. **Silver Coast gets a real sea, surf and beach.** | M–L (sea needs map v3) | Shader: presentation. Sea: ruleset |
| 6 | **District identity and composed centres** | 6 of 10 area centres are empty. Farms has no crops, Pines and Woods have no trees at their centres. The same planters, iris and willow appear in 4 biomes. No landmark is visible from its area's centre. | Biome-specific kits made with ChatGPT concept images, then Tripo, then Blender:<br>• Farms: crop rows, barns, silos, tractors, fences<br>• Pines: dense forest, logging camp<br>• Woods: canopy, ruins, rugpull camp<br>• Coast: boardwalk, docks, lighthouse<br>• Bayou: stilt houses, moss, boats<br>• City: storefronts, branded signage<br>• Fortress: bunkers and mine rigs at proper scale<br>A composed set-piece at every centre, plus landmarks placed inside the view. Placement follows Diablo/Hades rules: paths lead to points of interest, clusters, negative space and sightlines. | XL | Ruleset (new blockers) |
| 7 | ★ **Building and prop placement** | 48 building footprints overlap others (City 18, corridors 17, Fortress 10, Ridge 3). Two area plans dress the same City corridor strip. The Fortress bunker swallows 4 props. The Ridge mine entrance straddles a shelf. The Hashwood capstan house sits 9% in the river. **Untextured brown placeholder bars** stand in the Baron court and near spawn. Buildings mix projections (facade strips beside top-down roofs). Depth-sort bugs: hero over the bayou water tower, rock over the hero on the coast. | A placement validator in the gate checks overlap, cliff edges, shelves and water against the art footprints (S). Then fix every flagged placement, delete the placeholders, re-render buildings in one consistent ¾ top-down projection, and fix sort pivots. | S + M | Ruleset (blockers move) |
| 8 | **Combat FX and boss telegraphs** | Hit FX are hairline rings and lines. Boss telegraphs are flat pink debug boxes. The low-HP overlay is hard-edged rectangular bands. Deaths are a sticker blood oval. | Chunky hit sparks, enemy hit-flash, debris, real muzzle flashes and tracers. Ground-aware blood and death bursts (respecting the gore setting). Textured, animated, rim-lit telegraphs that fill in before the strike. Soft radial low-HP vignette. Boss-framing camera so charges never come from off-screen. | M | Presentation |
| 9 | **Enemy and boss models** | The six new enemies are tinted legacy sprites with copied stats. One enemy reads as a creature, which breaks the human/zombie rule. The Lockkeeper can't be told from the hero. | Own models for the six new enemies, with idle variants, tell/attack, hit/stagger and 2+ deaths. District bosses get supers, stagger and arena interaction (GLBs exist; wire them through item 1). | L | Presentation (stats balance: ruleset) |
| 10 | **Chikun obstacle models** (★ owner add) | Gap, waterfall, storm cloud, canopy, pipe and ground drone are flat Canvas2D shapes with text labels ("WATERFALL", "GAP"). The eagle and flight drone are basic Blender sprites. No owl exists. | ChatGPT concept images in Chikun's cartoon style, then a Tripo base mesh, then Blender retopo, rig and toon shading, then alpha sprite strips (8–16-frame flap/hover loops, WebP, lazy). The storm is layered: cloud layers, rain sheet, lightning flash. The waterfall is a scrolling flow strip with foam and mist particles. No three.js runtime in Chikun, which keeps phones fast. | L | Art: presentation. Owl as a new obstacle kind: course version |

## Tier 2: make it feel great (movement, combat, balance)

| # | Item | Today | What we build | Size | Ranked |
|---|---|---|---|---|---|
| 11 | ★ **Accelerated movement** | Full 240 u/s in 0.08 s, stop in 0.06 s, turns are *faster*; no walk tier | Idle, then walk (0–55% speed), then run, with a ramp of about 0.35 s to full run. A turn over 90° drops speed to about 60% with a short pivot. Stop decelerates run, then walk, then idle in about 0.2 s. Dash stays instant. Walk and pivot clips for every hero (3D path). New movement rules tag that the verifier accepts. | M + walk clips | Ruleset |
| 12 | ★ **Cover that you can see** | Cover works in the simulation (434 faces, ×0.4 / ×0.6 damage) but you enter it implicitly by pushing into a wall. In production the hero stands frozen, with no HUD cue. | Back-to-wall (tall) and kneel (short) poses, peek-fire and leave clips (exist in 3D; ship with item 1). A cover-edge highlight and a shield icon with the reduction. "Blocked" sparks on the cover side. Optional explicit cover button on gamepad. | S–M | Presentation (button: ruleset) |
| 13 | **Combat framing and pacing** | Auto-aim reaches past the camera edge, so for about 2.5 minutes enemies die off-screen. Then a horde from the south kills you in about 40 s behind the objective pill. | Clamp auto-aim to the visible view. Camera biases toward threats. A spawn director with a smooth pressure curve and spawns at screen-ring distance. Remove the scripted first kill. | M | Ruleset |
| 14 | ★ **Power-up respawn timers** | Weapon caches, Time Dilation and Berserk return after 3 minutes; Bonus Life, Hash Rail and Nuke never return. Legacy rewards linger as dead data. | Per-type timers, as a starting proposal to tune with data:<br>• Weapon caches: 90 s<br>• Time Dilation and Berserk: 150 s<br>• Hash Rail: 240 s<br>• Nuke: 300 s<br>• Bonus Life: one per area per run<br>Each pad gets a visible respawn ring and countdown, plus a minimap icon. Delete the dead legacy reward data. | M | Ruleset |
| 15 | ★ **Level-up balance** | XP curve 150·L·(L+1): level 2 after about 2 kills, front-loaded, then slow. 2 cards per offer, 24 upgrades. | A curve that lands about level 15–20 at the Liquidator. 3 cards per offer, with rarity tiers (common/rare/epic) and an S–D grade. A reroll economy. Needs the owner's progression power decision. | M | Ruleset |
| 16 | **Dash and boss dodging** | Dash cooldown 10/8/6 s with 8 ticks of invulnerability, too slow for boss patterns; boss dodge i-frames are open | Cooldown about 3–4 s, a perfect-dodge window, boss-pattern i-frames, a dash trail. | S–M | Ruleset |
| 17 | **Boss engagements** | Phase halts and tells exist; arenas and rewards are thin; district boss rewards equal the Liquidator's | Intro cinematic per boss, phase health bar, arena hazards, supers, stagger windows, distinct rewards (weapon evolution or unique upgrade). Real Ranked runs for every boss added to the honest corpus. | L | Ruleset |
| 18 | **Enemy AI kit** | Approach-and-shoot | Approach slots, flanking around cover, suppress/grenade, retreat/regroup, elites, stuck recovery. | L | Ruleset |

## Tier 3: the run itself (start, objectives, HUD, menus)

| # | Item | Today | What we build | Size | Ranked |
|---|---|---|---|---|---|
| 19 | ★ **Random spawn and parachute intro** | Fixed spawn at the Meadows centre; a long briefing then "Enter Level 1"; no countdown. The verifier hard-codes Meadows as the entry. | 10 preset landing zones, one per area, picked by the run seed (copies the legacy 5-entry pattern). The director scales early pressure to the landing area's tier so a Fortress drop is fair. Cinematic: the camera starts high, the hero parachutes down (Blender parachute model and canopy animation), lands with a dust burst. A "Welcome to the Litecoin Frontier · <Area>" title card, then a 3-2-1 countdown, then the simulation starts at tick 0 on landing, so the drop is presentation only. | M–L | Ruleset (schema 9 derives the entry from the seed) |
| 20 | ★ **Mission objectives** | Only 2 machine objectives. "Press the relay switch" sat at 6–27 m for 3.6 minutes with no ground marker. Rewards are flat. | Objective tracker with ground beacons and edge-of-screen compass arrows. 2–3 objectives per area (defend, escort, sabotage, rescue the prisoners). Reward chests with a choice (weapon, upgrade, gold). Phase-marked boss bar. A post-run route map and stats screen. | M–L | Ruleset |
| 21 | **HUD and screen space** | The top HUD takes 16–24% of desktop height and hides landmarks and caches. Phones keep about a 40% playfield (about 280 world units across). 7 locked weapon chips sit centre-stage. | HUD about half height. Weapons live in the wheel plus one active chip. Corners instead of a full-width bar. Phone layout reclaim: smaller controls, wider field of view. Remove the overlap between the hint banner and the reticle. | M | Presentation |
| 22 | **Death and results in the game** | The standalone child freezes with the HUD still up | "Liquidated" death beat, death recap (killer, damage sources), then the portal results. S–D grade. | S–M | Presentation |
| 23 | ★ **Pause menu with music player** | The pause screen is mostly a black map void with settings hidden below it. HMH has only music on/off. **The portal's Game Menu panel stacks on top of HMH's own pause** (double pause). | Fix the double pause. Pause layout: collapsible map, visible settings, gamepad navigation. A "Now playing" section (prev/play/next, volume, 26-track list) driven over a new optional bridge message, with the portal still owning the audio, so it is presentation only. Music keeps playing while paused so players can pick tracks. The same module serves Chikun and STACKED. | M | Presentation (bridge protocol addition) |
| 24 | **Level-up screen and briefing** | Generic navy cards, no rarity art, a double-render on open. A briefing of about 300 words with the button below the fold; two separate Level 1 intros. | Rarity frames and colour language, 3 cards, proper dim. A short briefing with a route map; merge the two intros into the new parachute intro (item 19). | S–M | Presentation |
| 25 | ★ **Uniform menus across all three games** | Three unrelated styles (HMH cyan glass, Chikun brass-on-navy Impact, STACKED web-app card) plus two dead portal pause skins | A shared "arcade menu kit":<br>• HMH glass components (toggles, radios, sliders, gamepad focus ring, key chips)<br>• Chikun's display type and brass primary button<br>• a 5-variable colour skin per game<br>• the shared icon sprite (`apps/portal/assets/icons/arcade-ui.svg`)<br>• STACKED's menu walker promoted to a shared gamepad walker<br>• one click sound and one 180 ms entrance<br>STACKED splits its single overlay into start, pause, settings and results screens. | L | Presentation |

## Tier 4: other games, platform and health

| # | Item | Size |
|---|---|---|
| 26 | Chikun: gamepad support, haptics, adopt the shared feel module, region lighting and rim light, obstacle-specific deaths; **bug:** the oscillator fallback bypasses mute and volume (`apps/chikun/src/main.mjs:376`) | M |
| 27 | STACKED: phone players cannot reach the music player (launcher hidden, `styles.css:5138`); menu redesign through the kit; more tracks with visualizer themes | M |
| 28 | HMH haptics (weapons, damage, explosions, bosses) with an intensity setting | S–M |
| 29 | Performance: real-phone proof once 3D actors are on by default; Graphics Quality governor (perf steps 7–8); a ten-area perf scenario; shader prewarm before the countdown; per-frame allocations | M |
| 30 | **Visual gate covers the real level**: today `visual:reboot` checks only the retired original map; add ten-area scenes | S |
| 31 | Replay verifier for HMH Ranked (forged summaries can inflate scores about 3–4.7×) plus anti-cheat round 4. Do this before or with the ruleset bump. | L |
| 32 | Bugs found:<br>• boss damage bypasses evidence invulnerability<br>• about 1 s of untextured terrain in evidence mode<br>• tree-canopy fade leaves ghost columns over the hero<br>• level-up modal double-renders<br>• Lockkeeper orbit-shot stall (verify)<br>• `/play/mweb-invaders` throws<br>• Chikun regions smoke race<br>• stale smokes<br>• archive-label assertion | M |
| 33 | Tech health: retire the legacy combat fallback, client error monitoring, repo size (399 MiB vs 350 cap), prune worktrees | M |
| 34 | Carry-overs:<br>• prisoners live (Field Medic, Quartermaster, Pawnbroker, OG Miner)<br>• weapon grips and reloads on all eight weapons<br>• railgun charge VFX<br>• weapon wheel finish<br>• SFX round-robin<br>• per-area ambience<br>• accessibility centre<br>• achievements 2.1c<br>• onboarding first run | L total |

---

## Recommended build order

1. **Wave A: presentation only, no Ranked risk, biggest visible jump.** Items 1, 2, 3, 4, 5 (shader part), 8, 12, 21, 22, 24, 30, plus the bug fixes. Players see a different game, and Ranked is untouched.
2. **Wave B: one ruleset bump (map v3, schema 9, verifier gate).** Items 5 (Silver Coast sea), 6, 7, 11, 13, 14, 15, 16, 19, 20, with item 31 alongside. All simulation changes land together, so Ranked migrates once.
3. **Wave C: cross-game and polish.** Items 10, 23, 25, 26, 27, 28, then 9, 17, 18 and the carry-overs.

Each wave ships through the standard release gate, visual check (now including ten-area scenes), perf probe and owner playtest.

## Tools by job

| Job | Tool |
|---|---|
| Concept and reference sheets | ChatGPT image generation, matched to the existing style refs |
| Base meshes | Tripo (paid credits: owner approval per batch) |
| Retopo, rigging, animation, LOD, baking sprites, AO and contact shadows | Blender (`D:/Apps/Blender/blender.exe`), scripted with Python |
| Terrain materials, splat bakes, placement validator | Python |
| Water, lighting and FX shaders | GLSL in the existing Pixi renderer (techniques from three.js water and flow-map ports) |
| HMH 3D actors | The existing Pixi + glTF actor path |

Chikun and STACKED stay 2D runtimes fed by pre-rendered 3D art.

## Decisions needed from the owner

1. **Version name.** Call this overhaul **2.2** and move HMH Level 2 to 2.3? Recommended, because Level 2 builds on these kits.
2. **Progression power policy** for the level-up rebalance: the open "about −14%" question.
3. **Paid generation budget** for Tripo and ChatGPT batches (Wave A needs ground, cliff and enemy sets; Wave B needs biome kits; Wave C needs the Chikun obstacles).
4. **Owl behaviour in Chikun**: art-only reskin of an existing bird (no course change), or a new obstacle with its own flight pattern (course version bump).
5. **Phone floor for 3D actors**: accept a sprite fallback on low-end phones?

## Excluded by standing decisions

No seasons, events or rivals. No co-op, online multiplayer or fifth hero. No enemy grunt or death-cry audio, no synthesized SFX, footsteps retired. No combat music bed. No physics engine. No Pixi Filter grade or KTX2.

Owner-gated and not in this list: minting, mainnet, jackpot, Chikun art rights and payouts, cabinet panel art, git push and promotions.
