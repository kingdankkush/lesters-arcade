// Enemy steering for the isometric roguelite (Roadmap Phase 1.4).
//
// PROBLEM THIS SOLVES
// Every enemy previously ran the identical straight-line homing vector at the
// player (dx/dist, dy/dist). With up to ~100 enemies that collapses them into a
// single overlapping blob sitting on the player — the most visible "feels
// broken" issue in actual play. This module adds cheap local SEPARATION steering
// (boids-style repulsion from nearby neighbors) so the swarm spreads into a
// readable crescent instead of stacking on one pixel.
//
// Pure + DOM-free + dependency-free: takes plain positions, returns a normalized
// steering vector. The runtime blends this with the homing direction and then
// runs the result through the same obstacle/water collision resolvers the player
// uses, so enemies also stop clipping through buildings and walking onto water.

/**
 * Compute a separation (repulsion) vector for one agent from its neighbors.
 * Sums inverse-distance push from every neighbor within `radius`, so closer
 * crowders push harder. The result is normalized (length 0..1) and capped, so it
 * blends cleanly with a unit homing vector without producing runaway speeds.
 *
 * @param {{x:number,y:number}} self - the agent's position (map/tile space)
 * @param {Array<{x:number,y:number}>} neighbors - other agents' positions
 * @param {object} [opts]
 * @param {number} [opts.radius=1.2] - neighbor influence radius in tiles
 * @param {number} [opts.selfIndex=-1] - index in `neighbors` to skip (the agent itself)
 * @param {number} [opts.maxNeighbors=12] - cap neighbors considered (perf guard)
 * @returns {{x:number,y:number,count:number}} normalized push vector + neighbor count
 */
export function computeSeparation(self, neighbors, opts = {}) {
  const radius = opts.radius ?? 1.2;
  const selfIndex = opts.selfIndex ?? -1;
  const maxNeighbors = opts.maxNeighbors ?? 12;
  const r2 = radius * radius;
  let px = 0;
  let py = 0;
  let count = 0;
  for (let i = 0; i < neighbors.length; i += 1) {
    if (i === selfIndex) continue;
    const n = neighbors[i];
    const dx = self.x - n.x;
    const dy = self.y - n.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r2) continue;
    if (d2 <= 1e-6) {
      // Exactly overlapping: deterministic tiny offset from index parity so two
      // stacked enemies still split apart instead of pushing by (0,0).
      px += (i % 2 === 0 ? 0.01 : -0.01);
      py += (i % 3 === 0 ? 0.01 : -0.01);
      count += 1;
      if (count >= maxNeighbors) break;
      continue;
    }
    // Inverse-distance weight: closer neighbors push harder (1/d falloff).
    const d = Math.sqrt(d2);
    const w = (radius - d) / radius; // 1 at touching, 0 at the edge
    px += (dx / d) * w;
    py += (dy / d) * w;
    count += 1;
    if (count >= maxNeighbors) break;
  }
  if (count === 0) return { x: 0, y: 0, count: 0 };
  const len = Math.hypot(px, py) || 1;
  return { x: px / len, y: py / len, count };
}

/**
 * Blend a homing direction with a separation vector into a single normalized
 * desired-move direction. `separationWeight` controls how strongly enemies avoid
 * each other vs. press toward the player. The homing vector dominates so the
 * swarm still advances, but spreads laterally.
 *
 * @param {{x:number,y:number}} homing - unit vector toward the target (player)
 * @param {{x:number,y:number}} separation - vector from computeSeparation()
 * @param {number} [separationWeight=0.65]
 * @returns {{x:number,y:number}} normalized blended direction (or homing if degenerate)
 */
export function blendSteering(homing, separation, separationWeight = 0.65) {
  const bx = homing.x + separation.x * separationWeight;
  const by = homing.y + separation.y * separationWeight;
  const len = Math.hypot(bx, by);
  if (len <= 1e-6) return { x: homing.x, y: homing.y };
  return { x: bx / len, y: by / len };
}
