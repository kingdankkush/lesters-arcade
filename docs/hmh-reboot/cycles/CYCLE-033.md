# HMH AAA Continuous Improvement Cycle 033

Status: `LOCAL CERTIFIED · EXACT-INDEX REVIEW PENDING · PRODUCTION UNTOUCHED BY THIS CYCLE`
Date: 2026-07-29 PDT
Branch: `reboot/hmh-aaa-continuous`
Baseline: `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`

## Objective

Make ordinary enemies more forgiving and satisfying to hit after Cycle 032 restored their human-scale presentation, while preserving collision bodies, visual scale, movement, AI, attack reach, weapon damage, encounter pacing, boss targeting, fixed-step determinism, and parent authority.

## Audit

Before Cycle 033, the live runtime created ordinary-enemy projectile and melee targets directly in `main.mjs`:

- collision body radius: the authored archetype radius;
- hurt capsule half-length: `8` world units;
- vulnerable radius: `max(8, bodyRadius * 0.72)`;
- vertical band: `4..60` world units;
- boss target: separate `48`-radius circle with `4..92` vertical band.

For the standard `18`-radius ordinary body, the vulnerable radius was `12.96`. A deterministic 4,000-shot cross-track measurement using seed `0x484d4833`, a `±30` world-unit aim-error band, and the real swept projectile resolver produced:

- contacts: `3,075 / 4,000`;
- hit rate: `76.875%`.

The collision body was intentionally left untouched. The measured gap was isolated to the vulnerable projectile/melee core.

## RED

Added `tests/hmh-reboot-enemy-hurtboxes.test.mjs` before production code. The first focused run failed with:

```text
ERR_MODULE_NOT_FOUND: apps/hmh-reboot/src/enemy-hurtboxes.mjs
exit code: 1
```

The RED contract requires:

- an explicit versioned ordinary-enemy hurtbox policy;
- standard-body vulnerable radius `16.2` while collision radius remains `18`;
- shared projectile and melee generosity;
- unchanged capsule half-length and vertical band;
- deterministic seeded contact-rate evidence;
- a bounded `30`-unit deliberate miss that remains a miss;
- identical hit events at 60, 30, and 20 fps render schedules;
- live runtime consumption with no stale `0.72` duplicate.

## GREEN

Added `apps/hmh-reboot/src/enemy-hurtboxes.mjs` with policy:

```text
id: cycle-033-forgiving-ordinary-enemy-hurtbox-v1
radius scale: 0.90
minimum radius: 10
capsule half-length: 8
vertical band: 4..60
```

`createOrdinaryEnemyHurtboxProfile(bodyRadius)` returns a frozen, radius-keyed cached profile shared by projectile and melee targeting. `main.mjs` now builds both target lists in one ordered pass over active enemies.

For the standard `18`-radius body:

- collision radius: `18` before and after;
- vulnerable radius: `12.96 → 16.2`;
- projectile radius scale: `0.72 → 0.90`;
- measured contacts: `3,075 → 3,523` of `4,000`;
- measured hit rate: `76.875% → 88.075%`;
- gain: `+11.2 percentage points`;
- a `30`-unit cross-track shot remains a miss.

The boss retains its distinct `48`-radius circle and `4..92` vertical band.

## Deterministic boundary

The new profile changes only ordinary-enemy vulnerable geometry used by the existing projectile and melee collision resolvers.

Unchanged:

- ordinary enemy collision bodies and separation;
- hero collision body;
- visual projection scales (`0.75` ordinary / `0.86` boss);
- projectile speed, radius, damage, policies, elevation, and cover ordering;
- melee range, angle, cooldown, damage, and terrain legality;
- enemy health, armor, movement, AI, attack ranges, spawn budgets, and encounter scheduling;
- RNG streams, fixed `60 Hz` simulation, and maximum four catch-up steps;
- save, replay, parent portal, Web3, and settlement authority.

The 60/30/20 schedule contract produced identical non-empty fixed-tick contact events.

## Verification

Focused:

- new hurtbox contracts: `4/4` PASS;
- projectile, melee, and enemy-simulation suites: `53/53` PASS;
- syntax: `334` JavaScript modules + `49` Python scripts;
- release ledger: `1,787 total / 1,735 passing / 52 accepted legacy / 0 unexpected`.

Build and assets:

- production build: PASS;
- HMH bundle: `1,021,923 / 1,050,000 bytes`;
- production asset QA: PASS;
- hero atlas total: `12,220,253 / 12,582,912 bytes`;
- roster atlas total: `6,448,834 / 10,485,760 bytes`;
- visual regression: `8/8` unchanged.

Browser/runtime:

- desktop/mobile/bridge combat smoke: PASS;
- five-profile Chrome certification: PASS;
- deterministic anchors: zero or sub-threshold pixel delta;
- desktop performance p95: `7 ms`;
- mobile performance p95: `7 ms`;
- mobile controls: `4/4` devices PASS;
- network audit: four scenarios with zero HTTP, request, console, or page failures.

## Release boundary

Cycle 033 is local-only unless the user separately authorizes another exact production release.

- no push, merge, preview, or production deployment is part of this cycle;
- no contract, wallet, signature, transaction, or settlement action occurred;
- `SETTLEMENT_LIVE=false` remains required;
- the live production baseline remains `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3` until separately promoted.

## Next bounded slice

Begin the first enemy-family model and animation readability wave:

1. audit native atlas coverage and rare-state quality for the closest-range ordinary enemy families;
2. preserve the shared runtime projection and new Cycle 033 hurtbox policy;
3. define RED identity, authored-part, rig, state, and decoded-frame contracts;
4. rebuild only a bounded enemy-family wave through the repository-owned Blender pipeline;
5. inspect all directions and idle/run/tell/attack/hit/death states at full resolution;
6. measure atlas budget, browser readability, crowd performance, and mobile control clearance;
7. keep all art/animation changes projection-only.
