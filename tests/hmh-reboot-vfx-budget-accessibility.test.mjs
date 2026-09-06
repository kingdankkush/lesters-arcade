import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as vfx from '../apps/hmh-reboot/src/weapon-vfx.mjs';

class Container {
  constructor() { this.children = []; }
  addChild(child) { child.parent?.removeChild(child); this.children.push(child); child.parent = this; return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parent = null; return child; }
}
class Sprite {
  constructor({ texture }) { this.texture = texture; this.anchor = { set() {} }; this.position = { set() {} }; }
}
const textures = { core: {}, puff: {}, shell: {} };
const sprites = (pool) => pool.container.children.flatMap((bank) => bank.children);
const placement = { texture: 'puff', x: 10, y: 20, width: 8, height: 8 };

test('alternating solid and additive frames never grow the resident sprite pool past its cap', () => {
  const pool = vfx.createWeaponVfxPool({ ContainerClass: Container, SpriteClass: Sprite, textures, max: 4 });
  const identities = new Set();
  for (const pattern of [[false, false, false, false], [true, true, true, true], [true, false, true, false], [false], [], [false, true, false, true]]) {
    pool.begin();
    for (const additive of pattern) assert.equal(pool.place({ ...placement, additive }), true);
    pool.finish();
    const resident = sprites(pool);
    resident.forEach((sprite) => identities.add(sprite));
    assert.ok(resident.length <= 4, `resident sprites ${resident.length} exceeded cap 4`);
    assert.equal(identities.size, 4, 'existing inactive sprites move between banks instead of new allocation');
    assert.equal(resident.filter((sprite) => sprite.visible).length, pattern.length);
    const visibleByBank = pool.container.children.map((bank) => bank.children.filter((sprite) => sprite.visible).length);
    assert.deepEqual(visibleByBank, [pattern.filter((value) => !value).length, pattern.filter(Boolean).length]);
    assert.equal(pool.dropped, 0);
  }
});

test('pool reuse cannot steal a sprite claimed earlier in the same frame', () => {
  const pool = vfx.createWeaponVfxPool({ ContainerClass: Container, SpriteClass: Sprite, textures, max: 3 });
  pool.begin();
  for (let i = 0; i < 3; i++) pool.place(placement);
  pool.finish();
  pool.begin();
  pool.place({ ...placement, tint: 0x123456 });
  pool.place({ ...placement, additive: true });
  pool.place({ ...placement, additive: true });
  assert.equal(pool.place(placement), false);
  pool.finish();
  assert.equal(pool.dropped, 1);
  assert.equal(sprites(pool).length, 3);
  assert.equal(pool.container.children[0].children.filter((sprite) => sprite.visible && sprite.tint === 0x123456).length, 1);
});

test('death feedback reacts to live accessibility settings and profile budget without hiding kill confirmation', () => {
  assert.equal(typeof vfx.resolveKillBurst, 'function');
  const base = { age: 3, color: 0xffaa66, particleScale: 10 };
  const normal = vfx.resolveKillBurst(base);
  const mobile = vfx.resolveKillBurst({ ...base, particleScale: 6 });
  const calm = vfx.resolveKillBurst({ ...base, reduceMotion: true, reduceFlash: true });
  assert.equal(normal.shardCount, 8);
  assert.equal(mobile.shardCount, 5);
  assert.equal(calm.shardCount, 0);
  assert.equal(calm.puff, null, 'no expanding death cloud with reduced motion');
  assert.notEqual(calm.ringColor, 0xffffff);
  assert.ok(calm.ringAlpha <= vfx.FLASH_SAFE.maxCoreAlpha);
  assert.ok(calm.ringRadius > 0 && calm.ringAlpha > 0, 'low-motion kill confirmation remains visible');
  assert.equal(calm.ringRadius, vfx.resolveKillBurst({ ...base, age: 8, reduceMotion: true }).ringRadius, 'no expanding ring under reduced motion');
  assert.deepEqual(normal, vfx.resolveKillBurst(base));
  assert.ok(Object.isFrozen(normal));
  assert.equal(vfx.resolveKillBurst({ ...base, particleScale: 0 }).shardCount, 0);
  assert.equal(vfx.resolveKillBurst({ ...base, particleScale: 1000 }).shardCount, 8, 'count is hard bounded');
});

test('death blood is opt-in, fades monotonically and expires; shield hits never emit blood', () => {
  assert.equal(typeof vfx.resolveKillBurst, 'function');
  const base = { color: 0xffaa66, particleScale: 10 };
  assert.notEqual(vfx.resolveKillBurst(base).puff.color, 0x7a1220);
  assert.equal(vfx.resolveKillBurst({ ...base, gore: true }).puff.color, 0x7a1220);
  for (const reduceFlash of [false, true]) {
    let previous = 1;
    for (let age = 0; age <= 12; age++) {
      const burst = vfx.resolveKillBurst({ ...base, age, reduceFlash });
      assert.ok(burst.ringAlpha <= previous);
      previous = burst.ringAlpha;
    }
  }
  assert.equal(vfx.resolveKillBurst({ ...base, age: 13 }).visible, false);
  assert.equal(vfx.resolveKillBurst({ ...base, age: -1 }).visible, false);
  const shielded = { surface: 'flesh', shielded: true, age: 1, sparkBase: 4 };
  assert.deepEqual(vfx.resolveImpactBurst({ ...shielded, gore: true }), vfx.resolveImpactBurst({ ...shielded, gore: false }), 'a shield absorbs the strike; no red cloud before flesh contact');
});

test('runtime kill drawing consumes the tested live-settings resolver and exposes actual draw evidence only in debug mode', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const kill = source.slice(source.indexOf("} else if (event.type === 'kill') {"), source.indexOf("} else if (event.type === 'melee') {"));
  assert.match(kill, /resolveKillBurst\(\{/);
  for (const setting of ['reduceMotion', 'reduceFlash', 'gore']) assert.match(kill, new RegExp(`${setting}: settings\\.${setting}`));
  assert.match(kill, /burst\.shardCount/);
  assert.match(kill, /drawnKillFx/);
  assert.match(source, /dataset\.killFxDrawn/);
});
