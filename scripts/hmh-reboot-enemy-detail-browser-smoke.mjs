import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const candidateBundlePath = fileURLToPath(new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url));
const terrainManifestPath = fileURLToPath(new URL('../apps/portal/assets/generated/hmh-terrain-tiles/hmh-terrain-tiles.json', import.meta.url));
const terrainTileRootPath = fileURLToPath(new URL('../apps/portal/assets/generated/hmh-terrain-tiles/', import.meta.url));
const expectedArchetypes = Object.freeze([
  'bagholder-rusher',
  'forkrunner',
  'liquidator-agent',
  'whale-enforcer',
  'gas-bomber',
  'validator-cultist',
]);
const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

async function inspectProfile({ name, viewport, deviceScaleFactor, isMobile = false }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, isMobile, hasTouch: isMobile, serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const errors = [];
  let candidateBundleRequests = 0;
  await page.route('**/dist/hmh-reboot/game.js', (route) => {
    candidateBundleRequests += 1;
    return route.fulfill({ path: candidateBundlePath, contentType: 'text/javascript', headers: { 'Cache-Control': 'no-store' } });
  });
  await page.route('**/assets/generated/hmh-terrain-tiles/hmh-terrain-tiles.json', (route) => route.fulfill({
    path: terrainManifestPath,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  }));
  await page.route('**/assets/generated/hmh-terrain-tiles/*.png', (route) => {
    const filename = new URL(route.request().url()).pathname.split('/').at(-1);
    if (!/^[a-z-]+\.png$/.test(filename)) return route.abort('blockedbyclient');
    return route.fulfill({ path: join(terrainTileRootPath, filename), contentType: 'image/png', headers: { 'Cache-Control': 'no-store' } });
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${origin}/hmh-reboot/index.html?debugGrid=1&evidenceSafe=1&rosterPreview=1&candidate=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster', null, { timeout: 10_000 });
  try {
    await page.waitForFunction((ids) => {
      const stage = document.querySelector('#hmhRebootStage');
      const active = new Set((stage?.dataset.enemyArchetypes ?? '').split(',').filter(Boolean));
      const loaded = new Set((stage?.dataset.enemyRosterLoaded ?? '').split(',').filter(Boolean));
      return ids.every((id) => active.has(id) && loaded.has(id))
        && stage?.dataset.enemyArt === 'production-roster-atlas-v1';
    }, expectedArchetypes, { timeout: 30_000 });
  } catch (error) {
    const diagnostic = await page.locator('#hmhRebootStage').evaluate((stage) => ({
      active: stage.dataset.enemyArchetypes,
      loaded: stage.dataset.enemyRosterLoaded,
      enemyArt: stage.dataset.enemyArt,
      rosterError: stage.dataset.enemyRosterError,
      rosterPreview: stage.dataset.rosterPreview,
      rosterPreviewAutoFire: stage.dataset.rosterPreviewAutoFire,
      directorInsertions: stage.dataset.directorInsertions,
      directorLastReason: stage.dataset.directorLastReason,
    }));
    throw new Error(`${name}: production roster readiness timed out: ${JSON.stringify(diagnostic)}`, { cause: error });
  }

  const state = await page.locator('#hmhRebootStage').evaluate((stage) => ({
    active: stage.dataset.enemyArchetypes.split(','),
    loaded: stage.dataset.enemyRosterLoaded.split(',').sort(),
    enemyArt: stage.dataset.enemyArt,
    enemyCount: Number(stage.dataset.enemyCount),
    rosterError: stage.dataset.enemyRosterError,
    rosterPreview: stage.dataset.rosterPreview,
    rosterPreviewAutoFire: stage.dataset.rosterPreviewAutoFire,
    directorInsertions: Number(stage.dataset.directorInsertions),
    directorLastReason: stage.dataset.directorLastReason,
    canvasCount: stage.querySelectorAll('canvas').length,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  assert.deepEqual(state.active, expectedArchetypes, `${name}: preview composition drifted`);
  assert.deepEqual(state.loaded, [...expectedArchetypes].sort(), `${name}: not every production atlas loaded`);
  assert.equal(state.enemyArt, 'production-roster-atlas-v1');
  assert.equal(state.enemyCount, expectedArchetypes.length);
  assert.equal(state.rosterError, '');
  assert.equal(state.rosterPreview, 'true');
  assert.equal(state.rosterPreviewAutoFire, 'false');
  assert.equal(state.directorInsertions, 0);
  assert.equal(state.directorLastReason, 'roster-preview');
  assert.equal(candidateBundleRequests, 1, `${name}: current candidate bundle route was not exercised exactly once`);
  assert.equal(state.canvasCount, 1);
  assert.ok(state.scrollWidth <= state.viewportWidth + 1, `${name}: horizontal overflow`);
  assert.deepEqual(errors, []);

  const screenshotPath = process.env[`HMH_ENEMY_DETAIL_${name.toUpperCase()}_SCREENSHOT`];
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: false });
  await context.close();
  return { name, ...state, errors };
}

try {
  const desktop = await inspectProfile({ name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const mobile = await inspectProfile({ name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  console.log(JSON.stringify({ status: 'PASS', desktop, mobile }));
} finally {
  await browser.close();
}
