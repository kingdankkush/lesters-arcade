import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const url = `${origin}/hmh-reboot/index.html?debugGrid=1`;
const evidenceDir = new URL('../.hermes/evidence/hmh-reboot-phase8-combat/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const state = (page) => page.locator('#hmhRebootStage').evaluate((stage) => ({
  weaponId: stage.dataset.weaponId,
  ammo: Number(stage.dataset.weaponAmmo),
  lastWeaponFire: stage.dataset.lastWeaponFire,
  lastMeleeTick: stage.dataset.lastMeleeTick,
  lastMeleeHits: Number(stage.dataset.lastMeleeHits),
  grenadeCount: Number(stage.dataset.grenadeCount),
  handGrenades: Number(stage.dataset.handGrenades),
  lastGrenadeReason: stage.dataset.lastGrenadeReason,
  lastGrenadeTick: stage.dataset.lastGrenadeTick,
  playerHealth: Number(stage.dataset.playerHealth),
  audioVoices: Number(stage.dataset.audioVoices),
  projectileDrops: Number(stage.dataset.projectileDrops),
}));

async function holdKey(page, key, ms = 120) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function tapTouchControl(page, action, pointerId) {
  const locator = page.locator(`[data-hmh-control="${action}"]`);
  const box = await locator.boundingBox();
  assert.ok(box, `${action} touch button is not laid out`);
  const point = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
  await locator.evaluate((element, input) => {
    element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: input.pointerId,
      pointerType: 'touch',
      clientX: input.x,
      clientY: input.y,
      isPrimary: true,
    }));
  }, { ...point, pointerId });
  await page.waitForTimeout(120);
  await page.evaluate((input) => {
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerId: input.pointerId,
      pointerType: 'touch',
      clientX: input.x,
      clientY: input.y,
      isPrimary: true,
    }));
  }, { ...point, pointerId });
}

async function ready(page, errors) {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster');
  await page.locator('canvas').focus();
}

async function desktopSmoke() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  await ready(page, errors);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'coin-blaster');
  const pistol = await state(page);

  await holdKey(page, 'Digit2');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'scatter-shotgun');
  const shotgun = await state(page);

  await holdKey(page, 'Digit3');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'auto-miner');
  const machineGun = await state(page);

  await holdKey(page, 'Digit4');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'launcher-rig');
  await page.waitForFunction(() => Boolean(document.querySelector('#hmhRebootStage')?.dataset.lastGrenadeTick));
  const launcher = await state(page);

  await holdKey(page, 'KeyE');
  await page.waitForFunction(() => Boolean(document.querySelector('#hmhRebootStage')?.dataset.lastMeleeTick));
  const melee = await state(page);

  const priorGrenadeTick = melee.lastGrenadeTick;
  await holdKey(page, 'KeyG');
  await page.waitForFunction((prior) => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.lastGrenadeTick && stage.dataset.lastGrenadeTick !== prior;
  }, priorGrenadeTick, { timeout: 3000 });
  const handGrenade = await state(page);
  const accessibleStatus = await page.locator('#hmhRebootCombatStatus').evaluate((element) => element.value || element.textContent);
  await page.screenshot({ path: fileURLToPath(new URL('desktop-combat.png', evidenceDir)), fullPage: true });

  assert.equal(pistol.lastWeaponFire, 'coin-blaster');
  assert.equal(shotgun.lastWeaponFire, 'scatter-shotgun');
  assert.equal(machineGun.lastWeaponFire, 'auto-miner');
  assert.equal(launcher.lastWeaponFire, 'launcher-rig');
  assert.match(launcher.lastGrenadeReason, /impact|fuse/);
  assert.ok(Number(melee.lastMeleeTick) > 0);
  assert.equal(handGrenade.handGrenades, 2);
  assert.notEqual(handGrenade.lastGrenadeTick, priorGrenadeTick);
  assert.match(accessibleStatus, /rounds.*grenades.*health.*defeats/i);
  assert.ok(handGrenade.audioVoices <= 16);
  assert.equal(handGrenade.projectileDrops, 0);
  assert.deepEqual(errors, []);
  await page.close();
  return { pistol, shotgun, machineGun, launcher, melee, handGrenade, accessibleStatus, errors };
}

async function mobileSmoke() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  await ready(page, errors);
  assert.equal(await page.locator('[data-hmh-control]').count(), 8);
  await tapTouchControl(page, 'weaponNext', 71);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'scatter-shotgun');
  await tapTouchControl(page, 'melee', 72);
  await page.waitForFunction(() => Boolean(document.querySelector('#hmhRebootStage')?.dataset.lastMeleeTick));
  await tapTouchControl(page, 'grenade', 73);
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.handGrenades) === 2);
  const controls = await page.locator('[data-hmh-control]').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { control: element.dataset.hmhControl, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }));
  for (const control of controls) {
    assert.ok(control.left >= 0 && control.top >= 0 && control.right <= 390 && control.bottom <= 844, `${control.control} escaped mobile viewport`);
  }
  const mobileState = await state(page);
  await page.screenshot({ path: fileURLToPath(new URL('mobile-combat.png', evidenceDir)), fullPage: true });
  assert.equal(mobileState.weaponId, 'scatter-shotgun');
  assert.ok(Number(mobileState.lastMeleeTick) > 0);
  assert.equal(mobileState.handGrenades, 2);
  assert.ok(mobileState.audioVoices <= 16);
  assert.deepEqual(errors, []);
  await context.close();
  return { state: mobileState, controls, errors };
}

try {
  const report = { desktop: await desktopSmoke(), mobile: await mobileSmoke() };
  await writeFile(new URL('report.json', evidenceDir), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
