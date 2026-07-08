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
  - arena-road-building-kit: 8 assets
  - acceptance-tour: 6 steps

Open debt:
  - Full bank/forest/container/extraction arena capture tour still needs screenshots from a played run.

### WO-106: Vehicles, micro-scenes, and ambient life
Status: runtime-flee-behavior-integrated

Evidence:
  - vehicle-microscene-life-kit: 3 assets
  - ambient-quota-plan: tracked
  - critter-flee-behavior: tracked

Open debt:
  - Integrated runtime captures still need periodic refresh after later lighting/UI changes.

### WO-107: Full world assembly and lighting checkpoint 2
Status: checkpoint-ready-with-verdict-open

Evidence:
  - six-biome-tour: 6 steps
  - lighting-checkpoint-module: tracked
  - checkpoint-gate: Playtest Checkpoint 2

Open debt:
  - Justin verdict remains open until reviewed.

### WO-108: Sprite-derived hurtbox truth
Status: runtime-integrated-with-overlay-proof

Evidence:
  - hurtbox-policy: implemented
  - runtime-adapter: tracked
  - boss-multi-capsules: implemented
  - overlay-capture: tracked

Open debt:
  - DPS retune remains a post-capture balance pass only if playtest feel regresses; collision math now targets sprite-derived hurt cores.

### WO-109: Enemy redesign batches
Status: batch-one-runtime-integrated

Evidence:
  - animated-roster: 37 actors
  - batch-one-8dir-matrix: tracked
  - proof-sheet: tracked
  - coverage-report: tracked

Open debt:
  - Batch one removes five high-priority Level-1 runtime gaps; remaining zero-animation rows are boss/deferred actors outside this batch.

### WO-110: Boss redo checkpoint 3
Status: checkpoint3-runtime-integrated

Evidence:
  - legacy-boss-pack: 90 assets
  - true-scale-boss-redo: 7 assets
  - proof-sheet: tracked
  - checkpoint-gate: Playtest Checkpoint 3

Open debt:
  - Checkpoint 3 is ready for boss-fight review; final approval still requires Justin playtest verdict.

### WO-111: Final VFX art pass
Status: final-vfx-timing-locked

Evidence:
  - combat-vfx-pack: 10 assets
  - vfx-timing-lock: tracked

Open debt:

### WO-112: Audio sync refresh
Status: audio-sync-mix-density-locked

Evidence:
  - audio-av-certification: hmh-wo86-87-88-89-audio-av-cert-v1
  - audio-sync-halts: tracked

Open debt:

### WO-113: UI skin ship candidate
Status: ship-candidate-ui-skin-locked

Evidence:
  - ui-skin-pack: 9 assets
  - pickup-and-achievement-icons: 62 assets
  - checkpoint-gate: Playtest Checkpoint 4

Open debt:
  - Justin final ship-candidate playtest verdict remains open.

### WO-114: Coherence baseline lock
Status: ship-art-census-baseline-locked

Evidence:
  - ship-art-census: tracked
  - coherence-baseline: tracked

Open debt:

## Debug overlays

WO-108 exposes wo108-sprite-derived-hurtbox-truth-v1 with separate body/hurt boxes, boss capsules, and debugHitboxes overlay descriptors.

## Final note

Justin verdict gate remains open until the played capture sheets, listen-through HALTs, and final SHIP_ART_CENSUS/visual baseline lock are accepted.
