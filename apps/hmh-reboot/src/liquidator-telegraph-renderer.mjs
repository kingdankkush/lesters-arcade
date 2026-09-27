// Draws one pending boss strike (design package 4.1 "Readability"): danger is
// filled in fiat red with an edge in the phase's accent, safe zones are crypto
// green, and the fill deepens as the strike comes due. Projection only: the
// shapes, their timing and every hit test belong to the boss geometry kit and
// liquidator-boss.mjs; this module never writes simulation state. Returning a
// primitive count keeps every shape testable without WebGL.
import { finite } from './value-guards.mjs';

export const BOSS_DANGER_FILL = 0xff496c;
export const BOSS_SUPER_EDGE = 0xfff06a;
export const BOSS_SAFE_ZONE = 0x83f28f;
// Market Open, Margin Call, Total Liquidation (package 4.3 phase dressing).
export const BOSS_PHASE_EDGES = Object.freeze([0xff496c, 0xffc857, 0xe26dff]);
export const BOSS_TELEGRAPH_COLORS = Object.freeze([BOSS_DANGER_FILL, BOSS_SUPER_EDGE, BOSS_SAFE_ZONE, ...BOSS_PHASE_EDGES.slice(1)]);

function requireGraphics(graphics) {
  for (const method of ['moveTo', 'lineTo', 'circle', 'fill', 'stroke', 'poly']) {
    if (typeof graphics?.[method] !== 'function') throw new TypeError(`graphics.${method} is required`);
  }
  return graphics;
}

export function renderLiquidatorTelegraph({
  graphics,
  pending,
  groundZ = pending?.groundZ,
  cameraZoom = 1,
  worldToScreen,
  tick = pending?.tellStartTick ?? 0,
  phaseIndex = 0,
  floor = null,
} = {}) {
  requireGraphics(graphics);
  if (typeof pending?.attackId !== 'string' || (!pending.geometry && !pending.summon)) throw new TypeError('pending boss telegraph is required');
  if (typeof worldToScreen !== 'function') throw new TypeError('worldToScreen is required');
  const z = finite(groundZ, 'groundZ');
  const zoom = finite(cameraZoom, 'cameraZoom');
  if (zoom <= 0) throw new TypeError('cameraZoom must be positive');
  const project = (point) => worldToScreen({ x: point.x, y: point.y, z });
  const span = Math.max(1, (pending.resolveTick ?? 1) - (pending.tellStartTick ?? 0));
  const progress = Math.max(0, Math.min(1, (tick - (pending.tellStartTick ?? 0)) / span));
  const fillAlpha = 0.1 + 0.22 * progress;
  const edge = pending.attackId.includes('super') ? BOSS_SUPER_EDGE : BOSS_PHASE_EDGES[Math.max(0, Math.min(2, phaseIndex))];
  let primitiveCount = 0;

  const polygon = (points) => {
    const projected = points.map(project);
    graphics.poly(projected.flatMap((point) => [point.x, point.y]), true)
      .fill({ color: BOSS_DANGER_FILL, alpha: fillAlpha })
      .stroke({ color: edge, width: 3, alpha: 0.95 });
    primitiveCount += 1;
  };
  const band = (a, b, width) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / length) * (width / 2);
    const ny = ((b.x - a.x) / length) * (width / 2);
    polygon([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }]);
  };
  const box = (r) => polygon([{ x: r.minX, y: r.minY }, { x: r.maxX, y: r.minY }, { x: r.maxX, y: r.maxY }, { x: r.minX, y: r.maxY }]);
  const disc = (center, radius, color = BOSS_DANGER_FILL, alpha = fillAlpha, stroke = edge) => {
    const p = project(center);
    graphics.circle(p.x, p.y, radius * zoom).fill({ color, alpha }).stroke({ color: stroke, width: 3, alpha: 0.95 });
    primitiveCount += 1;
  };

  const draw = (shape) => {
    switch (shape.type) {
      case 'lane':
      case 'charge-lane':
        band(shape.origin, shape.target, shape.width);
        break;
      case 'chain-link':
        band(shape.a, shape.b, shape.width);
        break;
      case 'circle':
        disc(shape.center, shape.radius);
        break;
      case 'ring': {
        const p = project(shape.center);
        graphics.circle(p.x, p.y, ((shape.outerRadius + shape.innerRadius) / 2) * zoom).stroke({ color: BOSS_DANGER_FILL, width: (shape.outerRadius - shape.innerRadius) * zoom, alpha: fillAlpha });
        graphics.circle(p.x, p.y, shape.outerRadius * zoom).stroke({ color: edge, width: 3, alpha: 0.95 });
        graphics.circle(p.x, p.y, shape.innerRadius * zoom).stroke({ color: edge, width: 3, alpha: 0.95 });
        primitiveCount += 1;
        break;
      }
      case 'safe-zones':
        // The floor fills red; the safe circles stay green on top.
        if (floor) box(floor);
        for (const zone of shape.zones) disc(zone, shape.radius, BOSS_SAFE_ZONE, 0.2, BOSS_SAFE_ZONE);
        break;
      case 'panels':
        for (const cell of shape.cells) box(cell);
        break;
      case 'half-plane': {
        const { point, normal } = shape;
        const tx = -normal.y * 900;
        const ty = normal.x * 900;
        polygon([
          { x: point.x + tx, y: point.y + ty }, { x: point.x - tx, y: point.y - ty },
          { x: point.x - tx + normal.x * 600, y: point.y - ty + normal.y * 600 }, { x: point.x + tx + normal.x * 600, y: point.y + ty + normal.y * 600 },
        ]);
        break;
      }
      case 'drift-rect':
        box({ minX: shape.rect.minX + shape.drift.x, minY: shape.rect.minY + shape.drift.y, maxX: shape.rect.maxX + shape.drift.x, maxY: shape.rect.maxY + shape.drift.y });
        break;
      case 'rotating-bar': {
        const hx = (Math.cos(shape.angle) * shape.length) / 2;
        const hy = (Math.sin(shape.angle) * shape.length) / 2;
        band({ x: shape.center.x - hx, y: shape.center.y - hy }, { x: shape.center.x + hx, y: shape.center.y + hy }, shape.width);
        break;
      }
      case 'union':
        for (const part of shape.shapes) draw(part);
        break;
      default:
        break;
    }
  };

  if (pending.summon) {
    // Margin seals flash where the troops will walk in.
    for (const add of pending.summon.adds) {
      const p = project(add);
      graphics.circle(p.x, p.y, 36 * zoom).stroke({ color: edge, width: 4, alpha: 0.5 + 0.45 * progress });
      primitiveCount += 1;
    }
  } else draw(pending.geometry);
  return Object.freeze({ geometryType: pending.summon ? 'summon-sites' : pending.geometry.type, primitiveCount });
}
