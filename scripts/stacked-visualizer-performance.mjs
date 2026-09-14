import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = process.env.STACKED_PERF_ROOT || fileURLToPath(new URL('..', import.meta.url));
const out = path.resolve(import.meta.dirname, '../outputs');
await mkdir(out, { recursive: true });
const { server, origin } = await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const reports = [];
try {
  for (const [name, width, height, mobile, slowdown, minimal] of [
    ['desktop',1440,1000,false,1,false], ['mobile-stress',390,844,true,4,false], ['mobile-minimal',390,844,true,4,true],
  ]) {
    if (process.env.STACKED_PERF_PROFILE && name !== 'mobile-stress') continue;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    await context.addInitScript(() => {
      const original = requestAnimationFrame;
      window.__stackedPerf = { durations: [], enabled: false };
      window.requestAnimationFrame = callback => original.call(window, time => {
        const before = performance.now(); callback(time);
        if (window.__stackedPerf.enabled) window.__stackedPerf.durations.push(performance.now() - before);
      });
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowdown });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('#officialGuestEnterButton').click();
    await page.locator('.official-cabinet-card').filter({ hasText: 'STACKED' }).click();
    await page.locator('#officialFreeModeButton').click();
    const frame = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await frame.waitForSelector('#stackedStage[data-assets-ready="true"]');
    if (minimal) await frame.locator('#effectsToggle').check();
    await frame.locator('#continueButton').click();
    await frame.waitForFunction(() => Number(document.querySelector('#stackedStage').dataset.simulationTick) > 120);
    if (process.env.STACKED_PERF_PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
    const result = await frame.evaluate(async () => {
      const state = window.__stackedPerf, stage = document.querySelector('#stackedStage');
      state.durations = []; state.enabled = true;
      const intervals = [], tasks = []; let previous = performance.now(), started = previous;
      const firstTick = Number(stage.dataset.simulationTick);
      const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type: 'longtask', buffered: false });
      await new Promise(resolve => { const collect = time => { intervals.push(time - previous); previous = time; if (time - started >= 12000) resolve(); else requestAnimationFrame(collect); }; requestAnimationFrame(collect); });
      state.enabled = false; observer.disconnect();
      const q = (values, n) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * n))] ?? 0;
      return { seconds: (previous-started)/1000, frames: intervals.length, fps: intervals.length*1000/(previous-started), frameP95: q(intervals,.95), frameP99: q(intervals,.99), callbackP95: q(state.durations,.95), callbackP99: q(state.durations,.99), longTasks: tasks.length, ticks: Number(stage.dataset.simulationTick)-firstTick, audio: stage.dataset.audioAvailable };
    });
    reports.push({ name, cpuSlowdown: slowdown, ...result });
    if (process.env.STACKED_PERF_PROFILE) {
      const { profile } = await cdp.send('Profiler.stop');
      await writeFile(path.join(out, 'visualizer-mobile.cpuprofile'), JSON.stringify(profile));
      const nodes = new Map(profile.nodes.map(node => [node.id, node.callFrame]));
      const totals = new Map();
      profile.samples.forEach((id, index) => { const frame = nodes.get(id); const key = `${frame.functionName} ${frame.url}`; totals.set(key, (totals.get(key) || 0) + (profile.timeDeltas[index] || 0)); });
      console.log(JSON.stringify([...totals.entries()].sort((a,b) => b[1]-a[1]).slice(0, 25)));
    }
    console.log(JSON.stringify(reports.at(-1)));
    await context.close();
  }
} finally {
  await writeFile(path.join(out, `visualizer-performance-${process.env.STACKED_PERF_LABEL || 'baseline'}.json`), JSON.stringify(reports, null, 2));
  await browser.close(); server.close();
}
