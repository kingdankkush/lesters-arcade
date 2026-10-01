// Water bodies, raised walkable surfaces (decks, ramps, bridges) and cliff-face
// variant weights for the ten-area area art. Pure geometry and GLSL sources;
// the renderer (world-v2-area-art.mjs) turns them into meshes. Projection
// only: everything here reads the authored world and never writes collision,
// navigation, spawning, RNG, progression or results. Lazy area-art chunk.
import { pointInPolygon, distanceToSegment, polygonBounds, rectVertices } from './world-v2-area-art-schema.mjs';
import { valueNoise } from './world-v2-terrain-field.mjs';

export const AREA_SURFACES_ID = 'world-v2-area-surfaces/v1';
// Shore field: signed distance to the waterline, `bank` units onto the land
// (wet-bank band) and `depth` units into the water (shallow to deep tint).
export const WATER_BANK = 56;
export const WATER_DEPTH = 199;
// Subdued green-grey water per area palette (bible section 4): never the
// cyan pickup band. `flow` is the drift direction and speed in units per second.
export const WATER_PALETTES = Object.freeze({
  'scrypt-bayou': Object.freeze({ shallow: 0x55634f, deep: 0x26383a, sky: 0x9aa9a2, foam: 0xc9cbbb, bank: 0x1d211a, flow: Object.freeze({ x: 0, y: 1, speed: 5 }) }),
  'hashwood-river': Object.freeze({ shallow: 0x5c7066, deep: 0x2a4547, sky: 0xa3b3b0, foam: 0xd8d5c6, bank: 0x1c2119, flow: Object.freeze({ x: 1, y: 0, speed: 18 }) }),
  default: Object.freeze({ shallow: 0x587068, deep: 0x2e4a4a, sky: 0xa3b3b0, foam: 0xd8d5c6, bank: 0x1d211b, flow: Object.freeze({ x: 1, y: 0, speed: 8 }) }),
});

// Deck/ramp/bridge material by district (bible: timber where the brief is
// wooden, masonry or concrete where it is built). `material` is an
// AREA_ART_MATERIALS id; `pattern` the surface joints in world units
// (staggered slabs); `along: 0` uses the plank tile itself, turned so the
// planks run across the travel direction.
export const RAISED_KITS = Object.freeze({
  timber: Object.freeze({ material: 'timber', base: 0x7d6a52, face: 0x5a4a38, rail: 0x4a3b2b, pattern: Object.freeze({ along: 0, across: 0, gap: 0 }) }),
  stone: Object.freeze({ material: 'masonry', base: 0x8a8a7e, face: 0x6a6a60, rail: 0x5c5c54, pattern: Object.freeze({ along: 46, across: 70, gap: 0.3 }) }),
  concrete: Object.freeze({ material: 'paving', base: 0x8e918a, face: 0x6c6f6a, rail: 0x4f5452, pattern: Object.freeze({ along: 120, across: 120, gap: 0.2 }) }),
});
export const RAISED_KIT_BY_AREA = Object.freeze({
  'mweb-meadows': 'timber', 'litecoin-city': 'concrete', 'halving-farms': 'timber', 'silver-coast': 'stone', 'scrypt-bayou': 'timber',
  'hashwood-river': 'stone', 'hollow-pines': 'stone', 'ledger-ridge': 'timber', 'fork-fortress': 'stone', 'rugpull-woods': 'timber',
});

function signedDistance(x, y, vertices) {
  let best = Infinity;
  for (let i = 0, n = vertices.length; i < n; i++) best = Math.min(best, distanceToSegment(x, y, vertices[i], vertices[(i + 1) % n]));
  return pointInPolygon(x, y, vertices) ? best : -best;
}
export const waterOutline = piece => (piece.visible.vertices ?? rectVertices(piece.visible.bounds)).map(({ x, y }) => ({ x, y }));

// R = signed distance to the waterline mapped from [-bank, depth] to 0..255
// (positive inside the water). Deterministic pure data; one byte per texel.
export function buildShoreField(vertices, { unitsPerTexel = 8, bank = WATER_BANK, depth = WATER_DEPTH } = {}) {
  const b = polygonBounds(vertices), minX = b.minX - bank, minY = b.minY - bank;
  const width = Math.max(2, Math.ceil((b.maxX + bank - minX) / unitsPerTexel)), height = Math.max(2, Math.ceil((b.maxY + bank - minY) / unitsPerTexel));
  const data = new Uint8Array(width * height), range = bank + depth;
  for (let j = 0; j < height; j++) {
    const y = minY + (j + 0.5) * unitsPerTexel;
    for (let i = 0; i < width; i++) {
      const x = minX + (i + 0.5) * unitsPerTexel, d = Math.max(-bank, Math.min(depth, signedDistance(x, y, vertices)));
      data[j * width + i] = Math.round((d + bank) / range * 255);
    }
  }
  return Object.freeze({ width, height, unitsPerTexel, minX, minY, maxX: minX + width * unitsPerTexel, maxY: minY + height * unitsPerTexel, bank, depth, data });
}

// ---- raised walkable surfaces ----
const RAISED_KINDS = new Set(['deck', 'ramp', 'bridge']);
export const isRaisedPiece = piece => RAISED_KINDS.has(piece.kind) && Boolean(piece.surface);
function heightAt(surface, b, x, y) {
  if (surface.kind !== 'ramp') return surface.groundZ;
  const t = surface.axis === 'y' ? (y - b.minY) / (b.maxY - b.minY) : (x - b.minX) / (b.maxX - b.minX);
  return surface.fromZ + (surface.toZ - surface.fromZ) * Math.max(0, Math.min(1, t));
}
const insideBounds = (b, x, y, pad = 0) => x >= b.minX - pad && x <= b.maxX + pad && y >= b.minY - pad && y <= b.maxY + pad;

// One record per raised piece of the area: top corners with authored heights,
// the camera-facing (south) face unless another raised surface continues it,
// rails along the long sides of a bridge, and a down-right cast shadow.
export function buildRaisedSurfaces(pieces, areaId) {
  const raised = pieces.filter(piece => piece.visible.areaId === areaId && isRaisedPiece(piece));
  const kitId = RAISED_KIT_BY_AREA[areaId] ?? 'timber';
  const zOf = (x, y, except) => { let z = null; for (const other of raised) { if (other === except) continue; const b = other.visible.bounds; if (insideBounds(b, x, y, 1)) z = Math.max(z ?? -Infinity, heightAt(other.surface, b, x, y)); } return z; };
  return raised.map(piece => {
    const b = piece.visible.bounds, s = piece.surface;
    const corners = rectVertices(b).map(p => ({ ...p, z: heightAt(s, b, p.x, p.y) }));
    const maxZ = Math.max(...corners.map(p => p.z));
    // Travel direction: a ramp climbs along its axis; a deck or bridge carries
    // traffic toward the ramps that touch it (north/south or east/west).
    let travel = s.kind === 'ramp' ? (s.axis === 'y' ? 'y' : 'x') : null;
    if (!travel) {
      const touching = raised.filter(other => other !== piece && other.kind === 'ramp');
      const ns = touching.some(other => { const o = other.visible.bounds; return Math.abs(o.maxY - b.minY) < 2 || Math.abs(o.minY - b.maxY) < 2; });
      const ew = touching.some(other => { const o = other.visible.bounds; return Math.abs(o.maxX - b.minX) < 2 || Math.abs(o.minX - b.maxX) < 2; });
      travel = ns && !ew ? 'y' : ew && !ns ? 'x' : (b.maxY - b.minY > b.maxX - b.minX ? 'y' : 'x');
    }
    // The south edge faces the camera. Skip the stretch another raised surface
    // continues at the same height (a ramp landing on a bridge).
    const faces = [];
    const sw = corners[3], se = corners[2], steps = Math.max(1, Math.round((se.x - sw.x) / 20));
    let run = null;
    for (let k = 0; k <= steps; k++) {
      const x = sw.x + (se.x - sw.x) * k / steps, z = heightAt(s, b, x, b.maxY), next = zOf(x, b.maxY + 6, piece);
      const open = z > 0.5 && (next === null || next < z - 1);
      if (open && !run) run = { a: { x, y: b.maxY, z } };
      if (run) run.c = { x, y: b.maxY, z };
      if ((!open || k === steps) && run) { if (run.c.x - run.a.x > 1) faces.push(run); run = null; }
    }
    const rails = [];
    if (piece.kind === 'bridge') {
      if (travel === 'y') rails.push({ a: { x: b.minX, y: b.minY, z: maxZ }, c: { x: b.minX, y: b.maxY, z: maxZ }, side: 'west' }, { a: { x: b.maxX, y: b.minY, z: maxZ }, c: { x: b.maxX, y: b.maxY, z: maxZ }, side: 'east' });
      else rails.push({ a: { x: b.minX, y: b.minY, z: maxZ }, c: { x: b.maxX, y: b.minY, z: maxZ }, side: 'north' }, { a: { x: b.minX, y: b.maxY, z: maxZ }, c: { x: b.maxX, y: b.maxY, z: maxZ }, side: 'south' });
    }
    // Upper-left key: the mass casts down-right onto the ground or water.
    const lean = { x: maxZ * 0.55, y: maxZ * 0.32 };
    const shadow = maxZ > 0.5 ? corners.map(p => ({ x: p.x + lean.x * (p.z / maxZ), y: p.y + lean.y * (p.z / maxZ) })) : null;
    return Object.freeze({ id: piece.id, kind: piece.kind, kit: kitId, travel, bounds: { ...b }, corners, maxZ, faces, rails, shadow });
  });
}

// Cliff-face variant weights at a world x: three samplings of the rock-face
// strip at incommensurate periods, blended by low-frequency hash noise, so the
// 260-unit repeat never lines up. Returns [wA, wB, wC] summing to 1.
export function rockFaceVariant(x, seed = 4721) {
  const b = Math.max(0, Math.min(1, (valueNoise(x, 0, 380, seed) - 0.3) / 0.4));
  const c = Math.max(0, Math.min(1, (valueNoise(x + 911, 0, 610, seed + 17) - 0.45) / 0.35)) * (1 - b * 0.5);
  const wB = b * (1 - c), wC = c;
  return [(1 - b) * (1 - c), wB, wC];
}

// Occlusion test for cliff faces: a face whose outside lies inside another
// solid of comparable height is a shared (hidden) edge and is not drawn.
export function createSolidOcclusionIndex(pieces, cell = 600) {
  const grid = new Map(), key = (i, j) => `${i},${j}`;
  const solids = pieces.filter(piece => piece.blocker && piece.visible.height > 30);
  for (const piece of solids) {
    const b = piece.visible.bounds;
    for (let i = Math.floor(b.minX / cell); i <= Math.floor(b.maxX / cell); i++) for (let j = Math.floor(b.minY / cell); j <= Math.floor(b.maxY / cell); j++) {
      const list = grid.get(key(i, j)); if (list) list.push(piece); else grid.set(key(i, j), [piece]);
    }
  }
  return Object.freeze({
    covered(x, y, height, self) {
      for (const piece of grid.get(key(Math.floor(x / cell), Math.floor(y / cell))) ?? []) {
        if (piece === self || piece.visible.height < height) continue;
        const b = piece.visible.bounds;
        if (insideBounds(b, x, y) && pointInPolygon(x, y, piece.blocker.shape.vertices)) return true;
      }
      return false;
    },
  });
}

// ---- GLSL ----
export const NOISE_GLSL = `
float hash2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm2(vec2 p) { return vnoise(p) * 0.62 + vnoise(p * 2.13 + 17.0) * 0.38; }`;
// Water: shore-field depth tint, two drifting ripple octaves (one on the
// half tier, frozen under reduced motion), a perturbed sky gradient, bank
// occlusion, a broken foam line at the waterline and a wet band on the land.
// Premultiplied out; opaque inside the water.
export const WATER_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vWorld;
out vec4 finalColor;
uniform sampler2D uShore;
uniform vec4 uField; uniform vec4 uWater; uniform vec4 uFlow;
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uBank;
uniform vec4 uColor; uniform vec4 uWorldColorAlpha;
${NOISE_GLSL}
// Quintic value noise on rotated lattices: no grid-aligned blocks in the
// lit wavelets.
float qnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y); }
const mat2 R1 = mat2(0.98, -0.2, 0.2, 0.98), R2 = mat2(0.96, 0.28, -0.28, 0.96);
// Wavelets in flow-aligned coordinates (along, across), stretched along the
// current and drifting with it.
float ripple(vec2 p, float t) {
  vec2 q = vec2(dot(p, uFlow.zw), dot(p, vec2(-uFlow.w, uFlow.z)));
  float drift = length(uFlow.xy) * 88.0 * t;
  float h = qnoise(R1 * vec2((q.x - drift) / 96.0, q.y / 38.0)) * 0.6 + qnoise(R2 * vec2((q.x - drift * 1.4) / 47.0, q.y / 21.0) + 7.0) * 0.4;
  if (uWater.y > 0.5) h = h * 0.75 + qnoise(R1 * vec2((q.x - drift * 2.0) / 21.0, q.y / 12.0) + vec2(5.0, 9.0)) * 0.25;
  return h;
}
void main() {
  float range = uWater.z + uWater.w;
  float sd = texture(uShore, (vWorld - uField.xy) * uField.zw).r * range - uWater.w;
  float d = sd + (fbm2(vWorld / 64.0 + 3.0) - 0.5) * 22.0;
  if (d < -uWater.w + 2.0) discard;
  if (d < 0.0) {
    float wet = smoothstep(-uWater.w, 0.0, d);
    float a = wet * wet * 0.55;
    finalColor = vec4(uBank * a, a) * uColor * uWorldColorAlpha;
    return;
  }
  float t = uWater.x;
  float h0 = ripple(vWorld, t), hx = ripple(vWorld + vec2(5.0, 0.0), t), hy = ripple(vWorld + vec2(0.0, 5.0), t);
  vec2 n = vec2(h0 - hx, h0 - hy) * 3.0;
  float depth = smoothstep(0.0, uWater.z, d);
  vec3 col = mix(uShallow, uDeep, depth);
  // Slow current streaks along the flow.
  vec2 q = vec2(dot(vWorld, uFlow.zw), dot(vWorld, vec2(-uFlow.w, uFlow.z)));
  col *= 0.95 + 0.08 * fbm2(vec2(q.x / 420.0 - t * 0.04, q.y / 70.0));
  // Wavelets lit from the upper-left key, shadowed on the far side.
  col *= 1.0 + clamp(-n.x * 0.55 - n.y * 0.75, -1.0, 1.0) * 0.3;
  // Sky reflection: broad gradient bent by the ripple normal, stronger in deep water.
  float sky = clamp(0.45 - n.y * 2.4 + n.x * 0.8 + (fbm2(vWorld / 900.0) - 0.5) * 0.7, 0.0, 1.0);
  col = mix(col, uSky, sky * (0.07 + 0.14 * depth));
  // Soft glints toward the upper-left key (full tier only).
  col += uSky * smoothstep(0.5, 0.95, -n.x * 0.8 - n.y * 0.6 + 0.35) * 0.07 * uWater.y;
  // Bank occlusion just inside the waterline.
  col *= 0.74 + 0.26 * smoothstep(0.0, 38.0, d);
  float foam = (1.0 - smoothstep(0.5, 7.0 + 7.0 * fbm2(vWorld / 40.0), d)) * (0.1 + 0.3 * smoothstep(0.5, 0.78, fbm2(vWorld / 15.0 + uFlow.xy * t * 3.0)));
  col = mix(col, uFoam, foam);
  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0) * uColor * uWorldColorAlpha;
}`;
// Raised surfaces: grain material with plank or slab joints, a worn rim, a
// slope gradient on ramps (low end darker); camera-facing faces with a lit lip
// and a dark foot. vSurf = (world x, world y or face height, slope/lip, kind).
export const RAISED_VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition; in vec4 aSurface;
uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
out vec2 vWorld; out vec4 vSurf;
void main() { vWorld = aSurface.xy; vSurf = aSurface; vec3 p = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0); gl_Position = vec4(p.xy, 0.0, 1.0); }`;
export const RAISED_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vWorld; in vec4 vSurf;
out vec4 finalColor;
uniform sampler2D uT0; uniform sampler2D uT1;
uniform vec4 uL0; uniform vec4 uL1; uniform vec3 uM0; uniform vec3 uM1;
uniform vec3 uBase; uniform vec3 uFace; uniform vec4 uPattern; uniform vec4 uRect; uniform vec4 uSlope;
uniform vec4 uColor; uniform vec4 uWorldColorAlpha;
${NOISE_GLSL}
vec3 grainAt(sampler2D t, vec4 p, vec3 mean, vec2 w) {
  vec2 uv = p.w > 0.5 ? vec2(-w.y, w.x) * p.x + vec2(0.37, 0.19) : w * p.x;
  vec3 s = texture(t, uv).rgb / mean;
  if (p.z > 0.5) s = vec3(dot(s, vec3(0.299, 0.587, 0.114)));
  return max(vec3(0.0), 1.0 + (s - 1.0) * p.y);
}
void main() {
  vec2 w = vSurf.xy;
  if (vSurf.w < 0.5) {
    float a = uPattern.w > 0.5 ? w.y : w.x, c = uPattern.w > 0.5 ? w.x : w.y;
    vec3 col = uBase * grainAt(uT0, uL0, uM0, w) * grainAt(uT1, uL1, uM1, w);
    float row = floor(a / max(uPattern.x, 1.0)), fa = fract(a / max(uPattern.x, 1.0));
    if (uPattern.x < 0.5) {
      col *= 0.94 + 0.12 * vnoise(vec2(c / 90.0, a / 33.0));
    } else if (uPattern.y < 0.5) {
      // Planks across the travel direction, butt joints staggered per plank.
      float seg = floor((c + hash2(vec2(row, 9.0)) * 240.0) / 240.0), fc = fract((c + hash2(vec2(row, 9.0)) * 240.0) / 240.0);
      float joint = smoothstep(0.0, 0.09, fa) * smoothstep(1.0, 0.91, fa) * smoothstep(0.0, 0.012, fc) * smoothstep(1.0, 0.988, fc);
      col *= (0.86 + 0.26 * hash2(vec2(row, seg))) * mix(1.0 - uPattern.z, 1.0, joint);
      col *= 0.92 + 0.16 * vnoise(vec2(c / 30.0, row * 3.1));
    } else {
      float off = mod(row, 2.0) * 0.5 * uPattern.y, fc = fract((c + off) / uPattern.y);
      float joint = smoothstep(0.0, 0.035, fa) * smoothstep(1.0, 0.965, fa) * smoothstep(0.0, 0.025, fc) * smoothstep(1.0, 0.975, fc);
      col *= (0.9 + 0.16 * hash2(vec2(row, floor((c + off) / uPattern.y)))) * mix(1.0 - uPattern.z, 1.0, joint);
    }
    // Worn rim, darker edge wear and a slope gradient (ramps: low end darker).
    float edge = min(min(w.x - uRect.x, uRect.z - w.x), min(w.y - uRect.y, uRect.w - w.y));
    col *= 0.78 + 0.22 * smoothstep(0.0, 9.0, edge);
    col *= 1.0 + (fbm2(w / 120.0) - 0.5) * 0.18;
    // Ramps: stronger low-to-high gradient and cleats across the slope.
    col *= uSlope.x > 0.5 ? mix(0.7, 1.05, vSurf.z) : 1.0;
    float cleat = uSlope.x * (1.0 - smoothstep(0.0, 0.14, fract((uSlope.y > 0.5 ? w.y : w.x) / 26.0)));
    col *= 1.0 - 0.28 * cleat;
    finalColor = vec4(clamp(col, 0.0, 1.0), 1.0) * uColor * uWorldColorAlpha;
  } else {
    // Face: vertical boards/blocks; vSurf.z is the distance from the lip in units, vSurf.y the face height.
    vec3 col = uFace * grainAt(uT0, uL0, uM0, vec2(w.y + vSurf.z, w.x).yx) * 0.9;
    float lip = vSurf.z, foot = w.y - vSurf.z;
    float boards = uPattern.y < 0.5 ? 1.0 : 0.0;
    float seam = 1.0 - smoothstep(0.0, 0.07, fract(w.x / mix(52.0, 30.0, boards)));
    float course = (1.0 - boards) * (1.0 - smoothstep(0.0, 0.12, fract(lip / 16.0)));
    col *= (1.0 - mix(0.2, 0.32, boards) * seam * step(0.5, uPattern.x)) * (1.0 - 0.18 * course) * (0.9 + 0.2 * hash2(vec2(floor(w.x / mix(52.0, 30.0, boards)), 4.0)));
    col = mix(col, uBase * 1.18, (1.0 - smoothstep(0.0, 4.5, lip)) * 0.75);
    col *= mix(0.5, 1.0, smoothstep(0.0, min(14.0, w.y * 0.6), foot));
    finalColor = vec4(clamp(col, 0.0, 1.0), 1.0) * uColor * uWorldColorAlpha;
  }
}`;
