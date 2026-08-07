import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const screenshotPath = resolve(process.env.HMH_LIGHTNING_LEDGER_SCREENSHOT ?? '.hermes/evidence/hmh-aaa-cycle-001/wave8/lightning-ledger-chain.png');
await mkdir(dirname(screenshotPath), { recursive: true });
const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&rosterPreview=1&rosterCombat=1&lightningLedgerPilot=1&seed=424242`, { waitUntil: 'domcontentloaded' });
  const stage = page.locator('#hmhRebootStage');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'lightning-ledger');
  const canvasBox = await page.locator('canvas').boundingBox();
  assert.ok(canvasBox, 'game canvas is missing');
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.5);
  await page.keyboard.down('Space');
  const initialPulses = Number(await stage.getAttribute('data-lightning-ledger-pulses') ?? 0);
  try {
    await page.waitForFunction((minimum) => {
      const dataset = document.querySelector('#hmhRebootStage')?.dataset;
      return dataset?.lightningLedgerActive === 'true'
        && Number(dataset.lightningLedgerPulses) > minimum
        && Number(dataset.lightningLedgerLastHits) >= 2;
    }, initialPulses, { timeout: 8000 });
  } catch (error) {
    const diagnostic = await stage.evaluate((element) => ({ ...element.dataset }));
    throw new Error(`Lightning Ledger did not produce a two-target active chain: ${JSON.stringify({ diagnostic, errors })}`, { cause: error });
  }
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const first = await stage.evaluate((element) => ({
    weaponId: element.dataset.weaponId,
    status: element.dataset.weaponStatus,
    pulses: Number(element.dataset.lightningLedgerPulses),
    hits: Number(element.dataset.lightningLedgerLastHits),
    rampPermille: Number(element.dataset.lightningLedgerLastRamp),
    maxRampPermille: Number(element.dataset.lightningLedgerRamp),
    cells: Number(element.dataset.lightningLedgerCells),
    active: element.dataset.lightningLedgerActive,
    lastWeaponFire: element.dataset.lastWeaponFire,
  }));
  await page.waitForFunction((minimum) => Number(document.querySelector('#hmhRebootStage')?.dataset.lightningLedgerPulses) > minimum, first.pulses, { timeout: 4000 });
  const second = await stage.evaluate((element) => ({
    pulses: Number(element.dataset.lightningLedgerPulses),
    hits: Number(element.dataset.lightningLedgerLastHits),
    rampPermille: Number(element.dataset.lightningLedgerLastRamp),
  }));
  await page.keyboard.up('Space');
  const hudText = await page.locator('#hmhRebootStage canvas').evaluate((canvas) => canvas.getAttribute('aria-label') ?? '').catch(() => '');
  assert.equal(first.weaponId, 'lightning-ledger');
  assert.equal(first.active, 'true');
  assert.equal(first.lastWeaponFire, 'lightning-ledger');
  assert.ok(first.pulses >= 1);
  assert.ok(first.hits >= 2, 'the first visible channel resolution must chain to at least two targets');
  assert.ok(first.rampPermille > 1000 && first.maxRampPermille >= first.rampPermille);
  assert.ok(first.cells >= 1 && first.cells <= 6);
  assert.equal(second.pulses, first.pulses + 1);
  assert.ok(second.hits >= 2, 'the second deterministic resolution must chain to at least two targets');
  assert.ok(second.rampPermille >= first.rampPermille);
  assert.deepEqual(errors, []);
  const screenshotSha256 = createHash('sha256').update(await readFile(screenshotPath)).digest('hex');
  console.log(JSON.stringify({ status: 'PASS', first, second, hudText, screenshotPath, screenshotSha256, errors }));
} finally {
  await browser.close();
}
