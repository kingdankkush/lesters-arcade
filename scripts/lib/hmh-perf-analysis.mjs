// Pure analysis helpers for the HMH crowded-combat performance bench
// (scripts/hmh-perf-crowd-bench.mjs). Nothing here touches a browser, the
// filesystem or the game runtime, so every number the bench reports can be
// unit-tested from fixed inputs (tests/hmh-perf-crowd-bench.test.mjs).

import { createHash } from 'node:crypto';
import path from 'node:path';

const SLOW_30_FPS_MS = 1000 / 30;
const SLOW_20_FPS_MS = 1000 / 20;

// Nearest-rank on the sorted sample, index floor((n - 1) * q): the same rule
// scripts/hmh-mobile-performance-profile.mjs uses, so reports stay comparable.
function percentile(sorted, q) {
  return sorted[Math.floor((sorted.length - 1) * q)];
}

export function summarizeFrameTimes(deltas) {
  if (!Array.isArray(deltas) || deltas.length === 0) throw new Error('frame summary needs at least one frame');
  const sorted = [...deltas].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const meanMs = total / sorted.length;
  const share = (threshold) => (sorted.filter((value) => value > threshold).length / sorted.length) * 100;
  return {
    frames: sorted.length,
    meanMs,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    worstMs: sorted.at(-1),
    fpsMean: 1000 / meanMs,
    over33Pct: share(SLOW_30_FPS_MS),
    over50Pct: share(SLOW_20_FPS_MS),
  };
}

const EXCLUDED_FRAMES = new Set(['(root)', '(idle)']);

function frameKey(callFrame) {
  return `${callFrame.functionName}\u0000${callFrame.url}\u0000${callFrame.lineNumber}\u0000${callFrame.columnNumber}`;
}

/**
 * Aggregates a CDP Profiler profile into per-function self and inclusive time.
 * timeDeltas[i] is attributed to samples[i] (the convention the existing HMH
 * profile script uses). Inclusive time counts a function once per sampled
 * stack, so recursion never inflates it. Percentages are of busy time: every
 * sample except (idle).
 */
export function aggregateCpuProfile(profile, { resolve = null } = {}) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
  const stats = new Map();
  const entryFor = (callFrame) => {
    const key = frameKey(callFrame);
    let entry = stats.get(key);
    if (!entry) {
      entry = { functionName: callFrame.functionName || '(anonymous)', url: callFrame.url, lineNumber: callFrame.lineNumber, columnNumber: callFrame.columnNumber, selfMs: 0, totalMs: 0 };
      stats.set(key, entry);
    }
    return entry;
  };
  let totalMs = 0;
  let idleMs = 0;
  for (let index = 0; index < profile.samples.length; index += 1) {
    const ms = (profile.timeDeltas[index] ?? 0) / 1000;
    const leaf = nodes.get(profile.samples[index]);
    if (!leaf) continue;
    totalMs += ms;
    if (leaf.callFrame.functionName === '(idle)') { idleMs += ms; continue; }
    if (!EXCLUDED_FRAMES.has(leaf.callFrame.functionName)) entryFor(leaf.callFrame).selfMs += ms;
    const seen = new Set();
    for (let id = leaf.id; id !== undefined; id = parent.get(id)) {
      const callFrame = nodes.get(id).callFrame;
      if (EXCLUDED_FRAMES.has(callFrame.functionName)) continue;
      const key = frameKey(callFrame);
      if (seen.has(key)) continue;
      seen.add(key);
      entryFor(callFrame).totalMs += ms;
    }
  }
  const busyMs = totalMs - idleMs;
  const functions = [...stats.values()].map((entry) => {
    const resolved = resolve && entry.url && entry.lineNumber >= 0 ? resolve(entry.url, entry.lineNumber, entry.columnNumber) : null;
    return {
      ...entry,
      selfPct: busyMs > 0 ? (entry.selfMs / busyMs) * 100 : 0,
      totalPct: busyMs > 0 ? (entry.totalMs / busyMs) * 100 : 0,
      source: resolved ? `${resolved.source}:${resolved.line}` : entry.url ? `${entry.url}:${entry.lineNumber + 1}:${entry.columnNumber + 1}` : '',
      originalName: resolved?.name ?? null,
    };
  }).sort((a, b) => b.selfMs - a.selfMs || b.totalMs - a.totalMs);
  return { totalMs, idleMs, busyMs, functions };
}

/**
 * Aggregates a CDP HeapProfiler sampling profile into sampled allocation bytes
 * per function: self (allocated in that frame) and total (allocated beneath
 * it, counted once per stack so recursion never inflates it). Record it with
 * includeObjectsCollectedByMajorGC/MinorGC so garbage counts, or it only
 * reports what was still alive at the end.
 */
export function aggregateHeapProfile(profile, { resolve = null } = {}) {
  const stats = new Map();
  let totalBytes = 0;
  const entryFor = (callFrame) => {
    const key = frameKey(callFrame);
    let entry = stats.get(key);
    if (!entry) {
      entry = { functionName: callFrame.functionName || '(anonymous)', url: callFrame.url, lineNumber: callFrame.lineNumber, columnNumber: callFrame.columnNumber, selfBytes: 0, totalBytes: 0 };
      stats.set(key, entry);
    }
    return entry;
  };
  // Iterative walk: each node carries the keys of its ancestors' frames.
  const pending = [[profile.head, []]];
  while (pending.length > 0) {
    const [node, above] = pending.pop();
    const { callFrame } = node;
    const excluded = EXCLUDED_FRAMES.has(callFrame.functionName);
    const key = excluded ? null : frameKey(callFrame);
    const stack = key === null || above.includes(key) ? above : [...above, key];
    const bytes = node.selfSize ?? 0;
    totalBytes += bytes;
    if (!excluded) entryFor(callFrame).selfBytes += bytes;
    for (const ancestorKey of stack) stats.get(ancestorKey).totalBytes += bytes;
    for (const child of node.children ?? []) pending.push([child, stack]);
  }
  const functions = [...stats.values()].map((entry) => {
    const resolved = resolve && entry.url && entry.lineNumber >= 0 ? resolve(entry.url, entry.lineNumber, entry.columnNumber) : null;
    return {
      ...entry,
      selfPct: totalBytes > 0 ? (entry.selfBytes / totalBytes) * 100 : 0,
      totalPct: totalBytes > 0 ? (entry.totalBytes / totalBytes) * 100 : 0,
      source: resolved ? `${resolved.source}:${resolved.line}` : entry.url ? `${entry.url}:${entry.lineNumber + 1}:${entry.columnNumber + 1}` : '',
      originalName: resolved?.name ?? null,
    };
  }).sort((a, b) => b.selfBytes - a.selfBytes || b.totalBytes - a.totalBytes);
  return { totalBytes, functions };
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUE = new Map([...BASE64].map((character, index) => [character, index]));

function decodeVlqSegment(text) {
  const values = [];
  let value = 0;
  let shift = 0;
  for (const character of text) {
    const digit = BASE64_VALUE.get(character);
    if (digit === undefined) throw new Error(`invalid base64 VLQ digit ${character}`);
    value += (digit & 31) << shift;
    if (digit & 32) { shift += 5; continue; }
    values.push(value & 1 ? -(value >>> 1) : value >>> 1);
    value = 0;
    shift = 0;
  }
  return values;
}

/**
 * Returns lookup(generatedLine0, generatedColumn0) -> { source, line (1-based),
 * column (0-based), name } using the nearest mapping at or before the column,
 * or null. Sources resolve relative to the map file, as repo-relative posix
 * paths when mapPath is repo-relative.
 */
export function createSourceMapLookup(map, { mapPath = '', repoRoot = '' } = {}) {
  const mapDir = path.posix.dirname(String(mapPath).replaceAll('\\', '/'));
  const sources = (map.sources ?? []).map((source) => {
    const joined = path.posix.normalize(path.posix.join(mapDir, source));
    return repoRoot ? path.posix.relative(repoRoot, joined) : joined;
  });
  const lines = [];
  let sourceIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  let nameIndex = 0;
  for (const lineText of String(map.mappings ?? '').split(';')) {
    const segments = [];
    let generatedColumn = 0;
    if (lineText) {
      for (const segmentText of lineText.split(',')) {
        if (!segmentText) continue;
        const values = decodeVlqSegment(segmentText);
        generatedColumn += values[0];
        if (values.length >= 4) {
          sourceIndex += values[1];
          sourceLine += values[2];
          sourceColumn += values[3];
          let name = null;
          if (values.length >= 5) { nameIndex += values[4]; name = map.names?.[nameIndex] ?? null; }
          segments.push([generatedColumn, sourceIndex, sourceLine, sourceColumn, name]);
        }
      }
    }
    lines.push(segments);
  }
  return (line, column) => {
    const segments = lines[line];
    if (!segments || segments.length === 0) return null;
    let low = 0;
    let high = segments.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (segments[middle][0] <= column) { found = middle; low = middle + 1; } else high = middle - 1;
    }
    if (found < 0) return null;
    const [, source, originalLine, originalColumn, name] = segments[found];
    return { source: sources[source], line: originalLine + 1, column: originalColumn, name };
  };
}

/** Width and height from a PNG, WebP (VP8, VP8L, VP8X) or baseline/progressive JPEG header. */
export function readImageDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString('ascii', 12, 16) === 'IHDR') {
    return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return { format: 'webp', width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    }
    if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { format: 'webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    return null;
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 <= buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { format: 'jpeg', width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

/** Uncompressed GPU bytes for a texture; a full mip chain adds every smaller level. */
export function estimateTextureBytes({ width, height, bytesPerPixel = 4, mipmaps = false }) {
  let bytes = width * height * bytesPerPixel;
  if (!mipmaps) return bytes;
  let w = width;
  let h = height;
  while (w > 1 || h > 1) {
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
    bytes += w * h * bytesPerPixel;
  }
  return bytes;
}

/** min/mean/max of each census field over samples whose tick is in [fromTick, toTick]. */
export function summarizeCensus(samples, { fromTick, toTick, fields }) {
  const inWindow = samples.filter((sample) => sample.tick >= fromTick && sample.tick <= toTick);
  const summary = { samples: inWindow.length };
  for (const field of fields) {
    const values = inWindow.map((sample) => Number(sample[field])).filter(Number.isFinite);
    summary[field] = values.length === 0
      ? null
      : { min: Math.min(...values), mean: values.reduce((sum, value) => sum + value, 0) / values.length, max: Math.max(...values) };
  }
  return summary;
}

/** SHA-256 over the selected fields of every sample, in order. */
export function traceDigest(samples, fields) {
  const hash = createHash('sha256');
  for (const sample of samples) hash.update(`${JSON.stringify(fields.map((field) => sample[field] ?? null))}\n`);
  return hash.digest('hex');
}
