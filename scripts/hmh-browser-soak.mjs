import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PORTAL_ROOT = path.join(ROOT, 'apps', 'portal');
const REPORT_JSON = path.join(ROOT, 'docs', 'testing', 'hmh-browser-soak.json');
const REPORT_MD = path.join(ROOT, 'docs', 'testing', 'hmh-browser-soak.md');
const PARTIAL_JSON = path.join(ROOT, 'docs', 'testing', 'hmh-browser-soak.partial.json');
const CAPTURE_DIR = path.join(ROOT, 'docs', 'testing', 'VISUAL_BASELINES', 'current', 'soak');
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const REBOOT_QUERY = 'evidenceSafe=1&combatPilot=1&telemetry=1&seed=424242';
const SIMULATION_HZ = 60;
const MAX_P95_FRAME_MS = 28;
const MIN_MEDIAN_FPS = 45;
const MAX_HEAP_GROWTH_BYTES = 64 * 1024 * 1024;
const MAX_HEAP_GROWTH_PERCENT = 150;
const MAX_DOM_GROWTH = 200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const minutesArg = process.argv.find((arg) => arg.startsWith('--minutes='));
const minutes = Number(minutesArg?.split('=')[1] ?? 30);
if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('--minutes must be a positive number');
const forcedRestartArg = process.argv.find((arg) => arg.startsWith('--force-restart-after-seconds='));
const forcedRestartAfterSeconds = forcedRestartArg ? Number(forcedRestartArg.split('=')[1]) : null;
if (forcedRestartAfterSeconds !== null && (!Number.isFinite(forcedRestartAfterSeconds) || forcedRestartAfterSeconds <= 0)) {
  throw new Error('--force-restart-after-seconds must be a positive number');
}
const durationMs = Math.round(minutes * 60_000);
const sampleIntervalMs = Math.min(30_000, Math.max(2_000, Math.round(durationMs / 60)));

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

async function acquireRunLock(lockDir) {
  try {
    await mkdir(lockDir);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existingPid = Number(await readFile(path.join(lockDir, 'pid'), 'utf8').catch(() => NaN));
    let active = false;
    if (Number.isInteger(existingPid) && existingPid > 0) {
      try {
        process.kill(existingPid, 0);
        active = true;
      } catch {}
    }
    if (active) throw new Error(`HMH reboot soak already running as PID ${existingPid}`);
    await rm(lockDir, { recursive: true, force: true });
    await mkdir(lockDir);
  }
  await writeFile(path.join(lockDir, 'pid'), `${process.pid}\n`);
}

function startProcess(command, args, cwd) {
  return spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { Connection: 'close' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
    });
    request.once('error', reject);
    request.setTimeout(5_000, () => request.destroy(new Error(`Timed out requesting ${url}`)));
  });
}

async function waitForHttp(url, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await requestText(url);
      if (response.status >= 200 && response.status < 400) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.listeners.get(message.method) ?? []) handler(message.params ?? {});
    });
  }
  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  close() { this.ws.close(); }
}

async function evaluate(client, expression, awaitPromise = true) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime evaluation failed');
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
}

function median(values) {
  return percentile(values, 0.5);
}

async function capture(client, filename) {
  const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(CAPTURE_DIR, filename), Buffer.from(shot.data, 'base64'));
}

async function pressMovement(client, key, code) {
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
  await sleep(350);
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
}

async function readSample(client) {
  return evaluate(client, `(async () => {
    const start = performance.now();
    let previous = null;
    let frames = 0;
    const frameDeltasMs = [];
    await new Promise((resolve) => {
      const step = (now) => {
        if (previous !== null) frameDeltasMs.push(Number((now - previous).toFixed(3)));
        previous = now;
        frames += 1;
        if (now - start >= 1000) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const elapsed = performance.now() - start;
    const stage = document.querySelector('#hmhRebootStage');
    const canvas = stage?.querySelector('canvas');
    return {
      fps: frames * 1000 / elapsed,
      frameDeltasMs,
      heapUsed: performance.memory?.usedJSHeapSize ?? null,
      heapTotal: performance.memory?.totalJSHeapSize ?? null,
      domNodes: document.getElementsByTagName('*').length,
      canvasVisible: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
      simulationTick: Number(stage?.dataset.simulationTick ?? NaN),
      actorX: Number(stage?.dataset.actorX ?? NaN),
      actorY: Number(stage?.dataset.actorY ?? NaN),
      playerHealth: Number(stage?.dataset.playerHealth ?? NaN),
      score: Number(stage?.dataset.runScore ?? NaN),
      enemyCount: Number(stage?.dataset.enemyCount ?? NaN),
      animatedEnemies: Number(stage?.dataset.animatedEnemies ?? NaN),
      projectileCount: Number(stage?.dataset.projectileCount ?? NaN),
      audioVoices: Number(stage?.dataset.audioVoices ?? NaN),
      bossActive: stage?.dataset.bossActive === 'true',
      bossPhase: stage?.dataset.bossPhase ?? '',
      districtId: stage?.dataset.districtId ?? '',
      actorArt: stage?.dataset.actorArtSource ?? '',
      enemyArt: stage?.dataset.enemyArt ?? '',
      authoredProps: stage?.dataset.authoredPropStatus ?? '',
      authoredPropCount: Number(stage?.dataset.authoredPropCount ?? NaN),
    };
  })()`);
}

async function main() {
  await mkdir(path.dirname(REPORT_JSON), { recursive: true });
  await mkdir(CAPTURE_DIR, { recursive: true });
  const lockDir = path.join(ROOT, '.tmp', 'hmh-reboot-soak.lock');
  await mkdir(path.dirname(lockDir), { recursive: true });
  await acquireRunLock(lockDir);
  const serverPort = await freePort();
  const debugPort = await freePort();
  const profileDir = path.join(ROOT, '.tmp', `chrome-reboot-soak-${process.pid}`);
  let server;
  let chrome;
  let client;
  const consoleIssues = [];
  const networkIssues = [];
  const samples = [];
  const startedAt = new Date();

  try {
    server = startProcess('python', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], PORTAL_ROOT);
    await waitForHttp(`http://127.0.0.1:${serverPort}/`);
    const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
    if (!chromePath) throw new Error('Chrome/Edge executable not found');
    chrome = startProcess(chromePath, [
      '--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--enable-precise-memory-info', '--js-flags=--expose-gc', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl',
      `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, 'about:blank',
    ], ROOT);
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
    const pages = JSON.parse((await requestText(`http://127.0.0.1:${debugPort}/json/list`)).text);
    client = new CdpClient(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
    await client.open();
    client.on('Runtime.consoleAPICalled', (event) => {
      if (['error', 'warning'].includes(event.type)) consoleIssues.push({ type: event.type, text: event.args.map((arg) => arg.value ?? arg.description).join(' ') });
    });
    client.on('Runtime.exceptionThrown', (event) => consoleIssues.push({ type: 'exception', text: event.exceptionDetails?.exception?.description ?? event.exceptionDetails?.text ?? 'uncaught exception' }));
    client.on('Network.loadingFailed', (event) => networkIssues.push({ type: 'loading-failed', url: event.requestId, error: event.errorText }));
    client.on('Network.responseReceived', (event) => {
      if (event.response.status >= 400) networkIssues.push({ type: 'http', status: event.response.status, url: event.response.url });
    });
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Network.enable');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/hmh-reboot/?${REBOOT_QUERY}` });
    await waitFor(client, `(() => {
      const stage = document.querySelector('#hmhRebootStage');
      return Number(stage?.dataset.simulationTick) >= 4
        && stage?.dataset.actorArtSource === 'production-blender-atlas-v1'
        && stage?.dataset.enemyArt === 'production-roster-atlas-v1'
        && stage?.dataset.authoredPropStatus === 'ready';
    })()`);
    await evaluate(client, `(() => { const canvas = document.querySelector('#hmhRebootStage canvas'); canvas.tabIndex = 0; canvas.focus(); return document.activeElement === canvas; })()`);
    await capture(client, 'reboot-soak-start.png');

    const soakStarted = Date.now();
    const movement = [['d', 'KeyD'], ['s', 'KeyS'], ['a', 'KeyA'], ['w', 'KeyW']];
    let sampleIndex = 0;
    let upgradeSelections = 0;
    let runRestarts = 0;
    let previousTick = null;
    let cumulativeTickAdvance = 0;
    let forcedRestartComplete = false;
    while (Date.now() - soakStarted < durationMs) {
      const runState = await evaluate(client, `(() => {
        const stage = document.querySelector('#hmhRebootStage');
        return {
          tick: Number(stage?.dataset.simulationTick ?? NaN),
          health: Number(stage?.dataset.playerHealth ?? NaN),
          restartAvailable: Boolean(document.querySelector('#hmhRestartButton')),
        };
      })()`);
      const forceRestart = forcedRestartAfterSeconds !== null
        && !forcedRestartComplete
        && (Date.now() - soakStarted) / 1000 >= forcedRestartAfterSeconds;
      if ((runState.health <= 0 || forceRestart) && runState.restartAvailable) {
        if (previousTick !== null && Number.isFinite(runState.tick)) {
          cumulativeTickAdvance += Math.max(0, runState.tick - previousTick);
        }
        await evaluate(client, `document.querySelector('#hmhRestartButton').click(); true`);
        await waitFor(client, `(() => {
          const stage = document.querySelector('#hmhRebootStage');
          return Number(stage?.dataset.simulationTick) >= 4 && Number(stage?.dataset.playerHealth) > 0;
        })()`);
        runRestarts += 1;
        previousTick = 0;
        forcedRestartComplete ||= forceRestart;
      }
      const upgradeVisible = await evaluate(client, `(() => {
        const panel = document.querySelector('#hmhUpgradePanel');
        return Boolean(panel && !panel.hidden && panel.querySelector('button'));
      })()`);
      if (upgradeVisible) {
        await evaluate(client, `document.querySelector('#hmhUpgradePanel button').click(); true`);
        upgradeSelections += 1;
      }
      const [key, code] = movement[sampleIndex % movement.length];
      await pressMovement(client, key, code);
      const sample = await readSample(client);
      const retainedHeap = await evaluate(client, `(() => {
        const started = performance.now();
        globalThis.gc?.();
        return {
          heapAfterGc: performance.memory?.usedJSHeapSize ?? null,
          gcPauseMs: performance.now() - started,
        };
      })()`);
      sample.heapAfterGc = retainedHeap.heapAfterGc;
      sample.gcPauseMs = retainedHeap.gcPauseMs;
      if (previousTick !== null) {
        if (sample.simulationTick < previousTick) {
          runRestarts += 1;
          cumulativeTickAdvance += Math.max(0, sample.simulationTick);
        } else {
          cumulativeTickAdvance += sample.simulationTick - previousTick;
        }
      }
      previousTick = sample.simulationTick;
      samples.push({ atSeconds: Number(((Date.now() - soakStarted) / 1000).toFixed(2)), ...sample });
      await writeFile(PARTIAL_JSON, `${JSON.stringify({ status: 'RUNNING', startedAt: startedAt.toISOString(), requestedMinutes: minutes, sampleCount: samples.length, lastSample: sample }, null, 2)}\n`);
      sampleIndex += 1;
      const delay = Math.max(0, sampleIntervalMs - 1_350);
      if (delay) await sleep(Math.min(delay, Math.max(0, durationMs - (Date.now() - soakStarted))));
    }

    await capture(client, 'reboot-soak-end.png');
    await evaluate(client, 'globalThis.gc?.(); true');
    await sleep(500);
    const afterGc = await evaluate(client, `({
      heapUsed: performance.memory?.usedJSHeapSize ?? null,
      heapTotal: performance.memory?.totalJSHeapSize ?? null,
      domNodes: document.getElementsByTagName('*').length,
      simulationTick: Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick ?? NaN),
      canvasVisible: Boolean(document.querySelector('#hmhRebootStage canvas')),
    })`);

    const frameDeltas = samples.flatMap((sample) => sample.frameDeltasMs);
    const fpsValues = samples.map((sample) => sample.fps);
    const heapValues = samples.map((sample) => sample.heapUsed).filter(Number.isFinite);
    const quartile = Math.max(1, Math.floor(heapValues.length / 4));
    const firstHeapMedian = median(heapValues.slice(0, quartile));
    const lastHeapMedian = median(heapValues.slice(-quartile));
    const heapGrowthBytes = lastHeapMedian - firstHeapMedian;
    const heapGrowthPercent = firstHeapMedian > 0 ? heapGrowthBytes / firstHeapMedian * 100 : 0;
    const retainedHeapValues = samples.map((sample) => sample.heapAfterGc).filter(Number.isFinite);
    const steadyStateValues = retainedHeapValues.slice(Math.floor(retainedHeapValues.length / 2));
    const steadyWindow = Math.max(1, Math.floor(steadyStateValues.length / 2));
    const firstSteadyHeapMedian = median(steadyStateValues.slice(0, steadyWindow));
    const lastSteadyHeapMedian = median(steadyStateValues.slice(-steadyWindow));
    const retainedHeapGrowthBytes = lastSteadyHeapMedian - firstSteadyHeapMedian;
    const retainedHeapGrowthPercent = firstSteadyHeapMedian > 0 ? retainedHeapGrowthBytes / firstSteadyHeapMedian * 100 : 0;
    const tickAdvance = cumulativeTickAdvance;
    const minimumTickAdvance = Math.floor(minutes * 60 * SIMULATION_HZ * 0.8);
    const failures = [];
    if (samples.length < 2) failures.push('fewer than two runtime samples');
    if (tickAdvance < minimumTickAdvance) failures.push(`simulation advanced ${tickAdvance} ticks; expected at least ${minimumTickAdvance}`);
    if (median(fpsValues) < MIN_MEDIAN_FPS) failures.push(`median FPS ${median(fpsValues).toFixed(2)} below ${MIN_MEDIAN_FPS}`);
    if (percentile(frameDeltas, 0.95) > MAX_P95_FRAME_MS) failures.push(`p95 frame ${percentile(frameDeltas, 0.95).toFixed(2)}ms above ${MAX_P95_FRAME_MS}ms`);
    if (retainedHeapValues.length < 4) failures.push('fewer than four retained-heap samples');
    if (retainedHeapGrowthBytes > MAX_HEAP_GROWTH_BYTES && retainedHeapGrowthPercent > MAX_HEAP_GROWTH_PERCENT) failures.push(`steady-state retained heap grew ${retainedHeapGrowthBytes} bytes (${retainedHeapGrowthPercent.toFixed(2)}%)`);
    if (samples.at(-1).domNodes - samples[0].domNodes > MAX_DOM_GROWTH) failures.push(`DOM grew by ${samples.at(-1).domNodes - samples[0].domNodes} nodes`);
    if (samples.some((sample) => !sample.canvasVisible)) failures.push('reboot canvas became unavailable');
    if (samples.some((sample) => sample.actorArt !== 'production-blender-atlas-v1' || sample.enemyArt !== 'production-roster-atlas-v1' || sample.authoredProps !== 'ready')) failures.push('authored asset readiness drifted');
    if (Math.max(...samples.map((sample) => sample.enemyCount)) < 1) failures.push('combat pilot never reported an active enemy');
    if (consoleIssues.length) failures.push(`${consoleIssues.length} browser console issue(s)`);
    if (networkIssues.length) failures.push(`${networkIssues.length} network issue(s)`);

    const report = {
      schemaVersion: 3,
      runtime: 'hmh-reboot',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      requestedMinutes: minutes,
      actualMinutes: Number(((Date.now() - soakStarted) / 60_000).toFixed(3)),
      status: failures.length ? 'FAIL' : 'PASS',
      sampleIntervalSeconds: sampleIntervalMs / 1000,
      sampleCount: samples.length,
      medianFps: Number(median(fpsValues).toFixed(2)),
      minFps: Number(Math.min(...fpsValues).toFixed(2)),
      frameTimeMs: { p50: percentile(frameDeltas, 0.5), p95: percentile(frameDeltas, 0.95), p99: percentile(frameDeltas, 0.99), max: Math.max(...frameDeltas) },
      simulation: { firstTick: samples[0].simulationTick, lastTick: samples.at(-1).simulationTick, tickAdvance, minimumTickAdvance, runRestarts },
      occupancy: {
        maxEnemies: Math.max(...samples.map((sample) => sample.enemyCount)),
        maxAnimatedEnemies: Math.max(...samples.map((sample) => sample.animatedEnemies)),
        maxProjectiles: Math.max(...samples.map((sample) => sample.projectileCount)),
        maxAudioVoices: Math.max(...samples.map((sample) => sample.audioVoices)),
        bossObserved: samples.some((sample) => sample.bossActive),
        bossPhases: [...new Set(samples.filter((sample) => sample.bossActive).map((sample) => sample.bossPhase).filter(Boolean))],
        districts: [...new Set(samples.map((sample) => sample.districtId).filter(Boolean))],
      },
      authoredAssets: { actorArt: samples.at(-1).actorArt, enemyArt: samples.at(-1).enemyArt, authoredProps: samples.at(-1).authoredProps, authoredPropCount: samples.at(-1).authoredPropCount },
      upgradeSelections,
      firstHeapMedianBytes: firstHeapMedian,
      lastHeapMedianBytes: lastHeapMedian,
      heapGrowthBytes,
      heapGrowthPercent: Number(heapGrowthPercent.toFixed(2)),
      steadyStateRetainedHeap: {
        firstMedianBytes: firstSteadyHeapMedian,
        lastMedianBytes: lastSteadyHeapMedian,
        growthBytes: retainedHeapGrowthBytes,
        growthPercent: Number(retainedHeapGrowthPercent.toFixed(2)),
        maxGcPauseMs: Math.max(...samples.map((sample) => sample.gcPauseMs ?? 0)),
      },
      firstDomNodes: samples[0].domNodes,
      lastDomNodes: samples.at(-1).domNodes,
      afterGc,
      consoleIssues,
      networkIssues,
      failures,
      samples,
    };
    await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(REPORT_MD, `# HMH Reboot Browser Soak\n\n- Status: **${report.status}**\n- Runtime: \`${report.runtime}\`\n- Requested: ${report.requestedMinutes} minutes\n- Actual: ${report.actualMinutes} minutes\n- Samples: ${report.sampleCount}\n- Median FPS: ${report.medianFps}\n- P95 frame: ${report.frameTimeMs.p95} ms\n- Simulation advance: ${report.simulation.tickAdvance} ticks (minimum ${report.simulation.minimumTickAdvance})\n- Run restarts: ${report.simulation.runRestarts}\n- Maximum enemies: ${report.occupancy.maxEnemies}\n- Authored props: ${report.authoredAssets.authoredProps} (${report.authoredAssets.authoredPropCount})\n- Raw heap growth: ${report.heapGrowthBytes} bytes (${report.heapGrowthPercent}%)\n- Steady-state retained heap growth: ${report.steadyStateRetainedHeap.growthBytes} bytes (${report.steadyStateRetainedHeap.growthPercent}%)\n- Maximum forced-GC pause: ${report.steadyStateRetainedHeap.maxGcPauseMs} ms\n- Console issues: ${report.consoleIssues.length}\n- Network issues: ${report.networkIssues.length}\n- Failures: ${report.failures.length ? report.failures.join('; ') : 'none'}\n`);
    await rm(PARTIAL_JSON, { force: true });
    if (failures.length) throw new Error(`HMH reboot soak failed: ${failures.join('; ')}`);
    console.log(JSON.stringify({ status: report.status, runtime: report.runtime, actualMinutes: report.actualMinutes, sampleCount: report.sampleCount, medianFps: report.medianFps, p95FrameMs: report.frameTimeMs.p95, tickAdvance: report.simulation.tickAdvance, maxEnemies: report.occupancy.maxEnemies, heapGrowthBytes: report.heapGrowthBytes }));
  } finally {
    client?.close();
    if (chrome && chrome.exitCode === null) {
      chrome.kill();
      await Promise.race([
        new Promise((resolve) => chrome.once('exit', resolve)),
        sleep(5_000),
      ]);
    }
    if (server?.exitCode === null) server.kill();
    await sleep(500);
    await rm(profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    await rm(lockDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  await writeFile(PARTIAL_JSON, `${JSON.stringify({ status: 'FAIL', failedAt: new Date().toISOString(), error: error.stack ?? String(error) }, null, 2)}\n`).catch(() => {});
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
