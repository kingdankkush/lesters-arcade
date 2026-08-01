# Map redo brief (owner playtest 2026-07-31 — start here next session)

Owner verdict: the level reads as colored bands with scattered props, not as
places. Full composition redo, target: cohesive readable stylized top-down
(honest approach to the Hades bar via the deterministic pipeline).

## Order of work (one bounded cycle each)
1. **Biome composition** — ✅ DONE (Cycle 041): redesigned
   `level-one-world.mjs` districts as real places — winding 25-node main
   route, 11 → 38 blockers (interior structure in every district), seam
   gates, arena cover, tenth POI `yard-medbay-cache` as the yard recovery
   pocket. Guarded by `tests/hmh-reboot-level-one-composition.test.mjs`.
   Remaining composition debt: rope bridge and ore-cart props are dressing
   only; deeper per-zone set-piece work rides with slices 2 and 6.
2. **Terrain fidelity** — raise tile bake to 512px with painted-style
   layering (the bakery is CPU-deterministic; extend `build-hmh-terrain-tiles.py`),
   more fringe pairings, path decals, shore banks.
3. **Enemy pathing** — navgrid/flow-field over the world contract so enemies
   route around walls. SIMULATION change: RED-first, determinism review,
   replay note.
4. **Minimap** — explored/currentlyVisible fog, enemy + POI markers, visual
   redesign to the neon-noir kit (handoff §H8-11 rules).
5. **Combat density** — hurtbox cycle (F1-3) + benchmark-justified balance
   (bench:hmh:weapons + moving-target extension) so swarm clearing feels
   powerful without trivializing early game.
6. **Character escalation** — 256px hero frames (per-asset frameSize is
   proven), richer material variation, then animation pass (A5-6).

## Session discipline (unchanged)
Health check → one slice → RED tests → gates → exact-index review → ledger →
push. prism_mesh winding fix (inward normals) is first if any pipeline reuse.
P0 input fixes shipped `f3e01a85` (window keys, boot focus, right-click
grenade); do not regress: collectible smoke now runs with ZERO manual focus.
