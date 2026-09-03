# Lester's Arcade / Hard Money Heroes — Mainnet Readiness Reassessment

Date: `2026-09-01`
Audit source: `origin/main @ a17c37cd`
Local improvement branch: `hermes/hmh-cycle-070-gameplay-ui-music`
Release update: Cycle 070 runtime `200757e2` promoted to production on `2026-09-02`; `SETTLEMENT_LIVE=false`

## Executive assessment

Hard Money Heroes is already a substantial deterministic, authored, playable game rather than a prototype shell. The current source has a 12,000 × 4,800 six-district level, authored routes and elevation, six ordinary enemy archetypes, a deterministic Liquidator boss, fixed-tick movement/dash/combat, weapon-specific upgrade branches, encounter bands, minimap discovery, performance profiles, accessibility settings, parent-owned run authority, and prior production certification.

The gap to a credible Mainnet release is not “add everything.” It is to close current release-health drift, turn authored world hooks into real gameplay, reconcile a few runtime/data contracts, validate balance with deterministic telemetry, recertify the exact candidate, and only then exercise approval-gated Web3 flows with real providers.

## What is already complete

| Area | Current evidence |
|---|---|
| deterministic runtime | fixed 60 Hz, maximum four catch-up steps, seeded/replay-safe authority |
| authored level | six districts, six arenas, routes/loops, elevation, bridge/shallow-water crossings, collision blockers, landmarks, 10 POIs, destructibles, hazards, explosive zones |
| enemies | six human/zombie archetypes with idle/run/tell/attack/hit/death states, role-specific tells and counterplay |
| encounter system | six pressure bands from opening through endurance, reserved elite/boss capacity, spawn safety, rest windows, token-family budgets |
| combat/progression | deterministic weapon and boss systems, dash/grenade systems, XP, combo milestones, two-choice seeded drafts, weapon-specific upgrade trees and repeatable mastery sinks |
| performance | desktop/mobile/reduced-motion profiles; culling and animation caps; shared runtime projectile and visual-event caps |
| UI/accessibility | cockpit HUD, pause/settings, minimap discovery, keyboard/gamepad/touch action map, reduced motion/flash, screen-shake and colorblind settings |
| platform authority | portal owns wallet/profile/session/leaderboard/settlement rails; HMH child remains deterministic gameplay authority |
| last certified production | `200757e2`; production `dpl_HAeCyfAG6SDK5x1LruxTMix2CBmQ`; release `2,282 / 2,231 / 51 / 0`; browser/mobile/performance/assets/security/Web3 source gates PASS; `SETTLEMENT_LIVE=false` |
| Cycle 070 live slice | pause-only soundtrack deck with seek/volume/queue; desktop and portrait mobile 7/7 portal flows PASS; exact Preview and production desktop/mobile verification complete |

## Release blockers to close first

### P0. Keep the exact-candidate release gate green

Cycle 070 repaired the two unexpected WO119 failures through MCP 1/2 import compatibility in the PixelLab owner script. The canonical retirement gate now passes with `2,282` tests, `2,231` passes, `51` expected legacy failures, and `0` unexpected failures. Do not expand the retirement ledger.

Cycle 070 completed the canonical gate sequence, exact patch review, protected Preview byte proof, production promotion, and hosted desktop/mobile verification. Preserve this sequence for every later runtime candidate; do not infer release health from Cycle 070 after new source changes.

### P0. Source-of-truth mismatches — completed in Cycle 071

1. **Enemy role truth:** the encounter director now uses canonical role `bruiser` for Whale Enforcer throughout allowed roles, district gates, weighting, and selection. A cross-district/cross-band test requires every `roleApplied: true` result to match the final archetype role.
2. **Projectile budget truth:** all exported encounter-band projectile budgets now consume `MAX_ACTIVE_PROJECTILES = 128`; no public snapshot advertises unreachable `160 / 192 / 220` capacity.

### P0. Direct tests for live HMH authority modules — completed before/through Cycle 071

The current root suite directly imports and behavior-tests `apps/hmh-reboot/src/` movement, encounter director, enemy archetypes, progression, Liquidator, runtime performance, run-summary consumers, and long-run balance. Cycle 071 extends that live harness rather than creating a parallel implementation.

Minimum contracts:

- movement: 60/30/20 render-partition equality, 240-unit speed cap, dead zones, 45 ms reversal response, recoil decay, and collision-safe dash handoff;
- encounter director: all six band boundaries, rest windows, spawn rejection reasons, role gates, body/threat/ranged/projectile/effect budgets, and boss reservations;
- enemy archetypes: required animation states and exact per-family budget costs;
- Liquidator: phase/tick transitions, event cap, six-add readability cap, role checks, punish window, and endless-cycle behavior;
- progression: XP thresholds, seeded two-choice legality, weapon gates, repeatable-rank caps, and level cap;
- performance: profile selection, animation-priority ordering, projectile/visual-event caps, and expired-event compaction.

## Priority roadmap

### P1. Make the towns and world mechanically interactive

The authored data is ahead of the live mechanics. `level-one-world.mjs` defines 10 POIs, eight 80-HP destructibles, five hazards, and three chain-capped explosive zones. Current consumers primarily render them, show them on the minimap, and use reward POIs for encounter rest windows. They are not yet a complete town interaction system.

#### Next recommended vertical slice: destructible town cover

Start with one existing object such as `yard-container-lock`.

- create fixed-tick destructible state from the authored 80-HP definition;
- route existing projectile/melee/grenade hit events through the same combat resolver;
- preserve deterministic stable IDs, damage ordering, replay, reset, and run summary;
- swap intact/damaged/destroyed presentation without changing collision early;
- add bounded debris/audio and an accessible state cue;
- prove 60/30/20 render-partition equality, duplicate-hit rejection, destruction exactly once, reset, and desktop/mobile browser visibility.

Smallest source surface: `level-one-world.mjs`, a new bounded destructible-state module, `main.mjs` consumer/projection, focused tests, and one browser evidence route.

#### Follow-on world interactions

1. **Caches and medbay:** activate `relay-cache`, `relay-armory`, `mining-control-room`, and `yard-medbay-cache` as deterministic single-use or cooldown POIs using existing health/ammo/upgrade authority.
2. **Hazards:** promote `rockfall`, `area-slow`, `moving-hazard`, and `damage-zone` from projection hooks to fixed-tick contracts with clear tells and enemy/player symmetry rules.
3. **Explosive zones:** implement the existing `chainCap: 4` contract with bounded damage/event/audio budgets.
4. **Extraction objective:** turn `yard-extraction-console` into a clear end-of-level objective with authored approach, hold/defend state, and run-summary reason.
5. **Town feedback:** proximity prompt, POI state on minimap, district objective strip, and post-interaction world change.

### P1. Certify late-run encounter and device budgets

Current encounter bands:

| Band | Time | Spawn interval | Body / threat | Full AI / animation | Projectiles |
|---|---:|---:|---:|---:|---:|
| opening | 0–1 min | 120 ticks | 32 / 64 | 24 / 32 | 64 |
| build | 1–5 min | 90 | 64 / 128 | 28 / 40 | 96 |
| pressure | 5–10 min | 60 | 100 / 240 | 32 / 48 | 128 |
| elite | 10–20 min | 45 | 128 / 360 | 32 / 56 | 128 |
| boss | 20–21 min | 60 | 128 / 512 | 40 / 64 | 128 |
| endurance | 21+ min | 30 | 160 / 640 | 32 / 64 | 128 |

Actions:

- [x] reconcile declared versus enforced projectile caps (Cycle 071);
- [x] run deterministic same-seed band snapshots and long-run object accounting;
- [x] run real active-combat desktop and portrait/mobile soaks, not mounted-canvas checks;
- [x] report enemy bodies, full-AI bodies, animated bodies, projectiles, visual events, audio voices, dropped fixed time, p95/p99 update/render time, and median retained heap separately;
- [ ] tune with the smallest numeric/data change only after new evidence identifies a gameplay need.

### P1. Balance progression with telemetry before changing values

Current curve is `150 × level × (level + 1)` with combo milestones `120 / 240 / 480 / 900`, seeded two-option drafts, repeatable late-run sinks, critical upgrades, movement/survival branches, and weapon-specific trees.

Build a deterministic balance matrix across representative seeds and player profiles:

- time to levels 2/5/10/18/25;
- offered versus selected upgrade distribution;
- dead or dominated choices;
- damage, mobility, survival, and weapon-branch outcomes;
- boss time-to-kill and player survival at the 20-minute band;
- XP multiplier snowball and combo-milestone contribution;
- run completion and death band.

Only then adjust XP thresholds, offer count, individual upgrade values, enemy health/damage, or spawn intervals. Preserve one source of expected-value combat math shared with the live resolver.

### P2. Improve movement and combat feel without rewriting authority

Movement already has 240 max speed, 80 ms acceleration, directional turn response, recoil decay, buffered actions, collision-safe dash, elevation and authored surface handling. Improve feel through bounded projection and measured tuning:

1. input-to-first-motion and turn-reversal telemetry for keyboard, gamepad, and touch;
2. camera lead/dead-zone and recoil readability review without mutating actor state;
3. weapon-specific muzzle/recoil/impact identity under visual-event and audio-voice caps;
4. hit/death/recovery readability prioritized by the existing animation selector;
5. enemy tell readability in crowded scenes, including colorblind/reduced-flash modes;
6. district-specific encounter compositions and cover use before adding more enemy classes;
7. Liquidator tell/damage-window tuning using the existing deterministic benchmark, plus a phase-aware integration simulator that models attacks, safe zones, movement, and player downtime rather than relying only on HP ÷ DPS.

### P2. Improve game UI and onboarding

Cycle 070 restores the soundtrack as a pause-only desktop sidecar and mobile drawer. Next UI work should reduce combat ambiguity, not add chrome:

- district name + current objective strip;
- contextual POI/interact prompt tied to real runtime consumers;
- minimap legend for cache, objective, hazard, arena, and boss states;
- compact build summary with current weapon branch, critical stats, mobility, survival, and active effects;
- upgrade cards that show current → next values and prerequisites;
- damage-direction, offscreen elite/boss, and hazard-edge indicators under accessibility settings;
- make `reduceFlash` a true zero-flash path instead of retaining a short four-frame flash, and gate enemy-kill gore VFX on the existing player setting;
- prove that HUD scale, touch opacity/scale/handedness, captions, and colorblind tags affect the live renderer—not only normalized presentation models;
- first-run controls/help flow that truthfully reflects keyboard/gamepad/touch bindings;
- mobile HUD collision matrix for longest weapon/status labels and short landscape;
- pause launcher labels/tooltips and focus-order/keyboard verification.

### P2. Raise visual quality with the existing authored pipeline

Source already provides district materials, landmarks, props, decals, hazard art, production hero/enemy atlases, lighting layers, and projection-safe fallbacks. The next visual pass should focus on composition and identity:

1. make each district identifiable in one second through landmark silhouette, palette, ground motif, prop density, and ambient VFX;
2. replace remaining generic/graybox-facing blocker presentation with approved repo-owned assets while preserving collision IDs;
3. add damage states to interactive cover and environmental reaction states to caches/hazards;
4. improve contact shadows, depth sorting, occlusion, water/bridge layering, and actor grounding;
5. strengthen six enemy silhouettes and tell poses at real gameplay scale before adding more types;
6. author quiet/dense beats and sightline reveals along the 40–70 second traversal target;
7. recertify desktop, portrait, and short-landscape screenshots plus machine-readable visual gates.
8. add one end-to-end sprite test covering atlas load → crop → cache → live render, not only manifest and assembly contracts.

Generated-art Phase 2, Tripo, PixelLab uploads, paid credits, and external generation remain locked until Justin explicitly says `go`. Code-first composition and existing repo-owned asset work can proceed.

### P3. Mainnet and real-value readiness (separately approval-gated)

`SETTLEMENT_LIVE=false` is correct for the current release. Mainnet requires evidence beyond passing source audits:

1. real injected-wallet connect/reconnect and rejection flows in a controlled browser test provider;
2. current ABI ↔ deployed bytecode/read-method compatibility verified by read-only RPC;
3. ranked session, canonical run summary, score candidate, attestation, leaderboard, and settlement exercised end-to-end on the intended testnet;
4. replay/seed/session anti-tamper and duplicate-settlement abuse testing;
5. economic limits, pause/kill switches, rate limits, monitoring, alerting, and rollback runbook;
6. contract and authority review, key custody, signer separation, and explicit deployment addresses;
7. service-worker update/stale-cache certification for the exact candidate;
8. final immutable Preview, browser/network recertification, human playtest approval, and explicit production promotion;
9. separate explicit approval for contract deployment, LitVM writes, Mainnet enablement, or real funds.

## Recommended implementation order

1. Keep the release gate green while reconciling role/projectile truth.
2. Add direct canonical authority-module tests before numeric tuning.
3. Implement one destructible-cover vertical slice.
4. Add deterministic balance matrix + dual-profile active-combat soak.
5. Implement one reward/medbay POI and its UI/minimap feedback.
6. Tune movement/combat only from telemetry and playtest evidence.
7. Run a composition-only visual pass using approved existing assets.
8. Recertify the full exact candidate.
9. Exercise real-wallet/testnet rails only under the separate approval gate.
10. Treat Mainnet deployment and `SETTLEMENT_LIVE=true` as final, explicit decisions—not ordinary polish work.
