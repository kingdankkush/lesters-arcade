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
  await page.goto(`${origin}/hmh-reboot/?evidenceSafe=1&progressionPilot=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#hmhUpgradePanel:not([hidden])');
  const choices = await page.locator('.hmh-upgrade-choice').evaluateAll((nodes) => nodes.map((node) => ({ id: node.dataset.upgradeId, text: node.textContent.trim() })));
  assert.equal(choices.length, 3);
  await page.screenshot({ path: pathFor(`${name}-upgrade`), fullPage: true });
  await page.locator('.hmh-upgrade-choice').first().click();
  await page.waitForFunction(() => document.querySelector('#hmhUpgradePanel')?.hidden === true);
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
  await page.screenshot({ path: pathFor(`${name}-pause`), fullPage: true });
  await page.click('#hmhResumeButton');
  await page.waitForFunction(() => document.querySelector('#hmhPausePanel')?.hidden === true);
  await page.waitForTimeout(100);
  assert.deepEqual(errors, []);
  await page.close();
  return { choices, run, profile: profile.replaceAll('\n', ' · '), music: { beforeMusic, afterMusic }, errors };
}

const result = {
  desktop: await inspect('desktop', { width: 1440, height: 900 }),
  mobile: await inspect('mobile', { width: 390, height: 844 }),
};
await browser.close();
console.log(JSON.stringify(result, null, 2));
