// C2 water pass (1.9.0 world pass, lazy chunk). Projection only.
//
// A shore-distance field is generated once from the authored water polygons:
// every 16-unit cell inside water records its distance to the nearest exposed
// bank (a bank another water surface covers is not a shore). The field drives
// three static shapes, built once in world units: the darker deep channel,
// the shallows mask for the two scrolling caustic TilingSprites and the
// sparkle anchors. Foam bands are offsets of the exposed bank segments inward,
// crawling toward the shore with the simulation tick.
//
// The whole layer lives in one world-space container: worldToScreen is a pure
// translation plus a uniform zoom (world-space.mjs), so the per-frame cost is
// one transform, two tile offsets and the foam strokes of the banks on screen.
// Bridge decks and the ford deck draw below this layer, so every covered
// rectangle is cut out of the field and the foam.
//
// The polygon tests below restate world-design-water.mjs on purpose: importing
// that module from this lazy chunk hoists it into a new shared chunk on the
// initial path (+392 B against a 4 KB headroom). The test suite pins the two
// to the same answers.
const F0 = Object.freeze;
export function waterPolygon(area) {
  return area.type === 'rect'
    ? [{ x: area.minX, y: area.minY }, { x: area.maxX, y: area.minY }, { x: area.maxX, y: area.maxY }, { x: area.minX, y: area.maxY }]
    : area.vertices;
}
function insidePolygon(x, y, poly) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
export function waterContains(area, x, y) {
  return area.type === 'rect' ? x >= area.minX && x <= area.maxX && y >= area.minY && y <= area.maxY : insidePolygon(x, y, area.vertices);
}
/** Water polygon edges not covered by another water surface. */
export function exposedShoreEdges(surfaces) {
  const water = surfaces.filter((surface) => surface.kind === 'water').map((surface) => ({ surface, vertices: waterPolygon(surface.area) }));
  const edges = [];
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  for (const entry of water) {
    for (let i = 0; i < entry.vertices.length; i += 1) {
      const a = entry.vertices[i], b = entry.vertices[(i + 1) % entry.vertices.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const cuts = [0, 1];
      for (const other of water) {
        if (other === entry) continue;
        for (let j = 0; j < other.vertices.length; j += 1) {
          const c = other.vertices[j], e = other.vertices[(j + 1) % other.vertices.length];
          const vx = e.x - c.x, vy = e.y - c.y, den = cross(dx, dy, vx, vy);
          if (Math.abs(den) < 1e-9) continue;
          const t = cross(c.x - a.x, c.y - a.y, vx, vy) / den, u = cross(c.x - a.x, c.y - a.y, dx, dy) / den;
          if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
        }
      }
      cuts.sort((p, q) => p - q);
      for (let j = 1; j < cuts.length; j += 1) {
        const lo = cuts[j - 1], hi = cuts[j];
        if (hi - lo < 1e-9) continue;
        const mx = a.x + dx * (lo + hi) / 2, my = a.y + dy * (lo + hi) / 2;
        if (water.some((other) => other !== entry && insidePolygon(mx, my, other.vertices))) continue;
        edges.push(F0({ surfaceId: entry.surface.id, z: entry.surface.waterLevel ?? 0, a: F0({ x: a.x + dx * lo, y: a.y + dy * lo }), b: F0({ x: a.x + dx * hi, y: a.y + dy * hi }) }));
      }
    }
  }
  return F0(edges);
}

export const WATER_FX_ART_ID = 'projection-water-fx-v1';
export const SHORE_FIELD_CELL = 16;
export const SHALLOWS_UNITS = 104;
export const DEEP_UNITS = 150;
export const FOAM_REACH_UNITS = 58;
export const FOAM_BANDS = 3;
export const FOAM_PERIOD_TICKS = 150;

const F = Object.freeze;

// Covered rectangles: bridge decks (lifted, so their painted footprint sits
// higher on screen by groundZ) and anything else drawn under this layer.
export function waterCoverRects(surfaces, margin = 10) {
  return F(surfaces.filter((surface) => surface.kind === 'bridge' && surface.area?.type === 'rect').map((surface) => F({
    minX: surface.area.minX - margin,
    maxX: surface.area.maxX + margin,
    minY: surface.area.minY - Math.max(0, surface.groundZ ?? 0) - margin,
    maxY: surface.area.maxY + margin,
  })));
}

const covered = (rects, x, y) => rects.some((rect) => x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY);
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/**
 * The exposed shore segments with their inward unit normal, minus the parts
 * on the world boundary (no beach off the map) and under a cover rectangle.
 */
export function buildShoreSegments({ surfaces, bounds, cover = waterCoverRects(surfaces) } = {}) {
  const water = surfaces.filter((surface) => surface.kind === 'water');
  const inWater = (x, y) => water.some((surface) => waterContains(surface.area, x, y));
  const segments = [];
  for (const edge of exposedShoreEdges(surfaces)) {
    const { a, b } = edge;
    if (a.y === b.y && bounds && (a.y <= bounds.minY || a.y >= bounds.maxY)) continue;
    if (a.x === b.x && bounds && (a.x <= bounds.minX || a.x >= bounds.maxX)) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(length > 1)) continue;
    let nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (!inWater(mx + nx * 6, my + ny * 6)) { nx = -nx; ny = -ny; }
    // Split the edge into uncovered runs by sampling every 8 units.
    const steps = Math.max(1, Math.ceil(length / 8));
    let start = null;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      const open = !covered(cover, x + nx * 8, y + ny * 8);
      if (open && start === null) start = t;
      if ((!open || step === steps) && start !== null) {
        const end = open ? t : (step - 1) / steps;
        if ((end - start) * length > 12) {
          segments.push(F({ ax: a.x + (b.x - a.x) * start, ay: a.y + (b.y - a.y) * start, bx: a.x + (b.x - a.x) * end, by: a.y + (b.y - a.y) * end, nx, ny, z: edge.z }));
        }
        start = null;
      }
    }
  }
  return F(segments);
}

/**
 * The shore-distance field over the water bounding box. -1 is not water (or
 * covered by a deck); otherwise the distance in world units to the nearest
 * shore segment.
 */
export function buildShoreField({ surfaces, segments, cover = waterCoverRects(surfaces), cell = SHORE_FIELD_CELL } = {}) {
  const water = surfaces.filter((surface) => surface.kind === 'water');
  if (water.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const surface of water) {
    const area = surface.area;
    const points = area.type === 'rect' ? [{ x: area.minX, y: area.minY }, { x: area.maxX, y: area.maxY }] : area.vertices;
    for (const point of points) {
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
  }
  minX = Math.floor(minX / cell) * cell;
  minY = Math.floor(minY / cell) * cell;
  const cols = Math.ceil((maxX - minX) / cell);
  const rows = Math.ceil((maxY - minY) / cell);
  const distance = new Float32Array(cols * rows).fill(-1);
  for (let row = 0; row < rows; row += 1) {
    const y = minY + (row + 0.5) * cell;
    for (let col = 0; col < cols; col += 1) {
      const x = minX + (col + 0.5) * cell;
      if (covered(cover, x, y) || !water.some((surface) => waterContains(surface.area, x, y))) continue;
      let best = Infinity;
      for (const segment of segments) best = Math.min(best, segmentDistance(x, y, segment.ax, segment.ay, segment.bx, segment.by));
      distance[row * cols + col] = Number.isFinite(best) ? best : 1e6;
    }
  }
  return F({ minX, minY, cols, rows, cell, distance, maxX: minX + cols * cell, maxY: minY + rows * cell });
}

/**
 * Merge the field cells that satisfy `accept(distance)` into rectangles:
 * horizontal runs per row, then identical runs stacked across rows.
 */
export function fieldRects(field, accept) {
  const rects = [];
  let open = new Map();
  for (let row = 0; row < field.rows; row += 1) {
    const next = new Map();
    let col = 0;
    while (col < field.cols) {
      const value = field.distance[row * field.cols + col];
      if (!(value >= 0 && accept(value))) { col += 1; continue; }
      const start = col;
      while (col < field.cols) {
        const run = field.distance[row * field.cols + col];
        if (!(run >= 0 && accept(run))) break;
        col += 1;
      }
      const key = `${start}:${col}`;
      const rect = open.get(key);
      if (rect) { rect.rowEnd = row + 1; next.set(key, rect); open.delete(key); } else next.set(key, { colStart: start, colEnd: col, rowStart: row, rowEnd: row + 1 });
    }
    for (const rect of open.values()) rects.push(rect);
    open = next;
  }
  for (const rect of open.values()) rects.push(rect);
  return F(rects.map((rect) => F({
    x: field.minX + rect.colStart * field.cell,
    y: field.minY + rect.rowStart * field.cell,
    width: (rect.colEnd - rect.colStart) * field.cell,
    height: (rect.rowEnd - rect.rowStart) * field.cell,
  })));
}

/** Sparkle anchors: every third shallow-to-mid cell on a hashed lattice. */
export function waterSparkleAnchors(field, limit = 240) {
  const out = [];
  for (let index = 0; index < field.distance.length && out.length < limit; index += 1) {
    const value = field.distance[index];
    if (!(value >= 24 && value <= 220)) continue;
    let h = Math.imul(index ^ 0x5bd1e995, 0x27d4eb2d);
    h ^= h >>> 15;
    if (((h >>> 0) % 11) !== 0) continue;
    const col = index % field.cols, row = Math.floor(index / field.cols);
    out.push(F({ x: field.minX + (col + 0.5) * field.cell, y: field.minY + (row + 0.5) * field.cell, phase: ((h >>> 8) % 997) / 997 }));
  }
  return F(out);
}

/**
 * The inward offset (world units) and alpha of foam band `band` at `tick`:
 * bands are born at the reach, crawl to the shore over one period and fade in
 * the last stretch, so the wrap never pops.
 */
export function resolveFoamBand(band, tick, reduceMotion = false) {
  if (reduceMotion) return F({ offset: 8 + band * 16, alpha: band === 0 ? 0.32 : 0.14 / band });
  const phase = ((tick / FOAM_PERIOD_TICKS + band / FOAM_BANDS) % 1 + 1) % 1;
  const offset = FOAM_REACH_UNITS * (1 - phase) + 3;
  const alpha = 0.42 * Math.min(1, phase * 3) * Math.min(1, (1 - phase) * 6) * (0.45 + 0.55 * phase);
  return F({ offset, alpha });
}

export function createWaterFx({ ContainerClass, GraphicsClass, TilingSpriteClass, causticTexture, world, profile } = {}) {
  const segments = buildShoreSegments({ surfaces: world.surfaces, bounds: world.bounds });
  const field = buildShoreField({ surfaces: world.surfaces, segments });
  if (!field) return null;
  const waterLevel = world.surfaces.find((surface) => surface.kind === 'water')?.waterLevel ?? 0;
  const container = new ContainerClass();
  container.label = 'world-water-fx';
  const deep = new GraphicsClass();
  deep.label = 'world-water-deep';
  for (const rect of fieldRects(field, (value) => value > DEEP_UNITS)) deep.rect(rect.x, rect.y, rect.width, rect.height);
  deep.fill({ color: 0x04202e, alpha: 0.24 });
  const shallowMask = new GraphicsClass();
  shallowMask.label = 'world-water-shallows-mask';
  for (const rect of fieldRects(field, (value) => value <= SHALLOWS_UNITS)) shallowMask.rect(rect.x, rect.y, rect.width, rect.height);
  shallowMask.fill({ color: 0xffffff, alpha: 1 });
  const caustics = new ContainerClass();
  caustics.label = 'world-water-caustics';
  caustics.blendMode = 'add';
  const tiles = [];
  if (causticTexture && TilingSpriteClass) {
    for (const [scale, alpha] of [[1.7, 0.13], [2.6, 0.09]]) {
      const tile = new TilingSpriteClass({ texture: causticTexture, width: field.maxX - field.minX, height: field.maxY - field.minY });
      tile.position.set(field.minX, field.minY);
      tile.tileScale.set(scale, scale);
      tile.alpha = alpha;
      tile.baseAlpha = alpha;
      caustics.addChild(tile);
      tiles.push(tile);
    }
    caustics.mask = shallowMask;
  }
  const foam = new GraphicsClass();
  foam.label = 'world-water-foam';
  container.addChild(deep, shallowMask, caustics, foam);
  if (!tiles.length) shallowMask.visible = false;
  const sparkles = waterSparkleAnchors(field);
  let foamTick = -1, foamReduced = null;
  const origin = { x: 0, y: 0, z: waterLevel };
  const report = { visible: false, foamSegments: 0, sparkles: 0 };

  const render = ({ camera, view, tick, worldToScreen, current, reduceMotion = false, place = null, sparkleBudget = 0 } = {}) => {
    const zoom = camera.zoom;
    const halfW = view.width / (2 * zoom) + 64, halfH = view.height / (2 * zoom) + 96;
    const visible = field.maxX >= camera.x - halfW && field.minX <= camera.x + halfW && field.maxY >= camera.y - halfH && field.minY <= camera.y + halfH;
    container.visible = visible;
    report.visible = visible;
    report.foamSegments = 0;
    report.sparkles = 0;
    if (!visible) return report;
    const screen = worldToScreen(origin, camera, view);
    container.position.set(screen.x, screen.y);
    container.scale.set(zoom, zoom);
    const bright = Math.max(0, Math.min(1, current?.bright ?? 1));
    const still = reduceMotion ? 0 : tick;
    tiles.forEach((tile, index) => {
      const direction = index === 0 ? 1 : -1;
      tile.tilePosition.set(still * 0.21 * direction, still * (index === 0 ? 0.13 : 0.19));
      tile.alpha = tile.baseAlpha * (0.45 + 0.55 * bright);
    });
    if (foamTick !== still || foamReduced !== reduceMotion) {
      foamTick = still;
      foamReduced = reduceMotion;
      foam.clear();
      for (let band = 0; band < FOAM_BANDS; band += 1) {
        const { offset, alpha } = resolveFoamBand(band, still, reduceMotion);
        if (alpha <= 0.01) continue;
        for (const segment of segments) {
          if (Math.max(segment.ax, segment.bx) < camera.x - halfW - offset || Math.min(segment.ax, segment.bx) > camera.x + halfW + offset
            || Math.max(segment.ay, segment.by) < camera.y - halfH - offset || Math.min(segment.ay, segment.by) > camera.y + halfH + offset) continue;
          const length = Math.hypot(segment.bx - segment.ax, segment.by - segment.ay);
          const inset = Math.min(offset, length * 0.3) / length;
          const ox = segment.nx * offset, oy = segment.ny * offset;
          foam.moveTo(segment.ax + (segment.bx - segment.ax) * inset + ox, segment.ay + (segment.by - segment.ay) * inset + oy)
            .lineTo(segment.bx - (segment.bx - segment.ax) * inset + ox, segment.by - (segment.by - segment.ay) * inset + oy);
          report.foamSegments += 1;
        }
        foam.stroke({ color: 0xe6fbff, width: band === 0 ? 3.2 : 2.2, alpha, cap: 'round' });
      }
    }
    // Sun glints on the open water, only while the mood is bright.
    if (place && sparkleBudget > 0 && bright > 0.4 && !reduceMotion) {
      const strength = (bright - 0.4) / 0.6;
      for (const anchor of sparkles) {
        if (Math.abs(anchor.x - camera.x) > halfW || Math.abs(anchor.y - camera.y) > halfH) continue;
        const phase = ((tick / 41 + anchor.phase) % 1 + 1) % 1;
        const twinkle = Math.max(0, 1 - Math.abs(phase - 0.5) * 7);
        if (twinkle <= 0) continue;
        const size = (2 + 3 * twinkle) * zoom;
        if (!place(screen.x + anchor.x * zoom, screen.y + anchor.y * zoom, size, 0xf4feff, 0.8 * twinkle * strength)) break;
        report.sparkles += 1;
        if (report.sparkles >= sparkleBudget) break;
      }
    }
    return report;
  };
  return F({ artId: WATER_FX_ART_ID, runtimeAuthority: 'projection-only', container, field, segments, render, profileId: profile?.id ?? null });
}
