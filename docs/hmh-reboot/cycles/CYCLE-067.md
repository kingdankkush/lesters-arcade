# AAA Continuous Improvement Cycle 067 — shared timed-effect HUD and accessibility truth

Date: 2026-08-17
Branch: `reboot/hmh-aaa-continuous`
Pre-cycle baseline: `8f5448c08bab9c0f2a453933340f16a1e042fa84`
Status: **LOCAL SOURCE + BROWSER CERTIFIED · PRODUCTION UNCHANGED**

## Objective

Complete the next bounded Wave 11 seam named by Cycle 066: expose one fixed-tick-derived countdown and refresh contract for the existing Time Dilation and Berserk timed effects, then consume it from both the visible combat HUD and accessible status output without creating presentation authority.

## Implemented slice

- Added `buildTimedEffectPresentation(...)` in `apps/hmh-reboot/src/hud-layout.mjs`:
  - accepts the immutable collectible snapshot;
  - derives whole-second countdowns from `expiresTick - tick` at the canonical 60 Hz rate;
  - formats compact HUD labels (`DILATION 10S`, `BERSERK 3S R1`);
  - formats full accessible labels from the same normalized data;
  - reports no active effect after the exact expiry boundary;
  - remains projection-only and does not mutate simulation state.
- Routed `apps/hmh-reboot/src/main.mjs` through that shared presentation once per rendered snapshot:
  - visible combat status consumes `hudLabel`;
  - the `aria-live` combat status consumes `accessibleLabel`;
  - browser telemetry publishes the same countdown and refresh count for deterministic evidence.
- Extended the real collectible browser matrix:
  - desktop, portrait mobile, and short landscape assert the active countdown;
  - a fail-closed `evidenceSafe=1&collectibleRefreshPilot=1` route collects a second authored Time Dilation pickup at tick 120;
  - the route proves `DILATION 10S R1`, the matching accessible phrase, and exact expiry/reset;
  - four full-resolution screenshots are captured locally for desktop, portrait, landscape, and refreshed portrait evidence.
- The evidence refresh pilot remains within the collectible system's 13-placement hard cap by replacing one unrelated scheduled rare placement only on that explicit evidence route. Normal gameplay keeps all ten authored and three scheduled rare placements unchanged.

## TDD and bug evidence

Initial focused RED:

```text
ERR_MODULE_NOT_FOUND / missing buildTimedEffectPresentation export
```

After implementation, the new source-wiring assertion initially failed because it required an exact call shape and did not admit the runtime's defensive fallback snapshot. The assertion was corrected to verify the real shared-helper call without overfitting its argument expression.

The first browser refresh pilot failed closed with:

```text
Renderer initialization failed
"ten authored placements and at most three scheduled rare placements are required"
```

Root cause: the evidence route appended a fourteenth placement. The fix preserves the 13-placement cap by substituting the pilot pickup for one scheduled rare placement only under the double-gated evidence route. The rebuilt browser matrix then passed.

## Verification

- Focused input/collectible/lifecycle regression:
  - **34 / 34 PASS**
- `npm run check`
  - **353 JavaScript modules + 49 Python scripts PASS**
- `npm run test:release`
  - **2,248 evaluated = 2,197 passed + 51 exact expected legacy failures; unexpected failures 0**
- `npm run assets:verify`
  - PASS; 76 generated PNGs plus production hero, cabinet, and playlist assets verified
- `npm run contracts:check`
  - PASS
- `npm run design:security-audit`
  - PASS; **715 files scanned, 0 findings, 5 / 5 hardening checks**
- `npm run design:third-party-security`
  - **3 / 3 PASS**
- `npm audit --omit=dev --audit-level=high`
  - **0 vulnerabilities**
- `npm run repo:health:strict`
  - SHIP repo budget PASS; **2,618 tracked files / 215 MB** before this cycle is committed
- `npm run docs:links`
  - PASS
- `npm run build:meta`
  - HMH entry: **393,368 bytes**
  - Pixi vendor: **575,891 bytes**
  - combined initial child JavaScript: **969,259 / 1,050,000 bytes**
  - enforced headroom: **80,741 bytes**
  - entry delta versus Cycle 066: **+1,895 bytes**
- `HMH_REBOOT_ORIGIN=http://127.0.0.1:8877 npm run smoke:hmh:collectibles`
  - PASS across desktop, portrait mobile, and short landscape
  - active: `DILATION 10S`; refreshed: `DILATION 10S R1`
  - accessible refreshed status: `Time Dilation, 10 seconds remaining, refreshed 1 time`
  - refresh then expiry returns active/countdown/refresh telemetry to empty/empty/0
  - all nine canonical pickup scenarios remain green
  - healthy Liquidator nuke safety remains `11,001 / 12,000` HP
  - console/page errors: `0`
- `HMH_REBOOT_ORIGIN=http://127.0.0.1:8877 npm run audit:hmh:network`
  - four clean/warm portal/HMH scenarios PASS
  - HTTP errors, request failures, console errors, and page errors: `0`
- `HMH_REBOOT_ORIGIN=http://127.0.0.1:8877 npm run smoke:hmh:performance`
  - desktop p95/p99/max: **7.0 / 7.1 / 13.9 ms**; retained heap **+1,441,973 bytes**
  - mobile p95/p99/max: **7.0 / 7.1 / 7.1 ms**; retained heap **+1,732,217 bytes**
  - steady-state long tasks and runtime errors: `0 / 0`
- `HMH_REBOOT_ORIGIN=http://127.0.0.1:8877 npm run visual:reboot`
  - **12 / 12 scenes PASS**
  - every scene: `meanDelta=0`, `maxDelta=0`, `changedCells=0`, errors `0`
  - no baseline was accepted or tolerance changed

Local player-visible evidence:

- `.hermes/evidence/cron-cycle-067-powerup-presentation/desktop-active.png` — 1440×900
- `.hermes/evidence/cron-cycle-067-powerup-presentation/mobile-active.png` — 780×1688
- `.hermes/evidence/cron-cycle-067-powerup-presentation/mobile-landscape-active.png` — 1688×780
- `.hermes/evidence/cron-cycle-067-powerup-presentation/mobile-refreshed.png` — 780×1688

These local screenshots are ignored evidence and are not release artifacts. Browser assertions bind the visible HUD label and accessible output to the same fixed-tick presentation object; screenshots alone are not counted as proof.

## Preserved invariants

- Simulation remains fixed at 60 Hz with the existing catch-up boundary.
- Timed-effect activation, refresh, expiry, movement/damage modifiers, and reset remain collectible-system authority.
- HUD, accessibility text, browser datasets, and screenshots are read-only projection consumers.
- Normal authored/scheduled collectible composition is unchanged.
- Human/zombie actor canon and approved authored assets are unchanged.
- Parent portal, wallet, profile, leaderboard, settlement, and contract authority are unchanged.
- Production, Preview, aliases, rollback, `main`, external uploads, paid services, contracts, wallets, transactions, and LitVM writes were untouched.

## Changed files

- `apps/hmh-reboot/src/hud-layout.mjs`
- `apps/hmh-reboot/src/main.mjs`
- `tests/hmh-reboot-power-up-lifecycle.test.mjs`
- `scripts/hmh-reboot-collectible-browser-smoke.mjs`
- `docs/testing/hmh-reboot-test-retirement-gate.json`
- `docs/security/hard-money-heroes-security-audit.json`
- `docs/security/hard-money-heroes-security-audit.md`
- `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md`
- `docs/hmh-reboot/cycles/CYCLE-067.md`
- `docs/handoffs/2026-08-13-hmh-production-closeout-next-session.md`

## Next bounded seam

Finish the remaining existing-power-up presentation identity before inventing a new effect: add one bounded projection-only Time Dilation/Berserk silhouette-and-audio contract driven from the same active-effect snapshot, reuse the existing pooled VFX/audio paths, and certify desktop/mobile readability without moving effect authority or increasing simulation work.
