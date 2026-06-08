# Isometric Roguelike Shooter — Technique Reference

Distilled from external isometric/shooter repos and articles (Unity 2D_IsoTilemaps,
Bevy iso discussion, Infinite-Tile-Engine-2D, SDL2 iso tutorial, Godot iso proposal,
2DTopDownIsometricShooterStudy, Isobot, iso-in-2D + pygame iso-grid articles).
Engine-specific code is NOT copied — only transferable techniques mapped to our
vanilla JS Canvas renderer in `apps/portal/main.js`.

## A. Isometric rendering & level design

1. **Screen ↔ iso coordinate math.** Keep gameplay in world/grid space; convert to
   screen pixels only at draw time.
   ```js
   // grid -> screen (tile w=64, h=32 => w/2=32, h/2=16)
   screenX = (x - y) * 32 + cameraX;
   screenY = (x + y) * 16 + cameraY;
   // screen -> grid (mouse picking)
   gx = ((sx/32) + (sy/16)) / 2;
   gy = ((sy/16) - (sx/32)) / 2;
   ```
   *Apply:* our `isoToScreen/screenToIso` already use a live canvas center — keep
   movement/AI/streaming in world space, screen coords for render + mouse only.

2. **Painter's-algorithm depth sort.** Draw back-to-front: `depthKey = worldX + worldY`
   (tiebreak by height/type). Tiles row-by-row smallest→largest x+y; actors/props by
   foot `worldX+worldY`.
   *Apply:* collect hero+enemies+props+pickups into ONE render list per frame, sort by
   depth key, draw in order so nothing pops in front of what's "in front" of it.

3. **Occlusion fade behind tall props/buildings.** When the hero's foot point is behind
   a tall prop's footprint, drop that prop's alpha to ~0.35–0.6 instead of hard-hiding.
   *Apply:* set-dressing buildings are kept ≥6 tiles from the player today; add alpha
   fade when the hero passes behind a tall landmark so it never fully blocks combat.

4. **Infinite/streaming tiles.** Chunk cache keyed by chunk coord; load neighbors in a
   radius, recycle far ones; only iterate tiles inside the camera frustum (visible-tile
   culling). Seed each chunk deterministically from its coord.
   *Apply:* matches our seeded biome model — ensure we only draw tiles within visible
   bounds (cull), not a fixed oversized grid.

5. **Tile origin vs sprite foot anchor.** Tile art anchors at diamond bottom-center;
   characters anchor at the feet; tall props store an upward offset so the base sits on
   the tile while art rises above. Use per-sprite `{anchorX,anchorY,offsetX,offsetY}`.
   *Apply:* keep shadow/feet markers OUTSIDE mirrored canvas transforms so anchors don't
   drift (already a known pitfall in this repo).

6. **Movement sync.** `gridPos` = authoritative logical cell (collisions/AI/streaming);
   `renderPos` = interpolated pixels (lerp toward target) for smooth drawing.

## B. Shooter gameplay, AI, FX, balancing

1. **Auto-aim + auto-fire.** Resolve target each fire tick = nearest enemy in forward
   cone/range; keep target until dead/out-of-range; fire on a fixed timer independent of
   movement. Add small target "stickiness" so overlap doesn't jitter aim.
   *Apply:* hero auto-moves toward pointer, auto-fires at nearest enemy on weapon
   fire-rate cadence — matches our canon control model.

2. **Projectile pooling.** Pool bullets/sparks/floating-text; never allocate per shot.
   Loop: move → collide → expire → recycle, with offscreen/dead early-outs. Lifetime +
   pierce/bounce flags + distance/cell broad-phase.

3. **Spawn director.** Spawn OUTSIDE camera ring; spend a growing threat budget on
   templates (cheap chasers, rarer elites, specials); cap visible enemies for
   readability; overflow → delayed offscreen spawns, not a screen flood.

4. **Elite/modifier system.** 1–2 readable modifiers per elite (size, tint, aura, speed,
   shield, teleport, summon) that change BEHAVIOR not just stats; obvious silhouette.

5. **Readable AI archetypes.** Chaser (steer to player), Ranged-strafer (hold distance +
   circle + burst), Flyer (ignore terrain, slower turn/weaker HP), Summoner (keep
   distance, telegraphed cast). One dominant behavior + one visible telegraph each.

6. **Hit feedback / juice.** Layer: muzzle flash on fire, impact sparks/blood on hit,
   floating damage numbers, short screen shake by damage tier, hit-stop ONLY for
   crit/elite/boss. Trigger from combat events, not render guesses. Keep effects short.

7. **Balancing.** Scale enemy HP + count + spawn rate + mix together over time; player
   power rises via XP/upgrades/synergies. Grow spawn budget + elite frequency FASTER
   than raw HP so the game gets denser/more tactical, not spongey. XP curve slows
   level-ups modestly while each pick gives a meaningful spike.

8. **North star: clarity under pressure.** One target, one shot rhythm, one obvious
   threat, one clear reward loop. "Always know why I got hit." If a system adds chaos
   without readable cause, simplify or telegraph harder.
