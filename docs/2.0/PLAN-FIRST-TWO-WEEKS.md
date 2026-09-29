# Lester's Arcade 2.0 — first two weeks

Planning window: September 29–October 12, 2026. This is the opening validation program, not a promise to finish 2.0 in two weeks. The full overhaul remains roughly 25–30 gated slices over many weeks. HMH world design and world art lead the release.

## Verified takeover state

- Read the supplied September 29 handoff in full, followed by the base repository's AGENTS.md, the September 27 status/roadmap, the reference character brief, and the project memory index. Also read AGENTS.md and release sections at the actual integration head. Current owner instructions supersede historical branch, art-pipeline and release permissions.
- Fetched the integration checkout's remote. `origin/fable/master-list-20260916` is `04366747f79d281af4fd18992f9ccfd857153b5c`. Its existing local branch remains `28a69f02`; it was not moved. The requested base checkout is a separate older repository.
- Public checks at September 29, 3:04 PM Pacific: `/sw.js` serves `lesters-arcade-v64-share-warm`; `/api/health` reports version `1.9.4`, `healthy:true`, no degraded parts and zero recorded cron failures. These checks establish the public marker and API state, not full release certification.
- Created `C:\Users\just_\lesters-arcade-wt\visual-overhaul-200` on `codex/visual-overhaul-200-20260929` at the fetched head. Its `node_modules` junction targets the existing `lesters-arcade-fable0916\node_modules` installation.
- Codex's chat “Lester's Arcade pre-deployment tasks” is `notLoaded`, with its latest imported turn completed. The imported history is old; activity in Claude or another app remains unconfirmed. Recheck and coordinate before any release. Never change that session's worktree.
- No runtime changes, version bumps, deployment, production promotion, new art generation or Tripo spend in this kickoff.

## Four opening workstreams

I own art direction, integration and acceptance. Three subagents have completed bounded read-only audits for characters, world sizing and STACKED replay. Implementation will use separate slice branches/worktrees; browser jobs and heavy gates run serially under the shared heavy lock. Reuse agent slots for independent review after implementation, rather than continuously running a large team.

| Workstream | Week 1: September 29–October 5 | Week 2: October 6–12 | Exit evidence |
| --- | --- | --- | --- |
| Art bible + target slice — lead | A0: inventory existing references/assets and capture the current game. A1: draft `docs/art/ART-DIRECTION-2.0.md`, with a 20–30-image reference board led by Justin's images. Define camera convention, scale, calibrated texel density, lighting, area palettes, materials/wear, ground/foliage, gameplay colour/shape grammar and density. | A2: finish one small Meadows roadside clearing in the actual runtime using existing collision geometry. Compare native desktop and phone-framed captures, motion and `visual:reboot` metrics. Submit bible + playable slice together. | Owner sign-off before production art. The slice demonstrates quality; an attractive screenshot alone is insufficient. |
| Real-time 3D characters — agent 1 | R0: failing presentation-boundary and workload tests. R1: optimize/export existing Commando and Bagholder sources; lazy renderer adapter; prove foot pivots, human scale, lighting and interleaved depth against tall Pixi props. | R2: hero + 40 animated enemies, then full heavy wave; R3: boss, streaming, restart/disposal, context failure and 30-minute soak. Derive polygon/bone/material/texture/LOD budgets from measurements. Wire smokes into the release gate. | Same simulation/RNG/evidence with rendering on/off; initial aggregate JS within 1 MiB; named physical-phone evidence and owner performance checkpoint. |
| W0 world size + streaming — agent 2 | W0a: benchmark actual nav/elevation code at 12k × 4.8k and 20k × 14k with representative density. Test perimeter rounding, directed edges, readiness and gate patch parity. W0b: area asset leases, prefetch, eviction, cancellation and disposal. | W0c: repeat boundary crossings and measure decoded/GPU bytes, residency, nav build/flow cost and frame stalls. Begin W1 greybox kit/checker only after W0 evidence supports it. | One continuous simulation map; presentation streaming never changes simulation readiness or RNG. Measurements distinguish real phone from desktop proxies. W2's ten-area playable greybox and W3's new verifier table follow. |
| STACKED replay headroom — agent 3 | S0: restore/reproduce the legal 432,000-tick replay and commit a durable fixture with expected state/tuple/evidence. Measure fresh-process decode, replay and full verification separately. S1: profile and make one measured optimization at a time. | S2: independent adversarial parity review, old fixtures, malformed inputs, server + worker + actual browser paths. Close the replay gate before other STACKED work starts. | Longest replay below 250 ms on the recorded verification environment; identical board/state/RNG, score tuple, packed evidence, digest and accept/reject outcomes. No higher cap or skipped ticks. |

Calendar dates are targets. At the second-week checkpoint, report the exact passing candidate and any missing evidence rather than relabeling incomplete work as accepted.

## Acceptance and risks discovered

**Initial-load budget.** The hard HMH limit is 1,048,576 B for entry + vendor + static shared JavaScript. The handoff's “less than 250 KB added” pilot allowance cannot override it. New renderer/systems must be dynamically loaded, and even bootstrap bytes must fit the aggregate limit. `build.mjs` already uses correct accounting; the old performance smoke's 1,050,000 B single-file check does not. Fresh bundle and tracked-art byte measurements are an opening task; historical receipts disagree on headroom and are not a current baseline. STACKED's initial limit remains 607,000 B.

**3D integration.** Existing Blender sources have rigs, but are heavy source assets, not optimized runtime GLBs. A single transparent 3D canvas over the Pixi world would fail actor/prop interleaving. Prove the depth adapter and GPU/context cost before extending it. Existing `cameraPitchDegrees:55` is measured from vertical: it equals the brief's 35° above the ground. Preserve input/collision projection authority.

**Required performance scenarios.** Heavy wave: hero, 60 enemies, boss, 20 effects, Full gore and four grenades simultaneously; phone at least 30 fps with maximum frame 50 ms, desktop 60 fps. Boss: busiest phase + 20 adds, same fps targets. Traversal: maximum stall 100 ms phone / 50 ms desktop. Long run: 30 minutes without retained CPU/GPU memory growth or slowdown. Report p50/p95/p99/max plus actual workload counts. Existing short desktop-emulated phone smokes, historical heap tolerances and `deviceAcceptance:false` receipts do not establish these results.

**World scale.** With existing 60-unit cells, nav cells grow from 16,000 to 78,156. The calculated nav/flow/BFS array peak grows from 256,000 B to about 1.25 MB; this is source arithmetic, not a measurement. Recurring whole-grid flow work every 30 ticks, eager prop construction and globally loaded textures need measurement. Culling already exists; bounded area streaming does not. Keep navigation simulation-owned and resident. Test final rounded cells beyond 20,000 × 14,000 and elevation index fallback.

**Map compatibility.** Current schema-6/schema-7 verification assumes six contiguous district strips. Ten branching areas require frozen legacy tables and a new map/rules contract selected from authenticated session-bound game/build version. Test mismatches and downgrade paths. Do not modify old tables in place. The map sketch gives Hollow Pines one connection despite the two-entrance rule; add a second route during greybox design and record it for playtest.

**STACKED evidence.** The historical long fixture SHA-256 is `3e64933b39da1680fcae9568815109e4bc522be059bce4ab2fd14096d00707d5` (432,028 bytes); it is missing from the clean worktree. One current diagnostic of the committed 15-minute fixture replayed 54,017 ticks in 33.066 ms wall time on Node 24.17.0 / Windows x64 and matched score 10,468,836. Import/read excluded; one shorter sample proves no longest-run budget. The current server test uses the fastest warmed short replay below 500 ms. The reported 400 ms limit is historical calibration, not an enforced timer in the audited server module. Build a real fresh-process longest-run gate.

## Survey intake

Reviewed `Arcade Techniques Survey.html` and the two-commit research patch as recommendations. The patch changes research documentation only and is based on an older tip; it has not been applied.

Retain for measured slices: actor/projectile render interpolation; stable animation LOD transitions; distance-matched locomotion; projection-only recoil springs; interactive shape/value cues and a real colour-blind remap; restrained shoreline foam/depth/caustics; bounded stateless weather/effects; effects-first quality degradation; honest warm-up and frame-ready QA hooks. These support the four openings or later approved tracks.

Reconcile before doing work: contact shadows, depth sorting, pooling, static bakes, Web Audio, share cards and several STACKED feel features already exist. Current STACKED source includes haptics, compressor, board springs and active-piece interpolation. Improve measured gaps rather than rebuilding these systems from stale survey status.

Keep separate and owner-gated where applicable: dash input buffering, hit-stop, AI approach slots, perfect-dodge rewards, catch-up/evidence changes and course rules. A survey suggestion to combine input work with a recoil presentation pass does not satisfy the separate gameplay-slice rule. Audio synthesis avoids audio asset bytes, not JavaScript cost. New physics engines, raising replay limits and altering simulation cadence are outside these openings. Read-only presentation randomness never draws simulation streams.

## Decisions and owner checkpoints

Immediate practical inputs: a named physical midrange phone/browser and a way to capture its performance evidence; folder/link for the newest world concepts; whether the original pre-deployment session is active outside Codex. Existing references and desktop measurements let independent work continue.

| Decision | Recommendation / timing |
| --- | --- |
| Art bible + target slice | Review the concrete pair before production art. Warmer painterly frontier is a candidate direction, with noir retained for the city; no style change is considered signed off yet. |
| 3D performance | Review exact workload/device receipts before scaling character production. |
| Ten-area greybox | Play the connected greybox with ten one-page briefs before area art. |
| Cover damage reduction | Propose tall −60% / short −40% in an isolated gameplay/verifier slice; compare with geometric blocking only. Recommend the proposed values as the starting point, subject to playtest approval. |
| Gore | Off / Reduced / Full and clean share images are in scope. Default Full remains an open handoff decision; recommend it with clearly available Off/Reduced settings. |
| Voices/footsteps | Choose enemy grunts/deaths + footsteps with silent heroes, or retain the current silence rule. Recommend the former only after approval. |
| Chikun course v2 | Choose approved power-ups/chases/fork lanes in a new version, or visual-only scope. Recommend the versioned package after the visual pass; water remains visual-only unless separately approved. |
| HMH music | Choose unchanged jukebox or an added dynamic layer. Recommend keeping the jukebox for this opening phase. |
| Progression power policy | Historical −14% results predate live hero-stat changes. Rerun the current harness first; then choose accepting the gap, offer weighting/caps, or stronger gun trees. No unsolicited retune. |
| Tripo casting | Existing models first. Obtain casting picks and inspect authenticated balance before generation; report a large proposed spend before using credits. No purchase/subscription changes. |
| Release shape | One 2.0 launch; propose completed STACKED/Chikun early only if useful. Every deployment/promotion needs approval for that release. |

## Working and release contract

Every behavioral slice: audit → failing tests → smallest coherent change → focused checks → actual browser path → full-resolution desktop/phone-framed evidence and machine metrics → independent review for gameplay/verifiers → commit. Each new track/system has an explicit switch; new features start disabled. Merge each accepted small slice into `fable/master-list-20260916` while preserving its approval gates and coordinating with the integration owner. Phone framing is not physical-device certification. Tests use committed fixtures/reference data, never Git at runtime. New map/mode gameplay stays local and gated until versioned verification is ready. Production-art assets are reviewed against the accepted bible and target slice before merging.

Preserve simulation 60 Hz / four catch-up steps, bridge and parent authority, Free/Ranked isolation, old-run verification and source references. Only runtime assets belong in Git LFS; bulk editable source migration is inventoried, copied and checksum-verified before any removal. Do not touch keys, Vercel secrets, `~/.tripo`, contracts, transactions, settlement or jackpot.

After each major slice, update `docs/2.0/PROGRESS.md` with candidate, tests/evidence, failures/skips, owner decisions and next dependency. Keep commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No pushes to main or hook bypasses. Site/game/cache versions change only in a release commit. Approved releases follow handoff §0.3: full gate under the shared heavy lock, exactly the 51 retired exceptions, commit gate record, deploy/promote, verify live markers/health/screens and record the release. Approval is never inferred from older sessions.
