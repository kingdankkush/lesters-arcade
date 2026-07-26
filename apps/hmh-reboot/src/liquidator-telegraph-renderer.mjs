const DEFAULT_TELEGRAPH_COLOR = 0xff496c;
const SUPER_TELEGRAPH_COLOR = 0xfff06a;
const SAFE_ZONE_COLOR = 0x83f28f;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function requireGraphics(graphics) {
  for (const method of ['moveTo', 'lineTo', 'circle', 'fill', 'stroke']) {
    if (typeof graphics?.[method] !== 'function') throw new TypeError(`graphics.${method} is required`);
  }
  return graphics;
}

/**
 * Draw one canonical Liquidator warning geometry.
 *
 * Projection-only: attack timing, targets, damage, and collision remain owned
 * by liquidator-boss.mjs. Returning a primitive count makes every authored
 * geometry behaviorally testable without WebGL or Pixi internals.
 */
export function renderLiquidatorTelegraph({
  graphics,
  pending,
  groundZ = pending?.groundZ,
  cameraZoom = 1,
  worldToScreen,
} = {}) {
  requireGraphics(graphics);
  if (!pending?.geometry || typeof pending.attackId !== 'string') throw new TypeError('pending boss telegraph is required');
  if (typeof worldToScreen !== 'function') throw new TypeError('worldToScreen is required');
  const z = finite(groundZ, 'groundZ');
  const zoom = finite(cameraZoom, 'cameraZoom');
  if (zoom <= 0) throw new TypeError('cameraZoom must be positive');

  const geometry = pending.geometry;
  const color = pending.attackId.includes('super') ? SUPER_TELEGRAPH_COLOR : DEFAULT_TELEGRAPH_COLOR;
  const project = (point) => worldToScreen({ ...point, z });
  let primitiveCount = 0;

  if (geometry.type === 'line' || geometry.type === 'dash-line') {
    const from = project(geometry.origin);
    const to = project(geometry.target);
    graphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
      .stroke({ color, width: geometry.width * zoom, alpha: 0.18, cap: 'round' })
      .stroke({ color, width: 4, alpha: 0.9, cap: 'round' });
    primitiveCount = 1;
  } else if (geometry.type === 'circle' || geometry.type === 'melee-circle') {
    const center = project(geometry.center);
    graphics.circle(center.x, center.y, geometry.radius * zoom)
      .fill({ color, alpha: 0.09 }).stroke({ color, width: 4, alpha: 0.9 });
    primitiveCount = 1;
  } else if (geometry.type === 'ring') {
    const center = project(geometry.center);
    graphics.circle(center.x, center.y, geometry.outerRadius * zoom).stroke({ color, width: 5, alpha: 0.9 });
    graphics.circle(center.x, center.y, geometry.innerRadius * zoom).stroke({ color, width: 3, alpha: 0.72 });
    primitiveCount = 2;
  } else if (geometry.type === 'safe-circles') {
    for (const zone of geometry.zones) {
      const center = project(zone);
      graphics.circle(center.x, center.y, geometry.radius * zoom)
        .fill({ color: SAFE_ZONE_COLOR, alpha: 0.1 }).stroke({ color: SAFE_ZONE_COLOR, width: 5, alpha: 0.95 });
      primitiveCount += 1;
    }
  } else if (geometry.type === 'summon-sites') {
    for (const site of geometry.sites) {
      const center = project(site);
      graphics.circle(center.x, center.y, 36 * zoom).stroke({ color, width: 4, alpha: 0.85 });
      primitiveCount += 1;
    }
  }

  return Object.freeze({ geometryType: geometry.type, primitiveCount });
}
