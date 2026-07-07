# HMH WO-103–WO-114 Continuation Certification

Seed: 1337
Status: continuation-certified; Justin verdict gate remains open for checkpoints 2-4 and final SHIP_ART_CENSUS lock

This document records shipped runtime/art evidence for the remaining HMH work-order wave without claiming final human verdicts prematurely.

Checkpoint gates:
- Playtest Checkpoint 2: full world assembly and lighting. Justin verdict gate remains open.
- Playtest Checkpoint 3: boss fight checkpoint. Justin verdict gate remains open.
- Playtest Checkpoint 4: UI skin ship-candidate build. Justin verdict gate remains open.

## Work orders

### WO-103: Ground and water biomes
Status: certified-runtime-art-progress

Evidence:
  - manifest: 16 assets
  - animated-water: 2 assets
  - proof-sheet: tracked

Open debt:
  - All-biome live capture tour still needs final human review.
  - Old desert texture vault sweep remains a separate cleanup gate.

### WO-105: Buildings, roads, and arenas
Status: certified-runtime-art-progress

Evidence:
  - arena-road-building-kit: 3 assets
  - acceptance-tour: 6 steps

Open debt:
  - Full bank/forest/container/extraction arena capture tour still needs screenshots from a played run.

### WO-106: Vehicles, micro-scenes, and ambient life
Status: certified-runtime-art-progress

Evidence:
  - vehicle-microscene-life-kit: 3 assets
  - ambient-quota-plan: tracked

Open debt:
  - True flee behaviors for critters are still gameplay debt beyond the static burrow cue.

### WO-107: Full world assembly and lighting checkpoint 2
Status: checkpoint-ready-with-verdict-open

Evidence:
  - six-biome-tour: 6 steps
  - checkpoint-gate: Playtest Checkpoint 2

Open debt:
  - Playtest Checkpoint 2 notice is generated in docs, but Justin verdict remains open until reviewed.

### WO-108: Sprite-derived hurtbox truth
Status: implemented-runtime-policy

Evidence:
  - hurtbox-policy: implemented
  - boss-multi-capsules: implemented

Open debt:
  - Large enemy overlay captures and DPS retune remain balance/capture follow-up after runtime overlay is wired visually.

### WO-109: Enemy redesign batches
Status: certified-roster-progress

Evidence:
  - animated-roster: 37 actors
  - proof-sheet: tracked

Open debt:
  - Not every enemy has full 8-dir state coverage yet; the roster intentionally preserves partial/zero-frame debt rows.

### WO-110: Boss redo checkpoint 3
Status: certified-boss-pack-progress

Evidence:
  - true-scale-boss-pack: 90 assets
  - checkpoint-gate: Playtest Checkpoint 3

Open debt:
  - Boss fight checkpoint sheet needs final played fight captures before ship-candidate signoff.

### WO-111: Final VFX art pass
Status: certified-vfx-pack-progress

Evidence:
  - combat-vfx-pack: 10 assets

Open debt:
  - Minute-8 density capture still needs a deterministic visual smoke run after final actor timing changes.

### WO-112: Audio sync refresh
Status: certified-audio-plan-progress

Evidence:
  - audio-av-certification: certified-runtime-audio-av-plan

Open debt:
  - Listen-through HALTs and mix-density checks still require human ears after final animation timing.

### WO-113: UI skin ship candidate
Status: certified-ui-art-progress

Evidence:
  - ui-skin-pack: 9 assets
  - pickup-and-achievement-icons: 62 assets
  - checkpoint-gate: Playtest Checkpoint 4

Open debt:
  - HUD/cards/minimap/boss/game-over visual capture still needs final screenshot pass.

### WO-114: Coherence baseline lock
Status: baseline-gates-defined

Evidence:
  - coherence-baseline: tracked

Open debt:
  - SHIP_ART_CENSUS lock is not final until the full visual/art-census gate is rerun after all capture approvals.

## Debug overlays

WO-108 exposes wo108-sprite-derived-hurtbox-truth-v1 with separate body/hurt boxes, boss capsules, and debugHitboxes overlay descriptors.

## Final note

Justin verdict gate remains open until the played capture sheets, listen-through HALTs, and final SHIP_ART_CENSUS/visual baseline lock are accepted.
