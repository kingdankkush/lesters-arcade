export const COMPACT_LANDSCAPE_MAX_HEIGHT = 520;
export const COMPACT_LANDSCAPE_MINIMAP_WIDTH = 140;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

export function isCompactLandscape({ width, height } = {}) {
  const viewportWidth = finite(width, 'viewport width');
  const viewportHeight = finite(height, 'viewport height');
  return viewportWidth > viewportHeight && viewportHeight <= COMPACT_LANDSCAPE_MAX_HEIGHT;
}

export function computeHudMinimapLayout({ width, height, worldWidth, worldHeight } = {}) {
  const viewportWidth = finite(width, 'viewport width');
  const viewportHeight = finite(height, 'viewport height');
  const authoredWorldWidth = finite(worldWidth, 'world width');
  const authoredWorldHeight = finite(worldHeight, 'world height');
  if (viewportWidth <= 0 || viewportHeight <= 0) throw new TypeError('viewport dimensions must be positive');
  if (authoredWorldWidth <= 0 || authoredWorldHeight <= 0) throw new TypeError('world dimensions must be positive');

  const compactPortrait = viewportWidth < 600 && viewportHeight >= viewportWidth;
  const compactLandscape = isCompactLandscape({ width: viewportWidth, height: viewportHeight });
  const widthCap = compactLandscape
    ? COMPACT_LANDSCAPE_MINIMAP_WIDTH
    : compactPortrait
      ? 120
      : 220;
  const mapWidth = Math.min(widthCap, viewportWidth * 0.34);
  const mapHeight = mapWidth * authoredWorldHeight / authoredWorldWidth;
  const originX = viewportWidth - mapWidth - 16;
  const originY = compactPortrait && viewportHeight >= 700
    ? viewportHeight - mapHeight - 300
    : 16;

  return freezeDeep({
    compactPortrait,
    compactLandscape,
    width: mapWidth,
    height: mapHeight,
    x: originX,
    y: originY,
    outer: {
      left: originX - 6,
      top: originY - 6,
      right: originX + mapWidth + 6,
      bottom: originY + mapHeight + 6,
    },
  });
}

export function computeCombatStatusLayout({ width, height, touchUiEnabled = false } = {}) {
  const viewportWidth = finite(width, 'viewport width');
  const viewportHeight = finite(height, 'viewport height');
  if (viewportWidth <= 0 || viewportHeight <= 0) throw new TypeError('viewport dimensions must be positive');
  const narrow = viewportWidth < 600;
  const touchLandscape = Boolean(touchUiEnabled) && viewportWidth > viewportHeight;
  const compactLandscape = touchLandscape && isCompactLandscape({ width: viewportWidth, height: viewportHeight });
  return freezeDeep({
    x: viewportWidth * 0.5,
    y: compactLandscape ? 76 : touchLandscape ? 240 : narrow ? 202 : 82,
    fontSize: narrow || touchLandscape ? 12 : 18,
    compact: touchLandscape,
    multiline: narrow && !touchLandscape,
  });
}
