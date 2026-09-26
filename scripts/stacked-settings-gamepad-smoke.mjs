// STACKED settings card, gamepad pass (settings simplification 2026-09-24).
// Drives the real cabinet through the portal with a stubbed standard-mapping
// pad (navigator.getGamepads) at a desktop and a phone width: D-pad down walks
// the menu to the Settings tile, A opens the card on the checked preset,
// left/right change the preset (clamped, no wrap), the radio group is one stop,
// down/up wrap between Continue and the Game sounds slider, left steps the
// slider, and A toggles a checkbox. Every change must reach the parent
// player-settings key. Presentation only: the run is never started. Usage:
//   STACKED_ORIGIN=http://127.0.0.1:8797 node scripts/stacked-settings-gamepad-smoke.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const dependency = process.env.STACKED_PLAYWRIGHT_PATH || process.env.PLAYWRIGHT_PACKAGE_PATH || path.join(root, 'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(dependency).href);
const { server, origin } = process.env.STACKED_ORIGIN
  ? { server: { close(callback) { callback?.(); } }, origin: new URL(process.env.STACKED_ORIGIN).origin }
  : await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-webgl', '--enable-gpu', '--ignore-gpu-blocklist'] });
// Standard mapping: A, D-pad up/down/left/right.
const BUTTON = { A: 0, up: 12, down: 13, left: 14, right: 15 };
const reports = [];
try {
  for (const { name, mobile, width, height } of [{ name: 'desktop-1280', mobile: false, width: 1280, height: 800 }, { name: 'phone-390', mobile: true, width: 390, height: 844 }]) {
    const errors = [];
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    await context.addInitScript(() => {
      const pad = { id: 'smoke-standard-pad', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
      Object.defineProperty(globalThis, '__stackedSmokePad', { value: pad });
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    await page.locator('#officialGuestEnterButton').click();
    await page.locator('.official-cabinet-card').filter({ hasText: 'STACKED' }).click();
    await page.locator('#officialFreeModeButton').click();
    const frame = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await frame.waitForSelector('#stackedStage[data-assets-ready="true"]', { timeout: 30000 });
    // The pad is polled once per animation frame; hold each button for a few frames, then release.
    const frames = count => frame.evaluate(count => new Promise(resolve => { let seen = 0; const step = () => (++seen >= count ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); }), count);
    const press = async key => {
      await frame.evaluate(index => { globalThis.__stackedSmokePad.buttons[index].pressed = true; }, BUTTON[key]); await frames(3);
      await frame.evaluate(index => { globalThis.__stackedSmokePad.buttons[index].pressed = false; }, BUTTON[key]); await frames(3);
    };
    const active = () => frame.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    const savedWhere = predicate => frame.waitForFunction(predicate, null, { timeout: 5000 });
    assert.equal(await active(), 'continueButton', 'the menu opens on Continue');
    for (let i = 0; i < 12 && await active() !== 'settingsTile'; i++) await press('down');
    assert.equal(await active(), 'settingsTile', 'down reaches the Settings tile');
    await press('A');
    assert.equal(await frame.locator('#preferencePanel').evaluate(panel => panel.open), true, 'A on the tile opens the card');
    assert.equal(await frame.locator('#settingsTile').getAttribute('aria-expanded'), 'true');
    assert.equal(await active(), 'effectsStandard', 'focus lands on the checked preset');
    await press('right');
    assert.equal(await active(), 'effectsFull');
    await savedWhere(() => JSON.parse(localStorage.getItem('stacked-player-settings-v1') ?? 'null')?.video?.effectsPreset === 'full');
    await press('right');
    assert.equal(await active(), 'effectsFull', 'right stops at the last preset');
    await press('left'); await press('left');
    assert.equal(await active(), 'effectsCalm');
    await savedWhere(() => JSON.parse(localStorage.getItem('stacked-player-settings-v1') ?? 'null')?.video?.effectsPreset === 'calm');
    const stops = [];
    for (let i = 0; i < 14; i++) { await press('down'); stops.push(await active()); if (stops.at(-1) === 'continueButton') break; }
    const expected = ['visualizerSelect', 'ghostToggle', 'gridToggle', ...(mobile ? ['leftHandToggle'] : []), 'motionToggle', 'flashToggle', 'pieceMarksToggle', 'volumeRange', 'continueButton'];
    assert.deepEqual(stops, expected, 'down leaves the radio group as one stop, follows the card order and wraps to Continue');
    await press('up');
    assert.equal(await active(), 'volumeRange', 'up wraps from the first control to the last');
    await press('left');
    assert.equal(await frame.locator('#volumeRange').inputValue(), '30', 'left steps the slider by 5');
    await savedWhere(() => Math.abs(JSON.parse(localStorage.getItem('stacked-player-settings-v1') ?? 'null')?.audio?.sfxVolume - 0.3) < 1e-9);
    for (let i = 0; i < 6 && await active() !== 'flashToggle'; i++) await press('up');
    assert.equal(await active(), 'flashToggle');
    await press('A');
    await savedWhere(() => JSON.parse(localStorage.getItem('stacked-player-settings-v1') ?? 'null')?.accessibility?.reduceFlash === false);
    assert.equal(await frame.locator('#stackedStage').getAttribute('data-simulation-tick') ?? '0', '0', 'the menu pass never starts the run');
    reports.push({ name, stops, errors });
    console.log(JSON.stringify(reports.at(-1)));
    assert.deepEqual(errors, [], name + ' has no browser errors');
    await context.close();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close(); server.close();
}
if (!process.exitCode) console.log(`STACKED settings gamepad smoke: PASS (${reports.length} viewports)`);
