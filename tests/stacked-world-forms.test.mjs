import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldForms, planWebs, FORM_CEILINGS, RING_COUNT, WEB_CAPACITY } from '../apps/stacked/src/render/world-forms.mjs';
import { createStackedAtmosphere, STACKED_EPOCHS } from '../apps/stacked/src/render/atmosphere.mjs';
import { LIVING_FIELD_CAPACITY } from '../apps/stacked/src/render/living-field.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

// Minimal Pixi-shaped stand-ins: shared contexts, clones, transforms only.
let contexts = 0, shapes = 0;
class Context { constructor() { contexts++; this.destroyed = false; } destroy() { this.destroyed = true; } }
class Graphics {
  constructor(context = new Context()) { this.context = context; this.visible = true; this.alpha = 1; this.tint = 0xffffff; this.rotation = 0; this.blendMode = 'normal'; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { x: 1, y: 1, set: (x, y = x) => { this.scale.x = x; this.scale.y = y; } }; }
  circle() { shapes++; return this; } rect() { shapes++; return this; } poly() { shapes++; return this; } fill() { return this; } stroke() { return this; } clear() { return this; }
  clone() { return new Graphics(this.context); } destroy() { this.destroyed = true; }
}
class Layer { constructor() { this.children = []; } addChild(...children) { this.children.push(...children); } }
const settings = (overrides = {}) => { const s = defaultStackedSettings(); s.accessibility.reduceMotion = false; s.accessibility.reduceFlash = false; Object.assign(s.video, overrides.video ?? {}); Object.assign(s.accessibility, overrides.accessibility ?? {}); return s; };
const luma = hex => ((hex >> 16) & 255) * .2126 / 255 + ((hex >> 8) & 255) * .7152 / 255 + (hex & 255) * .0722 / 255;
const redRatio = hex => { const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255; return r + g + b <= 0 ? 0 : r / (r + g + b); };
const frames = (atmosphere, options) => { const { count = 90, width = 1440, height = 900, tick = 0, lines = 0, settings: prefs = settings(), from = 0, audio = true } = options; let info; for (let i = 0; i < count; i++) { const now = from + i * 1000 / 60; if (audio) atmosphere.audio({ available: true, level: 500, bass: 700, high: 300, onset: i % 30 === 0 }, now); info = atmosphere.draw({ now, tick, lines, width, height, settings: prefs, feedback: { clear: 0, impact: 0, combo: 0, danger: 0 } }); } return info; };
const snapshotLayer = layer => layer.children.map(node => [node.visible, node.visible ? [node.position.x, node.position.y, node.scale.x, node.scale.y, node.rotation, node.alpha, node.tint] : null]);

test('web plans stay inside their capacity, index real points and never cross organisms, strands, rings or tower sides', () => {
  const a = new Int16Array(WEB_CAPACITY.desktop), b = new Int16Array(WEB_CAPACITY.desktop);
  for (const [mode, count, perOrganism] of [['living', 648, 72], ['living', 432, 48], ['living', 72, 24], ['aurora', 192], ['aurora', 72], ['orbit', 192], ['orbit', 72], ['spectrum', 192], ['spectrum', 72], ['living', 0, 72]]) {
    const n = planWebs({ mode, count, perOrganism, a, b });
    assert.ok(n <= a.length && n >= 0, `${mode} ${count} fits`);
    if (count) assert.ok(n > 0, `${mode} ${count} draws something`);
    for (let k = 0; k < n; k++) {
      assert.ok(a[k] >= 0 && a[k] < b[k] && b[k] < count, `${mode} pair ${k} is ordered and inside the count`);
      const group = i => mode === 'living' ? Math.floor(i / perOrganism) : mode === 'spectrum' ? Math.floor(i / Math.floor(count / 2)) : Math.floor(i / Math.floor(count / 6)) < 3 ? 0 : 1;
      assert.equal(group(a[k]), group(b[k]), `${mode} pair ${k} stays on one side`);
    }
  }
  const mobile = new Int16Array(WEB_CAPACITY.mobile);
  assert.ok(planWebs({ mode: 'living', count: 432, perOrganism: 48, a: mobile, b: new Int16Array(WEB_CAPACITY.mobile) }) <= WEB_CAPACITY.mobile);
});

test('every epoch palette passes the red-saturation guard and keeps a darker deep tint for the far forms', () => {
  assert.equal(STACKED_EPOCHS.length, 6);
  for (const zone of STACKED_EPOCHS) {
    for (const key of ['color', 'accent', 'deep']) assert.ok(redRatio(zone[key]) < 0.70, `${zone.name} ${key} red ratio`);
    assert.ok(luma(zone.deep) < luma(zone.color) && luma(zone.deep) < luma(zone.accent), `${zone.name} deep is the darkest tint`);
  }
});

test('forms pool every Graphics once and reuse them across worlds, sizes and settings with no allocation', () => {
  const layer = new Layer();
  const forms = createWorldForms({ layer, Graphics, mobile: false });
  layer.addChild(...forms.over);
  const before = { contexts, shapes, children: layer.children.length };
  assert.equal(before.children, 2 + RING_COUNT + WEB_CAPACITY.desktop + 1);
  const x = new Float32Array(648), y = new Float32Array(648), weight = new Float32Array(648).fill(1);
  for (let i = 0; i < 648; i++) { x[i] = (i % 24) * 10 - 400; y[i] = Math.floor(i / 24) * 12 - 200; }
  const palette = { color: 0x53e9ef, accent: 0xbacfff, deep: 0x1f6f8f };
  let t = 0;
  for (const mode of ['living', 'aurora', 'orbit', 'spectrum', 'living']) for (const [width, height] of [[1440, 900], [390, 844], [1440, 900]]) for (const minimal of [false, true]) {
    const count = mode === 'living' ? (minimal ? 72 : 648) : (minimal ? 72 : 192);
    const n = forms.draw({ mode, x, y, weight: mode === 'living' ? null : weight, count, perOrganism: minimal ? 24 : 72, cohesion: 1, generation: 2, width, height, time: t += .5, level: .4, bass: .6, high: .3, beat: .8, intensity: .7, fade: 1, minimal, reduceFlash: false, palette });
    assert.ok(n <= forms.capacity);
    for (const node of layer.children) { assert.equal(node.blendMode, 'normal', 'no additive blend anywhere'); assert.ok(node.alpha >= 0 && node.alpha <= 1 && Number.isFinite(node.position.x) && Number.isFinite(node.scale.x)); }
  }
  // Shapes are only rebuilt for the vignette on resize (3 bands x 4 rects), never per frame.
  assert.equal(contexts, before.contexts, 'no new GraphicsContext after construction');
  assert.equal(layer.children.length, before.children, 'no new display objects');
  const rebuilt = shapes - before.shapes;
  assert.ok(rebuilt === 0 || rebuilt % 12 === 0, `vignette rebuilds happen only on resize (${rebuilt} shapes)`);
  const measured = shapes;
  forms.draw({ mode: 'orbit', x, y, weight, count: 192, width: 1440, height: 900, palette, intensity: .7 });
  forms.draw({ mode: 'orbit', x, y, weight, count: 192, width: 1440, height: 900, palette, intensity: .7 });
  assert.equal(shapes, measured, 'same size frames build nothing');
  forms.destroy();
  assert.ok(layer.children.every(node => node.destroyed));
});

test('form alpha stays under the static ceilings, reduceFlash dims the glow and zero intensity hides everything', () => {
  const layer = new Layer();
  const forms = createWorldForms({ layer, Graphics, mobile: true });
  layer.addChild(...forms.over);
  const [glowA, glowB] = layer.children, rings = layer.children.slice(2, 2 + RING_COUNT), webs = layer.children.slice(2 + RING_COUNT, 2 + RING_COUNT + WEB_CAPACITY.mobile), vignette = layer.children.at(-1);
  const x = new Float32Array(432), y = new Float32Array(432);
  for (let i = 0; i < 432; i++) { x[i] = (i % 48) * 6 - 150; y[i] = Math.floor(i / 48) * 40 - 160; }
  const palette = { color: 0xffa763, accent: 0xffd9a1, deep: 0x9a5a2e };
  const loud = { mode: 'living', x, y, count: 432, perOrganism: 48, cohesion: 1, width: 390, height: 844, time: 3, level: 1, bass: 1, high: 1, beat: 1, intensity: 1, fade: 1, palette };
  forms.draw(loud);
  assert.ok(glowA.alpha <= 1 && glowB.alpha <= 1);
  const quiet = glowA.alpha;
  for (const ring of rings) if (ring.visible) assert.ok(ring.alpha <= FORM_CEILINGS.ring + 1e-9);
  for (const web of webs) if (web.visible) assert.ok(web.alpha <= FORM_CEILINGS.web + 1e-9);
  assert.ok(vignette.alpha <= 1);
  forms.draw({ ...loud, reduceFlash: true });
  assert.ok(glowA.alpha < quiet * .7, 'reduceFlash lowers the halo');
  forms.draw({ ...loud, intensity: 0, count: 0 });
  assert.ok(layer.children.every(node => !node.visible || node === vignette));
  assert.equal(vignette.alpha, 0);
  // Beat and bass scale the halo; they never change its alpha.
  forms.draw({ ...loud, beat: 0, bass: 0, level: .5 });
  const restAlpha = glowA.alpha, restScale = glowA.scale.x;
  forms.draw({ ...loud, beat: 1, bass: 1, level: .5 });
  assert.equal(glowA.alpha, restAlpha);
  assert.ok(glowA.scale.x > restScale);
  forms.destroy();
});

test('the atmosphere keeps its particle pins, stays frozen under reduced motion and reports webs for every world', () => {
  for (const [mobile, expected] of [[false, LIVING_FIELD_CAPACITY], [true, 432]]) {
    const layer = new Layer();
    const atmosphere = createStackedAtmosphere({ layer, Graphics, mobile });
    const pooled = layer.children.length;
    assert.equal(pooled, expected * 2 + 2 + RING_COUNT + (mobile ? WEB_CAPACITY.mobile : WEB_CAPACITY.desktop) + 1);
    const living = frames(atmosphere, { settings: settings({ video: { visualizer: 'living' } }) });
    assert.equal(living.particles, expected); assert.equal(living.mode, 'living'); assert.ok(living.webs > 0);
    for (const mode of ['aurora', 'orbit', 'spectrum']) {
      const info = frames(atmosphere, { settings: settings({ video: { visualizer: mode } }), from: 5000 });
      assert.equal(info.mode, mode); assert.equal(info.particles, 192); assert.ok(info.webs > 0, `${mode} webs`);
    }
    const minimal = frames(atmosphere, { settings: settings({ video: { visualizer: 'orbit', reducedEffects: true } }), from: 9000 });
    assert.ok(minimal.particles <= 72);
    assert.equal(layer.children.length, pooled, 'mode switches allocate nothing');
    // Journey follows the zone table and mixes palettes without leaving the epoch list.
    const zone = frames(atmosphere, { tick: 25300, from: 12000 });
    assert.equal(zone.name, 'HASHRATE FORGE'); assert.equal(zone.mode, 'spectrum');
    // Reduced motion: two frames with different time and audio render identically.
    const still = settings({ accessibility: { reduceMotion: true } });
    frames(atmosphere, { settings: still, from: 20000, count: 30 });
    const first = snapshotLayer(layer);
    atmosphere.audio({ available: true, level: 900, bass: 900, high: 900, onset: true }, 25000);
    atmosphere.draw({ now: 25000, tick: 0, lines: 0, width: 1440, height: 900, settings: still, feedback: {} });
    assert.deepEqual(snapshotLayer(layer), first);
    // Zero intensity hides every form and reports no particles.
    const off = frames(atmosphere, { settings: settings({ video: { effectsIntensity: 0 } }), from: 30000, count: 5 });
    assert.equal(off.particles, 0); assert.equal(off.webs, 0);
    assert.ok(layer.children.every(node => !node.visible || node.alpha === 0));
    atmosphere.destroy();
    assert.ok(layer.children.every(node => node.destroyed));
  }
});
