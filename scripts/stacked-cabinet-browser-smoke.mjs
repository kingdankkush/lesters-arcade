import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const evidenceDir = path.join(root, 'outputs/stacked-cabinet-browser');
await mkdir(evidenceDir, { recursive: true });
const dependency = process.env.STACKED_PLAYWRIGHT_PATH || path.join(root, 'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(dependency).href);
const { server, origin } = await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const reports = [];
try {
  for (const [name, width, height, mobile] of [
    ['desktop', 1440, 1000, false], ['small-desktop', 1024, 768, false],
    ['tablet', 768, 1024, true], ['mobile', 390, 844, true], ['small-mobile', 320, 740, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [], atlasRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => {
      if (response.url().includes('stacked-cabinet-turnaround')) atlasRequests.push({ status: response.status(), url: response.url() });
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('#officialGuestEnterButton').click();
    const card = page.locator('.official-cabinet-card').filter({ hasText: 'STACKED' });
    await card.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const frames = [...document.querySelectorAll('.stacked-cabinet-rotator canvas')];
      return frames.length === 6 && frames.every(frame => frame.dataset.ready === 'true');
    });
    assert.equal(await card.locator('.cabinet-card-banner').count(), 0, 'real cabinet replaces the static banner');
    assert.equal(atlasRequests.length, 1, 'one shared atlas request');
    assert.equal(atlasRequests[0].status, 200);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scrollWidth <= width + 1, 'no horizontal page overflow');
    const frameStats = await card.locator('canvas').evaluateAll(frames => frames.map(frame => {
      const pixels = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
      let bright = 0;
      for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 60) bright++;
      return { width: frame.width, height: frame.height, brightPixels: bright };
    }));
    assert.ok(frameStats.every(frame => frame.width === 424 && frame.height === 512 && frame.brightPixels > 5000));
    const visibleFrames = await card.locator('.stacked-cabinet-rotator').evaluate(async rotator => {
      const indices = new Set();
      for (let sample = 0; sample < 40; sample++) {
        [...rotator.children].forEach((frame, index) => { if (Number(getComputedStyle(frame).opacity) > 0.9) indices.add(index); });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return [...indices].sort();
    });
    assert.deepEqual(visibleFrames, [0, 1, 2, 3, 4, 5], 'all six views actually animate');
    const toggle = page.locator('#cabinetMotionToggle');
    await toggle.click();
    const pausedTimes = await card.evaluate(element => element.getAnimations({ subtree: true }).map(animation => animation.currentTime));
    await page.waitForTimeout(350);
    const stillTimes = await card.evaluate(element => element.getAnimations({ subtree: true }).map(animation => animation.currentTime));
    assert.deepEqual(stillTimes, pausedTimes, 'pause stops every cabinet animation');
    await toggle.focus();
    await page.keyboard.press('Space');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#cabinetMotionToggle').disabled);
    assert.equal(await toggle.isDisabled(), true);
    const rest = await card.locator('canvas').evaluateAll(frames => frames.map(frame => ({ opacity: getComputedStyle(frame).opacity, animation: getComputedStyle(frame).animationName })));
    assert.deepEqual(rest.map(frame => frame.opacity), ['1', '0', '0', '0', '0', '0']);
    assert.ok(rest.every(frame => frame.animation === 'none'));
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: path.join(evidenceDir, `${name}-stacked-card.png`) });
    await page.locator('#officialArcadeFloor').screenshot({ path: path.join(evidenceDir, `${name}-browse-games.png`) });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !document.querySelector('#cabinetMotionToggle').disabled);
    // Check the actual cabinet click still reaches the public beta mode flow.
    await card.click();
    assert.equal(await page.locator('#officialModeTitle').textContent(), 'STACKED');
    assert.match(await page.locator('#officialRankedModeTitle').textContent(), /Local Only/);
    assert.equal(await page.locator('#officialFreeModeButton').isEnabled(), true);
    await page.locator('#officialFreeModeButton').click();
    const frame = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await frame.waitForSelector('#stackedStage[data-assets-ready="true"]');
    await frame.locator('#continueButton').click();
    await frame.waitForFunction(() => Number(document.querySelector('#stackedStage').dataset.simulationTick) > 60);
    assert.deepEqual(errors, [], `${name}: no browser errors`);
    reports.push({ name, dimensions, frameStats, visibleFrames, atlasRequests: atlasRequests.length, paused: true, reducedMotion: true, freeModeStarted: true, errors });
    console.log(JSON.stringify(reports.at(-1)));
    await context.close();
  }
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: path.join(evidenceDir, 'failure.png'), fullPage: true });
  }
  throw error;
} finally {
  await writeFile(path.join(evidenceDir, 'verification.json'), JSON.stringify({ passed: reports.length === 5, reports }, null, 2));
  await browser.close();
  server.close();
}
