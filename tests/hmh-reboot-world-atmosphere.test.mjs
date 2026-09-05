import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ATMOSPHERE_FOG_MAX_ALPHA,
  ATMOSPHERE_SEAM_UNITS,
  ATMOSPHERE_TINT_MAX_ALPHA,
  DISTRICT_ATMOSPHERE,
  MAX_ATMOSPHERE_SPRITES,
  WORLD_ATMOSPHERE_ART_ID,
  createAtmospherePool,
  createAtmosphereTextures,
  renderWorldAtmosphere,
  resolveAtmosphereBudget,
  resolveAtmosphereTint,
  resolveFogBank,
  resolveMote,
} from '../apps/hmh-reboot/src/world-atmosphere.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { RUNTIME_PERFORMANCE_PROFILES } from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';

const moduleUrl = new URL('../apps/hmh-reboot/src/world-atmosphere.mjs', import.meta.url);
const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const visualUrl = new URL('../scripts/hmh-reboot-visual-regression.mjs', import.meta.url);
const syntaxUrl = new URL('../scripts/syntax-check.mjs', import.meta.url);
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');

class FakePoint {
  set(x, y = x) { this.x = x; this.y = y; }
}
class FakeContainer {
  constructor() { this.children = []; this.visible = true; this.label = ''; this.blendMode = 'normal'; }
  addChild(...children) { this.children.push(...children); return children.at(-1); }
}
class FakeSprite {
  constructor({ texture } = {}) {
    this.texture = texture;
    this.anchor = new FakePoint();
    this.position = new FakePoint();
    this.visible = true;
    this.alpha = 1;
    this.width = 0;
    this.height = 0;
    this.tint = 0xffffff;
  }
}
const fakeTextures = Object.freeze({ haze: { id: 'haze' }, mote: { id: 'mote' } });
const makePool = (max = MAX_ATMOSPHERE_SPRITES) => createAtmospherePool({
  ContainerClass: FakeContainer,
  SpriteClass: FakeSprite,
  textures: fakeTextures,
  max,
});
const allSprites = (pool) => pool.container.children.flatMap((bank) => bank.children);
const camera = (x, y) => ({ x, y, zoom: 1, shakeX: 0, shakeY: 0 });
const DESKTOP = Object.freeze({ width: 1440, height: 900 });
const MOBILE = Object.freeze({ width: 390, height: 844 });
const districts = LEVEL_ONE_WORLD.districts;
const districtById = (id) => districts.find((district) => district.id === id);

const renderInto = ({ pool = makePool(), x, y, view = DESKTOP, tick = 180, profile = RUNTIME_PERFORMANCE_PROFILES.desktop, enabled = true, cullMargin = profile.worldCullMargin } = {}) => {
  pool.begin();
  const report = renderWorldAtmosphere({
    pool,
    districts,
    camera: camera(x, y),
    view,
    tick,
    worldToScreen,
    budget: resolveAtmosphereBudget(profile),
    cullMargin,
    enabled,
  });
  pool.finish();
  return { pool, report };
};
const snapshot = (pool) => allSprites(pool).filter((sprite) => sprite.visible).map((sprite) => [sprite.texture.id, sprite.position.x, sprite.position.y, sprite.width, sprite.height, sprite.alpha, sprite.tint]);

test('the atmosphere table covers exactly the Level 1 districts with capped, frozen values', () => {
  assert.equal(WORLD_ATMOSPHERE_ART_ID, 'projection-world-atmosphere-v1');
  assert.deepEqual(Object.keys(DISTRICT_ATMOSPHERE).sort(), districts.map((district) => district.id).sort());
  assert.equal(Object.isFrozen(DISTRICT_ATMOSPHERE), true);
  assert.ok(ATMOSPHERE_TINT_MAX_ALPHA <= 0.05, 'the colour grade is a whisper, not a filter');
  assert.ok(ATMOSPHERE_FOG_MAX_ALPHA <= 0.14, 'fog over an actor may never mask it');
  for (const [id, spec] of Object.entries(DISTRICT_ATMOSPHERE)) {
    assert.equal(Object.isFrozen(spec), true, `${id} spec must be frozen`);
    assert.ok(spec.tint && Number.isInteger(spec.tint.color) && spec.tint.alpha > 0 && spec.tint.alpha <= ATMOSPHERE_TINT_MAX_ALPHA, `${id} tint alpha must be within the cap`);
    if (spec.fog) {
      assert.equal(Object.isFrozen(spec.fog), true);
      assert.ok(spec.fog.alpha > 0 && spec.fog.alpha <= ATMOSPHERE_FOG_MAX_ALPHA, `${id} fog alpha ${spec.fog.alpha} exceeds the cap`);
      assert.ok(Number.isInteger(spec.fog.color));
      assert.ok(spec.fog.cell[0] > 0 && spec.fog.cell[1] > 0 && spec.fog.size[0] > 0 && spec.fog.size[1] > 0 && spec.fog.speed > 0);
    }
    if (spec.mote) {
      assert.equal(Object.isFrozen(spec.mote), true);
      assert.ok(spec.mote.alpha > 0 && spec.mote.alpha <= 0.6, `${id} additive motes stay under 0.6 alpha`);
      assert.ok(spec.mote.size > 0 && spec.mote.size <= 3, `${id} motes stay at or under 3 px at zoom 1`);
      assert.ok(spec.mote.cell > 0 && spec.mote.period > 0 && spec.mote.perCell >= 1);
    }
  }
  // The brief's per-district identity: embers only in the yard, pollen only in
  // hashwood, dust in the ravine and the mining camp, mist only over the river,
  // and the opening district gets fog but no motes.
  assert.equal(DISTRICT_ATMOSPHERE['frontier-relay'].mote, null);
  assert.ok(DISTRICT_ATMOSPHERE['frontier-relay'].fog);
  assert.equal(DISTRICT_ATMOSPHERE['rugpull-ravine'].fog, null);
  assert.ok(DISTRICT_ATMOSPHERE['rugpull-ravine'].mote);
  assert.equal(DISTRICT_ATMOSPHERE['liquidity-crossing'].mote, null);
  assert.deepEqual(DISTRICT_ATMOSPHERE['liquidity-crossing'].fog.area, [4_500, 0, 5_000, 4_800], 'mist is anchored to the river rect');
  assert.ok(DISTRICT_ATMOSPHERE.hashwood.mote && DISTRICT_ATMOSPHERE.hashwood.fog);
  assert.ok(DISTRICT_ATMOSPHERE['mining-camp'].mote && DISTRICT_ATMOSPHERE['mining-camp'].fog);
  assert.ok(DISTRICT_ATMOSPHERE['liquidation-yard'].mote.vy < 0, 'embers rise');
  assert.ok(DISTRICT_ATMOSPHERE.hashwood.mote.vy > 0, 'pollen falls');
  assert.ok(Number.isInteger(DISTRICT_ATMOSPHERE['liquidation-yard'].mote.color2), 'embers cool toward a second colour');
});

test('the atmosphere budget is derived from the existing particle tiers and never adds a profile field', () => {
  assert.deepEqual(resolveAtmosphereBudget(RUNTIME_PERFORMANCE_PROFILES.desktop), { fog: 10, motes: 30 });
  assert.deepEqual(resolveAtmosphereBudget(RUNTIME_PERFORMANCE_PROFILES.mobile), { fog: 6, motes: 18 });
  assert.deepEqual(resolveAtmosphereBudget(RUNTIME_PERFORMANCE_PROFILES.reducedMotion), { fog: 0, motes: 0 });
  for (const profile of Object.values(RUNTIME_PERFORMANCE_PROFILES)) {
    const budget = resolveAtmosphereBudget(profile);
    assert.ok(budget.fog + budget.motes <= MAX_ATMOSPHERE_SPRITES, `${profile.id} exceeds the pool cap`);
    assert.ok(budget.fog + budget.motes <= profile.particlesPerHazard * LEVEL_ONE_WORLD.interactions.hazards.length, `${profile.id} exceeds the world particle tier`);
    assert.equal(Object.isFrozen(budget), true);
  }
  assert.throws(() => resolveAtmosphereBudget({}), TypeError);
  assert.throws(() => resolveAtmosphereBudget({ particlesPerHazard: 2.5 }), TypeError);
  assert.throws(() => resolveAtmosphereBudget({ particlesPerHazard: -1 }), TypeError);
  assert.ok(MAX_ATMOSPHERE_SPRITES > 0 && MAX_ATMOSPHERE_SPRITES <= 64);
});

test('fog bank and mote resolvers are pure functions of district, lattice cell, index and simulation tick', () => {
  const relay = DISTRICT_ATMOSPHERE['frontier-relay'].fog;
  const bank = resolveFogBank({ districtId: 'frontier-relay', spec: relay, col: 1, row: 2, tick: 300 });
  assert.deepEqual(bank, resolveFogBank({ districtId: 'frontier-relay', spec: relay, col: 1, row: 2, tick: 300 }));
  assert.equal(Object.isFrozen(bank), true);
  assert.equal(bank.color, relay.color);
  assert.ok(bank.alpha >= 0 && bank.alpha <= relay.alpha, 'a bank never exceeds its district ceiling');
  assert.ok(bank.rx > 0 && bank.ry > 0 && bank.rx > bank.ry, 'fog is a low, wide ellipse');
  assert.ok(bank.x >= relay.cell[0] * 1 - bank.rx && bank.x <= relay.cell[0] * 2 + bank.rx, 'a bank stays with its cell');
  assert.ok(bank.y >= relay.cell[1] * 2 - bank.ry && bank.y <= relay.cell[1] * 3 + bank.ry);
  const later = resolveFogBank({ districtId: 'frontier-relay', spec: relay, col: 1, row: 2, tick: 301 });
  assert.notEqual(later.x + later.y * 7, bank.x + bank.y * 7, 'one tick drifts a bank');
  const neighbour = resolveFogBank({ districtId: 'frontier-relay', spec: relay, col: 2, row: 2, tick: 300 });
  assert.notEqual(neighbour.x - relay.cell[0], bank.x, 'neighbouring cells are desynchronised, not tiled copies');
  // A bank fades out at both ends of its drift so wrapping never pops.
  const period = Math.round(relay.cell[0] / relay.speed);
  let minAlpha = Infinity;
  let maxAlpha = 0;
  for (let tick = 0; tick < period; tick += Math.max(1, Math.floor(period / 97))) {
    const sample = resolveFogBank({ districtId: 'frontier-relay', spec: relay, col: 1, row: 2, tick });
    minAlpha = Math.min(minAlpha, sample.alpha);
    maxAlpha = Math.max(maxAlpha, sample.alpha);
  }
  assert.ok(minAlpha < relay.alpha * 0.1, `a bank must dissolve before it wraps (min alpha ${minAlpha})`);
  assert.ok(maxAlpha > relay.alpha * 0.5, `a bank must read at its peak (max alpha ${maxAlpha})`);

  const ember = DISTRICT_ATMOSPHERE['liquidation-yard'].mote;
  const mote = resolveMote({ districtId: 'liquidation-yard', spec: ember, col: 24, row: 3, index: 0, tick: 500 });
  assert.deepEqual(mote, resolveMote({ districtId: 'liquidation-yard', spec: ember, col: 24, row: 3, index: 0, tick: 500 }));
  assert.equal(Object.isFrozen(mote), true);
  assert.ok(mote.alpha >= 0 && mote.alpha <= ember.alpha);
  assert.ok(mote.size > 0 && mote.size <= 3);
  const moteLater = resolveMote({ districtId: 'liquidation-yard', spec: ember, col: 24, row: 3, index: 0, tick: 501 });
  assert.notEqual(moteLater.y, mote.y, 'embers move every tick');
  const sibling = resolveMote({ districtId: 'liquidation-yard', spec: ember, col: 24, row: 3, index: 1, tick: 500 });
  assert.notEqual(sibling.x, mote.x, 'two motes in one cell are not stacked');
  // Embers rise within their lifecycle: a later phase sits higher (smaller y)
  // than an earlier one from the same birth point.
  let rising = 0;
  for (let tick = 0; tick < ember.period - 1; tick += 1) {
    const a = resolveMote({ districtId: 'liquidation-yard', spec: ember, col: 24, row: 3, index: 0, tick });
    const b = resolveMote({ districtId: 'liquidation-yard', spec: ember, col: 24, row: 3, index: 0, tick: tick + 1 });
    if (b.y < a.y) rising += 1;
  }
  assert.ok(rising >= ember.period - 3, `embers must rise on all but the wrap tick, rose on ${rising} of ${ember.period - 1}`);
  const pollen = DISTRICT_ATMOSPHERE.hashwood.mote;
  const p0 = resolveMote({ districtId: 'hashwood', spec: pollen, col: 10, row: 2, index: 0, tick: 10 });
  const p1 = resolveMote({ districtId: 'hashwood', spec: pollen, col: 10, row: 2, index: 0, tick: 11 });
  assert.ok(Math.abs(p1.y - p0.y) < 1 && Math.abs(p1.x - p0.x) < 2, 'pollen is slow');
  assert.throws(() => resolveMote({ districtId: 'hashwood', spec: pollen, col: 10, row: 2, index: 0, tick: -1 }), TypeError);
  assert.throws(() => resolveFogBank({ districtId: 'hashwood', spec: relay, col: 1.5, row: 2, tick: 1 }), TypeError);
});

test('the atmosphere module is projection-only: no wall clock, no RNG, no engine or simulation imports', async () => {
  const source = stripComments(await readFile(moduleUrl, 'utf8'));
  assert.doesNotMatch(source, /Math\.random|Date\.now|performance\.now|requestAnimationFrame/u);
  assert.doesNotMatch(source, /from 'pixi\.js'/u);
  assert.doesNotMatch(source, /from '\.\/(enemy-simulation|movement|collision|elevation|grenades|weapon-system|liquidator-boss|encounter-director|level-one-world|world-production-art|main)/u);
  assert.doesNotMatch(source, /collision|damage|health|armor|spawn|wallet|settlement/iu);
  // Every Graphics arc() would need a moveTo() anchor (Cycle 073 stray-line
  // defect); the bake uses ellipses and circles only.
  assert.doesNotMatch(source, /\.arc\(/u);
});

test('rendering the same camera, view and tick twice is identical; the tick and the camera cell both move the layer', () => {
  const first = renderInto({ x: 900, y: 2_400, tick: 240 });
  const second = renderInto({ x: 900, y: 2_400, tick: 240 });
  assert.deepEqual(snapshot(first.pool), snapshot(second.pool));
  assert.deepEqual(first.report, second.report);
  assert.ok(first.report.fog > 0, 'the opening district carries ground fog');
  assert.equal(first.report.motes, 0, 'the opening district carries no motes');
  const nextTick = renderInto({ x: 900, y: 2_400, tick: 241 });
  assert.notDeepEqual(snapshot(nextTick.pool), snapshot(first.pool), 'a tick drifts the fog');
  const east = renderInto({ x: 900 + 960, y: 2_400, tick: 240 });
  assert.notDeepEqual(snapshot(east.pool).map((entry) => entry.slice(3)), snapshot(first.pool).map((entry) => entry.slice(3)), 'a camera one cell east sees a different set of banks');
});

test('each district renders its own atmosphere identity inside the desktop and mobile budgets', () => {
  const scenes = [
    ['frontier-relay', 900, 2_400, { fog: true, motes: false }],
    ['rugpull-ravine', 3_050, 1_500, { fog: false, motes: true }],
    ['liquidity-crossing', 4_750, 1_700, { fog: true, motes: false }],
    ['hashwood', 7_000, 900, { fog: true, motes: true }],
    ['mining-camp', 9_200, 1_600, { fog: true, motes: true }],
    ['liquidation-yard', 11_000, 800, { fog: true, motes: true }],
  ];
  for (const [id, x, y, expect] of scenes) {
    for (const [profile, view] of [[RUNTIME_PERFORMANCE_PROFILES.desktop, DESKTOP], [RUNTIME_PERFORMANCE_PROFILES.mobile, MOBILE]]) {
      const { pool, report } = renderInto({ x, y, view, profile });
      const budget = resolveAtmosphereBudget(profile);
      assert.ok(report.fog <= budget.fog, `${id} ${profile.id} fog ${report.fog} > ${budget.fog}`);
      assert.ok(report.motes <= budget.motes, `${id} ${profile.id} motes ${report.motes} > ${budget.motes}`);
      assert.equal(report.fog + report.motes, pool.placed);
      assert.equal(pool.dropped, 0, `${id} ${profile.id} must fit the pool`);
      if (profile === RUNTIME_PERFORMANCE_PROFILES.desktop) {
        assert.equal(report.fog > 0, expect.fog, `${id} fog presence`);
        assert.equal(report.motes > 0, expect.motes, `${id} mote presence`);
        if (expect.motes) assert.ok(report.motes >= budget.motes * 0.5, `${id} motes ${report.motes} read too thin against a budget of ${budget.motes}`);
        if (expect.fog && id !== 'liquidity-crossing') assert.ok(report.fog >= 3, `${id} fog ${report.fog} reads too thin`);
      }
      const [fogBank, moteBank] = pool.container.children;
      for (const sprite of fogBank.children.filter((entry) => entry.visible)) {
        assert.equal(sprite.texture, fakeTextures.haze);
        assert.ok(sprite.alpha <= ATMOSPHERE_FOG_MAX_ALPHA + 1e-9);
        assert.ok(sprite.width > sprite.height, 'fog sprites are low and wide');
      }
      for (const sprite of moteBank.children.filter((entry) => entry.visible)) {
        assert.equal(sprite.texture, fakeTextures.mote);
        assert.ok(sprite.width <= 3 * 2 * 1.000001, 'motes stay small');
      }
    }
  }
});

test('mist stays over the river, never over the banks', () => {
  const { pool } = renderInto({ x: 4_750, y: 1_700 });
  const [fogBank] = pool.container.children;
  const mistColor = DISTRICT_ATMOSPHERE['liquidity-crossing'].fog.color;
  const visible = fogBank.children.filter((sprite) => sprite.visible);
  const mist = visible.filter((sprite) => sprite.tint === mistColor);
  assert.ok(mist.length > 0, 'the crossing scene must carry mist');
  const view = DESKTOP;
  for (const sprite of mist) {
    // Undo the projection (parallax included): screen x back to world x for a
    // zoom-1 camera at 4,750.
    const centred = (sprite.position.x - view.width / 2) / 1.06;
    const worldX = centred + 4_750;
    assert.ok(worldX >= 4_500 - 40 && worldX <= 5_000 + 40, `mist bank centred at world x ${worldX} is off the river`);
  }
  // Any other fog on camera here is a neighbour's bank bleeding across its
  // seam cell; it must stay off the visible frame.
  for (const sprite of visible.filter((sprite) => sprite.tint !== mistColor)) {
    assert.ok(sprite.position.x < 0 || sprite.position.x > view.width, `a foreign fog bank sits on the crossing frame at screen x ${sprite.position.x}`);
  }
});

test('atmosphere sprites are culled to the view plus the profile margin and disabled sprites place nothing', () => {
  const { pool, report } = renderInto({ x: 11_000, y: 800, view: MOBILE, profile: RUNTIME_PERFORMANCE_PROFILES.mobile });
  assert.ok(report.fog + report.motes > 0);
  const margin = RUNTIME_PERFORMANCE_PROFILES.mobile.worldCullMargin;
  for (const sprite of allSprites(pool).filter((entry) => entry.visible)) {
    const reach = Math.max(sprite.width, sprite.height) / 2;
    assert.ok(sprite.position.x >= -margin - reach && sprite.position.x <= MOBILE.width + margin + reach, `sprite x ${sprite.position.x} is outside the cull window`);
    assert.ok(sprite.position.y >= -margin - reach && sprite.position.y <= MOBILE.height + margin + reach, `sprite y ${sprite.position.y} is outside the cull window`);
  }
  const off = renderInto({ pool, x: 11_000, y: 800, enabled: false });
  assert.deepEqual(off.report, { fog: 0, motes: 0, dropped: 0 });
  assert.ok(allSprites(pool).every((sprite) => sprite.visible === false), 'a disabled frame hides every pooled sprite');
  const reduced = renderInto({ pool, x: 11_000, y: 800, profile: RUNTIME_PERFORMANCE_PROFILES.reducedMotion });
  assert.deepEqual(reduced.report, { fog: 0, motes: 0, dropped: 0 }, 'the reduced-motion tier yields nothing without a special case');
});

test('the atmosphere pool reuses sprites, honours the hard cap and keeps fog normal-blended under additive motes', () => {
  const pool = makePool();
  assert.equal(pool.artId, WORLD_ATMOSPHERE_ART_ID);
  assert.equal(pool.runtimeAuthority, 'projection-only');
  assert.equal(pool.container.label, 'world-atmosphere');
  const [fogBank, moteBank] = pool.container.children;
  assert.equal(fogBank.blendMode, 'normal');
  assert.equal(moteBank.blendMode, 'add');
  assert.ok(pool.container.children.indexOf(moteBank) > pool.container.children.indexOf(fogBank), 'motes draw above fog');
  pool.begin();
  for (let index = 0; index < 11; index += 1) assert.equal(pool.place({ mote: false, x: index, y: 0, width: 200, height: 80, tint: 0x123456, alpha: 0.1 }), true);
  for (let index = 0; index < 30; index += 1) assert.equal(pool.place({ mote: true, x: index, y: 9, width: 4, height: 4, tint: 0xffaa00, alpha: 0.5 }), true);
  pool.finish();
  assert.equal(pool.placed, 41);
  assert.equal(pool.dropped, 0);
  assert.equal(fogBank.children.length, 11);
  assert.equal(moteBank.children.length, 30);
  assert.equal(fogBank.children[0].texture, fakeTextures.haze);
  assert.equal(moteBank.children[0].texture, fakeTextures.mote);
  assert.equal(moteBank.children[0].tint, 0xffaa00);
  assert.equal(moteBank.children[0].alpha, 0.5);
  assert.equal(fogBank.children[0].anchor.x, 0.5);
  const sprites = allSprites(pool);
  pool.begin();
  for (let index = 0; index < 11; index += 1) pool.place({ mote: false, x: index, y: 0, width: 200, height: 80, tint: 0x123456, alpha: 0.1 });
  for (let index = 0; index < 30; index += 1) pool.place({ mote: true, x: index, y: 9, width: 4, height: 4, tint: 0xffaa00, alpha: 0.5 });
  pool.finish();
  assert.deepEqual(allSprites(pool), sprites, 'a second identical frame allocates nothing');
  assert.ok(allSprites(pool).every((sprite) => sprite.visible));
  pool.begin();
  pool.place({ mote: true, x: 0, y: 0, width: 4, height: 4, tint: 0xffaa00, alpha: 0.5 });
  pool.finish();
  assert.equal(allSprites(pool).filter((sprite) => sprite.visible).length, 1, 'finish hides what the frame did not claim');
  assert.equal(allSprites(pool).length, 41, 'a quiet frame destroys nothing');

  const capped = makePool();
  capped.begin();
  let accepted = 0;
  for (let index = 0; index < MAX_ATMOSPHERE_SPRITES + 1; index += 1) accepted += capped.place({ mote: index % 2 === 0, x: 0, y: 0, width: 4, height: 4, tint: 0xffffff, alpha: 0.3 }) ? 1 : 0;
  capped.finish();
  assert.equal(accepted, MAX_ATMOSPHERE_SPRITES);
  assert.equal(capped.placed, MAX_ATMOSPHERE_SPRITES);
  assert.equal(capped.dropped, 1);
  capped.begin();
  assert.equal(capped.dropped, 0, 'begin resets the frame report');
  assert.equal(capped.place({ mote: true, x: 0, y: 0, width: 4, height: 4, tint: 0xffffff, alpha: 0 }), false, 'an invisible placement is refused without claiming a sprite');
  capped.finish();
  assert.throws(() => createAtmospherePool({ ContainerClass: FakeContainer, SpriteClass: FakeSprite, textures: {} }), TypeError);
  assert.throws(() => createAtmospherePool({ ContainerClass: null, SpriteClass: FakeSprite, textures: fakeTextures }), TypeError);
});

test('atmosphere textures are baked once from injected Graphics with soft falloff and no arc()', () => {
  const generated = [];
  class RecordingGraphics {
    constructor() { this.ops = []; this.destroyed = false; }
    ellipse(...args) { this.ops.push(['ellipse', ...args]); return this; }
    circle(...args) { this.ops.push(['circle', ...args]); return this; }
    fill(options) { this.ops.push(['fill', options]); return this; }
    destroy() { this.destroyed = true; }
  }
  const renderer = {
    generateTexture(options) {
      generated.push(options);
      return { id: `texture-${generated.length}` };
    },
  };
  const textures = createAtmosphereTextures({ renderer, GraphicsClass: RecordingGraphics });
  assert.equal(generated.length, 2, 'one haze ellipse and one mote disc');
  assert.ok(textures.haze && textures.mote && textures.haze !== textures.mote);
  assert.equal(Object.isFrozen(textures), true);
  for (const options of generated) {
    assert.ok(options.target instanceof RecordingGraphics);
    assert.equal(options.target.destroyed, true, 'the scratch Graphics must be released');
    assert.equal(options.antialias, true);
    assert.ok(options.target.ops.filter(([op]) => op === 'fill').length >= 6, 'soft falloff needs several rings');
  }
  assert.ok(generated[0].target.ops.some(([op]) => op === 'ellipse'), 'haze is an ellipse');
  assert.ok(generated[1].target.ops.some(([op]) => op === 'circle'), 'a mote is a disc');
  assert.throws(() => createAtmosphereTextures({ renderer: {}, GraphicsClass: RecordingGraphics }), TypeError);
  assert.throws(() => createAtmosphereTextures({ renderer, GraphicsClass: null }), TypeError);
});

test('the district colour grade blends across a 300-unit seam without a pop', () => {
  assert.equal(ATMOSPHERE_SEAM_UNITS, 300);
  const relay = DISTRICT_ATMOSPHERE['frontier-relay'].tint;
  const ravine = DISTRICT_ATMOSPHERE['rugpull-ravine'].tint;
  const channels = (color) => [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
  const deep = resolveAtmosphereTint({ districts, x: 900 });
  assert.deepEqual(deep, { color: relay.color, alpha: relay.alpha });
  assert.equal(Object.isFrozen(deep), true);
  const seam = resolveAtmosphereTint({ districts, x: 1_800 });
  const expectedMix = channels(relay.color).map((value, index) => Math.round((value + channels(ravine.color)[index]) / 2));
  assert.deepEqual(channels(seam.color), expectedMix, 'the boundary itself is a 50/50 mix');
  assert.ok(Math.abs(seam.alpha - (relay.alpha + ravine.alpha) / 2) < 1e-9);
  assert.deepEqual(resolveAtmosphereTint({ districts, x: 1_800 + ATMOSPHERE_SEAM_UNITS }), { color: ravine.color, alpha: ravine.alpha });
  assert.deepEqual(resolveAtmosphereTint({ districts, x: 1_800 - ATMOSPHERE_SEAM_UNITS }), { color: relay.color, alpha: relay.alpha });
  let previous = resolveAtmosphereTint({ districts, x: 1_400 });
  for (let x = 1_401; x <= 2_200; x += 1) {
    const current = resolveAtmosphereTint({ districts, x });
    assert.ok(Math.abs(current.alpha - previous.alpha) < 0.002, `alpha jumped at x ${x}`);
    const delta = channels(current.color).map((value, index) => Math.abs(value - channels(previous.color)[index]));
    assert.ok(Math.max(...delta) <= 1, `colour jumped by ${Math.max(...delta)} at x ${x}`);
    previous = current;
  }
  // Every boundary in the world is continuous, not just the first one.
  for (const district of districts.slice(1)) {
    const at = resolveAtmosphereTint({ districts, x: district.area.minX });
    const own = DISTRICT_ATMOSPHERE[district.id].tint;
    assert.ok(at.alpha > 0 && at.alpha <= ATMOSPHERE_TINT_MAX_ALPHA);
    assert.ok(resolveAtmosphereTint({ districts, x: district.area.minX + ATMOSPHERE_SEAM_UNITS }).color === own.color);
  }
  assert.throws(() => resolveAtmosphereTint({ districts, x: Number.NaN }), TypeError);
  assert.throws(() => resolveAtmosphereTint({ districts: null, x: 1 }), TypeError);
});

test('main.mjs draws the atmosphere above every body and below every HUD element, gated like the props', async () => {
  const raw = await readFile(mainUrl, 'utf8');
  const source = stripComments(raw);
  assert.match(source, /from '\.\/world-atmosphere\.mjs'/u);
  assert.equal((source.match(/world\.addChild\(/gu) ?? []).length, 1, 'the layer order stays a single call');
  const order = /world\.addChild\(([^)]*)\)/u.exec(source);
  assert.ok(order, 'could not read the world layer order');
  const names = order[1].split(',').map((entry) => entry.trim());
  const layerAt = names.indexOf('atmosphereLayer');
  assert.ok(layerAt >= 0, 'atmosphereLayer is not in the world layer order');
  for (const below of ['worldProduction.root', 'worldDecalLayer', 'groundShadowLayer', 'authoredPropLayer', 'enemyVisuals', 'bossVisual', 'actorVisual', 'heldWeaponLayer', 'combatVisuals', 'weaponVfxLayer', 'projectileImpacts']) {
    assert.ok(names.indexOf(below) >= 0 && names.indexOf(below) < layerAt, `${below} must draw under the atmosphere`);
  }
  assert.ok(layerAt < names.indexOf('collisionDebug'), 'debug overlays stay legible above the fog');
  assert.ok(layerAt < names.indexOf('label'));
  // The colour grade sits on the stage, above the shaking world container and
  // under the on-canvas HUD (health pips, boss bar, damage flash, minimap).
  assert.match(source, /app\.stage\.addChild\(world, atmosphereTint, overlayVisuals, bossLabel, minimap\)/u);
  assert.equal((source.match(/app\.stage\.addChild\(/gu) ?? []).length, 1);
  for (const pin of [
    /createAtmosphereTextures\(\{ renderer: app\.renderer, GraphicsClass: Graphics \}\)/u,
    /createAtmospherePool\(\{/u,
    /atmospherePool\?\.begin\(\)/u,
    /atmospherePool\?\.finish\(\)/u,
    /renderWorldAtmosphere\(\{/u,
    /resolveAtmosphereTint\(\{ districts: LEVEL_ONE_WORLD\.districts, x: camera\.x \}\)/u,
    /budget: atmosphereBudget/u,
    /tick: simulation\?\.tick \?\? 0/u,
    /enabled: !\(settings\.reduceMotion \|\| performanceProfile\.particlesPerHazard === 0\)/u,
    /cullMargin: performanceProfile\.worldCullMargin/u,
    /dataset\.atmosphereSprites = String\(/u,
    /dataset\.atmosphereDropped = String\(/u,
    /dataset\.atmosphereTint = /u,
    /const atmosphereBudget = resolveAtmosphereBudget\(performanceProfile\)/u,
  ]) {
    assert.match(source, pin, `main.mjs is missing ${pin}`);
  }
  // Art must never be able to break a run: the same degrade-to-null rule as
  // the shadows and weapon VFX.
  assert.match(source, /atmospherePool = null;\s*console\.warn\('\[HMH\] world atmosphere disabled'/u);
  // The world hazard particle cap the perf smoke asserts stays byte-identical.
  assert.match(source, /dataset\.worldRenderedParticles = String\(worldArtReport\?\.renderedParticleCount \?\? 0\);/u);
  assert.doesNotMatch(source, /worldRenderedParticles = String\([^)]*atmosphere/u, 'atmosphere never inflates the world particle count');
  // Projection state never lands on simulation entities.
  assert.doesNotMatch(source, /simulation\.atmosphere|actor\.atmosphere|enemy\.atmosphere/u);
});

test('the reduced-motion evidence proves fog and motes are off, and the gates know the new files', async () => {
  const visual = await readFile(visualUrl, 'utf8');
  assert.match(visual, /stage\.dataset\.atmosphereSprites === '0'/u, 'the reduced-motion page must wait for zero atmosphere sprites');
  assert.match(visual, /atmosphereSprites: Number\(stage\?\.dataset\.atmosphereSprites\)/u, 'the evidence must record the count');
  const syntax = await readFile(syntaxUrl, 'utf8');
  assert.match(syntax, /"apps\/hmh-reboot\/src\/world-atmosphere\.mjs"/u);
  assert.match(syntax, /"tests\/hmh-reboot-world-atmosphere\.test\.mjs"/u);
});
