import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { HMH_WEAPON_DEFINITIONS } from '../apps/hmh-reboot/src/weapon-system.mjs';
import {
  FLASH_SAFE,
  IMPACT_SURFACES,
  MAX_WEAPON_VFX_SPRITES,
  WEAPON_VFX,
  WEAPON_VFX_ART_ID,
  WEAPON_VFX_COLORS,
  classifyImpactSurface,
  createWeaponVfxPool,
  createWeaponVfxTextures,
  resolveImpactBurst,
  resolveMuzzleFlash,
  resolveShellEject,
  resolveTracer,
} from '../apps/hmh-reboot/src/weapon-vfx.mjs';

const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const moduleUrl = new URL('../apps/hmh-reboot/src/weapon-vfx.mjs', import.meta.url);
const WEAPON_IDS = Object.keys(HMH_WEAPON_DEFINITIONS);
const PROJECTILE_WEAPONS = ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'hash-rail', 'launcher-rig'];

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const channel = (color, shift) => (color >>> shift) & 0xff;
// A colour "reads red" when its red channel clearly dominates both others.
const redDominant = (color) => channel(color, 16) > Math.max(channel(color, 8), channel(color, 0)) * 1.5;

// V-1. Every weapon must be identifiable from its muzzle and impact alone. One
// shared flash shape with a hue swap was the state on the Cycle 072 baseline.
test('every weapon has a VFX identity row and no two rows read alike', () => {
  assert.equal(WEAPON_VFX_ART_ID, 'projection-weapon-vfx-v1');
  assert.ok(Object.isFrozen(WEAPON_VFX));
  assert.deepEqual(Object.keys(WEAPON_VFX).sort(), [...WEAPON_IDS].sort(), 'the table must cover exactly the eight weapon ids');
  const signatures = new Set();
  for (const weaponId of WEAPON_IDS) {
    const row = WEAPON_VFX[weaponId];
    assert.ok(Object.isFrozen(row), `${weaponId} row must be frozen`);
    for (const key of ['muzzle', 'tracer', 'impactBurst', 'shell']) assert.ok(row[key], `${weaponId} is missing ${key}`);
    assert.ok(['star', 'cone', 'ring', 'puff', 'none'].includes(row.muzzle.shape), `${weaponId} muzzle shape ${row.muzzle.shape}`);
    assert.ok(['streak', 'pellet', 'bead', 'lance', 'none'].includes(row.tracer.style), `${weaponId} tracer style ${row.tracer.style}`);
    assert.ok(['brass', 'shotshell', 'casing', 'none'].includes(row.shell.kind), `${weaponId} shell kind ${row.shell.kind}`);
    assert.equal(row.muzzle.color, WEAPON_VFX_COLORS[weaponId], `${weaponId} muzzle colour must be the weapon colour`);
    assert.ok(Number.isInteger(row.muzzle.lifeTicks) && row.muzzle.lifeTicks >= 0);
    signatures.add(JSON.stringify(row));
  }
  assert.equal(signatures.size, WEAPON_IDS.length, 'two weapons share an identical VFX identity');
  // Muzzle + tracer alone must separate every projectile weapon.
  const projectileIdentity = new Set(PROJECTILE_WEAPONS.map((id) => JSON.stringify([WEAPON_VFX[id].muzzle, WEAPON_VFX[id].tracer])));
  assert.equal(projectileIdentity.size, PROJECTILE_WEAPONS.length);
  // The channel, flame and melee weapons keep their own event renderers.
  for (const id of ['lightning-ledger', 'bear-market-burner', 'forked-standard']) {
    assert.equal(WEAPON_VFX[id].muzzle.shape, 'none');
    assert.equal(WEAPON_VFX[id].tracer.style, 'none');
    assert.equal(WEAPON_VFX[id].shell.kind, 'none');
  }
});

test('muzzle flash is deterministic and only ever fades', () => {
  for (const weaponId of WEAPON_IDS) {
    for (const reduceFlash of [false, true]) {
      const muzzle = WEAPON_VFX[weaponId].muzzle;
      const life = muzzle.lifeTicks;
      // The resolved life may stretch under reduceFlash (see the minigun).
      const resolvedLife = reduceFlash && muzzle.steadyLifeTicks > 0 ? muzzle.steadyLifeTicks : life;
      let previousCore = Infinity;
      let previousHalo = Infinity;
      for (let age = 0; age <= life + 1; age += 1) {
        const first = resolveMuzzleFlash({ weaponId, age, zoom: 1, reduceFlash });
        const second = resolveMuzzleFlash({ weaponId, age, zoom: 1, reduceFlash });
        assert.deepEqual(first, second, `${weaponId} age ${age} is not deterministic`);
        assert.ok(Object.isFrozen(first));
        assert.ok(first.coreAlpha <= previousCore + 1e-9, `${weaponId} core alpha rose at age ${age} (reduceFlash ${reduceFlash})`);
        assert.ok(first.haloAlpha <= previousHalo + 1e-9, `${weaponId} halo alpha rose at age ${age} (reduceFlash ${reduceFlash})`);
        previousCore = first.coreAlpha;
        previousHalo = first.haloAlpha;
        for (const value of [first.coreRadius, first.haloRadius, first.coreAlpha, first.haloAlpha]) assert.ok(Number.isFinite(value));
        // Past its life the flash reports invisible instead of a stale frame.
        assert.equal(first.visible, age <= resolvedLife && muzzle.shape !== 'none', `${weaponId} visibility at age ${age}`);
        if (first.visible) {
          assert.equal(first.lifeTicks, resolvedLife);
          assert.equal(first.shape, muzzle.shape, 'the renderer picks smoke vs light from the shape');
        }
      }
    }
  }
  // Past the table's life the flash reports invisible instead of a stale frame.
  assert.equal(resolveMuzzleFlash({ weaponId: 'coin-blaster', age: 99 }).visible, false);
  assert.equal(resolveMuzzleFlash({ weaponId: 'lightning-ledger', age: 0 }).visible, false, 'channel weapons carry no muzzle flash');
});

test('reduceFlash clamps every muzzle flash into the photosensitivity-safe envelope', () => {
  assert.ok(Object.isFrozen(FLASH_SAFE));
  assert.equal(FLASH_SAFE.whiteCoreForbidden, true);
  for (const weaponId of WEAPON_IDS) {
    const life = WEAPON_VFX[weaponId].muzzle.lifeTicks;
    for (let age = 0; age <= life; age += 1) {
      const flash = resolveMuzzleFlash({ weaponId, age, zoom: 1, reduceFlash: true });
      if (!flash.visible) continue;
      assert.notEqual(flash.coreColor, 0xffffff, `${weaponId} keeps a white core under reduceFlash`);
      assert.ok(flash.coreAlpha <= FLASH_SAFE.maxCoreAlpha + 1e-9, `${weaponId} core alpha ${flash.coreAlpha}`);
      assert.ok(flash.haloAlpha <= FLASH_SAFE.maxHaloAlpha + 1e-9, `${weaponId} halo alpha ${flash.haloAlpha}`);
      assert.ok(flash.coreRadius <= FLASH_SAFE.maxCoreRadiusPx + 1e-9, `${weaponId} core radius ${flash.coreRadius}`);
      assert.equal(flash.spokes.length, 0, `${weaponId} still throws spokes under reduceFlash`);
    }
  }
  // The clamp is a clamp, not a constant: the unrestricted pistol flash is hotter.
  const loud = resolveMuzzleFlash({ weaponId: 'coin-blaster', age: 0 });
  const safe = resolveMuzzleFlash({ weaponId: 'coin-blaster', age: 0, reduceFlash: true });
  assert.ok(loud.coreAlpha > safe.coreAlpha);
  assert.equal(loud.coreColor, 0xffffff, 'the default pistol core is hot white');
  assert.ok(loud.spokes.length >= 4, 'the pistol reads as a star');
  // Sustained fire under reduceFlash must not strobe: the minigun flash holds
  // a flat, low alpha across a life that covers its own fire cadence.
  const cadenceTicks = Math.round(60 / HMH_WEAPON_DEFINITIONS['auto-miner'].fireRatePerSecond);
  const minigun = WEAPON_VFX['auto-miner'].muzzle;
  assert.ok(minigun.lifeTicks < cadenceTicks, 'the unrestricted minigun flash must clear before the next shot');
  const steady = Array.from({ length: cadenceTicks + 1 }, (_, age) => resolveMuzzleFlash({ weaponId: 'auto-miner', age, reduceFlash: true }));
  assert.ok(steady.every((flash) => flash.visible), 'reduceFlash extends the minigun glow across its cadence so it reads as a lamp');
  assert.equal(new Set(steady.map((flash) => flash.coreAlpha.toFixed(4))).size, 1, 'no per-tick alternation under reduceFlash');
});

test('tracer style follows weapon identity, then upgrade tags', () => {
  const styles = PROJECTILE_WEAPONS.filter((id) => id !== 'launcher-rig').map((weaponId) => resolveTracer({ weaponId }));
  assert.equal(new Set(styles.map((tracer) => tracer.style)).size, styles.length, 'pistol, shotgun, minigun and rail must not share a tracer style');
  for (const tracer of styles) {
    assert.ok(Object.isFrozen(tracer));
    assert.ok(tracer.width > 0 && tracer.glowWidth >= tracer.width, 'a core stroke sits inside a glow stroke');
    assert.ok(tracer.tailScale > 0);
  }
  const pellet = resolveTracer({ weaponId: 'scatter-shotgun' });
  const streak = resolveTracer({ weaponId: 'coin-blaster' });
  assert.equal(pellet.style, 'pellet');
  assert.ok(pellet.width < streak.width && pellet.tailScale < streak.tailScale, 'pellets read as thin, short slugs');
  assert.equal(resolveTracer({ weaponId: 'auto-miner' }).style, 'bead');
  assert.equal(resolveTracer({ weaponId: 'hash-rail' }).style, 'lance');
  assert.equal(resolveTracer({ weaponId: 'launcher-rig' }).style, 'none', 'the launcher flies a grenade, not a tracer');
  // Upgrades stay legible as upgrades (weapon-capstone tests pin the tag).
  assert.equal(resolveTracer({ weaponId: 'coin-blaster', projectileTag: 'tracer-round' }).style, 'tracer');
  assert.equal(resolveTracer({ weaponId: 'coin-blaster', policyType: 'pierce' }).style, 'lance');
  assert.equal(resolveTracer({ weaponId: 'hash-rail', reduceFlash: true }).afterImage, false, 'the rail after-image is a flash effect');
  assert.equal(resolveTracer({ weaponId: 'hash-rail' }).afterImage, true);
  // Called from inside the frame loop: an unknown weapon degrades, never throws.
  assert.equal(resolveTracer({ weaponId: 'not-a-weapon' }).style, 'streak');
  assert.equal(resolveTracer({}).style, 'streak');
});

// V-2. Surface classes come from the render-side ground query, the district
// material map and the blocker's visualKind, never from simulation state.
test('impact surfaces classify from the render-side world lookups', () => {
  assert.deepEqual([...IMPACT_SURFACES], ['flesh', 'dirt', 'rock', 'metal', 'water']);
  assert.equal(classifyImpactSurface({ hitKind: 'target' }), 'flesh');
  assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'water', deepWater: true }), 'water');
  assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'shallow-water', deepWater: false }), 'water');
  assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'ground', deepWater: true }), 'water');
  assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'ledge', districtId: 'frontier-relay' }), 'rock');
  assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'ramp', districtId: 'frontier-relay' }), 'rock');
  assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'ground', districtId: 'rugpull-ravine' }), 'rock');
  assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'bridge', districtId: 'liquidity-crossing' }), 'metal');
  assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'ground', districtId: 'liquidation-yard' }), 'metal');
  for (const districtId of ['frontier-relay', 'liquidity-crossing', 'hashwood', 'mining-camp']) {
    assert.equal(classifyImpactSurface({ hitKind: 'ground', surfaceKind: 'ground', districtId }), 'dirt', districtId);
  }
  assert.equal(classifyImpactSurface({ hitKind: 'cover', blockerVisualKind: 'cliff' }), 'rock');
  for (const blockerVisualKind of ['containers', 'machinery', 'bridge-rail', 'building']) {
    assert.equal(classifyImpactSurface({ hitKind: 'cover', blockerVisualKind }), 'metal', blockerVisualKind);
  }
  for (const blockerVisualKind of ['fence', 'dense-trees']) {
    assert.equal(classifyImpactSurface({ hitKind: 'cover', blockerVisualKind }), 'dirt', blockerVisualKind);
  }
  // Unknown or missing inputs degrade to dirt; the frame loop must never throw.
  assert.equal(classifyImpactSurface({ hitKind: 'cover', blockerVisualKind: 'unmapped' }), 'dirt');
  assert.equal(classifyImpactSurface({ hitKind: 'ground' }), 'dirt');
  assert.equal(classifyImpactSurface({}), 'dirt');
  assert.equal(classifyImpactSurface(undefined), 'dirt');
});

test('impact bursts scale with the performance profile and honour gore, reduceMotion and reduceFlash', () => {
  const base = { surface: 'metal', weaponId: 'coin-blaster', critical: false, age: 0, sparkBase: 4, lifeTicks: 12 };
  const desktop = resolveImpactBurst({ ...base, particleScale: 10 });
  const mobile = resolveImpactBurst({ ...base, particleScale: 6 });
  const reduced = resolveImpactBurst({ ...base, particleScale: 0 });
  assert.ok(Object.isFrozen(desktop));
  assert.ok(desktop.sparkCount > 0, 'desktop must draw sparks');
  assert.equal(mobile.sparkCount, Math.round(desktop.sparkCount * 0.6), 'mobile draws 60% of the desktop fan');
  assert.equal(reduced.sparkCount, 0, 'the reduced-motion profile draws no sparks');
  assert.ok(reduced.ringRadius > 0 && reduced.ringAlpha > 0, 'the ring survives so the hit still registers');
  assert.equal(resolveImpactBurst({ ...base, particleScale: 10, reduceMotion: true }).sparkCount, 0, 'the reduceMotion setting also silences sparks');
  assert.equal(resolveImpactBurst({ ...base, particleScale: 10, sparkBase: 0 }).sparkCount, 0, 'a zero base (profile-gated in main) draws nothing');
  // Deterministic: same inputs, same frozen record, for the whole life.
  for (let age = 0; age <= 12; age += 1) {
    assert.deepEqual(resolveImpactBurst({ ...base, particleScale: 10, age }), resolveImpactBurst({ ...base, particleScale: 10, age }));
  }
  // Criticals are a spike, and reduceFlash drops the white-yellow highlight.
  const critical = resolveImpactBurst({ ...base, particleScale: 10, critical: true });
  assert.ok(critical.sparkCount > desktop.sparkCount);
  assert.equal(critical.ringColor, 0xfff06a);
  const criticalSafe = resolveImpactBurst({ ...base, particleScale: 10, critical: true, reduceFlash: true });
  assert.notEqual(criticalSafe.ringColor, 0xfff06a, 'reduceFlash must not keep the hot critical highlight');
  assert.ok(criticalSafe.ringAlpha <= critical.ringAlpha);
  // Flesh: no red unless the bridge-supplied gore setting is on.
  const dust = resolveImpactBurst({ ...base, surface: 'flesh', particleScale: 10 });
  assert.ok(!redDominant(dust.sparkColor), `gore off must not spray red sparks (${dust.sparkColor.toString(16)})`);
  assert.ok(dust.puff && !redDominant(dust.puff.color), 'gore off shows a dull dust puff');
  const gore = resolveImpactBurst({ ...base, surface: 'flesh', particleScale: 10, gore: true });
  assert.ok(redDominant(gore.sparkColor), 'gore on sprays directional red');
  assert.ok(gore.sparkGravity > 0, 'blood falls');
});

test('each surface class produces a burst that reads as that surface', () => {
  const bursts = Object.fromEntries(IMPACT_SURFACES.map((surface) => [
    surface,
    resolveImpactBurst({ surface, weaponId: 'coin-blaster', age: 2, sparkBase: 4, particleScale: 10, lifeTicks: 12 }),
  ]));
  const signature = (burst) => JSON.stringify([burst.ringColor, burst.sparkColor, burst.sparkGravity, burst.sparkLength, burst.puff?.color ?? null, burst.splash]);
  assert.equal(new Set(Object.values(bursts).map(signature)).size, IMPACT_SURFACES.length, 'two surfaces draw the same burst');
  assert.equal(bursts.water.splash, true, 'water throws a splash ring');
  assert.ok(bursts.water.sparkGravity > 0, 'droplets fall back');
  assert.equal(bursts.metal.sparkGravity, 0, 'metal sparks fly straight');
  assert.ok(bursts.metal.sparkLength > bursts.rock.sparkLength, 'metal sparks are long streaks, rock chips are short');
  assert.ok(bursts.rock.sparkGravity > 0 && bursts.dirt.sparkGravity > 0, 'chips and clods fall');
  assert.ok(bursts.dirt.puff && bursts.dirt.puff.radius > 0, 'dirt kicks up a puff');
  assert.equal(bursts.metal.puff, null, 'metal has no dust');
  // Unknown surface degrades to dirt rather than throwing mid-frame.
  assert.deepEqual(resolveImpactBurst({ surface: 'asphalt', weaponId: 'coin-blaster', age: 2, sparkBase: 4, particleScale: 10, lifeTicks: 12 }), bursts.dirt);
});

test('shell ejects are per-weapon, deterministic and arc back to the ground', () => {
  assert.equal(resolveShellEject({ weaponId: 'hash-rail', age: 0, direction: { x: 1, y: 0 } }), null, 'the rail gun ejects nothing');
  assert.equal(resolveShellEject({ weaponId: 'lightning-ledger', age: 0, direction: { x: 1, y: 0 } }), null);
  const pistol = resolveShellEject({ weaponId: 'coin-blaster', age: 0, direction: { x: 1, y: 0 }, seed: 'a' });
  const shotgun = resolveShellEject({ weaponId: 'scatter-shotgun', age: 0, direction: { x: 1, y: 0 }, seed: 'a' });
  assert.equal(pistol.kind, 'brass');
  assert.equal(shotgun.kind, 'shotshell');
  assert.notEqual(pistol.tint, shotgun.tint);
  assert.ok(shotgun.width > pistol.width, 'a shotshell is fatter than a pistol casing');
  let previousAlpha = Infinity;
  let peakLift = 0;
  for (let age = 0; age <= 12; age += 1) {
    const shell = resolveShellEject({ weaponId: 'coin-blaster', age, direction: { x: 1, y: 0 }, seed: 'a' });
    assert.deepEqual(shell, resolveShellEject({ weaponId: 'coin-blaster', age, direction: { x: 1, y: 0 }, seed: 'a' }));
    assert.ok(shell.alpha <= previousAlpha + 1e-9, 'a casing fades, never brightens');
    previousAlpha = shell.alpha;
    peakLift = Math.max(peakLift, shell.lift);
    assert.ok(shell.lift >= -1e-9, 'a casing never sinks below the ground');
    // Ejected to the shooter's right, which for a shot fired along +x is +y.
    assert.ok(shell.dy > 0 || age === 0, `casing must eject to the right (dy ${shell.dy})`);
  }
  assert.ok(peakLift > 0, 'the casing arcs upward before it lands');
  assert.ok(resolveShellEject({ weaponId: 'coin-blaster', age: 12, direction: { x: 1, y: 0 }, seed: 'a' }).lift < peakLift, 'it comes back down');
  assert.notDeepEqual(
    resolveShellEject({ weaponId: 'coin-blaster', age: 4, direction: { x: 1, y: 0 }, seed: 'a' }),
    resolveShellEject({ weaponId: 'coin-blaster', age: 4, direction: { x: 1, y: 0 }, seed: 'b' }),
    'the seed varies the tumble so a burst of casings does not draw as one',
  );
});

class FakeContainer {
  constructor() { this.children = []; this.label = ''; this.blendMode = 'normal'; }
  addChild(...children) { this.children.push(...children); return children[0]; }
}
class FakeSprite {
  constructor({ texture } = {}) {
    this.texture = texture; this.visible = true; this.alpha = 1; this.tint = 0xffffff; this.rotation = 0;
    this.width = 0; this.height = 0; this.label = '';
    this.anchor = { set: (x, y) => { this.anchorX = x; this.anchorY = y; } };
    this.position = { set: (x, y) => { this.x = x; this.y = y; } };
  }
}
const fakeTextures = Object.freeze({ core: { id: 'core' }, puff: { id: 'puff' }, shell: { id: 'shell' } });
const allSprites = (pool) => [...pool.container.children.flatMap((bank) => bank.children)];

test('the sprite pool is capped, reports drops, hides unclaimed sprites and allocates nothing on a repeat frame', () => {
  assert.equal(MAX_WEAPON_VFX_SPRITES, 192);
  const pool = createWeaponVfxPool({ ContainerClass: FakeContainer, SpriteClass: FakeSprite, textures: fakeTextures, max: 4 });
  assert.equal(pool.artId, WEAPON_VFX_ART_ID);
  assert.ok(Object.isFrozen(pool));
  const draw = () => {
    pool.begin();
    const placed = [
      pool.place({ texture: 'core', x: 1, y: 2, width: 10, height: 10, tint: 0xff0000, alpha: 0.5, additive: true }),
      pool.place({ texture: 'puff', x: 3, y: 4, width: 20, height: 12, tint: 0x00ff00, alpha: 0.4 }),
      pool.place({ texture: 'shell', x: 5, y: 6, width: 3, height: 6, rotation: 1.2, tint: 0xd9a441, alpha: 1 }),
      pool.place({ texture: 'core', x: 7, y: 8, width: 8, height: 8, tint: 0xffffff, alpha: 0.9, additive: true }),
      pool.place({ texture: 'core', x: 9, y: 9, width: 8, height: 8, tint: 0xffffff, alpha: 0.9, additive: true }),
    ];
    pool.finish();
    return placed;
  };
  const first = draw();
  assert.deepEqual(first, [true, true, true, true, false], 'the fifth sprite is over the cap');
  assert.equal(pool.placed, 4);
  assert.equal(pool.dropped, 1);
  const sprites = allSprites(pool);
  assert.equal(sprites.length, 4, 'exactly the claimed sprites exist');
  assert.ok(sprites.every((sprite) => sprite.visible));
  // Additive sprites live in the additive bank; puff and shell in the solid one.
  const [solidBank, glowBank] = pool.container.children;
  assert.equal(solidBank.blendMode, 'normal');
  assert.equal(glowBank.blendMode, 'add');
  assert.equal(glowBank.children.length, 2);
  assert.equal(solidBank.children.length, 2);
  assert.ok(pool.container.children.indexOf(glowBank) > pool.container.children.indexOf(solidBank), 'glow draws above puffs and shells');
  const shell = solidBank.children.find((sprite) => sprite.texture === fakeTextures.shell);
  assert.equal(shell.rotation, 1.2);
  assert.equal(shell.tint, 0xd9a441);
  // Second identical frame: no new sprites, every claimed one still visible.
  draw();
  assert.equal(allSprites(pool).length, 4, 'a repeat frame must not allocate');
  // A quieter frame hides the unclaimed sprites instead of destroying them.
  pool.begin();
  pool.place({ texture: 'core', x: 0, y: 0, width: 4, height: 4, tint: 0xffffff, alpha: 1, additive: true });
  pool.finish();
  assert.equal(pool.placed, 1);
  assert.equal(allSprites(pool).filter((sprite) => sprite.visible).length, 1);
  assert.equal(allSprites(pool).length, 4);
  // Degenerate placements are refused without consuming the cap.
  pool.begin();
  assert.equal(pool.place({ texture: 'core', x: 0, y: 0, width: 0, height: 4, tint: 0xffffff, alpha: 1 }), false);
  assert.equal(pool.place({ texture: 'core', x: 0, y: 0, width: 4, height: 4, tint: 0xffffff, alpha: 0 }), false);
  assert.equal(pool.place({ texture: 'missing', x: 0, y: 0, width: 4, height: 4, tint: 0xffffff, alpha: 1 }), false);
  assert.equal(pool.placed, 0);
  assert.equal(pool.dropped, 0);
  pool.finish();
  assert.throws(() => createWeaponVfxPool({ ContainerClass: FakeContainer, SpriteClass: FakeSprite, textures: {} }), /textures/);
});

test('textures bake once through the renderer and refuse to run without one', () => {
  const generated = [];
  const renderer = {
    generateTexture: (options) => {
      generated.push(options);
      return { baked: generated.length };
    },
  };
  class FakeGraphics {
    constructor() { this.ops = []; this.destroyed = false; }
    circle(...args) { this.ops.push(['circle', ...args]); return this; }
    ellipse(...args) { this.ops.push(['ellipse', ...args]); return this; }
    rect(...args) { this.ops.push(['rect', ...args]); return this; }
    roundRect(...args) { this.ops.push(['roundRect', ...args]); return this; }
    fill(...args) { this.ops.push(['fill', ...args]); return this; }
    destroy() { this.destroyed = true; }
  }
  const textures = createWeaponVfxTextures({ renderer, GraphicsClass: FakeGraphics });
  assert.deepEqual(Object.keys(textures).sort(), ['core', 'puff', 'shell']);
  assert.ok(Object.isFrozen(textures));
  assert.equal(generated.length, 3, 'one bake per texture, at boot, never per frame');
  for (const options of generated) {
    assert.ok(options.target instanceof FakeGraphics);
    assert.ok(options.target.destroyed, 'the source graphic is released after the bake');
    assert.ok(options.target.ops.length >= 2, 'every texture is more than a single flat fill');
    assert.equal(options.antialias, true);
  }
  assert.throws(() => createWeaponVfxTextures({ renderer: {}, GraphicsClass: FakeGraphics }), /renderer/);
  assert.throws(() => createWeaponVfxTextures({ renderer, GraphicsClass: null }), /GraphicsClass/);
});

test('main.mjs wires the weapon VFX layer above combat visuals, emits surface-typed impacts and reports the pool', async () => {
  const raw = await readFile(mainUrl, 'utf8');
  const source = stripComments(raw);
  assert.match(source, /from '\.\/weapon-vfx\.mjs'/u);
  assert.match(source, /const WEAPON_COLORS = WEAPON_VFX_COLORS/u, 'the colour table has one home');
  const order = /world\.addChild\(([^)]*)\)/u.exec(source);
  assert.ok(order, 'could not read the world layer order');
  const names = order[1].split(',').map((entry) => entry.trim());
  const layerAt = names.indexOf('weaponVfxLayer');
  assert.ok(layerAt >= 0, 'weaponVfxLayer is not in the world layer order');
  assert.ok(layerAt > names.indexOf('combatVisuals'), 'pooled sprites draw above the vector combat layer');
  assert.ok(layerAt > names.indexOf('actorVisual'), 'muzzle sprites must not be occluded by the hero');
  assert.ok(layerAt < names.indexOf('projectileImpacts'), 'the gold hit ring stays on top');
  assert.equal((source.match(/world\.addChild\(/gu) ?? []).length, 1, 'the layer order stays a single call');
  for (const pin of [
    /createWeaponVfxTextures\(/u,
    /createWeaponVfxPool\(/u,
    /weaponVfxPool\?\.begin\(\)/u,
    /weaponVfxPool\?\.finish\(\)/u,
    /resolveMuzzleFlash\(\{/u,
    /resolveTracer\(\{/u,
    /resolveImpactBurst\(\{/u,
    /resolveShellEject\(\{/u,
    /classifyImpactSurface\(\{/u,
    /hitKind: 'target'/u,
    /hitKind: 'cover'/u,
    /hitKind: 'ground'/u,
    /type: 'shell'/u,
    /dataset\.weaponVfxPoolPressure/u,
    /dataset\.weaponVfxDropped/u,
    /dataset\.lastImpactSurface/u,
  ]) assert.match(source, pin);
  // Cover and ground impacts read only render-side lookups.
  assert.match(source, /BLOCKER_VISUAL_KIND/u);
  assert.match(source, /blockerVisualKind: BLOCKER_VISUAL_KIND\.get\(/u);
  assert.match(source, /queryGround\(shot\.x, shot\.y\)/u);
  // Muzzle, tracer and impact resolvers all see the reduceFlash setting.
  assert.ok((source.match(/reduceFlash: settings\.reduceFlash/gu) ?? []).length >= 4);
  // The existing pins this slice must not break.
  assert.match(raw, /particleScale > 0 \? \(event\.critical \? 8 : 4\) : 0/u);
  assert.match(raw, /impactSprayAngles\(/u);
  assert.match(raw, /function deterministicUnit\(key\)/u);
  assert.doesNotMatch(raw, /Math\.random/u);
});

test('weapon VFX is projection-only source', async () => {
  const source = await readFile(moduleUrl, 'utf8');
  assert.doesNotMatch(source, /Math\.random/u);
  assert.doesNotMatch(source, /performance\.now/u);
  assert.doesNotMatch(source, /Date\.now/u);
  assert.doesNotMatch(source, /from 'pixi\.js'/u, 'engine classes are injected, never imported');
  assert.doesNotMatch(source, /from '\.\/(enemy-simulation|movement|collision|elevation|grenades|weapon-system|liquidator-boss|encounter-director|projectile-physics|simulation)/u);
  assert.match(source, /runtimeAuthority: 'projection-only'/u);
});
