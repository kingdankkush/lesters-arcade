// Cycle 073 V-1/V-2: serial mid-fire evidence for the per-weapon combat VFX.
//
// For each weapon the hero is aimed with the pointer, the trigger is held, and
// the runtime is paused from INSIDE the page on the very frame the clip count
// drops, so the frozen frame carries the muzzle flash at age 0-1 rather than
// whatever a screenshot happened to land on. Surface scenes aim at authored
// water, cliff, bridge rail and packed earth and wait for the runtime's own
// `lastImpactSurface` telemetry before freezing. A reduceFlash pass re-captures
// the minigun with the setting on, plus three unpaused frames to check for a
// strobe by eye.
//
// Serial only: never run alongside another browser gate. Captures land under
// .tmp/evidence-combat-vfx/ (override with HMH_WEAPON_VFX_EVIDENCE_DIR).
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const portalRoot = path.join(repoRoot, 'apps', 'portal');
const evidenceDir = process.env.HMH_WEAPON_VFX_EVIDENCE_DIR ?? path.join(repoRoot, '.tmp', 'evidence-combat-vfx');
const BASE_QUERY = 'evidenceSafe=1&combatPilot=1&weaponPilot=1&telemetry=1&seed=424242';
const WEAPON_KEYS = { 'coin-blaster': 'Digit1', 'scatter-shotgun': 'Digit2', 'auto-miner': 'Digit3', 'launcher-rig': 'Digit4' };

const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, clip: 440 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, clip: 300 },
};

await mkdir(evidenceDir, { recursive: true });
const { server, origin } = await startPortalStaticServer({ rootDir: portalRoot, port: Number(process.env.HMH_WEAPON_VFX_PORT ?? 8962) });
const browser = await chromium.launch({
  executablePath: process.env.HMH_CHROME_PATH ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const readStage = (page) => page.evaluate(() => {
  const stage = document.querySelector('#hmhRebootStage');
  const pick = (key) => stage?.dataset[key] ?? '';
  return {
    tick: Number(pick('simulationTick')),
    weaponId: pick('weaponId'),
    lastWeaponFire: pick('lastWeaponFire'),
    weaponAmmo: Number(pick('weaponAmmo')),
    effectPoolPressure: pick('effectPoolPressure'),
    weaponVfxPoolPressure: pick('weaponVfxPoolPressure'),
    weaponVfxDropped: Number(pick('weaponVfxDropped')),
    weaponVfxSuppressed: Number(pick('weaponVfxSuppressed')),
    lastImpactSurface: pick('lastImpactSurface'),
    projectileHit: pick('projectileHit'),
    projectileCover: pick('projectileCover'),
    settingReduceFlash: pick('settingReduceFlash'),
    performanceProfile: pick('performanceProfile'),
    cameraShake: pick('cameraShake'),
  };
});

async function openScene(profile, query) {
  const page = await browser.newPage({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, isMobile: profile.isMobile, hasTouch: profile.hasTouch });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/hmh-reboot/index.html?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#hmhRebootStage canvas', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const stage = document.querySelector('#hmhRebootStage');
    return stage?.dataset.actorArtSource === 'production-blender-atlas-v1'
      && stage.dataset.enemyArt === 'production-roster-atlas-v1'
      && stage.dataset.authoredPropStatus === 'ready'
      && stage.dataset.weaponId === 'coin-blaster'
      && Number(stage.dataset.simulationTick) >= 30;
  }, undefined, { timeout: 60_000 });
  await page.locator('#hmhRebootStage canvas').focus();
  const box = await page.locator('#hmhRebootStage canvas').boundingBox();
  assert.ok(box, 'canvas is not laid out');
  return { page, errors, box, centre: { x: box.x + box.width / 2, y: box.y + box.height / 2, reach: Math.min(box.width, box.height) * 0.35 } };
}

// Keys are sampled per simulation tick, so a press must span at least one
// tick; a keydown/keyup inside one frame is never seen.
async function holdKey(page, key, ms = 120) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function selectWeapon(page, weaponId) {
  if (WEAPON_KEYS[weaponId]) {
    await holdKey(page, WEAPON_KEYS[weaponId]);
  } else {
    // Slots 5-8 are reached with the next-weapon key; the loadout cycles in
    // WEAPON_ORDER so at most seven presses land on any owned weapon.
    for (let press = 0; press < 8; press += 1) {
      if ((await readStage(page)).weaponId === weaponId) break;
      await holdKey(page, 'KeyQ');
      await page.waitForTimeout(160);
    }
  }
  await page.waitForFunction((id) => document.querySelector('#hmhRebootStage')?.dataset.weaponId === id, weaponId, { timeout: 5_000 });
}

/**
 * Hold the trigger while aiming at `aim` (unit vector, screen space) and pause
 * from inside the page the moment `condition` holds. Conditions are named, not
 * evaluated from source: `{ kind: 'fired' }` (a frame-to-frame clip decrease),
 * `{ kind: 'surface', surface }` (the runtime classified that impact surface)
 * or `{ kind: 'flesh-hit' }` (a flesh impact with a recorded projectile hit).
 * The pointer is nudged every 250 ms so pointer aim stays fresh and wins over
 * autofire.
 */
async function fireAndFreeze(page, centre, aim, condition, { maxTicks = 900, delayTicks = 0, releaseAfterMs = null, useMouse = true } = {}) {
  // The aim point must stay on the canvas: 200 px right of centre is off a
  // 390 px phone, where the pointer never reaches the runtime.
  const reach = Math.min(200, centre.reach ?? 200);
  const target = { x: centre.x + aim.x * reach, y: centre.y + aim.y * reach };
  if (useMouse) {
    await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(40);
    await page.mouse.down();
  }
  let settled = false;
  const freeze = page.evaluate(({ condition: rule, maxTicks: budget, delayTicks: delay }) => new Promise((resolve) => {
    const stage = document.querySelector('#hmhRebootStage');
    const holds = (dataset, frame) => {
      if (rule.kind === 'fired') return frame.fired;
      if (rule.kind === 'surface') return dataset.lastImpactSurface === rule.surface;
      if (rule.kind === 'flesh-hit') return dataset.lastImpactSurface === 'flesh' && dataset.projectileHit !== '';
      return false;
    };
    const start = { ammo: Number(stage.dataset.weaponAmmo), tick: Number(stage.dataset.simulationTick) };
    // A shot is a frame-to-frame clip decrease. Comparing against the clip at
    // the start would miss a shot the input buffer released on resume and then
    // wait forever while the weapon reloaded upward.
    let previousAmmo = start.ammo;
    let hitTick = null;
    const poll = () => {
      const tick = Number(stage.dataset.simulationTick);
      const ammo = Number(stage.dataset.weaponAmmo);
      const frame = { fired: ammo < previousAmmo, ammo };
      previousAmmo = ammo;
      if (hitTick === null && holds(stage.dataset, frame)) hitTick = tick;
      // `delayTicks` lets a second capture freeze a few ticks after the shot,
      // when tracers and casings have left the muzzle.
      if ((hitTick !== null && tick - hitTick >= delay) || tick - start.tick > budget) {
        // Escape is the runtime's own pause path; dispatched here it lands on
        // this very frame instead of a round trip later.
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        resolve({ hit: hitTick !== null, tick, startTick: start.tick, hitTick });
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }), { condition, maxTicks, delayTicks }).finally(() => { settled = true; });
  let wiggle = 0;
  let held = useMouse;
  const heldSince = Date.now();
  while (!settled) {
    wiggle = (wiggle + 1) % 2;
    if (useMouse) await page.mouse.move(target.x + wiggle, target.y);
    else await page.waitForTimeout(0);
    // The rail gun fires on RELEASE after its 72-tick charge, so a charged
    // weapon lets go of the trigger once the charge has had time to complete.
    if (held && releaseAfterMs !== null && Date.now() - heldSince >= releaseAfterMs) {
      await page.mouse.up();
      held = false;
    }
    await page.waitForTimeout(250);
  }
  const outcome = await freeze;
  if (held) await page.mouse.up();
  await page.waitForTimeout(200);
  // The pause card would sit over the world we are gating; the renderer keeps
  // its last frame underneath.
  await page.evaluate(() => {
    for (const node of document.querySelectorAll('.hmh-modal-layer')) node.style.display = 'none';
  });
  await page.waitForTimeout(120);
  return outcome;
}

// Escape toggles: a paused runtime resumes on the same key.
async function resumeRuntime(page) {
  const pausedTick = await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick);
  });
  await page.waitForFunction((tick) => Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick) > tick, pausedTick, { timeout: 5_000 });
}

async function capture(page, box, profile, name, offset = { x: 0, y: 0 }) {
  const canvas = page.locator('#hmhRebootStage canvas');
  const full = path.join(evidenceDir, `${name}.png`);
  await canvas.screenshot({ path: full });
  const size = Math.min(profile.clip, box.width, box.height);
  // The crop follows the subject: the hero for muzzle frames, the expected
  // impact point (screen offset from the hero) for surface frames.
  const clip = {
    x: Math.max(box.x, Math.min(box.x + box.width - size, box.x + box.width / 2 + offset.x - size / 2)),
    y: Math.max(box.y, Math.min(box.y + box.height - size, box.y + box.height / 2 + offset.y - size / 2)),
    width: size,
    height: size,
  };
  const zoom = path.join(evidenceDir, `${name}-crop.png`);
  await page.screenshot({ path: zoom, clip });
  return [full, zoom];
}

const AMMO_DROPPED = { kind: 'fired' };
const surfaceCondition = (surface) => ({ kind: 'surface', surface });

const report = { evidenceDir, weapons: [], surfaces: [], reduceFlash: null, errors: [] };
const files = [];
const failures = [];
const check = (label, ok) => { if (!ok) failures.push(label); };

try {
  // 1. Weapon identity, desktop and mobile. Aim east so the flash cone and the
  //    casing arc are on the sprite's right and nothing covers the hero.
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    const weapons = profileName === 'desktop'
      ? ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail']
      : ['coin-blaster', 'scatter-shotgun', 'auto-miner'];
    for (const weaponId of weapons) {
      const { page, errors, box, centre } = await openScene(profile, BASE_QUERY);
      await selectWeapon(page, weaponId);
      // The rail gun charges for 72 ticks and fires on release, and while a
      // target is in range autofire holds the trigger, so pointer aim can never
      // release it. Autofire releases a charged rail itself, so the rail gets
      // one hands-off capture three ticks after the shot (expanding ring plus
      // lance toward the target) instead of a hot frame and a flight frame.
      const rail = weaponId === 'hash-rail';
      const outcome = await fireAndFreeze(page, centre, { x: 1, y: -0.15 }, AMMO_DROPPED, rail ? { useMouse: false, delayTicks: 3 } : {});
      const state = await readStage(page);
      files.push(...await capture(page, box, profile, `${profileName}-${weaponId}`));
      let flight = null;
      if (!rail) {
        // Second frame, five ticks after a shot: tracer, casing arc, fading flash.
        await resumeRuntime(page);
        flight = await fireAndFreeze(page, centre, { x: 1, y: -0.15 }, AMMO_DROPPED, { delayTicks: 5 });
        files.push(...await capture(page, box, profile, `${profileName}-${weaponId}-flight`));
      }
      check(`${profileName} ${weaponId} fired`, outcome.hit);
      if (flight) check(`${profileName} ${weaponId} fired a second time`, flight.hit);
      check(`${profileName} ${weaponId} lastWeaponFire=${state.lastWeaponFire}`, state.lastWeaponFire === weaponId);
      check(`${profileName} ${weaponId} live combat visual events ${state.effectPoolPressure}`, Number(state.effectPoolPressure.split('/')[0]) > 0);
      check(`${profileName} ${weaponId} dropped ${state.weaponVfxDropped}`, state.weaponVfxDropped === 0);
      check(`${profileName} ${weaponId} pooled sprites ${state.weaponVfxPoolPressure}`, Number(state.weaponVfxPoolPressure.split('/')[0]) > 0);
      check(`${profileName} ${weaponId} errors ${JSON.stringify(errors)}`, errors.length === 0);
      report.weapons.push({ profile: profileName, weaponId, ...state, frozenAfterTicks: outcome.tick - outcome.startTick });
      await page.close();
    }
  }

  // 2. Surface-typed impacts, desktop. Each scene aims at authored geometry
  //    that the classifier must read as that surface.
  // `impact` is where the burst is expected on screen relative to the hero
  // (shotgun range 480, cliff spur 522 units east of the overlook spawn, the
  // south bridge rail 126 units south); the crop follows it. Surface frames
  // freeze four ticks after the first classified impact so the puff, chips
  // and droplets have developed rather than showing the age-0 ring alone.
  const surfaceScenes = [
    { surface: 'dirt', query: BASE_QUERY, weaponId: 'scatter-shotgun', aim: { x: 1, y: 0 }, impact: { x: 470, y: 0 } },
    { surface: 'water', query: `${BASE_QUERY}&worldTour=crossing-water`, weaponId: 'scatter-shotgun', aim: { x: -0.7, y: -0.7 }, impact: { x: -330, y: -330 } },
    { surface: 'rock', query: `${BASE_QUERY}&worldTour=ravine`, weaponId: 'coin-blaster', aim: { x: 1, y: 0 }, impact: { x: 520, y: -30 } },
    { surface: 'metal', query: `${BASE_QUERY}&worldTour=bridge`, weaponId: 'coin-blaster', aim: { x: -0.3, y: 1 }, impact: { x: -30, y: 110 } },
    { surface: 'flesh', query: `${BASE_QUERY}&director=1`, weaponId: 'coin-blaster', aim: { x: 1, y: 0 }, autofire: true, impact: { x: 0, y: 0 } },
  ];
  for (const scene of surfaceScenes) {
    const profile = PROFILES.desktop;
    const { page, errors, box, centre } = await openScene(profile, scene.query);
    await selectWeapon(page, scene.weaponId);
    const outcome = scene.autofire
      ? await fireAndFreeze(page, centre, scene.aim, { kind: 'flesh-hit' }, { maxTicks: 1_800, delayTicks: 4 })
      : await fireAndFreeze(page, centre, scene.aim, surfaceCondition(scene.surface), { delayTicks: 4 });
    const state = await readStage(page);
    files.push(...await capture(page, box, profile, `surface-${scene.surface}`, scene.impact));
    check(`${scene.surface} impact classified (last ${state.lastImpactSurface})`, outcome.hit && state.lastImpactSurface === scene.surface);
    check(`${scene.surface} errors ${JSON.stringify(errors)}`, errors.length === 0);
    report.surfaces.push({ ...scene, ...state, frozenAfterTicks: outcome.tick - outcome.startTick });
    await page.close();
  }

  // 3. reduceFlash: toggle through the pause card's own control, re-capture the
  //    minigun, and take three unpaused frames for the strobe check.
  {
    const profile = PROFILES.desktop;
    const { page, errors, box, centre } = await openScene(profile, BASE_QUERY);
    await page.evaluate(() => {
      const toggle = document.querySelector('#hmhSettingReduceFlash');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.settingReduceFlash === 'true', undefined, { timeout: 5_000 });
    await selectWeapon(page, 'auto-miner');
    const target = { x: centre.x + 200, y: centre.y - 30 };
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'auto-miner', undefined, { timeout: 5_000 });
    for (let frame = 1; frame <= 3; frame += 1) {
      await page.mouse.move(target.x + (frame % 2), target.y);
      files.push(...await capture(page, box, profile, `reduceflash-auto-miner-live-${frame}`));
    }
    await page.mouse.up();
    const outcome = await fireAndFreeze(page, centre, { x: 1, y: -0.15 }, AMMO_DROPPED);
    const state = await readStage(page);
    files.push(...await capture(page, box, profile, 'reduceflash-auto-miner-frozen'));
    check('reduceFlash minigun fired', outcome.hit);
    check(`reduceFlash setting ${state.settingReduceFlash}`, state.settingReduceFlash === 'true');
    check(`reduceFlash errors ${JSON.stringify(errors)}`, errors.length === 0);
    report.reduceFlash = { ...state };
    await page.close();
  }

  report.files = files;
  report.failures = failures;
  await writeFile(path.join(evidenceDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: failures.length === 0, evidenceDir, weapons: report.weapons.length, surfaces: report.surfaces.map((scene) => scene.surface), files: files.length, failures }, null, 2));
  // Every scene is captured before the verdict so one miss never hides the
  // rest of the evidence.
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
