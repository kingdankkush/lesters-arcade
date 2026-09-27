# Hard Money Heroes: Level 1 (Forked Frontier) design package

**Status:** proposal for owner review. Nothing in the repo has changed.
**Baseline:** production 1.8.1 (`60ea173a`), read from the detached worktree `C:/Users/just_/lesters-arcade-wt/hmh-design`. `src/` means `apps/hmh-reboot/src/`.
**Inputs reconciled:** layout v2, objectives and prisoners v2, bosses (judged set), new enemies (judged set), hero animation v2 and progression v2. Where they disagreed, this package decides. Section 1.2 lists each call.
**Evidence** (scratchpad `design/`): `proposal-layout-v2.mjs` and `proposal-map-v2.txt` (layout sketch and checker), `anim-budget-v2.py` and its output, `mastery-draw-model-v2.mjs`, `density.mjs`, `map-audit.mjs`, `audit.json`, `paths.mjs`, `seams.mjs`, `sight.mjs`, `probe-enemy-boss.mjs`.

---

## 1. Summary

### 1.1 The package on one page

1. **Map.** It stays 12,000 × 4,800 and keeps its six districts. Today it is an open field that is walkable almost everywhere. It becomes bounded spaces: three latitude bands joined by the Frontier Highway, walled by rock, forest, water, a chasm and building blocks. Seams narrow from 3,400–4,440 open units to 850–1,550. Walkable height is capped at z24, so every shot can reach every target. There are 8 crossings in 7 styles: stone viaduct, plank suspension, stone arch, steel truss, timber trestle, steel lock-gate walkway and steel bascule. Hashwood's log-and-plank bridge is an eighth crossing in a variant of the timber style.
2. **Four bosses, one per district from west to east.** Each is dormant until the player starts it, and none runs on a timer.

   | Boss | District | Build priority | Ready at | Started by |
   |---|---|---|---|---|
   | Rug Pull Baron | Ravine | 2 | 2:00 | Entering the arena (the Welcome Mat) |
   | The Lockkeeper | Crossing | 4 | 5:00 | Turning the Lock Windlass (crank) |
   | The 51% Foreman | Mining | 3 | 7:30 | Pulling the hoist lever |
   | The Liquidator | Yard | 1 | 10:00 | Pressing the Closing Bell, or entering the secret Dark Pool |

   Each fight has a purpose that changes the district while the boss lives. The rewards are a Genesis Seal (the evolution catalyst), a permanent run perk, a new section or crossing, and in two cases a held prisoner. **The Liquidator's 20-minute timer is removed.**
3. **Exploration.** Each district has one objective chain. There are also:
   - 11 machines;
   - 2 key items;
   - 6 secrets, one of them the Dark Pool;
   - 8 prisoners, two of each kind;
   - 3 re-arming power-up sources;
   - 3 havens.

   Interaction is contextual and automatic: you stand in a ring and there is no button. Channel interactions play a full-body AAA gesture (button, lever, valve or crank, kneel). While one plays, auto-fire pauses and progress is held, never lost.
4. **Prisoners.** There are four kinds: Field Medic (health), Quartermaster (ammo and grenades), Pawnbroker (power-ups) and OG Miner (one full level of XP). Six prisoners are in the field, one per district. Two are held by bosses, one by the Baron and one by the Foreman. There are no companions.
5. **New enemies.** Six are designed. The first four need no hostile-projectile system:
   1. Rug Puller (pulls the player);
   2. Pump-and-Dump Bloater (bursts on death);
   3. Tollkeeper (blocks hits from the front);
   4. HODL Revenant (goes down but has to be finished off).

   The last two are the Money Printer (bullet patterns) and the Oracle Marksman (tracking sniper). Four of the six are human and two are zombies. Each district except Relay has a signature enemy, and four of those are lore-tied to that district's boss.
6. **Core six.** All six get:
   - poise and interrupts, and a line-of-sight gate before ranged tells;
   - telegraphs that match their hitboxes;
   - a new clip set, re-rendered on the hero camera (35°) with the shared light rig.

   Three are re-modelled: the Forkrunner (today it reads as a copy of Lilly), the Whale Enforcer and the Gas Bomber (the game logic says human, the art says zombie).
7. **Heroes.** Rig v2 adds clavicles, neck, twist bones, hands and toes. Long guns get true two-handed grips, through one merged upper-body set per weapon. The package also adds:
   - distance-driven locomotion;
   - directional deaths;
   - a death camera that actually renders;
   - a manual dodge on Left Shift (desktop keyboard only);
   - the four interaction clips;
   - power-up reactions.
8. **Progression.**
   - The four dead gun trees are wired as 12 cards. Each gun's third branch is Magazine & Salvage, so finite guns stop being traps.
   - The level-up panel keeps two cards and gains one re-roll per card per offer.
   - Card 2 offers the gun you are carrying (never the Pistol).
   - Evolutions need mastery plus a Genesis Seal from a boss. The Seal is applied automatically when you pick it up, and it never costs a level-up.
9. **Build order.**
   1. Foundations: performance, bundle size and measurement.
   2. Gameplay on today's map and art. This ships live, starting with the reworked Liquidator.
   3. The layout v2 dark pilot, promoted in one release.
   4. New boss and enemy logic, built dark.
   5. Art slices after owner co-design. Each promotes one piece of content.

   The Tripo estimate is about 3,200 of the 6,040 credits available (section 9.3).
10. **Parent authority.** All SDK, verifier and summary changes go in **one approval packet**. Once approved, the verifier ships before the child. Save schema 2, `hmh-bridge/v1` and the 65,536-byte limit stay unchanged. Until the packet is approved, a verifier-safe interim exists (section 9.4).

### 1.2 Where the six designs disagreed, and what this package decides

| # | Conflict | Decision | Why |
|---|---|---|---|
| 1 | Crossing boss: the layout had a "Bridge Exploiter" on Fork Island; the boss set has the Lockkeeper; objectives put B2 in Hashwood | **The Lockkeeper on Fork Island.** Hashwood gets no boss for now; the reserve fifth boss can go there later | The judge dropped the Exploiter because it overlaps the Gas Bomber. Hashwood is the most expensive district to draw (245 world-design sprites). The layout's island encloses the arena. |
| 2 | Boss coordinates: shipped-map fallbacks (bosses), south pits (objectives), north arenas (layout v2) | **Layout v2 coordinates** for the final map. The bosses' shipped-map fallbacks are used only for the Liquidator slice that ships before the layout | Layout v2 is the only version that is flood-checked. Objectives already said its anchors were only intent. |
| 3 | Interaction: never holster and keep firing (objectives); holster (layout); pause auto-fire plus a full-body clip with the weapon hidden (animation) | **Quick nodes** (buttons and route levers) trigger as you pass and never stop you. **Channel nodes** (valve, crank, kneel) and boss seals fill only while you stand still. While one fills, the hero docks, plays a full-body clip with the weapon stowed, and auto-fire and the auto-knife pause. Grenade and dodge stay available. Being hit pauses the fill but never removes progress. | This gives the owner-required AAA gestures readably. Keeping fire needs off-hand clips for all 8 weapons, about 8× the frames. Short channels and held progress keep late-run interaction survivable. **Owner decision 3.** |
| 4 | Interaction facing: cages face south with the operate spot south (objectives); clips only east or west (animation) | Prisoners face south toward the camera. **The cage's lock plate sits on its east or west side,** so the hero kneels side-on. | This satisfies both specs. |
| 5 | Ring size: 64 to 90 (objectives); r90 (layout); ≤ 48 (animation) | **Channel ring r64, quick ring r72, boss seal ring r90.** The dock glide covers ≤ 64 units at 4 units per tick (≤ 16 ticks) | Large enough for mobile, and the glide lines the hands up with the prop. |
| 6 | Boss timing: readiness ticks (objectives); scale by the trigger tick (layout); HP from the player's level (bosses) | **Readiness ticks gate the start** (2:00/5:00/7:30/10:00). **HP = target seconds × referenceDps(level at trigger)**, frozen when the fight starts | HP tracks player power directly. Readiness stops a boss being started by accident in the opening minutes and gives the verifier a floor. |
| 7 | Evolution items: "Margin Seals" as a key to the finale (layout), per-boss catalysts tied to weapons (bosses), "Evolution Cores" (objectives), a generic "Genesis Seal" plus mastery (progression) | **One item, the Genesis Seal.** Every boss drops one on first defeat. It evolves any mastered gun on pickup, or is banked | It works whatever guns the player owns, so no fallback weapon caches are needed. The per-boss rewards then differ by perk and section. |
| 8 | Seal gate on the Liquidator: needs 2 of 3 seals (layout); none (objectives and bosses) | **No gate.** The bell only needs 10:00 | The owner said he appears "like the others when initiated". A gate would hide him from most endless runs. **Decision 4.** |
| 9 | Boss trigger names and places for B4: Margin Call Board lever (layout); terminal at the west mouth (objectives); Closing Bell (bosses) | **Closing Bell** (button press), placed in the **east alcove** (11,700, 2,400) | Each boss gets a different verb. Every trigger sits on the far side of its arena from the mouths, so the hero is never standing in a lock footprint. |
| 10 | The Liquidator's secret arena: Counting Room behind the chapel (objectives); Dark Pool dry dock (bosses); Dark Pool walled warehouse (layout v2) | **The Dark Pool**: a walled warehouse at z0 in the Container Port (layout v2), with the bosses' ambush opener. Entering it once the Liquidator is ready starts the fight, with no key hunt | "Dark pool" is the more native crypto and markets reference. It keeps the z24 cap. |
| 11 | Dock Pass: a Mining item that works the Yard bascule (layout) | **Dropped.** The bascule lever needs no item | Objectives rule: no district depends on another. It also keeps the Dark Pool free of a key hunt. |
| 12 | Crossing extras: a raised drawbridge plus a dam crest (objectives) | **Dropped.** The Old Mill Bridge is open from the start. The Lockkeeper's reward is the third crossing, a steel lock-gate walkway that replaces the East Ford | The river already has two crossings. The boss reward gives it a second way around the Proof-of-Work choke. |
| 13 | Prisoners: two in each of Hashwood and the Yard with fixed kinds (layout); one per district plus two boss-held with a seeded deal (objectives) | **Objectives' distribution and seeded deal**, placed at layout v2 sites. The Hollow Grove and port prisoners are removed | Objectives owns prisoners, and holding prisoners gives bosses a purpose. |
| 14 | Prisoner names Tinker and Hodler (layout) against Pawnbroker and OG Miner (objectives) | **Pawnbroker and OG Miner.** The OG Miner becomes a **prospector** (slouch hat and gold pan, no helmet) | "Hodler" collides with the HODL Revenant. Miner helmets are already worn by the Revenant and the Foreman. |
| 15 | Reward delivery: persistent pickups (layout); direct grants and waiting stations (objectives) | **Direct grants and stations** (objectives) | Nothing is wasted, and there are no dynamic pickups or collectible-cap changes. |
| 16 | Minimap: layout assumed minimap icons; objectives keeps it retired | **No minimap.** Reveals mark nodes on the pause field map and the tracker pill | `main.mjs:337-338` stays retired. |
| 17 | Objective colours: red crown and brass machine beacons (layout); ivory mechanisms and bone-white boss triggers, never red (objectives) | **Objectives' palette plus layout's glyph shapes** | No objective may share a colour with a telegraph, and brass `#ffe84d` is the OG Miner and XP gold. |
| 18 | Director: boss band removed (objectives); band ticks kept (layout); district gates (enemies) | **Band ids, ticks and intervals are kept** (verifier parity). Boss reserves apply only while a boss is active. **District gates become flavour weights** plus explicit zero-weights | This is verifier-safe with no parent change, and it matches both the animation residency rule and the layout. |
| 19 | Leash: unreachable for 180 ticks (objectives); more than 2,600 path units for 600 ticks (layout) | **An enemy is retired without credit** when it is off-view and either unreachable for 180 ticks or more than 2,600 path units away for 600 ticks | Both failure modes are covered. |
| 20 | Hostile projectiles: the Printer needs them, and the enemy judge assumed bosses would share the cost; the boss judge used none | **No boss uses hostile projectiles.** The Printer carries the full cost of the system, so it stays at priority 5 | The costs are stated honestly. |
| 21 | Whale upgrade: a long charge that jams on walls (enemies); the Foreman's drill charge jams on steel legs (bosses) | **The Whale gets a short Shoulder Rush.** It runs at most 220 units, stops at the first blocker and stumbles for 30 ticks. The long charge with a jam belongs to the Foreman | This keeps the core enemy and the boss distinct. |
| 22 | Evolved-weapon look: tint (animation); an additive overlay atlas (progression) | **An additive glint overlay atlas** | Tint cannot brighten dark metal, and it clashes with unlockable weapon-skin tints. |
| 23 | Prisoner clips: 4/4/10 frames (objectives); 12/20 (animation); 8/8/8 (layout) | **captive 8, waiting 6, rescue 12, south-facing only** | Smoother than 4-frame loops, at a trivial cost. |
| 24 | Boss frames: 210 per direction with phases shown by VFX (animation); costume changes per phase (bosses) | **A full set for phase 1, plus reduced re-baked subsets for phases 2 and 3** (idle, walk, signature attacks, hit). Intro, transitions and death are south-only. About 1,100–1,200 frames per boss | Visible costume phases fit within the animation budget line. |
| 25 | Accents: the Baron and the Bloater both use `#ff3df2` | **The Baron's accent is non-emissive** (oxblood and gold material only). The Bloater keeps the magenta glow | The Bloater's glow is its danger read. Bosses never share the screen with each other. |

### 1.3 Standing rules applied everywhere

- **Determinism.** Everything runs in the fixed 60 Hz simulation with at most 4 catch-up steps. Every choice uses `fnv(runSeed, …)` or `seededUnit` with integer ticks. There is no `Math.random`, no wall clock, and no read of the camera, zoom or quality settings. Geometry is locked when a tell starts. Ids are sorted. Replay is unchanged while nothing is triggered.
- **Projection only.** Art, VFX, animation, the observer state and audio never change collision, damage, AI, spawning, RNG, progression or results.
- **Parent authority.** Wallets, profiles, leaderboards, canonical sessions, official completion and settlement stay with the parent. `SETTLEMENT_LIVE=false`. Every Ranked-visible change goes in the single parent packet (section 9.4).
- **Audio** follows the owner's list (decision 13).
  - **Allowed:** gunfire, Litecoin pickups, power-up and weapon pickups, grenades, enemy hits and enemy deaths.
  - **Removed:** the `upgrade-offer` chime, arena-change audio (`main.mjs:4279`), enemy and boss tell audio (`:4245-4251`), the reload-complete cue and the `objective-complete` chime.
  - **Silent by default:** health and ammo pickup cues, gates, levers, cages, seals and all machinery. There are no voices and no footsteps.
- **Mobile.** The iPhone XS Max must hold 30 fps or better in the busiest scenes. Emulation already misses that (37.6–100 ms in the pressure scene), so every slice uses a **no-p95-regression** gate, and the owner performs physical-device acceptance at each promotion.
- **Budgets.** Initial JS headroom is 2,147 B under 1,048,576 B, with 350 B reserved for unlockables. The child entry is about 479.7 KB of 480,000 B. Every slice records its delta, and **the running total must be ≤ 0**; see S0.2 for the offsets.
- **Every render change** goes through `npm run visual:reboot`, with inspection of both the metrics and the screenshots. Acceptance happens only after review.

---

## 2. Level 1 layout

### 2.1 Contract and ground rules

**Kept:**
- bounds of 12,000 × 4,800 and the player spawn at (800, 2,400);
- the six district ids and x-bands;
- the reveal grid (50 × 20) and the navgrid (200 × 80 cells of 60 units, 4-connected, blockers inflated by 18);
- the surface ids `proof-of-work-bridge` and `crossing-shallows`;
- the 6 `worldSites` and 3 `secrets` catalogue ids, rebound to new features;
- all 10 POI catalogue ids (append-only);
- band ids, ticks and intervals.

**Measured rules the layout obeys:**

| Rule | Value |
|---|---|
| Landscape phone view (XS Max) | about 925–1,245 × 430–575 units. Portrait is about 200–275 × 430–600, a known limit, so arenas target landscape |
| Director spawn validity | off the ±720 × ±450 logical view, ≥ 560 from the hero, not blocked, not deep water, within 64 units of the hero's height |
| Shots against height | Player shots fly at z34 and never gain height. **From z0, nothing standing on z34 or higher can be hit**, so walkable ground is capped at **z24** |
| Traversal | Step-ups ≤ 8 need a `visibleStepId`. Ramps allow ascent up to 64. Drops > 16 only along the surface's `oneWayDrop`. Enemies: curb 8, drop 12, ascent 48 |
| Corridors | main path ≥ 220 clear; optional path ≥ 160; hubs at least one phone screen tall |
| Masses | Every mass is a convex polygon with art, never the vector fallback. There is no walkable space under canopy |

### 2.2 Map overview (layout v2 sketch; one character per 200 × 200 cell; header in thousands of x)

```
      0    1    2    3    4    5    6    7    8    9    10    11
    0 TTTTTTTTT#####################TTTTTTTTTT###################b
  200 TTTTTTTTT###~~^1^^^TTTT.S.#...TTTT,...TT####.bL.##.........b
  400 TTTTTTTTT###~~^^^/^TTTT~~.b..eTTT.,...TT####..3.##.bb......b
  600 TTTTT^^^T###~~.../.TTT~~~.G...TTT.,L..TT####....##..P.S4...b
  800 TTTT^GL^T###~~....!+++===++.b.TTT.,+..TT####.++.##.bb......b
 1000 T...^^^^T..G!!|.+.!+e+===/++*.TTT.+...^T##^^.||.##.........b
 1200 T.e..//..+++~~..+.#...~~~.++b...G!!TTTG^#^S^^//^^^b~~!!~~~~b
 1400 T..b.+++e+..~~##++#...~~~b++.++P+.,TTT////^^^P/^^^b++!G+++eb
 1600 Tb...+..T...~~#L++#...~~~P.+.T..+.TeTT+.//^^^^^*K^+++++++L+b
 1800 TS...+..Te..~~##+e##..~~~..*.TTT+TT,TT+T#^e^^^^^^^++b..|..bb
 2000 T.*.++..T.@.~~##++##..~~~..+.TTT+TT,TT+T##^^//^^^^++b.....bb
 2200 T...+HHHHHHH===HHHHHH@===/H++HH.+.==..+....../.bb.H+HHHH..bb
 2400 T..+@HHHHH+H==HHHHHHHH=L=/HHHHeH@H==HHHeHHHHH.HHGHHHHHHH..4b
 2600 T::+++..T..+~~~####...~~~...+......,+.....H@HHHHH.++b.....bb
 2800 T::+.+..T##K~~~####,,~~~~~~~+TTTTTT,+TTTe.........++b..|..bb
 3000 T..G.+..T##+~~~####,,=..2.~~+TTTTT.,+.TT.,,.......+e.bb.bb.b
 3200 T.P..+..T#S+~~~####,==|...~~+......,*..T.,,......e+++++++++b
 3400 T.bb.+..T..+~~~^*^/,,~....|,+++++++,+..T........b..*++G+++*b
 3600 T....+..T::+:~:^^^/e,~....~~eTT..T.G++.....................b
 3800 T::::++,T::++++P+::+~~~~~~~~~TT..S!.,++++++++++++++...P.b.bb
 4000 T:::::+..+++:+++++++~~~~~~~~~TT.PT..,.+e+++.......e+.bb....b
 4200 Te::::++e+:e::::::e.~~~~~~~~~TTTTT...,........e...........eb
 4400 T.......T###########~~~~~~~~~TTTTTTTTTTT##########b........b
 4600 TTTTTTTTT###########~~~~~~~~~TTTTTTTTTTT##########bbbbbbbbbb
       Relay    | Ravine    | Crossing   | Hashwood  | Mining   | Yard
```

**Legend**

| Kind | Symbols |
|---|---|
| Ground | `.` ground; `:` walkable clutter |
| Water and rock | `,` shallow water (×0.72); `~` deep water or chasm; `#` rock mass |
| Structures | `T` forest mass (no walkable canopy); `b` building or container mass |
| Height | `^` z24 terrace; `/` ramp or stairs; `=` bridge deck |
| Roads | `H` highway; `+` road, lane or trail |
| Gates | `\|` arena lock; `!` key, secret or reward gate |
| Markers | `@` spawn or entry; `1`–`4` boss trigger; `P` prisoner; `S` secret; `G` machine; `K` key item; `L` landmark; `*` POI; `e` spawn lair |

**Changes this package makes to the sketch** (the sketch is to be re-run with `node proposal-layout-v2.mjs` before B0):

| Area | Change |
|---|---|
| Relay | The `G` at (600, 3,000) becomes the **farmstead generator** (catalogue `relay-power`), cabled to the barn doors. The `G` on Relay Hill becomes the **Relay uplink** (reveal) |
| Ravine | Trigger `1` moves from the bench plunger to the **Welcome Mat**, in front of the Baron's tent (3,100, 640). The haul-pass gate becomes the **Diggings claim gate**, which also holds a boss-held prisoner |
| Crossing | Trigger `2` moves from the toll-house button to the **Lock Windlass** capstan at the east lock head (5,180, 3,560). The **East Ford becomes the Lock Gate walkway**, chained until the Lockkeeper is defeated, so before the fight Fork Island has one mouth (the trestle) |
| Hashwood | Prisoner `P` at (6,400, 4,000) is removed; the Hollow Grove keeps a cache and a Revenant ambush. The logging-camp `P` (6,300, 1,500) is Hashwood's only prisoner. A new `K` **Lamp Oil** sits at the logging camp (6,450, 1,350). A new **Beacon brazier** sits at the beacon landmark (7,100, 750) |
| Mining | The `K` Dock Pass at (9,600, 1,750) is removed. Trigger `3` becomes a **hoist lever** at the same spot. The Mine Vault becomes the **Hoist Vault**, which also holds a boss-held prisoner |
| Yard | Prisoner `P` at (10,450, 650) in the port is removed. The bascule lever needs no item. Trigger `4` becomes the **Closing Bell** in the same alcove. The plaza is trimmed to the **Margin Floor** (see 2.6, D6) |

### 2.3 Road hierarchy

| Tier | Examples | Clear width | Rules |
|---|---|---|---|
| 1 Highway | Frontier Highway | ≥ 220 (art 260) | Never gated. Curves only where terrain forces it |
| 2 Road | County road, Quarry Road, Mill Road, bench haul road, Hoist Road, West and South Streets | ≥ 200 | Joins hubs and forms loops. Ends only at a destination |
| 3 Lane | Farm track, canyon lane, ford road, rail line, quay | ≥ 160 | Leads to pockets, prisoners and reward rooms |
| 4 Trail | Canyon, beacon, lookout and sanctuary trails; Shore Path; the creek | ≥ 160 | Optional routes; a single navgrid row is allowed |

**The highway.** It runs from spawn (800, 2,400) → Settler Viaduct → Spire Flats → Proof-of-Work Bridge → Hashwood Cut → creek bridge → mining floor → Main Street → plaza (11,100, 2,400).
- It is 10,373 units long, about 43 s unopposed. The longest straight is 950.
- Sightline breaks come only from the terrain bends at the viaduct, the bridge approaches, the Hashwood Cut and the mining floor.

**Cover rule.** No blocker may enter a road's clear width. Road furniture (wrecks, jersey barriers, bus shelters, lamp bases) sits at least half the clear width + 24 from the centreline, which is 134 on the highway.
- **Hard cover lies within 250 of every highway point.**
- A road checker enforces this. It also fixes today's roads that run over fuel drums, `ravine-barricade-b` and the trap-court fence.

There are no dead-end spurs except intended pocket lanes: the barn gate, the vault approaches and the Dark Pool door.

### 2.4 Water and bridges

**Water bodies**

| Body | Extent | Type |
|---|---|---|
| Liquidity River trunk | 4,500–5,000 × 250–2,750 (waterfall at the north cliff) | deep |
| Split pool | 4,150–5,550 × 2,750–2,900 | deep |
| West and east branches | 4,150–4,450 and 5,250–5,550 × 2,900–3,900 | deep |
| Fork Island | 4,450–5,250 × 2,900–3,900, **enclosed by water** | land |
| Liquidity Reservoir (south edge) | 3,950–5,850 × 3,900–4,800 | deep |
| Rugpull Gorge | 2,450–2,850 × 250–2,600, then 2,500–2,900 × 2,600–3,700, opening into the Dry Wash | chasm (deep-water rules) |
| Settlement Canal | 10,100–11,850 × 1,300–1,480 | deep |
| West Marsh | 3,800–4,150 × 2,900–3,900 | shallow |
| Farm pond | 1,300–1,600 × 3,750–4,050 | shallow |
| Tailings | 8,200–8,600 × 3,000–3,400 | shallow |
| Hashwood Run creek | 160 wide, y 250–4,350; fordable everywhere | shallow |

**Crossings**

| # | Crossing | Style (placeholder until co-design) | Deck | z | Clear width | Role |
|---|---|---|---|---|---|---|
| 1 | Settler Viaduct | Stone-arch viaduct | 2,430–2,870 × 2,240–2,480 | 0, flush | 240 | Highway choke (700 against a 3,700 detour) |
| 2 | Rugpull Rope Bridge | Plank suspension | 2,430–2,870 × 1,020–1,180 | 0 | 160 | Shortcut into the Quarry Bowl. Raised until the winch is cranked |
| 3 | Old Mill Bridge | Stone arch (surface `crossing-shallows`) | 4,500–5,000 × 845–1,105 | 16, 100-unit ramps | 260 | North loop to the Landing. Open from the start |
| 4 | Proof-of-Work Bridge | Steel through-truss (surface kept) | 4,500–5,000 × 2,290–2,510 | 16 | 220 | Highway landmark and choke (900 against 3,600) |
| 5 | Fork Trestle | Timber trestle | 4,150–4,450 × 3,150–3,350 | 0 | 200 | Island access from the west; a Lockkeeper lock |
| 6 | **Lock Gate walkway** | Steel lock-gate walkway with stone lock walls, handrails and lamp posts | 5,250–5,550 × 3,450–3,700 | 0 | 220 | **Lockkeeper reward**: chained shut until he is defeated, then a permanent second way round the Proof-of-Work choke |
| 7 | Canal Bascule | Steel bascule, flush with the quays | 10,700–10,920 × 1,300–1,480 | 0 | 220 | Its lever lowers the leaf; the port and the Dark Pool lie beyond |
| 8 | Hashwood Run Bridge | Log and plank | 6,900–7,150 × 2,250–2,600 | 0 | 350 | Keeps the highway dry |

**Making bridges read as real bridges** (projection only, except the rails):
- abutments, wing walls, piers and arches in the water;
- rope posts, trestle bents, and a truss top chord that fades while the hero is on the deck;
- rails are combat-cover capsules (r14, maxZ 72) that stop side shots;
- the raised bascule leaf and the chained lock gate are gate capsules.

**The gorge.** It needs one projection-only renderer addition: the far (north) wall face and the rims. If that slips, it ships as a narrow white-water canyon creek on the same geometry.

### 2.5 Elevation

| Tier | z | Pieces | Access |
|---|---|---|---|
| Water and chasm | −24 | river, pool, branches, reservoir, gorge, canal | bridges |
| Floor | 0 | most of the map; all four boss arenas | — |
| Decks | 0–16 | bridges | ramps on the two z16 bridges |
| Terrace | **24** | Relay Hill 950–1,500 × 700–1,200; Quarry bench 2,850–3,700 × 250–520 (inside B1); Cliff Dwellings 3,000–3,600 × 3,450–3,700; Ranger Lookout 7,600–7,900 × 1,150–1,450; Mining Bench 8,350–10,000 × 1,250–2,050; the S5 adit pocket | Ramps at least 250 wide: hill 1,100–1,350 × 1,200–1,450; bench 3,350–3,600 × 520–720; dwelling stairs 3,600–3,800 × 3,450–3,700; lookout 7,625–7,875 × 1,450–1,650; Ramp A 8,950–9,200 × 2,050–2,300; Ramp W 8,100–8,350 × 1,450–1,750; Hoist Road 9,060–9,340 × 1,200–1,450 |

- Terraces drop one-way to the south; their other edges are cliffs both ways.
- Today's z48 mining deck and z64 ravine overlook are removed.
- A terrace gives one height layer (+5% range and knockback). It is the natural perch for the Oracle Marksman.

### 2.6 District plans

#### D1 Frontier Relay (x 0–1,800): Homestead and Relay Hill. No boss; the tutorial district.

| Aspect | Plan |
|---|---|
| Biome | Prairie farm, orchard, crop rows, hedgerows. Mostly open; the homestead cluster is the dense spot. Accent relay-cyan |
| Masses | North woods 150–1,500 × 250–700; north-west woods 150–950 × 700–1,050; north-east woods 1,500–1,800 × 250–700; farmhouse 250–450 × 1,550–1,850; barn 600–850 × 1,450–1,650; barn-yard hedge ring 250–950 × 3,100–3,750 with the south barn; seam woods at x 1,650–1,800 (y 700–1,300, 1,600–2,250, 2,600–4,100, 4,400–4,550) |
| Hubs | Spawn Meadow (800, 2,400); South Farmyard (700, 2,900) with a kiting loop; Relay Hill (1,225, 950) z24 |
| Roads | Highway; county road (1,225, 1,450) → spawn → barn gate; farm track spawn → (1,150, 3,800) → Dry Wash; canyon trail 1,300–1,800 × 1,300–1,600 |
| Landmark | relay-tower (1,200, 850) on the hill |
| **Chain** | **Farmstead generator** (button, quick; catalogue `relay-power`) at (700, 2,980). A cable lights along the hedge to the **barn doors** (750, 3,100), which open the **barn yard**. Inside: **Silver Reserve** (Shotgun, the gun's only world source) and field prisoner **P1** (550, 3,300) |
| Machine | **Relay uplink** (button, quick) at (1,150, 800) on the hill. It marks every machine and prisoner within 2,500 as discovered on the field map. It never reveals secrets and gives no heal |
| Secret | **S1 Root Cellar** (catalogue `farmstead-hidden-supplies`), a hatch at (350, 1,920) |
| POIs | relay-cache (500, 2,000) medkit; relay-armory (1,300, 900) Pistol ammo |
| Hazards | none |
| Lairs | woods mouth (400, 1,200); canyon seam (1,750, 1,450); cornfield (300, 4,300); farm track (1,700, 4,250) |
| Entry | Spawn Meadow: generator about 650 away, P1 934 away |

#### D2 Rugpull Ravine (x 1,800–3,800): Canyon, gorge and quarry. Boss B1: the Rug Pull Baron.

| Aspect | Plan |
|---|---|
| Biome | Red-rock mesas, chasm, quarry, Dry Wash, cliff dwellings. Accent warning-amber |
| Masses | West mesa 1,800–2,450 × 250–950; south-west mesa 1,800–2,200 × 2,700–3,450; Forked Spire mesas 2,850–3,280 and 3,520–3,800 × 1,370–2,150; east quarry wall 3,700–3,800 × 250–1,450; south-east mesa 2,900–3,800 × 2,650–3,450; south cliffs from y 4,400 |
| Hubs | Canyon Mouth (2,150, 2,000); Spire Flats (2,870–3,800 × 2,150–2,650); Quarry Bowl (B1); Dry Wash (1,800–3,800 × 3,700–4,400), the kiting ground |
| Roads | Highway over the viaduct; Quarry Road (x 3,280–3,520, 780 long); a canyon lane 250–300 wide to the Wash; a canyon trail to the rope bridge |
| Landmark | forked-spire (3,050, 1,750) |
| **Chain** | **Winch Handle** (item) at (2,350, 2,900) in the canyon lane → **rope-bridge winch** (crank channel; catalogue `ravine-winch`) at (2,380, 1,100) → the Rugpull Rope Bridge lowers, a western shortcut into the Quarry Bowl that saves about 900 path units |
| Boss | **B1 Rug Pull Baron**, Quarry Bowl (section 4.4). His defeat opens the **Diggings claim gate** (east quarry wall 3,700–3,800 × 850–1,100): the Diggings cache, **boss-held prisoner H1**, and the haul pass through to the Crossing's west bank |
| Field prisoner | **P2**, surveyor camp in the Dry Wash (3,000, 3,950) |
| Strongbox | on the Cliff Dwellings z24 (ravine-overlook-cache POI id kept) (3,300, 3,580) |
| Secret | **S2 Surveyor's Ledge** (catalogue `ravine-surveyor-cache`), a pocket 1,950–2,200 × 3,150–3,350 behind a rockfall breakable at (2,175, 3,250) |
| POI | ravine-salvage: the id stays catalogued but is **not placed**, because it was a duplicate Shotgun |
| Hazard | rockfall (3,450, 4,150). Its period is 240 ticks while the Baron lives and 300 after |
| Lairs | canyon west (1,900, 1,950); Quarry Road adit (3,400, 1,950); Wash west (2,300, 4,250); Wash east (3,750, 4,300) |
| Entry | Ravine Approach (2,150, 2,000): winch 929 away, Winch Handle about 900 away |
| Signature enemy | Rug Puller (the Baron's crew) |

#### D3 Liquidity Crossing (x 3,800–6,000): The Fork. Boss B2: the Lockkeeper.

| Aspect | Plan |
|---|---|
| Biome | River valley, marsh, the mill hamlet Liquidity Landing, fuel depot. Accent litecoin-silver |
| Masses | West-bank pines 3,800–4,500 × 250–750; west bluff 3,800–4,100 × 1,700–2,250; mill 5,200–5,400 × 450–600; bank 5,600–5,800 × 850–1,050; store 5,600–5,800 × 1,250–1,400; boathouse 5,050–5,250 × 1,400–1,550; depot tanks 5,600–5,800 × 1,700–1,900; toll house 4,750–5,000 × 2,950–3,100 (the Lockkeeper's hut) |
| Hubs | West Bank bridgehead (4,200, 2,350); Landing streets (5,500, 1,100), at least 200 wide; East Bank (5,700, 2,700); Fork Island (B2) |
| Roads | Mill Road loop: haul pass → west bank → Old Mill Bridge → Landing → highway. Ford road: east bank → Lock Gate walkway (after B2). Shore Path east to Hashwood |
| Landmark | proof-of-work-bridge (4,750, 2,400), with the set-piece back on the bridge |
| **Chain** | **Mill sluice valve** (crank channel; catalogue `crossing-pump`) at (5,250, 650). The mill wheel turns and the storeroom opens: the **Liquidity Haven** (ammo refill, re-arms every 7,200 ticks) |
| Boss | **B2 The Lockkeeper**, Toll Lock on Fork Island (section 4.6). Reward: the Lock Gate walkway |
| Field prisoner | **P3**, boathouse (5,150, 1,650) |
| Secret | **S3 Behind the Falls**: a ledge 4,550–5,000 × 250–430 behind a rock curtain at (4,975, 340), reached by a 160-wide path hidden by a rock spur. The falls sheet renders north of the ledge and never covers the hero |
| POIs | crossing-bank-cache (5,700, 1,120), the **Railgun's only source**; crossing-fuel-depot (5,500, 1,950), the nuke |
| Hazards | fuel drums (5,700, 2,000) r150. The no-op `crossing-current` hazard is deleted |
| Lairs | west pines (4,150, 1,100); Landing north (5,950, 450); marsh (3,950, 3,600); east shore (5,700, 3,700) |
| Entry | West Bank (4,200, 2,350): P3 1,180 away |
| Signature enemy | Tollkeeper (manning the bridges for the Lockkeeper) |

#### D4 Hashwood (x 6,000–8,000): Old-growth forest. No boss; the reserve fifth boss is a later option.

| Aspect | Plan |
|---|---|
| Biome | Conifer and deciduous old growth, creek, logging camp, ranger lookout. **Forest masses are impassable**; trails are open-sky cuts. Accent shrine-mint |
| Masses | north-west 6,000–6,700 × 250–1,150; north-east 7,550–8,000 × 250–1,100; middle 6,700–7,600 × 1,150–1,850; Cut edges at y 1,850–2,150 (gaps at the logging road x 6,380–6,620 and the lookout trail x 7,650–7,850) and y 2,750–3,050 (sanctuary gap x 7,200–7,400); south forest and grove walls |
| Hubs | Logging Camp 6,100–6,700 × 1,150–1,850; Beacon Clearing 6,700–7,550 × 250–1,150 (dead end); Highway Cut y 2,150–2,750; Sanctuary (7,200, 3,500); Hollow Grove 6,250–6,600 × 3,780–4,250 (secret) |
| Landmark | hashwood-beacon (7,100, 750) in the Beacon Clearing |
| **Chain** | **Lamp Oil** (item) at the logging camp (6,450, 1,350). The **log-pile lever** (quick) at (6,550, 1,200) opens the log chute (6,700–6,900 × 1,150–1,350), a shortcut to the Beacon Clearing. The **Beacon brazier** (kneel channel, 90; needs the Lamp Oil) at (7,100, 820) lights the beacon and grants **Grove Blessing: +20 max HP for the run** |
| Machines | **Ranger Lookout** (7,750, 1,300), z24: stand for 60 ticks and every machine and prisoner within 2,000 is marked discovered. **Sanctuary lantern crank** (crank channel; catalogue `hashwood-shrine`) at (7,050, 3,650): opens the **Litecoin Sanctuary** (+30 HP, re-arms every 7,200) and the **Scrypt Cache** (+1 grenade, re-arms every 7,200; its nuke art becomes a grenade crate) |
| Field prisoner | **P4**, logging camp (6,300, 1,500) |
| Strongbox | hollow stump (hashwood-shrine POI id kept; Double Damage source) (7,200, 3,350) |
| Secret | **S4 Deadfall** (6,750, 3,900) leads into the Hollow Grove: a cache and 2–3 dormant HODL Revenants |
| Hazard | spore bed (7,500, 3,750) |
| Lairs | creek hollow (7,000, 1,750); Cut west (6,100, 2,450); Cut east (7,900, 2,450); rail south (7,900, 4,150) |
| Entry | Hashwood Cut (6,500, 2,450): P4 971 away, Lamp Oil about 1,100 away |
| Signature enemy | Pump-and-Dump Bloater |

#### D5 Mining Camp (x 8,000–10,000): Hashrate Mine. Boss B3: the 51% Foreman.

| Aspect | Plan |
|---|---|
| Biome | Terraced workings, timber headframe, rail yard. Accent ore-gold |
| Masses | west cliff 8,000–8,350 × 250–1,450 and 1,750–2,150; spoil heap 8,350–8,800 × 250–1,250; headframe base 9,050–9,350 × 250–420; vault block 9,600–10,000 × 250–1,250 (the Hoist Vault inside); pit retaining walls; ore bins; mine office 9,700–9,950 × 1,650–1,850; processing plant 9,350–9,850 × 2,150–2,350; rail-yard sheds |
| Hubs | Headframe Pit (B3, z0); Bench works yard (z24); floor yard with the tailings loop; rail yard |
| Roads | Highway along the floor; bench haul road via Ramp A; Hoist Road into the pit; Ramp W; rail line |
| Landmark | mining-headframe: its wheel renders above the pit's north edge (9,200, 330), with its legs around the cage shaft |
| **Chain** | **Steam valve** (crank channel; catalogue `mining-valve`) at (9,600, 2,420): vents a steam trap across the highway at (9,600, 2,480) r110 that hurts enemies and the hero, and opens the **Liquidation Trap** court (Double Damage, re-arms every 10,800). While the Foreman lives, the same vent also cycles by itself |
| Boss | **B3 The 51% Foreman**, Headframe Pit (section 4.5). Reward: the **Hoist Vault**, holding **boss-held prisoner H2** and a re-arming ammo haven |
| Field prisoner | **P5** (9,000, 1,450), a cage beside the top of the Hoist Road, outside the arena |
| POI | mining-control-room (9,500, 1,700), the **Machine Gun's only source** |
| Secret | **S5 Collapsed Adit**, a pocket 8,425–8,675 × 1,000–1,250 behind boards at (8,550, 1,220) |
| Lairs | bench west (8,450, 1,950); floor west (8,150, 2,900); floor east (9,900, 3,250); rail yard (9,200, 4,250) |
| Entry | Mining floor (8,600, 2,750): steam valve 1,053 away, P5 1,360 away |
| Signature enemy | HODL Revenant (the Foreman's dead shift) |

#### D6 Liquidation Yard (x 10,000–12,000): Liquidation City. Boss B4: the Liquidator.

| Aspect | Plan |
|---|---|
| Biome | Town blocks, plaza, canal, container port. Accent liquidation-pink |
| Masses | container wall along x 10,000–10,100 (openings: Main Street y 2,280–2,520, South Street y 3,300–3,500, rail y 3,850–4,300); port container rows; Dark Pool walls 11,000–11,800 × 350–1,150; NW block 10,330–10,580 × 1,650–2,280; SW block 10,330–10,580 × 2,520–3,100; north blocks 10,580–10,980 and 11,220–11,620 × 1,650–1,880; east block 11,620–11,850 × 1,650–3,100 (bell alcove cut 160 deep at y 2,320–2,480); south blocks 10,580–10,980 and 11,220–11,620 × 2,920–3,200; warehouse compound 10,500–11,100 × 3,600–4,300 |
| Hubs | **Liquidation Plaza** 10,580–11,620 × 1,880–2,920. Its sealed **Margin Floor** is 1,040 × 540 (y 2,130–2,670), with **tiered kiosk rows** filling the north and south strips (blocked), and three mouths: W (Main Street, 240), N and S stairs (x 10,980–11,220). Also the quay (y 1,480–1,650), the Container Port and the warehouse district |
| Landmark | liquidation-tower (11,420, 1,765), whose freight lift faces the plaza |
| **Chain** | **Warehouse lever** (quick; catalogue `yard-warehouse`) at (10,800, 3,520) opens the compound: **Warehouse Reserve** (Flamethrower), field prisoner **P6** (10,800, 3,800), and the logbook lore. **Bascule lever** (quick) at (10,810, 1,560) lowers the leaf into the Container Port, where the **Dark Pool** secret lies |
| Boss | **B4 The Liquidator**: the Closing Bell on the Margin Floor, or the Dark Pool (section 4.3) |
| Secret | **Dark Pool door** (catalogue `warehouse-logbook`; the harbourmaster's logbook is nailed to it) at (10,975, 750): a breakable cracked container wall leaking violet light |
| POIs | yard-extraction-console (10,250, 3,450), the **Grenade Launcher's only source**, renamed **"Repo Office"** (Level 2 reserves "extraction", and "Pawn Shop" would collide with the Pawnbroker); yard-medbay-cache (11,700, 3,450) |
| Hazard | liquidation grid (11,400, 3,420) r150. It pulses every 240 ticks while the Liquidator lives and turns off at his defeat. It is 372 from the south mouth and 301 from the medbay cache |
| Lairs | quay east (11,750, 1,560); West Street (10,215, 3,000); rail west (10,150, 4,150); south-east (11,700, 4,350) |
| Entry | none. The `yard` entry is dropped; see decision 1 on the entry table |
| Signature enemy | Money Printer (the Liquidator's clerks) |

### 2.7 Combat spaces, chokes, spawns and director

**Space types**

| Type | Size | Notes |
|---|---|---|
| Hub | 600–1,600 across | At least 2 exits and a kiting loop of 1,600 or more round a solid centre |
| Corridor | 220–600 wide, ≤ about 800 long | A connector, not a fighting lane |
| Pocket | ≤ 400 deep | Prisoner yards, vaults, secrets |
| Arena | r330–520 | Sealed |

**Hub cover.** Hubs get 4–8 pieces of hard cover against 640-range suppressors.

**Chokes.** Fairness comes from a director rule, not from detours.
- **One-front rule:** while the hero is on a choke polygon + 300, lairs are eligible only on the side the hero entered from.
- Lairs sit on both river banks, so standing on the west bank no longer funnels every enemy onto one bridge.
- The Tollkeeper's chokepoint hold (section 5) turns the two river bridges into literal toll gates. That is a readable, intended fight.

**Lairs.** There are 24, four per district.
- Each is at least 700 from any interaction zone, outside every arena radius + 200 and outside every hazard radius + 200.
- **A lair is valid when** it is off the logical view, at least 560 from the hero, and within 2,600 enemy path units. Path distance comes from a breadth-first search on the existing flow field every 30 ticks.
- **Preference:** lairs at 900–2,400. Rotation among valid lairs is seeded, and neighbouring districts are included. This replaces first-valid-by-id (`encounter-director.mjs:211-221`).
- **Sketch coverage:** zero spawn sanctuaries. 97% of cells outside arenas have at least 2 valid lairs. The minimum lair-to-interaction distance is 711.

**Roster.** It is keyed by time band, with **district flavour weights** instead of district gates. The "never" rules are zero weights. Today Relay stays rusher and flanker all run (`:51-58`); the elite band now adds the Rug Puller and the Marksman there.

**Capacity bank.** Scripted spawns (guard crews, ambushes, champion waves) insert only while total insertions stay at or below the verifier's `spawnCapacity(tick)` less its Liquidator-add term.
- There is a parity test against `server/verify/hmh-plausibility.mjs:148-175`.
- If the bank is short, the wave shrinks or queues.

**Leash and recycle.** An ordinary enemy is retired **without kill credit** (event `enemy:recycled`) when it is off-view and either:
- its flow-field cell has been unreachable for 180 consecutive ticks; or
- it has been more than 2,600 path units from the hero for 600 ticks.

**Entries (5, seeded):**

| Entry | Position |
|---|---|
| Spawn Meadow | (800, 2,400) |
| Ravine Approach | (2,150, 2,000) |
| West Bank | (4,200, 2,350) |
| Hashwood Cut | (6,500, 2,450) |
| Mining floor | (8,600, 2,750) |

Each is at least 900 from every boss trigger and prisoner.

### 2.8 Navgrid, rendering and density

- **Grid.** 200 × 80 and 50 × 20 are unchanged.
- **Blockers.** About 180 convex masses, up from 112 blockers today. The idle-sliced navgrid build (210 ms in Node today) is budgeted at 1.5× in Node and must hold on the XS Max emulated profile. Swept-collision cost is measured as well.
- **Per-radius clearance layers** (28, 30 and 36) keep large bodies off 160-wide trails. They are needed by the Tollkeeper, the Bloater and the Whale.
- **Density metric v2** (per 1,200 × 600 window) counts sprites, summed sprite area, stencil masks, vector-fallback draws, and raised and chasm faces.

  | Measure | Budget |
  |---|---|
  | Sprites | p99 ≤ 54, max ≤ 63 (today's envelope) |
  | Area | ≤ today's p99 |
  | Vector-fallback masses | 0 |

  Budgets rise only after an XS Max scene shows headroom.
- **Render.**
  - Masses: a top material plus modular edge strips.
  - Road tiers: variants in the existing mipmapped terrain atlas.
  - Water motion: tile animation.
  - World kits: a 128 px mobile tier (precedent `native-barriers.mjs:11`).
  - A **decoded-memory gate** is added to `hmh-reboot-production-asset-qa.mjs`.

### 2.9 Layout gates (per district, on the real navgrid)

1. Reachability is 50–80% per district. The sketch reads 62/52/52/51/68/58%, a mean of 57%, against 79% today; **decision 6**.
2. No unreachable walkable pockets, except secrets and vaults.
3. Every arena passes a sealed-lock flood.
4. Zero spawn sanctuaries, and at least 90% of cells outside arenas have 2 or more valid lairs.
5. The spacing rules hold.
6. The corridor-width and road-clearance sweeps pass.
7. No more than 3 empty reachable 400 × 400 cells per district, not counting arenas, Spawn Meadow, the Dry Wash or the plaza.
8. The density v2 and decoded-memory budgets are met.
9. Navgrid build time is within budget.
10. Same-seed determinism holds, and the capacity-bank parity test passes.
11. `visual:reboot` has been reviewed.
12. A serial browser smoke passes.
13. There is no regression in the XS Max emulated exploration and pressure scenes.
14. The briefing (`level-briefing.mjs`) and the docs are updated in the same commit.

---

## 3. Mission objectives and prisoners

### 3.1 Objective classes (one pure module, `src/mission-objectives.mjs`)

This module replaces today's touch-to-start sites, the single 210 × 200 court template, and the hard-coded seal.

| Class | Examples | Trigger and mode | Repeats | Base reward |
|---|---|---|---|---|
| Section or route gate | barn doors, rope bridge, log chute, warehouse gate, bascule, mill storeroom; boss-reward gates (Diggings, Lock Gate, Hoist Vault) | Opened by its switch or by a boss defeat; never a zone | once | Access plus XP (3.7) |
| Switch or machine | 11 machines (3.4) | Quick (button 30, lever 45) or channel (crank or valve 90) | once; havens re-arm | The prop effect plus XP. Switches never heal |
| Unlock | prisoner cage, strongbox | Channel, kneel: cage 90, strongbox 90 | cage once; strongbox re-arms every 10,800 | Prisoner reward; 1 seeded timed power-up |
| Boss trigger | Welcome Mat (enter + confirm 30), Lock Windlass (crank 90), hoist lever (lever 60), Closing Bell (button 90), Dark Pool (enter) | A seal ring (r90) that fills only after `readyTick`, **draining 4 per tick once you leave**. The enter trigger fires 48 units past the line | once per run, with retreat (4.1) | The fight; rewards come on defeat |
| Item | Winch Handle, Lamp Oil | Touch within 56 | once | The item plus XP |
| Secret | 6 (3.6) | Break the wall (60 HP) or pry it (kneel 60), then enter the hidden volume | once | Supply, lore, XP; silver after the packet |
| Station | havens; a Medic or Quartermaster waiting with an unclaimed reward | Touch the ring while capacity allows (`canAcceptCollectible`) | havens re-arm every 7,200 | Heal, ammo or grenades |

**Locked nodes** show a grey ring, a padlock glyph and the icon of the missing item, for example "Needs Winch Handle". A boss trigger that is not yet ready shows a red lamp and "Opens at 5:00" from the run clock. **Every requirement is inside the same district.**

### 3.2 Automatic interaction rules (the reconciled contract)

**Operate spots.**
- Every mechanism row has `{prop, propBlockerId, operate:{x, y, facing}}`.
- The operate spot is walkable with 24-unit clearance and lies outside the prop's collider.
- **The facing is east or west.** Clips are authored side-on so the hands show.
- The prop's handle sits at `D + handTarget(facing)`, where D is the dock point on the ground.
- The ring disk is dry, walkable ground. LOS is traced from the player at z+24 to the operate spot at z+24, excluding the node's own blocker.

| Mode | Ring | Starts | Fills while | Inside but moving | Leaving the ring | Being hit |
|---|---|---|---|---|---|---|
| **Quick** (button, route lever) | 72 | after 12 consecutive ticks inside (commit) | always, once committed | fills | finishes anyway | no effect |
| **Channel** (crank, valve, kneel, stand) | 64 | inside, move magnitude < 0.2, \|dz\| ≤ 8, LOS clear | every such tick unless paused | held | held for 120 ticks, then drains 2 per tick | fill pauses: `pausedUntil = max(pausedUntil, tick + 12)`. Hits never stack and never remove progress |
| **Seal** (boss triggers) | 90 | as channel, plus `tick ≥ readyTick` | as channel | held | drains 4 per tick at once | as channel |

**Rules for channels and seals**

| Topic | Rule |
|---|---|
| Docking | After 6 consecutive still ticks in the ring, the simulation glides the hero to D at 4 units per tick with swept collision, facing locked (≤ 16 ticks for ≤ 64 units). Any move input cancels it |
| Weapons | While the channel clip plays, **auto-fire and the auto-knife are suspended** and the weapon is stowed. Manual grenade and dodge stay available. Enemies keep attacking. Moving in the ring restores firing at once. Quick nodes suspend nothing unless you stand still when they commit, in which case the short press or lever clip plays |
| Clip exit | Move input (3-tick blend), dash, grenade, a heavy hit (≥ 20 damage, a boss attack or an explosion) or death. Additive hurt plays over the clip without exiting |
| Hit detection | Reuses the simulation's `lastPlayerHit.tick === tick − 1` (`main.mjs:4504`, reset `:2889`), promoted to an explicit step input |
| One zone | Only one zone is active: the nearest eligible ring containing the player, ties broken by id |
| Mobile | Releasing the joystick inside a ring is the whole interaction. There are no new controls |
| Enemies | Never interact with objectives |
| Order within a tick | 1. input and movement; 2. mission step (reads the previous tick's hit); 3. grants, gate changes and local navgrid patch; 4. boss starts; 5. director; 6. enemies; 7. combat (writes `lastPlayerHit`) |

**Durations and clips**

| Clip | Frames | Duration and use |
|---|---|---|
| Button | `interact-press` 12 | 30 ticks (quick); 90 for the Closing Bell |
| Lever | `interact-lever` 20 | 45 ticks (quick); 60 for the hoist lever. The heave frames land on the last 12 ticks so the gate opens on the heave |
| Crank or valve | `interact-crank` 20 | 90 ticks; 45 for the Foreman's pressure rigs. Whole turns are fitted to the hold time |
| Kneel | `interact-kneel` 20 | 90 for a cage or strongbox, 60 to pry a secret |
| Stand | no clip | Ranger Lookout, 60 ticks |

- Frames follow site progress, so stepping out and back in resumes cleanly.
- Props animate from the same progress: lever 12, valve wheel 16, crank 12, button 4, shackle post 8, gate 16, cell door 12.
- **Fallback until the interaction page loads:** today's grenade-reach pose.

### 3.3 Visual language and guidance (no minimap)

| Class | Ring and lantern | Glyph | Shape | Beam |
|---|---|---|---|---|
| Mechanism (switch, gate, item) | ivory `#fff4d6`, dark `#05070f` outline | cog, door arch, item icon | dashed ring with hazard chevrons | route gates and items only |
| Prisoner | Medic `#45ff8a` (HUD health); Quartermaster `#19f7ff` (HUD ammo); Pawnbroker Litecoin blue `#6f9bff`; OG Miner gold `#ffe84d` (HUD XP track, `styles.css:161`) | cross, bullets, Ł, pick | solid ring plus lantern | yes, in the lantern colour |
| Strongbox | `#6f9bff` | Ł in a hexagon | hexagonal ring | no |
| Station | reward colour, dimmed while re-arming | as the reward | ring with a restock arc | no |
| Boss trigger | dark band `#241a33` with bone-white spikes `#f2ead8`, **never red or pink** | crown | 8-spike ring, slow breathing scale | tall white beam |
| Secret | no marker before discovery | – | – | – |

**Colour and shape rules**

- **No objective colour reuses a telegraph colour.**
  - Boss trigger colours must be at least ΔE 25 (CIE76) from the telegraph colours `#ff496c`, `#fff06a` and `#83f28f`.
  - Ivory must be at least ΔE 25 from its district's accent and ground.
  - `mission-palette.mjs` plus a unit test enforces both.
- **Status lamps** carry both a shape and a colour:

  | Lamp | Meaning |
  |---|---|
  | red X | missing a requirement |
  | amber ! | ready |
  | green check | done |

- **Rings inside an active boss arena are hidden** for the whole fight, including the held prisoner's ring.
- **Breakables** share one material: pale boards, or cracked plaster over rock, with a bright chalk Ł and a debris fan. They show *that* something breaks, never *what* is behind it.
  - Breakables are the lowest-priority auto-aim target: within 200, in LOS, and only when no enemy can be targeted.
  - The knife hits them.
  - They are excluded from the nuke, world hazards and enemy attacks.

**Discovery**

- A node is discovered when its anchor enters the logical view (`directorViewBounds`, ±720 × ±450) of the simulated actor. The render camera and zoom are never used.
- The Relay uplink and the Ranger Lookout mark machines and prisoners within their radius as discovered. They never mark secrets.

**Guidance**

- **Tracker pill.**
  - It is one line in the cockpit dock, and it is hidden while a boss bar shows. Example: "Crank the rope-bridge winch · 42 m" plus an arrow (1 m = 40 units).
  - Compact landscape (height ≤ 520) shows only the glyph, arrow and distance.
  - There is a screen-edge chevron for the tracked node only.
- **What gets tracked**, in priority order, with hysteresis:
  1. an active channel;
  2. a ready boss trigger in the current district;
  3. the next step of the current district's chain, even if it is undiscovered ("Find the Lamp Oil");
  4. the nearest discovered prisoner or claimable station;
  5. the nearest discovered ready strongbox.

  Secrets are never tracked.
- **District arrival.** A one-line banner, for example "Rugpull Ravine · Prisoners 0/2 · Secret 0/1 · Boss opens at 2:00". The pause field map lists discovered nodes by state.
- **Teaching.** A one-line hint appears the first time per run that the hero is within 400 of each interaction kind.

**Accessibility**

- `setAccessibleCombatStatus` is called on every completion.
- `reduceMotion` makes beams, cable travel and seal breathing static.
- `reduceFlash` removes ring flashes.
- Glyph and shape always carry the meaning alongside colour.

**Performance caps:** at most 4 beams (3 on mobile), 6 rings and 3 animated prisoners on screen.

### 3.4 Objective inventory

| District | Gates and sections | Machines | Item | Secret | Prisoners | Power-up sources | Havens | Boss |
|---|---|---|---|---|---|---|---|---|
| Relay | barn doors → barn yard | farmstead generator (`relay-power`); Relay uplink | – | S1 Root Cellar | P1 | – | – | – |
| Ravine | rope bridge (route); Diggings claim gate (B1 reward) | rope-bridge winch (`ravine-winch`) | Winch Handle | S2 Surveyor's Ledge | P2, H1 (Baron) | Cliff Dwellings strongbox | – | B1 |
| Crossing | mill storeroom; Lock Gate walkway (B2 reward) | mill sluice valve (`crossing-pump`) | – | S3 Behind the Falls | P3 | – | Liquidity Haven (ammo) | B2 |
| Hashwood | log chute (route) | log-pile lever; Beacon brazier; Ranger Lookout; Sanctuary lantern crank (`hashwood-shrine`) | Lamp Oil | S4 Deadfall / Hollow Grove | P4 | hollow-stump strongbox | Litecoin Sanctuary (heal) + Scrypt Cache (grenade) | – (reserve) |
| Mining | Hoist Vault (B3 reward) | steam valve (`mining-valve`) | – | S5 Collapsed Adit | P5, H2 (Foreman) | Liquidation Trap (Double Damage) | Hoist Vault haven (ammo, after B3) | B3 |
| Yard | warehouse gate; bascule to the port | warehouse lever (`yard-warehouse`); bascule lever | – | Dark Pool | P6 | – | – | B4 |
| **Total** | **9** | **11** | **2** | **6** | **8** | **3** | **3 + 1** | **4 (5 triggers)** |

**Placement rules (each is a test)**
1. Operate-spot clearance and dry ring disks.
2. Ring centres at least 300 apart, and at least a hazard's radius + 100 from any hazard.
3. Prisoners in the same district at least 900 apart.
4. Each switch within 900 of what it moves, or cabled to it.
5. Every section is sealed on the navgrid while its gate is closed (reusing `hmh-objective-rewards.test.mjs:72-150`).
6. Every chain can be solved from all 5 entries.
7. No authored spawn inside a sealed section or a boss arena.
8. Every entry at least arena radius + 300 from every arena.
9. Every entry has a ready, unguarded node within 1,400 path units.
10. Each route gate saves at least 600 path units, or is cut. Boss-reward gates are exempt, but the Lock Gate is still measured.

### 3.5 Prisoners

All prisoners are human "debtors" held by the Liquidation Authority. None may resemble a hero: no long teal hair or coat, no blue sphere head, no red neckerchief with a black mullet, no blonde hair with a red headband.

| Kind | Reward (applied on the rescue tick, when it can be used) | Unused remainder | Top-plane cue |
|---|---|---|---|
| **Field Medic** | A 50-HP pool; heals up to your missing HP | Waits in the open cage as a station and dispenses the rest when you are hurt | white head bandage; big shoulder satchel with a green cross |
| **Quartermaster** | (a) refill every owned weapon (`refillWeaponLoadout`); (b) +3 grenades via `rechargeHandGrenades`, clamped to the grenade maximum | Each part is handed over when there is room, and he leaves once both are | stocky; crossed bandoliers; ammo crate on the back; olive cap |
| **Pawnbroker** | Two different timed power-ups at once, 900 ticks each (today: Berserk and Dilation). An active effect is refreshed to max(remaining, 900), never stacked | none | thin; long pinstripe waistcoat; loupe goggles on the brow; strings of relic trinkets |
| **OG Miner** | Exactly one level: `300 × current level` XP through a new `grantRunLevelSpan` that **bypasses `xpMultiplier`**; no score. If rank capacity is full, the level arrives without a card (today's rule) | none | elderly prospector; silver beard; wide slouch hat (no helmet, no lamp); gold pan and pick on the back |

**Deal**
- 8 slots sorted by id.
- Types: [medic×2, quartermaster×2, pawnbroker×2, ogminer×2], Fisher-Yates shuffled with `seededUnit(seed, 'prisoner:' + i)`.
- A repair pass ensures no district holds two of the same type. Only the Ravine and Mining have two slots.
- Tested over 10,000 seeds. The verifier recomputes the deal from the session seed.

**Slots**

| Slot | Location |
|---|---|
| P1 | Relay barn yard |
| P2 | Ravine surveyor camp |
| P3 | Crossing boathouse |
| P4 | Hashwood logging camp |
| P5 | Mining bench |
| P6 | Yard warehouse compound |
| H1 | Baron's Diggings, freed on the Baron's defeat |
| H2 | Hoist Vault, freed on the Foreman's defeat |

**Cages** (one style per district; all face south; the lock plate is on the east or west side)

| District | Cage | Open state |
|---|---|---|
| Relay | wooden farm stocks with a padlocked hasp | top beam swings up |
| Ravine | iron gibbet cage on the ground, chained to a post | door drops, chain goes slack |
| Crossing | shipping-crate cell with a barred window | door swings |
| Hashwood | log-and-rope cage lashed to a stump | ropes fall away |
| Mining | shackled to a steel standpipe | shackles fall |
| Yard | chain-link pen with red seal tape | tape tears, gate swings |

**Prisoner actor.** Projection only: no body, cannot be targeted, cannot die.
- South-facing, 192 px.
- Clips: captive 8 (a waving variant within 500), waiting 6 and rescue 12 (stands, salutes, hands over a bundle).
- It then fades out over 60 ticks. There is no flee path and no companions.
- It animates only within 900 units.

**Guard crews** (field prisoners only)
- **Trigger:** the first tick the player comes within 1,200 of the cage, and only once tick ≥ 3,600, so early rescues are always safe.
- **Size:** 2 in the build band, 3 in the pressure band, 4 in the elite band and later.
- **Roles:** from the district's flavour weights.
- **Spawn points:** 3–5 authored within 300 of the cage, off-view and at least 560 from the hero.
- **Ids:** `crew:${slotId}:${k}`.
- **Capacity:** crews draw from the capacity bank and the band caps. A rejected crew is queued and retried every 30 ticks, and the director yields with the reason `crew-queued` meanwhile.

### 3.6 Secrets and key items

| Secret | SDK id | Entry | Contents |
|---|---|---|---|
| S1 Root Cellar | `farmstead-hidden-supplies` | hatch (350, 1,920) | heal 30 + Speed Boost |
| S2 Surveyor's Ledge | `ravine-surveyor-cache` | rockfall (2,175, 3,250) | ammo cache, lore; a Revenant ambush from the pressure band |
| S3 Behind the Falls | new (schema 7) | rock curtain (4,975, 340) | power-up cache |
| S4 Hollow Grove | new | deadfall (6,750, 3,900) | grenade cache; 2–3 dormant Revenants |
| S5 Collapsed Adit | new | boards (8,550, 1,220) | ammo cache; a Revenant ambush |
| Dark Pool | `warehouse-logbook` | cracked container wall (10,975, 750) | the secret Liquidator arena, plus its own secret reward if the Liquidator was already beaten at the plaza |

**Key items**

| Item | Location | Used at |
|---|---|---|
| Winch Handle | (2,350, 2,900) | rope-bridge winch |
| Lamp Oil | (6,450, 1,350) | Beacon brazier |

Both are picked up and used automatically.

**Milestones.** Uncatalogued secrets and machines emit no milestone until schema 7: `main.mjs:3452,3469` guards `recordRunMilestone` to catalogued ids.

### 3.7 Rewards, XP and sustain budgets

**Node XP** is `round(k × span(level at completion))`, where `span(L) = 300 × L`. It is multiplied by `xpMultiplier`, as kill XP is.

| Node | k | Count | Level-spans |
|---|---|---|---|
| Switch | 0.06 | 11 | 0.66 |
| Gate opened (non-boss) | 0.10 | 6 | 0.60 |
| Item | 0.04 | 2 | 0.08 |
| Secret | 0.20 | 6 | 1.20 |
| **Nodes total** | | | **2.54** |
| OG Miner (unmultiplied) | 1.0 | 2 | 2.0 |

- Boss kill XP stays on today's formula: 80 + 20 × threat, so 560/720/880/1,040.
- **Level bounties are dropped:** boss perks carry the reward, and it means fewer verifier terms.
- **Budget gate:** a completionist soak at 20:00 must end within **+15% XP** of the same seed with no objectives.

**Sustain and power against 1.8.1**

| Resource | Change |
|---|---|
| One-time heals | Site heals removed (−60). Two Medic pools added (+100). Grove Blessing +20 max HP. Liquidator Vault full heal (late). Net **+40 HP plus +20 max HP**, and a late full heal |
| Re-arming heals | Sanctuary 30 per 7,200 (unchanged) |
| Re-arming power-ups | 3 sources (2 strongboxes + the trap) at 600 ticks per 10,800 (unchanged) |
| One-time power-ups | 2 Pawnbrokers → +1,800 ticks of ×2-damage uptime |
| Ammo and grenades | + Hoist Vault haven (after B3), 2 Quartermasters, Keyring (grenade cap +2) |
| Permanent power | Overtime +12% damage (B3). Golden Parachute revive (Dark Pool only; decision 5) |

**Gate:** soaks stay within +10% of 1.8.1 on heal per minute and on ×2-damage uptime. Overtime and the revive are measured in the progression harness.

**Delivery.** There are no dynamic pickups.
- The mission module grants heal, heal pools, ammo, grenades, timed effects, level spans, max HP and silver directly.
- Weapons behind gates stay objective-reward collectibles. The cap of 8 is unchanged: 7 rows are in use after Quarry Salvage is removed.
- Silver goes through `grantRunSilver(n)` and never uses the 64 coin slots. **Silver grants from secrets (20 each) and boss bursts (15/20/20/25) wait for the parent packet.**
- The pause copy that says silver gives "no score" is corrected to match the code, which grants 10 score per coin.
- A weapon cache selects the weapon only when it is newly owned (`main.mjs:3655`).

### 3.8 Weapon sources (exactly one each)

| Weapon | Source |
|---|---|
| Pistol (Coin Blaster) | start; relay-armory refills ammo |
| Shotgun | Silver Reserve, Relay barn yard |
| Machine Gun | mining-control-room POI |
| Railgun | crossing-bank-cache POI (the Quarry Salvage row is removed) |
| Grenade Launcher | yard-extraction-console POI ("Repo Office") |
| Flamethrower | Warehouse Reserve, Yard compound |
| Arc Rifle | Liquidator Vault |
| War Fork | seeded Forked Standard event (unchanged) |

### 3.9 Simulation and verifier contract

- **`src/mission-objectives.mjs`** (pure) exports:
  - `MISSION_OBJECTIVES`, frozen and sorted by id;
  - `createMissionState(seed)`;
  - `stepMissionObjectives(state, {tick, player, move, lastPlayerHitTick, queryGround, lineClear, capacity, logicalView})`, which returns events;
  - `missionActiveBlockers`;
  - `missionPresentation`.
- **Effects:** `open-gate`, `close-gate`, `toggle-hazard`, `start-boss`, `rearm`, and `grant{heal | heal-pool | ammo | grenades | timed | xp-span | level-span | max-hp | silver | item | weapon-unlock}`.
- **Loading.** Both `mission-objectives.mjs` and `boss-slots.mjs` load through an **awaited dynamic import during run setup** (precedent `main.mjs:1209, 1264`). They absorb:
  - `world-design-interactions.mjs`;
  - `world-design-secrets.mjs`;
  - the site parts of `objective-rewards.mjs`;
  - `liquidator-boss.mjs`.
- **Level-up determinism.** A forced level-up (OG Miner) opens its offer inside the tick that earned it. This is the same fix as progression 8.4 and is done once, in S0.2.
- **Reset.** `createMissionState` is rebuilt on restart. Every gate whose state changed, opened or closed, is re-patched locally (this extends `main.mjs:2956`). Authored initial states are part of the base navgrid build.
- **Summary and verifier.** These rows are part of the parent packet (9.4):
  - `objectives {objectiveIndex, tick, levelAtCompletion}`;
  - `prisoners {slotIndex, tick}` (the verifier derives the type);
  - `bosses {bossIndex, firstInitiatedTick, lastInitiatedTick, initiations, defeatedTick}`.
- **Implementation on the shipped map (S1.4):** `LEVEL-1-BUILD-LEDGER.md`, "Mission core v2 (slice 4)".

---

## 4. Bosses

### 4.1 Shared boss rules

**Availability and triggers**
- A boss is dormant from tick 0. **There are no timers, no boss hunts the player, and only one boss is active at a time.**
- Each boss triggers once per run, and only after its `readyTick`.
- Trigger verbs, all different: enter (Baron), crank (Lockkeeper), lever (Foreman), button or secret enter (Liquidator).

**HP**
- `HP = round(targetSeconds × referenceDps(level at trigger))`, frozen at trigger.
- Target seconds: Baron 90, Lockkeeper 105, Foreman 120, Liquidator 150.
- **Placeholder** `referenceDps(L) = min(47, 8 + 2.6 × (L − 1))`. It is calibrated by the S0.3 progression harness against the benchmark's 6.4–46.9 sustained DPS. For comparison, today's 12,000 HP is a fight of more than 4 minutes even at 46.9 DPS.
- **Calibrated (S0.3, build ledger slice 2).** The 1.8.1 medians are convex, so no capped line fits them. `referenceDps(L)` is now a per-level table (levels 1–32: 6.7 at level 1, 11.1 at 10, 27.2 at 20, 79.6 at 32, held after 32) in `apps/hmh-reboot/src/boss-reference-dps.mjs`, from `docs/testing/hmh-progression-baseline-1.8.1.json`.

**Lifecycle**
1. **Readiness.** Before `readyTick` the trigger shows a red lamp and "Opens at M:SS".
2. **Trigger → intro.** The intro lasts 120–150 ticks, during which the boss is untargetable and does not attack.
3. **Lock.** Each lock capsule, inflated by 24, closes only when its footprint is clear of every body. This is re-checked every intro tick. Any ordinary enemy still overlapping at intro end is pushed outside with swept collision, or recycled if that fails. The navigation patch handles closing as well as opening, with tests.
4. **Director.**
   - `worldRecovery = true` suppresses spawns.
   - Off-view ordinary enemies outside the arena are recycled without credit at lock.
   - Enemies inside the arena count as adds.
   - The boss summons only up to **4 adds**. The active boss reserves its own add bodies and threat, independent of band caps, and `ENEMY_CAPACITY` (192) is still enforced.
   - Spawning resumes through the existing 480-tick recovery after release.
5. **Leash.** Attacks resolve only while the hero is inside the sealed arena (radius + 120 for the open front door). Today a player 6,000 units away takes 184 damage.
6. **Retreat** (decision 4).
   - After 600 engaged ticks, a retreat ring (channel 120) appears at the gate. Completing it reopens the gate.
   - The boss withdraws with its HP restored and becomes ready again after 1,800 ticks. There is no reward and no penalty beyond the time spent.
7. **Defeat.** Gates open, the rewards apply, and the arena becomes a landmark.
8. **Never initiated, never seen.**

**Readability**
- **Hit tests include the player's radius of 24** (today boss tests treat the player as a point).
- Danger areas are filled in fiat red with a phase-coloured edge; safe zones are crypto green. Today only safe circles are drawn (`liquidator-telegraph-renderer.mjs:57-63`).
- **Walk-escape budget:** every tell satisfies `tellTicks ≥ ceil((escape distance + 24) / 4) + 12`. Mobile players have no manual dodge, so walking out must always work.
- **Auto-dodge is fed boss geometry.** Today it sees only `grayboxEnemies` (`automatic-actions.mjs:18`; `main.mjs:3290-3293`).
- At most 4 live telegraph groups.
- **Phases are set by HP thresholds.** Each threshold starts a 90-tick invulnerable halt that clears pending telegraphs, clamps damage that overshoots the threshold, and waits for the current strike to resolve.
- A stall guard loops the final set after the listed engaged ticks.

**Determinism**
- Pure modules with `create`, `step`, `resolve` and `applyDamage`, and an events-per-tick cap.
- Every choice uses `fnv(runSeed, bossId, phaseId, actionOrdinal)`.
- Add ids are `boss:<id>:w<n>:<k>`.
- **No hostile-projectile system and no RNG stream.**
- Bosses move with swept collision against their own arena blockers, never the map navgrid, whose 18-unit clearance is wrong for bodies of r44–56.

**Audio and HUD**
- Tells and phase changes are silent. Hits and deaths use the enemy hit and death sounds, blasts use the grenade sound, and loot uses the Litecoin and pickup sounds.
- `hud.setBoss(name, …)` takes a name (today the name is hard-coded at `index.html:131-133`) and per-boss phase markers and pips.

**Art**
- A new full rig per boss, never the shared bagholder base.
- Rendered on the **hero camera** (35° below the horizon) with the shared light rig.
- 256 px desktop source, 128 px mobile.
- Budget: a full phase-1 clip set, reduced re-baked subsets for phases 2 and 3, and south-only intro, transition and death clips. About 1,100–1,200 frames per boss, needing a roster-schema extension (`enemy-roster-atlas.mjs:103-118` demands full 6-state × 8-direction coverage).
- **Only one boss atlas is resident.** It preloads when the trigger is ready and the hero is within 1,500 of the arena, and it is released after defeat. This is a new unload path.

### 4.2 Roster

| Boss | District | Human or zombie | Grayscale read | Telegraph family | Trigger | Ready | Threat and XP | Adds | Perk and world change | Evolution |
|---|---|---|---|---|---|---|---|---|---|---|
| **Rug Pull Baron** | Ravine | human | a disc on a diagonal bar | floor drift, two-beat lobs, coin gamble | Welcome Mat (enter + 30) | 2:00 (7,200) | 24 → 560 | bagholders | **Baron's Signet**: silver pickup radius 62 → 150, coin life 1,800 → 3,600 (`silver-drops.mjs:1-30`); Diggings; rockfall slows | Genesis Seal |
| **The Lockkeeper** | Crossing | human | a barrel with an L | countdown rings, tide bands, chain rings, rotating bar | Lock Windlass (crank 90) | 5:00 (18,000) | 32 → 720 | forkrunners | **Lockkeeper's Keyring**: grenade cap +2 and a refill; Lock Gate walkway; no forkrunner bias | Genesis Seal |
| **The 51% Foreman** | Mining | zombie | a lamp dot over an upright tank | lamp-cone charges, half-plane, steam lanes, vent ring | hoist lever (60) | 7:30 (27,000) | 40 → 880 | validator congregation | **Overtime**: +12% outgoing damage (`main.mjs:4377-4380` run effects); Hoist Vault; vents stop cycling | Genesis Seal |
| **The Liquidator** | Yard | human | a tall T with a hammer | lanes, LED panel grid, safe-circle supers | Closing Bell (button 90), or Dark Pool (enter) | 10:00 (36,000) | 48 → 1,040 | agents + 1 bomber | **Liquidator Vault** (Arc Rifle, full heal, grenades to max); Yard pacified with an 1,800-tick grace; Golden Parachute via the Dark Pool | Genesis Seal |

**Lore links.** Each signature enemy serves its district's boss:
- the Rug Pullers are the Baron's crew;
- the Tollkeepers man the bridges for the Lockkeeper;
- the Revenants are the Foreman's dead shift;
- the Money Printers are the Liquidator's clerks.

**Reserved looks** that ordinary enemies must not reuse:
- a gambler hat with a rug;
- a hard hat with a headlamp, back tank and drill gauntlet;
- a peaked cap with an L-key and padlocks;
- a crown with a gavel and pinstripe coat.

**Overlap audit against the core six.**
- Only the Foreman charges.
- The Liquidator has no rifle; the Agent keeps it.
- No boss has a hoodie, gold plates, canisters, a blast hood or a violet hood with a staff.
- Each boss draws adds from a different faction.

### 4.3 B4 The Liquidator (reworked). Build priority 1; also builds the shared boss kit.

**Identity.** Human; head of the Liquidation Authority, the living faction of Agents, Whales and Bombers.
- He gets **his own human rig**. Today's native atlas is built on the bagholder zombie body.
- The "executive exosuit" wording (`ENEMY-PRODUCTION-ART.md:35`) is dropped: his armour is a plate under a tailored coat, with no shoulder cannons and no powered frame.

**Look**
- About 2.4 m, about 90–95 world px (about 1.8× an ordinary enemy).
- **Top-plane read, "a tall T with a hammer":** very broad squared shoulders under gold epaulette plates; a gold spiked "market crown" whose band is a thin red LED ticker (a bright ring from above); a brass-and-steel sledgehammer gavel on one shoulder. The gavel separates him from the rifle-carrying Agent.
- **Costume:** knee-length charcoal pinstripe double-breasted greatcoat with a blood-red lining (no cape); black waistcoat; pale shirt collar and silver hair, which lift his top plane over the asphalt (V .46) and the road (V .27); long blood-red tie with a gold bar; gunmetal plate under the coat; black gloves; polished boots.
- **Face:** slicked silver hair, square jaw, grey stubble, gold-rimmed tinted glasses.
- **Palette:** charcoal, black, gunmetal and brushed gold, with fiat accents only (no Litecoin blue or crypto cyan).
- **Phase dressing** (accessory swaps on one rig):

  | Phase | Accent | Change |
  |---|---|---|
  | Market Open | `#ff496c` | coat on, red ticker |
  | Margin Call | `#ffc857` | coat off, shirt-sleeves and waistcoat, gold margin spikes on the epaulettes |
  | Total Liquidation | `#e26dff` | tie torn loose, crown cracked, violet halo of burning ticker tape |

- **Arena kit** (Blender): LED floor panels, kiosks, podiums, bell pedestal, freight lift, roll-down shutters, Dark Pool set.

**Where**
- **Front door, the Margin Floor.** The sealed floor is 1,040 × 540 in the Liquidation Plaza (2.6, D6), with 4 podium marks and 4–6 kiosks as combat cover. Three shutters close the W, N and S mouths. The bell alcove is at (11,700, 2,400). The Liquidator rides the tower's freight lift (11,420, 1,765) down.
- **Secret, the Dark Pool.** A walled warehouse at z0 (11,000–11,800 × 350–1,150) in the Container Port. Breaking the cracked container wall at (10,975, 750) and crossing 48 units past the threshold starts the fight. The door seals silently.
- **Fallback on the shipped map (slice S1.5 only).**
  - The anchor (11,000, 2,400) is tightened from r620 to x 10,475–11,525, y 2,130–2,670.
  - The bell goes at the far edge from the street mouths.
  - The Dark Pool becomes a z0 walled court behind a cracked container in the east back alley (about 11,820, 2,300).
  - The `yard` entry (10,400, 2,450) moves at least 920 from the anchor, for example to (10,250, 1,600).
  - **Built (S1.5, build ledger slice 5).** The floor is x 10,475–11,525, y 2,170–2,630 (460 tall, so the Candle Chart's three rows fit the walk budget), the bell is at (11,380, 2,400), the Dark Pool is a walled court x 11,592–11,976, y 1,916–2,684 entered from the north through a cracked container, and the `yard` entry is (10,060, 2,505) (on the main route, 946 from the anchor).

**Triggers**
- **A: the Closing Bell.**
  - A brass trading bell on a pedestal inside the seal ring, under a red neon ticker.
  - A 90-tick hold with drain, playing the hero's button-press clip (a slap on the plunger).
  - On completion the bell swings, the shutters drop and the ticker boards turn red. He rides the lift down in a 150-tick intro.
- **B: the Dark Pool.**
  - There is no intro. He is found turned away at a ledger table with his chest plates unbolted.
  - **Insider Trading:** he takes ×1.25 damage for 300 ticks, shown by the open plates and a gold glow.
- **One instance per run.** The first trigger to fire owns the fight, and the other shows a "SETTLED" shutter. If he was beaten at the plaza, the Dark Pool keeps only its secret reward.

**Purpose.** While he lives:
- the liquidation grid pulses every 240 ticks;
- Yard spawns lean toward Agents;
- his Vault stays sealed.

He is also the hook for the Level 2 extraction. If he is ignored, he never hunts, the Yard stays the hottest district, and the vault stays locked.

**Reward**
1. A Genesis Seal.
2. The Liquidator Vault, through the existing `liquidator-defeated` unlock (`main.mjs:4592`): the Arc Rifle cache, a full heal, and grenades to max.
3. 1,040 XP.
4. The Yard is pacified: the grid is off, the Agent weighting resets, and the director gets an **1,800-tick grace period**.
5. Dark Pool only: **Golden Parachute**, a one-time revive at 50% HP shown as a gold HUD pip (decision 5).
6. After the packet is approved: a burst of 25 silver.

**Phases.** HP 66% and 33%, matching the HUD markers (`styles.css:414-421`). There is a 90-tick "Trading Halt" at each threshold. Stall guard: after 5,400 engaged ticks, the existing endless 1,440-tick cycle (`liquidator-boss.mjs:72-81`) takes over.

| Phase | Kit |
|---|---|
| 1 Market Open (100–66%) | Crash Lane (single), Gavel Stamp, Debt Collection, Candle Chart (single sweep); he walks between podiums |
| 2 Margin Call (66–33%) | Opens with the Circuit Breaker super (repeats about every 1,500 ticks). Coat off. Dash added. Crash Lane becomes a V of 2. Enforcement Order brings 2 agents |
| 3 Total Liquidation (33–0%) | Opens with the Total Liquidation super (every 1,200), followed by a 120-tick kneel at ×1.25 damage taken. Chart sweeps out and back. Crash Lane fires 3. Gavel Stamp lays 3. He steers at 120 between tells. Adds: an agent plus a gas bomber |

**Attacks**

| Attack | Tell | Damage | Geometry | Counter |
|---|---|---|---|---|
| Crash Lane | 45 | 14 | Shockwave along a locked lane, width 54, to the arena edge. Kiosks block it (height-aware LOS). Phase 2: ±12° V of 2; phase 3: 3 lanes | side-step, or put a kiosk in the way |
| Gavel Stamp | 60 | 18 | "SOLD" seal, circle r112 on the locked target. Phase 3: 3 circles along your movement line, 20 ticks apart | walk out; cut across the line |
| Debt Collection | 44 | 12 + shove | Ground-pound, circle r104 around him. Only within 200. 45-tick recovery | back out, then punish |
| Margin Call Dash (phase 2+) | 36 | 16 | Gold lane, width 76. A real dash at 14 units per tick, up to 600, with swept collision. Hitting a kiosk or wall staggers him for 60 ticks at ×1.25 | side-step with a kiosk behind you |
| **Candle Chart** (signature) | 96 | 16 | The floor is 5 × 3 LED panels of about 208 × 150 (Dark Pool: 4 × 3 of 190 × 150). Each column is 2 red rows and 1 green row. Safe row = `fnv(runSeed,'liq-chart',ordinal,column) % 3`, changing by at most 1 row between neighbouring columns. Columns fire in sweep order, 18 ticks apart. Phase 3 sweeps out and back | stand in your column's green candle, or walk the green path |
| Enforcement Order | 45 | – | Margin seals flash at 2–3 floor-edge sites, then troops walk in. At most 4 alive | kill the adds; the Arc Rifle chains through them |
| Circuit Breaker (super) | 130 | 24 | The floor fills red except two green circles r76 at ±150 from him, first east-west, then north-south | stand in green |
| Total Liquidation (super) | 150 | 30 | Three green circles r68, then his 120-tick kneel | stand in green, then punish |

**Weak points.** The existing role checks stay (`liquidator-boss.mjs:288-312`): Railgun from 480 or more, Arc Rifle chaining through 2 or more adds, a flame zone overlapping him, War Fork within 120. The combined role × punish multiplier is **capped inside `applyLiquidatorDamage`**. Today `main.mjs:4433` bypasses the 1.15 bound.

**Retired from today's kit:** `short-squeeze-burst` (it duplicated the Foreman's Blow-Off) and the static margin-call-dash line.

**Body**
- Collision r56, hurt r48, z 4–96.
- Armour 1.0 and knockback resistance 0.92 move from `main.mjs:4392-4398` into boss state.
- He pushes the player using the declared but unread `playerSeparationRadius` 84 and `maxPressureStep` 4 (`liquidator-boss.mjs:145`), resolved with swept collision.

**AI**
- **States:** dormant → armed (preload) → intro → combat → halt → dying.
- **Attack choice.** A table by phase and distance, with a per-attack cooldown and no back-to-back repeats:
  - under 200: Debt Collection;
  - mid range: Crash Lane, Stamp or Chart;
  - over 520: Dash from phase 2, otherwise Crash Lane.
- **Movement.**
  - After every third attack he walks at 90 to the podium mark farthest from the player (ties by mark id), which breaks rail LOS.
  - In phase 2 the Dash may replace the walk.
  - In phase 3 he steers toward the player at 120 between tells.
- **Nuke fix.** The nuke must not reach the Dark Pool wall (today `hurtTargets` spans the map, `main.mjs:3548-3585, 3668-3686`).

**Animations**
- **Intro:** a lift ride down, stepping off, shouldering the gavel (south only, about 36 frames).
- **Dark Pool, single facing:** seated counting ledgers; startle-and-grab.
- **8 directions:** idle (gavel on shoulder, glance at the crown ticker) and walk (a measured executive stride).
- **Attacks:** Crash Lane (overhead tell, two-hand slam); Stamp (point, stamp); Debt Collection (wind-up, ground-pound); Dash (low crouch, loop, skid); dash stagger; Candle Chart (slam with an arm sweep); Enforcement Order (finger snap, arm sweep; no voice); super channel (gavel skyward); punish kneel (loosening his tie).
- **Hit flinch:** front and back.
- **South only:** the two phase transitions (tearing off the coat; ripping the tie as the crown cracks) and death (the crown rolls away and silver Litecoin spills).

### 4.4 B1 The Rug Pull Baron. Build priority 2.

**Identity.** Human. A living carnival con man and land baron who sold frontier settlers worthless claims. "Rug pull" is his costume and his signature move, never a creature. His adds are zombie bagholders, the people he ruined. He is the first boss most runs meet, and his fight teaches the boss language: read the floor, find the anchor, step back into the circle.

**Look**
- About 2.1 m, pear-shaped on thin legs, about 85 world px.
- **Top-plane read, "a disc on a diagonal bar":** an enormous wide-brim black gambler's hat whose brim is wider than his shoulders; a tightly rolled oxblood-and-gold Persian carpet with gold tassels strapped diagonally across his back like a bedroll.
- **Costume:** magenta-and-gold brocade waistcoat over a stained cream shirt; a gold-coin watch-chain; a short black cutaway jacket cut at the hips; black-and-grey striped trousers; dirty white spats.
- **Face:** waxed handlebar moustache, one gold tooth, a sly grin.
- **Palette:** dust brown, black and cream. **Nothing glows.** The accent is non-emissive oxblood and gold, which frees `#ff3df2` for the Bloater.
- **Phase changes:** phase 2, the brim is dented and the rug is gone from his back because it lies on the floor; phase 3, the jacket is torn and the brim ripped.
- **Props:** a burlap money sack tied with gold cord, and a large gold gambler's coin used as a VFX sprite. The arena carpet is a ground decal plus strip meshes.

**Where.** The Quarry Bowl, (3,250, 950) r420, a dead end under the z24 bench. It has two mouths, both locked during the fight: the Quarry Road lock at y 1,370–1,420, and the rope bridge's east end.
- On the z0 floor: a crimson-and-gold carpet of about 720 × 440 with a stone margin about 100 wide around it.
- Four brass anchor pegs at the carpet corners.
- 2–3 crates or boulders (combat cover) **standing on the carpet**.
- His striped carnival tent at the back, under the bench.
- Pennants show above the rim from the Dry Wash and the canyon trail, and a trail of silver glints leads to the mouth.

**Trigger: the Welcome Mat.** A gold-fringed mat in front of the tent (3,100, 640), at least 500 from both mouths.
- Stand on it for 30 ticks to fill the confirm ring. Stepping off cancels it.
- Two boulders roll across the mouths. The carpet's centre medallion lifts like a trapdoor and he climbs out, tipping his hat, in a 120-tick intro.

**Purpose.** While he lives:
- his rigged charges keep the ravine rockfall on a 240-tick period instead of 300;
- his claim gate seals Baron's Diggings, which holds prisoner H1.

The relay keepers' notes name him.

**Reward**
- a Genesis Seal;
- **Baron's Signet** (silver magnet), which makes silver matter and plays the Litecoin pickup sound far more often;
- the Diggings: the H1 prisoner, a cache, and the haul-pass shortcut to the Crossing;
- the rockfall returns to normal;
- 560 XP;
- after the packet is approved, a 15-silver shower.

If ignored, he stays under his rug and the pennants keep waving.

**Phases.** HP 60% and 25%. Stall guard: after 4,800 engaged ticks he loops Hard Rug.

| Phase | Kit |
|---|---|
| 1 The Pitch (100–60%) | Rug Yank every third action; Pump and Dump; Exit Scam only as a close-range escape. **Transition:** he rolls up the west third of the carpet. That stone is safe from yanks but is where most sacks land |
| 2 The Pull (60–25%) | Yank every second action; Double or Nothing; Exit Scam also repositions every fourth action; Exit Liquidity adds (2 bagholders per wave). **Transition:** he tears the carpet into three strips |
| 3 Hard Rug (25–0%) | The three strips yank independently in alternating directions, like conveyor belts. The torn gaps are bare stone and always safe. Pump and Dump throws two sacks |

**Attacks**

| Attack | Tell | Effect | Counter |
|---|---|---|---|
| **Rug Yank** (signature) | 72 | He crouches and grips one fringe edge; it ripples and 3 rows of chevrons stream in the pull direction. Everything on the carpet (player, adds, loose crates) slides 200 units that way over 16 ticks. This is a time-boxed drift field through `worldHazardField` (`world-hazards.mjs:34-48`), folded into the swept player move, so it never pushes anyone into water or off a ledge. Only slamming into a wall or boulder hurts: 10 "rug burn". Adds on the carpet are knocked down for 60 ticks. **The trap:** the crates that block his lobs stand on the carpet | step onto the stone margin, or into one of the four brass anchor-peg rings (r50, lit green) |
| Pump and Dump | 54 | He lobs a money sack on a 40-tick arc; its shadow grows on your locked spot. **Pump:** r100, 14 damage. 36 ticks later the **Dump:** three coin circles r70 in a triangle 150 out, 10 each | leave the first circle, then step back into its centre |
| Double or Nothing (phase 2+) | 18 + yank | He flips a giant coin; its face is `fnv(runSeed,'baron-coin',ordinal) & 1`. **Red** means two yanks 40 ticks apart, the second reversed. **Green** means he fumbles and staggers for 60 ticks at ×1.15. The reveal comes inside the yank's 72-tick tell | read the flash |
| Exit Scam | 42 | He tips his hat. Confetti smoke r90 deals 10. He vanishes for up to 60 ticks and reappears at 1 of 4 authored marks (fnv hash). A gold top-hat ring glows at the destination 45 ticks before he lands. His arrival is a 45-tick stagger at ×1.15 | walk out of the smoke, then wait at the ring |
| Exit Liquidity (adds) | – | 2 bagholder-rushers crawl from under the carpet edge per wave, at most 4 alive. The next yank knocks them down | turn his trick on his victims |

**Deliberately absent:** rifle lanes (the Agent's), a melee rush (the Bagholder's), a dash or charge (the Liquidator's and the Foreman's).

**Body.** Collision r44, hurt r40, z 4–90; armour 1.0; speed 100.

**AI**
- He struts at 100 between 8 carpet-edge marks, keeping 300–500 from the player, and never closes to melee.
- Exit Scam pre-empts whenever the player is within 160.
- Yank direction: the side whose pull carries the player toward the nearest wall or crate.
- Drift entries are per attack and time-boxed; adds and crates use the same field.
- **The sealed arena needs an exemption from the rule against spawning on camera.**
- **Small sim addition:** a 60-tick knock-down stagger that resets `attackPhase` and locks movement. Ordinary enemies have no stagger today; the shared poise system (5.2) provides it.

**Animations**
- Intro: out of the trapdoor with a hat tip (south, about 30 frames).
- 8 directions: idle (thumbs in lapels, twirling the chain) and strut walk.
- Attacks: yank tell and heave; sack lob; coin flip, catch and fumble; Exit Scam smoke; reappear flourish; summon stamp.
- Hit flinch: front and back.
- South only: the two transitions (rolling up a third; tearing into strips) and death (the hat flies off and he ends up wrapped in his carpet).

### 4.5 B3 The 51% Foreman. Build priority 3.

**Identity.** Zombie: an undead human mine foreman who never clocked out, with a readable human face. His adds are the validator congregation, who "confirm" his majority. The 51% attack (majority hashrate) becomes a floor rule and a set of valve rigs, never a creature. The name echoes the legacy "51% Boss".

**Look**
- About 2.6 m, the largest actor in Level 1, about 100 world px.
- **Top-plane read, "a bright lamp dot over an upright tank":** a dented yellow hard hat with one oversized round brass headlamp, whose ground cone is his aiming tell; goggles pushed up on the brim; one tall riveted brass pressure tank strapped upright on his back, with a gauge.
- **Body:** pallid grey-green skin cracked by thin ore-amber mineral veins, which glow while he holds the rig majority and while the 51% Attack charges; clouded eyes; slack jaw; thick grey moustache.
- **Costume:** a rubber hose runs over his right shoulder to a pneumatic rock-drill gauntlet on the right forearm. His hand grips the inner handle; it is rigidly skinned to one forearm, so no two-hand IK is needed. Torn soot-black overalls with one strap, a scarred rubber apron, steel-toe boots, and a ring of brass shaft keys (the Hoist Key).
- **Accent:** ore-amber `#f0ae4c` on the lamp and veins. In phase 3 the lamp burns red `#ff476f`.
- **Phase changes:** phase 2, the gauge glows and steam leaks; phase 3, the tank is ruptured and peeled open with a permanent plume, and the hat is cracked.
- **Blender kit:** headframe legs and cage, pressure rigs with pipe runs, ore carts and bins.

**Where.** The Headframe Pit, (9,200, 800) r400 at z0, with one mouth: the Hoist Road, locked at y 1,150–1,200.
- Four steel headframe legs stand around the blocked cage shaft at about (9,200 ± 130, 720 ± 90). They are capsules r28 with maxZ 160 and act as permanent charge-stoppers.
- Four pressure rigs sit on the rim at about NW (8,880, 520), NE (9,520, 520), SW (8,880, 1,080) and SE (9,520, 1,080).
- Ore carts lock the mouth.
- From the bench above, the player can see him waiting in the cage with his headlamp sweeping.

**Trigger: Call the Cage.** The winch-house hoist lever stands at the north rim (9,200, 520), 655 from the mouth.
- A 60-tick hold with drain plays the lever-pull clip.
- The shift bell swings, carts roll across the mouth, the headframe wheel spins, the cage rises and he shoulders the gate open. The intro lasts 150 ticks.

**Purpose.** While he lives:
- the highway steam vent at (9,600, 2,480) cycles by itself over the main route;
- the director brings Gas Bombers to Mining from the build band;
- his belt holds the Hoist Key.

**Reward**
- a Genesis Seal;
- **Overtime** (+12% damage from every source, with a HUD badge);
- the **Hoist Vault**: prisoner H2, a one-time full ammo refill for every owned weapon plus grenades to max, and then a **re-arming ammo haven** (every 7,200);
- the vent stops cycling, though the player-operated steam trap stays;
- 880 XP;
- after the packet is approved, a 20-silver burst.

If ignored, he never leaves the cage.

**Pressure rigs (the core rule)**
- Four valve wheels are lit **red** (his) or **green** (yours), with 4 pips on the boss bar. All four start red.
- Stand in a rig's ring (r60) for 45 ticks and the hero plays the crank clip. The rig turns green and vents a steam lane (width 90) across the floor for 150 ticks: 8 damage every 30 ticks to anyone inside, including you and the adds. A rig re-arms 600 ticks after its lane closes.
- **Scalded:** if his body overlaps an active lane (usually because you baited a charge through it), he kneels venting for 180 ticks, with armour 0.8 and ×1.25 damage taken for 300 ticks. Steam can never kill him (`withholdLethalHazardHits`, `main.mjs:3605-3609`).

**Phases.** HP 65% and 30%. Stall guard: after 5,400 engaged ticks he loops Majority Rule.

| Phase | Kit |
|---|---|
| 1 Day Shift (100–65%) | Drill Charge (single), Drill Flurry, Blow-Off, Valve Seize (every 600); first cultist at 85%. **Transition:** tanks over-pressurise and he takes a power stance; the 51% Attack unlocks |
| 2 Hashrate Surge (65–30%) | 51% Attack about every 1,200; charges chain ×2; Valve Seize every 450; 2 more cultists at 50%. **Transition:** the tank ruptures; armour drops permanently to 1.0 and speed rises from 110 to 140 |
| 3 Majority Rule (30–0%) | Double 51% (two perpendicular cracks, the second resolving 60 ticks after the first, leaving one safe quadrant); charges chain ×3; Seize every 360 |

**Attacks**

| Attack | Tell | Damage | Geometry | Counter |
|---|---|---|---|---|
| Drill Charge | 48 (32 per re-aim) | 22, knockback 40 | The headlamp cone snaps red; a lane 100 wide is painted to the wall; he charges at 12 units per tick for up to 720 with swept collision. **Into a leg: JAMMED for 120 ticks at ×1.25.** Open floor: 30-tick skid. The lamp blinks the chain length first | side-step (about 19 ticks); stand in front of a leg or behind a steam lane |
| Drill Flurry (within 160) | 36/34/34 | 10 each | three cones of 50° × 130, each re-locked | step out sideways or get behind him |
| Blow-Off | 45 | 12 + shove | ring 90–210 around him | hug him inside 90 or stand past 210 |
| **51% Attack** (super, phase 2+) | 60 plant + 150 | 24 | He plants at the pit centre and a crack splits the floor. The half he stands in, pushed 2% past the line, fills and erupts. The crack angle cycles 0, 60, 120° by cast ordinal. **Consensus:** it fires only if he holds 3 or more rigs. If you hold 2 or more, it fizzles ("consensus failed") and he staggers for 120 ticks at ×1.2 | take the rigs, or stand in the far half |
| Valve Seize | 60 (rig lamp flickers) | – | He lumbers to your nearest green rig and slams it red | stand in that ring to deny it; he answers with a charge |
| Congregation (adds) | 45 (cage lamp) | – | validator cultists: 1 at 85%, 2 at 50%, at most 2 alive. Their support pulse (armour ×1.15 for 180) is extended to target him (`enemy-combat.mjs:91-116`), shown by a violet ring | kill the cultists first |

**Body**
- Collision r56, hurt r52, z 4–120.
- Armour 1.35 (0.8 while scalded, 1.0 from phase 3).
- Speed 110 (140 in phase 3).
- As a kind `boss` body he pushes the player (`movement.mjs:160-194`) with swept collision rather than the raw pressure delta (`main.mjs:3322`).

**AI**
- He steers straight at the player with a turn limit of about 6° per tick, so a strafing player can out-turn him.
- Attack choice when the previous attack ends: distance ≤ 160 → Flurry; ≥ 280 → Charge; in between → Blow-Off or a charge by the phase table. Seize and the 51% run on their own cadences and pre-empt the table.
- Rigs are four small state records `{owner, ventUntilTick, rearmTick}`.
- The scald check is a per-tick overlap between his capsule and each active lane.
- Consensus is a rig count read on the resolve tick.
- The support-target filter must allow a boss as a target.

**Animations**
- Intro: shoulders the cage gate open, cracks his neck, lamp flickers on (south, about 30 frames).
- 8 directions: idle (breathing, drill idling, lamp sweeping) and lumbering walk.
- Charge: tell, loop, re-aim pivot, jammed (wrenching at a leg), skid.
- Other attacks: flurry, blow-off, valve seize, 51% plant loop, eruption (a silent roar), consensus-fail stagger, scalded kneel, summon (yanks the cage cord).
- Hit flinch: front and back.
- South only: both transitions and death (the drill seizes, his keys spill, the lamp goes dark).

### 4.6 B2 The Lockkeeper. Build priority 4 (depends on the river layout).

**Identity.** Human: a living, weathered, bearded canal lockkeeper.
- He chained the lock and leased the toll to the Liquidation Authority, whose Tollkeepers man the bridges. His own lock crew are forkrunner raiders.
- The Litecoin flavour is native: hashed timelock contracts power Lightning, and Litecoin ran early atomic swaps. These become his tools (padlock countdown charges, a chain-link swap, a windlass key), never a creature.
- He is the showcase for the bridge overhaul.

**Look**
- About 2.3 m, barrel-chested on short thick legs, about 88 world px.
- **Top-plane read, "a barrel with an L":** a brass-rimmed black peaked lockkeeper's cap, and a giant cast-iron L-shaped windlass key over one shoulder, as tall as he is.
- **Costume:** a black oilskin coat with the sleeves rolled over a cream cable-knit sweater; black chest waders; rubber boots; work gloves; a coil of chain at the hip; a leather bandolier of six brass padlocks, each with a small signal lamp that lights as a countdown pip.
- **Face:** bushy grey beard, wind-reddened skin.
- **Accent:** `#ff476f` on the padlock lamps. The countdown pips on the danger rings use **white-hot centres in a dark bezel**, so they read against the red fill. He carries no orange, so he never reads as the Gas Bomber; the arena's orange buoys are world props.
- **Phase changes:** phase 2, soaked to the chest with the cap pushed back; phase 3, coat torn open, padlocks mostly spent, lamps blazing.
- **Props:** the L-key and a fist-sized brass padlock charge.

**Where.** The Toll Lock on Fork Island, (4,850, 3,450) at z0.
- The combat floor is about 800 × 520 (y 3,180–3,700), with the toll house (his hut) to the north.
- Before the fight the island has **one mouth, the Fork Trestle** (locked during the fight). The east channel's steel lock gate is chained.
- **Two sluice levers** sit at the north bank of the split pool, about (4,650, 2,960) and (5,050, 2,960).
- Six mooring bollards give cover, and orange buoys mark the tide lanes.

**Trigger: the Lock Windlass.** A spoked capstan at the east lock head (5,180, 3,560), 790 from the trestle mouth.
- A 90-tick crank channel. As it fills, the lock chains strain and the gates creak.
- The chains snap taut, his hut door bursts open, he stomps onto the deck and the trestle gate swings shut. The intro lasts 120 ticks.

**Purpose.**
- He keeps the lock chained, so the Proof-of-Work bridge is the only crossing south of the mill. Every north-east spawn funnels into one lane there, which is at its worst on mobile.
- His forkrunner crew raids the Crossing.

**Reward**
- a Genesis Seal;
- **Keyring** (grenade cap +2 plus a full refill: raises `maxHandCharges` at `grenades.mjs:103` and clamps Cold Storage gains to the new cap, `main.mjs:4870`);
- the **Lock Gate walkway** opens for good, a new bridge style and a second way round the choke;
- the Crossing loses its forkrunner bias;
- 720 XP;
- after the packet is approved, 20 silver.

If ignored, he stays in his hut.

**Phases.** HP 65% and 30%. Stall guard: after 5,000 engaged ticks he loops Spillway.

| Phase | Kit |
|---|---|
| 1 Lock Open (100–65%) | Hashed Timelock (3 charges), Windlass Sweep, Tide Release with 3 gaps. **Transition:** he chains the gates; water spills into a shallow margin 100 wide along the banks (×0.7), shrinking the dry floor |
| 2 Lock Flood (65–30%) | Atomic Swap (at most once per 900); Lock Crew; tides with 2 gaps. **Transition:** he kicks open the downstream sluices |
| 3 Spillway (30–0%) | Tides alternate from north and south; Timelock becomes a pentagon cage; he swaps every other cycle |

**Attacks**

| Attack | Tell | Damage | Geometry | Counter |
|---|---|---|---|---|
| Hashed Timelock | 40-tick lob | 16 + knockback | 3 brass charges: on your locked spot and 160 to each side. Each sits in a red countdown ring r110 with 1, 2 or 3 pips and detonates 120/150/180 ticks after landing. **Charges are shootable (40 HP)**: "revealing the preimage" detonates one early, and a blast that catches him deals 150 and staggers him for 45 (environment damage stays non-lethal to bosses). **Phase 3 pentagon:** 5 charges ring you at r150 and pop in pip order from tick 120, 20 ticks apart; a sixth in the centre blows 60 ticks after the first gap opens | clear the rings in pip order; shoot the charges near him |
| Tide Release (every third action) | 60 (he hauls a sluice lever, back to you; rear hits ×1.15) | 10 + 160 downstream push + ×0.6 slow for 30 ticks | A water band 140 deep sweeps across at 8 units per tick. Gaps sit at buoy lanes chosen by fnv from authored lanes: 3 gaps in phase 1, **never fewer than 2**, so no point is more than about 225 from a gap. Applied through `worldHazardField` drift and speed. The deck rail stops the push: no drowning | stand in a buoy lane; dash i-frames pass through |
| Windlass Sweep (within 200) | 48 | 14 + knockback | He plants the L-key as a capstan bar; a bar of r180 sweeps 360° over 40 ticks, direction shown by chevrons | step outside 180, or walk behind the bar |
| Atomic Swap (phase 2+) | 75 | – | Identical chain-link rings under him and under you, joined by a pulsing chain. On resolve, if LOS is clear and you are within 700, you **trade places**. He first drops a 48-tick timelock (r96) on his own spot | break LOS behind a bollard; stand in a gap too tight for his r48 ("failed settlement": he staggers for 45); desktop players can dash in the last 10 ticks |
| Lock Crew (adds, phase 2) | – | – | 2 forkrunners vault the deck walls, at most 3 alive | – |

**Body.** Collision r48, hurt r44, z 4–100; armour 1.1; speed 110.

**AI**
- He stomps between 6 bollard marks, keeping 200–450 from the player, and never enters water.
- Attack choice: within 200, Sweep; mid range, Timelock; every third action, Tide; Swap on its cooldown when the player is beyond 350 with LOS.
- At most 4 telegraph groups, plus up to 6 live charges.
- Charges are boss-owned grenade states (`createGrenadeState`, `ownerId 'boss-the-lockkeeper'`, custom `detonateTick` and `blastRadius`) that can be hit as hurt targets.
- Tides are pending band entries with increasing resolve ticks, locked at tell start.
- The Swap is a validated teleport: both actors must be in the arena, a swept fit check must pass for his radius, and LOS uses the height-aware trace.

**Animations**
- Intro: bursts from the hut and thumps the key down (south, about 30 frames).
- 8 directions: idle (leaning on the key, checking a padlock) and a heavy stomp.
- Attacks: timelock lob; sweep (plant, heave, recover); sluice haul (back to camera, looping); swap (chain taut, snap); failed-settlement and charge-blast staggers; summon (bangs the key on a bollard).
- Hit flinch: front and back.
- South only: both transitions and death (sinks to his knees, the key clangs down, padlocks spill).

### 4.7 Engineering path and parent coupling

1. **Boss registry.** The `liquidatorBoss` singleton (about 40 references in `main.mjs`) becomes `activeBoss` plus `BOSS_DEFINITIONS` in a lazily imported `boss-slots.mjs`. The references are at:
   - 3084-3091, 3272, 3368, 3510
   - 3574-3609
   - 4290-4339, 4392-4434, 4514-4606
   - 1855-1887, 2686, 2848-2866, 5085
2. **Triggers and locks.**
   - `world-design-triggers.mjs` provides three types: hold-zone with drain, enter-rect with a confirm ring, and destructible-broken plus enter. It hooks in beside `stepWorldDesignPacing` (`main.mjs:3484`).
   - Locks go through `refreshWorldDesignGateNavigation` (`world-design-interactions.mjs:67-81`).
   - New site kinds are added to the actions map (`world-design-life.mjs:91`).
3. **Geometry kit.** Filled danger, panel grid, half-plane, drift rect, rotating bar, countdown ring, chain link and charge lane, each with a matching auto-dodge shape.
4. **Rewards.**
   - Perks are delivered through `runEffects`.
   - Boss drops come from `src/boss-drops.mjs`. Genesis Seals never use objective-reward slots.
5. **HUD.** Name plus per-boss phase markers.
6. **Art preload and unload** as in 4.1.
7. **Parent coupling** (in the packet, 9.4):
   - three boss roles in `enemyRoles` (`sdk/hmh-run-summary-schema.mjs:2-10`; `recordRunKill` throws on an unknown role);
   - the hard-coded `boss-liquidator` id (`sdk/hmh-run-summary.mjs:122`, `stats.mjs:177`);
   - the verifier's `HMH_BOSS_START_TICK` and the 72,000 floor (`hmh-plausibility.mjs:71-74, 240`), and "at most one boss kill" (`:246-248`);
   - the regex parity tests (`tests/server-verify-hmh-plausibility.test.mjs:53-64`, `tests/hmh-reboot-liquidator-boss.test.mjs:409-438`).

   **The bridge `boss-defeated` event stays generic** (`{tick, sequence, eventType, value:1}`, `main.mjs:4531-4539`). Per-boss kills live in the summary rows. There is no `hmh-bridge/v1` change.
8. **Required gates.**
   - The same seed gives the same events.
   - Nothing fires before its trigger.
   - Locks and restart reset navigation.
   - Idle replay is unchanged.
   - Walk-budget tests for every tell.
   - Director and boss soaks (hash-equal across partitions).
   - `visual:reboot`.
   - An XS Max profile of each fight.

---

## 5. New enemies (owner asked for 4–6; this package designs 6)

### 5.1 Priority and roster

Priority is value against cost. **Ship 1–4 first; they need no hostile-projectile system.** The Printer carries the full cost of that system, because no boss shares it.

| # | Enemy | Home | Faction and form | Silhouette token | New verb | Player answer |
|---|---|---|---|---|---|---|
| 1 | **Rug Puller** | Ravine (the Baron's crew) | Raiders, human | yoke | PULL | step off the rug, or use the yank to clump the pack |
| 2 | **Pump-and-Dump Bloater** | Hashwood | Undead, zombie | gourd | DETONATE and DENY | choose where it dies |
| 3 | **Tollkeeper** | Crossing (the Lockkeeper's toll guards) | Authority, human | shield | GUARD | flank close, blast, burn, rail, or break the door |
| 4 | **HODL Revenant** | Mining (the Foreman's dead shift) | Undead, zombie | dumbbell | REFUSE TO DIE | finish it with the automatic knife, fire or a grenade |
| 5 | **Money Printer** | Yard (the Liquidator's clerks) | Authority, human | press | PATTERN | weave, use cover, jam the crank |
| 6 | **Oracle Marksman** | z24 terraces and bridge decks; Relay from the elite band | Raiders, human | needle | TRACK | keep moving, break LOS, clear the perch |

- **Balance:** factions split 2/2/2; four are human and two are zombies. None is an animal, vehicle, robot or mech.
- **Silhouettes:** all six tokens are distinct from the core six's wedge, diamond, square, hexagon, orb and star.
- **Telegraphs:** every telegraph is a ground shape or a pose change, never a sound, and each telegraph equals its hitbox.
- **Identity:** `identityForm` must match in `enemy-archetypes.mjs` and in the art receipt, so the whale and bomber mismatch is not repeated.
- **Tests:** the silhouette regex in `tests/hmh-reboot-enemy-archetypes.test.mjs:86` gains the six tokens.

### 5.2 Shared infrastructure (built once in S1.2; it also fixes core-six faults)

| Area | Change |
|---|---|
| a. Behaviour flags | Data-driven flags replace the role and id checks at `enemy-simulation.mjs:289/304/315/329`: `flankLane`, `cover`, `holdsChokepoint`, `waddle`, `stalk`, `perch`, `escort`. Plus `maxAlive` and `maxConcurrentTells` per archetype |
| b. Poise and interrupt on `attackPhase` | Damage accumulated during a tell cancels it and staggers. This makes the core-six counterplay text true |
| c. LOS gate | A height-aware LOS gate before every ranged or trapper tell (`enemy-combat.mjs:185-190`) |
| d. Navgrid clearance | Per-radius clearance layers at 28, 30 and 36 |
| e. Player forced motion | A forced-motion helper with swept collision and traversal rules. Enemy pressure and dash deltas also become swept |
| f. New geometries | `rug-lane`, `cone`, `offset-circle`, `tracking-lane` and `volley`, each in `createAttackGeometry` and `resolveEnemyAttackAgainstPlayer` (`enemy-combat.mjs:43-58, 229-240`). Each gets telegraph drawing (`main.mjs:1787-1821`) and an auto-dodge shape (`automatic-actions.mjs:25-29`). The auto-dodge lane width becomes a parameter (it is fixed at 18 today) |
| g. Director | Keyed role weights. Six new roles: `trapper`, `burster`, `warden`, `revenant`, `artillery`, `marksman`. `RANGED_ROLES` gains trapper, artillery and marksman. Seeded shuffling of roles and spawn points |
| h. Atlas | Optional extra states beyond `REQUIRED_ENEMY_VISUAL_STATES`, and per-phase clip subsets (`enemy-archetypes.mjs:2`; `enemy-roster-atlas.mjs:28, 103-118`) |

**Blocking couplings for each enemy slice**
- The archetype test pins 6 ids.
- Runtime crash points: `previewSpawns` (`main.mjs:3012`), world-tour spawns (58-85), the `ENEMY_PRODUCTION_ART` vector fallback (`enemy-production-art.mjs:17-60, 203-235`), and the preload schedule (`main.mjs:4997-5009`).
- Soak hash equality.
- `syntax-check` registration.
- JS byte caps.
- **Parent:** each role is appended to `enemyRoles`. Kills stay one per body.

### 5.3 Rug Puller (priority 1)

**Identity.** A living frontier con man who sold "guaranteed" quarry claims by laying out a fine carpet, drawing a crowd and pulling the rug. The rug is a prop and the attack is a con; he has no undead or creature traits. Role `trapper` (area token family, shared with the Gas Bomber, so lobs and rugs never stack). He is the only one of the new enemies who can displace the player.

**Look**
- Wiry, about 1.75 m, about 52 world px at runtimeScale 0.55.
- **Token `yoke`:** a heavy rolled carpet across the back of both shoulders, sticking out about 0.6 body-widths past each. From the 35° camera it is the only horizontal "T" in the roster. Second cue: a flat newsboy cap.
- **Face:** slicked dark hair, pencil moustache, one gold tooth, an ingratiating grin.
- **Outfit:** a cropped dusty-brown suede jacket that ends at the waist (never Lilly's long coat); loud paisley waistcoat; bootlace tie; sleeve garters; rope belt with brass carabiners; leather gloves with small hook tips; sun-faded canvas trousers; cracked boots.
- **Value:** base of dust, tan and soot. The cap and the cream in the rolled rug give a light top plane that separates him from red rock (V .56) and road (V .27).
- **Accent:** saffron `#ffb000` on the rug border and tassels (under 8%), over a deep crimson-and-cream pattern. **The cast rug is itself the telegraph.**

**Stats.** r19; speed 170; HP 80 (ramp); armour 1.0; knockback resistance 0.8; preferred distance 320; costs body 1 / threat 4 / ranged 1 / effect 2; curb 10, drop 32, ascent 48, water ×0.8; XP 160; maxAlive 3.

**Rug Pull** (`rug-lane`, an oriented rectangle)
1. **Validate at tell tick 0.** Needs an area token, the player within 440, clear height-aware LOS, his 240-tick cooldown elapsed, and no other armed rug within 600 of the player.
   - The direction is locked toward the player's tick-0 position, with no lead.
   - The rug starts 40 in front of him, runs 440 long, half-width 44.
   - It is **clipped at the first height-aware blocker or height-layer change**, so it never lies over a ramp, ledge lip or bridge rail.
   - If the clipped length is under 200, no tell starts.
2. **Unroll**, ticks 0–17. The decal unrolls at exactly the hitbox size.
3. **Grip**, ticks 18–53. He crouches with hooked fists on the hem; the hem ripples and the border pulses.
4. **Yank**, a 6-tick strike.
   - A player overlapping the rug (44 + 24) takes 8 damage and is pulled up to 200 over 12 ticks, stopping 90 short of him. The pull uses the shared forced-motion helper, so it stops at walls, and the player can still aim and fire.
   - A dash breaks the pull; dash i-frames avoid it entirely.
   - Ordinary enemies on the rug are pulled 140 through the swept enemy-knockback path (`main.mjs:4559-4574`), taking no damage.
5. **Recovery**, 70 ticks, movement-locked while he re-rolls: the punish window.

**Interrupt.** 20 or more damage during the grip (25% of full HP) makes him drop the rug and stagger for 40 ticks.

**AI**
- **Spacing:** flank lanes at 280–380; backs off under 250 (ranged backoff with its blocked probe, `enemy-simulation.mjs:329-367`).
- **Pack manager:** he prefers to cast when 2 or more allies are within 160 of him or inside the would-be rug. Candidates are ranked by allies covered, then by id. If no pack forms, he waits at most 120 ticks and then casts anyway.
- **Side preference:** `stableSign(id)`.
- **Readability cap:** at most one armed rug within 600 of the player. A second tell is refused, not queued.
- **Implementation:** integer timers; the rug axis is a locked unit vector, so every test is a dot product with no per-tick trig.

**Counterplay**
- Step off the rug: 68 lateral units, about 17 ticks, and the rug is fully visible 36 ticks before the yank.
- Put a wall between you; the rug stops there.
- Burst him during the grip.
- Dash through the yank.
- Punish the re-roll.
- Line the rug with enemies and grenade the clump.

**Animations** (about 55 frames per direction)

| Clip | Frames and rate | Description |
|---|---|---|
| idle | 6 @6 | weight shift, taps the rolled rug, grins |
| run | 12 @22 | quick jog, the rug see-sawing |
| strafe | 8 @20 | crab-step with the rug held level |
| tell-unroll | 6 @20 | casts the rug; the prop hides on release and the decal takes over |
| tell-grip | 4 @12 loop | crouched at the hem, shoulders coiled back |
| attack-yank | 6 @30 | explosive two-handed backward heave, leaning about 30° |
| drop-rug | 4 @24 | interrupt reaction, hands flying off the tassels |
| recover-reroll | 8 @12 | kneels, rolls the rug and hoists it back (the punish window) |
| hit | 3 @36 | head snap, cap knocked askew |
| death | 8 @12 | the half-unrolled rug flops over him like a shroud |

- VFX: an 8-frame unroll strip tiled along the clipped lane, a 4-frame hem ripple and a yank dust puff.
- The rug is a rigid prop bone plus a ground decal, with no cloth simulation.

**Where and when**
- **Build band (9,000+):** Ravine canyon lane, Dry Wash and Spire Flats. Weight 2, against the rusher's 11.
- **Pressure band (18,000+):** the Crossing's bridge approaches, on the ground before the Proof-of-Work ramps and never on them; also Hashwood, Mining and the Yard.
- **Elite band (36,000+):** Relay too, which breaks relay camping (`encounter-director.mjs:51-58`).
- **Triggered encounters:** he leads guard-crew waves, pulling players off pads into Bloater pools or a Tollkeeper choke.

**State:** `rugCooldownUntilTick`, `rugPhase`, `rugAxis`, `rugLength`, `gripDamageAccumulator`. **Elite option:** grip 24 ticks, rug length 520.

### 5.4 Pump-and-Dump Bloater (priority 2)

**Identity.** An undead bagholder who pumped and never dumped: pallid, bruised grey-green skin, slack jaw, cloudy eyes, torn civilian clothes, bloated by rot. Human anatomy throughout, with no tentacles, extra limbs or mutant mouths. The bomb is his own belly. Role `burster` (melee token family). Its threat comes after death, which makes kill order and kill position a choice.

**Look**
- **Token `gourd`:** about 1.7 m tall but r30, the widest body in the roster, about 48 × 60 world px.
- An enormous round belly carried **in front** makes up about 60% of the silhouette. By contrast, the Gas Bomber's orb is a backpack, and the Bagholder is a lean wedge.
- A small head sunk into fat shoulders; short, thick arms.
- **Top plane:** a crust of glowing boils across the back and shoulders.
- **Outfit:** a torn, too-small grey T-shirt with a faded rising-candlestick print; straining suspenders; a torn knit beanie; a broken gold chain; burst house slippers.
- **Value:** the belly top is lifted so it reads on forest floor (V .30) and wet bank (V .31).
- **Accent:** fiat magenta `#ff3df2` (under 8%), glowing through the belly skin and the boils. It brightens in the tell and the death swell, and the sludge pools share it.

**Stats.** r30; speed 96; HP 150 (ramp); armour 1.0; knockback resistance 1.5; preferred distance 40; costs body 1 / threat 4 / ranged 0 / effect 4; curb 8, drop 16, ascent 48, water ×0.7; XP 160; maxAlive 3, rising to 4 from the elite band.

**Pump** (existing melee circle, r88). Tell 36 (belly inflates, arms spread), strike 14 damage with knockback 36, recovery 44.

**Dump** (new `onDeath` archetype data)
- **At 0 HP:** it leaves AI and attack processing, drops out of `hurtTargets` and becomes `targetable = false` (`aim.mjs:48`).
- **Fuse, 45 ticks:** the exact r140 blast outline appears at once and fills as the fuse burns.
- **Burst against the player:** 20 damage if the player's centre is inside the ring, within ±16 height, with height-aware LOS from the belly at z+24 (walls shield). Dash i-frames apply.
- **Burst against enemies:** 60 damage and 40 outward knockback to ordinary enemies under the same rules.
- **Bosses:** it can never deal the last point of boss damage (`withholdLethalHazardHits`).
- **Kill credit:** burst hits carry the weaponId of whatever killed the Bloater, and chains inherit it (`recordRunKill` accepts any catalogued weapon, `sdk/hmh-run-summary.mjs:274`). If the Bloater died to a world hazard, its burst kills use `WORLD_ENVIRONMENT_WEAPON_IDS` with no XP (`main.mjs:4583`).
- **Chain:** an explosive kill (grenade, launcher, fuel drum, or another burst) skips the fuse and bursts that tick. Chain depth is capped at 4 per tick.
- **Pool:** reuses the `area-slow` world-hazard rule: r120, 420 ticks, ×0.6 speed, no damage, height-banded. It applies to the player **and** to enemies (`main.mjs:3357, 3542`). At most 3 live pools; the oldest expires first.
- **Audio:** the existing grenade-explosion class.

**AI**
- A plain flow-field chaser.
- `behaviour.waddle` limits its turn to 4° per tick. This is the first turn rate in the sim (velocity snaps today, `enemy-simulation.mjs:375-377`), so it reads as heavy and can be circled.
- **Herd rule:** while any other enemy is within 160 of the player, it slows to 76, so it arrives behind the pack.
- A larger separation weight makes it a moving roadblock.
- It stops to Pump only within 88 + 24 of the player, so it never plugs a bridge.
- r30 clearance layer. When stuck it does a single replan instead of jittering.
- In the endurance band it is inserted in pairs 120 apart, so chain pops happen.

**Counterplay**
- Kill it at range.
- Kill it inside a crowd, or grenade it to place the burst exactly.
- Step out of the ring during the fuse: about 22 ticks from contact, and a dash also works. The always-on knife can kill it point-blank and leave you inside the ring.
- Lure pursuers through the pool.

**Animations** (about 49 frames per direction; the atlas `death` state is fuse-swell plus burst)

| Clip | Frames and rate | Description |
|---|---|---|
| idle | 4 @6 | belly heaving, head lolling, boils pulsing |
| waddle | 12 @20 | wide side-to-side waddle; the belly lags |
| tell-inflate | 6 @12 | belly swells, arms spread, glow ramps |
| attack-slam | 6 @30 | belly flops forward, ground thump |
| recover | 4 @10 | heaves itself upright |
| hit | 4 @36 | full-body jiggle |
| fuse-swell | 10 @15 | on its knees, belly at 1.3×, skin splitting and glowing |
| burst | 4 @30 | ruptures; a deflated husk decal fades over 300 ticks |

VFX: the filling fuse ring, a burst splash, and a 6-frame bubbling pool on one shared texture.

**Where and when**
- **Build band (12,000+):** Hashwood (dark floor, plus the spore bed as a second slow) and the Crossing's West Marsh. Weight 2.
- **Pressure band:** all six districts, including Relay.
- **Endurance band:** spawned in pairs.
- **Triggered encounters:** filler in pad and crew waves, and placed near fuel-drum rows for chain set-pieces.

**State.** Burst and pool state lives in an id-sorted list keyed `dump:${enemyId}`.

### 5.5 Tollkeeper (priority 3)

**Identity.** Human, Liquidation Authority. When the reservoir burst, the only dry way east was the Proof-of-Work bridge. The Authority posted tollkeepers there with vault doors salvaged from the flooded Crossing bank, and they collect for the Lockkeeper.
- He has a visible, jowly face, and the door is carried in his hand. No exosuit or power armour.
- Role `warden` (melee family). His threat depends on the player's **angle**, not distance.

**Look**
- **Token `shield`:** broad, about 1.85 m, r28, about 55 world px.
- **The vault door:** a round door about 1 m across on the left forearm, leading his body. From above it reads as a bright disc before a dark mass, a "D". Its face is lifted to light steel (V about 0.55). It has a spoked brass wheel, rim bolts, and a combination dial with a small white strobe lamp; black-and-white hazard chevrons on the rim show which way he is guarding.
- **The barrier arm:** a sawn-off toll boom about 1.3 m long in black-and-white stripes, with a red reflector disc at the tip, used as a club. Raised overhead, it is the tallest line in his silhouette.
- **Head:** a peaked toll-collector cap with a white strobe beacon; jowly, stubbled face, grey moustache, a scar through one eyebrow.
- **Outfit:** a long, water-stained navy greatcoat with brass buttons (navy, to separate him from the Agent's black suit), a riveted steel gorget, leather gauntlets, a coin pouch and key ring, heavy boots.
- **Accent:** strobe white `#f4f7ff` on the beacon and dial lamp only.
- He is distinct from the Whale, which has gold plates and no disc.
- **Broken phase:** the door is gone, and he reads as a plain club brute.
- A projection-only 110° ground arc in front of him confirms the guard, because the 8-direction sprite can be up to 22.5° off.

**Stats.** r28; speed 100, or 145 broken; HP 180 (ramp); armour 1.15; knockback resistance 2.2 inside the guard, 1.0 broken; preferred distance 70; costs body 1 / threat 6 / ranged 0 / effect 2; curb 8, drop 16, ascent 48, water ×0.6; XP 200; maxAlive 2, rising to 3 from the elite band.

**Vault Guard** (a new branch in `resolveCombatHits`, `combat-events.mjs:102-199`)
- `guardFacing` is a unit vector separate from his heading. It turns toward the player at no more than 1.6° per tick (96° per second) through a fixed precomputed rotation step. A player running at 240 units per second can circle behind him only inside about 140 units.
- **Direct hits within ±55° of his facing** (dot product ≥ 0.574) deal 0 health damage and 0 knockback. This covers projectiles, lanes, the knife and fork sweeps. Instead they drain a **door pool of 120** (on the HP ramp). A blocked projectile stops at the door, so allies behind him are shielded.
- **Bypasses:** explosions (grenade, launcher, nuke, fuel drum, Bloater), flame and burn ticks, Arc Rifle chain jumps.
- **Hash-rail** rounds deal 50% to his health and full damage to the pool.
- **A War Fork thrust breaks the guard for 60 ticks.**
- The guard is off during his slam recovery.
- Hits carry a direction and a damage kind (direct, splash, burn, chain, pierce).

**Door break.** When the pool reaches 0, he is staggered and movement-locked for 60 ticks, then enters the Broken phase.

**Body-block.** He uses the non-yielding branch of `resolveEnemyPressure` (`movement.mjs:160-194`, boss-only today), so the player cannot shove through him. On the 220-wide Proof-of-Work deck, he and an escort genuinely hold the lane.

**Boom Gate Slam** (`cone`; deliberately not the whale's lane)
- r118, 40° half-angle, facing locked at tell start.
- Tell 36: the door is planted and the barrier arm hauled high.
- Strike: 20 damage, knockback 40.
- Recovery 44, with the door lowered, so he takes full damage from the front.
- Broken phase: tell 24, half-angle 50°, turn rate 3° per tick.

**AI**
- He advances steadily along the flow field; he never strafes or retreats.
- **Chokepoints:** `behaviour.holdsChokepoint` (shared with the Whale; it replaces the whale-only id check at `enemy-simulation.mjs:304`). When the player is 220–600 away and `chokepointDirectionAt` (`enemy-navgrid.mjs:593-658`) finds a cell, he walks there and **holds** at velocity 0, facing the player. On the bridges this makes a literal toll gate, and the one-front rule means you meet it from one side only.
- **Escort anchor:** Agents, Printers and Marksmen within 260 take a slot 70 behind him, opposite his facing. The side comes from `stableSign(id)`, and slots are chosen by distance, then id. The Agent's lane still fires from its own position, so flanking him exposes his gunmen.
- **Phalanx** (elite band): two Tollkeepers within 140 stand shoulder to shoulder.
- **Post flag:** at an authored anchor with a 400 leash, guarding a gate mouth, a cage or an arena approach.
- **Broken:** a straight chaser.

**Counterplay**
- Circle behind him at close range.
- Grenade, launcher or burn him.
- Rail through the door.
- Shoot the door down; its cracks show the pool.
- Bait the slam and punish the 44-tick open front.
- Flank the pair to reach the gunmen.
- Or leave him: he is slow.

**Animations** (about 56 frames per direction shielded, plus about 28 in the Broken subset)

| Clip | Frames and rate | Description |
|---|---|---|
| idle | 6 @6 | braced, peering over the rim, beacon flickering |
| walk-advance | 12 @18 | shield-forward march |
| turn-shuffle | 6 @12 | planted pivot when facing lags by more than 20°, which makes the flank window visible |
| block-impact | 3 @36 | overlay; the door jolts and sparks |
| tell-slam | 6 @12 | door planted, barrier arm hauled high |
| attack-slam | 6 @30 | the arm crashes down like a closing toll gate |
| recover-open | 6 @10 | door sags wide, chest exposed |
| guard-break | 5 @18 | door knocked aside by a War Fork thrust |
| shield-break | 6 @18 | door wrenched away; he staggers |
| broken-run | 10 @22 | two-handed charge with the arm |
| broken tell and attack | 4 + 6 | faster overhead slam |
| hit | 3 @36 | flinch from a side or rear hit |
| death | 8 @12 | falls forward onto the door, or face-down when broken; the cap rolls away |

A fallen door lingers as projection-only debris for 300 ticks, with no collision.

**Where and when**
- **Pressure band:** the Crossing's Proof-of-Work deck (4,500–5,000 × 2,290–2,510) and Old Mill deck (4,500–5,000 × 845–1,105).
- **Elite band:** Yard alleys and the container-wall openings, and Mining yard fences.
- **Never** in Hashwood or Relay.
- **Triggered, any band:** gate and cage posts. The Yard's "bank run" set-piece is a Tollkeeper plus two Printers.

**State.** Shielded → Broken, using per-phase clip subsets. **Elite option:** turn rate 2.2° per tick, door pool +40.

### 5.6 HODL Revenant (priority 4)

**Identity.** An undead miner who held through the mine collapse, with "diamond hands" made literal: raw diamond-ore chunks lashed over his fists with wire and chain. The ore is improvised gear, not crystal growing from the body. Role `revenant` (melee family). His first lethal hit drops him into a downed state that bullets pass over.

**Look**
- **Token `dumbbell`:** gaunt, about 1.85 m, r24, about 54 world px.
- Two massive, pale, cloudy ore clusters over the fists, each as big as his head and carried low. They read as two very bright blobs either side of a dark body and are the brightest pixels in the roster.
- **Second cues:** a dented brass miner's helmet with a cracked lamp, and rusty padlocked chains across the shoulders.
- **Outfit:** a torn grey wool mining coat, an iron strongbox chained to the belt, shin wraps, cracked boots.
- **Skin and eyes:** pallid grey-green skin, faintly glowing sunken eyes.
- **Accent:** ruby `#e0115f` in the ore cores. It surges during the tell and pulses as a countdown while he is downed.
- **Downed read:** kneeling with both fists punched into the ground, inside a shrinking ruby ring.

**Stats.** r24; speed 130; HP 130 (ramp); armour 1.1; knockback resistance 1.2; preferred distance 60; costs body 1 / threat 5 / ranged 0 / effect 2; curb 8, drop 20, ascent 48, water ×0.7; XP 180, awarded once, on the finish; maxAlive 4.

**Diamond Clap** (`offset-circle`): r80, centred 56 ahead along the direction locked at tell start. Tell 30 (fists overhead, cores flare), strike 22 damage with knockback 24, recovery 36. It lands in front of him, so a sidestep beats it.

**Refuse to Sell**
- His **first lethal hit is clamped to 1 HP inside `resolveCombatHits`**, using the same pattern as `withholdLethalHazardHits`. A `downed` event is emitted instead of a `scoreEvent`. This must happen inside resolution, because `main.mjs:4459-4466` deactivates any target at 0 HP.
- **Downed, 150 ticks:** movement-locked; removed from projectile `hurtTargets` (bullets, lanes and arcs pass over him); `targetable = false`.
- **Finishers:** the always-on Litecoin knife (58 range), the War Fork, explosions (grenade, launcher, nuke, fuel drum, Bloater), flame and burn. The finish records the single kill and its XP.
- **Not finished in time:** he rises with 60% HP, speed 156 and a 24-tick clap tell, and cannot go down again.

**AI**
- **Stalker:** he holds at about 140 until another enemy holds a melee token within 200 of the player (an id-ordered token scan), then commits as a second wave.
- **Downed:** inert. **Risen:** a plain chaser.
- **Validator synergy:** cultists prefer a Revenant, downed or risen, as their support target (a small id-ordered change to `supportTargetFor`).
- **Ambush disposition:**
  - Authored placements in secrets S2, S4 and S5 start half-buried, with disposition `ambient` (already filtered by auto-target at `main.mjs:3858`; nothing sets it today) and `targetable = false`.
  - They flip hostile when the player enters a 260 radius, play a 20-tick emerge, then run normal AI.
  - Deterministic ids. Awake ambushers count against the body cap and the capacity bank.

**Counterplay**
- Walk up to him: the automatic knife finishes him with no button, which fits the owner's contextual, automatic rule.
- Grenade a cluster, or pop a Bloater beside them.
- Burn them.
- Kill the cultist that buffs him first.
- Or ignore him and fight the faster risen version.
- Sidestep the forward clap.

**Animations** (about 56 frames per direction)

| Clip | Frames and rate | Description |
|---|---|---|
| idle | 4 @6 | hunched sway, fists near the ground |
| walk | 12 @18 | lurching, fists swinging like pendulums |
| tell | 6 @12 | fists raised high, cores surging |
| attack-clap | 6 @30 | fists smashed together downward in front |
| recover | 4 @10 | prises the fists out of the ground |
| downed-enter | 6 @18 | collapses and punches both fists into the ground |
| downed-loop | 4 @6 | kneeling, cores pulsing |
| rise | 8 @16 | tears the fists free, brighter |
| emerge | 6 @20 | claws up from the half-buried ambush pose |
| hit | 3 @36 | head snap, lamp flickers |
| death | 8 @12 | ore shatters, the strongbox lid springs open, he crumbles |

**Where and when**
- **Pressure band:** Mining (rail yard, floor yard, bench) and the Hashwood tree lines.
- **Elite band:** the Ravine and the Yard.
- **Never** in the opening or build bands.
- **Ambushes:** 2–3 in secrets, in any band.

**Optional** (needs owner and verifier approval): the strongbox spills 3 silver on the finish. **Default: no.**

### 5.7 Money Printer (priority 5)

**Identity.** Human, Liquidation Authority: a portly central-bank clerk wearing a hand-cranked printing press as a backpack ("money printer go brrr"). He is the fiat villain the crypto-versus-fiat palette implies, and the press is worn machinery. Role `artillery` (ranged family, sharing one gun budget with the Agent and the Marksman). He is **the first enemy with real travelling projectiles**: slow, visible fans and lines of burning cash bricks.

**Look**
- **Token `press`:** portly, about 1.75 m, r26, about 52 world px.
- **Top plane:** a squat, square cast-iron press on his back, as big as his torso; a large spoked crank wheel on its right; a paper ribbon arcing over his shoulder into a short brass chute on the left shoulder. It reads as a square with a wheel and a paper arc.
- **Head:** round wire spectacles, a black celluloid eyeshade, a flushed and tired face.
- **Outfit:** rolled dirty-white shirt sleeves with black garters (his light top plane), a grey waistcoat, an ink-stained apron stuffed with **grey** banknotes (never green, which belongs to the player and to crypto), black work boots.
- **Accent:** fresh-print yellow-white `#ffe23a` at the chute mouth and on the bricks. It ramps as he cranks.
- **Bricks:** small, spinning, rectangular bundles with a dark core and a yellow-white edge. They look nothing like round silver coin loot.

**Stats.** r26; speed 100; HP 120 (ramp); armour 1.05; knockback resistance 1.1; preferred distance 460; costs body 1 / threat 6 / ranged 1 / projectile 7 / effect 3; curb 8, drop 16, ascent 48, water ×0.65; XP 200; maxAlive 2, rising to 3 in the endurance band.

**Go Brrr**
- **Tell 40:** he cranks in big circles as the chute glow ramps. It needs clear height-aware LOS, and the aim is locked at tell start.
- **Volley patterns** cycle by a per-enemy `volleyOrdinal`:

  | Pattern | Shape |
  |---|---|
  | A "Fan" | 5 bricks, 15° apart |
  | B "Pump Line" | 3 bricks down one lane, 8 ticks apart |
  | C "Offset Fan" | A rotated by 7.5° |

- **Inflation:** each consecutive unjammed volley adds a brick to the fans, up to 7. A jam resets it to 5.
- **Quantitative Easing:** if the player is within 170 at tell start, he uses a 30-tick tell and fires a ring of 8 bricks at 45° steps.

**Bricks**
- Speed 5 units per tick, radius 10, lifetime 124 ticks (620 range), 8 damage, knockback 10.
- They test against the player's **projectile hurt radius** (about 17, `main.mjs:4204`), not the 24 body. At 300 units the clear gap in a fan is about 58; inside about 160 you must sidestep the whole fan.
- They are swept against height-aware blockers, and cannot hit across a height difference over 24.
- No homing. Ids are `volley:${enemyId}:${ordinal}:${k}`, processed in id order.
- Dash i-frames pass through them.

**Jam.** 30 or more damage during the crank cancels the tell: a 45-tick stun while paper spews, and inflation resets. Recovery is 60 ticks.

**Projectile cap.** **One simulation constant, 24 live hostile projectiles, on every device.** A volley that would exceed it is deferred whole, never trimmed. Mobile saves only in the renderer: one pooled sprite and no trail. This is the first code to read the band `projectileCap`.

**Auto-dodge** never dashes for bricks: weaving is the skill.

**Build.** A new pure `hostile-projectiles.mjs`:
- a fixed-size ring buffer with no per-tick allocation;
- collision through `resolveProjectilePath` against the blockers and one player hurt target;
- no RNG.

**AI**
- Ranged steering at 420–520 with cover, backoff and strafe flags.
- He prefers the escort slot 70 behind a Tollkeeper.
- He never starts a volley without LOS.
- He holds his tell while the projectile cap is full.
- He uses QE only as a panic answer inside 170.

**Counterplay**
- Thread the fan gaps at range, sidestep the fan up close, and never stop in a Pump Line.
- Put any fence, tree or wreck in the path.
- Burst the crank to jam the press.
- Close in: the QE ring is his only answer, and he is fragile.

**Animations** (about 53 frames per direction)

| Clip | Frames and rate | Description |
|---|---|---|
| idle | 4 @6 | adjusts his spectacles |
| walk | 12 @18 | bent under the press |
| tell-crank | 6 @15 loop | big circular crank, whole-body bob |
| attack-volley | 4 @30 | chute kick, rocks back |
| qe-burst | 6 @24 | braces and spins half around |
| jam-stun | 6 @12 | the press sputters and spews |
| recover | 4 @10 | wipes his brow, feeds paper |
| hit | 3 @36 | spectacles knocked askew |
| death | 8 @12 | topples backward; the press cracks and notes spill (debris) |

VFX: a 4-frame pooled brick sprite, an ember trail (desktop only), a chute puff and a paper spew. The crank wheel is a separate bone-driven part.

**Where and when**
- **Elite band:** the Yard (Main Street, market blocks, South Street) and the Landing near the bank cache.
- **Endurance band:** every district except Relay.
- **Triggered:** the "bank run" set-piece, and boss add waves.
- **Must be measured** against the XS Max 30 fps bar at the endurance body cap before it ships.

**Elite option:** tell 32, inflation cap 8.

### 5.8 Oracle Marksman (priority 6)

**Identity.** Human, Forked Frontier Raiders: a relay keeper turned "oracle". When the relay went dark he took to the high ground and sold the only price feed left on the frontier: sightlines down a scope. He has a narrow face under the hood, and his antenna is backpack radio gear, not a drone. Role `marksman` (ranged family). He punishes standing still and makes height matter.

**Look**
- **Token `needle`:** tall and thin, about 1.9 m, r18, about 55 world px.
- **Top plane:** a telescoping radio mast on a slim backpack with a blinking red beacon; a deep hood and shoulders draped with **short** strips of shredded grey ticker tape, like a ghillie cape.
- **Rifle:** a bolt-action anti-materiel rifle with a bipod, about his height; the longest thin line on screen.
- **Face:** narrow, pale, unshaven, with a brass monocle-scope over the right eye with a red lens.
- **Outfit:** a long dark-grey hooded duster, knee pads, fingerless gloves, soft-soled boots.
- Kneeling to aim drops his height by a third, so the tell is a silhouette change.
- **Accent:** laser red `#ff1f1f` on the lens, the beacon and the laser module. The beam is the telegraph.
- He is distinct from the Agent (no magenta visor, no black suit) and from Lilly (no teal).

**Stats.** r18; speed 150; HP 70 (ramp); armour 1.0; knockback resistance 0.7; preferred distance 640; costs body 1 / threat 5 / ranged 1 / effect 2; curb 10, drop 32, ascent 48, water ×0.8; XP 180; maxAlive 1 in the pressure band, 2 from the elite band.

**Oracle Shot** (`tracking-lane`). A tell needs: the player within 860, height-aware LOS, a ranged token, and `maxConcurrentTells` (1 in the pressure band, 2 in the elite band).
1. **Track, 72 ticks.** The dot starts at the player's tick-0 position and moves toward the player's current position at no more than 3 units per tick. A player moving laterally at 240 units per second pulls away and watches the thin, flickering beam lag; a player standing still is found.
2. **Lock, 24 ticks.** The beam turns solid, doubles in width and freezes.
3. **Shot.** A lane from him through the dot: half-width 14 plus the player radius, cover-checked. 26 damage, knockback 20.
4. **Recovery, 90 ticks:** he works the bolt and rises. The punish window.

- **Cancels:** LOS lost for 12 consecutive ticks during the track, or 20 or more damage (a 30-tick stagger).
- **Height:** +5% range per layer (`elevation.mjs:238-248`).
- **Off-screen:** the beam enters with an edge chevron.
- **Auto-dodge:** a thin-lane shape that fires only in the last 6 ticks.
- **Audio:** gunfire only; the laser is silent.

**AI**
- **Perches:** a frozen `WORLD_SNIPER_PERCHES` list beside `SPAWN_POINTS`.
  - **Perch set on layout v2:** Relay Hill, the Cliff Dwellings and the Mining Bench (all z24), plus the Proof-of-Work and Old Mill decks (z16).
  - **Excluded:** the Quarry bench (inside B1) and the Ranger Lookout (Hashwood).
  - With the z24 cap, every perch is reachable by the enemy navgrid (ascent 48), so no special allowance is needed.
- **Selection:** the perch within 900 of the player with clear LOS, ordered by |distance − 640|, then by id. He paths there, then holds.
- **Relocation:** if the player comes within 300, he moves to the next-best perch away from the player (ranged backoff with `lineBlocked`, `enemy-simulation.mjs:337-352`). With no perch available, he uses cover.
- **State:** `perchId`, `tellMode`, `laserPoint`, `lockedAtTick`, `losLostTicks`. This generalises the fixed `telegraphTarget` (`enemy-combat.mjs:189`).

**Counterplay**
- Keep moving laterally during the track.
- Sidestep at the lock: 24 ticks is 96 units of movement against a 38-unit effective half-width.
- Duck behind any blocker.
- Dash through the shot.
- Rush the perch: he is fragile.

**Animations** (about 53 frames per direction)

| Clip | Frames and rate | Description |
|---|---|---|
| idle | 4 @6 | scanning, strips fluttering |
| run | 12 @24 | hunched sprint, the mast whipping |
| kneel-to-aim | 4 @16 | drops to one knee, bipod down |
| aim-track | 4 @8 loop | breathing sway, eye to the scope |
| fire | 6 @30 | heavy recoil, muzzle flash |
| recover-bolt | 8 @10 | works the bolt, rises |
| knocked-off-aim | 4 @24 | scope arm flails |
| hit | 3 @36 | hood snaps back |
| death | 8 @12 | topples sideways; the rifle clatters and the mast snaps |

**Where and when**
- **Pressure band:** the Mining Bench and the Cliff Dwellings.
- **Elite band:** the bridge decks, the Yard, and **Relay Hill** (breaking relay camping).
- **Never** in Hashwood.
- **Triggered:** a Marksman covering a gate or an arena approach makes "clear the perch first" an objective.

**Elite option:** track speed 3.5 per tick, lock 20 ticks.

### 5.9 Director placement summary (district flavour weights; 0 = never)

| Enemy | Opening (0+) | Build (≥ 9,000–12,000) | Pressure (18,000+) | Elite (36,000+) | Endurance (75,600+) |
|---|---|---|---|---|---|
| Rug Puller | – | Ravine (2) | + Crossing approaches, Hashwood, Mining, Yard | + Relay | all |
| Bloater | – | Hashwood, West Marsh (2) | all six | all, maxAlive 4 | in pairs |
| Tollkeeper | – | – | Crossing decks | + Yard alleys, Mining fences; never Hashwood or Relay | same |
| Revenant | – | – | Mining, Hashwood tree lines | + Ravine, Yard | all but Relay |
| Money Printer | – | – | – | Yard, the Landing | all but Relay |
| Marksman | – | – | Mining Bench, Cliff Dwellings | + decks, Yard, Relay Hill; never Hashwood | same |

### 5.10 Art and mobile gate for new enemies (a hard gate before any ships)

- **The enemy wire cap is nearly full:** 15.16 of 16 MiB is used, which is less than one native enemy of headroom.
- **Before any new enemy ships, three things must exist:**
  - a **128 px mobile tier**;
  - **residency by band and district**: band-allowed archetypes with non-zero weight in the current or adjacent district, loaded from `band.minTick − 1,800` and unloaded after 1,800 ticks out of scope;
  - a **decoded-memory gate** in the asset QA.
- **Bodies:** each enemy gets an original Tripo body, never a kitbash of a hero or the Bagholder.
- **Props:** rigid prop bones (rug, door, arm, crank wheel, rifle), no cloth simulation.
- **Frames:** 56 or fewer per direction.
- **Rendering:** the hero pitch (35°) with the shared light rig, and the edge-contrast gate (7.11).
- **Performance:** measure the XS Max in the pressure and endurance scenes.

---

## 6. Core six upgrades

**Every enemy gets:**
- behaviour flags;
- poise and interrupts;
- a height-aware LOS gate before ranged tells;
- swept pressure and dash;
- per-radius clearance;
- **telegraphs that equal their hitboxes**;
- additive hit reactions (the 6-tick flash plus a 2 px push; no hit clip, so an enemy never slides in a hit pose under Machine Gun fire);
- facing hysteresis in the observer (3°, snap at 3 or more octants, otherwise one octant per 3 ticks, keyed by enemy id);
- dismember kills that skip the death clip (burst, gore and a remains decal);
- a tick-only corpse clock;
- pooled displays.

**Art for all six.** A **re-render on the hero camera (35°) with `hmh-light-rig.json`** (they render at 55° today) comes before any new clip work, so no clip is authored twice. The edge-contrast gate applies (7.11).

| Enemy | AI and sim upgrade | New clips (template in 7.12) | Art action |
|---|---|---|---|
| Bagholder Rusher (zombie) | Poise; attack variants chosen by `hash(id, tellStartTick)` over shared geometry | shamble-sprint; tell with both arms up; lunge slam or satchel swing; death falling back (coins spill as VFX) or crumpling | keep the body, re-render (the first enemy slice) |
| Forkrunner (human) | `flankLane` flag; poise | low sprint; planted-foot tell with blades crossed; X-slash or spin slash; momentum-tumble death | **re-model**: today it reads as a Lilly clone (teal hair and coat) |
| Liquidator Agent (human) | **LOS-gated three-round burst at mid range**; the cover flag; the escort slot behind a Tollkeeper | tactical walk plus strafes and backpedal; tell with the rifle shouldered and the visor flaring; three kicks inside the 6-tick strike, or an aimed shot; kneeling death with the rifle dropped | keep. It is built on Commando's body, so it is re-modelled later if the 35° re-render reads as Commando (optional, decision 16) |
| Whale Enforcer | `holdsChokepoint` (shared with the Tollkeeper). **Shoulder Rush:** a locked lane 46 wide that rushes up to 220 and stops at the first blocker with a 30-tick stumble. Its telegraph is **redrawn as that lane** (a circle today, `main.mjs:1809-1815`). r36 clearance | heavy stomp; squared-shoulder tell; shove; knee-then-fall death | **re-model as a human** (the game logic says human; the art says zombie) |
| Gas Bomber | Area-token family shared with the Rug Puller; LOS gate; strafe | waddle-jog plus strafes; fuse-lighting tell; overhand lob or underhand bowl; canister-rupture death | **re-model as a human** |
| Validator Cultist (zombie) | Support targets are prioritised: a Revenant, then the Foreman in B3. The no-ally ring aimed at the player is dropped. Poise | gliding shuffle plus strafes; tell with the staff planted; ring-slam or staff to the sky; collapse death | keep |

**Clip budget (35° camera, trimmed areas × 1.25 until re-measured)**

| Enemy | Frames per direction | Desktop 256 (MiB) | Phone 128 (MiB) | Today (MiB) |
|---|---|---|---|---|
| Bagholder | 76 | 23.9 | 6.0 | 8.8 |
| Forkrunner | 76 | 20.4 | 5.1 | 7.5 |
| Agent | 102 | 35.3 | 8.8 | 9.7 |
| Whale | 80 | 29.9 | 7.5 | 10.5 |
| Gas Bomber | 104 | 34.6 | 8.7 | 9.3 |
| Validator | 106 | 46.8 | 11.7 | 12.4 |
| **Six core** | | **191** | **48** | **about 64** |

On phone, each enemy's full set fits one 2048² page.

**Pipeline prerequisites**
- Manifest-driven actor lists replace the hard-coded ones:
  - `build-hmh-native-roster.py:20, 51-52, 161-240`;
  - `adopt-hmh-native-roster.py:5, 24`;
  - the QA checks at `:282-287`;
  - `ENEMY_ROSTER_ACTORS`.
- `BLENDER_EXECUTABLE` replaces the hard-coded `D:/Apps/Blender`.
- Enemies use rig v2 without the weapon-class controls.

---

## 7. Hero animation and weapon handling (Anim v2)

### 7.1 What stays and what changes

**What stays**
- Blender models baked into 8-direction sprite atlases, layered at runtime, with no runtime skeletal animation.
- The deterministic exporter family: Blender 5.1.2, two cold passes, adopt-time re-hashing.
- Anim v2 is an **extension** of that exporter (decision 24).
- A hero switches to v2 only once its v2 atlas is certified.

**Today's gaps**
- Hero motion is procedural sin and exp curves over 25 keys, with no mocap.
- **Long guns are one-handed:** the left arm is fixed at `upper_arm.L` 22° and `forearm.L` 70°, and held weapons are skinned 1.0 to `pistol_prop`.
- **Death always shows the Coin Blaster** (`main.mjs:2465-2472`; `HELD_WEAPON_CLIPS` has no death clip).
- The rig has no clavicles, neck, twist bones, fingers or toes.
- The rig scripts exist only in the prototype worktree `lesters-arcade-cycle078-rig-pilot`.

**Frames per hero:** 7,888 for the must-have set (8-direction aim), against 2,768 today. 16-direction aim takes it to 9,824, and the polish set to 11,200.

### 7.2 Quick wins (S0.2 and S1.1; they ship before any v2 art)

| # | Change | Kind | Test |
|---|---|---|---|
| 1 | **Death camera.** On the defeat tick, send `game:game-over` with the same payload. Freeze the sim, keep the ticker running for 72 presentation ticks (1.2 s), with the existing 6-frame death at 8 fps, then stop the ticker. `finalizeGameOver` (`apps/portal/src/hmh-reboot-portal-lifecycle.mjs:52-82`) delays the results screen by 1.2 s. Score submission and Ranked finalisation are unchanged | Runtime and parent lifecycle; certification | Bridge message fixture unchanged; the death frame is visible at +0.5 s |
| 2 | Hide the weapon layer during death | projection | visual baseline |
| 3 | **Manual dodge** on `ShiftLeft` (7.7) | sim slice | same-seed tests |
| 4 | Pooled enemy displays plus a shared per-actor texture cache; no full rebuild in `resetEnemyMarkers` (`main.mjs:1139-1148`; `enemy-roster-atlas.mjs:228`) | performance | pressure-scene frame time before and after |
| 5 | Enemy facing observer | projection | partition test |
| 6 | Tick-only corpse clock (`corpse-presentation.mjs:16-19`) | projection | no expiry during pause or level-up |
| 7 | `source.autoGarbageCollect = false` on held-weapon and character atlas sources (the Pixi 8.19 `GCSystem` unloads after 60 s of disuse, which is a mid-fight re-upload hitch today) | performance | GPU upload counter |
| 8 | **Physical iPhone XS Max** pressure-scene baseline | evidence | required before S4.1 ships |

- **Built (build ledger slice 3).** Row 1 is built child-side: the child builds the result on the defeat tick and holds all four result messages for the 72 presentation ticks, so the parent must not add its own 1.2 s delay. Row 3 follows 7.7; the bridge's `settings.keyboardBindings` gains an optional `dodge` key.

### 7.3 Rig v2 (`HMH_HumanRig_v2`)

- **Bones.** Adds clavicles, neck, arm and twist bones, 9 bones per hand, toes, per-hero baked spring chains and prop sockets. The weapon socket moves from `forearm.R` to `hand.R`, with `REFERENCE-CHARACTER-MODELS.md:47` updated in the same commit.
- **Template and build script live in the release repo.**
- **Actions** go in a separate texture-free `<hero>-actions-v2.blend`, linked from the mesh blend, because Commando's packed blend is already 90.1 MB against the 96 MiB `lfs-check` cap.
- **Baking.** Every clip is baked to XYZ Euler with root motion stripped. Mixamo quaternion actions are baked or remapped.
- **Fingers.** Tripo meshes with fused fingers get a **mitten curl** on `grip_01-03` with a separate thumb. The default is no hero-mesh regeneration (decision 24).
- **Controls** stay authoring-only: IK hands and feet, poles, `aim_ctrl`, `support_ctrl`.

### 7.4 Two-hand grips: authoring classes and one merged upper set per weapon

| Authoring class | Weapons | Main hand | Off hand | Lower-body stance |
|---|---|---|---|---|
| pistol | Coin Blaster | one hand, arm extended | guard at chest | neutral |
| rifle | Shotgun, Hash Rail, Arc Rifle | pistol grip | foregrip or pump | staggered |
| heavy | Auto-Miner | rear grip at the hip | carry handle | wide |
| launcher | Launcher Rig | grip | under-barrel | wide |
| flamethrower | Bear Market Burner | trigger grip at the hip | front handle | wide |
| standard | War Fork | rear of the haft | front of the haft | fencing |

**Authoring.** The right hand is a child of `weapon.grip`, the left hand is IKed to `weapon.support`, and the stock sits in the shoulder pocket. Everything is baked to FK. Grip gates: right hand ≤ 5 mm, left hand ≤ 10 mm, outside declared release windows.

**Runtime.** One **merged upper-body set per weapon** (torso and weapon rendered together). Hero layers are shadow, lower body and upper body only. There is no weapon layer and no holdout render. This does not save memory (about 355 MiB either way at desktop F with all 8 weapons), but it removes alignment problems and seams.

**Weapon models.** Concept → Tripo → Blender, following the owner's weapon sheets.
- Sockets: grip, support, stock, muzzle.
- Mechanism pivots: pump, rotary barrels, cylinder and hinge, rail coil, arc cell, fuel canister.
- Tripo returns fused meshes, so moving parts are rebuilt in Blender: about 0.5–1 day per weapon.

**Evolved weapons** use the shared additive glint overlay (8.6), not new frame sets.

### 7.5 Per-weapon clips (timed from simulation constants)

| Weapon | Simulation cadence | Fire clip | Other clips |
|---|---|---|---|
| Coin Blaster | 20 ticks; burst tier 4-tick spacing | 4 frames, frame = ticks since the last shot (clamped); restarts on every shot | reload 16, equip 10 |
| Scatter Shotgun | 63 | fire 4 [1,1,2,3], then pump 6 over ticks 12–30 | reload 16 (2 shells and rack), equip 10 |
| Auto-Miner | 5; heat 6 per shot, resumes at 35 | spin-up 4; loop 4 frames, frame = min(3, ticks since shot) | **vent 8** while overheated ("COOLING", `weapon-system.mjs:618-656`); reload 16; equip 10 |
| Hash Rail | charge 72 (67/62/56 with upgrades) | charge loop 8 while charging; discharge 6 [1,1,2,2,3,3] | reload 16, equip 10 |
| Arc Rifle | pulse every 6 | channel loop 6, phase-locked to the pulse counter | reload 16, equip 10 |
| Flamethrower | pulse every 6 | fire loop 6, phase-locked | tank swap 16, equip 10 |
| Launcher Rig | 80 | 8 frames [1,1,2,2,3,3,4,4]; the cylinder indexes on frames 5–7. Launcher shots never use the offhand grenade projection | reload 16, equip 10 |
| War Fork | thrust 24, sweep 28 | thrust 8 over 24, sweep 10 over 28, strike first | equip 10 |

**Rules**
- **Reload:** frame = `floor(progress × 16)`, which tracks upgraded reload speeds. It replaces the reload layer dip (`main.mjs:2471-2476`).
- **Draw:** 4 frames = 6 ticks, matching `switchTicks`. It plays on wheel swaps and on the automatic fallback to the Pistol.
- **Equip:** plays only on a cache pickup that newly selects the weapon, and only if no shot fired in the last 8 ticks. Firing cancels it.
- **Muzzle socket:** set per frame on every state that can fire.

### 7.6 Locomotion and aim

| Lower-body clip | Frames | Driver |
|---|---|---|
| idle (neutral) | 12 | 8 fps loop |
| stance idles (staggered, wide, fencing) | 12 each | loaded with the first owned weapon of that stance |
| run | 16 | distance, one cycle per 160 units |
| sprint | 16 | distance, one cycle per 240, above 1.35× nominal speed (stacked boosts reach about ×2.0) |
| strafe-left, strafe-right | 16 each | distance, one cycle per 150 |
| backpedal | 16 | distance, one cycle per 130 |
| start | 4 | the first 40 units after being still for 6 or more ticks |
| stop | 6 | 12 ticks after 12 or more ticks of running |
| dash | 8 | the 8 active ticks only; legs return to locomotion on tick 8 with a 2-tick crossfade |
| turn-left, turn-right (polish) | 6 each | idle only |

- **Distance counter.** It integrates only the player's own motion velocity. Pressure, knockback, docking glides and dash displacement are ignored, so the legs never run while the hero is being shoved.
- **Selection by Δ = move octant − aim octant:**

  | Δ | Legs | Hips | Upper twist |
  |---|---|---|---|
  | 0 | run or sprint | aim | 0 |
  | ±1 | run | move | 1 octant back |
  | ±2 | strafe | aim | 0 |
  | ±3 | backpedal | move + 4 | 1 octant |
  | 4 | backpedal | aim | 0 |

  `aim-run` (8 frames) is indexed `floor(legFrame / 2)`.
- **Muzzle, tracer and shot direction.**
  - Aim hysteresis is 3° or less.
  - Flash and tracer start at the drawn frame's muzzle socket and converge onto the simulated trajectory within 4 ticks. The simulated origin is unchanged: 28 units along the aim at chest height.
  - On a retarget of 3 or more octants, the upper body sweeps one octant per tick, and the tracer starts at the simulated origin during the sweep.
  - With 8 directions the worst case is 22.5° + 3°. **16-direction aim** (aim and fire only) costs about +90 MiB desktop and +23 MiB phone; **decision 19**.

### 7.7 Actions

- **Manual dodge** (desktop keyboard only).
  - **Binding:** a `dodge` row in `action-map.mjs`, default `ShiftLeft`, alternate `ShiftRight`. It supports rebinding and the Ranked lock, and is a buffered edge. There is no touch or gamepad binding.
  - **Why not Space:** Space activates a focused HUD weapon card (`main.mjs:4802`) and confirms selections in the wheel.
  - **Auto-dodge interplay:** automatic dodge is off while the keyboard is the last active device and `dodge` is bound. Touch and gamepad keep auto-dodge.
  - **Direction:** move input, else the last non-zero move direction, else directly away from the aim. It never dashes along the aim.
  - **Safety:** swept traversal plus the auto-dodge footprint rule (no drop, no deep water, no bridge-edge clip). A dash is truncated at the last safe 4-unit sample. Under 48 safe units it is refused, no cooldown is spent, and a "blocked" flash shows.
  - **Cooldown and i-frames:** matched to the automatic dodge (600/480/360); decision 20.
  - **Clip:** legs 8 frames; upper body 12 frames (tucked for 8 ticks, then 4 recovery frames that twist back to the aim).
- **Hand grenade.** 12 frames over 24 ticks, released on frame 3 (tick 4). Two-hand weapons release the support grip on frame 0 and re-grip on frame 10. The grenade is drawn at `offhand_socket` for 4 ticks, then eased onto the simulated position by tick 8.
- **Knife** (automatic Litecoin Blade). A 6-frame `knife-or-bash` clip over 8 ticks: a reverse-grip offhand slash with the Pistol, a stock-bash with two-hand weapons, none with the War Fork. It plays only if no shot fired in the last 8 ticks; otherwise only the Litecoin-blue slash VFX shows. It never outranks fire.
- **Hurt.** Every hit is additive: a 6-tick red-white tint and a 2–3 px offset along the knockback, with no clip, and fire continues. A **heavy hit** (≥ 20 damage, a boss attack or an explosion) plays a directional 4-frame `heavy-hit-front` or `heavy-hit-back` over 8 ticks, with a 30-tick cooldown.
- **Death.** `death-back` when hit from the front, `death-front` when hit from behind: 16 frames over 60 ticks, then hold. The weapon becomes a projection-only dropped prop (5 frames, landing 0.5–0.8 m away). The clip must fit the 72-tick death-camera window.
- **Power-up and pickup reactions.**
  - **Must-have:** a pickup burst plus a **persistent rim** in the power-up's colour for its full duration (Berserk and Speed Boost 600 ticks), drawn as an enlarged additive copy like the elite rim (`enemy-roster-atlas.mjs:186-193`).
  - Heal and XP get a burst only. Ammo refills and the Quartermaster play a 6-frame "reload snap". Silver gets a sparkle.
  - **Polish:** an 8-frame `surge` clip, only after 30 ticks without a shot. It is also the evolution moment.
- **Idle variants.** After 180 idle ticks, `inspect` (equip at half speed) alternates with `idle-personal` (polish, 12 frames per weapon), co-designed with the owner:
  - Commando tugs his neckerchief;
  - Valkyrie rolls a shoulder;
  - Lester flips a silver Ł coin;
  - Lilly settles her collar.

  Idle variants are off under `reduceMotion`.

### 7.8 Interaction clips (contract with section 3.2)

| Clip | Frames | Structure | Used by |
|---|---|---|---|
| `interact-press` | 12 | reach 4; press loop 4 while progress < 1; release 4 | generators, uplink, Closing Bell |
| `interact-lever` | 20 | grab 4; strain loop 6; heave 6 once 12 or fewer ticks remain; release 4 | barn, log pile, warehouse, bascule, hoist lever |
| `interact-crank` | 20 | enter 4; hand-over-hand loop 12 (whole turns fitted to the hold); exit 4 | winch, mill sluice, sanctuary crank, steam valve, Lock Windlass, Foreman's rigs |
| `interact-kneel` | 20 | kneel 6; work loop 8; stand 6 | cages (cutting shackles), strongboxes, prying secrets, Beacon brazier |

- The clips are full-body with the weapon stowed, authored facing **east and west**.
- Each exports a per-facing `handTarget`.
- The costs are within the hero budget: props about 3.9 MiB desktop and 1.0 MiB phone; prisoners about 5.7 MiB desktop and 1.4 MiB phone.

### 7.9 Runtime (schema, resolver, residency)

**Schema `hmh-hero-anim-v2`** (also used for enemies)

| Level | Contents |
|---|---|
| Sets | `core`, `stance:<id>`, `weapon:<id>` |
| Tiers | desktop and phone, each with an optional compressed variant |
| Per frame | `frame`, `trim`, `orig`, `pivot`, `anchor`; `sockets {muzzle, grip, support, offhand}`; `contacts {footL, footR}`; `handTarget` |
| Per actor and tier | a fixed `sourcePxPerWorldUnit`, which replaces `160 / frame.sourceSize.h` (the source of today's shrinking on wide canvases) |
| Per clip | `frames`, `frameTicks[]` or `fps`, `loop`, `driver` (`tick`, `distance`, `progress`, `phase` or `shotAge`), `cycleDistance`, `facings` (8, 2 or 1), `events` |

**Pivots** sit on even master pixels, so the phone tier lands on integers.

**Upper-body resolver precedence**
1. death
2. dash
3. hand grenade
4. heavy hit
5. interaction (exclusive, full body)
6. draw
7. fire, charge, channel or vent
8. reload
9. knife or bash
10. equip
11. idle variant
12. aim-idle or aim-run

**Legs.** Death and interaction own the legs. Dash owns them for its 8 active ticks. Otherwise locomotion runs.

**Additive, outside the precedence list:** the hurt tint and offset, the power-up rim, the evolution glint and the knife VFX.

**Blends**

| Transition | Blend (ticks) |
|---|---|
| Among the locomotion clips (normalised phase preserved) | 4 |
| Into fire, knife, grenade, dash, draw, heavy hit or death | 0 |
| Back to aim | 3 |
| Dash legs to locomotion | 2 |
| Reload in / out | 2 / 3 |
| Interaction in / out | 4 / 3 |
| Octant change | never blended |

The incoming sprite sits underneath at full alpha and the outgoing sprite fades out on top. Enemies never crossfade on phone.

**Projection observer.** It is stepped once per simulation tick inside the fixed-step loop, including catch-up steps. It holds leg distance, aim hysteresis, blend starts, the sweep, and enemy facing and variant. It is excluded from the simulation hash, resets on restart, and never throws.
- **Test:** the same input trace run with render partitions of 1, 2, 3 and 4 steps per frame gives identical frame ids on every tick.

**Residency**
- **Hero.** `core` is resident from run start. **Each weapon set stays resident from the tick the weapon is owned until run end.** Stance sets load with the first weapon of that stance. No v1 assets remain once a hero is on v2.
- **Fallback.** The empty-hands upper set plus the weapon's VFX. A `residency-miss` counter must read zero in the soak.
- **Prefetch** for weapons not yet owned: the seeded War Fork event tick minus 1,800; entry to a district holding an uncollected cache; the start of a site activation; reward unlocks.
- **Enemies and bosses:** as in 5.10 and 4.1. Prisoners and animated props: current and adjacent districts.
- **GPU.** `autoGarbageCollect = false`, with an explicit `texture.destroy(true)` release (new code).
- **Uploads.** In combat, at most one 2048² page per 30 render frames. Unrestricted during the level-up freeze, pause, or while no enemy is within 900. Uploads go through the prepare plugin (8–37 ms per page was measured on iPhone-13 emulation).
- **CPU copies.** S0.4 measures whether iOS keeps both copies; CPU copies are released only if that measurement demands it.

**Performance gates**
- 16 or fewer distinct textures in the phone actor layer, plus a draw-call cap measured in S0.4.
- Physical XS Max at 30 fps or better in the busiest scene before S4.1 ships.

### 7.10 Memory, transfer and storage

Worst case in a late run: all 8 weapons owned, 12 enemy types resident (6 core and 6 new), one boss, prisoners and props, 8-direction aim.

| Tier | Hero | Enemies | Boss | Prisoners and props | **Total RGBA** | **Total ASTC/BC7** |
|---|---|---|---|---|---|---|
| Desktop F (256) | 354.5 | about 363 | about 115 (at most) | 9.7 | **about 843** | **about 211** |
| Desktop 0.75F | 199.4 | 204.3 | 64.8 | 5.4 | **474** | 119 |
| Phone F/2 (128) | 88.6 | 90.8 | 28.8 | 2.4 | **about 211** | **about 53** |
| Phone 0.625F | 138.5 | 141.9 | 45.0 | 3.8 | 329 | 82 |
| **Today, 1.8.1** | about 116 | about 80 | | | **about 228** | |

These are the animation calculator's figures, which assumed 96 frames per direction for new enemies and 210 for bosses at 320 px. The concrete designs above (49–84 frames per enemy, 256 px bosses at about 1,150 frames) come in lower, so these totals are an upper bound.

**Decisions this forces**
1. **Desktop at full resolution needs KTX2/UASTC** (BC7 on desktop, ASTC on iOS). The `/hmh-reboot/` CSP already allows `'unsafe-eval'` and `blob:` workers, so a lazily loaded self-hosted transcoder of about 930 KB needs no CSP change, though it is still a new candidate. There is an S0.4 go/no-go spike on Commando. If it fails, desktop ships at 0.75F.
2. **Phone ships F/2 in RGBA** (about 211 MiB, no worse than today), and moves to ASTC once the spike passes on the A12. F/2 is sharp in landscape and soft in portrait; S0.4 captures both before choosing 0.5F or 0.625F.
3. **Selected-hero wire.** The start set (core plus pistol) is 5.8 MB phone and 23.3 MB desktop in lossless WebP, against the 8 MiB cap (`hero-motion-atlas.mjs:9-10`). Desktop needs KTX2 with zstd, lossy WebP q90 (about 8.4 MB), or a cap change.
4. **Storage.** About 109 MB per hero lossless, about 435 MB for four heroes. The repo is already over budget (938 MiB against 350 MiB strict), and Git previews fail on LFS. Recommendation: **KTX2 or lossy delivery files in an external, SHA-pinned artifact store, with only the masters in LFS.**
5. **A decoded-memory gate** per set, tier and worst-case scenario in `assets:qa:hmh-reboot` (`decodedRgbaBytes` is already reported).

### 7.11 Production pipeline

| Step | What | Gate |
|---|---|---|
| 1. Co-design | Owner approves the concept sheets, the pose sheets per hero (aim-idle per class, dash, death, one interaction), one sheet per weapon, the prisoner looks and the personal idles | sign-off recorded in DECISIONS.md |
| 2. Tripo | bodies 30–60k triangles, weapons 5–15k; PBR; textures ≤ 2048; GLB; task id and credits recorded | `assets:hmh:models:lfs-check` |
| 3. Cleanup | extend `import-hmh-external-model.py` (SHA pin, weld, ground, height); rebuild moving parts with pivots | zero external dependencies |
| 4. Rig | `create-hmh-human-rig-v2.py` plus a landmark JSON; bone heat, data transfer, corrective shape keys | ≤ 4 influences; no unweighted vertices; twist and volume tests |
| 5. Animate | library or mocap plus hand-keyed (below) | counts and drivers match; root motion stripped; **foot slide ≤ 2 cm per frame**; loop seams; grip errors within limits |
| 6. Bake | `build-` and `export-hmh-hero-anim-v2.py` in the existing exporter family; phone tier by 2×2 premultiplied box filter | grounding ≤ 1e-4; no opaque border; zero waist-seam gap pixels at ±1 octant on both tiers; **edge-contrast gate** |
| 7. Adopt | `adopt-hmh-hero-anim-v2.py` re-hashes everything | wire **and** decoded caps |
| 8. Runtime | observer, resolver, residency | the partition test; clip lengths equal the simulation constants; `visual:reboot`; serial smokes; XS Max profile |

**Animation source** (decision 18)
- **From a library or mocap:** idle, run, sprint, strafes, backpedal, start and stop, turns, deaths, heavy hits, kneel, button press, lever pull. Candidates: Mixamo (needs the owner's Adobe account), Tripo presets, or licensed packs.
- **Keyed by hand with IK:** class aim layers, fire and recoil, 8 reloads and 8 equips, draw, vent, pump, charge, grenade, knife and bash, dash, crank and valve, and weapon mechanisms.
- **Recommendation:** a **contracted human animator** for the hand-keyed list, at least for the Commando pilot. The agent pipeline does retargeting, IK baking, export and QA.
- **S0.4 pilots** four clips: run (library), shotgun reload (hand-keyed), lever pull (library plus IK) and dash (hand-keyed).

**Edge-contrast gate** (replaces "mean V ≥ ground + 0.1", which the approved dark heroes fail)
- For every idle frame and direction, the mean luminance of the 2 px outer alpha band must differ from each district ground's mean by ΔV 0.12 or more. If it does not, the bake raises the warm-gold rim energy.
- A low-alpha additive runtime rim backs this up on the darkest grounds (road V 0.27, forest floor 0.30, wet bank 0.31).
- This also fixes the inverted actor value: mean enemy V is 0.16–0.26 against ground at 0.27–0.56.

**Bake time.** 7,888 frames × 2 passes is about 15.8k renders per hero: at least 1.2 h, realistically 4–12 h. S0.4 times a Commando pistol-set bake first.

### 7.12 Enemy clip template (per direction)

| Clip | Frames | Driver |
|---|---|---|
| idle | 8 | 8 fps loop |
| run | 16 | distance, with a per-enemy authored cycle (speed tuning never forces a re-bake) |
| strafe-left, strafe-right, backpedal | 8 each | distance (Agent, Gas Bomber, Validator, and the new ranged enemies) |
| tell | 6–12 poses | **frame = floor(progress × N)**, where progress = (tick − tell start) / `tellTicks`. Poses are baked; timing is not |
| attack-a, attack-b | 10 each | strike frames 0–3 over the 6 strike ticks; frames 4–9 over `recoveryTicks` by progress |
| death-back, death-front | 10 each | about 36 ticks, then hold; skipped on dismember kills |
| stagger | 6 | now needed: the poise system adds real stagger |
| spawn or ambush | 8 | scripted on-camera ambushes only (the Revenant has its own emerge) |

---

## 8. Progression

### 8.1 Today (verified in code)

| Area | Fact |
|---|---|
| Unreachable trees | The Shotgun, Machine Gun, Railgun and Launcher trees (`weapon-system.mjs:263-283`) are unreachable. `progressionByWeapon` (`:294-320`) feeds only the Pistol, Arc Rifle, Flamethrower and War Fork, and tests hide this by calling `applyWeaponProgression` directly |
| Unreachable evolutions | `HMH_WEAPON_EVOLUTIONS` (`:250-255`, pinned by `deepEqual` in `tests/hmh-reboot-weapon-system.test.mjs:67-74`) is unreachable. An evolution overwrites the special's `projectileTag` (`:522`), `scoreMultiplier` is never applied, and a Shotgun evolution would throw (`:464-466`) |
| Balance | The benchmarked maxed Pistol reaches 46.93 DPS, against base Shotgun 10.8, Machine Gun 9.93 and Launcher 16.5, so weapon caches become late-run downgrades |
| Launcher | `throwGrenade` uses fixed damage 34 and radius 150 and ignores `event.shots` (`main.mjs:4093-4106`) |
| Crits | Crits apply only to projectiles (`main.mjs:3781-3782`). The `armor-piercing` check at `:3783` is dead |
| Level-up timing | The offer opens after the render frame (`main.mjs:5051-5060`), after up to 4 catch-up ticks |
| Legacy evolutions | `apps/portal/src/arcade-core.mjs:870-921`, `hmh-upgrade-runtime.mjs:62-68` and `main.js:9818` use the same evolution ids with other meanings |

### 8.2 The four gun branches (12 level-up cards)

Each card has `maxRank: 3` and `requiresWeaponId`, and maps in `progressionByWeapon` to `{rateOfFire, damage, reloadSpeed}`. The ids use crypto words and the titles stay plain.

| Weapon | Card id → title | Tiers 1 / 2 / 3 | Tier-3 special | Code change |
|---|---|---|---|---|
| Shotgun | `scatter-pump` → Pump Speed | fire rate ×1.10 / 1.22 / 1.36 | `double-barrel`, +6 pellets | none |
| | `scatter-dump` → Shell Damage | +1 / +3 / +5 per pellet | `explosive` | the splash applies to the centre pellet only, r72 |
| | `scatter-shells` → Magazine & Salvage | reload ×1.18 / 1.40 / 1.66, plus reserve and salvage | `quad-shell`, clip 4 | reserve and salvage fields |
| Machine Gun | `miner-hashrate` → Fire Rate | ×1.20 / 1.44 / 1.72 | `overheat-reduction` | heat per shot ×0.90 / 0.80 / 0.72 per tier (today only tier 3 reduces heat) |
| | `miner-asic` → Round Damage | +0.5 / +1 / +2 | `tracer-rounds` | none |
| | `miner-pool` → Magazine & Salvage | reload ×1.25 / 1.56 / 1.95 | `drum-mag`, clip 180 | reserve and salvage fields |
| Railgun | `rail-blocktime` → Charge Speed | ×1.08 / 1.18 / 1.30 | `fast-rounds` | `chargeTicks` 72 → 67 / 62 / 56 |
| | `rail-proof` → Rail Damage | +6 / +12 / +20 | `deep-proof`, pierce 7 | boss penetration becomes a policy flag |
| | `rail-mempool` → Magazine & Salvage | reload ×1.12 / 1.26 / 1.45 | new `capacitor-bank`, clip 5 | replaces the shared `extended-mag` |
| Launcher | `launcher-airdrop` → Launch Rate | ×1.12 / 1.26 / 1.42 | `twin-tube`, 2 shells 7° apart | throw one grenade per entry in `event.shots` |
| | `launcher-yield` → Blast Damage | +2 / +5 / +8 | `shaped-charge`, r210 | pass upgraded damage and `blastRadius` into `throwGrenade` |
| | `launcher-bandolier` → Magazine & Salvage | reload ×1.2 / 1.45 / 1.7 | `bandolier`, clip 7 | reserve and salvage fields |

**Magazine & Salvage**
- **Reserve.** `reserveAmmoGrant = ceil(pickupReserveAmmo × 1.25 / 1.5 / 2.0)`, and the existing 2× cap scales with it.

  | Gun | Grant at tiers 1 / 2 / 3 | Cap |
  |---|---|---|
  | Shotgun | 15 / 18 / 24 | 30 / 36 / 48 |
  | Machine Gun | 300 / 360 / 480 | 600 / 720 / 960 |
  | Railgun | 19 / 23 / 30 | 38 / 46 / 60 |
  | Launcher | 10 / 12 / 16 | 20 / 24 / 32 |

- **Salvage (tiers 2 and 3).** Kills credited to that gun add a per-mille refund to `weapon.salvagePermille`. Each whole 1,000 moves 1 round into reserve, never the clip, with no RNG.

  | Gun | Tier 2 | Tier 3 |
  |---|---|---|
  | Shotgun | 250 | 500 |
  | Machine Gun | 2,000 | 4,000 |
  | Railgun | 150 | 250 |
  | Launcher | 150 | 250 |

- **Ordering.** Kills resolved in tick *t* are credited by `creditWeaponKills(loadout, {tick, weaponId, count})` right after kill resolution, and read at the weapon step of *t+1*.
- **Benchmark.** Add `output60` (damage in 60 s from a full clip and a full reserve cap, in the 8-body pack scenario) and the missing Railgun rows. **Acceptance:** every maxed finite gun reaches at least the maxed Pistol's `output60`.
- **Card art.** Branch cards reuse the weapon icons.
- **Built (S1.3, build ledger slice 6).** The twelve cards, Magazine & Salvage (`creditWeaponKills`), Charge Speed, Capacitor Bank, the Machine Gun's heat per rank, the centre-pellet blast (pellet `floor((n − 1) / 2)`) and the Launcher's shells are in `weapon-system.mjs` and `main.mjs`; Twin Tube fires exactly 7° apart (no pellet jitter). The `output60` benchmark column and the Railgun rows (S0.3) are not built yet.

### 8.3 Level-up panel: two cards and one re-roll per card

**Card selection** (simulation state, captured on the tick of the level)
- **Focus gun:** the last **non-Pistol** gun the player selected by hand or newly picked up. The auto-fallback to the Pistol does not change it.
- **Candidates:** owned non-Pistol guns that have ammo (the War Fork always counts; the Flamethrower while it has fuel) and still have an unfinished branch or capstone. The focus gun comes first, then `HMH_WEAPON_ORDER`, which moves from `main.mjs:306` into `weapon-system.mjs`.
- **Card 1:** a general draw, as today.
- **Card 2:** "your gun" from the first candidate, with a chip such as **SHOTGUN 4/9** (specials show /10). With no candidate, it is a second general draw. **Card 2 never focuses the Pistol.**

**Draw model** (`mastery-draw-model-v2.mjs`, 20,000 trials; level-ups needed to take all 9 branch ranks)

| Rule | Picked-up gun (mean / p90) | Pistol (mean / p90) |
|---|---|---|
| Today, two uniform cards | 29.6 / 39 | 24.1 / 32 |
| Re-roll only | 17.6 / 23 | 14.5 / 19 |
| **Card 2 every level + re-roll (recommended)** | **9.0 / 9** | 14.5 / 19 |
| Fallback: card 2 every second level + re-roll | 11.8 / 14 | 14.5 / 19 |

**Power is not free.** It is bounded three ways: no Pistol on card 2, empty guns skipped, and the harness gate. If median survival in the harness grows by more than 10% against 1.8.1, card 2 switches to every second level-up (agreed in advance).

**Re-roll rule**
- One re-roll per card per offer. Each pending level is its own offer, and re-rolls cannot be saved up.
- A card shown in an offer never comes back in that offer.
- Card 2 re-rolls through the same gun's other cards, then the next candidate gun, then the general pool. When nothing is left, the strip is disabled and reads "No other upgrades".
- A re-roll never selects, closes the panel or advances the tick, and it is **silent**.

**RNG.** The pure FNV `hashChoice` is used with salt `offer:${kind}:${level}:${pendingLevels}:${selectionSequence}:s${slot}:d${draw}:${upgradeId}`.
- `simulation.nextRandom` is **never** used, so menu use cannot shift drops or spawns. This deliberately departs from the v2.1 design doc.
- Same-seed offers change against 1.8.1. HMH has no child replay recorder, and Ranked is plausibility-only, so this is recorded as one determinism-version bump.

**Timing fix** (done in S0.2)
- The step callback (`main.mjs:3260`) opens the offer at the end of the tick whose XP produced the level, unless the player died that tick, and then calls `simulation.enterUpgrade()`. That resets the accumulator, so the catch-up loop exits.
- The render path at `:5051-5060` only paints the panel.
- The `upgrade-offer` cue (`:4713`, `:5058`) is removed.
- Test: `steps === 1` with 4 ticks due.

**API** (`src/run-progression.mjs`)
- New state: `focusWeaponId`, `rerollsUsed`, and `offer: {kind: 'level' | 'evolution', key, slots: [{id, draw, rerolled}], shown}`.
- Functions: `openRunUpgradeOffer`, `rerollRunUpgradeSlot`, `selectRunUpgrade`.
- `main.mjs` gains `applyUpgradeReroll(slot)`, which records the new card with `recordRunUpgradeOffer` so that `selected ≤ offered`.

**UI**
- **The strip.** A sibling `<button>` at the foot of each card, below the select button and never nested inside it. It is 36 px tall with a 44 px hit area, separated from the select button by an **8 px dead zone**.
- **Height budget.** +72 px on a portrait phone, +36 px in landscape and on desktop. It must fit **without scrolling** at 390×844, 414×896 and 896×414, checked with tap-geometry assertions in `visual:reboot`.
- **After use** the strip is disabled and reads "Re-roll used". Focus moves to the new card, a polite live region announces it, and the fade is skipped under reduced motion.
- **Controls.** Keyboard `R` (unbound today), and gamepad X on release.
- **Built (S1.3, build ledger slice 6).** Card 2 is drawn before card 1, so "your gun" holds whenever a candidate has a card, and card 1 is a general draw without it. The runtime passes the guns that have ammo on the offer's tick (`weaponIdsWithAmmo`). The strip's geometry is inline until the portal stylesheet owns it; its fit at 390×844, 414×896 and 896×414 is an integration check.

### 8.4 Evolutions: mastery plus a Genesis Seal

**Mastery**
- Finite guns: all 3 branches at rank 3.
- Special weapons: all 3 branches plus the capstone.
- Pistol: Damage, Movement Speed and Score & Magazine, each at rank 3.

**The Genesis Seal**
- **Source.** A runtime boss drop from `src/boss-drops.mjs`: one per boss id per run, on first defeat, at the arena's reward pedestal. It never expires and is collected by contact within 80, with no button. It is **not** an objective-reward placement.
- **Pedestal placement.** Inside the arena, reachable after the fight, on dry ground, and at least 120 from every objective reward.
- **Bank.** At most 4 banked.
- **Look.** A brass seal disc with an Ł relief and a cyan-glowing rim, distinct from Block Reward's gold-cornered cube.

**On pickup** (inside the tick). Let C be the evolution candidates: owned, mastered, not yet evolved. Non-Pistol guns come first (focus gun, then weapon order), and the Pistol last.

| C | Result |
|---|---|
| empty | the Seal is **banked**: "GENESIS SEAL BANKED: evolves the next gun you master" |
| exactly one non-Pistol gun | it **evolves at once**, with no panel |
| anything else (2 or more candidates, or the Pistol alone) | an **evolution panel**: the simulation freezes and the level-up shell opens with `kind: 'evolution'`. Cards are the first two entries of C, or "Bank the Seal" as the second. Re-rolls cycle C, then "Bank the Seal" |

- **Banked Seals.** When a level-up pick completes mastery of a non-Pistol gun while a Seal is banked, that gun evolves at once. **The Pistol never evolves automatically.**
- **No level-up cost.** Evolving never uses a pick.
- **Same tick.** If a Seal pickup and a level land on the same tick, the evolution offer opens first and the level offers chain after it.

**Communication**
- **Briefing line:** "Bosses drop Genesis Seals. A Seal evolves a gun you have mastered." (`level-briefing.mjs` and its test are updated.)
- **First drop:** a banner.
- **Card 2 details:** "Master it to evolve with a Genesis Seal".
- **Weapon wheel:** mastery pips, a gold ring on evolved guns, a seal pip with a count.
- **Pause build view:** evolution names shown as silhouettes until the gun is mastered.
- **Evolution moment:** the surge clip (gold burst until it exists), the banner "EVOLVED // DOUBLE SPEND", and the weapon-pickup sound.

### 8.5 Evolution roster

**Refactor first (S0.2 or S1.3)**
- `HMH_WEAPON_EVOLUTIONS` stays byte-identical. A child map `HMH_CHILD_EVOLUTIONS`, keyed by weapon id, adds `double-spend` and the wave-2 ids.
- **Tags become additive:** `projectileTag` keeps the special's tag, and a new `evolutionTag` field is added. The VFX reads both.
- **Boss penetration becomes a policy flag.** `deep-proof` sets `bossArmorPenetration: 0.6`, applied to any boss target, not only the id `boss-liquidator` (`main.mjs:3784`).
- `armorPiercing` is set by Settler Rail, retiring the dead tag check at `:3783`.
- The parent-owned `scoreMultiplier` stays unapplied.

**Tuning targets** (checked against the benchmark's `evolved` rows)
- Single target: at most 1.2 × the maxed Pistol, so ≤ 56.3 DPS.
- Packs: `output60` at least 1.25 × the same gun maxed.
- Evolved finite guns add ¼ of the grant to reserve every 900 ticks, up to the cap.

**Wave 1**

| Weapon | Evolution | Card text | Mechanics |
|---|---|---|---|
| Pistol | **Settler Rail** (`settler-rail`, `rail-dividend`). **Opt-in sidegrade only** | "Heavy slugs pierce 8 and ignore armor" | pierce 8 with falloff (exists) plus `armorPiercing`; burst off; round damage ×1.25 to start. Target: single target 0.80–0.95× the maxed Pistol, pack clear at least 30% faster |
| Shotgun | **Double Spend** (`double-spend`, new) | "Every shot fires a free second volley" | `weapon.pendingVolley = {fireTick: t+8}`: 50% pellet damage along the **current** aim, no ammo, ignoring fire input, clip and reload; `nextFireTick` unchanged; cancelled by a swap or fallback. Maxed single target ≈ 50.4 |
| Machine Gun | **Hashstorm Overdrive** (`hashstorm-overdrive`, `overdrive-barrage`) | "Overheat becomes a vent blast; hot barrels pierce" | no damage bonus. Shots at heat 60 or more get pierce 2, **stamped at fire**. At heat 100 it vents: a ring r140 (12 damage, 24 knockback, never the player), and heat is set to 60 and held for a 60-tick fire lock. About 36 DPS |
| Railgun | **Crit Candle** (`crit-candle`, `gold-crit`), display title **"Moonshot"** | "Crits light the whole rail line" | +15% crit chance (within the 45% cap). If the first body crits, every pierced body crits. Each crit kill takes 12 ticks off the next charge, at most 3 per shot, with a 36-tick floor. `deep-proof` is kept. Credited after kill resolution in *t*, applied from *t+1* |
| Launcher and hand grenades | **Crypto Bomb Orbit** (`crypto-bomb-orbit`, `orbit-bomb`) | "Blasts leave 3 orbiting bomblets" | 3 bomblets orbit at r100 for 45 ticks, at angle 2πk/3 + 2π(t−t0)/45. Each detonates on first contact or at the end: r64, 40% of the parent blast, never the player. Pool cap 12 (overflows counted). Contacts resolve bomblets by id, then enemies by id |

**Wave 2** (after their policy resolvers accept evolutions; they throw today at `weapon-system.mjs:361, 392, 422`)

| Weapon | Evolution | Effect |
|---|---|---|
| Arc Rifle | **Lightning Network** | every third pulse forks a second chain from the farthest target; chain cap +2 |
| Flamethrower | **Burn Address** | a burning enemy that dies detonates (r96, 14 damage, spreads burn), at most 3 per 60 ticks; scorch lasts 50% longer inside the existing cap |
| War Fork | **Chain Split** | each thrust also sends two shockwave lanes at ±12° (range 260, 60% damage, pierce 4) |

**Presentation**
- **No per-hero evolved pages.** One shared additive glint overlay atlas (8 directions) anchored at each frame's muzzle and grip points.
- Bomblets get their own feedback class inside `MAX_GRENADE_FX_EVENTS` (32) and `MAX_GRENADE_FX_PARTICLES` (64), with at most 4 bomblet bursts per tick and at most 2 bomblet cues per 6 ticks.

### 8.6 Balance fixes

| Priority | Fix |
|---|---|
| P0 | Wire the four trees and Magazine & Salvage |
| P0 | Pass Launcher damage, radius and shot count into `throwGrenade` |
| P0 | Railgun `chargeTicks` scaling and `capacitor-bank` |
| P0 | The timing fix |
| P1 | A cache selects its weapon only when it is newly owned (`main.mjs:3655`) |
| P1 | Extra Grenade raises the maximum (`maxHandCharges = 5 + rank`, plus the Keyring's +2) instead of overflowing it (`main.mjs:4870`, `grenades.mjs:103, 122`) |
| P1 | **Crits apply to held-weapon direct hits:** Arc Rifle pulses, flame contact, launcher blasts and the War Fork (`main.mjs:3963, 4000, 4041`). The always-on knife, hand grenades and burn ticks are excluded. Benchmark rows before and after; if a weapon exceeds its band, its crit contribution is halved (decision 12) |
| P1 | Every rank adds something: Arc Damage contact ×1.10 / 1.15 / 1.20; Burn Damage +1 direct at ranks 1 and 3 |
| P2 | **Nuke:** first confirm the whole-map behaviour in a test, then limit it to about 1,100 around the hero and exclude breakables, world destructibles, cages and boss-trigger props (`main.mjs:3548-3585, 3668-3686`) |
| P2 | Wording: "+25% score + Pistol Reload"; "+6% speed + Pistol Fire Rate"; "Piercing Rounds (replaces Ricochet)"; the Scrypt Cache gets a grenade icon |

### 8.7 What does not change

- Pistol numbers.
- The XP curve `150·L·(L+1)`, kill and combo XP, the enemy health ramp, director pacing and run length.
- Two cards per level-up, with no banish or skip.
- Silver is never sold for re-rolls.
- Movement speed stays uncapped.

**Measured side effects:** the re-roll speeds greedy Pistol maxing from about 24 to about 14.5 level-ups, and card 2 speeds mastery of a picked-up gun from about 30 to 9.

---

## 9. Build plan

### 9.1 Principles

- Every slice is its own candidate: RED tests first, the smallest coherent deterministic change, and fresh certification. That means:
  - same-seed and partition tests;
  - soak hash equality;
  - `syntax-check` registration;
  - JS deltas recorded (running total ≤ 0);
  - serial browser smokes, never parallel;
  - `visual:reboot` review for render changes;
  - XS Max no-p95-regression;
  - docs and the briefing in the same commit.
- Work goes on `reboot/hmh-aaa-continuous` or a branch from it. **No promotion without the owner's approval for that exact deployment.**
- Gameplay slices that need no new art come first. New combat content is built **dark** and promoted by its art slice.

### 9.2 Ordered slices

| # | Slice | Depends on | Live? |
|---|---|---|---|
| **Stage 0: Decisions and foundations (no gameplay change)** | | | |
| S0.1 | Owner decision pass (section 10). Draft the **parent packet** (9.4) | – | docs |
| S0.2 | **Runtime foundations.** Enemy display pooling and incremental `resetEnemyMarkers`; per-actor texture cache; tick-only corpse clock; `autoGarbageCollect = false`; projection-observer hook; **offers and forced level-ups open inside their tick** (catch-up stops on modal events); `HMH_WEAPON_ORDER` into the simulation; evolution tag refactor; legacy evolution system fenced or retired; **bundle offsets**: the level-up panel moves to a lazy `upgrade-panel.mjs`, catalogue text to `progression-content.mjs`, and the world-design, objective and boss modules become awaited dynamic imports. **Owner:** physical XS Max baseline | – | yes (no behaviour change except the offer tick) |
| S0.3 | **Measurement.** Progression harness `scripts/hmh-progression-model.mjs` (XP income, the offer algorithm, the ammo economy, 3 pick policies, a survival proxy), with the 1.8.1 baseline committed; benchmark `output60` plus Railgun and held-weapon crit rows; the **referenceDps(level) calibration**; the layout checker on the real navgrid in `npm test`; density v2; the decoded-memory gate | – | tools |
| S0.4 | **Art pipeline spikes** (parallel). KTX2 go/no-go; phone-tier captures; 8 against 16 aim directions; one enemy re-measured at 35°; bake timing; CPU and GPU residency; the animation-source pilot (4 clips); rig v2 template and scripts in the release repo; manifest-driven roster scripts; `BLENDER_EXECUTABLE` | – | no runtime change |
| **Stage 1: Gameplay on today's map and art (ships live)** | | | |
| S1.1 | Death camera (plus the parent results delay), weapon hidden on death, **manual dodge (Shift)** | S0.2 | yes (lifecycle certification) |
| S1.2 | **Enemy AI kit and core-six AI** (5.2, 6): flags, poise, LOS gate, clearance layers, forced motion, swept pressure, leash and recycle, the new geometries with telegraphs and auto-dodge shapes, director flavour weights, seeded lairs, the one-front rule, the Whale's Shoulder Rush, the Agent's burst, the Validator fixes | S0.2 | yes |
| S1.3 | **Progression release**: re-roll, card 2, 12 branch cards with Magazine & Salvage, Launcher wiring, Railgun fixes, balance fixes (the nuke after its confirming test), cue removal. **One determinism bump**; harness evidence within the +10% survival band (otherwise apply the fallback) | S0.2, S0.3, packet | yes |
| S1.4 | **Mission core v2** on today's six sites: quick, channel and seal modes; operate spots; docking; weapon stow and fire suspension; hit pause; one active zone; tracker pill and chevron; field-map discovery; the palette test; the audio ruling; secrets table; breakable targeting and nuke exclusion. Placeholder gesture: grenade reach | S0.2 | yes |
| S1.5 | **Boss kit and the reworked Liquidator** (MVP boss 1): registry, triggers, locks with nav close, the geometry kit, walk-budget tests, the leash, HP halts, the HP formula, readiness, retreat, the director overlay, the HUD name, the damage-bound fix, armour into state; the Closing Bell and the Dark Pool on the shipped-map fallback; the `yard` entry moved. **The 72,000-tick timer is removed.** Runs on the current Liquidator atlas | S1.2, S1.4, **packet with the verifier shipped first** (or the interim: ready at 72,000) | yes |
| S1.6 | **Prisoners**: deal, stations, guard crews, the capacity bank, OG Miner level span (interim: a power-up). Placeholder cages at interim anchors | S1.4, packet | dark until S4.6, unless the owner accepts placeholders |
| S1.7 | **Genesis Seal and wave-1 evolutions** (Double Spend, Hashstorm, Crit Candle, Bomb Orbit, Settler Rail opt-in); the evolution panel; the pedestal; the glint overlay as a placeholder | S1.3, S1.5, packet | yes (the Liquidator is the first Seal source) |
| **Stage 2: Layout v2 (dark pilot `layoutV2`, `evidenceSafe`-gated like the other pilots, `main.mjs:1206-1226`)** | | | |
| S2.0 | Greybox terrain kit: mass edge strips, chasm faces, flush decks, road tiles; re-run the sketch with the 2.2 changes | S0.3 | dark |
| S2.1 | Relay and Crossing: generator and barn, uplink, P1, S1; mill valve and haven, Old Mill Bridge, the Proof-of-Work deck, trestle, **Toll Lock as a champion arena**, P3, S3 | S2.0, S1.4 | dark |
| S2.2 | Yard: the Margin Floor, bell alcove, Dark Pool at the layout v2 position, warehouse, bascule, port, P6. The Liquidator moves from the fallback | S2.0, S1.5 | dark |
| S2.3 | Ravine: **Quarry Bowl as a champion arena**, rope bridge and Winch Handle, Diggings, P2, S2, the dwellings strongbox | S2.0 | dark |
| S2.4 | Hashwood: Lamp Oil, log chute, Beacon, Lookout, Sanctuary, Hollow Grove ambush, P4, S4 | S2.0 | dark |
| S2.5 | Mining: **Headframe Pit as a champion arena**, Hoist Vault, steam valve, P5, S5 | S2.0 | dark |
| S2.6 | **Promote layout v2** in one release: all six districts pass the 2.9 gates. Where a boss is not yet promoted, its arena runs as a **champion arena** (a capacity-banked elite wave with the same trigger, lock, perk, section and prisoner, but no boss kill and no Seal) | S2.1–S2.5, S1.4–S1.6 | yes |
| **Stage 3: New combat content, logic first (built dark, promoted by art)** | | | |
| S3.1 | Rug Pull Baron logic (greybox proxy), with drift fields and the knock-down stagger | S1.5, S2.3 | dark |
| S3.2 | 51% Foreman logic: rigs, scald, consensus, charges | S1.5, S2.5 | dark |
| S3.3 | Lockkeeper logic: boss-owned charges, tide bands, the swap, the Lock Gate reward | S1.5, S2.1 | dark |
| S3.4 | New enemies, one slice each in priority order: Rug Puller → Bloater → Tollkeeper → Revenant → **Money Printer** (with `hostile-projectiles.mjs`) → Oracle Marksman (perches) | S1.2; homes after S2.6 | dark |
| **Stage 4: Art (co-design → Tripo → Blender → deterministic exporter; each promotion is a projection swap plus certification)** | | | |
| S4.0 | **Co-design pack 1** (owner): the style ruling, accent table, tier-1 concept sheets (Appendix A) | S0.1 | – |
| S4.1 | Hero rig v2 and Anim v2 **Commando**: core and pistol set, interaction clips, dash, grenade, knife and bash, heavy hits, v2 death; runtime schema, resolver and residency | S0.4, S1.1, S1.4 | yes |
| S4.2 | Commando's remaining 7 weapon sets and 3 stance sets; the 8 held weapon models | S4.1 | yes |
| S4.3 | **Liquidator art**: a new human rig, three phase dressings, the Blender arena kit | S4.0, S1.5 | yes |
| S4.4 | **Baron art** → promotes S3.1 (replacing the Ravine champion arena) | S3.1 | yes |
| S4.5 | New enemies art, in priority order → promotes S3.4 one by one. The enemy mobile tier, residency and decoded gate come first (5.10) | S3.4 | yes, per enemy |
| S4.6 | Prisoners (4), cages (6), mission kit (gates, levers, valves, cranks, brazier, bell, capstan, strongbox), beacons | S4.0, S1.6 | yes |
| S4.7 | **Foreman art** → S3.2; **Lockkeeper art** → S3.3 | S3.2, S3.3 | yes |
| S4.8 | Core six: re-render at 35° with the new template (Bagholder first); re-models of the Forkrunner, Whale and Gas Bomber | S0.4 | yes, per enemy |
| S4.9 | World kits: bridge kit (8 crossings), landmarks, final mass edges, terrain tiles | S2.6 | yes, per pass |
| S4.10 | Valkyrie, Lester and Lilly (one slice each); Genesis Seal relic; evolution glints; wave-2 evolutions; polish clips (turns, personal idles, surge) | S4.2, S1.7 | yes |
| S4.11 | **Physical XS Max acceptance** at each promotion (owner) | all | – |

**MVP milestones**
- **M1:** S0.2–S1.5. The Liquidator timer is gone, the objectives are automatic, and dodge and the death camera work.
- **M2:** M1 plus S1.3 and S1.7. Re-roll, gun trees and evolutions.
- **M3:** S2.6 plus S4.3 and S4.4. The new map, two real bosses (meeting the owner's minimum) and two champion arenas.
- **M4:** all four bosses and the first four new enemies.

### 9.3 Tripo credit estimate (image-to-model about 40 credits per generation; 6,040 available)

| Tier | Models | Unique | Planning factor | Generations | Credits |
|---|---|---|---|---|---|
| 1 | Characters: Liquidator, Baron, Rug Puller, Bloater, Tollkeeper, Revenant, 4 prisoners | 10 | ×2 | 20 | 800 |
| 1 | Props: gavel, money sack, vault door, barrier arm, Genesis Seal | 5 | ×1.5 | 8 | 320 |
| 2 | Characters: Foreman, Lockkeeper, Money Printer, Marksman; Forkrunner, Whale and Gas Bomber re-models | 7 | ×2 | 14 | 560 |
| 2 | Props: L-key, padlock charge, sniper rifle | 3 | ×1.5 | 5 | 200 |
| 3 | Held weapons (8), cages (6), organic or unique landmarks (forked spire, beacon tree, relay tower, liquidation tower, toll house; 5), hero mechanism props (Closing Bell, Lock Windlass capstan, strongbox; 3) | 22 | ×1.5 | 33 | 1,320 |
| **Total** | | **47** | | **80** | **3,200** |

- **Minimum** (one generation each): 47 × 40 = **1,880**.
- **Reserve after the plan:** 6,040 − 3,200 = **2,840** (about 71 generations). It covers:
  - owner-requested redesigns;
  - optional hero regeneration (4 × 2 = 8 generations, 320);
  - an optional Agent re-model (80);
  - a reserve Hashwood fifth boss (about 4 generations, 160).
- **Not Tripo** (Blender): bridge and mass-edge kits, arena kits, mechanisms with moving parts, rug and carpet decals, boss phase variants (accessory swaps), VFX, and the rebuild of weapon moving parts.
- **Assumption:** 40 credits per generation including textures. HD-texture, retopology or Tripo animation add-ons would be extra and need a quote first.

### 9.4 Parent packet (one approval; the verifier ships first, then the child)

| Area | Change |
|---|---|
| **Schema 7** | `validateRunSummaryPayload` accepts versions 1–7. The current catalogues are frozen as `HMH_RUN_SUMMARY_CATALOGS_V6`, and `rows()` validates each version against its own catalogues. **A 30-day v6 grace window** for children cached by the service worker |
| New rows | `objectives {objectiveIndex, tick, levelAtCompletion}`; `prisoners {slotIndex, tick}`; `bosses {bossIndex, firstInitiatedTick, lastInitiatedTick, initiations, defeatedTick}`; `evolutions {evolutionId, offered, applied}` over 8 ids; `progression {ruleset, offersOpened, rerolls, sealsFound, sealsBanked, evolutionsApplied, revivesUsed}` |
| Catalogue appends | 12 upgrade ids; `genesis-seal`; 6 enemy roles plus 3 boss roles; new `worldSites` (uplink, barn doors, log pile, beacon, lookout, bascule, 5 boss triggers); secrets S3–S5; a prisoners catalogue |
| Verifier (`server/verify/hmh-plausibility.mjs`) | **Bosses:** `HMH_BOSS_START_TICK` and `boss-before-band` are deleted; per boss, `firstInitiatedTick ≥ readyTick` and `defeatedTick − lastInitiatedTick ≥ minFight` (from HP scale over a DPS ceiling); at most one kill per boss id, 4 in total, one Liquidator; per-boss threat, XP and add capacity. **Objective XP** becomes a **sum**: Σ k × 300 × levelAtCompletion × maxXpMultiplier, plus OG Miner spans. **Silver** from secrets and bosses joins the score ceiling. **Prisoner deal** recomputed from the seed (at most 8, no duplicates, types consistent with XP). **Level entry** recomputed from the new 5-entry table. **Upgrades:** `offersOpened ≤ level − 1`; `rerolls ≤ 2 × (offers + evolution offers)`; `offered ≤ 2 × offersOpened + rerolls`; `evolutionsApplied ≤ sealsFound ≤ boss kills` |
| Other parent files | `stats.mjs`: `genesis-seal` in `NOT_POWER_UPS`, and the boss id. Achievements `beat-level-1-boss` and `getaway-clear` mean the Liquidator specifically. The legacy evolution map is fenced |
| Unchanged | save schema 2, `hmh-bridge/v1` (the `boss-defeated` event stays generic), the 65,536-byte message limit (a size test is added), `SETTLEMENT_LIVE=false` |
| Ranked | A ruleset field and a season boundary at the release carrying S1.3 and S1.5 (decision 2) |

**Interim, only if approval slips.** It is verifier-safe:
- B1–B3 run as champion arenas;
- the Liquidator becomes ready at tick 72,000;
- the OG Miner gives a power-up;
- nodes grant no XP and no silver;
- uncatalogued milestones are guarded;
- scripted spawns go through the capacity bank;
- evolutions wait.

---

## 10. Decisions needed from the owner

Each item has a recommended default.

1. **Parent packet.** Approve the one SDK, verifier and summary packet in 9.4 (schema 7, per-boss rules, objective XP sum, silver grants, 12 upgrade ids, evolutions, Genesis Seal, the new entry table), with the verifier shipped first. *Default: approve. Use the interim only if approval slips.*
2. **Ranked boundary.** Start a new season or ruleset boundary at the release that changes progression and bosses, with a 30-day grace window for v6 summaries. *Default: yes.*
3. **Interaction rule.** Channel interactions (crank, valve, kneel, boss seals) stow the weapon, pause auto-fire and the knife, dock the hands onto the prop, and hold progress when you leave or are hit. Quick buttons and levers never stop you. *Default: yes. The alternative, keep firing with off-hand gestures, costs about 8× the clip frames.*
4. **Boss access.** Ready at 2:00 / 5:00 / 7:30 / 10:00; HP frozen from your level at the start; the Liquidator needs no seal gate; a retreat ring after 10 s of fighting (the boss resets and gives no reward). *Default: yes to all four.*
5. **Boss rewards.** Baron's Signet (silver magnet), Lockkeeper's Keyring (+2 grenades), Overtime (+12% damage), the Liquidator Vault. The Dark Pool bonus is a one-time Golden Parachute revive at 50% HP. *Default: approve; the alternative Dark Pool bonus is a 1.5-level XP bounty.*
6. **Map bounding.** Bounded districts cut the reachable share from about 79% to about 57% on the same 12,000 × 4,800 map. *Default: accept, and thin the Hashwood and Ravine masses by up to about 10 points if playtests feel cramped.*
7. **Hashwood.** No boss now; the Beacon gives +20 max HP; a reserve fifth boss later if performance allows. *Default: yes.*
8. **New enemies.** Ship the Rug Puller, Bloater, Tollkeeper and Revenant first, then the Money Printer and Oracle Marksman. The Rug Pullers are the Baron's crew. No Revenant silver drop. *Default: yes.*
9. **Prisoners.** 8 prisoners (two each of Field Medic, Quartermaster, Pawnbroker, OG Miner), types dealt by the run seed, the OG Miner shown as a prospector. Do prisoners go live with placeholder cages or wait for art? *Default: yes to the roster; wait for art.*
10. **Level-up.** Two cards: card 1 is general, card 2 is "your gun" (never the Pistol). One re-roll per card per level via a 36 px strip (+72 px on a portrait phone). Automatic fallback to card 2 every second level if the harness shows more than +10% survival. *Default: yes.*
11. **Evolutions.** Mastery plus a Genesis Seal (a boss drop that evolves a mastered gun on pickup, or banks), named "Genesis Seal". The Pistol's Settler Rail is an opt-in sidegrade only. *Default: yes.*
12. **Balance.** Crits extend to Arc, flame contact, launcher and War Fork direct hits (not the knife or hand grenades). The nuke is limited to about 1,100 units and excludes secrets and destructibles, after a confirming test. Caches select a weapon only when it is newly owned. *Default: yes.*
13. **Audio.** Strictly the owner's list. Remove the level-up chime, objective chime, tell audio, reload-complete cue and arena-change sound. Health and ammo pickup cues are also silent. *Default: strict. Say if heal and ammo cues should stay as "pickups".*
14. **Style target.** Stylised-realistic PBR matching the four approved heroes. Hades is the bar for readability, lighting and composition, not a painterly surface. All actors render at the 35° hero camera with the shared light rig. *Default: yes.*
15. **Accents.** The Baron drops the magenta glow (the Bloater keeps `#ff3df2`). The Lockkeeper's pips are white-hot on red rings. Boss triggers are bone-white, never red. *Default: approve the table in Appendix A.3.*
16. **Core-six re-models.** Re-model the Forkrunner; re-model the Whale Enforcer and Gas Bomber as humans (rather than switching their game identity to zombie). The Agent is re-modelled only if it reads as Commando at 35°. *Default: yes.*
17. **Co-design order and names.** First concept sheets: Liquidator, Rug Puller, Baron, Bloater, prisoners and cages, Tollkeeper, Revenant. Names: Rug Pull Baron, The Lockkeeper, The 51% Foreman, Closing Bell, Dark Pool, Genesis Seal, "Repo Office" (the yard POI). *Default: approve.*
18. **Animation source.** Library or mocap (Mixamo via your Adobe account, or a licensed pack) for locomotion, deaths, kneel, lever and button. A contracted human animator for reloads, equips and weapon poses, at least for the Commando pilot. *Default: yes.*
19. **Texture format and tiers.** Approve the KTX2 go/no-go spike (0.75F desktop if it fails). Pick the phone tier (0.5F or 0.625F) from side-by-side captures. 8 aim directions unless the 16-direction capture clearly wins (+90 / +23 MiB). *Default: approve the spike; 8 directions.*
20. **Manual dodge.** Left Shift; automatic dodge off while the keyboard is in use; the same 600/480/360 cooldown and i-frames as automatic dodge. *Default: yes.*
21. **Death camera.** Keep drawing for about 1.2 s after death, with the portal delaying its results screen by the same amount. Score submission is unchanged. *Default: yes.*
22. **Storage and download caps.** An external SHA-pinned artifact store for generated atlases (masters only in LFS). KTX2 or lossy WebP to fit the 8 MiB selected-hero cap rather than raising it. *Default: yes.*
23. **JS budget.** If the lazy-loading offsets cannot keep initial JS net ≤ 0, cut or defer scope before raising the cap. *Default: defer scope; raise the cap only with measured evidence and a named amount.*
24. **Hero meshes and exporter.** Keep the approved meshes with a mitten finger curl (no regeneration). Approve Anim v2 as an extension of the deterministic exporter, with its scripts in the release repo. *Default: yes.*
25. **Physical device.** Run the iPhone XS Max acceptance pass at each promotion, because emulation already misses 30 fps. *Default: yes; the owner performs it.*

---

## Appendix A. Concept prompt kit (for owner co-design before any Tripo spend)

### A.1 Shared blocks (prepend or append to every prompt)

**Character style block.** "Stylised-realistic AAA 3D game character asset render for image-to-3D modelling. Single character, full body from head to boots, neutral three-quarter front view, relaxed A-pose with arms held slightly away from the body, hands open and empty. Plain light-to-mid grey background, flat neutral studio lighting, no cast shadows. Worn PBR materials. Mostly dark, desaturated colours with a lighter top plane on the head and shoulders; one accent colour under 8% of the figure. Compact, readable silhouette with clearly separable limbs; grounded human anatomy with slightly heroic chunkiness in the hands and boots. No text, no logo."

**Prop style block.** "Same style and lighting; front, side and top views in one row at the same scale; plain light-grey background; no text."

**Shared negative.** "animal, creature, robot, drone, mech, exosuit, power armour, vehicle, pixel art, anime, low-poly, flat cel shading, photograph, text, logo, motion blur, cropped feet, cast shadow, busy background, long teal hair, teal coat, blue sphere head, red neckerchief with black mullet, blonde hair with red headband."

### A.2 Subjects

**Tier 1**

- **The Liquidator.** "A towering HUMAN corporate executive-auctioneer about 2.4 m tall: very broad squared shoulders, big black-gloved hands, heavy polished black boots. Stern face: slicked-back silver hair, hard square jaw, grey stubble, gold-rimmed tinted glasses. A gold spiked market crown whose band is a thin red LED stock-ticker strip. Knee-length charcoal pinstripe double-breasted greatcoat with a blood-red lining (no cape), black waistcoat, crisp pale shirt collar, long blood-red silk tie with a gold bar, a riveted gunmetal plate between the lapels, gold epaulette plates. Scuffed wool, brushed gunmetal, tarnished gold, grime at cuffs and hem. Accent #ff496c only on the crown ticker. The crown and broad epaulettes read from directly above."
  - *Negative:* zombie, shoulder cannons.
  - *Phase variants (same framing):* Margin Call: coat removed, sleeves rolled, gold spiked margin plates on the epaulettes, ticker glowing #ffc857. Total Liquidation: tie torn loose, crown cracked, violet #e26dff halo of burning ticker tape.
  - *Prop:* "a huge brass-and-steel sledgehammer gavel as long as a man's leg, with a riveted auctioneer's-gavel head, a small inset red ticker screen and a leather-wrapped grip."
- **The Rug Pull Baron.** "A portly HUMAN carnival con man and frontier land baron about 2.1 m, pear-shaped on thin legs, chunky hands in worn leather gloves. An enormous wide-brim black gambler's hat whose brim is clearly wider than his shoulders, with an oxblood band and one hammered gold coin pinned to it. Waxed handlebar moustache, one gold tooth, sly grin, sun-creased face. A tightly rolled oxblood-and-gold Persian carpet with gold tassels strapped diagonally across his back like a bedroll. Brocade waistcoat in oxblood and gold over a stained cream shirt with rolled sleeves, gold-coin watch-chain, short black cutaway jacket cut at the hips (no tails, no cape), black-and-grey striped trousers, dirty white spats over scuffed brown boots. Nothing glows."
  - *Negative:* zombie, long cape, magenta glow.
  - *Props:* a fat burlap money sack tied with gold cord, bulging with coins; a large gold gambler's coin, one face a crowned head and the other a coiled rug (front and back).
  - *Phase variant:* hat brim dented and ripped, jacket torn at the shoulder, no carpet on his back.
- **Rug Puller.** "A wiry, sly HUMAN frontier con man about 1.75 m with a readable living face: slicked dark hair under a flat newsboy cap, pencil moustache, one gold tooth, ingratiating grin. Cropped dusty-brown suede jacket ending at the waist, loud paisley waistcoat, bootlace string tie, sleeve garters, rope belt with tarnished brass carabiners, leather gloves with small metal hook tips, sun-faded canvas trousers, cracked lace-up boots. Slung horizontally across the back of both shoulders like a yoke, a heavy rolled Persian-style carpet about 1.2 m long reaching well past each shoulder; its ends show a deep crimson and cream pattern with a saffron #ffb000 border and frayed tassels (the only saturated colour). Red canyon dust."
  - *Negative:* long coat, black mullet, blonde hair.
  - *Prop:* the same carpet rolled (three-quarter view) and laid flat (from directly above).
- **Pump-and-Dump Bloater.** "A grotesquely bloated ZOMBIE: an undead adult human about 1.7 m tall and nearly as wide. Pallid, bruised grey-green skin, slack jaw, blank clouded eyes, a small head sunk into fat rounded shoulders. An enormous distended round belly carried in front makes up most of the figure; its stretched skin is veined and semi-translucent with a hot fiat-magenta #ff3df2 glow showing through, and a crust of glowing magenta boils covers the upper back and shoulders. Torn too-small grey T-shirt with a faded rising candlestick-chart print, straining frayed suspenders, torn grey knit beanie, broken tarnished gold chain, burst house slippers on swollen ankles. Arms and legs clearly separated from the belly."
  - *Negative:* monster anatomy, tentacles, extra limbs, extra mouths, gore overload, green glow, magenta hoodie, red satchel.
- **Tollkeeper.** "A broad, heavy-set HUMAN bridge tollkeeper about 1.85 m with a jowly, stubbled middle-aged face, thick grey moustache, a scar through one eyebrow and a stern scowl. Peaked toll-collector cap with a small white strobe beacon lamp on the crown; long, water-stained dark-navy greatcoat with tarnished brass buttons; riveted steel gorget; thick leather gauntlets; duty belt with a coin pouch and a big ring of keys; heavy steel-toe boots. Wet wool, scuffed leather, riveted gunmetal, river grime. Strobe-white #f4f7ff accent on the cap lamp only."
  - *Negative:* gold shoulder plates.
  - *Props:* (1) a round steel bank vault door about 1 m across used as a body-height shield, with a light-steel face, spoked brass wheel handle, heavy rim bolts, a combination dial with a small white strobe lamp, black-and-white hazard chevrons around the rim, dents, water stains and a forearm strap on the back; (2) a sawn-off toll-barrier boom arm about 1.3 m long in black-and-white stripes, with a torn hinge bracket at the grip end and a round red reflector at the tip.
- **HODL Revenant.** "A gaunt, tall ZOMBIE miner about 1.85 m: pallid grey-green skin, hollow cheeks, faintly glowing sunken eyes. Dented brass miner's helmet with a cracked lamp; torn heavy grey wool mining coat; rusty padlocked chains over both shoulders and across the chest; a small iron strongbox chained to the belt; ragged trousers with wrapped shins; cracked boots. Both fists encased in massive chunks of raw, pale, cloudy diamond ore, each as big as his head, lashed on with rusty wire and chain like improvised gauntlets; the ore cores hold a deep ruby #e0115f glow. The ore is clearly strapped-on gear, not grown from the body, and the pale ore is the brightest shape."
  - *Negative:* golem, rock monster, crystals growing from skin, hood, staff.
- **Field Medic** (prisoner). "A tired HUMAN frontier field medic about 1.7 m with a kind, readable face; a white bandage wrapped around the head over short dark hair; a large canvas shoulder satchel with a green cross patch #45ff8a (the only accent); rolled sleeves; a stained canvas apron; sturdy boots."
- **Quartermaster** (prisoner). "A stocky HUMAN quartermaster about 1.75 m with a broad, weathered face and a short beard; olive field cap; two crossed canvas ammunition bandoliers; a small wooden ammo crate strapped on the back with a cyan #19f7ff stencil stripe on the lid (the only accent); work trousers; boots."
- **Pawnbroker** (prisoner). "A thin HUMAN pawnbroker about 1.75 m with a narrow, clever face; brass loupe goggles pushed up on the brow; a long plain charcoal pinstripe waistcoat over a collarless shirt; strings of relic trinkets, old keys and coins around the neck with small Litecoin-blue #6f9bff glass beads (the only accent); no cap."
  - *Negative:* paisley, rolled rug.
- **OG Miner** (prisoner). "An elderly HUMAN prospector about 1.7 m with a long silver beard and a warm, lined face; a wide-brim slouch prospector's hat (no helmet, no head lamp); a patched flannel shirt; suspenders; a gold pan and a short pick strapped on the back; a small gold #ffe84d Ł-stamped coin pendant (the only accent)."
- **Genesis Seal** (prop). "A palm-sized brass seal disc with a raised Ł relief, fine milled edge and a cyan-glowing rim, worn and ancient; front, side and top views."

**Tier 2**

- **The 51% Foreman.** "An undead HUMAN mine foreman ZOMBIE, a hulking hunched giant about 2.6 m with over-muscled shoulders, a thick neck, huge forearms. Left hand open in a heavy work glove. Pallid grey-green skin cracked by thin ore-amber mineral veins; dead clouded eyes; readable face, slack jaw, thick grey moustache. Dented yellow hard hat with one oversized round brass headlamp, brass goggles pushed up on the brim. One tall riveted brass pressure tank strapped upright on his back with a round gauge; a rubber hose runs over the right shoulder to a pneumatic rock-drill gauntlet sheathing the right forearm, the right hand visibly gripping its inner handle. Torn soot-black overalls with one strap, scarred rubber apron, a ring of large brass shaft keys, steel-toe boots. Accent #f0ae4c only in the headlamp and veins. The hat, lamp and upright tank read from above."
  - *Negative:* monster, tentacles, mech arm replacing the limb, full-body exosuit.
  - *Phase 3 variant:* tank ruptured and peeled open with steam, hat cracked, lamp burning red #ff476f, veins blazing amber.
- **The Lockkeeper.** "A hulking, barrel-chested HUMAN canal lockkeeper about 2.3 m with short thick legs and huge work-gloved hands. Bushy grey beard, wind-reddened weathered face, a brass-rimmed black peaked lockkeeper's cap. Black oilskin coat with the sleeves rolled over a cream cable-knit fisherman's sweater; black oilskin chest waders; heavy rubber boots; a coil of iron chain at the hip; a thick leather bandolier with six brass padlocks, each with a small round signal lamp. Cracked oilskin, wet wool, rusted iron, river grime. Accent #ff476f only in the padlock lamps. The cap and broad shoulders read from above."
  - *Negative:* zombie, diving suit, helmet, gas mask, orange clothing.
  - *Props:* a giant cast-iron L-shaped lock-gate windlass key as tall as a man (square socket at the short end, chipped black paint, rust, worn wooden grip); a fist-sized brass padlock charge with a small signal lamp and a fuse stub.
  - *Phase variant:* soaked to the chest, cap pushed back, coat torn open, most padlocks gone.
- **Money Printer.** "A portly, middle-aged HUMAN central-bank clerk about 1.75 m with a flushed, tired face, round wire spectacles and a black celluloid eyeshade. Rolled-up dirty white shirt sleeves with black garters, buttoned grey waistcoat, ink-stained canvas apron stuffed with bundles of grey banknotes, heavy black work boots. Strapped to his back with a leather harness, a squat, square cast-iron hand-cranked printing press as big as his torso, with a large spoked crank wheel on its right side and a spool feeding an arc of paper ribbon over his shoulder into a short brass chute on his left shoulder; the chute mouth glows a fresh-print yellow-white #ffe23a. The white shirt gives a light top plane."
  - *Negative:* legible currency, green banknotes, green glow, orange hood, gas canisters.
- **Oracle Marksman.** "A tall, thin HUMAN frontier sharpshooter about 1.9 m with a narrow, pale, unshaven face half-hidden in a deep hood; a large brass monocle-scope strapped over the right eye with a glowing laser-red #ff1f1f lens. Long dark-grey hooded duster whose hood and shoulders are draped with many short strips of shredded grey paper ticker tape like a ghillie cape (short strips only); a slim backpack with a tall telescoping radio antenna topped by a small red beacon; knee pads, fingerless gloves, soft-soled boots."
  - *Negative:* magenta visor, black suit.
  - *Prop:* a bolt-action anti-materiel sniper rifle as long as a man is tall, with a folding bipod, a large scope, a small laser module, worn gunmetal and olive-drab wood (side and three-quarter views).
- **Core re-models.** Written after the S4.8 re-render review.
  - Forkrunner: a low-sprint raider with short hair and a cropped jacket, **no teal**.
  - Whale Enforcer: a living heavy with gold shoulder plates and a hexagon mass.
  - Gas Bomber: a living bomber with twin canisters and a blast hood.

**Tier 3**
- Cages: see 3.5.
- Weapons: the owner's weapon sheets.
- Landmarks: forked spire, beacon tree, relay tower, liquidation tower, toll house.
- Mechanism hero props: bell, capstan, strongbox.

### A.3 Accent allocation (silhouettes carry identity; accents confirm it)

| Actor | Accent | Note |
|---|---|---|
| Liquidator | `#ff496c` / `#ffc857` / `#e26dff` by phase | bosses never share the screen |
| Baron | none (oxblood and gold material) | frees magenta for the Bloater |
| Lockkeeper | `#ff476f` lamps; white-hot pips on danger rings | pips must read against the red fill |
| Foreman | `#f0ae4c`; phase 3 `#ff476f` | – |
| Rug Puller | `#ffb000` | pattern, not glow; near the Whale's `#ffc857`, but a different silhouette |
| Bloater | `#ff3df2` | the danger glow matches its pools |
| Tollkeeper | `#f4f7ff` | strobe lamps only |
| Revenant | `#e0115f` | near the rusher `#ff5c7a`, but a different silhouette |
| Money Printer | `#ffe23a` | bricks are rectangular; the XP gold `#ffe84d` is on round, static things |
| Marksman | `#ff1f1f` | a thin beam, not a fill |
| Objective colours | ivory `#fff4d6`, boss-trigger bone `#f2ead8` on `#241a33`, prisoner lanterns as in 3.3 | ΔE ≥ 25 from the telegraph colours (tested) |

## Appendix B. Evidence and source files

- **Layout.** `design/proposal-layout-v2.mjs` runs in about 8 s. Its output is `design/proposal-map-v2.txt`: all 5 arena locks seal; minimum lair distance 711; zero sanctuaries; 97% two-lair coverage; seams 950/1,400/1,100/1,550/850; z span 0–24. Earlier sketches are `proposal-layout.mjs` and `patch_v2*.py`.
- **Today's world.** `design/density.mjs`, `map-audit.mjs`, `audit.json`, `seams.mjs`, `sight.mjs`, `paths.mjs`.
- **Bosses and enemies.** `design/probe-enemy-boss.mjs` and `arena-probe*.mjs`. The whole-map boss-damage probe: 184 damage at 6,000 units against 130 inside the arena.
- **Animation budget.** `design/anim-budget-v2.py` and `anim-budget-v2-output.txt`.
- **Progression draw model.** `design/mastery-draw-model-v2.mjs`.
- **Reference captures.** `design/*-top.png`, `enemies-*-idle.png`, `heroes-idle.png`, `props-*.png`, `terrain.png`, `world-design.png`.
- **Source checks for this package** (read-only, `60ea173a`):
  - `objective-rewards.mjs:9-18`: 8 reward rows. Shotgun at Silver Reserve (340, 3,310); Railgun at Quarry Salvage.
  - `authored-prop-layout.mjs:692-703`: POI assets. ravine-salvage is a Shotgun, crossing-bank-cache a Railgun, yard-extraction-console the Launcher.
  - `forked-standard-event.mjs`: the War Fork cache.
  - `main.mjs:306`: `WEAPON_ORDER`.
