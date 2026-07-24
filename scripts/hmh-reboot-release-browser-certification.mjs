import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const browserExecutable = process.env.HMH_REBOOT_BROWSER_EXECUTABLE ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const evidenceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.hermes/evidence/hmh-reboot-18-release');
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false },
  { name: 'ultrawide', viewport: { width: 1920, height: 800 }, deviceScaleFactor: 1, isMobile: false },
  { name: 'tablet-landscape', viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1.5, isMobile: true },
  { name: 'mobile-portrait', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true },
  { name: 'mobile-landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true },
];
const anchorQuery = 'evidenceSafe=1&progressionPilot=1&releaseAnchor=1&telemetry=1&seed=424242';
const liveQuery = 'evidenceSafe=1&combatPilot=1&telemetry=1&seed=424242';

await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: browserExecutable,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function comparePngs(first, second) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ({ firstUrl, secondUrl }) => {
      const load = async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
      };
      const a = await load(firstUrl);
      const b = await load(secondUrl);
      if (a.width !== b.width || a.height !== b.height) return { sizeMismatch: true, changedPixels: Infinity, maxChannelDelta: Infinity };
      let changedPixels = 0;
      let maxChannelDelta = 0;
      let absoluteChannelDelta = 0;
      for (let offset = 0; offset < a.data.length; offset += 4) {
        let pixelChanged = false;
        for (let channel = 0; channel < 4; channel += 1) {
          const delta = Math.abs(a.data[offset + channel] - b.data[offset + channel]);
          absoluteChannelDelta += delta;
          maxChannelDelta = Math.max(maxChannelDelta, delta);
          pixelChanged ||= delta > 0;
        }
        if (pixelChanged) changedPixels += 1;
      }
      return { sizeMismatch: false, width: a.width, height: a.height, changedPixels, maxChannelDelta, meanChannelDelta: absoluteChannelDelta / a.data.length };
    }, {
      firstUrl: `data:image/png;base64,${first.toString('base64')}`,
      secondUrl: `data:image/png;base64,${second.toString('base64')}`,
    });
  } finally {
    await page.close();
  }
}

async function rejectAuthenticationPage(page) {
  const pageText = `${await page.title()}\n${await page.locator('body').innerText()}`;
  assert.doesNotMatch(pageText, /Vercel Authentication/i, 'received Vercel Authentication instead of game content');
  assert.match(pageText, /Hard Money Heroes|Forked Frontier/i, 'game identity missing');
}

async function assertResponsiveGeometry(page, profile) {
  const result = await page.evaluate(() => {
    const visual = window.visualViewport
      ? { width: window.visualViewport.width, height: window.visualViewport.height, offsetLeft: window.visualViewport.offsetLeft, offsetTop: window.visualViewport.offsetTop }
      : { width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0 };
    const selectors = ['.hmh-reboot-status-card', '.hmh-run-rail', '#hmhUpgradePanel:not([hidden])'];
    const bounds = selectors.map((selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return { selector, exists: Boolean(element), left: rect?.left, top: rect?.top, right: rect?.right, bottom: rect?.bottom };
    });
    return {
      visual,
      rootScrollWidth: document.documentElement.scrollWidth,
      rootScrollHeight: document.documentElement.scrollHeight,
      innerWidth,
      innerHeight,
      bounds,
      choiceCount: document.querySelectorAll('#hmhUpgradeChoices button').length,
      canvasCount: document.querySelectorAll('#hmhRebootStage canvas').length,
    };
  });
  assert.ok(result.rootScrollWidth <= result.innerWidth + 1, `${profile.name} horizontal overflow ${result.rootScrollWidth}/${result.innerWidth}`);
  assert.ok(result.rootScrollHeight <= result.innerHeight + 1, `${profile.name} vertical overflow ${result.rootScrollHeight}/${result.innerHeight}`);
  assert.equal(result.choiceCount, 3, `${profile.name} upgrade choice count`);
  assert.equal(result.canvasCount, 1, `${profile.name} canvas count`);
  for (const bound of result.bounds) {
    assert.equal(bound.exists, true, `${profile.name} missing ${bound.selector}`);
    assert.ok(bound.left >= result.visual.offsetLeft - 1, `${profile.name} ${bound.selector} left clipped`);
    assert.ok(bound.top >= result.visual.offsetTop - 1, `${profile.name} ${bound.selector} top clipped`);
    assert.ok(bound.right <= result.visual.offsetLeft + result.visual.width + 1, `${profile.name} ${bound.selector} right clipped`);
    assert.ok(bound.bottom <= result.visual.offsetTop + result.visual.height + 1, `${profile.name} ${bound.selector} bottom clipped`);
  }
  return result;
}

async function assertTouchGeometry(page, profile) {
  if (!profile.isMobile) return [];
  const controls = await page.locator('[data-hmh-control]').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { name: node.dataset.hmhControl, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }));
  assert.equal(controls.length, 8, `${profile.name} touch control count`);
  for (const control of controls) {
    assert.ok(control.left >= -1, `${profile.name} ${control.name} left clipped`);
    assert.ok(control.top >= -1, `${profile.name} ${control.name} top clipped`);
    assert.ok(control.right <= profile.viewport.width + 1, `${profile.name} ${control.name} right clipped`);
    assert.ok(control.bottom <= profile.viewport.height + 1, `${profile.name} ${control.name} bottom clipped`);
  }
  return controls;
}

async function captureAnchor(profile, pass) {
  const page = await browser.newPage({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, isMobile: profile.isMobile, hasTouch: profile.isMobile });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  try {
    await page.goto(`${origin}/hmh-reboot/?${anchorQuery}`, { waitUntil: 'networkidle' });
    await rejectAuthenticationPage(page);
    await page.waitForSelector('#hmhUpgradePanel:not([hidden])');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const geometry = await assertResponsiveGeometry(page, profile);
    const image = await page.screenshot({ type: 'png' });
    await writeFile(path.join(evidenceRoot, `${profile.name}-anchor-pass-${pass}.png`), image);
    if (pass === 1) await writeFile(path.join(evidenceRoot, `${profile.name}-anchor.png`), image);
    assert.deepEqual(errors, [], `${profile.name} anchor errors`);
    return { hash: digest(image), geometry, image };
  } finally {
    await page.close();
  }
}

async function captureLiveInteraction(profile) {
  const page = await browser.newPage({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, isMobile: profile.isMobile, hasTouch: profile.isMobile });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  try {
    await page.goto(`${origin}/hmh-reboot/?${liveQuery}`, { waitUntil: 'networkidle' });
    await rejectAuthenticationPage(page);
    await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick) >= 4);
    const before = await page.locator('#hmhRebootStage').evaluate((stage) => ({ tick: Number(stage.dataset.simulationTick), x: Number(stage.dataset.actorX) }));
    await page.keyboard.down('d');
    await page.waitForTimeout(350);
    await page.keyboard.up('d');
    const after = await page.locator('#hmhRebootStage').evaluate((stage) => ({ tick: Number(stage.dataset.simulationTick), x: Number(stage.dataset.actorX) }));
    assert.ok(after.tick > before.tick, `${profile.name} simulation did not advance`);
    assert.notEqual(after.x, before.x, `${profile.name} real keyboard input did not move actor`);
    const pauseButton = page.locator('#hmhMenuToggle');
    const resumeButton = page.locator('#hmhResumeButton');
    await pauseButton.click();
    await page.waitForFunction(() => document.querySelector('#hmhPausePanel')?.hidden === false);
    const pausedTick = Number(await page.locator('#hmhRebootStage').getAttribute('data-simulation-tick'));
    await page.waitForTimeout(250);
    assert.equal(Number(await page.locator('#hmhRebootStage').getAttribute('data-simulation-tick')), pausedTick, `${profile.name} tick advanced while paused`);
    await resumeButton.click();
    await page.waitForFunction((tick) => Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick) > tick, pausedTick);
    const touchControls = await assertTouchGeometry(page, profile);
    const image = await page.screenshot({ type: 'png' });
    await writeFile(path.join(evidenceRoot, `${profile.name}-live.png`), image);
    assert.deepEqual(errors, [], `${profile.name} live errors`);
    return { before, after, pausedTick, touchControls, liveHash: digest(image) };
  } finally {
    await page.close();
  }
}

try {
  const gameResponse = await fetch(`${origin}/dist/hmh-reboot/game.js`);
  assert.equal(gameResponse.ok, true, 'dist/hmh-reboot/game.js unavailable');
  const gameSource = await gameResponse.text();
  assert.match(gameSource, /production-vector-world-v1/);
  assert.match(gameSource, /performanceProfile/);
  const swResponse = await fetch(`${origin}/sw.js`);
  assert.equal(swResponse.ok, true, 'sw.js unavailable');
  assert.match(await swResponse.text(), /hmh-reboot\/game\.js/);

  const results = [];
  for (const profile of profiles) {
    const first = await captureAnchor(profile, 1);
    const second = await captureAnchor(profile, 2);
    const anchorDiff = first.hash === second.hash
      ? { sizeMismatch: false, changedPixels: 0, maxChannelDelta: 0, meanChannelDelta: 0 }
      : await comparePngs(first.image, second.image);
    assert.equal(anchorDiff.sizeMismatch, false, `${profile.name} anchor size mismatch`);
    assert.ok(anchorDiff.changedPixels <= 32, `${profile.name} anchor hashes differ across ${anchorDiff.changedPixels} pixels`);
    assert.ok(anchorDiff.maxChannelDelta <= 2, `${profile.name} anchor max channel delta ${anchorDiff.maxChannelDelta}`);
    const live = await captureLiveInteraction(profile);
    assert.notEqual(live.liveHash, first.hash, `${profile.name} live evidence matches deterministic anchor`);
    results.push({ profile: profile.name, anchorHashes: [first.hash, second.hash], anchorDiff, geometry: first.geometry, live });
  }
  const report = { origin, browserExecutable, profiles: results };
  await writeFile(path.join(evidenceRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
