import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const evidenceRoot = resolve('.hermes/evidence/hmh-aaa-cycle-001/wave8');
await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const profiles = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'ultrawide', width: 1920, height: 800 },
  { id: 'mobile', width: 390, height: 844 },
];
const results = [];
try {
  for (const profile of profiles) {
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&rosterPreview=1&rosterCombat=1&lightningLedgerPilot=1&seed=424242`, { waitUntil: 'domcontentloaded' });
    const stage = page.locator('#hmhRebootStage');
    await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'lightning-ledger');
    const canvasBox = await page.locator('canvas').boundingBox();
    assert.ok(canvasBox);
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.5);
    await page.keyboard.down('Space');
    await page.waitForFunction(() => {
      const data = document.querySelector('#hmhRebootStage')?.dataset;
      return data?.lightningLedgerActive === 'true' && Number(data.lightningLedgerLastHits) >= 2 && Number(data.lightningLedgerLastRamp) > 1000;
    }, null, { timeout: 10_000 });
    const path = resolve(evidenceRoot, `lightning-ledger-${profile.id}.png`);
    await page.screenshot({ path, fullPage: true });
    const data = await stage.evaluate((element) => ({
      weaponId: element.dataset.weaponId,
      status: element.dataset.weaponStatus,
      hits: Number(element.dataset.lightningLedgerLastHits),
      ramp: Number(element.dataset.lightningLedgerLastRamp),
      cells: Number(element.dataset.lightningLedgerCells),
      minimapWidth: Number(element.dataset.minimapWidth),
      minimapHeight: Number(element.dataset.minimapHeight),
    }));
    await page.keyboard.up('Space');
    assert.equal(data.weaponId, 'lightning-ledger');
    assert.ok(data.cells >= 1 && data.cells <= 6);
    assert.ok(data.hits >= 2);
    assert.ok(data.ramp > 1000);
    assert.deepEqual(errors, []);
    results.push({ profile: profile.id, ...data, screenshot: path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
    await page.close();
  }

  const preview = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const previewErrors = [];
  preview.on('pageerror', (error) => previewErrors.push(error.message));
  preview.on('console', (message) => { if (message.type() === 'error') previewErrors.push(`console: ${message.text()}`); });
  await preview.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&lightningEventPilot=preview&seed=424242`, { waitUntil: 'domcontentloaded' });
  await preview.waitForFunction(() => {
    const data = document.querySelector('#hmhRebootStage')?.dataset;
    return data?.authoredPropStatus === 'ready' && data.lightningLedgerEventTick === '0' && data.lightningLedgerEventCollected === 'false';
  });
  const previewPath = resolve(evidenceRoot, 'lightning-ledger-event-preview.png');
  await preview.screenshot({ path: previewPath, fullPage: true });
  const previewData = await preview.locator('#hmhRebootStage').evaluate((element) => ({
    eventId: element.dataset.lightningLedgerEventId,
    eventTick: Number(element.dataset.lightningLedgerEventTick),
    collected: element.dataset.lightningLedgerEventCollected,
    weaponId: element.dataset.weaponId,
  }));
  assert.match(previewData.eventId, /^rare-ledger:/);
  assert.equal(previewData.eventTick, 0);
  assert.equal(previewData.collected, 'false');
  assert.equal(previewData.weaponId, 'coin-blaster');
  assert.deepEqual(previewErrors, []);
  await preview.close();

  const collect = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const collectErrors = [];
  collect.on('pageerror', (error) => collectErrors.push(error.message));
  collect.on('console', (message) => { if (message.type() === 'error') collectErrors.push(`console: ${message.text()}`); });
  await collect.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&lightningEventPilot=collect&seed=424242`, { waitUntil: 'domcontentloaded' });
  await collect.waitForFunction(() => {
    const data = document.querySelector('#hmhRebootStage')?.dataset;
    return data?.lightningLedgerEventCollected === 'true' && data.weaponId === 'lightning-ledger';
  }, null, { timeout: 10_000 });
  const collectPath = resolve(evidenceRoot, 'lightning-ledger-event-collected-mobile.png');
  await collect.screenshot({ path: collectPath, fullPage: true });
  const collectData = await collect.locator('#hmhRebootStage').evaluate((element) => ({
    eventId: element.dataset.lightningLedgerEventId,
    collected: element.dataset.lightningLedgerEventCollected,
    weaponId: element.dataset.weaponId,
    collectibleLast: element.dataset.collectibleLast,
  }));
  assert.equal(collectData.collected, 'true');
  assert.equal(collectData.weaponId, 'lightning-ledger');
  assert.match(collectData.collectibleLast, /lightning-ledger-cache/);
  assert.deepEqual(collectErrors, []);
  await collect.close();

  console.log(JSON.stringify({ status: 'PASS', results, preview: { ...previewData, screenshot: previewPath }, collected: { ...collectData, screenshot: collectPath } }));
} finally {
  await browser.close();
}
