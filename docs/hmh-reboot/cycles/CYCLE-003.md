# HMH AAA Continuous Improvement Cycle 003

Date: 2026-07-25
Status: `LOCAL GATES PASSED · PREVIEW VERIFICATION PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `f78e38f1` (Chikun-to-HMH Fable handoff commit)

## Objective

Two bounded P1 slices from the 2026-07-24 handoff backlog:

1. **Phase 2 collision safety:** make the world boundary authoritative through
   depenetration so no blocker can eject a body outside the legal playfield.
2. **Phase 14 item 1:** create the missing permanent portal E2E browser
   harness (`scripts/hmh-reboot-portal-e2e.mjs`) with a fail-closed coverage
   contract test.

## Preserved invariants

- PixiJS remains `8.19.0`; simulation remains fixed `60 Hz`, max four catch-up steps.
- Game alias `hmh`, game ID `lester-blaster`, profile `wo71`, save schema `2`,
  bridge `hmh-bridge/v1`, 65,536-byte bridge cap unchanged.
- The collision fix is deterministic and changes behavior only where a body
  would previously have escaped the world boundary; RNG, ordering, IDs,
  replay, and session evidence are untouched.
- The E2E harness is test tooling only; zero product-code changes for it.
- Child HMH requests no wallets, sends no transactions, writes no parent state.
- Free Mode writes no Ranked progress. No LitVM action. No production or
  alias change. `SETTLEMENT_LIVE` remains `false`.

## Audit decision

The earliest incomplete master-plan phase remained Phase 2. A code audit of
`collision.mjs` found the boundary/depenetration ordering defect and a
runtime repro confirmed a player body finishing 22 world units outside the
legal playfield (see RED evidence). All four movement paths (player step,
dash, knockback, enemy simulation) route through the shared resolver, so one
bounded fix covers all of them.

The portal E2E harness was the highest-priority P1 platform gap: prior
"portal smokes" were static marker checks and no browser harness drove the
real portal flows.

## Changed source

- `apps/hmh-reboot/src/collision.mjs` — bounds re-clamped inside each
  depenetration pass (enabling tangential slide along a pinned boundary) and
  as a final invariant after the slide loop.
- `tests/hmh-reboot-collision.test.mjs` — three new behavioral tests (RED-first).
- `scripts/hmh-reboot-portal-e2e.mjs` — new: static portal server with SPA
  fallback, flow manifest with explicit implemented/deferred coverage map,
  six implemented guest flows in real Chrome, evidence screenshots.
- `tests/hmh-reboot-portal-e2e-contract.test.mjs` — new: fails closed on
  silent scope shrink (duplicate ids, thin deferral reasons, unclaimed
  master-plan areas, side effects at import time).
- `package.json` — new script `smoke:portal:e2e`.
- `docs/security/hard-money-heroes-security-audit.{json,md}` — regenerated
  (549 → 558 scanned files: this cycle's two new files plus backlog from
  files added in earlier cycles after the audit was last regenerated;
  5/5 checks, zero findings).

## TDD evidence

- Collision RED: `9/12` (3 intended failures) → GREEN `12/12`.
- Neighboring simulation suites: `98/98`.
- E2E contract test: `5/5`.
- Full release gate: `PASS tests=1627 passed=1575 expected_failures=52`
  (exact legacy multiset; +8 tests over Cycle 002's 1,619).

See `docs/hmh-reboot/RED-EVIDENCE-AAA-CYCLE-003.md`.

## Release gates run on this candidate

- `npm run check` — 319 JS modules + 40 Python scripts pass.
- `npm run test:release` — PASS, 0 unexpected results.
- `npm run build` — HMH bundle 963,741 bytes (SHA-256 prefix `4d446fde7140004c`),
  under the 1,050,000-byte gate (+173 bytes vs Cycle 002's 963,568 from the
  collision boundary clamp).
- `npm run assets:qa:hmh-reboot` — PASS, 4 hero atlases, projection-only.
- `npm run design:security-audit` — PASS 5/5, zero findings.
- `npm run design:third-party-security` — PASS (sandbox suite).
- `npm run design:web3-audit` — PASS 9/9.
- `npm run design:web3-live` — PARTIAL 3/4; the single BLOCKED gate is the
  pre-existing, HALT-gated paid-economy approval item (expected state).
- `npm run repo:health:strict` — PASS.
- `npm run repo:cdn-gate` — PASS (no destructive action).
- `npm run docs:links` — PASS.
- `npm run audit:hmh:network` — four audits, zero failures.
- `npm run smoke:hmh:cockpit` / `smoke:hmh:performance` — zero errors.
- `npm run smoke:portal` / `smoke:portal:interactions` — PASS.
- Four hero browser smokes (commando, valkyrie, lester, lilly) — zero errors,
  desktop and mobile.
- `npm run certify:hmh:browser` — Chrome: five viewport profiles, zero errors.
- Edge (`HMH_REBOOT_BROWSER_EXECUTABLE`) — five viewport profiles, zero errors.
- New `npm run smoke:portal:e2e` — six flows PASS twice consecutively, zero
  console/page errors.
- Deterministic soaks: projectile fuzz (20,000 cases, stable hash), projectile
  soak (3,600 ticks, stable hash), projectile benchmark, enemy soak,
  director/boss soak, dash soak, level-one world soak, combat soak — all PASS.
- `npm run design:session-analytics` — reports regenerated without diff.

Not rerun this cycle: 30-minute browser memory soak (`test:soak`) and the
retained-memory A/B investigation — the pre-existing browser retained-memory
debt from Cycle 002 remains open and is not affected by these changes.
Visual-regression baselines untouched (no render-layer change).

## Portal E2E coverage contract

Implemented: guest boot, guest Free run (bridge, sandbox attributes, Guest
profile, renderer liveness), pause/resume (frozen composited frames while
paused), mid-run restart (fresh parent session id, remounted iframe),
settings persistence across reload (hmh-settings + save v2), guest exit to
splash (iframe unmounted).

Explicitly deferred with reasons recorded in the manifest: ranked preview
(hard-gated on a real injected EVM provider), wallet connect/reconnect
(mock-wallet path not representative), game-over/duplicate-rejection browser
path (no deterministic in-portal death path; logic remains covered by
`tests/hmh-reboot-portal-lifecycle.test.mjs`), service-worker/offline/update
(owned by release browser certification).

## Known debt recorded this cycle

- `#combatMenuPanel` keeps a stale `data-state="paused"` attribute (hidden
  panel, cosmetic) after a pause-menu restart.
- Browser retained-memory debt from Cycle 002 remains open (unchanged).
- Deferred E2E flows above.

## Evidence

- `.hermes/evidence/hmh-aaa-cycle-003/portal-e2e/01..05*.png` (local, untracked)
- `.hermes/evidence/hmh-aaa-cycle-003/edge-certification/report.json` (local)
- Chrome certification report under `.hermes/evidence/hmh-reboot-19-release/`
  (script default output root; run 2026-07-25).

## Deployment state

- No production change. Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`
  (lestersarcade.io); rollback remains `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`.
- The Cycle 002 candidate `dpl_7jXSC1fjXSPtnAzEkzZx97CgTNXN` is superseded as
  "latest candidate" by this cycle's branch push; its approval decision is
  unaffected by this document.
- This cycle stops at the branch push. Vercel preview verification for the
  Cycle 003 commit is the next step and requires authorized provider access.
