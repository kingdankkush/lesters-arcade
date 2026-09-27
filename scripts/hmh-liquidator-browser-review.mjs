// Browser review of the Liquidator roster atlas in the live boss fight.
//
// Projection-only evidence: loads the built HMH child with the debug boss
// (`boss=1`, spawn 1380,2400, start tick 1) at desktop 1440x900 and phone
// 390x844, walks the hero to a per-profile stand-off point south-west of the boss (a
// point due south put the boss behind the top HUD at the boss-fight camera
// zoom, so the first run showed only his boots), and samples
// screenshots plus stage telemetry across all three phases (market-open,
// margin-call at tick 1,200, total-liquidation at tick 2,400). It asserts the
// roster atlas resolved with no load error and no page errors, and writes a
// JSON summary beside the screenshots. It never changes simulation state
// beyond the ordinary keyboard input a player would give.
//
// Usage (serve apps/portal first, run `npm run build`, hold the heavy lock):
//   HMH_REBOOT_ORIGIN=http://127.0.0.1:8911 node scripts/hmh-liquidator-browser-review.mjs --out <dir>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const playwrightPath = process.env.PLAYWRIGHT_PACKAGE_PATH
  ?? fileURLToPath(new URL('../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs', import.meta.url));
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8911';
const outArg = process.argv.indexOf('--out');
const outDir = resolve(outArg > 0 ? process.argv[outArg + 1] : fileURLToPath(new URL('../.hermes/evidence/liquidator-browser-review/', import.meta.url)));
const sampleEveryMs = Number(process.env.HMH_REVIEW_SAMPLE_MS ?? 2_500);
const reviewTicks = Number(process.env.HMH_REVIEW_TICKS ?? 3_000);
const candidateBundlePath = fileURLToPath(new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

function diagnostics(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`request: ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`); });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function readStage(page) {
  return page.locator('#hmhRebootStage').evaluate((stage) => ({
    tick: Number(stage.dataset.simulationTick),
    bossArt: stage.dataset.bossArt,
    bossActive: stage.dataset.bossActive,
    bossPhase: stage.dataset.bossPhase,
    bossHealth: Number(stage.dataset.bossHealth),
    bossVisualState: stage.dataset.bossVisualState,
    bossPendingAttackIds: stage.dataset.bossPendingAttackIds,
    bossSafeSector: stage.dataset.bossSafeSector,
    enemyRosterLoaded: stage.dataset.enemyRosterLoaded,
    enemyRosterError: stage.dataset.enemyRosterError,
    playerHealth: Number(stage.dataset.playerHealth),
    actorX: Number(stage.dataset.actorX),
    actorY: Number(stage.dataset.actorY),
    actorScreenX: Number(stage.dataset.actorScreenX),
    actorScreenY: Number(stage.dataset.actorScreenY),
    cameraZoom: Number(stage.dataset.cameraZoom),
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
}

// Hold the movement keys and re-steer every poll until the hero is inside the
// tolerance. Holding (rather than tapping) keeps the hero near its 240 px/s
// cap so a 45-tick tell leaves time to step out of the telegraph.
async function moveActorTo(page, x, y, { tolerance = 18, timeoutMs = 4_000 } = {}) {
  await page.locator('canvas').focus();
  const held = new Set();
  const deadline = Date.now() + timeoutMs;
  try {
    for (;;) {
      const actor = await readStage(page);
      const wanted = new Set();
      if (Math.abs(x - actor.actorX) > tolerance) wanted.add(actor.actorX < x ? 'd' : 'a');
      if (Math.abs(y - actor.actorY) > tolerance) wanted.add(actor.actorY < y ? 's' : 'w');
      for (const key of [...held]) if (!wanted.has(key)) { await page.keyboard.up(key); held.delete(key); }
      for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
      if (wanted.size === 0) return actor;
      if (Date.now() > deadline) throw new Error(`actor did not reach ${x},${y}`);
      await page.waitForTimeout(30);
    }
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
}

// Scripted evasion so the unarmed review hero (rosterPreview disables auto
// fire and auto dodge) survives into total-liquidation. It reads only the
// public telemetry the stage already exposes and answers with ordinary
// keyboard input. Geometry mirrors LIQUIDATOR_ATTACK_DEFINITIONS: the boss
// holds the debug spawn, lines and circles lock on the hero at tell start,
// the squeeze ring spans 88-178 px from the boss, and the two supers are
// safe-circle checks.
const BOSS_SPAWN = Object.freeze({ x: 1_380, y: 2_400 });
function evasionPoint(attackId, state, profile) {
  if (attackId === 'circuit-breaker') {
    return state.bossSafeSector === 'north-south' ? { x: BOSS_SPAWN.x, y: BOSS_SPAWN.y + 150 } : { x: BOSS_SPAWN.x - 150, y: BOSS_SPAWN.y };
  }
  if (attackId === 'total-liquidation-super') return { x: BOSS_SPAWN.x, y: BOSS_SPAWN.y + 170 };
  if (attackId === 'short-squeeze-burst' || attackId === 'debt-collection') return profile.clear;
  if (attackId === 'crash-lane' || attackId === 'liquidation-zone' || attackId === 'margin-call-dash') {
    const toStandoff = Math.hypot(state.actorX - profile.standoff.x, state.actorY - profile.standoff.y);
    return toStandoff > 90 ? profile.standoff : profile.sidestep;
  }
  return null;
}

async function review(profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = diagnostics(page);
  await page.route('**/dist/hmh-reboot/game.js', (route) => route.fulfill({ path: candidateBundlePath, contentType: 'text/javascript', headers: { 'Cache-Control': 'no-store' } }));
  await page.goto(`${origin}/hmh-reboot/index.html?telemetry=1&evidenceSafe=1&boss=1&rosterPreview=1&candidate=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.bossArt === 'production-roster-atlas-v1', null, { timeout: 30_000 });
  await page.mouse.move(profile.viewport.width * 0.5, profile.viewport.height * 0.3);
  await moveActorTo(page, profile.standoff.x, profile.standoff.y);
  const samples = [];
  const evasions = [];
  let index = 0;
  let seenAttacks = '';
  let nextSampleAt = 0;
  for (;;) {
    let state = await readStage(page);
    const pending = state.bossPendingAttackIds ?? '';
    if (pending !== seenAttacks) {
      const fresh = pending.split(',').filter((id) => id && !seenAttacks.split(',').includes(id));
      seenAttacks = pending;
      const target = fresh.length ? evasionPoint(fresh.at(-1), state, profile) : pending === '' ? profile.standoff : null;
      if (target) {
        evasions.push({ tick: state.tick, attackIds: fresh, target });
        try { state = await moveActorTo(page, target.x, target.y); } catch (error) { evasions.push({ tick: state.tick, error: String(error.message) }); }
      }
    }
    if (Date.now() >= nextSampleAt || state.playerHealth <= 0) {
      const file = `${profile.name}-${String(index).padStart(2, '0')}-t${state.tick}-${state.bossPhase || 'none'}-${state.bossVisualState}.png`;
      await page.screenshot({ path: join(outDir, file), fullPage: false });
      samples.push({ ...state, file });
      console.log(JSON.stringify({ profile: profile.name, index, tick: state.tick, phase: state.bossPhase, visual: state.bossVisualState, playerHealth: state.playerHealth, file }));
      index += 1;
      nextSampleAt = Date.now() + sampleEveryMs;
      // A dead hero freezes the simulation; further frames would repeat.
      if (state.playerHealth <= 0 || state.tick >= reviewTicks || index >= 48) break;
    }
    await page.waitForTimeout(40);
  }
  await context.close();
  return { profile: profile.name, viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, errors, evasions, samples };
}

const profiles = [
  // Stand-offs keep the whole boss sprite clear of the HUD and the viewport
  // edges at the measured camera zoom (desktop ~1.9, phone ~1.4) while staying
  // outside his 56 px body plus the 84 px player separation. `sidestep` is
  // 120+ px from the stand-off (clear of a 112 px circle or a lane locked on
  // the stand-off); `clear` is outside the 178 px squeeze ring.
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, mobile: false,
    standoff: { x: 1_220, y: 2_490 }, sidestep: { x: 1_340, y: 2_590 }, clear: { x: 1_190, y: 2_540 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, mobile: true,
    standoff: { x: 1_280, y: 2_500 }, sidestep: { x: 1_400, y: 2_580 }, clear: { x: 1_250, y: 2_560 } },
];

const results = [];
try {
  for (const profile of profiles) results.push(await review(profile));
} finally {
  await browser.close();
  await writeFile(join(outDir, 'review-summary.json'), `${JSON.stringify({ origin, reviewTicks, sampleEveryMs, results }, null, 2)}\n`);
}

for (const result of results) {
  assert.deepEqual(result.errors, [], `${result.profile}: page errors`);
  assert.ok(result.samples.every((sample) => sample.bossArt === 'production-roster-atlas-v1'), `${result.profile}: boss fell back to vector art`);
  assert.ok(result.samples.every((sample) => sample.enemyRosterError === ''), `${result.profile}: roster load error`);
  assert.ok(result.samples.every((sample) => sample.scrollWidth <= sample.viewportWidth + 1), `${result.profile}: horizontal overflow`);
  const phases = new Set(result.samples.map((sample) => sample.bossPhase));
  for (const phase of ['market-open', 'margin-call', 'total-liquidation']) assert.ok(phases.has(phase), `${result.profile}: never reached ${phase}`);
  console.log(JSON.stringify({ profile: result.profile, phases: [...phases], visualStates: [...new Set(result.samples.map((sample) => sample.bossVisualState))] }));
}
console.log(JSON.stringify({ status: 'PASS', outDir }));
