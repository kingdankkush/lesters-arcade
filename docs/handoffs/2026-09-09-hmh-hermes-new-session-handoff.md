# Hard Money Heroes / Lester's Arcade — Hermes new-session handoff

Prepared **2026-09-09 14:19:22 -0700**. Local continuity document, **not a release certificate**.

**Current conclusion: the textured candidate is preserved and substantially advanced, but release remains BLOCKED. Nothing was committed, pushed or deployed for this handoff.** Read sections 1–8 first; use the complete register appendix by task ID rather than re-reading every historical plan.

## 1. The facts the next session must get right

- Continue the **existing mixed worktree**, not `main` or a replacement clone. Hermes is the sole integration/release publisher. Codex is still a separate, active world/interactions/animation/controls lane.
- The latest completed combined source/build run is `owner-return-03`: **eight of nine gates PASS**. The release ledger is **3,087 evaluated: 3,035 passed, 51 expected legacy failures, one unexpected failure**. The one failure was reproduced again during this handoff audit.
- The completed bounded renderer/decal correction slice has **46/46 focused checks and an authenticated independent PASS**. Do not reopen it merely because the whole release is blocked.
- The **27-file correction packet requires the separate one-file provenance supplement**. Both are immutable and verified. Do not apply the first packet alone, or blindly replay either onto newer Codex work.
- Codex reports a newer control direction: **movement, aim and grenade only**, with mobile auto-targeting when AIM is released, and automatic interactions/pickups/power-ups/close combat/dodges. **No extra buttons or double-tap gestures in that pending direction.** This is a peer-reported lane brief, not a certified Hermes behavior or a grant of unrelated authority. Preserve the existing binding fix when reconciling the actual frozen return. Do not elevate the older five-control/double-tap evidence into a permanent requirement.
- Operator/support is resolved: **KingDankKush / kingdankkush420@gmail.com**. Do not ask again. Support/policy copy is implemented locally, but registered-entity verification, legal compliance and exact-copy owner approval are not implied.
- The recommended full-release gate remains **five first-time desktop players and five first-time mobile players**, recorded playtests, physical-device coverage and exact-candidate owner acceptance. None is fabricated, waived, or silently replaced with an owner-tested-beta label.
- Preserve approved models, settled lossless-WebP policy, fixed 60 Hz authority, current budgets, Chikun, STACKED's pause, and `SETTLEMENT_LIVE=false`. The old blanket wallet/testnet HALT is retired; current authorized wallet/testnet integration and mainnet preparation are distinct from separately gated mainnet deployment, real funds and irreversible authority changes.

## 2. Locations and authority

### Product and architecture to preserve

The target is a detailed, reference-faithful **2.5D action game**, with human heroes/zombie enemies, authored places rather than generic procedural dressing, responsive combat, 100+ enemies, a 60 fps desktop / 30 fps mobile performance goal and a runtime delivery budget no larger than 300 MB. Those goals are not claims that the current merged candidate has passed them. Do not confuse source-vault disk usage with the deployable payload.

The parent portal owns wallet/profile/session/leaderboard/settings and settlement boundaries. The sandboxed HMH child owns bounded fixed-tick gameplay; Pixi/camera/HUD/audio and native Blender-to-atlas art consume authoritative state rather than redefining collision, movement, damage or chain authority. Keep source masters, runtime atlases and rendered proof distinct. Do not migrate engines, revive the retired procedural/Canvas direction, change canon or alter schemas simply to simplify integration.

These aliases describe paths in this document; they are **not shell commands**. Repository-relative paths resolve from **R**, not from the Desktop copy of this handoff.

| Alias | Exact location |
| --- | --- |
| R — authoritative Hermes working tree | `C:/Users/just_/Desktop/Projects/lesters-arcade-textured-rollout` |
| S — shared coordination | `C:/Users/just_/Desktop/Projects/LestersArcade-Coordination/hmh-textured-rollout` |
| C — Codex working copy | `C:/Users/just_/Documents/Codex/2026-09-08/anal/work/lesters-arcade-release-codex` |
| F — original Codex frozen return | `C:/Users/just_/Documents/Codex/2026-09-08/anal/outputs/hermes-world-integration-handoff` |
| O — this handoff's audit evidence, relative to R | `.tmp/team/session-handoff-20260909T202744Z` |

### Entry reading order

1. This handoff and **the current** `AGENTS.md`, following its rollout-first order.
2. `docs/handoffs/hmh-textured-rollout-progress.md`, beginning at the latest section, then `docs/qa/hmh-owner-return-checkpoint.json` and `DECISIONS.md`.
3. S: `HANDOFF.md`, `ownership.json`, `status/hermes.json`, `status/codex.json`, and new/changed messages. Use the checkpoint reader before edits, integration, generation, testing and release work.
4. The selected task from this handoff's appendix and `docs/hmh-reboot/OPEN-WORK-CURRENT-STATUS.json`; then only the source/acceptance documents needed for that slice.

The September 7 register remains valuable for **intent**, not current implementation, live deployment identity, unresolved owner questions or execution permission. Its old instruction to read nothing else and its old re-prompt must not override the current entry point. Earlier sections of the progress document are explicitly historical.

`AGENTS.md` already has the rollout-first read order. Do not revive the earlier protected replacement request or use another tool to retry a denied edit. The current request was documentation-only, not another hero repair pass or a deployment authorization.

## 3. Repository preservation and public baseline

| Fact | Observed value |
| --- | --- |
| Entry snapshot time (UTC) | 2026-09-09T20:27:44.062220+00:00 |
| Hermes branch | `hermes/hmh-textured-rollout` |
| Hermes HEAD | `9ce7372021a1b14a5b6910bcd0fa1d7d328d8bef` |
| Configured upstream | None (none configured) |
| Entry Git status | 231 entries; mixed staged/unstaged/untracked |
| Staged-path entries | 45 |
| Unstaged-path entries | 119 |
| Untracked-path entries | 84 |
| Stage mode/blob/path digest | `6ed1c062f130edc3e9f7b8177d5029c833f3f203a07dd90e9a4d680311508f5a` |
| File-flag digest | `4f751942c7c6c41b8ed86192fdde416ccbdf9e3f8f577b4bae928b99d24d2db8` |
| Raw index digest at entry | `d1ab0920df5ff71d1cc8e1b3a61fad0d02539365783f6214525e4d96c7a46cbc` |
| Remote main, read-only observation | `a17c37cd6cb39f74758bb4e9ae0bb56d2a1e07bb` |
| Remote reboot/hmh-aaa-continuous | `cd39b56738a8f44c428e1ae4659ae24b5323c77b` |
| Remote rollout branch | No refs/heads/hermes/hmh-textured-rollout returned by the targeted successful ls-remote |
| Codex branch / HEAD | `codex/hmh-release-integration` / `9ce7372021a1b14a5b6910bcd0fa1d7d328d8bef` |
| Codex dirty observation | 224 status lines; mutable, not certified |

Staged and unstaged counts overlap on `MM` paths; do not add them as distinct files. See O: `entry.json` and `git-remote-and-peer.json`.

The entry snapshot contains hashes/presence for **2,967 candidate paths, of which 2,964 were present**. It is an inventory, **not a complete backup or a certified Git tree**. The three already-absent indexed files were legacy PNG pilots; their absence was preserved, not caused by this handoff:

- `apps/portal/assets/generated/hmh-reboot-production-heroes/lester-original/lester-original-production-pilot-atlas.png`
- `apps/portal/assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.png`
- `apps/portal/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.png`

Do not restore these automatically from old instructions or delete other material for a cosmetic clean status. Preserve the original staged intent, unstaged work, untracked assets, LFS material and both worktrees. Never reset, clone over, switch away from, blindly stash, or run broad cleanup against the mixed candidate. A later clean tree should result from deliberate reconciliation and reviewed commits, not discarded work.

**Existing staged-index hygiene, preserved:** `git diff --cached --check` returned exit **2**, with **105 trailing-whitespace warnings** across `apps/hmh-reboot/assets/source/blender/lit-commando-gameplay-reproducibility.json` and `apps/hmh-reboot/assets/source/blender/lit-commando-packed-source-inspection.json`. The staged mode/blob/path digest still matches entry, so these are pre-existing staged issues, not documentation changes. Do not claim the staged patch is whitespace-clean. Address them deliberately at an authorized source freeze with provenance/evidence revalidation, not by discarding staged work or changing global Git policy to silence the check. Evidence: `O/staged-whitespace.json` and `O/staged-whitespace.log`. This is separate from the one unexpected **release-test** failure.

Codex's clone uses shared Git objects from the source repository. **Keep R available.** Do not delete either working copy or their unique output/evidence directories.

### What is actually public

Read-only samples at **2026-09-09T20:48:04.629997+00:00** matched the earlier September 9 samples:

| URL | HTTP | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `https://lestersarcade.io/` | 200 | 23,776 | `4627d92c7e75c945e78d53bafd2ede2639192d08673b3db7b0e9f61d4f7d8120` |
| `https://lestersarcade.io/dist/hmh-reboot/game.js` | 200 | 467,128 | `838e141a04055ccb43eb8a93c874a83474a799e22b650703a827c87ed06602a2` |

The repository production-marker check also passed: **lesters-arcade-v32-hmh-gameplan-defects**. Evidence: O: `production-sample.json` and `production-marker.log`. Local candidate game SHA-256: `adf75a0f5f0eab7123d23a322eb07d3c340e8d3af3689e9ab630416de22cd332`.

The public byte sample is **not** the local textured candidate. A cache-marker match or two HTTP samples is not full hosted gameplay certification. Current provider deployment/alias/rollback mapping and release authentication were **not re-certified** in this documentation task.

Historical provider anchors recorded in the progress document, to re-query before any promotion:

- recorded runtime implementation boundary: `54fd18dc6016a87d616d8238b59f4b1a4c914028`;
- recorded production deployment: `dpl_DBodNtqBWjYzT87FcwgTLCRJy3xs`;
- recorded rollback deployment: `dpl_HskTDVZr72FVDUD7zHnZTHRCtmCx`.

These are **historical identifiers**, not fresh confirmation of current Vercel aliases. Local HEAD, remote `main`, runtime source, Preview ID, production ID and rollback ID are separate identities.

## 4. Codex integration: do not lose either side

### Ownership and current uncertainty

Hermes owns integration, shared-runtime acceptance, source freeze and website publication. Codex owns its isolated follow-on world/interaction/animation/control work; its file claims and current resource window must be refreshed at checkpoints. A delivery does not transfer release ownership.

The shared Codex status still carries older sparse-clone limitations, old hashes and an old released resource window alongside newer handoff fields. It is not a reliable standalone description of the current mutable copy. The audit verified C's branch/HEAD and observed a dirty copy, but did not certify or copy its newer source.

Read these messages in particular:

- S: `messages/codex-20260909-simple-controls.md` — mutable peer brief; contains the three-control direction and removal of the interaction stand-still requirement.
- S: `messages/codex-20260909T171019Z-world-upgrade-start.md` and `messages/codex-20260909T172708Z-world-upgrade-progress.md`.
- S: `messages/hermes-20260909T191948Z-reservoir-route-clearance.md`.
- S: `messages/hermes-20260909T201222Z-corrections-verdict-and-required-supplement.md`.

The controls change is not merely a help-label edit. Automatic close combat, dodges, gates and pickups can cross simulation authority, reset behavior, causality, interaction eligibility and deterministic replay. Require corresponding behavioral evidence. If a peer-reported owner instruction conflicts with a newer direct owner instruction, resolve that conflict rather than treating the file as new authority.

### Immutable submissions and dependencies

| Direction/status | Frozen directory | Changed source files | Rule |
| --- | --- | --- | --- |
| Codex → Hermes, already locally integrated | S: `submissions/codex/world-native-integration-return-20260909T161928Z` / F | 32 | Captured mixed baseline; no replay of old cumulative patch |
| Hermes prerequisite | S: `submissions/hermes/controls-binding-20260909T145836Z` | 4 | Preserve before-image and corrected source; 16 included artifacts is not the source count |
| Hermes prerequisite | S: `submissions/hermes/portal-provenance-20260909T153312Z` | 8 | Preserve before-image and corrected source; 30 included artifacts is not the source count |
| Hermes prerequisite | S: `submissions/hermes/leaderboard-source-order-20260909T163327Z` | 4 | Use `submission-manifest.json`; source-order depends on portal provenance |
| Hermes correction | S: `submissions/hermes/owner-return-corrections-20260909T195423Z` | 27 | Use both; reconcile divergent targets; immutable original bytes |
| Required additive dependency | S: `submissions/hermes/owner-return-provenance-supplement-20260909T201222Z` | 1 | Use both; reconcile divergent targets; immutable original bytes |

The first world return is a **delta against the captured mixed Hermes working copy**, not clean HEAD. Its September 9 14:24:15 UTC baseline and original index preservation are recorded in F's `evidence/current-candidate-copy.json`. It was already integrated locally; do not reapply the old cumulative world patch to force alignment.

Required correction hashes:

- `owner-return-corrections-20260909T195423Z/CORRECTIONS.zip`: `28b959e090f1998d7af6fbe69e3284ae7a749f8e3b3dc104379f566ffc3635f3`.
- Its `FILE-MANIFEST.json`: `c69c35673e3559f3d509cd5191965a40ce2dd71bad55f25097e703c22d04a72c`.
- `owner-return-provenance-supplement-20260909T201222Z/SUPPLEMENT.zip`: `be6c6a1b4d4a764edbd922851a30aa4f5172d867dc6bd7a2c0bea71a77bdd604`.
- Its `FILE-MANIFEST.json`: `ca9e647b835e3308ec13332a6531f212680705f3c5dfb110671130db695fa46e`.
- Original F `WORLD-INTEGRATION-DELTA.zip`: `1ce99e82285ec8e625904323289f1002dfc25dc3cfc224eca498e2904b14d6e7`.
- Original F `FILE-MANIFEST.json`: `fbcda25b10402bd858b166ae67dd98debb7af2b61e0483dba9b1af2c48b135ed`.

The supplement supplies `docs/hmh-reboot/world-design/NATIVE-WORLD-PROVENANCE.json`, consumed by the corrected native-world QA. The original 27-file packet omitted it. The supplement binds to the original correction manifest; the original packet was not silently rewritten.

The older prerequisite packets use **`submission-manifest.json`**, with `changedPaths` for source deltas and `files` for all included source/before-image/evidence artifacts. The later corrections use **`FILE-MANIFEST.json`**. Do not confuse an artifact count with a changed-source count or assume the same schema everywhere.

### Safe reconciliation procedure

1. Read fresh ownership/status/messages. Request or locate a frozen incremental Codex delivery with exact base, before/after hashes, changed paths, test exits, generated-art dependencies and unresolved findings. Do not import its mutable worktree wholesale.
2. Capture the current Hermes index entries/flags and affected bytes. Compare the new delivery's base against the **actual dirty baseline** it claims, not merely the matching HEAD string.
3. Classify each target: matches `beforeSha256` → scoped candidate for application; matches `afterSha256` → already present; any other value → three-way/manual reconciliation. A null before hash only permits an explicitly new, collision-free addition. Missing before-images require manual merge, not overwrite permission.
4. Preserve the controls binding fix, parent hydration/provenance and leaderboard ordering/cache work. The source-order packet explicitly depends on the portal-provenance packet.
5. Retain the locally accepted lifecycle/fallback/corpse/decal protections. Use the required provenance supplement, but do not overwrite genuinely newer model/render evidence to silence QA.
6. Reconcile shared hotspots: `main.mjs`, action/input/touch/cockpit code, `level-one-world.mjs`, authored placements, build factoring and inventory registration. Do not stack two alternative bundle-factoring schemes without measuring their combined import closure.
7. Regenerate world-derived decals, placements and inventory from the **final merged topology**. World geometry, collider/spawn data, native pivots/contact edges and baked art must agree.
8. Run the focused integration/clearance/authority checks, independent bounded review, the full source/build sequence and actual gameplay acceptance. Keep original failed attempts intact; issue a new named receipt for the merged candidate.

## 5. Verification: current facts versus historical passes

### Latest combined source/build run

`owner-return-03` ran September 9 from 19:54:25 to 19:57:31 UTC. Its receipt and all nine log hashes were re-authenticated during this handoff. The full sequence was **not rerun** for documentation.

| Gate | Logical command (pinned runner) | Result | Exit |
| --- | --- | --- | --- |
| inventory | `node scripts/build-hmh-curated-level-kit-runtime.mjs` | PASS | 0 |
| asset-qa | `node scripts/hmh-reboot-production-asset-qa.mjs` | PASS | 0 |
| check | `npm run check` | PASS | 0 |
| release | `npm run test:release` | FAIL / BLOCKED | 1 |
| security | `npm run design:security-audit` | PASS | 0 |
| contracts | `npm run contracts:check` | PASS | 0 |
| health | `npm run repo:health:strict` | PASS | 0 |
| docs-links | `npm run docs:links` | PASS | 0 |
| build | `npm run build` | PASS | 0 |

Release report: `docs/testing/hmh-reboot-test-retirement-gate.json`. Expected-failure identities: `docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json`. There are **51 listed expected failures**. Do not add the clearance failure to retirement, weaken thresholds, or change counts to manufacture green.

### Exact remaining source-release failure

```text
unexpected failure: tests/hmh-reboot-enclosures.test.mjs :: W-10 every piece clears blockers, routes, water, arenas, camps, pickups and the town kit
```

The handoff audit ran that one existing test again: **exit 1, one failed test, zero skipped**. The assertion starts at line 187 and fails at the final offenders assertion at line 214 in the current test file. Its route-clearance minimum is **24 world units**.

| Piece ID (exact) | Reported route clearance |
| --- | --- |
| `yard:crossing-fuel:00` | 7 |
| `yard:crossing-fuel:04` | -53 |
| `yard:crossing-fuel:05` | -68 |
| `yard:crossing-fuel:06` | -61 |
| `yard:crossing-fuel:07` | -46 |
| `yard:crossing-fuel:08` | -21 |
| `yard:crossing-fuel:10` | 9 |
| `yard:crossing-fuel:11` | 11 |
| `yard:crossing-fuel:12` | -25 |

These are the test's reported clearances; positive values below 24 still violate the margin. Its wording says “inside a route” for those cases too; do not silently change the captured error values. The result proves a **projection-only enclosure placement acceptance failure**, not by itself that movement collision is physically blocked. Coordinate the route/lot correction with Codex and retain the meaningful clearance guard.

Evidence: O: `clearance-recheck.log`; original combined failure: `.tmp/team/revamp-resume/source-gates-owner-return-03/release.log`.

### Current emitted startup budget

| Metric | Measured bytes | Unchanged cap | Remaining bytes |
| --- | --- | --- | --- |
| HMH entry | 447,021 | 480,000 | 32,979 |
| Complete initial static closure | 1,027,600 | 1,048,576 | 20,976 |

This is the full **six-file static initial JavaScript closure**, including shared chunks and Pixi, not just entry plus a conveniently named vendor file. Dynamic imports are excluded by the documented metric. The current six emitted artifacts were rehashed. Any merged controls/world/build change requires a fresh measurement.

### Completed local slices that should not be rebuilt blindly

| Area | Verified prior result | What remains |
| --- | --- | --- |
| Approved four-hero source and gameplay derivatives | Four 648-frame heroes; 2,592 frames. Exact lossless WebP, 4,194,304 bytes per hero / 16,777,216 aggregate, max 2048 atlas dimension. Prior atlas total 15,796,588 bytes. Commando/Valkyrie raster derivatives 256 px, Lilly 216 px, Lester 224 px. | Do not remodel or reopen H-0. Verify remaining rig/weights/socket and every-action acceptance from actual existing source, plus current combined runtime/device proof. |
| Camera, body/HUD clearance and native pickup framing | Camera 69/69, bounded review PASS; prior all-hero full-HUD profiles and repeated visible native-pickup checks. | New topology/controls/labels can invalidate framing. Keep HUD and initial hints visible; do not shrink heroes or use canvas-only evidence. |
| Original touch melee and binding ownership | Touch 89/89 plus actual CDP touch 8/8; later binding/help 120/120, review PASS, **five** new binding regressions. | Historical input scheme is being superseded in Codex's pending lane. Preserve ownership/cancellation/first-tick semantics, not obsolete button requirements. |
| Canonical sprite IDs and native assets | `placement.assetId` identity preserved; mapper slice 39/39. Original native pack: 56 A/B pairs from 112 fresh Blender processes, 60 adopted files, two pages totaling 1,400,906 bytes. | Do not confuse native render provenance with gameplay asset IDs, or source/model counts with runtime frame counts. Recertify changed placements and actual on-screen collection. |
| Native world return | The original 32-file packet was authenticated and integrated; prior native-world evidence covers 30 render pairs, 17 selected models and 34 runtime atlas frames. | Current combined world is not accepted. Clearance, ongoing Codex work, navigation/occlusion/contact edges and whole-game/device evidence remain. |
| Bagholder | Locally adopted after genuine native A/B and runtime/hit/visual acceptance. | Old “private-only/unadopted” prose is obsolete. Other enemy roles, tell timing and boss phases are not thereby complete. |
| Normal Free path | Prior homepage-to-Free checks: 10/10, two starting heroes across five profiles, without pregrants. | Re-run current canonical flow after merge; prove earned unlocks, restart, terminal summaries, touch/gamepad and human/device use separately. |
| Parent provenance | 45/45 focused, review PASS, source gates passed on that earlier candidate. Reject invalid/unverified/wrong-network records and preserve real registry-session versus full transaction identity. | Source/cache validation is not cryptographic proof or deployed ABI compatibility. Preserve parent authority. |
| Leaderboard ordering/cache | 51/51 focused, review PASS, earlier source gates passed. Select official/local/house source before wallet-best/rank/top-N; include requesting-player/view inputs in cache identity. | Current combined browser/ranking/profile and real chain-backed publication remain unverified. |
| Renderer/decal/corpse corrections | 46/46; real Pixi attachment/cleanup/failure paths, depth-sorted fallback, polygon-water handling, validation and corpse lifecycle. Authenticated final review PASS, no blockers or suggestions, zero command/tool events. | Bounded slice only; not whole-game certification. Earlier blocked reviews and rejected masking proposals stay historical. |
| Support/policy surface | `trust.html`, `trust.css`, portal footer links; 4 tests and Chrome 1440×900 / 390×844 passed, including keyboard/no-page-error checks. | Not physical-mobile, gameplay, legal-compliance or exact-copy owner certification. |
| Audio | Prior audit measured 27 actual audio files; source synthesis/licensing direction is recorded. | Current mix/LUFS, semantic coverage, clipping/voice budget, device autoplay/resume/mute/reduced-sensory and listening acceptance remain open. |
| Contracts and readiness preparation | Stored Forge output: 17/17, no skips. JavaScript contract checks 8/8 reported in the prior checkpoint. Stored configured Slither log: 18 contracts / 63 detectors, zero findings. Split/custody preparation exists. | Not deployed compatibility, cryptographic end-to-end trust, a live GameRegistry approval probe or permission to move funds. |
| Endurance/portability | Prior short/five-minute pressure, camera smoke and clean-host results exist. Controller repair had 14/14 CPU regressions. | They bind older candidates. A repaired controller does not retroactively pass its failed outer run. Current merged clean-host, performance and long-soak gates remain open. |

Relevant checkpoint and artifact paths are indexed in section 10. Local implementation, automated evidence, source review, human acceptance and public certification are separate states.

### Delayed background notices already accounted for

| Process | Actual result | Disposition |
| --- | --- | --- |
| `proc_4b0689e8ed09` | exit 0; source-order review PASS | Reconciled against its stored result, not new work. |
| `proc_7b9b5bf44110` | exit 1; initial integrated world gate run | Original failed attempt retained; its twelve unexpected failures are not the current failure count. |
| `proc_bfea7c67c73d` | exit 0; source-order source/build gates | Reconciled against the matching earlier candidate receipt. |

The original notification header said two processes but contained three. All three were accounted for. `bash: no job control in this shell` does not erase the world gate's exit 1. Later notices must be matched to named attempts/hashes before triggering any rerun.

## 6. Prioritized remaining work and acceptance

The appendix preserves **all 99 unique namespaced entries**: 72 `REGISTER`, 5 `WEB3`, 22 `STACKED`. These are not 99 new defects. Stored statuses are historical; this handoff overlays later evidence without rewriting their source ledger. `REGISTER:B-1` and `WEB3:B-1` are different tasks.

| Priority / dependency | Next bounded outcome | Acceptance before calling it closed |
| --- | --- | --- |
| P0: coordination and freezeable return | Reconcile Codex's incremental world/interaction/animation/three-control candidate and all Hermes prerequisites. | Immutable base/before/after/evidence, no lost fixes, no uncontrolled overlap, original staged intent preserved. |
| P0: remaining clearance | Resolve the nine fuel-yard clearance defects in the paired route/lot lane. | Existing clearance contract passes; legitimate topology fixtures and regenerated art agree; no lowered margin/retirement escape. |
| P0: ambient combat authority, `REGISTER:G-7` | Reconcile withheld Cycle 079 work against the current boundary. Automatic defeat-spread must not burn neutral actors before damage filtering; auto refresh must not downgrade manual burn causality. | Focused RED/GREEN on actual runtime paths and same-seed/60–30–20 partition replay. Do not copy old cache markers or reapply the shipped corpse patch. Coordinate `main.mjs` overlap with Codex. |
| P1: canonical player experience | First launch, truthful onboarding/control help, automatic action eligibility, pause/settings/rebind ownership, cancel/blur/reset, death/summary/replay and earned unlocks. | Real input, current child readiness, no pregrant-only claims, no stale help or hidden controls; mobile/tablet/desktop containment and operator review. |
| P1: world and art | Native grounding/contact edges, fallback loading, bridges/ramps/rails, river/reservoir shores, spawn/camp pairing, routes, collision/nav, roof/foreground occlusion, visible pickups and deterministic secrets. | Current final world + current bakes + full-HUD traversal/combat evidence; intended route and off-route refusal; no renderer-owned movement authority. |
| P1: hero/enemy/weapon completeness | Inspect the existing approved rig/action/socket provenance and remaining clip/role/phase/in-hand gaps, not another model restart. | All required directions/actions at gameplay zoom, actual held weapons, tells-to-hit timing, readable boss phases, reproducibility and decoded-pixel/source checks within unchanged caps. |
| P1: balance and movement | Current movement report and canonical swarm/weapon/upgrade/boss metrics; then only evidence-backed tuning. | Same-seed clear-time, TTK, overkill, projectile/effect pressure and 60/30/20 invariance. G-1 gates balance claims; rerun affected benchmarks after simulation changes. |
| P1: audio/accessibility | Finish the actual cue/mix/listening/device acceptance rather than equating file presence with audio quality. | Proven source/license, measured category loudness and voice caps, no clipping/blocked resume, meaningful cues and reduced-motion/flash behavior. |
| P1: parent portal/data/trust | Preserve hydration/source ordering; finish selected profile/history/achievement/funnel and policy/cabinet visibility work from actual canonical data. | No fabricated unlock dates or official records; bounded parent-owned data, truthful labels, accessible flows, exact-copy approval where required. |
| P1: current candidate performance/portability | Serial profiles, clean no-Git/LFS-pointer build, active-combat pressure and long desktop/mobile soaks. | Hash-bound complete receipts, no timeout-as-PASS, current bytes and runtime identity, intended physical devices. Emulated viewport results remain labeled as emulation. |
| P1: human acceptance | Prepare and run five first-time desktop and five first-time mobile recorded sessions, physical-device coverage and owner exact-candidate review. | Actual participants/results/issues/consent-aware evidence. Automated agents cannot fabricate human completion. |
| Before website publication | Finish required release-facing work or obtain explicit scope deferrals; stage one coherent candidate, independent exact review, immutable Preview and rollback verification. | All required gates and owner acceptance match that exact source/build. Promote only that approved website candidate; verify public bytes and browser flows after promotion. |
| Later/dependency-gated | Capture/fact sheet/challenge-seed work remains tracked; Level 2 follows Level 1 acceptance. STACKED stays paused. | Do not silently drop open launch requirements or market future items as shipped. Do not expand Level 2/STACKED to avoid unresolved Level 1 gates. |

While Codex's mutable lane is unavailable for integration, use non-overlapping, already-authorized readiness work: source/authority audits, acceptance fixtures, portal-only items with clear ownership, playtest preparation and source-backed Web3 preparation. Do not repeatedly rerun known old gates or rewrite Codex's geometry in parallel.

## 7. Web3: accurate scope, not blanket HALT or false readiness

Current standing scope permits authorized wallet/testnet integration and mainnet preparation. **Mainnet deployment, real funds, settlement activation and irreversible authority changes require their own explicit approval.** This documentation task performed no broadcast, signing, wallet setup, authority change or settlement operation.

The September 9 read-only checkpoint is `docs/qa/hmh-testnet-readback-checkpoint.json`:

- chain ID recorded as `0x1159`, pinned block `0x2eaf4ac`;
- eight legacy deployment addresses had bytecode, including a separately retained qualifying retry;
- `totalSessions` and empty-wallet `getProfile` decoded;
- the current `getRecentSessions` ABI failed on a nonempty deployed response with **`BAD_DATA` / could not decode result data**;
- HTTP 502 and a later WebSocket-open failure are preserved; source tests do not resolve those network/ABI blockers;
- no hardened predicted-address manifest/dry-run or real-wallet end-to-end certification is established by that bytecode readback;
- `SETTLEMENT_LIVE=false` remains the baseline.

Do not treat localStorage provenance checks as cryptographic trust. Official records need correctly verified, decoded, network-bound provenance and full transaction identity. Registry session IDs are not interchangeable with transaction hashes. Parent wallet/profile/session/settlement ownership remains intact; the child never gains signing or settlement authority.

The source register's `WEB3:B-1` through `WEB3:B-5` are generic placeholders, not fully titled independent contracts. The September 7 guide names the preparation obligations collectively: contract checks, live GameRegistry cabinet-approval gating, SplitConfig proposal, verifier key-management runbook, and a testnet dry-run that stops before broadcast. **Do not guess a one-to-one ID mapping or revive the guide's obsolete blanket HALT wording.** Retrieve the exact selected requirement before implementing it.

Prepared documents to read rather than regenerate:

- `docs/hmh-reboot/WEB3-SPLIT-PROPOSAL.md` and its JSON;
- `docs/hmh-reboot/VERIFIER-CUSTODY-ROTATION-RUNBOOK.md`;
- `docs/hmh-reboot/MAINNET-READINESS-ROADMAP-2026-09-01.md`.

The documented split comparison is **7500/2500/0/0 versus router 6000/2000/1000/1000**; it is a proposal, not adopted economic authority. The current verifier model is an immutable EOA/ecrecover path, not ERC-1271 or EIP-712. A custody runbook is not a performed rotation. Keep current addresses/RPC configuration untouched unless the selected, authorized integration task actually requires a reviewed change; never paste secrets into the handoff or evidence.

## 8. Release definition of done

A green source gate is necessary but insufficient. Before claiming the complete textured upgrade ready or published:

1. Reconcile the final Codex/Hermes source and its actual native/generated dependency closure. No active writer may mutate the candidate while it is being certified.
2. Close unexpected release failures and source-authority blockers without weakening security, budgets, legacy identities or visual criteria.
3. Run the current required syntax, release, unified asset, native provenance, security, contract, inventory, build, strict health, CDN, third-party sandbox and documentation checks. The nine-step helper is a source/build subset, not all acceptance.
4. Verify ordinary homepage/selector/start/end/replay and earned progression on the actual candidate. Evidence routes and grants must stay labeled as evidence.
5. Capture all four approved heroes across 390×844, 844×390, 1024×768, 1440×900 and 3440×1440 where required, with full HUD and first-use hints. Cover actions, equipped weapons, contacts, ground shadows, depth/roof occlusion, current world routes, touch/gamepad/keyboard and actual source/loader identity.
6. Visual-review the candidate before any baseline acceptance; prove two zero-delta passes after legitimate acceptance. Do not run `visual:reboot:accept` merely to silence a diff.
7. Complete current active-combat performance/pressure/long-run and intended physical-device/audio acceptance. Serialize measurement windows; preserve failed pilots and qualifying retries separately.
8. Complete the retained first-time human tests and owner exact-candidate review. Address findings or record explicit owner-approved scope deferrals; do not invent a waiver.
9. Prove a clean-host build with no `.git` dependency and real LFS-pointer handling under the pinned Node/Python/Pillow environment. A previous Windows fixture does not itself certify the current remote Linux/Vercel build.
10. Freeze the actual intended staged scope, final build hashes and independent review inputs. Any later edit invalidates the corresponding exact review. Preserve the current mixed index until deliberately entering this approved freeze step.
11. Verify current GitHub/Vercel access, immutable Preview bytes/browser behavior and the actual rollback target. Existing website publication authority remains conditional on the certified candidate and current owner acceptance; a preview certificate alone is not promotion permission.
12. Publish only that exact approved **website** candidate, then read back remote commit, deployment/aliases, public bytes, cache behavior and normal browser flows. Keep rollback available. Report Web3 readiness separately.

Never mark the whole 99-item program complete because one local slice or one release test passes.

## 9. Working Windows commands and resource rules

These are resume commands, not a claim that all were run again for this handoff. Native paths use `C:/...` in Git Bash. Do not substitute `/c/...` for arguments to native Windows executables when MSYS argument conversion is disabled.

### Read-only entry

```bash
cd 'C:/Users/just_/Desktop/Projects/lesters-arcade-textured-rollout'
export GIT_OPTIONAL_LOCKS=0
NODE='C:/Users/just_/AppData/Local/npm-cache/_npx/387698761821791d/node_modules/node/bin/node.exe'
HERMESPY='C:/Users/just_/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe'
"$NODE" --version
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
"$HERMESPY" 'C:/Users/just_/Desktop/Projects/LestersArcade-Coordination/hmh-textured-rollout/tools/checkpoint.py' --reader hermes
```

### Exact current clearance reproduction

```bash
"$NODE" --test --test-reporter=tap --test-name-pattern '^W-10 every piece clears' tests/hmh-reboot-enclosures.test.mjs
```

At this handoff this intentionally returns exit 1 with the nine recorded offenders. It is not a full release run.

### Source/build controller, after coordination and integration

```bash
HMH_GATE_LABEL="resume-$(date -u +%Y%m%dT%H%M%SZ)" "$HERMESPY" -B .tmp/team/revamp-resume/run-integrated-gates.py
```

Inspect the current helper before reuse. It has already proven explicit Node 24.20.0 and spawned-node parity with CI Python 3.12.14. Do not reuse an old gate label or overwrite an old receipt. A manually invoked npm script can still spawn the wrong `node` from PATH; verify both parent and spawned versions rather than relying on an npx/PATH assumption.

Current package script names include `check`, `test:release`, `build`, `assets:qa:hmh-reboot`, `design:security-audit`, `design:third-party-security`, `contracts:check`, `repo:health:strict`, `repo:cdn-gate`, `docs:links`, `docs:production` and `visual:reboot`. Read `package.json` for the live command and select the exact task's full contract.

### Local preview, only after reserving a free port

```bash
"$HERMESPY" -m http.server 8967 --bind 127.0.0.1 --directory apps/portal
```

Serve **`apps/portal`**, not `dist`. After starting an owned server, verify readiness and served HTML/game/asset hashes before browser work, then pin the harness's `HMH_REBOOT_ORIGIN`. Example URLs, valid only while that matching server is running:

- `http://127.0.0.1:8967/`
- `http://127.0.0.1:8967/hmh-reboot/index.html`
- `http://127.0.0.1:8967/trust.html`

A localhost URL is not a file path, not a public deployment, and not proof of candidate identity. At the audit's resource check, **8967, 8973 and 8897 were not accepting TCP**. Recheck next session; never kill a listener by port or process name alone. Stop only a PID whose command/root and ownership are proven to be yours.

Other verified existing tool locations:

- CI Python: `R/.tmp/team/revamp-resume/ci-python/Scripts/python.exe` (prior receipt: Python 3.12.14 / Pillow 11.3.0).
- npm CLI: `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`.
- Blender: `D:/Apps/Blender/blender.exe`; use the established disabled-autoexec / explicit Python-exit-code workflow and never save over approved masters.
- Forge: `C:/Users/just_/.foundry/bin/forge.exe`.
- Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe`.

Coordinate CPU/Blender/GPU/browser windows before measured work. Use isolated profiles and medium bounded batches; a shared message is checkpoint-based coordination, **not an unattended watcher**. Do not change agent models, profiles, sandbox permissions or Git trust to bypass a blocker. The historical free Minimax fallback returned 404; use a currently available, approved runtime if a new independent worker is actually needed.

## 10. Source, evidence and historical timeline

| Location | Purpose / classification |
| --- | --- |
| R: `AGENTS.md` | Current project policy; protected read-order replacement is not needed |
| R: `DECISIONS.md` | Owner identity, acceptance, model/atlas/town/audio decisions |
| R: `docs/handoffs/hmh-textured-rollout-progress.md` | Latest-to-historical continuation ledger |
| R: `docs/qa/hmh-owner-return-checkpoint.json` | Current bounded correction/source/build blocker checkpoint |
| R: `docs/hmh-reboot/OPEN-WORK-CURRENT-STATUS.json` | Original complete 99-item source register; historical statuses |
| R: `docs/handoffs/2026-09-07-hmh-open-work-register-and-reprompt.md` | Historical intent and acceptance, not current commands or authority |
| R: `docs/hmh-reboot/AAA-ROADMAP.md` | Broader program; reconcile old sections with newer evidence |
| R: `docs/hmh-reboot/cycles/MODEL-COMPLETION-AUTHORITY.md` | Settled approved model/atlas authority |
| R: `docs/hmh-reboot/world-design/NATIVE-WORLD-PROVENANCE.json` | Mandatory native-world source/export/render dependency |
| R: `docs/hmh-reboot/world-design` | Paired world/native data and design records |
| R: `docs/hmh-reboot/LEVEL-ONE-WORLD.md` | Authored world documentation |
| R: `apps/hmh-reboot/assets/source/reference/heroes` | Approved hero reference source; actual app-relative path |
| R: `apps/hmh-reboot/assets/source/reference/weapons` | Weapon reference source; actual app-relative path |
| R: `apps/hmh-reboot/assets/source/models/tripo-gameplay` | Approved gameplay Blender source masters |
| R: `apps/hmh-reboot/assets/source/models/tripo-selector` | Packed selector GLB sources |
| R: `apps/hmh-reboot/assets/source/models/native-enemies/bagholder-rusher` | Locally adopted native Bagholder source/provenance |
| R: `apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json` | Hero production manifest |
| R: `apps/hmh-reboot/assets/source/blender/hmh-tripo-selector-sources.json` | Selector source provenance |
| R: `apps/portal/assets/generated/hmh-world-design/world-design.json` | Current paired desktop/mobile native world manifest |
| R: `apps/portal/assets/generated` | Generated runtime art; not a raw source vault |
| R: `scripts/hmh-blender` | Native exporters and source-pipeline helpers |
| R: `apps/hmh-reboot/src` | Child gameplay/render/input modules; shared hotspots require coordination |
| R: `apps/portal/src` | Parent catalog/profiles/provenance/leaderboard/settings modules |
| R: `apps/portal/main.js` | Parent portal entry/runtime integration |
| R: `apps/portal/trust.html` | New local support/privacy/terms/accessibility/testnet copy |
| R: `apps/portal/trust.css` | Responsive support-page styling |
| R: `tests/portal-trust-surface.test.mjs` | Four support-page source contracts |
| R: `tests/hmh-reboot-enclosures.test.mjs` | The current route-clearance failure |
| R: `tests/hmh-world-render-lifecycle.test.mjs` | Real Pixi attachment/cleanup/failure-path contracts |
| R: `tests/hmh-world-native-provenance.test.mjs` | Frozen source/native-output provenance contracts |
| R: `docs/qa/hmh-controls-binding-checkpoint.json` | Prior binding/help slice |
| R: `docs/qa/hmh-parent-provenance-checkpoint.json` | Prior hydration/network/transaction provenance slice |
| R: `docs/qa/hmh-leaderboard-source-order-checkpoint.json` | Prior source-order/cache slice |
| R: `docs/qa/hmh-touch-melee-checkpoint.json` | Historical touch scheme and real-input evidence |
| R: `docs/qa/hmh-camera-gameplay-checkpoint.json` | Prior camera/full-HUD/current-at-that-time gameplay proof |
| R: `docs/qa/hmh-native-endurance-checkpoint.json` | Older pressure/harness results; not new merged certification |
| R: `docs/qa/hmh-canonical-sprite-id-checkpoint.json` | Canonical gameplay ID versus native source identity repair |
| R: `docs/qa/hmh-native-runtime-integration-checkpoint.json` | Older portable native-runtime integration proof |
| R: `docs/qa/hmh-testnet-readback-checkpoint.json` | Eight legacy bytecodes and unresolved getRecentSessions ABI failure |
| R: `docs/hmh-reboot/WEB3-SPLIT-PROPOSAL.md` | Source-backed economic proposal; not adoption |
| R: `docs/hmh-reboot/WEB3-SPLIT-PROPOSAL.json` | Machine-readable split proposal |
| R: `docs/hmh-reboot/VERIFIER-CUSTODY-ROTATION-RUNBOOK.md` | Prepared custody/rotation procedure; no performed rotation |
| R: `docs/hmh-reboot/MAINNET-READINESS-ROADMAP-2026-09-01.md` | Separate readiness and approval tracks |
| R: `docs/hmh-reboot/DEPLOYMENT-ROLLBACK-RUNBOOK-AAA-FINAL-CANDIDATE.md` | Preview/production/rollback procedure; re-query current IDs |
| R: `docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json` | Exactly 51 preserved expected-failure identities |
| R: `docs/testing/hmh-reboot-test-retirement-gate.json` | Latest parsed combined source-release result |
| R: `.tmp/team/revamp-resume/source-gates-owner-return-03/receipt.json` | Latest nine-step run and log digests |
| R: `.tmp/team/playable-release/owner-return-01` | Corrections, review, local support-browser and closeout artifacts |
| R: `.tmp/team/playable-release/owner-return-01/review-followup` | Exact inputs/result/events/stderr for final bounded PASS |
| R: `.tmp/team/playable-release/owner-return-01/trust-browser/receipt.json` | Two local Chrome support profiles; not physical devices |
| R: `.tmp/team/playable-release/world-integration-01` | Incoming packet, preserved pre-integration bytes and failed attempts |
| R: `.tmp/team/playable-release/completion-20260909T143049Z/forge-test.log` | Stored 17/17 Foundry result |
| R: `.tmp/team/playable-release/completion-20260909T143049Z/slither.log` | Stored configured scan: 18 contracts/63 detectors/zero findings |
| R: `.tmp/team/revamp-resume/run-integrated-gates.py` | Existing pinned source/build controller; inspect before rerun |
| R: `scripts/build-hmh-world-decals.mjs` | Canonical world-derived decal generator; mutating, not a read-only check |
| R: `scripts/hmh-world-design-production-asset-qa.mjs` | World native provenance gate |
| R: `build.mjs` | Build factoring/output ownership |
| R: `package.json` | Actual current script names |
| R: `scripts/docs-link-check.mjs` | Whitelist-only shipped-doc links check |
| R: `scripts/production-doc-drift-check.mjs` | Read-only live cache-marker versus README check |
| S: `HANDOFF.md` | Shared coordination entry |
| S: `ownership.json` | Integration and file/resource ownership |
| S: `status/hermes.json` | Hermes-owned status |
| S: `status/codex.json` | Peer status, containing stale and new fields |
| S: `tools/checkpoint.py` | Read-only default checkpoint/new-or-changed-message reader |
| S: `messages/codex-20260909-simple-controls.md` | Peer-reported new controls direction; mutable message |
| S: `messages/codex-20260909T171019Z-world-upgrade-start.md` | Newer active world lane |
| S: `messages/codex-20260909T172708Z-world-upgrade-progress.md` | World follow-on progress |
| S: `messages/hermes-20260909T191948Z-reservoir-route-clearance.md` | Previously reported clearance blocker |
| S: `messages/hermes-20260909T201222Z-corrections-verdict-and-required-supplement.md` | Required two-packet correction dependency and verdict |
| S: `submissions/hermes/controls-binding-20260909T145836Z/submission-manifest.json` | Immutable prerequisite: before/after/source/evidence inventory |
| S: `submissions/hermes/portal-provenance-20260909T153312Z/submission-manifest.json` | Immutable prerequisite: before/after/source/evidence inventory |
| S: `submissions/hermes/leaderboard-source-order-20260909T163327Z/submission-manifest.json` | Immutable prerequisite: before/after/source/evidence inventory |
| S: `submissions/hermes/owner-return-corrections-20260909T195423Z/FILE-MANIFEST.json` | Immutable corrected source or required supplement manifest |
| S: `submissions/hermes/owner-return-provenance-supplement-20260909T201222Z/FILE-MANIFEST.json` | Immutable corrected source or required supplement manifest |
| S: `submissions/codex/world-native-integration-return-20260909T161928Z` | Already locally integrated original world return |
| F: `FILE-MANIFEST.json` | Original 32-file Codex handoff / captured dirty-baseline evidence |
| F: `DELIVERY-RECEIPT.json` | Original 32-file Codex handoff / captured dirty-baseline evidence |
| F: `WORLD-INTEGRATION-DELTA.zip` | Original 32-file Codex handoff / captured dirty-baseline evidence |
| F: `evidence/current-candidate-copy.json` | Original 32-file Codex handoff / captured dirty-baseline evidence |
| O: `entry.json` | This documentation audit; scope stays distinct from full release certification |
| O: `checkpoint.json` | This documentation audit; scope stays distinct from full release certification |
| O: `coordination.json` | This documentation audit; scope stays distinct from full release certification |
| O: `register.json` | This documentation audit; scope stays distinct from full release certification |
| O: `reconciled-register.json` | This documentation audit; scope stays distinct from full release certification |
| O: `git-remote-and-peer.json` | This documentation audit; scope stays distinct from full release certification |
| O: `evidence-authentication.json` | This documentation audit; scope stays distinct from full release certification |
| O: `clearance-recheck.log` | This documentation audit; scope stays distinct from full release certification |
| O: `production-sample.json` | This documentation audit; scope stays distinct from full release certification |
| O: `production-marker.log` | This documentation audit; scope stays distinct from full release certification |
| R: `docs/releases/press` | Historical capture output destination; no new media delivery claimed — future output target, not created |

All paths in that index were checked during handoff production. Historical register shorthand such as `assets/source/reference/heroes/` and `assets/source/reference/weapons/` is **not a valid repository-root path here**: the actual checked directories are under `apps/hmh-reboot/assets/source/reference/`. Their original wording is preserved in the appendix rather than silently corrected. The old `dist/main.js` shorthand resolves to `R/apps/portal/dist/main.js`, not a repository-root `dist` directory. The enemy-reference intake and press-capture paths in old acceptance text describe desired destinations, not proof that those outputs exist. `STATUS.md` in the old STACKED wording is a contextual reference, not a claim of a root-level file. O and many `.tmp` evidence directories are local/ignored artifacts, not guaranteed GitHub content. Keep the working copy and immutable shared deliveries available; attaching this Markdown alone is not an asset or source backup. Final documentation validation is recorded in `O/handoff-validation.json`; it checks handoff coverage, paths, output hashes and preservation, not game release readiness.

### Timeline, not a replay queue

- June 4: Lester's Arcade became the portal direction, with off-chain browser gameplay and separate on-chain rails.
- September 5–8: owner reference/native-model direction and bounded hardening; H-0 settled to exact lossless WebP and explicit caps. These decisions supersede older procedural-remodel and atlas-choice questions.
- September 7: Fable's open-work register captured intent and old production defects. Its old live IDs, “unanswered” decisions and HALT language are not current authority.
- September 8–9: native hero/Bagholder/prop integration, camera/HUD/ID/input and normal Free-flow work advanced locally; older failed pilots remain archived.
- September 9: binding ownership, parent provenance and source ordering were closed as bounded source slices; the first world packet was integrated; bounded renderer/decal/provenance fixes reduced the current source-release failure set to the one clearance guard.
- Current handoff: read-only repository/coordination/evidence/public sampling plus documentation. No new gameplay fix, asset generation, commit, push, deployment or Web3 write was performed.

### Historical traps to avoid

- Older progress paragraphs still say 21 or 12 unexpected failures, Bagholder unadopted, portrait camera blocked, controls worker unable to start, Codex unacknowledged or H-0 unanswered. Use the newer named receipt, not the oldest matching paragraph.
- The prior command-free remaining-register audit contains stale suggested owner questions, including the protected read-order edit and source-input gaps. It is advisory and predates later work; the appendix below is the updated overlay.
- Do not run prior mutating packaging/application/closeout helpers just to “check” their result. In particular, `R/.tmp/team/playable-release/close-owner-return.py` creates a supplement, writes status/checkpoints and can stop its owned listener; it is not a read-only verifier.
- An initial handoff-audit verifier assumed all prerequisite manifests were named `FILE-MANIFEST.json` and failed before writing its receipt. It was corrected to the observed `submission-manifest.json` / `changedPaths` schema and completed. No source repair was made to hide this tooling failure.
- Never reinterpret source-rig existence, loaded/cull-visible sprites, canvas-only recordings, local cache data, a repaired harness or CLI exit 0 as a broader acceptance claim than the actual evidence supports.
- No credentials, private keys, tokens, passwords or secret connection strings belong in prompts, packets, docs or chat. Public support identity is not a credential.

## 11. Recommended first session outcome

Re-establish the exact live tuple and current Codex handoff. State briefly what changed since this snapshot, which packet/dependency set is authoritative, and the next **single bounded, unblocked** slice. Then execute within existing authorization and file ownership; do not stall on already-resolved identity/atlas questions or jump into an unbounded correction loop.

If Codex has delivered the route/control return, prioritize guarded reconciliation and the unchanged clearance/authority contracts. If it has not, choose an already-authorized non-overlapping readiness slice and keep the integration blocker explicit. Ask only for genuinely missing authority or human input, using visible numbered questions, batched where independent.

The companion new-session prompt is provided separately. This document records scope; it does not grant protected edits, unlimited repair iterations, purchases, mainnet actions, fund transfers or irreversible authority changes.

## 12. Complete reconciled register — all 99 entries

**Reading rule:** “Original requirement” and “Original acceptance” below preserve historical source text, including old questions and instructions. They are **not active execution commands**. The current disposition and sections 1–8 take precedence. A local-complete slice is not a public release, and a paused or approval-gated task must not be silently activated.

| Current handoff classification | Entries |
| --- | --- |
| COMPLETE / SUBSTANTIALLY CLOSED | 5 |
| PARTIAL | 45 |
| OPEN | 22 |
| OWNER-GATED / PAUSED | 27 |

Counts total **99**. “Complete” here means the named decision/foundation is substantially closed, **not that the textured release is certified**. Partial rows explicitly retain remaining acceptance; paused STACKED rows remain separately namespaced.

The source JSON was copied into O as `register.json`; the derived crosswalk is O: `reconciled-register.json`. Original receipts and the source status ledger were left unchanged.

### 4.1 Live defects (Cycle 081 candidate — all small, all player-visible)

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:B-1` | Touch profiles show the keyboard hint ("WASD move · Mouse aim · Right click grenade · 1-4 weapons · Esc"). Static copy in `apps/portal/hmh-reboot/index.html`, the `hmhControlsHint` aside.<br>**Original acceptance:** Hint copy is chosen from the same touch detection the cockpit uses and names MOVE/AIM sticks, SWAP, POWER, double-tap dash, pause. RED test plus a mobile-controls smoke assertion. | `deployed_partial_certification` | **PARTIAL** — Touch-aware help exists; prior source/browser evidence is preserved. Reconcile the pending three-control brief and verify the new actual consumers, rather than restoring old hint text. |
| `REGISTER:B-2` | That hint card sits over the middle of the phone play area for 12 seconds, covering the hero.<br>**Original acceptance:** Docked under the cockpit or above the sticks on touch profiles; measured zero overlap with the hero spawn area. | `local_integrated_release_pending` | **PARTIAL** — The later camera/HUD/hint framing slice passed locally. Recheck current merged full-HUD and first-use-hint containment; do not repeat the old shrink/hide workaround. |
| `REGISTER:B-3` | Home page ad strip draws across the featured-cabinet card at 1440x900.<br>**Original acceptance:** Containment assertion in the portal E2E; no overlap at all five profiles. | `deployed_partial_certification` | **PARTIAL** — Prior deployed containment fix and normal Free-flow evidence exist. Recheck the final portal across all required profiles; no blind rebuild of the old defect. |
| `REGISTER:B-4` | Hashwood landmark renders as a huge translucent cone over the spawn; the hero stands inside it.<br>**Original acceptance:** Landmarks never overlap a spawn disc; scale, placement or alpha corrected; verified in the hashwood scene at 100%. | `deployed_partial_certification` | **PARTIAL** — Prior spawn/landmark presentation correction exists. Recheck the new native world and spawn/camp pairing instead of assuming the old cone is still the current renderer. |
| `REGISTER:B-5` | Selector turntables fill about 60% of the frame and are lit so darkly the red bandana, armband and headband barely read.<br>**Original acceptance:** Figure fills about 85% of frame height, exposure toward the hero rig's -0.45 with the shared warm rim, two-run gate re-verified. | `local_integrated_release_pending` | **PARTIAL** — Genuine selector A/B and later local acceptance exist. Preserve approved source/framing and verify current selector/gameplay parity; do not reopen atlas/model decisions. |
| `REGISTER:B-6` | Select copy says Lit Commando has a "dark mohawk"; the reference art is a mullet with a swept fringe.<br>**Original acceptance:** All four bios audited against the reconciled reference doc (H-1). | `local_integrated_release_pending` | **PARTIAL** — Canonical biographies and identity reconciliation were integrated locally. Preserve them and audit any subsequent copy against the approved references. |
| `REGISTER:B-7` | HUD shows "COMBO RESET ×0" when no combo exists; "RESET" reads as an error.<br>**Original acceptance:** Label reads "COMBO" or hides until the first hit. | `deployed_partial_certification` | **PARTIAL** — The prior combo-label correction is a shipped foundation. Confirm it in the final HUD; the broader narrow-profile arsenal/controls work is separate. |
| `REGISTER:B-8` | Doc drift: `AGENTS.md` has two "0." read-order lines naming different current handoffs; roadmap section 7 unreconciled since Cycle 074; `docs/stacked/STACKED-MASTER-PLAN.md` still says "NOTHING IS BUILT" while `STATUS.md` records S-01 to S-03 live.<br>**Original acceptance:** One read-order line; roadmap section 7 rewritten from section 3 of this file; STACKED plan stamped with its real status. | `partial_protected_edit_blocked` | **PARTIAL** — The requested AGENTS.md rollout-first read order already exists; no protected replacement is needed or authorized. Use the newer progress/decision overlay, not the stale protected-edit question; remaining docs must match the eventual release. |
| `REGISTER:B-9` | Repo health gate fails at 405 MB against 350 MB because of raw expanded sources.<br>**Original acceptance:** Owner decides: move intermediates out of the tree, or raise the limit deliberately with a note. | `needs_current_measurement` | **PARTIAL** — Latest strict repository-health gate PASS is authenticated. The old 405 MB failure is not current proof of a cap problem. Preserve budgets; remeasure the merged deployable payload and LFS/clean-host behavior. |
| `REGISTER:B-10` | Desktop p99 rose to about 16.5 ms at Cycle 074 with the atmosphere pool's first fill; never investigated.<br>**Original acceptance:** First-fill spike profiled; pool pre-warmed at session start; p99 recorded. | `open_needs_scoped_verification` | **OPEN** — Historical first-fill/p99 intent remains. Profile the current merged candidate with a valid, isolated harness before changing a pool or tuning performance. |
| `REGISTER:B-11` | Mining-camp atmosphere haze is dense enough to cut contrast.<br>**Original acceptance:** Owner looks; my recommendation is a 30% density reduction. | `owner_or_input_gate_verify_before_action` | **OWNER-GATED / PAUSED** — A current full-HUD visual/taste decision is still needed. The old 30% reduction is a recommendation, not an applied or newly authorized correction. |

### 4.2 Hero program — the owner's number one priority

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:H-0` | **OWNER DECISION, blocks everything below.** Atlas format and per-hero cap. Known: Commando at 648 frames and 256 px did not fit 3.25 MiB as lossless PNG in eight trials; lossless WebP exact is about 23% smaller; per-hero lazy loading already exists.<br>**Original acceptance:** You present three costed options with measured bytes from the real Commando frames: (a) lossless WebP exact at 256 px under a 4 MiB cap, (b) 224 px PNG under the current cap, (c) 256 px PNG with the cap raised to 4 MiB and total to 16 MiB. Owner's answer recorded in `DECISIONS.md`. **Do not wait silently — bring the numbers.** | `decision_complete` | **COMPLETE / SUBSTANTIALLY CLOSED** — Resolved: exact lossless WebP, 4,194,304 bytes per hero, 16,777,216 aggregate, maximum 2048 atlas dimension, all 648 frame IDs. Do not re-ask the obsolete three-option question or increase caps. |
| `REGISTER:H-1` | Reconcile `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md` to the committed reference art. Identity blocks are in section 5.2 of `docs/handoffs/2026-09-05-hmh-cycle-074-hermes-handoff.md`.<br>**Original acceptance:** All four identity blocks match the art: hair, neckwear, pauldron side, armband side, bandolier direction, Lilly's coat trim and "L" buckle, Lester's sphere head and expression sheet. | `local_committed_candidate` | **PARTIAL** — Identity/source reconciliation exists. Preserve approved reference bytes, model details and canonical biographies; recertify only the actual changed presentation. |
| `REGISTER:H-6` | Packed-texture handling: `external_dependencies()` still counts packed images as external and the runner rejects a non-zero count; real Tripo GLBs carry packed textures. Open since Cycle 072.<br>**Original acceptance:** A packed-texture GLB passes the hero pipeline's dependency check; unpacked media and linked libraries still rejected. | `shipped_foundation_preserve_regression` | **COMPLETE / SUBSTANTIALLY CLOSED** — Packed-texture dependency handling is a shipped foundation. Preserve the packed-versus-external distinction and regression contract; no new implementation is justified by the old prose. |
| `REGISTER:H-2` | Rig and skin the four Tripo GLBs for gameplay. Tripo or Mixamo auto-rig retargeted so the fourteen runtime bones exist (`root, pelvis, spine, chest, head, upper_arm.L/R, forearm.L/R, thigh.L/R, shin.L/R, weapon_socket`), weights corrected at shoulders, hips, waist seam; coat and hair bones for Lilly; rigid sphere head for Lester.<br>**Original acceptance:** Rigged FBX or GLB committed as LFS source with its SHA in the manifest; waist split verified under maximum torso rotation. | `local_integrated_not_release_certified` | **PARTIAL** — Approved native sources and gameplay derivatives exist. Inspect the actual remaining rig, weights, waist split and source custody requirements without remodeling or restarting four heroes. |
| `REGISTER:H-3` | Author the nine clips per hero: `idle, run, aim, pistol-fire, hurt, dash, melee, grenade, death`, at the frame counts and fps the manifest declares. Mixamo clips as a starting point are fine if committed as source.<br>**Original acceptance:** Weight shift, foot planting, recoil and recovery, and a distinct death read at gameplay zoom. | `local_integrated_not_release_certified` | **PARTIAL** — Four 648-frame local hero sets exist. Their presence and run-motion proof do not close every clip's gameplay-zoom readability; inspect the remaining actions from current sources. |
| `REGISTER:H-4` | Gameplay pilot per hero behind `?productionHero=<id>`, Lit Commando first.<br>**Original acceptance:** Two-run reproducibility under the hero budget (8 / 2 / 32); hero-vs-enemy parity band 0.8 to 0.9 holds; side-by-side against the reference front render at 100%; hero-crop visual checks on frontier-relay desktop and mobile; five-profile certification; mobile atlas decode measured. Then Valkyrie, Lilly, Lester, one cycle each. | `local_integrated_not_release_certified` | **PARTIAL** — Prior all-hero/profile, camera, full-HUD and native-loader evidence exists. Current merged gameplay, earned unlocks, mobile decode/GPU, all-action and human acceptance remain separate. |
| `REGISTER:H-5` | Regenerate the selector from the same rigged source.<br>**Original acceptance:** Select screen and gameplay show the same model. | `local_integrated_not_release_certified` | **PARTIAL** — Canonical selectors were regenerated and A/B checked. Preserve that work; bind current selector/gameplay parity to the approved source and final candidate. |
| `REGISTER:H-7` | Weapon socket geometry: the Tripo models have no socket, and the eight weapon meshes must be re-authored or scaled to the new hand size and pose.<br>**Original acceptance:** Pistol first, correct in hand across all eight directions. | `source_and_partial_runtime` | **PARTIAL** — Source and partial held-weapon work exist. Verify actual in-hand socket/direction/pose coverage; do not substitute pickup icons or recreate approved hero models. |
| `REGISTER:C-5` | Secondary motion where the reference allows it: Lilly's coat tail, hair groups, Commando's neckerchief.<br>**Original acceptance:** Baked into the actions, not runtime physics. | `partial_needs_current_evidence` | **PARTIAL** — Inspect existing baked coat/hair/cloth source and clips before declaring them absent. Remaining acceptance must stay baked presentation, not new runtime physics. |
| `REGISTER:C-6` | Implement the atlas budget decision from H-0.<br>**Original acceptance:** Measured mobile decode and GPU memory recorded. | `partial_needs_current_evidence` | **PARTIAL** — H-0 implementation and compressed-byte evidence exist. Current device decode, GPU allocation and active-play performance still need acceptance; do not reopen the format decision. |

### 4.3 Enemies

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:E-2` | **Owner-gated.** Enemy reference sheets: six roles plus three Liquidator phases. Ask using the prompt in roadmap section 8.1.2.<br>**Original acceptance:** Sheets committed under `assets/source/reference/enemies/`. | `private_enemy_candidate` | **OWNER-GATED / PAUSED** — Check the actual delivered reference/role provenance and any recorded approvals before asking for more art. Bagholder's local adoption does not approve every remaining role or boss phase. |
| `REGISTER:E-7` | The unbound zombie candidate (152 frames, zero drift) lacks roster identity details.<br>**Original acceptance:** Either bound to a role with silhouette prop, faction colour and accent, or archived. Do not leave a third enemy pipeline half-alive. | `adopted_local_release_pending` | **PARTIAL** — Bagholder was adopted locally after native A/B and runtime/hit/visual checks. The old private-only/unbound description is obsolete; final combined release acceptance remains. |
| `REGISTER:E-8` | Boss atlas at 96.6% of its 2 MiB cap and roster reproducibility margin at 7 of 8 changed pixels. Fragile.<br>**Original acceptance:** Three Liquidator phases split into three atlases; drift-trend recorded per pipeline run. | `open_needs_scoped_verification` | **OPEN** — Boss phase-atlas capacity/reproducibility margin remains a scoped verification item. Inspect current manifests and drift logs before splitting/regenerating; never relax thresholds to pass. |
| `REGISTER:E-3f` | Tell readability was widened in the atlas but never measured at gameplay zoom.<br>**Original acceptance:** A clip per role at 100% with the frame count between tell and hit recorded. | `open_needs_scoped_verification` | **OPEN** — Record real tell-to-hit timing and full-HUD gameplay-zoom clips per role on the final candidate; source pose presence is not sufficient. |
| `REGISTER:E-5` | Boss per-phase presentation: visibly distinct `market-open`, `margin-call`, `total-liquidation`.<br>**Original acceptance:** Three phases readable from a screenshot. | `open_needs_scoped_verification` | **OPEN** — Verify visually distinct market-open, margin-call and total-liquidation states on the actual boss; do not infer phase completion from a roster manifest. |
| `REGISTER:E-6` | Boss fight depth: authored counters, add-wave pressure, arena use. Simulation work; needs G-1 first.<br>**Original acceptance:** RED tests, same-seed survival and TTK reports. | `dependency_ordered_open` | **OPEN** — Depends on current G-1 evidence. Keep any boss counter/add/arena change bounded, deterministic and benchmarked rather than expanding AI before the baseline is known. |

### 4.4 Weapons, pickups, power-ups

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:R-4` | Weapon models from the eleven committed reference PNGs (`assets/source/reference/weapons/`: rugged handgun, rifle, shotgun, survival knife, sci-fi grenade and launcher, spiked steampunk grenade, steampunk raygun, weathered military grenade, weathered SMG, worn heavy machine gun).<br>**Original acceptance:** Pistol, shotgun, auto-miner and launcher first, since they are the Digit 1 to 4 slots. | `source_and_partial_runtime` | **PARTIAL** — Reference/weapon source and some runtime work exist. Inspect actual equipped pistol/shotgun/auto-miner/launcher and remaining weapons, sockets and effects before a new art pass. |
| `REGISTER:R-5` | Power-ups as objects, not octagonal badges.<br>**Original acceptance:** Small 3D pickups with an emissive accent and the existing bob. | `open_needs_scoped_verification` | **PARTIAL** — The native pack includes actual pickup objects and prior on-screen collection evidence. Recheck all canonical effects and final world placements; do not assume octagonal badges are still the only implementation. |
| `REGISTER:W-8f` | Camp props are placed but campfires emit no light or embers.<br>**Original acceptance:** Pooled emitter tied to the atmosphere layer. | `open_needs_scoped_verification` | **OPEN** — Confirm actual campfire light/ember consumers and budgets with feature-specific telemetry and visuals. Do not use generic particle activity as proof. |

### 4.5 World and level design

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:R-3` | **Modular prop kits authored in Blender: town, camp, industrial, bridge.** The 45 procedural pastel props are now the most visible quality ceiling in every world scene. Schedule right after the first two heroes.<br>**Original acceptance:** Shared grid unit, pivots and collision proxies; district scenes read as built places. | `dependency_ordered_open` | **PARTIAL** — The native environment/world return is locally integrated. Grounding, clearance, matching collision proxies, district composition and current gameplay remain unaccepted; coordinate Codex's active lane. |
| `REGISTER:R-2` | **Owner-gated.** Tripo organics wave: trees, boulders, wrecks, stumps, debris.<br>**Original acceptance:** Owner delivers GLBs per roadmap 8.1.3. | `owner_or_input_gate_verify_before_action` | **PARTIAL** — Native GLB/Blender inputs and selected world assets have been delivered and authenticated. Verify the exact remaining organic set/provenance instead of re-asking for the whole library or buying more credits. |
| `REGISTER:W-17` | The hashwood tree line reads as a flat green band across the frame (capsule thicket blockers drawn as a continuous strip).<br>**Original acceptance:** Broken into canopy clusters with depth, the way cliffs were treated in Cycle 073. | `open_needs_scoped_verification` | **PARTIAL** — Native foliage/world work changes the old flat-band context. Inspect the actual current hashwood grouping and depth/occlusion before any new dressing pass. |
| `REGISTER:W-18` | Yard slab grid reads as a regular checkerboard at gameplay zoom.<br>**Original acceptance:** Slab size varied with cracks and stains in the bakery. | `open_needs_scoped_verification` | **PARTIAL** — World/decal work is locally integrated, including water-safe ground families. Current yard slab readability still needs full-HUD gameplay-zoom judgment; do not reuse a stale bake after topology changes. |
| `REGISTER:W-9` | **Owner-gated (8.3.1).** Town district: convert part of the yard, or add a seventh district.<br>**Original acceptance:** Owner picks; recommendation is converting the yard first. | `direction_recorded` | **COMPLETE / SUBSTANTIALLY CLOSED** — Owner direction is the ruined-yard town. The convert-versus-seventh-district question is resolved; finishing and verifying that authored world remains under the world tasks. |
| `REGISTER:W-11` | Simulation verticality beyond the projection work already shipped.<br>**Original acceptance:** Overlook platforms, sunken pits, terraces with elevation authority in the world contract. | `open_needs_scoped_verification` | **PARTIAL** — Canonical elevation/one-way drops already exist, and physical bridge/ramp world data has advanced. Verify the new traversal/collision boundaries; do not describe all verticality as missing or rewrite authority wholesale. |
| `REGISTER:W-12` | Secrets: caches behind destructibles, a hard-to-reach ledge cache, lore props.<br>**Original acceptance:** Discoverable and deterministic. | `open_needs_scoped_verification` | **OPEN** — Inspect current Codex secrets/interactions and prove canonical deterministic discovery/collection. A tour spawn or pregrant is not an earned reachability result. |
| `REGISTER:W-16` | Level 2 planning.<br>**Original acceptance:** Only after Level 1 meets the World acceptance bar. | `dependency_ordered_open` | **OPEN** — Dependency-gated: Level 1 world acceptance first. Do not start Level 2 expansion to bypass current integration, clearance or player-experience failures. |

### 4.6 Combat, movement, controls

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:G-7` | Reconcile the withheld Cycle 079 pacing and combat work onto the current boundary and fix its two findings: automatic defeat-spread creates burns on neutral nearby actors before damage filtering; automatic refresh downgrades a manually initiated burn's causal origin.<br>**Original acceptance:** Both fixed with RED tests and a same-seed replay note. Do not copy old Cycle 079 cache markers or re-apply the shipped corpse patch. | `open_needs_scoped_verification` | **OPEN** — Still unclosed: actual ambient defeat-spread must not create neutral burns before filtering, and auto refresh must preserve manual causal origin. Require RED/GREEN and same-seed partition proof on current runtime seams; coordinate main.mjs. |
| `REGISTER:G-1` | Swarm-pressure benchmark: clear time, overkill, projectile pressure. **Gates every balance claim.**<br>**Original acceptance:** Report in `docs/qa/`. | `open_needs_scoped_verification` | **PARTIAL** — Canonical weapon/boss/swarm reports and prior focused checks exist. Produce or authenticate the full current swarm-pressure/clear-time/overkill/projectile baseline before balance claims. |
| `REGISTER:G-3` | Melee: give it a real role reachable on touch, or retire it explicitly.<br>**Original acceptance:** Decision recorded either way. | `open_needs_scoped_verification` | **PARTIAL** — Touch melee was made reachable and tested under the older scheme. Codex's pending automatic close combat supersedes gesture design; verify eligibility, causality, cooldown/reset and player readability on the merged candidate. |
| `REGISTER:G-6` | Weapon and swarm benchmarks re-run after every simulation change.<br>**Original acceptance:** Attached to each cycle ledger. | `open_needs_scoped_verification` | **PARTIAL** — Prior deterministic weapon/boss/Burner/Forked Standard checks are preserved. Re-run affected canonical benchmarks after the new simulation/automatic-control integration. |
| `REGISTER:K-3` | Full action-map audit and in-game exposure.<br>**Original acceptance:** Every binding discoverable. | `open_needs_scoped_verification` | **PARTIAL** — Binding ownership/live help fixes passed 120/120. Preserve them while reconciling the pending reduced control surface and its actual runtime consumers. |
| `REGISTER:K-4` | Rebinding UI, aim-assist toggle, stick sensitivity, left-handed touch layout.<br>**Original acceptance:** Persisted parent-side. | `open_needs_scoped_verification` | **PARTIAL** — Parent-owned settings/rebinding infrastructure exists; full requested feature/consumer coverage must be checked. Do not restore extra controls that conflict with the new peer brief or expose dormant settings. |
| `REGISTER:K-5` | Movement-feel measurement report before any further tuning.<br>**Original acceptance:** Input latency, accel and decel, diagonal normalisation, turn response. | `open_needs_scoped_verification` | **OPEN** — A current input-latency/accel/decel/diagonal/turn-response report is still required before additional movement tuning; old camera smoke is not that report. |
| `REGISTER:K-6` | Dash input buffering and edge forgiveness.<br>**Original acceptance:** Buffered inputs; landing already has dust. | `open_needs_scoped_verification` | **PARTIAL** — First-catch-up-tick tap consumption and prior buffering work exist. Verify the new automatic dodge/buffering/cancellation semantics; do not reinstate a double-tap requirement blindly. |
| `REGISTER:K-8` | Touch onboarding beat: sticks pulse once on first run.<br>**Original acceptance:** Plus B-1 and B-2. | `deployed_partial_certification` | **PARTIAL** — Prior touch onboarding exists. Recheck first-run help/visual pulses and discoverability against the final simplified controls, with the initial hint visible. |

### 4.7 UI, audio, portal, data

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:U-8` | Death and run-summary screen has never been reviewed as a player flow.<br>**Original acceptance:** Played on desktop and phone; what reads wrong is fixed. | `open_needs_scoped_verification` | **OPEN** — Review actual death, run summary, replay and restart on desktop/phone with canonical terminal data. Existing automated Free-start checks do not close this player flow. |
| `REGISTER:U-9` | HUD polish: the combo label (B-7); the eight-slot arsenal strip is dense on phones.<br>**Original acceptance:** Unowned slots collapse on narrow profiles. | `open_needs_scoped_verification` | **PARTIAL** — Combo-label work and responsive HUD improvements exist. Verify the final narrow arsenal/status/control layout without hiding the HUD to pass evidence. |
| `REGISTER:S-1` | **Owner-gated (8.3.4).** Audio expansion: footsteps by terrain material, reload, empty and impact variants, boss cues, UI set.<br>**Original acceptance:** Sourcing policy chosen; every file carries a license line. | `direction_recorded` | **COMPLETE / SUBSTANTIALLY CLOSED** — Sourcing decision is recorded: repository-owned synthesis or already-approved licensed audio, without new spending. File/cue completeness and listening acceptance remain separate tasks. |
| `REGISTER:S-4` | Mix pass with measured LUFS per category.<br>**Original acceptance:** Recorded in the ledger. | `dependency_ordered_open` | **OPEN** — The audio inventory exists. Authenticate any existing loudness measurements, then finish current category mix, clipping/voice budgets and physical-device listening; do not call file presence a mix pass. |
| `REGISTER:L-2` | **Owner-gated.** Seeded house scores on public leaderboards.<br>**Original acceptance:** Recommendation: remove before launch, keep in a labelled House tab. | `owner_or_input_gate_verify_before_action` | **PARTIAL** — Source-separated ranking/provenance is implemented locally. Confirm the intended visible default and house labeling before declaring the public seeded-score policy accepted. |
| `REGISTER:L-4` | **Owner-gated.** Banner-only cabinets (MWEB Invaders, LitVM Legends) visible or hidden.<br>**Original acceptance:** Recommendation: hide until playable. | `owner_or_input_gate_verify_before_action` | **OWNER-GATED / PAUSED** — Inspect the current cabinet catalog/playability and recorded visibility decisions. Do not claim banner-only cabinets are playable; the historical hide recommendation is not itself approval. |
| `REGISTER:L-3` | Splash: three clicks to a running game, one live competitive proof.<br>**Original acceptance:** Plus the ad-strip fix (B-3). | `local_integrated_release_pending` | **PARTIAL** — Prior ordinary homepage-to-Free flow passed 10/10 without grants. Recheck the merged source, actual touch/phone use and truthful competitive proof; do not confuse cached scores with verified chain play. |
| `REGISTER:L-5` | Profile as command centre, after the run-stats schema.<br>**Original acceptance:** Kills by role and weapon, accuracy, build history. | `open_needs_scoped_verification` | **OPEN** — Build only from the real bounded canonical run schema/history. Existing provenance fixes are a dependency, not completion of role/weapon/accuracy/build-history UI. |
| `REGISTER:L-6` | Achievements: unlock dates, progress meters, accessible tooltips.<br>**Original acceptance:** Definition of done not specified in guide; define before implementation. | `open_needs_scoped_verification` | **OPEN** — Define the exact accessible date/progress/tooltip acceptance before implementation; never invent missing unlock dates or progress from absent canonical data. |
| `REGISTER:L-8` | Key art re-rendered from the new hero models.<br>**Original acceptance:** Portal and game finally match. | `dependency_ordered_open` | **OPEN** — Dependency-gated on the accepted approved-model presentation. Reuse actual source for key art and verify portal/game consistency, not a separate unapproved character redesign. |
| `REGISTER:L-9` | Trust pages: privacy, terms, support, accessibility, testnet disclaimer.<br>**Original acceptance:** Drafted by you, approved by owner. | `owner_or_input_gate_verify_before_action` | **PARTIAL** — Support/privacy/terms/accessibility/testnet page and footer are implemented with supplied identity; 4 tests/two local Chrome profiles passed. Exact-copy owner and legal/physical-device acceptance are not implied. |
| `REGISTER:D-2` | Privacy-conscious funnel: homepage to play to hero to run start to first upgrade to death to replay.<br>**Original acceptance:** Parent-owned. | `open_needs_scoped_verification` | **OPEN** — Verify existing parent-owned funnel consumers and privacy/consent behavior before extending telemetry. Do not invent analytics data or shift authority to the child. |
| `REGISTER:D-3` | Internal balance dashboards from G-1 and X-1 output.<br>**Original acceptance:** Published to `docs/qa/`. | `open_needs_scoped_verification` | **OPEN** — Depends on actual canonical G-1/run-stat outputs. Publish factual internal reports rather than fabricated dashboard data or a parallel combat model. |

### 4.8 Platform and process

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:N-3` | Roadmap reconciliation (B-8): rewrite section 7 from section 3 of this file, add a "Current live override — Cycle 080" block, classify the new task IDs.<br>**Original acceptance:** The roadmap stops lying about what shipped. | `partial_protected_edit_blocked` | **PARTIAL** — Later roadmap/progress reconciliation supersedes old current-state prose. Do not revive the protected AGENTS.md replacement; maintain truthful candidate/live separation as new release evidence arrives. |
| `REGISTER:N-7` | Pin the curated-level-kit inventory to the `apps/portal/src` directory listing by test.<br>**Original acceptance:** Adding a portal module cannot desynchronise `dist/main.js`. | `local_integrated_release_pending` | **COMPLETE / SUBSTANTIALLY CLOSED** — The inventory/module synchronization safeguard exists and the latest inventory gate passes. Preserve it; regenerate from the actual final module set after integration. |
| `REGISTER:N-8` | Apply the per-profile browser relaunch to the visual-regression harness; add hero-crop checks beside the enemy-crop checks.<br>**Original acceptance:** Definition of done not specified in guide; define before implementation. | `partial_needs_current_evidence` | **PARTIAL** — Per-profile/native/full-HUD evidence infrastructure exists. Prove the actual required crop/profile harness coverage on the current candidate; old captures and accepted baselines are not new proof. |
| `REGISTER:N-9` | Repo health at 405 MB (B-9).<br>**Original acceptance:** Owner decision applied. | `needs_current_measurement` | **PARTIAL** — Duplicate intent with REGISTER:B-9, but keep the ID. Latest strict health passes; final merged deployable/LFS/clean-host budgets still need current acceptance, not an automatic limit increase. |
| `REGISTER:N-2` | **Owner-gated.** Legacy asset triage: about 17 MB of superseded pixellab and isometric art.<br>**Original acceptance:** Keep or retire list approved. | `owner_or_input_gate_verify_before_action` | **OWNER-GATED / PAUSED** — Preserve unique legacy/source material and recorded staged deletions. A broad keep/retire cleanup needs its own approved inventory; a clean-tree goal is not deletion permission. |
| `REGISTER:N-4` | Remaining bundle work: a lazy debug and evidence chunk, about 20 KB, needs a build change.<br>**Original acceptance:** Not urgent at current headroom. | `open_needs_scoped_verification` | **PARTIAL** — Current entry/static-closure factoring is measured under the unchanged caps. Reconcile Codex's alternative factoring before adding any debug/evidence split; do not double-apply schemes. |
| `REGISTER:N-6` | CDN and cache policy for the larger atlases: immutable hashed filenames.<br>**Original acceptance:** Definition of done not specified in guide; define before implementation. | `open_needs_scoped_verification` | **OPEN** — Verify final hashed-asset/cache/service-worker policy and hosted bytes. The public v32 marker check proves the older baseline, not cache correctness of the unshipped textured candidate. |
| `REGISTER:P-8` | Pipeline fragility: roster gate margin and boss cap (E-8); record drift trends per run.<br>**Original acceptance:** Definition of done not specified in guide; define before implementation. | `open_needs_scoped_verification` | **OPEN** — Track actual pipeline drift trends and boss headroom from canonical A/B runs. Preserve thresholds and failed attempts; do not run blind rerender loops. |

### 4.9 Launch readiness

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `REGISTER:M-1` | Capture pipeline<br>**Original acceptance:** Scripted turntables, combat clips, map flyovers and mobile gameplay in docs/releases/press/. | `open_needs_scoped_verification` | **OPEN** — Produce current-candidate full-HUD captures/combat/mobile/world footage only after relevant acceptance. The original press directory is an output target, not claimed delivered media. |
| `REGISTER:M-2` | Truthful fact sheet<br>**Original acceptance:** Feature matrix generated from manifests with public/local/unimplemented states. | `open_needs_scoped_verification` | **OPEN** — Create a source-backed feature matrix distinguishing public, local, simulated, incomplete and gated states. Native local proof and cache records are not public/official feature completion. |
| `REGISTER:M-3` | Challenge seeds<br>**Original acceptance:** Daily and weekly challenge seeds with seed sharing. | `open_needs_scoped_verification` | **OPEN** — Verify or implement bounded deterministic challenge seeds/sharing under an explicit selected slice. Do not conflate challenge provenance with official settlement or silently drop launch scope. |
| `REGISTER:owner-playtests` | Owner playtests and first-time player sessions<br>**Original acceptance:** Five first-time desktop and five first-time mobile players, screen-recorded. | `human_gate` | **OWNER-GATED / PAUSED** — Retained full-release gate: five first-time desktop and five first-time mobile recorded players, physical devices and owner exact-candidate acceptance. No waiver or results exist in this handoff. |

### 4.10 Web3

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `WEB3:B-1` | Named preparation item in the separate Web3 roadmap, not the same-numbered live defect.<br>**Original acceptance:** Source/test/runbook preparation verified under its exact named scope; no broadcast or settlement action. | `separately_gated` | **PARTIAL** — Keep this separate Web3 placeholder ID. Contract/proposal/custody preparation and a partial legacy readback exist; obtain the exact selected task scope, resolve ABI/RPC/live-approval/dry-run gaps, and preserve separate economic/irreversible approval gates. No guessed ID-to-task mapping. |
| `WEB3:B-2` | Named preparation item in the separate Web3 roadmap, not the same-numbered live defect.<br>**Original acceptance:** Source/test/runbook preparation verified under its exact named scope; no broadcast or settlement action. | `separately_gated` | **PARTIAL** — Keep this separate Web3 placeholder ID. Contract/proposal/custody preparation and a partial legacy readback exist; obtain the exact selected task scope, resolve ABI/RPC/live-approval/dry-run gaps, and preserve separate economic/irreversible approval gates. No guessed ID-to-task mapping. |
| `WEB3:B-3` | Named preparation item in the separate Web3 roadmap, not the same-numbered live defect.<br>**Original acceptance:** Source/test/runbook preparation verified under its exact named scope; no broadcast or settlement action. | `separately_gated` | **PARTIAL** — Keep this separate Web3 placeholder ID. Contract/proposal/custody preparation and a partial legacy readback exist; obtain the exact selected task scope, resolve ABI/RPC/live-approval/dry-run gaps, and preserve separate economic/irreversible approval gates. No guessed ID-to-task mapping. |
| `WEB3:B-4` | Named preparation item in the separate Web3 roadmap, not the same-numbered live defect.<br>**Original acceptance:** Source/test/runbook preparation verified under its exact named scope; no broadcast or settlement action. | `separately_gated` | **PARTIAL** — Keep this separate Web3 placeholder ID. Contract/proposal/custody preparation and a partial legacy readback exist; obtain the exact selected task scope, resolve ABI/RPC/live-approval/dry-run gaps, and preserve separate economic/irreversible approval gates. No guessed ID-to-task mapping. |
| `WEB3:B-5` | Named preparation item in the separate Web3 roadmap, not the same-numbered live defect.<br>**Original acceptance:** Source/test/runbook preparation verified under its exact named scope; no broadcast or settlement action. | `separately_gated` | **PARTIAL** — Keep this separate Web3 placeholder ID. Contract/proposal/custody preparation and a partial legacy readback exist; obtain the exact selected task scope, resolve ABI/RPC/live-approval/dry-run gaps, and preserve separate economic/irreversible approval gates. No guessed ID-to-task mapping. |

### 4.10 STACKED

| ID | Original requirement / original acceptance (historical) | Stored status (historical) | Current disposition / next acceptance |
| --- | --- | --- | --- |
| `STACKED:S-01` | Existing STACKED work-order S-01<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `accepted_not_publicly_playable` | **OWNER-GATED / PAUSED** — Preserve the accepted S-01–S-03 foundation; not publicly playable. STACKED remains paused. |
| `STACKED:S-02` | Existing STACKED work-order S-02<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `accepted_not_publicly_playable` | **OWNER-GATED / PAUSED** — Preserve the accepted S-01–S-03 foundation; not publicly playable. STACKED remains paused. |
| `STACKED:S-03` | Existing STACKED work-order S-03<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `accepted_not_publicly_playable` | **OWNER-GATED / PAUSED** — Preserve the accepted S-01–S-03 foundation; not publicly playable. STACKED remains paused. |
| `STACKED:S-04` | Existing STACKED work-order S-04<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `blocked_policy` | **OWNER-GATED / PAUSED** — Preserve the policy block; no alternate-tool or permission bypass and no implementation without the required owner direction. |
| `STACKED:S-05` | Existing STACKED work-order S-05<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-06` | Existing STACKED work-order S-06<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `isolated_candidate_paused` | **OWNER-GATED / PAUSED** — Preserve the isolated candidate; do not integrate or activate it while STACKED is paused. |
| `STACKED:S-07` | Existing STACKED work-order S-07<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-08` | Existing STACKED work-order S-08<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-09` | Existing STACKED work-order S-09<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-10` | Existing STACKED work-order S-10<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-11` | Existing STACKED work-order S-11<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `isolated_candidate_paused` | **OWNER-GATED / PAUSED** — Preserve the isolated candidate; do not integrate or activate it while STACKED is paused. |
| `STACKED:S-12` | Existing STACKED work-order S-12<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `isolated_candidate_paused` | **OWNER-GATED / PAUSED** — Preserve the isolated candidate; do not integrate or activate it while STACKED is paused. |
| `STACKED:S-13` | Existing STACKED work-order S-13<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-14` | Existing STACKED work-order S-14<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-15` | Existing STACKED work-order S-15<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-16` | Existing STACKED work-order S-16<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-17` | Existing STACKED work-order S-17<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-18` | Existing STACKED work-order S-18<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-19` | Existing STACKED work-order S-19<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-20` | Existing STACKED work-order S-20<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-21` | Existing STACKED work-order S-21<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
| `STACKED:S-22` | Existing STACKED work-order S-22<br>**Original acceptance:** Use only its exact work-order acceptance contract, not HMH task IDs. | `paused` | **OWNER-GATED / PAUSED** — Paused. Do not reactivate, implement or publish this work order without a new applicable scope decision. |
