# Map redo brief (owner playtest 2026-07-31 — start here next session)

Owner verdict: the level reads as colored bands with scattered props, not as
places. Full composition redo, target: cohesive readable stylized top-down
(honest approach to the Hades bar via the deterministic pipeline).

## Order of work (one bounded cycle each)
1. **Biome composition** — redesign `level-one-world.mjs` districts as real
   places: forest (dense hashwood, clearings, winding paths), ravine (rock
   walls, chokepoints, rope bridge), crossing (river, bridges, wetland banks),
   mining camp (shacks, ore carts, fenced yards), industrial yard (slab,
   terminals, wreck rows). Every zone: entry routes, an arena, a landmark, a
   recovery pocket. Collision/elevation stay authoritative in the world
   contract; visuals follow it.
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
