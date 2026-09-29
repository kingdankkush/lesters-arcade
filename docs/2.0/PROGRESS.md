# Lester's Arcade 2.0 progress

Updated: 2026-09-29. Stage: owner reference intake and parallel opening implementations. No 2.0 runtime slice is complete or accepted.

## Authority and continuation

- Owner request plus [September 29 handoff](../handoffs/lesters-arcade-2.0-visual-overhaul-handoff-20260929.md) define current scope. Historical deploy mandates, sprite-only pipelines and old branch rules do not override them.
- Program branch: `codex/visual-overhaul-200-20260929`.
- Program worktree: `C:\Users\just_\lesters-arcade-wt\visual-overhaul-200`.
- Starting integration remote: `04366747f79d281af4fd18992f9ccfd857153b5c`.
- Existing integration local checkout remains `28a69f02`; never move its HEAD or modify its work. Separate base repository is older.
- Dependencies: node_modules junction to `C:\Users\just_\lesters-arcade-fable0916\node_modules`; do not run install through it without a separate dependency-change slice.
- [First two weeks plan](PLAN-FIRST-TWO-WEEKS.md) records workstreams, acceptance and decisions.

## Completed kickoff

Read the whole supplied handoff, base AGENTS.md, September 27 roadmap, reference character brief and project memory index in the requested order. The roadmap was absent from the base checkout and found in the integration checkout. Also read actual-head AGENTS.md, current README release sections, existing art bibles/reference targets and the two supplied survey attachments' substantive recommendations. Consulted no key/secret files.

Fetched integration remote. Created the isolated branch/worktree at the fetched head with resolved LFS content and shared dependencies. No existing checkout's HEAD was changed. No runtime source/assets/version files changed; no deployment/promotion, credits, generated art or new phone certification.

Public probes at `2026-09-29T22:04:49Z`: cache `lesters-arcade-v64-share-warm`; health version `1.9.4`, healthy true, degraded false, degradedParts empty, recorded cron failures zero. This is a marker/health check, not full public-file or UI certification.

Codex chat “Lester's Arcade pre-deployment tasks”, ID `01a0cdcf-fea7-7213-8224-95ee2ce3c040`, reports notLoaded; newest imported turn completed. Imported history is September 23, so original Claude-session activity is unconfirmed. Owner clarification requested; recheck before shipping and coordinate if active. No message sent to the inactive imported chat.

Three bounded read-only subagent audits completed: character renderer/performance; W0 world/nav/streaming; STACKED replay. Opening implementations now have separate branch/worktree ownership; see the intake slice entry below.

## Audit findings to carry forward

1. **Characters:** no real-time actor GLB loader/renderer exists. Weighted Blender sources exist but require export/optimization. Keep Pixi actor/prop interleaved depth. Camera 55° from vertical equals 35° from the ground. Initial JS accounting is correctly enforced by `build.mjs`; old smoke's single-file 1,050,000 cap must be replaced. Fresh build headroom is unmeasured.
2. **Performance:** old smokes are short desktop Chrome emulation, not real-device acceptance; current mobile caps only 24 animated enemies. Full-wave workload census, effects-first governor, disposal/streaming and 30-minute flat-memory evidence must be added. `vercel:build` does not currently invoke these performance smokes.
3. **World:** old map is 12,000 × 4,800, six X strips. Source-derived new nav count is 78,156 versus 16,000; array peak about 1.25 MB versus 256 KB, not measured. Flow refresh every 30 ticks touches the whole grid. Props/atlases are created/loaded globally; culling is not bounded area streaming. Test rounded perimeter cells, surface-index fallback and gate patch halos.
4. **Verifier:** current schema 6/7 paths assume old six-strip district travel. Freeze them. W3 must dispatch a new map/rules contract by session-bound version, test version/schema mismatch/downgrade, and preserve old corpus outputs.
5. **Layout correction:** Hollow Pines has only one connection in the handoff sketch despite its two-entrance rule. Resolve with a second route during W2 and include it in owner playtest.
6. **STACKED:** long replay evidence is missing from clean checkout; historical SHA-256 `3e64933b39da1680fcae9568815109e4bc522be059bce4ab2fd14096d00707d5`, 432,028 bytes. Current hot loop already has collision/row/garbage/headless/typed-array improvements. Profile remaining allocation sites before choosing an optimization. Server dispatch currently uses one simulator, not game-version rules.
7. **Survey:** documentation-only two-commit patch has not been applied. Its tip/budget/status claims are historical. Retain interpolation, LOD stability, visual readability, water, capped stateless effects and quality degradation. Current STACKED already has haptics, compressor, springs and interpolation. Keep proposed gameplay/input/timing changes in separate slices.

## Checks actually performed

- Read-only Git state, fetch, worktree/junction creation, clean starting worktree.
- Public cache and health via direct HTTPS. Web browsing tool could not open these endpoints; direct HTTPS succeeded with network approval.
- Source/test/receipt audits, no full build or release gate.
- One cheap fresh-process diagnostic: `tests/fixtures/ranked/stacked-15min.json`, Node `24.17.0`, Windows x64, 54,017 ticks, 54,045 evidence bytes, 33.066 ms wall / 46 ms process CPU; score `10468836` matched, `block-out`. Module import/file read excluded. One shorter sample; longest-run target unverified.
- No actual browser test, visual:reboot run, baseline acceptance, physical phone test or full Ranked end-to-end in this kickoff. These are pending implementation-slice checks, not passing gates.

## Next slices and dependencies

- Lead A0/A1: current screenshots/reference inventory and draft art bible, then A2 Meadows patch and owner sign-off.
- Agent R0/R1: failing actor boundary/workload tests and existing-model depth/export pilot.
- Agent W0a/W0b: scale/nav benchmark and bounded presentation asset leases.
- Agent S0: recover/checksum the longest fixture and add fresh-process <250 ms replay acceptance before other STACKED work.
- Independent reviewer after every gameplay/verifier change; tests must run without .git. Browser/heavy jobs serialize under `C:\Users\just_\lesters-arcade-wt\.locks\heavy.lock`; never remove another job's lock.

Confirmed owner inputs: iPhone XS Max with Chrome; both world and enemy/boss reference folders supplied. Pending: iOS version and on-device measurement access; external pre-deploy session status. Future approval checkpoints: art bible + slice, 3D results, ten-area greybox, gameplay/audio options in the plan and each release. Gore settings and clean share cards are in scope; default Full remains an open handoff decision.

Every new track/system must have an explicit switch, with new features disabled initially. Each accepted slice merges into `fable/master-list-20260916` after its gates/review and integration-owner coordination. This kickoff documentation is a local candidate, not an integration merge or release.

Independent kickoff-plan review found and corrected the gore-default authority wording and made switches/integration requirements explicit. This review is planning review only, not gameplay/verifier certification.

Before new generations: inspect balance and casting board, reuse first, disclose large spend. No credits spent. Repository-source migration awaits inventory/checksum plan; no source art deleted or moved.

Append one entry per completed slice with candidate SHA, changed behavior, tests/evidence, failures/skips, owner approvals, merge status and next dependency. Do not mark a plan or proxy result as an accepted feature.


## A0/A1 reference intake and draft — 2026-09-29

Owner now asks to continue all authorized work toward **one combined final update**. Interim releases are no longer planned. Production deployment still requires explicit approval for the completed release. Art bible + target slice, phone performance and ten-area greybox checkpoints remain open.

Owner answered the batched decision question **Use the recommended prototype package**: tall cover reduces damage by 60%, short by 40%; gore defaults to Full with Off/Reduced settings and clean share cards; enemy grunts/deaths and footsteps with silent heroes; versioned Chikun power-ups, chase moments and fork lanes. Current jukebox remains; progression is measured before any retune. This authorizes separately tested prototypes, not final balance/Ranked acceptance or release. Water remains visual-only unless separately approved. Art, phone-performance, greybox and release approvals remain separate.

Confirmed target device: **iPhone XS Max, Chrome**. iOS version and physical performance capture remain pending; no emulation result substitutes for this phone.

Inspected all 35 world references and 18 enemy/boss references. Enemy/boss subagent inspected all 18 at original resolution. World contact pages cover all 35; lead also inspected L01, L02 and L15 at original resolution. Source totals: world 111,189,381 B; characters 47,728,133 B. All 53 SHA-256 values verified again while building the local board; no source modified, moved or deleted. Intake is a dated snapshot; future folder additions require a new inventory.

- [Draft art direction](../art/ART-DIRECTION-2.0.md) covers style, camera, metre/texel calibration, shared light, ten palettes, shape/material/wear, terrain/water/foliage, readable interactions, density and review criteria. Numerical art targets remain proposed until A2 and measured memory/performance evidence.
- [Reference index](../art/REFERENCE-INDEX-2.0.json) records metadata, hashes, observations, proposed 24-image curation and tentative character pair mappings. Original references remain external; no image payload added to Git.
- Local owner output: `hmh-2.0-reference-board.html`, a self-contained board with the proposed 24 world images, all 35-world archive and all 18-character gallery. It is a reference artifact, not an in-game screenshot or production asset.
- Reference colour conflicts are explicit: red barns, bright water, forge heat and stage stripes must yield to reserved gameplay cues. Rugpull Woods camp-specific study is still missing; reuse/source review precedes any generation.
- Dedicated new sheets for existing six enemies/Liquidator are absent here; existing approved references/models remain the starting point. Costume/phase studies do not authorize new hitboxes, phases or AI.

Parallel implementations, all created at kickoff commit `2d67acb9` and junctioned to the existing dependency installation:

| Slice | Own worktree / branch | Current task |
| --- | --- | --- |
| STACKED S0 | `200-stacked-replay` / `codex/200-stacked-replay-20260929` | Named fixture recovery unsuccessful; reproduce a legal max-length run with existing pilot, add durable expectations and fresh-process measurements. No simulator/rules change. |
| World W0a | `200-world-w0` / `codex/200-world-w0-20260929` | Actual nav/elevation/flow diagnostic benchmark and boundary/readiness/patch coverage. No active map or runtime change. |
| Character R0/R1 | `200-character-pilot` / `codex/200-character-pilot-20260929` | Existing Commando + Bagholder optimized GLB export and tested projection contract before a real renderer/depth pilot. No claimed working 3D layer yet. |

Heavy jobs run serially: STACKED fixture generation/timing first, W0 next, character export/build after. Each agent records its slice in `docs/2.0/slices/`; independent review precedes integration. A failed character worktree command against the obsolete base repository created nothing; the assigned checkout was already created correctly and is now used.

Intake checks: all source hashes, board collection/card counts, metadata dimensions, draft relative links and whitespace. No runtime changes in this documentation slice. No browser game run, visual:reboot, physical phone results, full release gate or production-art acceptance. No credits spent, original source migration, version bump, push, integration merge or deployment.

Next art dependency: A2 actual-runtime target patch using legal existing geometry; review bible + patch together. The draft is not a sign-off request on its own.
