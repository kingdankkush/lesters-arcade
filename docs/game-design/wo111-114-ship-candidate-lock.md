# WO-111 through WO-114 Ship-Candidate Lock

This document records the final automated evidence for the remaining HMH art work orders.

## WO-111 Final VFX

The final combat VFX pack is bound to runtime frame events for muzzle flashes, impacts, shell casings, pickups, grenade explosions, death bursts, gore overlays, and level-up bursts. Minute-8 density review is represented by the deterministic visual baseline gate: `npm run visual:regression` at elapsed second 480 / seed 1337.

## WO-112 Audio Sync

Audio sync rows define HALTs for missing cue coverage on weapon fire, enemy hit, enemy death, boss warning, pickup, and level-up events. Mix density caps keep boss warnings exclusive and transient voice counts bounded.

## WO-113 Final UI Skin

The ship-candidate UI skin uses the VFX/UI chrome pack, pickup icon pack, and achievement atlas to cover HUD frame, level-up card frame, achievement toast, minimap, wallet badges, mobile controls, pickup icons, and achievement badges.

## WO-114 Coherence Baseline

`npm run design:art-census` refreshed `docs/art/GLOBAL_ART_CENSUS.json` and `.md`. The current lock has 0 unresolved zero-animation runtime actors and keeps repaired/deferred legacy rows explicit.

Justin's final approval remains the only open playtest verdict gate.
