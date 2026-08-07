import assert from 'node:assert/strict';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const url = `${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=mining`;
const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  const stage = page.locator('#hmhRebootStage');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster');
  const before = await stage.evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    remaining: Number(element.dataset.collectibleRemaining),
    actorX: Number(element.dataset.actorX),
  }));
  assert.deepEqual({ count: before.count, remaining: before.remaining }, { count: 0, remaining: 10 });
  assert.ok(Math.abs(before.actorX - 9_200) < 12, `world-tour spawn drifted: ${before.actorX}`);

    await page.keyboard.down('d');
  await page.waitForTimeout(800);
  await page.keyboard.up('d');
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.collectibleCount) === 1, null, { timeout: 5000 });
  const collected = await stage.evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    remaining: Number(element.dataset.collectibleRemaining),
    last: element.dataset.collectibleLast,
    active: element.dataset.collectibleActive,
    weaponId: element.dataset.weaponId,
    ammo: Number(element.dataset.weaponAmmo),
    actorX: Number(element.dataset.actorX),
  }));
  assert.deepEqual({ count: collected.count, remaining: collected.remaining }, { count: 1, remaining: 9 });
  assert.equal(collected.last, 'auto-miner-cache');
  assert.equal(collected.active, '');
  assert.equal(collected.weaponId, 'auto-miner');
  assert.ok(collected.ammo > 0, 'weapon cache did not refill the selected auto-miner');
  assert.ok(collected.actorX > before.actorX, 'normal player movement did not traverse the pickup');

  await page.waitForTimeout(700);
  assert.equal(await stage.evaluate((element) => Number(element.dataset.collectibleCount)), 1, 'pickup repeated after collection');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const element = document.querySelector('#hmhRebootStage');
    return element?.dataset.weaponId === 'coin-blaster'
      && Number(element.dataset.collectibleCount) === 0
      && Number(element.dataset.collectibleRemaining) === 10;
  }, null, { timeout: 5000 });
  const reset = await page.locator('#hmhRebootStage').evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    remaining: Number(element.dataset.collectibleRemaining),
    active: element.dataset.collectibleActive,
    weaponId: element.dataset.weaponId,
    handGrenades: Number(element.dataset.handGrenades),
  }));
  assert.deepEqual(reset, { count: 0, remaining: 10, active: '', weaponId: 'coin-blaster', handGrenades: 3 });

  const timedPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  timedPage.on('pageerror', (error) => errors.push(error.message));
  timedPage.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await timedPage.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=ravine`, { waitUntil: 'networkidle' });
  await timedPage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster');
    await timedPage.keyboard.down('d');
  await timedPage.keyboard.down('w');
  await timedPage.waitForTimeout(550);
  await timedPage.keyboard.up('w');
  await timedPage.keyboard.up('d');
  await timedPage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.collectibleActive === 'time-dilation', null, { timeout: 5000 });
  if (process.env.HMH_COLLECTIBLE_SCREENSHOT) {
    await timedPage.screenshot({ path: process.env.HMH_COLLECTIBLE_SCREENSHOT, fullPage: true });
  }
  const timed = await timedPage.locator('#hmhRebootStage').evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    remaining: Number(element.dataset.collectibleRemaining),
    last: element.dataset.collectibleLast,
    active: element.dataset.collectibleActive,
  }));
  const accessibleStatus = await timedPage.locator('#hmhRebootCombatStatus').evaluate((element) => element.value || element.textContent);
  assert.deepEqual({ count: timed.count, remaining: timed.remaining }, { count: 1, remaining: 9 });
  assert.equal(timed.last, 'time-dilation');
  assert.equal(timed.active, 'time-dilation');
  assert.match(accessibleStatus, /active powerups time-dilation/i);

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  mobilePage.on('pageerror', (error) => errors.push(error.message));
  mobilePage.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await mobilePage.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=collectible-ravine-overlook-cache`, { waitUntil: 'networkidle' });
  await mobilePage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.collectibleActive === 'time-dilation', null, { timeout: 5000 });
  if (process.env.HMH_COLLECTIBLE_MOBILE_SCREENSHOT) {
    await mobilePage.screenshot({ path: process.env.HMH_COLLECTIBLE_MOBILE_SCREENSHOT, fullPage: true });
  }
  const mobile = await mobilePage.locator('#hmhRebootStage').evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    active: element.dataset.collectibleActive,
    speedMultiplier: Number(element.dataset.collectibleSpeedMultiplier),
  }));
  assert.deepEqual(mobile, { count: 1, active: 'time-dilation', speedMultiplier: 1.2 });
  await mobilePage.close();

  const landscapePage = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  landscapePage.on('pageerror', (error) => errors.push(error.message));
  landscapePage.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await landscapePage.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=collectible-ravine-overlook-cache`, { waitUntil: 'networkidle' });
  await landscapePage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.collectibleActive === 'time-dilation', null, { timeout: 5000 });
  if (process.env.HMH_COLLECTIBLE_LANDSCAPE_SCREENSHOT) {
    await landscapePage.screenshot({ path: process.env.HMH_COLLECTIBLE_LANDSCAPE_SCREENSHOT, fullPage: true });
  }
  const landscape = await landscapePage.locator('#hmhRebootStage').evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    active: element.dataset.collectibleActive,
    speedMultiplier: Number(element.dataset.collectibleSpeedMultiplier),
  }));
  assert.deepEqual(landscape, { count: 1, active: 'time-dilation', speedMultiplier: 1.2 });
  await landscapePage.close();

  const canonicalCases = [
    ['relay-cache', 'bonus-life', 'coin-blaster', 1, 1, 3],
    ['relay-armory', 'coin-blaster-cache', 'coin-blaster', 1, 1, 3],
    ['ravine-salvage', 'scatter-shotgun-cache', 'scatter-shotgun', 1, 1, 3],
    ['ravine-overlook-cache', 'time-dilation', 'coin-blaster', 1, 1.2, 3],
    ['crossing-fuel-depot', 'nuke-liquidation', 'coin-blaster', 1, 1, 4],
    ['crossing-bank-cache', 'hash-rail-core', 'hash-rail', 1, 1, 3],
    ['hashwood-shrine', 'berserk-candle', 'coin-blaster', 2, 1, 3],
    ['mining-control-room', 'auto-miner-cache', 'auto-miner', 1, 1, 3],
    ['yard-extraction-console', 'launcher-rig-cache', 'launcher-rig', 1, 1, 3],
  ];
  const canonical = [];
  for (const [pointOfInterestId, effectId, weaponId, damageMultiplier, speedMultiplier, handGrenades] of canonicalCases) {
    const casePage = await browser.newPage({ viewport: { width: 1024, height: 720 }, deviceScaleFactor: 1 });
    casePage.on('pageerror', (error) => errors.push(error.message));
    casePage.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    const healthPilot = pointOfInterestId === 'relay-cache' ? '&collectibleHealthPilot=1' : '';
    const ammoPilot = pointOfInterestId === 'crossing-bank-cache' ? '&collectibleAmmoPilot=1' : '';
    await casePage.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=collectible-${pointOfInterestId}${healthPilot}${ammoPilot}`, { waitUntil: 'networkidle' });
    await casePage.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.collectibleCount) === 1, null, { timeout: 5000 });
    if (effectId === 'nuke-liquidation') {
      await casePage.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.enemyCount) === 0, null, { timeout: 5000 });
    }
    const observed = await casePage.locator('#hmhRebootStage').evaluate((element) => ({
      effectId: element.dataset.collectibleLast,
      weaponId: element.dataset.weaponId,
      damageMultiplier: Number(element.dataset.collectibleDamageMultiplier),
      speedMultiplier: Number(element.dataset.collectibleSpeedMultiplier),
      handGrenades: Number(element.dataset.handGrenades),
      enemyCount: Number(element.dataset.enemyCount),
      playerHealth: Number(element.dataset.playerHealth),
      ammo: Number(element.dataset.weaponAmmo),
      runXp: Number(element.dataset.runXp),
    }));
    if (effectId === 'hash-rail-core') {
      assert.equal(observed.ammo, 3, 'Hash Rail pickup did not load its bounded magazine');
      assert.equal(observed.runXp, 160, 'Hash Rail pickup did not award canonical run XP');
    } else {
      const expectedRunXp = effectId === 'nuke-liquidation' ? 260 : 0;
      assert.equal(observed.runXp, expectedRunXp, `${effectId} XP drifted`);
    }
    const { ammo, runXp, ...contract } = observed;
    assert.deepEqual(contract, { effectId, weaponId, damageMultiplier, speedMultiplier, handGrenades, enemyCount: effectId === 'nuke-liquidation' ? 0 : 2, playerHealth: 100 }, pointOfInterestId);
    canonical.push({ pointOfInterestId, ...observed });
    await casePage.close();
  }
  await timedPage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.collectibleActive === '', null, { timeout: 12000 });
  const expired = await timedPage.locator('#hmhRebootStage').evaluate((element) => ({
    active: element.dataset.collectibleActive,
    speedMultiplier: Number(element.dataset.collectibleSpeedMultiplier),
  }));
  assert.deepEqual(expired, { active: '', speedMultiplier: 1 });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', before, collected, reset, timed, mobile, landscape, expired, accessibleStatus, canonical, errors }));
} finally {
  await browser.close();
}
