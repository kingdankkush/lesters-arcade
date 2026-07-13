# Changelog

All notable Lester's Arcade and Hard Money Heroes changes are documented here. The project uses human-readable release headings; contract deployments are tracked separately and never implied by a web release.

## 1.3.0 - 2026-07-13

### Added

- Lossless WebP animation atlases with crop-aware DOM and Canvas 2D rendering for the complete Hard Money Heroes actor roster.
- An 83-cue gameplay audio registry, automated audition evidence, and expanded runtime cue triggers.
- Five-viewport responsive browser certification, unified SVG UI icons, reusable project skills, and a literal 30-minute browser soak harness.

### Changed

- Raw/source art families and reproducible QA outputs now live in the external asset vault while exact runtime assets and metadata remain in Git.
- Static assets, music, and proof images are optimized for smaller transfers; service-worker and CDN cache policies now match the v42 release epoch.
- The local ship gate now includes responsive browser evidence, visual regression, regenerated asset-reference auditing, strict repository health, security, contracts, and production build checks.

### Performance

- Reduced the release candidate from roughly 30,000 tracked files / 929MB to no more than 8,000 tracked files / 350MB without dropping live animation coverage.
- Replaced more than 15,000 loose actor-frame requests with 44 actor-scoped atlas pages and preserved lazy-loading boundaries.

### Deployment boundary

- This is a portal/game release only. It does not broadcast transactions, deploy contracts, rotate addresses, or change on-chain settlement approval.

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
