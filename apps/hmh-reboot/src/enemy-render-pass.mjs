/**
 * Projection-only enemy body pass (perf step: render-alloc).
 *
 * renderWorld used to run this loop inline over the live crowd every frame:
 * choose which visible bodies animate, pose and place every visible body, lay
 * its contact shadow, elite ring and hit reaction, collect its health pip and
 * draw attack tells. The 1.8.1 loop built a candidate object per enemy,
 * projected every enemy twice through a full `{ ...enemy }` copy, sorted every
 * visible body to fill the animation budget, resolved the same visual state up
 * to three times, re-hashed each id twice and pushed a pip object per body.
 *
 * This pass does the same work into scratch buffers that only ever grow, keeps
 * the budget winners in a bounded max-heap (O(n log cap), no sort) and caches
 * each body's id hashes on its display. Every call it makes is injected, so the
 * chunk imports nothing and stays out of the initial JS.
 *
 * It reads simulation state and writes only display objects, pools and
 * graphics layers. tests/hmh-enemy-render-pass.test.mjs replays seeded crowds
 * through this pass and a verbatim copy of the 1.8.1 loop and requires the same
 * calls, in the same order, with the same arguments, on every frame.
 */

// Animation budget order, identical to selectAnimatedEnemyIds
// (runtime-performance.mjs): attack warnings, then hit/death, then a fresh
// spawn, then elites, then everyone else.
export function animationPriority(state, spawnCue, elite) {
  if (state === 'tell' || state === 'attack') return 0;
  if (state === 'hit' || state === 'death') return 1;
  if (spawnCue === true) return 2;
  if (elite === true) return 3;
  return 4;
}

/**
 * Marks `selected[row] = 1` for exactly the rows whose ids
 * selectAnimatedEnemyIds would return for the same entries: hidden rows never
 * compete, and the `cap` smallest by (priority, distance, id, row) win. The
 * heap holds the current winners with the last of them at the root, so a new
 * row either loses to the root or replaces it. Returns the number selected.
 */
export function markAnimatedRows(count, enemies, visible, priority, distance, cap, heap, selected) {
  if (!Number.isInteger(cap) || cap < 0) throw new TypeError('animation cap must be a non-negative integer');
  // > 0 when row a comes after row b in selection order.
  const after = (a, b) => {
    const left = enemies[a].id;
    const right = enemies[b].id;
    return priority[a] - priority[b] || distance[a] - distance[b] || (left < right ? -1 : left > right ? 1 : a - b);
  };
  let size = 0;
  for (let row = 0; row < count; row += 1) {
    selected[row] = 0;
    const id = enemies[row].id;
    if (visible[row] !== 1 || typeof id !== 'string' || id.length === 0) continue;
    if (!Number.isFinite(distance[row]) || distance[row] < 0) throw new TypeError(`${id}.distance must be non-negative and finite`);
    let at;
    if (size < cap) {
      at = size;
      size += 1;
      while (at > 0) {
        const parent = (at - 1) >> 1;
        if (after(heap[parent], row) > 0) break;
        heap[at] = heap[parent];
        at = parent;
      }
    } else if (size > 0 && after(row, heap[0]) < 0) {
      at = 0;
      for (;;) {
        let child = at * 2 + 1;
        if (child >= size) break;
        if (child + 1 < size && after(heap[child + 1], heap[child]) > 0) child += 1;
        if (after(heap[child], row) < 0) break;
        heap[at] = heap[child];
        at = child;
      }
    } else continue;
    heap[at] = row;
  }
  for (let index = 0; index < size; index += 1) selected[heap[index]] = 1;
  return size;
}

export function createEnemyRenderPass({
  markers,
  facing,
  hitFeedbackById,
  archetypes,
  enemyTelegraphs,
  worldToScreenInto,
  isScreenPointVisible,
  resolveEnemyRuntimeVisualState,
  selectEnemyRosterPose,
  creatureAnimationTick,
  creatureIdPhase,
  isEliteEnemyProjection,
  resolveEnemyVisualDirection,
  prepareWorldDesignEnemyPose,
  worldDepthKey,
  contactShadowFootY,
  drawEliteGroundRing,
  placeWeaponGlow,
  projectGasBomberCanister,
}) {
  // Row scratch, indexed by the enemy's position in this frame's population.
  let capacity = 0;
  let screenX; let screenY; let distance; let visible; let priority; let selected; let heap;
  const states = [];
  // Health pips collected by render() and drawn by drawHealthPips().
  let pipCount = 0;
  let pipX; let pipY; let pipRatio; let pipRadius; let pipColor;
  const grow = (count) => {
    if (count <= capacity) return;
    capacity = Math.max(count, capacity * 2, 64);
    screenX = new Float64Array(capacity); screenY = new Float64Array(capacity); distance = new Float64Array(capacity);
    visible = new Uint8Array(capacity); priority = new Uint8Array(capacity); selected = new Uint8Array(capacity);
    heap = new Int32Array(capacity);
    pipX = new Float64Array(capacity); pipY = new Float64Array(capacity); pipRatio = new Float64Array(capacity);
    pipRadius = new Float64Array(capacity); pipColor = new Float64Array(capacity);
  };
  // Reused per row: the world point projected, its screen point, the pose
  // handed to the display (prepareWorldDesignEnemyPose memoizes a copy) and the
  // shadow placement (the pool reads it and keeps nothing).
  const point = { x: 0, y: 0, z: 0, visualLiftZ: undefined };
  const enemyScreen = { x: 0, y: 0 };
  const targetPoint = { x: 0, y: 0, z: 0, visualLiftZ: undefined };
  const targetScreen = { x: 0, y: 0 };
  const canisterScreen = { x: 0, y: 0 };
  const selection = { state: 'idle', phaseTick: null };
  const pose = { state: 'idle', tick: 0, direction: 0, elite: false, phaseTick: null };
  const shadow = { x: 0, y: 0, footprintPx: 0 };
  // A display serves one enemy id at a time (the pool hands it to a new id on
  // reuse), so its id hashes are cached on it and recomputed on a new id.
  const remember = (marker, id) => {
    if (marker.renderPassId === id) return;
    marker.renderPassId = id;
    marker.renderPassElite = isEliteEnemyProjection(id);
    marker.renderPassPhase = creatureIdPhase(id);
  };

  /** One frame. Returns how many visible bodies animated. */
  const render = ({
    enemies, camera, view, tick, heroScreen, cullMargin, animationBudget, simulationActive,
    contactShadowPool, hitFeedback, particleScale, reduceMotion, reduceFlash, dataset = null,
  }) => {
    const count = enemies.length;
    grow(count);
    for (let row = 0; row < count; row += 1) {
      const enemy = enemies[row];
      point.x = enemy.x;
      point.y = enemy.y;
      point.z = enemy.groundZ ?? 0;
      point.visualLiftZ = enemy.visualLiftZ;
      worldToScreenInto(enemyScreen, point, camera, view);
      screenX[row] = enemyScreen.x;
      screenY[row] = enemyScreen.y;
      const state = resolveEnemyRuntimeVisualState(enemy, tick);
      states[row] = state;
      visible[row] = enemy.active && isScreenPointVisible(enemyScreen, view, cullMargin) ? 1 : 0;
      distance[row] = Math.hypot(enemyScreen.x - heroScreen.x, enemyScreen.y - heroScreen.y);
      const marker = markers.get(enemy.id);
      if (marker) remember(marker, enemy.id);
      priority[row] = animationPriority(
        state,
        Number.isInteger(enemy.spawnedTick) && tick - enemy.spawnedTick <= 30,
        marker ? marker.renderPassElite : isEliteEnemyProjection(enemy.id),
      );
    }
    markAnimatedRows(count, enemies, visible, priority, distance, animationBudget, heap, selected);

    let animatedEnemyCount = 0;
    pipCount = 0;
    for (let row = 0; row < count; row += 1) {
      const enemy = enemies[row];
      const enemyMarker = markers.get(enemy.id);
      if (!enemyMarker) continue;
      if (!enemy.active) {
        enemyMarker.visible = false;
        facing.delete(enemy.id);
        continue;
      }
      const archetype = archetypes[enemy.archetypeId];
      enemyScreen.x = screenX[row];
      enemyScreen.y = screenY[row];
      const markerVisible = visible[row] === 1;
      enemyMarker.visible = markerVisible;
      if (markerVisible) {
        const animate = selected[row] === 1;
        if (animate) animatedEnemyCount += 1;
        let facingState = facing.get(enemy.id);
        if (!facingState) facing.set(enemy.id, facingState = { direction: 0 });
        const enemyDirection = resolveEnemyVisualDirection(facingState, enemy.velocity);
        selectEnemyRosterPose(selection, enemy, tick, states[row]);
        // Roster bodies follow the simulation's tell / strike / recovery
        // windows (Cycle 074); the vector fallback keeps the six-state map.
        pose.state = enemyMarker.phaseRelativePoses ? selection.state : states[row];
        pose.tick = creatureAnimationTick(enemy.id, tick, selection.state, (enemy.hitUntilTick ?? 6) - 6, enemyMarker.renderPassPhase);
        pose.direction = enemyDirection;
        pose.elite = enemyMarker.renderPassElite;
        pose.phaseTick = enemyMarker.phaseRelativePoses ? selection.phaseTick : null;
        const enemyPose = prepareWorldDesignEnemyPose(enemyMarker, animate, pose);
        enemyMarker.position.set(enemyScreen.x, enemyScreen.y);
        enemyMarker.scale.set((enemyMarker.rosterScale ?? 1) * camera.zoom);
        enemyMarker.rotation = 0;
        if (dataset && enemy === enemies[0]) {
          dataset.targetArtVisible = 'true';
          dataset.targetArtFrameId = enemyMarker.frameId ?? '';
          dataset.targetArtState = enemyMarker.visualState ?? '';
          dataset.targetArtScreenX = String(enemyMarker.x);
          dataset.targetArtScreenY = String(enemyMarker.y);
          dataset.targetArtScale = String(enemyMarker.scale.y);
        }
        // Hit reaction on the body itself, layered over whatever pose the
        // precedence chose, so a hit inside a tell or strike still lands
        // visibly. The tint hands back to the display's own base tint when
        // there is nothing to show.
        const hit = hitFeedback && hitFeedbackById.get(enemy.id);
        const hitAge = hit ? tick - hit.tick : 6;
        const reaction = hitAge < 6 ? hitFeedback.resolveEnemyHitReaction({
          ...hit,
          age: hitAge,
          zoom: camera.zoom,
          particleScale,
          reduceMotion,
          reduceFlash,
          seed: `${enemy.id}:${hit.tick}`,
        }) : null;
        if (reaction) {
          enemyMarker.position.set(enemyScreen.x + reaction.offsetX, enemyScreen.y + reaction.offsetY);
          enemyMarker.scale.x *= reaction.squashX;
          enemyMarker.scale.y *= reaction.squashY;
          // Shards sit at chest height; the impact burst already owns the
          // hit point itself, so no second ring is drawn here.
          for (const shard of reaction.shards) placeWeaponGlow(enemyScreen.x + shard.dx, enemyScreen.y - 24 * camera.zoom + shard.dy, shard.radius, shard.color, shard.alpha);
        }
        enemyMarker.setTint(reaction?.tint ?? null);
        // Health is shown on a pip below the body, never through alpha, which
        // made the highest-priority target the hardest one to see.
        enemyMarker.alpha = 1;
        // Depth: an enemy standing further south must draw in front.
        enemyMarker.zIndex = worldDepthKey(enemy.y);
        // Ground contact, on the sprite's foot line rather than its pivot.
        // Placed only for drawn bodies, so the shadow count can never exceed
        // the bodies actually drawn.
        const footY = enemyMarker.contactShadowFootprint || enemyMarker.eliteProjection
          ? contactShadowFootY(enemyMarker, enemyPose, enemyScreen.y, camera.zoom)
          : 0;
        if (enemyMarker.contactShadowFootprint && contactShadowPool) {
          shadow.x = enemyScreen.x;
          shadow.y = footY;
          shadow.footprintPx = enemyMarker.contactShadowFootprint * camera.zoom;
          contactShadowPool.place(shadow);
        }
        if (enemyMarker.eliteProjection) drawEliteGroundRing(enemyScreen.x, footY, archetype.radius * camera.zoom, tick);
        const healthRatio = Math.max(0, Math.min(1, enemy.health / enemy.maxHealth));
        const pipTint = archetype.visual.color;
        // A full-health pip draws nothing, so it is not kept.
        if (!(healthRatio >= 1)) {
          pipX[pipCount] = enemyScreen.x;
          pipY[pipCount] = enemyScreen.y;
          pipRatio[pipCount] = healthRatio;
          pipRadius[pipCount] = enemy.radius;
          pipColor[pipCount] = pipTint;
          pipCount += 1;
        }
      }
      if (enemy.attackPhase !== 'tell' || !enemy.telegraphTarget || !simulationActive) continue;
      targetPoint.x = enemy.telegraphTarget.x;
      targetPoint.y = enemy.telegraphTarget.y;
      targetPoint.z = enemy.telegraphTarget.groundZ;
      targetPoint.visualLiftZ = enemy.telegraphTarget.visualLiftZ;
      worldToScreenInto(targetScreen, targetPoint, camera, view);
      const tellRatio = Math.max(0, Math.min(1, (enemy.attackPhaseUntilTick - tick) / archetype.attack.tellTicks));
      const alpha = 0.38 + (1 - tellRatio) * 0.5;
      // Several archetype tell colours sit within a few points of their own
      // district's ground palette (gas-bomber orange on rugpull-ravine, boss
      // red on liquidation-yard). A dark contour under every stroke
      // guarantees the tell separates from whatever it is drawn over.
      const CONTOUR = { color: 0x080d12, alpha: alpha * 0.72 };
      if (archetype.attack.tokenFamily === 'area') {
        enemyTelegraphs.circle(targetScreen.x, targetScreen.y, 96 * camera.zoom)
          .fill({ color: archetype.visual.color, alpha: 0.08 })
          .stroke({ ...CONTOUR, width: 10 })
          .stroke({ color: archetype.visual.color, width: 4, alpha });
        const canister = projectGasBomberCanister({ enemy, tick });
        if (canister) {
          worldToScreenInto(canisterScreen, canister, camera, view);
          const stripeX = Math.cos(canister.rotation) * 6 * camera.zoom;
          const stripeY = Math.sin(canister.rotation) * 6 * camera.zoom;
          enemyTelegraphs.circle(canisterScreen.x, canisterScreen.y, 8 * camera.zoom)
            .fill({ color: archetype.visual.color, alpha: 0.98 })
            .stroke({ color: 0x080d12, width: 3 * camera.zoom, alpha: 1 });
          enemyTelegraphs.moveTo(canisterScreen.x - stripeX, canisterScreen.y - stripeY)
            .lineTo(canisterScreen.x + stripeX, canisterScreen.y + stripeY)
            .stroke({ color: 0xfff4c7, width: 2 * camera.zoom, alpha: 0.92 });
          if (dataset) dataset.gasCanisterProgress = canister.progress.toFixed(3);
        }
      } else if (archetype.attack.tokenFamily === 'support') {
        enemyTelegraphs.circle(targetScreen.x, targetScreen.y, 140 * camera.zoom)
          .stroke({ ...CONTOUR, width: 11 })
          .stroke({ color: archetype.visual.color, width: 5, alpha });
      } else if (archetype.attack.tokenFamily === 'melee') {
        enemyTelegraphs.circle(enemyScreen.x, enemyScreen.y, archetype.attack.range * camera.zoom)
          .stroke({ ...CONTOUR, width: 10 })
          .stroke({ color: archetype.visual.color, width: 4, alpha });
        enemyTelegraphs.moveTo(enemyScreen.x, enemyScreen.y).lineTo(targetScreen.x, targetScreen.y)
          .stroke({ ...CONTOUR, width: 9 })
          .stroke({ color: archetype.visual.color, width: 3, alpha });
      } else {
        enemyTelegraphs.moveTo(enemyScreen.x, enemyScreen.y).lineTo(targetScreen.x, targetScreen.y)
          .stroke({ color: archetype.visual.color, width: 18 * camera.zoom, alpha: alpha * 0.22, cap: 'round' })
          .stroke({ ...CONTOUR, width: 9, cap: 'round' })
          .stroke({ color: archetype.visual.color, width: 3, alpha, cap: 'round' });
      }
    }
    return animatedEnemyCount;
  };

  // Screen-space health pips for the bodies the last render() drew.
  // overlayVisuals sits on the stage and is not shake-offset, so the caller
  // passes the world offset or pips detach from their bodies mid-shake.
  const drawHealthPips = (graphics, zoom, offsetX, offsetY) => {
    for (let index = 0; index < pipCount; index += 1) {
      const ratio = pipRatio[index];
      const radius = pipRadius[index];
      const width = Math.max(18, radius * 1.9) * zoom;
      const x = pipX[index] + offsetX;
      const y = pipY[index] + offsetY + Math.max(14, radius * 0.9) * zoom;
      graphics.roundRect(x - width / 2, y, width, 4, 2).fill({ color: 0x0a0f14, alpha: 0.72 });
      graphics.roundRect(x - width / 2, y, width * ratio, 4, 2)
        .fill({ color: ratio > 0.5 ? 0x8ef5a8 : ratio > 0.25 ? 0xffd166 : 0xff5c7a, alpha: 0.96 });
    }
  };

  // Facing memory is written for every drawn body and read back when a body
  // becomes a corpse. Defeated enemies are retired in the tick that kills
  // them, so the render never sees them inactive and never deleted their
  // entry: one leaked per enemy ever drawn. After a marker sync the live
  // markers are exactly the live population, so anything else is gone for good.
  const pruneFacing = () => {
    for (const id of facing.keys()) if (!markers.has(id)) facing.delete(id);
  };

  return Object.freeze({ render, drawHealthPips, pruneFacing, get pipCount() { return pipCount; } });
}
