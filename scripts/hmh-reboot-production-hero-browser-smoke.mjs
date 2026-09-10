import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { measureHeroBody, assertHeroClearance } from './hmh-hero-browser-geometry.mjs';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { PRODUCTION_HERO_ASSETS, PRODUCTION_HERO_RUNTIME_SCALE } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const actorFlag = process.argv.indexOf('--actor');
const actorId = actorFlag >= 0 ? process.argv[actorFlag + 1] : 'lit-commando';
if (!['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly'].includes(actorId)) throw new Error(`Unsupported production hero smoke actor: ${actorId}`);
const url = `${origin}/hmh-reboot/index.html?telemetry=1&evidenceSafe=1&productionPilot=1&productionHero=${actorId}`;
const evidenceDir = process.env.HMH_HERO_EVIDENCE_DIR ? new URL(`file:///${process.env.HMH_HERO_EVIDENCE_DIR.replaceAll('\\', '/')}/`) : new URL('../.hermes/evidence/hmh-reboot-phase20-production-hero/', import.meta.url);
const reportUrl = new URL(`${actorId}-browser.json`, evidenceDir);
await mkdir(evidenceDir, { recursive: true });

const launchBrowser = () => chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const metadataUrl = `${origin}/assets/generated/hmh-reboot-production-heroes/${actorId}/${actorId}-production-pilot-atlas.json`;
const metadataResponse = await fetch(metadataUrl);
assert.equal(metadataResponse.status, 200, 'served hero metadata must exist');
const metadata = await metadataResponse.json();
const framesById = new Map(metadata.frames.map((frame) => [frame.id, frame]));
const textured = PRODUCTION_HERO_ASSETS[actorId].artSource === 'packed-textured-blend';

function bodyMeasurement(state) {
  const body = state.frameIds.map((id) => framesById.get(id)).filter((frame) => frame && ['lower-body', 'torso-head'].includes(frame.layer));
  assert.equal(body.length, 2, 'measure both actually selected body layers, not weapon/shadow/padding');
  const bounds = body.map((frame) => {
    const scale = 160 / frame.sourceSize.h * PRODUCTION_HERO_RUNTIME_SCALE;
    const top = (frame.spriteSourceSize.y + (frame.trim?.y ?? 0) - frame.sourcePivot.y) * scale;
    return { top, bottom: top + frame.frame.h * scale };
  });
  const worldHeight = Math.max(...bounds.map((box) => box.bottom)) - Math.min(...bounds.map((box) => box.top));
  const screenHeight = worldHeight * state.cameraZoom;
  return { worldHeight, screenHeight, viewportHeight: state.viewportHeight, viewportRatio: screenHeight / state.viewportHeight };
}

function assertReadable(state) {
  const measured = bodyMeasurement(state);
  // cameraZoom telemetry is rounded to three decimals. This tolerance covers
  // only that half-unit rounding, not a layout/size or changed-pixel waiver.
  const rounding = measured.worldHeight * 0.0005 / measured.viewportHeight;
  assert.ok(measured.viewportRatio + rounding >= 0.12, `hero body is below 12% of viewport: ${JSON.stringify(measured)}`);
  return measured;
}

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
  cameraZoom: Number(stage.dataset.cameraZoom),
  actorScreenX: Number(stage.dataset.actorScreenX),
  actorScreenY: Number(stage.dataset.actorScreenY),
  actorScreenScale: Number(stage.dataset.actorScreenScale),
  viewportWidth: window.innerWidth,
  viewportHeight: window.innerHeight,
  hintVisible: document.querySelector('#hmhControlsHint')?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) === true,
  overlays: [...document.querySelectorAll('.hmh-run-rail, .hmh-reboot-status-card, .hmh-controls-hint, [data-hmh-control]')]
    .filter((element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    .map((element) => ({ id: element.id || element.dataset.hmhControl || element.className, ...element.getBoundingClientRect().toJSON() })),
}));

async function assertFirstFrameClearance(page) {
  const state = await readState(page);
  assert.equal(state.hintVisible, true, 'normal initial evidence must retain the first-use hint');
  const body = measureHeroBody(state, framesById);
  await page.screenshot({ path: fileURLToPath(new URL(`${actorId}-${state.viewportWidth}x${state.viewportHeight}-initial.png`, evidenceDir)), fullPage: true });
  await writeFile(new URL(`${actorId}-${state.viewportWidth}x${state.viewportHeight}-initial.json`, evidenceDir), `${JSON.stringify({ state, body }, null, 2)}\n`);
  assertHeroClearance(body, state.overlays, state);
}

async function ready(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction((expectedActor) => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.actorArt === 'production-hero-atlas' && stage.dataset.actorArtActor === expectedActor;
  }, actorId);
  await page.waitForFunction(() => String(document.querySelector('#hmhRebootStage')?.dataset.actorArtFrameIds ?? '').split(',').filter(Boolean).length === 4);
  assert.equal(await page.locator('html').getAttribute('data-debug-hud'), '0', 'visual proof must use the shipped HUD, not debug HUD relocation');
  await assertFirstFrameClearance(page);
  await page.locator('canvas').focus();
}

async function desktopEvidence(page, name) {
  const diagnostics = collectDiagnostics(page);
  await ready(page);
  const initial = await readState(page);
  assert.equal(initial.actorArtSource, textured ? 'packed-textured-blend' : 'production-blender-atlas-v1');
  assert.equal(initial.actorArtActor, actorId);
  assert.ok(initial.frameIds.every((id) => id.startsWith(`${actorId}__`)));
  assert.equal(initial.actorArtLayers, 'shadow,lower-body,torso-head,weapon');
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  // Keep the evidence cursor well inside a diagonal aim sector. Exact horizontal
  // placement sits on a quantization boundary where normal camera interpolation
  // can alternate east and south-east while only movement input changes.
  await page.mouse.move(canvas.x + canvas.width * 0.82, canvas.y + canvas.height * 0.32);
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
  const lowerBodyDirections = new Set(movementSamples.flatMap((sample) => sample.frameIds.filter((id) => id.includes('__lower-body__run__')).map((id) => id.split('__')[3])));
  assert.deepEqual([...lowerBodyDirections], ['south'], 'production lower body did not preserve south movement heading');
  const torsoDirections = new Set(movementSamples.flatMap((sample) => sample.frameIds.filter((id) => id.includes('__torso-head__aim__')).map((id) => id.split('__')[3])));
  assert.ok(torsoDirections.size >= 1 && torsoDirections.size <= 2, `production torso aim sectors were missing or unstable: ${[...torsoDirections]}`);
  assert.ok([...torsoDirections].every((direction) => !direction.startsWith('south')), `production torso followed south movement instead of independent aim: ${[...torsoDirections]}`);
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
  const bodyMeasurements = [initial, ...movementSamples, ...fireSamples].map(assertReadable);

  await page.screenshot({ path: fileURLToPath(new URL(`${actorId}-production-hero-${name}.png`, evidenceDir)), fullPage: true });
  assert.deepEqual(diagnostics.errors, []);
  assert.deepEqual(diagnostics.failedRequests, []);
  assert.ok(diagnostics.assetResponses.some((response) => response.url.endsWith(`${actorId}-production-pilot-atlas.json`) && response.status === 200));
  const expectedAtlasSuffix = textured ? '.webp' : '.png';
  assert.ok(diagnostics.assetResponses.some((response) => response.url.endsWith(`${actorId}-production-pilot-atlas${expectedAtlasSuffix}`) && response.status === 200));
  return { initial, moving, lowerFrames: [...lowerFrames].sort(), torsoDirections: [...torsoDirections], fireSamples, bodyMeasurements, ...diagnostics };
}

async function mobileEvidence(page, name) {
  const diagnostics = collectDiagnostics(page);
  await ready(page);
  const state = await readState(page);
  const controlIds = await page.locator('[data-hmh-control]').evaluateAll(elements => elements.map(element => element.dataset.hmhControl).sort());
  assert.deepEqual(controlIds, ['aim', 'move', 'pause', 'power']);
  const controls = controlIds.length;
  assert.equal(state.frameIds.length, 4);
  assert.equal(state.actorArt, 'production-hero-atlas');
  const bodyMeasurements = [assertReadable(state)];
  const controlBoxes = await page.locator('[data-hmh-control]').evaluateAll((elements) => elements.map((element) => ({ id: element.dataset.hmhControl, ...element.getBoundingClientRect().toJSON() })));
  const hud = await page.locator('#hmhHud').boundingBox();
  const viewport = page.viewportSize();
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  for (const [index, box] of controlBoxes.entries()) {
    assert.ok(box.width >= 44 && box.height >= 44, `${box.id} is not a 44px target`);
    assert.ok(box.x >= 0 && box.y >= 0 && box.right <= viewport.width && box.bottom <= viewport.height, `${box.id} escaped viewport`);
    assert.ok(!overlaps(box, hud), `${box.id} is visually obscured by HUD`);
    for (const other of controlBoxes.slice(index + 1)) assert.ok(!overlaps(box, other), `${box.id} overlaps ${other.id}`);
  }
  await page.screenshot({ path: fileURLToPath(new URL(`${actorId}-production-hero-${name}.png`, evidenceDir)), fullPage: true });
  assert.deepEqual(diagnostics.errors, []);
  assert.deepEqual(diagnostics.failedRequests, []);
  return { state, controls, controlBoxes, bodyMeasurements, ...diagnostics };
}

const allProfiles = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ultrawide', width: 3440, height: 1440 },
  { name: 'tablet', width: 1024, height: 768, touch: true },
  { name: 'mobile', width: 390, height: 844, touch: true },
  { name: 'mobile-landscape', width: 844, height: 390, touch: true },
];
const requestedProfiles = process.env.HMH_HERO_PROFILES?.split(',');
if (requestedProfiles) assert.ok(requestedProfiles.length && requestedProfiles.every((name) => allProfiles.some((p) => p.name === name)) && new Set(requestedProfiles).size === requestedProfiles.length, 'profile selection must name distinct supported profiles');
const profiles = requestedProfiles ? allProfiles.filter((p) => requestedProfiles.includes(p.name)) : allProfiles;
const report = { url, actorId, expectedProfileCount: profiles.length, profiles: [] };
for (const profile of profiles) {
  // N-8: separate browser/GPU processes, not merely new pages or contexts.
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1, isMobile: Boolean(profile.touch), hasTouch: Boolean(profile.touch), serviceWorkers: 'block' });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const result = profile.touch ? await mobileEvidence(page, profile.name) : await desktopEvidence(page, profile.name);
    report.profiles.push({ name: profile.name, ...result });
  } finally {
    await browser.close();
  }
  // Save every completed profile so a late failure cannot erase earlier proof.
  await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
assert.equal(report.profiles.length, report.expectedProfileCount);
console.log(JSON.stringify(report, null, 2));
