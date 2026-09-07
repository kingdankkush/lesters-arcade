# Hard Money Heroes — gameplan review and task additions for Hermes

Date: 2026-09-07 PDT
Author: Claude Fable 5.1
Reviewed: `hermes/hmh-cycle-080-corpse-audio` at `1c81d23c` (live production
`dpl_HskTDVZr72FVDUD7zHnZTHRCtmCx`), cycles 075, 077, 080, the STACKED S-01 to S-03
integration, the Cycle 080 handoff, the committed reference art and Tripo sources, and the
live game played on production at desktop and phone sizes.
Purpose: an honest audit of the visual-upgrade program since the Cycle 074 handoff, the
defects found, and the work that is missing or unfinished, written so Hermes can add every item
here to its work list. Task IDs continue the register in `docs/hmh-reboot/AAA-ROADMAP.md`.

---

## 1. Verdict on cycles 075 to 080

**Release discipline is excellent and should not change.** Every cycle has an exact staged
patch digest, a clean no-git Node 24 host build, byte-level production proof, browser evidence
at five profiles, and a machine-readable certificate. The reference art intake with LFS
pointer verification and the Tripo selector pipeline with two-run zero-drift proof are real
engineering.

**The visual-upgrade objective itself barely moved.** Since the Cycle 074 handoff:

| Area | Change since 074 | Player-visible? |
| --- | --- | --- |
| Gameplay hero models | none; all four heroes are still the procedural primitive builds at 160 px | no |
| Character-select turntables | replaced with textured Tripo renders at 384 px (Cycle 077) | yes |
| Enemies | none; roster unchanged; one unbound zombie candidate rendered but not accepted | no |
| Weapons and pickups | none; eleven weapon and grenade reference PNGs committed | no |
| World, terrain, props, level design | none | no |
| Combat and balance | Cycle 079 rebalance built and withheld (two Burner review findings) | no |
| Feel and polish | death confirmation respects reduced motion and flash, pooled particles, corpse lifetimes, audio voice cleanup, upgrade card pointer latch | marginal |
| STACKED cabinet | S-01 to S-03 deterministic core (about 1,250 lines) integrated and live but not publicly playable | no |

Roughly half of the effort went to STACKED and release plumbing. Nothing in the roadmap's
Phase 1 (hero pilot) landed in the game, and the one attempt to render the Tripo Commando at
256 px stopped at the 3.25 MiB per-hero atlas cap after eight lossless trials without the
blocker being escalated as an owner decision. The atlas format memo from Cycle 074 is still
unanswered in `DECISIONS.md`, and that single decision gates the whole hero program.

**Direction for Hermes:** the owner's standing priority is the gameplay heroes, then enemies,
then the world. STACKED should pause at its current accepted boundary until Phase 1 ships
unless the owner says otherwise.

---

## 2. Defects found on production (fix first, each is one bounded slice)

Each item lists the repro I observed and the file to start from.

- **B-1 Touch devices get the keyboard controls hint.** On a 390x844 touch profile the
  first-run hint card reads "WASD move · Mouse aim · Right click grenade · 1-4 weapons · Esc",
  none of which exists on a phone. The copy is static in `apps/portal/hmh-reboot/index.html`
  (the `hmhControlsHint` aside). Fix: choose the copy from the same touch detection the cockpit
  already uses (MOVE and AIM sticks, SWAP, POWER, double-tap MOVE to dash, pause button), and
  add a RED test plus a mobile-controls smoke assertion on the hint text.
- **B-2 The hint card sits over the middle of the phone play area** and stays for 12
  seconds, covering the hero. Dock it under the cockpit or above the sticks and shorten it on
  touch profiles.
- **B-3 Home page ad strip overlaps the featured-cabinet card** at 1440x900 (the bottom
  "PLACE YOUR AD HERE" band draws across the Hard Money Heroes cabinet card). Layout bug in
  the portal splash; add a containment assertion to the portal E2E.
- **B-4 The hashwood landmark swallows the player.** On the hashwood world tour the beacon
  landmark renders as a huge semi-transparent teal cone directly over the spawn and the hero
  stands inside it. Either the landmark scale, its placement relative to the tour spawn, or
  its alpha is wrong; landmarks should never overlap the hero spawn disc. Check the Cycle 074
  set-piece composer anchors and the `LANDMARK` scale range in `authored-prop-atlas.mjs`.
- **B-5 Select-screen turntables under-use the frame and read dark.** In the Tripo
  selector atlases the figure fills about 60 percent of the 384 px frame, and the render is
  low-key: the red bandana, armband and headband that define Commando and Valkyrie barely
  read. Re-frame the camera to fill about 85 percent of the frame height, lift exposure toward
  the hero rig's -0.45 with the shared warm rim, and re-verify with the two-run gate.
- **B-6 Select-screen copy contradicts the reference art.** Lit Commando's card says "dark
  mohawk"; the reference is a dark mullet with a swept fringe. Audit all four bios against
  `REFERENCE-CHARACTER-MODELS.md` once that file is reconciled (see H-1).
- **B-7 "COMBO RESET ×0" is shown when no combo exists.** The label should read "COMBO"
  or hide until the first hit; "RESET" reads as an error state.
- **B-8 Documentation drift.** `AGENTS.md` now has two "0." read-order lines pointing at
  different "current" handoffs; `AAA-ROADMAP.md` has not been reconciled since Cycle 074 (075,
  077, 080 and STACKED are unregistered); `docs/stacked/STACKED-MASTER-PLAN.md` still says
  "NOTHING IS BUILT" while `STATUS.md` records S-01 to S-03 live. Make the read order one line,
  add a "Current live override — Cycle 080" block, classify every new task ID, and stamp the
  STACKED plan with its status.
- **B-9 Repository health gate fails at 405 MB against 350 MB** because of raw expanded
  sources (recorded, not waived). Decide with the owner: move expanded intermediates out of
  the tree, or raise the limit deliberately with a note.
- **B-10 Desktop p99 frame time rose to about 16.5 ms in Cycle 074** (from 8.6) with the
  atmosphere pool's first fill and the 402-entry authored set. Still far inside the 70 ms
  budget, but it has not been investigated. Profile the first-fill spike and pre-warm the pool
  on session start.
- **B-11 Mining-camp atmosphere density is at the strong end** (grey haze reduces contrast
  noticeably). Owner should look; a 30 percent density reduction is my recommendation.

---

## 3. The hero program: what is actually blocking it and how to unblock it

State: four Tripo GLBs (16 to 17 MB each) are committed under LFS at
`apps/hmh-reboot/assets/source/models/tripo-selector/`, the reference art is committed under
`assets/source/reference/heroes/`, the selector renders from those GLBs, and the gameplay
manifest `hmh-production-heroes.json` still has zero `sourceModel` entries. The importer, waist
split, look-dev group, clip-action exporter branch and schema v2 from Cycle 072 exist and were
proven on a fixture only.

- **H-0 Owner decision, blocking:** the atlas format and per-hero cap (roadmap 8.3.2). Hermes
  must present the numbers, not wait silently. Measured facts: Commando 648 frames at 256 px did
  not fit 3.25 MiB as lossless PNG in eight trials; lossless WebP exact is about 23 percent
  smaller; per-hero lazy loading already exists in `main.mjs`. Present three options with
  measured bytes for the actual Tripo Commando frames: (a) lossless WebP exact at 256 px under
  a 4 MiB per-hero cap, (b) 224 px frames as PNG under the current cap, (c) 256 px PNG with the
  cap raised to 4 MiB and the total raised to 16 MiB. Record the choice in `DECISIONS.md`.
- **H-1 Reconcile `REFERENCE-CHARACTER-MODELS.md` to the committed reference art** using the
  identity blocks in the Cycle 074 handoff section 5.2, and fix the select copy (B-6).
- **H-2 Rig and skin the four Tripo GLBs for gameplay.** Tripo auto-rig or Mixamo auto-rig,
  retargeted so the fourteen runtime bones exist (`root, pelvis, spine, chest, head,
  upper_arm.L/R, forearm.L/R, thigh.L/R, shin.L/R, weapon_socket`), weights corrected at
  shoulders, hips and the waist seam, coat and hair bones for Lilly, a rigid sphere head for
  Lester. Commit rigged FBX/GLB as LFS source with SHA in the manifest.
- **H-3 Author the nine clips per hero** (`idle, run, aim, pistol-fire, hurt, dash, melee,
  grenade, death`) with the frame counts and fps the manifest declares; Mixamo clips as a
  starting point are acceptable if committed as source. Weight shift, foot planting, recoil
  and recovery, distinct deaths.
- **H-4 Gameplay pilot for Lit Commando** behind `?productionHero=lit-commando` with the
  chosen format: importer, waist split verified under maximum torso rotation, four-layer
  composition, two-run reproducibility under the hero budget (8 / 2 / 32), hero-vs-enemy parity
  band 0.8 to 0.9, side-by-side against the reference front render at 100 percent, hero-crop
  visual checks on frontier-relay desktop and mobile. Then Valkyrie, Lilly, Lester, one cycle
  each.
- **H-5 Selector regeneration from the same rigged source** so the select screen and gameplay
  show the same model (the current selector uses the static GLBs and will diverge).
- **H-6 Packed-texture handling in the hero pipeline.** `external_dependencies()` in
  `create-hmh-commando-concepts.py` still counts packed images as external and the runner
  rejects a non-zero count; real Tripo GLBs carry packed textures. Fix before H-4 (known since
  Cycle 072, still open).
- **H-7 Weapon socket geometry.** The Tripo models have no `weapon_socket`; the importer
  creates one, but the eight weapon meshes must be re-authored or scaled to the new hand size
  and pose. Ship the pistol first.

---

## 4. Enemies

- **E-2 (owner-gated) Enemy models from reference art.** Not started; the owner has produced
  no enemy sheets yet. Ask for them using the 8.1.2 prompt in the roadmap, one per role, plus
  three Liquidator phase sheets.
- **E-7 Accept or discard the zombie candidate.** The Cycle 080 handoff records an unbound
  zombie that rendered 152 frames with zero drift but lacks the roster identity details
  (silhouette prop, faction colour, accent). Either bind it to a role with those details or
  archive it; do not leave a third enemy pipeline half-alive.
- **E-3 follow-up: tell readability at gameplay zoom.** Cycle 074 widened tells in the
  atlas; nobody has measured whether a player sees the tell before damage at 120 px. Record a
  short clip per role at 100 percent and count frames between tell and hit.
- **E-6 Boss depth** still waits on **G-1 swarm benchmark** evidence; both remain open.
- **E-8 Boss atlas at 96.6 percent of its cap** and the roster reproducibility margin at 7 of
  8 changed pixels: fragile. Split the three Liquidator phases into three atlases before the
  next roster change, and add a drift-trend check to the pipeline report.

## 5. Weapons, pickups, power-ups

- **R-4 Weapon models from the committed references** (eleven weapon and grenade PNGs are
  in `assets/source/reference/`). Tripo them or model them in Blender through the prop
  pipeline; pistol, shotgun, auto-miner, launcher first because they are the Digit 1 to 4 slots.
- **R-5 Power-ups as objects**, not octagonal badges: small 3D pickups with an emissive
  accent and the existing bob.
- **W-8 follow-up:** camp props are placed but campfires do not emit light or embers; add a
  pooled emitter tied to the atmosphere layer.

## 6. World and level design

- **W-11 simulation half** (real height gameplay beyond ledges) and **W-12 secrets** untouched.
- **W-9 town district** waits on the owner's 8.3.1 decision; ask again with the two options.
- **W-17 Hashwood tree line reads as a flat green band** across the top of the frame (capsule
  thicket blockers drawn as a continuous strip). Break it into individual canopy clusters with
  depth like the cliffs got in Cycle 073.
- **W-18 Yard slab grid** still reads as a regular checkerboard at gameplay zoom; vary slab
  size and add cracks and stains in the bakery.
- **W-19 Prop palette.** The Cycle 073 and 074 density work placed the existing 45 procedural
  props (pastel boxes, cones, cylinders). They are now the most visible quality ceiling in the
  world scenes. This is R-3 (Blender modular kits: town, camp, industrial, bridge) and it should
  be scheduled right after the first two heroes land.
- **W-16 Level 2 planning** only after Level 1 meets the World bar; not yet.

## 7. Combat, movement, controls

- **G-7 Reconcile Cycle 079 onto the live boundary** and fix the two Burner findings before
  publishing: automatic defeat-spread must not create burns on neutral actors before damage
  filtering, and automatic refresh must not overwrite a manually initiated burn's causal
  origin. Both need RED tests and a same-seed replay note.
- **G-1 swarm benchmark, G-3 melee role, G-6 benchmark re-run per simulation change** remain
  open and gate every balance claim.
- **K-6 dash input buffering, K-3 action-map audit, K-4 rebinding UI completeness, K-5
  movement-feel report** remain open.
- **K-8 Touch hint and touch onboarding** (B-1, B-2) plus a first-run touch tutorial beat:
  show the sticks pulsing once.

## 8. UI, audio, portal

- **U-8 Death and run-summary screen** still unreviewed as a player flow; play it on both
  profiles and fix what reads wrong.
- **U-9 HUD**: the "COMBO RESET" label (B-7); the eight-slot arsenal strip on phones is dense,
  consider collapsing unowned slots.
- **S-1 Audio expansion** (footsteps by material, reload and empty variants beyond the twelve
  now routed, boss cues, UI set) waits on the owner's sourcing policy (8.3.4); **S-4 mix pass**
  after it.
- **L-8 Key art** must be re-rendered from the new hero models when they exist; the portal is
  still Metal Slug pixel art while the game is 3D renders.
- **L-9 Trust pages** drafted for owner approval; **L-3 splash three clicks** and the ad-strip
  layout (B-3).

## 9. Platform and process

- **N-3 Roadmap reconciliation** for 075 to 080 and STACKED (B-8), and the read-order fix.
- **N-7 Pin the curated-level-kit inventory** to the `apps/portal/src` directory listing by
  test (Cycle 074 finding), so adding a portal module cannot desynchronise `dist/main.js`.
- **N-8 Certification visual-regression capture**: apply the per-profile browser relaunch to
  the visual harness too, and add hero-crop checks alongside the enemy-crop checks.
- **N-9 Repo health** (B-9).
- **N-4 remaining**: a lazy debug and evidence chunk (about 20 KB) needs a build change; not
  urgent at 57 KB headroom.
- **P-8 Pipeline fragility**: the roster gate margin (E-8) and the boss cap; record drift
  trends per run.

## 10. STACKED

Accepted S-01 to S-03 are live but not playable; S-04 is blocked on a policy-denied write
that needs owner direction. Recommendation: hold STACKED at this boundary until H-4 ships for
two heroes, then resume. If the owner wants STACKED in parallel, it needs its own agent budget
so hero work stops being displaced. Fix the STACKED plan status header (B-8) either way.

---

## 11. Owner decisions needed now

1. **Atlas format and hero cap (H-0).** Without it no Tripo hero can ship in gameplay.
2. **Enemy reference sheets (E-2)**: six roles and three boss phases, using the roadmap prompt.
3. **STACKED priority** relative to the hero program, and direction on the S-04 policy block.
4. **Town district scope (8.3.1)** and **audio sourcing (8.3.4)**, both still unanswered.
5. **Repo health limit (B-9)**: move expanded sources or raise the limit.
6. Look at the mining haze (B-11) and the select-screen turntables (B-5) and say whether they
   match your taste.

## 12. Suggested order for Hermes

1. Cycle 081: B-1, B-2, B-3, B-4, B-7 (all small, all player-visible), plus B-8 docs.
2. Cycle 082: H-0 memo with measured Tripo Commando bytes for the three options; H-1; H-6; B-5.
3. Cycle 083 onward: H-2 to H-4 for Lit Commando, then Valkyrie, Lilly, Lester; H-5 after each.
4. In parallel where a slot is free: G-7 (079 reconciliation), N-7, N-8, E-7, E-8.
5. After two heroes are live: R-3 prop kits, W-17, W-18, R-4 weapons, E-2 when sheets arrive.

Acceptance bars are unchanged from `AAA-ROADMAP.md` section 2: a hero at gameplay zoom is at
least 12 percent of screen height with skinned deformation and visible weight in the run; a
fresh player reaches a running game in three clicks; no developer text is visible without a
flag; every release carries a real-browser production verification with deployment and rollback
recorded. Preserve the fixed 60 Hz simulation, projection-only art, parent authority and
`SETTLEMENT_LIVE=false` throughout.
