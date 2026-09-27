// Layout v2 dark pilot browser smoke: boots the HMH child with
// ?evidenceSafe=1&layoutV2=1 at a few greybox crossings, on desktop and on a
// 390 x 844 phone, and saves screenshots for the readability review of roads,
// water and crossings. Serial by design (hold the shared heavy lock).
//
//   HMH_REBOOT_ORIGIN=http://127.0.0.1:8991 node scripts/hmh-layout-v2-pilot-browser-smoke.mjs [outDir]
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const playwrightPath = process.env.PLAYWRIGHT_PACKAGE_PATH;
const { chromium } = await import(playwrightPath ? pathToFileURL(playwrightPath).href : '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8991';
const outDir = process.argv[2] ?? join(tmpdir(), 'hmh-layout-v2-pilot');
await mkdir(outDir, { recursive: true });

const SPOTS = [
  ['spawn-meadow', 800, 2_400],
  ['settler-viaduct', 2_650, 2_360],
  ['rope-bridge', 2_650, 1_100],
  ['proof-of-work-bridge', 4_750, 2_400],
  ['old-mill-bridge', 4_750, 975],
  ['fork-trestle', 4_320, 3_250],
];
const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false },
  { name: 'phone-390x844', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true },
];

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const results = [];
try {
  for (const view of VIEWPORTS) {
    for (const [spot, x, y] of SPOTS) {
      const page = await browser.newPage({ viewport: view.viewport, deviceScaleFactor: view.deviceScaleFactor, isMobile: view.isMobile, hasTouch: view.isMobile });
      const errors = [];
      page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
      await page.goto(`${origin}/hmh-reboot/?evidenceSafe=1&layoutV2=1&layoutV2At=${x},${y}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const stage = document.querySelector('#hmhRebootStage');
        return stage?.dataset.layoutV2 === '1' && stage.dataset.navGridReady === 'true' && Number(stage.dataset.simulationTick) >= 90;
      }, null, { timeout: 60_000 });
      const state = await page.evaluate(() => {
        const stage = document.querySelector('#hmhRebootStage');
        return { tick: Number(stage.dataset.simulationTick), navGridBootMs: Number(stage.dataset.navGridBootMs) };
      });
      const file = join(outDir, `${view.name}-${spot}.png`);
      await page.screenshot({ path: file });
      assert.deepEqual(errors, [], `${view.name} ${spot}: ${errors.join('; ')}`);
      results.push({ view: view.name, spot, ...state, file });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ ok: true, outDir, results }, null, 2));
