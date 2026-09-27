// Load-time texture generation for the 1.9.0 world pass (lazy chunk).
//
// Each generator is a pure function returning straight (non-premultiplied)
// RGBA bytes, so it is testable without a browser and identical on every
// machine. No RNG: the only "noise" is an integer hash of the pixel lattice.
// `texturesFromPixels` uploads them once through a 2D canvas.

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
function hash2(x, y, salt) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 0x1_0000_0000;
}
// Smooth value noise on a wrapping lattice of `period` cells.
function valueNoise(x, y, period, salt) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const at = (ix, iy) => hash2(((ix % period) + period) % period, ((iy % period) + period) % period, salt);
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}

function image(size, height, shade) {
  const pixels = new Uint8ClampedArray(size * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = shade(x, y);
      const at = (y * size + x) * 4;
      pixels[at] = r;
      pixels[at + 1] = g;
      pixels[at + 2] = b;
      pixels[at + 3] = Math.round(clamp01(a) * 255);
    }
  }
  return Object.freeze({ width: size, height, pixels });
}

/** Black radial vignette: clear centre, alpha 1 in the far corners. */
export function vignettePixels(size = 128) {
  return image(size, size, (x, y) => {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const r = Math.hypot(u, v) / Math.SQRT2;
    return [0, 0, 0, smoothstep(0.42, 1, r) ** 1.4];
  });
}

/** Soft round glow: a dense core with a long falloff, white. */
export function glowPixels(size = 64) {
  return image(size, size, (x, y) => {
    const r = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
    return [255, 255, 255, clamp01(1 - r) ** 2.2];
  });
}

/** Smoke puff: a soft disc with a lumpy value-noise edge, white. */
export function puffPixels(size = 48) {
  return image(size, size, (x, y) => {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const r = Math.hypot(u, v);
    const n = valueNoise(x / 6, y / 6, 8, 11);
    return [255, 255, 255, clamp01(1 - r / (0.7 + 0.3 * n)) ** 1.5 * 0.9];
  });
}

/**
 * Ground scorch or debris (tinted dark at draw time): an irregular blob whose
 * edge is broken by value noise, plus hashed specks around it for debris.
 */
export function scorchPixels(size = 64, variant = 0) {
  return image(size, size, (x, y) => {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const r = Math.hypot(u, v);
    const n = valueNoise(x / 7, y / 7, 10, 23 + variant);
    if (variant === 1) {
      const speck = hash2(x >> 1, y >> 1, 41) > 0.93 && r < 0.95 ? 0.85 : 0;
      return [255, 255, 255, Math.max(speck, clamp01(0.55 - r / (0.5 + 0.4 * n)) * 0.6)];
    }
    const body = clamp01((0.78 + 0.35 * (n - 0.5) - r) * 3.2);
    return [255, 255, 255, body * (0.55 + 0.45 * n)];
  });
}

/**
 * Tileable caustic net: bright thin ridges where two warped cell fields meet.
 * The lattice wraps at `size`, so the tile repeats seamlessly.
 */
export function causticPixels(size = 64) {
  const period = 4;
  return image(size, size, (x, y) => {
    const fx = x / size * period, fy = y / size * period;
    const warp = valueNoise(fx * 2, fy * 2, period * 2, 5) - 0.5;
    const a = valueNoise(fx + warp, fy - warp, period, 7);
    const b = valueNoise(fx - warp + 1.7, fy + warp + 0.9, period, 13);
    const ridge = 1 - Math.min(1, Math.abs(a - b) * 9);
    return [255, 255, 255, ridge ** 3];
  });
}

/**
 * Upload generated images through one reusable 2D canvas. Returns textures in
 * input key order; the caller owns their lifetime.
 */
export function texturesFromPixels({ images, TextureClass, documentRef = globalThis.document } = {}) {
  if (typeof TextureClass?.from !== 'function') throw new TypeError('TextureClass.from required');
  const out = {};
  for (const [key, source] of Object.entries(images)) {
    const canvas = documentRef.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    context.putImageData(new ImageData(source.pixels, source.width, source.height), 0, 0);
    out[key] = TextureClass.from(canvas);
  }
  return Object.freeze(out);
}
