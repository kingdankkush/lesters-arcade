# Lester's Arcade + Hard Money Heroes — AAA roadmap

Status: standing roadmap authority for sequencing and unmet AAA outcomes, reconciled through Cycle 071 source truth
Created: 2026-09-02 by Claude Fable 5.1 from a review through Cycle 049; imported and reconciled by Hermes against the Cycle 070 baseline and Cycle 071 candidate on 2026-09-02
Owner: Justin Pinter
Audience: every future agent (Claude, Hermes, or otherwise) and the owner

This document tells any agent what has to be fixed, built, or improved for Lester's
Arcade and Hard Money Heroes (HMH) to reach AAA roguelike quality, which of that work an
agent can do alone, and which parts need the owner's hands. It does not replace the
task-level detail in `docs/handoffs/2026-08-03-hmh-upgrade-program-hermes-tasks.md`
(task IDs like T1, A6, U11 below refer to it), the current release handoff, or
`MAINNET-READINESS-ROADMAP-2026-09-01.md`. The originally cited
`docs/handoffs/2026-09-02-hmh-visual-overhaul-review-and-external-model-pipeline.md`
is not present in this checkout, so it is not an active authority. This roadmap owns
program sequencing and acceptance outcomes; current source and the current release
handoff own implementation and production truth.


## Reconciliation baseline — Cycle 070

This section corrects the original Cycle-049-era snapshot before the roadmap is used as
standing authority.

- Repository/documentation HEAD: `12150acc939e311754eeedb3352f79362e9c85f9` on
  `hermes/hmh-cycle-070-gameplay-ui-music`.
- Production runtime boundary: `200757e2092b4632903affde91df53a1b56ad72a`.
- Production deployment: `dpl_HAeCyfAG6SDK5x1LruxTMix2CBmQ`; rollback:
  `dpl_GBtodAeLfrK7hVL3HWWaZ12RHFHs`.
- Release ledger: `2,282` evaluated, `2,231` passing, `51` accepted legacy failures,
  `0` unexpected failures.
- HMH initial-JS evidence at the Cycle 070 candidate: `948.5 KB / 1.00 MB`, `76.9 KB`
  headroom. Remeasure after every code slice.
- `SETTLEMENT_LIVE=false`; website promotion does not authorize contracts, wallets,
  LitVM writes, Mainnet activation, authority changes, or real funds.
- Chikun's Escape is public playable and Ranked-eligible. Keep its parent-owned replay,
  seed, SDK, and score boundaries intact; paid entry remains disabled.
- Git LFS `3.7.1` and Blender `5.1.2` are installed on the current Windows host.
- The Vercel automation-bypass secret is unset, but Cycle 070 Preview, promotion, hosted
  byte checks, and real-browser production verification succeeded without it. Treat a
  bypass secret as a contingency only if deployment protection starts returning 403.

### Current live override — Cycle 071

- Runtime commit: `f232817782509c49ea6e2b6f76ed9a61f82fc4b9`.
- Production: `dpl_5HbBQf21BFoPzucGvijjcefygcDS`; immediate rollback:
  `dpl_HAeCyfAG6SDK5x1LruxTMix2CBmQ`.
- Release ledger: `2,283` evaluated, `2,232` passing, `51` accepted legacy failures,
  `0` unexpected.
- Cache: `lesters-arcade-v24-hmh-encounter-truth`.
- Hosted desktop, ultrawide, tablet, portrait, landscape, touch-control, portal, and
  network/console checks passed on `https://lestersarcade.io`.

### Current live override — Cycle 073

- Runtime commit: `f764ac75`.
- Production: `dpl_EQekrTvicPuJ95Qzfn33D7s8Z4dw`; immediate rollback: `dpl_FMqS2vbPBq1Na12m33ER9K7Ho27w`.
- Release ledger: `2,429` evaluated, `2,378` passing, `51` accepted legacy failures, `0` unexpected.
- Combined initial JS: `1,020,059 / 1,050,000`; headroom `29,941` (the binding constraint for
  the next code slice; N-4 is now worth a cycle).
- Cache: `lesters-arcade-v26-hmh-feel-and-world`.
- Completed this cycle: `P-4` (and its duplicate `E-1`), `V-1`, `V-2`, `V-3`, `U-4`, `U-5`,
  `W-7`, `W-8`, `P-5`, `K-7`; `W-11` projection half and `W-5` cliff half shipped (the
  remaining W-11 simulation verticality and W-5 fence/machinery/building props stay open).
- Defect found and fixed in production art: Pixi `arc()` without `moveTo()` drew stray lines
  from the screen origin over hashwood canopies and landmark beacons; guarded by
  `tests/hmh-reboot-graphics-arc-origin.test.mjs`.
- Hosted desktop, ultrawide, tablet, portrait, landscape and network checks passed on
  `https://lestersarcade.io`.

### Current live override — Cycle 072

- Runtime commit: `414fc3049`.
- Production: `dpl_FMqS2vbPBq1Na12m33ER9K7Ho27w`; immediate rollback: `dpl_5HbBQf21BFoPzucGvijjcefygcDS`.
- Release ledger: `2,339` evaluated, `2,288` passing, `51` accepted legacy failures, `0` unexpected.
- Combined initial JS: `985,956 / 1,050,000`; headroom `64,044`.
- Cache: `lesters-arcade-v25-hmh-visual-facelift`.
- Completed this cycle: `W-1`, `W-3`, `W-4` (partial: shore and scree bands; shallows
  band still open), `W-14`, `U-2`, `U-3`, `K-1`, `P-1`, `P-2`, `P-3`.
- `P-4` attempted and deliberately not shipped: the two-run reproducibility gate
  failed with `68 / 1,368` frames drifting under EEVEE. Tolerance was not widened.
  Next step is recorded in `cycles/CYCLE-072.md`.
- Hosted desktop, ultrawide, tablet, portrait, landscape and network checks passed on
  `https://lestersarcade.io`.

### Work already completed after the original review baseline

Current source and focused tests prove these roadmap outcomes already exist. Do not
rebuild or regress them: shared child design tokens (U-1); pause controls card and
first-run hint (K-2); explicit simulated-wallet disclosure (L-1a); medianized forced-GC
heap sampling (N-1); canonical bounded run-summary authority (D-1); deterministic
long-run balance matrices (X-1); deterministic XP sources, critical progression, pistol
depth, enemy-band rebalance, build summary, and combo feedback (X-2 through X-7);
Hash Rail and Lightning Ledger plus two later bounded weapon slices (G-2); portal route
modularization and legacy backstage retirement (L-7); per-weapon fire cues for eight
weapons; and portal-owned pause soundtrack continuity (U-7/S-3).

### Phase 0 source-truth seam added by Cycle 070 evidence

- [x] **T-0a enemy role truth:** Cycle 071 canonicalizes Whale Enforcer encounter role
      `bruiser`; every applied role must match the final archetype.
- [x] **T-0b projectile budget truth:** Cycle 071 routes every exported encounter-band
      projectile budget through `MAX_ACTIVE_PROJECTILES = 128`.
- [x] Preserve and extend the direct canonical authority tests; Cycle 071 adds the
      cross-district/cross-band final-role and runtime-cap assertions to that harness.

### Task classification register

Every material task ID in this roadmap is classified exactly once below against the
Cycle 070/071 source boundary. A checked task is not permission to remove its regression
coverage.

- **Already complete (18):** `T-0a`, `T-0b`, `G-2`, `K-2`, `X-1`–`X-7`, `U-1`,
  `U-7`, `S-3`, `L-7`, `D-1`, `N-1`, `L-1a`.
- **Valid and actionable (68):** `P-1`–`P-4`, `P-7`, `C-2`, `C-4`, `C-5`, `E-3`,
  `E-4`, `E-6`, `W-1`–`W-8`, `W-10`–`W-16`, `R-1`, `R-3`–`R-6`, `V-1`–`V-6`,
  `G-1`, `G-3`, `G-6`, `K-1`, `K-3`–`K-7`, `U-2`, `U-4`–`U-6`, `S-2`, `S-4`,
  `L-3`, `L-5`, `L-6`, `L-8`, `D-2`, `D-3`, `N-4`, `N-6`, `B-1`–`B-5`,
  `M-1`–`M-3`. The `B-*` preparation is source/test/runbook work only; deployment,
  broadcast, keys, authority, economy, settlement, and real funds remain prohibited.
- **Useful but must be narrowed to current source or split at an owner gate (12):** `P-5` (Git LFS is already
  installed; only policy/verification remains), `U-3` (enhance the existing cockpit HUD,
  do not rebuild from a telemetry-only premise), `U-8` (verification/polish task, not a
  missing-flow fix), `S-1` (eight weapon fire cues exist; remaining reload/empty/impact,
  footsteps, boss/UI and mix gaps stay open), `L-1` (`L-1a` mock disclosure is complete;
  remaining connection/error/signature states stay open), `N-3` (roadmap/read order are
  integrated, while the protected `AGENTS.md` checkpoint block still needs an approved
  truth refresh), `N-5` (automation bypass is a contingency, not a current promote
  blocker), `P-6` (run the format harness first; owner chooses the shipping format),
  `L-2` and `L-4` (audit/prepare now; owner decides public seed/cabinet policy), `L-9`
  (draft now; owner/counsel approves public trust copy), and `N-2` (audit/propose now;
  deletion requires owner approval).
- **Duplicate/covered elsewhere (3):** `E-1` duplicates `P-4`; `G-4` duplicates `S-1`;
  `G-5` duplicates `E-6`. Keep one implementation cycle and update both references.
- **Owner-input gated before implementation can start or finish (7):** `C-1`, `C-3`,
  `C-6`, `E-2`, `E-5`, `W-9`, and `R-2`. Do not fabricate the missing model inputs or
  decide the town/atlas scope on the owner's behalf.
- **Unsupported by current source:** no source-backed task ID is discarded. The absent
  `2026-09-02-hmh-visual-overhaul-review-and-external-model-pipeline.md` cannot support
  additional claims until committed; the original `1,846`-test count, Coming Soon Chikun
  status, silent mock-wallet claim, missing controls/run-summary/long-run claims, one-
  weapon-audio claim, under-10-KB headroom claim, and mandatory Vercel-bypass claim were
  rejected as stale snapshot facts.

This register covers `108` unique IDs, including the two Cycle 071 source-truth items and
`L-1a`; future edits must keep every ID in exactly one class.

---

## 0. How to use this document

**Agents:**

1. Read `AGENTS.md`, then the current release handoff it names, then this file, then the task-level source named by the selected item.
2. Pick the lowest-numbered phase in §7 that has unfinished work. Inside it, pick the
   first task whose dependencies are done. Never skip a phase because a later one looks
   more fun; the ordering encodes dependencies, not preference.
3. Every task is one bounded cycle under the discipline in §1.3. One cycle, one ledger
   entry in `docs/hmh-reboot/cycles/`, one implementation commit, one closeout commit.
4. When you finish a task, tick it here (`[x]`) in the closeout commit, and add to §9 any
   failed approach with its evidence so nobody repeats it.
5. If a task needs something only the owner can do (marked **OWNER**), do every part
   that does not depend on it, then write the exact ask into §8.4 "Open asks" and stop
   that task. Do not fake, mock, or work around an owner gate.

**Owner:** your work is consolidated in §8. Everything there has step-by-step
instructions. §8.4 is the live list of things agents are waiting on you for.

---

## 1. Non-negotiables

### 1.1 Architecture and safety (from the 036 handoff; unchanged)

- Fixed 60 Hz simulation, maximum four catch-up steps. Same-seed determinism and replay
  integrity. Any change to collision, damage, AI, spawning, RNG, progression, or results
  is a **simulation change**: RED tests first, determinism review, replay-divergence note.
- Art, VFX, particles, shaders, audio, animation, LOD, camera presentation are
  **projection-only** and may never change simulation results.
- Parent portal owns wallets, profiles, leaderboards, analytics, canonical sessions,
  official completion, settlement. The HMH child never requests wallets or signatures,
  never sends transactions, never writes parent persistence.
- Free Mode never advances Ranked progress.
- `SETTLEMENT_LIVE=false`. No contract deployment, transaction, authority change, or
  settlement activation without a separate explicit HALT approval from the owner.
- Preserve: alias `hmh`, game ID `lester-blaster`, profile `wo71`, save schema `2`,
  bridge `hmh-bridge/v1`, 65,536-byte bridge message cap, PixiJS `8.19.0`.
- Active actors read as human survivors or zombies. No animals, vehicles, robots, mechs,
  or abstract proxies as actors. Do not reactivate retired isometric/pixellab actor art.
- Chikun's Escape is public playable and Ranked-eligible; preserve its certified parent replay/SDK boundary and keep paid entry disabled until separately approved.

### 1.2 Asset provenance (amended 2026-09-02)

- Every **shipped pixel** must regenerate from repo-owned source through a repo-owned
  pipeline (Blender scene or committed model + Python exporter + manifest). No
  hand-painted or one-off AI-generated sheets, no manual retouching of a shipped atlas.
- **Committed source meshes are allowed.** A GLB/FBX produced outside the repo (Tripo,
  Mixamo, hand-modelled) and committed under `apps/hmh-reboot/assets/source/models/`
  with its SHA-256 in the manifest is repo-owned source, exactly like the `.blend` files.
  The render out of the exporter is what must be reproducible.
- Reference images (ChatGPT sheets, owner-supplied art) stay **outside Git** unless the
  owner explicitly commits them; their distilled contract lives in
  `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md` and the reference manifest.
- Audio has the same rule in spirit: every shipped sound is committed with a license
  note in `apps/portal/assets/audio/sfx/sfx-manifest.json` (source, license, attribution).

### 1.3 Cycle discipline (this keeps working; do not shortcut it)

Health check → one bounded slice → RED tests observed failing → implement → full gates
**sequentially** (never two browser smokes at once) → inspect visual evidence by eye at
full resolution → exact-index adversarial review with numbers the reviewer can recompute
→ fix → re-review → commit implementation → commit closeout → push → promote only under
the owner's standing approval → verify production in a real browser → record deployment
ID and rollback in the cycle ledger.

Gate commands (verified in `package.json` 2026-09-02):

```bash
npm run check
npm test
npm run test:release
npm run build
npm run visual:reboot
npm run certify:hmh:browser
npm run smoke:hmh:performance
npm run smoke:hmh:mobile-controls
npm run assets:qa:hmh-reboot
npm run docs:links
npm run contracts:check
```

Asset pipelines and their reproducibility proofs:

```bash
npm run assets:hmh:production-hero-pilot
npm run assets:hmh:enemy-roster && npm run assets:hmh:enemy-roster:verify
npm run assets:hmh:authored-props && npm run assets:hmh:authored-props:verify
npm run assets:hmh:terrain
npm run assets:hmh:atlas-roster
```

Environment traps: browser smokes remain serial; serve `apps/portal` on 8899 and pass
`HMH_REBOOT_ORIGIN` if 8791 is bind-blocked; the forced-GC heap gate uses median samples
and gets at most one variance rerun; and every code change ships with fresh entry,
vendor, and combined initial-JS accounting. Cycle 070 had 76.9 KB of combined headroom.
Production automation currently works without a bypass secret; add one only if deployment
protection begins returning 403.

---

## 2. What AAA means here (measurable bars)

An agent should be able to say yes or no to each of these. Until all are yes, the
program is not done.

| Bar | Test |
| --- | --- |
| Characters | A hero at gameplay zoom is at least 12 percent of screen height on desktop, has skinned deformation, visible weight shift in run, distinct anticipation/impact/recovery in every action clip, and reads at a glance against any district ground. |
| Enemies | Six roles are distinguishable by silhouette alone at swarm density in grayscale. Every attack has a visible tell before damage. Boss has three visually distinct phases. |
| World | No screen at gameplay zoom is more than 50 percent undressed flat ground. Roads read as surfaces with shoulders. Every district has one landmark you can name from a screenshot. Height changes read as height, not colour. |
| Feel | Every weapon has its own fire, reload, empty, and impact sound and its own muzzle/impact VFX. Hits, kills, level-ups, and pickups each have a distinct audiovisual beat. |
| UI | No developer telemetry is visible without a debug flag. HUD uses the shared design tokens. A first-time visitor reaches a running Free game in three clicks or fewer. |
| Balance | Tuning decisions cite the long-run simulation and the swarm benchmark. No value changes without a report. |
| Performance | Bundle, heap, p95 frame-time, mobile decode, and asset budgets all green on the certification suite, with published numbers in the ledger. |
| Trust | Wallet states are explicit (no silent mock). Leaderboards show provenance. Docs describe the build that is live. |
| Evidence | Every release has a real-browser production verification, a deployment ID, and a rollback recorded. |

---

## 3. Where the project stands (2026-09-02)

**Strong and finished enough:** deterministic simulation and replay; bridge contract;
world contract (6 districts, 38 blockers, 25-node route, elevation, navgrid flow field);
eight-weapon deterministic combat with per-weapon progression; two-choice level-up;
grenades; touch, keyboard, and gamepad input; minimap with fog and POI discovery;
2,282-test release ledger with zero unexpected failures; 12-scene visual regression;
browser certification across five device profiles; reproducible Blender pipelines with
SHA gates; Vercel Preview promotion; portal identity; canonical run-summary and long-run
balance systems; explicit simulated-wallet disclosure; and real EIP-1193/EIP-6963/SIWE
wallet code. Portable contract structure checks pass; local `forge test` was unavailable
on the Cycle 070 Windows host, and no current hardened contract is deployed.

**Blocking the AAA bar:** actors still come from reproducible procedural Blender
geometry on rigid rigs rather than imported skinned hero/enemy meshes; enemies render in
Workbench while heroes render in EEVEE; terrain, roads, remaining vector blockers, and
landmark fidelity still need the authored passes below; and the real HUD/onboarding/audio
experience does not yet meet every measurable §2 bar.

**Major remaining gaps:** per-material footsteps and complete per-weapon reload/empty/impact
identity; external-model import/skinned-action tooling; encounter role/projectile-budget
truth; camera/director decoupling; denser authored world composition; broader input
settings; trust pages; and physical first-time-player evidence. The portal entry remains
large even after completed route modularization, so bundle accounting is mandatory.

Current evidence: the Cycle 070 release handoff, `MAINNET-READINESS-ROADMAP-2026-09-01.md`,
current source, and current tests. The originally cited visual-overhaul handoff is absent.

---

## 4. Work streams

Each stream lists: where it is, where it must get to, **agent work** (ordered, with
files and acceptance), and **owner work** (what only the owner can do, with the §8
section that explains how). Task IDs in brackets refer to the 2026-08-03 backlog.

### 4.1 Asset pipeline and tooling

*Now:* four Blender pipelines (`hmh-character-pipeline`, `hmh-production-heroes`,
`hmh-enemy-roster`, `hmh-authored-props`) build meshes procedurally in Python and render
8 directions × clips × layers to atlases with two-run reproducibility gates. Blender
5.1.2 at `D:\Apps\Blender\blender.exe` is pinned. No importer for external meshes exists.

*Target:* one pipeline that accepts committed GLB/FBX sources, normalises them through a
shared look-dev pass, drives keyframed actions, and feeds the unchanged exporter, packer,
and gates.

**Agent work**

- [ ] P-1 `scripts/hmh-blender/import-hmh-external-model.py`: import GLB/FBX; scale to
      the actor's target height from the reference manifest; origin at ground contact;
      face −Y; split the skinned mesh at the waist into `lower-body` and `torso-head`
      objects sharing one armature; move weapon meshes to `weapon_socket`; apply the
      shared look-dev node group (three-band shading + rim, matching
      `hmh-light-rig.json`); save into the pipeline `.blend`. Accept: importing the same
      GLB twice yields byte-identical `.blend` object data.
- [ ] P-2 Skinned-actor exporter branch in `export-hmh-production-hero-pilot.py` and
      `export-hmh-enemy-roster.py`: when a manifest entry has `clipActions`, play the
      named Blender Action per clip and sample `frames` evenly instead of calling the
      trig `apply_pose`. Same directions, layers, filenames, packer. Accept: two-run
      reproducibility gate passes on a throwaway skinned mesh.
- [ ] P-3 Manifest schema bump for `hmh-production-heroes.json` and
      `hmh-enemy-roster.json`: `sourceModel`, `sourceSha256`, per-actor `frameSize`,
      `clipActions`, `lookDev`. Tests in `tests/hmh-reboot-*pipeline*.test.mjs` updated.
- [ ] P-4 Enemy roster render engine Workbench → EEVEE under the shared light rig, own
      cycle, before any new meshes. Accept: hero, enemy, and prop rendered side by side
      share key/fill/rim direction and colour; visual baselines re-accepted with intent.
- [ ] P-5 Git LFS policy: `.gitattributes` for `apps/hmh-reboot/assets/source/models/**`
      (`*.glb`, `*.fbx`, `*.png` textures), per-file cap 40 MB, textures ≤ 2048. Document
      in `BLENDER-ATLAS-PIPELINE.md`. Git LFS is already installed; verify tracking and
      a clean clone before the first source-model commit.
- [ ] P-6 Atlas format decision harness: measure PNG vs lossless WebP vs KTX2 for one
      256 px hero atlas on desktop and iPhone-13 profile (decode ms, GPU MB, bytes).
      Report to owner; **OWNER** decides (§8.3.2).
- [ ] P-7 Update `BLENDER-ATLAS-PIPELINE.md`, `REFERENCE-CHARACTER-MODELS.md`, and the
      ground rules in the 2026-08-03 backlog to record §1.2.

**Owner work:** §8.1 (produce models), §8.2.2 (Blender stays 5.1.2), §8.2.3 (Git LFS).

### 4.2 Playable characters (Lester, Lilly, Lit Commando, Lit Valkyrie)

*Now:* primitive-built, 160 px frames shown at 0.58 scale (~95 px tall), 9 clips with
2–6 frames each, no skinning, selector turntables upscaled from the same frames.

*Target:* skinned stylised models faithful to `REFERENCE-CHARACTER-MODELS.md`, 256 px
frames, weight and follow-through in every clip, selector turntables rendered at 512 px.

**Agent work**

- [ ] C-1 Lester pilot through P-1/P-2 at 256 px behind `?productionPilot=1&productionHero=lester-original`.
      Compare against the 160 px build in the same scene at 100 percent. [A12]
- [ ] C-2 Selector turntable regeneration from the same source at 512 px
      (`assets:hmh:atlas-roster`), and `?prefers-reduced-motion` guard on the rotator. [U3b]
- [ ] C-3 Lilly, Lit Commando, Lit Valkyrie through the same path, one cycle each.
- [ ] C-4 Animation pass on the actions: weight shift, foot planting, aim offsets per
      direction, recoil and recovery, hit reactions, distinct deaths. Projection-only;
      clip frame counts and fps stay in the manifest. [A13]
- [ ] C-5 Secondary motion where the reference doc allows it (scarf tails, hair groups,
      braid) as baked action, not runtime physics.
- [ ] C-6 Hero-atlas budget renegotiation implemented per the P-6 decision (per-hero
      lazy loading, WebP, or KTX2), with mobile decode measured in the perf smoke.

**Owner work:** §8.1.1 (one ChatGPT sheet + one Tripo/Mixamo export per hero; Lester
first), §8.3.2 (atlas format and budget decision).

### 4.3 Enemies and boss

*Now:* six roles plus the Liquidator, one shared body builder, Workbench flat render,
152 frames each, 6 clips; boss 456 frames, three phases with no visual transformation.

*Target:* silhouette-distinct roles readable in grayscale at swarm density, faction
colour coding, visible tells, damage states, boss per-phase transformation.

**Agent work**

- [ ] E-1 P-4 (EEVEE unification) first.
- [ ] E-2 Two roles per cycle through the external pipeline: `bagholder-rusher` +
      `forkrunner`; `liquidator-agent` + `whale-enforcer`; `gas-bomber` +
      `validator-cultist`. Frame size 192 px. [A14]
- [ ] E-3 Tell readability: anticipation/strike/recovery frames visually distinct
      without touching simulation timing; verify against `enemy-archetypes.mjs` windows.
- [ ] E-4 Elite treatment redesign (aura/crown/outline) on the new meshes.
- [ ] E-5 The Liquidator: per-phase model variants (`market-open`, `margin-call`,
      `total-liquidation`), arena-wide telegraph art, phase-transition beat. [A15]
- [ ] E-6 Boss fight depth as SIMULATION work: authored counters, add-wave pressure,
      arena use. RED tests, same-seed survival and TTK reports. [C5]

**Owner work:** §8.1.2 (one sheet + Tripo export per role and per boss phase).

### 4.4 World, terrain, and level design

*Now:* 11 terrain materials baked at 512 px, one per district; fringe strips at
boundaries; roads as a stroked ribbon; blockers and landmarks drawn as vectors in
`world-production-art.mjs`; 75 dressing placements; two ledges, four ramps.

*Target:* ground that reads as varied lit terrain, roads with shoulders and wear, real
set-piece landmarks, dense anchor-plus-satellite dressing, enemy encampments, a town
district, roofless interiors, more verticality, weather.

**Agent work**

- [ ] W-1 Terrain rebuild in `scripts/build-hmh-terrain-tiles.py`: bake tiles as lit
      micro-terrain (displacement, ambient occlusion, scattered pebbles/tufts), 2–3
      sub-materials per biome with a deterministic patch mask. Seamless verify. [T1]
- [ ] W-2 Deterministic decal layer above tiles, below props: ruts, scorch, blood/oil,
      cracked mud, footpath wear. Pooled sprites. [T2]
- [ ] W-3 Roads: remove the outline stroke; authored shoulders, edge blend, gravel and
      cracked-asphalt variants, centre-line decals. [T4]
- [ ] W-4 Shore and cliff bands: wet-sand gradient, foam lines, scree skirts. [T3]
- [ ] W-5 Blockers to props: replace vector cliff/fence/machinery/building blocker art
      with authored atlas modules aligned to the same collision shapes. Visible/physical
      agreement stays enforced by the composition tests.
- [ ] W-6 Set-piece landmarks: one authored multi-part landmark per district with a
      breathing ring. [A9]
- [ ] W-7 Density pass after each prop wave: clusters, district count overrides,
      corridor clearance green. [W1]
- [ ] W-8 Enemy encampments at spawn regions and arenas (camp kit). [W3, A7]
- [ ] W-9 Town district: **OWNER decision** first (§8.3.1) between converting part of
      `liquidation-yard` or adding a seventh district. Then A6 kit → W2 district. [W2]
- [ ] W-10 Roofless enclosures with authored entrances. [W4]
- [ ] W-11 Verticality: overlook platforms, sunken pits, terraces; elevation authority
      stays in the world contract. [W5]
- [ ] W-12 Secrets: caches behind destructibles, a hard-to-reach ledge cache, lore
      props. [W6]
- [ ] W-13 Weather layer within the particle budget: fog banks, embers, pollen, rain. [W7]
- [ ] W-14 Contact shadows and AO blobs under every prop and actor (projection-only).
- [ ] W-15 New visual regression scenes for every new district or set-piece. [P5]
- [ ] W-16 Level 2 planning only after Level 1 meets the §2 World bar. [W8]

**Owner work:** §8.3.1 (town scope decision), §8.1.3 (Tripo organics per biome).

### 4.5 World props and set pieces

*Now:* 45 authored props (26 world, 10 power-up, 5 pickup, 4 weapon), 128 px frames,
clean but blockout-grade. 346 KB of atlas headroom.

*Target:* a library of several hundred props: nature, water, rocks, industrial, camp,
town, bridge, landmark, weapon, pickup, and power-up models with consistent look-dev.

**Agent work**

- [ ] R-1 Extend `import-hmh-external-model.py` for static props (no rig): pivot,
      scale from a per-asset `worldHeight`, collision proxy generation, look-dev.
- [ ] R-2 Tripo organics wave 1 (from owner): trees ×6, boulders ×6, wrecked vehicles
      ×3, stumps/logs (vertical!), debris piles. Roster entries in
      `authored-prop-atlas.mjs`, district `propIds`, count-lock tests. [A1–A4, A11]
- [ ] R-3 Blender-authored modular kits (agents author these, not Tripo): town kit
      (shopfront, tenement, lean-to, stall, water tower, fuel island, signage, porch,
      fence/gate, streetlamp, mailbox, crates) [A6]; camp kit [A7]; bridge kit [A5];
      industrial/mining kit [A8]. Shared grid unit, pivots, collision proxies.
- [ ] R-4 Weapon and pickup models refresh; Hash Rail, Lightning Ledger, crit chip. [A10]
- [ ] R-5 Power-ups as objects, not badges: small 3D pickups with an emissive accent
      and an idle bob (projection-only).
- [ ] R-6 Per-asset `frameSize` 256/512 for landmarks and buildings; atlas budget check.

**Owner work:** §8.1.3.

### 4.6 Animation and VFX

*Now:* sprite flip with no interpolation; muzzle flash, hit rings, grenade VFX are
vector shapes in `main.mjs`, `grenade-vfx.mjs`, `combat-events.mjs`.

**Agent work**

- [ ] V-1 Per-weapon muzzle flash, shell eject, tracer, and impact sprites rendered
      through the prop pipeline (small atlases), selected by weapon ID. [C1]
- [ ] V-2 Surface-typed impact sparks and decals (dirt, rock, metal, water, flesh),
      directional blood/oil, death emphasis. Respect reduce-motion and reduce-flash. [C2]
- [ ] V-3 Grenade feedback set: arc shadow, fuse blink, bounce puff, fragment burst,
      camera shake tuned per class.
- [ ] V-4 Level-up, pickup, dash, and low-health beats as bounded particle bursts.
- [ ] V-5 Hero hit-flash and knockback readability on the new sprites.
- [ ] V-6 Camera: aim look-ahead, encounter framing, boss-phase zoom — **after** the
      encounter director is decoupled from `camera.zoom` (see 4.8 K-1). [M7]

### 4.7 Combat, weapons, grenades, power-ups

*Now:* pistol, scatter shotgun, auto-miner, launcher; per-weapon trees; grenades tuned
(047–048); melee thin and unreachable on touch; weapon benchmark v2 covers single targets.

**Agent work (SIMULATION unless noted)**

- [ ] G-1 Swarm-pressure benchmark extension: clear time, overkill, projectile pressure.
      This is the evidence for every balance decision below. [C6]
- [x] G-2 Hash Rail and Lightning Ledger pickups with finite reserve, HUD labels,
      upgrade trees, and models from R-4. [C3]
- [ ] G-3 Melee: give it a real role (finisher, ammo-free fallback, knockback tool)
      reachable on touch, or retire it explicitly. [C4]
- [ ] G-4 Per-weapon audio identity (projection) — see 4.11 S-1.
- [ ] G-5 Boss fight depth — see 4.3 E-6.
- [ ] G-6 Weapon benchmark and swarm benchmark re-run after every simulation change and
      attached to the cycle ledger.

### 4.8 Movement, controls, camera, physics

*Now:* deterministic movement, dash, collision, elevation, and pathing are solid.
Desktop weapon slots (Digit1–4) are undiscoverable. No rebinding. Navgrid build blocks
first paint (~400 ms). Camera zoom feeds the encounter director's spawn bounds.

**Agent work**

- [ ] K-1 Decouple encounter-director view bounds from `camera.zoom`
      (`apps/hmh-reboot/src/main.mjs` around the director bounds) to a fixed logical
      view. SIMULATION change with replay note. Prerequisite for any zoom or sprite-scale
      change.
- [x] K-2 Controls card on the pause menu and a first-run hint. [M1]
- [ ] K-3 Full action-map audit and in-game exposure. [M2]
- [ ] K-4 Rebinding, aim-assist toggle, stick sensitivity, left-handed touch layout,
      persisted parent-side. [M3]
- [ ] K-5 Movement-feel measurement report (input latency, accel/decel, diagonal
      normalisation, turn response) before tuning. [M4]
- [ ] K-6 Dash polish: buffering, edge forgiveness, landing dust, cooldown feedback. [M5]
- [ ] K-7 Chunked navgrid build sliced across idle time **before input binds** (the
      naive deferral was tried and reverted in Cycle 046). [M6]

### 4.9 Progression, XP, skill tree, balance

*Now:* XP `150 × level × (level+1)`, two deterministic choices per level, 10-entry
run-upgrade catalog 1:1 with power-up art, per-weapon trees. No long-run simulation.

**Agent work**

- [x] X-1 Long-run balance simulation: many full runs across hero × weapon × enemy;
      levels/minute, dead offers, build diversity, damage growth, survivability. Blocks
      every tuning task. [S1]
- [x] X-2 XP sources: Litecoin pickups and combo milestones, frame-rate independent. [S2]
- [x] X-3 Critical-strike branch: catalog entry, effect wiring, art asset, count-lock. [S3]
- [x] X-4 Pistol depth tree in one authoritative module with caps and deterministic
      rounding. [S4]
- [x] X-5 Enemy band rebalance from X-1 + G-1. [S5]
- [x] X-6 Build summary in the pause menu. [S6]
- [x] X-7 Combo system with bounded feedback. [D3]

### 4.10 Game UI (child HUD, menus, character select)

*Now:* HUD is a telemetry string plus a session debug panel; pause menu is good; four
settings toggles; child stylesheet ignores `design-tokens.css`.

**Agent work**

- [x] U-1 Child imports `apps/portal/src/design-tokens.css`; literal hexes replaced. [U1]
- [ ] U-2 Telemetry strip and session panel behind `?debugHud=1`; nothing developer-facing
      visible by default.
- [ ] U-3 Real HUD: hero portrait, health bar with pips, weapon card with ammo pips and
      reload ring, grenade count icon, dash cooldown ring, XP bar with level, combo
      readout, boss bar. Pixi-drawn, token colours, layout in `hud-layout.mjs`.
- [ ] U-4 Level-up cards: rarity colour, icon art from the power-up atlas, branch label,
      keyboard/gamepad selection.
- [ ] U-5 Settings: music/SFX volume sliders, input settings, controls card. [U9]
- [ ] U-6 Character select: side-by-side stat comparison, dot indicator on mobile
      carousel, arrow-key navigation, reduced-motion guard. [U3]
- [x] U-7 Pause-menu music transport (parent owns metadata, child sends intents). [U2]
- [ ] U-8 Death/summary screen polish on the parent `finalizeGameOver` path (present,
      do not "fix" — verify by playing). [U12]

### 4.11 Audio

*Now:* eight weapons have distinct in-repo-generated fire cues, shared reload/empty cues
exist, and Cycle 070 preserves the portal-owned soundtrack through HMH pause/resume. The
remaining gap is complete reload/empty/impact identity, per-material footsteps, category
routing/ducking, license-manifest closure, and a measured mix pass.

**Agent work**

- [ ] S-1 SFX library expansion: per-weapon fire/reload/empty/impact; footsteps by
      terrain material (read the ground query, projection-only); dash; level-up; upgrade
      select; boss phase cues; low-health; pickup variants; UI navigation. Every file
      logged with license in `sfx-manifest.json`. [X1]
- [ ] S-2 Route the child through `hmh-audio-system.mjs`: categories, voice allocation,
      distance attenuation, ducking under boss telegraphs. [X2]
- [x] S-3 Music continuity across portal → HMH where browser policy allows. [X3]
- [ ] S-4 Mix pass with measured LUFS targets per category recorded in the ledger.

**Owner work:** §8.3.4 (SFX source and license decision; optional generated SFX).

### 4.12 Portal: splash, cabinets, profile, leaderboards, achievements, wallet

*Now:* strong identity, jukebox, real wallet path. Gaps listed in U4–U11 of the backlog.

**Agent work**

- [ ] L-1 Wallet truthfulness: label the mock-wallet state explicitly; add a connecting
      state; wire the existing sign-out; explain what the signature does before
      prompting; explicit states for wrong network, unsupported wallet, rejected
      request, read-only profile, testnet Ranked, unavailable settlement. [U11]
- [ ] L-2 Leaderboard seeds: audit `leaderboard-seed.mjs`; **OWNER decides** whether
      seeded house scores survive (§8.3.3). [U7]
- [ ] L-3 Splash: ≤ 3 clicks to a running game; one live competitive proof. [U5]
- [ ] L-4 Game-select cabinet metadata and the banner-only cabinets decision
      (**OWNER**, §8.3.3). [U4]
- [ ] L-5 Profile as command centre after the run-stats schema (4.13 D-1). [U6]
- [ ] L-6 Achievements: unlock dates, progress meters, accessible tooltips. [U8]
- [x] L-7 Portal modularisation of the 15.5k-line `main.js` by route, deleting the dead
      legacy canvas combat path and the hidden developer backstage. Own cycle, no
      behaviour change. [U10, P6]
- [ ] L-8 Key art re-rendered from the new 3D models so portal and game match.
- [ ] L-9 Trust pages: privacy, terms, support/contact, accessibility notes, testnet
      disclaimer, "no real settlement yet" status (copy drafted by agent; **OWNER**
      approves, §8.3.5).

### 4.13 Data, run stats, analytics

**Agent work**

- [x] D-1 Versioned bounded run-stats schema (identity/seed/hero, survival, score,
      level, XP, Litecoin, combo, kills by role/weapon/elite/boss, trigger-vs-pellet
      accuracy, damage dealt/taken, pickups/swaps/reloads/empties, grenades, power-ups,
      upgrades offered/selected, distance, districts, POIs, fog). Integer, bounded,
      rate-limited across the 64 KB bridge, one canonical final snapshot. [D1]
- [ ] D-2 Parent-owned privacy-conscious funnel: homepage → play → hero → run start →
      1-minute survival → first upgrade → first pickup → death → replay → profile →
      wallet connect. [D2]
- [ ] D-3 Internal balance dashboards from X-1/G-1 outputs, published to `docs/qa/`.

### 4.14 Platform, performance, hygiene, docs

**Agent work**

- [x] N-1 Heap gate hardening: forced GC or median-of-N. [P2]
- [ ] N-2 Legacy asset triage: `apps/portal/assets/generated` (57 MB; ~17 MB superseded).
      Propose keep/retire per directory; **OWNER approves** deletions (§8.3.6). [P3]
- [ ] N-3 Truthful docs pass: README, PROJECT.md, production claims, `AGENTS.md` read
      order (add this roadmap). [P4]
- [ ] N-4 Bundle budget: either a size-reduction cycle (dead code, tree-shaking,
      `main.mjs` split) or a documented budget raise with the owner. Every code task
      needs headroom.
- [ ] N-5 Restore headless production certification once §8.2.1 is done; add the bypass
      header to `certify:hmh:browser` and the byte-verification step of the promote ritual.
- [ ] N-6 CDN and cache policy for the larger atlases (immutable hashed filenames).

**Owner work:** §8.2.1 (Vercel bypass), §8.3.6 (asset retirement approval).

### 4.15 Web3 and contracts (HALT-gated; agents prepare, owner decides)

*Now:* readiness `PARTIAL`, 3/4 gates. Blocked gate: on-chain registry/economy
(cabinet approval path not live-gated, SplitConfig/economy not production-approved,
legal/brand/economy approval required). Contracts compile and pass unit tests; slither
configured. `SETTLEMENT_LIVE=false`.

**Agent work (no deployment, no transactions)**

- [ ] B-1 Keep `contracts:check`, `contracts:test`, `contracts:slither` green; record
      results per cycle that touches contracts.
- [ ] B-2 Live-gate the GameRegistry cabinet approval path in code and tests.
- [ ] B-3 Production SplitConfig proposal document with worked examples for owner review.
- [ ] B-4 Trusted-verifier key-management runbook (generation, rotation, storage) as a
      document; no keys in the repo.
- [ ] B-5 Testnet deployment runbook and dry-run script that stops before broadcast.

**Owner work:** §8.5 (legal/brand/economy approval, verifier custody, explicit HALT
approval for any deployment).

### 4.16 Launch readiness and marketing evidence

**Agent work**

- [ ] M-1 Capture pipeline: scripted Playwright captures of hero turntables, combat
      clips, map flyovers, mobile gameplay; outputs to `docs/releases/press/`.
- [ ] M-2 Fact sheet and truthful feature matrix generated from manifests and the
      release ledger.
- [ ] M-3 Daily/weekly challenge seeds and seed sharing (parent-owned) when D-1 exists.

**Owner work:** §8.6 (playtests, trailer edit, community, press).

---

## 5. What agents can do alone

Everything in §4 not marked **OWNER**. In practice that is all code, all Blender
authoring of modular kits and look-dev, all pipeline tooling, all tests and gates, all
balance instrumentation, all UI, all audio integration, all documentation, all capture
automation, all contract code and runbooks short of deployment. An agent may also draft
every owner-facing decision memo and every piece of trust copy for approval.

Agents cannot: generate the reference sheets and Tripo/Mixamo exports (accounts and
judgement are the owner's), change Vercel account settings, approve budgets or deletions,
approve legal/brand/economy terms, custody keys, deploy or transact, or run real-player
playtests. Git LFS is already installed; agents may add and verify repository tracking
policy, but source-model acceptance still requires provenance and clean-clone proof.

---

## 6. What needs the owner

Consolidated in §8 with instructions. Summary:

| Owner item | Blocks | Section |
| --- | --- | --- |
| Produce ChatGPT sheets + Tripo/Mixamo exports (heroes, enemies, props) | 4.2, 4.3, 4.5 | 8.1 |
| Vercel Protection Bypass for Automation secret, only if 403 protection returns | 4.14 N-5 contingency | 8.2.1 |
| Keep Blender 5.1.2 installed at the pinned path | every asset pipeline | 8.2.2 |
| Git LFS | installed (`3.7.1`); no owner action currently open | 8.2.3 |
| Town district scope (convert yard vs seventh district) | 4.4 W-9 | 8.3.1 |
| Hero atlas budget and format decision | 4.2 C-6 | 8.3.2 |
| Seeded leaderboard and banner-cabinet visibility decisions | 4.12 L-2, L-4 | 8.3.3 |
| SFX sourcing and license policy | 4.11 | 8.3.4 |
| Approve trust copy (privacy, terms, disclaimers) | 4.12 L-9 | 8.3.5 |
| Approve legacy asset retirement | 4.14 N-2 | 8.3.6 |
| Existing bundle cap | no owner action currently open; remeasure every slice and escalate only if a candidate needs a reduction/raise decision | 8.3.7 |
| Legal/brand/economy approval, verifier custody, HALT approvals | 4.15 | 8.5 |
| Playtests, trailer, community, press | 4.16 | 8.6 |

---

## 7. Sequencing

Phases are dependency-ordered. Work inside a phase can interleave. Balance
instrumentation (G-1, X-1) runs alongside any phase from Phase 1 on.

**Phase 0 — plumbing and truth, plus one deliberate render-parity cycle**
- [x] T-0a/T-0b role and projectile-budget truth with direct live-module tests.
- [ ] P-4 enemies → EEVEE. This is an intentional visual change and remains its own cycle.
- [ ] K-1 director decoupled from zoom.
- [x] U-1 shared child tokens.
- [ ] U-2 developer-only telemetry gating.
- [x] K-2 controls card and first-run hint.
- [x] L-1a explicit simulated-wallet disclosure.
- [x] N-1 medianized forced-GC heap gate.
- [ ] P-1/P-2/P-3 importer + skinned exporter + schema on a throwaway mesh.
- [ ] P-5 source-model LFS policy and clean-clone proof; Git LFS itself is installed.
- [ ] N-3 roadmap import and `AGENTS.md` read order are updated; replacing the older Cycle 036 checkpoint block in the protected instruction file still requires owner approval.
- Owner in parallel: §8.1.1 Lester sheet/export. Add a Vercel bypass secret only if 403 protection returns.

**Phase 1 — hero pilot**
- [ ] C-1 Lester 256 px · P-6 format harness → §8.3.2 decision · C-6 budget
      implementation · C-2 selector · C-3 remaining heroes · C-4 animation pass.

**Phase 2 — the world facelift**
- [ ] W-1 terrain · W-3 roads · W-2 decals · W-4 shores · R-1 static importer · R-2
      Tripo organics wave 1 · R-3 camp + bridge kits · W-8 encampments · W-7 density ·
      W-14 contact shadows · W-6 landmarks · W-5 blockers to props · W-15 scenes.
- [ ] §8.3.1 decision → R-3 town kit → W-9 town district.

**Phase 3 — enemies and boss**
- [ ] E-2 three cycles · E-3 tells · E-4 elites · E-5 boss presentation · E-6 boss depth
      (with G-1 evidence).

**Phase 4 — feel, HUD, audio**
- [ ] U-3 HUD completion · U-4 level-up cards · U-5 settings · V-1..V-5 VFX · S-1/S-2/S-4 audio ·
      V-3 grenades · K-6 dash · K-7 chunked navgrid · L-8 key art.
- [x] U-7/S-3 parent-owned music transport and continuity.

**Phase 5 — depth and balance**
- [x] G-2 two pickups · X-3 crit · X-4 pistol tree · X-2 XP sources · X-7 combo · X-5 enemy bands.
- [ ] G-3 melee · W-10..W-13 interiors, verticality, secrets, weather · K-4 rebinding · V-6 camera.

**Phase 6 — data, portal, trust**
- [x] D-1 canonical bounded run summary · L-7 portal modularization/legacy backstage retirement.
- [ ] D-2 funnel · L-5 profile · L-2/L-4 decisions applied · L-6 achievements · L-3 splash ·
      U-6 select · L-9 trust pages · N-2 asset triage · N-6 CDN.

**Phase 7 — launch readiness**
- [ ] M-1..M-3 · §8.6 playtests · 036 handoff §7 launch gates all green · W-16 Level 2
      planning begins.

**Web3 (parallel, HALT-gated):** B-1..B-5 at any time; nothing deploys without §8.5.

---

## 8. Owner playbook

### 8.1 Producing models (ChatGPT → Tripo → Mixamo)

You produce the sheet and the mesh. Agents fix scale, origin, facing, look-dev, rig
mapping, and rendering. Do not spend time on those.

#### 8.1.1 Heroes

1. Open `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md` and copy the actor's
   "Immutable identity" and "Combat outfit / interpretation" bullets.
2. In ChatGPT image generation, use this prompt, pasting the bullets where marked:

   ```
   Orthographic character turnaround for a stylised 3D game. A-pose. Front, side and
   back views aligned on one row, same scale. Neutral flat studio lighting, no cast
   shadows, plain light-grey background. Full body, head to boots, nothing cropped.
   [PASTE IDENTITY BULLETS]. Practical combat outfit as described. Readable
   silhouette, painterly stylised proportions in the manner of Supergiant's Hades.
   No text, no labels, no weapon in hand.
   ```

   Generate until the front view is clean: symmetrical A-pose, feet visible, no
   overlapping limbs, no motion blur. Save as PNG at the largest size offered.
3. In Tripo: Image to 3D from the front view. If multi-view input is offered, add the
   side and back. Enable PBR textures. Enable quad remesh or the highest-quality
   topology option. Face target 30k–60k. Generate.
4. Judge the result at arm's length, not zoomed in. Sprite rendering hides small
   defects. Reject only: wrong silhouette, missing limbs, fused legs, wrong colours.
5. Export **GLB with embedded textures** (FBX is fine if GLB is unavailable).
6. Rigging: prefer Mixamo (free, mixamo.com). Upload the GLB or FBX, place the markers
   (chin, wrists, elbows, knees, groin), let it auto-rig. Then download these animations
   as FBX with skin, 30 fps, no in-place unless noted:
   `Pistol Idle`, `Pistol Run` (in place), `Pistol Strafe Left/Right` (in place), a hit
   reaction, a death (falling backward), `Throw Object`, a melee swing, a dodge/roll.
   If you prefer Tripo's own auto-rig and animation presets, export those instead; the
   agent will map either skeleton.
7. Deliver to the agent: the GLB/FBX, every animation FBX, the sheet PNG (reference
   only), and the actor ID (`lester-original`, `lilly`, `lit-commando`, `lit-valkyrie`).
   Put them in a folder outside the repo and tell the agent the path; the agent commits
   the mesh under `apps/hmh-reboot/assets/source/models/<actor-id>/` via LFS.
8. Order: Lester first (flagship, easiest head), then Lit Commando, Lit Valkyrie, Lilly.

#### 8.1.2 Enemies and boss

Same steps, using the role identity lines in `docs/hmh-reboot/ENEMY-PRODUCTION-ART.md`
and the enemy standard in `REFERENCE-CHARACTER-MODELS.md` (human/zombie only, ordinary
roles at human scale, layered clothing, role-specific equipment). Add to the prompt:
`zombie survivor, [role cue], faction colour [colour from the art-direction palette
table]`. For the Liquidator, produce three sheets, one per phase (`market-open`,
`margin-call`, `total-liquidation`), each visibly escalating. Animations needed per
role: idle, run, an attack with a clear wind-up, hit reaction, death. Deliver by role ID.

#### 8.1.3 World props (organics and unique pieces only)

Use Tripo for: trees (per biome), boulders, rock spires, stumps, upright root plates,
wrecked vehicles, debris piles, barrels, statues, landmark pieces, weapon and power-up
models. **Do not** use Tripo for fences, walls, bridge modules, building blocks, or roads;
agents author those as modular kits in Blender.

Prompt: `Single [prop], stylised 3D game asset, three-quarter view, neutral flat
lighting, no cast shadow, plain light-grey background, painterly stylised, colours in
[biome palette from ART-DIRECTION-GAMEWORLD.md], no text.` Then Tripo Image to 3D,
PBR on, GLB. No rig. Deliver in batches of 10–20 named `<biome>-<prop>.glb`. Tall
vertical shapes read best at the 55° camera; low horizontal shapes do not (the
driftwood log failed three passes), so prefer upright silhouettes.

### 8.2 Environment and accounts

#### 8.2.1 Vercel Protection Bypass for Automation (contingency only)

1. Vercel dashboard → the `lesters-arcade` project → **Settings → Deployment
   Protection**.
2. Under **Protection Bypass for Automation**, click **Add Secret** (or **Generate**).
   Copy the secret once.
3. On the machine agents run from, set it as an environment variable for the shell that
   runs the gates: `VERCEL_AUTOMATION_BYPASS_SECRET=<secret>`. Never paste it into a
   file in the repo or into chat.
4. Tell the agent it exists. The agent adds the `x-vercel-protection-bypass` header
   (and the `x-vercel-set-bypass-cookie` header for browser runs) to the certification
   and byte-verification scripts.
5. If production still returns 403 to automated clients, open **Firewall** on the
   project and check whether **Attack Challenge Mode** is on; either turn it off or add a
   bypass rule for the automation header. Verify with the agent.

#### 8.2.2 Blender

Keep Blender **5.1.2** at `D:\Apps\Blender\blender.exe` (or set `BLENDER_EXECUTABLE`
to another 5.1.2 install). The pipelines reject any other version on purpose. Do not
upgrade Blender without an agent cycle that re-pins and re-verifies every pipeline.

#### 8.2.3 Git LFS

Git LFS `3.7.1` is installed on the current host. After P-5 adds source-model tracking,
run `git lfs install`, prove the intended files are LFS pointers, and verify a clean-clone
`git lfs pull`. Vercel builds do not need source models, so no deploy setting changes.

### 8.3 Decisions only you can make

Agents will prepare a short memo for each; answer in chat and the agent records the
decision in `DECISIONS.md`.

- **8.3.1 Town district scope.** (a) Convert part of `liquidation-yard` into a ruined
  neighbourhood (cheaper, keeps traversal 40–70 s) or (b) add a seventh district east
  (needs bounds, minimap, reveal rework). Recommendation: (a) first.
- **8.3.2 Hero atlas budget and format.** After P-6 reports numbers: raise the 12.6 MB
  four-hero cap, adopt lossless WebP, adopt KTX2, or load one hero at a time.
  Recommendation: per-hero lazy loading plus WebP unless KTX2 wins on mobile GPU memory.
- **8.3.3 Leaderboards and cabinets.** Whether seeded house scores remain on public
  boards (recommendation: remove before launch, keep in a labelled "House" tab), and
  whether the banner-only MWEB Invaders and LitVM Legends cabinets stay visible
  (recommendation: hide until playable).
- **8.3.4 SFX sourcing.** CC0/paid packs, a sound designer, or generated SFX. Whatever
  you choose, every file needs a license line in `sfx-manifest.json`. If you generate
  SFX with an AI tool, say so in the manifest; the pixel rule does not cover audio but
  the provenance rule does.
- **8.3.5 Trust copy approval.** Privacy, terms, support contact, accessibility notes,
  testnet disclaimer, and the "no real settlement" statement. Agents draft; you approve
  or send to counsel.
- **8.3.6 Legacy asset retirement.** Approve the per-directory keep/retire list for
  `apps/portal/assets/generated` (about 17 MB superseded pixellab/isometric art).
- **8.3.7 Bundle budget.** The cap remains 1,050,000 bytes. Cycle 070 measured 948.5 KB
  of initial JS and 76.9 KB headroom. Keep the cap and require per-slice accounting; ask
  for a reduction cycle or explicit raise only when a measured candidate needs it.
- **8.3.8 Camera scale.** After K-1, approve the new gameplay zoom / sprite scale from a
  side-by-side capture the agent provides.

### 8.4 Open asks (agents append here; owner clears)

- [x] 8.2.1 No bypass secret is currently required; Cycle 070 automation and production verification passed without it. Reopen only on a verified 403.
- [x] 8.2.3 Git LFS 3.7.1 is installed; P-5 tracking/clean-clone proof remains agent work.
- [ ] 8.1.1 Lester sheet + Tripo/Mixamo export (unblocks Phase 1).
- [x] 8.3.7 Keep the existing cap and fresh per-slice accounting while current 76.9 KB headroom remains; escalate only from a measured candidate.

### 8.5 Web3 and settlement (HALT-gated)

Nothing here happens without your explicit approval naming the exact action and
candidate. Before any real-value function:

1. Legal, brand, and economy approval for the SplitConfig and cabinet approval path
   (B-3 memo).
2. Trusted-verifier key custody per the B-4 runbook: hardware or managed key, rotation
   plan, no key in the repo or in chat.
3. Testnet dry run via the B-5 script, reviewed, then a separate explicit HALT approval
   for testnet deployment, then another for anything real.
4. Read `docs/web3/hmh-web3-live-readiness.md` before approving; it must read 4/4.

### 8.6 Playtests, trailer, community

- **Playtests:** five first-time players on desktop and five on mobile, unprompted,
  screen-recorded. Note where they get stuck, what they never discover (weapon slots,
  dash), and when they stop having fun. Give the recordings to an agent for a findings
  memo. Repeat after Phase 2 and Phase 4.
- **Trailer:** agents produce the raw captures (M-1); you or an editor cut 30–60 s with
  the main theme. Lead with survival, build, and competition, then the Litecoin/LitVM
  identity.
- **Community:** seed sharing, weekly challenge seeds, build screenshots, verified
  leaderboard moments before any token incentive.

---

## 9. Failed approaches (do not repeat; append with evidence)

- Naive navgrid deferral into `initializeSession` dropped a touch pointer-up on
  iphone-13-portrait (Cycle 046). The fix must be chunked before input binds.
- Horizontal low-lying props fail at the 55° camera (`driftwood-log`, three passes,
  Cycle 044). Re-concept as vertical.
- Smooth spheres read badly at sprite scale; facet them.
- Sharing one key/fill/rim energy across hero, enemy, and prop scenes washed out the
  props (light-rig note). Share colour, keep per-family energy.
- Rerunning a gate until it is green hides real failures. Only the heap-delta assertion
  earns one rerun.
- Iterating primitive-built characters further. The method has hit its ceiling
  (2026-09-02 review); route character work through the external-model pipeline.

---

## 10. Definition of done for the program

All §2 bars answer yes. All Phase 0–6 boxes ticked. The 036 handoff §7 launch gates
are green. Production verified in a real browser with deployment ID and rollback
recorded. Docs describe the live build. `SETTLEMENT_LIVE` still `false` unless the
owner has separately approved otherwise through §8.5.
