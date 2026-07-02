import { deflateSync, inflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { LESTER_BLASTER_ENEMY_CATALOG } from '../apps/portal/src/arcade-core.mjs';

export const MASTER_PALETTE = Object.freeze([
  '#173B72', '#345D9D', '#4E82D8', '#8CB7FF',
  '#E8ECF2', '#C9D2DE', '#A8B4C4', '#5C6B80', '#2E3A4D',
  '#F1D37A', '#C9A34E', '#8C6724', '#4A3514',
  '#C9FF6A', '#7FE84A', '#3FAE3B', '#1F5C2E',
  '#FF78D1', '#E040A0', '#992B78', '#4B1844',
  '#0B0F1A', '#141A2A', '#222A3A', '#3A465C',
  '#F4F0D8', '#D8C28A', '#B07A3D', '#6A3D22',
].map(hexToRgb));

export const ISO_8_DIRECTIONS = Object.freeze([
  'south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west',
]);

export const ROLE_REQUIREMENTS = Object.freeze({
  hero: Object.freeze({ requiredStates: Object.freeze(['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'dash', 'hurt', 'death', 'victory']), requiredDirections: ISO_8_DIRECTIONS, minFramesByState: Object.freeze({ dash: 6, victory: 1, death: 6 }) }),
  enemy: Object.freeze({ requiredStates: Object.freeze(['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in']), requiredDirections: ISO_8_DIRECTIONS, minFramesByState: Object.freeze({ 'attack-tell': 4, death: 4, 'spawn-in': 6 }) }),
  miniboss: Object.freeze({ requiredStates: Object.freeze(['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in', 'enrage']), requiredDirections: ISO_8_DIRECTIONS, minFramesByState: Object.freeze({ 'attack-tell': 6, death: 6, 'spawn-in': 6, enrage: 6 }) }),
  boss: Object.freeze({ requiredStates: Object.freeze(['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in', 'special', 'phase-transition']), requiredDirections: ISO_8_DIRECTIONS, minFramesByState: Object.freeze({ 'attack-tell': 8, death: 8, 'spawn-in': 6, special: 6, 'phase-transition': 6 }) }),
});

const STATE_ALIASES = Object.freeze({
  walk: Object.freeze(['walk', 'run', 'skate', 'scurry', 'hover', 'float', 'bank', 'cloak']),
  run: Object.freeze(['run', 'walk', 'skate', 'scurry', 'dash-flank', 'panic-charge', 'bank']),
  attack: Object.freeze(['attack', 'shoot', 'melee', 'tax-pulse', 'tar-drop', 'laser-ping', 'dive', 'shockwave']),
  hit: Object.freeze(['hit', 'hurt', 'crack']),
  hurt: Object.freeze(['hurt', 'hit', 'crack']),
  death: Object.freeze(['death', 'pop', 'explode', 'crumple', 'shatter', 'wipeout', 'fade', 'cascade-collapse']),
  'attack-tell': Object.freeze(['attack-tell', 'tell', 'telegraph', 'snap-open', 'burrow']),
  'spawn-in': Object.freeze(['spawn-in', 'spawn', 'revive', 'unburrow']),
  victory: Object.freeze(['victory', 'levelup']),
  dash: Object.freeze(['dash', 'roll']),
});

const ACTOR_ROLE_OVERRIDES = Object.freeze({
  lester: 'hero',
  lilly: 'hero',
  'lit-commando': 'hero',
  'lit-valkyrie': 'hero',
  'plaza-warden': 'miniboss',
  'bridge-exploiter': 'miniboss',
  'the-obfuscator': 'miniboss',
  'warren-spear-rider': 'miniboss',
});

const TELL_FRAME_CONTRACTS = Object.freeze({
  'fud-goblin': 34,
  'gas-fee-wisp': 22,
  'paper-hand': 30,
  'claim-jumper': 42,
  'warren-spear-rider': 46,
  'gas-beast-tank': 42,
  'evil-banker-ranged': 42,
});

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return Object.freeze({
    hex: `#${clean.toLowerCase()}`,
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  });
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function nearestPaletteDistance(color, palette = MASTER_PALETTE) {
  let best = null;
  for (const swatch of palette) {
    const distance = Math.hypot(color.r - swatch.r, color.g - swatch.g, color.b - swatch.b);
    if (!best || distance < best.distance) best = { swatch, distance };
  }
  return best ?? { swatch: null, distance: Number.POSITIVE_INFINITY };
}

function pixelAlpha(frame, x, y) {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return 0;
  return frame.pixels[(y * frame.width + x) * 4 + 3] ?? 0;
}

function connectedOpaqueComponents(frame, { alphaThreshold = 40 } = {}) {
  const seen = new Uint8Array(frame.width * frame.height);
  const components = [];
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const start = y * frame.width + x;
      if (seen[start]) continue;
      seen[start] = 1;
      if (pixelAlpha(frame, x, y) <= alphaThreshold) continue;
      const queue = [start];
      let size = 0;
      const bbox = { minX: x, maxX: x, minY: y, maxY: y };
      while (queue.length) {
        const current = queue.pop();
        const cx = current % frame.width;
        const cy = Math.floor(current / frame.width);
        size += 1;
        bbox.minX = Math.min(bbox.minX, cx);
        bbox.maxX = Math.max(bbox.maxX, cx);
        bbox.minY = Math.min(bbox.minY, cy);
        bbox.maxY = Math.max(bbox.maxY, cy);
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          if (nx < 0 || ny < 0 || nx >= frame.width || ny >= frame.height) continue;
          const ni = ny * frame.width + nx;
          if (seen[ni]) continue;
          seen[ni] = 1;
          if (pixelAlpha(frame, nx, ny) > alphaThreshold) queue.push(ni);
        }
      }
      components.push({ size, bbox });
    }
  }
  return components.sort((a, b) => b.size - a.size);
}

export function analyzeTransparencyFrame(frame, options = {}) {
  const opaqueAlpha = options.opaqueAlpha ?? 200;
  const matteAlphaMin = options.matteAlphaMin ?? 1;
  const matteAlphaMax = options.matteAlphaMax ?? 40;
  const strayIslandPixelThreshold = options.strayIslandPixelThreshold ?? 2;
  const corners = [[0, 0], [frame.width - 1, 0], [0, frame.height - 1], [frame.width - 1, frame.height - 1]];
  const opaqueCornerCount = corners.filter(([x, y]) => pixelAlpha(frame, x, y) >= opaqueAlpha).length;

  let haloPixelCount = 0;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const alpha = pixelAlpha(frame, x, y);
      if (alpha < matteAlphaMin || alpha > matteAlphaMax) continue;
      const touchesTransparent = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => pixelAlpha(frame, nx, ny) === 0);
      if (touchesTransparent) haloPixelCount += 1;
    }
  }

  const components = connectedOpaqueComponents(frame);
  const strayIslandCount = components.slice(1).filter((component) => component.size > strayIslandPixelThreshold).length;
  const failures = [];
  if (opaqueCornerCount >= 3) failures.push('opaque-background-corners');
  if (haloPixelCount > 0) failures.push('matte-halo');
  if (strayIslandCount > 0) failures.push('stray-islands');
  return Object.freeze({
    status: failures.length ? 'fail' : 'pass',
    failures: Object.freeze(failures),
    opaqueCornerCount,
    haloPixelCount,
    strayIslandCount,
    componentCount: components.length,
  });
}

export function auditPaletteCompliance(frame, palette = MASTER_PALETTE, options = {}) {
  const distanceThreshold = options.distanceThreshold ?? 46;
  const maxOffPaletteRatio = options.maxOffPaletteRatio ?? 0.08;
  const alphaThreshold = options.alphaThreshold ?? 40;
  let opaqueCount = 0;
  let offPaletteCount = 0;
  const offenders = new Map();
  for (let i = 0; i < frame.pixels.length; i += 4) {
    const alpha = frame.pixels[i + 3];
    if (alpha <= alphaThreshold) continue;
    opaqueCount += 1;
    const color = { r: frame.pixels[i], g: frame.pixels[i + 1], b: frame.pixels[i + 2] };
    const nearest = nearestPaletteDistance(color, palette);
    if (nearest.distance > distanceThreshold) {
      offPaletteCount += 1;
      const hex = rgbToHex(color.r, color.g, color.b);
      const current = offenders.get(hex) ?? { hex, count: 0, nearest: nearest.swatch?.hex ?? null, distance: Number(nearest.distance.toFixed(2)) };
      current.count += 1;
      offenders.set(hex, current);
    }
  }
  const offPaletteRatio = opaqueCount ? offPaletteCount / opaqueCount : 0;
  return Object.freeze({
    status: offPaletteRatio > maxOffPaletteRatio ? 'fail' : 'pass',
    opaqueCount,
    offPaletteCount,
    offPaletteRatio: Number(offPaletteRatio.toFixed(4)),
    offendingHexes: Object.freeze([...offenders.values()].sort((a, b) => b.count - a.count).slice(0, 8)),
  });
}

export function estimateFootContactPoint(frame, { alphaThreshold = 40 } = {}) {
  for (let y = frame.height - 1; y >= 0; y -= 1) {
    const xs = [];
    for (let x = 0; x < frame.width; x += 1) {
      if (pixelAlpha(frame, x, y) > alphaThreshold) xs.push(x);
    }
    if (xs.length) {
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y };
    }
  }
  return null;
}

export function auditPivotStability(frames, { maxVariancePx = 1.5 } = {}) {
  const points = frames.map((frame) => estimateFootContactPoint(frame)).filter(Boolean);
  if (points.length < 2) return Object.freeze({ status: 'warn', reason: 'not-enough-frames', maxDelta: 0, points });
  const avg = points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 });
  const maxDelta = Math.max(...points.map((point) => Math.hypot(point.x - avg.x, point.y - avg.y)));
  return Object.freeze({ status: maxDelta <= maxVariancePx ? 'pass' : 'fail', maxDelta: Number(maxDelta.toFixed(3)), points: Object.freeze(points) });
}

function stateCandidates(state) {
  return STATE_ALIASES[state] ?? [state];
}

function directionMapForState(actor, state) {
  const animations = actor?.animations ?? {};
  for (const candidate of stateCandidates(state)) {
    if (animations[candidate]) return { state: candidate, directions: animations[candidate] };
  }
  return { state: null, directions: null };
}

export function auditCompleteness(actor, requirements) {
  const requiredStates = requirements.requiredStates ?? [];
  const requiredDirections = requirements.requiredDirections ?? ISO_8_DIRECTIONS;
  const minFramesByState = requirements.minFramesByState ?? {};
  const missingStates = [];
  const partialDirections = {};
  const tooShortStates = {};
  for (const state of requiredStates) {
    const match = directionMapForState(actor, state);
    if (!match.directions) {
      missingStates.push(state);
      continue;
    }
    const missingDirections = requiredDirections.filter((direction) => !Array.isArray(match.directions[direction]) || match.directions[direction].length === 0);
    if (missingDirections.length) partialDirections[state] = { matchedState: match.state, missingDirections };
    const minFrames = minFramesByState[state] ?? 1;
    for (const direction of requiredDirections) {
      const count = match.directions[direction]?.length ?? 0;
      if (count > 0 && count < minFrames) {
        tooShortStates[state] ??= {};
        tooShortStates[state][direction] = count;
      }
    }
  }
  const fail = missingStates.length || Object.keys(partialDirections).length || Object.keys(tooShortStates).length;
  return Object.freeze({ status: fail ? 'fail' : 'pass', missingStates, partialDirections, tooShortStates });
}

export function auditTellDurationContract(actor, enemy, { fps = 12 } = {}) {
  const tellFrames = enemy?.tellFrames ?? TELL_FRAME_CONTRACTS[enemy?.enemyId] ?? TELL_FRAME_CONTRACTS[enemy?.actorKey] ?? null;
  if (!tellFrames) return Object.freeze({ status: 'skip', reason: 'no-contract', coverageFrames: {} });
  const match = directionMapForState(actor, 'attack-tell');
  if (!match.directions) return Object.freeze({ status: 'fail', reason: 'missing-attack-tell', tellFrames, coverageFrames: {} });
  const coverageFrames = Object.fromEntries(Object.entries(match.directions).map(([direction, frames]) => [direction, Math.floor((frames.length * 60) / fps)]));
  const shortDirections = Object.entries(coverageFrames).filter(([, coverage]) => coverage < tellFrames).map(([direction]) => direction);
  return Object.freeze({ status: shortDirections.length ? 'fail' : 'pass', tellFrames, fps, coverageFrames: Object.freeze(coverageFrames), shortDirections: Object.freeze(shortDirections) });
}

export function readRgbaPng(filePath) {
  const png = readFileSync(filePath);
  if (png.length < 8 || png.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error(`Not a PNG: ${filePath}`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    offset += length + 12;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`Unsupported PNG format for QA (expected RGBA/8-bit): ${filePath}`);
  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const pixels = new Uint8ClampedArray(height * stride);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const previousRowStart = (y - 1) * stride;
    const decodedRowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[decodedRowStart + x - 4] : 0;
      const up = y > 0 ? pixels[previousRowStart + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[previousRowStart + x - 4] : 0;
      let value = row[x];
      if (filter === 1) value = (value + left) & 0xff;
      else if (filter === 2) value = (value + up) & 0xff;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter} in ${filePath}`);
      }
      pixels[decodedRowStart + x] = value;
    }
  }
  return { width, height, pixels };
}

function makeCrcTable() {
  return Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

export function writeRgbaPng(filePath, frame) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(frame.width, 0);
  ihdr.writeUInt32BE(frame.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = frame.width * 4;
  const raw = Buffer.alloc(frame.height * (stride + 1));
  for (let y = 0; y < frame.height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    Buffer.from(frame.pixels.buffer, frame.pixels.byteOffset + y * stride, stride).copy(raw, rowStart + 1);
  }
  const png = Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
  writeFileSync(filePath, png);
}

export function renderTinyQaContactSheet({ outPath, actorKey, summary = {}, checks = [] }) {
  const width = 64;
  const height = 32;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const statusColor = summary.status === 'pass' ? [127, 232, 74, 255] : summary.status === 'warn' ? [241, 211, 122, 255] : [224, 64, 160, 255];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const checker = (Math.floor(x / 4) + Math.floor(y / 4)) % 2;
      pixels[i] = checker ? 20 : 11;
      pixels[i + 1] = checker ? 26 : 15;
      pixels[i + 2] = checker ? 42 : 26;
      pixels[i + 3] = 255;
    }
  }
  const hash = [...actorKey].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  for (let x = 4; x < 60; x += 1) {
    for (let y = 4; y < 12; y += 1) {
      const i = (y * width + x) * 4;
      pixels[i] = statusColor[0]; pixels[i + 1] = statusColor[1]; pixels[i + 2] = statusColor[2]; pixels[i + 3] = 255;
    }
  }
  checks.slice(0, 8).forEach((check, index) => {
    const color = check.status === 'pass' ? [127, 232, 74, 255] : check.status === 'warn' ? [241, 211, 122, 255] : [224, 64, 160, 255];
    const ox = 4 + index * 7;
    const oy = 18 + (hash % 3);
    for (let y = oy; y < oy + 6; y += 1) {
      for (let x = ox; x < ox + 5; x += 1) {
        const i = (y * width + x) * 4;
        pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2]; pixels[i + 3] = 255;
      }
    }
  });
  writeRgbaPng(outPath, { width, height, pixels });
}

function actorRole(actorKey, actor) {
  if (ACTOR_ROLE_OVERRIDES[actorKey]) return ACTOR_ROLE_OVERRIDES[actorKey];
  if (actor?.role === 'boss') return 'boss';
  if (actor?.role === 'miniboss' || actor?.role === 'mini-boss') return 'miniboss';
  return 'enemy';
}

function resolveFramePath(repoRoot, framePath) {
  const clean = String(framePath).replace(/^\.\//, '');
  const fromPortal = path.join(repoRoot, 'apps/portal', clean);
  if (existsSync(fromPortal)) return fromPortal;
  return path.join(repoRoot, clean);
}

function sampleFramePaths(actor, { maxFramesPerActor = 16 } = {}) {
  const result = [];
  for (const [state, dirs] of Object.entries(actor?.animations ?? {})) {
    for (const [direction, frames] of Object.entries(dirs ?? {})) {
      if (!Array.isArray(frames) || frames.length === 0) continue;
      result.push({ state, direction, framePath: frames[0] });
      if (frames.length > 1) result.push({ state, direction, framePath: frames.at(-1) });
      if (result.length >= maxFramesPerActor) return result;
    }
  }
  return result;
}

function aggregateStatus(checks) {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}

function enemyContractForActor(actorKey) {
  const enemy = LESTER_BLASTER_ENEMY_CATALOG.find((entry) => entry.id === actorKey || entry.enemyKey === actorKey || entry.id.includes(actorKey));
  return { enemyId: actorKey, actorKey, tellFrames: TELL_FRAME_CONTRACTS[actorKey] ?? TELL_FRAME_CONTRACTS[enemy?.id] ?? null };
}

export function buildActorSpriteQaReport({ repoRoot = repoRootFromHere(), actorKey, actor = HMH_ANIMATED_ROSTER[actorKey], maxFramesPerActor = 16 } = {}) {
  if (!actor) throw new Error(`Unknown actor: ${actorKey}`);
  const role = actorRole(actorKey, actor);
  const requirements = ROLE_REQUIREMENTS[role] ?? ROLE_REQUIREMENTS.enemy;
  const completeness = auditCompleteness(actor, requirements);
  const tellDuration = auditTellDurationContract(actor, enemyContractForActor(actorKey));
  const samples = sampleFramePaths(actor, { maxFramesPerActor });
  const dimensions = new Map();
  const frameChecks = [];
  const pivotFrames = [];

  for (const sample of samples) {
    const filePath = resolveFramePath(repoRoot, sample.framePath);
    try {
      const frame = readRgbaPng(filePath);
      dimensions.set(`${frame.width}x${frame.height}`, (dimensions.get(`${frame.width}x${frame.height}`) ?? 0) + 1);
      frameChecks.push({ state: sample.state, direction: sample.direction, file: sample.framePath, transparency: analyzeTransparencyFrame(frame), palette: auditPaletteCompliance(frame) });
      pivotFrames.push(frame);
    } catch (error) {
      frameChecks.push({ state: sample.state, direction: sample.direction, file: sample.framePath, readError: error.message, transparency: { status: 'fail' }, palette: { status: 'fail' } });
    }
  }

  const transparencyStatus = aggregateStatus(frameChecks.map((check) => check.transparency));
  const paletteStatus = aggregateStatus(frameChecks.map((check) => check.palette));
  const dimensionStatus = dimensions.size <= 1 ? 'pass' : 'warn';
  const pivot = auditPivotStability(pivotFrames.slice(0, 8));
  const checks = [
    { id: 'transparency', status: transparencyStatus },
    { id: 'palette', status: paletteStatus },
    { id: 'completeness', status: completeness.status },
    { id: 'dimensions', status: dimensionStatus, canvases: Object.fromEntries(dimensions) },
    { id: 'pivot-stability', status: pivot.status, maxDelta: pivot.maxDelta },
    { id: 'tell-duration', status: tellDuration.status === 'skip' ? 'pass' : tellDuration.status },
  ];
  return Object.freeze({
    actorKey,
    role,
    summary: Object.freeze({ status: aggregateStatus(checks), sampledFrameCount: samples.length }),
    checks: Object.freeze(checks),
    completeness,
    tellDuration,
    frameChecks: Object.freeze(frameChecks),
  });
}

export function writeSpriteQaReports({ repoRoot = repoRootFromHere(), actorKeys = ['lester', 'lilly', 'lit-commando', 'lit-valkyrie', 'fud-goblin', 'gas-fee-wisp', 'claim-jumper', 'gas-beast-tank'], outDir = path.join(repoRoot, 'assets/generated/qa') } = {}) {
  mkdirSync(outDir, { recursive: true });
  const reports = [];
  for (const actorKey of actorKeys) {
    const report = buildActorSpriteQaReport({ repoRoot, actorKey });
    const jsonPath = path.join(outDir, `${actorKey}-qa.json`);
    const pngPath = path.join(outDir, `${actorKey}-qa.png`);
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    renderTinyQaContactSheet({ outPath: pngPath, actorKey, summary: report.summary, checks: report.checks });
    reports.push({
      actorKey,
      status: report.summary.status,
      jsonPath: path.relative(repoRoot, jsonPath).replaceAll('\\', '/'),
      pngPath: path.relative(repoRoot, pngPath).replaceAll('\\', '/'),
    });
  }
  const summary = {
    generatedBy: 'scripts/sprite-qa.mjs',
    actorCount: reports.length,
    passCount: reports.filter((report) => report.status === 'pass').length,
    warnCount: reports.filter((report) => report.status === 'warn').length,
    failCount: reports.filter((report) => report.status === 'fail').length,
    reports,
  };
  writeFileSync(path.join(outDir, 'sprite-qa-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return summary;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const actorArg = process.argv.find((arg) => arg.startsWith('--actors='));
  const actorKeys = actorArg ? actorArg.slice('--actors='.length).split(',').map((key) => key.trim()).filter(Boolean) : undefined;
  const summary = writeSpriteQaReports({ actorKeys });
  console.log(`Sprite QA reports written: ${summary.actorCount} actors (${summary.passCount} pass, ${summary.warnCount} warn, ${summary.failCount} fail).`);
  if (summary.failCount) console.log('Current failures are expected while Wave 3 fills animation gaps; reports are committed as calibration artifacts.');
}
