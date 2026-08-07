import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const screenshotPath = resolve(process.env.HMH_HASH_RAIL_SCREENSHOT ?? '.hermes/evidence/hmh-aaa-cycle-001/wave8/hash-rail-charge.png');
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
  await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&weaponPilot=1&seed=424242`, { waitUntil: 'networkidle' });
  const stage = page.locator('#hmhRebootStage');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster');
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.down('q');
    await page.waitForTimeout(100);
    await page.keyboard.up('q');
    await page.waitForTimeout(140);
  }
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'hash-rail');
  const box = await page.locator('canvas').boundingBox();
  assert.ok(box, 'game canvas is missing');
  await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.5);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponChargeStartedTick !== '');
  const charging = await stage.evaluate((element) => ({
    weaponId: element.dataset.weaponId,
    ammo: Number(element.dataset.weaponAmmo),
    chargeStartedTick: Number(element.dataset.weaponChargeStartedTick),
  }));
  await page.waitForTimeout(650);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponChargeReady === 'true', null, { timeout: 4000 });
  const readyStatus = 'Hash Rail charged. Release to fire.';
  await page.keyboard.up('Space');
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.weaponAmmo) === 2);
  const fired = await stage.evaluate((element) => ({
    ammo: Number(element.dataset.weaponAmmo),
    chargeStartedTick: element.dataset.weaponChargeStartedTick,
    projectileCount: Number(element.dataset.projectileCount),
  }));
  assert.deepEqual(charging.weaponId, 'hash-rail');
  assert.equal(charging.ammo, 3);
  assert.equal(fired.ammo, 2);
  assert.equal(fired.chargeStartedTick, '');
  assert.deepEqual(errors, []);
  const screenshotSha256 = createHash('sha256').update(await readFile(screenshotPath)).digest('hex');
  console.log(JSON.stringify({ status: 'PASS', charging, readyStatus, fired, screenshotPath, screenshotSha256, errors }));
} finally {
  await browser.close();
}
