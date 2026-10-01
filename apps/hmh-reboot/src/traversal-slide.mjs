// Ten-area only (2.1): slide along refused ground instead of stopping dead.
//
// resolveSweptTraversalPath refuses a whole step at a deck ledge, a ramp's
// high side or deep water and leaves the body at its last legal sample. A
// diagonal push along such an edge therefore halted the body while the input
// held. When the world opts in, the remaining motion is retried one axis at a
// time from that sample (x, then y), each axis swept through the collision
// solver first, so the body keeps the component that runs along the edge and
// loses only the one that crosses it. The legacy world never calls this:
// main.mjs and stepEnemyPopulation pass `traversalSlide` only for the
// ten-area context, so legacy trajectories are unchanged.
import { resolveSweptTraversalPath } from './elevation.mjs';

const EPSILON = 1e-9;

// `attempt` is the refused resolveSweptTraversalPath result for start -> end.
// `sweep(position, delta)` returns the collision-resolved end of a move (the
// same solver and body the caller used). Returns the slid position, its ground,
// the drop facts, and which axes stayed refused (their velocity is spent).
export function slideRefusedTraversal({ attempt, end, queryGround, sweep = null, maxSampleDistance = 8, transitionOptions = {} }) {
  let position = attempt.position, ground = attempt.ground, dropped = attempt.dropped, dropDeltaZ = attempt.dropDeltaZ;
  const blocked = { x: false, y: false };
  for (const axis of ['x', 'y']) {
    const delta = axis === 'x' ? { x: end.x - position.x, y: 0 } : { x: 0, y: end.y - position.y };
    if (Math.abs(delta[axis]) <= EPSILON) continue;
    const target = sweep ? sweep(position, delta) : { x: position.x + delta.x, y: position.y + delta.y };
    const step = resolveSweptTraversalPath({ start: position, end: target, queryGround, maxSampleDistance, transitionOptions });
    if (!step.allowed) blocked[axis] = true;
    position = step.position; ground = step.ground;
    if (step.dropped) { dropped = true; dropDeltaZ += step.dropDeltaZ; }
  }
  const moved = Math.hypot(position.x - attempt.position.x, position.y - attempt.position.y) > EPSILON;
  return Object.freeze({ position: Object.freeze({ x: position.x, y: position.y }), ground, dropped, dropDeltaZ, blocked: Object.freeze(blocked), moved });
}
