# STACKED Cycle 006 — hidden cabinet registration

Date: 2026-09-06

Cycle: S-06

Branch: `feature/stacked-portal`
Implementation base: `a9100b37`

## Implementation boundary

STACKED is registered consistently as game id and canonical slug `stacked`, with
the inbound-only `stack` route alias, dedicated season
`stacked-season-preview-1`, cabinet version `0.1.0`, a first-party 100/0/0/0
registry split, `devWallet: null`, and an explicit zero entry fee. The manifest,
app-shell cabinet and `ARCADE_GAMES` entry stay `coming-soon` / non-public while
the mode-select remains reachable through the existing `?devCabinets=1` gate.
The registry is also `coming-soon`, and launch fails closed before wallet
preflight or session creation because the S-16 runtime mount is not present.

The shared mode-select model is configured and uses five bounded, hand-authored
SVG placeholders. The cabinet uses the locked `bannerArt` fallback and has no
`desktopCabinetSprite`; no fake rotation frames or generated/raster art were
introduced. Public state receives empty STACKED leaderboard buckets and profile
progress is added lazily without changing `ARCADE_PERSIST_VERSION = 3`. Focused
coverage proves that Free mode makes no progress, XP, or leaderboard write.

This cycle does not add a runtime, successful run, browser mount, public launch,
Ranked write, contract action, settlement, or deployment. The manifest entry
shim resolves to the canonical `apps/portal/src/stacked-sim.mjs`; that S-02
module is not present in this isolated worktree and remains a pending integration
dependency. S-16 must mount that runtime before the launch-readiness guard is
removed.

## RED / GREEN evidence

- RED command: `node --test tests/stacked-public-integration.test.mjs tests/stacked-cabinet-art.test.mjs tests/persistence.test.mjs`
- RED result: **18 tests; 12 passed, 6 failed, 0 skipped**. Failures were the
  absent manifest/shim, absent art/registration, HMH router fallback, missing
  STACKED board slot, and missing lazy progress key. A test-fixture correction
  then aligned assertions with the existing `all-time` cadence and progress
  field names; it did not change runtime behavior.
- GREEN command: the same focused Node command.
- GREEN result: **20 passed, 0 failed, 0 skipped, 0 todo** after adding explicit
  dev-gate and Free-mode isolation coverage.
- `npm.cmd run docs:cabinets`: **PASS**, four manifests checked; STACKED remains
  omitted from the README playable roster.
- `npm.cmd run design:security-audit`: **PASS**, 5/5 checks, zero findings. The
  generated audit inventory moved from 763 to 767 scanned files.
- New-module syntax checks: **PASS** for the shim and both new test modules.

No full suite, build, release test, browser, visual, performance, soak, or
deployment gate was run. The parent owns those serialized integration gates.

## Manifest control-scheme note

The manifest uses `dpad-buttons`, the nearest legal Cabinet SDK v1 value. The
intended shipping input also includes gestures, but widening the shared
`CONTROL_SCHEMES` contract is outside S-06. The exact capability order remains
`leaderboard`, `achievements`, `ranked`, `audio`, `haptics`.

## Honest visual note

The five SVGs are coherent cyan/violet/gold arcade placeholders and passed
structural, byte-cap, and prohibited-content checks. They were not inspected in
a browser and are not claimed as production art. There is no STACKED renderer,
gameplay screenshot, or human/on-device evidence in this cycle.
