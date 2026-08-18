# Hard Money Heroes — Remaining Waves Execution Guide

> **Historical detailed execution reference (2026-08-06):** use `docs/handoffs/2026-08-13-hmh-production-closeout-next-session.md` for current source, production, completed Wave 10 work, remaining items, and the next-session prompt. Retain this guide for detailed acceptance criteria only.

Date: 2026-08-06 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Branch: `reboot/hmh-aaa-continuous`
Local implementation baseline: `88e75585eff94e596116a02a14092f800785cbc9`
Remote branch observed during this handoff: `036d430d33ab7cfd10d05766e99eb9b8da26c235`

> **For Hermes:** use `subagent-driven-development` for execution, with spec-compliance review followed by code-quality review for each bounded slice. Load `hmh-aaa-continuous-improvement`, `software-delivery-lifecycle`, `test-driven-development`, `deterministic-combat-review`, `game-systems-auditing`, and the relevant art, world, UI, or deployment skill before changing that subsystem.

## 1. Purpose and authority

This document replaces the execution status in `docs/handoffs/2026-08-06-hmh-next-session-master-roadmap.md` while retaining its uncompleted design requirements. The older roadmap remains useful for original intent and detailed weapon/world concepts, but its Wave 6–8 status and bundle measurements are stale.

Authority order for the next session:

1. live repository, tests, generated artifacts, and deployment evidence;
2. this remaining-waves guide;
3. the prior master roadmap for detailed intent not superseded here;
4. older task registries and concept catalogs;
5. assumptions only after they are written down and tested.

Do not restore this snapshot over newer work. Reconcile current local HEAD, upstream, index, worktree, build output, and deployment identity before editing.

## 2. Current verified checkpoint

### Completed and committed locally

| Slice | Commit | Status |
|---|---|---|
| Wave 6A canonical run summary | `428be2e4` | Complete |
| Wave 6B history, provenance, combo closure | `cbab316e` | Complete |
| Wave 7 controls, settings, audio, movement, camera, boot | `1c941196` | Complete |
| Stable Pixi vendor split | `0d9b4100` | Complete infrastructure slice |
| Wave 8A Hash Rail | `88e75585eff94e596116a02a14092f800785cbc9` | Complete and separately committed |

Hash Rail staged binary-diff SHA-256 at certification:

```text
e89e1f3200b78409d063c0ae1b993452fd168201c66fbc36684cca0247b9923e
```

Latest accepted release gate after Hash Rail:

```text
HMH_REBOOT_TEST_RETIREMENT_GATE PASS tests=2099 passed=2048 expected_failures=51
```

Latest authored-props reproducibility result, confirmed by two completed runs:

```json
{
  "assetCount": 101,
  "atlasSize": { "width": 1024, "height": 1024 },
  "reproducibleVerified": true,
  "status": "pass",
  "uniqueSourceFrames": 101
}
```

Latest Hash Rail browser evidence passed charge, release, ammunition, projectile, and error checks. Responsive browser certification and network/console audit also passed.

### Current uncommitted Lightning Ledger work

These files exist but are untracked and must remain a separate Wave 8B slice:

- `apps/hmh-reboot/src/lightning-ledger.mjs`
- `tests/hmh-reboot-lightning-ledger.test.mjs`

Focused status:

```text
3 tests passed, 0 failed
```

Implemented only in the pure module so far:

- stable nearest-target selection with `(distanceSquared, targetId)` ordering;
- hard cap of eight chained targets;
- LOS/range filtering;
- six-tick target-loss grace;
- 108-tick/1.8-second break cooldown;
- 180-tick/3-second overheat;
- six cell segments;
- fixed-tick channel start, pulse, release, invalid-target break, overheat, dodge, switch, and empty stop states;
- deterministic damage-ramp values.

This is **not** a certified weapon. It has no complete runtime, pickup, progression, art, audio, VFX, HUD, telemetry, balance, browser, release, or exact-index closure yet.

### Bundle blocker that must be handled honestly

Latest measured raw JavaScript:

```text
Child gameplay entry:     321,272 bytes
Preloaded Pixi vendor:     730,790 bytes
Combined initial child JS: 1,052,062 bytes
Standing aggregate cap:    1,050,000 bytes
Aggregate overage:             2,062 bytes
```

The gameplay entry itself is under the cap, but the standing project rule says the entry plus its preloaded child Pixi vendor chunk count together. The vendor split must not be used to claim aggregate headroom. Before integrating more Lightning code, either:

1. recover enough behavior-preserving child/vendor bytes to put the final candidate below `1,050,000`; or
2. obtain an explicit owner decision changing the cap contract.

Default action is option 1. Do not raise the cap, omit required behavior, hide code in another preloaded chunk, or use compressed-transfer size in place of raw emitted bytes.

### Working-tree caution

The prior master roadmap and current Lightning files were untracked at this checkpoint. Inspect rather than deleting them. No production, wallet, contract, settlement, testnet, or LitVM write occurred during Waves 6–8A.

## 3. Non-negotiable program constraints

1. Fixed 60 Hz child simulation owns canonical gameplay truth.
2. Parent owns persistence, portal presentation, analytics, wallet state, and ranked/publication authority.
3. Bridge messages remain strictly validated and at or below 64 KB.
4. Combined initial child entry plus preloaded Pixi vendor remains at or below `1,050,000` raw bytes unless the owner explicitly changes the contract.
5. Total game delivery remains within the standing 300 MB target.
6. Humans and zombies are the only active combat-actor canon.
7. A12/256 px hero work remains owner-approval-gated and must not be implemented by default.
8. Rendering, animation, lighting, particles, camera, audio, and HUD are projection-only consumers.
9. Generated assets are changed through source manifests/Blender/Python and regenerated reproducibly. Never hand-edit generated production outputs.
10. Browser profiles run serially against one exact built candidate.
11. Every staged edit invalidates the previous exact-index hash and review.
12. Never push a RED, over-budget, unfinished, or inconclusive wave.
13. Website deployment authority never implies wallet, contract, settlement, or LitVM authority.
14. Production promotion requires a clean cloud build, immutable Preview verification, explicit production authorization, live route reconciliation, and a rollback deployment.

## 4. Immediate execution order

1. Reconcile repository/upstream/deployment state.
2. Preserve and rerun the current Lightning focused tests.
3. Measure the exact current entry, vendor, and combined bytes.
4. If aggregate is over cap, complete and separately certify a behavior-preserving byte-recovery slice.
5. Complete Lightning Ledger as Wave 8B.
6. Run the Wave 8 two-weapon benchmark and close Wave 8.
7. Complete Waves 9 through 15 in dependency order.
8. Run final release/exact-index/cloud/promotion/live-proof work only after all implementation waves are certified.

## 5. Wave 8B — Lightning Ledger

### Active design contract

The current in-flight channel design supersedes the older triggered three-target-carbine language in the prior roadmap.

**Role:** clustered-swarm control and support cleanup; intentionally weaker against isolated targets and the Liquidator.

**Authoritative behavior:**

- hold primary fire to maintain a channel while a valid primary target remains;
- first target must satisfy ordinary range, targetability, cover, shield, and LOS authority;
- subsequent arcs use stable nearest-unhit selection by `(distanceSquared, targetId)`;
- hard cap of eight total targets;
- approximately 100 ms/six fixed ticks of target-loss grace;
- broken channel enters 1.8-second/108-tick cooldown;
- damage ramps deterministically from 1× toward 3× across the three-second channel window;
- three seconds/180 ticks forces overheat and a three-second cooldown;
- stop immediately on dodge, weapon switch, empty cells, invalid authority after grace, run reset, death, or pause rules that stop gameplay;
- six visible charge/cell segments are authoritative ammunition/heat state, not a cosmetic-only counter;
- no arc may pass through invalid cover or target an already-hit entity in the same pulse;
- target array reversal and render partitioning must not change results.

### Required tasks

#### 8B.1 Reconcile and harden the pure channel module

Files:

- Modify: `apps/hmh-reboot/src/lightning-ledger.mjs`
- Modify: `tests/hmh-reboot-lightning-ledger.test.mjs`

Add RED tests for:

- duplicate IDs and malformed target data failing closed;
- equal-distance ID tie-breaking;
- target reversal equality;
- exact primary and jump range boundaries;
- blocked first contact and blocked later jump;
- no repeated target per pulse;
- grace at ticks 6 and 7;
- release/dodge/switch/empty/reset behavior;
- overheat at ticks 179 and 180;
- 60/30/20 render-partition equality;
- bounded pulse/event count;
- state reset and restart.

Do not mutate renderer objects or use wall-clock time.

#### 8B.2 Recover aggregate child headroom if still required

Likely files:

- `build.mjs`
- `apps/hmh-reboot/src/pixi-vendor.mjs`
- measured large child modules identified by `apps/portal/dist/meta.json`
- focused preload/cache/build tests

Rules:

- measure before editing;
- make behavior-preserving changes only;
- keep entry/vendor/combined numbers separate;
- add a regression that enforces the actual aggregate contract;
- certify and commit infrastructure independently from Lightning gameplay;
- target at least 15–25 KB of real aggregate headroom so the remaining weapon slice is not built against a few bytes.

Potential safe directions, only after metafile evidence:

- remove unused Pixi re-exports/imports;
- consolidate duplicated fixed tables and validation strings;
- move evidence-only/debug-only code behind an existing non-preloaded diagnostics boundary without hiding gameplay authority;
- reduce redundant generated runtime metadata while preserving deterministic assets;
- tree-shake projection-only helpers proven unused in production.

Do not lazy-load gameplay authority after READY merely to evade the cap.

#### 8B.3 Integrate canonical weapon/loadout authority

Likely files:

- `apps/hmh-reboot/src/weapon-system.mjs`
- `apps/hmh-reboot/src/main.mjs`
- `apps/hmh-reboot/src/input.mjs` only if the existing fire signal cannot express hold/release truthfully
- existing projectile/combat/LOS/elevation modules
- weapon-system and combat tests

Implement:

- canonical `lightning-ledger` definition and loadout order;
- six-segment cell state, finite reserve/recovery policy, switch/reset semantics;
- fixed-tick channel integration;
- authoritative first-hit and chained damage through the existing combat resolver;
- shield/armor behavior per target;
- stop reasons and cooldown state;
- no hidden parent or renderer authority;
- explicit non-dominant isolated-target/boss coefficients.

#### 8B.4 Implement deterministic acquisition event

Likely files:

- `apps/hmh-reboot/src/collectible-system.mjs`
- level/POI or event scheduling authority
- `apps/hmh-reboot/src/main.mjs`
- collectible and same-seed tests

Requirement:

- one deterministic rare biome event capable of awarding the Ledger within the first eight minutes;
- no `Math.random`, wall-clock scheduling, or unbounded retries;
- same seed produces the same event tick/location;
- different seeds produce allowed deterministic variation;
- spawn placement passes nav, collision, protected-radius, and reachability checks;
- event remains human/zombie canon-safe.

#### 8B.5 Add progression branches

Use three deterministic branches with three tiers and one capstone. Reconcile names with the current channel identity rather than copying the old trigger-only mechanics blindly.

Recommended channel-compatible tree:

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Conductivity | larger jump radius | +1 allowed jump up to hard cap | Mesh Network: better late-chain retention, still capped |
| Voltage | higher first-contact damage | faster fixed-tick ramp | Overvoltage: final valid arc gets bounded knockback, no stun-lock |
| Reconciliation | more cell reserve | faster cell recovery | Balanced Books: full eight-target pulse restores one segment once per channel and below cap |

Capstone: **Proof of Network** may improve one deterministic pulse at a fixed channel ordinal, but the total target/effect cap may not increase beyond the certified maximum.

Tests must prove every tier non-vacuously, reset behavior, caps, and no duplicate refunds.

#### 8B.6 Add bounded run-summary telemetry

Likely files:

- `sdk/hmh-run-summary.mjs`
- `sdk/hmh-run-summary-schema.mjs`
- runtime accumulator/adapters
- run-summary and persistence compatibility tests

Track fixed fields only:

- channel starts, clean releases, breaks by bounded reason, and overheats;
- active channel ticks and valid-damage uptime;
- pulse count;
- chain-count histogram with fixed buckets;
- maximum chain and maximum ramp;
- damage by bounded jump index;
- full-chain pulses;
- cell segments spent/refunded/wasted;
- support, elite, and boss contacts/kills/damage;
- damage taken while equipped.

Preserve schema v1/v2 stored-history compatibility. Do not stream per-hit histories to the parent.

#### 8B.7 Produce authored art, audio, VFX, HUD, and accessibility

Likely files:

- `apps/hmh-reboot/assets/source/blender/hmh-authored-props.json`
- `scripts/hmh-blender/create-hmh-authored-props.py`
- `apps/hmh-reboot/src/authored-prop-atlas.mjs`
- deterministic audio generator and child/parent audio registries
- `apps/hmh-reboot/src/main.mjs`
- generated source-owned artifacts and tests

Visual target:

- compact copper/silver emitter or rotating-dish carbine;
- clear six-segment white-blue charge indicator;
- pooled segmented arcs and target flashes;
- no full-screen bloom;
- reduced-flash and colorblind-safe target treatment;
- held silhouette distinct from Hash Rail, shotgun, launcher, and Auto Miner;
- mobile-readable without covering hero, HUD, minimap, or touch controls.

Audio target:

- start/loop/tick/break/overheat identity using the existing allocator and bus caps;
- no unbounded voice per chain target;
- reproducibly generated source and manifest evidence.

#### 8B.8 Browser proof and certification

Create a dedicated browser smoke that:

- obtains/selects the weapon through canonical authority;
- holds fire on a valid clustered fixture;
- proves channel start, ramp, chain count, segment use, target-loss grace, break, and overheat;
- captures desktop and mobile evidence immediately during the defining transient state;
- records screenshot SHA-256 and all console/page errors.

Then run:

```bash
node --test tests/hmh-reboot-lightning-ledger.test.mjs
npm run test:release
npm run build:meta
npm run certify:hmh:browser
npm run audit:hmh:network
git diff --check
```

Regenerate and verify deterministic art/audio twice when changed. Record exact entry, vendor, combined bytes, bundle hashes, evidence paths, and benchmark results.

Stage only Lightning Ledger files. Require exact-index review with literal `BLOCKERS: none`, freeze the binary diff SHA-256, and commit separately with a message such as:

```text
feat(hmh): complete wave 8 lightning ledger
```

### Wave 8 closeout benchmark

Compare Coin Blaster, Hash Rail, and Lightning Ledger at minimum against:

- isolated close/mid/long targets;
- moving targets;
- clustered and spread four/eight-body packs;
- mixed support/heavy pack;
- Liquidator damage window and full-fight estimate;
- ammo/cell exhaustion and downtime;
- projectile/effect/audio pressure;
- 60/30/20 partition equality;
- desktop/mobile real-input smoke.

Lightning should lead clustered clear but remain materially below Hash Rail and Coin Blaster in isolated boss efficiency.

## 6. Wave 9 — Bear Market Burner and Forked Standard

Complete these as two separate weapon commits, followed by one balance closeout.

### 9A Bear Market Burner

1. RED-test a bounded flame-pulse and burn/hazard state before runtime integration.
2. Use fixed-tick pulses rather than thousands of projectile entities.
3. Define non-stacking burn refresh and hard caps for active burns, scorch zones, spread ignitions, effects, and voices.
4. Add finite fuel, reserve, empty, canister swap, cooldown, and reset behavior.
5. Integrate surface-specific scorch and deterministic hazard replacement order.
6. Add AI hazard cost without changing collision truth or permitting teleport/replan abuse.
7. Add three branches, tier-three specials, and capstone from the prior roadmap.
8. Add bounded telemetry for fuel, pulses, contacts, burns, hazards, ignitions, direct/burn kills, and wasted refills.
9. Produce authored projector/canister art, pooled mobile-safe flame VFX, hiss/ignition/empty audio, HUD, and browser proof.
10. Certify and commit Burner alone.

Acceptance:

- strong close corridor and packed-swarm clear;
- poor long-range and limited boss uptime;
- no permanent boss DoT stacking;
- no effect, audio, or hazard-budget runaway;
- no material mobile-p95 regression.

### 9B Forked Standard

1. Decide and test the one truthful melee authority: primary fire alternates thrust/sweep; legacy standalone melee becomes a tested secondary action or is retired from input/help.
2. Use existing deterministic swept melee with explicit arc, reach, elevation, cover, stable ordering, and one hit per target per attack.
3. Add ammo-free cadence/recovery and real whiff cost.
4. Add sweet spot, bounded knockback, guarded wind-up, shockwave, and heavy-sequence branches/capstone.
5. Add touch/controller parity without another screen button unless behavior proves it necessary.
6. Add enemy spacing/recovery interaction without weapon-specific omniscience.
7. Track thrusts, sweeps, contacts, target histogram, sweet spots, blocks, whiffs, knockback, boss windows, and time equipped.
8. Produce authored forked mining spear, hero hand alignment, thrust/sweep VFX, surface/body audio, HUD, and browser proof.
9. Run ledge, one-way-drop, wall, and 60/30/20 partition regressions.
10. Certify and commit Forked Standard alone.

### 9C Eight-weapon balance closure

- Run static, moving, clustered/spread swarm, mixed role, Liquidator, resource, overkill, and pressure matrices.
- Run the 30-minute hero × weapon × enemy × seed simulation.
- Preserve required tactical weaknesses.
- Tune the smallest evidence-supported knob.
- Record machine-readable reports and human playtest notes.
- Commit balance-only changes separately from either weapon implementation.

## 7. Wave 10 — AI, Pathing, Encounters, and Swarm Performance

Execute in small reviewed slices:

1. Instrument baseline active/full-AI/animated bodies, neighbor queries, route replans, stuck recoveries, attack-token occupancy, and projectile/effect pressure.
2. Add deterministic spatial hashing for separation and neighbor queries.
3. Add explicit near/mid/far decision cadence while retaining collision, elevation, bounds, tokens, and hazards every tick.
4. Add cached-route or flow-field steering for distant swarms using the authored navgrid.
5. Add bounded stuck recovery: pause/replan, alternate route, or validated seeded relocation; never random teleport.
6. Lock attack intent and geometry at tell start.
7. Add cover-aware role behavior for suppressors, flankers, heavies, gas bombers, and validators.
8. Add Burner/boss hazard path cost without changing collision truth.
9. Add anti-clumping and anti-perfect-ring behavior.
10. Rank animation budget by boss/tell/hit/death/elite/distance readability.
11. Prove same-seed equality, different-seed divergence, two recurring spawn cycles, low-FPS blocker safety, and 100+ active-body desktop/mobile soak.

**2026-08-16 status:** Cycle 051 locally closes the deterministic benchmark portion of items 1 and 11: 128 active bodies, truthful body/threat/token/projectile/effect maxima, all four token families, same-seed equality, different-seed divergence, two non-vacuous recurrence windows, and one-versus-four fixed-step blocker safety. The real wall-clock desktop/mobile 100+ active-body browser soak remains open; current passing browser performance evidence has only 11 active enemies and must not be used as that proof. Two inherited visual signatures also require baseline reconciliation before Wave 10 closeout.

Do not reduce enemy counts to make the benchmark pass. Optimize queries, cadence, pooling, and projection first.

## 8. Wave 11 — Liquidator, Power-Ups, and Build Checks

### Liquidator

- Preserve the immutable phase timeline and certified presentation.
- Add one authored mechanic per phase: lane/cover rotation, bounded add/safe-sector sequence, and a final high-pressure punish window.
- Reuse one locked geometry object for tell and resolution.
- Keep arena interactions collision-consistent and inside global caps.
- Add role checks without hard immunities: Rail punish, Ledger add clear, Burner zone control, Standard close punish.
- Test no-hit, baseline, high/low DPS, melee-heavy, and crowd-control builds.
- Track phase times, damage windows, adds, per-phase damage taken, and defeat tick.

### Power-ups

- Audit existing heal, caches, time dilation, berserk, and nuke behavior first.
- Improve pickup silhouette, rarity, light pulse, audio, stack/reset policy, and telemetry.
- Only then consider Block Shield, Fee Holiday, Flash Crash, and Liquidity Magnet.
- Keep every effect deterministic, non-stacking or explicitly refresh-based, bounded, reset-safe, and boss-safe.
- Add desktop/mobile safe-area and expiry evidence.

**2026-08-17 Cycle 066 status:** the existing-power-up lifecycle/boss-safety audit is locally complete. Capped healing, repeated weapon-cache reserve limits, explicit non-stacking timed-effect refresh, exact expiry/reset, summary telemetry, 60/30/20 equality, all nine canonical browser pickups, and healthy-Liquidator nuke safety are certified. No new power-up was added.

**2026-08-17 Cycle 067 status (current):** the shared deterministic timed-effect countdown/refresh readout is locally complete. One fixed-tick-derived presentation object now drives desktop/mobile HUD, `aria-live` wording, and browser telemetry; desktop/portrait/landscape prove the active countdown, a double-gated portrait pilot proves refresh plus exact expiry, and normal 13-placement composition is unchanged. The smallest remaining Wave 11 seam is projection-only Time Dilation/Berserk silhouette-and-audio identity from the same snapshot, reusing bounded pooled presentation paths before any new effect is considered.

## 9. Wave 12 — Production Art, Terrain, Lighting, Animation, and VFX

A12 remains excluded without explicit owner approval.

1. Build the industrial/mining kit: headframe, rail segments, chute, compressor/generator, pipes, spoil heap, floodlight.
2. Rework balanced-boulder and driftwood silhouettes.
3. Build roofless-interior and secret/cache modular kits.
4. Finish world/in-hand/pickup/icon/anchor coverage for all eight weapons.
5. Add wet-bank, foam, scree, and cliff-base transition bands.
6. Measure a 1024 px material trial; retain 512 px fallback if decode, memory, or p95 regresses.
7. Add material-specific impact response and source-baked district value breakup.
8. Add projection-only district lighting, pooled light pools, contact shadows, emissive weak/reward accents, and reduced-flash variants.
9. Improve weapon holds, recoil/reload overlays, locomotion/fire/reload transitions, dash landing, hit recovery, and boss tell/recovery silhouettes.
10. Add a pooled VFX registry with hard family caps, priority reservation, decal fade, and truthful drops.
11. Regenerate from repository-owned sources, inspect native outputs/contact sheets, and prove reproducibility.

## 10. Wave 13 — Authored World Expansion

1. Ruined-neighborhood interior packet: two shells, courtyard, alley flank, readable exit.
2. Vertical packet: ravine overlook, loader deck, sunken pit, safe one-way-drop loop.
3. Secret packet: destructible cache, ledge cache, lore prop, minimap discovery.
4. Atmosphere packet: district-specific fog, embers, pollen, and rain inside budgets.
5. Add cover anchors, role lanes, spawn slots, retreat exits, and reward breathing rings.
6. Add LOS landmarks before seams and protect spawn safety.
7. Preserve each district’s distinct combat grammar.
8. Give every blocker visible physical art and every critical crossing radius-based traversal tests.
9. Add visual scenes for each new interior, elevation set-piece, secret, and weather state.

## 11. Wave 14 — Onboarding, Meta UI, Accessibility, Analytics, Docs, and Endurance

1. Add side-by-side hero comparison and selector keyboard/screen-reader/reduced-motion support.
2. Add truthful cabinet metadata and hide unready cabinets.
3. Reduce splash-to-running-session flow to three actions or fewer.
4. Add achievement dates/progress and accessible tooltips.
5. Audit signature explanation, connecting, error, disconnect, and sign-out states without changing wallet authority.
6. Add privacy-conscious funnel analytics with no raw wallet analytics payload.
7. Retire superseded generated art only with provenance and rollback.
8. Refresh public docs to match the certified runtime and deployment boundary.
9. Complete colorblind tags, contrast, critical-audio captions, remapping conflict UX, touch scaling, and HUD scale.
10. Run a real-interaction 30-minute desktop and mobile endurance certification including drafts, restarts, combat, pickups, and production art.

## 12. Wave 15 — Litecoin City First Vertical Slice

1. Reconcile `apps/portal/src/hmh-campaign-levels.mjs` against human/zombie-only canon.
2. Preserve useful geography while replacing every animal, goblin, drone, robot, turret, golem, phantom, or other non-canon actor before runtime use.
3. Create a compact Level 2 contract for districts, materials, POIs, encounters, landmarks, weather, and boss plan.
4. Build only Litecoin Square → one street connector → one optional POI → one human/zombie mini-boss → extraction/return.
5. Add urban kit, rain-slick materials, neon/emissive accents, visible boundaries, nav, minimap, spawn safety, and one production visual scene.
6. Certify traversal, collision, combat, art, mobile, performance, and replay before expanding Level 2.

## 13. Improvement and Upgrade Ideas

These are prioritized opportunities, not permission to bypass the wave order.

### P0 — Release confidence and capacity

- **Aggregate cap enforcement:** make `build.mjs` fail on entry + preloaded vendor, not entry alone, and print all three byte values.
- **Bundle trend report:** retain per-commit entry/vendor/combined history so regressions are visible before the cap fails.
- **Determinism replay diff:** add a compact first-divergent-tick report for same-seed 60/30/20 failures.
- **Certification manifest:** emit one machine-readable candidate record containing HEAD, staged hash, bundle sizes, test ledger, asset hashes, evidence hashes, and deployment boundary.
- **Serial evidence launcher:** one command should build once, choose an isolated origin, then run browser profiles serially.

### P1 — Combat and build clarity

- Add armor, shield, critical, weak-window, and blocked-contact grammar using shape plus color, not color alone.
- Add post-run “build story” from canonical summaries: primary damage source, strongest upgrade contribution, unused potential, and tactical weakness exposed.
- Add bounded weapon-role coaching after repeated whiffs/empties without changing difficulty or aim authority.
- Add deterministic challenge definitions tied to challenge ID, seed/ruleset, schema, build hash, and mode.
- Add offscreen indicators only for committed dangerous tells.

### P1 — Performance and observability

- Add live pool-pressure counters and truthful effect/audio drops.
- Add route-replan/stuck-recovery heatmaps generated from deterministic simulations, not runtime analytics identities.
- Add per-district frame-time and entity-pressure summaries to endurance reports.
- Add automated generated-art ownership checks preventing two pipelines from mutating the same output.
- Add cold-scene reproducibility locks for every Blender owner.

### P2 — World and session depth

- Add reward breathing rings after high-pressure arenas.
- Add optional risk/reward loops that visibly rejoin the main route.
- Add lore props about miners, failed projects, validators, markets, and community survival.
- Add destructible LOS props without changing canonical world boundaries.
- Add district entry silhouettes/signage instead of relying on text banners.

### P2 — Accessibility and player comfort

- Add independent reduced motion, reduced flash, screen shake, hit-stop, and camera recoil controls.
- Add touch-stick recenter and response-curve options.
- Add safe-zone-aware camera framing for interiors and boss arenas.
- Add subtitle/caption families for gameplay-critical audio and ensure captions do not cover touch controls.
- Add export/delete controls for local run history.

## 14. Definition of Done for Every Slice

A slice is complete only when all applicable items are satisfied:

- [ ] live checkpoint reconciled;
- [ ] RED behavior observed before implementation;
- [ ] smallest coherent fixed-tick implementation completed;
- [ ] focused tests pass;
- [ ] same-seed and 60/30/20 equality pass where gameplay changes;
- [ ] reset/restart and malformed-input paths pass;
- [ ] art/audio regeneration is reproducible twice when changed;
- [ ] native assets/contact sheets and live desktop/mobile frames reviewed by eye;
- [ ] entry, vendor, and combined initial bytes recorded honestly;
- [ ] static/moving/swarm/boss/long-run evidence regenerated where relevant;
- [ ] `npm run test:release` passes with the expected-failure titles unchanged;
- [ ] build, network, console, responsive browser, performance, and heap gates pass;
- [ ] only the intended slice is staged;
- [ ] `git diff --cached --check` and credential-pattern scan pass;
- [ ] staged binary diff SHA-256 is frozen;
- [ ] exact-index review returns `PASS` and literal `BLOCKERS: none`;
- [ ] any staged fix causes a new hash and review;
- [ ] slice is committed separately;
- [ ] no unrelated roadmap, scratch, evidence profile, cache, temporary render, or listener is left behind.

## 15. Final Shipping Wave

Shipping is not local green status or a local commit.

1. Reconcile local HEAD, upstream, `origin/main`, index, worktree, and all wave certifications.
2. Run full release, build, syntax/check, network, console, responsive browser, visual, performance, heap, endurance, path, and credential gates against one exact candidate.
3. Confirm combined initial child JS and total game delivery budgets.
4. Run final exact-index architecture, deterministic combat, security, release-risk, and release-candidate reviews.
5. Push the reviewed branch and verify remote HEAD equals local HEAD.
6. Obtain a clean cloud Preview build; record deployment ID and immutable URL.
7. Verify Preview routes, asset hashes, service worker/cache identity, responsive behavior, console/network state, and candidate-byte parity.
8. Stop before production unless production promotion is explicitly authorized in the active session.
9. If authorized, promote the verified immutable deployment rather than rebuilding an unverified candidate.
10. Prove live routes:
   - `https://lestersarcade.io/hmh-reboot/`
   - `https://lestersarcade.io/games/hard-money-heroes/play`
11. Reconcile deployed JS/artifact hashes, aliases, service worker, console/network, and production behavior.
12. Record the new deployment and retain the prior known-good deployment as rollback.
13. Confirm production promotion did not perform or authorize any wallet, contract, settlement, testnet, or LitVM write.

## 16. First Action in the Next Session

Begin with checkpoint reconciliation and the current Lightning module. Do not start Bear Market Burner until Lightning Ledger is fully integrated, under the aggregate cap, certified, reviewed, and committed as its own slice.
