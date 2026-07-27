# HMH AAA Continuous Improvement Cycle 019

Date: 2026-07-26
Status: `LOCAL CERTIFIED · INCLUDED IN THIS CYCLE COMMIT · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `3ab3ad71` — `feat(hmh): polish pause settings and build`

## Certification defects found

1. The deterministic combat soak had drifted behind the grenade API: it requested 500 hand charges without the required explicit `maxHandCharges`, so the endurance matrix aborted before testing.
2. The canonical browser soak certified only a desktop viewport. There was no isolated wall-clock mobile report, lock, capture pair, viewport identity, or long-run touch-chrome check.

## Bounded implementation

- Repaired the combat soak with `maxHandCharges: 500`; no gameplay grenade defaults changed.
- Added `--profile=desktop|mobile` to the existing HMH reboot browser soak.
- Kept desktop as the default profile.
- Added canonical scripts:
  - `npm run test:soak` — desktop, 30 minutes
  - `npm run test:soak:mobile` — mobile, 30 minutes
- Isolated report, partial-report, lock, Chrome profile, and screenshot names by profile so both lanes can run concurrently without overwriting each other.
- Added mobile `390×844`, `1.25×` device scale, and CDP touch emulation.
- Added sampled touch-control counts and a mobile failure if the eight-control touch chrome disappears.
- Added profile and viewport identity to JSON, markdown, partial reports, and console summaries.
- Did not change simulation, rendering, balance, controls, bridge, Web3, settlement, or production code.

## TDD and smoke evidence

- Updated the visual/soak source contract to require both canonical 30-minute package scripts, profile parsing, mobile touch emulation, profile-specific reports, touch-chrome failure policy, and the repaired grenade soak call.
- Syntax check: PASS.
- Source contract: `4/4` PASS.
- Desktop short harness smoke: `0.21 min`, six samples, median `144.22 FPS`, p95 `7 ms`, 610 ticks, PASS.
- Mobile short harness smoke: `0.21 min`, six samples, median `144.31 FPS`, p95 `7 ms`, 610 ticks, touch chrome retained, PASS.
- Short-run generated reports were restored/deleted and are not part of this commit.

## Accelerated endurance evidence

- Combat: all four weapons, melee, grenades, reduction, 60/30/20 replay parity, four-step catch-up cap PASS.
- Enemy population: 128 bodies, 60/30/20 partition equality, stable hash PASS.
- Director/Boss: 318 stable inserts, 143 maximum bodies, Liquidator 60/30/20 parity, zero dropped boss events PASS.
- Projectile: capacity 128, bounded drops, deterministic resolution PASS.
- Dash: 72,000 ticks per tier across 60/30/20, deterministic hashes PASS.
- Authored world: all six districts, route complete, zero collision/traversal blocks across 60/30/20 PASS.
- Balance/build simulation: 40/40 valid completed 30-minute runs, 100% survival, 18.22% hero median score spread, minimum four bosses, all certified builds PASS.
- Structured playtest sweep: six scenarios, seven bug areas, zero uncovered areas, PASS.

## Safety statement

- `SETTLEMENT_LIVE=false` unchanged.
- No wallet request, signature request, transaction, LitVM operation, settlement change, push, deployment, or production replacement occurred.
