// STACKED reactive-visuals evidence (owner direction 2026-09-16). Drives the real
// cabinet through the portal at desktop and phone widths, screenshots every
// menu screen (title, settings, scores, pause, results) and every backdrop
// scene (tunnel, particles, horizon, auto crossfade, off, reduced motion) with
// the music-reactive board on, and asserts the scene/pulse hooks the renderer
// publishes on #stackedStage. Usage:
//   STACKED_ORIGIN=http://127.0.0.1:8797 node scripts/stacked-reactive-evidence-smoke.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const evidenceDir = path.resolve(process.env.STACKED_EVIDENCE_DIR || path.join(root, '.hermes/evidence/stacked-reactive-20260916'));
await mkdir(evidenceDir, { recursive: true });
const dependency = process.env.STACKED_PLAYWRIGHT_PATH || process.env.PLAYWRIGHT_PACKAGE_PATH || path.join(root, 'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(dependency).href);
const { server, origin } = process.env.STACKED_ORIGIN
  ? { server: { close(callback) { callback?.(); } }, origin: new URL(process.env.STACKED_ORIGIN).origin }
  : await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-webgl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const reports = [];
try {
  for (const { name, mobile, width, height } of [{ name: 'desktop-1280', mobile: false, width: 1280, height: 800 }, { name: 'phone-390', mobile: true, width: 390, height: 844 }]) {
    const errors = [];
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    // Failed requests are errors too; a view that drops an image or media load (ERR_ABORTED) is not.
    page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText ?? 'failed';
      if (!(/ERR_ABORTED/.test(failure) && request.method() === 'GET' && !new URL(request.url()).pathname.startsWith('/api/'))) errors.push(`requestfailed ${request.url()} ${failure}`);
    });
    const shot = label => page.screenshot({ path: path.join(evidenceDir, `${name}-${label}.png`) });
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    await page.locator('#officialGuestEnterButton').click();
    await page.locator('.official-cabinet-card').filter({ hasText: 'STACKED' }).click();
    await page.locator('#officialFreeModeButton').click();
    const frame = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await frame.waitForSelector('#stackedStage[data-assets-ready="true"]', { timeout: 30000 });
    const stage = frame.locator('#stackedStage');
    const scrollPanelTo = selector => frame.evaluate(target => { const panel = document.querySelector('.panel'); const node = document.querySelector(target); panel.scrollTop = node ? node.offsetTop - 12 : 0; }, selector);
    // Menu screens: title, scores, settings (and the deeper groups).
    await scrollPanelTo(null); await shot('menu-title');
    assert.equal(await frame.locator('#freeModeTile').getAttribute('aria-current'), 'true');
    assert.equal(await frame.locator('#rankedModeTile').getAttribute('aria-current'), 'false');
    await frame.locator('#scoresTile').click();
    await frame.waitForSelector('#scoreShelf:not([hidden])');
    await scrollPanelTo('#scoreShelf'); await shot('menu-scores');
    await frame.locator('#scoresTile').click();
    await frame.locator('#settingsTile').click();
    assert.equal(await frame.evaluate(() => document.activeElement.id), 'ghostToggle', 'the Settings tile lands on the first gameplay control');
    await scrollPanelTo('#preferencePanel'); await shot('menu-settings');
    await scrollPanelTo('#sceneSelect'); await shot('menu-settings-visuals');
    await scrollPanelTo('#motionToggle'); await shot('menu-settings-accessibility-audio');
    // Board pulse is gated by the shipped reduced-flash default; turn that off for the evidence.
    assert.equal(await frame.locator('#boardPulseToggle').isDisabled(), true);
    await frame.locator('#flashToggle').uncheck();
    await frame.waitForFunction(() => document.querySelector('#stackedStatus').textContent.includes('Preferences saved'));
    assert.equal(await frame.locator('#boardPulseToggle').isDisabled(), false);
    assert.equal(await frame.locator('#boardPulseToggle').isChecked(), true);
    // 44 px targets across every focusable control in the dialog.
    const small = await frame.evaluate(() => [...document.querySelectorAll('#gameOverlay button, #gameOverlay select, #gameOverlay input[type=range], #gameOverlay summary, #gameOverlay label')].filter(node => node.getClientRects().length).map(node => [node.id || node.tagName, node.getBoundingClientRect().height]).filter(([, h]) => h < 43.5));
    assert.deepEqual(small, [], 'every visible dialog control is at least 44 px tall');
    const scenes = {};
    const setScene = async (value) => {
      await frame.evaluate(v => { const select = document.querySelector('#sceneSelect'); select.value = v; select.dispatchEvent(new Event('change')); }, value);
      await frame.waitForFunction(v => document.querySelector('#stackedStage').dataset.visualizerScene === (v === 'auto' ? document.querySelector('#stackedStage').dataset.visualizerScene : v), value);
    };
    await setScene('tunnel');
    await frame.locator('#continueButton').click();
    await frame.waitForFunction(() => Number(document.querySelector('#stackedStage').dataset.simulationTick) > 60);
    await frame.waitForFunction(() => document.querySelector('#stackedStage').dataset.audioAvailable === 'true', null, { timeout: 15000 });
    for (const scene of ['tunnel', 'particles', 'horizon']) {
      await setScene(scene);
      await page.waitForTimeout(1700);
      assert.equal(await stage.getAttribute('data-visualizer-scene'), scene);
      const pulse = Number(await stage.getAttribute('data-board-pulse'));
      scenes[scene] = { pulse, transitions: Number(await stage.getAttribute('data-scene-transitions')) };
      await shot(`scene-${scene}`);
    }
    await setScene('auto');
    await frame.evaluate(() => document.querySelector('#sceneNextButton').click());
    await page.waitForTimeout(600);
    await shot('scene-auto-crossfade');
    const transitions = Number(await stage.getAttribute('data-scene-transitions'));
    assert.ok(transitions >= 3, `manual cycle and scene changes recorded ${transitions} transitions`);
    await setScene('off');
    await page.waitForTimeout(300);
    assert.equal(await stage.getAttribute('data-visualizer-scene'), 'off');
    await shot('scene-off');
    await setScene('tunnel');
    await page.waitForTimeout(1700);
    // Reduced motion neutralises the board pulse and freezes the scene.
    await frame.evaluate(() => { const toggle = document.querySelector('#motionToggle'); toggle.checked = true; toggle.dispatchEvent(new Event('change')); });
    await page.waitForTimeout(400);
    assert.equal(await stage.getAttribute('data-board-pulse'), '0', 'reduced motion zeroes the board pulse');
    await shot('scene-tunnel-reduced-motion');
    await frame.evaluate(() => { const toggle = document.querySelector('#motionToggle'); toggle.checked = false; toggle.dispatchEvent(new Event('change')); });
    await frame.locator('#pauseButton').click();
    await frame.waitForSelector('#gameOverlay:not([hidden])');
    await scrollPanelTo(null); await shot('menu-pause');
    await frame.locator('#continueButton').click();
    await frame.waitForFunction(() => document.querySelector('#gameOverlay').hidden);
    // Finish the run so the results screen renders with the share row.
    for (let i = 0; i < 60 && await frame.locator('#restartButton').isHidden(); i++) {
      if (mobile) await frame.locator('[data-action="hardDrop"]').tap(); else { await frame.locator('#stackedStage canvas').focus(); await page.keyboard.press('Space'); }
      await page.waitForTimeout(70);
    }
    await frame.waitForSelector('#restartButton:not([hidden])');
    await frame.waitForFunction(() => document.querySelector('#overlayCopy').textContent.includes('Replay verified'), { timeout: 20000 });
    await scrollPanelTo(null); await shot('menu-results');
    await scrollPanelTo('#shareRow'); await shot('menu-results-share');
    // Child-side preferences persist on this device.
    const local = await frame.evaluate(() => JSON.parse(localStorage.getItem('stacked-visual-scenes-v1')));
    assert.equal(local.scene, 'tunnel'); assert.equal(local.reactiveBoard, true);
    const pulses = Object.values(scenes).map(s => s.pulse);
    assert.ok(pulses.every(p => p >= 0 && p <= 0.2), `board pulse stays under its ceiling (${pulses.join(', ')})`);
    reports.push({ name, width, height, scenes, transitions, errors });
    console.log(JSON.stringify(reports.at(-1)));
    assert.deepEqual(errors, [], name + ' has no browser errors');
    await context.close();
  }
} catch (error) {
  console.error(error);
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: path.join(evidenceDir, 'failure.png') });
  process.exitCode = 1;
} finally {
  await writeFile(path.join(evidenceDir, 'evidence-report.json'), JSON.stringify(reports, null, 2));
  await browser.close(); server.close();
}
