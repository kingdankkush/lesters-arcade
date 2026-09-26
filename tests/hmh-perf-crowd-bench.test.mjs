import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateCpuProfile,
  aggregateHeapProfile,
  createSourceMapLookup,
  estimateTextureBytes,
  readImageDimensions,
  summarizeCensus,
  summarizeFrameTimes,
  traceDigest,
} from '../scripts/lib/hmh-perf-analysis.mjs';
import { createHmhRebootHost } from '../apps/portal/src/hmh-reboot-host.mjs';

test('frame summary reports nearest-rank percentiles, fps and slow-frame shares', () => {
  const deltas = [...Array.from({ length: 90 }, () => 16), ...Array.from({ length: 8 }, () => 40), 60, 100];
  const summary = summarizeFrameTimes(deltas);
  assert.equal(summary.frames, 100);
  assert.equal(summary.meanMs, (90 * 16 + 8 * 40 + 60 + 100) / 100);
  assert.equal(summary.p50Ms, 16);
  assert.equal(summary.p95Ms, 40);
  assert.equal(summary.p99Ms, 60);
  assert.equal(summary.worstMs, 100);
  assert.equal(summary.fpsMean, 1000 / summary.meanMs);
  assert.equal(summary.over33Pct, 10);
  assert.equal(summary.over50Pct, 2);
  assert.throws(() => summarizeFrameTimes([]), /at least one frame/);
});

test('cpu profile aggregation counts self time per function and inclusive time once per stack', () => {
  // root -> a -> b ; root -> a -> a (recursion) ; root -> (idle)
  const profile = {
    nodes: [
      { id: 1, callFrame: { functionName: '(root)', url: '', lineNumber: -1, columnNumber: -1 }, children: [2, 5] },
      { id: 2, callFrame: { functionName: 'a', url: 'http://x/game.js', lineNumber: 0, columnNumber: 10 }, children: [3, 4] },
      { id: 3, callFrame: { functionName: 'b', url: 'http://x/game.js', lineNumber: 0, columnNumber: 50 } },
      { id: 4, callFrame: { functionName: 'a', url: 'http://x/game.js', lineNumber: 0, columnNumber: 10 } },
      { id: 5, callFrame: { functionName: '(idle)', url: '', lineNumber: -1, columnNumber: -1 } },
    ],
    samples: [3, 3, 4, 2, 5],
    timeDeltas: [1000, 1000, 1000, 1000, 4000],
  };
  const result = aggregateCpuProfile(profile);
  assert.equal(result.totalMs, 8);
  assert.equal(result.idleMs, 4);
  assert.equal(result.busyMs, 4);
  const a = result.functions.find((entry) => entry.functionName === 'a');
  const b = result.functions.find((entry) => entry.functionName === 'b');
  assert.equal(a.selfMs, 2);
  assert.equal(a.totalMs, 4, 'recursive frames must not double count');
  assert.equal(b.selfMs, 2);
  assert.equal(b.totalMs, 2);
  assert.equal(a.selfPct, 50);
  assert.equal(a.totalPct, 100);
  assert.equal(result.functions[0].selfMs >= result.functions[1].selfMs, true);
  assert.equal(result.functions.some((entry) => entry.functionName === '(idle)'), false);
});

test('heap profile aggregation counts sampled bytes per function, inclusive once per stack', () => {
  // root -> a (64) -> b (128) ; root -> a -> a (32, recursion) ; root -> (V8 API) (16)
  const frame = (functionName, columnNumber, url = 'http://x/game.js') => ({ functionName, url, lineNumber: 0, columnNumber, scriptId: '1' });
  const profile = {
    head: {
      id: 1, callFrame: frame('(root)', -1, ''), selfSize: 0, children: [
        { id: 2, callFrame: frame('a', 10), selfSize: 64, children: [
          { id: 3, callFrame: frame('b', 50), selfSize: 128, children: [] },
          { id: 4, callFrame: frame('a', 10), selfSize: 32, children: [] },
        ] },
        { id: 5, callFrame: frame('(V8 API)', -1, ''), selfSize: 16, children: [] },
      ],
    },
    samples: [],
  };
  const result = aggregateHeapProfile(profile, {
    resolve: (url, line, column) => (column === 50 ? { source: 'apps/hmh-reboot/src/main.mjs', line: 7, name: 'renderWorld' } : null),
  });
  assert.equal(result.totalBytes, 240);
  const a = result.functions.find((entry) => entry.functionName === 'a');
  const b = result.functions.find((entry) => entry.functionName === 'b');
  assert.equal(a.selfBytes, 96, 'both a frames allocate as a');
  assert.equal(a.totalBytes, 224, 'recursive frames must not double count');
  assert.equal(b.selfBytes, 128);
  assert.equal(b.totalBytes, 128);
  assert.equal(b.source, 'apps/hmh-reboot/src/main.mjs:7');
  assert.equal(b.originalName, 'renderWorld');
  assert.equal(b.selfPct, (128 / 240) * 100);
  assert.deepEqual(result.functions.map((entry) => entry.functionName), ['b', 'a', '(V8 API)'], 'sorted by self bytes');
  assert.equal(result.functions.some((entry) => entry.functionName === '(root)'), false);
});

test('cpu profile aggregation resolves minified frames through a lookup', () => {
  const profile = {
    nodes: [
      { id: 1, callFrame: { functionName: '(root)', url: '', lineNumber: -1, columnNumber: -1 }, children: [2] },
      { id: 2, callFrame: { functionName: 'Xe', url: 'http://x/game.js', lineNumber: 0, columnNumber: 7 } },
    ],
    samples: [2],
    timeDeltas: [500],
  };
  const result = aggregateCpuProfile(profile, {
    resolve: (url, line, column) => (url.endsWith('game.js') && line === 0 && column === 7
      ? { source: 'apps/hmh-reboot/src/main.mjs', line: 42, name: 'stepWorld' }
      : null),
  });
  assert.equal(result.functions[0].source, 'apps/hmh-reboot/src/main.mjs:42');
  assert.equal(result.functions[0].originalName, 'stepWorld');
});

test('source map lookup decodes VLQ mappings to original source lines', () => {
  // Generated line 0: col 0 -> src0 line 0 col 0 ; col 4 -> src0 line 2 col 2 name 0
  // Generated line 1: col 2 -> src1 line 5 col 0
  const map = {
    version: 3,
    sources: ['../../src/a.mjs', '../../src/b.mjs'],
    names: ['alpha'],
    mappings: 'AAAA,IAEEA;ECGF',
  };
  const lookup = createSourceMapLookup(map, { mapPath: 'apps/portal/dist/hmh-reboot/game.js.map', repoRoot: '' });
  assert.deepEqual(lookup(0, 0), { source: 'apps/portal/src/a.mjs', line: 1, column: 0, name: null });
  assert.deepEqual(lookup(0, 9), { source: 'apps/portal/src/a.mjs', line: 3, column: 2, name: 'alpha' });
  assert.deepEqual(lookup(1, 3), { source: 'apps/portal/src/b.mjs', line: 6, column: 0, name: null });
  assert.equal(lookup(1, 0), null);
  assert.equal(lookup(7, 0), null);
});

test('image headers yield dimensions for png, webp (lossy, lossless, extended) and jpeg', () => {
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(2048, 16);
  png.writeUInt32BE(1024, 20);
  assert.deepEqual(readImageDimensions(png), { format: 'png', width: 2048, height: 1024 });

  const vp8x = Buffer.alloc(30);
  vp8x.write('RIFF', 0, 'ascii');
  vp8x.write('WEBPVP8X', 8, 'ascii');
  vp8x.writeUIntLE(4095, 24, 3);
  vp8x.writeUIntLE(511, 27, 3);
  assert.deepEqual(readImageDimensions(vp8x), { format: 'webp', width: 4096, height: 512 });

  const vp8l = Buffer.alloc(25);
  vp8l.write('RIFF', 0, 'ascii');
  vp8l.write('WEBPVP8L', 8, 'ascii');
  vp8l[20] = 0x2f;
  const bits = (300 - 1) | ((200 - 1) << 14);
  vp8l.writeUInt32LE(bits >>> 0, 21);
  assert.deepEqual(readImageDimensions(vp8l), { format: 'webp', width: 300, height: 200 });

  const vp8 = Buffer.alloc(30);
  vp8.write('RIFF', 0, 'ascii');
  vp8.write('WEBPVP8 ', 8, 'ascii');
  vp8[23] = 0x9d; vp8[24] = 0x01; vp8[25] = 0x2a;
  vp8.writeUInt16LE(640, 26);
  vp8.writeUInt16LE(480, 28);
  assert.deepEqual(readImageDimensions(vp8), { format: 'webp', width: 640, height: 480 });

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80]);
  assert.deepEqual(readImageDimensions(jpeg), { format: 'jpeg', width: 640, height: 480 });
  assert.equal(readImageDimensions(Buffer.from('not an image')), null);
});

test('texture byte estimate covers rgba and a full mip chain', () => {
  assert.equal(estimateTextureBytes({ width: 1024, height: 1024 }), 4 * 1024 * 1024);
  assert.equal(estimateTextureBytes({ width: 2, height: 2, bytesPerPixel: 4, mipmaps: true }), (4 + 1) * 4);
});

test('census summary and trace digest describe a tick window deterministically', () => {
  const samples = [
    { tick: 10, enemies: 128, projectiles: 0 },
    { tick: 20, enemies: 120, projectiles: 4 },
    { tick: 30, enemies: 101, projectiles: 2 },
    { tick: 40, enemies: 99, projectiles: 1 },
  ];
  const summary = summarizeCensus(samples, { fromTick: 15, toTick: 35, fields: ['enemies', 'projectiles'] });
  assert.deepEqual(summary.enemies, { min: 101, mean: 110.5, max: 120 });
  assert.deepEqual(summary.projectiles, { min: 2, mean: 3, max: 4 });
  assert.equal(summary.samples, 2);
  const first = traceDigest(samples, ['tick', 'enemies']);
  assert.equal(first, traceDigest(samples.map((sample) => ({ ...sample })), ['tick', 'enemies']));
  assert.notEqual(first, traceDigest([...samples.slice(0, 3), { tick: 40, enemies: 98 }], ['tick', 'enemies']));
  assert.match(first, /^[0-9a-f]{64}$/);
});

test('the crowd bench flags cannot reach a portal-hosted (ranked-capable) session', () => {
  const mount = { replaceChildren() {} };
  const documentRef = {
    documentElement: { dataset: {} },
    createElement: () => ({
      dataset: {},
      setAttribute() {},
      addEventListener() {},
      focus() {},
      contentWindow: { postMessage() {} },
    }),
  };
  const host = createHmhRebootHost({
    mount,
    expectedOrigin: 'https://arcade.test',
    documentRef,
    bridgeFactory: () => ({ connect() {}, send() {}, destroy() {} }),
    setTimeoutRef: () => 1,
    clearTimeoutRef: () => {},
    runtimeSearch: '?evidenceSafe=1&endurancePressurePilot=1&telemetry=1&weaponPilot=1&worldTour=hazard',
  });
  const frame = host.mountSession({
    sessionId: 'crowd-bench-ranked-guard',
    gameId: 'lester-blaster',
    mode: 'ranked',
    heroId: 'lit-commando',
    profile: { displayName: 'Guard', locale: 'en' },
    session: { seed: 1, buildHash: 'guard', seasonId: 'season-1', rankedEligible: true },
    settings: { musicEnabled: false, screenShake: false, gore: true, reduceMotion: false, reduceFlash: false, colorblindTags: false },
  });
  const params = new URL(frame.src).searchParams;
  assert.equal(params.get('endurancePressurePilot'), null);
  assert.equal(params.get('telemetry'), null);
  assert.equal(params.get('weaponPilot'), null);
  assert.equal(params.get('worldTour'), null);
});
