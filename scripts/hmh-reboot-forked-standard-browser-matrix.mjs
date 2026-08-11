import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { gotoWithRetry, readCanvasDataset, waitForCanvasDataset } from './browser-smoke-helpers.mjs';

const baseUrl = process.env.HMH_BASE_URL ?? 'http://127.0.0.1:8791';
const outputDirectory = resolve('.hermes/evidence/hmh-aaa-cycle-001/wave9');
await mkdir(outputDirectory, { recursive: true });

const browserExecutable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
const records = [];
const errors = [];

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

const profiles = [
  { id: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { id: 'ultrawide', viewport: { width: 2560, height: 1080 }, mobile: false },
  { id: 'mobile', viewport: { width: 390, height: 844 }, mobile: true },
];

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: profile.viewport, isMobile: profile.mobile, hasTouch: profile.mobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`${profile.id}:console:${message.text()}`); });
    page.on('pageerror', (error) => errors.push(`${profile.id}:page:${error.message}`));
    page.on('requestfailed', (request) => errors.push(`${profile.id}:request:${request.url()}:${request.failure()?.errorText}`));

    await gotoWithRetry(page, `${baseUrl}/hmh-reboot/?evidenceSafe=1&telemetry=1&forkedStandardPilot=1&rosterPreview=1&rosterCombat=1`);
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });
    await waitForCanvasDataset(page, (data) => data.bootFirstFrame === 'true' && data.weaponId === 'forked-standard', { timeout: 30_000 });
    const box = await canvas.boundingBox();
    assert.ok(box);
    const aimPoint = { x: box.x + box.width * 0.15, y: box.y + box.height * 0.50 };
    await canvas.evaluate((node, point) => {
      node.dispatchEvent(new PointerEvent('pointermove', { clientX: point.x, clientY: point.y, buttons: 0, pointerId: 71, pointerType: 'mouse', bubbles: true }));
      node.dispatchEvent(new PointerEvent('pointerdown', { clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerId: 71, pointerType: 'mouse', bubbles: true }));
    }, aimPoint);
    await waitForCanvasDataset(page, (data) => (
      data.weaponId === 'forked-standard'
      && Number(data.forkedStandardAttacks) >= 2
      && data.forkedStandardLastForm === 'sweep'
      && Number(data.forkedStandardLastHits) >= 1
      && Number(data.forkedStandardVisuals) >= 1
      && data.lastWeaponFire === 'forked-standard'
    ), { timeout: 12_000 });
    await canvas.evaluate((node, point) => node.dispatchEvent(new PointerEvent('pointerup', { clientX: point.x, clientY: point.y, button: 0, buttons: 0, pointerId: 71, pointerType: 'mouse', bubbles: true })), aimPoint);
    const data = await readCanvasDataset(page);
    assert.equal(data.weaponAmmo, '1');
    assert.match(await page.locator('#hmhRebootCombatStatus').innerText(), /FORKED STANDARD/i);
    if (profile.mobile) {
      assert.equal(await page.locator('.hmh-touch-controls').isVisible(), true);
    }
    const screenshot = resolve(outputDirectory, `forked-standard-${profile.id}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    records.push({ profile: profile.id, width: profile.viewport.width, height: profile.viewport.height, attacks: Number(data.forkedStandardAttacks), form: data.forkedStandardLastForm, hits: Number(data.forkedStandardLastHits), visuals: Number(data.forkedStandardVisuals), screenshot, sha256: await sha256(screenshot) });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`event-preview:console:${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`event-preview:page:${error.message}`));
  await gotoWithRetry(page, `${baseUrl}/hmh-reboot/?evidenceSafe=1&telemetry=1&standardEventPilot=preview`);
  const previewData = await waitForCanvasDataset(page, (data) => data.forkedStandardEventId?.startsWith('rare-standard:') && data.forkedStandardEventCollected === 'false');
  assert.equal(previewData.weaponId, 'coin-blaster');
  const previewPath = resolve(outputDirectory, 'forked-standard-event-preview.png');
  await page.screenshot({ path: previewPath, fullPage: true });
  records.push({ profile: 'event-preview', eventId: previewData.forkedStandardEventId, availableTick: Number(previewData.forkedStandardEventTick), screenshot: previewPath, sha256: await sha256(previewPath) });
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on('console', (message) => { if (message.type() === 'error') errors.push(`event-collect:console:${message.text()}`); });
  mobilePage.on('pageerror', (error) => errors.push(`event-collect:page:${error.message}`));
  await gotoWithRetry(mobilePage, `${baseUrl}/hmh-reboot/?evidenceSafe=1&telemetry=1&standardEventPilot=collect`);
  const collectData = await waitForCanvasDataset(mobilePage, (data) => data.forkedStandardEventCollected === 'true' && data.weaponId === 'forked-standard');
  assert.equal(collectData.collectibleLast, 'forked-standard-cache');
  assert.match(await mobilePage.locator('#hmhRebootCombatStatus').innerText(), /FORKED STANDARD/i);
  const collectPath = resolve(outputDirectory, 'forked-standard-event-collected-mobile.png');
  await mobilePage.screenshot({ path: collectPath, fullPage: true });
  records.push({ profile: 'event-collected-mobile', collected: collectData.collectibleLast, weaponId: collectData.weaponId, screenshot: collectPath, sha256: await sha256(collectPath) });
  await mobileContext.close();

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'pass', records }, null, 2));
} finally {
  await browser.close();
}
