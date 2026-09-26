// HMH crowded-combat performance bench.
//
// Loads the real HMH child inside a same-origin parent page that speaks the
// real hmh-bridge/v1 parent protocol (sdk + apps/portal/src/hmh-reboot-bridge),
// so the run looks like a portal Free session: iframe embedding, the portal
// default `gore: true`, and the child's mobile/desktop performance profile.
// The crowd comes from the existing evidence-only pilot
// `?evidenceSafe=1&endurancePressurePilot=1` (128 endurance-band enemies placed
// around an invulnerable hero at tick 0, auto-fire on). The portal host strips
// every runtime flag except evidenceSafe/terminalPilot, so none of this can
// reach a portal (ranked-capable) session; tests/hmh-perf-crowd-bench.test.mjs
// holds that line.
//
// Modes (one browser at a time, never concurrent):
//   timing  - rAF frame intervals over an active-play window, no profiler, no
//             telemetry. This is the number to compare.
//   profile - the same window with a CDP CPU profile (sampling overhead makes
//             its frame times slightly worse; they are reported, not compared).
//   alloc   - the same window with the CDP sampling heap profiler on, counting
//             collected objects too: allocation rate and the top allocating
//             functions (its frame times carry the sampler's overhead).
//   census  - telemetry=1 plus a fixed virtual clock (N sim ticks per frame) so
//             the scene content per tick is recorded quickly and reproducibly,
//             plus WebGL texture accounting. Its trace digest is a real-runtime
//             same-seed check: identical builds give identical digests.
//   suite   - census (mobile, desktop x2), then timing+profile for mobile 4x,
//             mobile 6x and desktop 1x; writes the baseline report.
//
// Serve apps/portal first (build with `node build.mjs --sourcemap` so hotspots
// resolve to source lines):
//   python -m http.server 8861 --bind 127.0.0.1 --directory apps/portal
// Then, e.g. (on this hybrid P/E-core Windows host pass --affinity=0xFFFF, see
// pinProcesses below):
//   node scripts/hmh-perf-crowd-bench.mjs --suite --record --affinity=0xFFFF
//   node scripts/hmh-perf-crowd-bench.mjs --mode=timing --profile=mobile --cpu=4 --affinity=0xFFFF
// Options: --seconds=20 --warmup-ticks=240 --census-ticks=1800 --gore=1
//   --weapon=coin-blaster|lightning-ledger|bear-market-burner|forked-standard
//   --seed=<u32> --origin=<url> --out=<dir> --retries=3 --verbose
//   --walk  (timing/profile only) hold D, S, A, W in turn for 1.5 s each over
//           the window, so the hero drags the crowd and the camera scrolls.
//           Key timing is wall-clock, so walked runs are not tick-reproducible.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import http from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  aggregateCpuProfile,
  aggregateHeapProfile,
  createSourceMapLookup,
  readImageDimensions,
  summarizeCensus,
  summarizeFrameTimes,
  traceDigest,
} from './lib/hmh-perf-analysis.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORTAL_ROOT = path.join(ROOT, 'apps', 'portal');
const PLAYWRIGHT = process.env.PLAYWRIGHT_PACKAGE_PATH
  ?? path.join(ROOT, 'benchmarks', 'hmh-engine-bakeoff', 'node_modules', 'playwright', 'index.mjs');
const CHROME = process.env.CHROME_BIN ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const STANDALONE_SEED = 0x484d4804;
const FIXED_STEP_MS = 1000 / 60;

const PROFILES = Object.freeze({
  // Owner device proxy: iPhone XS Max CSS viewport, DPR 3, touch.
  mobile: Object.freeze({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }),
  desktop: Object.freeze({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }),
});
const WEAPON_PILOTS = Object.freeze({
  'coin-blaster': '',
  'lightning-ledger': '&lightningLedgerPilot=1',
  'bear-market-burner': '&bearMarketBurnerPilot=1',
  'forked-standard': '&forkedStandardPilot=1',
});

// Scene content sampled from telemetry in census mode. SIM fields feed the
// trace digest; projection fields (gore, particles, pools) only describe load.
const SIM_FIELDS = Object.freeze(['tick', 'enemies', 'projectiles', 'score', 'xp', 'level', 'playerHealth', 'targetHealth',
  'enemyDecisions', 'enemySafetySteps', 'enemyCollisionContacts', 'enemyRouteReplans', 'enemyTells', 'enemyAttackTokens',
  'directorInsertions', 'weaponAmmo', 'silver']);
const LOAD_FIELDS = Object.freeze(['enemies', 'projectiles', 'animatedEnemies', 'corpses', 'goreMarks', 'goreFragments',
  'silverActive', 'silverVisible', 'killFxShards', 'combatEvents', 'weaponVfx', 'worldParticles', 'contactShadows',
  'atmosphereSprites', 'pickupMarkers', 'enemyTells', 'displaysCreated', 'displaysReused']);

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`unrecognised argument ${arg}`);
    options[match[1]] = match[2] ?? true;
  }
  return options;
}

// Host CPU busy share between two os.cpus() snapshots. Other sessions on the
// same machine (release gates, browser smokes) steal the CPU the throttled
// renderer needs; a contended window is flagged instead of trusted.
function cpuTimes() {
  return os.cpus().reduce((sum, cpu) => {
    const { user, nice, sys, irq, idle } = cpu.times;
    return { busy: sum.busy + user + nice + sys + irq, total: sum.total + user + nice + sys + irq + idle };
  }, { busy: 0, total: 0 });
}
function hostBusyPct(start, end) {
  const total = end.total - start.total;
  return total > 0 ? ((end.busy - start.busy) / total) * 100 : 0;
}
// Busy share of the host's logical CPUs used by everything except this bench's
// Chrome. This workstation idles around 20% (desktop apps); a release gate or
// another session's browser pushes well past 30%.
const HOST_CONTENDED_PCT = 30;

// Chrome process table (browser, GPU, renderers) with cumulative CPU seconds.
async function browserProcesses(browser) {
  const session = await browser.newBrowserCDPSession();
  try {
    const { processInfo } = await session.send('SystemInfo.getProcessInfo');
    return processInfo.map(({ type, id, cpuTime }) => ({ type, id, cpuTime }));
  } finally {
    await session.detach().catch(() => {});
  }
}

// Optional: pin this run's own Chrome processes to a core mask at High
// priority. On a hybrid (P/E-core) Windows host, windowless headless
// renderers were observed drifting onto slow cores between runs, which moved a
// 4x-throttled mean from ~39 ms to ~230 ms with no code change. Pinning the
// bench's processes to the performance cores keeps passes comparable. It only
// touches processes this bench launched.
function pinProcesses(processes, mask) {
  const ids = processes.map((entry) => Number(entry.id)).filter(Number.isInteger);
  if (ids.length === 0 || process.platform !== 'win32') return false;
  const script = `foreach ($id in @(${ids.join(',')})) { try { $p = Get-Process -Id $id -ErrorAction Stop; $p.ProcessorAffinity = [IntPtr]${mask}; $p.PriorityClass = 'High' } catch {} }`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
  return result.status === 0;
}

async function webglRenderer(frame) {
  return frame.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  }).catch(() => 'unknown');
}

const options = parseArgs(process.argv.slice(2));
// Default: the bench serves apps/portal itself (HTTP/1.1 keep-alive, ETag,
// max-age, byte ranges). python's HTTP/1.0 http.server was observed dropping
// requests under the SFX load (net::ERR_NO_BUFFER_SPACE), and a dropped
// native-prop request leaves the child waiting on "Play with basic graphics".
// Cacheable responses also match production, where the portal service worker
// serves images and audio cache-first. --origin=<url> uses an external server.
let origin = options.origin || process.env.HMH_BENCH_ORIGIN ? String(options.origin ?? process.env.HMH_BENCH_ORIGIN).replace(/\/$/, '') : null;
const outDir = path.resolve(ROOT, String(options.out ?? '.tmp/hmh-perf-crowd'));
const seed = Number(options.seed ?? STANDALONE_SEED);
const gore = String(options.gore ?? '1') !== '0';
const weapon = String(options.weapon ?? 'coin-blaster');
const windowSeconds = Number(options.seconds ?? 20);
const warmupTicks = Number(options['warmup-ticks'] ?? 240);
const censusTicks = Number(options['census-ticks'] ?? 1800);
const censusTicksPerFrame = Number(options['census-ticks-per-frame'] ?? 4);
const retries = Number(options.retries ?? 3);
const affinity = options.affinity ? String(options.affinity) : null;
const walk = Boolean(options.walk);
const WALK_KEYS = Object.freeze(['KeyD', 'KeyS', 'KeyA', 'KeyW']);
const WALK_LEG_MS = 1500;
assert.ok(affinity === null || /^0x[0-9a-f]+$/i.test(affinity), 'affinity must be a hex core mask such as 0xFFFF');
assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffff_ffff, 'seed must be an unsigned 32-bit integer');
assert.ok(Object.hasOwn(WEAPON_PILOTS, weapon), `weapon must be one of ${Object.keys(WEAPON_PILOTS).join(', ')}`);
assert.ok(windowSeconds >= 5 && windowSeconds <= 300, 'window must be 5-300 seconds');
assert.ok(Number.isInteger(censusTicksPerFrame) && censusTicksPerFrame >= 1 && censusTicksPerFrame <= 4, 'census ticks per frame must be 1-4 (the catch-up cap)');

const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href);

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
});

async function startStaticServer(root) {
  const base = path.resolve(root);
  const server = http.createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://bench').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.join(base, pathname);
      const info = file.startsWith(base + path.sep) && existsSync(file) ? await stat(file) : null;
      if (!info?.isFile()) { response.writeHead(404, { 'content-type': 'text/plain' }); response.end('not found'); return; }
      const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
      const headers = {
        'content-type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=3600', etag, 'last-modified': info.mtime.toUTCString(), 'accept-ranges': 'bytes',
      };
      if (request.headers['if-none-match'] === etag) { response.writeHead(304, headers); response.end(); return; }
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
        if (start > end || start >= info.size) { response.writeHead(416, { 'content-range': `bytes */${info.size}` }); response.end(); return; }
        response.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${info.size}`, 'content-length': end - start + 1 });
        createReadStream(file, { start, end }).pipe(response);
        return;
      }
      response.writeHead(200, { ...headers, 'content-length': info.size });
      if (request.method === 'HEAD') { response.end(); return; }
      createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain' });
      response.end(String(error?.message ?? error));
    }
  });
  server.keepAliveTimeout = 60_000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function assertServing() {
  let response;
  try {
    response = await fetch(`${origin}/hmh-reboot/index.html`);
  } catch (error) {
    throw new Error(`HMH is not being served at ${origin} (${error.message}). Omit --origin to let the bench serve apps/portal itself.`);
  }
  // Drain the body: python's HTTP/1.0 server closes the socket, and undici
  // asserts if a paused body sees the close.
  await response.arrayBuffer();
  assert.equal(response.status, 200, `${origin}/hmh-reboot/index.html returned ${response.status}`);
  const bundle = path.join(PORTAL_ROOT, 'dist', 'hmh-reboot', 'game.js');
  assert.ok(existsSync(bundle), 'apps/portal/dist is missing: run `node build.mjs --sourcemap` first');
}

function hostHtml(session, query) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="data:,"><title>HMH crowd bench host</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#06141d}iframe{display:block;width:100%;height:100%;border:0}</style>
</head><body><script type="module">
import { createHmhParentBridge } from '/src/hmh-reboot-bridge.mjs';
const report = window.__hmhBenchHost = { ready: false, messages: 0, errors: [] };
const iframe = document.createElement('iframe');
iframe.title = 'Hard Money Heroes reboot runtime';
iframe.src = '/hmh-reboot/index.html?${query}';
iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
iframe.setAttribute('allow', 'fullscreen; gamepad; autoplay');
iframe.dataset.runtime = 'hmh-reboot';
document.body.append(iframe);
const bridge = createHmhParentBridge({
  iframe,
  expectedOrigin: location.origin,
  session: ${JSON.stringify(session)},
  onMessage(message) {
    report.messages += 1;
    if (message.type === 'game:ready') report.ready = true;
    if (message.type === 'game:error') report.errors.push(message.payload?.code + ': ' + message.payload?.message);
  },
  onProtocolError(error) { report.errors.push(error.message); },
});
iframe.addEventListener('load', () => { bridge.connect(); try { iframe.focus(); iframe.contentWindow.focus(); } catch {} }, { once: true });
</script></body></html>`;
}

// Runs in every frame; only the HMH child installs anything.
function childInstrumentation(config) {
  if (!location.pathname.endsWith('/hmh-reboot/index.html')) return;
  const bench = globalThis.__hmhBench = {
    recording: false, frames: [], frameTicks: [], silverVisible: [], activeMs: 0, longTasks: [], upgradePicks: 0,
    census: [], textures: null, lastCensusTick: -1,
    // SFX voices actually started, whichever engine the build uses: media
    // element plays (<= 1.8.1) or Web Audio buffer sources (perf step 5/8).
    // Counting wrappers only; both engines pay the same tiny cost.
    audio: { mediaPlays: 0, sourceStarts: 0 },
  };
  const countCalls = (proto, name, key) => {
    const original = proto?.[name];
    if (typeof original !== 'function') return;
    proto[name] = function counted(...args) { bench.audio[key] += 1; return original.apply(this, args); };
  };
  countCalls(window.HTMLMediaElement?.prototype, 'play', 'mediaPlays');
  countCalls(window.AudioBufferSourceNode?.prototype, 'start', 'sourceStarts');
  if (config.virtualClock) {
    // Fixed virtual clock: every rendered frame advances exactly N fixed steps,
    // so the tick partition (and therefore upgrade timing) is reproducible.
    const realRaf = window.requestAnimationFrame.bind(window);
    const step = config.virtualClock * (1000 / 60);
    let virtualNow = performance.now();
    let queue = new Map();
    let nextId = 1;
    const pump = () => {
      // Hold virtual time once the census tick is reached, so the texture
      // report and screenshot describe that tick, not wherever polling caught up.
      const reached = config.stopAtTick > 0
        && Number(document.querySelector('#hmhRebootStage')?.dataset.simulationStepsTotal ?? 0) >= config.stopAtTick;
      if (!reached) virtualNow += step;
      const batch = queue;
      queue = new Map();
      for (const callback of batch.values()) {
        try { callback(virtualNow); } catch (error) { setTimeout(() => { throw error; }); }
      }
      realRaf(pump);
    };
    realRaf(pump);
    performance.now = () => virtualNow;
    window.requestAnimationFrame = (callback) => { const id = nextId; nextId += 1; queue.set(id, callback); return id; };
    window.cancelAnimationFrame = (id) => { queue.delete(id); };
  }
  if (config.textures) {
    const textures = new Map();
    const renderbuffers = new Map();
    const bindings = new WeakMap();
    let nextTextureId = 1;
    const ids = new WeakMap();
    const idOf = (object) => { if (!ids.has(object)) { ids.set(object, nextTextureId); nextTextureId += 1; } return ids.get(object); };
    const bpp = (internalFormat, type) => {
      switch (internalFormat) {
        case 0x8229: case 0x1909: case 0x1906: return 1; // R8, LUMINANCE, ALPHA
        case 0x822b: case 0x190a: return 2; // RG8, LUMINANCE_ALPHA
        case 0x881a: return 8; // RGBA16F
        case 0x8814: return 16; // RGBA32F
        case 0x88f0: case 0x81a6: case 0x8cac: return 4; // DEPTH24_STENCIL8, DEPTH_COMPONENT24, DEPTH_COMPONENT32F
        default: return type === 0x140b || type === 0x8d61 ? 8 : 4; // HALF_FLOAT RGBA -> 8, else RGBA8/RGB8 (padded)
      }
    };
    const state = (gl) => { let value = bindings.get(gl); if (!value) { value = { unit: 0x84c0, bound: new Map(), renderbuffer: null }; bindings.set(gl, value); } return value; };
    const record = (gl, target, level, width, height, bytes, source) => {
      const face = target >= 0x8515 && target <= 0x851a ? target : 0;
      const bindTarget = face ? 0x8513 : target;
      const texture = state(gl).bound.get(`${state(gl).unit}:${bindTarget}`);
      if (!texture) return;
      const id = idOf(texture);
      const entry = textures.get(id) ?? { id, levels: new Map(), width: 0, height: 0, source: '' };
      if (level === 0) { entry.width = width; entry.height = height; entry.source = source; }
      entry.levels.set(`${face}:${level}`, bytes);
      textures.set(id, entry);
    };
    const sourceKind = (source) => source?.constructor?.name ?? (source ? typeof source : 'null');
    for (const proto of [globalThis.WebGL2RenderingContext?.prototype, globalThis.WebGLRenderingContext?.prototype].filter(Boolean)) {
      const wrap = (name, after) => {
        const original = proto[name];
        if (typeof original !== 'function') return;
        proto[name] = function wrapped(...args) { const result = original.apply(this, args); try { after(this, args, result); } catch {} return result; };
      };
      wrap('activeTexture', (gl, [unit]) => { state(gl).unit = unit; });
      wrap('bindTexture', (gl, [target, texture]) => { state(gl).bound.set(`${state(gl).unit}:${target}`, texture); });
      wrap('texImage2D', (gl, args) => {
        const [target, level, internalFormat] = args;
        let width; let height; let type; let source;
        if (args.length >= 8) { [width, height] = [args[3], args[4]]; type = args[7]; source = args[8] ?? null; }
        else { type = args[4]; source = args[5]; width = source?.width ?? source?.videoWidth ?? 0; height = source?.height ?? source?.videoHeight ?? 0; }
        record(gl, target, level, width, height, width * height * bpp(internalFormat, type), sourceKind(source));
      });
      wrap('texStorage2D', (gl, [target, levels, internalFormat, width, height]) => {
        for (let level = 0, w = width, h = height; level < levels; level += 1, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) {
          record(gl, target, level, w, h, w * h * bpp(internalFormat), 'storage');
        }
      });
      wrap('compressedTexImage2D', (gl, [target, level, , width, height, , data]) => {
        record(gl, target, level, width, height, data?.byteLength ?? 0, 'compressed');
      });
      wrap('generateMipmap', (gl, [target]) => {
        const texture = state(gl).bound.get(`${state(gl).unit}:${target}`);
        const entry = texture ? textures.get(idOf(texture)) : null;
        if (!entry) return;
        for (let level = 1, w = entry.width >> 1, h = entry.height >> 1; w >= 1 || h >= 1; level += 1, w >>= 1, h >>= 1) {
          entry.levels.set(`0:${level}`, Math.max(1, w) * Math.max(1, h) * 4);
          if (w <= 1 && h <= 1) break;
        }
      });
      wrap('deleteTexture', (gl, [texture]) => { if (texture) textures.delete(idOf(texture)); });
      wrap('bindRenderbuffer', (gl, [, renderbuffer]) => { state(gl).renderbuffer = renderbuffer; });
      wrap('renderbufferStorage', (gl, [, internalFormat, width, height]) => {
        const renderbuffer = state(gl).renderbuffer;
        if (renderbuffer) renderbuffers.set(idOf(renderbuffer), { width, height, samples: 1, bytes: width * height * bpp(internalFormat) });
      });
      wrap('renderbufferStorageMultisample', (gl, [, samples, internalFormat, width, height]) => {
        const renderbuffer = state(gl).renderbuffer;
        if (renderbuffer) renderbuffers.set(idOf(renderbuffer), { width, height, samples, bytes: width * height * bpp(internalFormat) * Math.max(1, samples) });
      });
      wrap('deleteRenderbuffer', (gl, [renderbuffer]) => { if (renderbuffer) renderbuffers.delete(idOf(renderbuffer)); });
    }
    bench.textureReport = () => {
      const list = [...textures.values()].map((entry) => ({
        id: entry.id, width: entry.width, height: entry.height, source: entry.source,
        mipLevels: entry.levels.size, bytes: [...entry.levels.values()].reduce((sum, value) => sum + value, 0),
      })).sort((a, b) => b.bytes - a.bytes);
      const canvas = document.querySelector('#hmhRebootStage canvas');
      return {
        textures: list,
        textureBytes: list.reduce((sum, entry) => sum + entry.bytes, 0),
        renderbuffers: [...renderbuffers.values()],
        renderbufferBytes: [...renderbuffers.values()].reduce((sum, entry) => sum + entry.bytes, 0),
        canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      };
    };
  }
  const stageData = () => document.querySelector('#hmhRebootStage')?.dataset ?? {};
  const pool = (value) => Number(String(value ?? '').split('/')[0]) || 0;
  let previous = 0;
  let previousActive = false;
  const frame = (now) => {
    const data = stageData();
    const panel = document.querySelector('#hmhUpgradePanel');
    const upgradeOpen = Boolean(panel && !panel.hidden);
    const active = data.simulationState === 'active' && !upgradeOpen && Boolean(document.querySelector('#hmhStartup')?.hidden);
    if (bench.recording && previous && active && previousActive) {
      bench.frames.push(now - previous);
      bench.frameTicks.push(Number(data.simulationStepsTotal));
      // Written every frame without telemetry once the coin display exists.
      if (data.silverVisible !== undefined) bench.silverVisible.push(Number(data.silverVisible));
      bench.activeMs += now - previous;
    }
    if (config.census && active && Number(data.simulationStepsTotal) !== bench.lastCensusTick) {
      bench.lastCensusTick = Number(data.simulationStepsTotal);
      let silver = {};
      try { silver = JSON.parse(data.silverAccounting ?? '{}'); } catch {}
      bench.census.push({
        tick: Number(data.simulationStepsTotal), enemies: Number(data.enemyCount), projectiles: Number(data.projectileCount),
        score: Number(data.runScore), xp: Number(data.runXp), level: Number(data.runLevel), playerHealth: Number(data.playerHealth),
        targetHealth: Number(data.targetHealth), enemyDecisions: Number(data.enemyDecisions), enemySafetySteps: Number(data.enemySafetySteps),
        enemyCollisionContacts: Number(data.enemyCollisionContacts), enemyRouteReplans: Number(data.enemyRouteReplans),
        enemyTells: Number(data.enemyTells), enemyAttackTokens: Number(data.enemyAttackTokens), directorInsertions: Number(data.directorInsertions),
        weaponAmmo: data.weaponAmmo ?? '', silver: data.silverAccounting ?? '',
        animatedEnemies: Number(data.animatedEnemies), corpses: Number(data.enemyDeathVisuals), goreMarks: Number(data.goreMarks ?? 0),
        goreFragments: Number(data.goreFragments ?? 0), silverActive: Number(silver.active ?? 0),
        // Written only once the coin display exists; null (not 0) until then.
        silverVisible: data.silverVisible === undefined ? null : Number(data.silverVisible),
        killFxShards: Number(data.killFxShards ?? 0), combatEvents: pool(data.effectPoolPressure), weaponVfx: pool(data.weaponVfxPoolPressure),
        worldParticles: Number(data.worldRenderedParticles ?? 0), contactShadows: Number(data.contactShadows ?? 0),
        atmosphereSprites: Number(data.atmosphereSprites ?? 0), pickupMarkers: Number(data.pickupMarkers ?? 0),
        resolution: Number(data.adaptiveResolution ?? data.renderResolution ?? 0),
        // Enemy/corpse display pool counters (null on builds without the pool):
        // construction should stop once the crowd is warm.
        displaysCreated: data.enemyDisplaysCreated === undefined ? null : Number(data.enemyDisplaysCreated),
        displaysReused: data.enemyDisplaysReused === undefined ? null : Number(data.enemyDisplaysReused),
      });
    }
    // Upgrade picks are paused time: excluded above, answered with the first
    // choice so every pass takes the same deterministic branch.
    if (upgradeOpen) {
      const choice = panel.querySelector('.hmh-upgrade-choice');
      if (choice) { choice.click(); bench.upgradePicks += 1; }
    }
    previous = now;
    previousActive = active;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (bench.recording) bench.longTasks.push(entry.duration);
    }).observe({ entryTypes: ['longtask'] });
  } catch {}
}

let sourceMaps = null;
async function resolverForDist() {
  if (sourceMaps) return sourceMaps;
  const cache = new Map();
  sourceMaps = (url, line, column) => {
    let pathname;
    try { pathname = new URL(url).pathname; } catch { return null; }
    if (!pathname.startsWith('/dist/')) return null;
    const mapFile = path.join(PORTAL_ROOT, `${pathname}.map`);
    if (!cache.has(mapFile)) {
      cache.set(mapFile, null);
      if (existsSync(mapFile)) {
        cache.set(mapFile, readFile(mapFile, 'utf8').then((text) => createSourceMapLookup(JSON.parse(text), {
          mapPath: path.relative(ROOT, mapFile).replaceAll('\\', '/'),
        })));
      }
    }
    return cache.get(mapFile);
  };
  return sourceMaps;
}

async function resolveHotspots(profile) {
  const lookupFor = await resolverForDist();
  const lookups = new Map();
  for (const node of profile.nodes) {
    const { url } = node.callFrame;
    if (!url || lookups.has(url)) continue;
    const pending = lookupFor(url, 0, 0);
    lookups.set(url, pending ? await pending : null);
  }
  return aggregateCpuProfile(profile, {
    resolve: (url, line, column) => {
      const hit = lookups.get(url)?.(line, column) ?? null;
      // node_modules is a junction into another checkout; report the package path.
      return hit ? { ...hit, source: hit.source.replace(/^.*?node_modules\//, 'node_modules/') } : null;
    },
  });
}

// Sampled allocation bytes per function across the window, resolved through
// the dist source maps like the CPU hotspots.
async function resolveAllocations(heapProfile) {
  const lookupFor = await resolverForDist();
  const lookups = new Map();
  const pending = [heapProfile.head];
  while (pending.length > 0) {
    const node = pending.pop();
    const { url } = node.callFrame;
    if (url && !lookups.has(url)) {
      const lookup = lookupFor(url, 0, 0);
      lookups.set(url, lookup ? await lookup : null);
    }
    pending.push(...(node.children ?? []));
  }
  return aggregateHeapProfile(heapProfile, {
    resolve: (url, line, column) => {
      const hit = lookups.get(url)?.(line, column) ?? null;
      return hit ? { ...hit, source: hit.source.replace(/^.*?node_modules\//, 'node_modules/') } : null;
    },
  });
}

async function imageInventory(urls) {
  const rows = [];
  const seen = new Set();
  for (const url of urls) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(url).pathname); } catch { continue; }
    if (seen.has(pathname)) continue;
    seen.add(pathname);
    if (!/\.(png|webp|jpe?g|avif|ktx2|basis)$/i.test(pathname)) continue;
    const file = path.join(PORTAL_ROOT, pathname);
    const buffer = existsSync(file) ? await readFile(file) : null;
    const dims = buffer ? readImageDimensions(buffer) : null;
    rows.push({
      url: pathname,
      fileBytes: buffer?.length ?? 0,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      decodedRgbaBytes: dims ? dims.width * dims.height * 4 : null,
    });
  }
  rows.sort((a, b) => (b.decodedRgbaBytes ?? 0) - (a.decodedRgbaBytes ?? 0));
  return rows;
}

async function runPass({ mode, profileId, cpu = 1 }) {
  const profile = PROFILES[profileId];
  assert.ok(profile, `unknown profile ${profileId}`);
  const census = mode === 'census';
  const query = `evidenceSafe=1&endurancePressurePilot=1${WEAPON_PILOTS[weapon]}${census ? '&telemetry=1' : ''}`;
  const session = {
    sessionId: `hmh-perf-crowd-${mode}-${profileId}-${cpu}x`,
    gameId: 'lester-blaster',
    mode: 'free',
    heroId: 'lit-commando',
    profile: { displayName: 'Crowd Bench', locale: 'en' },
    session: { seed, buildHash: 'hmh-perf-crowd-bench', seasonId: 'season-1', rankedEligible: false },
    settings: { musicEnabled: true, screenShake: true, gore, reduceMotion: false, reduceFlash: false, colorblindTags: false },
  };
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info',
      // A phone plays SFX after the first tap; without this headless Chrome
      // rejects every HTMLAudioElement.play() and the audio path goes unmeasured.
      '--autoplay-policy=no-user-gesture-required'],
  });
  const started = Date.now();
  try {
    const context = await browser.newContext({ ...profile });
    const page = await context.newPage();
    const errors = [];
    // Every response URL, including worker fetches (Pixi decodes textures in a
    // worker, so the window's resource timing buffer never sees them).
    const responseUrls = new Set();
    context.on('response', (response) => responseUrls.add(response.url()));
    const pending = new Map();
    context.on('request', (request) => {
      pending.set(request, Date.now());
      if (request.url().includes('/audio/sfx/')) network.sfxRequests += 1;
    });
    context.on('requestfinished', (request) => pending.delete(request));
    // ERR_ABORTED is the SFX voice allocator stopping or stealing an
    // HTMLAudioElement mid-load (counted, not an error); anything else is.
    const network = { aborted: 0, sfxRequests: 0 };
    context.on('requestfailed', (request) => {
      pending.delete(request);
      const reason = request.failure()?.errorText ?? '';
      if (reason === 'net::ERR_ABORTED') network.aborted += 1;
      else errors.push(`request failed: ${request.url()} ${reason}`);
    });
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    // The instrumentation is injected as the first script of the child
    // document. An init script is not reliable here: the iframe's initial
    // about:blank Window is reused for the same-origin navigation, and
    // Playwright's init script was observed running against about:blank only.
    const instrumentation = `<script>(${childInstrumentation.toString()})(${JSON.stringify({
      census,
      virtualClock: census ? censusTicksPerFrame : 0,
      stopAtTick: census ? censusTicks : 0,
      textures: census,
    })});</script>`;
    const intercepted = {
      host: async () => ({ type: 'text/html; charset=utf-8', body: hostHtml(session, query) }),
      sdk: async (url) => {
        const file = path.join(ROOT, 'sdk', path.basename(new URL(url).pathname));
        return existsSync(file) ? { type: 'text/javascript; charset=utf-8', body: await readFile(file, 'utf8') } : null;
      },
      child: async () => {
        const html = await readFile(path.join(PORTAL_ROOT, 'hmh-reboot', 'index.html'), 'utf8');
        assert.ok(html.includes('<head>'), 'HMH index.html has no <head>');
        return { type: 'text/html; charset=utf-8', body: html.replace('<head>', `<head>${instrumentation}`) };
      },
    };
    const cdp = await context.newCDPSession(page);
    // Raw CDP Fetch for just these three documents. Playwright's page.route
    // disables the HTTP cache for the whole page, which turned every
    // `new Audio(url)` SFX cue into a fresh download (and, against python's
    // HTTP/1.0 server, into net::ERR_NO_BUFFER_SPACE) -- a harness artifact.
    cdp.on('Fetch.requestPaused', async ({ requestId, request }) => {
      const url = request.url;
      const kind = url.includes('/__hmh-perf-crowd/host.html') ? 'host' : url.includes('/sdk/') ? 'sdk' : 'child';
      try {
        const response = await intercepted[kind](url);
        if (!response) {
          await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 404, body: Buffer.from('not found').toString('base64') });
          return;
        }
        await cdp.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: response.type }, { name: 'Cache-Control', value: 'no-store' }],
          body: Buffer.from(response.body).toString('base64'),
        });
      } catch (error) {
        errors.push(`bench interception ${url}: ${error.message}`);
        await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {});
      }
    });
    await cdp.send('Fetch.enable', {
      patterns: [
        { urlPattern: `${origin}/__hmh-perf-crowd/host.html*`, requestStage: 'Request' },
        { urlPattern: `${origin}/sdk/*`, requestStage: 'Request' },
        { urlPattern: `${origin}/hmh-reboot/index.html*`, requestStage: 'Request' },
      ],
    });
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.goto(`${origin}/__hmh-perf-crowd/host.html`, { waitUntil: 'load' });
    const childFrame = async () => {
      for (let attempt = 0; attempt < 400; attempt += 1) {
        const frame = page.frames().find((candidate) => candidate.url().includes('/hmh-reboot/index.html'));
        if (frame) return frame;
        await page.waitForTimeout(50);
      }
      throw new Error('HMH child frame never attached');
    };
    const frame = await childFrame();
    const readTick = () => frame.evaluate(() => Number(document.querySelector('#hmhRebootStage')?.dataset.simulationStepsTotal ?? 0));
    const waitForTick = async (target, timeoutMs) => {
      const deadline = Date.now() + timeoutMs;
      let lastLog = Date.now();
      for (;;) {
        const tick = await readTick().catch(() => 0);
        if (tick >= target) return tick;
        if (options.verbose && Date.now() - lastLog > 5_000) {
          lastLog = Date.now();
          const status = await frame.evaluate(() => {
            const data = document.querySelector('#hmhRebootStage')?.dataset ?? {};
            const panel = document.querySelector('#hmhUpgradePanel');
            return {
              state: data.simulationState, startup: data.startupArt, nav: data.navGridReady,
              status: document.querySelector('#hmhRebootStatus')?.textContent,
              upgradePanelHidden: panel?.hidden, upgradeChoices: panel?.querySelectorAll('.hmh-upgrade-choice').length,
              upgradePicks: globalThis.__hmhBench?.upgradePicks,
            };
          }).catch((error) => ({ error: error.message }));
          const host = await page.evaluate(() => window.__hmhBenchHost).catch(() => null);
          console.error(`[bench] waiting for tick ${target}: tick ${tick} ${JSON.stringify(status)} host ${JSON.stringify(host)} errors ${errors.length}`);
        }
        if (Date.now() > deadline) {
          const host = await page.evaluate(() => window.__hmhBenchHost).catch(() => null);
          const stage = await frame.evaluate(() => {
            const data = document.querySelector('#hmhRebootStage')?.dataset ?? {};
            const keys = ['simulationState', 'startupArt', 'navGridReady', 'authoredPropStatus', 'nativePropStatus', 'worldDesignStatus', 'terrainTiles', 'terrainTilesLoaded', 'enemyRosterLoaded', 'heroMotionStatus', 'enemyArt'];
            return Object.fromEntries(keys.map((key) => [key, data[key] ?? null]));
          }).catch((error) => ({ error: error.message }));
          const stalled = [...pending.entries()].map(([request, at]) => `${request.url().replace(origin, '')} (${Date.now() - at} ms)`);
          const error = new Error(`tick ${tick} < ${target} after ${timeoutMs} ms; host ${JSON.stringify(host)}; stage ${JSON.stringify(stage)}; pending ${JSON.stringify(stalled)}; errors ${JSON.stringify(errors)}`);
          error.bootStall = target <= 1;
          throw error;
        }
        await page.waitForTimeout(100);
      }
    };
    // One trusted key press grants user activation (audio unlock), exactly
    // like a player's first input. Shift is unbound, so the simulation never
    // sees it.
    await waitForTick(1, 150_000);
    await page.keyboard.press('ShiftLeft');
    let pinning = null;
    if (affinity) {
      const processes = await browserProcesses(browser);
      pinning = { mask: affinity, applied: pinProcesses(processes, affinity), processes: processes.map(({ type, id }) => ({ type, id })) };
    }
    const hostState = await page.evaluate(() => window.__hmhBenchHost);
    assert.equal(hostState.errors.length, 0, `bridge errors ${JSON.stringify(hostState.errors)}`);
    const bootMs = Date.now() - started;

    if (census) {
      const endTick = await waitForTick(censusTicks, 600_000);
      const bench = await frame.evaluate(() => ({
        census: globalThis.__hmhBench.census,
        textures: globalThis.__hmhBench.textureReport(),
        resources: performance.getEntriesByType('resource').map(({ name, encodedBodySize, decodedBodySize }) => ({ name, encodedBodySize, decodedBodySize })),
        stage: { ...document.querySelector('#hmhRebootStage').dataset },
        upgradePicks: globalThis.__hmhBench.upgradePicks,
      }));
      const samples = bench.census.filter((sample) => sample.tick <= censusTicks);
      const shot = path.join(outDir, `census-${profileId}.png`);
      await page.screenshot({ path: shot });
      const images = await imageInventory([...new Set([...responseUrls, ...bench.resources.map((entry) => entry.name)])]);
      // GPU uploads arrive as ImageBitmaps with no URL; match them to the
      // fetched image files by decoded size.
      bench.textures.textures = bench.textures.textures.map((texture) => ({
        ...texture,
        candidates: images.filter((image) => image.width === texture.width && image.height === texture.height).map((image) => image.url),
      }));
      return {
        mode, profileId, cpu: 1, seed, gore, weapon, bootMs, endTick, gpu: await webglRenderer(frame), abortedRequests: network.aborted,
        censusTicks, ticksPerFrame: censusTicksPerFrame, samples,
        traceDigest: traceDigest(samples, SIM_FIELDS),
        upgradePicks: bench.upgradePicks,
        performanceProfile: bench.stage.performanceProfile,
        renderResolution: Number(bench.stage.renderResolution),
        textures: bench.textures,
        images,
        errors,
        screenshot: path.relative(ROOT, shot).replaceAll('\\', '/'),
      };
    }

    await waitForTick(warmupTicks, 300_000);
    const heapBefore = await cdp.send('Runtime.getHeapUsage');
    if (mode === 'profile') {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
      await cdp.send('Profiler.start');
    }
    if (mode === 'alloc') {
      await cdp.send('HeapProfiler.enable');
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    }
    const hostStart = cpuTimes();
    const processStart = await browserProcesses(browser);
    const before = await frame.evaluate(() => {
      const bench = globalThis.__hmhBench;
      bench.frames.length = 0; bench.frameTicks.length = 0; bench.silverVisible.length = 0; bench.longTasks.length = 0; bench.activeMs = 0;
      bench.recording = true;
      const data = document.querySelector('#hmhRebootStage').dataset;
      return { tick: Number(data.simulationStepsTotal), droppedMs: Number(data.simulationDroppedMs), catchUp: Number(data.simulationCatchUpSaturationFrames), wall: performance.now(), audio: { ...bench.audio } };
    });
    const sfxRequestsBefore = network.sfxRequests;
    const windowMs = windowSeconds * 1000;
    const deadline = Date.now() + Math.max(120_000, windowMs * 6);
    let walkLeg = -1;
    let walkLegAt = 0;
    for (;;) {
      const activeMs = await frame.evaluate(() => globalThis.__hmhBench.activeMs);
      if (activeMs >= windowMs) break;
      if (Date.now() > deadline) throw new Error(`active window stalled at ${activeMs} ms`);
      if (walk && Date.now() - walkLegAt >= WALK_LEG_MS) {
        if (walkLeg >= 0) await page.keyboard.up(WALK_KEYS[walkLeg % WALK_KEYS.length]);
        walkLeg += 1;
        walkLegAt = Date.now();
        await page.keyboard.down(WALK_KEYS[walkLeg % WALK_KEYS.length]);
      }
      await page.waitForTimeout(250);
    }
    if (walkLeg >= 0) await page.keyboard.up(WALK_KEYS[walkLeg % WALK_KEYS.length]);
    const after = await frame.evaluate(() => {
      const bench = globalThis.__hmhBench;
      bench.recording = false;
      const data = document.querySelector('#hmhRebootStage').dataset;
      return {
        tick: Number(data.simulationStepsTotal), droppedMs: Number(data.simulationDroppedMs), wall: performance.now(),
        frames: bench.frames, frameTicks: bench.frameTicks, activeMs: bench.activeMs, longTasks: bench.longTasks,
        silverVisible: bench.silverVisible.length ? { mean: bench.silverVisible.reduce((a, b) => a + b, 0) / bench.silverVisible.length, max: Math.max(...bench.silverVisible) } : null,
        upgradePicks: bench.upgradePicks, performanceProfile: data.performanceProfile,
        renderResolution: Number(data.renderResolution), adaptiveResolution: data.adaptiveResolution ?? null,
        catchUpSaturationFrames: Number(data.simulationCatchUpSaturationFrames),
        audio: { ...bench.audio },
        canvas: (() => { const canvas = document.querySelector('#hmhRebootStage canvas'); return canvas ? { width: canvas.width, height: canvas.height } : null; })(),
      };
    });
    let hotspots = null;
    let profilePath = null;
    if (mode === 'profile') {
      const { profile: cpuProfile } = await cdp.send('Profiler.stop');
      profilePath = path.join(outDir, `profile-${profileId}-${cpu}x.cpuprofile`);
      await writeFile(profilePath, JSON.stringify(cpuProfile));
      hotspots = await resolveHotspots(cpuProfile);
    }
    let allocations = null;
    let heapProfilePath = null;
    if (mode === 'alloc') {
      const { profile: heapProfile } = await cdp.send('HeapProfiler.stopSampling');
      heapProfilePath = path.join(outDir, `alloc-${profileId}-${cpu}x.heapprofile`);
      await writeFile(heapProfilePath, JSON.stringify(heapProfile));
      allocations = await resolveAllocations(heapProfile);
    }
    const heapAfter = await cdp.send('Runtime.getHeapUsage');
    const shot = path.join(outDir, `${mode}-${profileId}-${cpu}x.png`);
    await page.screenshot({ path: shot });
    const frames = after.frames.slice(1);
    const summary = summarizeFrameTimes(frames);
    const hostBusy = hostBusyPct(hostStart, cpuTimes());
    const processEnd = await browserProcesses(browser);
    const processCpuSeconds = {};
    for (const entry of processEnd) {
      const start = processStart.find((candidate) => candidate.id === entry.id)?.cpuTime ?? 0;
      processCpuSeconds[entry.type] = (processCpuSeconds[entry.type] ?? 0) + Math.max(0, entry.cpuTime - start);
    }
    const wallMs = after.wall - before.wall;
    return {
      mode, profileId, cpu, seed, gore, weapon, walk, bootMs,
      gpu: await webglRenderer(frame),
      abortedRequests: network.aborted,
      host: (() => {
        const cpus = os.cpus().length;
        const ownPct = (Object.values(processCpuSeconds).reduce((sum, value) => sum + value, 0) / ((wallMs / 1000) * cpus)) * 100;
        const otherPct = Math.max(0, hostBusy - ownPct);
        return { cpus, busyPct: hostBusy, benchChromePct: ownPct, otherBusyPct: otherPct, contended: otherPct > HOST_CONTENDED_PCT, pinning };
      })(),
      // CPU seconds each Chrome process type used inside the window.
      processCpuSeconds,
      viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor,
      performanceProfile: after.performanceProfile, renderResolution: after.renderResolution,
      adaptiveResolution: after.adaptiveResolution, canvas: after.canvas,
      ticks: { from: before.tick, to: after.tick, advanced: after.tick - before.tick },
      simSpeed: (after.tick - before.tick) / (wallMs / FIXED_STEP_MS),
      droppedMs: after.droppedMs - before.droppedMs,
      // Frames that ran the full four-step catch-up inside the window.
      catchUpSaturationFramesInWindow: after.catchUpSaturationFrames - before.catchUp,
      activeMs: after.activeMs,
      upgradePicks: after.upgradePicks,
      silverCoinsOnScreen: after.silverVisible,
      // SFX work inside the window: voices started and sample requests made.
      audio: {
        mediaPlays: after.audio.mediaPlays - before.audio.mediaPlays,
        sourceStarts: after.audio.sourceStarts - before.audio.sourceStarts,
        sfxRequests: network.sfxRequests - sfxRequestsBefore,
        sfxRequestsBeforeWindow: sfxRequestsBefore,
      },
      frames: summary,
      longTasks: { count: after.longTasks.length, over100: after.longTasks.filter((value) => value > 100).length, maxMs: Math.max(0, ...after.longTasks) },
      heap: { beforeUsed: heapBefore.usedSize, afterUsed: heapAfter.usedSize },
      hotspots: hotspots ? {
        totalMs: hotspots.totalMs, idleMs: hotspots.idleMs, busyMs: hotspots.busyMs,
        top: hotspots.functions.slice(0, 40).map(({ functionName, originalName, source, selfMs, selfPct, totalMs, totalPct }) => ({
          functionName, originalName, source, selfMs, selfPct, totalMs, totalPct,
        })),
        topByTotal: [...hotspots.functions].sort((a, b) => b.totalMs - a.totalMs).slice(0, 40)
          .map(({ functionName, originalName, source, selfMs, selfPct, totalMs, totalPct }) => ({ functionName, originalName, source, selfMs, selfPct, totalMs, totalPct })),
      } : null,
      cpuProfile: profilePath ? path.relative(ROOT, profilePath).replaceAll('\\', '/') : null,
      // Sampled (8 KiB interval) bytes allocated inside the window, garbage included.
      allocations: allocations ? {
        totalBytes: allocations.totalBytes,
        bytesPerSecond: allocations.totalBytes / (wallMs / 1000),
        bytesPerFrame: allocations.totalBytes / Math.max(1, frames.length),
        top: allocations.functions.slice(0, 40).map(({ functionName, originalName, source, selfBytes, selfPct, totalBytes, totalPct }) => ({
          functionName, originalName, source, selfBytes, selfPct, totalBytes, totalPct,
        })),
      } : null,
      heapProfile: heapProfilePath ? path.relative(ROOT, heapProfilePath).replaceAll('\\', '/') : null,
      frameTimes: frames,
      errors,
      screenshot: path.relative(ROOT, shot).replaceAll('\\', '/'),
    };
  } finally {
    await browser.close();
  }
}

// A boot that never reaches tick 1 is a harness/server stall, not a frame-time
// sample: it is retried and its diagnostics are kept.
const bootStalls = [];
async function runPassWithRetry(spec) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runPass(spec);
    } catch (error) {
      if (!error.bootStall || attempt >= 3) throw error;
      bootStalls.push({ ...spec, attempt, message: error.message.slice(0, 2000) });
      console.error(`[bench] boot stall on ${spec.mode} ${spec.profileId} ${spec.cpu ?? 1}x, retrying: ${error.message.slice(0, 400)}`);
    }
  }
}

function attachCensus(run, censusRun) {
  if (!censusRun || !run.ticks) return run;
  return { ...run, scene: summarizeCensus(censusRun.samples, { fromTick: run.ticks.from, toTick: run.ticks.to, fields: LOAD_FIELDS }) };
}

function compact(run) {
  const { frameTimes, samples, ...rest } = run;
  return rest;
}

async function main() {
  let ownServer = null;
  if (!origin) {
    ownServer = await startStaticServer(PORTAL_ROOT);
    origin = ownServer.origin;
  }
  try {
    await mainWithOrigin();
  } finally {
    if (ownServer) await new Promise((resolve) => { ownServer.server.closeAllConnections?.(); ownServer.server.close(resolve); });
  }
}

async function mainWithOrigin() {
  await assertServing();
  await mkdir(outDir, { recursive: true });
  const bundleBytes = (await stat(path.join(PORTAL_ROOT, 'dist', 'hmh-reboot', 'game.js'))).size;
  const sourceMapsPresent = existsSync(path.join(PORTAL_ROOT, 'dist', 'hmh-reboot', 'game.js.map'));
  if (options.suite) {
    const runs = [];
    const log = (run) => {
      const line = run.mode === 'census'
        ? `${run.mode} ${run.profileId}: ticks ${run.endTick} digest ${run.traceDigest.slice(0, 16)} textures ${(run.textures.textureBytes / 1048576).toFixed(1)} MiB`
        : `${run.mode} ${run.profileId} ${run.cpu}x: mean ${run.frames.meanMs.toFixed(2)} p95 ${run.frames.p95Ms.toFixed(2)} p99 ${run.frames.p99Ms.toFixed(2)} worst ${run.frames.worstMs.toFixed(1)} ms, sim ${run.simSpeed.toFixed(3)}x, host other ${run.host.otherBusyPct.toFixed(1)}% bench ${run.host.benchChromePct.toFixed(1)}%${run.host.contended ? " CONTENDED" : ""}`;
      console.log(line);
    };
    const censusMobile = await runPassWithRetry({ mode: 'census', profileId: 'mobile' }); log(censusMobile);
    const censusDesktop = await runPassWithRetry({ mode: 'census', profileId: 'desktop' }); log(censusDesktop);
    const censusRepeat = await runPassWithRetry({ mode: 'census', profileId: 'desktop' }); log(censusRepeat);
    const censusByProfile = { mobile: censusMobile, desktop: censusDesktop };
    for (const [profileId, cpu] of [['mobile', 4], ['mobile', 6], ['desktop', 1]]) {
      for (const mode of ['timing', 'profile']) {
        // Another workload on the host skews a throttled renderer badly; a
        // contended window is re-measured (up to --retries times) and every
        // discarded attempt stays in the report.
        const discarded = [];
        let run = attachCensus(await runPassWithRetry({ mode, profileId, cpu }), censusByProfile[profileId]);
        log(run);
        while (run.host.contended && discarded.length < retries) {
          discarded.push({ hostBusyPct: run.host.busyPct, meanMs: run.frames.meanMs, p95Ms: run.frames.p95Ms });
          run = attachCensus(await runPassWithRetry({ mode, profileId, cpu }), censusByProfile[profileId]);
          log(run);
        }
        runs.push({ ...run, discardedContendedAttempts: discarded });
      }
    }
    const report = {
      schema: 'hmh-perf-crowd-bench-v1',
      generatedAt: new Date().toISOString(),
      deviceAcceptance: false,
      note: 'Chrome CPU-throttle proxy for an iPhone XS Max; GPU work is not throttled. Not physical-device evidence.',
      origin, seed, gore, weapon, windowSeconds, warmupTicks, affinity,
      bundleBytes, sourceMapsPresent,
      scenario: 'evidenceSafe=1&endurancePressurePilot=1 (128 endurance-band enemies at tick 0, invulnerable auto-firing hero, no respawns), parent-hosted Free session',
      census: {
        ticks: censusTicks,
        ticksPerFrame: censusTicksPerFrame,
        mobileDigest: censusMobile.traceDigest,
        desktopDigest: censusDesktop.traceDigest,
        desktopRepeatDigest: censusRepeat.traceDigest,
        reproducible: censusDesktop.traceDigest === censusRepeat.traceDigest,
        profileIndependent: censusDesktop.traceDigest === censusMobile.traceDigest,
        timeline: censusMobile.samples.filter((_, index) => index % 15 === 0)
          .map(({ tick, enemies, projectiles, corpses, goreMarks, goreFragments, silverActive, killFxShards, animatedEnemies, combatEvents, weaponVfx, displaysCreated, displaysReused }) => (
            { tick, enemies, projectiles, corpses, goreMarks, goreFragments, silverActive, killFxShards, animatedEnemies, combatEvents, weaponVfx, displaysCreated, displaysReused })),
      },
      textures: {
        mobile: { ...censusMobile.textures, textures: censusMobile.textures.textures.slice(0, 40), textureCount: censusMobile.textures.textures.length },
        desktop: { ...censusDesktop.textures, textures: censusDesktop.textures.textures.slice(0, 40), textureCount: censusDesktop.textures.textures.length },
        images: censusMobile.images,
      },
      bootStalls,
      runs: runs.map(compact),
    };
    const summaryPath = path.join(outDir, 'suite-report.json');
    await writeFile(summaryPath, JSON.stringify({ ...report, runFrameTimes: runs.map((run) => ({ mode: run.mode, profileId: run.profileId, cpu: run.cpu, frameTimes: run.frameTimes })) }, null, 2));
    if (options.record) {
      const recordPath = path.join(ROOT, 'docs', 'testing', 'hmh-perf-crowd-baseline.json');
      await writeFile(recordPath, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`recorded ${path.relative(ROOT, recordPath)}`);
    }
    console.log(`suite report ${path.relative(ROOT, summaryPath)}`);
    const errors = [censusMobile, censusDesktop, censusRepeat, ...runs].flatMap((run) => run.errors);
    assert.deepEqual(errors, [], 'browser errors during the suite');
    return;
  }
  const mode = String(options.mode ?? 'timing');
  assert.ok(['timing', 'profile', 'alloc', 'census'].includes(mode), 'mode must be timing, profile, alloc or census');
  const profileId = String(options.profile ?? 'mobile');
  const cpu = Number(options.cpu ?? (profileId === 'mobile' ? 4 : 1));
  assert.ok(Number.isFinite(cpu) && cpu >= 1 && cpu <= 20, 'cpu throttle must be 1-20');
  const run = await runPassWithRetry({ mode, profileId, cpu });
  const file = path.join(outDir, `${mode}-${profileId}-${mode === 'census' ? 1 : cpu}x.json`);
  await writeFile(file, JSON.stringify(run, null, 2));
  if (mode === 'census') {
    console.log(JSON.stringify({ mode, profileId, endTick: run.endTick, traceDigest: run.traceDigest, textureBytes: run.textures.textureBytes, textureCount: run.textures.textures.length, errors: run.errors }, null, 2));
  } else {
    console.log(JSON.stringify({ ...compact(run), hotspots: run.hotspots ? { ...run.hotspots, top: run.hotspots.top.slice(0, 15), topByTotal: run.hotspots.topByTotal.slice(0, 15) } : null, report: path.relative(ROOT, file) }, null, 2));
  }
  assert.deepEqual(run.errors, [], 'browser errors during the run');
}

await main();
