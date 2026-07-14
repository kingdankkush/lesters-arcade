/**
 * ARISE — asset loading + background removal for sprites exported with
 * solid-colored backdrops.
 */

// Inner = pure-bg cutoff. Outer = where alpha is fully restored. The band
// between is the anti-alias fade. Keep the band narrow so character midtones
// that happen to sit near the backdrop's color aren't washed out.
const BG_INNER = 28;
const BG_OUTER = 42;

export type SpriteSource = HTMLImageElement | HTMLCanvasElement;

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function removeSpriteBackground(img: HTMLImageElement): HTMLCanvasElement {
  const full = document.createElement("canvas");
  full.width = img.naturalWidth;
  full.height = img.naturalHeight;
  const fctx = full.getContext("2d");
  if (!fctx) return full;
  fctx.drawImage(img, 0, 0);
  const imgData = fctx.getImageData(0, 0, full.width, full.height);
  const d = imgData.data;
  const W = full.width;
  const H = full.height;

  const pts: Array<[number, number]> = [
    [1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2],
    [W >> 1, 1], [W >> 1, H - 2], [1, H >> 1], [W - 2, H >> 1],
    [3, 3], [W - 4, 3], [3, H - 4], [W - 4, H - 4],
  ];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of pts) {
    const i = (y * W + x) * 4;
    br += d[i];
    bg += d[i + 1];
    bb += d[i + 2];
  }
  br /= pts.length;
  bg /= pts.length;
  bb /= pts.length;

  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - br;
    const dgn = d[i + 1] - bg;
    const db = d[i + 2] - bb;
    const dist = Math.sqrt(dr * dr + dgn * dgn + db * db);
    if (dist <= BG_INNER) {
      d[i + 3] = 0;
    } else if (dist < BG_OUTER) {
      d[i + 3] = Math.round(((dist - BG_INNER) / (BG_OUTER - BG_INNER)) * d[i + 3]);
    }
  }
  fctx.putImageData(imgData, 0, 0);

  const alphaMin = 24;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (d[row + x * 4 + 3] > alphaMin) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return full;

  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cropped = document.createElement("canvas");
  cropped.width = cw;
  cropped.height = ch;
  const cctx = cropped.getContext("2d");
  if (!cctx) return full;
  cctx.drawImage(full, minX, minY, cw, ch, 0, 0, cw, ch);
  return cropped;
}

// Pre-render a tinted copy of a sprite (for skin unlocks).
// tint is multiplied over the sprite's RGB while preserving alpha.
export function tintSprite(src: SpriteSource, tint: string): HTMLCanvasElement {
  const w = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width;
  const h = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.drawImage(src as CanvasImageSource, 0, 0);
  // Multiply-blend the tint color across the sprite, then mask by original alpha.
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(src as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return out;
}

// Trim a rectangular border off a loaded sprite. Used for tower sprites whose
// top/bottom rows become the visible rim at the gap — any lighter pixel on the
// source edge shows up as a bright line in-game.
export function cropSprite(
  src: SpriteSource,
  inset: { top: number; right: number; bottom: number; left: number }
): HTMLCanvasElement {
  const w = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width;
  const h = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height;
  const newW = Math.max(1, w - inset.left - inset.right);
  const newH = Math.max(1, h - inset.top - inset.bottom);
  const out = document.createElement("canvas");
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.drawImage(
    src as CanvasImageSource,
    inset.left,
    inset.top,
    newW,
    newH,
    0,
    0,
    newW,
    newH
  );
  return out;
}

export interface SpriteSpec {
  src: string;
  removeBg: boolean;
  // Proportional crop applied after load — values are fractions of the natural size.
  cropPct?: { top?: number; right?: number; bottom?: number; left?: number };
}

export const SPRITE_SRCS: Record<string, SpriteSpec> = {
  flap: { src: "/arise/chikun-flap.png", removeBg: true },
  coast: { src: "/arise/chikun-coast.png", removeBg: true },
  fall: { src: "/arise/chikun-fall.png", removeBg: true },
  tower: {
    src: "/arise/bigcorp-tower.png",
    removeBg: false,
    // Trim the sky-ish border rows/columns so the visible rim lands on solid building.
    cropPct: { top: 0.05, right: 0.09, bottom: 0.05, left: 0.09 },
  },
};
