# HMH AAA Continuous Improvement Cycle 016

Date: 2026-07-26
Status: `LOCAL CERTIFIED · INCLUDED IN THIS CYCLE COMMIT · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `0f44ee9e` — Cycle 015 deterministic collectibles

## Defect

Live hand and launcher grenades rendered a small projectile body and fuse halo, but did not show their authoritative blast footprint before detonation. The missing danger geometry was especially hard to judge on mobile and could make self-damage or enemy blast exposure feel arbitrary.

## Correction

- Added a pure projection helper that samples each live grenade’s authoritative `blastRadius` into a 32-point world-space boundary.
- Projects that boundary through the existing world camera and renders a restrained filled footprint plus high-contrast edge.
- Uses fixed simulation ticks for urgency and pulse cadence; no wall-clock or random state is introduced.
- Preserves the warning under reduced-flash settings while removing pulse modulation.
- Added debug/release telemetry for active warning count, authoritative radius, and urgent-warning count.
- Extended the combat browser smoke to capture the warning while a grenade is live on desktop and 390×844 touch profiles, then prove it retires after detonation.
- No grenade damage, collision, trajectory, bounce, fuse, target, cover, inventory, replay, save, bridge, or settlement behavior changed.

## RED / GREEN

RED:

- `tests/hmh-reboot-grenade-vfx.test.mjs` failed with `ERR_MODULE_NOT_FOUND` because no grenade-danger projection helper existed.
- The live-renderer contract failed because `main.mjs` did not consume authoritative grenade danger geometry or expose semantic warning telemetry.
- Existing combat smoke waited until detonation and therefore could not prove a pre-detonation warning.

GREEN:

- Pure helper contract: `3/3` passing.
- Focused grenade, visual-feedback, shell, and deterministic simulation set: `50/50` passing.
- Desktop browser evidence: one live grenade produced exactly one warning at radius `92`, then zero warnings after fuse detonation.
- Mobile browser evidence: one live grenade produced exactly one warning at radius `92` with all eight touch controls contained and non-overlapping.
- Full-resolution desktop and mobile captures were visually reviewed: warning is centered, grounded, proportional, and clear of HUD/touch controls.
- Combat smoke recorded zero page/console errors, zero projectile drops, and audio remained below the 16-voice cap.

## Certification

- syntax: `332 JS modules + 49 Python scripts`
- focused tests: `50/50`
- release: `1,714 total / 1,662 passing / 52 accepted legacy failures / 0 unexpected`
- visual regression: `8/8`, zero delta
- five-profile Chrome browser certification: PASS
- combat browser smoke, cockpit smoke, portal E2E, network-console audit: PASS
- performance: desktop p95 `7 ms`; mobile p95 `7 ms`
- reboot bundle: `1,008,251 / 1,050,000` bytes
- asset QA: four hero atlases, one selector atlas, seven enemy/boss atlases, one 29-item prop atlas: PASS
- security: `5/5`, zero findings; third-party sandbox `3/3`
- Web3 source audit: `9/9`; live readiness remains intentionally `3/4` with paid economy HALT-blocked
- strict repository health, CDN budget, and documentation links: PASS

## Boundaries

PixiJS remains `8.19.0`. The fixed `60 Hz` simulation, four-step catch-up bound, deterministic 60/30/20 render partitions, canonical world/elevation/collision, projectile and grenade authority, replay, save, portal bridge, Free/Ranked semantics, wallet ownership, Web3 rails, and settlement authority remain unchanged. `SETTLEMENT_LIVE=false` remains unchanged. No push, deployment, production replacement, transaction, wallet/signature request, LitVM action, or settlement change occurred.
