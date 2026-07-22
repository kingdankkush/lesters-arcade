import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const root = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const decodedPath = decodeURIComponent(pathname);
    const path = resolve(root, `.${decodedPath}`);
    if (path !== root && !path.startsWith(`${root}${sep}`)) { response.writeHead(403); response.end('forbidden'); return; }
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404); response.end('not found');
  }
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const port = server.address().port;
const bundle = {};
for (const engine of ['pixi', 'phaser']) {
  const body = await readFile(`dist/${engine}.js`);
  bundle[engine] = { rawBytes: body.length, gzipBytes: gzipSync(body, { level: 9 }).length };
}
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=default', '--disable-frame-rate-limit', '--disable-gpu-vsync'] });
const profiles = [
  { id: 'desktop-normal', viewport: { width: 1920, height: 1080 }, dpr: 1, cpuRate: 1, scale: 1 },
  { id: 'desktop-stress', viewport: { width: 1920, height: 1080 }, dpr: 1, cpuRate: 1, scale: 4 },
  { id: 'mobile-normal', viewport: { width: 390, height: 844 }, dpr: 2, cpuRate: 4, scale: 1 },
  { id: 'mobile-stress', viewport: { width: 390, height: 844 }, dpr: 2, cpuRate: 4, scale: 4 },
];
const raw = [];
await mkdir('evidence', { recursive: true });
try {
  for (const profile of profiles) {
    for (const engine of ['pixi', 'phaser']) {
      for (let repeat = 0; repeat < 3; repeat += 1) {
        const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.dpr, isMobile: profile.id.startsWith('mobile'), hasTouch: profile.id.startsWith('mobile') });
        const page = await context.newPage();
        const errors = [];
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('pageerror', (error) => errors.push(error.message));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate });
        const url = `http://127.0.0.1:${port}/${engine}.html?warmup=1000&duration=4000&seed=${1987 + repeat}&scale=${profile.scale}`;
        const navigationStarted = performance.now();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => window.__HMH_BENCH_RESULT__, null, { timeout: 30000 });
        const result = await page.evaluate(() => window.__HMH_BENCH_RESULT__);
        result.navigationToResultMs = performance.now() - navigationStarted;
        result.profile = profile.id;
        result.cpuRate = profile.cpuRate;
        result.scale = profile.scale;
        result.repeat = repeat;
        result.bundle = bundle[engine];
        result.consoleErrors = errors;
        raw.push(result);
        if (repeat === 0) await page.screenshot({ path: `evidence/${engine}-${profile.id}.png` });
        console.log(profile.id, engine, repeat, result.averageFps.toFixed(2), result.p95FrameMs.toFixed(2), result.p99FrameMs.toFixed(2), errors.length);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
const summary = {};
for (const profile of profiles) {
  summary[profile.id] = {};
  for (const engine of ['pixi', 'phaser']) {
    const rows = raw.filter((row) => row.profile === profile.id && row.engine.startsWith(engine));
    summary[profile.id][engine] = {
      repeats: rows.length,
      medianFps: median(rows.map((row) => row.averageFps)),
      medianP95FrameMs: median(rows.map((row) => row.p95FrameMs)),
      medianP99FrameMs: median(rows.map((row) => row.p99FrameMs)),
      medianStartupMs: median(rows.map((row) => row.startupMs)),
      medianHeapBytes: median(rows.map((row) => row.heapUsedBytes ?? 0)),
      maxCappedFrames: Math.max(...rows.map((row) => row.cappedFrames)),
      consoleErrors: rows.reduce((sum, row) => sum + row.consoleErrors.length, 0),
      bundle: bundle[engine],
      webglRenderer: rows[0]?.webglRenderer ?? null,
    };
  }
}
const output = { capturedAt: new Date().toISOString(), profiles, counts: raw[0]?.counts, summary, raw };
await writeFile('evidence/results.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(summary, null, 2));
