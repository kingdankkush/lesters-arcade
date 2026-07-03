# Hard Money Heroes Coordinate Spaces

WO-68 documents the render spaces used by Level 1 so future changes do not reintroduce ground sliding, floating props, or ambiguous depth sorting.

## Spaces

### World tile space

- Units: gameplay/world tiles.
- Producer examples: authored route nodes, prefab stamp anchors, obstacle `worldX/worldY`, player `combat.playerMapX/Y`.
- Purpose: gameplay placement, collisions, route composition, authored prefab positions.
- Do not mix this with screen pixels. A value like `x: 40, y: 6` is a world route coordinate, not a canvas pixel.

### Isometric projection space

- Units: screen pixels after camera projection.
- Conversion: `isoToScreen(worldX, worldY)` in `apps/portal/main.js`.
- Formula: project relative to the player/camera center using `ISO_TILE_WIDTH / 2` horizontally and `ISO_TILE_HEIGHT / 2` vertically.
- Purpose: tile centers, actor centers, prop projected centers, initial canvas draw positions.

### Ground texture lattice space

- Units: rounded screen pixels on the visible floor lattice.
- Helpers: `groundPatternAnchorForOrigin()` and `groundTileLatticePointForProjection()` in `apps/portal/src/hmh-ground-plane-rendering.mjs`.
- Policy: both origin and tile projections add `GROUND_PLANE_Y_OFFSET` and round to whole pixels. This pins the texture pattern to the lower/front edge of the diamond instead of the projected tile center.
- Verification: `npm run visual:regression` must stay green after ground-plane, tile-cache, terrain, or camera changes.

### Prop contact space

- Units: screen pixels at the front edge of an isometric tile diamond.
- Helpers: `propGroundContactPoint()`, `propDrawRectForGroundContact()`, and `propShadowEllipseForGroundContact()` in `apps/portal/src/hmh-prop-grounding.mjs`.
- Policy: a prop's sprite bottom and contact shadow share the same contact point. The default contact point is `projected.y + DEFAULT_ISO_TILE_HEIGHT / 2`, plus any explicit `groundYOffset`.
- Purpose: no floating props, no hidden hand-authored per-asset Y offsets unless they are deliberately expressed as `groundYOffset`.

### Depth-sort space

- Units: screen-pixel Y depth values.
- Helper: `propFrontEdgeDepth()` in `apps/portal/src/hmh-prop-grounding.mjs`.
- Policy: wide/tall footprints sort by their front edge, not by projected tile center alone. `drawOrderBias` remains an explicit override, not a replacement for footprint depth.

## Runtime checklist

When touching render-layer code:

1. Keep world coordinates, projected screen pixels, ground lattice points, and prop contact points separate in names and comments.
2. Prefer named constants over bare offsets for tile height, ground offset, contact shadow position, and depth formulas.
3. Add or update a source-level test for math/policy changes.
4. Run `npm run visual:regression` for live-canvas proof.
5. Use `npm run visual:accept` only for intentional visual output changes, then commit updated `docs/testing/VISUAL_BASELINES/` captures with the code.
