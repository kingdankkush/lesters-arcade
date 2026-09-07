# STACKED Cycle 001 — contract freeze and identity spine

Date: 2026-09-06

Cycle: S-01

Branch: `feature/stacked-solo`
Implementation base: `3dea4e17fb5c0e43121fc6f67b26c741202bbca0`

## Implementation boundary

The frozen constants/identity module, isolated cabinet-version export, reproducible
JSON writer, syntax registration, contract tests, and nineteen-gate owner register
are implemented. The ten imported design documents and their original checksum
record are preserved with the explicit import edits in `../IMPORT.md`.

This is **not a playable cabinet**. No simulation, renderer, portal registration,
Ranked write, shared vendor policy, CSP change, settlement or deployment is included.
The original plan's “no STACKED code exists” banner describes its historical intake
baseline, not the post-S-01 working tree.

## Verification

- Focused contract suite: **44 passed, 0 failed, 0 skipped, 0 todo**.
- Final guard RED: **39 failed, 5 passed**, because the new AST-audit helper did not
  exist. GREEN was run after implementing it. Earlier worker attempts had inadequate
  RED evidence and a faulty regex guard; those are not used as certification.
- Actual disk mutation tests plant duplicates under both `apps/` and `scripts/`,
  prove the guard rejects them, remove only their own temporary directories, then
  prove the repository is clean of duplicate declarations again.
- Guard parsing fails closed, handles nested/rest/default/destructured bindings,
  ignores legitimate references and string fixtures, and scans the test itself.
- Artifact writer executed twice into fresh files; both match committed bytes.
- Independent final Codex review: `passed: true`, no blockers or suggestions.
- Ordinary `npm test`: **2,607 tests; 2,556 passed; 51 failed**. A separate clean
  baseline produced **2,563 tests; 2,512 passed; the identical 51 failures**. They
  are the already-retired HMH tests, not new exceptions. No retirement policy changed.
- `npm run test:release`: PASS, all 44 new STACKED tests included and unretired.
- `npm run check`, `contracts:check`, `docs:cabinets`, `docs:links`, `assets:verify`,
  `design:security-audit`, `design:third-party-security`, `design:integrity-bounds`,
  `design:tokens`, `repo:health:strict`, `vercel:build`: PASS.
- An additional check resolved every Markdown file link in the original ten documents.
- HMH vendor, HMH game entry, and Chikun game entry built byte-identically to the
  clean baseline. Build/retirement/security generators refreshed their own reports
  and source-inventory metadata; these are included without hand-editing exceptions.

Machine evidence: `CYCLE-001-verification.json`. Full local logs remain outside the
committed document set; their SHA-256 digests are recorded in that evidence file.

## Contract representation

Where §2 specified data without standalone export names, its homes are
`STACKED_LOCK_RULES`, `STACKED_DAS_RANGE_TICKS`, `STACKED_ARR_RANGE_TICKS`,
`STACKED_DCD_RANGE_TICKS`, `STACKED_CLEAR_SCORES`, `STACKED_MINI_SPIN_SCORES`,
`STACKED_FULL_SPIN_SCORES`, `STACKED_FRAME_SIZES`, and
`STACKED_ZONE_TRANSITION_TICKS`. The explicitly named `LOCK_DELAY_TICKS`,
`LOCK_RESET_CAP`, and `PERFECT_CLEAR_BONUS` tables retain their names. Lock arrays
are indexed by `min(level, LOCK_LEVEL_CAP) - 1`; tests prove agreement with every
range-table row. No numeric gameplay policy changed.

`HMH_INITIAL_JS_CAP` remains at its existing `build.mjs` home, unchanged at
`1_050_000`; it is not redeclared in the STACKED module. G-5's proposed shared-vendor
cap is not active policy. `LEVEL_FOR_LINES` describes the level formula, not another
scalar; its behavior is an S-03 acceptance criterion. Bundle caps stay `null` and
the unmeasured-budget assertion throws the required readable error.

The AST guard uses Acorn as a development dependency only. Dependencies were installed
in this worktree's own directory; the original shared dependency directory remains
present. Acorn is not imported by any cabinet runtime.

## Owner gates and handoff

All nineteen gates remain open. G-5, G-8, G-17 and G-14 were presented to the owner;
no answer was received, so no approval is inferred. Keep existing saves untouched.
S-02 may begin after this cycle's implementation commit. Renderer/build integration
and affected shared-portal work remain subject to their named gates.

## Honest visual note

There is no STACKED renderer, screenshot, or playable game in this cycle. The Node
build is verified; browser, on-device, performance and gameplay gates are not claimed.
