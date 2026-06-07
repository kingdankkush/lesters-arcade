# Hard Money Heroes — Isometric Roguelike Pivot

- Status: active design pivot requested by Justin Pinter
- Date: 2026-06-07
- Parent portal: Lester's Arcade
- Cabinet/game: Hard Money Heroes

## Decision

Hard Money Heroes is pivoting from a 2D side-scrolling run-and-gun shooter into an **isometric run-and-gun roguelike / roguelite survival game**.

The new player fantasy is: Lester drops into a procedurally generated Litecoin City After Dark combat zone, moves freely across an isometric map, survives escalating enemy pressure, earns XP from kills, levels up, and builds a run through randomized stat/skill augments until the run becomes overwhelming around the 20-minute mark.

This replaces the old constant side-scroll structure. The game should still feel like Hard Money Heroes: retro arcade, pixel art, goofy/gritty crypto satire, sparks-first combat, free-vs-paid arcade cabinet flow, and official leaderboard support for paid/ranked runs.

## Why this pivot makes sense

- Broader modern roguelite appeal: closer to the replay loops of Vampire Survivors, Brotato, Risk of Rain, Enter the Gungeon, Hades, and The Binding of Isaac.
- Better replayability: procedural maps, randomized upgrade choices, and escalating enemy density create different runs.
- Stronger leaderboard fit: a 20-minute survival curve gives score, kill count, boss count, build quality, and survival time meaningful ranking value.
- Asset reuse is still practical: many 2D buildings, trees, garbage cans, street props, signs, effects, pickups, and UI assets can be adapted, while characters/bosses need new directional animation coverage and levels need isometric tilesets.

## Core gameplay pillars

1. **Isometric arcade run-and-gun**
   - Player can move freely around an isometric map instead of being locked to left-to-right side scrolling.
   - Combat should be readable at arcade speed: clear silhouettes, clear projectile paths, strong hit feedback, and obvious enemy telegraphs.

2. **8-way movement and combat readability**
   - Heroes, enemies, and bosses need 8-direction animation support: N, NE, E, SE, S, SW, W, NW.
   - Movement, aim/shoot, reload, hurt, death, and major attack animations should read correctly from each direction.
   - Existing left/right side-view sheets can be used as style reference, but not as final coverage for isometric movement.

3. **20-minute survival run target**
   - Runs should feel manageable early, dangerous by the middle, and nearly impossible around 18–20 minutes.
   - Difficulty increases through enemy quantity, enemy tier, projectile density, elite modifiers, boss pressure, and reduced safe space.

4. **XP and buildcraft loop**
   - Kills award XP directly or drop collectible XP shards/coins.
   - Leveling pauses the game.
   - Each level-up presents exactly **two random skill upgrade options** and **one reroll**.
   - Choosing an upgrade immediately applies stat changes and unpauses the run.

5. **Large augment library**
   - Target: about **40 skills**, each with **5 upgrade levels**.
   - Skills should include simple stat upgrades and more interesting build-defining upgrades.
   - Early prototype can ship with fewer skills if the data model already supports the full 40x5 structure.

6. **Free-vs-ranked Web3 separation remains intact**
   - Free play remains local/practice only.
   - Ranked/paid play remains the only path eligible for official leaderboard/progress/achievement/payment state.
   - Gameplay mechanics can be identical across modes; official state writes remain gated to ranked/paid completion and explicit submit flows.

## Recommended control model

Primary desktop recommendation:

- **WASD / left stick:** 8-way movement.
- **Mouse / right stick:** aim direction.
- **Left click / right trigger:** fire.
- **Reload:** automatic when empty, with optional manual reload key.
- **Dash/evade:** optional active defensive move after the core loop works.

If production scope requires simpler inputs, the prototype can initially use movement-facing aim: Lester fires in the last movement direction. However, the long-term target should support twin-stick-style movement and aim because it fits isometric run-and-gun combat better.

## Run pacing target

| Time | Intended feel | Director behavior |
| --- | --- | --- |
| 0:00–2:00 | onboarding pressure | basic chasers, slow ranged enemies, generous XP |
| 2:00–5:00 | first real build decisions | mixed chasers/ranged, first elites, first mini-boss event |
| 5:00–10:00 | build identity emerges | higher spawn budget, enemy packs, terrain pressure, boss every ~3–5 minutes |
| 10:00–15:00 | high intensity | elites, projectile patterns, hazardous zones, stronger boss modifiers |
| 15:00–20:00 | survival squeeze | dense swarms, layered ranged fire, limited safe paths, final boss/escalation window |
| 20:00+ | intended overwhelm | endless director scaling; survival past 20 minutes is exceptional |

## Procedural map direction

The map should feel like a shifting isometric version of Litecoin City After Dark:

- Streets, alleys, rooftops, foundry yards, plazas, terminals, train platforms, and financial district blocks.
- Procedural chunk/tile assembly rather than fully hand-authored side-scrolling levels.
- Spawn-safe zone around the player to prevent unfair enemy pop-ins.
- Depth sorting and occlusion handling for buildings/trees/props.
- Props can be decorative, destructible, collidable, explosive, or cover-like depending on tuning.

Suggested generator structure:

1. Pick biome/stage theme.
2. Assemble isometric chunks around the player path/camera area.
3. Place navigable ground, walls/building footprints, props, hazards, and pickups.
4. Maintain enemy spawn lanes outside the immediate camera-safe radius.
5. Stream or recycle chunks as the player moves to create an endless-feeling battlefield.

## Enemy and boss behavior

Enemy categories should be readable and mechanically distinct:

- **Chasers:** run directly toward the player, teach movement/kiting.
- **Ranged shooters:** stop or strafe, fire slow readable shots.
- **Rushers:** fast, fragile, force reaction movement.
- **Tanks/bruisers:** slow, high health, block space.
- **Summoners/spawners:** create adds or hazards.
- **Turrets/traps:** zone control.
- **Elites:** modified versions with extra speed, projectiles, shields, trails, or death effects.
- **Bosses:** appear as timed pressure events, with isometric telegraphs and phase-based patterns.

Bosses should be redesigned for arena/survival pressure rather than side-scrolling scroll locks. A boss can enter the procedural space, force temporary arena boundaries, or add boss-specific hazards while normal enemies continue at a controlled budget.

## XP, level-up, and upgrade rules

Confirmed rules:

- Kills grant XP.
- XP levels the player up.
- Level-up pauses all gameplay simulation.
- The player sees two randomly selected upgrade options.
- The player has one reroll option per level-up event.
- After a skill is selected, the game unpauses and updated stats take effect immediately.

Upgrade model guidance:

- 40 skills x 5 levels = 200 possible upgrade ranks.
- Each skill should define: id, display name, category, max level, level effects, stack rules, rarity/weight, icon, and short player-facing description.
- Simple stat upgrades are good early options, but the full library should also include build-shaping effects.

Example skill categories:

- Damage: +5% damage per level, crit chance, crit damage, boss damage.
- Fire rate: +5% rate of fire per level, burst fire, overheat control.
- Reload/ammo: +5% reload speed per level, magazine size, ammo recovery.
- Movement: +5% movement speed per level, dash cooldown, slow resistance.
- Survivability: max health, armor, shield recharge, invulnerability window.
- Crowd control: knockback, stun chance, slow fields, fear pulse.
- Projectile behavior: pierce, bounce, split shot, ricochet, projectile speed.
- Area/VFX: explosion radius, burn trail, chain lightning, spark nova.
- Economy/XP: XP gain, pickup radius, luck, reroll improvement, magnet pulse.
- Weapon identity: Settler, Block Breaker, Hashstorm, Litecoin Blade, Crypto Bomb, Hard Fork synergies.

## Fullscreen requirement

The existing fullscreen mode is too small. The intended behavior is:

- **Windowed mode:** the smaller embedded game window/card on the Lester's Arcade site.
- **Fullscreen mode:** the game expands to the entire monitor/device screen, not just a slightly larger embedded panel.

Engineering acceptance criteria:

- Use the browser Fullscreen API on the game shell/canvas container.
- Resize the canvas/render viewport to the full available screen dimensions.
- Preserve pixel-art crispness with intentional scaling and `imageSmoothingEnabled = false` where applicable.
- No scrollbars or clipped UI in fullscreen.
- HUD, pause menu, level-up modal, game-over screen, and mobile/landscape layouts must scale with the full viewport.
- Esc/browser exit fullscreen should return cleanly to windowed mode.

## Art-agent directive: Pixellab API + design tools

Art agents working on Hard Money Heroes should immediately shift asset production toward the isometric roguelike pivot.

Use **Pixellab API** and other approved design tools to create, iterate, clean, and package the additional assets required for:

1. isometric camera/world rendering,
2. 8-way character/enemy/boss animation,
3. procedural tilesets/chunks,
4. roguelike upgrade UI/icons,
5. survival-wave combat VFX and pickups.

Do not generate final production art as isolated pretty images only. Every useful output needs to become runtime-ready or manifest-ready: transparent PNGs, atlases, sliced frames, contact sheets, metadata, prompts/seeds/settings, and acceptance notes.

### Asset priority order

P0 — unblock playable isometric prototype:

- Isometric ground tiles: asphalt, sidewalk, alley floor, foundry floor, roof, road markings, grates, puddles.
- Isometric collision/edge tiles: curbs, walls, building footprints, fences, barriers, stairs/ramps if needed.
- Lester 8-way base sheet: idle, run, aim/shoot, reload, hurt, death.
- Basic enemy 8-way sheets: one chaser, one ranged shooter, one tank/bruiser.
- Core VFX: muzzle flashes, projectile trails, impact sparks, XP shard/coin pickup, level-up burst.
- UI: level-up modal, two upgrade cards, reroll button, XP bar, timer, difficulty indicator.

P1 — make the loop fun:

- Additional enemy archetypes: rusher, turret/trap, summoner, elite variants.
- Boss 8-way movement/attack/telegraph/death coverage for first timed boss.
- Isometric prop conversion: garbage cans, crates, cars, terminals, signs, trees, pipes, streetlights, dumpsters.
- Projectile variants for The Settler, Block Breaker, Hashstorm, Crypto Bombs, Hard Forks, and boss attacks.
- Upgrade/skill icons for the first 15–20 skills.

P2 — production depth:

- Full 40-skill icon library with 5-level visual progression or clear level badges.
- Multiple biome tilesets/chunk kits: Slums, Tower/Financial District, Foundry, Train/Getaway.
- Elite/boss variant palettes and VFX.
- Environmental hazards: lasers, puddles/electric arcs, molten spills, falling signs, scam-billboard glitches.
- Decorative key art and cabinet/splash polish after the playable loop is stable.

### 8-way animation coverage request

For every playable hero, enemy, and boss, request or audit these states:

- idle: 8 directions
- run/move: 8 directions
- aim/shoot/attack: 8 directions
- reload/recover: 8 directions where relevant
- hurt/stagger: at least front/back/side, ideally 8 directions
- death/defeat: front/back/side variants acceptable for smaller enemies; bosses need richer defeat animation
- special/boss attacks: direction-specific where the attack direction matters

Minimum prototype compromise: use 8-direction idle/run/shoot plus mirrored or reduced hurt/death coverage. Production target: full 8-way coverage for every major runtime state.

### Pixellab/design prompt guidance

Prompt traits to preserve:

- isometric pixel art sprite sheet
- retro 80s/90s arcade game style
- Litecoin City After Dark: neon rain, dark alleys, industrial foundry, financial district satire
- crisp silhouettes and readable 8-direction animation
- transparent background for sprites/props/VFX
- no text, no fake logos, no watermarks, no pseudo-letters
- subtle blue/silver crypto energy, avoid heavy official Litecoin branding unless explicitly approved

Example prompt skeleton:

> Isometric pixel art sprite sheet for [actor/asset], retro arcade run-and-gun roguelike, 8-direction movement/combat readability, neon rainy Litecoin City After Dark mood, crisp silhouette, limited pixel palette, transparent background, no text, no logos, no watermark. Include [states/frames]. Camera angle consistent across all frames.

### Delivery rules for art agents

Each asset batch should include:

- raw generated outputs,
- cleaned transparent PNGs,
- sprite atlas or tileset PNG,
- individual sliced frames when applicable,
- contact sheet preview,
- manifest JSON/ESM with dimensions, frame counts, animation names, direction labels, anchor points, collision/hitbox notes, and source prompt/seed/settings,
- short QA notes: accepted, needs cleanup, rejected, or reference-only.

Runtime path rule:

- Final accepted assets must be copied into the repo asset tree before integration.
- Do not leave builds dependent on Desktop, Downloads, temp files, or external generation folders.

QA checks:

- No pseudo-text/logos/watermarks.
- Direction labels match actual visual direction.
- Character feet/anchor points do not jump between frames.
- Pixel scale is consistent across actors and tiles.
- Props include collision footprint guidance.
- Isometric tiles line up without seams.
- Sprites remain readable at intended gameplay scale.
- Existing 2D props are reused only when they still look correct from the isometric camera.

## Engineering implementation backlog

Recommended order:

1. Update the canonical game model/tests to mark the isometric roguelike pivot as active.
2. Replace side-scroller assumptions with isometric world coordinates, camera transform, depth sorting, and collision footprints.
3. Add 8-way input/aim state support.
4. Build the procedural map/chunk generator.
5. Build enemy spawn director with time-based difficulty budget.
6. Build XP, level-up pause, two-option upgrade selection, one reroll, and stat application.
7. Add data model for 40 skills x 5 levels, even if early prototype ships with a smaller implemented subset.
8. Fix fullscreen to fill the entire monitor/device screen via the Fullscreen API.
9. Integrate P0 isometric tiles/sprites/VFX through manifests.
10. Browser-smoke windowed and fullscreen play: movement, shooting, enemy chase/ranged fire, XP collection, level-up pause/unpause, upgrade stat change, timer scaling, and game-over.

## Acceptance criteria for the first isometric roguelike vertical slice

- Player can move freely in 8 directions on an isometric map.
- Player can shoot/aim in at least 8 directions.
- Procedural or semi-procedural map chunks appear around the player.
- Enemies spawn outside the safe radius, chase or fire ranged attacks, and scale over time.
- Kills grant XP.
- Level-up pauses gameplay.
- Level-up presents two random upgrade options and one reroll.
- Selecting an upgrade changes stats and resumes gameplay.
- Run timer/difficulty curve targets a ~20-minute survival ceiling.
- Windowed mode remains embedded on the site.
- Fullscreen mode fills the entire monitor/device screen.
- Free mode remains practice-only; ranked/paid state remains gated.
- P0 art assets have a manifest-backed handoff path for runtime integration.
