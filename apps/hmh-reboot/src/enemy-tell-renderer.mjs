// Enemy tell telegraphs drawn from the tell's locked geometry (design package
// S1.2, 5.2f and section 6: telegraphs equal their hitboxes). Runtime
// authority: PROJECTION. It reads the geometry the strike resolves against
// and draws exactly that shape (a lane as its full-width rectangle, a cone as
// its sector, a circle at its radius); it never writes simulation state.
// Loaded lazily with the enemy AI kit.

const LANES = new Set(['lane', 'shove-lane', 'rug-lane', 'tracking-lane', 'volley']);
const CIRCLES = new Set(['melee-circle', 'area-circle', 'offset-circle', 'support-ring']);
const CONTOUR_COLOR = 0x080d12;

function laneCorners(geometry) {
  const dx = geometry.to.x - geometry.from.x;
  const dy = geometry.to.y - geometry.from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * geometry.halfWidth;
  const ny = (dx / length) * geometry.halfWidth;
  const z = geometry.from.groundZ ?? 0;
  return [
    { x: geometry.from.x + nx, y: geometry.from.y + ny, z },
    { x: geometry.to.x + nx, y: geometry.to.y + ny, z: geometry.to.groundZ ?? z },
    { x: geometry.to.x - nx, y: geometry.to.y - ny, z: geometry.to.groundZ ?? z },
    { x: geometry.from.x - nx, y: geometry.from.y - ny, z },
  ];
}

function conePoints(geometry, segments = 10) {
  const z = geometry.origin.groundZ ?? 0;
  const base = Math.atan2(geometry.direction.y, geometry.direction.x);
  const points = [{ x: geometry.origin.x, y: geometry.origin.y, z }];
  for (let index = 0; index <= segments; index += 1) {
    const angle = base - geometry.halfAngle + (2 * geometry.halfAngle * index) / segments;
    points.push({ x: geometry.origin.x + Math.cos(angle) * geometry.range, y: geometry.origin.y + Math.sin(angle) * geometry.range, z });
  }
  return points;
}

// `toScreen(worldPoint)` -> {x, y}; `progress` is 0 at the tell's start and 1
// at its strike. Returns the number of primitives drawn.
export function drawEnemyTellGeometry(graphics, geometry, { toScreen, zoom, color, progress = 0 }) {
  if (!geometry) return 0;
  const alpha = 0.38 + Math.max(0, Math.min(1, progress)) * 0.5;
  const contour = { color: CONTOUR_COLOR, alpha: alpha * 0.72 };
  if (CIRCLES.has(geometry.type)) {
    const centre = toScreen({ x: geometry.center.x, y: geometry.center.y, z: geometry.center.groundZ ?? 0 });
    const radius = geometry.radius * zoom;
    const fill = geometry.type === 'area-circle' || geometry.type === 'offset-circle' ? 0.08 : 0;
    graphics.circle(centre.x, centre.y, radius);
    if (fill > 0) graphics.fill({ color, alpha: fill });
    graphics.stroke({ ...contour, width: geometry.type === 'support-ring' ? 11 : 10 })
      .stroke({ color, width: geometry.type === 'support-ring' ? 5 : 4, alpha });
    return 1;
  }
  if (LANES.has(geometry.type) || geometry.type === 'cone') {
    const points = (geometry.type === 'cone' ? conePoints(geometry) : laneCorners(geometry)).map(toScreen);
    const flat = points.flatMap((point) => [point.x, point.y]);
    graphics.poly(flat, true)
      .fill({ color, alpha: geometry.type === 'rug-lane' ? 0.26 : 0.14 + progress * 0.12 })
      .stroke({ ...contour, width: 6 })
      .stroke({ color, width: 2.5, alpha });
    if (geometry.type === 'volley') {
      // One tick mark per round along the lane.
      const from = toScreen({ x: geometry.from.x, y: geometry.from.y, z: geometry.from.groundZ ?? 0 });
      const to = toScreen({ x: geometry.to.x, y: geometry.to.y, z: geometry.to.groundZ ?? 0 });
      for (let round = 1; round <= geometry.rounds; round += 1) {
        const t = round / (geometry.rounds + 1);
        graphics.circle(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 3 * Math.max(0.6, zoom)).fill({ color, alpha });
      }
    }
    return 1;
  }
  return 0;
}
