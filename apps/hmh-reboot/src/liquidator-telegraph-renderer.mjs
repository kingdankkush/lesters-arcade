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

// Tiny reusable material for all tells; no downloaded texture or per-frame
// rasterization. Faint grain makes the filled floor read as an energy field.
export function createBossTelegraphTexture({ TextureClass, createCanvas } = {}) {
  try {
    const canvas = createCanvas();
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#b8b8b8'; ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) {
      const grain = 160 + ((x * 13 + y * 19 + x * y * 7) % 88);
      ctx.fillStyle = `rgb(${grain},${grain},${grain})`;
      ctx.fillRect(x, y, 2, 2);
    }
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 45);
    glow.addColorStop(0, 'rgba(255,255,255,.3)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 64, 64);
    return TextureClass.from(canvas);
  } catch { return null; }
}

function requireGraphics(graphics) {
  for (const method of ['moveTo', 'lineTo', 'circle', 'fill', 'stroke', 'poly', 'cut']) {
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
  dangerTexture = null,
  reduceFlash = false,
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
  const fillAlpha = Math.min(reduceFlash ? .22 : .32, (reduceFlash ? .08 : .1) + (reduceFlash ? .14 : .22) * progress);
  const edge = pending.attackId.includes('super') ? BOSS_SUPER_EDGE : BOSS_PHASE_EDGES[Math.max(0, Math.min(2, phaseIndex))];
  let primitiveCount = 0;

  const discPoints = (center, radius) => Array.from({ length: 32 }, (_, index) => {
    const angle = index * Math.PI / 16;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
  const paintPolygon = (points, color = BOSS_DANGER_FILL, alpha = fillAlpha, rim = edge, charge = true, holes = []) => {
    const projected = points.map(project);
    const outline = projected.flatMap((point) => [point.x, point.y]);
    const style = { color, alpha, ...(dangerTexture ? { texture: dangerTexture, textureSpace: 'local' } : {}) };
    graphics.poly(outline, true).fill(style);
    for (const hole of holes) graphics.poly(hole.map(project).flatMap(p => [p.x,p.y]), true).cut();
    graphics.poly(outline, true).stroke({ color: rim, width: 8, alpha: .12 });
    graphics.poly(outline, true).stroke({ color: rim, width: 2.5, alpha: .9 });
    if (charge) {
      const centre = projected.reduce((sum, p) => ({ x: sum.x + p.x / projected.length, y: sum.y + p.y / projected.length }), { x: 0, y: 0 });
      const scale = .08 + .92 * progress;
      graphics.poly(projected.flatMap(p => [centre.x + (p.x - centre.x) * scale, centre.y + (p.y - centre.y) * scale]), true)
        .fill({ ...style, alpha: reduceFlash ? .1 * progress : .18 * progress });
    }
  };
  const polygon = (points) => {
    paintPolygon(points);
    primitiveCount += 1;
  };
  const band = (a, b, width) => {
    const angle = Math.atan2(b.y - a.y, b.x - a.x), points = [];
    // Combat's distance-to-segment footprint is a capsule, including both
    // endpoint caps. A rectangular tell understated danger past each end.
    for (const [center, start] of [[b, angle - Math.PI / 2], [a, angle + Math.PI / 2]]) {
      for (let index = 0; index <= 16; index++) {
        const theta = start + index * Math.PI / 16;
        points.push({ x: center.x + Math.cos(theta) * width / 2, y: center.y + Math.sin(theta) * width / 2 });
      }
    }
    polygon(points);
  };
  const box = (r) => polygon([{ x: r.minX, y: r.minY }, { x: r.maxX, y: r.minY }, { x: r.maxX, y: r.maxY }, { x: r.minX, y: r.maxY }]);
  const disc = (center, radius, color = BOSS_DANGER_FILL, alpha = fillAlpha, stroke = edge) => {
    paintPolygon(discPoints(center, radius), color, alpha, stroke, color === BOSS_DANGER_FILL);
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
        // One annular fill with a real cutout, rather than 32 filled quads.
        const outer = discPoints(shape.center,shape.outerRadius).map(project).flatMap(p=>[p.x,p.y]);
        const inner = discPoints(shape.center,shape.innerRadius).map(project).flatMap(p=>[p.x,p.y]);
        graphics.poly(outer,true).fill({ color:BOSS_DANGER_FILL, alpha:fillAlpha, ...(dangerTexture?{texture:dangerTexture}:{}) });
        graphics.poly(inner,true).cut();
        for (const points of [outer, inner]) {
          graphics.poly(points, true).stroke({ color: edge, width: 8, alpha: .12 });
          graphics.poly(points, true).stroke({ color: edge, width: 2.5, alpha: .9 });
        }
        primitiveCount += 1;
        break;
      }
      case 'safe-zones':
        // Clear red from safe sectors before adding green; transparent green
        // over red produced muddy danger-coloured safe zones.
        if (floor) {
          paintPolygon([{x:floor.minX,y:floor.minY},{x:floor.maxX,y:floor.minY},{x:floor.maxX,y:floor.maxY},{x:floor.minX,y:floor.maxY}],
            BOSS_DANGER_FILL,fillAlpha,edge,false,shape.zones.map(zone=>discPoints(zone,shape.radius)));
          primitiveCount++;
        }
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
      disc(add, 36, BOSS_DANGER_FILL, fillAlpha, edge);
    }
  } else draw(pending.geometry);
  return Object.freeze({ geometryType: pending.summon ? 'summon-sites' : pending.geometry.type, primitiveCount });
}
