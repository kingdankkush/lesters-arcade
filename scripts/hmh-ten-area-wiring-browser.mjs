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
// Within view of where the boss enters the court.
const nearBoss = (bossId) => { const court = gameplay.districtCourts[bossId]; return { x: court.spawn.x + (court.centre.x - court.spawn.x) * 0.45, y: court.spawn.y + (court.centre.y - court.spawn.y) * 0.45 }; };
const keyFor = (walk) => (Math.abs(walk.x) >= Math.abs(walk.y) ? (walk.x > 0 ? 'KeyD' : 'KeyA') : (walk.y > 0 ? 'KeyS' : 'KeyW'));

await mkdir(OUT, { recursive: true });
await acquireLock();
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'apps', 'portal'), stdio: 'ignore' });
const receipt = { token, scenarios: [] };
let browser = null;
try {
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const only = process.env.HMH_WIRING_ONLY ? new Set(process.env.HMH_WIRING_ONLY.split(',')) : null;
  async function scenario(name, query, { walk, holdMs, shots, until = null, goal = null, approach = null, approachMs = 0, viewport = { width: 1440, height: 900 } }) {
    if (only && !only.has(name)) return;
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
      if (await enter.isVisible().catch(() => false) && await enter.isEnabled().catch(() => false) && await enter.click({ timeout: 2_000 }).then(() => true, () => false)) break;
      if (!(await page.locator('#hmhStartup').isVisible().catch(() => false))) break;
      await page.waitForTimeout(500);
    }
    await page.locator('canvas').first().click({ position: { x: 20, y: 20 } }).catch(() => {});
    const taken = [];
    const trace = [];
    const key = walk ? keyFor(walk) : null;
    // A level-up pauses the run; take the first card so the scene keeps going.
    const settle = async () => { if (await page.locator('#hmhUpgradePanel').isVisible().catch(() => false)) { await page.keyboard.press('Digit1'); await page.keyboard.press('Enter'); } };
    const stage = () => page.evaluate(() => ({ ...document.querySelector('#hmhRebootStage').dataset, bossBar: !document.querySelector('#hmhBossBar')?.hidden }));
    if (key) {
      // Walk until the goal holds (the boss bar, or the hero in cover), at most
      // holdMs; with a `goal` point, steer toward it from the hero's telemetry.
      const held = new Set();
      const hold = async (keys) => {
        for (const k of held) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
        for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
      };
      for (let waited = 0; waited < holdMs; waited += 100) {
        await settle();
        const now = await stage();
        if (until?.(now)) break;
        const [hx, hy] = String(now.tenAreaHero ?? '').split(',').map(Number);
        if (goal && Number.isFinite(hx)) {
          const dx = goal.x - hx, dy = goal.y - hy;
          await hold([...(Math.abs(dx) > 20 ? [dx > 0 ? 'KeyD' : 'KeyA'] : []), ...(Math.abs(dy) > 20 ? [dy > 0 ? 'KeyS' : 'KeyW'] : [])]);
        } else await hold([key]);
        await page.waitForTimeout(100);
      }
      // Then close on a second point (the court centre, where the boss works).
      for (let waited = 0; approach && waited < approachMs; waited += 100) {
        await settle();
        const [hx, hy] = String((await stage()).tenAreaHero ?? '').split(',').map(Number);
        if (!Number.isFinite(hx)) break;
        const dx = approach.x - hx, dy = approach.y - hy;
        trace.push(`${waited}:${hx},${hy}`);
        if (Math.hypot(dx, dy) < 40) break;
        await hold([...(Math.abs(dx) > 20 ? [dx > 0 ? 'KeyD' : 'KeyA'] : []), ...(Math.abs(dy) > 20 ? [dy > 0 ? 'KeyS' : 'KeyW'] : [])]);
        await page.waitForTimeout(100);
      }
      await hold([]);
    }
    for (const [label, waitMs] of shots) {
      for (let waited = 0; waited < waitMs; waited += 250) { await settle(); await page.waitForTimeout(250); }
      const file = `${name}-${label}.jpg`;
      await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 85 });
      const state = await page.evaluate(() => ({ ...document.querySelector('#hmhRebootStage').dataset, bossBar: !document.querySelector('#hmhBossBar')?.hidden, bossName: document.querySelector('#hmhBossBar strong')?.textContent ?? null }));
      taken.push({ file, bossBar: state.bossBar, bossName: state.bossBar ? state.bossName : null, worldId: state.worldId, actor3d: state.actor3dStatus ?? null, actor3dCount: state.actor3dCount ?? null,
        cover: state.tenAreaCover ?? null, hero: state.tenAreaHero ?? null, traversal: state.tenAreaTraversal ?? null, prompts: state.tenAreaPrompts ?? null });
    }
    receipt.scenarios.push({ name, query, key, holdMs, shots: taken, approachTrace: trace.filter((row, index) => index % 10 === 0), errors: errors.slice(0, 10) });
    await context.close();
  }
  const baron = combat.evidenceSpawn('court:rug-pull-baron', world.player.spawn);
  await scenario('court-rug-pull-baron-3d', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=court:rug-pull-baron&actor3dPilot=1', {
    walk: baron.walk, goal: gameplay.districtCourts['rug-pull-baron'].threshold, approach: nearBoss('rug-pull-baron'), approachMs: 8_000, holdMs: 15_000, until: (state) => state.bossBar, shots: [['fight', 1_000], ['fight-later', 5_000]],
  });
  await scenario('court-rug-pull-baron-sprite', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=court:rug-pull-baron', {
    walk: baron.walk, goal: gameplay.districtCourts['rug-pull-baron'].threshold, approach: nearBoss('rug-pull-baron'), approachMs: 8_000, holdMs: 15_000,
    until: (state) => state.bossBar, shots: [['fight', 1_000]],
  });
  const foreman = combat.evidenceSpawn('court:fifty-one-percent-foreman', world.player.spawn);
  await scenario('court-51-foreman-sprite', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=court:fifty-one-percent-foreman', {
    walk: foreman.walk, goal: gameplay.districtCourts['fifty-one-percent-foreman'].threshold, holdMs: 15_000, until: (state) => state.bossBar, shots: [['fight', 6_000]],
  });
  const cover = combat.evidenceSpawn('cover', world.player.spawn);
  await scenario('cover-tall', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=cover&actor3dPilot=1', {
    walk: null, holdMs: 0, shots: [['prompt-ring', 0]],
  });
  await scenario('cover-tall-entered', 'mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=cover&actor3dPilot=1', {
    walk: cover.walk, holdMs: 6_000, until: (state) => /^cover-/.test(state.tenAreaCover ?? ''), shots: [['in-cover', 500]],
  });
} finally {
  await browser?.close().catch(() => {});
  server.kill();
  await releaseLock();
}
await writeFile(path.join(OUT, 'browser-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt.scenarios.map((row) => ({ name: row.name, shots: row.shots, errors: row.errors.length })), null, 1));
