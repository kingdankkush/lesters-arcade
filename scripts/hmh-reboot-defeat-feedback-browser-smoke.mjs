import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const output = new URL('../.hermes/evidence/hmh-cycle075-defeat-feedback/', import.meta.url);
await mkdir(output, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const local = await readFile(new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url));
const response = await fetch(`${origin}/dist/hmh-reboot/game.js`);
assert.equal(response.status, 200);
assert.equal(sha(Buffer.from(await response.arrayBuffer())), sha(local), 'served candidate differs from local build');
const browser = await chromium.launch({executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl']});
const report = {origin, bundleSha256: sha(local), profiles: []};
try {
  for (const profile of [
    {name: 'desktop', viewport: {width: 1440, height: 900}, mobile: false, reduced: false, shards: 8},
    {name: 'mobile', viewport: {width: 390, height: 844}, mobile: true, reduced: false, shards: 5},
    {name: 'desktop-reduced', viewport: {width: 1440, height: 900}, mobile: false, reduced: true, shards: 0},
  ]) {
    const page = await browser.newPage({viewport: profile.viewport, deviceScaleFactor: 1, isMobile: profile.mobile, hasTouch: profile.mobile});
    const errors = [];
    page.on('pageerror', e => errors.push(`page: ${e.message}`));
    page.on('console', m => {if (m.type() === 'error') errors.push(`console: ${m.text()}`);});
    page.on('requestfailed', request => errors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
    page.on('response', r => {if (r.status() >= 400) errors.push(`http: ${r.status()} ${r.url()}`);});
    await page.goto(`${origin}/hmh-reboot/?evidenceSafe=1&telemetry=1&rosterPreview=1&rosterCombat=1`, {waitUntil: 'networkidle'});
    await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick) > 2 && document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster');
    await page.click('#hmhMenuToggle');
    await page.waitForSelector('#hmhPausePanel:not([hidden])');
    if (profile.reduced) {
      await page.locator('#hmhSettingReduceMotion').check();
      await page.locator('#hmhSettingReduceFlash').check();
    }
    // Arm inside the frame before resuming. Pause via the existing Escape path
    // on the actual draw signal, not a later cumulative kill counter.
    await page.evaluate(() => {
      const stage = document.querySelector('#hmhRebootStage');
      const startTick = Number(stage.dataset.simulationTick);
      globalThis.__hmhDefeatProof = null;
      const observe = () => {
        const tick = Number(stage.dataset.simulationTick);
        if (tick > startTick + 14 && Number(stage.dataset.killFxDrawn) > 0) {
          globalThis.__hmhDefeatProof = {...stage.dataset};
          window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
          return;
        }
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    });
    await page.click('#hmhResumeButton');
    const target = await page.locator('#hmhRebootStage').evaluate(node => {
      const enemies = JSON.parse(node.dataset.enemyScreenRects || '[]');
      return enemies.find(enemy => enemy.archetypeId === 'gas-bomber');
    });
    assert.ok(target, 'a real roster target must be visible');
    await page.mouse.move(target.x + target.w / 2, target.y + target.h * 0.7);
    await page.mouse.down();
    try {
      await page.waitForFunction(() => globalThis.__hmhDefeatProof !== null, null, {timeout: 45000});
    } catch (error) {
      const dataset = await page.locator('#hmhRebootStage').evaluate(node => ({...node.dataset}));
      await writeFile(new URL(`${profile.name}-failure.json`, output), JSON.stringify({dataset, errors}, null, 2));
      await page.screenshot({path: fileURLToPath(new URL(`${profile.name}-failure.png`, output))});
      throw error;
    }
    const state = await page.evaluate(() => globalThis.__hmhDefeatProof);
    assert.ok(Number(state.killFxDrawn) > 0);
    assert.equal(Number(state.killFxShards), Number(state.killFxDrawn) * profile.shards, profile.name);
    assert.equal(state.settingReduceMotion, String(profile.reduced));
    assert.equal(state.settingReduceFlash, String(profile.reduced));
    const layout = await page.evaluate(() => ({canvases: document.querySelectorAll('#hmhRebootStage canvas').length, overflow: document.documentElement.scrollWidth > innerWidth}));
    assert.deepEqual(layout, {canvases: 1, overflow: false});
    await page.screenshot({path: fileURLToPath(new URL(`${profile.name}-settings.png`, output))});
    // The real pause path freezes the render; hide only its DOM overlay for
    // the effect capture, keeping a separate unmodified settings screenshot.
    await page.evaluate(() => {
      for (const node of document.querySelectorAll('.hmh-modal-layer')) node.style.display = 'none';
    });
    await page.locator('#hmhRebootStage canvas').screenshot({path: fileURLToPath(new URL(`${profile.name}.png`, output))});
    assert.deepEqual(errors, [], `${profile.name} browser errors`);
    report.profiles.push({name: profile.name, tick: Number(state.simulationTick), drawn: Number(state.killFxDrawn), shards: Number(state.killFxShards), reducedMotion: state.settingReduceMotion, reducedFlash: state.settingReduceFlash, enemyArt: state.enemyArt, layout, errors});
    await page.close();
  }
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {await browser.close();}
