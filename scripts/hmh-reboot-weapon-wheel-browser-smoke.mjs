// Weapon swap + wheel browser smoke (owner direction 2026-09-16).
//
// Desktop: Q cycles carried weapons, Tab opens the wheel, a digit picks,
// Escape closes without a pick, and the HUD weapon card is a click target.
// Touch: the SWAP button sits inside the viewport and cycles the weapon.
// Both profiles run with the evidence-safe weapon pilot so every weapon is
// carried from tick 0. Evidence lands in .hermes/evidence/hmh-reboot-weapon-wheel/.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const output = new URL('../.hermes/evidence/hmh-reboot-weapon-wheel/', import.meta.url);
await mkdir(output, { recursive: true });
const pathFor = (name) => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({
  executablePath: process.env.HMH_CHROME_PATH ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const hudWeapon = () => document.querySelector('#hmhHudWeapon')?.dataset.weapon;

async function readState(page) {
  return page.evaluate(() => ({
    weapon: document.querySelector('#hmhHudWeapon')?.dataset.weapon,
    weaponName: document.querySelector('#hmhHudWeaponName')?.textContent,
    activeSlot: [...document.querySelectorAll('#hmhHudWeaponSlots b')].findIndex((chip) => chip.dataset.active === 'true'),
    owned: [...document.querySelectorAll('#hmhHudWeaponSlots b')].filter((chip) => chip.dataset.owned === 'true').length,
    simulation: document.querySelector('#hmhRebootStage')?.dataset.simulationState,
    ticks: Number(document.querySelector('#hmhRebootStage')?.dataset.simulationStepsTotal ?? 0),
    wheelOpen: document.querySelector('#hmhWeaponWheel')?.hidden === false,
    wheelStatus: document.querySelector('#hmhRebootStage')?.dataset.weaponWheel ?? '',
    combatStatus: document.querySelector('#hmhRebootCombatStatus')?.textContent,
  }));
}

async function waitForWeapon(page, weaponId, label) {
  await page.waitForFunction((id) => document.querySelector('#hmhHudWeapon')?.dataset.weapon === id, weaponId, { timeout: 5_000 })
    .catch(async () => { throw new Error(`${label}: expected ${weaponId}, HUD shows ${await page.evaluate(hudWeapon)}`); });
}

async function boot(page, { touch = false } = {}) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/hmh-reboot/?evidenceSafe=1&weaponPilot=1${touch ? '&touchControls=1' : ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.simulationStepsTotal ?? 0) > 30, null, { timeout: 60_000 });
  return errors;
}

const report = { desktop: {}, touch: {} };

// ---- Desktop ---------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = await boot(page);
  const start = await readState(page);
  assert.equal(start.weapon, 'coin-blaster', 'the pistol is armed at tick 0');
  assert.equal(start.owned, 8, 'the weapon pilot carries every weapon');

  await page.keyboard.press('KeyQ');
  await waitForWeapon(page, 'scatter-shotgun', 'Q swap');
  await page.keyboard.press('KeyQ');
  await waitForWeapon(page, 'auto-miner', 'second Q swap');
  // A held key must not keep cycling.
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyE');
  const afterHeld = await readState(page);
  assert.equal(afterHeld.weapon, 'launcher-rig', `a held swap key cycled more than once (HUD shows ${afterHeld.weapon})`);
  await page.screenshot({ path: pathFor('desktop-after-swap.png') });

  // Tab opens the wheel and freezes the simulation.
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === false, null, { timeout: 5_000 });
  // The stage dataset mirrors the simulation state once per rendered frame.
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.simulationState === 'menu', null, { timeout: 2_000 })
    .catch(async () => { throw new Error(`the simulation did not hold while the wheel is open (state ${(await readState(page)).simulation})`); });
  const openState = await readState(page);
  const ticksAtOpen = openState.ticks;
  await page.waitForTimeout(300);
  assert.equal((await readState(page)).ticks, ticksAtOpen, 'no ticks advance while the wheel is open');
  const slots = await page.locator('.hmh-weapon-wheel-slot').evaluateAll((nodes) => nodes.map((node) => ({
    slot: node.dataset.slot, weapon: node.dataset.weapon, disabled: node.disabled, active: node.dataset.active,
    rect: (({ x, y, width, height }) => ({ x, y, width, height }))(node.getBoundingClientRect()),
  })));
  assert.equal(slots.length, 8);
  assert.ok(slots.every((slot) => !slot.disabled), 'every carried weapon is selectable');
  assert.equal(slots.find((slot) => slot.active === 'true')?.weapon, 'launcher-rig');
  for (const slot of slots) {
    assert.ok(slot.rect.x >= 0 && slot.rect.y >= 0 && slot.rect.x + slot.rect.width <= 1280 && slot.rect.y + slot.rect.height <= 800, `wheel slot ${slot.weapon} escaped the viewport`);
  }
  await page.screenshot({ path: pathFor('desktop-wheel-open.png') });
  // Escape closes without a pick.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === true, null, { timeout: 5_000 });
  await page.waitForTimeout(200);
  const afterEscape = await readState(page);
  assert.equal(afterEscape.weapon, 'launcher-rig', 'Escape must not change the weapon');
  assert.equal(afterEscape.simulation, 'active', 'Escape resumes the run instead of pausing it');
  assert.ok(afterEscape.ticks > ticksAtOpen, 'ticks resume after the wheel closes');

  // The HUD card opens the wheel; a digit picks the rail.
  await page.locator('#hmhHudWeapon').click();
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === false, null, { timeout: 5_000 });
  await page.keyboard.press('Digit5');
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === true, null, { timeout: 5_000 });
  await waitForWeapon(page, 'hash-rail', 'wheel pick 5');
  // Click pick: reopen and choose the pistol by pointer.
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === false, null, { timeout: 5_000 });
  await page.locator('.hmh-weapon-wheel-slot[data-weapon="coin-blaster"]').click();
  await waitForWeapon(page, 'coin-blaster', 'wheel click pick');
  const final = await readState(page);
  assert.equal(final.simulation, 'active');
  assert.equal(final.wheelOpen, false);
  // Tab toggles: a second Tab closes without reopening (the wheel's own
  // capture-phase handler marks the event; the runtime must respect it).
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === false, null, { timeout: 5_000 });
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === true, null, { timeout: 5_000 });
  await page.waitForTimeout(150);
  assert.equal((await readState(page)).wheelOpen, false, 'Tab reopened the wheel it had just closed');
  assert.equal((await readState(page)).simulation, 'active');
  // Escape with the wheel open closes it; the next Escape pauses the run.
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === false, null, { timeout: 5_000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === true, null, { timeout: 5_000 });
  await page.waitForTimeout(150);
  assert.equal((await readState(page)).simulation, 'active', 'Escape on the open wheel must not pause');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.simulationState === 'paused', null, { timeout: 5_000 });
  assert.equal((await readState(page)).wheelOpen, false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.simulationState === 'active', null, { timeout: 5_000 });
  assert.deepEqual(errors, [], `desktop runtime errors: ${errors.join(' | ')}`);
  report.desktop = { start, afterHeld, openState, afterEscape, final };
  await page.close();
}

// ---- Touch -----------------------------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = await boot(page, { touch: true });
  const controls = await page.locator('[data-hmh-control]').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { name: node.dataset.hmhControl, x: rect.x, y: rect.y, width: rect.width, height: rect.height, cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2 };
  }));
  assert.deepEqual(controls.map((control) => control.name).sort(), ['aim', 'move', 'pause', 'power', 'swap']);
  const swap = controls.find((control) => control.name === 'swap');
  assert.ok(swap.x >= 0 && swap.y >= 0 && swap.x + swap.width <= 390 && swap.y + swap.height <= 844, 'swap button escaped the viewport');
  assert.ok(swap.width >= 44 && swap.height >= 44, 'swap button below the 44 px target');
  for (const other of controls.filter((control) => control.name !== 'swap')) {
    const overlapX = Math.max(0, Math.min(swap.x + swap.width, other.x + other.width) - Math.max(swap.x, other.x));
    const overlapY = Math.max(0, Math.min(swap.y + swap.height, other.y + other.height) - Math.max(swap.y, other.y));
    assert.equal(overlapX * overlapY, 0, `swap overlaps ${other.name}`);
  }
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.dataset.hmhControl ?? document.elementFromPoint(x, y)?.className, [swap.cx, swap.cy]);
  assert.equal(hit, 'swap', `swap centre resolves to ${hit}`);
  const before = await readState(page);
  await page.touchscreen.tap(swap.cx, swap.cy);
  await waitForWeapon(page, 'scatter-shotgun', 'touch swap');
  await page.touchscreen.tap(swap.cx, swap.cy);
  await waitForWeapon(page, 'auto-miner', 'second touch swap');
  await page.screenshot({ path: pathFor('touch-after-swap.png') });
  // The HUD card opens the wheel on touch too, and a slot tap picks.
  const card = await page.locator('#hmhHudWeapon').boundingBox();
  assert.ok(card, 'HUD weapon card visible on touch');
  await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
  await page.waitForFunction(() => document.querySelector('#hmhWeaponWheel')?.hidden === false, null, { timeout: 5_000 });
  const wheelSlots = await page.locator('.hmh-weapon-wheel-slot').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { weapon: node.dataset.weapon, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  await page.screenshot({ path: pathFor('touch-wheel-open.png') });
  for (const slot of wheelSlots) {
    assert.ok(slot.x >= 0 && slot.y >= 0 && slot.x + slot.width <= 390 && slot.y + slot.height <= 844, `touch wheel slot ${slot.weapon} escaped the viewport: ${JSON.stringify(slot)}`);
    assert.ok(slot.height >= 40, `touch wheel slot ${slot.weapon} is only ${slot.height}px tall`);
  }
  const rail = wheelSlots.find((slot) => slot.weapon === 'hash-rail');
  await page.touchscreen.tap(rail.x + rail.width / 2, rail.y + rail.height / 2);
  await waitForWeapon(page, 'hash-rail', 'touch wheel pick');
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.simulationState === 'active', null, { timeout: 5_000 });
  assert.deepEqual(errors, [], `touch runtime errors: ${errors.join(' | ')}`);
  report.touch = { controls, before, after: await readState(page) };
  await context.close();
}

await browser.close();
await writeFile(pathFor('report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('weapon wheel smoke passed', JSON.stringify({ desktop: report.desktop.final?.weapon, touch: report.touch.after?.weapon }));
