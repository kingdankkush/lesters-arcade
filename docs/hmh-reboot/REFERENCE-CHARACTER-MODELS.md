# Hard Money Heroes reference-derived character model brief

Status: active source-art direction; replacement models are **not yet certified**.
Reference basis: the owner's eight supplied full-body and turnaround PNGs.
Runtime authority: projection-only; preserve established gameplay and parent-platform contracts.

## Source authority

Read [REFERENCE-IMAGE-IDENTITY-CONTRACT.md](REFERENCE-IMAGE-IDENTITY-CONTRACT.md) for direct image observations and corrected anatomical-side conventions. The original images, not inherited audit prose, are the final visual reference:

| Actor | Single illustration | Turnaround |
| --- | --- | --- |
| Lit Commando | `apps/hmh-reboot/assets/source/reference/heroes/lit-commando/front.png` | same directory, `turnaround.png` |
| Lit Valkyrie | `apps/hmh-reboot/assets/source/reference/heroes/lit-valkyrie/front.png` | same directory, `turnaround.png` |
| Lester | `apps/hmh-reboot/assets/source/reference/heroes/lester-original/front.png` | same directory, `turnaround.png` |
| Lilly | `apps/hmh-reboot/assets/source/reference/heroes/lilly/front.png` | same directory, `turnaround.png` |

`apps/hmh-reboot/assets/source/reference/heroes/references.json` owns the original filenames, image dimensions, byte sizes and SHA-256 provenance. Preserve those bytes with Git LFS. Keep references and editable source outside the portal runtime package. Local intake does not mean the files have been committed or pushed.

The older illustrated/pixel-sheet compromise, short Lilly coat, Commando forehead headband, royal-blue Lester shirt sleeves and mandatory Valkyrie braid/ponytail are superseded for these new sources. The existing `hmh-reference-character-models.json` is still an input to the **shipped procedural pipeline**. Do not rewrite that live manifest to pretend it already implements the new design.

## Hero identity targets

### Lit Commando

Muscular human survivor, square jaw, stubble, dark mullet and red **neckerchief**. Olive open field shirt with rolled sleeves over a dark tank. Detailed harness, shoulder armor, unit patch, red arm cloth, red-and-brass shell bandolier, belt/pouches, camouflage trousers and riveted knee pads. Black fingerless gloves and combat boots. Native front crops establish the asymmetric costume sides; see the observation contract rather than the older handoff transcription.

### Lit Valkyrie

Athletic human woman with long, voluminous, wavy blonde hair, red **forehead headband**, dog tag and olive cropped tank. Prominent pauldron and red cloth armband on anatomical **left** in the supplied front images. Brass bandolier runs anatomical right shoulder toward left hip. Preserve camouflage cargo trousers, thigh equipment, knee protection, gloves and rugged boots. No invented cape or quiver.

### Lester

Glossy cobalt-blue **spherical mascot head**, large expressive eyes, dark brows, white face-spanning slashed Litecoin mark and friendly broad mouth. Athletic human body, dark short-sleeved shirt, olive tactical vest, blue scarf and wrist wraps, brass bandolier, pouches, tan/camouflage cargo trousers, knee protection and black boots. Preserve editable expression source corresponding to the sheet's six head crops; do not lock the default face to a wink.

### Lilly

Human woman with long wavy teal hair, visible facial likeness and round tinted glasses. **Long open teal coat** with gold angular/circuit trim and split tails, fitted dark corset-like top, angular gold-rimmed `L` buckle, sleeve emblem, teal trousers, thigh equipment, riveted knee pads, gauntlets and black/gold boots. Preserve the coat length instead of imposing the retired cropped-jacket design. Bake coat-tail motion; use the five expression crops as facial references, not extra body subjects.

## Modeling and animation contract

Use the existing [external model pipeline](EXTERNAL-MODEL-PIPELINE.md), shared look-dev, exporter and selector infrastructure. No engine migration or alternate runtime art authority.

- Author genuine skin-deforming surface meshes. Source rigs or action names alone do not prove acceptable deformation.
- Target the current handoff's 30,000–60,000 source triangles and textures no larger than 2048, with topology suitable for shoulders, elbows, hips and knees. Measure actual exports.
- Keep hair, neckwear, armor, bandolier, pouches, coat tails and weapon components editable. Pack source images/material textures; preserve linked-library dependencies as blockers.
- Preserve required runtime bones: `root`, `pelvis`, `spine`, `chest`, `head`, `upper_arm.L`, `upper_arm.R`, `forearm.L`, `forearm.R`, `thigh.L`, `thigh.R`, `shin.L`, `shin.R`, `weapon_socket`. The socket remains a child of `forearm.R`.
- Preserve the nine semantic clips: `idle`, `run`, `aim`, `pistol-fire`, `hurt`, `dash`, `melee`, `grenade`, `death`, using manifest frame counts/FPS. Do not force XYZ rotation on quaternion-keyed actions.
- Preserve lower-body, torso-head, weapon and shadow composition; inspect waist seams under maximum independent torso rotation.
- Keep the dominant right hand/socket and two-handed long-gun compatibility. Animation must visibly communicate weight shift, contact, anticipation, impact and recovery.
- Regenerate selector images from the same accepted source as gameplay, not an unrelated beauty model.

## Source generation permission and limits

The owner authorized Tripo with existing Pro subscription credits for these project models. See `DECISIONS.md`. No additional-credit purchase or subscription change is authorized.

Record the actual generation task ID, inputs, settings, credit charge, plan/rights evidence, returned asset checksums and Blender cleanup provenance. An AI-generated mesh is a draft. Prove the Commando pilot before scaling the remaining heroes. Account verification/access must be resolved through the service's normal login flow; no fabricated generations or task IDs.

## Atlas and performance policy

- New gameplay target: **256×256 source frames**, not a 256-frame animation count. Count actual frames from layers × clip samples × directions.
- Candidate encoding: lossless WebP with `exact=True`, retaining PNG intermediates and existing selected-hero lazy loading, per `DECISIONS.md`.
- The shipped PNG pipeline and current budgets remain active. No runtime URL or cap changes are implied by encoder support.
- Measure actual full-clip packing, compressed bytes, desktop/mobile decode, GPU allocation and active gameplay before choosing page layout or caps. WebP does not reduce decoded RGBA texture memory for the same dimensions.
- Preserve the existing reproducibility limits and run cold reproducibility verification independently twice.
- Preserve current projection-scale authority in the active manifests/runtime; measure body-only hero/enemy parity and foot pivots. Do not silently change collision or hurtboxes to fit art.

## Visual and release acceptance

Each hero requires:

1. Native-resolution front/side/back/three-quarter comparison against the source images, with observable likeness findings rather than a checklist rubber stamp.
2. Structural inspection, packed dependencies, tested skinning and all semantic clips.
3. Gameplay-resolution contact sheet and independent layer/waist composition review.
4. Same-source selector, reproducibility, atlas/aggregate payload gates and measured desktop/mobile performance.
5. Feature-specific active-runtime evidence, approved visual regression changes and serial browser certification.
6. Exact-candidate review, verified deployment and recorded rollback before being called live.

Source art candidates, local `.blend`/GLB files, passing unit tests and attractive single renders are not automatic production replacements.

## Preserved gameplay and enemy boundaries

Human survivor and zombie anatomy remains the active actor canon, with Lester's established mascot head. Ordinary enemies must read at comparable human scale; bosses may be larger only where consistent with their existing gameplay body.

Enemy detail work should improve faces, clothing, hands, boots, gear, role silhouettes and readable tells. Renderer/art code remains downstream of deterministic simulation. Do not alter damage, spawning, AI, RNG, progression, saves, bridge/schema, wallet or settlement authority inside an art change.

Any hurtbox generosity, movement or collision change needs its own measured deterministic slice, same-seed schedule-equivalence tests and replay proof. Historical proposed hurtbox values are not current implementation instructions.

## Sequence and historical context

Commando pilot → remaining heroes → animation/secondary motion and aggregate acceptance → broader enemy, world, combat and portal improvements in the active roadmap order. Keep incomplete candidates isolated and production rollback available.

Cycles 028–031 describe the older shipped procedural detail kits. They remain historical implementation evidence, not acceptance of these newly supplied references. Consult the current Cycle 074 handoff and `DECISIONS.md` for continuation scope and permissions.
