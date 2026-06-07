import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    if (!process.env.PLAYWRIGHT_PACKAGE_PATH) throw error;
    return createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH);
  }
}

const { chromium } = await loadPlaywright();

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const screenshotPath = fileURLToPath(new URL('../docs/game-design/pixellab-calibration-browser-smoke.png', import.meta.url));

async function findOpenSmokePort(preferredPort = 8791) {
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

const smokePort = await findOpenSmokePort(Number.parseInt(process.env.PORTAL_SMOKE_PORT ?? '8791', 10));
const portalUrl = `http://127.0.0.1:${smokePort}/apps/portal/`;
const server = spawn('python', ['-m', 'http.server', String(smokePort), '--bind', '127.0.0.1'], {
  cwd: repoRoot,
  stdio: 'pipe',
});

let serverError = '';
server.stderr.on('data', (chunk) => {
  serverError += chunk.toString();
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const consoleMessages = [];
const pageErrors = [];
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) consoleMessages.push(`${message.type()}: ${message.text()}`);
});
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await waitForServer(portalUrl);
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

  const pixelLabSprites = await page.evaluate(async () => {
    const paths = [
      './assets/generated/pixellab-calibration/lester-hero-6d6e53e2/rotations/east.png',
      './assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/idle-combat-ready/east/00.png',
      './assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/run-side-scroll/east/00.png',
      './assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/shoot-blaster/east/00.png',
    ];
    return Promise.all(paths.map((src) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ src, ok: true, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ src, ok: false, width: 0, height: 0 });
      image.src = src;
    })));
  });
  for (const sprite of pixelLabSprites) {
    if (!sprite.ok || sprite.width <= 0 || sprite.height <= 0) throw new Error(`PixelLab sprite failed to load in browser: ${JSON.stringify(sprite)}`);
  }

  const resourceNames = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  const requiredResourceFragments = [
    'pixellab-calibration/lester-hero-6d6e53e2/runtime-manifest.mjs',
    'pixellab-calibration/lester-hero-6d6e53e2/animations/run-side-scroll/east/00.png',
    'pixellab-calibration/lester-hero-6d6e53e2/animations/shoot-blaster/east/00.png',
  ];
  for (const fragment of requiredResourceFragments) {
    if (!resourceNames.some((name) => name.includes(fragment))) {
      throw new Error(`browser resource timeline missing ${fragment}`);
    }
  }

  await mkdir(fileURLToPath(new URL('../docs/game-design', import.meta.url)), { recursive: true });
  await page.locator('#combatCanvas').screenshot({ path: screenshotPath });

  const unexpectedConsole = consoleMessages.filter((message) => !message.includes('AudioContext was not allowed to start'));
  if (pageErrors.length) throw new Error(`browser page errors: ${pageErrors.join(' | ')}`);
  if (unexpectedConsole.some((message) => message.startsWith('error:'))) {
    throw new Error(`browser console errors: ${unexpectedConsole.join(' | ')}`);
  }

  console.log('PixelLab calibration browser smoke passed.');
  console.log(`Checked ${portalUrl}`);
  console.log(`Canvas data URL length: ${canvasDataUrlLength}`);
  console.log(`Loaded PixelLab sprites: ${pixelLabSprites.map((sprite) => `${sprite.src}=${sprite.width}x${sprite.height}`).join(', ')}`);
  console.log(`Screenshot: ${screenshotPath}`);
} finally {
  await browser.close();
  if (!server.killed) server.kill();
}

if (serverError && !serverError.includes('Address already in use')) {
  console.warn(serverError.trim());
}
