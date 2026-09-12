import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ENEMY_HIT_REACTION, resolveEnemyHitReaction } from '../apps/hmh-reboot/src/enemy-hit-feedback.mjs';
import { createProductionEnemyDisplay } from '../apps/hmh-reboot/src/enemy-production-art.mjs';

const moduleUrl = new URL('../apps/hmh-reboot/src/enemy-hit-feedback.mjs', import.meta.url);
const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

const BASE = Object.freeze({
  knockback: Object.freeze({ x: 12, y: -4 }),
  knockbackResistance: 1,
  damageApplied: 16,
  maxHealth: 80,
  critical: false,
  shielded: false,
  armor: 1,
  supportArmored: false,
  zoom: 1,
  particleScale: 10,
  seed: 'enemy-1:100',
});
const ARMORED = Object.freeze({ ...BASE, armor: 1.35, knockbackResistance: 1.8 });
const react = (overrides = {}) => resolveEnemyHitReaction({ ...BASE, ...overrides });
const dot = (reaction, knockback) => reaction.offsetX * knockback.x + reaction.offsetY * knockback.y;

test('the resolver is pure: no random, no clock, and no read of simulation attack or health state', async () => {
  const source = await readFile(moduleUrl, 'utf8');
  assert.doesNotMatch(source, /Math\.random|Date\.|Date\(|performance\./, 'projection feedback must be seeded');
  assert.doesNotMatch(source, /attackPhase|\.health|attackPhaseUntilTick/, 'the resolver never reads an entity');
  assert.match(source, /import \{ feedbackUnit \} from '\.\/deterministic-hash\.mjs'/);
  assert.equal(Object.isFrozen(ENEMY_HIT_REACTION), true);
  assert.deepEqual(ENEMY_HIT_REACTION, {
    lifeTicks: 6, flashTicks: 2, maxOffsetPx: 6, squash: 0.08, shardsFull: 5, shardsReduced: 3,
    flashTint: 0xffd6d6, armorShard: 0xb9c6d1, shieldShard: 0x8bb8ff,
  });
});

test('identical inputs resolve to identical frozen output', () => {
  for (let age = 0; age < ENEMY_HIT_REACTION.lifeTicks; age += 1) {
    const first = resolveEnemyHitReaction({ ...ARMORED, age });
    const second = resolveEnemyHitReaction({ ...ARMORED, age });
    assert.deepEqual(first, second, `age ${age}`);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.shards), true);
    assert.equal(Object.isFrozen(first.ring), true);
    for (const shard of first.shards) assert.equal(Object.isFrozen(shard), true);
  }
  const seeded = resolveEnemyHitReaction({ ...ARMORED, age: 1, seed: 'enemy-2:100' });
  assert.notDeepEqual(seeded.shards, resolveEnemyHitReaction({ ...ARMORED, age: 1 }).shards, 'the seed fans the shards differently');
});

test('the reaction lives six ticks, stays inside its offset and squash bounds, and opposes the knockback', () => {
  assert.equal(react({ age: -1 }), null);
  assert.equal(react({ age: 6 }), null);
  assert.equal(react({ age: 1.5 }), null, 'ages are whole ticks');
  const heavy = { x: 90, y: 30 };
  for (const zoom of [0.7, 1, 1.6]) {
    for (let age = 0; age < 6; age += 1) {
      const reaction = react({ age, zoom, knockback: heavy, critical: true });
      assert.ok(reaction, `age ${age} zoom ${zoom}`);
      assert.ok(Math.hypot(reaction.offsetX, reaction.offsetY) <= ENEMY_HIT_REACTION.maxOffsetPx * zoom + 1e-9, 'offset is capped');
      assert.ok(reaction.squashX >= 0.92 && reaction.squashX <= 1.08);
      assert.ok(reaction.squashY >= 0.92 && reaction.squashY <= 1.08);
      assert.ok(dot(reaction, heavy) < 0, 'the body knocks back against the hit');
      if (age >= ENEMY_HIT_REACTION.flashTicks) {
        assert.equal(reaction.squashX, 1, 'squash is only the first two ticks');
        assert.equal(reaction.squashY, 1);
        assert.equal(reaction.flash, false);
        assert.equal(reaction.tint, null, 'after the flash the display gets its own tint back');
      } else {
        assert.ok(reaction.squashX > 1 && reaction.squashY < 1);
        assert.equal(reaction.flash, true);
        assert.equal(reaction.tint, ENEMY_HIT_REACTION.flashTint);
      }
    }
  }
  const first = react({ age: 0, knockback: heavy });
  const last = react({ age: 5, knockback: heavy });
  assert.ok(Math.hypot(last.offsetX, last.offsetY) < Math.hypot(first.offsetX, first.offsetY), 'the offset decays over the window');
  // A graze (5% of max health) squashes at half strength; a critical graze
  // and a hit worth a fifth of the body's health both squash at the full
  // table amount.
  assert.equal(react({ age: 0, damageApplied: 4 }).squashX, 1 + ENEMY_HIT_REACTION.squash / 2);
  assert.equal(react({ age: 0, damageApplied: 4, critical: true }).squashX, 1 + ENEMY_HIT_REACTION.squash);
  assert.equal(react({ age: 0 }).squashX, 1 + ENEMY_HIT_REACTION.squash, 'a fifth of max health is the full squash');
  assert.ok(Math.abs(react({ age: 0, knockbackResistance: 1.8 }).squashX - 1) < Math.abs(react({ age: 0 }).squashX - 1), 'a heavy body squashes less');
});

test('a zero knockback (shielded or point-blank) keeps the body still but still sheds a full-circle fan', () => {
  const still = react({ age: 0, knockback: { x: 0, y: 0 }, shielded: true });
  assert.equal(still.offsetX, 0);
  assert.equal(still.offsetY, 0);
  assert.equal(Object.is(still.offsetX, -0), false, 'no negative zero leaks into the display');
  assert.equal(still.shards.length, ENEMY_HIT_REACTION.shardsFull);
  const angles = still.shards.map((shard) => Math.atan2(shard.dy, shard.dx));
  assert.ok(Math.max(...angles) - Math.min(...angles) > Math.PI, 'no direction means a full circle');
  assert.equal(react({ age: 0, knockback: undefined }).offsetX, 0);
});

test('reduce-motion zeroes the offset, squash and shards; reduce-flash whitens the ring, halves alpha and never tints the body', () => {
  const motion = resolveEnemyHitReaction({ ...ARMORED, age: 0, reduceMotion: true });
  assert.equal(motion.offsetX, 0);
  assert.equal(motion.offsetY, 0);
  assert.equal(motion.squashX, 1);
  assert.equal(motion.squashY, 1);
  assert.deepEqual(motion.shards, []);
  assert.equal(motion.flash, true, 'reduce-motion keeps the colour cue');
  const plain = resolveEnemyHitReaction({ ...ARMORED, age: 0 });
  const flash = resolveEnemyHitReaction({ ...ARMORED, age: 0, reduceFlash: true });
  assert.equal(flash.flash, false);
  assert.equal(flash.tint, null);
  assert.equal(flash.ring.color, 0xffffff);
  assert.equal(flash.ring.alpha, plain.ring.alpha / 2);
  assert.equal(flash.shards.length, plain.shards.length, 'reduce-flash keeps the motion');
  assert.equal(flash.shards[0].alpha, plain.shards[0].alpha / 2);
  assert.deepEqual({ x: flash.offsetX, y: flash.offsetY }, { x: plain.offsetX, y: plain.offsetY });
});

test('shards follow the particle tier and only appear on armour, shields or a support pulse', () => {
  assert.equal(resolveEnemyHitReaction({ ...ARMORED, age: 0, particleScale: 10 }).shards.length, 5);
  assert.equal(resolveEnemyHitReaction({ ...ARMORED, age: 0, particleScale: 5 }).shards.length, 3);
  assert.equal(resolveEnemyHitReaction({ ...ARMORED, age: 0, particleScale: 0 }).shards.length, 0);
  assert.equal(react({ age: 0, armor: 1 }).shards.length, 0, 'plain flesh keeps the impact burst as its only spray');
  assert.equal(react({ age: 0, armor: 1.05 }).shards.length, 0, 'the gas-bomber / cultist base armour is not armour feedback');
  assert.ok(react({ age: 0, armor: 1.06 }).shards.length > 0);
  const shielded = react({ age: 0, shielded: true });
  assert.ok(shielded.shards.length > 0);
  assert.ok(shielded.shards.every((shard) => shard.color === ENEMY_HIT_REACTION.shieldShard));
  const pulsed = react({ age: 0, supportArmored: true });
  assert.ok(pulsed.shards.length > 0);
  assert.ok(pulsed.shards.every((shard) => shard.color === ENEMY_HIT_REACTION.armorShard));
  assert.equal(pulsed.ring.color, ENEMY_HIT_REACTION.armorShard, 'the ring takes the armour colour when armour resisted the hit');
  assert.equal(react({ age: 0 }).ring.color, ENEMY_HIT_REACTION.flashTint);
  // Shards fan back against the knock, inside the cone, and scale with zoom.
  const fan = resolveEnemyHitReaction({ ...ARMORED, age: 0, zoom: 2 });
  for (const shard of fan.shards) {
    assert.ok(shard.dx * BASE.knockback.x + shard.dy * BASE.knockback.y < 0, 'shards spray away from the hit');
    assert.ok(shard.radius === 10 && shard.alpha > 0);
  }
  for (let age = 1; age < 6; age += 1) {
    const older = resolveEnemyHitReaction({ ...ARMORED, age });
    assert.ok(older.shards[0].alpha < resolveEnemyHitReaction({ ...ARMORED, age: age - 1 }).shards[0].alpha, 'shards fade');
  }
});

test('the vector display exposes setTint and hands the pose tint back on null', () => {
  class FakePoint { constructor() { this.x = 1; this.y = 1; } set(x, y = x) { this.x = x; this.y = y; } }
  class FakeContainer {
    constructor() { this.children = []; this.scale = new FakePoint(); this.position = new FakePoint(); this.tint = 0xffffff; this.visible = true; }
    addChild(...children) { this.children.push(...children); return children[0]; }
  }
  class FakeGraphics extends FakeContainer {
    clear() { return this; }
    poly() { return this; }
    circle() { return this; }
    ellipse() { return this; }
    rect() { return this; }
    roundRect() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    fill() { return this; }
    stroke() { return this; }
  }
  const display = createProductionEnemyDisplay({ archetypeId: 'forkrunner', ContainerClass: FakeContainer, GraphicsClass: FakeGraphics });
  assert.equal(typeof display.setTint, 'function');
  const tinted = () => display.children[1].children.filter((child) => child.tint !== 0xffffff).map((child) => child.tint);
  display.setTint(0xffd6d6);
  assert.deepEqual(tinted(), [0xffd6d6, 0xffd6d6, 0xffd6d6], 'body, head and identity take the flash');
  display.setTint(null);
  assert.deepEqual(tinted(), [], 'null restores the idle tint');
  display.applyPose({ state: 'hit', tick: 3 });
  display.setTint(0xffd6d6);
  display.setTint(null);
  assert.deepEqual(tinted(), [0xffb3b3, 0xffb3b3, 0xffb3b3], 'null restores the hit clip tint the pose owns, not white');
  display.applyPose({ state: 'idle', tick: 4 });
  assert.deepEqual(tinted(), [], 'a pose refresh clears any leftover flash');
});

test('the runtime loads the resolver as a dynamic chunk, records hits after the pinned window, prunes and clears the Map, and applies the reaction after the pinned scale', async () => {
  const source = stripComments(await readFile(mainUrl, 'utf8'));
  assert.match(source, /void import\('\.\/enemy-hit-feedback\.mjs'\)/, 'the resolver is a dynamic chunk');
  assert.doesNotMatch(source, /from '\.\/enemy-hit-feedback\.mjs'/, 'never a static import: it must not touch the initial budget');
  assert.equal(source.match(/import\('\.\/enemy-hit-feedback\.mjs'\)/g).length, 1, 'exactly one load site');
  assert.ok(source.indexOf("import('./gore-presentation.mjs')") < source.indexOf("import('./enemy-hit-feedback.mjs')"), 'loaded next to the gore chunk');

  // The record lands immediately after the pinned hit window assignment.
  const hitWindow = source.indexOf('enemy.hitUntilTick = tick + 6;');
  assert.ok(hitWindow >= 0);
  const record = source.indexOf('enemyHitFeedbackById.set(enemy.id, Object.freeze({', hitWindow);
  assert.ok(record > hitWindow && record < source.indexOf('resolveSweptCircleMotion({', hitWindow), 'recorded before the knockback sweep');
  assert.match(source.slice(record, record + 500), /supportArmored: \(enemy\.supportArmorUntilTick \?\? 0\) > tick/);
  assert.match(source.slice(record, record + 500), /knockback: damageEvent\.knockback/);
  assert.match(source, /const enemyHitFeedbackById = new Map\(\);/);

  // Pruned on retirement (inside queueEnemyDeathVisual, which both retirement
  // paths call) and cleared with the run.
  const deathVisual = source.indexOf('const queueEnemyDeathVisual = (enemy, tick) => {');
  assert.ok(deathVisual >= 0);
  const prune = source.indexOf('enemyHitFeedbackById.delete(enemy?.id);', deathVisual);
  assert.ok(prune > deathVisual && prune < source.indexOf('enemyDeathMarkers.has(enemy.id)', deathVisual), 'pruned before the corpse is queued');
  const reset = source.indexOf('lastEnemyAttack = null;\n    lastEnemyStrike = null;');
  assert.ok(reset >= 0);
  assert.ok(source.indexOf('enemyHitFeedbackById.clear();', reset) < source.indexOf('resetEnemyMarkers([]);', reset), 'cleared in the run reset block');

  // Applied after the pinned scale.set, as separate multiplies, with the
  // pinned reduce-motion idiom and the reduce-flash setting.
  const scaleSet = source.indexOf('enemyMarker.scale.set((enemyMarker.rosterScale ?? 1) * camera.zoom);');
  assert.ok(scaleSet >= 0);
  const call = source.indexOf('enemyHitFeedback.resolveEnemyHitReaction({', scaleSet);
  assert.ok(call > scaleSet);
  const feel = source.slice(call, call + 600);
  assert.match(feel, /reduceMotion: settings\.reduceMotion \|\| performanceProfile\.particlesPerHazard === 0/);
  assert.match(feel, /reduceFlash: settings\.reduceFlash/);
  assert.match(feel, /seed: `\$\{enemy\.id\}:\$\{hit\.tick\}`/);
  const squashX = source.indexOf('enemyMarker.scale.x *= reaction.squashX;', scaleSet);
  const squashY = source.indexOf('enemyMarker.scale.y *= reaction.squashY;', scaleSet);
  const offset = source.indexOf('enemyMarker.position.set(enemyScreen.x + reaction.offsetX, enemyScreen.y + reaction.offsetY);', scaleSet);
  assert.ok(offset > scaleSet && squashX > offset && squashY > squashX, 'offset then squash, all after the pinned scale');
  assert.ok(squashY < source.indexOf('enemyMarker.alpha = 1;', scaleSet), 'inside the visible-marker branch');
  assert.match(source.slice(scaleSet, squashY + 400), /enemyMarker\.setTint\(reaction\?\.tint \?\? null\);/, 'the tint is handed back every frame');
  assert.doesNotMatch(feel, /\.arc\(/);
  // The Map is projection state: nothing under the simulation directory reads it.
  for (const file of ['enemy-combat.mjs', 'enemy-simulation.mjs', 'enemy-archetypes.mjs', 'combat-events.mjs']) {
    const sim = await readFile(new URL(`../apps/hmh-reboot/src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(sim, /enemyHitFeedback|enemy-hit-feedback/, `${file} must not know about the projection Map`);
  }
});
