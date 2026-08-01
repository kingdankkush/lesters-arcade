import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const url = `${origin}/hmh-reboot/index.html?debugGrid=1&director=1&boss=1&evidenceSafe=1&weaponPilot=1`;
const evidenceDir = new URL('../.hermes/evidence/hmh-reboot-phase8-combat/', import.meta.url);
const expectedEnemyArchetypes = ['bagholder-rusher', 'forkrunner'];
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const state = (page) => page.locator('#hmhRebootStage').evaluate((stage) => ({
  weaponId: stage.dataset.weaponId,
  actorArt: stage.dataset.actorArt,
  enemyArt: stage.dataset.enemyArt,
  bossArt: stage.dataset.bossArt,
  worldArt: stage.dataset.worldArt,
  worldShader: String(stage.dataset.worldShader || '').split(',').filter(Boolean),
  worldParticles: Number(stage.dataset.worldParticles),
  worldBlockers: Number(stage.dataset.worldBlockers),
  worldLandmarks: Number(stage.dataset.worldLandmarks),
  ammo: Number(stage.dataset.weaponAmmo),
  weaponClipSize: Number(stage.dataset.weaponClipSize),
  weaponStatus: stage.dataset.weaponStatus,
  weaponReloadTicksRemaining: Number(stage.dataset.weaponReloadTicksRemaining),
  lastWeaponFire: stage.dataset.lastWeaponFire,
  lastMeleeTick: stage.dataset.lastMeleeTick,
  lastMeleeHits: Number(stage.dataset.lastMeleeHits),
  grenadeCount: Number(stage.dataset.grenadeCount),
  activeGrenadeWarnings: Number(stage.dataset.activeGrenadeWarnings),
  activeGrenadeWarningRadius: Number(stage.dataset.activeGrenadeWarningRadius),
  activeGrenadeWarningUrgent: Number(stage.dataset.activeGrenadeWarningUrgent),
  handGrenades: Number(stage.dataset.handGrenades),
  lastGrenadeReason: stage.dataset.lastGrenadeReason,
  lastGrenadeTick: stage.dataset.lastGrenadeTick,
  playerHealth: Number(stage.dataset.playerHealth),
  audioVoices: Number(stage.dataset.audioVoices),
  projectileDrops: Number(stage.dataset.projectileDrops),
  actorX: Number(stage.dataset.actorX),
  actorY: Number(stage.dataset.actorY),
  dashReadyTick: Number(stage.dataset.dashReadyTick),
  dashActive: stage.dataset.dashActive === 'true',
  dashInvulnerable: stage.dataset.dashInvulnerable === 'true',
  dashStopReason: stage.dataset.dashStopReason,
  enemyCount: Number(stage.dataset.enemyCount),
  enemyArchetypes: String(stage.dataset.enemyArchetypes || '').split(',').filter(Boolean),
  enemyTells: Number(stage.dataset.enemyTells),
  enemyDecisions: Number(stage.dataset.enemyDecisions),
  enemySafetySteps: Number(stage.dataset.enemySafetySteps),
  enemyAttackDrops: Number(stage.dataset.enemyAttackDrops),
  enemyDeathVisuals: Number(stage.dataset.enemyDeathVisuals),
  enemyEliteVisuals: Number(stage.dataset.enemyEliteVisuals),
  encounterBand: stage.dataset.encounterBand,
  directorInsertions: Number(stage.dataset.directorInsertions),
  directorRejections: Number(stage.dataset.directorRejections),
  bossActive: stage.dataset.bossActive === 'true',
  bossPhase: stage.dataset.bossPhase,
  bossHealth: Number(stage.dataset.bossHealth),
  bossPendingTells: Number(stage.dataset.bossPendingTells),
  bossPendingAttackIds: String(stage.dataset.bossPendingAttackIds || '').split(',').filter(Boolean),
  bossTelegraphPrimitives: Number(stage.dataset.bossTelegraphPrimitives),
  bossAttackDrops: Number(stage.dataset.bossAttackDrops),
  worldId: stage.dataset.worldId,
  worldWidth: Number(stage.dataset.worldWidth),
  worldHeight: Number(stage.dataset.worldHeight),
  districtId: stage.dataset.districtId,
  surfaceId: stage.dataset.surfaceId,
  groundZ: Number(stage.dataset.groundZ),
  revealedCells: Number(stage.dataset.revealedCells),
  revealTotalCells: Number(stage.dataset.revealTotalCells),
  minimapWidth: Number(stage.dataset.minimapWidth),
  minimapHeight: Number(stage.dataset.minimapHeight),
  minimapX: Number(stage.dataset.minimapX),
  minimapY: Number(stage.dataset.minimapY),
}));

async function holdKey(page, key, ms = 120) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function tapTouchControl(page, action, pointerId) {
  const locator = page.locator(`[data-hmh-control="${action}"]`);
  const box = await locator.boundingBox();
  assert.ok(box, `${action} touch button is not laid out`);
  const point = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
  await locator.evaluate((element, input) => {
    element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: input.pointerId,
      pointerType: 'touch',
      clientX: input.x,
      clientY: input.y,
      isPrimary: true,
    }));
  }, { ...point, pointerId });
  await page.waitForTimeout(120);
  await page.evaluate((input) => {
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerId: input.pointerId,
      pointerType: 'touch',
      clientX: input.x,
      clientY: input.y,
      isPrimary: true,
    }));
  }, { ...point, pointerId });
}

async function ready(page, errors, targetUrl = url) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location();
      errors.push(`console: ${message.text()}${location.url ? ` @ ${location.url}` : ''}`);
    }
  });
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster');
  await page.locator('canvas').focus();
}

async function waitForEnemyRoster(page) {
  await page.waitForFunction((expected) => {
    const observed = new Set(String(document.querySelector('#hmhRebootStage')?.dataset.enemyArchetypes || '').split(',').filter(Boolean));
    return expected.every((id) => observed.has(id));
  }, expectedEnemyArchetypes, { timeout: 15000 });
}

async function desktopSmoke() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  await ready(page, errors);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'coin-blaster');
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.enemySafetySteps) > 0, null, { timeout: 3000 });
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.playerHealth) < 100, null, { timeout: 5000 });
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.directorInsertions) > 0, null, { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.bossActive === 'true', null, { timeout: 5000 });
  await page.waitForFunction(() => String(document.querySelector('#hmhRebootStage')?.dataset.bossPendingAttackIds || '')
    .split(',').includes('debt-collection'), null, { timeout: 10000 });
  const debtCollectionTell = await state(page);
  await waitForEnemyRoster(page);
  const pistol = await state(page);

  await holdKey(page, 'Digit2');
  await holdKey(page, 'Space', 180);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'scatter-shotgun');
  const shotgun = await state(page);

  await holdKey(page, 'Digit3');
  await holdKey(page, 'Space', 180);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'auto-miner');
  const machineGun = await state(page);

  await holdKey(page, 'Digit4');
  await holdKey(page, 'Space', 180);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'launcher-rig');
  await page.waitForFunction(() => Boolean(document.querySelector('#hmhRebootStage')?.dataset.lastGrenadeTick));
  const launcher = await state(page);

  await holdKey(page, 'KeyE');
  await page.waitForFunction(() => Boolean(document.querySelector('#hmhRebootStage')?.dataset.lastMeleeTick));
  const melee = await state(page);

  const priorGrenadeTick = melee.lastGrenadeTick;
  await holdKey(page, 'KeyG');
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.activeGrenadeWarnings) > 0);
  const grenadeWarning = await state(page);
  await page.screenshot({ path: fileURLToPath(new URL('desktop-grenade-warning.png', evidenceDir)), fullPage: true });
  await page.waitForFunction((prior) => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.lastGrenadeTick && stage.dataset.lastGrenadeTick !== prior;
  }, priorGrenadeTick, { timeout: 3000 });
  const handGrenade = await state(page);
  const beforeDash = await state(page);
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Shift');
  await page.waitForTimeout(180);
  await page.keyboard.up('Shift');
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.dashReadyTick) > 0);
  const dash = await state(page);
  const dashStatus = await page.locator('#hmhRebootDashStatus').textContent();
  const accessibleStatus = await page.locator('#hmhRebootCombatStatus').evaluate((element) => element.value || element.textContent);
  await page.screenshot({ path: fileURLToPath(new URL('desktop-combat.png', evidenceDir)), fullPage: true });

  assert.equal(pistol.lastWeaponFire, 'coin-blaster');
  assert.deepEqual([...new Set(pistol.enemyArchetypes)].sort(), expectedEnemyArchetypes);
  assert.ok(pistol.enemyCount >= expectedEnemyArchetypes.length && pistol.enemyCount <= 32);
  assert.ok(pistol.playerHealth < 100, 'combat pilot must prove incoming combat pressure');
  assert.ok(pistol.enemySafetySteps > 0 && pistol.enemySafetySteps <= 32);
  assert.equal(pistol.enemyAttackDrops, 0);
  assert.equal(pistol.encounterBand, 'opening');
  assert.ok(pistol.directorInsertions > 0);
  assert.equal(pistol.bossActive, true);
  assert.equal(pistol.bossPhase, 'market-open');
  assert.ok(pistol.bossHealth > 0);
  assert.equal(pistol.bossAttackDrops, 0);
  assert.deepEqual(debtCollectionTell.bossPendingAttackIds, ['debt-collection']);
  assert.equal(debtCollectionTell.bossPendingTells, 1);
  assert.equal(debtCollectionTell.bossTelegraphPrimitives, 1, 'Debt Collection must draw its melee-circle warning');
  assert.equal(pistol.worldId, 'forked-frontier');
  assert.deepEqual([pistol.actorArt, pistol.enemyArt, pistol.bossArt], [
    'production-hero-atlas',
    'production-roster-atlas-v1',
    'production-roster-atlas-v1',
  ]);
  assert.equal(pistol.worldArt, 'production-vector-world-v1');
  assert.deepEqual(pistol.worldShader, ['water-shimmer-v1', 'hazard-pulse-v1', 'beacon-glow-v1', 'edge-vignette-v1']);
  assert.deepEqual([pistol.worldParticles, pistol.worldBlockers, pistol.worldLandmarks], [50, 38, 6]);
  assert.deepEqual([pistol.worldWidth, pistol.worldHeight], [12000, 4800]);
  assert.equal(pistol.districtId, 'frontier-relay');
  assert.ok(pistol.revealedCells > 0 && pistol.revealedCells < pistol.revealTotalCells);
  assert.ok(pistol.minimapWidth > 0 && pistol.minimapHeight > 0 && pistol.minimapX >= 0 && pistol.minimapY >= 0);
  assert.equal(shotgun.lastWeaponFire, 'scatter-shotgun');
  assert.equal(machineGun.lastWeaponFire, 'auto-miner');
  assert.equal(launcher.lastWeaponFire, 'launcher-rig');
  assert.match(launcher.lastGrenadeReason, /impact|fuse/);
  assert.ok(Number(melee.lastMeleeTick) > 0);
  assert.ok(grenadeWarning.grenadeCount > 0);
  assert.equal(grenadeWarning.activeGrenadeWarnings, grenadeWarning.grenadeCount, 'every live grenade needs one truthful warning');
  assert.equal(grenadeWarning.activeGrenadeWarningRadius, 92, 'warning radius must match the authoritative Satoshi Frag radius');
  assert.equal(handGrenade.activeGrenadeWarnings, 0, 'warning must retire with the detonated grenade');
  assert.equal(handGrenade.handGrenades, 2);
  assert.notEqual(handGrenade.lastGrenadeTick, priorGrenadeTick);
  assert.ok(dash.dashReadyTick > 0);
  assert.ok(dash.actorY < beforeDash.actorY - 100, 'keyboard Dash must produce responsive directional displacement');
  assert.match(dashStatus, /Dash (?:active|\d+ seconds)/i);
  assert.ok(['', 'enemy-yield', 'hard-blocker', 'traversal'].includes(dash.dashStopReason), `unexpected authored Dash result ${dash.dashStopReason}`);
  assert.match(accessibleStatus, /rounds.*grenades.*health.*defeats/i);
  assert.match(accessibleStatus, /Dash/i);
  assert.ok(handGrenade.audioVoices <= 16);
  assert.equal(handGrenade.projectileDrops, 0);
  assert.deepEqual(errors, []);
  await page.close();
  return { pistol, debtCollectionTell, shotgun, machineGun, launcher, melee, grenadeWarning, handGrenade, dash, dashStatus, accessibleStatus, errors };
}

async function mobileSmoke() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  await ready(page, errors);
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.enemySafetySteps) > 0, null, { timeout: 3000 });
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.directorInsertions) > 0, null, { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.bossActive === 'true', null, { timeout: 5000 });
  await waitForEnemyRoster(page);
  // Death visuals are transient, so observe from the start of the mobile run
  // rather than beginning a poll after reload/grenade evidence has already
  // allowed an earlier visual to expire.
  const deathVisualObserved = page.waitForFunction(
    () => Number(document.querySelector('#hmhRebootStage')?.dataset.enemyDeathVisuals) > 0,
    null,
    { polling: 50, timeout: 30_000 },
  );
  // Cycle 036: mobile must reach the shared deterministic weapon-next action
  // through a real visible touch control rather than a synthetic keyboard.
  assert.equal(await page.locator('[data-hmh-control]').count(), 5);
  await tapTouchControl(page, 'weapon', 74);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'scatter-shotgun');
  // Force the compact magazine through one cycle, then verify that the same
  // fixed-tick reload state projected into the mobile HUD and telemetry.
  await holdKey(page, 'Space', 1_500);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponStatus === 'reloading', null, { timeout: 5_000 });
  const mobileReload = await state(page);
  assert.equal(mobileReload.weaponClipSize, 2);
  assert.ok(mobileReload.weaponReloadTicksRemaining > 0 && mobileReload.weaponReloadTicksRemaining <= 120);
  await page.screenshot({ path: fileURLToPath(new URL('mobile-weapon-reload.png', evidenceDir)), fullPage: true });
  await holdKey(page, 'KeyE');
  await page.waitForFunction(() => Boolean(document.querySelector('#hmhRebootStage')?.dataset.lastMeleeTick));
  await tapTouchControl(page, 'power', 73);
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.handGrenades) === 2);
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.activeGrenadeWarnings) > 0);
  const mobileGrenadeWarning = await state(page);
  await page.screenshot({ path: fileURLToPath(new URL('mobile-grenade-warning.png', evidenceDir)), fullPage: true });
  await deathVisualObserved;
  const observedDeathVisuals = 1;
  await holdKey(page, 'ShiftLeft');
  await page.waitForFunction(() => Number(document.querySelector('#hmhRebootStage')?.dataset.dashReadyTick) > 0);
  const dashStatus = await page.locator('#hmhRebootDashStatus').textContent();
  const controls = await page.locator('[data-hmh-control]').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { control: element.dataset.hmhControl, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }));
  for (const control of controls) {
    assert.ok(control.left >= 0 && control.top >= 0 && control.right <= 390 && control.bottom <= 844, `${control.control} escaped mobile viewport`);
  }
  for (let index = 0; index < controls.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < controls.length; otherIndex += 1) {
      const a = controls[index];
      const b = controls[otherIndex];
      const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      assert.ok(overlapWidth <= 0 || overlapHeight <= 0, `${a.control} overlaps ${b.control}`);
    }
  }
  const mobileState = await state(page);
  await page.screenshot({ path: fileURLToPath(new URL('mobile-combat.png', evidenceDir)), fullPage: true });
  assert.equal(mobileState.weaponId, 'scatter-shotgun');
  assert.deepEqual([...new Set(mobileState.enemyArchetypes)].sort(), expectedEnemyArchetypes);
  assert.ok(mobileState.enemyCount >= expectedEnemyArchetypes.length && mobileState.enemyCount <= 32);
  assert.ok(mobileState.enemySafetySteps > 0 && mobileState.enemySafetySteps <= 32);
  assert.equal(mobileState.enemyAttackDrops, 0);
  assert.ok(observedDeathVisuals >= 1);
  assert.equal(mobileState.encounterBand, 'opening');
  assert.ok(mobileState.directorInsertions > 0);
  assert.equal(mobileState.bossActive, true);
  assert.equal(mobileState.bossPhase, 'market-open');
  assert.ok(mobileState.bossHealth > 0);
  assert.equal(mobileState.bossAttackDrops, 0);
  assert.equal(mobileState.worldId, 'forked-frontier');
  assert.deepEqual([mobileState.actorArt, mobileState.enemyArt, mobileState.bossArt], [
    'production-hero-atlas',
    'production-roster-atlas-v1',
    'production-roster-atlas-v1',
  ]);
  assert.equal(mobileState.worldArt, 'production-vector-world-v1');
  assert.deepEqual(mobileState.worldShader, ['water-shimmer-v1', 'hazard-pulse-v1', 'beacon-glow-v1', 'edge-vignette-v1']);
  assert.deepEqual([mobileState.worldParticles, mobileState.worldBlockers, mobileState.worldLandmarks], [30, 38, 6]);
  assert.deepEqual([mobileState.worldWidth, mobileState.worldHeight], [12000, 4800]);
  assert.equal(mobileState.districtId, 'frontier-relay');
  assert.ok(mobileState.revealedCells > 0 && mobileState.revealedCells < mobileState.revealTotalCells);
  assert.ok(mobileState.minimapWidth > 0 && mobileState.minimapHeight > 0 && mobileState.minimapX >= 0 && mobileState.minimapY >= 0);
  assert.ok(Number(mobileState.lastMeleeTick) > 0);
  assert.equal(mobileGrenadeWarning.activeGrenadeWarnings, mobileGrenadeWarning.grenadeCount);
  assert.equal(mobileGrenadeWarning.activeGrenadeWarningRadius, 92);
  assert.equal(mobileState.handGrenades, 2);
  assert.ok(mobileState.dashReadyTick > 0);
  assert.match(dashStatus, /Dash (?:active|\d+ seconds)/i);
  assert.ok(mobileState.audioVoices <= 16);
  assert.deepEqual(errors, []);
  await context.close();
  return { state: mobileState, reload: mobileReload, grenadeWarning: mobileGrenadeWarning, observedDeathVisuals, dashStatus, controls, errors };
}

async function worldTourSmoke() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  await ready(page, errors, `${origin}/hmh-reboot/index.html?debugGrid=1&evidenceSafe=1&worldTour=bridge`);
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.districtId === 'liquidity-crossing');
  const bridge = await state(page);
  await page.screenshot({ path: fileURLToPath(new URL('bridge-world.png', evidenceDir)), fullPage: true });
  assert.equal(bridge.worldId, 'forked-frontier');
  assert.equal(bridge.actorArt, 'production-hero-atlas');
  assert.equal(bridge.worldArt, 'production-vector-world-v1');
  assert.deepEqual(bridge.worldShader, ['water-shimmer-v1', 'hazard-pulse-v1', 'beacon-glow-v1', 'edge-vignette-v1']);
  assert.deepEqual([bridge.worldParticles, bridge.worldBlockers, bridge.worldLandmarks], [50, 38, 6]);
  assert.deepEqual([bridge.worldWidth, bridge.worldHeight], [12000, 4800]);
  assert.equal(bridge.districtId, 'liquidity-crossing');
  assert.equal(bridge.surfaceId, 'proof-of-work-bridge');
  assert.equal(bridge.groundZ, 16);
  assert.ok(Math.abs(bridge.actorX - 4700) < 32 && Math.abs(bridge.actorY - 2400) < 32);
  assert.deepEqual(errors, []);
  await page.close();
  return { bridge, errors };
}

try {
  const report = { desktop: await desktopSmoke(), mobile: await mobileSmoke(), worldTour: await worldTourSmoke() };
  await writeFile(new URL('report.json', evidenceDir), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
