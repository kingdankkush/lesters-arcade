export const PROP_GROUNDING_POLICY_ID = 'wo64-prop-grounding-front-edge-v1';

export function propGroundContactPoint(projected, { tileHeight = 64, groundYOffset = 0 } = {}) {
  const x = Number(projected?.x ?? 0);
  const y = Number(projected?.y ?? 0);
  return Object.freeze({
    x,
    y: y + tileHeight / 2 + groundYOffset,
  });
}

export function propDrawRectForGroundContact({ projected, drawWidth = 0, drawHeight = 0, tileHeight = 64, groundYOffset = 0 } = {}) {
  const contact = propGroundContactPoint(projected, { tileHeight, groundYOffset });
  const width = Math.max(0, Number(drawWidth) || 0);
  const height = Math.max(0, Number(drawHeight) || 0);
  return Object.freeze({
    x: Math.round(contact.x - width / 2),
    y: Math.round(contact.y - height),
    width: Math.round(width),
    height: Math.round(height),
    bottomY: Math.round(contact.y),
    contact,
  });
}

export function propShadowEllipseForGroundContact({ projected, drawWidth = 0, drawHeight = 0, tileHeight = 64, groundYOffset = 0, alpha = 0.22 } = {}) {
  const contact = propGroundContactPoint(projected, { tileHeight, groundYOffset });
  const width = Math.max(8, Number(drawWidth) || 0);
  const height = Math.max(8, Number(drawHeight) || 0);
  return Object.freeze({
    x: Math.round(contact.x),
    y: Math.round(contact.y + 2),
    radiusX: Math.round(Math.max(10, width * 0.34)),
    radiusY: Math.round(Math.max(4, Math.min(18, height * 0.07))),
    alpha: Math.max(0, Math.min(1, alpha)),
  });
}

export function propFrontEdgeDepth({ projected, footprint = null, radius = 0, drawOrderBias = 0, tileHeight = 64, groundYOffset = 0 } = {}) {
  const contact = propGroundContactPoint(projected, { tileHeight, groundYOffset });
  const footprintDepthTiles = Math.max(
    0.5,
    Number(footprint?.h ?? 0) || Math.max(0.5, Number(radius) * 2 || 0.5),
  );
  return contact.y + footprintDepthTiles * (tileHeight / 4) + (Number(drawOrderBias) || 0);
}
