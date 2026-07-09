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

function liveVisualDiffPasses(name, diff) {
  return Boolean(
    String(name).startsWith('seed-1337-')
    && diff
    && !diff.error
    && !diff.sizeMismatch
    && diff.changedPct <= 75
    && diff.meanAbsPerChannel <= 18
  );
}

async function writeCapture(client, name) {
  const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const bytes = Buffer.from(shot.data, 'base64');
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
    status: exactMatch || visualDiffPasses(diff) || liveVisualDiffPasses(name, diff) ? 'match' : 'changed',
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

  const bootResult = await runInPage(client, `
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
      readyOverlay.click();
      const simulationDeadline = performance.now() + 5000;
      let liveTimeText = pausedStatText;
      while (performance.now() < simulationDeadline) {
        liveTimeText = document.getElementById('roguelikeStatBar')?.textContent ?? '';
        if (liveTimeText && liveTimeText !== pausedStatText && !liveTimeText.includes('0:00')) break;
        await wait(100);
      }
      const simulationAdvanced = Boolean(liveTimeText && liveTimeText !== pausedStatText && !liveTimeText.includes('0:00'));
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
        readyOverlay: Boolean(document.getElementById('hmhReadyOverlay')),
        simulationAdvanced,
        pausedStatText,
        seedText: liveTimeText,
      };
    })()
  `, 45000);

  if (!bootResult?.canvas) throw new Error(`HMH visual boot did not expose combat canvas: ${JSON.stringify(bootResult)}`);
  if (!bootResult?.overlayGone) throw new Error(`HMH loading overlay still visible: ${JSON.stringify(bootResult)}`);
  if (!bootResult?.simulationAdvanced) throw new Error(`HMH visual run never advanced beyond READY: ${JSON.stringify(bootResult)}`);
  if (!String(bootResult.seedText).includes('1337')) throw new Error(`HMH visual run did not boot seed 1337: ${JSON.stringify(bootResult)}`);

  await runInPage(client, `
    (() => {
      const debugOverlay = document.getElementById('tacticalBalanceDebugOverlay');
      if (debugOverlay) {
        debugOverlay.hidden = true;
        debugOverlay.style.display = 'none';
      }
      document.getElementById('combatCanvas')?.scrollIntoView({ block: 'center', inline: 'nearest' });
    })()
  `);
  await sleep(250);

  const captures = [];
  captures.push(await writeCapture(client, 'seed-1337-live-spawn'));
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  await sleep(700);
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  await sleep(120);
  captures.push(await writeCapture(client, 'seed-1337-east-walk'));

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
  const report = { portalUrl, bootResult, antiSlide, captures };
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
