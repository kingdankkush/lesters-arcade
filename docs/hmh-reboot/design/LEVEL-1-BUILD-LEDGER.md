# Level 1 build ledger (branch `fable/hmh-gameplay`)

The running record the design package asks every slice to keep (section 1.3, "Budgets", and 9.1): the initial-JS delta, determinism changes, and the requests this branch leaves for the parent. Package: `LEVEL-1-DESIGN-PACKAGE-20260925.md`. Run summary contract: `HMH-RUN-SUMMARY-V7-CONTRACT.md`.

## Initial-JS budget

The cap is 1,048,576 B for the HMH child's entry + Pixi vendor + every chunk `game.js` imports statically (`scripts/hmh-reboot-bundle-budget.mjs`, printed by `npm run build` as "HMH initial JS + shared"). Dynamic `import()` chunks do not count. The running total must stay at or below the cap after every slice.

| Slice | Initial JS + shared (B) | Delta (B) | Headroom (B) | Notes |
|---|---|---|---|---|
| Base: `f9d6daa1` (1.8.1 + verifier v7) | 1,046,761 | – | 1,815 | |
| 1. Foundations: bundle offsets | 1,008,196 | −38,565 | 40,380 | Level-up panel, card text, boss, world-design objectives, world-design life, pacing, native world assets and the briefing become awaited dynamic imports |
| 1. Foundations: offer inside its tick, projection observer | 1,008,613 | +417 | 39,963 | |
| 1. Foundations: `HMH_WEAPON_ORDER` in the simulation, evolution tag refactor | 1,009,713 | +1,100 | 38,863 | `HMH_CHILD_EVOLUTIONS`, additive tags, armour flags |
| 2. Progression harness | 1,009,713 | 0 | 38,863 | Tools and docs only. `boss-reference-dps.mjs` is new but nothing in the child imports it yet |
| 3. Death camera and manual dodge | 1,014,069 | +4,356 | 34,507 | `dodge-intent.mjs` and `death-camera.mjs` are simulation and run-end code, so both are static. The rest is the `dodge` action row, the input edge, dash truncation and the `main.mjs` wiring (+12 B of it hides the aim reticle and the rail charge line in the death clip) |
| 4. Mission core v2 | 1,015,534 | +1,465 | 33,042 | `mission-objectives.mjs` (and through it the v7 contract and schema), `mission-guidance.mjs` and `mission-palette.mjs` are lazy. The initial path pays for the `main.mjs` wiring (mission step, dock glide, stow, grants, breakable helpers), the aim fallback, the weapon stow and the Arc Rifle refill guard, and the operate spots in the site table; the secret state that moved out of `world-design-secrets.mjs` gives a little back |
| 5. Boss kit and the reworked Liquidator | 1,020,493 | +4,934 | 28,083 | Against 1,015,559 after slice 4's tracker fix. `boss-slots.mjs`, `boss-arenas.mjs`, `boss-geometry.mjs` and the reworked `liquidator-boss.mjs` are lazy (the bundle-offsets test pins all four). The initial path pays for the `main.mjs` wiring (the boss-slot step, closed locks in the world blockers and the navgrid, the add allowance, the damage route and the rewards, the Golden Parachute, the lock and pip drawing), the boss name and markers in `hud.mjs`, the dodge's boss dangers, the director's lean, and the Dark Pool's walls and container in the world data. Child entry 306,706 of 480,000 B |
| 5. Boss kit review fixes | 1,020,215 | −278 | 28,361 | The boss add loop moved from `main.mjs` into the lazy `boss-slots.mjs` (`insertBossAdds`). Child entry 306,428 of 480,000 B |
| 6. Progression release | 1,026,083 | +5,868 | 22,493 | The initial path pays for the offer, re-roll, focus and v7 counters in `run-progression.mjs` (about +4.1 KB minified alone) and the gun trees in `weapon-system.mjs` (about +2.3 KB), plus small `main.mjs` and `grenades.mjs` wiring. The re-roll strip and the twelve cards' text are in the lazy `upgrade-panel.mjs` and `progression-content.mjs`. `run-progression.mjs` reads card 2's gun order from the run-summary catalogue rather than importing `weapon-system.mjs`. That import moved about 66 KB (the weapon system and its channel weapons) from the entry into shared chunks, because lazy modules import run progression. The total barely changed (1,026,106 B), but the entry split is kept stable. main also injects the gun names into the panel, so the lazy chunk imports no simulation tables. Child entry 308,949 of 480,000 B |

### What the offsets moved (slice 1)

`main.mjs` starts one loader (`loadLazyRuntimeModules`) at the top of `boot()` and awaits it right after `app.init()`, before anything that calls a lazily bound function and long before the bridge or the standalone session can start a run. The chunks download while the renderer initialises. The simulation calls only resident code, so it stays synchronous and deterministic.

| Module | Kind | Why it may be lazy |
|---|---|---|
| `liquidator-boss.mjs` | boss simulation | resident before any session starts |
| `creature-presentation.mjs`, `liquidator-telegraph-renderer.mjs` | projection | render only |
| `world-design-interactions.mjs` | objective simulation (machinery, gates) | resident before any session starts |
| `world-design-pacing.mjs` | simulation | resident before any session starts |
| `world-design-life.mjs` (with `cover-break-presentation.mjs`) | projection | render only |
| `world-design-native-assets.mjs` | asset loader | presentation |
| `level-briefing.mjs` | briefing text | presentation |
| `upgrade-panel.mjs` (new; with `upgrade-card-presentation.mjs`) | level-up panel, moved out of `cockpit-ui.mjs` | UI |
| `progression-content.mjs` (new) | upgrade card text, moved out of `run-progression.mjs` | UI text; the simulation's choices carry ids and numbers only |

`tests/hmh-reboot-bundle-offsets.test.mjs` pins the static graph (esbuild, dynamic imports external), the single loader, the await order, and the text split.

## Determinism

Same-seed runs must stay identical. Gameplay slices may change results against 1.8.1; each such change is listed here.

| Slice | Change against 1.8.1 |
|---|---|
| 1. Bundle offsets | none (loading only) |
| 1. Offer timing | A level-up offer (earned, or the progression pilot's forced level) opens at the end of the tick whose XP produced it and stops that frame's catch-up. In 1.8.1 it opened after the frame, so up to three more ticks could run between the level and the panel, and how many depended on the frame partition. The offer tick is now partition-independent. |
| 1. Projection observer | none (new hook, no consumer yet) |
| 1. Weapon order and evolutions | none. `HMH_WEAPON_ORDER` is the same list, now derived from the run-summary weapon catalogue in `weapon-system.mjs`. No evolution is reachable before the Genesis Seal slice, so the additive tags and the Settler Rail armour flag change nothing yet. Deep Proof's 0.6 boss armour penetration now keys on any `boss-` target; the Liquidator (`boss-liquidator`) is the only one. |
| 2. Progression harness | none. No simulation module changed. The new `boss-reference-dps.mjs` holds constants and is not imported by the runtime yet. |
| 3. Manual dodge | **Keyboard play changes.** While the keyboard and mouse are the last-used device (`manualDodge` in the tick input; unlike the active device it survives an input reset, so a level-up pick or a blur opens no automatic-dodge window), the automatic dodge is off and the dodge key (Left Shift) starts one. Direction: the move input, else the last move, else directly away from the aim. The dash is truncated at the last safe 4-unit sample of the automatic dodge's footprint rule plus the swept collision, keeping dash speed; under 48 safe units it is refused and spends no cooldown. Touch and gamepad runs are unchanged: the same automatic dodge, called with the same arguments. The tick input gains `manualDodge` and a live `dash` edge (one tick per press), so a replayed input stream reproduces every dodge. |
| 3. Death camera | none. The defeat tick still enters `game-over` and builds the result there (`game:state` payload included); score, run summary and evidence are the defeat tick's. Only the time the four result messages reach the parent moves, by 72 presentation ticks (1.2 s of render-loop wall time), or sooner on a hidden tab, an exit request or a session end, with a 2 s backstop timer for a page that draws nothing. The ticker keeps drawing the frozen defeat tick while the existing 6-frame death clip plays on the camera's clock, then stops. The weapon layer, the aim reticle and the Settler Rail charge line are hidden in the death clip (projection only). Shift+Escape no longer exits a live run or an open level-up (Shift is the dodge); it pauses like Escape, and still exits when paused or dead. |
| 4. Mission core v2 | **Objectives change.** See "Mission core v2 (slice 4)" below. In short: two quick machines (the generator button, 30 ticks; the warehouse lever, 45) commit after 12 ticks in a 72 ring and then finish; four channel machines (winch, pump, sanctuary crank, valve, 90 ticks each) fill only while the hero stands still in a 64 ring, dock the hero onto the operate spot and stow the weapon, hold their fill while the hero moves, hold it 120 ticks after leaving and then drain 2 a tick, and pause 12 ticks on a hit. 1.8.1 started a machine on a touch within 82 and finished it on its own after 90 to 180 ticks. The six operate spots moved beside their footpaths, with the control props 46 units along the facing, so the world collision and navgrid witnesses are re-pinned. The winch needs the new Winch Handle item. Completed nodes grant objective XP at the level before the grant (switch 18, gate 30, item 12, secret 60 per level), secrets grant 20 silver, and three court gates complete as the contract's gate objectives. The farmstead seal also pries (kneel 60). Breakables are the last auto-aim target within 200; the nuke skips breakables and every destructible, and fuel blasts chain only through drums. An ammo grant during an Arc Rifle channel no longer throws inside the tick. The objective chime is gone. |
| 6. Progression release | **Offers and the upgrade tree change (the package's one determinism bump for S1.3).** Same-seed offers differ from 1.8.1: the salt is package 8.3's, card 2 is drawn first from the candidate guns, and the catalogue has 36 cards. Re-rolls happen while the kernel is frozen and never read the simulation RNG. The four gun trees are live: Magazine & Salvage reserves and kill salvage, Charge Speed, Capacitor Bank, heat per rank, the centre-pellet blast, and launcher shells per shot with upgraded damage and radius. Also: caches select only new guns, Extra Grenade raises the maximum, held weapons crit, Arc and Burn damage rise per rank, and the nuke stops at 1,100. See "Progression release (slice 6)" below. |
| 5. Boss kit and the Liquidator | **The Liquidator changes completely.** See "Boss kit and the reworked Liquidator (slice 5)" below. In short: the 72,000-tick timer is gone; he starts when the hero rings the Closing Bell (a seal ring, readyTick 36,000, 90 still ticks, drains 4 a tick) or enters the Dark Pool with its logbook found; his HP is frozen at the trigger (`round(150 × referenceDps(level))`); phases change at 66% and 33% HP with a 90-tick Trading Halt that clamps the overshoot and clears his tells; he walks, dashes and steers inside his sealed floor; every strike hits the hero's disk (radius 24) inside the leash; the kit is chosen by `seededUnit(runSeed, 'liquidator:<phase>:<ordinal>')`. The director is suppressed while he lives (1,800-tick grace after a defeat, 480 after a retreat), the Yard leans to Agents until he falls, the grid goes quiet after, and his adds follow the capacity bank. A defeat drops the 25-coin burst (not 10), heals fully and refills grenades. The yard entry, the logbook and the Dark Pool court moved, so the world collision and navgrid witnesses are re-pinned. Keyboard, touch and gamepad dodges read his locked strikes. |

`tests/hmh-boss-determinism.test.mjs` is the same-seed check for slice 5: a headless run of the real kernel, the real Level 1 collision and ground, the mission step (the bell and the retreat rings are boss zones, the logbook a secret), the boss slots and the reworked Liquidator, with the hero's damage stream and his strikes resolved each tick. Two scripts: the Closing Bell (rung at 10:00, locked, both halts, a win) and the Dark Pool (logbook then start, Margin Call and his first adds, a retreat through the ring, a legal re-initiation 2,520 or more ticks later, his next adds, a win and the Golden Parachute). Adds go through `insertBossAdds` into a real enemy population. `tests/hmh-boss-slots.test.mjs` drives the real mission step with the hero waiting on the Dark Pool retreat spot (the tightest fill) and runs the verifier's rules on the resulting rows. Two runs of one seed give one digest for render partitions 1 to 4 and a seeded mixed partition, for both scripts; the recorded input stream replays the run one tick per frame; another seed differs. `tests/hmh-reboot-liquidator-boss.test.mjs` adds a boss-only partition check.

`tests/hmh-mission-determinism.test.mjs` is the same-seed check for slice 4: a headless run of the real kernel, the real Level 1 collision, ground and line of sight, the mission step, the dock glide, the weapon loadout (stowed while a channel plays) and run progression. The hero walks a scripted route through the generator, the supply court, the seal (kneel), the hidden supplies, the Winch Handle, the winch (left mid-fill and resumed, hit on a seeded schedule) and the valve. Two runs of one seed give one digest for render partitions 1 to 4 and two seeded mixed partitions; the per-tick input stream fed back one tick per frame reproduces the run; another seed differs. The run also shows that no shot fires on a stowed tick and that the winch kept its fill while the hero walked away.

`tests/hmh-reboot-dodge-determinism.test.mjs` is the same-seed check for slice 3: a headless run of the real kernel, the real `InputState` driven through keyboard, touch and gamepad phases, `resolveDodgeIntent`, the dash state and the dash world step. Two runs of one seed give one digest (for two seeded frame partitions), the per-tick input stream the kernel hands its replay observers reproduces the run when fed back one tick per frame, and another seed differs. The run covers an away-from-aim dodge, a refusal at a cliff edge that spends nothing, a held key that never repeats, automatic dodges on touch and gamepad and none on the keyboard. The foundations digest test still passes unchanged.

`tests/hmh-reboot-foundations-determinism.test.mjs` is the same-seed check for slice 1: a headless run of the real kernel, main.mjs's offer code, the weapon loadout, run progression and the run-summary accumulator gives one evidence digest for two runs of a seed, for render partitions 1 to 4 and two seeded mixed partitions, and with a (faulting) projection observer attached.

## Progression harness and the 1.8.1 baseline (slice 2)

Package S0.3, progression part. `scripts/hmh-progression-model.mjs` is a headless, deterministic model of one run. It is built on the game's own pure modules: run progression and the two-card offer, the weapon loadout (cadence, reload, reserve caps, fallback), projectile contacts on the ordinary-enemy hurtbox, the knife, hand and launcher grenades, seeded crits and armour, the director's bands, caps, archetype choice and health ramp, enemy attack tokens and tells, auto-aim, dash cooldowns, combo XP, and every pickup table (caches, havens, secrets, supplies, the three rare weapon events).

The proxy parts are frozen in `MODEL_CONSTANTS`, and the baseline records their fingerprint:
- **Route.** `x = tick / 6`, which reaches x 12,000 at 20:00. A pickup is taken when the route reaches it, within 2 minutes.
- **Arena.** The hero stands at the origin. Enemies spawn 1,600 units out, which matches Level 1's authored spawn points on the district edges. Each spawns on a seeded bearing in the forward 120°, walks in at 60% of its speed, and queues in nine lanes. Spawn placement never fails.
- **Evasion.** Every enemy with an attack token strikes on its real clock. A strike connects at `strikeConnectChance` 0.016, divided by the hero's movement multipliers. The chance is paid out by deterministic error diffusion, not a coin flip. The automatic dodge spends itself on a strike that connects.
- **Aim and grenades.** Aim error is up to ±4°. A hand grenade is thrown when 4 or more bodies are near its landing point.
- **No bosses.** The gate measures the hero against the horde. Boss slices measure their own fights.

`strikeConnectChance` and the spawn distance were set once, against 1.8.1. They put the median death in the elite band (10:00 to 20:00). The director's settings are constant there, so the time of death depends on the hero's power, not on a band change. Constants main.mjs owns and does not export are mirrored in `MAIN_MIRROR`, and a test fails if main.mjs moves any of them.

**Three pick policies.**
- `seeded`: a seeded coin flip, like a casual player.
- `power`: gun-tree cards first, then damage, then crits.
- `survival`: health, dash and speed first.

The re-roll rule is frozen now so the progression release cannot tune the policies to itself: `power` and `survival` re-roll a card below their tier 3, and `seeded` never re-rolls. 1.8.1 has no re-roll, so the rule is exercised only by its test until the release wires the new offer API into `runProgressionModel`.

**Baseline** (`docs/testing/hmh-progression-baseline-1.8.1.json`):
- Source: the 1.8.1 release commit `6c3779dd`, exported with `git archive` and run with `--root`.
- Config: 16 fixed seeds × 3 policies over a 30:00 horizon, 48 runs. A run of all 48 takes about 95 s on an idle machine.
- Run digest: `a58e6d2c…`. Re-running the first seed of each policy gives the same digests.
- This branch reproduces the baseline bit for bit. The default command on the working tree gives the same 48 run digests and the same report digest (`a58e6d2c…`), so the gate reads 0% growth. The weapon order the foundations slice moved does not reach the model's evidence.

| Survival (min) | Median | p10 | p25 | p75 | p90 |
|---|---|---|---|---|---|
| Pooled (48 runs, all died) | 16.85 | 11.45 | 15.83 | 17.84 | 20.80 |
| `seeded` | 16.34 | 11.23 | 13.10 | 17.43 | 19.94 |
| `power` | 17.57 | 13.89 | 16.28 | 18.81 | 20.82 |
| `survival` | 16.85 | 11.44 | 16.55 | 17.33 | 18.13 |

**XP income** (pooled medians):
- Level at 1 / 2 / 5 / 10 / 15 minutes: 4 / 8 / 13 / 21 / 30.5.
- Level 10 at 2:55, level 20 at 8:45, level 30 at 13:52.
- XP comes 91.3% from kills, 8.3% from combo milestones and 0.4% from cache pickups. The median run makes 927 kills.

**Offers.** A median of 30.5 offers per run, with no re-rolls in 1.8.1. Pistol mastery (all 9 Pistol ranks) is reached by 14 of 16 `power` runs after a median of 23.5 level-ups. The package's draw model gives 24.1. Only 2 of 16 `seeded` runs and 2 of 16 `survival` runs reach it.

**Ammo** (pooled medians):
- **Shotgun:** acquired at 0:35 from the relay reserve, 96 shells, all fired, 5 dry fallbacks, 14% of the run.
- **Railgun:** acquired at 5:01 from the ravine winch, 30% of the run.
- **Pistol:** 40% of the run.
- **Arc Rifle** (39 runs), **Machine Gun** (36), **Flamethrower** (26), **War Fork** (25), **Grenade Launcher** (12): acquired only by runs that live long enough to reach them.

**referenceDps(level) calibration** (package 4.1, boss HP):
- Method: the Pistol's weapon-benchmark DPS (30 s at one static armour-1 target) times the run's outgoing damage multiplier, with the expected critical hit. It is measured once each new level's picks are made, and the median is taken over every run that reaches the level.
- Result: the medians are convex (6.7 at level 1, 11.1 at 10, 27.2 at 20, 79.6 at 32), so no capped line fits them. A least-squares capped line had a negative base, and the package placeholder `min(47, 8 + 2.6 × (L − 1))` is off by 18.8 DPS RMS.
- The calibration is therefore the table: levels 1 to 32 (the last level at least half the runs reach), non-decreasing, rounded to 0.1, and held past 32. `apps/hmh-reboot/src/boss-reference-dps.mjs` carries it as `referenceDps(level)` for `hmhV7BossHp`, and the test pins it to the baseline.
- At the ready ticks (levels about 8, 13, 17 and 21), the Baron's 90 s gives about 800 HP, the Lockkeeper's 105 s about 1,420, the Foreman's 120 s about 2,280 and the Liquidator's 150 s about 4,640, against today's 12,000.

**The gate** (package 8.3 and 9.2):
- Command: `node scripts/hmh-progression-model.mjs` runs the working tree and compares it with the baseline. It exits 1 when the pooled median survival grows by more than 10%, or when the report cannot be compared.
- Warnings: a policy whose median grows by more than 10%, or falls by more than 10%.
- **Sensitivity.** The model's median moves little with power. On a copy of the 1.8.1 source with a flat +20% outgoing damage, the pooled median grew by 3.0% (`seeded` +5.4%, `power` +2.9%, `survival` +1.8%) and p10 by 38% (11.45 to 15.84 minutes). No 1.8.1 build kills as fast as the elite band spawns, so the horde keeps growing and extra power buys only a little time. The gate on the median is therefore lenient. The comparison also prints the growth of every pooled quantile and the mean (`pooledQuantiles`), and the progression slice should report them next to the gate.
- If the model itself changes, bump `PROGRESSION_MODEL_VERSION` and regenerate the baseline: `git archive 6c3779dd apps/hmh-reboot/src sdk | tar -x -C <dir>`, then `node scripts/hmh-progression-model.mjs --root <dir> --write-baseline --source-label 1.8.1 --source-commit 6c3779dd980d0a2b56665a4fde666a3b6b46ff54`.
- The progression release must extend `runProgressionModel` for card 2 and the re-roll. It may use `chooseReroll`, but it must not change `choosePick` or `chooseReroll`.

**Found while building it (1.8.1 hazard, not fixed here).** `refillWeaponLoadout` and `grantWeaponPickup` throw ("cannot refill Lightning Ledger while channeling") when they refill the Arc Rifle while it is channeling. main.mjs calls them without a guard, inside the tick, for:
- ammo havens and objective ammo rewards;
- ammo secrets and supply crates;
- an Arc Rifle cache.

So an Arc Rifle player who channels while taking an ammo reward throws inside the simulation step. A direct call on the real module reproduces it: grant the Arc Rifle, channel for 6 ticks, then call `refillWeaponLoadout`. The model defers such a pickup to the first idle tick. The fix belongs to a gameplay slice, with a test and a browser check of how the kernel surfaces the throw.

## Mission core v2 (slice 4)

Package S1.4 (sections 3.1–3.6 and 3.9) on the shipped map. Owner decisions applied: interaction is contextual and automatic (stand in the ring, no button), and the audio is the owner's list (the objective chime is removed; machinery, gates, seals and items are silent; a secret's supplies play the pickup cue).

**Modules.**
- `mission-objectives.mjs` (simulation, lazy through `loadLazyRuntimeModules`): `MISSION_OBJECTIVES` (frozen, sorted by id, each row a v7 contract objective of the same class and district), `createMissionState(seed)`, `stepMissionObjectives`, `settleMissionObjective`, `missionDockStep`, `missionActiveBlockers`, `missionSealTargets`, `applyMissionSealDamage`, `missionHiddenSecretProps`, `missionObjectiveRows` and `missionPresentation`. It absorbs the objective parts of `world-design-interactions.mjs` (which keeps the valve's steam and the navgrid patch) and the secret state of `world-design-secrets.mjs` (which keeps the data, props and the seal's cover hit).
- `mission-guidance.mjs` (projection): the tracker's choice and text, claimable stations and the field map's node list.
- `mission-palette.mjs` (projection): the §3.3 colours, tested against the telegraph colours (boss colours ΔE ≥ 25) and every district's accent and ground (ivory ΔE ≥ 25).

**Nodes on the shipped map** (13 of the contract's 25; layout v2 adds the rest).

| Objective | Class | Mode | Notes |
|---|---|---|---|
| `relay-power` | switch | quick press, 30 | opens the supply court; its gate completes `relay-barn-doors` |
| `ravine-winch-handle` | item | touch within 56 | interim anchor (2,350, 2,900), the package's own point |
| `ravine-winch` | switch | channel crank, 90 | locked until the Winch Handle is carried |
| `crossing-pump` | switch | channel crank, 90 | its gate completes `crossing-mill-storeroom` |
| `hashwood-shrine` | switch | channel crank, 90 | |
| `mining-valve` | switch | channel crank, 90 | vents its steam trap (the valve's own vent is its effect) |
| `yard-warehouse` | switch | quick lever, 45 | its gate completes `yard-warehouse-gate` |
| `farmstead-hidden-supplies` | secret | enter within 45 | its seal breaks (60 HP) or pries (kneel 60 at (326, 3,270), facing east) |
| `ravine-surveyor-cache`, `warehouse-logbook` | secret | enter within 45 | |

The winch, sanctuary and valve courts have no contract gate objective, so their gates open with no gate XP. The site heal and ammo grants stay until the prisoners slice adds the Medic and Quartermaster pools, so sustain changes once.

**Rules** (§3.2): one active zone, the nearest eligible ring containing the hero (ties by id), on the ring's height and in sight of the operate spot at z+24 excluding the node's own prop; quick nodes commit after 12 consecutive ticks and then fill regardless, and they stow the weapon only when the hero stood still at the commit and until the hero moves; channels and pries fill only while the hero stands still (move < 0.2, not dashing), hold while the hero moves inside, hold 120 ticks after leaving and then drain 2 a tick, and pause for 12 ticks on a hit (`pausedUntil = max(pausedUntil, tick + 12)`, from the previous tick's `lastPlayerHit`); seals (the boss slice's triggers) wait for `readyTick` and drain 4 a tick at once. After 6 still ticks the next tick's movement glides the hero onto the operate spot at 4 units a tick, for at most 16 ticks, through the swept collision; any move input cancels it. While a channel plays, auto-fire and the auto-knife are suspended (`stepWeaponLoadout({ stowed })` also cancels a Railgun charge rather than releasing it); grenades and the dodge stay available. The mission step runs after movement and before the grants, the director, the boss, enemies and combat.

**Placement** (§3.4 rules 1, 2 and 4, `tests/hmh-mission-placement.test.mjs`): every operate spot fits the hero clear of every collider; every ring disk is dry, walkable ground on one height; ring centres stand at least 300 apart and at least a hazard's radius + 100 from every damaging or pushing hazard (the spore bed only slows, and a valve's operator stands outside its own vent); each switch is within 900 of its gate, and every requirement is in its own district. The props also keep clear of every route ribbon, footpath, authored lot and encounter floor. The operate spots were chosen by a constrained search around the 1.8.1 pads; the tour spawns and briefing bearings follow them.

**Guidance** (§3.3, projection only): ivory dashed rings with hazard chevrons over a dark outline, a fill arc, and a status lamp with a shape (red X missing, amber ! ready, green check done); a locked node shows a grey ring, a padlock and "Needs Winch Handle"; items get a beam (at most 4, 3 on a phone; still under `reduceMotion`); at most 6 rings are drawn; rings inside the live Liquidator's arena hide; secrets carry no marker and a pry spot shows only while the hero kneels. The tracker pill (one line, hidden while the boss bar shows, glyph + distance + arrow on a compact landscape) and its screen-edge chevron track, in order: an active channel, a ready boss trigger in the district, the next step of the district's chain (even undiscovered), then the nearest claimable station, with 400 units of hysteresis. A claimable station is an objective reward whose machine is done, whose state in the collectible state is `reward-available` at the render tick (so a haven drops out while it restocks and a first-clear cache once it is taken) and which the hero could take now under the collection step's own capacity check, given the same effect and placement `stepCollectibles` passes; `missionGuidanceStations` in the lazy `world-design-life.mjs` builds that list from the `collectibles` and `canCollect` main already passes, so the initial bundle does not grow. The Liquidator Vault is not tracked yet: its owner `liquidator-defeated` is not a mission row (the v7 contract has no boss objective), so it never counts as done; the boss slice owns tracking it after a defeat. Prisoners join priority 4 in the prisoners slice. The pill is drawn in the canvas overlay, in the band the old site prompt used (see the parent request below). A node is discovered when its anchor enters `directorViewBounds` of the simulated actor; the pause field map lists discovered nodes by state and found secrets' lore.

**Breakables** (§3.3): the seal and the supply cover are the last automatic target (within 200, in sight, only while no enemy can be targeted; manual aim is never pulled to them); the knife and every player weapon hit them; the nuke skips them and every destructible; fuel blasts chain through drums only; enemy strikes only ever name the player.

**Run summary.** Each completion is settled one node at a time (`settleMissionObjective` records the level just before the node's own `grantRunXp`), and switches and secrets still record their v6 milestones on the same tick (contract S8). `missionObjectiveRows(missionState)` returns the dense v7 `objectives` rows in catalogue order for the emission slice. Until that slice flips the child to schema 7, the v6 bound has no node-XP or secret-silver term: the branch must not ship a schema-6 child with this slice.

## Boss kit and the reworked Liquidator (slice 5)

Package S1.5 (sections 4.1, 4.2, 4.3 and 4.7 items 1 to 4) on the shipped map, with the owner decisions applied: the player starts every boss (no timers), interactions are contextual (the bell is a ring the hero stands in), tells and phase changes are silent, and boss hits and deaths use the enemy hit and death sounds.

**Modules** (all lazy through `loadLazyRuntimeModules`; nothing here reads a clock, the camera or quality).
- `boss-geometry.mjs`: the geometry kit. Lane, charge lane, chain link, circle, countdown ring, safe zones, panel grid, half-plane, drift rect, rotating bar, and a union for multi-lane tells. Every hit test takes the hero's disk (radius 24). `bossShapeClearDistance` measures the walk until the whole disk is out (inside a floor's interior, so walls lengthen it), `bossWalkBudgetTicks` is `ceil(clear / 4) + 12`, and `bossShapeDodgeDanger` feeds the automatic dodge.
- `boss-arenas.mjs`: the Margin Floor fallback and the Dark Pool, their podium marks, chart axes, margin-seal sites, retreat rings and lock capsules (r16, outside each floor's edge: 12 shutters on the plaza, one door on the pool), and `bodyOverlapsLock` (the capsule inflated by 24).
- `boss-slots.mjs`: the registry (`BOSS_DEFINITIONS` holds the Liquidator; the Baron, the Lockkeeper and the Foreman stay dark and their v7 rows stay zero) and the lifecycle: readiness, the triggers, one boss live at a time, the first trigger owning him for the run, locks, the retreat ring, the call-off, the director overlay, the add allowance, the rewards, the Golden Parachute, the HUD state and `bossRunRows` (the dense v7 `bosses` rows).
- `liquidator-boss.mjs`: the reworked Liquidator.

**Lifecycle** (package 4.1).
- Dormant from tick 0; ready at the contract's 36,000. Before that the bell shows a red lamp and "Opens at 10:00" (later "Opens at M:SS" after a retreat), and once the Dark Pool owns him the bell shows SETTLED.
- **The Closing Bell** is a mission seal zone (`liquidator-closing-bell`, ring 90, 90 ticks, drains 4 a tick, docking and weapon stow like any channel). The slots arm it each tick before the mission step; filling it emits a `boss-zone` event and re-arms it from empty. It is never an objective and grants nothing.
- **The Dark Pool** needs the Warehouse logbook found (this tick or earlier) and the hero inside the court 48 past the threshold. The mission step records the logbook before the slots start him (package 3.2 order), so a Dark Pool initiation is never earlier than the logbook tick (contract S16).
- **HP** is `hmhV7BossHp('liquidator', referenceDps(level at the trigger))`, about 4,640 at level 21.
- **Intro**: the bell start is untargetable, silent and damage-proof for 150 ticks (every source, the nuke included). The Dark Pool start has none: Insider Trading, x1.25 damage for 300 ticks.
- **Locks** close capsule by capsule as soon as each footprint is clear of the hero, every ordinary enemy and the boss, re-checked every tick. At the intro's end (at once for the pool) the rest are forced: an ordinary enemy standing in a wall line is recycled without credit, and one touching a footprint is pushed clear by its own swept collision. When the lock completes, off-view ordinary enemies outside the floor are recycled without credit. Each lock patches the navgrid through `refreshWorldDesignGateNavigation`, closing and opening, and a restart reopens the previous run's locks.
- **Call-off** (not in the package): a hero who leaves the floor through a still-open gap before the lock forces calls the fight off. The boss withdraws and the trigger re-arms at the initiation plus 2,520 ticks (`BOSS_REINITIATION_MIN_TICKS`), so the verifier's spacing rule holds.
- **Retreat**: after 600 engaged ticks a retreat ring (channel 120) arms on the live floor. Completing it reopens the gates, removes the boss (his HP is recomputed at the next trigger) and re-arms the trigger 1,800 ticks later, and never sooner than 2,520 ticks after the initiation. The ring counts its first armed tick, so an unbroken channel fills at initiation + 719, and 1,800 on would be + 2,519; the Dark Pool has no ring and re-initiates on the first ready tick, and the verifier spaces initiations 2,520 apart (`boss-reinitiation-too-soon`). The slot keeps the later of the two.
- **Director**: suppressed while he lives and during a grace (1,800 ticks after a defeat, 480 after a retreat); a director insertion that would overdraw the capacity bank is refused too. Ordinary enemies inside his floor count as adds; at most 4 are alive. His first 4 adds are free once per run (never in an engagement's first 90 ticks); each further add draws from the bank that `directorSpawnCapacityV7` (a parity test pins it to the verifier's `directorSpawnCapacity` over the v7 schedule) shares with the director. Adds skip the band threat caps; the population's 192 bodies still hold. An add takes its allowance just before its insertion (`insertBossAdds`) and hands it back if the population refuses it, so the free four count real insertions. The slot keeps his add-wave count for the run and each new boss numbers on from it, so the ids `boss:liquidator:w<n>:<k>` never repeat after a retreat (the population refuses a seen id). The Yard leans to Agents (suppressor weight doubled) until he falls.
- **Leash**: a strike resolves only while the hero is inside his floor widened by 120.

**The Liquidator** (package 4.3; the current atlas).
- Body in state: collision r56, hurt r48, z 4 to 96, armour 1, knockback resistance 0.92. He pushes the hero out to 84 between centres, at most 4 units a tick, through the hero's swept collision. He moves with swept collision against his floor's bounds and closed locks, never the navgrid.
- Phases at 66% and 33% HP. A crossing clamps the overshoot, refuses every further hit on that tick and the next 90 (the Trading Halt), clears his pending tells and stops his motion. Margin Call opens with the Circuit Breaker (every 1,500), Total Liquidation with the Total Liquidation super (every 1,200), which is followed by a 120-tick kneel at x1.25.
- Attack table by phase and range, with per-attack cooldowns and never the same attack twice in a row: under 200 Debt Collection (tell 44, r104, shove 48); mid range Crash Lane (45, width 54, to the floor edge), Gavel Stamp (60, r112) or the Candle Chart (96, then a column every 18); over 520 the Margin Call Dash from phase 2 (36, width 76, a real 14-a-tick dash up to 600; hitting a wall staggers him 60 ticks at x1.25), otherwise Crash Lane. From phase 2 the Enforcement Order (45) brings two Agents, then an Agent and a Gas Bomber in phase 3, at the floor-edge seals farthest from the hero; add ids are `boss:liquidator:w<n>:<k>`. Crash Lane is a V of 2 at +-12 degrees in phase 2; in phase 3 it fires the centre lane, then the V 20 ticks later. Gavel Stamp lays three seals 20 ticks apart along the hero's movement line in phase 3. The chart sweeps out and back in phase 3.
- He walks at 1.5 a tick to the podium mark farthest from the hero after every third attack (Margin Call may dash instead) and steers at 2 a tick toward the hero between tells in phase 3.
- After 5,400 engaged ticks a stall guard loops the final set on the 1,440-tick cycle.
- Damage: `applyLiquidatorDamage` is the only path that changes his health. It takes the role multiplier (at most 1.15, else it throws) and his own vulnerability window, and caps the product at 1.25; main no longer pre-multiplies boss hits. Environmental damage stops at 1 HP. The run summary records what he actually lost.
- A fallen boss's tells clear at once (contract S17).

**Walk budget** (package 4.1): every tell is issued only when walking out of each of its strikes fits the strike's tell from where the hero stands, inside the floor; otherwise the table tries its next attack, then a plain lane or seal. `tests/hmh-liquidator-walk-budget.test.mjs` checks the supers and the chart from every point of both floors, the lanes, the dash and the seals for every boss spot and hero point, Debt Collection in the open and refused when cornered, and every tell a scripted fight actually issues.

**Where the fallback differs from the package** (recorded under package 4.3):
- The Margin Floor is 460 tall (y 2,170 to 2,630), not 540, so the chart's three rows (153 each) fit the budget over the whole floor (95 of 96 ticks); a taller floor leaves an uncovered strip along each wall.
- The supers' safe circles anchor to the floor centre, not to him: the Circuit Breaker's north-south circles cast from a podium would leave the far corners 800 away.
- Phase 3's Crash Lane fires the centre lane, then the V 20 ticks later: three lanes at once leave a band about 220 wide at mid range that no walk clears in 45 ticks.
- The Dark Pool is 384 wide (the strip between the plaza and the world's east edge), so its chart is 4 columns along y by 3 rows of 128 across x.
- The yard entry is (10,060, 2,505), not (10,250, 1,600): the entry test keeps every start within 192 of the main route. It is 946 from the anchor.
- There are no kiosks on the fallback plaza; the Crash Lane cover check stays for layout v2.

**Rewards** (package 4.3): the gates open, `liquidator-defeated` unlocks the Vault (the Arc Rifle cache, tracked as a claimable station), a full heal (if the hero is standing), grenades to max, 1,040 XP through the kill (threat 48), the 25-coin burst in place of the 1.8.1 ten, the Yard pacified (grid off, the Agent lean reset, the 1,800 grace), and for a Dark Pool win the Golden Parachute: one revive at 50% HP (a gold pip in the overlay until it is spent). The killing hit it absorbs is recorded as not killing; the emission slice replaces that with `recordRunRevive` and `progression.revivesUsed` (`bossSlots.revivesUsed`). `kills.boss` still counts the Liquidator only, and the bridge's `boss-defeated` event is unchanged.

**Run summary rows.** `bossRunRows(bossSlots)` returns the dense v7 `bosses` rows (`{bossId, initiations, firstInitiatedTick, lastInitiatedTick, defeatedTick}`, catalogue order). `milestones.bossEngagedTick` is the tick the trigger fires (S7). Nothing sends the rows yet; that is the emission slice.

**Not done in this slice:** the Genesis Seal (S1.7); the art preload's unload after a defeat (one boss exists, so the atlas stays); the new rig and arena kit (S4.3); kiosks, the freight lift and the bell pedestal as props; a DOM Golden Parachute pip.

## Progression release (slice 6)

Package S1.3 and section 8 (8.2, 8.3, 8.6) with the owner decisions applied: two cards with one re-roll per card per offer, the Pistol unchanged, and the audio strictly the owner's list (health and ammo pickup cues stay).

**Cards and offers** (`run-progression.mjs`).
- The catalogue is the v7 upgrades catalogue in its order (36 ids). The twelve new cards (`scatter-*`, `miner-*`, `rail-*`, `launcher-*`) are rank 3, gated on their gun, carry no XP or score effect, and map in `progressionByWeapon` to each gun's rate of fire, damage and Magazine & Salvage branches.
- Each pending level is its own offer, opened once by `openRunUpgradeOffer` with the guns that have ammo on the offer's tick (`weaponIdsWithAmmo`: owned, clip or reserve above 0; the War Fork always; the Flamethrower while it has fuel). Card 2 is drawn first, from the first candidate gun with a card left (the focus gun, then the weapon order, never the Pistol), else the general pool; card 1 is a general draw without card 2's card. The focus gun is the last non-Pistol gun selected by hand (`setRunUpgradeFocus` after a manual switch) or newly picked up (inside `unlockRunProgressionWeapon`).
- `rerollRunUpgradeSlot`: one per card per offer; a shown card never returns in its offer; card 2 walks its gun, then the next candidate gun, then the general pool; nothing left reads "No other upgrades" and counts nothing. It never selects, closes the panel or advances a tick, and it is silent.
- Every draw is `hashChoice(seed, 'offer:level:<level>:<pendingLevels>:<selectionSequence>:s<slot>:d<draw>:<upgradeId>')`, lowest wins, ties by id. Nothing reads the simulation RNG.
- `HMH_CARD_TWO_INTERVAL` (1) is the fallback switch; 2 focuses card 2 on every second offer only. It stays 1 (see the harness below).
- Without an open offer, `pendingChoices` is a pure preview of the offer with every owned gun armed, and `selectRunUpgrade` opens it implicitly, so benchmarks and older callers keep working.
- **v7 rows.** Run progression counts `offersOpened`, `rerolls` and each card's offered (re-rolls included) and selected counts: `runUpgradeRows(state)` gives the dense 36 v7 rows and `runProgressionRow(state, { revivesUsed })` the v7 progression row (Seal and evolution fields 0 until S1.7). A test puts both into the committed v7 fixture and passes `validateRunSummaryPayload` (S13–S15, S18). The v6 accumulator cannot name the twelve cards, so main records the 24 v6 ids only (`recordV6UpgradeOffer`); the emission slice wires the v7 rows.

**Guns** (`weapon-system.mjs`, `grenades.mjs`, `main.mjs`).
- **Magazine & Salvage:** reserve grant `ceil(pickupReserveAmmo × 1 / 1.25 / 1.5 / 2)` (Shotgun 12/15/18/24, Machine Gun 240/300/360/480, Railgun 15/19/23/30, Launcher 8/10/12/16), cap twice the grant. From rank 2, `creditWeaponKills` adds the per-mille of each ordinary kill credited to the gun (Shotgun 250/500, Machine Gun 2,000/4,000, Railgun and Launcher 150/250); each whole 1,000 is one reserve round, never the clip, up to the cap. main credits right after each kill resolves, so the weapon step of the next tick reads it.
- **Railgun:** `chargeTicks` 72 / 67 / 62 / 56 by Charge Speed rank (the charge line reads it too); Capacitor Bank (clip 5) replaces the Pistol's extended-mag on the rail's third branch.
- **Machine Gun:** heat per round × 0.90 / 0.80 / 0.72 by Fire Rate rank.
- **Shotgun:** Shell Damage rank 3 makes only the centre pellet (`floor((n − 1) / 2)`) a radius-72 blast; the other pellets stay pellets (1.8.1 made every pellet a radius-58 blast, but the tree was unreachable).
- **Launcher:** one shell per shot (`event.shots`), each with the shot's direction, upgraded damage (34 + 2 / 5 / 8) and blast radius (Shaped Charge 210); Twin Tube fires exactly 7° apart (no pellet jitter).
- **Balance fixes (8.6):** a cache selects its gun only when newly owned (`select: 'if-new'`); Extra Grenade raises the maximum (`raiseHandGrenadeMaximum`) instead of overflowing it; the run's crit reaches Arc Rifle pulses, flame contact, launcher blasts and War Fork strikes (`HMH_CRITICAL_HELD_WEAPON_IDS`; the knife, hand grenades, burn ticks and a blast's self-damage keep theirs); Arc Damage contact × 1.10 / 1.15 / 1.20 per rank; Burn Damage + 1 direct at ranks 1 and 3.
- **Nuke:** confirmed first. Running the nuke branch of `main.mjs` against targets at 300, 1,100, 5,000 and 11,000 units showed 1.8.1 (`6c3779dd`) hitting all of them and a breakable; the branch head before this slice hit all four (breakables were excluded in slice 4). The effect now carries `radius: 1_100` and the loop skips targets beyond it. `tests/hmh-progression-runtime-wiring.test.mjs` keeps both facts: the same loop with no radius is whole-map, and with the shipped effect it stops at 1,100.
- **Wording (8.6):** "+25% score + Pistol Reload", "+6% speed + Pistol Fire Rate", and Proof of Work's description names Piercing Rounds replacing Ricochet. **Not done:** the Scrypt Cache grenade icon. There is no grenade item art, and the cache's `assetId` is `nuke-liquidation`, which is also what its pickup records in the run summary; changing it changes the evidence.

**Panel** (`upgrade-panel.mjs`, lazy). A re-roll strip under each card, a sibling of the select button: "Re-roll", "Re-roll used" or "No other upgrades" (disabled unless ready). Keyboard R and gamepad X on release re-roll the armed card. After a re-roll the new card is armed and focused and a polite live region names it. There is no fade, so nothing needs a reduced-motion guard. Card 2 carries its gun chip (for example SHOTGUN 4/9; a gun with a capstone counts 10). main injects the gun's display name, so the lazy chunk imports no simulation tables. The strip's geometry is inline (36 px, 8 px dead zone) until the portal stylesheet owns it (parent request below). Its fit at 390×844, 414×896 and 896×414 was not checked; that needs `visual:reboot`.

**Audio.** `combat-audio.mjs`'s game mode is now an allowlist (`HMH_GAMEPLAY_AUDIO_CUES`): the weapon cues, `weapon-fire`, `melee`, `grenade`, `grenade-boom`, `enemy-hit`, `player-hit`, `enemy-death`, `silver-collect`, `pickup`, `health-pickup`, `ammo-pickup` and the two power-up cues. main no longer asks for `reload-complete`, the enemy tell cues, `supply-ready`, `upgrade-pick`, `dash`, the dash-ready `resume` or the weapon-switch click. The chamber glow still keys off the reload-complete event. `player-hit` and the guns' reload, empty and charge sounds stay, as the package's removal list (1.3) keeps them; the owner may want them reviewed.

**The harness gate** (`node scripts/hmh-progression-model.mjs`). The model gained the release's rules without changing what it does on a 1.8.1 tree: every new path runs only when the source provides it (the offer and re-roll API with the frozen `chooseReroll`, the focus gun, the grenade maximum, per-shot launcher shells, held-weapon crits, salvage credit, the nuke radius; `select: 'if-new'` reads as `true` on 1.8.1). Run with `--root` on a `git archive` of `6c3779dd`, it reproduces the committed baseline bit for bit (report digest `a58e6d2c…`, all 48 run digests), so `PROGRESSION_MODEL_VERSION` stays v1 and the baseline is unchanged.

| Survival (min) | 1.8.1 | Release | Change |
|---|---|---|---|
| Pooled median (the gate) | 16.85 | 12.65 | −24.9% |
| Pooled p10 / p25 / p75 / p90 | 11.45 / 15.83 / 17.84 / 20.80 | 10.03 / 10.78 / 16.51 / 17.21 | −12.4% / −31.9% / −7.5% / −17.3% |
| `seeded` median | 16.34 | 11.88 | −27.3% |
| `power` median | 17.57 | 11.21 | −36.2% |
| `survival` median | 16.85 | 16.86 | +0.1% |

- **The gate passes** (it fails only on growth above +10%) and reports two warnings: `seeded` and `power` fall by more than 10%. The run is deterministic (digest `e7a0e9c8…`). Other numbers: a median of 27 offers per run; 969 re-rolls (power 246, survival 723, seeded 0 by the frozen rule); Pistol mastery reached in 3 of 48 runs (18 in 1.8.1); a median of 646 kills (927); the level at 1 / 2 / 5 / 10 / 15 minutes is 4 / 8 / 13 / 21 / 28 (1.8.1: 30.5 at 15).
- **This contradicts the owner's rule that run length and difficulty stay about the same.** The cause is the twelve gun cards, not card 2 or the other fixes. Variants run on copies of the working tree (16 seeds × 3 policies each):
  - card 2 every second offer (the fallback): pooled −13.7%, `seeded` −28.9%, `power` −36.0%;
  - card 2 always a general draw: pooled −11.1%, `seeded` −19.0%, `power` −36.2%;
  - nuke without a radius: pooled −14.3%, `seeded` −28.2%, `power` −34.2%;
  - **no gun cards** (everything else of the release kept): pooled −0.6%, `seeded` +0.5%, `power` −4.3%, `survival` +2.4%, Pistol mastery after a median of 18 level-ups (25.5 in 1.8.1; the re-roll effect the package predicted).
- **Why.** In the model a picked-up gun is dry most of the run (Shotgun 13%, Railgun 31% of run time; the Pistol 42%), and Magazine & Salvage barely moves that (the `power` Shotgun share went from 13.7% to 14.5%). Fire-rate and charge-speed ranks spend the finite ammo faster. So a pick spent on a gun branch pays only while that gun has ammo, while damage, crit, health and Pistol picks pay all run. The `power` policy ranks gun cards first (frozen rule), so it spent about 200 picks on Shotgun and Railgun cards over 16 runs instead of Pistol, damage and crit cards. The `seeded` policy takes card 2 half the time, and card 2 is always a gun card.
- **Kept as specified.** `HMH_CARD_TWO_INTERVAL` stays 1: the agreed fallback exists to brake growth, and it does not recover the per-policy losses. No numbers outside the package were retuned. This is an owner decision (see the requests below).
- **referenceDps.** On the release tree the Pistol reference DPS medians flatten from level 13 (16.7 at level 20, 20.1 from level 22; 1.8.1: 27.2 and 79.6 at 32), because fewer runs max the Pistol. `boss-reference-dps.mjs` keeps the 1.8.1 table until the balance decision.

**Same-seed determinism.** `tests/hmh-progression-determinism.test.mjs` is a headless run of the real kernel, `main.mjs`'s real `openPendingUpgradeOffer`, `openLevelOffer` and `applyUpgradeReroll`, run progression, the weapon loadout (four gun pickups, manual swaps that move the focus, salvage credit on a kill cadence), launcher shells through the grenade system, and the run-summary accumulator. The player re-rolls and picks by seeded rules while the kernel is frozen. Two runs of one seed give one digest, for render partitions 1 to 4 and two seeded mixed partitions. Another seed differs. The run opens 15 or more offers with re-rolls, card 2 follows the Shotgun and the Railgun, and salvage refunds rounds. The foundations, dodge, mission and boss determinism tests still pass.

**Ranked fixtures.** `tests/fixtures/ranked/build-fixtures.mjs` built its fixtures on the child's live offer, which this slice changed.
- The schema-6 fixtures stand for 1.8.x runs, so the builder now carries the 1.8.1 two-card offer, frozen like the v6 verifier's literals. They rebuild unchanged, and the v6 pins hold.
- The v7 fixtures play the child's offer API and take their upgrades and progression rows from run progression. Both were regenerated.
- `hmh-v7-four-bosses` keeps its guns dry and re-rolls for the Pistol's cards, so it still masters and evolves the Pistol. The Settler Rail now comes with the Foreman's Seal rather than the Liquidator's, and three Seals are still banked.
- Contract 16.3 records this.

**Weapon benchmark.** `npm run build` regenerates `docs/qa/hmh-weapon-benchmark.json`. The maxed rows change:
- maxed Shotgun: close 85.4 to 122.4 DPS, mid 33.6 to 27.6, and an 8-body pack clears in 7.2 s instead of 1.7 s (the centre-pellet rule);
- maxed Launcher: 45.3 to 66.0 DPS;
- the maxed Pistol stays at 46.9, and the maxed Machine Gun at 30.7.

These tiers were unreachable in 1.8.1. The `output60` column and the Railgun rows (S0.3) are still missing.

## Requests for the parent (outside this branch's scope)

| From slice | Request |
|---|---|
| 1 | Fence or retire the legacy parent evolution system that reuses the child's evolution ids with other meanings: `apps/portal/src/arcade-core.mjs` (weapon evolutions), `apps/portal/src/hmh-upgrade-runtime.mjs` (`evolutionScoreMultiplier`, used by `hmh-long-run-simulator.mjs`) and the legacy `apps/portal/main.js` runtime. The child now reads only `HMH_CHILD_EVOLUTIONS`; `HMH_WEAPON_EVOLUTIONS` stays byte-identical for them. |
| 1 | `apps/portal/src/hmh-run-recap.mjs` says its upgrade titles are copied from `RUN_UPGRADE_CATALOG`; they now live in `progression-content.mjs` (`RUN_UPGRADE_CONTENT`). The pin in `tests/hmh-run-recap.test.mjs` already reads the new module; only the comment is stale. |
| 3 | **Death camera, parent side.** The child now sends `game:state`, `game:run-summary`, `game:score-result` and `game:game-over` 1.2 s after the defeat. `finalizeGameOver` (`apps/portal/src/hmh-reboot-portal-lifecycle.mjs`) must not add the package's own 1.2 s delay on top, and nothing parent-side should time out in that window. The child sends a held result before `game:exit` and during `portal:restart` or `portal:dispose`, so the parent should keep its port listener until a dispose completes. |
| 3 | **Keyboard dodge copy.** `apps/portal/hmh-reboot/index.html` still says the hero "fires, dodges and interacts automatically" (startup briefing tip and "Stay moving" card) and seeds `#hmhRebootDashStatus` with "Auto dodge ready". The child rewrites the status and the controls card at runtime; the static copy should name the keyboard dodge (Left Shift; touch and gamepad dodge automatically). The portal settings summary (`apps/portal/main.js`, "Keyboard: …") now lists `dodge ShiftLeft` as a raw id. |
| 3 | **Bridge settings.** `sdk/hmh-bridge-protocol.mjs` accepts an optional `settings.keyboardBindings.dodge` (the seven older keys stay required), because the parent builds its settings from the child's action map and would otherwise fail `portal:init`. No parent code changes; parent and child share the validator, so they certify together. |
| 4 | **Tracker pill slot.** Package §3.3 puts the tracker pill in the cockpit dock. The dock markup and styles live in `apps/portal/hmh-reboot/index.html` and `styles.css`, so the child draws the pill in its canvas overlay, in the band the old site prompt used (desktop: above the bottom 95 px; phone: above the bottom 240 px; compact landscape: 118–140 px from the top). A one-line `#hmhMissionTracker` row in the dock, hidden while `#hmhBossBar` shows, would let the child write the text there instead. |
| 4 | **Interaction copy.** The static "interacts automatically" copy in `apps/portal/hmh-reboot/index.html` (startup tip and "Stay moving" card) should say that buttons and levers start as the hero passes and that cranks, valves and pries fill while the hero stands still in the ring; the child's briefing tip now says so. |
| 4 | **Schema 7 before release.** The child now grants objective XP and secret silver (contract §5.4 and §11). The v6 verifier bounds neither, so the release that carries this slice must emit schema 7 with the gate change in `server/verify/hmh.mjs` (contract §15.1). |
| 5 | **Recap labels.** `apps/portal/src/hmh-run-recap.mjs` `BOSS_ATTACK_LABELS` copies the 1.8.1 kit. Add `gavel-stamp` (Gavel Stamp), `candle-chart` (Candle Chart) and `enforcement-order` (Enforcement Order) and drop `liquidation-zone`, `bad-debt-summon` and `short-squeeze-burst`. Until then an unlabelled id title-cases to the same name; `tests/hmh-run-recap.test.mjs` pins the difference. |
| 5 | **Boss bar.** The child now writes the live boss's name into `#hmhBossBar strong` and sets `--boss-marker-1` and `--boss-marker-2` (the phase thresholds) and `data-boss-id` on the bar. `styles.css` draws the markers at fixed 66% and 33%; it should read the two properties (the Liquidator's are the same values). |
| 5 | **Golden Parachute pip.** Package 4.3 wants a gold HUD pip; the child draws it in its canvas overlay under the boss bar. A cockpit slot would be the natural home. |
| 5 | **Briefing copy.** `apps/portal/hmh-reboot/index.html` seeds the objective with "Push east. The road leads to the Liquidator's yard." The child's briefing replaces it at runtime; the static copy could mention the Closing Bell. |
| 6 | **Balance decision (owner).** The progression harness predicts the release shortens runs: pooled median survival −24.9%, `seeded` −27.3%, `power` −36.2%, `survival` +0.1%. That contradicts "run length and difficulty stay about the same". The twelve gun cards cause it: a variant without them sits at −0.6%, and the card 2 fallback does not recover it. Options, none applied: make the finite guns' ammo sustain their trees (larger Magazine & Salvage, or a reserve refill when a gun card is picked); weight or cap gun cards on card 1; or accept the change. Each option needs a harness re-run. See "Progression release (slice 6)". |
| 6 | **Level-up panel styles.** `apps/portal/hmh-reboot/styles.css` should own `.hmh-upgrade-reroll` (package 8.3: 36 px tall, a 44 px hit area, 8 px below the select button), `.hmh-upgrade-choice__gun` (card 2's chip) and `.hmh-upgrade-announcer` (visually hidden). The child sets inline stopgaps. The hint in `index.html` (`.hmh-upgrade-hint`) should add "R or X re-roll". The no-scroll fit at 390×844, 414×896 and 896×414 needs `visual:reboot` tap geometry. |
| 6 | **Recap titles.** `apps/portal/src/hmh-run-recap.mjs` should name the twelve gun cards from `RUN_UPGRADE_CONTENT` (`progression-content.mjs`). |
| 6 | **Schema 7 before release (again).** The v6 summary cannot name the twelve gun cards, so a v6 child under-reports them. The v7 upgrades and progression rows (`runUpgradeRows`, `runProgressionRow`) are ready for the emission slice. |
| 5 | **Schema 7 before release (again).** A Liquidator kill before tick 72,000 now happens (he is ready at 36,000), which the v6 path rejects (`boss-before-band`), and a defeat drops 25 coins, which v6 bounds at 10. This slice must not ship with a schema-6 child. |
