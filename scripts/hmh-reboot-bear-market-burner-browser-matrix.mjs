import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const evidenceRoot = resolve('.hermes/evidence/hmh-aaa-cycle-001/wave9');
await mkdir(evidenceRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const hashFile = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
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
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()} @ ${JSON.stringify(message.location())}`);
    });
    await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&rosterPreview=1&rosterCombat=1&bearMarketBurnerPilot=1&seed=424242`, { waitUntil: 'domcontentloaded' });
    const stage = page.locator('#hmhRebootStage');
    await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'bear-market-burner');
    const canvasBox = await page.locator('canvas').boundingBox();
    assert.ok(canvasBox, 'game canvas is missing');
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.5);
    const initialPulses = Number(await stage.getAttribute('data-bear-market-burner-pulses') ?? 0);
    const initialFuel = Number(await stage.getAttribute('data-bear-market-burner-fuel') ?? 0);
    await page.keyboard.down('Space');
    try {
      await page.waitForFunction(({ minimumPulses, maximumFuel }) => {
        const data = document.querySelector('#hmhRebootStage')?.dataset;
        return data?.weaponId === 'bear-market-burner'
          && data.lastWeaponFire === 'bear-market-burner'
          && Number(data.bearMarketBurnerPulses) > minimumPulses
          && Number(data.bearMarketBurnerFuel) < maximumFuel
          && Number(data.bearMarketBurnerLastHits) >= 2
          && Number(data.bearMarketBurnerActiveBurns) >= 2
          && Number(data.bearMarketBurnerFlameVisuals) >= 1;
      }, { minimumPulses: initialPulses, maximumFuel: initialFuel }, { timeout: 10_000 });
    } catch (error) {
      const diagnostic = await stage.evaluate((element) => ({ ...element.dataset }));
      throw new Error(`Bear Market Burner did not produce non-vacuous flame contacts: ${JSON.stringify({ profile: profile.id, diagnostic, errors })}`, { cause: error });
    }
    const path = resolve(evidenceRoot, `bear-market-burner-${profile.id}.png`);
    await page.screenshot({ path, fullPage: true });
    const data = await stage.evaluate((element) => ({
      weaponId: element.dataset.weaponId,
      status: element.dataset.weaponStatus,
      pulses: Number(element.dataset.bearMarketBurnerPulses),
      hits: Number(element.dataset.bearMarketBurnerLastHits),
      fuel: Number(element.dataset.bearMarketBurnerFuel),
      activeBurns: Number(element.dataset.bearMarketBurnerActiveBurns),
      scorchZones: Number(element.dataset.bearMarketBurnerScorchZones),
      flameVisuals: Number(element.dataset.bearMarketBurnerFlameVisuals),
      minimapWidth: Number(element.dataset.minimapWidth),
      minimapHeight: Number(element.dataset.minimapHeight),
      lastWeaponFire: element.dataset.lastWeaponFire,
    }));
    await page.keyboard.up('Space');
    assert.equal(data.weaponId, 'bear-market-burner');
    assert.equal(data.lastWeaponFire, 'bear-market-burner');
    assert.ok(data.pulses > initialPulses);
    assert.ok(data.hits >= 2);
    assert.ok(data.activeBurns >= 2);
    assert.ok(data.flameVisuals >= 1);
    assert.ok(data.fuel >= 0 && data.fuel < initialFuel);
    await page.waitForTimeout(2500);
    assert.deepEqual(errors, []);
    results.push({ profile: profile.id, ...data, screenshot: path, sha256: await hashFile(path) });
    await page.close();
  }

  const preview = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const previewErrors = [];
  preview.on('pageerror', (error) => previewErrors.push(error.message));
  preview.on('console', (message) => {
    if (message.type() === 'error') previewErrors.push(`console: ${message.text()} @ ${JSON.stringify(message.location())}`);
  });
  await preview.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&burnerEventPilot=preview&seed=424242`, { waitUntil: 'domcontentloaded' });
  await preview.waitForFunction(() => {
    const data = document.querySelector('#hmhRebootStage')?.dataset;
    return data?.authoredPropStatus === 'ready' && data.bearMarketBurnerEventTick === '0' && data.bearMarketBurnerEventCollected === 'false';
  });
  const previewPath = resolve(evidenceRoot, 'bear-market-burner-event-preview.png');
  await preview.screenshot({ path: previewPath, fullPage: true });
  const previewData = await preview.locator('#hmhRebootStage').evaluate((element) => ({
    eventId: element.dataset.bearMarketBurnerEventId,
    eventTick: Number(element.dataset.bearMarketBurnerEventTick),
    collected: element.dataset.bearMarketBurnerEventCollected,
    weaponId: element.dataset.weaponId,
  }));
  assert.match(previewData.eventId, /^rare-burner:/);
  assert.equal(previewData.eventTick, 0);
  assert.equal(previewData.collected, 'false');
  assert.equal(previewData.weaponId, 'coin-blaster');
  assert.deepEqual(previewErrors, []);
  await preview.close();

  const collect = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const collectErrors = [];
  collect.on('pageerror', (error) => collectErrors.push(error.message));
  collect.on('console', (message) => {
    if (message.type() === 'error') collectErrors.push(`console: ${message.text()} @ ${JSON.stringify(message.location())}`);
  });
  await collect.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&burnerEventPilot=collect&seed=424242`, { waitUntil: 'domcontentloaded' });
  await collect.waitForFunction(() => {
    const data = document.querySelector('#hmhRebootStage')?.dataset;
    return data?.bearMarketBurnerEventCollected === 'true' && data.weaponId === 'bear-market-burner';
  }, null, { timeout: 10_000 });
  const collectPath = resolve(evidenceRoot, 'bear-market-burner-event-collected-mobile.png');
  await collect.screenshot({ path: collectPath, fullPage: true });
  const collectData = await collect.locator('#hmhRebootStage').evaluate((element) => ({
    eventId: element.dataset.bearMarketBurnerEventId,
    collected: element.dataset.bearMarketBurnerEventCollected,
    weaponId: element.dataset.weaponId,
    collectibleLast: element.dataset.collectibleLast,
  }));
  assert.equal(collectData.collected, 'true');
  assert.equal(collectData.weaponId, 'bear-market-burner');
  assert.match(collectData.collectibleLast, /bear-market-burner-cache/);
  assert.deepEqual(collectErrors, []);
  await collect.close();

  console.log(JSON.stringify({
    status: 'PASS',
    results,
    preview: { ...previewData, screenshot: previewPath, sha256: await hashFile(previewPath) },
    collected: { ...collectData, screenshot: collectPath, sha256: await hashFile(collectPath) },
  }));
} finally {
  await browser.close();
}
