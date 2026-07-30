# Cycle 036 — mobile weapon access and deterministic combat readability

Date: 2026-07-30 PDT
Branch: `reboot/hmh-aaa-continuous`
Status: certified local-only
Baseline: `88a8b13a80b9acc0d4de757eb970e3d52dad1872`
Source: `15629ebac9e1004f2b41760aedd3e67cc406f5c3`
Exact commit patch SHA-256: `5fa3e71570a20d1ca5b4166df06c041e244e9a7315645ae74f797752686847d6`
Production: unchanged at `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`
Settlement: unchanged with `SETTLEMENT_LIVE=false`

## Goal

Close one measured mobile combat-readability gap without changing weapon damage, collision, AI, spawning, RNG, progression, bridge authority, or settlement authority.

The preimplementation audit found that keyboard and gamepad could select every retained weapon, while touch-only players received movement, aim, power, and pause controls but no weapon-selection action. Touch players therefore remained on the starting pistol unless another runtime path selected a weapon for them. The compact HUD also exposed only the current magazine count and heat; it did not identify magazine capacity or make reload and switching downtime explicit.

## RED contract

The initial focused RED run failed seven assertions because the required contracts did not exist:

1. the touch layout had no `weapon` control;
2. the browser touch adapter had no visible weapon action;
3. the control could not emit the existing canonical `weaponNext` rising edge;
4. the smallest portrait and phone-landscape layouts had no fifth-control containment contract;
5. the weapon system had no projection-only readability snapshot;
6. the runtime HUD and stage evidence lacked clip-size, mode, and reload-time state;
7. browser/mobile certification still expected the obsolete four-control contract.

The final focused packet passes `71/71` tests.

## Implementation

### Touch weapon access

- Added a visible `SWAP` utility button to the touch adapter.
- Routed it through the existing canonical `weaponNext` action; no new simulation command or weapon-switch rule was introduced.
- Mirrored `SWAP` above the movement stick and `POWER` above the aim stick.
- Preserved safe-area containment and generic control-to-control non-overlap checks in portrait and landscape.
- Updated production-hero, mobile-control, combat, and release-browser certification to require the five-control child contract.

### Deterministic weapon readability

- Added `getWeaponReadabilityStatus()` as a frozen, projection-only read of authoritative weapon state.
- The helper validates the render tick, never advances weapon state, and reports:
  - selected weapon ID and display name;
  - current rounds and progressed magazine capacity;
  - `ready`, `reloading`, `overheated`, `switching`, or `empty` mode;
  - deterministic fixed-tick and one-decimal-second countdowns where applicable;
  - compact HUD and accessible labels.
- The HUD now identifies the active weapon as `WEAPON rounds/capacity` and exposes `RELOAD`, `COOLING`, `SWITCH`, or `EMPTY` when actionable.
- Stage evidence now exposes weapon clip size, mode, reloading state, and remaining reload ticks for deterministic browser assertions.
- Narrow debug HUD evidence was reflowed and shifted below cockpit chrome after full-resolution review found the first revision clipped under the score panel.

### Browser evidence hardening

- Mobile combat smoke switches to the shotgun through the visible touch control rather than a synthetic weapon-number key.
- It exhausts the magazine, observes deterministic reload state, captures the reload evidence frame, and verifies exact clip/mode telemetry.
- Enemy-death visual observation now starts before the transient visual can occur, preventing the expanded mobile flow from missing valid early evidence.
- All-device mobile certification now requires `aim`, `move`, `pause`, `power`, and `weapon`.

## Authority boundary

Cycle 036 changes child-owned input availability and render/accessibility projection only.

It does **not** change:

- fixed 60 Hz simulation or four-step catch-up;
- weapon damage, cadence, spread, magazine values, reload duration, heat, or capstones;
- collision, hurtboxes, projectile physics, combat ordering, AI, navigation, spawning, XP, or RNG;
- save schema, replay format, session identity, parent bridge, wallet, profile, leaderboard, achievement, or settlement authority;
- public routing, CSP, service worker, production source, or deployment state.

## Verification

- RED: seven focused failures before implementation.
- Focused mobile/input/weapon/HUD/release contracts: `71/71`.
- Release ledger: `1,799` total / `1,747` passing / `52` accepted legacy / `0` unexpected.
- `npm run check`: PASS.
- `npm run build`: PASS.
- Built child bundle: `1,023,218 / 1,050,000` bytes.
- Combat browser smoke: PASS, including touch SWAP and observed reload telemetry.
- Mobile-control smoke: PASS across four device profiles.
- Release browser certification: PASS across five profiles.
- Visual regression: `8/8` scenes unchanged; no baseline acceptance required.
- Native full-resolution visual inspection: smallest portrait, phone landscape, and mobile reload evidence show readable, contained, non-overlapping controls and HUD with no blocker.
- Desktop performance: `7 ms` p95.
- Mobile performance: `7 ms` p95.
- Asset QA, security audit, third-party audit, Web3 source/live audit, strict repository health, CDN gate, and documentation links: PASS.
- No test server or tracked generated audit output remained.

## Exact-index review

The implementation packet was frozen at:

`5fa3e71570a20d1ca5b4166df06c041e244e9a7315645ae74f797752686847d6`

A smoke-tested local `qwen3.5-4b-64k` reviewer received the complete canonical `git diff --cached --binary` with thinking disabled and returned exact matching PASS verdicts for:

- deterministic gameplay/input and architecture;
- security, authority, compatibility, and release scope.

Raw ignored evidence: `.tmp/cycle-036-ollama-exact-review.json`.

Hermes native vision independently inspected the final full-resolution portrait, landscape, and reload frames and found no containment, overlap, clipping, readability, or minimap-exclusion blocker.

The hosted delegation batch `deleg_8558907c` is not release authority. Its workers did not honor the atomic read-only contract, attempted to treat the digest as a Git object, and created untracked scratch artifacts. Those artifacts were removed, the canonical digest was revalidated, and the implementation commit used only the valid local exact-index verdicts plus actual browser/vision evidence.

## Result

Cycle 036 is certified and committed locally only as `15629ebac9e1004f2b41760aedd3e67cc406f5c3`.

No push, preview, promotion, deployment, wallet, transaction, contract, production, or settlement action occurred.

## Next bounded slice

Cycle 037 should commit a deterministic weapon-role measurement harness before any balance tuning:

1. measure same-seed time-to-kill, ammunition, reload, heat, projectile pressure, and hit rate at declared engagement distances;
2. define explicit role envelopes for pistol, shotgun, automatic weapon, and launcher;
3. identify the first measured outlier rather than tuning from feel;
4. add RED coverage for only that outlier;
5. preserve mobile/controller parity and all current authority boundaries.
