# HMH WO-92 / WO-96 Approval Blockers

This note records the parts of the Fable WO-92 to WO-101 brief that are intentionally **not** safe to execute autonomously yet.

## WO-92 — Hero canon lock

Blocked until Justin provides or commits the 19 canon reference PNGs under:

- `docs/art/canon/lester/`
- `docs/art/canon/lilly/`

Required before integration:

1. Rename refs to `<hero>-<direction>-<state>.png`.
2. Alpha-clean checkerboard/white-background refs.
3. Generate `docs/art/HERO_CANON.md` from actual pixel samples.
4. Explicitly vault/de-reference deprecated Lester designs.
5. Justin approval of HERO_CANON before pose generation.

No hero generation or playable-slot art replacement should happen without those source references and approval.

## WO-96 — Macro map plan

Blocked until Justin approves a committed macro-map plan/overlay for:

- Neon City Core
- Old Canal & Riverfront
- Lakeside Park & Old-Growth Forest
- Farmstead Outskirts
- Industrial Yard
- Extraction Plaza

Required before asset generation:

1. Zone plan covering 100% of finite Level 1 bounds.
2. Road/trail/water connectivity table.
3. POI list per biome.
4. Rendered debug-overlay map image.
5. Justin approval before WO-97 art-family generation.

No biome asset generation or map assembly should start until this approval gate is cleared.

## Immediate shipped lane

WO-100 and WO-101 are safe to ship immediately because they are code/control fixes, not generated art, and they directly address live playability complaints.
