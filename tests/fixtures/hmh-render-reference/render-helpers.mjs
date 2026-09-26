// Verbatim copies of the 1.8.1 release (60ea173a) render-path helpers that the
// render-alloc perf step rewrote, kept as the reference for
// tests/hmh-render-alloc.test.mjs. Imports point at the live modules for the
// functions that step left unchanged. Do not edit.
import { resolveEnemyAttackPhaseTick, resolveEnemyRuntimeVisualState } from '../../../apps/hmh-reboot/src/enemy-production-art.mjs';
import { WORLD_COORDINATES } from '../../../apps/hmh-reboot/src/world-space.mjs';

// ---- apps/hmh-reboot/src/value-guards.mjs ----
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

// ---- apps/hmh-reboot/src/world-space.mjs:23-45, 267-277 ----
function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

function finiteViewport(viewport) {
  return {
    width: positive(viewport?.width, 'viewport.width'),
    height: positive(viewport?.height, 'viewport.height'),
  };
}

export function worldToScreen(point, camera, viewport) {
  const view = finiteViewport(viewport);
  const x = finite(point?.x, 'world.x');
  const y = finite(point?.y, 'world.y');
  const z = finite(point?.z ?? 0, 'world.z');
  const visualLiftZ = finite(point?.visualLiftZ ?? 0, 'world.visualLiftZ');
  return {
    x: (x - camera.x) * camera.zoom + view.width / 2 + camera.shakeX,
    y: (y - camera.y - (z + visualLiftZ - (camera.groundZ ?? 0)) * WORLD_COORDINATES.heightToScreenY) * camera.zoom + view.height / 2 + camera.shakeY,
  };
}

// ---- apps/hmh-reboot/src/runtime-performance.mjs:1-9, 68-78 ----
function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be positive and finite`);
  return value;
}

function nonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be non-negative and finite`);
  return value;
}

export function isScreenPointVisible(point, view, margin = 0) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const width = Number(view?.width);
  const height = Number(view?.height);
  if (![x, y, width, height].every(Number.isFinite)) throw new TypeError('screen point and view must be finite');
  positiveFinite(width, 'view.width');
  positiveFinite(height, 'view.height');
  nonNegativeFinite(margin, 'margin');
  return x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
}

// ---- apps/hmh-reboot/src/world-design-life.mjs:26-37 ----
export function prepareWorldDesignEnemyPose(marker, animate, pose) {
  const previous=marker.worldDesignPoseInput;
  // Budgeting freezes in-between frames, never attack warnings or a new pose.
  const changed=!previous || ['state','direction','phase','elite'].some(key=>pose[key]!==previous[key])
    || (Number.isFinite(pose.phaseTick)&&Number.isFinite(previous.phaseTick)&&pose.phaseTick<previous.phaseTick);
  if(animate || !marker.worldDesignLastPose || changed) {
    marker.worldDesignLastPose=marker.applyPose(pose);
    marker.worldDesignPoseInput={...pose};
  }
  marker.worldDesignPoseInput.phaseTick=pose.phaseTick;
  return marker.worldDesignLastPose;
}

// ---- apps/hmh-reboot/src/enemy-production-art.mjs:152-161 ----
export function resolveEnemyRosterPoseSelection(enemy, tick) {
  const state = resolveEnemyRuntimeVisualState(enemy, tick);
  if (state === 'tell' || state === 'attack') {
    return Object.freeze({ state, phaseTick: resolveEnemyAttackPhaseTick(enemy, tick) });
  }
  if (enemy.attackPhase === 'recovery' && state !== 'death' && state !== 'hit') {
    return Object.freeze({ state: 'attack', phaseTick: resolveEnemyAttackPhaseTick(enemy, tick) });
  }
  return Object.freeze({ state, phaseTick: null });
}
