# STACKED S-04: recovery and evidence-predictor correction

## Scope and status

**Bounded correction; S-04 is not accepted as a whole.** Preserve the newer Release WIP before edits, finish the missing transition-byte predictor, and make the existing T-spin predicate compatible with the unchanged purity audit. Do not integrate the renderer, register a cabinet, enable Ranked writes, change mechanics/seed/result bytes, touch HMH cycle work, or deploy.

- Source working baseline: `aaf113c5214ee6bed3b8b3efba55ff4b9501af95`.
- Earlier Release preservation: `326d95671f5b6920cc29f68fd515efe2ae4a40fd`.
- New raw-byte preservation / correction base: `74b72f495ad05a5bcbd323b68871b6465eedc67a`, remote `preserve/stacked-reconciliation-wip-20260907`.
- Continuation: `feature/stacked-s04-integrity` in `Lesters-Arcade-Stacked-S04-Integrity`.
- Frozen correction diff SHA-256: `f7580086fc36e015ab1ce8f8bf8ab069cc2347196156df96aa35c39f61b64971`.
- Evidence receipt: [S04-recovery-correctness-verification.json](../reviews/S04-recovery-correctness-verification.json).

## Reproduced baseline and root causes

Fresh run of all 31 Stacked test files produced 268 tests / 248 pass / 20 fail. Eighteen varint-boundary tests were stranded RED tests for the absent `sic1TransitionByteLength` export. The current sim's predictor still worked inline but could not be tested at every structural varint boundary. Two purity tests failed because the newly hardened AST gate forbids escaping a builtin as a callback and the existing spin probe used `occupied.filter(Boolean)`.

The handoff's stop/resampling failure was stale. Its regression and valid-chord tests passed unchanged. The contracts variants were also narrower than claimed: Renderer introduced unaccepted bundle caps; Release centralized Q16/message-size constants. No conflicting gameplay tuning was found. Historical variants remain byte-preserved rather than silently rewritten.

## RED -> GREEN

1. Preserved all 46 changed/untracked Release paths verbatim using an alternate Git index, raw blob hashing, per-file readback, a separate preservation ref and exact remote readback. No repair was mixed into that commit.
2. Ran the pre-existing missing-helper regressions and purity failures before production edits. Updated the predictor mutation test's injection point for the intended extraction; the targeted RED run was 72 tests / 52 pass / 20 fail.
3. Extracted a validated `sic1TransitionByteLength(previousMask, mask, gap)` and called it from the real simulation transition path. It accepts only uint8 masks and an integer gap in 1..432000. Equal masks cost zero; one-bit changes at gaps 1..16 cost one byte; all other changes cost marker + varint(gap-1) + mask.
4. Kept encoder sizing independent. Real-run tests compare actual bytes with `snapshot.encodedEvidenceBytes + 1 + varintLength(totalTicks)`: the snapshot includes the header and records, not the SIC1 terminator. Structural fixtures cover long gaps without pretending unattended gameplay can reach those states.
5. Kept the mutation negative control: deliberately charging two bytes for a short record must make the real-run coupling assertion fail.
6. Replaced the boolean-array callback with `value => value`. No spin ordering, corner probes, SRS tables, RNG, tuning, output encoding or purity policy changed.

## Verification

| Check | Observed result |
| --- | --- |
| Targeted predictor/purity/stop/chords/contracts | 120/120 pass, zero skips/cancellations |
| All Stacked tests | 268/268 pass across 31 files |
| Full Node suite before correction | 2836 tests / 2765 pass / 71 fail |
| Full Node suite after correction | 2836 tests / 2785 pass / 51 inherited fail; no new failure names |
| `npm run test:release` | PASS: 2836 tests, 2785 passed, 51 expected failures |
| `npm run check` | PASS: 451 JS modules and 57 Python scripts |
| `npm run design:stacked-purity` | PASS: AST audit of all three canonical modules and closed import graph |
| `npm run design:stacked-contracts` | PASS; generated JSON bytes unchanged |
| `npm run docs:cabinets` | PASS; no Stacked cabinet registered |
| `npm run build` | PASS; existing portal build only, not integrated Stacked renderer acceptance |
| Real isolated Node worker | Focused suite exercises golden live/inline/worker parity and wrong-seed rejection |
| Browser source-worker smoke | BLOCKED before navigation: `Blocked: URL targets a private or internal address`; no bypass attempted |
| Independent bounded-diff review | PASS: command-free Codex `gpt-5.6-sol`, high reasoning; completed turn, zero tool/command events, frozen source hashes unchanged |

Raw execution logs are retained locally under `.tmp/reprompt-gates/`; the committed JSON receipt records counts, failing names, source/log hashes and commands without embedding unrelated CLI transcripts or credentials. The test gate rewrote its generated HMH report in this newly created worktree; that known test output is excluded from this Stacked slice and restored to its pre-run bytes. No original HMH worktree is edited.

## Maximal replay calibration, not complete performance acceptance

The previously generated uninterrupted legal fixture was recovered locally from the Release worktree and checksum-verified:

- 432000 ticks; terminal `tick-ceiling`; 432028 encoded bytes.
- Evidence SHA-256: `3e64933b39da1680fcae9568815109e4bc522be059bce4ab2fd14096d00707d5`.
- Current-candidate replay timings: 391.0662 ms cold, 350.2257 ms and 342.0912 ms warm.
- Every result was deep-equal to the saved live tuple. The generator and current source hashes are recorded separately, not presented as identical builds.
- All three observations were below the unchanged 400 ms bar, but cold headroom is small. This calibration is not yet the permanent maximal-length performance regression test required for full S-04 closure. Browser/worker performance and complete chunk/storage acceptance remain separate.

## Remaining acceptance and owner gates

The recovered S-04 transport/store/worker/bridge and partial S-08 schema need full current-source acceptance, not just this two-file review. Preserve the S-05 pilot as unaccepted supporting work. Renderer rebase, dev-only portal integration, full summary projection and later cycles remain open. The mask cadence discrepancy remains documented for S-15/G-19.

The current user briefing supersedes historical broad publication language: G-15 is exact-deployment approval; G-2/S-22 is human-device/public-launch approval; G-3 still gates Ranked writes. F-11's keep/park decision is not made here. No production promotion, public cabinet, financial activity, CSP relaxation, new service or HMH cycle integration occurred.
