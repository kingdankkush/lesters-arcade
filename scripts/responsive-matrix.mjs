import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const portalRoot = fileURLToPath(new URL('../apps/portal', import.meta.url));
const evidenceDir = fileURLToPath(new URL('../docs/testing/VISUAL_BASELINES/current/responsive-matrix', import.meta.url));
const reportJson = fileURLToPath(new URL('../docs/testing/responsive-matrix.json', import.meta.url));
const reportMd = fileURLToPath(new URL('../docs/testing/responsive-matrix.md', import.meta.url));
const chromePath = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate));

if (!chromePath) throw new Error('Responsive matrix requires Chrome or Edge. Set CHROME_PATH.');

const VIEWPORTS = Object.freeze([
  { id: 'iphone-portrait', width: 390, height: 844, dpr: 3, mobile: true },
  { id: 'android-portrait', width: 412, height: 915, dpr: 2.625, mobile: true },
  { id: 'phone-landscape', width: 844, height: 390, dpr: 3, mobile: true },
  { id: 'tablet-landscape', width: 1024, height: 768, dpr: 2, mobile: true },
  { id: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
]);

const STATES = Object.freeze([
  { id: 'splash', path: '/', expectedStep: 'wallet-splash' },
  { id: 'cabinet-select', path: '/games', expectedStep: 'cabinet-select' },
  { id: 'mode-select', path: '/games/hard-money-heroes', expectedStep: 'mode-select' },
  { id: 'profile', path: '/profile', expectedStep: 'profile' },
  { id: 'scores', path: '/scores', expectedStep: 'leaderboards' },
  { id: 'settings', path: '/settings', expectedStep: 'settings' },
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findOpenPort(preferred) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', () => {
      const fallback = createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const { port } = fallback.address();
        fallback.close(() => resolve(port));
      });
    });
    probe.listen(preferred, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function fetchJson(url, attempts = 80) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    } catch (error) {
      lastError = error;
      await sleep(125);
    }
  }
  throw lastError;
}

function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = new Map();
  const listeners = new Map();
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      else item.resolve(message.result ?? {});
      return;
    }
    if (!message.method) return;
    for (const listener of listeners.get(message.method) ?? []) listener(message.params ?? {});
    const eventWaiters = waiters.get(message.method) ?? [];
    for (const waiter of eventWaiters) waiter(message.params ?? {});
    if (eventWaiters.length) waiters.delete(message.method);
  });
  return {
    async send(method, params = {}) {
      await opened;
      const requestId = ++id;
      socket.send(JSON.stringify({ id: requestId, method, params }));
      return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
    },
    async waitFor(method, timeoutMs = 15000) {
      await opened;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
        const list = waiters.get(method) ?? [];
        list.push((params) => { clearTimeout(timer); resolve(params); });
        waiters.set(method, list);
      });
    },
    on(method, listener) {
      const list = listeners.get(method) ?? [];
      list.push(listener);
      listeners.set(method, list);
    },
    close() { try { socket.close(); } catch {} },
  };
}

async function evaluate(client, expression, timeout = 30000) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime.evaluate failed');
  return result.result?.value;
}

function markdown(report) {
  const lines = [
    '# Responsive and accessibility matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Result: **${report.pass ? 'PASS' : 'FAIL'}**`,
    '',
    `Coverage: ${report.viewportCount} viewports × ${report.stateCount} states = ${report.captureCount} browser captures.`,
    '',
    '| Viewport | State | Step | Overflow | Clipped | A11y | Touch | Console | Result |',
    '|---|---|---|---:|---:|---:|---:|---:|---|',
  ];
  for (const row of report.rows) {
    lines.push(`| ${row.viewport} ${row.width}×${row.height} | ${row.state} | ${row.step} | ${row.horizontalOverflowPx} | ${row.clippedInteractive.length} | ${row.unnamedInteractive.length} | ${row.smallTouchTargets.length} | ${row.consoleIssues.length} | ${row.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('', 'Raw PNG captures are generated under the gitignored `docs/testing/VISUAL_BASELINES/current/responsive-matrix/` directory. SHA-256 hashes and geometry evidence are retained in the JSON report.');
  return `${lines.join('\n')}\n`;
}

const serverPort = await findOpenPort(8791);
const chromePort = await findOpenPort(9222);
const userDataDir = join(tmpdir(), `lesters-responsive-${process.pid}-${Date.now()}`);
const server = spawn('python', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], { cwd: portalRoot, stdio: 'pipe' });
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--disable-extensions', '--disable-background-networking',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-sync',
  '--no-first-run', '--no-default-browser-check', `--user-data-dir=${userDataDir}`,
  `--remote-debugging-port=${chromePort}`, 'about:blank',
], { stdio: 'pipe' });
let client;
let currentIssues = [];

try {
  await mkdir(evidenceDir, { recursive: true });
  await fetchJson(`http://127.0.0.1:${chromePort}/json/version`);
  const targets = await fetchJson(`http://127.0.0.1:${chromePort}/json/list`);
  const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  if (!page) throw new Error('Chrome did not expose a page target');
  client = createCdpClient(page.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  client.on('Runtime.consoleAPICalled', (params) => {
    if (!['warning', 'error', 'assert'].includes(params.type)) return;
    currentIssues.push({ kind: `console-${params.type}`, text: params.args?.map((arg) => arg.value ?? arg.description ?? '').join(' ') ?? '' });
  });
  client.on('Runtime.exceptionThrown', (params) => {
    currentIssues.push({ kind: 'exception', text: params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? 'Uncaught exception' });
  });

  const rows = [];
  for (const viewport of VIEWPORTS) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.dpr,
      mobile: viewport.mobile,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    await client.send('Emulation.setTouchEmulationEnabled', viewport.mobile
      ? { enabled: true, maxTouchPoints: 5 }
      : { enabled: false });

    for (const state of STATES) {
      currentIssues = [];
      const loadEvent = client.waitFor('Page.loadEventFired');
      await client.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/?responsiveMatrix=1` });
      await loadEvent;
      await sleep(500);
      if (state.path !== '/') {
        await evaluate(client, `(() => { history.pushState({}, '', ${JSON.stringify(state.path)}); window.dispatchEvent(new PopStateEvent('popstate')); return true; })()`);
        await sleep(450);
      }
      const geometry = await evaluate(client, `(() => {
        const visible = (node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const describe = (node) => {
          const rect = node.getBoundingClientRect();
          return { tag: node.tagName.toLowerCase(), id: node.id || '', text: (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 80), left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
        };
        const interactive = [...document.querySelectorAll('button, a[href], input, select, textarea')].filter(visible);
        const clippedInteractive = interactive.map(describe).filter((item) => item.left < -1 || item.right > innerWidth + 1 || item.top < -1 || item.bottom > Math.max(document.documentElement.scrollHeight, innerHeight) + 1);
        const unnamedInteractive = interactive.map((node) => ({ node, item: describe(node) })).filter(({ node }) => !(node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent || node.value || '').trim()).map(({ item }) => item);
        const smallTouchTargets = ${viewport.mobile} ? interactive.map(describe).filter((item) => item.width < 44 || item.height < 44) : [];
        const imagesMissingAlt = [...document.images].filter(visible).filter((image) => !image.hasAttribute('alt')).map(describe);
        const active = document.querySelector('.official-view:not([hidden])');
        return {
          step: document.querySelector('#officialApp')?.dataset.shellStep || document.body.dataset.officialStep || active?.id || 'unknown',
          innerWidth,
          innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          clippedInteractive,
          unnamedInteractive,
          smallTouchTargets,
          imagesMissingAlt,
          visibleInteractiveCount: interactive.length,
        };
      })()`);
      const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const bytes = Buffer.from(shot.data, 'base64');
      const file = `${viewport.id}--${state.id}.png`;
      await writeFile(`${evidenceDir}/${file}`, bytes);
      const pass = geometry.step === state.expectedStep
        && geometry.horizontalOverflowPx <= 1
        && geometry.clippedInteractive.length === 0
        && geometry.unnamedInteractive.length === 0
        && geometry.imagesMissingAlt.length === 0
        && geometry.smallTouchTargets.length === 0
        && currentIssues.length === 0;
      rows.push({
        viewport: viewport.id, width: viewport.width, height: viewport.height, dpr: viewport.dpr,
        state: state.id, expectedStep: state.expectedStep, ...geometry,
        consoleIssues: currentIssues.slice(), screenshot: file,
        screenshotSha256: createHash('sha256').update(bytes).digest('hex'), pass,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    viewportCount: VIEWPORTS.length,
    stateCount: STATES.length,
    captureCount: rows.length,
    pass: rows.every((row) => row.pass),
    rows,
  };
  await writeFile(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(reportMd, markdown(report));
  console.log(`Responsive matrix ${report.pass ? 'passed' : 'failed'}: ${rows.filter((row) => row.pass).length}/${rows.length} captures.`);
  console.log(`Report: ${reportJson}`);
  if (!report.pass) {
    const failures = rows.filter((row) => !row.pass).map((row) => ({ viewport: row.viewport, state: row.state, step: row.step, overflow: row.horizontalOverflowPx, clipped: row.clippedInteractive, unnamed: row.unnamedInteractive, smallTouchTargets: row.smallTouchTargets, missingAlt: row.imagesMissingAlt, consoleIssues: row.consoleIssues }));
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }
} finally {
  client?.close();
  if (!chrome.killed) chrome.kill();
  if (!server.killed) server.kill();
  await sleep(150);
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}
