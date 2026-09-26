// Test helper (not a test file): measures how the rendered obstacle art lines
// up with the collision shapes, from the packer's coverage masks
// (tests/chikun-obstacle-masks.json, one cell per 2 logical px, set where the
// art's alpha is >= 0.5) and the pure layoutObstacleArt().
import { readFileSync } from 'node:fs';

const DATA = JSON.parse(readFileSync(new URL('./chikun-obstacle-masks.json', import.meta.url), 'utf8'));
export const MASK_CELL = DATA.cell;
export const MASKS = DATA.masks;
const decoded = new Map();

function bits(b64) {
  let out = decoded.get(b64);
  if (!out) { out = Buffer.from(b64, 'base64'); decoded.set(b64, out); }
  return out;
}
export function maskAt(mask, frame, lx, ly) {
  const cx = Math.floor(lx / MASK_CELL), cy = Math.floor(ly / MASK_CELL);
  if (cx < 0 || cy < 0 || cx >= mask.cols) return false;
  const b = bits(mask.frames[frame]), i = cy * mask.cols + cx;
  if ((i >> 3) >= b.length) return false;
  return (b[i >> 3] >> (7 - (i & 7))) & 1;
}

// Is logical point (x, y) covered by any draw of the layout?
export function artAt(ops, x, y) {
  for (const p of ops) {
    const m = MASKS[p.name];
    if (!m) continue;
    const lx = x - p.x, ly = y - p.y;
    if (lx < p.sx0 || lx >= p.sx1 || ly < p.sy0 || ly >= p.sy1) continue;
    if (maskAt(m, p.frame, lx, ly)) return true;
  }
  return false;
}

function segDist(x, y, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay, den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / den)) : 0;
  return Math.hypot(x - s.ax - t * dx, y - s.ay - t * dy);
}
// Signed distance to a shape (<= 0 inside).
export function shapeDistance(s, x, y) {
  if (s.type === 'circle') return Math.hypot(x - s.x, y - s.y) - s.radius;
  if (s.type === 'capsule') return segDist(x, y, s) - s.radius;
  const dx = Math.max(s.x - x, x - s.x - s.width, 0), dy = Math.max(s.y - y, y - s.y - s.height, 0);
  if (dx === 0 && dy === 0) return -Math.min(x - s.x, s.x + s.width - x, y - s.y, s.y + s.height - y);
  return Math.hypot(dx, dy);
}

// Coverage of the visible collision area (0 <= y < 690) by art, and how far
// art reaches outside the shapes, on a 2 px grid.
export function measure(o, ops, { floor = 690, shapes = o.shapes } = {}) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of shapes) {
    const b = s.type === 'rect' ? [s.x, s.y, s.x + s.width, s.y + s.height] : s.type === 'circle' ? [s.x - s.radius, s.y - s.radius, s.x + s.radius, s.y + s.radius]
      : [Math.min(s.ax, s.bx) - s.radius, Math.min(s.ay, s.by) - s.radius, Math.max(s.ax, s.bx) + s.radius, Math.max(s.ay, s.by) + s.radius];
    box[0] = Math.min(box[0], b[0]); box[1] = Math.min(box[1], b[1]); box[2] = Math.max(box[2], b[2]); box[3] = Math.max(box[3], b[3]);
  }
  const perShape = shapes.map(() => ({ inside: 0, covered: 0 }));
  let artOutside = 0, artTotal = 0, maxOver = 0, lead = 0, maxHole = 0;
  const holes = [];
  const pad = 48;
  for (let y = Math.max(0, box[1] - pad) + 1; y < Math.min(floor, box[3] + pad); y += 2) {
    for (let x = box[0] - pad + 1; x < box[2] + pad; x += 2) {
      const art = artAt(ops, x, y);
      let dmin = Infinity;
      for (let i = 0; i < shapes.length; i++) {
        const d = shapeDistance(shapes[i], x, y);
        dmin = Math.min(dmin, d);
        if (d <= 0) { perShape[i].inside++; if (art) perShape[i].covered++; }
      }
      if (dmin <= 0 && !art) holes.push(x, y);
      if (art) {
        artTotal++;
        if (dmin > 0) { artOutside++; maxOver = Math.max(maxOver, dmin); if (x < box[0]) lead = Math.max(lead, box[0] - x); }
      }
    }
  }
  // the largest empty gap inside the hitbox: distance from an uncovered point to the nearest art
  for (let i = 0; i < holes.length && i < 4000; i += 2) {
    const hx = holes[i], hy = holes[i + 1];
    let best = 64;
    for (let r = 2; r < best; r += 2) {
      let found = false;
      for (let a = 0; a < 16 && !found; a++) {
        const px = hx + Math.cos(a / 16 * Math.PI * 2) * r, py = hy + Math.sin(a / 16 * Math.PI * 2) * r;
        if (artAt(ops, px, py)) found = true;
      }
      if (found) { best = r; break; }
    }
    maxHole = Math.max(maxHole, best);
  }
  const cov = perShape.map(s => s.inside ? s.covered / s.inside : 1);
  return { coverage: Math.min(...cov), perShape: cov, overhangFraction: artTotal ? artOutside / artTotal : 0, maxOverhang: maxOver, leadingOverhang: lead, maxHole };
}
