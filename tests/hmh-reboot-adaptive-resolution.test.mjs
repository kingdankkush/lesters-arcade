import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ADAPTIVE_RESOLUTION_DEFAULTS, createAdaptiveResolution } from '../apps/hmh-reboot/src/runtime-performance.mjs';

/**
 * Adaptive canvas sharpness (2026-09-16): phones earn one step up after a
 * sustained window of fast frames and step back down for good when frames
 * slow. Desktop is unaffected (base === max).
 */

const feed = (controller, ms, frames) => { let last = null; for (let i = 0; i < frames; i++) { const next = controller.sample(ms); if (next !== null) last = next; } return last; };

test('a fast phone steps up once after a full window and never past max', () => {
  const controller = createAdaptiveResolution({ base: 1, max: 1.5 });
  assert.equal(feed(controller, 12, ADAPTIVE_RESOLUTION_DEFAULTS.windowFrames - 1), null, 'no decision before the window fills');
  assert.equal(controller.sample(12), 1.5, 'the window closes with a step up');
  assert.equal(controller.resolution, 1.5);
  // Cooldown, then another full fast window: still capped at one raise.
  feed(controller, 12, ADAPTIVE_RESOLUTION_DEFAULTS.cooldownFrames + ADAPTIVE_RESOLUTION_DEFAULTS.windowFrames + 5);
  assert.equal(controller.resolution, 1.5);
});

test('slow frames after a step up drop back to base for the rest of the session', () => {
  const controller = createAdaptiveResolution({ base: 1, max: 1.5, options: { cooldownFrames: 0 } });
  assert.equal(feed(controller, 12, ADAPTIVE_RESOLUTION_DEFAULTS.windowFrames), 1.5);
  assert.equal(feed(controller, 33, ADAPTIVE_RESOLUTION_DEFAULTS.windowFrames), 1, 'p95 at 33 ms steps down');
  assert.equal(controller.lockedDown, true);
  assert.equal(feed(controller, 10, ADAPTIVE_RESOLUTION_DEFAULTS.windowFrames * 3), null, 'a locked-down session never steps up again');
  assert.equal(controller.resolution, 1);
});

test('mixed windows use the 95th percentile, ignore bad samples, and desktop never changes', () => {
  const controller = createAdaptiveResolution({ base: 1, max: 1.5 });
  const frames = ADAPTIVE_RESOLUTION_DEFAULTS.windowFrames;
  for (let i = 0; i < frames - 1; i++) controller.sample(i % 10 === 0 ? 40 : 12); // 10% slow frames
  assert.equal(controller.sample(12), null, 'ten percent slow frames keep the p95 above the raise threshold');
  controller.reset();
  assert.equal(controller.sample(Number.NaN), null);
  assert.equal(controller.sample(-5), null);
  const desktop = createAdaptiveResolution({ base: 2, max: 2 });
  assert.equal(feed(desktop, 8, frames * 2), null);
  assert.throws(() => createAdaptiveResolution({ base: 2, max: 1 }), /base <= max/);
});

test('the runtime samples the ticker delta and applies a change through the renderer', async () => {
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /createAdaptiveResolution\(\{\s*base: performanceProfile\.resolution,/);
  assert.match(main, /max: performanceProfile\.id === 'mobile' \? Math\.min\(1\.5,/);
  assert.match(main, /const nextResolution = adaptiveResolution\.sample\(ticker\.deltaMS\);/);
  assert.match(main, /app\.renderer\.resolution = nextResolution;/);
  assert.match(main, /dataset\.adaptiveResolution = String\(nextResolution\);/);
});
