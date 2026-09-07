# STACKED delivery status

## Accepted baseline
S-01, S-02 and S-03 are accepted at core commit `33b43e627f7d509e5f37d49368d89db1c2fd65a2`. Historical S-03 verification: 141 focused tests; eight baseline-aware Node gates; full suite 2693/2642/51 documented inherited failures, with no new failure names. Cabinet 0.2.0; golden result tuple unchanged. See [CYCLE-003](cycles/CYCLE-003.md).

## Active, unaccepted work
Parent-owned implementation is in the real linked Git worktree **Lesters-Arcade-Stacked-Release**, branch `feature/stacked-release-live`, based on `aaf113c5214ee6bed3b8b3efba55ff4b9501af95`. It is **not clean** and is not blocked before implementation.

- S-04 codec, recorder, transport, replay store, verification worker, bridge and autoshift are substantially implemented, not accepted.
- S-05 difficulty model and Free-only pilot are implemented, not accepted.
- S-08 summary validation is partially implemented; full projection/integration remains pending.
- Reconciliation baseline: **174 tests, 170 pass, 4 fail, no skips/cancellations**. The neutral-stop regression passes. Remaining failures: three result cross-field guards and pilot blocked movement at tick 8,957. This is a dated diagnostic, not a release receipt.
- Subsequent repairs: bridge cross-field regressions pass 10/10; all 26 non-pilot STACKED test files pass 221/221; the Free-only pilot passes 2/2, including an uninterrupted 100,000-tick run and replay-identical tuple. AST purity passes 32/32 falsification/positive cases. These are focused checks, not final cycle acceptance.
- The broad pilot search timed out at 180 seconds; bounded tick-aware trajectories passed the unchanged long-run test. Maximum-length replay calibration, fresh static review and full project gates remain pending.
- The [ARR/touch timing conflict](amendments/INPUT-MASK-CLARIFICATION-v1.md) remains explicitly open for S-15/G-19; no silent simulation change or input-acceptance claim.

See [external-review reconciliation and all 17 tasks](reviews/CLAUDE-20260907-reconciliation.md). Full focused/project gates must be repeated after repairs.

## Preserved candidates and ownership
All four STACKED directories are registered Git worktrees sharing one repository; `.git` is a pointer file, not a directory. The uncommitted durability risk has been addressed with raw-byte-verified preservation commits and remote-ref readback. **Preservation is not acceptance.**

| Worktree | Baseline | Preservation commit | State |
| --- | --- | --- | --- |
| Lesters-Arcade-Stacked | `33b43e627f7d509e5f37d49368d89db1c2fd65a2` | `fac9b8c29dd6da0846e211c8fd9d5149463dac2d` | Historical S-03 working state; not an active source writer. |
| Lesters-Arcade-Stacked-Portal | `a9100b37a58ade116fca420e57565c59bad38922` | `bfe190df441f97b5990d38aa8a57726ba8395a95` | S-06 candidate; dev-only integration/full acceptance pending. |
| Lesters-Arcade-Stacked-Renderer | `a9100b37a58ade116fca420e57565c59bad38922` | `2aaa6b05f2df0c5d59c276e5d918d3428e04d72a` | S-11/S-12 candidate against older sim. Its 65-test/lifecycle/browser evidence is historical, not current-core integration acceptance. |
| Lesters-Arcade-Stacked-Release | `aaf113c5214ee6bed3b8b3efba55ff4b9501af95` | `326d95671f5b6920cc29f68fd515efe2ae4a40fd` | Active parent-owned S-04/S-05/partial S-08 WIP. |

Preservation refs retain their original bytes. Release contracts are canonical for future integration; renderer bundle budgets remain unaccepted until remeasured. Do not wholesale-merge an older sim/constants module. Do not initialize replacement repositories or delete these directories. Recovery logs and local credentials remain local and untouched.

## Last certified production release
S-01–S-03 foundation and security patches were certified at `https://lestersarcade.io`, runtime `65dd4522edcc6158f61e3dafbe6188d7be4e11bb`, deployment `dpl_3vyy1XDPsCAveFDhvm1uvYyFmMPs`, preserving Cycle077. Historical verification includes exact source/atlas bytes and seven desktop plus seven mobile browser flows. See [release verification](releases/S01-S03-release-verification.json). **No public playable STACKED cabinet is claimed, and this reconciliation did not promote production.** Re-read live state before the next release.

## Remaining work and boundaries
Continue S-04–S-22 in dependency order. Real ChatGPT Free/Ranked originals and optimized candidates exist in the intake art folder; title/loading/results and remaining requested art are unfinished. Browser gates stay serial and outside the Node-only build. Preserve HMH/Chikun, saves, shared assets and production ancestry. The approved workflow remains command-free proposals plus parent edits/tests, with no sandbox permission changes.

Public STACKED launch requires G-2/S-22 and actual human-device acceptance. Ranked remains a zero-fee, local replay-verified prototype until its integrity gates pass, not an authoritative paid verifier. No funds, paid entry, settlement activation, authority changes or contract deployment.
