import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEVICE_TIER_KEY, GOVERNOR, benchmarkDeviceTier, createVisualizerGovernor, deviceStartTier } from '../apps/stacked/src/render/visualizer-governor.mjs';
import { defaultStackedSettings, expandStackedEffectsPreset } from '../apps/portal/src/stacked-player-settings.mjs';

// Drive the governor with a steady frame time for a span of wall-clock ms.
const run = (governor, clock, frameMs, spanMs) => { for (const end = clock.now + spanMs; clock.now < end;) { clock.now += frameMs; governor.sample(clock.now); } };
const withPreset = preset => { const settings = defaultStackedSettings(); Object.assign(settings.video, expandStackedEffectsPreset(preset)); return settings; };

test('sustained slow frames step the scene full -> standard -> calm before touching resolution', () => {
  const governor = createVisualizerGovernor({ startTier: 'full' }), clock = { now: 0 };
  assert.equal(governor.tier, 'full');
  run(governor, clock, 1000 / 40, 2600);
  assert.equal(governor.tier, 'standard');
  assert.equal(governor.resolutionScale, 1);
  run(governor, clock, 1000 / 40, GOVERNOR.COOLDOWN_MS + 2600);
  assert.equal(governor.tier, 'calm');
  assert.equal(governor.resolutionScale, 1, 'resolution is untouched until the scene is already calm');
  run(governor, clock, 1000 / 40, GOVERNOR.COOLDOWN_MS + 2600);
  assert.equal(governor.resolutionScale, GOVERNOR.RESOLUTION_STEP, 'still critical at calm: now resolution drops');
  run(governor, clock, 1000 / 40, 20_000);
  assert.equal(governor.level, 0, 'it never goes below the last step');
});

test('hysteresis: a brief dip or a merely slow calm scene does not step; recovery needs a long fast window', () => {
  const governor = createVisualizerGovernor({ startTier: 'full' }), clock = { now: 0 };
  run(governor, clock, 1000 / 60, 3000);
  run(governor, clock, 1000 / 30, 1200);
  run(governor, clock, 1000 / 60, 3000);
  assert.equal(governor.tier, 'full', 'a 1.2 s dip is ignored');
  const calm = createVisualizerGovernor({ startTier: 'calm' });
  run(calm, clock, 1000 / 48, 10_000);
  assert.equal(calm.resolutionScale, 1, '48 fps at calm is not critical');
  const recovering = createVisualizerGovernor({ startTier: 'full' }), c2 = { now: 0 };
  run(recovering, c2, 1000 / 40, 2600);
  assert.equal(recovering.tier, 'standard');
  run(recovering, c2, 1000 / 60, GOVERNOR.COOLDOWN_MS + GOVERNOR.FAST_WINDOW_MS);
  assert.equal(recovering.tier, 'standard', 'after a step down, climbing back needs a doubled fast window');
  run(recovering, c2, 1000 / 60, GOVERNOR.FAST_WINDOW_MS + 1000);
  assert.equal(recovering.tier, 'full');
  // Hidden-tab gaps and a 120 Hz display are not slow frames.
  const fast = createVisualizerGovernor({ startTier: 'full' }), c3 = { now: 0 };
  for (let i = 0; i < 20; i += 1) { c3.now += 5000; fast.sample(c3.now); }
  run(fast, c3, 1000 / 120, 5000);
  assert.equal(fast.tier, 'full');
  assert.equal(fast.changes, 0);
});

test('the cap lowers the music scene only below the player preset and never edits the saved settings', () => {
  const governor = createVisualizerGovernor({ startTier: 'calm' });
  const full = withPreset('full');
  const snapshot = JSON.stringify(full);
  const capped = governor.cap(full);
  assert.notEqual(capped, full);
  assert.equal(capped.video.effectsPreset, 'calm');
  assert.equal(capped.video.scene, 'off');
  assert.equal(capped.video.visualizer, full.video.visualizer);
  assert.equal(capped.accessibility, full.accessibility);
  assert.equal(JSON.stringify(full), snapshot);
  for (const preset of ['off', 'calm']) { const own = withPreset(preset); assert.equal(governor.cap(own), own, `${preset} is already at or under the cap`); }
  const open = createVisualizerGovernor({ startTier: 'full' });
  assert.equal(open.cap(full), full);
});

test('a one-time device micro-benchmark picks the starting tier and is cached on this device', () => {
  const clock = ms => { let calls = 0; return () => (calls++ ? ms : 0); };
  assert.equal(benchmarkDeviceTier({ clock: clock(2), cores: 8, memory: 8 }).tier, 'full');
  assert.equal(benchmarkDeviceTier({ clock: clock(6), cores: 8 }).tier, 'standard');
  assert.equal(benchmarkDeviceTier({ clock: clock(25), cores: 8 }).tier, 'calm');
  assert.equal(benchmarkDeviceTier({ clock: clock(1), cores: 4 }).tier, 'standard', 'four cores never start at full');
  assert.equal(benchmarkDeviceTier({ clock: clock(1), cores: 2 }).tier, 'calm');
  const store = new Map(), storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  let runs = 0;
  const benchmark = () => { runs += 1; return { tier: 'standard' }; };
  assert.equal(deviceStartTier({ storage, benchmark }), 'standard');
  assert.equal(deviceStartTier({ storage, benchmark }), 'standard');
  assert.equal(runs, 1);
  assert.equal(store.get(DEVICE_TIER_KEY), 'standard');
  assert.equal(deviceStartTier({ storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, benchmark }), 'standard', 'blocked storage still benchmarks');
});

test('the renderer feeds the governor every frame and hands the capped settings to the music scene only', () => {
  const renderer = readFileSync(new URL('../apps/stacked/src/render/renderer.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /governor\.sample\(now\)/);
  assert.match(renderer, /atmosphere\.draw\(\{[^}]*settings: scene/);
  assert.match(renderer, /pulse\.draw\(\{ settings, signals/, 'the reactive board keeps the player preset');
  assert.match(renderer, /app\.renderer\.resolution = baseResolution \* renderScale/);
});
