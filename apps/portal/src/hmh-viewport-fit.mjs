function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function snapViewportZoom(value, step = 0.25) {
  const safeStep = Math.max(0.01, Number(step) || 0.25);
  return Math.round((Number(value) || 1) / safeStep) * safeStep;
}

export function computeCombatViewportFit({
  cssWidth = 1,
  cssHeight = 1,
  devicePixelRatio = 1,
  maxDevicePixelRatio = 2,
  safeArea = {},
  targetVerticalTiles = 15,
  tileCssHeight = 64,
  minWorldZoom = 0.75,
  maxWorldZoom = 2,
  zoomStep = 0.25,
} = {}) {
  const width = Math.max(1, Number(cssWidth) || 1);
  const height = Math.max(1, Number(cssHeight) || 1);
  const insets = Object.freeze({
    top: Math.max(0, Number(safeArea.top) || 0),
    right: Math.max(0, Number(safeArea.right) || 0),
    bottom: Math.max(0, Number(safeArea.bottom) || 0),
    left: Math.max(0, Number(safeArea.left) || 0),
  });
  const availableWidth = Math.max(1, width - insets.left - insets.right);
  const availableHeight = Math.max(1, height - insets.top - insets.bottom);
  const renderDpr = clamp(Number(devicePixelRatio) || 1, 1, Math.max(1, Number(maxDevicePixelRatio) || 2));
  const rawWorldZoom = availableHeight / (Math.max(1, targetVerticalTiles) * Math.max(1, tileCssHeight));
  const worldZoom = clamp(snapViewportZoom(rawWorldZoom, zoomStep), minWorldZoom, maxWorldZoom);

  return Object.freeze({
    orientation: availableWidth >= availableHeight ? 'landscape' : 'portrait',
    css: Object.freeze({ width, height }),
    availableCss: Object.freeze({ width: availableWidth, height: availableHeight }),
    backingStore: Object.freeze({
      width: Math.max(1, Math.round(width * renderDpr)),
      height: Math.max(1, Math.round(height * renderDpr)),
    }),
    safeArea: insets,
    renderDpr,
    worldZoom,
    targetVerticalTiles,
    pixelArt: Object.freeze({ imageRendering: 'pixelated', zoomStep }),
  });
}

export function browserFullscreenCapability({
  hasRequestFullscreen = false,
  standalone = false,
  isIos = false,
} = {}) {
  if (standalone) return Object.freeze({ mode: 'standalone', canEnter: false, showInstallTip: false });
  if (hasRequestFullscreen) return Object.freeze({ mode: 'browser-api', canEnter: true, showInstallTip: false });
  if (isIos) return Object.freeze({ mode: 'ios-visible-viewport', canEnter: false, showInstallTip: true });
  return Object.freeze({ mode: 'expanded-viewport', canEnter: false, showInstallTip: false });
}
