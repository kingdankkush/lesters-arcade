// Perf step 6: tighter purely visual caps on the mobile profile.
//
// Every cap here only decides how much art is drawn. None of these values is
// read by the simulation, so they cannot change a tick, a hit or a result;
// the desktop and reduced-motion profiles keep their 1.8.1 values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RUNTIME_PERFORMANCE_PROFILES } from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { GORE_LIMITS, createGorePresentation } from '../apps/hmh-reboot/src/gore-presentation.mjs';
import { resolveAtmosphereBudget, createAtmosphereTextures } from '../apps/hmh-reboot/src/world-atmosphere.mjs';
import { createContactShadowTextures } from '../apps/hmh-reboot/src/contact-shadows.mjs';
import { createWeaponVfxTextures } from '../apps/hmh-reboot/src/weapon-vfx.mjs';

const { desktop, mobile, reducedMotion } = RUNTIME_PERFORMANCE_PROFILES;

test('mobile animates at most 24 bodies and draws at most 16 blood marks; the other profiles are unchanged', () => {
  assert.equal(mobile.maxAnimatedEnemies, 24);
  assert.equal(desktop.maxAnimatedEnemies, 96);
  assert.equal(reducedMotion.maxAnimatedEnemies, 48);
  assert.equal(mobile.maxGoreMarks, 16);
  assert.equal(desktop.maxGoreMarks, GORE_LIMITS.marks);
  assert.equal(reducedMotion.maxGoreMarks, GORE_LIMITS.marks);
});

class RecordingLayer {
  constructor() { this.ops = []; this.context = { instructions: [] }; }
  clear() { this.ops = []; this.context.instructions.length = 0; return this; }
}
for (const name of ['ellipse', 'circle', 'poly', 'moveTo', 'lineTo']) {
  RecordingLayer.prototype[name] = function draw(...args) { this.ops.push([name, ...args]); return this; };
}
for (const name of ['fill', 'stroke']) {
  RecordingLayer.prototype[name] = function paint(style) { this.ops.push([name, { ...style }]); this.context.instructions.push(name); return this; };
}
const identity = (point) => ({ x: point.x, y: point.y });
const renderGore = (fx, tick, extra = {}) => {
  const ground = new RecordingLayer();
  const air = new RecordingLayer();
  const drawn = fx.render({ ground, air, tick, settings: { gore: true, reduceMotion: true }, particleScale: 10,
    camera: { zoom: 1 }, view: { width: 4000, height: 4000 }, project: identity, ...extra });
  return { ground: ground.ops, drawn: { ...drawn } };
};

test('the mobile blood-mark cap keeps the newest marks, in the same paint order, and nothing else changes', () => {
  const fx = createGorePresentation();
  // 30 landed kill marks, one per tick, each at its own spot. Direction-less
  // kills without dismemberment add exactly one mark.
  for (let i = 0; i < 30; i += 1) fx.add({ type: 'kill', tick: 100 + i, point: { x: 100 + i * 50, y: 200 } }, 0);
  const full = renderGore(fx, 140);
  const capped = renderGore(fx, 140, { maxMarks: 16 });
  assert.equal(full.drawn.marks, 30);
  assert.equal(capped.drawn.marks, 16);
  // A mark is three shapes, each with its fill: six ops.
  assert.equal(full.ground.length, 30 * 6);
  assert.deepEqual(capped.ground, full.ground.slice(14 * 6), 'the newest 16 marks, oldest first');
  // A cap at or above the pool size is the uncapped draw.
  assert.deepEqual(renderGore(fx, 140, { maxMarks: GORE_LIMITS.marks }), full);
  // Marks that have not landed yet never use up the cap.
  fx.add({ type: 'kill', tick: 500, point: { x: 9000, y: 9000 } }, 0);
  assert.deepEqual(renderGore(fx, 140, { maxMarks: 16 }), capped);
});

test('mobile halves the atmosphere sprite budget; desktop and reduced motion keep theirs', () => {
  assert.deepEqual(resolveAtmosphereBudget(desktop), { fog: 10, motes: 30 });
  assert.deepEqual(resolveAtmosphereBudget(mobile), { fog: 2, motes: 6 });
  assert.deepEqual(resolveAtmosphereBudget(reducedMotion), { fog: 0, motes: 0 });
});

test('the baked shadow, weapon-glow and atmosphere textures skip MSAA when the profile does', () => {
  class FakeGraphics {
    circle() { return this; } ellipse() { return this; } poly() { return this; } rect() { return this; } roundRect() { return this; }
    moveTo() { return this; } lineTo() { return this; } fill() { return this; } stroke() { return this; } destroy() {}
  }
  for (const antialias of [undefined, true, false]) {
    const calls = [];
    const renderer = { generateTexture: (options) => { calls.push(options); return { id: calls.length }; } };
    const extra = antialias === undefined ? {} : { antialias };
    createContactShadowTextures({ renderer, GraphicsClass: FakeGraphics, ...extra });
    createWeaponVfxTextures({ renderer, GraphicsClass: FakeGraphics, ...extra });
    createAtmosphereTextures({ renderer, GraphicsClass: FakeGraphics, ...extra });
    assert.ok(calls.length >= 7);
    // Resolution stays 2: the blobs keep their gradient; only the multisampled
    // render buffers behind each bake go away.
    assert.ok(calls.every((options) => options.resolution === 2 && options.antialias === (antialias ?? true)), String(antialias));
  }
});

test('the child feeds the profile caps into the gore pass and the texture bakes', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /maxMarks: performanceProfile\.maxGoreMarks/u);
  for (const bake of ['createContactShadowTextures', 'createWeaponVfxTextures', 'createAtmosphereTextures']) {
    assert.match(main, new RegExp(`${bake}\\(\\{ renderer: app\\.renderer, GraphicsClass: Graphics, antialias: performanceProfile\\.antialias \\}\\)`, 'u'), bake);
  }
});
