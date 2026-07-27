# Hard Money Heroes Reboot Final Local Release Certificate

Generated: `2026-07-26T23:44:54-0700`

Status: **AUTOMATION CERTIFIED · HUMAN/PREVIEW ACCEPTANCE PENDING · PRODUCTION UNTOUCHED**

## Candidate identity

- Branch: `reboot/hmh-aaa-continuous`
- Remote reboot baseline: `807bc9434aefec1ab89623128b12777bfe73ab55`
- Certified source commit: `8842077c16e6725997ca8e64a61cecb139d67a9e`
- Source range: 15 linear local commits
- Full binary source-range SHA-256: `38343b8cd71ef543ba10e83d86d50f8ec7ec91d8dc158f269ec165f927b40e7a`
- HMH game bundle SHA-256: `d9d738fb2211a1ac59d306008acc5ede5cf65508c4f053c5313ebbe75e33a8ce`
- HMH game bundle bytes: `1,010,293 / 1,050,000`
- PixiJS: `8.19.0`
- Blender: `5.1.2`
- Fixed simulation: `60 Hz`, maximum four catch-up steps
- Render partitions: `60 / 30 / 20`

## Independent review evidence

### Cycles 007 through 019 aggregate

- Range: `807bc9434aefec1ab89623128b12777bfe73ab55..c98861a25de7d525e8f9a25d0651811f7aeeea0f`
- Exact binary range SHA-256: `a81842967f4c777843c76a41d3bc6202dcf153a2deaeff43153b0763417d0495`
- Architecture, determinism, gameplay authority, and security: PASS, no findings.
- UI, accessibility, harness, release, and deployment policy: PASS, no findings.
- Art, generated assets, visual presentation, responsiveness, performance, and bundle safety: PASS, no findings.

### Cycle 020

- Exact staged index SHA-256: `7610b15420b5c35046ee9efaf15f95b1a335cb388a9699daeaa4c715a967d4cf`
- Browser sequencing, regression non-vacuity, manifest truth, and safety documentation: PASS, no findings.
- Release safety and deploy-build reproducibility: PASS, no findings.

Timeouts, hash mismatches, empty-index reviews, and classifier-only reports were rejected and are not counted as PASS evidence.

## Automated certification

| Gate | Result |
| --- | --- |
| Release suite | PASS, `1,715 total / 1,663 passing / 52 accepted legacy / 0 unexpected` |
| Focused progression/cockpit suite | PASS, `8/8` |
| Solidity structure | PASS |
| Foundry security suite | PASS, `17/17` |
| Syntax | PASS, `332` JavaScript modules and `49` Python scripts |
| Generated asset verification | PASS |
| Production art QA | PASS |
| Deterministic visual regression | PASS, `8/8` unchanged |
| Portal E2E | PASS, `6/6` implemented flows |
| Cockpit responsive browser smoke | PASS, desktop/tablet/mobile/short landscape |
| Browser release matrix | PASS, desktop/ultrawide/tablet landscape/mobile portrait/mobile landscape |
| Network/console audit | PASS, `4/4`; zero HTTP, request, console, or page errors |
| Desktop/mobile performance | PASS, p95 `7 ms / 7 ms` |
| Desktop 30-minute soak | PASS, forced restart exercised |
| Mobile 30-minute soak | PASS, touch emulation and forced restart exercised |
| Security sweep | PASS, `5/5`, zero findings |
| Third-party sandbox | PASS, `3/3` |
| Settlement boundary | PASS, `9/9` |
| Repository health | PASS |
| CDN gate | PASS; migration/history rewrite remains approval-gated |
| Documentation links | PASS |
| Post-commit deploy build | PASS and idempotent; tree clean |

## Release defect closed during final certification

The cockpit browser smoke raced the fresh progression-pilot upgrade after Restart. Runtime modal behavior was correct; the browser harness was nondeterministic. Cycle 020 added a RED ordering contract and then required Restart, visible upgrade, selection, modal closure, and only then Menu reopening. The real four-profile cockpit flow passes with zero browser errors.

Cycle 020 also retained the missing hero-selector source reference in the generated curated runtime, making the deploy build idempotent.

## Production and rollback baseline

- Public domain: `https://lestersarcade.io`
- Current documented production deployment: `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`
- Current production source commit: `68c981449f6c62936729f14ec08c4d6f6db57d66`
- Current production HMH bundle SHA-256: `2ea294b53dd8ccd21d071857695d3d2d0b461bde3f05c3158043b154810ad5d3`
- Current production HMH bundle bytes: `961,934`
- Durable pre-reboot deployment: `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`
- Durable rollback tag: `hmh-pre-reboot-production-2026-07-23`
- Vercel project: `prj_BV02bUipofH8C16XtcsZA3Za8BGT`
- Vercel team: `team_Rr9SX8cl4Y5ObAU3D64oAPvI`

The public domain still serves the documented old bundle and route-scoped Pixi CSP. Production was not changed during certification.

## Remaining gates

1. Restore an authenticated Vercel CLI session.
2. Receive explicit authorization to push the branch and allow its Vercel preview deployment.
3. Verify the immutable preview URL, deployment identity, bundle hash, CSP/cache headers, browser behavior, and public network behavior.
4. Complete hands-on desktop keyboard/controller acceptance.
5. Complete real-phone touch, audio, and motion-comfort acceptance against the preview.
6. Receive separate explicit authorization to promote the verified preview to production.
7. Verify the public domain and immediate rollback after promotion.

## Known release boundaries

- GitHub `main` and the reboot branch are not protected.
- No GitHub Actions workflows or CI runs exist. Manual certification and immutable preview verification are mandatory.
- Hardened Web3 readiness remains `PARTIAL 3/4`.
- Trusted-attestation and live registry/economy prerequisites remain outside this release.
- Local Ranked-preview behavior may be evaluated, but live settlement may not be enabled.
- `SETTLEMENT_LIVE=false` remains required.

## Authorization statement

This certificate does not authorize a push, deployment, production promotion, wallet request, signature, transaction, LitVM operation, contract action, settlement change, CDN migration, or history rewrite.
