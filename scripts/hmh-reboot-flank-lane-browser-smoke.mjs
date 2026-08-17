// Wave 10 flank-lane browser evidence.
//
// The twelve visual scenes never capture a flanker mid-lane, and the endurance
// soak does not sample flank telemetry, so neither gate can evidence this
// behaviour in the live runtime. This probe reads the immutable
// `enemyFlankLaneSeeking` aggregate straight off the running stage across
// desktop and mobile, at real wall-clock, through the same evidence-safe
// endurance route the soak already uses. It asserts only that the integrated
// behaviour is observably non-vacuous and stays within the active enemy count.
// It adds no gameplay authority and changes no simulation.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const ROOT = process.cwd();
const PORTAL_ROOT = path.join(ROOT, 'apps', 'portal');
const REPORT_JSON = path.join(ROOT, 'docs', 'testing', 'hmh-reboot-flank-lane-browser.json');
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
  const url = `${origin}/hmh-reboot/?evidenceSafe=1&endurancePressurePilot=1&telemetry=1&seed=424242`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction((target) => {
    const stage = document.querySelector('#hmhRebootStage');
    return Number(stage?.dataset.enemyCount) === target && Number(stage.dataset.simulationTick) >= 8;
  }, TARGET_ENEMIES, { timeout: 120_000 });

  const samples = [];
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const sample = await page.evaluate(() => {
      const stage = document.querySelector('#hmhRebootStage');
      return {
        tick: Number(stage?.dataset.simulationTick ?? 0),
        enemies: Number(stage?.dataset.enemyCount ?? 0),
        flankLaneSeeking: Number(stage?.dataset.enemyFlankLaneSeeking ?? 0),
        chokepointHolding: Number(stage?.dataset.enemyChokepointHolding ?? 0),
      };
    });
    samples.push(sample);
    await sleep(250);
  }
  await page.close();
  await context.close();

  const peak = Math.max(...samples.map((sample) => sample.flankLaneSeeking));
  const maxEnemies = Math.max(...samples.map((sample) => sample.enemies));
  const ticksAdvanced = Math.max(...samples.map((s) => s.tick)) - Math.min(...samples.map((s) => s.tick));
  const failures = [];
  if (samples.length < Math.floor(seconds * 2)) failures.push(`only ${samples.length} samples`);
  if (ticksAdvanced <= 0) failures.push('simulation did not advance');
  if (maxEnemies !== TARGET_ENEMIES) failures.push(`peak bodies did not equal ${TARGET_ENEMIES}`);
  // Non-vacuous: the integrated lane must actually be observed live.
  if (peak <= 0) failures.push('flank lane was never exercised');
  // Truthful: the aggregate can never exceed the active population.
  if (peak > maxEnemies) failures.push('flank lane count exceeded active enemies');
  if (consoleErrors.length > 0) failures.push(`console errors: ${consoleErrors.join(' | ')}`);

  return {
    profile: profile.id,
    viewport: profile.viewport,
    seconds,
    status: failures.length ? 'FAIL' : 'PASS',
    sampleCount: samples.length,
    ticksAdvanced,
    maxEnemies,
    flankLaneSeekingPeak: peak,
    chokepointHoldingPeak: Math.max(...samples.map((sample) => sample.chokepointHolding)),
    failures,
  };
}

async function main() {
  const executablePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!executablePath) throw new Error('No Chrome/Edge binary found; set CHROME_BIN');
  const port = await freePort();
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
      benchmark: 'hmh-flank-lane-browser-v1',
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
