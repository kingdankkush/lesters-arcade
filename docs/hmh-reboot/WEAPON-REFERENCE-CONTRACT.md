# Owner weapon and grenade reference contract

Status: source intake verified. **No new weapon model is approved or activated in the game.**

The eleven original PNGs are preserved byte-for-byte in `apps/hmh-reboot/assets/source/reference/weapons/`. `references.json` records the exact original filenames, dimensions, bytes and recomputable SHA-256. It is an immutable intake snapshot, not a model-job or runtime-release ledger. The originals are design authority; the observations below are secondary.

## Direct visual observations

All eleven full sheets were opened for native visual inspection; the three grenades were also inspected as native detail crops. Sheets are multi-view documents, not multiple objects to upload in one image-to-3D input.

| Source asset | Visual identity to retain | Gameplay binding status |
| --- | --- | --- |
| `sci-fi-grenade` | Bright amber energy capsule, dark worn metal cage ribs and circular bands, stacked cylindrical neck, large metal pull ring and bent side lever. Detailed fasteners. | Cosmetic grenade candidate; do not add damage/types from appearance. |
| `spiked-steampunk-grenade` | Egg-shaped weathered olive/dark-steel plate body, prominent conical spikes on riveted plate rows, narrow neck, ring, long bent lever. Restrained chipped red markings and warm worn metal. | Cosmetic grenade candidate; no new simulation type authorized by reference. |
| `weathered-military-grenade` | Compact olive segmented egg body with deep grooves, chipped grey/brown wear, darker rectangular cap, metal ring and long side lever. | Natural visual candidate for existing `satoshi-frag`; mapping not yet activated. |
| `rugged-rifle` | Long worn olive/dark-metal rifle silhouette, stock, dark barrel, curved magazine, contrasting worn grip furniture. Preserve the specific sheet silhouette. | Ambiguous. Do not invent a ninth firearm or silently change `hash-rail`. |
| `sci-fi-grenade-launcher` | Bulky worn olive launcher, large cylindrical drum, forward barrel, stock and warm grip accents. | Candidate cosmetic replacement for existing `launcher-rig`. |
| `rugged-survival-knife` | Broad worn blade, spine notches, compact guard, dark wrapped/ribbed handle; sheet includes several blade/handle views. | Existing melee ID is `litecoin-knife`, not a new firearm entry. |
| `steampunk-raygun` | Distinctive copper/brass mechanical silhouette with turquoise/teal cylindrical energy details, ringed muzzle and warm red/brown housing accents. | Candidate for `lightning-ledger`; confirm against beam presentation before binding. |
| `rugged-shotgun` | Long post-apocalyptic shotgun with worn dark metal, wood-toned stock/fore-end and heavy wear. Preserve its action silhouette rather than the old generic double-barrel mesh. | Candidate replacement for `scatter-shotgun`. |
| `worn-heavy-machine-gun` | Heavy long gun, extended barrel, bulky worn receiver, stock, support/attachment detail. | Candidate replacement for `auto-miner`; visual cadence must match established automatic fire. |
| `weathered-smg` | Compact worn olive/dark-metal automatic weapon, short vented barrel region, pronounced magazine and utilitarian grip/stock. | Ambiguous; preserve as source art until cosmetic routing is chosen. |
| `rugged-handgun` | Angular worn olive/dark-metal handgun with substantial upper slide/receiver and textured dark grip. | Candidate replacement for `coin-blaster`. |

## Existing systems to preserve

- `weapon-system.mjs` owns eight current firearm/special-weapon IDs. New reference filenames do not authorize persisted IDs, new stats, pickup economy, or simulation changes.
- `melee.mjs` already declares `litecoin-knife`. Do not implement a duplicate melee system.
- `grenades.mjs` declares `satoshi-frag`; instances use `hand` or `launcher` mode. Three visual references do not establish three gameplay types.
- `authored-prop-atlas.mjs` already owns the external held-weapon display. It currently places a centered sprite along the screen-space aim vector, not at an exported per-frame hand grip.
- `main.mjs` hides the external firearm during melee, grenade and death actions. Grenade bodies currently render through the existing vector/VFX path. Replace only the visual body after a model atlas is accepted, preserving arc, shadow, fuse and blast feedback.
- Tests are in the repository-root `tests/`, including `hmh-reboot-authored-prop-atlas.test.mjs`, `hmh-reboot-grenades.test.mjs`, `hmh-reboot-grenade-feedback.test.mjs` and `hmh-reboot-grenade-vfx.test.mjs`. The delegated claim that these tests do not exist is false.

## Attachment and animation acceptance

1. Keep separate, editable prop roots; do not fuse weapons/grenades into character bodies.
2. Use the same source model for world pickup and held presentation. Preserve a named local grip and release/muzzle alignment marker in Blender.
3. Bind accepted hero source attachments to that hero's actual `weapon_socket` contract. The current native reference candidate uses `forearm.R`; external Mixamo imports may use a RightHand mapping. They are not interchangeable without an explicit transform.
4. Export per-direction/per-action grip evidence or an equivalent validated projection contract. A centered screen-space prop is not proof the character holds it correctly.
5. Fire/recoil, melee and throw visuals read existing simulation events. Asset animation must never schedule damage, projectile release, grenade detonation, RNG or score.
6. Hide/restore attachments at the correct action phases, validate foreground/background hand occlusion and left/right aim directions, and inspect all four heroes in desktop/mobile gameplay before acceptance.
7. Preserve the nine hero action clips, waist split and shared camera/look-dev. Keep pickup spin/tumble source clips separate from simulation motion.
8. Keep raw GLB/Blender/textures under source paths and Git LFS policy. Only measured, approved alpha atlases enter portal delivery.

## Current local pilot

`create-hmh-reference-grenade.py` authors a sci-fi grenade candidate directly in Blender while Tripo account access is being restored. It is **not a Tripo output**, not a purchase and not a certified runtime replacement. Independent source validation and actual rendered review are required before any status advances.
