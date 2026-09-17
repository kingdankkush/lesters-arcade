# Chikun character-sheet pipeline (2026-09-16)

Owner direction: fine-tune the 3D Chikun to the original character sheet (white feathers,
spiky crimson mohawk, big glowing mint eyes with dark pupils and heavy brows, small orange
beak, black high-collared trench coat with red lining and lapels, black shirt / trousers /
boots; six expressions) and cover idle, walk, run, jump, superman flight, flying up / down,
steep up / down, landing, and a hit for every obstacle family.

## Rig decision

The native 15-bone rig from `apps/chikun/assets/source/Chikun-Ground-Sky-Rig.blend`
(owner Tripo surface, 31,413 vertices / 62,830 triangles, closed seams, vertex paint) is kept
and extended with three expression bones parented to `head`: `brow.L`, `brow.R`, `beak`
(lower mandible hinge). It already carried every body pose on the list, so a rebuild would
only have cost the repaired skin weights, the ragdoll part split and the ground-motion lineage.
Mesh topology is untouched; the sheet pass is a vertex-paint regrade plus an emissive mask.

Palette (sRGB, written as scene-linear vertex paint): feathers `#f4f1ea`, crest `#c8102e`,
lining / lapels `#a60f26`, eye `#6ff5b0` (emissive, strength 1.0 at rest, up to 7 in the storm
hit), pupil `#0b1412`, beak `#f28c28`, coat `#141416`, shirt `#0c0c0e`.

Expressions are baked per clip (the atlas pipeline has no face layer): stern (default),
side-eye (idle / ready glance beat), surprised (takeoff, brake, dodges, jump-to-flight,
tumble, fall), gritted teeth (dive, steep dive, squeeze, high jump, run), smug (collect,
landings, victory twirl), shouting (every hit, impact, ground impact).

## Clips (39 sheets, 24 frames at 30 fps = 0.8 s each; plus the virtual `flare`)

Flight atlas `apps/portal/assets/generated/chikun-flight-v3/` (28 clips):
ready, takeoff, cruise, accelerate, climb, crest, descend, dive, brake, recover, squeeze,
dodge_high, dodge_low, collect, barrel_roll, impact, tumble, fall, reverse_roll, corkscrew,
victory_twirl, **steep_climb** (loop), **steep_dive** (loop), **hit_tree**, **hit_storm**,
**hit_drone**, **hit_bird**, **hit_wall** (one-shots).

Ground atlas `apps/portal/assets/generated/chikun-ground-motion-v1/` (11 clips):
walk, run, jump, hurdle_jump, high_jump, jump_flight, land, land_roll, land_slide,
ground_impact, **idle** (hands in the coat pockets, breathing, side-eye glance; loop).

Runtime selection (`apps/chikun/src/character.mjs`): `steep_climb` below
`CHIKUN_STEEP_CLIMB_VELOCITY = -2.4` px/tick once the flap edge clips finish, `steep_dive`
at or above `CHIKUN_STEEP_DIVE_VELOCITY = 5.6` while more than 120 px above the floor (the
flare still wins near touchdown), `idle` in the ready / waiting phases when grounded, and
`chikunHitClip()` maps `impact.kind` / `terminalReason` through `CHIKUN_HIT_FAMILIES`
(tree kinds, forest, canopy -> hit_tree; storm -> hit_storm; drone, plane -> hit_drone;
hawk, eagle, pelican -> hit_bird; pipe, town, crate, hurdle -> hit_wall). Grounded hits keep
`ground_impact`; rocks, logs, thorns, shiba and legacy sky reasons keep the prone `impact`.
Family hits blend in 0 s, run on the terminal clock for the full 0.8 s, then drop into
`fall`; the 0.22 s ragdoll handoff in main.mjs is unchanged.

## Commands (deterministic, run from the repository root)

```
# 1. Model + animation pass, 256 px Cycles frames, ragdoll parts, .blend and .glb
"D:/Apps/Blender/blender.exe" -b apps/chikun/assets/source/Chikun-Ground-Sky-Rig.blend --python-exit-code 1 \
  -P scripts/chikun-blender/build-chikun-sheet-rig.py -- --out C:/Users/just_/chikun-sheet
#    (--preview renders one frame per clip; --clips a,b re-renders only those clips)

# 2. Pack the runtime atlases, poster, ragdoll parts, manifests and provenance
python scripts/chikun-blender/pack-chikun-sheet-atlases.py --source C:/Users/just_/chikun-sheet

# 3. Review plates (front / side / back / three-quarter + head close-ups)
"D:/Apps/Blender/blender.exe" -b apps/chikun/assets/source/Chikun-Sheet-Rig.blend --python-exit-code 1 \
  -P scripts/chikun-blender/render-chikun-turnaround.py -- OUT_DIR [idle 1]

# 4. Gates
node --test tests/chikun-*.test.mjs
node scripts/syntax-check.mjs
node build.mjs   # the portal serves apps/portal/dist/chikun/game.js
```

Step 1 always starts from the tracked `Chikun-Ground-Sky-Rig.blend` and writes
`Chikun-Sheet-Rig.blend` + `Chikun-Sheet-Animations.glb` beside it, so re-running never
double-applies the paint or bones. The packer never touches `chikun-flight-v3/audio`.

## Budgets (pinned in tests/chikun-character-sheet.test.mjs and chikun-facelift.test.mjs)

- Flight atlas: 2,971,916 B of a 4 MiB budget (28 sheets, 4 x 6 grid of 192 px frames).
- Ground atlas: 1,006,526 B of a 1.5 MiB budget (11 sheets).
- Ragdoll parts: 9,374 B of 64 KiB.
- Every sheet < 140 KiB, >= 12 unique frames, silhouette never touches the frame edge.
- 18 bones, 62,830 triangles, 39 provenance clips.

Contact sheet of every clip: `docs/chikun/chikun-sheet-clips.png`.
