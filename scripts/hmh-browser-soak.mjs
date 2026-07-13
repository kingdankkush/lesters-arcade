import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PORTAL_ROOT = path.join(ROOT, 'apps', 'portal');
const REPORT_JSON = path.join(ROOT, 'docs', 'testing', 'hmh-browser-soak.json');
const REPORT_MD = path.join(ROOT, 'docs', 'testing', 'hmh-browser-soak.md');
const PARTIAL_JSON = path.join(ROOT, 'docs', 'testing', 'hmh-browser-soak.partial.json');
const CAPTURE_DIR = path.join(ROOT, 'docs', 'testing', 'VISUAL_BASELINES', 'current', 'soak');
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const minutesArg = process.argv.find((arg) => arg.startsWith('--minutes='));
const minutes = Number(minutesArg?.split('=')[1] ?? 30);
if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('--minutes must be a positive number');
const durationMs = Math.round(minutes * 60_000);
const sampleIntervalMs = Math.min(30_000, Math.max(2_000, Math.round(durationMs / 60)));

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function startProcess(command, args, cwd) {
  return spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}

async function waitForHttp(url, attempts = 100) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await requestText(url);
      if (response.status >= 200 && response.status < 400) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { Connection: 'close' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.once('error', reject);
    request.setTimeout(5_000, () => request.destroy(new Error(`Timed out requesting ${url}`)));
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.listeners.get(message.method) ?? []) handler(message.params ?? {});
    });
  }
  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  close() { this.ws.close(); }
}

async function evaluate(client, expression, awaitPromise = true) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Runtime evaluation failed');
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

async function main() {
  await mkdir(path.dirname(REPORT_JSON), { recursive: true });
  await mkdir(CAPTURE_DIR, { recursive: true });
  const serverPort = await freePort();
  const debugPort = await freePort();
  const profileDir = path.join(ROOT, '.tmp', `chrome-soak-${process.pid}`);
  const server = startProcess('python', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], PORTAL_ROOT);
  let chrome;
  let client;
  const consoleIssues = [];
  const samples = [];
  const startedAt = new Date();
  let bootError = null;

  try {
    await waitForHttp(`http://127.0.0.1:${serverPort}/`);
    const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
    if (!chromePath) throw new Error('Chrome/Edge executable not found');
    chrome = startProcess(chromePath, [
      '--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings',
      '--disable-features=OptimizationHints,MediaRouter,Translate,OnDeviceModel,AutofillServerCommunication',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows', '--enable-precise-memory-info', '--js-flags=--expose-gc',
      `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, 'about:blank',
    ], ROOT);
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
    const pages = JSON.parse((await requestText(`http://127.0.0.1:${debugPort}/json/list`)).text);
    client = new CdpClient(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
    await client.open();
    client.on('Runtime.consoleAPICalled', (event) => {
      if (['error', 'warning'].includes(event.type)) consoleIssues.push({ type: event.type, text: event.args.map((arg) => arg.value ?? arg.description).join(' ') });
    });
    client.on('Runtime.exceptionThrown', (event) => consoleIssues.push({ type: 'exception', text: event.exceptionDetails?.exception?.description ?? event.exceptionDetails?.text ?? 'uncaught exception' }));
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Performance.enable');
    await client.send('HeapProfiler.enable');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/?soak=1` });
    await waitFor(client, "document.readyState === 'complete' && Boolean(document.querySelector('#officialGuestEnterButton'))");
    await evaluate(client, "document.querySelector('#officialGuestEnterButton').click(); true");
    await waitFor(client, "Boolean(document.querySelector('.official-cabinet-card.playable'))");
    await evaluate(client, "document.querySelector('.official-cabinet-card.playable').click(); true");
    await waitFor(client, "Boolean(document.querySelector('#officialFreeModeButton'))");
    await evaluate(client, "document.querySelector('#officialFreeModeButton').click(); true");
    await waitFor(client, "Boolean(document.querySelector('#officialCharacterRoster button'))");
    await evaluate(client, "document.querySelector('#officialCharacterRoster button').click(); true");
    await waitFor(client, "Boolean(document.querySelector('#officialBeginLevelButton'))");
    await evaluate(client, "document.querySelector('#officialBeginLevelButton').click(); true");
    await waitFor(client, "Boolean(document.querySelector('#combatCanvas')) && !document.querySelector('#combatCanvas').hidden", 90_000);
    await waitFor(client, "(() => { const overlay = document.querySelector('#hmhLoadingOverlay'); return !overlay || overlay.hidden || getComputedStyle(overlay).display === 'none'; })()", 90_000);
    await sleep(8_000);
    await waitFor(client, "(() => { const overlay = document.querySelector('#hmhLoadingOverlay'); return !overlay || overlay.hidden || getComputedStyle(overlay).display === 'none'; })()", 90_000);

    const soakStarted = Date.now();
    let sampleIndex = 0;
    while (Date.now() - soakStarted < durationMs) {
      const key = sampleIndex % 4 < 2 ? 'd' : 'a';
      const code = key === 'd' ? 'KeyD' : 'KeyA';
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await sleep(250);
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
      const sample = await evaluate(client, `(async () => {
        const start = performance.now();
        let frames = 0;
        await new Promise((resolve) => {
          const tick = () => {
            frames += 1;
            if (performance.now() - start >= 1000) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        const elapsed = performance.now() - start;
        const canvas = document.querySelector('#combatCanvas');
        return {
          elapsedMs: performance.now(),
          fps: frames * 1000 / elapsed,
          heapUsed: performance.memory?.usedJSHeapSize ?? null,
          heapTotal: performance.memory?.totalJSHeapSize ?? null,
          domNodes: document.getElementsByTagName('*').length,
          canvasVisible: Boolean(canvas && !canvas.hidden && canvas.width > 0 && canvas.height > 0),
          shellStep: document.querySelector('#officialApp')?.dataset.shellStep ?? null,
          loading: (() => {
            const overlay = document.querySelector('#hmhLoadingOverlay');
            return Boolean(overlay && !overlay.hidden && getComputedStyle(overlay).display !== 'none');
          })(),
        };
      })()`);
      samples.push({ atSeconds: Number(((Date.now() - soakStarted) / 1000).toFixed(2)), ...sample });
      await writeFile(PARTIAL_JSON, `${JSON.stringify({
        status: 'RUNNING',
        startedAt: startedAt.toISOString(),
        requestedMinutes: minutes,
        sampleCount: samples.length,
        consoleIssues,
        samples,
      }, null, 2)}\n`);
      sampleIndex += 1;
      const remaining = durationMs - (Date.now() - soakStarted);
      if (remaining > 0) await sleep(Math.min(sampleIntervalMs, remaining));
    }

    await client.send('HeapProfiler.collectGarbage');
    await sleep(500);
    const afterGc = await evaluate(client, `({
      heapUsed: performance.memory?.usedJSHeapSize ?? null,
      heapTotal: performance.memory?.totalJSHeapSize ?? null,
      domNodes: document.getElementsByTagName('*').length,
      canvasVisible: Boolean(document.querySelector('#combatCanvas') && !document.querySelector('#combatCanvas').hidden),
    })`);
    const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(CAPTURE_DIR, 'hmh-soak-final.png'), Buffer.from(shot.data, 'base64'));

    const heaps = samples.map((sample) => sample.heapUsed).filter(Number.isFinite);
    const firstWindow = heaps.slice(0, Math.max(1, Math.ceil(heaps.length / 5)));
    const lastWindow = heaps.slice(-Math.max(1, Math.ceil(heaps.length / 5)));
    const firstMedian = median(firstWindow);
    const lastMedian = median(lastWindow);
    const heapGrowthBytes = lastMedian - firstMedian;
    const heapGrowthPercent = firstMedian > 0 ? (heapGrowthBytes / firstMedian) * 100 : 0;
    const fpsValues = samples.map((sample) => sample.fps).filter(Number.isFinite);
    const minFps = fpsValues.length ? Math.min(...fpsValues) : 0;
    const averageFps = fpsValues.length ? fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length : 0;
    const leakSuspected = heapGrowthBytes > 32 * 1024 * 1024 && heapGrowthPercent > 35;
    const pass = samples.length >= 2
      && consoleIssues.length === 0
      && samples.every((sample) => sample.canvasVisible && !sample.loading)
      && averageFps >= 50
      && minFps >= 40
      && !leakSuspected;
    const report = {
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      requestedMinutes: minutes,
      actualMinutes: Number(((Date.now() - soakStarted) / 60_000).toFixed(3)),
      status: pass ? 'PASS' : 'FAIL',
      sampleIntervalSeconds: sampleIntervalMs / 1000,
      sampleCount: samples.length,
      averageFps: Number(averageFps.toFixed(2)),
      minFps: Number(minFps.toFixed(2)),
      firstHeapMedianBytes: Math.round(firstMedian),
      lastHeapMedianBytes: Math.round(lastMedian),
      heapGrowthBytes: Math.round(heapGrowthBytes),
      heapGrowthPercent: Number(heapGrowthPercent.toFixed(2)),
      leakSuspected,
      afterGc,
      consoleIssues,
      samples,
      finalScreenshot: 'docs/testing/VISUAL_BASELINES/current/soak/hmh-soak-final.png',
    };
    await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(REPORT_MD, `# HMH Browser Soak Certificate\n\n- Status: **${report.status}**\n- Requested duration: ${report.requestedMinutes} minutes\n- Actual duration: ${report.actualMinutes} minutes\n- Samples: ${report.sampleCount}\n- Average FPS: ${report.averageFps}\n- Minimum FPS: ${report.minFps}\n- Heap growth: ${report.heapGrowthBytes} bytes (${report.heapGrowthPercent}%)\n- Leak suspected: ${report.leakSuspected ? 'yes' : 'no'}\n- Console/exception issues: ${report.consoleIssues.length}\n- Post-GC heap: ${report.afterGc.heapUsed ?? 'unavailable'} bytes\n\nRaw samples are in \`docs/testing/hmh-browser-soak.json\`. The ending screenshot is generated under the ignored current-baseline directory.\n`);
    console.log(`Browser soak ${report.status}: ${report.actualMinutes}m, ${report.sampleCount} samples, avg ${report.averageFps} FPS, min ${report.minFps} FPS, heap ${report.heapGrowthPercent}%, console issues ${report.consoleIssues.length}.`);
    await rm(PARTIAL_JSON, { force: true });
    if (!pass) process.exitCode = 1;
  } catch (error) {
    bootError = error;
    await writeFile(PARTIAL_JSON, `${JSON.stringify({
      status: 'CRASHED',
      startedAt: startedAt.toISOString(),
      failedAt: new Date().toISOString(),
      requestedMinutes: minutes,
      error: error.stack ?? error.message,
      sampleCount: samples.length,
      consoleIssues,
      samples,
    }, null, 2)}\n`).catch(() => {});
    throw error;
  } finally {
    client?.close();
    if (chrome?.pid && process.platform === 'win32') spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    else chrome?.kill();
    server.kill();
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    if (bootError) console.error(`Soak failed: ${bootError.message}`);
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
