import { freezeDeep } from './value-guards.mjs';
import { resolveSweptCircleMotion } from './collision.mjs';
import { automaticDodgeIntent, firstUnsafeDodgeSample } from './automatic-actions.mjs';

// Design package S1.1 / 7.7 (owner decision 20). Which dodge, if any, starts
// on this tick. A desktop keyboard dodges manually on its dodge key (default
// Left Shift) and the automatic dodge is off while it is the active device;
// touch and gamepad keep the automatic dodge and have no dodge binding. Both
// read the tick's input from the deterministic input stream (`manualDodge`
// and the `dash` edge) and share one dash state, so the 600/480/360 cooldown
// and the eight i-frame ticks are identical.
//
// Simulation only: no camera, wall clock, random draws or animation state.

export const DODGE_SAMPLE_STEP = 4;
export const MANUAL_DODGE_MIN_DISTANCE = 48;
const EPSILON = 1e-9;

function unit(vector) {
  const x = Number(vector?.x ?? 0);
  const y = Number(vector?.y ?? 0);
  const length = Math.hypot(x, y);
  // `|| 0` folds -0 (away from an axis-aligned aim) into 0.
  return Number.isFinite(length) && length > EPSILON ? { x: x / length || 0, y: y / length || 0 } : null;
}

// The move input, else the last non-zero move, else directly away from the
// aim. A dodge never goes along the aim on its own.
export function manualDodgeDirection({ move, lastMove = null, aim = null } = {}) {
  const direction = unit(move) ?? unit(lastMove) ?? unit(aim ? { x: -aim.x, y: -aim.y } : null);
  return direction ? Object.freeze(direction) : null;
}

// Swept traversal plus the automatic dodge's footprint rule. The dodge is
// truncated at the last safe 4-unit sample; under 48 safe units it is refused.
export function planManualDodge({ actor, direction, state, body, bounds = null, blockers = [], queryGround }) {
  const start = { x: actor.x, y: actor.y, z: actor.groundZ };
  const sweep = resolveSweptCircleMotion({
    body,
    start,
    delta: { x: direction.x * state.distance, y: direction.y * state.distance },
    blockers,
    bounds,
    stopOnFirstContact: true,
  });
  const swept = sweep.depenetrations.length > 0
    ? 0
    : Math.max(0, (sweep.position.x - start.x) * direction.x + (sweep.position.y - start.y) * direction.y);
  const unsafe = firstUnsafeDodgeSample({
    start, direction, distance: state.distance, radius: body.radius, groundZ: actor.groundZ, queryGround,
  });
  const footprint = unsafe === null ? state.distance : unsafe - DODGE_SAMPLE_STEP;
  const reach = Math.min(state.distance, swept, footprint);
  const distance = Math.max(0, Math.floor((reach + EPSILON) / DODGE_SAMPLE_STEP) * DODGE_SAMPLE_STEP);
  return freezeDeep(distance >= MANUAL_DODGE_MIN_DISTANCE ? { allowed: true, distance } : { allowed: false, distance });
}

// Returns null (no dodge), { mode: 'manual' | 'automatic', direction,
// distance } to start one, or { mode: 'manual', blocked: true, ... } for a
// refused press: no cooldown is spent and the runtime flashes "blocked".
export function resolveDodgeIntent({
  tick,
  input,
  actor,
  state,
  body,
  bounds = null,
  blockers = [],
  queryGround,
  enemies = [],
  lastMove = null,
  aim = null,
}) {
  if (input?.manualDodge === true) {
    if (input.dash !== true || state.active || tick < state.cooldownReadyTick) return null;
    const direction = manualDodgeDirection({ move: input.move, lastMove, aim });
    if (!direction) return null;
    const plan = planManualDodge({ actor, direction, state, body, bounds, blockers, queryGround });
    return freezeDeep(plan.allowed
      ? { mode: 'manual', direction, distance: plan.distance }
      : { mode: 'manual', blocked: true, direction, distance: plan.distance });
  }
  const direction = automaticDodgeIntent({ tick, actor, move: input.move, state, body, bounds, blockers, queryGround, enemies });
  return direction ? freezeDeep({ mode: 'automatic', direction: { ...direction }, distance: state.distance }) : null;
}
