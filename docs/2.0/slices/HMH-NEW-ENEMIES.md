# HMH 2.0 new enemies: Rug Puller, Pump-and-Dump Bloater, Tollkeeper, HODL Revenant, Money Printer, Oracle Marksman

2026-09-30. Branch `claude/200-enemies`, base `7cac31fa9`. Enemies lane of the 2.0 visual overhaul (handoff section 2.6).

Status: **unapproved runtime character pilot assets plus a lazy, unreachable archetype table.** No balance claim, no spawn-table change, no Ranked, replay, RNG, collision, damage, AI, save, bridge, wallet or settlement change. The default game does not load any of these models or archetypes.

## Casting

Every candidate GLB under the owner's read-only asset folder was inspected (byte size, SHA-256, triangle count, image textures, rig presence, bounding box) and rendered front/side/three-quarter under the shared heavy lock; the eighteen enemy/boss reference images and the eight named character sheets were viewed at full resolution. Findings that shaped the casting:

- **None of the 28 humanoid GLBs is rigged** (zero skins, zero animations). No paid generation or rigging service was used; the rigs below are built in Blender by the new producer script.
- **Four models are hero look-alikes** (`fantasy character` = Lilly, `military action figure` / `military soldier` = Lit Commando, `female warrior` / `military female character` = Lit Valkyrie, `military mascot` = Lester, `cyberpunk warrior` / `cyberpunk female character` / `military woman` untextured hero duplicates). They were excluded so no enemy reads as a hero (the Forkrunner-reads-as-Lilly complaint).
- **`battered zombie warrior` is already the shipped Bagholder body** (its textures are embedded in `bagholder-rusher.glb`), so it was not reused for the Revenant.
- **Most enemy-suitable models are turnaround sheets**: three or more figures, busts and detached props in one mesh. The builder separates loose parts, clusters touching parts, and keeps the leftmost tall cluster (the front figure); busts, side/back figures and detached shield or bomb props are discarded.
- **Only four unused enemy designs are textured** (Whiteout mercenary, Rugged riot enforcer, Poppie demolitionist, Cyber berserker). The other two roles use untextured figures with a per-vertex palette (height bands plus deterministic wear) baked into their own 512 px atlas. That is a documented draft, not final art.

| Archetype | Owner source (read-only) | Source SHA-256 | Figure | Textured | Rationale |
| --- | --- | --- | --- | --- | --- |
| `rug-puller` Rug Puller | `female combatant 3d model.glb` | `f3b693bb5acbd23226103837f6d1313abb29a90e85a5f384b4bba747b507b6ae` | front of 3-figure sheet | yes | Poppie demolitionist: the lightest, most agile licensed textured figure. Rolled rug on the shoulder, hook and rope are costume geometry. |
| `pump-and-dump-bloater` Pump-and-Dump Bloater | `armored soldier 3d model.glb` | `10c589cbc64d8ad295c214054298e072e59ad7f00dd59b651e689ddc6f35509c` | front of 3-figure sheet | yes | Whiteout armored mercenary: the heaviest licensed silhouette (widest shoulders, deepest torso). Bloat belly, seam ring, hand pump, hose and tie are costume geometry. |
| `tollkeeper` Tollkeeper | `armored soldier 3d model (1).glb` | `2aa5a15c66588dcdfc4e98863a9497e1cf7ef86209a94e6a3c25e9c6b299ef47` | front of 3-figure sheet | yes | Rugged riot enforcer: heavy riot armor is the closest licensed body. Striped toll barrier on the left forearm, beacon hard hat and hi-vis vest bands are costume geometry. |
| `hodl-revenant` HODL Revenant | `zombie warrior 3d model.glb` | `f45683a9bf3932f3a083800e7d2d91e8db4331d6aa6e3f8a9b890e28cafcb64b` | front of 3-figure sheet | no (palette bake) | The brief's "Revenant = zombie warrior". Pale undead/rag palette, open hood, chest chain links, wrist shackles with hanging chain and a padlock so it does not read as the Bagholder. |
| `money-printer` Money Printer | `military character 3d model.glb` | `af40b958cd2079a440756dff05161b151c99f5a473cecbd7bf12d835a1040709` | front of 3-figure sheet | yes | Cyber berserker: the remaining licensed textured human. Brass press backpack, rollers, chimney, note roll/tail and green visor are costume geometry. The reference's suit is not represented. |
| `oracle-marksman` Oracle Marksman | `post apocalyptic warrior 3d model.glb` | `d24f5604e1c239aa1b73213df31cd5522f0b631fadfc558a12f1790f7d02f54b` | front of 3-figure sheet | no (palette bake) | Dusty blue sniper operative: the only sniper-like licensed figure (long coat, rifle slung on the back). Dusty-blue palette, emissive oracle scope, ghillie strips and bipod are costume geometry. |

Alternates considered and rejected: `armored ninja` (Cybernetic rogue assassin sheet, untextured) for the Rug Puller; `heavy armor suit` (untextured riot enforcer sheet) for the Tollkeeper; `dark armored warrior`, `stylized combat character/figure`, `post-apocalyptic female character`, `fantasy female warrior`, `armored warrior`, `armored soldier (2)`, `military soldier (1)`: untextured duplicates of designs already cast or of heroes. `post apocalyptic warrior (1)` is byte-identical to `post apocalyptic warrior`.

The casting table with hashes is code: `scripts/hmh-blender/hmh_new_enemy_casting.py`.

## Producer pipeline (same shape as the shipped six)

`scripts/hmh-blender/build-hmh-new-enemy-source.py --actor <id> --output .tmp/new-enemies/<id>`:

1. Verifies the owner GLB SHA-256, imports it read-only, joins the parts, decimates once, separates loose parts, clusters touching parts and keeps the front figure (receipt: `figureExtraction`).
2. Decimates the figure to a 60,000-triangle editable source, grounds it (feet at z = 0, centred), scales it to the cast height (1.76-1.92 m, comparable to the Bagholder's 1.67 m and the Forkrunner's 2.10 m).
3. Measures landmarks from vertex slices (arm and leg blobs, neck, torso depth) and builds the same 19-bone rig as the shipped native enemies (`root, pelvis, spine, chest, neck, head, upper_arm/forearm/hand .L/.R, weapon_socket, thigh/shin/foot .L/.R`). Receipt: `landmarks` (proportional fallback is recorded when a limb is not separable).
4. Skins with Blender bone-heat weights, falling back to nearest-segment weights (receipt: `weightMethod`, `unweightedVertices`), limited to four influences and normalised.
5. Untextured bodies get a per-vertex palette (boots/legs/torso/skin bands with deterministic wear) that the export bakes; textured bodies keep the owner's PBR textures (downscaled to 2048 in the source, 512 in the runtime GLB).
6. Adds the role costume geometry listed above, parented to bones, using the shared authored-props material helpers.
7. Retargets the six roster role actions (`idle, run, tell, attack, hit, death`) from `hmh_enemy_poses.py` through `hmh_native_roster_poses.py` into the measured rig exactly as `build-hmh-native-roster.py` does, using the profile per enemy: Rug Puller `forkrunner-quick-fork-slash-v1`, Bloater `undead-shoulder-charge-v1`, Tollkeeper `shared-roster-v1`, Revenant `undead-straight-lunge-v1`, Money Printer `gas-bomber-canister-lob-v1`, Marksman `suppression-rifle-burst-v1`. `stagger` and `spawn` clips are not authored: the pose module has no such beats and adding them is a separate authoring slice.
8. Saves `<id>.blend` (packed, compressed) with `source-receipt.json`.

The editable `.blend` sources are **git-ignored** (`.gitignore`, six explicit rules) and archived at `C:\Users\just_\Desktop\Projects\LestersArcade-Assets\2.0\Source\Legacy-Integration-04366747\apps\hmh-reboot\assets\source\models\native-enemies\<id>\` with `archive-receipt.json` (SHA-256 and byte size of the `.blend` and receipt). The exporter resolves a missing worktree source through `HMH_SOURCE_ART_ROOT` (default: that archive root); the committed `source-receipt.json` binds the digest.

Export: `export-hmh-actor-glb-pilot.py --actor <id> --mode inspect|export` (new `prepare_new_enemy`: geometry modifiers applied, body decimated to 8,000 triangles, costume gear baked into a 512 px baseColor/metallicRoughness/normal/emission atlas and joined into one primitive; an untextured body is baked into its own atlas and stays its own primitive), then `verify-hmh-actor-glb-pilot.py` (Blender re-import, five sampled poses per clip, 30 per enemy) and `node scripts/inspect-hmh-actor-glb-pilot.mjs --actor=<id>` (manifest and receipt under `docs/2.0/receipts/<id>-glb-reimport.json`).

## Runtime registration (zero initial-bundle growth)

- `apps/hmh-reboot/src/enemy-archetypes-2.mjs` (new, lazy, imported by nothing in the shipped source): `NEW_ENEMY_ARCHETYPES` with role/health/speed/attack/movement/costs copied verbatim from a named `balanceSource` legacy archetype (Rug Puller from Forkrunner, Bloater and Tollkeeper from Whale Enforcer, Revenant from Bagholder, Money Printer from Gas Bomber, Marksman from Liquidator Agent), `balancePending: true`, `productionComplete: false`, `eliteEnabled: false`, a temporary `spriteFallback` (closest legacy roster sprite id plus a distinct tint) and the `actor3d` file/manifest names.
- `apps/hmh-reboot/src/actor-3d-controller.mjs` (lazy chunk): the six ids join `ACTOR3D_ENEMY_IDS`, so the optional backend can load `hmh-actor-3d-pilot/<id>.glb` when the pilot is enabled.
- `ENEMY_ARCHETYPES`, `ENEMY_ARCHETYPE_IDS`, `ROLE_ARCHETYPES`, `DISTRICT_ROLE_GATES`, `ENEMY_ROSTER_ACTORS`, `ENEMY_PRODUCTION_ART` and `main.mjs` are untouched. This base has no ten-area world spawn tables (the ten areas exist only as `dev/greybox-world-v1.mjs`), so the legacy district map keeps the legacy six. `tests/hmh-new-enemy-archetypes.test.mjs` proves legacy selection over every district, band, five seeds and 240 ordinals never yields a new id, that the legacy table is exactly the historical six, and that no initial-bundle source imports the new module.
- The sprite fallback is data only: wiring the tinted roster reuse into `main.mjs` would add initial-bundle bytes and is deferred with the runtime spawn integration.

## Measured runtime assets

All six are within the existing budgets (6.5 MB, 25,000 triangles, 512 px textures, six clips, 19 joints, two primitives). Grounding comes from the per-frame animated foot root, measured on Blender re-import (30 sampled poses per enemy in ).

| Actor | GLB bytes | Triangles | Vertices | Primitives | Joints | Clips | Images (512 px) | Source triangles | Rig weights | Grounded min z | GLB SHA-256 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|
| rug-puller | 2,337,664 | 9,588 | 10,039 | 2 | 19 | attack, death, hit, idle, run, tell | 7 | 50,410 | bone-heat (0 unweighted) | -2.05e-7 | `543248a842d00296ca4e5ab407ede5883ceef268439d76f1ece5a349cebf71a8` |
| pump-and-dump-bloater | 2,059,084 | 9,348 | 7,990 | 2 | 19 | attack, death, hit, idle, run, tell | 7 | 60,000 | bone-heat (0 unweighted) | -1.53e-7 | `555290a568b5f3175594e02ac97047033d24e98c4e2c221ee6689ace79010e58` |
| tollkeeper | 2,114,328 | 9,764 | 8,941 | 2 | 19 | attack, death, hit, idle, run, tell | 7 | 54,074 | bone-heat (0 unweighted) | -1.49e-8 | `7abaea058eb4604cc10ef0877d1ac72a6906505f989b5675ab5df4d9b6d735ef` |
| hodl-revenant | 2,396,656 | 12,772 | 21,475 | 2 | 19 | attack, death, hit, idle, run, tell | 8 | 59,999 | bone-heat (0 unweighted) | -7.67e-7 | `b45c716938739d16fd06244f2a06e577fb2cafbeef3c8b7e21e01691e40f18ce` |
| money-printer | 2,030,068 | 8,958 | 8,027 | 2 | 19 | attack, death, hit, idle, run, tell | 7 | 57,682 | bone-heat (0 unweighted) | -3.50e-7 | `f8e88ef8dfaa2f71077701671e731d03b67ab46f40ce0bff59e6b97a8578dedd` |
| oracle-marksman | 1,755,868 | 9,156 | 12,529 | 2 | 19 | attack, death, hit, idle, run, tell | 8 | 60,000 | bone-heat (0 unweighted) | -1.66e-7 | `80a435948383a772cd7ed51c1d472728d4e670dc3310c64c417f2322630fb10f` |

Contact sheet (Cycles CPU render of each re-imported runtime GLB, idle front plus six three-quarter poses): `docs/2.0/receipts/hmh-new-enemies-20260930/contact-sheet.png` with `contact-sheet.json`. Inspected findings: all six deform through every clip as humans/zombie at comparable scale; the Revenant hood reads as a pale cap and its palette is dark and low-contrast; the Bloater belly is a plain sphere; elbows are stiff in the shared beats. These are draft-art notes, not blockers for the offline gates.

## Not finished / caveats

- Owner art review of the six figures against the reference sheets has not happened; palette-baked bodies (Revenant, Marksman) are drafts.
- Landmark rigs are measured heuristics, not hand-placed; elbows and knees are approximate and the poses are the shared roster beats, not bespoke clips. `stagger` and `spawn` clips are not authored.
- No browser run, `visual:reboot`, build or device measurement was run in this lane (forbidden by the lane rules); the GLBs are validated offline by the same re-import and Node inspection gates as the shipped six.
- No spawn path reaches the new archetypes; enabling them in the ten-area world needs its own deterministic slice with Ranked isolation.
