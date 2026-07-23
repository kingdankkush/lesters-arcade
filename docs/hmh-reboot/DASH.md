# Phase 13: Deterministic Dash and Skill-Tree Integration

## Status

Phase 13 implements a deterministic, fixed-tick Dash for the isolated PixiJS child runtime and retunes the retained parent-owned `dash-cooldown` skill ID to the required 10/8/6-second contract.

## Simulation contract

| Property | Contract |
|---|---|
| Simulation rate | 60 fixed ticks per second |
| Base cooldown | 600 ticks / 10 seconds |
| Upgrade tier 1 | 480 ticks / 8 seconds |
| Upgrade tier 2 | 360 ticks / 6 seconds |
| Dash duration | 8 ticks / 133.33 ms |
| Dash distance | 192 world units |
| Invulnerability | 8 ticks, exactly the Dash displacement window |
| Cooldown origin | Activation tick, not completion tick |
| Input edge | One activation per press; held input cannot retrigger |
| Direction | Normalized movement direction, falling back to normalized aim direction |

Cooldowns, movement, invulnerability, and readiness use integer simulation ticks. Paused, upgrade, game-over, and exited states do not invoke simulation steps, so Dash cannot consume cooldown or displacement while those states are inactive.

## Collision and enemy-pressure order

`apps/hmh-reboot/src/dash.mjs` owns the deterministic Dash state and world-step policy:

1. Find the earliest swept boss contact using stable time then stable-ID ordering.
2. Resolve the full movement segment through the canonical authored collision world with `stopOnFirstContact: true`.
3. Resolve the same segment through the canonical elevation/traversal query.
4. Stop immediately on a boss, hard blocker, upward cliff, disallowed ledge, or deep water.
5. Apply bounded regular-enemy yield using the existing stable-ID pressure solver.
6. Commit actor and enemy positions to runtime state.

Dash never teleports through a blocker or samples only its endpoint. It does not create separate collision geometry, invisible barriers, or alternate elevation rules.

## Invulnerability decision

Phase 13 uses brief invulnerability rather than displacement-only Dash behavior. `filterDashInvulnerableHits()` removes only player-targeted hits during the eight authoritative Dash ticks. Enemy-targeted hits retain their original IDs and order. Rendering, HUD, VFX, and audio cannot extend or shorten this window.

## Skill-tree and authority integration

The compatibility-critical parent skill ID remains `dash-cooldown`.

- The parent skill tree now exposes exactly two ranks at player level 10.
- Rank 1 changes the absolute `dashCooldownSeconds` stat from 10 to 8.
- Rank 2 changes it from 8 to 6.
- The draft presents rank 2 as a continuation after rank 1 and removes the card after max rank.
- `buildUpgradeRuntimePolicy()` consumes the absolute stat while retaining the old multiplier fallback for previously materialized legacy run state.
- Persistence, draft choice, profiles, progression, and upgrade authority remain parent-owned.

The protected `hmh-bridge/v1` schema is unchanged and has no gameplay-modifier field. The reboot child therefore defaults to tier 0 and exposes deterministic tier construction for the parent-authoritative progression adapter scheduled in the later HUD/progression/Web3 integration phase. No child persistence, score authority, wallet, settlement, achievement, analytics, or profile authority was added.

## Player feedback

- Desktop keyboard: Shift.
- Gamepad: standard Dash action already mapped in the canonical input state.
- Mobile: existing safe-area-aware `DASH` touch button.
- Visible liquid-glass cooldown pill: `Dash ready`, `Dash active`, or whole seconds remaining.
- Screen-reader status: polite atomic live output.
- Bounded cyan trail during displacement and one readiness ring when cooldown reaches zero.
- Debug-only attributes report active, invulnerable, ready tick, and stop reason only when `debugGrid=1`.

No new audio asset or production dependency was introduced. The repository contains no dedicated Dash sample, so Phase 13 does not reuse a misleading weapon sound.

## Behavioral coverage

- `tests/hmh-reboot-dash.test.mjs`
  - exact 600/480/360 tick cooldowns;
  - normalized movement and aim fallback;
  - exact 192-unit/eight-tick displacement;
  - exact eight-tick invulnerability;
  - held/cooldown rejection;
  - pause-stable tick state;
  - no tunneling through blockers, cliffs, or deep water;
  - boss stop and stable regular-enemy yield;
  - player-only hit filtering;
  - fail-closed public inputs.
- `tests/hmh-reboot-collision.test.mjs`: canonical collision behavior remains intact with opt-in first-contact stopping.
- `tests/hmh-upgrade-tree.test.mjs`: retained ID, two ranks, absolute 10/8/6 values, continuation draft behavior, and max-rank removal.
- `tests/hmh-upgrade-runtime.test.mjs`: new absolute policy and legacy multiplier fallback.
- `tests/hmh-reboot-shell.test.mjs`: runtime, accessible HUD, debug gating, and cache-version wiring.

## Certification evidence

- Focused Phase 13/core regression gate: 85/85 passed before the final authority-helper addition; the Dash suite then passed 9/9 and the draft suite 6/6.
- Production build: passed; child bundle 829.7 KB before final rebuild.
- Dedicated 20-minute Dash soak: `.tmp/hmh-reboot-phase13-dash-soak.json`.
  - 60/30/20 FPS partitions identical for every tier;
  - tier 0: 120 starts, 23,040 units, 960 active/invulnerable ticks;
  - tier 1: 150 starts, 28,800 units, 1,200 active/invulnerable ticks;
  - tier 2: 200 starts, 38,400 units, 1,600 active/invulnerable ticks;
  - zero dropped simulation time;
  - repeat hash `016ee2a785ab8241837b4f071dfc2f8b9ce9ed862e64528432c823113df63f80`;
  - GC-exposed heap delta 194,936 bytes.
- Desktop/mobile browser report: `.tmp/hmh-reboot-phase13-browser.json`.
  - keyboard and touch Dash activated;
  - both stopped at the visible north rail with `hard-blocker`;
  - accessible cooldown status reported;
  - zero page or console errors;
  - refreshed screenshots in `.hermes/evidence/hmh-reboot-phase8-combat/`.
- Service-worker cache version: `lesters-arcade-v4-hmh-reboot-09`.

## Final candidate gate

- Focused reboot suite: 170/170 passed.
- Full suite: 1,475 total; 1,422 passed; exactly 53 retired-art failures matched `LEGACY-TEST-RETIREMENT.json`; zero missing and zero unexpected failures.
- Syntax check: 319 JavaScript modules and 40 Python scripts passed.
- Build: passed; child bundle 849,702 bytes (829.8 KB).
- Security audit: PASS, 5/5 checks, 503 files scanned, zero findings.
- Load-speed report: PASS; 6.15 MB emitted JavaScript across 26 files; zero source maps by default.
- Strict repository health: PASS.
- Portal interaction smoke: PASS.
- Phase 12 combat regression soak: unchanged repeat hash `6e6820f8f2d9039d8e17aca11c2001b125f10465cc44334bbc842fb1cbe0b830`.
- Final desktop/mobile Dash browser smoke: PASS with zero page or console errors.
