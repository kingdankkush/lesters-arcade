export const ROOT_LOGICAL_HEIGHT = 1000;

export function fitRootToViewport({ widthPx, heightPx }) {
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(heightPx) || heightPx <= 0) throw new TypeError('viewport dimensions must be positive finite numbers');
  const scale = heightPx / ROOT_LOGICAL_HEIGHT;
  return Object.freeze({ scale, logicalHeight: ROOT_LOGICAL_HEIGHT, logicalWidth: widthPx / scale,
    originPx: Object.freeze({ x: widthPx / 2, y: heightPx / 2 }) });
}

export function applyRootFit(root, fit) {
  root.scale.set(fit.scale, fit.scale);
  root.position.set(fit.originPx.x, fit.originPx.y);
  return root;
}

