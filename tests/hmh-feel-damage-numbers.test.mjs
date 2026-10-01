// 2.1 HMH-FEEL item 4 (upgrade guide §2.3): pooled damage numbers from a
// pre-baked glyph atlas, rise 28 px over 0.6 s with an ease-out, crit 1.3x
// pop in the accent colour, per-enemy aggregation during swarms, own toggle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import v8 from 'node:v8';
import vm from 'node:vm';

import {
  DAMAGE_NUMBER_COLOR,
  DAMAGE_NUMBER_CRIT_COLOR,
  DAMAGE_NUMBER_CRIT_POP,
  DAMAGE_NUMBER_DIGITS,
  DAMAGE_NUMBER_GLYPH_PX,
  DAMAGE_NUMBER_LIFE_MS,
  DAMAGE_NUMBER_RISE_PX,
  DAMAGE_NUMBER_SWARM_AT,
  DAMAGE_NUMBER_SWARM_WINDOW_MS,
  DAMAGE_NUMBER_WINDOW_MS,
  MAX_DAMAGE_NUMBERS,
  createDamageGlyphAtlas,
  createDamageNumberModel,
  createDamageNumberView,
  damageNumberMotion,
} from '../apps/hmh-reboot/src/damage-numbers.mjs';
import { createHmhFeel, hmhDamageNumbersEnabled } from '../apps/hmh-reboot/src/hmh-feel.mjs';
import { createBridgeEnvelope, validateChildMessage, validateParentMessage } from '../sdk/hmh-bridge-protocol.mjs';
import { HMH_PLAYER_SETTINGS_DEFAULTS, mergeHmhRuntimeSettings, projectHmhRuntimeSettings } from '../apps/portal/src/hmh-player-settings.mjs';
import { createStandaloneInitPayload } from '../apps/hmh-reboot/src/standalone-session.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../apps/hmh-reboot/src/main.mjs');
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');

// Minimal Pixi-shaped fakes.
class FakePoint { constructor() { this.x = 0; this.y = 0; } set(x, y = x) { this.x = x; this.y = y; } }
class FakeContainer {
  constructor() { this.children = []; this.visible = true; this.alpha = 1; this.position = new FakePoint(); this.scale = new FakePoint(); this.destroyed = false; }
  addChild(child) { this.children.push(child); return child; }
  destroy() { this.destroyed = true; }
}
class FakeSprite extends FakeContainer { constructor({ texture } = {}) { super(); this.texture = texture; this.tint = 0xffffff; } }
class FakeRectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
class FakeTexture {
  constructor({ source, frame } = {}) { this.source = source; this.frame = frame; }
  static from(canvas) { return new FakeTexture({ source: { canvas, update() { this.updated = true; }, destroy() {} } }); }
  destroy() {}
}
function fakeDocument() {
  const ops = [];
  const context = {
    font: '', textBaseline: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
    measureText: (text) => ({ width: 14 + Number(text) % 3 }),
    strokeText: (...args) => ops.push(['stroke', ...args]),
    fillText: (...args) => ops.push(['fill', ...args]),
  };
  return { ops, documentRef: { createElement: (tag) => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => context } : null) } };
}
const atlasFor = () => createDamageGlyphAtlas({ documentRef: fakeDocument().documentRef, TextureClass: FakeTexture, RectangleClass: FakeRectangle });

test('motion: rise 28 px over 0.6 s with an ease-out, fade in the last 40%, crit pops 1.3x and settles', () => {
  assert.equal(DAMAGE_NUMBER_LIFE_MS, 600);
  assert.ok(DAMAGE_NUMBER_RISE_PX >= 24 && DAMAGE_NUMBER_RISE_PX <= 32);
  const at = (ms, crit = false) => ({ ...damageNumberMotion(ms, crit) });
  assert.deepEqual(at(0), { rise: 0, alpha: 1, scale: 1 });
  assert.equal(at(600).rise, DAMAGE_NUMBER_RISE_PX);
  assert.equal(at(600).alpha, 0);
  assert.ok(at(180).rise > 0.5 * DAMAGE_NUMBER_RISE_PX, 'ease-out: most of the rise in the first third');
  assert.equal(at(300).alpha, 1);
  assert.ok(at(480).alpha > 0 && at(480).alpha < 1);
  assert.equal(at(0, true).scale, DAMAGE_NUMBER_CRIT_POP);
  assert.ok(at(300, true).scale < DAMAGE_NUMBER_CRIT_POP && at(300, true).scale > 1);
  assert.notEqual(DAMAGE_NUMBER_CRIT_COLOR, DAMAGE_NUMBER_COLOR);
  // Readable on a 375 px viewport: the glyph cell is 24 CSS px tall and a
  // five-digit number stays well inside the width.
  assert.ok(DAMAGE_NUMBER_GLYPH_PX >= 20);
});

test('per-enemy aggregation: one number counts up instead of overlapping; the window widens in a swarm', () => {
  const model = createDamageNumberModel();
  const a = model.add('enemy-1', 12, false, 0, 0, 0, 1000);
  assert.equal(model.add('enemy-1', 8, true, 5, 5, 0, 1100), a, 'inside the window: same number');
  assert.equal(model.value[a], 20);
  assert.equal(model.critical[a], 1, 'a crit inside the aggregate marks it');
  const b = model.add('enemy-2', 5, false, 0, 0, 0, 1100);
  assert.notEqual(a, b, 'another enemy gets its own number');
  assert.notEqual(model.add('enemy-1', 3, false, 0, 0, 0, 1100 + DAMAGE_NUMBER_WINDOW_MS + 1), a, 'outside the window: a new number');
  assert.equal(model.stats.aggregated, 1);
  // Swarm: with DAMAGE_NUMBER_SWARM_AT numbers live the window widens.
  const swarm = createDamageNumberModel();
  for (let i = 0; i < DAMAGE_NUMBER_SWARM_AT; i += 1) swarm.add(`e${i}`, 1, false, 0, 0, 0, 0);
  const slot = swarm.add('e0', 1, false, 0, 0, 0, DAMAGE_NUMBER_SWARM_WINDOW_MS - 1);
  assert.equal(swarm.value[slot], 2, 'aggregated across the wider swarm window');
  // Garbage is ignored.
  assert.equal(model.add('x', 0, false, 0, 0, 0, 0), -1);
  assert.equal(model.add('x', Number.NaN, false, 0, 0, 0, 0), -1);
});

test('the pool plateaus: never more than MAX_DAMAGE_NUMBERS, oldest stolen, all retire after 0.6 s', () => {
  const model = createDamageNumberModel();
  let now = 0;
  // A long soak: 40 enemies hit every 50 ms for 10 minutes.
  for (let step = 0; step < 12_000; step += 1) {
    now += 50;
    for (let enemy = 0; enemy < 40; enemy += 1) if ((enemy + step) % 3 === 0) model.add(`e${enemy}`, 7, enemy % 5 === 0, enemy, enemy, 0, now);
    model.update(now);
    assert.ok(model.stats.active <= MAX_DAMAGE_NUMBERS);
  }
  assert.equal(model.stats.peak, MAX_DAMAGE_NUMBERS);
  assert.ok(model.stats.stolen > 0);
  assert.equal(model.update(now + DAMAGE_NUMBER_LIFE_MS), 0, 'everything retires');
  model.add('late', 1, false, 0, 0, 0, now + 10_000);
  model.clear();
  assert.equal(model.stats.active, 0);
});

test('glyph atlas: ten digits baked once, white fill over a dark outline; null where the document cannot draw', () => {
  const { ops, documentRef } = fakeDocument();
  const atlas = createDamageGlyphAtlas({ documentRef, TextureClass: FakeTexture, RectangleClass: FakeRectangle });
  assert.equal(atlas.textures.length, 10);
  assert.equal(ops.filter(([op]) => op === 'fill').length, 10);
  assert.equal(ops.filter(([op]) => op === 'stroke').length, 10);
  assert.ok(atlas.textures.every((texture) => texture.source === atlas.textures[0].source), 'one shared source');
  assert.equal(atlas.height * 1, atlas.height);
  assert.equal(createDamageGlyphAtlas({ documentRef: { createElement: () => ({}) }, TextureClass: FakeTexture, RectangleClass: FakeRectangle }), null);
  assert.equal(createDamageGlyphAtlas({}), null);
});

test('view: digit sprites take the value right to left, centred, crit tinted, textures swapped only on change', () => {
  const model = createDamageNumberModel({ max: 4 });
  const atlas = atlasFor();
  const view = createDamageNumberView({ model, atlas, ContainerClass: FakeContainer, SpriteClass: FakeSprite });
  assert.equal(view.layer.children.length, 4);
  assert.ok(view.layer.children.every((slot) => slot.children.length === DAMAGE_NUMBER_DIGITS));
  const project = (x, y, z, out) => { out.x = x; out.y = y - z; return out; };
  const slot = model.add('boss', 1234, true, 100, 200, 0, 0);
  assert.equal(view.draw(0, project, 3, -2), 1);
  const container = view.layer.children[slot];
  const digits = container.children;
  assert.deepEqual(digits.slice(0, 4).map((sprite) => atlas.textures.indexOf(sprite.texture)), [1, 2, 3, 4]);
  assert.equal(digits[4].visible, false);
  assert.ok(digits.slice(0, 4).every((sprite) => sprite.tint === DAMAGE_NUMBER_CRIT_COLOR));
  assert.ok(Math.abs(digits[0].position.x + digits[3].position.x + atlas.widths[4] - 4) < atlas.widths[1], 'roughly centred');
  assert.deepEqual([container.position.x, container.position.y], [103, 198], 'projected plus the shake offset');
  assert.equal(container.scale.x, DAMAGE_NUMBER_CRIT_POP);
  // Rising and fading.
  view.draw(300, project);
  assert.ok(container.position.y < 200);
  const texture = digits[0].texture;
  view.draw(310, project);
  assert.equal(digits[0].texture, texture);
  model.update(700);
  view.draw(700, project);
  assert.equal(container.visible, false);
  view.hide();
  view.destroy();
  assert.equal(view.layer.destroyed, true);
});

test('drawing a full pool for 6,000 frames retains nothing', () => {
  const model = createDamageNumberModel();
  const view = createDamageNumberView({ model, atlas: atlasFor(), ContainerClass: FakeContainer, SpriteClass: FakeSprite });
  const project = (x, y, z, out) => { out.x = x; out.y = y; return out; };
  const run = (from, to) => {
    for (let frame = from; frame < to; frame += 1) {
      const now = frame * 1000 / 60;
      if (frame % 2 === 0) model.add(`e${frame % 40}`, 3 + (frame % 7), frame % 9 === 0, frame % 300, 50, 0, now);
      model.update(now);
      view.draw(now, project, 0, 0);
    }
  };
  run(0, 600);
  gc();
  const before = process.memoryUsage().heapUsed;
  run(600, 6600);
  gc();
  const grown = process.memoryUsage().heapUsed - before;
  assert.ok(grown < 64 * 1024, `retained ${grown} B`);
});

test('feel layer: numbers only when the setting is on; off clears; reset clears; the model runs without a view', () => {
  assert.equal(hmhDamageNumbersEnabled({}), true, 'default on');
  assert.equal(hmhDamageNumbersEnabled({ damageNumbers: false }), false);
  const feel = createHmhFeel();
  assert.equal(feel.damageLayer, null, 'no pixi, no view');
  feel.enemyHit(true, false, 'coin-blaster', false, false, 'e1', 14, 10, 20, 0, 60, true);
  feel.enemyHit(false, false, 'coin-blaster', false, false, 'e2', 9, 10, 20, 0, 60, false);
  feel.enemyHit(false, false, 'coin-blaster', false, false, 'e3', 9, undefined, undefined, 0, 60, true);
  assert.equal(feel.damage.stats.spawned, 1, 'setting off or no point: no number');
  assert.equal(feel.drawDamageNumbers(1000, {}, () => {}, 0, 0), 1);
  assert.equal(feel.drawDamageNumbers(1000, { damageNumbers: false }, () => {}, 0, 0), 0);
  assert.equal(feel.damage.stats.active, 0, 'turning it off clears the pool');
  feel.enemyHit(false, true, 'coin-blaster', false, false, 'e4', 30, 1, 1, 0, 70, true);
  feel.reset();
  assert.equal(feel.damage.stats.active, 0);
  const withView = createHmhFeel({ pixi: { documentRef: fakeDocument().documentRef, ContainerClass: FakeContainer, SpriteClass: FakeSprite, TextureClass: FakeTexture, RectangleClass: FakeRectangle } });
  assert.ok(withView.damageLayer instanceof FakeContainer);
});

test('settings and wiring: bridge optional boolean, portal persistence, standalone off, pause toggle, one feed site', () => {
  const settings = { ...projectHmhRuntimeSettings(HMH_PLAYER_SETTINGS_DEFAULTS) };
  assert.equal(settings.damageNumbers, true);
  const envelope = (type, value) => createBridgeEnvelope({ type, sessionId: 'game-session-numbers', messageId: 'n-1', payload: { settings: value } });
  assert.equal(validateParentMessage(envelope('portal:settings', settings)).ok, true);
  assert.equal(validateParentMessage(envelope('portal:settings', { ...settings, damageNumbers: 1 })).ok, false);
  assert.equal(validateChildMessage(envelope('game:settings', { ...settings, damageNumbers: false })).ok, true);
  assert.equal(projectHmhRuntimeSettings(mergeHmhRuntimeSettings(HMH_PLAYER_SETTINGS_DEFAULTS, { damageNumbers: false })).damageNumbers, false);
  assert.equal(createStandaloneInitPayload().settings.damageNumbers, false, 'standalone baselines stay number-free');
  const html = read('../apps/portal/hmh-reboot/index.html');
  assert.match(html, /<label class="hmh-setting-toggle hmh-setting-feel">\s*<input id="hmhSettingDamageNumbers" type="checkbox" checked>/);
  assert.match(read('../apps/hmh-reboot/src/cockpit-ui.mjs'), /damageNumbers: 'hmhSettingDamageNumbers'/);
  assert.match(main, /const PAUSE_FEEL_KEYS = new Set\(\['hitstop', 'damageNumbers'\]\);/);
  assert.match(main, /damageEvent\.point\?\.x, damageEvent\.point\?\.y, damageEvent\.point\?\.z, tick, settings\.damageNumbers !== false\);/);
  assert.match(main, /app\.stage\.addChildAt\(hmhFeel\.damageLayer, app\.stage\.getChildIndex\(overlayVisuals\)\)/);
  // Telemetry: live count on change only (captures and soak checks read it).
  assert.match(main, /if \(liveDamageNumbers !== damageNumbersLiveSeen\) dataset\.damageNumbersLive = String\(damageNumbersLiveSeen = liveDamageNumbers\);/);
  // No Text, no BitmapText: numbers never re-rasterise.
  const numbers = read('../apps/hmh-reboot/src/damage-numbers.mjs');
  assert.doesNotMatch(numbers, /new (?:Bitmap)?Text\b|from 'pixi\.js'/);
});
