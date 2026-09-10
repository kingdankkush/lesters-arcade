# Hard Money Heroes — open-work register and re-prompt for Hermes

Date: 2026-09-07 PDT
Author: Claude Opus 5, for Justin Pinter
Verified against: `hermes/hmh-cycle-080-corpse-audio` at `1c81d23c`, live production
`dpl_HskTDVZr72FVDUD7zHnZTHRCtmCx`, and the game played on production.

## 0. Read this file instead of the backlog

You ran out of context reading planning documents. This file is the complete, reconciled
register of what is done and what is left. **Read this file and nothing else before picking
work.** Section 2 lists the documents that are stale or superseded so you do not spend context
on them. When you need task-level detail for the one slice you picked, open only the file this
register names for that slice.

Everything below was verified against source and live production on 2026-09-07, not copied
from checkboxes. Where a planning document disagrees with this file, this file is right and the
document is stale.

---

## 1. Where the program actually stands

| Fact | Value |
| --- | --- |
| Live production | `dpl_HskTDVZr72FVDUD7zHnZTHRCtmCx` at <https://lestersarcade.io> |
| Runtime source | `5d28dfb69c721465a925df2a9142a8848e52d44f` |
| Rollback | `dpl_3vyy1XDPsCAveFDhvm1uvYyFmMPs` |
| Cache marker | `lesters-arcade-v31-hmh-corpse-audio` / `hmh-aaa-cycle-080-corpse-audio` |
| Release ledger | `2,702` evaluated, `2,651` passing, `51` accepted legacy failures, `0` unexpected |
| Test files | 354 |
| Initial child JS | about `994,000` of `1,050,000` (measured at Cycle 075) |
| Frame time | desktop and mobile p95 about `8.5 ms` against a 34 ms budget |

**The honest headline.** Release engineering is excellent. The visual upgrade the owner asked
for has not reached the game. In the running game today: all four heroes are still the
procedural primitive builds at 160 px, the enemy roster is unchanged, no weapon or world asset
has been replaced, and the world is dressed with 45 procedural pastel props. What did change
since Cycle 074 is the character-select screen (real textured Tripo turntables at 384 px, which
look good) and a series of small polish and safety slices.

**Cycles 075 to 080 in one line each.**

- 075: death-confirmation respects reduced motion and flash, particle pool sharing, upgrade
  pointer latch, owner reference art committed under LFS, WebP opt-in in the atlas writer.
- 077: textured Tripo selector turntables live for all four heroes.
- 078: Tripo Commando gameplay prototype, not production.
- 079: pacing and combat rebalance, built and **withheld** with two unresolved findings.
- 080: enemy corpse projection lifetime and audio voice cleanup.
- STACKED S-01 to S-03: a new deterministic game core, live but not publicly playable.

Roughly half the effort in this window went to STACKED and release plumbing. That is the
single biggest reason the game looks the same.

---

## 2. Document map: what to trust, what to ignore

**Authoritative, in this order:**

1. This file — the open-work register.
2. `docs/handoffs/2026-09-07-hmh-gameplan-review-for-hermes.md` — the defect repros and
   rationale behind the items below.
3. `AGENTS.md` — non-negotiable boundaries only (60 Hz simulation, projection-only art, parent
   authority, `SETTLEMENT_LIVE=false`).
4. `docs/hmh-reboot/cycles/CYCLE-0NN.md` — read only the one cycle you are extending.

**Stale or superseded. Do not read these to find work:**

- `docs/hmh-reboot/AAA-ROADMAP.md` **section 7 checkboxes are wrong.** They still show P-4,
  K-1, U-2, P-1, P-2, P-3, P-5, W-1, W-3, W-4, U-3, U-4, U-5 and V-1 to V-5 as unstarted. All of
  those shipped in cycles 072 to 074 and are live. The roadmap's task register (sections 2 to 6
  and 8) is still useful for acceptance bars and owner gates; its sequencing section is not.
  Fixing it is task **N-3** below.
- `docs/release-readiness-master-task-list-2026-07-09.md` — 232 unchecked boxes, all written
  against the retired "Canvas 2D isometric roguelite" direction. **Superseded. Ignore entirely.**
- `docs/handoffs/2026-08-06-hmh-remaining-waves-execution-guide.md` — 19 unchecked, pre-Cycle-070.
  Historical.
- Every handoff dated before 2026-09-05 — historical context only.
- `OPEN_QUESTIONS.md` — 18 unchecked, all owner or legal decisions, none of them agent work.

---

## 3. What is DONE — do not rebuild any of this

Verified present in source at `1c81d23c`:

**World and terrain.** Lit micro-terrain bake with the tile grid removed (repeat 399.36 with
mipmaps); roads without the black outline, with shoulders; shore, scree and shallows bands;
ground contact shadows; deterministic per-district atmosphere (fog, dust, mist, pollen, embers,
colour grade) in `world-atmosphere.mjs`; ledge front faces, ramp grades and cliffs as rock
masses; composed landmark set-pieces; 402 authored placements including twelve spawn-point
camps and three fenced yards; world decals.

**Actors.** Enemy roster relit under EEVEE with the premultiplied budget gate; enemy attack
tells widened and matched to simulation windows with per-role silhouette accents; redesigned
elite treatment; corpse projection lifetime.

**Combat and feel.** Per-weapon muzzle, tracer, casing and surface-typed impacts
(`weapon-vfx.mjs`); grenade feedback set (`grenade-feedback.mjs`); encounter framing, dash
landing and afterimage, hero hit smear, level-up and pickup beats (`game-feel.mjs`).

**UI and audio.** Real DOM cockpit HUD with developer telemetry behind `?debugHud=1`; tiered
level-up cards with keyboard and gamepad selection; SFX volume slider; twelve weapon cues
registered and routed through the portal cue registry; parent-owned pause music transport.

**Platform.** Encounter director decoupled from render zoom (`DIRECTOR_VIEW_HALF_EXTENTS`);
external-model importer, waist split, look-dev group and schema v2 (`import-hmh-external-model.py`);
source-model LFS policy; chunked navgrid readiness; honest initial-JS accounting including
hoisted shared chunks; trimmed Pixi vendor (five build-time stubs); per-profile browser relaunch
in certification; shared deterministic hash helpers.

**Select screen.** Textured Tripo turntables at 384 px per hero, stat comparison chips,
keyboard navigation, reduced-motion guard.

---

## 4. What is OPEN — the complete register

Each item: what it is, and what "done" means. Ordered by the owner's stated priority
(heroes, then enemies, then world), except defects, which are cheap and visible.

### 4.1 Live defects (Cycle 081 candidate — all small, all player-visible)

| ID | Defect | Done when |
| --- | --- | --- |
| B-1 | Touch profiles show the keyboard hint ("WASD move · Mouse aim · Right click grenade · 1-4 weapons · Esc"). Static copy in `apps/portal/hmh-reboot/index.html`, the `hmhControlsHint` aside. | Hint copy is chosen from the same touch detection the cockpit uses and names MOVE/AIM sticks, SWAP, POWER, double-tap dash, pause. RED test plus a mobile-controls smoke assertion. |
| B-2 | That hint card sits over the middle of the phone play area for 12 seconds, covering the hero. | Docked under the cockpit or above the sticks on touch profiles; measured zero overlap with the hero spawn area. |
| B-3 | Home page ad strip draws across the featured-cabinet card at 1440x900. | Containment assertion in the portal E2E; no overlap at all five profiles. |
| B-4 | Hashwood landmark renders as a huge translucent cone over the spawn; the hero stands inside it. | Landmarks never overlap a spawn disc; scale, placement or alpha corrected; verified in the hashwood scene at 100%. |
| B-5 | Selector turntables fill about 60% of the frame and are lit so darkly the red bandana, armband and headband barely read. | Figure fills about 85% of frame height, exposure toward the hero rig's -0.45 with the shared warm rim, two-run gate re-verified. |
| B-6 | Select copy says Lit Commando has a "dark mohawk"; the reference art is a mullet with a swept fringe. | All four bios audited against the reconciled reference doc (H-1). |
| B-7 | HUD shows "COMBO RESET ×0" when no combo exists; "RESET" reads as an error. | Label reads "COMBO" or hides until the first hit. |
| B-8 | Doc drift: `AGENTS.md` has two "0." read-order lines naming different current handoffs; roadmap section 7 unreconciled since Cycle 074; `docs/stacked/STACKED-MASTER-PLAN.md` still says "NOTHING IS BUILT" while `STATUS.md` records S-01 to S-03 live. | One read-order line; roadmap section 7 rewritten from section 3 of this file; STACKED plan stamped with its real status. |
| B-9 | Repo health gate fails at 405 MB against 350 MB because of raw expanded sources. | Owner decides: move intermediates out of the tree, or raise the limit deliberately with a note. |
| B-10 | Desktop p99 rose to about 16.5 ms at Cycle 074 with the atmosphere pool's first fill; never investigated. | First-fill spike profiled; pool pre-warmed at session start; p99 recorded. |
| B-11 | Mining-camp atmosphere haze is dense enough to cut contrast. | Owner looks; my recommendation is a 30% density reduction. |

### 4.2 Hero program — the owner's number one priority

State: four Tripo GLBs (16 to 17 MB each) are committed under LFS at
`apps/hmh-reboot/assets/source/models/tripo-selector/`; eight hero reference PNGs are committed;
the selector renders from those GLBs; **the gameplay manifest `hmh-production-heroes.json` has
zero `sourceModel` entries**, so gameplay still uses the primitive builds.

| ID | Work | Done when |
| --- | --- | --- |
| **H-0** | **OWNER DECISION, blocks everything below.** Atlas format and per-hero cap. Known: Commando at 648 frames and 256 px did not fit 3.25 MiB as lossless PNG in eight trials; lossless WebP exact is about 23% smaller; per-hero lazy loading already exists. | You present three costed options with measured bytes from the real Commando frames: (a) lossless WebP exact at 256 px under a 4 MiB cap, (b) 224 px PNG under the current cap, (c) 256 px PNG with the cap raised to 4 MiB and total to 16 MiB. Owner's answer recorded in `DECISIONS.md`. **Do not wait silently — bring the numbers.** |
| H-1 | Reconcile `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md` to the committed reference art. Identity blocks are in section 5.2 of `docs/handoffs/2026-09-05-hmh-cycle-074-hermes-handoff.md`. | All four identity blocks match the art: hair, neckwear, pauldron side, armband side, bandolier direction, Lilly's coat trim and "L" buckle, Lester's sphere head and expression sheet. |
| H-6 | Packed-texture handling: `external_dependencies()` still counts packed images as external and the runner rejects a non-zero count; real Tripo GLBs carry packed textures. Open since Cycle 072. | A packed-texture GLB passes the hero pipeline's dependency check; unpacked media and linked libraries still rejected. |
| H-2 | Rig and skin the four Tripo GLBs for gameplay. Tripo or Mixamo auto-rig retargeted so the fourteen runtime bones exist (`root, pelvis, spine, chest, head, upper_arm.L/R, forearm.L/R, thigh.L/R, shin.L/R, weapon_socket`), weights corrected at shoulders, hips, waist seam; coat and hair bones for Lilly; rigid sphere head for Lester. | Rigged FBX or GLB committed as LFS source with its SHA in the manifest; waist split verified under maximum torso rotation. |
| H-3 | Author the nine clips per hero: `idle, run, aim, pistol-fire, hurt, dash, melee, grenade, death`, at the frame counts and fps the manifest declares. Mixamo clips as a starting point are fine if committed as source. | Weight shift, foot planting, recoil and recovery, and a distinct death read at gameplay zoom. |
| H-4 | Gameplay pilot per hero behind `?productionHero=<id>`, Lit Commando first. | Two-run reproducibility under the hero budget (8 / 2 / 32); hero-vs-enemy parity band 0.8 to 0.9 holds; side-by-side against the reference front render at 100%; hero-crop visual checks on frontier-relay desktop and mobile; five-profile certification; mobile atlas decode measured. Then Valkyrie, Lilly, Lester, one cycle each. |
| H-5 | Regenerate the selector from the same rigged source. | Select screen and gameplay show the same model. |
| H-7 | Weapon socket geometry: the Tripo models have no socket, and the eight weapon meshes must be re-authored or scaled to the new hand size and pose. | Pistol first, correct in hand across all eight directions. |
| C-5 | Secondary motion where the reference allows it: Lilly's coat tail, hair groups, Commando's neckerchief. | Baked into the actions, not runtime physics. |
| C-6 | Implement the atlas budget decision from H-0. | Measured mobile decode and GPU memory recorded. |

### 4.3 Enemies

| ID | Work | Done when |
| --- | --- | --- |
| E-2 | **Owner-gated.** Enemy reference sheets: six roles plus three Liquidator phases. Ask using the prompt in roadmap section 8.1.2. | Sheets committed under `assets/source/reference/enemies/`. |
| E-7 | The unbound zombie candidate (152 frames, zero drift) lacks roster identity details. | Either bound to a role with silhouette prop, faction colour and accent, or archived. Do not leave a third enemy pipeline half-alive. |
| E-8 | Boss atlas at 96.6% of its 2 MiB cap and roster reproducibility margin at 7 of 8 changed pixels. Fragile. | Three Liquidator phases split into three atlases; drift-trend recorded per pipeline run. |
| E-3f | Tell readability was widened in the atlas but never measured at gameplay zoom. | A clip per role at 100% with the frame count between tell and hit recorded. |
| E-5 | Boss per-phase presentation: visibly distinct `market-open`, `margin-call`, `total-liquidation`. | Three phases readable from a screenshot. |
| E-6 | Boss fight depth: authored counters, add-wave pressure, arena use. Simulation work; needs G-1 first. | RED tests, same-seed survival and TTK reports. |

### 4.4 Weapons, pickups, power-ups

| ID | Work | Done when |
| --- | --- | --- |
| R-4 | Weapon models from the eleven committed reference PNGs (`assets/source/reference/weapons/`: rugged handgun, rifle, shotgun, survival knife, sci-fi grenade and launcher, spiked steampunk grenade, steampunk raygun, weathered military grenade, weathered SMG, worn heavy machine gun). | Pistol, shotgun, auto-miner and launcher first, since they are the Digit 1 to 4 slots. |
| R-5 | Power-ups as objects, not octagonal badges. | Small 3D pickups with an emissive accent and the existing bob. |
| W-8f | Camp props are placed but campfires emit no light or embers. | Pooled emitter tied to the atmosphere layer. |

### 4.5 World and level design

| ID | Work | Done when |
| --- | --- | --- |
| **R-3** | **Modular prop kits authored in Blender: town, camp, industrial, bridge.** The 45 procedural pastel props are now the most visible quality ceiling in every world scene. Schedule right after the first two heroes. | Shared grid unit, pivots and collision proxies; district scenes read as built places. |
| R-2 | **Owner-gated.** Tripo organics wave: trees, boulders, wrecks, stumps, debris. | Owner delivers GLBs per roadmap 8.1.3. |
| W-17 | The hashwood tree line reads as a flat green band across the frame (capsule thicket blockers drawn as a continuous strip). | Broken into canopy clusters with depth, the way cliffs were treated in Cycle 073. |
| W-18 | Yard slab grid reads as a regular checkerboard at gameplay zoom. | Slab size varied with cracks and stains in the bakery. |
| W-9 | **Owner-gated (8.3.1).** Town district: convert part of the yard, or add a seventh district. | Owner picks; recommendation is converting the yard first. |
| W-11 | Simulation verticality beyond the projection work already shipped. | Overlook platforms, sunken pits, terraces with elevation authority in the world contract. |
| W-12 | Secrets: caches behind destructibles, a hard-to-reach ledge cache, lore props. | Discoverable and deterministic. |
| W-16 | Level 2 planning. | Only after Level 1 meets the World acceptance bar. |

### 4.6 Combat, movement, controls

| ID | Work | Done when |
| --- | --- | --- |
| **G-7** | Reconcile the withheld Cycle 079 pacing and combat work onto the current boundary and fix its two findings: automatic defeat-spread creates burns on neutral nearby actors before damage filtering; automatic refresh downgrades a manually initiated burn's causal origin. | Both fixed with RED tests and a same-seed replay note. Do not copy old Cycle 079 cache markers or re-apply the shipped corpse patch. |
| G-1 | Swarm-pressure benchmark: clear time, overkill, projectile pressure. **Gates every balance claim.** | Report in `docs/qa/`. |
| G-3 | Melee: give it a real role reachable on touch, or retire it explicitly. | Decision recorded either way. |
| G-6 | Weapon and swarm benchmarks re-run after every simulation change. | Attached to each cycle ledger. |
| K-3 | Full action-map audit and in-game exposure. | Every binding discoverable. |
| K-4 | Rebinding UI, aim-assist toggle, stick sensitivity, left-handed touch layout. | Persisted parent-side. |
| K-5 | Movement-feel measurement report before any further tuning. | Input latency, accel and decel, diagonal normalisation, turn response. |
| K-6 | Dash input buffering and edge forgiveness. | Buffered inputs; landing already has dust. |
| K-8 | Touch onboarding beat: sticks pulse once on first run. | Plus B-1 and B-2. |

### 4.7 UI, audio, portal, data

| ID | Work | Done when |
| --- | --- | --- |
| U-8 | Death and run-summary screen has never been reviewed as a player flow. | Played on desktop and phone; what reads wrong is fixed. |
| U-9 | HUD polish: the combo label (B-7); the eight-slot arsenal strip is dense on phones. | Unowned slots collapse on narrow profiles. |
| S-1 | **Owner-gated (8.3.4).** Audio expansion: footsteps by terrain material, reload, empty and impact variants, boss cues, UI set. | Sourcing policy chosen; every file carries a license line. |
| S-4 | Mix pass with measured LUFS per category. | Recorded in the ledger. |
| L-2 | **Owner-gated.** Seeded house scores on public leaderboards. | Recommendation: remove before launch, keep in a labelled House tab. |
| L-4 | **Owner-gated.** Banner-only cabinets (MWEB Invaders, LitVM Legends) visible or hidden. | Recommendation: hide until playable. |
| L-3 | Splash: three clicks to a running game, one live competitive proof. | Plus the ad-strip fix (B-3). |
| L-5 | Profile as command centre, after the run-stats schema. | Kills by role and weapon, accuracy, build history. |
| L-6 | Achievements: unlock dates, progress meters, accessible tooltips. | |
| L-8 | Key art re-rendered from the new hero models. | Portal and game finally match. |
| L-9 | Trust pages: privacy, terms, support, accessibility, testnet disclaimer. | Drafted by you, approved by owner. |
| D-2 | Privacy-conscious funnel: homepage to play to hero to run start to first upgrade to death to replay. | Parent-owned. |
| D-3 | Internal balance dashboards from G-1 and X-1 output. | Published to `docs/qa/`. |

### 4.8 Platform and process

| ID | Work | Done when |
| --- | --- | --- |
| N-3 | Roadmap reconciliation (B-8): rewrite section 7 from section 3 of this file, add a "Current live override — Cycle 080" block, classify the new task IDs. | The roadmap stops lying about what shipped. |
| N-7 | Pin the curated-level-kit inventory to the `apps/portal/src` directory listing by test. | Adding a portal module cannot desynchronise `dist/main.js`. |
| N-8 | Apply the per-profile browser relaunch to the visual-regression harness; add hero-crop checks beside the enemy-crop checks. | |
| N-9 | Repo health at 405 MB (B-9). | Owner decision applied. |
| N-2 | **Owner-gated.** Legacy asset triage: about 17 MB of superseded pixellab and isometric art. | Keep or retire list approved. |
| N-4 | Remaining bundle work: a lazy debug and evidence chunk, about 20 KB, needs a build change. | Not urgent at current headroom. |
| N-6 | CDN and cache policy for the larger atlases: immutable hashed filenames. | |
| P-8 | Pipeline fragility: roster gate margin and boss cap (E-8); record drift trends per run. | |

### 4.9 Launch readiness

M-1 capture pipeline (scripted turntables, combat clips, map flyovers, mobile gameplay to
`docs/releases/press/`); M-2 truthful fact sheet and feature matrix generated from manifests;
M-3 daily and weekly challenge seeds with seed sharing; owner playtests, five first-time players
on desktop and five on mobile, screen-recorded.

### 4.10 Web3 and STACKED

**Web3 stays HALT-gated.** B-1 to B-5 preparation is source, test and runbook work only: keep
the contract checks green, live-gate the GameRegistry cabinet approval path, write the
SplitConfig proposal and the verifier key-management runbook, and a testnet dry-run script that
stops before broadcast. No deployment, no broadcast, no keys, no authority change, no
settlement, no real funds without a separate explicit approval naming the exact action.

**STACKED.** S-01 to S-03 are accepted and live but not publicly playable. S-04 is blocked
before implementation on two policy-denied commands and needs owner direction. S-06 portal
candidate and the S-11/S-12 renderer are prepared in isolated worktrees but unintegrated. S-05
and S-07 to S-22 are pending. **Recommendation: hold STACKED at its current accepted boundary
until two gameplay heroes are live.** If the owner wants it in parallel, it needs its own agent
budget so it stops displacing hero work. Either way, fix the plan's status header (B-8).

---

## 5. Owner decisions blocking work

Bring these to Justin with numbers, not questions:

1. **Atlas format and hero cap (H-0)** — blocks every gameplay hero. Three costed options.
2. **Enemy reference sheets (E-2)** — six roles, three boss phases.
3. **STACKED priority** relative to the hero program, and direction on the S-04 policy block.
4. **Town district scope (W-9)** and **audio sourcing (S-1)** — both unanswered since Cycle 074.
5. **Repo health limit (B-9)** — move expanded sources or raise the limit.
6. **Taste calls:** mining haze density (B-11) and the selector turntable framing and exposure (B-5).

---

## 6. Operating rules that cost real time to learn

- **Fetch first.** Compare `origin/*` heads before editing. Another session works in
  `C:\Users\just_\lesters-arcade` and has unpushed commits; never integrate there.
- **Integrate in a dedicated worktree** cut from the live lineage branch; junction
  `node_modules` and `benchmarks/hmh-engine-bakeoff/node_modules`; copy `.hermes/plans`.
- **Vercel build image** is CPython 3.12 with Pillow 11.3 and `.git` stripped. Do not use
  `Image.get_flattened_data` (Pillow 12 only; use `getdata`). Tests needing git or git-lfs must
  pass vacuously with `t.diagnostic`, never `t.skip` — the release gate rejects skipped tests.
- **Bump the cache token every code cycle** in 13 places: portal `index.html` (x7), `sw.js`
  `CACHE_VERSION`, `tests/hmh-load-speed`, `tests/arcade-core` (x2), `tests/hmh-reboot-shell`,
  `scripts/smoke-portal-flow` (x2), `scripts/smoke-portal-interactions`, `README.md` (x3).
  Next is `hmh-aaa-cycle-081-*` / `lesters-arcade-v32-*`.
- **Regenerate the curated-kit inventory** (`npm run assets:hmh:curated-level-kit-runtime`)
  whenever a portal module is added, or `dist/main.js` will not match production.
- **Browser gates are strictly serial.** Never two at once.
- **World-tour spawns are load-bearing**: the collectibles smoke walks from `mining` (9200, 1600)
  and `ravine` (3050, 1500) into specific caches. Add a new tour id rather than moving one.
- **Pixi:** `Graphics.arc()` must be chained from `moveTo()` (guard test exists); masks are
  stencil masks and a per-sprite mask must own its mask for its life.
- **Never widen a reproducibility budget** to make a render pass. Read the drift report first.
- Preview deployments sit behind Vercel Authentication; verify bytes on the public alias after
  `npx vercel promote <dpl> --yes`.

---

## 7. Do this next, in this order

1. **Cycle 081 — defects.** B-1, B-2, B-3, B-4, B-7 (all visible to players in one afternoon),
   plus B-8 and N-3 documentation truth. Ship it.
2. **Cycle 082 — unblock the heroes.** Produce the H-0 memo with measured bytes from the real
   Tripo Commando frames for all three options and give it to Justin. In the same cycle do H-1
   (reference reconciliation), H-6 (packed textures) and B-5 (selector framing and exposure).
3. **Cycle 083 onward — heroes, one per cycle.** H-2, H-3, H-4 for Lit Commando behind the
   pilot flag, then H-5. Repeat for Lit Valkyrie, Lilly, Lester.
4. **Fill spare slots with:** G-7 (the withheld Cycle 079 work), E-7, E-8, N-7, N-8.
5. **After two heroes are live:** R-3 prop kits, W-17, W-18, R-4 weapons, then E-2 when the
   enemy sheets arrive.

**Acceptance bars, unchanged.** A hero at gameplay zoom is at least 12% of screen height with
skinned deformation and visible weight in the run. Six enemy roles are distinguishable by
silhouette alone in grayscale. No screen is more than half undressed flat ground. Every weapon
has its own fire, reload, empty and impact sound. No developer text is visible without a flag.
Tuning cites the long-run simulation. Every release carries a real-browser production
verification with deployment and rollback recorded.

**Boundaries, unchanged.** Fixed 60 Hz simulation and same-seed determinism; art is
projection-only and may never change collision, damage, AI, spawning, RNG, progression or
results; the parent portal owns wallets, profiles, leaderboards, sessions and settlement;
`SETTLEMENT_LIVE=false`; Chikun's Escape keeps its certified replay and SDK boundary.
