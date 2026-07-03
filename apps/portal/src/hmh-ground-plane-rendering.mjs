// World tile center projection -> screen pixels -> ground texture lattice.
//
// `isoToScreen()` in main.js projects a world tile center to the center of an
// isometric diamond. The ground texture should not anchor to the tile center;
// it anchors to the diamond's lower/front edge so terrain patterns line up with
// the visible floor lattice. Keep the origin anchor and every projected tile on
// this same rounded lattice to avoid sub-pixel ground sliding.
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
