# Hard Money Heroes playable-character production plan

_Last updated: 2026-06-24_

This document narrows the art-production backlog to **playable characters only**. Enemies, minibosses, bosses, map tiles, and Level 1/Level 2 world assets are intentionally out of scope for this pass.

Reference and runtime QA sheets:

- `docs/game-design/assets/hmh-playable-reference-contact-sheet.png` — Justin's attached Lester/Lilly reference stills cataloged.
- `docs/game-design/assets/hmh-playable-reference-contact-sheet.json` — machine-readable source catalog.
- `docs/game-design/assets/hmh-playable-runtime-full-coverage-contact-sheet.png` — live runtime roster coverage after the playable completion pass.
- `docs/game-design/assets/hmh-canonical-actor-contact-sheet.png` — canonical Lester/Lilly identity frames used to rebuild the unlockable runtime rows.

## Current playable roster decision

| Slot | Character | Runtime id | Unlock rule | Production stance |
|---|---|---:|---|---|
| Starter 1 | Lit Commando | `lit-commando` | Available by default | Keep as one of the two main heroes. Finish missing directions/states before AAA lock. |
| Starter 2 | Lit Valkyrie | `lit-valkyrie` | Available by default | Keep as one of the two main heroes. Finish missing death direction before AAA lock. |
| Unlockable | Lester | `lester-original` | Clear Level 1: The Crypto Wasteland | Build a full reference-first sheet from Justin's blue-mask Lester refs. |
| Unlockable | Lilly | `lilly` | Play 10 ranked Hard Money Heroes matches | Build/QA a full reference-first sheet from Justin's teal-haired Lilly refs. |

**Removed from playable canon:** `max-mempool` / Max Mempool. Do not produce playable-character sprites for Max Mempool unless Justin explicitly re-approves him later as a new character concept.

## Runtime animation audit

Required audit states for every playable character:

`idle`, `walk`, `run`, `shoot`, `melee`, `throw`, `hurt`, `death`

Target directions for all gameplay states:

`east`, `north-east`, `north`, `north-west`, `west`, `south-west`, `south`, `south-east`

| Character | Runtime roster key | Current runtime coverage | Completion status | Final-art caveat |
|---|---:|---|---|---|
| Lit Commando | `lit-commando` | All 8 required gameplay states now have all 8 directions. | Runtime-complete after generated gap fill for `shoot/south-east`, `hurt/north`, and 8-direction `death`. | Review/hand-polish generated hurt/death frames in Aseprite before final AAA lock. |
| Lit Valkyrie | `lit-valkyrie` | All 8 required gameplay states now have all 8 directions. | Runtime-complete after generated `death/north-west` fill. | Review/hand-polish generated death direction before final AAA lock. |
| Lester | `lester` roster used by `lester-original` | All 8 required gameplay states now have all 8 directions. | Runtime-complete via `scripts/build-hmh-playable-reference-runtime-pack.py`, rebuilt from the canonical blue-mask Lester frames. | Diagonal/back facings are deterministic transform-derived from canonical art, not yet hand-drawn final Aseprite frames. |
| Lilly | `lilly` | All 8 required gameplay states now have all 8 directions. | Runtime-complete via `scripts/build-hmh-playable-reference-runtime-pack.py`, rebuilt from the canonical teal-haired Lilly frames. | Diagonal/back facings are deterministic transform-derived from canonical art, not yet hand-drawn final Aseprite frames. |

## Justin reference art now cataloged

### Lester reference identity

Attached/reference sheet count: **15 Lester weapon/direction stills**, all `1254x1254`.

Core visual cues to preserve:

- Blue mask/helmet/head wrap with a strong white face mark.
- Large readable eyes and slightly goofy but tough arcade-hero expression.
- Blue neck scarf/tail silhouette visible from side views.
- Tan cargo pants, black boots, black gloves.
- Dark tactical vest/harness with ammo bandolier across the torso.
- Chunky weapons that must remain readable at gameplay scale: pistol, shotgun, machine gun, grenade, hunting knife.

Available Lester reference angles/actions:

| Direction family | Available references |
|---|---|
| Front / south-facing | pistol/base facing, shotgun, grenade, machine gun, knife/melee |
| Left side | side profile, shotgun, grenade, machine gun |
| Right side | side profile, shotgun, grenade, machine gun, knife/melee |
| Missing from attached set | north/back, all four diagonal iso facings, left-side knife if not derived from other Lester knife refs, full animation in-betweens |

### Lilly reference identity

Attached/reference sheet count: **15 Lilly weapon/direction stills**, all `1254x1254`.

Core visual cues to preserve:

- Long teal hair with strong silhouette and flowing shape.
- Round glasses/goggles; face must remain readable and not collapse into hair at sprite scale.
- Dark tactical armor with gold/yellow and teal accents.
- Slimmer/agile silhouette than Lester.
- Weapon poses for pistol, shotgun, machine gun, grenade, and hunting knife.

Available Lilly reference angles/actions:

| Direction family | Available references |
|---|---|
| Front / south-facing | pistol, shotgun, grenade, machine gun, knife/melee |
| Left side | pistol, shotgun, grenade, machine gun, knife/melee |
| Right side | pistol, shotgun, grenade, machine gun, knife/melee |
| Missing from attached set | north/back, all four diagonal iso facings, full animation in-betweens |

## Required playable-character animation list

These are the production states every final playable character should ship with. The runtime can alias some states temporarily, but the AAA target should be explicit, readable, and consistent.

### Core movement and stance

| State | Directions | Suggested frames | Notes |
|---|---:|---:|---|
| `idle` | 8 | 6-8 | Breathing/weight shift; weapon held safely; no huge motion. |
| `walk` | 8 | 8 | Slower traversal gait; useful for analog/mobile movement. |
| `run` | 8 | 8 | Main movement loop; clear footfall and body bob. |
| `turn/aim-hold` | 8 | 1-3 | Optional but useful for twin-stick aim without sliding feet. |

### Weapon and combat actions

| State | Directions | Suggested frames | Notes |
|---|---:|---:|---|
| `shoot` / `fire-pistol` | 8 | 5-7 | Pistol body recoil pose only. Bullets/tracers stay coded VFX, not sprite sheets. |
| `fire-shotgun` | 8 | 7-9 | Heavy recoil + pump/readable recovery. Pellet projectiles stay coded VFX. |
| `fire-machinegun` | 8 | 5-7 loop or burst | Sustained recoil loop; muzzle flash remains small coded VFX. |
| `throw` / `throw-grenade` | 8 | 7-9 | Wind-up, release, follow-through; grenade projectile is coded VFX. |
| `melee` / `melee-knife` | 8 | 6-8 | Strong anticipation and slash arc readability; knife should not disappear at small scale. |
| `reload` | 8 | 8-12 | Optional for now, but recommended because weapons have distinct clip/reload behavior. |

### Damage, progression, and UI moments

| State | Directions | Suggested frames | Notes |
|---|---:|---:|---|
| `hurt` | 8 | 4-6 | One clear recoil/flicker pose; must not look like attack wind-up. |
| `death` | 8 | 8-12 | Non-looping; readable collapse from each direction. |
| `pickup` | 8 | 4-6 | Optional but useful for weapon/cache pickups. |
| `levelup` | 8 or south-only UI pose | 8-12 | Can be a special effect overlay if full 8-dir is too expensive. |
| `victory` | 8 or south-only UI pose | 8-12 | Menu/results use; not required during combat. |

### Production minimum per final character

Minimum gameplay-complete sheet:

- 8 directions × 8 required states = **64 directional animation groups** per character.
- At roughly 6-8 frames each, expect **384-512 gameplay frames per character** before optional `reload`, `pickup`, `levelup`, and `victory`.
- Final deliverables per character should include:
  - transparent PNG frames,
  - normalized fixed canvas size,
  - frame anchors/pivots,
  - JSON manifest,
  - runtime import module if needed,
  - contact sheets by state,
  - short GIF/MP4 previews for QA.

## Production priority

1. **Lock canon and runtime selection**
   - Starters: `lit-commando`, `lit-valkyrie`.
   - Unlockables: `lester-original`, `lilly`.
   - Max Mempool removed from playable canon.

2. **Finish starter gaps first — done for runtime coverage**
   - Lit Commando: `death` all 8 directions, `shoot/south-east`, and `hurt/north` now exist in the runtime roster.
   - Lit Valkyrie: `death/north-west` now exists in the runtime roster.

3. **Build Lester full reference-first pack — done for runtime coverage**
   - Uses canonical blue-mask Lester frames as the live runtime identity.
   - `idle`, `walk`, `run`, `shoot`, `melee`, `throw`, `hurt`, and `death` all have all 8 directions.
   - Back/diagonal directions are transform-derived and should receive future hand-polish.

4. **QA/rebuild Lilly against refs — done for runtime coverage**
   - Uses canonical teal-haired Lilly frames as the live runtime identity.
   - `idle`, `walk`, `run`, `shoot`, `melee`, `throw`, `hurt`, and `death` all have all 8 directions.
   - Back/diagonal directions are transform-derived and should receive future hand-polish.

5. **Only after playable characters are locked:** revisit enemies, minibosses, bosses, and world assets.

## Is PixelLab still the best method?

**Short answer:** PixelLab is still useful, but for AAA playable characters it should not be the only tool or the final authority.

Recommended pipeline for playable characters:

1. **Reference-first art direction**
   - Justin's Lester/Lilly refs are canonical. Do not replace them with generic AI lookalikes.
   - Build contact sheets and visual QA boards before generating derivative frames.

2. **PixelLab for controlled generation and in-between expansion**
   - Good for: generating missing directions, early animation frames, style calibration, prop/weapon variants, and fast iteration.
   - Use small calibration batches first, then review contact sheets before spending credits on full runs.
   - Do not accept raw PixelLab output as final without cleanup.

3. **Aseprite for final AAA pixel-art cleanup**
   - Best practical tool for hand-polishing pixel animation, onion-skinning, palette control, timing, and sprite-sheet export.
   - This is the recommended final-pass editor for playable heroes.

4. **Pixelorama / LibreSprite / Piskel as backups**
   - Useful free/open-source alternatives, but Aseprite is stronger for production animation polish.

5. **Repo pipeline for integration**
   - Normalize canvases, transparent backgrounds, pivots, manifests, contact sheets, and runtime smoke tests.
   - Bullets, shotgun pellets, machine-gun rounds, grenades in flight, muzzle flashes, shell casings, and hit sparks should remain coded VFX/projectiles. The character sheet should supply the firing/throwing/melee body poses, not every projectile.

**Recommendation:** Use a hybrid pipeline: **PixelLab for assisted generation + Aseprite/human polish + repo manifest/runtime verification**. That is the best path toward AAA-quality playable character art without losing Lester/Lilly's actual identity.
