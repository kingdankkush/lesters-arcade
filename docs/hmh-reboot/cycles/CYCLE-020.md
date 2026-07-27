# HMH AAA Continuous Improvement Cycle 020

Date: 2026-07-26
Status: `LOCAL CERTIFICATION IN PROGRESS · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `c98861a2` — `test(hmh): certify desktop and mobile soaks`

## Release defects found

1. The cockpit browser smoke raced the progression-pilot upgrade modal after Restart. The smoke waited for Pause to close and immediately clicked Menu, while the intentionally restarted progression pilot could open a fresh blocking upgrade modal first. Passing or failing depended on event timing.
2. The deploy build regenerated the curated level-kit runtime because the tracked manifest did not yet include `apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs`. Leaving that drift unresolved would make the Vercel build non-reproducible.

## Root cause

- Runtime behavior was correct: an active modal blocked unrelated Menu input.
- The browser harness failed to settle the deterministic post-restart progression state before asserting pause-setting persistence.
- Cycle 013 added the selector source, but the deploy-time curated runtime generator had not been run and committed afterward.

## TDD repair

- Added a RED source contract requiring this order:
  1. Restart.
  2. Wait for the fresh progression-pilot upgrade.
  3. Select the upgrade.
  4. Wait for the upgrade modal to close.
  5. Reopen Pause.
- The contract failed with `browser smoke must wait for the restarted progression pilot upgrade`.
- Added only the three missing browser-harness waits/actions.
- Focused source contract: `8/8` PASS.
- Real four-profile cockpit smoke: desktop, tablet, mobile portrait, and short landscape PASS with zero browser errors.

## Build reproducibility repair

- Regenerated the tracked curated level-kit runtime.
- The only retained generated change is the selector-atlas source reference.
- Timestamp and scan-count audit outputs remain generated evidence and are restored after inspection.

## Release evidence

- Foundry: `1.7.1-stable`.
- Solidity contract structure: PASS.
- Solidity security suite: `17/17` PASS.
- Deploy build, release suite (`1,715 total / 1,663 passing / 52 accepted legacy / 0 unexpected`), syntax, asset verification, and bundle gate: PASS.
- Production asset QA: PASS.
- Deterministic visual regression: `8/8` unchanged.
- Performance: desktop/mobile p95 `7 ms / 7 ms`; HMH bundle `1,010,293 / 1,050,000` bytes.
- Portal E2E: `6/6` implemented flows PASS.
- Browser release matrix: desktop, ultrawide, tablet landscape, mobile portrait, and mobile landscape PASS.
- Network audit: `4/4` scenarios; zero HTTP, request, console, or page errors.
- Security: `5/5` PASS; third-party sandbox `3/3` PASS; settlement boundary `9/9` PASS.
- Web3 live readiness remains `PARTIAL 3/4`; hardened Web3 promotion remains blocked.
- Strict repository health, CDN gate, and documentation links: PASS.
- Existing exact-HEAD desktop and mobile 30-minute browser soaks remain valid because Cycle 020 changes only certification code and a generated asset-reference manifest, not runtime gameplay or presentation.

## Safety statement

- `SETTLEMENT_LIVE=false` unchanged.
- No gameplay, rendering, balance, save, bridge, wallet, settlement, or contract behavior changed.
- No wallet request, signature request, transaction, LitVM operation, contract operation, push, deployment, or production replacement occurred.
