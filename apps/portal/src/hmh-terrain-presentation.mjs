export const TERRAIN_PRESENTATION_OVERLAY_ORDER = Object.freeze([
  'terrain-shadow',
  'water-flow',
  'shoreline-foam',
  'bridge-contact-shadow',
  'bridge-deck-light',
  'elevation-rim-light',
  'road-dust',
]);

const ORDER_INDEX = new Map(TERRAIN_PRESENTATION_OVERLAY_ORDER.map((id, index) => [id, index]));

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function roleKind(cell = {}) {
  if (cell.isBridge || cell.terrainRole === 'bridge') return 'bridge';
  if (cell.isWater || cell.terrainRole === 'water') return 'water';
  return cell.terrainRole ?? cell.role ?? 'dirt';
}

function elevationPxForBand(band) {
  if (band === 'low') return 5;
  if (band === 'high') return -7;
  return 0;
}

function overlay(id, fields = {}) {
  return Object.freeze({
    id,
    alpha: clamp01(fields.alpha ?? 0),
    color: fields.color ?? 'rgba(255,255,255,1)',
    motionPhase: Number.isFinite(Number(fields.motionPhase)) ? Number(fields.motionPhase) : 0,
    blurPx: Math.max(0, Number(fields.blurPx) || 0),
    offsetPx: Object.freeze({
      x: Number(fields.offsetPx?.x) || 0,
      y: Number(fields.offsetPx?.y) || 0,
    }),
    blendMode: fields.blendMode ?? 'source-over',
  });
}

function hasVfx(cell, id) {
  return Array.isArray(cell?.vfx) && cell.vfx.includes(id);
}

export function buildTerrainPresentationForCell(cell = {}, { frame = 0 } = {}) {
  const kind = roleKind(cell);
  const elevationBand = cell?.elevation?.band ?? 'mid';
  const frameNum = Number(frame) || 0;
  const motionPhase = (Math.sin(frameNum * 0.06 + (Number(cell.x) || 0) * 0.31 + (Number(cell.y) || 0) * 0.17) + 1) / 2;
  const overlays = [];

  if (elevationBand === 'high' || hasVfx(cell, 'terrain-cast-shadow')) {
    overlays.push(overlay('terrain-shadow', {
      alpha: elevationBand === 'high' ? 0.24 : 0.16,
      color: 'rgba(7,5,4,1)',
      blurPx: 3,
      offsetPx: { x: 4, y: 8 },
    }));
  }
  if (kind === 'water' || hasVfx(cell, 'water-shimmer')) {
    overlays.push(overlay('water-flow', {
      alpha: 0.07 + motionPhase * 0.045,
      color: 'rgba(95,226,255,1)',
      motionPhase,
      blendMode: 'screen',
    }));
  }
  if (hasVfx(cell, 'shoreline-foam')) {
    overlays.push(overlay('shoreline-foam', {
      alpha: 0.12 + motionPhase * 0.08,
      color: 'rgba(230,252,255,1)',
      motionPhase,
      blendMode: 'screen',
    }));
  }
  if (kind === 'bridge' || hasVfx(cell, 'bridge-shadow')) {
    overlays.push(overlay('bridge-contact-shadow', {
      alpha: 0.28,
      color: 'rgba(8,5,3,1)',
      blurPx: 2,
      offsetPx: { x: 0, y: 9 },
    }));
    overlays.push(overlay('bridge-deck-light', {
      alpha: 0.18,
      color: 'rgba(172,118,58,1)',
      blendMode: 'multiply',
    }));
  }
  if (elevationBand === 'high') {
    overlays.push(overlay('elevation-rim-light', {
      alpha: 0.16,
      color: 'rgba(255,214,118,1)',
      offsetPx: { x: -2, y: -4 },
      blendMode: 'screen',
    }));
  }
  if (kind === 'road' || hasVfx(cell, 'road-dust')) {
    overlays.push(overlay('road-dust', {
      alpha: 0.055 + motionPhase * 0.02,
      color: 'rgba(218,169,94,1)',
      motionPhase,
      blendMode: 'screen',
    }));
  }

  overlays.sort((a, b) => (ORDER_INDEX.get(a.id) ?? 999) - (ORDER_INDEX.get(b.id) ?? 999));
  return Object.freeze({
    kind,
    elevationBand,
    elevationPx: elevationPxForBand(elevationBand),
    overlays: Object.freeze(overlays),
  });
}

export function summarizeTerrainPresentation(cells = [], options = {}) {
  const presentations = cells.map((cell) => buildTerrainPresentationForCell(cell, options));
  const overlayIds = [...new Set(presentations.flatMap((entry) => entry.overlays.map((overlayEntry) => overlayEntry.id)))].sort(
    (a, b) => (ORDER_INDEX.get(a) ?? 999) - (ORDER_INDEX.get(b) ?? 999),
  );
  return Object.freeze({
    cellCount: cells.length,
    overlayIds: Object.freeze(overlayIds),
    hasWaterFlow: overlayIds.includes('water-flow'),
    hasBridgeLighting: overlayIds.includes('bridge-contact-shadow') && overlayIds.includes('bridge-deck-light'),
    hasElevationLighting: overlayIds.includes('elevation-rim-light'),
    hasCastShadows: overlayIds.includes('terrain-shadow') || overlayIds.includes('bridge-contact-shadow'),
  });
}
