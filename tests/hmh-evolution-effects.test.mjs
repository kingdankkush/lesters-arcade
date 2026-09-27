// Wave-1 evolution effects that live beside the weapon step (design package
// 8.5, build ledger slice 7): Crypto Bomb Orbit's bomblet pool, Hashstorm
// Overdrive's vent ring, Crit Candle's first-body crit, and the bomblet
// feedback class limits.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOMBLET_FEEDBACK_LIMITS,
  bombletPosition,
  createBombletFeedbackBudget,
  createBombletPool,
  critCandleHitChance,
  spawnBomblets,
  stepBomblets,
  takeBombletFeedback,
  ventRingHits,
} from '../apps/hmh-reboot/src/evolution-effects.mjs';
import { HMH_EVOLUTION_TUNING } from '../apps/hmh-reboot/src/weapon-system.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import { GRENADE_FEEDBACK_CLASSES, MAX_GRENADE_FX_EVENTS, MAX_GRENADE_FX_PARTICLES } from '../apps/hmh-reboot/src/grenade-feedback.mjs';

const ORBIT = HMH_EVOLUTION_TUNING['crypto-bomb-orbit'];
const target = (id, x, y, radius = 16) => ({ id, x, y, radius });

test('three bomblets orbit the blast at r100 for 45 ticks, at 2πk/3 + 2π(t−t0)/45', () => {
  const pool = createBombletPool();
  const spawned = spawnBomblets(pool, { tick: 100, parentId: 'launcher-rig:00000001', centre: { x: 500, y: 300, z: 4 }, parentDamage: 50 });
  assert.equal(spawned.spawned, 3);
  assert.deepEqual(pool.active.map((bomblet) => bomblet.id), ['launcher-rig:00000001:b0', 'launcher-rig:00000001:b1', 'launcher-rig:00000001:b2']);
  for (const [k, bomblet] of pool.active.entries()) {
    for (const tick of [100, 111, 145]) {
      const angle = 2 * Math.PI * k / 3 + 2 * Math.PI * (tick - 100) / 45;
      const point = bombletPosition(bomblet, tick);
      assert.ok(Math.abs(point.x - (500 + 100 * Math.cos(angle))) < 1e-9 && Math.abs(point.y - (300 + 100 * Math.sin(angle))) < 1e-9, `k=${k} tick=${tick}`);
    }
  }
  assert.deepEqual([ORBIT.count, ORBIT.orbitRadius, ORBIT.lifeTicks, ORBIT.blastRadius, ORBIT.damageScale, ORBIT.poolCap], [3, 100, 45, 64, 0.4, 12]);
});

test('each bomblet detonates on first contact or at the end: r64, 40% of the parent blast, never the player', () => {
  const pool = createBombletPool();
  spawnBomblets(pool, { tick: 0, parentId: 'g1', centre: { x: 0, y: 0, z: 0 }, parentDamage: 50 });
  // b0 starts at (100, 0): an enemy there is contacted on the first step; the
  // player standing on b1's path is never a contact or a blast victim.
  const b1Start = bombletPosition(pool.active[1], 1);
  const targets = [target('enemy-a', 101, 2), target('player', b1Start.x, b1Start.y, 24), target('enemy-z', 150, 0)];
  const first = stepBomblets(pool, { tick: 1, targets });
  assert.deepEqual(first.detonations.map((row) => [row.bombletId, row.reason]), [['g1:b0', 'contact']]);
  const blast = first.detonations[0];
  assert.equal(blast.radius, 64);
  assert.deepEqual(blast.hits.map((hit) => hit.targetId), ['enemy-a', 'enemy-z'], 'enemies inside r64 (plus their radius), by id');
  assert.ok(blast.hits.every((hit) => hit.damage === 20 && hit.sourceId === 'player' && hit.weaponId === 'launcher-rig'));
  assert.equal(pool.active.length, 2);
  let tick = 2;
  let ends = [];
  for (; tick <= 45; tick += 1) {
    const frame = stepBomblets(pool, { tick, targets: [target('player', 0, 0, 24)] });
    ends = ends.concat(frame.detonations);
  }
  assert.deepEqual(ends.map((row) => [row.bombletId, row.reason, row.tick]), [['g1:b1', 'end', 45], ['g1:b2', 'end', 45]]);
  assert.ok(ends.every((row) => row.hits.every((hit) => hit.targetId !== 'player')));
  assert.equal(pool.active.length, 0);
});

test('contacts resolve bomblets by id, then enemies by id; the pool caps at 12 and counts the overflow', () => {
  const pool = createBombletPool();
  for (let index = 0; index < 5; index += 1) spawnBomblets(pool, { tick: 0, parentId: `g${index}`, centre: { x: index * 1_000, y: 0, z: 0 }, parentDamage: 30 });
  assert.equal(pool.active.length, 12);
  assert.equal(pool.overflow, 3);
  const order = createBombletPool();
  spawnBomblets(order, { tick: 0, parentId: 'b', centre: { x: 0, y: 0, z: 0 }, parentDamage: 10 });
  spawnBomblets(order, { tick: 0, parentId: 'a', centre: { x: 0, y: 0, z: 0 }, parentDamage: 10 });
  const at = bombletPosition(order.active.find((row) => row.id === 'a:b0'), 1);
  const frame = stepBomblets(order, { tick: 1, targets: [target('enemy-2', at.x, at.y), target('enemy-1', at.x, at.y)] });
  assert.deepEqual(frame.detonations.map((row) => [row.bombletId, row.contactId]), [['a:b0', 'enemy-1'], ['b:b0', 'enemy-1']]);
  // Same inputs, same result.
  const again = createBombletPool();
  spawnBomblets(again, { tick: 0, parentId: 'b', centre: { x: 0, y: 0, z: 0 }, parentDamage: 10 });
  spawnBomblets(again, { tick: 0, parentId: 'a', centre: { x: 0, y: 0, z: 0 }, parentDamage: 10 });
  assert.deepEqual(stepBomblets(again, { tick: 1, targets: [target('enemy-2', at.x, at.y), target('enemy-1', at.x, at.y)] }), frame);
});

test('bomblet feedback: its own class inside the grenade FX caps, at most 4 bursts a tick and 2 cues per 6 ticks', () => {
  assert.ok(GRENADE_FEEDBACK_CLASSES.bomblet, 'a bomblet feedback class');
  assert.ok(GRENADE_FEEDBACK_CLASSES.bomblet.fragments * BOMBLET_FEEDBACK_LIMITS.burstsPerTick <= MAX_GRENADE_FX_PARTICLES);
  assert.ok(BOMBLET_FEEDBACK_LIMITS.burstsPerTick <= MAX_GRENADE_FX_EVENTS);
  assert.deepEqual([BOMBLET_FEEDBACK_LIMITS.burstsPerTick, BOMBLET_FEEDBACK_LIMITS.cuesPerWindow, BOMBLET_FEEDBACK_LIMITS.cueWindowTicks], [4, 2, 6]);
  const budget = createBombletFeedbackBudget();
  assert.deepEqual(takeBombletFeedback(budget, { tick: 10, count: 6 }), { bursts: 4, cues: 1 });
  assert.deepEqual(takeBombletFeedback(budget, { tick: 12, count: 2 }), { bursts: 2, cues: 1 });
  assert.deepEqual(takeBombletFeedback(budget, { tick: 15, count: 3 }), { bursts: 3, cues: 0 }, 'two cues already in this 6-tick window');
  assert.deepEqual(takeBombletFeedback(budget, { tick: 16, count: 1 }), { bursts: 1, cues: 1 }, 'the tick-10 cue has left the window');
});

test('Hashstorm vent ring: every enemy body within 140 of the hero, never the player', () => {
  const vent = { tick: 30, attackId: 'auto-miner:00000009:vent', weaponId: 'auto-miner', radius: 140, damage: 12, knockback: 24 };
  const hits = ventRingHits(vent, { origin: { x: 0, y: 0, z: 0 }, targets: [target('player', 0, 0, 24), target('enemy-b', 150, 0, 16), target('enemy-a', 0, 120), target('enemy-far', 0, 170, 16)] });
  assert.deepEqual(hits.map((hit) => hit.targetId), ['enemy-a', 'enemy-b']);
  for (const hit of hits) {
    assert.equal(hit.damage, 12);
    assert.equal(hit.knockback, 24);
    assert.equal(hit.weaponId, 'auto-miner');
    assert.equal(hit.criticalChance, 0);
    assert.equal(hit.id, `${vent.attackId}:${hit.targetId}`);
  }
});

test('Crit Candle: +15% under the cap; a slug whose first body crits crits every body it pierces', () => {
  const cap = 0.45;
  assert.equal(critCandleHitChance({ chance: 0.2, cap, shot: {} }).criticalChance, 0.35);
  assert.equal(critCandleHitChance({ chance: 0.4, cap, shot: {} }).criticalChance, 0.45);
  // Find a seed whose first-body roll crits, and one that does not.
  const roll = (seed) => seededUnit(seed, 'critical:rail:00:enemy-1:body:enemy-1') < 0.08 + 0.15;
  const critSeed = [...Array(200).keys()].find(roll);
  const plainSeed = [...Array(200).keys()].find((seed) => !roll(seed));
  const crit = { };
  const firstCrit = critCandleHitChance({ chance: 0.08, cap, shot: crit, seed: critSeed, hitId: 'rail:00:enemy-1:body', targetId: 'enemy-1' });
  assert.equal(firstCrit.criticalChance, 0.08 + 0.15);
  assert.equal(crit.candleCrit, true);
  assert.equal(critCandleHitChance({ chance: 0.08, cap, shot: crit, seed: critSeed, hitId: 'rail:00:enemy-2:body', targetId: 'enemy-2' }).criticalChance, 1, 'pierced bodies crit');
  const plain = {};
  critCandleHitChance({ chance: 0.08, cap, shot: plain, seed: plainSeed, hitId: 'rail:00:enemy-1:body', targetId: 'enemy-1' });
  assert.equal(plain.candleCrit, false);
  assert.equal(critCandleHitChance({ chance: 0.08, cap, shot: plain, seed: plainSeed, hitId: 'rail:00:enemy-2:body', targetId: 'enemy-2' }).criticalChance, 0.08 + 0.15, 'otherwise each body rolls its own');
});
