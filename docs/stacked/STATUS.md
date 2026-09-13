# STACKED delivery status

## Current continuation

**STACKED only.** The active continuation is the real linked worktree **Lesters-Arcade-Stacked-S04-Integrity**, branch `feature/stacked-s04-integrity`, based on raw preservation commit `74b72f495ad05a5bcbd323b68871b6465eedc67a`. The Release, Renderer, Portal and historical Stacked worktrees are preserved inputs, not parallel source writers. Do not reset, clean, delete or wholesale-merge them.

The supplied `Stacked-Prompt.md` is a historical briefing, not current Git/test truth. Its named `STACKED-GAMEPLAN-2026-09-07.md` and `HERMES-REPROMPT-2026-09-07.md` were not present in the inspected Stacked doc sets. See [CYCLE-004](cycles/CYCLE-004.md) for this session's bounded correction and [the earlier reconciliation](reviews/CLAUDE-20260907-reconciliation.md) for prior work.

## Accepted baseline

S-01, S-02 and S-03 remain accepted at core commit `33b43e627f7d509e5f37d49368d89db1c2fd65a2`, integrated into the production lineage at `65dd4522edcc6158f61e3dafbe6188d7be4e11bb` and Release HEAD `aaf113c5214ee6bed3b8b3efba55ff4b9501af95`. Cabinet 0.2.0; golden result fixture unchanged. Historical S-03 evidence is in [CYCLE-003](cycles/CYCLE-003.md).

## Current measured state, not full cycle acceptance

- Fresh preserved-WIP baseline: **268 Stacked tests, 248 pass, 20 fail**. Eighteen unfinished predictor tests referenced a missing export; two purity checks rejected `filter(Boolean)`. The neutral-stop regression was already passing.
- Bounded correction: implement the validated SIC1 transition-byte predictor used by the sim, keep independent encoder sizing and a falsification test, and use an equivalent local boolean predicate without weakening the AST purity gate.
- After correction: **268/268 Stacked tests pass**, no skips/cancellations. Full suite: **2,836 tests, 2,785 pass, 51 inherited failures; zero new failure names**. The baseline-aware release gate passes. Syntax, cabinet docs, build and contracts regeneration pass; generated contract JSON is unchanged.
- The saved uninterrupted **432,000-tick** evidence replays to its exact recorded terminal tuple. Fresh Node measurements: **391.0662 / 350.2257 / 342.0912 ms**, against the unchanged 400 ms limit. This is a calibration receipt with narrow cold-sample headroom, not a newly installed performance regression gate or complete S-04 acceptance.
- Real Node worker/live-inline parity tests pass. Browser source-worker verification was **blocked before navigation** by the browser tool's private-address policy. No alternate access path was attempted; no browser or human-device pass is claimed.
- Independent command-free Codex review of the exact bounded correction **passed**, with zero tool/command events and unchanged source hashes. The entire recovered S-04/S-05/S-08 candidate is not certified by that limited review.

## Preserved candidates

All four original directories were verified registered Git worktrees with `.git` pointer files. Their four existing preservation refs were read back from GitHub; historical, Portal and Renderer changed-file bytes still match those snapshots. Release had newer work, so it received an additional raw-byte snapshot before any repair. **Preservation is not acceptance.**

| Worktree | Baseline | Preservation commit |
| --- | --- | --- |
| Lesters-Arcade-Stacked | `33b43e627f7d509e5f37d49368d89db1c2fd65a2` | `fac9b8c29dd6da0846e211c8fd9d5149463dac2d` |
| Lesters-Arcade-Stacked-Portal | `a9100b37a58ade116fca420e57565c59bad38922` | `bfe190df441f97b5990d38aa8a57726ba8395a95` |
| Lesters-Arcade-Stacked-Renderer | `a9100b37a58ade116fca420e57565c59bad38922` | `2aaa6b05f2df0c5d59c276e5d918d3428e04d72a` |
| Lesters-Arcade-Stacked-Release, earlier WIP | `aaf113c5214ee6bed3b8b3efba55ff4b9501af95` | `326d95671f5b6920cc29f68fd515efe2ae4a40fd` |
| Lesters-Arcade-Stacked-Release, newer WIP | same working baseline; child of prior preservation | `74b72f495ad05a5bcbd323b68871b6465eedc67a` |

The new `preserve/stacked-reconciliation-wip-20260907` ref contains all **46 changed/untracked source, test and doc paths** in Release, verified against raw Git blob bytes and the remote ref. Original HEAD, index and working source were left untouched. Ignored recovery logs, local credentials, dependency/build output and other worktrees were not added or deleted.

## Production observation and boundaries

Remote `feature/stacked-release-live` remains `aaf113c5214ee6bed3b8b3efba55ff4b9501af95`, 50 commits ahead of the observed `origin/main`. Live Stacked sim, contracts, cabinet definition and registry bytes match that accepted HEAD; the registry contains no Stacked entry. The live service-worker marker is newer (`lesters-arcade-v32-hmh-gameplan-defects`), so the old deployment ID is historical, not a current-production claim. **No production deployment was performed here.**

This session's briefing controls over broader historical publication language: G-15 requires approval of each exact deployment ID. Public launch waits for G-2/S-22 and human-device acceptance; Ranked writes wait for G-3. No funds, paid entry, settlement activation, authority changes, contract deployment or online-versus backend. F-11's keep/park decision remains owner-gated; the accepted match seam was not changed. HMH cycle work and worktree reconciliation are out of scope.

## Next bounded work

S-04 remains substantially implemented but unaccepted; S-05 and partial S-08 are preserved and unaccepted. Renderer S-11/S-12 still targets an older sim; S-06 still needs selected dev-only integration with `status: coming-soon`. Complete current-core renderer verification, full S-04/S-08 acceptance and remaining cycles in dependency order, one cycle per real worktree. Do not import historical constants or accept unmeasured renderer budgets. Preserve current production ancestry; do not rewrite history or merge to main without a separate consolidation decision.

The [input-mask amendment](amendments/INPUT-MASK-CLARIFICATION-v1.md) records the pulse/held-input distinction and open ARR/touch cadence conflict for S-15/G-19. A generic maximum-bit-count rejection was not invented: neutral release is mandatory, and the existing byte alphabet/precedence rules still govern legal chords.
