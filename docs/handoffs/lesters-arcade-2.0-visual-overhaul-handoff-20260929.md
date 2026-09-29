# Lester's Arcade 2.0, "The Visual Overhaul": session handoff

*Written 2026-09-29 for a new session or model picking up the next major update. Final version, with all of the owner's 2026-09-29 decisions. It supersedes `lesters-arcade-roadmap-visual-overhaul-20260927.md`: that plan's content is kept here and expanded with the owner's 2026-09-29 directions and our recommendations.*

**Owner:** Justin. **Site:** https://lestersarcade.io. **Games:** Hard Money Heroes (HMH), Chikun's Escape, STACKED.

**Goal:** one large 2.0 release that makes all three games look and feel AAA ("Hades-level" is the owner's bar), and finishes STACKED.

**Owner decisions made on 2026-09-29:**
1. **HMH characters move to real-time 3D** (skinned models drawn live), replacing pre-rendered sprite atlases for heroes, enemies and bosses (§2.1).
2. **STACKED keeps its current gameplay.** The colour-match idea is dropped. STACKED gets the visual overhaul, the gameplay enhancements already planned, and is finished (§4).
3. **HMH world size is ours to set** for the best level: see §2.2.
4. **Litecoin City branding uses the top 10 LitVM ecosystem projects** plus Lite Strategy, Luxxfolio, Canary Capital, Grayscale and Litescribe (§2.2). Official high-quality logos may be used where we have them; names alone are fine otherwise.
5. **Level design and level art are a major focus,** led by **one common art direction** for everything (§1.1, §2.2, §2.3).
6. **Performance under heavy load** (enemy waves plus effects) must hit the target on a mid phone (§2.1).

---

## 0. Read this first

### 0.1 Live state (2026-09-29)

| Version | Production deployment | What it shipped |
|---|---|---|
| 1.9.0 | `dpl_EkYKp8FpYuPHoQRCgh7kLjd2qYnK` | HMH v0.6 (missions, the Liquidator without a timer, two-card level-ups, Genesis Seals, dodge), Free share cards, STACKED music, Chikun Blender backdrops |
| 1.9.1 | `dpl_Hvu7KjXAmZFwzitUieeyxwiMsS7T` | Free share image on X; random Level 1 intro/loading art |
| 1.9.2 | `dpl_8KAuCxcWGTY4f83Eb9ditCoGVJyq` | HMH hero stats and perks are real in the simulation; Pistol start; lore bios; dark hero select |
| 1.9.3 | `dpl_FkkKapTcGo2ruENwmYsW8to8UZRo` | Custom avatar uploads for wallet sign-ins (Neon migration 4, `/api/avatar`); four presets retired; share link inside the X post text |
| **1.9.4 (live)** | `dpl_ErTdrJTvc4m1KrvbqkfatJihKbjk` | Results screens warm their share page and card so X finds the image cached |

**Code:**
- Repository `kingdankkush/lesters-arcade`.
- Integration branch **`fable/master-list-20260916`** at **`04366747`**. Start every new branch from it.
- Cache marker `lesters-arcade-v64-share-warm`.
- Site/game version `1.9.4`, in `apps/portal/src/version-tracking.mjs`.

**Where the code is:**
- **HMH runtime:** `apps/hmh-reboot/src/` (PixiJS 8.19, deterministic 60 Hz, `main.mjs` is the loop).
  - World: `level-one-world.mjs`, 12,000 × 4,800 units, with nav nodes and routes.
  - Hero stats and perks: `hero-loadout.mjs`. Weapons: `weapon-system.mjs`. Dash: `dash.mjs`.
- **Portal:** `apps/portal/` (`main.js`, `src/`, `styles*.css`).
  - Hero select: `src/routes/official-play-routes.mjs`, `src/hmh-character-config.mjs`.
  - Share: `src/share-links.mjs`.
- **STACKED:** the simulation is `apps/portal/src/stacked-sim.mjs` (10 × 24 board, `Uint8Array`); the cabinet is `apps/stacked/`.
- **Chikun:** `apps/chikun/`.
- **Server** (Vercel functions + Neon Postgres): `api/`, `server/`. Ranked verification is in `server/verify/`: `hmh.mjs` + `hmh-plausibility.mjs` (plausibility rules) and `stacked.mjs` (full replay). Chikun is also a full replay.
- **Docs to read:** `AGENTS.md` (repo rules), `docs/handoffs/lesters-arcade-status-and-roadmap-20260927.md` (platform, Web3, operations), `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`.

### 0.2 Non-negotiable rules

1. **HMH is a deterministic simulation.**
   - Fixed 60 Hz with at most 4 catch-up steps.
   - Same seed gives the same run.
   - Art, animation, VFX, gore, lighting, sound, camera and particles are **projection only**. They never change collision, damage, AI, spawning, randomness, scores or evidence.
   - Anything that *does* change gameplay goes in a measured gameplay slice with tests and a Ranked verifier review. That includes cover, climbing, drop-downs, new enemies, new objectives and the new map.
2. **Ranked must keep verifying old runs.**
   - HMH is checked by plausibility; Chikun and STACKED are replayed exactly on the server.
   - Any rules change ships as a new ruleset or map version, and the server picks the rules by each run's game version.
   - STACKED's replay must stay under the verifier's time cap (§4.6).
3. **Presentation randomness** (idle fidget choice, particle jitter) uses a separate, non-simulation random source. It must never draw from the simulation's streams.
4. **HMH actors** read as human survivors or zombies only. No animal, robot, vehicle or abstract *actors* in HMH (vehicles as props are fine). Chikun's obstacles may be animals.
5. **Performance budgets:**
   - HMH initial JS + shared chunks: **1,048,576 B**, with about 9 KB headroom today. New systems must be lazy-loaded.
   - Must hold 30 fps on a mid phone, and watch phone texture memory.
   - Tracked art is already about 820 MB against a 350 MB repository budget. Move bulk sources (Blender, Tripo GLBs, raw renders) to the asset vault and keep only runtime atlases in Git LFS.
6. **Tests must not depend on git** (Vercel builds have no `.git`).
7. **Git and release:**
   - Never push to `main`.
   - Never deploy or promote without the owner's explicit approval for that release.
   - Never bypass hooks.
   - Never touch keys (`C:\Users\just_\lesters-arcade-vault\keys\`, Vercel secrets, `~/.tripo`).
   - No contract, transaction, settlement or jackpot work (the jackpot is paused until mainnet).
8. **Scope:** sessions in this project work **only on Lester's Arcade**.
9. **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### 0.3 How a release ships (proven on 1.9.2 → 1.9.4)

1. Work in a separate worktree under `C:\Users\just_\lesters-arcade-wt\<name>`, branched from the integration head. Junction `node_modules` to an existing worktree's.
2. **Release commit:**
   - bump `SITE_VERSION`/`GAME_VERSION` in `apps/portal/src/version-tracking.mjs`;
   - bump `CACHE_VERSION` in `apps/portal/sw.js`;
   - update the version pins in `tests/{arcade-core,chikun-cabinet,chikun-evidence-v6,hmh-load-speed,hmh-playable-release,hmh-reboot-shell,version-tracking}.test.mjs`;
   - add a README top section and move the previous one below "How to play";
   - regenerate the fact sheet: `node scripts/hmh-release-facts.mjs --write`.
3. **Gate, under the shared lock** (acquire, run and release in one command):
   ```
   mkdir C:/Users/just_/lesters-arcade-wt/.locks/heavy.lock
   npm run vercel:build
   rm -rf the lock
   ```
   It must print `HMH_REBOOT_TEST_RETIREMENT_GATE PASS … expected_failures=51`. The 51 known failures are retired HMH art tests listed in `docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json`. Commit the regenerated `docs/testing/hmh-reboot-test-retirement-gate.json`.
4. **Deploy and promote:**
   - `npx vercel deploy --yes` from the worktree (link it by copying `.vercel/project.json` from `C:\Users\just_\lesters-arcade-fable0916`). The first attempt once returned "Not authorized"; a plain retry worked.
   - Then `npx vercel promote <preview-url> --yes`. The production rebuild takes about 15 minutes and once started late, so check `npx vercel ls lesters-arcade --prod`.
   - Previews show the database as "degraded" because they don't get the production environment. That is normal.
5. **Verify:**
   - poll `https://lestersarcade.io/sw.js` for the new marker;
   - `/api/health` must show `healthy: true` and the new version;
   - then fast-forward `fable/master-list-20260916` to the release head.
6. **Auto mode must be off to deploy.** Its classifier blocks deploy steps.
7. Another session, "Lester's Arcade pre-deployment tasks", has shipped most releases. If it's online, coordinate with it instead of shipping in parallel, and never run git commands that move HEAD in its worktree.

---

## 1. The 2.0 release at a glance

| Track | Game | Scope | Changes gameplay? |
|---|---|---|---|
| A | HMH | The world: 10 connected areas, about 150+ new level assets, roads, elevation, secrets, arenas | **Yes**: a new map version and verifier map table |
| B | HMH | Heroes: rig v2, about 60 clips per hero including **cover**, **level interaction**, **traversal** and **idle fidgets** | Cover, climb and drop-down: **yes**. The rest: no |
| C | HMH | Combat feel, weapons, power-ups, VFX, blood, gore, sound | Mostly no; power-up balance: yes |
| D | HMH | Enemies and bosses: models, animation, AI, balance, pathing, missions | **Yes** |
| E | Chikun | Obstacle art, new obstacle types, animation, deaths, coin feedback, plus recommendations | New obstacles: **yes** (course version) |
| F | STACKED | Finish the game: the living visualizer (Matrix code, forward flight through space and portals), feel and polish, versus mode, daily challenge. **Current gameplay kept** | Versus and daily modes add rules; the core game is unchanged |
| G | Platform | Avatars shipped in 1.9.3; the carried-over platform items | Mixed |

**Release shape:**
- Every track is built behind a switch and gated on its own, then switched on together in 2.0.
- If 2.0 slips, a finished track may ship early with the owner's OK. STACKED is the most self-contained.
- STACKED's scoring rules don't change, so its boards carry on with no reset.

### 1.1 One art direction leads everything (build this first)

**Owner direction:** a common art direction must lead everything, and the level design and level assets are a **major focus**. That means much better ground terrain, trees and overall visual quality of the game world.

**Deliverable:** before any 2.0 art is made, write `docs/art/ART-DIRECTION-2.0.md` (the "art bible") and build a **target-quality vertical slice**: one small, fully finished patch of one area, used as the bar every later asset is judged against. The owner approves both before production art starts.

**What the art bible fixes:**

| Topic | Rule to set |
|---|---|
| Style statement | One line everyone can repeat. Proposal: *"Painterly-realistic, warm and saturated, readable from the 35° camera: a lived-in frontier where hard money is worth fighting for."* HMH leads; Chikun and STACKED borrow its palette and material feel |
| Camera and scale | The 35° hero camera, human scale (a hero is about 1.8 m), a fixed texel density (pixels per metre) for every surface, so nothing looks blurrier or sharper than its neighbour |
| Light | One shared key light direction and colour temperature, per-area mood tints on top, contact shadows under everything, soft ambient occlusion where objects meet the ground |
| Palette | A global palette plus a sub-palette per area (for example the bayou in olive, teal and murky gold; the coast in turquoise, sand and white; Hollow Pines in desaturated blue-violet). Gameplay colours are reserved: enemy tells in red and orange, pickups in gold and cyan, interactive props with a consistent rim light. The world never uses them for decoration |
| Shape language | Heroes and friendly places are rounded and sturdy; enemies and forts are angular and spiky; Litecoin and LitVM brand elements use clean silver geometry |
| Materials and wear | A small shared material library (wood, stone, concrete, metal, cloth, foliage, water). Every hard surface gets edge wear, grime at the base and some colour variation. No flat untextured fills |
| Ground | Layered materials blended with soft masks (grass into dirt into gravel into mud), decals for detail (tyre ruts, puddles, leaf litter, cracks), no visible tile repetition at any zoom |
| Foliage | Real 3D-modelled tree species rendered to sprites with several variants each, gentle wind sway, canopy shadows on the ground, undergrowth clumps where trees meet grass |
| Readability | Walkable, blocked, cover, climbable and interactive must be readable at a glance. The art bible shows each with an example |
| Density | Target prop density per area type (sparse meadow, dense city, cluttered camp), measured so the art stays readable and inside the performance budget |
| Reference board | 20–30 reference images the owner agrees with (the owner's own concept images first) |

**Every asset is reviewed against the art bible and the vertical slice** before it merges, in a screenshot review at desktop and phone framing, next to the slice. An asset that doesn't meet the bar is fixed or cut, not shipped.

---

## 2. Hard Money Heroes

### 2.1 Decided: characters move to real-time 3D

**Owner decision (2026-09-29):** heroes, enemies and bosses are drawn as real-time 3D skinned models. World props, terrain and VFX stay as 2D sprites, atlases and shaders.

**Why:** today every hero and enemy is a **pre-rendered 8-direction sprite atlas** (each clip × 8 directions × about 10–16 frames). The new scope is about 60 clips per hero, 8+ new clips per enemy, and smooth blending between them.
- **Size:** 4 heroes × 60 clips × 8 directions × about 12 frames is about **23,000 hero frames**; with enemies and bosses it passes 40,000. That doesn't fit phone memory or the repository, even with streaming.
- **Blending:** sprite atlases can't truly blend; they can only cross-fade frames.

**What gets built:**
- A 3D character layer: skinned glTF models drawn inside the Pixi scene at the 35° camera, with Three.js or Pixi's own 3D support, lazy-loaded outside the initial bundle.
- The simulation keeps the actor positions and states; the 3D layer only draws them (projection only). Depth sorting against the sprite world, contact shadows and the shared light rig must match the rest of the scene.

**Compared with today:**

| | Pre-rendered sprites (today) | Real-time 3D characters (chosen) |
|---|---|---|
| Blending, contextual transitions | Frame cross-fades only | True animation blending, layered upper/lower body |
| Directions | 8 fixed | Any angle, smooth turning |
| Memory per character | Large atlases, grows with every clip | One model + compressed animation data |
| Art pipeline | Blender → render thousands of frames | Blender/Tripo → glTF export (already our source) |
| Risk | Known; won't scale to the new scope | Bundle cost (lazy chunk), phone GPU cost, new renderer code |
| Determinism | Unaffected | Unaffected: rendering is projection only |

**First slice, a performance gate (about 2 weeks), not a yes/no on the direction:**
- one hero and one enemy type in 3D, in the live game behind a switch;
- target: 40 animated enemies plus 1 hero at 30 fps on a mid phone, bit-identical simulation results, less than 250 KB added to the initial load;
- the budgets it measures set the per-character limits for the art: polygon count, bone count, texture size, animations per model, and level-of-detail steps for crowds.

If it misses the targets, tune rather than retreat: fewer bones for distant crowd enemies, lower-detail models past a distance, or cheaper sprite impostors for far-away crowds. Only report back to the owner if the targets look out of reach.

**Reuse what exists, then polish.** Many hero, enemy and boss 3D models already exist (Tripo/Blender sources in the asset vault and `apps/hmh-reboot/assets/source/models/`). Start from those. Every model goes through the same finishing pass:
- a reference check against `REFERENCE-CHARACTER-MODELS.md`;
- a clean-up and retopology to the polygon budget;
- a rig and skin weights, and texture baking to the texture budget;
- level-of-detail versions for crowds;
- a glTF export with compressed animation.

**Performance under heavy load is a release requirement, not a nice-to-have:**

| Scenario (measured in the real game) | Mid phone | Desktop |
|---|---|---|
| **Heavy wave:** 60 enemies on screen, a boss, 20 active effects (explosions, fire, lightning), blood and gore decals, 4 grenades in flight, gore set to Full | 30 fps, no frame above 50 ms | 60 fps |
| **Boss fight:** a boss in its busiest phase, 20 adds, phase-change effects | 30 fps | 60 fps |
| **World traversal:** running between areas while the next area streams in | No stall above 100 ms | No stall above 50 ms |
| **Long run:** 30 minutes of play | Memory stays flat (no leak), no slowdown | Same |

**How it stays fast:**
- level-of-detail models and cheaper animation for distant enemies;
- pooled effects, decals and projectiles with hard caps;
- a quality governor that lowers effects density, then resolution, before frame rate;
- area streaming with a texture memory budget per area;
- the Graphics Quality setting from the perf plan.

These scenarios become **automated performance smokes** that run before every release.


### 2.2 The world: Level 1 redesigned as connected scenes

**Direction (owner):**
- The world is a set of distinct scenes joined by paved, gravel and dirt roads and dirt paths.
- Exploration is required to find areas, secrets, boss arenas, camps, power-ups and objectives.
- It mixes narrow passages with open arenas.
- Elevation matters: terrain (hills, mountains) and built platforms (fortress walls, towers, castle levels).

**World size (decided by us, on the owner's say-so): 20,000 × 14,000 units, one continuous map.**

Today's map is 12,000 × 4,800 with six districts, and heroes run at 240 units a second, so crossing it takes about 50 seconds. The new size is chosen from what the level needs to feel like:
- **Each area is about 4,000–5,000 units across,** about 17–21 seconds to run through. That is big enough to hold a landmark, an objective, side paths and a secret, small enough that no area drags.
- **Open arenas are about 1,800–2,400 units across,** so boss fights and camp fights have room to dodge and use cover. **Narrow passages are about 300–600 units wide**, such as the mountain switchbacks, bayou boardwalks and fortress gates.
- **Roads between areas take about 10–25 seconds,** long enough for a breather and a patrol or ambush, short enough that travel never feels empty. The far corners are about 2–3 minutes apart along the roads.
- **A normal run visits 4–6 of the 10 areas,** so every run is a different route and there's always more to explore.
- **About 45–55% of the map is walkable.** The rest is cliffs, water, dense forest and buildings, which shape paths and create sightlines.

**How it's delivered:**
- One continuous map with no loading screens, which keeps the simulation, navigation and verifier model unchanged in kind.
- Art streams by area: an area's atlases load when the player is within about 1.5 screens of its edge.
- The W0 step measures memory, frame time and nav-grid build time at this size before any art is made. If it's too heavy, shrink the roads first, not the areas.

**The ten areas** (names are proposals; the owner can rename them):

| # | Area | Look and feel | Gameplay role | Difficulty |
|---|---|---|---|---|
| 1 | **MWEB Meadows**, grassland with a neighborhood (start) | Rolling grass, wildflowers, a small suburb, picket fences | Spawn and tutorial space; first objectives; wide lanes | ★ |
| 2 | **Litecoin City**, urban core | Streets, plazas, towers, neighborhoods. **Ecosystem partner billboards and building names** | Dense streets, rooftops as elevated lanes; the Liquidator's arena (Closing Bell) moves here | ★★–★★★ |
| 3 | **Halving Farms**, farmland | Barns, silos, hills, crop rows, a windmill | Open sightlines, hills for elevation, the barn-door objective | ★★ |
| 4 | **Silver Coast**, beach, rocky cliffs, luxury homes | Sand, surf, cliff paths, glass mansions, piers | Cliff-top routes, a mansion interior secret, coastal fights | ★★ |
| 5 | **Scrypt Bayou**, marsh and swamp | Boardwalks, murky water, cypress trees, fog, a stilt shack | Boardwalk chokepoints, shallow water that slows, the Lock objective; **Lockkeeper arena** | ★★★ |
| 6 | **Hashwood River**, forest with a river | Tall pines, a river with bridges, waterfall | Bridge crossings, riverbanks; **Rug Pull Baron arena** in a clearing | ★★★ |
| 7 | **Hollow Pines**, spooky forest | Dead trees, fog, lanterns, a cemetery | Tougher enemy mix (HODL Revenants, elites), limited light radius, the best secret loot | ★★★★ |
| 8 | **Ledger Ridge**, rocky mountains | Narrow switchback paths, rope bridge, quarry | Narrow pathways, ledges (climb and drop), sniper threat (Oracle Marksman) | ★★★★ |
| 9 | **Fork Fortress**, enemy fortress | Walls, gatehouse, towers, ramparts, inner keep | Multi-level compound: ramparts, towers, courtyard; the **51% Foreman** in the keep | ★★★★★ |
| 10 | **Rugpull Woods**, forest with enemy camps | Mixed forest, tents, palisades, watchtowers | Several camps to clear (each an objective), with patrols between them | ★★★ |

**Connection map** (roads: `═` paved, `─` gravel/dirt road, `┄` dirt path):

```
                  [8 Ledger Ridge] ┄┄┄┄ [9 Fork Fortress]
                        ┆                      │
[4 Silver Coast] ═══ [2 Litecoin City] ═══ [1 MWEB Meadows] ─── [3 Halving Farms]
        ┆                  │                   │                    ┆
 [5 Scrypt Bayou] ┄┄ [6 Hashwood River] ┄┄ [10 Rugpull Woods] ┄┄┄┄┄┘
                           ┆
                    [7 Hollow Pines]
```

**How the map is laid out:**
- Difficulty rises with distance from the start.
- Every area has at least two ways in, so runs can branch.
- Dirt paths (`┄`) are narrower, darker and hide secrets.
- The paved highway (`═`) is the safe spine.

**Level design principles: every area should make sense.** The owner wants each area's layout and asset placement to be believable and purposeful, especially around objectives and boss fights.

1. **Places follow their own logic.**
   - Towns sit on flat ground near roads and water.
   - Farms sit on gentle slopes with fields, fences and a track to the barn.
   - Forts take the high ground with clear views of the approach.
   - Bridges are where rivers narrow.
   - The coast's mansions face the sea, with a cliff road behind them.
   - Camps sit near water and cover, with lookout posts facing the paths in.
2. **Every area has a landmark** visible from a distance: the city skyline, a farm windmill, a lighthouse, a fortress keep, a giant dead tree in Hollow Pines. Players steer by landmarks.
3. **Roads explain the world.** Paved roads link towns, gravel serves farms and quarries, and dirt paths lead to secrets and camps. Wear, tyre ruts, road signs and broken-down vehicles tell a story along each route.
4. **Objectives are staged, not dropped.** Every objective sits in a place that justifies it: the bayou lock in a real lock structure on the channel, the barn doors on the actual barn, the uplink on a hill with line of sight. The approach is dressed so the player knows where to go: lights, tracks, signage, an edge chevron only as a backup.
5. **Boss arenas are designed spaces.**
   - A clear entrance with a moment of anticipation (a gate, a bridge, a drop-down).
   - A readable floor with cover spread evenly around the edges.
   - Room to dodge; hazards that are telegraphed.
   - A second level or high ground where it suits the boss.
   - Set dressing that tells whose arena it is: the Rug Pull Baron's collapsing marquee, the Foreman's quarry machinery, the Lockkeeper's gates and winches.
6. **Combat spaces use cover and height on purpose.** Every fight space has cover in two or more heights, at least two exits, and an elevation option. No dead-end traps unless they're an ambush by design.
7. **Secrets reward curiosity:** a slightly different path colour, a break in a fence, a glint of loot. Never invisible walls or pixel hunts.
8. **Density with rhythm:** busy set-pieces alternate with calmer roads and clearings, so the eye and the player get a breather.

Each area's greybox (W2) comes with a one-page **area brief**: its story, landmark, routes in and out, objective staging, combat spaces, secrets and art sub-palette. The owner reviews the greyboxes before art starts.

**Area art needs** (on top of the kits in §2.3): bayou (cypress, boardwalks, stilt shack, reeds, murky-water shader tiles, fog cards), luxury coast homes, a castle/fortress kit (walls, gatehouse, towers, rampart walkways, stairs), and a spooky kit (dead trees, gravestones, lanterns).

**Litecoin City branding (owner decision, 2026-09-29).** Billboards, storefronts and building names feature:

**The top 10 LitVM ecosystem projects**, ranked by X following and real development on the LitVM testnet. Researched 2026-09-29 from the directory at https://testnet.litvm.com/, public X profiles, the LiteForge block explorer, LitVM's June 2026 flagship list and the official "LiteForge Pioneer" quest campaign:

| # | Project | What it is | X followers | Development evidence | City placement idea |
|---|---|---|---|---|---|
| 1 | WheelX | Bridge and swap aggregator | @WheelX_fi, 17.4K | Official LitVM flagship; public GitHub | Highway billboard and "WheelX Bridge" at the city's river crossing |
| 2 | MidasPredict | Prediction market | @MidasHandxyz, 4.7K | Official flagship; its main contract has about 455K transactions | Stock-ticker style screen in the plaza |
| 3 | LitVMSwap | Exchange | @LitVMSwap, 13.4K | Native exchange with live pools and an order book | "LitVMSwap Exchange" trading floor building |
| 4 | Drunken Cats | Exchange, lending, stablecoin | @drunkencatsxyz, 3.6K | About 1.8M router transactions | Cat-mascot storefront |
| 5 | Dappit | AI app builder | @Dappitdotio, 7.5K | Official flagship; public GitHub | Tech-office tower sign |
| 6 | Lester Labs | Launchpad, locker, vesting | @LesterLabsHQ, 1.6K | Official flagship; run by Jack of Lunar Digital Assets | A lab building next to the Litecoin Exchange |
| 7 | Arkada | Quest platform | @Arkada_gg, 36.7K | Runs the official LitVM points campaign | Quest-board kiosk |
| 8 | OmniHub | NFT launchpad | @Omni_Hub, 133.6K | Factory contract with about 233K transactions on LitVM | Gallery or art-museum facade |
| 9 | Lit Clinic | Health-themed daily on-chain actions | @litclinicxyz, 1.4K | More than 10 contracts, about 1.3M transactions | Clinic building (a health pickup spawn) |
| 10 | OnChainGM | Social "GM" app | @OnChainGm, 31.7K | About 3.3M transactions | Sunrise "GM" billboard on the skyline |

**Runners-up**, if a swap is needed: ZNS Connect, Omega/Olympus, AutoIncentive, LitTown (a city-builder game that fits a game billboard well), OnmiFun.

**Left out on purpose:** lotteries, casino-style and loot-box products, memecoin launchpads, and projects with no identity or unclear status (LitBillionaire, LTC Lottery NFT, LitGames, The Silver Void, Rip & Loan, Bucky Rewards, WolfDex, Falken, AI Deathmatch, Aura, Ayni, LitPump, 0xPump, Bulion, MLT Farm). Keep the look-alike site litevm.org (a probable phishing copy) out entirely.

**Litecoin ecosystem names (owner-specified):** Lite Strategy, Luxxfolio, Canary Capital, Grayscale, Litescribe. For example a Lite Strategy office tower, Luxxfolio and Canary Capital buildings on a "financial district" street, a Grayscale building and billboard, and a Litescribe storefront.

**Also:** Litecoin, LitVM, the LiteForge testnet and Lester's Arcade itself.

**Notes before the art is made:**
1. **Logos:** use a project's official logo where a high-quality version is available (from its site or media kit); otherwise show its name in the city's own sign styles. Names alone are fine for some.
2. **Drunken Cats:** approved by the owner (2026-09-29).
3. **Lester Labs:** approved by the owner. It's run by Jack, a Lunar Digital Assets team member.
4. **Keep the list in one data file** (billboard slot → brand), so names can be swapped or refreshed without new art. Re-check the top 10 before 2.0 ships: follower counts and activity change quickly on a testnet.

**World build steps** (each gated before any art):

| Step | Work |
|---|---|
| W0 Size check | Streaming and memory at 20k × 14k on a mid phone; nav-grid build time; verifier travel rules |
| W1 Greybox kit and layout checker | Mass edges, cliff faces, flush decks, road tiles, **cover edges (tall/short)**, **climb/drop ledges**, and a checker running the real nav grid in tests (walkability, sightlines, spawn distance, arena size, every area reachable, every secret reachable) |
| W2 Greybox all 10 areas + roads | Playable greybox with objectives, camps, arenas and secrets placed; a pacing pass (a normal run visits 4–6 areas) |
| W3 Verifier map table v2 | District travel, objectives, secrets and boss triggers for the new map, picked by game version |
| W4–W8 Art pass area by area | Level assets (§2.3), lighting mood per area, ambient life and sound |
| W9 Promote | The new map becomes Level 1 in 2.0; the old map stays verifiable for old runs |

### 2.3 Level assets (about 150 from the original plan, plus the new area kits, about 190 total)

**This is a major focus of 2.0.** The owner's main complaint about the current world is the ground terrain, the trees and the overall quality of the world art. Every asset below is made to the art bible (§1.1) and judged next to the vertical slice.

**Quality targets for the world:**

| Element | Today | 2.0 target |
|---|---|---|
| Ground terrain | Flat tiles and procedural strokes; visible repetition | Layered materials (grass, dry grass, dirt, mud, gravel, sand, forest floor, rock) blended with soft masks; detail decals (ruts, puddles, leaf litter, cracks, flowers); no visible repetition; ground darkens and wears where people walk |
| Elevation | Flat mass edges | Sculpted cliffs and slopes with rock strata, grass lips, scree at the base; built platforms (ramparts, towers, docks) with real stairs and ramps |
| Trees and foliage | Few species, stiff and small | 6+ species modelled in 3D (pine, oak, birch, cypress, palm, dead tree) with 3+ variants each, wind sway, canopy shadows, undergrowth, grass clumps, reeds and flowers per area |
| Water | Flat colour areas | Animated rivers, creeks and surf with foam, depth tint, shore wetness and reflections; murky bayou water; waterfalls |
| Buildings and props | Small, generic, inconsistent scale | Modular, correctly scaled building kits per area (city, farm, coast mansions, fort, camp), wear and grime, lit windows at night, props grouped into believable clusters |
| Roads and paths | Procedural strokes | Paved roads with markings, cracks and kerbs; gravel with loose edges; dirt paths with ruts; intersections and road signs |


The original 150 are kept: ground (16), elevation (8), water (12), nature (22), Litecoin town (18), neighborhoods and farms (10), coast (10), enemy forts (14), vehicles as props (10), walls and barriers (8), interactive elements (14), mining (8).

The new area kits add about 40: bayou (8), luxury coast (6), castle/fortress (12), spooky forest (8), mountain paths (6).

**Every asset rule:**
- 35° hero camera and one shared light rig;
- a contact shadow;
- a collision footprint drawn from the art;
- **tagged metadata**: `cover: tall|short|none`, `climbable`, `dropEdge`, `interactive`, `destructible`;
- three sizes checked against a human hero;
- deterministic atlases.

**Pipeline:** concept image (the owner's ChatGPT images when supplied; otherwise Tripo text-to-image) → Tripo model for organic shapes (about 40 credits each; balance last known 5,835, re-check) → Blender for kits, moving parts and cleanup → atlas render under the shared light rig. **Reuse and upgrade existing models first.** Replace, don't patch, anything below the art bible's bar.

### 2.4 Heroes: rig v2 and about 60 clips each

All 4 heroes: Lit Commando, Lit Valkyrie, Lester, Lilly. Heroes follow `REFERENCE-CHARACTER-MODELS.md`. Characters are real-time 3D (§2.1), so clips play at any facing angle and blend with each other; the "8 directions" in the owner's notes are covered automatically. Fire and reload timings come from the simulation's weapon constants, so the art matches gameplay exactly.

**a. Movement and traversal:**
- idle, walk, run, strafe left and right, backpedal;
- start and stop (lean into and out of a run), turn in place, **sharp pivot** (180°), slope up and down;
- dodge roll, dash, stumble, **knockdown and get-up**, **stunned**, **fall and land** (small and big).

**b. Cover** (new mechanic and animation set):

| Cover height | Asset examples | Pose | Clips |
|---|---|---|---|
| **Tall** (walls, trucks, containers, building corners) | back to the wall, standing | enter cover, idle in cover (facing left and right), shuffle along cover, **peek and fire at the edge** (left and right), blind fire, reload in cover, hit in cover, **leave cover** (step out, run out, roll out) |
| **Short** (road barriers, fences, sandbags, low walls, car hoods) | crouched or kneeling | enter (slide or duck), crouch idle, crouch shuffle, **pop up and fire over**, blind fire over, reload crouched, hit crouched, **leave cover** (vault forward, back off, roll out) |

**How cover plays, using the movement control only:**
- **Enter:** moving into a cover edge within about 24 units while pushing toward it for 6 ticks (0.1 s) snaps the hero into cover. The snap is deterministic in the simulation.
- **In cover:** moving along the wall shuffles. Aiming or firing makes the hero peek (tall: lean out at the edge; short: pop up). Releasing fire returns them to cover.
- **Leave:** pushing away from the wall for 4 ticks steps out. Dodging while in cover rolls out. Moving past the end of cover runs out.
- **What cover does:** hits from the covered side are reduced (proposal: tall −60%, short −40%). Projectiles that hit the cover geometry are blocked. Enemies react to a player in cover by flanking, throwing grenades or rushing.
- **Mobile:** the same rules on the virtual stick, with no extra button.
- **Simulation and verifier:** cover is a gameplay slice (cover edges in level data, snap and exit rules, damage-reduction rules) with tests and a verifier review.

**c. Level interaction:**
- flip a switch or lever, crank a wheel or valve, push open doors, push open gates;
- **locked-gate bump:** the hero tries a gate that needs an objective, gets a shake and a "locked" cue;
- kneel and pry, button press, pick up;
- **hop down** from higher elevation (a short drop, and a tall drop with a roll);
- **climb** marked walls or cliff faces (grab, climb, mantle), and vault low cover;
- **hazard reactions:** burn, shock, poison or gas, water wade;
- a death variant per hazard.

Climb and drop-down are **gameplay** (new traversal on marked ledges, deterministic, reviewed by the verifier).

**d. Combat:**
- aim idle; pistol, two-handed rifle and heavy fire with **recoil**;
- reloads per weapon class (pistol, rifle, shotgun pump, launcher break-open);
- weapon swap; melee knife (combo 1, combo 2, finisher); grenade throw (overhand and underhand);
- hit reacts (light, heavy, from behind);
- deaths (forward, backward, explosion, burn, and a directional crumple).

**e. Idle fidgets, 4 per hero,** played randomly after about 4 s standing still. Presentation only; they break instantly on any input.

| Hero | Fidget ideas |
|---|---|
| Lit Commando | hero pose with a gun on the shoulder; checks an old flip phone; cracks knuckles and stretches; salutes |
| Lit Valkyrie | takes a selfie; hair flip and headband fix; stretches like a sprinter; blows a bubble-gum bubble |
| Lester | flips a Litecoin; sits cross-legged and meditates (floats slightly); reads a "Hard Money" book; polishes his round head |
| Lilly | pushes up her glasses and checks a tablet; types code in the air (holo glyphs); sips coffee; coat twirl pose |

**f. Moments:** level-up flourish, victory pose, spawn-in, **cover-slide celebration** after a multi-kill from cover.

### 2.5 Combat feel, weapons and power-ups

**Combat feel (presentation):**
- dash trail and afterimage;
- melee swoosh arcs and hit sparks;
- **muzzle flash per weapon**, recoil kick, **shell casings and shotgun shells** that bounce and fade;
- tracers, impact decals per surface;
- **blood squirts** sized by damage, blood pools, fading decals;
- **dismemberment and gibs** on high-impact kills (close-range shotgun, launcher, explosives, heavy crits);
- grenade and launcher explosions in three sizes, with fire, smoke and scorch;
- better standard deaths (ragdoll-like baked crumples);
- hit-stop as a deterministic simulation rule only (per the 2026-09-26 decision).
- **Gore setting:** Off / Reduced / Full, default Full. Share images and banners stay gore-free.

**Weapons: finish all 8** (Settler/Pistol, Block Breaker, Hashstorm, Hash Rail, Lightning Ledger, Bear Market Burner, Forked Standard, Launcher Rig) plus the knife and the Satoshi Frag:
- real 3D models with moving parts;
- correct grip and pose in hero hands for every direction and clip;
- per-weapon muzzle points;
- reload and equip clips;
- sound (fire, reload and equip variants);
- balance pass using `docs/qa/hmh-weapon-benchmark.json`.

**Power-ups: finish and polish** Time Dilation, Berserk Candle, the Nuke, Bonus Life, health, ammo, silver, weapon caches, the Scrypt Cache grenade and the Genesis Seal:
- 3D world models with idle spin and glow;
- pickup VFX and sound;
- **on-hero indicators** (aura, HUD timer ring);
- activation VFX;
- a balance pass (durations, drop odds). Drop-odds changes need verifier coverage.

### 2.6 Enemies and bosses

- **Models and animation:** finish the Tripo/Blender 3D models for all enemies and bosses, rigged and exported to glTF for the real-time character layer (§2.1).
  - Current six: Bagholder, Forkrunner (re-model so it no longer reads as Lilly), Liquidation Agent, Whale Enforcer and Gas Bomber (re-model as humans), Validator Cultist.
  - New: Rug Puller, Pump-and-Dump Bloater, Tollkeeper, HODL Revenant, Money Printer, Oracle Marksman.
  - Bosses: the Liquidator (model done), Rug Pull Baron, the 51% Foreman, the Lockkeeper.
  - Clips: 8+ new per enemy (idle variant, run/charge, attack tell, attack, hit react, stagger/knockback, 2–3 deaths including gore, spawn/emerge, taunt). Bosses add phase transitions and supers.
- **AI and combat:**
  - approach slots, so enemies don't stack;
  - flanking a player in cover;
  - grenade and suppression behaviours for ranged enemies;
  - retreat and regroup;
  - telegraphed attacks with perfect-dodge windows;
  - a feint/punish pattern per boss phase;
  - elites in Hollow Pines and Fork Fortress.
- **Balance:** a pass per area difficulty tier, with the long-run simulator and real-run telemetry (after 1.9.2's hero stats settle).
- **Mission objectives:** clearer tracker steps and edge chevrons, objectives that use cover and elevation (hold a rampart, raise a bridge under fire), camp-clear objectives in Rugpull Woods, and bayou lock and river bridge objectives. The mission set grows to about 30.
- **Level interactivity and pathing:**
  - the nav grid is rebuilt from the new layout;
  - enemies use doors, gates, stairs and drop-downs;
  - patrol routes between camps;
  - no enemy stuck on props (a checker test).

### 2.7 Our recommendations for HMH

1. **Build the 3D character layer's performance gate first** (§2.1); its budgets set the polygon, bone and texture limits for every character model.
2. **Contextual interaction prompts** that appear only in range (a small ring and icon), with no extra buttons. It fits the "movement control only" rule.
3. **Readability first:** interactive props get a consistent rim light and idle motion, so players can tell them from decoration at a glance.
4. **Camera polish:** look-ahead in the aim direction, a gentle zoom-out in open arenas, and zoom-in in narrow passages. Presentation only.
5. **A dynamic music layer per area** (ambient bed plus a combat stinger), within the owner's jukebox rule. Needs the owner's OK.
6. **Photo/trailer mode** (pause, free camera, hide HUD) for marketing and the blog.
7. **A post-run map** showing the route taken, secrets found and missed, and where you died. It drives exploration and replay.

---

## 3. Chikun's Escape

**Replay rule:** runs are replayed exactly on the server. **Visual-only changes are free. New obstacle types, power-ups or rules ship as a new course version** that the server replays by game version.

### 3.1 Kept from the 2026-09-27 plan

- **Upgrade the ugly existing obstacles:**
  - pits: crumbling edges, depth shading, falling pebbles;
  - waterfalls: layered falls, foam, mist, a splash pool;
  - storm clouds: layered, lightning flashes, rain curtains, a warning rumble;
  - drones: rotors, blinking lights, a scan beam;
  - the Shiba Inu: fully animated.
- **New obstacles** (course version):
  - owls (swoop), deer (leap across), cows (slow blockers, chewing), dogs (chasers);
  - **road and highway sections** with seeded traffic;
  - forest sections (clusters, logs, low branches);
  - rock formations (hills, boulders, overhangs, passes);
  - creeks and ponds.
- **Looping idle animation on every obstacle.** Ground terrain per region.
- **Chikun:**
  - more clips (run variants, jump squash, peak float, land squash, double-jump flip, near-miss flinch, idle fidgets);
  - animation blending; speed-matched feet.
- **Deaths by obstacle class,** 2 variants each: fall, ragdoll tumble, **cut into pieces**, **explode into feathers**, splash and sink, comic knock-back. Presentation only; the run ends at the same tick.
- **Coin pickup:** replace the impact/recoil with a sparkle, the coin zipping to the counter, and a rising-pitch chime per streak. It never covers the lane.
- **Carried over:** region lighting and rim light, gateway landmarks, a first-run tutorial, a ground-audio decision, and input-timing anti-bot checks before any real-value jackpot.

### 3.2 New recommendations (visual)

1. **Depth and atmosphere:** subtle depth-of-field blur on the far backdrop layers, per-region fog colour, and god rays in the forest and at dawn.
2. **Speed feel:** speed lines and a slight camera FOV push as speed rises; dust and feather trails behind Chikun.
3. **Time of day across laps:** lap 1 day, lap 2 sunset, lap 3 night with lamps. The Blender backdrops already support day/night.
4. **Weather events** per region (rain, snow flurries, fireflies at night). Visual only.
5. **Near-miss moment:** a 3-frame slow-mo flash and a "close call" pop. Presentation only; the simulation never slows.
6. **Water:** animated normal-mapped water, splash rings and reflections on ponds and creeks.
7. **Hat and skin cosmetics** (a cowboy hat, a Litecoin crown, a pilot cap) unlocked by achievements. Cosmetic only.

### 3.3 New recommendations (gameplay; course version)

1. **Power-ups** (seeded placement):
   - **Scrypt Shield** (survive one hit);
   - **Coin Magnet** (8 s);
   - **Glide Feather** (hold jump to glide over one gap).
2. **Chase moments:** once a lap, a farmer's tractor or a hawk chases Chikun for 10 s. A scripted, seeded set piece.
3. **Fork choices:** at some forks, two lanes split for a few seconds (a safe lane vs a coin-rich risky lane).
4. **Run challenges:** three optional goals per run ("collect 25 coins", "no double jumps for 30 s"), with badges on the results screen.
5. **Ghost of your best run** is already local (same-seed ghost); consider a "daily top ghost" from the verified board.

---

## 4. STACKED: finish the game, and the living visualizer

**Owner decision (2026-09-29):** the colour-match idea is dropped. **STACKED keeps its current gameplay and scoring.** Its boards and achievements carry on unchanged, with no season reset. This track finishes the game: the visual overhaul, the feel and gameplay enhancements already planned, and the missing modes.

**Replay rule:** STACKED runs are **replayed exactly on the server** (`server/verify/stacked.mjs`). Visual and feel work is free. Anything that changes rules (versus garbage rows, a daily seed) is a separate mode with its own replay rules, and the Ranked single-player game stays byte-identical.

### 4.1 First: verifier headroom (survey item J8)

A long replay (432,000 ticks) takes 342–391 ms against a 400 ms cap. Fix this before anything else touches STACKED:
- profile the replay;
- remove allocations in the hot loop, use typed arrays, cache piece rotations;
- target under 250 ms for the longest run.

### 4.2 The living visualizer (kept, extended)

**Kept from the 27th:**
- one visualizer that cycles through all of today's scenes on its own, with seeded order and **morph transitions**;
- motion follows the music's **BPM** through smoothed curves, fluid and never jerky;
- line clears trigger particle bursts; a Halving (four lines) triggers a major moment and a forced scene morph;
- combos raise the energy; danger (a high stack) darkens and tightens it;
- the visualizer options are removed from Settings;
- reduced-motion mode and a flash limit (≤ 3 bright flashes a second);
- a device quality governor;
- visual only.

**New (owner):**
1. **Matrix code scene:** falling glyph rain in Litecoin green and silver, mixing Litecoin, katakana-style and hex glyphs. Columns pulse on the beat; a Halving makes the rain part like a curtain.
2. **Forward motion through space:** every scene sits in a 3D camera that is always **flying forward**, through star fields, grids, tunnels and nebula clouds. Speed follows the BPM and the player's combo energy.
3. **Portal transitions:** scene changes happen by flying through a **portal ring**. The next scene is visible inside the ring and grows until it fills the screen. Big combos and Halvings fire a portal early.
4. **Particle bursts** carry the cleared rows' block colours outward into the scene, so the board and the background feel connected.

**Tech:** WebGL (Pixi shaders or a lightweight Three.js scene), lazy-loaded, capped at 60 fps with the governor dropping particle counts before frame rate.

### 4.3 Feel and polish (STACKED feel 2, from the 2026-09-26 survey)

- **Board feel:** spring-based lock and line-clear motion, a little screen trauma on Halvings, tint jitter on locked blocks, and sub-tick interpolation so falling pieces move smoothly at any frame rate. Presentation only.
- **Sound:** a compressor and a synth sound kit. Each line clear in a combo plays the next note of a rising scale in the music's key; a Halving plays a chord.
- **Haptics** on phones (lock, clear, Halving), through the shared `apps/portal/src/cabinet-haptics.mjs`.
- **Readability:** shape cues on the pieces for colour-blind players, and a high-contrast option.
- **Performance:** the visualizer governor, a device benchmark on first run, stateless scenes, and long-session memory checks on real phones.

### 4.4 Finishing the game

1. **Local two-player versus:** the simulation already exists; add the menu, split board and results. Cleared lines send junk rows to the opponent. Free Mode only at first.
2. **Daily-seed challenge:** one seed per UTC day for everyone, with its own board and share card. It could become Ranked later with a verifier review.
3. **First-run tutorial:** about 30 seconds covering moving, rotating, hold, hard drop, and what a Halving is.
4. **Achievements pass:** review the 40 STACKED achievements for any that are unreachable or unclear, and add artwork polish. Keep existing unlocks valid.
5. **Results and share:** a nicer results screen (a combo graph, best moment, visualizer snapshot), and a matching share card.
6. **Settings cleanup:** one visual-intensity slider (replacing the scene picker), a reduced-motion option, the music and sound sliders, haptics on/off.
7. **Certification:** a long-session soak test on a real phone (60+ minutes), replay timing under budget, and a full Ranked end-to-end.

### 4.5 STACKED risks

- **Verifier time budget:** fix it first (§4.1).
- **Visualizer cost on older phones:** the governor must degrade gracefully. Fewer particles first, then lower resolution, never a lower frame rate for the board.
- **Photosensitivity:** the flash limit and reduced-motion mode are required, not optional.

---

## 5. Platform and carried-over items

- **Shipped in 1.9.3–1.9.4:** custom avatars, the four presets retired, share-link fixes.
- **Still open:**
  1. HMH **anti-cheat round 4** (per-grenade blast kill cap, secret silver and objective times, four v6-forgeable achievements) before Phase 2 NFTs or any prize;
  2. **Phase 2 soulbound achievement NFTs**;
  3. the jackpot, on hold until mainnet and the $CHIKUN launch;
  4. mainnet preparation (fresh contracts, season reset, legal review, written rights for the creator's art);
  5. portal polish from the research survey (hashed atlas names, font, grain, shared keyboard/gamepad navigation, attract mode);
  6. the **blog** (2.0 is its launch post);
  7. housekeeping (prune worktrees, fix the portal visual-regression script broken since July, repository size, git author "Codex" on some commits).
- **Owner-reported (not yet investigated):** a large empty dark panel above "NAME & AVATAR" on the profile page, desktop, 1.9.2–1.9.3 screenshots. Check it early; it's probably a missing hero image or a layout gap.
- **X share images:** since 1.9.4, results pages pre-warm their card. X's composer may still sometimes open without the image for a brand-new link (X's own caching); the published post fetches it again. Don't spend more time here unless the published posts lack the image.

---

## 6. Decisions

**Decided by the owner on 2026-09-29:**

| Decision | Outcome |
|---|---|
| Real-time 3D characters vs pre-rendered sprites | **Real-time 3D** for heroes, enemies and bosses (§2.1) |
| HMH world size | **Ours to set:** 20,000 × 14,000, one continuous map, streamed by area (§2.2) |
| Litecoin City branding | **Top 10 LitVM projects** plus Lite Strategy, Luxxfolio, Canary Capital, Grayscale and Litescribe (§2.2) |
| STACKED colour-match overhaul | **Dropped.** Keep the gameplay; finish the game with the visual overhaul and enhancements (§4) |
| Logos on Litecoin City billboards | Use official high-quality logos where available; names only for the rest |
| Drunken Cats, Lester Labs | Both approved. Lester Labs is run by Jack, a Lunar Digital Assets team member |
| Art direction and world art | **One art direction leads everything;** level design and level art are a major focus (§1.1, §2.2, §2.3) |
| 3D model reuse and performance | Reuse existing models, polish and optimise them; hit the heavy-load targets on a mid phone (§2.1) |

**Still open** (our recommendation in the right column):

| # | Decision | Our recommendation |
|---|---|---|
| 1 | Art bible and vertical slice sign-off (§1.1) | Owner reviews both before production art starts |
| 2 | Area greybox review (§2.2) | Owner plays the 10-area greybox before area art starts |
| 3 | Cover damage reduction (tall −60%, short −40%) | Start there; tune in the balance pass |
| 4 | Gore default; share images gore-free | Default Full with a setting; share images clean |
| 5 | Lift "no voices, no footsteps" for HMH | Allow enemy grunts, death cries and footsteps; the hero stays silent |
| 6 | Chikun power-ups, chase moments, fork lanes (gameplay) | Yes, as course version 2 |
| 7 | Chikun shallow water slows you | Visual only for 2.0 |
| 8 | Dynamic music layers in HMH | Owner's call (jukebox rule) |
| 9 | HMH progression power policy (about −14%) and the Tripo casting board | Decide before the balance pass and art wave 2 |
| 10 | One 2.0 launch vs early track releases | One launch; allow STACKED or Chikun early if 2.0 slips |

---

## 7. Suggested order of work

1. **First slices, weeks 1–2**, in parallel:
   - **the art bible and the target-quality vertical slice** (§1.1). This leads everything, so start it first;
   - the HMH 3D character layer's performance gate, including the heavy-load scenarios (§2.1);
   - the HMH world size and streaming check (W0, §2.2);
   - STACKED verifier replay headroom (§4.1).
2. **Parallel tracks**, each behind a switch, each slice gated and merged into the integration branch:
   - **A. HMH world (the priority track):** W1 greybox kit and checker → W2 greybox of all 10 areas with area briefs → W3 verifier map v2 → W4–W8 art per area to the art bible (ground, foliage, water, buildings, roads, objective and arena staging), including the Litecoin City billboard data file.
   - **B. HMH heroes:** 3D rigs → movement/traversal → cover (simulation slice first) → interaction, climb and drop (simulation slice) → combat clips → idle fidgets.
   - **C. HMH combat feel, weapons, power-ups, VFX, gore, sound.**
   - **D. HMH enemies and bosses:** 3D models and clips → AI and pathing → balance → missions.
   - **E. Chikun:** visual upgrades (free) → course version 2 (new obstacles, power-ups, chases) with replay by version.
   - **F. STACKED:** verifier headroom → the living visualizer (Matrix, forward flight, portals) → feel and polish → versus, daily challenge, tutorial, results and settings → soak test.
3. **Owner checkpoints:** the art bible and vertical slice, the playable 10-area greybox before area art starts, and the open decisions in §6.
4. **2.0 certification:**
   - a full gate;
   - accepted visual baselines (`npm run visual:reboot` for HMH, plus inspected screenshots);
   - phone performance proven: every heavy-load scenario in §2.1 passes on a mid phone;
   - verifier reviews: the HMH map, enemies, cover and traversal, and the Chikun course v2;
   - STACKED replays byte-identical and under the time budget;
   - a local Ranked end-to-end in all three games;
   - the owner's promotion approval.
5. **After 2.0:** anti-cheat round 4, Phase 2 NFTs, HMH Level 2 reusing the kits, and the blog launch post.

**Effort and cost:**
- This is **many weeks** of agent work, split into roughly 25–30 gated slices. Use workflows with adversarial reviews per slice, as in September.
- Art credits: Tripo for about 80–100 subjects (about 4,000 credits). Re-check the balance and the casting-board picks before spending. With real-time 3D, the Tripo models become the in-game models directly, after cleanup, rigging and a polygon budget in Blender, so no frame rendering is needed for characters.
- Keep enough account usage headroom for release days.
