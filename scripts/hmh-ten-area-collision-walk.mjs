// Real-child wall walk for the ten-area collision-art lane (2.1): in the built
// child (run `node build.mjs` first) the hero walks into the 30 largest
// building colliders from all four sides and must stop at the wall, where the
// same swept-circle collision predicts contact; then six fixed spots are
// photographed at desktop size. Runs under the shared heavy lock. Receipts go
// to docs/2.0/receipts/collision-art-20261001/walk/.
//   PLAYWRIGHT_PACKAGE_PATH=.../playwright/index.mjs node scripts/hmh-ten-area-collision-walk.mjs [--only=N]
import { createRequire } from 'node:module';
import { mkdir, writeFile, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorldV2GroundQuery, createWorldV2RuntimeWorld, isWorldV2PointClear, WORLD_V2_PLAYER_RADIUS } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { cardCollisionClass } from '../apps/hmh-reboot/src/world-v2-area-plans/card-footprints.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const OUT = path.join(REPO, 'docs', '2.0', 'receipts', 'collision-art-20261001', 'walk');
const LOCK = path.resolve(REPO, '..', '.locks', 'heavy.lock');
const token = `claude-collision-${process.pid}-${new Date().toISOString()}`;
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH || 'C:/Users/just_/lesters-arcade/benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const only = Number(process.argv.find(arg => arg.startsWith('--only='))?.slice(7) ?? 30);

async function acquireLock() {
  for (;;) {
    try { const handle = await open(LOCK, 'wx'); await handle.writeFile(token); await handle.close(); return; }
    catch (error) { if (error.code !== 'EEXIST') throw error; await new Promise(resolve => setTimeout(resolve, 5_000)); }
  }
}
async function releaseLock() { try { if ((await readFile(LOCK, 'utf8')) === token) await unlink(LOCK); } catch { /* not ours or gone */ } }

const world = createWorldV2RuntimeWorld();
const queryGround = createWorldV2GroundQuery(world);
const body = createCollisionBody({ id: 'collision-walk', kind: 'player', radius: WORLD_V2_PLAYER_RADIUS, minZ: 0, maxZ: 56 });
const R = WORLD_V2_PLAYER_RADIUS, STANDOFF = R + 66, PUSH = 300;
const sweep = (from, dir) => resolveSweptCircleMotion({ body, start: { ...from, z: queryGround(from.x, from.y).groundZ }, delta: { x: dir.x * PUSH, y: dir.y * PUSH }, blockers: world.collisionBlockers, bounds: world.bounds });

// Buildings: authored masses inside an area (not cliffs, banks or closed
// land) and prop colliders under building or container cards; largest first.
const pieces = world.artPlans.authored.pieces;
const buildingIds = new Set(pieces.filter(piece => piece.blocker && (piece.kind === 'mass' && piece.visible.areaId || piece.kind === 'prop-solid' && ['building', 'container'].includes(cardCollisionClass(piece.visible.artProp.source)))).map(piece => piece.blocker.id));
const area = b => (b.bounds.maxX - b.bounds.minX) * (b.bounds.maxY - b.bounds.minY);
const buildings = world.blockers.filter(blocker => buildingIds.has(blocker.id)).sort((a, b) => area(b) - area(a) || (a.id < b.id ? -1 : 1)).slice(0, only);

// Four approaches per building: a clear stand-off point outside the side,
// walking inward; the swept body predicts where the wall stops it.
const SIDES = [['south', { x: 0, y: -1 }], ['north', { x: 0, y: 1 }], ['east', { x: -1, y: 0 }], ['west', { x: 1, y: 0 }]];
function approaches(blocker) {
  const b = blocker.bounds;
  return SIDES.map(([side, dir]) => {
    for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const along = dir.x === 0 ? { x: b.minX + (b.maxX - b.minX) * t } : { y: b.minY + (b.maxY - b.minY) * t };
      const start = dir.x === 0 ? { x: along.x, y: side === 'south' ? b.maxY + STANDOFF : b.minY - STANDOFF } : { x: side === 'east' ? b.maxX + STANDOFF : b.minX - STANDOFF, y: along.y };
      if (!isWorldV2PointClear(world, queryGround, start)) continue;
      const predicted = sweep(start, dir);
      const hit = predicted.contacts[0]?.blockerId ?? null;
      if (hit !== blocker.id) continue; // another collider (a car, a hedge) stands between: try further along
      return { side, start, dir, predicted: { x: predicted.position.x, y: predicted.position.y }, blockerId: hit };
    }
    return { side, start: null, reason: 'no clear stand-off point with the building first in line' };
  });
}

const SHOTS = [
  ['meadows-farmhouse-south', 'mweb-meadows-garden-home', 'south'],
  ['city-market-block-south', 'litecoin-city-market-block', 'south'],
  ['farms-watermill-south', 'halving-farms-windmill-base', 'south'],
  ['coast-lighthouse-south', 'silver-coast-lighthouse', 'south'],
  ['city-parked-pickup', world.blockers.find(blocker => blocker.id.startsWith('prop-litecoin-city-b2-54-'))?.id, 'south'],
  ['fortress-container-west', world.blockers.find(blocker => blocker.id.startsWith('prop-fork-fortress-b1-43-'))?.id, 'west'],
];

await mkdir(OUT, { recursive: true });
await acquireLock();
const { server, origin: base } = await startPortalStaticServer({ rootDir: path.join(REPO, 'apps', 'portal') });
const receipt = { token, base: 'portal static server (apps/portal, built child in dist)', radius: R, standoff: STANDOFF, buildings: [], shots: [], errors: [] };
let browser = null;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', error => receipt.errors.push(String(error.message)));
  const hero = async () => { const [x, y] = String(await page.evaluate(() => document.querySelector('#hmhRebootStage')?.dataset.tenAreaHero ?? '')).split(',').map(Number); return Number.isFinite(x) ? { x, y } : null; };
  const settle = async () => { if (await page.locator('#hmhUpgradePanel').isVisible().catch(() => false)) { await page.keyboard.press('Digit1'); await page.keyboard.press('Enter'); } };
  async function load(start) {
    await page.goto(`${base}/hmh-reboot/index.html?mode=free&world=ten-area&evidenceSafe=1&tenAreaEvidence=at:${start.x},${start.y}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.worldId === 'ten-area-frontier', null, { timeout: 60_000 });
    await page.waitForFunction(() => /Standalone session ready/.test(document.querySelector('#hmhRebootStatus')?.textContent ?? ''), null, { timeout: 120_000 });
    const enter = page.locator('#hmhStartupEnter');
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await enter.isVisible().catch(() => false) && await enter.isEnabled().catch(() => false) && await enter.click({ timeout: 2_000 }).then(() => true, () => false)) break;
      if (!(await page.locator('#hmhStartup').isVisible().catch(() => false))) break;
      await page.waitForTimeout(500);
    }
    await page.locator('canvas').first().click({ position: { x: 20, y: 20 } }).catch(() => {});
    for (let waited = 0; waited < 10_000; waited += 200) { const at = await hero(); if (at && Math.hypot(at.x - start.x, at.y - start.y) < 2) return at; await page.waitForTimeout(200); }
    return await hero();
  }
  const keyFor = dir => dir.x > 0 ? 'KeyD' : dir.x < 0 ? 'KeyA' : dir.y > 0 ? 'KeyS' : 'KeyW';
  async function push(approach) {
    const before = await load(approach.start);
    const key = keyFor(approach.dir);
    await page.keyboard.down(key);
    let last = null, still = 0;
    for (let waited = 0; waited < 2_400; waited += 100) {
      await settle(); await page.waitForTimeout(100);
      const at = await hero(); if (last && at && Math.hypot(at.x - last.x, at.y - last.y) < 1) still += 1; else still = 0; last = at;
      if (still >= 4) break;
    }
    await page.keyboard.up(key);
    const after = await hero();
    const error = after ? Math.hypot(after.x - approach.predicted.x, after.y - approach.predicted.y) : null;
    const moved = after && before ? Math.hypot(after.x - before.x, after.y - before.y) : null;
    // Stopped at the wall: within 8 units of the predicted contact (telemetry
    // rounds to whole units) after walking most of the 66-unit gap.
    return { side: approach.side, start: approach.start, predicted: { x: Math.round(approach.predicted.x), y: Math.round(approach.predicted.y) }, before, after, moved, error, stoppedAtWall: error !== null && error <= 8 && moved >= 40 };
  }
  for (const blocker of buildings) {
    const row = { id: blocker.id, areaId: blocker.districtId, bounds: blocker.bounds, sides: [] };
    for (const approach of approaches(blocker)) row.sides.push(approach.start ? await push(approach) : approach);
    receipt.buildings.push(row);
    console.log(row.id, row.sides.map(side => `${side.side}:${side.stoppedAtWall ?? side.reason}`).join(' '));
  }
  for (const [label, id, sideName] of SHOTS) {
    const blocker = world.blockers.find(entry => entry.id === id);
    const approach = blocker && approaches(blocker).find(entry => entry.side === sideName && entry.start);
    if (!approach) { receipt.shots.push({ label, id, error: 'no approach' }); continue; }
    const result = await push(approach);
    await page.waitForTimeout(600);
    const file = `${label}.jpg`;
    await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 88 });
    receipt.shots.push({ label, id, file, ...result });
  }
} finally {
  await browser?.close().catch(() => {});
  await new Promise(resolve => server.close(resolve));
  await releaseLock();
}
const sides = receipt.buildings.flatMap(row => row.sides);
receipt.summary = { buildings: receipt.buildings.length, sidesWalked: sides.filter(side => side.after).length, stoppedAtWall: sides.filter(side => side.stoppedAtWall).length, notStopped: sides.filter(side => side.after && !side.stoppedAtWall).map(side => side.side), noApproach: sides.filter(side => !side.start).length, pageErrors: receipt.errors.length };
await writeFile(path.join(OUT, 'walk-receipt.json'), `${JSON.stringify(receipt, null, 1)}\n`);
console.log(JSON.stringify(receipt.summary));
if (sides.some(side => side.after && !side.stoppedAtWall)) process.exitCode = 1;
