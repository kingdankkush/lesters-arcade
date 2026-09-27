// S1.2 enemy AI kit browser evidence (design package 5.2 and 6; survey E2,
// E3 and B4). Runs the live child through the evidence-safe endurance route
// (128 bodies round an invulnerable, auto-firing hero) on desktop and mobile,
// reads the kit's telemetry off the stage (hit-stop ticks, poise interrupts,
// recycles, perfect dodges, tells) and captures a frame with live telegraphs
// drawn from their locked geometry. It adds no gameplay authority.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_PACKAGE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href : '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');

const ROOT = process.cwd();
const PORTAL_ROOT = path.join(ROOT, 'apps', 'portal');
const REPORT_JSON = path.join(ROOT, 'docs', 'testing', 'hmh-enemy-kit-browser.json');
const SHOT_DIR = process.env.HMH_KIT_SHOT_DIR ?? null;
const secondsArg = process.argv.find((arg) => arg.startsWith('--seconds='));
const seconds = Number(secondsArg?.split('=')[1] ?? 20);
if (!Number.isFinite(seconds) || seconds < 5 || seconds > 120) throw new Error('--seconds must be from 5 to 120');

const TARGET_ENEMIES = 128;
const PROFILES = Object.freeze([
  Object.freeze({ id: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }),
  Object.freeze({ id: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1.25 }),
]);
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const status = await new Promise((resolve, reject) => {
        const request = http.get(url, { headers: { Connection: 'close' } }, (response) => {
          response.resume();
          response.once('end', () => resolve(response.statusCode ?? 0));
        });
        request.once('error', reject);
        request.setTimeout(3_000, () => request.destroy(new Error(`Timed out requesting ${url}`)));
      });
      if (status >= 200 && status < 400) return;
    } catch {}
    await sleep(150);
  }
  throw new Error(`Static server never became ready at ${url}`);
}

async function sampleProfile(browser, origin, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    deviceScaleFactor: profile.deviceScaleFactor,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const url = `${origin}/hmh-reboot/?evidenceSafe=1&endurancePressurePilot=1&telemetry=1&seed=424242`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction((target) => {
    const stage = document.querySelector('#hmhRebootStage');
    return Number(stage?.dataset.enemyCount) === target && Number(stage.dataset.simulationTick) >= 8;
  }, TARGET_ENEMIES, { timeout: 120_000 });

  const read = () => page.evaluate(() => {
    const stage = document.querySelector('#hmhRebootStage');
    const n = (key) => Number(stage?.dataset[key] ?? NaN);
    return {
      tick: n('simulationTick'),
      enemies: n('enemyCount'),
      tells: n('enemyTells'),
      hitStopTicks: n('enemyHitStopTicks'),
      interrupted: n('enemyInterrupted'),
      recycled: n('enemyRecycled'),
      perfectDodges: n('perfectDodges'),
    };
  });
  const samples = [];
  let shot = null;
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const sample = await read();
    samples.push(sample);
    if (!shot && sample.tells > 0 && SHOT_DIR) {
      shot = path.join(SHOT_DIR, `hmh-enemy-kit-${profile.id}.png`);
      await page.screenshot({ path: shot });
    }
    await sleep(250);
  }
  await page.close();
  await context.close();

  const last = samples.at(-1);
  const ticksAdvanced = last.tick - samples[0].tick;
  const failures = [];
  if (samples.length < Math.floor(seconds * 2)) failures.push(`only ${samples.length} samples`);
  if (!(ticksAdvanced > 0)) failures.push('simulation did not advance');
  for (const key of ['hitStopTicks', 'interrupted', 'recycled', 'perfectDodges']) {
    if (!Number.isFinite(last[key])) failures.push(`telemetry ${key} is missing`);
  }
  // Non-vacuous: the crowd dies, so kills and crits must have frozen it.
  if (!(last.hitStopTicks > 0)) failures.push('hit-stop never froze the crowd');
  // Bounded: the cooldown keeps the freeze a fraction of the run.
  if (last.hitStopTicks > Math.max(1, last.tick) * 0.3) failures.push(`hit-stop froze ${last.hitStopTicks} of ${last.tick} ticks`);
  if (Math.max(...samples.map((sample) => sample.tells)) <= 0) failures.push('no tell was ever observed');
  // The pilot inserts no director spawns; the leash may retire only the odd
  // body the pilot placed where the flow field cannot reach the hero.
  if (!(last.recycled <= 8)) failures.push(`recycled ${last.recycled} crowd bodies`);
  if (consoleErrors.length > 0) failures.push(`console errors: ${consoleErrors.join(' | ')}`);

  return {
    profile: profile.id,
    viewport: profile.viewport,
    seconds,
    status: failures.length ? 'FAIL' : 'PASS',
    sampleCount: samples.length,
    ticksAdvanced,
    finalTick: last.tick,
    peakTells: Math.max(...samples.map((sample) => sample.tells)),
    hitStopTicks: last.hitStopTicks,
    interrupted: last.interrupted,
    recycled: last.recycled,
    perfectDodges: last.perfectDodges,
    screenshot: shot ? path.basename(shot) : null,
    failures,
  };
}

async function main() {
  const executablePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!executablePath) throw new Error('No Chrome/Edge binary found; set CHROME_BIN');
  const port = Number(process.env.HMH_KIT_PORT ?? 0) || await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.platform === 'win32' ? 'python' : 'python3',
    ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
    { cwd: PORTAL_ROOT, stdio: 'ignore' });
  let browser = null;
  try {
    await waitForHttp(`${origin}/hmh-reboot/index.html`);
    browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
    const profiles = [];
    // Serial only: concurrent browser batches collide and produce fake failures.
    for (const profile of PROFILES) profiles.push(await sampleProfile(browser, origin, profile));
    const report = {
      schemaVersion: 1,
      benchmark: 'hmh-enemy-kit-browser-v1',
      status: profiles.every((profile) => profile.status === 'PASS') ? 'PASS' : 'FAIL',
      targetEnemies: TARGET_ENEMIES,
      profiles,
    };
    await mkdir(path.dirname(REPORT_JSON), { recursive: true });
    await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report));
    if (report.status !== 'PASS') process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
