# Changelog

All notable Lester's Arcade and Hard Money Heroes changes are documented here. The project uses human-readable release headings; contract deployments are tracked separately and never implied by a web release.

## 1.2.1 - 2026-07-13

### Added

- Central portal design tokens and brand kit.
- Tested DPR/safe-area viewport-fit policy.
- Persisted auto-fullscreen preference, `Alt+Enter` desktop toggle, and honest iOS/PWA fallback guidance.
- Cabinet SDK v1 clean-room README and integration test.
- `npm run ship:gate`, design-token guard, and strict repository budget gate.

### Changed

- Ranked mode is presented as a canonical local preview while verified settlement is disabled.
- Public metadata and README no longer imply automatic score transactions.
- Level 1 art certification is scoped to the generated 23-row runtime spawn/proxy table; future-level art debt remains explicit.

### Security

- Removed the production-side simulated settlement fallback. Disabled or unapproved settlement now sends no transaction-shaped receipt and exposes no retry-publish action.

## 1.2.0 - 2026-07-12

### Added

- Canonical Ranked session identity, deterministic evidence hashing, durable active-session checkpoints, and recovery/archive tooling.
- Generated integrity bounds and client/contract ABI fixture parity tests.
- Dry-run-first three-contract deployment planning and post-deploy verification tooling.

### Changed

- Ranked settlement defaults to disabled and requires separate verifier/deployment approval.
- Legacy local session records are archived before canonical session rollout.

### Verification

- Node test suite, syntax gate, contract structure checks, Foundry tests, Slither, static build, browser smoke, and production freshness verification completed for the release.

## 1.1.0 - 2026-07-09

### Added

- Hard Money Heroes Level 1 authored World v3 integration.
- Megatexture/material, landmark, infrastructure, collision, depth-sort, and visual-regression coverage.
- Hero, enemy, boss, VFX, lighting, audio, balance, and device-input certification tooling.

### Changed

- Hard Money Heroes fully adopted the isometric run-and-gun roguelite survival direction.
- Level 1 became the active production and visual-baseline scope.
