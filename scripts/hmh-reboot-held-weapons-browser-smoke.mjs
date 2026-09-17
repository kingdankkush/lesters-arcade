// Held-weapon browser smoke (HMH-N03, 2026-09-16).
//
// Every carried weapon is equipped in turn on the production hero at the
// desktop (1280x800) and portrait-touch (390x844) viewports. For each one the
// stage must report the weapon's own page frame on the hero's weapon layer
// (`data-held-weapon-frame-id`), the native/overlay gate must hand the layer
// to that page, and a screenshot lands in
// .hermes/evidence/hmh-held-weapons-20260916/. Reloads and firing are
// exercised on the shotgun so the reload gesture and the recoil clip are
// observed on a page frame, not the pistol.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { HELD_WEAPON_IDS } from '../apps/hmh-reboot/src/held-weapon-atlas.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const actorFlag = process.argv.indexOf('--actor');
const actorId = actorFlag >= 0 ? process.argv[actorFlag + 1] : 'lit-commando';
const output = new URL('../.hermes/evidence/hmh-held-weapons-20260916/', import.meta.url);
await mkdir(output, { recursive: true });
const pathFor = (name) => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({
  executablePath: process.env.HMH_CHROME_PATH ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const readState = (page) => page.evaluate(() => {
  const stage = document.querySelector('#hmhRebootStage');
  return {
    weapon: document.querySelector('#hmhHudWeapon')?.dataset.weapon,
    actorArt: stage?.dataset.actorArt,
    actorArtActor: stage?.dataset.actorArtActor,
    frameIds: String(stage?.dataset.actorArtFrameIds ?? '').split(',').filter(Boolean),
    heldWeaponStatus: stage?.dataset.heldWeaponStatus,
    heldWeaponFrameId: stage?.dataset.heldWeaponFrameId,
    heldWeaponError: stage?.dataset.heldWeaponError,
    heroMotionStatus: stage?.dataset.heroMotionStatus,
    heroMotionAction: stage?.dataset.heroMotionAction,
    reloadTicksRemaining: Number(stage?.dataset.weaponReloadTicksRemaining ?? 0),
    ticks: Number(stage?.dataset.simulationStepsTotal ?? 0),
    lastWeaponFire: stage?.dataset.lastWeaponFire,
  };
});

async function boot(page, { touch = false } = {}) {
  const errors = [];
  const failed = [];
  const pageRequests = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('requestfailed', (request) => failed.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('response', (response) => { if (response.url().includes('/hmh-held-weapons/')) pageRequests.push({ url: response.url().replace(origin, ''), status: response.status() }); });
  await page.goto(`${origin}/hmh-reboot/?evidenceSafe=1&weaponPilot=1&telemetry=1&productionPilot=1&productionHero=${actorId}${touch ? '&touchControls=1' : ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction((expected) => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.actorArt === 'production-hero-atlas' && stage.dataset.actorArtActor === expected && stage.dataset.heroMotionStatus === 'ready';
  }, actorId, { timeout: 60_000 });
  return { errors, failed, pageRequests };
}

async function equip(page, weaponId) {
  // Q cycles forward through the carried loadout until the HUD names the weapon.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await readState(page)).weapon === weaponId) break;
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(120);
  }
  assert.equal((await readState(page)).weapon, weaponId, `could not equip ${weaponId}`);
  await page.waitForFunction((id) => (document.querySelector('#hmhRebootStage')?.dataset.heldWeaponFrameId ?? '').includes(`__${id}__`), weaponId, { timeout: 15_000 })
    .catch(async () => { throw new Error(`${weaponId}: page frame never reached the weapon layer: ${JSON.stringify(await readState(page))}`); });
}

const report = { actorId, desktop: {}, touch: {} };
for (const [profile, viewport, touch] of [['desktop', { width: 1280, height: 800 }, false], ['touch', { width: 390, height: 844 }, true]]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const diagnostics = await boot(page, { touch });
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas, 'stage canvas is required');
  // Aim east so the muzzle direction is unambiguous in the screenshots.
  await page.mouse.move(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.5);
  const weapons = {};
  for (const weaponId of HELD_WEAPON_IDS) {
    await equip(page, weaponId);
    await page.waitForTimeout(250);
    const state = await readState(page);
    assert.equal(state.heldWeaponStatus, 'ready', `${weaponId} page status ${state.heldWeaponStatus} ${state.heldWeaponError ?? ''}`);
    assert.match(state.heldWeaponFrameId, new RegExp(`^${actorId}__${weaponId}__(aim|idle-check|reload|pistol-fire|dash)__`), `${weaponId} must render its own page frame`);
    assert.equal(state.frameIds[3], state.heldWeaponFrameId, 'the weapon layer shows the page frame');
    assert.ok(state.frameIds.slice(0, 3).every((id) => id.startsWith(`${actorId}__`)), 'body layers stay native');
    await page.screenshot({ path: pathFor(`${actorId}-${profile}-${weaponId}.png`) });
    weapons[weaponId] = { frameId: state.heldWeaponFrameId, frameIds: state.frameIds };
  }
  // Shotgun: fire until the magazine reloads, then confirm the page reload
  // gesture and the recoil clip both surfaced on a page frame.
  await equip(page, 'scatter-shotgun');
  const observed = { fire: false, reload: false };
  await page.mouse.down();
  for (let index = 0; index < 120 && !(observed.fire && observed.reload); index += 1) {
    await page.waitForTimeout(50);
    const state = await readState(page);
    if (/__scatter-shotgun__pistol-fire__/.test(state.heldWeaponFrameId)) { observed.fire = true; if (!observed.fireShot) { observed.fireShot = true; await page.screenshot({ path: pathFor(`${actorId}-${profile}-scatter-shotgun-fire.png`) }); } }
    if (/__scatter-shotgun__reload__/.test(state.heldWeaponFrameId)) { observed.reload = true; if (!observed.reloadShot) { observed.reloadShot = true; await page.screenshot({ path: pathFor(`${actorId}-${profile}-scatter-shotgun-reload.png`) }); } }
  }
  await page.mouse.up();
  assert.equal(observed.fire, true, 'the shotgun must play its page recoil frames while firing');
  assert.equal(observed.reload, true, 'the shotgun must play its page reload frames while reloading');
  assert.deepEqual(diagnostics.errors, [], 'no page or console errors');
  assert.deepEqual(diagnostics.failed, [], 'no failed requests');
  assert.ok(diagnostics.pageRequests.every((request) => request.status === 200), `held-weapon page requests must succeed: ${JSON.stringify(diagnostics.pageRequests)}`);
  assert.ok(diagnostics.pageRequests.some((request) => request.url.endsWith(`${actorId}-held-weapons.json`)), 'metadata fetched once');
  report[profile] = { viewport, weapons, observed: { fire: observed.fire, reload: observed.reload }, pageRequests: diagnostics.pageRequests };
  await context.close();
}
await browser.close();
await writeFile(pathFor(`${actorId}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: 'pass', actorId, desktopWeapons: Object.keys(report.desktop.weapons).length, touchWeapons: Object.keys(report.touch.weapons).length }));
