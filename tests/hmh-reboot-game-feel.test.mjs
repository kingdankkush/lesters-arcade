import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DASH_FEEL,
  ENCOUNTER_FRAMING,
  GAME_FEEL_ART_ID,
  HIT_SMEAR,
  LEVEL_UP_BURST,
  PICKUP_SPARKLE,
  createEncounterFramingState,
  resolveDashAfterimages,
  resolveDashLandingPuff,
  resolveEncounterFramingZoom,
  resolveHeroHitSmear,
  resolveLevelUpBurst,
  resolvePickupSparkle,
} from '../apps/hmh-reboot/src/game-feel.mjs';

const moduleUrl = new URL('../apps/hmh-reboot/src/game-feel.mjs', import.meta.url);
const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const hudUrl = new URL('../apps/hmh-reboot/src/hud.mjs', import.meta.url);
const heroUrl = new URL('../apps/hmh-reboot/src/production-hero-atlas.mjs', import.meta.url);
const cssUrl = new URL('../apps/portal/hmh-reboot/styles.css', import.meta.url);

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const player = { x: 1000, y: 1000 };
const enemyAt = (offset, extra = {}) => ({ id: `e${offset}`, active: true, health: 10, x: player.x + offset, y: player.y, ...extra });
const nearEnemies = (count) => Array.from({ length: count }, (_, index) => enemyAt(40 + index * 30));

// ---------------------------------------------------------------------------
// 1. Tables
// ---------------------------------------------------------------------------

test('the game-feel tables are frozen and carry the derived framing values', () => {
  assert.equal(GAME_FEEL_ART_ID, 'projection-game-feel-v1');
  for (const table of [ENCOUNTER_FRAMING, DASH_FEEL, HIT_SMEAR, LEVEL_UP_BURST, PICKUP_SPARKLE]) assert.ok(Object.isFrozen(table));
  assert.equal(ENCOUNTER_FRAMING.minEnemies, 4);
  assert.equal(ENCOUNTER_FRAMING.radius, 520);
  assert.equal(ENCOUNTER_FRAMING.zoomOut, 0.9);
  assert.equal(ENCOUNTER_FRAMING.easeInTicks, 24);
  assert.equal(ENCOUNTER_FRAMING.easeOutTicks, 48);
  assert.equal(ENCOUNTER_FRAMING.bossBeatZoom, 0.94);
  assert.equal(ENCOUNTER_FRAMING.bossBeatTicks, 45);
  assert.ok(ENCOUNTER_FRAMING.releaseEnemies < ENCOUNTER_FRAMING.minEnemies, 'release threshold must sit below the entry threshold (hysteresis)');
  assert.equal(HIT_SMEAR.lifeTicks, 8);
  assert.equal(HIT_SMEAR.flashTicks, 3);
  assert.equal(HIT_SMEAR.maxOffsetPx, 10);
  assert.equal(LEVEL_UP_BURST.lifeTicks, 20);
  assert.equal(PICKUP_SPARKLE.lifeTicks, 12, 'pickup sparkles ride the existing 12-tick combat ring lifetime');
  assert.equal(DASH_FEEL.landingLifeTicks, 10);
  assert.equal(DASH_FEEL.afterimageTicks, 8);
  assert.equal(DASH_FEEL.afterimageSamples, 4);
});

test('the module is pure: no Math.random, no wall clock', async () => {
  const source = stripComments(await readFile(moduleUrl, 'utf8'));
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /Date\.now|performance\.now|new Date/);
});

// ---------------------------------------------------------------------------
// 2. Encounter framing zoom (V-6)
// ---------------------------------------------------------------------------

test('framing zoom stays at 1 with fewer than four enemies inside the radius', () => {
  const state = createEncounterFramingState();
  const far = [enemyAt(600), enemyAt(700), enemyAt(800), enemyAt(900), enemyAt(1000)];
  for (let tick = 0; tick < 60; tick += 1) {
    const framing = resolveEncounterFramingZoom({ state, tick, enemies: [...nearEnemies(3), ...far], player });
    assert.equal(framing.zoom, 1);
    assert.equal(framing.nearbyEnemies, 3);
    assert.ok(Object.isFrozen(framing));
  }
});

test('framing eases 1 -> 0.9 over 24 ticks with four near enemies, then back over 48 once they leave', () => {
  const state = createEncounterFramingState();
  let previous = 1;
  for (let tick = 0; tick <= 24; tick += 1) {
    const framing = resolveEncounterFramingZoom({ state, tick, enemies: nearEnemies(4), player });
    assert.ok(framing.zoom <= previous, `zoom-out must be monotone (tick ${tick}: ${framing.zoom} > ${previous})`);
    assert.ok(framing.zoom >= 0.9 && framing.zoom <= 1);
    previous = framing.zoom;
  }
  assert.equal(previous, 0.9, 'the ease must land exactly on the derived target');
  // Frames inside one tick read the same value: certification anchors hash frames, not ticks.
  assert.equal(resolveEncounterFramingZoom({ state, tick: 24, enemies: nearEnemies(4), player }).zoom, 0.9);
  // The release is observed at tick 25, so the 48-tick ease-out lands at 73.
  for (let tick = 25; tick <= 25 + 48; tick += 1) {
    const framing = resolveEncounterFramingZoom({ state, tick, enemies: [], player });
    assert.ok(framing.zoom >= previous, `zoom-in must be monotone (tick ${tick})`);
    assert.ok(framing.zoom >= 0.9 && framing.zoom <= 1);
    previous = framing.zoom;
  }
  assert.equal(previous, 1);
  // Midway values are strictly between the ends, so it is an ease and not a snap.
  const probe = createEncounterFramingState();
  for (let tick = 0; tick < 12; tick += 1) resolveEncounterFramingZoom({ state: probe, tick, enemies: nearEnemies(5), player });
  const mid = resolveEncounterFramingZoom({ state: probe, tick: 12, enemies: nearEnemies(5), player }).zoom;
  assert.ok(mid > 0.9 && mid < 1, `mid-ease ${mid}`);
});

test('framing is deterministic for identical inputs and inert under reduce-motion', () => {
  const run = () => {
    const state = createEncounterFramingState();
    const out = [];
    for (let tick = 0; tick < 40; tick += 1) out.push(resolveEncounterFramingZoom({ state, tick, enemies: nearEnemies(tick < 20 ? 6 : 0), player }).zoom);
    return out;
  };
  assert.deepEqual(run(), run());
  const state = createEncounterFramingState();
  for (let tick = 0; tick < 30; tick += 1) {
    const framing = resolveEncounterFramingZoom({ state, tick, enemies: nearEnemies(8), player, bossPhaseTick: 0, reduceMotion: true });
    assert.equal(framing.zoom, 1);
  }
  // Coming out of reduce-motion starts from 1 again, not from a stale ease.
  assert.equal(resolveEncounterFramingZoom({ state, tick: 30, enemies: nearEnemies(8), player }).zoom, 1);
});

test('framing hysteresis: flipping 3 <-> 4 enemies every tick does not oscillate', () => {
  const state = createEncounterFramingState();
  const zooms = [];
  for (let tick = 0; tick < 80; tick += 1) zooms.push(resolveEncounterFramingZoom({ state, tick, enemies: nearEnemies(tick % 2 === 0 ? 4 : 3), player }).zoom);
  let reversals = 0;
  for (let index = 2; index < zooms.length; index += 1) {
    const a = zooms[index - 1] - zooms[index - 2];
    const b = zooms[index] - zooms[index - 1];
    if (a * b < 0) reversals += 1;
  }
  assert.equal(reversals, 0, `zoom direction reversed ${reversals} times: ${zooms.slice(0, 12).join(',')}`);
  assert.equal(zooms.at(-1), 0.9, 'a flickering count at the entry threshold still settles zoomed out');
});

test('a boss phase beat dips toward 0.94 and returns quadratically without exceeding the framing target', () => {
  const state = createEncounterFramingState();
  const beat0 = resolveEncounterFramingZoom({ state, tick: 0, enemies: [], player, bossPhaseTick: 0 });
  assert.ok(Math.abs(beat0.zoom - 0.94) < 1e-9, `beat start ${beat0.zoom}`);
  const beat22 = resolveEncounterFramingZoom({ state, tick: 1, enemies: [], player, bossPhaseTick: 22 });
  assert.ok(beat22.zoom > 0.94 && beat22.zoom < 1);
  // Quadratic return: the second half recovers less than a linear ramp would.
  const linear = 1 - (1 - 0.94) * (1 - 22 / 45);
  assert.ok(beat22.zoom > linear, `quadratic (${beat22.zoom}) must sit above linear (${linear})`);
  assert.equal(resolveEncounterFramingZoom({ state, tick: 2, enemies: [], player, bossPhaseTick: 45 }).zoom, 1);
  assert.equal(resolveEncounterFramingZoom({ state, tick: 3, enemies: [], player, bossPhaseTick: 1_200 + 45 }).zoom, 1);
  assert.equal(resolveEncounterFramingZoom({ state, tick: 4, enemies: [], player, bossPhaseTick: null }).zoom, 1);
  // Every phase boundary the pinned sprite beat fires on (0, 1_200, 2_400) dips the camera too; nothing after 2_445.
  for (const boundary of [1_200, 2_400]) {
    assert.ok(Math.abs(resolveEncounterFramingZoom({ state, tick: 5, enemies: [], player, bossPhaseTick: boundary }).zoom - 0.94) < 1e-9, `boundary ${boundary}`);
    assert.equal(resolveEncounterFramingZoom({ state, tick: 6, enemies: [], player, bossPhaseTick: boundary + 44 }).zoom, 1 - 0.06 * (1 / 45) ** 2);
  }
  assert.equal(resolveEncounterFramingZoom({ state, tick: 7, enemies: [], player, bossPhaseTick: 3_600 }).zoom, 1);
  assert.equal(resolveEncounterFramingZoom({ state, tick: 8, enemies: [], player, bossPhaseTick: 2_445 }).zoom, 1);
  // With the framing already at 0.9 the beat never pulls the camera back in.
  const busy = createEncounterFramingState();
  for (let tick = 0; tick < 30; tick += 1) resolveEncounterFramingZoom({ state: busy, tick, enemies: nearEnemies(6), player });
  assert.equal(resolveEncounterFramingZoom({ state: busy, tick: 30, enemies: nearEnemies(6), player, bossPhaseTick: 0 }).zoom, 0.9);
});

test('framing ignores dead or inactive enemies and validates its inputs', () => {
  const state = createEncounterFramingState();
  const enemies = [...nearEnemies(3), enemyAt(50, { active: false }), enemyAt(60, { health: 0 })];
  for (let tick = 0; tick < 30; tick += 1) assert.equal(resolveEncounterFramingZoom({ state, tick, enemies, player }).zoom, 1);
  assert.throws(() => resolveEncounterFramingZoom({ state, tick: 1.5, enemies: [], player }), TypeError);
  assert.throws(() => resolveEncounterFramingZoom({ state, tick: 1, enemies: null, player }), TypeError);
});

// ---------------------------------------------------------------------------
// 3. Dash landing puff and afterimages (K-6 projection half)
// ---------------------------------------------------------------------------

test('dash landing puff is bounded, seeded, zoom-scaled and absent under reduce-motion', () => {
  assert.equal(resolveDashLandingPuff({ age: 10, zoom: 1, seed: 'a' }), null);
  assert.equal(resolveDashLandingPuff({ age: 0, zoom: 1, seed: 'a', reduceMotion: true }), null);
  assert.equal(resolveDashLandingPuff({ age: -1, zoom: 1, seed: 'a' }), null);
  const a = resolveDashLandingPuff({ age: 0, zoom: 1, seed: 'a', particleScale: 10 });
  const b = resolveDashLandingPuff({ age: 0, zoom: 1, seed: 'b', particleScale: 10 });
  const a2 = resolveDashLandingPuff({ age: 0, zoom: 2, seed: 'a', particleScale: 10 });
  assert.ok(Object.isFrozen(a));
  assert.deepEqual(a, resolveDashLandingPuff({ age: 0, zoom: 1, seed: 'a', particleScale: 10 }));
  assert.notDeepEqual([a.dx, a.dy], [b.dx, b.dy], 'seed must vary the jitter');
  assert.equal(a2.radius, a.radius * 2);
  assert.equal(a.sparks.length, 6);
  assert.equal(resolveDashLandingPuff({ age: 0, zoom: 1, seed: 'a', particleScale: 0 }).sparks.length, 0);
  let previous = Number.POSITIVE_INFINITY;
  for (let age = 0; age < 10; age += 1) {
    const puff = resolveDashLandingPuff({ age, zoom: 1, seed: 'a' });
    assert.ok(puff.alpha < previous && puff.alpha > 0);
    previous = puff.alpha;
  }
  assert.ok(previous < 0.1, 'alpha must be nearly gone by the last tick');
  assert.equal(resolveDashLandingPuff({ age: 0, zoom: 1, seed: 'a', stopReason: 'hard-blocker' }).tint, DASH_FEEL.stopColors['hard-blocker']);
  assert.equal(resolveDashLandingPuff({ age: 0, zoom: 1, seed: 'a', stopReason: 'boss' }).tint, DASH_FEEL.stopColors.boss);
  assert.equal(resolveDashLandingPuff({ age: 0, zoom: 1, seed: 'a', stopReason: null }).tint, DASH_FEEL.dustColor);
});

test('dash afterimages trail opposite the dash with strictly decreasing alpha', () => {
  const direction = { x: 1, y: 0 };
  const samples = resolveDashAfterimages({ direction, age: 2, zoom: 1 });
  assert.equal(samples.length, 4);
  assert.ok(Object.isFrozen(samples));
  for (let index = 0; index < samples.length; index += 1) {
    assert.ok(samples[index].dx < 0, 'samples trail behind the hero');
    assert.equal(samples[index].dy, 0);
    if (index > 0) {
      assert.ok(samples[index].alpha < samples[index - 1].alpha, 'alpha must fall along the trail');
      assert.ok(samples[index].dx < samples[index - 1].dx, 'samples spread outward along the trail');
    }
  }
  const zoomed = resolveDashAfterimages({ direction, age: 2, zoom: 2 });
  assert.equal(zoomed[0].dx, samples[0].dx * 2);
  assert.deepEqual(resolveDashAfterimages({ direction, age: 9, zoom: 1 }), []);
  assert.deepEqual(resolveDashAfterimages({ direction, age: 2, zoom: 1, reduceMotion: true }), []);
  assert.deepEqual(resolveDashAfterimages({ direction: { x: 0, y: 0 }, age: 2, zoom: 1 }), []);
  assert.deepEqual(resolveDashAfterimages({ direction: null, age: 2, zoom: 1 }), []);
  const diagonal = resolveDashAfterimages({ direction: { x: 0, y: -1 }, age: 0, zoom: 1 });
  assert.ok(diagonal[0].dy > 0 && diagonal[0].dx === 0);
});

// ---------------------------------------------------------------------------
// 4. Hero hit smear (V-5)
// ---------------------------------------------------------------------------

test('hero hit smear points opposite the knockback, is bounded, and degrades under the accessibility settings', () => {
  const knockback = { x: 32, y: 0 };
  const smear = resolveHeroHitSmear({ age: 0, knockback, zoom: 1 });
  assert.ok(Object.isFrozen(smear));
  assert.ok(smear.offsetX < 0 && smear.offsetY === 0, 'smear trails against the knockback');
  assert.ok(Math.abs(smear.offsetX) <= 10);
  assert.ok(Math.abs(resolveHeroHitSmear({ age: 0, knockback, zoom: 2 }).offsetX) <= 20);
  assert.equal(smear.flash, true);
  assert.equal(smear.tint, HIT_SMEAR.color);
  assert.equal(resolveHeroHitSmear({ age: 2, knockback, zoom: 1 }).flash, true);
  assert.equal(resolveHeroHitSmear({ age: 3, knockback, zoom: 1 }).flash, false);
  assert.equal(resolveHeroHitSmear({ age: 8, knockback, zoom: 1 }), null);
  assert.equal(resolveHeroHitSmear({ age: -1, knockback, zoom: 1 }), null);
  const still = resolveHeroHitSmear({ age: 0, knockback: { x: 0, y: 0 }, zoom: 1 });
  assert.equal(still.offsetX, 0);
  assert.equal(still.offsetY, 0);
  const motionless = resolveHeroHitSmear({ age: 0, knockback, zoom: 1, reduceMotion: true });
  assert.equal(motionless.offsetX, 0);
  assert.ok(motionless.alpha > 0, 'reduce-motion keeps the colour cue, only the displacement goes');
  const flashless = resolveHeroHitSmear({ age: 0, knockback, zoom: 1, reduceFlash: true });
  assert.equal(flashless.tint, 0xffffff);
  assert.equal(flashless.flash, false);
  assert.ok(Math.abs(flashless.alpha - smear.alpha / 2) < 1e-9);
  const up = resolveHeroHitSmear({ age: 0, knockback: { x: 0, y: -12 }, zoom: 1 });
  assert.ok(up.offsetY > 0 && up.offsetX === 0);
  for (let age = 1; age < 8; age += 1) {
    assert.ok(Math.abs(resolveHeroHitSmear({ age, knockback, zoom: 1 }).offsetX) < Math.abs(resolveHeroHitSmear({ age: age - 1, knockback, zoom: 1 }).offsetX));
  }
});

// ---------------------------------------------------------------------------
// 5. Level-up burst and pickup sparkle (V-4)
// ---------------------------------------------------------------------------

test('level-up burst scales its rays with the quality tier and stays flash-safe', () => {
  assert.equal(resolveLevelUpBurst({ age: 20, zoom: 1, particleScale: 10, seed: 'l' }), null);
  assert.equal(resolveLevelUpBurst({ age: -1, zoom: 1, particleScale: 10, seed: 'l' }), null);
  const full = resolveLevelUpBurst({ age: 0, zoom: 1, particleScale: 10, seed: 'l' });
  assert.ok(Object.isFrozen(full));
  assert.equal(full.rays.length, 12);
  assert.equal(resolveLevelUpBurst({ age: 0, zoom: 1, particleScale: 6, seed: 'l' }).rays.length, 7);
  assert.equal(resolveLevelUpBurst({ age: 0, zoom: 1, particleScale: 0, seed: 'l' }).rays.length, 0);
  assert.equal(full.coreFlash, true);
  const older = resolveLevelUpBurst({ age: 6, zoom: 1, particleScale: 10, seed: 'l' });
  assert.ok(older.ringRadius > full.ringRadius);
  assert.equal(resolveLevelUpBurst({ age: 6, zoom: 2, particleScale: 10, seed: 'l' }).ringRadius, older.ringRadius * 2);
  assert.ok(older.ringAlpha < full.ringAlpha);
  const safe = resolveLevelUpBurst({ age: 0, zoom: 1, particleScale: 10, seed: 'l', reduceFlash: true });
  assert.equal(safe.coreFlash, false);
  assert.ok(safe.ringAlpha <= 0.5);
  for (const ray of safe.rays) assert.ok(ray.alpha <= 0.5);
  assert.ok(safe.coreAlpha <= 0.5);
  assert.notDeepEqual(full.rays.map((ray) => ray.angle), resolveLevelUpBurst({ age: 0, zoom: 1, particleScale: 10, seed: 'm' }).rays.map((ray) => ray.angle));
  for (const ray of full.rays) assert.ok(ray.outer > ray.inner && ray.inner > 0);
});

test('pickup sparkles are seeded, tiered, and halve under reduce-flash', () => {
  assert.deepEqual(resolvePickupSparkle({ age: 12, zoom: 1, particleScale: 10, seed: 'p' }), []);
  assert.equal(resolvePickupSparkle({ age: 0, zoom: 1, particleScale: 10, seed: 'p' }).length, 6);
  assert.equal(resolvePickupSparkle({ age: 0, zoom: 1, particleScale: 6, seed: 'p' }).length, 4);
  assert.equal(resolvePickupSparkle({ age: 0, zoom: 1, particleScale: 0, seed: 'p' }).length, 0);
  const a = resolvePickupSparkle({ age: 3, zoom: 1, particleScale: 10, seed: 'p' });
  assert.ok(Object.isFrozen(a));
  assert.deepEqual(a, resolvePickupSparkle({ age: 3, zoom: 1, particleScale: 10, seed: 'p' }));
  assert.notDeepEqual(a.map((s) => s.dx), resolvePickupSparkle({ age: 3, zoom: 1, particleScale: 10, seed: 'q' }).map((s) => s.dx));
  const safe = resolvePickupSparkle({ age: 3, zoom: 1, particleScale: 10, seed: 'p', reduceFlash: true });
  for (let index = 0; index < a.length; index += 1) assert.ok(Math.abs(safe[index].alpha - a[index].alpha / 2) < 1e-9);
  const later = resolvePickupSparkle({ age: 9, zoom: 1, particleScale: 10, seed: 'p' });
  for (let index = 0; index < a.length; index += 1) {
    assert.ok(later[index].alpha < a[index].alpha);
    assert.ok(later[index].dy < a[index].dy, 'sparkles rise as they age');
  }
});

// ---------------------------------------------------------------------------
// 6. Runtime wiring pins (projection-only; no simulation path touched)
// ---------------------------------------------------------------------------

test('the runtime writes the framing zoom immediately before the pinned camera follow, outside the director block', async () => {
  const source = await readFile(mainUrl, 'utf8');
  assert.match(source, /resolveEncounterFramingZoom\(\{/);
  assert.match(source, /camera\.zoom = framing\.zoom;\n\s*followCameraTarget\(camera, \{\s*\.\.\.renderActor,/);
  assert.match(source, /dataset\.cameraZoom\s*=/);
  assert.match(source, /reduceMotion: settings\.reduceMotion \|\| performanceProfile\.particlesPerHazard === 0,\n\s*\}\);\n\s*camera\.zoom = framing\.zoom;/);
  const directorBlock = source.slice(source.indexOf('lastDirectorStep = endurancePressurePilotEnabled'), source.indexOf('lastBossStep = liquidatorBoss.active'));
  assert.ok(directorBlock.length > 0);
  assert.doesNotMatch(directorBlock, /framing|camera\.zoom/);
  // The framing state is per session, like every other feel state.
  assert.match(source, /framingState = createEncounterFramingState\(\)/);
  // The boss dip lives in the resolver; main.mjs keeps the pinned sprite beat untouched.
  assert.match(source, /const bossPhaseTick = lastBossStep\?\.elapsedTick \?\? 45/);
});

test('the runtime emits a dash-land visual from the existing dash stop and renders it through the pooled puff', async () => {
  const source = await readFile(mainUrl, 'utf8');
  const dashStep = source.slice(source.indexOf('const dashStopped = dashFrame.completed'), source.indexOf("type: 'dash',"));
  assert.match(dashStep, /if \(dashStopped\)/);
  assert.match(dashStep, /type: 'dash-land'/);
  assert.match(dashStep, /stopReason: dashWorld\.stopReason/);
  assert.match(source, /event\.type === 'dash-land'/);
  assert.match(source, /resolveDashLandingPuff\(\{/);
  assert.match(source, /resolveDashAfterimages\(\{/);
  // The simulation-side dash authority is byte-identical to Cycle 073.
  assert.match(source, /const dashStopped = dashFrame\.completed \|\| dashWorld\.stopReason !== null;/);
  assert.match(source, /motion\.vx = dashStopped \? 0 : \(motion\.x - movementStart\.x\) \/ dtSeconds;/);
});

test('the runtime retains the knockback on the player hit and draws the smear plus body tint from it', async () => {
  const source = await readFile(mainUrl, 'utf8');
  assert.match(source, /lastPlayerHit = \{ tick, sourceId: damageEvent\.sourceId, knockback: damageEvent\.knockback \};/);
  assert.match(source, /resolveHeroHitSmear\(\{/);
  assert.match(source, /productionHeroDisplay\.setTint\(/);
  // Simulation-side recoil stays exactly as it was.
  assert.match(source, /if \(magnitude > 0\) applyRecoilImpulse\(motion, \{/);
  const hero = await readFile(heroUrl, 'utf8');
  assert.match(hero, /setTint/);
  assert.match(hero, /Object\.freeze\(\{ container, layerOrder: index\.layerOrder, applyPose, setLayerVisible, setTint \}\)/);
});

test('the level-up beat fires on the applied-upgrade resume path, never while the panel freezes the tick', async () => {
  const source = await readFile(mainUrl, 'utf8');
  const pick = source.slice(source.indexOf('const applySelectedUpgrade = '), source.indexOf('app.ticker.start();', source.indexOf('const applySelectedUpgrade = ')));
  assert.match(pick, /lastLevelUpBeat = \{ tick: simulation\.tick/);
  assert.ok(pick.indexOf('lastLevelUpBeat = {') > pick.indexOf('simulation.leaveUpgrade()'), 'the beat is stamped after the simulation leaves the upgrade state');
  const offer = source.slice(source.indexOf('if (upgradePending && simulation.state === '), source.indexOf('renderActor = interpolateSpatialState'));
  assert.doesNotMatch(offer, /lastLevelUpBeat/);
  assert.match(source, /resolveLevelUpBurst\(\{/);
  assert.match(source, /resolvePickupSparkle\(\{/);
  assert.match(source, /lastLevelUpBeat = null;/);
});

test('every new beat gates on the pinned reduce-motion idiom and reduce-flash setting and adds no arc() rings', async () => {
  const source = stripComments(await readFile(mainUrl, 'utf8'));
  const feel = source.slice(source.indexOf('resolveHeroHitSmear({'), source.indexOf('resolveHeroHitSmear({') + 600);
  assert.match(feel, /reduceFlash: settings\.reduceFlash/);
  assert.match(feel, /reduceMotion: settings\.reduceMotion \|\| performanceProfile\.particlesPerHazard === 0/);
  const burst = source.slice(source.indexOf('resolveLevelUpBurst({'), source.indexOf('resolveLevelUpBurst({') + 1600);
  assert.doesNotMatch(burst, /\.arc\(/);
  assert.match(source, /event\.type === 'pickup'/);
});

test('the HUD dash ring exposes a one-shot ready flash and the CSS honours both reduce-motion sources', async () => {
  const hud = await readFile(hudUrl, 'utf8');
  assert.match(hud, /dataset\.readyFlash/);
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.hmh-hud-dash\[data-ready-flash="true"\]/);
  assert.match(css, /@keyframes hmh-dash-ready/);
  assert.match(css, /@keyframes hmh-upgrade-enter/);
  assert.match(css, /\.hmh-upgrade-layer:not\(\[hidden\]\)/);
  // The stage carries data-setting-reduce-motion and is the HUD's preceding sibling.
  assert.match(css, /\.hmh-reboot-stage\[data-setting-reduce-motion="true"\] ~ [^{]*\.hmh-hud-dash\[data-ready-flash="true"\]\s*\{[^}]*animation: none/);
  assert.match(css, /\.hmh-reboot-stage\[data-setting-reduce-motion="true"\] ~ [^{]*\.hmh-upgrade-layer:not\(\[hidden\]\)[^{]*\{[^}]*animation: none/);
  assert.match(css, /prefers-reduced-motion/);
});
