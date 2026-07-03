export const GROUND_PLANE_Y_OFFSET = 64;

function roundScreenCoord(value = 0) {
  const n = Number(value);
  return Math.round(Number.isFinite(n) ? n : 0);
}

export function groundPatternAnchorForOrigin(origin = {}) {
  return Object.freeze({
    x: roundScreenCoord(origin.x),
    y: roundScreenCoord((origin.y ?? 0) + GROUND_PLANE_Y_OFFSET),
  });
}

export function groundTileLatticePointForProjection(projected = {}) {
  return Object.freeze({
    x: roundScreenCoord(projected.x),
    y: roundScreenCoord(projected.y) + GROUND_PLANE_Y_OFFSET,
  });
}
