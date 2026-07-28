import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const actorFlag = process.argv.indexOf('--actor');
const actorId = actorFlag >= 0 ? process.argv[actorFlag + 1] : 'lit-commando';
if (!['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly'].includes(actorId)) throw new Error(`Unsupported production hero smoke actor: ${actorId}`);
const url = `${origin}/hmh-reboot/index.html?debugGrid=1&evidenceSafe=1&productionPilot=1&productionHero=${actorId}`;
const evidenceDir = new URL('../.hermes/evidence/hmh-reboot-phase20-production-hero/', import.meta.url);
const reportUrl = new URL(`../.tmp/hmh-reboot-production-hero-browser-${actorId}.json`, import.meta.url);
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
    if (response.url().includes('hmh-reboot-production-heroes')) assetResponses.push({ url: response.url(), status: response.status() });
  });
  return { errors, failedRequests, assetResponses };
}

const readState = (page) => page.locator('#hmhRebootStage').evaluate((stage) => ({
  actorArt: stage.dataset.actorArt,
  actorArtSource: stage.dataset.actorArtSource,
  actorArtActor: stage.dataset.actorArtActor,
  actorArtLayers: stage.dataset.actorArtLayers,
  frameIds: String(stage.dataset.actorArtFrameIds ?? '').split(',').filter(Boolean),
  simulationTick: Number(stage.dataset.simulationTick),
  actorX: Number(stage.dataset.actorX),
  actorY: Number(stage.dataset.actorY),
  lastWeaponFire: stage.dataset.lastWeaponFire,
}));

async function ready(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction((expectedActor) => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.actorArt === 'production-hero-atlas' && stage.dataset.actorArtActor === expectedActor;
  }, actorId);
  await page.waitForFunction(() => String(document.querySelector('#hmhRebootStage')?.dataset.actorArtFrameIds ?? '').split(',').filter(Boolean).length === 4);
  await page.locator('canvas').focus();
}

async function desktopEvidence() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const diagnostics = collectDiagnostics(page);
  await ready(page);
  const initial = await readState(page);
  assert.equal(initial.actorArtSource, 'production-blender-atlas-v1');
  assert.equal(initial.actorArtActor, actorId);
  assert.ok(initial.frameIds.every((id) => id.startsWith(`${actorId}__`)));
  assert.equal(initial.actorArtLayers, 'shadow,lower-body,torso-head,weapon');
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  await page.mouse.move(canvas.x + canvas.width * 0.82, canvas.y + canvas.height * 0.5);
  await page.keyboard.down('KeyS');
  const movementSamples = [];
  for (let index = 0; index < 8; index += 1) {
    await page.waitForTimeout(90);
    movementSamples.push(await readState(page));
  }
  await page.keyboard.up('KeyS');
  const moving = movementSamples.find((sample) => sample.frameIds.some((id) => id.includes('__lower-body__run__')));
  assert.ok(moving, 'runtime never selected a production lower-body run frame');
  const lowerFrames = new Set(movementSamples.flatMap((sample) => sample.frameIds.filter((id) => id.includes('__lower-body__run__'))));
  assert.ok(lowerFrames.size >= 3, `expected production run animation, received ${[...lowerFrames]}`);
  const torsoDirections = new Set(movementSamples.flatMap((sample) => sample.frameIds.filter((id) => id.includes('__torso-head__aim__')).map((id) => id.split('__')[3])));
  assert.equal(torsoDirections.size, 1, 'production torso direction changed while only movement input changed');
  assert.ok(movementSamples.at(-1).actorY > initial.actorY + 80, 'south movement did not advance the canonical actor');

  await page.mouse.down();
  const fireSamples = [];
  for (let index = 0; index < 6; index += 1) {
    await page.waitForTimeout(45);
    fireSamples.push(await readState(page));
  }
  await page.mouse.up();
  assert.ok(fireSamples.some((sample) => sample.lastWeaponFire === 'coin-blaster'), 'canonical pistol did not fire');
  assert.ok(fireSamples.some((sample) => sample.frameIds.some((id) => id.includes('__torso-head__pistol-fire__'))), 'production torso fire animation was never selected');
  assert.ok(fireSamples.some((sample) => sample.frameIds.some((id) => id.includes('__weapon__pistol-fire__'))), 'production weapon fire animation was never selected');

  await page.screenshot({ path: fileURLToPath(new URL(`${actorId}-production-hero-desktop.png`, evidenceDir)), fullPage: true });
  assert.deepEqual(diagnostics.errors, []);
  assert.deepEqual(diagnostics.failedRequests, []);
  assert.ok(diagnostics.assetResponses.some((response) => response.url.endsWith(`${actorId}-production-pilot-atlas.json`) && response.status === 200));
  assert.ok(diagnostics.assetResponses.some((response) => response.url.endsWith(`${actorId}-production-pilot-atlas.png`) && response.status === 200));
  await page.close();
  return { initial, moving, lowerFrames: [...lowerFrames].sort(), torsoDirections: [...torsoDirections], fireSamples, ...diagnostics };
}

async function mobileEvidence() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  await ready(page);
  const state = await readState(page);
  const controls = await page.locator('[data-hmh-control]').count();
  assert.equal(controls, 4);
  assert.equal(state.frameIds.length, 4);
  assert.equal(state.actorArt, 'production-hero-atlas');
  await page.screenshot({ path: fileURLToPath(new URL(`${actorId}-production-hero-mobile.png`, evidenceDir)), fullPage: true });
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
