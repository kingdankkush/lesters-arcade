import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const portalRoot = fileURLToPath(new URL('../apps/portal', import.meta.url));
const baselineDir = fileURLToPath(new URL('../docs/testing/VISUAL_BASELINES/hmh-level-1', import.meta.url));
const currentDir = fileURLToPath(new URL('../docs/testing/VISUAL_BASELINES/current/hmh-level-1', import.meta.url));
const accept = process.argv.includes('--accept');
const chromePath = process.env.CHROME_PATH
  ?? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((path) => existsSync(path));

if (!chromePath) {
  throw new Error('WO-65 visual regression needs Chrome/Edge. Set CHROME_PATH to a browser executable.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findOpenPort(preferredPort = 8791) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', () => {
      const fallback = createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const { port } = fallback.address();
        fallback.close(() => resolve(port));
      });
    });
    probe.listen(preferredPort, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function fetchJson(url, attempts = 80) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(125);
    }
  }
  throw lastError;
}

function cdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const eventWaiters = new Map();
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      else resolve(message.result ?? {});
      return;
    }
    if (message.method && eventWaiters.has(message.method)) {
      for (const waiter of eventWaiters.get(message.method)) waiter(message.params ?? {});
      eventWaiters.delete(message.method);
    }
  });
  return {
    async send(method, params = {}) {
      await opened;
      const requestId = ++id;
      socket.send(JSON.stringify({ id: requestId, method, params }));
      return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
    },
    async waitFor(method, timeoutMs = 10000) {
      await opened;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out waiting for CDP event ${method}`)), timeoutMs);
        const waiter = (params) => {
          clearTimeout(timer);
          resolve(params);
        };
        const list = eventWaiters.get(method) ?? [];
        list.push(waiter);
        eventWaiters.set(method, list);
      });
    },
    close() {
      try { socket.close(); } catch {}
    },
  };
}

async function hashFile(path) {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

function comparePngWithPillow(baselinePath, currentPath) {
  const script = String.raw`
import json
import sys
from PIL import Image, ImageChops
baseline, current = sys.argv[1], sys.argv[2]
im1 = Image.open(baseline).convert('RGB')
im2 = Image.open(current).convert('RGB')
if im1.size != im2.size:
    print(json.dumps({'sizeMismatch': True, 'baselineSize': im1.size, 'currentSize': im2.size}))
    sys.exit(0)
diff = ImageChops.difference(im1, im2)
data = list(diff.getdata())
total = im1.size[0] * im1.size[1]
changed = sum(1 for px in data if px != (0, 0, 0))
abs_sum = sum(sum(px) for px in data)
print(json.dumps({
    'sizeMismatch': False,
    'changedPct': changed / total * 100,
    'meanAbsPerChannel': abs_sum / (total * 3),
    'maxDelta': max(max(px) for px in data) if data else 0,
    'bbox': diff.getbbox(),
}))
`;
  const result = spawnSync('python', ['-c', script, baselinePath, currentPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    return { error: result.stderr || result.stdout || `python exited ${result.status}` };
  }
  return JSON.parse(result.stdout);
}

function visualDiffPasses(diff) {
  return Boolean(
    diff
    && !diff.error
    && !diff.sizeMismatch
    && diff.changedPct <= 1
    && diff.meanAbsPerChannel <= 0.25
  );
}

const LIVE_WALK_REAL_TIME_MS = 700;

async function captureScreenshotBytes(client) {
  const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  return Buffer.from(shot.data, 'base64');
}

async function writeEvidenceCapture(client, name) {
  const bytes = await captureScreenshotBytes(client);
  await mkdir(currentDir, { recursive: true });
  const currentPath = `${currentDir}/${name}.png`;
  await writeFile(currentPath, bytes);
  return {
    name,
    status: 'evidence',
    currentPath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

async function writeCapture(client, name) {
  const bytes = await captureScreenshotBytes(client);
  await mkdir(currentDir, { recursive: true });
  const currentPath = `${currentDir}/${name}.png`;
  await writeFile(currentPath, bytes);
  const baselinePath = `${baselineDir}/${name}.png`;
  if (accept || !existsSync(baselinePath)) {
    await mkdir(baselineDir, { recursive: true });
    await writeFile(baselinePath, bytes);
    return { name, status: accept ? 'accepted' : 'created', currentPath, baselinePath, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const currentHash = createHash('sha256').update(bytes).digest('hex');
  const baselineHash = await hashFile(baselinePath);
  const exactMatch = currentHash === baselineHash;
  const diff = exactMatch ? null : comparePngWithPillow(baselinePath, currentPath);
  return {
    name,
    status: exactMatch || visualDiffPasses(diff) ? 'match' : 'changed',
    currentPath,
    baselinePath,
    sha256: currentHash,
    baselineSha256: baselineHash,
    exactMatch,
    diff,
  };
}

async function runInPage(client, expression, timeout = 30000) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Runtime.evaluate failed');
  return result.result?.value;
}

const smokePort = await findOpenPort(Number.parseInt(process.env.PORTAL_VISUAL_PORT ?? '8791', 10));
const chromePort = await findOpenPort(9222);
const userDataDir = join(tmpdir(), `lesters-arcade-visual-chrome-${process.pid}-${Date.now()}`);
const portalUrl = `http://127.0.0.1:${smokePort}/?hmhDebug=balance&visualSeed=1337`;
const server = spawn('python', ['-m', 'http.server', String(smokePort), '--bind', '127.0.0.1'], { cwd: portalRoot, stdio: 'pipe' });
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-sync',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${userDataDir}`,
  `--remote-debugging-port=${chromePort}`,
  'about:blank',
], { stdio: 'pipe' });

let client = null;
let serverError = '';
let chromeError = '';
server.stderr.on('data', (chunk) => { serverError += chunk.toString(); });
chrome.stderr.on('data', (chunk) => { chromeError += chunk.toString(); });

try {
  await fetchJson(`http://127.0.0.1:${chromePort}/json/version`);
  const targets = await fetchJson(`http://127.0.0.1:${chromePort}/json/list`);
  const pageTarget = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  if (!pageTarget) throw new Error(`Chrome DevTools did not expose a page target: ${JSON.stringify(targets)}`);
  client = cdpClient(pageTarget.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Input.setIgnoreInputEvents', { ignore: false });
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const loadEvent = client.waitFor('Page.loadEventFired', 15000);
  await client.send('Page.navigate', { url: portalUrl });
  await loadEvent;
  await sleep(700);

  const bootGate = await runInPage(client, `
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const click = (id) => {
        const node = document.getElementById(id);
        if (!node) throw new Error('missing #' + id);
        node.click();
      };
      localStorage.setItem('lestersArcadeDebug', '1');
      Date.now = () => 1337;
      click('officialGuestEnterButton');
      await wait(350);
      click('officialFreeModeButton');
      await wait(350);
      const firstHero = document.querySelector('#officialCharacterRoster button');
      if (firstHero) firstHero.click();
      await wait(350);
      click('officialBeginLevelButton');
      const appearDeadline = performance.now() + 10000;
      while (!document.getElementById('hmhLoadingOverlay') && performance.now() < appearDeadline) {
        await wait(100);
      }
      const removeDeadline = performance.now() + 60000;
      while (document.getElementById('hmhLoadingOverlay') && performance.now() < removeDeadline) {
        await wait(250);
      }
      const readyDeadline = performance.now() + 10000;
      while (!document.getElementById('hmhReadyOverlay') && performance.now() < readyDeadline) {
        await wait(100);
      }
      const readyOverlay = document.getElementById('hmhReadyOverlay');
      if (!readyOverlay) throw new Error('missing #hmhReadyOverlay');
      const pausedStatText = document.getElementById('roguelikeStatBar')?.textContent ?? '';
      const debugOverlay = document.getElementById('tacticalBalanceDebugOverlay');
      if (debugOverlay) {
        debugOverlay.hidden = true;
        debugOverlay.style.display = 'none';
      }
      readyOverlay.hidden = true;
      document.getElementById('combatCanvas')?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
      const heroReadyDeadline = performance.now() + 5000;
      let heroVisual = globalThis.__hmhVisualDebugHero?.() ?? null;
      while (!heroVisual?.ready && performance.now() < heroReadyDeadline) {
        await wait(100);
        heroVisual = globalThis.__hmhVisualDebugHero?.() ?? null;
      }
      await wait(50);
      const loadingOverlay = document.getElementById('hmhLoadingOverlay');
      const loadingStyle = loadingOverlay ? getComputedStyle(loadingOverlay) : null;
      const progressFill = loadingOverlay?.querySelector('.hmh-loading-progress-fill');
      return {
        step: document.body.dataset.officialStep ?? document.querySelector('.official-view:not([hidden])')?.id ?? 'unknown',
        canvas: Boolean(document.getElementById('combatCanvas')),
        overlayGone: !loadingOverlay,
        overlayOpacity: loadingStyle?.opacity ?? null,
        overlayDisplay: loadingStyle?.display ?? null,
        overlayText: loadingOverlay?.textContent ?? '',
        progressWidth: progressFill?.style?.width ?? '',
        titleOverlay: Boolean(document.getElementById('hmhLoadingTitleOverlay')),
        readyGatePrepared: readyOverlay.hidden,
        pausedStatText,
        heroVisual,
      };
    })()
  `, 45000);

  if (!bootGate?.canvas) throw new Error(`HMH visual boot did not expose combat canvas: ${JSON.stringify(bootGate)}`);
  if (!bootGate?.overlayGone) throw new Error(`HMH loading overlay still visible: ${JSON.stringify(bootGate)}`);
  if (!bootGate?.readyGatePrepared) throw new Error(`HMH READY gate did not prepare the deterministic render anchor: ${JSON.stringify(bootGate)}`);
  if (!bootGate?.heroVisual?.ready) throw new Error(`HMH selected hero art was not decoded before visual capture: ${JSON.stringify(bootGate?.heroVisual)}`);

  const captures = [];
  captures.push(await writeCapture(client, 'seed-1337-render-anchor'));

  const liveResult = await runInPage(client, `
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const readyOverlay = document.getElementById('hmhReadyOverlay');
      if (!readyOverlay) throw new Error('missing #hmhReadyOverlay');
      readyOverlay.hidden = false;
      const pausedStatText = document.getElementById('roguelikeStatBar')?.textContent ?? '';
      readyOverlay.click();
      const simulationDeadline = performance.now() + 5000;
      let seedText = pausedStatText;
      while (performance.now() < simulationDeadline) {
        seedText = document.getElementById('roguelikeStatBar')?.textContent ?? '';
        if (seedText && seedText !== pausedStatText && !seedText.includes('0:00')) break;
        await wait(25);
      }
      const debugOverlay = document.getElementById('tacticalBalanceDebugOverlay');
      if (debugOverlay) {
        debugOverlay.hidden = true;
        debugOverlay.style.display = 'none';
      }
      document.getElementById('combatCanvas')?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
      await wait(50);
      return {
        readyOverlay: Boolean(document.getElementById('hmhReadyOverlay')),
        simulationAdvanced: Boolean(seedText && seedText !== pausedStatText && !seedText.includes('0:00')),
        seedText,
      };
    })()
  `);
  const bootResult = { ...bootGate, ...liveResult };
  if (!bootResult.simulationAdvanced) throw new Error(`HMH visual run never advanced beyond READY: ${JSON.stringify(bootResult)}`);
  if (bootResult.readyOverlay) throw new Error(`HMH READY gate remained after activation: ${JSON.stringify(bootResult)}`);
  if (!String(bootResult.seedText).includes('1337')) throw new Error(`HMH visual run did not boot seed 1337: ${JSON.stringify(bootResult)}`);

  const liveEvidence = await writeEvidenceCapture(client, 'seed-1337-live-spawn');
  captures.push(liveEvidence);

  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  await sleep(LIVE_WALK_REAL_TIME_MS);
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  const walkEvidence = await writeEvidenceCapture(client, 'seed-1337-east-walk');
  captures.push(walkEvidence);
  const activeEvidenceDistinct = liveEvidence.sha256 !== walkEvidence.sha256;
  if (!activeEvidenceDistinct) throw new Error('HMH east-walk evidence did not differ from the live-spawn frame');

  const propPersistenceSamples = [];
  for (let sampleIndex = 0; sampleIndex < 36; sampleIndex += 1) {
    await runInPage(client, `globalThis.__hmhVisualDebugSetPosition?.(${sampleIndex * 1.5}, 10)`);
    await sleep(150);
    propPersistenceSamples.push(await runInPage(client, `globalThis.__hmhVisualDebugScene?.()`));
  }
  const renderedIdSet = new Set(propPersistenceSamples.flatMap((sample) => sample?.renderedIds ?? []));
  const reappearedIds = [];
  for (const id of renderedIdSet) {
    const states = propPersistenceSamples.map((sample) => sample?.renderedIds?.includes(id) ?? false);
    const compressed = states.filter((state, index) => index === 0 || state !== states[index - 1]);
    if (compressed.join(',').includes('true,false,true')) reappearedIds.push(id);
  }
  const propPersistenceProbe = {
    sampleCount: propPersistenceSamples.length,
    startX: propPersistenceSamples[0]?.playerX ?? null,
    endX: propPersistenceSamples.at(-1)?.playerX ?? null,
    uniqueRenderedIds: renderedIdSet.size,
    reappearedIds,
    renderedWhileUndecoded: propPersistenceSamples.flatMap((sample) => (sample?.renderedIds ?? []).filter((id) => sample?.undecodedIds?.includes(id))),
  };
  if (propPersistenceProbe.reappearedIds.length || propPersistenceProbe.renderedWhileUndecoded.length || !(propPersistenceProbe.endX > propPersistenceProbe.startX + 4)) {
    throw new Error(`HMH prop persistence traversal failed: ${JSON.stringify(propPersistenceProbe)}`);
  }
  // Let camera traversal image decodes settle before sampling steady-state gameplay.
  await sleep(1500);

  await runInPage(client, `globalThis.__hmhVisualDebugTeleport?.(16, -13)`);
  const collisionTarget = await runInPage(client, `
    (() => {
      const scene = globalThis.__hmhVisualDebugScene?.();
      return scene?.solidObstacles?.find((obstacle) =>
        String(obstacle.id).includes('ghost-saloon-square')
        && obstacle.footprintTiles?.w > 0
        && obstacle.footprintTiles?.h > 0
        && obstacle.footprintTiles.w <= 4
        && obstacle.footprintTiles.h <= 4
      ) ?? null;
    })()
  `);
  if (!collisionTarget) throw new Error('HMH World v3 collision probe could not find a nearby authored solid');
  const halfWidth = collisionTarget.footprintTiles.w / 2;
  const halfHeight = collisionTarget.footprintTiles.h / 2;
  const horizontalStartX = collisionTarget.worldX - halfWidth - 1.5;
  const horizontalLimitX = collisionTarget.worldX - halfWidth - 0.42;
  await runInPage(client, `globalThis.__hmhVisualDebugSetPosition?.(${horizontalStartX}, ${collisionTarget.worldY})`);
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  await sleep(900);
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  const horizontalCollision = await runInPage(client, `globalThis.__hmhVisualDebugScene?.()`);
  const verticalStartY = collisionTarget.worldY + halfHeight + 1.5;
  const verticalLimitY = collisionTarget.worldY + halfHeight + 0.42;
  await runInPage(client, `globalThis.__hmhVisualDebugSetPosition?.(${collisionTarget.worldX}, ${verticalStartY})`);
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
  await sleep(900);
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
  const verticalCollision = await runInPage(client, `globalThis.__hmhVisualDebugScene?.()`);
  const collisionProbe = {
    targetId: collisionTarget.id,
    horizontalStopX: horizontalCollision?.playerX ?? null,
    verticalStopY: verticalCollision?.playerY ?? null,
  };
  if (!(collisionProbe.horizontalStopX > horizontalStartX + 0.2 && collisionProbe.horizontalStopX <= horizontalLimitX + 0.2)
      || !(collisionProbe.verticalStopY < verticalStartY - 0.2 && collisionProbe.verticalStopY >= verticalLimitY - 0.2)) {
    throw new Error(`HMH substantial-prop collision probe failed: ${JSON.stringify(collisionProbe)}`);
  }
  await sleep(1200);

  const runtimeProfile = await runInPage(client, `
    (async () => {
      const proto = CanvasRenderingContext2D.prototype;
      const names = ['drawImage', 'fillRect', 'fill', 'stroke'];
      const originals = {};
      const calls = Object.fromEntries(names.map((name) => [name, 0]));
      for (const name of names) {
        originals[name] = proto[name];
        proto[name] = function (...args) {
          calls[name] += 1;
          return originals[name].apply(this, args);
        };
      }
      const frameTimes = [];
      let active = true;
      let previous = performance.now();
      const sample = (now) => {
        frameTimes.push(now - previous);
        previous = now;
        if (active) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      const startedAt = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      active = false;
      const elapsedSeconds = (performance.now() - startedAt) / 1000;
      for (const name of names) proto[name] = originals[name];
      const sorted = frameTimes.slice(1).sort((a, b) => a - b);
      const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
      return {
        elapsedSeconds,
        sampledFrames: sorted.length,
        fps: sorted.length / elapsedSeconds,
        p50FrameMs: percentile(0.5),
        p95FrameMs: percentile(0.95),
        worstFrameMs: percentile(1),
        callsPerFrame: Object.fromEntries(names.map((name) => [name, calls[name] / Math.max(1, sorted.length)])),
        fpsPill: document.getElementById('fpsPill')?.textContent ?? '',
        runtimeDebug: globalThis.__hmhVisualDebugPerformance?.() ?? null,
      };
    })()
  `, 10000);

  const compactWorldTour = [
    { name: 'seed-1337-spawn-road', x: 0, y: 0, prefix: 'curated/jul9-fences-barricades-' },
    { name: 'seed-1337-ghost-town', x: 16, y: -13, prefix: 'curated/jul9-ghost-town-facade-' },
    { name: 'seed-1337-dry-forest', x: 12, y: -40, prefix: 'wo104-world/forest-' },
    { name: 'seed-1337-mesa-overlook', x: 30, y: -58, prefix: 'curated/jul9-desert-rock-formations-b-' },
    { name: 'seed-1337-oasis-lakeside', x: 52, y: -13, prefix: 'wo104-world/reed-' },
    { name: 'seed-1337-crossroads', x: 50, y: -33, prefix: 'level1-authored-stamp/river-bridge-arrow-sign' },
    { name: 'seed-1337-pine-creek-bridge', x: 27, y: -39, prefix: 'level1-authored-stamp/river-bridge-arrow-sign', requireBridge: true },
    { name: 'seed-1337-frontier-town', x: 63, y: -26, prefix: 'wo105-world/second-town-' },
    { name: 'seed-1337-wrecked-lighthouse', x: 74, y: 4, prefix: 'curated/jul9-ambient-water-glow-b-' },
    { name: 'seed-1337-boss-yard', x: 79, y: -43, prefix: 'curated/jul9-industrial-mining-' },
    { name: 'seed-1337-extraction', x: 85, y: -39, prefix: 'level1-authored-stamp/extraction-pad-' },
    { name: 'seed-1337-west-boundary', x: -7.5, y: -40, obstaclePrefix: 'level-1/' },
  ];
  const compactWorldTourPositions = [];
  for (const stop of compactWorldTour) {
    const position = await runInPage(client, `globalThis.__hmhVisualDebugTeleport?.(${stop.x}, ${stop.y})`);
    if (!position || Math.abs(position.x - stop.x) > 0.25 || Math.abs(position.y - stop.y) > 0.25) {
      throw new Error(`HMH compact-world visual tour could not reach ${stop.name}: ${JSON.stringify(position)}`);
    }
    if (!position.objectCount || position.decodedCount !== position.objectCount || position.renderEntryCount < 1 || position.renderEntryCount > position.obstacleCount) {
      throw new Error(`HMH compact-world visual tour did not render a bounded visible scene at ${stop.name}: ${JSON.stringify(position)}`);
    }
    if (stop.prefix && !position.assetKeys?.some((key) => key.startsWith(stop.prefix))) {
      throw new Error(`HMH compact-world visual tour did not expose ${stop.prefix} at ${stop.name}: ${JSON.stringify(position)}`);
    }
    if (stop.obstaclePrefix && !position.obstacleAssetKeys?.some((key) => key.startsWith(stop.obstaclePrefix))) {
      throw new Error(`HMH compact-world boundary tour did not expose ${stop.obstaclePrefix} at ${stop.name}: ${JSON.stringify(position)}`);
    }
    if (stop.requireBridge) {
      await sleep(250);
      const bridgeProfile = await runInPage(client, `globalThis.__hmhVisualDebugPerformance?.()`);
      if (!(bridgeProfile?.groundRender?.terrainPresentationStats?.bridgeLightingCells > 0)) {
        throw new Error(`HMH bridge tour did not render authored bridge deck lighting at ${stop.name}: ${JSON.stringify(bridgeProfile)}`);
      }
    }
    compactWorldTourPositions.push({ ...stop, ...position });
    await sleep(900);
    captures.push(await writeEvidenceCapture(client, stop.name));
  }

  await runInPage(client, `globalThis.__hmhVisualDebugNudge?.(-4, 0)`);
  await sleep(250);
  const boundaryProbe = await runInPage(client, `globalThis.__hmhVisualDebugPerformance?.()`);
  if (!boundaryProbe?.player?.boundaryClamped || boundaryProbe.player.x < -7.581) {
    throw new Error(`HMH west world boundary did not retain the complete player footprint: ${JSON.stringify(boundaryProbe)}`);
  }

  const levelUpViewportProbe = [];
  const probeLevelUpViewport = async ({ name, width, height, orientation }) => {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
      screenOrientation: { type: orientation, angle: orientation === 'portraitPrimary' ? 0 : 90 },
    });
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await sleep(450);
    const data = await runInPage(client, `
      (() => {
        const overlay = document.getElementById('levelUpOverlay');
        const rect = overlay?.getBoundingClientRect();
        const cardStack = overlay?.querySelector('.level-up-card-stack');
        const buttons = [...(overlay?.querySelectorAll('[data-level-up-choice]') ?? [])];
        const style = cardStack ? getComputedStyle(cardStack) : null;
        return {
          viewport: { width: innerWidth, height: innerHeight },
          layout: overlay?.dataset.layout ?? null,
          armed: overlay?.dataset.armed ?? null,
          overlay: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
          cardCount: buttons.length,
          buttonsEnabled: buttons.every((button) => !button.disabled),
          columns: style?.gridTemplateColumns?.split(' ').filter(Boolean).length ?? 0,
          cardsScrollable: Boolean(cardStack && cardStack.scrollHeight >= cardStack.clientHeight),
          touchControlsHidden: getComputedStyle(document.getElementById('touchControls')).display === 'none',
          bodyOverflow: getComputedStyle(document.body).overflow,
        };
      })()
    `);
    const tolerance = 1;
    const inViewport = data?.overlay
      && data.overlay.left >= -tolerance
      && data.overlay.top >= -tolerance
      && data.overlay.right <= width + tolerance
      && data.overlay.bottom <= height + tolerance;
    const choicesArmed = data.armed === 'true';
    if (!inViewport || data.cardCount !== 2 || !choicesArmed || !data.buttonsEnabled || !data.touchControlsHidden || data.bodyOverflow !== 'hidden') {
      throw new Error(`HMH ${name} level-up layout failed: ${JSON.stringify(data)}`);
    }
    levelUpViewportProbe.push({ name, ...data });
    captures.push(await writeEvidenceCapture(client, name));
  };

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(350);
  const levelUpOpened = await runInPage(client, `globalThis.__hmhVisualDebugOpenLevelUp?.()`);
  if (!levelUpOpened?.choices?.length) throw new Error(`HMH level-up debug hook did not open a draft: ${JSON.stringify(levelUpOpened)}`);
  await sleep(520);
  await probeLevelUpViewport({ name: 'level-up-portrait-390x844', width: 390, height: 844, orientation: 'portraitPrimary' });
  await probeLevelUpViewport({ name: 'level-up-landscape-844x390', width: 844, height: 390, orientation: 'landscapePrimary' });
  await probeLevelUpViewport({ name: 'level-up-tablet-768x1024', width: 768, height: 1024, orientation: 'portraitPrimary' });

  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
  await sleep(200);
  const levelUpClosed = await runInPage(client, `!document.documentElement.dataset.levelUp && document.getElementById('levelUpOverlay')?.hidden === true`);
  if (!levelUpClosed) throw new Error('HMH level-up keyboard selection did not close the responsive overlay');
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await sleep(350);

  const antiSlide = await runInPage(client, `
    (() => {
      const root = document.getElementById('combatCanvas');
      const rect = root?.getBoundingClientRect?.();
      return {
        canvasWidth: Math.round(rect?.width ?? 0),
        canvasHeight: Math.round(rect?.height ?? 0),
        hasGroundMetrics: Boolean(document.getElementById('tacticalBalanceDebugOverlay')?.textContent?.includes('ground pass')),
        policy: 'WO-65 smoke captures live canvas frames; WO-60 pure invariant locks pattern anchor == rounded tile lattice.',
      };
    })()
  `);
  if (!antiSlide.canvasWidth || !antiSlide.canvasHeight) throw new Error(`Anti-slide probe could not read canvas dimensions: ${JSON.stringify(antiSlide)}`);

  const changed = captures.filter((capture) => capture.status === 'changed');
  const report = { portalUrl, bootResult, propPersistenceProbe, collisionProbe, runtimeProfile, boundaryProbe, levelUpViewportProbe, antiSlide, activeEvidenceDistinct, compactWorldTourPositions, captures };
  await mkdir(currentDir, { recursive: true });
  await writeFile(`${currentDir}/visual-regression-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (changed.length) {
    throw new Error(`Visual regression changed: ${changed.map((capture) => capture.name).join(', ')}. Run npm run visual:accept after reviewing screenshots.`);
  }
} finally {
  client?.close();
  if (!server.killed) server.kill();
  if (!chrome.killed) chrome.kill();
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  if (serverError && process.env.VISUAL_DEBUG_SERVER === '1' && !serverError.includes('Address already in use')) console.warn(serverError.trim());
  if (chromeError && process.env.VISUAL_DEBUG_CHROME === '1') console.warn(chromeError.trim());
}
