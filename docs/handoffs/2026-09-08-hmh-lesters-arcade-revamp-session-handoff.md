# Hard Money Heroes + Lester's Arcade: complete revamp session handoff

**Prepared:** 2026-09-08, Pacific time. **Checkpoint captured:** 2026-09-08T17:00:31.438676+00:00.
**Purpose:** give the next session the completed work, unfinished work, source locations, evidence, remaining backlog, and operating boundaries needed to **continue, not restart**.
**Delivery status:** the textured revamp is **locally integrated but NOT release-certified or publicly deployed**. This document is a handoff, not a completion certificate.

## 0. Read this first: the next session's short briefing

1. **Continue the existing worktree:** `C:/Users/just_/Desktop/Projects/lesters-arcade-textured-rollout`, branch `hermes/hmh-textured-rollout`, HEAD `9ce7372021a1b14a5b6910bcd0fa1d7d328d8bef`. Do not start from `main`, clone over it, reset it, or throw away its mixed staged/unstaged/untracked work.
2. **Four native textured heroes already work locally:** Lit Commando, Lit Valkyrie, Lilly, and Lester Original. Each has 648 layered gameplay frames. Native source bindings, weighted/animated derivatives, lossless WebP atlases, and source-matched selectors exist. Do not remodel them or reopen the settled atlas-format decision.
3. **Latest local proof:** four real native-camera probes; genuine selector A/B rendering and `--check`; 163/163 focused Node tests; 20/20 hero/profile machine checks after one preserved unchanged retry; four real-input motion recordings. The minimap is removed locally on desktop and mobile, as requested.
4. **The heroes are not visually accepted:** on tablet and short landscape, fixed HUD/help text obscures heads/torso. Passing body-height metrics and loaded-actor telemetry missed this. Do not shrink the approved models, dismiss the onboarding hint, hide the HUD, or use a canvas-only video to make the proof pass.
5. **Two selector validation gaps are independently reproduced:** corrupted camera-pitch metadata and a private frame with the wrong `actorId` pass the checker. Other current reviewer findings need parent adjudication. The old stale-provenance failures were fixed by real regeneration; they are not these new gaps.
6. **Bagholder Rusher is a private native candidate, not canonical art.** Source, unchanged canonical files, and candidate files are preserved. Current source review raises three P1 concerns. Do not adopt it just to silence failing asset/tests gates.
7. **Current full source gate is blocked:** 2,907 tests, 2,835 pass, 72 fail, 0 skipped. Of those failures, 51 are the existing accepted legacy set and **21 are unexpected**. Inventory, syntax, strict repo health, and ordinary build passed; unified asset QA, release, and security failed. Exact failure names are in Appendix B.
8. **Two narrow decisions remain unanswered:** one additional bounded HUD/validation/integration repair pass, and the protected `AGENTS.md` read-order-only replacement. The previous approved six-item hero hardening pass is finished. This handoff request does not grant another automatic correction pass or permission to retry a protected edit.
9. **Production is older:** direct HTTP readback during this handoff confirmed **41/41** previously recorded public artifacts still match defect runtime `54fd18dc6016a87d616d8238b59f4b1a4c914028`. That is not this textured candidate, and an older public paired-anchor visual certificate remains unresolved.
10. **Continue by dependency:** close the hero gates, finish safe native enemy acceptance/rollout, then reference-backed held weapons, authored ruined-yard world, controls/combat, modeled pickups, FX/audio, portal and launch polish. Keep STACKED paused at accepted S-01–S-03, not publicly playable. Preserve Chikun.

**Efficient entry:** read sections 0–2 and 5–7 first. Read the selected source/evidence files next. Appendix A preserves every one of the 99 namespaced register items; do not spend the new session rereading every old plan before acting on a bounded, authorized slice.

## 1. Owner direction, scope, and non-negotiable boundaries

### What Justin wants

- A finished, polished Hard Money Heroes and Lester's Arcade experience, not another restart or a succession of structural demonstrations.
- Detailed, reference-faithful playable heroes and human/zombie enemies; real textures, native models, rigs, animation, held weapons, and selector/gameplay identity consistency.
- Clear controls and movement, responsive dash/melee/grenades, readable combat and progression, and measured balance.
- An authored textured world, believable terrain/routes/forest depth, a **ruined-yard town conversion**, modeled power-ups, bounded particles/blood/gore, and finished audio.
- No minimap for now on either mobile or desktop.
- Tangible screenshots, recordings, test receipts, working browser paths, and an honest distinction between local, private, and public work.
- Priorities remain heroes, then enemies, then world. The modular world-kit wave follows accepted/public gameplay heroes rather than displacing their release.

### Fixed contracts and safety

- Deterministic PixiJS 2.5D top-down authored run-and-gun. This is **not** an authorization for a Three.js/Unreal/Phaser engine restart or the retired procedural/isometric Canvas direction.
- Fixed **60 Hz**, maximum **four catch-up steps**, same-seed/replay integrity.
- Alias `hmh`; game ID `lester-blaster`; profile `wo71`; save schema `2`; bridge `hmh-bridge/v1`; bridge maximum `65,536` bytes.
- The child owns deterministic gameplay. The parent portal owns wallets, profiles, canonical sessions, official completion, leaderboards, analytics, achievements/Ranked authorization, and settlement. Free Mode must not grant Ranked progress.
- Art, interpolation, sprites, audio, VFX, animation LOD, and quality tiers are projection-only. Art changes cannot silently change collision, damage, AI, spawning, RNG, progression, evidence, or results. Isolate gameplay changes into measured deterministic slices.
- Active combat actors must visibly read as **human survivors or zombies**. No animal, vehicle, robot/mech, or abstract proxy actors. Preserve reference identities and stable IDs; filenames are not permission to invent gameplay IDs.
- Preserve native originals byte-for-byte. Work in explicit derivatives; retain packed-image, mesh, material, action, armature, and semantic provenance. A small or hash-valid file is not automatically a semantically preserved native source. `.blend` files stay source-only, not browser downloads.
- Keep approved density/atlas/reproducibility caps. Do not loosen comparison thresholds, retire new failures, or raise limits to obtain a green report.
- Parent coordinates renderer ownership, canonical asset adoption, builds, serial browser checks, exact-candidate review, and publishing. Independent workers may own disjoint source scopes, not the same generated output folders.

### Authorization interpretation

The owner previously authorized best-judgment game/website work and publishing verified candidates. That does not turn failed certification into permission to publish. The last bounded hero hardening pass returned custody, and the next source-correction/read-order decisions remain pending. Ask only for those unresolved scopes when needed, not for the already-settled H-0, ruined-yard direction, or completed work.

**Web3 correction to old documents:** the owner explicitly lifted the prior blanket halt for wallet/LitVM testnet integration and mainnet preparation. Do not reinstate that historical blanket halt. Resolve the exact selected activity against current authorization. Mainnet deployment, real funds, and irreversible authority changes remain separately approval-gated. `SETTLEMENT_LIVE=false` remains the current source boundary. This documentation task performed no wallet/chain writes and grants none.

Do not change protected `AGENTS.md` through another tool, another path, or a worker to evade the unanswered approval. An earlier checkpoint preface already exists; preserve it. The proposed full read-order replacement is still unapplied. Runtime/security policy is outside that proposed edit.

## 2. Exact source, public deployment, and workspace checkpoint

### Source and remote identity

| Boundary | Verified value |
| --- | --- |
| Active root | `C:/Users/just_/Desktop/Projects/lesters-arcade-textured-rollout` |
| Active branch / local HEAD | `hermes/hmh-textured-rollout` / `9ce7372021a1b14a5b6910bcd0fa1d7d328d8bef` |
| Repository | <https://github.com/kingdankkush/lesters-arcade> |
| Common Git directory | `C:/Users/just_/lesters-arcade/.git` — this is a linked worktree, not a missing repository |
| Rollout remote/upstream | No upstream configured; no matching remote rollout branch returned by `git ls-remote` at capture |
| Remote defect branch | `hermes/hmh-gameplan-defects` at `54fd18dc6016a87d616d8238b59f4b1a4c914028` |
| Remote `main` | `a17c37cd6cb39f74758bb4e9ae0bb56d2a1e07bb` — not the rollout starting point |
| Guide branch | `fable/hmh-open-work-register` at `ab114a64c96a3e56aec7c55a6597c6b118b70cef` |
| Public website | <https://lestersarcade.io> |
| Public HMH | <https://lestersarcade.io/hmh-reboot/index.html> |
| Local portal / HMH | <http://127.0.0.1:8973/> / <http://127.0.0.1:8973/hmh-reboot/index.html> |

**The local HEAD is not the full candidate.** Much of the revamp is uncommitted, with some files newer in the working tree than in the index. A fresh clone of remote `main` or the remote defect branch will not contain it.

At entry, before adding this handoff, the exact porcelain-status categories were:

| Status | Paths at entry |
| --- | --- |
| `M ` | 16 |
| ` M` | 43 |
| `MM` | 12 |
| `A ` | 16 |
| ` D` | 3 |
| `D ` | 1 |
| `??` | 29 |

These are mutually exclusive two-column Git status categories, not a release staging plan. The full path/hash snapshot is `.tmp/team/revamp-session-handoff/source-snapshot.json`. Preserve the existing index; do not use `git add -A`, `git reset --hard`, `git clean`, or broad worktree deletion.

Important local-only material includes the three weighted Valkyrie/Lilly/Lester sources and WebP files, native Bagholder source/provenance, new native/selector helpers and tests, the recovered register, and local evidence. The four removed gameplay PNGs belong to the intended WebP migration; do not restore them blindly or delete their replacements. The existing stage contains only part of the accumulated candidate.

### Public deployment: verified bytes, not a new promotion

- Fresh direct public readback completed at **2026-09-08T17:00:38.101858+00:00**: 41 distinct artifacts, 41 matches against the recorded defect build. HTTP GETs read the actual public responses; no request fulfillment/interception was used.
- Recorded defect runtime: `54fd18dc6016a87d616d8238b59f4b1a4c914028`.
- Recorded production deployment: `dpl_DBodNtqBWjYzT87FcwgTLCRJy3xs`.
- Recorded immutable production: <https://lesters-arcade-c496423zz-justin-agent-projects.vercel.app>.
- Recorded preview: `dpl_7LiydAkiTfHdDRQURRq19FYmeDev`.
- Retained immediate rollback: `dpl_HskTDVZr72FVDUD7zHnZTHRCtmCx`, Cycle 080.
- Deployment IDs are taken from the deployment checkpoint; the deployment API was not freshly queried during this documentation pass. Recheck Vercel/current aliases before a later promotion.
- The public child entry is 467,128 bytes, SHA-256 `838e141a04055ccb43eb8a93c874a83474a799e22b650703a827c87ed06602a2`.
- The local served child entry is 469,898 bytes, SHA-256 `367ba4d76035d0d934e264d15f0d4e3fd6049b038b1358b57758b4510db72db9`. Local HTML and this entry were freshly matched against disk.
- **No complete Cycle 081 public visual certificate:** the older paired-anchor oracle repeatedly/intermittently reports 601 changed pixels, maximum channel delta 1, at a faint upgrade-panel shadow edge; a recorded desktop rectangle is `(206,667)-(230,775)`. No threshold was relaxed. A byte match, feature-specific public check, or isolated matching pair does not resolve the full public matrix.

Deployment evidence lives in sibling `C:/Users/just_/Desktop/Projects/lesters-arcade-gameplan-defects/docs/handoffs/hmh-gameplan-defect-deployment-checkpoint.md` and that worktree's `C:/Users/just_/Desktop/Projects/lesters-arcade-gameplan-defects/.tmp/gameplan/` receipts.

### Worktree and process custody

- **Active integration:** the textured-rollout root above. Do not integrate in the common root just because it holds `.git`.
- **Deployed-defect/evidence sibling:** `C:/Users/just_/Desktop/Projects/lesters-arcade-gameplan-defects`, local HEAD also `9ce7372021a1b14a5b6910bcd0fa1d7d328d8bef`; remote/runtime boundary is older.
- Preserve source/prototype worktrees `C:/Users/just_/Desktop/Projects/lesters-arcade-cycle078-rig-pilot` and `C:/Users/just_/Desktop/Projects/lesters-arcade-cycle081-tripo-gameplay`.
- Withheld pacing work survives in `C:/Users/just_/Desktop/Projects/lesters-arcade-cycle079-encounter-pacing` and `C:/Users/just_/Desktop/Projects/lesters-arcade-cycle079-live-integration`.
- The exact guide checkout is `C:/Users/just_/lesters-arcade-review080`. All worktree paths/heads are captured in the source snapshot; do not infer that a worktree is safe to remove from an old name.
- One TCP listener on `127.0.0.1:8973` was confirmed, PID `31364`, serving the active root's `apps/portal`. A Python wrapper process PID `30532` also exists; it is not a second socket listener. No matching HMH generator/reviewer appeared in the filtered process scan. This is a point-in-time observation, not a permanent guarantee.
- No server was started/stopped and no render, repair, commit, push, or deployment was launched for this handoff. Recheck OS ownership before taking over any lane; restored process IDs and delayed notices are not sufficient.

## 3. Completed foundations: preserve rather than rebuild

These are existing source/shipped foundations, reconciled from the guide and release checkpoints. They are not claims that every foundation was freshly played through during this documentation pass.

### Existing HMH and portal architecture

- The active game is a substantial deterministic authored game, not an empty shell: movement/dash/elevation/collision, combat, weapon upgrades, seeded drafts/XP, encounter bands, boss phases, performance profiles, accessibility, and parent-owned run authority exist.
- Source Level 1 is **Crypto Wasteland: Forked Frontier**, 12,000 × 4,800, with the six districts below. It has 6 arenas, 10 POIs, 8 destructible definitions, 5 hazard definitions, and 3 explosive-zone definitions. **Data definitions do not prove every interaction is fully consumed at runtime.**
- Parent source supplies profile/session rails, cadence leaderboards, persistence/provenance, wallet UI and chain-client boundaries, cabinet routing, achievements, audio transport, and sandbox/SDK integration. Local/simulated rails must not be advertised as verified paid settlement.
- Chikun's Escape is the shipped `0.5.0` vertical slice, publicly playable and Ranked-eligible, with deterministic parent replay/SDK boundaries. Daily UTC course seeds, local same-seed ghost, and replay viewer are projection-only. Preserve it; do not restore the vaulted original React/Supabase game. Creator-art commercial/modification/hosting/redistribution rights remain a separate unresolved owner/legal matter; `devWallet` and paid-entry/third-party settlement are not completed by gameplay certification.

| District ID | Name |
| --- | --- |
| `frontier-relay` | Frontier Relay |
| `rugpull-ravine` | Rugpull Ravine |
| `liquidity-crossing` | Liquidity Crossing |
| `hashwood` | Hashwood |
| `mining-camp` | Mining Camp |
| `liquidation-yard` | Liquidation Yard |

### Shipped visual/game-feel foundations through Cycles 072–080

- Lit micro-terrain, removal of the visible tile grid, road shoulders, shore/scree/shallows transitions, contact shadows, ground decals, cliff/ledge/ramp presentation, composed landmarks, and authored camps/yards already exist.
- The guide records 402 authored placements, twelve spawn-point camps, three fenced yards, and deterministic district atmosphere: fog, dust, mist, pollen, embers, and grading. These are a foundation for the requested textured overhaul, not proof the current world is final AAA art.
- EEVEE-relit procedural enemy roster, wider role tells, silhouette accents, elite treatment, and corpse projection lifetime exist. A native textured replacement is a separate open track.
- Per-weapon muzzle/tracer/casing/surface impacts, grenade feedback, dash landing/afterimage, hit smear, level-up/pickup feedback, reduced-motion/flash behavior, pool sharing, and audio-voice cleanup already shipped in their respective slices.
- DOM cockpit HUD, opt-in developer telemetry, tiered upgrade cards, keyboard/gamepad selection, SFX volume, existing weapon cues, and parent-owned pause music transport exist.
- Encounter pressure is decoupled from render zoom. External-model import, waist split/look-dev/schema infrastructure, packed textures, LFS policy, chunked nav readiness, honest shared-chunk accounting, trimmed Pixi vendor, and deterministic helpers exist.
- Cycle 077's textured Tripo selector turntables, comparison chips, keyboard navigation, and reduced-motion support shipped. The **new locally regenerated selectors** now use gameplay sources and are not yet public.

### Later defect-fix slice already deployed, with partial certification

The public defect slice contains:

- B-1: truthful touch-specific hint copy.
- B-2: touch hint docking for the then-current hero/layout.
- B-3: homepage ad-strip/cabinet containment.
- B-4: Hashwood tour-spawn clearance, specifically tour spawn `(7350,800)`; not a whole-world/collision redesign.
- B-7: empty-combo wording.
- K-8: bounded first-use touch onboarding respecting reduced motion.
- N-7: curated runtime source-inventory guards.

Its recorded clean no-Git/pointer-only host build used real Node 24.20.0. The recorded release ledger was 2,717 evaluated / 2,666 passing / 51 accepted legacy failures / zero unexpected or skipped tests. Public bytes and affected functional behavior were verified; the paired-anchor gate above prevents claiming full certification.

**Do not resurrect B-2 as an untouched old bug:** its old fix is shipped, while larger native heroes now reveal an additional tablet/landscape composition gap that needs new coverage.

### Timeline that prevents stale-guide restarts

| Stage | What happened | Current interpretation |
| --- | --- | --- |
| Through Cycle 074 | Authored-world, art, atmosphere, UI/audio, determinism and release foundations | Preserve; roadmap's old unchecked boxes were stale |
| Cycle 075 | Reference/LFS and pipeline/fallback/accessibility foundations | Preserve |
| Cycle 077 | Textured Tripo selector turntables | Public foundation; new source-matched selector is local |
| Cycle 078 / old Cycle 081 prototype tree | Native Commando prototype and DCC/source work | Preserve as source history; not the current integration root |
| Cycle 079 | Pacing/combat candidate withheld on two burn-provenance findings | Unaccepted; reconcile deliberately, not wholesale cherry-pick |
| Cycle 080 | Corpse lifetime and audio cleanup | Shipped; do not reapply from old candidate |
| Defect runtime `54fd18dc` | Visible defect/onboarding/inventory slice | Public, partial certification |
| Local HEAD `9ce73720` | Identity/copy correction boundary | Local continuation base, not public runtime |
| Textured rollout | Four native heroes, source-backed selectors, minimap removal, source/QA hardening, private Bagholder | Accumulated local candidate, blocked release |
| Latest verification | Native cameras, genuine selector regeneration, current machine/motion evidence, concrete blocker diagnosis | Preserve receipts; no new publication |
| This handoff | Fresh source/remote/public-byte/local-byte reconciliation and complete continuation document | Documentation only |

## 4. Work completed locally in the textured revamp

### 4.1 Four reference-faithful native heroes

| Hero / stable ID | Frame size | Layered frames | Atlas bytes | Status |
| --- | --- | --- | --- | --- |
| lit-commando | 256 × 256 | 648 | 3,919,100 | Local native; release blocked |
| lit-valkyrie | 256 × 256 | 648 | 3,981,640 | Local native; release blocked |
| lester-original | 224 × 224 | 648 | 3,979,950 | Local native; release blocked |
| lilly | 216 × 216 | 648 | 3,915,898 | Local native; release blocked |

**Total:** 2,592 frames; 15,796,588 atlas bytes across 4 heroes. Gameplay atlases are exact lossless WebP. Approved caps are **4,194,304 bytes per hero**, **16,777,216 bytes combined**, and **2048 maximum atlas dimension**. These are texture-transfer budgets, not a measurement of initial selected-hero transfer, decoded GPU memory, or total game size.

- Existing originals and source identities were reconciled, including Commando's swept-fringe/mullet rather than the incorrect dark-mohawk copy, Valkyrie side/accessory details, Lilly coat/trim/buckle identity, and Lester's sphere-head/expression identity. Reference authority is `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`.
- Gameplay sources are packed-textured native Blender derivatives, not the old primitive bodies. Nine action families are represented: `idle`, `run`, `aim`, `pistol-fire`, `hurt`, `dash`, `melee`, `grenade`, `death`, across eight directions and layered shadow/lower-body/torso-head/weapon composition.
- Native weights/action transfer and source-preservation work exist; Lilly's 24-bone/coattail rig is retained. Retain the immutable original/native vault and the weighted derivatives rather than replacing them with a newly generated lookalike.
- Density/packing was iterated to fit caps without increasing them: Commando/Valkyrie 256 px, Lester 224 px, Lilly 216 px. Their lower frame dimensions are deliberate accepted budget choices, not missing renders.
- Runtime texture/metadata loading, trimmed-frame handling, calibrated grounding/pivots, visibility/fallback guards, projection scale, and native pistol/melee/grenade support were integrated locally. All weapon-slot models are **not** thereby complete.
- Only authored hidden grenade samples **3 and 4 of a five-sample non-looping weapon clip** qualify for the release-visibility exemption. Do not generalize that exception to arbitrary blank frames.
- Four gameplay-source hashes, eight approved hardening-source hashes, and six generated-selector output hashes were freshly rechecked for this handoff. The prior immutable-original preservation proofs remain part of the source evidence; a hash check is not new animation certification.

#### Exact gameplay-source derivatives (read-only source custody)

- **lit-commando**: `apps/hmh-reboot/assets/source/models/tripo-gameplay/Lit Commando - Layered Gameplay Pilot v2.blend`
  - SHA-256: `0c930374daccb2b9458a8600fdf3150dc51f6b5d8b4a47edcd05d92905fc6284`
  - Native armature: `HMH_TripoCommandoRig`; packed textures: 12; source classification: `packed-textured-blend`.

- **lit-valkyrie**: `apps/hmh-reboot/assets/source/models/tripo-gameplay/Lit Valkyrie - Weighted Gameplay compact-v2.blend`
  - SHA-256: `f090f2e2a387f8ee3c2666bed1af22344f6ec82b1695bc62f1d18f1cfb8268ec`
  - Native armature: `HMH_TripoRig_lit-valkyrie`; packed textures: 12; source classification: `packed-textured-blend`.

- **lester-original**: `apps/hmh-reboot/assets/source/models/tripo-gameplay/Lester Original - Weighted Gameplay compact-v2.blend`
  - SHA-256: `ed1278ea131927f9849fb62f265512a8547186fb9b9c06b08da78fb438eacc96`
  - Native armature: `HMH_TripoRig_lester-original`; packed textures: 12; source classification: `packed-textured-blend`.

- **lilly**: `apps/hmh-reboot/assets/source/models/tripo-gameplay/Lilly - Weighted Gameplay compact-v2.blend`
  - SHA-256: `5f9152e713f7c4f79e96d1f1a4415dd1fb96a2685d3d14f22a65e895c8e7d6b2`
  - Native armature: `HMH_TripoRig_lilly`; packed textures: 12; source classification: `packed-textured-blend`.

### 4.2 Selectors and completed six-item source hardening

The owner-approved six-item CPU-only hardening pass completed these source changes:

1. Operand-scaled floating-point comparison tolerance for logical pivots, without rewriting authored coordinates or weakening integer raster/bounds guards.
2. Private A/B drift-report routing into the active candidate capsule rather than contaminating canonical reports.
3. Direct exporter destination preflight before mkdir, dynamic source loading, or scene work; traversal/junction/alias guards and coupled run-a/run-b paths.
4. Optical camera-pitch measurement using the evaluated camera's optical `-Z` against downward world `Z`, not an Euler-label guess.
5. Private selector quality/layout/format/cap checks, including negative type-confused-budget, fake PNG/WebP, and padded-dimension cases.
6. Runner path and raw-byte SHA-256 included in producer provenance, so runner-only changes invalidate a stale output.

The worker's final file predates the parent's native execution. **Parent follow-up is already done:** all four native camera probes passed the 55-degree optical-axis contract without source writes; genuine canonical selector A/B and `--check` passed; six output hashes and current producers match. Do not rerun this merely because a worker final still says "parent pending."

Selectors have 32 total directional frames. They retain 384 px, 4×2 per-hero PNG layouts, 524,288 bytes per hero / 2,097,152 total selector-image caps, and unchanged 8 / 2 / 32 reproducibility limits. Actual A/B was **not bit-identical**: observed maximum 1 changed visible pixel / 1 channel delta / 1 total delta, with 3 drifted frames. That passed the existing limits.

The two earlier stale-provenance failures are resolved by genuine generation, not edited hashes. Separate corrupted-metadata acceptance gaps remain in section 5.

### 4.3 Current browser and motion evidence

- Four heroes × desktop, ultrawide, tablet, mobile portrait, and mobile landscape: **20/20 machine checks** on the current candidate.
- First attempt yielded 15 completed profiles; Valkyrie stopped on a terrain PNG request with `ERR_NO_BUFFER_SPACE`. One **unchanged isolated retry** passed Valkyrie's five profiles. Original exit 1 and original log are retained, not erased.
- Sixteen served artifacts matched current local bytes; cache was disabled, service workers blocked, and the exact candidate entry was observed per page.
- Minimum measured native-body height was **14.512%** of viewport height, above the 12% requirement. That measures projected size, not unobstructed visible body area.
- Twenty full-HUD captures were inspected. Desktop, ultrawide, and portrait showed native bodies; tablet and short landscape had blocking HUD/help overlap.
- Four real keyboard/mouse movement/firing recordings were authenticated and decoded. All six run frames were observed for each hero. Ordered temporal samples show pose changes and travel, but some crops cut off feet. Preserve full videos. This is not exhaustive nine-clip/eight-direction animation, touch/gamepad, sustained-performance, or endurance certification.
- Minimap display/reserved footprint was removed locally and its absence checked across the current captures. Do not confuse this requested removal with deleting authoritative world/exploration data.

### 4.4 Documentation and guidance reconciliation

- Claude's open-work guide and gameplan were recovered from exact Git bytes at `ab114a64c96a3e56aec7c55a6597c6b118b70cef`; no branch/source merge was performed.
- The current guide's claims that H-0 is undecided or that gameplay has zero `sourceModel` entries are superseded by the actual local candidate.
- Roadmap sequencing was reconciled against shipped work; the retired Canvas-era release checklist is labeled superseded; STACKED's stale "nothing built" header was corrected.
- The prior 61-ID gameplan reconciliation and the later **99-item namespaced register** are different source inventories, not contradictory totals. Appendix A preserves the entire later register and overlays newer evidence.
- `AGENTS.md` has an earlier checkpoint preface, but its full protected read-order replacement remains pending. Do not claim the whole file is unchanged.

## 5. Work started but blocked: exact handback state

### 5.1 Hero/HUD composition

**Confirmed:** tablet and short-landscape fixed HUD/help strip hides upper bodies. Current CPU/body-size checks do not test visible opaque body against overlay geometry.

Likely source seam: `apps/portal/hmh-reboot/styles.css`, `apps/portal/hmh-reboot/index.html`, `apps/hmh-reboot/src/main.mjs`, `apps/hmh-reboot/src/world-space.mjs`, and `scripts/hmh-reboot-production-hero-browser-smoke.mjs`.

Required next acceptance: normal first frame with first-use hint present; body-versus-fixed-overlay geometry; full-HUD screenshots at the five profiles; unobstructed hero readability without shrinking source-approved actors; canonical fresh-player homepage/selector/gameplay flow; fallback and touch regressions. A pilot query and a pre-granted hero do not prove ordinary unlock/selector reachability.

### 5.2 Selector and runtime reviews

All three current review packets/events/source hashes were authenticated. They are **raw BLOCKED reviews**, not parent-adjudicated acceptance. The reviewers were given limited immutable source snapshots and did not execute native art/browser/release gates. Their old prose about pending selector regeneration is stale; retain concrete findings, not that obsolete execution status.

| Finding | Evidence status | Next action after authorization |
| --- | --- | --- |
| Selector `--check` accepts metadata `render.cameraPitchDegrees` changed from 55 to 35 | **Parent reproduced** in disposable CPU fixture | Add RED coverage for immutable render-record consistency, then reject corruption without manually changing canonical evidence |
| Private selector frame accepts wrong `actorId` while retaining another hero's `portalHeroId` | **Parent reproduced** in disposable CPU fixture | Require exact frame ownership/binding with negative capsule coverage |
| Private selector module may reference canonical `publicUrlBase` instead of its capsule images | Reviewer P2; not yet parent-adjudicated | Trace private serving/mount contract and reproduce a real wrong-image consumer before deciding the repair |
| `opaquePixels` permits impossible values such as negative/fractional/over-area numbers | Runtime reviewer P2; not yet parent-adjudicated | Validate contract/reachability and create a non-vacuous counterexample |
| Exposed `frameByKey` / `clipByKey` Maps can be mutated after frozen index validation | Runtime reviewer P2; not yet parent-adjudicated | Trace actual consumers and the validation/display lifetime; do not call a search hit or absence an exploit or a PASS |

Relevant implementation: `apps/hmh-reboot/src/production-hero-atlas.mjs`, `scripts/run-hmh-hero-selector-render.py`, `scripts/hmh_selector_native_sources.py`, `scripts/hmh-blender/export-hmh-hero-selector.py`. Counterexamples and review handles are in section 9.

### 5.3 Native Bagholder and broader enemy production

- Bagholder's role-bound packed native source, exporter/QA/runtime adapter, semantic/provenance receipts, and corrected private candidate exist. Canonical enemy atlases remain unchanged.
- A too-large private presentation was corrected using a **0.50 art-only scale**, not collision changes. Final mobile/collision/readability acceptance is still absent.
- An actual native hit probe found the peak at source frame **12**. The old `1,25` samples missed it; the corrected candidate samples are **12,25**. Preserve native action/cadence authority and test that both peak/recovery are visible inside the real short hit window.
- The adoption packet inventories **23 source files, 22 unchanged canonical files, and 4 candidate files**. All three groups were freshly hash-matched during handoff preparation. Those matches are conservation evidence, not approval to adopt.
- The private atlas PNG is 1,622,277 bytes. The packet's ready-to-adopt payload comprises atlas JSON, atlas PNG, contact sheet, and combined roster metrics. Its exact source→target mapping is in `.tmp/team/bagholder-correction/adoption-packet.json`.
- Older parent preflight scope was 55/55 Node checks plus 12 nested Python cases, distinct from a worker's broader 64-case result. Keep scopes distinct; do not add nested tests twice.
- Earlier frozen runtime PASS and older four-finding pipeline BLOCKED reviews refer to old snapshots. Current source changed and has its own review below.

**Current enemy-pipeline review reports three P1 gaps, not yet parent-reproduced/adjudicated:**

1. Native candidate path can trust an executable shim/process exit without independently enforcing Blender version/execution/export-report truth, then claim native cold opens.
2. Swapping `clipActions.hit` and `clipActions.tell` can preserve key sets/action-name sets while breaking exact state-to-native-action/sample ownership.
3. A rehashed, reduced semantic preservation proof can omit actions/materials/images/meshes while the checker validates selected labels and supplied hashes rather than full semantic coverage.

Next: bounded parent counterexamples and source-contract adjudication; authorized RED/GREEN fixes if required; genuine current native A/B/export-report proof; role/collision/hit/mobile/full-HUD acceptance; only then parent-controlled adoption and canonical/full-suite QA. Never forge export reports, trust a producer's self-report alone, or widen drift limits.

Other role/boss source work remains unfinished or unaccepted. Do not create a third competing enemy pipeline or infer a complete native roster from this one pilot.

### 5.4 Full integration/security/release gate

Latest recorded full run is summarized below; its seven log hashes were freshly authenticated. It was **not rerun during this documentation task**.

| Gate | Recorded result | Log |
| --- | --- | --- |
| inventory | PASS | `.tmp/team/hero-native-final/gates/inventory.log` |
| asset-qa | FAIL (exit 1) | `.tmp/team/hero-native-final/gates/asset-qa.log` |
| check | PASS | `.tmp/team/hero-native-final/gates/check.log` |
| release | FAIL (exit 1) | `.tmp/team/hero-native-final/gates/release.log` |
| security | FAIL (exit 1) | `.tmp/team/hero-native-final/gates/security.log` |
| health | PASS | `.tmp/team/hero-native-final/gates/health.log` |
| build | PASS | `.tmp/team/hero-native-final/gates/build.log` |

- Release: **2,907 total / 2,835 pass / 72 fail / 0 skipped / 0 cancelled / 0 todo**. Exactly **51 expected retired** failures and **21 unexpected** failures; see Appendix B.
- Asset QA rejects old canonical Bagholder metadata under the new native contract. This source/generated-art mismatch is real, but adopting unaccepted art is not a legitimate shortcut.
<!-- Security note: the dynamic-evaluation name below quotes an existing test finding; it is not executable code in this document. -->
- Security scanner flags `new Function` in `tests/hmh-reboot-enemy-roster-atlas.test.mjs` (recorded line 359). This is a test-harness dynamic-evaluation finding, not proof of a deployed exploit. Replace the test approach through the approved repair scope rather than weakening the scanner.
- Other failures include protected agent read order, the removed-minimap assertion, missing unlockable metadata contract, and legacy Lester/Lilly evidence frame expectations. Trace the actual intended contract before updating tests or outputs. Do not restore the minimap against the owner's request or change expected counts solely to match stale artifacts.
- The ordinary Node build passed. **Current no-Git/pointer-only host parity, exact-index release review, full current visual/fresh-player flow, active-combat performance/endurance, and deployment/rollback/public recertification have not passed.**
- Recorded build accounting: HMH entry plus vendor **933,013 bytes**; plus the two statically imported shared chunks **999,522 bytes**. Report the shared import closure, not just the named entry/vendor. The old guide's approximately 994,000-byte figure is historical.
- Recorded strict health gate passed with approximately 306 MB tracked and 2.4 GB expanded working tree under its exclusions. Those are different scopes. The old 405 MB/350 MB story is not the current gate result. Clean-host/LFS/source-vault portability still needs proof; do not delete originals to improve a number.

## 6. All remaining program tracks and their acceptance bars

Appendix A contains every register ID. This section explains the work as deliverable packages rather than implying every old checkbox is untouched.

### A. Finish and certify the native hero slice

Close section 5's approved repair scope; adjudicate reviews; keep identity/native sources intact; inspect all action families, direction changes, feet/grounding, held objects and waist rotation; verify transparent atlases and fallback; measure selected-hero transfer, decode, GPU memory and startup; complete ordinary selector/unlock/fresh-player flows; certify desktop/mobile performance and release.

**Done means:** visible skinned deformation/running weight at gameplay zoom, body at least 12% of viewport height and unobscured, identity matches selector, no unexplained blank frames or grounding drift, full current gates pass, and public deployment contains the accepted bytes.

### B. Enemy roster and Liquidator

| Role ID | Name | Role / form |
| --- | --- | --- |
| `bagholder-rusher` | Bagholder Rusher | rusher / zombie |
| `forkrunner` | Forkrunner | flanker / human |
| `liquidator-agent` | Liquidator Agent | suppressor / human |
| `whale-enforcer` | Whale Enforcer | bruiser / human |
| `gas-bomber` | Gas Bomber | demolition / human |
| `validator-cultist` | Validator Cultist | support / zombie |

Preserve each role's existing simulation identity/AI/collision while replacing presentation. Finish Bagholder first, then the other roles through the same native pipeline. Resolve input/reference availability from the actual source vault before asking for already-supplied assets.

Remaining: silhouette-only grayscale differentiation across the six roles, source-backed idle/run/tell/attack/hit/death, measured tell-to-hit windows at gameplay zoom, native hit reaction during actual damage windows, ordinary human-scale parity, elite distinction, boss phase presentation and drift/cap headroom. Liquidator phases are `market-open`, `margin-call`, `total-liquidation`; make them visibly distinct. Boss gameplay depth needs the G-1 benchmark before counter/add-wave/arena tuning. Old boss-atlas 96.6% occupancy and 7-of-8 drift margin are historical warnings to remeasure, not current proof.

### C. Held weapons, grenades, and modeled power-ups

Existing live source has these **eight weapon definitions**. Their simulation existence does not mean the new reference-backed held art is complete:

| Stable ID | Display name / title | Authoritative type |
| --- | --- | --- |
| `coin-blaster` | Pistol / The Settler | projectile |
| `scatter-shotgun` | Shotgun / The Block Breaker | projectile |
| `auto-miner` | Machine Gun / The Hashstorm | projectile |
| `hash-rail` | Rail Gun | projectile |
| `lightning-ledger` | Lightning Ledger / The Lightning Ledger | channel |
| `bear-market-burner` | Flame Projector / Bear Market Burner | flame-channel |
| `forked-standard` | Forked Standard / The Forked Standard | melee-alternating |
| `launcher-rig` | Grenade Launcher / Launcher Rig | grenade-launch |

Prioritize the canonical Digit 1–4 family: pistol, shotgun, auto-miner, launcher. Continue existing native pistol/knife/grenade source work rather than restarting it. Use the eleven committed weapon reference PNGs and preserve original IDs.

For each uncovered held weapon: native mesh/material, hand fit, socket, muzzle origin, direction/torso alignment, recoil/recovery, projectile/impact identity, pickup/icon, and sound family. Verify all eight facing directions and ordinary acquisition/selection. Do not alias a pickup badge as a finished held weapon.

Replace badge-like power-ups with readable modeled objects and emissive accents while retaining existing fixed-tick pickup/buff authority, bob, reset, single-use and cap behavior. Preserve grenade detach/release/landing semantics.

For future weapon *mechanic* expansion, use one vertical slice per weapon: tactical role plus weakness; bounded fixed-tick ammo/heat/charge/target logic; three branches × three tiers and capstone where the existing tree contract applies; run-summary/catalog fields; licensed/source-owned art/audio; accessibility and particle/audio caps; seeded static/moving/swarm/boss benchmarks; real-input browser proof. Do not silently expand mechanics merely to finish art.

### D. Authored textured world and level design

- Owner chose converting the existing yard into a ruined town, **not adding a seventh district**. Preserve world size/elevation/collision authority and canonical traversal routes.
- Build authored Blender kits for town, camp, industrial areas and bridges, with shared grid/pivots/collision proxies and source-owned textures/materials. Replace the remaining generic/procedural prop quality ceiling without removing existing authored places.
- Add depth to Hashwood's flat canopy band; break foliage into clusters. Vary yard slabs/cracks/stains. Improve grounded terrain, roads, crossings, forest sightlines, lighting, shadows, visible boundaries, landmark compositions, and quiet/dense beats.
- Native trees/boulders/wrecks/stumps/debris: inventory supplied/approved sources first. Any new paid service or external upload is a separate permission/cost decision.
- Reconcile destructible cover, caches/medbay, hazard/area-slow/damage zones, explosive chains, and extraction-objective consumers against current source before building them. Older roadmaps can describe data that later slices already implemented. A data hook alone is not an interactive mechanic.
- Verticality beyond projection, secrets/lore/destructible caches and ledge rewards require deterministic authority, bounded collision/traversal, and acceptance. Do not change elevation while making an art-only pass.
- Preserve load-bearing mining/ravine tour spawns used by collectible tests; add a new tour ID instead of moving them. Hashwood's separately corrected tour point is not permission to relocate all tours.
- Level 2 remains dependency-ordered behind complete Level 1 acceptance. Future campaign concepts must be reconciled to human/zombie canon before becoming runtime actors.

### E. Controls, movement, combat, balance, and progression

- Reconcile withheld G-7/Cycle 079 onto the current boundary: automatic defeat-spread must not burn neutral nearby actors before damage filtering; automatic refresh must not downgrade a manually initiated burn's causal origin. Preserve the already-shipped corpse/audio work and current cache markers.
- G-1/G-6: canonical swarm/weapon/boss and long-run benchmark, clear time, overkill, projectile pressure, survival and TTK. Use actual live authority, stable seed/tick ordering and 60/30/20 partition equality, not a second simulation engine.
- Measure movement latency, acceleration/deceleration, diagonal normalization, reversal, camera behavior and aim across keyboard, gamepad and touch before tuning. Buffer dash/action edges and improve forgiveness without bypassing collision/elevation rules.
- Resolve melee's real reachable touch role or explicitly retire it by decision. Audit/expose every active action binding; then finish parent-persisted rebinds, aim assist, stick sensitivity and left-handed touch layouts where actually missing.
- Recheck upgrade/progression balance, category/repeatable caps and dead/dominated choices from telemetry. Keep canonical bounded run-summary fields current before profile/build-history expansion. Distinguish shot/trigger accuracy from projectile/pellet accuracy and attribute kills to the actual damage source.

### F. UI, portal, profile, data, and onboarding

- Finish native-hero HUD/help clearance, narrow arsenal strip/long-label containment, readable first upgrade, pause controls/settings truth, death/run-summary/replay flow, keyboard/gamepad focus and accessible touch actions.
- Preserve the existing ad-strip/touch-copy/combo/onboarding fixes, and keep no developer text without an explicit debug flag.
- Prove homepage-to-running-game within three clicks through the real parent/selector path; direct child pilots alone do not satisfy this.
- Source-separated/clearly labeled leaderboard data; owner decision on seeded House scores and unplayable banner-only cabinets. Do not market local or seeded scores as live competitive proof.
- Profile command center after canonical run-stat schema: role/weapon kills, accuracy, build history. Achievements need dates, progress meters and accessible tooltips.
- Key art should be rerendered from accepted native gameplay heroes so portal and game match. Trust/privacy/terms/support/accessibility/testnet copy requires exact owner/legal approval.
- Parent-owned privacy-conscious funnel telemetry; internal balance reports under `docs/qa/`. Do not place private keys, wallet tokens or per-hit unbounded histories into bridge/run-summary payloads.

### G. VFX, particles, blood/gore, lighting, and audio

Existing pooled combat/atmosphere/corpse/audio systems are the base. Finish missing impacts, enemy damage/death readability, particles/blood/gore, campfire light/embers, world reactions and ambience. Keep projection-only pools, visibility culling, strict budgets and reduced-motion/flash/gore settings genuinely connected to live consumers.

Audio direction is already recorded: repository-owned synthesis or approved licensed sources, **no new spending**. Inventory shipped cues first; add missing terrain footsteps, reload/empty/impact variations, enemy/boss cues and UI feedback with license provenance. Preserve parent music transport and voice cleanup. Record a measured category LUFS/mix/ducking pass; do not claim audio complete because cue IDs are registered.

### H. Platform, performance, launch, and release operations

- Preserve curated source inventory tests and regenerate inventory when portal modules change.
- Finish per-profile isolation and hero-crop/full-body/overlay checks in canonical visual regression, not only private pilot scripts.
- Profile atmosphere first-fill/p99 and mobile decode/GPU/heap. Distinguish tracked repository budget, expanded DCC vault, deployed payload and initial JS closure. Maintain target performance, total-game payload and concurrent-enemy goals; never count an unloaded menu as an active-combat soak.
- Only measured need justifies further child/shared/debug splitting. Parent route cleanup is not automatically HMH child headroom.
- Improve immutable/cache policy for larger atlases; coordinate service-worker and all current version markers. Discover current token consumers rather than copying Cycle 079/080/081 strings from an old handoff.
- Legacy asset retirement needs a keep/retire decision and proof no active references. Preserve originals and unique candidate work before cleanup.
- Launch needs truthful feature/capture materials, press gameplay/turntables/world/mobile clips, daily/weekly challenge/seed sharing where missing, and actual owner plus first-time human playtests: five desktop and five mobile. Automated profiles are not human acceptance.

### I. Web3 and mainnet preparation

Current configuration is LitVM LiteForge public testnet, chain ID `4441` / `0x1159`, token `zkLTC`:

- RPC: <https://liteforge.rpc.caldera.xyz/http>
- WebSocket: `wss://liteforge.rpc.caldera.xyz/ws`
- Explorer: <https://liteforge.explorer.caldera.xyz>
- Faucet/hub: <https://liteforge.hub.caldera.xyz>
- Testnet portal: <https://testnet.litvm.com>

These URLs/IDs were read from current configuration, **not freshly RPC-certified**. No chain-functionality or transaction claim is made here.

Read `apps/portal/src/arcade-core.mjs`, `apps/portal/src/litvm-chain-client.mjs`, `apps/portal/src/settlement.mjs`, `contracts/deployment-record.json`, and `docs/web3/hardened-ranked-deployment-manifest.json` separately. The deployment record is a June legacy record; the hardened manifest is `UNSIGNED_DRY_RUN`, not a deployment receipt. Do not reuse stale nonces/predicted addresses as live truth or copy unsigned calldata into an automatic broadcast.

Older audits record a legacy/hardened score-ABI mismatch, hardened addresses not deployed at that observation, and a missing trusted attestation producer. Those are **historical unclosed findings requiring current read-only verification**, not newly observed RPC results. Local canonical sessions, cache fallback, simulated receipts, and an attestation consumer do not prove a trusted producer or end-to-end Ranked publication.

Remaining: contract checks/tests/static analysis; GameRegistry approval gates; SplitConfig proposal; verifier custody/rotation/runbook; dry-run/deployment preparation; real-provider connect/reject/reconnect; current bytecode/ABI reads; attestation production; canonical score/profile/leaderboard readback; anti-tamper/deduplication; monitoring/pause/refund/security/economic/legal gates. Apply the current wallet/testnet authorization and the separate mainnet/funds/authority gates in section 1. Do not let the old blanket-HALT prose override newer owner direction.

### J. STACKED and other cabinets

- STACKED S-01/S-02/S-03 source/security work is accepted and in the deployed lineage, **not a public playable cabinet**.
- S-04 is policy-blocked before implementation. Do not retry denied commands/patches or change permissions. Owner direction is required.
- S-06 portal candidate and S-11/S-12 shell/renderer candidates exist in isolation. They are prepared, not integrated/accepted as a public game. Actual compositor pixels/tests do not close shell, viewport, human-device or launch gates.
- Other STACKED cycles remain paused/pending as enumerated in Appendix A. Preserve approved Free/Ranked art originals and partial candidates; no new art completion is inferred.
- Do not divert the HMH hero release budget into STACKED. If the owner later reopens it, read `docs/stacked/STATUS.md`, the exact cycle in `docs/stacked/STACKED-CYCLES.md`, and the isolated work ownership. Do not restart accepted core work from historical "nothing built" prose.

## 7. Concrete continuation sequence

### Step 1: reconcile without rewriting

Check current root/branch/HEAD, index and untracked files, source/generated hash receipts, remote heads, public alias, and OS lane ownership. Read the top of this handoff and the exact current review/counterexample/gate files. If another session changed the candidate, reconcile rather than restoring this snapshot over it.

### Step 2: resolve only the outstanding narrow decisions

1. Does the owner approve one bounded HUD/validation/integration repair pass, preserving native masters, current density/caps, and no remodeling?
2. Does the owner approve the `AGENTS.md` read-order-only replacement, leaving runtime/security rules intact?

These were asked but not affirmatively answered before this handoff. The original broad website-completion direction remains recorded, but it is not a reason to ignore the later bounded-pass stop. A new session can investigate/read existing evidence without launching another automatic correction loop.

### Step 3: execute the approved bounded repair

Start with the confirmed visible overlap and two reproduced selector gaps. Write failing behavioral tests first. Adjudicate the remaining review scenarios against real consumers before adding scope. Keep canonical/private output ownership explicit. Repair the security-test seam without disabling the scanner. For protected documentation, change only the approved read-order section and preserve required policy text.

If source/producer bytes change, previous generation/review receipts become historical. Run the owning producer genuinely and preserve prior attempts under new evidence paths; never bless old output with edited hashes. Do not combine enemy adoption with an unrelated hero CSS fix simply to eliminate all failures in one unreviewable patch.

### Step 4: accept native Bagholder deliberately

Close the current native-pipeline truth/binding/semantic review, prove authentic export/A/B/provenance, real hit-window timing, ground/collision/art parity and mobile scale; then adopt the explicit four-file payload under parent custody. Rerun canonical asset/runtime/legacy compatibility contracts. Other roles follow the same production lane.

### Step 5: exact-candidate release certification

Required sequence, not a promise that it currently passes:

1. Source/candidate inventory; focused RED→GREEN tests; all relevant Python tests with no skipped-count laundering.
2. Native/selector authenticity, genuine regeneration where needed, source conservation and decoded-pixel/cap proofs.
3. Curated inventory, unified asset QA, syntax, full release ledger with **zero unexpected** failures, security and relevant contract/docs gates; preserve the known 51 retired identities unless separately justified.
4. Clean no-Git, pointer-only/source-vault-aware host build with actual primary and spawned Node 24; CI Python 3.12/Pillow 11.3 compatibility. Do not assume a local expanded-source build proves deployability.
5. Canonical fresh-player/selector/unlock/fallback flows, normal first-frame full-HUD mobile/desktop evidence, body/overlay/ground/depth/collision checks, intentional visual baselines and two consistent visual passes.
6. Active-combat keyboard/mouse/touch/gamepad checks, desktop/mobile frame/heap/GPU/network metrics and endurance. Run browsers serially and keep heavy jobs outside timed windows.
7. Freeze the exact scoped candidate, calculate the binary diff digest, obtain independent completed review against that digest, and keep it frozen until review returns. An exit code 0, empty index, timeout, generic warning or pre-freeze review is not a PASS.
8. Selective commit/push and inspect the immutable Preview under the owner's applicable promotion approval. Reconcile exact deployment/rollback; do not deploy the entire dirty tree.
9. Read actual public responses after promotion: artifact bytes plus normal browser/console/network/feature behavior, service-worker/update path and rollback. Do not fulfill local files on a public route and call that public certification.

### Step 6: continue the rest without restarting completed work

Finish remaining enemy/weapon/pickup/world/control/combat/audio/portal slices in the order justified by dependencies and current evidence. Keep the handoff and register dispositions current, with source acceptance, visual acceptance, integration and public delivery separate.

## 8. Working Windows / Git Bash commands and pitfalls

### Read-only entry commands

```bash
cd /c/Users/just_/Desktop/Projects/lesters-arcade-textured-rollout
git rev-parse --show-toplevel --git-common-dir
git branch --show-current
git rev-parse HEAD
git status --short --branch
git diff --check
git worktree list --porcelain
git ls-remote origin refs/heads/main refs/heads/hermes/hmh-textured-rollout refs/heads/hermes/hmh-gameplan-defects refs/heads/fable/hmh-open-work-register
```

There is intentionally no `git pull` here: no rollout upstream is configured and another worktree owns other changes.

### Toolchain

- Verified native Node: `C:/Users/just_/AppData/Local/npm-cache/_npx/387698761821791d/node_modules/node/bin/node.exe`, **v24.20.0**.
- npm CLI: `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`.
- Local `python`: **3.11.16** at handoff. Hermes Python: `C:/Users/just_/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe`.
- Blender: `D:/Apps/Blender/blender.exe`, **5.1.2**. Native-source opens use `--background --factory-startup --disable-autoexec --threads 2`, then the source, `--python-exit-code 1`, then the script. Never save over originals.
- Use npm for this repository. A parent package-manager declaration previously blocked pnpm. A shell Node/PATH change previously still selected Node 22. Verify actual primary and spawned versions; explicit native Node plus a native subprocess PATH is the proven approach.

Read `.tmp/team/hero-native-final/run-source-gates.py` for the working Node24/npm/Python environment construction. **Do not blindly rerun it in place:** it overwrites that run's receipts and regenerates inventory/build output. Adapt to a new evidence directory for a new candidate.

After authorized changes, the named gates actually present in `package.json` include:

```text
assets:hmh:curated-level-kit-runtime
assets:qa:hmh-reboot
check
test:release
design:security-audit
design:third-party-security
contracts:check
repo:health:strict
repo:cdn-gate
build
docs:links
docs:cabinets
docs:production
check:hmh:hero-selector
smoke:hmh:production-hero
smoke:hmh:hero-selector
certify:hmh:browser
visual:reboot
visual:reboot:accept
```

Resolve each command from current `package.json` and use the native Node24 environment. `visual:reboot:accept` is only for intentional reviewed visual changes, not fixing an unexplained diff. `docs:production` is network-backed; the shipped-doc `docs:links` check alone does **not** scan every handoff, so validate this document's own paths too.

### Local preview

Serve **`apps/portal`**, not `dist` and not the repository root. If no appropriate listener exists, the conventional command is:

```bash
python -m http.server 8973 --bind 127.0.0.1 --directory apps/portal
```

Do not launch a duplicate: a verified listener already existed at capture. Pin `HMH_REBOOT_ORIGIN=http://127.0.0.1:8973` in browser harnesses. Preflight the exact HTML/game/asset bytes from that origin; a successful 200 response or a Pixi canvas alone does not identify the candidate. Do not build or regenerate while a browser gate is running.

### Learned constraints that prevent lost days

- `.git` can be a worktree pointer. The common repository is outside the project root; do not mistake the pointer for corruption.
- Git Bash uses POSIX shell syntax, but native program path arguments must be `C:/...` style. Do not pass `/c/...` to native `git -C`, Node script arguments, or Python file arguments on this configuration.
- Preserve ignored `.tmp` and `.hermes/evidence` material before cleanup; a Markdown download does not include those binaries or native masters. A new session on this machine can use them; another machine needs an explicit source/evidence transfer.
- GPU rendering, mutable generator domains, builds, and browsers need coordinated ownership. Never parallelize browser suites. Use independent source workers only on disjoint scopes.
- Still images are not animation proof. Loader activity is not visible replacement. Body-height telemetry is not overlay clearance. Canvas-only video excludes the DOM HUD. Same-seed/unit tests are not first-player reachability.
- A/B render within 8/2/32 is not "zero drift". Preserve original failures, retries and raw originals. Do not let image recompression, an edited manifest, or a self-reported export claim launder provenance.
- Avoid Pillow 12-only `Image.get_flattened_data` in the Python 3.12/Pillow 11.3 host path; use compatible APIs. No-Git tests may need explicit diagnostics rather than `t.skip`; the release gate rejects skipped tests.
- Cache/version markers are distributed. Discover current references and regenerate the curated inventory when a portal module changes; copying old cycle markers can deploy a mismatched bundle.
- Minimax free reviewer slug previously returned 404. That is an unavailable-model failure, not an asset/test result. Use an actually available reviewer/model and authenticate its exact packet/final output.
- `bash: no job control in this shell` appeared on successes and failures; it was not the cause of the release/browser failures.
- Delayed process notices are reconciled against existing receipt hashes before rerunning anything. A completion notice grants no new source/edit/publishing authority.

## 9. Source, evidence, and recovery map

All relative paths below resolve under the active rollout root unless an absolute sibling path is shown. `.tmp` and `.hermes/evidence` are **local/ignored and not guaranteed on GitHub**. Preserve them before any cleanup. This handoff embeds the actionable summary so the next session need not ingest every log.

### Canonical source and planning

| Purpose | Path |
| --- | --- |
| This complete handoff | `docs/handoffs/2026-09-08-hmh-lesters-arcade-revamp-session-handoff.md` |
| Short native continuation checkpoint | `docs/handoffs/hmh-textured-rollout-progress.md` |
| Namespaced 99-item source inventory | `docs/hmh-reboot/OPEN-WORK-CURRENT-STATUS.json` |
| Recovered older intent/register | `docs/handoffs/2026-09-07-hmh-open-work-register-and-reprompt.md` |
| Detailed older gameplan repros | `docs/handoffs/2026-09-07-hmh-gameplan-review-for-hermes.md` |
| Standing program acceptance | `docs/hmh-reboot/AAA-ROADMAP.md` |
| Identity | `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md` |
| Model/atlas authorization | `docs/hmh-reboot/cycles/MODEL-COMPLETION-AUTHORITY.md`, `DECISIONS.md` |
| Protected policy and regression | `AGENTS.md`, `tests/agents-policy.test.mjs` |
| Child runtime / portal shell | `apps/hmh-reboot/src/main.mjs`, `apps/portal/hmh-reboot/index.html`, `apps/portal/hmh-reboot/styles.css` |
| Hero manifests | `apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json`, `apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json` |
| Hero runtime/production driver | `apps/hmh-reboot/src/production-hero-atlas.mjs`, `scripts/run-hmh-tripo-gameplay-pilot.py` |
| Selector producers | `scripts/run-hmh-hero-selector-render.py`, `scripts/hmh_selector_native_sources.py`, `scripts/hmh-blender/export-hmh-hero-selector.py` |
| Generated gameplay/selector outputs | `apps/portal/assets/generated/hmh-reboot-production-heroes/`, `apps/portal/assets/generated/hmh-reboot-hero-selector/`, `apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs` |
| Native enemies | `apps/hmh-reboot/assets/source/models/native-enemies/bagholder-rusher/`, `apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json` |
| Enemy runtime/producers | `apps/hmh-reboot/src/enemy-roster-atlas.mjs`, `scripts/run-hmh-enemy-roster-pipeline.py`, `scripts/hmh_native_enemy.py`, `scripts/hmh-enemy-source-qa.mjs` |
| Weapons / world | `apps/hmh-reboot/src/weapon-system.mjs`, `apps/hmh-reboot/src/level-one-world.mjs` |
| Security/release ledgers | `docs/security/hard-money-heroes-security-audit.json`, `docs/testing/hmh-reboot-test-retirement-gate.json` |
| STACKED status/cycles | `docs/stacked/STATUS.md`, `docs/stacked/STACKED-CYCLES.md`, `docs/stacked/STACKED-MASTER-PLAN.md` |
| Web3 source/runbook starting points | `contracts/deployment-record.json`, `docs/web3/hardened-ranked-deployment-manifest.json`, `docs/hmh-reboot/MAINNET-READINESS-ROADMAP-2026-09-01.md` |

### Current verification and reviews

| Evidence | Path / meaning |
| --- | --- |
| Consolidated native acceptance | `.tmp/team/hero-native-final/acceptance.json` — BLOCKED, with successes and failures retained |
| Local evidence ZIP | `.tmp/team/hero-native-final/native-heroes-local-proof-NOT-RELEASE.zip` — recordings/contact sheets/temporal samples, NOT a full native-source backup |
| Native cameras | `.tmp/team/hero-native-final/native-camera-receipt.json` |
| Genuine selector A/B/check | `.tmp/team/hero-native-final/selector-final-receipt.json` |
| Original browser matrix | `.tmp/team/hero-native-final/browser/matrix-receipt.json` |
| Original failed request | `.tmp/team/hero-native-final/browser/lit-valkyrie.log` |
| Unchanged Valkyrie retry | `.tmp/team/hero-native-final/retry-valkyrie.py`, `.tmp/team/hero-native-final/valkyrie-retry-controller.log` |
| Current full-HUD captures | `.hermes/evidence/hmh-current-native-heroes/` |
| Real-input motion receipt/videos | `.hermes/evidence/hmh-current-native-motion/receipt.json`, `.hermes/evidence/hmh-current-native-motion/` |
| Visual contact/temporal sheets | `.tmp/team/hero-native-final/visual-review/` |
| Approved six-item owner-pass final | `.tmp/team/hero-owner-pass/final.json` — native/regeneration pending labels there are superseded by parent receipts |
| Current reviewer authentication | `.tmp/team/current-source-reviews/authenticated-reviews.json` |
| Current runtime review | `.tmp/team/current-source-reviews/hero-runtime/final.json` |
| Current selector review | `.tmp/team/current-source-reviews/hero-selector/final.json` |
| Current enemy-pipeline review | `.tmp/team/current-source-reviews/enemy-pipeline/final.json` |
| Parent selector counterexamples | `.tmp/team/current-source-reviews/selector-counterexamples.json`, `.tmp/team/current-source-reviews/reproduce-selector.py` |
| Full source/build failures | `.tmp/team/hero-native-final/gates/receipt.json`, `.tmp/team/hero-native-final/gates/release.log`, `.tmp/team/hero-native-final/gates/security.log`, `.tmp/team/hero-native-final/gates/asset-qa.log` |
| Separate non-enemy diagnosis | `.tmp/team/hero-native-final/gates/non-enemy-contracts.log` |
| Private Bagholder handback | `.tmp/team/bagholder-correction/final.json`, `.tmp/team/bagholder-correction/adoption-packet.json`, `.tmp/team/bagholder-correction/HANDOFF.txt` |
| Corrected Bagholder candidate | `.tmp/team/bagholder-correction/candidate-native-ab/ready-to-adopt/` |
| Native hit proof and private smoke | `.tmp/team/bagholder-correction/hit-green.json`, `.tmp/team/bagholder-parent-preview/smoke-v4.mjs` |
| Earlier public/source reconciliation | `.tmp/team/guide-reconciliation/current-state-proof.json` — historical 11:44 UTC readback |
| This handoff's fresh reconciliation | `.tmp/team/revamp-session-handoff/source-snapshot.json`, `.tmp/team/revamp-session-handoff/catalog.json` |
| This handoff's path/count/conservation validation | `.tmp/team/revamp-session-handoff/validation.json` |

### Process-completion notices already accounted for

| Process handle | Original result | Disposition |
| --- | --- | --- |
| `proc_9574639fe67d` | Selector controller exit 0 | Genuine A/B/`--check` success authenticated, already included |
| `proc_de8f812c4898` | Full source-gates exit 1 | Same 21 unexpected failures and failing QA/security, already included |
| `proc_ac43a590d215` | Browser controller exit 1 | Original Valkyrie `ERR_NO_BUFFER_SPACE`, preserved; unchanged retry completes 20/20 |

Review processes `proc_91ecaec0fb03`, `proc_d3b6f29db00a`, and `proc_1799da18a60d` returned authenticated final packets. Their completion is not acceptance or repair authorization. Older worker/process histories survive in the source checkpoint/evidence; verify OS state instead of assuming a restored handle is live.

### Historical material and stale claims

- `docs/release-readiness-master-task-list-2026-07-09.md` is the retired Canvas-direction checklist, not a current execution queue.
- Pre-current handoffs, old Cycle 079 markers, old 405 MB health failure, older 146/148 test result, old public Cycle 080 deployment ID, and old "zero native heroes" statements are historical, not reasons to undo current work.
- The originally attached `Downloads/LestersArcade-Prompt.md` was missing. Do not wait on that unavailable attachment; the guide was recovered from the exact Git branch/commit above.
- If a cited historical source detail is still necessary, search prior sessions `20260908_073837_4d50ad`, `20260908_045844_821b3c`, `20260908_042010_f2f105`, or `20260908_023247_9c3886`. Use an exact filename/process/digest query rather than loading entire transcripts.
- No credentials, private keys, verifier secrets, or wallet authorization material belong in this document or a new prompt. Retrieve authorized runtime credentials through the normal secure mechanism only when the exact task needs them.

## Appendix A. Complete namespaced register: 99 items

This inventory preserves all unique IDs from `docs/hmh-reboot/OPEN-WORK-CURRENT-STATUS.json`: the guide's 68 table rows, four launch/human entries, five Web3 items, and 22 STACKED cycles. It is not a percentage-complete score. Each entry's **handoff disposition** supersedes stale open/owner-pending language in the old requirement. Unclosed items retain their original acceptance criteria or point to their exact owning cycle.

`REGISTER:B-1` is a live-defect ID; `WEB3:B-1` is a different contract-preparation item. Preserve `E-3f`, `W-8f`, and the leading zeros in `STACKED:S-01` etc. Additional current local blockers such as minimap removal and HUD occlusion are described above; they are not silently assigned conflicting register IDs.

### A.1 4.1 Live defects (Cycle 081 candidate — all small, all player-visible)

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:B-1 | Touch hint copy matches active touch controls | Deployed; partial certification | Hint copy is chosen from the same touch detection the cockpit uses and names MOVE/AIM sticks, SWAP, POWER, double-tap dash, pause. RED test plus a mobile-controls smoke assertion. |
| REGISTER:B-2 | Touch hint docking and hero clearance | Prior docking deployed; new native-body overlap confirmed | Preserve shipped touch docking and fix current tablet/short-landscape body-versus-HUD/help clearance without hiding UI or shrinking heroes. |
| REGISTER:B-3 | Homepage ad/cabinet containment | Deployed; partial certification | Containment assertion in the portal E2E; no overlap at all five profiles. |
| REGISTER:B-4 | Hashwood landmark/tour-spawn clearance | Deployed; partial certification | Landmarks never overlap a spawn disc; scale, placement or alpha corrected; verified in the hashwood scene at 100%. |
| REGISTER:B-5 | Selector framing and lighting | Native/local proof complete; visual/validation/release blocked | Four native sources and source-matched selectors exist; A/B/check and 163 focused tests pass. Close section 5 blockers and final animation/fresh-player/performance/public gates; no remodeling. |
| REGISTER:B-6 | Reference-faithful selector biographies | Committed locally; not public | Preserve current committed identity/copy corrections; certify ordinary selector/player flow on the repaired candidate. |
| REGISTER:B-7 | Empty-combo label | Deployed; partial certification | Label reads "COMBO" or hides until the first hit. |
| REGISTER:B-8 | Current read order, roadmap, and STACKED document truth | Part complete; protected edit blocked | Roadmap/checklist/STACKED reconciliation done locally. Preserve earlier AGENTS preface; full protected read-order edit still needs approval and its RED policy test. |
| REGISTER:B-9 | Expanded-source versus deployable repository health | Latest ordinary strict-health gate passed; portability still open | Do not repeat the stale 405 MB diagnosis. Verify clean pointer-only/source-vault host portability, retained originals and distinct payload scopes before release. |
| REGISTER:B-10 | Atmosphere first-fill/p99 profiling and prewarm | Open; verify current consumer first | First-fill spike profiled; pool pre-warmed at session start; p99 recorded. |
| REGISTER:B-11 | Mining-camp haze contrast | Owner/input gate; verify existing approval/input | Owner looks; my recommendation is a 30% density reduction. |

### A.2 4.2 Hero program — the owner's number one priority

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:H-0 | Atlas format and hero transfer caps | Decision settled | Settled: exact lossless WebP, 4 MiB per hero, 16 MiB aggregate, 2048 maximum atlas dimension. Do not reopen. |
| REGISTER:H-1 | Reference character identity reconciliation | Committed locally; not public | Preserve current committed identity/copy corrections; certify ordinary selector/player flow on the repaired candidate. |
| REGISTER:H-6 | Packed-texture dependency support | Shipped foundation; preserve | A packed-texture GLB passes the hero pipeline's dependency check; unpacked media and linked libraries still rejected. |
| REGISTER:H-2 | Native hero rigging, skinning, and retained secondary bones | Native/local proof complete; visual/validation/release blocked | Four native sources and source-matched selectors exist; A/B/check and 163 focused tests pass. Close section 5 blockers and final animation/fresh-player/performance/public gates; no remodeling. |
| REGISTER:H-3 | Nine native hero action families | Native/local proof complete; visual/validation/release blocked | Four native sources and source-matched selectors exist; A/B/check and 163 focused tests pass. Close section 5 blockers and final animation/fresh-player/performance/public gates; no remodeling. |
| REGISTER:H-4 | Gameplay pilots, readable body size, and certified delivery | Native/local proof complete; visual/validation/release blocked | Four native sources and source-matched selectors exist; A/B/check and 163 focused tests pass. Close section 5 blockers and final animation/fresh-player/performance/public gates; no remodeling. |
| REGISTER:H-5 | Selectors regenerated from the gameplay source | Native/local proof complete; visual/validation/release blocked | Four native sources and source-matched selectors exist; A/B/check and 163 focused tests pass. Close section 5 blockers and final animation/fresh-player/performance/public gates; no remodeling. |
| REGISTER:H-7 | Weapon socket geometry and held weapon coverage | Source/partial runtime; coverage incomplete | Continue existing native pistol/knife/grenade work; finish uncovered held slot weapons, socket/muzzle alignment, directional poses, pickups/icons and actual player reachability. |
| REGISTER:C-5 | Baked secondary motion | Partial; missing current acceptance | Weighted native actions/Lilly coattail rig and real motion evidence exist. Finish full gameplay-scale secondary-motion/foot-plant/action review; no runtime physics substitution. |
| REGISTER:C-6 | Implement texture decision and measure decode/GPU memory | Partial; missing current acceptance | Four WebPs fit approved caps. Record actual selected-hero transfer, mobile decode, GPU allocation and runtime/performance evidence separately. |

### A.3 4.3 Enemies

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:E-2 | Role/boss reference and native enemy source production | Private native candidate; not adopted | Bagholder source and private corrected candidate preserved; 23 source/22 canonical/4 candidate hashes match. Close current pipeline review and mobile/hit/collision/visual gates before adoption; other roles/boss incomplete. |
| REGISTER:E-7 | Role-bind or archive the unbound zombie candidate | Private native candidate; not adopted | Bagholder source and private corrected candidate preserved; 23 source/22 canonical/4 candidate hashes match. Close current pipeline review and mobile/hit/collision/visual gates before adoption; other roles/boss incomplete. |
| REGISTER:E-8 | Boss atlas capacity, phase split, and roster drift margin | Open; verify current consumer first | Three Liquidator phases split into three atlases; drift-trend recorded per pipeline run. |
| REGISTER:E-3f | Tell-to-hit readability at gameplay zoom | Open; verify current consumer first | A clip per role at 100% with the frame count between tell and hit recorded. |
| REGISTER:E-5 | Distinct Liquidator phase presentation | Open; verify current consumer first | Three phases readable from a screenshot. |
| REGISTER:E-6 | Benchmark-driven boss counters, add pressure, and arena use | Open; dependency ordered | RED tests, same-seed survival and TTK reports. |

### A.4 4.4 Weapons, pickups, power-ups

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:R-4 | Reference-backed weapon models | Source/partial runtime; coverage incomplete | Continue existing native pistol/knife/grenade work; finish uncovered held slot weapons, socket/muzzle alignment, directional poses, pickups/icons and actual player reachability. |
| REGISTER:R-5 | Modeled power-up objects | Open; verify current consumer first | Small 3D pickups with an emissive accent and the existing bob. |
| REGISTER:W-8f | Pooled campfire light/embers | Open; verify current consumer first | Pooled emitter tied to the atmosphere layer. |

### A.5 4.5 World and level design

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:R-3 | Authored town/camp/industrial/bridge kits | Open; dependency ordered | Shared grid unit, pivots and collision proxies; district scenes read as built places. |
| REGISTER:R-2 | Approved organic tree/rock/wreck/stump/debris assets | Owner/input gate; verify existing approval/input | Owner delivers GLBs per roadmap 8.1.3. |
| REGISTER:W-17 | Hashwood canopy depth/clusters | Open; verify current consumer first | Broken into canopy clusters with depth, the way cliffs were treated in Cycle 073. |
| REGISTER:W-18 | Yard slab variation/cracks/stains | Open; verify current consumer first | Slab size varied with cracks and stains in the bakery. |
| REGISTER:W-9 | Ruined-yard town conversion | Direction set; implementation remains | Implement the already-selected ruined-yard town conversion, not a seventh district; preserve deterministic world/collision authority. |
| REGISTER:W-11 | Simulation-authoritative verticality | Open; verify current consumer first | Overlook platforms, sunken pits, terraces with elevation authority in the world contract. |
| REGISTER:W-12 | Deterministic secrets/caches/lore | Open; verify current consumer first | Discoverable and deterministic. |
| REGISTER:W-16 | Level 2 planning after Level 1 acceptance | Open; dependency ordered | Only after Level 1 meets the World acceptance bar. |

### A.6 4.6 Combat, movement, controls

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:G-7 | Reconcile withheld Cycle 079 and fix burn provenance | Open; verify current consumer first | Both fixed with RED tests and a same-seed replay note. Do not copy old Cycle 079 cache markers or re-apply the shipped corpse patch. |
| REGISTER:G-1 | Canonical swarm-pressure benchmark | Open; verify current consumer first | Report in `docs/qa/`. |
| REGISTER:G-3 | Make touch melee useful/reachable or explicitly retire it | Open; verify current consumer first | Decision recorded either way. |
| REGISTER:G-6 | Repeat weapon/swarm benchmarks after simulation changes | Open; verify current consumer first | Attached to each cycle ledger. |
| REGISTER:K-3 | Expose the full truthful action map | Open; verify current consumer first | Every binding discoverable. |
| REGISTER:K-4 | Rebinds, aim assist, sensitivity, left-handed touch | Open; verify current consumer first | Persisted parent-side. |
| REGISTER:K-5 | Movement-feel measurements before tuning | Open; verify current consumer first | Input latency, accel and decel, diagonal normalisation, turn response. |
| REGISTER:K-6 | Dash buffer and edge forgiveness | Open; verify current consumer first | Buffered inputs; landing already has dust. |
| REGISTER:K-8 | Bounded first-run touch onboarding | Deployed; partial certification | Plus B-1 and B-2. |

### A.7 4.7 UI, audio, portal, data

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:U-8 | Death/run-summary/replay player-flow review | Open; verify current consumer first | Played on desktop and phone; what reads wrong is fixed. |
| REGISTER:U-9 | HUD/arsenal strip density and unowned-slot collapse | Open; verify current consumer first | Unowned slots collapse on narrow profiles. |
| REGISTER:S-1 | Missing footsteps/weapon/boss/UI audio with provenance | Direction set; implementation remains | Sourcing direction set: repository-owned synthesis or already-approved licensed audio, no new spending. Inventory shipped cues, add missing categories and license lines. |
| REGISTER:S-4 | Measured category mix/LUFS | Open; dependency ordered | Recorded in the ledger. |
| REGISTER:L-2 | Seeded House score presentation | Owner/input gate; verify existing approval/input | Recommendation: remove before launch, keep in a labelled House tab. |
| REGISTER:L-4 | Visibility of unplayable banner-only cabinets | Owner/input gate; verify existing approval/input | Recommendation: hide until playable. |
| REGISTER:L-3 | Three-click play flow and truthful competitive proof | Open; verify current consumer first | Plus the ad-strip fix (B-3). |
| REGISTER:L-5 | Profile command center and build history | Open; verify current consumer first | Kills by role and weapon, accuracy, build history. |
| REGISTER:L-6 | Achievement dates/progress/accessible tooltips | Open; verify current consumer first | Visible unlock dates/progress meters and accessible tooltips backed by parent-owned achievement state. |
| REGISTER:L-8 | Key art from accepted native hero models | Open; dependency ordered | Portal and game finally match. |
| REGISTER:L-9 | Trust/privacy/terms/support/accessibility/testnet pages | Owner/input gate; verify existing approval/input | Drafted by you, approved by owner. |
| REGISTER:D-2 | Privacy-conscious parent-owned funnel telemetry | Open; verify current consumer first | Parent-owned. |
| REGISTER:D-3 | Internal balance dashboards | Open; verify current consumer first | Published to `docs/qa/`. |

### A.8 4.8 Platform and process

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:N-3 | Roadmap sequencing/current-state reconciliation | Part complete; protected edit blocked | Roadmap/checklist/STACKED reconciliation done locally. Preserve earlier AGENTS preface; full protected read-order edit still needs approval and its RED policy test. |
| REGISTER:N-7 | Curated portal source inventory guard | Deployed; partial certification | Adding a portal module cannot desynchronise `dist/main.js`. |
| REGISTER:N-8 | Per-profile visual harness and hero crops | Partial; missing current acceptance | Current private 20-profile/motion proof exists. Add body-overlay and normal-first-frame coverage to the canonical relaunch/hero-crop visual harness and obtain full acceptance. |
| REGISTER:N-9 | Apply correct repo-health/source-vault policy | Latest ordinary strict-health gate passed; portability still open | Do not repeat the stale 405 MB diagnosis. Verify clean pointer-only/source-vault host portability, retained originals and distinct payload scopes before release. |
| REGISTER:N-2 | Owner-approved legacy asset keep/retire triage | Owner/input gate; verify existing approval/input | Keep or retire list approved. |
| REGISTER:N-4 | Lazy debug/evidence bundle opportunity | Open; verify current consumer first | Not urgent at current headroom. |
| REGISTER:N-6 | Larger-atlas CDN/cache policy | Open; verify current consumer first | Definition of done not specified in guide; define before implementation. |
| REGISTER:P-8 | Pipeline reproducibility/cap drift trend | Open; verify current consumer first | Definition of done not specified in guide; define before implementation. |

### A.9 4.9 Launch readiness

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| REGISTER:M-1 | Press capture pipeline | Open; verify current consumer first | Scripted turntables, combat clips, map flyovers and mobile gameplay in docs/releases/press/. |
| REGISTER:M-2 | Truthful manifest-backed fact sheet/feature matrix | Open; verify current consumer first | Feature matrix generated from manifests with public/local/unimplemented states. |
| REGISTER:M-3 | Daily/weekly challenge seeds and sharing | Open; verify current consumer first | Daily and weekly challenge seeds with seed sharing. |
| REGISTER:owner-playtests | Owner and first-time human desktop/mobile playtests | Human acceptance required | Five first-time desktop and five first-time mobile players, screen-recorded. |

### A.10 4.10 Web3

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| WEB3:B-1 | Contract structure/tests/static analysis and documented findings | Preparation open; newer wallet/testnet authorization applies; mainnet/funds/irreversible changes gated | Keep contracts:check, contracts:test and contracts:slither green; retain findings and exact scope. |
| WEB3:B-2 | GameRegistry cabinet approval live gate | Preparation open; newer wallet/testnet authorization applies; mainnet/funds/irreversible changes gated | Source/test coverage for the actual cabinet-approval path; current authorization governs any chain writes. |
| WEB3:B-3 | Production SplitConfig proposal | Preparation open; newer wallet/testnet authorization applies; mainnet/funds/irreversible changes gated | Worked examples and exact economic/authority proposal for owner review; do not apply unapproved economics. |
| WEB3:B-4 | Trusted-verifier key-management runbook | Preparation open; newer wallet/testnet authorization applies; mainnet/funds/irreversible changes gated | Generation, custody, rotation and recovery design; no secrets in docs; separately gate authority changes. |
| WEB3:B-5 | Testnet deployment runbook and safe dry run | Preparation open; newer wallet/testnet authorization applies; mainnet/funds/irreversible changes gated | Verified script/runbook and current address/nonce/ABI checks; dry run stops before broadcast; apply current testnet scope explicitly. |

### A.11 4.10 STACKED

| ID | Work | Handoff disposition | Remaining acceptance / next action |
| --- | --- | --- | --- |
| STACKED:S-01 | Contract freeze and identity spine | Accepted source; not public playable | Preserve accepted deterministic/source/security boundary; public playability is not claimed. |
| STACKED:S-02 | Deterministic core I: board, pieces, rotation, randomizer, hold, gravity, lock delay | Accepted source; not public playable | Preserve accepted deterministic/source/security boundary; public playability is not claimed. |
| STACKED:S-03 | Deterministic core II: clears, scoring, the rising ledger, top-out, result tuple | Accepted source; not public playable | Preserve accepted deterministic/source/security boundary; public playability is not claimed. |
| STACKED:S-04 | Input codec, evidence chunking, deterministic re-simulation | Policy-blocked; no retry | Owner direction for the policy-preserving source-only approach; no retry of denied commands/patches. |
| STACKED:S-05 | Difficulty model artifact and the soak pilot policy | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-06 | Cabinet registration behind `?devCabinets=1` | Isolated prepared candidate; paused | Preserve isolated work; broader integration/viewport/shell and eventual release/human-device gates remain. |
| STACKED:S-07 | Leaderboard engine hygiene | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-08 | Run summary schema and the `runStats` projection | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-09 | `game-stat-schema.mjs` extraction | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-10 | Run-verifier registry and achievement scoping | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-11 | Build, CSP, service worker, child shell | Isolated prepared candidate; paused | Preserve isolated work; broader integration/viewport/shell and eventual release/human-device gates remain. |
| STACKED:S-12 | Renderer skeleton: layers, board view, pure layout, root fit | Isolated prepared candidate; paused | Preserve isolated work; broader integration/viewport/shell and eventual release/human-device gates remain. |
| STACKED:S-13 | Zones, backdrop, particles, quality tiers, flash limiter | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-14 | Audio-reactive pipeline and the projection firewall proof | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-15 | Mobile layout, touch, gamepad, haptics, thermal governor | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-16 | Bridge, host, lifecycle: Free Mode playable behind `?devCabinets=1` | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-17 | Player settings and the cabinet settings registry | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-18 | Ranked integrity: plausibility gate, replay claim, verified stamp, trust column | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-19 | Achievements: 16 definitions, resolver, badge atlas, Free medal shelf | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-20 | STACKED leaderboard columns and profile surfaces | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-21 | Gate build-out: visual regression, performance smoke, soak, security sweep | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |
| STACKED:S-22 | Ship gate | Paused / pending | Exact acceptance is in this cycle of docs/stacked/STACKED-CYCLES.md; do not displace the HMH hero release. |

## Appendix B. Exact 21 unexpected release failures

Taken programmatically from the preserved acceptance record; all 21 unique names are retained. These are the latest recorded failure identities, not a new test run from this handoff. Fix root causes and re-run the current suite; do not silently mark them retired.

| # | Test file | Exact failure name |
| --- | --- | --- |
| 1 | `tests/agents-policy.test.mjs` | HMH entrypoint has one current checkpoint and scopes historical reading to the selected slice |
| 2 | `tests/hmh-native-enemy-source.test.mjs` | native artifact QA rejects stale procedural metadata, validates generated candidate, and pins bounds |
| 3 | `tests/hmh-native-enemy-source.test.mjs` | runtime native index rejects stale procedural and foreign native sources for lazy fallback |
| 4 | `tests/hmh-native-enemy-source.test.mjs` | native QA policy distinguishes packed cold opens from procedural source rebuilds |
| 5 | `tests/hmh-reboot-enemy-role-animation-profiles.test.mjs` | the cold roster gate publishes the hero premultiplied budget policy and no quantiser |
| 6 | `tests/hmh-reboot-enemy-role-animation-profiles.test.mjs` | generated atlas metadata preserves each role-native animation profile |
| 7 | `tests/hmh-reboot-enemy-role-animation-profiles.test.mjs` | generated atlas metadata records the pose authoring version and the accent |
| 8 | `tests/hmh-reboot-enemy-role-damage-profiles.test.mjs` | generated atlases preserve damage provenance and two distinct hit frames |
| 9 | `tests/hmh-reboot-enemy-role-detail.test.mjs` | Cycle 034 generated atlases retain the audited detail and animation provenance |
| 10 | `tests/hmh-reboot-enemy-roster-atlas.test.mjs` | every roster atlas is present, projection-only, and complete |
| 11 | `tests/hmh-reboot-enemy-roster-atlas.test.mjs` | pose resolution is deterministic, wraps loops, and holds the death frame |
| 12 | `tests/hmh-reboot-enemy-roster-atlas.test.mjs` | a phase tick selects tell and attack frames in authored order and holds the last one |
| 13 | `tests/hmh-reboot-enemy-roster-atlas.test.mjs` | actual roster/fallback wiring carries the actor scale into existing camera-zoom composition |
| 14 | `tests/hmh-reboot-enemy-roster-atlas.test.mjs` | native hit peak and recovery both occur inside every existing short hit window |
| 15 | `tests/hmh-reboot-enemy-tell-poses.test.mjs` | every ordinary role widens on the tell and builds to a held maximum |
| 16 | `tests/hmh-reboot-enemy-tell-poses.test.mjs` | the strike overshoots the held tell and the recovery frame is a distinct exposed pose |
| 17 | `tests/hmh-reboot-enemy-tell-poses.test.mjs` | all nineteen frames per role are pairwise distinct and unknown profiles fail closed |
| 18 | `tests/hmh-reboot-level-one-world.test.mjs` | runtime imports the world contract instead of retaining an inline parallel graybox |
| 19 | `tests/hmh-reboot-production-unlockable-pilot.test.mjs` | production manifest locks canonical Lester and Lilly identities and ranked gates |
| 20 | `tests/hmh-reboot-production-unlockable-pilot.test.mjs` | Lester and Lilly emit separate deterministic repository-owned production evidence |
| 21 | `tests/hmh-security-audit-sweep.test.mjs` | WO-39 security audit sweep passes static checks without findings |

## Appendix C. Ready-to-paste first prompt for the new session

```text
Continue the existing Hard Money Heroes / Lester's Arcade textured revamp. Do not start over.

Use C:/Users/just_/Desktop/Projects/lesters-arcade-textured-rollout on hermes/hmh-textured-rollout. Read docs/handoffs/2026-09-08-hmh-lesters-arcade-revamp-session-handoff.md, starting with sections 0–2 and 5–7, and verify current Git/OS/source/public state before editing. Preserve every staged, unstaged, untracked and native-master change. Do not work from remote main or deploy the dirty tree.

Four native heroes, source-matched selectors and minimap removal already exist locally. Current proof is four native-camera probes, genuine selector A/B/check, 163 focused passes, 20/20 machine profiles after a preserved unchanged Valkyrie retry, and four real-input recordings. This is not release acceptance: tablet/landscape HUD/help occludes heroes, two selector metadata gaps were reproduced, current reviews need adjudication, Bagholder is private/unadopted, and the full suite has 21 unexpected failures plus the existing 51 retired ones.

The previous six-item bounded source pass is complete. Confirm the unanswered authorization for one additional bounded HUD/validation/integration repair pass before executing it, and separately confirm the protected AGENTS.md read-order-only edit. Do not treat this copied prompt as permission to retry protected or denied actions. Avoid another unbounded review/correction loop.

After applicable approval, continue with RED tests, real source/asset execution, full-HUD/fresh-player visual evidence, exact candidate review and full release gates. Then finish enemies, held weapons and modeled pickups, the authored ruined-yard world, controls/combat/balance, FX/audio, portal and launch work using the complete 99-item register. Preserve Chikun and keep STACKED paused. Keep fixed 60 Hz, projection-only art, parent authority, current budgets and SETTLEMENT_LIVE=false. Respect the current authorized wallet/testnet/mainnet-preparation scope, with separate mainnet/funds/irreversible-authority approvals. Report only verified outcomes and exact remaining blockers.
```

**End of handoff.** No new code repair, canonical enemy adoption, source remodeling, commit, push, deployment, wallet transaction, or protected-policy replacement was performed in preparing this document.
