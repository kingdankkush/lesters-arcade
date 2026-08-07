import { freezeDeep } from './value-guards.mjs';
export const COMPACT_LANDSCAPE_MAX_HEIGHT = 520;
export const COMPACT_LANDSCAPE_MINIMAP_WIDTH = 140;
// The minimap's distance from the viewport edge, and the padding of its frame.
// Exported so touch controls can derive the same exclusion zone rather than
// re-guessing it with a margin that silently drifts out of agreement.
export const MINIMAP_EDGE_GUTTER = 16;
export const MINIMAP_OUTER_PADDING = 6;
export const MINIMAP_MAX_WIDTH = 220;
export const COMPACT_PORTRAIT_MINIMAP_WIDTH = 120;
export const MINIMAP_WIDTH_FRACTION = 0.34;

export function minimapWidthFor({ width, height } = {}) {
  const viewportWidth = finite(width, 'viewport width');
  const viewportHeight = finite(height, 'viewport height');
  // Must mirror computeHudMinimapLayout exactly, including the compact-portrait
  // branch — an earlier version omitted it and the two silently disagreed.
  const compactPortrait = viewportWidth < 600 && viewportHeight >= viewportWidth;
  const compactLandscape = isCompactLandscape({ width: viewportWidth, height: viewportHeight });
  const widthCap = compactLandscape
    ? COMPACT_LANDSCAPE_MINIMAP_WIDTH
    : compactPortrait
      ? COMPACT_PORTRAIT_MINIMAP_WIDTH
      : MINIMAP_MAX_WIDTH;
  return Math.min(widthCap, viewportWidth * MINIMAP_WIDTH_FRACTION);
}

export function minimapExclusionLeft({ width, height } = {}) {
  return finite(width, 'viewport width')
    - minimapWidthFor({ width, height })
    - MINIMAP_EDGE_GUTTER
    - MINIMAP_OUTER_PADDING;
}

import { finite } from './value-guards.mjs';


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
      ? COMPACT_PORTRAIT_MINIMAP_WIDTH
      : MINIMAP_MAX_WIDTH;
  const mapWidth = Math.min(widthCap, viewportWidth * MINIMAP_WIDTH_FRACTION);
  const mapHeight = mapWidth * authoredWorldHeight / authoredWorldWidth;
  const originX = viewportWidth - mapWidth - MINIMAP_EDGE_GUTTER;
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
      left: originX - MINIMAP_OUTER_PADDING,
      top: originY - MINIMAP_OUTER_PADDING,
      right: originX + mapWidth + MINIMAP_OUTER_PADDING,
      bottom: originY + mapHeight + MINIMAP_OUTER_PADDING,
    },
  });
}

export function compactWeaponHudLabel({ weaponId, hudLabel } = {}) {
  if (typeof weaponId !== 'string' || typeof hudLabel !== 'string') throw new TypeError('weaponId and hudLabel are required');
  return weaponId === 'lightning-ledger'
    ? hudLabel.replace('LIGHTNING LEDGER', 'LEDGER').replace('CHANNEL', 'CH')
    : hudLabel;
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
    y: compactLandscape ? 76 : touchLandscape ? 240 : narrow ? 272 : 82,
    fontSize: narrow || touchLandscape ? 12 : 18,
    compact: touchLandscape,
    multiline: narrow && !touchLandscape,
  });
}
