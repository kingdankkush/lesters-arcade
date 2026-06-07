import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    if (process.env.PLAYWRIGHT_PACKAGE_PATH) return createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH);
    return null;
  }
}

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const screenshotPath = fileURLToPath(new URL('../docs/game-design/pixellab-calibration-browser-smoke.png', import.meta.url));

const calibrationSpritePaths = [
  './assets/generated/pixellab-calibration/lester-hero-6d6e53e2/rotations/east.png',
  './assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/idle-combat-ready/east/00.png',
  './assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/run-side-scroll/east/00.png',
  './assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/shoot-blaster/east/00.png',
];

const productionSpritePaths = [
  './assets/generated/hmh-isometric-pixellab/contact-sheets/hmh-isometric-pixellab-wave-1-contact-sheet.png',
  './assets/generated/hmh-isometric-pixellab/character/lester-iso-hero/extracted/008-download.bin/HMH_ISO_Lester_Isometric_Hero/rotations/east.png',
  './assets/generated/hmh-production-art-pass/characters/lester-iso-hero/run/frame-00.png',
  './assets/generated/hmh-production-art-pass/ui/xp-bar-frame.png',
  './assets/generated/hmh-production-art-pass/cabinet/hard-money-heroes-cabinet-00.png',
];

const smokeSpritePaths = [...calibrationSpritePaths, ...productionSpritePaths];

const requiredResourceFragments = [
  'pixellab-calibration/lester-hero-6d6e53e2/runtime-manifest.mjs',
  'hmh-isometric-pixellab/hmh-isometric-pixellab-wave-1.mjs',
  'hmh-production-art-pass/hmh-production-art-pass.mjs',
];

async function findOpenPort(preferredPort = 8791) {
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
    probe.listen(preferredPort, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, attempts = 20) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError;
}

async function fetchJson(url, init, attempts = 30) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw lastError;
}

async function verifySmokeSprites(pageEvaluate) {
  const sprites = await pageEvaluate(`(() => {
    const paths = ${JSON.stringify(smokeSpritePaths)};
    return Promise.all(paths.map((src) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ src, ok: true, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ src, ok: false, width: 0, height: 0 });
      image.src = src;
    })));
  })()`);
  for (const sprite of sprites) {
    if (!sprite.ok || sprite.width <= 0 || sprite.height <= 0) throw new Error(`sprite failed to load in browser: ${JSON.stringify(sprite)}`);
  }
  return sprites;
}

function assertRequiredResources(resourceNames) {
  for (const fragment of requiredResourceFragments) {
    if (!resourceNames.some((name) => name.includes(fragment))) {
      throw new Error(`browser resource timeline missing ${fragment}`);
    }
  }
}

function browserExecutablePath() {
  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

class CdpClient {
  constructor(wsUrl) {
    if (typeof WebSocket === 'undefined') throw new Error('Node global WebSocket is unavailable; install Playwright or run under Node 22+.');
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => this.onMessage(event));
    this.ws.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('CDP websocket closed'));
      this.pending.clear();
    });
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) ?? [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }

  onMessage(event) {
    const message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      else pending.resolve(message.result ?? {});
      return;
    }
    for (const handler of this.handlers.get(message.method) ?? []) handler(message.params ?? {});
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.ws.close();
  }
}

async function cdpEvaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return response.result?.value;
}

async function cdpWaitFor(client, expression, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cdpEvaluate(client, expression).catch(() => false)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

async function runPlaywrightSmoke(chromium, portalUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleMessages.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle' });
    await page.locator('#officialConnectButton').click();
    await page.locator('.official-cabinet-card.playable').first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('.official-cabinet-card.playable').first().click();
    await page.locator('#officialFreeModeButton').click();
    await page.locator('#officialBeginLevelButton').click();
    await page.locator('#combatCanvas').waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(600);
    await page.keyboard.down('d');
    await page.waitForTimeout(650);
    await page.keyboard.up('d');
    await page.locator('#combatCanvas').click({ position: { x: 420, y: 170 } });
    await page.waitForTimeout(500);

    const canvasDataUrlLength = await page.locator('#combatCanvas').evaluate((canvas) => canvas.toDataURL('image/png').length);
    if (canvasDataUrlLength < 5000) throw new Error(`combat canvas smoke screenshot data is unexpectedly small: ${canvasDataUrlLength}`);

    const sprites = await verifySmokeSprites((expression) => page.evaluate(expression));
    const resourceNames = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
    assertRequiredResources(resourceNames);

    await mkdir(fileURLToPath(new URL('../docs/game-design', import.meta.url)), { recursive: true });
    await page.locator('#combatCanvas').screenshot({ path: screenshotPath });

    const unexpectedConsole = consoleMessages.filter((message) => !message.includes('AudioContext was not allowed to start'));
    if (pageErrors.length) throw new Error(`browser page errors: ${pageErrors.join(' | ')}`);
    if (unexpectedConsole.some((message) => message.startsWith('error:'))) {
      throw new Error(`browser console errors: ${unexpectedConsole.join(' | ')}`);
    }

    return { canvasDataUrlLength, sprites, driver: 'playwright' };
  } finally {
    await browser.close();
  }
}

async function runChromeCdpSmoke(portalUrl) {
  const executablePath = browserExecutablePath();
  if (!executablePath) throw new Error('Playwright is not installed and no Chrome/Edge executable was found for CDP browser smoke.');
  const debugPort = await findOpenPort(9222);
  const userDataDir = await mkdtemp(join(tmpdir(), 'hmh-browser-smoke-'));
  const browser = spawn(executablePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    'about:blank',
  ], { stdio: 'pipe' });

  let browserError = '';
  browser.stderr.on('data', (chunk) => { browserError += chunk.toString(); });

  let client = null;
  try {
    const base = `http://127.0.0.1:${debugPort}`;
    await fetchJson(`${base}/json/version`);
    const target = await fetchJson(`${base}/json/new?${encodeURIComponent(portalUrl)}`, { method: 'PUT' });
    client = new CdpClient(target.webSocketDebuggerUrl);
    const consoleMessages = [];
    const pageErrors = [];

    client.on('Runtime.consoleAPICalled', (params) => {
      if (!['error', 'warning'].includes(params.type)) return;
      const text = (params.args ?? []).map((arg) => arg.value ?? arg.description ?? '').join(' ');
      consoleMessages.push(`${params.type}: ${text}`);
    });
    client.on('Runtime.exceptionThrown', (params) => {
      pageErrors.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? 'unknown page exception');
    });

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Page.navigate', { url: portalUrl });
    await cdpWaitFor(client, 'document.readyState === "complete"', 15_000);
    await cdpWaitFor(client, 'Boolean(document.querySelector("#officialConnectButton"))');

    await cdpEvaluate(client, 'document.querySelector("#officialConnectButton").click(); true');
    await cdpWaitFor(client, 'Boolean(document.querySelector(".official-cabinet-card.playable"))');
    await cdpEvaluate(client, 'document.querySelector(".official-cabinet-card.playable").click(); true');
    await cdpWaitFor(client, 'Boolean(document.querySelector("#officialFreeModeButton"))');
    await cdpEvaluate(client, 'document.querySelector("#officialFreeModeButton").click(); true');
    await cdpWaitFor(client, 'Boolean(document.querySelector("#officialBeginLevelButton"))');
    await cdpEvaluate(client, 'document.querySelector("#officialBeginLevelButton").click(); true');
    await cdpWaitFor(client, 'Boolean(document.querySelector("#combatCanvas") && !document.querySelector("#combatCanvas").hidden)');
    await sleep(600);
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
    await sleep(650);
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
    const clickPoint = await cdpEvaluate(client, '(() => { const r = document.querySelector("#combatCanvas").getBoundingClientRect(); return { x: r.left + 420, y: r.top + 170 }; })()');
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickPoint.x, y: clickPoint.y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickPoint.x, y: clickPoint.y, button: 'left', clickCount: 1 });
    await sleep(500);

    const canvasDataUrl = await cdpEvaluate(client, 'document.querySelector("#combatCanvas").toDataURL("image/png")');
    const canvasDataUrlLength = canvasDataUrl.length;
    if (canvasDataUrlLength < 5000) throw new Error(`combat canvas smoke screenshot data is unexpectedly small: ${canvasDataUrlLength}`);

    const sprites = await verifySmokeSprites((expression) => cdpEvaluate(client, expression));
    const resourceNames = await cdpEvaluate(client, 'performance.getEntriesByType("resource").map((entry) => entry.name)');
    assertRequiredResources(resourceNames);

    await mkdir(fileURLToPath(new URL('../docs/game-design', import.meta.url)), { recursive: true });
    await writeFile(screenshotPath, Buffer.from(canvasDataUrl.split(',')[1], 'base64'));

    const unexpectedConsole = consoleMessages.filter((message) => !message.includes('AudioContext was not allowed to start'));
    if (pageErrors.length) throw new Error(`browser page errors: ${pageErrors.join(' | ')}`);
    if (unexpectedConsole.some((message) => message.startsWith('error:'))) {
      throw new Error(`browser console errors: ${unexpectedConsole.join(' | ')}`);
    }

    return { canvasDataUrlLength, sprites, driver: `chrome-cdp:${executablePath}` };
  } finally {
    client?.close();
    if (!browser.killed) browser.kill();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    if (browserError && process.env.DEBUG_BROWSER_SMOKE) console.warn(browserError.trim());
  }
}

const smokePort = await findOpenPort(Number.parseInt(process.env.PORTAL_SMOKE_PORT ?? '8791', 10));
const portalUrl = `http://127.0.0.1:${smokePort}/apps/portal/`;
const server = spawn('python', ['-m', 'http.server', String(smokePort), '--bind', '127.0.0.1'], {
  cwd: repoRoot,
  stdio: 'pipe',
});

let serverError = '';
server.stderr.on('data', (chunk) => {
  serverError += chunk.toString();
});

try {
  await waitForServer(portalUrl);
  const playwright = await loadPlaywright();
  const result = playwright?.chromium
    ? await runPlaywrightSmoke(playwright.chromium, portalUrl)
    : await runChromeCdpSmoke(portalUrl);

  console.log('PixelLab + HMH isometric production browser smoke passed.');
  console.log(`Driver: ${result.driver}`);
  console.log(`Checked ${portalUrl}`);
  console.log(`Canvas data URL length: ${result.canvasDataUrlLength}`);
  console.log(`Loaded sprites: ${result.sprites.map((sprite) => `${sprite.src}=${sprite.width}x${sprite.height}`).join(', ')}`);
  console.log(`Screenshot: ${screenshotPath}`);
} finally {
  if (!server.killed) server.kill();
}

if (serverError && !serverError.includes('Address already in use')) {
  console.warn(serverError.trim());
}
