import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const evidenceDir = path.resolve(process.env.STACKED_EVIDENCE_DIR || path.join(root, '.tmp/stacked-playable'));
await mkdir(evidenceDir, { recursive: true });
const dependency = process.env.STACKED_PLAYWRIGHT_PATH || path.join(root, 'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(dependency).href);
const { server, origin } = await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-webgl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const reports = [];
try {
  for (const mobile of [false, true]) {
    const errors = [], warnings = [], name = mobile ? 'mobile' : 'desktop';
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); else if (message.type() === 'warning') warnings.push(message.text()); });
    // The shared static server has no headers. Enforce the exact candidate CSP on the real document.
    const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
    const csp = config.headers.find(rule => rule.source === '/stacked/(.*)').headers.find(header => header.key === 'Content-Security-Policy').value;
    await page.route('**/stacked/index.html', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp.replace('; upgrade-insecure-requests', '') } });
    });
    await page.goto(origin + '/?devCabinets=1', { waitUntil: 'networkidle' });
    await page.locator('#officialGuestEnterButton').click();
    await page.locator('.official-cabinet-card').filter({ hasText: 'STACKED' }).click();
    assert.equal(await page.locator('#officialModeTitle').textContent(), 'STACKED');
    await page.waitForFunction(() => ['officialFreeModeBanner', 'officialRankedModeBanner'].every(id => {
      const image = document.getElementById(id); return image.complete && image.naturalWidth > 0;
    }));
    assert.equal(await page.locator('#officialModeArtNote').isHidden(), true);
    await page.evaluate(async () => {
      await Promise.all(['officialFreeModeBanner', 'officialRankedModeBanner'].map(id => document.getElementById(id).decode()));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.screenshot({ path: path.join(evidenceDir, name + '-mode-select.png') });
    await page.locator('#officialFreeModeButton').click();
    const frame = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await frame.waitForSelector('#stackedStage[data-assets-ready="true"]', { timeout: 30000 });
    await frame.locator('#motionToggle').check();
    await frame.waitForFunction(() => document.querySelector('#stackedStatus').textContent.includes('Preferences saved'));
    await frame.locator('#motionToggle').uncheck();
    await frame.locator('#continueButton').click();
    await frame.waitForFunction(() => Number(document.querySelector('#stackedStage').dataset.simulationTick) > 60);
    const baselineTick = await frame.locator('#stackedStage').getAttribute('data-simulation-tick');
    await frame.locator('#pauseButton').click();
    const pausedTick = await frame.locator('#stackedStage').getAttribute('data-simulation-tick');
    await page.waitForTimeout(250);
    assert.equal(await frame.locator('#stackedStage').getAttribute('data-simulation-tick'), pausedTick);
    await frame.locator('#continueButton').click();
    await frame.waitForFunction(tick => Number(document.querySelector('#stackedStage').dataset.simulationTick) > Number(tick), pausedTick);
    if (mobile) {
      await frame.locator('[data-action="moveLeft"]').tap();
      await frame.locator('[data-action="rotateCW"]').tap();
      await frame.locator('[data-action="hardDrop"]').tap();
    } else {
      await frame.locator('canvas').focus();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(evidenceDir, name + '-playable.png') });
    const dimensions = await frame.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, audio: document.querySelector('#stackedStage').dataset.audioAvailable }));
    assert.ok(dimensions.scrollWidth <= dimensions.width + 1, 'no horizontal overflow');
    assert.ok(dimensions.scrollHeight <= dimensions.height + 1, 'no vertical overflow');
    for (let i = 0; i < 30 && await frame.locator('#restartButton').isHidden(); i++) {
      if (mobile) await frame.locator('[data-action="hardDrop"]').tap();
      else await page.keyboard.press('Space');
      await page.waitForTimeout(80);
    }
    await frame.waitForSelector('#restartButton:not([hidden])');
    await frame.waitForFunction(() => document.querySelector('#overlayCopy').textContent.includes('Replay verified'), { timeout: 20000 });
    const result = await frame.locator('#overlayCopy').textContent();
    await page.screenshot({ path: path.join(evidenceDir, name + '-result.png') });
    await frame.locator('#effectsToggle').check();
    await frame.waitForFunction(() => document.querySelector('#stackedStatus').textContent.includes('Preferences saved'));
    await frame.locator('#restartButton').click();
    await page.waitForTimeout(600);
    const restarted = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await restarted.waitForSelector('#stackedStage[data-assets-ready="true"]');
    assert.equal(await restarted.locator('#effectsToggle').isChecked(), true, 'preferences persist across a fresh run');
    await restarted.locator('#overlayExitButton').click();
    await page.waitForSelector('#officialWalletSplash:not([hidden])');
    assert.equal(await page.locator('iframe.stacked-game-frame').count(), 0);
    reports.push({ name, baselineTick, dimensions, result, errors, warnings });
    await context.close();
    console.log(JSON.stringify(reports.at(-1)));
    assert.deepEqual(errors, [], name + ' has no browser errors');
  }
} catch (error) {
  console.error(error);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: path.join(evidenceDir, 'failure.png'), fullPage: true });
    console.error((await page.locator('body').innerText()).slice(-3000));
    for (const frame of page.frames().slice(1)) console.error('CHILD', (await frame.locator('body').innerText()).slice(-2000));
  }
  process.exitCode = 1;
} finally {
  await writeFile(path.join(evidenceDir, 'browser-report.json'), JSON.stringify(reports, null, 2));
  await browser.close(); server.close();
}
