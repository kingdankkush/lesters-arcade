// Generic area-art renderer for the ten-area world. Consumes a frozen plan
// (see world-v2-area-art-schema.mjs) plus the HD prop kit manifest and paints
// ground materials, worn trails, road ribbons, kit cards and decorated solids.
// Projection only: it reads the authored world and never writes collision,
// navigation, spawning, RNG, progression or results. Mountable from the
// private scene and from the real game's area hook with the same factory.
// Only symbols the child's pixi vendor chunk re-exports may be imported here;
// fill matrices are plain {a,b,c,d,tx,ty} objects for that reason.
import { Container, Graphics, Sprite, Texture, Rectangle, Mesh, Shader, GlProgram, Geometry, UniformGroup } from 'pixi.js';
import { createGreyboxPropResidency } from './dev/greybox-prop-residency.mjs';
import { AREA_ART_KIT_ROOT, AREA_ART_KIT_MANIFEST, AREA_ART_TILE_ROOT, AREA_ART_DETAIL_ROOT, AREA_ART_DETAIL_PAGE, AREA_ART_MATERIALS, AREA_ART_TILE_MEANS, ROAD_RECIPES, FOLIAGE_TINT_RULES, validateAreaArtPlan, resolveKitItem, ribbonPolygon, offsetPolygon, polygonBounds, rectVertices, pointInPolygon, stableUnit } from './world-v2-area-art-schema.mjs';
import { buildTerrainField, TERRAIN_LIGHT_RANGE, valueNoise } from './world-v2-terrain-field.mjs';
export { validateAreaArtPlan, createPlacementGuard, AREA_ART_SCHEMA, AREA_ART_MATERIALS } from './world-v2-area-art-schema.mjs';

export const AREA_ART_ID = 'world-v2-area-art/v1';
const SHADOW_TINT = 0x03070b;
// Shared key from the screen upper left: contact shadows lean down-right.
const SHADOW_LEAN = Object.freeze({ x: 0.1, y: 0.05 });
const DETAIL_FRAMES = Object.freeze({ 'detail:grass': { x: 0, y: 0, w: 180, h: 122, anchor: { x: 0.53, y: 0.73 }, scale: 0.34 }, 'detail:aggregate': { x: 0, y: 160, w: 224, h: 96, anchor: { x: 0.5, y: 0.5 }, scale: 0.42 } });

const scaleMatrix = s => ({ a: s, b: 0, c: 0, d: s, tx: 0, ty: 0 });
// Tiles decode at 512 px (full) or 256 px (@0.5x); fills map world units per
// 512-texel repeat whatever the decoded size.
const tileScale = (texture, scale) => scale * 512 / (texture?.source.pixelWidth || 512);

// ---- splat shader: palette colour x amplified tile grain, blended per pixel by the control field ----
const TERRAIN_VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
out vec2 vWorld;
void main() { vWorld = aPosition; vec3 p = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0); gl_Position = vec4(p.xy, 0.0, 1.0); }`;
const TERRAIN_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vWorld;
out vec4 finalColor;
uniform sampler2D uT0; uniform sampler2D uT1; uniform sampler2D uT2; uniform sampler2D uT3; uniform sampler2D uT4; uniform sampler2D uT5; uniform sampler2D uT6; uniform sampler2D uT7; uniform sampler2D uT8; uniform sampler2D uT9; uniform sampler2D uControl; uniform sampler2D uLight;
uniform vec4 uL0; uniform vec4 uL1; uniform vec4 uL2; uniform vec4 uL3; uniform vec4 uL4; uniform vec4 uL5; uniform vec4 uL6; uniform vec4 uL7; uniform vec4 uL8; uniform vec4 uL9;
uniform vec3 uM0; uniform vec3 uM1; uniform vec3 uM2; uniform vec3 uM3; uniform vec3 uM4; uniform vec3 uM5; uniform vec3 uM6; uniform vec3 uM7; uniform vec3 uM8; uniform vec3 uM9;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
uniform vec4 uField; uniform vec4 uParams;
uniform vec4 uColor; uniform vec4 uWorldColorAlpha;
vec3 grain(sampler2D t, vec4 p, vec3 mean) {
  vec2 uv = p.w > 0.5 ? vec2(-vWorld.y, vWorld.x) * p.x + vec2(0.37, 0.19) : vWorld * p.x;
  vec3 s = texture(t, uv).rgb / mean;
  if (p.z > 0.5) s = vec3(dot(s, vec3(0.299, 0.587, 0.114)));
  return max(vec3(0.0), 1.0 + (s - 1.0) * p.y);
}
void main() {
  vec2 cuv = (vWorld - uField.xy) * uField.zw;
  vec3 lx = texture(uLight, cuv).rgb;
  vec4 c = vec4(texture(uControl, cuv).rgb, lx.r);
  vec3 g0 = grain(uT0, uL0, uM0), g1 = grain(uT1, uL1, uM1), g2 = grain(uT2, uL2, uM2), g3 = grain(uT3, uL3, uM3), g4 = grain(uT4, uL4, uM4), g5 = grain(uT5, uL5, uM5);
  float w1 = smoothstep(0.22, 0.78, c.r + (dot(g2, vec3(0.3333)) - 1.0) * uParams.w);
  float w2 = smoothstep(0.22, 0.78, c.g + (dot(g4, vec3(0.3333)) - 1.0) * uParams.w);
  vec3 ground = mix(mix(uC0 * g0 * g1, uC1 * g2 * g3, w1), uC2 * g4 * g5, w2);
  if (lx.g > 0.004) { vec3 g6 = grain(uT6, uL6, uM6), g7 = grain(uT7, uL7, uM7); ground = mix(ground, uC3 * g6 * g7, smoothstep(0.22, 0.78, lx.g + (dot(g6, vec3(0.3333)) - 1.0) * uParams.w)); }
  if (lx.b > 0.004) { vec3 g8 = grain(uT8, uL8, uM8), g9 = grain(uT9, uL9, uM9); ground = mix(ground, uC4 * g8 * g9, smoothstep(0.22, 0.78, lx.b + (dot(g8, vec3(0.3333)) - 1.0) * uParams.w)); }
  ground *= 1.0 + (c.b - 0.5) * 2.0 * uParams.x;
  ground *= mix(uParams.y, uParams.z, c.a);
  finalColor = vec4(clamp(ground, 0.0, 1.0), 1.0) * uColor * uWorldColorAlpha;
}`;
// Shared GLSL: amplified tile grain and a sine-free lattice hash noise
// (presentation only; the simulation never sees it).
const GRAIN_GLSL = `
vec3 grain(sampler2D t, vec4 p, vec3 mean) {
  vec2 uv = p.w > 0.5 ? vec2(-vWorld.y, vWorld.x) * p.x + vec2(0.37, 0.19) : vWorld * p.x;
  vec3 s = texture(t, uv).rgb / mean;
  if (p.z > 0.5) s = vec3(dot(s, vec3(0.299, 0.587, 0.114)));
  return max(vec3(0.0), 1.0 + (s - 1.0) * p.y);
}
float hash2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm2(vec2 p) { return vnoise(p) * 0.62 + vnoise(p * 2.13 + 17.0) * 0.38; }`;
const ROAD_VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition; in vec2 aRoad;
uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
out vec2 vWorld; out vec2 vRoad;
void main() { vWorld = aPosition; vRoad = aRoad; vec3 p = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0); gl_Position = vec4(p.xy, 0.0, 1.0); }`;
// Opaque core with a noise-eroded edge, shoulder fading into the splat
// ground, tyre ruts, worn chalk centre line, faded ends. Premultiplied out.
const ROAD_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vWorld; in vec2 vRoad;
out vec4 finalColor;
uniform sampler2D uT0; uniform sampler2D uT1; uniform sampler2D uT2; uniform sampler2D uT3;
uniform vec4 uL0; uniform vec4 uL1; uniform vec4 uL2; uniform vec4 uL3;
uniform vec3 uM0; uniform vec3 uM1; uniform vec3 uM2; uniform vec3 uM3;
uniform vec3 uCore; uniform vec3 uShoulder;
uniform vec4 uShape; uniform vec4 uWear;
uniform vec4 uColor; uniform vec4 uWorldColorAlpha;
${GRAIN_GLSL}
void main() {
  float lat = abs(vRoad.x), along = vRoad.y;
  float n = fbm2(vWorld / 70.0) - 0.5, m = fbm2(vWorld / 520.0 + 5.0) - 0.5, n2 = fbm2(vWorld / 24.0 + 11.0) - 0.5;
  float edge = uShape.x * (1.0 + m * 0.16) + n * 30.0 + n2 * 18.0;
  float core = 1.0 - smoothstep(edge - 5.0, edge + 5.0, lat);
  float outer = uShape.y + n * 70.0 + m * 60.0;
  float shoulder = (1.0 - smoothstep(edge, outer, lat)) * uWear.w;
  float endFade = 220.0 + n * 120.0;
  float ends = smoothstep(0.0, endFade, along) * smoothstep(0.0, endFade, uShape.z - along);
  core *= smoothstep(0.35, 0.65, ends + n * 0.3); shoulder *= ends;
  vec3 coreCol = uCore * grain(uT0, uL0, uM0) * grain(uT1, uL1, uM1);
  vec3 shCol = uShoulder * grain(uT2, uL2, uM2) * grain(uT3, uL3, uM3);
  coreCol *= 1.0 + m * 0.22;
  float rutWidth = 6.0 + 5.0 * fbm2(vec2(along / 90.0, sign(vRoad.x) * 7.0));
  float rut = exp(-pow((lat - uWear.x * uShape.x) / rutWidth, 2.0)) * uWear.y * (0.45 + 0.9 * fbm2(vec2(along / 210.0, sign(vRoad.x) * 3.0 + 1.0)));
  coreCol *= 1.0 - rut;
  if (uWear.z > 0.5) {
    float dash = smoothstep(0.38, 0.42, fract(along / 260.0)) * (1.0 - smoothstep(0.92, 0.96, fract(along / 260.0)));
    float line = 1.0 - smoothstep(4.0, 7.5, abs(vRoad.x + n * 3.0));
    float worn = smoothstep(0.3, 0.62, fbm2(vWorld / 34.0 + 3.0));
    coreCol = mix(coreCol, vec3(0.80, 0.78, 0.72) * (0.9 + n * 0.3), line * dash * worn * 0.55);
  }
  coreCol *= 1.0 - 0.1 * smoothstep(edge - 40.0, edge, lat);
  // Loose dust thrown onto the verge just outside the worn edge.
  shCol *= 1.0 + 0.12 * (1.0 - smoothstep(edge, edge + 70.0, lat));
  vec3 col = mix(shCol, coreCol, core);
  float alpha = clamp(max(core, shoulder), 0.0, 1.0);
  finalColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha) * uColor * uWorldColorAlpha;
}`;
// A single material over a polygon: roofs and cliff tops through the same
// grain as the ground, with broad value variation instead of a flat tile.
const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vWorld;
out vec4 finalColor;
uniform sampler2D uT0; uniform sampler2D uT1;
uniform vec4 uL0; uniform vec4 uL1; uniform vec3 uM0; uniform vec3 uM1;
uniform vec3 uBase; uniform vec4 uSurface; uniform vec3 uMoss;
uniform vec4 uColor; uniform vec4 uWorldColorAlpha;
${GRAIN_GLSL}
void main() {
  vec3 col = uBase * grain(uT0, uL0, uM0) * grain(uT1, uL1, uM1);
  col *= 1.0 + (fbm2(vWorld / 520.0) - 0.5) * uSurface.x + (fbm2(vWorld / 90.0 + 9.0) - 0.5) * uSurface.y;
  col = mix(col, uMoss * grain(uT1, uL1, uM1), smoothstep(0.52, 0.72, fbm2(vWorld / 380.0 + 4.0)) * uSurface.z);
  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0) * uColor * uWorldColorAlpha;
}`;
const TERRAIN_PROGRAMS = { terrain: [TERRAIN_VERTEX, TERRAIN_FRAGMENT], road: [ROAD_VERTEX, ROAD_FRAGMENT], surface: [TERRAIN_VERTEX, SURFACE_FRAGMENT] };
const programs = new Map();
const defaultTerrainProgram = (kind = 'terrain') => { let program = programs.get(kind); if (!program) { const [vertex, fragment] = TERRAIN_PROGRAMS[kind]; program = GlProgram.from({ name: `hmh-area-${kind}`, vertex, fragment }); programs.set(kind, program); } return program; };
// Ear clipping for the small authored solid outlines (no earcut in the vendor chunk).
export function triangulatePolygon(vertices) {
  const n = vertices.length; if (n < 3) return [];
  const area = vertices.reduce((sum, p, i) => { const q = vertices[(i + 1) % n]; return sum + p.x * q.y - q.x * p.y; }, 0), sign = area >= 0 ? 1 : -1;
  const idx = vertices.map((_, i) => i), out = [];
  const cross = (a, b, c) => ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * sign;
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = n * n;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length], a = vertices[i0], b = vertices[i1], c = vertices[i2];
      if (cross(a, b, c) <= 0) continue;
      if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inside(vertices[j], a, b, c))) continue;
      out.push(i0, i1, i2); idx.splice(k, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
  return out;
}
const rgb = color => [(color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255];

// Control textures from a field: two opaque canvases (weights/value and
// light) so no data channel passes through alpha premultiplication.
function opaqueCanvas(field, pick) {
  const canvas = document.createElement('canvas'); canvas.width = field.width; canvas.height = field.height;
  const context = canvas.getContext('2d'), image = context.createImageData(field.width, field.height), out = image.data, src = field.data;
  for (let o = 0; o < src.length; o += 4) { pick(src, o, out); out[o + 3] = 255; }
  context.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.style.addressMode = 'clamp-to-edge'; texture.source.style.update();
  return texture;
}
function defaultControlTexture(field) {
  if (typeof document === 'undefined') return null;
  return { control: opaqueCanvas(field, (src, o, out) => { out[o] = src[o]; out[o + 1] = src[o + 1]; out[o + 2] = src[o + 2]; }), light: opaqueCanvas(field, (src, o, out) => { out[o] = src[o + 3]; out[o + 1] = field.extra ? field.extra[o / 2] : 0; out[o + 2] = field.extra ? field.extra[o / 2 + 1] : 0; }) };
}
export function multiplyTint(a, b) {
  const channel = shift => Math.round(((a >> shift & 255) * (b >> shift & 255)) / 255);
  return channel(16) << 16 | channel(8) << 8 | channel(0);
}

// Reference-counted texture ownership shared between several plans (Woods and
// Meadows both read the plants page). Every acquired URL is released on dispose.
export function createAreaArtTextureCache({ loadTexture, unloadTexture = null } = {}) {
  const load = typeof loadTexture === 'function' ? loadTexture : defaultLoadTexture;
  const unload = typeof unloadTexture === 'function' ? unloadTexture : destroyTexture;
  const entries = new Map();
  let disposed = false;
  async function acquire(url) {
    if (disposed) throw new Error('texture cache disposed');
    let entry = entries.get(url);
    if (!entry) { entry = { count: 0, promise: load(url) }; entries.set(url, entry); }
    entry.count++;
    try { return await entry.promise; }
    catch (error) { release(url); throw error; }
  }
  function release(url) {
    const entry = entries.get(url);
    if (!entry) return;
    entry.count--;
    if (entry.count > 0) return;
    entries.delete(url);
    entry.promise.then(() => unload(url, entry), () => {});
  }
  const decodedBytes = async () => { let total = 0; for (const entry of entries.values()) { try { const t = await entry.promise; total += t.source.pixelWidth * t.source.pixelHeight * 4; } catch {} } return total; };
  return Object.freeze({ acquire, release, decodedBytes, snapshot: () => Object.freeze({ disposed, urls: Object.freeze([...entries.keys()].sort()), references: [...entries.values()].reduce((n, e) => n + e.count, 0) }), dispose() { disposed = true; for (const url of [...entries.keys()]) { const entry = entries.get(url); entries.delete(url); entry.promise.then(() => unload(url, entry), () => {}); } } });
}
async function defaultLoadTexture(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const texture = Texture.from(image, true);
  texture.areaArtImage = image;
  return texture;
}
function destroyTexture(url, entry) {
  entry.promise.then(texture => {
  if (!texture || texture.destroyed) return;
  const image = texture.areaArtImage;
  texture.destroy(true);
  image?.removeAttribute?.('src');
  }, () => {});
}

// Sign panel texture: chalk condensed capitals on a slate panel with a thin
// darker frame; baked once per text at 4 px per world unit of panel height.
function defaultSignTexture(text, sign) {
  if (typeof document === 'undefined') return null;
  const scale = 4, h = Math.round(sign.height * scale), font = `700 ${Math.round(h * 0.56)}px "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif`;
  const canvas = document.createElement('canvas'), measure = canvas.getContext('2d');
  measure.font = font;
  const label = text.toUpperCase(), w = Math.min(Math.round(sign.maxWidth * scale), Math.ceil(measure.measureText(label).width + h * 0.9));
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d'), hex = c => `#${c.toString(16).padStart(6, '0')}`;
  g.fillStyle = hex(multiplyTint(sign.panel, 0x9a9a9a)); g.fillRect(0, 0, w, h);
  g.fillStyle = hex(sign.panel); g.fillRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(h * 0.06, h * 0.06, w - h * 0.12, h * 0.18);
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = hex(sign.ink);
  g.fillText(label, w / 2, h * 0.54, w - h * 0.5);
  const texture = Texture.from(canvas);
  texture.areaArtWorldScale = 1 / scale;
  return texture;
}
// One shared soft ellipse for fog cards.
function defaultFogTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d'), gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)'); gradient.addColorStop(0.55, 'rgba(255,255,255,0.45)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 128, 128);
  return Texture.from(canvas);
}
const defaultReducedMotion = () => { try { return document.querySelector('#hmhRebootStage')?.dataset.settingReduceMotion === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };

export function createAreaArt({ world, areaId, plan, kit = null, loadTexture, textureCache = null, container = null, signal, resolution = 'full', fetchImpl = typeof fetch === 'function' ? fetch : null, createControlTexture = defaultControlTexture, terrainFieldSize = null, createTerrainProgram = defaultTerrainProgram, createProgram = createTerrainProgram, createSignTexture = defaultSignTexture, createFogTexture = defaultFogTexture, reducedMotion = defaultReducedMotion } = {}) {
  if (!world || typeof areaId !== 'string' || !plan) throw new TypeError('world, areaId and plan required');
  if (plan.areaId !== areaId) throw new TypeError(`plan ${plan.areaId} does not dress ${areaId}`);
  if (!['full', 'half'].includes(resolution)) throw new TypeError('resolution must be full or half');
  const cache = textureCache ?? createAreaArtTextureCache({ loadTexture });
  const ownsCache = !textureCache;
  const ratio = resolution === 'half' ? 0.5 : 1;
  let disposed = false, mounted = false, summary = null, manifest = kit, residency = null, depthLayer = container, groundLayer = null, shadowLayer = null;
  const owned = [], painted = [], frames = new Map(), tiles = new Map(), live = new Map(), solidNodes = [];
  let host = null, depthKey = y => y;
  let detailTexture = null, pageTextures = new Map(), controlTexture = null, terrainField = null, terrainMesh = null;
  const overlays = new Map();
  const signTextures = new Map(), fogCards = [];
  let fogTexture = null, fogFrame = 0, fogStatic = true;
  const tileFile = (tile, suffix = '') => ratio === 0.5 ? `${tile}${suffix}@0.5x.webp` : `${tile}${suffix}.png`;
  const acquire = async url => { const texture = await cache.acquire(url); owned.push(url); if (disposed) { cache.release(url); owned.pop(); return null; } return texture; };

  const ready = (async () => {
    try {
      if (!manifest) {
        if (!fetchImpl) throw new Error('kit manifest fetch unavailable');
        const response = await fetchImpl(AREA_ART_KIT_ROOT + AREA_ART_KIT_MANIFEST, { signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error(`area art kit manifest HTTP ${response.status}`);
        manifest = await response.json();
      }
      if (disposed) return;
      summary = validateAreaArtPlan(plan, manifest);
      const jobs = [];
      for (const image of summary.pages) {
        const page = manifest.pages.find(entry => entry.image === image);
        const file = ratio === 0.5 ? page.halfRes.image : page.image;
        jobs.push(acquire(AREA_ART_KIT_ROOT + file).then(texture => {
          if (!texture) return;
          const expected = { width: page.width * ratio, height: page.height * ratio };
          if (texture.source.pixelWidth !== expected.width || texture.source.pixelHeight !== expected.height) throw new Error(`kit page ${file} decoded ${texture.source.pixelWidth}x${texture.source.pixelHeight}, expected ${expected.width}x${expected.height}`);
          pageTextures.set(image, texture);
        }));
      }
      for (const tile of summary.tiles) {
        jobs.push(acquire(AREA_ART_TILE_ROOT + tileFile(tile)).then(texture => { if (texture) { texture.source.style.addressMode = 'repeat'; texture.source.style.update(); tiles.set(tile, texture); } }));
        jobs.push(acquire(AREA_ART_TILE_ROOT + tileFile(tile, '-fringe')).then(texture => { if (texture) { texture.source.style.addressMode = 'repeat'; texture.source.style.update(); tiles.set(`${tile}-fringe`, texture); } }));
      }
      for (const overlay of summary.overlays) jobs.push(acquire(AREA_ART_TILE_ROOT + tileFile(overlay)).then(texture => { if (texture) { texture.source.style.addressMode = 'repeat'; texture.source.style.update(); overlays.set(overlay, texture); } }));
      if (summary.terrain) {
        terrainField = buildTerrainField({ summary, world, size: terrainFieldSize ?? (ratio === 0.5 ? 256 : 384) });
        jobs.push(Promise.resolve(createControlTexture(terrainField)).then(result => { const pair = result && result.control ? result : result ? { control: result, light: result } : null; if (disposed) { pair?.control.destroy(true); if (pair && pair.light !== pair.control) pair.light.destroy(true); return; } controlTexture = pair; }));
      }
      if (summary.detailPage) jobs.push(acquire(AREA_ART_DETAIL_ROOT + AREA_ART_DETAIL_PAGE).then(texture => { detailTexture = texture; }));
      const results = await Promise.allSettled(jobs);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    } catch (error) { if (!disposed) { dispose(); } throw error; }
  })();

  const frameFor = assetId => {
    let entry = frames.get(assetId);
    if (entry) return entry;
    const item = resolveKitItem(manifest, assetId), page = pageTextures.get(item.pageImage);
    if (!page) throw new Error(`kit page for ${assetId} is not resident`);
    const f = item.frame;
    const texture = new Texture({ source: page.source, frame: new Rectangle(f.x * ratio, f.y * ratio, f.w * ratio, f.h * ratio) });
    entry = { item, texture, alphaHeight: item.alphaBounds.h * ratio, alphaWidth: item.alphaBounds.w * ratio, anchor: item.anchor };
    frames.set(assetId, entry);
    return entry;
  };
  const tintFor = (assetId, tint = 0xffffff) => FOLIAGE_TINT_RULES[assetId] ? multiplyTint(tint, FOLIAGE_TINT_RULES[assetId]) : tint;

  // A kit card standing on the ground at (x, y - groundZ), `height` world units
  // tall from its painted base to its painted top. Returns { node, width }.
  function card(assetId, { x, y, height, groundZ = 0, tint = 0xffffff, flip = false, widthScale = null }) {
    const entry = frameFor(assetId), scale = widthScale ?? height / entry.alphaHeight;
    const sprite = new Sprite({ texture: entry.texture });
    sprite.anchor.set(entry.anchor.x, entry.anchor.y);
    sprite.position.set(x, y - groundZ);
    sprite.scale.set(flip ? -scale : scale, widthScale ? height / entry.alphaHeight : scale);
    sprite.tint = tintFor(assetId, tint);
    return { node: sprite, width: entry.alphaWidth * Math.abs(sprite.scale.x), height: entry.alphaHeight * Math.abs(sprite.scale.y) };
  }
  function contactShadow(target, { x, y, width, depth, alpha = 0.34, ao = false }) {
    const g = new Graphics(), rx = Math.max(6, width * 0.5 * 1.1), ry = Math.max(3, (depth ?? width * 0.42) * 0.5);
    const cx = x + rx * SHADOW_LEAN.x, cy = y + ry * SHADOW_LEAN.y;
    if (ao) g.ellipse(cx, cy, rx * 1.45, ry * 1.45).fill({ color: SHADOW_TINT, alpha: alpha * 0.22 });
    g.ellipse(cx, cy, rx, ry).fill({ color: SHADOW_TINT, alpha: alpha * 0.34 });
    g.ellipse(cx, cy, rx * 0.72, ry * 0.72).fill({ color: SHADOW_TINT, alpha: alpha * 0.36 });
    g.ellipse(cx, cy, rx * 0.42, ry * 0.42).fill({ color: SHADOW_TINT, alpha: alpha * 0.4 });
    target.addChild(g);
    return g;
  }

  // ---- ground ----
  function materialFill(g, vertices, materialId, { tint = 0xffffff, alpha = 1 } = {}) {
    const m = AREA_ART_MATERIALS[materialId], texture = tiles.get(m.tile);
    const flat = vertices.flatMap(p => [p.x, p.y]);
    g.poly(flat).fill({ color: multiplyTint(m.base, tint), alpha });
    if (texture) g.poly(flat).fill({ texture, textureSpace: 'global', matrix: scaleMatrix(tileScale(texture, m.scale)), color: multiplyTint(m.tint, tint), alpha: m.alpha * alpha });
  }
  // Fringe strips along every edge, outward by `feather`, using the tile's own
  // 512x128 gradient so the edge dissolves with the material's grain.
  function fringe(g, vertices, materialId, feather, { tint = 0xffffff, alpha = 1 } = {}) {
    const m = AREA_ART_MATERIALS[materialId], texture = tiles.get(`${m.tile}-fringe`);
    if (!texture) return;
    const outer = offsetPolygon(vertices, feather), n = vertices.length;
    for (let i = 0; i < n; i++) {
      const a = vertices[i], b = vertices[(i + 1) % n], oa = outer[i], ob = outer[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const nx = oa.x - a.x, ny = oa.y - a.y, nlen = Math.hypot(nx, ny) || 1;
      const s = tileScale(texture, m.scale), fh = texture.source.pixelHeight || 128, matrix = { a: ux * s, b: uy * s, c: nx / nlen * (feather / fh), d: ny / nlen * (feather / fh), tx: a.x, ty: a.y };
      // Global texture space: the strip's own bounds must not rescale the gradient.
      g.poly([a.x, a.y, b.x, b.y, ob.x, ob.y, oa.x, oa.y]).fill({ texture, matrix, textureSpace: 'global', color: multiplyTint(m.tint, tint), alpha: Math.min(1, m.alpha + 0.15) * alpha });
    }
  }
  function paintZone(target, zone) {
    const g = new Graphics();
    fringe(g, zone.vertices, zone.material, zone.feather, zone);
    materialFill(g, zone.vertices, zone.material, zone);
    target.addChild(g); painted.push(g);
  }
  function paintTrails(target, trails) {
    if (!trails.length) return;
    const mask = new Graphics(), halo = new Graphics(), core = new Graphics();
    const boxes = [];
    for (const trail of trails) {
      const wide = ribbonPolygon(trail.points, trail.width + trail.halo * 2);
      mask.poly(wide.flatMap(p => [p.x, p.y])).fill(0xffffff);
      for (const p of trail.points) mask.circle(p.x, p.y, trail.width / 2 + trail.halo).fill(0xffffff);
      boxes.push(polygonBounds(wide));
    }
    const b = { minX: Math.min(...boxes.map(x => x.minX)), minY: Math.min(...boxes.map(x => x.minY)), maxX: Math.max(...boxes.map(x => x.maxX)), maxY: Math.max(...boxes.map(x => x.maxY)) };
    materialFill(halo, rectVertices(b), trails[0].material, { alpha: 0.22 });
    halo.mask = mask;
    for (const trail of trails) {
      materialFill(core, ribbonPolygon(trail.points, trail.width), trail.material);
      for (const p of trail.points.slice(1, -1)) { const m = AREA_ART_MATERIALS[trail.material], texture = tiles.get(m.tile); core.circle(p.x, p.y, trail.width / 2).fill({ texture, textureSpace: 'global', matrix: scaleMatrix(tileScale(texture, m.scale)), color: m.tint, alpha: 1 }); }
    }
    target.addChild(halo, mask, core); painted.push(halo, mask, core);
  }
  function offsetPolyline(points, distance) {
    if (points.length < 2) return points;
    const ribbon = ribbonPolygon(points, Math.abs(distance) * 2);
    return distance >= 0 ? ribbon.slice(0, points.length) : ribbon.slice(points.length).reverse();
  }
  const programFor = kind => { try { return createProgram(kind) ?? null; } catch { return null; } };
  const grainUniforms = (materialId, uniforms, resources, first) => {
    const m = AREA_ART_MATERIALS[materialId];
    const layers = [m.grain[0], m.grain[1] ?? { ...m.grain[0], gain: 0 }];
    for (let k = 0; k < 2; k++) {
      const layer = layers[k], texture = tiles.get(layer.tile), i = first + k;
      if (!texture) return false;
      uniforms[`uL${i}`] = { value: new Float32Array([1 / layer.size, layer.gain, layer.lum ? 1 : 0, layer.rot ? 1 : 0]), type: 'vec4<f32>' };
      uniforms[`uM${i}`] = { value: new Float32Array((AREA_ART_TILE_MEANS[layer.tile] ?? [128, 128, 128]).map(v => v / 255)), type: 'vec3<f32>' };
      resources[`uT${i}`] = texture.source; resources[`uT${i}Sampler`] = texture.source.style;
    }
    return true;
  };
  // Mitered strip around the polyline with (lateral, along) per vertex.
  function roadGeometry(points, half) {
    const ribbon = ribbonPolygon(points, half * 2), n = points.length, left = ribbon.slice(0, n), right = ribbon.slice(n).reverse();
    const position = new Float32Array(n * 4), road = new Float32Array(n * 4), index = new Uint32Array((n - 1) * 6);
    let along = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) along += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      position.set([left[i].x, left[i].y, right[i].x, right[i].y], i * 4); road.set([half, along, -half, along], i * 4);
      if (i < n - 1) index.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
    }
    return { geometry: new Geometry({ attributes: { aPosition: { buffer: position, format: 'float32x2' }, aRoad: { buffer: road, format: 'float32x2' } }, indexBuffer: index }), length: along };
  }
  function paintRoadMesh(target, road) {
    const recipe = ROAD_RECIPES[road.kind], glProgram = programFor('road');
    if (!glProgram) return false;
    const uniforms = {}, resources = {};
    if (!grainUniforms(recipe.core, uniforms, resources, 0) || !grainUniforms(recipe.shoulder, uniforms, resources, 2)) return false;
    const half = road.width / 2, coreHalf = half * recipe.coreFraction, outer = half + recipe.shoulderOut;
    const { geometry, length } = roadGeometry(road.points, outer + 80);
    uniforms.uCore = { value: new Float32Array(rgb(AREA_ART_MATERIALS[recipe.core].color)), type: 'vec3<f32>' };
    uniforms.uShoulder = { value: new Float32Array(rgb(AREA_ART_MATERIALS[recipe.shoulder].color)), type: 'vec3<f32>' };
    uniforms.uShape = { value: new Float32Array([coreHalf, outer, length, recipe.rank]), type: 'vec4<f32>' };
    uniforms.uWear = { value: new Float32Array([recipe.rutOffset, recipe.rutAlpha, recipe.centreLine ? 1 : 0, recipe.shoulderAlpha]), type: 'vec4<f32>' };
    resources.roadUniforms = new UniformGroup(uniforms);
    const mesh = new Mesh({ geometry, shader: new Shader({ glProgram, resources }), texture: tiles.get(AREA_ART_MATERIALS[recipe.core].grain[0].tile) });
    mesh.label = `area-road-${road.roadId}`;
    target.addChild(mesh); painted.push(mesh);
    return true;
  }
  function paintRoadCracks(target, road) {
    const recipe = ROAD_RECIPES[road.kind];
    if (recipe.cracks && road.cracks.length) for (const crack of road.cracks) {
      const { node } = card('b2-47', { x: crack.x, y: crack.y, height: road.width * 0.24 * crack.scale, tint: 0x8e918d, flip: crack.flip });
      node.alpha = 0.38; target.addChild(node); painted.push(node);
    }
  }
  function paintRoad(target, road, cracks = true) {
    if (paintRoadMesh(target, road)) { if (cracks) paintRoadCracks(target, road); return; }
    const recipe = ROAD_RECIPES[road.kind], g = new Graphics();
    const haloWidth = road.width + recipe.shoulderWidth * 2 + recipe.haloWidth * 2;
    materialFill(g, ribbonPolygon(road.points, haloWidth), recipe.shoulder, { alpha: recipe.haloAlpha * 0.5 });
    materialFill(g, ribbonPolygon(road.points, road.width + recipe.shoulderWidth * 2 + recipe.haloWidth), recipe.shoulder, { alpha: recipe.haloAlpha });
    materialFill(g, ribbonPolygon(road.points, road.width + recipe.shoulderWidth * 2), recipe.shoulder);
    materialFill(g, ribbonPolygon(road.points, road.width), recipe.core);
    const wear = new Graphics();
    if (recipe.tracks > 0) for (const side of [-0.22, 0.22]) wear.poly(ribbonPolygon(offsetPolyline(road.points, road.width * side), road.width * 0.13).flatMap(p => [p.x, p.y])).fill({ color: 0x1a1d1c, alpha: recipe.tracks });
    if (recipe.ruts) for (const side of [-0.18, 0.18]) wear.poly(ribbonPolygon(offsetPolyline(road.points, road.width * side), Math.max(10, road.width * 0.05)).flatMap(p => [p.x, p.y])).fill({ color: 0x2b2216, alpha: 0.26 });
    target.addChild(g, wear); painted.push(g, wear);
    if (cracks) paintRoadCracks(target, road);
  }
  // Overlaps resolve dirt under gravel under paved; cracks go on top of all cores.
  const roadsByRank = () => [...summary.roads].sort((a, b) => ROAD_RECIPES[a.kind].rank - ROAD_RECIPES[b.kind].rank);
  function paintDecals(target, decals) {
    if (!decals.length || !detailTexture) return;
    const textures = new Map();
    for (const decal of decals) {
      const spec = DETAIL_FRAMES[decal.source];
      let texture = textures.get(decal.source);
      if (!texture) { texture = new Texture({ source: detailTexture.source, frame: new Rectangle(spec.x, spec.y, spec.w, spec.h) }); textures.set(decal.source, texture); painted.push({ removeFromParent() {}, destroy: () => texture.destroy(false) }); }
      const sprite = new Sprite({ texture });
      sprite.anchor.set(spec.anchor.x, spec.anchor.y); sprite.position.set(decal.x, decal.y);
      sprite.scale.set((decal.flip ? -1 : 1) * spec.scale * decal.scale, spec.scale * decal.scale); sprite.rotation = decal.rotation; sprite.alpha = decal.alpha; sprite.tint = decal.tint;
      target.addChild(sprite); painted.push(sprite);
    }
  }
  // One quad per area through the splat shader: three materials blended by
  // the control field, broad value variation and the light channel (AO under
  // masses and canopies, dust along roads). Zones and trails whose material is
  // one of the area's three are rasterised into the field, so no hard
  // polygon edge is painted for them.
  function paintTerrain(target) {
    const t = summary.terrain;
    if (!t || !controlTexture || !terrainField) return false;
    const materials = [0, 1, 2].map(i => AREA_ART_MATERIALS[t.materials[Math.min(i, t.materials.length - 1)]]).concat([0, 1].map(i => AREA_ART_MATERIALS[t.extras?.[i] ?? t.materials[0]]));
    const layers = materials.flatMap(m => [m.grain[0], m.grain[1] ?? { ...m.grain[0], gain: 0 }]);
    if (layers.some(layer => !tiles.get(layer.tile))) return false;
    let glProgram = null;
    try { glProgram = createProgram('terrain'); } catch { glProgram = null; }
    if (!glProgram) return false;
    const uniforms = { uField: { value: new Float32Array([terrainField.minX, terrainField.minY, 1 / (terrainField.maxX - terrainField.minX), 1 / (terrainField.maxY - terrainField.minY)]), type: 'vec4<f32>' }, uParams: { value: new Float32Array([t.value, TERRAIN_LIGHT_RANGE.low, TERRAIN_LIGHT_RANGE.high, t.materials.length > 1 ? 0.35 : 0]), type: 'vec4<f32>' } };
    const resources = { terrainUniforms: null, uControl: controlTexture.control.source, uControlSampler: controlTexture.control.source.style, uLight: controlTexture.light.source, uLightSampler: controlTexture.light.source.style };
    layers.forEach((layer, i) => {
      const texture = tiles.get(layer.tile), mean = AREA_ART_TILE_MEANS[layer.tile] ?? [128, 128, 128];
      uniforms[`uL${i}`] = { value: new Float32Array([1 / layer.size, layer.gain, layer.lum ? 1 : 0, layer.rot ? 1 : 0]), type: 'vec4<f32>' };
      uniforms[`uM${i}`] = { value: new Float32Array(mean.map(v => v / 255)), type: 'vec3<f32>' };
      resources[`uT${i}`] = texture.source; resources[`uT${i}Sampler`] = texture.source.style;
    });
    materials.forEach((m, i) => { uniforms[`uC${i}`] = { value: new Float32Array(rgb(m.color)), type: 'vec3<f32>' }; });
    // The accent slot is empty when a plan lists two materials: its weight
    // channel stays zero in the field, so the duplicate never shows.
    if (t.materials.length < 3) uniforms.uC2 = uniforms.uC1;
    // Unused extra slots keep a zero weight channel, so their duplicate grain never shows.
    resources.terrainUniforms = new UniformGroup(uniforms);
    const b = summary.bounds;
    const geometry = new Geometry({ attributes: { aPosition: { buffer: new Float32Array([b.minX, b.minY, b.maxX, b.minY, b.maxX, b.maxY, b.minX, b.maxY]), format: 'float32x2' } }, indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]) });
    const shader = new Shader({ glProgram, resources });
    terrainMesh = new Mesh({ geometry, shader, texture: controlTexture.control });
    terrainMesh.label = `area-terrain-${areaId}`;
    target.addChild(terrainMesh); painted.push(terrainMesh);
    return true;
  }
  function signPanel(sign) {
    let texture = signTextures.get(sign.id);
    if (texture === undefined) { try { texture = createSignTexture(sign.text, sign) ?? null; } catch { texture = null; } signTextures.set(sign.id, texture); }
    if (!texture) return null;
    const sprite = new Sprite({ texture }), unit = texture.areaArtWorldScale ?? sign.height / (texture.height || 1);
    sprite.anchor.set(0.5, 1); sprite.scale.set(unit); sprite.label = `area-sign-${sign.id}`;
    return sprite;
  }
  function paintFog(target) {
    if (!summary.fog?.length) return;
    if (!fogTexture) { try { fogTexture = createFogTexture() ?? null; } catch { fogTexture = null; } }
    if (!fogTexture) return;
    for (const card of summary.fog) {
      const sprite = new Sprite({ texture: fogTexture });
      sprite.anchor.set(0.5); sprite.position.set(card.x, card.y);
      sprite.scale.set(card.rx * 2 / (fogTexture.width || 128), card.ry * 2 / (fogTexture.height || 128));
      sprite.alpha = card.alpha; sprite.tint = card.tint; sprite.label = `area-fog-${card.id}`;
      target.addChild(sprite); painted.push(sprite); fogCards.push({ sprite, card, phase: stableUnit(card.id) * Math.PI * 2 });
    }
  }
  function paintAreaGround(target) {
    const splat = paintTerrain(target);
    if (!splat && summary.base) { const g = new Graphics(); materialFill(g, rectVertices(summary.bounds), summary.base.material, summary.base); target.addChild(g); painted.push(g); }
    if (!splat) for (const zone of summary.zones) paintZone(target, zone);
    if (!splat) paintTrails(target, summary.trails);
    paintDecals(target, summary.decals);
    paintFog(target);
  }
  const claimsSurface = surfaceId => Boolean(summary) && (summary.base?.surfaceId === surfaceId || summary.roads.some(road => road.surfaceIds.includes(surfaceId)));
  // Scene hook: the ground painter walks surfaces in priority order and hands
  // each one here first. Area floors paint the whole area; a road paints once,
  // on its first authored segment, and claims its remaining segments/joins.
  function paintSurface({ target, surface }) {
    if (disposed || !summary || !claimsSurface(surface.id)) return false;
    groundLayer = target;
    if (summary.base?.surfaceId === surface.id) { paintAreaGround(target); return true; }
    const road = summary.roads.find(entry => entry.surfaceIds[0] === surface.id);
    if (road) paintRoad(target, road);
    return true;
  }
  function paintGround(target) { if (disposed || !summary) return; groundLayer = target; paintAreaGround(target); const roads = roadsByRank(); for (const road of roads) paintRoad(target, road, false); for (const road of roads) paintRoadCracks(target, road); }

  // ---- solids ----
  const surfaceShaders = new Map();
  // Ragged rock edge from world-space noise, so the many thin closed-mass
  // strips that share a straight run break it up continuously. Mostly
  // outward (-8..+26 units) so the art never sits well inside the collider.
  const rockPush = (x, y) => -8 + 34 * (0.7 * valueNoise(x, y, 95, 9173) + 0.3 * valueNoise(x, y, 31, 9181));
  function raggedOutline(vertices) {
    const n = vertices.length, out = [], starts = [];
    let area = 0; for (let i = 0; i < n; i++) { const p = vertices[i], q = vertices[(i + 1) % n]; area += p.x * q.y - q.x * p.y; }
    const sign = area >= 0 ? 1 : -1;
    const normal = (a, c) => { const dx = c.x - a.x, dy = c.y - a.y, len = Math.hypot(dx, dy) || 1; return { x: dy / len * sign, y: -dx / len * sign }; };
    for (let i = 0; i < n; i++) {
      const prev = vertices[(i + n - 1) % n], a = vertices[i], c = vertices[(i + 1) % n], n0 = normal(prev, a), n1 = normal(a, c);
      let bx = n0.x + n1.x, by = n0.y + n1.y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
      const corner = rockPush(a.x, a.y);
      starts.push(out.length); out.push({ x: a.x + bx * corner, y: a.y + by * corner });
      const dx = c.x - a.x, dy = c.y - a.y, steps = Math.max(1, Math.round(Math.hypot(dx, dy) / 40));
      for (let k = 1; k < steps; k++) {
        const t = k / steps, px = a.x + dx * t, py = a.y + dy * t, push = rockPush(px, py);
        out.push({ x: px + n1.x * push, y: py + n1.y * push });
      }
    }
    out.starts = starts;
    return out;
  }
  // Roof triangles: the authored outline triangulated once, plus a fan from
  // each authored corner to the ragged points along its edge (cheap for the
  // long closed-mass runs, which carry hundreds of ragged points).
  function roofIndices(outline, ragged) {
    const base = triangulatePolygon(outline);
    if (!ragged.starts) return { positions: outline, indices: base };
    const n = outline.length, offset = n, indices = [...base];
    for (let i = 0; i < n; i++) {
      const from = ragged.starts[i], to = i + 1 < n ? ragged.starts[i + 1] : ragged.length;
      const run = []; for (let k = from; k < to; k++) run.push(offset + k); run.push(offset + (i + 1 < n ? ragged.starts[i + 1] : ragged.starts[0]));
      for (let k = 0; k + 1 < run.length; k++) indices.push(i, run[k], run[k + 1]);
    }
    return { positions: [...outline, ...ragged], indices };
  }
  function surfaceMesh(outline, ragged, materialId, tint, rocky) {
    const glProgram = programFor('surface');
    if (!glProgram) return null;
    const { positions: vertices, indices } = roofIndices(outline, ragged);
    if (!indices.length) return null;
    const key = `${materialId}:${tint}:${rocky}`;
    let shader = surfaceShaders.get(key);
    if (!shader) {
      const uniforms = {}, resources = {};
      if (!grainUniforms(materialId, uniforms, resources, 0)) return null;
      uniforms.uBase = { value: new Float32Array(rgb(multiplyTint(AREA_ART_MATERIALS[materialId].color, tint))), type: 'vec3<f32>' };
      uniforms.uSurface = { value: new Float32Array([rocky ? 0.34 : 0.18, rocky ? 0.22 : 0.08, rocky && materialId === 'rock' ? 0.55 : 0, 0]), type: 'vec4<f32>' };
      uniforms.uMoss = { value: new Float32Array(rgb(0x5b6650)), type: 'vec3<f32>' };
      resources.surfaceUniforms = new UniformGroup(uniforms);
      shader = new Shader({ glProgram, resources }); surfaceShaders.set(key, shader);
    }
    const geometry = new Geometry({ attributes: { aPosition: { buffer: new Float32Array(vertices.flatMap(p => [p.x, p.y])), format: 'float32x2' } }, indexBuffer: new Uint32Array(indices) });
    const mesh = new Mesh({ geometry, shader, texture: tiles.get(AREA_ART_MATERIALS[materialId].grain[0].tile) });
    mesh.label = 'area-solid-roof';
    return mesh;
  }
  function createSolid(piece) {
    if (disposed || !summary) return null;
    const solid = summary.solids.find(entry => entry.pieceId === piece.id);
    if (!solid) return null;
    const b = piece.visible.bounds, w = b.maxX - b.minX, d = b.maxY - b.minY, h = solid.height ?? piece.visible.height, cx = (b.minX + b.maxX) / 2;
    const outline = piece.visible.vertices ?? rectVertices(b);
    const rockyOutline = ['bank'].includes(solid.style) || (solid.style === 'mass' && !solid.wall);
    // Rock outlines are authored as straight runs; break them into a ragged
    // edge (mostly outward, so art never sits well inside the collider).
    const vertices = rockyOutline ? raggedOutline(outline) : outline, roof = vertices.map(p => ({ x: p.x, y: p.y - h }));
    const node = new Container(); node.areaArtDecorated = true;
    const timber = multiplyTint(0x6b5c48, solid.tint), dark = multiplyTint(0x3f3629, solid.tint), pale = multiplyTint(0xd8d5c6, solid.tint);
    if (solid.style !== 'hedge' && solid.style !== 'pickets') contactShadow(node, { x: cx, y: b.maxY - d * 0.5, width: w * 0.9, depth: d * 0.9, alpha: 0.16, ao: false });
    if (solid.massAlpha > 0) {
      const mass = new Container(), faces = new Graphics(), lips = new Graphics(), rockFace = overlays.get('rock-face') ?? null, wallMaterial = solid.wall ?? null;
      const rocky = solid.style === 'bank' || (solid.style === 'mass' && !wallMaterial);
      const roofMaterial = solid.roof ?? (rocky ? 'rock' : 'slate');
      // Roof through the grain shader (Graphics tile fill only as a fallback).
      const roofOutline = outline.map(p => ({ x: p.x, y: p.y - h })), raggedRoof = roof; raggedRoof.starts = vertices.starts;
      const roofMesh = surfaceMesh(roofOutline, vertices.starts ? raggedRoof : roofOutline, roofMaterial, solid.tint, rocky);
      if (roofMesh) mass.addChild(roofMesh); else { const flat = new Graphics(); materialFill(flat, roof, roofMaterial, { tint: solid.tint }); mass.addChild(flat); }
      // Faces only on edges whose outward normal points down the screen
      // (toward the camera); back and side edges leave the roof's lip.
      for (let i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length, a = vertices[i], c = vertices[j];
        const dx = c.x - a.x, dy = c.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        let nx = uy, ny = -ux; const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
        if (pointInPolygon(mx + nx * 2, my + ny * 2, vertices)) { nx = -nx; ny = -ny; }
        const ra = roof[i], rc = roof[j];
        if (ny <= 0.12) { if (ny < -0.3) lips.moveTo(ra.x, ra.y).lineTo(rc.x, rc.y).stroke({ color: SHADOW_TINT, width: 3, alpha: 0.3 }); continue; }
        const quad = [a, c, rc, ra], flat = quad.flatMap(p => [p.x, p.y]);
        // Upper-left key: faces turned toward the left catch more light.
        // Shade from the authored edge, not the ragged segment, so a run of
        // jogs never reads as vertical stripes.
        const edgeIndex = vertices.starts ? Math.max(0, vertices.starts.findLastIndex(start => start <= i)) : i;
        const oa = outline[edgeIndex], oc = outline[(edgeIndex + 1) % outline.length], ol = Math.hypot(oc.x - oa.x, oc.y - oa.y) || 1;
        let enx = (oc.y - oa.y) / ol, eny = -(oc.x - oa.x) / ol; if (enx * nx + eny * ny < 0) { enx = -enx; eny = -eny; }
        const lit = Math.min(1, 0.78 + 0.22 * Math.max(0, -enx) + 0.1 * Math.max(0, eny)), shade = Math.round(lit * 255) * 0x010101;
        if (rocky && rockFace) {
          const s = 260 / (rockFace.source.pixelWidth || 512), fh = rockFace.source.pixelHeight || 128;
          // World-continuous u along x (the strip never restarts per segment);
          // v runs from the lip to the foot along this segment's slope.
          const slope = Math.abs(dx) > len * 0.3 ? dy / dx : null;
          const matrix = slope === null ? { a: ux * s, b: uy * s, c: 0, d: h / fh, tx: a.x, ty: a.y - h } : { a: s, b: slope * s, c: 0, d: h / fh, tx: 0, ty: a.y - h - slope * a.x };
          faces.poly(flat).fill({ texture: rockFace, textureSpace: 'global', matrix, color: multiplyTint(solid.tint, shade) });
        } else materialFill(faces, quad, wallMaterial ?? 'dirt', { tint: multiplyTint(solid.tint, shade) });
        // Dark foot where the face meets the ground, lit lip along the top.
        const foot = Math.min(h * 0.22, 40);
        faces.poly([a.x, a.y - foot, c.x, c.y - foot, c.x, c.y, a.x, a.y]).fill({ color: SHADOW_TINT, alpha: 0.22 });
        faces.poly([a.x, a.y - foot * 0.45, c.x, c.y - foot * 0.45, c.x, c.y, a.x, a.y]).fill({ color: SHADOW_TINT, alpha: 0.2 });
        lips.moveTo(ra.x, ra.y).lineTo(rc.x, rc.y).stroke({ color: 0xd8d5c6, width: rocky ? 5 : 3, alpha: 0.22 + 0.2 * Math.max(0, -nx) });
      }
      mass.addChild(faces, lips);
      mass.alpha = solid.massAlpha; node.addChild(mass);
    }
    const facadeSign = summary.signs?.find(entry => entry.pieceId === piece.id);
    if (solid.style === 'card') {
      const entry = frameFor(solid.card.source);
      const scale = solid.card.fit === 'width' ? w / entry.alphaWidth : solid.card.fit === 'depth' ? d / entry.alphaWidth : (h + d * 0.45) / entry.alphaHeight;
      const { node: sprite } = card(solid.card.source, { x: cx, y: b.maxY, height: entry.alphaHeight * scale, groundZ: solid.card.lift, tint: solid.tint });
      node.addChild(sprite);
    } else if (solid.style === 'hedge') {
      const vertical = d > w, length = vertical ? d : w, spacing = solid.spacing || 120, count = Math.max(1, Math.ceil(length / spacing)), step = length / count;
      for (let i = 0; i < count; i++) {
        const x = vertical ? cx : b.minX + (i + 0.5) * step, y = vertical ? b.minY + (i + 1) * step : b.maxY;
        const entry = frameFor(solid.card.source), widthScale = (vertical ? Math.max(w, step * 0.9) : step * 1.12) / entry.alphaWidth;
        const { node: sprite } = card(solid.card.source, { x, y: Math.min(y, b.maxY), height: h + (vertical ? step * 0.35 : 0), tint: solid.tint, flip: i % 2 === 1, widthScale });
        contactShadow(node, { x, y: Math.min(y, b.maxY) - 4, width: vertical ? w : step, depth: vertical ? step * 0.4 : 30, alpha: 0.28 });
        node.addChild(sprite);
      }
    } else if (solid.style === 'stakes') {
      const g = new Graphics(), vertical = d > w, length = vertical ? d : w, step = solid.spacing || 26, count = Math.max(2, Math.round(length / step));
      if (vertical) g.poly([{ x: cx - w / 2, y: b.minY - h }, { x: cx + w / 2, y: b.minY - h }, { x: cx + w / 2, y: b.maxY - h }, { x: cx - w / 2, y: b.maxY - h }].flatMap(p => [p.x, p.y])).fill({ color: dark });
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count, wobble = ((i * 7) % 5) - 2, postW = (vertical ? w : step * 0.92) + wobble * 0.5, top = h + wobble * 2;
        const x = vertical ? cx : b.minX + t * length, y = vertical ? b.minY + t * length + step * 0.5 : b.maxY;
        g.rect(x - postW / 2, y - top, postW, top).fill({ color: i % 3 === 1 ? multiplyTint(timber, 0xe6dccf) : timber });
        g.rect(x - postW / 2, y - top, postW * 0.28, top).fill({ color: dark, alpha: 0.35 });
        g.poly([x - postW / 2, y - top, x, y - top - postW * 0.55, x + postW / 2, y - top]).fill({ color: multiplyTint(timber, 0xf0ebe0) });
      }
      if (!vertical) g.rect(b.minX, b.maxY - h * 0.62, w, 6).fill({ color: dark, alpha: 0.55 });
      node.addChild(g);
    } else if (solid.style === 'crates') {
      const g = new Graphics(), box = Math.min(64, Math.max(40, d * 0.7)), cols = Math.max(1, Math.floor(w / box)), start = cx - cols * box / 2;
      const drawBox = (x, y, size, height, tint) => { g.rect(x, y - height, size, height).fill({ color: tint }); g.poly([x, y - height, x + size, y - height, x + size - 6, y - height - size * 0.3, x - 6, y - height - size * 0.3]).fill({ color: multiplyTint(tint, 0xf2ede4) }); g.rect(x, y - height, size, height).stroke({ color: dark, width: 2, alpha: 0.6 }); g.rect(x + size * 0.12, y - height * 0.6, size * 0.76, 4).fill({ color: dark, alpha: 0.35 }); };
      for (let i = 0; i < cols; i++) drawBox(start + i * box, b.maxY, box - 4, Math.min(h, box * 0.7), i % 2 ? timber : multiplyTint(timber, 0xd9cdb6));
      for (let i = 0; i < Math.max(0, cols - 1); i += 2) drawBox(start + i * box + box * 0.5, b.maxY - Math.min(h, box * 0.7) - 2, box - 8, Math.max(12, h - Math.min(h, box * 0.7) - 4), multiplyTint(timber, 0xe8e0d0));
      node.addChild(g);
    } else if (solid.style === 'pickets') {
      const g = new Graphics(), vertical = d > w, length = vertical ? d : w, step = solid.spacing || 16, count = Math.max(2, Math.round(length / step)), slat = step * 0.5;
      const railY = vertical ? null : b.maxY;
      if (!vertical) { g.rect(b.minX, railY - h * 0.72, w, 4).fill({ color: pale, alpha: 0.9 }); g.rect(b.minX, railY - h * 0.3, w, 4).fill({ color: pale, alpha: 0.9 }); }
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count, x = vertical ? cx : b.minX + t * length, y = vertical ? b.minY + t * length + step * 0.4 : b.maxY, top = h - ((i * 5) % 3);
        g.rect(x - slat / 2, y - top, slat, top).fill({ color: i % 4 === 2 ? multiplyTint(pale, 0xd8d3c8) : pale });
        g.poly([x - slat / 2, y - top, x, y - top - slat * 0.7, x + slat / 2, y - top]).fill({ color: pale });
        g.rect(x - slat / 2, y - top, slat * 0.3, top).fill({ color: dark, alpha: 0.22 });
        if (vertical && i % 2 === 0) g.rect(x - w / 2, y - top * 0.5, w, 3).fill({ color: pale, alpha: 0.8 });
      }
      node.addChild(g);
    }
    if (facadeSign) { const panel = signPanel(facadeSign); if (panel) { panel.position.set(cx, b.maxY - Math.min(h, 260) * facadeSign.anchor); node.addChild(panel); } }
    return node;
  }

  // ---- props via viewport residency ----
  // A depth node either becomes a child of the depth container (private scene)
  // or a child of `host` attached to a Pixi RenderLayer (real game).
  const admit = (node, y) => { node.zIndex = depthKey(y); if (host) { host.addChild(node); depthLayer.attach(node); } else depthLayer.addChild(node); };
  const evict = node => { if (host && !depthLayer.destroyed) depthLayer.detach(node); node.destroy({ children: true }); };
  function createProp(record) {
    const prop = summary.props[record.ordinal], node = new Container();
    const { node: sprite, width } = card(prop.source, prop);
    if (prop.shadow) contactShadow(node, { x: prop.x, y: prop.y - prop.groundZ, width: Math.min(width, prop.height * 1.6), alpha: prop.height > 150 ? 0.36 : 0.26, ao: prop.height > 150 });
    node.addChild(sprite); node.label = record.id;
    const sign = summary.signs?.find(entry => entry.propId === prop.id);
    if (sign) { const panel = signPanel(sign); if (panel) { panel.position.set(prop.x, prop.y - prop.groundZ - prop.height * sign.anchor); node.addChild(panel); } }
    admit(node, prop.y); live.set(record.id, { node, prop, width });
    return node;
  }
  // Real-game path: every decorated authored solid becomes one depth node. The
  // returned collision blocker ids let the host skip its own drawing of them.
  function mountSolids(pieces) {
    if (disposed || !summary) return [];
    const ids = [];
    for (const solid of summary.solids) {
      const piece = pieces.find(entry => entry.id === solid.pieceId);
      if (!piece?.blocker) continue;
      const node = createSolid(piece);
      if (!node) continue;
      const sb = piece.visible.bounds; node.terrainBounds = { minX: sb.minX - 40, minY: sb.minY - (solid.height ?? piece.visible.height) - 40, maxX: sb.maxX + 40, maxY: sb.maxY + 40 };
      node.label = `area-art-solid-${piece.id}`; admit(node, piece.visible.bounds.maxY); solidNodes.push(node); ids.push(piece.blocker.id);
    }
    return ids;
  }
  function mount(layer = depthLayer, ground = groundLayer, options = {}) {
    if (disposed || mounted || !summary) return;
    if (!layer) throw new TypeError('depth layer container required to mount area art');
    mounted = true; depthLayer = layer; groundLayer = ground; host = options.host ?? null; if (typeof options.depthKey === 'function') depthKey = options.depthKey;
    residency = createGreyboxPropResidency({
      catalog: summary.props.map(prop => { const entry = frameFor(prop.source), width = entry.alphaWidth * (prop.height / entry.alphaHeight); return { id: prop.id, areaId: summary.roadsPlan ? null : summary.areaId, bounds: { left: prop.x - width * 0.6, right: prop.x + width * 0.6, top: prop.y - prop.groundZ - prop.height * 1.1, bottom: prop.y - prop.groundZ + width * 0.3 } }; }),
      create: createProp, setVisible: (node, value) => { node.visible = value; }, destroy: node => { live.delete(node.label); evict(node); },
    });
  }
  function update(camera, view, actor = null) {
    if (!residency || disposed) return 0;
    // Fog drifts slowly side to side; reduced motion keeps every card still.
    if (fogCards.length && (fogFrame++ % 60 === 0)) fogStatic = Boolean(reducedMotion());
    for (const { sprite, card, phase } of fogCards) sprite.x = card.x + (fogStatic ? 0 : Math.sin(fogFrame * 0.004 + phase) * Math.min(40, card.rx * 0.12));
    const visible = residency.update({ camera, view });
    // Solids are static depth nodes; hide the ones outside the view so the
    // hundreds of closed masses cost nothing off screen.
    if (solidNodes.length && camera && view) {
      const zoom = camera.zoom || 1, hw = view.width / 2 / zoom + 120, hh = view.height / 2 / zoom + 120;
      const minX = camera.x - hw, maxX = camera.x + hw, minY = camera.y - hh, maxY = camera.y + hh;
      for (const node of solidNodes) { const b = node.terrainBounds; if (b) node.visible = !(b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY); }
    }
    if (actor) for (const { node, prop, width } of live.values()) node.alpha = prop.fade && Math.abs(actor.x - prop.x) < width * 0.42 && actor.y < prop.y && actor.y > prop.y - prop.height - prop.groundZ ? 0.38 : 1;
    return visible;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    try { residency?.dispose(); } catch {}
    for (const node of solidNodes) { try { evict(node); } catch {} } solidNodes.length = 0;
    for (const node of painted) { try { node.removeFromParent?.(); node.destroy?.({ children: true }); } catch {} } painted.length = 0;
    for (const entry of frames.values()) entry.texture.destroy(false); frames.clear(); live.clear();
    for (const url of owned) cache.release(url); owned.length = 0; tiles.clear(); overlays.clear(); pageTextures.clear(); detailTexture = null;
    for (const texture of signTextures.values()) { try { texture?.destroy(true); } catch {} } signTextures.clear(); fogCards.length = 0; try { fogTexture?.destroy(true); } catch {} fogTexture = null;
    try { controlTexture?.control.destroy(true); if (controlTexture && controlTexture.light !== controlTexture.control) controlTexture.light.destroy(true); } catch {} controlTexture = null; terrainMesh = null;
    if (ownsCache) cache.dispose();
  }
  const snapshot = () => Object.freeze({ artId: AREA_ART_ID, areaId, resolution, disposed, mounted, pages: summary?.pages ?? null, tiles: summary?.tiles ?? null, counts: summary?.counts ?? null, budget: summary?.budget ?? null, terrain: summary?.terrain ? Object.freeze({ materials: summary.terrain.materials, field: terrainField ? `${terrainField.width}x${terrainField.height}` : null, fieldBytes: terrainField ? terrainField.data.length : 0, splat: Boolean(terrainMesh), counts: terrainField?.counts ?? null }) : null, ownedUrls: Object.freeze([...owned].sort()), painted: painted.length, residency: residency?.snapshot() ?? null, runtimeAuthority: 'projection-only' });
  return Object.freeze({ artId: AREA_ART_ID, ready, plan, get summary() { return summary; }, claimsSurface, paintSurface, paintGround, createSolid, mountSolids, mount, update, dispose, snapshot, textureCache: cache });
}
