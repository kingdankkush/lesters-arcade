export const PROP_GROUNDING_POLICY_ID = 'wo64-prop-grounding-front-edge-v1';
export const DEFAULT_ISO_TILE_HEIGHT = 64;
export const PROP_CONTACT_SHADOW_ALPHA = 0.22;
export const PROP_CONTACT_SHADOW_SCREEN_Y_OFFSET = 2;
export const PROP_CONTACT_SHADOW_WIDTH_RATIO = 0.34;
export const PROP_CONTACT_SHADOW_HEIGHT_RATIO = 0.07;

// Props are authored in world tile space, projected by `isoToScreen()` to the
// center of an isometric tile diamond, then grounded on the front edge of the tile diamond.
// This keeps sprite feet, contact shadows, collision footprints,
// and depth sorting in one shared prop contact space.
export function propGroundContactPoint(projected, { tileHeight = DEFAULT_ISO_TILE_HEIGHT, groundYOffset = 0 } = {}) {
  const x = Number(projected?.x ?? 0);
  const y = Number(projected?.y ?? 0);
  return Object.freeze({
    x,
    y: y + tileHeight / 2 + groundYOffset,
  });
}

export function propDrawRectForGroundContact({ projected, drawWidth = 0, drawHeight = 0, tileHeight = DEFAULT_ISO_TILE_HEIGHT, groundYOffset = 0 } = {}) {
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

export function propShadowEllipseForGroundContact({ projected, drawWidth = 0, drawHeight = 0, tileHeight = DEFAULT_ISO_TILE_HEIGHT, groundYOffset = 0, alpha = PROP_CONTACT_SHADOW_ALPHA } = {}) {
  const contact = propGroundContactPoint(projected, { tileHeight, groundYOffset });
  const width = Math.max(8, Number(drawWidth) || 0);
  const height = Math.max(8, Number(drawHeight) || 0);
  return Object.freeze({
    x: Math.round(contact.x),
    y: Math.round(contact.y + PROP_CONTACT_SHADOW_SCREEN_Y_OFFSET),
    radiusX: Math.round(Math.max(10, width * PROP_CONTACT_SHADOW_WIDTH_RATIO)),
    radiusY: Math.round(Math.max(4, Math.min(18, height * PROP_CONTACT_SHADOW_HEIGHT_RATIO))),
    alpha: Math.max(0, Math.min(1, alpha)),
  });
}

export function propFrontEdgeDepth({ projected, footprint = null, radius = 0, drawOrderBias = 0, tileHeight = DEFAULT_ISO_TILE_HEIGHT, groundYOffset = 0 } = {}) {
  const contact = propGroundContactPoint(projected, { tileHeight, groundYOffset });
  const footprintDepthTiles = Math.max(
    0.5,
    Number(footprint?.h ?? 0) || Math.max(0.5, Number(radius) * 2 || 0.5),
  );
  return contact.y + footprintDepthTiles * (tileHeight / 4) + (Number(drawOrderBias) || 0);
}
