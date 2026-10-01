// Browser evidence for the 2.0 Blender cabinet turntables on /games.
// Run under the shared heavy lock after `node build.mjs`:
//   node scripts/arcade-cabinets-browser-evidence.mjs [outDir]
// Env: PLAYWRIGHT_MODULE (playwright index.mjs), CHROME_PATH.
// Captures desktop 1440x900 and phone 414x896@3, checks every turntable frame
// decoded from one atlas, the pause control, and that reduced motion leaves
// exactly the rest (poster) frame visible.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(root, 'docs/2.0/receipts/arcade-cabinets-20260930'));
const playwrightModule = process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/just_/lesters-arcade/benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
const executablePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { chromium } = await import(pathToFileURL(playwrightModule).href);
mkdirSync(out, { recursive: true });

const { server, origin } = await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
const browser = await chromium.launch({ executablePath, headless: true });
const report = { origin: 'local static apps/portal', capturedAt: new Date().toISOString(), runs: [] };
const views = [
  { name: 'games-desktop-1440x900', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: 'games-phone-414x896@3', viewport: { width: 414, height: 896 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'games-desktop-reduced-motion', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' },
];
try {
  for (const view of views) {
    const context = await browser.newContext({ viewport: view.viewport, deviceScaleFactor: view.deviceScaleFactor, isMobile: view.isMobile, hasTouch: view.hasTouch, reducedMotion: view.reducedMotion ?? 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(origin + '/games', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('.arcade-cabinet-3d-rotator canvas').length === 48
      && [...document.querySelectorAll('.arcade-cabinet-3d-rotator canvas')].every((canvas) => canvas.dataset.ready === 'true'), null, { timeout: 30_000 });
    const state = await page.evaluate(() => [...document.querySelectorAll('.official-cabinet-card.playable')].map((card) => {
      const frames = [...card.querySelectorAll('.cabinet-rotation-frame')];
      const visible = frames.map((frame, index) => [index, Number(getComputedStyle(frame).opacity)]).filter(([, opacity]) => opacity > 0.5).map(([index]) => index);
      const rest = frames.findIndex((frame) => frame.dataset.restFrame === 'true');
      const rect = card.querySelector('.cabinet-card-media').getBoundingClientRect();
      return { slug: card.dataset.gameSlug, frames: frames.length, rest, visible, media: [Math.round(rect.width), Math.round(rect.height)] };
    }));
    const motion = await page.evaluate(() => document.querySelector('#officialCabinetGrid').dataset.cabinetMotion);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const grid = page.locator('#officialCabinetGrid');
    await grid.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, view.name + '.png') });
    await grid.screenshot({ path: path.join(out, view.name + '-grid.png') });
    let paused = null;
    if (!view.reducedMotion) {
      await page.locator('#cabinetMotionToggle').click();
      paused = await page.evaluate(() => ({ motion: document.querySelector('#officialCabinetGrid').dataset.cabinetMotion,
        playState: getComputedStyle(document.querySelector('.arcade-cabinet-3d-rotator .cabinet-rotation-frame')).animationPlayState }));
    }
    report.runs.push({ view: view.name, motion, paused, overflow, errors, cabinets: state });
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
writeFileSync(path.join(out, 'browser-evidence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
