import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const ROOT = process.cwd();
const PORTAL_ROOT = path.join(ROOT, 'apps', 'portal');
const REPORT_JSON = path.join(ROOT, 'docs', 'testing', 'hmh-reboot-enemy-endurance-browser.json');
const REPORT_MD = path.join(ROOT, 'docs', 'testing', 'hmh-reboot-enemy-endurance-browser.md');
const CAPTURE_DIR = path.join(ROOT, 'docs', 'testing', 'VISUAL_BASELINES', 'current', 'enemy-endurance');
const secondsArg = process.argv.find((arg) => arg.startsWith('--seconds='));
const seconds = Number(secondsArg?.split('=')[1] ?? 30);
if (!Number.isFinite(seconds) || seconds < 10 || seconds > 300) throw new Error('--seconds must be from 10 to 300');

const TARGET_ENEMIES = 128;
const MIN_RETAINED_ENEMIES = 100;
const MAX_P95_FRAME_MS = 28;
const MIN_MEDIAN_FPS = 45;
const MAX_HEAP_GROWTH_BYTES = 32 * 1024 * 1024;
const MAX_LONG_TASK_MS = 250;
const MAX_CATCH_UP_SATURATION_RATIO = 0.02;
const MAX_DROPPED_MS_PER_SECOND = 50;
const TOKEN_LIMITS = Object.freeze({ melee: 6, ranged: 5, area: 4, support: 2 });
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

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * ratio))];
}

function median(values) {
  return percentile(values, 0.5);
}

function parsePressure(value) {
  const [active, capacity] = String(value ?? '').split('/').map(Number);
  return { active, capacity };
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
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function latchProjectilePeak(page, holdMs) {
  return page.evaluate((ms) => new Promise((resolve) => {
    let peak = 0;
    const started = performance.now();
    const poll = () => {
      const count = Number(document.querySelector('#hmhRebootStage')?.dataset.projectileCount ?? 0);
      if (Number.isFinite(count) && count > peak) peak = count;
      if (performance.now() - started >= ms) resolve(peak);
      else requestAnimationFrame(poll);
    };
    poll();
  }), holdMs);
}

async function readStage(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('#hmhRebootStage');
    const data = stage?.dataset ?? {};
    return {
      tick: Number(data.simulationTick ?? NaN),
      health: Number(data.playerHealth ?? NaN),
      enemies: Number(data.enemyCount ?? NaN),
      animatedEnemies: Number(data.animatedEnemies ?? NaN),
      bodyPressure: data.enemyPoolPressure ?? '',
      threatPressure: data.enemyThreatPressure ?? '',
      projectilePressure: data.projectilePoolPressure ?? '',
      effectPressure: data.effectPoolPressure ?? '',
      attackTokens: Number(data.enemyAttackTokens ?? NaN),
      tokenFamilies: {
        melee: Number(data.enemyAttackTokensMelee ?? NaN),
        ranged: Number(data.enemyAttackTokensRanged ?? NaN),
        area: Number(data.enemyAttackTokensArea ?? NaN),
        support: Number(data.enemyAttackTokensSupport ?? NaN),
      },
      safetySteps: Number(data.enemySafetySteps ?? NaN),
      collisionContacts: Number(data.enemyCollisionContacts ?? NaN),
      traversalBlocks: Number(data.enemyTraversalBlocks ?? NaN),
      projectileCount: Number(data.projectileCount ?? NaN),
      audioVoices: Number(data.audioVoices ?? NaN),
      catchUpSaturationFrames: Number(data.simulationCatchUpSaturationFrames ?? NaN),
      droppedMs: Number(data.simulationDroppedMs ?? NaN),
      frameSteps: Number(data.simulationFrameSteps ?? NaN),
      encounterBand: data.encounterBand ?? '',
      endurancePilot: data.endurancePressurePilot ?? '',
      actorArt: data.actorArtSource ?? '',
      enemyArt: data.enemyArt ?? '',
      authoredProps: data.authoredPropStatus ?? '',
      heapUsed: performance.memory?.usedJSHeapSize ?? null,
      canvasVisible: Boolean(stage?.querySelector('canvas')?.getBoundingClientRect().width),
      touchControls: document.querySelectorAll('[data-hmh-control]').length,
    };
  });
}

async function runProfile(browser, origin, profile) {
  const context = await browser.newContext(profile);
  const page = await context.newPage();
  const consoleIssues = [];
  const networkIssues = [];
  page.on('pageerror', (error) => consoleIssues.push({ type: 'pageerror', text: error.stack ?? error.message }));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleIssues.push({ type: message.type(), text: message.text() });
  });
  page.on('requestfailed', (request) => networkIssues.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) networkIssues.push({ type: 'http', status: response.status(), url: response.url() });
  });
  await page.addInitScript(() => {
    globalThis.__hmhEndurancePerf = { frameDeltasMs: [], longTasks: [] };
    let previous = null;
    const frame = (now) => {
      if (previous !== null) globalThis.__hmhEndurancePerf.frameDeltasMs.push(now - previous);
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) globalThis.__hmhEndurancePerf.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });

  const url = `${origin}/hmh-reboot/?evidenceSafe=1&endurancePressurePilot=1&telemetry=1&seed=424242`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction((target) => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.endurancePressurePilot === 'true'
      && Number(stage.dataset.enemyCount) === target
      && Number(stage.dataset.simulationTick) >= 8
      && stage.dataset.actorArtSource === 'production-blender-atlas-v1'
      && stage.dataset.enemyArt === 'production-roster-atlas-v1'
      && stage.dataset.authoredPropStatus === 'ready';
  }, TARGET_ENEMIES, { timeout: 120_000 });
  const canvas = page.locator('#hmhRebootStage canvas');
  await canvas.click({ position: { x: 8, y: 8 } });
  await page.evaluate(() => {
    globalThis.gc?.();
    globalThis.__hmhEndurancePerf.frameDeltasMs.length = 0;
    globalThis.__hmhEndurancePerf.longTasks.length = 0;
  });
  await sleep(500);
  const heapBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  const samples = [];
  const mobileAimBox = profile.isMobile ? await page.locator('[data-hmh-control="aim"]').boundingBox() : null;
  const mobileCdp = profile.isMobile ? await context.newCDPSession(page) : null;
  const startedAt = Date.now();
  const movement = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
  let movementIndex = 0;
  let latchedProjectilePeak = 0;
  while (Date.now() - startedAt < seconds * 1000) {
    const code = movement[movementIndex % movement.length];
    await page.keyboard.down(code);
    await sleep(120);
    await page.keyboard.up(code);
    await page.keyboard.down('Space');
    latchedProjectilePeak = Math.max(latchedProjectilePeak, await latchProjectilePeak(page, 180));
    await page.keyboard.up('Space');
    samples.push({ atSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)), ...await readStage(page) });
    if (mobileAimBox && mobileCdp) {
      const x = mobileAimBox.x + mobileAimBox.width * 0.5;
      const y = mobileAimBox.y + mobileAimBox.height * 0.5;
      const fireX = mobileAimBox.x + mobileAimBox.width * 0.88;
      const touchPoint = (clientX) => [{ x: clientX, y, id: 91, radiusX: 10, radiusY: 10, force: 1 }];
      await mobileCdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoint(x) });
      await mobileCdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoint(fireX) });
      latchedProjectilePeak = Math.max(latchedProjectilePeak, await latchProjectilePeak(page, 220));
      await mobileCdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      samples.push({ atSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)), ...await readStage(page) });
    }
    movementIndex += 1;
    await sleep(80);
  }
  await page.evaluate(() => globalThis.gc?.());
  await sleep(350);
  const heapAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  const perf = await page.evaluate(() => globalThis.__hmhEndurancePerf);
  const screenshotPath = path.join(CAPTURE_DIR, `hmh-reboot-enemy-endurance-${profile.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const frameDeltas = perf.frameDeltasMs.filter((value) => Number.isFinite(value) && value > 0 && value < 1000);
  const p95FrameMs = percentile(frameDeltas, 0.95);
  const medianFrameMs = median(frameDeltas);
  const medianFps = medianFrameMs > 0 ? 1000 / medianFrameMs : 0;
  const maxLongTaskMs = Math.max(0, ...perf.longTasks.map((entry) => entry.duration));
  const familyMaxima = Object.fromEntries(Object.keys(TOKEN_LIMITS).map((family) => [family, Math.max(...samples.map((sample) => sample.tokenFamilies[family]))]));
  const bodyPressures = samples.map((sample) => parsePressure(sample.bodyPressure));
  const threatPressures = samples.map((sample) => parsePressure(sample.threatPressure));
  const projectilePressures = samples.map((sample) => parsePressure(sample.projectilePressure));
  const effectPressures = samples.map((sample) => parsePressure(sample.effectPressure));
  const tickAdvance = samples.at(-1).tick - samples[0].tick;
  const elapsedSeconds = (Date.now() - startedAt) / 1000;
  const saturationFrames = samples.at(-1).catchUpSaturationFrames - samples[0].catchUpSaturationFrames;
  const catchUpSaturationRatio = frameDeltas.length > 0 ? saturationFrames / frameDeltas.length : 1;
  const droppedMs = samples.at(-1).droppedMs - samples[0].droppedMs;
  const heapGrowthBytes = Number.isFinite(heapBefore) && Number.isFinite(heapAfter) ? heapAfter - heapBefore : null;
  const failures = [];
  if (samples.length < Math.floor(seconds * 2)) failures.push(`only ${samples.length} samples`);
  if (Math.max(...samples.map((sample) => sample.enemies)) !== TARGET_ENEMIES) failures.push(`peak bodies did not equal ${TARGET_ENEMIES}`);
  if (Math.min(...samples.map((sample) => sample.enemies)) < MIN_RETAINED_ENEMIES) failures.push(`bodies fell below ${MIN_RETAINED_ENEMIES}`);
  if (bodyPressures.some(({ active, capacity }) => active > capacity || capacity !== 192)) failures.push('body pressure exceeded or changed capacity');
  if (threatPressures.some(({ active, capacity }) => active > capacity || capacity !== 640)) failures.push('threat pressure exceeded or changed endurance capacity');
  if (projectilePressures.some(({ active, capacity }) => active > capacity)) failures.push('projectile pressure exceeded capacity');
  if (effectPressures.some(({ active, capacity }) => active > capacity)) failures.push('effect pressure exceeded capacity');
  for (const [family, limit] of Object.entries(TOKEN_LIMITS)) {
    if (!(familyMaxima[family] > 0 && familyMaxima[family] <= limit)) failures.push(`${family} attack token occupancy ${familyMaxima[family]} outside 1..${limit}`);
  }
  const sampledProjectilePeak = Math.max(0, ...samples.map((sample) => sample.projectileCount));
  const projectilePeak = Math.max(sampledProjectilePeak, latchedProjectilePeak);
  if (projectilePeak <= 0) failures.push('projectile pool was not exercised');
  if (Math.max(...effectPressures.map(({ active }) => active)) <= 0) failures.push('effect pool was not exercised');
  if (Math.max(...samples.map((sample) => sample.safetySteps)) < MIN_RETAINED_ENEMIES) failures.push('enemy safety resolver was not exercised at 100+ bodies');
  if (samples.some((sample) => sample.health <= 0 || !sample.canvasVisible)) failures.push('evidence-safe player or canvas became unavailable');
  if (samples.some((sample) => sample.encounterBand !== 'endurance' || sample.endurancePilot !== 'true')) failures.push('endurance evidence band drifted');
  if (samples.some((sample) => sample.actorArt !== 'production-blender-atlas-v1' || sample.enemyArt !== 'production-roster-atlas-v1' || sample.authoredProps !== 'ready')) failures.push('production art readiness drifted');
  // Canonical touch chrome is move, aim/fire, power, weapon, and pause. The
  // dedicated mobile-control matrix exercises real touch gestures; this gate
  // keeps all five controls present while the 128-body load is active.
  if (profile.id === 'mobile' && samples.some((sample) => sample.touchControls < 5)) failures.push('mobile touch controls became unavailable');
  if (tickAdvance < elapsedSeconds * 60 * 0.8) failures.push(`simulation advanced only ${tickAdvance} ticks in ${elapsedSeconds.toFixed(2)}s`);
  if (medianFps < MIN_MEDIAN_FPS) failures.push(`median FPS ${medianFps.toFixed(2)} below ${MIN_MEDIAN_FPS}`);
  if (p95FrameMs > MAX_P95_FRAME_MS) failures.push(`p95 frame ${p95FrameMs.toFixed(2)}ms above ${MAX_P95_FRAME_MS}ms`);
  if (maxLongTaskMs > MAX_LONG_TASK_MS) failures.push(`long task ${maxLongTaskMs.toFixed(2)}ms above ${MAX_LONG_TASK_MS}ms`);
  if (catchUpSaturationRatio > MAX_CATCH_UP_SATURATION_RATIO) failures.push(`catch-up saturation ratio ${(catchUpSaturationRatio * 100).toFixed(2)}% above ${MAX_CATCH_UP_SATURATION_RATIO * 100}%`);
  if (droppedMs > elapsedSeconds * MAX_DROPPED_MS_PER_SECOND) failures.push(`simulation dropped ${droppedMs.toFixed(2)}ms`);
  if (heapGrowthBytes !== null && heapGrowthBytes > MAX_HEAP_GROWTH_BYTES) failures.push(`retained heap grew ${heapGrowthBytes} bytes`);
  if (consoleIssues.length) failures.push(`${consoleIssues.length} console issue(s)`);
  if (networkIssues.length) failures.push(`${networkIssues.length} network issue(s)`);

  await context.close();
  return {
    profile: profile.id,
    viewport: profile.viewport,
    seconds: Number(elapsedSeconds.toFixed(3)),
    status: failures.length ? 'FAIL' : 'PASS',
    sampleCount: samples.length,
    frameTimeMs: { median: Number(medianFrameMs.toFixed(3)), p95: Number(p95FrameMs.toFixed(3)), p99: Number(percentile(frameDeltas, 0.99).toFixed(3)), max: Number(Math.max(...frameDeltas).toFixed(3)) },
    medianFps: Number(medianFps.toFixed(2)),
    longTasks: { count: perf.longTasks.length, maxMs: Number(maxLongTaskMs.toFixed(3)) },
    simulation: { tickAdvance, saturationFrames, catchUpSaturationRatio: Number(catchUpSaturationRatio.toFixed(5)), droppedMs: Number(droppedMs.toFixed(3)) },
    occupancy: {
      maxBodies: Math.max(...samples.map((sample) => sample.enemies)),
      minBodies: Math.min(...samples.map((sample) => sample.enemies)),
      maxAnimatedEnemies: Math.max(...samples.map((sample) => sample.animatedEnemies)),
      maxThreat: Math.max(...threatPressures.map(({ active }) => active)),
      tokenFamilies: familyMaxima,
      maxProjectiles: Math.max(latchedProjectilePeak, ...projectilePressures.map(({ active }) => active)),
      latchedProjectilePeak,
      maxEffects: Math.max(...effectPressures.map(({ active }) => active)),
      maxSafetyStepsPerTick: Math.max(...samples.map((sample) => sample.safetySteps)),
      maxCollisionContactsPerTick: Math.max(...samples.map((sample) => sample.collisionContacts)),
      maxTraversalBlocksPerTick: Math.max(...samples.map((sample) => sample.traversalBlocks)),
      maxAudioVoices: Math.max(...samples.map((sample) => sample.audioVoices)),
    },
    retainedHeap: { beforeBytes: heapBefore, afterBytes: heapAfter, growthBytes: heapGrowthBytes },
    consoleIssues,
    networkIssues,
    failures,
    screenshot: path.relative(ROOT, screenshotPath).replaceAll('\\', '/'),
  };
}

async function main() {
  await mkdir(path.dirname(REPORT_JSON), { recursive: true });
  await mkdir(CAPTURE_DIR, { recursive: true });
  const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!chromePath) throw new Error('Chrome/Edge executable not found');
  const port = await freePort();
  const server = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: PORTAL_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let browser;
  try {
    const origin = `http://127.0.0.1:${port}`;
    await waitForHttp(`${origin}/`);
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings',
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
        '--enable-precise-memory-info', '--js-flags=--expose-gc', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl',
      ],
    });
    const profiles = [];
    for (const profile of PROFILES) profiles.push(await runProfile(browser, origin, profile));
    const report = {
      schemaVersion: 1,
      runtime: 'hmh-reboot',
      status: profiles.every((profile) => profile.status === 'PASS') ? 'PASS' : 'FAIL',
      generatedAt: new Date().toISOString(),
      targetEnemies: TARGET_ENEMIES,
      profiles,
    };
    await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(REPORT_MD, `# HMH Reboot 100+ Enemy Browser Endurance\n\n- Status: **${report.status}**\n- Runtime: \`${report.runtime}\`\n- Active-body target: ${report.targetEnemies}\n- Duration: ${seconds}s per profile, serial desktop then mobile\n\n${profiles.map((profile) => `## ${profile.profile}\n\n- Status: **${profile.status}**\n- Viewport: ${profile.viewport.width}×${profile.viewport.height}\n- Median FPS: ${profile.medianFps}\n- P95 frame: ${profile.frameTimeMs.p95} ms\n- P99 frame: ${profile.frameTimeMs.p99} ms\n- Bodies: ${profile.occupancy.minBodies}–${profile.occupancy.maxBodies}\n- Animated-enemy peak: ${profile.occupancy.maxAnimatedEnemies}\n- Threat peak: ${profile.occupancy.maxThreat}/640\n- Token maxima: ${Object.entries(profile.occupancy.tokenFamilies).map(([family, value]) => `${family} ${value}/${TOKEN_LIMITS[family]}`).join(', ')}\n- Projectile/effect peaks: ${profile.occupancy.maxProjectiles}/${profile.occupancy.maxEffects}\n- Safety steps/tick peak: ${profile.occupancy.maxSafetyStepsPerTick}\n- Collision/traversal peaks: ${profile.occupancy.maxCollisionContactsPerTick}/${profile.occupancy.maxTraversalBlocksPerTick}\n- Simulation advance: ${profile.simulation.tickAdvance} ticks; dropped ${profile.simulation.droppedMs} ms\n- Catch-up saturation: ${(profile.simulation.catchUpSaturationRatio * 100).toFixed(2)}%\n- Long tasks: ${profile.longTasks.count}; max ${profile.longTasks.maxMs} ms\n- Retained heap growth: ${profile.retainedHeap.growthBytes} bytes\n- Console/network issues: ${profile.consoleIssues.length}/${profile.networkIssues.length}\n- Screenshot: \`${profile.screenshot}\`\n- Failures: ${profile.failures.length ? profile.failures.join('; ') : 'none'}\n`).join('\n')}`);
    console.log(JSON.stringify({ status: report.status, profiles: profiles.map(({ profile, status, medianFps, frameTimeMs, occupancy, simulation }) => ({ profile, status, medianFps, p95FrameMs: frameTimeMs.p95, p99FrameMs: frameTimeMs.p99, bodies: [occupancy.minBodies, occupancy.maxBodies], simulation })) }));
    if (report.status !== 'PASS') process.exitCode = 1;
  } finally {
    await browser?.close();
    if (server.exitCode === null) server.kill();
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
