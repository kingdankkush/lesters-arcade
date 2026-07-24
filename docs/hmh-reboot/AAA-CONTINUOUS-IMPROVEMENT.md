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
- [ ] Cycle 002: bounded one-shot combat input buffering across keyboard, pointer, touch, and gamepad
  - Status: source certified; preview pending; production unchanged
  - Cycle ledger: `cycles/CYCLE-002.md`
  - Certification: `RELEASE-CERTIFICATION-AAA-CYCLE-002.md`
  - RED evidence: `RED-EVIDENCE-AAA-CYCLE-002.md`
  - Memory audit: `MEMORY-AUDIT-AAA-CYCLE-002.md`
