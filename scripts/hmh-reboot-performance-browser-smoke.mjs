import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const bundle = await stat(new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url));
const BUNDLE_MAX_BYTES = 1_050_000;
assert.ok(bundle.size <= BUNDLE_MAX_BYTES, `HMH reboot bundle ${bundle.size} exceeds ${BUNDLE_MAX_BYTES}`);

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info'],
});

async function measure({ name, viewport, deviceScaleFactor, isMobile, expectedProfile, resolutionCap, animatedCap, particleCap }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor, isMobile, hasTouch: isMobile });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.addInitScript(() => {
    globalThis.__hmhPerformance = { frameTimes: [], longTasks: [] };
    let previous = performance.now();
    const frame = (now) => {
      globalThis.__hmhPerformance.frameTimes.push(now - previous);
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) globalThis.__hmhPerformance.longTasks.push(entry.duration);
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
  });
  await page.goto(`${origin}/hmh-reboot/?debugGrid=1&director=1&boss=1&evidenceSafe=1&worldTour=hazard`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster');
  await page.waitForTimeout(750);
  const heapBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  await page.waitForTimeout(4_000);
  const result = await page.evaluate(() => {
    const stage = document.querySelector('#hmhRebootStage');
    const canvas = stage.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const values = globalThis.__hmhPerformance.frameTimes.slice(15).sort((a, b) => a - b);
    const percentile = (ratio) => values[Math.min(values.length - 1, Math.floor(values.length * ratio))] ?? Infinity;
    return {
      profile: stage.dataset.performanceProfile,
      configuredResolution: Number(stage.dataset.renderResolution),
      actualResolutionX: canvas.width / rect.width,
      actualResolutionY: canvas.height / rect.height,
      animatedEnemies: Number(stage.dataset.animatedEnemies),
      activeEnemies: Number(stage.dataset.enemyCount),
      configuredParticles: Number(stage.dataset.worldParticles),
      renderedParticles: Number(stage.dataset.worldRenderedParticles),
      frames: values.length,
      averageFrameMs: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length),
      p95FrameMs: percentile(0.95),
      p99FrameMs: percentile(0.99),
      maxFrameMs: values.at(-1) ?? Infinity,
      longTasks: globalThis.__hmhPerformance.longTasks,
      heapAfter: performance.memory?.usedJSHeapSize ?? 0,
    };
  });
  result.heapBefore = heapBefore;
  result.heapDelta = result.heapAfter - heapBefore;
  assert.equal(result.profile, expectedProfile);
  assert.ok(result.configuredResolution <= resolutionCap);
  assert.ok(result.actualResolutionX <= resolutionCap + 0.02);
  assert.ok(result.actualResolutionY <= resolutionCap + 0.02);
  assert.ok(result.activeEnemies > 0, `${name} enemy culling budget was not exercised`);
  assert.ok(result.animatedEnemies <= animatedCap);
  assert.ok(result.animatedEnemies < result.activeEnemies, `${name} offscreen enemy culling did not reduce projection work`);
  assert.ok(result.renderedParticles <= particleCap);
  assert.ok(result.renderedParticles > 0, `${name} particle budget was not exercised`);
  assert.ok(result.frames >= 180, `${name} rendered only ${result.frames} measured frames`);
  assert.ok(result.p95FrameMs <= 34, `${name} p95 ${result.p95FrameMs}ms`);
  assert.ok(result.p99FrameMs <= 70, `${name} p99 ${result.p99FrameMs}ms`);
  assert.ok(result.longTasks.filter((duration) => duration > 100).length <= 2, `${name} long tasks ${result.longTasks}`);
  assert.ok(result.heapDelta < 24 * 1024 * 1024, `${name} heap grew ${result.heapDelta} bytes`);
  assert.deepEqual(errors, []);
  await page.close();
  return { name, ...result, errors };
}

try {
  const desktop = await measure({
    name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    isMobile: false, expectedProfile: 'desktop', resolutionCap: 2, animatedCap: 96, particleCap: 50,
  });
  const mobile = await measure({
    name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    isMobile: true, expectedProfile: 'mobile', resolutionCap: 1.25, animatedCap: 64, particleCap: 30,
  });
  console.log(JSON.stringify({ bundleBytes: bundle.size, bundleMaxBytes: BUNDLE_MAX_BYTES, desktop, mobile }, null, 2));
} finally {
  await browser.close();
}
