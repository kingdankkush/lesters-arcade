// CPU-only pose contact sheet for a hero GLB, rendered with the runtime's own
// decoder and skinning math (no Blender, no GPU, no heavy lock). Flat-shaded
// software rasteriser; a readability check for authored poses, never game art.
//   node scripts/hmh-hero-clip-preview.mjs --hero lilly [--time 0.25 --time 0.5 --time 0.75] [--size 200] [--columns 4] [--clips a,b]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, gunzipSync } from 'node:zlib';
import { decodeActor3dGlb, evaluateActor3dPose } from '../apps/hmh-reboot/src/actor-3d-model.mjs';
import { actor3dPrimitiveVisible } from '../apps/hmh-reboot/src/actor-3d-pixi.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : fallback; };
const options = (name) => args.flatMap((value, index) => value === name ? [args[index + 1]] : []);
const hero = option('--hero', 'lilly'), size = Number(option('--size', 200)), columns = Number(option('--columns', 4));
const times = options('--time').map(Number); if (!times.length) times.push(.25, .5, .75);
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL(`apps/portal/assets/generated/hmh-actor-3d-pilot/${hero}-clips.json`, root)));
const only = option('--clips', null)?.split(',');
const clips = [...manifest.nativeClips,...manifest.libraryClips].map(clip => clip.name).filter(name => only ? only.includes(name) : manifest.libraryClips.some(clip=>clip.name===name));
const input = new URL(option('--asset',`apps/portal/assets/generated/hmh-actor-3d-pilot/${hero}.glb`), root);
const packed = readFileSync(input), bytes=input.pathname.endsWith('.gz') ? gunzipSync(packed) : packed;
const asset = decodeActor3dGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

// Orthographic three-quarter view from front-right, 35 degrees above the ground (glTF Y up, -Z forward... hero faces +Z after export).
const yaw = -35 * Math.PI / 180, pitch = 35 * Math.PI / 180, metresTall = 2.6;
const project = ([x, y, z]) => {
  const rx = x * Math.cos(yaw) + z * Math.sin(yaw), rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const py = y * Math.cos(pitch) - rz * Math.sin(pitch), depth = y * Math.sin(pitch) + rz * Math.cos(pitch);
  return [size / 2 + rx / metresTall * size, size * .92 - py / metresTall * size, depth];
};
const light = (() => { const v = [-.4, .8, .45], n = Math.hypot(...v); return v.map(c => c / n); })();

function renderFrame(clip, time) {
  const palette = evaluateActor3dPose(asset, clip, time)[0];
  const pixels = new Uint8ClampedArray(size * size * 3).fill(28), zbuffer = new Float32Array(size * size).fill(-Infinity);
  for (let y = Math.floor(size * .92); y < size; y++) for (let x = 0; x < size; x++) { const at = (y * size + x) * 3; pixels[at] = 52; pixels[at + 1] = 48; pixels[at + 2] = 42; }
  for (const primitive of asset.primitives) {
    if (!actor3dPrimitiveVisible(primitive.nodeName, clip)) continue;
    const prop = /Coin Blaster|coin-blaster|Litecoin Knife|litecoin-knife|Satoshi Frag|satoshi-frag|Throw Release/.test(primitive.nodeName);
    const world = new Float32Array(primitive.positions.length);
    for (let i = 0; i < primitive.positions.length / 3; i++) {
      const p = primitive.positions.subarray(i * 3, i * 3 + 3);
      for (let w = 0; w < 4; w++) {
        const weight = primitive.weights[i * 4 + w]; if (weight <= 0) continue;
        const at = primitive.joints[i * 4 + w] * 16;
        for (let axis = 0; axis < 3; axis++) world[i * 3 + axis] += weight * (palette[at + axis] * p[0] + palette[at + 4 + axis] * p[1] + palette[at + 8 + axis] * p[2] + palette[at + 12 + axis]);
      }
    }
    const screen = [];
    for (let i = 0; i < world.length / 3; i++) screen.push(project([world[i * 3], world[i * 3 + 1], world[i * 3 + 2]]));
    for (let t = 0; t < primitive.indices.length; t += 3) {
      const a = primitive.indices[t], b = primitive.indices[t + 1], c = primitive.indices[t + 2];
      const ax = world[a * 3], ay = world[a * 3 + 1], az = world[a * 3 + 2];
      const e1 = [world[b * 3] - ax, world[b * 3 + 1] - ay, world[b * 3 + 2] - az], e2 = [world[c * 3] - ax, world[c * 3 + 1] - ay, world[c * 3 + 2] - az];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], len = Math.hypot(...n) || 1;
      const shade = Math.abs(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / len * .75 + .25;
      const color = prop ? [230 * shade, 190 * shade, 70 * shade] : [90 * shade, 170 * shade, 190 * shade];
      rasterise(screen[a], screen[b], screen[c], color, pixels, zbuffer);
    }
  }
  return pixels;
}

function rasterise(p0, p1, p2, color, pixels, zbuffer) {
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), maxX = Math.min(size - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), maxY = Math.min(size - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
  const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]); if (Math.abs(area) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + .5, py = y + .5;
    const w0 = ((p1[0] - px) * (p2[1] - py) - (p2[0] - px) * (p1[1] - py)) / area, w1 = ((p2[0] - px) * (p0[1] - py) - (p0[0] - px) * (p2[1] - py)) / area, w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    const depth = w0 * p0[2] + w1 * p1[2] + w2 * p2[2], at = y * size + x;
    if (depth <= zbuffer[at]) continue; zbuffer[at] = depth;
    pixels[at * 3] = color[0]; pixels[at * 3 + 1] = color[1]; pixels[at * 3 + 2] = color[2];
  }
}

// 5x7 bitmap font for labels (digits, lowercase, hyphen, dot, slash, equals, space).
const FONT = { '0': '1f11913152521f', '1': '040c0404040e', '2': '0e11010e10101f', '3': '1f02040201110e', '4': '02060a121f0202', '5': '1f10101e01110e', '6': '0608101e11110e', '7': '1f01020408080', '8': '0e110e11110e', '9': '0e11110f01020c',
  a: '000e011f111f', b: '10101e11111e', c: '000e1110110e', d: '01010f11110f', e: '000e111f100e', f: '060908 1c0808', g: '000f11110f01 0e', h: '10101e111111', i: '0400 0c04040e', j: '020006020212 0c', k: '1010121c1412', l: '0c0404040e', m: '001a151515', n: '001e111111', o: '000e11110e', p: '001e111e1010', q: '000f110f0101', r: '00161910 10', s: '000f100e011e', t: '08081c08 0906', u: '0011111113 0d', v: '00111111 0a04', w: '00111515 0a', x: '0011 0a04 0a11', y: '00111111 0f01 0e', z: '001f02 04 08 1f', '-': '00000e', '.': '0000000004', '/': '0102 04 08 10', '=': '000e000e', ' ': '' };
function drawText(sheet, width, x0, y0, text) {
  let x = x0;
  for (const ch of text) {
    const rows = (FONT[ch] ?? '').replace(/ /g, '').match(/.{1,2}/g) ?? [];
    rows.forEach((hex, row) => { const bits = parseInt(hex, 16); for (let col = 0; col < 5; col++) if (bits & (1 << (4 - col))) { const at = ((y0 + row) * width + x + col) * 3; sheet[at] = sheet[at + 1] = sheet[at + 2] = 235; } });
    x += 6;
  }
}

function png(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1); }
  const crc = buffer => { let c = ~0; for (const b of buffer) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (~c) >>> 0; };
  const chunk = (type, data) => { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const cellW = size * times.length, cellH = size + 12, rows = Math.ceil(clips.length / columns), width = columns * cellW, height = rows * cellH;
const sheet = new Uint8ClampedArray(width * height * 3).fill(12);
clips.forEach((clip, index) => {
  const x0 = (index % columns) * cellW, y0 = Math.floor(index / columns) * cellH;
  times.forEach((time, t) => {
    const frame = renderFrame(clip, time);
    for (let y = 0; y < size; y++) sheet.set(frame.subarray(y * size * 3, (y + 1) * size * 3), ((y0 + 12 + y) * width + x0 + t * size) * 3);
  });
  drawText(sheet, width, x0 + 3, y0 + 2, `${clip} t=${times.join('/')}`);
});
const outDir = new URL('docs/2.0/receipts/hmh-hero-clips-20260930/', root); mkdirSync(outDir, { recursive: true });
const output = option('--output',null) ? new URL(option('--output',null),root) : new URL(`${hero}-clip-contact-sheet-runtime${only ? '-' + only.join('_') : ''}.png`, outDir);
writeFileSync(output, png(width, height, sheet));
console.log(`HMH_RUNTIME_CLIP_SHEET=${output.pathname} ${width}x${height} ${clips.length} clips`);
