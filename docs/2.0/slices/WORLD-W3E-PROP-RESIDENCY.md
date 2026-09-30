# W3e — private prop display residency

2026-09-30. The private ten-area Pixi scene now allocates nearby solid prop drawings on demand, releases distant drawings before new admission, and recreates them on return. The regular game, geometry, collision/navigation, simulation, versions and Ranked paths remain unchanged. This bounds display objects only; ground drawings, human atlas, world geometry and navigation remain resident.

## Implemented and reviewed

The detached painted-bounds catalog includes solid height. Visibility and residency use the actual camera projection, with a half-viewport acquire margin and one-viewport retention margin. The existing solid painter and depth keys remain unchanged. Authored ordering is restored for equal-depth props after eviction/reentry. Failed destruction remains owned and counted; a later disposal retries only resources that have not been released. Partial construction is cleaned up, and late scene readiness cannot allocate after disposal.

The earlier W0 gate note describes a synthetic outer-border incremental-navigation mismatch, not an observed V2 visible-opening defect. No speculative gate or legacy-nav repair was made. Independent Art and root reviews cleared this display-only boundary. Art's failed-release recovery finding was covered before implementation; equal-depth revisit has a real-scene regression.

## Evidence

Initial RED preserves 13 passing existing controls and 13 expected new failures. GREEN01 retains a test error: it assumed every area-center camera must contain a prop, including an intentionally empty phone clearing. The corrected fixture separately proves the exact visible set and acquire-window coverage while allowing empty views; product bytes did not change. Final **41 source and identical 41 isolated tests pass**: ten residency, sixteen scene, fifteen actual movement/nav. The 43-file copy has no Git or node_modules and an empty PATH. Twenty-two protected authority pins remain exact.

Source camera sweeps observe 581 catalog entries and peak 12 test resources. Actual Chrome follows a denser continuous Meadows–City road out-and-back, then the existing wall and bridge journeys after one explicitly labeled River inspection jump per viewport. It passes eight desktop and seven touch journeys, four denied contexts, input recovery, readiness, pause/hidden handling, close/reentry/pagehide, with no browser/resource/cleanup errors. Actual Graphics counts are different from the source-center sweep:

| Actual browser route | Initial live | Far live | Returned live | Peak live | Close created / destroyed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop | 7 | 51 | 25 | 53 | 71 / 71 |
| Phone framing proxy | 2 | 21 | 1 | 21 | 31 / 31 |

Both close and subsequent pagehide leave zero live prop drawings; reentry resources also balance 7/7 desktop and 2/2 phone. The out-and-back uses only ordinary keyboard/touch movement, with zero inspection jumps during that route. Initial readiness observations are 1707 ms desktop and 1678 ms phone proxy; they include Pixi/atlas/navigation and are not phone performance acceptance.

All seven 1280×800 desktop and five 1242×2688 phone originals were reviewed. Props return coherently, the human remains grounded and readable, wall refusal matches the solid face, water/bridge/bank heights remain distinct, and the interface stays contained. Root independently inspected all twelve originals and metrics. The terrain remains sparse flat-color greybox, not accepted final art. Actual build46760/browser53424/Chrome43516 closed normally, were independently observed absent, and HTTP and the exact owned marker closed.

The private artifact was preserved byte-for-byte: 31 files, 6,152,425 bytes. The fresh normal-build/default-visual result is recorded in the appended gate section below. All original source/browser failures, exact inputs, closure and image identities are bound by the [compact archive manifest](../receipts/world-w3e/archive-manifest.json). Full originals and the private compiled artifact remain in shared local work outputs; duplicate source-copy trees are not committed.

## Normal game regression gate

Fresh normal build verifies 3992 actual inputs exclude private world-v2/greybox modules. Standard **visual:reboot 12/12 unchanged**, with no acceptance flag or baseline edit. All twelve original scenes and three HUD-free enemy images were inspected; legacy ground/prop depth, actor readability and desktop/mobile framing show no new regression. Maximum scene mean delta 0.019, cell delta 4, and 3 changed cells; enemy-crop deltas are zero. These are tolerance-based unchanged classifications, not identical screenshots. Existing terrain seams and sparse/legacy art remain open quality work.

World-worktree initial HMH JavaScript is 1,039,992 B (8,584 B headroom); STACKED is 576,100 B (30,900 B headroom). These are this worktree's candidate results; later combined-root changes require their own fresh gate. Build40008, visual25296 and actual Chrome8344 closed normally and were independently observed absent; HTTP closed and exact marker released.

## Remaining

This is private greybox display ownership, not complete asset/texture streaming, GPU memory or physical iPhone XS Max measurement, full combat/mission integration, owner art/map approval, Ranked end-to-end, combined-root release certification or production deployment. Approved terrain/prop art, real 3D character admission, complete gameplay, versioned official world activation and physical-device budgets remain open.
