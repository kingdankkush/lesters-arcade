import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { sampleRetainedHeap, summarizeHeapSamples } from './lib/heap-sampler.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const bundle = await stat(new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url));
const BUNDLE_MAX_BYTES = 1_050_000;
// Steady-state frame window, measured after boot and after the pre-sample
// collections have settled.
const MEASUREMENT_WINDOW_MS = 5_000;
const HEAP_GROWTH_MAX_BYTES = 16 * 1024 * 1024;
assert.ok(bundle.size <= BUNDLE_MAX_BYTES, `HMH reboot bundle ${bundle.size} exceeds ${BUNDLE_MAX_BYTES}`);

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--enable-precise-memory-info',
    // Lets the heap sampler force a full collection before every read, so the
    // measured delta is retained heap rather than retained heap plus whatever
    // garbage was pending when the read happened to land.
    '--js-flags=--expose-gc',
  ],
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
  await page.waitForFunction(() => {
    const stage = document.querySelector('#hmhRebootStage');
    const loadedRoster = new Set(String(stage?.dataset.enemyRosterLoaded ?? '').split(',').filter(Boolean));
    return ['bagholder-rusher', 'forkrunner', 'the-liquidator'].every((actorId) => loadedRoster.has(actorId))
      && stage?.dataset.enemyArt === 'production-roster-atlas-v1'
      && stage.dataset.terrainTiles === 'authored-tiles-v1'
      && stage.dataset.authoredPropStatus === 'ready'
      && Number(stage.dataset.simulationTick) >= 720;
  }, null, { timeout: 30_000 });
  // The hazard scenario lazy-loads its first boss/roster steady-state workload
  // near tick 600. Waiting through tick 720 keeps one-time initialization out
  // of the leak window; the extra settle absorbs any post-load finalizers.
  await page.waitForTimeout(2_000);
  // Read boot's long tasks before the sampler runs. The buffer gets cleared
  // below, and dropping it outright would silently retire this gate's only
  // coverage of boot-time stalls -- the navgrid build is ~400 ms and blocks
  // first paint, so that signal has to survive the restructure.
  const bootLongTasks = await page.evaluate(() => [...globalThis.__hmhPerformance.longTasks]);
  const heapBeforeSamples = await sampleRetainedHeap(page);
  // Forcing collections stalls the main thread, and boot frames are not steady
  // state either. Discard everything recorded so far so the frame percentiles
  // below describe the measurement window alone.
  await page.evaluate(() => {
    globalThis.__hmhPerformance.frameTimes.length = 0;
    globalThis.__hmhPerformance.longTasks.length = 0;
  });
  await page.waitForTimeout(MEASUREMENT_WINDOW_MS);
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
    };
  });
  const heapAfterSamples = await sampleRetainedHeap(page);
  Object.assign(result, summarizeHeapSamples({ before: heapBeforeSamples, after: heapAfterSamples }));
  result.bootLongTasks = bootLongTasks;
  assert.equal(result.profile, expectedProfile);
  assert.ok(result.configuredResolution <= resolutionCap);
  assert.ok(result.actualResolutionX <= resolutionCap + 0.02);
  assert.ok(result.actualResolutionY <= resolutionCap + 0.02);
  assert.ok(result.activeEnemies > 0, `${name} enemy culling budget was not exercised`);
  assert.ok(result.animatedEnemies <= animatedCap);
  assert.ok(result.animatedEnemies < result.activeEnemies, `${name} offscreen enemy culling did not reduce projection work`);
  assert.ok(result.renderedParticles <= particleCap);
  assert.ok(result.renderedParticles > 0, `${name} particle budget was not exercised`);
  assert.ok(result.frames >= 170, `${name} rendered only ${result.frames} measured frames`);
  assert.ok(result.p95FrameMs <= 34, `${name} p95 ${result.p95FrameMs}ms`);
  assert.ok(result.p99FrameMs <= 70, `${name} p99 ${result.p99FrameMs}ms`);
  // Boot and steady-state stalls are counted together so this keeps exactly the
  // budget the gate had before the window was narrowed -- at most two tasks
  // over 100 ms across the whole session, wherever they land.
  const stalls = [...bootLongTasks, ...result.longTasks].filter((duration) => duration > 100);
  assert.ok(
    stalls.length <= 2,
    `${name} long tasks over 100ms: boot ${JSON.stringify(bootLongTasks)} window ${JSON.stringify(result.longTasks)}`,
  );
  // Cap measured, not guessed. Across 7 runs of the forced-GC sampler the
  // delta stayed inside -2.5 MB..+4.9 MB on both profiles; the residual spread
  // is the live set genuinely varying while the simulation runs. 16 MB leaves
  // ~3x margin over the worst observed run while sitting far below the old
  // 24 MB cap, which noise alone used to clear by 38 MB.
  assert.ok(
    result.heapDelta < HEAP_GROWTH_MAX_BYTES,
    `${name} retained heap grew ${result.heapDelta} bytes (before ${result.heapBefore}, after ${result.heapAfter}, samples ${JSON.stringify(result.afterSamples)})`,
  );
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
