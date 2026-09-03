# Hard Money Heroes — visual overhaul review and external-model pipeline

Date: 2026-09-02 PDT
Author: Claude Fable 5.1
Recipients: Justin (owner), Hermes agent
Branch reviewed: `reboot/hmh-aaa-continuous` at `b793f549`
Production reviewed: <https://lestersarcade.io> (played in a real browser, Free Mode, Lit Commando)
Companion: `2026-08-03-hmh-upgrade-program-hermes-tasks.md` (task backlog, still valid),
`docs/hmh-reboot/ART-DIRECTION-GAMEWORLD.md`, `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`

## 0. Reconciliation note (added 2026-09-03)

This review was written from a checkout at Cycle 049 (`b793f549`) while cycles 050 to 071
were landing on `hermes/hmh-cycle-070-gameplay-ui-music`. `docs/hmh-reboot/AAA-ROADMAP.md`
(Cycle 071 register) is the authority on which items are already complete. Facts in this
document that the register rejected as stale: the 1,846-test count (now 2,283), the
silent mock-wallet claim (explicit disclosure shipped), the one-weapon-audio claim (eight
per-weapon fire cues exist), the under-10 KB bundle headroom (Pixi vendor chunk split;
78,772 bytes headroom at Cycle 071), Chikun as Coming Soon (public playable), and the
mandatory Vercel bypass (promotion works without it). The visual assessment in section 3
was made against the live production build and stands; the pipeline assessment in
section 4 stands.

## 1. Verdict

The engineering is AAA-disciplined. The art is not, and it cannot get there on the
current method. Every hero, enemy, and prop in the game is assembled from Python-placed
cubes, cylinders, and spheres, rigid-parented to a 14-bone armature with no skinning, and
posed by hand-computed rotation math in the export scripts. That method has a ceiling and
the game has hit it: the heroes read as building-block figures, the enemies as flat
mannequins, and the world as a vector diagram with a noise texture on it.

The owner's proposed pipeline (ChatGPT character sheets → Tripo image-to-3D → Blender
finish → existing deterministic sprite export) is the right call. It replaces the one
part of the stack that is holding the game back (mesh authoring) while keeping everything
that works (deterministic rendering, atlas packing, reproducibility gates, projection-only
runtime). It also suits this game unusually well: the runtime shows sprites around 100 to
150 px tall, which hides the topology and texture defects that make Tripo output
unacceptable in a true real-time 3D game.

Adopt it, with the integration rules in section 4.

## 2. What was reviewed

- All `docs/handoffs/`, `docs/hmh-reboot/` authority docs, cycle ledgers 041 to 049, and
  the 2026-08-03 upgrade backlog.
- Pipeline source: `scripts/hmh-blender/*.py` (3,795 lines), the four Blender manifests,
  `hmh-light-rig.json`.
- Shipped art: hero contact sheets (648 frames each), enemy roster contact sheets, the
  authored-prop contact sheet, terrain tiles, the hero-selector atlas.
- Evidence captures from the Cycle 049 gates and the live production build, played
  through cabinet → mode → hero → run → pause.

## 3. Findings by area

Severity: **Blocking** means the AAA goal is unreachable until fixed. **Major** means it is
the visible reason the game reads dated. **Minor** means polish.

### 3.1 Playable characters — Blocking

- Meshes are beveled primitives rigid-parented to bones. No skin deformation, so knees,
  elbows, and shoulders hinge like toys. Source: `create-hmh-character-template.py:155-170`,
  `parent_to_bone` at `:138`.
- Poses are computed per frame by trig in `export-hmh-production-hero-pilot.py:47-140`.
  Idle is 2 frames, run 6, hurt 2, fire 3. The 648-frame contact sheet for Lester shows
  most frames nearly identical; there is no weight shift, no foot planting, no follow-through.
- Frames render at 160 px and display at 0.58 scale, so a hero is roughly 90 to 100 px
  tall on a 1080p screen. Hades shows its hero at about 15 percent of screen height.
- The character-select turntables are the same 160 px renders upscaled, which is why that
  screen looks soft.
- Identity contracts in `REFERENCE-CHARACTER-MODELS.md` are good and should become the
  ChatGPT prompt source verbatim.

### 3.2 Enemies — Blocking

- Rendered with Blender **Workbench** (flat, unlit) while heroes and props render with
  **EEVEE** under the shared light rig. The light-rig note admits three families once read
  as three different games; hues were unified but the render engine was not. In the live
  frame the hero has shading and a rim light and the enemy beside it does not.
- Six roles share one body builder and one silhouette prop each. At swarm density they
  are indistinguishable except by tint.
- The Liquidator boss has 456 frames but no per-phase transformation.

### 3.3 Game world and level design — Blocking

- Ground is one procedural noise material per district. Cycle 049's contrast step helped,
  but at gameplay zoom it still reads as a single fill with grain. This is the owner's
  standing "single color, no texture" complaint and it is structural, not a tuning issue.
- Roads are hard-edged brown ribbons with a black outline stroke. They read as a map
  overlay, not a surface. No shoulders, ruts, edge wear, or blend into the ground.
- Blockers (cliffs, fences, machinery, buildings) are still vector shapes drawn by
  `world-production-art.mjs`. Landmarks are small props or vector rings; the relay tower in
  the live frame is a flat cyan ring on two posts.
- 75 dressing placements across a 12,000 × 4,800 world. Most of any screen is empty ground.
- Nothing exists between "tree" and "dirt": no grass, scrub, rubble, debris, decals,
  puddles, or shadows on the ground. No ambient occlusion where props meet ground.
- Verticality exists in the sim (ledges, ramps, one-way drops) but reads as a colour
  change, not a height change.

### 3.4 World props — Major

- 45 authored props render cleanly and consistently and the pipeline for them is solid.
  Quality ceiling is the problem: the miner's shack is a box with a roof; the watchtower is
  a cylinder on legs. Fine as blockout, not as a shipped look.
- 128 px frames for detail props; larger set-pieces need 256 px or 512 px.

### 3.5 Animation — Major

- Sprite flip only. No interpolation, blending, or secondary motion. Recoil is 3 frames,
  hit reaction 2, death 6. Scarf, hair, and cloth are rigid by design.
- The runtime clip contract (idle, run, aim, pistol-fire, hurt, dash, melee, grenade,
  death × 8 directions × layer split) is sound and should be kept. Only the source of the
  frames should change.

### 3.6 Combat feel, grenades, power-ups — Major

- One `weapon-fire.ogg` for all four weapons; no reload, empty-click, or impact variants.
- Muzzle flash and hit rings are generic vector shapes. No surface-typed impact sparks,
  shell ejects, or decals.
- Grenades are mechanically sound (Cycle 047 to 048 tuning) but lack an arc shadow, fuse
  blink, bounce sound, and fragment burst.
- Ten power-up assets are octagonal badges with an icon; they read as UI chips on the
  ground rather than objects.

### 3.7 XP and balance — Minor (process gap, not visual)

- XP curve, two-choice level-up, and weapon trees are in place. The long-run balance
  simulation the 036 handoff requires is still unbuilt, so tuning is blind. Backlog items
  S1 and C6 stand as written.

### 3.8 Game UI — Major

- The top-centre string `PISTOL 6/8 // DASH READY // FRAG 3 // HP 100 // E 2 // K 0` is
  developer telemetry rendered as the HUD. Health is a number in a sentence.
- The top-left panel shows `Portal session connected // FREE // lit-commando // seed …`,
  which is a debug readout, not player information.
- The pause menu is genuinely good: clear hierarchy, run stats, settings, exits.
- The portal is strong: neon arcade identity, jukebox, cabinets. Its key art is Metal Slug
  pixel art while the game is low-poly 3D renders, so the store front and the game do not
  match. Re-render key art from the new 3D models once they exist.
- The child stylesheet still does not import `design-tokens.css` (backlog U1).

### 3.9 Controls, movement, physics — Minor

- Movement, dash, collision, elevation, and pathing are deterministic and tested; nothing
  here needs a visual overhaul. Backlog M1 to M7 stand (controls card, rebinding, chunked
  navgrid, camera look-ahead).
- **Camera zoom is coupled to simulation.** `main.mjs:1990-1993` derives the encounter
  director's spawn bounds from `camera.zoom`. Any zoom change (which the new sprite scale
  will want) must first decouple the director from render zoom or it becomes a simulation
  change with replay divergence.

### 3.10 Sound — Major

- 14 SFX files, 1 music track hard-coded in the child, no per-material footsteps, no
  UI feedback set beyond menu-click, no ducking. The portal has a full jukebox and a real
  cue registry (`hmh-audio-system.mjs`) that the child does not use.

## 4. The proposed pipeline, assessed

### 4.1 Verdict on ChatGPT → Tripo → Blender

Correct for characters, enemies, weapons, power-ups, and organic or unique world props
(trees, boulders, wrecked cars, stumps, statues, landmark set-pieces). Not correct for
modular kits (walls, fences, bridge modules, roads, town blocks), and not applicable to
terrain. Reasons and rules:

1. **Determinism rule stays intact.** Ground rule 1 forbids hand-painted or one-off
   AI-generated *shipped pixels*. A GLB or FBX committed under
   `apps/hmh-reboot/assets/source/models/` is repo-owned source, exactly like the
   `.blend` files are today. The sprites still come out of the same reproducible exporter.
   Amend the ground-rule text to say so explicitly so nobody re-litigates it.
2. **Sprite rendering forgives Tripo.** Soft topology, baked-in shading, minor texture
   seams, and merged fingers all vanish at 160 to 256 px under the shared light rig. Do
   not spend time retopologising to game-engine standards; decimate to a sane budget
   (about 30k to 60k triangles, 2048 textures) and move on.
3. **Modular kits stay Blender-authored.** Tripo returns monolithic meshes with arbitrary
   pivots. A town kit needs shared grid units, pivots, and collision proxies so blocks
   compose. Kitbash those in Blender, optionally using Tripo pieces (a door, an awning,
   a sign) as detail. Same for bridge modules, fences, walls, rails.
4. **Terrain is a separate problem.** No mesh generator fixes ground that reads as one
   fill. The fix is to bake ground tiles as lit micro-terrain in Blender (real
   displacement, ambient occlusion, scattered pebbles and grass tufts, baked at 512 to
   1024 px), add a deterministic decal layer (ruts, scorch, puddles, wear), and give roads
   authored shoulders and edge blends instead of a stroke. This is backlog T1 to T4 done
   properly, and it is the single biggest change the owner will notice.
5. **Rigging and animation.** Tripo's auto-rig is usable but its animation presets do not
   cover the nine-clip contract. Recommended path: Tripo mesh → Mixamo auto-rig (free)
   → Mixamo animation library (pistol idle, pistol run, hit reactions, deaths, throw,
   melee) → FBX into Blender → hand-adjust in the Action editor. All committed as source.
6. **Keep the layer split.** The runtime composes shadow / lower-body / torso-head /
   weapon so legs and torso face different directions. With a single skinned mesh this
   survives by splitting the mesh at the waist into two objects that share one armature.
   Weapons stay separate objects on `weapon_socket` as today.
7. **Look-dev normalises everything.** Style drift between Tripo outputs is the real
   risk. Blender is where it is removed: replace Tripo PBR with one shared stylised
   shader (three-band shading plus rim, matching the light rig), one outline treatment,
   and the shared light rig. Every actor and prop goes through the same look-dev node
   group before export.
8. **Unify the render engine first.** Move the enemy roster from Workbench to EEVEE under
   the shared light rig in its own cycle. It is cheap and it makes heroes, enemies, and
   props read as one game regardless of mesh source.
9. **Go to 256 px with the new meshes.** Better meshes at 160 px are wasted. The hero
   atlas cap (12.6 MB for four heroes, 2.7 percent headroom) has to be renegotiated;
   options are per-hero atlas loading (verify the runtime loads only the selected hero),
   lossless WebP (typically 25 to 35 percent smaller than PNG; Pixi 8 loads it), or KTX2
   compressed textures via Pixi's compressed-texture loader. Enemies can stay near 192 px.

### 4.2 What the owner produces

For each character or enemy:

- A ChatGPT sheet prompt built from the identity block in `REFERENCE-CHARACTER-MODELS.md`.
  Template:
  `Orthographic character turnaround for a stylised 3D game, A-pose, front / side / back
  views aligned on one row, neutral flat studio lighting, no cast shadows, plain light-grey
  background, full body head to boots, [identity block], practical combat outfit,
  readable silhouette, painterly stylised proportions (Hades / Supergiant), no text.`
- Tripo run: image-to-3D from the front view (add side and back as multi-view where
  Tripo accepts them), PBR textures on, quad remesh on, target 30k to 60k faces, export
  GLB or FBX with textures embedded.
- Deliver: the GLB/FBX, the ChatGPT sheet PNG (reference only, not shipped), the actor
  ID it belongs to. Scale, origin, and facing are fixed in Blender, so do not spend time
  on them.

For props: one ChatGPT image per prop on plain background, Tripo image-to-3D, GLB. Group
deliveries by biome using the palette table in `ART-DIRECTION-GAMEWORLD.md`.

### 4.3 What Claude/Hermes builds

- `scripts/hmh-blender/import-hmh-external-model.py`: import GLB/FBX, normalise scale to
  the actor's target height, set origin to ground contact, face -Y, waist-split, apply
  the shared look-dev shader and light rig, save to the pipeline `.blend`.
- A skinned-actor branch of the hero and enemy exporters that plays keyframed Actions per
  clip instead of the trig poses, renders the same directions × clips × layers, and feeds
  the unchanged atlas packer and reproducibility harness.
- Manifest schema bump (`hmh-production-heroes.json`, `hmh-enemy-roster.json`) adding
  `sourceModel`, `sourceSha256`, `frameSize` per actor, `clipActions`.
- Ground-rule and `BLENDER-ATLAS-PIPELINE.md` text updates recording the policy.
- Repository policy for binary sources: Git LFS for `assets/source/models/**`, size cap per
  file, textures at 2048 max.

## 5. Sequencing

Each step is one bounded RED-first cycle in the existing discipline.

**Phase 0 — plumbing (no visible art change yet)**
1. Enemy roster Workbench → EEVEE under the shared rig.
2. Decouple encounter-director bounds from `camera.zoom` (simulation change, replay note).
3. HUD telemetry strip and session panel behind a `?debugHud=1` flag; child imports
   design tokens (U1).
4. External-model importer + skinned exporter + manifest schema, proven on a throwaway
   mesh with the two-run reproducibility gate.

**Phase 1 — hero pilot**
5. Lester at 256 px through the full pipeline behind `?productionHero=lester-original`
   pilot flag. Lester first: he is the flagship and his mascot head is the easiest
   Tripo subject. Regenerate the selector turntable from the same source.
6. Atlas budget decision (per-hero loading, WebP, or KTX2) with measured mobile decode
   and GPU memory.
7. Remaining three heroes.

**Phase 2 — the world facelift**
8. Terrain rebuild: lit micro-terrain bakes, decal layer, authored roads.
9. First Tripo prop wave (about 20 organics: trees, boulders, wrecks, stumps, debris
   piles, a landmark set-piece per district) plus Blender modular town and camp kits
   (backlog A6, A7).
10. Density pass, anchor-plus-satellite clusters, enemy encampments, ground shadows and
    contact AO under props (W1, W3).

**Phase 3 — enemies and boss**
11. Six roles plus the Liquidator through Tripo → Mixamo → Blender, with per-role
    silhouette and faction colour, and per-phase boss variants.

**Phase 4 — feel and sound**
12. Real HUD (portrait, health bar, weapon card with ammo pips, grenade count, dash ring,
    XP bar) on the design tokens.
13. Per-weapon audio and VFX identity, footsteps by material, grenade feedback set,
    child routed through `hmh-audio-system.mjs`; pause-menu music transport (U2).
14. Key art re-rendered from the new models so portal and game match.

Balance work (S1, C6, S5) proceeds in parallel; it is measurement, not art.

## 6. Non-negotiables carried forward

Fixed 60 Hz simulation, projection-only art, same-seed determinism, bridge and parent
authority, `SETTLEMENT_LIVE=false`, no promotion without approval, no parallel browser
smokes, visual baselines updated only with intent. Committed source meshes are allowed;
shipped pixels that did not come out of the exporter are not.
