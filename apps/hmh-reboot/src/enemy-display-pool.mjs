/**
 * Projection-only pool for enemy and corpse displays.
 *
 * Every spawn and kill used to destroy and rebuild all live enemy displays
 * (containers, sprites, crown graphics and their frame textures), and every
 * corpse was built per kill and destroyed on expiry. Displays now live in
 * per-key pools and are reset to their freshly built state on reuse, and live
 * markers are synced incrementally by enemy id.
 *
 * What reaches the screen is unchanged. A kept marker drops its zIndex and
 * pose memo exactly as a new display would have neither, and every live
 * marker is re-attached to the depth layer in population order, so the
 * layer's stable depth sort resolves exact ties as the full rebuild did.
 * Nothing here reads or writes simulation state.
 */

// The pose memo prepareWorldDesignEnemyPose (world-design-life.mjs) keeps on a
// marker. A newly built display has none, so its next visible frame always
// applies the pose. Kept local: importing that module here would split it
// into extra initial chunks now that this pool loads lazily.
const forgetPose = (display) => {
  display.worldDesignPoseInput = display.worldDesignLastPose = undefined;
};

// Idle displays kept per key. A crowd tops out near 128 bodies plus 24
// corpses spread across the archetypes, so this never throttles reuse.
export const ENEMY_DISPLAY_IDLE_CAP = 96;

// keyFor(archetypeId, elite) must change exactly when create() would build a
// different kind of display (the vector fallback bakes its elite default, the
// roster display does not), and goes stale when a roster atlas arrives. An
// enemy id never changes archetype or elite flag, so a live marker needs a
// new display exactly when its own key has gone stale.
export function createEnemyDisplayPool({ create, keyFor, eliteOf, markers, parent, depthLayer, idleCap = ENEMY_DISPLAY_IDLE_CAP }) {
  const idle = new Map();
  const meta = new WeakMap();
  const stats = { created: 0, reused: 0, disposed: 0 };
  const stale = (display) => {
    const row = meta.get(display);
    return !row || keyFor(row.archetypeId, row.elite) !== row.key;
  };
  const dispose = (display) => {
    stats.disposed++;
    display.destroy({ children: true });
  };
  const acquire = (archetypeId, elite) => {
    const key = keyFor(archetypeId, elite);
    const display = idle.get(key)?.pop();
    if (!display) {
      const built = create(archetypeId, elite);
      meta.set(built, { key, archetypeId, elite, scale: built.scale.x });
      stats.created++;
      return built;
    }
    // Everything create() hands back: origin, build scale, upright, opaque,
    // shown, unsorted, no pose memo, idle pose with this body's elite flag.
    display.position.set(0, 0);
    display.scale.set(meta.get(display).scale);
    display.rotation = 0;
    display.alpha = 1;
    display.visible = true;
    display.zIndex = 0;
    forgetPose(display);
    display.applyPose({ state: 'idle', tick: 0, direction: 0, elite });
    stats.reused++;
    return display;
  };
  // Leaving the parent also detaches the display from the depth layer.
  const release = (display) => {
    if (display.destroyed) return;
    display.removeFromParent();
    if (stale(display)) return dispose(display);
    const { key } = meta.get(display);
    let bucket = idle.get(key);
    if (!bucket) idle.set(key, bucket = []);
    if (bucket.length < idleCap) bucket.push(display);
    else dispose(display);
  };
  // rebuild: a roster atlas arrived, so every live body is rebuilt exactly as
  // the old full reset did, and idle displays of a now-stale kind are freed.
  const sync = (enemies, rebuild = false) => {
    const live = new Set();
    for (const enemy of enemies) live.add(enemy.id);
    for (const [id, display] of markers) {
      if (rebuild || !live.has(id) || stale(display)) {
        release(display);
        markers.delete(id);
      } else depthLayer.detach(display);
    }
    if (rebuild) {
      for (const [key, bucket] of idle) {
        if (stale(bucket[0])) {
          bucket.forEach(dispose);
          idle.delete(key);
        }
      }
    }
    for (const enemy of enemies) {
      let display = markers.get(enemy.id);
      if (display) {
        display.zIndex = 0;
        forgetPose(display);
      } else {
        markers.set(enemy.id, display = parent.addChild(acquire(enemy.archetypeId, eliteOf(enemy.id))));
      }
      depthLayer.attach(display);
    }
  };
  return { acquire, release, sync, stats, idle };
}
