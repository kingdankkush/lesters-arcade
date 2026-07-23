import assert from 'node:assert/strict';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const tempDir = new URL('../apps/portal/.tmp/', import.meta.url);
const hostPage = new URL('hmh-reboot-embedded-smoke.html', tempDir);
const sdkTempDir = new URL('../apps/portal/sdk/', import.meta.url);
const sdkProtocol = new URL('../sdk/hmh-bridge-protocol.mjs', import.meta.url);
const evidenceDir = new URL('../.hermes/evidence/hmh-reboot-phase17-world/', import.meta.url);
await mkdir(tempDir, { recursive: true });
await mkdir(sdkTempDir, { recursive: true });
await mkdir(evidenceDir, { recursive: true });
await copyFile(sdkProtocol, new URL('hmh-bridge-protocol.mjs', sdkTempDir));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<title>HMH reboot embedded smoke</title>
<style>html,body,#mount{width:100%;height:100%;margin:0;background:#06141d}.hmh-reboot-frame{width:100%;height:100%;border:0;display:block}</style>
</head>
<body>
<div id="mount"></div>
<script type="module">
import { createHmhRebootHost } from '/src/hmh-reboot-host.mjs';
const report = { ready: 0, states: 0, errors: [], exits: 0 };
window.hmhEmbeddedReport = report;
const host = createHmhRebootHost({
  mount: document.querySelector('#mount'),
  expectedOrigin: location.origin,
  onReady() { report.ready += 1; document.body.dataset.ready = 'true'; },
  onState(message) { report.states += 1; report.lastStateType = message.type; },
  onError(error) { report.errors.push(error.message); document.body.dataset.error = error.message; },
  onExit() { report.exits += 1; },
});
window.hmhEmbeddedHost = host;
host.mountSession({
  sessionId: 'embedded-smoke-session-0001',
  gameId: 'lester-blaster',
  mode: 'free',
  heroId: 'lit-commando',
  profile: { displayName: 'Embedded Smoke', locale: 'en' },
  session: { seed: 178913641, buildHash: 'phase17-embedded-smoke', seasonId: 'season-1', rankedEligible: false },
  settings: { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false },
});
</script>
</body>
</html>`;
await writeFile(hostPage, html);

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  await page.goto(`${origin}/.tmp/hmh-reboot-embedded-smoke.html`, { waitUntil: 'networkidle' });
  try {
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      bodyDataset: { ...document.body.dataset },
      hostReport: window.hmhEmbeddedReport ?? null,
      frameUrls: Array.from(document.querySelectorAll('iframe')).map((frame) => frame.src),
    }));
    throw new Error(`${error.message}; diagnostic=${JSON.stringify({ ...diagnostic, errors })}`);
  }
  const iframe = page.locator('iframe[data-runtime="hmh-reboot"]');
  await iframe.waitFor();
  assert.equal(await iframe.getAttribute('sandbox'), 'allow-scripts allow-same-origin allow-pointer-lock');
  assert.equal(await iframe.getAttribute('allow'), 'fullscreen; gamepad');
  assert.equal(new URL(await iframe.getAttribute('src')).pathname, '/hmh-reboot/index.html');

  const child = page.frames().find((frame) => new URL(frame.url()).pathname === '/hmh-reboot/index.html');
  assert.ok(child, 'embedded child frame did not load');
  try {
    await child.waitForFunction(() => document.querySelector('#hmhRebootStage canvas'));
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({ report: window.hmhEmbeddedReport, frameCount: document.querySelectorAll('iframe').length }));
    throw new Error(`${error.message}; postReadyDiagnostic=${JSON.stringify({ diagnostic, errors })}`);
  }
  assert.equal(await child.locator('#hmhRebootStatus').textContent(), 'Portal session connected');

  await page.evaluate(() => window.hmhEmbeddedHost.pause());
  await child.waitForFunction(() => document.querySelector('#hmhRebootStatus')?.textContent === 'Portal session paused');
  await page.evaluate(() => window.hmhEmbeddedHost.resume());
  await page.waitForTimeout(500);
  const resumedStatus = await child.locator('#hmhRebootStatus').textContent();
  assert.equal(resumedStatus, 'Portal session connected');

  await page.screenshot({ path: fileURLToPath(new URL('embedded-desktop.png', evidenceDir)), fullPage: true });
  const hostReport = await page.evaluate(() => window.hmhEmbeddedReport);
  assert.equal(hostReport.ready, 1);
  assert.ok(hostReport.states >= 1);
  assert.deepEqual(hostReport.errors, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ iframe: { sandbox: await iframe.getAttribute('sandbox'), allow: await iframe.getAttribute('allow') }, host: hostReport, child: { canvas: true, lifecycle: 'pause-resume' }, errors }, null, 2));
} finally {
  await browser.close();
  await rm(hostPage, { force: true });
  await rm(sdkTempDir, { recursive: true, force: true });
}
