// Headless Chrome check of slice HMH-TEN-AREA-GAMEPLAY-WIRING in the built
// child (apps/portal/dist, so run `node build.mjs` first): the unofficial
// ten-area Free world, walking into a district court (the boss spawns, with
// the 3D pilot on) and into a tall cover face. Runs under the shared heavy
// lock. Screenshots and a JSON receipt go to
// docs/2.0/receipts/gameplay-wiring-20260930/.
//   PLAYWRIGHT_PACKAGE_PATH=.../playwright/index.mjs node scripts/hmh-ten-area-wiring-browser.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorldV2GroundQuery, createWorldV2RuntimeWorld } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { createWorldV2Gameplay } from '../apps/hmh-reboot/src/world-v2-gameplay.mjs';
import { createWorldV2Combat } from '../apps/hmh-reboot/src/world-v2-combat.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const OUT = path.join(REPO, 'docs', '2.0', 'receipts', 'gameplay-wiring-20260930');
const LOCK = path.resolve(REPO, '..', '.locks', 'heavy.lock');
const PORT = Number(process.env.HMH_WIRING_PORT ?? 8797);
const token = `claude-gameplay-${process.pid}-${new Date().toISOString()}`;
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');

async function acquireLock() {
  for (;;) {
    try {
      const handle = await open(LOCK, 'wx');
      await handle.writeFile(token);
      await handle.close();
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}
async function releaseLock() {
  try { if ((await readFile(LOCK, 'utf8')) === token) await unlink(LOCK); } catch { /* not ours or gone */ }
}

const world = createWorldV2RuntimeWorld();
const gameplay = createWorldV2Gameplay(world);
const combat = createWorldV2Combat({ world, gameplay, queryGround: createWorldV2GroundQuery(world) });
const keyFor = (walk) => (Math.abs(walk.x) >= Math.abs(walk.y) ? (walk.x > 0 ? 'KeyD' : 'KeyA') : (walk.y > 0 ? 'KeyS' : 'KeyW'));

await mkdir(OUT, { recursive: true });
await acquireLock();
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'apps', 'portal'), stdio: 'ignore' });
const receipt = { token, scenarios: [] };
let browser = null;
try {
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  async function scenario(name, query, { walk, holdMs, shots, viewport = { width: 1440, height: 900 } }) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.message)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${PORT}/hmh-reboot/index.html?${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.worldId === 'ten-area-frontier', null, { timeout: 60_000 });
    await page.waitForFunction(() => /Standalone session ready/.test(document.querySelector('#hmhRebootStatus')?.textContent ?? ''), null, { timeout: 120_000 });
    const enter = page.locator('#hmhStartupEnter');
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await enter.isVisible().catch(() => false) && await enter.isEnabled().catch(() => false)) { await enter.click(); break; }
      if (!(await page.locator('#hmhStartup').isVisible().catch(() => false))) break;
      await page.waitForTimeout(500);
    }
    await page.locator('canvas').first().click({ position: { x: 20, y: 20 } }).catch(() => {});
    const taken = [];
    const key = walk ? keyFor(walk) : null;
    if (key) { await page.keyboard.down(key); await page.waitForTimeout(holdMs); await page.keyboard.up(key); }
    for (const [label, waitMs] of shots) {
      await page.waitForTimeout(waitMs);
      const file = `${name}-${label}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      const state = await page.evaluate(() => ({ ...document.querySelector('#hmhRebootStage').dataset, bossBar: !document.querySelector('#hmhBossBar')?.hidden, bossName: document.querySelector('#hmhBossBar strong')?.textContent ?? null, status: document.querySelector('#hmhRebootStatus')?.textContent ?? '' }));
      taken.push({ file, bossBar: state.bossBar, bossName: state.bossName, worldId: state.worldId, actor3d: state.actor3dStatus ?? null });
    }
    receipt.scenarios.push({ name, query, key, holdMs, shots: taken, errors: errors.slice(0, 10) });
    await context.close();
  }
  const baron = combat.evidenceSpawn('court:rug-pull-baron', world.player.spawn);
  await scenario('court-rug-pull-baron-3d', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=court:rug-pull-baron&actor3dPilot=1', {
    walk: baron.walk, holdMs: 1_200, shots: [['intro', 2_500], ['fight', 5_000], ['fight-later', 6_000]],
  });
  const foreman = combat.evidenceSpawn('court:fifty-one-percent-foreman', world.player.spawn);
  await scenario('court-51-foreman-sprite', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=court:fifty-one-percent-foreman', {
    walk: foreman.walk, holdMs: 1_200, shots: [['fight', 7_000]],
  });
  const cover = combat.evidenceSpawn('cover', world.player.spawn);
  await scenario('cover-tall', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=cover&actor3dPilot=1', {
    walk: null, holdMs: 0, shots: [['prompt-ring', 1_500]],
  });
  await scenario('cover-tall-entered', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=cover&actor3dPilot=1', {
    walk: cover.walk, holdMs: 1_500, shots: [['in-cover', 300]],
  });
} finally {
  await browser?.close().catch(() => {});
  server.kill();
  await releaseLock();
}
await writeFile(path.join(OUT, 'browser-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt.scenarios.map((row) => ({ name: row.name, shots: row.shots, errors: row.errors.length })), null, 1));
