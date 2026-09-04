# External model pipeline — committed GLB/FBX into the deterministic sprite path

Cycle 072, tasks P-1 (importer), P-2 (skinned exporter branch) and P-3 (manifest
schema). This is the second source path for HMH actor art. It does not replace
the procedural one: the four shipped heroes and the whole enemy roster still
build their meshes from Python primitives, and nothing in this document changes
a single shipped pixel.

Everything here is **projection-only**. An imported mesh feeds the atlas and its
metadata. Collision, damage, AI, spawning, RNG, progression and results come
from `enemy-archetypes.mjs`, the movement/combat modules and the gameplay body
profile, and none of them can see a bone.

---

## 1. What the owner delivers

The workflow the roadmap 8.1 describes is ChatGPT concept sheet -> **Tripo**
mesh -> **Mixamo** rig and animation clips. What this pipeline needs back from
that chain is:

| Item | Requirement |
| --- | --- |
| File | one `.glb` (preferred) or `.fbx` per actor |
| Contents | exactly **one armature**, exactly **one skinned body mesh**, plus separate mesh objects for any weapon |
| Scale | any — the importer normalises height; do not pre-scale to match the game |
| Facing | any — declare it once as `facingYawDegrees`; the game's rest facing is **-Y** |
| Origin | any — the importer re-grounds the actor on its own rest-pose bounding box |
| Animations | one Blender/Mixamo **action per visual state**, never one action shared by two states |
| Textures | packed into the GLB, or none at all |
| Location | committed under `apps/hmh-reboot/assets/source/models/`, per roadmap 1.2 |

The committed file **is** repo-owned source, exactly like a `.blend`. Its
SHA-256 goes in the manifest and the importer refuses to run if the file on disk
disagrees. Reference sheets and concept art stay outside Git.

### Git LFS policy (P-5, Cycle 073)

Source models are large opaque binaries, so they travel through Git LFS rather
than as ordinary blobs. `.gitattributes` carries one rule per extension under the
models root, written by hand (not `git lfs track`, which rewrites the file) so the
policy stays readable and test-pinned:

```gitattributes
apps/hmh-reboot/assets/source/models/**/*.glb  filter=lfs diff=lfs merge=lfs -text
apps/hmh-reboot/assets/source/models/**/*.fbx  filter=lfs diff=lfs merge=lfs -text
apps/hmh-reboot/assets/source/models/**/*.bin  filter=lfs diff=lfs merge=lfs -text
apps/hmh-reboot/assets/source/models/**/*.png  filter=lfs diff=lfs merge=lfs -text
apps/hmh-reboot/assets/source/models/**/*.jpg  filter=lfs diff=lfs merge=lfs -text
apps/hmh-reboot/assets/source/models/**/*.jpeg filter=lfs diff=lfs merge=lfs -text
```

The `-text` is load-bearing: before these rules a `.glb` under that path
resolved `text: auto` and was subject to end-of-line autodetection. `**` matches
zero or more directories, so both `models/lester.glb` and
`models/lester/lester.glb` are covered.

Limits, enforced by `npm run assets:hmh:models:lfs-check`
(`scripts/hmh-source-model-lfs-check.mjs`):

| Limit | Value | Why |
| --- | --- | --- |
| Per-file cap | **40 MB** (`41,943,040` bytes) | a GLB with packed 2048 textures lands well under this; anything above is an unpacked texture set or an undecimated scan |
| Texture edge | **2048** px per edge, checked on the PNG IHDR | the exporter renders frames at the manifest `frameSize` (256 px in the pilot), so texture detail above 2048 never reaches a sprite and only costs LFS quota |
| Textures | packed into the GLB (see the delivery table) | `external_dependencies()` must count zero |

The offline check runs with no network and passes honestly on a repository with
zero models (`trackedModels: 0`): the rules exist, `git check-attr` resolves
`filter: lfs` for a probe path per extension, every tracked model under the root
is listed by `git lfs ls-files`, its HEAD blob is a pointer
(`version https://git-lfs.github.com/spec/v1`), the smudged file is under the
cap, and PNG dimensions are within the edge limit.

**First-commit ritual** for a new model (`git lfs install` is already system-wide
on the build host, `filter.lfs.required=true`):

1. `git add apps/hmh-reboot/assets/source/models/<actor>.glb`
2. `git lfs ls-files` lists the file (`*` = the object is present locally).
3. after committing, `git show HEAD:apps/hmh-reboot/assets/source/models/<actor>.glb | head -1`
   prints the pointer's `version` line, not binary.
4. `npm run assets:hmh:models:lfs-check` passes with `trackedModels` >= 1.
5. once, before pushing the first model, prove a clean clone can pull it:
   `node scripts/hmh-source-model-lfs-check.mjs --clean-clone <empty-dir>`
   clones with `GIT_LFS_SKIP_SMUDGE=1`, runs `git lfs pull`, and compares each
   model's SHA-256 with the manifest's `sourceSha256`. This is a ritual to run
   when a model exists, not a fact Cycle 073 could exercise: the models
   directory is still empty and `git lfs ls-files --all` is `0`.

Hosting notes: Vercel's Git LFS setting stays **off**. `npm run vercel:build`
never reads `apps/hmh-reboot/assets/source`, so pointer files in the Vercel
checkout are inert; if a future exporter runs inside the Vercel build, that
setting must be enabled first (owner action). GitHub's free LFS quota is about
1 GiB of storage and 1 GiB/month of bandwidth, which roughly 25 models at the
cap would exhaust; and `npm run repo:health:strict` counts the smudged
working-tree bytes of LFS files against its 350 MiB tracked-size budget exactly
like committed binaries.

---

## 2. Manifest fields

Both `hmh-production-heroes.json` (schema `hmh-reboot-production-heroes-v2`) and
`hmh-enemy-roster.json` (schema `2`) advertise the same optional keys. They are
**siblings** of `clips` and `animationProfile`, never members of them — those two
objects are pinned by `deepEqual` assertions in several test suites.

Every key is optional. An entry with none of them renders through the
trigonometric poser exactly as before.

```jsonc
{
  "actorId": "…",
  "sourceModel": {
    "path": "apps/hmh-reboot/assets/source/models/<actor>.glb",
    "format": "glb",                       // glb | gltf | fbx
    "sourceSha256": "<64 hex>",            // verified before import
    "targetHeight": 2.08,                  // metres, from hmh-reference-character-models.json
    "facingYawDegrees": 0,                 // rotation applied so the actor faces -Y
    "weaponSocketParentBone": "mixamorig:RightHand",
    "weaponObjects": ["Pistol", "Rifle"],  // regexes matched against object names
    "lowerBodyBones": ["Hips", "LeftUpLeg"], // optional; auto-detected when absent
    "actionRenames": { "mixamo.com": "HMH_Idle" }
  },
  "frameSize": [256, 256],                 // per-actor; the pivot scales with it
  "lookDev": "hmh-lookdev-v1",
  "clipActions": { "idle": "HMH_Idle", "run": "HMH_Run" },
  "armature": "HMH_MyActorRig"             // defaults to manifest.scene.armature
}
```

`sourceModel` without `clipActions` is rejected by
`tests/hmh-reboot-external-model-pipeline.test.mjs`: without it the exporter
would fall through to the trigonometric poser and render eight identical
T-posed directions.

Nothing about these keys reaches the child bundle.
`apps/hmh-reboot/src/production-hero-atlas.mjs` consumes `frame`, `anchor`,
`pivot`, `sourcePivot`, `fps` and `loop`, and keys off `pipelineId`, which is
unchanged.

---

## 3. The importer

`scripts/hmh-blender/import-hmh-external-model.py` is both a module (called by
`create-hmh-production-hero-pilot.py`) and a standalone CLI:

```bash
blender --background --factory-startup \
  --python scripts/hmh-blender/import-hmh-external-model.py -- \
  --manifest apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json \
  --actor-id lester-original \
  --output-blend .tmp/lester/import.blend \
  --inspection-output .tmp/lester/import-inspection.json
```

It prints `{"status": "pass", "contentSha256": "…"}` and writes a canonical
inspection JSON.

What it does, and why each step exists:

1. **SHA-256 verification** against `sourceModel.sourceSha256`.
2. **Import** with `disable_bone_shape=True`. Without that flag the glTF
   importer adds a real `Icosphere` object as the bone display shape; it carries
   no `hmh_layer` tag, so the exporter never hides it and it renders on top of
   every layer as a giant white ball. Any object the import leaves untagged is
   forced to `hide_render` for the same reason.
3. **Rotation mode.** glTF and FBX hand the armature *object* over in
   `QUATERNION` mode. The exporter drives the eight render directions through
   `rig.rotation_euler[2]`, which is silently ignored in that mode — the symptom
   is eight byte-identical direction frames. The importer converts the object to
   `XYZ`, and both exporters re-assert it defensively.
4. **Ground-contact origin.** The rest-pose bounding box is measured in
   armature space and the whole rig — edit bones and mesh objects together — is
   translated so the feet sit at z=0 and the silhouette centre sits on the
   armature's own origin. This is what makes `rig.rotation_euler[2]` a spin in
   place rather than an orbit.
5. **Height normalisation on a parent Empty** (`HMH_<actor>_Root`), which carries
   a uniform scale and the facing yaw. Scale is *never* applied to the armature:
   `transform_apply` does not scale an action's location fcurves, so a Mixamo hip
   translation would keep the source model's scale. A uniform scale plus a Z-only
   rotation is exactly the composition the exporter's per-direction yaw can layer
   on top of.
6. **Waist split** (see 4).
7. **Weapon socket** (see 5).
8. **Ground shadow** — the same 48-sided squashed disc the procedural pipeline
   uses, built at 1/scale so it lands at the shared world radius.
9. **Look dev** (see 6).
10. **Action hygiene** — renames applied, object-level fcurves stripped, the glTF
    NLA stash muted, `use_fake_user` set (see 7).
11. **Tagging** — `hmh_layer`, `hmh_actor_id`, `hmh_variant_id`,
    `hmh_runtime_authority = "projection-only"`, plus `hmh_source_sha256` on the
    armature.

---

## 4. The layer split

The exporter renders one layer at a time and the packer composites them in
`composition` order, so an actor must arrive as separate objects per layer. A
Tripo/Mixamo delivery is one mesh.

`split_skinned_mesh_at_waist` duplicates the body mesh and deletes the
complementary faces from each copy:

- a **vertex** is lower-body when more than half of its total deform weight sits
  on a lower-body vertex group;
- a **face** follows the majority of its vertices;
- lower-body bones are `sourceModel.lowerBodyBones` when declared, otherwise
  every bone matching `hip|pelvis|upleg|thigh|shin|calf|knee|ankle|foot|toe|leg`
  and not matching `spine|chest|clavicle|shoulder|neck|head`.

Duplicating rather than separating is deliberate: both halves keep the Armature
modifier and the **full** vertex-group table, so they deform as one actor. The
result is `lower-body` and `torso-head` objects sharing a single armature. An
empty half raises rather than rendering a hole.

---

## 5. The weapon socket

`weapon_socket` is a game convention, not something Mixamo produces. If the
armature has no bone by that name the importer creates one under
`sourceModel.weaponSocketParentBone` (default `forearm.R`), with its head at the
parent bone's tail and its tail a quarter-metre further along the parent's axis.

Every mesh whose name matches a `weaponObjects` regex then loses its Armature
modifier and is bone-parented to the socket with its world matrix preserved. The
depsgraph is updated between setting the parent and restoring the matrix: the
`matrix_world` setter solves against the *evaluated* parent, and without that
update the weapon lands near the actor's spine.

Declaring a `weapon` layer with no matching object is an error, not a silent
empty layer.

---

## 6. Look dev

One node group, `HMH_LookDev_v1`, replaces every imported material's shader
while keeping its albedo (a packed texture stays connected; a flat colour is
copied into the group input).

```
Diffuse BSDF -> Shader to RGB -> ColorRamp (CONSTANT, 3 stops) -> x Base Color ─┐
Layer Weight (Facing) -> ColorRamp (CONSTANT) -> x Rim Strength -> x rim colour ┴-> + -> Emission -> Group Output
```

- Bands: `0.00 -> 0.50`, `0.38 -> 0.78`, `0.72 -> 1.00`, constant interpolation.
- Rim: Layer Weight blend `0.45`, threshold `0.80`, strength `0.55`, tinted by
  `hmh-light-rig.json` `colors.rim` so it agrees with the actual rim light in
  the scene.

Those numbers were judged on a rendered sphere and cube under the shared rig,
not derived. The rim started at blend `0.55` / threshold `0.62`, which produced a
fat desaturated halo on curved geometry rather than an edge accent; it also
inflated every frame's alpha bounding box enough to push the throwaway atlas from
2048 to 4096.

`Shader to RGB` is EEVEE-only. An imported actor therefore renders under
`BLENDER_EEVEE`. The enemy roster is still `BLENDER_WORKBENCH`, so the schema
supports `clipActions` there but nothing uses it until **P-4** moves the roster
to EEVEE in its own cycle.

---

## 7. The exporter branch

Both `export-hmh-production-hero-pilot.py` and `export-hmh-enemy-roster.py` now
carry `resolve_rig`, `set_clip_action` and `sample_clip_frame`. When a manifest
entry has `clipActions`, the exporter assigns the named action and its object
slot and samples `frames` poses evenly across the action's own frame range —
looping clips stop one step short of the end so the loop does not repeat its
first pose, one-shot clips land exactly on the last frame. Directions, layers,
filenames, packer and gates are unchanged.

The branch exists because `reset_pose` — which the trigonometric branch calls
before every frame — forces `pose_bone.rotation_mode = "XYZ"`. Imported actions
key `rotation_quaternion`. Running `reset_pose` on an imported rig leaves every
rotation channel unevaluated and freezes the actor at rest for all 8 x N frames.
The skinned branch never calls it; it clears the action and returns to
`scene.frame_start` when the render is done.

The trigonometric branch is byte-for-byte what it was, including the
`apply_pose(..., pilot["animationProfile"])` and
`apply_pose(rig, actor, state, frame_index, clip["frames"], stoop)` call sites
that sibling suites regex-pin.

---

## 8. The reproducibility gate

```bash
npm run assets:hmh:skinned-test          # build once
npm run assets:hmh:skinned-test:verify   # build twice, cold, and compare
```

`scripts/run-hmh-skinned-test-pipeline.py` generates a throwaway skinned GLB
(`scripts/hmh-blender/create-hmh-skinned-test-actor.py`), imports it twice, and
renders it through the *unmodified* production-hero runner using
`--manifest apps/hmh-reboot/assets/source/blender/hmh-skinned-test-actor.json`
and `--output-root .tmp/hmh-skinned-test-actor/generated`.

Three separate claims:

1. **The fixture is deterministic.** Its GLB SHA-256 must equal the value pinned
   in the manifest. `--update-sha` re-pins it, and is only correct after a
   deliberate change to the fixture generator.
2. **The import is deterministic (P-1 acceptance).** Two cold imports must agree
   on `contentSha256`, a hash over bone names, per-object geometry and weight
   digests, action ranges and fcurve counts, layer assignment and materials.
   Raw `.blend` bytes are deliberately **not** compared: `save_as_mainfile`
   embeds session state, and no pipeline in this repository has ever hashed them.
3. **The render is deterministic (P-2 acceptance).** The runner renders the actor
   twice inside one session and enforces the manifest's reproducibility budget;
   `--verify-reproducible` then rebuilds everything cold and requires
   byte-identical decoded frames and artefacts.

Nothing the gate produces is committed. The GLB, the `.blend`, the raw frames,
the atlas, the metadata and the contact sheet all live under `.tmp/`, which is
gitignored. Only the manifest, the fixture generator, the importer and the runner
are in the tree.

### Frame-uniqueness constraint

`run-hmh-production-hero-pilot.py` rejects any two decoded-identical non-shadow
frames and requires `uniqueAnimatedFrameCount` to equal every non-shadow frame.
Two consequences for authored clips:

- **one action per state.** Two states sharing an action collide on their shared
  rest frame.
- **no half-period symmetry.** A 2-frame clip is sampled at the action's start
  and its half-period. A sine-driven cycle puts both samples on the same zero
  crossing; a leg cycle offset by exactly pi makes frame 0 and frame 12 mirror
  images, which hash identically when the actor is symmetric and the camera
  faces it head-on. The throwaway fixture uses cosine for its 2-frame clips, a
  2.1 rad leg offset instead of pi, and one asymmetric detail per half (a right
  knee pad, a left shoulder pack).

---

## 9. Known limitations

- **The waist seam is a cut, not a blend.** Faces are assigned by weight
  majority, so the boundary is jagged and both halves show their open edge where
  they overlap. It is unnoticeable on the fixture at 256 px; a real actor with a
  belt or a jacket hem should hide it. The fallback, if a gap ever shows on an
  extreme torso rotation, is a one-ring overlap band assigning boundary faces to
  both halves.
- **The rim is omnidirectional.** `Layer Weight` gives an edge mask, not a
  light. It reads as an accent rather than a directional rim, and its colour
  desaturates when added over a saturated base.
- **Packed textures are not yet allowed.** `external_dependencies()` in
  `create-hmh-commando-concepts.py` counts any image with a `filepath` as an
  external dependency, and the runner rejects a non-zero count. The throwaway
  fixture is untextured, so this has not bitten yet; a real Tripo GLB will need
  that helper taught to ignore `packed_file` images. Tracked as a C-1 follow-up.
- **One skinned body mesh only.** A delivery split into several skinned meshes is
  rejected rather than merged, because merging would need a material and UV
  policy this cycle has not decided.
- **Weapons must be separate objects.** A weapon modelled into the body mesh
  cannot be moved to the socket.
- **Atlas size.** The fixture packs 248 frames at 256 px into a 2048 atlas, but
  the packer only tries 1024 and 2048. A 256 px shipped hero with the full
  nine-clip table will need that ceiling revisited alongside P-6's format
  decision and the 3.25 MiB / 12 MiB budgets in
  `scripts/hmh-reboot-production-asset-qa.mjs`.
- **`contentSha256` covers the import, not the look.** Retuning the look-dev
  constants does not change it. The render hashes are what cover shading.
- **No real model has been through this.** Everything above is proven on a
  procedurally generated fixture that deliberately imitates a Tripo/Mixamo
  delivery (one skinned mesh, no `weapon_socket`, quaternion actions). The first
  owner-supplied mesh is C-1 and is owner-input gated.

---

## 10. Related

- `docs/hmh-reboot/BLENDER-ATLAS-PIPELINE.md` — the procedural pipeline this one
  feeds into.
- `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md` — the per-actor height and
  anatomy contract `targetHeight` should come from.
- `docs/hmh-reboot/AAA-ROADMAP.md` 1.2 (asset provenance), 4.1 (P-1..P-7),
  8.1 (owner model production).
