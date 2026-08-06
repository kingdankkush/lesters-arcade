import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const candidateBundlePath = fileURLToPath(new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url));
const evidenceDir = fileURLToPath(new URL('../.hermes/evidence/', import.meta.url));
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

function diagnostics(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`request: ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function candidatePage(profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = diagnostics(page);
  let bundleRequests = 0;
  await page.route('**/dist/hmh-reboot/game.js', (route) => {
    bundleRequests += 1;
    return route.fulfill({ path: candidateBundlePath, contentType: 'text/javascript', headers: { 'Cache-Control': 'no-store' } });
  });
  return { context, page, errors, bundleRequests: () => bundleRequests };
}

async function captureCanister(profile) {
  const session = await candidatePage(profile);
  const { page } = session;
  await page.goto(`${origin}/hmh-reboot/index.html?telemetry=1&evidenceSafe=1&rosterPreview=1&rosterCombat=1&candidate=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.enemyArt === 'production-roster-atlas-v1'
      && (stage.dataset.enemyRosterLoaded ?? '').split(',').includes('gas-bomber')
      && Number(stage.dataset.gasCanisterProgress) > 0
      && Number(stage.dataset.gasCanisterProgress) < 1;
  }, null, { timeout: 30_000 });
  const state = await page.locator('#hmhRebootStage').evaluate((stage) => ({
    tick: Number(stage.dataset.simulationTick),
    tells: Number(stage.dataset.enemyTells),
    canisterProgress: Number(stage.dataset.gasCanisterProgress),
    enemyArt: stage.dataset.enemyArt,
    roster: stage.dataset.enemyArchetypes,
    canvasCount: stage.querySelectorAll('canvas').length,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  assert.ok(state.tick >= 480 && state.tick < 560, `${profile.name}: missed canister tell window at ${state.tick}`);
  assert.ok(state.tells >= 1, `${profile.name}: no ordinary enemy tell was active`);
  assert.ok(state.canisterProgress > 0 && state.canisterProgress < 1, `${profile.name}: canister draw proof was absent`);
  assert.match(state.roster, /gas-bomber/);
  assert.equal(state.enemyArt, 'production-roster-atlas-v1');
  assert.equal(state.canvasCount, 1);
  assert.ok(state.scrollWidth <= state.viewportWidth + 1);
  assert.equal(session.bundleRequests(), 1);
  assert.deepEqual(session.errors, []);
  const screenshot = join(evidenceDir, `a14-canister-${profile.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await session.context.close();
  return { ...state, screenshot };
}

async function captureBossPhase(profile) {
  const session = await candidatePage(profile);
  const { page } = session;
  await page.addInitScript(() => {
    window.__hmhAudioSources = [];
    class ProbeAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.preload = '';
        this.volume = 1;
        this.currentTime = 0;
        this.ended = false;
        this.paused = true;
        window.__hmhAudioSources.push(String(src));
      }
      play() { this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
    }
    Object.defineProperty(window, 'Audio', { value: ProbeAudio, configurable: true });
  });
  await page.goto(`${origin}/hmh-reboot/index.html?telemetry=1&evidenceSafe=1&boss=1&candidate=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.bossArt === 'production-roster-atlas-v1');
  await page.locator('canvas').focus();
  for (let step = 0; step < 80; step += 1) {
    const actor = await page.locator('#hmhRebootStage').evaluate((stage) => ({ x: Number(stage.dataset.actorX), y: Number(stage.dataset.actorY) }));
    const keys = [];
    if (Math.abs(1_380 - actor.x) > 24) keys.push(actor.x < 1_380 ? 'd' : 'a');
    if (Math.abs(2_500 - actor.y) > 24) keys.push(actor.y < 2_500 ? 's' : 'w');
    if (keys.length === 0) break;
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(75);
    for (const key of keys) await page.keyboard.up(key);
  }
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.bossPhase === 'margin-call', null, { timeout: 35_000 });
  const state = await page.locator('#hmhRebootStage').evaluate((stage) => ({
    tick: Number(stage.dataset.simulationTick),
    phase: stage.dataset.bossPhase,
    bossArt: stage.dataset.bossArt,
    canvasCount: stage.querySelectorAll('canvas').length,
    audioSources: [...window.__hmhAudioSources],
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  assert.equal(state.phase, 'margin-call');
  assert.ok(state.tick >= 1_201);
  assert.ok(state.audioSources.some((src) => src === '../assets/audio/sfx/boss-warning.ogg'), `${profile.name}: boss phase sample was not requested`);
  assert.equal(state.canvasCount, 1);
  assert.ok(state.scrollWidth <= state.viewportWidth + 1);
  assert.equal(session.bundleRequests(), 1);
  assert.deepEqual(session.errors, []);
  const screenshot = join(evidenceDir, `a15-phase-audio-${profile.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await session.context.close();
  return { ...state, screenshot };
}

const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, mobile: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, mobile: true },
];

try {
  const results = [];
  for (const profile of profiles) {
    results.push(await captureCanister(profile));
    results.push(await captureBossPhase(profile));
  }
  console.log(JSON.stringify({ status: 'PASS', results }));
} finally {
  await browser.close();
}
