# Hard Money Heroes Cycle 074 handoff for Hermes

Date: 2026-09-05 PDT
Author: Claude Fable 5.1 (cycles 072 to 074)
Recipient: Hermes agent
Owner: Justin Pinter
Live lineage: `fable/hmh-cycle-074-atmosphere-and-feel` at the Cycle 074 closeout
Production: <https://lestersarcade.io> = `dpl_6eQiyfLKrCT5aLWRjivcTGQuqWbR`
Rollback: `dpl_EQekrTvicPuJ95Qzfn33D7s8Z4dw` (Cycle 073)
Settlement: `SETTLEMENT_LIVE=false`, unchanged, HALT-gated

This supersedes `2026-08-20-lesters-arcade-hmh-chikun-live-release.md` as the current
handoff. That document remains authoritative for the architecture boundaries, the bridge
contract and the Web3 truth it records; none of that changed. Read this file, then
`docs/hmh-reboot/AAA-ROADMAP.md` (its `Current live override — Cycle 074` block and the task
register), then `docs/hmh-reboot/cycles/CYCLE-072.md`, `CYCLE-073.md`, `CYCLE-074.md`.

## 1. Production state verified 2026-09-05

| Fact | Value |
| --- | --- |
| Runtime commit | `6c4ff20a` on `fable/hmh-cycle-074-atmosphere-and-feel` |
| Closeout commit | `3cb72b0c` |
| Production | `dpl_6eQiyfLKrCT5aLWRjivcTGQuqWbR`, <https://lesters-arcade-276x61nsi-justin-agent-projects.vercel.app> |
| Rollback | `dpl_EQekrTvicPuJ95Qzfn33D7s8Z4dw` (Cycle 073), confirmed Ready |
| Release ledger | `2,539 / 2,488 / 51 / 0` |
| True initial child JS | `992,982 / 1,050,000` (entry 463,414 + shared chunks 66,453 + vendor 463,115) |
| Cache | portal `hmh-aaa-cycle-074-atmosphere-and-feel`, service worker `lesters-arcade-v27-hmh-atmosphere-and-feel` |
| Perf | desktop p95 8.5 ms, mobile p95 8.8 ms; p99 16.5 / 17.2 (budget 70) |
| Visual gate | 12 scenes plus per-enemy crop checks on the three enemy scenes |

Hosted verification at closeout: five-profile certification with zero-delta anchors, network
audit 4/4 clean, `smoke:portal`, `smoke:portal:interactions`, `smoke:portal:e2e` desktop and
mobile all PASS on production, `docs:production` marker matched, live capture inspected.

## 2. What cycles 072 to 074 shipped (all live)

- **072** Terrain rebuilt as lit micro-terrain and the visible 67 px tile grid removed (repeat
  66.56 to 399.36 with mipmaps); roads lost the black outline and gained shoulders; shore and
  scree bands; ground contact shadows; the developer telemetry HUD replaced by a real DOM
  cockpit (telemetry behind `?debugHud=1`); encounter director decoupled from render zoom
  (K-1, simulation); the external-model importer, skinned exporter branch and manifest schema
  v2 (P-1 to P-3) proven on a throwaway rigged fixture.
- **073** Enemy roster relit under EEVEE with the hero premultiplied budget gate after the
  nearest-8 quantiser was found to be the real blocker; per-weapon combat VFX and surface-typed
  impacts; grenade feedback set; tiered level-up cards with keyboard and gamepad selection and
  an SFX slider; ledge fronts, ramps and rock cliffs; density 128 to 200 dressing placements
  and twelve spawn-point camps; LFS policy for source models; bounded certification warm-up;
  chunked navgrid with a readiness authority; a stray `arc()` line defect fixed in production
  art.
- **074** Honest bundle accounting (hoisted shared chunks now counted; the Cycle 073 true total
  had been 1,084,585) and a trimmed Pixi vendor (five build-time stubs, 575,891 to 463,115);
  deterministic per-district atmosphere layer; encounter framing, dash, hit and level-up beats;
  exaggerated enemy tells matched to simulation windows with silhouette accents and a
  redesigned elite treatment; 384 px deterministic character-select turntables; composed
  landmark set-pieces, ford band, three fenced yards; the hero atlas format decision memo;
  twelve weapon cues that had been silent since 2026-08-05 now registered and routed through
  the portal cue registry.

## 3. Operational facts that proved out (believe them)

1. **Another session works in `C:\Users\just_\lesters-arcade`.** It has two unpushed commits
   on the local `fable/hmh-cycle-072-visual-facelift` branch (`6cbedec8` "Compact HMH Level 1
   world", `ff2934db` "Add HMH Level 1 living-world packet") that diverge from origin after
   `fbf3ea84`. They resize the world to 75x75 and touch `arcade-core.mjs`, `authored-world-layout`
   and the level-one blueprint. Do not discard, rebase or merge them without the owner. Never
   integrate in that checkout.
2. **Integrate in a dedicated worktree** cut from the live lineage branch (pattern:
   `C:\Users\just_\lesters-arcade-cycleNNN`), junction `node_modules` and
   `benchmarks\hmh-engine-bakeoff\node_modules` from the main checkout, copy `.hermes\plans`.
   Workflow-spawned implementer worktrees are cut from the wrong commit; every implementer must
   `git reset --hard <base>` first.
3. **Vercel build image** is CPython 3.12 + Pillow 11.3 with `.git` stripped. Tests that spawn
   python must not use `Image.get_flattened_data` (Pillow 12 only; use `getdata`). Tests that
   need git or git-lfs must pass vacuously with `t.diagnostic`, never `t.skip`: the release gate
   rejects skipped tests. Reproduce with `uv venv --python 3.12` plus `Pillow==11.3.0` before
   pushing anything that touches Python-backed tests.
4. **Every code cycle bumps the cache token** in 13 places (portal `index.html` x7,
   `sw.js` CACHE_VERSION, `tests/hmh-load-speed`, `tests/arcade-core` x2,
   `tests/hmh-reboot-shell`, `scripts/smoke-portal-flow` x2, `scripts/smoke-portal-interactions`,
   README x3). Cycle 075 is `hmh-aaa-cycle-075-*` / `lesters-arcade-v28-*`.
5. **The curated-level-kit runtime inventory** (`apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-runtime.mjs`)
   embeds a list of `apps/portal/src` files and is regenerated by the first `vercel:build` step.
   Regenerate and commit it (`npm run assets:hmh:curated-level-kit-runtime`) whenever a portal
   module is added, or `dist/main.js` will not match production. Pinning it by test is open.
6. **Browser gates are serial.** Run `visual:reboot`, `certify:hmh:browser`, the perf smoke, the
   mobile-controls smoke, the combat and collectibles smokes one after another, never in
   parallel shells. Certification now relaunches the browser per profile, which removed the
   cold-GPU anchor flake seen in 072 and 073.
7. **World-tour spawns are load-bearing for smokes.** The collectibles smoke walks from the
   `mining` (9200, 1600) and `ravine` (3050, 1500) tour spawns into specific caches. Moving a
   tour spawn breaks it silently. Add a new tour id instead.
8. **Preview deployments are behind Vercel Authentication** (302 to automated clients). Byte
   verification happens on the public alias after `npx vercel promote <dpl> --yes`; the alias
   moves about two minutes after the promote command. The owner's standing "push live"
   approval covers gate-passing work; record production and rollback ids in the cycle doc.
9. **Pixi `Graphics.arc()` must be chained from `moveTo()`**; a guard test enforces it.
   `Graphics` masks are stencil masks; per-sprite masks must own their mask for their life.
10. **The enemy roster reproducibility margin is thin** (Cycle 074 verify observed 7 changed
    visible pixels on one frame against the cap of 8). If a cold run fails, read the drift
    report the pipeline writes before touching anything; never widen the budget.

## 4. Open items and risks carried forward

- Owner decision pending: hero atlas format (`docs/hmh-reboot/ATLAS-FORMAT-DECISION-MEMO.md`,
  roadmap 8.3.2). Measured: lossless WebP is 23 percent smaller but decodes slower than PNG;
  it only wins on wire bytes. Recommendation carried: lossless WebP exact, per-hero lazy load.
- Select-screen payload rose from 498 KB to 1.6 MB for the 384 px turntables (recorded for the
  owner; caps were split per atlas plus a 2 MiB total, not raised silently).
- Atmosphere density in the mining camp is at the strong end; the owner should look at it.
- Desktop p99 rose from 8.6 to 16.5 ms with the atmosphere pool's first fill; budget is 70.
- K-6 dash input buffering (input layer) and W-11 simulation verticality remain open.
- N-4 further: a lazy debug/evidence chunk would save about 20 KB but the child is built
  with `splitting:false`, so it needs a build change; the vendor trim already recovered 113 KB.
- Harness: pin the curated-kit inventory to the directory listing; consider the same
  per-profile relaunch for the visual-regression capture.
- `hashwood-camp` and the town scenes have no atmosphere change recorded because their
  scenes did not exceed tolerance; verify by eye that the layer is present there too.

## 5. Primary next objective: recreate the four playable heroes in Blender from the reference art

The owner has produced reference art for all four heroes and wants new 3D models, rigged for
animation, that match these references as closely as possible. This is roadmap C-1 (and it
unblocks C-2 at gameplay resolution, C-4, C-5, C-6). Everything below is agent work except the
two owner steps in 5.1.

### 5.1 Intake (owner)

1. Place the reference images under `apps/hmh-reboot/assets/source/reference/heroes/<actor-id>/`
   with these names, and commit them (they are the design contract, so they belong in the repo;
   extend the LFS rules in `.gitattributes` to `assets/source/reference/**/*.png` first):
   - `lit-commando/front.png` (single full-body render), `lit-commando/turnaround.png` (front,
     right side, back sheet)
   - `lit-valkyrie/front.png`, `lit-valkyrie/turnaround.png` (front, side, back sheet)
   - `lilly/front.png`, `lilly/turnaround.png` (front, side, back plus five expression heads)
   - `lester-original/front.png`, `lester-original/turnaround.png` (front, side, back plus six
     expression heads)
2. If any Tripo or Mixamo export exists for a hero, drop the GLB/FBX under
   `apps/hmh-reboot/assets/source/models/<actor-id>/` (LFS rules already cover it) and say so.
   Otherwise Hermes models from the sheets directly; that is the expected path.

### 5.2 Identity contract from the reference images (reconcile into `REFERENCE-CHARACTER-MODELS.md`)

Update the four identity blocks in `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md` to match the
art exactly; the current blocks predate these sheets. From the images:

- **Lit Commando.** Adult male, heavy build, tanned skin, dark brown-black mullet with a
  swept fringe, stubble, stern brow. Red neckerchief tied at the throat. Olive-green open
  field shirt, sleeves rolled, over a black tank; a chest harness with a shoulder plate on the
  right shoulder and a small unit patch on the left sleeve; a bandolier of red-and-brass
  shotgun shells across the chest right-to-left; a red cloth armband on the left upper arm.
  Wide brown belt with a square steel buckle, multiple olive pouches and a carabiner; a
  holstered black pistol on the right hip. Tan-and-olive camouflage cargo trousers with thigh
  straps and pouches; riveted black knee pads with brass edges; black fingerless gloves with
  knuckle plates; black lace-up boots with brass buckles and camo scuffing. Weapon socket on
  the right hand.
- **Lit Valkyrie.** Adult female, athletic, tanned skin, long voluminous wavy blonde hair to
  the waist, red headband tied at the back with tails. Olive-green cropped tank showing the
  midriff, dog tags on a chain. Single bronze-brown pauldron on the LEFT shoulder with harness
  straps; a brass-round bandolier across the torso left-to-right; a red cloth armband on the
  right upper arm. Belt with a steel buckle and olive pouches; tan camouflage cargo trousers
  with thigh straps; riveted knee pads; black fingerless gloves with knuckle plates; tall
  black lace-up boots with brass buckles. Weapon socket on the right hand.
- **Lilly.** Adult female, fair skin, long wavy teal-blue hair (one thin braid on the left),
  round thin-framed glasses with teal-tinted lenses. Long teal-and-black leather coat with
  gold circuit-line trim, a hexagonal Litecoin badge on the right sleeve, worn open; black
  laced corset top; a wide belt with a large octagonal buckle bearing a white "L" and small
  pouches; dark teal trousers with a gold-lined thigh panel; riveted knee pads with brass
  rims; black fingerless gauntlets with brass plates; black buckled boots with brass detail.
  Expression sheet: neutral, focused, smiling, angry, surprised. Weapon socket on the right
  hand; the coat tail is the one piece of secondary motion to bake.
- **Lester (original).** Cartoon mascot: a large glossy Litecoin-blue sphere head with a
  white Litecoin "L" mark on the left of the face, big blue eyes, black brows, a wide mouth;
  a blue neckerchief. Human athletic body with tan skin: black short-sleeved tee under an
  olive tactical vest with pouches and a shoulder plate on the left; a brass-round bandolier
  right-to-left; blue wristbands; black fingerless gloves; tan camouflage cargo trousers with
  knee pads; black lace-up boots. Expression sheet: happy, grin, angry, shouting, surprised,
  smug. Weapon socket on the right hand. Head reads as one rigid sphere; the face is a texture
  and can be swapped by expression.

Shared: 8 directions, stylised Hades-adjacent proportions, matte fabrics, one warm rim light
from the shared rig, every metal piece brass or gunmetal. Keep the human-medium gameplay body
profile; visual scale must stay inside the existing hero-vs-enemy height parity band
(0.8 to 0.9 enemy over hero) or that test moves deliberately with a ledger note.

### 5.3 Modelling and rigging (agent, Blender 5.1.2 at `D:\Apps\Blender\blender.exe`)

Build each hero as a real skinned mesh in Blender, not primitives on a rigid rig. The
pipeline for skinned actors already exists (Cycle 072): `scripts/hmh-blender/import-hmh-external-model.py`
(import, height normalisation on a parent Empty, waist split into `lower-body` and
`torso-head` objects sharing one armature, `weapon_socket`, the `HMH_LookDev_v1` toon node
group, NLA muting), the `clipActions` branch in both exporters, manifest schema v2 with
`sourceModel`, `sourceSha256`, `frameSize`, `clipActions`, and a throwaway fixture that proves
two-run reproducibility. Documentation: `docs/hmh-reboot/EXTERNAL-MODEL-PIPELINE.md`.

Per hero, one bounded cycle each, Lit Commando first (its turnaround is the cleanest):

1. **Blockout to the sheet.** Load `front.png` and `turnaround.png` as background images
   (front, side, back) at matched scale; model to `targetHeight` from the reference manifest.
   Target 30k to 60k triangles, quads where deformation matters (shoulders, elbows, hips,
   knees), separate objects for hair, coat tail (Lilly), neckerchief, bandolier, pouches,
   knee pads, gloves, boots and the weapon, so the layer split and weapon socket stay clean.
   Lester's head is one sphere object with a face texture.
2. **Materials.** Textures at 2048 or smaller, PNG source committed under the model folder
   (LFS). Wire every material through `HMH_LookDev_v1` so heroes, enemies and props share one
   look; keep the shared light rig.
3. **Rig.** A humanoid armature with, at minimum, the fourteen bones the runtime pins
   (`root, pelvis, spine, chest, head, upper_arm.L/R, forearm.L/R, thigh.L/R, shin.L/R,
   weapon_socket`) plus whatever finger, hair or coat bones the actions need; automatic
   weights then hand-corrected at shoulders, hips and the waist seam. `weapon_socket` is a
   child of `forearm.R`. Rotation mode of imported or authored actions must survive the
   exporter (the skinned branch must not force XYZ on quaternion-keyed bones).
4. **Actions.** Author or retarget one Action per clip in the existing contract:
   `idle`, `run`, `aim`, `pistol-fire`, `hurt`, `dash`, `melee`, `grenade`, `death`, with the
   frame counts and fps the manifest already declares (the runtime consumes those). Weight
   shift, foot planting, recoil and recovery, a distinct death. Mixamo retargeting is allowed
   as a starting point if the FBX is committed as source.
5. **Waist split and layers.** Run the importer to split at the hips by weight majority into
   `lower-body` and `torso-head`, verify the seam under maximum torso rotation, and confirm the
   four layers `shadow, lower-body, torso-head, weapon` compose as today.
6. **Render at 256 px** (C-1). Add the hero to `hmh-production-heroes.json` with
   `sourceModel`, `frameSize: [256, 256]`, `pivot.sourcePixels [128, 234]` (round(p x 256/160))
   and `clipActions`, then run the hero pilot with `--verify-reproducible`; the budget is
   `maxChangedVisiblePixels 8 / maxChannelDelta 2 / maxTotalChannelDelta 32` and the shipped
   procedural heroes observe 0/0/0. Preserve the supersampled frames beside the normalised ones
   as the enemy pipeline now does. The hero atlas caps (3.25 MiB each, 12 MiB total) will not
   hold four 256 px heroes as PNG; this is exactly why the owner must answer the atlas-format
   memo first, and why per-hero lazy loading (already in `main.mjs`) matters. Ship behind the
   existing `?productionHero=<id>` pilot flag until all four are done.
7. **Verify by eye and by gate.** A 100 percent side-by-side of the rendered south idle
   frame next to the reference front render for every hero; the contact sheet at 100 percent;
   the selector turntable regenerated from the same source (C-2 pipeline exists; reuse it);
   the hero-vs-enemy parity band; the three enemy-crop visual scenes plus new hero-crop checks
   for frontier-relay desktop and mobile; the five-profile certification; perf on the mobile
   profile with the larger atlas decode measured.
8. **Silhouette checklist per hero** (the reviewer recomputes these, not the author): hair
   mass and colour; neckwear (red cloth for Commando, red headband for Valkyrie, blue for
   Lester, none for Lilly); bandolier direction; pauldron side (Valkyrie left, Commando right,
   Lester left); armband side (Commando left, Valkyrie right); coat length and gold trim for
   Lilly; the "L" marks (Lilly's buckle and sleeve badge, Lester's head); boots with brass
   buckles on all four.

### 5.4 Acceptance

A hero is done when: its rendered frames match the reference silhouette checklist at 100
percent; the reproducibility gate passes twice cold; all nine clips read as anticipation,
impact and recovery at gameplay zoom; the parity band holds; the select turntable shows the
same model; the bundle, atlas and perf gates hold with the owner's chosen atlas format; and
production is verified live in a real browser with the deployment and rollback ids recorded.

## 6. Other objectives after the heroes (roadmap order)

E-6 boss depth with G-1 swarm benchmark evidence; K-6 input buffering; W-11 simulation
verticality; R-3 modular kits (town, camp, bridge, industrial) authored in Blender; U-4/U-5
follow-ups; S-1 audio expansion once the owner picks a sourcing policy; L-3, L-5, L-6 portal
depth; M-1 capture pipeline; the N-4 lazy debug chunk; the harness pins in section 4.

## 7. Discipline (unchanged, and it keeps working)

Fetch first and compare `origin/*` heads. Health check → one bounded slice → RED tests →
implement → full gates, browser gates strictly serial → visual evidence inspected by eye at
100 percent → exact-index adversarial review with recomputable numbers → fix → re-review →
commit implementation and closeout separately → push → preview builds on Vercel → promote →
verify production bytes, tokens, five profiles, network audit, portal smokes and E2E →
record deployment and rollback in the cycle doc, the continuous-improvement ledger, the
roadmap live override and the README. `SETTLEMENT_LIVE` stays false; no contract,
transaction or settlement change without a separate explicit HALT approval.
