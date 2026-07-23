import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const url = `${origin}/hmh-reboot/index.html?debugGrid=1&evidenceSafe=1&pipelinePilot=1`;
const evidenceDir = new URL('../.hermes/evidence/hmh-reboot-phase19-blender/', import.meta.url);
const reportUrl = new URL('../.tmp/hmh-reboot-phase19-browser-pilot.json', import.meta.url);
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

function collectDiagnostics(page) {
  const errors = [];
  const failedRequests = [];
  const assetResponses = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('response', (response) => {
    if (response.url().includes('hmh-reboot-mannequin')) assetResponses.push({ url: response.url(), status: response.status() });
  });
  return { errors, failedRequests, assetResponses };
}

const readState = (page) => page.locator('#hmhRebootStage').evaluate((stage) => ({
  actorArt: stage.dataset.actorArt,
  actorArtSource: stage.dataset.actorArtSource,
  actorArtLayers: stage.dataset.actorArtLayers,
  frameIds: String(stage.dataset.actorArtFrameIds ?? '').split(',').filter(Boolean),
  simulationTick: Number(stage.dataset.simulationTick),
  actorX: Number(stage.dataset.actorX),
  actorY: Number(stage.dataset.actorY),
}));

async function ready(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.actorArt === 'pipeline-pilot-human-atlas');
  await page.waitForFunction(() => String(document.querySelector('#hmhRebootStage')?.dataset.actorArtFrameIds ?? '').split(',').filter(Boolean).length === 4);
  await page.locator('canvas').focus();
}

async function desktopEvidence() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const diagnostics = collectDiagnostics(page);
  await ready(page);
  const initial = await readState(page);
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  await page.mouse.move(canvas.x + canvas.width * 0.82, canvas.y + canvas.height * 0.5);
  await page.keyboard.down('KeyS');
  const samples = [];
  for (let index = 0; index < 8; index += 1) {
    await page.waitForTimeout(90);
    samples.push(await readState(page));
  }
  await page.keyboard.up('KeyS');
  const moving = samples.find((sample) => sample.frameIds.some((id) => id.includes('__lower-body__run__')));
  assert.ok(moving, 'runtime never selected a lower-body run frame');
  const lowerFrames = new Set(samples.flatMap((sample) => sample.frameIds.filter((id) => id.includes('__lower-body__run__'))));
  assert.ok(lowerFrames.size >= 2, `expected animated lower-body frames, received ${[...lowerFrames]}`);
  const torsoDirections = new Set(samples.flatMap((sample) => sample.frameIds.filter((id) => id.includes('__torso-head__aim__')).map((id) => id.split('__')[3])));
  assert.equal(torsoDirections.size, 1, 'torso direction changed while only movement input changed');
  assert.ok(samples.at(-1).actorY > initial.actorY + 80, 'south movement did not advance the canonical actor');
  await page.screenshot({ path: fileURLToPath(new URL('pipeline-pilot-desktop.png', evidenceDir)), fullPage: true });
  assert.deepEqual(diagnostics.errors, []);
  assert.deepEqual(diagnostics.failedRequests, []);
  assert.ok(diagnostics.assetResponses.some((response) => response.url.endsWith('hmh-reboot-mannequin-atlas.json') && response.status === 200));
  assert.ok(diagnostics.assetResponses.some((response) => response.url.endsWith('hmh-reboot-mannequin-atlas.png') && response.status === 200));
  await page.close();
  return { initial, moving, lowerFrames: [...lowerFrames].sort(), torsoDirections: [...torsoDirections], ...diagnostics };
}

async function mobileEvidence() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  await ready(page);
  const state = await readState(page);
  const controls = await page.locator('[data-hmh-control]').count();
  assert.equal(controls, 8);
  assert.equal(state.frameIds.length, 4);
  await page.screenshot({ path: fileURLToPath(new URL('pipeline-pilot-mobile.png', evidenceDir)), fullPage: true });
  assert.deepEqual(diagnostics.errors, []);
  assert.deepEqual(diagnostics.failedRequests, []);
  await context.close();
  return { state, controls, ...diagnostics };
}

try {
  const report = { url, desktop: await desktopEvidence(), mobile: await mobileEvidence() };
  await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
