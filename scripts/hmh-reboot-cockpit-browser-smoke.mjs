import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const output = new URL('../.hermes/evidence/hmh-reboot-16-cockpit/', import.meta.url);
await mkdir(output, { recursive: true });
const pathFor = (name) => fileURLToPath(new URL(`${name}.png`, output));
const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

async function inspect(name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/hmh-reboot/?evidenceSafe=1&telemetry=1&progressionPilot=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#hmhUpgradePanel:not([hidden])');
  const choices = await page.locator('.hmh-upgrade-choice').evaluateAll((nodes) => nodes.map((node) => ({ id: node.dataset.upgradeId, text: node.textContent.trim() })));
  assert.equal(choices.length, 2);
  const details = page.locator('.hmh-upgrade-details');
  assert.equal(await details.count(), 2);
  let disclosure;
  if (viewport.width <= 600) {
    const firstDetails = details.first();
    const summary = firstDetails.locator('summary');
    const summaryBox = await summary.boundingBox();
    assert.ok(summaryBox && summaryBox.height >= 44, `mobile upgrade details target is only ${summaryBox?.height ?? 0}px tall`);
    assert.equal(await summary.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.hmh-upgrade-choice').first().isEnabled(), true);
    await summary.click();
    await page.waitForFunction(() => document.querySelector('.hmh-upgrade-details summary')?.getAttribute('aria-expanded') === 'true');
    assert.equal(await firstDetails.locator('p').isVisible(), true);
    assert.equal(await page.locator('#hmhUpgradePanel').getAttribute('hidden'), null);
    const panelBox = await page.locator('.hmh-upgrade-panel').boundingBox();
    assert.ok(panelBox && panelBox.x >= 0 && panelBox.y >= 0 && panelBox.x + panelBox.width <= viewport.width && panelBox.y + panelBox.height <= viewport.height, 'open mobile upgrade details escaped the viewport');
    disclosure = { summaryHeight: summaryBox.height, expanded: true, panelBox, text: (await firstDetails.locator('p').textContent()).trim() };
    await page.screenshot({ path: pathFor(`${name}-upgrade-detail`), fullPage: true });
  } else {
    const openStates = await details.evaluateAll((nodes) => nodes.map((node) => ({ open: node.open, text: node.querySelector('p')?.textContent.trim() })));
    assert.ok(openStates.every((entry) => entry.open && entry.text));
    disclosure = { openStates };
  }
  const upgradePanelBox = await page.locator('.hmh-upgrade-panel').boundingBox();
  assert.ok(upgradePanelBox && upgradePanelBox.x >= 0 && upgradePanelBox.y >= 0 && upgradePanelBox.x + upgradePanelBox.width <= viewport.width && upgradePanelBox.y + upgradePanelBox.height <= viewport.height, `${name} upgrade panel escaped the viewport`);
  await page.screenshot({ path: pathFor(`${name}-upgrade`), fullPage: true });
  // Cycle 073 (U-4): every card carries a tier band and an icon that resolves,
  // arrows move the armed ring, and Digit1 picks the (re-armed) first card so
  // every downstream HUD/build assertion is unchanged from the click path.
  const tiers = await page.locator('.hmh-upgrade-option').evaluateAll((nodes) => nodes.map((node) => node.dataset.tier));
  assert.ok(tiers.length === 2 && tiers.every((tier) => ['mastery', 'core', 'weapon', 'capstone'].includes(tier)), `unknown tier band: ${tiers.join(', ')}`);
  const iconStatuses = await page.locator('.hmh-upgrade-choice__icon').evaluateAll((nodes) => Promise.all(nodes.map(async (node) => {
    const url = /url\("([^"]+)"\)/.exec(node.style.backgroundImage)?.[1];
    if (!url) return 0;
    const response = await fetch(url);
    return response.status;
  })));
  assert.deepEqual(iconStatuses, [200, 200], `upgrade icon request failed: ${iconStatuses.join(', ')}`);
  const armedBefore = await page.locator('.hmh-upgrade-option').evaluateAll((nodes) => nodes.map((node) => node.classList.contains('hmh-upgrade-option--armed')));
  assert.deepEqual(armedBefore, [true, false], `${name} first card is not armed on open`);
  await page.keyboard.press('ArrowRight');
  const armedAfterRight = await page.locator('.hmh-upgrade-option').evaluateAll((nodes) => nodes.map((node) => node.classList.contains('hmh-upgrade-option--armed')));
  assert.deepEqual(armedAfterRight, [false, true], `${name} ArrowRight did not arm the second card`);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.upgradeId), choices[1].id);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.upgradeId), choices[0].id);
  const hotkeyVisible = await page.locator('.hmh-upgrade-choice__hotkey').first().isVisible();
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => document.querySelector('#hmhUpgradePanel')?.hidden === true);
  const keyboardPick = { tiers, iconStatuses, hotkeyVisible, pickedId: choices[0].id };
  const run = await page.evaluate(() => ({
    score: document.querySelector('#hmhRunScore')?.textContent,
    level: document.querySelector('#hmhRunLevel')?.textContent,
    xp: document.querySelector('#hmhRunXp')?.textContent,
    xpNext: document.querySelector('#hmhRunXpNext')?.textContent,
  }));
  assert.deepEqual(run, { score: '600', level: '2', xp: '180', xpNext: '600' });
  await page.screenshot({ path: pathFor(`${name}-hud`), fullPage: true });

  await page.click('#hmhProfileToggle');
  await page.waitForSelector('#hmhProfilePanel:not([hidden])');
  const profile = await page.locator('#hmhProfilePanel').innerText();
  assert.match(profile, /Standalone Developer/);
  assert.match(profile, /lit-commando/);
  await page.screenshot({ path: pathFor(`${name}-profile`), fullPage: true });
  await page.click('#hmhProfileToggle');

  const beforeMusic = await page.getAttribute('#hmhMusicToggle', 'aria-pressed');
  await page.click('#hmhMusicToggle');
  const afterMusic = await page.getAttribute('#hmhMusicToggle', 'aria-pressed');
  assert.equal(beforeMusic, 'true');
  assert.equal(afterMusic, 'false');

  await page.click('#hmhMenuToggle');
  await page.waitForSelector('#hmhPausePanel:not([hidden])');
  assert.equal(await page.locator('#hmhExitButton').isDisabled(), true);
  assert.equal(await page.locator('#hmhExitButton').textContent(), 'Arcade exit unavailable');
  const pausePanelBox = await page.locator('.hmh-menu-panel').boundingBox();
  assert.ok(pausePanelBox && pausePanelBox.x >= 0 && pausePanelBox.y >= 0 && pausePanelBox.x + pausePanelBox.width <= viewport.width && pausePanelBox.y + pausePanelBox.height <= viewport.height, `${name} pause panel escaped the viewport`);
  const actionBoxes = await page.locator('.hmh-menu-actions button').evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: box.height };
  }));
  assert.ok(actionBoxes.every((box) => box.top >= 0 && box.bottom <= viewport.height && box.height >= 44), `${name} pause actions are clipped: ${JSON.stringify(actionBoxes)}`);
  const settingIds = ['hmhSettingMusic', 'hmhSettingScreenShake', 'hmhSettingReduceMotion', 'hmhSettingReduceFlash'];
  const settingsInputs = page.locator('.hmh-setting-toggle input');
  assert.equal(await settingsInputs.count(), settingIds.length);
  const buildText = (await page.locator('#hmhBuildSummary').innerText()).trim();
  assert.match(buildText, /Rank 1\/3/);
  assert.match(buildText, /Validator Training|Gas Optimization|Block Reward/);
  assert.equal(await page.locator('#hmhSettingMusic').isChecked(), false);
  if (viewport.width <= 900) {
    const settingRows = await page.locator('.hmh-setting-toggle').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    assert.ok(settingRows.every((height) => height >= 44), `${name} has a settings row under 44px: ${settingRows.join(', ')}`);
  }
  await page.locator('#hmhSettingReduceMotion').check();
  await page.locator('#hmhSettingReduceFlash').check();
  await page.waitForFunction(() => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.settingReduceMotion === 'true' && stage.dataset.settingReduceFlash === 'true';
  });
  assert.equal(await page.locator('#hmhPausePanel').getAttribute('hidden'), null);
  // Cycle 073 (U-5): child-owned SFX slider. It is not a .hmh-setting-toggle,
  // the readout follows `input`, and the level survives Restart like the toggles.
  const sfxSlider = page.locator('#hmhSettingSfxVolume');
  assert.equal(await sfxSlider.getAttribute('type'), 'range');
  const sfxRowBox = await page.locator('.hmh-setting-range').boundingBox();
  const sfxTrackBox = await sfxSlider.boundingBox();
  if (viewport.width <= 900) {
    assert.ok(sfxRowBox && sfxRowBox.height >= 44, `${name} SFX slider row is only ${sfxRowBox?.height ?? 0}px tall`);
    assert.ok(sfxTrackBox && sfxTrackBox.height >= 44, `${name} SFX slider track target is only ${sfxTrackBox?.height ?? 0}px tall`);
  }
  await sfxSlider.evaluate((node) => {
    node.value = '0.3';
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal((await page.locator('#hmhSettingSfxVolumeValue').textContent()).trim(), '30%');
  assert.equal(await sfxSlider.inputValue(), '0.3');
  const settingsBeforeRestart = await page.locator('.hmh-setting-toggle input').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [node.id, node.checked])));
  await page.screenshot({ path: pathFor(`${name}-pause-settings`), fullPage: true });
  await page.click('#hmhRestartButton');
  await page.waitForFunction(() => document.querySelector('#hmhPausePanel')?.hidden === true);
  await page.waitForSelector('#hmhUpgradePanel:not([hidden])');
  await page.locator('.hmh-upgrade-choice').first().click();
  await page.waitForFunction(() => document.querySelector('#hmhUpgradePanel')?.hidden === true);
  await page.click('#hmhMenuToggle');
  await page.waitForSelector('#hmhPausePanel:not([hidden])');
  assert.equal(await page.locator('#hmhSettingReduceMotion').isChecked(), true);
  assert.equal(await page.locator('#hmhSettingReduceFlash').isChecked(), true);
  assert.equal(await page.locator('#hmhSettingMusic').isChecked(), false);
  assert.equal(await page.locator('#hmhSettingSfxVolume').inputValue(), '0.3', `${name} SFX level did not survive Restart`);
  assert.equal((await page.locator('#hmhSettingSfxVolumeValue').textContent()).trim(), '30%');
  const settingsAfterRestart = await page.locator('.hmh-setting-toggle input').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [node.id, node.checked])));
  await page.click('#hmhResumeButton');
  await page.waitForFunction(() => document.querySelector('#hmhPausePanel')?.hidden === true);
  await page.waitForFunction(() => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.authoredLandmarkAnimated === '0';
  });
  assert.deepEqual(errors, []);
  await page.close();
  return { choices, disclosure, keyboardPick, run, profile: profile.replaceAll('\n', ' · '), music: { beforeMusic, afterMusic }, buildText, settings: { beforeRestart: settingsBeforeRestart, afterRestart: settingsAfterRestart, sfxVolume: { row: sfxRowBox?.height, track: sfxTrackBox?.height } }, errors };
}

const result = {
  desktop: await inspect('desktop', { width: 1440, height: 900 }),
  tablet: await inspect('tablet', { width: 768, height: 1024 }),
  mobile: await inspect('mobile', { width: 390, height: 844 }),
  landscape: await inspect('landscape', { width: 844, height: 390 }),
};
await browser.close();
console.log(JSON.stringify(result, null, 2));
