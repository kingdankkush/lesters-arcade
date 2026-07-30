# HMH AAA Continuous Improvement

This ledger continues the certified reboot after `reboot-20` without changing the protected production or Web3 authority boundaries.

## Fixed compatibility boundary

- PixiJS: `8.19.0`
- Simulation: fixed `60 Hz`, maximum four catch-up steps
- Alias: `hmh`
- Game ID: `lester-blaster`
- Profile: `wo71`
- Save schema: `2`
- Bridge: `hmh-bridge/v1`, maximum message size `65,536` bytes
- Parent owns wallet, profile, leaderboard, analytics, Ranked evidence, and settlement
- LitVM contracts require a separate explicit HALT release

## Production baseline preserved

- Source commit: `68c981449f6c62936729f14ec08c4d6f6db57d66`
- Deployment: `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`
- Domain: `https://lestersarcade.io`
- Game bundle SHA-256: `2ea294b53dd8ccd21d071857695d3d2d0b461bde3f05c3158043b154810ad5d3`
- Game bundle bytes: `961934`
- Service worker SHA-256: `2ef0bdccc619aca7ba046bfcd75f1d0a75d743ba2b858fafe2b0a70264eb875b`
- Service worker bytes: `3496`
- HMH HTML SHA-256: `10a373bccbf59ecfa6a1ec382d91bd9e6b35f0888eb8d2b921b3be67344b0bb1`
- Durable pre-reboot rollback deployment: `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`
- Durable pre-reboot rollback tag: `hmh-pre-reboot-production-2026-07-23`

## Active branch

`reboot/hmh-aaa-continuous`

## Cycle index

- [x] Cycle 001: network/console observability, historical 404 closure, and measured movement/input/camera feel improvements
  - Status: corrected preview verified; production approval pending
  - Certification: `RELEASE-CERTIFICATION-AAA-CYCLE-001.md`
  - RED evidence: `RED-EVIDENCE-AAA-CYCLE-001.md`
  - Preview verification: `PREVIEW-VERIFICATION-AAA-CYCLE-001.md`
- [x] Cycle 002: bounded one-shot combat input buffering across keyboard, pointer, touch, and gamepad
  - Status: preview verified; production approval pending; production unchanged
  - Cycle ledger: `cycles/CYCLE-002.md`
  - Certification: `RELEASE-CERTIFICATION-AAA-CYCLE-002.md`
  - Preview verification: `PREVIEW-VERIFICATION-AAA-CYCLE-002.md`
  - RED evidence: `RED-EVIDENCE-AAA-CYCLE-002.md`
  - Memory audit: `MEMORY-AUDIT-AAA-CYCLE-002.md`
- [x] Cycle 003: boundary-safe collision depenetration and permanent parent-portal E2E harness
  - Status: local certified; production unchanged
  - Cycle ledger: `cycles/CYCLE-003.md`
- [x] Cycle 004: combat physics, enemy/boss integrity, progression depth, and deterministic audio/animation readability
  - Status: local certified; production unchanged
  - Cycle ledger: `cycles/CYCLE-004.md`
- [x] Cycle 005: certified production hero projection, combat feedback, world materials, and repaired visual regression
  - Status: local certified; production unchanged
  - Cycle ledger: `cycles/CYCLE-005.md`
- [x] Cycle 006: Blender-authored enemy and Liquidator roster with nonfatal runtime fallbacks
  - Status: local certified; production unchanged
  - Cycle ledger: `cycles/CYCLE-006.md`
- [x] Cycle 007: complete authored hero/enemy/prop/weapon/POI presentation and deterministic runtime integration
  - Status: committed locally as `07e884ef`; production unchanged
  - Cycle ledger: `cycles/CYCLE-007.md`
- [x] Cycle 008: truthful ledge projectile/melee combat and repaired production-art browser smoke
  - Status: committed locally as `d061ac3f`; production unchanged
  - Cycle ledger: `cycles/CYCLE-008.md`
- [x] Cycle 009: road-safe ground motifs, opaque water occlusion, and preserved tangible detail layers
  - Status: committed locally as `2a579cf7`; production unchanged
  - Cycle ledger: `cycles/CYCLE-009.md`
- [x] Cycle 010: source-ceiling-bounded projectile recovery across authored depressions
  - Status: committed locally as `774522ad`; production unchanged
  - Cycle ledger: `cycles/CYCLE-010.md`
- [x] Cycle 011: complete Liquidator telegraph projection for melee and safe-zone geometry
  - Status: committed locally as `c66e2b74`; production unchanged
  - Cycle ledger: `cycles/CYCLE-011.md`
- [x] Cycle 012: mobile HUD, minimap, touch-control, and combat-status composition
  - Status: committed locally as `43f11925`; production unchanged
  - Cycle ledger: `cycles/CYCLE-012.md`
- [x] Cycle 013: four rotating production hero selectors, mobile carousel, and deterministic selector-asset QA
  - Status: committed locally as `b50d5aac`; production unchanged
  - Cycle ledger: `cycles/CYCLE-013.md`
- [x] Cycle 014: responsive district landmark clusters and truthful onscreen prop coverage
  - Status: committed locally as `c56ee2f6`; production unchanged
  - Cycle ledger: `cycles/CYCLE-014.md`
- [x] Cycle 015: deterministic authored-POI collectibles, bounded resources, timed effects, HUD, audio, and VFX
  - Status: committed locally as `0f44ee9e`; production unchanged
  - Cycle ledger: `cycles/CYCLE-015.md`
- [x] Cycle 016: truthful projection-only grenade blast-radius warnings with desktop/mobile evidence
  - Status: committed locally as `6292cc57`; production unchanged
  - Cycle ledger: `cycles/CYCLE-016.md`
- [x] Cycle 017: sibling upgrade disclosures and desktop/tablet/portrait/landscape responsive choice polish
  - Status: committed locally as `c07b6e8e`; production unchanged
  - Cycle ledger: `cycles/CYCLE-017.md`
- [x] Cycle 018: truthful pause settings, current-build ranks, restart persistence, and responsive actions
  - Status: committed locally as `3ab3ad71`; production unchanged
  - Cycle ledger: `cycles/CYCLE-018.md`
- [x] Cycle 019: repair deterministic combat soak and add isolated 30-minute desktop/mobile browser profiles
  - Status: committed locally as `c98861a2`; production unchanged
  - Cycle ledger: `cycles/CYCLE-019.md`
- [x] Cycle 020: eliminate the post-restart cockpit certification race and restore deploy-build manifest reproducibility
  - Status: committed locally as `8842077c`; production unchanged
  - Cycle ledger: `cycles/CYCLE-020.md`
- [x] Cycle 021: deterministic projection-only district landmark signals with reduced-motion and onscreen browser gates
  - Status: promoted to production from `a81f1c8f`; production remains this Cycle 021 source
  - Cycle ledger: `cycles/CYCLE-021.md`
- [x] Cycle 022: authored terrain materials for readable gameplay surfaces
  - Status: committed on continuation as `70cf778b`; production unchanged
  - Cycle ledger: `cycles/CYCLE-022.md`
- [x] Cycle 023: identifiable pickup and POI models
  - Status: committed on continuation as `85265f42`; production unchanged
  - Cycle ledger: `cycles/CYCLE-023.md`
- [x] Cycle 024: detailed character/enemy body geometry under one shared projection policy
  - Status: committed on continuation as `1455bd78`; production unchanged
  - Cycle ledger: `cycles/CYCLE-024.md`
- [x] Cycle 025: four-control mobile layout and five deterministic weapon capstones
  - Status: committed on continuation as `77f81c70`; production unchanged
  - Cycle ledger: `cycles/CYCLE-025.md`
- [x] Cycle 026: shared art light rig, mobility upgrades, and clearer current-build progression
  - Status: committed on continuation as `6804fa99`; production unchanged
  - Cycle ledger: `cycles/CYCLE-026.md`
- [x] Cycle 027: Forkrunner/Gas Bomber role equipment, enemy projection scale, stable roster preview, and current-candidate browser rails
  - Status: committed on continuation as `4c006637`; production unchanged
  - Cycle ledger: `cycles/CYCLE-027.md`
- [x] Cycle 028: user-reference four-hero model contract and 48-part Lester combat rebuild
  - Status: committed on continuation as `fe8153f0`; production unchanged
  - Cycle ledger: `cycles/CYCLE-028.md`
- [x] Cycle 029: reference-faithful Lilly Blender rebuild
  - Status: committed on continuation as `3784080b`; production unchanged
  - Cycle ledger: `cycles/CYCLE-029.md`
- [x] Cycle 030: reference-faithful Lit Commando Blender rebuild
  - Status: committed on continuation as `d5a860d4`; production unchanged
  - Cycle ledger: `cycles/CYCLE-030.md`
- [x] Cycle 031: reference-faithful Lit Valkyrie Blender rebuild
  - Status: committed on continuation as `45d1a25e`; production unchanged
  - Cycle ledger: `cycles/CYCLE-031.md`
- [x] Cycle 032: measured projection-only ordinary-zombie scale parity
  - Status: promoted with Vercel upload-isolation fixes as `e8f7a73e`; production source
  - Cycle ledger: `cycles/CYCLE-032.md`
- [x] Cycle 033: deterministic forgiving ordinary-enemy hurtboxes
  - Status: committed on continuation as `d59d8382`; production unchanged
  - Cycle ledger: `cycles/CYCLE-033.md`
- [x] Cycle 034: Bagholder Rusher and Whale Enforcer model/detail and close-range attack-readability upgrade
  - Status: committed on continuation as `be2712e4`; production unchanged
  - Cycle ledger: `cycles/CYCLE-034.md`

## Cycle 020 final local candidate (historical)

- Status: automation certified before Cycles 021-027; superseded as continuation source
- Certified source: `8842077c16e6725997ca8e64a61cecb139d67a9e`
- Full source-range SHA-256: `38343b8cd71ef543ba10e83d86d50f8ec7ec91d8dc158f269ec165f927b40e7a`
- Certificate: `RELEASE-CERTIFICATION-AAA-FINAL-CANDIDATE.md`
- Deployment and rollback: `DEPLOYMENT-ROLLBACK-RUNBOOK-AAA-FINAL-CANDIDATE.md`

## Current continuation candidate

- Status: Cycle 034 automation, deterministic authored-art verification, exact-index review, and desktop/mobile visual review certified
- Cycle 034 runtime/art source: `be2712e4c617152eb3f115c5ef083e3a3a173044`
- Exact Cycle 034 commit patch SHA-256: `540d71f3bcc9935fee4ee525e19b59806800430e6267207b65d55e403f220e50`
- Current handoff: `../handoffs/2026-07-29-hmh-cycle-034-hermes-handoff.md`
- Production source remains the Cycle 032/Vercel-fix release: `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`
- Settlement: disabled; hardened Web3 remains outside this release
