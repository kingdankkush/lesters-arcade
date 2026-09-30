# Lester's Arcade 2.0 progress

Updated: 2026-09-29. Stage: reviewed replay diagnostics, default-off two-actor3D and Chikun pickup prototypes gathered locally; terrain and revised art are in their gated lanes. No 2.0 runtime feature is accepted or deployed.

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

1. **Characters:** no real-time actor GLB loader/renderer exists. Weighted Blender sources exist but require export/optimization. Keep Pixi actor/prop interleaved depth. Camera 55° from vertical equals 35° from the ground. Initial JS accounting is correctly enforced by `build.mjs`; old smoke's single-file 1,050,000 cap must be replaced. Character-lane baseline/final builds measure 1,039,317 B aggregate (9,259 B headroom); its dormant pilot adds zero initial code. This is not a combined-candidate build or an active-renderer budget result.
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

Confirmed owner inputs: iPhone XS Max with Chrome; both world and enemy/boss reference folders supplied. Pending: iOS version and on-device measurement access; external pre-deploy session status. Future approval checkpoints: art bible + slice, physical 3D results, ten-area greybox and the final release. The recommended gameplay/audio prototype package, including default Full gore, is now approved as recorded below; final balance and Ranked acceptance still require their tested slices.

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

## S0 and W0a diagnostic integration — 2026-09-29

Independently reviewed diagnostic slices are now gathered into the isolated program branch. Program commits: `1ce69da6` (maximal STACKED fixture/harness), `ccb041ee` (complete retained batches and safe child-output parsing), `af2c3667` (fresh parity/no-Git checks), `ebda840d` (native world diagnostic), `4805bbd3` (exact-source measurement refresh) and `25bdb41f` (source-bound character export pilot and inactive ownership seam). These are local cherry-picks, **not merges into the integration branch**. Integration-owner coordination and certification remain pending; no push, version bump or deployment occurred. The syntax registration conflict was resolved by preserving both lanes' new module lists; its resolved source parses.

**STACKED:** [S0 receipt](slices/STACKED-S0.md) retains an uninterrupted legal developer-pilot run of 432,000 actual ticks, canonical checkpoints, exact evidence and verifier expectations. Replacement evidence SHA-256 is `769d2425938c2eb2659eaa97e0868a4089c633592c262b69a587d078a3d8dab1`, 432,028 raw bytes; the historical missing SHA was not recovered. Seven fresh processes in each phase all pass: maximum actual decode 34.5573 ms, replay 173.2194 ms, complete per-game verification 206.0789 ms. Verification includes decoding/replay/digests/envelope/result; separate diagnostic times are not summed. Startup/import/read/decompression/assertions, authentication, paid-entry/API/network/settlement are excluded. This is local desktop Node evidence, not production CPU or Ranked end-to-end acceptance.

Independent review caught an incomplete-batch assessment gap and unsafe child-output parsing. Regression tests failed first and were repaired; every phase must contain the configured 5..30 unique sample slots and invalid output is retained as failure. The historical successful batch contained all 21 samples and remains unchanged. Fresh repaired checks: **35/35 focused**, **12/12 in a standalone source copy with neither .git nor node_modules**, no skips/cancellations. No simulator, codec, rules, evidence format or server behavior changed. The opt-in benchmark is not yet in the release gate. A separate genuinely different multi-bit run has now reached432,000 real ticks and passed the actual decoder, terminal replay and old per-game verifier:643,624 raw bytes, SHA-256 `41faf8d9f9ff38409cf6ebace00bd23a4d41aeb497e3216cf37d89ef8c7e887c`. All21 fresh phase observations pass; maximum completeverify227.4107ms, measured local margin22.5893ms. Durable fixture/test/receipt preservation and review are underway in the world lane. Neither fixture bounds the maximum accepted encoding or production CPU. Global S0 stays open, and other STACKED work waits.

**HMH world:** [W0a receipt](slices/WORLD-W0A.md) benchmarks the actual nav/elevation/flow/gate APIs using current geometry, a deliberately adverse expanded-bounds control, and repeatable synthetic loads. The refreshed `2026-09-29T23:11:03.545Z` batch measures exact LF candidate source bytes; all seven direct SHA-256 hashes match this program checkout. Focused checks pass **49/49** with no skips. Retained nav + one flow arrays measure 112,000 B current / 547,092 B target. Synthetic target build median/max 108.068/110.050 ms, highest instrumented chunk 2.003 ms, highest observed flow 1.452 ms on the desktop host. Peak scratch/heap/CPU/GPU/phone residency, browser idle scheduling, streaming and 30-minute memory remain unmeasured.

Adverse observations remain visible: all 567 rounded-lattice cell centres outside exact target bounds are walkable when merely extending the old map; opening border gates differs from a full rebuild by 4 west /12 north cells. Guarded synthetic perimeter blocks the out-of-bounds cells; actual current interior gate matches. Future greybox checker must reject the unguarded perimeter and avoid border gates until a separately tested rules/navigation change establishes parity. Synthetic walkability 44.55% is below the requested45–55% band and is not a passing map. The actual ten-area world is not built or accepted.

**Characters and art:** [R0 receipt](slices/CHARACTER-R0-R1.md) records source-faithful skinned Commando/Bagholder GLB review candidates with real timed clips. Their offline re-import previews are model inspections, not game screenshots or a working renderer. Independent review exposed corrupt animation/index data accepted by the validator and an output-path route that could overwrite immutable source files. RED regressions and fixes now enforce finite FLOAT clip data, strict times/shapes/counts, unsigned scalar indices, declared-buffer bounds and exact owned outputs before Blender opens;19 Node checks plus3 Python path regressions pass. Lead independently reproduced all four corrupt assets being rejected by the repaired validator. No source was overwritten. Model bytes did not change for the fixes. Commando25,891triangles/22joints/9clips/8,023,452B; Bagholder8,274/19/6/1,746,308B. Texture storage estimate33,559,868B with mipmaps excludes CPU/GPU/render-target overhead and is not a phone measurement. Character-lane baseline/final builds both total1,039,317B initial JS; the seam is inactive and adds zero initial code. R1 must still provide real lazy Pixi rendering, prop interleaving, fallback restoration and simulation parity. A2 is authoring a default-off Meadows target patch around legal existing hedgerow/farmhouse footprints. The shared camera adapter is being calibrated against actual native1m axes; a swapped55° convention was caught before baking. Coordinate compatibility with the currenty−z projection does not by itself establish the desired apparent camera. Art direction, target patch, hardware results and production art all remain unapproved.

**Repository budget:** metadata-only inventory at program`25bdb41f` counts4,251trackedfiles and870,164,584working-copybytes using the same stat accounting as`repo-health.mjs`; strict cap367,001,600B(350MiB) is exceeded. Across the checkout,1,185trackedart-formatfiles total708,418,735B;494,780,386B are editableBlender models and43,289,889B are other source art by path heuristic. No unresolved LFS pointers or missing tracked files were found. Classification is an inventory heuristic, not proof that a file is unreferenced or safe to remove. Archiving all editable models alone would still leave375,384,198B above the cap; models plus these source-art candidates would project332,094,309B before added assets/docs. These are subtraction estimates, not an executed migration or passing gate. The small metadata receipt records paths/sizes; full archive copies/hashes and source-dependent pipeline/test migration are pending. No source was removed or original reference changed. New editable art is archived only under the supplied non-secret artwork root`C:\Users\just_\Desktop\Projects\LestersArcade-Assets\2.0\Source\`, preserving a checked scratch copy; no credentials vault is accessed.

All heavy timing/test/export/browser jobs are serialized by ownership of the shared heavy lock. No credits or dependency installs, keys/secrets, contracts, transactions, settlement or jackpot changes. The combined branch has not had a full release gate/build, browser visual certification or any physical phone test. Next: larger legal STACKED evidence, reviewed character boundary fixes then real rendering, actual A2 screenshots/metrics, and bounded area residency in the real browser.

## Reviewed replay extension and preparatory layout briefs — 2026-09-29

Owner again asks to continue all authorised visual enhancements, upgrades and additions. The recommended prototype package and one combined final update remain the plan. This is not acceptance of the still-open art, physical-phone, complete greybox or release checkpoints.

The larger distinct STACKED fixture is now gathered locally at `6b8cc89c` from reviewed source commit `55d9e269`. Its 643,624 canonical bytes preserve the actual 432,000-tick continuous recording. [S0b](slices/STACKED-S0B.md) retains all 21 first-use samples, 4/4 focused and 4/4 Git-free checks, independent source/receipt review and the 227.4107-ms maximum local complete verification. Lead rechecked all 19 test-copy source/data hashes after gathering. Syntax registration conflicts were resolved by retaining every S0, W0, R0 and S0b entry; the resolved file parses. No rules, simulator, codec, server or versions changed. Maximum accepted encoding, production CPU and phone/long-worker evidence remain open; S0 is not globally complete. Next is a bounded real recording with priority-preserving concurrent rotations, before any measured optimization.

The [ten area briefs](areas/INDEX.md) are now preserved as preparatory design intentions. They include landmarks, route links, spaces for objectives, cover/heights, secrets, palettes and the actual greybox acceptance focus. The world reviewer requested a reachable mansion interior secret on Silver Coast, explicit winding/dangerous Fortress approach measurement, and entrance/exit anticipation states for the Lockkeeper and Foreman; all are incorporated. These pages are not built geometry or a layout-check/playtest pass. W0 browser/device residency evidence and W1's actual checker precede W2. The owner must play the complete greybox before production area art. No new locks, rewards, water slowdown or darkness rules are introduced by these pages.

The first actual default-off Meadows target build measured 1,040,202 B initial HMH JavaScript and passed the twelve existing default-off visual scenes (maximum mean delta 0.019, cell delta 4, three changed cells, no captured browser errors). This isolated default-off baseline check is not art acceptance. Lead inspected original desktop and phone-proxy captures and rejected the candidate's flat rectangular ground, roof repair, abrupt edges and phone/HUD framing. The initial failure remains preserved; the art agent is revising terrain, roof and candidate-only framing under the heavy lock. No accepted baselines or production art were replaced. Its 32-MiB desktop / 8-MiB mobile decoded page estimate is not measured GPU/device residency.

R1 now has default-off lazy two-instance GLB/clip/controller/Pixi Mesh wiring on the character branch. Lead source review found a retired-ID registry leak and a prepare-only draw success assumption before hiding original sprites. RED replacement/abort cases and fixes remove retired IDs, abort pending owned requests, and perform a real same-context mesh/material preflight before hiding sprites. Actual browser draw/depth/fallback/parity and device-heavy-load evidence remain pending. The vendor-only export measurement adds 5,087 B (aggregate 1,044,404 B; 4,172 B headroom) before final game wiring and the art branch. A combined final build remains required; separate lane figures cannot certify the total budget.

W0b is approved as an opt-in terrain-only area lifetime slice on the existing six districts: actual lazy loading, shared ownership, cancellation/stale completion, successful tier identity, detach/static-bake invalidation before unload, and conservative pending/retiring reservations. Current prop pages remain pinned until actual area partitioning exists. This will prove the terrain subset, not complete 20,000 × 14,000 world streaming or phone acceptance; logical nav/spawn/rules remain unchanged.

Root opened `200-chikun-polish` / `codex/200-chikun-polish-20260929` from the gathered candidate, with the existing dependency junction. Source audit confirms coin collection currently adds a camera bump and white flash. A bounded default-off positive-pickup slice is being tested first: a small sparkle, coin-to-counter flight, capped rising chime, reduced-motion restraint and owned-node cleanup. No new art generation, obstacle/course rules, version or evidence change is planned in this slice. Browser capture, old replay and result identity remain required before committing it.

Only local isolated work was gathered. No integration branch merge, push, version change, full release gate, credits, secrets, contracts, transaction/settlement/jackpot edits, production deployment or physical phone acceptance occurred.

## Technical prototypes and Git-independent tests — 2026-09-29

The later **Combined opening gate and W1a** section below supersedes the recovery, terrain, art and pending-combined status in this historical checkpoint.

The owner again asked to continue. Only the isolated program candidate has changed; final combined release approval and the art/physical-phone/greybox checkpoints remain open.

**Chikun E0** is reviewed and gathered locally at `2712032b`, with receipt clarification `1593076b` (source lane `c8ee23ef` / `dd2e5163`). Default-off `?coinFeedback=positive-v1` gives a bounded gold coin-to-counter cue, capped rising pitch and counter pulse; reduced motion and mute use the real existing controls, and simultaneous hazard motion is preserved. No course/rules/RNG/evidence/version/server behavior changed. Focused50/50 passed, including13 frozen gameplay/evidence files and old replay verification. Four actual Chrome Free runs captured equal evidence/final state and passed the shared replay function; three cleanup/failure cases passed. Review strengthened delayed loading by explicitly awaiting the original module. A privately served copy with only the disposal guard removed fails the intended ready-versus-loading assertion; the normal candidate passes, with unchanged built entry bytes. See [slice and failures](slices/CHIKUN-E0.md). Phone-sized Chrome is a Windows proxy, not iPhone performance/native audibility or Ranked end-to-end proof.

**Cloud-test portability** is gathered at `03a1f4af` and corrected source-byte records at `18427944`. Four old test families lose real/optional Git probes while retaining meaningful packaged-asset or injected authoring-policy assertions. The strict checker now rejects wrong diff/merge attributes as well as filter/text; RED-first evidence is preserved. Actual source-free asset tests pass15/15 without .git, Git executable, node_modules or Blend sources. An exact existing revision-metadata unit passes1/1 without .git/Git on PATH, with its declared existing Ethers dependency. No actual key/RPC/transaction fixture ran. The full historical Level1 suite was not rerun; its two retired exceptions remain unchanged. The source scanner is a known-call heuristic, not exhaustive transitive enforcement. An initial receipt update used the wrong working directory and did not execute before the commit; the follow-up corrected and checked the record. See [scope and retained failures](slices/BUILD-CLOUD-PORTABILITY.md).

**STACKED S0c** is reviewed and gathered at `3428758c` (source `a920586e`). This third real uninterrupted432,000-tick recording has757,272 canonical bytes, SHA `9ae11c4d47455bf92aed1424e9cd730ece503cf3f1f5fa2e00a18f9affb95ca4`; priority-preserving concurrent controls genuinely differ from prior fixtures. All21 fresh phase samples pass; maximum complete local verification242.7848ms leaves only7.2152ms. Focused4/4 and no-Git/no-node_modules4/4 legality/checkpoint/old-verifier checks passed. Lead rechecked all19 gathered data/source byte bindings. This does not cover the maximum accepted encoding, cold import, production CPU, browser worker, hardware soak or local Ranked end-to-end. Global S0 remains open; other STACKED features wait. A separately reviewed real Hold producer is prepared for a later short prefix, not yet proven to survive or accepted as a maximum workload.

**R1 3D technical pilot** and its stronger proof are gathered at `4d350c81` / `f6c55156` (source `f000523e` / `fea9c9dd`). Default-off `?actor3dPilot=1` lazy-loads a real skinned Commando and one visible Bagholder in the existing Pixi context/depth layer. Focused40/40 passed; isolated initial+shared JS1,045,792B,2,784B headroom. Actual desktop/mobile-proxy tick240 captures match in164 directly inventoried data bindings, Map/Set/RNG/input and cloned summary bytes, with302 explicit callback/code/presentation/DOM omissions. Source/shipped/diagnostic hashes are retained. Actual GL loss/restoration restores original actors, removes pilot displays and resumes with no GL errors. **Guidance text visibly disappears after restoration**, so complete UI/graphics recovery fails and a separate native glyph RED is being prepared. This is a two-instance technical prototype, not polished art, full60-enemy performance, longer-run/closure/full Ranked certification or phone acceptance. Normal maps remain dormant without exported tangents.

**W0b terrain lifetime** has preliminary final-source89/89 focused,11/11 copied no-Git real-Pixi checks,2 actual Free input/disposal cases,2 real current-world renderer transitions/re-entry cases and1 held-PNG stale-completion case. Default visual12/12 passed with no errors and maximum mean delta.019. Five prop pages remain pinned; the terrain proof is a subset of the existing six-district world. The own-branch initial JS is1,040,912B, excluding gathered R1. Independent review is strengthening original TextureSource identity verification; an initial assumed null-source behavior was incorrect in installed Pixi8.19 and is retained as an invalid witness, not a reproduced runtime defect. No final gathered W0b acceptance is claimed while that valid RED/review is pending. GPU/peak/phone/30-minute memory and the actual20k world remain open.

**Art**: candidate04 remains below the target after original desktop/phone inspection. A2's frozen `e0f56143` preserves57/57 focused checks,12 paired component-state captures with explicitly substituted nav queries, default visual12/12 and failure/retry/disposal proofs; it is not gathered as accepted production art. Candidate A3 is rebaking tighter alpha crops, grouped grass, worn soil and legal candidate-only phone framing measured against actual HUD/control rectangles. All supplied originals remain unchanged and no credits were spent. The external Meadows source copy is hash-verified. The draft art bible/vertical slice still await a passing quality candidate and owner approval.

**Reference board** now passes53/53 source image decodes, interactive preview/filter counts, anchors and overflow at desktop and phone sizes. The earlier empty preview-template and output-path harness failures remain retained. This verifies the board artifact, not the game's art.

Combined runtime sources/data and required syntax registrations were rechecked after gathering:19 S0c file identities, R1 authority main-source identity and four exact Chikun runtime hashes match; Git-normalized QA source is labeled separately from measured CRLF bytes. The test-list cherry-pick conflict retained every lane's registration. A fresh combined build/gate remains pending after terrain/recovery integration; isolated lane numbers cannot certify the final initial-JS budget. Repository source-art migration and strict350MiB budget are still open; no original source has been removed. No integration branch merge/push, version bump, release gate, production deployment/promotion, credentials/contract/transaction/settlement/jackpot change or physical device acceptance occurred.


## Combined opening gate and W1a — 2026-09-29

Reviewed recovery `efaa201a` is gathered as `0eec1e5d`; reviewed W0b `78f692f3` is gathered as `18b219d1`. The one syntax-list conflict retained all lane registrations. Only root-owned W1a drafts were temporarily preserved in explicit-path stash `c00811d8d996b36f2e1783fcf949d4050fad8dd7`, then restored byte-for-byte; the recoverable stash remains. No foreign worktree changed.

The actual combined build measures **1,047,444 B** HMH initial entry+vendor+static shared code: **1,132 B headroom**, with STACKED **576,056 B**. Existing lane totals did not certify this candidate. New runtime features must remain lazy; a separately measured initial-bundle headroom slice is needed before further loading expansion. [Exact combined receipt](receipts/combined-opening-gate-20260929.json) binds fourteen source files, shipped entry/vendor/metafile and four unchanged world/navigation modules.

Combined **159/159** focused checks pass with no skips. Two actual terrain Free input/disposal cases, two current-world terrain lifetime components and one stale-PNG completion case pass. Four actual native/pilot graphics-loss cases with `areaStreaming=1` recover the mission glyphs: desktop873/873, mobile474/474,100% spatial overlap, unchanged captured state and no GL/page errors. The strict witness captures165 direct mutable/scalar bindings, including the new streaming switch, and declares305 code/DOM/presentation omissions. It does not cover nested closure state, complete Ranked replay, complete GPU terrain/sprite/UI recovery or performance. The isolated paused redraw still shows an enemy clipped at the origin; a resumed-frame witness remains required.

The first combined browser batch stopped on an unlinked existing Playwright dependency. Passed focused/build/terrain phases were reused only after unchanged runtime/checker hashes. The next actual page capture correctly rejected a Texture destroy callback. One new regression failed first; only the three independently reviewed terrain resource-ownership/cancellation bindings were explicitly omitted. The enable flag and arbitrary future terrain data remain captured. **7/7** diagnostic-boundary checks pass; six repeat prior focused cases, so counts are not additive. Both original failures and exact correction scope remain durable. No shipped runtime statement changed during this diagnostic repair.

Required `visual:reboot` passes **12/12 unchanged**, zero errors, maximum mean delta0.019, maximum cell delta4 and maximum changed cells3. The lead inspected original restored desktop/mobile captures. No baselines were accepted or replaced. Windows Chrome proxies are not physical iPhone XS Max acceptance.

**W1a** is the first gated offline greybox navigation helper: actual conservative engine cells,45–55% cell-centre walkable diagnostic, exact bounds and explicit outward/return reachability using directed edges. Seven initial missing-helper cases and two independent alias witnesses failed before fixes. **10/10 focused** and **10/10** in a seven-file copy without .git, Git on PATH or node_modules pass; exact reviewed source matches the combined159-case batch. The helper is absent from every game build input. [Slice](slices/WORLD-W1A.md) documents that this is not the complete W1 kit, actual ten-area map, player traversal, sightline/arena/spawn checks or verifier map-table approval.

**Next scopes:** S0d's independently reviewed genuine-Hold prefix survives10,800 accelerated simulation ticks, passes the public input decoder and records28,856 actual bytes; it is nonterminal and has no replay/verifier/headroom acceptance. One unchanged-producer full-length attempt is queued after the boss/art windows, preserving early death/timeout and actual bytes. R2a has captured six genuine failing tests and is preparing the existing opening-phase Liquidator model without changing the default two-actor runtime or loader budget. A3 `51605ac5` is frozen, clean and **below bar/unaccepted**: pale ground wash, isolated star grass, dark canopy microdetail, narrow phone framing and opaque ground house footprint remain. A4 corrects source materials using the same assets, with one bounded bake and fresh visual review still pending. Originals remain hash-verified and no credits are spent.

No integration merge/push, version bump, full release gate, production deployment/promotion or physical device acceptance occurred. Source-art migration and strict repository-size compliance remain open. Final art, real-phone performance, playable ten-area greybox and specific-release owner approvals remain required.


## C1 — cockpit startup budget and failed-download cleanup

On parent 957f0f26, the unchanged cockpit factory now joins the existing awaited loader. A failing download closes only the initialized renderer and early bridge and retains its original error. Lifecycle RED phases are retained; six final source-derived tests and independent adversarial review pass. No gameplay/verifier/version/cap change.

The owned serialized local gate passes 95 focused tests, repository syntax, fresh build, three actual delayed/failed-module cases, four existing cockpit viewports, four captured-state/evidence cases, four world-text recovery cases and all 12 standard visual scenes. Six new tests also pass in a source copy without .git/Git on PATH and only the declared Acorn parser. Full-resolution desktop/phone UI evidence inspected. Total initial JS is 1,039,992 B, 7,452 B lower, with 8,584 B headroom; static graph and pinned vendor counts reconcile. Eleven protected source hashes are unchanged during the gate.

[C1 scope/receipts](slices/COCKPIT-C1.md). Source/harness and independent final actual-receipt reviews pass: protected sources, emitted static graph/vendor, actual held chunk, screenshot framing and scoped correctness/visual results agree. Local candidate only: no integration merge/release/phone certification, and the 2.0 owner art, physical performance, greybox and specific promotion gates remain open. The S0d genuine-Hold attempt separately ended at 72,520 ticks; shorter-run decoder/replay/verifier acceptance does not satisfy the longest-duration gate. A4 native black-pixel repair separately passes its narrow technical checks but its actual art remains FAIL.


## Saved parallel checkpoints and source-art A0 — 2026-09-29

The adverse S0d short terminal fixture and single S0c CPU profile are gathered at
e1065b45. The genuine-Hold block-out at72,520ticks remains an unsuccessful
longest-duration attempt; the instrumented254.1ms profile is diagnostic, separate
from timing acceptance. No maximum-encoding or productionCPU/global S0 closure.

A0 b1921aad implements the explicit-root, canonical-path, SHA/byte-pinned Python
authoring input boundary. The initial missing-helper RED,17fixture GREEN and exact
two-file empty-PATH/no-.git/no-node_modules17-case proof are preserved. The normal
Node wrapper and independent source-copy run repeat those cases, so counts are
not additive. Source/path adversarial review passes the stated scope. Real Windows
junctions, mutation/deletion/replacement and failure-time identity are covered.
No actual archive/model is accessed by these checks; no pipeline migration,
native inspection, copy or original removal is claimed. Content checks are not a
secrets classifier or concurrent-writer/file-object lock. Repository-size
compliance remains open. See slices/SOURCE-ART-BOUNDARY.md.

The minimal STACKED transport copy is frozen at2d3ff182 and gathered at63ed8c78.
Actual112focused and6source-copy checks pass; all54source/test/fixture identities
are checked at gather before prior results are reused. Seven fresh samples per
phase/variant give complete verification gains39.7–44.7ms with maximum195.2793ms,
unchanged exact evidence/result and overlapping replay-control timing. Independent
source/saved-record reviews and root raw-record review accept the local benefit.
Only one indexed byte-copy changes; native canonical validation, caps, errors,
rules, RNG, versions and corpus remain unchanged. See slices/STACKED-S0E-COPY.md.

Actual Chrome native decoding and the real freshly built Worker return the exact
old tuple. Desktop and XSMax-sized414x896DPR3 Guest/Free boot, controls, native exit
and observed process cleanup pass. The first build witness guessed the wrong HMH
vendor name; the next browser witness flagged native song cancellation. Both
failures remain preserved. Final instrumentation forwards native media loading
unchanged, retains all raw failed requests, and separates only HTTP200-served
playlist ERR_ABORTED with observed native song change/owned closure. Complete
input/dependency/output custody remains unchanged across the reused build/browser.
Canvas containment and horizontal overflow pass; full-page phone screenshots do
not certify whole touch-control framing, physical FPS/audio or Ranked end-to-end.

The first gathered syntax pass exceeded a60s watchdog. Exact-tree shutdown returned
255 with one child unsupported; the owned marker was retained. Later read-only
checks confirmed all three recorded PIDs and their descendants absent, then released
only that marker. Original failure/receipt are immutable. A separately bounded
300s serial syntax window and fresh build follow; this is not replay timing or
release certification. The registration conflict retained the exact union,
including one pre-existing repeated mobile-performance entry. Failed one-time list
readers changed no source; a corrected Counter comparison proved the union. A
progress-note write initially failed on Windows default text encoding, after the
code was safely committed; this UTF-8 follow-up corrects the note.

Art A5 f4327da2 and boss R2b0365e00e remain isolated failed experiments. A5 removes
added foundation caps and narrows shadows, but repeated leaf plates, pale ground
and a ghosted roof fail the actual art bar. Existing authored tree55 is a closer
prototype input; no A6 bake, production art or palette approval occurred. R2b fails
the unchanged0.5mm body correspondence at12.67mm and lacks a costume tangent.
Saved-byte diagnosis narrows the issue to21reference points; actual source
topology/modifier inspection is prepared but not yet run. No pack retry, final
GREEN/build/browser or runtime admission is claimed. Automatic approval review
rejected the proposed Desktop failure-archive copy before execution; the exact
owner question remains pending and originals remain preserved.

Three helper agents stopped at the account limit after saving their work. Commits,
unfinished optimizer code, failed assets, evidence and plans were checked on disk;
none was discarded. Root continued the authorized checks and saved the completed
slices. No integration merge/push, version bump, full release gate, deployment,
promotion or physical device acceptance occurred. Art, physical performance,
playable ten-area greybox and specific-release owner checkpoints remain open.


### Final gathered proof and native diagnosis

The extended gathered gate passes: all1,229listed JavaScript syntax checks
(1,228distinct plus the preserved existing duplicate) and145Python checks in
97.645s, followed by one fresh build in2.237s. Initial JS is HMH1,039,992B with
8,584B headroom and STACKED576,100B with30,900B headroom. The initial60s timeout
and failed tree-stop remain separately preserved with later exactPID/descendant
closure confirmation. All54prior focused-test/source/fixture identities match
at gather;112focused and6source-copy results are reused, not falsely counted as
reruns. Protected gather sources remain unchanged. All50actual browser-served
built files and all118actual served resources match the gathered root byte-for-byte,
so the earlier Chrome compatibility proof applies without another browser run.
No full release gate or production/physical acceptance is implied. See receipts/
root-stacked-gather-passed.json and root-stacked-browser-resource-equivalence.json.

The separately bounded read-only native boss inspection completed in one window
and is frozen at isolatedb764425f. Recreated evaluated mesh matches the frozen
first-idle cloud point-for-point. Actual preserveVolume=false. The21outlier IDs
exactly equal all21vertices unused by both polygons and rendered loop triangles;
no visible surface is represented by those points. The coat has45n-gons, consistent
with the missing-tangent warning. Original source, elevenhelpers and failedasset
identities are unchanged. The original failure is retained; no corrected export
or new runtime/clip/fleet/art acceptance is claimed. Next: separately test a
rendered-triangle witness while retaining original all-point diagnostics, and
triangulate only the export copy without changing tolerance or surface/UV/weights.
That correction still needs independent review and a new bounded pack window.


## Two-day sprint and STACKED S0f boundary

The owner has accelerated the target to the next two days; TWO-DAY-SPRINT.md
supersedes the earlier schedule without removing scope, owner approvals or
physical-device requirements. All three existing agents resumed successfully.
Character is testing a rendered-triangle witness before another native attempt;
art is preparing explicit source-tree intake; world is authoring tested greybox
data and a labelled local navigation playtest. No native bake/export is claimed.

S0f establishes the canonical encoding bound1,296,028B using the actual codec.
Four scoped cases and the same four in an18-file emptyPATH/noGit/noModules copy
pass. Seven fresh decodes max31.2152ms. Seven initial rejection witness failures
remain preserved; only the expected existing terminal message was corrected,
and seven fresh rejection samples max48.272ms pass. All21unique children closed,
all source identities agree and markers released. Root and independent saved
reviews pass. This structural sentinel is not a surviving run; the genuine
longest-run195.2793ms proof remains separate. ProductionCPU, worst surviving
workload and globalS0 remain open. No runtime/build/browser changes in this slice.
See slices/STACKED-S0F-CODEC-BOUNDARY.md and its exact receipts.


## STACKED F1a — source-only living journey

An unmounted presentation director prepares the requested automatic eight-scene
deck, isolated cosmetic order, smooth tempo/forward flight and early portals.
Eleven behavior cases and the same eleven in an exact two-file emptyPATH/noGit/
noModules source copy pass; independent source-only review passes. Both test
children close normally and the marker is released. No runtime entry, rendering,
settings, simulation, verifier, versions or evidence changed, and no browser or
physical acceptance is claimed. Actual lazy integration/Matrix/portal aperture/
resource pools, combined game parity, final art/flash review and modes remain open.
See slices/STACKED-F1A-JOURNEY-SOURCE.md.


## STACKED F1b — actual optional journey preview

F1a is now mounted lazily behind the exact livingJourney=living-v1 boot query.
Automatic eight-scene cycling, projected forward flight, Matrix glyphs and
circular portal transitions run in actual Chrome. Constructor/download fallback,
closure and pool continuity are tested. Final23focused plus identical23in a
26-file emptyPATH/noGit/noModules copy pass;14scoped parses and49related tests
pass. The first real browser attempt lost its query during portal navigation;
that failure is preserved and the explicit boot-search fix passes four native
Free boots/controls/exits. The actual old432000tickWorker tuple remains exact.
All eight WebGL scenes use4178fixeddesktopnodes/384glyphs on a controlled cosmetic
clock, not a game run or phone performance test. Full-resolution desktop and
phone-size captures were inspected. Phone controls fit414x896. Fresh initialJS
is HMH1039992B/8584headroom andSTACKED577431B/29569headroom. Required visual:reboot
passes all12unchanged scenes/crops with baselines unchanged. Every actual child,
Chrome process and server closed; owned markers released. A first visual wrapper
rejected its deadline before launching and remains preserved. See slices/
STACKED-F1B-LAZY-JOURNEY.md and receipts/stacked-f1b-lazy-journey-passed.json.

This is an incremental default-off candidate, not final art acceptance. Matrix
contrast/space polish, real phone timing/60minsoak, versus/daily/tutorial and the
full release gate stay open. No version bump or deployment occurred.

## Parallel sprint checkpoints

Owner requests the full model/rig/action set, three texture tiers and world/
mission/interactivity scope; this remains the active target. Owner will play
on the XS Max when the combined candidate is production-ready. No physical
device proof is claimed or inferred from Windows viewport checks.

World W1b isolated source/layout passes18cases and the identical18clean-copy
cases; actual diagnostic finds zero issues,48.0326percentwalkable,98sites
reachable/returnable and14roads. A staged-only local playable ten-area greybox
with approved human atlas, native movement and separate Area plan is being
prepared for actual browser review; neither official simulation nor verifier
map v2 is mounted. Area art/owner playtest remain open.

A6 reused tree55 native preview passes one19.038stwo-threadwindow; native source
identities unchanged. The next selective tree pack reuses hash-pinned A5ground/
house to avoid another full bake. It has not yet passed in-game art acceptance.
A5visual quality rejection remains preserved.

Character R2b failed the original tessellation guard; the CPU-only exact-copy
diagnosis proved retessellation and exposed cleared named skin groups. The
minimal ordered-group restoration passed19Python cases; one corrective native
window now succeeds at groups/topology but fails the original normal tolerance.
Original sources and all failed receipts/arrays are preserved; no corrected
GLB, complete animation fleet, three texture tiers or phone3Dgate is claimed.
Read-only shading-error measurement is next. The separate failed-asset Desktop
archive copy remains unexecuted after automatic approval review rejected it.


## Rewards, site and blog scope added

The owner explicitly added the companion achievements/unlockables/site/blog guide
to the same combined2.0 release. The attached guide was read in full. The bounded
workstream inventory is ACHIEVEMENTS-UNLOCKABLES-SITE-BLOG-PLAN.md. No new feature,
migration, earning rule, publication, minting, contract action or deployment is
claimed by this update. The original attachment path is no longer present for
a raw filesystem copy; no exact archived-byte identity is claimed.

Actual pure-catalog audit confirms124available achievements(44HMH/40Chikun/
40STACKED),57HMH total rows and13existingNFT candidates. The actual unlockable
catalog has27entries: two retained character unlocks and25cosmetics(8/10/7),
not the guide's22. Retirement uses exact IDs and retains earned achievement
history. Open reward package choices are pending the owner's answer; safe UI/
art/API design and source audits can proceed. Blog drafts remain in the owner's
combined-release scope instead of interpreting the guide's early-publication
recommendation as authorization. The additional substantial scope stays open.

## Chikun E1 native correction checkpoint

The first8frame eagle render failed exact restoration, with source unchanged.
A read-only native diagnostic proves matrix round-trips perturb15feather native
channels and matrices by up to1.49e-7; direct restoration of original native
properties yields zero difference. Four real-helper cases and two actual finally-
body failure-custody regressions pass; primary and cleanup errors stay distinct.
Actual portal boot-query/draw integration adds3passing behavior fixtures.

The independently reviewed corrected8frame render completes in21.2033s, restores
mesh/matrix-inclusive identity exactly(6c7f2ea3...), retains original source
SHA375640a1..., and closes its owned native child/marker. Previous failure and
corrected proposal/receipts are preserved separately. No source model was saved.
This simple existing bird remains placeholder art below the final target; actual
three-tier packing/game replay checks and production art admission remain open.
