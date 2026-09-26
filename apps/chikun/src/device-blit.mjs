// Device-pixel drawing helpers. The scenery is prescaled once to the exact
// device density, then drawn 1:1 at an identity transform: no per-frame image
// scaling, crisp edges and no seams between tiles.

// Reads density and shake from the transform main.mjs set up
// (scale(density) · translate(-view.left, 0) · translate(shake)).
export function readDeviceFrame(ctx, view, out) {
  const t = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  const d = t && t.a > 0 ? t.a : (view?.density ?? 1);
  out.density = d;
  out.shakeX = t ? t.e / d + (view?.left ?? 0) : 0;
  out.shakeY = t ? t.f / d : 0;
  if (Math.abs(out.shakeX) < 1e-6) out.shakeX = 0;
  if (Math.abs(out.shakeY) < 1e-6) out.shakeY = 0;
  out.canvasWidth = ctx.canvas?.width ?? Math.round((view?.width ?? 1280) * d);
  out.canvasHeight = ctx.canvas?.height ?? Math.round(720 * d);
  return out;
}

export const mod = (a, n) => ((a % n) + n) % n;

// Draw a horizontally periodic image so it covers [x0, x1) of the device
// canvas. `scroll` is the device-space offset of column 0 (content moves left
// as scroll grows). Slow layers keep fractional x so they crawl smoothly.
export function blitPeriodic(ctx, img, period, scroll, y, x0, x1, round = true) {
  if (!img || !(period > 0)) return 0;
  let x = -mod(scroll, period);
  if (round) x = Math.round(x);
  let calls = 0;
  const w = img.width, h = img.height;
  for (; x < x1; x += period) {
    if (x + w <= x0) continue;
    const sx = Math.max(0, x0 - x), ex = Math.min(w, x1 - x);
    if (ex <= sx) continue;
    if (sx === 0 && ex === w) ctx.drawImage(img, x, y);
    else ctx.drawImage(img, sx, 0, ex - sx, h, x + sx, y, ex - sx, h);
    calls++;
  }
  return calls;
}

// Fill a periodic band with a repeat-x pattern: one fillRect for any width.
// `scale` is 1 except for a few frames after a rotation, while a band made for
// the previous density is still being replaced.
export function fillPeriodicBand(ctx, pattern, period, scroll, y, h, x0, x1, scale = 1) {
  if (!pattern || x1 <= x0 || h <= 0) return 0;
  const tx = Math.round(-mod(scroll, period * scale));
  ctx.setTransform(scale, 0, 0, scale, tx, y);
  ctx.fillStyle = pattern;
  ctx.fillRect((x0 - tx) / scale, 0, (x1 - x0) / scale, h / scale);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return 1;
}
