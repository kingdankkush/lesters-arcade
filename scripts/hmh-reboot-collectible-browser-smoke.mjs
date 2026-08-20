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
  assert.deepEqual({ count: before.count, remaining: before.remaining }, { count: 0, remaining: 13 });
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
  assert.deepEqual({ count: collected.count, remaining: collected.remaining }, { count: 1, remaining: 12 });
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
      && Number(element.dataset.collectibleRemaining) === 13;
  }, null, { timeout: 5000 });
  const reset = await page.locator('#hmhRebootStage').evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    remaining: Number(element.dataset.collectibleRemaining),
    active: element.dataset.collectibleActive,
    weaponId: element.dataset.weaponId,
    handGrenades: Number(element.dataset.handGrenades),
  }));
  assert.deepEqual(reset, { count: 0, remaining: 13, active: '', weaponId: 'coin-blaster', handGrenades: 3 });

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
    countdown: element.dataset.collectibleCountdown,
    refreshCount: Number(element.dataset.collectibleRefreshCount),
    silhouettes: element.dataset.timedEffectSilhouettes,
    audioCues: element.dataset.timedEffectAudioCues,
  }));
  const accessibleStatus = await timedPage.locator('#hmhRebootCombatStatus').evaluate((element) => element.value || element.textContent);
  assert.deepEqual({ count: timed.count, remaining: timed.remaining }, { count: 1, remaining: 12 });
  assert.equal(timed.last, 'time-dilation');
  assert.equal(timed.active, 'time-dilation');
  assert.match(timed.countdown, /^DILATION (?:9|10)S$/);
  assert.equal(timed.refreshCount, 0);
  assert.equal(timed.silhouettes, 'clock-orbit');
  assert.equal(timed.audioCues, 'time-dilation-activate');
  assert.match(accessibleStatus, /active powerups: time dilation, (?:9|10) seconds remaining/i);

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
    countdown: element.dataset.collectibleCountdown,
    silhouettes: element.dataset.timedEffectSilhouettes,
    audioCues: element.dataset.timedEffectAudioCues,
  }));
  assert.equal(mobile.count, 1);
  assert.equal(mobile.active, 'time-dilation');
  assert.equal(mobile.speedMultiplier, 1.2);
  assert.match(mobile.countdown, /^DILATION (?:9|10)S$/);
  assert.equal(mobile.silhouettes, 'clock-orbit');
  assert.equal(mobile.audioCues, 'time-dilation-activate');
  await mobilePage.close();

  const refreshPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  refreshPage.on('pageerror', (error) => errors.push(error.message));
  refreshPage.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await refreshPage.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&collectibleRefreshPilot=1&worldTour=collectible-ravine-overlook-cache`, { waitUntil: 'networkidle' });
  await refreshPage.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.collectibleRefreshCount) === 1, null, { timeout: 5000 });
  if (process.env.HMH_COLLECTIBLE_REFRESH_SCREENSHOT) {
    await refreshPage.screenshot({ path: process.env.HMH_COLLECTIBLE_REFRESH_SCREENSHOT, fullPage: true });
  }
  const refreshed = await refreshPage.locator('#hmhRebootStage').evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    active: element.dataset.collectibleActive,
    countdown: element.dataset.collectibleCountdown,
    refreshCount: Number(element.dataset.collectibleRefreshCount),
    silhouettes: element.dataset.timedEffectSilhouettes,
    audioCues: element.dataset.timedEffectAudioCues,
  }));
  const refreshedAccessibleStatus = await refreshPage.locator('#hmhRebootCombatStatus').evaluate((element) => element.value || element.textContent);
  assert.equal(refreshed.count, 2);
  assert.equal(refreshed.active, 'time-dilation');
  assert.match(refreshed.countdown, /^DILATION (?:9|10)S R1$/);
  assert.equal(refreshed.refreshCount, 1);
  assert.equal(refreshed.silhouettes, 'clock-orbit');
  assert.equal(refreshed.audioCues, 'time-dilation-activate');
  assert.match(refreshedAccessibleStatus, /active powerups: time dilation, (?:9|10) seconds remaining, refreshed 1 time/i);
  await refreshPage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.collectibleActive === '', null, { timeout: 14_000 });
  const refreshedExpired = await refreshPage.locator('#hmhRebootStage').evaluate((element) => ({
    active: element.dataset.collectibleActive,
    countdown: element.dataset.collectibleCountdown,
    refreshCount: Number(element.dataset.collectibleRefreshCount),
  }));
  const expiredAccessibleStatus = await refreshPage.locator('#hmhRebootCombatStatus').evaluate((element) => element.value || element.textContent);
  assert.deepEqual(refreshedExpired, { active: '', countdown: '', refreshCount: 0 });
  assert.match(expiredAccessibleStatus, /no active powerups/i);
  await refreshPage.close();

  const timedResetPage = await browser.newPage({ viewport: { width: 1024, height: 720 }, deviceScaleFactor: 1 });
  timedResetPage.on('pageerror', (error) => errors.push(error.message));
  timedResetPage.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await timedResetPage.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=ravine`, { waitUntil: 'networkidle' });
  await timedResetPage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster');
  await timedResetPage.keyboard.down('d');
  await timedResetPage.keyboard.down('w');
  await timedResetPage.waitForTimeout(550);
  await timedResetPage.keyboard.up('w');
  await timedResetPage.keyboard.up('d');
  await timedResetPage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.collectibleActive === 'time-dilation', null, { timeout: 5000 });
  await timedResetPage.reload({ waitUntil: 'networkidle' });
  await timedResetPage.waitForFunction(() => {
    const element = document.querySelector('#hmhRebootStage');
    return element?.dataset.weaponId === 'coin-blaster'
      && element.dataset.collectibleActive === ''
      && Number(element.dataset.collectibleCount) === 0
      && Number(element.dataset.collectibleRemaining) === 13;
  }, null, { timeout: 5000 });
  const timedReset = await timedResetPage.locator('#hmhRebootStage').evaluate((element) => ({
    count: Number(element.dataset.collectibleCount),
    remaining: Number(element.dataset.collectibleRemaining),
    active: element.dataset.collectibleActive,
    weaponId: element.dataset.weaponId,
    handGrenades: Number(element.dataset.handGrenades),
  }));
  assert.deepEqual(timedReset, { count: 0, remaining: 13, active: '', weaponId: 'coin-blaster', handGrenades: 3 });
  await timedResetPage.close();

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
    countdown: element.dataset.collectibleCountdown,
    silhouettes: element.dataset.timedEffectSilhouettes,
    audioCues: element.dataset.timedEffectAudioCues,
  }));
  assert.equal(landscape.count, 1);
  assert.equal(landscape.active, 'time-dilation');
  assert.equal(landscape.speedMultiplier, 1.2);
  assert.match(landscape.countdown, /^DILATION (?:9|10)S$/);
  assert.equal(landscape.silhouettes, 'clock-orbit');
  assert.equal(landscape.audioCues, 'time-dilation-activate');
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
    if (effectId === 'berserk-candle' && process.env.HMH_COLLECTIBLE_BERSERK_SCREENSHOT) {
      await casePage.screenshot({ path: process.env.HMH_COLLECTIBLE_BERSERK_SCREENSHOT, fullPage: true });
    }
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
      silhouettes: element.dataset.timedEffectSilhouettes,
      audioCues: element.dataset.timedEffectAudioCues,
    }));
    if (effectId === 'hash-rail-core') {
      assert.equal(observed.ammo, 3, 'Hash Rail pickup did not load its bounded magazine');
      assert.equal(observed.runXp, 160, 'Hash Rail pickup did not award canonical run XP');
    } else {
      const expectedRunXp = effectId === 'nuke-liquidation' ? 260 : 0;
      assert.equal(observed.runXp, expectedRunXp, `${effectId} XP drifted`);
    }
    const expectedIdentity = effectId === 'time-dilation'
      ? { silhouettes: 'clock-orbit', audioCues: 'time-dilation-activate' }
      : effectId === 'berserk-candle'
        ? { silhouettes: 'spiked-ring', audioCues: 'berserk-activate' }
        : { silhouettes: '', audioCues: '' };
    assert.deepEqual({ silhouettes: observed.silhouettes, audioCues: observed.audioCues }, expectedIdentity, `${effectId} identity drifted`);
    const { ammo, runXp, silhouettes: _silhouettes, audioCues: _audioCues, ...contract } = observed;
    assert.deepEqual(contract, { effectId, weaponId, damageMultiplier, speedMultiplier, handGrenades, enemyCount: effectId === 'nuke-liquidation' ? 0 : 2, playerHealth: 100 }, pointOfInterestId);
    canonical.push({ pointOfInterestId, ...observed });
    await casePage.close();
  }
  const bossSafetyPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  bossSafetyPage.on('pageerror', (error) => errors.push(error.message));
  bossSafetyPage.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await bossSafetyPage.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&boss=1&worldTour=collectible-crossing-fuel-depot`, { waitUntil: 'networkidle' });
  await bossSafetyPage.waitForFunction(() => {
    const element = document.querySelector('#hmhRebootStage');
    return Number(element?.dataset.collectibleCount) === 1
      && element?.dataset.bossActive === 'true'
      && Number(element?.dataset.bossHealth) < 12_000;
  }, null, { timeout: 5000 });
  const bossSafety = await bossSafetyPage.locator('#hmhRebootStage').evaluate((element) => ({
    effectId: element.dataset.collectibleLast,
    bossActive: element.dataset.bossActive,
    bossHealth: Number(element.dataset.bossHealth),
    enemyCount: Number(element.dataset.enemyCount),
    handGrenades: Number(element.dataset.handGrenades),
  }));
  assert.deepEqual(bossSafety, {
    effectId: 'nuke-liquidation',
    bossActive: 'true',
    bossHealth: 11_001,
    enemyCount: 0,
    handGrenades: 4,
  });
  await bossSafetyPage.close();

  await timedPage.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.collectibleActive === '', null, { timeout: 12000 });
  const expired = await timedPage.locator('#hmhRebootStage').evaluate((element) => ({
    active: element.dataset.collectibleActive,
    speedMultiplier: Number(element.dataset.collectibleSpeedMultiplier),
  }));
  assert.deepEqual(expired, { active: '', speedMultiplier: 1 });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', before, collected, reset, timed, mobile, refreshed, refreshedExpired, refreshedAccessibleStatus, expiredAccessibleStatus, timedReset, landscape, bossSafety, expired, accessibleStatus, canonical, errors }));
} finally {
  await browser.close();
}
