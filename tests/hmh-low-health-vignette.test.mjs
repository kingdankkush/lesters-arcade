import test from 'node:test';
import assert from 'node:assert/strict';
import { createLowHealthVignette, lowHealthVignetteAlpha } from '../apps/hmh-reboot/src/low-health-vignette.mjs';

test('warning is continuous, bounded, steady and absent outside the health threshold', () => {
  for (const healthRatio of [1, .8, .35, NaN, Infinity]) assert.equal(lowHealthVignetteAlpha(healthRatio), 0);
  assert.ok(lowHealthVignetteAlpha(.3499) < .001);
  assert.ok(lowHealthVignetteAlpha(.1) > lowHealthVignetteAlpha(.2));
  assert.equal(lowHealthVignetteAlpha(-1), lowHealthVignetteAlpha(0));
  assert.ok(lowHealthVignetteAlpha(0) <= .24);
});

test('one small radial texture serves phone/desktop resizing and is owned until disposal', () => {
  const stops = [], fills = [], destroyed = [];
  const gradient = { addColorStop: (...args) => stops.push(args) };
  const ctx = { createRadialGradient: (...args) => { assert.deepEqual(args, [128,128,0,128,128,181]); return gradient; }, fillRect: (...args) => fills.push(args) };
  const canvas = { getContext: () => ctx };
  class Sprite {
    constructor(texture) { this.texture = texture; }
    destroy() { destroyed.push('sprite'); }
  }
  const texture = { destroy: (source) => destroyed.push(['texture', source]) };
  let textures = 0;
  const layer = createLowHealthVignette({ SpriteClass: Sprite, TextureClass: { from: () => { textures++; return texture; } }, createCanvas: () => canvas });
  assert.equal(canvas.width * canvas.height * 4, 262144);
  assert.deepEqual(fills, [[0,0,256,256]]);
  assert.ok(stops.filter(([, color]) => color.endsWith(',0)')).length >= 2, 'clear play area');
  assert.ok(stops.length >= 5, 'soft multi-stop falloff');
  assert.equal(ctx.fillStyle, gradient);
  assert.equal(Object.hasOwn(layer.display, 'eventMode'), false, 'the trimmed renderer has no pointer-event subsystem');
  layer.update({ healthRatio: .1, width: 414, height: 896 });
  assert.equal(layer.display.visible, true);
  assert.equal(layer.display.width, 414);
  assert.equal(layer.display.height, 896);
  const alpha = layer.display.alpha;
  layer.update({ healthRatio: .1, width: 1440, height: 900 });
  assert.equal(layer.display.alpha, alpha, 'no flashing/pulsing clock');
  assert.equal(textures, 1);
  layer.update({ healthRatio: 1, width: 1440, height: 900 });
  assert.equal(layer.display.visible, false);
  layer.dispose(); layer.dispose();
  assert.deepEqual(destroyed, ['sprite', ['texture', true]]);
});

test('failed canvas allocation degrades without interrupting a run', () => {
  const layer = createLowHealthVignette({ createCanvas: () => ({ getContext: () => null }) });
  assert.equal(layer.display, null);
  assert.doesNotThrow(() => { layer.update({ healthRatio: 0 }); layer.dispose(); });
});
