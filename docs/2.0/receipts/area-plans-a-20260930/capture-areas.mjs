// Private-scene captures for lane A areas. usage: node capture-areas.mjs <origin> <outDir> [scene,...]
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('C:/Users/just_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [origin, out, only] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const CENTERS = { 'halving-farms': [17500, 6700], 'litecoin-city': [7500, 6700], 'silver-coast': [2500, 6700], 'scrypt-bayou': [2500, 11600] };
const SCENES = [
  ['farms-center', 'halving-farms', []],
  ['farms-landmark', 'halving-farms', [[-300, 0], [-1250, 0], [-1250, -550], [-1250, -1000]]],
  ['city-center', 'litecoin-city', []],
  ['city-plaza', 'litecoin-city', [[900, 0], [1450, 0], [1450, 250], [1000, 800]]],
  ['city-skyline', 'litecoin-city', [[0, -900], [0, -1750], [500, -1750]]],
  ['coast-center', 'silver-coast', []],
  ['coast-landmark', 'silver-coast', [[250, 200], [-300, 200], [-300, -900], [-300, -1450]]],
  ['bayou-center', 'scrypt-bayou', []],
  ['bayou-landmark', 'scrypt-bayou', [[-650, 0], [-650, 650], [360, 650], [900, 650], [1200, 650], [1200, 1000], [1050, 1000], [1050, 1300]]],
].filter(([name]) => !only || only.split(',').includes(name));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { origin, captures: [], errors: [] };
try {
  for (const [name, areaId, waypoints] of SCENES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => report.errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(`${name} console: ${m.text()}`); });
    await page.goto(`${origin}/dist/hmh-world-v2-local/index.html?mode=free&world=world-v2-local`);
    const snap = () => page.evaluate(() => window.__HMH_WORLD_LOCAL__.snapshot().playtest);
    await page.waitForFunction(() => !document.querySelector('[data-inspect]')?.disabled, null, { timeout: 120000 });
    await page.selectOption('[data-area-select]', areaId);
    await page.click('[data-inspect]');
    await page.waitForFunction(() => !document.querySelector('[data-start]')?.disabled, null, { timeout: 120000 });
    await page.click('[data-start]');
    await page.waitForTimeout(800);
    const [cx, cy] = CENTERS[areaId];
    for (const [rx, ry] of waypoints) {
      const tx = cx + rx, ty = cy + ry; let last = null, stuck = 0;
      for (let i = 0; i < 400; i++) {
        const a = (await snap()).runtime.actor, dx = tx - a.x, dy = ty - a.y;
        if (Math.hypot(dx, dy) < 40) break;
        if (last && Math.hypot(a.x - last.x, a.y - last.y) < 2) { if (++stuck > 15) break; } else stuck = 0;
        last = { x: a.x, y: a.y };
        const keys = [];
        if (Math.abs(dx) > 20) keys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        if (Math.abs(dy) > 20) keys.push(dy > 0 ? 'ArrowDown' : 'ArrowUp');
        for (const k of keys) await page.keyboard.down(k);
        await page.waitForTimeout(120);
        for (const k of keys) await page.keyboard.up(k);
      }
    }
    await page.waitForTimeout(1500);
    const s = await snap();
    const file = `desktop-${name}.png`;
    const session = await page.context().newCDPSession(page);
    const { data } = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(out, file), Buffer.from(data, 'base64'));
    report.captures.push({ scene: name, file, areaId, position: { x: Math.round(s.runtime.actor.x), y: Math.round(s.runtime.actor.y) }, areaArt: s.areaArt.filter(a => a.areaId === areaId || a.areaId === 'world-roads') });
    await page.click('[data-close]').catch(() => {});
    await page.close();
    console.log('captured', name, Math.round(s.runtime.actor.x), Math.round(s.runtime.actor.y));
  }
} finally {
  await browser.close();
  await writeFile(path.join(out, only ? `browser-report-${only.split(',')[0]}.json` : 'browser-report.json'), JSON.stringify(report, null, 1));
  console.log('errors', report.errors.length, report.errors.slice(0, 5).join(' | '));
}
