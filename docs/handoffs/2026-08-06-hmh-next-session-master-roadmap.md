# Hard Money Heroes — next-session master roadmap and task handoff

> **Historical design reference (2026-08-06):** use `docs/handoffs/2026-08-13-hmh-production-closeout-next-session.md` for current source, production, remaining items, wave status, and the ready-to-paste next-session prompt. Retain this roadmap for detailed design intent only.

Date: 2026-08-06 PDT
Prepared for: the next Hermes/Fable implementation session
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Branch: `reboot/hmh-aaa-continuous`
Source/deployed head at handoff: `036d430d33ab7cfd10d05766e99eb9b8da26c235`

> **For Hermes:** load `hmh-aaa-continuous-improvement`, `software-delivery-lifecycle`, `test-driven-development`, `deterministic-combat-review`, `game-systems-auditing`, and the relevant art/level skill before implementation. Execute one bounded vertical slice at a time. Do not treat this backlog as permission to change every system at once.

## 1. Executive direction

Hard Money Heroes is a deterministic 2.5D browser swarm-action game. Its strongest next move is not a broad rewrite. It is a sequence of small vertical slices that preserve the certified fixed-tick simulation while steadily improving authored presentation, build variety, readable combat, session meaning, and long-run replay value.

The immediate implementation dependency is **D1 run-summary authority**. It unlocks useful profile history, truthful leaderboards, challenge provenance, weapon balancing, and future per-build analysis. After D1, prioritize controls/settings/audio truth, then add the four new weapons in two measured waves, then deepen AI, boss encounters, and the authored world.

The target experience:

- responsive on keyboard/mouse, gamepad, and touch;
- readable at 100+ enemies without reducing human/zombie identity to abstract proxies;
- authored districts with strong route, landmark, encounter, and reward grammar;
- eight weapons with distinct tactical jobs rather than linear DPS upgrades;
- deterministic skill trees that produce recognizable builds;
- boss encounters that test positioning and build decisions instead of only health totals;
- one canonical final run record that explains what happened without exposing wallet authority to the child;
- production art and audio regenerated from repository-owned source;
- 60 FPS target on desktop and 30 FPS floor on supported mobile profiles;
- total delivery kept within the standing 300 MB game target and the unchanged child JavaScript cap.

## 2. Live checkpoint: reconcile before editing

### Git and production

- Branch: `reboot/hmh-aaa-continuous`
- Local HEAD and upstream at handoff: `036d430d33ab7cfd10d05766e99eb9b8da26c235`
- Production: `https://lestersarcade.io`
- Production deployment: `dpl_EXCT6MgEwBrsURnMCy45UUMfbRii`
- Immutable production URL: `https://lesters-arcade-5izcc6snr-justin-agent-projects.vercel.app`
- Gameplay routes:
  - `https://lestersarcade.io/games/hard-money-heroes/play`
  - `https://lestersarcade.io/hmh-reboot/`
- Future releases can use `dpl_EXCT6MgEwBrsURnMCy45UUMfbRii` as the known-good rollback target.

The older verification note in `2026-08-05-hmh-wave-1-2-fable-ledger.md` says production was not promoted. That sentence is historical and was superseded by the deployment above.

### Current certified gates

- Release ledger: **2,055 entries = 2,004 current passes + 51 expected failures**
- Syntax: **336 JavaScript modules + 49 Python scripts**
- Child bundle: **1,046,662 / 1,050,000 bytes**
- Child headroom: **3,338 bytes**
- Child SHA-256: `871511d8501948bba858200134cc32a24e829542803278f1bc266cf94455ce65`
- Visual regression: **12 pinned production scenes**
- Runtime performance: approximately **7 ms p95** in the latest accepted desktop/mobile evidence
- Authored props: **100**; atlas **259,679 / 524,288 bytes**
- Enemy roster: **7 actors, 1,368 frames, 4,985,197 bytes**
- Hero atlases: **2,592 frames, 12,279,348 bytes**
- Selector atlas: **498,000 / 524,288 bytes**
- Production browser proof passed desktop and portrait mobile with one canvas, no horizontal overflow, no failed requests, and no console/page errors.

### First commands in the next session

```bash
cd '/c/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade'
git fetch origin
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse '@{upstream}'
npm run build:meta
stat -c '%s' apps/portal/dist/hmh-reboot/game.js
sha256sum apps/portal/dist/hmh-reboot/game.js
```

Stop and reconcile if HEAD, upstream, bundle bytes, or the production deployment differs from this handoff. Two agents may share the branch. Never restore this snapshot over newer verified work.

## 3. Non-negotiable constraints

1. **Child JavaScript stays at or below 1,050,000 bytes.** Parent cleanup does not buy child headroom. Measure the child after every child-runtime patch.
2. **A12 remains owner-gated.** Do not begin 256 px hero generation, raise the hero atlas cap, or alter the 160×160 source contract without explicit approval. A13 motion is complete at the current resolution.
3. **Humans and zombies only.** No animals, goblins, robots, drones, turrets, monsters, or vehicles as combat actors. The older `apps/portal/src/hmh-campaign-levels.mjs` contains future-concept enemies that conflict with current canon. Its spatial and set-piece ideas may be mined, but every future roster must be recanonized as human or zombie before runtime use.
4. **Deterministic authority.** Simulation runs on fixed ticks. RNG uses named seeded streams. Entity ordering is stable. Rendering, audio, camera, particles, lighting, and animation remain projection-only.
5. **No generated-asset hand edits.** Fix Blender/Python/manifests, regenerate, prove byte or canonical-pixel reproducibility, inspect contact sheets, and run production asset QA.
6. **No hidden gameplay authority in the parent.** The child owns gameplay. The parent owns profile persistence, portal presentation, analytics, wallet state, and ranked/free publication.
7. **No wallet, contract, settlement, testnet, or LitVM write without a separate HALT approval.** `SETTLEMENT_LIVE=false` remains binding.
8. **Sequential browser gates.** Do not run browser smokes in parallel. Rebuild once, serve one isolated origin, run profiles serially, then inspect full-resolution evidence.
9. **Exact-index review is fail-closed.** Freeze `git diff --cached --binary`, record SHA-256, require literal `BLOCKERS: none`, and re-review after any staged change.
10. **Human visual review remains required.** Green metrics do not make a clipped, generic, doubled, tiny, or unreadable asset acceptable.

## 4. Shipped baseline: do not rebuild these as if missing

The next agent should treat these as certified foundations unless a current behavioral test proves a regression:

- authored Forked Frontier world with six districts, authored routes, POIs, encounters, elevation, collision, minimap, and ruined-neighborhood/set-piece pass;
- 100 deterministic authored props and 12 production visual scenes;
- terrain sub-materials, contract-anchored ground decals, road variants, bridge kit, camps, water, trees, undergrowth, rocks, town kit, and six district landmarks;
- four production heroes with distinct motion profiles and improved selector framing at 160 px;
- six ordinary enemy roles plus the Liquidator boss, role-native attacks, directional damage responses, gas-bomber canister flight, boss phase presentation, phase audio, label, and segmented bar;
- current weapons: Coin Blaster/Pistol, Scatter Shotgun, Auto Miner/Machine Gun, and Launcher Rig/Grenade Launcher;
- per-weapon fire/reload/empty audio and per-weapon recoil/impact feedback;
- deterministic swarm benchmark and 192-run long-run simulator;
- XP from defeats, Litecoin token, no-damage kill-combo milestones, deterministic two-card upgrades, mastery tail, critical-hit routes, pistol depth tree, and enemy-band rebalance;
- current pause controls card and first-run controls hint;
- shared child design tokens;
- 100 ms action buffering for fire, melee, grenade, and dash;
- portal route modularization, legacy runtime retirement, explicit simulated-wallet labeling, heap-gate hardening, persistence/run-history foundations, and game-over surface;
- production deployment and real-browser desktop/mobile verification.

## 5. Status reconciliation of the official backlog

The 2026-08-03 task registry remains useful, but its status text predates later waves. Use this reconciled matrix.

### Completed or substantially closed

- **T1, T2, T4:** terrain sub-materials, ground decals, and road materials.
- **A1–A7 and A9:** trees, undergrowth, rocks, water, bridges, town kit, camp kit, and landmark set-pieces.
- **A13–A15:** hero motion, enemy identity/readability, and Liquidator presentation.
- **W1–W3:** density, ruined town district, and enemy encampments.
- **C1, C2, C6:** weapon audio/VFX identity foundation, combat feedback, and swarm benchmark.
- **M1:** controls card and first-run hint exist. Keep them truthful when inputs change.
- **M5 partial:** input buffering is done; drop-edge forgiveness, landing dust, and cooldown polish remain.
- **S1–S5:** long-run simulation, XP sources, critical routes, pistol tree, and enemy-band rebalance. The older S3 wording is stale; `precision-ledger` and `hard-fork-rounds` are already live.
- **U1:** child imports shared design tokens.
- **U10:** portal modularization.
- **U11a:** explicit simulated-wallet labeling. Remaining wallet UX details are still open.
- **U12:** game-over surface exists; do not create a parallel one.
- **P2, P6:** heap-gate hardening and legacy runtime retirement.
- **P5 baseline:** 12 scenes exist; every new district, boss state, power-up, or weapon presentation still needs new coverage.

### Open or partial official work

| ID | Status | Remaining work | Dependencies / notes |
|---|---|---|---|
| D1 | **NEXT / open** | Versioned deterministic final run summary and strict bridge validation | Unblocks U6/U7 and all reliable weapon balance history |
| D2 | Open | Privacy-conscious portal funnel analytics | Parent-owned; start after D1 event names settle |
| D3 | Partial | No-damage combo core exists; add max-combo authority, feedback, final summary, and leaderboard/profile use | Must not duplicate S2 combo state |
| T3 | Open | Shore, foam, wet-bank, cliff-scree transition bands | Projection-only, visual scenes required |
| T5 | Measure first | Evaluate 1024 px hero-visible road/water/slab materials | Mobile decode/memory gate; 512 px remains fallback |
| A8 | Open | Industrial/mining kit: headframe, rails, chute, compressor, pipes, spoil heap, floodlight | Natural asset-shaped next art slice |
| A10 | Expanded | Models/icons for four new weapons and any new power-ups | Replace old two-weapon scope with the four-weapon plan below |
| A11 | Ongoing rule | Wire every new asset through roster, district placement, count locks, QA, and reproducibility | Never a standalone “done forever” task |
| A12 | **Owner-gated** | One-hero 256 px experiment only after explicit budget approval | Do not start by default |
| W4 | Open | Roofless interiors/enclosures with authored entrances | Preserve nav and visible collision |
| W5 | Open | More ledges, pits, ramps, terraces, and one-way drops | Requires traversal/projectile/melee elevation tests |
| W6 | Open | Secrets, destructible-cache routes, ledge cache, lore props | Minimap discovery already exists |
| W7 | Open | Fog, embers, pollen, rain, district atmosphere | Stay inside particle/effect budgets |
| W8 | Planning | Level 2 authored production | Reconcile legacy non-human actors before implementation |
| C3 | Open / expanded | Add Hash Rail, Lightning Ledger, Bear Market Burner, and Forked Standard | Two weapon waves, not one giant commit |
| C4 | Open | Give melee a truthful role and touch/controller path, or retire it | Forked Standard is the recommended solution |
| C5 | Open | Deepen Liquidator mechanics, adds, counters, and arena use | Presentation is complete; gameplay depth is new scope |
| M2 | Audit/close | Reconcile current keyboard/gamepad/touch map with actual consumers and controls card | Controls help exists, but every action must be behaviorally verified |
| M3 | Open | Rebinding, sensitivity, aim-assist toggle, left-handed touch layout, parent persistence | Bridge/settings schema change; child-byte cost |
| M4 | Open | Measure latency, acceleration/deceleration, diagonal response, turning, camera follow | Measure before tuning |
| M5 | Partial | Drop forgiveness, landing dust, dash cooldown feedback | Input buffer already complete |
| M6 | High-priority open | Chunk ~400 ms navgrid build before input binding without losing touch release | Naive session deferral was reverted; behavioral iPhone regression required |
| M7 | Open | Aim look-ahead, encounter framing, boss zoom | Projection-only; reduced-motion and visual baseline gates |
| S6 | Open | Pause-menu current-build summary with run-card ranks and weapon trees | Uses canonical progression snapshots |
| U2 | Open | Full pause music transport backed by parent playlist | Parent owns metadata/position; child sends intents |
| U3 | Partial | Side-by-side hero comparison, reduced-motion guard, carousel position indicator, arrow navigation | Selector framing/hero motion are already complete |
| U4 | Open | Cabinet metadata, session length, control/mode fit, thumbnail, primary action; hide unready cabinets | Parent-only |
| U5 | Open | Reduce five-step start flow to three or fewer and add truthful competitive proof | Parent-only; do not fake social proof |
| U6 | Open | Per-hero/per-weapon records, PBs, build history, ranked/free split | Depends on D1 |
| U7 | Open | Audit/remove or clearly segregate seeded house scores; add provenance filters | Depends on D1 for richer truthful rows |
| U8 | Open | Achievement unlock dates, progress meters, keyboard/screen-reader tooltips | Parent persistence migration |
| U9 | Open | Music/SFX sliders, input settings, control summary | M3 + X2 |
| U11 | Partial | Explain signatures before prompt and verify connecting/error/sign-out states | Mock labeling and “Connecting” text exist; audit current behavior before editing |
| X1 | Partial | Surface footsteps, dash, level-up, upgrade select, low-health, pickup and UI cues | Weapon cues and boss phase cue are complete |
| X2 | Open | Music/SFX/UI buses, global and family caps, distance attenuation, ducking | Reuse parent audio registry; do not grow a second allocator |
| X3 | Open | Preserve track and position across portal/game transitions | Follows U2 |
| P1 | Owner action | Vercel automation bypass if protected deployment blocks automated certification | Never store bypass secret in repo |
| P3 | Open | Audit/retire superseded generated art from the 57 MB generated tree | Provenance and rollback required |
| P4 | Open | Update public docs that still describe old cycles | This handoff is internal, not a full public-doc rewrite |
| P5 | Ongoing | Add visual scenes for every new set-piece/weapon/boss/UI state | Scene must declare what it gates |

## 6. Recommended future wave order

### Wave 6A — D1 canonical run-summary authority

**Goal:** produce one truthful, bounded final record without per-hit bridge spam or duplicated gameplay authority.

Tasks:

1. Write RED protocol tests for a new `game:run-summary` child message and capability.
2. Define schema version 1 with exact keys, fixed enums, integer bounds, maximum collection lengths, and a 64 KB envelope failure test.
3. Add one compact child accumulator. Prefer fixed arrays and enum indices internally to conserve bundle bytes; expose readable names only in the final snapshot.
4. Track identity: seed, build hash, mode, hero, terminal reason, start/end ticks.
5. Track totals: survival ticks/ms, score, level, XP, Litecoin count, current/max combo, damage dealt/taken, healing, distance.
6. Track kills by canonical enemy role, weapon, elite, and boss. Kill attribution must come from the authoritative final damage source, not whichever weapon is selected when the death resolves.
7. Track accuracy separately:
   - trigger shots and trigger contacts;
   - pellets/projectiles emitted and pellet/projectile contacts.
   Shotgun trigger accuracy and pellet accuracy must never collapse into one number.
8. Track weapon lifecycle: pickups, swaps, reload starts/completes, empty attempts, time equipped, damage, kills, critical hits, overkill, and weapon-specific bounded metrics.
9. Track grenades: thrown, detonated, contacts, kills, self-damage, and overflows.
10. Track collectibles/power-ups: collected counts by fixed asset/effect ID and bounded active duration totals.
11. Track upgrades offered and selected by fixed catalog ID. Do not send arbitrary text or an unbounded event history.
12. Track exploration from accepted movement/reveal authority: visited district bitset, discovered POI bitset, revealed cell count/percentage, and cumulative accepted movement distance.
13. Build/freeze the summary exactly once at terminal state; send `game:run-summary` before the existing score-result/game-over pair.
14. Extend `run-adapters.mjs` so score checksum compatibility remains intact. Do not replace existing ranked result authority in D1.
15. Extend `sdk/hmh-bridge-protocol.mjs`, child `bridge.mjs`, portal host, and portal lifecycle with strict validation and duplicate/finalization protection.
16. Persist the canonical summary parent-side with a schema migration and the existing 50-run history limit.
17. Add same-seed replay equality, 60/30/20 partition equality, reset/restart, malformed payload, oversized payload, duplicate final, and no-zero-placeholder tests.
18. Add a short real browser run that verifies exactly one summary reaches the parent and agrees with score-result/game-over.
19. Rebuild and measure after each coherent layer. If the complete truthful schema does not fit, recover child bytes; do not truncate fields or raise the cap.

Likely files:

- Create: `apps/hmh-reboot/src/run-summary.mjs`
- Modify: `apps/hmh-reboot/src/main.mjs`
- Modify: `apps/hmh-reboot/src/run-adapters.mjs`
- Modify: `apps/hmh-reboot/src/bridge.mjs`
- Modify: `sdk/hmh-bridge-protocol.mjs`
- Modify: `apps/portal/src/hmh-reboot-host.mjs`
- Modify: `apps/portal/src/hmh-reboot-portal-lifecycle.mjs`
- Modify: `apps/portal/src/persistence.mjs`
- Tests: protocol, bridge, lifecycle, persistence, combat attribution, accuracy, exploration, and browser smoke tests under `tests/`

Acceptance:

- one final canonical message;
- no arbitrary/unbounded maps or arrays;
- no per-hit bridge stream;
- exact schema rejection for missing/extra/wrong-type/out-of-range data;
- final serialized envelope below 64 KB in a maximum valid fixture;
- summary, score result, and game over agree;
- no wallet address, signature, token, or settlement data in child summary;
- same-seed replay and render-partition equality;
- child at or below 1,050,000 bytes.

### Wave 6B — profile history, leaderboard provenance, and combo closure

**Goal:** turn D1 into player value without mixing free, ranked, verified, and seeded records.

Tasks:

1. Migrate parent persistence to retain schema-versioned summaries and preserve old minimal run records.
2. Build profile filters for hero, weapon, mode, date, and result.
3. Show personal bests: score, survival, level, max combo, boss clear, damage, and accuracy.
4. Show build history: selected run upgrades and per-weapon tree ranks.
5. Show per-weapon usage, damage, kills, accuracy, reload/empty rates, and best clear.
6. Show per-hero run count, PBs, preferred weapons, and completion rate.
7. Make Ranked, Free, verified, local-only, and seeded-house provenance explicit.
8. Audit `leaderboard-seed.mjs`; either remove house scores from public boards or put them in a visibly separate demo tab.
9. Close D3 by exposing max combo, current combo, break reason, milestone feedback, and summary/history use without creating a second combo counter.
10. Add keyboard/screen-reader table semantics, mobile cards, empty states, and migration tests.

### Wave 7 — child capacity, boot responsiveness, controls, settings, and audio

**Goal:** make the game easier to start, control, and hear before expanding combat complexity.

Tasks:

1. Run child-specific esbuild input attribution after D1. Recover measured bytes before further child-heavy work; do not assume portal modularization helps.
2. Implement M6 chunked navgrid build in idle slices before input binding. Preserve deterministic grid output and prove no dropped pointer-up on portrait mobile.
3. Complete M2 action-map audit across keyboard, gamepad, and touch.
4. Implement M3 rebinding and parent-persisted input settings.
5. Add aim-assist strength/off options that alter only input interpretation, never enemy state or RNG.
6. Add sensitivity/deadzone curves and left-handed touch layout with containment/non-overlap tests.
7. Complete M4 measurements before movement tuning.
8. Finish M5 edge forgiveness, landing dust, and cooldown readability.
9. Implement U9 settings and X2 audio buses together so UI controls have real runtime consumers.
10. Implement X1 remaining cue families and X3 music continuity via the existing parent allocator.
11. Add M7 camera look-ahead and boss framing behind reduced-motion-safe projection settings.

### Wave 8 — official weapon expansion: Hash Rail and Lightning Ledger

**Goal:** add the two previously planned weapons as complete vertical slices, one weapon at a time.

Order:

1. common weapon-stat/tracking extension after D1;
2. Hash Rail simulation and tests;
3. Hash Rail model/icon/audio/VFX/HUD/browser evidence;
4. exact review and commit;
5. Lightning Ledger simulation and tests;
6. Lightning model/icon/audio/VFX/HUD/browser evidence;
7. exact review and commit;
8. two-weapon benchmark and long-run comparison.

Do not ship both weapons in one unreviewable staged patch.

### Wave 9 — combat-role expansion: Bear Market Burner and Forked Standard

**Goal:** add area denial and a first-class melee build while keeping effect and collision budgets bounded.

1. Add bounded hazard/burn state and benchmark before the Burner.
2. Implement Burner simulation, art, audio, VFX, HUD, tracking, and AI hazard awareness.
3. Give C4 a decision: Forked Standard becomes the truthful melee weapon and existing melee input maps to it, or legacy melee is retired.
4. Implement swept spear attacks, touch/controller parity, hit-stop/recoil projection, tree, tracking, and enemy spacing reactions.
5. Run four-new-weapon balance matrix and 30-minute long-run certification.

### Wave 10 — AI, pathing, encounter, and swarm-performance depth

**Goal:** improve intelligence without reducing active enemy counts or skipping safety.

1. Keep current encounter bands and budgets as the baseline: 32/64/100/128/128/160 body caps, 64→220 projectile caps, 96→320 effect caps, fixed attack tokens, and seeded role mixes.
2. Add explicit near/mid/far decision cadence. Sample steering/target choices, but run collision, elevation, bounds, attack-token release, and hazard safety every fixed tick.
3. Add deterministic spatial hashing for separation and neighbor queries.
4. Add flow-field or cached-route steering for distant swarms; preserve authored navgrid and one-way drop rules.
5. Add stuck detection with authored bounded outcomes: pause/replan, alternate route, or validated seeded relocation. Never random teleport.
6. Lock attack intent at tell start. Enemies may not track the player during a committed dodgeable tell.
7. Rank animation budget by gameplay readability: boss, active tell, hit/death, true elite, then distance.
8. Add cover-aware roles: suppressors seek authored firing anchors; flankers choose distinct side lanes; heavies hold chokepoints; gas bombers deny escape lanes; validators support without stacking.
9. Add hazard awareness for Burner zones and boss arena hazards. Hazard cost may affect path choice, not collision truth.
10. Add deterministic anti-clumping and anti-ring rules so 100+ enemies remain readable and do not form one perfect circle.
11. Add live metrics: active bodies, full-AI bodies, animated bodies, neighbor queries, route replans, stuck recoveries, token occupancy, projectile/effect pressure.
12. Require two successful recurring spawns, same-seed composition equality, different-seed divergence, low-FPS blocker safety, and active-gameplay desktop/mobile soak.

### Wave 11 — boss depth, power-ups, and build checks

**Goal:** turn the Liquidator into a build-and-position test without changing the already-certified presentation identity.

Liquidator tasks:

1. Preserve the immutable phase timeline and existing label/audio/visual transition.
2. Add one authored mechanic per phase:
   - **Market Open:** lane telegraphs and cover rotation;
   - **Margin Call:** bounded add wave plus marked safe/unsafe arena sectors;
   - **Total Liquidation:** high-pressure sequence with a clear punish window.
3. Reuse one locked geometry object for telegraph and resolution.
4. Add arena interactions that are visibly physical and collision-consistent.
5. Reserve adds, projectiles, effects, animations, and audio inside existing global caps.
6. Add weapon-role checks without hard immunities: Rail punish window, Lightning add clear, Burner zone control, Forked Standard risky close punish.
7. Test no-hit, baseline, high-DPS, low-DPS, melee-heavy, and crowd-control builds.
8. Record phase times, damage windows, add kills, damage taken by phase, and defeat tick in D1-compatible bounded fields.

Power-up tasks:

1. Audit existing heal, weapon-cache, Litecoin, time-dilation, berserk, and nuke effects for pickup clarity, stack policy, reset, and tracking.
2. Add distinct pickup silhouettes, rarity frames, world light pulses, and audio families.
3. Consider four new deterministic power-ups only after tracking exists:
   - **Block Shield:** absorbs one valid damage event, maximum one stored charge;
   - **Fee Holiday:** temporary reload/heat-recovery improvement, non-stacking refresh;
   - **Flash Crash:** short fixed-tick enemy movement debuff, no damage and no boss stun-lock;
   - **Liquidity Magnet:** temporary pickup-radius increase, no economy multiplication.
4. Snapshot timed attack modifiers at attack creation so in-flight attacks do not change at expiry.
5. Track collected count, active ticks, damage prevented or time saved, and waste at cap.
6. Add desktop/mobile HUD safe-area and expiry-readability evidence.

### Wave 12 — art, textures, models, lighting, animation, and VFX quality

**Goal:** raise perceived production value mostly through asset-shaped work that does not consume child code.

Environment/models:

1. Build A8 industrial/mining kit: real headframe, rail segments, tipple chute, generator/compressor, pipe runs, spoil heap, floodlight mast.
2. Re-concept held-out assets:
   - `balanced-boulder` becomes a fractured cleft/wedged formation;
   - `driftwood-log` becomes a vertical tidewrack/root-plate pile.
3. Add roofless-interior modules: broken wall corners, doorframes, half-height cover, collapsed roof beams, stairs, loading dock, shop counters.
4. Add secret/cache modules: breakable false wall, locked crate, lore terminal, stash marker, ledge-cache platform.
5. Add all four weapon world models, in-hand silhouettes, pickup bases, icons, muzzle/effect anchors, and contact sheets.
6. Keep collision proxies separate from rendered bounds and share the same ground-contact projection.

Terrain/materials:

1. T3 wet-bank, foam, scree, and cliff-base transition bands.
2. Measure T5 1024 px road/water/industrial-slab trial on mobile; reject if decode, memory, or p95 regresses.
3. Add material-specific impact response: earth dust, rock chips, water splash, metal sparks, wood splinters.
4. Add subtle district-specific roughness/value breakup in the source bake, not a per-frame shader tax.
5. Preserve route legibility under every grade and weather state.

Lighting:

1. Add a projection-only district lighting plan: cool wet crossing, green-black Hashwood, warm industrial camp, sodium/neon liquidation yard.
2. Add authored light pools around streetlights, campfires, boss machinery, and reward POIs.
3. Add consistent contact shadows and soft occlusion under actors/large props using the shared 55° projection contract.
4. Add emissive accents for pickups, weapon cells, boss weak windows, and critical interactables.
5. Add reduced-flash and reduced-motion variants; lighting may never become gameplay authority.
6. Prefer baked/pooled overlays over one dynamic light per object.

Animation:

1. Add weapon-family hold/recoil/reload overlays or authored clips without multiplying the full hero atlas unnecessarily.
2. Improve transition readability: locomotion→fire, fire→reload, dash landing, hit recovery, knockback, and death settle.
3. Add boss phase-specific attack tells and recovery silhouettes beyond the existing scale pulse.
4. Add secondary motion sparingly: coats, straps, banners, hoses, canister spin.
5. Audit rare frames at native resolution for clipped hands, detached parts, tiny alpha islands, and duplicate semantic poses.

Particles/VFX:

1. Introduce a pooled VFX registry with hard family caps and truthful drops.
2. Reserve effects in this order: boss tell, player damage, enemy attack tell, weapon impact, pickup/reward, ambient weather.
3. Weapon VFX remain coded particles/primitives where appropriate; do not turn ordinary bullets into sprite animations.
4. Add decal lifetime/fade policies and prevent unbounded ground clutter.
5. Gate every effect under normal, mobile, reduced-motion, and reduce-flash profiles.

### Wave 13 — authored level and game-world expansion

**Goal:** make Forked Frontier feel like a sequence of memorable places rather than a dressed corridor.

1. W4 roofless interior packet in the ruined neighborhood: two enterable shells, one courtyard, one alley flank, one readable exit.
2. W5 vertical packet: ravine overlook, mining loader deck extension, sunken industrial pit, and one safe one-way drop loop.
3. W6 secret packet: destructible cache, ledge cache, hidden lore prop, and minimap discovery feedback.
4. W7 atmosphere packet: fog banks, embers, pollen, and rain, each district-specific and budgeted.
5. Attach authored encounter staging to spaces: cover anchors, role lanes, add spawn slots, retreat exits, reward breathing rings.
6. Add line-of-sight landmarks before each district seam and preserve the protected spawn radius.
7. Give each district one combat identity:
   - Frontier Relay: orientation and low-pressure onboarding;
   - Rugpull Ravine: flank lanes and elevation;
   - Liquidity Crossing: bridge/shallow-water positioning;
   - Hashwood: occlusion, ambush, and close lanes;
   - Mining Camp: industrial cover and ranged crossfire;
   - Liquidation Yard: boss approach, ruined blocks, and escape loops.
8. Every blocker must have visible physical art. Every critical crossing needs player-radius entry/full-crossing/exit tests.
9. Add visual scenes for every new interior, elevation set-piece, secret, and weather state.

### Wave 14 — onboarding, meta UI, accessibility, and platform polish

1. U3 hero comparison and selector accessibility.
2. U4 truthful cabinet metadata and removal/hiding of unready games.
3. U5 ≤3-click route from splash to running HMH session.
4. U8 achievement dates, progress, and accessible tooltips.
5. U11 signature explanation and complete connection/error/sign-out audit.
6. D2 privacy-conscious funnel analytics with no raw wallet analytics payload.
7. P3 generated-asset retirement with provenance and rollback.
8. P4 public docs refresh.
9. Colorblind tags, contrast, subtitle/caption strategy for critical audio tells, remapping conflicts, touch-control scaling, and low-vision HUD scale.
10. 30-minute active desktop/mobile endurance run with real interactions, upgrade drafts, restarts, and production-art readiness.

### Wave 15 — Level 2: Litecoin City planning and first vertical slice

Do not build all of Level 2 at once.

1. Reconcile `hmh-campaign-levels.mjs` against active canon. Replace every animal/goblin/drone/robot concept with a human or zombie equivalent before runtime work.
2. Keep useful spatial concepts: Litecoin Square hub, harbor, financial core, privacy-themed grove/neighborhood, hashrate district, parks, and penthouse approach.
3. Create a compact Level 2 metadata contract that shares engine systems but owns districts, materials, POIs, encounters, landmarks, weather, and boss plan.
4. Build one vertical slice: Litecoin Square → one street connector → one optional POI → one mini-boss → extraction/return.
5. Add urban kit, rain-slick material set, neon/emissive accents, visible boundaries, nav, minimap, spawn safety, and one production visual scene.
6. Only expand after the first slice passes traversal, collision, combat, art, mobile, performance, and replay gates.

## 7. Four new weapons

All numbers below are **prototype hypotheses**, not final balance authority. Tune through the existing static, moving-target, swarm, boss, and 30-minute simulators. Each weapon must have at least one clear weakness and may not dominate every benchmark dimension.

### 7.1 Hash Rail — precision rail rifle

**Role:** longest-range precision and lined-up penetration; strongest deliberate single-target/elite punish; weakest under close swarm pressure and missed shots.

**Core behavior:** scarce finite cells, a readable pre-fire charge/tell, very fast projectile, narrow line, limited penetration, strong recoil. Charge timing is fixed-tick state. The shot snapshots aim when released; presentation may anticipate but never alter collision.

**Prototype starting envelope:** 3-cell magazine, 15-cell reserve, slow reload, roughly 0.6–0.8 triggers/second, long range, two-target base penetration. Measure before locking damage.

| Branch | Tier 1 | Tier 2 | Tier 3 special |
|---|---|---|---|
| **Hashrate** | Faster charge/cadence | Faster projectile and shorter post-shot recovery | **Zero Confirmation:** every fourth successful trigger skips part of charge; deterministic shot ordinal, not RNG |
| **Merkle Bore** | Damage increase | +1 penetration and reduced falloff through bodies | **Deep Proof:** bounded armor bypass and one additional body; never infinite pierce |
| **Cold Wallet** | More reserve cells | Faster reload and +1 magazine cell | **Cell Rebate:** a shot contacting at least three distinct enemies refunds one cell, once per shot and within reserve cap |

**All-branch capstone — Genesis Block:** fully charged shots emit a slightly wider readable core and gain a bounded elite/boss weak-window multiplier. It must not add arbitrary targets or bypass cover.

**Tracking:** triggers, charged triggers, cancelled charges, projectiles, contacts, penetrations, enemies per shot histogram capped to fixed buckets, damage, overkill, elite kills, boss damage, reloads, empty attempts, refunded cells, time equipped.

**AI/encounter interaction:** rushers and flankers naturally punish charge time; suppressors force line-of-sight decisions; authored straight lanes reward alignment. AI may react to the visible charge cue but cannot read input before the cue or dodge using hidden weapon state.

**Art/VFX/audio:** long silver/blue rifle, visible capacitor/cell, thin charge line that is explicitly non-authoritative, short high-energy tracer, entry/exit sparks, cell-eject effect, strong but reduced-flash-safe firing cue.

**Balance gates:** best or near-best deliberate boss/elite DPS when accurate; materially worse 8-body clear and close-range survival than crowd weapons; miss/empty rate must remain meaningful; no shot may exceed projectile/effect caps.

### 7.2 Lightning Ledger — chaining arc carbine

**Role:** clustered-swarm control and support-unit cleanup; weaker isolated-target and boss efficiency.

**Core behavior:** first contact uses ordinary projectile/target authority; subsequent arcs select nearest eligible unhit targets with stable `(distance, targetId)` ordering. Chain count and radius are hard capped. Cover policy must be explicit and tested.

**Prototype starting envelope:** 8-charge magazine, finite reserve, moderate reload, roughly 1.2–1.6 triggers/second, three total targets at base, damage retention per jump below 100%.

| Branch | Tier 1 | Tier 2 | Tier 3 special |
|---|---|---|---|
| **Conductivity** | Larger jump radius | +1 chain target | **Mesh Network:** one further target and improved late-jump retention, still under a fixed maximum |
| **Voltage** | First-hit damage | Critical chance/damage route through existing seeded authority | **Overvoltage:** the final valid jump applies bounded knockback; no stun-lock |
| **Reconciliation** | More reserve | Faster reload and +2 magazine | **Balanced Books:** a full-length chain returns one magazine charge, once per trigger and below cap |

**All-branch capstone — Proof of Network:** every sixth trigger creates one secondary arc from the first target to a separate bounded chain. Deterministic trigger ordinal, fixed total target cap.

**Tracking:** triggers, first contacts, chain jumps, unique targets/trigger fixed histogram, full chains, damage by jump index, critical hits, support kills, refunds, reloads, empties, boss damage.

**AI/encounter interaction:** punishes tight clusters and validator support formations. Separation steering may reduce accidental clumps, but AI must not spread merely because the weapon is equipped. Support units continue seeking allies; that creates an intentional risk/reward cluster.

**Art/VFX/audio:** forked copper/silver carbine, coil glow, pooled segmented arcs, target flashes, no full-screen bloom, distinct crack/chain tail, colorblind-safe target outlines.

**Balance gates:** top four/eight-body clear in clustered fixtures, below Rail/Pistol isolated boss efficiency, no chain through invalid cover, stable target order under reversed entity arrays, effect count inside band budget.

### 7.3 Bear Market Burner — fuel-based flamethrower

**Role:** close-range area denial, corridor control, and sustained swarm clear; weak at range, against spread-out enemies, and while repositioning/reloading fuel.

**Core behavior:** held fire emits bounded fixed-tick flame pulses, not thousands of independent projectiles. Contacts apply a non-stacking burn with refresh policy. Optional ground scorch zones are fixed-count hazards with stable replacement order and explicit AI nav cost.

**Prototype starting envelope:** finite fuel tank and reserve, no criticals on damage-over-time ticks unless explicitly routed through a tested policy, short cone, high effect pressure, forced cooldown or fuel reload.

| Branch | Tier 1 | Tier 2 | Tier 3 special |
|---|---|---|---|
| **Liquidity** | Larger tank | Lower fuel use / faster canister swap | **Deep Reserves:** one emergency partial refill on first empty per run segment; bounded and tracked |
| **Volatility** | Higher direct flame damage | Longer burn duration without stacking | **Capitulation:** a burning defeat ignites at most two nearby enemies with a per-tick global cap |
| **Contagion** | Wider cone | Longer range and better edge damage | **Fire Sale:** creates one short-lived scorch patch on sustained contact; fixed maximum active patches |

**All-branch capstone — Total Selloff:** sustained fire briefly raises cone pressure after a deterministic fuel-spend threshold, then forces a cooldown. No RNG, no permanent ramp.

**Tracking:** fire-held ticks, fuel spent, flame pulses, contacts, unique burning enemies, burn ticks, direct/burn damage, spread ignitions, scorch patches, patch contacts, kills by direct/burn/spread, over-cap wasted fuel/refills, self-hazard contacts if allowed.

**AI/encounter interaction:** nearby enemies may route around authored active scorch cost when an alternate path exists; collision and attack tokens still run every tick. Heavies may resist knockback but not silently ignore burn. Ranged enemies punish the short range. Gas-bomber zones create positional conflict without hidden elemental combos unless separately designed and tested.

**Art/VFX/audio:** industrial fuel projector, backpack/canister silhouette if compatible with hero framing, tapered flame ribbon built from pooled particles, heat distortion only if mobile-safe, surface-specific scorch, fuel hiss/ignition/empty sputter.

**Balance gates:** strong corridor and close-swarm clear, poor long-range and boss uptime, bounded burn/scorch state, no effect-budget runaway, no boss permanent DoT stacking, mobile p95 unchanged within accepted threshold.

### 7.4 Forked Standard — shock spear / polearm

**Role:** ammo-free high-risk melee control, precise sweeps, knockback, and close punish windows. This gives C4 a real purpose and a truthful touch/controller path.

**Core behavior:** primary fire alternates thrust and sweep using existing deterministic swept-melee authority. No invisible auto-hit. Range, arc, elevation, cover, one-hit-per-target, and stable hit ordering are explicit. The weapon uses recovery/cadence rather than ammunition.

**Prototype starting envelope:** moderate thrust reach, wider but lower-damage sweep, clear recovery, no reserve ammo, close-range commitment, limited boss uptime.

| Branch | Tier 1 | Tier 2 | Tier 3 special |
|---|---|---|---|
| **Long Fork** | More thrust reach | Wider sweep arc | **Reach Consensus:** tip sweet spot gains bounded damage; body of spear does not |
| **Momentum** | Damage increase | Knockback increase through existing collision authority | **Chain Reversal:** third confirmed hit emits a short cone shockwave capped at four targets |
| **Validator Guard** | Shorter recovery after a hit | Brief frontal damage reduction during authored wind-up only | **Slashing Protection:** one perfectly timed frontal block reduces, never erases, damage and has a fixed cooldown |

**All-branch capstone — Hard Fork:** deterministic thrust/sweep sequence gains a final heavy sweep after three confirmed attacks. It cannot trigger from misses, cannot hit through cover, and remains one event per target.

**Tracking:** attacks, thrusts, sweeps, contacts, unique targets/attack histogram, sweet-spot hits, shockwave contacts, blocked/reduced damage, damage, kills, knockback distance, whiffs, recovery ticks, boss-window damage, time equipped.

**AI/encounter interaction:** melee enemies contest spacing; heavies resist displacement; gas bombers and suppressors punish overcommitment; flankers attack recovery. AI does not gain weapon-specific omniscience. The spear’s readable wind-up may be perceived like any other visible player action if a general reaction system is later added.

**Controls:** primary fire uses existing fire input, so touch does not need an eighth button. Existing standalone melee action must either become a secondary spear action with truthful help text or be retired. Do not leave two overlapping melee authorities.

**Art/VFX/audio:** forked mining/validator spear, clear tip, thrust smear, sweep arc, small bounded shock effect, impact audio by surface/body, hero hand alignment and no detached weapon parts.

**Balance gates:** viable ammo-free fallback but not safest all-purpose weapon; whiff/recovery cost remains real; deterministic swept collision at ledges and 60/30/20 partitions; no through-wall or multi-hit-on-one-target defect; touch aim and keyboard/controller parity.

## 8. Cross-system balance and tracking contract for eight weapons

### Tactical identity matrix

| Weapon | Primary strength | Required weakness |
|---|---|---|
| Coin Blaster | Reliable all-round precision/build flexibility | Moderate crowd clear and finite reserve pressure |
| Scatter Shotgun | Close burst and broad cone | Range dispersion and reload exposure |
| Auto Miner | Sustained suppression | Heat/reload commitment and lower burst |
| Launcher Rig | Splash and packed targets | Slow cadence, overkill, limited ammo |
| Hash Rail | Long-range elite/boss precision | Miss punishment and close-swarm pressure |
| Lightning Ledger | Clustered multi-target clear | Isolated target and boss efficiency |
| Bear Market Burner | Corridor denial and sustained close swarm | Range, fuel, and effect pressure |
| Forked Standard | Ammo-free melee control | Positional risk, whiff/recovery, ranged threats |

### Required benchmark matrix

Every weapon tier should be evaluated against:

- static single target at close/mid/long range;
- moving target at authored strafe/rush patterns;
- four- and eight-body packs with spread and clustered layouts;
- mixed-role pack with support and heavy;
- Liquidator no-hit damage window and full-fight TTK;
- projectile/effect pressure;
- reserve exhaustion, reload blocking, empty attempts, heat/fuel downtime;
- overkill and wasted damage;
- 30-minute hero × weapon × enemy × seed long-run matrix;
- desktop/mobile real-input smoke.

Rules:

1. No weapon may be best in single-target, swarm, safety, ammo economy, and boss damage simultaneously.
2. Use the smallest balance knob supported by evidence; do not rewrite a weapon when one range/cadence/ammo value is wrong.
3. Expected-value simulation imports live crit/armor/proc helpers. No duplicate balance math.
4. Special mechanics have hard caps, stable ordering, truthful overflow counters, and reset tests.
5. Weapon-specific metrics are bounded fixed fields, never free-form event histories.
6. Balance decisions require both simulator evidence and human playtest notes; neither replaces the other.

## 9. Additional improvement ideas beyond the official registry

### Combat readability

- enemy health-tier damage presentation that does not obscure attack tells;
- clear armor/shield/critical hit grammar with distinct sound and colorblind-safe shapes;
- short hit-stop only on high-value contacts, disabled under reduced motion;
- weapon-specific camera recoil envelope rather than one shake amount;
- offscreen threat arrows only for committed high-risk tells, not every enemy;
- damage-direction vignette that never hides the hero or touch controls;
- death cleanup that preserves score/readability without piling bodies indefinitely.

### Movement and traversal

- coyote/edge forgiveness only where authored one-way drops permit it;
- movement-surface feedback: dust, wet splash, gravel kick, metal footstep;
- aim-facing and movement-facing decoupling with deadzone stability;
- controller response curves and touch-stick recenter options;
- dash trail that communicates start/end and invulnerability without implying a larger hitbox;
- camera safe zones around HUD/minimap/touch controls;
- optional screen-edge resistance or camera framing in roofless interiors, projection-only.

### Skill trees and build clarity

- one mid-run build summary sourced from canonical ranks;
- branch color, icon, and one-line mechanical outcome on every card;
- show next-rank delta, capstone condition, and current weapon compatibility;
- prevent dead offers and duplicate max-rank choices;
- add a deterministic reroll only if long-run evidence shows choice starvation;
- add post-run “build story”: highest-impact upgrade, damage source mix, and unused branch potential;
- keep repeatable mastery weaker than authored finite branches.

### Session and challenge design

After D1:

- daily/weekly challenges should bind challenge ID, seed/ruleset, schema version, build hash, and mode;
- free/offline challenge results remain local and clearly labeled;
- ranked publication remains parent-owned and requires existing integrity gates;
- examples: clear a district with no damage, win using two weapon families, reach a combo milestone, defeat Liquidator under a damage-taken cap, discover all POIs;
- never create challenges that require wallet spend, excessive grind, inaccessible precision timing, or one hero/weapon only;
- run records should support deletion/export and stay privacy-conscious.

### AI personality without cheating

- rushers: commit, overshoot, recover;
- flankers: choose distinct side lane and stop tracking once attack tell locks;
- suppressors: hold authored sightlines and relocate after bounded volleys;
- heavies: occupy space, resist displacement, expose slow punish windows;
- gas bombers: deny predicted escape lanes using locked targets;
- validators: support nearest eligible ally with non-stacking bounded effects;
- elites: combine two readable behaviors, never simply multiply every stat;
- all decisions use visible state, authored geography, stable ordering, and seeded choices—never hidden player input or future position.

### World storytelling

- district entry signage and silhouette rather than text-only banners;
- environmental progression from broken frontier infrastructure to dense industrial/urban extraction;
- lore props that reveal miners, failed projects, validators, markets, and community survival without adding non-canon creatures;
- reward breathing rings after intense arenas;
- destructible props that create temporary lines of sight without changing canonical world boundaries;
- optional routes that rejoin the main spine and telegraph risk/reward before commitment.

## 10. Definition of done for every future slice

- RED test written and observed failing for the exact missing behavior;
- smallest coherent implementation, no unrelated cleanup;
- current HEAD/upstream reconciled before staging;
- deterministic authority and projection boundaries documented;
- focused tests pass;
- `npm run test:release` passes with exact expected-failure titles, not only count;
- `npm run check` and `git diff --check` pass;
- asset generation/QA reproducible twice when assets change;
- child and parent bundles measured separately;
- applicable static/moving/swarm/boss/long-run reports regenerated;
- browser profiles run serially on the exact built candidate;
- full-resolution desktop/mobile evidence inspected by eye;
- performance/network/heap gates pass without relaxed thresholds;
- staged binary diff frozen and SHA-256 recorded;
- exact-index independent review returns `PASS` and literal `BLOCKERS: none`;
- any fix causes restage, new digest, rerun of affected gates, and re-review;
- implementation and documentation closeout committed separately;
- remote branch verified equal to local HEAD;
- Preview verified before production;
- production promotion requires explicit direction, real-browser proof, deployment ID, alias, and rollback target;
- no Web3 write unless separately authorized through the HALT gate.

## 11. Recommended first task for the next session

Start with **Wave 6A / D1 only**. Do not begin profile UI, new weapons, or settings in the same staged slice.

Ready-to-paste prompt:

> Continue Hard Money Heroes from `docs/handoffs/2026-08-06-hmh-next-session-master-roadmap.md`. Reconcile the live branch, upstream, child bundle, and production deployment before editing. Then implement only Wave 6A D1 canonical run-summary authority using RED-first tests. Preserve fixed-tick determinism, existing score-result/game-over authority, the 64 KB bridge limit, the 1,050,000-byte child cap, parent-owned persistence/ranked authority, and all human/zombie and Web3 safety boundaries. Track real values only; do not use zero placeholders or an unbounded event history. Run focused and full gates sequentially, measure the child after every coherent layer, obtain exact-index review with literal `BLOCKERS: none`, commit implementation and closeout separately, push, verify Preview parity, and stop before production unless explicitly directed.

## 12. Canon and scope warning for future world work

`apps/portal/src/hmh-campaign-levels.mjs` contains useful Level 2 district, POI, environment, and route ideas, but it also contains animals, goblins, drones, bots, golems, phantoms, turrets, and other actors that conflict with active Hard Money Heroes canon. Treat those enemy definitions as deprecated concept placeholders. Before Level 2 runtime work:

1. preserve useful geography, landmark, reward, and counterplay ideas;
2. replace every combat actor with a human or zombie role;
3. update tests and design docs to assert the canon;
4. do not import the conflicting roster into the Reboot runtime;
5. obtain visual/canon review before generating any new actor source.

This warning is load-bearing. Green metadata or existing code does not authorize non-canon actors.
