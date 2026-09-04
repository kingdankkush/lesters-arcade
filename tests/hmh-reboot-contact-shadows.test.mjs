import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CONTACT_SHADOW_ART_ID,
  MAX_CONTACT_SHADOWS,
  SHADOW_TINT,
  createContactShadowPool,
  createContactShadowTextures,
  resolveContactShadow,
} from '../apps/hmh-reboot/src/contact-shadows.mjs';

const moduleUrl = new URL('../apps/hmh-reboot/src/contact-shadows.mjs', import.meta.url);
const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');

class FakePoint {
  set(x, y = x) { this.x = x; this.y = y; }
}
class FakeContainer {
  constructor() { this.children = []; this.visible = true; this.label = ''; }
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
  }
}
const fakeTextures = Object.freeze({ blob: { id: 'blob' }, ao: { id: 'ao' } });
const makePool = (max = MAX_CONTACT_SHADOWS) => createContactShadowPool({
  ContainerClass: FakeContainer,
  SpriteClass: FakeSprite,
  textures: fakeTextures,
  max,
});

test('the contact shadow resolver is pure, frozen, and grounded on the camera plane', () => {
  const first = resolveContactShadow({ footprintPx: 24 });
  const repeated = resolveContactShadow({ footprintPx: 24 });
  assert.deepEqual(first, repeated, 'the same footprint must resolve identically');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.runtimeAuthority, 'projection-only');
  // Width is the footprint diameter with a small spill; height follows the
  // 55-degree camera pitch (the baked hero shadow is 66x32, aspect 0.48).
  assert.equal(first.width, 24 * 2 * 1.25);
  assert.ok(Math.abs(first.height / first.width - 0.46) < 1e-9);
  // A wider body casts a proportionally wider blob at rest.
  const wide = resolveContactShadow({ footprintPx: 56 });
  assert.ok(Math.abs(wide.width / first.width - 56 / 24) < 1e-9, 'footprint must scale the blob linearly');
  // Camera zoom scales the blob with everything else.
  assert.equal(resolveContactShadow({ footprintPx: 24, zoom: 2 }).width, first.width * 2);
});

test('elevation softens and shrinks a contact shadow without ever erasing it', () => {
  const grounded = resolveContactShadow({ footprintPx: 20, lift: 0 });
  const low = resolveContactShadow({ footprintPx: 20, lift: 12 });
  const high = resolveContactShadow({ footprintPx: 20, lift: 40 });
  assert.ok(grounded.alpha > low.alpha, 'a lifted body casts a softer shadow');
  assert.ok(low.alpha > high.alpha, 'shadow softening must be monotonic in lift');
  assert.ok(grounded.width > low.width && low.width > high.width, 'a lifted body casts a smaller shadow');
  assert.ok(high.width >= grounded.width * 0.7, 'shrink is capped at 30 percent');
  const far = resolveContactShadow({ footprintPx: 20, lift: 4_000 });
  assert.ok(far.alpha >= 0.06, 'a shadow never disappears entirely');
  assert.ok(far.alpha < 0.12);
  assert.equal(resolveContactShadow({ footprintPx: 20, lift: 0, baseAlpha: 0.2 }).alpha, 0.2);
});

test('the contact shadow resolver fails closed on non-finite projection input', () => {
  assert.throws(() => resolveContactShadow({ footprintPx: Number.NaN }), TypeError);
  assert.throws(() => resolveContactShadow({ footprintPx: 20, lift: Number.POSITIVE_INFINITY }), TypeError);
  assert.throws(() => resolveContactShadow({ footprintPx: 20, zoom: Number.NaN }), TypeError);
  assert.throws(() => resolveContactShadow({ footprintPx: 20, baseAlpha: Number.NaN }), TypeError);
});

test('the shadow pool reuses sprites across frames instead of allocating per frame', () => {
  const pool = makePool();
  assert.equal(pool.container.label, 'ground-contact-shadows');
  pool.begin();
  for (let index = 0; index < 5; index += 1) pool.place({ x: index * 10, y: 40, footprintPx: 20 });
  pool.finish();
  assert.equal(pool.count, 5);
  assert.equal(pool.container.children.length, 5);
  assert.ok(pool.container.children.every((sprite) => sprite.visible === true));
  assert.ok(pool.container.children.every((sprite) => sprite.texture === fakeTextures.blob));
  const sprites = [...pool.container.children];

  pool.begin();
  for (let index = 0; index < 3; index += 1) pool.place({ x: index * 10, y: 40, footprintPx: 20 });
  pool.finish();
  assert.equal(pool.count, 3);
  assert.equal(pool.container.children.length, 5, 'a quieter frame must not allocate or destroy sprites');
  assert.deepEqual(pool.container.children, sprites, 'sprites must be reused in place');
  assert.deepEqual(pool.container.children.map((sprite) => sprite.visible), [true, true, true, false, false]);
});

test('the shadow pool applies the world shadow tint, centre anchor, and resolved geometry', () => {
  const pool = makePool();
  pool.begin();
  pool.place({ x: 120, y: 250, footprintPx: 24, alpha: 0.42 });
  pool.finish();
  const [sprite] = pool.container.children;
  const resolved = resolveContactShadow({ footprintPx: 24, baseAlpha: 0.42 });
  assert.equal(sprite.tint, SHADOW_TINT);
  assert.equal(sprite.anchor.x, 0.5);
  assert.equal(sprite.anchor.y, 0.5);
  assert.equal(sprite.position.x, 120);
  assert.equal(sprite.position.y, 250);
  assert.equal(sprite.width, resolved.width);
  assert.equal(sprite.height, resolved.height);
  assert.equal(sprite.alpha, resolved.alpha);
});

test('the shadow pool is hard-capped and reports what it dropped', () => {
  const pool = makePool(8);
  pool.begin();
  for (let index = 0; index < 18; index += 1) pool.place({ x: index, y: 0, footprintPx: 20 });
  pool.finish();
  assert.equal(pool.count, 8);
  assert.equal(pool.dropped, 10);
  assert.equal(pool.container.children.length, 8);
  pool.begin();
  pool.place({ x: 0, y: 0, footprintPx: 20 });
  assert.equal(pool.dropped, 0, 'begin resets the frame budget report');
  pool.finish();
});

test('ambient occlusion rings are only allocated for the props that ask for one', () => {
  const pool = makePool();
  pool.begin();
  pool.place({ x: 0, y: 0, footprintPx: 20 });
  pool.place({ x: 40, y: 0, footprintPx: 70, ao: true });
  pool.finish();
  const aoSprites = pool.container.children.filter((sprite) => sprite.texture === fakeTextures.ao);
  assert.equal(aoSprites.length, 1, 'exactly one AO ring for the one prop that requested it');
  assert.equal(pool.container.children.length, 3);
  assert.equal(aoSprites[0].tint, SHADOW_TINT);
  assert.ok(aoSprites[0].width > resolveContactShadow({ footprintPx: 70 }).width, 'the AO ring spills past the blob');

  pool.begin();
  pool.place({ x: 0, y: 0, footprintPx: 20 });
  pool.finish();
  assert.equal(pool.container.children.length, 3, 'AO sprites are pooled, not destroyed');
  assert.equal(aoSprites[0].visible, false, 'an unused AO ring must be hidden');
});

test('contact shadow textures are baked once from injected Graphics, never per frame', () => {
  const generated = [];
  class RecordingGraphics {
    constructor() { this.commands = []; this.destroyed = false; }
    ellipse(...args) { this.commands.push(['ellipse', ...args]); return this; }
    fill(options) { this.commands.push(['fill', options]); return this; }
    stroke(options) { this.commands.push(['stroke', options]); return this; }
    destroy() { this.destroyed = true; }
  }
  const renderer = {
    generateTexture(options) {
      generated.push(options);
      return { id: `texture-${generated.length}`, target: options.target };
    },
  };
  const textures = createContactShadowTextures({ renderer, GraphicsClass: RecordingGraphics });
  assert.equal(generated.length, 2, 'one blob texture and one AO texture');
  assert.ok(textures.blob && textures.ao);
  assert.notEqual(textures.blob, textures.ao);
  assert.equal(Object.isFrozen(textures), true);
  for (const options of generated) {
    assert.ok(options.target instanceof RecordingGraphics);
    assert.equal(options.target.destroyed, true, 'the scratch Graphics must be released');
    assert.ok(options.target.commands.some(([command]) => command === 'ellipse'), 'soft falloff is drawn as concentric ellipses');
  }
  assert.throws(() => createContactShadowTextures({ renderer: null, GraphicsClass: RecordingGraphics }), TypeError);
  assert.throws(() => createContactShadowTextures({ renderer, GraphicsClass: null }), TypeError);
});

test('the contact shadow module is projection-only and imports no engine symbols', async () => {
  const source = stripComments(await readFile(moduleUrl, 'utf8'));
  assert.equal(CONTACT_SHADOW_ART_ID, 'projection-contact-shadows-v1');
  assert.ok(MAX_CONTACT_SHADOWS > 0 && MAX_CONTACT_SHADOWS <= 256);
  assert.doesNotMatch(source, /collision|damage|health|armor|speed|spawn|seed|wallet|settlement|Math\.random/iu);
  // The child's Pixi vendor chunk re-exports a fixed symbol list. Importing
  // from 'pixi.js' here compiles and then resolves to undefined at runtime, so
  // every engine class is injected instead.
  assert.doesNotMatch(source, /from 'pixi\.js'/u);
  assert.doesNotMatch(source, /from '\.\/(enemy-simulation|movement|collision|elevation|grenades|weapon-system|liquidator-boss|encounter-director)/u);
});

test('the ground shadow layer sits above the decals and below every body', async () => {
  const source = await readFile(mainUrl, 'utf8');
  const order = /world\.addChild\(([^)]*)\)/u.exec(source);
  assert.ok(order, 'could not read the world layer order');
  const names = order[1].split(',').map((entry) => entry.trim());
  const shadowAt = names.indexOf('groundShadowLayer');
  assert.ok(shadowAt >= 0, 'groundShadowLayer is not in the world layer order');
  assert.ok(shadowAt > names.indexOf('worldDecalLayer'), 'ground history must stay under the shadows');
  for (const above of ['authoredPropLayer', 'enemyVisuals', 'enemyDeathVisuals', 'bossVisual', 'actorVisual']) {
    const at = names.indexOf(above);
    assert.ok(at > shadowAt, `${above} must draw above the ground shadow layer`);
  }
});

test('the render pass drives the shadow pool and reports it, without touching simulation state', async () => {
  const source = stripComments(await readFile(mainUrl, 'utf8'));
  assert.match(source, /createContactShadowPool/u);
  assert.match(source, /createContactShadowTextures/u);
  assert.match(source, /contactShadowPool\?\.begin\(\)/u);
  assert.match(source, /contactShadowPool\?\.finish\(\)/u);
  const placeSites = source.match(/contactShadowPool\?\.place\(/gu) ?? [];
  assert.ok(placeSites.length >= 3, `enemies, corpses and the boss each need a placement site, found ${placeSites.length}`);
  assert.match(source, /contactShadows: contactShadowPool/u, 'authored props must receive the shared pool');
  assert.match(source, /dataset\.contactShadows/u);
  assert.match(source, /dataset\.contactShadowsDropped/u);
  // Projection state lives on display containers and the pool, never on the
  // deterministic entities that serialize into replay and evidence.
  assert.doesNotMatch(source, /(?:enemy|actor|liquidatorBoss|death|grenade)\.contactShadow/u);
});

test('actor shadows land on the sprite foot line, not on the authored pivot', async () => {
  const source = stripComments(await readFile(mainUrl, 'utf8'));
  // The roster pivot is the body's mass centre: an idle liquidator-agent frame
  // is 79 px tall with anchor.y 0.443, so the projected ground point sits
  // roughly at the chest and a shadow drawn there floats above the feet.
  assert.match(source, /const contactShadowFootY = \(display, pose, screenY, zoom\) =>/u);
  assert.match(source, /\(1 - \(pose\?\.anchor\?\.y \?\? 1\)\)/u);
  const footSites = source.match(/y: contactShadowFootY\(/gu) ?? [];
  assert.ok(footSites.length >= 3, `enemies, corpses and the boss all need the foot-line offset, found ${footSites.length}`);
  assert.doesNotMatch(source, /y: enemyScreen\.y,\n\s*footprintPx/u, 'an enemy shadow must not sit on the raw pivot');
  // The pose is read back from the display's own applyPose return, never
  // written onto the enemy the simulation owns.
  assert.match(source, /const enemyPose = enemyMarker\.applyPose\(\{/u);
  assert.match(source, /const bossPose = bossVisual\.applyPose\(\{/u);
});

test('only bodies without their own shadow are tagged for a pool shadow', async () => {
  const source = stripComments(await readFile(mainUrl, 'utf8'));
  const roster = /const createRosterOrVectorDisplay[\s\S]*?\n  \};/u.exec(source);
  assert.ok(roster, 'could not read createRosterOrVectorDisplay');
  const [, rosterBranch = '', vectorBranch = ''] = /\{([\s\S]*?)requestEnemyRosterAtlas\(archetypeId\);([\s\S]*)$/u.exec(roster[0]) ?? [];
  assert.match(rosterBranch, /contactShadowFootprint/u, 'roster sprites carry no baked shadow and need one');
  assert.doesNotMatch(vectorBranch, /contactShadowFootprint/u, 'the vector fallback already draws its own shadow');
  // The hero atlas ships a baked 'shadow' layer, so the player must not be
  // tagged either.
  assert.doesNotMatch(source, /productionHeroDisplay\.contactShadowFootprint/u);
  assert.doesNotMatch(source, /actorVisual\.contactShadowFootprint/u);
});
