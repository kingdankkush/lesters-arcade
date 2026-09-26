// HMH restart and hero-switch leak probe.
//
// node scripts/hmh-restart-leak-probe.mjs [--rounds=5] [--ticks=900] [--out=<json>]
// node scripts/hmh-restart-leak-probe.mjs --long=1 [--rounds=6] [--ticks=3600] [--query=evidenceSafe=1]
//
// Serves apps/portal (and /sdk) itself, mounts the child under a same-origin
// host page that speaks the real hmh-bridge/v1 parent protocol, and records
// retained JS heap (after forced GC), DOM counters and, in --long mode, the
// renderer and GPU processes' private memory between rounds of:
//   A) portal:restart inside one child (the in-child restart path);
//   B) re-mounts with a different hero each time: the portal disposes the
//      child and mounts a new iframe for Play Again and for a hero change;
//   --long) one run, sampled every --ticks ticks (where soak growth accrues).
// Level-up cards are picked like the crowd bench does. One browser at a time;
// PLAYWRIGHT_PACKAGE_PATH points at a playwright build (see the crowd bench).
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORTAL = path.join(ROOT, 'apps/portal');
const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=')]; }));
const rounds = Number(args.rounds ?? 6);
const ticks = Number(args.ticks ?? 900);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.map': 'application/json' };

const HOST = `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#06141d}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><script type="module">
import { createHmhParentBridge } from '/src/hmh-reboot-bridge.mjs';
const probe = window.__probe = { mounts: 0, errors: [], messages: 0 };
let iframe = null, bridge = null;
probe.mount = (heroId, query) => new Promise((resolve) => {
  try { bridge?.destroy(); } catch (error) { probe.errors.push('destroy: ' + error.message); }
  iframe?.remove();
  iframe = document.createElement('iframe');
  iframe.src = '/hmh-reboot/index.html?' + query;
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
  iframe.setAttribute('allow', 'autoplay');
  document.body.append(iframe);
  probe.mounts += 1;
  const session = { sessionId: 'restart-leak-probe-' + probe.mounts, gameId: 'lester-blaster', mode: 'free', heroId,
    profile: { displayName: 'Leak Probe', locale: 'en' },
    session: { seed: 1213024260, buildHash: 'leak-probe', seasonId: 'season-1', rankedEligible: false },
    settings: { musicEnabled: false, screenShake: true, gore: true, reduceMotion: false, reduceFlash: false, colorblindTags: false } };
  bridge = createHmhParentBridge({ iframe, expectedOrigin: location.origin, session,
    onMessage() { probe.messages += 1; }, onProtocolError(error) { probe.errors.push(error.message); } });
  iframe.addEventListener('load', () => { bridge.connect(); resolve(); }, { once: true });
});
probe.restart = () => bridge.send('portal:restart', {});
probe.pickUpgrade = () => {
  const panel = iframe?.contentDocument?.querySelector('#hmhUpgradePanel');
  const button = panel && !panel.hidden ? panel.querySelector('button') : null;
  button?.click();
  return Boolean(button);
};
probe.tick = () => Number(iframe?.contentDocument?.querySelector('#hmhRebootStage')?.dataset.simulationStepsTotal ?? 0);
probe.state = () => ({ ...(iframe?.contentDocument?.querySelector('#hmhRebootStage')?.dataset ?? {}) });
</script></body></html>`;

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  if (url.pathname === '/__probe/host.html') { response.writeHead(200, { 'content-type': TYPES['.html'] }); response.end(HOST); return; }
  const base = path.resolve(url.pathname.startsWith('/sdk/') ? ROOT : PORTAL);
  const file = path.join(base, decodeURIComponent(url.pathname));
  if (!file.startsWith(base) || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'max-age=3600', 'content-length': statSync(file).size });
  createReadStream(file).pipe(response);
});
server.keepAliveTimeout = 60_000;
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'],
});
const report = { ticks, rounds, restart: [], remount: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(`console: ${message.text()}`); });
  const cdp = await context.newCDPSession(page);
  await page.goto(`${origin}/__probe/host.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__probe), null, { timeout: 30_000 }).catch((error) => { console.log('probe missing', report.errors); throw error; });
  const query = 'evidenceSafe=1&endurancePressurePilot=1';
  const waitTick = async (target, label) => {
    const deadline = Date.now() + 240_000;
    for (;;) {
      await page.evaluate(() => window.__probe.pickUpgrade()).catch(() => false);
      const tick = await page.evaluate(() => window.__probe.tick()).catch(() => 0);
      if (tick >= target) return tick;
      if (Date.now() > deadline) throw new Error(`${label}: tick ${tick} < ${target}`);
      await page.waitForTimeout(250);
    }
  };
  const sample = async (label) => {
    for (let pass = 0; pass < 3; pass += 1) await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(300);
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    const stage = await page.evaluate(() => window.__probe.state()).catch(() => ({}));
    const row = { label, usedMB: +(heap.usedSize / 1048576).toFixed(2), totalMB: +(heap.totalSize / 1048576).toFixed(2), documents: dom.documents, nodes: dom.nodes, listeners: dom.jsEventListeners, tick: Number(stage.simulationStepsTotal ?? 0), displaysCreated: stage.enemyDisplaysCreated ?? null };
    console.log(JSON.stringify(row));
    return row;
  };
  // Process memory (private bytes) of this browser's renderer and GPU processes.
  const processMemory = async () => {
    const session = await browser.newBrowserCDPSession();
    const { processInfo } = await session.send('SystemInfo.getProcessInfo');
    await session.detach();
    const ids = processInfo.filter((entry) => ['renderer', 'GPU'].includes(entry.type)).map((entry) => `${entry.type}:${entry.id}`);
    const { spawnSync } = await import('node:child_process');
    const script = ids.map((entry) => { const [, id] = entry.split(':'); return `try { $p = Get-Process -Id ${id} -ErrorAction Stop; '${entry}=' + $p.PrivateMemorySize64 } catch {}`; }).join('; ');
    const out = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }).stdout;
    const totals = {};
    for (const line of out.split(/\r?\n/)) { const match = /^(\w+):\d+=(\d+)$/.exec(line.trim()); if (match) totals[match[1]] = (totals[match[1]] ?? 0) + Number(match[2]) / 1048576; }
    return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, +value.toFixed(1)]));
  };
  if (args.long) {
    // C) one long run, retained heap every `ticks` ticks
    await page.evaluate((q) => window.__probe.mount('lit-commando', q), String(args.query ?? 'evidenceSafe=1'));
    report.long = [];
    for (let round = 1; round <= rounds; round += 1) {
      await waitTick(ticks * round, `long ${round}`);
      const row = { ...(await sample(`long ${round}`)), process: await processMemory() };
      console.log(JSON.stringify(row.process));
      report.long.push(row);
    }
  } else {
  // A) in-child restarts
  await page.evaluate((q) => window.__probe.mount('lit-commando', q), query);
  await waitTick(ticks, 'first run');
  report.restart.push(await sample('run 0'));
  for (let round = 1; round <= rounds; round += 1) {
    await page.evaluate(() => window.__probe.restart());
    await page.waitForTimeout(500);
    await waitTick(ticks, `restart ${round}`);
    report.restart.push(await sample(`restart ${round}`));
  }
  // B) remounts with a hero switch each time
  const heroes = ['lit-valkyrie', 'lilly', 'lester-original', 'lit-commando'];
  for (let round = 0; round < rounds; round += 1) {
    const hero = heroes[round % heroes.length];
    await page.evaluate(([h, q]) => window.__probe.mount(h, q), [hero, query]);
    await waitTick(ticks, `mount ${hero}`);
    report.remount.push(await sample(`mount ${round + 1} ${hero}`));
  }
  }
  report.errors.push(...(await page.evaluate(() => window.__probe.errors)));
} finally {
  await browser.close();
  server.close();
}
if (args.out) await writeFile(args.out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ errors: report.errors }, null, 2));
