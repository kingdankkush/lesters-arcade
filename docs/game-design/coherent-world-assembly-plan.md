# Coherent World Assembly — Design + Build Plan (HMH iso roguelike)

Status: IN PROGRESS (started this session). Supersedes the "random prop per cell"
placement that caused "objects littered everywhere with no logic."

## The problem (Justin's feedback, verbatim intent)
- Props are scattered with no coherence: a TV in a field, soda machines outdoors,
  street lamps mid-grass.
- Floor tileset theme should MATCH the arrangement of objects in that area
  (interior → arcade/soda/boxes; street → lamps along the curb; park; forest).
- Street lamps should ONLY line a street/sidewalk, deterministically spaced.
- Some objects must sit ON host objects (TV on a table/entertainment center).
- Objects still look like they "float" (shadow offset). Player has a glow (FIXED
  this session — it was the lighting pass's always-on carved light pool).
- Need constructive/tiling pieces: fences, gates, walls, rivers — with collision,
  wall detection, hit detection, pathing.

## Current architecture (what we build ON, not replace)
- `src/biome-model.mjs` — seed-stable biome REGIONS (BIOME_REGION=22). Good. Keep.
- `src/world-obstacles.mjs` — deterministic per-cell scenes (OBSTACLE_CELL=7),
  circle-vs-circle collision, bullet hit test, water impassability. Solid. Keep
  the collision core; extend the SCENE GENERATION.
- `main.js resolveObstacleProp()` — THE GAP: picks `pool[propIndex % pool.length]`,
  a random prop from the whole biome pool. This is why placement is incoherent.

## The fix: a SCENE-TEMPLATE layer (new `src/scene-templates.mjs`, pure + tested)
Instead of "pick a random prop," a cell instantiates a coherent SCENE TEMPLATE
chosen by biome. A template is a small data structure:

```
SceneTemplate = {
  id, biome, groundTheme,            // ground theme the floor tiles must match
  slots: [                            // each slot = a placed object with a rule
    { role, place, count, spacing,    // place: 'anchor'|'pathEdge'|'scatter'|'onHost'
      hostRole, offset }              // onHost: must attach to a slot of hostRole
  ]
}
```

Placement rules (deterministic from seed+cell so the world is stable):
- `anchor`    — the defining structure (building, big rock), near cell center.
- `pathEdge`  — lines a path/curb at FIXED spacing (street lamps, fences). Walks
                the path tiles and drops one every `spacing` tiles, alternating
                side. Lamps/fences ONLY appear via pathEdge slots.
- `scatter`   — small natural fill (tufts, litter) with min-distance rejection so
                it never clumps or overlaps the anchor footprint.
- `onHost`    — object sits on a host slot already placed (TV → table). Inherits
                host x/y + a small vertical offset; drawn just after host, same
                depth bucket so it renders on top.

Template sets (first pass):
- town/road:  STREET_BLOCK (building anchors + curb with lamps at fixed spacing +
              optional bench/hydrant scatter), STOREFRONT_ROW.
- interior:   ARCADE_INTERIOR (floor = arcade carpet; arcade cabinets in rows,
              soda machine against a wall, stacked boxes, TV-on-table). Interiors
              are entered (a building anchor with a doorway warps to an interior
              cell theme) — phase 2; phase 1 places interiors as discrete "open
              lot" rooms gated by walls.
- forest:     TREE_GROVE (tree clusters + rocks + bushes, no man-made props).
- desert/rocky: ROCK_FIELD (boulders, scrub, no lamps/TVs).
- park:       GREEN_PARK (grass theme + benches along path + trees + fountain
              anchor).

Constructive/tiling pieces (fences, gates, walls, rivers):
- Modeled as MULTI-CELL EDGES, not point props. A "wall run" is a line of wall
  segments between two cell corners with a gate segment; each segment is solid
  (rectangle collision band) and registers in the same obstacle list so pathing +
  bullets respect it. Rivers reuse the water-biome impassability + a bank tile
  edge; a bridge segment is the only passable crossing.

## Ground-theme coupling
Each template declares `groundTheme`; the floor-tile picker keys off the template
at that cell (not just biome) so interiors get arcade carpet, parks get grass,
streets get asphalt+sidewalk. This is the "floor matches the object arrangement"
requirement.

## Collision / pathing / hit detection
- Reuse `resolvePlayerCollision` (circle) for point props.
- Add `resolveSegmentCollision` for wall/fence runs (capsule/segment vs circle).
- Bullets: extend `obstacleHitAt` to test segments too.
- `onHost` and decorative-only slots are NON-solid (walk behind a TV, not into a
  wall of TVs).

## Asset batches to generate (PixelLab, iso, transparent)
Organized as COHERENT SETS so placement has matching art:
1. Street set: street lamp, fire hydrant, bench, mailbox, trash can, traffic cone.
2. Interior set: arcade cabinet (animated screen), soda machine (animated), TV on
   table, entertainment center, stacked boxes, crate, counter.
3. Park/forest set: park bench, fountain (animated water), bush, flower patch,
   pine tree, oak tree, log.
4. Constructive: fence segment + fence post + gate, brick wall segment + corner +
   gate, low stone wall, river straight + bend + bank + bridge.
5. Power-up pickups (animated): ammo box, health, XP boost, shield, magnet — note
   an orphaned `hmh-fx-powerups-wave` pack already exists; wire it first.

## Verification
- Pure unit tests for scene-templates (deterministic output, lamp spacing, onHost
  attachment, segment collision) BEFORE wiring renderer.
- Then wire renderer + collision; browser visual smoke; no console errors.
- `npm run vercel:build` before any deploy.
