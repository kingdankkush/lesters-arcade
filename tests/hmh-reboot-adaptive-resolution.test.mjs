import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  FULL_EFFECTS_VFX_CAP,
  GOVERNOR_DEFAULTS,
  REDUCED_EFFECTS_VFX_CAP,
  budgetedResolution,
  buildGovernorLadder,
  createGraphicsGovernor,
  createRungApplier,
  rungAtmosphereBudget,
} from '../apps/hmh-reboot/src/graphics-governor.mjs';
import { MAX_WEAPON_VFX_SPRITES, createWeaponVfxPool } from '../apps/hmh-reboot/src/weapon-vfx.mjs';
import { RUNTIME_PERFORMANCE_PROFILES } from '../apps/hmh-reboot/src/runtime-performance.mjs';

/**
 * Adaptive canvas sharpness (2026-09-16) became the Auto graphics governor in
 * perf step 8. A phone still earns one step up to 1.5 after sustained fast
 * frames and drops back for good when that rung cannot hold; on top of that,
 * desktop gets a 4.2 Mpx pixel budget, slow frames drop the effects rung
 * before any resolution, and every move needs several readings in a row plus
 * a cooldown. Pinned tiers are a single rung.
 */

const mobile = { ...RUNTIME_PERFORMANCE_PROFILES.mobile, resolution: 1 };
const desktop2 = { ...RUNTIME_PERFORMANCE_PROFILES.desktop, resolution: 2 };
const desktop1 = { ...RUNTIME_PERFORMANCE_PROFILES.desktop, resolution: 1 };
const { readingFrames, slowReadings, fastReadings, cooldownFrames } = GOVERNOR_DEFAULTS;

// Feed `readings` full readings of `ms` frames; return the last rung change.
const feed = (governor, ms, readings) => {
  let last = null;
  for (let index = 0; index < readings * readingFrames; index += 1) {
    const next = governor.sample(ms);
    if (next !== null) last = next;
  }
  return last;
};
const settle = (governor) => { for (let index = 0; index < cooldownFrames; index += 1) governor.sample(16); };
const phone = (options) => createGraphicsGovernor({ profile: mobile, devicePixelRatio: 3, viewport: () => ({ width: 414, height: 896 }), ...options });

test('the desktop pixel budget caps a 4K DPR 2 backbuffer near 4.2 Mpx and never drops below one pixel per CSS px', () => {
  assert.equal(GOVERNOR_DEFAULTS.pixelBudget, 4_200_000);
  const fourK = budgetedResolution({ resolution: 2, width: 1920, height: 1080 });
  assert.equal(fourK, 1.42);
  assert.ok(1920 * 1080 * fourK ** 2 <= 4_200_000);
  assert.equal(budgetedResolution({ resolution: 2, width: 1280, height: 720 }), 2, 'a small window keeps DPR 2');
  assert.equal(budgetedResolution({ resolution: 1, width: 3840, height: 2160 }), 1, 'DPR 1 never renders below CSS pixels');
  assert.equal(budgetedResolution({ resolution: 2, width: 0, height: 0 }), 2, 'an unmeasured view keeps the profile');
  assert.throws(() => budgetedResolution({ resolution: 0, width: 1, height: 1 }), /resolution/);
});

test('the Auto ladder puts the effects rung above every resolution drop; pinned tiers are one rung', () => {
  const laptop = buildGovernorLadder({ profile: desktop2, width: 1440, height: 900, devicePixelRatio: 2 });
  assert.deepEqual(laptop.rungs.map((rung) => `${rung.resolution}:${rung.effects}`), ['1:reduced', '1.25:reduced', '1.5:reduced', '1.8:reduced', '1.8:full']);
  assert.equal(laptop.start, laptop.rungs.length - 1, 'desktop starts on its top rung');
  const phoneLadder = buildGovernorLadder({ profile: mobile, width: 414, height: 896, devicePixelRatio: 3 });
  assert.deepEqual(phoneLadder.rungs.map((rung) => `${rung.resolution}:${rung.effects}`), ['1:reduced', '1:full', '1.5:full']);
  assert.equal(phoneLadder.start, 1, 'a phone starts at the safe resolution with full effects and may earn 1.5');
  assert.deepEqual(buildGovernorLadder({ profile: desktop1, width: 1280, height: 720 }).rungs.map((rung) => rung.effects), ['reduced', 'full']);
  for (const quality of ['low', 'medium', 'high']) {
    const pinned = buildGovernorLadder({ quality, profile: desktop2, width: 1920, height: 1080, devicePixelRatio: 2 });
    assert.deepEqual(pinned, { rungs: [{ resolution: 2, effects: 'full' }], start: 0 }, `${quality} is pinned and unbudgeted`);
  }
  assert.throws(() => buildGovernorLadder({ profile: {} }), /profile/);
});

test('a fast phone steps up once after many fast readings, never past 1.5, and applies the start rung at creation', () => {
  const applied = [];
  const governor = phone({ onRung: (rung) => applied.push(rung) });
  assert.deepEqual(applied, [{ resolution: 1, effects: 'full' }], 'the start rung is applied at creation');
  assert.equal(feed(governor, 12, fastReadings - 1), null, 'one reading short of the streak');
  assert.deepEqual(feed(governor, 12, 1), { resolution: 1.5, effects: 'full' });
  settle(governor);
  assert.equal(feed(governor, 10, fastReadings * 3), null, 'the top rung is the ceiling');
  assert.equal(governor.rung.resolution, 1.5);
  assert.equal(applied.length, 2);
});

test('a rung that cannot hold drops back and is never retried; slow frames then drop effects before resolution', () => {
  const governor = phone();
  feed(governor, 12, fastReadings);
  settle(governor);
  assert.equal(feed(governor, 33, slowReadings - 1), null, 'hysteresis: one slow reading short');
  assert.deepEqual(feed(governor, 33, 1), { resolution: 1, effects: 'full' });
  settle(governor);
  assert.equal(feed(governor, 10, fastReadings * 3), null, 'a failed rung is never retried');
  assert.deepEqual(feed(governor, 40, slowReadings), { resolution: 1, effects: 'reduced' }, 'the effects rung, not a resolution drop');
  assert.equal(governor.effects, 'reduced');
  settle(governor);
  assert.equal(feed(governor, 40, slowReadings * 4), null, 'a phone never renders below one pixel per CSS px');
  settle(governor);
  assert.deepEqual(feed(governor, 12, fastReadings), { resolution: 1, effects: 'full' }, 'effects come back after a fast streak');
});

test('desktop walks effects first, then the resolution rungs, with a cooldown after each move', () => {
  const governor = createGraphicsGovernor({ profile: desktop2, devicePixelRatio: 2, viewport: () => ({ width: 1440, height: 900 }) });
  assert.deepEqual(governor.rung, { resolution: 1.8, effects: 'full' });
  assert.deepEqual(feed(governor, 40, slowReadings), { resolution: 1.8, effects: 'reduced' });
  // Inside the cooldown slow frames are ignored.
  for (let index = 0; index < cooldownFrames; index += 1) assert.equal(governor.sample(40), null);
  assert.deepEqual(feed(governor, 40, slowReadings), { resolution: 1.5, effects: 'reduced' });
  settle(governor);
  // A mixed reading (between the thresholds) resets both streaks.
  feed(governor, 40, slowReadings - 1);
  feed(governor, 21, 1);
  assert.equal(feed(governor, 40, slowReadings - 1), null);
});

test('a resize that moves the pixel budget rebuilds the ladder; bad samples and pinned tiers never move', () => {
  let view = { width: 1280, height: 720 };
  const applied = [];
  const governor = createGraphicsGovernor({ profile: desktop2, devicePixelRatio: 2, viewport: () => view, onRung: (rung) => applied.push(rung) });
  assert.equal(governor.rung.resolution, 2);
  view = { width: 1920, height: 1080 };
  assert.deepEqual(feed(governor, 16, 1), { resolution: 1.42, effects: 'full' });
  assert.equal(applied.at(-1).resolution, 1.42);
  assert.equal(governor.sample(Number.NaN), null);
  assert.equal(governor.sample(-5), null);
  const pinned = createGraphicsGovernor({ quality: 'high', profile: desktop2, viewport: () => ({ width: 1920, height: 1080 }) });
  assert.equal(feed(pinned, 60, slowReadings * 3), null);
  assert.deepEqual(pinned.rung, { resolution: 2, effects: 'full' });
});

test('the effects rung halves the atmosphere and the weapon VFX cap; the applier drives renderer, pool and telemetry', () => {
  assert.equal(FULL_EFFECTS_VFX_CAP, MAX_WEAPON_VFX_SPRITES, 'the governor mirrors the pool cap without importing it');
  assert.equal(REDUCED_EFFECTS_VFX_CAP, MAX_WEAPON_VFX_SPRITES / 2);
  const budget = { fog: 10, motes: 30 };
  assert.equal(rungAtmosphereBudget(budget, { effects: 'full' }), budget);
  assert.deepEqual(rungAtmosphereBudget(budget, { effects: 'reduced' }), { fog: 5, motes: 15 });
  assert.deepEqual(rungAtmosphereBudget({ fog: 1, motes: 3 }, { effects: 'reduced' }), { fog: 0, motes: 1 });
  class FakeContainer { constructor() { this.children = []; } addChild(child) { this.children.push(child); } removeChild() {} }
  class FakeSprite { constructor() { this.anchor = { set() {} }; this.position = { set() {} }; } }
  const pool = createWeaponVfxPool({ ContainerClass: FakeContainer, SpriteClass: FakeSprite, textures: { core: {}, puff: {}, shell: {} } });
  const resizes = [];
  const app = { renderer: { resolution: 2 }, resize: () => resizes.push(app.renderer.resolution) };
  const dataset = {};
  const apply = createRungApplier({ app, vfxPool: pool, dataset });
  apply({ resolution: 1.5, effects: 'reduced' });
  assert.equal(app.renderer.resolution, 1.5);
  assert.deepEqual(resizes, [1.5]);
  assert.equal(pool.limit, REDUCED_EFFECTS_VFX_CAP);
  assert.deepEqual(dataset, { adaptiveResolution: '1.5', graphicsEffects: 'reduced' });
  pool.begin();
  for (let index = 0; index < 200; index += 1) pool.place({ texture: 'core', x: 0, y: 0, width: 1, height: 1 });
  assert.equal(pool.placed, REDUCED_EFFECTS_VFX_CAP);
  assert.equal(pool.dropped, 200 - REDUCED_EFFECTS_VFX_CAP);
  apply({ resolution: 1.5, effects: 'full' });
  assert.deepEqual(resizes, [1.5], 'an unchanged resolution does not resize');
  assert.equal(pool.limit, MAX_WEAPON_VFX_SPRITES);
  pool.limit = 10_000;
  assert.equal(pool.limit, MAX_WEAPON_VFX_SPRITES, 'the live cap never exceeds the constructed one');
});

test('the runtime feeds the governor each frame through the lazy extras and never holds an eager policy', async () => {
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /createAdaptiveResolution|graphics-governor\.mjs'\)/u, 'the governor is reached only through runtime-extras.mjs');
  assert.match(main, /const runtimeExtrasModule = import\('\.\/runtime-extras\.mjs'\);/u);
  assert.match(main, /extras\?\.sample\(ticker\.deltaMS\);/u);
  assert.match(main, /budget: extras \? extras\.atmosphere\(atmosphereBudget\) : atmosphereBudget,/u);
  assert.match(main, /const startGovernor = \(\) => extras\?\.govern\(\{ quality: graphicsQuality, profile: performanceProfile \}\);/u);
  assert.match(main, /dataset\.adaptiveResolution = String\(performanceProfile\.resolution\);/u);
});
